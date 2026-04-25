import { Command } from 'commander';
import { aerospace } from './aerospace.js';
import { logger } from './logger.js';
import { LayoutMode, TERMINAL_WORKSPACE, TERMINAL } from './types.js';
import type { WorkspaceState, WindowInfo } from './types.js';

const DESIRED_WINDOW_WIDTH = 1280;
const MIN_GAP = 64;

// computeGapForWorkspace needs the `aerospace` instance and displayResolution
export function computeGapForWorkspace(
  workspace: string | number,
  prefetchedWindows?: WindowInfo[]
): number {
  const localLogger = logger.child({
    name: computeGapForWorkspace.name,
    desired: DESIRED_WINDOW_WIDTH,
  });

  const currentDisplay = aerospace.getCurrentDisplay()?.monitorName ?? 'Built-in Display';
  const monitorWidth =
    aerospace.aerospaceRun.screens.find(screen => screen.name === currentDisplay)?.width ?? 2400;

  const allWindows =
    prefetchedWindows ?? ((aerospace.listWindows(workspace) ?? []) as WindowInfo[]);
  const windows = allWindows.filter(
    (window: WindowInfo) =>
      window.windowLayout !== 'floating' && window.windowLayout !== 'v_accordion'
  );

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

  localLogger.debug(
    { workspace, monitorWidth, windowsCount: windows.length, gap, desired: DESIRED_WINDOW_WIDTH },
    'Computed Gap for Workspace'
  );
  return gap;
}

export function setNewWorkspaceLayout(
  previousWorkspaceLayoutMode: LayoutMode,
  targetWorkspaceLayoutMode: LayoutMode,
  targetWorkspace: string | number
) {
  const localLogger = logger.child({
    name: setNewWorkspaceLayout.name,
    previousWorkspaceLayoutMode,
    targetWorkspaceLayoutMode,
    targetWorkspace,
  });

  switch (targetWorkspaceLayoutMode) {
    case previousWorkspaceLayoutMode:
      localLogger.debug(`Target and Previous workspace layout same not switching`);
      break;
    case LayoutMode.CONCENTRATE:
      {
        localLogger.debug('Switching workspace');
        const gap = computeGapForWorkspace(targetWorkspace);
        aerospace.setOuterGapsAndReload(gap, gap, targetWorkspace);
        aerospace.setPreviousWorkspaceLayoutMode(LayoutMode.CONCENTRATE);
      }
      break;
    case LayoutMode.FALSE:
      localLogger.debug('Switching workspace');
      aerospace.setOuterGapsAndReload(0, 0, targetWorkspace);
      aerospace.setPreviousWorkspaceLayoutMode(LayoutMode.FALSE);
      break;
    default:
      localLogger.error(`Unknown layout mode`);
  }
}

export function handleWorkspaceChange(
  targetWorkspace: number | string,
  previousWorkspace: number | string
) {
  aerospace.aerospaceRun.previousWorkspace = Number(targetWorkspace);
  aerospace.persist();

  logger.info('got here');

  const targetWorkspaceKey = String(targetWorkspace);
  const previousWorkspaceKey = String(previousWorkspace);
  const targetWorkspaceLayoutMode =
    aerospace.aerospaceRun.workspaceState[targetWorkspaceKey]?.layoutMode ?? LayoutMode.FALSE;
  const previousWorkspaceLayoutMode =
    aerospace.aerospaceRun.workspaceState[previousWorkspaceKey]?.layoutMode ?? LayoutMode.FALSE;
  setNewWorkspaceLayout(previousWorkspaceLayoutMode, targetWorkspaceLayoutMode, targetWorkspace);
}

export function handleConcentrateMode() {
  const previousWorkspaceKey = String(aerospace.aerospaceRun.previousWorkspace);
  const previousWorkspaceLayoutMode =
    aerospace.aerospaceRun.workspaceState[previousWorkspaceKey].layoutMode ?? LayoutMode.FALSE;

  const localLogger = logger.child({
    name: handleConcentrateMode.name,
    previousWorkspaceKey,
    previousWorkspaceLayoutMode,
  });

  if (previousWorkspaceLayoutMode === LayoutMode.CONCENTRATE) {
    localLogger.debug(`Set ${LayoutMode.FALSE}-mode`);
    aerospace.setOuterLeftRightGapsAndReload(0);
    aerospace.setPreviousWorkspaceLayoutMode(LayoutMode.FALSE);
  } else if (previousWorkspaceLayoutMode === LayoutMode.FALSE) {
    const targetWorkspace = aerospace.aerospaceRun.previousWorkspace;
    const gap = computeGapForWorkspace(targetWorkspace);
    aerospace.setOuterGapsAndReload(gap, gap, targetWorkspace);
    aerospace.setPreviousWorkspaceLayoutMode(LayoutMode.CONCENTRATE);
  }
}

export function handleToggleTerminal() {
  let localLogger = logger.child({ name: handleToggleTerminal.name });
  localLogger.debug('Handling');
  const terminalWindow = aerospace.findWindow(TERMINAL as string);

  if (!terminalWindow) {
    localLogger.debug('No terminalwindow was found doing nothing');
    return;
  }

  localLogger = localLogger.child({ appName: terminalWindow.appName });

  if (String(terminalWindow.workspace) === TERMINAL_WORKSPACE) {
    const activeWorkspaceName = aerospace.getActiveWorkspaceName();
    localLogger.debug(
      { workspaceName: activeWorkspaceName },
      'Moving terminal to active workspace'
    );

    aerospace.moveNodeToWorkSpace(
      terminalWindow.windowId,
      activeWorkspaceName ?? TERMINAL_WORKSPACE
    );
    aerospace.focus(terminalWindow.windowId);
  } else {
    localLogger.debug(
      { workspaceName: TERMINAL_WORKSPACE },
      'Moving terminal to Terminal workspace'
    );
    aerospace.moveNodeToWorkSpace(terminalWindow.windowId, TERMINAL_WORKSPACE);
  }
}

export function handleOnFocusChanged() {
  let localLogger = logger.child({ name: 'handleOnFocusChanged' });

  const activeWorkspaceName = aerospace.getActiveWorkspaceName();
  if (activeWorkspaceName === null) {
    logger.error('Failed to determine active workspace');
    return;
  }

  const workspaceKey = String(activeWorkspaceName);
  const workspaceState: WorkspaceState | undefined =
    aerospace.aerospaceRun.workspaceState[workspaceKey];
  const currentWorkspaceMode = workspaceState?.layoutMode ?? LayoutMode.FALSE;

  localLogger = localLogger.child({ workspaceKey, workspaceState, currentWorkspaceMode });

  if (currentWorkspaceMode === LayoutMode.CONCENTRATE) {
    const windowsInCurrentWorkspace = (aerospace.listWindows(activeWorkspaceName) ?? []).filter(
      windows => windows.windowLayout !== 'floating' && windows.windowLayout !== 'v_accordion'
    );

    logger.info({
      windows: windowsInCurrentWorkspace,
    });

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
        layoutMode: LayoutMode.CONCENTRATE,
        windowCount: currentWindowCount,
      };
      aerospace.persist();
    }
  }
  localLogger.debug('No action required');
}

export function handleRefreshResolutionInState() {
  aerospace.persistResolutionOfScreens();
}

export function main() {
  const mainLogger = logger.child({ name: 'main' });
  mainLogger.info({ args: process.argv.slice(2) }, `Aerospace application started`);

  const program = new Command();
  program.name('aerospacer').description('Aerospace utilities CLI');

  program
    .command('on-workspace-change')
    .description('Handle a workspace change event')
    .option('--target <number>', 'Target workspace number')
    .option('--previous <number>', 'Previous workspace number')
    .action(options => {
      handleWorkspaceChange(
        Number(options.target ?? process.env.AEROSPACE_FOCUSED_WORKSPACE),
        Number(options.previous ?? process.env.AEROSPACE_PREV_WORKSPACE)
      );
    });

  program
    .command('on-focus-changed')
    .description('Handle an on-focus-changed event')
    .action(handleOnFocusChanged);

  program
    .command('toggle-terminal')
    .description('Toggle the terminal workspace location')
    .action(handleToggleTerminal);

  program
    .command('concentrate-mode')
    .description('Toggle concentrate mode')
    .action(() => {
      logger.info('concentrate mode');
      handleConcentrateMode();
    });

  program
    .command('refresh-screens')
    .description('Refersh resolution in state')
    .action(() => {
      logger.info('refresh resolution');
      aerospace.persistResolutionOfScreens();
    });

  program.parse(process.argv);
}
