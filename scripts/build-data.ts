/*
 * Build public/data/seasons.json from the survivoR tables.
 *
 *   npm run data              use cached tables in data/raw, download missing ones
 *   npm run data -- --refresh download every table again
 *
 * Also reads data/subtitles.json (hand-edited), data/purple-rock-rankings.json
 * (written by npm run rankings) and,
 * when present, public/photos/manifest.json (written by npm run photos).
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { convert, type RawTables, type Rankings } from './lib/convert.ts';
import { applyPhotos, type PhotoManifest } from './lib/photos.ts';

const BASE = 'https://raw.githubusercontent.com/doehm/survivoR/master';
const TABLES: (keyof RawTables)[] = [
  'castaways', 'castaway_details', 'tribe_mapping', 'tribe_colours', 'season_summary', 'vote_history', 'challenge_results', 'jury_votes',
];
const RAW = 'data/raw';
const OUT = 'public/data';
const refresh = process.argv.includes('--refresh');

async function fetchTo(url: string, path: string): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': 'survivor-season-visualizer build script' } });
  if (!res.ok) throw new Error(`GET ${url}: ${res.status} ${res.statusText}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

async function loadTables(): Promise<RawTables> {
  await mkdir(RAW, { recursive: true });
  const out: Partial<RawTables> = {};
  for (const t of TABLES) {
    const path = `${RAW}/${t}.json`;
    if (refresh || !existsSync(path)) {
      console.log(`downloading ${t}`);
      await fetchTo(`${BASE}/dev/json/${t}.json`, path);
    }
    out[t] = JSON.parse(await readFile(path, 'utf8'));
  }
  if (refresh || !existsSync(`${RAW}/LICENSE.md`)) await fetchTo(`${BASE}/LICENSE.md`, `${RAW}/LICENSE.md`);
  return out as RawTables;
}

const rankings = JSON.parse(await readFile('data/purple-rock-rankings.json', 'utf8')) as Rankings;
const subtitles: Record<string, string> = Object.fromEntries(
  Object.entries(JSON.parse(await readFile('data/subtitles.json', 'utf8')) as Record<string, string>).filter(([k]) => /^\d+$/.test(k)),
);
const today = new Date().toISOString().slice(0, 10);
const dataset = convert(await loadTables(), { version: 'US', today, rankings, subtitles });

const manifestPath = 'public/photos/manifest.json';
if (existsSync(manifestPath)) applyPhotos(dataset, JSON.parse(await readFile(manifestPath, 'utf8')) as PhotoManifest);

await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/seasons.json`, JSON.stringify(dataset));
await copyFile(`${RAW}/LICENSE.md`, `${OUT}/SURVIVOR-DATA-LICENSE.md`);
const cast = dataset.seasons.reduce((n, s) => n + s.cast.length, 0);
console.log(`wrote ${OUT}/seasons.json: ${dataset.seasons.length} seasons, ${cast} appearances, ` +
  `${Object.keys(dataset.people).length} players, ${dataset.seasons.filter((s) => s.ranking).length} ranked`);
