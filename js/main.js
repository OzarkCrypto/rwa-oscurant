import {SOURCES, fetchSource, aggregate} from './aggregator.js';
import {renderArb, renderGrid, renderStatus, renderUpdated, VENUE_LABELS, VENUE_CAT} from './render.js';

// 정렬용 fallback. 실제 표시는 universe.json에 실제로 등장하는 venue만 노출.
const SRC_ORDER = ['binance', 'bybit', 'okx', 'gate', 'mexc', 'kucoin',
                   'kraken', 'kraken_futures', 'hyperliquid',
                   'stooq', 'polygon', 'backed_solana'];
let SRC_IDS = [];

const state = {
  universe: null,
  rows: [],
  byTicker: {},
  errs: {},
  view: localStorage.getItem('rwa_view') || 'arb',
  interval: parseInt(localStorage.getItem('rwa_interval') || '5', 10),
  paused: false,
  enabled: {}
};

async function loadUniverse() {
  const r = await fetch('./data/universe.json', {cache: 'no-store'});
  state.universe = await r.json();
  // universe에 실제 심볼 가진 venue만 SRC_IDS에 포함 (Binance/OKX/KuCoin xStock delist 후 비어있음)
  const present = new Set();
  for (const tk of Object.values(state.universe.tickers)) {
    for (const bk of ['cex_spot', 'cex_perp', 'dex_perp', 'dex_spot', 'real']) {
      const m = tk[bk]; if (!m) continue;
      for (const v of Object.keys(m)) present.add(v);
    }
  }
  // polygon은 key 없으면 항상 0 → 노출하지 않음. localStorage에 키 있으면 다시 포함.
  const hasPolyKey = !!localStorage.getItem('polygon_key');
  SRC_IDS = SRC_ORDER.filter(s => present.has(s) && (s !== 'polygon' || hasPolyKey));
  const saved = JSON.parse(localStorage.getItem('rwa_enabled') || 'null');
  state.enabled = Object.fromEntries(SRC_IDS.map(s => [s, saved?.[s] !== false]));
}

async function refresh() {
  if (!state.universe || state.paused) return;
  const lastTs = Date.now();
  const active = SRC_IDS.filter(s => state.enabled[s]);
  const tasks = active.map(async (id) => {
    try {
      const rs = await fetchSource(state.universe, id);
      delete state.errs[id];
      return rs;
    } catch (e) {
      state.errs[id] = String(e.message || e);
      return [];
    }
  });
  const results = await Promise.all(tasks);
  state.rows = results.flat();
  state.byTicker = aggregate(state.universe, state.rows);
  render(lastTs);
}

function render(lastTs) {
  state.lastTs = lastTs ?? state.lastTs;
  const main = document.getElementById('main');
  if (state.view === 'arb') {
    main.innerHTML = renderArb(state.byTicker, {});
  } else {
    main.innerHTML = renderGrid(state.byTicker);
  }
  document.getElementById('status').innerHTML = renderStatus(state.rows, state.lastTs, state.errs, SRC_IDS);
  const u = document.getElementById('updated');
  if (u) u.textContent = renderUpdated(state.lastTs);
}

function setupControls() {
  const tt = document.getElementById('theme-toggle');
  if (tt) tt.onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.setAttribute('data-theme','dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('rwa_theme', next);
  };
  document.getElementById('view-arb').onclick = () => switchView('arb');
  document.getElementById('view-grid').onclick = () => switchView('grid');
  document.getElementById('pause').onclick = () => {
    state.paused = !state.paused;
    document.getElementById('pause').textContent = state.paused ? '▶' : '⏸';
    document.getElementById('pause').title = state.paused ? 'resume' : 'pause';
  };
  const iv = document.getElementById('interval');
  iv.value = state.interval;
  iv.onchange = () => {
    state.interval = parseInt(iv.value, 10) || 5;
    localStorage.setItem('rwa_interval', state.interval);
    restartTimer();
  };

  // venue filter chips with category dot + all/none toggle
  const venueBox = document.getElementById('venues');
  venueBox.innerHTML = SRC_IDS.map(s => `
    <label class="vchk" data-cat="${VENUE_CAT[s] || ''}">
      <span class="vcat"></span>
      <input type="checkbox" data-src="${s}" ${state.enabled[s] ? 'checked' : ''}/>
      ${VENUE_LABELS[s] || s}
    </label>
  `).join('');
  venueBox.querySelectorAll('input').forEach(el => {
    el.onchange = () => {
      state.enabled[el.dataset.src] = el.checked;
      localStorage.setItem('rwa_enabled', JSON.stringify(state.enabled));
      refresh();
    };
  });

  // venue all/none toggles
  document.getElementById('v-all').onclick = (e) => { e.preventDefault(); setAllVenues(true); };
  document.getElementById('v-none').onclick = (e) => { e.preventDefault(); setAllVenues(false); };

  const pgKey = document.getElementById('polygon-key');
  pgKey.value = localStorage.getItem('polygon_key') || '';
  pgKey.onblur = () => {
    const had = SRC_IDS.includes('polygon');
    if (pgKey.value) localStorage.setItem('polygon_key', pgKey.value);
    else localStorage.removeItem('polygon_key');
    const has = !!pgKey.value;
    if (had !== has) {
      // SRC_IDS 다시 빌드해서 polygon 표시 토글
      if (has && !had) {
        SRC_IDS = [...SRC_IDS.filter(s => s !== 'polygon'), 'polygon'];
        state.enabled.polygon = true;
      } else if (!has && had) {
        SRC_IDS = SRC_IDS.filter(s => s !== 'polygon');
        delete state.enabled.polygon;
      }
      // venue checkbox 영역 재구성
      const vbox = document.getElementById('venues');
      vbox.innerHTML = SRC_IDS.map(s => `
        <label class="vchk" data-cat="${VENUE_CAT[s] || ''}">
          <span class="vcat"></span>
          <input type="checkbox" data-src="${s}" ${state.enabled[s] ? 'checked' : ''}/>
          ${VENUE_LABELS[s] || s}
        </label>
      `).join('');
      vbox.querySelectorAll('input').forEach(el => {
        el.onchange = () => {
          state.enabled[el.dataset.src] = el.checked;
          localStorage.setItem('rwa_enabled', JSON.stringify(state.enabled));
          refresh();
        };
      });
    }
    refresh();
  };

  // close settings dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const s = document.getElementById('settings');
    if (s && s.open && !s.contains(e.target)) s.open = false;
  });
}

function setAllVenues(on) {
  for (const s of SRC_IDS) state.enabled[s] = on;
  document.querySelectorAll('.venues input').forEach(el => { el.checked = on; });
  localStorage.setItem('rwa_enabled', JSON.stringify(state.enabled));
  refresh();
}

function switchView(v) {
  state.view = v;
  localStorage.setItem('rwa_view', v);
  document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('on', t.dataset.v === v));
  render();
}

let timer = null;
function restartTimer() {
  if (timer) clearInterval(timer);
  timer = setInterval(refresh, state.interval * 1000);
}

// 1s 카운트 — 다음 refresh 까지 사용자가 freshness 체감하게.
setInterval(() => {
  const u = document.getElementById('updated');
  if (u && state.lastTs) u.textContent = renderUpdated(state.lastTs);
}, 1000);

(async () => {
  await loadUniverse();
  setupControls();
  switchView(state.view);
  await refresh();
  restartTimer();
})();
