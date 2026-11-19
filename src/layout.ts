/*
 * Lane layout for one season: where each Appearance's Lifeline runs in each phase.
 *
 * Hidden (season not Watched): one phase, players grouped by starting tribe and
 * sorted by first name, so the order leaks nothing.
 *
 * Revealed, by Order:
 *   'lanes'     (default) first name within the starting tribe; each phase keeps
 *               the order of the phase before, and a merge keeps every lane.
 *               Lanes move only at a swap or shuffle.
 *   'longevity' longest-lasting first within each tribe, in every phase.
 */
import type { Appearance, Season } from './model.ts';
import { phaseSpans, rank, stintOn, tribeOn, type PhaseSpan } from './season.ts';

export type Order = 'lanes' | 'longevity';

export interface Group {
  tribe: string;
  colour: string;
  members: Appearance[];
  yHead: number;  // top of the group's label row
  y1: number;     // bottom of the group's last lane
}

export interface LaidPhase extends PhaseSpan {
  groups: Group[];
}

export interface Layout {
  phases: LaidPhase[];
  /* lane centre y for each phase the Appearance is in */
  lanes: Map<Appearance, number[]>;
  height: number;
}

export interface LayoutOptions {
  order: Order;
  rowH: number;  // lane height
  head: number;  // label row above each group
  gap: number;   // space between groups
  top: number;   // y of the first group
}

export function computeLayout(s: Season, revealed: boolean, o: LayoutOptions): Layout {
  const spans = phaseSpans(s);
  const phases = revealed ? spans : [{ ...spans[0], end: s.days }];
  const tribeOrder = Object.keys(s.tribes);
  const lanes = new Map<Appearance, number[]>();
  let bottom = o.top;

  const laid = phases.map((ph, pi): LaidPhase => {
    const members = s.cast.filter((a) => a.exit.day >= ph.day);
    const groups: Group[] = [];

    if (revealed && pi > 0 && ph.merge && o.order === 'lanes') {
      /*
       * Keep every lane through the merge; one band of the merged tribe spans
       * them all. Players in a Second chance keep their lanes inside it.
       */
      for (const a of members) lanes.get(a)![pi] = lanes.get(a)![pi - 1];
      const y1 = Math.max(...members.map((a) => lanes.get(a)![pi])) + o.rowH / 2;
      const counts = new Map<string, number>();
      for (const a of members) {
        const st = stintOn(a, ph.day);
        if (!st.second) counts.set(st.tribe, (counts.get(st.tribe) ?? 0) + 1);
      }
      const merged = [...counts].sort((x, y) => y[1] - x[1])[0]?.[0] ?? tribeOn(members[0], ph.day);
      groups.push({ tribe: merged, colour: s.tribes[merged], members, yHead: o.top, y1 });
      bottom = Math.max(bottom, y1);
      return { ...ph, groups };
    }

    const byName = (a: Appearance, b: Appearance) => a.name.localeCompare(b.name);
    const byPrevLane = (a: Appearance, b: Appearance) => lanes.get(a)![pi - 1] - lanes.get(b)![pi - 1];
    const byLongevity = (a: Appearance, b: Appearance) => rank(b) - rank(a) || byName(a, b);
    const sort = !revealed ? byName : o.order === 'longevity' ? byLongevity : pi === 0 ? byName : byPrevLane;

    let y = o.top;
    for (const t of tribeOrder) {
      const m = members.filter((a) => tribeOn(a, ph.day) === t).sort(sort);
      if (!m.length) continue;
      const yHead = y;
      y += o.head;
      for (const a of m) {
        if (!lanes.has(a)) lanes.set(a, []);
        lanes.get(a)![pi] = y + o.rowH / 2;
        y += o.rowH;
      }
      groups.push({ tribe: t, colour: s.tribes[t], members: m, yHead, y1: y });
      y += o.gap;
    }
    bottom = Math.max(bottom, y - o.gap);
    return { ...ph, groups };
  });

  return { phases: laid, lanes, height: bottom };
}

/* Lane y on a given day: the lane of the phase that contains the day. */
export function laneOn(L: Layout, a: Appearance, day: number): number {
  const ys = L.lanes.get(a)!;
  let i = 0;
  while (i + 1 < ys.length && ys[i + 1] !== undefined && L.phases[i + 1].day <= day) i++;
  return ys[i];
}
