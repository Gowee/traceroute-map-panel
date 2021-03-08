import React, { ComponentType, ReactElement } from 'react';
import { LatLngTuple, Marker, LCurve } from '../react-leaflet-compat';
import AntPath from 'react-leaflet-ant-path';

import { round } from '../utils';
import { RoutePoint } from '../data';
import { HopLabelType } from '../options';
// import { interpolate1, pathToBezierSpline1, pathToBezierSplinePath2 } from '../spline';
import { GenericPointPopupProps } from './PointPopup';
import { GenericPathLineProps } from './AntSpline';
import { Polyline } from 'react-leaflet';

export interface RoutePathProps {
  host: string;
  dest: string;
  points: RoutePoint[];
  Popup: ComponentType<GenericPointPopupProps>;
  PathLine: ComponentType<GenericPathLineProps>;
  color: string;
  // hopLabel: HopLabelType;
  // showSearchIcon: boolean;
  coordWrapper?: (coord: LatLngTuple) => LatLngTuple;
}

/**
 * Leaflet Markers and Polyline for a single route path, corresponding to one host->dest pair
 */
function RoutePath(props: RoutePathProps): ReactElement {
  const { host, dest, points, Popup, PathLine, color, coordWrapper } = props;
  let wrapCoord = coordWrapper ?? ((coord: LatLngTuple) => coord);
  const path = points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple);

  // TODO: colorize marker

  return (
    <div data-host={host} data-dest={dest} data-points={points.length}>
      {points.map((point) => (
        <Marker
          key={`${round(point.lat, 1)},${round(point.lon, 1)}`}
          position={wrapCoord([point.lat, point.lon])}
          className="point-marker"
        >
          <Popup host={host} dest={dest} point={point} color={color} />
        </Marker>
      ))}
      <PathLine positions={path} color={color} />

      {/* <AntPath
        positions={pathToBezierSpline1(points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple))}
        options={{ use: LCurve, color }}
      />
      <AntPath
        positions={pathToBezierSpline2(points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple))}
        options={{ use: LCurve, color: 'blue' }}
      /> */}

      {/* <Polyline
        positions={points.map((point) => wrapCoord([point.lat, point.lon]) as LatLngTuple)}
        color={color}
      ></Polyline> */}
    </div>
  );
}

export default RoutePath;
