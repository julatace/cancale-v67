// ═══════════════════════════════════════════════════════════════════════════
// BANC : UNE SEULE FICHE PARTOUT (14 nov., proposition 62 choisie par Julien)
//        « Toucher n'importe quelle ligne (vente, colis, annonce, achat) ouvre la
//          même fiche de la paire, avec toutes ses actions. »
//        (node scripts/bancs/fiche-partout.cjs — après le build)
//        BANC_PORT=… · BANC_DIST=… (un autre build) · SHOTS=… (les captures)
//        LISTES=ventes,colis,… (un sous-ensemble) · TOURS=390,1512s… · EXPLORE=1 (inventaire)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles :
//   · 50 paires au MÊME titre (N°201 à N°250, annonces 7200…7249) ; deux vendues
//     (22999990226 → annonce 7226 → N°227 ; 22999990240 → 7240 → N°241, À EXPÉDIER,
//     son bordereau reçu) ; une vente SANS identité (22999990299 : ni N°, ni
//     transaction lue) ; le N°230 porté par DEUX annonces présentes (7229 et 7299) ;
//   · un achat Vinted au point relais (33000000001, son code de retrait), relié au N°206 ;
//   · une annonce Leboncoin (réf. 5 ⇒ N°205), eBay (SKU VRM-209), Vestiaire ;
//   · un meuble du Stock où le N°203 est rangé.
// Il exige, pour CHAQUE liste (Ventes, À expédier, Annonces Vinted / Leboncoin / eBay /
// Vestiaire, Stock, Achats, À retirer, Ma journée), à 390 px tactile et 1512 px, clair
// et sombre :
//   A. toucher une ligne ouvre `[data-fiche-paire]` — LA fiche (FichePaire), sur la
//      paire désignée PAR IDENTITÉ (son N°), ouverte depuis la ligne (`data-fiche-ligne-cle`) ;
//   B. 50 paires au même titre : la ligne du N°227 ouvre le N°227, celle du N°241 le N°241 —
//      jamais une autre ; la vente sans identité ouvre la fiche de la LIGNE (« pas de
//      paire reliée », aucun N°) ; le N°230 en double : rouge, aucune tuile choisie ;
//   C. l'INVENTAIRE : chaque action qui vivait dans la feuille (ou sur la ligne) de la
//      liste est DANS la fiche (mesuré sur origin/main, voir le récit) ;
//   D. retour (geste ←) ferme la fiche et rend la liste AU MÊME DÉFILEMENT ; au doigt,
//      glisser vers le bas ferme la fiche ; la fiche paraît en moins de 150 ms ;
//   E. boutons ≥ 44 px au doigt (36 à la souris) dans la fiche, aucun débordement,
//      aucune erreur de page. Captures : $SHOTS/fp-*.png (À REGARDER).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const SHOTS = process.env.SHOTS || os.tmpdir();
const EXPLORE = process.env.EXPLORE === '1';
const PNG = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'icon-512.png'));

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const ilYaH = (h) => iso(M - h * 3600e3);
const TITRE = 'Nike Dunk Low Panda taille 42';
const photo = (id) => `https://images1.vinted.net/t/${id}/f800/photo.jpeg`;
const FICHES = {};
for (let i = 0; i < 50; i++) FICHES[7200 + i] = { numero: String(201 + i), title: TITRE, numberedAt: '2026-10-22T10:00:00Z', auto: false, buyPrice: String(10 + i), accountId: '111' };
// Le N°230 porté par DEUX annonces présentes (deux paires sous un N°) : le seul rouge.
FICHES[7299] = { numero: '230', title: TITRE, numberedAt: '2026-10-23T10:00:00Z', auto: false, buyPrice: '99', accountId: '111' };
// L'achat 33000000001 relié par SON clic à la paire N°206.
FICHES[7205].buyFromId = '33000000001';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const item = (id, title) => ({ id: Number(id), title, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: { url: photo(id) }, brand_title: 'Nike', size_title: '42', status: 'Très bon état', favourite_count: 3, view_count: 40, created_at_ts: Math.floor((M - 20 * 86400e3) / 1000) });
// (« imagine si j'ai 1000 articles ») 1 000 paires de plus (N°301 à N°1300, annonces 8000…8999), en ligne, et
// 1 000 ventes finalisées de plus (d'autres paires, sans N°) : la fiche s'ouvre sur une liste de cette taille.
const MILLE = Number(process.env.MILLE || 1000);
for (let i = 0; i < MILLE; i++) FICHES[8000 + i] = { numero: String(301 + i), title: `Adidas Samba OG blanc ${36 + (i % 10)} lot ${i}`, numberedAt: '2026-09-01T10:00:00Z', auto: true, accountId: '111' };
const LISTINGS = Array.from({ length: 50 }, (_, i) => item(7200 + i, TITRE)).filter((x) => ![7226, 7210, 7240].includes(x.id)).concat([item(7299, TITRE)])
  .concat(Array.from({ length: MILLE }, (_, i) => item(8000 + i, FICHES[8000 + i].title)));
const vente = (tx, j, prix, extra = {}) => ({ transaction_id: tx, title: TITRE, status: 'Commande finalisée', transaction_user_status: 'completed', price: { amount: prix, currency_code: 'EUR' }, date: ilYa(j), photo: { url: photo(String(tx).slice(-4)) }, ...extra });
const VENTES = [
  vente(22999990226, 5, '70'), vente(22999990210, 6, '70'),
  vente(22999990240, 0.4, '75', { status: 'Le paiement a été validé', transaction_user_status: 'needs_action', conversation_id: 81240 }),
  // Une vente au MÊME titre, sans N° ni transaction lue : aucune identité sûre.
  vente(22999990299, 2, '65', { photo: null }),
].concat(Array.from({ length: MILLE }, (_, i) => ({ ...vente(21000000000 + i, 30 + i / 10, '55'), title: `Vieille vente ${i}` })));
const ACHAT_TX = 33000000001;
const ACHATS = [{ transaction_id: ACHAT_TX, title: 'Nike Dunk Low Panda taille 42 (achat)', price: { amount: '30.0', currency_code: 'EUR' }, status: 'Le colis est disponible au point relais', transaction_user_status: 'needs_action', date: ilYa(3), photo: { url: photo('3301') } }];
const txn = (tx, it, s, su, side = 'seller') => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: iso(M), side, payload: { transaction: { id: tx, item_id: it, status: s, status_title: 'x', status_updated_at: su } } } });
const LBC = 'aaaa1111-0000-4000-8000-00000000000a';
const MEUBLES = [{ id: 'm1', name: 'Étagère banc', cols: 3, rows: 2 }];
const SLOTS = { '7202': { m: 'm1', i: 1 } };
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: FICHES, vinted_used_numeros: Object.values(FICHES).map((f) => f.numero), vrm_meubles: MEUBLES, vrm_slots: SLOTS } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(M - 600e3), payload: { items: LISTINGS, pagination: { total_entries: LISTINGS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), nItems: VENTES.length, payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(M), nItems: ACHATS.length, payload: { my_orders: ACHATS } } },
  txn(22999990226, 7226, 450, ilYa(1)), txn(22999990210, 7210, 300, ilYa(2)), txn(22999990240, 7240, 220, ilYaH(6)),
  txn(ACHAT_TX, 9900001, 300, ilYa(1), 'buyer'),
  { id: 'email_bord_9226', data: { type: 'bordereau', transaction: '22999990226', suivi: '6A11111111111', filename: 'b.pdf', pdfB64: 'JVBERi0x', receivedAt: '2026-11-04T12:00:00.000Z' } },
  { id: 'email_bord_9240', data: { type: 'bordereau', transaction: '22999990240', uid: '111', suivi: '6A24024024024', filename: 'bordereau-22999990240.pdf', pdfB64: 'JVBERi0x', receivedAt: ilYaH(5), modele: TITRE, article: TITRE } },
  { id: 'email_track_achat', data: { type: 'suivi', suivi: '6A33300000001', carrier: 'mondialrelay', status: 'disponible', sens: 'entrant', transaction: String(ACHAT_TX), receivedAt: ilYaH(20), arriveLe: ilYaH(20), code: '482913', lieu: 'Relais Banc, 1 rue du Banc 75001 Paris', limite: iso(M + 5 * 86400e3) } },
  { id: 'lbc_listings', data: { items: { 4100000001: { id: '4100000001', subject: 'Asics Gel-Lyte III gris taille 42', price: 60, ref: '205', customRef: 'VRM-205', account: LBC, accountName: 'Compte_lbc', platform: 'leboncoin', status: 'active', seenAt: ilYaH(0.1), images: [], stats: { favoris: 3, at: ilYaH(1) } } }, lectures: { [LBC]: { at: ilYaH(0.1), total: 1, n: 1 } } } },
  { id: 'lbc_accounts', data: { accounts: { [LBC]: { id: LBC, name: 'Compte_lbc', type: 'particulier', seenAt: ilYaH(0.2), sessionAt: ilYaH(0.2), source: 'session:messagerie' } } } },
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'ebay_comptes', data: { rev: 1, comptes: [{ cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_banc', principal: true, deconnecteLe: null }] } },
  { id: 'ebay_listings', data: { capturedAt: M, items: [{ itemId: '5550001', sku: 'VRM-209', price: '69.00', currency: 'EUR', title: 'Nike Dunk Low Panda taille 42 eBay', depuis: ilYa(10) }] } },
  { id: 'ebay_orders', data: { orders: [], capturedAt: M } },
  { id: 'vc_session', data: { id: 'compteVc', at: ilYaH(0.3), source: 'users/me', comptes: { compteVc: ilYaH(0.3) } } },
  { id: 'vc_listings', data: { capturedAt: ilYaH(0.3), complet: true, total: 1, liens: { 71000009: '212' }, items: { 71000009: { titre: 'Nike Dunk Low Panda Vestiaire', prix: { valeur: 90, devise: 'EUR', cle: 'price' }, statut: 'ON_SALE', compte: 'compteVc', vuAt: ilYaH(0.3), photo: '', favoris: 4, ref: '' } } } },
  { id: 'vc_ventes', data: { lectures: { ventes: { at: ilYaH(0.3) } }, ventes: {} } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && !c ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 300)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
const chemin = (row, src) => { let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/"/g, '')]; return v; };
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop().replace(/"/g, '');
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = chemin(row, src);
    if (/pdfB64$/.test(src)) v = v ? 'true' : null;
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : /->>/.test(src) ? String(v) : v);
  }
  return out;
};
const motif = (p) => new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');
const filtres = (u) => {
  const out = [];
  const qs = u.split('?')[1] || '';
  for (const p of qs.split('&')) {
    const m = /^(data(?:->>|->)[A-Za-z_>-]+)=(eq|in)\.(.*)$/.exec(p); if (m) { const vals = m[2] === 'eq' ? [m[3]] : m[3].replace(/^\(|\)$/g, '').split(','); out.push((r) => { const v = chemin(r, m[1]); return v != null && vals.includes(String(v)); }); continue; }
    const n = /^data->>([A-Za-z_]+)=(not\.)?is\.null$/.exec(p); if (n) out.push((r) => (n[2] ? r.data[n[1]] != null : r.data[n[1]] == null));
  }
  return out;
};

async function preparer(b, vp, { sombre = false, tab = 'journee' } = {}) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', locale: 'fr-FR', ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s, n, m, sl }) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); localStorage.setItem('vrm_meubles', JSON.stringify(m)); localStorage.setItem('vrm_slots', JSON.stringify(sl)); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { s: sombre, n: FICHES, m: MEUBLES, sl: SLOTS });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/images1\.vinted\.net/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }) : ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data$/.test(sel) && sel !== 'data') ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt ? iso(typeof r.data.capturedAt === 'number' ? r.data.capturedAt : Date.parse(r.data.capturedAt)) : iso(M), cap: r.data.capturedAt });
    const f = filtres(u);
    const garde = (l) => l.filter((r) => f.every((x) => x(r)));
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/"/g, '')); return j(garde(ROWS.filter((r) => ids.includes(r.id))).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(garde(ROWS.filter((r) => r.id === eq[1])).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = motif(lk[1]); let l = garde(ROWS.filter((r) => re.test(r.id))); const rg = req.headers()['range']; if (rg) { const mm = /(\d+)-(\d+)/.exec(rg); if (mm) l = l.slice(+mm[1], +mm[2] + 1); } return j(l.map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/email-rattacher\?mode=journal/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: 0, parPage: 20, suite: false, emails: [], compteurs: { sur: 0 }, adresses: [], cherche: '' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs };
}

// ── LES LISTES ─────────────────────────────────────────────────────────────
// `ligne` : la rangée ; `toucher` : son corps (ce qu'un doigt touche) ; `num` : la paire
// attendue (par identité) ; `inventaire` : les actions mesurées sur origin/main dans la
// feuille (ou sur la ligne) de la liste — chacune doit être DANS la fiche.
const LISTES = [
  { cle: 'ventes', tab: 'tab=ventes&site=vinted', ligne: '[data-serie-ligne="22999990226"]', toucher: '[data-serie-ligne="22999990226"] .vrm-ledger-sale-toggle', num: '227', ctx: 'vente',
    inventaire: ['[data-photo-grand]', '[data-cv-emballage-saisir]', '[data-photo-carton-prendre]', '[data-rappel-bouton]', '[data-recap-vinted]', '[data-recap-benef-etat]', '.vrm-recap-modifier'] },
];

const lireFiche = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-fiche-paire]'); if (!el || !el.getClientRects().length) return null;
  const fin = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)').matches;
  return {
    num: el.getAttribute('data-fiche-paire'), ligne: el.getAttribute('data-fiche-ligne-cle'), ctx: el.getAttribute('data-fiche-contexte-ouvert'), identite: el.getAttribute('data-fiche-identite'),
    sansPaire: (el.querySelector('[data-fiche-sans-paire]') || { getAttribute: () => null }).getAttribute('data-fiche-sans-paire'),
    double: !!el.querySelector('[data-fiche-double="1"]'), tuiles: el.querySelectorAll('[data-fiche-resume-achat]').length,
    seuil: fin ? 36 : 44,
    petits: [...el.querySelectorAll('button')].filter((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden' && x.getBoundingClientRect().height < (fin ? 36 : 44) - 0.5).map((x) => (x.getAttribute('aria-label') || x.textContent).slice(0, 30)),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});
// Ce que le toucher a ouvert (inventaire d'origin/main) : feuilles et panneaux visibles, leurs boutons.
const explorer = (pg) => pg.evaluate(() => {
  const vis = (x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden';
  const boites = [...document.querySelectorAll('[role="dialog"],[role="menu"],.vrm-ledger-drawer,[data-fiche-ouverte="1"] .vrm-fiche-plus,[data-plus-ouvert],[data-rp-detail],[data-ouvert="1"]')].filter(vis);
  return boites.map((d) => ({ quoi: (d.className && String(d.className).slice(0, 60)) + ' ' + [...d.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name).join(' ').slice(0, 120),
    actions: [...d.querySelectorAll('button,a[href],[role="menuitem"]')].filter(vis).map((x) => (x.textContent || x.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40) + ' {' + [...x.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name + (a.value ? '=' + a.value.slice(0, 16) : '')).join(' ').slice(0, 90) + '}') }));
});
const amener = async (pg, sel) => { const el = pg.locator(sel).first(); await el.scrollIntoViewIfNeeded({ timeout: 8000 }); await pg.waitForTimeout(250); };
// L'ouverture mesurée DANS la page : de l'heure du toucher (`click`, son timeStamp) à la première image
// où la fiche est posée (MutationObserver puis requestAnimationFrame) — sans l'aller-retour du banc.
const guetter = (pg) => pg.evaluate(() => {
  window.__fpClic = null; window.__fpVu = null;
  document.addEventListener('click', (e) => { if (window.__fpClic == null) window.__fpClic = e.timeStamp; }, { capture: true, once: true });
  const mo = new MutationObserver(() => { const el = document.querySelector('[data-fiche-paire]'); if (el && window.__fpVu == null) { mo.disconnect(); requestAnimationFrame(() => { window.__fpVu = performance.now(); }); } });
  mo.observe(document.body, { childList: true, subtree: true });
});
// LE PLANCHER DE LA MACHINE : ce que coûte, sur CETTE page et à CET instant, poser un voile vide plein
// écran (n'importe quelle feuille de l'app le paie : recalcul de style de tout le document). Les machines de
// banc sont partagées (swiftshader, charge 4 à 16) : la fiche est jugée sur ce qu'elle AJOUTE à ce plancher.
const plancher = (pg) => pg.evaluate(() => {
  const t = () => performance.now(); const v = [];
  for (let k = 0; k < 3; k++) { document.body.offsetHeight; const a = t(); const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:950;background:#fff'; d.innerHTML = '<p>x</p>'; document.body.appendChild(d); document.body.offsetHeight; v.push(t() - a); d.remove(); document.body.offsetHeight; }
  return v.sort((x, y) => x - y)[1];
});
let PLANCHER = 0;
const toucher = async (pg, sel, tel) => {
  const el = pg.locator(sel).first();
  await el.scrollIntoViewIfNeeded({ timeout: 8000 });
  PLANCHER = await plancher(pg);
  await guetter(pg);
  const t0 = await pg.evaluate(() => performance.now());
  if (tel) await el.tap({ timeout: 8000 }); else await el.click({ timeout: 8000 });
  return t0;
};
const attendreFiche = async (pg, t0, n = null) => {
  for (let i = 0; i < 80; i++) {
    const r = await pg.evaluate(({ t0, n }) => { const el = document.querySelector('[data-fiche-paire]'); if (!el || !el.getClientRects().length || window.__fpVu == null) return null; if (n != null && el.getAttribute('data-fiche-paire') !== n) return null; return { ms: window.__fpVu - (window.__fpClic != null ? window.__fpClic : t0) }; }, { t0, n });
    if (r) r.base = PLANCHER;
    if (r) return r;
    await pg.waitForTimeout(25);
  }
  return null;
};
const fermerFiche = (pg) => pg.evaluate(() => { const b = document.querySelector('[data-fiche-fermer]'); if (b) b.click(); });

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const tousTours = { 390: [{ width: 390, height: 844 }, false], '390s': [{ width: 390, height: 844 }, true], 1512: [{ width: 1512, height: 950 }, false], '1512s': [{ width: 1512, height: 950 }, true] };
    const tours = (process.env.TOURS || '390,390s,1512,1512s').split(',').map((k) => tousTours[k]).filter(Boolean);
    const voulues = (process.env.LISTES || '').split(',').filter(Boolean);
    const listes = voulues.length ? LISTES.filter((l) => voulues.includes(l.cle)) : LISTES;
    for (const [vp, sombre] of tours) {
      const tel = vp.width < 600; const TT = `[${vp.width}${sombre ? ' sombre' : ''}]`; const suf = `${vp.width}${sombre ? '-sombre' : '-clair'}`;
      console.log(`── ${vp.width} px${sombre ? ' · sombre' : ' · clair'}`);
      for (const L of listes) {
        const { ctx, pg, errs } = await preparer(b, vp, { sombre, tab: L.tab });
        await essaie(`${L.cle} ${TT}`, async () => {
          await pg.waitForSelector(L.ligne, { timeout: 15000 });
          await pg.waitForTimeout(1500);   // la liste posée (lectures de la coque terminées)
          if (EXPLORE) {
            await toucher(pg, L.toucher, tel); await pg.waitForTimeout(900);
            console.log(`  ${L.cle} ${TT} — ce que le toucher ouvre :`, JSON.stringify(await explorer(pg), null, 1).slice(0, 4000), 'fiche:', JSON.stringify(await lireFiche(pg)));
            await pg.screenshot({ path: path.join(SHOTS, `fp-explore-${L.cle}-${suf}.png`) });
            return;
          }
          await amener(pg, L.toucher);
          // La place de la ligne À L'ÉCRAN (ce que le doigt retrouve), une fois la liste posée.
          const place = () => pg.evaluate((sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().top) : null; }, L.ligne);
          let avant = await place(); for (let i = 0; i < 10; i++) { await pg.waitForTimeout(300); const n = await place(); if (n === avant) break; avant = n; }
          let trace = null; if (process.env.TRACE === '1') { await b.startTracing(pg, { categories: ['devtools.timeline', 'blink.user_timing'] }); trace = true; }
          let cdp = null; if (process.env.PROFIL === '1') { cdp = await ctx.newCDPSession(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
          if (process.env.SONDE) console.log('sonde', JSON.stringify(await pg.evaluate(fs.readFileSync(process.env.SONDE, 'utf8'))));
          const t0 = await toucher(pg, L.toucher, tel);
          const vu = await attendreFiche(pg, t0);
          if (trace) { const buf = await b.stopTracing(); const ev = JSON.parse(buf.toString()).traceEvents || []; const tot = new Map(); for (const e of ev) { if (e.ph === 'X' && e.dur) tot.set(e.name, (tot.get(e.name) || 0) + e.dur); } console.log([...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${(v / 1000).toFixed(1)}ms ${k}`).join('\n')); const clic = ev.find((e) => e.name === 'EventDispatch' && e.args && e.args.data && e.args.data.type === 'click'); const z = clic ? clic.ts : 0; console.log(ev.filter((e) => e.ph === 'X' && e.dur > 4000 && e.ts >= z - 1000).map((e) => `+${Math.round((e.ts - z) / 1000)}ms ${e.name} ${Math.round(e.dur / 1000)}ms ${e.args && e.args.elementCount ? 'el=' + e.args.elementCount : ''} ${e.args && e.args.data && (e.args.data.type || e.args.data.functionName || '')}`).slice(0, 30).join('\n')); }
          if (cdp) { const { profile } = await cdp.send('Profiler.stop'); const self = new Map(); const dt = profile.timeDeltas; const idx = new Map(profile.nodes.map((n) => [n.id, n])); profile.samples.forEach((id, i) => { const n = idx.get(id); const k = n.callFrame.functionName + ' ' + (n.callFrame.url || '').split('/').pop() + ':' + n.callFrame.lineNumber + ':' + n.callFrame.columnNumber; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); }); console.log([...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(v / 1000).toFixed(1)}ms ${k}`).join('\n')); }
          dit(!!vu, `A ${L.cle} ${TT} toucher la ligne ouvre LA fiche de la paire (FichePaire)`);
          if (!vu) return;
          let f = await lireFiche(pg);
          for (let i = 0; i < 40 && f && f.num !== L.num; i++) { await pg.waitForTimeout(150); f = await lireFiche(pg); }
          dit(f && f.num === L.num && !!f.ligne && f.ctx === L.ctx, `A ${L.cle} ${TT} la fiche du N°${L.num}, par identité, ouverte depuis la ligne (contexte « ${L.ctx} »)`, f);
          // Le temps d'ouverture : la médiane de trois touchers (le premier, puis deux autres après fermeture) —
          // une machine de banc (swiftshader) a des à-coups qu'un seul toucher prendrait pour la règle.
          const temps = [vu.ms - vu.base]; const bruts = [`${Math.round(vu.ms)}−${Math.round(vu.base)}`];
          for (let k = 0; k < 2; k++) {
            await fermerFiche(pg); await pg.waitForTimeout(1500);
            const tk = await toucher(pg, L.toucher, tel); const v2 = await attendreFiche(pg, tk); if (v2) { temps.push(v2.ms - v2.base); bruts.push(`${Math.round(v2.ms)}−${Math.round(v2.base)}`); }
          }
          const med = temps.slice().sort((x, y) => x - y)[Math.floor(temps.length / 2)];
          dit(temps.length === 3 && med < 150, `D ${L.cle} ${TT} la fiche paraît en ${Math.round(med)} ms au-dessus du plancher de la machine (médiane de ${bruts.join(', ')} ; < 150)`, bruts);
          f = await lireFiche(pg);
          for (const a of L.inventaire) dit(await pg.evaluate((a) => !!document.querySelector('[data-fiche-paire]') && [...document.querySelectorAll(a)].some((x) => x.closest('[data-fiche-paire]')), a), `C ${L.cle} ${TT} l'action « ${a} » est DANS la fiche`);
          dit(f && f.petits.length === 0, `E ${L.cle} ${TT} chaque bouton de la fiche fait au moins ${f && f.seuil} px`, f && f.petits);
          dit(f && f.sw <= f.cw + 1, `E ${L.cle} ${TT} aucun débordement horizontal`, f && `${f.sw} > ${f.cw}`);
          await pg.waitForTimeout(300);
          await pg.screenshot({ path: path.join(SHOTS, `fp-${L.cle}-${suf}.png`) });
          // Retour (le geste ←) : la fiche se ferme, la liste est au même défilement.
          await pg.goBack().catch(() => {});
          await pg.waitForTimeout(500);
          const apres = { fiche: await pg.evaluate(() => !!document.querySelector('[data-fiche-paire]')), top: await place() };
          dit(!apres.fiche && apres.top != null && Math.abs(apres.top - avant) < 3, `D ${L.cle} ${TT} retour : la fiche se ferme, la ligne est à la même place à l'écran`, { avant, apres });
        });
        dit(!errs.length, `E ${L.cle} ${TT} aucune erreur de page`, errs[0]);
        await ctx.close();
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ fiche partout : ${ko} rouge(s)` : '\n✅ fiche partout : tout est vert');
  process.exit(ko ? 1 : 0);
})();
