export const meta = {id: 'mexc', label: 'MEXC', category: 'cex_spot'};

export async function fetchAll(symbols) {
  const wanted = new Set(symbols);
  const r = await fetch('https://api.mexc.com/api/v3/ticker/bookTicker', {cache: 'no-store'});
  if (!r.ok) throw new Error(`mexc ${r.status}`);
  const arr = await r.json();
  const out = new Map();
  const ts = Date.now();
  for (const t of arr) {
    if (!wanted.has(t.symbol)) continue;
    const bid = parseFloat(t.bidPrice), ask = parseFloat(t.askPrice);
    if (!bid || !ask) continue;
    out.set(t.symbol, {bid, ask, last: (bid + ask) / 2, ts});
  }
  return out;
}
