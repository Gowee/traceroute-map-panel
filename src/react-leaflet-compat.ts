// // react-leaflet-curve NEEDS to be imported before leaflet/react-leaflet! As L.{Curve/curve} will
// // be polluted by the internal vendorized (outdated?) implementation of react-leaflet-curve,
// // resulting error in AntPath.
// import { Curve as CurveWithoutLeaflet } from 'react-leaflet-curve';
// import { withLeaflet } from 'react-leaflet';
// // Curve needs manually wrapping for now: https://github.com/Shadowman4205/react-leaflet-curve/issues/4
// const Curve = withLeaflet(CurveWithoutLeaflet) as any;

// https://github.com/PaulLeCam/react-leaflet/issues/453
// https://github.com/ghybs/leaflet-defaulticon-compatibility
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'; // Re-uses images from ~leaflet package
export * from 'react-leaflet';
import 'leaflet-defaulticon-compatibility';
import { LatLngBounds, LatLngTuple, latLngBounds } from 'leaflet';
import 'react-leaflet-markercluster/dist/styles.min.css';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import Control from 'react-leaflet-control';

import L from 'leaflet';
import '@elfalem/leaflet-curve';
const Lcurve = L.curve;

import Curve from 'react-leaflet-curve';
// export const LCurve = (...args: any[]) => new LBigCurve(...args);
// L.Curve = undefined as any;
// L.curve = undefined as any;
// // console.log(L.curve);

// console.log(L.curve);
// L.curve = undefined as any;

export { Curve, Lcurve, MarkerClusterGroup, Control, LatLngBounds, LatLngTuple, latLngBounds };
// import 'leaflet-polylinedecorator';
// import Leaflet, {Polyline, } from 'leaflet';
// const polylineDecorator = (Leaflet as any).polylineDecorator;
// export { polylineDecorator };
