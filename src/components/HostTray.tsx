import React, { useState } from 'react';
import { Icon } from '@grafana/ui';

import { RoutePoint } from '../data';

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
