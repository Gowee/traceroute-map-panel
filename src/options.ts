import { PanelOptionsEditorBuilder } from '@grafana/data';

import { IPSB, IPInfo, CustomAPI, CustomFunction, GeoIPProviderKind } from './geoip';
import { GeoIPProvidersEditor, GeoIPProvidersOption } from './GeoIPProvidersEditor';

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
        min: 5,
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
    .addSelect({
      path: 'hopLabelType',
      name: 'Hop Label Content',
      description: 'The label contents of hops in popups of point markers',
      defaultValue: 'ipAndLabel',
      settings: {
        options: [
          { label: 'Label only', value: 'label', description: 'Shows oranization/network labels from GeoIP only' },
          { label: 'IP only', value: 'ip', description: 'Shows IP addresses only' },
          { label: 'Both IP and Label', value: 'ipAndLabel', description: 'Show both IP addresses and geo labels' },
        ],
      },
    })
    .addBooleanSwitch({
      path: 'showSearchIconInHopLabel',
      name: 'Show Search Icon for IP',
      description: 'Show a search button for every IP address in hop labels',
      defaultValue: true,
    })
    .addCustomEditor({
      id: 'geoIPProviders',
      path: 'geoIPProviders',
      name: 'Provider',
      editor: GeoIPProvidersEditor,
      defaultValue: GeoIPProvidersEditor.defaultValue,
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
