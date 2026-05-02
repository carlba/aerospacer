import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./commands.js', async () => {
  const actual = await vi.importActual<typeof import('./commands.js')>('./commands.js');
  return {
    ...actual,
    runCommandSync: vi.fn(),
  };
});

import { AeroSpace } from './aerospace.js';
import { runCommandSync } from './commands.js';
import type { AeroSpaceConfig } from './aerospace-config.interface.js';

const mockedRunCommandSync = runCommandSync as unknown as ReturnType<typeof vi.fn>;

describe('AeroSpace.move', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRunCommandSync.mockReturnValue('ok');
  });

  it('builds a bare move command with only a direction', () => {
    const instance = Object.create(AeroSpace.prototype) as AeroSpace;
    instance.move('right');

    expect(mockedRunCommandSync).toHaveBeenCalledWith('aerospace move right');
  });

  it('builds a move command with window id, boundaries, and boundaries action', () => {
    const instance = Object.create(AeroSpace.prototype) as AeroSpace;
    instance.move('left', {
      windowId: '123',
      boundaries: 'screen',
      boundariesAction: 'push',
    });

    expect(mockedRunCommandSync).toHaveBeenCalledWith(
      'aerospace move --window-id 123 --boundaries screen --boundaries-action push left'
    );
  });

  it('returns null for invalid direction', () => {
    const instance = Object.create(AeroSpace.prototype) as AeroSpace;
    const result = instance.move('diagonal' as unknown as 'left' | 'down' | 'up' | 'right');

    expect(result).toBeNull();
    expect(mockedRunCommandSync).not.toHaveBeenCalled();
  });
});

describe('AeroSpace.resize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRunCommandSync.mockReturnValue('ok');
  });

  it('builds a bare resize command with a positive number as absolute target', () => {
    const instance = Object.create(AeroSpace.prototype) as AeroSpace;
    const result = instance.resize('smart', 5);

    expect(mockedRunCommandSync).toHaveBeenCalledWith('aerospace resize smart 5');
    expect(result).toBe('ok');
  });

  it('builds a bare resize command with an absolute amount string', () => {
    const instance = Object.create(AeroSpace.prototype) as AeroSpace;
    const result = instance.resize('width', '1000');

    expect(mockedRunCommandSync).toHaveBeenCalledWith('aerospace resize width 1000');
    expect(result).toBe('ok');
  });

  it('builds a resize command with window id and negative amount', () => {
    const instance = Object.create(AeroSpace.prototype) as AeroSpace;
    const result = instance.resize('width', -20, { windowId: '123' });

    expect(mockedRunCommandSync).toHaveBeenCalledWith('aerospace resize --window-id 123 width -20');
    expect(result).toBe('ok');
  });

  it('returns null for invalid mode', () => {
    const instance = Object.create(AeroSpace.prototype) as AeroSpace;
    const result = instance.resize('invalid-mode' as unknown as 'smart', 5);

    expect(result).toBeNull();
    expect(mockedRunCommandSync).not.toHaveBeenCalled();
  });

  it('returns null for invalid amount', () => {
    const instance = Object.create(AeroSpace.prototype) as AeroSpace;
    const result = instance.resize('height', NaN);

    expect(result).toBeNull();
    expect(mockedRunCommandSync).not.toHaveBeenCalled();
  });

  it('delegates instance resize to static method', () => {
    const instance = Object.create(AeroSpace.prototype) as AeroSpace;
    instance.resize('smart-opposite', 10, { windowId: '456' });

    expect(mockedRunCommandSync).toHaveBeenCalledWith(
      'aerospace resize --window-id 456 smart-opposite 10'
    );
  });

  it('updates gap configuration in config for main screen', () => {
    const instance = Object.create(AeroSpace.prototype) as AeroSpace;
    vi.spyOn(instance, 'readConfig').mockReturnValue({
      gaps: { outer: { left: 0, right: 0 } },
    } as AeroSpaceConfig);

    const mockedInstanceWriteConfig = vi.spyOn(instance, 'writeConfig').mockReturnValue();

    instance.setOuterGapsAndReload(500, 500, 2);

    expect(mockedInstanceWriteConfig).toHaveBeenCalledWith(
      {
        gaps: {
          outer: {
            left: [{ monitor: { main: 500 } }, { monitor: { secondary: 0 } }, 0],
            right: [{ monitor: { main: 500 } }, { monitor: { secondary: 0 } }, 0],
          },
        },
      },
      true
    );
  });

  it('updates gap configuration in config for secondary screen', () => {
    const instance = Object.create(AeroSpace.prototype) as AeroSpace;
    vi.spyOn(instance, 'readConfig').mockReturnValue({
      gaps: { outer: { left: 0, right: 0 } },
    } as AeroSpaceConfig);

    const mockedInstanceWriteConfig = vi.spyOn(instance, 'writeConfig').mockReturnValue();

    instance.setOuterGapsAndReload(500, 500, 10);

    expect(mockedInstanceWriteConfig).toHaveBeenCalledWith(
      {
        gaps: {
          outer: {
            left: [{ monitor: { main: 0 } }, { monitor: { secondary: 500 } }, 0],
            right: [{ monitor: { main: 0 } }, { monitor: { secondary: 500 } }, 0],
          },
        },
      },
      true
    );
  });
});
