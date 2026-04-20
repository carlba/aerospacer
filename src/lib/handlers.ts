import { aerospace } from './aerospace.js';
import { logger } from './logger.js';
import { displayResolution, LAYOUT_MODE, TERMINAL_WORKSPACE, TERMINAL } from './types.js';
import type { LayoutMode, WorkspaceState, WindowInfo } from './types.js';

// computeGapForWorkspace needs the `aerospace` instance and displayResolution
export function computeGapForWorkspace(
  workspace: string | number,
  prefetchedWindows?: WindowInfo[]
): number {
  const DESIRED_WINDOW_WIDTH = 1280;
  const MIN_GAP = 64;
  const currentDisplay = aerospace.getCurrentDisplay()?.monitorName ?? 'Built-in Display';
  const monitorWidth = displayResolution[currentDisplay] ?? 2400;

  const allWindows =
    prefetchedWindows ?? ((aerospace.listWindows(workspace) ?? []) as WindowInfo[]);
  const windows = allWindows.filter((w: WindowInfo) => w.windowLayout !== 'floating');
  const count = windows.length > 0 ? windows.length : 1;

  const neededCentralWidth = count * DESIRED_WINDOW_WIDTH;
  let gap: number;
  if (monitorWidth > neededCentralWidth) {
    gap = Math.floor((monitorWidth - neededCentralWidth) / 2);
  } else {
    gap = MIN_GAP;
  }

  const maxGap = Math.floor((monitorWidth - 1) / 2);
  if (gap > maxGap) gap = maxGap;
  if (gap < MIN_GAP) gap = MIN_GAP;

  logger.debug(
    `computeGapForWorkspace workspace=${workspace} monitorWidth=${monitorWidth} windows=${count} gap=${gap} desired=${DESIRED_WINDOW_WIDTH}`
  );
  return gap;
}

export function setDefaultBrowser(aerospaceFocusedWorkspace: number | string) {
  switch (Number(aerospaceFocusedWorkspace)) {
    case 1:
    case 2:
    case 3:
      logger.info(`Setting default browser to Chrome for workspace ${aerospaceFocusedWorkspace}`);
      break;
    case 4:
    case 5:
    case 6:
      logger.info(`Setting default browser to Brave for workspace ${aerospaceFocusedWorkspace}`);
      break;
    default:
      logger.debug('No handler for new workspace in onWorkSpaceChange');
  }
}

export function setNewWorkspaceLayout(
  previousWorkspaceLayoutMode: LayoutMode,
  targetWorkspaceLayoutMode: LayoutMode,
  targetWorkspace: string | number
) {
  switch (targetWorkspaceLayoutMode) {
    case previousWorkspaceLayoutMode:
      logger.debug(`No action because the previous and target workspace layout mode is the same`);
      break;
    case LAYOUT_MODE.CONCENTRATE:
      logger.debug(`Set ${targetWorkspaceLayoutMode}-mode`);
      {
        const gap = computeGapForWorkspace(targetWorkspace);
        aerospace.setOuterGapsAndReload(gap, gap, targetWorkspace);
      }
      break;
    case LAYOUT_MODE.FALSE:
      logger.debug(`Set ${targetWorkspaceLayoutMode}-mode`);
      aerospace.setOuterGapsAndReload(0, 0, targetWorkspace);
      break;
    default:
      logger.error(`Unknown layout mode: ${targetWorkspaceLayoutMode}`);
  }
}

export function handleWorkspaceChange(
  targetWorkspace: number | string,
  previousWorkspace: number | string
) {
  aerospace.aerospaceRun.previousWorkspace = Number(targetWorkspace);
  aerospace.persist();

  const targetWorkspaceKey = String(targetWorkspace);
  const previousWorkspaceKey = String(previousWorkspace);
  const targetWorkspaceLayoutMode =
    aerospace.aerospaceRun.workspaceState[targetWorkspaceKey]?.layoutMode ?? LAYOUT_MODE.FALSE;
  const previousWorkspaceLayoutMode =
    aerospace.aerospaceRun.workspaceState[previousWorkspaceKey]?.layoutMode ?? LAYOUT_MODE.FALSE;
  logger.info(
    `Target Workspace number: ${targetWorkspace} layout mode: ${targetWorkspaceLayoutMode} Previous Workspace number: ${previousWorkspace} layout mode: ${previousWorkspaceLayoutMode}`
  );
  setNewWorkspaceLayout(previousWorkspaceLayoutMode, targetWorkspaceLayoutMode, targetWorkspace);
}

export function handleConcentrateMode() {
  const previousWorkspaceKey = String(aerospace.aerospaceRun.previousWorkspace);
  const previousWorkspaceLayoutMode =
    aerospace.aerospaceRun.workspaceState[previousWorkspaceKey]?.layoutMode ?? LAYOUT_MODE.FALSE;

  logger.debug(
    `previousWorkspaceLayoutMode: ${previousWorkspaceLayoutMode} - concentrate-mode args handler`
  );

  if (previousWorkspaceLayoutMode === LAYOUT_MODE.CONCENTRATE) {
    logger.debug(`Set ${LAYOUT_MODE.FALSE}-mode`);
    aerospace.setOuterLeftRightGapsAndReload(0);
    aerospace.setPreviousWorkspaceLayoutMode(LAYOUT_MODE.FALSE);
  } else if (previousWorkspaceLayoutMode === LAYOUT_MODE.FALSE) {
    logger.debug(`Set ${LAYOUT_MODE.CONCENTRATE}-mode`);
    const targetWorkspace = aerospace.aerospaceRun.previousWorkspace;
    const gap = computeGapForWorkspace(targetWorkspace);
    aerospace.setOuterGapsAndReload(gap, gap, targetWorkspace);
    aerospace.setPreviousWorkspaceLayoutMode(LAYOUT_MODE.CONCENTRATE);
  }
}

export function handleToggleTerminal() {
  logger.info('test');
  const terminalWindow = aerospace.findWindow(TERMINAL as string);
  if (!terminalWindow) return;

  if (String(terminalWindow.workspace) === TERMINAL_WORKSPACE) {
    const activeWorkspaceName = aerospace.getActiveWorkspaceName();
    aerospace.moveNodeToWorkSpace(
      terminalWindow.windowId,
      activeWorkspaceName ?? TERMINAL_WORKSPACE
    );
    aerospace.focus(terminalWindow.windowId);
  } else {
    aerospace.moveNodeToWorkSpace(terminalWindow.windowId, TERMINAL_WORKSPACE);
  }
}

export function handleOnFocusChanged() {
  let localLogger = logger.child({ context: 'handleOnFocusChanged' });
  const activeWorkspaceName = aerospace.getActiveWorkspaceName();
  if (activeWorkspaceName === null) {
    logger.error('Failed to determine active workspace');
    return;
  }

  const workspaceKey = String(activeWorkspaceName);
  const workspaceState: WorkspaceState | undefined =
    aerospace.aerospaceRun.workspaceState[workspaceKey];
  const currentWorkspaceMode = workspaceState?.layoutMode ?? LAYOUT_MODE.FALSE;

  localLogger = localLogger.child({ workspaceKey, workspaceState, currentWorkspaceMode });

  if (currentWorkspaceMode === LAYOUT_MODE.CONCENTRATE) {
    const windowsInCurrentWorkspace = (aerospace.listWindows(activeWorkspaceName) ?? []).filter(
      win => win.windowLayout !== 'floating'
    );

    const currentWindowCount = windowsInCurrentWorkspace.length;

    localLogger = localLogger.child({
      currentWindowCount,
      workspaceStateCount: workspaceState?.windowCount,
    });

    if (workspaceState?.windowCount === currentWindowCount) {
      localLogger.debug(`Skipping gap update because window count is unchanged`);
    } else {
      const gap = computeGapForWorkspace(activeWorkspaceName, windowsInCurrentWorkspace);
      localLogger.debug({ gap }, 'Setting new gap');
      aerospace.setOuterGapsAndReload(gap, gap, activeWorkspaceName);
      aerospace.aerospaceRun.workspaceState[workspaceKey] = {
        layoutMode: LAYOUT_MODE.CONCENTRATE,
        windowCount: currentWindowCount,
      };
      aerospace.persist();
    }
  }
}

export function handleArgs(args: string[]) {
  logger.info(`Processing args ${args.length === 0 ? 'empty' : args}`);

  if (args[0] === 'on-workspace-change') {
    const targetWorkspace = process.env.AEROSPACE_FOCUSED_WORKSPACE;
    const previousWorkspace = process.env.AEROSPACE_PREV_WORKSPACE;
    handleWorkspaceChange(
      parseInt(String(targetWorkspace), 10),
      parseInt(String(previousWorkspace), 10)
    );
  }

  if (args[0] === 'on-focus-changed') {
    handleOnFocusChanged();
  }

  if (args[0] === 'toggle-terminal') {
    handleToggleTerminal();
  }

  if (args[0] === 'concentrate-mode') {
    logger.info('concentrate mode');
    handleConcentrateMode();
  }
}

export function main() {
  logger.info(`Aerospace application started`);
  const args = process.argv.slice(2);
  handleArgs(args);
}
