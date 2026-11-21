/* global process, console */
// Usage: node scripts/with-env.mjs <dev|staging|prod> <command...>
// dev = mock backend (fixtures, in-memory cache/db, any bearer token), no secrets needed.
// staging/prod load .env.<name> and use the real services.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const [name, ...cmd] = process.argv.slice(2);
if (!['dev', 'staging', 'prod'].includes(name) || cmd.length === 0) {
  console.error('usage: with-env.mjs <dev|staging|prod> <command...>');
  process.exit(2);
}
const env = { ...process.env, APP_ENV: name, MOCK_DATA: String(name === 'dev') };
const file = `.env.${name}`;
if (name !== 'dev') {
  if (!existsSync(file)) {
    console.error(`${file} is missing. Copy ${file}.example and fill it in (use separate staging/prod services).`);
    process.exit(2);
  }
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2];
  }
  env.APP_ENV = name;
  env.MOCK_DATA = 'false';
}
spawn(cmd.join(' '), { stdio: 'inherit', shell: true, env }).on('exit', (c) => process.exit(c ?? 1));
