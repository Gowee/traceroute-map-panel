import React, { ComponentType, ReactElement } from 'react';
import { LatLngTuple, Marker, Tooltip as RLTooltip } from '../react-leaflet-compat';

import { round } from '../utils';
import { RoutePoint } from '../data';
import { GenericPointPopupProps } from './PointPopup';
import { GenericPathLineProps } from './line';

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
          <RLTooltip className="host-dest-tooltip">
            <span className="host-label" title={host}>
              {host}
            </span>
            <span className="host-arrow" style={{ color }}>
              &nbsp; ➜ &nbsp;
            </span>
            <span className="dest-label" title={host}>
              {dest}
            </span>
          </RLTooltip>
        </Marker>
      ))}
      <PathLine positions={path} color={color} />
    </div>
  );
}

export default RoutePath;
