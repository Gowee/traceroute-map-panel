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
  LCurve,
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
import { pointsToBezierPath1, pointsToBezierPath2, pointsToBezierPath3, symmetricAboutLine } from './spline';
import { interpolate1 } from './spline';
import { DataEntry, RoutePoint, dataFrameToEntries, entriesToRoutesAndBounds } from './data';

interface Props extends PanelProps<TracerouteMapOptions> {}

interface State {
  routes: Map<string, RoutePoint[]>;
  series: any;
  mapBounds: Map<string, LatLngTuple[]>;
  hiddenHosts: Set<string>;
  hostListExpanded: boolean;
  indicator?: 'loading' | 'error';
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
      routes: new Map(),
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
      const { routes: data, mapBounds } = await this.processData(this.props.data.series);
      this.setState({ indicator: undefined, routes: data, mapBounds });
    } catch (e) {
      this.setState({ indicator: 'error' });
      console.error(e);
    }
  }

  async processData(
    series: DataFrame[]
  ): Promise<{ routes: Map<string, RoutePoint[]>; mapBounds: Map<string, LatLngTuple[]> }> {
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

    const routesAndBounds = await entriesToRoutesAndBounds(_.zip(entries, geos) as Array<[DataEntry, IPGeo]>);

    console.log(routesAndBounds);
    return routesAndBounds;
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
    const routes = this.state.routes;
    let palette = rainbowPalette(routes.size, 0.618);
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
        <MarkerClusterGroup maxClusterRadius={options.mapClusterRadius} /*options={{ singleMarkerMode: true }}*/>
          {Array.from(routes.entries()).map(([key, points]) => {
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
                {Array.from(routes.entries()).map(([key, points]) => {
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
  points: RoutePoint[];
  color: string;
  hopLabel: HopLabelType;
  showSearchIcon: boolean;
  coordWrapper?: (coord: LatLngTuple) => LatLngTuple;
}> = ({ host, dest, points, color, hopLabel, showSearchIcon, coordWrapper }) => {
  let wrapCoord = coordWrapper ?? ((coord: LatLngTuple) => coord);
  const path = points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple);
  const interpolatedPath = interpolate1(path);
  console.log(path, interpolatedPath);

  return (
    <div data-host={host} data-dest={dest} data-points={points.length}>
      {points.map((point) => (
        <Marker
          key={`${round(point.lat, 1)},${round(point.lon, 1)}`}
          position={wrapCoord([point.lat, point.lon])}
          className="point-marker"
        >
          <PointPopup
            host={host}
            dest={dest}
            point={point}
            color={color}
            hopLabel={hopLabel}
            showSearchIcon={showSearchIcon}
          />
        </Marker>
      ))}

      <AntPath
        positions={pointsToBezierPath1(points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple))}
        options={{ use: LCurve, color }}
      />
      <AntPath
        positions={pointsToBezierPath2(points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple))}
        options={{ use: LCurve, color: 'blue' }}
      />

      {/* <Polyline
        positions={points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple)}
        color={color}
      ></Polyline> */}
    </div>
  );
};

const PointPopup: React.FC<{
  host: string;
  dest: string;
  point: RoutePoint;
  color: string;
  hopLabel: HopLabelType;
  showSearchIcon: boolean;
}> = ({ host, dest, point, color, hopLabel, showSearchIcon }) => {
  return (
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
              {(hopLabel === 'ipAndLabel' || hopLabel === 'label') && <span className="hop-label">{hop.label}</span>}
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
  );
};
