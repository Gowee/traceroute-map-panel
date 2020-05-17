import React, { PureComponent, useState, ChangeEvent } from 'react';
import { /*FormField,  Select, FormField, Button,*/ Forms } from '@grafana/ui';
// import Legend from '@grafana/ui/components/Forms';
import { PanelEditorProps, SelectableValue } from '@grafana/data';

import { TracerouteMapOptions } from './types';
import {
  /*GeoIPProvider, IPGeo,, IPInfo, IPSB, CustomAPI, CustomFunction*/
  GeoIPProviderKind,
  GeoIPProvider,
  IPInfo,
  CustomAPI,
  IP2Geo,
  CustomFunction,
} from './geoip';
import { CodeSnippets, timeout } from './utils';
// TODO: generate form fields thru reflection on GeoIPProvider

interface Props extends PanelEditorProps<TracerouteMapOptions> {}

interface State {
  geoIPProvider: GeoIPProvider;
  test: { pending: boolean; title?: string; output?: string };
  // ipinfoToken?: string,
  // customAPI?: string,
  // customFunction?: string
}

export class TracerouteMapEditor extends PureComponent<PanelEditorProps<TracerouteMapOptions>, State> {
  // geoIPProviderConfig: any

  constructor(props: Props) {
    super(props);
    const options = this.props.options;
    this.state = {
      geoIPProvider: options.geoIPProviders[options.geoIPProviders.active],
      test: { pending: false },
    };
    console.log(this.props.options);
    this.handleGeoIPProviderChange = this.handleGeoIPProviderChange.bind(this);
    this.handleTestAndSave = this.handleTestAndSave.bind(this);
  }

  // onTextChanged = ({ target }: any) => {
  //   this.props.onOptionsChange({ ...this.props.options, text: target.value });
  // };

  onGeoIPProviderSelected = (option: SelectableValue<GeoIPProviderKind>) => {
    this.setState({ geoIPProvider: this.props.options.geoIPProviders[option.value ?? 'ipsb'], test: { pending: false } });
  };

  updateIPInfo(token?: string) {
    // const inputCache = this.props.options.inputCache;
    // if (token !== undefined) {
    //   inputCache.ipinfoToken = token;
    // }
    // this.props.onOptionsChange({
    //   ...this.props.options,
    //   // text: "ipinfo"
    //   geoIPProvider: { kind: "ipinfo", token: inputCache.ipinfoToken }
    // });
  }

  updateIPSB() {
    // this.props.onOptionsChange({
    //   ...this.props.options,
    //   geoIPProvider: { kind: "ipsb" }
    // })
  }

  updateCustomAPI(url?: string) {
    // const inputCache = this.props.options.inputCache;
    // if (url !== undefined) {
    //   inputCache.customAPI = url;
    // }
    // this.props.onOptionsChange({
    //   ...this.props.options,
    //   geoIPProvider: { kind: "custom-api", url: inputCache.customAPI ?? "" }
    // });
  }

  updateCustomFunction(code?: string) {
    // const inputCache = this.props.options.inputCache;
    // if (code !== undefined) {
    //   inputCache.customFunction = code;
    // }
    // let func = (() => Object()) as (ip: string) => Promise<IPGeo>
    // if (func) {
    //   try {
    //     func = eval(inputCache.customFunction as string) as (ip: string) => Promise<IPGeo>;
    //   }
    //   catch (e) {
    //   }
    // }
    // console.log(func);
    // this.props.onOptionsChange({
    //   ...this.props.options,
    //   geoIPProvider: { kind: 'custom-function', func }
    // });
  }

  handleGeoIPProviderChange(provider: GeoIPProvider) {
    this.setState({ geoIPProvider: provider });
  }

  async handleTestAndSave() {
    const provider = this.state.geoIPProvider;
    this.setState({ test: { pending: true, title: 'Testing...', output: '' } });
    // setTest({ pending: true, title: "Testing...", output: "" });
    // console.log("test");
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
    // setTest({
    //   pending: false,
    //   title: error ? "❌ Failed" : "✅ Done",
    //   output: error ? error.stack.toString() : JSON.stringify(geo, null, 4)
    // })
  }

  render() {
    const { options } = this.props;
    console.log(options);
    return (
      <div className="section gf-form-group">
        <h5 className="section-header">GeoIP</h5>
        {/* <Forms.Field label="Text" labelWidth={5} inputWidth={20} type="text" onChange={this.onTextChanged} value={options.text || ''} /> */}
        <div style={{ width: 500 }}>
          <Forms.Field label="Provider">
            <Forms.Select options={geoIPOptions} value={this.state.geoIPProvider.kind} onChange={this.onGeoIPProviderSelected} />
          </Forms.Field>
          {(() => {
            switch (this.state.geoIPProvider.kind) {
              case 'ipinfo':
                console.log('ipinfo...', this.props.options.geoIPProviders);
                return <IPInfoConfig onChange={this.handleGeoIPProviderChange} config={this.state.geoIPProvider} />;
              case 'ipsb':
                return <IPSBConfig />;
              // <span>Free API provided by <a href="https://ip.sb/api/">IP.sb</a>, which relys on <a href="http://www.maxmind.com/">MaxMind</a>'s GeoLite2 database. No API token is required.</span>);
              case 'custom-api':
                return <CustomAPIConfig onChange={this.handleGeoIPProviderChange} config={this.state.geoIPProvider} />;
              // <FormField label="API URL" type="text" value={options.inputCache.customAPI} onChange={(event) => this.updateCustomAPI(event.target.value)} inputWidth="100%" />

              case 'custom-function':
                return <CustomFunctionConfig onChange={this.handleGeoIPProviderChange} config={this.state.geoIPProvider} />;
            }
          })()}
        </div>
        <Forms.Button icon={this.state.test.pending ? 'fa fa-spinner fa-spin' : undefined} onClick={this.handleTestAndSave}>
          Test and Save
        </Forms.Button>

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
  // const [token, setToken] = useState<string | undefined>(undefined);
  // const [test, setTest] = useState({
  //   pending: false,
  //   title: "",
  //   output: ""
  // });

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
      {/* <> */}
      {/* <Forms.Button onClick={onTestAndSave} icon={test.pending ? "fa fa-spinner fa-spin" : undefined} disabled={test.pending}>
          Test and Save
        </Forms.Button>
      // </> */}
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
        </>
      </Forms.Field>
    </>
  );
};

const CustomFunctionConfig: React.FC<{ config: CustomFunction; onChange: (config: CustomFunction) => void }> = ({ config, onChange }) => {
  return (
    // <div style={{ width: 300 }}>
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
    // </div>
  );
};

// TODO: use reflection to unify types?

// function getGeoIPOptionFromProvider(provider: GeoIPProvider): SelectableValue<string> {
//   return geoIPOptions.filter((option) => option.value === provider.kind)[0];
// }

// const Link： React.FC< { url: string } = (url: string) => {
//   return <a href={url}></a>
// };

console.log(CodeSnippets, IP2Geo, timeout, useState);
