export const meta = {id: 'hyperliquid', label: 'Hyperliquid HIP3', category: 'dex_perp'};

const DEX_CACHE = new Map();
const TTL = 3000;

async function getDexCtx(dex) {
  const c = DEX_CACHE.get(dex);
  if (c && Date.now() - c.ts < TTL) return c.byName;
  const r = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({type: 'metaAndAssetCtxs', dex}),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`hl ${dex} ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data) || data.length < 2) return new Map();
  const universe = data[0]?.universe ?? [];
  const ctxs = data[1] ?? [];
  const byName = new Map();
  for (let i = 0; i < universe.length; i++) {
    const m = universe[i], cx = ctxs[i];
    if (!m || !cx) continue;
    byName.set(m.name, {
      mid: parseFloat(cx.midPx),
      mark: parseFloat(cx.markPx),
      oracle: parseFloat(cx.oraclePx),
      funding: parseFloat(cx.funding),
      vol24h: parseFloat(cx.dayNtlVlm),
      premium: parseFloat(cx.premium)
    });
  }
  DEX_CACHE.set(dex, {byName, ts: Date.now()});
  return byName;
}

export async function fetchAll(symbols) {
  const byDex = new Map();
  for (const s of symbols) {
    const i = s.indexOf(':');
    if (i < 0) continue;
    const dex = s.slice(0, i);
    if (!byDex.has(dex)) byDex.set(dex, []);
    byDex.get(dex).push(s);
  }
  const dexes = [...byDex.keys()];
  const results = await Promise.allSettled(dexes.map(getDexCtx));
  const out = new Map();
  const ts = Date.now();
  for (let i = 0; i < dexes.length; i++) {
    if (results[i].status !== 'fulfilled') continue;
    const ctxs = results[i].value;
    for (const sym of byDex.get(dexes[i])) {
      const c = ctxs.get(sym);
      if (!c || !c.mid) continue;
      out.set(sym, {
        bid: c.mid, ask: c.mid, last: c.mid,
        mark: c.mark, oracle: c.oracle,
        funding: c.funding, vol24h: c.vol24h, premium: c.premium,
        ts
      });
    }
  }
  return out;
}
