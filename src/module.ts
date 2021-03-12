import { PanelPlugin } from '@grafana/data';

import { TracerouteMapOptions, buildOptionsEditor as TracerouteMapOptionsEditorBuilder } from './options';
import { TracerouteMapPanel } from './Panel';

export const plugin = new PanelPlugin<TracerouteMapOptions>(TracerouteMapPanel).setPanelOptions(
  TracerouteMapOptionsEditorBuilder
);
