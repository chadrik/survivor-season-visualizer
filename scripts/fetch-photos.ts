/*
 * Fetch player photos from Survivor Wiki (CBS promotional images) into
 * public/photos, and record them in public/photos/manifest.json and
 * public/data/seasons.json. Run after npm run data.
 *
 *   npm run photos              download photos not already cached
 *   npm run photos -- --refresh look every player up again
 *
 * Each Appearance gets that season's cast photo, which the wiki names
 * "S<season> <page title>.jpg". When that name is missing (often a name
 * change, such as "S2 Amber Brkich.jpg" for Amber Mariano), the photo is found
 * among the files the player's page uses. A player with a season that has no
 * photo also gets the page's main photo as a fallback.
 *
 * Uses the wiki's MediaWiki API, 50 titles per request. Photos are never
 * committed to git (see .gitignore); CI caches public/photos.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import type { Dataset, Person } from '../src/model.ts';
import { applyPhotos, type PhotoEntry, type PhotoManifest } from './lib/photos.ts';

const API = 'https://survivor.fandom.com/api.php';
const WIKI = 'https://survivor.fandom.com/wiki/';
const OUT = 'public/photos';
const WIDTH = 480;
const HEADERS = { 'User-Agent': 'survivor-season-visualizer photo script (fan project)' };
const refresh = process.argv.includes('--refresh');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ApiPage {
  title: string;
  missing?: string;
  thumbnail?: { source: string };
  images?: { title: string }[];
  imageinfo?: { thumburl?: string; url: string }[];
}
interface ApiResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, ApiPage>;
  };
}

/* Query up to 50 titles; returns requested title -> resolved page (absent when missing). */
async function query(titles: string[], params: Record<string, string>): Promise<Map<string, ApiPage>> {
  const res = await fetch(`${API}?${new URLSearchParams({ action: 'query', format: 'json', redirects: '1', titles: titles.join('|'), ...params })}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`wiki API: ${res.status} ${res.statusText}`);
  const q = ((await res.json()) as ApiResponse).query ?? {};
  const follow = (t: string) => {
    const title = q.normalized?.find((n) => n.from === t)?.to ?? t;
    return q.redirects?.find((r) => r.from === title)?.to ?? title;
  };
  const byTitle = new Map(Object.values(q.pages ?? {}).map((p) => [p.title, p]));
  const out = new Map<string, ApiPage>();
  for (const t of titles) {
    const p = byTitle.get(follow(t));
    if (p && p.missing === undefined) out.set(t, p);
  }
  await sleep(300);
  return out;
}

async function inBatches<T>(items: T[], label: string, fn: (batch: T[]) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += 50) {
    await fn(items.slice(i, i + 50));
    console.log(`${label}: ${Math.min(i + 50, items.length)} / ${items.length}`);
  }
}

async function download(url: string, file: string): Promise<boolean> {
  if (!refresh && existsSync(`${OUT}/${file}`)) return true;
  const img = await fetch(url, { headers: HEADERS });
  if (!img.ok) { console.warn(`skip ${file}: ${img.status}`); return false; }
  await writeFile(`${OUT}/${file}`, Buffer.from(await img.arrayBuffer()));
  await sleep(100);  // be gentle with the wiki's image host
  return true;
}

const data = JSON.parse(await readFile('public/data/seasons.json', 'utf8')) as Dataset;
const overrides = JSON.parse(await readFile('data/photo-overrides.json', 'utf8')) as Record<string, string | null>;
const manifestPath = `${OUT}/manifest.json`;
const old: Record<string, Partial<PhotoEntry> | null> = existsSync(manifestPath) && !refresh ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};
await mkdir(OUT, { recursive: true });

/* Season ids of each player's Appearances. */
const seasonsOf = new Map<string, string[]>();
for (const s of data.seasons) for (const a of s.cast) seasonsOf.set(a.pid, [...(seasonsOf.get(a.pid) ?? []), s.id]);
const numOf = new Map(data.seasons.map((s) => [s.id, s.num]));

/* Keep finished entries; look up players that are new, have a new season, or come from an older manifest. */
const manifest: PhotoManifest = {};
for (const [pid, e] of Object.entries(old)) {
  if (e?.seasons && (seasonsOf.get(pid) ?? []).every((sid) => sid in e.seasons!)) manifest[pid] = e as PhotoEntry;
}
const todo = Object.values(data.people).filter((p) => !(p.pid in manifest));
console.log(`${Object.keys(data.people).length} players, ${todo.length} to look up`);

/* 1. The player's wiki page: an override, the full name, then "short name + surname". */
const candidates = (p: Person): string[] =>
  p.pid in overrides ? (overrides[p.pid] ? [overrides[p.pid]!] : []) : [p.wikiTitle, p.altWikiTitle].filter((t): t is string => !!t);
const pageOf = new Map<string, ApiPage>();
for (let attempt = 0; ; attempt++) {
  const people = todo.filter((p) => !pageOf.has(p.pid) && candidates(p)[attempt]);
  if (!people.length) break;
  await inBatches(people, `pages, try ${attempt + 1}`, async (batch) => {
    const pages = await query(batch.map((p) => candidates(p)[attempt]), { prop: 'pageimages', piprop: 'thumbnail', pithumbsize: String(WIDTH) });
    for (const p of batch) { const page = pages.get(candidates(p)[attempt]); if (page) pageOf.set(p.pid, page); }
  });
}

/* 2. Each season's photo, by its usual file name. */
const want = todo.flatMap((p) => {
  const page = pageOf.get(p.pid);
  return page ? (seasonsOf.get(p.pid) ?? []).map((sid) => ({ pid: p.pid, sid, file: `File:S${numOf.get(sid)} ${page.title}.jpg` })) : [];
});
const photoUrl = new Map<string, string>();  // `${pid} ${sid}` -> thumbnail URL
const fileInfo = { prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(WIDTH) };
await inBatches(want, 'season photos', async (batch) => {
  const pages = await query(batch.map((w) => w.file), fileInfo);
  for (const w of batch) {
    const info = pages.get(w.file)?.imageinfo?.[0];
    if (info) photoUrl.set(`${w.pid} ${w.sid}`, info.thumburl ?? info.url);
  }
});

/* 3. Misses: a file on the player's page named "S<season> ...", leaving out the small " t.png" tiles. */
const missed = want.filter((w) => !photoUrl.has(`${w.pid} ${w.sid}`));
const missedPids = [...new Set(missed.map((w) => w.pid))];
const pageFiles = new Map<string, string[]>();
await inBatches(missedPids, 'page files for misses', async (batch) => {
  const titles = batch.map((pid) => pageOf.get(pid)!.title);
  const pages = await query(titles, { prop: 'images', imlimit: 'max' });
  batch.forEach((pid, i) => pageFiles.set(pid, (pages.get(titles[i])?.images ?? []).map((f) => f.title)));
});
const found = missed.flatMap((w) => {
  const prefix = `File:S${numOf.get(w.sid)} `;
  const files = (pageFiles.get(w.pid) ?? []).filter((f) => f.startsWith(prefix) && !/ t\.png$/i.test(f));
  const file = files.find((f) => /\.jpe?g$/i.test(f)) ?? files[0];
  return file ? [{ ...w, file }] : [];
});
await inBatches(found, 'season photos, second try', async (batch) => {
  const pages = await query(batch.map((w) => w.file), fileInfo);
  for (const w of batch) {
    const info = pages.get(w.file)?.imageinfo?.[0];
    if (info) photoUrl.set(`${w.pid} ${w.sid}`, info.thumburl ?? info.url);
  }
});

/* 4. Download, and record each player's result. */
const ext = (url: string) => (url.match(/\.(jpe?g|png|webp|gif)(?=\/|$|\?)/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
let done = 0;
for (const p of todo) {
  const page = pageOf.get(p.pid);
  const entry: PhotoEntry = {
    title: page?.title ?? null,
    source: page ? WIKI + encodeURIComponent(page.title.replace(/ /g, '_')) : null,
    seasons: {},
    file: null,
  };
  for (const sid of seasonsOf.get(p.pid) ?? []) {
    const url = photoUrl.get(`${p.pid} ${sid}`);
    const file = url ? `${p.pid}-s${numOf.get(sid)}.${ext(url)}` : null;
    entry.seasons[sid] = file && url && await download(url, file) ? file : null;
  }
  const thumb = page?.thumbnail?.source;
  if (thumb && Object.values(entry.seasons).some((f) => !f)) {
    const file = `${p.pid}.${ext(thumb)}`;
    entry.file = await download(thumb, file) ? file : null;
  }
  manifest[p.pid] = entry;
  if (++done % 100 === 0) console.log(`downloads: ${done} / ${todo.length} players`);
}

/* Remove photo files the manifest no longer uses. */
const used = new Set(Object.values(manifest).flatMap((e) => [e.file, ...Object.values(e.seasons)]).filter(Boolean));
let removed = 0;
for (const f of await readdir(OUT)) if (f !== 'manifest.json' && !used.has(f)) { await unlink(`${OUT}/${f}`); removed++; }

await writeFile(manifestPath, JSON.stringify(manifest, null, 1));
applyPhotos(data, manifest);
await writeFile('public/data/seasons.json', JSON.stringify(data));
const apps = data.seasons.flatMap((s) => s.cast.map((a) => ({ s, a })));
const without = apps.filter(({ a }) => !a.photo).map(({ s, a }) => `${a.name} (S${s.num})`);
console.log(`season photos: ${apps.length - without.length} of ${apps.length}` +
  `${without.length ? `; none for ${without.join(', ')}` : ''}; removed ${removed} unused files`);
