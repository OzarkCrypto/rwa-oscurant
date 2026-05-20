export const meta = {id: 'kucoin', label: 'KuCoin', category: 'cex_spot'};

export async function fetchAll(symbols) {
  const wanted = new Set(symbols);
  const r = await fetch('https://api.kucoin.com/api/v1/market/allTickers', {cache: 'no-store'});
  if (!r.ok) throw new Error(`kucoin ${r.status}`);
  const j = await r.json();
  const list = j.data?.ticker ?? [];
  const out = new Map();
  const ts = Date.now();
  for (const t of list) {
    if (!wanted.has(t.symbol)) continue;
    const bid = parseFloat(t.buy), ask = parseFloat(t.sell);
    if (!bid || !ask) continue;
    out.set(t.symbol, {bid, ask, last: parseFloat(t.last) || (bid + ask) / 2, vol24h: parseFloat(t.volValue) || 0, ts});
  }
  return out;
}
