import React, { Component, createRef, MouseEvent } from 'react';
import { PanelProps, LoadingState } from '@grafana/data';
import { Icon, Button } from '@grafana/ui'
// import { colors } from '@grafana/ui';
// import ipAddress from 'ip-address';
// import { keys } from 'ts-transformer-keys';
import _ from 'lodash';
import { Map as LMap, Marker, Popup, TileLayer, Control, LatLngBounds, MarkerClusterGroup, Polyline, LatLngTuple, latLngBounds } from './react-leaflet-compat';

import { SimpleOptions } from './types';
import { ip2geo } from './geoip';
import { rainbowPalette, round, HiddenHosts } from './utils'
// import { Polyline } from 'leaflet';
import 'panel.css';


interface Props extends PanelProps<SimpleOptions> { }

interface State {
  data: Map<string, PathPoint[]>;
  series: any;
  mapBounds: Map<string, LatLngBounds>;
  hiddenHosts: Set<string>;
}

// interface Hop {
//   hop: number;
//   ip: string;
//   rtt: number;
//   loss: number;
//   geo: IPGeo;
// }

interface PathPoint {
  lat: number;
  lon: number;
  region: string;
  hops: {
    nth: number;
    ip: string;
    net: string;
    rtt: number;
    loss: number;
  }[]
}

// interface QueryEntry {
//   dest: string;
//   host: string;
//   hop: number;
//   ip: string;
//   rtt: number;
//   loss: number;
// }

export class SimplePanel extends Component<Props, State> {
  mapRef = createRef<any>()

  constructor(props: Props) {
    super(props);
    this.state = {
      data: new Map(),
      series: null,
      mapBounds: new Map(),
      hiddenHosts: HiddenHosts.load()
    };
    this.processData();
    this.handleFit = this.handleFit.bind(this);
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.width != this.props.width || prevProps.height != this.props.height) {
      // console.log(this.mapRef.current);
      // https://github.com/PaulLeCam/react-leaflet/issues/340#issuecomment-527939630
      this.mapRef.current.leafletElement.invalidateSize()
    }
    console.log(this.props.data);
    if (this.props.data.series !== this.state.series && this.props.data.state === LoadingState.Done) {
      this.processData();
    }
  }

  async processData(): Promise<void> {
    const series = this.props.data.series;
    if (series.length !== 1 || series[0].fields.length !== 7) {
      console.log(series);
      console.log('No query data or not formatted as table.');
      return;
    }
    let fields: any = {};
    // keys<QueryEntry>()
    ['host', 'dest', 'hop', 'ip', 'rtt', 'loss'].forEach(item => (fields[item] = null));
    for (const field of series[0].fields) {
      if (fields.hasOwnProperty(field.name)) {
        fields[field.name] = field.values.toArray();
      } else {
        console.log('Ignoring field: ' + field.name);
      }
    }
    if (Object.values(fields).includes(null)) {
      console.log('Invalid query data');
      return;
    }
    let entries = _.zip(fields.host, fields.dest, fields.hop, fields.ip, fields.rtt, fields.loss) as [string, string, string, string, string, string][];
    entries.sort((a, b) => parseInt(a[2]) - parseInt(b[2]));
    console.log(entries);
    let data: Map<string, Map<string, PathPoint>> = new Map();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const key = `${entry[0]}|${entry[1]}`;
      console.log(key);
      const hop = parseInt(entry[2], 10),
        ip = entry[3] as string,
        rtt = parseFloat(entry[4]),
        loss = parseFloat(entry[5]),
        { region, net, lat, lon, bogon } = await ip2geo(ip);
      if (bogon) {
        continue;
      }
      let group = data.get(key);
      if (group === undefined) {
        group = new Map();
        data.set(key, group);
      }
      const point_id = `${round(lat, 1)},${round(lon, 1)}`;
      let point = group.get(point_id);
      if (point === undefined) {
        point = { lat, lon: (lon + 360) % 360, region, hops: [] };
        group.set(point_id, point);
      }
      point.hops.push({ nth: hop, ip, net, rtt, loss });

      // latLons.push([lat, (lon + 360) % 360]);
    }

    let mapBounds: Map<string, LatLngBounds> = new Map();
    for (const [key, points] of Array.from(data.entries())) {
      mapBounds.set(key, latLngBounds(Array.from(points.values()).map(point => [point.lat, point.lon])));
    }
    console.log(mapBounds);
    console.log(data);
    this.setState({
      data: new Map(Array.from(data.entries()).map(([key, value]) => [key, Array.from(value.values())])),
      series,
      mapBounds
    });
  }

  toggleHostItem(item: string) {
    // event.currentTarget.
    this.setState({ hiddenHosts: HiddenHosts.toggle(item) });
    console.log(HiddenHosts.load());
  }

  handleFit(event: MouseEvent) {
    this.mapRef.current.leafletElement.fitBounds(this.getEffectiveBounds());
  }

  getEffectiveBounds() {
    return Array.from(this.state.mapBounds.entries()).filter(([key, _value]) => !this.state.hiddenHosts.has(key)).map(([_key, value]) => value).reduce((prev: LatLngBounds | undefined, curr) => prev?.pad(0)?.extend(curr) ?? curr, undefined);
  }

  render() {
    const { /*options,*/ width, height } = this.props;
    const data = this.state.data;
    console.log("rendering", width, height);
    console.log(this.state.mapBounds);
    let palette = rainbowPalette(data.size, 0.618);
    console.log("TTTTTTTTT");
    console.log(this.state.hiddenHosts, this.state.mapBounds.entries(), Array.from(this.state.mapBounds.entries()).filter(([key, _value]) => !this.state.hiddenHosts.has(key)));
    const effectiveBounds = this.getEffectiveBounds();
    console.log("effetive bounds", effectiveBounds);
    // data.series
    // > select hop, ip, avg, loss from (select mean(avg) as avg, mean(loss) as loss from mtr group by hop, ip)
    return (
      <LMap key={this.state.series} ref={this.mapRef} center={[51.505, -0.09]} zoom={1} style={{ position: "relative", height, width }} bounds={effectiveBounds} options={{ zoomSnap: 0.5, zoomDelta: 0.5 }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        <MarkerClusterGroup maxClusterRadius={15} /*options={{ singleMarkerMode: true }}*/>
          {
            Array.from(data.entries()).map(([key, points]) => {
              const [host, dest] = key.split("|");
              return (
                <TraceRouteMarkers key={key} dest={dest} host={host} points={points} color={palette()} visible={!this.state.hiddenHosts.has(key)}></TraceRouteMarkers>
              )
            })
          }
        </MarkerClusterGroup>
        {/* <Marker position={[51.505, -0.09]}>
          <Popup>
            A pretty CSS3 popup.
            <br />
            Easily customizable.
          </Popup>
        </Marker> */}
        <Control position="bottomleft">
          <ul className="host-list">
            {
              Array.from(data.entries()).map(([key, points]) => {
                const [host, dest] = key.split("|");
                const color = palette();
                return (
                  <li className="host-item" onClick={() => this.toggleHostItem(key)}>
                    <span className="host-label">
                      {host}
                    </span>
                    <span className="host-arrow" style={{ color: this.state.hiddenHosts.has(key) ? "grey" : color }}>
                      <Icon name="arrow-right"></Icon>
                    </span>
                    <span className="dest-label">
                      {dest}
                    </span>
                  </li>
                )
              })
            }
          </ul>
        </Control>
        <Control position="topright">
          <Button variant="primary" size="md" onClick={this.handleFit}>
            {/* FIX: @grafana/ui Button keeps active state */}
            Fit
          </Button>
        </Control>
      </LMap >
    );
  }
}


const TraceRouteMarkers: React.FC<{ host: string, dest: string, points: PathPoint[], color: string, visible: boolean }> = ({ host, dest, points, color, visible }) => {
  console.log(points);
  return visible ?
    (
      <div data-host={host} data-dest={dest} data-points={points.length}>
        {
          points.map(point =>
            <Marker key={point.region} position={[point.lat, point.lon]} className="point-marker">
              <Popup className="point-popup">
                <span className="point-label">{point.region}</span>
                <hr />
                <ul className="hop-list">
                  {
                    point.hops.map(
                      hop =>
                        <li className="hop-item">
                          <span className="hop-nth">{hop.nth}</span> <span className="hop-label" title={`${hop.ip} RTT:${hop.rtt} Loss:${hop.loss}`}>{hop.net}</span>
                        </li>
                    )
                  }
                </ul>
                <hr />
                <span className="host-label">
                  {host}
                </span>
                <span className="arrow">
                  &nbsp; ➡️ &nbsp;
              </span>
                <span className="dest-label">
                  {dest}
                </span>
              </Popup>
            </Marker>
          )
        }
        <Polyline positions={points.map(point => [point.lat, (point.lon + 360) % 360] as LatLngTuple)} color={color}>
        </Polyline>
      </div>
    )
    : (<></>);
};
