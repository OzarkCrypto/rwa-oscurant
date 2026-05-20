const ALLOWED = new Set([
  'api.binance.com',
  'api.bybit.com',
  'www.okx.com',
  'api.gateio.ws',
  'api.mexc.com',
  'api.kucoin.com',
  'api.kraken.com',
  'futures.kraken.com',
  'api.hyperliquid.xyz',
  'stooq.com',
  'api.polygon.io',
  'price.jup.ag',
  'lite-api.jup.ag'
]);

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export async function onRequest(context) {
  const req = context.request;
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: CORS});

  const u = new URL(req.url);
  const target = u.searchParams.get('u');
  if (!target) return new Response('missing ?u=', {status: 400, headers: CORS});

  let tu;
  try { tu = new URL(target); } catch { return new Response('bad url', {status: 400, headers: CORS}); }
  if (tu.protocol !== 'https:') return new Response('https only', {status: 400, headers: CORS});
  if (!ALLOWED.has(tu.hostname)) return new Response(`host ${tu.hostname} not allowed`, {status: 403, headers: CORS});

  const init = {method: req.method, headers: {}};
  const ct = req.headers.get('content-type');
  if (ct) init.headers['content-type'] = ct;
  if (req.method !== 'GET' && req.method !== 'HEAD') init.body = await req.text();

  let upstream;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    return new Response(`upstream error: ${e.message}`, {status: 502, headers: CORS});
  }
  const body = await upstream.arrayBuffer();
  const h = {...CORS, 'cache-control': 'no-store'};
  const upCt = upstream.headers.get('content-type');
  if (upCt) h['content-type'] = upCt;
  return new Response(body, {status: upstream.status, headers: h});
}
