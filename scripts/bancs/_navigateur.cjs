// ════════════════════════════════════════════════════════════════════════════
//  LE MOTEUR D'UN BANC : Chromium par défaut, WebKit (le moteur de Safari) sur
//  demande — `NAVIGATEUR=webkit` (6 nov., filet 6 « Safari »).
//  Les vrais iPhone tournent sur WebKit ; les bancs ne voyaient que Chromium.
//  `lancer(pw, optionsChromium)` rend le navigateur choisi :
//   · chromium : exactement l'appel d'avant (chemin, --use-angle, --no-sandbox) ;
//   · webkit   : `pw.webkit.launch()` sans arguments Chromium (il les refuse).
//  La porte de banc (_porte-banc.cjs) est posée sur les deux moteurs.
//  WebKit doit être installé : `npx playwright install --with-deps webkit`
//  (la CI le fait ; ce conteneur n'a que Chromium dans /opt/pw-browsers).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const NAVIGATEUR = String(process.env.NAVIGATEUR || 'chromium').toLowerCase();
// (11 nov., webkit-fiable) Le faux serveur d'un banc doit répondre comme un VRAI serveur
// cross-origin (Supabase) : sous WebKit, les routes de Playwright reçoivent aussi le
// pré-vol CORS (OPTIONS) et une réponse servie sans `access-control-allow-*` est REFUSÉE
// par la page (Chromium, lui, ne le demande pas). Résultat mesuré en CI : aucune donnée
// chargée, « À retirer » vide, 63 rouges. On répond au pré-vol et on pose les en-têtes
// sur chaque réponse servie. Posé sous WebKit par `lancer` ; `BANC_CORS=1` le pose aussi sous
// Chromium (pour vérifier qu'il ne change rien là où tout passait déjà).
const corsVoulu = (moteur) => moteur === 'webkit' || process.env.BANC_CORS === '1';
const ENTETES_CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS', 'access-control-expose-headers': 'content-range, content-length, content-type, etag, x-vrm-version, *', 'access-control-max-age': '600' };
const enveloppes = new WeakMap();
const avecCors = (h) => {
  if (typeof h !== 'function') return h;
  if (enveloppes.has(h)) return enveloppes.get(h);
  const w = (route, req) => {
    let rq; try { rq = route.request(); } catch (_) { return h(route, req); }
    const voulu = (() => { try { return (rq.headers()['access-control-request-headers'] || 'authorization, apikey, content-type, prefer, range, x-client-info, accept-profile, content-profile, x-vrm-equipe'); } catch (_) { return '*'; } })();
    if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: Object.assign({}, ENTETES_CORS, { 'access-control-allow-headers': voulu }) });
    const ff = route.fulfill.bind(route);
    const p = new Proxy(route, { get(t, k) { if (k === 'fulfill') return (o = {}) => { let base = o.headers; if (!base && o.response) { try { base = o.response.headers(); } catch (_) {} } return ff(Object.assign({}, o, { headers: Object.assign({}, ENTETES_CORS, { 'access-control-allow-headers': voulu }, base || {}) })); }; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
    return h(p, req);
  };
  enveloppes.set(h, w); return w;
};
const poserCors = (o) => {
  if (!o || o.__vrmCors) return o; o.__vrmCors = true;
  const r0 = o.route.bind(o), u0 = o.unroute.bind(o);
  o.route = (url, h, ...x) => r0(url, avecCors(h), ...x);
  o.unroute = (url, h, ...x) => u0(url, h ? (enveloppes.get(h) || h) : h, ...x);
  return o;
};
const corsContexte = (ctx) => {
  poserCors(ctx);
  const np0 = ctx.newPage.bind(ctx);
  ctx.newPage = async (...x) => poserCors(await np0(...x));
  return ctx;
};
const corsNavigateur = (b, moteur) => {
  if (!corsVoulu(moteur)) return b;
  const nc = b.newContext.bind(b), np = b.newPage.bind(b);
  b.newContext = async (...x) => corsContexte(await nc(...x));
  b.newPage = async (...x) => poserCors(await np(...x));
  return b;
};
async function lancer(pw, optionsChromium) {
  if (NAVIGATEUR === 'webkit') return corsNavigateur(await pw.webkit.launch({}), 'webkit');
  if (NAVIGATEUR !== 'chromium') throw new Error(`NAVIGATEUR=${NAVIGATEUR} : seuls chromium et webkit sont servis`);
  return corsNavigateur(await pw.chromium.launch(optionsChromium), 'chromium');
}
module.exports = { lancer, NAVIGATEUR, estWebkit: NAVIGATEUR === 'webkit', avecCors };
