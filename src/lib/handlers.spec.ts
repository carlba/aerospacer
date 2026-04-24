import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutMode } from './types.js';

const setOuterGapsAndReload = vi.fn();
const getCurrentDisplay = vi.fn();
const listWindows = vi.fn();

vi.mock('./aerospace.js', () => ({
  aerospace: {
    setOuterGapsAndReload,
    getCurrentDisplay,
    listWindows,
  },
}));
vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

const { setNewWorkspaceLayout } = await import('./handlers.js');

describe('setNewWorkspaceLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentDisplay.mockReturnValue({ monitorName: 'Built-in Display' });
    listWindows.mockReturnValue([{ windowLayout: 'tiled' }]);
  });

  it('does nothing when the previous and target layout mode are the same', () => {
    setNewWorkspaceLayout(LayoutMode.FALSE, LayoutMode.FALSE, 1);

    expect(setOuterGapsAndReload).not.toHaveBeenCalled();
  });

  it('sets outer gaps for concentrate mode', () => {
    setNewWorkspaceLayout(LayoutMode.FALSE, LayoutMode.CONCENTRATE, 1);

    expect(setOuterGapsAndReload).toHaveBeenCalledWith(524, 524, 1);
  });

  it('sets zero outer gaps for false mode', () => {
    setNewWorkspaceLayout(LayoutMode.CONCENTRATE, LayoutMode.FALSE, 2);

    expect(setOuterGapsAndReload).toHaveBeenCalledWith(0, 0, 2);
  });
});
