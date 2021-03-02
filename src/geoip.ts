/* eslint-disable */

import { PACKAGE, isValidIPAddress, regionFromTriple } from './utils';

// candidante cache providers:
// SessionStorage
// LocalStorage
// IndexDB

export type GeoIPProvider = IPInfo | IPSB | IPAPICo | CustomAPI | CustomFunction;
// Ref: https://stackoverflow.com/questions/45251664/typescript-derive-union-type-from-tuple-array-values
export const GeoIPProviderKinds = ['ipinfo', 'ipsb', 'ipapico', 'custom-api', 'custom-function'] as const;
export type GeoIPProviderKind = typeof GeoIPProviderKinds[number];

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPInfo {
  kind: 'ipinfo';
  token?: string;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPSB {
  kind: 'ipsb';
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPAPICo {
  kind: 'ipapico';
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
export const Cache = {
  get: (key: string) => JSON.parse(sessionStorage.getItem(`${PACKAGE.name}-geoip-${key}`) ?? 'null') ?? undefined,
  // Note: JSON.stringify/parse does not work for `undefined`, so always convert `undefined` to `null`.
  set: (key: string, value: Object | null) => sessionStorage.setItem(`${PACKAGE.name}-geoip-${key}`, JSON.stringify(value ?? 'null')),
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
      case 'ipapico':
        fn = IP2Geo.IPAPICo;
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
    // Some weired CORS failures are observed w/o preflight requests.
    // Is it possible that browsers have some strange cache mechanism for CORS status?
    // Anyway, just use www. which is not usual for HTML, instead of ipinfo.io to avoid such case.
    const r = await fetch(`https://www.ipinfo.io/${ip}/json?token=${token ?? ''}`, {
      headers: {
        Accept: 'application/json',
      },
    });
    const data = await r.json();
    if (data.error) {
      throw new Error(`IPInfo: ${data.error.title} (${data.error.message})`);
    }
    const { country, city, region, loc, org } = data;
    // const region_city = city && `${city.indexOf(region) === -1 ? `${city}, ${region}` : city}, ${country}`;
    const regionFull = regionFromTriple(country, region, city);
    const [lat, lon] = loc ? loc.split(',').map(parseFloat) : [undefined, undefined];
    const geo = { region: regionFull, label: org, lat, lon };
    return geo;
  }

  static async IPSB(ip: string): Promise<IPGeo> {
    const r = await fetch(`https://api.ip.sb/geoip/${ip}`, { headers: { Accept: 'application/json' } });
    const data = await r.json();
    const { country, latitude, longitude, isp } = data;
    const geo = { region: country, label: isp, lon: longitude, lat: latitude };
    return geo;
  }

  static async IPAPICo(ip: string): Promise<IPGeo> {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, { headers: { Accept: 'application/json' } });
    const d = await r.json();
    if (d.error) {
      throw new Error(`IPAPI.co: ${d.reason} (${d.message})`);
    }
    const { country_name, region, city, latitude, longitude, asn, org } = d;
    const regionFull = regionFromTriple(country_name, region, city);
    const label = [asn, org].filter((value) => value).join(" ");
    return { region: regionFull, label: label, lon: longitude, lat: latitude };
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
