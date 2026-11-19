#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  ALLÉGER LES `:has()` DE RACINE (19 nov. — « ça charge beaucoup trop lentement entre les onglets »).
//
//  MESURÉ (banc onglets-trace, INVALIDATIONS=1, 390 ×4) : la feuille porte ~480 sélecteurs `:has(…)`. Ceux dont
//  l'ANCRE est un élément qui contient tout (html, body, #root, .vrm-app-shell, .vrm-main) et qui continuent vers un
//  descendant (« .vrm-main:has(.vrm-fu-colis) .vrm-colis-carte ») marquent ces ancres « dépend d'un :has() » ; dès
//  qu'une modification du DOM touche un mot présent dans N'IMPORTE quel argument de `:has()` de la feuille (une
//  classe, un attribut, une balise comme div ou img), Blink invalide le SOUS-ARBRE ENTIER de chaque ancre
//  (« Invalidation set invalidates subtree », allDescendantsMightBeInvalid) : tout le document est restylé, 13 000
//  éléments sur Achats, 0,8 à 2,3 s au ×4, au toucher d'un onglet comme à la moindre insertion.
//
//  CE QUE FAIT LE SCRIPT : il remplace, dans la SOURCE, chaque `:has(ARG)` porté par une de ces ancres par un
//  DRAPEAU, un mot de l'attribut `data-vrm-d` posé sur l'ancre par src/drapeauxRacine.js (qui évalue le MÊME
//  `:has(ARG)` avec `element.matches`, donc la même sémantique) :
//        .vrm-main:has(.vrm-fu-colis) .x        ⇒   .vrm-main:where([data-vrm-d~="d3"]):not(._) .x
//  La spécificité est conservée à l'identique (`:where()` vaut 0 ; `:not(#_)`, `:not(._)`, `:not(_)` rendent
//  exactement celle de l'argument le plus spécifique) : l'ordre de la cascade ne bouge pas. Le changement d'un
//  attribut n'invalide que les descendants que SES règles nomment — plus jamais tout le document.
//  La table des drapeaux (ancre, argument) est écrite dans src/drapeauxRacine.table.js.
//
//    node scripts/alleger-has.cjs                 la LISTE chiffrée (rien n'est écrit)
//    node scripts/alleger-has.cjs --ecrire        réécrit les feuilles NON réservées + la table
//    node scripts/alleger-has.cjs --ecrire --tout réécrit TOUTES les feuilles (après l'intégration des autres lots)
//    node scripts/alleger-has.cjs --racine <dir>  travaille sur une copie de l'arbre (mesure, preuve)
//    node scripts/alleger-has.cjs --prouve        s'éprouve lui-même (spécificité, forme, idempotence)
//    node scripts/alleger-has.cjs --verifier <dist avant> <dist après> [--captures <dossier>]
//                                                 rend les écrans des deux builds (390 et 1512, base de volume) et
//                                                 compare les captures AU PIXEL : doit dire 0 pixel d'écart
//  Les feuilles RÉSERVÉES (d'autres lots les modifient le 19 nov.) ne sont pas touchées sans `--tout`.
//  ⚠️ Tant qu'UNE règle de racine reste (dans une feuille réservée), les ancres restent marquées : le gain ne se
//  mesure qu'une fois TOUT réécrit (voir docs/passation/2026-11-19-vite-et-sans-bug.md).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const RACINE = path.resolve(arg('--racine') || path.join(__dirname, '..'));
const SRC = path.join(RACINE, 'src');
const TABLE = path.join(SRC, 'drapeauxRacine.table.js');
const RESERVEES = [/^src\/designV2\/interface\//, /^src\/designV2\/design-v2\.css$/, /^src\/designV2\/barre\.css$/, /^src\/designV2\/theme-apple\.css$/, /^src\/design\/fiche-d\.css$/,
  /^src\/design\/ventes-verre\.css$/, /^src\/design\/verre-[^/]*\.css$/, /^src\/design\/studio-verre\.css$/, /^src\/ventes\//, /^src\/natif\//];
// Les ancres « qui contiennent tout » : un seul élément chacune dans la page (ou une poignée).
const ANCRES = [['html', /^(?:html|:root)(?![\w-])/], ['body', /^body(?![\w-])/], ['#root', /#root(?![\w-])/], ['.vrm-app-shell', /\.vrm-app-shell(?![\w-])/], ['.vrm-main', /\.vrm-main(?![\w-])/]];
const ATTR = 'data-vrm-d';

// ── Un tout petit lecteur de sélecteurs (parenthèses, crochets, chaînes) ──────────────────────
function finParenthese(s, i) {   // s[i] === '(' ⇒ index de la parenthèse fermante
  let p = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') { k++; continue; }
    if (c === '"' || c === "'") { const q = c; k++; while (k < s.length && s[k] !== q) { if (s[k] === '\\') k++; k++; } continue; }
    if (c === '[') { while (k < s.length && s[k] !== ']') { if (s[k] === '"' || s[k] === "'") { const q = s[k]; k++; while (k < s.length && s[k] !== q) { if (s[k] === '\\') k++; k++; } } k++; } continue; }
    if (c === '(') p++; else if (c === ')') { p--; if (p === 0) return k; }
  }
  return -1;
}
function decouper(s, sep) {   // au niveau 0 (hors parenthèses, crochets, chaînes)
  const out = []; let p = 0, d = 0;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') { k++; continue; }
    if (c === '"' || c === "'") { const q = c; k++; while (k < s.length && s[k] !== q) { if (s[k] === '\\') k++; k++; } continue; }
    if (c === '[') { const f = s.indexOf(']', k); k = f < 0 ? s.length : f; continue; }
    if (c === '(') p++; else if (c === ')') p--;
    else if (p === 0 && sep.includes(c)) { out.push(s.slice(d, k)); d = k + 1; }
  }
  out.push(s.slice(d)); return out;
}
// La spécificité (a, b, c) d'un sélecteur complexe ; d'une liste : la plus forte.
function specificite(sel) {
  let a = 0, b = 0, c = 0; const s = sel;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (ch === '\\') { k++; continue; }
    if (ch === '[') { const f = s.indexOf(']', k); b++; k = f < 0 ? s.length : f; continue; }
    if (ch === '#') { a++; while (k + 1 < s.length && /[\w\\-]/.test(s[k + 1])) k++; continue; }
    if (ch === '.') { b++; while (k + 1 < s.length && /[\w\\-]/.test(s[k + 1])) k++; continue; }
    if (ch === ':') {
      const deux = s[k + 1] === ':'; let j = k + (deux ? 2 : 1); let nom = '';
      while (j < s.length && /[\w-]/.test(s[j])) nom += s[j++];
      if (s[j] === '(') {
        const f = finParenthese(s, j); const dedans = s.slice(j + 1, f);
        if (/^(is|not|has|matches|-webkit-any|-moz-any)$/i.test(nom)) { const m = specListe(dedans); a += m[0]; b += m[1]; c += m[2]; }
        else if (/^where$/i.test(nom)) { /* 0 */ }
        else if (/^(nth-child|nth-last-child)$/i.test(nom)) { b++; const of = dedans.split(/\sof\s/i)[1]; if (of) { const m = specListe(of); a += m[0]; b += m[1]; c += m[2]; } }
        else if (deux) c++; else b++;
        k = f; continue;
      }
      if (deux || /^(before|after|first-line|first-letter)$/i.test(nom)) c++; else b++;
      k = j - 1; continue;
    }
    if (/[a-zA-Z]/.test(ch) && (k === 0 || /[\s>+~(,|]/.test(s[k - 1]))) { c++; while (k + 1 < s.length && /[\w-]/.test(s[k + 1])) k++; continue; }
  }
  return [a, b, c];
}
function specListe(liste) { let m = [0, 0, 0]; for (const x of decouper(liste, ',')) { const v = specificite(x.trim()); if (v[0] > m[0] || (v[0] === m[0] && (v[1] > m[1] || (v[1] === m[1] && v[2] > m[2])))) m = v; } return m; }
const rembourrage = ([a, b, c]) => ':not(#_)'.repeat(a) + ':not(._)'.repeat(b) + ':not(_)'.repeat(c);
const normaliser = (x) => x.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').trim();

// Le composé qui porte le `:has(` placé en `i` : on recule jusqu'au combinateur (niveau 0 de CE groupe).
function debutCompose(s, i) {
  let p = 0;
  for (let k = i - 1; k >= 0; k--) {
    const c = s[k];
    if (c === ']') { const d = s.lastIndexOf('[', k); k = d < 0 ? 0 : d; continue; }
    if (c === ')') { p++; continue; }
    if (c === '(') { if (p === 0) return k + 1; p--; continue; }
    if (p === 0 && /[\s>+~,]/.test(c)) return k + 1;
  }
  return 0;
}
// Dans un composé, le `:has(` est-il au premier niveau (pas dans un :not(…) ou un :is(…) du composé) ?
function niveauZero(compose, pos) { let p = 0; for (let k = 0; k < pos; k++) { const c = compose[k]; if (c === '[') { const f = compose.indexOf(']', k); k = f < 0 ? compose.length : f; continue; } if (c === '(') p++; else if (c === ')') p--; } return p === 0; }
function ancreDe(compose) {
  const nu = compose.replace(/:(?:has|not|is|where)\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, '').replace(/\[[^\]]*\]/g, '');
  for (const [nom, re] of ANCRES) if (re.test(nu)) return nom;
  return null;
}

// Réécrit un sélecteur (une liste entière) ; `drapeau(ancre, arg)` rend le mot du drapeau.
function reecrire(sel, drapeau) {
  let out = sel, n = 0, depuis = 0;
  for (;;) {
    const i = out.indexOf(':has(', depuis);
    if (i < 0) break;
    const f = finParenthese(out, i + 4);
    if (f < 0) break;
    const nie0 = out.slice(i - 5, i) === ':not(' && out[f + 1] === ')';
    const d = debutCompose(out, nie0 ? i - 5 : i);
    // la fin du composé : jusqu'au prochain combinateur
    let e = nie0 ? f + 2 : f + 1; { let p = 0; for (; e < out.length; e++) { const c = out[e]; if (c === '[') { const x = out.indexOf(']', e); e = x < 0 ? out.length : x; continue; } if (c === '(') p++; else if (c === ')') { if (p === 0) break; p--; } else if (p === 0 && /[\s>+~,]/.test(c)) break; } }
    const compose = out.slice(d, e);
    const arg = out.slice(i + 5, f);
    // « :not(:has(ARG)) » porté par l'ancre : le drapeau NIÉ (la spécificité de l'argument est rendue après le :not).
    const nie = nie0 && niveauZero(compose, i - 5 - d);
    const ancre = (nie || niveauZero(compose, i - d)) ? ancreDe(compose) : null;
    if (!ancre) { depuis = f + 1; continue; }
    const mot = drapeau(ancre, normaliser(arg));
    if (nie) { const neuf = `:where([${ATTR}~="${mot}"]))${rembourrage(specListe(arg))}`; out = out.slice(0, i) + neuf + out.slice(f + 2); depuis = i + neuf.length; n++; continue; }
    const neuf = `:where([${ATTR}~="${mot}"])${rembourrage(specListe(arg))}`;
    out = out.slice(0, i) + neuf + out.slice(f + 1);
    depuis = i + neuf.length; n++;
  }
  return { sel: out, n };
}

// ── Les feuilles ─────────────────────────────────────────────────────────────────────────────
function feuilles() { const l = []; const m = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const s = fs.statSync(p); if (s.isDirectory()) m(p); else if (/\.css$/.test(n)) l.push(p); } }; m(SRC); return l.sort(); }
// Parcourt une feuille : rend ses préludes de règles (le texte avant chaque « { » qui n'est pas une at-règle).
function preludes(css) {
  const out = []; let i = 0, debut = 0; const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') { const f = css.indexOf('*/', i + 2); i = f < 0 ? n : f + 2; debut = Math.max(debut, /^\s*$/.test(css.slice(debut, i).replace(/\/\*[\s\S]*?\*\//g, '')) ? i : debut); continue; }
    if (c === '"' || c === "'") { const q = c; i++; while (i < n && css[i] !== q) { if (css[i] === '\\') i++; i++; } i++; continue; }
    if (c === ';' || c === '}') { debut = i + 1; i++; continue; }
    if (c === '{') { const pre = css.slice(debut, i); if (!/^\s*(?:\/\*[\s\S]*?\*\/\s*)*@/.test(pre)) out.push({ d: debut, f: i, texte: pre }); debut = i + 1; i++; continue; }
    i++;
  }
  return out;
}
function table0() {   // les drapeaux déjà attribués (stables d'un passage à l'autre)
  try { const t = fs.readFileSync(TABLE, 'utf8'); const m = t.match(/export const DRAPEAUX = (\[[\s\S]*?\]);/); if (m) return JSON.parse(m[1]); } catch (_) {}
  return [];
}
function passer({ ecrire, tout }) {
  const drapeaux = table0(); const cle = new Map(drapeaux.map((d) => [d.a + '\u0000' + d.s, d.m]));
  const drapeau = (a, s) => { const k = a + '\u0000' + s; if (!cle.has(k)) { const m = 'd' + (drapeaux.length + 1); cle.set(k, m); drapeaux.push({ m, a, s }); } return cle.get(k); };
  const bilan = [];
  for (const f of feuilles()) {
    const rel = path.relative(RACINE, f).split(path.sep).join('/');
    const reservee = RESERVEES.some((re) => re.test(rel));
    const css = fs.readFileSync(f, 'utf8'); if (!css.includes(':has(')) continue;
    const pre = preludes(css); let neuf = css, decal = 0, has = 0, racine = 0; const avant = drapeaux.length;
    for (const p of pre) {
      if (!p.texte.includes(':has(')) continue;
      has += (p.texte.match(/:has\(/g) || []).length;
      const essai = reecrire(p.texte, (a, s) => (reservee && !tout ? 'x' : drapeau(a, s)));
      racine += essai.n;
      if (essai.n && (!reservee || tout)) { neuf = neuf.slice(0, p.d + decal) + essai.sel + neuf.slice(p.f + decal); decal += essai.sel.length - p.texte.length; }
    }
    bilan.push({ f: rel, has, racine, reservee, ecrit: !!(ecrire && racine && (!reservee || tout) && neuf !== css), drapeaux: drapeaux.length - avant });
    if (ecrire && racine && (!reservee || tout) && neuf !== css) fs.writeFileSync(f, neuf);
  }
  if (ecrire) fs.writeFileSync(TABLE, `// ⚠️ Fichier GÉNÉRÉ par \`node scripts/alleger-has.cjs --ecrire\` — ne pas modifier à la main.\n// Chaque drapeau : m = le mot posé dans \`${ATTR}\` de l'ancre a, quand a correspond à \`:has(s)\`.\nexport const DRAPEAUX = ${JSON.stringify(drapeaux, null, 1).replace(/\n\s+/g, ' ').replace(/\}, \{/g, '},\n {')};\n`);
  return { bilan, drapeaux };
}

// ── --prouve : le script s'éprouve ──────────────────────────────────────────────────────────
function prouver() {
  let ko = 0; const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  dit(eq(specificite('.a .b#c > div::before'), [1, 2, 2]), 'spécificité : .a .b#c > div::before = (1,2,2)', JSON.stringify(specificite('.a .b#c > div::before')));
  dit(eq(specificite(':is(.a, #b) :not(.c, d) :where(#z) [x="y"]'), [1, 2, 0]), 'spécificité : :is / :not prennent le plus fort, :where vaut 0', JSON.stringify(specificite(':is(.a, #b) :not(.c, d) :where(#z) [x="y"]')));
  const cas = [
    ['.vrm-main:has(.vrm-fu-colis) .x', 1], ['html:has(.vrm-pp) body::before', 1], ['html[data-design="v2"] body:has(.v2-pouce) .vrm-toasts[data-toasts-place="bas"]', 1],
    ['html body .vrm-app-shell :is(.vrm-main:has(.vrm-fu-colis), .vrm-main .vrm-colis-section) .vrm-colis-carte', 1], ['html:not([data-theme]):has(.vrm-pp)', 1],
    ['.vrm-main:has(.vrm-fu-ecran):not(:has(.vrm-message-workspace)) .y', 2], ['.vrm-sale-row:has(> img) .z', 0], ['div:has(> .a) span', 0], ['#root .v2-aujourdhui:has(> .v2-bande) .v2-pouce', 0],
    ['body:has([data-feuille-cadre], [role="dialog"][aria-modal="true"]) .vrm-tabbar', 1], ['.vrm-app-shell:has(.vrm-main .vrm-fu-journee) > .vrm-app-header', 1],
  ];
  for (const [sel, n] of cas) {
    const mots = []; const r = reecrire(sel, (a, s) => { mots.push(a + ' ⟵ ' + s); return 'd' + mots.length; });
    dit(r.n === n, `« ${sel} » : ${n} drapeau(x)`, `${r.n} · ${r.sel}`);
    dit(eq(specificite(r.sel), specificite(sel)), '   spécificité inchangée', JSON.stringify(specificite(sel)) + ' → ' + JSON.stringify(specificite(r.sel)) + ' · ' + r.sel);
    const deux = reecrire(r.sel, () => 'z');
    dit(deux.n === 0, '   idempotent (un second passage ne réécrit plus ce qui l’a été)', deux.sel);
  }
  const pre = preludes('@media (min-width: 900px) { .a:has(.b) { color: red } }\n/* c */ html:has(.x) body, .q { top: 0 }\n@keyframes k { from { top: 0 } }');
  dit(pre.length >= 2 && pre.some((p) => /html:has\(\.x\) body, \.q/.test(p.texte)) && !pre.some((p) => /@media|@keyframes/.test(p.texte)), 'les préludes : les règles, jamais une at-règle', JSON.stringify(pre.map((p) => p.texte.trim())));
  console.log(ko ? `\n${ko} rouge(s)` : '\nalleger-has : tout est vert');
  process.exit(ko ? 1 : 0);
}

// ── --verifier : deux builds, les mêmes écrans, au pixel ────────────────────────────────────
async function verifier(distA, distB) {
  require('./bancs/_porte-banc.cjs');
  const http = require('http'), zlib = require('zlib'), os = require('os');
  const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
  const { fabriquer, repondre } = require(path.join(__dirname, 'bancs', '_base-volume.cjs'));
  const base = fabriquer({ volumeReel: true, qr: true });
  const DOSSIER = arg('--captures') || fs.mkdtempSync(path.join(os.tmpdir(), 'alleger-has-'));
  fs.mkdirSync(DOSSIER, { recursive: true });
  const ECRANS = (arg('--ecrans') || 'journee,annonces,achats,ventes,compta,messages,garage,settings,dashboard,emails').split(',');
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2' };
  const servir = (dist, port) => http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(dist, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } const t = types[path.extname(p)] || 'application/octet-stream'; r.writeHead(200, { 'content-type': t, 'content-encoding': /javascript|css|html|json|svg/.test(t) ? 'gzip' : 'identity' }); r.end(/javascript|css|html|json|svg/.test(t) ? zlib.gzipSync(fs.readFileSync(p)) : fs.readFileSync(p)); }).listen(port);
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const T0 = Date.now();
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const prendre = async (dist, nom, port) => {
    const srv = servir(dist, port); const out = {};
    for (const [taille, vp] of [['390', { width: 390, height: 844, isMobile: true, hasTouch: true }], ['1512', { width: 1512, height: 950 }]]) {
      const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, reducedMotion: 'reduce' });
      await ctx.addInitScript(() => { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); });
      const pg = await ctx.newPage();
      try { await pg.clock.setFixedTime(new Date(T0)); } catch (_) {}   // l'heure figée : deux builds, les mêmes « il y a 3 min »
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
      await pg.route('**/rest/v1/**', async (route) => { const rq = route.request(); if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base); return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }); });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
      for (const e of ECRANS) {
        await pg.goto(`http://localhost:${port}/?tab=${e}`, { waitUntil: 'commit' });
        const fin = Date.now() + 90000; while (Date.now() < fin) { const ok = await pg.evaluate(() => { const d = document.getElementById('vrm-demarrage'); const a = [...document.querySelectorAll('[data-attente-ecran]')].find((x) => x.getClientRects().length); return !d && !!a && /pret|plafond/.test(a.getAttribute('data-attente') || ''); }).catch(() => false); if (ok) break; await attendre(250); }
        await attendre(6000);
        await pg.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' }).catch(() => {});
        await attendre(400);
        const f = path.join(DOSSIER, `${nom}-${taille}-${e}.png`); await pg.screenshot({ path: f, fullPage: false }); out[`${taille}-${e}`] = f;
      }
      await ctx.close();
    }
    srv.close(); return out;
  };
  const A = await prendre(distA, 'avant', 23811), B = await prendre(distB, 'apres', 23812);
  // Comparaison au pixel dans une page (canvas) : aucune dépendance.
  const pg = await (await b.newContext()).newPage(); let ko = 0;
  for (const k of Object.keys(A)) {
    const r = await pg.evaluate(async ([a, c]) => { const img = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const x = cv.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height); };
      const x = await img(a), y = await img(c); if (x.width !== y.width || x.height !== y.height) return { n: -1 }; let n = 0; for (let i = 0; i < x.data.length; i += 4) if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2]) n++; return { n, total: x.width * x.height }; }, [fs.readFileSync(A[k]).toString('base64'), fs.readFileSync(B[k]).toString('base64')]);
    if (r.n !== 0) ko++;
    console.log(`${r.n === 0 ? 'OK  ' : 'KO  '}${k} : ${r.n === 0 ? 'identique au pixel' : r.n < 0 ? 'tailles différentes' : r.n + ' pixels différents sur ' + r.total}`);
  }
  await b.close();
  console.log(`\n${ko ? ko + ' écran(s) différent(s)' : 'tous les écrans sont identiques au pixel'} — captures : ${DOSSIER}`);
  process.exit(ko ? 1 : 0);
}

if (process.argv.includes('--prouve')) prouver();
else if (process.argv.includes('--verifier')) { const i = process.argv.indexOf('--verifier'); verifier(path.resolve(process.argv[i + 1]), path.resolve(process.argv[i + 2])).catch((e) => { console.error(e); process.exit(2); }); }
else {
  const ecrire = process.argv.includes('--ecrire'), tout = process.argv.includes('--tout');
  const { bilan, drapeaux } = passer({ ecrire, tout });
  const T = bilan.reduce((a, x) => ({ has: a.has + x.has, racine: a.racine + x.racine, libres: a.libres + (x.reservee ? 0 : x.racine), res: a.res + (x.reservee ? x.racine : 0) }), { has: 0, racine: 0, libres: 0, res: 0 });
  console.log('feuille | :has | dont de racine (réécrits par ce script) | réservée');
  for (const x of bilan.filter((y) => y.racine).sort((a, b) => b.racine - a.racine)) console.log(`${x.f} | ${x.has} | ${x.racine} | ${x.reservee ? 'oui' + (tout ? ' (réécrite : --tout)' : ' — pas touchée') : 'non'}${x.ecrit ? ' · écrite' : ''}`);
  console.log(`\nTOTAL : ${T.has} « :has( » dans ${bilan.length} feuilles ; ${T.racine} portés par une ancre de racine (${ANCRES.map((a) => a[0]).join(', ')}) : ${T.libres} dans des feuilles libres, ${T.res} dans des feuilles réservées.`);
  console.log(`Drapeaux distincts (ancre + argument) : ${drapeaux.length}${ecrire ? ' — table écrite : ' + path.relative(RACINE, TABLE) : ' (rien n’est écrit sans --ecrire)'}`);
}
