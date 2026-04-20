import pino from 'pino';
import { LOG_FILE_PATH } from './types.js';

const isDevelopment = process.env.NODE_ENV !== 'production';

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
        options: { destination: LOG_FILE_PATH, mkdir: true },
        level: 'debug',
      },
    ],
  },
});
