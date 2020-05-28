import React, { PureComponent, ChangeEvent } from 'react';
import { Slider, Field, Button, TextArea, Select, Input, Switch } from '@grafana/ui';
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
    this.handleHostnameLabelWidthChange = this.handleHostnameLabelWidthChange.bind(this);
    this.handleSimplifyHostnameChange = this.handleSimplifyHostnameChange.bind(this);
  }

  handleGeoIPProviderSelected = (option: SelectableValue<GeoIPProviderKind>) => {
    this.setState({
      geoIPProvider: this.props.options.geoIPProviders[option.value ?? 'ipsb'],
      test: { pending: false },
    });
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

  handleMapClusterRadiusChange(value: number) {
    this.props.onOptionsChange({ ...this.props.options, mapClusterRadius: value });
  }

  handleHostnameLabelWidthChange(value: number) {
    this.props.onOptionsChange({ ...this.props.options, hostnameLabelWidth: value });
  }

  handleSimplifyHostnameChange(value: boolean) {
    this.props.onOptionsChange({ ...this.props.options, simplifyHostname: value });
  }

  render() {
    const options = this.props.options;

    return (
      <div className="traceroute-map-editor">
        <div className="section gf-form-group">
          <h5 className="section-header">General</h5>
          <div style={{ width: 300 }}>
            <Field label="Wrap Longitude to [0°, 360°)" description="So that it won't lay within [-180°, 0°)">
              <Switch
                label="switch label"
                checked={options.longitude360}
                onChange={event => this.handleLongitude360Switched(event?.currentTarget.checked ?? false)}
              />
            </Field>
            <Field label="Cluster Radius" description="Merge close points within a radius into one circle">
              <Slider
                min={5}
                max={50}
                value={[this.props.options.mapClusterRadius]}
                onChange={value => this.handleMapClusterRadiusChange(value[0])}
              />
            </Field>
            <Field label="Hostname Label Width (em)" description="In the bottom-left host list">
              <Slider
                min={2}
                max={12}
                value={[this.props.options.hostnameLabelWidth]}
                onChange={value => this.handleHostnameLabelWidthChange(value[0])}
              />
            </Field>
            {/* <Field label="Show src hostname" description="Show src hostname in ">
              <Slider
                min={2}
                max={12}
                value={[this.props.options.hostnameLabelWidth]}
                onChange={value => this.handleHostnameLabelWidthChange(value[0])}
              />
            </Field>
            */}
            <Field label="Show Simplified Hostname" description="i.e. only the leftmost portion instead of FQDN">
              <Switch
                label="switch label"
                checked={options.simplifyHostname}
                onChange={event => this.handleSimplifyHostnameChange(event?.currentTarget.checked ?? false)}
              />
            </Field>
            <Field label="Note">
              <span>Some options won't take effect until the panel/page is refreshed.</span>
            </Field>
          </div>
        </div>
        <div className="section gf-form-group">
          <h5 className="section-header">GeoIP</h5>
          <div style={{ width: 400 }}>
            <Field label="Provider">
              <Select
                options={geoIPOptions}
                value={this.state.geoIPProvider.kind}
                onChange={this.handleGeoIPProviderSelected}
              />
            </Field>
            {(() => {
              switch (this.state.geoIPProvider.kind) {
                case 'ipinfo':
                  return <IPInfoConfig onChange={this.handleGeoIPProviderChange} config={this.state.geoIPProvider} />;
                case 'ipsb':
                  return <IPSBConfig />;
                case 'custom-api':
                  return (
                    <CustomAPIConfig onChange={this.handleGeoIPProviderChange} config={this.state.geoIPProvider} />
                  );
                case 'custom-function':
                  return (
                    <CustomFunctionConfig onChange={this.handleGeoIPProviderChange} config={this.state.geoIPProvider} />
                  );
              }
            })()}
          </div>
          <Field>
            <>
              <Button onClick={this.handleTestAndSave}>
                {/* @grafana/ui IconName types prevents using of fa-spin */}
                {this.state.test.pending ? <i className="fa fa-spinner fa-spin icon-right-space" /> : <></>}
                Test and Save
              </Button>
              <span className="hspace"></span>
              <Button variant="secondary" onClick={this.handleClearGeoIPCache}>
                Clear Cache
              </Button>
            </>
          </Field>

          {this.state.test.title ? (
            <Field label="">
              <>
                <span style={{ fontWeight: 'bold' }}>{this.state.test.title}</span>
                <pre>
                  <code>{this.state.test.output}</code>
                </pre>
              </>
            </Field>
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
  {
    label: 'IP.sb (MaxMind GeoLite2)',
    value: 'ipsb',
    description: "IP.sb free API, backed by MaxMind's GeoLite2 database.",
  },
  { label: 'Custom API', value: 'custom-api', description: 'Custom API defined by a URL' },
  { label: 'Custom function', value: 'custom-function', description: 'Custom JavaScript function.' },
];

const IPSBConfig: React.FC = () => {
  return (
    <Field label="Note">
      <span>
        <a href="https://ip.sb/api/">IP.sb</a> provides with free IP-to-GeoLocation API without registration. Their data
        comes from <a href="https://www.maxmind.com/">MaxMind</a>'s GeoLite2 database (
        <a href="https://github.com/fcambus/telize">telize</a>), which is inaccurate sometimes.
      </span>
    </Field>
  );
};

const IPInfoConfig: React.FC<{ config: IPInfo; onChange: (config: IPInfo) => void }> = ({ config, onChange }) => {
  return (
    <>
      <Field label="Access Token" description="optional">
        <Input
          type="text"
          value={config.token}
          placeholder="Usually in the form 0a1b2c3d4e5f6e7d"
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...config, token: event.target.value })}
        />
      </Field>
      <Field label="Note">
        <span>
          <a href="https://IPInfo.io">IPInfo.io</a> is generally more accurate compared to MaxMind's GeoLite2 database.
          The API access token is optional, but requests without token is rate-limited. After registration, their free
          plan provides with 50k lookups per month.
        </span>
      </Field>
    </>
  );
};

const CustomAPIConfig: React.FC<{ config: CustomAPI; onChange: (config: CustomAPI) => void }> = ({
  config,
  onChange,
}) => {
  return (
    <>
      <Field label="API URL">
        <Input
          type="text"
          value={config.url}
          placeholder="e.g. https://example.org/geoip/{IP}"
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...config, url: event.target.value })}
        />
      </Field>
      <Field label="Note">
        <>
          <p>
            <code>{'{IP}'}</code> in the URL will replaced to the actual IP address.
          </p>
          <p>
            The API is expected to return data matching the interface:
            <pre>
              <code>{CodeSnippets.ipgeoInterface}</code>
            </pre>
            with <code>Content-Type: application/json</code> and proper <code>Access-Control-Allow-Origin</code> HTTP
            header set.
          </p>
          <p>
            <strong>Example</strong>:{' '}
            <a href="https://github.com/Gowee/traceroute-map-panel/blob/master/ipip-cfworker.js">ipip-cfworker.js</a>
          </p>
        </>
      </Field>
    </>
  );
};

const CustomFunctionConfig: React.FC<{ config: CustomFunction; onChange: (config: CustomFunction) => void }> = ({
  config,
  onChange,
}) => {
  return (
    <>
      <Field label="Code">
        <TextArea
          value={config.code}
          rows={15}
          placeholder={CodeSnippets.ip2geoFunction}
          style={{ fontFamily: 'monospace' }}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange({ ...config, code: event.target.value })}
        />
      </Field>
      <Field label="Note">
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
      </Field>
    </>
  );
};

// TODO: use reflection to unify types?
