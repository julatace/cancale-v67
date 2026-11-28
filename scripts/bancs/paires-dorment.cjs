// ═══════════════════════════════════════════════════════════
//  BANC — « PAIRES QUI DORMENT », LE PLAN (27 nov., choix de Julien ; retenu le 11 oct.)
//
//  Construit outils/paires-dorment/ (esbuild, hors paquet de prod) : l'écran Annonces natif sur le segment « Dorment »,
//  l'entrée du plan et SA feuille, nourris par les VRAIES règles (src/articles/, src/pairesDorment.js) sur une base
//  INVENTÉE — deux comptes Vinted (111 connecté, 444 pas connecté en ?porte=mix ; aucun en ?porte=non), six paires au
//  MÊME titre, deux achats inconnus, une courbe lue (et celle d'un autre compte au même identifiant, à ignorer).
//  Mesures (data-* et nombres, jamais un libellé) — 390 × 844 tactile (DPR 3) et 1512 × 900, clair et sombre :
//   E  l'entrée est posée sur « Dorment » : l'argent qui dort et le nombre de la règle ;
//   L  la feuille : les lignes de la règle, dans SON ordre (l'achat connu d'abord, du plus grand au plus petit), chacune
//      avec SES jours, SON achat (« — » + « Saisir l'achat » s'il manque), SES vues et favoris LUS (la courbe de SON compte) ;
//   I  identité : sept paires au même titre ⇒ sept lignes, sept clés, chacune SES chiffres ;
//   G  RIEN NE PART SANS SON TOUCHER : à l'arrivée et 2 s après, aucun geste ; « Republier », « Baisser à X € » et « Favoris »
//      d'une paire du compte connecté appellent le geste de CETTE ligne (X = SON plancher) ; un bouton du compte pas connecté
//      est éteint, ne fait rien, et la raison est dite sur sa ligne ;
//   R  aucune extension connectée ⇒ UNE raison en tête (lecture seule), tous les boutons éteints, les données visibles ;
//   D  design : cibles ≥ 44, contrastes ≥ 4,5:1, au plus 8 mots par bloc visible, aucun débordement, aucun rouge ni orange.
//  Sur l'arbre d'avant (git archive) il ROUGIT : la vue n'existe pas (la construction échoue).
//  SHOTS : le dossier des captures. BANC_PORT (4797 par défaut).
// ═══════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 4797;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-paires-dorment');
const DOSSIER = path.join(os.tmpdir(), 'banc-paires-dorment-build-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DOSSIER, { recursive: true });
let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) { verts++; console.log('  ✅ ' + quoi); } else { rouges++; console.log('  ❌ ' + quoi + (d !== undefined ? '\n       ' + JSON.stringify(d).slice(0, 700) : '')); } return ok; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx');
  fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'paires-dorment', 'banc.jsx')], bundle: true, outfile: path.join(DOSSIER, 'banc.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file', '.svg': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    external: ['/brands/*'], alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'silent' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'paires-dorment', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
const servir = () => new Promise((ok) => { const s = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const ph = /^\/photo\/(\d+)\.svg$/.exec(u);
  if (ph) { const i = Number(ph[1]); res.writeHead(200, { 'content-type': 'image/svg+xml' });
    res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="hsl(${(i * 47) % 360},18%,62%)"/><ellipse cx="150" cy="190" rx="110" ry="46" fill="hsl(${(i * 47 + 180) % 360},20%,40%)"/></svg>`); return; }
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
  const zone = document.querySelector('[data-pdo]') || document.querySelector('[data-pdo-entree]') || document.body;
  const r = { contrastes: [], cibles: [], couleurs: [], longs: [], debord: document.scrollingElement.scrollWidth - innerWidth };
  const w = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const el = t.parentElement; if (!t.nodeValue.trim() || !el) continue; const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || !vis(b) || el.closest('[aria-hidden="true"],[hidden]')) continue;
    const c = lire(cs.color); if (!c) continue; const fd = fondDe(el); const x = sur({ ...c, a: c.a * Number(cs.opacity || 1) }, fd); const L1 = lum(x), L2 = lum(fd); const k = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (k < 4.5) r.contrastes.push({ t: t.nodeValue.trim().slice(0, 30), k: Math.round(k * 100) / 100 });
  }
  // Un bloc = un élément feuille de texte (rangée, bouton, phrase) : au plus 8 mots visibles (« trop de texte », 23 nov.).
  for (const el of zone.querySelectorAll('*')) {
    if (el.children.length && [...el.children].some((c) => c.textContent.trim())) continue;
    const t = (el.textContent || '').trim(); if (!t || el.closest('[aria-hidden="true"],[hidden]')) continue;
    const b = el.getBoundingClientRect(); if (!(b.width > 0 && b.height > 0)) continue;
    const mots = t.split(/\s+/).filter((m) => /[\p{L}\d]/u.test(m)).length; if (mots > 8) r.longs.push({ t: t.slice(0, 60), mots });
  }
  for (const el of zone.querySelectorAll('button, a[href], input, [role="button"]')) {
    const b = el.getBoundingClientRect(); if (!vis(b) || el.closest('[hidden],[aria-hidden="true"]')) continue;
    if (b.width < 44 || b.height < 44) r.cibles.push({ q: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24), w: Math.round(b.width), h: Math.round(b.height) });
  }
  const chaude = (s) => { const c = lire(s); return c && c.a > 0.5 && c.r > 180 && c.b < 110 && c.r - c.b > 90 && c.g < 190; };
  for (const el of zone.querySelectorAll('*')) { const cs = getComputedStyle(el); if ((chaude(cs.color) && el.textContent.trim()) || chaude(cs.backgroundColor)) r.couleurs.push(el.className || el.tagName); }
  const E = document.querySelector('[data-pdo-ouvrir]');
  r.entree = E ? { argent: E.getAttribute('data-pdo-argent'), connus: E.getAttribute('data-pdo-connus'), n: (E.closest('[data-pdo-entree]') || { getAttribute: () => '' }).getAttribute('data-pdo-entree') } : null;
  const F = document.querySelector('[data-pdo]');
  r.feuille = F ? { etat: F.getAttribute('data-pdo'), n: F.getAttribute('data-pdo-n'), argent: F.getAttribute('data-pdo-argent'), lectureSeule: F.getAttribute('data-pdo-lecture-seule') || '' } : null;
  r.lignes = [...document.querySelectorAll('[data-pdo-ligne]')].map((e) => ({ cle: e.getAttribute('data-pdo-ligne'), id: e.getAttribute('data-pdo-id'), compte: e.getAttribute('data-pdo-compte'),
    jours: e.getAttribute('data-pdo-jours'), achat: e.getAttribute('data-pdo-achat'), vues: e.getAttribute('data-pdo-vues'), favoris: e.getAttribute('data-pdo-favoris'), source: e.getAttribute('data-pdo-source'),
    saisir: !!e.querySelector('[data-pdo-saisir]'), lecture: (e.querySelector('[data-pdo-lecture]') || { getAttribute: () => '' }).getAttribute('data-pdo-lecture'),
    gestes: [...e.querySelectorAll('[data-pdo-geste]')].map((g) => ({ k: g.getAttribute('data-pdo-geste'), ok: g.getAttribute('data-pdo-ok'), raison: g.getAttribute('data-pdo-raison') || '', vers: g.getAttribute('data-pdo-vers') || '', dis: g.getAttribute('aria-disabled') === 'true' })) }));
  r.gestes = (window.__gestes || []).slice();
  return r;
};
const TEL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true };
const ORDI = { viewport: { width: 1512, height: 900 } };
async function ouvrir(nav, opts, q) {
  const ctx = await nav.newContext(opts); const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.goto(`http://127.0.0.1:${PORT}/${q}`);
  try { await pg.waitForSelector('[data-pdo-entree], [data-pdo]', { timeout: 20000 }); } catch (_) {}
  if (opts.isMobile) await pg.addStyleTag({ content: ':root{--n-zone-haut:47px;--n-zone-bas:34px}' });
  await pg.waitForTimeout(700); return { ctx, pg, erreurs };
}
const toucher = async (pg, sel) => { const ok = await pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true; }, sel); await pg.waitForTimeout(250); return ok; };

(async () => {
  try { construire(); } catch (e) { dit(false, 'la page du banc se construit (le plan « Paires qui dorment » existe)', String(e.message).slice(0, 300)); console.log(`\n${verts} verts, ${rouges} rouges`); process.exit(1); }
  const srv = await servir();
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const [nomV, V] of [['390', TEL], ['1512', ORDI]]) for (const sombre of [false, true]) {
      const ou = nomV + (sombre ? ' · sombre' : '');
      console.log('── ' + ou);
      // ── E : l'entrée, sur le segment « Dorment » ──
      { const { ctx, pg, erreurs } = await ouvrir(nav, V, `?porte=mix${sombre ? '&theme=dark' : ''}`);
        const r = await pg.evaluate(MESURE); const regle = await pg.evaluate(() => window.__banc.plan);
        dit(r.entree && Number(r.entree.n) === regle.n && Number(r.entree.argent) === regle.argentC && Number(r.entree.connus) === regle.connus, `E ${ou} : l'entrée sur « Dorment » — ${regle.n} paires, ${regle.argentC / 100} € d'achats connus (${regle.connus} sur ${regle.n})`, { r: r.entree, regle: { n: regle.n, a: regle.argentC, k: regle.connus } });
        dit(r.cibles.length === 0 && r.contrastes.length === 0, `D ${ou} : l'entrée — cibles ≥ 44, contrastes ≥ 4,5:1`, { c: r.cibles, k: r.contrastes });
        await pg.screenshot({ path: path.join(SHOTS, `entree-${nomV}${sombre ? '-sombre' : ''}.png`) });
        await pg.evaluate(() => { const e = document.querySelector('[data-pdo-ouvrir]'); if (e) e.scrollIntoView({ block: 'center' }); }); const bt = await pg.$('[data-pdo-ouvrir] button, button[data-pdo-ouvrir], [data-pdo-ouvrir]'); if (bt) await bt.click(); await pg.waitForTimeout(700);
        const r2 = await pg.evaluate(MESURE);
        dit(r2.feuille && r2.feuille.etat === 'lu', `E ${ou} : toucher l'entrée ouvre la feuille du plan`, r2.feuille);
        dit(erreurs.length === 0, `${ou} : aucune erreur de page`, erreurs);
        await ctx.close(); }
      // ── L, I, G, D : la feuille, porte mixte ──
      { const { ctx, pg } = await ouvrir(nav, V, `?ouvert=1&porte=mix${sombre ? '&theme=dark' : ''}`);
        const r = await pg.evaluate(MESURE); const regle = await pg.evaluate(() => window.__banc.plan);
        dit(r.lignes.map((l) => l.cle).join('|') === regle.cles.join('|') && regle.n === 8, `L ${ou} : ${r.lignes.length} lignes, celles de la règle et dans SON ordre (22 j entre ; 21 j pile et 5 j absentes)`, { vu: r.lignes.map((l) => l.id), regle: regle.lignes.map((l) => l.id) });
        const achats = regle.lignes.map((l) => l.achatC);
        const k = achats.findIndex((x) => x == null);
        dit(k > 0 && achats.slice(0, k).every((x, i) => i === 0 || x <= achats[i - 1]) && achats.slice(k).every((x) => x == null), `L ${ou} : l'argent qui dort d'abord (achat connu, du plus grand au plus petit), achats inconnus à la fin`, achats);
        const parId = Object.fromEntries(regle.lignes.map((l) => [l.cle, l]));
        dit(r.lignes.every((l) => { const x = parId[l.cle]; return x && String(x.jours) === l.jours && (x.achatC == null ? l.achat === '' : String(x.achatC) === l.achat) && (x.vues == null ? l.vues === '' : String(x.vues) === l.vues); }),
          `L ${ou} : chaque ligne porte SES jours, SON achat, SES vues (la règle, data-*)`);
        dit(r.lignes.filter((l) => l.achat === '').every((l) => l.saisir) && r.lignes.filter((l) => l.achat !== '').every((l) => !l.saisir), `L ${ou} : achat inconnu ⇒ « — » et « Saisir l'achat » (et seulement là)`);
        const l1 = r.lignes.find((l) => l.id === '10001');
        dit(l1 && l1.vues === '140' && l1.favoris === '1' && l1.source === 'courbe', `L ${ou} : vues et favoris = le dernier jour LU de la courbe de SON compte (140 · 1 — pas 999 d'un autre compte)`, l1);
        const meme = r.lignes.filter((l) => l.id !== '10021');
        dit(meme.length === 7 && new Set(meme.map((l) => l.cle)).size === 7 && new Set(meme.map((l) => l.achat + '/' + l.jours)).size === 7, `I ${ou} : sept paires au MÊME titre (deux comptes) ⇒ sept lignes, sept clés, chacune SES chiffres`, meme.map((l) => l.cle));
        await pg.waitForTimeout(2000);
        dit((await pg.evaluate(() => window.__gestes.length)) === 0, `G ${ou} : RIEN ne part sans son toucher (à l'arrivée et 2 s après)`);
        const A = r.lignes.filter((l) => l.compte === '111'), B = r.lignes.filter((l) => l.compte === '444');
        dit(A.every((l) => l.gestes.map((g) => g.k).join(',') === 'republier,baisser,favoris') && A.every((l) => l.gestes.find((g) => g.k === 'republier').ok === '1'), `G ${ou} : compte connecté — Republier allumé sur chaque paire`, A.map((l) => l.gestes));
        dit(B.length === 3 && B.every((l) => l.gestes.every((g) => g.ok === '0' && g.dis)) && B.every((l) => l.lecture === 'pas-ouvert'), `G ${ou} : compte pas connecté — tout éteint, la raison sur SA ligne`, B.map((l) => ({ g: l.gestes, r: l.lecture })));
        // Les gestes de CETTE ligne.
        const cible = regle.lignes.find((l) => l.compte === '111' && l.baisseC != null);
        await toucher(pg, `[data-pdo-ligne="${cible.cle}"] [data-pdo-geste="republier"]`);
        await toucher(pg, `[data-pdo-ligne="${cible.cle}"] [data-pdo-geste="baisser"]`);
        const f1 = regle.lignes.find((l) => l.compte === '111' && l.favoris > 0);
        await toucher(pg, `[data-pdo-ligne="${f1.cle}"] [data-pdo-geste="favoris"]`);
        await toucher(pg, `[data-pdo-ligne="${B[0].cle}"] [data-pdo-geste="republier"]`);
        await toucher(pg, `[data-pdo-ligne="${B[0].cle}"] [data-pdo-geste="baisser"]`);
        const g = await pg.evaluate(() => window.__gestes.slice());
        dit(JSON.stringify(g) === JSON.stringify([['republier', cible.cle, null], ['baisser', cible.cle, cible.baisseC], ['favoris', f1.cle, null]]),
          `G ${ou} : Republier, « Baisser à ${cible.baisseC / 100} € » (SON plancher) et Favoris appellent le geste de CETTE ligne ; un bouton éteint ne fait rien`, g);
        const noFav = r.lignes.find((l) => l.favoris === '0');
        dit(noFav && noFav.gestes.find((x) => x.k === 'favoris').raison === 'sans-favori', `G ${ou} : 0 favori lu ⇒ « Favoris » éteint (« Aucun favori »)`, noFav && noFav.gestes);
        const rD = await pg.evaluate(MESURE);
        dit(rD.cibles.length === 0, `D ${ou} : cibles ≥ 44 × 44`, rD.cibles.slice(0, 6));
        dit(rD.contrastes.length === 0, `D ${ou} : contrastes ≥ 4,5:1`, rD.contrastes.slice(0, 6));
        dit(rD.longs.length === 0, `D ${ou} : au plus 8 mots par bloc visible`, rD.longs.slice(0, 6));
        dit(rD.couleurs.length === 0 && rD.debord <= 0, `D ${ou} : ni rouge ni orange, aucun débordement`, { c: rD.couleurs.slice(0, 4), d: rD.debord });
        await pg.evaluate(() => { const f = document.querySelector('[data-pdo]'); if (f) f.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(200);
        await pg.screenshot({ path: path.join(SHOTS, `plan-${nomV}${sombre ? '-sombre' : ''}.png`) });
        await ctx.close(); }
      // ── R : aucune extension connectée ──
      { const { ctx, pg } = await ouvrir(nav, V, `?ouvert=1&porte=non${sombre ? '&theme=dark' : ''}`);
        const r = await pg.evaluate(MESURE);
        dit(r.feuille && r.feuille.lectureSeule === 'pas-ouvert' && r.lignes.length === 8 && r.lignes.every((l) => l.gestes.every((x) => x.ok === '0')) && r.lignes.every((l) => !l.lecture),
          `R ${ou} : aucune extension connectée ⇒ UNE raison en tête, les 8 paires visibles, tous les boutons éteints (la raison pas répétée)`, { f: r.feuille, l: r.lignes.map((l) => l.lecture) });
        await toucher(pg, '[data-pdo-geste="republier"]');
        dit((await pg.evaluate(() => window.__gestes.length)) === 0, `R ${ou} : toucher un bouton éteint n'envoie rien`);
        dit(r.contrastes.length === 0 && r.longs.length === 0, `D ${ou} : lecture seule — contrastes, 8 mots`, { k: r.contrastes.slice(0, 4), l: r.longs.slice(0, 4) });
        await pg.screenshot({ path: path.join(SHOTS, `lecture-seule-${nomV}${sombre ? '-sombre' : ''}.png`) });
        await ctx.close(); }
    }
  } finally { await nav.close(); srv.close(); try { fs.rmSync(DOSSIER, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${verts} verts, ${rouges} rouges — captures : ${SHOTS}`);
  process.exit(rouges ? 1 : 0);
})();
