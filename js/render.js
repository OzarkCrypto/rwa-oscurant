const fmtPx = (x) => x == null ? '—' : (x >= 100 ? x.toFixed(2) : x >= 1 ? x.toFixed(3) : x.toFixed(5));
const fmtBps = (x) => x == null ? '—' : (x > 0 ? '+' : '') + x.toFixed(1);
const fmtVol = (x) => {
  if (!x) return '—';
  if (x >= 1e9) return (x / 1e9).toFixed(1) + 'B';
  if (x >= 1e6) return (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return (x / 1e3).toFixed(1) + 'K';
  return x.toFixed(0);
};

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

function basisClass(bps) {
  if (bps == null) return '';
  const ab = Math.abs(bps);
  if (ab < 10) return 'b0';
  if (ab < 30) return 'b1';
  if (ab < 100) return 'b2';
  return 'b3';
}

export function renderArbTable(byTicker, opts) {
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
  let html = `<table class="arb"><thead><tr>
    <th>Ticker</th><th>Ref</th><th class="r">Buy</th><th class="r">Sell</th>
    <th class="r">Gross</th><th class="r">Fee</th><th class="r">Net bps</th>
  </tr></thead><tbody>`;
  for (const e of rows) {
    const b = e.best;
    html += `<tr>
      <td><b>${tk(e)}</b><span class="muted"> ${e.name}</span></td>
      <td class="r">${fmtPx(e.ref_px)}</td>
      <td class="r"><span class="v ${VENUE_CAT[b.buy_venue]}">${VENUE_LABELS[b.buy_venue]}</span> ${fmtPx(b.buy_px)}</td>
      <td class="r"><span class="v ${VENUE_CAT[b.sell_venue]}">${VENUE_LABELS[b.sell_venue]}</span> ${fmtPx(b.sell_px)}</td>
      <td class="r">${fmtBps(b.gross_bps)}</td>
      <td class="r muted">−${b.fee_bps.toFixed(1)}</td>
      <td class="r ${b.net_bps > 0 ? 'pos' : 'neg'}"><b>${fmtBps(b.net_bps)}</b></td>
    </tr>`;
  }
  html += '</tbody></table>';
  if (!rows.length) html += '<div class="empty">no rows match filter</div>';
  return html;
}

function tk(e) { return e.ticker; }

export function renderGrid(byTicker) {
  const tickers = Object.keys(byTicker).sort();
  const venues = [...new Set(tickers.flatMap(t => byTicker[t].venues.map(v => v.venue)))]
    .sort((a, b) => (Object.keys(VENUE_LABELS).indexOf(a)) - (Object.keys(VENUE_LABELS).indexOf(b)));
  let html = '<table class="grid"><thead><tr><th>Ticker</th><th>Ref</th>';
  for (const v of venues) {
    html += `<th class="r v-h"><span class="v ${VENUE_CAT[v]}">${VENUE_LABELS[v]}</span></th>`;
  }
  html += '</tr></thead><tbody>';
  for (const t of tickers) {
    const e = byTicker[t];
    html += `<tr><td><b>${t}</b><span class="muted"> ${e.name}</span></td><td class="r">${fmtPx(e.ref_px)}</td>`;
    for (const v of venues) {
      const vs = e.venues.filter(x => x.venue === v);
      if (!vs.length) { html += '<td class="r muted">—</td>'; continue; }
      const cells = vs.map(x => {
        const cls = basisClass(x.basis_bps);
        const idxBadge = x.is_index ? '<span class="idx">idx</span>' : '';
        const fundBadge = x.funding != null ? `<span class="fund">${(x.funding * 100 * 24 * 365).toFixed(0)}%</span>` : '';
        return `<div class="cell ${cls}" title="${x.sym}\n${fmtBps(x.basis_bps)} bps vs ref">${fmtPx(x.last)} <span class="bps">${fmtBps(x.basis_bps)}</span>${idxBadge}${fundBadge}</div>`;
      }).join('');
      html += `<td class="r">${cells}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

export function renderStatus(rows, lastTs, sourceErrs) {
  const byVenue = {};
  for (const r of rows) byVenue[r.venue] = (byVenue[r.venue] || 0) + 1;
  const chips = Object.keys(VENUE_LABELS).map(v => {
    const n = byVenue[v] || 0;
    const ok = n > 0;
    const err = sourceErrs[v];
    return `<span class="chip ${ok ? 'ok' : 'off'}" title="${err ? err : v + ' fetched ' + n + ' rows'}">${VENUE_LABELS[v]} ${n}</span>`;
  }).join(' ');
  return `<div class="status"><div class="chips">${chips}</div><div class="muted">${rows.length} rows</div></div>`;
}

export function renderUpdated(lastTs) {
  if (!lastTs) return '—';
  const ago = Math.round((Date.now() - lastTs) / 1000);
  return `updated ${ago}s ago`;
}
