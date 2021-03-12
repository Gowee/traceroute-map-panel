// DNS-over-HTTPS-related utils

import { Cache as GeoIPCache } from '../geoip/api';

import { isValidIPAddress, constructQueryParams } from './index';

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
  for (const ans of body?.Answer ?? []) {
    // Answer might contain additional data, such as CNAME when questioning A.
    if (ans?.type === body?.Question[0]?.type) {
      return ans?.data ?? null;
    }
  }
  return null;
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
