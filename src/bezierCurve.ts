import bezierSpline from '@freder/bezier-spline';

export function pointsToBezierPath(latLons: Array<[number, number]>): any {
  if (latLons.length === 0) {
    return [];
  }
  const controlPoints = bezierSpline.getControlPoints(latLons);
  // eslint-disable-next-line no-console
  console.assert(controlPoints.length === 2 * (latLons.length - 1));
  const path: any = ['M', latLons[0]];
  let j = 0;
  for (const latLon of latLons.slice(1)) {
    path.push('C');
    path.push(controlPoints[j++]);
    path.push(controlPoints[j++]);
    path.push(latLon);
  }
  // path.push('Z');
  return path;
  // return bezierSpline.combinePoints(latLons, bezierSpline.getControlPoints(latLons));
}
