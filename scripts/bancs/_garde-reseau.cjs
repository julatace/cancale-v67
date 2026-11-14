// ════════════════════════════════════════════════════════════════════════════
//  LA GARDE RÉSEAU DES BANCS (11 nov.) — aucun banc ne joint un vrai serveur.
//
//  Constat (journaux d'authentification de la PRODUCTION, 11 nov. 11:45 → 11:57) :
//  toutes les ~7 s, depuis des runners GitHub Actions, des GET /auth/v1/user avec un
//  jeton de banc (« invalid number of segments »), des POST /token refresh invalides,
//  des GET /auth/v1/settings. Des bancs laissaient sortir des requêtes : une route
//  `/^https?:\/\/(?!localhost)/ → r.continue()` (abonnement-propre, raccourcis-siri…),
//  ou aucune route du tout pour `/auth/v1/`.
//
//  Posée sur `playwright` (chromium / webkit / firefox : launch, launchPersistentContext),
//  pour TOUT navigateur d'un banc, d'un test ou d'un audit :
//   1. la base et le site de production ne se RÉSOLVENT plus (Chromium :
//      `--host-resolver-rules`, sauf si le banc pose ses propres règles — session.cjs
//      les envoie vers SON serveur local), et le contexte les refuse (`route` → abort) ;
//   2. toute réponse venue du RÉSEAU (adresse de serveur connue) d'un hôte qui n'est pas
//      local, et toute tentative vers la production (même refusée), est NOTÉE ;
//   3. à la fin du processus, une seule note ⇒ « ❌ garde réseau … » et code 1 : le banc
//      est ROUGE. Une réponse servie par le banc (`route.fulfill`) n'a pas d'adresse de
//      serveur : elle ne compte pas.
//  Chargée par `_porte-banc.cjs` et par NODE_OPTIONS (workflows, lancer-bancs/audits).
//  Rien à régler : il n'existe PAS d'interrupteur pour la retirer. `BANC_GARDE_TRACE=1` dit seulement
//  la page et le type de chaque requête vers la production refusée (diagnostic).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const PROD = /(^|\.)(supabase\.co|supabase\.in|vrm\.center)$/i;
const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|::1|0\.0\.0\.0)$/i;
const REGLES = 'MAP lgonxzrzjcqthjtbdpzo.supabase.co ~NOTFOUND, MAP *.supabase.co ~NOTFOUND, MAP *.supabase.in ~NOTFOUND, MAP vrm.center ~NOTFOUND, MAP *.vrm.center ~NOTFOUND';
const notes = [];
const hote = (u) => { try { const x = new URL(u); return /^(https?|wss?):$/.test(x.protocol) ? x.hostname : ''; } catch (_) { return ''; } };
const noter = (quoi, u) => { if (notes.length < 50) notes.push(`${quoi} ${String(u).slice(0, 160)}`); };

// (13 nov., integration-13nov-ci) UN BANC QUI SERT LUI-MÊME LES VRAIS NOMS (e2e-extension, session) :
// Chromium lancé SANS proxy (`--no-proxy-server`) et avec ses propres `--host-resolver-rules` qui envoient
// vrm.center / la base vers 127.0.0.1:PORT. Ces requêtes ne sortent pas de la machine : la garde ne les
// refuse plus (elle cassait « App + vraie extension » : net::ERR_BLOCKED_BY_CLIENT sur vrm.center).
// Elle reste stricte : une réponse d'un de ces noms qui ne vient PAS exactement de 127.0.0.1:PORT
// (règle ignorée, proxy) est notée ; sans `--no-proxy-server`, aucun nom n'est tenu pour local.
const LOOPBACK_IP = /^(127\.\d+\.\d+\.\d+|\[?::1\]?)$/;
function cartesLocales(o) {
  const args = (o && Array.isArray(o.args)) ? o.args.map(String) : [];
  if (!args.includes('--no-proxy-server')) return [];
  const r = args.find((a) => /^--host-resolver-rules=/.test(a));
  if (!r) return [];
  const out = [];
  for (const regle of r.replace(/^--host-resolver-rules=/, '').split(',')) {
    const m = regle.trim().match(/^MAP\s+(\S+)\s+(127\.\d+\.\d+\.\d+|localhost):(\d+)$/i);
    if (!m) continue;
    const motif = new RegExp('^' + m[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^]*') + '$', 'i');
    out.push({ motif, port: Number(m[3]) });
  }
  return out;
}
const carteDe = (cartes, h) => (cartes || []).find((c) => c.motif.test(h)) || null;

function surveiller(ctx, cartes) {
  if (!ctx || ctx.__vrmGardeReseau) return ctx;
  ctx.__vrmGardeReseau = true;
  // (14 nov., fiabilité prod) UNE ÉCRITURE DE SORTIE NE QUITTE JAMAIS LE BANC. Mesuré dans les journaux de la
  // PRODUCTION (13 → 14 nov.) : des PATCH `app_data?id=eq.main&…&data->>rev=eq.N` et ~240 OPTIONS par jour venus
  // de `http://localhost:10033/10038` (bancs WebKit en CI) — l'envoi de sortie de l'app (App.jsx, `pagehide` ⇒
  // PATCH `keepalive: true`). Une requête `keepalive` (et `sendBeacon`) survit à la page : les routes de Playwright
  // ne la voient PAS (banc garde-keepalive.cjs, K2), Chromium la laisse filer, WebKit (sans règle de résolution)
  // jusqu'à la base. Dans la page, vers la production seulement : `keepalive` est retiré (la requête reste une
  // requête de la page, que les routes du banc servent, ou qui meurt avec elle) et un `sendBeacon` n'envoie rien.
  // `BANC_GARDE_KEEPALIVE=0` la retire (pour prouver le banc rouge) — la garde elle-même reste.
  if (process.env.BANC_GARDE_KEEPALIVE !== '0') {
    try {
      ctx.addInitScript(() => {
        try {
          if (window.__vrmGardeKeepalive) return; window.__vrmGardeKeepalive = true;
          const PROD = /(^|\.)(supabase\.co|supabase\.in|vrm\.center)$/i;
          const versProd = (u) => { try { return PROD.test(new URL(String(u), location.href).hostname); } catch (_) { return false; } };
          const f0 = window.fetch;
          if (typeof f0 === 'function') window.fetch = function (entree, init) {
            const u = typeof entree === 'string' ? entree : (entree && entree.url) || '';
            if (init && init.keepalive && versProd(u)) { const o = Object.assign({}, init); delete o.keepalive; return f0.call(this, entree, o); }
            return f0.call(this, entree, init);
          };
          const b0 = navigator.sendBeacon;
          if (typeof b0 === 'function') navigator.sendBeacon = function (u, d) { return versProd(u) ? false : b0.call(navigator, u, d); };
        } catch (_) {}
      }).catch(() => {});
    } catch (_) {}
  }
  try {
    // La production : refusée au niveau du contexte (une route du banc qui `fulfill` passe AVANT).
    ctx.route((u) => PROD.test(u.hostname) && !carteDe(cartes, u.hostname), (r) => { noter('production', r.request().url()); if (process.env.BANC_GARDE_TRACE) { const q = r.request(); let fr = ''; try { fr = q.frame().url(); } catch (_) { fr = 'sw?'; } console.log('GARDE', q.method(), q.resourceType(), fr, q.url().slice(0, 200)); } return r.abort('blockedbyclient'); }).catch(() => {});
  } catch (_) {}
  try {
    // Une requête vers la production qui a ÉCHOUÉ AU RÉSEAU (nom non résolu — la règle ci-dessus —, proxy, connexion) :
    // elle est partie. Un `route.abort()` du banc (failed, aborted, internetdisconnected…) ne compte pas : rien n'est sorti.
    const RESEAU = /ERR_NAME_NOT_RESOLVED|ERR_NAME_RESOLUTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|ERR_CONNECTION_(REFUSED|RESET|CLOSED|TIMED_OUT)|ERR_CERT|ERR_SSL|ERR_TIMED_OUT|ERR_ADDRESS_UNREACHABLE/;
    ctx.on('requestfailed', (q) => { const h = hote(q.url()); const f = (q.failure() || {}).errorText || ''; if (h && PROD.test(h) && !carteDe(cartes, h) && RESEAU.test(f)) noter('production', q.url() + ' (' + f + ')'); });
    ctx.on('response', (rep) => {
      const h = hote(rep.url()); if (!h || LOCAL.test(h)) return;
      const carte = carteDe(cartes, h);
      Promise.resolve().then(() => rep.serverAddr()).then((a) => { if (a && carte && LOOPBACK_IP.test(String(a.ipAddress)) && Number(a.port) === carte.port) return; if (a) noter((PROD.test(h) ? 'production' : 'hôte réel') + ` (réponse de ${a.ipAddress}:${a.port})`, rep.url()); }).catch(() => {});
    });
  } catch (_) {}
  return ctx;
}
function argsAvecRegles(o) {
  const opts = Object.assign({}, o || {});
  const args = Array.isArray(opts.args) ? opts.args.slice() : [];
  if (!args.some((a) => /^--host-resolver-rules=/.test(String(a)))) args.push(`--host-resolver-rules=${REGLES}`);
  opts.args = args;
  return opts;
}
// (11 nov., vert-11nov) LA LANGUE PAR DÉFAUT DES BANCS : depuis la traduction (src/i18n), l'app suit la
// langue du navigateur quand le vendeur n'a rien choisi. Un Chromium lancé sans langue prend celle de la
// machine (en-US sur un runner GitHub, ici aussi) : les bancs, qui jugent l'app en français, voyaient
// « Today · Listings · Sales ». Un contexte sans `locale` reçoit donc 'fr-FR' (celle de Julien) ; un banc
// qui veut juger une autre langue la pose lui-même (`locale: 'en-US'`) et la garde.
const avecLangue = (o) => (o && typeof o === 'object' && o.locale ? o : Object.assign({}, o || {}, { locale: 'fr-FR' }));
// (13 nov., integration-13nov-ci) SOUS WEBKIT (et Firefox), AUCUN SERVICE WORKER. Mesuré en CI
// (sonde, 13 nov.) : une fois `sw.js` de l'app installé, les requêtes de la page vers la base passent
// par le service worker, que les routes de Playwright NE VOIENT PAS sous WebKit — ni celles du banc,
// ni le refus de la garde : `connexion-claire` a reçu une réponse de la VRAIE base (172.64.x:443), et
// le banc, lui, ne recevait rien (63 rouges « aucune donnée chargée »). Chromium, lui, route le trafic
// du service worker. Aucun interrupteur : un contexte WebKit/Firefox de banc n'a jamais de service worker.
const sansServiceWorker = (o) => Object.assign({}, o || {}, { serviceWorkers: 'block' });
function poserSur(type, chromium) {
  if (!type || type.__vrmGardeReseau) return;
  type.__vrmGardeReseau = true;
  const opts = (o) => avecLangue(chromium ? o : sansServiceWorker(o));
  const l0 = type.launch.bind(type);
  type.launch = async (o, ...r) => {
    const b = await l0(chromium ? argsAvecRegles(o) : o, ...r);
    const cartes = chromium ? cartesLocales(o) : [];
    const nc = b.newContext.bind(b), np = b.newPage.bind(b);
    b.newContext = async (o, ...x) => surveiller(await nc(opts(o), ...x), cartes);
    b.newPage = async (o, ...x) => { const p = await np(opts(o), ...x); surveiller(p.context(), cartes); return p; };
    return b;
  };
  const p0 = type.launchPersistentContext.bind(type);
  type.launchPersistentContext = async (d, o, ...r) => surveiller(await p0(d, chromium ? avecLangue(argsAvecRegles(o)) : opts(o), ...r), chromium ? cartesLocales(o) : []);
}
function poserGarde(pw) {
  if (!pw) return;
  poserSur(pw.chromium, true); poserSur(pw.webkit, false); poserSur(pw.firefox, false);
}
let finPosee = false;
function poserFin() {
  if (finPosee) return; finPosee = true;
  process.on('exit', () => {
    if (!notes.length) return;
    const uniques = [...new Set(notes)];
    process.stdout.write(`\n❌ garde réseau : ${uniques.length} requête(s) vers un hôte réel depuis un banc (aucun banc ne joint la production ni Internet) — ${uniques.slice(0, 6).join(' ¦ ')}\n`);
    process.exitCode = 1;
    try { process.reallyExit(1); } catch (_) {}
  });
}
poserFin();
try { poserGarde(require('playwright')); } catch (_) {}
try { poserGarde(require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); } catch (_) {}
module.exports = { poserGarde, notesGardeReseau: notes, avecLangue, cartesLocales, carteDe };
