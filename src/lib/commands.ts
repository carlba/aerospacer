import { execSync } from 'child_process';
import { LOGGER, config } from '../registry.js';

const logger = LOGGER.child({ name: 'aerospacer', module: 'commands' });

export function runCommandSync(command: string, timeout = 10000): string | null {
  try {
    const stdout = execSync(command, {
      stdio: 'pipe',
      timeout,
      shell: config.SHELL,
    });
    return stdout.toString();
  } catch (error) {
    logger.error(`Command failed: ${(error as Error).message}`);
    return null;
  }
}
