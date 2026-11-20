/*
 * Per-viewer settings kept in this browser's localStorage: which seasons are
 * Watched, and the lane Order. Storage can be blocked (private windows), so
 * every access is guarded and the page works without it.
 */
import { ORDERS, type Order } from './layout.ts';

const watchedKey = (seasonId: string) => `survivor:watched:${seasonId}`;
const ORDER_KEY = 'survivor:order';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage blocked: setting lasts for this visit only */ }
}

const memory = new Map<string, boolean>();

export const Watched = {
  get(seasonId: string): boolean {
    return memory.get(seasonId) ?? read(watchedKey(seasonId)) === '1';
  },
  set(seasonId: string, value: boolean): void {
    memory.set(seasonId, value);
    write(watchedKey(seasonId), value ? '1' : '0');
  },
};

export const OrderSetting = {
  get(): Order { const v = read(ORDER_KEY); return ORDERS.find((o) => o === v) ?? 'lanes'; },
  set(order: Order): void { write(ORDER_KEY, order); },
};
