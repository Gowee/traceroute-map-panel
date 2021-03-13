/* eslint-disable react/jsx-no-target-blank */

import React, { Component, createRef, MouseEvent } from 'react';
import { PanelProps, LoadingState, DataFrame } from '@grafana/data';
import { Icon, Button, Tooltip, Spinner, Alert, IconName } from '@grafana/ui';
// import { keys } from 'ts-transformer-keys';
import _ from 'lodash';
import {
  Map as RLMap,
  TileLayer,
  Control,
  MarkerClusterGroup,
  LatLngTuple,
  latLngBounds,
  LatLngBounds,
  Polyline,
} from './react-leaflet-compat';

import {
  UserFriendlyError,
  NoDataError,
  InformationalError,
  getIconFromSeverity,
  // TimerangeOverflowError,
} from './errors';
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
  seriesToEntries,
  entriesToRoutes,
  prependZerothHopsBySrcHosts,
  routesToBounds,
} from './data';
import HostTray from './components/HostTray';
import RoutePath from './components/RoutePath';
import PointPopup, { GenericPointPopupProps } from 'components/PointPopup';
import { AntSpline, SimpleSpline, GenericPathLineProps } from 'components/line';
import { pathToBezierSpline3, pathToBezierSpline2 } from 'spline';

interface Props extends PanelProps<TracerouteMapOptions> {}

type Indicator = 'loading' | UserFriendlyError | Error;

interface State {
  routes: Map<string, RoutePoint[]>;
  series: any;
  mapBounds: Map<string, LatLngTuple[]>;
  hiddenHosts: Set<string>;
  hostListExpanded: boolean;
  indicator?: Indicator;
}

export class TracerouteMapPanel extends Component<Props, State> {
  mapRef = createRef<any>();
  hiddenHostsStorage: HiddenHostsStorage;
  // ip2geo: (ip: string) => Promise<IPGeo>;

  constructor(props: Props) {
    super(props);
    // TODO: When a panel is edited, a ephemeral panel is created by copying the original one, with
    //       different ID, in the "Edit Panel" page.
    //       It results in inconsistent hidden host items selected when the panel switches back.
    //       It seems no No feasible fix for now.
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
    this.updateData(true);
    this.handleFit = this.handleFit.bind(this);
    this.wrapCoord = this.wrapCoord.bind(this);
    this.toggleHostItem = this.toggleHostItem.bind(this);
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
    } else if (
      /* prevProps.options.pathSpline !== this.props.options.pathSpline || */
      prevProps.options.longitudeWrapping !== this.props.options.longitudeWrapping
    ) {
      this.setState({ mapBounds: this.routesToBounds(this.state.routes) });
    }
  }

  async updateData(initial = false): Promise<void> {
    initial || this.setState({ indicator: 'loading', series: this.props.data.series });
    try {
      // this.checkTimeRange();
      const { routes, mapBounds } = await this.processData(this.props.data.series);
      this.setState({ indicator: undefined, routes, mapBounds });
    } catch (error) {
      if (error instanceof InformationalError) {
        console.log(error);
        this.setState({ indicator: error, routes: new Map(), mapBounds: new Map() });
      } else {
        if (error instanceof UserFriendlyError && error.cause !== undefined) {
          console.error(error.cause);
        } else {
          console.error(error);
        }
        // TODO: whether to clear data or not?
        this.setState({ indicator: error });
      }
    }
  }

  async processData(
    series: DataFrame[]
  ): Promise<{ routes: Map<string, RoutePoint[]>; mapBounds: Map<string, LatLngTuple[]> }> {
    let entries = seriesToEntries(series);
    if (entries.length === 0) {
      // Multiple series indicate multiple querys. series.length has nothing to do with entries.length.
      throw new NoDataError('No query or query is empty');
    }
    const options = this.props.options;

    const geoIPThrottler = options.parallelizeGeoIP
      ? makeThrottler<string, unknown[], IPGeo>(options.concurrentRequests, options.requestsPerSecond)
      : undefined;
    const ip2geo = IP2Geo.fromProvider(options.geoIPProviders[options.geoIPProviders.active], geoIPThrottler);
    // TODO: sychronize throttler among multiple panels

    if (options.srcHostAsZerothHop) {
      // No option of parallelization for DoH resolution so far. Just hardcode for now.
      const doHThrottler = makeThrottler<string, unknown[], string | null>(10, 100);
      entries = await prependZerothHopsBySrcHosts(entries, doHThrottler);
    }

    let bogonFilterer = (_: string) => false; // true for bogon
    if (options.bogonFilteringSpace !== 'none') {
      bogonFilterer = (ip: string) => {
        const address = parseIPAddress(ip);
        return address ? isBogusIPAddress(address, options.bogonFilteringSpace === 'extendedBogon') : true;
      };
    }
    entries = entries.filter((entry) => !bogonFilterer(entry[3] /* hop IP */));
    // TODO: even though all entries are filtered out for a route, it should still be in host tray.

    const geos = await Promise.all(entries.map(async (entry) => await ip2geo(entry[3] /* hop IP */)));

    const routes = await entriesToRoutes(_.zip(entries, geos) as Array<[DataEntry, IPGeo]>);
    const mapBounds = this.routesToBounds(routes);
    return { routes, mapBounds };
  }

  routesToBounds(routes: Map<string, RoutePoint[]>): Map<string, LatLngTuple[]> {
    let pathProcesser = undefined;
    // if (this.props.options.pathSpline === 'animatedSpline') {
    //   pathProcesser = pathToBezierSplinePath2;
    // } // TODO: calculate mapbounds for spline
    let coordProcessor = undefined;
    if (this.props.options.longitudeWrapping !== undefined) {
      coordProcessor = this.wrapCoord;
    }
    return routesToBounds(routes, pathProcesser, coordProcessor);
  }

  // This time range is not the time range manually specified in query. So it does not make much sense.
  //   checkTimeRange() {
  //     const { from, to } = this.props.data.timeRange;
  //     if (to.diff(from) > 1 * 60 * 60 * 1000) {
  //       throw new TimerangeOverflowError(`Long time range usually implies a problem in query.
  // By default, the panel prevents loading data with time ranging over 1 hour.
  // This limit can be disabled in options.`);
  //     }
  //   }

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
      .flatMap(([_key, tuples]) => tuples);
    // Wrapping longitude over bounds instead of all points is incorrect.
    // So now bounds for wrapped coords are pre-calculated per option settings.
    // .map((tuple) => this.wrapCoord(tuple));
    return tuples.length ? latLngBounds(tuples) : undefined;
  }

  wrapCoord(coord: LatLngTuple): LatLngTuple {
    let [lat, lon] = coord;
    if (this.props.options.longitudeWrapping) {
      if (this.props.options.longitudeWrapping === 'primeMeridian') {
        lon = (lon + 360) % 360;
      } else {
        // antimeridian
        // ref: https://gis.stackexchange.com/a/303362/178627
        lon = (((lon % 360) + 540) % 360) - 180;
      }
    }
    return [lat, lon];
  }

  getPathLine(): React.ComponentType<GenericPathLineProps> {
    if (this.props.options.pathSpline === 'spline2' || this.props.options.pathSpline === 'spline1') {
      const splineFn = this.props.options.pathSpline === 'spline2' ? pathToBezierSpline2 : pathToBezierSpline3;
      switch (this.props.options.pathLineStyle) {
        case 'dashed':
          // Compensate to fix the implementation problem of Curve
          const zoomFix = Math.pow(2, this.mapRef?.current?.leafletElement?.getZoom() ?? 0);
          return (props: GenericPathLineProps) => (
            <SimpleSpline
              splineFn={splineFn}
              animated={true}
              speedFactor={this.props.options.pathAnimationSpeedFactor / zoomFix}
              {...props}
            />
          );
        case 'antPath':
          return (props: GenericPathLineProps) => (
            <AntSpline splineFn={splineFn} speedFactor={this.props.options.pathAnimationSpeedFactor} {...props} />
          );
        case 'solid':
        default:
          // A default catch is useful for panel upgration where value type might change
          return (props: GenericPathLineProps) => <SimpleSpline splineFn={splineFn} {...props} />;
      }
    } else {
      return Polyline as any;
    }
  }

  render() {
    const { width, height, options } = this.props;
    const routes = this.state.routes;
    let palette = rainbowPalette(routes.size, 0.618);
    const effectiveBounds = this.getEffectiveBounds();
    const hostnameProcessor = this.props.options.simplifyHostname ? simplyHostname : (v: string) => v;

    const Popup = (props: GenericPointPopupProps) => (
      <PointPopup {...props} hopLabel={options.hopLabelType} showSearchIcon={options.showSearchIconInHopLabel} />
    );
    const PathLine = this.getPathLine();
    const MarkersWrapper: typeof MarkerClusterGroup =
      options.mapClusterRadius > 0 ? MarkerClusterGroup : (React.Fragment as any);

    return (
      <RLMap
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

        <MarkersWrapper maxClusterRadius={options.mapClusterRadius}>
          {Array.from(routes.entries()).map(([key, points]) => {
            const [host, dest] = key.split('|');
            const color = palette(); // The palette has side effect. Call it even though a item is hidden;
            return (
              !this.state.hiddenHosts.has(key) && (
                <RoutePath
                  key={key}
                  dest={dest}
                  host={host}
                  points={points}
                  color={color}
                  Popup={Popup}
                  PathLine={PathLine}
                  coordWrapper={this.wrapCoord}
                />
              )
            );
          })}
        </MarkersWrapper>
        {/* {effectiveBounds && (
          <Polyline positions={[effectiveBounds.getNorthEast() as any, effectiveBounds.getSouthWest() as any]} />
        )} */}
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
        <Control position="topright">
          {this.state.indicator === undefined ? (
            <FunctionButtons handleFit={this.handleFit} />
          ) : (
            <StatusIndicator status={this.state.indicator} />
          )}
        </Control>
      </RLMap>
    );
  }
}

const FunctionButtons: React.FC<{ handleFit: (event: MouseEvent) => void }> = ({ handleFit }) => (
  <Button variant="primary" size="md" onClick={handleFit} title="Fit the map view to all points">
    {/* FIX: @grafana/ui Button keeps active state */}
    Fit
  </Button>
);

const StatusIndicator: React.FC<{ status: Indicator }> = ({ status }) => {
  if (status === 'loading') {
    return (
      <Tooltip content="It may take a while to load, mainly due to Geo IP resolution" theme="info">
        <span className="map-indicator loading">
          {/* <Spinner /> */}
          <i className="fa fa-spinner fa-spin" />
          Loading
        </span>
      </Tooltip>
    );
  } else if (status instanceof UserFriendlyError) {
    const message = status.shortMessage;
    const description = status.message;
    const severity = status.severity ?? 'error';
    const tooltipTheme = severity === 'error' ? 'error' : 'info';
    const iconName = getIconFromSeverity(severity) as IconName;
    return (
      <Tooltip content={description} theme={tooltipTheme}>
        <span className={`map-indicator ${severity}`}>
          <Icon name={iconName} />
          {message}
        </span>
      </Tooltip>
    );
  } else {
    let message = 'The error has been logged in the Debugging Console';
    if (status.toString()) {
      message += ': \t' + status.toString();
    }
    return (
      <Tooltip content={message} theme="error">
        <span className="map-indicator error" title="">
          <i className="fa fa-warning" />
          Error processing data
        </span>
      </Tooltip>
    );
  }
};
