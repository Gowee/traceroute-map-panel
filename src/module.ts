import { PanelPlugin } from '@grafana/data';

import { TracerouteMapOptions, buildOptionsEditor as TracerouteMapOptionsEditorBuilder } from './options';
import { TracerouteMapPanel } from './TracerouteMapPanel';

export const plugin = new PanelPlugin<TracerouteMapOptions>(TracerouteMapPanel).setPanelOptions(
  TracerouteMapOptionsEditorBuilder
);
