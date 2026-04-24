import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutMode } from './types.js';

const existsSync = vi.fn();
const readFileSync = vi.fn();
const writeFileSync = vi.fn();

vi.mock('fs', () => ({
  existsSync,
  readFileSync,
  writeFileSync,
}));

vi.mock('./commands.js', () => ({
  runCommandSync: vi.fn(),
  replaceTomlValues: vi.fn(),
}));

vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('AeroSpace load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSync.mockReturnValue(false);
  });

  it('loads a valid persisted runtime state', async () => {
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(
      JSON.stringify({
        previousWorkspace: 2,
        workspaceState: {
          '1': { layoutMode: LayoutMode.CONCENTRATE, windowCount: 5 },
        },
        screens: [{ x: 0, y: 0, width: 1440, height: 900, name: 'Built-in Display' }],
      })
    );

    const { AeroSpace } = await import('./aerospace.js');
    const instance = new AeroSpace();

    expect(instance.aerospaceRun.previousWorkspace).toBe(2);
    expect(instance.aerospaceRun.screens).toEqual([
      { x: 0, y: 0, width: 1440, height: 900, name: 'Built-in Display' },
    ]);
    expect(instance.aerospaceRun.workspaceState['1'].layoutMode).toBe(LayoutMode.CONCENTRATE);
  });

  it('initializes when persisted runtime state fails zod validation', async () => {
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(JSON.stringify({ invalid: 'state' }));

    const { AeroSpace } = await import('./aerospace.js');
    const proto = AeroSpace.prototype as unknown as { getScreensFromSwift: () => unknown };
    vi.spyOn(proto, 'getScreensFromSwift').mockReturnValue([
      { x: 0, y: 0, width: 1440, height: 900, name: 'Built-in Display' },
    ]);

    const instance = new AeroSpace();

    expect(writeFileSync).toHaveBeenCalled();
    expect(instance.aerospaceRun.previousWorkspace).toBe(0);
    expect(instance.aerospaceRun.workspaceState['1'].layoutMode).toBe(LayoutMode.FALSE);
  });
});
