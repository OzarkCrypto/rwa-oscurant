import {SOURCES, fetchSource, aggregate} from './aggregator.js';
import {renderArbTable, renderGrid, renderStatus, renderUpdated} from './render.js';

const SRC_IDS = ['binance', 'bybit', 'okx', 'gate', 'mexc', 'kucoin',
                 'kraken', 'kraken_futures', 'hyperliquid',
                 'stooq', 'polygon', 'backed_solana'];

const state = {
  universe: null,
  rows: [],
  byTicker: {},
  errs: {},
  view: localStorage.getItem('rwa_view') || 'arb',
  minNet: parseFloat(localStorage.getItem('rwa_minnet') || '0'),
  interval: parseInt(localStorage.getItem('rwa_interval') || '5', 10),
  paused: false,
  enabled: JSON.parse(localStorage.getItem('rwa_enabled') || 'null') || Object.fromEntries(SRC_IDS.map(s => [s, true]))
};

async function loadUniverse() {
  const r = await fetch('./data/universe.json', {cache: 'no-store'});
  state.universe = await r.json();
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
    main.innerHTML = renderArbTable(state.byTicker, {minNetBps: state.minNet});
  } else {
    main.innerHTML = renderGrid(state.byTicker);
  }
  document.getElementById('status').innerHTML = renderStatus(state.rows, state.lastTs, state.errs);
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
    document.getElementById('pause').textContent = state.paused ? '▶ resume' : '⏸ pause';
  };
  const mn = document.getElementById('minnet');
  mn.value = state.minNet;
  mn.oninput = () => {
    state.minNet = parseFloat(mn.value) || 0;
    localStorage.setItem('rwa_minnet', state.minNet);
    render();
  };
  const iv = document.getElementById('interval');
  iv.value = state.interval;
  iv.onchange = () => {
    state.interval = parseInt(iv.value, 10) || 5;
    localStorage.setItem('rwa_interval', state.interval);
    restartTimer();
  };

  const venueBox = document.getElementById('venues');
  venueBox.innerHTML = SRC_IDS.map(s => `
    <label class="vchk"><input type="checkbox" data-src="${s}" ${state.enabled[s] ? 'checked' : ''}/> ${s}</label>
  `).join('');
  venueBox.querySelectorAll('input').forEach(el => {
    el.onchange = () => {
      state.enabled[el.dataset.src] = el.checked;
      localStorage.setItem('rwa_enabled', JSON.stringify(state.enabled));
      refresh();
    };
  });

  const pgKey = document.getElementById('polygon-key');
  pgKey.value = localStorage.getItem('polygon_key') || '';
  pgKey.onblur = () => {
    if (pgKey.value) localStorage.setItem('polygon_key', pgKey.value);
    else localStorage.removeItem('polygon_key');
    refresh();
  };
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

(async () => {
  await loadUniverse();
  setupControls();
  switchView(state.view);
  await refresh();
  restartTimer();
})();
