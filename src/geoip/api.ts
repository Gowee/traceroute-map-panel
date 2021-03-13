/* eslint-disable */
// No idea. But the following gives: error  Definition for rule '@typescript-eslint/<...>' was not found. 
///* eslint-disable @typescript-eslint/interface-name-prefix */
///* eslint-disable @typescript-eslint/naming-convention */

import { GeoIPResolutionError, SignificantError, UserFriendlyError } from '../errors';
import { PACKAGE, isValidIPAddress, regionJoin, orgJoin, eliminatePrefixOrSuffix, parseFloatChecked } from '../utils';

// candidante cache providers:
// SessionStorage
// LocalStorage
// IndexDB

export type GeoIPProvider =
  | IPInfo
  | IPSB
  | IPDataCo
  | IPGeolocation
  | BigDataCloud
  | IPAPICo
  | CustomAPI
  | CustomFunction;
// Ref: https://stackoverflow.com/questions/45251664/typescript-derive-union-type-from-tuple-array-values
export const GeoIPProviderKinds = [
  'ipinfo',
  'ipsb',
  'ipdataco',
  'ipgeolocation',
  'bigdatacloud',
  'ipapico',
  'custom-api',
  'custom-function',
] as const;
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
export interface IPDataCo {
  kind: 'ipdataco';
  key: string;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPGeolocation {
  kind: 'ipgeolocation';
  key: string;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface BigDataCloud {
  kind: 'bigdatacloud';
  key: string;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPAPICo {
  kind: 'ipapico';
  key?: string;
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
  set: (key: string, value: Object | null) =>
    sessionStorage.setItem(`${PACKAGE.name}-geoip-${key}`, JSON.stringify(value ?? 'null')),
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

  static fromProvider(
    provider: GeoIPProvider,
    throttler?: (fn: (ip: string) => Promise<IPGeo>) => (ip: string) => Promise<IPGeo>
  ) {
    let fn: (ip: string) => Promise<IPGeo>;
    switch (provider.kind) {
      case 'ipinfo':
        fn = (ip: string) => IP2Geo.IPInfo(ip, provider.token);
        break;
      case 'ipsb':
        fn = IP2Geo.IPSB;
        break;
      case 'ipdataco':
        fn = (ip: string) => IP2Geo.IPDataCo(ip, provider.key);
        break;
      case 'ipgeolocation':
        fn = (ip: string) => IP2Geo.IPGeolocation(ip, provider.key);
        break;
      case 'bigdatacloud':
        fn = (ip: string) => IP2Geo.BigDataCloud(ip, provider.key);
        break;
      case 'ipapico':
        fn = IP2Geo.IPAPICo;
        break;
      case 'custom-api':
        fn = (ip: string) => IP2Geo.GenericAPI(provider.url, ip);
        break;
      case 'custom-function':
        fn = undefined as any; // Fix "Variable 'fn' is used before being assigned.""
        // eslint-disable-next-line no-eval
        eval(`fn = ${provider.code}`);
      default:
        throw new SignificantError("GeoIP provider option is unrecognized.");
    }
    // TODO: sanitize API query result

    if (throttler) {
      fn = throttler(fn);
    }

    async function ip2geo(ip: string, noCache = false): Promise<IPGeo> {
      if (isValidIPAddress(ip)) {
        let geo = noCache ? undefined : (Cache.get(ip) as IPGeo);
        if (geo === undefined) {
          try {
            geo = await fn(ip);
          }
          catch (error) {
            if (!(error instanceof UserFriendlyError)) {
              throw new GeoIPResolutionError("The error has been logged in the Debugging Console: " + error.toString(), error);
            } else {
              throw error
            }
          }
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
    const regionFull = regionJoin(city, region, country);
    const [lat, lon] = loc ? loc.split(',').map(parseFloat) : [undefined, undefined];
    const geo = { region: regionFull, label: org, lat, lon };
    return geo;
  }

  static async IPSB(ip: string): Promise<IPGeo> {
    const r = await fetch(`https://api.ip.sb/geoip/${ip}`, { headers: { Accept: 'application/json' } });
    const data = await r.json();
    const { country, region, city, latitude, longitude, isp } = data;
    const regionFull = regionJoin(city, region, country);
    const geo = { region: regionFull, label: isp, lon: longitude, lat: latitude };
    return geo;
  }

  static async IPDataCo(ip: string, key: string): Promise<IPGeo> {
    const r = await fetch(`https://api.ipdata.co/${ip}?api-key=${key}`, { headers: { Accept: 'application/json' } });
    const d = await r.json();
    if (d.ip === undefined) {
      throw new Error(`IPData.co: ${d.message}`);
    }
    const { country_name, region, city, latitude, longitude, asn: network } = d;
    const regionFull = regionJoin(city, region, country_name);
    const label = [network?.asn, network?.name].filter((value) => value).join(' ');
    return { region: regionFull, label: label, lon: longitude, lat: latitude };
  }

  static async IPGeolocation(ip: string, key: string): Promise<IPGeo> {
    const r = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${key}&ip=${ip}`, {
      headers: { Accept: 'application/json' },
    });
    const d = await r.json();
    if (d.ip === undefined) {
      throw new Error(`IPGeolocation.io: ${d.message}`);
    }
    const { country_name, state_prov, city, district, latitude, longitude, isp, organization } = d;
    const regionFull = regionJoin(district, city, state_prov, country_name);
    const label = orgJoin(isp, organization);
    return { region: regionFull, label: label, lon: parseFloat(longitude), lat: parseFloat(latitude) };
  }

  static async BigDataCloud(ip: string, key: string): Promise<IPGeo> {
    const r = await fetch(`https://api.bigdatacloud.net/data/ip-geolocation?key=${key}&ip=${ip}`, {
      headers: { Accept: 'application/json' },
    });
    const d = await r.json();
    if (d.ip === undefined) {
      throw new Error(`BigDataCloud.com: ${d.description}`);
    }
    const { country, location, network } = d;
    const country_name = country?.isoName; // TODO: name / isoName pick shorter
    const state_or_province = location?.isoPrincipalSubdivision;
    const city = location?.city;
    const lat = location?.latitude;
    const lon = location?.longitude;
    const organisation = network?.organisation;
    const asn = network?.carriers?.[0]?.asn;
    // console.log(city, state_or_province, country_name);
    const region = regionJoin(city, state_or_province, country_name);
    const label = eliminatePrefixOrSuffix(organisation, asn).join(' via ');
    // console.log(network, network?.carriers?.[0], organisation, asn, label);
    return { region, label, lon, lat };
  }

  static async IPAPICo(ip: string): Promise<IPGeo> {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, { headers: { Accept: 'application/json' } });
    const d = await r.json();
    if (d.error) {
      throw new Error(`IPAPI.co: ${d.reason} (${d.message})`);
    }
    const { country_name, region, city, latitude, longitude, asn, org } = d;
    const regionFull = regionJoin(city, region, country_name);
    const label = [asn, org].filter((value) => value).join(' ');
    // The free plan IPAPI.co hides location data for some IP ranges, substituing lat/lon with promo message.
    // So if parseInt returns NaN, convert it to undefined as is specified in type annotations.
    let lon, lat;
    try {
      lon = parseFloatChecked(longitude);
      lat = parseFloatChecked(latitude);
    } catch (e) {
      if (e instanceof TypeError) {
        lon = undefined;
        lat = undefined;
      } else {
        throw e;
      }
    }
    return { region: regionFull, label: label, lon, lat };
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
