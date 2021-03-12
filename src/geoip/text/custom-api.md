`{IP}` in the URL will substituted to the target IP address when querying.

The API is expected to return JSON data matching the following interface:

```ts
export interface IPGeo {
    region?: string,
    label?: string, // e.g. ASN or org name
    lat?: number,
    lon?: number,
}
```

with `Content-Type: application/json` and proper `Access-Control-Allow-Origin` HTTP header set.

**Example**: [ipip-cfworker.js](https://github.com/Gowee/traceroute-map-panel/blob/master/ipip-cfworker.js)
