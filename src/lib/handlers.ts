import { Argument, Command, InvalidArgumentError } from 'commander';

import { LayoutMode, TERMINAL_WORKSPACE, TERMINAL } from './types.js';
import type { WorkspaceState, WindowInfo } from './types.js';
import { LOGGER, config } from '../registry.js';
import { computeGapForWorkspace, parseResizeSpec, setNewWorkspaceLayout } from './utils.js';
import { aerospace } from './aerospace.js';

const VALID_RESIZE_MODES = ['smart', 'smart-opposite', 'width', 'height'] as const;

type ResizeMode = (typeof VALID_RESIZE_MODES)[number];

const logger = LOGGER.child({ module: 'handlers' });

export function handleWorkspaceChange(
  targetWorkspace: number | string,
  previousWorkspace: number | string
) {
  aerospace.aerospaceRun.previousWorkspace = Number(targetWorkspace);
  aerospace.persist();

  const targetWorkspaceKey = String(targetWorkspace);
  const previousWorkspaceKey = String(previousWorkspace);
  const targetWorkspaceState: WorkspaceState | undefined =
    aerospace.aerospaceRun.workspaceState[targetWorkspaceKey];
  const previousWorkspaceState: WorkspaceState | undefined =
    aerospace.aerospaceRun.workspaceState[previousWorkspaceKey];
  const targetWorkspaceLayoutMode = targetWorkspaceState
    ? targetWorkspaceState.layoutMode
    : LayoutMode.FALSE;
  const previousWorkspaceLayoutMode = previousWorkspaceState
    ? previousWorkspaceState.layoutMode
    : LayoutMode.FALSE;
  setNewWorkspaceLayout(previousWorkspaceLayoutMode, targetWorkspaceLayoutMode, targetWorkspace);
}

export function handleConcentrateMode() {
  const previousWorkspaceKey = String(aerospace.aerospaceRun.previousWorkspace);
  const previousWorkspaceState: WorkspaceState | undefined =
    aerospace.aerospaceRun.workspaceState[previousWorkspaceKey];
  const previousWorkspaceLayoutMode = previousWorkspaceState
    ? previousWorkspaceState.layoutMode
    : LayoutMode.FALSE;

  let localLogger = logger.child({
    context: handleConcentrateMode.name,
    previousWorkspaceKey,
    previousWorkspaceLayoutMode,
  });

  if (previousWorkspaceLayoutMode === LayoutMode.CONCENTRATE) {
    localLogger = localLogger.child({ gaps: [0, 0] });
    const targetWorkspace = aerospace.aerospaceRun.previousWorkspace;
    aerospace.setOuterGapsAndReload(0, 0, targetWorkspace);
    aerospace.setPreviousWorkspaceLayoutMode(LayoutMode.FALSE);
  } else {
    const targetWorkspace = aerospace.aerospaceRun.previousWorkspace;
    const gap = computeGapForWorkspace(targetWorkspace);
    localLogger = localLogger.child({ gaps: [gap, gap] });
    aerospace.setOuterGapsAndReload(gap, gap, targetWorkspace);
    aerospace.setPreviousWorkspaceLayoutMode(LayoutMode.CONCENTRATE);
  }

  localLogger.debug('Change of concentration mode has been handled ');
}

export function handleToggleTerminal() {
  let localLogger = logger.child({ context: handleToggleTerminal.name });
  localLogger.debug('Handling');
  const terminalWindow = aerospace.findWindow(TERMINAL);

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
  let localLogger = logger.child({ context: handleOnFocusChanged.name });

  const activeWorkspaceName = aerospace.getActiveWorkspaceName();
  if (activeWorkspaceName === null) {
    localLogger.error('Failed to determine active workspace');
    return;
  }

  const workspaceKey = String(activeWorkspaceName);
  const workspaceState: WorkspaceState | undefined =
    aerospace.aerospaceRun.workspaceState[workspaceKey];
  const currentWorkspaceMode = workspaceState ? workspaceState.layoutMode : LayoutMode.FALSE;
  const workspaceStateCount = workspaceState ? workspaceState.windowCount : undefined;

  localLogger = localLogger.child({ workspaceKey, workspaceState, currentWorkspaceMode });

  if (currentWorkspaceMode === LayoutMode.CONCENTRATE) {
    const windowsInCurrentWorkspace = (aerospace.listWindows(activeWorkspaceName) ?? []).filter(
      (windows): windows is WindowInfo =>
        windows.windowLayout !== 'floating' && windows.windowLayout !== 'v_accordion'
    );

    localLogger.info({
      windows: windowsInCurrentWorkspace,
    });

    const currentWindowCount = windowsInCurrentWorkspace.length;

    localLogger = localLogger.child({
      currentWindowCount,
      workspaceStateCount,
    });

    if (workspaceStateCount === currentWindowCount) {
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

function getMonitorDimension(mode: 'width' | 'height'): number | null {
  const display = aerospace.getCurrentDisplay();
  if (!display) {
    return null;
  }

  const screen = aerospace.aerospaceRun.screens.find(screen => screen.name === display.monitorName);
  return screen ? (mode === 'width' ? screen.width : screen.height) : null;
}

export function handleResizeToggle(mode: ResizeMode, targets: string[]) {
  const localLogger = logger.child({
    context: handleResizeToggle.name,
    mode,
    targets,
  });

  if (targets.length < 2) {
    localLogger.error('At least two resize targets are required');
    return;
  }

  const parsedSpecs = targets.map(target => ({
    target,
    spec: parseResizeSpec(target),
  }));

  if (parsedSpecs.some(entry => entry.spec === null)) {
    localLogger.error('Resize targets must be finite numbers, deltas (+/-n), or percentages (n%)');
    return;
  }

  const focusedWindow = aerospace.getFocusedWindow();
  if (!focusedWindow) {
    localLogger.error('No focused window found');
    return;
  }

  const windowId = String(focusedWindow['window-id']);
  const stateKey = `${mode}:${windowId}`;
  const previousTarget = aerospace.aerospaceRun.resizeToggleState[stateKey];
  const currentIndex = previousTarget === undefined ? -1 : targets.indexOf(previousTarget);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % targets.length;
  const nextTarget = targets[nextIndex];
  const parsedSpec = parsedSpecs[nextIndex].spec!;

  let resizeInput: number | string;
  if (parsedSpec.kind === 'percent') {
    if (mode !== 'width' && mode !== 'height') {
      localLogger.error('Percent resize is only supported for width or height');
      return;
    }

    const monitorDimension = getMonitorDimension(mode);
    if (monitorDimension === null) {
      localLogger.error('Unable to resolve monitor dimension for percent resize');
      return;
    }

    resizeInput = String(Math.round((monitorDimension * parsedSpec.value) / 100));
  } else if (parsedSpec.kind === 'absolute') {
    resizeInput = String(parsedSpec.value);
  } else {
    resizeInput = parsedSpec.value;
  }

  if (resizeInput === 0) {
    localLogger.debug('Window already at target size');
    return;
  }

  const result = aerospace.resize(mode, resizeInput, { windowId });
  if (result === null) {
    localLogger.error('Failed to resize focused window');
    return;
  }

  aerospace.aerospaceRun.resizeToggleState = {
    ...aerospace.aerospaceRun.resizeToggleState,
    [stateKey]: nextTarget,
  };
  aerospace.persist();

  localLogger.info({ windowId, nextTarget, resizeInput }, 'Resized focused window');
}

export function handleMoveToWorkspace(workspace: string) {
  const focusedWindow = aerospace.getFocusedWindow();

  if (focusedWindow) {
    aerospace.moveNodeToWorkSpace(focusedWindow['window-id'], workspace);
    if (focusedWindow['app-name'] !== 'Code') {
      aerospace.move('right', { windowId: focusedWindow['window-id'] });
    }
  }

  logger.info({ focusedWindow, workspace }, 'done handling test');
}

export function main() {
  const mainLogger = logger.child({ context: 'main' });
  mainLogger.info({ args: process.argv.slice(2) }, `Aerospace application started`);

  const program = new Command();
  program.name('aerospacer').description('Aerospace utilities CLI');

  program
    .command('on-workspace-change')
    .description('Handle a workspace change event')
    .option('--target <number>', 'Target workspace number')
    .option('--previous <number>', 'Previous workspace number')
    .action((options: { target?: string; previous?: string }) => {
      handleWorkspaceChange(
        Number(options.target ?? config.AEROSPACE_FOCUSED_WORKSPACE),
        Number(options.previous ?? config.AEROSPACE_PREV_WORKSPACE)
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
      mainLogger.info('concentrate mode');
      handleConcentrateMode();
    });

  program
    .command('refresh-screens')
    .description('Refersh resolution in state')
    .action(() => {
      mainLogger.info('refresh resolution');
      aerospace.persistResolutionOfScreens();
    });

  program
    .command('resize-toggle')
    .description('Toggle through multiple resize targets for the focused window')
    .addArgument(new Argument('<mode>', 'resize mode').choices(VALID_RESIZE_MODES))
    .argument(
      '<targets...>',
      'resize targets; each can be a value, signed delta, or percent like 50% (at least two)',
      (value: string, targets: string[] = []) => {
        logger.info({ value });
        if (!parseResizeSpec(value)) {
          throw new InvalidArgumentError(
            'Resize targets must be finite numbers, deltas (+/-n), or percentages (n%)'
          );
        }
        return [...targets, value];
      }
    )
    .action((mode: ResizeMode, targets: string[]) => {
      if (targets.length < 2) {
        logger.error('Minimum two targets must be given');
        throw new InvalidArgumentError('Minimum two targets must be given');
      }

      handleResizeToggle(mode, targets);
    });

  program
    .command('test')
    .description('test')
    .argument('<workspace>', 'workspace')
    .action((workspace: string) => {
      handleMoveToWorkspace(workspace);
    });
  try {
    program.parse(process.argv);
  } catch (error: unknown) {
    logger.error(error, 'Unhandled exception');
  }
}
