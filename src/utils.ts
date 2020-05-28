import ipAddress from 'ip-address';
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
  static ipgeoInterface = `export interface IPGeo {
    region?: string,
    label?: string,
    lat?: number,
    lon?: number,
}`;

  static ip2geoSignature = `(ip: string) => Promise<IPGeo>`;

  static ip2geoFunction = `async function(ip) {
    const r = await fetch(\`https://api.ip.sb/geoip/\${ip}\`, { headers: { 'Accept': "application/json" } });
    const data = await r.json();
    const { country, latitude, longitude, isp } = data;
    const geo = { region: country, label: isp, lon: longitude, lat: latitude };
    return geo;
}`;
}

// https://stackoverflow.com/questions/46946380/fetch-api-request-timeout
export function timeout(promise: Promise<any>, ms: number) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      reject(new Error('timeout'));
    }, ms);
    promise.then(resolve, reject);
  });
}

export function isValidIPAddress(ip: string) {
  const ipv4 = new ipAddress.Address4(ip);
  const ipv6 = new ipAddress.Address6(ip);
  return ipv4.valid || ipv6.valid;
}

export function simplyHostname(hostname: string): string {
  if (!isValidIPAddress(hostname)) {
    hostname = hostname.split('.')[0];
  }
  return hostname;
}
