export const LOGLEVEL = {
  ERROR: 'ERROR',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
} as const;
export type LogLevel = (typeof LOGLEVEL)[keyof typeof LOGLEVEL];

export enum LayoutMode {
  CONCENTRATE = 'CONCENTRATE',
  FALSE = 'FALSE',
}

export const TERMINAL_WORKSPACE = '8';
export const TERMINAL = 'WezTerm';

export interface DisplayInfo {
  monitorId: number | string;
  monitorAppkitNsscreenScreensId: string;
  monitorName: string;
  monitorIsMain: boolean | string;
}

export interface WindowInfo {
  windowId: string | number;
  windowTitle: string;
  windowIsFullscreen: boolean | string;
  windowLayout: string;
  windowParentContainerLayout: string;
  appBundleId?: string;
  appName?: string;
  appPid?: number | string;
  appExecPath?: string;
  appBundlePath?: string;
  workspace: string | number;
  workspaceIsFocused?: boolean | string;
  workspaceIsVisible?: boolean | string;
  workspaceRootContainerLayout?: string;
  monitorId?: string | number;
  monitorAppkitNsscreenScreensId?: string;
  monitorName?: string;
  monitorIsMain?: boolean | string;
}

export interface WorkspaceInfo {
  workspace: string | number;
  isFocused: boolean | string;
  isVisible: boolean | string;
  rootContainerLayout: string;
  monitorId?: string | number;
  monitorName?: string;
  monitorIsMain?: boolean | string;
}

export interface RawWindowJson {
  'window-id': string | number;
  'window-title': string;
  'window-is-fullscreen': boolean | string;
  'window-layout': string;
  'window-parent-container-layout': string;
  'app-bundle-id'?: string;
  'app-name'?: string;
  'app-pid'?: number | string;
  'app-exec-path'?: string;
  'app-bundle-path'?: string;
  workspace?: string | number;
  'workspace-is-focused'?: boolean | string;
  'workspace-is-visible'?: boolean | string;
  'workspace-root-container-layout'?: string;
  'monitor-id'?: string | number;
  'monitor-appkit-nsscreen-screens-id'?: string;
  'monitor-name'?: string;
  'monitor-is-main'?: boolean | string;
}

export interface RawWorkspaceJson {
  workspace: string | number;
  'workspace-is-focused'?: boolean | string;
  'workspace-is-visible'?: boolean | string;
  'workspace-root-container-layout'?: string;
  'monitor-id'?: string | number;
  'monitor-appkit-nsscreen-screens-id'?: string;
  'monitor-name'?: string;
  'monitor-is-main'?: boolean | string;
}

export interface WorkspaceState {
  layoutMode: LayoutMode;
  windowCount: number;
}

export interface Screen {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

export interface AerospaceRun {
  previousWorkspace: number;
  workspaceState: Record<string, WorkspaceState | undefined>;
  screens: Screen[];
}
