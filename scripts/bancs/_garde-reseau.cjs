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

function surveiller(ctx) {
  if (!ctx || ctx.__vrmGardeReseau) return ctx;
  ctx.__vrmGardeReseau = true;
  try {
    // La production : refusée au niveau du contexte (une route du banc qui `fulfill` passe AVANT).
    ctx.route((u) => PROD.test(u.hostname), (r) => { noter('production', r.request().url()); if (process.env.BANC_GARDE_TRACE) { const q = r.request(); let fr = ''; try { fr = q.frame().url(); } catch (_) { fr = 'sw?'; } console.log('GARDE', q.method(), q.resourceType(), fr, q.url().slice(0, 200)); } return r.abort('blockedbyclient'); }).catch(() => {});
  } catch (_) {}
  try {
    // Une requête vers la production qui a ÉCHOUÉ AU RÉSEAU (nom non résolu — la règle ci-dessus —, proxy, connexion) :
    // elle est partie. Un `route.abort()` du banc (failed, aborted, internetdisconnected…) ne compte pas : rien n'est sorti.
    const RESEAU = /ERR_NAME_NOT_RESOLVED|ERR_NAME_RESOLUTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|ERR_CONNECTION_(REFUSED|RESET|CLOSED|TIMED_OUT)|ERR_CERT|ERR_SSL|ERR_TIMED_OUT|ERR_ADDRESS_UNREACHABLE/;
    ctx.on('requestfailed', (q) => { const h = hote(q.url()); const f = (q.failure() || {}).errorText || ''; if (h && PROD.test(h) && RESEAU.test(f)) noter('production', q.url() + ' (' + f + ')'); });
    ctx.on('response', (rep) => {
      const h = hote(rep.url()); if (!h || LOCAL.test(h)) return;
      Promise.resolve().then(() => rep.serverAddr()).then((a) => { if (a) noter(PROD.test(h) ? 'production' : 'hôte réel', rep.url()); }).catch(() => {});
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
function poserSur(type, chromium) {
  if (!type || type.__vrmGardeReseau) return;
  type.__vrmGardeReseau = true;
  const l0 = type.launch.bind(type);
  type.launch = async (o, ...r) => {
    const b = await l0(chromium ? argsAvecRegles(o) : o, ...r);
    const nc = b.newContext.bind(b), np = b.newPage.bind(b);
    b.newContext = async (...x) => surveiller(await nc(...x));
    b.newPage = async (...x) => { const p = await np(...x); surveiller(p.context()); return p; };
    return b;
  };
  const p0 = type.launchPersistentContext.bind(type);
  type.launchPersistentContext = async (d, o, ...r) => surveiller(await p0(d, chromium ? argsAvecRegles(o) : o, ...r));
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
module.exports = { poserGarde, notesGardeReseau: notes };
