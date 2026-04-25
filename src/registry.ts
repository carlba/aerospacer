import packageJson from '../package.json' with { type: 'json' };
import { envSchema } from './schema.js';
import { initConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';

const PACKAGE_NAME = packageJson.name;

export const bootstrapLogger = createLogger(undefined, 'production').child({
  name: PACKAGE_NAME,
});
export const config = initConfig(envSchema, bootstrapLogger);

export const LOGGER = createLogger(undefined, config.NODE_ENV, {
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: { colorize: true, ignore: 'pid,hostname,context,module' },
        level: 'debug',
      },
      {
        target: 'pino/file',
        options: { destination: config.LOG_FILE_PATH, mkdir: true },
        level: 'debug',
      },
    ],
  },
}).child({ name: PACKAGE_NAME });
