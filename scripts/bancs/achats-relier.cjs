// ════════════════════════════════════════════════════════════════════════════
// BANC : ACHATS (lot DJ5, 11 nov.) — CHOISIR UN AUTRE ACHAT · REÇU OUVERT ·
//        « NOUVEL ACHAT » HORS PLATEFORME · ICÔNES ANNONCES ET MA JOURNÉE
//        node scripts/bancs/achats-relier.cjs   (après la construction ;
//        BANC_PORT, 7991 par défaut ; SHOTS=dossier pour garder les captures ;
//        BANC_DIST=dossier pour servir un autre build)
// ════════════════════════════════════════════════════════════════════════════
// Julien (11 nov.), mot pour mot : « Quand l'app me fait une proposition pour
// relier un achat, je ne peux pas en sélectionner un autre, je peux simplement
// mettre un prix d'achat. » — « Quand on a relié une annonce à un achat, je veux
// que quand on appuie sur Reçu ça ne télécharge pas le reçu mais que ça l'ouvre
// comme dans l'onglet Achats. » — « Achat hors brocante doit être amélioré. » —
// « Je veux que tu changes le logo des Annonces et de Ma journée. »
//
// Données INVENTÉES : 50 achats « Adidas Spezial noir 42 » au MÊME titre, même
// prix, même date (seule leur photo et leur n° diffèrent). Exigé, 390 tactile et
// 1512, clair et sombre :
//   A. Ventes : la vente porte une PROPOSITION (achat 91000007, même fichier
//      photo) ; « Choisir un autre achat » ouvre la recherche (aucune suggestion),
//      50 achats libres, « Déjà relié à N°6 » visible après une recherche ; SON
//      clic sur 91000037 relie 91000037 — jamais 91000007 (le clic décide) ;
//   D. Annonces → « Sans achat relié » : à côté de « Relier · 40 € » (la
//      suggestion), « Autre achat » ; SON clic sur 91000044 relie 91000044 ;
//   B. Reçu d'un achat relié : avec un reçu e-mail ⇒ la feuille du reçu (celle
//      d'Achats) ; sans ⇒ la visionneuse PDF (« Télécharger » dedans, second) ;
//      AUCUN événement de téléchargement ;
//   C. « Changer l'achat relié » ⇒ « Relié à … » + « Délier » : le lien part ;
//   E. « Nouvel achat » : la photo en PREMIER, le prix en grand (≥ 24 px), ses
//      derniers lieux en pastilles ≥ 44 px, « Prendre le N°… » posé par SON
//      toucher et réservé dans le pool à l'enregistrement, une colonne au
//      téléphone, gros bouton ;
//   F. Icônes : la barre / colonne porte « soleilLevant » (Ma journée) et
//      « vitrine » (Annonces) ; planche avant/après (SHOTS).
//   + aucune erreur de page, aucun défilement horizontal.
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7991;
const SHOTS = process.env.SHOTS || '';
const J = 86400e3, U = sc.UID[0];
const iso = (ms) => new Date(ms).toISOString();
const TITRE = 'Adidas Spezial noir 42';
const photo = (tx) => ({ url: `https://images1.vinted.net/t/01_banc/f800/${tx}.jpeg` });
const achat = (tx) => ({ ...sc.ordre({ tx, titre: TITRE, prix: 40, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 40 * J }), photo: photo(tx) });
const TXS = Array.from({ length: 52 }, (_, i) => String(91000001 + i));
const ACHATS = TXS.map(achat);
const PROPOSE = '91000007', CHOISI = '91000037', CHOISI_ANN = '91000044', RELIE_MAIL = '91000051', RELIE_SANS = '91000052';
// L'annonce en ligne sans achat (Annonces → Sans achat relié).
const listing = { ...sc.annonce({ id: '93000', titre: TITRE, prix: 70, taille: 42, marque: 'Adidas' }), created_at_ts: Math.floor((sc.NOW - 20 * J) / 1000), photo: { url: 'https://images1.vinted.net/t/01_banc/f800/annonce93000.jpeg' } };
// Trois ventes : une sans prix (proposition par la photo exacte de 91000007), deux reliées.
const vente = (tx, item, ph) => ({ ...sc.ordre({ tx, titre: TITRE, prix: 70, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 5 * J, item }), photo: ph });
const VENTES = [vente('95000001', '93900', photo(PROPOSE)), vente('95100001', '93901', { url: 'https://images1.vinted.net/t/01_banc/f800/v951.jpeg' }), vente('95200001', '93902', { url: 'https://images1.vinted.net/t/01_banc/f800/v952.jpeg' })];
const snap = (tx) => ({ title: TITRE, date: iso(sc.NOW - 40 * J), photo: photo(tx).url, price: 40, devise: 'EUR', seller: 'vendeuse_inventee', status: sc.STATUT_FINAL, account: 'boutique_nord' });
const NUMEROS = {
  93000: { numero: '1', title: TITRE, price: 70 },
  93900: { numero: '5', title: TITRE, price: 70 },
  93901: { numero: '6', title: TITRE, price: 70, buyFromId: RELIE_MAIL, buyPrice: '40', buyFrom: snap(RELIE_MAIL) },
  93902: { numero: '7', title: TITRE, price: 70, buyFromId: RELIE_SANS, buyPrice: '40', buyFrom: snap(RELIE_SANS) },
};
const HORS = [{ id: 'ob_banc1', title: 'Nike Dunk Low gris 41', price: '25', date: new Date(sc.NOW - 3 * J).toISOString().slice(0, 10), source: 'Marché de la Croix-Rousse' }];
const main = (sombre) => sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: NUMEROS, vinted_offvinted_buys: HORS, vinted_used_numeros: ['1', '5', '6', '7'] });
// Le reçu e-mail de 91000051 (forme `email_achat_*` : la colonne `meta` est servie depuis `data`).
const RECU = { id: 'email_achat_banc51', data: { subject: 'Ton reçu pour « Adidas Spezial noir 42 »', article: TITRE, prix: '40,00', transaction: RELIE_MAIL, account: 'boutique_nord', receivedAt: iso(sc.NOW - 39 * J), type: 'achat',
  texte: `Article : ${TITRE}\nPrix : 37,30 €\nFrais de port : 2,70 €\nMontant payé : 40,00 €\nTransaction : ${RELIE_MAIL}` } };
const ROWS = [{ ...sc.ligneListings(U, [listing]), data: { ...sc.ligneListings(U, [listing]).data, capturedAt: iso(sc.NOW - 60e3) } }, sc.lignePurch(U, ACHATS), sc.ligneSold(U, VENTES), RECU];
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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };
// Un petit carré gris pour toutes les photos (aucune image réelle).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
// Le stockage local de l'app (toutes les clés) : où ses écritures arrivent d'abord.
const local = (pg) => pg.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
const ficheLocale = async (pg, id) => { const l = await local(pg); for (const [k, v] of Object.entries(l)) { if (!/vinted_annonce_numeros/.test(k)) continue; try { const o = JSON.parse(v); const x = o && (o[id] || (o.v && o.v[id])); if (x) return x; } catch (_) {} } return null; };
const venteLocale = async (pg, tx) => { const l = await local(pg); for (const [k, v] of Object.entries(l)) { if (!/vinted_sale_overrides/.test(k)) continue; try { const o = JSON.parse(v); if (o && o[tx]) return o[tx]; } catch (_) {} } return null; };
const attendre = async (fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 200)); } return v; };
const sansDebord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function passe(b, nom, ctxOpts, sombre) {
  console.log(`── ${nom}`);
  const ctx = await b.newContext({ ...ctxOpts, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [], telechargements = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('download', (d) => telechargements.push(d.suggestedFilename()));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sb)); } catch (_) {} }, sombre);
  await pg.route('**/images1.vinted.net/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
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

  // ── A. Ventes : la proposition, puis « Choisir un autre achat ».
  await pg.goto(`http://localhost:${PORT}/?tab=ventes&site=vinted`, { waitUntil: 'domcontentloaded' });
  const ligneV = pg.locator('.vrm-sale-row[data-tx="95000001"]').first();
  await ligneV.waitFor({ timeout: 30000 }).catch(() => {});
  const autreV = pg.locator('.vrm-sale-row[data-tx="95000001"] [data-cout-vente-autre]').first();
  await autreV.waitFor({ timeout: 15000 }).catch(() => {});
  const propose = await pg.locator('.vrm-sale-row[data-tx="95000001"] [data-prix-propose]').count();
  dit(propose > 0, `${nom} · A0 · la vente porte la proposition (photo exacte de ${PROPOSE})`);
  dit(await autreV.count() > 0, `${nom} · A1 · à côté de la proposition : « Choisir un autre achat »`);
  await capture(pg, `achats-relier-${nom}-A-vente`);
  if (await autreV.count()) {
    await autreV.evaluate((e) => e.click());
    await pg.locator('[data-relier-feuille] [data-tous-achats]').first().waitFor({ timeout: 15000 }).catch(() => {});
    const r = await pg.evaluate(() => ({ autre: !!document.querySelector('[data-relier-feuille][data-relier-autre]'), sugg: document.querySelectorAll('[data-relier-feuille] [data-suggestion-achat]').length,
      libres: [...document.querySelectorAll('[data-achat-libre]')].map((e) => e.getAttribute('data-achat-libre')) }));
    dit(r.autre && r.sugg === 0, `${nom} · A2 · la feuille part sur la recherche (aucune suggestion)`, JSON.stringify({ autre: r.autre, sugg: r.sugg }));
    dit(r.libres.length === 50 && r.libres.includes(PROPOSE) && r.libres.includes(CHOISI) && !r.libres.includes(RELIE_MAIL), `${nom} · A3 · les 50 achats libres au même titre (les reliés à part)`, `${r.libres.length}`);
    await pg.fill('[data-tous-achats-recherche]', 'spezial');
    await pg.locator('[data-achat-pris]').first().waitFor({ timeout: 5000 }).catch(() => {});
    const pris = await pg.evaluate((t) => { const e = document.querySelector(`[data-achat-pris="${t}"] [data-relier-deja]`); return e ? e.textContent : ''; }, RELIE_MAIL);
    dit(/Déjà relié à N°6/.test(pris), `${nom} · A4 · après une recherche : « Déjà relié à N°6 » visible (après les libres)`, pris);
    const ordre = await pg.evaluate(() => { const l = [...document.querySelectorAll('[data-achat-libre], [data-achat-pris]')]; const i = l.findIndex((e) => e.hasAttribute('data-achat-pris')); return i === -1 || l.slice(i).every((e) => e.hasAttribute('data-achat-pris')); });
    dit(ordre, `${nom} · A4 · les libres d'abord, les déjà reliés ensuite`);
    await capture(pg, `achats-relier-${nom}-A-feuille`);
    if (tactile) {
      const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-relier-feuille] button')].filter((x) => { const bb = x.getBoundingClientRect(); return bb.width && bb.height < 43.5 && !x.closest('[data-filtres-achat]'); }).map((x) => (x.textContent || '').trim().slice(0, 30)));
      dit(!petits.length, `${nom} · A5 · boutons de la feuille ≥ 44 px au doigt`, petits.join(' | '));
    }
    const avant = await ficheLocale(pg, '93900');
    dit(!(avant && avant.buyFromId), `${nom} · A6 · rien n'est relié avant SON clic`, JSON.stringify(avant));
    await pg.locator(`[data-relier-achat="${CHOISI}"]`).scrollIntoViewIfNeeded().catch(() => {});
    await pg.locator(`[data-relier-achat="${CHOISI}"]`).evaluate((e) => e.click());
    const f = await attendre(async () => { const x = await ficheLocale(pg, '93900'); const v = await venteLocale(pg, '95000001'); return (x && x.buyFromId) ? x : (v && v.buyFromId ? v : null); });
    dit(!!f && String(f.buyFromId) === CHOISI, `${nom} · A7 · SON clic relie ${CHOISI} (celui choisi), jamais ${PROPOSE} (celui proposé)`, JSON.stringify(f && { id: f.buyFromId, prix: f.buyPrice }));
    dit(!ecrits.some((x) => x.includes(`"buyFromId":"${PROPOSE}"`)), `${nom} · A7 · aucune écriture ne porte l'achat proposé`);
    dit(!(await pg.locator('[data-relier-feuille]').count()), `${nom} · A8 · la feuille se ferme après le clic`);
  }

  // ── B. Le reçu d'un achat relié S'OUVRE (aucun téléchargement).
  const ouvrirRecap = async (tx) => {
    const croix = pg.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer');
    if (await croix.count()) { await croix.first().click().catch(() => {}); await pg.waitForTimeout(300); }
    const t = pg.locator(`.vrm-sale-row[data-tx="${tx}"] .vrm-ledger-sale-toggle`).first();
    await t.waitFor({ timeout: 10000 }).catch(() => {});
    if (!(await t.count())) return null;
    await t.scrollIntoViewIfNeeded().catch(() => {});
    if (await t.getAttribute('aria-expanded') !== 'true') await t.click();
    const id = await t.getAttribute('aria-controls');
    const zone = pg.locator(`[id="${id}"]`);
    await zone.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    const det = zone.locator('details.vrm-recap-modifier');
    if (await det.count()) await det.evaluate((d) => { d.open = true; });
    return zone;
  };
  const z1 = await ouvrirRecap('95100001');
  const recu1 = z1 && z1.locator(`[data-recu-relie="${RELIE_MAIL}"]`).first();
  dit(!!recu1 && await recu1.count() > 0, `${nom} · B0 · « Reçu d'achat » sur la vente reliée`);
  if (recu1 && await recu1.count()) {
    await recu1.evaluate((e) => e.click());
    await pg.locator('[data-recu-feuille]').first().waitFor({ timeout: 10000 }).catch(() => {});
    dit(await pg.locator('[data-recu-feuille]').count() > 0, `${nom} · B1 · avec un reçu e-mail : la feuille du reçu s'ouvre (celle d'Achats)`);
    await capture(pg, `achats-relier-${nom}-B-recu-feuille`);
    const ret = pg.locator('[data-recu-retour]').first(); if (await ret.count()) await ret.click();
    await pg.waitForTimeout(300);
  }
  const z2 = await ouvrirRecap('95200001');
  const recu2 = z2 && z2.locator(`[data-recu-relie="${RELIE_SANS}"]`).first();
  if (recu2 && await recu2.count()) {
    await recu2.evaluate((e) => e.click());
    await pg.locator('[data-visionneuse-pdf="pret"]').first().waitFor({ timeout: 15000 }).catch(() => {});
    const v = await pg.evaluate(() => { const d = document.querySelector('[data-visionneuse-pdf="pret"]'); return d ? { titre: d.getAttribute('aria-label'), tele: !!d.querySelector('[data-visionneuse-telecharger]'), cadre: (d.querySelector('[data-visionneuse-cadre]') || {}).src || '' } : null; });
    dit(!!v && /^blob:/.test(v.cadre), `${nom} · B2 · sans reçu e-mail : l'attestation s'affiche DANS VRM (visionneuse PDF)`, JSON.stringify(v));
    dit(!!v && v.tele, `${nom} · B3 · « Télécharger » reste dans la visionneuse (geste second)`);
    await capture(pg, `achats-relier-${nom}-B-visionneuse`);
    const fe = pg.locator('[data-visionneuse-fermer]').first(); if (await fe.count()) await fe.click();
  } else dit(false, `${nom} · B2 · « Reçu d'achat » sur la seconde vente reliée`);
  await pg.waitForTimeout(800);
  dit(!telechargements.length, `${nom} · B4 · aucun téléchargement`, telechargements.join(', '));

  // ── C. « Changer l'achat relié » ⇒ « Délier ».
  const z3 = await ouvrirRecap('95200001');
  const ch = z3 && z3.locator('[data-recap-changer-achat]').first();
  if (ch && await ch.count()) {
    await ch.evaluate((e) => e.click());
    await pg.locator('[data-relier-actuel]').first().waitFor({ timeout: 10000 }).catch(() => {});
    dit(await pg.locator(`[data-relier-actuel="${RELIE_SANS}"] [data-relier-delier]`).count() > 0, `${nom} · C1 · la feuille dit « Relié à … » et propose « Délier »`);
    await capture(pg, `achats-relier-${nom}-C-delier`);
    const d = pg.locator('[data-relier-delier]').first();
    if (await d.count()) await d.evaluate((e) => e.click());
    const x = await attendre(async () => { const f = await ficheLocale(pg, '93902'); return f && !f.buyFromId ? f : null; });
    dit(!!x && !x.buyFromId && !x.buyPrice, `${nom} · C2 · « Délier » retire le lien et le prix qu'il avait posé`, JSON.stringify(x && { id: x.buyFromId, prix: x.buyPrice }));
  } else dit(false, `${nom} · C1 · « Changer l'achat relié » sur la vente reliée`);

  // ── D. Annonces → « Sans achat relié » : « Autre achat » à côté de la suggestion.
  await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vinted`, { waitUntil: 'domcontentloaded' });
  const vue = pg.locator('[data-vue-sans-achat]').first();
  await vue.waitFor({ timeout: 30000 }).catch(() => {});
  if (await vue.count()) {
    await vue.evaluate((e) => e.click());
    const ligne = pg.locator('[data-ar-ligne="93000"]').first();
    await ligne.waitFor({ timeout: 15000 }).catch(() => {});
    await pg.locator('[data-ar-ligne="93000"] [data-ar-relier]').first().waitFor({ timeout: 15000 }).catch(() => {});
    const sugg = await ligne.getAttribute('data-ar-sugg-tx').catch(() => '');
    const autre = pg.locator('[data-ar-ligne="93000"] [data-ar-autre]').first();
    dit(!!sugg && await autre.count() > 0, `${nom} · D1 · à côté de « Relier · 40 € » (suggestion ${sugg}) : « Autre achat »`);
    await capture(pg, `achats-relier-${nom}-D-sans-achat`);
    if (await autre.count()) {
      await autre.evaluate((e) => e.click());
      await pg.locator('[data-relier-feuille][data-relier-autre] [data-tous-achats]').first().waitFor({ timeout: 15000 }).catch(() => {});
      const choix = CHOISI_ANN === sugg ? '91000045' : CHOISI_ANN;
      await pg.locator(`[data-relier-achat="${choix}"]`).evaluate((e) => e.click()).catch(() => {});
      const f = await attendre(async () => { const x = await ficheLocale(pg, '93000'); return x && x.buyFromId ? x : null; });
      dit(!!f && String(f.buyFromId) === choix && String(f.buyFromId) !== sugg, `${nom} · D2 · SON clic relie ${choix}, pas la suggestion ${sugg}`, JSON.stringify(f && f.buyFromId));
    }
  } else dit(false, `${nom} · D0 · le filtre « Sans achat relié »`);

  // ── E. « Nouvel achat » hors plateforme.
  await pg.goto(`http://localhost:${PORT}/?tab=achats&achat=1`, { waitUntil: 'domcontentloaded' });
  const form = pg.locator('[data-achat-hors-form]').first();
  await form.waitFor({ timeout: 30000 }).catch(() => {});
  if (await form.count()) {
    await pg.waitForTimeout(600);
    const e = await pg.evaluate(() => {
      const f = document.querySelector('[data-achat-hors-form]');
      const ph = f.querySelector('[data-achat-hors-photo]'), ti = f.querySelector('[data-champ="titre"]'), px = f.querySelector('[data-champ="prix"]');
      const avant = ph && ti ? !!(ph.compareDocumentPosition(ti) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
      const ordre = ['[data-achat-hors-photo]', '[data-champ="titre"]', '[data-champ="prix"]', '[data-champ="lieu"]', '[data-champ="date"]', '[data-champ="numero"]'].map((s) => { const x = f.querySelector(s); return x ? x.getBoundingClientRect().top : null; });
      const gauche = ['[data-champ="titre"]', '[data-champ="prix"]', '[data-champ="lieu"]', '[data-champ="date"]', '[data-champ="numero"]'].map((s) => { const x = f.querySelector(s); return x ? Math.round(x.getBoundingClientRect().left) : null; });
      const puces = [...f.querySelectorAll('[data-source]')].map((x) => ({ s: x.getAttribute('data-source'), r: x.hasAttribute('data-source-recent'), h: x.getBoundingClientRect().height }));
      const btn = f.querySelector('[data-achat-hors-enregistrer]');
      return { avant, ordre, gauche, puces, prix: px ? parseFloat(getComputedStyle(px).fontSize) : 0, photoH: ph ? ph.getBoundingClientRect().height : 0,
        propose: (f.querySelector('[data-achat-hors-num-propose]') || { getAttribute: () => '' }).getAttribute('data-achat-hors-num-propose'), btnH: btn ? btn.getBoundingClientRect().height : 0, numero: (f.querySelector('[data-champ="numero"]') || {}).value };
    });
    const croissant = e.ordre.every((v, i, a) => v != null && (i === 0 || v >= a[i - 1]));
    dit(e.avant && croissant, `${nom} · E1 · photo d'abord, puis nom, prix, où, date, N°`, JSON.stringify(e.ordre));
    dit(e.photoH >= 120, `${nom} · E2 · la photo est une grande tuile`, String(e.photoH));
    dit(e.prix >= 24, `${nom} · E3 · le prix en grand (≥ 24 px)`, String(e.prix));
    dit(e.puces.length && e.puces[0].r && e.puces[0].s === 'Marché de la Croix-Rousse' && e.puces.some((p) => p.s === 'Brocante'), `${nom} · E4 · ses derniers lieux d'abord, puis la liste courte`, JSON.stringify(e.puces.slice(0, 3)));
    if (tactile) dit(e.puces.every((p) => p.h >= 43.5) && e.btnH >= 48, `${nom} · E5 · pastilles ≥ 44 px, gros bouton`, JSON.stringify({ p: e.puces.map((p) => p.h), b: e.btnH }));
    if (tactile) dit(new Set(e.gauche).size === 1, `${nom} · E6 · une seule colonne au téléphone`, JSON.stringify(e.gauche));
    dit(!!e.propose && !e.numero, `${nom} · E7 · le prochain N° libre PROPOSÉ (N°${e.propose}), le champ reste vide`);
    await capture(pg, `achats-relier-${nom}-E-form`);
    if (e.propose) {
      await pg.locator('[data-achat-hors-num-propose]').evaluate((x) => x.click());
      dit((await pg.inputValue('[data-champ="numero"]')) === e.propose, `${nom} · E8 · SON toucher pose le N°${e.propose}`);
      await pg.fill('[data-champ="titre"]', 'Adidas Samba banc 43');
      await pg.fill('[data-champ="prix"]', '18');
      await pg.locator('[data-achat-hors-enregistrer]').evaluate((x) => x.click());
      const pool = await attendre(async () => { const l = await local(pg); for (const [k, v] of Object.entries(l)) if (/vinted_used_numeros/.test(k) && v && v.includes(`"${e.propose}"`)) return v; return null; });
      dit(!!pool, `${nom} · E9 · le N° pris est réservé dans le pool (jamais redonné)`, pool || '');
    }
  } else dit(false, `${nom} · E0 · « Nouvel achat » s'ouvre`);

  // ── F. Les icônes de la navigation.
  const ic = await pg.evaluate(() => {
    const t = [...document.querySelectorAll('nav button, nav a, [role="tablist"] button, .vrm-bottom-nav button, .vrm-side-nav button')];
    const de = (re) => { const b = t.find((x) => re.test((x.getAttribute('aria-label') || '') + ' ' + (x.textContent || ''))); return b ? (b.querySelector('svg') || { innerHTML: '' }).innerHTML : null; };
    return { journee: de(/journ/i), annonces: de(/annonces/i) };
  });
  dit(ic.journee && /M2\.5 17\.5h19/.test(ic.journee), `${nom} · F1 · Ma journée : le soleil levant`, (ic.journee || '').slice(0, 60));
  dit(ic.annonces && /M4\.6 4h14\.8l1\.8 5\.2/.test(ic.annonces), `${nom} · F2 · Annonces : la vitrine`, (ic.annonces || '').slice(0, 60));
  await capture(pg, `achats-relier-${nom}-F-nav`);
  dit(await sansDebord(pg), `${nom} · aucun défilement horizontal`);
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

// La planche avant / après des deux icônes (les tracés lus dans le code de l'app).
async function planche(b) {
  if (!SHOTS) return;
  const app = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8');
  const trace = (n) => { const m = new RegExp(`\\n  ${n}:\\s*<>([\\s\\S]*?)</>,`).exec(app); return m ? m[1] : ''; };
  const svg = (n, c) => `<svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${trace(n)}</svg>`;
  const cellule = (n, l, c) => `<figure>${svg(n, c)}<figcaption>${l}</figcaption></figure>`;
  const rang = (c, fond) => `<section style="background:${fond};color:${c}"><h2>Avant</h2>${cellule('sun', 'Ma journée', c)}${cellule('grid', 'Annonces', c)}<h2>Après</h2>${cellule('soleilLevant', 'Ma journée', c)}${cellule('vitrine', 'Annonces', c)}</section>`;
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;font:15px -apple-system,system-ui,sans-serif}section{display:flex;align-items:center;gap:28px;padding:24px 28px}h2{font-size:13px;opacity:.6;width:52px;margin:0}figure{margin:0;text-align:center}figcaption{font-size:12px;margin-top:6px}</style>${rang('#1d1d1f', '#ffffff')}${rang('#f5f5f7', '#000000')}`;
  const pg = await b.newPage({ viewport: { width: 760, height: 260 } });
  await pg.setContent(html);
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.screenshot({ path: path.join(SHOTS, 'icones-avant-apres.png'), fullPage: true });
  await pg.close();
}

(async () => {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    const seul = (process.env.BANC_PASSES || '').split(',').filter(Boolean);
    const passes = [
      ['390', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'fr-FR' }, false],
      ['390-sombre', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', locale: 'fr-FR' }, true],
      ['1512', { viewport: { width: 1512, height: 950 }, locale: 'fr-FR' }, false],
      ['1512-sombre', { viewport: { width: 1512, height: 950 }, colorScheme: 'dark', locale: 'fr-FR' }, true],
    ];
    for (const [n, o, s] of passes) if (!seul.length || seul.includes(n)) await passe(b, n, o, s);
    await planche(b);
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }
  await b.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge' : '✅ Achats : autre achat, reçu ouvert, nouvel achat, icônes'} (${ok} verts)`);
  process.exit(ko ? 1 : 0);
})();
