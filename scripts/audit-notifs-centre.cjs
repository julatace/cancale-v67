#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE CENTRE DE NOTIFICATIONS, LES TYPES, LES HEURES CALMES (5 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (5 nov.) : « une meilleure interface, plus pro, personnalisable comme
// on veut ; cliquer une notification amène directement sur ce qui est arrivé ».
// Ce banc EXÉCUTE la vraie porte d'envoi (`api/_lib/push.js`, `sendPushToAll`),
// la vraie route `api/push.js` (essai) et la vraie route `api/ship-reminders.js`
// (rappel du soir) contre une fausse base (forme app_data owner/id/data,
// comparer-et-échanger sur `rev`), téléphones interceptés (web-push).
//   T  un type éteint ⇒ rien n'est envoyé NI rangé, même appelé en direct
//   J  chaque notification passée est rangée dans le centre du BON vendeur
//      (numéro, type, adresse de l'objet), et le téléphone reçoit ce numéro
//   C  heures calmes (heure de Paris) ⇒ rien ne sonne, rangée « calme » ;
//      la double vente sonne quand même (par défaut) ; hors plage ⇒ sonne
//   R  regroupement ⇒ une notification par type (tag), « +N autres » seulement
//      si ce qu'il a lu a été relu
//   P  « pas su » : le centre illisible n'empêche pas l'envoi ; aucun appareil
//      ⇒ rangée « sans appareil » ; la clé du serveur absente ⇒ « serveur »
//   S  le rappel du soir (route exécutée) passe par la même porte
// Données inventées (le dépôt est public).
'use strict';
const path = require('path');
const R = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 400)); } };
const J = '11111111-1111-4111-8111-111111111111';
const K = '22222222-2222-4222-8222-222222222222';

// ── La fausse base ─────────────────────────────────────────────────────────
let base = new Map();
let panne = new Set();                     // ids dont la LECTURE répond 503
const k = (o, i) => o + '|' + i;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
const projeter = (sel, id, d) => {
  if (!sel || sel === 'data') return { id, data: d };
  const o = { id };
  for (const p of sel.split(',')) {
    const m = /^(?:(\w+):)?data->>?(\w+)$/.exec(p);
    if (m) o[m[1] || m[2]] = d ? d[m[2]] : undefined;
    else if (p === 'id') o.id = id;
  }
  return o;
};
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url));
  const q = u.searchParams;
  const methode = (o.method || 'GET').toUpperCase();
  if (u.pathname.endsWith('/rpc/vrm_acces_pour')) return rep(true);
  if (!u.pathname.endsWith('/rest/v1/app_data')) return rep([]);
  const id = (q.get('id') || '').replace(/^eq\./, '');
  const owner = (q.get('owner') || '').replace(/^eq\./, '');
  if (methode === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep([{ owner: J }]);
    if (panne.has(id)) return rep('<html>522</html>', 522);
    if (id === 'main' && !owner) return rep([{ owner: J }]);
    if (!id || !owner) return rep([]);
    const d = base.get(k(owner, id));
    return rep(d === undefined ? [] : [projeter(q.get('select'), id, d)]);
  }
  if (methode === 'POST') {
    const lignes = JSON.parse(o.body || '[]');
    const ignore = /ignore-duplicates/.test(((o.headers || {}).Prefer) || '');
    const out = [];
    for (const l of lignes) {
      if (!l.owner) return rep({ message: 'sans vendeur' }, 400);
      if (panne.has(l.id)) return rep('<html>522</html>', 522);
      if (ignore && base.has(k(l.owner, l.id))) continue;
      base.set(k(l.owner, l.id), JSON.parse(JSON.stringify(l.data))); out.push({ id: l.id });
    }
    return rep(/return=representation/.test(((o.headers || {}).Prefer) || '') || ignore ? out : '', 201);
  }
  if (methode === 'PATCH') {
    const kk = k(owner, id);
    if (!owner || !base.has(kk)) return rep([]);
    if (panne.has(id)) return rep('<html>522</html>', 522);
    const d = base.get(kk);
    const rev = q.get('data->>rev');
    if (rev === 'is.null' ? d.rev != null : rev && String(d.rev) !== rev.replace(/^eq\./, '')) return rep([]);
    base.set(kk, JSON.parse(o.body).data);
    return rep([{ id }]);
  }
  return rep([]);
};
const faireRes = () => { const x = { code: null, corps: null }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.send = (b) => { x.corps = b; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };

// ── Les téléphones ─────────────────────────────────────────────────────────
const pushes = [];
const TEL_J = 'https://web.push.apple.com/iphone-banc-j', TEL_K = 'https://web.push.apple.com/iphone-banc-k';
const prepare = (prefsJ, { appareilsJ = true, prefsK = null } = {}) => {
  base = new Map(); pushes.length = 0; panne = new Set();
  if (appareilsJ) base.set(k(J, 'push_subs'), { subs: [{ endpoint: TEL_J, keys: { p256dh: 'x', auth: 'y' } }] });
  base.set(k(K, 'push_subs'), { subs: [{ endpoint: TEL_K, keys: { p256dh: 'x', auth: 'y' } }] });
  if (prefsJ) base.set(k(J, 'push_prefs'), prefsJ);
  if (prefsK) base.set(k(K, 'push_prefs'), prefsK);
};
const journal = (o = J) => (base.get(k(o, 'push_journal')) || { entrees: [] });
const hhmm = (m) => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

(async () => {
  process.env.VRM_OWNER_UID = J;
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
  process.env.CRON_SECRET = 'cron-banc';
  const webpush = require(path.join(R, 'node_modules', 'web-push'));
  webpush.sendNotification = async (sub, body) => { pushes.push({ tel: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };
  const P = await import('file://' + path.join(R, 'api', '_lib', 'push.js'));
  const T = await import('file://' + path.join(R, 'api', '_lib', 'notif-textes.js'));
  const { contexteVendeur } = await import('file://' + path.join(R, 'api', '_lib', 'owner.js'));
  const comme = (o, f) => { P.oublierPrefsVues(); return contexteVendeur.run({ owner: o }, f); };
  const VENTE = { cat: 'vente', title: '💸 Vendu !', body: 'Baskets de banc — 40 € (compte A)', tag: 'sale-30000001', url: '/?tab=ventes&site=vinted&cible=vente&tx=30000001' };
  const DV = { cat: 'doublevente', title: '⚠️ N°12 vendu sur Vinted · encore en ligne sur Leboncoin', body: 'Baskets de banc', tag: 'dv-12', url: '/?tab=annonces&site=leboncoin&cible=doublon&plat=leboncoin&num=12' };
  // L'heure de Paris, calculée ICI (pas par le code jugé).
  const mParis = (() => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()); return Number(p.find((x) => x.type === 'hour').value) * 60 + Number(p.find((x) => x.type === 'minute').value); })();

  await essaie('T — un type éteint', async () => {
    prepare({ familles: { ventes: false } });
    const r = await comme(J, () => P.sendPushToAll(VENTE));
    dit(pushes.length === 0 && journal().entrees.length === 0 && r.coupe === 'preference', 'T1 « Ventes » éteint : envoi direct refusé à la porte — rien sur le téléphone, rien dans le centre', JSON.stringify(r));
    prepare({ familles: { ventes: false } });
    await comme(J, () => P.sendPushToAll(DV));
    dit(pushes.length === 0, 'T2 la double vente hérite de « Ventes » éteint tant qu’elle n’est pas posée');
    prepare({ familles: { ventes: false, doublevente: true } });
    await comme(J, () => P.sendPushToAll(DV));
    dit(pushes.length === 1, 'T3 « Double vente » allumée à part : elle sonne, Ventes reste éteint');
    prepare({ familles: { rappels: false } });
    await comme(J, () => P.sendPushToAll({ cat: 'test', title: 'Essai', body: 'x', tag: 't', url: '/' }));
    dit(pushes.length === 1 && journal().entrees[0] && journal().entrees[0].famille === 'test', 'T4 l’essai sonne toujours et se range comme « essai »');
  });

  await essaie('J — le centre', async () => {
    prepare();
    await comme(J, () => P.sendPushToAll(VENTE));
    const e = journal().entrees[0] || {};
    const p = pushes[0] || {};
    dit(pushes.length === 1 && e.seq === 1 && e.etat === 'envoyee' && e.famille === 'ventes' && e.cat === 'vente', 'J1 rangée : n°1, type « ventes », état « envoyée »', JSON.stringify(e));
    dit(e.url === VENTE.url && e.titre === VENTE.title && e.texte === VENTE.body, 'J2 l’entrée garde l’adresse de l’OBJET (la vente, par son n° de transaction) et le texte envoyé');
    dit(p.notif === 1 && p.url === VENTE.url && !('cat' in p) && !('_cat' in p), 'J3 le téléphone reçoit le n° de l’entrée à côté de l’adresse ; la catégorie ne part pas', JSON.stringify(p));
    await comme(J, () => P.sendPushToAll({ ...VENTE, tag: 'sale-30000002', url: '/?tab=ventes&cible=vente&tx=30000002' }));
    dit(journal().n === 2 && journal().entrees[0].seq === 2 && journal().entrees[1].seq === 1, 'J4 la plus récente en tête, le numéro ne redescend jamais');
    await comme(K, () => P.sendPushToAll(VENTE));
    dit(journal(K).entrees.length === 1 && journal(J).entrees.length === 2 && pushes.filter((x) => x.tel === TEL_K).length === 1, 'J5 deux vendeurs : chacun SON centre, SON téléphone');
    prepare();
    await comme(J, () => P.sendPushToAll({ ...VENTE, url: 'https://exemple.test/piege' }));
    dit((journal().entrees[0] || {}).url === '/', 'J6 une adresse hors de l’app n’entre pas dans le centre', (journal().entrees[0] || {}).url);
  });

  await essaie('C — heures calmes', async () => {
    const dedans = { actif: true, debut: hhmm(mParis - 60), fin: hhmm(mParis + 60) };
    prepare({ calme: dedans });
    const r = await comme(J, () => P.sendPushToAll(VENTE));
    dit(pushes.length === 0 && r.calme === true, 'C1 pendant les heures calmes (heure de Paris) : rien ne sonne', JSON.stringify(r));
    dit((journal().entrees[0] || {}).etat === 'calme', 'C2 … et elle est rangée dans le centre, « heures calmes »');
    await comme(J, () => P.sendPushToAll(DV));
    dit(pushes.length === 1 && /vendu sur Vinted/.test(pushes[0].title), 'C3 la double vente sonne quand même (par défaut)');
    prepare({ calme: { ...dedans, sauf: [] } });
    await comme(J, () => P.sendPushToAll(DV));
    dit(pushes.length === 0, 'C4 sans exception choisie, la double vente se tait aussi');
    prepare({ calme: { actif: true, debut: hhmm(mParis + 60), fin: hhmm(mParis + 120) } });
    await comme(J, () => P.sendPushToAll(VENTE));
    dit(pushes.length === 1, 'C5 hors de la plage : elle sonne');
    prepare({ calme: { ...dedans, actif: false } });
    await comme(J, () => P.sendPushToAll(VENTE));
    dit(pushes.length === 1, 'C6 heures calmes éteintes : elle sonne');
    dit(typeof T.dansHeuresCalmes === 'function' && T.dansHeuresCalmes({ calme: { actif: true, debut: '22:00', fin: '08:00' } }, 'vente', Date.parse('2026-11-05T22:30:00Z')) === true
      && T.dansHeuresCalmes({ calme: { actif: true, debut: '22:00', fin: '08:00' } }, 'vente', Date.parse('2026-11-05T12:00:00Z')) === false, 'C7 une plage qui passe minuit (22:00 → 08:00, heure de Paris)');
  });

  await essaie('R — regroupement', async () => {
    prepare({ regrouper: true });
    base.set(k(J, 'push_journal_lu'), { luJusqua: 0, lus: [] });
    await comme(J, () => P.sendPushToAll(VENTE));
    await comme(J, () => P.sendPushToAll({ ...VENTE, tag: 'sale-30000002' }));
    dit(pushes.length === 2 && pushes.every((x) => x.tag === 'vrm-groupe-ventes'), 'R1 une notification PAR TYPE sur le téléphone (la seconde remplace la première)', pushes.map((x) => x.tag).join(' '));
    dit(!/autre/.test(pushes[0].body) && /\+1 autre dans VRM$/.test(pushes[1].body), 'R2 la seconde dit « +1 autre dans VRM »', pushes[1] && pushes[1].body);
    base.set(k(J, 'push_journal_lu'), { luJusqua: 2, lus: [] });
    await comme(J, () => P.sendPushToAll({ ...VENTE, tag: 'sale-30000003' }));
    dit(!/autre/.test(pushes[2].body), 'R3 ce qu’il a déjà lu ne compte plus');
    panne.add('push_journal_lu');
    await comme(J, () => P.sendPushToAll({ ...VENTE, tag: 'sale-30000004' }));
    dit(pushes.length === 4 && !/autre/.test(pushes[3].body), 'R4 « lu » illisible : pas de « +N » inventé, la notification part');
    prepare();
    await comme(J, () => P.sendPushToAll(VENTE));
    dit(pushes[0].tag === VENTE.tag, 'R5 sans regroupement, chaque notification garde son propre tag');
  });

  await essaie('P — pas su, pas d’appareil', async () => {
    prepare();
    panne.add('push_journal');
    const r = await comme(J, () => P.sendPushToAll(VENTE));
    dit(pushes.length === 1 && !('notif' in pushes[0]) && r.sent === 1, 'P1 le centre illisible n’empêche jamais l’envoi (et aucun n° inventé)', JSON.stringify(r));
    prepare(null, { appareilsJ: false });
    await comme(J, () => P.sendPushToAll(VENTE));
    dit(pushes.length === 0 && (journal().entrees[0] || {}).etat === 'sans-appareil', 'P2 aucun appareil : rangée « sans appareil » (le centre reste la trace)');
    prepare();
    webpush.sendNotification = async () => { const e = new Error('passagère'); e.statusCode = 500; throw e; };
    await comme(J, () => P.sendPushToAll(VENTE));
    dit((journal().entrees[0] || {}).etat === 'echec', 'P3 aucun appareil ne l’accepte : le centre ne dit pas « envoyée »', (journal().entrees[0] || {}).etat);
    webpush.sendNotification = async (sub, body) => { pushes.push({ tel: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };
  });

  await essaie('S — le rappel du soir passe par la même porte', async () => {
    prepare({ familles: { rappels: false } });
    const route = await import('file://' + path.join(R, 'api', 'ship-reminders.js'));
    const res = faireRes();
    await route.default({ method: 'GET', query: { moment: 'soir' }, headers: { authorization: 'Bearer cron-banc' } }, res);
    const soirDe = (r) => JSON.stringify(((r.corps || {}).bilans || []).map((b) => b && b.soir));
    dit(/désactivé par le vendeur/.test(soirDe(res)) && pushes.length === 0 && journal().entrees.length === 0, 'S1 « Rappels » éteint : la route du soir (exécutée) se tait — la veille au soir suit « Rappels »', `${res.code} ${soirDe(res)}`);
    prepare({ familles: { poster: false, rappels: true } });
    const res2 = faireRes();
    await route.default({ method: 'GET', query: { moment: 'soir' }, headers: { authorization: 'Bearer cron-banc' } }, res2);
    dit(!/désactivé par le vendeur/.test(soirDe(res2)), 'S2 « Rappels » allumé (même « Colis à poster » éteint) : la route du soir ne se dit plus coupée', soirDe(res2));
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
