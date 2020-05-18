<!--[![CircleCI](https://circleci.com/gh/grafana/simple-react-panel.svg?style=svg)](https://circleci.com/gh/grafana/simple-react-panel)
[![David Dependency Status](https://david-dm.org/grafana/simple-react-panel.svg)](https://david-dm.org/grafana/simple-react-panel)
[![David Dev Dependency Status](https://david-dm.org/grafana/simple-react-panel/dev-status.svg)](https://david-dm.org/grafana/simple-react-panel/?type=dev)
[![Known Vulnerabilities](https://snyk.io/test/github/grafana/simple-react-panel/badge.svg)](https://snyk.io/test/github/grafana/simple-react-panel)
[![Maintainability](https://api.codeclimate.com/v1/badges/1dee2585eb412f913cbb/maintainability)](https://codeclimate.com/github/grafana/simple-react-panel/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/1dee2585eb412f913cbb/test_coverage)](https://codeclimate.com/github/grafana/simple-react-panel/test_coverage)-->
# Traceroute Map Panel
Traceroute Map Panel is a Grafana panel that visualize the traceroute hops in a map, just like [Besttrace](https://www.ipip.net/product/client.html).

## Data
Currently, Traceroute Map Panel is only expected to work with traceroute data collected from [MTR](https://github.com/traviscross/mtr/) via [Telegraf](https://github.com/influxdata/telegraf) and stored in [InfluxDB](https://github.com/influxdata/influxdb).

Telegraf's wiki has [a sample config](https://github.com/influxdata/telegraf/wiki/Traceroute) utilizing the built-in [`[[inputs.exec]]`](https://github.com/influxdata/telegraf/tree/master/plugins/inputs/exec) for this.

### Query
#### Preview via the CLi tool of InfluxDB
```sql
select hop, ip, rtt, loss from (select mean(avg) as rtt, mean(loss) as loss from mtr WHERE now() - 6h < time AND time < now() group by hop, ip, host, dest) group by host, dest
```

#### Query in Grafana
```sql
select mean(avg) as rtt, mean(loss) as loss from mtr WHERE $timeFilter group by hop, ip, host, dest
```
& *Format as __Table__*.

## Geo IP
This panel relys on external API service for Geo IP resolving. 

The panel ships with two built-in Geo IP service providers: [IP.sb](https://ip.sb) and [IPInfo.io](https://ipinfo.io). The former is free all the time while inaccurate sometimes as it is backed by MaxMind's GeoLite2 database. The latter is a little more accurate in general while rate-limited without API token.

An alternative way is custom API or custom function as long as the target API has proper [CORS header](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) set. A sample [Cloudflare Worker](https://workers.cloudflare.com/) script that proxies requests to some third-party service is located in [ipip-cfworker.js](./ipip-cfworker.js).

## Setup 
1. Install & Configure Telegraf and InfluxDB properly.
2. See [Telegraf's wiki](https://github.com/influxdata/telegraf/wiki/Traceroute) to configure MTR data collection as an input.
3. Explore database via the `influx` CLi tool, so that to make sure data is collected as expected. See [the query section](./#Preview via the CLi tool of InfluxDB).
4. Install the Traceroute Map Panel plugin to Grafana. (How?: TODO)
5. Create a new panel in Grafana:
- 1. Choose visualization "Traceroute Map Panel"
- 2. In query editor, toggle the text edit mode by clicking the pen icon and enter the query. See [the query section](#Query in Grafana).
- 3. At the bottom of the edtior, choose *FORMAT AS Table* instead of *Time Series*.
