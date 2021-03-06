import React from 'react';
import { LatLngTuple, Marker, LCurve } from '../react-leaflet-compat';
import AntPath from 'react-leaflet-ant-path';

import { round } from '../utils';
import { RoutePoint } from '../data';
import { HopLabelType } from '../options';
import { interpolate1, pointsToBezierPath1, pointsToBezierPath2 } from '../spline';
import PointPopup from './PointPopup';

/**
 * Leaflet Markers and Polyline for a single route path, corresponding to one host->dest pair
 */
const RoutePath: React.FC<{
  host: string;
  dest: string;
  points: RoutePoint[];
  color: string;
  hopLabel: HopLabelType;
  showSearchIcon: boolean;
  coordWrapper?: (coord: LatLngTuple) => LatLngTuple;
}> = ({ host, dest, points, color, hopLabel, showSearchIcon, coordWrapper }) => {
  let wrapCoord = coordWrapper ?? ((coord: LatLngTuple) => coord);
  const path = points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple);
  const interpolatedPath = interpolate1(path);
  console.log(path, interpolatedPath);

  return (
    <div data-host={host} data-dest={dest} data-points={points.length}>
      {points.map((point) => (
        <Marker
          key={`${round(point.lat, 1)},${round(point.lon, 1)}`}
          position={wrapCoord([point.lat, point.lon])}
          className="point-marker"
        >
          <PointPopup
            host={host}
            dest={dest}
            point={point}
            color={color}
            hopLabel={hopLabel}
            showSearchIcon={showSearchIcon}
          />
        </Marker>
      ))}

      <AntPath
        positions={pointsToBezierPath1(points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple))}
        options={{ use: LCurve, color }}
      />
      <AntPath
        positions={pointsToBezierPath2(points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple))}
        options={{ use: LCurve, color: 'blue' }}
      />

      {/* <Polyline
          positions={points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple)}
          color={color}
        ></Polyline> */}
    </div>
  );
};

export default RoutePath;
