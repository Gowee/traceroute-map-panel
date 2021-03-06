import { PanelOptionsEditorBuilder } from '@grafana/data';

import GeoIPProvidersEditor, { GeoIPProvidersOption } from './geoip/Editor';

export type HopLabelType = 'label' | 'ip' | 'ipAndLabel';

export interface TracerouteMapOptions {
  geoIPProviders: GeoIPProvidersOption;
  longitude360: boolean;
  mapClusterRadius: number;
  hostnameLabelWidth: number; // in em
  simplifyHostname: boolean;
  parallelizeGeoIP: boolean;
  concurrentRequests: number;
  requestsPerSecond: number;
  srcHostAsZerothHop: boolean;
  hopLabelType: HopLabelType;
  showSearchIconInHopLabel: boolean;
  bogonFilteringSpace: undefined | 'bogon' | 'extendedBogon';
  pathSpline: undefined | 'spline' | 'animatedSpline';
}

export const buildOptionsEditor = (builder: PanelOptionsEditorBuilder<TracerouteMapOptions>) =>
  builder
    .addBooleanSwitch({
      path: 'longitude360',
      name: 'Wrap Longitude to [0°, 360°)',
      description: "So that it won't lay within [-180°, 0°)",
      defaultValue: false,
    })
    .addSliderInput({
      path: 'mapClusterRadius',
      name: 'Map Point Cluster Radius (px)',
      description: 'The radius within which points will be unified as one on the map',
      defaultValue: 8,
      settings: {
        min: 0,
        max: 50,
      },
    })
    .addSliderInput({
      path: 'hostnameLabelWidth',
      name: 'Hostname Label Width (em)',
      description: 'The width of hostnames in the bottom-left list',
      defaultValue: 8,
      settings: {
        min: 2,
        max: 12,
      },
    })
    .addBooleanSwitch({
      path: 'simplifyHostname',
      name: 'Show Simplified Hostname',
      description: 'Truncate the FQDN to keep only the left-most hostname',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'srcHostAsZerothHop',
      name: 'Treat Source Host as 0-th Hop',
      description: 'Try to resovle the src hostname as the IP of the 0-th hop',
      defaultValue: true,
    })
    .addRadio({
      path: 'hopLabelType',
      name: 'Hop Label Content',
      description: 'The label contents of hops in popups of point markers',
      defaultValue: 'ipAndLabel',
      settings: {
        options: [
          { label: 'Label', value: 'label', description: 'Shows oranization/network labels from GeoIP only' },
          { label: 'IP', value: 'ip', description: 'Shows IP addresses only' },
          { label: 'Both', value: 'ipAndLabel', description: 'Show both IP addresses and geo labels' },
        ],
      },
    })
    .addBooleanSwitch({
      path: 'showSearchIconInHopLabel',
      name: 'Show Search Icon for IP',
      description: 'Show a search button for every IP address in hop labels',
      defaultValue: true,
    })
    .addRadio({
      path: 'pathSpline',
      name: 'Route Line Type 🆕',
      description: 'Apply polyline/spline to traceroute paths',
      defaultValue: undefined as any,
      settings: {
        options: [
          { label: 'Polyline', value: undefined, description: 'Plain polyline' },
          { label: 'Spline', value: 'spline', description: 'Smoothed spline' },
          { label: 'Animated Spline', value: 'animatedSpline', description: 'Smoothed spline with flux animation' },
        ],
      },
    })
    .addCustomEditor({
      id: 'geoIPProviders',
      path: 'geoIPProviders',
      name: 'Provider',
      editor: GeoIPProvidersEditor,
      defaultValue: GeoIPProvidersEditor.defaultValue,
      category: ['GeoIP Service'],
    })
    .addSelect({
      path: 'bogonFilteringSpace',
      name: 'Bogon Filtering Space' /* Filter Out "Bogus" IPs */,
      description: 'Proactively filter out IPs in Bogon Space',
      defaultValue: 'bogon',
      settings: {
        options: [
          { label: 'None', value: undefined, description: 'Pass all IPs to GeoIP API without filtering' },
          {
            label: 'Bogon (private + reserved)',
            value: 'bogon',
            description: 'Exclude private or reserved IPs like 10/8',
          },
          {
            label: 'Bogon + DoD',
            value: 'extendedBogon',
            description: 'In addition to Bogon, exclude some DoD IPs like 11/8',
          },
        ],
      },
      category: ['GeoIP Service'],
    })
    .addBooleanSwitch({
      path: 'parallelizeGeoIP',
      name: 'Parallelize GeoIP resolution',
      description: 'Make GeoIP resolution concurrently with rate-limiting',
      defaultValue: true,
      category: ['GeoIP Service'],
    })
    .addSliderInput({
      path: 'requestsPerSecond',
      name: 'Maximum Number of Requests per Second',
      defaultValue: 7,
      settings: {
        min: 1,
        max: 30,
      },
      category: ['GeoIP Service'],
      showIf: (currentOptions) => currentOptions.parallelizeGeoIP === true,
    })
    .addSliderInput({
      path: 'concurrentRequests',
      name: 'Maximum Number of Connecurent Requests',
      defaultValue: 5,
      settings: {
        min: 1,
        max: 15,
      },
      category: ['GeoIP Service'],
      showIf: (currentOptions) => currentOptions.parallelizeGeoIP === true,
    });
