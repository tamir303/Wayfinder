// Usage: node scripts/with-env.mjs <dev|staging|prod> <command...>
// Loads .env.<name> (if present) then runs the command with EXPO_PUBLIC_APP_ENV set.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const [name, ...cmd] = process.argv.slice(2);
if (!['dev', 'staging', 'prod'].includes(name) || cmd.length === 0) {
  console.error('usage: with-env.mjs <dev|staging|prod> <command...>');
  process.exit(2);
}
const env = { ...process.env, EXPO_PUBLIC_APP_ENV: name };
const file = `.env.${name}`;
if (name !== 'dev' && !existsSync(file)) {
  console.error(`${file} is missing. Copy ${file}.example and fill it in (use separate staging/prod backends).`);
  process.exit(2);
}
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2];
  }
}
if (name === 'dev') for (const k of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']) env[k] = ''; // blank (not deleted) so Expo's own .env loading cannot re-add real services
spawn(cmd.join(' '), { stdio: 'inherit', shell: true, env }).on('exit', (c) => process.exit(c ?? 1));
