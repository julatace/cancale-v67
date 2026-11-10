// Banc : LOT T (10 nov.) — « Facture en anglais » et « Seuil de TVA » à côté
// des factures. Données INVENTÉES (dépôt public), aucune ligne en base réelle.
// Infrastructure reprise de scripts/bancs/facture-pro.cjs (même fausse base,
// même fausse route qui fabrique l'instantané avec la VRAIE règle).
//
// Il juge la RÈGLE (data-* et requêtes), au téléphone (390 tactile) et sur
// ordinateur (1512), en clair ET en sombre :
//   1. vente à un acheteur en Italie (7010, adresse PROUVÉE) : « Facture en
//      anglais » pré-cochée, l'aperçu « FACTURE / INVOICE », la mention 293 B
//      française PUIS sa traduction, toujours en euros ; décochée ⇒ français ;
//      l'émission envoie `langue: 'en'` ;
//   2. vente en France (7001) : décochée, l'émission envoie `langue: 'fr'` ;
//   3. Argent → Factures : la jauge du seuil de TVA ; CA 70 000 € (82 %) en
//      franchise ⇒ alerte AMBRE, la porte ouvre « Ma facture » sur le régime de
//      TVA ; 88 000 € ⇒ « dépassé » ; TVA classique ⇒ aucune alerte ; pas de
//      ligne publiée (pas su) ⇒ rien du tout ;
//   4. cibles de 44 px au téléphone, aucun débordement, aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=11657 node scripts/bancs/facture-en-tva.cjs
// Captures : SHOTS=<dossier> …
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 11657);
const SHOTS = process.env.SHOTS || '';
const SEUL = process.env.SEUL || '';

const maintenant = new Date(2026, 10, 10, 15, 30, 0);
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
const D = { v7010: il(0, 10), v7001: il(0, 11), v7002: il(3, 10), v7004: il(1, 9), v7005: il(1, 14), v7006: il(2, 16), v7007: il(0, 9), v7008: il(2, 10) };
const mail = (id, tx, nom, email, prix, recu, extra = {}) => ({ id, data: { type: 'vente', pro: true, transaction: tx, pseudo: 'acheteuse_banc', nomComplet: nom, adresse: 'rue Inventée, 12, Paris, 75011, FR, France', email, designation: 'Asics Metaspeed banc - Taille 43,5', prix, account: 'boutique_banc', uid: A, receivedAt: recu, ...extra } });
// Ce que le faux serveur a émis/envoyé pendant le banc (relu par l'app).
let emises = {};
const lignes = () => [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [
    vente(7001, 'Asics Metaspeed banc - Taille 43,5', 65, D.v7001),
    vente(7010, 'New Balance 990 banc', 140, D.v7010),
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
  mail('email_sale_a10', '7010', 'Giulia Banco', 'giulia.banco@exemple.test', '140.00', plus(D.v7010, 45), { adresse: 'Via Inventata, 3, Roma, 00100, IT, Italia' }),
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
let PUBLIE = null;
const ouvrir = async (b, vp, sombre, { tab = 'cat_ventes', stream = false } = {}) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && /FacturePro|facture/i.test(m.text())) errs.push(m.text()); });
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(([s, st, pub]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', '1'); if (st) localStorage.setItem('vrm_stream', '1'); if (pub) localStorage.setItem('vinted_urssaf_mois', JSON.stringify(pub)); else localStorage.removeItem('vinted_urssaf_mois'); } catch (_) {} }, [!!sombre, !!stream, PUBLIE]);
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
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
      const contenu = regle.contenuFacture(CFG, { acheteur: { nom: m.data.nomComplet, adresse: regle.adresseVintedLisible(m.data.adresse), email: m.data.email }, designation: corps.designation, centimes: Math.round(Number(v.price.amount) * 100), venteLe: v.date, reference: corps.tx, plateforme: 'Vinted' }, { numero: 'FA-2026-0006', emiseLe: maintenant.getTime(), langue: corps.langue === 'en' ? 'en' : 'fr' });
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
  const ligneCa = (ca) => ({ at: maintenant.getTime(), mois: [{ ym: '2026-03', ca: ca / 2, n: 10, par: { Vinted: { n: 10, ca: ca / 2 } } }, { ym: '2026-07', ca: ca / 2, n: 10, par: { Vinted: { n: 10, ca: ca / 2 } } }], sources: { Vinted: 'lu' } });
  try {
    const combos = [[{ width: 390, height: 844 }, false, '390 clair'], [{ width: 1512, height: 982 }, true, '1512 sombre'], [{ width: 390, height: 844 }, true, '390 sombre'], [{ width: 1512, height: 982 }, false, '1512 clair']].filter((c) => !SEUL || c[2] === SEUL);
    for (const [vp, sombre, nom] of combos) {
      console.log(`\n— ${nom}`);
      const tel = vp.width < 600; const nf = nom.replace(/\s+/g, '-');
      CFG = CFG_COMPLETE; requetesApi = []; emises = {}; PUBLIE = null;
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie('1. acheteur en Italie', async () => {
        await ligneFacture(pg, '7010').waitFor({ timeout: 8000 });
        await ligneFacture(pg, '7010').scrollIntoViewIfNeeded();
        await ligneFacture(pg, '7010').locator('[data-fp-vente="a-faire"]').click();
        const f = pg.locator('[data-fp-feuille-vente="7010"]');
        await f.locator('[data-fp-apercu]').waitFor({ timeout: 6000 });
        dit(await f.locator('[data-fp-anglais]').getAttribute('data-fp-anglais') === '1', '1. adresse prouvée en Italie : « Facture en anglais » pré-cochée');
        const ap = f.locator('[data-fp-apercu]');
        const t = (await ap.innerText()).replace(/\s+/g, ' ');
        dit(await ap.getAttribute('data-fp-langue') === 'fr-en' && /FACTURE \/ INVOICE/i.test(t) && /TVA non applicable, art\. 293 B du CGI/.test(t) && /VAT not applicable, article 293 B/.test(t) && /140,00\s€/.test(t) && !/\$|£/.test(t),
          '1. l’aperçu bilingue : « FACTURE / INVOICE », la mention française puis sa traduction, en euros', t.slice(0, 160));
        const objet = await f.locator('[data-fp-objet]').innerText();
        dit(/^Facture \/ Invoice FA-2026-0006/.test(objet), '1. l’objet de l’e-mail est bilingue', objet);
        if (SHOTS) { await f.locator('[data-fp-anglais]').scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOTS, `t-anglais-case-${nf}.png`) }); await ap.scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOTS, `t-anglais-apercu-${nf}.png`) }); }
        const c = await f.locator('[data-fp-anglais]').boundingBox();
        if (tel) dit(c && c.height >= 43.5, '4. la case « Facture en anglais » : cible de 44 px', c && String(Math.round(c.height)));
        await f.locator('[data-fp-anglais] input').click();
        await pg.waitForTimeout(150);
        dit(await ap.getAttribute('data-fp-langue') === 'fr' && !/INVOICE/.test(await ap.innerText()), '1. décochée : l’aperçu redevient français seul');
        await f.locator('[data-fp-anglais] input').click();
        await pg.waitForTimeout(150);
        requetesApi = [];
        await f.locator('[data-fp-emettre]').click();
        await pg.getByRole('button', { name: 'Émettre', exact: true }).last().click();
        await pg.waitForTimeout(800);
        const em = requetesApi.find((x) => x.action === 'emettre') || {};
        dit(em.tx === '7010' && em.langue === 'en', '1. l’émission envoie la langue choisie (en)', JSON.stringify(em).slice(0, 160));
        const m = await mesurer(pg, '[data-fp-feuille-vente="7010"]');
        dit(m && m.deb <= 1 && !m.hors.length, '4. feuille : aucun débordement horizontal', m && `${m.deb}px ${m.hors.join(' | ')}`);
        await pg.keyboard.press('Escape');
        await f.waitFor({ state: 'detached', timeout: 4000 }).catch(() => {});
        await pg.waitForTimeout(400);
      });
      await essaie('2. acheteur en France', async () => {
        await ligneFacture(pg, '7001').scrollIntoViewIfNeeded();
        await ligneFacture(pg, '7001').locator('[data-fp-vente="a-faire"]').click();
        const f = pg.locator('[data-fp-feuille-vente="7001"]');
        await f.locator('[data-fp-apercu]').waitFor({ timeout: 6000 });
        dit(await f.locator('[data-fp-anglais]').getAttribute('data-fp-anglais') === '0' && await f.locator('[data-fp-apercu]').getAttribute('data-fp-langue') === 'fr', '2. acheteur en France : case décochée, facture en français');
        requetesApi = [];
        await f.locator('[data-fp-emettre]').click();
        await pg.getByRole('button', { name: 'Émettre', exact: true }).last().click();
        await pg.waitForTimeout(800);
        const em = requetesApi.find((x) => x.action === 'emettre') || {};
        dit(em.tx === '7001' && em.langue === 'fr', '2. l’émission envoie « fr »', JSON.stringify(em).slice(0, 120));
        await pg.keyboard.press('Escape');
      });
      dit(!errs.length, '4. aucune erreur d’app (ventes)', errs.join(' | ').slice(0, 300));
      await ctx.close();

      // 3. Le seuil de TVA sur l'écran Factures.
      const cas = [
        ['proche', ligneCa(70000), CFG_COMPLETE],
        ['depasse', ligneCa(88000), CFG_COMPLETE],
        ['assujetti', ligneCa(88000), { ...CFG_COMPLETE, tva_regime: 'normal', tva_taux: 20, tva: 'FR00' + SIREN }],
        ['passu', null, CFG_COMPLETE],
      ];
      for (const [k, pub, cfg] of cas) {
        PUBLIE = pub; CFG = cfg;
        const o = await ouvrir(b, vp, sombre, { tab: 'invoices' });
        await essaie(`3. seuil ${k}`, async () => {
          await o.pg.getByRole('button', { name: 'Ma facture' }).first().waitFor({ timeout: 20000 });
          await o.pg.waitForTimeout(1500);
          const s = o.pg.locator('[data-seuil-tva]');
          if (k === 'passu') { dit(await s.count() === 0, '3. pas de ligne publiée (pas su) : ni jauge ni alerte'); return; }
          await s.waitFor({ timeout: 8000 });
          const alerte = await s.getAttribute('data-seuil-tva-alerte');
          const t = (await s.innerText()).replace(/\s+/g, ' ');
          if (k === 'proche') {
            const couleur = await s.locator('.vrm-stva-alerte b').evaluate((e) => getComputedStyle(e).color);
            dit(alerte === 'proche' && /Tu factures sans TVA : 82 % du seuil\./.test(t) && /1er janvier 2027/.test(t), '3. 70 000 € en franchise : alerte « 82 % du seuil » et ce que ça change', t.slice(0, 160));
            const [rr, gg, bb2] = (couleur.match(/\d+/g) || []).map(Number);
            dit(rr > 150 && gg > 60 && gg < 200 && bb2 < 90, '3. l’alerte est AMBRE (jamais rouge ni bleue)', couleur);
            if (SHOTS) { await s.scrollIntoViewIfNeeded(); await o.pg.screenshot({ path: path.join(SHOTS, `t-seuil-proche-${nf}.png`) }); }
            const fond = await s.evaluate((e) => getComputedStyle(e).backgroundColor);
            const lum = ((fond.match(/\d+/g) || []).slice(0, 3).map(Number).reduce((x, y) => x + y, 0)) / 3;
            dit(sombre ? lum < 90 : lum > 200, '4. la carte suit le thème (sombre ⇒ fond sombre, jamais un blanc sous un texte clair)', fond);
            const porte = s.locator('[data-seuil-tva-porte="tva_regime"]');
            const bb = await porte.boundingBox();
            if (tel) dit(bb && bb.height >= 43.5, '4. la porte : cible de 44 px', bb && String(Math.round(bb.height)));
            await porte.click();
            await s.locator('[data-seuil-tva-fiche] [data-fp-champ="tva_regime"]').first().waitFor({ timeout: 8000 });
            dit(true, '3. la porte ouvre « Ma facture » sur le régime de TVA');
            if (SHOTS) { await o.pg.waitForTimeout(500); await o.pg.screenshot({ path: path.join(SHOTS, `t-seuil-porte-${nf}.png`) }); }
            const m = await mesurer(o.pg, '[data-seuil-tva]');
            dit(m && m.deb <= 1 && !m.hors.length, '4. jauge : aucun débordement', m && `${m.deb}px ${m.hors.join(' | ')}`);
          } else if (k === 'depasse') {
            dit(alerte === 'depasse' && /Seuil de TVA de 85\s000\s€ dépassé\./.test(t) && /93\s500/.test(t), '3. 88 000 € : « dépassé », TVA au 1er janvier, le seuil majoré dit', t.slice(0, 160));
            if (SHOTS) { await s.scrollIntoViewIfNeeded(); await o.pg.screenshot({ path: path.join(SHOTS, `t-seuil-depasse-${nf}.png`) }); }
          } else {
            dit(alerte === '' && /Tu factures déjà la TVA\./.test(t) && await s.locator('.vrm-stva-alerte').count() === 0, '3. TVA classique : la jauge, aucune alerte', t.slice(0, 120));
          }
        });
        dit(!o.errs.length, `4. aucune erreur d’app (Factures, ${k})`, o.errs.join(' | ').slice(0, 300));
        await o.ctx.close();
      }
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
