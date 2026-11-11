// Banc : FACTURES PRO, LOT Q (10 nov.) — Argent → Factures : « À envoyer » (prouvées ⇒
// « Tout envoyer » confirmé ; pas prouvées ⇒ la raison ; vente annulée ⇒ l'avoir PROPOSÉ),
// le registre d'une période (trous dits) et son zip (PDF + CSV) relu ; « Ma facture » :
// l'envoi automatique ÉTEINT par défaut, allumé seulement après SA confirmation, la pause dite.
// Données INVENTÉES (dépôt public), aucune ligne en base réelle.
// Il juge la RÈGLE (data-*, requêtes, octets du zip), au téléphone (390 tactile) et sur
// ordinateur (1512), en clair ET en sombre ; 44 px, aucun débordement, aucune erreur.
// Lancer : npm run build && BANC_PORT=$((20000+RANDOM%20000)) node scripts/bancs/factures-pro-2.cjs
// Captures : SHOTS=<dossier> …   Un seul format : SEUL="390 clair"
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 11652);
const SHOTS = process.env.SHOTS || '';
const SEUL = process.env.SEUL || '';

const maintenant = new Date(2026, 10, 10, 15, 30, 0);
const il = (n, h = 12, m = 0) => { const d = new Date(maintenant); d.setHours(h, m, 0, 0); d.setDate(d.getDate() - n); return d; };
const plus = (d, sec) => new Date(d.getTime() + sec * 1000).toISOString();
const A = '111';
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_banc', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = ['900123450', '900123451', '900123452', '900123453', '900123454', '900123455', '900123456', '900123457', '900123458', '900123459'].find(luhn);
const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();
const CFG = { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'franchise', prefixe: 'FA', couleur: '#0071e3', email: 'boutique@banc.test' };
const D = { v7001: il(0, 11), v7003: il(1, 10), v7005: il(2, 14), v7010: il(3, 9), v7002: il(4, 10) };
const vente = (id, titre, prix, d, extra = {}) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande expédiée et en cours d’acheminement !', transaction_user_status: 'completed', date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${id}/f800/${id}.jpeg?s=x` }, ...extra });
const mail = (id, tx, nom, prix, recu) => ({ id, data: { type: 'vente', pro: true, transaction: tx, nomComplet: nom, adresse: 'rue Inventée, 12, Paris, 75011, FR, France', email: `${nom.split(' ')[0].toLowerCase()}.banc@exemple.test`, designation: `Paire banc ${tx}`, prix, account: 'boutique_banc', uid: A, receivedAt: recu } });
let contenuDe = null;      // fabriqué avec la VRAIE règle (src/facturePro/regle.js), au premier lancement
const facture = (tx, numero, d, extra = {}) => ({ id: 'email_invoice_tx' + tx, data: { type: 'facture_pro', number: numero, status: 'emise', transaction: String(tx), emiseLe: d.toISOString(), preuve: { tx: String(tx) }, buyerEmail: extra.email || '', contenu: contenuDe(numero, tx, d, extra), ...(extra.data || {}) } });
let ecritures = [];
let emis = {};
const lignes = () => { const m = new Map(); for (const r of lignesBrutes()) m.set(r.id, r); return [...m.values()]; };
const lignesBrutes = () => [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [
    vente(7001, 'Paire banc 7001', 65, D.v7001), vente(7003, 'Paire banc 7003', 80, D.v7003), vente(7005, 'Paire banc 7005', 40, D.v7005),
    vente(7010, 'Paire banc 7010', 55, D.v7010, { status: 'Commande annulée' }), vente(7002, 'Paire banc 7002', 90, D.v7002),
  ] } } },
  { id: `harvest_${A}_profile`, data: { uid: A, capturedAt: cap, payload: { user: { id: Number(A), login: 'boutique_banc', business: true, business_account_id: 4242 } } } },
  mail('email_sale_a1', '7001', 'Marie Banc', '65.00', plus(D.v7001, 60)),
  mail('email_sale_a3', '7003', 'Paul Banc', '80.00', plus(D.v7003, 40)),
  mail('email_sale_a5', '7005', 'Léa Banc', '40.00', plus(D.v7005, 3 * 3600)),
  mail('email_sale_a10', '7010', 'Tom Banc', '55.00', plus(D.v7010, 50)),
  mail('email_sale_a2', '7002', 'Jean Banc', '90.00', plus(D.v7002, 30)),
  // Brouillons d'avant le 2 nov., numérotés 1 à 3, jamais émis (le n° 4 manque : un trou dit).
  ...[1, 2, 3].map((n) => ({ id: 'email_invoice_tx600' + n, data: { type: 'facture_pro', number: `FA-2026-000${n}`, status: 'draft', transaction: '600' + n } })),
  facture(7002, 'FA-2026-0005', il(4, 11), { nom: 'Jean Banc', email: 'jean.banc@exemple.test', centimes: 9000, data: { status: 'sent', envoi: { etat: 'envoyee', at: il(4, 11).toISOString(), a: 'jean.banc@exemple.test', via: 'vrm' }, envois: [{ etat: 'envoyee', at: il(4, 11).toISOString(), a: 'jean.banc@exemple.test', via: 'vrm' }] } }),
  facture(7003, 'FA-2026-0007', il(1, 11), { nom: 'Paul Banc', email: 'paul.banc@exemple.test', centimes: 8000 }),
  facture(7010, 'FA-2026-0006', il(3, 10), { nom: 'Tom Banc', email: 'tom.banc@exemple.test', centimes: 5500 }),
  ...Object.entries(emis).map(([id, d]) => ({ id, data: d })),
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
let requetesApi = [];
let etatAuto = { at: null, pause: null, essais: [] };
const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && /FacturePro|facture/i.test(m.text())) errs.push(m.text()); });
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(([s]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', '1'); } catch (_) {} }, [!!sombre]);
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#ccc"/></svg>' }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') { ecritures.push({ url: u, corps: route.request().postData() || '' }); return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); }
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const L = lignes();
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const egal = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=eq\.([^&]*)/g)];
    const nuls = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => egal.every(([, k, v]) => String(r.data[k]) === v) && nuls.every(([, k, non]) => (r.data[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(L.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/compte?mode=facture-pro', async (r) => {
    const q = r.request(); const corps = q.method() === 'POST' ? JSON.parse(q.postData() || '{}') : null;
    requetesApi.push(corps || { get: true });
    const rep = (code, x) => r.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(x) });
    if (!corps) return rep(200, { ok: true, coffre: true, boite: { etat: 'aucune' }, fournisseurs: { gmail: { l: 'Gmail' } }, prochain: 8, vrm: { pret: true, manque: [], plafond: 50, aujourdhui: 0 }, auto: etatAuto });
    if (corps.action === 'emettre') {
      const c = contenuDe('FA-2026-0008', Number(corps.tx), maintenant, { nom: 'Marie Banc', email: 'marie.banc@exemple.test', centimes: 6500 });
      emis['email_invoice_tx' + corps.tx] = { type: 'facture_pro', number: 'FA-2026-0008', status: 'emise', transaction: corps.tx, emiseLe: c.emiseLe, preuve: { tx: corps.tx }, contenu: c };
      return rep(200, { ok: true, facture: { id: 'email_invoice_tx' + corps.tx, numero: 'FA-2026-0008', emise: true, emiseLe: c.emiseLe, contenu: c, envois: [] } });
    }
    if (corps.action === 'envoyer') {
      const id = 'email_invoice_tx' + corps.tx; const L = lignes().find((x) => x.id === id);
      const envoi = { etat: 'envoyee', at: maintenant.toISOString(), a: L.data.contenu.acheteur.email, via: 'vrm' };
      emis[id] = { ...L.data, status: 'sent', envoi, envois: [envoi] };
      return rep(200, { ok: true, issue: 'envoye', envoi, envois: [envoi] });
    }
    if (corps.action === 'avoir') {
      const f = lignes().find((x) => x.id === 'email_invoice_tx' + corps.tx);
      const c = { ...f.data.contenu, type: 'avoir', numero: 'AV-2026-0001', origine: f.data.number, emiseLe: maintenant.toISOString(), totaux: { ht: -f.data.contenu.totaux.ht, tva: null, ttc: -f.data.contenu.totaux.ttc } };
      emis['email_invoice_av' + corps.tx] = { type: 'avoir_pro', number: 'AV-2026-0001', status: 'emise', transaction: corps.tx, emiseLe: c.emiseLe, origine: f.data.number, contenu: c };
      emis['email_invoice_tx' + corps.tx] = { ...f.data, annuleePar: 'AV-2026-0001' };
      return rep(200, { ok: true, avoir: { numero: 'AV-2026-0001' } });
    }
    return rep(400, {});
  });
  await pg.route(/\/api\/(?!compte\?mode=facture-pro)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=invoices`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const mesurer = (pg, sel) => pg.evaluate((sel) => {
  const d = document.querySelector(sel); if (!d) return null;
  const vw = window.innerWidth;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const petites = [...d.querySelectorAll('button, select, input')].filter(vis).filter((e) => e.type !== 'checkbox').map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.height < 43.5).map(([e, r]) => `${Math.round(r.height)}px « ${(e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 24)} »`);
  const hors = [...d.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('svg') && e.getBoundingClientRect().right > vw + 1).map((e) => String(e.className || e.tagName).slice(0, 30));
  return { petites, hors: hors.slice(0, 5), deb: Math.max(document.documentElement.scrollWidth - vw, 0) };
}, sel);
const confirmer = async (pg, nom) => { const b = pg.getByRole('button', { name: nom, exact: true }).last(); await b.waitFor({ timeout: 4000 }); await b.click(); };

(async () => {
  const R = await import(path.join(__dirname, '..', '..', 'src', 'facturePro', 'regle.js'));
  const Z = await import(path.join(__dirname, '..', '..', 'src', 'exportDonnees.js'));
  contenuDe = (numero, tx, d, x) => R.contenuFacture(CFG, { acheteur: { nom: x.nom, adresse: '12 rue Inventée\n75011 Paris', email: x.email }, designation: `Paire banc ${tx}`, centimes: x.centimes, venteLe: d.toISOString(), reference: String(tx), plateforme: 'Vinted' }, { numero, emiseLe: d.getTime() });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    const combos = [[{ width: 390, height: 844 }, false, '390 clair'], [{ width: 1512, height: 982 }, true, '1512 sombre'], [{ width: 390, height: 844 }, true, '390 sombre'], [{ width: 1512, height: 982 }, false, '1512 clair']].filter((c) => !SEUL || c[2] === SEUL);
    for (const [vp, sombre, nom] of combos) {
      console.log(`\n— ${nom}`);
      requetesApi = []; emis = {}; ecritures = [];
      etatAuto = { at: maintenant.toISOString(), pause: { code: 'smtp', texte: "L'envoi par VRM n'est pas encore ouvert : rien n'est parti. Choisis « Depuis ma propre boîte » pour envoyer." }, essais: [{ tx: '7005', issue: 'pas-prouvee', raison: 'acheteur pas prouvé : l’e-mail est arrivé 3 h après la vente', at: maintenant.toISOString() }] };
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      const tel = vp.width < 600; const nf = nom.replace(/\s+/g, '-');
      await essaie('À envoyer', async () => {
        const s = pg.locator('[data-fp-a-envoyer]');
        await s.waitFor({ timeout: 30000 });
        await pg.locator('[data-fp-a-envoyer-tx="7001"]').waitFor({ timeout: 15000 });
        const etats = await s.evaluate((d) => [...d.querySelectorAll('[data-fp-a-envoyer-tx]')].map((x) => `${x.getAttribute('data-fp-a-envoyer-tx')}:${x.getAttribute('data-fp-a-envoyer-etat')}`));
        dit(etats.join(',') === '7001:a-envoyer,7003:a-envoyer,7005:pas-prouvee,7010:a-annuler', '1. la liste : prouvées, pas prouvée, annulée — la plus récente en haut ; l’envoyée (7002) n’y est pas', etats.join(','));
        const t5 = (await pg.locator('[data-fp-a-envoyer-tx="7005"]').innerText()).replace(/\s+/g, ' ');
        dit(/Pas prouvé : .*3 h après/.test(t5) && await pg.locator('[data-fp-a-envoyer-tx="7005"] button').count() === 0, '1. pas prouvée : la raison, AUCUN bouton', t5);
        dit(await pg.locator('[data-fp-proposer-avoir="7010"]').count() === 1, '1. vente annulée facturée : « Émettre l’avoir » PROPOSÉ');
        const m = await mesurer(pg, '[data-fp-a-envoyer]');
        dit(m.deb <= 1 && !m.hors.length, '6. À envoyer : aucun débordement', `${m.deb}px ${m.hors.join(' | ')}`);
        if (tel) dit(!m.petites.length, '6. À envoyer : cibles de 44 px', m.petites.join(' | '));
        if (SHOTS) { await s.scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOTS, `fq-a-envoyer-${nf}.png`) }); }
        // Tout envoyer : confirmation AVANT tout appel.
        requetesApi = [];
        await s.locator('[data-fp-tout-envoyer="2"]').click();
        await pg.getByRole('button', { name: 'Tout envoyer', exact: true }).last().waitFor({ timeout: 4000 });
        dit(requetesApi.filter((x) => x.action).length === 0, '2. « Tout envoyer » : une confirmation AVANT tout appel');
        await confirmer(pg, 'Tout envoyer');
        await pg.locator('[data-fp-lot]').waitFor({ timeout: 10000 });
        const acts = requetesApi.filter((x) => x.action).map((x) => `${x.action}:${x.tx}`);
        dit(acts.join(',') === 'emettre:7001,envoyer:7001,envoyer:7003', '2. une par une : 7001 émise puis envoyée, 7003 (déjà émise) envoyée ; jamais 7005 ni 7010', acts.join(','));
        dit(requetesApi.filter((x) => x.action).every((x) => !('acheteur' in x) && !('email' in x)), '2. le navigateur n’envoie jamais d’acheteur (le serveur relit la preuve)');
        dit(/2 envoyées/.test(await pg.locator('[data-fp-lot]').innerText()), '2. le bilan est dit', await pg.locator('[data-fp-lot]').innerText());
        // L'avoir proposé.
        requetesApi = [];
        await pg.locator('[data-fp-proposer-avoir="7010"]').click();
        await pg.getByRole('button', { name: 'Émettre l’avoir', exact: true }).last().waitFor({ timeout: 4000 }).catch(async () => {});
        dit(requetesApi.filter((x) => x.action).length === 0, '3. l’avoir : confirmation AVANT tout appel');
        await confirmer(pg, "Émettre l'avoir");
        await pg.waitForFunction(() => !document.querySelector('[data-fp-proposer-avoir="7010"]'), null, { timeout: 8000 });
        dit(requetesApi.some((x) => x.action === 'avoir' && x.tx === '7010'), '3. l’avoir de 7010 émis ; la vente sort de la liste');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fq-apres-${nf}.png`) });
      });
      await essaie('Registre', async () => {
        const r = pg.locator('[data-fp-registre-periode]');
        await r.waitFor({ timeout: 8000 });
        await pg.waitForFunction(() => document.querySelector('[data-fp-ligne="AV-2026-0001"]'), null, { timeout: 8000 });
        const per = await r.getAttribute('data-fp-registre-periode');
        const nums = await r.evaluate((d) => [...d.querySelectorAll('[data-fp-ligne]')].map((x) => x.getAttribute('data-fp-ligne')));
        dit(per === '2026-11' && ['FA-2026-0005', 'FA-2026-0006', 'FA-2026-0007', 'FA-2026-0008', 'AV-2026-0001'].every((n) => nums.includes(n)) && !nums.some((n) => /^FA-2026-000[123]$/.test(n)), '4. le registre du mois : factures et avoir émis, pas les brouillons', `${per} · ${nums.join(',')}`);
        dit(/n° 4/.test(await r.locator('[data-fp-trous]').innerText().catch(() => '')), '4. le numéro pris sans pièce est DIT (n° 4)');
        dit(await pg.locator('[data-fp-a-envoyer] button:has-text("Supprimer"), [data-fp-registre-periode] button:has-text("Supprimer")').count() === 0, '4. aucun geste pour supprimer une facture');
        const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), r.locator('[data-fp-export-zip]').click()]);
        const p = await dl.path();
        const fichiers = Z.lireZipStocke(new Uint8Array(fs.readFileSync(p)));
        const pdfs = fichiers.filter((f) => /\.pdf$/.test(f.nom));
        const csv = fichiers.find((f) => /\.csv$/.test(f.nom));
        dit(dl.suggestedFilename() === 'Factures-2026-11.zip' && csv && pdfs.length === nums.length && pdfs.every((f) => f.crcOk && Buffer.from(f.octets).slice(0, 5).toString() === '%PDF-'), '5. le zip : un PDF par pièce de la période (ouvrables) + le registre CSV', `${dl.suggestedFilename()} · ${fichiers.map((f) => f.nom).join(' ')}`);
        dit(csv && csv.texte.trim().split('\r\n').length === nums.length + 1 && /AV-2026-0001;Avoir;/.test(csv.texte) && /;-55,00;/.test(csv.texte), '5. le CSV : une ligne par pièce, l’avoir en négatif', csv && csv.texte.split('\r\n')[1]);
        const m = await mesurer(pg, '[data-fp-registre-periode]');
        dit(m.deb <= 1 && !m.hors.length, '6. registre : aucun débordement', `${m.deb}px ${m.hors.join(' | ')}`);
        if (tel) dit(!m.petites.length, '6. registre : cibles de 44 px', m.petites.join(' | '));
        if (SHOTS) { await r.scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOTS, `fq-registre-${nf}.png`) }); }
      });
      // (11 nov., décision C4) Au téléphone : le geste principal + « … » ; les quatre autres dans une
      // feuille en portail (44 px). Sur ordinateur : les cinq boutons sur la ligne du titre.
      await essaie('Menu des factures (C4)', async () => {
        const vis = (sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), sel);
        if (tel) {
          dit(!(await vis('[data-fac-actions="large"]')) && await vis('[data-fac-actions="tel"] [data-fac-principal]') && await vis('[data-fac-plus]'), 'C4. téléphone : « + Nouvelle facture » et « … » seuls sur la ligne du titre');
          const h = await pg.evaluate(() => [...document.querySelectorAll('[data-fac-actions="tel"] > button')].map((b) => Math.round(b.getBoundingClientRect().height)));
          dit(h.length === 2 && h.every((x) => x >= 44), 'C4. téléphone : deux cibles de 44 px', h.join(','));
          await pg.locator('[data-fac-plus]').click();
          const f = pg.locator('[data-fac-menu]'); await f.waitFor({ timeout: 4000 });
          const g = await f.evaluate((d) => ({ gestes: [...d.querySelectorAll('[data-fac-menu-geste]')].map((b) => b.getAttribute('data-fac-menu-geste') + ':' + Math.round(b.getBoundingClientRect().height)), portail: d.closest('#root') === null }));
          dit(g.gestes.map((x) => x.split(':')[0]).join(',') === 'relire,excel,fiche,reglages' && g.gestes.every((x) => Number(x.split(':')[1]) >= 44) && g.portail, 'C4. « … » : Relire, Excel, Ma facture, Réglages — 44 px, feuille en portail', JSON.stringify(g));
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fq-menu-${nf}.png`) });
          await f.locator('[data-fac-menu-geste="fiche"]').click();
          await pg.waitForFunction(() => !document.querySelector('[data-fac-menu]'), null, { timeout: 4000 });
          dit(true, 'C4. un geste ferme la feuille et agit');
        } else {
          dit(await vis('[data-fac-actions="large"]') && !(await vis('[data-fac-actions="tel"]')), 'C4. ordinateur : les cinq boutons restent sur la ligne du titre, pas de « … »');
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fq-tete-${nf}.png`) });
        }
      });
      await essaie('Envoi automatique', async () => {
        if (!tel) await pg.getByRole('button', { name: 'Ma facture' }).first().click();
        const a = pg.locator('[data-fp-auto]');
        await a.waitFor({ timeout: 8000 });
        dit(await a.getAttribute('data-fp-auto') === 'off' && !(await a.locator('[data-fp-auto-case]').isChecked()), '7. l’envoi automatique est ÉTEINT par défaut');
        ecritures = [];
        await a.locator('[data-fp-auto-case]').click();
        await pg.getByRole('button', { name: 'Activer', exact: true }).last().waitFor({ timeout: 4000 });
        await pg.waitForTimeout(900);
        dit(!ecritures.some((e) => /envoiAuto/.test(e.corps)), '7. rien n’est écrit avant SA confirmation');
        await confirmer(pg, 'Activer');
        await pg.waitForFunction(() => document.querySelector('[data-fp-auto="on"]'), null, { timeout: 4000 });
        await pg.waitForTimeout(1200);
        const w = ecritures.find((e) => /vrm_pro_facture/.test(e.corps) && /envoiAuto/.test(e.corps));
        const d = w ? JSON.parse(w.corps)[0].data : {};
        dit(d.envoiAuto === true && Math.abs(Date.parse(d.envoiAutoDepuis) - maintenant.getTime()) < 120000 && d.siret === SIRET, '7. allumé : `envoiAuto` + sa date écrits, la fiche relue et fusionnée (rien d’écrasé)', JSON.stringify({ a: d.envoiAuto, depuis: d.envoiAutoDepuis }));
        dit(await pg.locator('[data-fp-auto-pause="smtp"]').count() === 1 && /rien n'est parti/.test(await pg.locator('[data-fp-auto-pause]').innerText()), '7. la pause est DITE (serveur d’envoi absent : rien n’est parti)');
        dit(await pg.locator('[data-fp-auto-ratees="1"]').count() === 1, '7. la vente pas envoyée seule est nommée avec sa raison');
        if (SHOTS) { await a.scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOTS, `fq-auto-${nf}.png`) }); }
      });
      dit(!errs.length, '6. aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
