export const meta = {id: 'okx', label: 'OKX', category: 'cex_spot'};

export async function fetchAll(symbols) {
  const wanted = new Set(symbols);
  const r = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT', {cache: 'no-store'});
  if (!r.ok) throw new Error(`okx ${r.status}`);
  const j = await r.json();
  const list = j.data ?? [];
  const out = new Map();
  const ts = Date.now();
  for (const t of list) {
    if (!wanted.has(t.instId)) continue;
    const bid = parseFloat(t.bidPx), ask = parseFloat(t.askPx);
    if (!bid || !ask) continue;
    out.set(t.instId, {bid, ask, last: parseFloat(t.last) || (bid + ask) / 2, vol24h: parseFloat(t.volCcy24h) || 0, ts});
  }
  return out;
}
