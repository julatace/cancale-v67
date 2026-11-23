// ════════════════════════════════════════════════════════════════════════════
//  BANC — LE CONSEILLER (23 nov.). docs/passation/2026-11-23-conseiller.md
//  Les VRAIS composants et les VRAIES règles montés par outils/natif-conseiller/ecran.jsx (esbuild, hors du paquet de
//  prod) sur des données INVENTÉES. 390 × 844 tactile et 1512 × 900 ; clair et sombre ; bases `lu` et `vide`.
//    K1 la carte d'Aujourd'hui : 3 conseils au plus, les PREMIERS de la règle, dans son ordre ; « Tout voir » ;
//    K2 sans données suffisantes : AUCUNE carte (jamais une carte vide) ; l'écran dit « rien à conseiller » ;
//    K3 l'écran : tous les conseils, chacun son geste ; toucher le geste rend LE geste de la règle (rien d'autre) ;
//    K4 les chiffres affichés = ceux de la règle (data-cons-chiffres recopie la règle, le texte porte ses nombres) ;
//    K5 aucune requête vers /api/ai sans SA clé (l'écran charge, rien ne part) ;
//    N  aucun NaN / undefined / clé tr brute, aucun débordement horizontal, rangées ≥ 44 px, aucune erreur de page.
//  Mutations (`MUTATION=carte5|cartevide`) appliquées à la SOURCE : chacune rougit sa mesure. `SHOTS=dossier`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number), THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-conseiller'); fs.mkdirSync(SHOTS, { recursive: true });
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'natif-conseiller-'));
const MUT = process.env.MUTATION || '';
const MUTS = {
  carte5: ['src/conseiller/regles.js', 'export const MAX_CARTE = 3;', 'export const MAX_CARTE = 5;'],
  cartevide: ['src/conseiller/Conseiller.jsx', "  if (!Array.isArray(liste) || !liste.length) return null;\n  const L = pourCarte(liste);", '  const L = pourCarte(liste || []);'],
};
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  const mu = MUT ? MUTS[MUT] : null;
  const plugins = mu ? [{ name: 'mutant', setup(b) { b.onLoad({ filter: /\.(jsx?)$/ }, (a) => { if (path.resolve(a.path) !== path.join(RACINE, mu[0])) return undefined; const t = fs.readFileSync(a.path, 'utf8'); if (!t.includes(mu[1])) throw new Error('motif de mutation absent'); return { contents: t.replace(mu[1], mu[2]), loader: 'jsx' }; }); } }] : [];
  return esbuild.build({ entryPoints: [path.join(RACINE, 'outils', 'natif-conseiller', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'vrm-icones-app': gen }, external: ['/brands/*'], nodePaths: [NM], logLevel: 'error', plugins })
    .then(() => fs.copyFileSync(path.join(RACINE, 'outils', 'natif-conseiller', 'index.html'), path.join(DOSSIER, 'index.html')));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = () => new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }); s.listen(Number(process.env.BANC_PORT) || 0, () => res(s)); });

// Le réseau d'essai : la clé du vendeur (aucune · posée) et la route de l'IA, comptées.
async function ouvrir(nav, port, { W, sombre, base, vue, cle = 'aucune' }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: W, height: 900 } }), deviceScaleFactor: 1, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  const appelsIA = [];
  await pg.route('**/api/compte?mode=claude', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cle === 'posee' ? { ok: true, etat: 'posee', fin: 'a1b2' } : { ok: true, etat: 'aucune' }) }));
  await pg.route('**/api/ai**', (r) => { appelsIA.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, reponse: 'Baisse d’abord les 5 paires conseillées : elles dorment depuis plus de 30 jours.', chiffres: [{ libelle: 'Baisses conseillées', valeur: '5' }], geste: 'baisses', cout: 0.00041 }) }); });
  await pg.goto(`http://localhost:${port}/?vue=${vue}&base=${base}${sombre ? '&theme=dark' : ''}`, { waitUntil: 'load' });
  await pg.waitForSelector('.n-coque, [data-cons-ecran], [data-banc-carte]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(600);
  return { ctx, pg, erreurs, tel, appelsIA };
}
const NATIF = () => {
  const txt = document.body.innerText;
  const rangees = [...document.querySelectorAll('[data-cons]')].map((x) => x.getBoundingClientRect().height);
  return { nan: /NaN|undefined|\bcons\.[a-z]|\bia\.[a-z]/.test(txt), deborde: document.documentElement.scrollWidth > innerWidth + 1, petites: rangees.filter((h) => h < 44).length };
};

async function passe(nav, port, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `${W} ${th}`;
  // K1 — la carte, base lue.
  let A = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'carte' });
  try {
    const r = await A.pg.evaluate(() => ({ L: window.__CONSEILS.map((c) => ({ id: c.id, geste: c.geste, chiffres: JSON.stringify(c.chiffres) })), ids: [...document.querySelectorAll('[data-banc-carte] [data-cons]')].map((x) => x.getAttribute('data-cons')),
      n: (document.querySelector('[data-v2-bloc="conseils"]') || { getAttribute: () => '' }).getAttribute('data-cons-n'), tout: !!document.querySelector('[data-cons-tout]') }));
    dit(r.L.length >= 5 && r.ids.length === 3 && r.ids.join() === r.L.slice(0, 3).map((x) => x.id).join() && r.n === String(r.L.length) && r.tout,
      `K1 ${ou} : la carte montre les 3 PREMIERS conseils de la règle (${r.ids.join(', ')}) sur ${r.L.length}, et « Tout voir »`, r);
    await A.pg.screenshot({ path: path.join(SHOTS, `carte-${W}-${th}.png`), fullPage: true });
    const n = await A.pg.evaluate(NATIF); dit(!n.nan && !n.deborde && !n.petites, `N ${ou} carte : ni NaN ni clé brute, aucun débordement, rangées ≥ 44`, n);
    dit(!A.erreurs.length, `${ou} carte : aucune erreur de page`, A.erreurs);
  } finally { await A.ctx.close(); }
  // K2 — sans données : aucune carte ; l'écran le dit.
  A = await ouvrir(nav, port, { W, sombre, base: 'vide', vue: 'carte' });
  try {
    const r = await A.pg.evaluate(() => ({ L: window.__CONSEILS.length, carte: !!document.querySelector('[data-v2-bloc="conseils"]') }));
    dit(r.L === 0 && !r.carte, `K2 ${ou} : rien de lu ⇒ aucun conseil, AUCUNE carte (jamais une carte vide)`, r);
  } finally { await A.ctx.close(); }
  A = await ouvrir(nav, port, { W, sombre, base: 'vide', vue: 'ecran' });
  try {
    const r = await A.pg.evaluate(() => ({ lignes: document.querySelectorAll('[data-cons]').length, vide: /Rien à te conseiller/.test(document.body.innerText) }));
    dit(r.lignes === 0 && r.vide, `K2 ${ou} : l'écran dit « Rien à te conseiller aujourd’hui », aucune ligne`, r);
    dit(A.appelsIA.length === 0, `K5 ${ou} : écran vide, aucune requête IA`, A.appelsIA.length);
    await A.pg.screenshot({ path: path.join(SHOTS, `ecran-vide-${W}-${th}.png`), fullPage: true });
  } finally { await A.ctx.close(); }
  // K3/K4 — l'écran, base lue.
  A = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'ecran' });
  try {
    const r = await A.pg.evaluate(() => ({ L: window.__CONSEILS.map((c) => ({ id: c.id, geste: c.geste, chiffres: JSON.stringify(c.chiffres || {}), params: c.params })),
      lignes: [...document.querySelectorAll('[data-cons]')].map((x) => ({ id: x.getAttribute('data-cons'), chiffres: x.getAttribute('data-cons-chiffres'), texte: x.innerText, bouton: !!x.querySelector('[data-cons-bouton]') })) }));
    dit(r.lignes.length === r.L.length && r.lignes.every((x, i) => x.id === r.L[i].id && x.bouton), `K3 ${ou} : l'écran montre les ${r.L.length} conseils dans l'ordre de la règle, chacun son bouton`, r.lignes.map((x) => x.id));
    const nombres = r.lignes.every((x, i) => x.chiffres === r.L[i].chiffres && (r.L[i].params.n == null || x.texte.includes(String(r.L[i].params.n))));
    dit(nombres, `K4 ${ou} : chaque chiffre affiché = celui de la règle (attribut et texte)`, r.lignes.map((x, i) => [x.id, x.chiffres === r.L[i].chiffres, r.L[i].params.n]));
    await A.pg.locator('[data-cons-bouton]').nth(1).click();
    const g = await A.pg.evaluate(() => window.__GESTES.slice());
    dit(g.length === 1 && g[0] === r.L[1].geste, `K3 ${ou} : toucher le 2e conseil rend SON geste (« ${r.L[1].geste} »), rien d'autre`, g);
    dit(A.appelsIA.length === 0, `K5 ${ou} : sans SA clé, l'écran charge et aucune requête IA ne part`, A.appelsIA.length);
    await A.pg.screenshot({ path: path.join(SHOTS, `ecran-${W}-${th}.png`), fullPage: true });
    const n = await A.pg.evaluate(NATIF); dit(!n.nan && !n.deborde && !n.petites, `N ${ou} écran : ni NaN ni clé brute, aucun débordement, rangées ≥ 44`, n);
    dit(!A.erreurs.length, `${ou} écran : aucune erreur de page`, A.erreurs);
  } finally { await A.ctx.close(); }
  if (typeof global.passeIA === 'function') await global.passeIA({ nav, port, W, sombre, ou, th, ouvrir, dit, SHOTS });
}

(async () => {
  try { await construire(); } catch (e) { dit(false, 'les écrans se construisent (esbuild)', String(e.message || e).slice(0, 600)); process.exit(1); }
  try { require(path.join(__dirname, '_conseiller-ia.cjs')); } catch (_) { /* tranche 2 absente */ }
  const s = await servir(); const port = s.address().port;
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try { for (const W of LARGEURS) for (const th of THEMES) await passe(nav, port, W, th === 'sombre'); }
  finally { await nav.close(); s.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc conseiller${MUT ? ' [MUTATION=' + MUT + ']' : ''} : ${ok} verts, ${ko} rouge(s) · captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
