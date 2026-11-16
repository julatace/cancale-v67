#!/usr/bin/env node
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT (16 nov., lot transporteurs-suivi) — UN COLIS VENDU PAR MONDIAL RELAY EST LU CHEZ LE TRANSPORTEUR
//  Avant : « Mondial Relay ne se lit pas pour un colis vendu » — sa route `_mvc` exige un code postal, et
//  VRM ne connaissait que celui de SES points (achats). Maintenant le code postal est LU SUR SON ÉTIQUETTE
//  (le PDF du bordereau de CETTE transaction : une identité, §5), essayé un par un, et gardé seulement si
//  Mondial Relay renvoie l'ÉCHO de ce n° à ce code postal. Ce contrôle EXÉCUTE le vrai passage
//  (api/_lib/transporteurs-lecture.js `passageTransporteurs` ⇒ `passageDeparts`) sur une fausse base
//  PostgREST, un VRAI PDF fabriqué par pdf-lib (lu par le vrai `texteDuPdf`) et un faux mondialrelay.fr
//  à la forme MESURÉE le 24 oct. (le fragment `_mvc`, l'écho `numeroExpedition` / `CodePostal`).
//  Aucune requête réelle : tout appel hors de la fausse base passe par le faux transporteur, compté.
//   M1 l'étiquette : seuls « 5 chiffres + ville » (jamais le code-barres, jamais le siège 59650) ;
//   M2 1er passage : le PDF lu UNE fois, le 1er code postal refusé par Mondial Relay ⇒ noté, aucun échec ;
//   M3 2e passage : le 2e code postal ⇒ ÉCHO ⇒ prouvé, pris en charge, daté du 1er évènement de route ;
//   M4 jamais une ligne `transp_` (le colis de l'ACHETEUR n'est jamais « à retirer » chez lui) ;
//   M5 le texte du PDF n'est écrit nulle part (seuls les codes postaux) ;
//   M6 une étiquette sans code postal ⇒ AUCUNE requête, dit une fois, plus jamais relue ;
//   M7 un n° de 8 chiffres sans Mondial Relay nommé ⇒ jamais lu (jamais par la forme) ;
//   M8 un n° qui est aussi un ACHAT ⇒ ambigu, jamais lu comme départ ;
//   M9 l'app relit la ligne : « Mondial Relay l'a pris en charge le … » ; sans code postal, la phrase dite.
//  `--prouve` : chaque mutation doit rendre ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');
const MUTATIONS = {
  'code-barres-pris-pour-cp': [['api/_lib/depart-colis.js', "(?=[A-Za-zÀ-ÿ'’-]{2,})/g)) {", ")/g)) {"]],
  'siege-essaye': [['api/_lib/depart-colis.js', "    if (m[1] === CP_SIEGE_MR || out.includes(m[1])) continue;", '    if (out.includes(m[1])) continue;']],
  'echo-ignore': [['api/_lib/transporteurs-lecture.js', "      if (it.carrier === 'mondialrelay') lu = T.resultatMondialRelay(", "      if (false) lu = T.resultatMondialRelay("]],
  'cp-refuse-reessaye': [['api/_lib/depart-colis.js', "  const c = listeCp(t.cpsPdf).find((x) => !refuses.includes(x));", '  const c = listeCp(t.cpsPdf)[0];']],
  'mr-par-la-forme': [['api/_lib/depart-colis.js', "  if (/^VGS\\d{13}$/.test(n)) return 'vinted';", "  if (/^VGS\\d{13}$/.test(n)) return 'vinted';\n  if (/^\\d{8}$/.test(n)) return 'mondialrelay';"]],
  'sans-cp-requete-quand-meme': [['api/_lib/transporteurs-lecture.js', "      const c = D.cpDepartMr(vu);\n      if (!c) {", "      const c = D.cpDepartMr(vu) || { cp: '00000', source: 'devine' };\n      if (!c) {"]],
  'mr-pas-lu-en-vente': [['api/_lib/depart-colis.js', "export const DEPART_CARRIERS = ['chronopost', 'vinted', 'mondialrelay', 'colissimo', 'ups'];", "export const DEPART_CARRIERS = ['chronopost', 'vinted', 'colissimo', 'ups'];"]],
  'prise-datee-du-dernier': [['api/_lib/depart-colis.js', "(carrier === 'mondialrelay' ? ['route', 'disponible', 'livre'].includes((classeMr(x.libelle) || {}).c)", "(carrier === 'mondialrelay' ? false"]],
  'texte-garde': [['api/_lib/transporteurs-lecture.js', "          o.cpsPdf = D.listeCp(e.cps).join(','); o.cpsLu = new Date().toISOString();", "          o.cpsPdf = D.listeCp(e.cps).join(','); o.cpsLu = new Date().toISOString(); o.texte = String(globalThis.__texteEtiquette || '');"], ['api/_lib/transporteurs-lecture.js', "  return { lu: true, cps: t == null ? [] : D.cpsDeLEtiquette(t) };", "  globalThis.__texteEtiquette = t;\n  return { lu: true, cps: t == null ? [] : D.cpsDeLEtiquette(t) };"]],
  'phrase-sans-cp-oubliee': [['src/App.jsx', "    if (estMr && dep && dep.carrier === 'mondialrelay' && mrSansCodePostal(dep)) return trT('suiviVente.mrSansCp');\n", '']],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 3).join(' ').slice(0, 300)); } };
const importer = (p) => import('file://' + path.join(R, p));
const J = (x) => JSON.stringify(x);

const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
for (const k of ['LAPOSTE_OKAPI_KEY', 'UPS_CLIENT_ID', 'UPS_CLIENT_SECRET']) delete process.env[k];
try { const webpush = require(path.join(R, 'node_modules', 'web-push')); webpush.setVapidDetails = () => {}; webpush.sendNotification = async () => ({ statusCode: 201 }); } catch (_) {}

// ── Le fragment `_mvc` de Mondial Relay, à la forme MESURÉE (audit-mondialrelay-serveur) ──
const ent = (s) => s.replace(/é/g, '&#233;').replace(/è/g, '&#232;').replace(/à/g, '&#224;').replace(/'/g, '&#39;');
const ETAPES = ["Colis en préparation chez l'expéditeur", 'Colis remis à Mondial Relay', "Colis sur l'agence de livraison", 'Colis disponible au point de retrait', 'Colis livré au destinataire'];
function fragment({ n, cp, k = 3, jours = [] }) {
  const ul = `<ul class="timeline suivi center-element"> ${ETAPES.map((e, i) => `<li${i < k ? ' class="validate"' : ''}> <p>${ent(e)}</p> </li>`).join(' ')} </ul>`;
  const blocs = jours.map(([date, evs]) => `<div class="infos-account"> <div class="bloc mb-0 infos-colis suivre pt10"> <div class="col-xs-4 col-sm-2 col-md-2 col-lg-2 f-left"> <p>${date}</p> </div> <div class="col-xs-7 f-left"> <h5>${ent(evs[0] ? evs[0][1] : '')}</h5> </div> </div> <div class="bloc bg-white detail-infos" style=""> ${evs.map(([h, l]) => `<div class="step-suivi"> <div class="col-xs-4 col-sm-3 col-md-3 "> <p class="center">${h}</p> </div> <div class="col-xs-8 col-sm-9 col-md-9"> <p>${ent(l)}</p> </div> </div>`).join(' ')} </div> </div>`).join(' ');
  const scripts = `<script type="text/javascript"> var culture = 'fr-FR'; var numeroExpedition = '${n}'; </script> <script> window.dataLayer = window.dataLayer || [] dataLayer.push({ 'event': 'Suivi de Colis', 'CodePostal' : '${cp}', 'Pays' : 'FR' }); </script>`;
  return `<div class="grid"> <div class="row"> ${ul} </div> <div class="row"> ${blocs} </div> </div> ${scripts}`;
}
const reponseMvc = (frag) => JSON.stringify({ Success: true, ModelState: [], Message: frag, Action: 'ReplaceDiv', Data: false });
const PAS_DE_COLIS = JSON.stringify({ Success: false, ModelState: [{ Item1: '', Item2: "Il semble qu'il y ait une erreur de saisie. Merci de vérifier vos informations." }], Message: '<ul class="erreurs"><li class="Error">Il semble qu&#39;il y ait une erreur de saisie. Merci de v&#233;rifier vos informations.</li></ul>', Action: null, Data: null });
const J10 = ['10/11/2026', [['18:02', "Colis en préparation chez l'expéditeur"]]];
const J11 = ['11/11/2026', [['17:33', 'Colis pris en charge en Point Relais']]];
const J12 = ['12/11/2026', [['07:32', 'Colis en route vers le point de livraison']]];

// ── Une fausse base à état, à la forme de PostgREST ──────────────────────────
const base = new Map();
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
const metaDe = (d) => { const m = {}; if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) { if (v == null || typeof v === 'object') continue; const s = String(v); if (s.length <= 600) m[k] = s; } if (d && d.pdfB64) m._pdf = 'true'; return m; };
const valeur = (l, k) => {
  if (k === 'id') return l.id; if (k === 'owner') return l.owner;
  if (k.startsWith('meta->>')) return metaDe(l.data)[k.slice(7)];
  if (k.startsWith('data->>') || k.startsWith('data->')) { const v = chemin(l.data, k.replace(/^data(->>|->)/, '')); return v == null ? undefined : (typeof v === 'object' ? JSON.stringify(v) : String(v)); }
  return undefined;
};
const teste = (x, op) => {
  const i = op.indexOf('.'); const o = op.slice(0, i), v = op.slice(i + 1);
  if (o === 'eq') return x === v;
  if (o === 'like' || o === 'ilike') { const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', o === 'ilike' ? 'i' : ''); return x != null && re.test(x); }
  if (o === 'in') return v.replace(/^\(|\)$/g, '').split(',').map((y) => y.replace(/^"|"$/g, '')).includes(x);
  if (o === 'is') return v === 'null' ? x == null : true;
  return true;
};
const filtrer = (u) => {
  const conds = [];
  for (const [k, v] of u.searchParams) { if (['select', 'on_conflict', 'limit', 'order', 'offset'].includes(k)) continue; conds.push((l) => teste(valeur(l, k), v)); }
  return [...base.entries()].map(([cle, d]) => { const i = cle.indexOf('|'); return { owner: cle.slice(0, i), id: cle.slice(i + 1), data: d }; }).filter((l) => conds.every((c) => c(l)));
};
const projeter = (l, sel) => {
  if (!sel || sel === '*') return { owner: l.owner, id: l.id, data: l.data };
  const o = {};
  for (const part of sel.split(',')) {
    const [alias, ch] = part.includes(':') ? part.split(/:(.+)/) : [part.split(/->>|->/).pop(), part];
    if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
    if (ch === 'data') { o[alias] = l.data; continue; }
    if (ch.startsWith('meta->>')) { const v = metaDe(l.data)[ch.slice(7)]; o[alias] = v == null ? null : v; continue; }
    const v = chemin(l.data, ch.replace(/^data(->>|->)/, ''));
    o[alias] = v === undefined ? null : (/->>[^>]*$/.test(ch) && v != null && typeof v !== 'object' ? String(v) : v);
  }
  return o;
};
const entete = (h, k) => { for (const [x, v] of Object.entries(h || {})) if (x.toLowerCase() === k.toLowerCase()) return String(v); return ''; };
const appels = [];
let mr = () => null;   // (URL) ⇒ { status, body } | null
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (!/supabase\.co$/.test(u.hostname)) {
    appels.push({ host: u.hostname, path: u.pathname, n: u.searchParams.get('NumeroExpedition'), cp: u.searchParams.get('CodePostal') });
    const r = u.hostname === 'www.mondialrelay.fr' ? mr(u) : null;
    if (!r) throw new TypeError('fetch failed');
    return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    const prefer = entete(h, 'Prefer');
    const faits = [];
    for (const r of JSON.parse(opts.body || '[]')) { const cle = `${r.owner || A}|${r.id}`; if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue; base.set(cle, r.data); faits.push({ id: r.id }); }
    return /return=representation/.test(prefer) ? rep(faits, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') { const corps = JSON.parse(opts.body || '{}'); const t = filtrer(u); for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data); return rep(t.map((l) => ({ id: l.id }))); }
  if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response(null, { status: 204 }); }
  const sel = u.searchParams.get('select') || '';
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};

// ── Une étiquette Mondial Relay INVENTÉE (vrai PDF, texte simple) ────────────
const POINT = 'TABAC DU PORT FICTIF';
async function etiquette(lignes) {
  const { PDFDocument, StandardFonts } = require(path.join(R, 'node_modules', 'pdf-lib'));
  const d = await PDFDocument.create();
  const p = d.addPage([420, 595]);
  const f = await d.embedFont(StandardFonts.Helvetica);
  lignes.forEach((t, i) => p.drawText(t, { x: 20, y: 560 - i * 18, size: 10, font: f }));
  return Buffer.from(await d.save()).toString('base64');
}
const LIGNES_OK = ['EXPEDITEUR : VENDEUR TEST', '1 RUE DU QUAI', '35260 CANCALE', 'DESTINATAIRE : ACHETEUR TEST', `POINT RELAIS : ${POINT}`, '12 RUE IMAGINAIRE', '56000 VANNES', '56300000041234567890123456', 'Mondial Relay SAS 59650 VILLENEUVE D ASCQ'];
const LIGNES_SANS_CP = ['EXPEDITEUR : VENDEUR TEST', 'DESTINATAIRE : ACHETEUR TEST', '56300000071234567890123456'];

(async () => {
  let D = null, L = null, O = null, T = null;
  await essaie('les modules', async () => {
    D = await importer('api/_lib/depart-colis.js');
    L = await importer('api/_lib/transporteurs-lecture.js');
    O = await importer('api/_lib/owner.js');
    T = await importer('api/_lib/transporteurs.js');
    dit(typeof D.cpsDeLEtiquette === 'function' && typeof D.cpDepartMr === 'function' && typeof L.passageTransporteurs === 'function', 'les règles existent (cpsDeLEtiquette, cpDepartMr, passage)');
  });
  if (!D || !L || !O || !T) { console.log(`\n❌ audit-suivi-ventes-mr : ${ko} rouge(s)`); process.exit(1); }
  if (typeof L._reglerPourBanc === 'function') L._reglerPourBanc({ ecartMs: 0 });
  const NOW = Date.now(), H = 3600000;
  const N1 = '30000004', N2 = '30000007', N3 = '30000008', N4 = '30000009';
  const TX1 = '9100000001', TX2 = '9100000002', TX3 = '9100000003', TX4 = '9100000004';

  await essaie('M1 l’étiquette', async () => {
    const t = LIGNES_OK.join('\n');
    const cps = D.cpsDeLEtiquette(t);
    dit(J(cps) === J(['35260', '56000']), 'M1 seuls « 5 chiffres + ville », dans l’ordre de l’étiquette : jamais le code-barres, jamais le siège 59650', J(cps));
    dit(J(D.cpsDeLEtiquette(LIGNES_SANS_CP.join('\n'))) === '[]' && J(D.cpsDeLEtiquette('')) === '[]', 'M1b une étiquette sans « code postal + ville » ⇒ aucun (rien deviné)');
  });

  const bord = async (tx, suivi, lignes, transporteur = 'mondialrelay') => base.set(`${A}|email_bord_${tx}`, { type: 'bordereau', transaction: tx, suivi, transporteur, receivedAt: new Date(NOW - 20 * H).toISOString(), pdfB64: lignes ? await etiquette(lignes) : null });
  const passage = (maintenant) => O.contexteVendeur.run({ owner: A }, () => L.passageTransporteurs({ max: 6, budgetMs: 20000, maxDeparts: 6, ...(maintenant ? { maintenant } : {}) }));
  const ligneD = (n) => base.get(`${A}|depart_mondialrelay_${n}`) || null;
  const accepte = (n, cpBon) => (u) => {
    if (u.pathname !== '/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive') return null;
    const num = u.searchParams.get('NumeroExpedition'), cp = u.searchParams.get('CodePostal');
    if (num !== n || cp !== cpBon) return { status: 200, body: PAS_DE_COLIS };
    return { status: 200, body: reponseMvc(fragment({ n, cp, k: 3, jours: [J12, J11, J10] })) };
  };

  await essaie('M2–M5 le passage', async () => {
    base.clear(); appels.length = 0;
    base.set(`${A}|main`, { vrm_colis_collected: [] });
    await bord(TX1, N1, LIGNES_OK);
    mr = accepte(N1, '56000');
    await passage();
    const l1 = ligneD(N1);
    const r1 = appels.filter((x) => x.host === 'www.mondialrelay.fr');
    dit(l1 && l1.cpsPdf === '35260,56000' && l1.cpsLu && r1.length === 1 && r1[0].cp === '35260' && r1[0].n === N1, 'M2 1er passage : l’étiquette lue UNE fois (35260, 56000), une requête au 1er code postal', J({ cps: l1 && l1.cpsPdf, r: r1 }));
    dit(l1 && l1.essaiRes === 'cp-inconnu' && l1.cpsRefuses === '35260' && !l1.cp && !l1.priseAt && !l1.fini, 'M2b refusé par Mondial Relay ⇒ CE code postal noté refusé, rien de prouvé, le n° pas fermé', J(l1 && { r: l1.essaiRes, ref: l1.cpsRefuses, cp: l1.cp }));
    await passage(NOW + 31 * 60000);
    const l2 = ligneD(N1);
    const r2 = appels.filter((x) => x.host === 'www.mondialrelay.fr');
    dit(r2.length === 2 && r2[1].cp === '56000', 'M3 2e passage : le code postal suivant de l’étiquette (jamais le refusé)', J(r2.map((x) => x.cp)));
    const prise = Date.parse(l2 && l2.priseAt || '');
    dit(l2 && l2.essaiRes === 'ok' && l2.cp === '56000' && l2.etat === 'en_route' && Number.isFinite(prise) && new Date(prise).toISOString().startsWith('2026-11-11T16:33'), 'M3b l’ÉCHO prouve 56000 : pris en charge, daté du 1er évènement de route (11 nov. 17:33, pas la préparation ni le dernier)', J(l2 && { r: l2.essaiRes, cp: l2.cp, e: l2.etat, p: l2.priseAt }));
    dit(![...base.keys()].some((k) => /\|transp_/.test(k) && !/transp_pause/.test(k)), 'M4 jamais une ligne `transp_` : le colis de l’acheteur n’est jamais « à retirer » chez lui, rien ne sonne', J([...base.keys()].filter((k) => /transp_/.test(k))));
    const tout = JSON.stringify([...base.entries()].filter(([k]) => !/email_bord_/.test(k)));
    dit(!tout.includes(POINT) && !tout.includes('ACHETEUR TEST') && !tout.includes('VANNES'), 'M5 le texte de l’étiquette n’est écrit nulle part (seuls les codes postaux)');
    const avant = appels.length;
    await passage(NOW + 40 * 60000);
    dit(appels.length === avant, 'M3c prouvé et lu il y a moins de 6 h : pas relu au passage suivant', `${appels.length - avant} requête(s)`);
  });

  await essaie('M6 sans code postal', async () => {
    base.clear(); appels.length = 0;
    base.set(`${A}|main`, { vrm_colis_collected: [] });
    await bord(TX2, N2, LIGNES_SANS_CP);
    mr = accepte(N2, '56000');
    const r = await passage();
    const l = ligneD(N2);
    dit(appels.filter((x) => x.host === 'www.mondialrelay.fr').length === 0 && l && l.essaiRes === 'cp-inconnu' && l.cpsLu && !l.cpsPdf, 'M6 étiquette sans code postal ⇒ AUCUNE requête à Mondial Relay ; la ligne le dit', J({ appels: appels.map((x) => x.host), l: l && { r: l.essaiRes, cps: l.cpsPdf } }));
    await passage(NOW + 7 * H);
    await passage(NOW + 30 * H);
    dit(appels.filter((x) => x.host === 'www.mondialrelay.fr').length === 0, 'M6b ni plus tard (rien à essayer : jamais un code postal deviné)', J(appels));
    const m = D.departDeMeta({ id: `depart_mondialrelay_${N2}`, ...Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v == null || typeof v === 'object' ? v : String(v)])) });
    dit(m && D.mrSansCodePostal(m) === true && D.mrSansCodePostal(D.departDeMeta({ id: `depart_mondialrelay_${N1}`, suivi: N1, carrier: 'mondialrelay', cp: '56000', cpsLu: new Date().toISOString() })) === false, 'M6c relue en scalaires, la ligne dit « pas de code postal » (et pas une ligne prouvée)', J(m && { cps: m.cpsPdf, lu: m.cpsLu }));
    dit(r && r.ok, 'M6d le passage répond', J(r && r.ok));
  });

  await essaie('M7–M8 identité', async () => {
    base.clear(); appels.length = 0;
    base.set(`${A}|main`, { vrm_colis_collected: [] });
    await bord(TX3, N3, LIGNES_OK, '');                      // aucun transporteur nommé : 8 chiffres ne disent rien
    await bord(TX4, N4, LIGNES_OK);                          // Mondial Relay nommé, mais le n° est aussi un ACHAT
    // le suivi Vinted d'un de SES ACHATS (capté par l'extension) porte le même n°
    base.set(`${A}|harvest_123456_suivi_9200000001`, { tx: '9200000001', suivi: N4, transporteur: 'Mondial Relay', capturedAt: new Date(NOW - 2 * H).toISOString() });
    mr = (u) => ({ status: 200, body: PAS_DE_COLIS });
    await passage();
    dit(!ligneD(N3) && !appels.some((x) => x.n === N3), 'M7 un n° de 8 chiffres sans Mondial Relay nommé (e-mail ou étiquette) ⇒ jamais lu comme départ', J(appels.map((x) => x.n)));
    dit(!ligneD(N4), 'M8 un n° qui est aussi un ACHAT ⇒ ambigu, jamais lu comme départ', J(ligneD(N4)));
  });

  await essaie('M9 la phrase de l’app', async () => {
    const t = D.departDeMeta({ id: `depart_mondialrelay_${N1}`, suivi: N1, carrier: 'mondialrelay', etat: 'en_route', priseAt: '2026-11-11T16:33:00.000Z', cp: '56000' });
    const p = D.departProuve(N1, new Map([[N1, t]]), { venteMs: Date.parse('2026-11-10T10:00:00Z') });
    dit(p && p.carrier === 'mondialrelay' && /^Mondial Relay l’a pris en charge le 11 nov/.test(p.phrase), 'M9 la vente passe « partie » : « Mondial Relay l’a pris en charge le 11 nov. »', J(p));
    const fs = require('fs');
    const src = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
    const i = src.indexOf('const raisonPasLuVente = (carrier, tr, dep) => {');
    const corps = i >= 0 ? src.slice(i, src.indexOf('\n  };', i)) : '';
    const fr = (await importer('src/i18n/langues/fr/clesSuivi.js')).default;
    dit(/mrSansCodePostal\(dep\)/.test(corps) && /trT\('suiviVente\.mrSansCp'\)/.test(corps) && /étiquette/.test(fr['suiviVente.mrSansCp']) && !/ne se lit pas pour un colis vendu/.test(src), 'M9b Ventes : « pas de code postal lisible sur l’étiquette » vient de la ligne `depart_` ; plus jamais « ne se lit pas pour un colis vendu »', corps.slice(0, 120));
  });

  console.log(ko ? `\n❌ audit-suivi-ventes-mr : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-suivi-ventes-mr : ${ok} verts — un colis vendu Mondial Relay est lu avec le code postal de SON étiquette, prouvé par l’écho, sans rien deviner`);
  process.exit(ko ? 1 : 0);
})();
