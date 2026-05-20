export const meta = {id: 'stooq', label: 'Stooq EOD', category: 'real'};

export async function fetchAll(symbols) {
  if (!symbols.length) return new Map();
  const q = symbols.join('+');
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(q)}&f=sd2t2ohlcv&h&e=csv`;
  const r = await fetch(url, {cache: 'no-store'});
  if (!r.ok) throw new Error(`stooq ${r.status}`);
  const text = await r.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return new Map();
  const out = new Map();
  const ts = Date.now();
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const sym = c[0]?.toLowerCase();
    const close = parseFloat(c[6]);
    if (!sym || !close || sym === 'n/d') continue;
    out.set(sym, {bid: close, ask: close, last: close, vol24h: parseFloat(c[7]) * close || 0, ts, eod: true});
  }
  return out;
}
