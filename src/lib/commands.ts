import { execSync } from 'child_process';
import * as fs from 'fs';
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
export function replaceTomlValues(
  filePath: string,
  entries: { key: string; value: string | number }[]
): void {
  try {
    let fileContent = fs.readFileSync(filePath, 'utf8');
    for (const { key, value } of entries) {
      const regex = new RegExp(`${key}\\s*=.*`, 'g');
      fileContent = fileContent.replace(regex, `${key} = ${String(value)}`);
    }
    fs.writeFileSync(filePath, fileContent, 'utf8');
  } catch (error) {
    logger.error(`Error updating file: ${(error as Error).message}`);
  }
}
