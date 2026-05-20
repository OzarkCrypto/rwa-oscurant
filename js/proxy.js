const PROXY = '/api/v?u=';

export function pfetch(url, opts) {
  return fetch(PROXY + encodeURIComponent(url), opts);
}
