import React from 'react';
import { Map, TileLayer, FeatureGroup, Marker } from 'react-leaflet'
import { Curve } from '../src'
import { divIcon } from 'leaflet'

//quadratic bezier curve
const pathOne = ['M', [50.14874640066278, 14.106445312500002],
  'Q', [51.67255514839676, 16.303710937500004],
  [50.14874640066278, 18.676757812500004],
  'T', [49.866316729538674, 25.0927734375]]

//cubic bezier curve (and straight lines)
const pathTwo = ['M', [50.54136296522163, 28.520507812500004],
  'C', [52.214338608258224, 28.564453125000004],
  [48.45835188280866, 33.57421875000001],
  [50.680797145321655, 33.83789062500001],
  'V', [48.40003249610685],
  'L', [47.45839225859763, 31.201171875],
  [48.40003249610685, 28.564453125000004], 'Z',
  'M', [49.55372551347579, 29.465332031250004],
  'V', [48.7822260446217],
  'H', [33.00292968750001],
  'V', [49.55372551347579], 'Z']

const pathThree = ['M', [49.35375571830993, 6.240234375],
  'Q', [49.38237278700955, 9.843750000000002],
  [47.754097979680026, 9.360351562500002],
  [46.95026224218562, 6.635742187500001],
  [45.67548217560647, 8.437500000000002],
  [44.5278427984555, 5.5810546875],
  [45.85941212790755, 3.0761718750000004],
  [47.517200697839414, 4.218750000000001],
  [49.009050809382074, 3.7353515625000004],
  [48.45835188280866, 5.800781250000001],
  [48.8936153614802, 5.493164062500001], 'Z']

const pathFour = ['M', [46.86019101567027, -29.047851562500004],
  'Q', [50.48547354578499, -23.818359375000004],
  [46.70973594407157, -19.907226562500004],
  'T', [46.6795944656402, -11.0302734375]]

export default class CurveExample extends React.Component {
  constructor() {
    super();
    this.state = {
      latngs: []
    }
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(props) {
    let route;
    route = pathOne
    this.setState({ latngs: route });
  }

  render() {
    const icon = divIcon({ className: 'divicon' });
    let curve = this.state.latngs.length > 0 ? <Curve positions={this.state.latngs} option={{ animate: 3000 }} /> : null
    return ( 
      <Map center={[45.616037,15.951813]} zoom={4} zoomControl={true}>
        <TileLayer
          url='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          attribution='&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Curve positions={pathTwo} option={{color:'red',fill:true}}/>
        <Curve positions={pathThree} option={{fill:true, color:'orange'}} />
        <Curve positions={pathFour} option={{dashArray: 5, animate: {duration: 3000, iterations: Infinity}}}/>
        {curve}
        <FeatureGroup onClick={this.handleClick}>
          <Marker position={[50.14874640066278, 14.106445312500002]} icon={icon} /></FeatureGroup>
        <Marker position={[49.866316729538674, 25.0927734375]} icon={icon}>
        </Marker>
      </Map>
    )
  }
}
