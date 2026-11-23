// ════════════════════════════════════════════════════════════════════════════
//  BANC — « L'APP EN TABLEAUX DE TRAVAIL » (19 nov. soir, NATIF.md §2 bis).
//  Les VRAIES vues (src/natif/TableauTravail.jsx et src/natif/ecrans/{Annonces,Ventes,Achats,Notifications}Tableau.jsx,
//  Automatisations.jsx) et les vraies règles d'articles (src/articles/modele.js), montées par outils/app-tableaux/ecran.jsx
//  (esbuild, hors du paquet de prod) avec des données INVENTÉES. 1512 × 900 et 1280 × 800 (souris), 390 × 844 tactile ;
//  clair et sombre ; bases `volume`, `vide`, `lbc` (Leboncoin seul), `vestiaire` (Vestiaire seul).
//    T1 rendu, aucune erreur JS ; T2 au plus UN plein ; T3 cibles ≥ 44 au doigt, ≥ 32 à la souris ; T4 contrastes ≥ 4,5:1
//    sur le fond RENDU ; T5 rien ne déborde, aucun prix coupé ; T6 chaque compteur du filtre Statut = le nombre de lignes
//    affichées quand il est coché seul ; T7 Annonces : le nombre par défaut = `compterArticles(...).tous.enligne` (le segment
//    « En ligne » d'hier) ; T8 le tri trie (Prix ↓ puis ↑) ; T9 les colonnes sont mémorisées (rechargée, la colonne cachée
//    le reste) ; T10 cocher 2 lignes + une action ⇒ « 2 sélectionnés » et le geste reçoit 2 lignes ; T11 base vide : l'état
//    vide, jamais NaN ; T12 Leboncoin seul / Vestiaire seul : aucun « Vinted » imposé, rien de vide ; T13 Automatisations :
//    liste + détail, état dit, aperçu des paliers « 100 → 93 → 88 → 85 · plancher 85 ».
//  `SHOTS=dossier` (captures à REGARDER), `VUES`, `BASES`, `LARGEURS`, `THEMES`. `MUTATION=compteur|tri|plein` : chacune rougit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const { contrastes } = require('./aujourdhui-propre.cjs');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const VUES = liste('VUES', 'annonces,ventes,achats,notifs'), BASES = liste('BASES', 'volume,vide,lbc,vestiaire');
const LARGEURS = liste('LARGEURS', '1512,1280,390').map(Number), THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-app-tableaux'); fs.mkdirSync(SHOTS, { recursive: true });
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'app-tableaux-'));
const MUT = process.env.MUTATION || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'app-tableaux', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'error' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'app-tableaux', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = () => new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }); s.listen(Number(process.env.BANC_PORT) || 0, () => res(s)); });

async function ouvrir(ctx, port, vue, base, sombre) {
  const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.goto(`http://localhost:${port}/?vue=${vue}&base=${base}${sombre ? '&theme=dark' : ''}`, { waitUntil: 'load' });
  await pg.waitForSelector(vue === 'auto' ? '[data-au-ecran]' : '[data-tt]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(500);
  if (MUT === 'compteur') await pg.evaluate(() => { const n = document.querySelector('[data-tt-nombre]'); if (n) { n.setAttribute('data-tt-nombre', String(Number(n.getAttribute('data-tt-nombre')) + 1)); } });
  return { pg, erreurs };
}
const lireNombre = (pg) => pg.evaluate(() => { const n = document.querySelector('[data-tt-nombre]'); return n ? Number(n.getAttribute('data-tt-nombre')) : null; });
const lignesVues = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-tt-ligne]')].filter((x) => x.getClientRects().length).length);

async function unEcran(nav, port, vue, base, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `${vue} · ${base} · ${W} · ${th}`, tel = W < 600;
  console.log(`\n── ${ou}`);
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: W, height: W === 1512 ? 900 : 800 } }), colorScheme: sombre ? 'dark' : 'light' });
  const { pg, erreurs } = await ouvrir(ctx, port, vue, base, sombre);
  try {
    if (MUT === 'plein') await pg.evaluate(() => { const p = document.querySelector('[data-n-variante="plein"]'); if (p) p.parentElement.appendChild(p.cloneNode(true)); });
    await pg.screenshot({ path: path.join(SHOTS, `${vue}-${base}-${W}-${th}.png`) });
    const d = await pg.evaluate((tel) => {
      const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(x).visibility !== 'hidden'; };
      const pleins = [...document.querySelectorAll('[data-n-variante="plein"]')].filter(vis).length;
      const min = tel ? 44 : 32;
      const petits = [...document.querySelectorAll('.n-tt button, .n-tt input[type="checkbox"], .n-tt [data-tt-ligne], [data-au-ecran] button')].filter(vis).map((x) => {
        const c = x.matches('input[type="checkbox"]') ? (x.closest('label') || x) : x; const r = c.getBoundingClientRect(); return { t: (x.getAttribute('aria-label') || x.textContent || x.className).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
      }).filter((x) => x.h < min || x.w < min);
      const deborde = Math.max(0, document.documentElement.scrollWidth - innerWidth);
      const cadre = document.querySelector('[data-tt-tableau]'); const cadreDeborde = cadre ? Math.max(0, cadre.scrollWidth - cadre.clientWidth) : 0;
      const coupes = [...document.querySelectorAll('[data-tt-col="prix"], .n-tt-carte-prix, .n-tt-nombre-texte, .n-tt-etiquette')].filter(vis).filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent.slice(0, 20));
      const texte = (document.querySelector('[data-tt], [data-au-ecran]') || document.body).innerText;
      return { pleins, petits: petits.slice(0, 6), deborde, cadreDeborde, coupes, nan: /NaN|undefined|\[object/.test(texte), vinted: /Vinted/.test(texte), vide: !!document.querySelector('.n-vide'), lignes: [...document.querySelectorAll('[data-tt-ligne]')].filter(vis).length };
    }, tel);
    dit(!erreurs.length, `T1 ${ou} : rendu, aucune erreur JS`, erreurs);
    dit(d.pleins <= 1, `T2 ${ou} : au plus UN plein (${d.pleins})`, d.pleins);
    dit(!d.petits.length, `T3 ${ou} : cibles ≥ ${tel ? 44 : 32}`, d.petits);
    dit(d.deborde <= 1 && d.cadreDeborde <= 1 && !d.coupes.length && !d.nan, `T5 ${ou} : rien ne déborde (ni la page, ni le tableau avec ses colonnes par défaut), aucun prix ni étiquette coupé, jamais NaN`, d);
    const c = await contrastes(pg, vue === 'auto' ? '[data-au-ecran]' : '[data-tt]');
    dit(c.juges > 8 && !c.faibles.length, `T4 ${ou} : ${c.juges} textes ≥ 4,5:1 sur le fond rendu (min ${c.min})`, c.faibles ? c.faibles.slice(0, 4) : c);
    if (base === 'vide' && vue !== 'auto') dit(d.vide && d.lignes === 0, `T11 ${ou} : base vide ⇒ l'état vide dessiné, aucune ligne`, d);
    if ((base === 'lbc' || base === 'vestiaire') && vue === 'annonces') dit(!d.vinted && d.lignes > 0, `T12 ${ou} : ${base} seul ⇒ des lignes, aucun « Vinted » imposé`, d);
    if (vue === 'auto') {
      const a = await pg.evaluate(() => ({ items: document.querySelectorAll('[data-au-item]').length, etats: [...document.querySelectorAll('[data-au-item] [data-au-etat]')].map((x) => x.getAttribute('data-au-etat')) }));
      dit(a.items === 3 && a.etats.join() === 'off,on,passu', `T13 ${ou} : 3 automatismes, état lu (Désactivé · Activé · « — » pas su)`, a);
      if (!tel) {
        await pg.locator('[data-au-item="offres"]').click(); await pg.waitForTimeout(200); await pg.locator('[data-au-onglet="nego"]').click(); await pg.waitForTimeout(200);
        const ap = await pg.evaluate(() => { const x = document.querySelector('[data-au-apercu]'); return x ? x.getAttribute('data-au-apercu') : ''; });
        dit(ap === '100>93>88>85|85', `T13 ${ou} : l’aperçu des paliers = 100 → 93 → 88 → 85 · plancher 85`, ap);
        await pg.screenshot({ path: path.join(SHOTS, `auto-nego-${W}-${th}.png`) });
      }
    }
    // Les comportements (une largeur, un thème, base de volume suffisent : la règle est la même partout).
    if (base === 'volume' && vue !== 'auto' && !sombre && (W === 1512 || W === 390)) await comportements(pg, ctx, port, vue, ou, tel);
  } catch (e) { dit(false, `${ou} : le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 500)); }
  await ctx.close();
}

async function comportements(pg, ctx, port, vue, ou, tel) {
  const toucher = (s) => (tel ? pg.locator(s).first().tap({ timeout: 5000 }) : pg.locator(s).first().click({ timeout: 5000 }));
  // T7 le nombre par défaut (Annonces) = le segment « En ligne » d'hier.
  if (vue === 'annonces') { const n = await lireNombre(pg); const att = await pg.evaluate(() => window.__banc.compteEnLigne); dit(n === att, `T7 ${ou} : ${n} articles par défaut = compterArticles « En ligne » (${att})`, [n, att]); }
  // T6 chaque compteur du filtre Statut = les lignes affichées quand il est coché seul.
  await toucher('[data-tt-ouvre="statut"]'); await pg.waitForTimeout(250);
  const cases = await pg.evaluate(() => [...document.querySelectorAll('[data-tt-statut]')].filter((x) => x.getClientRects().length).map((x) => ({ cle: x.getAttribute('data-tt-statut'), n: Number(x.querySelector('[data-tt-n]').getAttribute('data-tt-n')), coche: x.getAttribute('data-tt-coche') === '1' })));
  await pg.screenshot({ path: path.join(SHOTS, `${vue}-statut-${tel ? 390 : 1512}.png`) });
  const mal = [];
  for (const k of cases.slice(0, 4)) {
    // ne garder que k : décocher les autres, cocher k
    for (const autre of cases) {
      const etat = await pg.evaluate((c) => { const x = [...document.querySelectorAll(`[data-tt-statut="${c}"]`)].find((y) => y.getClientRects().length); return x ? x.getAttribute('data-tt-coche') === '1' : null; }, autre.cle);
      const voulu = autre.cle === k.cle;
      if (etat !== voulu) { await pg.locator(`[data-tt-statut="${autre.cle}"] input`).filter({ visible: true }).first().click({ force: true }); await pg.waitForTimeout(60); }
    }
    await pg.waitForTimeout(150);
    const n = await lireNombre(pg); const compteur = await pg.evaluate((c) => { const x = [...document.querySelectorAll(`[data-tt-statut="${c}"] [data-tt-n]`)].find((y) => y.getClientRects().length); return x ? Number(x.getAttribute('data-tt-n')) : null; }, k.cle);
    if (MUT === 'compteur') await pg.evaluate(() => { const x = document.querySelector('[data-tt-nombre]'); if (x) x.setAttribute('data-tt-nombre', String(Number(x.getAttribute('data-tt-nombre')) + 1)); });
    const n2 = MUT === 'compteur' ? await lireNombre(pg) : n;
    if (n2 !== compteur) mal.push({ cle: k.cle, compteur, affiche: n2 });
  }
  dit(cases.length >= 2 && !mal.length, `T6 ${ou} : ${cases.length} cases de Statut ; coché seul, chaque compteur = « N lignes » affichées`, mal.length ? mal : cases);
  await pg.keyboard.press('Escape'); if (tel) await pg.locator('.n-feuille-croix').first().click({ timeout: 2000 }).catch(() => {});
  await pg.waitForTimeout(200);
  await pg.locator('[data-tt-statuts-tous]').first().click({ timeout: 1500 }).catch(() => {});
  if (tel) {
    const r = await pg.evaluate(() => [...document.querySelectorAll('[data-tt-liste] [data-tt-ligne]')].slice(0, 5).map((x) => Math.round(x.getBoundingClientRect().height)));
    const haut = vue === 'notifs' ? 56 : 72;   // une rangée à icône (notification) : 56 au moins ; une rangée à vignette : 72
    dit(r.length > 0 && r.every((h) => h >= haut), `T3 ${ou} : la liste du téléphone en rangées de ${haut} au moins (${r.join(' · ')})`, r);
    return;
  }
  // T8 le tri trie : Prix ↓ puis ↑.
  const prixCol = vue === 'notifs' ? 'recue' : 'prix';
  await pg.keyboard.press('Escape');
  const lire = () => pg.evaluate((c) => [...document.querySelectorAll(`[data-tt-tableau] td[data-tt-col="${c}"]`)].slice(0, 40).map((x) => { const t = x.textContent.replace(/[\s  €]/g, '').replace(',', '.'); const m = t.match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?/); return m ? Number((m[3] || '2026') + m[2] + m[1]) : (t === '—' ? null : Number(t)); }).filter((x) => x != null && !Number.isNaN(x)), prixCol);
  // jusqu'à ↓ (une colonne déjà triée par défaut l'est peut-être)
  for (let i = 0; i < 2; i++) { const s0 = await pg.evaluate((c) => { const t = document.querySelector(`[data-tt-th="${c}"]`); return t ? t.getAttribute('aria-sort') : null; }, prixCol); if (s0 === 'descending') break; await pg.locator(`[data-tt-trier="${prixCol}"]`).click(); await pg.waitForTimeout(250); }
  if (MUT === 'tri') await pg.evaluate(() => { const tb = document.querySelector('[data-tt-tableau] tbody'); if (tb && tb.children.length > 2) tb.insertBefore(tb.children[2], tb.children[0]); });
  const a = await lire(); await pg.locator(`[data-tt-trier="${prixCol}"]`).click(); await pg.waitForTimeout(250); const b = await lire();
  const trie = (l, s) => l.every((x, i) => i === 0 || (s > 0 ? x >= l[i - 1] : x <= l[i - 1]));
  dit(a.length > 3 && trie(a, -1) && trie(b, 1) && a[0] !== b[0], `T8 ${ou} : le tri ${prixCol} ↓ puis ↑ trie (${a.slice(0, 3).join(' ')} … / ${b.slice(0, 3).join(' ')} …)`, { a: a.slice(0, 8), b: b.slice(0, 8) });
  // T9 colonnes mémorisées : cacher une colonne, recharger.
  const col = vue === 'notifs' ? 'type' : 'date';
  await pg.locator('[data-tt-ouvre="colonnes"]').click(); await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(SHOTS, `${vue}-colonnes-1512.png`) });
  await pg.locator(`[data-tt-colonne="${col}"] input`).click(); await pg.waitForTimeout(150); await pg.keyboard.press('Escape');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('[data-tt-tableau]', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(400);
  const cache = await pg.evaluate((c) => !document.querySelector(`[data-tt-th="${c}"]`) && !!document.querySelector('[data-tt-th="statut"]'), col);
  dit(cache, `T9 ${ou} : la colonne « ${col} » cachée le reste après rechargement (mémorisée pour cet écran)`, cache);
  await pg.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
  // T10 sélection + action.
  if (vue !== 'achats') {
    const boites = pg.locator('[data-tt-tableau] tbody input[type="checkbox"]:not([disabled])');
    const action = vue === 'ventes' ? 'imprimer' : vue === 'notifs' ? 'lues' : 'baisser';
    await pg.locator('[data-tt-ouvre="action"]').click(); await pg.waitForTimeout(150); await pg.locator(`[data-tt-action="${action}"]`).click(); await pg.waitForTimeout(150);
    const nb = await boites.count();
    for (let i = 0; i < Math.min(2, nb); i++) { await boites.nth(i).click(); await pg.waitForTimeout(80); }
    const s = await pg.evaluate(() => { const b = document.querySelector('[data-tt-barre-sel]'); return b ? { n: b.getAttribute('data-tt-barre-sel'), texte: b.innerText } : null; });
    await pg.screenshot({ path: path.join(SHOTS, `${vue}-selection-1512.png`) });
    if (vue !== 'notifs') { await pg.locator('[data-tt-lancer]').click(); await pg.waitForTimeout(150); }
    const fait = await pg.evaluate(() => document.documentElement.getAttribute('data-banc-action'));
    dit(!!s && s.n === '2' && /2 sélectionnés/.test(s.texte) && (vue === 'notifs' || fait === action + ':2'), `T10 ${ou} : 2 cochées + « ${action} » ⇒ « 2 sélectionnés » et le geste reçoit 2 lignes (${fait || '—'})`, { s, fait });
  }
}

(async () => {
  try { construire(); } catch (e) { dit(false, 'le banc se construit (esbuild)', String(e.message || e).slice(0, 600)); process.exit(1); }
  const src = ['src/natif/TableauTravail.jsx', 'src/natif/ecrans/AnnoncesTableau.jsx', 'src/natif/ecrans/VentesTableau.jsx', 'src/natif/ecrans/AchatsTableau.jsx', 'src/natif/ecrans/NotificationsTableau.jsx', 'src/natif/ecrans/Automatisations.jsx']
    .map((f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).join('\n');
  dit(!/style=\{|!important/.test(src), 'N la source des vues : ni `style={`, ni `!important`');
  const css = ['src/natif/tableau.css']   // (20 nov.) l'écran Automatisations de l'app est retiré (elles vivent dans l'extension).map((f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
  dit(!/!important|:has\(|#[0-9a-fA-F]{3,8}\b|gradient/.test(css), 'N le CSS : ni `!important`, ni `:has()`, ni couleur en dur, ni dégradé');
  const s = await servir(); const port = s.address().port;
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const vue of VUES) for (const base of BASES) {
      if (vue === 'auto' && base !== 'volume') continue;
      if ((base === 'lbc' || base === 'vestiaire') && !['annonces', 'ventes'].includes(vue)) continue;
      for (const W of LARGEURS) for (const t of THEMES) {
        if ((base === 'lbc' || base === 'vestiaire' || base === 'vide') && t === 'sombre' && W !== 1512) continue;
        await unEcran(nav, port, vue, base, W, t === 'sombre');
      }
    }
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 900)); }
  await nav.close(); s.close();
  console.log(`\n${ko ? '❌' : '✅'} app-tableaux${MUT ? ' [MUTATION=' + MUT + ']' : ''} : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
