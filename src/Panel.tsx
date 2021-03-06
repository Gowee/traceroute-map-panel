/* eslint-disable react/jsx-no-target-blank */

import React, { Component, createRef, MouseEvent, useState } from 'react';
import { PanelProps, LoadingState, DataFrame } from '@grafana/data';
import { Icon, Button, Tooltip, Spinner } from '@grafana/ui';
// import { keys } from 'ts-transformer-keys';
import _ from 'lodash';
import {
  Map as LMap,
  TileLayer,
  Control,
  MarkerClusterGroup,
  LatLngTuple,
  latLngBounds,
  LatLngBounds,
} from './react-leaflet-compat';

import { TracerouteMapOptions } from './options';
import { IP2Geo, IPGeo } from './geoip/api';
import {
  rainbowPalette,
  HiddenHostsStorage,
  simplyHostname,
  isBogusIPAddress,
  makeThrottler,
  parseIPAddress,
} from './utils';
import 'panel.css';
import {
  DataEntry,
  RoutePoint,
  dataFrameToEntries,
  entriesToRoutesAndBounds,
  prependZerothHopsBySrcHosts,
} from './data';
import HostTray from './components/HostTray';
import RoutePath from './components/RoutePath';

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
  // ip2geo: (ip: string) => Promise<IPGeo>;

  constructor(props: Props) {
    super(props);
    this.hiddenHostsStorage = new HiddenHostsStorage(this.props.id.toString());
    // this.ip2geo = IP2Geo.fromProvider(this.props.options.geoIPProviders[this.props.options.geoIPProviders.active]);
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
    // if (
    //   prevProps.options.geoIPProviders[prevProps.options.geoIPProviders.active] !==
    //   this.props.options.geoIPProviders[this.props.options.geoIPProviders.active]
    // ) {
    //   // won't trigger processData
    //   this.ip2geo = IP2Geo.fromProvider(this.props.options.geoIPProviders[this.props.options.geoIPProviders.active]);
    // }
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

    const geoIPThrottler = options.parallelizeGeoIP
      ? makeThrottler<string, unknown[], IPGeo>(options.concurrentRequests, options.requestsPerSecond)
      : undefined;
    const ip2geo = IP2Geo.fromProvider(options.geoIPProviders[options.geoIPProviders.active], geoIPThrottler);

    let entries = dataFrameToEntries(series[0]);

    if (options.srcHostAsZerothHop) {
      // No option of parallelization for DoH resolution so far. Just hardcode for now.
      const doHThrottler = makeThrottler<string, unknown[], string | null>(10, 100);
      entries = await prependZerothHopsBySrcHosts(entries, doHThrottler);
    }

    let bogonFilterer = (_: string) => false; // true for bogon
    if (options.bogonFilteringSpace) {
      bogonFilterer = (ip: string) => {
        const address = parseIPAddress(ip);
        return address ? isBogusIPAddress(address, options.bogonFilteringSpace === 'extendedBogon') : true;
      };
    }
    entries = entries.filter((entry) => !bogonFilterer(entry[3] /* hop IP */));

    const geos = await Promise.all(entries.map(async (entry) => await ip2geo(entry[3] /* hop IP */)));

    const routesAndBounds = await entriesToRoutesAndBounds(_.zip(entries, geos) as Array<[DataEntry, IPGeo]>);
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

  // toggleHostList() {
  //   this.setState((prevState) => {
  //     return { hostListExpanded: !prevState.hostListExpanded };
  //   });
  // }

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
    const hostnameProcessor = this.props.options.simplifyHostname ? simplyHostname : (v: string) => v;

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
                <RoutePath
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
          <HostTray
            expanded={true}
            routes={this.state.routes}
            hiddenHosts={this.state.hiddenHosts}
            itemToggler={this.toggleHostItem}
            palette={palette}
            hostnameProcessor={hostnameProcessor}
          />
        </Control>
        <TopRightControl statusIndicator={this.state.indicator} handleFit={this.handleFit} />
      </LMap>
    );
  }
}

const TopRightControl: React.FC<{ statusIndicator?: 'loading' | 'error'; handleFit: (event: MouseEvent) => void }> = ({
  statusIndicator,
  handleFit,
}) => (
  <Control position="topright">
    {(() => {
      switch (statusIndicator) {
        case undefined:
          return (
            <Button variant="primary" size="md" onClick={handleFit} title="Fit the map view to all points">
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
);
