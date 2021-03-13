import { PanelOptionsEditorBuilder } from '@grafana/data';

import GeoIPProvidersEditor, { GeoIPProvidersOption } from './geoip/Editor';

// undefined will be treated as defaultValue, so it can only be used for the default option
export type LongitudeWrapping = undefined | 'primeMeridian' | 'antimeridian';
export type HopLabelType = 'label' | 'ip' | 'ipAndLabel';

export interface TracerouteMapOptions {
  geoIPProviders: GeoIPProvidersOption;
  longitudeWrapping: LongitudeWrapping;
  mapClusterRadius: number;
  hostnameLabelWidth: number; // in em
  simplifyHostname: boolean;
  parallelizeGeoIP: boolean;
  concurrentRequests: number;
  requestsPerSecond: number;
  srcHostAsZerothHop: boolean;
  hopLabelType: HopLabelType;
  showSearchIconInHopLabel: boolean;
  bogonFilteringSpace: 'none' | 'bogon' | 'extendedBogon';
  pathSpline: undefined | 'spline1' | 'spline2';
  pathLineStyle: 'solid' | 'dashed' | 'antPath';
  pathAnimationSpeedFactor: number;
  // disableTimeRangeLimit: boolean;
}

export const buildOptionsEditor = (builder: PanelOptionsEditorBuilder<TracerouteMapOptions>) =>
  builder
    .addRadio({
      path: 'longitudeWrapping',
      name: 'Wrap Longitude around Meridians',
      description: 'Prevent route paths from crossing meridians',
      defaultValue: undefined as LongitudeWrapping,
      settings: {
        options: [
          { label: 'None', value: undefined, description: 'No wrapping' },
          {
            label: 'Prime (0°)',
            value: 'primeMeridian',
            description: "Longtitude won't cross the prime meridian.",
          },
          {
            label: '180° (anti)',
            value: 'antimeridian',
            description: "Longtitude won't cross the opposite meridian.",
          },
        ],
      },
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
      name: 'Path Line Type 🆕',
      description: 'Apply polyline/spline to traceroute paths',
      defaultValue: undefined as any,
      settings: {
        options: [
          { label: 'Polyline', value: undefined, description: 'Plain polyline' },
          // { label: 'Spline', value: 'spline', description: 'Smoothed spline' },
          { label: 'Spline 1', value: 'spline1', description: 'Smoothed spline with flux animation' },
          {
            label: 'Spline 2',
            value: 'spline2',
            description: 'Smoothed spline with flux animation, another implementation',
          },
        ],
      },
    })
    .addRadio({
      path: 'pathLineStyle',
      name: 'Path Line Style 🆕',
      description: 'Apply styles to traceroute paths',
      defaultValue: 'solid',
      settings: {
        options: [
          { label: 'Solid', value: 'solid', description: 'Solid line' },
          { label: 'Dashed', value: 'dashed', description: 'Dashed line with animation' },
          {
            label: 'Ant Path',
            value: 'antPath',
            description: 'Ant Path with animation',
          },
        ],
      },
      showIf: (currentOptions) => currentOptions.pathSpline !== undefined,
    })
    .addSliderInput({
      path: 'pathAnimationSpeedFactor',
      name: 'Animation Speed Factor',
      description: 'Used to control the speed of line animations',
      defaultValue: 1,
      settings: {
        min: 0.2,
        max: 5,
        step: 0.1,
      },
      showIf: (currentOptions) =>
        currentOptions.pathSpline !== undefined && ['dashed', 'antPath'].includes(currentOptions.pathLineStyle),
    })
    // .addBooleanSwitch({
    //   path: 'disableTimeRangeLimit',
    //   name: 'Disable Time Range Limit',
    //   description: 'Which prevent loading too much data accidentally',
    //   defaultValue: true,
    // })
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
    })
    .addSelect({
      path: 'bogonFilteringSpace',
      name: 'Bogon Filtering Space' /* Filter Out "Bogus" IPs */,
      description: 'Proactively filter out IPs in Bogon Space',
      defaultValue: 'bogon',
      settings: {
        options: [
          { label: 'None', value: 'none', description: 'Pass all IPs to GeoIP API without filtering' },
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
    });
