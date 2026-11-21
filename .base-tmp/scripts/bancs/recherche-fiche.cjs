// ═══════════════════════════════════════════════════════════════════════════
// BANC : RECHERCHE UNIVERSELLE + FICHE D'UNE PAIRE (9 novembre)
//        (node scripts/bancs/recherche-fiche.cjs — après le build)
//        BANC_PORT=… · BANC_DIST=… (un autre build) · SHOTS=… (les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles :
//   · 50 paires au MÊME titre (N°201 à N°250), deux vendues sur Vinted (22999990226 → N°227,
//     22999990210 → N°211), chacune avec SON bordereau (`email_bord_*` : transaction, suivi,
//     date), le N°227 retiré par l'acheteur (`email_track_*` de SON suivi) et un suivi
//     qui lui RESSEMBLE (un caractère de différence) qui ne doit jamais entrer ;
//   · « B125 » et « 125 » (deux paires, deux numéros) ;
//   · une commande eBay (12-34507-89007, SKU VRM-208), une vente Leboncoin prouvée
//     (3001234567), une vente Vestiaire (55001, produit 91000777, N°230) ;
//   · 50 conversations Vinted au même titre, dont celle de la vente 22999990226 (pseudo17).
// Il exige, à 390 px tactile et 1512 px, en clair et en sombre :
//   A. la loupe s'ouvre (⌘K/Ctrl+K sur ordinateur, la loupe sur iPhone) ; champ vide :
//      ce qu'on peut taper (`data-recherche-aide`) ;
//   B. chaque identité trouve SON objet, groupé par type : n° de transaction ⇒ la
//      vente ET la conversation ; pseudo ⇒ la conversation ; n° de commande eBay,
//      Leboncoin, Vestiaire ⇒ SA vente, son N° par identité ; « Je cherche … » dit ;
//   C. « b125 » ⇒ le bloc du N° B125 (pas 125) ; Entrée ouvre la fiche du N° ;
//   D. clavier (1512) : ↓ du champ à la 1re ligne, ↓ ↑ entre les lignes, ↑ revient au champ ;
//   E. la FICHE du N°227 : la frise achat → … → bénéfice ; SON bordereau (SON suivi,
//      daté), SON dépôt, « retiré par l'acheteur » daté par CE suivi, jamais le suivi
//      qui ressemble ; le bénéfice +34 € (70 − 36) ; « Ouvrir dans Ventes » ferme la
//      fiche et ouvre Ventes ;
//   F. la fiche du N°211 (même titre) : SA vente, SON suivi, rien du N°227 ; le N°228
//      (même titre, pas vendu) : aucun colis, bénéfice « rien de vendu » ;
//   G. boutons ≥ 44 px au doigt, aucun débordement, aucune erreur de page.
// Captures : $SHOTS/rf-*.png (À REGARDER).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12240;
const SHOTS = process.env.SHOTS || os.tmpdir();

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const TITRE = 'Nike Dunk Low Panda taille 42';
const FICHES = {};
for (let i = 0; i < 50; i++) FICHES[7200 + i] = { numero: String(201 + i), title: TITRE, numberedAt: '2026-10-22T10:00:00Z', auto: false, buyPrice: String(10 + i), accountId: '111' };
FICHES[7300] = { numero: 'B125', title: 'Asics Gel-Kayano 14 gris', buyPrice: '40', accountId: '111' };
FICHES[7301] = { numero: '125', title: 'Asics Gel-Kayano 14 noir', buyPrice: '41', accountId: '111' };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const item = (id, title) => ({ id: Number(id), title, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false });
const LISTINGS = Array.from({ length: 50 }, (_, i) => item(7200 + i, TITRE)).filter((x) => ![7226, 7210].includes(x.id)).concat([item(7300, FICHES[7300].title), item(7301, FICHES[7301].title)]);
const vente = (tx, j, prix) => ({ transaction_id: tx, title: TITRE, status: 'Commande finalisée', transaction_user_status: 'completed', price: { amount: prix, currency_code: 'EUR' }, date: ilYa(j) });
const VENTES = [vente(22999990226, 5, '70'), vente(22999990210, 6, '70')];
const txn = (tx, it, s, su) => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: iso(M), payload: { transaction: { id: tx, item_id: it, status: s, status_title: 'x', status_updated_at: su } } } });
const conv = (n, tx, login) => ({ id: `harvest_111_conv_${n}`, data: { capturedAt: iso(M), payload: { conversation: { id: n, transaction: { id: tx, item_id: 7200, item_title: TITRE, status: 450, current_user_side: 'seller' }, opposite_user: { id: 5000 + n, login }, messages: [] } } } });
const CONVS = Array.from({ length: 50 }, (_, i) => conv(80000 + i, 9000000 + i, 'pseudo' + i));
CONVS[17] = conv(80017, 22999990226, 'pseudo17');
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: FICHES, vinted_used_numeros: Object.values(FICHES).map((f) => f.numero) } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(M - 600e3), payload: { items: LISTINGS, pagination: { total_entries: LISTINGS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), nItems: VENTES.length, payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(M), nItems: 0, payload: { my_orders: [] } } },
  txn(22999990226, 7226, 450, ilYa(1)), txn(22999990210, 7210, 300, ilYa(2)),
  { id: 'email_bord_9226', data: { type: 'bordereau', transaction: '22999990226', suivi: '6A11111111111', filename: 'b.pdf', pdfB64: 'JVBERi0x', receivedAt: '2026-11-04T12:00:00.000Z' } },
  { id: 'email_bord_9210', data: { type: 'bordereau', transaction: '22999990210', suivi: '6A22222222222', filename: 'c.pdf', pdfB64: 'JVBERi0x', receivedAt: '2026-11-03T12:00:00.000Z' } },
  { id: 'email_track_x1', data: { type: 'suivi', suivi: '6A11111111111', status: 'delivered', sens: 'sortant', receivedAt: '2026-11-07T08:00:00.000Z', retireLe: '2026-11-07T07:30:00.000Z' } },
  { id: 'email_track_x2', data: { type: 'suivi', suivi: '6A1111111111X', status: 'delivered', sens: 'sortant', receivedAt: '2026-11-01T08:00:00.000Z', retireLe: '2026-11-01T08:00:00.000Z' } },
  { id: 'lbc_ventes', data: { ventes: { 3001234567: { isSeller: true, itemId: '2700001', title: 'Salomon XT-6 noir', price: 6500, dateVente: ilYa(3) } } } },
  { id: 'vc_ventes', data: { ventes: { 55001: { productId: '91000777', titre: 'Jordan 4 Bred', montant: '80', date: ilYa(2) } }, capturedAt: iso(M) } },
  { id: 'vc_listings', data: { items: {}, liens: { 91000777: '230' } } },
  { id: 'ebay_comptes', data: { comptes: [{ cle: 'K1', pseudo: 'paire_perso', principal: true, ajouteLe: 1 }] } },
  { id: 'ebay_orders', data: { orders: [{ orderId: '12-34507-89007', creationDate: ilYa(4), orderFulfillmentStatus: 'FULFILLED', buyer: { username: 'acheteur_ebay' }, pricingSummary: { total: { value: '90.00', currency: 'EUR' } }, lineItems: [{ title: 'New Balance 990 gris', sku: 'VRM-208', legacyItemId: '120000000208' }] }], capturedAt: M } },
  { id: 'ebay_listings', data: { items: [], capturedAt: M } },
  ...CONVS,
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && !c ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 300)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
const chemin = (row, src) => { let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg]; return v; };
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = chemin(row, src);
    if (/pdfB64$/.test(src)) v = v ? 'true' : null;
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const motif = (p) => new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');
// Les filtres PostgREST sur un champ (`data->>k=eq.v`, `data->>k=in.(a,b)`) servis comme la base (§6.3).
const filtres = (u) => {
  const out = [];
  const qs = u.split('?')[1] || '';
  for (const p of qs.split('&')) {
    const m = /^(data(?:->>|->)[A-Za-z_>-]+)=(eq|in)\.(.*)$/.exec(p); if (!m) continue;
    const vals = m[2] === 'eq' ? [m[3]] : m[3].replace(/^\(|\)$/g, '').split(',');
    out.push((r) => { const v = chemin(r, m[1]); return v != null && vals.includes(String(v)); });
  }
  return out;
};

async function preparer(b, vp, { sombre = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], lectures = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s, n, sd }) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); localStorage.setItem('vinted_ship_done', JSON.stringify(sd)); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { s: sombre, n: FICHES, sd: { 22999990226: Date.parse('2026-11-05T09:00:00Z') } });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    lectures.push(u);
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data$/.test(sel) && sel !== 'data') ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt ? iso(typeof r.data.capturedAt === 'number' ? r.data.capturedAt : Date.parse(r.data.capturedAt)) : iso(M), cap: r.data.capturedAt });
    const f = filtres(u);
    const garde = (l) => l.filter((r) => f.every((x) => x(r)));
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(garde(ROWS.filter((r) => ids.includes(r.id))).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(garde(ROWS.filter((r) => r.id === eq[1])).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = motif(lk[1]); let l = garde(ROWS.filter((r) => re.test(r.id))); const rg = req.headers()['range']; if (rg) { const m = /(\d+)-(\d+)/.exec(rg); if (m) l = l.slice(+m[1], +m[2] + 1); } return j(l.map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/email-rattacher\?mode=journal/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: 0, parPage: 20, suite: false, emails: [], compteurs: { sur: 0 }, adresses: [], cherche: '' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs, lectures };
}
const pret = async (pg) => { for (let i = 0; i < 60; i++) { if (await pg.evaluate(() => { const p = document.querySelector('[data-recherche-panneau]'); return !!(p && p.getAttribute('data-recherche-pret') === '1'); })) return true; await pg.waitForTimeout(250); } return false; };
const ouvrirLoupe = async (pg, tel) => {
  if (tel) await pg.locator('button[data-recherche-loupe]').first().tap();
  else { await pg.mouse.click(5, 300); await pg.keyboard.press('Control+K'); }
  return pret(pg);
};
// La frappe comme React la lit (événement `input`), puis l'attente du texte rendu.
const taper = async (pg, q) => {
  await pg.evaluate((q) => { const el = document.querySelector('[data-recherche-champ]'); const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; poser.call(el, q); el.dispatchEvent(new Event('input', { bubbles: true })); }, q);
  await pg.waitForSelector(`[data-recherche-q="${q.trim().toLowerCase()}"]`, { timeout: 8000 });
  await pg.waitForTimeout(350);
};
const res = (pg) => pg.evaluate(() => ({
  r: [...document.querySelectorAll('[data-recherche-resultat]')].map((x) => ({ type: x.getAttribute('data-recherche-resultat'), par: x.getAttribute('data-recherche-par'), cle: x.getAttribute('data-recherche-cle'), num: x.getAttribute('data-recherche-num'), site: x.getAttribute('data-recherche-site'), conv: x.getAttribute('data-recherche-conv'), cmd: x.getAttribute('data-recherche-commande'), h: Math.round(x.getBoundingClientRect().height) })),
  groupes: [...document.querySelectorAll('[data-recherche-groupe]')].map((g) => g.getAttribute('data-recherche-groupe')),
  compris: (document.querySelector('[data-recherche-compris]') || { getAttribute: () => null }).getAttribute('data-recherche-compris'),
  aide: !!document.querySelector('[data-recherche-aide]'),
  tout: (document.querySelector('[data-recherche-panneau] [data-tout-num]') || { getAttribute: () => null }).getAttribute('data-tout-num'),
  petits: [...document.querySelectorAll('[data-recherche-panneau] button')].filter((x) => x.getClientRects().length && x.getBoundingClientRect().height < 43.5).map((x) => x.textContent.slice(0, 30)),
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
}));
const lireFiche = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-fiche-paire]'); if (!el) return null;
  return {
    num: el.getAttribute('data-fiche-paire'), lecture: el.getAttribute('data-fiche-lecture-en-cours'),
    ordre: [...el.querySelectorAll('[data-fiche-etape]')].map((x) => x.getAttribute('data-fiche-etape')),
    etats: Object.fromEntries([...el.querySelectorAll('[data-fiche-etape]')].map((x) => [x.getAttribute('data-fiche-etape'), x.getAttribute('data-fiche-etat')])),
    textes: Object.fromEntries([...el.querySelectorAll('[data-fiche-etape]')].map((x) => [x.getAttribute('data-fiche-etape'), x.innerText.replace(/\n/g, ' | ')])),
    evs: [...el.querySelectorAll('[data-fiche-etape="colis"] [data-fiche-ev]')].map((x) => ({ cle: x.getAttribute('data-fiche-ev'), at: x.getAttribute('data-fiche-ev-date'), t: x.innerText.replace(/\n/g, ' ') })),
    txs: [...el.querySelectorAll('[data-fiche-etape="vente"] [data-fiche-tx]')].map((x) => x.getAttribute('data-fiche-tx')),
    sources: [...el.querySelectorAll('[data-fiche-source]')].map((x) => x.getAttribute('data-fiche-source')),
    benef: (el.querySelector('[data-fiche-resume-benefice]') || { getAttribute: () => null }).getAttribute('data-fiche-resume-benefice'),
    // (14 nov., système de design) 44 px au doigt, 36 à la souris (DESIGN.md §6 : une hauteur de contrôle par pointeur).
    seuil: matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)').matches ? 36 : 44,
    petits: [...el.querySelectorAll('button')].filter((x) => x.getClientRects().length && x.getBoundingClientRect().height < (matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)').matches ? 36 : 44) - 0.5).map((x) => x.textContent.slice(0, 30)),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});
const ficheLue = async (pg, n) => {
  await pg.waitForSelector(`[data-fiche-paire="${n}"]`, { timeout: 10000 });
  // La lecture de la coque, puis les lectures en plus (colis de la vente) : attendues sur l'attribut, jamais un délai fixe.
  for (let i = 0; i < 60; i++) { const f = await lireFiche(pg); if (f && f.lecture === '0' && (f.etats.colis !== undefined)) { await pg.waitForTimeout(400); return lireFiche(pg); } await pg.waitForTimeout(250); }
  return lireFiche(pg);
};
// `attendre(f)` : la lecture en plus de la fiche (colis de la vente) arrive APRÈS la
// lecture de la coque — attendue sur ce qui est rendu (au plus 15 s), jamais un délai fixe.
const ouvrirFiche = async (pg, n, attendre = null) => {
  await pg.evaluate(() => { const b = document.querySelector('[data-fiche-fermer]'); if (b) b.click(); });
  await pg.waitForTimeout(200);
  await pg.evaluate((n) => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: n })), n);
  let f = await ficheLue(pg, n);
  for (let i = 0; attendre && i < 60 && !(f && attendre(f)); i++) { await pg.waitForTimeout(250); f = await lireFiche(pg); }
  return f;
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const tours = [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]];
    for (const [vp, sombre] of tours) {
      const tel = vp.width < 600; const TT = `[${vp.width}${sombre ? ' sombre' : ''}]`; const suf = `${vp.width}${sombre ? '-sombre' : '-clair'}`;
      console.log(`── ${vp.width} px${sombre ? ' · sombre' : ' · clair'}`);
      const { ctx, pg, errs, lectures } = await preparer(b, vp, { sombre });
      await essaie('A', async () => {
        const ok = await ouvrirLoupe(pg, tel);
        dit(ok, `A ${TT} la loupe s'ouvre (${tel ? 'la loupe en haut' : 'Ctrl+K'}) et lit`);
        if (!tel) dit(await pg.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-recherche-champ')), `A ${TT} Ctrl+K met le curseur dans le champ`);
        const r = await res(pg);
        dit(r.aide, `A ${TT} champ vide : il dit ce qu'on peut taper`);
        await pg.screenshot({ path: path.join(SHOTS, `rf-vide-${suf}.png`) });
      });
      await essaie('B', async () => {
        await taper(pg, '22999990226');
        const r = await res(pg);
        const v = r.r.find((x) => x.type === 'vente'), m = r.r.find((x) => x.type === 'message');
        dit(v && v.par === 'transaction' && v.cle === 'vente:22999990226', `B ${TT} n° de transaction ⇒ SA vente`, r.r);
        dit(m && m.par === 'transaction' && m.conv === '80017' && r.r.filter((x) => x.type === 'message').length === 1, `B ${TT} n° de transaction ⇒ SA conversation (une seule, sur 50 au même titre)`, r.r);
        // (10 nov., lot AX) Le n° de transaction EXACT : sa vente puis sa conversation passent EN TÊTE
        // (« Correspondance exacte »), dans cet ordre ; sinon chacune dans son groupe.
        const ordre = r.r.map((x) => x.type);
        dit((r.groupes.includes('exacte') && ordre.indexOf('vente') >= 0 && ordre.indexOf('vente') < ordre.indexOf('message')) || (r.groupes.includes('vente') && r.groupes.includes('message') && r.groupes.indexOf('vente') < r.groupes.indexOf('message')), `B ${TT} résultats rangés (Ventes, puis Messages ; en tête quand le n° est exact)`, r.groupes);
        dit(/transaction/.test(r.compris || ''), `B ${TT} « Je cherche un n° de transaction » est dit`, r.compris);
        await pg.screenshot({ path: path.join(SHOTS, `rf-transaction-${suf}.png`) });
        await taper(pg, 'pseudo17');
        const p = await res(pg);
        dit(p.r.filter((x) => x.type === 'message').map((x) => x.conv).join() === '80017', `B ${TT} un pseudo ⇒ SA conversation`, p.r);
        await taper(pg, '12-34507-89007');
        const e = await res(pg);
        const ve = e.r.find((x) => x.site === 'ebay');
        dit(ve && ve.par === 'commande' && ve.cmd === '12-34507-89007' && ve.num === '208', `B ${TT} n° de commande eBay ⇒ SA vente, N°208 par SON SKU`, e.r);
        dit(/commande-ebay/.test(e.compris || ''), `B ${TT} « un n° de commande eBay » est dit`, e.compris);
        await taper(pg, '3001234567');
        const l = await res(pg);
        dit(l.r.some((x) => x.site === 'leboncoin' && x.par === 'commande' && x.cmd === '3001234567'), `B ${TT} n° de vente Leboncoin ⇒ SA vente`, l.r);
        await taper(pg, '91000777');
        const c = await res(pg);
        dit(c.r.some((x) => x.site === 'vestiaire' && x.par === 'commande' && x.num === '230'), `B ${TT} réf. Vestiaire ⇒ SA vente, N°230 par identité`, c.r);
        await pg.screenshot({ path: path.join(SHOTS, `rf-vestiaire-${suf}.png`) });
        await taper(pg, 'dunk panda');
        const t = await res(pg);
        dit(t.petits.length === 0, `G ${TT} chaque bouton du panneau fait au moins 44 px`, t.petits);
        dit(t.sw <= t.cw + 1, `G ${TT} aucun débordement horizontal (loupe)`, `${t.sw} > ${t.cw}`);
        await pg.screenshot({ path: path.join(SHOTS, `rf-titre-${suf}.png`) });
      });
      if (!tel) await essaie('D', async () => {
        await pg.focus('[data-recherche-champ]');
        await pg.keyboard.press('ArrowDown');
        const a = await pg.evaluate(() => { const l = [...document.querySelectorAll('#vrm-recherche-resultats .vrm-recherche-ligne')]; return l.indexOf(document.activeElement); });
        await pg.keyboard.press('ArrowDown');
        const b2 = await pg.evaluate(() => { const l = [...document.querySelectorAll('#vrm-recherche-resultats .vrm-recherche-ligne')]; return l.indexOf(document.activeElement); });
        await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp');
        const c = await pg.evaluate(() => !!(document.activeElement && document.activeElement.hasAttribute('data-recherche-champ')));
        dit(a === 0 && b2 === 1 && c, `D ${TT} ↓ du champ à la 1re ligne, ↓ à la 2e, ↑ ↑ revient au champ`, [a, b2, c]);
      });
      await essaie('C', async () => {
        await taper(pg, 'b125');
        for (let i = 0; i < 40 && !(await pg.$('[data-tout-parcours]')); i++) await pg.waitForTimeout(250);
        const r = await res(pg);
        dit(r.tout === 'B125', `C ${TT} « b125 » ⇒ le N° B125 (pas 125)`, r.tout);
        if (!tel) {
          await pg.focus('[data-recherche-champ]'); await pg.keyboard.press('Enter');
          const f = await ficheLue(pg, 'B125');
          dit(!!f && f.num === 'B125', `C ${TT} Entrée ouvre la fiche du N°B125`, f && f.num);
        } else {
          await pg.locator('[data-tout-parcours]').first().tap();
          const f = await ficheLue(pg, 'B125');
          dit(!!f && f.num === 'B125', `C ${TT} « Toute l’histoire » ouvre la fiche du N°B125`, f && f.num);
        }
      });
      await essaie('E', async () => {
        const f = await ouvrirFiche(pg, '227', (x) => x.evs.some((e) => e.cle === 'livre'));
        dit(!!f && f.ordre.slice(-1)[0] === 'benefice' && f.ordre[0] === 'achat', `E ${TT} la frise du N°227 va de l'achat au bénéfice`, f && f.ordre);
        const bo = f.evs.find((x) => x.cle === 'bordereau'), de = f.evs.find((x) => x.cle === 'depose'), li = f.evs.find((x) => x.cle === 'livre');
        dit(bo && /6A11111111111/.test(bo.t) && bo.at === '2026-11-04T12:00:00.000Z', `E ${TT} SON bordereau : SON suivi, daté par SON e-mail`, f.evs);
        dit(de && de.at === '2026-11-05T09:00:00.000Z', `E ${TT} déposé : SON clic « Colis fait », daté`, f.evs);
        dit(li && li.at === '2026-11-07T07:30:00.000Z', `E ${TT} retiré par l'acheteur : daté par l'e-mail de CE suivi`, f.evs);
        dit(!f.evs.some((x) => x.at === '2026-11-01T08:00:00.000Z' || /6A1111111111X/.test(x.t)), `E ${TT} le suivi qui RESSEMBLE n'entre jamais`, f.evs);
        dit(f.txs.join() === '22999990226', `E ${TT} SA vente : la transaction 22999990226`, f.txs);
        dit(f.etats.benefice === 'fait' && f.benef === '3400' && /\+34/.test(f.textes.benefice) && /vente 70/.test(f.textes.benefice) && /achat 36/.test(f.textes.benefice), `E ${TT} bénéfice +34 € = vente 70 € − achat 36 €`, [f.benef, f.textes.benefice]);
        dit(f.sources.includes('vente') && f.sources.includes('colis'), `E ${TT} « Ouvrir dans … » sur la vente et le colis`, f.sources);
        dit(f.petits.length === 0, `G ${TT} chaque bouton de la fiche fait au moins ${f.seuil} px (44 au doigt, 36 à la souris)`, f.petits);
        dit(f.sw <= f.cw + 1, `G ${TT} aucun débordement horizontal (fiche)`, `${f.sw} > ${f.cw}`);
        await pg.screenshot({ path: path.join(SHOTS, `rf-fiche-227-${suf}.png`) });
        await pg.evaluate(() => { const c = document.querySelector('[data-fiche-etape="colis"]'); if (c) c.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(200);
        await pg.screenshot({ path: path.join(SHOTS, `rf-fiche-227-colis-${suf}.png`) });
        await pg.locator('[data-fiche-source="vente"]').first().click();
        await pg.waitForTimeout(800);
        const apres = await pg.evaluate(() => ({ fiche: !!document.querySelector('[data-fiche-paire]'), url: location.search }));
        dit(!apres.fiche, `E ${TT} « Ouvrir dans Ventes » ferme la fiche et ouvre l'écran`, apres);
      });
      await essaie('F', async () => {
        const f = await ouvrirFiche(pg, '211', (x) => x.evs.some((e) => /6A2/.test(e.t)));
        dit(!!f && f.txs.join() === '22999990210' && f.evs.some((x) => /6A22222222222/.test(x.t)) && !f.evs.some((x) => /6A111/.test(x.t)), `F ${TT} le N°211 (même titre) : SA vente, SON suivi, rien du N°227`, f && [f.txs, f.evs]);
        dit(!!f && !f.evs.some((x) => x.cle === 'depose' || x.cle === 'livre'), `F ${TT} le N°211 : ni dépôt ni retrait empruntés`, f && f.evs);
        const g = await ouvrirFiche(pg, '228');
        dit(!!g && !g.txs.length && !g.evs.length && g.etats.benefice === 'absent' && /rien de vendu/.test(g.textes.benefice), `F ${TT} le N°228 (même titre, pas vendu) : aucun colis, bénéfice « rien de vendu »`, g && [g.txs, g.evs, g.textes.benefice]);
        await pg.screenshot({ path: path.join(SHOTS, `rf-fiche-228-${suf}.png`) });
        await pg.evaluate(() => { const b = document.querySelector('[data-fiche-fermer]'); if (b) b.click(); });
      });
      // Les lectures de CE chantier (la loupe : conversations ; la fiche : bordereaux par SA
      // transaction, suivis par SON n°). (Colis / Ma journée lisent encore `email_track_*`
      // par `select=id,data` — mesuré le 6 nov., pas de cette branche.)
      const miennes = lectures.filter((u) => /harvest_[^&]*_conv_/.test(u) || /email_bord_[^&]*&data->>transaction=in\./.test(u) || /email_track_[^&]*&data->>suivi=in\./.test(u));
      const lourdes = miennes.filter((u) => /select=(data|id,data)(&|$)/.test(u));
      dit(miennes.length >= 3 && !lourdes.length, `G ${TT} conversations, bordereaux, suivis : lus projetés (jamais select=data)`, lourdes[0] || miennes.length);
      dit(!errs.length, `G ${TT} aucune erreur de page`, errs[0]);
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ recherche et fiche : ${ko} rouge(s)` : '\n✅ recherche et fiche : tout est vert');
  process.exit(ko ? 1 : 0);
})();
