import { Sema as Semaphore, RateLimit } from 'async-sema';
import ipAddress from 'ip-address';

import { Cache as GeoIPCache } from './geoip';

export const PACKAGE = require('../package.json');

// The following rainbow function is adapted from the one in https://stackoverflow.com/a/7419630/5488616
export function rainbow(numOfSteps: number, step: number, alpha = 1): string {
  // This function generates vibrant, "evenly spaced" colours (i.e. no clustering). This is ideal for creating easily distinguishable vibrant markers in Google Maps and other apps.
  // Adam Cole, 2011-Sept-14
  // HSV to RBG adapted from: http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
  let r, g, b;
  let h = step / numOfSteps;
  let i = ~~(h * 6);
  let f = h * 6 - i;
  let q = 1 - f;
  switch (i % 6) {
    case 0:
      r = 1;
      g = f;
      b = 0;
      break;
    case 1:
      r = q;
      g = 1;
      b = 0;
      break;
    case 2:
      r = 0;
      g = 1;
      b = f;
      break;
    case 3:
      r = 0;
      g = q;
      b = 1;
      break;
    case 4:
      r = f;
      g = 0;
      b = 1;
      break;
    default:
      /*case 5*/ r = 1;
      g = 0;
      b = q;
      break;
  }
  const c = `rgba(${~~(r * 255)}, ${~~(g * 255)}, ${~~(b * 255)}, ${alpha})`;
  return c;
}

export function rainbowPalette(numOfSteps: number, alpha = 1): () => string {
  let nth = -1;
  function next_color(): string {
    nth += 1;
    nth %= numOfSteps;
    return rainbow(numOfSteps, nth, alpha);
  }
  return next_color;
}

export function round(number: number, ndigits: number): number {
  // https://stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places-only-if-necessary
  const factor = 10 ** ndigits;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

export class HiddenHostsStorage {
  ENTRYID: string;

  constructor(panelID: string, packageID = PACKAGE.name) {
    this.ENTRYID = `${packageID}-${panelID}-hidden-hosts`;
  }

  load(): Set<string> {
    const items = JSON.parse(localStorage.getItem(this.ENTRYID) || 'null') || [];
    return new Set(items);
  }

  store(items: Set<string>) {
    localStorage.setItem(this.ENTRYID, JSON.stringify(Array.from(items)));
  }

  add(item: string): Set<string> {
    let items = this.load();
    if (!items.has(item)) {
      items.add(item);
    }
    this.store(items);
    return items;
  }

  remove(item: string): Set<string> {
    let items = this.load();
    items.delete(item);
    this.store(items);
    return items;
  }

  toggle(item: string): Set<string> {
    let items = this.load();
    if (items.has(item)) {
      items.delete(item);
    } else {
      items.add(item);
    }
    this.store(items);
    return items;
  }

  clear() {
    localStorage.removeItem(this.ENTRYID);
  }
}

export class CodeSnippets {
  static ip2geoFunction = `async function(ip) {
    const resp = await fetch(\`https://api.ip.sb/geoip/\${ip}\`, { headers: { 'Accept': "application/json" } });
    const data = await resp.json();
    const { country, latitude, longitude, isp } = data;
    return { region: country, label: isp, lon: longitude, lat: latitude };
}`;
}

// https://stackoverflow.com/questions/46946380/fetch-api-request-timeout
export function timeout(promise: Promise<any>, ms: number) {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      reject(new Error('timeout'));
    }, ms);
    promise.then(resolve, reject);
  });
}

export function parseIPAddress(ip: string): ipAddress.Address4 | ipAddress.Address6 | undefined {
  try {
    const ipv4 = new ipAddress.Address4(ip);
    return ipv4.valid ? ipv4 : undefined;
  } catch (_e) {}

  try {
    const ipv6 = new ipAddress.Address6(ip);
    return ipv6.valid ? ipv6 : undefined;
  } catch (_e) {}

  return undefined;
}

export const isValidIPAddress = (ip: string) => Boolean(parseIPAddress(ip));

function toCIDRPair(ipv4: string): [bigint, number] {
  try {
    const [a, b] = ipv4.split('/');
    const ip = new ipAddress.Address4(a);
    const range = parseInt(b, 10);
    return [ipv4PartsToBigInt(ip.parsedAddress), range];
  } catch (e) {
    console.error(e);
    throw e;
  }
}

// Ref: https://ipgeolocation.io/resources/bogon.html
const bogonSpace = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '255.255.255.255/32',
].map(toCIDRPair);

// Ref: https://en.wikipedia.org/wiki/List_of_assigned_/8_IPv4_address_blocks#List_of_assigned_/8_blocks_to_the_United_States_Department_of_Defense
const dodSpace = [
  // "6.0.0.0/8",
  // "7.0.0.0/8",
  '11.0.0.0/8', // actually, even 11/8 are being announced nowadays
  // "21.0.0.0/8",
  // "22.0.0.0/8",
  '26.0.0.0/8',
  // "28.0.0.0/8",
  // "29.0.0.0/8",
  // "30.0.0.0/8",
  // "33.0.0.0/8",
  // "55.0.0.0/8",
  // "214.0.0.0/8",
  // "215.0.0.0/8"
].map(toCIDRPair);

export function isInCIDR(ipv4: bigint, cidr: [bigint, number]): boolean {
  return (ipv4 ^ cidr[0]) >> BigInt(32 - cidr[1]) === BigInt(0);
}

export function ipv4PartsToBigInt(ipv4Parts: string[]): bigint {
  return ipv4Parts.reduce<bigint>((p: bigint, x: string) => (p << BigInt(8)) + BigInt(parseInt(x, 10)), BigInt(0));
}

export function isBogusIPAddress(ip: ipAddress.Address4 | ipAddress.Address6, dodAsBogus = false) {
  if (ip.v4) {
    // const bits = ip.bigInteger(); // jsbn's BigInteger has nothing to with ECMA-262 bigint
    const bits = ipv4PartsToBigInt((ip as ipAddress.Address4).parsedAddress);
    if (bogonSpace.map((bogon) => isInCIDR(bits, bogon)).some((v) => v)) {
      return true;
    }
    if (dodAsBogus && dodSpace.map((bogon) => isInCIDR(bits, bogon)).some((v) => v)) {
      if (new Date().getFullYear() <= 2021) {
        // LoL
        return true;
      }
    }
    return false;
  } else {
    // TODO: Unimplemented
    return false;
  }
}

export function simplyHostname(hostname: string): string {
  if (!isValidIPAddress(hostname)) {
    hostname = hostname.split('.')[0];
  }
  return hostname;
}

/**
 * Batch executing promises with throttling.
 *
 * @param tasks As is.
 * @param concurrent The maximum number of promises that runs conncurrently.
 * @param rps The maximum number of promises (requests) to run per second.
 */
export async function batch_with_throttle<V>(
  tasks: Array<() => Promise<V>>,
  concurrent?: number,
  rps?: number
): Promise<V[]> {
  let sema = new Semaphore(concurrent ?? tasks.length);
  let lim = RateLimit(rps ?? tasks.length, { uniformDistribution: true });
  return await Promise.all(
    tasks.map(async (task) => {
      await sema.acquire();
      await lim();
      try {
        return await task();
      } finally {
        await sema.release();
      }
    })
  );
}

interface ThrottableFn<P0, PN extends any[], R> {
  (arg0: P0, ...args: PN): Promise<R>;
}

interface Throttler<P0, PN extends any[], R> {
  (fn: ThrottableFn<P0, PN, R>): ThrottableFn<P0, PN, R>;
}

/**
 * Make a thorttler that wraps a function with synchronization primitives so that the function is
 * rate-limited according to the params `concurrent` and `rps`.
 *
 * @param concurrent The maximum number of promises that runs conncurrently.
 * @param rps The maximum number of promises (requests) to run per second.
 */
export function makeThrottler<P0, PN extends any[], R>(concurrent: number, rps: number): Throttler<P0, PN, R> {
  // eslint-disable-next-line no-console
  console.assert(concurrent > 0 && rps > 0);
  let sema = new Semaphore(concurrent);
  let limt = RateLimit(rps, { uniformDistribution: true });

  function throttler(fn: ThrottableFn<P0, PN, R>): ThrottableFn<P0, PN, R> {
    async function wrapped(arg0: P0, ...args: PN): Promise<R> {
      await sema.acquire();
      await limt();
      try {
        return await fn(arg0, ...args);
      } finally {
        await sema.release();
      }
    }
    return wrapped;
  }
  return throttler;
}

export function constructQueryParams(params: { [key: string]: string }): string {
  return Object.entries(params)
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
    .join('&');
}

async function resolveDoH(name: string, type: string): Promise<string | null> {
  const api = 'https://cloudflare-dns.com/dns-query';
  // const api = "https://dns.google/resolve";
  const params = {
    name,
    type,
  };
  const resp = await fetch(api + '?' + constructQueryParams(params), { headers: { accept: 'application/dns-json' } });
  const body = await resp.json();
  if (body.Status !== 0) {
    throw new Error(`Query DoH failed with status ${resp}`);
  }
  return body?.Answer[0]?.data ?? null;
}

async function resolveAorAAAA(name: string): Promise<string | null> {
  let results: string[] = [];
  await Promise.all(
    ['A', 'AAAA'].map(async (type) => {
      try {
        const ans = await resolveDoH(name, type);
        if (ans) {
          results.push(ans);
        }
      } catch (e) {
        /* fail silently */
      }
    })
  );
  return results[results.length - 1];
}

export async function resolveHostname(name: string, noCache = false): Promise<string | null> {
  if (isValidIPAddress(name)) {
    return name;
  }
  let address: string | undefined | null = noCache ? undefined : (GeoIPCache.get(name) as string);
  if (address === undefined) {
    address = await resolveAorAAAA(name);
    GeoIPCache.set(name, address); // TODO: Cache is just "borrowed" from GeoIP for now.
  }
  return address;
}

export function regionJoin(...units: Array<string | undefined>): string | undefined {
  return units.reduce((p, x) => eliminatePrefixOrSuffix(p, x).join(', '));
}

export function orgJoin(org1: string | undefined, org2: string | undefined): string | undefined {
  [org1, org2] = eliminatePrefixOrSuffix(org1, org2);
  return org1 && (org2 ? `${org1} (${org2})` : org1);
}

export function eliminatePrefixOrSuffix(label1?: string, label2?: string): string[] {
  if (label1 && label2?.startsWith(label1)) {
    label1 = undefined;
  } else if (label2 && label1?.startsWith(label2)) {
    label2 = undefined;
  }
  return [label1, label2].filter((value) => value) as string[];
}
