import { IPSB, IPInfo, CustomAPI, CustomFunction, GeoIPProviderKind } from './geoip';

export interface TracerouteMapOptions {
  geoIPProviders: {
    active: GeoIPProviderKind;
    ipsb: IPSB;
    ipinfo: IPInfo;
    'custom-api': CustomAPI;
    'custom-function': CustomFunction;
  };
  longitude360: boolean;
  mapClusterRadius: number;
  // in em
  hostnameLabelWidth: number;
  // showSrcHostname: boolean;
  // showDestHostname: boolean;
  simplifyHostname: boolean;
}

export const defaults: TracerouteMapOptions = {
  geoIPProviders: {
    active: 'ipsb',
    ...(Object.fromEntries(['ipsb', 'ipinfo', 'custom-api', 'custom-function'].map(p => [p, { kind: p }])) as any),
  },
  longitude360: false,
  mapClusterRadius: 15,
  hostnameLabelWidth: 8,
  // showSrcHostname: true,
  // showDestHostname: true,
  simplifyHostname: false,
};
