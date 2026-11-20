/* Layout rules from CONTEXT.md, checked on real seasons from the fixture. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { convert, type RawTables } from '../scripts/lib/convert.ts';
import { computeLayout, type Order } from '../src/layout.ts';
import { backstorySeasons, buildIndex, juryLines, startingTribe } from '../src/season.ts';
import type { Season } from '../src/model.ts';

const tables = JSON.parse(readFileSync('tests/fixtures/survivor-subset.json', 'utf8')) as RawTables;
const data = convert(tables, { version: 'US', today: '2026-11-18', rankings: null });
const season = (n: number): Season => data.seasons.find((s) => s.num === n)!;
const opts = (order: Order) => ({ order, rowH: 20, head: 20, gap: 10, top: 50 });
const byName = (s: Season, name: string) => s.cast.find((a) => a.name.startsWith(name))!;

describe('hidden seasons', () => {
  it('show one phase, grouped by starting tribe, sorted by name', () => {
    const s = season(1);
    const L = computeLayout(s, false, opts('lanes'));
    expect(L.phases).toHaveLength(1);
    for (const g of L.phases[0].groups) {
      const names = g.members.map((a) => a.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(g.members.every((a) => startingTribe(a) === g.tribe)).toBe(true);
    }
  });
});

describe('stable lanes (default order)', () => {
  it('does not move anyone when a season is revealed', () => {
    const s = season(1);
    const hidden = computeLayout(s, false, opts('lanes'));
    const shown = computeLayout(s, true, opts('lanes'));
    for (const a of s.cast) expect(shown.lanes.get(a)![0]).toBe(hidden.lanes.get(a)![0]);
  });

  it('keeps every lane through the merge', () => {
    const s = season(1);
    const L = computeLayout(s, true, opts('lanes'));
    for (const a of s.cast) {
      const ys = L.lanes.get(a)!;
      if (ys.length > 1) expect(ys[1]).toBe(ys[0]);
    }
  });

  it('draws one merged band, even with players on the Edge of Extinction', () => {
    const s = season(38);
    const L = computeLayout(s, true, opts('lanes'));
    const merge = L.phases.find((p) => p.merge)!;
    expect(merge.groups).toHaveLength(1);
    expect(merge.groups[0].tribe).toBe('Vata');
  });

  it('moves lanes at a tribe shuffle', () => {
    const s = season(38);
    const L = computeLayout(s, true, opts('lanes'));
    const moved = s.cast.filter((a) => { const ys = L.lanes.get(a)!; return ys.length > 1 && ys[1] !== ys[0]; });
    expect(moved.length).toBeGreaterThan(0);
  });
});

describe('fixed lanes', () => {
  it('never moves a lane, even at a tribe shuffle', () => {
    const s = season(38);
    const L = computeLayout(s, true, opts('fixed'));
    for (const a of s.cast) expect(new Set(L.lanes.get(a)!).size).toBe(1);
  });

  it('labels each tribe once per phase, in the top label row', () => {
    const s = season(38);
    const L = computeLayout(s, true, opts('fixed'));
    for (const ph of L.phases.slice(1)) {
      const labels = ph.groups.filter((g) => g.label).map((g) => g.tribe);
      expect(labels).toEqual([...new Set(labels)]);
      expect(new Set(ph.groups.map((g) => g.tribe))).toEqual(new Set(labels));
      expect(ph.groups.every((g) => g.yHead === 50)).toBe(true);
    }
  });

  it('puts every player in a band of their tribe on that phase', () => {
    const s = season(38);
    const L = computeLayout(s, true, opts('fixed'));
    const ph = L.phases[1];
    for (const g of ph.groups) for (const a of g.members) {
      const y = L.lanes.get(a)![1];
      expect(y).toBeGreaterThan(g.y0);
      expect(y).toBeLessThan(g.y1);
    }
  });
});

describe('longest-lasting first', () => {
  it('puts the winner first in their tribe', () => {
    const s = season(1);
    const L = computeLayout(s, true, opts('longevity'));
    const tagi = L.phases[0].groups.find((g) => g.tribe === 'Tagi')!;
    expect(tagi.members[0]).toBe(byName(s, 'Richard'));
  });
});

describe('jury lines', () => {
  it('fall between the last pre-jury exit and the first juror, and before the final day', () => {
    const s = season(1);
    const j = juryLines(s)!;
    expect(j.juryAfter).toBeLessThan(j.juryBefore);
    expect(j.finalAfter).toBeLessThan(j.finalBefore);
    expect(j.finalCount).toBe(2);
    const jurors = s.cast.filter((a) => a.jury);
    expect(Math.min(...jurors.map((a) => a.exit.day))).toBe(j.juryBefore);
  });
});

describe('backstory seasons', () => {
  it('lists only earlier seasons that returning players appeared in', () => {
    const ix = buildIndex(data);
    const list = backstorySeasons(season(27), ix);
    expect(list.every((n) => n < 27)).toBe(true);
    expect(backstorySeasons(season(1), ix)).toEqual([]);
  });
});
