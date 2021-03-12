/* eslint-disable react/jsx-no-target-blank */
import React from 'react';
import { Popup } from '../react-leaflet-compat';
import { Icon } from '@grafana/ui';

import { round } from '../utils';
import { RoutePoint } from '../data';
import { HopLabelType } from '../options';

export interface GenericPointPopupProps {
  host: string;
  dest: string;
  point: RoutePoint;
  color: string;
}

export interface PointPopupProps extends GenericPointPopupProps {
  // host: string;
  // dest: string;
  // point: RoutePoint;
  // color: string;
  hopLabel: HopLabelType;
  showSearchIcon: boolean;
}

const PointPopup: React.FC<PointPopupProps> = ({ host, dest, point, color, hopLabel, showSearchIcon }) => {
  return (
    <Popup className="point-popup">
      <div className="region-label">
        <a href={`https://www.openstreetmap.org/#map=5/${point.lat}/${point.lon}`} target="_blank" rel="noopener">
          {point.region}
        </a>
      </div>
      <hr />
      <ul className="hop-list">
        {point.hops.map((hop) => (
          <li
            className="hop-entry"
            key={hop.nth}
            title={`${hop.ip} (${hop.label ?? 'No network info available'}) \
RTT:${round(hop.rtt, 2)} Loss:${round(hop.loss, 2)}`}
          >
            <span className="hop-nth">{hop.nth}.</span>{' '}
            <span className="hop-detail">
              {(hopLabel === 'ip' || hopLabel === 'ipAndLabel') && (
                <span className="hop-ip-wrapper">
                  <span className="hop-ip">{hop.ip}</span>
                  {showSearchIcon && (
                    <a href={`https://bgp.he.net/ip/${hop.ip}`} target="_blank" rel="noopener">
                      <Icon name="search" title="Search the IP in bgp.he.net" style={{ marginBottom: 'unset' }} />
                    </a>
                  )}
                </span>
              )}
              {(hopLabel === 'ipAndLabel' || hopLabel === 'label') && <span className="hop-label">{hop.label}</span>}
            </span>
          </li>
        ))}
      </ul>
      <hr />
      <div className="host-dest-label">
        <span className="host-label" title={host}>
          {host}
        </span>
        <span className="host-arrow" style={{ color }}>
          &nbsp; ➜ &nbsp;
        </span>
        <span className="dest-label" title={host}>
          {dest}
        </span>
      </div>
    </Popup>
  );
};

export default PointPopup;
