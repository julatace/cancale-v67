// ════════════════════════════════════════════════════════════════════════════
//  Socle commun des bancs d'accessibilité (`accessibilite.cjs`, `accessibilite-clavier.cjs`) :
//  données INVENTÉES, serveur de dist/, ouverture d'un écran (largeur, thème, zoom, lien),
//  axe-core, cibles au doigt. Aucune fx/, aucune écriture réelle.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { routeMain } = require('./_base-ecritures.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const CAPTURES = process.env.BANC_CAPTURES || path.join(require('os').tmpdir(), 'banc-accessibilite');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const PNG = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'icon-512.png'));
const auj = new Date();
const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const photo = (n) => `https://images1.vinted.net/t/01_banc${n}/f800/170000000${n}.jpeg`;
const ann = (id, title, heures, extra = {}) => ({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', size: '42', status: 'Très bon état', view_count: 30, favourite_count: 13, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000), ...extra });
const ITEMS = [
  ann(9303, 'Nike Dunk Low Panda taille 42', 2, { photo: photo(3) }),
  ann(9202, 'Salomon XT-6 noir taille 41', 40, { brand_title: 'Salomon', photo: photo(2), favourite_count: 48 }),
  ann(9401, 'Adidas Handball Spezial taille 43', 90, { brand_title: 'Adidas', photo: photo(4), price: { amount: '65.0', currency_code: 'EUR' } }),
  ann(9402, 'Nike P-6000 noir taille 44', 150, { photo: photo(5), price: { amount: '59.0', currency_code: 'EUR' } }),
];
// (lot 2) Une vente À EXPÉDIER avec son bordereau (e-mail) et un N° « à vérifier sur son carton »
// (numéroté pendant la panne) : Colis montre « Tout imprimer », et imprimer DEMANDE confirmation.
const TX_ENVOI = 9601;
const LBC = 'aaaa1111-0000-4000-8000-00000000000a';
const VENTES = [{ transaction_id: TX_ENVOI, title: 'Nike Air Force 1 blanc taille 43', price: { amount: '70', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: ilYa(20) },
{ transaction_id: 9301, title: 'Nike Banc vendue taille 42', price: { amount: '80', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYa(48) }];
const ACHATS = [{ transaction_id: 9501, title: 'Achat Vinted banc', price: { amount: '30', currency_code: 'EUR' }, status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: ilYa(96) }];
const MAIN = () => ({
  vinted_annonce_numeros: {
    '9202': { numero: '5', auto: false, manuelAt: ilYa(30), numberedAt: ilYa(40), buyPrice: '25' },
    '9401': { numero: '12', auto: true, numberedAt: ilYa(90) },
    '9402': { numero: '13', auto: true, numberedAt: ilYa(150) },
    i9601: { numero: '21', title: 'Nike Air Force 1 blanc taille 43', numberedAt: '2026-10-15T10:00:00.000Z' },
  },
  vinted_used_numeros: [5, 12, 13, 21],
});
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const ECRANS = [
  ['journee', 'Ma journée'], ['annonces', 'Annonces'], ['ventes', 'Ventes'], ['cat_bord', 'Colis'], ['messages', 'Messages'],
  ['achats', 'Achats'], ['garage', 'Stock'], ['compta', 'Argent'], ['trancher', 'À trancher'], ['emails', 'E-mails'],
  ['settings', 'Paramètres'],
  // (lot 2) les écrans qui n'étaient pas couverts
  ['dashboard', 'Statistiques'], ['communaute', 'Communauté'], ['leboncoin', 'Leboncoin'], ['ebay_annonces', 'eBay'],
  ['vestiaire', 'Vestiaire', '?tab=annonces&site=vestiaire'], ['organisation', 'Organisation'],
];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop().replace(/"/g, '');
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/"/g, '')];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

let PDF_ENVOI = null;
async function pdfInvente(code) {
  const { PDFDocument, StandardFonts } = require(path.join(__dirname, '..', '..', 'node_modules', 'pdf-lib'));
  const d = await PDFDocument.create(); const p = d.addPage([288, 432]); const f = await d.embedFont(StandardFonts.Helvetica);
  p.drawText('ETIQUETTE ' + code, { x: 20, y: 400, size: 12, font: f });
  return Buffer.from(await d.save()).toString('base64');
}
// zoom : 200 % d'un écran de 1512 px ⇒ 756 px CSS de large, deux pixels par pixel CSS
// (ce que fait le zoom du navigateur). `url` remplace « ?tab=… » (feuilles par lien).
async function ouvrir(b, { largeur, sombre, tab, zoom, url, attente }) {
  if (!PDF_ENVOI) PDF_ENVOI = await pdfInvente(String(TX_ENVOI));
  const base = { main: MAIN(), maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
  const rows = [
    { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: ACHATS } } },
    { id: 'vinted_item_details', data: {} },
    { id: `harvest_111_txn_${TX_ENVOI}`, data: { capturedAt: ilYa(1), payload: { transaction: { id: TX_ENVOI, item_id: `i${TX_ENVOI}` } } } },
    // (lot 2) Leboncoin, eBay et Vestiaire : une annonce chacun (formes des bancs lbc-flou-compte,
    // annonces-carte, tout-imprimer) — sans elles, ces écrans retombent sur Vinted.
    { id: 'lbc_listings', data: { items: { '4100000001': { id: '4100000001', subject: 'Asics Gel-Lyte III gris taille 42', price: 60, ref: '5', account: LBC, accountName: 'Compte_lbc', platform: 'leboncoin', status: 'active', seenAt: ilYa(0.1), images: [], stats: { favoris: 3, at: ilYa(1) } } }, lectures: { [LBC]: { at: ilYa(0.1), total: 1, n: 1 } } } },
    { id: 'lbc_accounts', data: { accounts: { [LBC]: { id: LBC, name: 'Compte_lbc', type: 'particulier', seenAt: ilYa(0.2), sessionAt: ilYa(0.2), source: 'session:messagerie' } } } },
    { id: 'lbc_ventes', data: { ventes: { TL: { txId: 'TL', itemId: '4100000091', isSeller: true, account: LBC, title: 'New Balance 550 blanc taille 41', price: 5500, stepStatus: 'paid', stepLabel: 'Paiement effectué', dateVente: ilYa(30), at: ilYa(30) } } } },
    { id: 'ebay_listings', data: { capturedAt: ilYa(0.2), items: [{ itemId: '5550001', sku: 'VRM-12', price: '69.00', currency: 'EUR', title: 'Adidas Handball Spezial taille 43', depuis: ilYa(40) }] } },
    { id: 'ebay_comptes', data: { rev: 1, comptes: [{ cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_banc', principal: true, deconnecteLe: null }] } },
    { id: 'ebay_orders', data: { orders: [] } },
    { id: 'vc_session', data: { id: 'compteVc', at: ilYa(0.3), source: 'users/me', comptes: { compteVc: ilYa(0.3) } } },
    { id: 'vc_listings', data: { capturedAt: ilYa(0.3), complet: true, total: 1, liens: {}, items: { '71000009': { titre: 'Sac cabas cuir camel', prix: { valeur: 180, devise: 'EUR', cle: 'price' }, statut: 'ON_SALE', compte: 'compteVc', vuAt: ilYa(0.3), photo: '', favoris: 4, ref: '' } } } },
    { id: 'vc_ventes', data: { lectures: { ventes: { at: ilYa(0.3) } }, ventes: {} } },
    { id: 'email_bord_' + TX_ENVOI, data: { transaction: String(TX_ENVOI), uid: '111', filename: `bordereau-${TX_ENVOI}.pdf`, modele: 'Nike Air Force 1 blanc taille 43', article: 'Nike Air Force 1 blanc taille 43', receivedAt: ilYa(2), pdfB64: PDF_ENVOI, suivi: '41234567' } },
  ];
  const mobile = largeur < 700;
  const ctx = await b.newContext(zoom
    ? { bypassCSP: true, viewport: { width: Math.round(largeur / zoom), height: Math.round(950 / zoom) }, deviceScaleFactor: zoom }
    : { bypassCSP: true, viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile });
  const pg = await ctx.newPage();
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route(/images1\.vinted\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof d === 'string' ? d : JSON.stringify(d) });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') ecrits.push({ meth: req.method(), u: u.slice(0, 160), at: Date.now() });
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'banc' }]);
    const mm = routeMain(req, base); if (mm) return j(mm.body, mm.status);
    if (req.method() !== 'GET') return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z]+)=(not\.)?is\.null/g)].map((m) => ({ k: m[1], non: !!m[2] }));
    const passe = (r) => filtres.every((f) => (f.non ? r.data[f.k] != null : r.data[f.k] == null));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/"/g, '')); return j(rows.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/${url || `?tab=${tab || 'journee'}`}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(attente || 5000);
  return { pg, ctx, errs, base, ecrits };
}
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [path.join(__dirname, '..', '..')] }), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
// Exceptions JUSTIFIÉES, une par une : { regle, cible (regexp sur le sélecteur), raison }.
const EXCEPTIONS = [];
const excuse = (regle, cible) => EXCEPTIONS.find((e) => e.regle === regle && new RegExp(e.cible).test(cible));
// Les animations d'entrée finies d'abord (un texte en fondu à opacité 0 serait sauté par axe).
const finirAnimations = (pg) => pg.evaluate(() => { try { for (const a of document.getAnimations()) { try { a.finish(); } catch (_) {} } } catch (_) {} });
async function axe(pg, contexte) {
  await finirAnimations(pg);
  await pg.evaluate(AXE);
  return pg.evaluate(async ({ tags, ctx }) => {
    // Les règles WCAG A/AA (2.0, 2.1) + deux règles « bonnes pratiques » tenues aussi : un rôle ARIA
    // interdit sur l'élément (un <button role="listitem"> n'est plus un bouton) et une feuille sans nom.
    const ids = [...new Set([...window.axe.getRules(tags).map((r) => r.ruleId), 'aria-allowed-role', 'aria-dialog-name'])];
    const cible = typeof ctx === 'string' ? ([...document.querySelectorAll(ctx)].filter((e) => e.getClientRects().length).pop() || document) : document;
    const r = await window.axe.run(cible, { runOnly: { type: 'rule', values: ids }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, aide: v.help, noeuds: v.nodes.map((n) => ({ cible: n.target.join(' '), html: n.html.replace(/\s+/g, ' ').slice(0, 150), msg: (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 220) })) }));
  }, { tags: TAGS, ctx: contexte || null });
}
const TOUJOURS = new Set(['aria-allowed-role', 'aria-dialog-name']);   // rouges quel que soit leur « impact »
function juger(T, nom, viols) {
  const graves = [], legeres = [];
  for (const v of viols) for (const n of v.noeuds) {
    if (excuse(v.id, n.cible)) continue;
    (['serious', 'critical'].includes(v.impact) || TOUJOURS.has(v.id) ? graves : legeres).push(`${v.id} [${v.impact}] ${n.cible} — ${n.html} — ${n.msg}`);
  }
  dit(graves.length === 0, `${T} ${nom} · aucune violation axe « serious »/« critical »`, `${graves.length} : ` + graves.slice(0, 8).join(' ║ '));
  if (legeres.length) console.log(`     ℹ︎ ${legeres.length} moindre(s) : ` + legeres.slice(0, 3).join(' ║ '));
  if (process.env.BANC_DUMP) for (const g of graves) console.log('       · ' + g);
}
// B : zones tactiles. Un bouton (ou lien-bouton) visible plus petit que 44 × 44 px
// en boîte, et sans zone étendue (::before/::after en position absolue plus grand).
async function petitesCibles(pg) {
  await finirAnimations(pg);
  return pg.evaluate(() => {
    const out = [];
    const sel = 'button, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], input[type="checkbox"], input[type="radio"], a.vrm-lien-action, a[role]';
    for (const e of document.querySelectorAll(sel)) {
      if (e.closest('[aria-hidden="true"],[inert]')) continue;
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (r.bottom < 0 || r.top > innerHeight * 3) continue;
      const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      let w = r.width, h = r.height;
      for (const p of ['::before', '::after']) {
        const s = getComputedStyle(e, p);
        if (s.content && s.content !== 'none' && s.position === 'absolute') {
          const ins = (k) => parseFloat(s[k]) || 0;
          w = Math.max(w, r.width - ins('left') - ins('right')); h = Math.max(h, r.height - ins('top') - ins('bottom'));
        }
      }
      // Le label d'une case (la cible au doigt est le label entier).
      if (e.tagName === 'INPUT') { const l = e.closest('label'); if (l) { const lr = l.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); } }
      if (w + 0.5 < 44 || h + 0.5 < 44) out.push(`${Math.round(w)}×${Math.round(h)} ${(e.outerHTML || '').replace(/\s+/g, ' ').slice(0, 120)}`);
    }
    return out;
  });
}


const compte = () => ({ ok, ko });
const lancerNavigateur = () => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
module.exports = { ECRANS, CAPTURES, PORT, srv, ouvrir, capture, axe, juger, petitesCibles, finirAnimations, dit, essaie, compte, lancerNavigateur, TX_ENVOI };
