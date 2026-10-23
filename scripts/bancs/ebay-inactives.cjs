// Banc : eBay → Annonces → INACTIVES (23 octobre) — l'écran RENDU, sur des
// données INVENTÉES (le dépôt est public : aucune fixture).
//
// Julien demandait si les onglets de l'app eBay sont dans VRM : il manquait
// « Inactives », les annonces TERMINÉES SANS VENTE (eBay les garde 60 à 90 jours).
// La route les range par compte dans `ebay_inactives{_clé}` (audit-ebay-route,
// section 14) ; ce banc rend l'écran à 390 px tactile et 1512 px et juge les
// `data-*` posés par l'écran (§6.5 — le texte reste libre) :
//   · TROIS états, et « pas su » : jamais lue (aucun nombre, aucune ligne
//     inventée, la phrase « se lit à la prochaine relecture ») · lue vide · lue
//     (« Inactives (N) ») · lecture en 522 (aucune ligne, aucun nombre) ;
//   · le N° SEULEMENT par le SKU VRM-{n°} — une annonce au titre identique à une
//     paire, sans SKU, n'a pas de N° (§5) ;
//   · chaque ligne mène à SA page eBay ; « Remettre en vente » n'est pas proposé
//     pour une paire prouvée vendue sur Vinted (le retrait d'eBay d'une paire
//     vendue l'envoie dans cette liste), ni pour une paire déjà de retour sur
//     eBay (en ligne, ou RelistedItemID), ni tant que les ventes n'ont pas pu
//     être vérifiées (dit une fois) ;
//   · « encore en ligne sur Vinted » seulement par identité ;
//   · plusieurs comptes : la vue d'UN compte ne montre que ses inactives ; un
//     compte illisible est nommé et AUCUN nombre n'est affiché ; une liste qu'eBay
//     a coupée (`complet:'false'` — `->>` rend du TEXTE en production, §6.3) dit
//     « au moins N », jamais « N » ;
//   · rien ne part vers /api/ebay qui remettrait en vente ; aucun débordement,
//     cibles ≥ 44 px au doigt, aucune erreur de page.
// Lancer : npm run build, puis
//   NODE_OPTIONS="--require /tmp/claude-0/redir-pw.cjs" BANC_PORT=9131 node scripts/bancs/ebay-inactives.cjs
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9131;

const auj = new Date();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const annonce = (id, titre, prix, ferme) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille (\d+)/.exec(titre) || [])[1] || '', is_closed: !!ferme, is_hidden: false, is_draft: false, photo: { url: 'https://img.test/v' + id + '.jpg' } });
const LISTINGS = { capturedAt: auj.toISOString(), payload: { items: [
  annonce(7001, 'Nike Dunk Low panda taille 42', 95),
  annonce(7002, 'Adidas Gazelle bleu taille 40', 80, true),     // vendue sur Vinted (son bordereau)
  annonce(7003, 'Salomon XT-6 noir taille 41', 120),
  annonce(7004, 'New Balance 550 blanc taille 43', 90),
  annonce(7005, 'Asics Gel 1130 argent taille 39', 70),
  annonce(7006, 'Puma Suede rouge taille 42', 60),
] } };
const fiche = (numero, title, id) => ({ numero, title, photo: 'https://img.test/v' + id + '.jpg' });
const MAIN = { vinted_annonce_numeros: {
  '7001': fiche('21', 'Nike Dunk Low panda taille 42', 7001),
  '7002': fiche('22', 'Adidas Gazelle bleu taille 40', 7002),
  '7003': fiche('23', 'Salomon XT-6 noir taille 41', 7003),
  '7004': fiche('24', 'New Balance 550 blanc taille 43', 7004),
  '7005': fiche('25', 'Asics Gel 1130 argent taille 39', 7005),
  '7006': fiche('26', 'Puma Suede rouge taille 42', 7006),
} };
const recent = (h) => new Date(Date.now() - h * 3600000).toISOString();
// La N°22 est PROUVÉE vendue sur Vinted par son bordereau (la forme réelle, comme
// ebay-annonces.cjs : pas de ligne de transaction).
const VENTES = { capturedAt: auj.toISOString(), payload: { my_orders: [
  { transaction_id: 9001, title: 'Adidas Gazelle bleu taille 40', status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: recent(20) },
] } };
const BORDEREAU = { id: 'harvest_111_label_9001', data: { uid: '111', url: 'https://s3.test/l.pdf', tx: '9001', item: '7002', items: ['7002'], capturedAt: auj.toISOString(), pdfB64: 'JVBERi0x' } };
// Les inactives (la forme RANGÉE par la route : `resumeInactive`).
const ina = (itemId, title, sku, price, fin, extra) => ({ itemId, sku, title, price, currency: 'EUR', fin, depuis: '2026-09-01T10:00:00.000Z', observateurs: null, photo: 'https://i.ebayimg.com/images/g/' + itemId + '/s-l225.jpg', relanceeEn: '', ...(extra || {}) });
const I = {
  en_vinted: ina('120000000021', 'Nike Dunk Low panda T42', 'VRM-21', '95.0', '2026-10-05T10:00:00.000Z', { observateurs: 2 }),   // encore en ligne sur Vinted
  vendue: ina('120000000022', 'Adidas Gazelle bleu T40', 'VRM-22', '80.0', '2026-10-04T10:00:00.000Z'),                         // vendue sur Vinted
  sans_sku: ina('120000000023', 'Salomon XT-6 noir taille 41', '', '120.0', '2026-10-03T10:00:00.000Z'),                         // titre identique à la N°23, sans SKU
  relancee: ina('120000000024', 'New Balance 550 blanc T43', 'VRM-24', '90.0', '2026-10-02T10:00:00.000Z', { relanceeEn: '120000000099' }),
  en_vente: ina('120000000025', 'Asics Gel 1130 argent T39', 'VRM-25', '70.0', '2026-10-01T10:00:00.000Z'),                     // déjà de nouveau en vente sur eBay
};
const K1 = 'aaaaaaaaaaaaaaa1', K2 = 'bbbbbbbbbbbbbbb2';
const I_K2 = ina('120000000026', 'Puma Suede rouge T42', 'VRM-26', '60.0', '2026-10-06T10:00:00.000Z');
let rows = [];
// `inactives` : undefined = ligne ABSENTE · un objet = la ligne rangée.
const remettre = ({ inactives, multi, inactivesK2 } = {}) => {
  rows = [
    { id: 'main', data: JSON.parse(JSON.stringify(MAIN)) },
    { id: 'harvest_111_listings', data: LISTINGS },
    { id: 'harvest_111_orders_sold', data: VENTES },
    BORDEREAU,
    { id: 'ebay_listings', data: { items: [{ itemId: '120000000777', title: 'Asics Gel 1130 argent taille 39', price: '75.0', sku: 'VRM-25', depuis: recent(10), observateurs: 0, photo: '' }], capturedAt: Date.now() } },
    { id: 'ebay_orders', data: { orders: [], capturedAt: Date.now() } },
    { id: 'ebay_programmees', data: { items: [], enLigne: [], complet: true, capturedAt: Date.now() } },
    { id: 'lbc_ventes', data: { ventes: {} } },
    ...(inactives ? [{ id: 'ebay_inactives', data: inactives }] : []),
    ...(multi ? [
      { id: 'ebay_comptes', data: { comptes: [{ cle: K1, pseudo: 'paire_perso', principal: true, ajouteLe: 1 }, { cle: K2, pseudo: 'paire_pro', principal: false, ajouteLe: 2 }] } },
      { id: 'ebay_listings_' + K2, data: { items: [], capturedAt: Date.now() } },
      { id: 'ebay_orders_' + K2, data: { orders: [], capturedAt: Date.now() } },
      { id: 'ebay_programmees_' + K2, data: { items: [], enLigne: [], complet: true, capturedAt: Date.now() } },
      ...(inactivesK2 ? [{ id: 'ebay_inactives_' + K2, data: inactivesK2 }] : []),
    ] : []),
  ];
};
const lue = (items, complet) => ({ items, complet: complet === false ? false : true, jours: 60, capturedAt: Date.now() });

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
srv.listen(PORT);
// Projection PostgREST (§6.3) : `alias:data->champ` rend le JSON, `->>` rend du
// TEXTE (un booléen arrive en « false » — la forme que lit l'app en production).
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (v != null && /->>[^>]*$/.test(src) && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};

// `opts.casse(u)` : cette lecture ne répond pas (522 + HTML, la vraie forme d'une panne).
async function ouvrir(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const envois = [];
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (opts.casse && route.request().method() === 'GET' && opts.casse(u)) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
    if (route.request().method() !== 'GET') {
      try { for (const l of [].concat(JSON.parse(route.request().postData() || 'null') || [])) { if (!l || !l.id || !l.data) continue; const i = rows.findIndex((r) => r.id === l.id); if (i >= 0) rows[i] = { id: l.id, data: l.data }; else rows.push({ id: l.id, data: l.data }); } } catch (_) {}
      return j([]);
    }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (opts.ventesKo && (/_txn_/.test(u) || /ebay_orders/.test(u) || /_label_/.test(u) || /orders_sold/.test(u))) return j({ message: 'timeout' }, 500);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // ⚠️ enregistré APRÈS le fourre-tout → Playwright le prend en PREMIER (§6.6).
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    envois.push(body);
    if (body.action === 'status') return j({ ok: true, connected: opts.connected !== false });
    if (body.action === 'offreinfo') return j({ ok: true, eligibles: [], complet: true });
    if (body.action === 'finances') return j({ ok: false, reason: 'scope', error: 'x' });
    return j({ ok: true });
  });
  return { ctx, pg, errs, envois };
}
async function versAnnonces(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1500);
  await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 });
  await pg.waitForSelector('[data-ebay-inactives]:not([data-ebay-inactives="charge"])', { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(800);
}
const choisirVue = async (pg, val) => { await pg.selectOption('#vrm-sel-compte-ebay', val); await pg.waitForTimeout(900); };
const lire = (pg) => pg.evaluate(() => {
  const sec = document.querySelector('[data-ebay-inactives]');
  const lignes = [...document.querySelectorAll('[data-ebay-inactive]')].map((e) => ({
    id: e.getAttribute('data-ebay-inactive'), num: e.getAttribute('data-inactive-num'), fin: e.getAttribute('data-inactive-fin'),
    compte: e.getAttribute('data-inactive-compte'), vendue: e.getAttribute('data-inactive-vendue'), deja: e.getAttribute('data-inactive-deja'),
    vinted: e.getAttribute('data-inactive-vinted'),
    relancer: (e.querySelector('a[data-inactive-relancer]') || {}).href || '',
    relancerCible: (e.querySelector('a[data-inactive-relancer]') || { getAttribute: () => '' }).getAttribute('target') || '',
    voir: (e.querySelector('a[data-inactive-voir]') || {}).href || '',
    texte: e.innerText,
  }));
  return {
    etat: sec ? sec.getAttribute('data-ebay-inactives') : null,
    n: sec ? sec.getAttribute('data-ebay-inactives-n') : null,
    aumoins: sec ? sec.getAttribute('data-ebay-inactives-aumoins') : null,
    titre: sec ? (sec.firstElementChild || {}).innerText || '' : '',
    note: sec ? [...sec.querySelectorAll('[data-inactives-note]')].map((x) => x.getAttribute('data-inactives-note')) : [],
    illisibles: sec ? (sec.querySelector('[data-inactives-illisibles]') || { getAttribute: () => null }).getAttribute('data-inactives-illisibles') : null,
    verif: sec ? (sec.querySelector('[data-inactives-verif]') || { getAttribute: () => null }).getAttribute('data-inactives-verif') : null,
    lignes,
    mort: /n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
  };
});
const cibles = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-ebay-inactives] a, [data-ebay-inactives] button, [data-ebay-inactives] summary')]
  .filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || '').slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }));
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const relistes = (envois) => envois.filter((x) => /relist|remettre|republi/i.test(JSON.stringify(x)) || ['publish', 'programmer'].includes(x.action));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = `[${vp.width}]`;
      console.log(`── ${vp.width} px`);
      // ── A. JAMAIS LUE : la ligne n'existe pas ──────────────────────────────
      await essaie(T + ' A jamais lue', async () => {
        remettre({});
        const { ctx, pg, errs } = await ouvrir(b, vp);
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'jamais' && s.note.includes('jamais') && !s.n && !s.aumoins && !s.lignes.length && !/\(\d/.test(s.titre) && !errs.length && !s.mort,
          `${T} jamais lue ⇒ « jamais » : la phrase de la prochaine relecture, AUCUN nombre, aucune ligne inventée (et aucune erreur de page)`, JSON.stringify({ etat: s.etat, n: s.n, titre: s.titre, lignes: s.lignes.length, errs: errs.join(' | ').slice(0, 120) }));
        await ctx.close();
      });
      // ── A bis. Pas d'eBay relié : on ne promet pas une relecture qui n'aura pas
      //    lieu — mais ce qui est RANGÉ reste montré (les deux sens, un contrôle).
      await essaie(T + ' A2 pas relié', async () => {
        const voir = async (inactives) => {
          remettre(inactives ? { inactives } : {});
          const { ctx, pg } = await ouvrir(b, vp, { connected: false });
          await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
          await pg.waitForTimeout(1500);
          await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 });
          await pg.waitForSelector('[data-ebay-annonce]', { timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(2500);
          const s = await lire(pg); const annonce = !!(await pg.$('[data-ebay-annonce]'));
          await ctx.close();
          return { s, annonce };
        };
        const vide = await voir(null), rangee = await voir(lue([I.en_vinted]));
        dit(vide.annonce && vide.s.etat === null && rangee.s.etat === 'lu' && rangee.s.lignes.length === 1,
          `${T} aucun compte eBay relié : rien de rangé ⇒ pas de section (on ne promet pas une relecture qui n'aura pas lieu) ; une inactive DÉJÀ rangée ⇒ montrée`, `rien rangé : ${vide.s.etat} · rangée : ${rangee.s.etat}/${rangee.s.lignes.length}`);
      });
      // ── B. LUE VIDE ────────────────────────────────────────────────────────
      await essaie(T + ' B lue vide', async () => {
        remettre({ inactives: lue([]) });
        const { ctx, pg } = await ouvrir(b, vp);
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'vide' && s.note.includes('vide') && !s.lignes.length && !s.n,
          `${T} lue sans entrée ⇒ « vide » (« aucune annonce terminée sans vente »), aucune ligne`, JSON.stringify({ etat: s.etat, note: s.note }));
        await ctx.close();
      });
      // ── C. LUE ─────────────────────────────────────────────────────────────
      await essaie(T + ' C lue', async () => {
        remettre({ inactives: lue([I.en_vente, I.relancee, I.sans_sku, I.vendue, I.en_vinted]) });
        const { ctx, pg, errs, envois } = await ouvrir(b, vp);
        await versAnnonces(pg);
        await pg.waitForSelector('[data-ebay-inactive="120000000021"] a[data-inactive-relancer]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(600);
        const s = await lire(pg);
        const L = Object.fromEntries(s.lignes.map((l) => [l.id, l]));
        dit(s.etat === 'lu' && s.n === '5' && /\(5\)/.test(s.titre) && s.lignes.length === 5,
          `${T} lue ⇒ « Inactives (5) », 5 lignes`, JSON.stringify({ etat: s.etat, n: s.n, titre: s.titre }));
        dit(s.lignes.map((l) => l.id).join(',') === '120000000021,120000000022,120000000023,120000000024,120000000025',
          `${T} les plus récemment terminées d'abord`, s.lignes.map((l) => l.id).join(','));
        dit(L['120000000021'] && L['120000000021'].num === '21' && L['120000000022'].num === '22' && L['120000000024'].num === '24' && L['120000000023'] && L['120000000023'].num === '',
          `${T} le N° SEULEMENT par le SKU : VRM-21/22/24 ⇒ N°21/22/24 ; le titre identique à la N°23 sans SKU ⇒ AUCUN N° (§5)`, JSON.stringify(s.lignes.map((l) => [l.id, l.num])));
        dit(L['120000000021'] && L['120000000021'].fin === '2026-10-05' && L['120000000025'].fin === '2026-10-01', `${T} « terminée le … » (jour de Paris)`, JSON.stringify(s.lignes.map((l) => l.fin)));
        const r21 = L['120000000021'] || {};
        dit(r21.relancer === 'https://www.ebay.fr/itm/120000000021' && r21.relancerCible === '_blank' && !r21.vendue && !r21.deja,
          `${T} une paire libre ⇒ « Remettre en vente sur eBay ↗ » vers SA page eBay (nouvel onglet) — VRM ne remet rien en vente lui-même`, JSON.stringify(r21));
        dit(r21.vinted === 'en-ligne', `${T} la N°21 est encore en ligne sur Vinted (par identité) ⇒ dit sur sa ligne`, String(r21.vinted));
        const r22 = L['120000000022'] || {};
        dit(r22.vendue === 'Vinted' && !r22.relancer && r22.voir === 'https://www.ebay.fr/itm/120000000022',
          `${T} la N°22, PROUVÉE vendue sur Vinted ⇒ pas de « Remettre en vente » (seulement « Voir sur eBay »), et c'est dit`, JSON.stringify(r22));
        const r24 = L['120000000024'] || {}, r25 = L['120000000025'] || {};
        dit(r24.deja === 'relancee' && !r24.relancer && !!r24.voir && r25.deja === 'en-vente' && !r25.relancer && !!r25.voir,
          `${T} déjà remise en vente (RelistedItemID) ou déjà de nouveau en vente sur eBay (même N°) ⇒ pas de second « Remettre en vente »`, JSON.stringify([r24.deja, r25.deja]));
        const r23 = L['120000000023'] || {};
        dit(!!r23.relancer && !r23.vendue && !r23.vinted, `${T} sans N° (pas reliée) : VRM ne juge rien, le lien reste`, JSON.stringify(r23));
        dit(s.etat === 'lu' && s.lignes.length === 5 && relistes(envois).length === 0 && s.verif === null, `${T} la liste lue, rien ne part vers /api/ebay qui remettrait en vente ; ventes vérifiées ⇒ aucune réserve`, JSON.stringify(relistes(envois)));
        const d = await deborde(pg);
        dit(s.lignes.length === 5 && d.sw <= d.cw + 1, `${T} les 5 lignes rendues, aucun débordement horizontal`, `${d.sw} / ${d.cw}`);
        if (vp.width < 600) { const c = await cibles(pg); const petites = c.filter((x) => x.h < 44); dit(c.length >= 5 && !petites.length, `${T} au doigt : chaque lien et bouton de la section fait au moins 44 px`, JSON.stringify(petites)); }
        else { const box = await pg.$eval('[data-ebay-inactives]', (e) => { const r = e.getBoundingClientRect(); return { top: r.top + window.scrollY, h: r.height }; }); dit(box.h > 100, `${T} la section est rendue (hauteur ${Math.round(box.h)} px)`); }
        dit(s.etat === 'lu' && !errs.length && !s.mort, `${T} la liste lue, aucune erreur de page`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      // ── D. LECTURE EN PANNE ────────────────────────────────────────────────
      await essaie(T + ' D pas su', async () => {
        remettre({ inactives: lue([I.en_vinted, I.vendue]) });
        const { ctx, pg } = await ouvrir(b, vp, { casse: (u) => /id=eq\.ebay_inactives/.test(u) });
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'pas-su' && s.note.includes('pas-su') && !s.lignes.length && !s.n && !s.aumoins && !/\(\d/.test(s.titre),
          `${T} lecture en 522 ⇒ « pas su » : aucune ligne, AUCUN nombre (jamais « 0 », jamais une ancienne liste comme fraîche)`, JSON.stringify({ etat: s.etat, titre: s.titre, lignes: s.lignes.length }));
        await ctx.close();
      });
      // ── E. PLUSIEURS COMPTES : la vue suit le compte choisi ────────────────
      await essaie(T + ' E vue', async () => {
        remettre({ multi: true, inactives: lue([I.en_vinted, I.vendue]), inactivesK2: lue([I_K2]) });
        const { ctx, pg } = await ouvrir(b, vp);
        await versAnnonces(pg);
        await pg.waitForSelector('#vrm-sel-compte-ebay', { timeout: 10000 });
        let s = await lire(pg);
        const tous = s.lignes.map((l) => l.id).sort().join(',');
        dit(s.etat === 'lu' && tous === '120000000021,120000000022,120000000026' && s.n === '3' && s.lignes.find((l) => l.id === '120000000026').compte === K2 && /paire_pro/.test(s.lignes.find((l) => l.id === '120000000026').texte),
          `${T} « Tous les comptes » : les inactives des deux comptes, chacune marquée de SON compte, nommé sur la ligne (la liste en mélange deux)`, tous);
        await choisirVue(pg, K2);
        s = await lire(pg);
        dit(s.lignes.length === 1 && s.lignes[0].id === '120000000026' && s.n === '1',
          `${T} la vue « paire_pro » ne montre que SES inactives (1) — aucune de l'autre compte`, JSON.stringify(s.lignes.map((l) => l.id)));
        await ctx.close();
      });
      // ── E2. UN COMPTE ILLISIBLE : nommé, aucun nombre ──────────────────────
      await essaie(T + ' E2 un compte illisible', async () => {
        remettre({ multi: true, inactives: lue([I.en_vinted]), inactivesK2: lue([I_K2]) });
        const { ctx, pg } = await ouvrir(b, vp, { casse: (u) => new RegExp('id=eq\\.ebay_inactives_' + K2).test(u) });
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'pas-su' && s.illisibles === K2 && !s.n && !s.aumoins && !/\(\d/.test(s.titre) && s.lignes.length === 1 && s.lignes[0].id === '120000000021',
          `${T} le compte paire_pro illisible ⇒ « pas su », ce compte NOMMÉ, AUCUN « Inactives (N) » — les inactives lues de l'autre compte restent montrées`, JSON.stringify({ etat: s.etat, ill: s.illisibles, n: s.n, titre: s.titre, lignes: s.lignes.map((l) => l.id) }));
        await ctx.close();
      });
      // ── G. LISTE COUPÉE PAR eBAY (complet:'false' en TEXTE) ────────────────
      await essaie(T + ' G liste coupée', async () => {
        remettre({ inactives: lue([I.en_vinted, I.sans_sku], false) });
        const { ctx, pg } = await ouvrir(b, vp);
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'lu' && !s.n && s.aumoins === '2' && /au moins 2/.test(s.titre),
          `${T} eBay en a plus que la page lue ⇒ « au moins 2 », jamais « (2) »`, JSON.stringify({ n: s.n, aumoins: s.aumoins, titre: s.titre }));
        await ctx.close();
      });
      // ── F. VENTES ILLISIBLES : pas de « Remettre en vente » sur une paire reliée
      await essaie(T + ' F ventes pas su', async () => {
        remettre({ inactives: lue([I.en_vinted, I.sans_sku]) });
        const { ctx, pg } = await ouvrir(b, vp, { ventesKo: true });
        await versAnnonces(pg);
        await pg.waitForSelector('[data-inactives-verif]', { timeout: 15000 }).catch(() => {});
        const s = await lire(pg);
        const r21 = s.lignes.find((l) => l.id === '120000000021') || {}, r23 = s.lignes.find((l) => l.id === '120000000023') || {};
        dit(s.etat === 'lu' && !r21.relancer && !!r21.voir && s.verif === '1' && !!r23.relancer,
          `${T} ventes illisibles ⇒ la N°21 n'a PAS « Remettre en vente » (vendue ailleurs ? pas su), dit UNE fois ; la ligne sans N° garde son lien`, JSON.stringify({ verif: s.verif, r21: [r21.relancer, r21.voir], r23: r23.relancer }));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e && e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) en échec, ${ok} vert(s)` : `\nTous les contrôles passent (${ok}) — Inactives : trois états et « pas su », le N° par le SKU seul, la vue suit le compte, rien n'est remis en vente par VRM.`);
  process.exit(ko ? 1 : 0);
})();
