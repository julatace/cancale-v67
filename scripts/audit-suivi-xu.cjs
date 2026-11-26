#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT (24 nov., lot suivi-xu) — CHRONO RELAIS EUROPE « XU…JF » EST LU CHEZ CHRONOPOST, EXÉCUTÉ.
//  docs/passation/2026-11-24-suivi-xu.md
//  Mesuré (lecture seule, 24 nov.) sur les bordereaux de vente des 60 derniers jours : 14 n° de forme
//  « XU/ZU + 9 chiffres + JF » (13 XU, 1 ZU), AUCUNE ligne `depart_` — le serveur ne les interrogeait pas :
//  `nomDuBordereau` ne garde pas « chronopost », et `formeDepart` ne reconnaissait que XW/ZW…TS/SP.
//  Les champs de ces bordereaux, tels que mesurés : `transporteur` absent (9), vide + `transporteurPdf`
//  « chronopost » (3), « chronopost » sans `transporteurPdf` (1), absent + `transporteurPdf` « chronopost » (1).
//  Ce contrôle EXÉCUTE le vrai passage (api/_lib/transporteurs-lecture.js `passageTransporteurs` ⇒
//  `passageDeparts` ⇒ `lireTransporteur` ⇒ `lireReponseChronopost`) sur une fausse base PostgREST et un faux
//  ws.chronopost.fr qui répond le XML `trackSkybillV2` à la forme des XW déjà lus (codes DC/PC/TS/AB/D,
//  `infoCompList`, écho `skybillNumber`). Valeurs INVENTÉES. Aucune requête réelle.
//   X1 la forme : XU/ZU…JF ⇒ Chronopost, pour chaque combinaison de champs mesurée ; pas « XU…FR » (S10),
//      ni 8 chiffres, ni « XU » à 10 chiffres ; une VENTE seulement (un retour exige `transporteurPdf`) ;
//   X2 le vrai passage : le bordereau XU (sans transporteur) est lu chez ws.chronopost.fr, UNE requête au n°
//      exact ; ligne `depart_chronopost_XU…` : pris en charge (date du 1er évènement de route), au point
//      (nom LU), jamais une ligne `transp_` ;
//   X3 la règle du suivi d'un envoi (`etapesANotifier`, la même que la notification) relit cette ligne :
//      « au point » pour CETTE transaction (50 ventes au même titre : seul le n° désigne) ;
//   X4 Chronopost ne connaît pas le n° (errorCode ≠ 0) ⇒ « introuvable », rien de prouvé ; 3 fois ⇒ plus relu ;
//   X5 Chronopost répond un AUTRE skybill ⇒ rien de prouvé (l'écho est exigé) ;
//   X6 un n° XU aussi porté par un ACHAT ⇒ ambigu, jamais lu comme départ.
//  `AUDIT_RACINE` : une autre copie de l'arbre (preuve sur le code d'avant). `--prouve` : chaque mutation rougit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');
const MUTATIONS = {
  'xu-pas-reconnu': [['api/_lib/depart-colis.js', "  if (vente && FORME_CHRONO_RELAIS_EUROPE.test(n)) return 'chronopost';\n", '']],
  'xu-toute-fin': [['api/_lib/depart-colis.js', 'export const FORME_CHRONO_RELAIS_EUROPE = /^[XZ]U\\d{9}JF$/;', 'export const FORME_CHRONO_RELAIS_EUROPE = /^[XZ]U\\d{9}[A-Z]{2}$/;']],
  'echo-ignore': [['api/_lib/transporteurs.js', "  if (!sky || sky !== n) return rendu('forme',", "  if (false) return rendu('forme',"]],
  'introuvable-sans-fin': [['api/_lib/depart-colis.js', "  if (r === 'introuvable') return (Number(t.essais) || 0) >= INTROUVABLE_MAX ? Infinity : e + INTROUVABLE_MS;", "  if (r === 'introuvable') return e + INTROUVABLE_MS;"]],
  'retour-par-la-forme': [['api/_lib/depart-colis.js', '    const carrier = carrierDepart(s.transporteur, k, { vente: !s.retour });', '    const carrier = carrierDepart(s.transporteur, k, { vente: true });']],
  'achat-lu-en-vente': [['api/_lib/depart-colis.js', '    if (!k || vus.has(k) || ambigus.has(k)) continue;', '    if (!k || vus.has(k)) continue;']],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 3).join(' ').slice(0, 300)); } };
const importer = (p) => import('file://' + path.join(R, p));
const J = (x) => JSON.stringify(x);

const A = '11111111-2222-3333-4444-5555555555a7';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
try { const webpush = require(path.join(R, 'node_modules', 'web-push')); webpush.setVapidDetails = () => {}; webpush.sendNotification = async () => ({ statusCode: 201 }); } catch (_) {}

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
let chrono = () => null;   // (URL) ⇒ { status, body } | null
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (!/supabase\.co$/.test(u.hostname)) {
    appels.push({ host: u.hostname, path: u.pathname, n: u.searchParams.get('skybillNumber') });
    const r = u.hostname === 'ws.chronopost.fr' ? chrono(u) : null;
    if (!r) throw new TypeError('fetch failed');
    return new Response(r.body, { status: r.status, headers: { 'content-type': 'text/xml;charset=UTF-8' } });
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

// ── Le XML `trackSkybillV2`, à la forme des XW déjà lus (audit-colis-sortants, audit-statut-transporteurs) ──
const iso = (ms) => new Date(ms).toISOString();
const evXml = (e) => `<events><code>${e.code}</code><eventDate>${iso(e.ms)}</eventDate><eventLabel>${e.libelle}</eventLabel><officeLabel>${e.office || 'PARIS - FR - TEST'}</officeLabel><zipCode>75014</zipCode>${(e.infos || []).map(([k, v]) => `<infoCompList><name>${k}</name><value>${v}</value></infoCompList>`).join('')}</events>`;
const cpXml = (sky, evs, code = 0) => `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns1:trackSkybillV2Response xmlns:ns1="http://cxf.tracking.soap.chronopost.fr/"><return><errorCode>${code}</errorCode>${code ? '' : `<listEventInfoComp>${evs.map(evXml).join('')}<skybillNumber>${sky}</skybillNumber></listEventInfoComp>`}</return></ns1:trackSkybillV2Response></soap:Body></soap:Envelope>`;
const POINT = 'TABAC FICTIF DU PORT';

(async () => {
  let D = null, L = null, O = null, SE = null;
  await essaie('les modules', async () => {
    D = await importer('api/_lib/depart-colis.js');
    L = await importer('api/_lib/transporteurs-lecture.js');
    O = await importer('api/_lib/owner.js');
    SE = await importer('api/_lib/suivi-envoi.js');
    dit(typeof D.carrierDepart === 'function' && typeof L.passageTransporteurs === 'function' && typeof SE.etapesANotifier === 'function', 'les règles existent (carrierDepart, passage, etapesANotifier)');
  });
  if (!D || !L || !O || !SE) { console.log(`\n❌ audit-suivi-xu : ${ko} rouge(s)`); process.exit(1); }
  if (typeof L._reglerPourBanc === 'function') L._reglerPourBanc({ ecartMs: 0 });
  const NOW = Date.now(), H = 3600000;
  const XU = (k) => 'XU' + String(400000000 + k) + 'JF';
  const ZU = (k) => 'ZU' + String(400000000 + k) + 'JF';

  // ── X1 la forme, sur les combinaisons de champs MESURÉES ─────────────────────
  await essaie('X1 la forme', async () => {
    const combis = [{}, { transporteur: '', transporteurPdf: 'chronopost' }, { transporteur: 'chronopost' }, { transporteurPdf: 'chronopost' }];
    const choisis = combis.map((c, i) => {
      const s = D.sortantsDuVendeur({ bords: [{ suivi: XU(i), transaction: String(9200000000 + i), receivedAt: iso(NOW - 20 * H), ...c }] });
      return D.departsAInterroger({ sortants: s, maintenant: NOW, max: 6, parTransporteur: 6 });
    });
    dit(choisis.every((l, i) => l.length === 1 && l[0].carrier === 'chronopost' && l[0].suivi === XU(i)), 'X1 XU…JF ⇒ lu chez Chronopost, quels que soient les champs mesurés (absent, vide + étiquette, nommé)', J(choisis));
    const V = { vente: true };
    dit(D.carrierDepart('', ZU(1), V) === 'chronopost' && D.carrierDepart(null, XU(1).toLowerCase(), V) === 'chronopost', 'X1b ZU…JF aussi (1 bordereau mesuré), casse indifférente', J([D.carrierDepart('', ZU(1), V), D.carrierDepart(null, XU(1).toLowerCase(), V)]));
    const autres = ['XU400000001FR', 'CP400000001IE', 'XU4000000001JF', '40000001', 'XU40000001JF'];
    // (25 nov.) Un bordereau de RETOUR (le colis qu'il renvoie) : la forme seule ne suffit pas — seulement avec le
    // transporteur lu sur SON étiquette (lot retour-parfait, audit-retour-parfait T3).
    const retour = (tp) => D.departsAInterroger({ sortants: D.sortantsDuVendeur({ retours: [{ suivi: XU(50), transaction: '9200000050', receivedAt: iso(NOW - 20 * H), transporteurPdf: tp }] }), maintenant: NOW, max: 6, parTransporteur: 6 });
    const rSans = retour(''), rAvec = retour('chronopost');
    dit(autres.every((n) => D.carrierDepart('', n, V) === null) && rSans.length === 0 && rAvec.length === 1 && rAvec[0].carrier === 'chronopost',
      'X1c ni un n° postal S10 (XU…FR, CP…IE), ni 10 chiffres, ni 8 chiffres, ni 8 chiffres + JF ; et un RETOUR XU sans `transporteurPdf` n’est pas lu (avec, oui) : la forme XU vaut pour une VENTE seulement', J({ autres: autres.map((n) => [n, D.carrierDepart('', n, V)]), rSans, rAvec }));
    dit(D.carrierDepart('', 'XW400000001TS') === 'chronopost', 'X1d les XW…TS restent lus (inchangé)');
  });

  const bord = (tx, suivi, extra = {}) => base.set(`${A}|email_bord_${tx}`, { type: 'bordereau', transaction: tx, suivi, receivedAt: iso(NOW - 30 * H), article: 'Nike Air Max 90 blanche T42', ...extra });
  const passage = (maintenant) => O.contexteVendeur.run({ owner: A }, () => L.passageTransporteurs({ max: 6, budgetMs: 20000, maxDeparts: 6, ...(maintenant ? { maintenant } : {}) }));
  const ligneD = (n) => base.get(`${A}|depart_chronopost_${n}`) || null;
  const EVS = [
    { code: 'DC', ms: NOW - 28 * H, libelle: 'Envoi en cours de préparation chez l’expéditeur' },
    { code: 'PC', ms: NOW - 26 * H, libelle: 'Envoi pris en charge par Chronopost' },
    { code: 'TS', ms: NOW - 20 * H, libelle: 'Envoi en cours d’acheminement' },
    { code: 'AB', ms: NOW - 3 * H, libelle: 'Envoi disponible au point de retrait', infos: [['Point de livraison', `${POINT} - 1 RUE IMAGINAIRE - 56000 - VANNES - FR`]] },
  ];

  // ── X2 le vrai passage ───────────────────────────────────────────────────────
  const TX = '9200000101', N = XU(101);
  await essaie('X2 le passage', async () => {
    base.clear(); appels.length = 0;
    base.set(`${A}|main`, { vrm_colis_collected: [] });
    bord(TX, N);   // la forme la plus fréquente mesurée : aucun transporteur sur la ligne
    chrono = (u) => (u.searchParams.get('skybillNumber') === N ? { status: 200, body: cpXml(N, EVS) } : null);
    await passage();
    const cp = appels.filter((x) => x.host === 'ws.chronopost.fr');
    dit(cp.length === 1 && cp[0].n === N && /trackSkybillV2$/.test(cp[0].path), 'X2 le bordereau XU (sans transporteur) est lu chez ws.chronopost.fr, UNE requête, au n° exact', J(appels));
    const l = ligneD(N);
    const prise = Date.parse(l && l.priseAt || '');
    dit(!!l && l.essaiRes === 'ok' && l.carrier === 'chronopost' && l.etat === 'disponible' && prise === NOW - 26 * H, 'X2b `depart_chronopost_XU…` : au point, pris en charge à la date du 1er évènement de route (PC, pas la préparation DC)', J(l && { r: l.essaiRes, e: l.etat, p: l.priseAt }));
    dit(!!l && l.lieuNom === POINT, 'X2c le nom du point est celui LU chez Chronopost', J(l && l.lieuNom));
    dit(![...base.keys()].some((k) => /\|transp_/.test(k) && !/transp_pause/.test(k)), 'X2d jamais une ligne `transp_` : le colis de l’acheteur n’est jamais « à retirer » chez lui', J([...base.keys()]));
  });

  // ── X3 la règle du suivi d'un envoi relit la ligne écrite ────────────────────
  await essaie('X3 le suivi de l’envoi', async () => {
    const l = ligneD(N);
    const departs = D.departsParSuivi([{ id: `depart_chronopost_${N}`, ...Object.fromEntries(Object.entries(l || {}).filter(([, v]) => v == null || typeof v !== 'object').map(([k, v]) => [k, v == null ? v : String(v)])) }]);
    const bords = Array.from({ length: 50 }, (_, i) => ({ suivi: XU(200 + i), transaction: String(9200000200 + i), article: 'Nike Air Max 90 blanche T42', receivedAt: iso(NOW - 30 * H) }));
    bords.push({ suivi: N, transaction: TX, article: 'Nike Air Max 90 blanche T42', receivedAt: iso(NOW - 30 * H) });
    const e = SE.etapesANotifier({ departs, bords, maintenant: NOW });
    dit(e.length === 1 && e[0].tx === TX && e[0].etape === 'aupoint' && e[0].lieu === POINT && e[0].carrier === 'chronopost', 'X3 « au point » pour CETTE transaction (51 ventes au même titre : seul le n° désigne), le point lu', J(e));
  });

  // ── X4 Chronopost ne connaît pas le n° ───────────────────────────────────────
  await essaie('X4 introuvable', async () => {
    base.clear(); appels.length = 0;
    base.set(`${A}|main`, { vrm_colis_collected: [] });
    const N4 = XU(104);
    bord('9200000104', N4);
    chrono = (u) => (u.searchParams.get('skybillNumber') === N4 ? { status: 200, body: cpXml(N4, [], 3) } : null);
    await passage();
    const l = ligneD(N4);
    dit(!!l && l.essaiRes === 'introuvable' && !l.priseAt && !l.etat, 'X4 errorCode ≠ 0 ⇒ « introuvable » : rien de prouvé, aucun état inventé', J(l));
    const t = D.departDeMeta({ id: `depart_chronopost_${N4}`, ...l, essais: '3', essai: iso(NOW - 30 * H) });
    dit(D.prochainEssaiDepart(t) === Infinity, 'X4b trois fois introuvable ⇒ plus jamais relu (aucune requête sans fin)', String(D.prochainEssaiDepart(t)));
  });

  // ── X5 l'écho est exigé ──────────────────────────────────────────────────────
  await essaie('X5 l’écho', async () => {
    base.clear(); appels.length = 0;
    base.set(`${A}|main`, { vrm_colis_collected: [] });
    const N5 = XU(105);
    bord('9200000105', N5);
    chrono = (u) => (u.searchParams.get('skybillNumber') === N5 ? { status: 200, body: cpXml(XU(999), EVS) } : null);
    await passage();
    const l = ligneD(N5);
    dit(!!l && l.essaiRes !== 'ok' && !l.priseAt && l.etat == null, 'X5 Chronopost répond un AUTRE n° ⇒ rien de prouvé (jamais la paire d’un autre)', J(l));
  });

  // ── X6 un n° aussi porté par un achat ────────────────────────────────────────
  await essaie('X6 ambigu', async () => {
    const s = D.sortantsDuVendeur({ bords: [{ suivi: XU(106), transaction: '9200000106', receivedAt: iso(NOW - 20 * H) }] });
    const l = D.departsAInterroger({ sortants: s, entrants: new Set([XU(106)]), maintenant: NOW, max: 6, parTransporteur: 6 });
    dit(l.length === 0, 'X6 un n° XU aussi porté par un ACHAT ⇒ ambigu, jamais lu comme départ', J(l));
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-suivi-xu : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + ((e && e.stack) || e)); process.exit(1); });
