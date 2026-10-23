// Banc : eBay → Annonces → INACTIVES (23 octobre) — l'écran RENDU, sur des
// données INVENTÉES (le dépôt est public : aucune fixture).
//
// Julien demandait si les onglets de l'app eBay sont dans VRM : il manquait
// « Inactives », les annonces TERMINÉES SANS VENTE (eBay les garde 60 à 90 jours).
// La route les range par compte dans `ebay_inactives{_clé}` (audit-ebay-route,
// section 14) ; ce banc rend l'écran à 390 px tactile et 1512 px et juge les
// `data-*` posés par l'écran (§6.5 — le texte reste libre) :
//   · TROIS états, et « pas su » : jamais lue (aucun nombre, aucune ligne
//     inventée, et AUCUNE promesse « se lit à la prochaine relecture » quand une
//     relecture a déjà eu lieu sans que eBay rende la liste) · lue vide · lue
//     (« Inactives (N) ») · lecture en 522 (aucune ligne, aucun nombre) ;
//   · (revue du 23 octobre) une capture ANCIENNE (pas relue depuis 24 h, ou les
//     annonces en ligne relues APRÈS elle : eBay ne l'a pas rendue à cette
//     relecture) n'est jamais présentée comme la liste du jour : l'âge est dit,
//     aucun « (N) », aucun « Remettre en vente » ; une annonce terminée hors de
//     la fenêtre de 60 jours n'est jamais montrée ;
//   · le N° SEULEMENT par le SKU VRM-{n°} — une annonce au titre identique à une
//     paire, sans SKU, n'a pas de N° (§5) ; lu avec la date de PUBLICATION : une
//     annonce d'avant la remise à zéro (013) parle de la série B, et une fiche
//     numérotée APRÈS la publication n'est pas la paire de l'annonce ;
//   · chaque ligne mène à SA page eBay ; « Remettre en vente » n'est pas proposé
//     pour une paire prouvée vendue sur Vinted, ni pour une paire déjà de retour
//     sur eBay sous une AUTRE annonce (RelistedItemID, ou même N°), ni tant que
//     les ventes ne sont pas vérifiées (en cours ou illisibles) ; la MÊME annonce
//     vue en ligne et inactive est « à relire », jamais « de nouveau en vente » ;
//   · « encore en ligne sur Vinted » seulement par identité (une paire dont
//     l'annonce Vinted est fermée ne l'a pas) ;
//   · « terminée le … » au jour de PARIS (une fin à 23 h 30 UTC est le lendemain) ;
//   · le prix avec SA devise (« 95,00 USD », jamais « 95,00 € USD ») ;
//   · §7 : une panne déjà dite sur l'écran (ventes illisibles, registre eBay
//     illisible) n'est pas redite par la section ; dite seulement si elle ne
//     l'est nulle part ailleurs ;
//   · plusieurs comptes : la vue d'UN compte ne montre que ses inactives ; un
//     compte illisible est nommé et AUCUN nombre n'est affiché ; un compte jamais
//     lu est nommé (jamais « (N) » sur un total partiel), un compte lu vide n'est
//     pas rabattu sur « jamais » ; une liste qu'eBay a coupée (`complet:'false'` —
//     `->>` rend du TEXTE en production, §6.3) dit « au moins N » ;
//   · rien ne part vers /api/ebay qui remettrait en vente ; aucun débordement,
//     cibles ≥ 44 px au doigt, aucune erreur de page.
// Lancer : npm run build, puis
//   NODE_OPTIONS="--require /tmp/claude-0/redir-pw.cjs" BANC_PORT=9131 node scripts/bancs/ebay-inactives.cjs
// `BANC_SEUL=A,C,…` ne lance que ces scénarios (lettres ci-dessous).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9131;
const SEUL = String(process.env.BANC_SEUL || '').split(',').map((x) => x.trim()).filter(Boolean);
const lance = (c) => !SEUL.length || SEUL.includes(c);

// Les dates sont RELATIVES à aujourd'hui : l'écran écarte une annonce terminée
// hors de la fenêtre de 60 jours — des dates écrites en dur feraient vieillir le banc.
const JOUR = 86400000;
const jour = (n, hh = 10, mm = 0) => { const d = new Date(Date.now() - n * JOUR); d.setUTCHours(hh, mm, 0, 0); return d.toISOString(); };
const parisJour = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
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
  annonce(7007, 'Converse Chuck 70 noir taille 41', 55, true),  // FERMÉE sur Vinted, SANS vente prouvée
  annonce(7008, 'Nike Dunk Low panda taille 42 (ancienne)', 90, true),   // l'ancienne N°B21 (013)
] } };
const fiche = (numero, title, id, extra) => ({ numero, title, photo: 'https://img.test/v' + id + '.jpg', ...(extra || {}) });
const MAIN = { vinted_annonce_numeros: {
  '7001': fiche('21', 'Nike Dunk Low panda taille 42', 7001),
  '7002': fiche('22', 'Adidas Gazelle bleu taille 40', 7002),
  '7003': fiche('23', 'Salomon XT-6 noir taille 41', 7003),
  '7004': fiche('24', 'New Balance 550 blanc taille 43', 7004),
  '7005': fiche('25', 'Asics Gel 1130 argent taille 39', 7005),
  '7006': fiche('26', 'Puma Suede rouge taille 42', 7006),
  '7007': fiche('27', 'Converse Chuck 70 noir taille 41', 7007),
} };
const recent = (h) => new Date(Date.now() - h * 3600000).toISOString();
// La N°22 est PROUVÉE vendue sur Vinted par son bordereau (la forme réelle, comme
// ebay-annonces.cjs : pas de ligne de transaction).
const VENTES = { capturedAt: auj.toISOString(), payload: { my_orders: [
  { transaction_id: 9001, title: 'Adidas Gazelle bleu taille 40', status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: recent(20) },
] } };
const BORDEREAU = { id: 'harvest_111_label_9001', data: { uid: '111', url: 'https://s3.test/l.pdf', tx: '9001', item: '7002', items: ['7002'], capturedAt: auj.toISOString(), pdfB64: 'JVBERi0x' } };
// Les inactives (la forme RANGÉE par la route : `resumeInactive`). `depuis` est
// une date FIXE d'avant la coupure du 9 octobre (013) : elle ne compte que pour
// les scénarios qui posent le marqueur ou une date de numérotation.
const DEPUIS = '2026-09-01T10:00:00.000Z';
const ina = (itemId, title, sku, price, fin, extra) => ({ itemId, sku, title, price, currency: 'EUR', fin, depuis: DEPUIS, observateurs: null, photo: 'https://i.ebayimg.com/images/g/' + itemId + '/s-l225.jpg', relanceeEn: '', ...(extra || {}) });
const I = {
  en_vinted: ina('120000000021', 'Nike Dunk Low panda T42', 'VRM-21', '95.0', jour(18), { observateurs: 2 }),   // encore en ligne sur Vinted
  vendue: ina('120000000022', 'Adidas Gazelle bleu T40', 'VRM-22', '80.0', jour(19)),                         // vendue sur Vinted
  sans_sku: ina('120000000023', 'Salomon XT-6 noir taille 41', '', '120.0', jour(20)),                         // titre identique à la N°23, sans SKU
  relancee: ina('120000000024', 'New Balance 550 blanc T43', 'VRM-24', '90.0', jour(21), { relanceeEn: '120000000099' }),
  en_vente: ina('120000000025', 'Asics Gel 1130 argent T39', 'VRM-25', '70.0', jour(22)),                     // déjà de nouveau en vente sur eBay (AUTRE annonce)
};
const K1 = 'aaaaaaaaaaaaaaa1', K2 = 'bbbbbbbbbbbbbbb2';
const I_K2 = ina('120000000026', 'Puma Suede rouge T42', 'VRM-26', '60.0', jour(17));
const MARQUEUR_013 = { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z', appliqueLe: '2026-10-11T14:58:07Z' };
let rows = [];
// `inactives` : undefined = ligne ABSENTE · un objet = la ligne rangée.
// `listingsCap` : la date de la dernière relecture des annonces EN LIGNE (par
// défaut maintenant) · `sansListings` : aucune relecture des annonces rangée.
// `main(m)` : retouche la copie de `main` (marqueur 013, dates de numérotation).
const remettre = ({ inactives, multi, inactivesK2, listingsCap, sansListings, main, listingsItems } = {}) => {
  const m = JSON.parse(JSON.stringify(MAIN));
  if (main) main(m);
  rows = [
    { id: 'main', data: m },
    { id: 'harvest_111_listings', data: LISTINGS },
    { id: 'harvest_111_orders_sold', data: VENTES },
    BORDEREAU,
    ...(sansListings ? [] : [{ id: 'ebay_listings', data: { items: listingsItems || [{ itemId: '120000000777', title: 'Asics Gel 1130 argent taille 39', price: '75.0', sku: 'VRM-25', depuis: recent(10), observateurs: 0, photo: '' }], capturedAt: listingsCap != null ? listingsCap : Date.now() } }]),
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
const lue = (items, complet, cap) => ({ items, complet: complet === false ? false : true, jours: 60, capturedAt: cap != null ? cap : Date.now() });

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

const PREUVES = (u) => /_label_|orders_sold|_txn_/.test(u);
// `opts.casse(u)` : cette lecture ne répond pas (522 + HTML, la vraie forme d'une panne).
// `opts.ventesKo` : les ventes (Vinted ET eBay) illisibles · `opts.vintedKo` : les
// ventes Vinted seules · `opts.retenir` : les lectures de la preuve de vente sont
// TENUES jusqu'à ce que cette promesse se résolve (un geste joué sur une requête
// tenue, jamais sur un délai).
async function ouvrir(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const envois = [];
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }).catch(() => {});
    if (opts.casse && route.request().method() === 'GET' && opts.casse(u)) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
    if (route.request().method() !== 'GET') {
      try { for (const l of [].concat(JSON.parse(route.request().postData() || 'null') || [])) { if (!l || !l.id || !l.data) continue; const i = rows.findIndex((r) => r.id === l.id); if (i >= 0) rows[i] = { id: l.id, data: l.data }; else rows.push({ id: l.id, data: l.data }); } } catch (_) {}
      return j([]);
    }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (opts.ventesKo && (PREUVES(u) || /ebay_orders/.test(u))) return j({ message: 'timeout' }, 500);
    if (opts.vintedKo && PREUVES(u)) return j({ message: 'timeout' }, 500);
    if (opts.retenir && PREUVES(u)) await opts.retenir;
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
  const a = (n) => (sec ? sec.getAttribute(n) : null);
  const lignes = [...document.querySelectorAll('[data-ebay-inactive]')].map((e) => ({
    id: e.getAttribute('data-ebay-inactive'), num: e.getAttribute('data-inactive-num'), fin: e.getAttribute('data-inactive-fin'),
    compte: e.getAttribute('data-inactive-compte'), vendue: e.getAttribute('data-inactive-vendue'), deja: e.getAttribute('data-inactive-deja'),
    vinted: e.getAttribute('data-inactive-vinted'),
    prix: (e.querySelector('[data-inactive-prix]') || {}).innerText || '',
    relancer: (e.querySelector('a[data-inactive-relancer]') || {}).href || '',
    relancerCible: (e.querySelector('a[data-inactive-relancer]') || { getAttribute: () => '' }).getAttribute('target') || '',
    voir: (e.querySelector('a[data-inactive-voir]') || {}).href || '',
    texte: e.innerText,
  }));
  return {
    etat: a('data-ebay-inactives'),
    n: a('data-ebay-inactives-n'),
    aumoins: a('data-ebay-inactives-aumoins'),
    jamais: a('data-inactives-jamais'),
    jamaisComptes: a('data-inactives-jamais-comptes'),
    lueLe: a('data-inactives-lue-le'),
    anciennes: a('data-inactives-anciennes'),
    dit: a('data-inactives-dit'),
    verif: a('data-inactives-verif'),
    // Ce que la section ÉCRIT d'une panne (une phrase, un enfant) — distinct
    // des `data-*` posés sur la section elle-même.
    phrasesVerif: sec ? sec.querySelectorAll('[data-inactives-verif], [data-inactives-verif-texte]').length : 0,
    phrasePasSu: sec ? sec.querySelectorAll('[data-inactives-note="pas-su"]').length : 0,
    fenetre: sec ? sec.querySelectorAll('[data-inactives-fenetre]').length : 0,
    titre: sec ? (sec.firstElementChild || {}).innerText || '' : '',
    note: sec ? [...sec.querySelectorAll('[data-inactives-note]')].map((x) => x.getAttribute('data-inactives-note')) : [],
    illisibles: sec ? (sec.querySelector('[data-inactives-illisibles]') || { getAttribute: () => null }).getAttribute('data-inactives-illisibles') : null,
    lignes,
    ecranPasSu: !!document.querySelector('[data-ebay-pas-su]'),
    ecranBloque: !!document.querySelector('[data-regles-bloquees-commun="pas-su"]'),
    mort: /n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
  };
});
const cibles = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-ebay-inactives] a, [data-ebay-inactives] button, [data-ebay-inactives] summary')]
  .filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || '').slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }));
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const relistes = (envois) => envois.filter((x) => /relist|remettre|republi/i.test(JSON.stringify(x)) || ['publish', 'programmer'].includes(x.action));
const ligne = (s, id) => s.lignes.find((l) => l.id === id) || {};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = `[${vp.width}]`;
      console.log(`── ${vp.width} px`);
      // ── A. JAMAIS LUE : la ligne n'existe pas ──────────────────────────────
      if (lance('A')) await essaie(T + ' A jamais lue', async () => {
        const voir = async (o) => {
          remettre(o);
          const { ctx, pg, errs } = await ouvrir(b, vp);
          await versAnnonces(pg);
          const s = await lire(pg);
          await ctx.close();
          return { s, errs };
        };
        const { s, errs } = await voir({});
        dit(s.etat === 'jamais' && s.note.includes('jamais') && !s.n && !s.aumoins && !s.lignes.length && !/\(\d/.test(s.titre) && !errs.length && !s.mort,
          `${T} jamais lue ⇒ « jamais » : AUCUN nombre, aucune ligne inventée (et aucune erreur de page)`, JSON.stringify({ etat: s.etat, n: s.n, titre: s.titre, lignes: s.lignes.length, errs: errs.join(' | ').slice(0, 120) }));
        // (revue du 23 octobre) Une relecture eBay a DÉJÀ eu lieu (les annonces en
        // ligne sont rangées) sans que eBay rende la liste : « la liste se lit à
        // la prochaine relecture » est une promesse qui peut rester fausse pour
        // toujours. L'écran le sait, et le dit autrement.
        const sans = await voir({ sansListings: true });
        dit(s.jamais === 'non-rendue' && sans.s.etat === 'jamais' && sans.s.jamais === 'pas-relue',
          `${T} jamais lue : relecture des annonces déjà faite ⇒ « pas encore rendue par eBay » (aucune promesse) ; aucune relecture encore ⇒ « se lit avec la relecture »`, `après relecture : ${s.jamais} · sans relecture : ${sans.s.etat}/${sans.s.jamais}`);
      });
      // ── A bis. Pas d'eBay relié : on ne promet pas une relecture qui n'aura pas
      //    lieu — mais ce qui est RANGÉ reste montré (les deux sens, un contrôle).
      if (lance('A2')) await essaie(T + ' A2 pas relié', async () => {
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
      if (lance('B')) await essaie(T + ' B lue vide', async () => {
        remettre({ inactives: lue([]) });
        const { ctx, pg } = await ouvrir(b, vp);
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'vide' && s.note.includes('vide') && !s.lignes.length && !s.n,
          `${T} lue sans entrée ⇒ « vide » (« aucune annonce terminée sans vente »), aucune ligne`, JSON.stringify({ etat: s.etat, note: s.note }));
        await ctx.close();
      });
      // ── C. LUE ─────────────────────────────────────────────────────────────
      if (lance('C')) await essaie(T + ' C lue', async () => {
        remettre({ inactives: lue([I.en_vente, I.relancee, I.sans_sku, I.vendue, I.en_vinted]) });
        const { ctx, pg, errs, envois } = await ouvrir(b, vp);
        await versAnnonces(pg);
        await pg.waitForSelector('[data-ebay-inactive="120000000021"] a[data-inactive-relancer]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(600);
        const s = await lire(pg);
        const L = Object.fromEntries(s.lignes.map((l) => [l.id, l]));
        dit(s.etat === 'lu' && s.n === '5' && /\(5\)/.test(s.titre) && s.lignes.length === 5 && s.fenetre === 1,
          `${T} lue ⇒ « Inactives (5) », 5 lignes, la fenêtre de 60 jours dite une fois`, JSON.stringify({ etat: s.etat, n: s.n, titre: s.titre, fenetre: s.fenetre }));
        dit(s.lignes.map((l) => l.id).join(',') === '120000000021,120000000022,120000000023,120000000024,120000000025',
          `${T} les plus récemment terminées d'abord`, s.lignes.map((l) => l.id).join(','));
        dit(L['120000000021'] && L['120000000021'].num === '21' && L['120000000022'].num === '22' && L['120000000024'].num === '24' && L['120000000023'] && L['120000000023'].num === '',
          `${T} le N° SEULEMENT par le SKU : VRM-21/22/24 ⇒ N°21/22/24 ; le titre identique à la N°23 sans SKU ⇒ AUCUN N° (§5)`, JSON.stringify(s.lignes.map((l) => [l.id, l.num])));
        dit(L['120000000021'] && L['120000000021'].fin === parisJour(I.en_vinted.fin) && L['120000000025'].fin === parisJour(I.en_vente.fin), `${T} « terminée le … » (jour de Paris)`, JSON.stringify(s.lignes.map((l) => l.fin)));
        const r21 = L['120000000021'] || {};
        dit(r21.relancer === 'https://www.ebay.fr/itm/120000000021' && r21.relancerCible === '_blank' && !r21.vendue && !r21.deja,
          `${T} une paire libre ⇒ « Remettre en vente sur eBay ↗ » vers SA page eBay (nouvel onglet) — VRM ne remet rien en vente lui-même`, JSON.stringify(r21));
        const r22 = L['120000000022'] || {};
        // (revue du 23 octobre) Le contrôle ne portait que sur la N°21 : « encore
        // en ligne sur Vinted » posé sur TOUTE paire numérotée passait vert. La
        // N°22 (son annonce Vinted est fermée, vendue) ne doit pas l'avoir.
        dit(r21.vinted === 'en-ligne' && !r22.vinted, `${T} la N°21 est encore en ligne sur Vinted (par identité) ⇒ dit sur sa ligne ; la N°22 (annonce Vinted fermée) ne l'a pas`, JSON.stringify([r21.vinted, r22.vinted]));
        dit(r22.vendue === 'Vinted' && !r22.relancer && r22.voir === 'https://www.ebay.fr/itm/120000000022',
          `${T} la N°22, PROUVÉE vendue sur Vinted ⇒ pas de « Remettre en vente » (seulement « Voir sur eBay »), et c'est dit`, JSON.stringify(r22));
        const r24 = L['120000000024'] || {}, r25 = L['120000000025'] || {};
        dit(r24.deja === 'relancee' && !r24.relancer && !!r24.voir && r25.deja === 'en-vente' && !r25.relancer && !!r25.voir,
          `${T} déjà remise en vente (RelistedItemID) ou déjà de nouveau en vente sur eBay (même N°, AUTRE annonce) ⇒ pas de second « Remettre en vente »`, JSON.stringify([r24.deja, r25.deja]));
        const r23 = L['120000000023'] || {};
        dit(!!r23.relancer && !r23.vendue && !r23.vinted, `${T} sans N° (pas reliée) : VRM ne juge rien, le lien reste`, JSON.stringify(r23));
        dit(s.etat === 'lu' && s.lignes.length === 5 && relistes(envois).length === 0 && s.verif === null && s.phrasesVerif === 0, `${T} la liste lue, rien ne part vers /api/ebay qui remettrait en vente ; ventes vérifiées ⇒ aucune réserve`, JSON.stringify(relistes(envois)));
        const d = await deborde(pg);
        dit(s.lignes.length === 5 && d.sw <= d.cw + 1, `${T} les 5 lignes rendues, aucun débordement horizontal`, `${d.sw} / ${d.cw}`);
        if (vp.width < 600) { const c = await cibles(pg); const petites = c.filter((x) => x.h < 44); dit(c.length >= 5 && !petites.length, `${T} au doigt : chaque lien et bouton de la section fait au moins 44 px`, JSON.stringify(petites)); }
        else { const box = await pg.$eval('[data-ebay-inactives]', (e) => { const r = e.getBoundingClientRect(); return { top: r.top + window.scrollY, h: r.height }; }); dit(box.h > 100, `${T} la section est rendue (hauteur ${Math.round(box.h)} px)`); }
        dit(s.etat === 'lu' && !errs.length && !s.mort, `${T} la liste lue, aucune erreur de page`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      // ── D. LECTURE EN PANNE ────────────────────────────────────────────────
      if (lance('D')) await essaie(T + ' D pas su', async () => {
        remettre({ inactives: lue([I.en_vinted, I.vendue]) });
        const { ctx, pg } = await ouvrir(b, vp, { casse: (u) => /id=eq\.ebay_inactives/.test(u) });
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'pas-su' && s.note.includes('pas-su') && !s.lignes.length && !s.n && !s.aumoins && !/\(\d/.test(s.titre),
          `${T} lecture en 522 ⇒ « pas su » (dit : la panne n'est dite nulle part ailleurs) : aucune ligne, AUCUN nombre (jamais « 0 », jamais une ancienne liste comme fraîche)`, JSON.stringify({ etat: s.etat, titre: s.titre, lignes: s.lignes.length }));
        await ctx.close();
      });
      // ── D2. REGISTRE eBAY ILLISIBLE : la panne est déjà dite par l'écran ────
      //    (« Je n'ai pas pu lire tes annonces eBay ») — la section ne la redit
      //    pas (§7), elle garde ses `data-*` et une pastille.
      if (lance('D2')) await essaie(T + ' D2 registre illisible', async () => {
        remettre({ inactives: lue([I.en_vinted]) });
        const { ctx, pg } = await ouvrir(b, vp, { casse: (u) => /id=eq\.ebay_comptes/.test(u) });
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'pas-su' && s.dit === 'ecran' && s.phrasePasSu === 0 && !s.lignes.length && !s.n,
          `${T} registre eBay illisible (panne dite par l'écran) ⇒ la section reste « pas su » sans redire la panne (§7)`, JSON.stringify({ etat: s.etat, dit: s.dit, phrases: s.phrasePasSu }));
        await ctx.close();
      });
      // ── E. PLUSIEURS COMPTES : la vue suit le compte choisi ────────────────
      if (lance('E')) await essaie(T + ' E vue', async () => {
        remettre({ multi: true, inactives: lue([I.en_vinted, I.vendue]), inactivesK2: lue([I_K2]) });
        const { ctx, pg } = await ouvrir(b, vp);
        await versAnnonces(pg);
        await pg.waitForSelector('#vrm-sel-compte-ebay', { timeout: 10000 });
        let s = await lire(pg);
        const tous = s.lignes.map((l) => l.id).sort().join(',');
        dit(s.etat === 'lu' && tous === '120000000021,120000000022,120000000026' && s.n === '3' && ligne(s, '120000000026').compte === K2 && /paire_pro/.test(ligne(s, '120000000026').texte || ''),
          `${T} « Tous les comptes » : les inactives des deux comptes, chacune marquée de SON compte, nommé sur la ligne (la liste en mélange deux)`, tous);
        await choisirVue(pg, K2);
        s = await lire(pg);
        dit(s.lignes.length === 1 && s.lignes[0].id === '120000000026' && s.n === '1',
          `${T} la vue « paire_pro » ne montre que SES inactives (1) — aucune de l'autre compte`, JSON.stringify(s.lignes.map((l) => l.id)));
        await ctx.close();
      });
      // ── E2. UN COMPTE ILLISIBLE : nommé, aucun nombre ──────────────────────
      if (lance('E2')) await essaie(T + ' E2 un compte illisible', async () => {
        remettre({ multi: true, inactives: lue([I.en_vinted]), inactivesK2: lue([I_K2]) });
        const { ctx, pg } = await ouvrir(b, vp, { casse: (u) => new RegExp('id=eq\\.ebay_inactives_' + K2).test(u) });
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'pas-su' && s.illisibles === K2 && !s.n && !s.aumoins && !/\(\d/.test(s.titre) && s.lignes.length === 1 && s.lignes[0].id === '120000000021',
          `${T} le compte paire_pro illisible ⇒ « pas su », ce compte NOMMÉ, AUCUN « Inactives (N) » — les inactives lues de l'autre compte restent montrées`, JSON.stringify({ etat: s.etat, ill: s.illisibles, n: s.n, titre: s.titre, lignes: s.lignes.map((l) => l.id) }));
        await ctx.close();
      });
      // ── E3. UN COMPTE JAMAIS LU : nommé, aucun nombre (un total partiel
      //    présenté comme complet est pire qu'un total absent, §5) ────────────
      if (lance('E3')) await essaie(T + ' E3 un compte jamais lu', async () => {
        remettre({ multi: true, inactives: lue([I.en_vinted, I.vendue]) });
        const { ctx, pg } = await ouvrir(b, vp);
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'lu' && s.lignes.length === 2 && !s.n && !s.aumoins && !/\(\d|\(au moins/.test(s.titre) && s.note.includes('partielle') && String(s.jamaisComptes || '').split(',').includes(K2),
          `${T} paire_perso lu (2), paire_pro jamais lu ⇒ les 2 lignes, AUCUN « (N) » ni « au moins », paire_pro NOMMÉ`, JSON.stringify({ etat: s.etat, n: s.n, aumoins: s.aumoins, titre: s.titre, note: s.note, jamais: s.jamaisComptes }));
        await ctx.close();
      });
      // ── E4. UN COMPTE LU VIDE, L'AUTRE JAMAIS LU : le lu vide n'est pas
      //    rabattu sur « jamais », le jamais lu est nommé ───────────────────────
      if (lance('E4')) await essaie(T + ' E4 vide + jamais', async () => {
        remettre({ multi: true, inactives: lue([]) });
        const { ctx, pg } = await ouvrir(b, vp);
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'vide' && s.note.includes('vide') && s.note.includes('partielle') && String(s.jamaisComptes || '').split(',').includes(K2) && !s.n,
          `${T} paire_perso lu VIDE, paire_pro jamais lu ⇒ « aucune … sur paire_perso » + « pas encore rendue pour paire_pro » — jamais « pas encore lue » pour tout`, JSON.stringify({ etat: s.etat, note: s.note, jamais: s.jamaisComptes }));
        await ctx.close();
      });
      // ── G. LISTE COUPÉE PAR eBAY (complet:'false' en TEXTE) ────────────────
      if (lance('G')) await essaie(T + ' G liste coupée', async () => {
        remettre({ inactives: lue([I.en_vinted, I.sans_sku], false) });
        const { ctx, pg } = await ouvrir(b, vp);
        await versAnnonces(pg);
        const s = await lire(pg);
        dit(s.etat === 'lu' && !s.n && s.aumoins === '2' && /au moins 2/.test(s.titre),
          `${T} eBay en a plus que la page lue ⇒ « au moins 2 », jamais « (2) »`, JSON.stringify({ n: s.n, aumoins: s.aumoins, titre: s.titre }));
        await ctx.close();
      });
      // ── F. VENTES ILLISIBLES : pas de « Remettre en vente » sur une paire reliée
      if (lance('F')) await essaie(T + ' F ventes pas su', async () => {
        remettre({ inactives: lue([I.en_vinted, I.sans_sku]) });
        const { ctx, pg } = await ouvrir(b, vp, { ventesKo: true });
        await versAnnonces(pg);
        await pg.waitForSelector('[data-ebay-inactives][data-inactives-verif], [data-inactives-verif]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const s = await lire(pg);
        const r21 = ligne(s, '120000000021'), r23 = ligne(s, '120000000023');
        dit(s.etat === 'lu' && !r21.relancer && !!r21.voir && s.verif === '1' && !!r23.relancer,
          `${T} ventes illisibles ⇒ la N°21 n'a PAS « Remettre en vente » (vendue ailleurs ? pas su) ; la ligne sans N° garde son lien`, JSON.stringify({ verif: s.verif, r21: [r21.relancer, r21.voir], r23: r23.relancer }));
        // (revue du 23 octobre, §7) La panne est DÉJÀ dite au-dessus (« Je n'ai
        // pas pu lire tes ventes… ») : la section n'y ajoute pas une phrase de plus.
        dit(s.ecranPasSu && s.phrasesVerif === 0,
          `${T} ventes illisibles, déjà dites par l'écran ⇒ la section ne les redit pas (une cause, une phrase — §7)`, JSON.stringify({ ecran: s.ecranPasSu, bloque: s.ecranBloque, phrasesSection: s.phrasesVerif }));
        await ctx.close();
      });
      // ── F2. L'AUTRE SENS : la panne n'est dite nulle part ailleurs (aucune
      //    annonce en ligne reliée) ⇒ la section la dit, UNE fois ─────────────
      if (lance('F2')) await essaie(T + ' F2 ventes pas su, dit ici', async () => {
        remettre({ inactives: lue([I.en_vinted, I.sans_sku]), listingsItems: [{ itemId: '120000000778', title: 'Vans Old Skool noir taille 40', price: '50.0', sku: '', depuis: recent(10), observateurs: 0, photo: '' }] });
        const { ctx, pg } = await ouvrir(b, vp, { vintedKo: true });
        await versAnnonces(pg);
        await pg.waitForSelector('[data-inactives-verif-texte]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(600);
        const s = await lire(pg);
        dit(!s.ecranPasSu && !s.ecranBloque && s.verif === '1' && s.phrasesVerif === 1 && !ligne(s, '120000000021').relancer,
          `${T} ventes Vinted illisibles, dites NULLE PART ailleurs ⇒ la section le dit une fois, la N°21 sans « Remettre en vente »`, JSON.stringify({ ecran: s.ecranPasSu, verif: s.verif, phrases: s.phrasesVerif }));
        await ctx.close();
      });
      // ── P. VENTES EN COURS DE LECTURE (tenues) : pas de « Remettre en vente »
      //    sur une paire reliée tant qu'on ne sait pas si elle est vendue ───────
      if (lance('P')) await essaie(T + ' P ventes en cours', async () => {
        remettre({ inactives: lue([I.en_vinted, I.vendue]) });
        let lacher; const retenir = new Promise((ok) => { lacher = ok; });
        const { ctx, pg } = await ouvrir(b, vp, { retenir });
        try {
          await versAnnonces(pg);
          await pg.waitForSelector('[data-ebay-inactive="120000000022"]', { timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(600);
          const s1 = await lire(pg);
          const p21 = ligne(s1, '120000000021'), p22 = ligne(s1, '120000000022');
          dit(s1.lignes.length === 2 && !p21.relancer && !p22.relancer && !!p21.voir && !!p22.voir,
            `${T} ventes en cours de lecture ⇒ AUCUNE paire reliée n'a « Remettre en vente » (la N°22 est peut-être vendue) — « Voir sur eBay » seulement`, JSON.stringify({ n21: [p21.relancer, p21.voir], n22: [p22.relancer, p22.voir] }));
        } finally { lacher(); }
        await pg.waitForSelector('[data-ebay-inactive="120000000022"][data-inactive-vendue]', { timeout: 15000 }).catch(() => {});
        await pg.waitForSelector('[data-ebay-inactive="120000000021"] a[data-inactive-relancer]', { timeout: 15000 }).catch(() => {});
        const s2 = await lire(pg);
        const q21 = ligne(s2, '120000000021'), q22 = ligne(s2, '120000000022');
        dit(q22.vendue === 'Vinted' && !q22.relancer && !!q22.voir && !!q21.relancer,
          `${T} ventes lues ⇒ la N°22 dite vendue sur Vinted (« Voir » seul), la N°21 libre retrouve « Remettre en vente »`, JSON.stringify({ q22: [q22.vendue, q22.relancer], q21: q21.relancer }));
        await ctx.close();
      });
      // ── H. CAPTURE ANCIENNE : jamais présentée comme la liste du jour ───────
      if (lance('H')) await essaie(T + ' H capture ancienne', async () => {
        const voir = async (o) => {
          remettre(o);
          const { ctx, pg } = await ouvrir(b, vp);
          await versAnnonces(pg);
          await pg.waitForTimeout(600);
          const s = await lire(pg);
          await ctx.close();
          return s;
        };
        // H1 : rangée il y a 95 jours (eBay ne l'a plus jamais rendue), une annonce
        // terminée il y a 100 jours — hors de la fenêtre de 60 jours d'eBay.
        const capH1 = Date.now() - 95 * JOUR;
        const h1 = await voir({ inactives: lue([ina('120000000051', 'Nike Dunk Low panda T42', 'VRM-21', '95.0', jour(100))], true, capH1) });
        dit(h1.etat === 'ancienne' && !h1.n && !h1.aumoins && !/\(\d/.test(h1.titre) && h1.lueLe === parisJour(capH1) && !h1.lignes.length && h1.fenetre === 0,
          `${T} capture de 95 jours, annonce terminée il y a 100 jours ⇒ « ancienne », lue le … DIT, aucun « (N) », la ligne hors fenêtre écartée, pas de « ces 60 derniers jours »`, JSON.stringify({ etat: h1.etat, n: h1.n, titre: h1.titre, lueLe: h1.lueLe, lignes: h1.lignes.map((l) => [l.id, l.relancer]), fenetre: h1.fenetre }));
        // H2 : rangée il y a 2 jours (aucune relecture depuis), une annonce dans la fenêtre.
        const capH2 = Date.now() - 2 * JOUR;
        const h2 = await voir({ inactives: lue([I.en_vinted], true, capH2), listingsCap: capH2 + 20000 });
        const l2 = ligne(h2, '120000000021');
        dit(h2.etat === 'ancienne' && !h2.n && h2.lueLe === parisJour(capH2) && h2.lignes.length === 1 && !l2.relancer && !!l2.voir,
          `${T} capture de 2 jours ⇒ « ancienne » : l'âge dit, aucun « (N) », la paire libre n'a que « Voir sur eBay » (pas « Remettre en vente » sur une liste qui a pu changer)`, JSON.stringify({ etat: h2.etat, n: h2.n, lueLe: h2.lueLe, l: [l2.relancer, l2.voir] }));
        // H3 : rangée il y a 2 h, mais les annonces en ligne ont été relues APRÈS
        // (eBay n'a pas rendu les inactives à cette relecture) ⇒ ancienne.
        const capH3 = Date.now() - 2 * 3600000;
        const h3 = await voir({ inactives: lue([I.en_vinted], true, capH3), listingsCap: Date.now() });
        const l3 = ligne(h3, '120000000021');
        dit(h3.etat === 'ancienne' && !h3.n && h3.lignes.length === 1 && !l3.relancer && !!l3.voir,
          `${T} inactives rangées il y a 2 h, annonces en ligne relues APRÈS ⇒ « ancienne » (eBay ne l'a pas rendue à la dernière relecture) — aucun « (N) », « Voir » seul`, JSON.stringify({ etat: h3.etat, n: h3.n, l: [l3.relancer, l3.voir] }));
        // H4 : l'autre sens — rangée il y a 2 h par la MÊME relecture que les
        // annonces en ligne ⇒ la liste du jour, avec son chiffre et son lien.
        const h4 = await voir({ inactives: lue([I.en_vinted], true, capH3), listingsCap: capH3 + 20000 });
        const l4 = ligne(h4, '120000000021');
        dit(h4.etat === 'lu' && h4.n === '1' && !h4.lueLe && !!l4.relancer && h4.fenetre === 1,
          `${T} rangée par la même relecture que les annonces en ligne (il y a 2 h) ⇒ « lu », « Inactives (1) », « Remettre en vente » (l'autre sens)`, JSON.stringify({ etat: h4.etat, n: h4.n, lueLe: h4.lueLe, relancer: !!l4.relancer }));
      });
      // ── K. LA MÊME ANNONCE EN LIGNE ET INACTIVE : « à relire », jamais
      //    « de nouveau en vente » (c'est la même ItemID, §5) ─────────────────
      if (lance('K')) await essaie(T + ' K même annonce', async () => {
        remettre({ inactives: lue([ina('120000000777', 'Asics Gel 1130 argent T39', 'VRM-25', '75.0', jour(5))]) });
        const { ctx, pg } = await ouvrir(b, vp);
        await versAnnonces(pg);
        await pg.waitForTimeout(1200);
        const s = await lire(pg);
        const l = ligne(s, '120000000777');
        const enLigne = await pg.$$eval('[data-ebay-annonce]', (es) => es.map((e) => e.getAttribute('data-ebay-annonce')));
        dit(enLigne.includes('120000000777') && l.deja === 'a-relire' && !l.relancer && !!l.voir,
          `${T} l'ItemID 120000000777 à la fois en ligne et inactive ⇒ « à relire » (jamais « déjà de nouveau en vente » : c'est la même annonce), « Voir » seul`, JSON.stringify({ enLigne, deja: l.deja, relancer: l.relancer }));
        await ctx.close();
      });
      // ── I. LE RESTE DE LA LIGNE : vendue ailleurs ? en ligne sur Vinted ?
      //    le jour de Paris, la devise ─────────────────────────────────────────
      if (lance('I')) await essaie(T + ' I détails', async () => {
        const nuit = jour(10, 23, 30);       // 23 h 30 UTC : le LENDEMAIN à Paris
        remettre({ inactives: lue([
          ina('120000000027', 'Converse Chuck 70 noir T41', 'VRM-27', '55.0', jour(12)),
          ina('120000000041', 'Vans Sk8-Hi noir T42', '', '65.0', nuit),
          ina('120000000042', 'Nike Air Max 90 T42', '', '95.0', jour(11), { currency: 'USD' }),
          ina('120000000043', 'Nike Air Max 1 T42', '', '60.0', jour(13), { currency: null }),
        ]) });
        const { ctx, pg } = await ouvrir(b, vp);
        await versAnnonces(pg);
        await pg.waitForSelector('[data-ebay-inactive="120000000027"] a[data-inactive-relancer]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const s = await lire(pg);
        const x27 = ligne(s, '120000000027');
        dit(x27.num === '27' && !x27.vinted && !x27.vendue && !!x27.relancer,
          `${T} la N°27 (annonce Vinted FERMÉE, aucune vente prouvée) ⇒ pas « encore en ligne sur Vinted », pas « vendue » : « Remettre en vente »`, JSON.stringify(x27));
        dit(ligne(s, '120000000041').fin === parisJour(nuit) && parisJour(nuit) !== nuit.slice(0, 10),
          `${T} terminée à 23 h 30 UTC ⇒ « terminée le » au jour de PARIS (le lendemain)`, `${ligne(s, '120000000041').fin} · UTC ${nuit.slice(0, 10)} · Paris ${parisJour(nuit)}`);
        const usd = ligne(s, '120000000042').prix, sans = ligne(s, '120000000043').prix;
        dit(/^95,00 USD$/.test(usd.trim()) && /^60,00$/.test(sans.trim()),
          `${T} le prix avec SA devise : « 95,00 USD » (jamais « 95,00 € USD »), devise inconnue ⇒ aucun symbole`, JSON.stringify([usd, sans, (ligne(s, '120000000042').texte || '').replace(/\n/g, ' / '), (ligne(s, '120000000043').texte || '').replace(/\n/g, ' / ')]));
        await ctx.close();
      });
      // ── O. LE N° LU AVEC LA DATE DE PUBLICATION ─────────────────────────────
      if (lance('O')) await essaie(T + ' O date de publication', async () => {
        // O1 : la remise à zéro (013) est passée ; l'annonce VRM-21 a été publiée
        // AVANT la coupure : « 21 » parle de l'ANCIENNE paire (B21), jamais de la
        // nouvelle N°21 (une autre paire, encore en ligne sur Vinted).
        remettre({ inactives: lue([ina('120000000061', 'Nike Dunk Low panda T42', 'VRM-21', '90.0', jour(15))]), main: (m) => {
          m.vrm_numerotation = MARQUEUR_013;
          m.vinted_annonce_numeros['7008'] = fiche('B21', 'Nike Dunk Low panda taille 42 (ancienne)', 7008);
        } });
        let { ctx, pg } = await ouvrir(b, vp);
        await versAnnonces(pg);
        await pg.waitForTimeout(800);
        let s = await lire(pg);
        const o1 = ligne(s, '120000000061');
        dit(o1.num === 'B21' && o1.vinted !== 'en-ligne',
          `${T} remise à zéro 013 : VRM-21 publiée AVANT la coupure ⇒ N°B21 (l'ancienne), jamais la nouvelle N°21`, JSON.stringify({ num: o1.num, vinted: o1.vinted }));
        await ctx.close();
        // O2 : la N°24 a été numérotée le 20 septembre, APRÈS la publication de
        // l'annonce VRM-24 (1er septembre) : ce n'est pas sa paire.
        remettre({ inactives: lue([ina('120000000062', 'New Balance 550 blanc T43', 'VRM-24', '90.0', jour(15))]), main: (m) => {
          m.vinted_annonce_numeros['7004'].numberedAt = '2026-09-20T10:00:00.000Z';
        } });
        ({ ctx, pg } = await ouvrir(b, vp));
        await versAnnonces(pg);
        await pg.waitForTimeout(800);
        s = await lire(pg);
        const o2 = ligne(s, '120000000062');
        dit(s.lignes.length === 1 && o2.num === '',
          `${T} N°24 numérotée APRÈS la publication de l'annonce VRM-24 ⇒ « pas reliée » (ce n'est pas sa paire)`, JSON.stringify({ num: o2.num }));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e && e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) en échec, ${ok} vert(s)` : `\nTous les contrôles passent (${ok}) — Inactives : trois états et « pas su », une capture ancienne dite comme telle, le N° par le SKU seul (avec sa date), la vue suit le compte, rien n'est remis en vente par VRM.`);
  process.exit(ko ? 1 : 0);
})();
