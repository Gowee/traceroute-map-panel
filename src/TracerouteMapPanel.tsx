import React, { Component, createRef, MouseEvent } from 'react';
import { PanelProps, LoadingState } from '@grafana/data';
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
import { rainbowPalette, round, HiddenHostsStorage } from './utils';
import 'panel.css';

interface Props extends PanelProps<TracerouteMapOptions> { }

interface State {
  data: Map<string, PathPoint[]>;
  series: any;
  mapBounds: Map<string, LatLngTuple[]>;
  hiddenHosts: Set<string>;
  hostListExpanded: boolean;
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
    this.processData();
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
      this.processData();
    }
  }

  async processData(): Promise<void> {
    const series = this.props.data.series;
    if (series.length !== 1 || series[0].fields.length !== 7) {
      console.log('No query data or not formatted as table.');
      return;
    }
    let fields: any = {};
    ['host', 'dest', 'hop', 'ip', 'rtt', 'loss'].forEach(item => (fields[item] = null));
    for (const field of series[0].fields) {
      if (fields.hasOwnProperty(field.name)) {
        fields[field.name] = field.values.toArray();
      } /* else {
        console.log('Ignoring field: ' + field.name);
      } */
    }
    if (Object.values(fields).includes(null)) {
      console.log('Invalid query data');
      return;
    }
    let entries = _.zip(fields.host, fields.dest, fields.hop, fields.ip, fields.rtt, fields.loss) as Array<
      [string, string, string, string, string, string]
    >;
    entries.sort((a, b) => parseInt(a[2], 10) - parseInt(b[2], 10));
    let data: Map<string, Map<string, PathPoint>> = new Map();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const key = `${entry[0]}|${entry[1]}`;
      // TODO: parallelize & throttle ip2geo request 
      const hop = parseInt(entry[2], 10),
        ip = entry[3] as string,
        rtt = parseFloat(entry[4]),
        loss = parseFloat(entry[5]),
        { region, label, lat: lat_, lon: lon_ } = await this.ip2geo(ip);
      if (typeof lat_ !== 'number' || typeof lon_ !== 'number') {
        // implying invalid or LAN IP
        continue;
      }
      // TODO: shadowing?
      const lat = lat_ ?? 0,
        lon = lon_ ?? 0;
      let group = data.get(key);
      if (group === undefined) {
        group = new Map();
        data.set(key, group);
      }
      const point_id = `${round(lat, 1)},${round(lon, 1)}`;
      let point = group.get(point_id);
      if (point === undefined) {
        point = { lat, lon, region: region ?? 'unknown region', hops: [] };
        group.set(point_id, point);
      }
      point.hops.push({ nth: hop, ip, label: label ?? 'unknown network', rtt, loss });

      // latLons.push([lat, (lon + 360) % 360]);
    }
    let mapBounds: Map<string, LatLngTuple[]> = new Map();
    for (const [key, points] of Array.from(data.entries())) {
      const bound = latLngBounds(Array.from(points.values()).map(point => [point.lat, point.lon]));
      mapBounds.set(key, [[bound.getSouth(), bound.getWest()], [bound.getNorth(), bound.getEast()]]);
    }
    // debugger;
    this.setState({
      data: new Map(Array.from(data.entries()).map(([key, value]) => [key, Array.from(value.values())])),
      series,
      mapBounds,
    });

    // TODO: use catersian product to handle non-linear route paths
  }

  toggleHostItem(item: string) {
    this.setState({ hiddenHosts: this.hiddenHostsStorage.toggle(item) });
  }

  handleFit(event: MouseEvent) {
    this.mapRef.current.leafletElement.fitBounds(this.getEffectiveBounds());
  }

  getEffectiveBounds(): LatLngBounds | undefined {
    const tuples = Array.from(this.state.mapBounds.entries())
    .filter(([key, _value]) => !this.state.hiddenHosts.has(key))
    .flatMap(([_key, tuples]) => tuples)
    .map(tuple => this.wrapCoord(tuple));
    return tuples.length ? latLngBounds(tuples) : undefined;
  }

  toggleHostList() {
    this.setState(prevState => {
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
    // console.log('Map effetive bounds', effectiveBounds);
    return (
      <LMap
        key={this.state.series}
        ref={this.mapRef}
        center={[51.505, -0.09]}
        zoom={1}
        style={{ position: 'relative', height, width }}
        bounds={effectiveBounds}
        options={{ zoomSnap: 0.5, zoomDelta: 0.5 }}
      >
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
              <span className="host-list-toggler host-list-collapse" onClick={() => this.toggleHostList()}>
                <Icon name="compress"></Icon>
              </span>
              <ul className="host-list">
                {Array.from(data.entries()).map(([key, points]) => {
                  const [host, dest] = key.split('|');
                  const color = palette();
                  return (
                    <li className="host-item" onClick={() => this.toggleHostItem(key)}>
                      <span className="host-label">{host}</span>
                      <span className="host-arrow" style={{ color: this.state.hiddenHosts.has(key) ? 'grey' : color }}>
                        <Icon name="arrow-right"></Icon>
                      </span>
                      <span className="dest-label">{dest}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
              <span className="host-list-toggler host-list-expand" onClick={() => this.toggleHostList()}>
                <Icon name="expand"></Icon>
              </span>
            )}
        </Control>
        <Control position="topright">
          <Button variant="primary" size="md" onClick={this.handleFit}>
            {/* FIX: @grafana/ui Button keeps active state */}
            Fit
          </Button>
        </Control>
      </LMap>
    );
  }
}

// Traceroute for one host->dest pair
const TraceRouteMarkers: React.FC<{ host: string; dest: string; points: PathPoint[]; color: string; visible: boolean; wrapCoord?: (coord: LatLngTuple) => LatLngTuple }> = ({
  host,
  dest,
  points,
  color,
  visible,
  wrapCoord
}) => {
  // const wrapCoord = longitude360 ? (lon: number) => (lon + 360) % 360 : (lon: number) => lon;
  let wrapCoord_: (coord: LatLngTuple) => LatLngTuple;
  if (wrapCoord === undefined) {
    wrapCoord_ = (coord: LatLngTuple) => coord;
  }
  else {
    wrapCoord_ = wrapCoord;
  }

  return visible ? (
    <div data-host={host} data-dest={dest} data-points={points.length}>
      {points.map(point => (
        <Marker key={point.region} position={wrapCoord_([point.lat, point.lon])} className="point-marker">
          <Popup className="point-popup">
            <span className="point-label">{point.region}</span>
            <hr />
            <ul className="hop-list">
              {point.hops.map(hop => (
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
            <span className="host-arrow" style={{ color }}>&nbsp; ➡️ &nbsp;</span>
            <span className="dest-label">{dest}</span>
          </Popup>
        </Marker>
      ))}
      <Polyline positions={points.map(point => wrapCoord_([point.lat, point.lon]) as LatLngTuple)} color={color}></Polyline>
    </div>
  ) : (
      <></>
    );
};
