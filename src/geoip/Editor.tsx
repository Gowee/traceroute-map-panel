import React, { PureComponent, ChangeEvent } from 'react';
import { Field, Button, TextArea, Select, Input, HorizontalGroup, Alert } from '@grafana/ui';
import { StandardEditorProps, SelectableValue } from '@grafana/data';
import {} from '@emotion/core'; // https://github.com/grafana/grafana/issues/26512
import { MDXProvider } from '@mdx-js/react';
import { AnchorHTMLAttributes } from 'react';

import {
  GeoIPDisclaimer,
  IPSBNote,
  IPDataNote,
  IPInfoNote,
  IPGeolocationNote,
  BigDataCloudNote,
  IPAPICoNote,
  CustomAPINote,
  CustomFunctionNote,
} from './text';
import { TracerouteMapOptions } from '../options';
import {
  GeoIPProviderKind,
  GeoIPProvider,
  IPInfo,
  IPSB,
  CustomAPI,
  IP2Geo,
  CustomFunction,
  IPAPICo,
  IPDataCo,
  GeoIPProviderKinds,
  IPGeolocation,
  BigDataCloud,
} from './api';
import { CodeSnippets, timeout } from '../utils';
import { SignificantError, UserFriendlyError } from '../errors';

const TEST_IPv4 = '1.2.4.8';
const TEST_IPv6 = '2001:4860:4860::8888';

export interface GeoIPProvidersOption {
  active: GeoIPProviderKind;
  ipsb: IPSB;
  ipinfo: IPInfo;
  ipapico: IPAPICo;
  ipgeolocation: IPGeolocation;
  bigdatacloud: BigDataCloud;
  ipdataco: IPDataCo;
  'custom-api': CustomAPI;
  'custom-function': CustomFunction;
  disclaimerAcknowledged: boolean;
}

interface Props extends StandardEditorProps<GeoIPProvidersOption, {}, TracerouteMapOptions> {}

type Test = { status?: 'pending' | 'ok' | 'failed'; /*pending: boolean; title?: string;*/ output?: string };

interface State {
  currentProvider: GeoIPProvider;
  test: Test;
}

export default class GeoIPProvidersEditor extends PureComponent<Props, State> {
  static defaultValue: GeoIPProvidersOption = {
    active: 'ipsb',
    ...(Object.fromEntries(GeoIPProviderKinds.map((p) => [p, { kind: p }])) as any),
    disclaimerAcknowledged: false,
  };

  constructor(props: Props) {
    super(props);
    const value = this.props.value;

    this.state = {
      currentProvider: value[value.active],
      test: {},
    };
    this.handleGeoIPProviderChange = this.handleGeoIPProviderChange.bind(this);
    this.handleTestAndSave = this.handleTestAndSave.bind(this);
    this.handleClearGeoIPCache = this.handleClearGeoIPCache.bind(this);
    this.handleConfirmTestResult = this.handleConfirmTestResult.bind(this);
  }

  handleGeoIPProviderSelected = (option: SelectableValue<GeoIPProviderKind>) => {
    this.setState({
      currentProvider: this.props.value[option.value ?? 'ipsb'],
      test: {},
    });
  };

  handleGeoIPProviderChange(provider: GeoIPProvider) {
    this.setState({ currentProvider: provider });
  }

  async handleTestAndSave() {
    if (!this.props.value.disclaimerAcknowledged) {
      if (confirm('By proceeding, you should have read the disclaimer.')) {
        this.props.onChange({ ...this.props.value, disclaimerAcknowledged: true });
      } else {
        return;
      }
    }

    const provider = this.state.currentProvider;
    this.setState({ test: { status: 'pending' } });
    // TODO: rewrite to improve readability with Promise.allSettled
    let [resultv4, resultv6] = await Promise.all(
      [TEST_IPv4, TEST_IPv6].map(async (ip) => {
        try {
          const ip2geo = IP2Geo.fromProvider(provider);
          const geo = await timeout(ip2geo(ip, true), 8000);
          if (
            !(
              (geo?.lat === undefined || typeof geo?.lat === 'number') &&
              (geo?.lon === undefined || typeof geo?.lon === 'number')
            )
          ) {
            // The validation is mainly meant for custom API or function.
            // All built-in GeoIP providers are expected to return values with right types.
            throw new SignificantError('Either latitude of longitude is not a valid number.');
          }
          return geo;
        } catch (e) {
          if (e instanceof UserFriendlyError && e.cause) {
            e = e.cause;
          }
          console.error(e);
          return e;
        }
      })
    );
    // The API is ok if either result is valid.
    let ok = !(resultv4 instanceof Error && resultv6 instanceof Error);
    let message = [
      [resultv4, TEST_IPv4],
      [resultv6, TEST_IPv6],
    ]
      .map(
        ([result, ip]) =>
          `// Result for ${ip} :\n` +
          (result instanceof Error ? result.toString() ?? result.stack : JSON.stringify(result, null, 2))
      )
      .join('\n\n');
    if (!ok && ['Failed to fetch', 'NetworkError'].some((keyword) => message.includes(keyword))) {
      message +=
        '\n\n// Note: For network error, the cause might be improper CORS header or ad-blocking browser extension.';
    }
    this.setState({
      test: {
        status: ok ? 'ok' : 'failed',
        output: message,
      },
    });
    if (ok) {
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
        `Clear all the GeoIP cache now?

Note: This won't trigger refreshing the panel.

By default, cache are stored in sesseionStorage which is cleaned up when the browser session ends.`
      )
    ) {
      const count = IP2Geo.clearCache();
      alert(`${count} entries cleaned.`);
    }
  }

  handleConfirmTestResult() {
    // Clear test result
    this.setState({ test: {} });
  }

  render() {
    const components = {
      a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a className="decorated" target="_blank" rel="noopener" {...props} />
      ),
    };
    return (
      <MDXProvider components={components}>
        <Field /*label="Provider"*/>
          <Select
            options={geoIPSelectOptions}
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
            case 'ipdataco':
              return <IPDataCoConfig onChange={this.handleGeoIPProviderChange} config={this.state.currentProvider} />;
            case 'ipgeolocation':
              return (
                <IPGeolocationConfig onChange={this.handleGeoIPProviderChange} config={this.state.currentProvider} />
              );
            case 'bigdatacloud':
              return (
                <BigDataCloudConfig onChange={this.handleGeoIPProviderChange} config={this.state.currentProvider} />
              );
            case 'ipapico':
              return <IPAPICoConfig />;
            case 'custom-api':
              return <CustomAPIConfig onChange={this.handleGeoIPProviderChange} config={this.state.currentProvider} />;
            case 'custom-function':
              return (
                <CustomFunctionConfig onChange={this.handleGeoIPProviderChange} config={this.state.currentProvider} />
              );
          }
        })()}
        {this.props.value.disclaimerAcknowledged || (
          <Field label="Disclaimer">
            <GeoIPDisclaimer />
          </Field>
        )}
        <Field>
          <HorizontalGroup align="center">
            <Button onClick={this.handleTestAndSave} disabled={this.state.test.status === 'pending'}>
              {/* @grafana/ui IconName types prevents using of fa-spin */}
              {this.state.test.status === 'pending' && <i className="fa fa-spinner fa-spin icon-right-space" />}
              Test & Apply
            </Button>
            <Button variant="secondary" onClick={this.handleClearGeoIPCache}>
              Clear Cache
            </Button>
          </HorizontalGroup>
        </Field>
        <TestResult value={this.state.test} onClose={this.handleConfirmTestResult} />
        <hr /> {/*To seprate the provider editor with other options in its Category */}
      </MDXProvider>
    );
  }
}

const geoIPSelectOptions: Array<SelectableValue<GeoIPProviderKind>> = [
  { label: 'IPInfo.io', value: 'ipinfo', description: 'Moderately accurate. W/ free quota. Optional sign-up.' },
  {
    label: 'IP.sb (MaxMind GeoLite2)',
    value: 'ipsb',
    description: 'Less accurate. Unlimited. No sign-up.',
  },
  {
    label: 'IPData.co',
    value: 'ipdataco',
    description: 'Pretty accurate. Sign-up for 1.5k lookups/day free quota.',
  },
  {
    label: 'IPGeolocation.io',
    value: 'ipgeolocation',
    description: 'Fairly accurate. Sign-up for 1k lookups/day free quota.',
  },
  {
    label: 'BigDataCloud.com',
    value: 'bigdatacloud',
    description: 'Pretty accurate. Sign-up for 10k lookups/month free quota.',
  },
  {
    label: 'IPAPI.co',
    value: 'ipapico',
    description: 'Pretty accurate w/ limitations. 1k lookups/day free quota w/o sign-up.',
  },
  { label: 'Custom API', value: 'custom-api', description: 'Define a custom API by specifying a URL.' },
  {
    label: 'Custom Function',
    value: 'custom-function',
    description: 'Define a custom JavaScript function from scratch.',
  },
];

const IPSBConfig: React.FC = () => {
  return (
    <Field label="Note">
      <IPSBNote />
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
        <IPInfoNote />
      </Field>
    </>
  );
};

const IPDataCoConfig: React.FC<{ config: IPDataCo; onChange: (config: IPDataCo) => void }> = ({ config, onChange }) => {
  return (
    <>
      <Field label="API Key" description="required">
        <Input
          type="text"
          value={config.key}
          placeholder="e.g. 57696e6e69652c2077696e6e69652c2068617070792077696e6e696521"
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...config, key: event.target.value })}
        />
      </Field>
      <Field label="Note">
        <IPDataNote />
      </Field>
    </>
  );
};

const IPGeolocationConfig: React.FC<{ config: IPGeolocation; onChange: (config: IPGeolocation) => void }> = ({
  config,
  onChange,
}) => {
  return (
    <>
      <Field label="API Key" description="required">
        <Input
          type="text"
          value={config.key}
          placeholder="e.g. 2d081e1e105757101e1e082d..."
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...config, key: event.target.value })}
        />
      </Field>
      <Field label="Note">
        <IPGeolocationNote />
      </Field>
    </>
  );
};

const BigDataCloudConfig: React.FC<{ config: BigDataCloud; onChange: (config: BigDataCloud) => void }> = ({
  config,
  onChange,
}) => {
  return (
    <>
      <Field label="API Key" description="required">
        <Input
          type="text"
          value={config.key}
          placeholder="e.g. 2d081e1e105757101e1e082d..."
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...config, key: event.target.value })}
        />
      </Field>
      <Field label="Note">
        <BigDataCloudNote />
      </Field>
    </>
  );
};

const IPAPICoConfig: React.FC = () => {
  return (
    <Field label="Note">
      <IPAPICoNote />
    </Field>
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
        <CustomAPINote />
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
        <CustomFunctionNote />
      </Field>
    </>
  );
};

const TestResult: React.FC<{ value: Test; onClose: () => void }> = ({ value, onClose }) => {
  let alert;
  switch (value.status) {
    case 'pending':
      alert = <Alert title="Test is pending..." severity="info" />;
      break;
    case 'ok':
      alert = <Alert title="Test succeeded" severity="success" onRemove={onClose} />;
      break;
    case 'failed':
      alert = <Alert title="Test failed" severity="error" onRemove={onClose} />;
      break;
    case undefined:
      return <></>;
  }
  return (
    <Field>
      <>
        {alert}
        {value.output && (
          <pre>
            <code>{value.output}</code>
          </pre>
        )}
      </>
    </Field>
  );
};

// TODO: use reflection to unify types?
