import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z
      .string()
      .trim()
      .default('development')
      .pipe(z.enum(['production', 'development', 'test'])),
    HOME: z.string().default(''),
    SHELL: z.string().default('/bin/sh'),
    AEROSPACE_FOCUSED_WORKSPACE: z.string().trim().optional(),
    AEROSPACE_PREV_WORKSPACE: z.string().trim().optional(),
    LOG_FILE_PATH: z.string().trim().default('/tmp/aerospacer.log'),
    RUN_FILE_PATH: z.string().trim().default('/tmp/aerospacer.run'),
  })
  .transform(raw => ({
    NODE_ENV: raw.NODE_ENV,
    isDevelopment: raw.NODE_ENV !== 'production',
    HOME: raw.HOME,
    SHELL: raw.SHELL,
    AEROSPACE_FOCUSED_WORKSPACE: raw.AEROSPACE_FOCUSED_WORKSPACE,
    AEROSPACE_PREV_WORKSPACE: raw.AEROSPACE_PREV_WORKSPACE,
    LOG_FILE_PATH: raw.LOG_FILE_PATH,
    RUN_FILE_PATH: raw.RUN_FILE_PATH,
  }));

export type Config = z.infer<typeof envSchema>;
