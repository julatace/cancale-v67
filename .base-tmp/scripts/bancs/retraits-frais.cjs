// Banc : RETRAITS FRAIS — LA CAPTURE DE JULIEN DU 9 NOV. (docs/passation/2026-11-09-retraits-frais.md)
// Sa capture (Colis → À retirer, iPhone sombre) : « À retirer · 0 », une CARTE à deux pastilles « 1 » et
// « 17 », « Deux doigts pour déplacer la carte » écrit en travers, « 1 compte à relire », « À vérifier 3 »,
// « Peut-être en double 18 ». Ici, données INVENTÉES de la VRAIE forme (`email_track_*` dont les moitiés
// Vinted `email_track_autre_conv-*`, `transp_*`, `harvest_{uid}_suivi_{tx}`, achats `my_orders`) :
//   P1 Cancale — trois colis Mondial Relay RETIRÉS (le transporteur le dit, par leur n°) et leurs trois
//      moitiés Vinted (adresse sans compte relié, aucune identité) ; une moitié dont la COMMANDE porte un
//      n° retiré chez Vinted Go ; une moitié au MÊME CODE qu'une consigne retirée ;
//   P2 Vannes — UN vrai colis à retirer (Chronopost, disponible) et DEUX vraies moitiés Vinted à côté
//      (peut-être en double) ;
//   P3 Saint-Malo — un colis dont la date limite est passée (à vérifier).
// Ce qui est jugé (data-* et `vrm_colis_retirer`, §6.4) :
//   F1 onglet « À retirer » = 1 = la publication (Ma journée, cloche, widget la lisent) = la colonne ;
//   F2 la CARTE n'épingle que P2 (1 point, épingle « 1 ») — ni P1 (rien à retirer), ni P3 (à vérifier) ;
//   F3 « Peut-être en double » = 2 (les deux de P2) ; les moitiés des colis retirés n'y sont pas ;
//   F4 aucun colis retiré n'est « à retirer », « à vérifier » ou « en double » ; chacun est DIT dans
//      « Sortis de « à retirer » » (les moitiés : « Sans doute le même colis que le n°… ») ;
//   F5 « Suivi vérifié il y a 10 min » ;
//   F6 « Relire compte_a · 3 j » nomme le compte ; touchée, elle dit le geste et « Mes comptes » ;
//   F7 au doigt : le voile de MapLibre n'est jamais visible ; l'indice bref apparaît puis s'efface.
// 390 tactile sombre + 1512 clair. BANC_PORT, SHOTS=<dossier>, DIST=<build>, JR_VUES=390-sombre,…
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), zlib = require('zlib');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 12163);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.JR_VUES ? process.env.JR_VUES.split(',') : null;
const maintenant = new Date('2026-11-09T09:00:00Z');   // 10 h à Paris
const MS = maintenant.getTime();
const iso = (t) => new Date(t).toISOString();
const Z = (s) => `2026-${s}:00.000Z`;
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const capVieux = iso(MS - 3 * 86400000 - 3600e3);   // achats de compte_a relus il y a 3 j
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const P1 = 'TABAC DU PORT, 12 RUE DU PORT, 35260 CANCALE';
const P2 = 'PICKUP HOCHE, 29 RUE HOCHE, 56000 VANNES';
const P3 = 'BAR DE LA GARE, 3 RUE DE LA GARE, 35400 SAINT-MALO';
const P4 = 'TABAC DES LICES, 4 PLACE DES LICES, 35000 RENNES';
const GEO = { 35260: [-1.852, 48.677, 'Cancale'], 56000: [-2.76, 47.658, 'Vannes'], 35400: [-2.0, 48.648, 'Saint-Malo'], 35000: [-1.68, 48.11, 'Rennes'] };
// (17 h 24) Les titres de SA capture (vendeurs allemands, espagnols…).
const TITRES = ['Adidas spezial suède', 'Nike P-6000', 'Wildleder Stiefel von Tamaris', 'Zapatillas ADIDAS', 'Puma Suede', 'Asics Gel-1130', 'New Balance 550', 'Salomon XT-6', 'Nike Dunk Low', 'Adidas Samba', 'Converse Chuck 70', 'Vans Old Skool', 'Reebok Club C', 'Onitsuka Mexico 66', 'Nike Air Max 90'];
const ligne = (carrier, suivi, o) => ({ id: `email_track_${carrier}_${suivi}`, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, code2: null, qrB64: null, qrUrl: null, qrType: null, consigne: false, account: 'compte_a', artTitle: null, ...o } });
// Une moitié Vinted « Ton achat t'attend » (api/_lib/achat-arrive-relais.js `ligneArrivee`) : sans n° de suivi.
const moitie = (conv, o) => ({ id: `email_track_autre_conv-${conv}`, data: { cleLigne: `email_track_autre_conv-${conv}`, type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)', subject: 'Ton achat t’attend au point relais', code: null, code2: null, artTitle: `Achat ${conv}`, limite: null, consigne: false, conv, source: 'vinted-commande', forme: 'relais', account: '', recuSur: ['autre@exemple.fr'], ...o } });
const transp = (carrier, suivi, o) => ({ id: `transp_${carrier}_${suivi}`, data: { v: 1, rev: 1, carrier, suivi, etat: null, detail: null, etatAt: null, libelle: '', lieuNom: '', lieuVille: '', lieuCp: '', lieuRue: '', limite: null, limiteSure: false, lu: null, source: 'serveur', essai: iso(MS - 600e3), essaiRes: 'ok', essais: 0, voie: carrier === 'mondialrelay' ? 'mr-fr-mvc' : carrier === 'chronopost' ? 'cp-ws2' : 'vg-v3', fini: false, evenements: [], ...o } });
const DEPOSE = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const ACHATS = [
  { transaction_id: 9400001, conversation_id: 'conv-c1', title: 'Achat C1 par sa commande', price: { amount: '40.0', currency_code: 'EUR' }, status: DEPOSE, transaction_user_status: 'needs_action', date: Z('11-03T10:00'), photo: null },
];
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: capVieux, payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: capVieux, payload: { my_orders: [] } } },
  // P1 — trois colis Mondial Relay retirés (par leur n°) et leurs moitiés Vinted.
  ...[1, 2, 3].flatMap((i) => [
    ligne('mondialrelay', `8200001${i}`, { code: `80001${i}`, lieu: P1, emailAt: Z(`11-0${4 + i}T09:00`), receivedAt: Z(`11-0${4 + i}T09:01`), arriveLe: Z(`11-0${4 + i}T09:00`), limite: `2026-11-1${i}`, account: '' , recuSur: ['autre@exemple.fr'] }),
    transp('mondialrelay', `8200001${i}`, { etat: 'retire', fini: true, etatAt: Z(`11-0${5 + i}T15:00`), lu: Z(`11-0${5 + i}T16:00`), libelle: 'Colis livré au destinataire', cp: '35260' }),
    moitie(`conv-o${i}`, { lieu: P1, emailAt: Z(`11-0${4 + i}T09:10`), receivedAt: Z(`11-0${4 + i}T09:10`), arriveLe: Z(`11-0${4 + i}T09:10`) }),
  ]),
  // P1 — une moitié reliée à SA commande (conversation), dont le n° est retiré chez Vinted Go.
  moitie('conv-c1', { lieu: P1, account: 'compte_a', recuSur: undefined, emailAt: Z('11-06T11:00'), receivedAt: Z('11-06T11:00'), arriveLe: Z('11-06T11:00') }),
  { id: 'harvest_111_suivi_9400001', data: { v: 1, n: 2, tx: '9400001', uid: '111', suivi: '1789000000000401', transporteur: 'vinted', capturedAt: capVieux, source: 'extension', dernier: { t: 'Disponible pour retrait', at: Z('11-06T10:58') }, etapes: [{ t: 'Disponible pour retrait', at: Z('11-06T10:58') }] } },
  transp('vinted', '1789000000000401', { etat: 'retire', fini: true, etatAt: Z('11-08T10:00'), lu: Z('11-08T11:00'), libelle: 'Colis récupéré' }),
  // P1 — une consigne Vinted Go au code B12345 retirée, et la moitié Vinted « Utilise le code B12345 ».
  ligne('vinted', '1789000000000402', { code: 'B12345', lieu: P1, consigne: true, emailAt: Z('11-06T10:00'), receivedAt: Z('11-06T10:01'), arriveLe: Z('11-06T10:00'), limite: '2026-11-12', account: '', recuSur: ['autre@exemple.fr'] }),
  transp('vinted', '1789000000000402', { etat: 'retire', fini: true, etatAt: Z('11-07T12:00'), lu: Z('11-07T13:00'), libelle: 'Colis récupéré' }),
  moitie('conv-x2', { lieu: P1, code: 'B12345', emailAt: Z('11-06T10:05'), receivedAt: Z('11-06T10:05'), arriveLe: Z('11-06T10:05') }),
  // P2 — LE vrai colis à retirer, et deux vraies moitiés Vinted à côté (peut-être en double).
  ligne('chronopost', 'XW300000021TS', { code: '300021', lieu: P2, emailAt: Z('11-08T09:00'), receivedAt: Z('11-08T09:01'), arriveLe: Z('11-08T09:00'), limite: '2026-11-14' }),
  transp('chronopost', 'XW300000021TS', { etat: 'disponible', etatAt: Z('11-08T08:50'), lu: Z('11-09T08:50'), libelle: 'Colis disponible en relais Pickup', limite: '2026-11-14', limiteSure: true }),
  moitie('conv-d1', { lieu: P2, emailAt: Z('11-08T09:05'), receivedAt: Z('11-08T09:05'), arriveLe: Z('11-08T09:05') }),
  moitie('conv-d2', { lieu: P2, emailAt: Z('11-08T09:20'), receivedAt: Z('11-08T09:20'), arriveLe: Z('11-08T09:20') }),
  // P4 — LES 18 DE LA CAPTURE (avec les 3 de P1) : quinze moitiés Vinted (titres de vendeurs étrangers, adresse
  //      sans compte relié) et quinze colis Mondial Relay au même point, tous RETIRÉS d'après le transporteur.
  ...TITRES.flatMap((titre, i) => { const n = String(100 + i), j = 3 + (i % 5);
    return [
      ligne('mondialrelay', `82000${n}`, { code: `9${n}00`, lieu: P4, emailAt: Z(`11-0${j}T08:${String(i).padStart(2, '0')}`), receivedAt: Z(`11-0${j}T08:${String(i).padStart(2, '0')}`), arriveLe: Z(`11-0${j}T08:${String(i).padStart(2, '0')}`), limite: `2026-11-1${j - 2}`, account: '', recuSur: ['autre@exemple.fr'] }),
      transp('mondialrelay', `82000${n}`, { etat: 'retire', fini: true, etatAt: Z(`11-0${j + 1}T15:00`), lu: Z(`11-0${j + 1}T16:00`), libelle: 'Colis livré au destinataire', cp: '35000' }),
      moitie(`conv-r${n}`, { lieu: P4, artTitle: titre, emailAt: Z(`11-0${j}T08:${String(i).padStart(2, '0')}`).replace(':00.000Z', ':30.000Z'), receivedAt: Z(`11-0${j}T08:${String(i).padStart(2, '0')}`), arriveLe: Z(`11-0${j}T08:${String(i).padStart(2, '0')}`).replace(':00.000Z', ':30.000Z') }),
    ]; }),
  // P3 — date limite passée : à vérifier.
  ligne('mondialrelay', '82000031', { code: '800031', lieu: P3, emailAt: Z('10-28T09:00'), receivedAt: Z('10-28T09:01'), arriveLe: Z('10-28T09:00'), limite: '2026-11-02' }),
];
const RETIRES = ['82000011', '82000012', '82000013', '1789000000000401', '1789000000000402', 'conv-o1', 'conv-o2', 'conv-o3', 'conv-c1', 'conv-x2', ...TITRES.map((_, i) => `conv-r${100 + i}`), ...TITRES.map((_, i) => `82000${100 + i}`)];

// ── La carte : un style raster et une tuile faite à la main (comme carte-stable.cjs) ──
const crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const morceau = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const TUILE = (() => { const T = 256, lignes = []; for (let y = 0; y < T; y++) { const l = Buffer.alloc(1 + T * 3); for (let x = 0; x < T; x++) { const v = x % 32 === 0 || y % 32 === 0 ? 150 : 236; l[1 + x * 3] = v; l[2 + x * 3] = v; l[3 + x * 3] = v; } lignes.push(l); } const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(T, 0); ihdr.writeUInt32BE(T, 4); ihdr[8] = 8; ihdr[9] = 2; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), morceau('IHDR', ihdr), morceau('IDAT', zlib.deflateSync(Buffer.concat(lignes))), morceau('IEND', Buffer.alloc(0))]); })();
const STYLE = { version: 8, sources: { banc: { type: 'raster', tiles: ['https://tiles.openfreemap.org/banc/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'OpenFreeMap © OpenMapTiles © OpenStreetMap' } }, layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#eef0f2' } }, { id: 'banc', type: 'raster', source: 'banc' }] };

// ── Le serveur et la base (PostgREST minimal : projection, id eq/like/in, is.null) ──
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
    if (src === 'updated_at') { out[alias] = capVieux; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre, tab) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const j = (d) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) {
      const q = new URL(u); const cp = q.searchParams.get('postcode') || ''; const g = GEO[cp];
      if (q.searchParams.get('type') === 'municipality') return j({ features: g ? [{ geometry: { coordinates: [g[0], g[1]] }, properties: { score: 0.9, type: 'municipality', postcode: cp, city: g[2], name: g[2], label: g[2] } }] : [] });
      return j({ features: g ? [{ geometry: { coordinates: [g[0], g[1]] }, properties: { score: 0.95, type: 'housenumber', postcode: cp, city: g[2], name: (q.searchParams.get('q') || '').split(',')[0], label: q.searchParams.get('q') } }] : [] });
    }
    if (/tiles\.openfreemap\.org\/styles\//.test(u)) return j(STYLE);
    if (/tiles\.openfreemap\.org\/banc\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: TUILE });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: capVieux, cap: r.data && r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => ((r.data || {})[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lks = [...u.matchAll(/[?&]id=like\.([^&]*)/g)];
    if (lks.length) { const res = lks.map((lk) => new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); return j(LIGNES.filter((r) => res.every((re) => re.test(r.id)) && passe(r)).map(forme)); }
    const ors = /[?&]or=\(([^&]*)\)/.exec(u);
    if (ors) { const pats = [...ors[1].matchAll(/id\.like\.([^,)]*)/g)].map((m) => new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); if (pats.length) return j(LIGNES.filter((r) => pats.some((re) => re.test(r.id)) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

const lireEcran = (pg) => pg.evaluate(() => {
  for (const d of document.querySelectorAll('details[data-rp-section], details[data-retraits-sortis]')) d.open = true;
  const pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null');
  const lignes = [...document.querySelectorAll('.vrm-rpf [data-cc-carte]')].map((l) => ({ cle: l.getAttribute('data-cc-carte'), section: (l.closest('[data-rp-section]') || { getAttribute: () => '' }).getAttribute('data-rp-section'), hors: l.hasAttribute('data-hors-compte') }));
  // (11 nov., intégration colis) Plus d'onglet « À retirer » : le nombre est l'entrée « Achats » de la navigation (même publication).
  const onglet = document.querySelector('[data-badge-nav="achats"]');
  const col = document.querySelector('.vrm-rpf');
  const voile = document.querySelector('.maplibregl-cooperative-gesture-screen');
  return { pub, lignes,
    ongletN: onglet ? onglet.getAttribute('data-badge-n') : null,
    ongletTexte: onglet ? onglet.textContent.trim() : '',
    comptes: col ? col.getAttribute('data-retirer-comptes') : null,
    surCarte: col ? col.getAttribute('data-retirer-sur-carte') : null,
    carteEtat: col ? col.getAttribute('data-retirer-carte-etat') : null,
    epingles: [...document.querySelectorAll('[data-relais-epingle]')].map((e) => e.getAttribute('data-relais-n') + ':' + e.getAttribute('data-relais-sorte')),
    double: (document.querySelector('[data-retirer-en-double]') || { getAttribute: () => '0' }).getAttribute('data-retirer-en-double'),
    expl: ((document.querySelector('[data-double-explication]') || {}).textContent || '').trim(),
    verifier: (document.querySelector('[data-retirer-a-verifier]') || { getAttribute: () => '0' }).getAttribute('data-retirer-a-verifier'),
    sortis: [...document.querySelectorAll('[data-sorti]')].map((e) => ({ cle: e.getAttribute('data-sorti'), via: e.getAttribute('data-sorti-via') || '', texte: ((e.querySelector('[data-sorti-texte]') || {}).textContent || '').trim() })),
    verifie: (document.querySelector('[data-retirer-verifie]') || { getAttribute: () => null }).getAttribute('data-retirer-verifie'),
    verifieTexte: ((document.querySelector('[data-retirer-verifie]') || {}).textContent || '').trim(),
    puce: document.querySelectorAll('[data-comptes-a-relire]').length,
    voile: voile ? getComputedStyle(voile).display : 'absent',
    deb: document.documentElement.scrollWidth - window.innerWidth };
});

(async () => {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]) {
      if (VUES && !VUES.includes(nom)) continue;
      const tel = vp.width < 600;
      console.log(`\n— Colis → À retirer, la capture de Julien · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'cat_bord');
      await essaie('retirer', async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 40000 });
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); /* (11 nov., lot DJ3) « À retirer » est en tête d'Achats */ await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
        // La carte : son fond prêt (ou l'échec dit), puis l'indice.
        await pg.waitForFunction(() => { const c = document.querySelector('.vrm-rpf'); return c && (c.getAttribute('data-retirer-sur-carte') === '0' || ['pret', 'ko'].includes(c.getAttribute('data-retirer-carte-etat'))); }, null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const indiceTot = await pg.evaluate(() => { const e = document.querySelector('[data-carte-indice]'); return e ? e.textContent : null; });
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `retraits-frais-${nom}.png`) });
        const m = await lireEcran(pg);
        const J = (o) => JSON.stringify(o);
        // F1
        // P2 : le Chronopost ET la seconde moitié Vinted (un témoin = un carton : plus de témoin libre ⇒ un autre colis).
        dit(m.ongletN === '2' && m.pub && m.pub.total === 2 && m.comptes === '2', 'F1 « Achats · 2 » (navigation) = vrm_colis_retirer (Ma journée, cloche, widget) = la colonne', J({ onglet: m.ongletN, pub: m.pub && m.pub.total, colonne: m.comptes }));
        const d2 = m.lignes.filter((l) => /conv-d2/.test(l.cle));
        dit(d2.length === 1 && !d2[0].hors && d2[0].section !== 'double', 'F1 la seconde moitié de P2 (aucun témoin libre) est À RETIRER, comptée — jamais « peut-être »', J(d2));
        // F2
        dit(m.surCarte === '1', 'F2 la carte ne place QUE le point où un colis compté attend (P2)', `sur la carte : ${m.surCarte}`);
        if (m.carteEtat === 'pret') dit(m.epingles.length === 1 && m.epingles[0] === '2:aretirer', 'F2 une épingle, « 2 », à retirer', J(m.epingles));
        else console.log(`  · fond de carte « ${m.carteEtat} » ici : les épingles ne sont pas comptées`);
        // F3
        dit(m.double === '1', 'F3 UNE moitié « comptée avec » le Chronopost de P2 ; aucune des 18 moitiés des colis retirés', `comptés avec : ${m.double}`);
        const st = await pg.evaluate(() => [...document.querySelectorAll('[data-rp-section="double"] [data-cc-carte]')].map((l) => ((l.querySelector('[data-rp-statut]') || {}).textContent || '').trim()));
        const titreD = await pg.evaluate(() => ((document.querySelector('[data-rp-section="double"] summary') || {}).textContent || '').trim());
        dit(st.length === 1 && st[0] === 'Compté avec le n°…21TS' && !/peut-être/i.test(titreD) && !m.expl, 'F3 la ligne dit UN état (« Compté avec le n°…21TS »), plus de « peut-être » ni de paragraphe', J({ st, titreD, expl: m.expl }));
        dit(m.verifier === '1', 'F3 « À vérifier » = 1 (P3, date limite passée)', `à vérifier : ${m.verifier}`);
        // F4
        const montres = m.lignes.filter((l) => RETIRES.some((k) => l.cle.includes(k)));
        dit(!montres.length, 'F4 aucun colis retiré n’est « à retirer », « à vérifier » ou « en double »', J(montres));
        const dits = RETIRES.filter((k) => m.sortis.some((s) => s.cle.includes(k) || s.texte.includes(k.slice(-4))));
        const prob = m.sortis.filter((s) => s.via === 'doute');
        dit(prob.length === 18 && prob.every((s) => /^Fini avec le n°…\d{4} — Mondial Relay : retiré le \d nov\./.test(s.texte)), 'F4 les 18 moitiés des colis retirés ont UN état, dit : « Fini avec le n°…0011 — Mondial Relay : retiré le 6 nov. »', J(prob.slice(0, 3).map((s) => s.texte)) + ` (${prob.length})`);
        dit(m.sortis.some((s) => /conv-x2/.test(s.cle) || s.via === 'code') && m.sortis.some((s) => s.via === 'commande' || /0401/.test(s.cle)), 'F4 la moitié au même code et celle de la commande sont dites sorties (par leur identité)', J(m.sortis.map((s) => s.cle + '·' + s.via)));
        // F5
        dit(m.verifie === '10' && /il y a 10 min/.test(m.verifieTexte), 'F5 « Suivi vérifié il y a 10 min » (la dernière lecture réussie)', m.verifieTexte);
        // F6
        // (9 nov., lot AG) Plus de puce sur Colis : la ligne de fraîcheur UNIQUE du haut de l'app nomme le compte,
        // son âge et le geste (src/fraicheur.js) ; une voix, pas deux.
        dit(m.puce === 0, 'F6 plus de puce « Relire » sur Colis (une seule voix : la ligne du haut)', String(m.puce));
        await pg.waitForFunction(() => { const e = document.querySelector('[data-fraicheur-unique]'); return e && !['encours', 'charge'].includes(e.getAttribute('data-fraicheur-unique')); }, null, { timeout: 25000 }).catch(() => {});
        const dep = pg.locator('[data-fraicheur-deplier]');
        if (await dep.count()) await dep.first().click();
        await pg.waitForTimeout(200);
        const det = await pg.evaluate(() => { const e = document.querySelector('[data-fraicheur-unique]'); const r = [...document.querySelectorAll('[data-fraicheur-rangee]')].find((x) => /^compte:vinted:/.test(x.getAttribute('data-fraicheur-rangee-cle') || '') && /compte_a/.test(x.textContent)); return { etat: e ? e.getAttribute('data-fraicheur-unique') : null, t: r ? r.textContent : '', bouton: !!(r && r.querySelector('button')) }; });
        dit(det.etat === 'retard' && /compte_a/.test(det.t) && /3 j/.test(det.t) && /vinted\.fr/.test(det.t) && det.bouton, 'F6 la ligne du haut nomme compte_a, son âge (3 j), le geste (vinted.fr connecté sur ce compte) et « Comptes »', J(det).slice(0, 200));
        if (SHOTS) { await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(200); await pg.screenshot({ path: path.join(SHOTS, `retraits-frais-relire-${nom}.png`) }); }
        // F7
        dit(m.voile === 'none' || m.voile === 'absent', 'F7 le voile « Deux doigts… » de MapLibre n’est jamais affiché en travers de la carte', m.voile);
        if (tel && m.carteEtat === 'pret') {
          dit(/Deux doigts/.test(indiceTot || ''), 'F7 au doigt, un indice bref apparaît à l’ouverture de la carte', String(indiceTot));
          await pg.waitForTimeout(3200);
          const apres = await pg.evaluate(() => !!document.querySelector('[data-carte-indice]'));
          dit(!apres, 'F7 …et s’efface seul');
        }
        dit(m.deb <= 1, 'rien ne déborde', `${m.deb}px`);
        if (SHOTS) { await pg.evaluate(() => { const e = document.querySelector('[data-rp-section="double"]'); if (e) e.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `retraits-frais-replis-${nom}.png`) });
          await pg.evaluate(() => { const e = document.querySelector('[data-retraits-sortis]'); if (e) e.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `retraits-frais-sortis-${nom}.png`) }); }
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
