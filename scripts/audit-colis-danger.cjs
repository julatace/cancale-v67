#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « COLIS EN DANGER » (23 nov.) — EXÉCUTÉ. docs/passation/2026-11-23-colis-danger.md
//  node scripts/audit-colis-danger.cjs [--prouve : chaque mutation doit rougir]
// ════════════════════════════════════════════════════════════════════════════
// Julien (23 nov.) : « pour tes ventes, VRM relit le colis jusqu'à ce que l'acheteur le récupère et
// te prévient avant qu'il reparte (au point relais Vinted Go seulement pour commencer) ».
// Valeurs INVENTÉES à la FORME mesurée (le dépôt est public) :
//   · la réponse Vinted Go `carrier.vintedgo.com/public/v3/tracking_events/{n}` : `tracking_events`
//     (group, state, timestamp, message, metadata) + `meta.expiration_time` (mesurée sur un colis
//     ENTRANT au point : `transp_vinted_*` disponible, `limiteSure` + `limiteAt`) ;
//   · le bordereau de vente `email_bord_{tx}` : meta `suivi`, `transaction`, `article`, `annulee` ;
//   · la ligne `depart_vinted_{n°}` (api/_lib/depart-colis.js), lue par `meta->>`.
//  L  la lecture : `ready_for_pickup` + `expiration_time` ⇒ la ligne garde `limiteAt` (Vinted Go
//     seulement, date LUE) ; retiré / sans `expiration_time` / Chronopost ⇒ aucune date ; relu 2 h ;
//  R  la règle : veille / jour, une lecture fraîche, une VENTE prouvée par SON n° (50 titres
//     identiques n'y changent rien), jamais un retour ni un achat, rien quand c'est passé ou retiré ;
//  T  les textes : 5 langues, ≤ 40 / 90, le geste, le jour en clair ; la famille et son réglage ;
//  C  la VRAIE route `api/ship-reminders.js?moment=colis` sur une fausse base PostgREST : le colis
//     vendu dû est relu chez Vinted Go, la notification part UNE fois (un 2e passage ne re-sonne
//     pas), réglage coupé ⇒ rien ; une lecture ratée ⇒ rien.
'use strict';
require('./_source-app.cjs').brancher();
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path');
const fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'date-estimee-gardee': [['api/_lib/depart-colis.js', "if (carrier === 'vinted' && out.etat === 'disponible' && lu.limiteSure === true && msDe(lu.limiteAt) != null) {", "if (out.etat === 'disponible' && msDe(lu.limiteAt) != null) {"]],
  'date-jamais-effacee': [['api/_lib/depart-colis.js', "    } else { delete out.limite; delete out.limiteAt; delete out.limiteSure; }\n", "    }\n"]],
  'date-pas-projetee': [['api/_lib/depart-colis.js', ",limite:meta->>limite,limiteAt:meta->>limiteAt,limiteSure:meta->>limiteSure';", "';"]],
  'relu-6h': [['api/_lib/depart-colis.js', 'return e + (limiteDepartLue(t) ? RYTHME_DANGER_MS : pris', 'return e + (false ? RYTHME_DANGER_MS : pris']],
  'pas-visite-frequent': [['api/_lib/colis-frequent.js', "    `app_data?id=like.depart_vinted_*&meta->>etat=eq.disponible", "    `app_data?id=like.rien_*&meta->>etat=eq.disponible"]],
  'lecture-vieille-sonne': [['api/_lib/colis-danger.js', ' || maintenant - lu > FRAICHEUR_DANGER_MS) return null;', ') return null;']],
  'retour-ou-achat-sonne': [['api/_lib/colis-danger.js', '    if (autres && autres.has(k)) continue;\n', '']],
  'n-partage-sonne': [['api/_lib/colis-danger.js', '  for (const k of doubles) m.delete(k);\n', '']],
  'annulee-sonne': [['api/_lib/colis-danger.js', "    if (!b || b.annulee === true || b.annulee === 'true') continue;", '    if (!b) continue;']],
  'mauvais-jour': [['api/_lib/colis-danger.js', "j === demain ? 'veille' : null", "j !== auj ? 'veille' : null"]],
  'passee-sonne': [['api/_lib/colis-danger.js', '  if (lim == null || lim <= maintenant) return null;', '  if (lim == null) return null;']],
  'deux-fois': [['api/_lib/colis-danger.js', '    if (r === false) { deja++; continue; }\n', '']],
  'pas-su-envoie': [['api/_lib/colis-danger.js', "  if (![bords, retours, achats].every(Array.isArray)) return { fait: false, raison: 'lecture ratée — rien envoyé' };", "  if (!Array.isArray(bords)) return { fait: false, raison: 'x' };"]],
  'reglage-ignore': [['api/_lib/colis-danger.js', "  if (!(await active())) return { fait: true, raison: 'désactivé par le vendeur', n: 0 };\n", '']],
  'cron-oublie': [['api/ship-reminders.js', '          try { await notifsColisDanger(); } catch (_) {', '          try { await null; } catch (_) {']],
  'sans-geste': [['api/_lib/notif-redaction.js', "dangerCorps: (d) => (d ? `Préviens ton acheteur : son colis repart le ${d}`", "dangerCorps: (d) => (d ? `Ton colis attend le ${d}`"]],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 3).join(' ').slice(0, 400)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── L'environnement des routes ──────────────────────────────────────────────
const A = '11111111-0000-4000-8000-0000000000da';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.CRON_SECRET = 'cle-banc-cron';
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BBanc';
const envois = [];
try { const wp = require(path.join(R, 'node_modules', 'web-push')); wp.setVapidDetails = () => {}; wp.sendNotification = async (sub, corps) => { envois.push(String(corps || '')); return { statusCode: 201 }; }; } catch (_) {}

// ── Une fausse base à état, à la forme de PostgREST (celle d'audit-colis-frequent) ──
const base = new Map();
const pannes = new Set();
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
const metaDe = (d) => { const m = {}; if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) { if (v == null || typeof v === 'object') continue; const s = String(v); if (s.length <= 600) m[k] = s; } return m; };
const valeur = (l, k) => {
  if (k === 'id') return l.id; if (k === 'owner') return l.owner;
  if (k.startsWith('meta->>')) return metaDe(l.data)[k.slice(7)];
  if (k.startsWith('data->>') || k.startsWith('data->')) { const v = chemin(l.data, k.replace(/^data(->>|->)/, '')); return v == null ? undefined : (typeof v === 'object' ? JSON.stringify(v) : String(v)); }
  return undefined;
};
const teste = (x, op) => {
  const i = op.indexOf('.'); const o = op.slice(0, i), v = op.slice(i + 1).replace(/^"|"$/g, '');
  if (o === 'eq') return x === v;
  if (o === 'neq') return x !== v;
  if (o === 'lt') return x != null && x < v;
  if (o === 'lte') return x != null && x <= v;
  if (o === 'gt') return x != null && x > v;
  if (o === 'gte') return x != null && x >= v;
  if (o === 'like' || o === 'ilike') { const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*').replace(/_/g, '.') + '$', o === 'ilike' ? 'i' : ''); return x != null && re.test(x); }
  if (o === 'in') return v.replace(/^\(|\)$/g, '').split(',').map((y) => y.replace(/^"|"$/g, '')).includes(x);
  if (o === 'is') return v === 'null' ? x == null : true;
  if (o === 'not') return !teste(x, v);
  return true;
};
const decoupeOr = (s) => { const out = []; let p = 0, cur = ''; for (const ch of s.replace(/^\(|\)$/g, '')) { if (ch === '(') p++; if (ch === ')') p--; if (ch === ',' && !p) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; };
const filtrer = (u) => {
  const conds = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'limit', 'order', 'offset'].includes(k)) continue;
    if (k === 'or') { const alts = decoupeOr(v).map((e) => { const j = e.indexOf('.'); return [e.slice(0, j), e.slice(j + 1)]; }); conds.push((l) => alts.some(([kk, op]) => teste(valeur(l, kk), op))); continue; }
    conds.push((l) => teste(valeur(l, k), v));
  }
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
const appels = [];
const HOTES_TRANSP = /(^|\.)(chronopost\.fr|vintedgo\.com|mondialrelay\.(?:fr|be))$/;
let reponseTransporteur = () => null;
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (HOTES_TRANSP.test(u.hostname)) { appels.push({ host: u.hostname, url: String(url) }); const r = reponseTransporteur(u); if (!r) throw new TypeError('fetch failed'); return new Response(r.body, { status: r.status, headers: { 'content-type': r.ctype || 'application/json' } }); }
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname === '/rest/v1/vinted_accounts') return rep([]);
  if (u.pathname.startsWith('/auth/v1/admin/users/')) return rep({ user_metadata: { langue: 'fr' } });
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  const brut = decodeURIComponent(u.pathname + u.search);
  if (m === 'POST') {
    const prefer = String(h.Prefer || h.prefer || '');
    const faits = [];
    for (const r of JSON.parse(opts.body || '[]')) { const cle = `${r.owner || A}|${r.id}`; if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue; base.set(cle, r.data); faits.push({ id: r.id }); }
    return /return=representation/.test(prefer) ? rep(faits, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') { const corps = JSON.parse(opts.body || '{}'); const t = filtrer(u); for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data); return rep(t.map((l) => ({ id: l.id }))); }
  if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
  for (const p of pannes) if (brut.includes(p)) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // base cloisonnée
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };
const NOW = Date.now(), MIN = 60000, H = 3600000, J = 86400000;
const iso = (ms) => new Date(ms).toISOString();
// La forme RÉELLE d'une réponse Vinted Go (valeurs inventées).
const vgJson = (evs, meta = {}) => JSON.stringify({ tracking_events: evs.map((e, i) => ({ id: 'ev' + i, message: e.message || e.group, timestamp: iso(e.ms), metadata: e.address ? { address: e.address, point_id: 107000 + i } : {}, banner_message: null, group_header: null, group: e.group, state: e.state || 'delivery' })), meta });
// Un instant fixe pour la règle : mardi 24 nov. 2026, 9 h à Paris (8 h UTC).
const T0 = Date.parse('2026-11-24T08:00:00Z');
const VGS = (n) => 'VGS' + String(9000000000000 + n);

(async () => {
  const D = await importer('api/_lib/depart-colis.js');
  const T = await importer('api/_lib/transporteurs.js');
  const CD = await importer('api/_lib/colis-danger.js');

  // ── L. la lecture du colis vendu ────────────────────────────────────────────
  await essaie('L la lecture', async () => {
    const lire = (corps, carrier = 'vinted') => T.lireReponse(carrier, 200, 'application/json', corps, { suivi: VGS(1), voie: T.VOIE_SERVEUR && T.VOIE_SERVEUR[carrier] });
    const exp = T0 + 26 * H + 34 * MIN;                     // mer. 25 nov. 11 h 34 Paris
    const dispo = lire(vgJson([{ group: 'ready_for_pickup', ms: T0 - 20 * H, address: '1 Rue Exemple, Testville, FR', message: 'Ton colis attend (Consigne TEST)' }, { group: 'in_transit', ms: T0 - 40 * H }, { group: 'created', ms: T0 - 60 * H }], { expiration_time: iso(exp) }));
    const l1 = D.ligneDepartApresEssai({ v: 1, suivi: VGS(1), carrier: 'vinted', priseAt: iso(T0 - 40 * H) }, dispo, { carrier: 'vinted', suivi: VGS(1), maintenant: T0 });
    dit(l1.etat === 'disponible' && l1.limiteAt === iso(exp) && l1.limiteSure === true && l1.limite === '2026-11-25', 'L1 Vinted Go `ready_for_pickup` + `expiration_time` ⇒ la ligne `depart_` garde la date où il REPART (lue)', JSON.stringify({ e: l1.etat, a: l1.limiteAt, s: l1.limiteSure, l: l1.limite }));
    const meta = D.departDeMeta({ id: D.cleDepart('vinted', VGS(1)), ...Object.fromEntries(Object.entries(l1).map(([k, v]) => [k, v == null || typeof v === 'object' ? v : String(v)])) });
    dit(meta && meta.limiteAt === iso(exp) && meta.limiteSure === true && D.SELECT_DEPART_META.includes('limiteAt:meta->>limiteAt') && D.SELECT_DEPART_META.includes('limiteSure:meta->>limiteSure'), 'L1 la date se relit par `meta->>` (projection, jamais `select=data`)');
    dit(D.prochainEssaiDepart({ ...meta, essai: iso(T0), essaiRes: 'ok' }) === T0 + 2 * H, 'L2 tant qu’il attend avec une date lue : relu toutes les 2 h (pas 6 h)', String(D.prochainEssaiDepart({ ...meta, essai: iso(T0), essaiRes: 'ok' }) - T0));
    const retire = lire(vgJson([{ group: 'delivered', ms: T0 - H }, { group: 'ready_for_pickup', ms: T0 - 20 * H }], { expiration_time: iso(exp) }));
    const l2 = D.ligneDepartApresEssai(l1, retire, { carrier: 'vinted', suivi: VGS(1), maintenant: T0 });
    dit(l2.etat === 'retire' && !l2.limiteAt && !l2.limiteSure && l2.clos === true, 'L3 retiré par l’acheteur ⇒ la date est effacée, le suivi est clos', JSON.stringify({ e: l2.etat, a: l2.limiteAt, c: l2.clos }));
    const sansExp = lire(vgJson([{ group: 'ready_for_pickup', ms: T0 - 20 * H }], {}));
    const l3 = D.ligneDepartApresEssai({ v: 1, carrier: 'vinted' }, sansExp, { carrier: 'vinted', suivi: VGS(2), maintenant: T0 });
    dit(l3.etat === 'disponible' && !l3.limiteAt && !l3.limiteSure, 'L4 sans `expiration_time` : AUCUNE date (pas su ⇒ pas d’alerte)', JSON.stringify({ a: l3.limiteAt }));
    const l4 = D.ligneDepartApresEssai({ v: 1, carrier: 'chronopost' }, { res: 'ok', etat: 'disponible', etatAt: iso(T0), limite: '2026-11-25', limiteSure: false, limiteAt: iso(exp), evenements: [] }, { carrier: 'chronopost', suivi: 'XW000000001TS', maintenant: T0 });
    dit(!l4.limiteAt && !l4.limiteSure, 'L4 Chronopost (date estimée, `limiteSure:false`) : aucune date gardée');
    const l5 = D.ligneDepartApresEssai(l1, { res: 'passu' }, { carrier: 'vinted', suivi: VGS(1), maintenant: T0 + H });
    dit(l5.limiteAt === iso(exp) && l5.lu === l1.lu, 'L5 une lecture ratée ne change ni la date ni la dernière lecture (sa fraîcheur)');
    const F = await importer('api/_lib/colis-frequent.js');
    const q = F.requetesColisDus(NOW).find((x) => x.includes('depart_vinted_'));
    dit(!!q && q.includes('meta->>limiteSure=eq.true') && q.includes('meta->>etat=eq.disponible') && /select=owner$/.test(q), 'L6 le passage de 15 min visite le vendeur d’un colis vendu au point avec une date lue (projeté sur `owner`)', q);
  });

  // ── R. la règle ─────────────────────────────────────────────────────────────
  await essaie('R la règle', async () => {
    const ligne = (n, o = {}) => D.departDeMeta({ id: D.cleDepart('vinted', VGS(n)), suivi: VGS(n), carrier: 'vinted', etat: 'disponible', priseAt: iso(T0 - 3 * J), lu: iso(T0 - 30 * MIN), essai: iso(T0 - 30 * MIN), essaiRes: 'ok', limiteSure: 'true', limiteAt: iso(T0 + 26 * H), limite: '2026-11-25', clos: 'false', ...o });
    const map = (...ls) => new Map(ls.filter(Boolean).map((t) => [t.suivi, t]));
    // 50 ventes au MÊME titre : seule la n° 7 a son colis au point.
    const bords = Array.from({ length: 50 }, (_, i) => ({ suivi: VGS(100 + i), transaction: String(99000000100 + i), article: 'Nike Air Max 90 blanche T42' }));
    const r1 = CD.colisEnDanger({ departs: map(ligne(107)), bords, maintenant: T0 });
    dit(r1.length === 1 && r1[0].seuil === 'veille' && r1[0].tx === '99000000107' && r1[0].cle === `colis-danger-veille-${VGS(107)}`, 'R1 il repart DEMAIN ⇒ « veille », la vente de CE n° (50 titres identiques ne désignent rien d’autre)', JSON.stringify(r1));
    const r2 = CD.colisEnDanger({ departs: map(ligne(107, { limiteAt: iso(T0 + 2 * H + 34 * MIN), limite: '2026-11-24' })), bords, maintenant: T0 });
    dit(r2.length === 1 && r2[0].seuil === 'jour', 'R2 il repart AUJOURD’HUI ⇒ « jour »', JSON.stringify(r2));
    dit(CD.colisEnDanger({ departs: map(ligne(107, { limiteAt: iso(T0 + 3 * J) })), bords, maintenant: T0 }).length === 0, 'R3 dans 3 jours ⇒ rien encore');
    dit(CD.colisEnDanger({ departs: map(ligne(107, { limiteAt: iso(T0 - MIN) })), bords, maintenant: T0 }).length === 0, 'R3 déjà reparti (date passée) ⇒ rien');
    dit(CD.colisEnDanger({ departs: map(ligne(107, { lu: iso(T0 - 9 * H) })), bords, maintenant: T0 }).length === 0, 'R4 la dernière lecture a plus de 8 h ⇒ rien (il est peut-être retiré)');
    dit(CD.colisEnDanger({ departs: map(ligne(107, { etat: 'retire' })), bords, maintenant: T0 }).length === 0, 'R4 retiré ⇒ rien');
    dit(CD.colisEnDanger({ departs: map(ligne(107, { limiteSure: 'false' })), bords, maintenant: T0 }).length === 0, 'R5 une date pas sûre ⇒ rien (jamais estimée)');
    dit(CD.colisEnDanger({ departs: map(ligne(900)), bords, maintenant: T0 }).length === 0, 'R6 un n° qu’aucun bordereau de vente ne porte ⇒ rien (identité = le n°)');
    dit(CD.colisEnDanger({ departs: map(ligne(107)), bords, autres: new Set([VGS(107)]), maintenant: T0 }).length === 0, 'R6 le n° d’un retour ou d’un achat ⇒ rien');
    const deux = [...bords, { suivi: VGS(107), transaction: '99000009999', article: 'Autre' }];
    dit(CD.colisEnDanger({ departs: map(ligne(107)), bords: deux, maintenant: T0 }).length === 0, 'R6 un n° porté par deux transactions ⇒ rien (ambigu)');
    const ann = bords.map((b) => (b.suivi === VGS(107) ? { ...b, annulee: 'true' } : b));
    dit(CD.colisEnDanger({ departs: map(ligne(107)), bords: ann, maintenant: T0 }).length === 0, 'R6 une vente annulée ⇒ rien');
    dit(CD.colisEnDanger({ departs: null, bords, maintenant: T0 }).length === 0 && CD.colisEnDanger({ departs: map(ligne(107)), bords: null, maintenant: T0 }).length === 0, 'R7 pas su ⇒ rien');
    // La passe : réservée une fois, lecture ratée ⇒ rien, réglage coupé ⇒ rien.
    const lignesBase = { [CD.REQ_DEPARTS_DANGER]: [{ id: D.cleDepart('vinted', VGS(107)), suivi: VGS(107), carrier: 'vinted', etat: 'disponible', lu: iso(T0 - 30 * MIN), limiteSure: 'true', limiteAt: iso(T0 + 26 * H) }], [CD.REQ_BORDS_VENTE]: bords, [CD.REQ_BORDS_RETOUR_SUIVIS]: [], [CD.REQ_ACHATS_SUIVIS]: [] };
    const cles = new Set(), sent = [];
    const passe = (o = {}) => CD.passeColisDanger({ maintenant: T0, lire: async (q) => (o.panne && q === o.panne ? null : lignesBase[q]), reserver: async (c) => (cles.has(c) ? false : (cles.add(c), true)), envoyer: async (n) => { sent.push(n); }, texte: (n) => ({ title: 'x', body: n.limiteAt }), active: async () => o.active !== false, lien: () => '/' });
    const p1 = await passe(), p2 = await passe();
    dit(p1.envoyees === 1 && p2.envoyees === 0 && p2.deja === 1 && sent.length === 1 && sent[0].cat === 'colisdanger' && sent[0].echeance === iso(T0 + 26 * H) && sent[0].redaction && sent[0].redaction.sorte === 'colisDanger', 'R8 la passe : une notification « colisdanger », UNE fois par colis et par seuil', JSON.stringify({ p1, p2, n: sent.length }));
    cles.clear(); sent.length = 0;
    const p3 = await passe({ panne: CD.REQ_BORDS_VENTE });
    dit(p3.fait === false && sent.length === 0, 'R9 une lecture ratée (bordereaux) ⇒ rien envoyé');
    let p3b = null; try { p3b = await passe({ panne: CD.REQ_ACHATS_SUIVIS }); } catch (_) { p3b = null; }
    dit(!!p3b && p3b.fait === false && sent.length === 0, 'R9 une lecture ratée (n° des achats) ⇒ rien envoyé, sans planter', JSON.stringify(p3b));
    const p4 = await passe({ active: false });
    dit(sent.length === 0 && p4.n === 0, 'R9 réglage « Colis en danger » coupé ⇒ rien');
  });

  // ── T. les textes et la famille ────────────────────────────────────────────
  await essaie('T les textes', async () => {
    const Rd = await importer('api/_lib/notif-redaction.js');
    const NT = await importer('api/_lib/notif-textes.js');
    const lim = iso(T0 + 26 * H + 34 * MIN);
    const tx = {};
    for (const l of ['fr', 'en', 'es', 'it', 'de']) tx[l] = Rd.rediger({ sorte: 'colisDanger', article: 'Nike Air Max 90 blanche taille 42', limite: lim }, { langue: l, maintenant: T0 });
    dit(tx.fr && /^Préviens ton acheteur : son colis repart le mer\. 25 nov\. 11 h 34$/.test(tx.fr.body) && /^Colis pas encore retiré/.test(tx.fr.title), 'T1 « Préviens ton acheteur : son colis repart le mer. 25 nov. 11 h 34 » (le geste, le jour en clair, heure de Paris)', JSON.stringify(tx.fr));
    dit(Object.values(tx).every((t) => t && t.title.length <= 40 && t.body.length <= 90 && /25/.test(t.body)) && new Set(Object.values(tx).map((t) => t.body)).size === 5, 'T2 cinq langues, titre ≤ 40, corps ≤ 90, la date dite partout', JSON.stringify(tx));
    dit(NT.FAMILLES.some((f) => f.id === 'colisdanger' && f.def === true) && NT.familleDe('colisdanger') === 'colisdanger' && NT.decisionNotif({ familles: { colisdanger: false } }, 'colisdanger') === false && NT.decisionNotif({}, 'colisdanger') === true, 'T3 la famille « Colis en danger » : son interrupteur (allumé par défaut)');
    const Ap = await importer('api/_lib/notif-apercus.js');
    const ap = Ap.apercuFamille('colisdanger');
    dit(!!ap && ap.exemples.length >= 1 && /Préviens ton acheteur/.test(ap.exemples[0].body), 'T4 l’aperçu de Paramètres sort de la VRAIE fabrique');
    const reg = fs.readFileSync(path.join(R, 'src', 'ecrans', 'Reglages.jsx'), 'utf8');
    dit(/ids: \['poster', 'arrives', 'colisdanger'[,\]]/.test(reg), 'T4 rangée dans le groupe « Colis » de Paramètres → Notifications');
  });

  // ── C. la vraie route ───────────────────────────────────────────────────────
  await essaie('C la route ?moment=colis', async () => {
    const n = VGS(7), tx = '99000000777';
    const exp = NOW + 24 * H;                                         // demain (Paris)
    base.set(`${A}|email_bord_${tx}`, { type: 'bordereau', suivi: n, transaction: tx, article: 'Nike Air Max 90 blanche T42', receivedAt: iso(NOW - 4 * J), dateLimite: '20/11' });
    base.set(`${A}|depart_vinted_${n}`, { v: 1, sens: 'sortant', suivi: n, carrier: 'vinted', etat: 'disponible', etatAt: iso(NOW - J), priseAt: iso(NOW - 3 * J), lu: iso(NOW - 3 * H), essai: iso(NOW - 3 * H), essaiRes: 'ok', essais: 0, fini: true, clos: false, limiteSure: true, limiteAt: iso(exp), limite: '2099-01-01' });
    base.set(`${A}|push_subs`, { subs: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/banc-colis-danger', keys: { p256dh: 'BBanc', auth: 'banc' } }] });
    reponseTransporteur = (u) => (u.hostname === 'carrier.vintedgo.com' && u.href.includes(n)
      ? { status: 200, ctype: 'application/json', body: vgJson([{ group: 'ready_for_pickup', ms: NOW - J, address: '1 Rue Exemple, Testville, FR', message: 'Ton colis attend (Consigne TEST)' }, { group: 'in_transit', ms: NOW - 3 * J }], { expiration_time: iso(exp) }) }
      : null);
    const route = (await importer('api/ship-reminders.js')).default;
    const go = async () => { const res = faireRes(); await route({ method: 'GET', query: { moment: 'colis' }, headers: { authorization: 'Bearer cle-banc-cron' } }, res); return res; };
    const res = await go();
    const apres = base.get(`${A}|depart_vinted_${n}`) || {};
    const dedup = (base.get(`${A}|push_dedup`) || {}).keys || [];
    dit(res.code === 200 && appels.some((x) => /vintedgo/.test(x.host) && x.url.includes(n)), 'C1 le colis vendu dû est relu chez Vinted Go par le passage de 15 min', JSON.stringify({ code: res.code, corps: res.corps, appels: appels.map((x) => x.host) }));
    dit(Date.parse(apres.lu) >= NOW && apres.limiteAt === iso(exp) && apres.limiteSure === true, 'C1 la ligne est relue (fraîche) et garde la date lue', JSON.stringify({ lu: apres.lu, a: apres.limiteAt }));
    dit(dedup.includes(`colis-danger-veille-${n}`), 'C2 la notification est réservée dans `push_dedup` (veille, ce n°)', JSON.stringify(dedup));
    const journal = JSON.stringify(base.get(`${A}|push_journal`) || {});
    const vu = envois.join('\n') + journal;
    const envoisDanger = envois.filter((x) => /Colis pas encore retiré/.test(x));   // (24 nov.) « au point » (lot suivi-ventes) peut sonner aussi : une autre famille
    dit(envoisDanger.length === 1 && /Préviens ton acheteur/.test(envoisDanger[0]), 'C2 elle sonne sur son téléphone, avec le geste « Préviens ton acheteur »', vu.slice(0, 300));
    const avant = envois.length, dedup1 = dedup.length;
    base.set(`${A}|depart_vinted_${n}`, { ...apres, essai: iso(NOW - 3 * H) });
    await go();
    const dedup2 = ((base.get(`${A}|push_dedup`) || {}).keys || []).filter((k) => k.startsWith('colis-danger-'));
    dit(envois.length === avant && dedup2.length === 1, 'C3 un second passage ne re-sonne pas (une fois par colis et par seuil)', JSON.stringify({ avant, apres: envois.length, dedup2 }));
    // Réglage coupé : un autre colis, rien.
    const n2 = VGS(8), tx2 = '99000000888';
    base.set(`${A}|email_bord_${tx2}`, { type: 'bordereau', suivi: n2, transaction: tx2, article: 'Adidas Samba', receivedAt: iso(NOW - 4 * J) });
    base.set(`${A}|depart_vinted_${n2}`, { v: 1, sens: 'sortant', suivi: n2, carrier: 'vinted', etat: 'disponible', priseAt: iso(NOW - 3 * J), lu: iso(NOW - 30 * MIN), essai: iso(NOW - 30 * MIN), essaiRes: 'ok', fini: true, clos: false, limiteSure: true, limiteAt: iso(exp) });
    base.set(`${A}|push_prefs`, { familles: { colisdanger: false } });
    base.set(`${A}|main`, { vinted_dark: false });
    const CDr = await importer('api/_lib/colis-danger.js');
    void CDr;
    const route2 = (await importer('api/ship-reminders.js')).default;
    const res3 = faireRes();
    await route2({ method: 'GET', query: {}, headers: { authorization: 'Bearer cle-banc-cron' } }, res3);
    const dedup3 = ((base.get(`${A}|push_dedup`) || {}).keys || []);
    const cdr = res3.corps && (res3.corps.colisDanger || (Array.isArray(res3.corps.vendeurs) ? (res3.corps.vendeurs.find((v) => v && v.colisDanger) || {}).colisDanger : null));
    dit(!dedup3.includes(`colis-danger-veille-${n2}`) && /"colisDanger":\{"fait":true,"raison":"désactivé par le vendeur"/.test(JSON.stringify(res3.corps || {})), 'C4 réglage « Colis en danger » coupé (cron du matin) ⇒ rien réservé, rien envoyé', JSON.stringify(cdr || res3.corps).slice(0, 300));
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + ((e && e.stack) || e)); process.exit(1); });
