import {pfetch} from '../proxy.js';
export const meta = {id: 'binance', label: 'Binance', category: 'cex_spot'};

export async function fetchAll(symbols) {
  if (!symbols || !symbols.length) return new Map();
  const params = new URLSearchParams({symbols: JSON.stringify(symbols)});
  const url = `https://api.binance.com/api/v3/ticker/bookTicker?${params}`;
  const r = await pfetch(url, {cache: 'no-store'});
  if (!r.ok) throw new Error(`binance ${r.status}`);
  const arr = await r.json();
  const out = new Map();
  const ts = Date.now();
  for (const t of arr) {
    const bid = parseFloat(t.bidPrice), ask = parseFloat(t.askPrice);
    if (!bid || !ask) continue;
    out.set(t.symbol, {bid, ask, last: (bid + ask) / 2, ts});
  }
  return out;
}
