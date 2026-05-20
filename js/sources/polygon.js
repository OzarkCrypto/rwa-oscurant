import {pfetch} from '../proxy.js';
export const meta = {id: 'polygon', label: 'Polygon (real)', category: 'real'};

export async function fetchAll(symbols, opts = {}) {
  const key = opts.apiKey || localStorage.getItem('polygon_key');
  if (!key || !symbols.length) return new Map();
  const q = symbols.join(',');
  const url = `https://api.polygon.io/v3/snapshot?ticker.any_of=${q}&apiKey=${key}`;
  const r = await pfetch(url, {cache: 'no-store'});
  if (!r.ok) throw new Error(`polygon ${r.status}`);
  const j = await r.json();
  const list = j.results ?? [];
  const out = new Map();
  const ts = Date.now();
  for (const t of list) {
    const last = t.value ?? t.last_quote?.last_price ?? t.session?.close;
    if (!last) continue;
    out.set(t.ticker, {bid: last, ask: last, last, vol24h: t.session?.volume * last || 0, ts});
  }
  return out;
}
