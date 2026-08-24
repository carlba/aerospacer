import { Command } from 'commander';

import { LOGGER, config } from '../registry.js';
import { notifyTileDrop, toggleTileDropFocusMode } from './utils.js';
import { aerospace } from './aerospace.js';

const logger = LOGGER.child({ module: 'handlers' });

export async function handleWorkspaceChange(
  targetWorkspace: number | string,
  previousWorkspace: number | string
) {
  const targetWorkspaceKey = String(targetWorkspace);
  const previousWorkspaceKey = String(previousWorkspace);

  const localLogger = logger.child({
    context: handleWorkspaceChange.name,
    targetWorkspaceKey,
    previousWorkspaceKey,
  });

  localLogger.info('Handling workspace change');

  await notifyTileDrop(targetWorkspaceKey);
}

export function handleOnFocusChanged() {
  const localLogger = logger.child({ context: handleOnFocusChanged.name });
  localLogger.info('Handling focuschange');
}

export async function handleToggleFocusMode() {
  const localLogger = logger.child({ context: handleToggleFocusMode.name });

  const currentWorkspaceName = String(aerospace.getActiveWorkspaceName());

  localLogger.info({ currentWorkspaceName }, 'Current Workspace info');

  await toggleTileDropFocusMode(currentWorkspaceName);

  localLogger.info('Handling toggle focusmode');
}

export function handleRefreshResolutionInState() {
  aerospace.persistResolutionOfScreens();
}

export async function main() {
  const mainLogger = logger.child({ context: 'main' });
  mainLogger.info({ args: process.argv.slice(2) }, `Aerospace application started`);

  const program = new Command();
  program.name('aerospacer').description('Aerospace utilities CLI');

  program
    .command('on-workspace-change')
    .description('Handle a workspace change event')
    .option('--target <number>', 'Target workspace number')
    .option('--previous <number>', 'Previous workspace number')
    .action(async (options: { target?: string; previous?: string }) => {
      await handleWorkspaceChange(
        Number(options.target ?? config.AEROSPACE_FOCUSED_WORKSPACE),
        Number(options.previous ?? config.AEROSPACE_PREV_WORKSPACE)
      );
    });

  program
    .command('on-focus-changed')
    .description('Handle an on-focus-changed event')
    .action(handleOnFocusChanged);

  program
    .command('toggle-focus-mode')
    .description('Handle toggle focus-mode events')
    .action(handleToggleFocusMode);

  program
    .command('refresh-screens')
    .description('Refersh resolution in state')
    .action(() => {
      mainLogger.info('refresh resolution');
      aerospace.persistResolutionOfScreens();
    });

  await program.parseAsync();
}
