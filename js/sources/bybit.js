export const meta = {id: 'bybit', label: 'Bybit', category: 'cex_spot'};

export async function fetchAll(symbols) {
  const wanted = new Set(symbols);
  const r = await fetch('https://api.bybit.com/v5/market/tickers?category=spot', {cache: 'no-store'});
  if (!r.ok) throw new Error(`bybit ${r.status}`);
  const j = await r.json();
  const list = j.result?.list ?? [];
  const out = new Map();
  const ts = Date.now();
  for (const t of list) {
    if (!wanted.has(t.symbol)) continue;
    const bid = parseFloat(t.bid1Price), ask = parseFloat(t.ask1Price);
    if (!bid || !ask) continue;
    out.set(t.symbol, {bid, ask, last: parseFloat(t.lastPrice) || (bid + ask) / 2, vol24h: parseFloat(t.turnover24h) || 0, ts});
  }
  return out;
}
