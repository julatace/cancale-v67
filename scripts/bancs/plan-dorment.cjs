// ════════════════════════════════════════════════════════════════════════════
//  BANC — LE PLAN DU MATIN DES PAIRES QUI DORMENT (24 nov.). docs/passation/2026-11-24-paires-dorment.md
//  Les VRAIS composants et les VRAIES règles montés par outils/natif-plan/ecran.jsx (esbuild, hors du paquet de prod) sur des
//  annonces INVENTÉES. 390 × 844 tactile et 1512 × 900 ; clair et sombre ; bases `lu`, `peu`, `vide`.
//    PL1 le groupe « Plan du matin » : ≤ 8 paires, celles de la règle, dans son ordre, UN bouton chacune, l'action de la règle ;
//    PL2 la photo de CETTE annonce et son N° ; âge, vues, favoris affichés = ceux de la règle ;
//    PL3 « pas su » (vues pas lues) n'est jamais dans le plan ;
//    PL4 toucher un bouton ouvre UNE fois le chemin gardé sur CETTE annonce (son identifiant), rien d'autre ;
//    PL5 un compte sans l'extension connectée (la porte dit non) : bouton éteint, toucher ⇒ rien ne part ;
//    PL6 « Pourquoi ? » dit les seuils (nombres de la règle) et qu'aucun effet n'est promis ;
//    PL7 base `peu` : « pas assez de recul », aucune paire ; base `vide` : aucun groupe ;
//    PL8 aucun orange ; le compte « N paires dorment » ne double pas le plan ;
//    N   ni NaN ni clé brute, aucun débordement horizontal, rangées et boutons ≥ 44 px au téléphone, aucune erreur de page.
//  Mutations (`MUTATION=passu|orange|porte|deuxfois`) : chacune rougit sa mesure. `SHOTS=dossier`.
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
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-plan-dorment'); fs.mkdirSync(SHOTS, { recursive: true });
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'natif-plan-'));
const MUT = process.env.MUTATION || '';
const MUTS = {
  passu: ['src/conseiller/planDorment.js', "if (m.vj == null || m.fj == null) return 'passu';", "if (m.fj == null) return 'passu';"],
  orange: ['src/conseiller/PlanDorment.jsx', '<Bouton variante="teinte"', '<Bouton variante="teinte" ton="ambre"'],
  deuxfois: ['src/conseiller/PlanDorment.jsx', "onClick={() => { if (!bloque && onAgir) onAgir(l); }}", "onClick={() => { if (onAgir) { onAgir(l); onAgir(l); } }}"],
};
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  const mu = MUT && MUTS[MUT] ? MUTS[MUT] : null;
  const plugins = mu ? [{ name: 'mutant', setup(b) { b.onLoad({ filter: /\.(jsx?)$/ }, (a) => { if (path.resolve(a.path) !== path.join(RACINE, mu[0])) return undefined; const t = fs.readFileSync(a.path, 'utf8'); if (!t.includes(mu[1])) throw new Error('motif de mutation absent'); return { contents: t.replace(mu[1], mu[2]), loader: 'jsx' }; }); } }] : [];
  return esbuild.build({ entryPoints: [path.join(RACINE, 'outils', 'natif-plan', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'vrm-icones-app': gen }, external: ['/brands/*'], nodePaths: [NM], logLevel: 'error', plugins })
    .then(() => fs.copyFileSync(path.join(RACINE, 'outils', 'natif-plan', 'index.html'), path.join(DOSSIER, 'index.html')));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = () => new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }); s.listen(0, () => res(s)); });

async function ouvrir(nav, port, { W, sombre, base }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: W, height: 900 } }), deviceScaleFactor: 1, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  const sorties = []; await pg.route('**/*', (r) => { const u = r.request().url(); if (!u.startsWith(`http://localhost:${port}`) && !u.startsWith('data:')) { sorties.push(u); return r.abort(); } return r.continue(); });
  await pg.goto(`http://localhost:${port}/?base=${base}${sombre ? '&theme=dark' : ''}${MUT === 'porte' ? '&mutation=porte' : ''}`, { waitUntil: 'load' });
  await pg.waitForSelector('[data-cons-ecran]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(500);
  return { ctx, pg, erreurs, tel, sorties };
}
// Une couleur « orange » : teinte 15–50°, saturée.
const ORANGE = () => {
  const hsl = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); if (!m) return null; let [r, g, b] = m.slice(1, 4).map((x) => x / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return { h: 0, s: 0 }; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; const l = (mx + mn) / 2; return { h, s: d / (1 - Math.abs(2 * l - 1)) }; };
  const out = [];
  for (const el of document.querySelectorAll('[data-cons-groupe="plan"], [data-cons-groupe="plan"] *')) {
    const cs = getComputedStyle(el);
    for (const c of [cs.color, cs.backgroundColor, cs.borderTopColor]) { const x = hsl(c); if (x && x.s > 0.45 && x.h >= 15 && x.h <= 50 && !/rgba\(.*, 0\)/.test(c)) out.push(el.tagName + ':' + c); }
  }
  return out.slice(0, 5);
};

async function passe(nav, port, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `${W} ${th}`;
  let A = await ouvrir(nav, port, { W, sombre, base: 'lu' });
  try {
    const r = await A.pg.evaluate(() => {
      const P = window.__PLAN;
      const L = [...document.querySelectorAll('[data-plan-ligne]')].map((x) => ({ cle: x.getAttribute('data-plan-ligne'), action: x.getAttribute('data-plan-action'), sugg: x.getAttribute('data-plan-sugg'), bloque: x.getAttribute('data-plan-bloque'),
        boutons: x.querySelectorAll('button[data-plan-bouton]').length, img: (x.querySelector('img') || {}).src || '', texte: x.innerText, haut: Math.round(x.getBoundingClientRect().height),
        bh: Math.round((x.querySelector('button[data-plan-bouton]') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height) }));
      return { P, L, groupe: !!document.querySelector('[data-cons-groupe="plan"]'), dorment: !!document.querySelector('[data-cons="dorment"]') };
    });
    const P = r.P;
    dit(r.groupe && P && P.lignes.length > 0 && r.L.length === P.lignes.length && r.L.length <= 8 && r.L.every((x, i) => x.cle === P.lignes[i].cle && x.action === P.lignes[i].action.k && x.boutons === 1),
      `PL1 ${ou} : le plan montre les ${r.L.length} paires de la règle, dans son ordre, UN bouton et l'action de la règle chacune`, r.L.map((x) => x.action));
    dit(r.L.some((x) => x.action === 'baisser' && x.sugg) && r.L.every((x, i) => x.action !== 'baisser' || Number(x.sugg) === P.lignes[i].action.sugg), `PL1 ${ou} : « Baisser à X € » porte la baisse de la règle`, r.L.filter((x) => x.action === 'baisser'));
    const okPhoto = r.L.every((x, i) => decodeURIComponent(x.img) === decodeURIComponent(P.lignes[i].photo) && x.texte.includes(P.lignes[i].numero) && x.texte.includes(String(P.lignes[i].age)) && x.texte.includes(String(P.lignes[i].vues)) && x.texte.includes(String(P.lignes[i].favoris)));
    dit(okPhoto, `PL2 ${ou} : la photo de CETTE annonce, son N°, son âge, ses vues et favoris (ceux de la règle)`);
    dit(!r.L.some((x) => x.cle.endsWith(':7300009999')) && window && true, `PL3 ${ou} : la paire aux vues PAS LUES n'est pas dans le plan`, r.L.map((x) => x.cle));
    dit(!r.dorment, `PL8 ${ou} : le compte « N paires dorment » ne double pas le plan`);
    const n = await A.pg.evaluate(() => ({ brut: /NaN|undefined|\bcplan\.|\bcons\.[a-z]/.test(document.body.innerText), deborde: document.documentElement.scrollWidth > innerWidth + 1 }));
    dit(!n.brut && !n.deborde, `N ${ou} : ni NaN ni clé brute, aucun débordement horizontal`, n);
    if (A.tel) dit(r.L.every((x) => x.haut >= 44 && x.bh >= 44), `N ${ou} : rangées et boutons ≥ 44 px au doigt`, r.L.map((x) => [x.haut, x.bh]));
    const orange = await A.pg.evaluate(ORANGE);
    const ambre = await A.pg.evaluate(() => document.querySelectorAll('[data-cons-groupe="plan"] [data-n-ton="ambre"], [data-cons-groupe="plan"] [data-n-ton="ambre-plein"], [data-cons-groupe="plan"] [data-n-bouton-ton="ambre"]').length);
    dit(!orange.length && !ambre, `PL8 ${ou} : aucun orange dans le plan`, { orange, ambre });
    await A.pg.locator('[data-cons-groupe="plan"]').screenshot({ path: path.join(SHOTS, `plan-${W}-${th}.png`) });
    await A.pg.screenshot({ path: path.join(SHOTS, `ecran-${W}-${th}.png`), fullPage: true });
    // PL4 — un toucher, UN chemin, CETTE annonce.
    const i = r.L.findIndex((x) => !x.bloque);
    await A.pg.locator('button[data-plan-bouton]').nth(i).click();
    await A.pg.waitForTimeout(150);
    const o = await A.pg.evaluate(() => ({ o: window.__OUVERTS.slice(), e: window.__EBAY.slice() }));
    const id = P.lignes[i].id, k = P.lignes[i].action.k;
    const attendu = k === 'ebay' ? o.e.length === 1 && o.e[0] === id && !o.o.length : o.o.length === 1 && !o.e.length && o.o[0].ids.length === 1 && o.o[0].ids[0] === id;
    dit(attendu, `PL4 ${ou} : toucher « ${k} » ouvre UNE fois le chemin gardé sur CETTE annonce`, o);
    // PL5 — le second compte n'a pas l'extension connectée : éteint, rien ne part.
    const j = r.L.findIndex((x) => x.cle.startsWith('3100000002:'));
    const b = await A.pg.evaluate((jj) => { const x = document.querySelectorAll('[data-plan-ligne]')[jj]; const bt = x && x.querySelector('button[data-plan-bouton]'); return { bloque: x && x.getAttribute('data-plan-bloque'), dis: bt && (bt.disabled || bt.getAttribute('aria-disabled') === 'true') }; }, j);
    if (j >= 0) { await A.pg.locator('button[data-plan-bouton]').nth(j).click({ force: true }).catch(() => {}); await A.pg.waitForTimeout(150); }
    const apres = await A.pg.evaluate(() => window.__OUVERTS.length + window.__EBAY.length);
    dit(j >= 0 && b.bloque === '1' && b.dis && apres === 1, `PL5 ${ou} : compte sans extension connectée ⇒ bouton éteint, rien ne part`, { j, b, apres });
    // PL6 — « Pourquoi ? ».
    await A.pg.click('[data-plan-pourquoi]');
    const pq = await A.pg.evaluate(() => { const e = document.querySelector('[data-plan-explication]'); return e ? e.innerText : ''; });
    const S = P.seuils;
    dit(/14 jours/.test(pq) && pq.includes(String(S.n)) && /Aucun effet promis/.test(pq) && /quart le plus bas/.test(pq), `PL6 ${ou} : « Pourquoi ? » dit les seuils de SES annonces (${S.n}) et ne promet aucun effet`, pq.slice(0, 200));
    await A.pg.locator('[data-cons-groupe="plan"]').screenshot({ path: path.join(SHOTS, `plan-pourquoi-${W}-${th}.png`) });
    dit(!A.erreurs.length && !A.sorties.length, `N ${ou} : aucune erreur de page, aucune requête sortante`, { e: A.erreurs, s: A.sorties });
  } finally { await A.ctx.close(); }
  A = await ouvrir(nav, port, { W, sombre, base: 'peu' });
  try {
    const r = await A.pg.evaluate(() => ({ g: !!document.querySelector('[data-cons-groupe="plan"]'), n: document.querySelectorAll('[data-plan-ligne]').length, t: (document.querySelector('.n-plan-phrase') || {}).innerText || '' }));
    dit(r.g && r.n === 0 && /Pas assez de recul/.test(r.t), `PL7 ${ou} : trop peu d'annonces comparables ⇒ « pas assez de recul », aucune paire`, r);
    if (W < 600 && !sombre) await A.pg.locator('[data-cons-groupe="plan"]').screenshot({ path: path.join(SHOTS, `plan-peu-${W}-${th}.png`) });
  } finally { await A.ctx.close(); }
  A = await ouvrir(nav, port, { W, sombre, base: 'vide' });
  try {
    const r = await A.pg.evaluate(() => !!document.querySelector('[data-cons-groupe="plan"]'));
    dit(!r, `PL7 ${ou} : rien de publié ⇒ aucun groupe « Plan du matin »`);
  } finally { await A.ctx.close(); }
}

(async () => {
  try { await construire(); } catch (e) { dit(false, 'les écrans se construisent (esbuild)', String(e.message || e).slice(0, 600)); process.exit(1); }
  const s = await servir(); const port = s.address().port;
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try { for (const W of LARGEURS) for (const th of THEMES) await passe(nav, port, W, th === 'sombre'); }
  finally { await nav.close(); s.close(); fs.rmSync(DOSSIER, { recursive: true, force: true }); }
  console.log(`\n${ko ? '❌' : '✅'} banc plan-dorment${MUT ? ' [MUTATION=' + MUT + ']' : ''} : ${ok} verts, ${ko} rouge(s) · captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
