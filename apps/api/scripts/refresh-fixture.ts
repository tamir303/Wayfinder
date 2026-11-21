import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const [query = 'tel aviv', name = 'tel-aviv'] = process.argv.slice(2);
const key = process.env.SERPAPI_KEY;
if (!key) throw new Error('SERPAPI_KEY is required (set it in apps/api/.env)');

const url = new URL('https://serpapi.com/search.json');
url.search = new URLSearchParams({
  engine: 'google_flights_autocomplete',
  q: query,
  hl: 'en',
  gl: 'us',
  api_key: key,
}).toString();

const main = async () => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`SerpAPI responded ${response.status}`);
  const body = (await response.json()) as Record<string, unknown>;

  // Keep only what the mapper needs. search_metadata holds private archive URLs.
  const fixture = { search_parameters: { engine: 'google_flights_autocomplete', q: query, hl: 'en', gl: 'us' }, suggestions: body.suggestions };

  const target = join(__dirname, '../test/fixtures/google_flights_autocomplete', `${name}.json`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`wrote ${target}`);
};

void main();
