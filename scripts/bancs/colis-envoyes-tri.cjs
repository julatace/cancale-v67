// Banc : COLIS → « ENVOYÉS » — LE PLUS RÉCENT EN HAUT, LE BON TRANSPORTEUR (9 nov.).
// Julien (8 nov., capture « Envoyés · 20 ») : « Ici il n'y a pas que 1 Chronopost […]. Je veux que ce
// soit amélioré et que tu mettes le plus récent en haut, comme pour tous les onglets. »
// Données INVENTÉES (dépôt public), formes réelles : 6 ventes Vinted parties (`harvest_111_orders_sold`,
// `transaction_user_status: waiting`, statut « en route »), TOUTES au MÊME titre (rien ne se relie par
// titre) ; leurs bordereaux e-mail `email_bord_{tx}` lus par `meta->>` (scalaires : suivi, transaction,
// transporteur) ; 2 ventes « à expédier » (`needs_action`) avec date limite lue.
//   T1 · n° Chronopost propre (XW…TS)           ⇒ Chronopost (forme, comme avant)
//   T2 · e-mail du bordereau nommant Mondial Relay ⇒ Mondial Relay (avant : « Autres »)
//   T3 · n° S10 « …FR » + e-mail Chronopost du MÊME n° (`email_track_chronopost_…`) ⇒ Chronopost
//   T4 · aucun bordereau                         ⇒ « Transporteur inconnu »
//   T5 · bordereau sans n° ni transporteur       ⇒ « Transporteur inconnu »
//   T6 · n° S10 « …FR » seul                      ⇒ « Transporteur inconnu » (jamais deviné)
// Horloge figée (9 nov. 11 h). 390 tactile et 1512, clair ET sombre. Jugé sur data-* (§6.4).
//  O. ordre : le plus récent en haut (date de vente : T2 1 j, T5 2 j, T1 3 j, T6 5 j, T3 8 j, T4 12 j) ;
//  T. transporteur de chaque carte (`data-envoye-transp`), aucun groupe « Autres » ;
//  F. pastilles « Tous · 6 · Chronopost 2 · Mondial Relay 1 · Transporteur inconnu 3 », un clic filtre ;
//  S. « Suivre » chez le transporteur pour T1 ;
//  A. « À envoyer » : la vente la plus récente d'abord (lot AJ, 9 nov. soir ; avant : par urgence) ;
//  R. la règle pure (src/colisEnvoyes.js, api/_lib/transporteur-bordereau.js) ;
//  Z. aucune erreur, rien ne déborde.
// Lancer : construire dist/, puis node scripts/bancs/colis-envoyes-tri.cjs   (BANC_PORT 9071, SHOTS=dossier)
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const RACINE = process.env.BANC_RACINE || path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9071);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 9, 11, 0, 0);
const MS = maintenant.getTime(), J = 864e5, H = 36e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const TITRE = 'Salomon XT-6 Black 42';
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
// Les ventes parties : [tx, jours depuis la vente, bordereau (null = aucun)].
const PARTIS = [
  [7101, 3, { suivi: 'XW200000001TS', transporteur: '' }],
  [7102, 1, { suivi: '', transporteur: 'mondialrelay' }],
  [7103, 8, { suivi: 'XA200000003FR', transporteur: '' }],
  [7104, 12, null],
  [7105, 2, { suivi: '', transporteur: '' }],
  [7106, 5, { suivi: 'XA200000006FR', transporteur: '' }],
  // (9 nov., transporteurs inconnus) L'ÉTIQUETTE : 7107 — l'e-mail ne nomme personne, le PDF de SON
  // bordereau nomme Mondial Relay (rangé à la réception, `transporteurPdf`) ; 7108 — aucun bordereau
  // e-mail, l'étiquette captée par l'extension relue au cron (`vrm_bord_transporteurs.pdf`) nomme Chronopost.
  // Les 8 ventes portent le MÊME titre : rien ne passe d'une vente à l'autre.
  [7107, 4, { suivi: '', transporteur: '', transporteurPdf: 'mondialrelay', pdfLu: 'ok' }],
  [7108, 6, null],
];
const ATTENDU_ORDRE = ['v:7102', 'v:7105', 'v:7101', 'v:7107', 'v:7106', 'v:7108', 'v:7103', 'v:7104'];
const ATTENDU_TR = { 'v:7101': 'chronopost', 'v:7102': 'mondialrelay', 'v:7103': 'chronopost', 'v:7104': 'inconnu', 'v:7105': 'inconnu', 'v:7106': 'inconnu', 'v:7107': 'mondialrelay', 'v:7108': 'chronopost' };
const N_ENV = ATTENDU_ORDRE.length;
// À envoyer : 7201 (limite dans 4 j, vendue il y a 1 j), 7202 (limite demain, vendue il y a 5 j).
const AENV = [[7201, 1, 4], [7202, 5, 1]];
const fmtLimite = (j) => { const d = new Date(MS + j * J); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} 23:59`; };
const lignes = () => [
  { id: 'main', data: {} },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [
    ...PARTIS.map(([tx, j]) => ({ transaction_id: tx, title: TITRE, price: { amount: '80.0', currency_code: 'EUR' }, status: 'Le colis est en route', transaction_user_status: 'waiting', date: ilYa(j) })),
    ...AENV.map(([tx, j]) => ({ transaction_id: tx, title: TITRE, price: { amount: '80.0', currency_code: 'EUR' }, status: 'Bordereau d’envoi envoyé au vendeur', transaction_user_status: 'needs_action', date: ilYa(j) })),
  ] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [] } } },
  ...PARTIS.filter((p) => p[2]).map(([tx, j, b]) => ({ id: 'email_bord_' + tx, data: { type: 'bordereau', transaction: String(tx), uid: '111', account: 'compte_a', filename: `Bordereau-Vinted-${tx}.pdf`, modele: TITRE, article: TITRE, receivedAt: ilYa(j - 0.1), pdfB64: PDF_B64, suivi: b.suivi, transporteur: b.transporteur, dateLimite: '', ...(b.transporteurPdf ? { transporteurPdf: b.transporteurPdf, pdfLu: b.pdfLu } : {}) } })),
  { id: 'vrm_bord_transporteurs', data: { v: 1, parTx: {}, vus: {}, pdf: { 7108: { t: 'chronopost' } }, pdfVus: {} } },
  // (9 nov.) Une information reçue par SMS de VestiaireCo (sans identité) : DITE dans « À envoyer », jamais un colis.
  { id: 'vrm_sms_infos', data: { v: 1, infos: { 'vc|prada|2026-11-12': { source: 'vestiaire', marque: 'Prada', jour: '2026-11-12', limite: '2026-11-12T23:59:59+01:00', premiere: ilYa(1), derniere: ilYa(1), n: 1, formes: ['vendu'] } } } },
  ...AENV.map(([tx, j, lim]) => ({ id: 'email_bord_' + tx, data: { type: 'bordereau', transaction: String(tx), uid: '111', account: 'compte_a', filename: `Bordereau-Vinted-${tx}.pdf`, modele: TITRE, article: TITRE, receivedAt: ilYa(j - 0.1), pdfB64: PDF_B64, suivi: '', transporteur: '', dateLimite: fmtLimite(lim) } })),
  // L'e-mail de Chronopost pour le MÊME n° que le bordereau de 7103 (forme `email_track_*`, scalaires).
  { id: 'email_track_chronopost_XA200000003FR', data: { type: 'suivi', carrier: 'chronopost', suivi: 'XA200000003FR', status: 'transit', label: 'En cours d’acheminement', subject: 'Votre colis XA200000003FR est en cours d’acheminement', receivedAt: ilYa(7), sens: 'sortant' } },
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = iso(MS); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
async function ouvrir(b, vp, { panne = false, tab = 'cat_bord' } = {}) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const LIGNES = lignes();
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ m }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
      localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros));
    } catch (_) {}
  }, { m: LIGNES[0].data });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const h = { 'access-control-allow-origin': '*' };
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (panne && /id=like\.depart_/.test(u)) return route.fulfill({ status: 503, contentType: 'text/html', headers: h, body: '<html>503</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(MS), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tel };
}
async function ouvrir(b, vp, { sombre = false, tab = 'cat_bord' } = {}) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const LIGNES = lignes();
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ sombre }) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); } catch (_) {}
  }, { sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const h = { 'access-control-allow-origin': '*' };
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(MS), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tel };
}
const onglet = async (pg, v) => {
  await pg.click(`[data-colis-onglet-choix="${v}"]`).catch(() => {});
  await pg.waitForFunction((x) => { const e = document.querySelector('[data-colis-onglet]'); return e && e.getAttribute('data-colis-onglet') === x; }, v, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(700);
};
const shot = async (pg, nom) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: true }); };
const lireEnvoyes = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-colis-envoye]')].map((x) => ({ id: x.getAttribute('data-colis-envoye'), tr: x.getAttribute('data-envoye-transp'), t: x.innerText.replace(/\s+/g, ' ') })));
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};

async function regle() {
  console.log('── la règle pure');
  let ce, tb;
  try { ce = await import(path.join(RACINE, 'src', 'colisEnvoyes.js')); } catch (e) { dit(false, 'R. src/colisEnvoyes.js existe et se charge', String(e.message).slice(0, 100)); }
  try { tb = await import(path.join(RACINE, 'api', '_lib', 'transporteur-bordereau.js')); } catch (e) { dit(false, 'R. api/_lib/transporteur-bordereau.js existe et se charge', String(e.message).slice(0, 100)); }
  if (tb) {
    const f = tb.transporteurDeTexteBordereau;
    dit(f('Bordereau d’envoi pour Salomon\nDépose ton colis dans un point Mondial Relay avant le 12/11/2026') === 'mondialrelay', 'R. e-mail qui nomme Mondial Relay ⇒ Mondial Relay');
    dit(f('Dépose ton colis dans un relais Chronopost (Shop2Shop)') === 'chronopost', 'R. Chronopost + son réseau Shop2Shop ⇒ Chronopost');
    dit(f('Dépose-le chez Mondial Relay ou Chronopost') === '', 'R. deux transporteurs nommés ⇒ rien (jamais choisi)');
    dit(f('L’équipe Vinted · ton bordereau Vinted est prêt') === '', 'R. « Vinted » seul n’est pas un transporteur');
    dit(f('Dépose ton colis dans un casier Vinted Go') === 'vinted', 'R. « Vinted Go » est un transporteur');
    dit(f('Rends-toi au point relais le plus proche') === '', 'R. « point relais » ne nomme personne');
  }
  if (ce) {
    const t1 = ce.transporteurDeVente({ bord: { suivi: '12345678901234', transporteur: '' }, departs: new Map([['12345678901234', { suivi: '12345678901234', carrier: 'vinted', priseAt: iso(MS - H) }]]) });
    dit(t1.cle === 'vinted' && t1.source === 'transporteur', 'R. départ LU chez le transporteur pour le n° du bordereau ⇒ lui', JSON.stringify(t1));
    const t2 = ce.transporteurDeVente({ bord: { suivi: '12345678901234', transporteur: '' }, departs: new Map([['12345678901234', { suivi: '12345678901234', carrier: 'vinted', priseAt: null, essai: iso(MS - H) }]]) });
    dit(!t2.cle, 'R. un essai sans réponse (pas de prise en charge) ne nomme personne', JSON.stringify(t2));
    const t3 = ce.transporteurDeVente({ bord: null, departs: new Map() });
    dit(!t3.cle && ce.nomEnvoye(t3) === 'Transporteur inconnu', 'R. aucun bordereau ⇒ « Transporteur inconnu »', JSON.stringify(t3));
    const r = ce.rangerEnvoyes([{ id: 'a', quand: { ms: 1 } }, { id: 'b', quand: { ms: null } }, { id: 'c', quand: { ms: 3 } }, { id: 'd', quand: { ms: 3 } }]).map((x) => x.id).join('');
    dit(r === 'cdab', 'R. le plus récent en haut, égalité = ordre reçu, sans date en bas', r);
    const q = ce.quandEnvoye({ depart: { at: 5 }, coche: 9, vente: 1 });
    dit(q.ms === 5 && q.source === 'depart', 'R. la prise en charge lue gagne sur « Colis fait » et la vente', JSON.stringify(q));
    const ff = ce.filtrerEnvoyes([{ tr: { nom: 'DPD' } }], 'Chronopost');
    dit(ff.filtre === 'tous' && ff.liste.length === 1, 'R. une pastille qui ne correspond plus à rien revient à « Tous » (aucun colis caché)');
  }
}

(async () => {
  let b;
  await regle().catch((e) => dit(false, 'R. la règle a tourné', String(e && e.message).slice(0, 120)));
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const sombre of [false, true]) {
      const k = vp.width + (sombre ? '-sombre' : '-clair');
      console.log(`── ${k}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, { sombre });
      await essaie('Colis', async () => {
        await pg.waitForSelector('[data-colis-onglet-choix]', { timeout: 30000 });
        await onglet(pg, 'envoyer');
        await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card]').length >= 2, null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const A = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card]')].map((x) => x.getAttribute('data-colis-ident')));
        // (9 nov., soir, lot AJ — décision de Julien) « À envoyer » : la vente la plus RÉCENTE en haut (7201 vendue
        // il y a 1 j, puis 7202 il y a 5 j), plus la limite la plus proche — banc mis à jour, règle : src/ordreRecent.js.
        dit(A.join() === 'v:7201,v:7202', 'A. « À envoyer » : la vente la plus récente d’abord (7201, puis 7202 malgré sa limite demain)', A.join());
        const IS = await pg.evaluate(() => { const e = document.querySelector('[data-infos-sms="vestiaire"]'); return e ? { n: e.getAttribute('data-infos-sms-n'), t: e.innerText } : null; });
        dit(IS && IS.n === '1' && /Prada/.test(IS.t) && /12 nov/.test(IS.t) && !/peut-être «/.test(IS.t), 'I. « À envoyer » dit l’information SMS Vestiaire (marque, date limite), sans la relier à rien', JSON.stringify(IS));
        dit(A.length === 2, 'I. l’information SMS n’est pas comptée comme un colis');
        await shot(pg, `envoyer-${k}`);
        await onglet(pg, 'envoyes');
        await pg.waitForFunction(() => document.querySelectorAll('[data-colis-envoye]').length >= 8, null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const E = await lireEnvoyes(pg);
        dit(E.map((x) => x.id).join() === ATTENDU_ORDRE.join(), 'O. le plus récent en haut', E.map((x) => x.id).join());
        const mauvais = E.filter((x) => ATTENDU_TR[x.id] !== x.tr);
        dit(E.length === N_ENV && !mauvais.length, 'T. chaque carte a SON transporteur (bordereau, e-mail du même n°, forme) ou « inconnu »', JSON.stringify(E.map((x) => [x.id, x.tr])));
        const g = await pg.evaluate(() => ({ autres: [...document.querySelectorAll('[data-groupe-transp]')].map((x) => x.getAttribute('data-groupe-transp')), txt: (document.querySelector('.vrm-colis-envoyes') || document.body).innerText }));
        dit(!g.autres.includes('Autres') && !/\bAutres\b/.test(g.txt), 'T. aucun groupe fourre-tout « Autres »', g.autres.join(','));
        dit(E.filter((x) => /Transporteur inconnu/.test(x.t)).length === 3, 'T. les 3 sans source disent « Transporteur inconnu »', E.map((x) => x.t.slice(0, 60)).join(' | '));
        const P = await pg.evaluate(() => [...document.querySelectorAll('[data-envoyes-filtre-choix]')].map((x) => x.getAttribute('data-envoyes-filtre-choix') + ':' + x.getAttribute('data-envoyes-filtre-n')));
        dit(P.join('|') === 'tous:8|Chronopost:3|Mondial Relay:2|Transporteur inconnu:3', 'F. pastilles « Tous 8 · Chronopost 3 · Mondial Relay 2 · Transporteur inconnu 3 »', P.join('|'));
        // (9 nov.) L'étiquette nomme : 7107 (bordereau e-mail) et 7108 (étiquette relue) — source `pdf` ;
        // les 3 inconnus restent inconnus (même titre que 7107/7108 : jamais par titre).
        const src = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-colis-envoye]')].map((x) => [x.getAttribute('data-colis-envoye'), x.getAttribute('data-envoye-transp-source')])));
        dit(src['v:7107'] === 'pdf' && src['v:7108'] === 'pdf', 'P. l’étiquette (PDF du bordereau, puis celle relue au cron) nomme le transporteur — source « pdf »', JSON.stringify(src));
        dit(['v:7104', 'v:7105', 'v:7106'].every((k) => !src[k] || src[k] === 'aucune' || src[k] === 'null' || src[k] === ''), 'P. 8 ventes au même titre : aucune autre ne prend le transporteur d’une étiquette', JSON.stringify(src));
        const S = await pg.evaluate(() => { const e = document.querySelector('[data-colis-envoye-suivre="v:7101"]'); return e ? (e.getAttribute('href') || '') + ' ' + e.innerText : ''; });
        dit(/chronopost/i.test(S) && /Suivre/.test(S), 'S. 7101 : « Suivre » chez Chronopost', S.slice(0, 120));
        await shot(pg, `envoyes-${k}`);
        await sain(pg, 'Colis → Envoyés');
        await pg.click('[data-envoyes-filtre-choix="Mondial Relay"]').catch(() => {});
        await pg.waitForTimeout(500);
        const F1 = await lireEnvoyes(pg);
        dit(F1.map((x) => x.id).join() === 'v:7102,v:7107', 'F. la pastille Mondial Relay ne montre que 7102 et 7107', F1.map((x) => x.id).join());
        await shot(pg, `envoyes-filtre-${k}`);
        await pg.click('[data-envoyes-filtre-choix="tous"]').catch(() => {});
        await pg.waitForTimeout(500);
        dit((await lireEnvoyes(pg)).length === N_ENV, 'F. « Tous » remontre les 8');
      });
      dit(errs.length === 0, 'Z. aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ colis envoyés (tri) : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ colis envoyés (tri) : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
srv.listen(PORT);
