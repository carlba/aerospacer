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

export function replaceTomlValue(filePath: string, keyName: string, newValue: string | number) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const regex = new RegExp(`${keyName}\\s*=.*`, 'g');
    const updatedContent = fileContent.replace(regex, `${keyName} = ${newValue}`);
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    logger.info(`Successfully updated ${keyName} to ${newValue}`);
  } catch (error) {
    logger.error(`Error updating file: ${(error as Error).message}`);
  }
}
