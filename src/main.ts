import './styles.css';
import type { Dataset } from './model.ts';
import { mountApp } from './ui/app.ts';

const cards = document.getElementById('cards')!;
try {
  /* Revalidate every visit: GitHub Pages lets browsers reuse files for 10 minutes, which can pair new code with old data. */
  const res = await fetch(`${import.meta.env.BASE_URL}data/seasons.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = (await res.json()) as Dataset;
  cards.innerHTML = '';
  mountApp(data);
} catch (err) {
  cards.innerHTML = `<p class="loading">Could not load season data (${String(err)}). Run <code>npm run data</code> to build it.</p>`;
}
