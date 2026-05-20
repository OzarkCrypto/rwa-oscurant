const fmtPx = (x) => x == null ? '—' : (x >= 100 ? x.toFixed(2) : x >= 1 ? x.toFixed(3) : x.toFixed(5));
const fmtBps = (x) => x == null ? '—' : (x > 0 ? '+' : '') + x.toFixed(1);
const fmtFund = (f) => f == null ? '' : (f * 100 * 24 * 365).toFixed(0) + '%';

const VENUE_LABELS = {
  binance: 'Binance', bybit: 'Bybit', okx: 'OKX', gate: 'Gate', mexc: 'MEXC',
  kucoin: 'KuCoin', kraken: 'Kraken', kraken_futures: 'KF perp',
  hyperliquid: 'HL', stooq: 'Stooq', polygon: 'Polygon', backed_solana: 'Backed'
};

const VENUE_CAT = {
  binance: 'cex-spot', bybit: 'cex-spot', okx: 'cex-spot', gate: 'cex-spot',
  mexc: 'cex-spot', kucoin: 'cex-spot', kraken: 'cex-spot',
  kraken_futures: 'cex-perp', hyperliquid: 'dex-perp',
  backed_solana: 'dex-spot', stooq: 'real', polygon: 'real'
};

const CAT_LABEL = {
  'cex-spot': 'CEX SPOT', 'cex-perp': 'CEX PERP',
  'dex-perp': 'DEX PERP', 'dex-spot': 'DEX SPOT', 'real': 'REAL'
};
const CAT_ORDER = ['cex-spot', 'cex-perp', 'dex-perp', 'dex-spot', 'real'];

function basisClass(bps) {
  if (bps == null) return '';
  const ab = Math.abs(bps);
  if (ab < 10) return 'b0';
  if (ab < 30) return 'b1';
  if (ab < 100) return 'b2';
  return 'b3';
}

function venueBadge(v) {
  return `<span class="v ${VENUE_CAT[v]}">${VENUE_LABELS[v]}</span>`;
}

function arbRowsFiltered(byTicker, opts) {
  const minNet = opts.minNetBps ?? -Infinity;
  const venueFilter = opts.venueFilter ?? null;
  const rows = [];
  for (const tk of Object.keys(byTicker).sort()) {
    const e = byTicker[tk];
    if (!e.best) continue;
    if (e.best.net_bps < minNet) continue;
    if (venueFilter && !venueFilter.has(e.best.buy_venue) && !venueFilter.has(e.best.sell_venue)) continue;
    rows.push(e);
  }
  rows.sort((a, b) => (b.best.net_bps) - (a.best.net_bps));
  return rows;
}

export function renderArb(byTicker, opts) {
  const rows = arbRowsFiltered(byTicker, opts);
  if (!rows.length) return '<div class="empty">no arb opportunities match the current filter</div>';

  // desktop table
  let tbl = `<div class="tbl-wrap active"><table class="arb"><thead><tr>
    <th>Ticker</th><th class="r">Ref</th><th class="r">Buy</th><th class="r">Sell</th>
    <th class="r">Gross</th><th class="r">Fee</th><th class="r">Net bps</th>
  </tr></thead><tbody>`;
  for (const e of rows) {
    const b = e.best;
    tbl += `<tr>
      <td><span class="tkr">${e.ticker}</span><span class="tkr-name">${e.name}</span></td>
      <td class="r">${fmtPx(e.ref_px)}</td>
      <td class="r"><span class="venue-cell">${venueBadge(b.buy_venue)}<span class="px">${fmtPx(b.buy_px)}</span></span></td>
      <td class="r"><span class="venue-cell">${venueBadge(b.sell_venue)}<span class="px">${fmtPx(b.sell_px)}</span></span></td>
      <td class="r">${fmtBps(b.gross_bps)}</td>
      <td class="r muted">−${b.fee_bps.toFixed(1)}</td>
      <td class="r ${b.net_bps > 0 ? 'pos' : 'neg'}">${fmtBps(b.net_bps)}</td>
    </tr>`;
  }
  tbl += '</tbody></table></div>';

  // mobile cards
  let cards = '<div class="arb-cards active">';
  for (const e of rows) {
    const b = e.best;
    const netCls = b.net_bps > 0 ? 'pos' : 'neg';
    cards += `<div class="arb-card">
      <div class="hd">
        <div class="tkr">${e.ticker}</div>
        <div class="tkr-name">${e.name}</div>
        <div class="tkr-ref">ref ${fmtPx(e.ref_px)}</div>
      </div>
      <div class="net-big ${netCls}">${fmtBps(b.net_bps)}<span class="net-lbl">net bps</span></div>
      <div class="legs">
        <span class="leg-lbl buy">BUY</span>${venueBadge(b.buy_venue)}<span class="leg-px">${fmtPx(b.buy_px)}</span>
        <span class="leg-lbl sell">SELL</span>${venueBadge(b.sell_venue)}<span class="leg-px">${fmtPx(b.sell_px)}</span>
      </div>
      <div class="meta">
        <span>gross ${fmtBps(b.gross_bps)}</span>
        <span>fee −${b.fee_bps.toFixed(1)}</span>
      </div>
    </div>`;
  }
  cards += '</div>';

  return tbl + cards;
}

export function renderGrid(byTicker) {
  const tickers = Object.keys(byTicker).sort();
  if (!tickers.length) return '<div class="empty">no data</div>';
  const venues = [...new Set(tickers.flatMap(t => byTicker[t].venues.map(v => v.venue)))]
    .sort((a, b) => (Object.keys(VENUE_LABELS).indexOf(a)) - (Object.keys(VENUE_LABELS).indexOf(b)));

  // desktop table
  let tbl = '<div class="tbl-wrap active"><table class="grid"><thead><tr><th>Ticker</th><th class="r">Ref</th>';
  for (const v of venues) {
    tbl += `<th class="r"><span class="v ${VENUE_CAT[v]}">${VENUE_LABELS[v]}</span></th>`;
  }
  tbl += '</tr></thead><tbody>';
  for (const t of tickers) {
    const e = byTicker[t];
    tbl += `<tr><td><span class="tkr">${t}</span><span class="tkr-name">${e.name}</span></td><td class="r">${fmtPx(e.ref_px)}</td>`;
    for (const v of venues) {
      const vs = e.venues.filter(x => x.venue === v);
      if (!vs.length) { tbl += '<td class="r muted">—</td>'; continue; }
      const cells = vs.map(x => {
        const cls = basisClass(x.basis_bps);
        const idxBadge = x.is_index ? '<span class="idx">idx</span>' : '';
        const fundBadge = x.funding != null ? `<span class="fund">${fmtFund(x.funding)}</span>` : '';
        return `<div class="cell ${cls}" title="${x.sym}\n${fmtBps(x.basis_bps)} bps vs ref">${fmtPx(x.last)}<span class="bps">${fmtBps(x.basis_bps)}</span>${idxBadge}${fundBadge}</div>`;
      }).join('');
      tbl += `<td class="r"><div class="cells">${cells}</div></td>`;
    }
    tbl += '</tr>';
  }
  tbl += '</tbody></table></div>';

  // mobile cards: per ticker, venues grouped by category
  let cards = '<div class="grid-cards active">';
  for (const t of tickers) {
    const e = byTicker[t];
    const byCat = {};
    for (const x of e.venues) {
      const cat = VENUE_CAT[x.venue] || 'real';
      (byCat[cat] = byCat[cat] || []).push(x);
    }
    cards += `<div class="grid-card">
      <div class="hd">
        <div><span class="tkr">${t}</span><span class="tkr-name">${e.name}</span></div>
        <div class="ref">ref <span class="ref-px">${fmtPx(e.ref_px)}</span></div>
      </div>`;
    for (const cat of CAT_ORDER) {
      const xs = byCat[cat];
      if (!xs || !xs.length) continue;
      xs.sort((a, b) => (Math.abs(b.basis_bps || 0)) - (Math.abs(a.basis_bps || 0)));
      cards += `<div class="grp"><div class="grp-h">${CAT_LABEL[cat]}</div><div class="rows">`;
      for (const x of xs) {
        const cls = basisClass(x.basis_bps);
        const idxBadge = x.is_index ? '<span class="idx">idx</span>' : '';
        const fundBadge = x.funding != null ? `<span class="fund">${fmtFund(x.funding)}</span>` : '';
        const symShort = x.sym && x.sym.length > 14 ? x.sym.slice(0, 13) + '…' : (x.sym || '');
        cards += `<div class="grow ${cls}">
          <span>${venueBadge(x.venue)}</span>
          <span class="sym" title="${x.sym || ''}">${symShort}</span>
          <span class="px">${fmtPx(x.last)}</span>
          <span class="bps">${fmtBps(x.basis_bps)}${idxBadge || fundBadge ? ' <span class="badges">'+idxBadge+fundBadge+'</span>' : ''}</span>
        </div>`;
      }
      cards += '</div></div>';
    }
    cards += '</div>';
  }
  cards += '</div>';

  return tbl + cards;
}

export function renderStatus(rows, lastTs, sourceErrs) {
  const byVenue = {};
  for (const r of rows) byVenue[r.venue] = (byVenue[r.venue] || 0) + 1;
  const chips = Object.keys(VENUE_LABELS).map(v => {
    const n = byVenue[v] || 0;
    const ok = n > 0;
    const err = sourceErrs[v];
    return `<span class="chip ${ok ? 'ok' : 'off'}" title="${err ? err : v + ' fetched ' + n + ' rows'}">${VENUE_LABELS[v]} ${n}</span>`;
  }).join('');
  return `<div class="status"><div class="chips">${chips}</div><div class="muted">${rows.length} rows</div></div>`;
}

export function renderUpdated(lastTs) {
  if (!lastTs) return '—';
  const ago = Math.round((Date.now() - lastTs) / 1000);
  return `updated ${ago}s ago`;
}

export { VENUE_LABELS, VENUE_CAT };
