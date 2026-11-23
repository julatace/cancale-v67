// ═══════════════════════════════════════════════════════════
//  BANC — « À REPUBLIER EN PRIORITÉ » (21 nov., choix n° 12 de Julien)
//
//  Construit outils/prio-recherche/ (esbuild, hors paquet de prod) : l'écran Annonces natif et sa vue « À republier »,
//  nourris par les VRAIES règles (src/articles/, src/republierPriorite.js) sur une base INVENTÉE — 4 comptes Vinted (dont un
//  PERSONNEL et un BLOQUÉ), une paire vendue sur Leboncoin, une masquée, une en retour — et la rangée d'Aujourd'hui.
//  Mesures (data-* et nombres, jamais un libellé) — 390 × 844 tactile (DPR 3) et 1512 × 900, clair et sombre :
//   S  le segment « À republier » existe, il porte le nombre du jour ;
//   L  la liste : classée (rang 1, 2, 3…), chaque ligne dit sa raison chiffrée (jours · vues · favoris), aucune paire
//      vendue, masquée, en litige, d'un compte bloqué ou personnel ; « pas lu » dit, jamais 0 ;
//   G  RIEN NE PART SANS SON TOUCHER : à l'arrivée et 2 s après, aucune ouverture ; les lignes du 1er compte sont cochées ;
//      « Republier N » ouvre l'atelier Republier du panneau avec CES identifiants ; cocher une ligne d'un autre compte
//      ⇒ le plein refuse et dit pourquoi (aucune ouverture) ;
//   R  les réglages (âge mini 60 j) changent la liste ;
//   A  Aujourd'hui : « N paires à republier en priorité › » (seulement si la publication propose une paire), le toucher
//      ouvre Annonces sur « À republier » ;
//   D  design : aucune capitale, aucune carte arrondie autour de la liste, cibles ≥ 44, contrastes ≥ 4,5:1, aucun
//      débordement, le rouge seulement sur un doublon de N°.
//  Sur l'arbre d'avant (git archive) il ROUGIT : la vue n'existe pas (la construction échoue — « aucun segment »).
//  SHOTS : le dossier des captures. BANC_PORT (4796 par défaut).
// ═══════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 4796;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-republier-priorite');
const DOSSIER = path.join(os.tmpdir(), 'banc-republier-priorite-build-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DOSSIER, { recursive: true });
let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) { verts++; console.log('  ✅ ' + quoi); } else { rouges++; console.log('  ❌ ' + quoi + (d !== undefined ? '\n       ' + JSON.stringify(d).slice(0, 600) : '')); } return ok; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx');
  fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'prio-recherche', 'banc.jsx')], bundle: true, outfile: path.join(DOSSIER, 'banc.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file', '.svg': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    external: ['/brands/*'], alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'silent' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'prio-recherche', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
const servir = () => new Promise((ok) => { const s = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const ph = /^\/photo\/(\d+)\.svg$/.exec(u);
  if (ph) { const i = Number(ph[1]); res.writeHead(200, { 'content-type': 'image/svg+xml' });
    res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="hsl(${(i * 47) % 360},22%,62%)"/><ellipse cx="150" cy="190" rx="110" ry="46" fill="hsl(${(i * 47 + 180) % 360},30%,40%)"/></svg>`); return; }
  if (/^\/brands\//.test(u)) { const f = path.join(RACINE, 'public', u); res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end(fs.existsSync(f) ? fs.readFileSync(f) : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>'); return; }
  const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }); s.listen(PORT, () => ok(s)); });

const MESURE = () => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const lire = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const sur = (c, f) => ({ r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a), a: 1 });
  const fondDe = (el) => { const pile = []; for (let e = el; e; e = e.parentElement) { const c = lire(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } } let f = { r: 255, g: 255, b: 255, a: 1 }; if (document.documentElement.getAttribute('data-theme') === 'dark') f = { r: 0, g: 0, b: 0, a: 1 }; for (const c of pile.reverse()) f = sur(c, f); return f; };
  const vis = (b) => b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight;
  const zone = document.querySelector('[data-prio-ecran]') || document.body;
  const r = { contrastes: [], cibles: [], rouges: [], debord: document.scrollingElement.scrollWidth - innerWidth };
  const w = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const el = t.parentElement; if (!t.nodeValue.trim() || !el) continue; const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || !vis(b) || el.closest('[aria-hidden="true"],[hidden],.n-eg-sr')) continue;
    const c = lire(cs.color); if (!c) continue; const fd = fondDe(el); const x = sur({ ...c, a: c.a * Number(cs.opacity || 1) }, fd); const L1 = lum(x), L2 = lum(fd); const k = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (k < 4.5) r.contrastes.push({ t: t.nodeValue.trim().slice(0, 24), k: Math.round(k * 100) / 100 });
  }
  for (const el of document.querySelectorAll('[data-prio-ecran] button, [data-prio-ecran] [role="checkbox"], [data-prio-ecran] input, [data-prio-lancer], [data-eg-segment]')) {
    const b = el.getBoundingClientRect(); if (!vis(b) || el.closest('[hidden],[aria-hidden="true"]')) continue;
    if (b.width < 44 || b.height < 44) r.cibles.push({ q: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24), w: Math.round(b.width), h: Math.round(b.height) });
  }
  const rouge = (s) => { const c = lire(s); return c && c.a > 0.5 && c.r > 180 && c.g < 90 && c.b < 90; };
  for (const el of zone.querySelectorAll('*')) { const cs = getComputedStyle(el); if ((rouge(cs.color) && el.textContent.trim()) || rouge(cs.backgroundColor)) { if (!el.closest('.n-plaque[data-n-doublon]')) r.rouges.push(el.className || el.tagName); } }
  const L = [...document.querySelectorAll('[data-prio-ligne]')];
  r.lignes = L.map((e) => ({ id: e.getAttribute('data-prio-annonce'), rang: Number(e.getAttribute('data-prio-rang')), coche: e.getAttribute('data-prio-coche'), vues: e.getAttribute('data-prio-vues'), fav: e.getAttribute('data-prio-favoris'),
    sous: ((e.querySelector('.n-rangee-sous, [class*="sous"]') || {}).textContent || e.textContent || '').slice(0, 120), compte: (e.closest('[data-prio-compte]') || { getAttribute: () => '' }).getAttribute('data-prio-compte') }));
  const seg = document.querySelector('[data-eg-segment="arepublier"]');
  r.segment = seg ? (seg.getAttribute('data-eg-segment-n') || '') : null;
  const plein = document.querySelector('[data-prio-lancer]');
  r.plein = plein ? { n: plein.getAttribute('data-prio-lancer'), ok: plein.getAttribute('data-prio-ok'), refus: plein.getAttribute('data-prio-refus') } : null;
  r.capitales = [...zone.querySelectorAll('*')].filter((e) => getComputedStyle(e).textTransform === 'uppercase' && e.textContent.trim()).length;
  r.listesArrondies = [...document.querySelectorAll('.n-rp-liste')].filter((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) > 0).length;
  const ec = document.querySelector('[data-prio-ecran]');
  r.ecran = ec ? { n: ec.getAttribute('data-prio-n'), jours: ec.getAttribute('data-prio-jours'), etat: ec.getAttribute('data-prio-etat') } : null;
  r.ouvertures = (window.__ouvertures || []).slice();
  r.coupes = [...document.querySelectorAll('.n-segmente-libelle')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
  r.sousCoupes = [...document.querySelectorAll('[data-prio-ligne] *')].filter((e) => e.children.length === 0 && /\d+ j ·/.test(e.textContent) && e.scrollWidth > e.clientWidth + 1).length;
  r.pied = (document.querySelector('[data-prio-pied]') || {}).getAttribute ? document.querySelector('[data-prio-pied]').getAttribute('data-prio-exclues') : null;
  return r;
};
const TEL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true };
const ORDI = { viewport: { width: 1512, height: 900 } };
async function ouvrir(nav, opts, q) {
  const ctx = await nav.newContext(opts); const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.goto(`http://127.0.0.1:${PORT}/${q}`);
  try { await pg.waitForSelector('[data-eg-ecran], [data-prio-journee], [data-v2-bloc]', { timeout: 20000 }); } catch (_) {}
  if (opts.isMobile) await pg.addStyleTag({ content: ':root{--n-zone-haut:47px;--n-zone-bas:34px}' });
  await pg.waitForTimeout(400); return { ctx, pg, erreurs };
}

(async () => {
  try { construire(); } catch (e) { dit(false, 'la page du banc se construit (la vue « À republier » existe)', String(e.message).slice(0, 300)); console.log(`\n${verts} verts, ${rouges} rouges`); process.exit(1); }
  const srv = await servir();
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const [nomV, V] of [['390', TEL], ['1512', ORDI]]) for (const sombre of [false, true]) {
      const ou = nomV + (sombre ? ' · sombre' : '');
      console.log('── ' + ou);
      const { ctx, pg, erreurs } = await ouvrir(nav, V, `?vue=annonces&etat=arepublier${sombre ? '&theme=dark' : ''}`);
      const r0 = await pg.evaluate(MESURE);
      const regle = await pg.evaluate(() => window.__banc.prio);
      dit(r0.segment != null && Number(r0.segment) === regle.ids.length, `S ${ou} : le segment « À republier » · ${r0.segment}`, { seg: r0.segment, regle: regle && regle.ids.length });
      // Un intertitre par compte (l'atelier agit au nom d'UN compte) : dans chaque compte l'ordre de la règle ; les comptes dans l'ordre de leur 1re ligne.
      const parCompte = []; for (const l of r0.lignes) { let g = parCompte.find((x) => x.c === l.compte); if (!g) parCompte.push(g = { c: l.compte, rangs: [] }); g.rangs.push(l.rang); }
      const ordreOk = parCompte.every((g) => g.rangs.every((x, i) => i === 0 || x > g.rangs[i - 1])) && parCompte.every((g, i) => i === 0 || g.rangs[0] > parCompte[i - 1].rangs[0]);
      dit(r0.lignes.length === regle.ids.length && [...r0.lignes.map((l) => l.id)].sort().join() === [...regle.ids].sort().join() && ordreOk && parCompte[0].rangs[0] === 1,
        `L ${ou} : ${r0.lignes.length} lignes, celles de la règle, classées (rang 1 en tête, l'ordre gardé dans chaque compte)`, { vu: r0.lignes.map((l) => l.id + '#' + l.rang), regle: regle.ids });
      const interdits = ['10005', '10008', '10013', '10030', '10031', '10040', '10041', '10010', '10011', '10012'];
      dit(!r0.lignes.some((l) => interdits.includes(l.id)) && r0.pied === 'vendue:1,masquee:1,litige:1,bloque:2,perso:2', `L ${ou} : ni vendue, ni masquée, ni en retour, ni compte bloqué ou personnel, ni trop récente — écartées comptées`, { pied: r0.pied, ids: r0.lignes.map((l) => l.id) });
      dit(r0.lignes.every((l) => /\d+ j · /.test(l.sous)) && r0.lignes.some((l) => /vues pas lues · favoris pas lus/.test(l.sous)) && r0.lignes.some((l) => /vues qui baissent/.test(l.sous)), `L ${ou} : chaque ligne dit sa raison chiffrée ; « pas lues » dit (jamais 0) ; « vues qui baissent » sur le journal`, r0.lignes.slice(0, 3).map((l) => l.sous));
      const c1 = r0.lignes.filter((l) => l.compte === r0.lignes[0].compte);
      dit(r0.lignes.filter((l) => l.coche === '1').length === c1.length && c1.every((l) => l.coche === '1') && r0.plein && r0.plein.ok === '1' && Number(r0.plein.n) === c1.length, `G ${ou} : les ${c1.length} lignes du 1er compte cochées, « Republier ${c1.length} » prêt`, { plein: r0.plein, coches: r0.lignes.map((l) => l.coche).join('') });
      await pg.waitForTimeout(2000);
      dit((await pg.evaluate(() => window.__ouvertures.length)) === 0, `G ${ou} : RIEN n'est ouvert sans son toucher (à l'arrivée et 2 s après)`);
      dit(r0.capitales === 0 && r0.listesArrondies === 0, `D ${ou} : aucune capitale, aucune carte arrondie autour de la liste`, { cap: r0.capitales, arr: r0.listesArrondies });
      dit(r0.cibles.length === 0, `D ${ou} : cibles ≥ 44 × 44`, r0.cibles.slice(0, 6));
      dit(r0.contrastes.length === 0, `D ${ou} : contrastes ≥ 4,5:1`, r0.contrastes.slice(0, 6));
      dit(r0.coupes.length === 0 && r0.sousCoupes === 0, `D ${ou} : aucun segment ni raison coupés`, { c: r0.coupes, s: r0.sousCoupes });
      dit(r0.rouges.length === 0 && r0.debord <= 0, `D ${ou} : aucun rouge, aucun débordement`, { rouges: r0.rouges.slice(0, 4), d: r0.debord });
      await pg.screenshot({ path: path.join(SHOTS, `arepublier-${nomV}${sombre ? '-sombre' : ''}.png`) });
      if (!sombre && nomV === '390') { await pg.evaluate(() => window.scrollTo(0, 99999)); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `arepublier-390-bas.png`) }); await pg.evaluate(() => window.scrollTo(0, 0)); }
      // Le geste : « Republier N » ⇒ l'atelier Republier, ces identifiants.
      await pg.click('[data-prio-lancer]'); await pg.waitForTimeout(300);
      const ouv = await pg.evaluate(() => window.__ouvertures.slice());
      const ids1 = c1.map((l) => l.id).join(',');
      dit(ouv.length === 1 && ouv[0] === `https://www.vinted.fr/?vrm=panneau&page=republier&ids=${ids1}&action=republier`, `G ${ou} : SON toucher ouvre l'atelier Republier du panneau, ces ${c1.length} annonces`, ouv);
      // Une ligne d'un AUTRE compte cochée ⇒ refus nommé, rien d'ouvert.
      const autre = r0.lignes.find((l) => l.compte !== r0.lignes[0].compte);
      if (dit(!!autre, `G ${ou} : la liste a un second compte`)) {
        const caseAutre = pg.locator(`[data-prio-annonce="${autre.id}"] .n-rangee-case`).first();
        await caseAutre.evaluate((e) => e.scrollIntoView({ block: 'center' })); await pg.waitForTimeout(200);
        await caseAutre.click();
        await pg.waitForTimeout(300);
        const r2 = await pg.evaluate(MESURE);
        await pg.click('[data-prio-lancer]').catch(() => {}); await pg.waitForTimeout(300);
        const ouv2 = await pg.evaluate(() => window.__ouvertures.length);
        dit(r2.plein && r2.plein.ok === '0' && r2.plein.refus === 'comptes' && ouv2 === 1, `G ${ou} : une ligne d'un autre compte cochée ⇒ « un compte à la fois », rien d'ouvert`, { plein: r2.plein, ouv2 });
        if (!sombre) await pg.screenshot({ path: path.join(SHOTS, `arepublier-deux-comptes-${nomV}.png`) });
      }
      // Les réglages : 60 j.
      await pg.click('[data-prio-reglages]'); await pg.waitForTimeout(500);
      if (!sombre && nomV === '390') await pg.screenshot({ path: path.join(SHOTS, `arepublier-reglages-390.png`) });
      await pg.click('[data-prio-age="60"]').catch(() => {}); await pg.waitForTimeout(400);
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
      const r3 = await pg.evaluate(MESURE);
      const regle60 = await pg.evaluate(() => window.__banc.prio);
      dit(r3.ecran && r3.ecran.jours === '60' && r3.lignes.length === regle60.ids.length && r3.lignes.length < r0.lignes.length, `R ${ou} : âge mini 60 j ⇒ ${r3.lignes.length} lignes (au lieu de ${r0.lignes.length})`, { e: r3.ecran, n: r3.lignes.length });
      dit(erreurs.length === 0, `${ou} : aucune erreur de page`, erreurs.slice(0, 2));
      await ctx.close();
    }
    // A — Aujourd'hui
    for (const sombre of [false, true]) {
      const { ctx, pg, erreurs } = await ouvrir(nav, TEL, `?vue=aujourdhui${sombre ? '&theme=dark' : ''}`);
      const a = await pg.evaluate(() => { const e = document.querySelector('[data-prio-journee]'); return e ? { n: e.getAttribute('data-prio-journee'), t: e.textContent, h: Math.round(e.getBoundingClientRect().height) } : null; });
      dit(a && a.n === '10' && /10 paires à republier en priorité/.test(a.t) && a.h >= 44, `A 390${sombre ? ' · sombre' : ''} : « 10 paires à republier en priorité › » dans Aujourd'hui`, a);
      await pg.screenshot({ path: path.join(SHOTS, `aujourdhui-390${sombre ? '-sombre' : ''}.png`) });
      if (a) { await pg.click('[data-prio-journee]'); await pg.waitForTimeout(300); dit((await pg.evaluate(() => window.__nav)) === 'arepublier', 'A : le toucher ouvre Annonces sur « À republier »'); }
      dit(erreurs.length === 0, 'A : aucune erreur de page', erreurs.slice(0, 2));
      await ctx.close();
    }
    for (const pub of ['vide', 'aucune']) {
      const { ctx, pg } = await ouvrir(nav, TEL, `?vue=aujourdhui&pub=${pub}`);
      dit(!(await pg.$('[data-prio-journee]')), `A : publication ${pub === 'vide' ? 'à zéro' : 'jamais faite'} ⇒ aucune rangée (pas su ≠ zéro, zéro ≠ un geste)`);
      await ctx.close();
    }
    { const { ctx, pg } = await ouvrir(nav, ORDI, '?vue=aujourdhui'); await pg.screenshot({ path: path.join(SHOTS, 'aujourdhui-1512.png') }); await ctx.close(); }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${verts} verts, ${rouges} rouges — captures : ${SHOTS}`);
  process.exit(rouges ? 1 : 0);
})();
