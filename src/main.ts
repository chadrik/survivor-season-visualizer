import './styles.css';
import type { Dataset } from './model.ts';
import { mountApp } from './ui/app.ts';

const cards = document.getElementById('cards')!;
try {
  const res = await fetch(`${import.meta.env.BASE_URL}data/seasons.json`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = (await res.json()) as Dataset;
  cards.innerHTML = '';
  mountApp(data);
} catch (err) {
  cards.innerHTML = `<p class="loading">Could not load season data (${String(err)}). Run <code>npm run data</code> to build it.</p>`;
}
