/*
 * Player card: one card per Player, not per Appearance. The per-season stats
 * follow the Active season. When the player is not in the Active season, no
 * row is highlighted and those stats show a dash, so the card keeps its shape.
 */
import type { Appearance, Person, Season } from '../model.ts';
import { EXIT_ICONS, esc, initials, ordinal, wikiUrl } from '../format.ts';
import { startingTribe } from '../season.ts';

export interface CardContext {
  person: Person;
  appearances: Appearance[];  // in air order
  seasonOf: (a: Appearance) => Season;
  activeSeasonId: string | null;
  watched: (seasonId: string) => boolean;
}

export function cardHtml(c: CardContext): string {
  const { person, appearances: apps } = c;
  const cur = apps.find((a) => c.seasonOf(a).id === c.activeSeasonId) ?? null;
  const curSeason = cur ? c.seasonOf(cur) : null;
  const stat = (v: () => string | number | null) => {
    const value = cur ? v() : null;
    return value === null || value === '' ? '<span class="pc-blank">—</span>' : esc(value);
  };
  const tint = cur && curSeason ? curSeason.tribes[startingTribe(cur)] : '#8a8f98';
  const photo = person.photo
    ? `<img src="${esc(person.photo.src)}" alt="${esc(person.name)}" loading="lazy"><small class="pc-credit" title="${esc(person.photo.credit)}">Photo: CBS</small>`
    : `<span>${esc(initials(person.name))}</span><small>no photo</small>`;

  const rows = apps.map((a) => {
    const s = c.seasonOf(a);
    const res = c.watched(s.id)
      ? `${EXIT_ICONS[a.exit.kind]} ${esc(a.exit.label)}${a.finalist ? '' : ` · Day ${a.exit.day}`}` +
        (a.immunity.length ? ` · <span class="imm">◆</span>×${a.immunity.length}` : '')
      : 'Results hidden';
    return `<li class="${a === cur ? 'on' : ''}">
      <button data-goto="${s.id}:${a.pid}" title="Go to ${esc(a.name)} in Season ${s.num}">
        <span class="pc-sn">S${s.num}</span>
        <span class="pc-st"><span><b>${esc(s.name)}</b> <span class="pc-age">· age ${a.age ?? '?'}</span></span><span class="pc-res">${res}</span></span>
      </button></li>`;
  }).join('');

  return `<div class="pc" aria-label="Player card: ${esc(person.name)}">
    <button class="pc-close" aria-label="Close player card">×</button>
    <div class="pc-photo${cur ? '' : ' off'}${person.photo ? ' has-img' : ''}" style="--tc:${tint}">${photo}</div>
    <div class="pc-body">
      <h3>${esc(person.name)}</h3>
      <dl>
        <div><dt>Age</dt><dd>${stat(() => cur!.age)}</dd></div>
        <div><dt>Occupation</dt><dd>${stat(() => cur!.job)}</dd></div>
        <div><dt>Hometown</dt><dd>${stat(() => cur!.home)}</dd></div>
        <div><dt>Appearance</dt><dd>${stat(() => `${ordinal(apps.indexOf(cur!) + 1)} of ${apps.length}`)}</dd></div>
      </dl>
      <h4>Seasons played</h4>
      <ol class="pc-seasons">${rows}</ol>
      <div class="pc-links"><a href="${wikiUrl(person.wikiTitle)}" target="_blank" rel="noopener">Survivor Wiki ↗</a></div>
    </div></div>`;
}
