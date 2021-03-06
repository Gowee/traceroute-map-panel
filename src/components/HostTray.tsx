import React, { useState } from 'react';
import { Icon } from '@grafana/ui';

import { RoutePoint } from '../data';
// import { HiddenHostsStorage } from 'utils';

// interface Props {
//   panelID: string;
//   expanded?: boolean;
//   routes: Map<string, RoutePoint[]>;
//   palette: () => string;
//   hostnameProcessor: (hostname: string) => string;
//   // labelWidth: string;
// }

// interface State {
//   expanded: boolean;
//   hiddenHosts: Set<string>;
// }

// class HostTray extends Component<Props, State> {
//   hiddenHostsStorage: HiddenHostsStorage;

//   constructor(props: Props) {
//     super(props);
//     this.hiddenHostsStorage = new HiddenHostsStorage(this.props.panelID);
//     this.state = { expanded: this.props.expanded ?? false, hiddenHosts: this.hiddenHostsStorage.load() };

//     this.toggle = this.toggle.bind(this);
//     this.toggleItem = this.toggleItem.bind(this);
//   }

//   toggle() {
//     this.setState((prevState) => {
//       return { expanded: !prevState.expanded };
//     });
//   }

//   toggleItem(item: string) {
//     this.setState({ hiddenHosts: this.hiddenHostsStorage.toggle(item) });
//   }

//   render() {
//     const { routes, palette, hostnameProcessor } = this.props;
//     return (
//       <div className="host-tray">
//         {this.state.expanded ? (
//           <>
//             <span className="host-list-toggler host-list-collapse" title="Collapse host tray" onClick={this.toggle}>
//               <i className="fa fa-compress" />
//             </span>
//             <ul className="host-list">
//               {Array.from(routes.entries()).map(([key, points]) => {
//                 const [host, dest] = key.split('|');
//                 const color = palette();
//                 return (
//                   <li key={`${host}|${dest}`} className="host-item" onClick={() => this.toggleItem(key)}>
//                     <span className="host-label" title={host}>
//                       {hostnameProcessor(host)}
//                     </span>
//                     <span className="host-arrow" style={{ color: this.state.hiddenHosts.has(key) ? 'grey' : color }}>
//                       <Icon name="arrow-right" />
//                     </span>
//                     <span className="dest-label" title={dest}>
//                       {hostnameProcessor(dest)}
//                     </span>
//                   </li>
//                 );
//               })}
//             </ul>
//           </>
//         ) : (
//           <span className="host-list-toggler host-list-expand" title="Expand host tray" onClick={() => this.toggle()}>
//             <i className="fa fa-expand" />
//           </span>
//         )}
//       </div>
//     );
//   }
// }

const HostTray: React.FC<{
  expanded: boolean;
  routes: Map<string, RoutePoint[]>;
  hiddenHosts: Set<string>;
  itemToggler: (key: string) => void;
  palette: () => string;
  hostnameProcessor: (hostname: string) => string;
}> = ({ expanded, routes, hiddenHosts, itemToggler: toggleItem, palette, hostnameProcessor }) => {
  const [isExpanded, setExpanded] = useState(expanded);
  const toggleTray = () => setExpanded(!isExpanded);

  return (
    <div className="host-tray">
      {isExpanded ? (
        <>
          <span className="host-list-toggler host-list-collapse" title="Collapse host tray" onClick={toggleTray}>
            <i className="fa fa-compress" />
          </span>
          <ul className="host-list">
            {Array.from(routes.entries()).map(([key, points]) => {
              const [host, dest] = key.split('|');
              const color = palette();
              return (
                <li key={`${host}|${dest}`} className="host-item" onClick={() => toggleItem(key)}>
                  <span className="host-label" title={host}>
                    {hostnameProcessor(host)}
                  </span>
                  <span className="host-arrow" style={{ color: hiddenHosts.has(key) ? 'grey' : color }}>
                    <Icon name="arrow-right" />
                  </span>
                  <span className="dest-label" title={dest}>
                    {hostnameProcessor(dest)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <span className="host-list-toggler host-list-expand" title="Expand host tray" onClick={toggleTray}>
          <i className="fa fa-expand" />
        </span>
      )}
    </div>
  );
};

export default HostTray;
