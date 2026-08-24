import { LOGGER } from '../registry.js';
import { LayoutMode } from './types.js';
import type { WindowInfo } from './types.js';
import { aerospace } from './aerospace.js';
import { TILE_DROP_URL } from '../consts.js';

type ResizeSpec =
  | { kind: 'absolute'; value: number }
  | { kind: 'delta'; value: number }
  | { kind: 'percent'; value: number };

const DESIRED_WINDOW_WIDTH = 1460;
const MIN_GAP = 64;

const logger = LOGGER.child({ module: 'utils' });

export function parseResizeSpec(value: string): ResizeSpec | null {
  if (value.endsWith('%')) {
    const numberValue = Number(value.slice(0, -1));
    if (!Number.isFinite(numberValue)) {
      return null;
    }
    return { kind: 'percent', value: numberValue };
  }

  if (value.startsWith('+') || value.startsWith('-')) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      return null;
    }
    return { kind: 'delta', value: numberValue };
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return null;
  }
  return { kind: 'absolute', value: numberValue };
}

// computeGapForWorkspace needs the `aerospace` instance and displayResolution
export function computeGapForWorkspace(
  workspace: string | number,
  prefetchedWindows?: WindowInfo[]
): number {
  const localLogger = logger.child({
    context: computeGapForWorkspace.name,
    desired: DESIRED_WINDOW_WIDTH,
  });

  const currentDisplay = aerospace.getCurrentDisplay()?.monitorName ?? 'Built-in Display';
  const monitorWidth =
    aerospace.aerospaceRun.screens.find(screen => screen.name === currentDisplay)?.width ?? 2400;

  const allWindows = prefetchedWindows ?? aerospace.listWindows(workspace) ?? [];
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
    context: setNewWorkspaceLayout.name,
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
        // const gap = computeGapForWorkspace(targetWorkspace);
        // aerospace.setOuterGapsAndReload(gap, gap, targetWorkspace);
        aerospace.setPreviousWorkspaceLayoutMode(LayoutMode.CONCENTRATE);
      }
      break;
    case LayoutMode.FALSE:
      localLogger.debug('Switching workspace');
      // aerospace.setOuterGapsAndReload(0, 0, targetWorkspace);
      aerospace.setPreviousWorkspaceLayoutMode(LayoutMode.FALSE);
      break;
    default:
      localLogger.error(`Unknown layout mode`);
  }
}

export async function notifyTileDrop(workspaceNumber: string) {
  const payload = { active: true };
  try {
    const res = await fetch(TILE_DROP_URL + `/workspaces/${workspaceNumber}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    logger.info(
      { result: await res.json().then(), workspaceNumber },
      'Workspace notification sent'
    );
  } catch (err) {
    logger.error({ err: String(err) }, 'Failed to send workspace notification');
  }
}

export async function toggleTileDropFocusMode(workspaceNumber: string) {
  try {
    const res = await fetch(TILE_DROP_URL + `/workspaces/${workspaceNumber}/toggle-focus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    logger.info({ result: await res.json().then(), workspaceNumber }, 'Toggle Focus Mode sent');
  } catch (err) {
    logger.error({ err: String(err) }, 'Failed to send toggle focus request');
  }
}

export function getMonitorDimension(mode: 'width' | 'height'): number | null {
  const display = aerospace.getCurrentDisplay();
  if (!display) {
    return null;
  }

  const screen = aerospace.aerospaceRun.screens.find(screen => screen.name === display.monitorName);
  return screen ? (mode === 'width' ? screen.width : screen.height) : null;
}
