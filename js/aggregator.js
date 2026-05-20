import * as binance from './sources/binance.js';
import * as bybit from './sources/bybit.js';
import * as okx from './sources/okx.js';
import * as gate from './sources/gate.js';
import * as mexc from './sources/mexc.js';
import * as kucoin from './sources/kucoin.js';
import * as kraken from './sources/kraken.js';
import * as krakenFutures from './sources/kraken_futures.js';
import * as hyperliquid from './sources/hyperliquid.js';
import * as stooq from './sources/stooq.js';
import * as polygon from './sources/polygon.js';
import * as backedSolana from './sources/backed_solana.js';

export const SOURCES = {
  binance, bybit, okx, gate, mexc, kucoin,
  kraken, kraken_futures: krakenFutures, hyperliquid,
  stooq, polygon, backed_solana: backedSolana
};

function collectSymbols(universe, srcId) {
  const result = [];
  for (const [tk, info] of Object.entries(universe.tickers)) {
    const buckets = ['cex_spot', 'cex_perp', 'dex_perp', 'dex_spot', 'real'];
    for (const bk of buckets) {
      const v = info[bk]?.[srcId];
      if (!v) continue;
      if (srcId === 'hyperliquid' && typeof v === 'object') {
        for (const dep of Object.values(v)) {
          const sym = typeof dep === 'string' ? dep : dep.sym;
          if (sym) result.push({ticker: tk, sym, dep: typeof dep === 'object' ? dep : null});
        }
      } else if (typeof v === 'string') {
        result.push({ticker: tk, sym: v});
      }
    }
  }
  return result;
}

export async function fetchSource(universe, srcId) {
  const src = SOURCES[srcId];
  if (!src) return [];
  const entries = collectSymbols(universe, srcId);
  const syms = [...new Set(entries.map(e => e.sym))];
  if (!syms.length) return [];
  let prices;
  try {
    prices = await src.fetchAll(syms);
  } catch (e) {
    console.warn(`${srcId} fetch failed`, e);
    return [];
  }
  const rows = [];
  for (const e of entries) {
    const p = prices.get(e.sym);
    if (!p) continue;
    let last = p.last;
    if (e.dep?.ratio) last = last * e.dep.ratio;
    rows.push({
      ticker: e.ticker,
      venue: srcId,
      sym: e.sym,
      raw_last: p.last,
      last,
      bid: p.bid * (e.dep?.ratio || 1),
      ask: p.ask * (e.dep?.ratio || 1),
      vol24h: p.vol24h || 0,
      funding: p.funding,
      oracle: p.oracle ? p.oracle * (e.dep?.ratio || 1) : null,
      ts: p.ts,
      is_index: !!e.dep?.is_index
    });
  }
  return rows;
}

export async function fetchAll(universe, sourceIds) {
  const tasks = sourceIds.map(id => fetchSource(universe, id));
  const settled = await Promise.allSettled(tasks);
  const rows = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') rows.push(...s.value);
  }
  return rows;
}

export function aggregate(universe, rows) {
  const out = {};
  for (const tk of Object.keys(universe.tickers)) {
    out[tk] = {ticker: tk, name: universe.tickers[tk].name, venues: []};
  }
  for (const r of rows) {
    if (!out[r.ticker]) continue;
    out[r.ticker].venues.push(r);
  }
  for (const tk of Object.keys(out)) {
    const venues = out[tk].venues;
    if (!venues.length) continue;
    const realPx = venues.filter(v => ['stooq', 'polygon', 'yahoo'].includes(v.venue)).map(v => v.last);
    const mid = realPx.length ? median(realPx) : median(venues.map(v => v.last));
    out[tk].ref_px = mid;
    out[tk].ref_source = realPx.length ? 'real' : 'venue-median';
    for (const v of venues) {
      v.basis_bps = mid ? ((v.last - mid) / mid) * 10000 : null;
    }
    const matrix = computeArbMatrix(universe, venues, mid);
    out[tk].arbs = matrix;
    out[tk].best = matrix[0] || null;
  }
  return out;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

function computeArbMatrix(universe, venues, ref) {
  const fees = universe.fees_bps;
  const arbs = [];
  for (let i = 0; i < venues.length; i++) {
    for (let j = 0; j < venues.length; j++) {
      if (i === j) continue;
      const buy = venues[i], sell = venues[j];
      if (['stooq', 'polygon', 'yahoo'].includes(buy.venue)) continue;
      if (['stooq', 'polygon', 'yahoo'].includes(sell.venue)) continue;
      if (buy.is_index || sell.is_index) continue;
      const buyPx = buy.ask, sellPx = sell.bid;
      if (!buyPx || !sellPx) continue;
      const grossBps = ((sellPx - buyPx) / ((sellPx + buyPx) / 2)) * 10000;
      const buyFee = (fees[buy.venue]?.taker ?? 10) + (fees[buy.venue]?.slip_bps ?? 5);
      const sellFee = (fees[sell.venue]?.taker ?? 10) + (fees[sell.venue]?.slip_bps ?? 5);
      const netBps = grossBps - buyFee - sellFee;
      arbs.push({
        buy_venue: buy.venue, buy_sym: buy.sym, buy_px: buyPx,
        sell_venue: sell.venue, sell_sym: sell.sym, sell_px: sellPx,
        gross_bps: grossBps, fee_bps: buyFee + sellFee, net_bps: netBps
      });
    }
  }
  arbs.sort((a, b) => b.net_bps - a.net_bps);
  return arbs;
}
