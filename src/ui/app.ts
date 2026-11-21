/*
 * The dashboard page: season cards, cross-season links in the left gutter,
 * the season index, the player card rail, hover popovers and settings.
 */
import type { Appearance, Dataset, Season } from '../model.ts';
import { ORDERS, type Order } from '../layout.ts';
import { renderSeason } from '../render.ts';
import { backstorySeasons, buildIndex, startingTribes } from '../season.ts';
import { esc, wikiUrl } from '../format.ts';
import { OrderSetting, Watched } from '../storage.ts';
import { cardHtml } from './card.ts';

const WATCH_FIRST_SHOWN = 6;
const LINK_COLOURS = ['#d1495b', '#00798c', '#e09f3e', '#5c946e', '#8e6c8a', '#3d5a80', '#c8553d', '#2a9d8f'];

const $ = <T extends Element>(sel: string, root: ParentNode = document): T => root.querySelector<T>(sel)!;

export function mountApp(data: Dataset): void {
  const page = $<HTMLElement>('#page');
  const cardsEl = $<HTMLElement>('#cards');
  const gutter = $<SVGSVGElement>('#gutter');
  const panel = $<HTMLElement>('#player');
  const index = $<HTMLElement>('#index');
  const ix = buildIndex(data);
  const seasonOf = (a: Appearance) => ix.seasonOf.get(a)!;
  const byId = new Map(data.seasons.map((s) => [s.id, s]));
  const maxDays = Math.max(...data.seasons.map((s) => s.days));
  const charts = new Map<Season, HTMLElement>();
  const backstory = new Map(data.seasons.map((s) => [s, backstorySeasons(s, ix)]));
  const expanded = new Set<string>();  // seasons whose Watch first list was expanded

  let order: Order = OrderSetting.get();
  let pinned: string | null = null;
  let hovered: string | null = null;
  let activeId: string | null = null;
  let holdActiveUntil = 0;

  /* ---------- season cards ---------- */

  for (const s of data.seasons) {
    const sec = document.createElement('section');
    sec.className = 'card';
    sec.id = s.id;
    sec.innerHTML = `<header class="card-head">
        <div class="card-title">
          <a class="card-num" href="${wikiUrl(s.wikiTitle)}" target="_blank" rel="noopener" title="${esc(s.wikiTitle)} on Survivor Wiki">Season ${s.num}</a>
          <h2>${esc(s.name)}</h2>
          ${s.year ? `<div class="card-year">${s.year}</div>` : ''}
          ${s.ranking ? `<a class="card-rank" href="${esc(s.ranking.url)}" target="_blank" rel="noopener" title="Purple Rock Podcast season ranking, with a spoiler-free summary">Ranked ${s.ranking.rank} of ${s.ranking.of}</a>` : ''}
        </div>
        <div class="card-meta"><span>${s.cast.length} castaways</span><span>${s.days} days</span>
          <span>${startingTribes(s).length} starting tribes</span><span class="prereq"></span></div>
        <label class="toggle"><input type="checkbox" ${Watched.get(s.id) ? 'checked' : ''}>
          <span class="track"><span class="thumb"></span></span><span>Reveal results</span></label>
      </header><div class="chart"></div>`;
    cardsEl.append(sec);
    charts.set(s, $<HTMLElement>('.chart', sec));
    $<HTMLInputElement>('input', sec).addEventListener('change', (e) => {
      Watched.set(s.id, (e.target as HTMLInputElement).checked);
      draw(s);
      drawGutter();
      renderCard();
      renderIndex();
      data.seasons.forEach(renderWatchFirst);
    });
  }

  function draw(s: Season): void {
    const el = charts.get(s)!;
    const old = el.querySelector('.scroller');
    const x = old ? old.scrollLeft : 0;
    el.innerHTML = renderSeason(s, Watched.get(s.id), el.clientWidth, { maxDays, order });
    const now = el.querySelector('.scroller');
    if (now) now.scrollLeft = x;
  }

  /* "Watch first": backstory seasons not yet Watched, in air order; long lists collapse. */
  function renderWatchFirst(s: Season): void {
    const el = $<HTMLElement>(`#${s.id} .prereq`);
    const all = backstory.get(s)!;
    if (!all.length) { el.innerHTML = ''; return; }
    const left = all.filter((n) => !Watched.get(`${s.version}${n}`));
    if (!left.length) { el.innerHTML = '<span class="prereq-done">✓ All backstories watched</span>'; return; }
    const shown = expanded.has(s.id) ? left : left.slice(0, WATCH_FIRST_SHOWN);
    const more = left.length - shown.length;
    el.innerHTML = `Watch first: ${shown.map((n) => `<a href="#${s.version}${n}">S${n}</a>`).join(' ')}` +
      (more ? ` <button class="prereq-more" data-season="${s.id}">+${more} more</button>` : '') +
      ` <em>(${left.length} of ${all.length} left)</em>`;
  }
  cardsEl.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('.prereq-more');
    if (!b) return;
    expanded.add(b.dataset.season!);
    renderWatchFirst(byId.get(b.dataset.season!)!);
  });

  /* ---------- cross-season links ---------- */

  /*
   * One line per returning player, joining each of their appearances. All
   * lines share one track and may overlap: only one player is highlighted at
   * a time, and the highlighted line is drawn on top.
   */
  function drawGutter(): void {
    const pr = page.getBoundingClientRect();
    gutter.setAttribute('width', String(pr.width));
    gutter.setAttribute('height', String(pr.height));
    const links: { pid: string; pts: { x: number; y: number }[] }[] = [];
    for (const [pid, apps] of ix.appearances) {
      if (apps.length < 2) continue;
      const pts = apps.map((a) => {
        const el = page.querySelector(`.name[data-key="${seasonOf(a).id}:${pid}"]`);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.left - pr.left - 5, y: b.top - pr.top + b.height / 2 };
      }).filter((p): p is { x: number; y: number } => p !== null);
      if (pts.length > 1) links.push({ pid, pts });
    }
    links.sort((a, b) => a.pts[0].y - b.pts[0].y);
    const lx = cardsEl.offsetLeft - 12, r = 6;
    gutter.innerHTML = links.map((l, i) => {
      let d = '';
      for (let j = 1; j < l.pts.length; j++) {
        const a = l.pts[j - 1], b = l.pts[j];
        d += `M${a.x},${a.y} H${lx + r} Q${lx},${a.y} ${lx},${a.y + r} V${b.y - r} Q${lx},${b.y} ${lx + r},${b.y} H${b.x} `;
      }
      const dots = l.pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.5"/>`).join('');
      return `<g class="link" data-pid="${l.pid}" style="--c:${LINK_COLOURS[i % LINK_COLOURS.length]}"><path d="${d}"/>${dots}</g>`;
    }).join('');
    applyHighlight();
  }

  function drawAll(): void {
    data.seasons.forEach(draw);
    drawGutter();
  }

  function applyHighlight(): void {
    page.classList.toggle('hovering', !!(hovered || pinned));
    page.querySelectorAll('.hl, .pin').forEach((e) => e.classList.remove('hl', 'pin'));
    if (hovered) page.querySelectorAll(`[data-pid="${hovered}"]`).forEach((e) => e.classList.add('hl'));
    if (pinned) page.querySelectorAll(`[data-pid="${pinned}"]`).forEach((e) => e.classList.add('hl', 'pin'));
    /* Gutter lines overlap: draw the highlighted ones last so they sit on top. */
    gutter.querySelectorAll('.link.pin').forEach((e) => gutter.append(e));
    gutter.querySelectorAll('.link.hl:not(.pin)').forEach((e) => gutter.append(e));
    for (const sec of cardsEl.children) sec.classList.toggle('is-active', !!pinned && sec.id === activeId);
  }

  /* ---------- active season, index and player card ---------- */

  /* The Active season is the card under a reading line 35% down the viewport. */
  function seasonAtReadingLine(): string | null {
    const line = innerHeight * 0.35;
    let last: string | null = null;
    for (const sec of cardsEl.children) {
      const r = sec.getBoundingClientRect();
      if (r.top > line) return last ?? sec.id;
      last = sec.id;
      if (r.bottom > line) return last;
    }
    return last;
  }

  function renderIndex(): void {
    const watched = data.seasons.filter((s) => Watched.get(s.id)).length;
    index.innerHTML = `<div class="ix"><ol>${data.seasons.map((s) => {
      const w = Watched.get(s.id);
      return `<li><a href="#${s.id}" class="${w ? 'watched' : ''} ${s.id === activeId ? 'active' : ''}" ` +
        `title="Season ${s.num} · ${esc(s.name)}${w ? ' · watched' : ''}">${s.num}</a></li>`;
    }).join('')}</ol><div class="ix-count" title="Seasons watched">${watched}/${data.seasons.length}</div></div>`;
    index.querySelector('a.active')?.scrollIntoView({ block: 'nearest' });
  }

  function renderCard(): void {
    if (!pinned) return;
    const keep = panel.scrollTop;
    panel.innerHTML = cardHtml({
      person: data.people[pinned],
      appearances: ix.appearances.get(pinned)!,
      seasonOf,
      activeSeasonId: activeId,
      activeSeasonNum: data.seasons.find((s) => s.id === activeId)?.num ?? null,
      watched: (id) => Watched.get(id),
    });
    panel.scrollTop = keep;
    applyHighlight();
  }

  /* Keep the content under the viewport still when the rail changes the layout. */
  function keepStill(change: () => void): void {
    const anchor = [...cardsEl.children].find((el) => el.getBoundingClientRect().bottom > 0);
    const before = anchor ? anchor.getBoundingClientRect().top : 0;
    change();
    if (anchor) {
      const diff = anchor.getBoundingClientRect().top - before;
      if (diff) window.scrollBy({ top: diff, behavior: 'instant' });
    }
  }

  function openPlayer(a: Appearance, nameEl?: Element): void {
    pinned = a.pid;
    activeId = seasonOf(a).id;
    holdActiveUntil = performance.now() + 400;
    renderIndex();
    keepStill(() => {
      renderCard();
      panel.hidden = false;
      page.classList.add('with-rail');
    });
    /* On phones the card is a sheet over the bottom of the screen; keep the clicked name above it. */
    if (nameEl && getComputedStyle(panel).position === 'fixed') {
      const sheet = panel.getBoundingClientRect(), r = nameEl.getBoundingClientRect();
      if (r.bottom > sheet.top - 8) window.scrollBy({ top: r.bottom - sheet.top + 40, behavior: 'instant' });
    }
  }

  function closePlayer(): void {
    pinned = null;
    if (!panel.hidden) keepStill(() => { panel.hidden = true; page.classList.remove('with-rail'); });
    applyHighlight();
  }

  function appearanceOf(el: Element): Appearance {
    const [sid, pid] = (el as HTMLElement).dataset.key!.split(':');
    return byId.get(sid)!.cast.find((a) => a.pid === pid)!;
  }

  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (performance.now() < holdActiveUntil) return;
      const id = seasonAtReadingLine();
      if (id === activeId) return;
      activeId = id;
      renderIndex();
      if (pinned) renderCard();
    });
  }, { passive: true });

  /* ---------- pointer and keyboard ---------- */

  const HOVER_TARGETS = '.name, .exit, .immunity, .reward, .voteout';
  page.addEventListener('mouseover', (e) => {
    const t = (e.target as Element).closest<HTMLElement | SVGElement>(HOVER_TARGETS);
    if (t) { hovered = t.dataset.pid ?? null; applyHighlight(); }
  });
  page.addEventListener('mouseout', (e) => {
    if ((e.target as Element).closest(HOVER_TARGETS)) { hovered = null; applyHighlight(); }
  });
  page.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (target.closest('.reveal-hit, .veil')) {
      const input = $<HTMLInputElement>('.toggle input', target.closest('.card')!);
      input.checked = true;
      input.dispatchEvent(new Event('change'));
      return;
    }
    const n = target.closest('.name');
    if (!n) return;
    const a = appearanceOf(n);
    if (pinned === a.pid && activeId === seasonOf(a).id && !panel.hidden) closePlayer();
    else openPlayer(a, n);
  });
  page.addEventListener('keydown', (e) => {
    const n = (e.target as Element).closest?.('.name');
    if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPlayer(appearanceOf(n), n); }
  });

  panel.addEventListener('click', (e) => {
    const target = e.target as Element;
    const go = target.closest<HTMLElement>('[data-goto]');
    if (go) {
      const sid = go.dataset.goto!.split(':')[0];
      activeId = sid;
      holdActiveUntil = performance.now() + 900;  // let the smooth scroll land
      renderCard();
      renderIndex();
      const row = page.querySelector(`.name[data-key="${go.dataset.goto}"]`);
      (row ?? document.getElementById(sid))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (target.closest('.pc-close')) closePlayer();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePlayer(); });

  /* Popover beside a hovered marker, with an arrow pointing at it; flips left when there is no room. */
  const tip = document.createElement('div');
  tip.id = 'tip';
  tip.hidden = true;
  document.body.append(tip);
  let tipFor: Element | null = null;
  const hideTip = () => { tipFor = null; tip.hidden = true; };
  page.addEventListener('mouseover', (e) => {
    const x = (e.target as Element).closest<SVGElement>('[data-tip]');
    if (!x || x === tipFor) return;
    tipFor = x;
    const [who, what] = x.dataset.tip!.split('|');
    tip.innerHTML = `<b>${who}</b><span>${what}</span>`;
    tip.hidden = false;
    const r = x.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, gap = 10;
    let left = r.right + gap, side = 'right';
    if (left + w > innerWidth - 8) { left = r.left - gap - w; side = 'left'; }
    tip.dataset.side = side;
    tip.style.left = `${left}px`;
    tip.style.top = `${r.top + r.height / 2 - h / 2}px`;
  });
  page.addEventListener('mouseout', (e) => {
    const related = e.relatedTarget as Node | null;
    if (tipFor && !(related && tipFor.contains(related))) hideTip();
  });
  addEventListener('scroll', hideTip, { passive: true });

  /* ---------- order setting ---------- */

  const orderButtons = document.querySelectorAll<HTMLButtonElement>('.seg button');
  const syncOrder = () => orderButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.order === order)));
  orderButtons.forEach((b) => b.addEventListener('click', () => {
    order = ORDERS.find((o) => o === b.dataset.order) ?? 'lanes';
    OrderSetting.set(order);
    syncOrder();
    drawAll();
  }));
  syncOrder();

  /* ---------- start ---------- */

  data.seasons.forEach(renderWatchFirst);
  let lastW = cardsEl.clientWidth;
  drawAll();
  activeId = seasonAtReadingLine();
  renderIndex();
  new ResizeObserver(() => {
    const w = cardsEl.clientWidth;
    if (w !== lastW) { lastW = w; drawAll(); }
  }).observe(cardsEl);
  document.fonts?.ready.then(drawGutter);
}
