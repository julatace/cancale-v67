// ════════════════════════════════════════════════════════════════════════════
//  _vercel.cjs — servir dist/ COMME VERCEL : les `headers` et les `rewrites` de
//  vercel.json, LUS dans le fichier (jamais recopiés), appliqués à chaque
//  réponse. Sans ça, aucun banc ne voit la politique de sécurité du contenu
//  (CSP) que la production envoie : la fenêtre du reçu ou la carte pouvaient
//  casser sous la CSP sans qu'un seul banc ne rougisse (CLAUDE.md, « la facture
//  exécutait ce que l'acheteur écrit » — « Pas fait, et pourquoi »).
//
//  · `servir(dist, port)`       : un serveur http, headers + rewrites appliqués ;
//  · `brancher(ctx, origine)`   : pour un banc qui a SON serveur, ajoute les
//    mêmes en-têtes aux réponses de son origine (à appeler AVANT ses propres
//    routes : une route Playwright enregistrée plus tard passe d'abord) ;
//  · `observer(ctx)`            : collecte les violations CSP de TOUTES les pages
//    du contexte (popups comprises) — l'évènement `securitypolicyviolation` ET
//    la console (« Refused to … because it violates … »), y compris en
//    Report-Only (« [Report Only] »).
//  · `vercelMute(fn)`           : une copie modifiée de vercel.json (mutations).
//  · les RAPPORTS (22 oct.) : chaque CSP servie reçoit `report-uri
//    /__vrm-csp-rapport`, et ce que le navigateur y envoie rejoint les
//    violations observées. ⚠️ C'est la SEULE voie qui voit un worker (le moteur
//    de la carte, MapLibre, charge ses tuiles DEPUIS son worker) ou le service
//    worker : mesuré dans Chromium le 22 octobre, leur refus n'arrive ni à
//    l'évènement de la page ni à sa console — un banc sans rapports était vert
//    sur une carte dont toutes les tuiles auraient été refusées.
//    `BANC_CSP_SANS_RAPPORTS=1` les coupe (pour prouver que le contrôle mord).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
let CONFIG_CHEMIN = process.env.BANC_VERCEL_JSON || path.join(RACINE, 'vercel.json');

const lireConfig = () => JSON.parse(fs.readFileSync(CONFIG_CHEMIN, 'utf8'));
const vercelMute = (changer) => {
  const cfg = lireConfig();
  changer(cfg);
  const f = path.join(require('os').tmpdir(), `vrm-vercel-mute-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(cfg));
  CONFIG_CHEMIN = f;
  return f;
};

// Un motif de source Vercel (path-to-regexp) → RegExp. On couvre ce que le
// projet utilise : chemins littéraux, `(.*)`, `:param`, `:param*`.
function motif(source) {
  let re = '';
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    // Un groupe est recopié tel quel, parenthèses ÉQUILIBRÉES : `/((?!sw\\.js).*)`
    // (22 oct.) porte un groupe dans le groupe — couper à la première `)` donnait
    // une expression fausse, donc des en-têtes qui ne seraient pas ceux de Vercel.
    if (c === '(') {
      let n = 0, j = i;
      for (; j < source.length; j++) { if (source[j] === '\\') { j++; continue; } if (source[j] === '(') n++; else if (source[j] === ')' && --n === 0) break; }
      re += '(' + source.slice(i + 1, j) + ')'; i = j; continue;
    }
    if (c === ':') {
      const m = /^:([A-Za-z0-9_]+)(\*|\+|\?)?/.exec(source.slice(i));
      re += m[2] === '*' ? '(.*)' : '([^/]+)'; i += m[0].length - 1; continue;
    }
    re += c.replace(/[.+?^${}|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

// Les rapports de violation (report-uri) : ajoutés aux en-têtes SERVIS par le
// banc — jamais à vercel.json (la production n'a pas de collecteur : elle note
// les violations de la page dans le journal des plantages, src/plantages.js).
const RAPPORT_CHEMIN = '/__vrm-csp-rapport';
const RAPPORTS = process.env.BANC_CSP_SANS_RAPPORTS !== '1';
const avecRapport = (cle, valeur) => (RAPPORTS && /^content-security-policy/i.test(cle) ? valeur + '; report-uri ' + RAPPORT_CHEMIN : valeur);

// `brut: true` : les en-têtes EXACTS de vercel.json (sans le report-uri du banc).
function entetesPour(chemin, { brut = false } = {}) {
  const cfg = lireConfig();
  const out = {};
  for (const h of cfg.headers || []) if (motif(h.source).test(chemin)) for (const e of h.headers || []) out[e.key] = brut ? e.value : avecRapport(e.key, e.value);
  return out;
}

// Un rapport reçu (forme `application/csp-report`, ou celle de la Reporting API)
// → les violations observées des contextes abonnés (ou de CE contexte).
const ABONNES = new Map();   // contexte → note(v)
function recevoirRapport(corps, ctx) {
  let liste = [];
  try { const j = JSON.parse(String(corps || '')); liste = Array.isArray(j) ? j.map((x) => x && x.body).filter(Boolean) : [j && j['csp-report']].filter(Boolean); } catch (_) {}
  for (const r of liste) {
    const d = String(r['effective-directive'] || r.effectiveDirective || r['violated-directive'] || r.violatedDirective || '?').split(' ')[0];
    const u = String(r['blocked-uri'] || r.blockedURL || r.blockedURI || '');
    const doc = String(r['document-uri'] || r.documentURL || '');
    const disp = String(r.disposition || '');
    const src = String(r['source-file'] || r.sourceFile || '');
    const v = { cle: d + ' ' + u, texte: `[rapport${disp === 'report' ? ' Report-Only' : ''}] ${d} ← ${u || '(en ligne)'} — document ${doc.replace(/^https?:\/\/[^/]+/, '') || '?'}${src && src !== doc ? ' (' + src.replace(/^https?:\/\/[^/]+/, '') + ')' : ''}`, page: doc, rapport: true, doc };
    const cibles = ctx && ABONNES.has(ctx) ? [ABONNES.get(ctx)] : [...ABONNES.values()];
    for (const note of cibles) note(v);
  }
}

function reecrire(url) {
  const cfg = lireConfig();
  const [p, q = ''] = url.split('?');
  for (const r of cfg.rewrites || []) {
    if (!motif(r.source).test(p)) continue;
    const [dp, dq = ''] = r.destination.split('?');
    return dp + ((dq || q) ? '?' + [dq, q].filter(Boolean).join('&') : '');
  }
  return url;
}

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.onnx': 'application/octet-stream', '.zip': 'application/zip', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

// Le serveur. Comme Vercel pour un site statique sans réécriture « SPA » :
// « / » sert index.html, un chemin sans extension sert index.html (l'app ne vit
// qu'à « / » + `?tab=` ; les rares chemins nus — `/connexion` — y tombent aussi
// en production via le gestionnaire 404 de Vite… on reste tolérant), le reste
// est servi tel quel ou 404.
function servir(dist, port) {
  const srv = http.createServer((q, r) => {
    if (q.method === 'POST' && q.url.split('?')[0] === RAPPORT_CHEMIN) {
      let b = ''; q.on('data', (c) => { b += c; }); q.on('end', () => { recevoirRapport(b); r.writeHead(204); r.end(); });
      return;
    }
    const url = reecrire(q.url);
    const chemin = url.split('?')[0];
    const entetes = entetesPour(q.url.split('?')[0]);
    if (chemin.startsWith('/api/')) { r.writeHead(404, entetes); return r.end('{}'); }
    let f = chemin === '/' || !path.extname(chemin) ? '/index.html' : chemin;
    const p = path.join(dist, decodeURIComponent(f));
    if (!p.startsWith(dist) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404, entetes); return r.end(); }
    r.writeHead(200, { ...entetes, 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(r);
  });
  srv.on('error', (e) => { console.log('❌ le port ' + port + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
  srv.listen(port);
  return srv;
}

// Pour un banc qui garde son serveur : on récupère la réponse et on lui ajoute
// les en-têtes de vercel.json. À appeler AVANT toute autre route du banc.
async function brancher(ctx, origine) {
  const o = origine.replace(/\/$/, '');
  await ctx.route((u) => u.href.startsWith(o + '/'), async (route) => {
    try {
      const rep = await route.fetch();
      const chemin = new URL(route.request().url()).pathname;
      return route.fulfill({ response: rep, headers: { ...rep.headers(), ...entetesPour(chemin) } });
    } catch (_) { return route.fallback(); }
  });
  // Les rapports envoyés à CETTE origine : gardés ici (enregistrée APRÈS la
  // route générale, elle passe d'abord — §6.6).
  await ctx.route((u) => u.href.split('?')[0] === o + RAPPORT_CHEMIN, (route) => {
    try { recevoirRapport(route.request().postData(), ctx); } catch (_) {}
    return route.fulfill({ status: 204, body: '' });
  });
}

// Les violations : (1) l'évènement, posé dans chaque document du contexte ;
// (2) la console de chaque page, popups comprises.
function observer(ctx) {
  const vues = [];
  const note = (v) => { if (!vues.some((x) => x.cle === v.cle)) vues.push(v); };
  ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      const v = { d: e.effectiveDirective || e.violatedDirective, u: e.blockedURI, s: e.sourceFile || '', disp: e.disposition, l: e.lineNumber };
      window.__csp.push(v);
      try { console.warn('[VRM-CSP] ' + JSON.stringify(v)); } catch (_) {}
    }, true);
  });
  const ecoute = (pg) => pg.on('console', (m) => {
    const t = m.text();
    if (/^\[VRM-CSP\] /.test(t)) { const v = JSON.parse(t.slice(10)); return note({ cle: v.d + ' ' + v.u, texte: `${v.disp === 'report' ? '[Report-Only] ' : ''}${v.d} ← ${v.u || '(en ligne)'}${v.s ? ' (' + v.s + ':' + v.l + ')' : ''}`, page: pg.url() }); }
    if (/Content Security Policy|violates the following/i.test(t)) note({ cle: t.slice(0, 200), texte: t.slice(0, 300), page: pg.url() });
  });
  ctx.on('page', ecoute);
  for (const p of ctx.pages()) ecoute(p);
  ABONNES.set(ctx, note);
  ctx.on('close', () => ABONNES.delete(ctx));
  return vues;
}

// Pour un banc qui a son serveur : les en-têtes de Vercel + l'observation, en
// UNE ligne après chaque `newContext` (AVANT ses propres routes). Toutes les
// violations vues sont gardées ; `bilanCsp()` les imprime et rend leur nombre
// (à ajouter aux échecs du banc avant de sortir).
const TOUTES = [];
async function cspBanc(ctx, origine, nom = '') {
  await brancher(ctx, origine);
  const vues = observer(ctx);
  TOUTES.push({ nom, vues });
  return vues;
}
function bilanCsp() {
  const v = TOUTES.flatMap((x) => x.vues.map((y) => (x.nom ? x.nom + ' : ' : '') + y.texte + ' — ' + y.page));
  console.log(v.length ? '  ❌ ' + v.length + ' violation(s) de la politique de sécurité du contenu (vercel.json) :\n     ' + v.join('\n     ') : '  ✅ aucune violation de la politique de sécurité du contenu (en-têtes de vercel.json)');
  return v.length;
}

module.exports = { servir, brancher, observer, cspBanc, bilanCsp, entetesPour, reecrire, motif, lireConfig, vercelMute, recevoirRapport, RAPPORT_CHEMIN, RAPPORTS, RACINE };
