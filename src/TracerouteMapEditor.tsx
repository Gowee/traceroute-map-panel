import React, { PureComponent, ChangeEvent } from 'react';
import { Forms, Slider } from '@grafana/ui';
import { PanelEditorProps, SelectableValue } from '@grafana/data';

import { TracerouteMapOptions } from './types';
import { GeoIPProviderKind, GeoIPProvider, IPInfo, CustomAPI, IP2Geo, CustomFunction } from './geoip';
import { CodeSnippets, timeout } from './utils';

interface Props extends PanelEditorProps<TracerouteMapOptions> {}

interface State {
  geoIPProvider: GeoIPProvider;
  test: { pending: boolean; title?: string; output?: string };
}

export class TracerouteMapEditor extends PureComponent<PanelEditorProps<TracerouteMapOptions>, State> {
  constructor(props: Props) {
    super(props);
    const options = this.props.options;
    this.state = {
      geoIPProvider: options.geoIPProviders[options.geoIPProviders.active],
      test: { pending: false },
    };
    this.handleGeoIPProviderChange = this.handleGeoIPProviderChange.bind(this);
    this.handleTestAndSave = this.handleTestAndSave.bind(this);
    this.handleClearGeoIPCache = this.handleClearGeoIPCache.bind(this);
    this.handleLongitude360Switched = this.handleLongitude360Switched.bind(this);
  }

  handleGeoIPProviderSelected = (option: SelectableValue<GeoIPProviderKind>) => {
    this.setState({ geoIPProvider: this.props.options.geoIPProviders[option.value ?? 'ipsb'], test: { pending: false } });
  };

  handleGeoIPProviderChange(provider: GeoIPProvider) {
    this.setState({ geoIPProvider: provider });
  }

  async handleTestAndSave() {
    const provider = this.state.geoIPProvider;
    this.setState({ test: { pending: true, title: 'Testing...', output: '' } });
    let geo;
    let error;
    try {
      const ip2geo = IP2Geo.fromProvider(provider);
      geo = await timeout(ip2geo('1.2.4.8', true), 8000);
    } catch (e) {
      error = e;
    }
    this.setState({
      test: {
        pending: false,
        title: error ? '❌ Failed' : '✅ Done',
        output: error ? error.stack.toString() || error.toString() : JSON.stringify(geo, null, 4),
      },
    });
    if (!error) {
      const providers = { ...this.props.options.geoIPProviders, active: provider.kind };
      providers[provider.kind] = provider as any;
      this.props.onOptionsChange({ ...this.props.options, geoIPProviders: providers });
    }
  }

  handleClearGeoIPCache() {
    if (
      confirm(
        "Clear all the GeoIP cache now?\n\nNote: This won't trigger refreshing the panel.\nBy default, cache are stored in sesseionStorage which is cleaned up when the browser session ends."
      )
    ) {
      const count = IP2Geo.clearCache();
      alert(`${count} entries cleaned.`);
    }
  }

  handleLongitude360Switched(value: boolean) {
    this.props.onOptionsChange({ ...this.props.options, longitude360: value });
  }

  handleMapClusterRadius(value: number) {
    this.props.onOptionsChange({ ...this.props.options, mapClusterRadius: value });
  }

  render() {
    const options = this.props.options;

    return (
      <div className="traceroute-map-editor">
        <div className="section gf-form-group">
          <h5 className="section-header">General</h5>
          <div style={{ width: 300 }}>
            <Forms.Field label="Wrap longitude to [0°, 360°)" description="So that it won't lay within [-180°, 0°)">
              <Forms.Switch
                checked={options.longitude360}
                onChange={event => this.handleLongitude360Switched(event?.currentTarget.checked ?? false)}
              />
            </Forms.Field>
            <Forms.Field label="Cluster Radius" description="Merge close points within a radius into one circle">
              <Slider min={5} max={50} value={[this.props.options.mapClusterRadius]} onChange={value => this.handleMapClusterRadius(value[0])} />
            </Forms.Field>
            <Forms.Field label="Note">
              <span>Some options won't take effect until the panel/page is refreshed.</span>
            </Forms.Field>
          </div>
        </div>
        <div className="section gf-form-group">
          <h5 className="section-header">GeoIP</h5>
          <div style={{ width: 400 }}>
            <Forms.Field label="Provider">
              <Forms.Select options={geoIPOptions} value={this.state.geoIPProvider.kind} onChange={this.handleGeoIPProviderSelected} />
            </Forms.Field>
            {(() => {
              switch (this.state.geoIPProvider.kind) {
                case 'ipinfo':
                  return <IPInfoConfig onChange={this.handleGeoIPProviderChange} config={this.state.geoIPProvider} />;
                case 'ipsb':
                  return <IPSBConfig />;
                case 'custom-api':
                  return <CustomAPIConfig onChange={this.handleGeoIPProviderChange} config={this.state.geoIPProvider} />;
                case 'custom-function':
                  return <CustomFunctionConfig onChange={this.handleGeoIPProviderChange} config={this.state.geoIPProvider} />;
              }
            })()}
          </div>
          <Forms.Field>
            <>
              <Forms.Button icon={this.state.test.pending ? 'fa fa-spinner fa-spin' : undefined} onClick={this.handleTestAndSave}>
                Test and Save
              </Forms.Button>
              <span style={{ marginLeft: '0.5em', marginRight: '0.5em' }}></span>
              <Forms.Button variant="secondary" onClick={this.handleClearGeoIPCache}>
                Clear Cache
              </Forms.Button>
            </>
          </Forms.Field>

          {this.state.test.title ? (
            <Forms.Field label="">
              <>
                <span style={{ fontWeight: 'bold' }}>{this.state.test.title}</span>
                <pre>
                  <code>{this.state.test.output}</code>
                </pre>
              </>
            </Forms.Field>
          ) : (
            <></>
          )}
        </div>
      </div>
    );
  }
}

const geoIPOptions: Array<SelectableValue<GeoIPProviderKind>> = [
  { label: 'IPInfo.io', value: 'ipinfo', description: 'API provided by IPInfo.io.' },
  { label: 'IP.sb (MaxMind GeoLite2)', value: 'ipsb', description: "IP.sb free API, backed by MaxMind's GeoLite2 database." },
  { label: 'Custom API', value: 'custom-api', description: 'Custom API defined by a URL' },
  { label: 'Custom function', value: 'custom-function', description: 'Custom JavaScript function.' },
];

const IPSBConfig: React.FC = () => {
  return (
    <Forms.Field label="Note">
      <span>
        <a href="https://ip.sb/api/">IP.sb</a> provides with free IP-to-GeoLocation API without registration. Their data comes from{' '}
        <a href="https://www.maxmind.com/">MaxMind</a>'s GeoLite2 database (<a href="https://github.com/fcambus/telize">telize</a>), which is
        inaccurate sometimes.
      </span>
    </Forms.Field>
  );
};

const IPInfoConfig: React.FC<{ config: IPInfo; onChange: (config: IPInfo) => void }> = ({ config, onChange }) => {
  return (
    <>
      <Forms.Field label="Access Token" description="optional">
        <Forms.Input
          type="text"
          value={config.token}
          placeholder="Usually in the form 0a1b2c3d4e5f6e7d"
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...config, token: event.target.value })}
        />
      </Forms.Field>
      <Forms.Field label="Note">
        <span>
          <a href="https://IPInfo.io">IPInfo.io</a> is generally more accurate compared to MaxMind's GeoLite2 database. The API access token is
          optional, but requests without token is rate-limited. After registration, their free plan provides with 50k lookups per month.
        </span>
      </Forms.Field>
    </>
  );
};

const CustomAPIConfig: React.FC<{ config: CustomAPI; onChange: (config: CustomAPI) => void }> = ({ config, onChange }) => {
  return (
    <>
      <Forms.Field label="API URL">
        <Forms.Input
          type="text"
          value={config.url}
          placeholder="e.g. https://example.org/geoip/{IP}"
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...config, url: event.target.value })}
        />
      </Forms.Field>
      <Forms.Field label="Note">
        <>
          <p>
            <code>{'{IP}'}</code> in the URL will replaced to the actual IP address.
          </p>
          <p>
            The API is expected to return data matching the interface:
            <pre>
              <code>{CodeSnippets.ipgeoInterface}</code>
            </pre>
            with <code>Content-Type: application/json</code> and proper <code>Access-Control-Allow-Origin</code> HTTP header set.
          </p>
          <p>
            <strong>Example</strong>: <a href="https://github.com/Gowee/traceroute-map-panel/blob/master/ipip-cfworker.js">ipip-cfworker.js</a>
          </p>
        </>
      </Forms.Field>
    </>
  );
};

const CustomFunctionConfig: React.FC<{ config: CustomFunction; onChange: (config: CustomFunction) => void }> = ({ config, onChange }) => {
  return (
    <>
      <Forms.Field label="Code">
        <Forms.TextArea
          value={config.code}
          rows={15}
          placeholder={CodeSnippets.ip2geoFunction}
          style={{ fontFamily: 'monospace' }}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange({ ...config, code: event.target.value })}
        />
      </Forms.Field>
      <Forms.Field label="Note">
        <p>
          The JavaScript function is expected to match the signature:
          <pre>
            <code>{CodeSnippets.ip2geoSignature}</code>
          </pre>
          where <code>IPGeo</code> is:
          <pre>
            <code>{CodeSnippets.ipgeoInterface}</code>
          </pre>
        </p>
      </Forms.Field>
    </>
  );
};

// TODO: use reflection to unify types?

// const Link： React.FC< { url: string } = (url: string) => {
//   return <a href={url}></a>
// };
