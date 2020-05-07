import React, { Component, createRef } from 'react';
import { PanelProps, LoadingState } from '@grafana/data';
// import { colors } from '@grafana/ui';
// import ipAddress from 'ip-address';
// import { keys } from 'ts-transformer-keys';
import _ from 'lodash';
import { Map as LMap, Marker, Popup, TileLayer, LatLngBounds, MarkerClusterGroup, Polyline, LatLngTuple } from './react-leaflet-compat';

import { SimpleOptions } from './types';
import { IPGeo, ip2geo } from './geoip';
import rainbow from './color'
// import { Polyline } from 'leaflet';
// import 'panel.css';


interface Props extends PanelProps<SimpleOptions> { }

interface State {
  data: Map<string, Hop[]>;
  series: any;
  mapBounds: LatLngBounds | undefined;
}

interface Hop {
  hop: number;
  ip: string;
  rtt: number;
  loss: number;
  geo: IPGeo;
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
    console.log(fields);
    if (Object.values(fields).includes(null)) {
      console.log('Invalid query data');
      return;
    }
    let data: Map<string, Hop[]> = new Map();
    let latLons = [];
    for (let i = 0; i < fields.host.length; i++) {
      const key = `${fields.host[i]}|${fields.dest[i]}`;
      console.log(key);
      const entry = {
        hop: parseInt(fields.hop[i], 10),
        ip: fields.ip[i] as string,
        rtt: parseFloat(fields.rtt[i]),
        loss: parseFloat(fields.loss[i]),
        geo: await ip2geo(fields.ip[i])
      };
      let group = data.get(key);
      if (group === undefined) {
        group = [];
        data.set(key, group);
      }
      group.push(entry);
      latLons.push([entry.geo.lat, entry.geo.lon]);
    }
    const mapBounds = this.mapRef.current.leafletElement.getBounds(latLons);

    console.log(data);
    this.setState({
      data,
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
        <MarkerClusterGroup options={{ singleMarkerMode: true }}>
          {
            Array.from(data.entries()).map(([key, hops]) => {
              nth += 1;
              const [host, dest] = key.split("|");
              return (
                <TraceRouteMarkers key={key} dest={dest} host={host} hops={hops} nth={nth} total={data.size}></TraceRouteMarkers>
              )
            })
          }
        </MarkerClusterGroup>
        {/* <TraceRouteMarkers key={this.state.series} dest="B" host="A" hops={dd}>

        </TraceRouteMarkers> */}
        <Marker position={[51.505, -0.09]}>
          <Popup>
            A pretty CSS3 popup.
            <br />
            Easily customizable.
          </Popup>
        </Marker>
      </LMap>
    );
  }
}


const TraceRouteMarkers: React.FC<{ host: string, dest: string, hops: Hop[], nth: number, total: number }> = ({ host, dest, hops, nth, total }) => {
  console.log(hops);
  return (
    <div data-host={host} data-dest={dest} data-hops={hops.length}>
      {
        hops.map((hop) =>
          <Marker key={hop.hop} position={[hop.geo.lat, hop.geo.lon]} className="hop-marker">
            <Popup className="hop-popup">
              <span className="hop-nth">{hop.hop}</span> <span className="hop-label">{hop.geo.region}</span>
            </Popup>
          </Marker>
        )
      }
      <Polyline positions={hops.map(hop => [hop.geo.lat, hop.geo.lon] as LatLngTuple)} color={rainbow(nth, total)}>

      </Polyline>
    </div>
  )
};