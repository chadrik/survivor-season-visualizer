/*
 * Convert survivoR tables (https://github.com/doehm/survivoR, MIT) into the
 * dashboard Dataset. Pure function: no file or network access, so tests can
 * run it on fixture tables.
 */
import type { Appearance, Dataset, Exit, ExitKind, Person, Phase, Season, Stint } from '../../src/model.ts';

/* survivoR rows are loose JSON records; read fields defensively. */
type Row = Record<string, unknown>;

export interface RawTables {
  castaways: Row[];
  castaway_details: Row[];
  tribe_mapping: Row[];
  tribe_colours: Row[];
  season_summary: Row[];
  vote_history: Row[];
  challenge_results: Row[];
}

export interface ConvertOptions {
  version: string;                  // "US"
  today: string;                    // ISO date; seasons that end after it are left out
  reviews: Record<string, string>;  // season number -> Purple Rock URL
}

const SECOND_CHANCES = new Set(['Redemption Island', 'Edge of Extinction']);
const MAIN_STATUSES = new Set(['Original', 'Swapped', 'Swapped_2', 'Swapped_3', 'Merged', 'Mergatory']);
const SECOND_CHANCE_COLOUR = '#8a8f98';
/* Tribe names survivoR uses for a merge before the merged tribe is named. */
const PLACEHOLDER_TRIBES = new Set(['Mergatory', 'Merged', 'None']);

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const groupBy = <T>(rows: T[], key: (r: T) => string): Map<string, T[]> => {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r); else m.set(k, [r]);
  }
  return m;
};

/* "Survivor: Borneo" -> "Borneo"; "Survivor 41" -> "Survivor 41". */
export function seasonName(raw: string | null, n: number): string {
  const name = (raw ?? '').replace(/^Survivor:?\s*/, '').trim();
  return !name || /^\d+$/.test(name) ? `Survivor ${n}` : name;
}

export function convert(t: RawTables, o: ConvertOptions): Dataset {
  const inVersion = (r: Row) => r.version === o.version;
  const summaries = t.season_summary.filter(inVersion);
  const castaways = t.castaways.filter(inVersion);
  const mapping = t.tribe_mapping.filter(inVersion);
  const votes = t.vote_history.filter(inVersion);
  const challenges = t.challenge_results.filter(inVersion);
  const colours = t.tribe_colours.filter(inVersion);
  const details = new Map(t.castaway_details.map((r) => [str(r.castaway_id) ?? '', r]));

  /* A season is complete when it has a winner and has finished airing. */
  const complete = summaries.filter((s) => {
    const n = num(s.season);
    const ended = str(s.ended);
    return n !== null && ended !== null && ended <= o.today &&
      castaways.some((c) => c.season === n && c.winner === true);
  }).sort((a, b) => (num(a.season) ?? 0) - (num(b.season) ?? 0));

  const seasons = complete.map((s) => convertSeason(s, {
    castaways: castaways.filter((c) => c.season === s.season),
    mapping: mapping.filter((r) => r.season === s.season),
    votes: votes.filter((r) => r.season === s.season),
    challenges: challenges.filter((r) => r.season === s.season),
    colours: colours.filter((r) => r.season === s.season),
  }, o));

  const shortName = new Map(castaways.map((c) => [str(c.castaway_id) ?? '', str(c.castaway)]));
  const people: Record<string, Person> = {};
  for (const s of seasons) {
    for (const a of s.cast) {
      if (people[a.pid]) continue;
      const d = details.get(a.pid);
      const name = str(d?.full_name) ?? a.name;
      const short = shortName.get(a.pid), last = str(d?.last_name);
      const alt = short && last ? `${short} ${last}` : null;
      people[a.pid] = { pid: a.pid, name, wikiTitle: name, altWikiTitle: alt && alt !== name ? alt : null, photo: null };
    }
  }
  /* Occupation is per person in survivoR. */
  for (const s of seasons) for (const a of s.cast) a.job = str(details.get(a.pid)?.occupation);

  return {
    generated: o.today,
    source: 'Season data from survivoR by Daniel Oehm (MIT License), https://github.com/doehm/survivoR',
    seasons,
    people,
  };
}

interface SeasonRows {
  castaways: Row[];
  mapping: Row[];
  votes: Row[];
  challenges: Row[];
  colours: Row[];
}

function convertSeason(summary: Row, r: SeasonRows, o: ConvertOptions): Season {
  const n = num(summary.season)!;
  const name = seasonName(str(summary.season_name), n);
  const days = Math.max(...r.castaways.filter((c) => c.winner === true).map((c) => num(c.day) ?? 0));

  /*
   * "Mergatory" is the merge before the merged tribe gets its name: treat it as
   * that tribe. The merged tribe's name is the winner's tribe on the last day.
   */
  const lastMerged = [...r.mapping]
    .filter((m) => m.tribe_status === 'Merged' && str(m.tribe) && !PLACEHOLDER_TRIBES.has(String(m.tribe)))
    .sort((a, b) => (num(b.day) ?? 0) - (num(a.day) ?? 0))[0];
  const mergedTribe = str(lastMerged?.tribe);

  /* Each mapping row reduced to the tribe it puts the player in, or null to ignore it. */
  const placeOf = (m: Row): { tribe: string; second: boolean } | null => {
    const status = str(m.tribe_status) ?? '';
    if (SECOND_CHANCES.has(status)) return { tribe: status, second: true };
    if (!MAIN_STATUSES.has(status)) return null;  // e.g. Exile Island
    if (mergedTribe && (status === 'Mergatory' || (status === 'Merged' && PLACEHOLDER_TRIBES.has(String(m.tribe))))) {
      return { tribe: mergedTribe, second: false };
    }
    const tribe = str(m.tribe);
    return tribe && tribe !== 'None' ? { tribe, second: false } : null;
  };

  const byPlayer = groupBy(r.mapping, (m) => str(m.castaway_id) ?? '');
  const sortRows = (rows: Row[]) =>
    [...rows].sort((a, b) => (num(a.day) ?? 0) - (num(b.day) ?? 0) || (num(a.episode) ?? 0) - (num(b.episode) ?? 0));

  /* Day of each stage of the game (sog), from vote history; fallback: last mapped day of the episode. */
  const sogDay = new Map<number, number>();
  for (const v of r.votes) {
    const sog = num(v.sog_id), day = num(v.day);
    if (sog !== null && day !== null) sogDay.set(sog, day);
  }
  const episodeDay = new Map<number, number>();
  for (const m of r.mapping) {
    const ep = num(m.episode), day = num(m.day);
    if (ep !== null && day !== null) episodeDay.set(ep, Math.max(episodeDay.get(ep) ?? 0, day));
  }
  const challengeDay = (c: Row): number | null =>
    sogDay.get(num(c.sog_id) ?? -1) ?? episodeDay.get(num(c.episode) ?? -1) ?? null;

  const rockDraws = new Set(r.votes.filter((v) => v.vote_event === 'Rock draw').map((v) => str(v.voted_out_id)));
  const secondChance = r.mapping.map((m) => str(m.tribe_status)).find((st) => st && SECOND_CHANCES.has(st)) ?? null;

  const cast: Appearance[] = r.castaways.map((c) => {
    const pid = str(c.castaway_id)!;
    const rows = sortRows(byPlayer.get(pid) ?? []);
    const stints = buildStints(rows, placeOf);
    const lastMapped = rows.length ? num(rows[rows.length - 1].day) ?? 0 : 0;
    const finalist = c.finalist === true || c.winner === true;
    const exitDay = finalist ? days : Math.max(num(c.day) ?? 0, lastMapped);
    if (stints.length) stints[stints.length - 1].to = exitDay;
    else {
      /* Never placed in a tribe, such as Palau's two Day 2 eliminations. */
      const tribe = str(c.original_tribe);
      stints.push({ from: 1, to: exitDay, tribe: tribe && tribe !== 'None' ? tribe : 'No tribe' });
    }

    const playerVotes = r.votes.filter((v) => v.voted_out_id === pid);
    const challengesWon = r.challenges.filter((x) => x.castaway_id === pid);
    const winDays = (field: string) => [...new Set(challengesWon
      .filter((x) => x[field] === 1).map(challengeDay)
      .filter((d): d is number => d !== null && d <= exitDay))].sort((a, b) => a - b);

    return {
      pid,
      name: str(c.full_name) ?? str(c.castaway) ?? pid,
      age: num(c.age),
      home: [str(c.city), str(c.state)].filter(Boolean).join(', ') || null,
      job: null,
      stints,
      exit: exitOf(str(c.result) ?? '', c, exitDay, stints, rockDraws.has(pid)),
      voteOuts: [...new Set(playerVotes.map((v) => num(v.day)).filter((d): d is number => d !== null))].sort((a, b) => a - b),
      immunity: winDays('won_individual_immunity'),
      tribeImmunity: winDays('won_tribal_immunity'),
      jury: c.jury === true,
      finalist,
      winner: c.winner === true,
    };
  });

  const phases = buildPhases(r.mapping, placeOf);
  const tribes = tribeColours(cast, r.colours);
  return {
    id: `${o.version}${n}`,
    version: o.version,
    num: n,
    name,
    days,
    tribes,
    secondChance,
    phases,
    cast,
    reviewUrl: o.reviews[String(n)] ?? null,
    wikiTitle: /^Survivor \d+$/.test(name) ? name : `Survivor: ${name}`,
  };
}

/* Runs of days with the same tribe. A change seen on day d after day p starts on day p + 1. */
export function buildStints(rows: Row[], placeOf: (m: Row) => { tribe: string; second: boolean } | null): Stint[] {
  const stints: Stint[] = [];
  for (const m of rows) {
    const p = placeOf(m);
    const day = num(m.day);
    if (!p || day === null) continue;
    const last = stints[stints.length - 1];
    if (!last) stints.push({ from: 1, to: day, tribe: p.tribe, ...(p.second ? { second: true } : {}) });
    else if (last.tribe === p.tribe) last.to = day;
    else stints.push({ from: last.to + 1, to: day, tribe: p.tribe, ...(p.second ? { second: true } : {}) });
  }
  return stints;
}

/*
 * A new phase starts when at least two players still in the main game change
 * tribe. One player moving alone (a Blood vs Water switch, a return from a
 * Second chance) does not start a phase.
 */
export function buildPhases(mapping: Row[], placeOf: (m: Row) => { tribe: string; second: boolean } | null): Phase[] {
  const byDay = groupBy(mapping, (m) => String(num(m.day)));
  const days = [...byDay.keys()].map(Number).filter((d) => !Number.isNaN(d)).sort((a, b) => a - b);
  const phases: Phase[] = [{ day: 1, label: 'Start', merge: false }];
  let prev: Map<string, string> | null = null;
  let prevDay = 0;
  for (const day of days) {
    const now = new Map<string, string>();
    for (const m of byDay.get(String(day))!) {
      const p = placeOf(m);
      const id = str(m.castaway_id);
      if (p && !p.second && id) now.set(id, p.tribe);
    }
    if (prev) {
      const movers = [...now].filter(([id, tribe]) => prev!.has(id) && prev!.get(id) !== tribe).length;
      const tribes = new Set(now.values());
      const mergedToday = tribes.size === 1 &&
        mapping.some((m) => num(m.day) === day && (m.tribe_status === 'Merged' || m.tribe_status === 'Mergatory'));
      const alreadyMerged = phases.some((p) => p.merge);
      /* A merge counts once, even when only one player moves (Palau) or the merged tribe is renamed. */
      if (mergedToday && !alreadyMerged) {
        phases.push({ day: prevDay + 1, label: 'Merge', merge: true });
      } else if (movers >= 2 && !alreadyMerged) {
        const before = new Set(prev.values());
        phases.push({ day: prevDay + 1, label: tribes.size !== before.size ? 'Tribe shuffle' : 'Tribe swap', merge: false });
      }
    }
    prev = now;
    prevDay = day;
  }
  return phases;
}

const EXIT_LABELS: Record<ExitKind, string> = {
  voted: 'Voted out',
  medevac: 'Medically evacuated',
  quit: 'Quit',
  ejected: 'Ejected',
  switched: 'Switched places with a loved one',
  eliminated: 'Eliminated',
  rocks: 'Drew the wrong rock',
  fire: 'Lost fire-making',
  secondChance: 'Lost the second chance',
  finalist: 'Finalist',
  winner: 'Sole Survivor',
};

export function exitOf(result: string, c: Row, day: number, stints: Stint[], drewRock: boolean): Exit {
  const r = result.toLowerCase();
  const endedInSecondChance = stints.length > 0 && stints[stints.length - 1].second === true;
  const twist = endedInSecondChance ? stints[stints.length - 1].tribe : '';
  let kind: ExitKind;
  let label: string | null = null;
  if (c.winner === true) kind = 'winner';
  else if (c.finalist === true || r.includes('runner-up')) { kind = 'finalist'; label = result; }
  else if (r.includes('medically')) kind = 'medevac';
  else if (r.includes('quit') || r.includes('withdrew')) {
    kind = 'quit';
    if (endedInSecondChance) label = `Quit the ${twist}`;
  }
  else if (r.includes('ejected')) kind = 'ejected';
  else if (r.includes('switched')) kind = 'switched';
  else if (r.includes('fire')) kind = 'fire';
  else if (drewRock) kind = 'rocks';
  else if (r.includes('eliminated')) kind = 'eliminated';
  else if (endedInSecondChance) {
    kind = 'secondChance';
    label = twist === 'Redemption Island' ? 'Lost on Redemption Island' : `Out at the ${twist}`;
  }
  else kind = 'voted';
  return { day, kind, label: label ?? EXIT_LABELS[kind] };
}

/* Tribe colours in display order: tribes by first day used, Second chances last. */
function tribeColours(cast: Appearance[], colours: Row[]): Record<string, string> {
  const first = new Map<string, { day: number; second: boolean }>();
  for (const a of cast) {
    for (const s of a.stints) {
      const seen = first.get(s.tribe);
      if (!seen || s.from < seen.day) first.set(s.tribe, { day: s.from, second: !!s.second });
    }
  }
  const colourOf = new Map(colours.map((c) => [str(c.tribe) ?? '', str(c.tribe_colour)]));
  const ordered = [...first].sort(([ta, a], [tb, b]) => Number(a.second) - Number(b.second) || a.day - b.day || ta.localeCompare(tb));
  const out: Record<string, string> = {};
  for (const [tribe, info] of ordered) out[tribe] = colourOf.get(tribe) ?? (info.second ? SECOND_CHANCE_COLOUR : '#888888');
  return out;
}
