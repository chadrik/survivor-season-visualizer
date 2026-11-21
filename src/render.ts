/*
 * SVG for one season card in the Transit Map style: tribe-coloured lifelines
 * on tinted tribe bands, crossovers at swaps, exit and immunity markers.
 * Returns HTML: a sideways-scrolling timeline plus a pinned names column.
 */
import type { Appearance, Season } from './model.ts';
import { computeLayout, laneOn, type Layout, type Order } from './layout.ts';
import { juryLines, startingTribe } from './season.ts';
import { EXIT_ICONS, esc } from './format.ts';
import { strokeColour, textOn } from './colour.ts';

/*
 * The timeline never gets narrower than this many px per day; narrower screens
 * scroll sideways. At 13 px a 42-day season still fits beside the open player
 * card (an 800 px chart) without scrolling.
 */
export const MIN_DAY = 13;

export interface RenderOptions {
  maxDays: number;  // longest season: one day scale shared by every card
  order: Order;
}

/*
 * PAD_R leaves room for the jury vote count beside each finalist. INSET keeps
 * Day 0 clear of the names column's edge when the timeline scrolls.
 */
const ROW_H = 19, PAD_R = 58, INSET = 6;
/* Header rows above the lanes: phase labels (one row each), then the day axis. */
const LABEL_ROW = 12, AXIS_H = 34;

export function renderSeason(s: Season, revealed: boolean, visibleW: number, o: RenderOptions): string {
  const left = visibleW < 640 ? 118 : 178;
  const x0 = left + INSET;
  const W = Math.max(visibleW, x0 + o.maxDays * MIN_DAY + PAD_R);
  const X = (d: number) => x0 + (d / o.maxDays) * (W - x0 - PAD_R);
  const labelRows = revealed ? phaseLabelRows(s, X) : [];
  const head = LABEL_ROW * Math.max(1, ...labelRows.map((r) => r + 1));
  const TOP = head + AXIS_H;
  const L = computeLayout(s, revealed, { order: o.order, rowH: ROW_H, head: 19, gap: 8, top: TOP });
  const H = L.height + 26;
  /* Crossovers start after the last day of a phase, so markers on that day sit on a level line. */
  const k = Math.min(16, (X(1) - X(0)) * 0.8);

  let bands = '', pills = '', lives = '', dots = '', marks = '', names = '';
  for (const ph of L.phases) {
    const x0 = X(ph.day - 1), x1 = X(ph.end);
    /*
     * Labels in one row sit side by side. When they do not fit in the phase,
     * each becomes a dot in its tribe colour that names the tribe on hover.
     */
    const pillW = (g: { tribe: string }) => g.tribe.length * 6.6 + 12;
    const rows = new Map<number, typeof ph.groups>();
    for (const g of ph.groups) if (g.label) rows.set(g.yHead, [...(rows.get(g.yHead) ?? []), g]);
    for (const g of ph.groups) {
      bands += `<rect class="band" x="${x0}" y="${g.y0}" width="${x1 - x0}" height="${g.y1 - g.y0 + 2}" fill="${g.colour}"/>`;
    }
    for (const [yHead, row] of rows) {
      const last = ph === L.phases[L.phases.length - 1];
      const fits = last || row.reduce((w, g) => w + pillW(g) + 4, 8) <= x1 - x0;
      let px = x0 + 8;
      for (const g of row) {
        if (!fits) {
          pills += `<circle class="pill-dot" cx="${px + 5}" cy="${yHead + 9.5}" r="5" fill="${g.colour}" data-tip="${esc(g.tribe)}|Tribe from Day ${ph.day}"/>`;
          px += 13;
          continue;
        }
        const label = g.tribe.toUpperCase(), pw = pillW(g);
        pills += `<g class="pill"><rect x="${px}" y="${yHead + 3}" width="${pw}" height="13" rx="6.5" fill="${g.colour}"/>` +
          `<text x="${px + pw / 2}" y="${yHead + 10}" fill="${textOn(g.colour)}" text-anchor="middle" dominant-baseline="central">${esc(label)}</text></g>`;
        px += pw + 4;
      }
    }
  }

  for (const [a, ys] of L.lanes) {
    names += nameText(a, s, left - 14, ys[0]);
    if (!revealed) {
      lives += `<path class="life ghost" d="M${X(0)},${ys[0]} H${X(s.days)}"/>`;
      continue;
    }
    lives += lifeline(a, s, L, ys, X, k);
    dots += `<circle class="origin" cx="${X(0)}" cy="${ys[0]}" r="4" fill="${strokeColour(s.tribes[startingTribe(a)])}"/>`;
    marks += voteOutMarks(a, L, X) + rewardMarks(a, L, X) + immunityMarks(a, L, X) + exitMark(a, s, X(a.exit.day), ys[ys.length - 1]);
  }

  const lines = juryLines(s);
  const markers = revealed && lines ? juryMarkers(lines, X, TOP - 10, L.height + 4) : '';
  const hidden = revealed ? '' :
    `<rect class="reveal-hit" x="${X(0)}" y="${TOP}" width="${X(s.days) - X(0)}" height="${L.height - TOP}"/>` +
    veil((left + Math.min(visibleW, W) - PAD_R) / 2, (TOP + L.height) / 2);

  const timeline = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Season ${s.num} lifelines">
    <defs><filter id="blur-${s.id}" x="-5%" y="-60%" width="110%" height="220%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    ${axis(s, L, X, head, labelRows)}${bands}${markers}
    <g ${revealed ? '' : `filter="url(#blur-${s.id})"`}>${lives}</g>${dots}${pills}${marks}${hidden}
  </svg>`;
  const edge = W > visibleW ? `<rect class="names-edge" x="${left - 6}" y="0" width="8" height="${H}"/>` : '';
  const namesCol = `<svg class="names-col" width="${left}" height="${H}" viewBox="0 0 ${left} ${H}">` +
    `<rect class="names-bg" width="${left - 4}" height="${H}"/>${edge}${names}</svg>`;
  return `<div class="scroller">${timeline}</div>${namesCol}`;
}

/*
 * One path per stint piece inside each phase. A piece in a Second chance is
 * dashed. The first piece of a later phase starts with a crossover curve from
 * the previous lane.
 */
function lifeline(a: Appearance, s: Season, L: Layout, ys: number[], X: (d: number) => number, k: number): string {
  let out = '';
  for (let i = 0; i < ys.length; i++) {
    const ph = L.phases[i];
    const segEnd = i < ys.length - 1 ? L.phases[i + 1].day - 1 : a.exit.day;
    let first = true;
    for (const st of a.stints) {
      const from = Math.max(st.from, ph.day), to = Math.min(st.to, segEnd);
      if (from > to) continue;
      const x0 = X(from - 1), x1 = X(to);
      let d: string;
      if (first && i > 0) d = `M${x0},${ys[i - 1]} C${x0 + k},${ys[i - 1]} ${x0 + k},${ys[i]} ${x0 + 2 * k},${ys[i]} H${x1}`;
      else d = `M${first && i === 0 ? X(0) : x0},${ys[i]} H${x1}`;
      out += `<path class="life${st.second ? ' second' : ''}" data-pid="${a.pid}" stroke="${strokeColour(s.tribes[st.tribe])}" d="${d}"/>`;
      first = false;
    }
  }
  return out;
}

function nameText(a: Appearance, s: Season, x: number, y: number): string {
  return `<text class="name" tabindex="0" role="button" data-pid="${a.pid}" data-key="${s.id}:${a.pid}" ` +
    `style="--tc:${strokeColour(s.tribes[startingTribe(a)])}" x="${x}" y="${y}" text-anchor="end" dominant-baseline="central">${esc(a.name)}</text>`;
}

/* Exit icon. A finalist's jury vote count sits beside it; a juror's vote is in the tooltip. */
function exitMark(a: Appearance, s: Season, x: number, y: number): string {
  const r = 8.5;
  const jurors = s.cast.filter((j) => j.juryVote).length;
  const votedFor = a.juryVote ? s.cast.find((f) => f.pid === a.juryVote)?.name : null;
  let tip = `${EXIT_ICONS[a.exit.kind]} ${esc(a.exit.label)} · Day ${a.exit.day}`;
  if (a.juryVotes !== null) tip += ` · ${a.juryVotes} of ${jurors} jury votes`;
  if (votedFor) tip += ` · Jury vote: ${esc(votedFor)}`;
  const count = a.juryVotes === null ? '' :
    `<text class="jury-count" x="${r + 5}" y="0.5" dominant-baseline="central">${a.juryVotes} vote${a.juryVotes === 1 ? '' : 's'}</text>`;
  return `<g class="exit${a.winner ? ' winner' : ''}" data-pid="${a.pid}" data-tip="${esc(a.name)}|${tip}" transform="translate(${x},${y})">` +
    `<circle r="${r}"/><text font-size="${(r * 1.1).toFixed(1)}" text-anchor="middle" dominant-baseline="central" y="0.5">${EXIT_ICONS[a.exit.kind]}</text>${count}</g>`;
}

/*
 * Blue square: individual or team reward. Hollow: tribe reward. Reward
 * challenges share a day with that episode's immunity challenge, so the
 * square sits half a day earlier, clear of the immunity diamond.
 */
function rewardMarks(a: Appearance, L: Layout, X: (d: number) => number): string {
  const mark = (day: number, kind: 'tribe' | 'individual') => {
    const tip = kind === 'tribe'
      ? `▫ Tribe reward (${esc(a.stints.find((st) => st.from <= day && day <= st.to)?.tribe ?? '')}) · Day ${day}`
      : `▪ Reward · Day ${day}`;
    const h = kind === 'tribe' ? 3 : 3.5;
    return `<g class="reward ${kind}" data-pid="${a.pid}" data-tip="${esc(a.name)}|${tip}" transform="translate(${X(day - 0.5)},${laneOn(L, a, day)})">` +
      `<circle r="6" class="mark-hit"/><rect x="${-h}" y="${-h}" width="${2 * h}" height="${2 * h}" rx="1"/></g>`;
  };
  return a.tribeReward.map((d) => mark(d, 'tribe')).join('') + a.reward.map((d) => mark(d, 'individual')).join('');
}

/* A vote-out that did not end the game (the player went to a Second chance). */
function voteOutMarks(a: Appearance, L: Layout, X: (d: number) => number): string {
  return a.voteOuts.filter((d) => d < a.exit.day).map((d) => {
    const next = a.stints.find((st) => st.from === d + 1);
    const where = next?.second ? ` → ${next.tribe}` : '';
    return `<g class="voteout" data-pid="${a.pid}" data-tip="${esc(a.name)}|🗳️ Voted out · Day ${d}${esc(where)}" transform="translate(${X(d)},${laneOn(L, a, d)})">` +
      '<circle r="6" class="mark-hit"/><path d="M-3,-3 L3,3 M3,-3 L-3,3"/></g>';
  }).join('');
}

/* Filled gold diamond: individual immunity. Hollow: tribe immunity. Same x as exits on that day. */
function immunityMarks(a: Appearance, L: Layout, X: (d: number) => number): string {
  const mark = (day: number, kind: 'tribe' | 'individual') => {
    const tip = kind === 'tribe'
      ? `◇ Tribe immunity (${esc(a.stints.find((st) => st.from <= day && day <= st.to)?.tribe ?? '')}) · Day ${day}`
      : `◆ Individual immunity · Day ${day}`;
    const shape = kind === 'tribe' ? 'M0,-4.5 L3.5,0 L0,4.5 L-3.5,0Z' : 'M0,-6 L4.5,0 L0,6 L-4.5,0Z';
    return `<g class="immunity ${kind}" data-pid="${a.pid}" data-tip="${esc(a.name)}|${tip}" transform="translate(${X(day)},${laneOn(L, a, day)})">` +
      `<circle r="7" class="mark-hit"/><path d="${shape}"/></g>`;
  };
  return a.tribeImmunity.map((d) => mark(d, 'tribe')).join('') + a.immunity.map((d) => mark(d, 'individual')).join('');
}

/*
 * Row for each phase label after the first, so labels never overlap: each goes
 * in the first row where it clears the label before it.
 */
function phaseLabelRows(s: Season, X: (d: number) => number): number[] {
  const ends: number[] = [];
  return s.phases.slice(1).map((ph) => {
    const x = X(ph.day - 1) + 4;
    let row = ends.findIndex((end) => x > end + 8);
    if (row < 0) row = ends.length;
    ends[row] = x + ph.label.length * 6.2;
    return row;
  });
}

/*
 * Day axis under the phase labels. A phase starts at a tick on the boundary
 * before its first day; the tick carries that day's number on the axis.
 */
function axis(s: Season, L: Layout, X: (d: number) => number, head: number, labelRows: number[]): string {
  const dayW = X(1) - X(0);
  const step = dayW < 9 ? 6 : 3;
  const axisY = head + 18, gridTop = head + 24, gridBottom = L.height + 2;
  const phases = labelRows.length ? L.phases.slice(1) : [];
  /* Leave out regular day numbers that would collide with a phase's day number. */
  const clear = (x: number) => phases.every((ph) => Math.abs(X(ph.day - 1) + 2 - x) > 16);
  let g = '<g class="axis">';
  for (let d = 0; d <= s.days; d += step) {
    g += `<line class="grid" x1="${X(d)}" x2="${X(d)}" y1="${gridTop}" y2="${gridBottom}"/>`;
    if (d > 0 && clear(X(d))) g += `<text x="${X(d)}" y="${axisY}" text-anchor="middle">${d}</text>`;
  }
  if (s.days % step && clear(X(s.days))) g += `<text x="${X(s.days)}" y="${axisY}" text-anchor="middle">${s.days}</text>`;
  g += `<text x="${X(0)}" y="${axisY}">Day</text>`;
  phases.forEach((ph, i) => {
    const x = X(ph.day - 1), y = LABEL_ROW * (labelRows[i] + 1);
    g += `<line class="phase-tick" x1="${x}" x2="${x}" y1="${y - 9}" y2="${gridBottom}"/>` +
      `<text class="phase-label" x="${x + 4}" y="${y}">${esc(ph.label)}</text>` +
      `<text class="phase-day" x="${x + 3}" y="${axisY}">${ph.day}</text>`;
  });
  return g + '</g>';
}

function juryMarkers(j: NonNullable<ReturnType<typeof juryLines>>, X: (d: number) => number, y0: number, y1: number): string {
  const xj = (X(j.juryAfter) + X(j.juryBefore)) / 2;
  const xf = (X(j.finalAfter) + X(j.finalBefore)) / 2;
  return `<g class="marker"><line x1="${xj}" x2="${xj}" y1="${y0}" y2="${y1}"/><text x="${xj}" y="${y1 + 12}" text-anchor="middle">JURY ▸</text></g>` +
    `<g class="marker final"><line x1="${xf}" x2="${xf}" y1="${y0}" y2="${y1}"/><text x="${xf}" y="${y1 + 12}" text-anchor="end">FINAL ${j.finalCount}</text></g>`;
}

function veil(cx: number, cy: number): string {
  return `<g class="veil"><rect x="${cx - 150}" y="${cy - 16}" width="300" height="32" rx="16"/>` +
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central">Results hidden · click to reveal</text></g>`;
}
