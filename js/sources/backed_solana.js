import {pfetch} from '../proxy.js';
export const meta = {id: 'backed_solana', label: 'Backed (Solana)', category: 'dex_spot'};

const MINTS = {
  'bAAPL': 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN',
  'bTSLA': 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB',
  'bNVDA': 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LXBkmcGd2dwbusy',
  'bMSFT': 'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ',
  'bGOOGL': 'XsCS1JQAyHFmFBN1gXocPwbqfmnSbPLdkVwsiVjvBmM',
  'bAMZN': 'Xs3eBt7uVfbvjB6kPhmehoWxKxjmKPo7yBHkfXC1xZh',
  'bMETA': 'Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu',
  'bCOIN': 'Xs7p2YYXdgX99dMpiCb6t2qVwfYHF7G6r3VPGFt6JYR',
  'bSPY': 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W',
  'bGOLD': 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp'
};

export async function fetchAll(symbols) {
  const ids = symbols.map(s => MINTS[s]).filter(Boolean);
  if (!ids.length) return new Map();
  // price.jup.ag/v6는 2025-09 deprecate. lite-api.jup.ag/price/v3로 이동.
  // 응답: {<mint>: {usdPrice, ...}}
  const url = `https://lite-api.jup.ag/price/v3?ids=${ids.join(',')}`;
  let j;
  try {
    const r = await pfetch(url, {cache: 'no-store'});
    if (!r.ok) throw new Error(`jup ${r.status}`);
    j = await r.json();
  } catch {
    return new Map();
  }
  const out = new Map();
  const ts = Date.now();
  for (const [sym, mint] of Object.entries(MINTS)) {
    if (!symbols.includes(sym)) continue;
    const px = parseFloat(j[mint]?.usdPrice);
    if (!px) continue;
    out.set(sym, {bid: px, ask: px, last: px, ts});
  }
  return out;
}
