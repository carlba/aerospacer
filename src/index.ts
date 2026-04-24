#!/usr/bin/env node

import { main } from './lib/handlers.js';

try {
  main();
} catch (error) {
  // If handlers/logger fail before logger initialized, fall back to console
  console.error(error);
  process.exit(1);
}
