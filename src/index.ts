import { fileURLToPath } from 'url';

import logger from './logger.js';

export function helloWorld() {
  return 'Hello World!';
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  logger.info(helloWorld());
}
