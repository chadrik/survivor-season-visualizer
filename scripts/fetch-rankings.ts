/*
 * Saves the Purple Rock Podcast season ranking to data/purple-rock-rankings.json.
 * Run it by hand when Purple Rock updates the page (usually after a season
 * ends), and commit the result: the site build reads the saved file.
 *
 *   npm run rankings
 */
import { writeFileSync } from 'node:fs';

const PAGE = 'https://www.purplerockpodcast.com/survivor-season-rankings-spoiler-free-summaries/';
const OUT = 'data/purple-rock-rankings.json';

const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const res = await fetch(PAGE, { headers: { 'User-Agent': 'survivor-season-visualizer (rankings)' } });
if (!res.ok) throw new Error(`${PAGE}: HTTP ${res.status}`);
const html = await res.text();

/* Each entry starts with a bold heading such as "4. Cambodia: Second Chance (season 31)". */
const seasons: Record<string, { rank: number; heading: string }> = {};
for (const m of html.matchAll(/<(b|strong)>\s*(\d+)\.\s*([^<]+?\(season (\d+)\))\s*(?:<br\s*\/?>\s*)?<\/\1>/g)) {
  const rank = Number(m[2]);
  seasons[m[4]] = { rank, heading: decode(`${rank}. ${m[3]}`) };
}

const ranks = Object.values(seasons).map((s) => s.rank).sort((a, b) => a - b);
if (!ranks.length || ranks.some((r, i) => r !== i + 1)) {
  throw new Error(`Ranks are not 1..N (found ${ranks.join(', ')}). The page layout may have changed.`);
}

writeFileSync(OUT, JSON.stringify({
  _about: 'Purple Rock Podcast season ranking, saved by scripts/fetch-rankings.ts. heading is the text that starts each season\'s spoiler-free summary on the page.',
  url: PAGE,
  saved: new Date().toISOString().slice(0, 10),
  total: ranks.length,
  seasons,
}, null, 2) + '\n');
console.log(`wrote ${OUT}: ${ranks.length} seasons`);
