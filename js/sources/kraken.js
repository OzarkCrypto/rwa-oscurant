import {pfetch} from '../proxy.js';
export const meta = {id: 'kraken', label: 'Kraken', category: 'cex_spot'};

export async function fetchAll(symbols) {
  if (!symbols.length) return new Map();
  const params = new URLSearchParams({
    pair: symbols.join(','),
    asset_class: 'tokenized_asset'
  });
  const r = await pfetch(`https://api.kraken.com/0/public/Ticker?${params}`, {cache: 'no-store'});
  if (!r.ok) throw new Error(`kraken ${r.status}`);
  const j = await r.json();
  if (j.error?.length) throw new Error(`kraken: ${j.error.join(',')}`);
  const result = j.result ?? {};
  const out = new Map();
  const ts = Date.now();
  for (const [k, t] of Object.entries(result)) {
    const bid = parseFloat(t.b?.[0]), ask = parseFloat(t.a?.[0]);
    if (!bid || !ask) continue;
    const last = parseFloat(t.c?.[0]) || (bid + ask) / 2;
    const vol = parseFloat(t.v?.[1]) || 0;
    out.set(k, {bid, ask, last, vol24h: vol * last, ts});
  }
  return out;
}
