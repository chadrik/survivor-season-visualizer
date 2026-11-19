/* Small formatting helpers and the exit icon table. */
import type { ExitKind } from './model.ts';

export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export function ordinal(n: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0]);
}

export const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 3).join('');

export const EXIT_ICONS: Record<ExitKind, string> = {
  voted: '🗳️',
  medevac: '⛑️',
  quit: '🚪',
  ejected: '🚫',
  switched: '🔁',
  eliminated: '❌',
  rocks: '🪨',
  fire: '🔥',
  secondChance: '🏝️',
  finalist: '🎖️',
  winner: '👑',
};

export const wikiUrl = (title: string): string =>
  `https://survivor.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%3A/g, ':')}`;

/* Purple Rock review URLs contain episode titles, so seasons without a curated link get a site search. */
export const reviewUrl = (url: string | null, seasonName: string): string =>
  url ?? `https://www.purplerockpodcast.com/?s=${encodeURIComponent(seasonName)}`;
