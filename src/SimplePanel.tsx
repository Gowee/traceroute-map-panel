import React, { Component, createRef } from 'react';
import { PanelProps, LoadingState } from '@grafana/data';
// import { colors } from '@grafana/ui';
// import ipAddress from 'ip-address';
// import { keys } from 'ts-transformer-keys';
import _ from 'lodash';
import { Map as LMap, Marker, Popup, TileLayer, LatLngBounds, MarkerClusterGroup, Polyline, LatLngTuple, latLngBounds } from './react-leaflet-compat';

import { SimpleOptions } from './types';
import { ip2geo } from './geoip';
import { rainbow, round } from './utils'
// import { Polyline } from 'leaflet';
// import 'panel.css';


interface Props extends PanelProps<SimpleOptions> { }

interface State {
  data: Map<string, PathPoint[]>;
  series: any;
  mapBounds: LatLngBounds | undefined;
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
      mapBounds: undefined
    };
    this.processData();
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
    let latLons: LatLngTuple[] = [];
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
      latLons.push([lat, (lon + 360) % 360]);
    }
    console.log("latlons", latLons);
    const mapBounds = latLngBounds(latLons).pad(1);

    console.log(data);
    this.setState({
      data: new Map(Array.from(data.entries()).map(([key, value]) => [key, Array.from(value.values())])),
      series,
      mapBounds
    });
  }

  render() {
    const { /*options,*/ width, height } = this.props;
    const data = this.state.data;
    console.log("rendering", width, height);
    console.log(this.state.mapBounds);
    let nth = -1;
    // data.series
    // > select hop, ip, avg, loss from (select mean(avg) as avg, mean(loss) as loss from mtr group by hop, ip)
    // ***REMOVED***
    return (
      <LMap key={this.state.series} ref={this.mapRef} center={[51.505, -0.09]} zoom={1} style={{ position: "relative", height, width }} bounds={this.state.mapBounds}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        <MarkerClusterGroup maxClusterRadius={15} /*options={{ singleMarkerMode: true }}*/>
          {
            Array.from(data.entries()).map(([key, points]) => {
              nth += 1;
              const [host, dest] = key.split("|");
              return (
                <TraceRouteMarkers key={key} dest={dest} host={host} points={points} nth={nth} total={data.size}></TraceRouteMarkers>
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
      </LMap>
    );
  }
}


const TraceRouteMarkers: React.FC<{ host: string, dest: string, points: PathPoint[], nth: number, total: number }> = ({ host, dest, points, nth, total }) => {
  console.log(points);
  return (
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
                      <li className="hop">
                        <span className="hop-nth">{hop.nth}</span> <span className="hop-label" title={`${hop.ip} RTT:${hop.rtt} Loss:${hop.loss}`}>{hop.net}</span>
                      </li>
                  )
                }
              </ul>
              <hr />
              <span className="host-label">
                {host}
              </span>
                &nbsp; ➡️ &nbsp;
                <span className="dest-label">
                {dest}
              </span>
            </Popup>
          </Marker>
        )
      }
      <Polyline positions={points.map(point => [point.lat, (point.lon + 360) % 360] as LatLngTuple)} color={rainbow(total, nth, 0.618)}>

      </Polyline>
    </div>
  )
};