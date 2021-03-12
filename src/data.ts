import _ from 'lodash';
import { DataFrame } from '@grafana/data';
import { latLngBounds, LatLngTuple } from './react-leaflet-compat';

import { round, Throttler, resolveHostname, parseIntChecked } from './utils';
import { IPGeo } from './geoip/api';
import { InvalidSchemaError } from './errors';

export type DataEntry = [string, string, number, string, number, number];

export interface RoutePoint {
  lat: number;
  lon: number;
  region: string;
  hops: Array<{
    nth: number;
    ip: string;
    label: string;
    rtt: number;
    loss: number;
  }>;
}

/**
 * Process the raw data frame to produce entries of fields `['host', 'dest', 'hop', 'ip', 'rtt', 'loss']`.
 *
 * @param series The series containing one or more data frame.
 * @returns Entries of fields.
 */
export function seriesToEntries(series: DataFrame[]): DataEntry[] {
  // TODO: how to make this function generic?
  let entries: DataEntry[] = [];
  for (const [idx, frame] of series.entries()) {
    entries = entries.concat(dataFrameToEntriesUnsorted(frame, idx));
  }
  entries.sort((a, b) => a[2] - b[2]);
  return entries;
}

/**
 * Process the raw data frame to produce entries of fields `['host', 'dest', 'hop', 'ip', 'rtt', 'loss']`.
 *
 * @param frame The raw data frame to be processed. It is expected to inlude the expected fields.
 * @return Entries of fields.
 */
export function dataFrameToEntriesUnsorted(frame: DataFrame, idx?: number): DataEntry[] {
  // TODO: full iterator
  let fields: any = {};
  ['host', 'dest', 'hop', 'ip', 'rtt', 'loss'].forEach((item) => (fields[item] = null));
  for (const field of frame.fields) {
    if (fields.hasOwnProperty(field.name)) {
      fields[field.name] = field.values.toArray();
    } /* else {
        console.log('Ignoring field: ' + field.name);
      } */
  }
  if (Object.values(fields).includes(null)) {
    const missingFields = Object.entries(fields)
      .filter(([_key, value]) => value === null)
      .map(([key, _value]) => key);
    let message;
    const seriesName = typeof idx === 'number' ? ` ${idx}` : '';
    if (missingFields.length === 6) {
      if (frame.fields.map((field) => field.name).includes('Time')) {
        message = 'All fields are missing. Is the data formatted as table when querying InfluxDB?';
      } else {
        message = `All expected fields are missing from the query${seriesName}.`;
      }
    } else {
      message = `The query${seriesName} is missing field(s): ${missingFields.join(', ')}`;
    }
    throw new InvalidSchemaError(message);
  }
  // Note: map(parseInt) does work as intended.
  //  ref: https://medium.com/dailyjs/parseint-mystery-7c4368ef7b21
  let entries = _.zip(
    fields.host,
    fields.dest,
    fields.hop.map((v: string) => parseIntChecked(v, 10)),
    fields.ip,
    fields.rtt.map((v: string) => parseFloat(v)), // not acctually useful for now, so no check is fine
    fields.loss.map((v: string) => parseFloat(v))
  ) as DataEntry[];
  return entries;
}

/**
 * Process [host, dest, hop, ip, rtt, loss] entries to produce routes.
 * @param entries Entries.
 * @param options Panel options.
 */
export async function entriesToRoutes(
  entries_with_geos: Array<[DataEntry, IPGeo]>
): Promise<Map<string, RoutePoint[]>> {
  // TODO: use catersian product to handle non-linear route paths

  let data: Map<string, Map<string, RoutePoint>> = new Map();
  for (const [entry, geo] of entries_with_geos) {
    const [host, dest, hop, ip, rtt, loss] = entry as DataEntry;
    const groupKey = `${host}|${dest}`;
    const { region, label, lat, lon } = geo as IPGeo;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      continue; // implying invalid or LAN IP
    }
    let group = data.get(groupKey);
    if (group === undefined) {
      group = new Map();
      data.set(groupKey, group);
    }
    // If two points are too close, they are merged into a single point.
    // Note: This has nothing to with mapClusterRadius.
    const point_id = `${round(lat, 1)},${round(lon, 1)}`;
    let point = group.get(point_id);
    if (point === undefined) {
      point = { lat, lon, region: region ?? 'unknown region', hops: [] };
      group.set(point_id, point);
    }
    // Add a new hop record at this point.
    // TODO: Repeated hops are not handled at all so far. They are filtered out by the sample InfluxDB query.
    point.hops.push({ nth: hop, ip, label: label ?? 'unknown network', rtt, loss });
  }
  return new Map(Array.from(data.entries()).map(([key, value]) => [key, Array.from(value.values())]));
}

export function routesToBounds(
  routes: Map<string, RoutePoint[]>,
  pathProcessor?: (path: LatLngTuple[]) => LatLngTuple[],
  coordProcessor?: (coord: LatLngTuple) => LatLngTuple
): Map<string, LatLngTuple[]> {
  let mapBounds: Map<string, LatLngTuple[]> = new Map();
  for (const [key, route] of routes.entries()) {
    mapBounds.set(key, routeToBound(route, pathProcessor, coordProcessor));
  }
  return mapBounds;
}

export function routeToBound(
  route: RoutePoint[],
  pathProcessor?: (path: LatLngTuple[]) => LatLngTuple[],
  coordProcessor?: (coord: LatLngTuple) => LatLngTuple
): LatLngTuple[] {
  let path = route.map((point) => [point.lat, point.lon] as LatLngTuple);
  if (pathProcessor) {
    path = pathProcessor(path);
  }
  if (coordProcessor) {
    path = path.map(coordProcessor);
  }
  const bound = latLngBounds(path);
  return [
    [bound.getSouth(), bound.getWest()],
    [bound.getNorth(), bound.getEast()],
  ];
}

export async function prependZerothHopsBySrcHosts(
  entries: DataEntry[],
  throttler?: Throttler<string, any[], string | null>
): Promise<DataEntry[]> {
  let zerothHopEntries: DataEntry[] = [];
  const resolve = throttler ? throttler(resolveHostname) : resolveHostname;
  await Promise.all(
    Array.from(new Set(entries.map((entry) => `${entry[0]}|${entry[1]}`)).values()).map(async (hostDest) => {
      const [host, dest] = hostDest.split('|');
      const address = await resolve(host);
      if (address) {
        zerothHopEntries.push([host, dest, 0, address, 0, 0]);
      }
    })
  );
  // Closer hops come first.
  return zerothHopEntries.concat(entries);
}
