// ════════════════════════════════════════════════════════════════════════════
//  BANC — LA RENTABILITÉ (21 nov., lot rentabilite — choix n° 36 et 41 de Julien). Données INVENTÉES (dépôt public).
//  390 × 844 tactile et 1512 ; clair et sombre. Deux parties :
//  I. STATISTIQUES › FINANCES (le vrai écran, monté par outils/natif-journee-stats, hors du paquet de prod) :
//     M1 « Ce que tu vends le mieux » existe (axe, tri, à racheter, classement) ; les nombres de chaque rangée (n, prix
//        moyen, marge moyenne SUR les ventes au prix connu, délai médian, taux) recomptés ICI par un code à part depuis les
//        ventes inventées ; M2 les trois tris rangent dans l'ordre recompté ; M3 l'axe Marque, Taille, Mod. × taille ;
//     M4 « à racheter » = meilleur score marge × vitesse, 3 ventes reliées et datées au moins (recompté) ;
//     M5 « Ce qui a été regroupé » s'ouvre et montre les écritures du titre ; N natif (pas de carte dans une carte,
//        aucun débordement, cibles ≥ 44, ni NaN).
//  II. VENTES ET ARGENT (le vrai paquet `dist/`, la base servie par le banc, comme cout-vente) :
//     V1 la fiche d'une vente détaille commission (aucune : règle Vinted), boost, emballage, port (« pas noté »), achat,
//        et le NET = le bénéfice de la règle (`data-benef-vente`), au centime ;
//     V2 le forfait d'emballage : éteint par défaut ; « Régler » 0,80 € ⇒ la vente sans emballage perd 0,80 €, celle qui
//        a un emballage saisi ne bouge pas ; « Éteindre » ⇒ tout revient ;
//     V3 à l'ordinateur, la colonne « Net » du tableau des ventes porte le même net (et « — » sans prix d'achat) ;
//     V4 Argent › Mois : prix d'achat manquant ⇒ « Bénéfice des ventes connues » (notion `connu`), couverture k/n.
//  Mutations (`MUTATION=net|regroupe`) : rougissent leur mesure. `SHOTS=dossier` : les captures (à REGARDER).
//  Doit être ROUGE sur le code d'avant (ni la carte, ni le détail, ni la colonne n'existaient).
//  Lancer : npm run build && BANC_PORT=4795 node scripts/bancs/rentabilite.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const { metaVersData } = require('./_meta.cjs');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number), THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-rentabilite'); fs.mkdirSync(SHOTS, { recursive: true });
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const MUT = process.env.MUTATION || '';
const PARTIES = liste('PARTIES', 'stats,ventes');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 240)); } };

// ── I. Statistiques ─────────────────────────────────────────────────────────
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-rent-'));
function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'natif-journee-stats', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'vrm-icones-app': gen }, external: ['/brands/*'], nodePaths: [NM], logLevel: 'error' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'natif-journee-stats', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json' };
const servir = (racine, port) => new Promise((res, rej) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/' || !path.extname(u)) u = '/index.html';
  const f = path.join(racine, u.replace(/^\/+/, '')); if (!f.startsWith(racine) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  s.on('error', rej); s.listen(port, () => res(s)); });

const NATIF = () => {
  const vis = (x) => x.getClientRects().length > 0;
  const cartes = [...document.querySelectorAll('.n-carte')].filter(vis);
  const empilees = cartes.filter((c) => c.parentElement && c.parentElement.closest('.n-carte')).length;
  const deborde = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const petites = [...document.querySelectorAll('[data-ps-bloc="mieux"] .n-rangee, [data-ps-bloc="mieux"] .n-segmente-choix')].filter(vis).map((x) => (x.matches('button, a, [role="button"], [role="radio"]') ? x : x.querySelector('button, a, [role="button"]') || x))
    .map((x) => x.getBoundingClientRect().height).filter((h) => h > 0 && h < 44).length;
  return { empilees, deborde, petites, nan: /NaN|undefined|Infinity/.test(document.body.innerText) };
};
// LE RECOMPTE À PART (pas le code de l'app) : par modèle, sur les ventes de la fenêtre de 30 jours.
const J = 86400000;
function recompte(R, A, de, a, cle) {
  const L = R.filter((l) => l.ts >= de && l.ts < a);
  const par = {};
  for (const l of L) { const k = cle(l); if (!k) continue; (par[k] = par[k] || []).push(l); }
  const med = (xs) => { const s = xs.slice().sort((x, y) => x - y); if (!s.length) return null; return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  const out = {};
  for (const [k, ls] of Object.entries(par)) {
    const rel = ls.filter((l) => l.achat != null);
    const ds = ls.filter((l) => l.enLigne != null && l.ts >= l.enLigne).map((l) => (l.ts - l.enLigne) / J);
    const dsR = rel.filter((l) => l.enLigne != null && l.ts >= l.enLigne).map((l) => (l.ts - l.enLigne) / J);
    const moyen = rel.length ? Math.round(rel.reduce((t, l) => t + Math.round(l.eur * 100) - Math.round(l.achat * 100), 0) / rel.length) / 100 : null;
    const moyenR = moyen;
    const m = med(ds), mR = med(dsR);
    // Le taux : les ventes Vinted mises en ligne dans la fenêtre + les annonces datées dans la fenêtre (une fois chacune).
    const vendues = new Set(ls.filter((l) => l.plateforme === 'Vinted' && l.item && l.enLigne >= de && l.enLigne < a).map((l) => l.item));
    const mises = new Set(vendues);
    for (const x of A) if (x.enLigne != null && x.enLigne >= de && x.enLigne < a && cle({ marqueLue: x.marque, taille: x.taille, modele: null, titre: x.titre }) === k) mises.add(x.item);
    out[k] = { n: ls.length, nCout: rel.length, prix: Math.round(Math.round(ls.reduce((t, l) => t + l.eur * 100, 0)) / ls.length) / 100, moyen, mediane: m == null ? null : Math.round(m * 10) / 10,
      taux: mises.size ? Math.round(vendues.size / mises.size * 100) : null,
      score: rel.length >= 3 && dsR.length >= 3 && moyenR > 0 ? Math.round(moyenR / Math.max(1, Math.round(mR * 10) / 10) * 100) / 100 : null };
  }
  return out;
}
async function stats(nav, port, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `Statistiques · Finances · ${W} · ${th}`, tel = W < 600;
  console.log(`\n── ${ou}`);
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: W, height: 900 } }), deviceScaleFactor: 1, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  try {
    await pg.goto(`http://localhost:${port}/?vue=stats&base=lu&seg=finances&f=30${sombre ? '&theme=dark' : ''}`, { waitUntil: 'load' });
    await pg.waitForSelector('[data-ps-bloc="mieux"]', { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(400);
    await pg.locator('[data-ps-bloc="mieux"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await pg.screenshot({ path: path.join(SHOTS, `stats-mieux-${W}-${th}.png`), fullPage: true });
    const lire = () => pg.evaluate(() => {
      const b = document.querySelector('[data-ps-bloc="mieux"]'); if (!b) return null;
      return { axe: b.getAttribute('data-ps-mieux-axe'), tri: b.getAttribute('data-ps-mieux-tri'), n: b.getAttribute('data-ps-mieux-n'), nCout: b.getAttribute('data-ps-mieux-ncout'),
        lignes: [...b.querySelectorAll('[data-ps-mieux-ligne]')].map((x) => ({ k: x.getAttribute('data-ps-mieux-ligne'), n: x.getAttribute('data-n'), ncout: x.getAttribute('data-ncout'), moyen: x.getAttribute('data-moyen'), prix: x.getAttribute('data-prix'), med: x.getAttribute('data-mediane'), taux: x.getAttribute('data-taux') })),
        racheter: [...b.querySelectorAll('[data-ps-racheter-k]')].map((x) => ({ k: x.getAttribute('data-ps-racheter-k'), s: x.getAttribute('data-ps-score') })),
        R: window.__RELEVE, A: window.__ANNONCES, T: window.__MAINTENANT };
    });
    const w = await lire();
    if (!dit(!!w, `M1 ${ou} : la carte « Ce que tu vends le mieux » est là`)) return;
    const fin = new Date(w.T); fin.setHours(0, 0, 0, 0); fin.setDate(fin.getDate() + 1); const de = new Date(fin); de.setDate(de.getDate() - 30);
    const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const C = recompte(w.R, w.A, de.getTime(), fin.getTime(), (l) => (l.modele ? norm(l.modele) : ''));
    const cents = (x) => (x == null ? '' : String(Math.round(x * 100)));
    const ecarts = w.lignes.filter((x) => { const r = C[x.k]; return !r || String(r.n) !== x.n || String(r.nCout) !== x.ncout || cents(r.moyen) !== x.moyen || cents(r.prix) !== x.prix || String(r.mediane ?? '') !== x.med; });
    dit(w.axe === 'modele' && w.tri === 'marge' && w.lignes.length === Object.keys(C).length && !ecarts.length,
      `M1b ${ou} : par modèle, ${w.lignes.length} rangées — n, prix moyen, marge moyenne SUR les ventes au prix connu, délai médian recomptés à part`, { ecarts: ecarts.slice(0, 2), C });
    const tauxOk = w.lignes.every((x) => String(C[x.k].taux ?? '') === x.taux);
    dit(tauxOk, `M1c ${ou} : taux de vente de chaque modèle = vendues ÷ mises en ligne dans les 30 j (annonces sans date dehors)`, w.lignes.map((x) => [x.k, x.taux, C[x.k] && C[x.k].taux]));
    // M2 : le tri par marge, puis vitesse et volume.
    const ordre = (f) => Object.keys(C).sort(f);
    const parMarge = ordre((x, y) => ((C[x].moyen == null) - (C[y].moyen == null)) || (C[y].moyen - C[x].moyen) || C[y].n - C[x].n);
    dit(w.lignes.map((x) => x.k).join('|') === parMarge.join('|'), `M2 ${ou} : tri par marge (la marge moyenne la plus haute d’abord)`, [w.lignes.map((x) => x.k), parMarge]);
    await pg.locator('[data-ps-bloc="mieux"] .n-ps-mieux-choix > *').nth(1).getByText('Volume', { exact: true }).click();
    await pg.waitForTimeout(200);
    const w2 = await lire();
    const brut = (k) => (C[k].moyen == null ? null : C[k].moyen * C[k].nCout);
    const parVol = ordre((x, y) => C[y].n - C[x].n || ((brut(x) == null) - (brut(y) == null)) || (brut(y) - brut(x)));
    dit(w2.tri === 'volume' && w2.lignes.map((x) => x.k).join('|') === parVol.join('|'), `M2b ${ou} : tri par volume`, [w2.lignes.map((x) => x.k), parVol]);
    await pg.locator('[data-ps-bloc="mieux"] .n-ps-mieux-choix > *').nth(1).getByText('Vitesse', { exact: true }).click();
    await pg.waitForTimeout(200);
    const w3 = await lire();
    const parVite = ordre((x, y) => ((C[x].mediane == null) - (C[y].mediane == null)) || (C[x].mediane - C[y].mediane) || C[y].n - C[x].n);
    dit(w3.tri === 'vitesse' && w3.lignes.map((x) => x.k).join('|') === parVite.join('|'), `M2c ${ou} : tri par vitesse (le délai médian le plus court d’abord)`, [w3.lignes.map((x) => x.k), parVite]);
    // M4 : à racheter (recompté).
    const sc = Object.entries(C).filter(([, r]) => r.score != null).sort((x, y) => y[1].score - x[1].score || y[1].n - x[1].n).slice(0, 3);
    dit(w.racheter.map((x) => x.k + ':' + x.s).join('|') === sc.map(([k, r]) => k + ':' + Math.round(r.score * 100)).join('|'), `M4 ${ou} : « à racheter en priorité » = meilleur score marge × vitesse (3 ventes reliées et datées au moins), recompté`, [w.racheter, sc]);
    // M3 : l'axe Marque.
    await pg.locator('[data-ps-bloc="mieux"] .n-ps-mieux-choix > *').nth(0).getByText('Marque', { exact: true }).click();
    await pg.waitForTimeout(200);
    const wm = await lire();
    const Cm = recompte(w.R, w.A, de.getTime(), fin.getTime(), (l) => norm(l.marqueLue));
    dit(wm.axe === 'marque' && wm.lignes.length === Object.keys(Cm).length && wm.lignes.every((x) => Cm[x.k] && String(Cm[x.k].n) === x.n && cents(Cm[x.k].moyen) === x.moyen),
      `M3 ${ou} : par marque, ${wm.lignes.length} rangées recomptées`, { vue: wm.lignes, Cm });
    await pg.locator('[data-ps-bloc="mieux"] .n-ps-mieux-choix > *').nth(0).getByText('Modèle', { exact: true }).click();
    await pg.waitForTimeout(200);
    // M5 : ce qui a été regroupé.
    const o = pg.locator('[data-ps-regroupe-ouvrir]');
    if (await o.count()) { if (tel) await o.first().tap(); else await o.first().click(); await pg.waitForTimeout(250); }
    if (MUT === 'regroupe') await pg.evaluate(() => { for (const x of document.querySelectorAll('[data-ps-regroupe-k]')) x.setAttribute('data-variantes', '1'); });
    const rg = await pg.evaluate(() => [...document.querySelectorAll('[data-ps-regroupe-k]')].map((x) => ({ k: x.getAttribute('data-ps-regroupe-k'), v: x.getAttribute('data-variantes'), t: x.innerText })));
    const nike = rg.find((x) => x.k === 'nike air max');
    dit(nike && nike.v === '3' && /air max 90/.test(nike.t) && /NIKE AIR MAX/.test(nike.t), `M5 ${ou} : « Ce qui a été regroupé » montre les 3 écritures du titre rassemblées sous Nike Air Max`, rg);
    await pg.locator('[data-ps-bloc="mieux"]').first().screenshot({ path: path.join(SHOTS, `stats-mieux-carte-${W}-${th}.png`) }).catch(() => {});
    const n = await pg.evaluate(NATIF);
    dit(!n.empilees && !n.deborde && !n.petites && !n.nan, `N ${ou} : aucune carte dans une carte, aucun débordement, cibles ≥ 44, ni NaN`, n);
    dit(!erreurs.length, `${ou} : aucune erreur de page`, erreurs);
  } finally { await ctx.close(); }
}

// ── II. Ventes et Argent (le vrai paquet) ───────────────────────────────────
const maintenant = new Date(2026, 10, 10, 15, 30, 0);
const iso = (h) => new Date(maintenant.getTime() - h * 3600e3).toISOString();
const UID = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, h, tus) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(h), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` } });
const VENTES = [
  vente(7101, 'Nike Air Max 90 blanche taille 42', 120, 'Commande finalisée', 30, 'completed'),
  vente(7102, 'Adidas Samba OG noir taille 40', 90, 'Commande finalisée', 50, 'completed'),
  vente(7103, 'New Balance 550 blanc vert taille 43', 70, 'Commande finalisée', 70, 'completed'),
  vente(7104, 'Asics Gel-Lyte III gris taille 41', 40, 'Commande finalisée', 90, 'completed'),
];
const OV = {
  '7101': { buyPrice: '60', fees: '2', commission: '3', emballage: '0.80', fraisComplets: true },
  '7102': { buyPrice: '50', fraisComplets: true },
  '7104': { buyPrice: '55', fraisComplets: true },
};
const NUMEROS = {
  '901': { numero: '11', buyPrice: '60', fees: '2', commission: '3', emballage: '0.80', fraisComplets: true },
  '902': { numero: '12', buyPrice: '50', fraisComplets: true },
  '904': { numero: '14', buyPrice: '55', fraisComplets: true },
};
const cap = maintenant.toISOString();
const txn = (tx, item) => ({ id: `harvest_${UID}_txn_${tx}`, data: { capturedAt: cap, payload: { transaction: { id: tx, item_id: item, status: 450, status_title: 'Commande finalisée', status_updated_at: cap } } } });
const LIGNES = [
  txn(7101, 901), txn(7102, 902), txn(7103, 903), txn(7104, 904),
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${UID}_listings`, data: { uid: UID, type: 'listings', nItems: 0, capturedAt: cap, payload: { items: [], pagination: { total_entries: 0 } } } },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'boutique_exemple', domain: 'www.vinted.fr', updated_at: cap }];
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : (Array.isArray(v) && /^-?\d+$/.test(seg) ? v[Number(seg) < 0 ? v.length + Number(seg) : Number(seg)] : v[seg]);
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf'][k % 4]}"/></svg>`;
async function ouvrirApp(b, port, tel, sombre, url) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ s, ov }) => { try {
    if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1');
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vinted_sale_overrides', JSON.stringify(ov)); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n));
  } catch (_) {} }, { s: !!sombre, ov: OV, n: NUMEROS });
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${port}/${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}
// La fiche d'une vente (natif) : Ventes › Terminées, toucher la vente, « Tout voir » ; le détail du bénéfice (`data-ba-ligne`).
const ouvrirFiche = async (pg, tel, titre) => {
  const fermer = pg.locator('[data-fiche-paire] button').filter({ hasText: /Vente|Retour|Fermer/ }).first();
  if (await pg.locator('[data-fiche-paire]').count()) { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(600); }
  if (await pg.locator('[data-fiche-paire]').count() && await fermer.count()) { await fermer.click().catch(() => {}); await pg.waitForTimeout(600); }
  const seg = pg.locator('.n-segmente-choix').filter({ hasText: 'Terminées' });
  if (await seg.count()) { await seg.first().click(); await pg.waitForTimeout(800); }
  const row = pg.getByText(titre, { exact: false }).first();
  await row.scrollIntoViewIfNeeded(); if (tel) await row.tap(); else await row.click();
  await pg.locator('[data-fiche-paire]').first().waitFor({ timeout: 10000 });
  await pg.waitForTimeout(800);
  const tv = pg.locator('[data-fd-tout-voir]');
  if (await tv.count() && await tv.first().getAttribute('aria-expanded') !== 'true') { await tv.first().click(); await pg.waitForTimeout(600); }
};
const lireFiche = (pg) => pg.evaluate(() => {
  const b = document.querySelector('[data-benef-article]'); if (!b) return null;
  const L = {}; for (const x of b.querySelectorAll('[data-ba-ligne]')) L[x.getAttribute('data-ba-ligne')] = { v: x.getAttribute('data-ba-valeur'), t: x.innerText.replace(/\s+/g, ' ') };
  const f = document.querySelector('[data-cr-forfait]');
  return { etat: b.getAttribute('data-benef-article'), net: b.getAttribute('data-benef-article-valeur'), L, forfait: f ? f.getAttribute('data-cr-forfait') : null,
    resume: (document.querySelector('[data-fiche-resume-benefice]') || { getAttribute: () => null }).getAttribute('data-fiche-resume-benefice') };
});
const cts = (x) => (x == null ? null : String(Math.round(Number(x) * 100)));
async function ventes(b, port, tel, sombre) {
  const th = sombre ? 'sombre' : 'clair', W = tel ? 390 : 1512, T = `Ventes · ${W} · ${th}`;
  console.log(`\n── ${T}`);
  const r = await ouvrirApp(b, port, tel, sombre, '?tab=cat_ventes');
  try {
    await r.pg.waitForTimeout(6000);
    await essaie(`${T} V1`, async () => {
      await ouvrirFiche(r.pg, tel, 'Air Max 90');
      const v = await lireFiche(r.pg);
      const v2 = MUT === 'net' && v ? { ...v, net: '5500' } : v;
      dit(v2 && v2.L['cr-commission'] && v2.L['cr-commission'].v === '300' && v2.L['cr-boost'] && v2.L['cr-boost'].v === '200' && v2.L['cr-emballage'] && v2.L['cr-emballage'].v === '80'
        && v2.L['cr-port'] && v2.L['cr-port'].v === '' && /pas noté/.test(v2.L['cr-port'].t) && v2.L.site && v2.L.site.v === '0' && v2.net === '5420' && v2.resume === v2.net,
        `V1 ${T} N°11 : 120 − commission notée 3 − boost 2 − emballage 0,80 − port « pas noté » − achat 60 = 54,20 € ; le bénéfice de la fiche est le même nombre`, v2);
      await r.pg.screenshot({ path: path.join(SHOTS, `vente-cout-reel-${W}-${th}.png`), fullPage: false });
      await r.pg.locator('[data-benef-article]').first().screenshot({ path: path.join(SHOTS, `vente-cout-reel-detail-${W}-${th}.png`) }).catch(() => {});
    });
    await essaie(`${T} V2`, async () => {
      await ouvrirFiche(r.pg, tel, 'Samba OG');
      const v = await lireFiche(r.pg);
      dit(v && v.forfait === '' && v.net === '4000' && v.L['cr-emballage'] && v.L['cr-emballage'].v === '', `V2 ${T} N°12 : forfait éteint par défaut, emballage « pas noté » (—), 40 € (rien deviné)`, v);
      await r.pg.locator('[data-cr-forfait-ouvrir]').first().click();
      await r.pg.locator('[data-cr-forfait-champ]').first().fill('0,80');
      await r.pg.locator('[data-cr-forfait-activer]').first().click();
      await r.pg.waitForTimeout(900);
      await ouvrirFiche(r.pg, tel, 'Samba OG');
      const v2 = await lireFiche(r.pg);
      const pose = await r.pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_forfait_emballage') || 'null'));
      dit(pose && pose.actif === true && v2 && v2.net === '3920' && v2.L['cr-emballage'].v === '80' && /forfait/.test(v2.L['cr-emballage'].t), `V2b ${T} « Régler » 0,80 € : N°12 passe à 39,20 €, l’emballage dit « forfait »`, { pose, v2 });
      await r.pg.locator('[data-benef-article]').first().screenshot({ path: path.join(SHOTS, `vente-forfait-${W}-${th}.png`) }).catch(() => {});
      await ouvrirFiche(r.pg, tel, 'Air Max 90');
      const v1 = await lireFiche(r.pg);
      dit(v1 && v1.net === '5420', `V2c ${T} N°11 (emballage saisi 0,80 €) ne bouge pas : l’emballage saisi passe devant le forfait`, v1);
      await ouvrirFiche(r.pg, tel, 'Samba OG');
      await r.pg.locator('[data-cr-forfait-ouvrir]').first().click();
      await r.pg.locator('[data-cr-forfait-eteindre]').first().click();
      await r.pg.waitForTimeout(900);
      await ouvrirFiche(r.pg, tel, 'Samba OG');
      const v5 = await lireFiche(r.pg);
      dit(v5 && v5.net === '4000', `V2d ${T} « Éteindre » : N°12 revient à 40 €`, v5);
    });
    dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${T} : aucun débordement horizontal`);
    dit(r.errs.length === 0, `${T} : aucune erreur`, r.errs.join(' | '));
  } finally { await r.ctx.close(); }
  // V3 : la colonne Net (ordinateur).
  if (!tel) {
    const r2 = await ouvrirApp(b, port, tel, sombre, '?tab=ventes');
    try {
      await r2.pg.waitForTimeout(2500);
      const seg = r2.pg.locator('.n-segmente-choix, [role="radio"]').filter({ hasText: /Terminées|Toutes/ });
      if (await seg.count()) { await seg.first().click(); await r2.pg.waitForTimeout(1500); }
      await r2.pg.waitForSelector('[data-ventes-tableau] [data-vt-net]', { timeout: 15000 }).catch(() => {});
      const nets = await r2.pg.evaluate(() => [...document.querySelectorAll('[data-ventes-tableau] [data-toutes-id]')].map((x) => { const n = x.querySelector('[data-vt-net]'); return [x.getAttribute('data-toutes-id'), n ? n.getAttribute('data-vt-net') : null]; }));
      const m = Object.fromEntries(nets);
      dit(m['7101'] === '5420' && m['7102'] === '4000' && m['7103'] === '' && m['7104'] === '-1500', `V3 ${T} colonne « Net » : 54,20 · 40 · — · −15 € (le net de la fiche)`, nets);
      await r2.pg.screenshot({ path: path.join(SHOTS, `ventes-tableau-net-${W}-${th}.png`) });
    } finally { await r2.ctx.close(); }
  }
  // V4 : Argent › Mois.
  const r3 = await ouvrirApp(b, port, tel, sombre, '?tab=cat_ventes');
  try {
    await r3.pg.locator('.vrm-sale-row[data-tx]').first().waitFor({ timeout: 30000 }).catch(() => {});
    await r3.pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_benefice_jours') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
    await r3.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=compta' })));
    await r3.pg.waitForSelector('[data-v2-argent-fait="benefice"]', { timeout: 20000 }).catch(() => {});
    await r3.pg.waitForTimeout(800);
    const a = await r3.pg.evaluate(() => { const e = document.querySelector('[data-v2-argent-fait="benefice"]'); return e ? { v: e.getAttribute('data-v2-argent-valeur'), notion: e.getAttribute('data-benef-notion'), couv: e.getAttribute('data-arg-net-connu'), t: e.innerText.replace(/\s+/g, ' ') } : null; });
    // Σ nets connus : 54,20 + 40 − 15 = 79,20 € ; sans dépense ; l'URSSAF de CES ventes (250 € de CA) au taux de l'app, ou 0 hors micro.
    const ok4 = a && a.notion === 'connu' && a.couv === '3/4' && (a.v === '7920' || a.v === String(7920 - Math.round(25000 * 0.124)));
    dit(ok4, `V4 ${T} Argent : « Bénéfice des ventes connues » = 79,20 € de nets (− l’URSSAF de ces ventes), couverture 3 sur 4`, a);
    await r3.pg.screenshot({ path: path.join(SHOTS, `argent-net-connu-${W}-${th}.png`) });
    dit(r3.errs.length === 0, `${T} Argent : aucune erreur`, r3.errs.join(' | '));
  } finally { await r3.ctx.close(); }
}

(async () => {
  let nav, s1, s2;
  try {
    nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const P = Number(process.env.BANC_PORT) || 4795;
    if (PARTIES.includes('stats')) {
      construire(); s1 = await servir(DOSSIER, P);
      for (const W of LARGEURS) for (const th of THEMES) await stats(nav, P, W, th === 'sombre');
    }
    if (process.env.SONDE) {   // (outil) capture un écran de l'app servie, sans juger : SONDE='?tab=…'
      s2 = await servir(DIST, P + 1);
      const r = await ouvrirApp(nav, P + 1, LARGEURS[0] < 600, false, process.env.SONDE);
      await r.pg.waitForTimeout(9000);
      for (const t of String(process.env.SONDE_TOUCHES || '').split('|').filter(Boolean)) { await r.pg.getByText(t, { exact: false }).first().click().catch((e) => console.log('touche ratée', t, String(e.message).slice(0, 80))); await r.pg.waitForTimeout(2500); }
      await r.pg.screenshot({ path: path.join(SHOTS, 'sonde.png') });
      console.log(await r.pg.evaluate(() => [...new Set([...document.querySelectorAll('[class]')].map((x) => String(x.className).split(' ')[0]).filter((c) => /vente|sale|fiche|toutes/i.test(c)))].slice(0, 40).join(' ')));
      console.log(r.errs.join(' | '));
      await r.ctx.close();
      return;
    }
    if (PARTIES.includes('ventes')) {
      if (!fs.existsSync(path.join(DIST, 'index.html'))) dit(false, 'dist/ construit (npm run build)');
      else { s2 = await servir(DIST, P + 1); for (const W of LARGEURS) for (const th of THEMES) await ventes(nav, P + 1, W < 600, th === 'sombre'); }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e.stack || e).slice(0, 400)); }
  finally { if (nav) await nav.close(); if (s1) s1.close(); if (s2) s2.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc rentabilite : ${ok} verts, ${ko} rouges${MUT ? ' (mutation ' + MUT + ')' : ''} — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
