// ════════════════════════════════════════════════════════════════════════════
//  Banc : UN COLIS À RETIRER DIT CE QU'IL CONTIENT TOUT SEUL — ET PLUS AUCUN « RELIER L'ACHAT » (19 nov.)
//  Julien (19 nov.) : « je ne dois pas relier l'achat au colis qui est au point relais, ça doit être automatique […]
//  on doit pouvoir voir il y a quoi dans chaque code de retrait […] on ne doit pas avoir le bouton relier un achat ».
//  Récit et mesure : docs/passation/2026-11-19-colis-achat-auto.md · règle : src/contenuColis.js.
//
//  Ce banc juge les DONNÉES que chaque colis porte à l'écran (le sélecteur `x.contenu` de la carte, rendu en
//  `data-v2-contenu*` sur la passe et `data-rp-contenu*` dans le détail) et l'ABSENCE du bouton — pas le dessin :
//  la disposition sera refaite par « VRM natif » (docs/design/NATIF.md), qui lira le même sélecteur.
//
//  Base SYNTHÉTIQUE (dépôt public : aucun n°, code, titre ni compte réels), deux comptes, six colis :
//   A  Vinted Go · le MÊME n° côté achat (suivi Vinted relevé) et côté e-mail ⇒ relié ;
//   B  Chronopost · le n° du 2e transporteur du trajet, écrit en minuscules avec espaces dans la liste lue ⇒ relié ;
//   C  Mondial Relay · 50 achats au MÊME titre, un seul (le 37e) porte le n° ⇒ lui, sa photo, et aucun autre ;
//   E  Mondial Relay · un LIEN MANUEL ancien (`colis_suivi_*` portant tx/uid) ⇒ toujours lu (le 48e) ;
//   D  Mondial Relay · aucun achat ne porte le n°, compte du colis su ⇒ « Contenu pas encore lu · ouvre vinted.fr
//      sur compte_w », aucun bouton ;
//   D2 Mondial Relay · aucun achat, compte pas su ⇒ « Contenu pas encore lu », aucune raison inventée.
//  Exige (390 tactile et 1512, clair et sombre) :
//   P  sur la passe de chaque colis : l'état, la transaction reliée, le prix payé et le compte (A, B, C, E) ; la photo
//      de l'achat (C : celle du 37e) ; « pas lu » avec sa raison et son compte (D), sans raison (D2) ;
//   L  la même chose dans « Tout le détail des retraits » ;
//   R  le sélecteur « un colis en une rangée » (`rangeeRetrait`, posé en data-* sur chaque colis) : code « lu », titre
//      « achat » seulement quand il est relié, transporteur nommé, date limite LUE (A : le 24) ou ESTIMÉE (D2 : son
//      e-mail ne donne aucune date ⇒ la garde du transporteur, dite estimée) ;
//   N  nulle part un geste « Relier » sur un colis à retirer (ni `data-v2-relier`, ni `data-rp-relier-ouvrir`, ni un
//      bouton dans le bloc du contenu, ni la feuille de choix), et aucune écriture `colis_suivi_*` ;
//   Z  aucune erreur de page.
//  `BANC_PORT`, `BANC_DIST` (le build d'avant ⇒ rouge), `SHOTS=dossier`, `VUES=390-clair,1512-sombre`.
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium, PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
({ chromium } = PW);
const { lancer, estWebkit } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4000 + Math.floor(Math.random() * 900));
const SHOTS = process.env.SHOTS || '';
const MATIN = new Date('2026-11-19T14:00:00+01:00');
const cap = MATIN.toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '333', login: 'compte_v', domain: 'www.vinted.fr', updated_at: cap }, { id: 2, vinted_user_id: '444', login: 'compte_w', domain: 'www.vinted.fr', updated_at: cap }];
const photo = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const achat = (tx, titre, k, prix = '40.00') => ({ transaction_id: tx, conversation_id: `01a1aaaa-bbbb-7ccc-8ddd-${String(tx).padStart(12, '0')}`, title: titre, price: { amount: prix, currency_code: 'EUR' },
  status: 'Colis expédié', date: '2026-11-12T12:06:53Z', photo: { url: photo(k) }, transaction_user_status: 'waiting' });
const A = { tx: 6660001, suivi: '1ZZTE5TQRQRQR', code: '348094', titre: 'Baskets cuir blanches', prix: '40(?:,00)?\\s€' };
const B = { tx: 6660002, suivi: 'XW100000002FR', code: '222222', titre: 'Sandales bleues', prix: '25,50\\s€' };
const TITRE_50 = 'Baskets toile blanche 42';
const CINQUANTE = Array.from({ length: 50 }, (_, i) => achat(7000001 + i, TITRE_50, 101 + i));
const C37 = { tx: 7000037, suivi: '88000037', code: '370037', k: 137 };   // le 37e
const E48 = { tx: 7000048, suivi: '88000048', code: '480048', k: 148 };   // le 48e, relié à la main par le passé
const D = { suivi: '88000099', code: '990099' }, D2 = { suivi: '88000098', code: '980098', sansLimite: true };   // D2 : son e-mail ne donne aucune date limite
const mr = (x, lieu, compte) => ({ id: `email_track_mondialrelay_${x.suivi}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: x.suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${x.suivi} est disponible dans votre Point Relais`,
  receivedAt: '2026-11-18T08:00:00.000Z', emailAt: '2026-11-18T08:00:00.000Z', arriveLe: '2026-11-18T08:00:00.000Z', code: x.code, lieu, ...(x.sansLimite ? {} : { limite: '2026-11-25' }), consigne: false, ...(compte ? { account: compte } : {}) } });
const suiviVinted = (tx, d) => ({ id: `harvest_333_suivi_${tx}`, data: { n: 1, v: 1, tx: String(tx), etapes: [{ t: 'Disponible pour retrait', at: '2026-11-18T07:01:16.000Z', code: 'available_for_pickup' }], source: 'journey',
  dernier: { t: 'Disponible pour retrait', at: '2026-11-18T07:01:16.000Z', code: 'available_for_pickup' }, capturedAt: '2026-11-18T21:38:18.770Z', transporteur: null, ...d } });
const BASE = () => [
  { id: 'main', data: {} },
  { id: 'harvest_333_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [achat(A.tx, A.titre, 1, '40.00'), achat(B.tx, B.titre, 2, '25.50'), ...CINQUANTE] } } },
  { id: 'harvest_444_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_333_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_444_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: {} },
  suiviVinted(A.tx, { suivi: A.suivi }),
  // B : un trajet à deux transporteurs — la liste lue (5.403) porte le 2e n°, écrit autrement (minuscules, espaces, tiret).
  suiviVinted(B.tx, { suivi: 'BRT0000000001', suivisVinted: 'BRT0000000001,xw 1000-00002 fr', transporteursVinted: 'BRT-SHOP-IT,SHOP2SHOP', suivisLusAt: '2026-11-18T21:38:18.770Z' }),
  suiviVinted(C37.tx, { suivi: C37.suivi, transporteur: 'MONDIAL' }),
  // E : le lien posé à la main (la ligne écrite par l'ancien « Relier ») — aucune ligne de suivi Vinted pour cet achat.
  { id: `colis_suivi_mondialrelay_${E48.suivi}`, data: { suivi: E48.suivi, transporteur: 'mondialrelay', tx: String(E48.tx), uid: '333', relieDepuis: 'retrait', at: '2026-11-17T10:00:00.000Z' } },
  { id: `email_track_vinted_${A.suivi}`, data: { code: A.code, lieu: 'Consigne Exemple, 13 Rue Exemple, 56000 Ville-Exemple', type: 'suivi', suivi: A.suivi, limite: '2026-11-24', status: 'available', account: 'compte_v', carrier: 'vinted',
    emailAt: '2026-11-18T09:01:34.000Z', arriveLe: '2026-11-18T09:01:34.000Z', subject: `Ton colis t'attend au point Vinted Go #${A.suivi}`, receivedAt: '2026-11-18T09:02:33.736Z', statusLabel: 'Arrivé au point de retrait' } },
  { id: `email_track_chronopost_${B.suivi}`, data: { code: B.code, lieu: 'PRESSE EXEMPLE, 2 PLACE EXEMPLE, 35000 RENNES', type: 'suivi', suivi: B.suivi, limite: '2026-11-24', status: 'available', account: 'compte_v', carrier: 'chronopost',
    emailAt: '2026-11-18T10:00:00.000Z', arriveLe: '2026-11-18T10:00:00.000Z', subject: 'Votre colis VINTED est arrivé en relais Pickup', receivedAt: '2026-11-18T10:01:00.000Z', statusLabel: 'Arrivé au point de retrait' } },
  mr(C37, 'TABAC EXEMPLE, 12 RUE EXEMPLE, 35000 RENNES', 'compte_v'),
  mr(E48, 'TABAC EXEMPLE, 12 RUE EXEMPLE, 35000 RENNES', 'compte_v'),
  mr(D, 'EPICERIE EXEMPLE, 4 RUE EXEMPLE, 35400 SAINT-EXEMPLE', 'compte_w'),
  mr(D2, 'EPICERIE EXEMPLE, 4 RUE EXEMPLE, 35400 SAINT-EXEMPLE', ''),
];
let LIGNES = BASE();
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 420) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const metaDe = (d) => Object.fromEntries(Object.entries(d || {}).filter(([, v]) => v !== null && typeof v !== 'object' && String(v).length <= 600));
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'meta') { out[alias] = metaDe(row.data); continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^(?:data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const PHOTO_SVG = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#${(k * 2654435761 >>> 8).toString(16).padStart(6, '0').slice(0, 6)}"/></svg>`;
const ouvrir = async (b, vp, sombre) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: MATIN });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_design_v2', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    if (/nominatim\.openstreetmap\.org/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  // (Playwright prend la DERNIÈRE route posée en premier.)
  await pg.route(/images1\.vinted\.net\//, (r) => { const k = Number((/\/x(\d+)\.jpeg/.exec(r.request().url()) || [])[1]) || 1; return r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: PHOTO_SVG(k) }); });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      // Un lien écrit (`colis_suivi_*`) serait une faute ici : noté (N exige qu'il n'y en ait aucun).
      try { const corps = JSON.parse(req.postData() || 'null'); for (const row of (Array.isArray(corps) ? corps : [corps])) if (row && /^colis_suivi_/.test(String(row.id || ''))) ecrits.push(row.id); } catch (_) {}
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, ecrits };
};
const shot = async (pg, k, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `colis-achat-auto-${k}-${nom}.png`), fullPage: true }).catch(() => {}); };

// Ce que la PASSE d'un colis porte (par son code de retrait), dans l'écran Achats visible.
const lirePasses = () => {
  const vis = (e) => !!e && e.getClientRects().length > 0;
  const faces = [...document.querySelectorAll('[data-v2-face]')].filter((f) => vis(f.closest('[data-v2-bloc="passes"]')));
  const out = {};
  for (const f of faces) {
    const c = f.querySelector('[data-v2-contenu]'); const im = f.querySelector('.v2-passe-photo img');
    out[f.getAttribute('data-v2-code') || ''] = { etat: c ? c.getAttribute('data-v2-contenu') : null, tx: c ? c.getAttribute('data-v2-contenu-tx') : null, raison: c ? c.getAttribute('data-v2-contenu-raison') : null, compte: c ? c.getAttribute('data-v2-contenu-compte') : null,
      txt: c ? c.textContent.replace(/\s+/g, ' ').trim() : '', toucher: c ? (c.querySelectorAll('button, a, [role="button"]').length + (c.closest('button:not([data-v2-en-grand]), a') ? 1 : 0)) : 0,   // (19 nov.) la ligne entière ouvre le CODE en grand : ce n'est pas un geste sur le contenu
      titre: ((f.querySelector('.v2-passe-titre') || {}).textContent || '').replace(/\s+/g, ' ').trim(), photo: !!f.querySelector('[data-v2-photo-article]'), src: im ? (im.currentSrc || im.getAttribute('src') || '') : '',
      rg: { codeEtat: f.getAttribute('data-v2-code-etat'), qr: f.getAttribute('data-v2-qr-dispo'), limJour: f.getAttribute('data-v2-limite-jour'), limSource: f.getAttribute('data-v2-limite-source'), titreDe: f.getAttribute('data-v2-titre-de'), transp: f.getAttribute('data-v2-transporteur') },
      relier: f.querySelectorAll('[data-v2-relier]').length, boutons: [...f.querySelectorAll('button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()) };
  }
  return { n: faces.length, par: out, relierPartout: document.querySelectorAll('[data-v2-relier]').length };
};
// Ce que la LIGNE du détail porte (par son code de retrait).
const lireLignes = () => {
  const lignes = [...document.querySelectorAll('[data-v2-detail-retraits] .vrm-rpf-ligne[data-cc-carte], .vrm-tache[data-tache="achats"] .vrm-rpf-ligne[data-cc-carte]')].filter((l) => l.getClientRects().length > 0);
  const out = {};
  for (const l of lignes) {
    const code = (l.querySelector('[data-code-retrait]') || { getAttribute: () => '' }).getAttribute('data-code-retrait'); if (!code || out[code]) continue;
    const c = l.querySelector('[data-rp-contenu]'); const im = l.querySelector('.vrm-rpf-vignette img');
    out[code] = { etat: c ? c.getAttribute('data-rp-contenu') : null, tx: c ? c.getAttribute('data-rp-contenu-tx') : null, raison: c ? c.getAttribute('data-rp-contenu-raison') : null, compte: c ? c.getAttribute('data-rp-contenu-compte') : null,
      txt: c ? c.textContent.replace(/\s+/g, ' ').trim() : '', toucher: c ? c.querySelectorAll('button, a, [role="button"]').length : 0,
      titre: ((l.querySelector('[data-rp-titre]') || {}).textContent || '').replace(/\s+/g, ' ').trim(), photo: !l.querySelector('.vrm-rpf-vignette[data-sans-photo]'), src: im ? (im.currentSrc || im.getAttribute('src') || '') : '',
      relier: l.querySelectorAll('[data-rp-relier-ouvrir], [data-rp-relier], [data-rp-meme-relier]').length };
  }
  return { n: lignes.length, par: out, relierPartout: document.querySelectorAll('[data-rp-relier-ouvrir], [data-rp-relier], [data-rp-meme-relier]').length, feuille: document.querySelectorAll('[data-relier-colis]').length,
    motRelier: [...document.querySelectorAll('[data-v2-achats-retirer] button, [data-v2-detail-retraits] button')].filter((b) => b.getClientRects().length > 0 && /\breli(?:er|e)\b/i.test(b.textContent || '')).map((b) => b.textContent.trim().slice(0, 40)) };
};
const juger = (nom, ou, v, { prixSepare = true } = {}) => {
  const p = v.par || {};
  const relie = (x, cible, prix, quoi) => { const c = p[x.code] || {}; dit(c.etat === 'relie' && c.tx === String(cible) && new RegExp(prix).test(c.txt) && /compte_v/.test(c.txt) && c.compte === 'compte_v' && c.toucher === 0 && c.relier === 0, `${nom} : ${ou} ${quoi}`, JSON.stringify(c)); return c; };
  const a = relie(A, A.tx, A.prix, 'A — le même n° des deux côtés ⇒ l’achat, son prix payé (40,00 €), son compte');
  dit(/Baskets cuir blanches/.test(a.titre || '') && a.photo, `${nom} : ${ou} A — le titre et la photo de l’achat`, JSON.stringify({ titre: a.titre, photo: a.photo }));
  relie(B, B.tx, B.prix, 'B — le n° du 2e transporteur, écrit autrement dans la liste lue ⇒ l’achat (25,50 €)');
  const c37 = relie(C37, C37.tx, A.prix, 'C — 50 achats au même titre : le 37e, celui qui porte le n°');
  dit(c37.photo && (!c37.src || /x137\.jpeg/.test(c37.src)), `${nom} : ${ou} C — la photo est celle du 37e (x137), pas celle d’un des 49 autres`, c37.src);
  const e48 = relie(E48, E48.tx, A.prix, 'E — le lien posé à la main par le passé est toujours lu (le 48e)');
  dit(e48.photo && (!e48.src || /x148\.jpeg/.test(e48.src)), `${nom} : ${ou} E — sa photo (x148)`, e48.src);
  const d = p[D.code] || {};
  dit(d.etat === 'pas-lu' && d.raison === 'ouvrir-vinted' && d.compte === 'compte_w' && !d.tx && /Contenu pas encore lu/.test(d.txt) && /vinted\.fr/.test(d.txt) && /compte_w/.test(d.txt) && d.toucher === 0 && d.relier === 0, `${nom} : ${ou} D — aucun n° côté achat ⇒ « Contenu pas encore lu · ouvre vinted.fr sur compte_w », rien à toucher`, JSON.stringify(d));
  dit(!new RegExp(TITRE_50).test(d.titre || '') && !/Baskets cuir|Sandales/.test(d.titre || '') && !/x\d+\.jpeg/.test(d.src || ''), `${nom} : ${ou} D — ni titre ni photo d’achat inventés`, JSON.stringify({ titre: d.titre, src: d.src }));
  const d2 = p[D2.code] || {};
  dit(d2.etat === 'pas-lu' && !d2.raison && !d2.compte && d2.txt === 'Contenu pas encore lu' && d2.toucher === 0, `${nom} : ${ou} D2 — compte du colis pas su ⇒ « Contenu pas encore lu », aucune raison inventée`, JSON.stringify(d2));
};

(async () => {
  const b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    const VUES = [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]
      .filter(([, , n]) => !process.env.VUES || process.env.VUES.split(',').includes(n));
    for (const [vp, sombre, nom] of VUES) {
      console.log(`\n— Achats → À retirer · ${nom}`);
      LIGNES = BASE();
      const { ctx, pg, errs, ecrits } = await ouvrir(b, vp, sombre);
      await essaie(nom, async () => {
        const six = () => pg.waitForFunction(() => { const f = [...document.querySelectorAll('[data-v2-face]')].filter((x) => x.getClientRects().length > 0); return f.length >= 6; }, null, { timeout: 60000 });
        await six().catch(() => {}); await pg.waitForTimeout(1500);
        // Les photos des achats reliés arrivent après la liste : attendues, sans exiger (le contrôle le dira).
        await pg.waitForFunction(() => [...document.querySelectorAll('[data-v2-face] [data-v2-contenu="relie"]')].length >= 4, null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(800);
        await pg.evaluate(() => { const f = [...document.querySelectorAll('[data-v2-bloc="passes"]')].find((x) => x.getClientRects().length > 0); if (f) f.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(400);
        await shot(pg, 'passes', nom);
        await pg.evaluate((code) => { const f = [...document.querySelectorAll(`[data-v2-face][data-v2-code="${code}"]`)].find((x) => x.getClientRects().length > 0); const p = f && f.closest('[data-v2-passe]'); if (p) p.scrollIntoView({ block: 'center' }); if (f && f.parentElement) f.parentElement.scrollLeft = f.offsetLeft - f.parentElement.offsetLeft; }, D.code);
        await pg.waitForTimeout(500);
        await shot(pg, 'pas-lu', nom);
        const P = await pg.evaluate(lirePasses);
        dit(P.n === 6, `${nom} : P les six colis ont leur passe`, `${P.n} · ${Object.keys(P.par).join(',')}`);
        juger(nom, 'P (passe)', P);
        { const g = (x) => (P.par[x.code] || {}).rg || {};
          dit(g(A).codeEtat === 'lu' && g(A).titreDe === 'achat' && g(A).limSource === 'lue' && g(A).limJour === '2026-11-24' && !!g(A).transp && g(B).transp === 'chronopost' && g(C37).transp === 'mondialrelay' && g(C37).titreDe === 'achat' && g(E48).titreDe === 'achat', `${nom} : R un colis relié en une rangée — code lu, titre « achat », transporteur nommé, date limite LUE (24/11)`, JSON.stringify({ A: g(A), B: g(B), C: g(C37) }));
          dit(g(D).codeEtat === 'lu' && g(D).titreDe === '' && g(D).limSource === 'lue' && g(D).limJour === '2026-11-25' && g(D).qr === '0', `${nom} : R un colis pas relié — aucun titre d’achat, son code et sa date limite lus quand même`, JSON.stringify(g(D)));
          dit(g(D2).limSource === 'estimee' && /^2026-11-\d\d$/.test(g(D2).limJour || '') && g(D2).titreDe === '', `${nom} : R sans date dans l’e-mail, la limite est ESTIMÉE (garde du transporteur) et dite estimée`, JSON.stringify(g(D2))); }
        dit(P.relierPartout === 0 && Object.values(P.par).every((c) => !c.boutons.some((t) => /\breli/i.test(t))), `${nom} : N aucun « Relier l’achat » sur une passe`, JSON.stringify({ n: P.relierPartout, boutons: [...new Set(Object.values(P.par).flatMap((c) => c.boutons))] }));
        // Le détail : « Tout le détail des retraits » (replié sous les passes).
        await pg.evaluate(() => { const d = document.querySelector('[data-v2-detail-retraits]'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } });
        await pg.waitForFunction(() => [...document.querySelectorAll('[data-v2-detail-retraits] .vrm-rpf-ligne[data-cc-carte]')].filter((l) => l.getClientRects().length > 0).length >= 6, null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(800);
        await shot(pg, 'detail', nom);
        const L = await pg.evaluate(lireLignes);
        dit(L.n >= 6, `${nom} : L les six colis ont leur ligne dans le détail`, `${L.n} · ${Object.keys(L.par).join(',')}`);
        juger(nom, 'L (détail)', L);
        dit(L.relierPartout === 0 && L.feuille === 0 && !L.motRelier.length, `${nom} : N aucun geste « Relier » dans le détail, aucune feuille de choix`, JSON.stringify({ n: L.relierPartout, feuille: L.feuille, mots: L.motRelier }));
        dit(!ecrits.length, `${nom} : N aucun lien écrit (` + '`colis_suivi_*`' + `) : rien ne relie à la place d’une identité`, ecrits.join(','));
      });
      dit(!errs.length, `${nom} : Z aucune erreur de page`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  if (!ok && !ko) { ko++; console.log('  ❌ aucune vue jugée (VUES=' + (process.env.VUES || '') + ')'); }
  console.log(`\n${ko ? '❌' : '✅'} colis-achat-auto : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ colis-achat-auto : arrêt inattendu — ' + String(e && e.message).slice(0, 200)); try { srv.close(); } catch (_) {} process.exit(1); });
