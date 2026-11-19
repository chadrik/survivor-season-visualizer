/*
 * Fetch player photos from Survivor Wiki (CBS promotional images) into
 * public/photos, and record them in public/photos/manifest.json and
 * public/data/seasons.json. Run after npm run data.
 *
 *   npm run photos              download photos not already cached
 *   npm run photos -- --refresh look every player up again
 *
 * Uses the wiki's MediaWiki API (pageimages), 50 players per request. Photos
 * are never committed to git (see .gitignore); CI caches public/photos.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Dataset, Person } from '../src/model.ts';
import { applyPhotos, type PhotoManifest } from './lib/photos.ts';

const API = 'https://survivor.fandom.com/api.php';
const WIKI = 'https://survivor.fandom.com/wiki/';
const OUT = 'public/photos';
const HEADERS = { 'User-Agent': 'survivor-season-visualizer photo script (fan project)' };
const refresh = process.argv.includes('--refresh');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ApiPage { title: string; missing?: string; thumbnail?: { source: string } }
interface ApiResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, ApiPage>;
  };
}

/* Look up thumbnails for up to 50 page titles; returns requested title -> resolved page. */
async function lookup(titles: string[]): Promise<Map<string, ApiPage>> {
  const params = new URLSearchParams({
    action: 'query', format: 'json', prop: 'pageimages', piprop: 'thumbnail',
    pithumbsize: '480', redirects: '1', titles: titles.join('|'),
  });
  const res = await fetch(`${API}?${params}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`wiki API: ${res.status} ${res.statusText}`);
  const q = ((await res.json()) as ApiResponse).query ?? {};
  const follow = (t: string) => {
    let title = q.normalized?.find((n) => n.from === t)?.to ?? t;
    title = q.redirects?.find((r) => r.from === title)?.to ?? title;
    return title;
  };
  const byTitle = new Map(Object.values(q.pages ?? {}).map((p) => [p.title, p]));
  return new Map(titles.map((t) => [t, byTitle.get(follow(t))!]).filter(([, p]) => p) as [string, ApiPage][]);
}

const data = JSON.parse(await readFile('public/data/seasons.json', 'utf8')) as Dataset;
const overrides = JSON.parse(await readFile('data/photo-overrides.json', 'utf8')) as Record<string, string | null>;
const manifestPath = `${OUT}/manifest.json`;
const manifest: PhotoManifest = existsSync(manifestPath) && !refresh ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};
await mkdir(OUT, { recursive: true });

/* Old manifests stored null for "not found"; look those players up again. */
for (const [pid, entry] of Object.entries(manifest)) if (!entry) delete manifest[pid];
const todo = Object.values(data.people).filter((p) => refresh || !(p.pid in manifest) || !manifest[p.pid].file);
console.log(`${Object.keys(data.people).length} players, ${todo.length} to look up`);

/* Titles to try for a player, in order: an override, the full name, then "short name + surname". */
function candidates(p: Person): string[] {
  if (p.pid in overrides) return overrides[p.pid] ? [overrides[p.pid]!] : [];
  return [p.wikiTitle, p.altWikiTitle].filter((t): t is string => !!t);
}

async function resolve(people: Person[], attempt: number): Promise<Person[]> {
  const misses: Person[] = [];
  for (let i = 0; i < people.length; i += 50) {
    const batch = people.slice(i, i + 50);
    const titles = batch.map((p) => candidates(p)[attempt]).filter((t): t is string => !!t);
    const pages = titles.length ? await lookup(titles) : new Map<string, ApiPage>();
    for (const p of batch) {
      const title = candidates(p)[attempt];
      const page = title ? pages.get(title) : undefined;
      if (!page || page.missing !== undefined) {
        if (candidates(p)[attempt + 1]) misses.push(p);
        else manifest[p.pid] ??= { title: null, file: null, source: null };
        continue;
      }
      const source = WIKI + encodeURIComponent(page.title.replace(/ /g, '_'));
      const src = page.thumbnail?.source;
      if (!src) { manifest[p.pid] = { title: page.title, file: null, source }; continue; }
      const ext = (src.match(/\.(jpe?g|png|webp|gif)(?=\/|$|\?)/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
      const file = `${p.pid}.${ext}`;
      if (refresh || !existsSync(`${OUT}/${file}`)) {
        const img = await fetch(src, { headers: HEADERS });
        if (!img.ok) { console.warn(`skip ${p.name}: ${img.status}`); manifest[p.pid] = { title: page.title, file: null, source }; continue; }
        await writeFile(`${OUT}/${file}`, Buffer.from(await img.arrayBuffer()));
        await sleep(100);  // be gentle with the wiki's image host
      }
      manifest[p.pid] = { title: page.title, file, source };
    }
    console.log(`attempt ${attempt + 1}: looked up ${Math.min(i + 50, people.length)} / ${people.length}`);
    await sleep(500);
  }
  return misses;
}

let pending = todo;
for (let attempt = 0; pending.length; attempt++) pending = await resolve(pending, attempt);

await writeFile(manifestPath, JSON.stringify(manifest, null, 1));
applyPhotos(data, manifest);
await writeFile('public/data/seasons.json', JSON.stringify(data));
const found = Object.values(manifest).filter((e) => e.file).length;
const missing = Object.entries(manifest).filter(([, e]) => !e.file).map(([pid]) => data.people[pid]?.name);
console.log(`photos: ${found} found, ${missing.length} without a photo${missing.length ? `: ${missing.join(', ')}` : ''}`);
