/*
 * Shared code for the mockups: data model, row layout, cross-season links,
 * player card and the remembered reveal state. Each mockup supplies only a
 * renderSeason(season, revealed, width) function that returns an SVG string.
 */
'use strict';

const EXIT = {
  voted:    { icon: '🗳️', label: 'Voted out' },
  medevac:  { icon: '⛑️', label: 'Medically evacuated' },
  quit:     { icon: '🚪', label: 'Quit' },
  rocks:    { icon: '🪨', label: 'Drew the wrong rock' },
  fire:     { icon: '🔥', label: 'Lost fire-making' },
  finalist: { icon: '🎖️', label: 'Finalist' },
  winner:   { icon: '👑', label: 'Sole Survivor' },
};

const LINK_COLORS = ['#d1495b', '#00798c', '#e09f3e', '#5c946e', '#8e6c8a', '#3d5a80'];

const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

/* Higher rank = lasted longer. Winner beats other finalists. */
const rank = (c) => (c.how === 'winner' ? 1e4 : c.finalist ? 9999 : c.exit);

/* ---------- model ---------- */

/* Index of the phase that contains a given day. */
function phaseAt(s, day) {
  let i = 0;
  while (i + 1 < s.phases.length && s.phases[i + 1].day <= day) i++;
  return i;
}

function prepare(seasons) {
  const people = new Map();
  seasons.forEach((s) => {
    s.cast = s.cast.map((r) => ({
      name: r[0], pid: slug(r[0]), tribes: r[1], exit: r[2], how: r[3],
      age: r[4], job: r[5], home: r[6], season: s,
    }));
    s.phases.forEach((p, i) => { p.end = i < s.phases.length - 1 ? s.phases[i + 1].day - 1 : s.days; });
    s.cast.forEach((c) => {
      c.finalist = c.how === 'winner' || c.how === 'finalist';
      c.juror = !c.finalist && c.exit >= s.juryDay;
      c.immunity = Object.entries(s.immunity || {}).filter(([, n]) => n === c.name).map(([d]) => +d);
      c.tribeImmunity = Object.entries(s.tribeImmunity || {}).map(([d, winners]) => [+d, winners])
        .filter(([d, winners]) => c.exit >= d && winners.includes(c.tribes[phaseAt(s, d)])).map(([d]) => d);
      if (!people.has(c.pid)) people.set(c.pid, { pid: c.pid, name: c.name, apps: [] });
      people.get(c.pid).apps.push(c);
    });
    s.lastPreJury = Math.max(...s.cast.filter((c) => !c.juror && !c.finalist).map((c) => c.exit));
    s.lastJuror = Math.max(...s.cast.filter((c) => c.juror).map((c) => c.exit));
    s.finalCount = s.cast.filter((c) => c.finalist).length;
  });
  people.forEach((p) => p.apps.sort((a, b) => a.season.num - b.season.num));
  return people;
}

const PEOPLE = prepare(SEASONS);

/*
 * Rows grouped by tribe for each phase. Hidden: one phase, alphabetical by
 * first name, so the row order leaks nothing. Revealed, o.order picks the
 * order inside each tribe:
 *   'longevity' - longest-lasting first, in every phase. Lines only cross
 *                 when tribes change, but rows re-sort when you reveal.
 *   'stable'    - alphabetical at the start, then each phase keeps the
 *                 order of the phase before. Rows do not move on reveal and
 *                 a merge has no crossings, but finalists end up apart.
 *   'lanes'     - like 'stable', but a merge does not close gaps: every
 *                 lifeline stays in its lane. Lanes move only at a swap or
 *                 shuffle.
 *   'fixed'     - like 'lanes', but lanes never move, not even at a swap or
 *                 shuffle. Tribe changes show by color only; the groups of a
 *                 swap phase are "scattered" across the lanes.
 */
function computeLayout(s, revealed, o) {
  const phases = revealed ? s.phases : [{ ...s.phases[0], end: s.days }];
  const order = Object.keys(s.tribes);
  const pos = new Map();
  let bottom = o.top;
  const out = phases.map((ph, pi) => {
    const members = s.cast.filter((c) => c.tribes.length > pi);
    const groups = [];
    const isMerge = pi > 0 && new Set(members.map((c) => c.tribes[pi])).size === 1;
    if (revealed && pi > 0 && (o.order === 'fixed' || (o.order === 'lanes' && isMerge))) {
      members.forEach((c) => { pos.get(c)[pi] = pos.get(c)[pi - 1]; });
      const y1 = Math.max(...members.map((c) => pos.get(c)[pi])) + o.rowH / 2;
      order.forEach((t) => {
        const m = members.filter((c) => c.tribes[pi] === t);
        if (m.length) groups.push({ tribe: t, color: s.tribes[t], members: m, yHead: o.top, y1, scattered: !isMerge });
      });
      bottom = Math.max(bottom, y1);
      return { ...ph, groups };
    }
    let y = o.top;
    order.forEach((t) => {
      const m = members.filter((c) => c.tribes[pi] === t);
      if (!m.length) return;
      const byName = (a, b) => a.name.localeCompare(b.name);
      const byPrevRow = (a, b) => pos.get(a)[pi - 1] - pos.get(b)[pi - 1];
      const byLongevity = (a, b) => rank(b) - rank(a);
      m.sort(!revealed ? byName : o.order === 'longevity' ? byLongevity : pi === 0 ? byName : byPrevRow);
      const g = { tribe: t, color: s.tribes[t], members: m, yHead: y };
      y += o.head;
      m.forEach((c) => {
        if (!pos.has(c)) pos.set(c, []);
        pos.get(c)[pi] = y + o.rowH / 2;
        y += o.rowH;
      });
      g.y1 = y;
      groups.push(g);
      y += o.gap;
    });
    bottom = Math.max(bottom, y - o.gap);
    return { ...ph, groups };
  });
  return { phases: out, pos, height: bottom };
}

/* One day scale shared by every season, set by the longest season, so day ticks line up across cards. */
const MAX_DAYS = Math.max(...SEASONS.map((s) => s.days));
const xScale = (s, W, left, padR) => (d) => left + (d / MAX_DAYS) * (W - left - padR);

/* One continuous path; a bezier crossover at each phase boundary. */
function lifePath(c, ys, phases, X, k) {
  let d = `M${X(phases[0].day - 1)},${ys[0]}`;
  for (let i = 1; i < ys.length; i++) {
    const xb = X(phases[i].day - 1);
    d += ` H${xb - k} C${xb},${ys[i - 1]} ${xb},${ys[i]} ${xb + k},${ys[i]}`;
  }
  return d + ` H${X(c.exit)}`;
}

/* ---------- SVG pieces ---------- */

/*
 * Immunity markers on a lifeline, at the same x as exits on that day:
 * a filled gold diamond for individual immunity, a hollow one for tribe immunity.
 */
function immunityIcons(c, ys, phases, X) {
  const mark = (day, kind) => {
    let i = 0;
    while (i + 1 < ys.length && phases[i + 1].day <= day) i++;
    const tip = kind === 'tribe'
      ? `◇ Tribe immunity (${esc(c.tribes[phaseAt(c.season, day)])}) · Day ${day}`
      : `◆ Individual immunity · Day ${day}`;
    return `<g class="immunity ${kind}" data-pid="${c.pid}" data-tip="${esc(c.name)}|${tip}" transform="translate(${X(day)},${ys[i]})">` +
      `<circle r="7" class="immunity-hit"/><path d="${kind === 'tribe' ? 'M0,-4.5 L3.5,0 L0,4.5 L-3.5,0Z' : 'M0,-6 L4.5,0 L0,6 L-4.5,0Z'}"/></g>`;
  };
  return c.tribeImmunity.map((d) => mark(d, 'tribe')).join('') + c.immunity.map((d) => mark(d, 'individual')).join('');
}

const wikiUrl = (name) => `https://survivor.fandom.com/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
const seasonWikiUrl = (s) => `https://survivor.fandom.com/wiki/Survivor:_${encodeURIComponent(s.name.replace(/ /g, '_'))}`;
/* Purple Rock review URLs contain the episode title, so real data needs a curated link; fall back to a site search. */
const reviewUrl = (s) => s.review || `https://www.purplerockpodcast.com/?s=${encodeURIComponent(s.name)}`;

const blurDef = (s, dev = 3.5) =>
  `<defs><filter id="blur-s${s.num}" x="-5%" y="-60%" width="110%" height="220%"><feGaussianBlur stdDeviation="${dev}"/></filter></defs>`;

function exitIcon(c, x, y, r) {
  const e = EXIT[c.how];
  return `<g class="exit exit-${c.how}" data-pid="${c.pid}" data-tip="${esc(c.name)}|${e.icon} ${e.label} · Day ${c.exit}" transform="translate(${x},${y})">` +
    `<circle r="${r}"/><text font-size="${(r * 1.1).toFixed(1)}" text-anchor="middle" dominant-baseline="central" y="0.5">${e.icon}</text></g>`;
}

function nameText(c, s, x, y) {
  return `<text class="name" tabindex="0" role="button" data-pid="${c.pid}" data-key="${s.num}:${c.pid}" x="${x}" y="${y}" ` +
    `text-anchor="end" dominant-baseline="central">${esc(c.name)}</text>`;
}

function axisSvg(s, X, o) {
  const dayW = X(1) - X(0);
  const step = dayW < 9 ? 6 : 3;
  let g = '<g class="axis">';
  for (let d = 0; d <= s.days; d += step) {
    const x = X(d);
    g += `<line class="grid" x1="${x}" x2="${x}" y1="${o.gridTop}" y2="${o.gridBottom}"/>`;
    if (d > 0) g += `<text x="${x}" y="${o.dayY}" text-anchor="middle">${d}</text>`;
  }
  g += `<text x="${X(0)}" y="${o.dayY}">Day</text>`;
  if (o.revealed) {
    o.phases.slice(1).forEach((ph) => {
      const x = X(ph.day - 1);
      g += `<line class="phase-tick" x1="${x}" x2="${x}" y1="${o.phaseY + 4}" y2="${o.gridBottom}"/>` +
        `<text class="phase-label" x="${x + 4}" y="${o.phaseY}">${esc(ph.label)} · Day ${ph.day}</text>`;
    });
  }
  return g + '</g>';
}

function markersSvg(s, X, y0, y1) {
  const xj = (X(s.lastPreJury) + X(s.juryDay)) / 2;
  const xf = (X(s.lastJuror) + X(s.days)) / 2;
  return `<g class="marker"><line x1="${xj}" x2="${xj}" y1="${y0}" y2="${y1}"/><text x="${xj}" y="${y1 + 12}" text-anchor="middle">JURY ▸</text></g>` +
    `<g class="marker final"><line x1="${xf}" x2="${xf}" y1="${y0}" y2="${y1}"/><text x="${xf}" y="${y1 + 12}" text-anchor="end">FINAL ${s.finalCount}</text></g>`;
}

function veil(cx, cy) {
  return `<g class="veil"><rect x="${cx - 150}" y="${cy - 16}" width="300" height="32" rx="16"/>` +
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central">Results hidden · click to reveal</text></g>`;
}

/* ---------- reveal state (remembered per season) ---------- */

const Reveal = {
  key: (n) => `survivor:reveal:s${n}`,
  get(n) { try { return localStorage.getItem(this.key(n)) === '1'; } catch { return false; } },
  set(n, v) { try { localStorage.setItem(this.key(n), v ? '1' : '0'); } catch { /* storage blocked */ } },
};


/* Backstory seasons: earlier seasons in which this season's returning players appeared (direct, not transitive). */
function backstorySeasons(s) {
  const nums = new Set();
  s.cast.forEach((c) => PEOPLE.get(c.pid).apps.forEach((a) => { if (a.season.num < s.num) nums.add(a.season.num); }));
  return [...nums].sort((a, b) => a - b);
}

/* ---------- player card ---------- */

/*
 * One card per person, not per appearance. The stats follow the active
 * season (the season card under the reading line). When the person did not
 * play the active season, no row is highlighted and the per-season stats
 * show a placeholder, so the card keeps the same shape.
 */
function personHtml(p, activeNum) {
  const apps = p.apps;
  const cur = apps.find((a) => a.season.num === activeNum);
  const idx = apps.indexOf(cur);
  const stat = (v) => (cur ? v() : '<span class="pc-blank">—</span>');
  const initials = p.name.split(' ').map((w) => w[0]).join('');
  const rows = apps.map((a) => {
    const e = EXIT[a.how];
    const res = Reveal.get(a.season.num)
      ? `${e.icon} ${e.label}${a.finalist ? '' : ` · Day ${a.exit}`}${a.immunity.length ? ` · <span class="imm">◆</span>×${a.immunity.length}` : ''}`
      : 'Results hidden';
    return `<li class="${a === cur ? 'on' : ''}">
      <button data-goto="${a.season.num}:${a.pid}" title="Go to ${esc(a.name)} in Season ${a.season.num}">
        <span class="pc-sn">S${a.season.num}</span>
        <span class="pc-st"><span><b>${esc(a.season.name)}</b> <span class="pc-age">· age ${a.age}</span></span><span class="pc-res">${res}</span></span>
      </button>
    </li>`;
  }).join('');
  return `<div class="pc" aria-label="Player card: ${esc(p.name)}">
    <button class="pc-close" aria-label="Close player card">×</button>
    <div class="pc-photo${cur ? '' : ' off'}" style="--tc:${cur ? cur.season.tribes[cur.tribes[0]] : '#8a8f98'}"><span>${initials}</span><small>photo · ${cur ? 'S' + cur.season.num : '—'}</small></div>
    <div class="pc-body">
      <h3>${esc(p.name)}</h3>
      <dl>
        <div><dt>Age</dt><dd>${stat(() => cur.age)}</dd></div>
        <div><dt>Occupation</dt><dd>${stat(() => esc(cur.job))}</dd></div>
        <div><dt>Hometown</dt><dd>${stat(() => esc(cur.home))}</dd></div>
        <div><dt>Appearance</dt><dd>${stat(() => `${ordinal(idx + 1)} of ${apps.length}`)}</dd></div>
      </dl>
      <h4>Seasons played</h4>
      <ol class="pc-seasons">${rows}</ol>
      <div class="pc-links"><a href="${wikiUrl(p.name)}" target="_blank" rel="noopener">Survivor Wiki ↗</a></div>
    </div></div>`;
}

/* ---------- page ---------- */

/*
 * The player card opens in the #player rail, which leaves the page free to scroll.
 * While the card is open, that player's lines stay highlighted ("pinned").
 */
function mount(renderSeason) {
  const page = document.getElementById('page');
  const cardsEl = document.getElementById('cards');
  const gutter = document.getElementById('gutter');
  const panel = document.getElementById('player');
  const index = document.getElementById('index');
  const charts = new Map();
  let pinned = null, hovered = null, activeNum = null, holdActiveUntil = 0;
  const WATCH_FIRST_SHOWN = 6;
  const expanded = new Set(); /* seasons whose Watch first list was expanded */

  SEASONS.forEach((s) => {
    s.backstory = backstorySeasons(s);
    const sec = document.createElement('section');
    sec.className = 'card';
    sec.id = 's' + s.num;
    sec.innerHTML = `<header class="card-head">
        <div class="card-title"><span class="card-num">Season ${s.num}</span><h2>${esc(s.name)}</h2></div>
        <div class="card-meta"><span>${s.cast.length} castaways</span><span>${s.days} days</span>
          <span>${new Set(s.cast.map((c) => c.tribes[0])).size} starting tribes</span><span class="prereq"></span></div>
        <div class="card-links"><a href="${reviewUrl(s)}" target="_blank" rel="noopener">Purple Rock review ↗</a>
          <a href="${seasonWikiUrl(s)}" target="_blank" rel="noopener">Wiki ↗</a></div>
        <label class="toggle"><input type="checkbox" ${Reveal.get(s.num) ? 'checked' : ''}>
          <span class="track"><span class="thumb"></span></span><span>Reveal results</span></label>
      </header><div class="chart"></div>`;
    cardsEl.append(sec);
    charts.set(s, sec.querySelector('.chart'));
    renderWatchFirst(s);
    sec.querySelector('input').addEventListener('change', (e) => {
      Reveal.set(s.num, e.target.checked);
      draw(s);
      drawGutter();
      renderCard();
      SEASONS.forEach(renderWatchFirst);
      renderIndex();
    });
  });

  /*
   * "Watch first": the backstory seasons not yet watched, in air order.
   * Long lists collapse after WATCH_FIRST_SHOWN seasons until expanded.
   */
  function renderWatchFirst(s) {
    const el = document.querySelector(`#s${s.num} .prereq`);
    if (!s.backstory.length) { el.innerHTML = ''; return; }
    const left = s.backstory.filter((n) => !Reveal.get(n));
    if (!left.length) { el.innerHTML = '<span class="prereq-done">✓ All backstories watched</span>'; return; }
    const shown = expanded.has(s.num) ? left : left.slice(0, WATCH_FIRST_SHOWN);
    const more = left.length - shown.length;
    el.innerHTML = `Watch first: ${shown.map((n) => `<a href="#s${n}">S${n}</a>`).join(' ')}` +
      (more ? ` <button class="prereq-more" data-season="${s.num}">+${more} more</button>` : '') +
      ` <em>(${left.length} of ${s.backstory.length} left)</em>`;
  }
  cardsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.prereq-more');
    if (!b) return;
    expanded.add(+b.dataset.season);
    renderWatchFirst(SEASONS.find((x) => x.num === +b.dataset.season));
  });

  function draw(s) {
    const el = charts.get(s);
    const old = el.querySelector('.scroller');
    const x = old ? old.scrollLeft : 0;
    el.innerHTML = renderSeason(s, Reveal.get(s.num), el.clientWidth);
    const now = el.querySelector('.scroller');
    if (now) now.scrollLeft = x;
  }

  /* Lines in the left gutter join each appearance of a returning player. */
  function drawGutter() {
    const pr = page.getBoundingClientRect();
    gutter.setAttribute('width', pr.width);
    gutter.setAttribute('height', pr.height);
    const laneX0 = cardsEl.offsetLeft - 12;
    const gap = cardsEl.offsetLeft > 60 ? 9 : 6;
    const r = 6;
    let out = '';
    [...PEOPLE.values()].filter((p) => p.apps.length > 1).forEach((p, i) => {
      const pts = p.apps.map((a) => {
        const el = page.querySelector(`.name[data-key="${a.season.num}:${a.pid}"]`);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.left - pr.left - 5, y: b.top - pr.top + b.height / 2 };
      }).filter(Boolean);
      const lx = laneX0 - i * gap;
      let d = '';
      for (let j = 1; j < pts.length; j++) {
        const a = pts[j - 1], b = pts[j];
        d += `M${a.x},${a.y} H${lx + r} Q${lx},${a.y} ${lx},${a.y + r} V${b.y - r} Q${lx},${b.y} ${lx + r},${b.y} H${b.x} `;
      }
      const dots = pts.map((pt) => `<circle cx="${pt.x}" cy="${pt.y}" r="3"/>`).join('');
      out += `<g class="link" data-pid="${p.pid}" style="--c:${LINK_COLORS[i % LINK_COLORS.length]}"><path d="${d}"/>${dots}</g>`;
    });
    gutter.innerHTML = out;
    applyHighlight();
  }

  function drawAll() { SEASONS.forEach(draw); drawGutter(); }

  function applyHighlight() {
    page.classList.toggle('hovering', !!(hovered || pinned));
    page.querySelectorAll('.hl, .pin').forEach((e) => e.classList.remove('hl', 'pin'));
    if (hovered) page.querySelectorAll(`[data-pid="${hovered}"]`).forEach((e) => e.classList.add('hl'));
    if (pinned) page.querySelectorAll(`[data-pid="${pinned}"]`).forEach((e) => e.classList.add('hl', 'pin'));
    [...cardsEl.children].forEach((sec) => sec.classList.toggle('is-active', !!pinned && +sec.id.slice(1) === activeNum));
  }

  function nameToCastaway(el) {
    const [num, pid] = el.dataset.key.split(':');
    return SEASONS.find((x) => x.num === +num).cast.find((c) => c.pid === pid);
  }

  /* The active season is the season card under a reading line 35% down the viewport. */
  function seasonAtReadingLine() {
    const line = innerHeight * 0.35;
    let last = null;
    for (const sec of cardsEl.children) {
      const r = sec.getBoundingClientRect();
      if (r.top > line) return last ?? +sec.id.slice(1);
      last = +sec.id.slice(1);
      if (r.bottom > line) return last;
    }
    return last;
  }

  /* Season index: one link per season, watched seasons filled, the active season ringed. */
  function renderIndex() {
    if (!index) return;
    const watched = SEASONS.filter((s) => Reveal.get(s.num)).length;
    index.innerHTML = `<div class="ix"><ol>${SEASONS.map((s) => {
      const w = Reveal.get(s.num);
      return `<li><a href="#s${s.num}" class="${w ? 'watched' : ''} ${s.num === activeNum ? 'active' : ''}" ` +
        `title="Season ${s.num} · ${esc(s.name)}${w ? ' · watched' : ''}">${s.num}</a></li>`;
    }).join('')}</ol><div class="ix-count" title="Seasons watched">${watched}/${SEASONS.length}</div></div>`;
  }

  function renderCard() {
    if (!pinned) return;
    const keep = panel.scrollTop;
    panel.innerHTML = personHtml(PEOPLE.get(pinned), activeNum);
    panel.scrollTop = keep;
    applyHighlight();
  }

  /* Keep the content under the viewport still when the rail changes the layout. */
  function keepStill(change) {
    const anchor = [...cardsEl.children].find((el) => el.getBoundingClientRect().bottom > 0);
    const before = anchor ? anchor.getBoundingClientRect().top : 0;
    change();
    if (anchor) {
      const diff = anchor.getBoundingClientRect().top - before;
      if (diff) window.scrollBy(0, diff);
    }
  }

  function openPlayer(c, nameEl) {
    pinned = c.pid;
    activeNum = c.season.num;
    holdActiveUntil = performance.now() + 400;
    renderIndex();
    keepStill(() => {
      renderCard();
      panel.hidden = false;
      page.classList.add('with-rail');
    });
    /* On phones the card is a sheet over the bottom of the screen; keep the clicked name visible above it. */
    if (nameEl && getComputedStyle(panel).position === 'fixed') {
      const sheet = panel.getBoundingClientRect(), r = nameEl.getBoundingClientRect();
      if (r.bottom > sheet.top - 8) window.scrollBy(0, r.bottom - sheet.top + 40);
    }
  }

  function closePlayer() {
    pinned = null;
    if (!panel.hidden) keepStill(() => { panel.hidden = true; page.classList.remove('with-rail'); });
    applyHighlight();
  }

  function revealFrom(el) {
    const input = el.closest('.card').querySelector('.toggle input');
    input.checked = true;
    input.dispatchEvent(new Event('change'));
  }

  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (performance.now() < holdActiveUntil) return;
      const n = seasonAtReadingLine();
      if (n === activeNum) return;
      activeNum = n;
      renderIndex();
      if (pinned) renderCard();
    });
  }, { passive: true });

  page.addEventListener('mouseover', (e) => { const n = e.target.closest('.name'); if (n) { hovered = n.dataset.pid; applyHighlight(); } });
  page.addEventListener('mouseout', (e) => { if (e.target.closest('.name')) { hovered = null; applyHighlight(); } });
  page.addEventListener('click', (e) => {
    if (e.target.closest('.reveal-hit, .veil')) { revealFrom(e.target); return; }
    const n = e.target.closest('.name');
    if (!n) return;
    const c = nameToCastaway(n);
    if (pinned === c.pid && activeNum === c.season.num && !panel.hidden) closePlayer();
    else openPlayer(c, n);
  });
  page.addEventListener('keydown', (e) => {
    const n = e.target.closest && e.target.closest('.name');
    if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPlayer(nameToCastaway(n), n); }
  });

  /* Card buttons: close, or jump to that player's row in one of their seasons. */
  panel.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (go) {
      const num = +go.dataset.goto.split(':')[0];
      activeNum = num;
      holdActiveUntil = performance.now() + 900; /* let the smooth scroll land */
      renderCard();
      renderIndex();
      const row = page.querySelector(`.name[data-key="${go.dataset.goto}"]`);
      (row || document.getElementById('s' + num)).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (e.target.closest('.pc-close')) closePlayer();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePlayer(); });

  /*
   * Popover for exit and immunity icons: fixed beside the hovered icon, with
   * an arrow pointing at it. It opens to the right, or to the left when the
   * right side has no room.
   */
  const tip = document.createElement('div');
  tip.id = 'tip';
  tip.hidden = true;
  document.body.append(tip);
  let tipFor = null;
  function showTip(el) {
    tipFor = el;
    const [who, what] = el.dataset.tip.split('|');
    tip.innerHTML = `<b>${who}</b><span>${what}</span>`;
    tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, gap = 10;
    let left = r.right + gap, side = 'right';
    if (left + w > innerWidth - 8) { left = r.left - gap - w; side = 'left'; }
    tip.dataset.side = side;
    tip.style.left = left + 'px';
    tip.style.top = r.top + r.height / 2 - h / 2 + 'px';
  }
  function hideTip() { tipFor = null; tip.hidden = true; }
  page.addEventListener('mouseover', (e) => { const x = e.target.closest('[data-tip]'); if (x && x !== tipFor) showTip(x); });
  page.addEventListener('mouseout', (e) => {
    if (tipFor && !(e.relatedTarget && tipFor.contains(e.relatedTarget))) hideTip();
  });
  addEventListener('scroll', hideTip, { passive: true });

  if (index) document.body.classList.add('has-index');
  let lastW = cardsEl.clientWidth;
  drawAll();
  activeNum = seasonAtReadingLine();
  renderIndex();
  new ResizeObserver(() => {
    const w = cardsEl.clientWidth;
    if (w !== lastW) { lastW = w; drawAll(); }
  }).observe(cardsEl);
  if (document.fonts) document.fonts.ready.then(drawGutter);
  return { redraw: drawAll };
}
