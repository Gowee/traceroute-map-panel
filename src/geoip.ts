import * as IP from 'ip-address';

// export interface GeoIP {
//     long: Float32Array;
// }

export async function ip2geo(ip: IP.Address4 | IP.Address6): Promise<any> {
  const r = await fetch(`https://ipinfo.io/${ip.toString()}`);
  const d = await r.json();
  return d;
}
