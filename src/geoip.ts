// import LRUCache from 'lru-cache';

// candidante cache providers:
// SessionStorage
// LocalStorage
// IndexDB

export interface IPGeo {
  region: string,
  net: string,
  lat: number,
  lon: number,
  bogon: boolean,
}

// const cache = new LRUCache({ max: 1024, maxAge: 8 * 60 * 60 * 1000 });
const cache = {
  get: (key: string) => JSON.parse(sessionStorage.getItem(key) || "null") || undefined,
  set: (key: string, value: IPGeo) => sessionStorage.setItem(key, JSON.stringify(value))
};

export async function ip2geo(ip: string): Promise<IPGeo> {
  let geo = <IPGeo>cache.get(ip);
  if (geo === undefined) {
    if (ip !== "???") {
      const r = await fetch(`https://ipinfo.io/${ip}/json?token=REDACTED`, {
        headers: {
          'Accept': 'application/json'
        },
      });
      const data = await r.json();
      if (!data.bogon) {
        const { country, city, region, loc, org } = data;
        const region_city = city.indexOf(region) === -1 ? `${country} ${city} ${region}` : city;
        const [lat, lon] = loc.split(",").map(parseFloat);
        geo = { region: region_city, net: org, lat, lon, bogon: false };
      }
    }
    if (geo === undefined) {
      geo = { region: "", net: "", lon: 0, lat: 0, bogon: true };
    }
    cache.set(ip, geo);
  }
  return geo;
}
