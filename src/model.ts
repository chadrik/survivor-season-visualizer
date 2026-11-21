/*
 * The dataset the page loads (public/data/seasons.json). The build script
 * scripts/build-data.ts writes it from the survivoR tables. Terms follow
 * CONTEXT.md: a Person is a Player; an Appearance is one Player in one Season.
 */

export type ExitKind =
  | 'voted'         // voted out at tribal council
  | 'medevac'       // medically evacuated
  | 'quit'          // quit or withdrew
  | 'ejected'       // removed from the game by production
  | 'switched'      // swapped places with a loved one (Blood vs Water)
  | 'eliminated'    // eliminated without a vote, such as an early challenge
  | 'rocks'         // drew the wrong rock
  | 'fire'          // lost a fire-making challenge
  | 'secondChance'  // left the game for good from a Second chance
  | 'finalist'      // faced the jury and lost
  | 'winner';       // Sole Survivor

/* A run of days (inclusive) with one tribe, or one Second chance. */
export interface Stint {
  from: number;
  to: number;
  tribe: string;
  /* True while the player is in a Second chance (Redemption Island, Edge of Extinction). */
  second?: boolean;
}

export interface Exit {
  day: number;
  kind: ExitKind;
  /* Human label, such as "Lost on Redemption Island". */
  label: string;
}

export interface Appearance {
  pid: string;          // survivoR castaway_id, stable across seasons
  name: string;         // full name
  age: number | null;
  home: string | null;  // "City, State"
  job: string | null;
  stints: Stint[];
  exit: Exit;
  voteOuts: number[];       // days of each Vote-out
  immunity: number[];       // days of individual immunity wins
  tribeImmunity: number[];  // days of tribe immunity wins
  reward: number[];         // days of individual or team reward wins
  tribeReward: number[];    // days of tribe reward wins
  juryVote: string | null;  // pid of the finalist this juror voted for
  juryVotes: number | null; // jury votes a finalist received
  photo: Photo | null;      // cast photo from this season
  jury: boolean;
  finalist: boolean;
  winner: boolean;
}

export interface Phase {
  day: number;    // first day of the phase
  label: string;  // "Start", "Tribe swap", "Merge", ...
  merge: boolean;
}

export interface Season {
  id: string;        // version + number, such as "US1"
  version: string;   // "US"
  num: number;
  name: string;      // "Borneo", "Survivor 41"
  days: number;
  tribes: Record<string, string>;  // tribe name -> colour, in display order
  secondChance: string | null;     // twist name, such as "Edge of Extinction"
  phases: Phase[];
  cast: Appearance[];
  year: number | null;             // year the season premiered
  ranking: Ranking | null;         // Purple Rock Podcast ranking, if ranked yet
  wikiTitle: string;               // Survivor Wiki page title
}

export interface Ranking {
  rank: number;  // 1 is best
  of: number;    // seasons in the ranking
  url: string;   // the season's spoiler-free summary on the ranking page
}

export interface Photo {
  src: string;     // path relative to the site root
  credit: string;  // where the image came from
}

export interface Person {
  pid: string;
  name: string;
  wikiTitle: string;          // Survivor Wiki page; updated to the page the photo lookup found
  altWikiTitle: string | null; // "Short name + surname" (wiki pages often use nicknames)
  photo: Photo | null;
}

export interface Dataset {
  generated: string;  // ISO date of the build
  source: string;     // attribution for the survivoR data
  seasons: Season[];
  people: Record<string, Person>;
}
