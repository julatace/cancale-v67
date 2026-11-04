// (3 nov. : nouvelle mise en page — trois onglets, « Partis » = « Envoyés », « À retirer » en sections ; toutes les vérifications de règles et de compteurs gardées)
// ── BANC : COLIS CLAIR (2 nov. ; avant : quatre colonnes, 31 oct.) ───────────
// Julien, au téléphone : « Il y a des colis dans tous les sens avec des codes
// de retrait partout, on ne comprend rien dans l'application. Refais ça bien. »
// Mesuré avant (rendu à 390 px) : les colonnes, puis « Colis par colis » qui les
// redisait, puis « Codes, QR et points relais » qui redisait les retraits —
// chaque colis 2 ou 3 fois, les codes à plusieurs endroits, « Base Adresse
// Nationale » à l'écran.
// Maintenant : un sélecteur « À envoyer · N » / « À retirer · N » (N = Ma
// journée : `vrm_colis_aposter` / `vrm_colis_retirer`), l'onglet urgent par
// défaut ; « À envoyer » = la carte détaillée de chaque colis (Prêts à imprimer,
// En attente du bordereau, « Partis » replié) ; « À retirer » = par point
// relais, le code de chaque colis UNE fois, « À vérifier » à part en bas.
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles :
//   · 3 ventes à expédier AVEC leur bordereau (PDF reçu par e-mail) ⇒ prêts ;
//   · 1 vente à expédier SANS bordereau ⇒ en attente ;
//   · 1 vente à expédier cochée « postée » (`vinted_ship_done`) ⇒ partis ;
//   · 3 ventes que Vinted suit (en transit, au relais, livrée) ⇒ partis ;
//   · des achats et colis d'e-mail à retirer, aux formes réelles des sources :
//     Mondial Relay « TABA'VAP, 29 Rue Hoche, 56000 Vannes » (e-mail) et la
//     conversation « point relais TABAVAP, TABAVAP, 29 RUE HOCHE, 56000 VANNES »
//     ⇒ UN point, deux colis ; Vinted Go sans code postal + conversation ⇒ UN
//     point ; le même n° écrit par Vinted (code) ET Chronopost (lieu) ⇒ UN colis ;
//     un Chronopost sans lieu ⇒ « Point pas encore connu » ; un colis arrivé il y
//     a 30 jours ⇒ « à vérifier », visible, à part, hors du compte.
// Exige (règles gardées des colonnes) : chaque colis présent, dans SON groupe,
// compteurs = Ma journée, « à vérifier » visible, le lot d'impression ; et
// (2 nov.) chaque colis (`data-colis-ident`) EXACTEMENT une fois dans le DOM de
// l'écran, chaque code de retrait une fois, jamais « Base Adresse Nationale »,
// au téléphone aucune phrase sur la carte, aucun texte écrasé.
// Options : PLAN=1 imprime le texte rendu de chaque onglet ; TRANCHES=1
// SHOTS=dossier capture l'écran par tranches.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 4397);
const SHOTS = process.env.SHOTS || os.tmpdir();

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const dans = (j) => new Date(M + j * 86400000).toISOString().slice(0, 10);
const AEXP = 'Le paiement a été validé';
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const v = (tx, titre, statut, tus, j, item) => ({ transaction_id: tx, title: titre, price: { amount: '50', currency_code: 'EUR' }, status: statut, ...(tus ? { transaction_user_status: tus } : {}), date: ilYa(j), ...(item ? { item_id: item } : {}) });
const VENTES = [
  v(7001, 'Adidas Samba OG taille 41', AEXP, 'needs_action', 0.2, 'an1'),
  v(7002, 'Nike Air Max 90 taille 42', AEXP, 'needs_action', 0.4, 'an2'),
  v(7003, 'Nike Dunk Low taille 44', AEXP, 'needs_action', 0.6, 'an3'),
  v(7004, 'New Balance 550 taille 43', AEXP, 'needs_action', 0.8, 'an4'),
  v(7005, 'Asics Gel-1130 taille 40', AEXP, 'needs_action', 2, 'an5'),
  v(7101, 'Converse Run Star taille 40', "Commande expédiée et en cours d'acheminement", 'waiting', 3, 'an6'),
  v(7102, 'Adidas Gazelle taille 42', RELAIS_ST, 'waiting', 4, 'an7'),
  v(7103, 'Asics GT-2160 taille 43', 'Le colis a été livré', 'waiting', 6, 'an8'),
];
const achat = (tx, conv, titre, j) => ({ transaction_id: tx, conversation_id: conv, title: titre, price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(j) });
const ACHATS = [
  achat(9401, 7801, 'Vans Old Skool taille 41', 3),
  achat(9402, 7802, 'Puma Suede taille 42', 2),
  achat(9403, 7803, 'Reebok Club C taille 40', 2),
];
const NUMS = Object.fromEntries(['117', '42', '73', 'B233', '61', '64', '52', '70'].map((n, i) => ['an' + (i + 1), { numero: n, title: VENTES[i].title, price: 50 }]));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const ROWS = [
  { id: 'main', data: { vinted_ship_done: { 7005: M - 3600000 }, vinted_annonce_numeros: NUMS } },
  { id: 'panel_colis_relais', data: {
    9401: { code: '418205', lieu: 'Locker Carrefour, 4 Rue de Paris, 35000 Rennes, France', at: iso(M), url: 'https://www.vinted.fr/inbox/7801' },
    9402: { code: '998877', lieu: 'point relais TABAVAP, TABAVAP, 29 RUE HOCHE, 56000 VANNES', at: iso(M), url: 'https://www.vinted.fr/inbox/7802' },
    9403: { code: 'B11111', lieu: 'Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes, France', at: iso(M), url: 'https://www.vinted.fr/inbox/7803' },
  } },
  { id: 'harvest_111_pickup_points', data: { capturedAt: iso(M), payload: { nearby_drop_off_points: { carrier: { name: 'Vinted Go' }, drop_off_points: [
    { code: 'VG1', name: 'Kusmi Tea', drop_off_point_address: '13 Rue Saint-Vincent, 56000 Vannes', latitude: 47.6571, longitude: -2.7570, distance: 1.2, distance_unit: 'km' },
    { code: 'VG2', name: 'Kusmi Tea', drop_off_point_address: '2 Rue Lafayette, 35000 Rennes', latitude: 48.11, longitude: -1.68, distance: 9, distance_unit: 'km' },
  ] } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(M), payload: { my_orders: ACHATS } } },
  ...[7001, 7002, 7003].map((tx) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi: `TRK${tx}`, receivedAt: iso(M - 3 * 3600e3), pdfB64: 'JVBERi0xLjQK' } })),
  { id: 'email_track_vinted_1790000000000002', data: { type: 'suivi', carrier: 'vinted', suivi: '1790000000000002', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(4), code: '3904112', lieu: 'Relais Pressing Mermoz, 14 Avenue Mermoz, 35000 Rennes', limite: dans(1) } },
  { id: 'email_track_mondialrelay_55500002', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '55500002', status: 'available', statusLabel: 'Disponible', subject: 'Votre colis est disponible', receivedAt: ilYa(1), code: '445566', lieu: "TABA'VAP, 29 Rue Hoche, 56000 Vannes", limite: dans(3) } },
  { id: 'email_track_vinted_1790000000000003', data: { type: 'suivi', carrier: 'vinted', suivi: '1790000000000003', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(1), code: 'A22222', lieu: '*Consigne Vinted Go*, * Kusmi Tea *, * 13 Rue Saint-Vincent', limite: dans(4), consigne: true } },
  { id: 'email_track_vinted_04103186091937', data: { type: 'suivi', carrier: 'vinted', suivi: '04103186091937', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(1), code: '551200' } },
  { id: 'email_track_chronopost_04103186091937', data: { type: 'suivi', carrier: 'chronopost', suivi: '04103186091937', status: 'available', statusLabel: 'Disponible', subject: 'Votre colis est disponible en Relais Pickup', receivedAt: ilYa(1), lieu: 'TERRA CBD, 11 RUE HOCHE, 56000 VANNES', limite: dans(5) } },
  { id: 'email_track_chronopost_XW000111222FR', data: { type: 'suivi', carrier: 'chronopost', suivi: 'XW000111222FR', status: 'available', statusLabel: 'Disponible', subject: 'Votre colis est disponible', receivedAt: ilYa(1), code: '778899' } },
  { id: 'email_track_mondialrelay_55500003', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '55500003', status: 'available', statusLabel: 'Disponible', subject: 'Votre colis est disponible', receivedAt: ilYa(1), code: '123456', lieu: 'BAR LE NAUTILUS, 35260 CANCALE', limite: dans(2) } },
  { id: 'email_track_mondialrelay_55500001', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '55500001', status: 'available', statusLabel: 'Disponible', subject: 'Votre colis est disponible', receivedAt: ilYa(30), code: '771234', lieu: 'Tabac du Port, 2 Quai Gambetta, 35260 Cancale' } },
];
// La place attendue de chaque colis (sa clé d'identité → sa colonne).
const ATTENDU = {
  'v:7001': 'prets', 'v:7002': 'prets', 'v:7003': 'prets', 'v:7004': 'attente', 'v:7005': 'partis',
  'p:7101': 'partis', 'p:7102': 'partis', 'p:7103': 'partis',
  'r:v:9401': 'retirer', 'r:e:1790000000000002': 'retirer', 'r:e:55500001': 'retirer',
  'r:e:55500002': 'retirer', 'r:v:9402': 'retirer', 'r:e:1790000000000003': 'retirer', 'r:v:9403': 'retirer',
  'r:e:04103186091937': 'retirer', 'r:e:XW000111222FR': 'retirer', 'r:e:55500003': 'retirer',
};
// Le POINT de chaque colis à retirer (sa clé de lieu) — par identité.
const POINT = {
  'r:e:55500002': 'tabavap|56000', 'r:v:9402': 'tabavap|56000',
  'r:e:1790000000000003': 'kusmitea|56000', 'r:v:9403': 'kusmitea|56000',
  'r:e:04103186091937': 'terracbd|56000', 'r:e:XW000111222FR': '__inconnu', 'r:e:55500003': 'barlenautilus|35260',
  'r:v:9401': 'carrefour|35000', 'r:e:1790000000000002': 'relaispressingmermoz|35000', 'r:e:55500001': 'tabacduport|35260',
};
const HORS_COMPTE = ['r:e:55500001'];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x === 'object' ? JSON.stringify(x) : x);
  }
  return out;
};

async function preparer(b, vp) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sd) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_ship_done', JSON.stringify(sd)); } catch (_) {} }, ROWS[0].data.vinted_ship_done);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"features":[]}' });
    if (/tiles\.openfreemap\.org/.test(u)) return r.abort();
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(M), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}

const ENVOYER = Object.keys(ATTENDU).filter((k) => !k.startsWith('r:'));
const RETIRER = Object.keys(ATTENDU).filter((k) => k.startsWith('r:'));
// Les codes de retrait des données (chacun doit s'écrire UNE fois, sous « À retirer »).
const CODES = ['418205', '998877', 'B11111', '3904112', '445566', 'A22222', '551200', '778899', '123456', '771234'];
const GROUPE_ENV = { 'v:7001': 'pret', 'v:7002': 'pret', 'v:7003': 'pret', 'v:7004': 'attente' };
const PARTIS = ['v:7005', 'p:7101', 'p:7102', 'p:7103'];

// Ce que l'écran montre (DOM de l'écran Colis) : identités, codes, textes.
const lire = (pg) => pg.evaluate((CODES) => {
  const main = document.querySelector('.vrm-main') || document.body;
  // L'identité d'un colis à l'écran, quelle que soit la forme qui la porte (la
  // nouvelle `data-colis-ident`, ou celles d'avant : carte de colonne, carte de
  // bordereau, ligne d'e-mail par n° de suivi, achat à vérifier / en vérification,
  // ligne « coché posté », ligne « Partis ») — sinon le contrôle « une fois »
  // ne pourrait pas échouer sur l'avant (§6 : il doit pouvoir être rouge).
  const identDe = (e) => e.getAttribute('data-colis-ident') || e.getAttribute('data-cc-carte')
    || (e.hasAttribute('data-bord-card') && e.getAttribute('data-tx-colis') ? 'v:' + e.getAttribute('data-tx-colis') : '')
    || (e.getAttribute('data-colis-suivi') ? 'r:e:' + e.getAttribute('data-colis-suivi') : '')
    || (e.getAttribute('data-a-verifier-vinted') ? 'r:v:' + e.getAttribute('data-a-verifier-vinted') : '')
    || (e.getAttribute('data-en-verification-tx') ? 'r:c:' + e.getAttribute('data-en-verification-tx') : '')
    || (e.hasAttribute('data-limite') && e.getAttribute('data-tx') ? 'v:' + e.getAttribute('data-tx') : '') || '';
  const SEL = '[data-colis-ident],[data-cc-carte],[data-bord-card][data-tx-colis],[data-colis-suivi],[data-a-verifier-vinted],[data-en-verification-tx],[data-limite][data-tx]';
  const idents = [...main.querySelectorAll(SEL)].filter((e) => identDe(e) && e.getClientRects().length + (e.closest('details') ? 1 : 0) > 0).map((e) => ({ cle: identDe(e),
    groupe: e.getAttribute('data-groupe-carte') || '', partis: !!e.closest('[data-colis-partis]'), verif: !!e.closest('[data-retirer-a-verifier]'),
    point: (e.closest('[data-relais-point]') || { getAttribute: () => '' }).getAttribute('data-relais-point'), ambre: e.getAttribute('data-ambre') === '1',
    retire: !!e.querySelector('[data-colis-retire]'), txt: e.innerText, codesIci: [...e.querySelectorAll('[data-code-retrait]')].map((x) => x.getAttribute('data-code-retrait')).filter(Boolean),
    echeance: (e.querySelector('[data-rp-echeance]') || { getAttribute: () => null }).getAttribute('data-rp-echeance'), echeanceAmbre: !!e.querySelector('[data-rp-echeance].is-ambre'), section: (e.closest('[data-rp-section]') || { getAttribute: () => '' }).getAttribute('data-rp-section') }));
  const texte = main.innerText || '';
  const compte = (s) => texte.split(s).length - 1;
  // (3 nov., nouvelle mise en page) Le code s'affiche au toucher (« Code ») : il est PORTÉ une fois par la ligne
  // de SON colis (`data-code-retrait`), et écrit en clair seulement dans le détail ouvert.
  const codes = Object.fromEntries(CODES.map((c) => [c, main.querySelectorAll(`[data-code-retrait="${c}"]`).length + compte(c)]));
  const seg = [...document.querySelectorAll('[data-colis-onglet-choix]')].map((b) => ({ v: b.getAttribute('data-colis-onglet-choix'), n: b.getAttribute('data-colis-onglet-n'), urgent: b.getAttribute('data-urgent'), presse: b.getAttribute('aria-pressed'), txt: b.innerText.trim() }));
  const onglet = (document.querySelector('[data-colis-onglet]') || { getAttribute: () => null }).getAttribute('data-colis-onglet');
  // Texte écrasé : un bloc de texte réduit à une colonne étroite (une lettre par ligne).
  const ecrases = [];
  for (const el of main.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim(); if (t.length < 6) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
    if (r.width < 48 && r.height > lh * 3) ecrases.push(t.slice(0, 30) + ` (${Math.round(r.width)}×${Math.round(r.height)})`);
  }
  const points = [...main.querySelectorAll('[data-relais-point]')].map((p) => ({ cle: p.getAttribute('data-relais-point'), compte: Number(p.getAttribute('data-relais-point-comptes')),
    resume: ((p.querySelector('.vrm-rp-resume, .vrm-rpf-n') || {}).innerText || ''), ambre: !!p.querySelector('.vrm-rp-resume .is-ambre, [data-rp-echeance].is-ambre'),
    raisons: [...p.querySelectorAll('[data-sans-lieu-raison]')].map((x) => x.innerText) }));
  const verif = main.querySelector('[data-retirer-a-verifier]');
  let pubRet = null, pubEnv = null; try { pubRet = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); pubEnv = JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); } catch (_) {}
  const bt = document.querySelector('[data-imprimer-prets]');
  const partis = main.querySelector('[data-colis-partis]');
  return { idents, codes, seg, onglet, ecrases, points, pubRet, pubEnv, texte,
    verifTxt: verif ? verif.innerText : null, nVerif: verif ? Number(verif.getAttribute('data-retirer-a-verifier')) : 0,
    bouton: bt ? { n: Number(bt.getAttribute('data-imprimer-prets')), txt: bt.innerText.trim() } : null,
    emballer: !!main.querySelector('[data-emballer-ouvrir]'), partisOuvert: partis ? partis.open : null,
    ban: /Base Adresse Nationale/.test(document.body.innerText), phraseCarte: /Pas sur la carte|La carte ne s.affiche pas/.test(texte),
    ancien: { colonnes: !!document.querySelector('[data-colis-colonnes]'), detail: !!document.querySelector('[data-colis-detail]'), boutonRetraits: !!document.querySelector('[data-colis-retraits-ouvrir]') },
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
}, CODES);

const fois = (L, cle) => L.idents.filter((x) => x.cle === cle).length;
async function tranches(pg, nom) {
  if (!process.env.TRANCHES) return;
  const h = await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return m && m.scrollHeight > m.clientHeight + 4 ? { m: true, H: m.scrollHeight, v: m.clientHeight } : { m: false, H: document.documentElement.scrollHeight, v: window.innerHeight }; });
  for (let y = 0, i = 0; y < h.H && i < 20; y += Math.max(200, h.v - 80), i++) {
    await pg.evaluate(([y, m]) => { if (m) document.querySelector('.vrm-main').scrollTop = y; else window.scrollTo(0, y); }, [y, h.m]);
    await pg.waitForTimeout(250);
    await pg.screenshot({ path: path.join(SHOTS, `${nom}-${String(i).padStart(2, '0')}.png`) });
  }
  await pg.evaluate((m) => { if (m) document.querySelector('.vrm-main').scrollTop = 0; else window.scrollTo(0, 0); }, h.m);
}

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
      const T = vp.width + 'px', ordi = vp.width > 1000;
      await essaie(T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-colis-onglet]').first().waitFor({ timeout: 25000 }).catch(() => {});
        // Attendre que les lectures se posent (ventes, bordereaux, achats, e-mails) et que Ma journée soit publiée.
        for (let i = 0; i < 40; i++) {
          const ok = await pg.evaluate((n) => { const t = Number((document.querySelector('[data-colis-onglet]') || { getAttribute: () => 0 }).getAttribute('data-colis-total')); let r = null, e = null; try { r = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); e = JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); } catch (_) {} return t >= n && !!r && !!e; }, Object.keys(ATTENDU).length);
          if (ok) break; await pg.waitForTimeout(500);
        }
        await pg.waitForTimeout(1500);
        // ── L'ONGLET PAR DÉFAUT : celui qui a de l'urgent (ici un retrait au dernier jour) ──
        let L = await lire(pg);
        dit(!L.ancien.colonnes && !L.ancien.detail && !L.ancien.boutonRetraits, `${T} plus de colonnes, plus de « Colis par colis », plus de « Codes, QR et points relais » (les redites)`, JSON.stringify(L.ancien));
        const sEnv = L.seg.find((x) => x.v === 'envoyer'), sRet = L.seg.find((x) => x.v === 'retirer');
        // (3 nov., nouvelle mise en page) Trois onglets : À envoyer · Envoyés (l'ancien « Partis ») · À retirer.
        dit(!!sEnv && !!sRet && L.seg.length === 3 && L.seg.map((x) => x.v).join() === 'envoyer,envoyes,retirer', `${T} un sélecteur « À envoyer » / « Envoyés » / « À retirer »`, JSON.stringify(L.seg));
        dit(!!sEnv && !!L.pubEnv && sEnv.n === String(L.pubEnv.total) && new RegExp(`À envoyer\\s*${L.pubEnv.total}\\b`).test(sEnv.txt), `${T} « À envoyer · N » = le nombre de Ma journée (vrm_colis_aposter)`, JSON.stringify([sEnv, L.pubEnv && L.pubEnv.total]));
        dit(!!sRet && !!L.pubRet && sRet.n === String(L.pubRet.total) && new RegExp(`À retirer\\s*${L.pubRet.total}\\b`).test(sRet.txt), `${T} « À retirer · N » = le nombre de Ma journée (vrm_colis_retirer)`, JSON.stringify([sRet, L.pubRet && L.pubRet.total]));
        dit(L.onglet === 'retirer' && sRet && sRet.urgent === '1' && sEnv && sEnv.urgent === '0', `${T} par défaut : l'onglet qui a de l'urgent (« À retirer », son nombre en ambre)`, JSON.stringify([L.onglet, sEnv && sEnv.urgent, sRet && sRet.urgent]));
        // ── « À RETIRER » ──
        if (process.env.PLAN) console.log(`\n──── PLAN ${T} · À retirer ────\n${L.texte}\n────`);
        await tranches(pg, `colis-clair-${vp.width}-retirer`);
        const doubles = RETIRER.filter((k) => fois(L, k) !== 1).map((k) => `${k}×${fois(L, k)}`);
        dit(!doubles.length, `${T} À retirer : chaque colis (par son identité) est dans le DOM EXACTEMENT une fois`, JSON.stringify(doubles));
        const intrus = L.idents.filter((x) => !x.cle.startsWith('r:')).map((x) => x.cle);
        dit(!intrus.length, `${T} À retirer : aucun colis à envoyer n'y est redit`, JSON.stringify(intrus));
        const codesFaux = Object.entries(L.codes).filter(([, n]) => n !== 1);
        dit(!codesFaux.length, `${T} chaque code de retrait est écrit UNE fois sur l'écran`, JSON.stringify(L.codes));
        const malRanges = Object.entries(POINT).filter(([cle, pt]) => !HORS_COMPTE.includes(cle)).filter(([cle, pt]) => { const x = L.idents.find((y) => y.cle === cle); return !x || x.point !== pt; }).map(([cle, pt]) => `${cle}: attendu ${pt}, vu ${(L.idents.find((y) => y.cle === cle) || {}).point || 'aucun'}`);
        dit(!malRanges.length, `${T} chaque colis à retirer est sous SON point (même relais écrit deux fois = un point ; sans lieu = « pas encore connu »)`, JSON.stringify(malRanges));
        const ver = L.idents.find((x) => x.cle === HORS_COMPTE[0]);
        // (3 nov.) « À vérifier » est une section repliée ; ouverte, la ligne dit sa raison en une puce et garde son code.
        await pg.evaluate(() => { const d = document.querySelector('[data-retirer-a-verifier]'); if (d && 'open' in d) d.open = true; }); await pg.waitForTimeout(200);
        const Lv = await lire(pg); const verV = Lv.idents.find((x) => x.cle === HORS_COMPTE[0]);
        dit(!!verV && verV.verif && Lv.nVerif === HORS_COMPTE.length && verV.codesIci.includes('771234') && /À vérifier\s*·?\s*1/.test(Lv.verifTxt || '') && /(délai|depuis|dépassé|longtemps|retour)/i.test(verV.txt || ''), `${T} le colis « à vérifier » reste VISIBLE, à part en bas (« À vérifier · 1 »), avec sa raison et son code`, Lv.verifTxt);
        await pg.evaluate(() => { const d = document.querySelector('[data-retirer-a-verifier]'); if (d && 'open' in d) d.open = false; });
        const pointsComptes = L.points.filter((p) => p.cle !== '__inconnu').reduce((t, p) => t + p.compte, 0) + ((L.points.find((p) => p.cle === '__inconnu') || {}).compte || 0);
        dit(!!L.pubRet && pointsComptes === L.pubRet.total, `${T} la somme des colis par point = « À retirer · N » (Ma journée)`, `${pointsComptes} / ${L.pubRet && L.pubRet.total}`);
        const tv = L.points.find((p) => p.cle === 'tabavap|56000');
        dit(!!tv && tv.compte === 2 && /^2 colis\b/.test(tv.resume), `${T} TABA'VAP (e-mail) et TABAVAP (conversation) : un point, « 2 colis »`, tv && JSON.stringify(tv));
        const terra = L.idents.filter((x) => x.point === 'terracbd|56000');
        dit(terra.length === 1 && terra[0].codesIci.includes('551200'), `${T} le même n° écrit par Vinted (code) et Chronopost (lieu) : un colis, son code, sous Terra Cbd`, JSON.stringify(terra.map((x) => x.txt)));
        const inc = L.points.find((p) => p.cle === '__inconnu');
        // (3 nov., Julien : « aucun texte explicatif ») Le colis sans lieu est sous « Lieu à confirmer », sans phrase.
        dit(!!inc && inc.compte === 1 && !inc.raisons.length && /Lieu à confirmer/.test(L.texte) && !/ne nomme pas le point/.test(L.texte), `${T} un colis sans lieu : sous « Lieu à confirmer », sans phrase`, inc && JSON.stringify(inc));
        const mermoz = L.points.find((p) => p.cle === 'relaispressingmermoz|35000');
        const rowsMermoz = L.idents.filter((x) => x.point === 'relaispressingmermoz|35000' || (x.section === 'aujourdhui'));
        const premierPret = L.idents.find((x) => x.cle.startsWith('r:') && !x.verif);
        dit(!!mermoz && rowsMermoz.some((x) => x.echeanceAmbre && /dernier|demain/.test(x.echeance || '')) && premierPret && (premierPret.point === 'relaispressingmermoz|35000'), `${T} le point au dernier jour : en tête, « dernier jour » en ambre`, JSON.stringify([rowsMermoz.map((x) => [x.cle, x.echeance, x.section]), premierPret && premierPret.point]));
        // (3 nov.) Le code s'ouvre au toucher de « Code » : nommé (« Code de retrait 998877 »).
        await pg.click('[data-cc-carte="r:v:9402"] [data-rp-code]').catch(() => {}); await pg.waitForTimeout(250);
        const pumaTxt = await pg.evaluate(() => (document.querySelector('[data-cc-carte="r:v:9402"]') || {}).innerText || '');
        dit(/Puma Suede taille 42/.test(pumaTxt) && /Code de retrait\s*998877/.test(pumaTxt), `${T} une carte à retirer dit ce que c'est et SON code, nommé (« Code de retrait 998877 »)`, pumaTxt);
        await pg.click('[data-cc-carte="r:v:9402"] .vrm-rpf-ouvrir').catch(() => {}); await pg.waitForTimeout(200);
        const sansGeste = L.idents.filter((x) => x.cle.startsWith('r:') && !x.retire).map((x) => x.cle);
        dit(!sansGeste.length, `${T} chaque colis à retirer porte « J'ai retiré » sur SA carte`, JSON.stringify(sansGeste));
        // (2 nov., n° 1) « J'ai retiré » se LIT : le texte visible du bouton (rendu, pas le
        // DOM) — mot « retiré » dessiné en entier dans le bouton, rien de rogné ni coupé
        // (`clip-path`, `text-overflow`), 44 px au doigt. Un « ✓ » seul ne dit pas le geste.
        const retire = await pg.evaluate(() => [...document.querySelectorAll('[data-cc-colonne="retirer"] [data-colis-retire]')].filter((b) => b.getClientRects().length).map((b) => {
          const br = b.getBoundingClientRect(); const cs = getComputedStyle(b);
          const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n, ok = false, larg = 0, raison = 'pas de texte « retiré »';
          while ((n = w.nextNode())) {
            if (!/retir/i.test(n.textContent)) continue;
            const r = document.createRange(); r.selectNodeContents(n); const rr = r.getBoundingClientRect(); larg = Math.round(rr.width);
            let el = n.parentElement, coupe = '';
            while (el && el !== b.parentElement) { const c = getComputedStyle(el); if ((c.clipPath && c.clipPath !== 'none') || c.clip !== 'auto' && c.clip) coupe = 'clip'; if (c.visibility === 'hidden' || c.opacity === '0' || c.display === 'none') coupe = 'caché'; const er = el.getBoundingClientRect(); if (el !== b && (er.width < rr.width - 1) && c.overflow !== 'visible') coupe = 'rogné ' + Math.round(er.width) + 'px'; el = el.parentElement; }
            const dedans = rr.left >= br.left - 1 && rr.right <= br.right + 1 && rr.width > 30;
            ok = !coupe && dedans; raison = coupe || (dedans ? '' : 'hors du bouton');
          }
          return { ok: ok && cs.textOverflow !== 'ellipsis' && b.scrollWidth <= b.clientWidth + 1 && br.height >= 44 - 0.5, txt: b.innerText.trim(), h: Math.round(br.height), larg, raison: raison || (cs.textOverflow === 'ellipsis' ? 'ellipsis' : b.scrollWidth > b.clientWidth + 1 ? 'déborde' : br.height < 44 ? 'h<44' : '') };
        }));
        const retireKO = retire.filter((x) => !x.ok);
        dit(retire.length > 0 && !retireKO.length, `${T} « J'ai retiré » se lit en toutes lettres sur chaque carte (texte rendu, pas rogné, 44 px)`, JSON.stringify(retireKO.slice(0, 3).concat(retire.length ? [] : ['aucun bouton'])));
        dit(!L.ban, `${T} jamais « Base Adresse Nationale » à l'écran`, '');
        if (!ordi) dit(!L.phraseCarte, `${T} au téléphone, aucune phrase sur la carte (« Pas sur la carte… », « La carte ne s'affiche pas… »)`, '');
        dit(!L.ecrases.length, `${T} À retirer : aucun texte écrasé`, JSON.stringify(L.ecrases.slice(0, 5)));
        dit(L.sw <= L.cw + 1, `${T} À retirer : aucun débordement horizontal`, `${L.sw} > ${L.cw}`);
        // ── « À ENVOYER » ──
        if (await pg.$('[data-colis-onglet-choix="envoyer"]')) await pg.click('[data-colis-onglet-choix="envoyer"]');
        await pg.waitForTimeout(800);
        L = await lire(pg);
        if (process.env.PLAN) console.log(`\n──── PLAN ${T} · À envoyer ────\n${L.texte}\n────`);
        await tranches(pg, `colis-clair-${vp.width}-envoyer`);
        dit(L.onglet === 'envoyer', `${T} toucher « À envoyer » montre les colis à envoyer`, L.onglet);
        const doublesE = ENVOYER.filter((k) => !PARTIS.includes(k)).filter((k) => fois(L, k) !== 1).map((k) => `${k}×${fois(L, k)}`);
        dit(!doublesE.length, `${T} À envoyer : chaque colis (par son identité) est dans le DOM EXACTEMENT une fois`, JSON.stringify(doublesE));
        const intrusE = L.idents.filter((x) => x.cle.startsWith('r:')).map((x) => x.cle);
        dit(!intrusE.length, `${T} À envoyer : aucun colis à retirer n'y est redit`, JSON.stringify(intrusE));
        const codesE = Object.entries(L.codes).filter(([, n]) => n !== 0);
        dit(!codesE.length, `${T} À envoyer : aucun code de retrait (ils ne sont que sous « À retirer »)`, JSON.stringify(codesE));
        const grpFaux = Object.entries(GROUPE_ENV).filter(([cle, g]) => { const x = L.idents.find((y) => y.cle === cle); return !x || x.groupe !== g; });
        dit(!grpFaux.length, `${T} chaque colis à envoyer est dans SON groupe (Prêts à imprimer · En attente du bordereau)`, JSON.stringify(grpFaux));
        // (3 nov., nouvelle mise en page) Les colis sont rangés sous l'en-tête de LEUR transporteur (le groupe
        // Prêts/En attente reste porté par `data-groupe-carte`, jugé juste au-dessus).
        const grT = await pg.evaluate(() => [...document.querySelectorAll('[data-groupe-transp]')].map((x) => x.getAttribute('data-groupe-transp')));
        dit(grT.length > 0 && new Set(grT).size === grT.length, `${T} les groupes sont nommés (un en-tête par transporteur)`, grT.join(' | '));
        const partisIci = PARTIS.filter((k) => fois(L, k) > 0);
        await pg.click('[data-colis-onglet-choix="envoyes"]'); await pg.waitForTimeout(600);
        const Lp = await lire(pg);
        const partisFaux = PARTIS.filter((k) => fois(Lp, k) !== 1 || !(Lp.idents.find((y) => y.cle === k) || {}).partis);
        dit(!partisFaux.length && !partisIci.length, `${T} « Partis » = l'onglet « Envoyés » : chaque colis parti y est UNE fois (coché posté compris), aucun dans « À envoyer »`, JSON.stringify([partisFaux, partisIci]));
        await pg.click('[data-colis-onglet-choix="envoyer"]'); await pg.waitForTimeout(500);
        const nPrets = Object.values(GROUPE_ENV).filter((g) => g === 'pret').length;
        // (3 nov., choix n° 2) « Tout imprimer » : le lot compte les prêts (ici Vinted seul), le libellé ne redit pas N.
        dit(!!L.bouton && L.bouton.n === nPrets && /Tout imprimer/.test(L.bouton.txt), `${T} « Tout imprimer » = les prêts`, JSON.stringify(L.bouton));
        dit(L.emballer, `${T} « Emballer » reste accessible`, '');
        // (2 nov., n° 3, 4 et 5) Le haut d'« À envoyer », avant la première carte.
        await pg.evaluate(() => { window.scrollTo(0, 0); const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; });
        await pg.waitForTimeout(200);
        const haut = await pg.evaluate(() => {
          const main = document.querySelector('.vrm-main') || document.body;
          const tg = main.querySelector('[data-tout-generer]');
          const nTg = tg ? Number((/\((\d+)\)/.exec(tg.innerText) || [])[1]) : null;
          // Le même nombre dit deux fois : « Tout générer (N) » puis « N bordereau(x) à générer ».
          const redit = nTg != null && [...main.querySelectorAll('[data-raison-bord]')].some((r) => r.getClientRects().length && new RegExp('\\b' + nTg + '\\s*bordereaux?\\s*à générer').test(r.innerText));
          // Un bloc encadré autour d'un bouton seul.
          const rc = main.querySelector('[data-colis-recap]');
          let cadre = null;
          if (rc && rc.getClientRects().length) {
            const vis = [...rc.querySelectorAll('button,a,[data-colis-urgence-ligne],[data-colis-recap-ebay-ligne]')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
            const cs = getComputedStyle(rc);
            const encadre = parseFloat(cs.borderTopWidth) > 0 || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') || parseFloat(cs.paddingTop) > 4;
            cadre = { n: vis.length, encadre, seul: vis.length === 1 && vis[0].hasAttribute('data-tout-generer') };
          }
          const premiere = main.querySelector('[data-bord-card]');
          const pr = premiere ? premiere.getBoundingClientRect() : null;
          const apres = (sel) => { const e = main.querySelector(sel); return !e ? 'absent' : !premiere ? 'sans carte' : (premiere.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING ? 'dessous' : 'dessus'); };
          const sous = document.querySelector('[data-sous-titre]'); const sr = sous ? sous.getBoundingClientRect() : null;
          const lh = sous ? (parseFloat(getComputedStyle(sous).lineHeight) || 19) : 19;
          const bt = document.querySelector('[data-imprimer-prets]'); const btr = bt ? bt.getBoundingClientRect() : null;
          const posteFixe = [...main.querySelectorAll('button')].some((b) => b.getClientRects().length && /est dans « Partis »|sont dans « Partis »/.test(b.innerText));
          return { nTg, redit, cadre, premiereTop: pr ? Math.round(pr.top) : null, vh: window.innerHeight,
            journal: apres('[data-journal-entree]'), stock: apres('[data-colis-stock]'), posteFixe,
            sous: sr ? { w: Math.round(sr.width), h: Math.round(sr.height), lignes: Math.round(sr.height / lh), cote: !!(btr && btr.top < sr.bottom - 2 && btr.bottom > sr.top + 2) } : null };
        });
        dit(haut.nTg == null || !haut.redit, `${T} À envoyer : le nombre de « Tout générer (N) » n'est pas redit par une ligne « N bordereau(x) à générer »`, JSON.stringify([haut.nTg, haut.redit]));
        dit(!haut.cadre || !(haut.cadre.seul && haut.cadre.encadre), `${T} À envoyer : pas de bloc encadré autour d'un bouton seul`, JSON.stringify(haut.cadre));
        dit(haut.journal !== 'dessus' && haut.stock !== 'dessus', `${T} À envoyer : « Tes emails… » et « Où sont ces articles » sous la liste, pas avant la première carte`, JSON.stringify([haut.journal, haut.stock]));
        dit(!haut.posteFixe, `${T} À envoyer : pas de phrase permanente « … est dans Partis » (le nombre est sur « Partis »)`, '');
        if (!ordi) {
          // (3 nov.) Style Fusion : plus de phrase sous le titre de Colis (Julien, 2 nov. 22 h). S'il y en a une, elle tient sur une ligne.
          dit(!haut.sous || (!haut.sous.cote && haut.sous.lignes <= 1), `${T} le sous-titre (s'il existe) tient sur UNE ligne, le bouton du haut n'est pas à côté de lui`, JSON.stringify(haut.sous));
          dit(haut.premiereTop != null && haut.premiereTop < haut.vh - 60, `${T} la première carte de colis est au-dessus de la ligne de flottaison (un colis prêt)`, `${haut.premiereTop} / ${haut.vh}`);
        }
        dit(!L.ban, `${T} À envoyer : jamais « Base Adresse Nationale »`, '');
        dit(!L.ecrases.length, `${T} À envoyer : aucun texte écrasé`, JSON.stringify(L.ecrases.slice(0, 5)));
        dit(L.sw <= L.cw + 1, `${T} À envoyer : aucun débordement horizontal`, `${L.sw} > ${L.cw}`);
        await pg.screenshot({ path: path.join(SHOTS, `colis-clair-${vp.width}.png`), fullPage: false });
        if (L.bouton) {
          // (Fusion) « Imprimer les N prêts » vit dans les outils de « … » : on le touche par le DOM.
          await pg.evaluate(() => { const b = document.querySelector('[data-imprimer-prets]'); if (b) b.click(); });
          await pg.waitForSelector('[data-lot][role=dialog]', { timeout: 5000 }).catch(() => {});
          const lot = await pg.evaluate(() => { const d = document.querySelector('[data-lot][role=dialog]'); return d ? Number(d.getAttribute('data-lot')) : null; });
          dit(lot === L.bouton.n, `${T} le bouton ouvre le lot d'impression des ${L.bouton.n} prêts (l'action de « Tout imprimer »)`, String(lot));
          await pg.keyboard.press('Escape').catch(() => {});
          await pg.waitForTimeout(300);
        }
        // ── LE LIEN « À RETIRER » (Ma journée, notification, ancien `?tab=retraits`) ──
        // Il ouvrait le détail des retraits SOUS les colonnes : les colis et leurs
        // codes y étaient redits. Il ouvre maintenant « À retirer », chaque code une fois.
        // (l'onglet d'impression qui se ferme peut interrompre la navigation : ERR_ABORTED ⇒ une seconde fois)
        await pg.goto(`http://localhost:${PORT}/?tab=retraits`, { waitUntil: 'domcontentloaded' }).catch(() => pg.waitForTimeout(600).then(() => pg.goto(`http://localhost:${PORT}/?tab=retraits`, { waitUntil: 'domcontentloaded' })));
        for (let i = 0; i < 40; i++) { const n = await pg.evaluate(() => document.querySelectorAll('[data-code-retrait]').length); if (n >= 10) break; await pg.waitForTimeout(500); }
        await pg.waitForTimeout(2500);
        L = await lire(pg);
        dit(L.onglet === 'retirer', `${T} le lien « à retirer » ouvre l'onglet « À retirer »`, String(L.onglet));
        const doublesR = RETIRER.filter((k) => fois(L, k) !== 1).map((k) => `${k}×${fois(L, k)}`);
        dit(!doublesR.length, `${T} lien « à retirer » : chaque colis à retirer EXACTEMENT une fois dans le DOM`, JSON.stringify(doublesR));
        const codesR = Object.entries(L.codes).filter(([, n]) => n !== 1);
        dit(!codesR.length, `${T} lien « à retirer » : chaque code de retrait écrit UNE fois`, JSON.stringify(L.codes));
        dit(!L.ban, `${T} lien « à retirer » : jamais « Base Adresse Nationale »`, '');
        if (!ordi) dit(!L.phraseCarte, `${T} lien « à retirer » : au téléphone, aucune phrase sur la carte`, '');
        dit(!L.ecrases.length, `${T} lien « à retirer » : aucun texte écrasé`, JSON.stringify(L.ecrases.slice(0, 5)));
        dit(!errs.length, `${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ colis clair : ${ko} rouge(s).` : `\n✅ colis clair : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
