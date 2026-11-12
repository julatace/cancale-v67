// Banc : LA FACTURE PRO (2 nov. ; 6 nov., Julien : « à côté [de la vente] le
// bouton pour envoyer la facture à l'acheteur […] tu dois relier avec l'heure de
// la vente pour être sûr d'envoyer à la bonne personne » ; « un endroit où on met
// toutes ses infos et on peut visuellement voir à quoi elle va ressembler »).
// Données INVENTÉES (dépôt public), aucune ligne en base réelle.
//
// Il juge la RÈGLE (data-* et requêtes), au téléphone (390 tactile) et sur
// ordinateur (1512), en clair ET en sombre :
//   1. sur la LIGNE de la vente : « Envoyer la facture » seulement sur une vente
//      Pro PROUVÉE (7001 : même n° dans la vente Vinted et dans l'e-mail de vente
//      Pro, e-mail 60 s après, même prix) ; une vente Pro NON prouvée n'a PAS de
//      bouton et dit pourquoi (7004 : aucun e-mail ; 7005 : e-mail 3 h après ;
//      7006 : prix différent ; 7008 : deux e-mails, deux acheteurs) ; un compte
//      particulier ne montre rien (8001) ;
//   2. la feuille : destinataire (le prouvé, jamais l'acheteur d'une autre vente
//      au même titre), objet, message, APERÇU exact ; confirmation AVANT tout
//      appel ; l'émission n'envoie au serveur aucun acheteur ;
//   3. envoi simulé (fausse route) ⇒ « Facture envoyée le … » sur la feuille ET
//      sur la ligne ; panne (7007 : 503) ⇒ « Pas envoyée », jamais « envoyée » ;
//   4. une facture déjà envoyée se dit sur la ligne ; son journal des envois est
//      caché en mode stream ;
//   5. « Ma facture » : l'aperçu suit la frappe, les trous « à compléter » ; à
//      1512 l'aperçu est À DROITE du formulaire, à 390 il est dessous avec
//      « Voir l'aperçu » ;
//   6. aucun débordement, cibles de 44 px au téléphone, aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=11651 node scripts/bancs/facture-pro.cjs
// Captures : SHOTS=<dossier> …
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 11651);
const SHOTS = process.env.SHOTS || '';
const SEUL = process.env.SEUL || '';

const maintenant = new Date(2026, 10, 6, 15, 30, 0);
const il = (n, h = 12, m = 0, s = 0) => { const d = new Date(maintenant); d.setHours(h, m, s, 0); d.setDate(d.getDate() - n); return d; };
const plus = (d, sec) => new Date(d.getTime() + sec * 1000).toISOString();
const A = '111', P = '222';
let nPhoto = 0;
const vente = (id, titre, prix, d, extra = {}) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande expédiée et en cours d’acheminement !', transaction_user_status: 'completed', date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` }, ...extra });
const ACCOUNTS = [
  { id: 1, vinted_user_id: A, login: 'boutique_banc', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: P, login: 'perso_banc', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const cap = maintenant.toISOString();
const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = ['900123450', '900123451', '900123452', '900123453', '900123454', '900123455', '900123456', '900123457', '900123458', '900123459'].find(luhn);
const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();
const CFG_COMPLETE = { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'franchise', prefixe: 'FA', couleur: '#0071e3', email: 'boutique@banc.test', note: 'Merci pour votre achat !' };
let CFG = CFG_COMPLETE;
const D = { v7001: il(0, 11), v7002: il(3, 10), v7004: il(1, 9), v7005: il(1, 14), v7006: il(2, 16), v7007: il(0, 9), v7008: il(2, 10) };
const mail = (id, tx, nom, email, prix, recu, extra = {}) => ({ id, data: { type: 'vente', pro: true, transaction: tx, pseudo: 'acheteuse_banc', nomComplet: nom, adresse: 'rue Inventée, 12, Paris, 75011, FR, France', email, designation: 'Asics Metaspeed banc - Taille 43,5', prix, account: 'boutique_banc', uid: A, receivedAt: recu, ...extra } });
// Ce que le faux serveur a émis/envoyé pendant le banc (relu par l'app).
let emises = {};
const lignes = () => [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [
    vente(7001, 'Asics Metaspeed banc - Taille 43,5', 65, D.v7001),
    vente(7002, 'Nike Dunk Low banc', 80, D.v7002),
    vente(7004, 'Asics Metaspeed banc - Taille 43,5', 65, D.v7004),
    vente(7005, 'Puma Suede banc', 40, D.v7005),
    vente(7006, 'Vans Old Skool banc', 55, D.v7006),
    vente(7007, 'Salomon XT-6 banc', 120, D.v7007),
    vente(7008, 'Converse Chuck banc', 45, D.v7008),
  ] } } },
  { id: `harvest_${P}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [vente(8001, 'Adidas Samba banc', 50, il(0, 9))] } } },
  { id: `harvest_${A}_profile`, data: { uid: A, capturedAt: cap, payload: { user: { id: Number(A), login: 'boutique_banc', business: true, business_account_id: 4242 } } } },
  { id: `harvest_${P}_profile`, data: { uid: P, capturedAt: cap, payload: { user: { id: Number(P), login: 'perso_banc', business: false, business_account_id: null } } } },
  // 7001 : PROUVÉE (même n°, e-mail 60 s après, même prix). 7999 : MÊME pseudo et même titre, AUTRE n°.
  mail('email_sale_a1', '7001', 'Marie Banc', 'marie.banc@exemple.test', '65.00', plus(D.v7001, 60)),
  mail('email_sale_a2', '7999', 'Paul Autre', 'paul.autre@exemple.test', '65.00', plus(D.v7004, 30)),
  // 7005 : e-mail 3 h après la vente. 7006 : prix différent. 7007 : prouvée (la panne). 7008 : deux acheteurs.
  mail('email_sale_a5', '7005', 'Léa Banc', 'lea.banc@exemple.test', '40.00', plus(D.v7005, 3 * 3600)),
  mail('email_sale_a6', '7006', 'Tom Banc', 'tom.banc@exemple.test', '59.00', plus(D.v7006, 45)),
  mail('email_sale_a7', '7007', 'Nina Banc', 'nina.banc@exemple.test', '120.00', plus(D.v7007, 90)),
  mail('email_sale_a8', '7008', 'Zoé Banc', 'zoe.banc@exemple.test', '45.00', plus(D.v7008, 40)),
  mail('email_sale_a8b', '7008', 'Max Banc', 'max.banc@exemple.test', '45.00', plus(D.v7008, 50)),
  // 7002 : facture déjà émise et envoyée, avec son journal.
  { id: 'email_invoice_tx7002', data: { type: 'facture_pro', number: 'FA-2026-0005', status: 'sent', transaction: '7002', emiseLe: il(2, 10).toISOString(), preuve: { tx: '7002' }, envoi: { etat: 'envoyee', at: il(2, 10).toISOString(), a: 'jean.banc@exemple.test', via: 'vrm' }, envois: [{ etat: 'envoyee', at: il(2, 10).toISOString(), a: 'jean.banc@exemple.test', via: 'vrm' }], contenu: { numero: 'FA-2026-0005', acheteur: { nom: 'Jean Banc' }, totaux: { ttc: 8000 } } } },
  ...Object.entries(emises).map(([tx, d]) => ({ id: 'email_invoice_tx' + tx, data: d })),
  { id: 'vrm_pro_facture', data: CFG },
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf'][k % 4]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

let requetesApi = [];
const ouvrir = async (b, vp, sombre, { tab = 'cat_ventes', stream = false } = {}) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && /FacturePro|facture/i.test(m.text())) errs.push(m.text()); });
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(([s, st]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', '1'); if (st) localStorage.setItem('vrm_stream', '1'); } catch (_) {} }, [!!sombre, !!stream]);
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const L = lignes();
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const egal = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=eq\.([^&]*)/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non) && egal.every(([, k, v]) => String(r.data[k]) === v);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  // La route du serveur : la VRAIE règle (src/facturePro/regle.js) fabrique l'instantané ;
  // l'acheteur vient de la base du banc (comme le serveur, jamais du navigateur).
  const regle = await import(path.join(__dirname, '..', '..', 'src', 'facturePro', 'regle.js'));
  await pg.route('**/api/compte?mode=facture-pro', async (r) => {
    const q = r.request(); const corps = q.method() === 'POST' ? JSON.parse(q.postData() || '{}') : null;
    requetesApi.push(corps || { get: true });
    const rep = (code, j) => r.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(j) });
    if (!corps) return rep(200, { ok: true, coffre: true, boite: { etat: 'aucune' }, fournisseurs: { gmail: { l: 'Gmail' } }, prochain: 6, vrm: { pret: true, manque: [], plafond: 50, aujourdhui: 0 } });
    if (corps.action === 'emettre') {
      const m = lignes().find((x) => /^email_sale_/.test(x.id) && x.data.transaction === corps.tx);
      const v = lignes()[0].data.payload.my_orders.find((o) => String(o.transaction_id) === corps.tx);
      const contenu = regle.contenuFacture(CFG, { acheteur: { nom: m.data.nomComplet, adresse: regle.adresseVintedLisible(m.data.adresse), email: m.data.email }, designation: corps.designation, centimes: Math.round(Number(v.price.amount) * 100), venteLe: v.date, reference: corps.tx, plateforme: 'Vinted' }, { numero: 'FA-2026-0006', emiseLe: maintenant.getTime() });
      emises[corps.tx] = { type: 'facture_pro', number: 'FA-2026-0006', status: 'emise', transaction: corps.tx, emiseLe: contenu.emiseLe, contenu, preuve: { tx: corps.tx } };
      return rep(200, { ok: true, facture: { id: 'email_invoice_tx' + corps.tx, numero: 'FA-2026-0006', emise: true, emiseLe: contenu.emiseLe, contenu, envois: [] } });
    }
    if (corps.action === 'envoyer') {
      if (corps.tx === '7007') return rep(503, { erreur: 'base', message: "La base n'a pas répondu : rien n'est parti. Réessaie." });
      const a = emises[corps.tx].contenu.acheteur.email;
      const envoi = { etat: 'envoyee', at: maintenant.toISOString(), a, via: 'vrm', cc: 'boutique@banc.test' };
      emises[corps.tx] = { ...emises[corps.tx], status: 'sent', envoi, envois: [envoi] };
      return rep(200, { ok: true, issue: 'envoye', envoi, envois: [envoi] });
    }
    return rep(400, {});
  });
  await pg.route(/\/api\/(?!compte\?mode=facture-pro)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  if (tab === 'cat_ventes') { await pg.locator('.vrm-sale-row[data-tx] .vrm-ledger-sale-toggle').first().waitFor({ timeout: 30000 }); await pg.waitForTimeout(1500); }
  return { ctx, pg, errs };
};
const ouvrirVente = async (pg, tx) => {
  const t = pg.locator(`.vrm-sale-row[data-tx="${tx}"] .vrm-ledger-sale-toggle`).first();
  if (await t.getAttribute('aria-expanded') !== 'true') {
    const croix = pg.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer');
    if (await croix.count()) { await croix.first().click(); await pg.locator('.vrm-ledger-drawer-host:not([hidden])').first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(150); }
  }
  await t.scrollIntoViewIfNeeded();
  if (await t.getAttribute('aria-expanded') !== 'true') await t.click();
  const id = await t.getAttribute('aria-controls');
  await pg.locator(`[id="${id}"]`).waitFor({ state: 'visible', timeout: 8000 });
  await pg.waitForTimeout(400);
  return id;
};
const fermerVente = async (pg) => { const croix = pg.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer'); if (await croix.count()) { await croix.first().click(); await pg.waitForTimeout(300); } };
const ligneFacture = (pg, tx) => pg.locator(`.vrm-sale-row[data-tx="${tx}"] [data-fp-forme="ligne"]`).first();

const mesurer = (pg, sel) => pg.evaluate((sel) => {
  const d = document.querySelector(sel); if (!d) return null;
  const vw = window.innerWidth;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('details:not([open]) > :not(summary)'); };
  const petites = [...d.querySelectorAll('button, summary, a.vrm-b, input, select, textarea')].filter(vis).filter((e) => e.type !== 'checkbox' && e.type !== 'file').map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.height < 43.5).map(([e, r]) => `${Math.round(r.height)}px « ${(e.innerText || e.getAttribute('aria-label') || e.name || e.tagName).trim().slice(0, 24)} »`);
  const hors = [...d.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('svg') && e.getBoundingClientRect().right > vw + 1).map((e) => String(e.className || e.tagName).slice(0, 30));
  return { petites, hors: hors.slice(0, 5), deb: Math.max(document.documentElement.scrollWidth - vw, 0), txt: d.innerText };
}, sel);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    const combos = [[{ width: 390, height: 844 }, false, '390 clair'], [{ width: 1512, height: 982 }, true, '1512 sombre'], [{ width: 390, height: 844 }, true, '390 sombre'], [{ width: 1512, height: 982 }, false, '1512 clair']].filter((c) => !SEUL || c[2] === SEUL);
    for (const [vp, sombre, nom] of combos) {
      console.log(`\n— ${nom}`);
      CFG = CFG_COMPLETE; requetesApi = []; emises = {};
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      const tel = vp.width < 600; const nf = nom.replace(/\s+/g, '-');
      await essaie('lignes', async () => {
        await ligneFacture(pg, '7001').waitFor({ timeout: 8000 });
        const l1 = ligneFacture(pg, '7001');
        dit(await l1.locator('[data-fp-vente="a-faire"][data-fp-preuve="ok"]').count() === 1 && /Envoyer la facture/.test(await l1.innerText()), '1. 7001 prouvée : « Envoyer la facture » sur la LIGNE de la vente');
        const raisons = {};
        for (const [tx, code] of [['7004', 'mail'], ['7005', 'heure'], ['7006', 'montant'], ['7008', 'mails']]) {
          const l = ligneFacture(pg, tx);
          await l.waitFor({ timeout: 4000 });
          // (11 nov., lot DJ1) La ligne porte aussi « Bon de retour » : on compte le bouton de FACTURE.
          raisons[tx] = { code: await l.locator('[data-fp-vente="pas-prouve"]').getAttribute('data-fp-preuve').catch(() => null), bouton: await l.locator('[data-fp-vente="a-faire"]').count(), t: (await l.innerText()).replace(/\s+/g, ' ') };
          dit(raisons[tx].code === code && raisons[tx].bouton === 0 && /acheteur pas prouvé/.test(raisons[tx].t), `1. ${tx} : PAS de bouton, la ligne dit pourquoi (${code})`, raisons[tx].t);
        }
        dit(/3 h après/.test(raisons['7005'].t) && /e-mail 59,00\s€, Vinted 55,00\s€/.test(raisons['7006'].t), '1. la raison est précise (l’écart d’heure, les deux prix)', raisons['7005'].t + ' | ' + raisons['7006'].t);
        dit(await pg.locator('.vrm-sale-row[data-tx="8001"] [data-fp-forme]').count() === 0, '1. compte PARTICULIER : rien sur la ligne');
        const l2 = ligneFacture(pg, '7002');
        dit(/Facture envoyée le/.test(await l2.innerText()) && await l2.locator('[data-fp-vente="envoyee"]').count() === 1, '4. 7002 déjà envoyée : « Facture envoyée le … » sur la ligne', (await l2.innerText()).replace(/\s+/g, ' '));
        if (SHOTS) { await pg.locator('.vrm-sale-row[data-tx="7001"]').first().scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOTS, `fp-lignes-${nf}.png`) }); await pg.locator('.vrm-sale-row[data-tx="7005"]').first().scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOTS, `fp-pas-prouve-${nf}.png`) }); }
      });
      await essaie('fiche de la vente 7004', async () => {
        const id = await ouvrirVente(pg, '7004');
        const f = pg.locator(`[id="${id}"] [data-fp-forme="fiche"]`);
        await f.waitFor({ timeout: 6000 });
        dit(await f.locator('[data-fp-vente="a-faire"]').count() === 0 && /acheteur pas prouvé/.test(await f.innerText()), '1. fiche de la vente non prouvée : pas de bouton de facture, la raison', (await f.innerText()).replace(/\s+/g, ' '));
        await fermerVente(pg);
      });
      await essaie('7001 : la feuille, puis l’envoi', async () => {
        await ligneFacture(pg, '7001').scrollIntoViewIfNeeded();
        await ligneFacture(pg, '7001').locator('[data-fp-vente="a-faire"]').click();
        const f = pg.locator('[data-fp-feuille-vente="7001"]');
        await f.waitFor({ timeout: 6000 });
        await f.locator('[data-fp-apercu]').waitFor({ timeout: 6000 });
        const t = (await f.innerText()).replace(/\s+/g, ' ');
        dit(/Marie Banc/.test(t) && /marie\.banc@exemple\.test/.test(t) && !/Paul Autre|paul\.autre/.test(t), '2. destinataire : l’acheteur PROUVÉ (jamais celui de 7999, même pseudo, même titre)', t.slice(0, 160));
        dit(/Acheteur prouvé : le même n° de transaction \(7001\)/.test(t) && /arrivé 60 s après la vente/.test(t), '2. la feuille dit POURQUOI c’est le bon acheteur (n°, 60 s, montant)', (/Acheteur prouvé[^.]*\./.exec(t) || [''])[0]);
        dit(await f.locator('[data-fp-objet]').innerText() === 'Facture FA-2026-0006 — Boutique Banc EI' && /Boutique Banc EI via VRM/.test(t) && /Bonjour Marie Banc/.test(t), '2. l’objet, l’expéditeur « … via VRM » et le message', await f.locator('[data-fp-objet]').innerText());
        const ap = (await f.locator('[data-fp-apercu]').innerText()).replace(/\s+/g, ' ');
        dit(/TVA non applicable, art\. 293 B du CGI/.test(ap) && /Boutique Banc EI/.test(ap) && /65,00\s€/.test(ap) && /Marie Banc/.test(ap) && /12 rue Inventée/.test(ap), '2. l’aperçu exact : mention, « EI », prix, acheteur et son adresse', ap.slice(0, 120));
        const m = await mesurer(pg, '[data-fp-feuille-vente="7001"]');
        dit(m.deb <= 1 && !m.hors.length, '6. feuille : aucun débordement horizontal', `${m.deb}px ${m.hors.join(' | ')}`);
        if (tel) dit(!m.petites.length, '6. feuille : cibles de 44 px', m.petites.join(' | '));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fp-feuille-${nf}.png`) });
        requetesApi = [];
        await f.locator('[data-fp-emettre-envoyer]').click();
        const okb = pg.getByRole('button', { name: 'Envoyer', exact: true }).last();
        await okb.waitFor({ timeout: 4000 });
        dit(requetesApi.filter((x) => x.action).length === 0, '2. une confirmation AVANT tout appel au serveur');
        await okb.click();
        await f.locator('[data-fp-envoi="envoyee"]').waitFor({ timeout: 8000 });
        const em = requetesApi.find((x) => x.action === 'emettre') || {};
        dit(em.tx === '7001' && em.confirme === true && !('acheteur' in em) && !('centimes' in em), '2. l’émission n’envoie au serveur que la transaction (aucun acheteur, aucun prix : le serveur relit la preuve)', JSON.stringify(em).slice(0, 160));
        dit(requetesApi.some((x) => x.action === 'envoyer' && x.tx === '7001'), '3. puis l’envoi de CETTE facture');
        const apres = (await f.innerText()).replace(/\s+/g, ' ');
        dit(/Facture envoyée le/.test(apres) && /à marie\.banc@exemple\.test, par VRM, toi en copie/.test(apres) && /Journal des envois/.test(apres), '3. après l’envoi : « Facture envoyée le … », à qui, par VRM, le journal', apres.slice(0, 200));
        dit(await f.locator('[data-fp-envoyer]').innerText() === 'Renvoyer', '3. le geste devient « Renvoyer » (jamais un second envoi sans le dire)');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fp-envoyee-${nf}.png`) });
        await pg.keyboard.press('Escape');
        await f.waitFor({ state: 'detached', timeout: 4000 });
        await pg.waitForTimeout(800);
        const l1 = (await ligneFacture(pg, '7001').innerText()).replace(/\s+/g, ' ');
        dit(/Facture envoyée le/.test(l1) && /FA-2026-0006/.test(l1), '3. … et la LIGNE de la vente le dit aussi', l1);
      });
      await essaie('7007 : panne', async () => {
        await ligneFacture(pg, '7007').scrollIntoViewIfNeeded();
        await ligneFacture(pg, '7007').locator('[data-fp-vente="a-faire"]').click();
        const f = pg.locator('[data-fp-feuille-vente="7007"]');
        await f.locator('[data-fp-emettre-envoyer]').waitFor({ timeout: 6000 });
        await f.locator('[data-fp-emettre-envoyer]').click();
        await pg.getByRole('button', { name: 'Envoyer', exact: true }).last().click();
        await f.locator('[data-fp-retour="ko"]').waitFor({ timeout: 8000 });
        const t = (await f.innerText()).replace(/\s+/g, ' ');
        dit(/Pas envoyée/.test(t) && /rien n'est parti/.test(t) && !/Facture envoyée le/.test(t) && await f.locator('[data-fp-envoi="envoyee"]').count() === 0, '3. panne à l’envoi (503) : « Pas envoyée », jamais « envoyée »', t.slice(0, 220));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fp-panne-${nf}.png`) });
        await pg.keyboard.press('Escape');
        await f.waitFor({ state: 'detached', timeout: 4000 });
        await pg.waitForTimeout(600);
        const l = (await ligneFacture(pg, '7007').innerText()).replace(/\s+/g, ' ');
        dit(!/envoyée le/.test(l) && /pas encore envoyée/.test(l), '3. … et la ligne dit « émise, pas encore envoyée »', l);
      });
      dit(!errs.length, '6. aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();

      // Le journal des envois en mode stream : le destinataire est caché.
      if (nom === '1512 clair' || nom === '390 clair') {
        const o3 = await ouvrir(b, vp, sombre, { stream: true });
        await essaie('stream', async () => {
          await ligneFacture(o3.pg, '7002').locator('[data-fp-vente="envoyee"]').click();
          const f = o3.pg.locator('[data-fp-feuille-vente="7002"]');
          await f.locator('[data-fp-journal]').waitFor({ timeout: 6000 });
          await o3.pg.waitForTimeout(400);
          const t = await f.innerText();
          dit(!/jean\.banc@/.test(t) && /•••/.test(t), '4. mode stream : le destinataire du journal des envois est caché', t.replace(/\s+/g, ' ').slice(0, 200));
        });
        await o3.ctx.close();
      }

      // « Ma facture » : l'aperçu suit la frappe.
      CFG = { ...CFG_COMPLETE, nom: '', siret: '', tva_regime: '' };
      const o2 = await ouvrir(b, vp, sombre, { tab: 'invoices' });
      await essaie('Ma facture', async () => {
        const btn = o2.pg.getByRole('button', { name: 'Ma facture' }).first();
        await btn.waitFor({ timeout: 20000 });
        await btn.click();
        const fiche = o2.pg.locator('[data-fp-fiche="incomplete"]').first();
        await fiche.waitFor({ timeout: 8000 });
        const ap = fiche.locator('[data-fp-apercu]');
        await ap.waitFor({ timeout: 6000 });
        const trous = await ap.evaluate((d) => [...d.querySelectorAll('[data-fp-trou]')].map((x) => x.getAttribute('data-fp-trou')));
        dit(['nom', 'siret', 'tva_regime'].every((x) => trous.includes(x)), '5. fiche incomplète : l’aperçu se dessine, chaque mention manquante « à compléter »', trous.join(','));
        dit(/Prochaine facture : FA-2026-0006/.test(await fiche.innerText()), '5. la numérotation dit le prochain n° (lu au compteur)');
        const champNom = fiche.locator('[data-fp-champ="nom"] input');
        await champNom.fill('Atelier Exemple');
        await o2.pg.waitForTimeout(150);
        const t2 = await ap.innerText();
        dit(/Atelier Exemple EI/.test(t2) && !(await ap.evaluate((d) => !!d.querySelector('[data-fp-trou="nom"]'))), '5. l’aperçu suit la frappe : « Atelier Exemple EI » apparaît, le trou du nom disparaît', t2.replace(/\s+/g, ' ').slice(0, 120));
        const mentions = await fiche.locator('[data-fp-mentions]').getAttribute('data-fp-mentions');
        dit(Number(mentions) < 14, '5. les mentions obligatoires sont comptées (pas toutes là)', `${mentions}/14`);
        const geo = await o2.pg.evaluate(() => { const f = document.querySelector('.vrm-fp-fiche'); const a = document.querySelector('[data-fp-apercu-col]'); const v = document.querySelector('[data-fp-voir-apercu]'); const rf = f.getBoundingClientRect(), ra = a.getBoundingClientRect(); return { fd: rf.right, al: ra.left, ft: rf.bottom, at: ra.top, voir: !!(v && v.getBoundingClientRect().height > 0) }; });
        if (tel) {
          dit(geo.at >= geo.ft - 1 && geo.voir, '5. à 390 : l’aperçu SOUS le formulaire, « Voir l’aperçu » est là', JSON.stringify(geo));
          await fiche.locator('[data-fp-voir-apercu]').click();
          await o2.pg.waitForTimeout(800);
          const vu = await o2.pg.evaluate(() => { const r = document.querySelector('[data-fp-apercu-col]').getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; });
          dit(vu, '5. « Voir l’aperçu » mène à l’aperçu');
        } else dit(geo.al >= geo.fd - 1 && !geo.voir, '5. à 1512 : l’aperçu À DROITE du formulaire', JSON.stringify(geo));
        const m = await mesurer(o2.pg, '.vrm-fp-ma-facture');
        dit(m.deb <= 1 && !m.hors.length, '6. Ma facture : aucun débordement', `${m.deb}px ${m.hors.join(' | ')}`);
        if (tel) dit(!m.petites.length, '6. Ma facture : cibles de 44 px', m.petites.join(' | '));
        if (SHOTS) { await fiche.scrollIntoViewIfNeeded(); await o2.pg.screenshot({ path: path.join(SHOTS, `fp-ma-facture-${nf}.png`) }); if (tel) { await o2.pg.locator('[data-fp-apercu-col]').scrollIntoViewIfNeeded(); await o2.pg.screenshot({ path: path.join(SHOTS, `fp-ma-facture-apercu-${nf}.png`) }); } }
      });
      dit(!o2.errs.length, '6. aucune erreur d’app (Ma facture)', o2.errs.join(' | ').slice(0, 300));
      await o2.ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
