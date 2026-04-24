import * as fs from 'fs';
import { z } from 'zod';
import { runCommandSync, replaceTomlValues } from './commands.js';
import { LayoutMode, CONFIG_FILE_PATH, RUN_FILE_PATH } from './types.js';
import type {
  WindowInfo,
  WorkspaceInfo,
  RawWindowJson,
  RawWorkspaceJson,
  AerospaceRun,
  WorkspaceState,
  DisplayInfo,
} from './types.js';
import { logger } from './logger.js';

const screenSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  name: z.string(),
});

const workspaceStateSchema = z.record(
  z.string(),
  z.object({
    layoutMode: z.nativeEnum(LayoutMode),
    windowCount: z.number().int().nonnegative(),
  })
);

const aerospaceRunSchema = z.object({
  previousWorkspace: z.number().int().nonnegative().default(0),
  workspaceState: workspaceStateSchema,
  screens: z.array(screenSchema),
});

export class AeroSpace {
  aerospaceRun!: AerospaceRun;

  constructor() {
    if (fs.existsSync(RUN_FILE_PATH)) {
      this.load();
    } else {
      this.initalize();
    }
  }

  private createDefaultWorkspaceState(): Record<string, WorkspaceState> {
    return Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        String(i + 1),
        { layoutMode: LayoutMode.FALSE, windowCount: 0 },
      ])
    ) as Record<string, WorkspaceState>;
  }

  initalize() {
    const screens = this.getScreensFromSwift();

    if (!screens) {
      logger.error('Failed to retrieve resolution of screens');
      throw new Error('Failed to retrieve resolution of screens');
    }

    this.aerospaceRun = {
      previousWorkspace: 0,
      workspaceState: this.createDefaultWorkspaceState(),
      screens,
    };

    this.persist();
  }

  setPreviousWorkspaceLayoutMode(layoutMode: LayoutMode) {
    const layoutModes = Object.values(LayoutMode) as LayoutMode[];

    if (!layoutModes.includes(layoutMode)) {
      logger.debug(`layoutMode: ${layoutMode} must be in ${Object.values(LayoutMode)}`);
      return;
    }

    const workspaceKey = String(this.aerospaceRun.previousWorkspace);
    this.aerospaceRun.workspaceState = {
      ...this.aerospaceRun.workspaceState,
      [workspaceKey]: {
        ...this.aerospaceRun.workspaceState[workspaceKey],
        layoutMode,
      },
    };

    this.persist();
  }

  persistResolutionOfScreens() {
    const screens = this.getScreensFromSwift();

    if (!screens) {
      logger.error('Failed to retrieve resolution of screens');
      throw new Error('Failed to retrieve resolution of screens');
    }

    logger.info({ screens }, 'Logical resolution of current screen');

    this.aerospaceRun.screens = screens;

    this.persist();
  }

  persist() {
    fs.writeFileSync(RUN_FILE_PATH, JSON.stringify(this.aerospaceRun));
  }

  private parseRuntimeState(raw: unknown): AerospaceRun {
    const parseResult = aerospaceRunSchema.safeParse(raw);
    if (!parseResult.success) {
      throw new Error(`Invalid Aerospace runtime format: ${parseResult.error.message}`);
    }

    return {
      previousWorkspace: parseResult.data.previousWorkspace,
      workspaceState: {
        ...this.createDefaultWorkspaceState(),
        ...parseResult.data.workspaceState,
      },
      screens: parseResult.data.screens,
    };
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(RUN_FILE_PATH, 'utf8'));

      if (!raw || typeof raw !== 'object') {
        throw new Error('Unsupported Aerospace runtime format');
      }

      this.aerospaceRun = this.parseRuntimeState(raw);
      return;
    } catch (error) {
      logger.error(`Failed to load Aerospace runtime ${RUN_FILE_PATH} ${(error as Error).message}`);
      this.initalize();
    }
  }

  listWindows(workspace?: string | number, focused = false): WindowInfo[] | null {
    const format = [
      '%{window-id}',
      '%{window-title}',
      '%{window-is-fullscreen}',
      '%{window-layout}',
      '%{window-parent-container-layout}',
      '%{app-bundle-id}',
      '%{app-name}',
      '%{app-pid}',
      '%{app-exec-path}',
      '%{app-bundle-path}',
      '%{workspace}',
      '%{workspace-is-focused}',
      '%{workspace-is-visible}',
      '%{workspace-root-container-layout}',
      '%{monitor-id}',
      '%{monitor-appkit-nsscreen-screens-id}',
      '%{monitor-name}',
      '%{monitor-is-main}',
    ].join(' ');

    const aerospaceCommand = focused
      ? `aerospace list-windows --focused --json --format '${format}'`
      : `aerospace list-windows --json --format '${format}' ${!workspace ? '--all' : `--workspace ${workspace}`}`;

    const output = runCommandSync(aerospaceCommand);

    if (!output) {
      logger.error('Failed to retrieve windows list or no output produced');
      return null;
    }

    try {
      const parsed = JSON.parse(output) as RawWindowJson[];
      const windows: WindowInfo[] = parsed.map((window: RawWindowJson) => ({
        windowId: window['window-id'],
        windowTitle: window['window-title'],
        windowIsFullscreen: window['window-is-fullscreen'],
        windowLayout: window['window-layout'],
        windowParentContainerLayout: window['window-parent-container-layout'],
        appBundleId: window['app-bundle-id'],
        appName: window['app-name'],
        appPid: window['app-pid'],
        appExecPath: window['app-exec-path'],
        appBundlePath: window['app-bundle-path'],
        workspace: window['workspace'] ?? 0,
        workspaceIsFocused: window['workspace-is-focused'],
        workspaceIsVisible: window['workspace-is-visible'],
        workspaceRootContainerLayout: window['workspace-root-container-layout'],
        monitorId: window['monitor-id'],
        monitorAppkitNsscreenScreensId: window['monitor-appkit-nsscreen-screens-id'],
        monitorName: window['monitor-name'],
        monitorIsMain: window['monitor-is-main'],
      }));

      return windows;
    } catch (err) {
      logger.error(`Failed to parse windows output: ${(err as Error).message}`);
      return null;
    }
  }

  listWorkspaces(focused = false): WorkspaceInfo[] | null {
    const format = [
      '%{workspace}',
      '%{workspace-is-focused}',
      '%{workspace-is-visible}',
      '%{workspace-root-container-layout}',
      '%{monitor-id}',
      '%{monitor-name}',
      '%{monitor-is-main}',
    ].join(' ');

    const output = runCommandSync(
      `aerospace list-workspaces ${focused ? '--focused' : ''} --format '${format}' --json`
    );

    if (!output) {
      logger.error('Failed to retrieve workspaces list or no output produced');
      return null;
    }

    try {
      const parsed = JSON.parse(output) as RawWorkspaceJson[];
      const workspaces: WorkspaceInfo[] = parsed.map((workspace: RawWorkspaceJson) => ({
        workspace: workspace['workspace'],
        isFocused: workspace['workspace-is-focused'] ?? false,
        isVisible: workspace['workspace-is-visible'] ?? false,
        rootContainerLayout: workspace['workspace-root-container-layout'] ?? '',
        monitorId: workspace['monitor-id'],
        monitorName: workspace['monitor-name'],
        monitorIsMain: workspace['monitor-is-main'] ?? false,
      }));

      return workspaces;
    } catch (err) {
      logger.error(`Failed to parse workspaces output: ${(err as Error).message}`);
      return null;
    }
  }

  findWindow(name: string, title?: string, workspace?: string | number): WindowInfo | null {
    const windows = this.listWindows(workspace);

    if (!windows || windows.length === 0) {
      logger.debug('No active windows');
      return null;
    }

    const foundWindows = windows.filter(window => {
      const matchesName = window.appName === name;
      const matchesTitle = title ? (window.windowTitle || '').includes(title) : true;
      return matchesName && matchesTitle;
    });

    if (foundWindows.length === 0) {
      logger.debug('No window found');
      return null;
    }

    if (foundWindows.length > 1) {
      logger.debug(
        `Found more than one matching window for windowName:${name} windowTitle: ${title}`
      );
    }

    return foundWindows[0];
  }

  findWindowId(name: string, title?: string, workspace?: string | number): string | null {
    const win = this.findWindow(name, title, workspace);
    return win ? String(win.windowId) : null;
  }

  getIdOfFocusedWindow(): string | null {
    const output = runCommandSync('aerospace list-windows --focused --json');
    if (!output) {
      logger.error('Failed to get focused window');
      return null;
    }
    try {
      const windows = JSON.parse(output) as RawWindowJson[];
      return windows.length > 0 ? String(windows[0]['window-id']) : null;
    } catch (err) {
      logger.error(`Failed to parse focused window: ${(err as Error).message}`);
      return null;
    }
  }

  getFocusedWindow(): RawWindowJson | null {
    const output = runCommandSync('aerospace list-windows --focused --json');
    if (!output) {
      logger.error('Failed to get focused window');
      return null;
    }
    try {
      const windows = JSON.parse(output) as RawWindowJson[];
      return windows.length > 0 ? windows[0] : null;
    } catch (err) {
      logger.error(`Failed to parse focused window: ${(err as Error).message}`);
      return null;
    }
  }

  getCurrentDisplay(): DisplayInfo | null {
    const format = [
      '%{monitor-id}',
      '%{monitor-appkit-nsscreen-screens-id}',
      '%{monitor-name}',
      '%{monitor-is-main}',
    ].join(' ');

    const output = runCommandSync(
      `aerospace list-workspaces --focused --json --format '${format}'`
    );

    if (!output) {
      logger.error('Failed to get focused window');
      return null;
    }

    try {
      const parsed = JSON.parse(output) as RawWorkspaceJson[];
      const displays = parsed.map((window: RawWorkspaceJson) => ({
        monitorId: window['monitor-id'] ?? '',
        monitorAppkitNsscreenScreensId: window['monitor-appkit-nsscreen-screens-id'] ?? '',
        monitorName: window['monitor-name'] ?? '',
        monitorIsMain: window['monitor-is-main'] ?? false,
      }));

      return displays.length > 0 ? displays[0] : null;
    } catch (err) {
      logger.error(`Failed to parse display info: ${(err as Error).message}`);
      return null;
    }
  }

  getActiveWorkspaceName(): string | number | null {
    const workspaces = this.listWorkspaces(true);
    if (!workspaces) {
      logger.error('Failed to get focused workspace');
      return null;
    }

    const workspace = workspaces[0]['workspace'];
    return workspace;
  }

  moveNodeToWorkSpace(id: string | number, workspace: string | number): string | null {
    if (!(id && workspace)) {
      logger.error('missing mandatory parameters id or workspace');
    }

    return runCommandSync(`aerospace move-node-to-workspace --window-id ${id} ${workspace}`);
  }

  focus(id: string | number) {
    return runCommandSync(`aerospace focus --window-id ${id}`);
  }

  async hardReload() {
    runCommandSync(`pkill AeroSpace`);
    runCommandSync(`open -a AeroSpace`);
    await new Promise<void>(resolve => setTimeout(resolve, 50));
  }

  move(direction: 'left' | 'right') {
    const validDirections = ['left', 'right'];
    if (!validDirections.includes(direction)) {
      logger.error(`direction must be in ${validDirections.join(' ,')}`);
    }
  }

  reloadConfig() {
    runCommandSync('aerospace reload-config');
  }

  setOuterLeftRightGapsAndReload(value: string | number) {
    replaceTomlValues(CONFIG_FILE_PATH, [
      { key: 'outer.left', value },
      { key: 'outer.right', value },
    ]);
    this.reloadConfig();
  }

  setOuterGapsAndReload(left: string | number, right: string | number, workspace: string | number) {
    const monitorSide = parseInt(String(workspace), 10) < 10 ? 'main' : 'secondary';
    const leftGap = `[{ monitor.${monitorSide} = ${left} }, 0]`;
    const rightGap = `[{ monitor.${monitorSide} = ${right} }, 0]`;
    replaceTomlValues(CONFIG_FILE_PATH, [
      { key: 'outer.left', value: leftGap },
      { key: 'outer.right', value: rightGap },
    ]);
    this.reloadConfig();
  }

  private getScreensFromSwift():
    | { x: number; y: number; width: number; height: number; name: string }[]
    | null {
    const script = `
swift - <<'SWIFT'
import AppKit
import Foundation
let screens = NSScreen.screens
var results: [[String: Any]] = []
for screen in screens {
    let frame = screen.frame
    let name = screen.localizedName
    results.append([
        "x": Int(frame.origin.x),
        "y": Int(frame.origin.y),
        "width": Int(frame.width),
        "height": Int(frame.height),
        "name": name
    ])
}
let data = try JSONSerialization.data(withJSONObject: results, options: [])
print(String(data: data, encoding: .utf8)!)
SWIFT`;

    const output = runCommandSync(script);
    if (!output) {
      logger.error('Failed to get screen information from Swift');
      return null;
    }

    try {
      const parsed = JSON.parse(output) as ({
        x: number;
        y: number;
        width: number;
        height: number;
        name: string;
      } | null)[];

      return parsed.filter(
        (screen): screen is { x: number; y: number; width: number; height: number; name: string } =>
          screen !== null &&
          typeof screen.x === 'number' &&
          typeof screen.y === 'number' &&
          typeof screen.width === 'number' &&
          typeof screen.height === 'number' &&
          typeof screen.name === 'string'
      );
    } catch (error) {
      logger.error(`Failed to parse screen information: ${(error as Error).message}`);
      return null;
    }
  }
}

export const aerospace = new AeroSpace();
