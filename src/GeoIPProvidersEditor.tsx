import React, { PureComponent, ChangeEvent } from 'react';
import { Field, Button, TextArea, Select, Input } from '@grafana/ui';
import { StandardEditorProps, SelectableValue } from '@grafana/data';
import {} from '@emotion/core'; // https://github.com/grafana/grafana/issues/26512

import { TracerouteMapOptions } from './types';
import { GeoIPProviderKind, GeoIPProvider, IPInfo, IPSB, CustomAPI, IP2Geo, CustomFunction } from './geoip';
import { CodeSnippets, timeout } from './utils';

const TEST_IP = '1.2.4.8';

interface GeoIPProvidersOption {
  active: GeoIPProviderKind;
  ipsb: IPSB;
  ipinfo: IPInfo;
  'custom-api': CustomAPI;
  'custom-function': CustomFunction;
}

interface Props extends StandardEditorProps<GeoIPProvidersOption, {}, TracerouteMapOptions> {}

interface State {
  currentProvider: GeoIPProvider;
  test: { pending: boolean; title?: string; output?: string };
}

export class GeoIPProvidersEditor extends PureComponent<Props, State> {
  static defaultValue: GeoIPProvidersOption = {
    active: 'ipsb',
    ...(Object.fromEntries(['ipsb', 'ipinfo', 'custom-api', 'custom-function'].map((p) => [p, { kind: p }])) as any),
  };

  constructor(props: Props) {
    super(props);
    const value = this.props.value;

    this.state = {
      currentProvider: value[value.active],
      test: { pending: false },
    };
    this.handleGeoIPProviderChange = this.handleGeoIPProviderChange.bind(this);
    this.handleTestAndSave = this.handleTestAndSave.bind(this);
    this.handleClearGeoIPCache = this.handleClearGeoIPCache.bind(this);
  }

  handleGeoIPProviderSelected = (option: SelectableValue<GeoIPProviderKind>) => {
    this.setState({
      currentProvider: this.props.value[option.value ?? 'ipsb'],
      test: { pending: false },
    });
  };

  handleGeoIPProviderChange(provider: GeoIPProvider) {
    this.setState({ currentProvider: provider });
  }

  async handleTestAndSave() {
    const provider = this.state.currentProvider;
    this.setState({ test: { pending: true, title: 'Testing...', output: '' } });
    let geo;
    let error;
    try {
      const ip2geo = IP2Geo.fromProvider(provider);
      geo = await timeout(ip2geo(TEST_IP, true), 8000);
    } catch (e) {
      error = e;
    }
    this.setState({
      test: {
        pending: false,
        title: error ? '❌ Failed' : '✅ Done',
        output: error
          ? error.stack.toString() || error.toString()
          : `// Query result for ${TEST_IP}:\n` + JSON.stringify(geo, null, 4),
      },
    });
    if (!error) {
      // Unlike other ordinary built-in options input, value (providers) of GeoIPProvidersEditor
      // are not updated until test is ok. Changes of choices of <Select> and content of text
      // input are only internal states of the compontent.
      const providers = { ...this.props.value, active: provider.kind };
      providers[provider.kind] = provider as any;
      this.props.onChange(providers);
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

  render() {
    return (
      <>
        <Field /*label="Provider"*/>
          <Select
            options={geoIPOptions}
            value={this.state.currentProvider.kind}
            onChange={this.handleGeoIPProviderSelected}
          />
        </Field>
        {(() => {
          switch (this.state.currentProvider.kind) {
            case 'ipinfo':
              return <IPInfoConfig onChange={this.handleGeoIPProviderChange} config={this.state.currentProvider} />;
            case 'ipsb':
              return <IPSBConfig />;
            case 'custom-api':
              return <CustomAPIConfig onChange={this.handleGeoIPProviderChange} config={this.state.currentProvider} />;
            case 'custom-function':
              return (
                <CustomFunctionConfig onChange={this.handleGeoIPProviderChange} config={this.state.currentProvider} />
              );
          }
        })()}
        <Field>
          <>
            <Button onClick={this.handleTestAndSave}>
              {/* @grafana/ui IconName types prevents using of fa-spin */}
              {this.state.test.pending ? <i className="fa fa-spinner fa-spin icon-right-space" /> : <></>}
              Test & Save
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
      </>
    );
  }
}

const geoIPOptions: Array<SelectableValue<GeoIPProviderKind>> = [
  { label: 'IPInfo.io', value: 'ipinfo', description: 'API of IPInfo.io with some free quota' },
  {
    label: 'IP.sb (MaxMind GeoLite2)',
    value: 'ipsb',
    description: "Free API of IP.sb, backed by MaxMind's GeoLite2 database",
  },
  { label: 'Custom API', value: 'custom-api', description: 'Custom API defined by a URL' },
  { label: 'Custom Function', value: 'custom-function', description: 'Custom JavaScript function' },
];

const IPSBConfig: React.FC = () => {
  return (
    <Field label="Note">
      <span>
        <a className="decorated" href="https://ip.sb/api/">
          IP.sb
        </a>{' '}
        provides with free IP-to-GeoLocation API, requiring no registration. Their data comes from{' '}
        <a className="decorated" href="https://www.maxmind.com/">
          MaxMind
        </a>
        &apos;s GeoLite2 database (
        <a className="decorated" href="https://github.com/fcambus/telize">
          telize
        </a>
        ), of which the accuracy is limited.
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
          placeholder="e.g. 0a1b2c3d4e5f6e7d"
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...config, token: event.target.value })}
        />
      </Field>
      <Field label="Note">
        <span>
          <a className="decorated" href="https://IPInfo.io">
            IPInfo.io
          </a>{' '}
          is generally more accurate compared to MaxMind&apos;s GeoLite2 database. The{' '}
          <a className="decorated" href="https://ipinfo.io/account/token">
            API access token
          </a>{' '}
          is optional, but requests without token are rate-limited. After registration, their free plan provides with
          50k lookups quota per month.
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
            <code>{'{IP}'}</code> in the URL will substituted to the target IP address when querying.
          </p>
          <p>
            The API is expected to return JSON data matching the following interface:
            <pre>
              <code>{CodeSnippets.ipgeoInterface}</code>
            </pre>
            with <code>Content-Type: application/json</code> and proper <code>Access-Control-Allow-Origin</code> HTTP
            header set.
          </p>
          <p>
            <strong>Example</strong>:{' '}
            <a className="decorated" href="https://github.com/Gowee/traceroute-map-panel/blob/master/ipip-cfworker.js">
              ipip-cfworker.js
            </a>
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
          The JavaScript function is expected to match the following signature:
          <pre>
            <code>{CodeSnippets.ip2geoSignature}</code>
          </pre>
          where <code>IPGeo</code> is:
          <pre>
            <code>{CodeSnippets.ipgeoInterface}</code>
          </pre>
          . As the function is executed in the browser runtime, external HTTP resources requested by the function should
          have proper <code>Access-Control-Allow-Origin</code> HTTP header set.
        </p>
      </Field>
    </>
  );
};

// TODO: use reflection to unify types?
