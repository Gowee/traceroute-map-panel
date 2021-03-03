import React, { PureComponent, ChangeEvent } from 'react';
import { Field, Button, TextArea, Select, Input, HorizontalGroup, VerticalGroup, Alert, CodeEditor } from '@grafana/ui';
import { StandardEditorProps, SelectableValue } from '@grafana/data';
import {} from '@emotion/core'; // https://github.com/grafana/grafana/issues/26512
import Disclaimer from './Disclaimer.md'; 

import { TracerouteMapOptions } from './options';
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
} from './geoip';
import { CodeSnippets, timeout } from './utils';

const TEST_IP = '1.2.4.8';

export interface GeoIPProvidersOption {
  active: GeoIPProviderKind;
  ipsb: IPSB;
  ipinfo: IPInfo;
  ipapico: IPAPICo;
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

export class GeoIPProvidersEditor extends PureComponent<Props, State> {
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
    let geo;
    let error;
    try {
      const ip2geo = IP2Geo.fromProvider(provider);
      geo = await timeout(ip2geo(TEST_IP, true), 8000);
    } catch (e) {
      console.error(e);
      error = e;
    }
    this.setState({
      test: {
        status: error ? 'failed' : 'ok',
        output: error
          ? (error.toString() || error.stack.toString()) +
            '\n\n// For network error, the cause might be improper CORS header or ad blocker.'
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
    return (
      <>
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
            <Disclaimer />
          </Field>
        )}
        <Field>
          <HorizontalGroup align="center">
            <Button onClick={this.handleTestAndSave} disabled={this.state.test.status === 'pending'}>
              {/* @grafana/ui IconName types prevents using of fa-spin */}
              {this.state.test.status === 'pending' ? <i className="fa fa-spinner fa-spin icon-right-space" /> : <></>}
              Test & Apply
            </Button>
            <Button variant="secondary" onClick={this.handleClearGeoIPCache}>
              Clear Cache
            </Button>
          </HorizontalGroup>
        </Field>
        <TestResult value={this.state.test} onClose={this.handleConfirmTestResult} />
        <hr /> {/*To seprate the provider editor with other options in its Category */}
      </>
    );
  }
}

const geoIPSelectOptions: Array<SelectableValue<GeoIPProviderKind>> = [
  { label: 'IPInfo.io', value: 'ipinfo', description: 'Moderately accurate. W/ some free quota. Optional sign-up.' },
  {
    label: 'IP.sb (MaxMind GeoLite2)',
    value: 'ipsb',
    description: 'Less accurate. Unlimited. No sign-up.',
  },
  {
    label: 'IPData.co',
    value: 'ipdataco',
    description: 'More accurate. Sign-up for 1.5k lookups/day free quota.',
  },
  {
    label: 'IPAPI.co',
    value: 'ipapico',
    description: 'More accurate w/ limitations. 1k lookups/day free quota w/o sign-up.',
  },
  { label: 'Custom API', value: 'custom-api', description: 'Define a custom API by specifying a URL.' },
  {
    label: 'Custom Function',
    value: 'custom-function',
    description: 'Define a custom JavaScript function that requests external APIs.',
  },
];

const IPSBConfig: React.FC = () => {
  return (
    <Field label="Note">
      <>
        <p>
          <a className="decorated" href="https://ip.sb/api/" target="_blank" rel="noopener noreferrer">
            IP.sb
          </a>{' '}
          provides with free IP-to-GeoLocation API unlimitedly, requiring no sign-up.
        </p>
        <p>
          Their data comes from{' '}
          <a className="decorated" href="https://www.maxmind.com/" target="_blank" rel="noopener noreferrer">
            MaxMind
          </a>
          &apos;s GeoLite2 database (
          <a className="decorated" href="https://github.com/fcambus/telize" target="_blank" rel="noopener noreferrer">
            telize
          </a>
          ), of which the accuracy is fairly low.
        </p>
      </>
    </Field>
  );
};

const IPAPICoConfig: React.FC = () => {
  return (
    <Field label="Note">
      <>
        <p>
          <a className="decorated" href="https://ipapi.co" target="_blank" rel="noopener noreferrer">
            IPAPI.co
          </a>{' '}
          provides IP-to-GeoLocation API with 1k lookups{' '}
          <a className="decorated" href="https://ipapi.co/pricing/" target="_blank" rel="noopener noreferrer">
            free quota
          </a>{' '}
          per day, requiring no sign-up.
        </p>
        <p>
          This API has stricter limitation on burst requests. In case rate-limit is triggered, try to disable
          parallelization or fasten the rate-limiting options (e.g. <code>3</code> and <code>2</code>, respectively).
        </p>
        <p>
          Even though its location data are more accurate, geolocation data for some IP ranges are only available for
          paid plans. Therefore, it is predicatable that some hops might disappear on the map due to lack of lat/long
          data.
        </p>
      </>
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
        <>
          <p>
            <a className="decorated" href="https://IPInfo.io" target="_blank" rel="noopener noreferrer">
              IPInfo.io
            </a>{' '}
            is generally more accurate compared to MaxMind&apos;s GeoLite2 database.
          </p>
          <p>
            {' '}
            The{' '}
            <a className="decorated" href="https://ipinfo.io/account/token" target="_blank" rel="noopener noreferrer">
              API access token
            </a>{' '}
            is optional, but requests without token are rate-limited on a daily basis. After signing up, their free plan
            provides with 50k lookups quota per month.
          </p>
        </>
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
        <>
          <p>
            <a className="decorated" href="https://ipdata.co/" target="_blank" rel="noopener noreferrer">
              IPData.co
            </a>{' '}
            provides a free plan with 1.5k lookups per day quota for non-commercial use.
          </p>
          <p>
            <a
              className="decorated"
              href="https://dashboard.ipdata.co/sign-up.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sign-up
            </a>{' '}
            is required for an
            <a className="decorated" href="https://ipinfo.io/account/token" target="_blank" rel="noopener noreferrer">
              API key
            </a>
            .
          </p>
        </>
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
            <a
              className="decorated"
              href="https://github.com/Gowee/traceroute-map-panel/blob/master/ipip-cfworker.js"
              target="_blank"
              rel="noopener noreferrer"
            >
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
        <>
          <p>
            The JavaScript function is expected to match the following signature:
            <pre>
              <code>{CodeSnippets.ip2geoSignature}</code>
            </pre>
            where <code>IPGeo</code> is:
            <pre>
              <code>{CodeSnippets.ipgeoInterface}</code>
            </pre>
            .
          </p>
          <p>
            {' '}
            As the function is executed in the browser runtime, external HTTP resources requested by the function should
            have proper <code>Access-Control-Allow-Origin</code> HTTP header set.
          </p>
        </>
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
