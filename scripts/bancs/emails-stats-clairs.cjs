// ═══════════════════════════════════════════════════════════════════════════
// BANC : E-MAILS ET STATISTIQUES, CLAIRS POUR UN NON-TECHNICIEN (2 nov.)
//        node scripts/bancs/emails-stats-clairs.cjs   (après la construction)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (2 nov., 20 h 41) : « il y a beaucoup d'incompréhension de ma part
// quand je vais dans les emails ou dans les statistiques […] ça doit être
// beaucoup plus intuitif ». Données INVENTÉES (dépôt public), dans la vraie
// forme des routes. 390 px tactile clair et 1512 px sombre.
// `BANC_CAPTURE=<dossier>` : captures pleine page.
// `BANC_EXPLORE=1` : captures et texte seulement, sans jugement.
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4561;
const CAPT = process.env.BANC_CAPTURE || '';
const EXPLORE = process.env.BANC_EXPLORE === '1';
const UID = process.env.BANC_SESSION_UID || '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';

// L'heure de la page : jeudi 29 octobre 2026, 15 h.
const MAINTENANT = new Date(2026, 9, 29, 15, 0, 0);
const D = (y, m, j, h = 12) => new Date(y, m - 1, j, h, 0, 0);
const iso = (d) => d.toISOString();
const avant = (min) => iso(new Date(MAINTENANT.getTime() - min * 60000));

// ── STATISTIQUES : la même boutique inventée que stats-vitrine ──────────────
const accounts = [
  { id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT), created_at: iso(D(2025, 1, 1)), owner: null },
  { id: 2, vinted_user_id: '222', login: 'paris_kicks', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT), created_at: iso(D(2025, 1, 1)), owner: null },
];
const FIN = 'Commande finalisée';
const VENTES = [
  ['111', '93001', 60, FIN, D(2026, 10, 27, 10), 'Nike Air Max 90 taille 42', D(2026, 10, 24, 10)],
  ['222', '93002', 50, FIN, D(2026, 10, 26, 11), 'Nike Air Max 90 taille 43', D(2026, 10, 16, 11)],
  ['111', '93003', 70, FIN, D(2026, 10, 21, 14), 'Adidas Samba taille 42', D(2026, 10, 20, 14)],
  ['222', '93004', 40, FIN, D(2026, 10, 5, 10), 'Adidas Samba taille 41', null],
  ['111', '93005', 30, 'Le paiement a été validé', D(2026, 10, 29, 9), 'Nike Dunk taille 40', null],
  ['222', '93006', 25, 'Commande annulée', D(2026, 10, 12, 9), 'Nike Dunk taille 39', null],
  ['111', '93007', 80, FIN, D(2026, 9, 15, 12), 'Adidas Samba taille 42', D(2026, 9, 1, 12)],
  ['111', '93008', 45, FIN, D(2026, 9, 30, 18), 'Puma Suede taille 41', D(2026, 9, 28, 18)],
  ['222', '93009', 100, FIN, D(2026, 3, 10, 12), 'Nike Cortez taille 44', D(2026, 3, 1, 12)],
  ['111', '93010', 55, FIN, D(2025, 11, 20, 12), 'Nike Cortez taille 44', null],
  ['111', '93011', 35, FIN, D(2025, 2, 2, 12), 'Puma Suede taille 40', null],
];
const sec = (d) => Math.floor(d.getTime() / 1000);
const ilya = (j) => new Date(MAINTENANT.getTime() - j * 86400000);
const EN_LIGNE = { '111': [{ id: 700001, title: 'Nike Cortez taille 41', price: { amount: '80', currency_code: 'EUR' }, created_at_ts: sec(ilya(95)) },
  { id: 700002, title: 'Puma Suede taille 42', price: { amount: '50', currency_code: 'EUR' }, created_at_ts: sec(ilya(40)) },
  { id: 700003, title: 'Asics Gel taille 43', price: { amount: '60', currency_code: 'EUR' }, created_at_ts: sec(ilya(5)) }],
'222': [{ id: 700004, title: 'Vans Old Skool taille 40', price: { amount: '40', currency_code: 'EUR' }, created_at_ts: sec(ilya(2)) }] };
const vendues = (uid) => VENTES.filter((v) => v[0] === uid && v[6]).map((v) => ({ id: Number(v[1]) + 500000, title: v[5], price: { amount: String(v[2]), currency_code: 'EUR' }, created_at_ts: sec(v[6]), is_closed: true, promoted: false }));
const vente = (v) => ({ transaction_id: Number(v[1]), id: Number(v[1]), title: v[5], price: { amount: String(v[2]), currency_code: 'EUR' }, status: v[3], date: iso(v[4]) });
const rows = [];
for (const a of accounts) {
  const uid = a.vinted_user_id;
  rows.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: iso(MAINTENANT), payload: { my_orders: VENTES.filter((v) => v[0] === uid).map(vente) } } });
  rows.push({ id: `harvest_${uid}_listings`, data: { capturedAt: iso(new Date(MAINTENANT.getTime() - 60000)), payload: { items: [...EN_LIGNE[uid].map((x) => ({ ...x, promoted: false })), ...vendues(uid)] } } });
}
for (const v of VENTES) if (v[3] === FIN) rows.push({ id: `harvest_${v[0]}_txn_${v[1]}`, data: { capturedAt: iso(MAINTENANT), payload: { transaction: { id: Number(v[1]), item_id: Number(v[1]) + 500000, status: 450, status_title: FIN, status_updated_at: iso(v[4]), buyer: { country_code: 'FR' } } } } });
rows.push({ id: 'vinted_listing_dates', data: {} });
rows.push({ id: 'lbc_ventes', data: { ventes: {} } });
rows.push({ id: 'ebay_orders', data: { orders: [] } });
// Les adresses de réception déclarées (registre).
rows.push({ id: 'vrm_email_owners', data: { adresses: { 'atelier.sneak@exemple.test': { owner: UID, label: '' }, 'paris.kicks@exemple.test': { owner: UID, label: '' } } } });

// ── E-MAILS : la réponse des routes, inventée ───────────────────────────────
const ADR = [
  { adresse: 'atelier.sneak@exemple.test', declaree: true, comptes: [{ id: '1', nom: 'atelier_sneak' }], derniereReception: avant(4) },
  { adresse: 'paris.kicks@exemple.test', declaree: true, comptes: [{ id: '2', nom: 'paris_kicks' }], derniereReception: avant(190) },
];
const eid = (i) => 'email_reception_' + String(i).padStart(4, '0') + 'c'.repeat(60);
const JOURNAL = [
  { id: eid(1), at: avant(4), etat: 'integre', type: 'bordereau', subject: "Bordereau d'envoi pour Nike Air Max 90", from: "L'équipe Vinted <no-reply@vinted.fr>", resume: { v: 1, t: 'bordereau', tx: '12345678901', n: '42', pdf: 1, tp: 1, a: 'Nike Air Max 90' } },
  { id: eid(2), at: avant(30), etat: 'integre', type: 'suivi', subject: 'Votre colis est disponible', from: 'Mondial Relay <noreply@mondialrelay.fr>', resume: { v: 1, t: 'suivi', tr: 'mondialrelay', s: '12345678', st: 'available', code: '418205', lieu: 'Relais Tabac du Port', lim: '07/11/2026' } },
  { id: eid(3), at: avant(70), etat: 'a-verifier', type: 'bordereau', subject: "Bordereau d'envoi pour Adidas Samba OG", from: 'no-reply@vinted.fr', resume: { v: 1, t: 'bordereau', tx: '22223333444', n: '117', nt: 1, pdf: 1, a: 'Adidas Samba OG', av: 'num-titre' } },
  { id: eid(4), at: avant(120), etat: 'integre', type: 'achat', subject: 'Ton reçu pour la commande « Nike Air Force 1 »', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'achat', tx: '98765432101', a: 'Nike Air Force 1', px: '45,00', id: 'email_achat_banc01', pdf: 0 } },
  { id: eid(5), at: avant(190), etat: 'integre', type: 'offre', subject: 'Nouvelle offre', from: 'no-reply@vinted.fr', resume: { v: 1, t: 'offre', mt: '35', de: 'marie_b', a: 'Nike Dunk Low' } },
  { id: eid(6), at: avant(400), etat: 'erreur', type: 'vente', subject: 'Ton article est vendu !', from: 'no-reply@vinted.fr', resume: { v: 1, t: 'panne', av: 'panne' } },
  { id: eid(7), at: avant(900), etat: 'integre', type: 'connu-sans-action', subject: 'Les nouveautés Vinted', from: 'Vinted <news@team.vinted.fr>', resume: { v: 1, t: 'connu-sans-action', f: 'newsletter Vinted' } },
];
JOURNAL.forEach((e, i) => { e.adresses = [i % 2 ? 'paris.kicks@exemple.test' : 'atelier.sneak@exemple.test']; e.compte = i % 2 ? { id: '2', nom: 'paris_kicks' } : { id: '1', nom: 'atelier_sneak' }; e.compteAmbigu = false; e.sourceDate = null; });
const COMPTEURS = { sur: JOURNAL.length, plus: false, integre: JOURNAL.filter((e) => e.etat === 'integre').length, aVerifier: JOURNAL.filter((e) => e.etat === 'a-verifier').length, erreur: JOURNAL.filter((e) => e.etat === 'erreur').length, incompris: 0 };
const RECEPTION = { ok: true, limite: 100, plus: false, collecteur: { dernierSucces: avant(3), dernierPassage: avant(3), etat: 'succes' }, dernierEmail: avant(4),
  emails: JOURNAL.map((e) => ({ id: e.id, subject: e.subject, from: e.from, type: e.type, etat: e.etat, at: e.at, adresses: e.adresses, compte: e.compte, raison: e.etat === 'a-verifier' ? 'N° retrouvé par le titre' : '' })),
  adresses: ADR };
const PREUVES = { ok: true, cloisonnee: true, installation: false, adresses: { 'atelier.sneak@exemple.test': { etat: 'prouvee' }, 'paris.kicks@exemple.test': { etat: 'prouvee' } }, collecteur: { at: avant(3) } };
const MIS_DE_COTE = { ok: true, emails: [
  { id: 'email_quarantaine_banc0001', sujet: 'Ton article est vendu !', raison: 'adresse de réception pas encore confirmée', quand: avant(600) },
] };

// ── Le serveur et la page ───────────────────────────────────────────────────
function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) { const reste = src.replace(/^data(->>|->)/, ''); let v = row.data;
      for (const seg of reste.split(/->>|->/)) v = (v == null ? null : v[seg]); out[alias] = (v == null) ? null : (/->>[^>]*$/.test(src) && typeof v !== 'object' ? String(v) : v); continue; }
    out[alias] = row[src];
  }
  return out;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

let ko = 0, ok = 0; const dit = (c, m, d) => { if (EXPLORE) return; if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 220)); if (EXPLORE) console.log('!!', nom, e.message); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: false }, { nom: '1512', vp: { width: 1512, height: 950 }, sombre: true }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);

async function page(b, T, opts = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: T.sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(12000);
  await pg.clock.setFixedTime(MAINTENANT);
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); } catch (_) {} }, !!T.sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/select=owner/.test(u)) return j([{ owner: UID }]);
    const S = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: {} }, S)]);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, S)));
    const lk = /id=like\.([^&]*)/.exec(u); if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');
      return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, S))); }
    return j([]);
  });
  const appels = [];
  await pg.route('**/api/**', (r) => {
    const u = new URL(r.request().url()); const mode = u.searchParams.get('mode');
    const J = (s, d) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });
    if (u.pathname === '/api/email-rattacher') {
      appels.push(mode || '(post)');
      if (opts.panne && mode === 'reception') return J(503, { ok: false });
      if (mode === 'reception') return J(200, opts.reception || RECEPTION);
      if (mode === 'preuves') return J(200, PREUVES);
      if (mode === 'liste') return J(200, opts.misDeCote || MIS_DE_COTE);
      if (mode === 'journal') {
        if (u.searchParams.get('texte')) return J(200, { ok: true, id: u.searchParams.get('texte'), texte: 'Ton bordereau est prêt.' });
        let l = JOURNAL.slice(); const et = u.searchParams.get('etat'); if (et) l = l.filter((e) => e.etat === et);
        if (u.searchParams.get('compte') === '1') return J(200, { ok: true, compteurs: COMPTEURS });
        return J(200, { ok: true, page: 0, parPage: 20, suite: false, emails: l, compteurs: COMPTEURS, adresses: ADR.map((a) => ({ adresse: a.adresse, nom: a.comptes[0].nom })) });
      }
      return J(200, { ok: true, emails: [] });
    }
    return J(200, { pret: true, devices: 1 });
  });
  return { ctx, pg, errs, appels };
}
const aller = async (pg, tab, ms = 1500) => { await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(ms); };
const publier = async (pg) => {
  await aller(pg, 'cat_ventes', 500);
  await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_stats_ventes') || 'null') && !!JSON.parse(localStorage.getItem('vrm_benefice_jours') || 'null'); } catch (_) { return false; } }, null, { timeout: 25000 }).catch(() => {});
  await aller(pg, 'vinted_annonces', 500);
  await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_stats_stock') || 'null'); } catch (_) { return false; } }, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(500);
};
const capture = async (pg, nom) => {
  if (!CAPT) return;
  fs.mkdirSync(CAPT, { recursive: true });
  const vp = pg.viewportSize();
  const h = await pg.evaluate(() => Math.max(document.documentElement.scrollHeight, ...[...document.querySelectorAll('main,[data-scroll],.vrm-contenu,body *')].slice(0, 4000).filter((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map((e) => e.scrollHeight)));
  await pg.setViewportSize({ width: vp.width, height: Math.min(9000, Math.max(vp.height, h + 120)) }); await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(CAPT, `${nom}.png`) });
  await pg.setViewportSize(vp);
};
const versEmails = async (pg) => {
  await aller(pg, 'settings', 2500);
  await pg.waitForFunction(() => { const e = document.querySelector('[data-espace-emails]'); return (e && e.offsetParent) || [...document.querySelectorAll('[data-sous-ouvrir="adresses"]')].some((x) => x.offsetParent); }, null, { timeout: 20000 }).catch(() => {});
  const sous = pg.locator('[data-sous-ouvrir="adresses"]').first();
  if (await sous.isVisible().catch(() => false)) { await sous.click(); await pg.waitForTimeout(800); }
  await pg.locator('[data-espace-emails]').first().waitFor({ timeout: 15000 });
  await pg.waitForTimeout(800);
};
const texte = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);


// ── Ce que l'écran dit, lu dans le DOM (data-* et nombres) ──────────────────
const lireApercu = (pg) => pg.evaluate(() => {
  const q = (x) => document.querySelector(x);
  const ap = q('[data-emails-apercu]');
  const pos = (x) => { const e = q(x); return e ? e.getBoundingClientRect().top + (document.scrollingElement || document.documentElement).scrollTop : null; };
  const avant = (a, b) => { const x = q(a), y = q(b); return !!(x && y && (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING)); };
  const nav = q('[aria-label^="Rubriques des e"]');
  const lignes = (sel, cle) => Object.fromEntries([...document.querySelectorAll(sel)].map((e) => [e.getAttribute(cle), Number(e.getAttribute('data-n'))]));
  const visibles = ap ? [...ap.querySelectorAll('button')].filter((b) => b.offsetParent) : [];
  const geste = q('[data-apercu-geste] .vrm-apercu-geste');
  return {
    onglet: (q('[data-espace-emails]') || {}).getAttribute ? q('[data-espace-emails]').getAttribute('data-onglet') : null,
    reponse: ap ? ap.getAttribute('data-reponse') : null,
    ordre: avant('[data-apercu-reponse]', '[data-apercu-gestes]') && avant('[data-apercu-gestes]', '[data-apercu-fait]'),
    gestes: lignes('[data-apercu-geste]', 'data-apercu-geste'),
    nGestes: q('[data-apercu-gestes]') ? q('[data-apercu-gestes]').getAttribute('data-apercu-gestes') : null,
    fait: lignes('[data-apercu-famille]', 'data-apercu-famille'),
    sur: q('[data-apercu-fait]') ? Number(q('[data-apercu-fait]').getAttribute('data-apercu-fait')) : null,
    navTexte: nav ? nav.innerText : '', nOnglets: nav ? nav.querySelectorAll('button').length : 0,
    ongletsH: nav ? Math.min(...[...nav.querySelectorAll('button')].map((b) => b.getBoundingClientRect().height)) : 0,
    cibles: visibles.length ? Math.min(...visibles.map((b) => b.getBoundingClientRect().height)) : 0,
    texte: ap ? ap.innerText : '',
    gesteCouleur: geste ? getComputedStyle(geste).color : '', texteCouleur: ap ? getComputedStyle(ap).color : '',
    listeOuverte: q('[data-reception-liste]') ? q('[data-reception-liste]').open : null,
    deborde: document.documentElement.scrollWidth > innerWidth + 1,
  };
});
const lireStats = (pg) => pg.evaluate(() => {
  const q = (x) => document.querySelector(x);
  const sc = document.scrollingElement || document.documentElement;
  const top = (x) => { const e = q(x); return e ? e.getBoundingClientRect().top + sc.scrollTop : null; };
  const tuiles = [...document.querySelectorAll('[data-sv-tuile]')].map((e) => ({ k: e.getAttribute('data-sv-tuile'), sous: (e.querySelector('.vrm-sv-tuile-sous') || {}).innerText || '', eur: e.getAttribute('data-sv-eur') }));
  const meilleur = q('[data-sv-meilleur]');
  const lignesCompte = [...document.querySelectorAll('[data-sv-compte]')].map((e) => ({ k: e.getAttribute('data-sv-compte'), n: Number(e.getAttribute('data-n')) }));
  const replis = [...document.querySelectorAll('[data-stats-repli]')].map((e) => ({ id: e.getAttribute('data-stats-repli'), ouvert: e.open }));
  const vit = q('.vrm-stats-vitrine');
  const page = q('.vrm-statistiques-premium');
  return { tuiles, meilleur: meilleur ? meilleur.getAttribute('data-sv-meilleur') : null, lignesCompte, replis,
    hero: !!q('[data-stats-carte="hero"]'), vitTexte: vit ? vit.innerText : '', pageTexte: page ? page.innerText : '',
    topComptes: top('[data-sv-carte="comptes"]'), topBarres: top('[data-sv-carte="barres"]'),
    deborde: document.documentElement.scrollWidth > innerWidth + 1 };
});

module.exports = { MAINTENANT };
if (require.main === module && !EXPLORE) (async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const T of TAILLES) {
      const suf = `${T.nom}${T.sombre ? '-sombre' : ''}`;
      console.log(`── E-mails ${suf}`);
      await essaie('emails ' + suf, async () => {
        const { ctx, pg, errs, appels } = await page(b, T);
        await versEmails(pg);
        await pg.locator('[data-apercu-reponse="oui"]').waitFor();
        await pg.waitForTimeout(600);
        const r = await lireApercu(pg);
        await capture(pg, `emails-apercu-${suf}`);
        dit(r.onglet === 'reception' && r.reponse === 'oui', `${suf} : l'écran ouvre sur l'Aperçu, qui répond « oui, tes e-mails arrivent »`, `${r.onglet} · ${r.reponse}`);
        dit(/il y a 4 min/.test(r.texte), `${suf} : la dernière arrivée est dite (il y a 4 min)`);
        dit(r.ordre, `${suf} : ordre — la réponse, puis ce qu'il reste à faire, puis ce que VRM en a fait`);
        dit(r.gestes.rattacher === 1 && r.gestes.verifier === 1 && Object.keys(r.gestes).length === 2, `${suf} : À faire — 1 e-mail mis de côté, 1 à vérifier, rien d'autre (adresses confirmées)`, JSON.stringify(r.gestes));
        const ranges = JOURNAL.filter((e) => e.etat === 'integre').length;
        const somme = Object.entries(r.fait).filter(([k]) => k !== 'attente').reduce((s2, [, n]) => s2 + n, 0);
        dit(r.sur === JOURNAL.length && somme === ranges && r.fait.attente === 1 && r.fait.bordereau === 1 && r.fait.colis === 1 && r.fait.achat === 1 && r.fait.messages === 1 && r.fait.autre === 1,
          `${suf} : Ce que VRM en a fait — ${ranges} rangés par famille (somme = ${ranges}) + 1 en attente, sur ${JOURNAL.length}`, JSON.stringify(r.fait));
        dit(!('verifier' in r.fait) && !('rattacher' in r.fait), `${suf} : un nombre n'est écrit qu'une fois (« à vérifier » seulement dans À faire)`);
        dit(r.nOnglets === 4 && !/\d/.test(r.navTexte) && r.ongletsH >= 44, `${suf} : 4 onglets nus — aucun nombre, 44 px au doigt`, `${r.nOnglets} · « ${r.navTexte.replace(/\n/g, ' | ')} » · ${r.ongletsH}px`);
        dit(r.cibles >= 44, `${suf} : chaque bouton de l'Aperçu fait au moins 44 px`, r.cibles + 'px');
        dit(r.gesteCouleur && r.gesteCouleur !== r.texteCouleur, `${suf} : le geste à faire est en ambre, pas dans la couleur du texte`, `${r.gesteCouleur} / ${r.texteCouleur}`);
        dit(!/Collecteur|Intégré|suivis\b|quarantaine|pipeline|n\/d/i.test(r.texte), `${suf} : aucun mot technique sur l'Aperçu (collecteur, intégré, suivis, quarantaine)`);
        dit(r.listeOuverte === false, `${suf} : la liste technique est repliée (« Chercher un e-mail précis »)`);
        // Toucher une famille ouvre les e-mails de cette famille.
        await pg.locator('[data-apercu-famille="bordereau"] button').click();
        await pg.locator('[data-journal-emails]').waitFor();
        await pg.waitForTimeout(500);
        const typeJournal = await pg.locator('[data-journal-type]').inputValue();
        const appelJ = appels.filter((x) => x === 'journal').length;
        dit(typeJournal === 'bordereau' && await pg.locator('[data-email-onglet="journal"]').getAttribute('aria-pressed') === 'true' && appelJ >= 1, `${suf} : « 1 bordereau ajouté à Colis » ouvre les e-mails, filtrés sur les bordereaux`, typeJournal);
        await capture(pg, `emails-journal-${suf}`);
        await pg.locator('[data-email-onglet="reception"]').click();
        await pg.locator('[data-apercu-geste="rattacher"] button').click();
        await pg.waitForTimeout(300);
        dit(await pg.locator('[data-email-onglet="a-traiter"]').getAttribute('aria-pressed') === 'true', `${suf} : « Le voir » ouvre les e-mails à rattacher`);
        await pg.locator('[data-email-onglet="adresses"]').click(); await pg.waitForTimeout(400);
        await capture(pg, `emails-adresses-${suf}`);
        dit(!(await lireApercu(pg)).deborde, `${suf} : aucun débordement horizontal`);
        dit(errs.length === 0, `${suf} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      await essaie('emails pas su ' + suf, async () => {
        const { ctx, pg } = await page(b, T, { panne: true });
        await versEmails(pg);
        await pg.locator('[data-apercu-reponse="passu"]').waitFor();
        const r = await lireApercu(pg);
        dit(r.reponse === 'passu' && !/Oui, tes e-mails/.test(r.texte) && !/Rien à faire/.test(r.texte) && r.nGestes == null && r.sur == null,
          `${suf} : réception illisible ⇒ « pas pu lire », ni « oui » ni « rien à faire » ni compte inventé`, r.texte.replace(/\n/g, ' | ').slice(0, 160));
        await ctx.close();
      });
      console.log(`── Statistiques ${suf}`);
      await essaie('stats ' + suf, async () => {
        const { ctx, pg, errs } = await page(b, T);
        await publier(pg);
        await aller(pg, 'dashboard', 2500);
        await pg.locator('[data-sv-tuile="vendu"][data-sv-etat="lu"]').waitFor({ timeout: 20000 });
        await pg.waitForTimeout(600);
        let r = await lireStats(pg);
        await capture(pg, `stats-${suf}`);
        dit(r.tuiles.map((t) => t.k).join(',') === 'vendu,benefice,delai,enligne' && r.tuiles.every((t) => t.sous.trim().length > 8), `${suf} : 4 chiffres en tête, chacun avec sa phrase`, r.tuiles.map((t) => t.k + ':' + t.sous).join(' / '));
        dit(/par rapport à septembre/.test(r.tuiles[0].sous), `${suf} : l'écart dit à quoi il se compare`, r.tuiles[0].sous);
        dit(!/médiane?|\bs\d\d\b|Délai médian/.test(r.vitTexte), `${suf} : ni « médiane » ni « s44 » en haut de l'écran`);
        const l = r.lignesCompte;
        dit(r.meilleur === l[0].k && l[0].n > l[1].n, `${suf} : « quel compte vend le mieux » nomme celui qui a le plus de ventes`, `${r.meilleur} · ${JSON.stringify(l)}`);
        if (T.nom === '390') dit(r.topComptes != null && r.topBarres != null && r.topComptes < r.topBarres, '390 : au téléphone, le compte qui vend le mieux passe avant le graphique', `${r.topComptes} < ${r.topBarres}`);
        dit(r.replis.length === 2 && r.replis.every((x) => !x.ouvert) && !r.hero, `${suf} : le détail est rangé en 2 volets fermés, rien n'y est calculé`, JSON.stringify(r.replis));
        const eur = r.tuiles[0].eur; const montant = (Number(eur) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
        const fois = r.pageTexte.split(montant.replace(/ /g, ' ')).length - 1 || r.pageTexte.split(montant).length - 1;
        dit(fois === 1, `${suf} : le montant vendu de la période (${montant}) est écrit une seule fois`, String(fois));
        await pg.locator('[data-stats-repli="argent"] > summary').click(); await pg.waitForTimeout(800);
        r = await lireStats(pg);
        dit(r.hero && r.replis.find((x) => x.id === 'argent').ouvert, `${suf} : ouvrir « L'argent depuis le début » montre le finalisé`);
        await aller(pg, 'dashboard', 2500);
        await pg.locator('[data-stats-repli]').first().waitFor({ timeout: 20000 }).catch(() => {});
        r = await lireStats(pg);
        dit(r.replis.find((x) => x.id === 'argent') && r.replis.find((x) => x.id === 'argent').ouvert && !r.replis.find((x) => x.id === 'vente').ouvert, `${suf} : le volet ouvert le reste sur cet appareil`);
        dit(!r.deborde, `${suf} : aucun débordement horizontal`);
        dit(errs.length === 0, `${suf} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} emails-stats-clairs : ${ok} verts, ${ko} rouge${ko > 1 ? 's' : ''}`); process.exit(ko ? 1 : 0);
})();
if (require.main === module && EXPLORE) (async () => {  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const T of TAILLES) {
      const suf = `${T.nom}${T.sombre ? '-sombre' : ''}`;
      await essaie('emails ' + suf, async () => {
        const { ctx, pg, errs } = await page(b, T);
        await versEmails(pg);
        if (EXPLORE) {
          await capture(pg, `emails-${suf}`);
          console.log('──── EMAILS ' + suf + '\n' + (await texte(pg, '[data-espace-emails]')));
          for (const ong of ['Journal', 'Comptes', 'À rattacher']) {
            const bt = pg.getByRole('navigation', { name: /^Rubriques des e-?mails$/ }).getByRole('button', { name: new RegExp(ong) });
            if (await bt.count()) { await bt.first().click(); await pg.waitForTimeout(1200); await capture(pg, `emails-${ong.replace(/\W+/g, '')}-${suf}`); console.log('──── ' + ong + '\n' + (await texte(pg, '[data-espace-emails]'))); }
          }
        }
        console.log('erreurs', errs);
        await ctx.close();
      });
      await essaie('stats ' + suf, async () => {
        const { ctx, pg, errs } = await page(b, T);
        await publier(pg);
        await aller(pg, 'dashboard', 2500);
        if (EXPLORE) { await capture(pg, `stats-${suf}`); console.log('──── STATS ' + suf + '\n' + (await texte(pg, '.vrm-statistiques-premium'))); }
        console.log('erreurs', errs);
        await ctx.close();
      });
    }
  } finally { await b.close(); srv.close(); }
  if (!EXPLORE) { console.log(`\n${ko ? '❌' : '✅'} emails-stats-clairs : ${ok} verts, ${ko} rouge${ko > 1 ? 's' : ''}`); process.exit(ko ? 1 : 0); }
})();
