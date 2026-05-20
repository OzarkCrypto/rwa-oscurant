import {pfetch} from '../proxy.js';
export const meta = {id: 'stooq', label: 'Stooq EOD', category: 'real'};

export async function fetchAll(symbols) {
  if (!symbols.length) return new Map();
  // Stooq는 `+`를 심볼 구분자로 본다. encodeURIComponent하면 %2B로 들어가서
  // pfetch 두 번째 인코딩 후 stooq가 "aapl.us+nvda.us+..."를 하나의 심볼로 해석
  // → N/D만 반환. 그래서 raw + 그대로 유지하고 점만 따로 인코딩 필요 없음.
  const q = symbols.join('+');
  const url = `https://stooq.com/q/l/?s=${q}&f=sd2t2ohlcv&h&e=csv`;
  const r = await pfetch(url, {cache: 'no-store'});
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
