// load-env.ts — must be the very first import in server.ts
// Loads .env from the project root so ANTHROPIC_API_KEY etc. are available
// before any SDK modules initialize (SDK reads env vars at module load time).

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

// This file lives at runtime/load-env.ts, so ../ is the project root
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env');

try {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    // Never overwrite vars already set in the real environment
    if (key && !(key in process.env)) process.env[key] = val;
  }
  console.log('[runtime] .env loaded from', envPath);
} catch {
  console.warn('[runtime] No .env file found at', envPath, '— relying on existing environment variables');
}
