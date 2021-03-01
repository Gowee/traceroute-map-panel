import { PanelPlugin } from '@grafana/data';
import { TracerouteMapOptions /*, defaults*/ } from './types';
import { TracerouteMapPanel } from './TracerouteMapPanel';
import { GeoIPProvidersEditor } from './GeoIPProvidersEditor';

export const plugin = new PanelPlugin<TracerouteMapOptions>(TracerouteMapPanel).setPanelOptions((builder) => {
  return builder
    .addBooleanSwitch({
      path: 'longitude360',
      name: 'Wrap Longitude to [0°, 360°)',
      description: "So that it won't lay within [-180°, 0°)",
      defaultValue: false,
    })
    .addSliderInput({
      path: 'mapClusterRadius',
      name: 'Map Point Cluster Radius',
      description: 'The radius within which points on the map will be unified as one',
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
      name: 'Requests Per Second',
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
});
