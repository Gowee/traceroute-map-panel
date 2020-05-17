import { PanelPlugin } from '@grafana/data';
import { TracerouteMapOptions, defaults } from './types';
import { TracerouteMapPanel } from './TracerouteMapPanel';
import { TracerouteMapEditor } from './TracerouteMapEditor';

export const plugin = new PanelPlugin<TracerouteMapOptions>(TracerouteMapPanel).setDefaults(defaults).setEditor(TracerouteMapEditor);
