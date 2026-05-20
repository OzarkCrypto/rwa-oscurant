export const meta = {id: 'kraken_futures', label: 'Kraken Futures', category: 'cex_perp'};

export async function fetchAll(symbols) {
  const wanted = new Set(symbols.map(s => s.toLowerCase()));
  const r = await fetch('https://futures.kraken.com/derivatives/api/v3/tickers', {cache: 'no-store'});
  if (!r.ok) throw new Error(`kraken_futures ${r.status}`);
  const j = await r.json();
  const list = j.tickers ?? [];
  const out = new Map();
  const ts = Date.now();
  for (const t of list) {
    const sym = (t.symbol || '').toLowerCase();
    if (!wanted.has(sym)) continue;
    const bid = parseFloat(t.bid), ask = parseFloat(t.ask);
    if (!bid || !ask) continue;
    const orig = symbols.find(s => s.toLowerCase() === sym) || t.symbol;
    out.set(orig, {
      bid, ask,
      last: parseFloat(t.last) || (bid + ask) / 2,
      mark: parseFloat(t.markPrice),
      vol24h: parseFloat(t.vol24h) || 0,
      funding: parseFloat(t.fundingRate),
      ts
    });
  }
  return out;
}
