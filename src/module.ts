import { PanelPlugin } from '@grafana/data';
import { TracerouteMapOptions /*, defaults*/ } from './types';
import { TracerouteMapPanel } from './TracerouteMapPanel';
import { GeoIPProvidersEditor } from './GeoIPProvidersEditor';

export const plugin = new PanelPlugin<TracerouteMapOptions>(TracerouteMapPanel).setPanelOptions((builder) => {
  return (
    builder
      .addBooleanSwitch({
        path: 'longitude360',
        name: 'Wrap Longitude to [0°, 360°)',
        description: "So that it won't lay within [-180°, 0°)",
        defaultValue: false,
      })
      .addSliderInput({
        path: 'mapClusterRadius',
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
      // .addSelect({
      //   path: 'geoIPProviders.active',
      //   name: 'GeoIP Service Provider',
      //   description: 'Dummy',
      //   defaultValue: 'ipsb',
      //   settings: {
      //     options: [
      //       { label: 'IPInfo.io', value: 'ipinfo', description: 'API provided by IPInfo.io.' },
      //       {
      //         label: 'IP.sb (MaxMind GeoLite2)',
      //         value: 'ipsb',
      //         description: "IP.sb free API, backed by MaxMind's GeoLite2 database.",
      //       },
      //       { label: 'Custom API', value: 'custom-api', description: 'Custom API defined by a URL' },
      //       { label: 'Custom function', value: 'custom-function', description: 'Custom JavaScript function.' },
      //     ],
      //   },
      // })
      // .addTextInput({
      //   path: 'geoIPProviders.ipinfo.token',
      //   name: 'Access Token',
      //   description: 'optional',
      //   settings: { pendingplaceholder: 'Usually in the form 0a1b2c3d4e5f6e7d' },
      //   showIf: (currentOptions) => {
      //     return currentOptions.geoIPProviders.active === 'ipinfo';
      //   },
      // })
      // .addTextInput({
      //   path: 'geoIPProviders.custom-api.url',
      //   name: 'API URL',
      //   description: 'TODO TODO Valid CORS header is expected. <code>{IP}</code> will be substituted to the queried IP.',
      //   settings: { pendingplaceholder: 'e.g. https://ipinfo.io/{IP}' },
      //   showIf: (currentOptions) => {
      //     return currentOptions.geoIPProviders.active === 'custom-api';
      //   },
      // })
      // .addTextInput({
      //   path: 'geoIPProviders.custom-function.code',
      //   name: 'Code',
      //   description: 'TODO',
      //   settings: {
      //     pendingplaceholder: 'e.g. https://ipinfo.io/{IP}',
      //     useTextarea: true,
      //     rows: 15,
      //     placeholder: CodeSnippets.ip2geoFunction,
      //   },
      //   showIf: (currentOptions) => {
      //     return currentOptions.geoIPProviders.active === 'custom-function';
      //   },
      // })
      // .addCustomEditor({
      //   id: 'geoIPProvidersEditor',
      //   path: 'geoIPProviders',
      //   name: "",
      //   category: ['GeoIP Service'],
      //   defaultValue: GeoIPProvidersEditor.defaultValue,
      //   editor: GeoIPProvidersEditor,
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
        category: ['GeoIP Service']
      })
      .addSliderInput({
        path: 'requestsPerSecond',
        name: 'Requests Per Second',
        defaultValue: 7,
        settings: { 
          min: 1,
          max: 30
        },
        category: ['GeoIP Service'],
        showIf: (currentOptions) => currentOptions.parallelizeGeoIP === true
      })
      .addSliderInput({
        path: 'concurrentRequests',
        name: 'Maximum Number of Connecurent Requests',
        defaultValue: 5,
        settings: { 
          min: 1,
          max: 15
        },
        category: ['GeoIP Service'],
        showIf: (currentOptions) => currentOptions.parallelizeGeoIP === true
      })
  );
});
