import pino from 'pino';
// import type { Logger as PinoLogger } from 'pino';
// import { LOG_FILE_PATH } from './types.js';

const isDevelopment = process.env.NODE_ENV !== 'production';

function getCaller(): string {
  const err = new Error();
  const stack = err.stack?.split('\n') ?? [];

  console.log(stack);
  for (let i = 2; i < stack.length; i++) {
    const line = stack[i].trim();
    if (
      !line.includes('src/lib/logger') &&
      !line.includes('logger.ts') &&
      !line.includes('logger.js') &&
      !line.includes('node:internal') &&
      !line.includes('node_modules')
    ) {
      const match = line.match(/at (.+?) \(/) || line.match(/at (.+)$/);
      return match ? match[1] : 'unknown';
    }
  }
  return 'unknown';
}

export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: { colorize: true },
        level: 'debug',
      },
      {
        target: 'pino/file',
        options: { destination: '/tmp/aerospacer.log', mkdir: true },
        level: 'debug',
      },
    ],
  },
  mixin() {
    return { context: getCaller() };
  },
});
