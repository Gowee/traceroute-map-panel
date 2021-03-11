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

const AntSpline: React.FC<SplineProps> = ({ positions, color, splineFn: spline, speedFactor }) => {
  const path = useMemo(() => spline(positions), [positions, spline]);
  const duration = 90 / (speedFactor ?? 1);
  return <AntPath positions={path} options={{ use: Lcurve, color, fillOpacity: 1 }} />;
};

const SimpleSpline: React.FC<SimpleSplineProps> = ({ positions, color, splineFn: spline, animated, speedFactor }) => {
  const path = useMemo(() => spline(positions), [positions, spline]);
  const alen = useMemo(() => estimatePathLength(path), [positions, spline]);
  // console.log(path, alen);
  const animationOptions = animated
    ? { dashArray: '5', animate: { duration: (alen * 70) / (speedFactor ?? 1), iterations: Infinity } }
    : {};
  console.log(animationOptions);
  // IT IS option INSTEAD OF options!
  return <Curve positions={path} option={{ color, ...animationOptions }} />;
};

const AntSplineMemo = React.memo(AntSpline);
const SimpleSplineMemo = React.memo(SimpleSpline);

export { AntSplineMemo as AntSpline, SimpleSplineMemo as SimpleSpline };
