/*
 * Season renderer for the Transit Map layout. order: 'longevity', 'stable', 'lanes' or 'fixed' (see computeLayout).
 * The timeline never gets narrower than MIN_DAY px per day; on a narrow screen it scrolls
 * sideways under a pinned names column.
 */
const MIN_DAY = 14;
const transitRenderer = ({ order }) => function renderSeason(s, revealed, visibleW) {
  const left = visibleW < 640 ? 110 : 170, padR = 24, rowH = 19, top = 46;
  const W = Math.max(visibleW, left + MAX_DAYS * MIN_DAY + padR);
  const L = computeLayout(s, revealed, { rowH, head: 19, gap: 8, top, order });
  const X = xScale(s, W, left, padR);
  const H = L.height + 26;
  /* Crossovers start after the last day of a phase, so markers on that day sit on a level line. */
  const k = Math.min(16, (X(1) - X(0)) * 0.8);
  let bands = '', pills = '', lives = '', dots = '', icons = '', names = '';
  L.phases.forEach((ph) => {
    let px = X(ph.day - 1) + 8; /* scattered groups share one row of labels */
    ph.groups.forEach((g) => {
      const x0 = X(ph.day - 1), x1 = X(ph.end);
      const label = g.tribe.toUpperCase();
      const pw = label.length * 6.6 + 12;
      if (g.scattered) {
        /* Tribe members are spread over many lanes: tint each member's lane instead of one block. */
        bands += g.members.map((c) => {
          const y = L.pos.get(c)[L.phases.indexOf(ph)];
          return `<rect class="band band-row" x="${x0}" y="${y - rowH / 2}" width="${x1 - x0}" height="${rowH}" fill="${g.color}"/>`;
        }).join('');
      } else {
        bands += `<rect class="band" x="${x0}" y="${g.yHead}" width="${x1 - x0}" height="${g.y1 - g.yHead + 2}" fill="${g.color}"/>`;
      }
      const lx = g.scattered ? px : x0 + 8;
      pills += `<g class="pill"><rect x="${lx}" y="${g.yHead + 3}" width="${pw}" height="13" rx="6.5" fill="${g.color}"/>` +
        `<text x="${lx + pw / 2}" y="${g.yHead + 10}" text-anchor="middle" dominant-baseline="central">${label}</text></g>`;
      px += pw + 4;
    });
  });
  for (const [c, ys] of L.pos) {
    if (!revealed) {
      lives += `<path class="life ghost" d="M${X(0)},${ys[0]} H${X(s.days)}"/>`;
    } else {
      ys.forEach((y, i) => {
        const ph = L.phases[i];
        const xs = X(ph.day - 1);
        const xe = i < ys.length - 1 ? X(L.phases[i + 1].day - 1) : X(c.exit);
        const color = s.tribes[c.tribes[i]];
        const d = (i === 0 ? `M${X(0)},${y}` : `M${xs},${ys[i - 1]} C${xs + k},${ys[i - 1]} ${xs + k},${y} ${xs + 2 * k},${y}`) + ` H${xe}`;
        lives += `<path class="life" data-pid="${c.pid}" stroke="${color}" d="${d}"/>`;
        if (i > 0) dots += `<circle class="station" cx="${xs + 2 * k}" cy="${y}" r="2.8" stroke="${color}"/>`;
      });
      dots += `<circle class="origin" cx="${X(0)}" cy="${ys[0]}" r="4" fill="${s.tribes[c.tribes[0]]}"/>`;
      icons += immunityIcons(c, ys, L.phases, X) + exitIcon(c, X(c.exit), ys[ys.length - 1], 8.5);
    }
    names += nameText(c, s, left - 14, ys[0]);
  }
  const hidden = revealed ? '' :
    `<rect class="reveal-hit" x="${X(0)}" y="${top}" width="${X(s.days) - X(0)}" height="${L.height - top}"/>` +
    veil((left + visibleW - padR) / 2, (top + L.height) / 2);
  /* Tribe labels go above the lifelines so crossovers never hide them. */
  const timeline = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${blurDef(s, 3)}
    ${axisSvg(s, X, { phaseY: 14, dayY: 30, gridTop: 36, gridBottom: L.height + 2, revealed, phases: L.phases })}
    ${bands}
    ${revealed ? markersSvg(s, X, 36, L.height + 4) : ''}
    <g ${revealed ? '' : `filter="url(#blur-s${s.num})"`}>${lives}</g>${dots}${pills}${icons}${hidden}
  </svg>`;
  const edge = W > visibleW ? `<rect class="names-edge" x="${left - 6}" y="0" width="8" height="${H}"/>` : '';
  const namesCol = `<svg class="names-col" width="${left}" height="${H}" viewBox="0 0 ${left} ${H}">` +
    `<rect class="names-bg" width="${left - 4}" height="${H}"/>${edge}${names}</svg>`;
  return `<div class="scroller">${timeline}</div>${namesCol}`;
};
