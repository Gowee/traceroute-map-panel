import React, { Component, createRef } from 'react';
import { PanelProps, LoadingState } from '@grafana/data';
// import ipAddress from 'ip-address';
// import { keys } from 'ts-transformer-keys';
import _ from 'lodash';
import { Map as LeafletMap, Marker, Popup, TileLayer } from './react-leaflet-compat';
import { SimpleOptions } from 'types';
// import 'panel.css';

interface Props extends PanelProps<SimpleOptions> { }

interface State {
  data: Map<string, TraceRoute[]>;
  series: any;
}

interface TraceRoute {
  hop: number;
  ip: string;
  rtt: number;
  loss: number;
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
    };
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

  processData(): void {
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
    // for (const s)
    // TODO: more idiomatic?
    // for (const field of series[0].fields) {
    //   switch (field.name) {
    //     case "Time":
    //       break;
    //     case "host":
    //       hosts = field.values;
    //       break;
    //     case "dest":
    //       dests = field.values;
    //       break;
    //     case "hop":
    //       hops = field.values;
    //       break;
    //     case "ip":
    //       ips = field.values;
    //       break;
    //     case "rtt":
    //       rtts = field.values;
    //       break;
    //     case "loss":
    //       losses = field.values;
    //       break;
    //     default:
    //       console.log(`Unknown field: ${field.name}`);
    //   }
    // }
    // if ([hosts, dests, hops, ips, rtts, losses].includes(undefined)) {
    //   console.log("Some a field is missing.");
    //   return;
    // }
    // const fields = raw_fields as Map<string, Vector<any>>;
    let data: Map<string, TraceRoute[]> = new Map();
    for (let i = 0; i < fields.host.length; i++) {
      const key = `${fields.host[i]}|${fields.dest[i]}`;
      console.log(key);
      const entry = {
        hop: parseInt(fields.hop[i], 10),
        ip: fields.ip[i] as string,
        rtt: parseFloat(fields.rtt[i]),
        loss: parseFloat(fields.loss[i]),
      };
      let group = data.get(key);
      if (group === undefined) {
        group = [];
        data.set(key, group);
      }
      group.push(entry);
    }
    console.log(data);
    this.setState({
      data,
      series,
    });
  }

  render() {
    const { /*options,*/ width, height } = this.props;
    // const data = this.state.data;
    console.log("rendering", width, height);
    // console.log(data.state);
    // data.series
    // > select hop, ip, avg, loss from (select mean(avg) as avg, mean(loss) as loss from mtr group by hop, ip)
    return (
      <LeafletMap ref={this.mapRef} center={[51.505, -0.09]} zoom={13} style={{ position: "relative", height, width }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={[51.505, -0.09]}>
          <Popup>
            A pretty CSS3 popup.
            <br />
            Easily customizable.
          </Popup>
        </Marker>
      </LeafletMap>
    );
  }
}
