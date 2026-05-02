import * as fs from 'fs';
import { z } from 'zod';
import { runCommandSync } from './commands.js';
import { LayoutMode } from './types.js';
import type {
  WindowInfo,
  WorkspaceInfo,
  RawWindowJson,
  RawWorkspaceJson,
  AerospaceRun,
  WorkspaceState,
  DisplayInfo,
} from './types.js';
import { LOGGER, config } from '../registry.js';
import path from 'path';
import { dump as tomlDump, load as tomlLoad } from 'js-toml';
import type { AeroSpaceConfig } from './aerospace-config.interface.js';

export const CONFIG_FILE_PATH = path.join(config.HOME, '.aerospace.toml');

const logger = LOGGER.child({ module: 'aerospace' });

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
    layoutMode: z.enum(LayoutMode),
    windowCount: z.number().int().nonnegative(),
  })
);

const aerospaceRunSchema = z.object({
  previousWorkspace: z.number().int().nonnegative().default(0),
  workspaceState: workspaceStateSchema,
  screens: z.array(screenSchema),
  resizeToggleState: z.record(z.string(), z.string()).default({}),
});

export class AeroSpace {
  aerospaceRun!: AerospaceRun;

  constructor() {
    if (fs.existsSync(config.RUN_FILE_PATH)) {
      this.load();
    } else {
      this.initialize();
    }
  }

  private createDefaultWorkspaceState(): Record<string, WorkspaceState> {
    return Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        String(i + 1),
        { layoutMode: LayoutMode.FALSE, windowCount: 0 },
      ])
    );
  }

  initialize() {
    const localLogger = logger.child({
      context: `${AeroSpace.name}:${AeroSpace.prototype.initialize.name}`,
    });
    const screens = this.getScreensFromSwift();

    if (!screens) {
      localLogger.error('Failed to retrieve resolution of screens');
      throw new Error('Failed to retrieve resolution of screens');
    }

    this.aerospaceRun = {
      previousWorkspace: 0,
      workspaceState: this.createDefaultWorkspaceState(),
      screens,
      resizeToggleState: {},
    };

    this.persist();
  }

  setPreviousWorkspaceLayoutMode(layoutMode: LayoutMode) {
    const localLogger = logger.child({
      context: `${AeroSpace.name}:${AeroSpace.prototype.setPreviousWorkspaceLayoutMode.name}`,
    });

    const layoutModes = Object.values(LayoutMode) as LayoutMode[];

    if (!layoutModes.includes(layoutMode)) {
      localLogger.debug(
        `layoutMode: ${layoutMode} must be in ${Object.values(LayoutMode).join(', ')}`
      );
      return;
    }

    const workspaceKey = String(this.aerospaceRun.previousWorkspace);
    const existingWorkspaceState = this.aerospaceRun.workspaceState[workspaceKey] ?? {
      layoutMode: LayoutMode.FALSE,
      windowCount: 0,
    };

    this.aerospaceRun.workspaceState = {
      ...this.aerospaceRun.workspaceState,
      [workspaceKey]: {
        ...existingWorkspaceState,
        layoutMode,
      },
    };

    this.persist();
  }

  persistResolutionOfScreens() {
    const localLogger = logger.child({
      context: `${AeroSpace.name}:${AeroSpace.prototype.persistResolutionOfScreens.name}`,
    });

    const screens = this.getScreensFromSwift();

    if (!screens) {
      logger.error('Failed to retrieve resolution of screens');
      throw new Error('Failed to retrieve resolution of screens');
    }

    localLogger.info({ screens }, 'Logical resolution of current screen');

    this.aerospaceRun.screens = screens;

    this.persist();
  }

  persist() {
    const localLogger = logger.child({ context: this.persist.name });
    localLogger.debug('Persisting runtime data');
    fs.writeFileSync(config.RUN_FILE_PATH, JSON.stringify(this.aerospaceRun));
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
      resizeToggleState: parseResult.data.resizeToggleState,
    };
  }

  load() {
    const localLogger = logger.child({
      context: `${AeroSpace.name}:${AeroSpace.prototype.load.name}`,
    });

    try {
      const raw = JSON.parse(fs.readFileSync(config.RUN_FILE_PATH, 'utf8')) as unknown;

      if (!raw || typeof raw !== 'object') {
        throw new Error('Unsupported Aerospace runtime format');
      }

      this.aerospaceRun = this.parseRuntimeState(raw);
      return;
    } catch (error) {
      localLogger.error(
        `Failed to load Aerospace runtime ${config.RUN_FILE_PATH} ${(error as Error).message}`
      );
      this.initialize();
    }
  }

  listWindows(workspace?: string | number, focused = false): WindowInfo[] | null {
    const localLogger = logger.child({
      context: `${AeroSpace.name}:${AeroSpace.prototype.listWindows.name}`,
    });
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
      : `aerospace list-windows --json --format '${format}' ${!workspace ? '--all' : `--workspace ${String(workspace)}`}`;

    const output = runCommandSync(aerospaceCommand);

    if (!output) {
      localLogger.error('Failed to retrieve windows list or no output produced');
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
        workspace: window.workspace ?? 0,
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
      localLogger.error(`Failed to parse windows output: ${(err as Error).message}`);
      return null;
    }
  }

  listWorkspaces(focused = false): WorkspaceInfo[] | null {
    const localLogger = logger.child({
      context: `${AeroSpace.name}:${AeroSpace.prototype.listWorkspaces.name}`,
    });
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
      localLogger.error('Failed to retrieve workspaces list or no output produced');
      return null;
    }

    try {
      const parsed = JSON.parse(output) as RawWorkspaceJson[];
      const workspaces: WorkspaceInfo[] = parsed.map((workspace: RawWorkspaceJson) => ({
        workspace: workspace.workspace,
        isFocused: workspace['workspace-is-focused'] ?? false,
        isVisible: workspace['workspace-is-visible'] ?? false,
        rootContainerLayout: workspace['workspace-root-container-layout'] ?? '',
        monitorId: workspace['monitor-id'],
        monitorName: workspace['monitor-name'],
        monitorIsMain: workspace['monitor-is-main'] ?? false,
      }));

      return workspaces;
    } catch (err) {
      localLogger.error(`Failed to parse workspaces output: ${(err as Error).message}`);
      return null;
    }
  }

  findWindow(name: string, title?: string, workspace?: string | number): WindowInfo | null {
    const localLogger = logger.child({
      context: `${AeroSpace.name}:${AeroSpace.prototype.findWindow.name}`,
    });
    const windows = this.listWindows(workspace);

    if (!windows || windows.length === 0) {
      localLogger.debug('No active windows');
      return null;
    }

    const foundWindows = windows.filter(window => {
      const matchesName = window.appName === name;
      const matchesTitle = title ? (window.windowTitle || '').includes(title) : true;
      return matchesName && matchesTitle;
    });

    if (foundWindows.length === 0) {
      localLogger.debug('No window found');
      return null;
    }

    if (foundWindows.length > 1) {
      localLogger.debug(
        `Found more than one matching window for windowName:${name} windowTitle: ${title ?? ''}`
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

    const workspace = workspaces[0].workspace;
    return workspace;
  }

  moveNodeToWorkSpace(id: string | number, workspace: string | number): string | null {
    if (!(id && workspace)) {
      logger.error('missing mandatory parameters id or workspace');
    }

    return runCommandSync(
      `aerospace move-node-to-workspace --window-id ${String(id)} ${String(workspace)}`
    );
  }

  focus(id: string | number) {
    return runCommandSync(`aerospace focus --window-id ${String(id)}`);
  }

  async hardReload() {
    runCommandSync(`pkill AeroSpace`);
    runCommandSync(`open -a AeroSpace`);
    await new Promise<void>(resolve => setTimeout(resolve, 50));
  }

  move(
    direction: 'left' | 'down' | 'up' | 'right',
    options?: {
      windowId?: string | number;
      boundaries?: string;
      boundariesAction?: string;
    }
  ) {
    const validDirections = ['left', 'down', 'up', 'right'] as const;

    if (!validDirections.includes(direction)) {
      logger.error(`direction must be one of ${validDirections.join(', ')}`);
      return null;
    }

    const args = ['aerospace move'];

    if (options?.windowId !== undefined) {
      args.push(`--window-id ${String(options.windowId)}`);
    }

    if (options?.boundaries) {
      args.push(`--boundaries ${options.boundaries}`);
    }

    if (options?.boundariesAction) {
      args.push(`--boundaries-action ${options.boundariesAction}`);
    }

    args.push(direction);
    return runCommandSync(args.join(' '));
  }

  reloadConfig() {
    runCommandSync('aerospace reload-config');
  }

  /**
   * Execute an Aerospace resize command.
   *
   * This method mirrors the CLI usage:
   * `aerospace resize [-h|--help] [--window-id <window-id>] (smart|smart-opposite|width|height) [+|-]<number>`.
   *
   * @param mode - The resize mode to apply.
   * @param amount - The resize amount. A plain number is interpreted as an absolute target;
   *                 use a string with `+` or `-` to indicate a delta change.
   * @param options.windowId - Optional window id to target.
   * @returns The stdout of the command, or null when input validation fails.
   */
  resize(
    mode: 'smart' | 'smart-opposite' | 'width' | 'height',
    amount: number | string,
    options?: { windowId?: string | number }
  ) {
    const validModes = ['smart', 'smart-opposite', 'width', 'height'] as const;
    if (!validModes.includes(mode)) {
      logger.error(`resize mode must be one of ${validModes.join(', ')}`);
      return null;
    }

    if (typeof amount === 'number' && !Number.isFinite(amount)) {
      logger.error('resize amount must be a finite number');
      return null;
    }

    const normalizedAmount = typeof amount === 'number' ? String(amount) : String(amount);

    const args = ['aerospace resize'];

    if (options?.windowId !== undefined) {
      args.push(`--window-id ${String(options.windowId)}`);
    }

    args.push(mode, normalizedAmount);

    logger.info(args.join(' '));
    return runCommandSync(args.join(' '));
  }

  writeConfig(config: AeroSpaceConfig, reload = true) {
    fs.writeFileSync(CONFIG_FILE_PATH, tomlDump(config));
    if (reload) {
      this.reloadConfig();
    }
  }

  readConfig() {
    return tomlLoad(fs.readFileSync(CONFIG_FILE_PATH, 'utf8')) as AeroSpaceConfig;
  }

  setOuterGapsAndReload(left: string | number, right: string | number, workspace: string | number) {
    const localLogger = logger.child({
      context: this.setOuterGapsAndReload.name,
      left,
      right,
      workspace,
    });
    const monitorSideActive = parseInt(String(workspace), 10) < 10 ? 'main' : 'secondary';

    const tomlConfig = this.readConfig();

    const parsedleft = typeof left === 'string' ? parseInt(left, 10) : left;
    const parsedRight = typeof right === 'string' ? parseInt(right, 10) : right;

    if (tomlConfig.gaps.outer.left === 0 && tomlConfig.gaps.outer.right === 0) {
      tomlConfig.gaps.outer = {
        left: [{ monitor: { main: 0 } }, { monitor: { secondary: 0 } }, 0],
        right: [{ monitor: { main: 0 } }, { monitor: { secondary: 0 } }, 0],
      };
    }

    if (Array.isArray(tomlConfig.gaps.outer.left) && Array.isArray(tomlConfig.gaps.outer.right)) {
      tomlConfig.gaps.outer.left.forEach(pattern => {
        if (typeof pattern === 'object' && monitorSideActive in pattern.monitor) {
          pattern.monitor[monitorSideActive] = parsedleft;
        }
      });
      tomlConfig.gaps.outer.right.forEach(pattern => {
        if (typeof pattern === 'object' && monitorSideActive in pattern.monitor) {
          pattern.monitor[monitorSideActive] = parsedRight;
        }
      });
    } else {
      throw new Error('gaps.outer is malformed should be an array');
    }

    localLogger.debug('Modified other gaps');

    this.writeConfig(tomlConfig, true);
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
