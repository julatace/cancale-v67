require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA LIAISON ACHAT ⇄ ARTICLE (15 nov.) — jugée sur l'app RENDUE.
//  Récit : docs/passation/2026-11-15-achats-liaison.md · règle : src/liaisonAchat.js.
//
//  Julien : « Je veux que tu améliores la liaison entre les achats et les articles en vente ou vendus,
//  avec les titres, dates de retrait, couleur de l'article, etc. » Ce banc mesure :
//    cote      chaque carte avec un achat proposé montre l'ARTICLE et l'ACHAT côte à côte (deux photos,
//              deux titres, la date de retrait ou de commande, le prix payé), le NIVEAU et POURQUOI ;
//    niveau    les « très probables » attendus (achats uniques) le sont ; les 3 paires identiques ne
//              reçoivent RIEN en ligne (16 nov., relier-fiable : seule la « très probable », exclusive, se
//              montre) ; une marque différente n'est jamais proposée ;
//    clic      rien n'est écrit avant SON toucher : « Valider les N très probables » OUVRE la liste (rien
//              d'écrit), « Relier ces N » écrit EXACTEMENT ces N achats ; « Ce n'est pas lui » range le
//              couple (`vrm_liaison_refus`) et la carte passe à la suite ;
//    vendus    l'onglet « Vendus » montre une vente sans achat avec son achat proposé ;
//    achats    Achats : sous un achat sans article relié, l'article proposé ;
//    forme     rien ne déborde, titres ≤ 2 lignes, ≤ 1 bouton plein visible, 44 px au doigt.
//  Base INVENTÉE (titres génériques, identifiants inventés — dépôt PUBLIC) ; images servies localement.
//  `PASSES=390,1512-sombre` pour un sous-ensemble ; `BANC_DIST=` le build jugé ; `SHOTS=` les captures.
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (21000 + Math.floor(Math.random() * 18000));
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-achats-liaison');
fs.mkdirSync(SHOTS, { recursive: true });
const J = 86400e3, U = sc.UID[0], U2 = sc.UID[1];
const iso = (ms) => new Date(ms).toISOString();
const photoUrl = (k) => `https://images1.vinted.net/t/${k}_d/f800/${k}.jpeg`;

// ── Les annonces numérotées en ligne, sans achat relié ─────────────────────
// [id, titre, marque, taille, prix, N°, jours en ligne]
const ANNONCES = [
  ['81001', 'Salomon XT-6 vert kaki taille 41,5', 'Salomon', '41,5', 120, '201', 6],
  ['81002', 'Nike Air Max 1 Lemonade 2020 vert taille 43', 'Nike', '43', 140, '202', 9],
  ['81003', 'Adidas Handball Spezial bleu marine taille 37,5', 'adidas', '37,5', 75, '203', 12],
  ['81004', 'Asics Novablast 4 noir taille 44,5', 'ASICS', '44,5', 80, '204', 15],
  // Trois paires IDENTIQUES et trois achats identiques : jamais « très probable ».
  ['81005', 'Nike Air Force 1 blanc taille 42', 'Nike', '42', 70, '205', 20],
  ['81006', 'Nike Air Force 1 blanc taille 42', 'Nike', '42', 70, '206', 20],
  ['81007', 'Nike Air Force 1 blanc taille 42', 'Nike', '42', 70, '207', 20],
  // Marque choisie sur Vinted contredite par le titre : aucune proposition.
  ['81008', 'Autry reelwind low rose taille 36', 'adidas', '36', 68, '208', 18],
  ['81009', 'New Balance 550 blanc vert taille 41 édition très longue pour voir si le titre tient sur deux lignes', 'New Balance', '41', 95, '209', 25],
];
const listing = ([id, titre, marque, taille, prix, , jours]) => ({ ...sc.annonce({ id, titre, prix, taille, marque }), brand_title: marque, size_title: taille,
  created_at_ts: Math.floor((sc.NOW - jours * J) / 1000), photo: { url: photoUrl('a' + id) } });
const achat = (tx, titre, prix, jours, ph = true) => ({ ...sc.ordre({ tx, titre, prix, statut: sc.STATUT_FINAL, dateMs: sc.NOW - jours * J }), ...(ph ? { photo: { url: photoUrl('h' + tx) } } : {}) });
const ACHATS = [
  // (16 nov., relier-fiable) « très probable » exige la taille ET la couleur des deux côtés : ces achats les écrivent.
  achat('93000001', 'Salomon xt-6 vert kaki 41,5', 41.78, 16),
  achat('93000002', 'Nike Air Max 1 Lemonade (yellow and green) 43', 82.64, 20),
  achat('93000003', 'Adidas handball spezial navy size 37.5', 22.74, 30, false),
  achat('93000004', 'ASICS Novablast 4 schwarz (44.5)', 31.5, 25),
  achat('93000009', 'ASICS NovaBlast 3 44,5', 30, 40),          // autre VERSION : jamais proposé à « novablast 4 »
  achat('93000005', 'Nike Air Force 1 weiß 42', 40, 30),
  achat('93000006', 'Nike Air Force 1 weiß 42', 40, 30),
  achat('93000007', 'Nike Air Force 1 weiß 42', 40, 30),
  achat('93000008', '#Adidas Spezial, dunkelblau, Gr. 36', 21, 60),  // marque contredite : jamais proposé
  achat('93000010', 'Nike Dunk Low panda noir 44', 55, 70),              // l'achat de la vente
  achat('93000011', 'New Balance 550 verte et blanche taille 41', 52, 40),
];
const TRES_PROBABLES = ['93000001', '93000002', '93000003', '93000004', '93000010', '93000011'];   // 93000010 : celui de la VENTE
// Une vente récente, sans achat relié ni prix (onglet « Vendus »).
const VENTES = [sc.ordre({ tx: '94000001', titre: 'Nike Dunk Low panda noir blanc taille 44', prix: 95, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 40 * J })];
const NUMEROS = Object.fromEntries(ANNONCES.map(([id, titre, , taille, prix, n, jours]) => [id, { numero: n, title: titre, price: prix, size: taille, numberedAt: iso(sc.NOW - jours * J) }]));
const main = (sombre) => sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: NUMEROS, vinted_used_numeros: ANNONCES.map((a) => a[5]) });
const lst = sc.ligneListings(U, ANNONCES.map(listing));
const ROWS = [
  { ...lst, data: { ...lst.data, capturedAt: iso(sc.NOW - 60e3) } },
  { ...sc.ligneListings(U2, []), data: { ...sc.ligneListings(U2, []).data, capturedAt: iso(sc.NOW - 60e3) } },
  sc.lignePurch(U, ACHATS), sc.ligneSold(U, VENTES), sc.lignePurch(U2, []), sc.ligneSold(U2, []),
];
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>[^>]*$/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mjs': 'text/javascript', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const vignette = (graine) => { let h = 0; for (const c of String(graine)) h = (h * 31 + c.charCodeAt(0)) >>> 0; const t = h % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="hsl(${t},30%,86%)"/><path d="M70 250 C90 200 140 190 170 170 L210 150 C230 175 260 185 300 190 C330 195 345 215 340 245 L340 262 L70 262 Z" fill="hsl(${t},35%,40%)"/></svg>`; };

// ── Les mesures, DANS la page ──────────────────────────────────────────────
function lire({ tactile }) {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && !e.closest('[hidden]'); };
  const out = { debord: [], cote: [], cartes: {}, pleins: 0, cibles: [] };
  const main = document.querySelector('.vrm-main');
  if (document.documentElement.scrollWidth > innerWidth + 1) out.debord.push(`la page glisse (${document.documentElement.scrollWidth} > ${innerWidth})`);
  if (main && main.scrollWidth > main.clientWidth + 1) out.debord.push(`.vrm-main glisse (${main.scrollWidth} > ${main.clientWidth})`);
  out.pleins = [...document.querySelectorAll('.sb-btn-plein')].filter((b) => vis(b) && !b.closest('[role="dialog"], .vrm-fs, [data-ar-feuille-valider]')).length;
  for (const li of document.querySelectorAll('[data-ar-ligne]')) {
    const id = li.getAttribute('data-ar-ligne'), rl = li.getBoundingClientRect();
    if (rl.left < -0.5 || rl.right > innerWidth + 0.5) out.debord.push(`carte ${id} hors de l'écran`);
    for (const e of li.querySelectorAll('*')) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.left < rl.left - 1 || r.right > rl.right + 1) { out.debord.push(`carte ${id} : ${e.tagName.toLowerCase()}.${String(e.className || '').split(' ')[0]} sort de la carte`); break; } }
    for (const t of li.querySelectorAll('[data-ar-titre], .vrm-aar-sugg-titre')) { const cs = getComputedStyle(t); const lh = parseFloat(cs.lineHeight) || 18; if (t.getBoundingClientRect().height > 2 * lh + 2) out.debord.push(`carte ${id} : titre sur ${Math.round(t.getBoundingClientRect().height / lh)} lignes`); }
    const tx = li.getAttribute('data-ar-sugg-tx') || '';
    const art = li.querySelector('[data-ar-cote="article"]'), ach = li.querySelector('[data-ar-cote="achat"]');
    const pq = li.querySelector('[data-ar-pourquoi]');
    out.cartes[id] = { tx, niveau: li.getAttribute('data-ar-niveau') || '', pourquoi: pq ? pq.textContent.trim() : '', achat: ach ? ach.textContent.trim() : '', h: Math.round(rl.height) };
    if (tx) {
      if (!vis(art) || !vis(ach)) out.cote.push(`carte ${id} : article et achat pas côte à côte`);
      else {
        const a = art.getBoundingClientRect(), b = ach.getBoundingClientRect();
        if (!(b.left >= a.right - 2 && Math.abs(a.top - b.top) < 14)) out.cote.push(`carte ${id} : l'achat n'est pas à côté de l'article`);
        if (art.querySelectorAll('img, .vrm-aar-photo').length < 1 || ach.querySelectorAll('img, .vrm-aar-photo').length < 1) out.cote.push(`carte ${id} : deux photos attendues`);
      }
      if (!pq || !vis(pq)) out.cote.push(`carte ${id} : niveau et pourquoi absents`);
      const rel = li.querySelector('[data-ar-relier]'); if (!vis(rel)) out.cote.push(`carte ${id} : « Relier » caché`);
      const non = li.querySelector('[data-ar-pas-lui]'); if (!vis(non)) out.cote.push(`carte ${id} : « Ce n'est pas lui » caché`);
      if (tactile) for (const g of [rel, non, li.querySelector('[data-ar-plus]')]) if (g && vis(g) && g.getBoundingClientRect().height < 43.5) out.cibles.push(`carte ${id} : ${g.getAttribute('data-ar-relier') != null ? 'Relier' : g.getAttribute('data-ar-pas-lui') != null ? 'Pas lui' : '⋯'} ${Math.round(g.getBoundingClientRect().height)} px`);
    }
  }
  const v = document.querySelector('[data-ar-valider]'); out.valider = v && vis(v) ? Number(v.getAttribute('data-ar-valider')) : null;
  return out;
}

async function passe(b, nom, ctxOpts, sombre) {
  console.log(`── ${nom}`);
  const ctx = await b.newContext(ctxOpts);
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sb)); localStorage.setItem('vrm_langue', 'fr'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' })); } catch (_) {} }, sombre);
  const externe = (r) => { const u = r.request().url(); if (/vinted\.net/i.test(u) || r.request().resourceType() === 'image') return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: vignette(u) }); return r.abort(); };
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, externe);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, externe);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push(String(req.postData() || '')); return j([], 201); }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes());
    if (/id=eq\.main/.test(u)) return j(main(sombre));
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data' && !/^id,data/.test(sel) && !/^data,/.test(sel)) ? projette(r, sel) : r;
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  const tactile = !!ctxOpts.hasTouch;
  // Un lien posé : l'écriture vers la base, ou la copie de l'appareil (fiches, ventes) — la seconde arrive tout de suite,
  // la première part groupée plus tard.
  let local = '';
  const lireLocal = async () => { local = await pg.evaluate(() => { try { return (localStorage.getItem('vinted_annonce_numeros') || '') + (localStorage.getItem('vinted_sale_overrides') || ''); } catch (_) { return ''; } }).catch(() => local); };
  const ecritLien = (tx) => ecrits.some((x) => /buyFromId/.test(x) && x.includes(tx)) || local.includes('"buyFromId":"' + tx + '"');

  await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vinted`, { waitUntil: 'domcontentloaded' });
  const vue = pg.locator('[data-vue-sans-achat]').first();
  await vue.waitFor({ timeout: 30000 }).catch(() => {});
  if (!(await vue.count())) { dit(false, `${nom} · la vue « Sans achat relié » existe`); await ctx.close(); return; }
  await pg.waitForTimeout(1200);
  await vue.evaluate((e) => e.click());
  await pg.locator('[data-ar-relier]').first().waitFor({ timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  const l = await pg.evaluate(lire, { tactile });
  await capture(pg, nom, 'en-vente');
  const c = l.cartes;
  dit(!l.cote.length && Object.values(c).filter((x) => x.tx).length >= 5, `${nom} · cote · article et achat côte à côte (photos, titres), niveau et pourquoi, « Relier » et « Ce n'est pas lui »`, l.cote.slice(0, 4).join(' ; ') || JSON.stringify(c));
  const tp = Object.entries(c).filter(([, x]) => x.niveau === 'tres-probable').map(([, x]) => x.tx).sort();
  dit(JSON.stringify(tp) === JSON.stringify(TRES_PROBABLES.filter((x) => x !== '93000010').sort()), `${nom} · niveau · les très probables (en vente) sont les achats uniques (${tp.length})`, JSON.stringify(tp));
  dit(['81005', '81006', '81007'].every((k) => c[k] && !c[k].tx) && Object.values(c).every((x) => !x.tx || x.niveau === 'tres-probable'), `${nom} · niveau · trois paires identiques : AUCUNE proposition en ligne ; tout ce qui est montré est « très probable »`, JSON.stringify(['81005', '81006', '81007'].map((k) => c[k])));
  dit(c['81008'] && !c['81008'].tx && !Object.values(c).some((x) => x.tx === '93000008' || x.tx === '93000009'), `${nom} · niveau · marque contredite et autre version jamais proposées`, JSON.stringify(c['81008']));
  dit(/même marque/.test(c['81001'].pourquoi) && /kaki|vert/.test(c['81001'].pourquoi + c['81001'].achat) && /mise en ligne 10 j après la commande/.test(c['81001'].pourquoi) && /payé 41,78/.test(c['81001'].achat) && /commandé le/.test(c['81001'].achat),
    `${nom} · cote · pourquoi (« même marque · vert · mise en ligne 10 j après la commande ») et l'achat (« commandé le … · payé 41,78 € »)`, JSON.stringify(c['81001']));
  dit(!l.debord.length, `${nom} · forme · rien ne déborde, titres ≤ 2 lignes`, l.debord.slice(0, 4).join(' ; '));
  dit(l.pleins <= 1, `${nom} · forme · un bouton plein au plus (${l.pleins})`);
  if (tactile) dit(!l.cibles.length, `${nom} · forme · 44 px au doigt`, l.cibles.slice(0, 3).join(' ; '));
  await lireLocal();
  dit(!ecrits.some((x) => /buyFromId/.test(x)) && !TRES_PROBABLES.some(ecritLien), `${nom} · clic · rien d'écrit avant son toucher (base et appareil)`);
  // L'onglet « Vendus » (avant toute validation).
  await pg.locator('[data-ar-onglet="vendus"]').first().click({ timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(800);
  const lv = await pg.evaluate(lire, { tactile });
  await capture(pg, nom, 'vendus');
  const vv = lv.cartes['v:94000001'];
  dit(vv && vv.tx === '93000010' && /vendue \d+ j après la commande/.test(vv.pourquoi), `${nom} · vendus · la vente sans achat, son achat proposé (« vendue N j après la commande »)`, JSON.stringify(vv));
  dit(!lv.debord.length && !lv.cote.length, `${nom} · vendus · même carte, rien ne déborde`, lv.debord.concat(lv.cote).slice(0, 3).join(' ; '));
  await pg.locator('[data-ar-onglet="vente"]').first().click({ timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(600);
  // « Valider les N très probables » : la liste, puis SON toucher.
  dit(l.valider === TRES_PROBABLES.length, `${nom} · clic · « Valider les ${TRES_PROBABLES.length} très probables » visible`, String(l.valider));
  await pg.locator('[data-ar-valider]').first().evaluate((e) => e.click()).catch(() => {});
  await pg.locator('[data-ar-feuille-valider]').first().waitFor({ timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(500);
  const feuille = await pg.evaluate(() => [...document.querySelectorAll('[data-ar-valider-tx]')].map((e) => e.getAttribute('data-ar-valider-tx')).sort());
  await capture(pg, nom, 'valider-feuille');
  dit(JSON.stringify(feuille) === JSON.stringify([...TRES_PROBABLES].sort()) && !ecrits.some((x) => /buyFromId/.test(x)), `${nom} · clic · la feuille MONTRE les ${feuille.length} couples, rien n'est écrit`, JSON.stringify(feuille));
  // Il décoche le dernier, puis « Relier ces 4 paires ».
  const decoche = TRES_PROBABLES[TRES_PROBABLES.length - 1];
  await pg.locator(`[data-ar-valider-tx="${decoche}"] input[type="checkbox"]`).first().evaluate((e) => e.click()).catch((e) => console.log('   (clic case) ' + String(e.message).split('\n')[0]));
  await pg.waitForTimeout(200);
  // (le bouton plein du studio « respire » : jamais « stable » pour Playwright — le clic est donné à l'élément)
  await pg.locator('[data-ar-valider-ok]').first().evaluate((e) => e.click()).catch((e) => console.log('   (clic relier) ' + String(e.message).split('\n')[0]));
  // Les écritures partent groupées (quelques secondes) : on attend qu'elles arrivent, 15 s au plus.
  for (let i = 0; i < 30 && TRES_PROBABLES.filter((tx) => ecritLien(tx)).length < TRES_PROBABLES.length - 1; i++) { await pg.waitForTimeout(500); await lireLocal(); }
  await pg.waitForTimeout(800);
  const relies = TRES_PROBABLES.filter((tx) => ecritLien(tx));
  dit(relies.length === TRES_PROBABLES.length - 1 && !ecritLien(decoche), `${nom} · clic · « Relier ces ${TRES_PROBABLES.length - 1} paires » relie exactement les couples cochés`, JSON.stringify(relies));
  dit(!ecritLien('93000005') && !ecritLien('93000006') && !ecritLien('93000007'), `${nom} · clic · aucune paire identique reliée sans son toucher`);
  await capture(pg, nom, 'apres-valider');
  // Achats : l'article proposé sous un achat sans article relié.
  await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-achat-tx]').first().waitFor({ timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  const pa = await pg.evaluate(() => [...document.querySelectorAll('[data-achat-propose]')].map((e) => ({ k: e.getAttribute('data-achat-propose'), n: e.getAttribute('data-niveau'), tx: e.closest('[data-achat-tx]') ? '' : (e.previousElementSibling && e.previousElementSibling.getAttribute('data-achat-tx')) })));
  await capture(pg, nom, 'achats');
  await pg.locator('[data-achat-propose]').first().evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
  await pg.waitForTimeout(500);
  await capture(pg, nom, 'achats-propose');
  // (les liens posés plus haut restent dans l'appareil : l'achat décoché, 93000011, reste à relier ⇒ « N°209 » proposé ;
  //  les trois Air Force identiques ⇒ RIEN (16 nov., relier-fiable : égalité ⇒ aucune proposition) ; un article n'est
  //  proposé que sous UN achat)
  const parCle = {}; for (const x of pa) parCle[x.k] = (parCle[x.k] || 0) + 1;
  dit(pa.some((x) => x.tx === decoche && x.k === 'a:81009' && x.n === 'tres-probable') && !pa.some((x) => /^9300000[567]$/.test(x.tx)) && pa.every((x) => x.n === 'tres-probable') && Object.values(parCle).every((n) => n === 1),
    `${nom} · achats · sous un achat sans article : l'article proposé, « très probable », sous UN seul achat ; rien sous les trois identiques`, JSON.stringify(pa.slice(0, 6)));
  // « Ce n'est pas lui » sur la proposition qui reste (N°209 ⇄ 93000011, décochée plus haut) : le couple est rangé,
  // et il ne revient plus (16 nov. : ni en ligne, ni sous l'achat).
  await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vinted`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-vue-sans-achat]').first().waitFor({ timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  await pg.locator('[data-vue-sans-achat]').first().evaluate((e) => e.click()).catch(() => {});
  await pg.locator('[data-ar-ligne="81009"][data-ar-sugg-tx]').first().waitFor({ timeout: 20000 }).catch(() => {});
  for (let i = 0; i < 20; i++) { const t = await pg.evaluate(() => { const li = document.querySelector('[data-ar-ligne="81009"]'); return li ? li.getAttribute('data-ar-sugg-tx') : ''; }); if (t) break; await pg.waitForTimeout(500); }
  const avant = await pg.evaluate(() => { const li = document.querySelector('[data-ar-ligne="81009"]'); return li ? li.getAttribute('data-ar-sugg-tx') : null; });
  await pg.locator('[data-ar-ligne="81009"] [data-ar-pas-lui]').first().click({ timeout: 5000 }).catch(() => {});
  // Le geste est annulable quelques secondes, puis rangé (`vrm_liaison_refus`, dans SYNC_KEYS : il part au nuage avec la ligne main).
  const refusRange = () => pg.evaluate(() => { try { return localStorage.getItem('vrm_liaison_refus') || ''; } catch (_) { return ''; } });
  let refus = ''; for (let i = 0; i < 30 && !/>93000011/.test(refus); i++) { await pg.waitForTimeout(500); refus = await refusRange(); }
  const apres = await pg.evaluate(() => { const li = document.querySelector('[data-ar-ligne="81009"]'); return li ? li.getAttribute('data-ar-sugg-tx') : null; });
  dit(avant === decoche && apres !== avant && refus.includes('a:81009>' + avant) && !ecritLien(avant), `${nom} · clic · « Ce n'est pas lui » : rangé (synchronisé), la proposition ne revient pas`, JSON.stringify({ avant, apres }));
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}
const capture = async (pg, nom, quoi) => { await pg.screenshot({ path: path.join(SHOTS, `achats-liaison-${nom}-${quoi}.png`) }).catch(() => {}); };

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  pas de build (' + DIST + ') — npm run build'); process.exit(1); }
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const seul = String(process.env.PASSES || '').split(',').map((x) => x.trim()).filter(Boolean);
  try {
    const passes = [
      ['390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' }, false],
      ['390-sombre', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'dark', locale: 'fr-FR', timezoneId: 'Europe/Paris' }, true],
      ['1512', { viewport: { width: 1512, height: 950 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' }, false],
      ['1512-sombre', { viewport: { width: 1512, height: 950 }, colorScheme: 'dark', locale: 'fr-FR', timezoneId: 'Europe/Paris' }, true],
    ];
    for (const [n, o, s] of passes) if (!seul.length || seul.includes(n)) { try { await passe(b, n, o, s); } catch (e) { dit(false, `${n} · ÉCHEC`, String(e.message || e).slice(0, 200)); } }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
