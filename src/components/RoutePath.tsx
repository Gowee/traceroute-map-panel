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
  // TODO: deactivate tooltip when popup is active

  return (
    <div data-host={host} data-dest={dest} data-points={points.length}>
      {points.map((point) => (
        <Marker
          key={`${round(point.lat, 1)},${round(point.lon, 1)}`}
          position={wrapCoord([point.lat, point.lon])}
          className="point-marker"
        >
          <Popup host={host} dest={dest} point={point} color={color} />
          <RLTooltip>
            <div className="route-tooltip">
              <div className="hops-abstract">
                <div className="content">
                  {point.hops.length}
                  <sup>hop{point.hops.length > 1 && 's'}</sup> <i>at</i> <small>{point.region}</small>
                </div>
              </div>
              <div className="host-dest-label" title={`on the route path from ${host} to ${dest}`}>
                <span className="host-label">{host}</span>
                <span className="host-arrow" style={{ color }}>
                  &nbsp; ➜ &nbsp;
                </span>
                <span className="dest-label">{dest}</span>
              </div>
            </div>
          </RLTooltip>
        </Marker>
      ))}
      <PathLine positions={path} color={color} />
    </div>
  );
}

export default RoutePath;
