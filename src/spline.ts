import bezierSpline from '@freder/bezier-spline';
import BezierSpline from 'bezier-spline';
import { assert } from './errors';
import { LatLngTuple } from 'react-leaflet-compat';

type Point = [number, number];

const vecLen = (a: Point, b: Point) => Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));

export function symmetricAboutLine(pa: Point, line: [Point, Point]): Point {
  const [pb, pc] = line;
  if (pb[0] === pc[0]) {
    const l = pb[0] - pa[0];
    return [pa[0] + 2 * l, pa[1]];
  } else if (pb[1] === pc[1]) {
    const l = pb[1] - pa[1];
    return [pa[0], pa[1] + 2 * l];
  }
  const k = (pb[1] - pc[1]) / (pb[0] - pc[0]);

  const b = pb[1] - k * pb[0];
  // const pd: Point = [(pa[1] - b) / k, (k * pa[0] + b)];
  const pdy = (Math.pow(k, 2) * pa[1] + 2 * k * pa[0] + 2 * b - pa[1]) / (1 + Math.pow(k, 2));
  const pdx = k * (pa[1] - pdy) + pa[0];
  const pd: Point = [pdx, pdy];
  return pd;
}

export function angleOfThreePoints(point1: Point, point2: Point, point3: Point) {
  const vector1 = [point1[0] - point2[0], point1[1] - point2[1]];
  const vector2 = [point3[0] - point2[0], point3[1] - point2[1]];
  const dotproduct = vector1[0] * vector2[0] + vector1[1] * vector2[1];
  const cosine =
    dotproduct /
    (Math.sqrt(Math.pow(vector1[0], 2) + Math.pow(vector1[1], 2)) *
      Math.sqrt(Math.pow(vector2[0], 2) + Math.pow(vector2[1], 2)));
  return Math.acos(cosine);
}

export function interpolate1(latLons: Array<[number, number]>): Array<[number, number]> {
  const points = [latLons[0]];
  let i = 1;
  while (i + 1 < latLons.length) {
    const j = i + 1;
    const middle = vecLen(latLons[i], latLons[j]);
    const left = vecLen(latLons[i - 1], latLons[i]);
    const angleLeft = Math.abs(angleOfThreePoints(latLons[i - 1], latLons[i], latLons[j]));
    const spLeft = symmetricAboutLine(latLons[i - 1], [latLons[i], latLons[j]]);
    console.log(latLons[i], angleLeft);
    if (2 * left < middle && angleLeft < Math.PI / 2) {
      console.log('!');
      points.push(spLeft);
    }
    points.push(latLons[i]);

    if (j + 1 < latLons.length) {
      const right = vecLen(latLons[j], latLons[j + 1]);
      const angleRight = Math.abs(angleOfThreePoints(latLons[i], latLons[j], latLons[j + 1]));
      const spRight = symmetricAboutLine(latLons[j + 1], [latLons[i], latLons[j]]);
      if (2 * right < middle && angleRight < Math.PI / 2) {
        console.log(angleRight);
        console.log('!!');
        points.push(spRight);
      }
    }
    i += 1;
  }
  points.push(latLons[latLons.length - 1]);
  return points;
}

export function pathToBezierSpline1(latLons: Array<[number, number]>): any {
  if (latLons.length === 0) {
    return [];
  } else if (latLons.length <= 2) {
    return ['M', ...latLons];
  }
  const controlPoints = bezierSpline.getControlPoints(latLons);
  assert(controlPoints.length === 2 * (latLons.length - 1));
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

export function pathToBezierSpline2(
  latLons: Array<[number, number]>,
  weightsFn: any = undefined,
  outputFormat: 'points' | 'curveCommands' = 'curveCommands'
): any {
  if (latLons.length === 0) {
    return [];
  } else if (latLons.length <= 2) {
    return ['M', ...latLons];
  }
  const spline = new BezierSpline(latLons, weightsFn);

  let path;
  if (outputFormat === 'curveCommands') {
    path = ['M', latLons[0]];
    for (const curve of spline.curves) {
      path.push('C');
      path.push(curve[1]); // control point 1
      path.push(curve[2]); // control point 2
      path.push(curve[3]); // knot
    }
  } else {
    // 'points'
    path = [latLons[0]];
    for (const curve of spline.curves) {
      for (const point of curve.slice(1)) {
        path.push(point);
      }
    }
  }

  return path;
}

export function pathToBezierSpline3(latLons: Array<[number, number]>, smoothing = 0.2): any {
  // Adapted from: https://medium.com/@francoisromain/smooth-a-svg-path-with-cubic-bezier-curves-e37b49d46c74
  if (latLons.length === 0) {
    return [];
  } else if (latLons.length <= 2) {
    return ['M', ...latLons];
  }
  // Properties of a line
  // I:  - pointA (array) [x,y]: coordinates
  //     - pointB (array) [x,y]: coordinates
  // O:  - (object) { length: l, angle: a }: properties of the line
  const line = (pointA: Point, pointB: Point) => {
    const lengthX = pointB[0] - pointA[0];
    const lengthY = pointB[1] - pointA[1];
    return {
      length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
      angle: Math.atan2(lengthY, lengthX),
    };
  };

  // Position of a control point
  // I:  - current (array) [x, y]: current point coordinates
  //     - previous (array) [x, y]: previous point coordinates
  //     - next (array) [x, y]: next point coordinates
  //     - reverse (boolean, optional): sets the direction
  // O:  - (array) [x,y]: a tuple of coordinates
  const controlPoint = (current: Point, previous: Point, next: Point, reverse?: boolean) => {
    // When 'current' is the first or last point of the array
    // 'previous' or 'next' don't exist.
    // Replace with 'current'
    const p = previous || current;
    const n = next || current;

    // Properties of the opposed-line
    const o = line(p, n);

    // If is end-control-point, add PI to the angle to go backward
    const angle = o.angle + (reverse ? Math.PI : 0);
    const length = o.length * smoothing;

    // The control point position is relative to the current point
    const x = current[0] + Math.cos(angle) * length;
    const y = current[1] + Math.sin(angle) * length;
    return [x, y];
  };

  // Create the bezier curve command
  // I:  - point (array) [x,y]: current point coordinates
  //     - i (integer): index of 'point' in the array 'a'
  //     - a (array): complete array of points coordinates
  // O:  - (string) 'C x2,y2 x1,y1 x,y': SVG cubic bezier C command
  const bezierCommand = (point: Point, i: number, a: Point[]) => {
    // start control point
    const cps = controlPoint(a[i - 1], a[i - 2], point);

    // end control point
    const cpe = controlPoint(point, a[i - 1], a[i + 1], true);
    return ['C', cps, cpe, point] as ['C', Point, Point, Point];
  };

  // Render the svg <path> element
  // I:  - points (array): points coordinates
  //     - command (function)
  //       I:  - point (array) [x,y]: current point coordinates
  //           - i (integer): index of 'point' in the array 'a'
  //           - a (array): complete array of points coordinates
  //       O:  - (string) a svg path command
  // O:  - (string): a Svg <path> element
  const curvePath = (points: Point[], command: (point: Point, i: number, a: Point[]) => ['C', Point, Point, Point]) => {
    // build the d attributes by looping over the points
    return points.reduce<any>((acc, point, i, a) => (i === 0 ? ['M', point] : acc.concat(command(point, i, a))), '');
  };

  return curvePath(latLons, bezierCommand);
}

/**
 * Estimate a path's approximate length.
 *
 * @param path Path command sequnce. e.g. ['M', [0, 0], 'C', [1,1], [2, 1], [3, 0], ...]
 * @returns Estimated length.
 */
export function estimatePathLength(path: any): number {
  function pointDistance(a: LatLngTuple, b: LatLngTuple): number {
    return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
  }

  if (path.length === 0) {
    return 0;
  }
  assert(path[0] === 'M', 'The path command sequence is invalid');
  let len = 0;
  let last: LatLngTuple = path[1];
  for (let i = 2; i < path.length; i++) {
    if (path[i] === 'M') {
      len += pointDistance(last, path[++i]);
    } else if (path[i] === 'C') {
      const c1: LatLngTuple = path[++i];
      const c2: LatLngTuple = path[++i];
      const next: LatLngTuple = path[++i];
      // Simple estimation: https://stackoverflow.com/a/37862545/5488616
      len +=
        [
          [last, next],
          [last, c1],
          [c1, c2],
          [c2, next],
        ]
          .map(([a, b]) => pointDistance(a, b))
          .reduce((p, x) => p + x, 0) / 2;
      last = next;
    } else {
      assert('Unsupported path command when estimating path length');
    }
  }
  return len;
}
