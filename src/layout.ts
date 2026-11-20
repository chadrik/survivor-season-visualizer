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
 *   'fixed'     like 'lanes', but no lane ever moves: at a swap or shuffle each
 *               lifeline stays put and only its colour changes. Bands cover runs
 *               of neighbouring lanes in one tribe; the phase's tribe labels sit
 *               side by side in the top label row.
 *   'longevity' longest-lasting first within each tribe, in every phase.
 */
import type { Appearance, Season } from './model.ts';
import { phaseSpans, rank, stintOn, tribeOn, type PhaseSpan } from './season.ts';

export type Order = 'lanes' | 'fixed' | 'longevity';
export const ORDERS: readonly Order[] = ['lanes', 'fixed', 'longevity'];

export interface Group {
  tribe: string;
  colour: string;
  members: Appearance[];
  yHead: number;   // top of the row that holds the group's label
  y0: number;      // top of the band
  y1: number;      // bottom of the group's last lane
  label: boolean;  // draw the tribe label; labels in one row sit side by side
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

    const keepLanes = revealed && pi > 0 && o.order !== 'longevity';
    if (keepLanes && (ph.merge || o.order === 'fixed')) {
      for (const a of members) lanes.get(a)![pi] = lanes.get(a)![pi - 1];
    }

    if (keepLanes && ph.merge) {
      /*
       * Keep every lane through the merge; one band of the merged tribe spans
       * them all. Players in a Second chance keep their lanes inside it.
       */
      const y1 = Math.max(...members.map((a) => lanes.get(a)![pi])) + o.rowH / 2;
      const counts = new Map<string, number>();
      for (const a of members) {
        const st = stintOn(a, ph.day);
        if (!st.second) counts.set(st.tribe, (counts.get(st.tribe) ?? 0) + 1);
      }
      const merged = [...counts].sort((x, y) => y[1] - x[1])[0]?.[0] ?? tribeOn(members[0], ph.day);
      groups.push({ tribe: merged, colour: s.tribes[merged], members, yHead: o.top, y0: o.top, y1, label: true });
      bottom = Math.max(bottom, y1);
      return { ...ph, groups };
    }

    if (keepLanes && o.order === 'fixed') {
      /* One band per run of neighbouring lanes in the same tribe; a label for each tribe's first run. */
      const sorted = [...members].sort((a, b) => lanes.get(a)![pi] - lanes.get(b)![pi]);
      const labelled = new Set<string>();
      let run: Group | null = null;
      for (const a of sorted) {
        const t = tribeOn(a, ph.day), y = lanes.get(a)![pi];
        if (run && run.tribe === t) { run.members.push(a); run.y1 = y + o.rowH / 2; continue; }
        run = { tribe: t, colour: s.tribes[t], members: [a], yHead: o.top, y0: y - o.rowH / 2, y1: y + o.rowH / 2, label: !labelled.has(t) };
        labelled.add(t);
        groups.push(run);
      }
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
      groups.push({ tribe: t, colour: s.tribes[t], members: m, yHead, y0: yHead, y1: y, label: true });
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
