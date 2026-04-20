import * as fs from 'fs';
import { runCommandSync, replaceTomlValues } from './commands.js';
import { LAYOUT_MODE, CONFIG_FILE_PATH, RUN_FILE_PATH } from './types.js';
import type {
  WindowInfo,
  WorkspaceInfo,
  RawWindowJson,
  RawWorkspaceJson,
  AerospaceRun,
  LayoutMode,
  WorkspaceState,
  DisplayInfo,
} from './types.js';
import { logger } from './logger.js';

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
        { layoutMode: LAYOUT_MODE.FALSE, windowCount: 0 },
      ])
    ) as Record<string, WorkspaceState>;
  }

  initalize() {
    this.aerospaceRun = {
      previousWorkspace: 0,
      workspaceState: this.createDefaultWorkspaceState(),
    };

    this.persist();
  }

  setPreviousWorkspaceLayoutMode(layoutMode: LayoutMode) {
    const layoutModes = Object.values(LAYOUT_MODE) as LayoutMode[];
    if (!layoutModes.includes(layoutMode)) {
      logger.debug(`layoutMode: ${layoutMode} must be in ${Object.values(LAYOUT_MODE)}`);
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

  persist() {
    fs.writeFileSync(RUN_FILE_PATH, JSON.stringify(this.aerospaceRun));
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(RUN_FILE_PATH, 'utf8')) as Record<string, unknown>;

      if (raw && typeof raw === 'object') {
        const previousWorkspace = Number(raw.previousWorkspace ?? 0);

        if (
          'workspaceState' in raw &&
          raw.workspaceState &&
          typeof raw.workspaceState === 'object'
        ) {
          this.aerospaceRun = {
            previousWorkspace,
            workspaceState: {
              ...this.createDefaultWorkspaceState(),
              ...(raw.workspaceState as Record<string, WorkspaceState>),
            },
          };
          return;
        }

        if ('layoutMode' in raw && raw.layoutMode && typeof raw.layoutMode === 'object') {
          const layoutMode = raw.layoutMode as Record<string, LayoutMode>;
          this.aerospaceRun = {
            previousWorkspace,
            workspaceState: {
              ...this.createDefaultWorkspaceState(),
              ...Object.fromEntries(
                Object.entries(layoutMode).map(([workspace, mode]) => [
                  workspace,
                  { layoutMode: mode as LayoutMode, windowCount: 0 },
                ])
              ),
            } as Record<string, WorkspaceState>,
          };
          return;
        }
      }

      throw new Error('Unsupported Aerospace runtime format');
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
      const windows: WindowInfo[] = parsed.map((w: RawWindowJson) => ({
        windowId: w['window-id'],
        windowTitle: w['window-title'],
        windowIsFullscreen: w['window-is-fullscreen'],
        windowLayout: w['window-layout'],
        windowParentContainerLayout: w['window-parent-container-layout'],
        appBundleId: w['app-bundle-id'],
        appName: w['app-name'],
        appPid: w['app-pid'],
        appExecPath: w['app-exec-path'],
        appBundlePath: w['app-bundle-path'],
        workspace: w['workspace'] ?? 0,
        workspaceIsFocused: w['workspace-is-focused'],
        workspaceIsVisible: w['workspace-is-visible'],
        workspaceRootContainerLayout: w['workspace-root-container-layout'],
        monitorId: w['monitor-id'],
        monitorAppkitNsscreenScreensId: w['monitor-appkit-nsscreen-screens-id'],
        monitorName: w['monitor-name'],
        monitorIsMain: w['monitor-is-main'],
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
      const workspaces: WorkspaceInfo[] = parsed.map((ws: RawWorkspaceJson) => ({
        workspace: ws['workspace'],
        isFocused: ws['workspace-is-focused'] ?? false,
        isVisible: ws['workspace-is-visible'] ?? false,
        rootContainerLayout: ws['workspace-root-container-layout'] ?? '',
        monitorId: ws['monitor-id'],
        monitorName: ws['monitor-name'],
        monitorIsMain: ws['monitor-is-main'] ?? false,
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

    const foundWindows = windows.filter(w => {
      const matchesName = w.appName === name;
      const matchesTitle = title ? (w.windowTitle || '').includes(title) : true;
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

    logger.info(`FoundWindow! ${JSON.stringify(foundWindows[0])}`);
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
      const displays = parsed.map((w: RawWorkspaceJson) => ({
        monitorId: w['monitor-id'] ?? '',
        monitorAppkitNsscreenScreensId: w['monitor-appkit-nsscreen-screens-id'] ?? '',
        monitorName: w['monitor-name'] ?? '',
        monitorIsMain: w['monitor-is-main'] ?? false,
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
}

export const aerospace = new AeroSpace();
