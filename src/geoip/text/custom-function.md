The JavaScript function is expected to match the following signature:

```ts
(ip: string) => Promise<IPGeo>
```

where `IPGeo` is:

```ts
export interface IPGeo {
    region?: string,
    label?: string, // e.g. org or ISP name
    lat?: number,
    lon?: number,
}
```
.

As the function is executed in the browser runtime, external HTTP resources requested by the function should have proper `Access-Control-Allow-Origin` HTTP header set.
