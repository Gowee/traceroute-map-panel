import ipAddress from 'ip-address';

import { PACKAGE } from './utils';

// candidante cache providers:
// SessionStorage
// LocalStorage
// IndexDB

export type GeoIPProvider = IPInfo | IPSB | CustomAPI | CustomFunction;
export type GeoIPProviderKind = 'ipinfo' | 'ipsb' | 'custom-api' | 'custom-function';

export interface IPInfo {
  kind: 'ipinfo';
  token?: string;
}

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

export interface IPGeo {
  region?: string;
  label?: string;
  lat?: number;
  lon?: number;
}

// const cache = new LRUCache({ max: 1024, maxAge: 8 * 60 * 60 * 1000 });
const cache = {
  get: (key: string) => JSON.parse(sessionStorage.getItem(`${PACKAGE.NAME}-geoip-${key}`) ?? 'null') ?? undefined,
  set: (key: string, value: IPGeo) => sessionStorage.setItem(`${PACKAGE.NAME}-geoip-${key}`, JSON.stringify(value)),
};

export namespace IP2Geo {
  export const defaultProvider: GeoIPProvider = { kind: 'ipsb' } as IPSB;

  export function fromProvider(provider: GeoIPProvider) {
    let fn: (ip: string) => Promise<IPGeo>;
    switch (provider.kind) {
      case 'ipinfo':
        fn = (ip: string) => IPInfo(ip, provider.token);
        break;
      case 'ipsb':
        fn = IPSB;
        break;
      case 'custom-api':
        fn = (ip: string) => GenericAPI(provider.url, ip);
        break;
      default:
        /* case 'custom-function': */
        eval(`fn = ${provider.code}`);
    }
    // TODO: sanitize API query result

    async function ip2geo(ip: string, noCache = false): Promise<IPGeo> {
      console.log(ip, isValidIPAddress(ip));
      if (isValidIPAddress(ip)) {
        let geo = noCache ? undefined : (cache.get(ip) as IPGeo);
        if (geo === undefined) {
          geo = await fn(ip);
          cache.set(ip, geo);
        }
        console.log('geo', geo);
        return geo;
      }
      return {};
    }
    return ip2geo;
  }

  export async function IPInfo(ip: string, token?: string): Promise<IPGeo> {
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
    const region_city = city ? `${city.indexOf(region) === -1 ? `${city}, ${region}` : city}, ${country}` : undefined;
    const [lat, lon] = loc.split(',').map(parseFloat);
    const geo = { region: region_city, label: org, lat, lon };
    return geo;
  }

  export async function IPSB(ip: string): Promise<IPGeo> {
    const r = await fetch(`https://api.ip.sb/geoip/${ip}`, { headers: { Accept: 'application/json' } });
    const data = await r.json();
    const { country, latitude, longitude, isp } = data;
    const geo = { region: country, label: isp, lon: longitude, lat: latitude };
    return geo;
  }

  export async function GenericAPI(url: string, ip: string): Promise<IPGeo> {
    console.log(url);
    const r = await fetch(url.replace('{IP}', ip), { headers: { Accept: 'application/json' } });
    console.log(url.replace('{IP}', ip));
    const data = await r.json();
    console.log(data);
    return data;
  }
}

function isValidIPAddress(ip: string) {
  const ipv4 = new ipAddress.Address4(ip);
  const ipv6 = new ipAddress.Address6(ip);
  return ipv4.valid || ipv6.valid;
}
