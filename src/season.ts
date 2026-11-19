/* Facts derived from a Season: phases, tribes on a day, jury lines, backstory seasons. */
import type { Appearance, Dataset, Phase, Season, Stint } from './model.ts';

export interface PhaseSpan extends Phase {
  end: number;  // last day of the phase
}

export function phaseSpans(s: Season): PhaseSpan[] {
  return s.phases.map((p, i) => ({ ...p, end: i < s.phases.length - 1 ? s.phases[i + 1].day - 1 : s.days }));
}

/* The stint a player is in on a day (the last one after their exit). */
export function stintOn(a: Appearance, day: number): Stint {
  return a.stints.find((st) => st.from <= day && day <= st.to) ?? a.stints[a.stints.length - 1];
}

export const tribeOn = (a: Appearance, day: number): string => stintOn(a, day).tribe;
export const startingTribe = (a: Appearance): string => a.stints[0].tribe;

/* Index of the phase containing a day. */
export function phaseIndexOn(s: Season, day: number): number {
  let i = 0;
  while (i + 1 < s.phases.length && s.phases[i + 1].day <= day) i++;
  return i;
}

/* Higher = lasted longer; the winner outranks other finalists. */
export const rank = (a: Appearance): number => (a.winner ? 1e4 : a.finalist ? 9999 : a.exit.day);

export interface JuryLines {
  /* x positions are midway between these days */
  juryAfter: number; juryBefore: number;   // last pre-jury exit, first juror exit
  finalAfter: number; finalBefore: number; // last non-finalist exit, last day
  finalCount: number;
}

export function juryLines(s: Season): JuryLines | null {
  const jurors = s.cast.filter((a) => a.jury && !a.finalist);
  if (!jurors.length) return null;
  const juryBefore = Math.min(...jurors.map((a) => a.exit.day));
  const pre = s.cast.filter((a) => !a.jury && !a.finalist && a.exit.day <= juryBefore).map((a) => a.exit.day);
  const nonFinal = s.cast.filter((a) => !a.finalist).map((a) => a.exit.day);
  return {
    juryAfter: pre.length ? Math.max(...pre) : juryBefore - 1,
    juryBefore,
    finalAfter: Math.max(...nonFinal),
    finalBefore: s.days,
    finalCount: s.cast.filter((a) => a.finalist).length,
  };
}

/* Starting tribes, not counting players who were never placed in one. */
export const startingTribes = (s: Season): string[] =>
  [...new Set(s.cast.map(startingTribe))].filter((t) => t !== 'No tribe');

export interface Index {
  /* every Appearance of a player, in air order */
  appearances: Map<string, Appearance[]>;
  seasonOf: Map<Appearance, Season>;
}

export function buildIndex(d: Dataset): Index {
  const appearances = new Map<string, Appearance[]>();
  const seasonOf = new Map<Appearance, Season>();
  for (const s of d.seasons) {
    for (const a of s.cast) {
      seasonOf.set(a, s);
      const list = appearances.get(a.pid);
      if (list) list.push(a); else appearances.set(a.pid, [a]);
    }
  }
  return { appearances, seasonOf };
}

/* Backstory seasons: earlier seasons in which this season's returning players appeared (direct only). */
export function backstorySeasons(s: Season, ix: Index): number[] {
  const nums = new Set<number>();
  for (const a of s.cast) {
    for (const other of ix.appearances.get(a.pid) ?? []) {
      const n = ix.seasonOf.get(other)!.num;
      if (n < s.num) nums.add(n);
    }
  }
  return [...nums].sort((a, b) => a - b);
}
