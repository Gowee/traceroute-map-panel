import React from 'react';
import AntPath from 'react-leaflet-ant-path';
import { LatLngTuple, LCurve, Polyline as LPolyline } from 'react-leaflet-compat';

import { bezierSpline } from 'spline';

export interface GenericPathLineProps {
  positions: LatLngTuple[];
  color: string;
}

export interface AntSplineProps extends GenericPathLineProps {}

const AntSpline: React.FC<AntSplineProps> = ({ positions, color }) => {
  const path = bezierSpline(positions);

  return <AntPath positions={path} options={{ use: LCurve, color }} />;
};

export default AntSpline;

// export const Polyline: React.ComponentType<GenericPathLineProps> = ({props}) =>  <LPolyline {...props} />;
