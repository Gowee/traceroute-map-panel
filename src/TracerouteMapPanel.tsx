/* eslint-disable react/jsx-no-target-blank */

import React, { Component, createRef, MouseEvent } from 'react';
import { PanelProps, LoadingState, DataFrame } from '@grafana/data';
import { Icon, Button, Tooltip, Spinner } from '@grafana/ui';
// import { keys } from 'ts-transformer-keys';
import _ from 'lodash';
import {
  Map as LMap,
  Marker,
  Popup,
  TileLayer,
  Control,
  MarkerClusterGroup,
  Polyline,
  LatLngTuple,
  latLngBounds,
  LatLngBounds,
  LCurve
} from './react-leaflet-compat';
import AntPath from 'react-leaflet-ant-path';

import { TracerouteMapOptions, HopLabelType } from './options';
import { IP2Geo, IPGeo } from './geoip';
import {
  rainbowPalette,
  round,
  HiddenHostsStorage,
  simplyHostname,
  isBogusIPAddress,
  resolveHostname,
  makeThrottler,
  parseIPAddress,
} from './utils';
import 'panel.css';
import { pointsToBezierPath } from 'bezierCurve';

interface Props extends PanelProps<TracerouteMapOptions> {}

interface State {
  data: Map<string, PathPoint[]>;
  series: any;
  mapBounds: Map<string, LatLngTuple[]>;
  hiddenHosts: Set<string>;
  hostListExpanded: boolean;
  indicator?: 'loading' | 'error';
}

interface PathPoint {
  lat: number;
  lon: number;
  region: string;
  hops: Array<{
    nth: number;
    ip: string;
    label: string;
    rtt: number;
    loss: number;
  }>;
}

type DataEntry = [string, string, number, string, number, number];

export class TracerouteMapPanel extends Component<Props, State> {
  mapRef = createRef<any>();
  hiddenHostsStorage: HiddenHostsStorage;
  ip2geo: (ip: string) => Promise<IPGeo>;

  constructor(props: Props) {
    super(props);
    this.hiddenHostsStorage = new HiddenHostsStorage(this.props.id.toString());
    this.ip2geo = IP2Geo.fromProvider(this.props.options.geoIPProviders[this.props.options.geoIPProviders.active]);
    this.state = {
      data: new Map(),
      series: null,
      mapBounds: new Map(),
      hiddenHosts: this.hiddenHostsStorage.load(),
      hostListExpanded: true,
      indicator: 'loading',
    };
    this.updateData();
    this.handleFit = this.handleFit.bind(this);
    this.wrapCoord = this.wrapCoord.bind(this);
  }

  componentDidUpdate(prevProps: Props): void {
    if (
      prevProps.options.geoIPProviders[prevProps.options.geoIPProviders.active] !==
      this.props.options.geoIPProviders[this.props.options.geoIPProviders.active]
    ) {
      // won't trigger processData
      this.ip2geo = IP2Geo.fromProvider(this.props.options.geoIPProviders[this.props.options.geoIPProviders.active]);
    }
    if (prevProps.width !== this.props.width || prevProps.height !== this.props.height) {
      // https://github.com/PaulLeCam/react-leaflet/issues/340#issuecomment-527939630
      this.mapRef.current.leafletElement.invalidateSize();
    }
    if (
      (this.props.data.series !== this.state.series && this.props.data.state === LoadingState.Done) ||
      this.props.options.srcHostAsZerothHop !== prevProps.options.srcHostAsZerothHop ||
      this.props.options.bogonFilteringSpace !== this.props.options.bogonFilteringSpace
    ) {
      this.updateData();
    }
  }

  async updateData(): Promise<void> {
    console.log('loading');
    this.setState({ indicator: 'loading', series: this.props.data.series });
    try {
      const { data, mapBounds } = await this.processData(this.props.data.series);
      this.setState({ indicator: undefined, data, mapBounds });
    } catch (e) {
      this.setState({ indicator: 'error' });
      console.error(e);
    }
  }

  async processData(
    series: DataFrame[]
  ): Promise<{ data: Map<string, PathPoint[]>; mapBounds: Map<string, LatLngTuple[]> }> {
    if (series.length !== 1 || series[0].fields.length !== 7) {
      throw new Error('Data is empty or not formatted as table');
    }
    const options = this.props.options;
    const throttler = options.parallelizeGeoIP
      ? makeThrottler<string, unknown[], IPGeo>(options.concurrentRequests, options.requestsPerSecond)
      : undefined;

    const ip2geo = IP2Geo.fromProvider(options.geoIPProviders[options.geoIPProviders.active], throttler);

    let entries = dataFrameToEntries(series[0]);

    if (options.srcHostAsZerothHop) {
      // No option for parallelization of DoH resolution so far. Just borrow it from GeoIP.
      let zerothHopEntries: DataEntry[] = [];
      await Promise.all(
        Array.from(new Set(entries.map((entry) => `${entry[0]}|${entry[1]}`)).values()).map(async (hostDest) => {
          const [host, dest] = hostDest.split('|');
          const address = await resolveHostname(host);
          if (address) {
            zerothHopEntries.push([host, dest, 0, address, 0, 0]);
          }
        })
      );
      // Closer hops come first.
      entries = zerothHopEntries.concat(entries);
    }

    let bogonFilterer = (_: string) => false;
    console.log(options.bogonFilteringSpace, Boolean(options.bogonFilteringSpace));
    if (options.bogonFilteringSpace) {
      console.log('L418');
      bogonFilterer = (ip: string) => {
        const address = parseIPAddress(ip);
        console.log(address);
        return address ? isBogusIPAddress(address, options.bogonFilteringSpace === 'extendedBogon') : true;
      };
    }

    console.log(bogonFilterer);

    entries = entries.filter((entry) => !bogonFilterer(entry[3] /* hop IP */));

    const geos = await Promise.all(
      entries.map(async (entry) => {
        const ip = entry[3];
        return await ip2geo(ip);
      })
    );
    console.log(entries, geos);

    const routes = await entriesToRoutes(_.zip(entries, geos) as Array<[DataEntry, IPGeo]>);

    console.log(routes);
    return routes;
  }

  toggleHostItem(item: string) {
    this.setState({ hiddenHosts: this.hiddenHostsStorage.toggle(item) });
  }

  handleFit(event: MouseEvent) {
    this.mapRef.current.leafletElement.fitBounds(this.getEffectiveBounds());
  }

  /**
   * Return map bounds excluding those whose hosts are hidden.
   */
  getEffectiveBounds(): LatLngBounds | undefined {
    const tuples = Array.from(this.state.mapBounds.entries())
      .filter(([key, _value]) => !this.state.hiddenHosts.has(key))
      .flatMap(([_key, tuples]) => tuples)
      .map((tuple) => this.wrapCoord(tuple));
    return tuples.length ? latLngBounds(tuples) : undefined;
  }

  toggleHostList() {
    this.setState((prevState) => {
      return { hostListExpanded: !prevState.hostListExpanded };
    });
  }

  wrapCoord(coord: LatLngTuple): LatLngTuple {
    let [lat, lon] = coord;
    if (this.props.options.longitude360) {
      lon = (lon + 360) % 360;
    }
    return [lat, lon];
  }

  render() {
    const { width, height, options } = this.props;
    const data = this.state.data;
    let palette = rainbowPalette(data.size, 0.618);
    const effectiveBounds = this.getEffectiveBounds();
    return (
      <LMap
        key={this.state.series}
        ref={this.mapRef}
        center={[51.505, -0.09]}
        zoom={1}
        style={{ position: 'relative', height, width }}
        bounds={effectiveBounds}
        options={{ zoomSnap: 0.333, zoomDelta: 0.333 }}
      >
        <style type="text/css">
          {`
        .host-list .host-label, .host-list .dest-label {
          width: ${options.hostnameLabelWidth}em !important;
        }
        `}
        </style>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
        />
                <AntPath
          positions={[
            'M',
            [50.54136296522163, 28.520507812500004],

            'C',
            [52.214338608258224, 28.564453125000004],
            [48.45835188280866, 33.57421875000001],
            [50.680797145321655, 33.83789062500001],

            'V',
            [48.40003249610685],

            'L',
            [47.45839225859763, 31.201171875],
            [48.40003249610685, 28.564453125000004],

            'Z',
          ]}
          options={{ use: LCurve, color: 'red', fill: true }}
        />
        <MarkerClusterGroup maxClusterRadius={options.mapClusterRadius} /*options={{ singleMarkerMode: true }}*/>
          {Array.from(data.entries()).map(([key, points]) => {
            const [host, dest] = key.split('|');
            return (
              !this.state.hiddenHosts.has(key) && (
                <RouteMarkers
                  key={key}
                  dest={dest}
                  host={host}
                  points={points}
                  color={palette()}
                  hopLabel={options.hopLabelType}
                  showSearchIcon={options.showSearchIconInHopLabel}
                  coordWrapper={this.wrapCoord}
                />
              )
            );
          })}
        </MarkerClusterGroup>
        <Control position="bottomleft">
          {this.state.hostListExpanded ? (
            <>
              <span
                className="host-list-toggler host-list-collapse"
                title="Collapse hosts list"
                onClick={() => this.toggleHostList()}
              >
                <i className="fa fa-compress" />
              </span>
              <ul className="host-list">
                {Array.from(data.entries()).map(([key, points]) => {
                  const [host, dest] = key.split('|'); //.map(options.simplifyHostname ? simplyHostname : v => v);
                  const color = palette();
                  return (
                    <li key={`${host}|${dest}`} className="host-item" onClick={() => this.toggleHostItem(key)}>
                      <span className="host-label" title={host}>
                        {options.simplifyHostname ? simplyHostname(host) : host}
                      </span>
                      <span className="host-arrow" style={{ color: this.state.hiddenHosts.has(key) ? 'grey' : color }}>
                        <Icon name="arrow-right" />
                      </span>
                      <span className="dest-label" title={dest}>
                        {options.simplifyHostname ? simplyHostname(dest) : dest}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <span
              className="host-list-toggler host-list-expand"
              title="Expand hosts list"
              onClick={() => this.toggleHostList()}
            >
              <i className="fa fa-expand" />
            </span>
          )}
        </Control>
        <Control position="topright">
          {(() => {
            switch (this.state.indicator) {
              case undefined:
                return (
                  <Button variant="primary" size="md" onClick={this.handleFit} title="Fit the map view to all points">
                    {/* FIX: @grafana/ui Button keeps active state */}
                    Fit
                  </Button>
                );
              case 'loading':
                return (
                  <span className="map-indicator loading">
                    {/* <Spinner /> */}
                    <i className="fa fa-spinner fa-spin" />
                    Loading
                  </span>
                );
              case 'error':
                return (
                  <Tooltip content="The Debugging Console shows the detailed error." theme="error">
                    <span className="map-indicator error" title="">
                      <i className="fa fa-warning" />
                      Error processing data
                    </span>
                  </Tooltip>
                );
            }
          })()}
        </Control>
      </LMap>
    );
  }
}

/**
 * Leaflet Markers and Polyline for a single route, corresponding to one host->dest pair
 */
const RouteMarkers: React.FC<{
  host: string;
  dest: string;
  points: PathPoint[];
  color: string;
  hopLabel: HopLabelType;
  showSearchIcon: boolean;
  coordWrapper?: (coord: LatLngTuple) => LatLngTuple;
}> = ({ host, dest, points, color, hopLabel, showSearchIcon, coordWrapper }) => {
  let wrapCoord = coordWrapper ?? ((coord: LatLngTuple) => coord);

  return (
    <div data-host={host} data-dest={dest} data-points={points.length}>
      {points.map((point) => (
        <Marker
          key={`${round(point.lat, 1)},${round(point.lon, 1)}`}
          position={wrapCoord([point.lat, point.lon])}
          className="point-marker"
        >
          <Popup className="point-popup">
            <div className="region-label">
              <a href={`https://www.openstreetmap.org/#map=5/${point.lat}/${point.lon}`} target="_blank" rel="noopener">
                {point.region}
              </a>
            </div>
            <hr />
            <ul className="hop-list">
              {point.hops.map((hop) => (
                <li
                  className="hop-entry"
                  key={hop.nth}
                  title={`${hop.ip} (${hop.label ?? 'No network info available'}) RTT:${hop.rtt} Loss:${hop.loss}`}
                >
                  <span className="hop-nth">{hop.nth}.</span>{' '}
                  <span className="hop-detail">
                    {(hopLabel === 'ip' || hopLabel === 'ipAndLabel') && (
                      <span className="hop-ip-wrapper">
                        <span className="hop-ip">{hop.ip}</span>
                        {showSearchIcon && (
                          <a href={`https://bgp.he.net/ip/${hop.ip}`} target="_blank" rel="noopener">
                            <Icon name="search" title="Search the IP in bgp.he.net" style={{ marginBottom: 'unset' }} />
                          </a>
                        )}
                      </span>
                    )}
                    {(hopLabel === 'ipAndLabel' || hopLabel === 'label') && (
                      <span className="hop-label">{hop.label}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <hr />
            <div className="host-dest-label">
              <span className="host-label">{host}</span>
              <span className="host-arrow" style={{ color }}>
                &nbsp; ➜ &nbsp;
              </span>
              <span className="dest-label">{dest}</span>
            </div>
          </Popup>
        </Marker>
      ))}

      <div style={{ all: 'revert' }}>
        <AntPath
          positions={pointsToBezierPath(points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple))}
          options={{ use: LCurve, color }}
        />
      </div>
      <Polyline
        positions={points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple)}
        color={color}
      ></Polyline>
    </div>
  );
};

/**
 * Process the raw data frame to produce entries of fields `['host', 'dest', 'hop', 'ip', 'rtt', 'loss']`.
 *
 * @param frame The raw data frame to be processed. It is expected to inlude the expected fields.
 * @return Entries of fields.
 */
function dataFrameToEntries(frame: DataFrame): DataEntry[] {
  // TODO: how to make this function generic?
  let fields: any = {};
  ['host', 'dest', 'hop', 'ip', 'rtt', 'loss'].forEach((item) => (fields[item] = null));
  for (const field of frame.fields) {
    if (fields.hasOwnProperty(field.name)) {
      fields[field.name] = field.values.toArray();
    } /* else {
      console.log('Ignoring field: ' + field.name);
    } */
  }
  if (Object.values(fields).includes(null)) {
    throw new Error('Invalid data schema');
  }
  // Note: map(parseInt) does work as intended.
  //  ref: https://medium.com/dailyjs/parseint-mystery-7c4368ef7b21
  let entries = _.zip(
    fields.host,
    fields.dest,
    fields.hop.map((v: string) => parseInt(v, 10)),
    fields.ip,
    fields.rtt.map((v: string) => parseFloat(v)),
    fields.loss.map((v: string) => parseFloat(v))
  ) as DataEntry[];
  entries.sort((a, b) => a[2] - b[2]);
  return entries;
}

/**
 * Process [host, dest, hop, ip, rtt, loss] entries to produce routes.
 * @param entries Entries.
 * @param options Panel options.
 */
async function entriesToRoutes(
  entries_with_geos: Array<[DataEntry, IPGeo]>
): Promise<{ data: Map<string, PathPoint[]>; mapBounds: Map<string, LatLngTuple[]> }> {
  // TODO: use catersian product to handle non-linear route paths

  let data: Map<string, Map<string, PathPoint>> = new Map();
  for (const [entry, geo] of entries_with_geos) {
    const [host, dest, hop, ip, rtt, loss] = entry as DataEntry;
    const groupKey = `${host}|${dest}`;
    const { region, label, lat, lon } = geo as IPGeo;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      continue; // implying invalid or LAN IP
    }
    let group = data.get(groupKey);
    if (group === undefined) {
      group = new Map();
      data.set(groupKey, group);
    }
    // If two points are too close, they are merged into a single point.
    // Note: This has nothing to with mapClusterRadius.
    const point_id = `${round(lat, 1)},${round(lon, 1)}`;
    let point = group.get(point_id);
    if (point === undefined) {
      point = { lat, lon, region: region ?? 'unknown region', hops: [] };
      group.set(point_id, point);
    }
    // Add a new hop record at this point.
    point.hops.push({ nth: hop, ip, label: label ?? 'unknown network', rtt, loss });
  }
  let mapBounds: Map<string, LatLngTuple[]> = new Map();
  for (const [key, points] of Array.from(data.entries())) {
    const bound = latLngBounds(Array.from(points.values()).map((point) => [point.lat, point.lon]));
    mapBounds.set(key, [
      [bound.getSouth(), bound.getWest()],
      [bound.getNorth(), bound.getEast()],
    ]);
  }
  return {
    data: new Map(Array.from(data.entries()).map(([key, value]) => [key, Array.from(value.values())])),
    mapBounds,
  };
}
