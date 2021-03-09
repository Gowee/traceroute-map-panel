import React from 'react';
import AntPath from 'react-leaflet-ant-path';
import { Curve, LatLngTuple, Lcurve, Polyline as LPolyline } from 'react-leaflet-compat';

export interface GenericPathLineProps {
  positions: LatLngTuple[];
  color: string;
}

export interface SplineProps extends GenericPathLineProps {
  splineFn: (path: LatLngTuple[]) => any;
}

export interface SimpleSplineProps extends SplineProps {
  animated?: boolean;
}

export const AntSpline: React.FC<SplineProps> = ({ positions, color, splineFn: spline }) => {
  console.log(positions);
  const path = spline(positions);
  console.log(path);
  return <AntPath positions={path} options={{ use: Lcurve, color }} />;
};

export const SimpleSpline: React.FC<SimpleSplineProps> = ({ positions, color, splineFn: spline, animated }) => {
  const path = spline(positions);
  const animationOptions = animated ? { dashArray: '5', animate: { duration: 60000, iterations: Infinity } } : {};
  // IT IS option INSTEAD OF options!
  return <Curve positions={path} option={{ color, ...animationOptions }} />;
};

// export default AntSpline;

// export const Polyline: React.ComponentType<GenericPathLineProps> = ({props}) =>  <LPolyline {...props} />;
