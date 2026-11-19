/*
 * Conversion tests on real survivoR rows (tests/fixtures, MIT, see
 * SURVIVOR-DATA-LICENSE.md). Expected values are facts about these seasons.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { convert, seasonName, type RawTables } from '../scripts/lib/convert.ts';
import type { Appearance, Season } from '../src/model.ts';

const tables = JSON.parse(readFileSync('tests/fixtures/survivor-subset.json', 'utf8')) as RawTables;
const data = convert(tables, { version: 'US', today: '2026-11-18', reviews: { '10': 'https://example.com/palau' } });
const season = (n: number): Season => data.seasons.find((s) => s.num === n)!;
const player = (n: number, name: string): Appearance => season(n).cast.find((a) => a.name.startsWith(name))!;
const stints = (a: Appearance) => a.stints.map((s) => [s.from, s.to, s.tribe, !!s.second]);

describe('seasons', () => {
  it('keeps completed seasons in air order', () => {
    expect(data.seasons.map((s) => s.num)).toEqual([1, 4, 10, 22, 27, 38, 41, 45]);
  });

  it('leaves out seasons that had not finished airing', () => {
    const early = convert(tables, { version: 'US', today: '2000-01-01', reviews: {} });
    expect(early.seasons).toEqual([]);
  });

  it('names seasons', () => {
    expect(seasonName('Survivor: Borneo', 1)).toBe('Borneo');
    expect(seasonName('Survivor: 51', 51)).toBe('Survivor 51');
    expect(season(41).name).toBe('Survivor 41');
    expect(season(41).wikiTitle).toBe('Survivor 41');
    expect(season(1).wikiTitle).toBe('Survivor: Borneo');
  });

  it('reads season length from the final day', () => {
    expect(season(1).days).toBe(39);
    expect(season(45).days).toBe(26);
  });

  it('attaches curated review links', () => {
    expect(season(10).reviewUrl).toBe('https://example.com/palau');
    expect(season(1).reviewUrl).toBeNull();
  });
});

describe('phases', () => {
  it('finds the merge in a season without swaps', () => {
    expect(season(1).phases).toEqual([
      { day: 1, label: 'Start', merge: false },
      { day: 19, label: 'Merge', merge: true },
    ]);
  });

  it('finds swaps before the merge', () => {
    expect(season(45).phases.map((p) => [p.day, p.label])).toEqual([[1, 'Start'], [8, 'Tribe swap'], [12, 'Merge']]);
  });

  it('does not start a phase when one player switches places', () => {
    expect(season(27).phases.map((p) => p.day)).toEqual([1, 14, 19]);
  });

  it('finds a merge where only one player changes tribe (Palau)', () => {
    expect(season(10).phases.map((p) => [p.day, p.label])).toEqual([[1, 'Start'], [22, 'Merge']]);
  });

  it('treats placeholder merge tribes as the named merged tribe', () => {
    expect(season(41).phases.filter((p) => p.merge)).toHaveLength(1);
    expect(Object.keys(season(41).tribes)).not.toContain('Merged');
    expect(Object.keys(season(45).tribes)).not.toContain('Mergatory');
  });
});

describe('appearances', () => {
  it('gives every appearance contiguous stints from Day 1 to its exit', () => {
    for (const s of data.seasons) {
      for (const a of s.cast) {
        expect(a.stints[0].from, `${s.id} ${a.name}`).toBe(1);
        expect(a.stints.at(-1)!.to, `${s.id} ${a.name}`).toBe(a.exit.day);
        a.stints.slice(1).forEach((st, i) => expect(st.from, `${s.id} ${a.name}`).toBe(a.stints[i].to + 1));
        expect(a.exit.day).toBeLessThanOrEqual(s.days);
      }
    }
  });

  it('records the jury and finalists', () => {
    const s = season(1);
    expect(s.cast.filter((a) => a.jury)).toHaveLength(7);
    expect(s.cast.filter((a) => a.finalist).map((a) => a.name).sort()).toEqual(['Kelly Wiglesworth', 'Richard Hatch']);
    expect(s.cast.find((a) => a.winner)!.name).toBe('Richard Hatch');
  });

  it('records individual immunity wins on their days', () => {
    expect(player(1, 'Kelly').immunity).toEqual([33, 36, 37, 38]);
  });

  it('records tribe immunity wins', () => {
    expect(player(1, 'Richard').tribeImmunity.length).toBeGreaterThan(0);
    expect(player(1, 'Richard').tribeImmunity.every((d) => d < 19)).toBe(true);
  });

  it('labels players who never joined a tribe', () => {
    expect(Object.keys(season(10).tribes)).toContain('No tribe');
  });
});

describe('exits', () => {
  it('maps result text to exit kinds', () => {
    expect(player(4, 'Paschal').exit).toMatchObject({ day: 37, kind: 'rocks' });
    expect(player(27, 'Rupert').exit.kind).toBe('switched');
    expect(player(1, 'Richard').exit).toMatchObject({ day: 39, kind: 'winner' });
    expect(player(1, 'Kelly').exit).toMatchObject({ day: 39, kind: 'finalist', label: 'Runner-up' });
  });
});

describe('second chances', () => {
  it('follows a winner back from the Edge of Extinction', () => {
    const chris = player(38, 'Chris');
    expect(stints(chris)).toEqual([
      [1, 8, 'Manu', false],
      [9, 35, 'Edge of Extinction', true],
      [36, 39, 'Vata', false],
    ]);
    expect(chris.voteOuts).toEqual([8]);
    expect(chris.exit.kind).toBe('winner');
  });

  it('ends an Edge stay at the last return challenge, not the vote-out', () => {
    const reem = player(38, 'Reem');
    expect(reem.voteOuts).toEqual([3]);
    expect(reem.exit).toMatchObject({ day: 35, kind: 'secondChance', label: 'Out at the Edge of Extinction' });
    expect(reem.jury).toBe(true);
  });

  it('handles two trips to Redemption Island', () => {
    const matt = player(22, 'Matt');
    expect(stints(matt)).toEqual([
      [1, 5, 'Ometepe', false],
      [6, 18, 'Redemption Island', true],
      [19, 21, 'Murlonio', false],
      [22, 37, 'Redemption Island', true],
    ]);
    expect(matt.voteOuts).toEqual([5, 21]);
    expect(matt.exit).toMatchObject({ day: 37, kind: 'secondChance', label: 'Lost on Redemption Island' });
    expect(season(22).secondChance).toBe('Redemption Island');
  });

  it('lists Second chances after the tribes', () => {
    expect(Object.keys(season(38).tribes).at(-1)).toBe('Edge of Extinction');
  });
});

describe('people', () => {
  it('links appearances of the same player across seasons', () => {
    const ids = data.seasons.flatMap((s) => s.cast.map((a) => a.pid));
    const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repeated.length).toBeGreaterThan(0);  // Season 27 and 38 have returning players
    for (const id of ids) expect(data.people[id]).toBeDefined();
  });

  it('carries the survivoR attribution', () => {
    expect(data.source).toContain('survivoR');
    expect(data.source).toContain('MIT');
  });
});
