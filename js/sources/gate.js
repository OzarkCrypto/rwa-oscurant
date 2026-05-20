import {pfetch} from '../proxy.js';
export const meta = {id: 'gate', label: 'Gate', category: 'cex_spot'};

export async function fetchAll(symbols) {
  const wanted = new Set(symbols);
  const r = await pfetch('https://api.gateio.ws/api/v4/spot/tickers', {cache: 'no-store'});
  if (!r.ok) throw new Error(`gate ${r.status}`);
  const list = await r.json();
  const out = new Map();
  const ts = Date.now();
  for (const t of list) {
    if (!wanted.has(t.currency_pair)) continue;
    const bid = parseFloat(t.highest_bid), ask = parseFloat(t.lowest_ask);
    if (!bid || !ask) continue;
    out.set(t.currency_pair, {bid, ask, last: parseFloat(t.last) || (bid + ask) / 2, vol24h: parseFloat(t.quote_volume) || 0, ts});
  }
  return out;
}
