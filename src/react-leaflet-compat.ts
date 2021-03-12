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
const Lcurve = L.curve; // Leaflet.curve, which is internally equivalent to `new L.Curve(...)`
import Curve from './Curve'; // react leaflet curve
export { Curve, Lcurve, MarkerClusterGroup, Control, LatLngBounds, LatLngTuple, latLngBounds };
// import 'leaflet-polylinedecorator';
// import Leaflet, {Polyline, } from 'leaflet';
// const polylineDecorator = (Leaflet as any).polylineDecorator;
// export { polylineDecorator };
