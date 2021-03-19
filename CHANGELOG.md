# Change Log

All notable changes to this project will be documented in this file.

## 0.3.0 (Mar 19, 2021)
- Refactor the option editor to be compatible with Grafana 7.x API. ([#4](https://github.com/Gowee/traceroute-map-panel/issues/4))
- Introduce a bunch of new 3rd-party GeoIP APIs.
- Add an option to enable concurrent GeoIP resolution with rate-limiting.
- Add an option to filter out IPs in [Bogon Space](https://en.wikipedia.org/wiki/Bogon_Filtering) proactively.
- Support to draw routes as bezier spline, with several implementations ([1](https://github.com/freder/bezier-spline), [2](https://github.com/Zunawe/bezier-spline), and [3](https://medium.com/@francoisromain/smooth-a-svg-path-with-cubic-bezier-curves-e37b49d46c74))
- Try to treat source hosts as "zeroth" hops by resolving their hostnames as IPs. It would be useful when tunnels exist.
- Improve the UI and content of point popups.
- Improve error indicator. For example, now empty data won't trigger red error warning.

## 0.2.x
...

## v0.0.0

Initial Release
