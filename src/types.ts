import { IPSB, IPInfo, CustomAPI, CustomFunction, GeoIPProviderKind } from './geoip';

export interface TracerouteMapOptions {
  geoIPProviders: {
    active: GeoIPProviderKind;
    ipsb: IPSB;
    ipinfo: IPInfo;
    'custom-api': CustomAPI;
    'custom-function': CustomFunction;
  };
}

export const defaults: TracerouteMapOptions = {
  geoIPProviders: {
    active: 'ipsb',
    ...(Object.fromEntries(['ipsb', 'ipinfo', 'custom-api', 'custom-function'].map(p => [p, { kind: p }])) as any),
  },
};
