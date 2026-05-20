# rwa.oscurant.xyz — tokenized stock arb monitor

토큰화 주식 spot/perp 가격 venue 간 모니터. 100% 클라이언트사이드 (CF Pages 정적).

## venues
- **CEX spot**: Binance, Bybit, OKX, Gate, MEXC, KuCoin, Kraken
- **CEX perp**: Kraken Futures (xStock PF_*)
- **DEX perp**: Hyperliquid HIP3 (km/xyz/flx/cash/hyna/abcd)
- **DEX spot**: Backed (Solana xStock via Jupiter price)
- **Real px**: Stooq EOD (no key), Polygon RT (key 옵션)

대부분 public read-only. Polygon만 free key 필요 (RT 원하면).

## run locally
```
cd rwa.oscurant.xyz
python3 -m http.server 8080
# open http://localhost:8080
```
ES module import 때문에 file:// 직접 열면 안 됨.

## deploy (Cloudflare Pages)
1. 새 CF Pages 프로젝트 생성, 빌드 명령 없이 root 그대로 publish
2. custom domain `rwa.oscurant.xyz` 연결
3. 빌드 출력 디렉토리 = repo root (`/`)
4. `_headers`, `_redirects` 자동 적용됨

GitHub 연동 없이 wrangler로 직접 push도 가능:
```
npx wrangler pages deploy . --project-name rwa-oscurant
```

## 주의
- 인덱스 perp (HL의 USA500/XYZ100/GOLD 등)는 ETF 대비 정적 ratio arb 불가 — grid 에 `idx` 배지로 표시만, arb 테이블에선 제외
- Stooq는 EOD라 RTH 중엔 stale. Polygon key 넣으면 RT (free 5/min 제한)
- Backed Solana mint 주소는 placeholder. 실제 운영시 https://www.backed.fi/products 참조해서 보정
- MEXC tokenized stock는 listing 변동 잦음 — 404 나오면 universe.json 에서 null 처리
- 모든 fee_bps 는 round-trip taker estimate. maker-only 면 절반쯤

## structure
```
rwa.oscurant.xyz/
├── index.html
├── styles.css
├── _headers, _redirects     # CF Pages
├── data/
│   └── universe.json        # ticker × venue symbol map + fees
└── js/
    ├── main.js              # entry, controls, polling
    ├── aggregator.js        # source orchestration + basis / net EV
    ├── render.js            # table + grid
    └── sources/             # venue별 fetcher (동일 인터페이스)
        ├── binance.js bybit.js okx.js gate.js mexc.js kucoin.js
        ├── kraken.js kraken_futures.js
        ├── hyperliquid.js
        ├── backed_solana.js
        └── stooq.js polygon.js
```

## 새 venue 추가
1. `js/sources/<name>.js` 작성 (export `meta` + `fetchAll(symbols)`)
2. `js/aggregator.js` SOURCES에 import
3. `js/main.js` SRC_IDS 배열에 추가
4. `data/universe.json` 각 ticker에 venue symbol 채움
5. `_headers` CSP connect-src에 호스트 추가

## 새 ticker 추가
`data/universe.json` tickers 객체에 한 줄 추가:
```json
"COIN": {
  "name": "Coinbase", "ratio_to_share": 1.0,
  "real": {"polygon": "COIN", "stooq": "coin.us"},
  "cex_spot": {"bybit": "COINUSDT", "kraken": "COINxUSD", ...},
  "cex_perp": {"kraken_futures": null},
  "dex_perp": {"hyperliquid": {"xyz": "xyz:COIN", "flx": "flx:COIN"}}
}
```
