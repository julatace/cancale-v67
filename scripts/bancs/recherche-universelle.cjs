// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA LOUPE UNIVERSELLE (6 novembre, v36)
//        (node scripts/bancs/recherche-universelle.cjs — après le build)
//        BANC_PORT=… pour un autre port · BANC_DIST=… pour un autre build
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (le dépôt est public) au VOLUME mesuré dans sa base le 6 nov.
// (lecture seule : 2 934 ventes, 2 719 achats, 557 annonces, 992 e-mails) —
// ici 3 002 ventes, 2 801 achats, 600 annonces, 2 000 fiches N° (dont 50 au même
// titre), 400 colis, 1 000 e-mails (servis par la route de l'écran E-mails, filtrés
// comme côté base), 2 factures Pro.
// Il exige, à 390 px tactile et 1512 px, en clair et en sombre :
//   · champ vide : suggestions (colis à retirer avec code, dernières ventes), puis
//     les recherches récentes ;
//   · chaque type trouve SON objet, en groupes : N° (bloc « Tout sur le N° »),
//     pseudo, n° de suivi, code de retrait, n° de transaction, montant, titre,
//     marque/taille, facture, e-mail ;
//   · 50 paires au même titre = 50 lignes distinctes (après « Voir les 38 autres ») ;
//   · le code de retrait ouvre SON colis « En grand » ; une paire ouvre SA fiche ;
//     une facture ouvre Factures ; un e-mail s'ouvre dans E-mails ;
//   · TEMPS : de la frappe à la ligne affichée < 300 ms (mesuré dans la page) ;
//   · une frappe lettre à lettre n'envoie qu'UNE requête e-mails (les autres annulées) ;
//   · en mode stream : pseudo et code masqués, récents tus ;
//   · lignes ≥ 44 px, aucun débordement, aucune erreur de page.
// Captures : $TMPDIR/loupe-*.png (À REGARDER).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12210;
const SHOTS = os.tmpdir();

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const MARQUES = ['Nike', 'Adidas', 'Salomon', 'Asics', 'New Balance', 'Puma'];
const MODELES = ['Air Max 90', 'Samba OG', 'XT-6', 'Gel-Kayano 14', '550', 'Speedcat'];
const prix = (i) => ({ amount: String(60 + (i % 90)) + '.0', currency_code: 'EUR' });
const T = 'Jordan 1 Mid Chicago taille 42';
const VENTES = Array.from({ length: 3000 }, (_, i) => ({ transaction_id: 22000000000 + i, title: `${MARQUES[i % 6]} ${MODELES[i % 6]} taille ${36 + (i % 10)}`, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYaH(200 + i), price: prix(i) }));
VENTES.unshift({ transaction_id: 22999990002, title: T, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: ilYaH(20), price: { amount: '52.01', currency_code: 'EUR' } });
VENTES.unshift({ transaction_id: 22999990001, title: T, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: ilYaH(19), price: { amount: '52.0', currency_code: 'EUR' } });
const ACHATS = Array.from({ length: 2800 }, (_, i) => ({ transaction_id: 23000000000 + i, title: `Achat ${MARQUES[(i + 2) % 6]} ${MODELES[(i + 1) % 6]}`, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYaH(300 + i), price: prix(i + 7) }));
ACHATS.unshift({ transaction_id: 23999990001, title: 'Veja Campo blanc', status: "Commande expédiée et en cours d'acheminement ! ", transaction_user_status: 'waiting', date: ilYaH(30), price: { amount: '52.5', currency_code: 'EUR' } });
const NUMEROS = {};
for (let i = 1; i <= 2000; i++) NUMEROS['it' + i] = { numero: String(i), title: i > 1900 && i <= 1950 ? T : `${MARQUES[i % 6]} ${MODELES[i % 6]} taille ${36 + (i % 10)}`, price: String(30 + (i % 50)), accountId: '111' };
const ITEMS = [];
for (let i = 1; i <= 300; i++) ITEMS.push({ id: 'it' + i, title: NUMEROS['it' + i].title, brand: MARQUES[i % 6], size: String(36 + (i % 10)), price: { amount: String(30 + (i % 50)) + '.0' }, is_closed: false, is_hidden: false, is_draft: false });
for (let i = 0; i < 300; i++) ITEMS.push({ id: 'libre' + i, title: `Annonce libre ${i}`, brand: i === 7 ? 'Onitsuka Tiger' : MARQUES[i % 6], size: i === 7 ? '44,5' : String(36 + (i % 10)), price: { amount: '61.0' }, is_closed: false, is_hidden: false, is_draft: false });
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const EMAILS = [
  ...VENTES.slice(2, 1502).map((o, i) => ({ id: 'email_sale_' + i, data: { type: 'sale', pseudo: 'acheteuse_' + i, transaction: String(o.transaction_id), receivedAt: ilYaH(200 + i) } })),
  { id: 'email_sale_p', data: { type: 'sale', pseudo: 'poupacho', transaction: '22999990001', receivedAt: ilYaH(19) } },
  ...VENTES.slice(2, 1502).map((o, i) => ({ id: 'email_bord_' + i, data: { type: 'bordereau', suivi: 'XW' + String(300000000 + i) + 'FR', transaction: String(o.transaction_id), receivedAt: ilYaH(200 + i) } })),
  ...Array.from({ length: 400 }, (_, i) => ({ id: 'email_track_' + i, data: { type: 'suivi', suivi: 'MR' + (7000000 + i), code: String(500000 + i), status: i === 123 ? 'available' : 'delivered', sens: 'entrant', artTitle: `Colis ${MARQUES[i % 6]}`, carrier: 'mondialrelay', lieu: 'Tabac du port, 1 rue du Port, 35260 Cancale', receivedAt: ilYaH(i === 123 ? 3 : 100 + i) } })),
  { id: 'email_invoice_tx77', data: { type: 'facture_pro', number: 'PRO-2026-0007', status: 'sent', designation: 'Salomon XT-6 gris', prix: 88.4, createdAt: ilYaH(10) } },
];
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: NUMEROS, vinted_used_numeros: Array.from({ length: 2000 }, (_, i) => i + 1), vinted_dark: false } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), nItems: VENTES.length, payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), nItems: ACHATS.length, payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  { id: 'harvest_111_txn_22999990001', data: { capturedAt: ilYaH(1), payload: { transaction: { id: 22999990001, item_id: 'it1901', status: 230, status_updated_at: ilYaH(5), shipment: { status_title: '' } } } } },
  ...EMAILS,
];
// La boîte de réception (route de l'écran E-mails) : 1 000 e-mails, filtrés comme côté base.
const BOITE = Array.from({ length: 1000 }, (_, i) => ({ id: 'email_reception_' + 'abcdef' + String(i).padStart(10, '0'), at: ilYaH(i), etat: 'integre', type: i === 321 ? 'suivi' : 'vente', subject: i === 321 ? 'Ton colis est arrivé' : `Information ${i}`, from: 'Vinted <no-reply@vinted.fr>', sourceDate: ilYaH(i),
  resume: i === 321 ? { t: 'suivi', st: 'available', code: '913377', s: 'MR8800321', a: 'Asics Gel-Kayano' } : { t: 'vente', a: `${MARQUES[i % 6]} ${MODELES[i % 6]}`, px: '60' }, adresses: [], pj: 0 }));
const ID321 = BOITE[321].id;

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
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
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const motif = (p) => new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');
const sansAccent = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

async function preparer(b, vp, { sombre = false, stream = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], lectures = [], journal = { n: 0, annulees: 0, q: [] };
  pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('requestfailed', (r) => { if (/email-rattacher\?mode=journal&page=0&cherche=/.test(r.url())) journal.annulees++; });
  await pg.addInitScript(({ s, st }) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) localStorage.setItem('vinted_dark', 'true'); if (st) { localStorage.setItem('vrm_stream', '1'); localStorage.setItem('vrm_recherche_recents', JSON.stringify(['poupacho'])); } } catch (_) {} }, { s: sombre, st: stream });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    lectures.push(u);
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = motif(lk[1]); let l = ROWS.filter((r) => re.test(r.id)); const rg = req.headers()['range']; if (rg) { const m = /(\d+)-(\d+)/.exec(rg); if (m) l = l.slice(+m[1], +m[2] + 1); } return j(l.map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/email-rattacher\?mode=journal/.test(u)) {
      const p = new URL(u).searchParams;
      if (p.get('lire')) { const e = BOITE.find((x) => x.id === p.get('lire')); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: p.get('lire'), email: e ? { ...e, texte: 'Ton colis est arrivé au point relais.', pieces: [] } : null }) }); }
      if (p.get('texte')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: p.get('texte'), texte: 'texte' }) });
      const q = p.get('cherche') || '';
      if (q) { journal.n++; journal.q.push(q); }
      const mots = sansAccent(q).split(' ').filter(Boolean);
      const l = q ? BOITE.filter((e) => { const t = sansAccent([e.subject, e.from, e.resume.a, e.resume.code, e.resume.s].join(' ')); return mots.every((m) => t.includes(m)); }) : BOITE;
      const page = l.slice(0, 20);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: 0, parPage: 20, suite: l.length > 20, emails: page, compteurs: { sur: 200, plus: true, integre: 200, aVerifier: 0, erreur: 0, incompris: 0, parRubrique: {} }, adresses: [], cherche: q }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  return { ctx, pg, errs, lectures, journal };
}
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}
// La frappe, MESURÉE dans la page : la valeur posée comme React la lit (événement
// `input`), puis le temps jusqu'à ce que le sélecteur attendu soit peint.
const mesurer = (pg, q, selQ) => pg.evaluate(async ({ q, sel }) => {
  const el = document.querySelector('[data-recherche-champ]');
  const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const t0 = performance.now();
  poser.call(el, q); el.dispatchEvent(new Event('input', { bubbles: true }));
  const vu = await new Promise((res) => {
    const ok = () => document.querySelector(sel);
    if (ok()) return res(true);
    const mo = new MutationObserver(() => { if (ok()) { mo.disconnect(); res(true); } });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true });
    setTimeout(() => { mo.disconnect(); res(false); }, 6000);
  });
  await new Promise((r) => requestAnimationFrame(() => r()));
  return { ms: Math.round(performance.now() - t0), vu };
}, { q, sel: selQ.startsWith('[data-recherche-q=') ? selQ : `[data-recherche-q="${q.trim().toLowerCase()}"] ${selQ}` });
const res = (pg) => pg.evaluate(() => ({
  r: [...document.querySelectorAll('[data-recherche-resultat]')].map((x) => ({ type: x.getAttribute('data-recherche-resultat'), par: x.getAttribute('data-recherche-par'), cle: x.getAttribute('data-recherche-cle'), num: x.getAttribute('data-recherche-num'), h: Math.round(x.getBoundingClientRect().height), pastille: (x.querySelector('.vrm-recherche-par') || {}).textContent || '' })),
  groupes: Object.fromEntries([...document.querySelectorAll('[data-recherche-groupe]')].map((g) => [g.getAttribute('data-recherche-groupe'), { n: +g.getAttribute('data-recherche-n'), total: g.getAttribute('data-recherche-total') }])),
  tout: !!document.querySelector('[data-recherche-panneau] [data-tout-num]'),
  boutons: [...document.querySelectorAll('[data-recherche-panneau] button')].filter((x) => x.getClientRects().length).map((x) => Math.round(x.getBoundingClientRect().height)),
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
}));
const ouvrirLoupe = async (pg, tel) => {
  if (tel) await pg.locator('button[aria-label="Rechercher une paire"]').first().tap(); else await pg.locator('[data-recherche-champ]').first().click();
  for (let i = 0; i < 60; i++) { if (await pg.evaluate(() => { const p = document.querySelector('[data-recherche-panneau]'); return !!(p && p.getAttribute('data-recherche-pret') === '1'); })) break; await pg.waitForTimeout(250); }
};

(async () => {
  let b; const temps = [];
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const tours = [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]];
    for (const [vp, sombre] of tours) {
      const tel = vp.width < 600; const TT = `[${vp.width}${sombre ? ' sombre' : ''}]`; const suf = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${vp.width} px${sombre ? ' · sombre' : ''}`);
      const { ctx, pg, errs, lectures, journal } = await preparer(b, vp, { sombre });
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(2500);
      if (process.env.BANC_SONDE) {
        // Sonde (diagnostic) : le temps de quelques frappes, rien d'autre.
        await ouvrirLoupe(pg, tel); await pg.waitForTimeout(500);
        for (const q of ['zzzzqq', 'zzzzqqx', 'samba og taille 37', 'nike', 'poupacho', 'zzzzqq']) { const m = await mesurer(pg, q, '[data-recherche-q="' + q.toLowerCase() + '"]'); console.log('SONDE', TT, q, m.ms + ' ms'); await pg.waitForTimeout(400); }
        await ctx.close(); continue;
      }
      let nLu0 = 0;
      await essaie('champ vide', async () => {
        nLu0 = lectures.length;   // ce que lit la loupe, à partir de son ouverture
        await ouvrirLoupe(pg, tel);
        await pg.waitForTimeout(500);
        const v = await pg.evaluate(() => ({ colis: [...document.querySelectorAll('[data-recherche-suggestions="colis"] [data-recherche-resultat]')].map((x) => x.getAttribute('data-recherche-cle')), ventes: document.querySelectorAll('[data-recherche-suggestions="ventes"] [data-recherche-resultat]').length, recents: !!document.querySelector('[data-recherche-recents]') }));
        dit(v.colis.join() === 'colis:MR7000123' && v.ventes === 3, `${TT} champ vide : le colis à retirer (avec son code) et les 3 dernières ventes`, JSON.stringify(v));
        await pg.screenshot({ path: path.join(SHOTS, `loupe-vide-${suf}.png`) });
      });
      await essaie('chaque type', async () => {
        const cas = [
          ['poupacho', '[data-recherche-cle="vente:22999990001"]', (x) => x.r.filter((r) => r.type === 'vente').map((r) => r.cle).join() === 'vente:22999990001' && x.r[0].par === 'pseudo', 'pseudo ⇒ SA vente'],
          ['XW300000777FR', '[data-recherche-cle="vente:22000000777"]', (x) => x.r.length === 1 && x.r[0].par === 'suivi', 'n° de suivi ⇒ SA vente'],
          ['500123', '[data-recherche-cle="colis:MR7000123"]', (x) => x.r.some((r) => r.cle === 'colis:MR7000123' && r.par === 'code'), 'code de retrait ⇒ LE colis (parmi 400)'],
          ['22000002999', '[data-recherche-cle="vente:22000002999"]', (x) => x.r.some((r) => r.cle === 'vente:22000002999' && r.par === 'transaction'), 'n° de transaction ⇒ SA vente'],
          ['52 €', '[data-recherche-par="montant"]', (x) => x.r.filter((r) => r.type === 'vente').map((r) => r.cle).join() === 'vente:22999990001', '« 52 € » ⇒ la vente à 52,00 € seulement'],
          ['52.5', '[data-recherche-cle="achat:23999990001"]', (x) => x.r.some((r) => r.cle === 'achat:23999990001' && r.par === 'montant'), '« 52.5 » ⇒ l’achat à 52,50 €'],
          ['samba og taille 37', '[data-recherche-groupe="vente"]', (x) => x.groupes.vente && x.r.filter((r) => r.type === 'vente').length > 0, 'mots du titre ⇒ les ventes'],
          // L'app numérote toute annonce qui n'a pas de N° (§5) : au banc, « libre7 » a reçu le sien ;
          // elle sort alors en paire — toujours UNE ligne, celle de SON annonce.
          ['onitsuka 44,5', '[data-recherche-cle$=":libre7"]', (x) => x.r.filter((r) => r.type === 'annonce' || r.type === 'paire').map((r) => r.cle.replace(/^\w+:/, '')).join() === 'libre7', 'marque + taille (champs de l’annonce) ⇒ L’annonce, une ligne'],
          ['PRO-2026-0007', '[data-recherche-resultat="facture"]', (x) => x.r.filter((r) => r.type === 'facture').length === 1, 'n° de facture ⇒ SA facture'],
          ['913377', '[data-recherche-resultat="email"]', (x) => x.r.some((r) => r.type === 'email' && r.cle === 'email:' + ID321) && !x.tout, 'code dans un e-mail ⇒ L’e-mail (moteur de l’écran E-mails), sans « Tout sur le N°913377 — jamais servi »'],
        ];
        for (const [q, sel, ok, lib] of cas) {
          const m = await mesurer(pg, q, sel);
          await pg.waitForTimeout(q === '913377' ? 50 : 350);
          const x = await res(pg);
          dit(m.vu && ok(x), `${TT} « ${q} » : ${lib}`, JSON.stringify(x.r.slice(0, 4)));
          if (q !== '913377') { temps.push(m.ms); dit(m.ms < 300, `${TT} « ${q} » : affiché en ${m.ms} ms (< 300 ms)`, String(m.ms)); }
          else dit(m.ms < 1500, `${TT} « ${q} » : e-mails affichés en ${m.ms} ms (pause de frappe 250 ms + réponse)`, String(m.ms));
          dit(x.r.every((r) => r.h >= 43.5) && x.boutons.every((h) => h >= 43.5), `${TT} « ${q} » : lignes et boutons ≥ 44 px`, x.boutons.filter((h) => h < 43.5).join(','));
          dit(x.sw <= x.cw + 1, `${TT} « ${q} » : aucun débordement`, `${x.sw} > ${x.cw}`);
          if (['poupacho', '500123', '52 €', '913377'].includes(q)) await pg.screenshot({ path: path.join(SHOTS, `loupe-${q.replace(/[^a-z0-9]/gi, '')}-${suf}.png`) });
        }
        const m = await mesurer(pg, '141', '[data-tout-num]');
        await pg.waitForTimeout(300);
        const x = await res(pg);
        dit(m.vu && x.tout && (x.groupes.paire ? x.r.every((r) => r.type !== 'paire' || r.num !== '141') : true), `${TT} « 141 » : « Tout sur le N° » devant, la N°141 pas deux fois`, JSON.stringify(x.groupes));
        dit(x.r.some((r) => r.type === 'paire' && /141/.test(r.num || '')), `${TT} « 141 » : les autres N° qui le contiennent en dessous (1141, 1410…)`, JSON.stringify(x.r.slice(0, 3)));
      });
      await essaie('50 jumelles', async () => {
        await mesurer(pg, 'jordan chicago', '[data-recherche-groupe="paire"]');
        await pg.waitForTimeout(300);
        let x = await res(pg);
        dit(x.groupes.paire && x.groupes.paire.n === 12 && x.groupes.paire.total === '50', `${TT} 50 paires au même titre : 12 montrées, total 50`, JSON.stringify(x.groupes.paire));
        await pg.locator('[data-recherche-plus="paire"]').first().click();
        await pg.waitForTimeout(400);
        x = await res(pg);
        const p = x.r.filter((r) => r.type === 'paire');
        dit(p.length === 50 && new Set(p.map((r) => r.cle)).size === 50 && new Set(p.map((r) => r.num)).size === 50, `${TT} « Voir les 38 autres » : 50 lignes, 50 N° distincts, jamais fusionnées`, `${p.length} / ${new Set(p.map((r) => r.num)).size}`);
        dit(x.r.filter((r) => r.type === 'vente').map((r) => r.cle).sort().join() === 'vente:22999990001,vente:22999990002', `${TT} les deux ventes au même titre : deux lignes`);
        await pg.screenshot({ path: path.join(SHOTS, `loupe-jumelles-${suf}.png`) });
      });
      await essaie('frappe lettre à lettre', async () => {
        await pg.locator('[data-recherche-champ]').first().fill('');
        const avant = journal.n;
        await pg.locator('[data-recherche-champ]').first().pressSequentially('mr8800321', { delay: 45 });
        await pg.waitForTimeout(900);
        const x = await res(pg);
        dit(journal.n - avant <= 2, `${TT} « mr8800321 » (n° de suivi d’un e-mail) tapé lettre à lettre : ${journal.n - avant} requête(s) e-mails, pas une par lettre`, journal.q.slice(avant).join(' | '));
        dit(x.r.some((r) => r.type === 'email' && r.cle === 'email:' + ID321), `${TT} … et L’e-mail de ce suivi est trouvé`);
      });
      const nLectures = lectures.length;   // la recherche seule (l'écran ouvert ensuite a ses propres lectures)
      await essaie('ouvrir', async () => {
        // Une paire ⇒ SA fiche.
        await mesurer(pg, 'jordan chicago', '[data-recherche-groupe="paire"]');
        await pg.waitForTimeout(300);
        const num = await pg.locator('[data-recherche-resultat="paire"]').nth(3).getAttribute('data-recherche-num');
        await pg.locator('[data-recherche-resultat="paire"]').nth(3).click();
        await pg.waitForTimeout(1500);
        const f = await pg.evaluate(() => ({ panneau: !!document.querySelector('[data-recherche-panneau]'), fiche: (document.querySelector('[data-fiche-paire]') || {}).getAttribute ? document.querySelector('[data-fiche-paire]').getAttribute('data-fiche-paire') : null, txt: (document.querySelector('[role="dialog"]') || {}).innerText || '' }));
        dit(!f.panneau && (f.fiche === num || new RegExp('N°\\s?' + num + '\\b').test(f.txt)), `${TT} la paire N°${num} ouvre SA fiche`, JSON.stringify({ fiche: f.fiche, txt: f.txt.slice(0, 80) }));
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        // Un code ⇒ son colis, « En grand ».
        await ouvrirLoupe(pg, tel);
        await mesurer(pg, '500123', '[data-recherche-cle="colis:MR7000123"]');
        await pg.waitForTimeout(300);
        await pg.locator('[data-recherche-cle="colis:MR7000123"]').first().click();
        let g = null;
        for (let i = 0; i < 40; i++) { g = await pg.evaluate(() => { const e = document.querySelector('[data-qr-plein]'); return e ? e.getAttribute('data-qr-plein-code') : null; }); if (g) break; await pg.waitForTimeout(250); }
        dit(g === '500123', `${TT} le code de retrait ouvre SON colis « En grand » (code ${g})`, String(g));
        await pg.screenshot({ path: path.join(SHOTS, `loupe-en-grand-${suf}.png`) });
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        // Un e-mail ⇒ E-mails, ouvert.
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2000);
        await ouvrirLoupe(pg, tel);
        await mesurer(pg, '913377', '[data-recherche-resultat="email"]');
        await pg.waitForTimeout(200);
        await pg.locator('[data-recherche-resultat="email"]').first().click();
        let l = null;
        for (let i = 0; i < 40; i++) { l = await pg.evaluate(() => { const e = document.querySelector('[data-boite-lecture]'); return e ? e.getAttribute('data-boite-lecture') : null; }); if (l) break; await pg.waitForTimeout(250); }
        dit(l === ID321, `${TT} l’e-mail s’ouvre dans E-mails (SA ligne)`, String(l));
        await pg.screenshot({ path: path.join(SHOTS, `loupe-email-${suf}.png`) });
        // Une facture ⇒ Factures.
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2000);
        await ouvrirLoupe(pg, tel);
        await mesurer(pg, 'PRO-2026-0007', '[data-recherche-resultat="facture"]');
        await pg.waitForTimeout(200);
        await pg.locator('[data-recherche-resultat="facture"]').first().click();
        await pg.waitForTimeout(1500);
        const fa = await pg.evaluate(() => ({ url: location.search, h: [...document.querySelectorAll('h1,h2')].map((x) => x.textContent.trim()).join(' | ').slice(0, 120), champ: [...document.querySelectorAll('input:not([data-recherche-champ])')].map((i) => i.value).filter(Boolean) }));
        dit(/Factures|Comptabilit/i.test(fa.h) && !fa.champ.includes('PRO-2026-0007'), `${TT} la facture Pro ouvre Factures (liste des Pro en tête, aucune recherche « 0 résultat » posée)`, JSON.stringify(fa));
        // Champ vide après un résultat ouvert : la recherche récente est là.
        await ouvrirLoupe(pg, tel);
        await pg.locator('[data-recherche-champ]').first().fill('');
        await pg.waitForTimeout(400);
        const rc = await pg.evaluate(() => [...document.querySelectorAll('[data-recherche-recent]')].map((x) => x.getAttribute('data-recherche-recent')));
        dit(rc[0] === 'PRO-2026-0007' && rc.includes('913377'), `${TT} champ vide : les recherches récentes (la dernière d’abord)`, rc.join(','));
        await pg.screenshot({ path: path.join(SHOTS, `loupe-recents-${suf}.png`) });
        await sain(pg, `${TT} loupe`);
      });
      const lourdes = lectures.slice(nLu0, nLectures).filter((u) => /select=([^&]*)/.test(u) && /(?:^|,)(?:\w+:)?data(?:,|$)/.test((/select=([^&]*)/.exec(u) || [])[1]) && /harvest_.*_(?:orders|listings)|email_(?:track|invoice|reception)/.test(u));
      dit(!lourdes.length, `${TT} aucune ligne lourde lue entière pendant la recherche (commandes, dressings, factures, e-mails)`, lourdes.slice(0, 2).join(' | ').slice(0, 240));
      dit(errs.length === 0, `${TT} aucune erreur de page`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
    // Le mode stream : pseudo et code masqués, recherches récentes tues.
    console.log('── 1512 px · mode stream');
    const { ctx, pg, errs } = await preparer(b, { width: 1512, height: 950 }, { stream: true });
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500);
    await essaie('stream', async () => {
      await ouvrirLoupe(pg, false); await pg.waitForTimeout(500);
      const v = await pg.evaluate(() => ({ recents: !!document.querySelector('[data-recherche-recents]'), stream: document.documentElement.getAttribute('data-stream') }));
      dit(v.stream === '1' && !v.recents, '[stream] champ vide : les recherches récentes sont tues', JSON.stringify(v));
      await mesurer(pg, 'poupacho', '[data-recherche-cle="vente:22999990001"]'); await pg.waitForTimeout(600);
      let x = await res(pg);
      dit(x.r[0] && x.r[0].cle === 'vente:22999990001' && !/poupacho/i.test(x.r[0].pastille), '[stream] le pseudo trouvé ne s’écrit pas en clair', JSON.stringify(x.r[0]));
      await mesurer(pg, '500123', '[data-recherche-cle="colis:MR7000123"]'); await pg.waitForTimeout(600);
      x = await res(pg);
      const c = x.r.find((r) => r.cle === 'colis:MR7000123');
      dit(c && !/500123/.test(c.pastille), '[stream] le code de retrait ne s’écrit pas en clair', JSON.stringify(c));
      const txt = await pg.evaluate(() => document.querySelector('[data-recherche-panneau]').innerText);
      dit(!/poupacho|500123/.test(txt), '[stream] ni pseudo ni code dans le texte du panneau', txt.slice(0, 160).replace(/\n/g, ' · '));
      await pg.screenshot({ path: path.join(SHOTS, 'loupe-stream-1512.png') });
    });
    dit(errs.length === 0, '[stream] aucune erreur de page', errs.join(' | ').slice(0, 200));
    await ctx.close();
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  if (temps.length) { const s = [...temps].sort((a, b) => a - b); console.log(`\nTemps de réponse (frappe → ligne peinte), ${s.length} mesures : médiane ${s[Math.floor(s.length / 2)]} ms, pire ${s[s.length - 1]} ms`); }
  console.log(ko ? `\n❌ loupe universelle : ${ko} rouge(s)` : '\n✅ loupe universelle : tout est vert');
  process.exit(ko ? 1 : 0);
})();
