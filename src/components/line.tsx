import React, { useMemo } from 'react';
import AntPath from 'react-leaflet-ant-path';
import { Curve, LatLngTuple, Lcurve } from 'react-leaflet-compat';
import { estimatePathLength } from 'spline';

import { assert } from '../errors';

export interface GenericPathLineProps {
  positions: LatLngTuple[];
  color: string;
}

export interface SplineProps extends GenericPathLineProps {
  splineFn: (path: LatLngTuple[]) => any;
  speedFactor?: number;
}

export interface SimpleSplineProps extends SplineProps {
  animated?: boolean;
}

const AntSpline: React.FC<SplineProps> = ({ positions, color: colorRGBA, splineFn: spline, speedFactor }) => {
  const path = useMemo(() => spline(positions), [positions, spline]);
  const duration = 90 / (speedFactor ?? 1);
  // AntPath has stroke-opacity=0.5 set by default. FIX: refactor color palette
  const color = colorRGBA.replace(', 0.618', '');
  return (
    <AntPath className="us0129039120" positions={path} options={{ use: Lcurve, color, fillOpacity: 1 }}>
      <style>{`
.leaflet-ant-path {
/* The animation-duration CSS property of AntPath inside MarkerClusterGroup is not set,
    due to unknown reasons. Just patch it anyway. */
animation-duration: ${duration}s !important;
}
  `}</style>
      {/* FIX: too dirty now; the style won't be applied per component respectively  */}
    </AntPath>
  );
};

const SimpleSpline: React.FC<SimpleSplineProps> = ({ positions, color, splineFn: spline, animated, speedFactor }) => {
  const path = useMemo(() => spline(positions), [positions, spline]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const alen = useMemo(() => estimatePathLength(path), [positions, spline]);
  const animationOptions = animated
    ? { dashArray: '5', animate: { duration: (alen * 70) / (speedFactor ?? 1), iterations: Infinity } }
    : undefined;
  // Here, IT IS option INSTEAD OF options!
  return <Curve positions={path} option={{ color, ...animationOptions }} />;
};

const AntSplineMemo = React.memo(AntSpline);
const SimpleSplineMemo = React.memo(SimpleSpline);

export { AntSplineMemo as AntSpline, SimpleSplineMemo as SimpleSpline };
