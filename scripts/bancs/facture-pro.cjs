// Banc : LA FACTURE PRO (2 nov., Julien : « une vraie facture, parfaite » ;
// « à côté de chaque vente professionnelle, le bouton “Envoyer la facture à
// l'acheteur” »). Données INVENTÉES (dépôt public), aucune ligne en base réelle.
//
// Il juge la RÈGLE (data-* et requêtes), au téléphone (390 tactile, clair) et sur
// ordinateur (1512, sombre) :
//   1. le bouton n'est que sur une vente PRO prouvée : l'e-mail Vinted Pro de la
//      transaction (7001) ou le profil du compte lu « professionnel » (7003) ;
//      jamais sur un compte particulier (8001) ;
//   2. l'acheteur est prérempli depuis l'e-mail Pro de SA transaction (jamais un
//      autre acheteur, même au même titre — 7004 a le même titre que 7001) ;
//   3. l'aperçu est là, le bouton « Émettre et envoyer » envoie au serveur la
//      transaction, le prix en centimes, l'acheteur ; une confirmation est
//      demandée avant ; le numéro vient du SERVEUR ;
//   4. une facture déjà envoyée se dit sur la vente (n°, date, adresse) ;
//   5. fiche incomplète : la feuille le dit et « Compléter ma fiche » ouvre la fiche
//      sur le bon champ ;
//   6. aucun débordement, cibles de 44 px au téléphone, aucune erreur d'app.
// Lancer : node <construction> && node scripts/bancs/facture-pro.cjs
// Captures : SHOTS=<dossier> node scripts/bancs/facture-pro.cjs
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 4411);
const SHOTS = process.env.SHOTS || '';

const maintenant = new Date(2026, 10, 2, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111', P = '222', B = '333';
let nPhoto = 0;
const vente = (id, titre, prix, d, extra = {}) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` }, ...extra });
const ACCOUNTS = [
  { id: 1, vinted_user_id: A, login: 'boutique_banc', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: P, login: 'perso_banc', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 3, vinted_user_id: B, login: 'pro2_banc', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const cap = maintenant.toISOString();
// Un SIRET inventé, clé de Luhn juste.
const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = ['900123450', '900123451', '900123452', '900123453', '900123454', '900123455', '900123456', '900123457', '900123458', '900123459'].find(luhn);
const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();
const CFG_COMPLETE = { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'franchise', prefixe: 'FA', couleur: '#0071e3', email: 'boutique@banc.test', note: 'Merci pour votre achat !' };
let CFG = CFG_COMPLETE;
const lignes = () => [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [
    vente(7001, 'Asics Metaspeed banc - Taille 43,5', 65, il(0, 11)),
    vente(7002, 'Nike Dunk Low banc', 80, il(3, 10)),
    vente(7004, 'Asics Metaspeed banc - Taille 43,5', 65, il(1, 9)),
  ] } } },
  { id: `harvest_${P}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [vente(8001, 'Adidas Samba banc', 50, il(0, 9))] } } },
  { id: `harvest_${B}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [vente(7003, 'New Balance 550 banc', 95, il(2, 9))] } } },
  // Les profils : A et B professionnels, P particulier (la vraie forme `users/current`).
  { id: `harvest_${A}_profile`, data: { uid: A, capturedAt: cap, payload: { user: { id: Number(A), login: 'boutique_banc', business: true, business_account_id: 4242 } } } },
  { id: `harvest_${P}_profile`, data: { uid: P, capturedAt: cap, payload: { user: { id: Number(P), login: 'perso_banc', business: false, business_account_id: null } } } },
  { id: `harvest_${B}_profile`, data: { uid: B, capturedAt: cap, payload: { user: { id: Number(B), login: 'pro2_banc', business: true, business_account_id: 777 } } } },
  // L'e-mail de vente Vinted Pro de 7001 (forme de `email_sale_*`) et celui d'une AUTRE vente.
  { id: 'email_sale_a1', data: { type: 'vente', pro: true, transaction: '7001', pseudo: 'acheteuse_banc', nomComplet: 'Marie Banc', adresse: '12 rue Inventée, 75011, Paris, FR, France', email: 'marie.banc@exemple.test', designation: 'Asics Metaspeed banc - Taille 43,5', prix: '65.00', account: 'boutique_banc', uid: A, receivedAt: il(0, 11).toISOString() } },
  { id: 'email_sale_a2', data: { type: 'vente', pro: true, transaction: '7999', pseudo: 'autre_banc', nomComplet: 'Paul Autre', adresse: '3 place X, 69001, Lyon, FR, France', email: 'paul.autre@exemple.test', designation: 'Asics Metaspeed banc - Taille 43,5', prix: '65.00', account: 'boutique_banc', uid: A, receivedAt: il(1, 11).toISOString() } },
  // 7002 : facture déjà émise et envoyée.
  { id: 'email_invoice_tx7002', data: { type: 'facture_pro', number: 'FA-2026-0005', status: 'sent', transaction: '7002', emiseLe: il(2, 10).toISOString(), envoi: { etat: 'envoyee', at: il(2, 10).toISOString(), a: 'jean.banc@exemple.test' }, contenu: { numero: 'FA-2026-0005', acheteur: { nom: 'Jean Banc' }, totaux: { ttc: 8000 } } } },
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
const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && /FacturePro|facture/i.test(m.text())) errs.push(m.text()); });
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', '1'); } catch (_) {} }, !!sombre);
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
  // La route du serveur : la VRAIE règle (src/facturePro/regle.js) fabrique l'instantané.
  const regle = await import(path.join(__dirname, '..', '..', 'src', 'facturePro', 'regle.js'));
  await pg.route('**/api/compte?mode=facture-pro', async (r) => {
    const q = r.request(); const corps = q.method() === 'POST' ? JSON.parse(q.postData() || '{}') : null;
    requetesApi.push(corps || { get: true });
    const rep = (code, j) => r.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(j) });
    if (!corps) return rep(200, { ok: true, coffre: true, boite: { etat: 'posee', adresse: 'boutique@banc.test', fournisseur: 'gmail' }, fournisseurs: { gmail: { l: 'Gmail' } } });
    if (corps.action === 'emettre') {
      const contenu = regle.contenuFacture(CFG, { ...corps, reference: corps.tx, plateforme: 'Vinted' }, { numero: 'FA-2026-0006', emiseLe: maintenant.getTime() });
      return rep(200, { ok: true, facture: { id: 'email_invoice_tx' + corps.tx, numero: 'FA-2026-0006', emise: true, emiseLe: contenu.emiseLe, contenu } });
    }
    if (corps.action === 'envoyer') return rep(200, { ok: true, issue: 'envoye', envoi: { etat: 'envoyee', at: maintenant.toISOString(), a: 'marie.banc@exemple.test' } });
    return rep(400, {});
  });
  await pg.route(/\/api\/(?!compte\?mode=facture-pro)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.locator('.vrm-sale-row[data-tx] .vrm-ledger-sale-toggle').first().waitFor({ timeout: 30000 });
  await pg.waitForTimeout(1200);
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
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390 clair'], [{ width: 1512, height: 982 }, true, '1512 sombre']]) {
      console.log(`\n— ${nom}`);
      CFG = CFG_COMPLETE; requetesApi = [];
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      const tel = vp.width < 600; const nf = nom.replace(/\s+/g, '-');
      await essaie('compte particulier', async () => {
        const id = await ouvrirVente(pg, '8001');
        await pg.waitForTimeout(800);
        dit(await pg.locator(`[id="${id}"] [data-fp-vente]`).count() === 0, '1. compte PARTICULIER : aucun bouton de facture');
      });
      await essaie('compte pro sans e-mail', async () => {
        const id = await ouvrirVente(pg, '7003');
        await pg.locator(`[id="${id}"] [data-fp-vente="a-faire"]`).waitFor({ timeout: 6000 });
        dit(true, '1. profil du compte lu « professionnel » : le bouton est là, même sans e-mail Pro');
      });
      await essaie('7001 : émettre et envoyer', async () => {
        const id = await ouvrirVente(pg, '7001');
        const bouton = pg.locator(`[id="${id}"] [data-fp-vente="a-faire"]`);
        await bouton.waitFor({ timeout: 6000 });
        dit(/Envoyer la facture à l'acheteur/.test(await bouton.innerText()), '1. « Envoyer la facture à l’acheteur » sur la vente Pro');
        await bouton.click();
        const f = pg.locator('[data-fp-feuille-vente="7001"]');
        await f.waitFor({ timeout: 6000 });
        await f.locator('[data-fp-apercu]').waitFor({ timeout: 6000 });
        const v = await f.evaluate((d) => ({ nom: d.querySelector('input').value, email: d.querySelector('input[type=email]').value, adr: d.querySelector('textarea').value, txt: d.innerText }));
        dit(v.nom === 'Marie Banc' && v.email === 'marie.banc@exemple.test' && /75011/.test(v.adr), '2. l’acheteur vient de l’e-mail Pro de SA transaction', `${v.nom} · ${v.email}`);
        dit(!/Paul Autre/.test(v.txt), '2. jamais l’acheteur d’une autre vente au même titre');
        dit(/TVA non applicable, art\. 293 B du CGI/.test(v.txt) && /Boutique Banc EI/.test(v.txt) && /65,00 €/.test(v.txt), '3. l’aperçu porte la mention, « EI », le prix', '');
        dit(/N° donné à l’émission/.test(v.txt), '3. l’aperçu ne montre aucun numéro inventé');
        const m = await mesurer(pg, '[data-fp-feuille-vente="7001"]');
        dit(m.deb <= 1 && !m.hors.length, '6. feuille : aucun débordement horizontal', `${m.deb}px ${m.hors.join(' | ')}`);
        if (tel) dit(!m.petites.length, '6. feuille : cibles de 44 px', m.petites.join(' | '));
        if (SHOTS) { await pg.screenshot({ path: path.join(SHOTS, `fp-feuille-${nf}.png`) }); }
        requetesApi = [];
        await f.locator('[data-fp-emettre-envoyer]').click();
        const ok = pg.getByRole('button', { name: 'Émettre et envoyer' }).last();
        await ok.waitFor({ timeout: 4000 });
        dit(requetesApi.filter((x) => x.action).length === 0, '3. une confirmation AVANT tout envoi au serveur');
        await ok.click();
        await f.locator('[data-fp-envoi="envoyee"]').waitFor({ timeout: 8000 });
        const em = requetesApi.find((x) => x.action === 'emettre') || {};
        dit(em.tx === '7001' && em.centimes === 6500 && em.acheteur && em.acheteur.email === 'marie.banc@exemple.test' && em.confirme === true, '3. émission : transaction, 6500 centimes, acheteur, confirmé', JSON.stringify(em).slice(0, 160));
        dit(requetesApi.some((x) => x.action === 'envoyer' && x.tx === '7001'), '3. puis l’envoi de CETTE facture');
        const apres = await f.innerText();
        dit(/Facture FA-2026-0006/.test(apres) && /à marie\.banc@exemple\.test/.test(apres) && !/pas encore envoyée/.test(apres), '3. après l’envoi : « Envoyée », le numéro du serveur et l’adresse — jamais « pas encore envoyée »', apres.replace(/\s+/g, ' ').slice(0, 140));
        dit(await f.locator('[data-fp-envoyer]').innerText() === 'Renvoyer', '3. le geste devient « Renvoyer » (jamais un second envoi sans le dire)');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fp-envoyee-${nf}.png`) });
        await pg.keyboard.press('Escape');
        await f.waitFor({ state: 'detached', timeout: 4000 });
        dit(await pg.locator(`[id="${id}"]`).isVisible(), '6. Échap ferme la feuille de facture, pas la vente dessous');
      });
      await essaie('7002 : déjà envoyée', async () => {
        const id = await ouvrirVente(pg, '7002');
        const l = pg.locator(`[id="${id}"] [data-fp-vente="envoyee"]`);
        await l.waitFor({ timeout: 6000 });
        const t = await l.innerText();
        dit(/FA-2026-0005/.test(t) && /jean\.banc@exemple\.test/.test(t), '4. une facture envoyée se dit sur la vente (n°, adresse)', t.replace(/\s+/g, ' '));
      });
      dit(!errs.length, '6. aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
      // Fiche incomplète.
      CFG = { ...CFG_COMPLETE, siret: '', tva_regime: '' };
      const o2 = await ouvrir(b, vp, sombre);
      await essaie('fiche incomplète', async () => {
        const id = await ouvrirVente(o2.pg, '7001');
        await o2.pg.locator(`[id="${id}"] [data-fp-vente="a-faire"]`).click();
        const f = o2.pg.locator('[data-fp-feuille-vente="7001"]');
        await f.waitFor({ timeout: 6000 });
        const etat = f.locator('[data-fp-etat]');
        dit(await etat.getAttribute('data-fp-etat') === '2' && /SIRET/.test(await etat.innerText()), '5. fiche incomplète : la feuille dit ce qui manque (SIRET, TVA)', await etat.innerText());
        dit(await f.locator('[data-fp-emettre-envoyer]').isDisabled(), '5. … et rien ne peut être émis');
        await f.locator('[data-fp-completer]').click();
        const fi = o2.pg.locator('[data-fp-feuille-fiche] [data-fp-fiche="incomplete"]');
        await fi.waitFor({ timeout: 6000 });
        const focus = await o2.pg.evaluate(() => { const a = document.activeElement; const c = a && a.closest('[data-fp-champ]'); return c ? c.getAttribute('data-fp-champ') : null; });
        dit(focus === 'siret', '5. « Compléter ma fiche » ouvre la fiche, le doigt sur le SIRET', String(focus));
        const m = await mesurer(o2.pg, '[data-fp-feuille-fiche]');
        dit(m.deb <= 1 && !m.hors.length, '6. fiche : aucun débordement', `${m.deb}px ${m.hors.join(' | ')}`);
        if (tel) dit(!m.petites.length, '6. fiche : cibles de 44 px', m.petites.join(' | '));
        if (SHOTS) await o2.pg.screenshot({ path: path.join(SHOTS, `fp-fiche-${nf}.png`), fullPage: false });
      });
      dit(!o2.errs.length, '6. aucune erreur d’app (fiche)', o2.errs.join(' | ').slice(0, 300));
      await o2.ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
