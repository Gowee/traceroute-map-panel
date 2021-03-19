// This script is expected to deploy on Cloudflare Workers (https://workers.cloudflare.com/)

// ! Does NOT WORK anymore due to the deprecation of the target API.  Only kept for reference. To be rewritten. !

addEventListener('fetch', event => {
    event.respondWith(cached(handleRequest)(event))
})

function cached(func) {
    // Ref: https://github.com/cloudflare/template-registry/blob/f2a21ff87a4f9c60ce1d426e9e8d2e6807b786fd/templates/javascript/cache_api.js#L9
    const cache = caches.default;
    async function cachedFunc(event) {
        const request = event.request;
        let response = await cache.match(request);
        if (!response) {
            response = await func(request);
            event.waitUntil(cache.put(request, response.clone()));
        }
        return response;
    }
    return cachedFunc;
}

async function handleRequest(request) {
    const url = new URL(request.url);
    const [, ip] = url.pathname.split("/");
    if (ip.trim() === "") {
        return new Response("");
    }
    const r = await fetch(`https://btapi.ipip.net/host/info?ip=${ip}&host=Router&lang=EN`, { headers: { 'User-Agent': "frosty-waterfall" } });
    const { as, area } = await r.json();
    const [region1, region2, region3, org, isp, lat, lon] = area.split("\t").map(s => s.trim());
    const geo = {
        ip: ip,
        label: [as, isp, org].filter(s => s.length !== 0).join(" "),
        region: [region1, region2, region3].join(" "),
        lat: lat ? parseFloat(lat) : undefined,
        lon: lat ? parseFloat(lon) : undefined,
        _time: (new Date()).toString()
    };
    return new Response(JSON.stringify(geo), { status: 200, headers: { 'Content-Type': "application/json; charset=UTF-8", 'Access-Control-Allow-Origin': "*", 'Cache-Control': "max-age=1296000" } });
}
