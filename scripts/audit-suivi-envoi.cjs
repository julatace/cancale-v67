#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE SUIVI D'UN ENVOI (24 nov., lot suivi-ventes) — EXÉCUTÉ. docs/passation/2026-11-24-suivi-ventes.md
//  node scripts/audit-suivi-envoi.cjs [--prouve : chaque mutation doit rougir]
// ════════════════════════════════════════════════════════════════════════════
// Julien (24 nov.) : « retrait des articles vendus, fais un vrai suivi ».
// Valeurs INVENTÉES à la FORME mesurée le 24 nov. (lecture seule, le dépôt est public) :
//   · `depart_chronopost_*` : etat livre/retire, derLib « Livraison effectuée », lieuNom, priseAt, etatAt ; jamais
//     de date limite sûre ; `XU…` (Chrono Relais Europe) n'a AUCUNE ligne (pas lu chez le transporteur) ;
//   · `depart_mondialrelay_*` : en_route (« Colis pris en charge en Point Relais »), retire (« Colis livré au
//     destinataire »), sans lieuNom ; 11 lignes sans état (aucun code postal) ;
//   · `depart_vinted_*` : 0 vente au 24 nov. ; la forme Vinted Go est celle des achats (`expiration_time`) ;
//   · la transaction : 450 « Commande finalisée », 230 + « Commande expédiée… » / « Commande livrée ! » ;
//   · le bordereau `email_bord_{tx}` : meta suivi, transaction, article, annulee, receivedAt.
//  P  le parcours, PAR TRANSPORTEUR : chaque étape seulement d'un champ LU ; « pas su » jamais coché ;
//     l'argent SEULEMENT de la commande finalisée ; la date limite seulement sûre ; le danger = la règle de #1338 ;
//     le retour ; une prise en charge datée avant la vente ne vaut rien ;
//  G  « Mes envois » : quatre groupes, « au point » trié par date limite, la couverture ;
//  I  l'identité : 50 ventes au MÊME titre, seul le n° désigne ; l'app ne lit aucune ligne d'un n° ambigu ;
//  N  la notification : au point / retiré, UNE fois par colis et par étape, seulement d'une lecture fraîche d'un
//     événement récent, jamais un achat ni un retour, lecture ratée ⇒ rien, réglage coupé ⇒ rien ;
//  T  les textes (5 langues ≤ 40 / 90), la famille, son aperçu, sa place dans Paramètres ;
//  C  la VRAIE route `api/ship-reminders.js?moment=colis` sur une fausse base PostgREST : le colis vendu en route est
//     visité entre les crons, relu chez Vinted Go, « au point » sonne une fois ; puis retiré ⇒ « retiré » une fois.
'use strict';
require('./_source-app.cjs').brancher();
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path');
const fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const SE = 'api/_lib/suivi-envoi.js';
const MUTATIONS = {
  'au-point-deduit': [[SE, '  } else etapes.aupoint = pasSu();', "  } else if (lue(p.enroute) || lue(p.livree)) etapes.aupoint = fait(null, 'deduit'); else etapes.aupoint = pasSu();"]],
  'argent-du-versement': [[SE, '  etapes.argent = lue(p.finalisee) ?', '  etapes.argent = (lue(p.finalisee) || lue(p.versee)) ?']],
  'limite-estimee': [[SE, '    const limite = limiteDepartLue(t) ? msDe(t.limiteAt) : null;', '    const limite = msDe(t.limiteAt);']],
  'prise-avant-vente': [[SE, '  return departProuve(k, new Map([[k, depart]]), { venteMs }) ? depart : null;', '  return depart;']],
  'danger-autre-regle': [[SE, ' ? dangerDuDepart(t, maintenant) : null;', " ? (limiteDepartLue(t) ? 'veille' : null) : null;"]],
  'arrivee-sans-ordre': [[SE, 'msDe(t.arriveeAt) < msDe(t.etatAt) - 60000', 'msDe(t.arriveeAt) <= msDe(t.etatAt)']],
  'retour-sans-depart': [[SE, "retour ? (ici >= 0 ? 'retour' : null)", "retour ? 'retour'"]],
  'tri-point': [[SE, '(lim(a) - lim(b))', '(lim(b) - lim(a))']],
  'couverture-fausse': [[SE, '    n++; if (pc.luChezTransporteur) lus++;', '    n++; lus++;']],
  'deux-fois': [[SE, '    if (r === false) { deja++; continue; }\n', '']],
  'lecture-vieille': [[SE, ' || maintenant - lu > FRAICHEUR_ENVOI_MS) continue;', ') continue;']],
  'evenement-ancien': [[SE, ' || maintenant - quand > RECENT_ENVOI_MS) continue;', ') continue;']],
  'achat-sonne': [[SE, '    if (!t || (autres && autres.has(k))) continue;', '    if (!t) continue;']],
  'sans-vente-sonne': [[SE, '    const v = ventes.get(k);\n    if (!v) continue;\n    // Le transporteur', "    const v = ventes.get(k) || { tx: '0', article: '' };\n    // Le transporteur"]],
  'pas-su-envoie': [[SE, "  if (![bords, retours, achats].every(Array.isArray)) return { fait: false, raison: 'lecture ratée — rien envoyé' };", "  if (!Array.isArray(bords)) return { fait: false, raison: 'x' };"]],
  'reglage-ignore': [[SE, "  if (!(await active())) return { fait: true, raison: 'désactivé par le vendeur', n: 0 };\n", '']],
  'cron-oublie': [['api/ship-reminders.js', '          try { await notifsSuiviEnvoi(); } catch (_) {', '          try { await null; } catch (_) {']],
  'pas-visite': [['api/_lib/colis-frequent.js', '    `app_data?id=like.depart_*&meta->>etat=in.(en_route,disponible)', '    `app_data?id=like.rien_*&meta->>etat=in.(en_route,disponible)']],
  'app-ambigu-lu': [['src/ecrans/Comptabilite.jsx', '    const amb = !!(su && ambigusFrise && ambigusFrise.has(su));', '    const amb = false;']],
  'app-frise-et-piste': [['src/ecrans/Comptabilite.jsx', '{pre.envPv && pre.envPv.pc.groupe ? <ParcoursEnvoi', '{pre.envPv && pre.envPv.pc.groupe && false ? <ParcoursEnvoi']],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 3).join(' ').slice(0, 400)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── L'environnement des routes (celui d'audit-colis-danger) ────────────────
const A = '11111111-0000-4000-8000-0000000000e5';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.CRON_SECRET = 'cle-banc-cron';
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BBanc';
const envois = [];
try { const wp = require(path.join(R, 'node_modules', 'web-push')); wp.setVapidDetails = () => {}; wp.sendNotification = async (sub, corps) => { envois.push(String(corps || '')); return { statusCode: 201 }; }; } catch (_) {}
const base = new Map();
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
  if (o === 'eq') return x === v; if (o === 'neq') return x !== v;
  if (o === 'lt') return x != null && x < v; if (o === 'lte') return x != null && x <= v;
  if (o === 'gt') return x != null && x > v; if (o === 'gte') return x != null && x >= v;
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
  if (m === 'POST') {
    const prefer = String(h.Prefer || h.prefer || '');
    const faits = [];
    for (const r of JSON.parse(opts.body || '[]')) { const cle = `${r.owner || A}|${r.id}`; if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue; base.set(cle, r.data); faits.push({ id: r.id }); }
    return /return=representation/.test(prefer) ? rep(faits, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') { const corps = JSON.parse(opts.body || '{}'); const t = filtrer(u); for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data); return rep(t.map((l) => ({ id: l.id }))); }
  if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };
const NOW = Date.now(), MIN = 60000, H = 3600000, J = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const vgJson = (evs, meta = {}) => JSON.stringify({ tracking_events: evs.map((e, i) => ({ id: 'ev' + i, message: e.message || e.group, timestamp: iso(e.ms), metadata: e.address ? { address: e.address, point_id: 107000 + i } : {}, banner_message: null, group_header: null, group: e.group, state: e.state || 'delivery' })), meta });
const T0 = Date.parse('2026-11-24T08:00:00Z');   // mardi 24 nov., 9 h à Paris
const VGS = (n) => 'VGS' + String(9000000000000 + n);
const XW = (n) => 'XW' + String(100000000 + n) + 'TS';
const MR = (n) => String(40000000 + n);

(async () => {
  const D = await importer('api/_lib/depart-colis.js');
  const SEm = await importer(SE);
  const CD = await importer('api/_lib/colis-danger.js');
  const FP = await importer('src/friseProuvee.js');

  // Une vente Vinted à la forme de la liste « Mes ventes » + la transaction ; ses preuves par la VRAIE règle de la frise.
  const vente = (o = {}) => ({ transaction_id: 99000000001, title: 'Nike Air Max 90 blanche T42', date: iso(T0 - 6 * J), status: 'Commande expédiée et en cours d\'acheminement ! ', transaction_user_status: 'waiting', ...o });
  const preuves = ({ o = vente(), suivi = '', departs = null, etat = { s: 230 }, versement = null, depart = null, emails = null } = {}) =>
    FP.preuvesFriseVinted({ vente: o, bord: suivi ? { suivi, receivedAt: iso(T0 - 6 * J + H) } : null, departs, etat, versement, depart, emails, ambigus: new Set() });
  const ligne = (carrier, suivi, x = {}) => D.departDeMeta({ id: D.cleDepart(carrier, suivi), suivi, carrier, lu: iso(T0 - 30 * MIN), essai: iso(T0 - 30 * MIN), essaiRes: 'ok', priseAt: iso(T0 - 5 * J), ...x });
  const parcours = ({ carrier, suivi, depart, o = vente(), etat, versement, bif = null, maintenant = T0 }) => {
    const departs = depart ? new Map([[depart.suivi, depart]]) : new Map();
    return SEm.parcoursEnvoi({ preuves: preuves({ o, suivi, departs, etat, versement }), depart, venteMs: o.date, bifurcation: bif, suivi, carrier, maintenant });
  };
  const et = (pc, cle) => pc.etapes.find((e) => e.cle === cle);

  // ── P. le parcours, par transporteur ────────────────────────────────────────
  await essaie('P le parcours', async () => {
    // Chronopost (XW…TS) : « Livraison effectuée », lu chez lui ; aucun « au point » lu.
    const cp = parcours({ carrier: 'chronopost', suivi: XW(1), depart: ligne('chronopost', XW(1), { etat: 'livre', etatAt: iso(T0 - J), derLib: 'Livraison effectuée', lieuNom: 'Relais Test' }) });
    dit(et(cp, 'retire').etat === 'fait' && et(cp, 'retire').source === 'transporteur' && et(cp, 'retire').t === T0 - J, 'P1 Chronopost « Livraison effectuée » ⇒ Retiré, date LUE chez le transporteur', JSON.stringify(et(cp, 'retire')));
    dit(et(cp, 'aupoint').etat === 'passu' && et(cp, 'argent').etat === 'passu' && cp.groupe === 'retire', 'P1 Chronopost : « au point » jamais lu ⇒ « pas su » (jamais déduit du retrait) ; argent pas su ⇒ groupe « retiré, argent en attente »', JSON.stringify(cp.etapes));
    // Chronopost au point : nom lu, date limite ESTIMÉE (limiteSure:false) ⇒ aucune date dite.
    const cpd = parcours({ carrier: 'chronopost', suivi: XW(2), depart: ligne('chronopost', XW(2), { etat: 'disponible', etatAt: iso(T0 - 20 * H), arriveeAt: iso(T0 - 20 * H), lieuNom: 'Tabac Test', lieuVille: 'Testville', limite: '2026-11-30', limiteAt: iso(T0 + 6 * J), limiteSure: 'false' }) });
    dit(et(cpd, 'aupoint').etat === 'fait' && et(cpd, 'aupoint').nom === 'Tabac Test' && et(cpd, 'aupoint').t === T0 - 20 * H && cpd.point.limite === null && cpd.groupe === 'aupoint' && cpd.danger === null,
      'P2 Chronopost au point : le nom et « depuis » LUS ; la date limite estimée n’est PAS dite (aucun danger)', JSON.stringify(cpd.point));
    // Mondial Relay : retiré (« Colis livré au destinataire »), arrivé au point AVANT (arriveeAt).
    const mr = parcours({ carrier: 'mondialrelay', suivi: MR(1), depart: ligne('mondialrelay', MR(1), { etat: 'retire', etatAt: iso(T0 - J), arriveeAt: iso(T0 - 3 * J), derLib: 'Colis livré au destinataire' }) });
    dit(et(mr, 'aupoint').etat === 'fait' && et(mr, 'aupoint').t === T0 - 3 * J && et(mr, 'retire').t === T0 - J, 'P3 Mondial Relay : au point (arrivée gardée) PUIS retiré, chacun à SA date lue', JSON.stringify(mr.etapes));
    const mr2 = parcours({ carrier: 'mondialrelay', suivi: MR(2), depart: ligne('mondialrelay', MR(2), { etat: 'retire', etatAt: iso(T0 - J), arriveeAt: iso(T0 - J) }) });
    dit(et(mr2, 'aupoint').etat === 'passu', 'P3 une « arrivée » égale au retrait (lue d’un coup) ne prouve AUCUN passage au point', JSON.stringify(et(mr2, 'aupoint')));
    const mre = parcours({ carrier: 'mondialrelay', suivi: MR(3), depart: ligne('mondialrelay', MR(3), { etat: 'en_route', etatAt: iso(T0 - 2 * J), derLib: 'Colis pris en charge en Point Relais' }) });
    dit(mre.groupe === 'enroute' && et(mre, 'enroute').etat === 'fait' && et(mre, 'aupoint').etat === 'passu', 'P4 Mondial Relay pris en charge ⇒ « en route » ; la suite « pas su »', JSON.stringify(mre.etapes));
    // Vinted Go : la date limite SÛRE (expiration_time), le danger par la règle de #1338.
    const lim = T0 + 26 * H;   // mer. 25 nov. (demain, Paris)
    const vgL = ligne('vinted', VGS(1), { etat: 'disponible', etatAt: iso(T0 - 20 * H), arriveeAt: iso(T0 - 20 * H), lieuNom: 'Consigne Test', limite: '2026-11-25', limiteAt: iso(lim), limiteSure: 'true' });
    const vg = parcours({ carrier: 'vinted', suivi: VGS(1), depart: vgL });
    dit(vg.point.limite === lim && et(vg, 'aupoint').limite === lim, 'P5 Vinted Go : « à retirer avant » = `expiration_time` LU', JSON.stringify(vg.point));
    dit(vg.danger === 'veille' && vg.danger === CD.dangerDuDepart(vgL, T0), 'P5 « Colis en danger » sur la ligne = la règle de la notification (`dangerDuDepart`, #1338), pas une seconde', String(vg.danger));
    const vgVieux = parcours({ carrier: 'vinted', suivi: VGS(1), depart: { ...vgL, lu: iso(T0 - 9 * H) } });
    dit(vgVieux.danger === null && vgVieux.point.limite === lim, 'P5 une lecture de plus de 8 h : la date reste dite, le danger se tait (la règle de #1338)', String(vgVieux.danger));
    // Chrono Relais Europe (XU…) : aucune ligne transporteur ; Vinted dit « Commande livrée ! ».
    const xu = parcours({ carrier: 'chronopost', suivi: 'XU123456789JF', depart: null, o: vente({ status: 'Commande livrée ! ' }) });
    dit(et(xu, 'retire').etat === 'fait' && et(xu, 'retire').source === 'vinted' && et(xu, 'retire').t === null && et(xu, 'aupoint').etat === 'passu' && !xu.luChezTransporteur,
      'P6 Chrono Relais Europe (jamais lu chez le transporteur) : « retiré » d’après Vinted, SANS date inventée ; « au point » pas su', JSON.stringify(xu.etapes));
    // L'argent : seulement la commande finalisée.
    const fin = parcours({ carrier: 'chronopost', suivi: XW(3), depart: null, o: vente({ status: 'Commande finalisée - l\'acheteur a validé la commande', transaction_user_status: 'completed' }), etat: { s: 450 }, versement: iso(T0 - J) });
    dit(et(fin, 'argent').etat === 'fait' && et(fin, 'argent').t === T0 - J && fin.groupe === 'argent', 'P7 commande finalisée (450) + versement lu ⇒ argent versé, à la date du versement', JSON.stringify(et(fin, 'argent')));
    const finSans = parcours({ carrier: 'chronopost', suivi: XW(4), depart: null, o: vente({ status: 'Commande finalisée - l\'acheteur a validé la commande', transaction_user_status: 'completed' }), etat: { s: 450 } });
    dit(et(finSans, 'argent').etat === 'fait' && et(finSans, 'argent').t === null, 'P7 finalisée sans date de versement lue ⇒ fait, AUCUNE date');
    const verseSeul = parcours({ carrier: 'chronopost', suivi: XW(5), depart: null, etat: { s: 230 }, versement: iso(T0 - J) });
    dit(et(verseSeul, 'argent').etat === 'passu' && verseSeul.groupe !== 'argent', 'P7 une date de versement SANS commande finalisée ⇒ l’argent n’est PAS coché (seul le 450 le dit)', JSON.stringify(et(verseSeul, 'argent')));
    // « Pas su » ne vaut pas « oui ».
    const rien = SEm.parcoursEnvoi({ preuves: {}, depart: null, venteMs: iso(T0 - J), suivi: '' });
    dit(rien.etapes.every((e) => e.etat === 'passu' && e.t === null) && rien.groupe === null && rien.ici === -1, 'P8 aucune preuve ⇒ cinq « pas encore su », aucun groupe');
    // Une prise en charge datée AVANT la vente contredit l'identité ⇒ la ligne ne vaut rien.
    const avant = parcours({ carrier: 'chronopost', suivi: XW(6), depart: ligne('chronopost', XW(6), { priseAt: iso(T0 - 20 * J), etat: 'livre', etatAt: iso(T0 - 19 * J) }), o: vente({ status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action' }) });
    dit(et(avant, 'retire').etat === 'passu' && !avant.luChezTransporteur, 'P9 une prise en charge datée 14 jours avant la vente (autre colis) ⇒ ignorée', JSON.stringify(avant.etapes));
    // Le retour.
    const ret = parcours({ carrier: 'mondialrelay', suivi: MR(4), depart: ligne('mondialrelay', MR(4), { etat: 'retour_expediteur', etatAt: iso(T0 - J) }) });
    dit(ret.groupe === 'retour' && ret.retour && ret.retour.libelle === 'repart' && et(ret, 'retire').apresRetour === true && et(ret, 'retire').etat === 'passu', 'P10 le colis repart chez l’expéditeur ⇒ groupe « retour », chemin du retour dit, les étapes d’après grisées', JSON.stringify(ret.retour));
    const annul = SEm.parcoursEnvoi({ preuves: preuves({ o: vente({ status: 'Annulée' }) }), depart: null, venteMs: iso(T0 - J), bifurcation: { genre: 'annulee', libelle: 'Annulée' }, suivi: '' });
    dit(annul.groupe === null, 'P10 une vente annulée AVANT l’envoi n’est pas un envoi (aucun groupe)', String(annul.groupe));
  });

  // ── G. « Mes envois » ──────────────────────────────────────────────────────
  await essaie('G les groupes', async () => {
    const pc = (groupe, limite, lu = true) => ({ groupe, luChezTransporteur: lu, point: { limite, depuis: T0 - J } });
    const g = SEm.groupesEnvois([
      { cle: 'a', parcours: pc('aupoint', null) }, { cle: 'b', parcours: pc('aupoint', T0 + 3 * J) }, { cle: 'c', parcours: pc('aupoint', T0 + J) },
      { cle: 'd', parcours: pc('enroute', null, false) }, { cle: 'e', parcours: pc('argent', null, false) }, { cle: 'f', parcours: pc('retire', null) }, { cle: 'x', parcours: pc(null, null) },
    ]);
    dit(g.aupoint.map((x) => x.cle).join('') === 'cba', 'G1 « au point, pas retiré » : la date limite la plus proche d’abord, sans date à la fin', g.aupoint.map((x) => x.cle).join(''));
    dit(g.enroute.length === 1 && g.retire.length === 1 && g.argent.length === 1 && g.couverture.n === 6 && g.couverture.lus === 4, 'G2 quatre groupes ; couverture « 4 sur 6 lus chez le transporteur » (le reste : Vinted, e-mails)', JSON.stringify(g.couverture));
  });

  // ── I. l'identité ────────────────────────────────────────────────────────────
  await essaie('I l’identité', async () => {
    const bords = Array.from({ length: 50 }, (_, i) => ({ suivi: XW(100 + i), transaction: String(99000000100 + i), article: 'Nike Air Max 90 blanche T42', receivedAt: iso(T0 - 4 * J) }));
    const departs = new Map([[XW(107), ligne('chronopost', XW(107), { etat: 'disponible', etatAt: iso(T0 - 2 * H), lieuNom: 'Tabac Test', priseAt: iso(T0 - 2 * J) })]]);
    const l = SEm.etapesANotifier({ departs, bords, maintenant: T0 });
    dit(l.length === 1 && l[0].tx === '99000000107' && l[0].etape === 'aupoint' && l[0].cle === `envoi-aupoint-${XW(107)}`, 'I1 50 ventes au MÊME titre : seul le n° désigne la vente (la n° 107)', JSON.stringify(l));
    const deux = [...bords, { suivi: XW(107), transaction: '99000009999', article: 'Autre', receivedAt: iso(T0 - 4 * J) }];
    dit(SEm.etapesANotifier({ departs, bords: deux, maintenant: T0 }).length === 0, 'I2 un n° porté par deux transactions ⇒ rien (ambigu)');
    const src = sansCommentaires(fs.readFileSync(path.join(R, 'src/ecrans/Comptabilite.jsx'), 'utf8'));
    const corps = (src.match(/const parcoursEnvoiDe = \(o, litige = null, fp = null\) => \{[\s\S]*?\n  \};/) || [''])[0];
    dit(/const amb = !!\(su && ambigusFrise && ambigusFrise\.has\(su\)\);/.test(corps) && /const dep = su && !amb && /.test(corps) && /f\.suivi/.test(corps),
      'I3 l’app : la ligne du transporteur est celle du n° de SON bordereau (la frise), jamais lue pour un n° ambigu', corps.slice(0, 300));
  });

  // ── N. la notification ─────────────────────────────────────────────────────
  await essaie('N la notification', async () => {
    const bords = [{ suivi: XW(1), transaction: '99000000001', article: 'Nike Air Max 90 blanche T42', receivedAt: iso(T0 - 4 * J) }, { suivi: MR(1), transaction: '99000000002', article: 'Adidas Samba OG T40', receivedAt: iso(T0 - 4 * J) }];
    const L = (x) => new Map(x.map((t) => [t.suivi, t]));
    const dispo = ligne('chronopost', XW(1), { etat: 'disponible', etatAt: iso(T0 - 2 * H), arriveeAt: iso(T0 - 2 * H), lieuNom: 'Tabac Test', priseAt: iso(T0 - 2 * J) });
    const retire = ligne('mondialrelay', MR(1), { etat: 'retire', etatAt: iso(T0 - 3 * H), priseAt: iso(T0 - 3 * J) });
    const l1 = SEm.etapesANotifier({ departs: L([dispo, retire]), bords, maintenant: T0 });
    dit(l1.length === 2 && l1.some((x) => x.etape === 'aupoint' && x.lieu === 'Tabac Test') && l1.some((x) => x.etape === 'retire' && x.tx === '99000000002'), 'N1 « au point » (le nom LU du point) et « retiré » : chacun de sa lecture', JSON.stringify(l1));
    dit(SEm.etapesANotifier({ departs: L([{ ...dispo, lu: iso(T0 - 9 * H) }]), bords, maintenant: T0 }).length === 0, 'N2 une lecture de plus de 8 h ⇒ rien');
    dit(SEm.etapesANotifier({ departs: L([{ ...retire, etatAt: iso(T0 - 4 * J) }]), bords, maintenant: T0 }).length === 0, 'N2 un retrait d’il y a 4 jours (première passe) ⇒ rien : l’historique ne se réveille pas');
    dit(SEm.etapesANotifier({ departs: L([{ ...dispo, etat: 'en_route' }, { ...retire, etat: 'inconnu' }]), bords, maintenant: T0 }).length === 0, 'N3 en route / inconnu ⇒ aucune de ces deux notifications (seulement une étape LUE)');
    dit(SEm.etapesANotifier({ departs: L([dispo]), bords, autres: new Set([XW(1)]), maintenant: T0 }).length === 0, 'N4 le n° d’un achat ou d’un retour ⇒ rien');
    dit(SEm.etapesANotifier({ departs: L([ligne('chronopost', XW(9), { etat: 'disponible', etatAt: iso(T0 - H) })]), bords, maintenant: T0 }).length === 0, 'N4 un n° qu’aucun bordereau de vente ne porte ⇒ rien');
    const rows = [dispo, retire].map((t) => ({ ...t, limiteSure: 'false' }));
    const lignesBase = { [SEm.REQ_DEPARTS_ENVOI]: rows, [SEm.REQ_BORDS_ENVOI]: bords, [SEm.REQ_RETOURS_ENVOI]: [], [SEm.REQ_ACHATS_ENVOI]: [] };
    const cles = new Set(), sent = [];
    const passe = (o = {}) => SEm.passeSuiviEnvoi({ maintenant: T0, lire: async (q) => (o.panne && q === o.panne ? null : lignesBase[q]), reserver: async (c) => (cles.has(c) ? false : (cles.add(c), true)), envoyer: async (n) => { sent.push(n); }, texte: (n) => ({ title: n.etape, body: n.lieu }), active: async () => o.active !== false, lien: () => '/' });
    const p1 = await passe(), p2 = await passe();
    dit(p1.envoyees === 2 && p2.envoyees === 0 && p2.deja === 2 && sent.length === 2 && sent.every((n) => n.cat === 'envoi') && sent.some((n) => n.redaction.sorte === 'envoiPoint') && sent.some((n) => n.redaction.sorte === 'envoiRetire'),
      'N5 la passe : catégorie « envoi », UNE fois par colis et par étape', JSON.stringify({ p1, p2, n: sent.length }));
    cles.clear(); sent.length = 0;
    let p3 = null; try { p3 = await passe({ panne: SEm.REQ_ACHATS_ENVOI }); } catch (_) { p3 = null; }
    dit(!!p3 && p3.fait === false && sent.length === 0, 'N6 une lecture ratée (n° des achats) ⇒ rien envoyé', JSON.stringify(p3));
    const p4 = await passe({ active: false });
    dit(p4.n === 0 && sent.length === 0, 'N7 réglage « Suivi de tes envois » coupé ⇒ rien');
  });

  // ── T. les textes et la famille ────────────────────────────────────────────
  await essaie('T les textes', async () => {
    const Rd = await importer('api/_lib/notif-redaction.js');
    const NT = await importer('api/_lib/notif-textes.js');
    const tx = {};
    for (const l of ['fr', 'en', 'es', 'it', 'de']) tx[l] = [Rd.rediger({ sorte: 'envoiPoint', article: 'Nike Air Max 90 blanche taille 42', lieu: 'Tabac du Centre' }, { langue: l, maintenant: T0 }), Rd.rediger({ sorte: 'envoiRetire', article: 'Nike Air Max 90 blanche taille 42' }, { langue: l, maintenant: T0 })];
    dit(/^Colis au point relais/.test(tx.fr[0].title) && /Tabac du Centre/.test(tx.fr[0].body) && /^Colis retiré par l’acheteur/.test(tx.fr[1].title) && /argent/i.test(tx.fr[1].body), 'T1 « Colis au point relais · … » (le point lu) et « Colis retiré par l’acheteur » (l’argent suit)', JSON.stringify(tx.fr));
    dit(Object.values(tx).flat().every((t) => t && t.title.length <= 40 && t.body.length <= 90) && new Set(Object.values(tx).map((t) => t[0].title)).size === 5, 'T2 cinq langues, titre ≤ 40, corps ≤ 90', JSON.stringify(tx));
    dit(NT.FAMILLES.some((f) => f.id === 'envois' && f.def === true) && NT.familleDe('envoi') === 'envois' && NT.decisionNotif({ familles: { envois: false } }, 'envoi') === false && NT.decisionNotif({}, 'envoi') === true, 'T3 la famille « Suivi de tes envois » : son interrupteur (allumée par défaut)');
    const Ap = await importer('api/_lib/notif-apercus.js');
    const ap = Ap.apercuFamille('envois');
    dit(!!ap && ap.exemples.length === 2 && /Tabac du Centre/.test(ap.exemples[0].body), 'T4 l’aperçu de Paramètres sort de la VRAIE fabrique');
    const reg = fs.readFileSync(path.join(R, 'src', 'ecrans', 'Reglages.jsx'), 'utf8');
    dit(/ids: \[[^\]]*'envois'[^\]]*\]/.test(reg.match(/\{ id: 'colis', titre: 'Colis', ids: \[[^\]]*\] \}/) ? reg.match(/\{ id: 'colis', titre: 'Colis', ids: \[[^\]]*\] \}/)[0] : ''), 'T4 rangée dans le groupe « Colis » de Paramètres → Notifications');
    const B = await importer('api/_lib/notif-belle.js');
    dit(B.ICONE_FAMILLE.envois && B.GESTE_FAMILLE.envois, 'T5 icône et geste de la cloche');
  });

  // ── C. la vraie route ───────────────────────────────────────────────────────
  await essaie('C la route ?moment=colis', async () => {
    const n = VGS(7), tx = '99000000777';
    base.set(`${A}|email_bord_${tx}`, { type: 'bordereau', suivi: n, transaction: tx, article: 'Nike Air Max 90 blanche T42', receivedAt: iso(NOW - 4 * J) });
    // En route, pris en charge, dernier essai il y a 7 h : seule la nouvelle visite des colis vendus le rend dû entre les crons.
    base.set(`${A}|depart_vinted_${n}`, { v: 1, sens: 'sortant', suivi: n, carrier: 'vinted', etat: 'en_route', etatAt: iso(NOW - 2 * J), priseAt: iso(NOW - 3 * J), lu: iso(NOW - 7 * H), essai: iso(NOW - 7 * H), essaiRes: 'ok', essais: 0, fini: true, clos: false });
    base.set(`${A}|push_subs`, { subs: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/banc-suivi-envoi', keys: { p256dh: 'BBanc', auth: 'banc' } }] });
    let etatVg = 'point';
    reponseTransporteur = (u) => (u.hostname === 'carrier.vintedgo.com' && u.href.includes(n)
      ? { status: 200, ctype: 'application/json', body: etatVg === 'point'
        ? vgJson([{ group: 'ready_for_pickup', ms: NOW - 2 * H, address: '1 Rue Exemple, Testville, FR', message: 'Ton colis attend (Consigne TEST)' }, { group: 'in_transit', ms: NOW - 2 * J }])
        : vgJson([{ group: 'delivered', ms: NOW - 30 * MIN }, { group: 'ready_for_pickup', ms: NOW - 2 * H }, { group: 'in_transit', ms: NOW - 2 * J }]) }
      : null);
    const route = (await importer('api/ship-reminders.js')).default;
    const go = async () => { const res = faireRes(); await route({ method: 'GET', query: { moment: 'colis' }, headers: { authorization: 'Bearer cle-banc-cron' } }, res); return res; };
    const res = await go();
    const apres = base.get(`${A}|depart_vinted_${n}`) || {};
    const dedup = (base.get(`${A}|push_dedup`) || {}).keys || [];
    dit(res.code === 200 && appels.some((x) => /vintedgo/.test(x.host) && x.url.includes(n)) && apres.etat === 'disponible', 'C1 le colis vendu EN ROUTE est visité entre les crons et relu chez Vinted Go (au point)', JSON.stringify({ code: res.code, etat: apres.etat, appels: appels.map((x) => x.host) }));
    const pt = envois.filter((x) => /Colis au point relais/.test(x));
    dit(dedup.includes(`envoi-aupoint-${n}`) && pt.length === 1, 'C2 « Colis au point relais » sonne sur son téléphone, réservé une fois', JSON.stringify({ dedup, envois: envois.map((x) => x.slice(0, 120)) }));
    base.set(`${A}|depart_vinted_${n}`, { ...(base.get(`${A}|depart_vinted_${n}`) || {}), essai: iso(NOW - 3 * H) });
    await go();
    dit(envois.filter((x) => /Colis au point relais/.test(x)).length === 1, 'C3 un second passage ne re-sonne pas');
    etatVg = 'retire';
    base.set(`${A}|depart_vinted_${n}`, { ...(base.get(`${A}|depart_vinted_${n}`) || {}), essai: iso(NOW - 7 * H) });
    await go();
    const fin = base.get(`${A}|depart_vinted_${n}`) || {};
    const rt = envois.filter((x) => /Colis retiré par l’acheteur/.test(x));
    dit(fin.etat === 'retire' && rt.length === 1 && ((base.get(`${A}|push_dedup`) || {}).keys || []).includes(`envoi-retire-${n}`), 'C4 retiré lu chez Vinted Go ⇒ « Colis retiré par l’acheteur », une fois', JSON.stringify({ etat: fin.etat, n: rt.length }));
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + ((e && e.stack) || e)); process.exit(1); });
