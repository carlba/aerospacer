import { execSync } from 'child_process';
import * as fs from 'fs';
import { logger } from './logger.js';

export function runCommandSync(command: string, timeout = 10000): string | null {
  try {
    const stdout = execSync(command, {
      stdio: 'pipe',
      timeout,
      shell: process.env.SHELL || '/bin/sh',
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
      fileContent = fileContent.replace(regex, `${key} = ${value}`);
    }
    fs.writeFileSync(filePath, fileContent, 'utf8');
    logger.info(`Successfully updated ${entries.map(e => e.key).join(', ')}`);
  } catch (error) {
    logger.error(`Error updating file: ${(error as Error).message}`);
  }
}
