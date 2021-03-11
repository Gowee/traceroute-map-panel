// Adapted from: https://github.com/Shadowman4205/react-leaflet-curve/blob/master/src/Curve.js
//  to prevent its bundled (outdated?) Leaflet.curve from polluting the existing dependencies.

import { Path, PathProps, withLeaflet } from 'react-leaflet';
import L from 'leaflet';
import '@elfalem/leaflet-curve';

interface CurveProps extends PathProps {
  positions: any[];
  option: any;
}

class Curve extends Path<CurveProps, L.Curve> {
  createLeafletElement(props: CurveProps) {
    const { positions, option /*, ...options*/ } = props;
    return L.curve(positions, option /*, this.getOptions(options)*/);
  }

  updateLeafletElement(fromProps: CurveProps, toProps: CurveProps) {
    if (toProps.positions !== fromProps.positions) {
      (this.leafletElement.setPath as any)(toProps.positions);
    }
    this.setStyleIfChanged(fromProps, toProps);
  }
}

// Curve.propTypes = {
//     children: PropTypes.oneOfType([
//         PropTypes.arrayOf(PropTypes.node),
//         PropTypes.node
//     ]),
//     option: PropTypes.object,
//     positions: PropTypes.array.isRequired
// };

export default withLeaflet(Curve);

// TODO: type are just roughly annoatated
