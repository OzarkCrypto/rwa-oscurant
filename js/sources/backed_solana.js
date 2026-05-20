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
  const url = `https://price.jup.ag/v6/price?ids=${ids.join(',')}`;
  let j;
  try {
    const r = await pfetch(url, {cache: 'no-store'});
    if (!r.ok) throw new Error(`jup ${r.status}`);
    j = await r.json();
  } catch {
    return new Map();
  }
  const data = j.data ?? {};
  const out = new Map();
  const ts = Date.now();
  for (const [sym, mint] of Object.entries(MINTS)) {
    if (!symbols.includes(sym)) continue;
    const px = parseFloat(data[mint]?.price);
    if (!px) continue;
    out.set(sym, {bid: px, ask: px, last: px, ts});
  }
  return out;
}
