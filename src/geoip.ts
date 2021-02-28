/* eslint-disable */

import { PACKAGE, isValidIPAddress } from './utils';

// candidante cache providers:
// SessionStorage
// LocalStorage
// IndexDB

export type GeoIPProvider = IPInfo | IPSB | CustomAPI | CustomFunction;
export type GeoIPProviderKind = 'ipinfo' | 'ipsb' | 'custom-api' | 'custom-function';

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPInfo {
  kind: 'ipinfo';
  token?: string;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPSB {
  kind: 'ipsb';
}

export interface CustomAPI {
  kind: 'custom-api';
  url: string;
}

export interface CustomFunction {
  kind: 'custom-function';
  code: string; //(ip: string) => Promise<IPGeo>
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPGeo {
  region?: string;
  label?: string;
  lat?: number;
  lon?: number;
}

// const cache = new LRUCache({ max: 1024, maxAge: 8 * 60 * 60 * 1000 });
const Cache = {
  get: (key: string) => JSON.parse(sessionStorage.getItem(`${PACKAGE.name}-geoip-${key}`) ?? 'null') ?? undefined,
  set: (key: string, value: IPGeo) => sessionStorage.setItem(`${PACKAGE.name}-geoip-${key}`, JSON.stringify(value)),
  clear: (indiscriminate = false) => {
    let count = 0;
    if (indiscriminate) {
      count = sessionStorage.length;
      sessionStorage.clear();
    } else {
      for (const entry in sessionStorage) {
        if (entry.startsWith(`${PACKAGE.name}-geoip`)) {
          sessionStorage.removeItem(entry);
          count += 1;
        }
      }
    }
    return count;
  },
};

export class IP2Geo {
  defaultProvider: GeoIPProvider = { kind: 'ipsb' } as IPSB;

  static fromProvider(provider: GeoIPProvider) {
    let fn: (ip: string) => Promise<IPGeo>;
    switch (provider.kind) {
      case 'ipinfo':
        fn = (ip: string) => IP2Geo.IPInfo(ip, provider.token);
        break;
      case 'ipsb':
        fn = IP2Geo.IPSB;
        break;
      case 'custom-api':
        fn = (ip: string) => IP2Geo.GenericAPI(provider.url, ip);
        break;
      default:
        /* case 'custom-function': */
        // eslint-disable-next-line no-eval
        eval(`fn = ${provider.code}`);
    }
    // TODO: sanitize API query result

    async function ip2geo(ip: string, noCache = false): Promise<IPGeo> {
      if (isValidIPAddress(ip)) {
        let geo = noCache ? undefined : (Cache.get(ip) as IPGeo);
        if (geo === undefined) {
          geo = await fn(ip);
          Cache.set(ip, geo);
        }
        return geo;
      }
      return {};
    }
    return ip2geo;
  }

  static async IPInfo(ip: string, token?: string): Promise<IPGeo> {
    const r = await fetch(`https://ipinfo.io/${ip}/json?token=${token ?? ''}`, {
      headers: {
        Accept: 'application/json',
      },
    });
    const data = await r.json();
    if (data.error) {
      throw new Error(`IPInfo: ${data.error.title} (${data.error.message})`);
    }
    const { country, city, region, loc, org } = data;
    const region_city = city && `${city.indexOf(region) === -1 ? `${city}, ${region}` : city}, ${country}`;
    const [lat, lon] = loc ? loc.split(',').map(parseFloat) : [undefined, undefined];
    const geo = { region: region_city, label: org, lat, lon };
    return geo;
  }

  static async IPSB(ip: string): Promise<IPGeo> {
    const r = await fetch(`https://api.ip.sb/geoip/${ip}`, { headers: { Accept: 'application/json' } });
    const data = await r.json();
    const { country, latitude, longitude, isp } = data;
    const geo = { region: country, label: isp, lon: longitude, lat: latitude };
    return geo;
  }

  static async GenericAPI(url: string, ip: string): Promise<IPGeo> {
    const r = await fetch(url.replace('{IP}', ip), { headers: { Accept: 'application/json' } });
    const data = await r.json();
    return data;
  }

  static clearCache(): number {
    return Cache.clear();
  }
}
