/*
 * Write tests/fixtures/survivor-subset.json: the survivoR tables cut down to a
 * few US seasons with tricky cases, so tests run offline. Run after npm run data.
 *   1 Borneo (plain), 4 Marquesas (rock draw), 10 Palau (untribed players, one-tribe merge),
 *   22 Redemption Island, 27 Blood vs. Water (switch), 38 Edge of Extinction,
 *   41 (placeholder merge tribe), 45 (Mergatory, 26 days)
 */
import { copyFile, readFile, writeFile } from 'node:fs/promises';

const SEASONS = new Set([1, 4, 10, 22, 27, 38, 41, 45]);
const TABLES = ['castaways', 'castaway_details', 'tribe_mapping', 'tribe_colours', 'season_summary', 'vote_history', 'challenge_results'];
type Row = Record<string, unknown>;
/* Only the columns convert() reads, to keep the fixture small. */
const COLUMNS: Record<string, string[] | null> = {
  castaways: ['version', 'season', 'castaway_id', 'full_name', 'castaway', 'age', 'city', 'state', 'day', 'result', 'original_tribe', 'jury', 'finalist', 'winner'],
  tribe_mapping: ['version', 'season', 'episode', 'day', 'castaway_id', 'tribe', 'tribe_status'],
  tribe_colours: null,
  season_summary: ['version', 'season', 'season_name', 'ended'],
  vote_history: ['version', 'season', 'day', 'sog_id', 'voted_out_id', 'vote_event'],
  challenge_results: ['version', 'season', 'episode', 'sog_id', 'castaway_id', 'won_individual_immunity', 'won_tribal_immunity'],
};
const pick = (r: Row, cols: string[] | null): Row => (cols ? Object.fromEntries(cols.map((c) => [c, r[c]])) : r);

const out: Record<string, Row[]> = {};
const ids = new Set<string>();
for (const t of TABLES) {
  const rows = JSON.parse(await readFile(`data/raw/${t}.json`, 'utf8')) as Row[];
  if (t === 'castaway_details') continue;
  out[t] = rows.filter((r) => r.version === 'US' && SEASONS.has(r.season as number)).map((r) => pick(r, COLUMNS[t]))
    .filter((r) => t !== 'challenge_results' || r.won_individual_immunity === 1 || r.won_tribal_immunity === 1);
  if (t === 'castaways') for (const r of out[t]) ids.add(r.castaway_id as string);
}
out.castaway_details = (JSON.parse(await readFile('data/raw/castaway_details.json', 'utf8')) as Row[])
  .filter((r) => ids.has(r.castaway_id as string))
  .map(({ castaway_id, full_name, occupation }) => ({ castaway_id, full_name, occupation }));
await writeFile('tests/fixtures/survivor-subset.json', JSON.stringify(out));
await copyFile('data/raw/LICENSE.md', 'tests/fixtures/SURVIVOR-DATA-LICENSE.md');
console.log('wrote tests/fixtures/survivor-subset.json', Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
