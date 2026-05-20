"""Discover tokenized stock universe across all venues and emit data/universe.json.

Master source: HL HIP3 6 dexes (xyz/cash/flx/km/hyna/abcd). Anything that lives on
HL HIP3 as a stock-class asset is a candidate ticker. Then cross-match Bybit / Gate /
MEXC / Kraken (spot+perp) by symbol pattern. Index/ETF pairs (USA500/XYZ100/GOLD/SILVER)
are kept as a hand-curated map at bottom because they need ratio metadata.
"""
from __future__ import annotations
import json, urllib.request, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'universe.json'

# === HL HIP3 EXCLUDE (non-stock symbols across all dexes) ===
EXCLUDE = {
    # crypto
    'BTC','ETH','SOL','HYPE','XRP','DOGE','BNB','XMR','LTC','BCH','ADA','SUI','PUMP',
    'FARTCOIN','ENA','LIT','ZEC','LINK','XPL','IP','LIGHTER','BASED','1000PEPE','USDE',
    'AVAX','AAVE','APT','ZRO','JTO','OP','TRUMP','WLD','POPCAT','USELESS','WLFI','CRO',
    'AI16Z','YZY','LAUNCHCOIN','TAO','ONDO','JUP','ASTER','AXS','BIO','RESOLV','DUSK',
    'AVNT','2Z','BIRB','SKR','DYDX','GRASS','ZORA','STABLE','0G','FF','PROVE','STBL',
    'EDEN','DOLO','PYTH','FOGO','SKY','MET','SYRUP','ARC','MEGA','PENGU','PENDLE',
    'VIRTUAL','MON','PIPPIN','CHIP','VVV','NMR','APEX','AERO','RIVER','DASH','KAITO',
    'LINEA','HUMA','MOVE','ZK','HEDERA','POL','STRK','EIGEN','ETHFI','OSMO','ICP','HBAR',
    'DOT','MORPHO','BMNR','CC','STRC','CRWV','PAXG','CRV','UNI','MNT','LDO','TIA','SEI',
    'XLM','FIL','BERA','GMX','MYX','S',
    # fx
    'JPY','EUR','CHF','GBP','CAD','AUD','NZD','XAU','XAG','XPD','XPT','XCU',
    'USDKRW','USDCHF','EURUSD','GBPUSD','USDJPY','NZDUSD','AUDUSD','USDTRY','USDMXN',
    'USDARS','USDBRL','USDCNY','USDSGD','USDTHB','XAUUSD','USDCAD',
    # indices / commodities / etf (handled separately as INDEX_TICKERS)
    'USA500','USA100','XYZ100','SP500','US500','USTECH','USENERGY','USOIL','USBOND',
    'SMALL2000','JPN225','KR200','SEMI','SEMIS','GLDMINE','MAG7','MAGS','INFOTECH',
    'BIOTECH','DEFENSE','NUCLEAR','ROBOT','ENERGY','GOLD','SILVER','PALLADIUM','PLATINUM',
    'GOLDJM','SILVERJM','OIL','WTI','GAS','COPPER','WHEAT','SOY','BRENTOIL','NATGAS','CL',
    'TOTAL2','OTHERS','BTCD','H100','KWEB','EWY','IWM','SPY','QQQ','GLD','DIA','SOXX',
    'BOTZ','URA','CAR',
}

def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=15).read())

def http_post(url, body):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={'content-type':'application/json'}
    )
    return json.loads(urllib.request.urlopen(req, timeout=15).read())

def discover_hl(dex):
    data = http_post('https://api.hyperliquid.xyz/info', {'type':'metaAndAssetCtxs','dex':dex})
    if not isinstance(data, list): return []
    return [m['name'] for m in data[0]['universe']]

def discover_bybit():
    j = http_get('https://api.bybit.com/v5/market/tickers?category=spot')
    return [t['symbol'] for t in j['result']['list']]

def discover_gate():
    return [t['currency_pair'] for t in http_get('https://api.gateio.ws/api/v4/spot/tickers')]

def discover_mexc():
    return [t['symbol'] for t in http_get('https://api.mexc.com/api/v3/ticker/bookTicker')]

def discover_kraken_for(bases):
    """Probe Kraken Ticker with batched xUSD pairs + asset_class=tokenized_asset.
    Returns the set of pair keys that came back (i.e. confirmed live xStocks)."""
    if not bases: return set()
    pairs = ','.join(f'{b}xUSD' for b in bases)
    url = f'https://api.kraken.com/0/public/Ticker?pair={pairs}&asset_class=tokenized_asset'
    try:
        j = http_get(url)
    except Exception as e:
        print(f'kraken probe failed: {e}', file=sys.stderr)
        return set()
    return set((j.get('result') or {}).keys())

def discover_kf():
    return [t['symbol'] for t in http_get('https://futures.kraken.com/derivatives/api/v3/tickers')['tickers']]

print('fetching HL HIP3 dexes...', file=sys.stderr)
hl_by_dex = {d: discover_hl(d) for d in ['xyz','cash','flx','km','hyna','abcd']}

print('fetching CEX venues...', file=sys.stderr)
bybit_set = set(discover_bybit())
gate_set = set(discover_gate())
mexc_set = set(discover_mexc())
kf_set = set(discover_kf())

# candidates = HL HIP3 individual stock base only.
# do NOT trust CEX <T>XUSDT pattern blindly — many crypto tokens (AVAX, DYDX, FRAX, etc)
# end with X and would false-positive as stocks. cross-checking against HL HIP3 universe
# (which only lists tokenized stocks + clearly labeled indices) is the cleanest filter.
candidates = set()
for dex, names in hl_by_dex.items():
    for n in names:
        if ':' not in n: continue
        base = n.split(':',1)[1]
        if base in EXCLUDE: continue
        if not base.isalpha(): continue
        if len(base) > 8: continue
        candidates.add(base)

print(f'HL HIP3 candidate tickers: {len(candidates)}', file=sys.stderr)

# probe Kraken with all candidates at once to get confirmed xStock pairs
print('probing Kraken xStock for candidates...', file=sys.stderr)
kraken_set = discover_kraken_for(sorted(candidates))
print(f'kraken confirmed: {len(kraken_set)}', file=sys.stderr)

# step 3: build per-ticker mapping
tickers = {}
for t in sorted(candidates):
    entry = {
        'name': t,
        'real': {'polygon': t, 'stooq': f'{t.lower()}.us'},
        'cex_spot': {},
        'cex_perp': {},
        'dex_perp': {'hyperliquid': {}},
        'dex_spot': {},
    }
    # HL HIP3 per dex
    for dex, names in hl_by_dex.items():
        target = f'{dex}:{t}'
        if target in names:
            entry['dex_perp']['hyperliquid'][dex] = target
    if not entry['dex_perp']['hyperliquid']:
        del entry['dex_perp']['hyperliquid']
    if not entry['dex_perp']:
        del entry['dex_perp']
    # CEX
    if f'{t}XUSDT' in bybit_set: entry['cex_spot']['bybit'] = f'{t}XUSDT'
    if f'{t}X_USDT' in gate_set: entry['cex_spot']['gate'] = f'{t}X_USDT'
    if f'{t}XUSDT' in mexc_set: entry['cex_spot']['mexc'] = f'{t}XUSDT'
    if f'{t}xUSD' in kraken_set: entry['cex_spot']['kraken'] = f'{t}xUSD'
    if f'PF_{t}XUSD' in kf_set: entry['cex_perp']['kraken_futures'] = f'PF_{t}XUSD'
    if not entry['cex_perp']:
        del entry['cex_perp']
    # only keep tickers with at least 2 venues across all categories
    n = (len(entry['cex_spot'])
         + len(entry.get('cex_perp', {}))
         + len(entry.get('dex_perp', {}).get('hyperliquid', {})))
    if n < 2: continue  # skip noise
    tickers[t] = entry

print(f'tickers after >=2 venues filter: {len(tickers)}', file=sys.stderr)

# step 4: append hand-curated index/ETF pairs (need ratio metadata)
INDEX_TICKERS = {
    'SPY': {
        'name': 'S&P 500 ETF',
        'real': {'polygon': 'SPY', 'stooq': 'spy.us'},
        'cex_spot': {k: v for k, v in [('gate', 'SPYX_USDT'), ('mexc', 'SPYXUSDT'), ('kraken', 'SPYxUSD')] if v},
        'cex_perp': {'kraken_futures': 'PF_SPYXUSD'},
        'dex_perp': {'hyperliquid': {
            'abcd': {'sym': 'abcd:USA500', 'ratio': 10.0, 'is_index': True},
            'cash': {'sym': 'cash:USA500', 'ratio': 10.0, 'is_index': True},
            'flx':  {'sym': 'flx:USA500',  'ratio': 10.0, 'is_index': True},
            'km':   {'sym': 'km:US500',    'ratio': 10.0, 'is_index': True},
        }},
        'dex_spot': {'backed_solana': 'bSPY'},
    },
    'QQQ': {
        'name': 'Nasdaq 100 ETF',
        'real': {'polygon': 'QQQ', 'stooq': 'qqq.us'},
        'cex_spot': {'gate': 'QQQX_USDT', 'kraken': 'QQQxUSD'},
        'cex_perp': {'kraken_futures': 'PF_QQQXUSD'},
        'dex_perp': {'hyperliquid': {
            'xyz': {'sym': 'xyz:XYZ100', 'ratio': 41.0, 'is_index': True},
            'flx': {'sym': 'flx:USA100', 'ratio': 41.0, 'is_index': True},
            'km':  {'sym': 'km:USTECH',  'ratio': 41.0, 'is_index': True},
        }},
        'dex_spot': {},
    },
    'GLD': {
        'name': 'Gold ETF',
        'real': {'polygon': 'GLD', 'stooq': 'gld.us'},
        'cex_spot': {'gate': 'GLDX_USDT', 'kraken': 'GLDxUSD'},
        'cex_perp': {'kraken_futures': 'PF_GLDXUSD'},
        'dex_perp': {'hyperliquid': {
            'cash': {'sym': 'cash:GOLD', 'ratio': 10.88, 'is_index': True},
            'flx':  {'sym': 'flx:GOLD',  'ratio': 10.88, 'is_index': True},
            'hyna': {'sym': 'hyna:GOLD', 'ratio': 10.88, 'is_index': True},
            'km':   {'sym': 'km:GOLD',   'ratio': 10.88, 'is_index': True},
            'xyz':  {'sym': 'xyz:GOLD',  'ratio': 10.88, 'is_index': True},
        }},
        'dex_spot': {'backed_solana': 'bGOLD'},
    },
    'SLV': {
        'name': 'Silver ETF',
        'real': {'polygon': 'SLV', 'stooq': 'slv.us'},
        'cex_spot': {'kraken': 'SLVxUSD'},
        'cex_perp': {},
        'dex_perp': {'hyperliquid': {
            'cash': {'sym': 'cash:SILVER', 'ratio': 1.106, 'is_index': True},
            'flx':  {'sym': 'flx:SILVER',  'ratio': 1.106, 'is_index': True},
            'hyna': {'sym': 'hyna:SILVER', 'ratio': 1.106, 'is_index': True},
            'km':   {'sym': 'km:SILVER',   'ratio': 1.106, 'is_index': True},
            'xyz':  {'sym': 'xyz:SILVER',  'ratio': 1.106, 'is_index': True},
        }},
        'dex_spot': {},
    },
}
for k, v in INDEX_TICKERS.items():
    tickers[k] = v

# Backed Solana mints (subset, verified live)
BACKED = {
    'AAPL':'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN',
    'TSLA':'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB',
    'NVDA':'Xsc9qvGR1efVDFGLrVsmkzv3qi45LXBkmcGd2dwbusy',
    'MSFT':'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ',
    'GOOGL':'XsCS1JQAyHFmFBN1gXocPwbqfmnSbPLdkVwsiVjvBmM',
    'AMZN':'Xs3eBt7uVfbvjB6kPhmehoWxKxjmKPo7yBHkfXC1xZh',
    'META':'Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu',
    'COIN':'Xs7p2YYXdgX99dMpiCb6t2qVwfYHF7G6r3VPGFt6JYR',
}
for t, mint in BACKED.items():
    if t in tickers:
        tickers[t].setdefault('dex_spot', {})['backed_solana'] = f'b{t}'

# === write universe.json (preserve venues + fees from existing file) ===
existing = json.loads(OUT.read_text())
out = {
    '_meta': {
        'note': 'auto-discovered via scripts/discover_universe.py',
        'verified_at': '2026-05-20',
        'patterns': {
            'bybit': '<T>XUSDT (xStock)',
            'gate':  '<T>X_USDT (xStock)',
            'mexc':  '<T>XUSDT (xStock)',
            'kraken': '<T>xUSD (asset_class=tokenized_asset)',
            'kraken_futures': 'PF_<T>XUSD',
            'hyperliquid': '<dex>:<asset>, dex in {xyz,cash,flx,km,hyna,abcd}',
        },
        'note_index': 'USA500/XYZ100/GOLD/SILVER kept as hand-curated INDEX_TICKERS with ratio metadata.',
    },
    'tickers': dict(sorted(tickers.items())),
    'venues': existing['venues'],
    'fees_bps': existing['fees_bps'],
}
OUT.write_text(json.dumps(out, indent=2))
print(f'wrote {OUT} ({len(tickers)} tickers)', file=sys.stderr)
