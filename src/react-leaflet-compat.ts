// https://github.com/PaulLeCam/react-leaflet/issues/453
// https://github.com/ghybs/leaflet-defaulticon-compatibility
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'; // Re-uses images from ~leaflet package
export * from 'react-leaflet';
import 'leaflet-defaulticon-compatibility';