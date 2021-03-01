import React, { Component, createRef, MouseEvent } from 'react';
import { PanelProps, LoadingState, DataFrame } from '@grafana/data';
import { Icon, Button } from '@grafana/ui';
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
} from './react-leaflet-compat';

import { TracerouteMapOptions } from './types';
import { IP2Geo, IPGeo } from './geoip';
import { rainbowPalette, round, HiddenHostsStorage, simplyHostname, batch_with_throttle } from './utils';
import 'panel.css';

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
    if (this.props.data.series !== this.state.series && this.props.data.state === LoadingState.Done) {
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
      console.log(e);
    }
  }

  async processData(
    series: DataFrame[]
  ): Promise<{ data: Map<string, PathPoint[]>; mapBounds: Map<string, LatLngTuple[]> }> {
    if (series.length !== 1 || series[0].fields.length !== 7) {
      throw new Error('No query data or not formatted as table.');
    }
    const options = this.props.options;
    const entries = dataFrameToEntries(series[0]);

    const parallelizer = options.parallelizeGeoIP ? batch_with_throttle : (v: Array<Promise<IPGeo>>) => Promise.all(v);
    const geos = await parallelizer(
      entries.map(async (entry) => {
        const ip = entry[3];
        return await this.ip2geo(ip);
      }),
      options.concurrentRequests,
      options.requestsPerSecond
    );

    let data: Map<string, Map<string, PathPoint>> = new Map();
    for (const [entry, geo] of _.zip(entries, geos)) {
      const [host, dest, hop, ip, rtt, loss] = entry as [string, string, number, string, number, number];
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

    // TODO: use catersian product to handle non-linear route paths
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
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        <MarkerClusterGroup maxClusterRadius={options.mapClusterRadius} /*options={{ singleMarkerMode: true }}*/>
          {Array.from(data.entries()).map(([key, points]) => {
            const [host, dest] = key.split('|');
            return (
              <TraceRouteMarkers
                key={key}
                dest={dest}
                host={host}
                points={points}
                color={palette()}
                visible={!this.state.hiddenHosts.has(key)}
                wrapCoord={this.wrapCoord}
              />
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
                    /* eslint-disable-next-line react/jsx-key */
                    <li className="host-item" onClick={() => this.toggleHostItem(key)}>
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
                  <Button variant="primary" size="md" onClick={this.handleFit}>
                    {/* FIX: @grafana/ui Button keeps active state */}
                    Fit
                  </Button>
                );
              case 'loading':
                return (
                  <span className="map-indicator loading">
                    <i className="fa fa-spinner fa-spin" />
                    Loading
                  </span>
                );
              case 'error':
                return (
                  <span className="map-indicator error" title="The Debugging Console shows the detailed error.">
                    <i className="fa fa-warning" />
                    Error processing data
                  </span>
                );
            }
          })()}
        </Control>
      </LMap>
    );
  }
}

// Traceroute for one host->dest pair
const TraceRouteMarkers: React.FC<{
  host: string;
  dest: string;
  points: PathPoint[];
  color: string;
  visible: boolean;
  wrapCoord?: (coord: LatLngTuple) => LatLngTuple;
}> = ({ host, dest, points, color, visible, wrapCoord }) => {
  let wrapCoord_: (coord: LatLngTuple) => LatLngTuple;
  if (wrapCoord === undefined) {
    wrapCoord_ = (coord: LatLngTuple) => coord;
  } else {
    wrapCoord_ = wrapCoord;
  }

  return visible ? (
    <div data-host={host} data-dest={dest} data-points={points.length}>
      {points.map((point) => (
        <Marker key={point.region} position={wrapCoord_([point.lat, point.lon])} className="point-marker">
          <Popup className="point-popup">
            <span className="point-label">{point.region}</span>
            <hr />
            <ul className="hop-list">
              {point.hops.map((hop) => (
                /* eslint-disable-next-line react/jsx-key */
                <li className="hop-item">
                  <span className="hop-nth">{hop.nth}</span>{' '}
                  <span className="hop-label" title={`${hop.ip} RTT:${hop.rtt} Loss:${hop.loss}`}>
                    {hop.label}
                  </span>
                </li>
              ))}
            </ul>
            <hr />
            <span className="host-label">{host}</span>
            <span className="host-arrow" style={{ color }}>
              &nbsp; ➡️ &nbsp;
            </span>
            <span className="dest-label">{dest}</span>
          </Popup>
        </Marker>
      ))}
      <Polyline
        positions={points.map((point) => wrapCoord_([point.lat, point.lon]) as LatLngTuple)}
        color={color}
      ></Polyline>
    </div>
  ) : (
    <></>
  );
};

/**
 * Process the raw data frame to produce entries of fields `['host', 'dest', 'hop', 'ip', 'rtt', 'loss']`.
 *
 * @param frame The raw data frame to be processed. It is expected to inlude the expected fields.
 * @return Entries of fields.
 */
function dataFrameToEntries(frame: DataFrame): Array<[string, string, number, string, number, number]> {
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
    throw new Error('Invalid query data');
  }
  let entries = _.zip(
    fields.host,
    fields.dest,
    fields.hop.map(parseInt),
    fields.ip,
    fields.rtt.map(parseFloat),
    fields.loss.map(parseFloat)
  ) as Array<[string, string, number, string, number, number]>;
  entries.sort((a, b) => a[2] - b[2]);
  return entries;
}
