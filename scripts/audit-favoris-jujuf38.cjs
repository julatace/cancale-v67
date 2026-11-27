#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  5.455.6 — LE CAS DE JULIEN (27 nov. 22:42, compte jujuf38) DE BOUT EN BOUT, SUR LE VRAI CODE
//  Cinq favoris du même article (N°180, 55 €), cinq personnes, des notifications au lien web mesuré
//  `/items/N/want_it/new?offering_id=U`, AUCUNE création native apprise (pas de `wreq_api_v2_conversations`), un dressing
//  ancien. Avant : « Ignoré · acheteur pas encore confirmé » ×5, rien ne pouvait partir.
//   J1 la carte du serveur (`apercu`, api/compte → api/_lib/favoris.js → favoris-carte.js) : les 5 cochables, aucune raison
//   J2 `lancer` (la même route) : la file des 5, chacun vers SA personne (offering_id), jamais le user_id commun
//   J3 les 5 envois par le VRAI background.js (`executerMessageFavori`, chemin des requêtes, `consommer` / `verifier` /
//      `terminer` par la vraie route) : 5 demandes, 5 offres (49,50 €), 5 messages, à 5 personnes distinctes ; « 5 envoyés »
//   J4 une notification SANS personne (lien sans offering_id) : dite « sans_acheteur », les autres restent cochables
//   J5 une notification au lien d'APPLICATION (`vintedfr://messaging?item_id=&user_id=`) : prouvée seule
//  `--mutation=nom` ; `--prouve`. Données inventées à la forme mesurée.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const RACINE = process.env.JUJU_RACINE || path.join(__dirname, '..');   // JUJU_RACINE=<arbre d'avant> : rouge attendu
const MUTATIONS = {
  'sans-preuve-directe': ['api/_lib/favoris-cibles.js', "  if(directs.every(Boolean))return directs;", ''],
  'offering-pas-personne': ['api/_lib/favoris-cibles.js', "ks[0]!=='offering_id'", "ks[0]!=='offering_idx'"],
  'user-id-commun': ['api/_lib/favoris-cibles.js', "&&user!==id(n.user_id)", ''],
  'trace-exigee': ['api/_lib/favoris.js', "rows.filter(x=>x.id===ids[2]).length!==1||rows.filter(x=>x.id===ids[1]).length>1", "ids.slice(1).some(id=>rows.filter(x=>x.id===id).length!==1)"],
  'dressing-bloque': ['api/_lib/favoris-carte.js', "const ed = etatDressingAuto(dressing, maintenant), dressingSur = !ed;", "const ed = etatDressingAuto(dressing, maintenant), dressingSur = !ed; if (ed) return { etat: 'bloque', raison: ed, lus, totalLus: lignes.length, file };"],
  'raison-vague': ['api/_lib/favoris-carte.js', "p === 'sans_acheteur' ? 'sans_acheteur' : 'non_prouve'", "'non_prouve'"],
};
const argMut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) { const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' }); const rouge = r.status === 1 && /❌ J\d/.test(r.stdout || ''); console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`); if (!rouge) rate++; }
  process.exit(rate ? 1 : 0);
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 500) : '')); } };
// La fausse base et l'appel de la route : ceux de audit-favoris-auto.cjs (même forme servie), repris tels quels.
const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', UID = '123', NEUTRE = '00000000-0000-0000-0000-000000000000', H = 3600000;
const srcAuto = fs.readFileSync(path.join(__dirname, 'audit-favoris-auto.cjs'), 'utf8');
// eslint-disable-next-line no-eval
const { faireBase, appelant } = eval('(()=>{' + srcAuto.slice(srcAuto.indexOf('function lirChemin'), srcAuto.indexOf('// ── Le monde du vendeur')) + srcAuto.slice(srcAuto.indexOf('function appelant'), srcAuto.indexOf('const REGLAGES')) + ';return {faireBase,appelant};})()');
(async () => {
  let racine = RACINE;
  if (argMut) {
    const M = MUTATIONS[argMut]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
    racine = fs.mkdtempSync(path.join(os.tmpdir(), 'jujuf38-'));
    for (const d of ['api', 'src']) fs.cpSync(path.join(RACINE, d), path.join(racine, d), { recursive: true });
    fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(racine, 'node_modules'));
    fs.writeFileSync(path.join(racine, 'package.json'), fs.readFileSync(path.join(RACINE, 'package.json')));
    const f = path.join(racine, M[0]), s = fs.readFileSync(f, 'utf8'); if (!s.includes(M[1])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
    fs.writeFileSync(f, s.split(M[1]).join(M[2]));
    process.on('exit', () => { try { fs.rmSync(racine, { recursive: true, force: true }); } catch (_) {} });
  }
  const { default: handler } = await import(path.join(racine, 'api', 'compte.js'));
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  const T0 = Date.parse('2026-11-27T21:42:00Z'), ancienNow = Date.now; let horloge = T0; Date.now = () => horloge;
  const ITEM = '7000000180', COMMUN = 9000000001;
  const ACHETEURS = ['3000000001', '3000000002', '3000000003', '3000000004', '3000000005'];   // mika8890, kenellecancale35, aloyslrt, j13no, matteosantarossa25 (ids inventés)
  const notif = (i, lien) => ({ id: 'jn' + i, user_id: COMMUN, body: 'Quelqu’un a ajouté ton article à ses favoris.', link: lien, created_at: new Date(T0 - (i + 1) * 24 * H).toISOString() });
  const monde = (b, notifs) => {
    b.poser(`harvest_${UID}_notifications`, { uid: UID, type: 'notifications', domain: 'www.vinted.fr', payload: { notifications: notifs } });
    // PAS de `harvest_${UID}_wreq_api_v2_conversations` : aucune création native apprise sur ce compte.
    b.poser(`vrm_favoris_reglages_${UID}`, { version: 1, envoisActifs: false, message: 'Bonjour, il te plaît toujours ?', pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null });
    b.poser(`harvest_${UID}_listings`, { capturedAt: new Date(T0 - 30 * H).toISOString(), payload: { pagination: { total_entries: 1 }, items: [{ id: Number(ITEM), title: 'salomon XT-6 noir taille 42,5', price: { amount: '55.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, is_reserved: false }] } });   // ANCIEN (30 h)
    b.poser('main', { vinted_offres_garde: null });   // garde des ventes ailleurs pas lue
  };
  const web = (i) => `/items/${ITEM}/want_it/new?offering_id=${ACHETEURS[i]}`;
  // ── J1–J3 ──
  const b = faireBase(); global.fetch = b.fetch; const call = appelant(handler, b);
  monde(b, ACHETEURS.map((_, i) => notif(i, web(i))));
  const ap = await call('apercu', { carte: true });
  const tous = (ap.body && ap.body.apercu && ap.body.apercu.tous) || [];
  dit(ap.code === 200 && tous.length === 5 && tous.every((x) => x.cochable === true && !x.raison), 'J1 la carte : les 5 favoris cochables (aucune trace apprise, dressing ancien, garde pas lue)', JSON.stringify({ code: ap.code, etat: ap.body && ap.body.apercu && ap.body.apercu.etat, raison: ap.body && ap.body.apercu && ap.body.apercu.raison, tous: tous.map((x) => [x.id, x.cochable, x.raison]) }));
  const reglages = ap.body && ap.body.apercu && ap.body.apercu.reglages;
  const la = await call('lancer', { selection: tous.map((x) => x.id), reglages, carte: true });
  const jobs = (la.body && la.body.vue && la.body.vue.jobs) || [];
  const fileData = () => [...b.lignes.values()].find((r) => r.owner === NEUTRE && /^favoris_file_/.test(r.id))?.data;
  const dests = (fileData()?.groupes?.[U]?.jobs || []).map((j) => j.recipientId).sort();
  dit(la.code === 200 && jobs.length === 5 && dests.join() === ACHETEURS.join() && !dests.includes(String(COMMUN)), 'J2 lancer : la file des 5, chacun vers SA personne (offering_id), jamais le user_id commun', JSON.stringify({ code: la.code, m: la.body && la.body.message, dests }));
  // ── J3 : le VRAI background.js, la VRAIE route pour consommer / verifier / terminer ──
  const { faireFond } = require('./_fond-vm.cjs');
  const UUIDS = ACHETEURS.map((a, i) => `0${i}a1fdff-71a1-4c2b-9d3e-0123456789ab`);
  const TX = ACHETEURS.map((_, i) => 6000 + i);
  const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
  const f = faireFond({ src: path.join(RACINE, 'vinted-sync-extension', 'background.js'), connecte: UID, comptes: [ACC], lignes: { main: { vinted_annonce_numeros: { [ITEM]: { numero: '180', min: '40' } } } }, store: { __commeBleamDefaut: true, __favorisVintex: true },
    vinted: (e) => {
      if (e.methode === 'POST' && e.chemin === '/messaging/main/inquiries') { const c = JSON.parse(e.corps || '{}'); const i = ACHETEURS.indexOf(String(c.receiver_id)); return i < 0 || JSON.stringify(c.item_ids) !== JSON.stringify([ITEM]) ? { status: 422, body: {} } : { status: 201, body: { inquiry_id: 'q' + i, transaction_id: TX[i], conversation_id: UUIDS[i], read_after_write_token: 'eyJhbGc.x.y' } }; }
      const mc = /^\/messaging\/main\/conversations\/([0-9a-f-]{36})$/.exec(e.chemin.split('?')[0]);
      if (e.methode === 'GET' && mc) { const i = UUIDS.indexOf(mc[1]); return { status: 200, body: { conversation: { id: mc[1], allow_reply: true, opposite_users: [{ id: Number(ACHETEURS[i]) }], data: {}, messages: [] } } }; }
      const mt = /^\/api\/v2\/transactions\/(\d+)$/.exec(e.chemin);
      if (e.methode === 'GET' && mt) { const i = TX.indexOf(Number(mt[1])); return { status: 200, body: { transaction: { id: TX[i], item_id: Number(ITEM), buyer_id: Number(ACHETEURS[i]), seller_id: Number(UID), item_title: 'salomon XT-6 noir taille 42,5', item: { id: Number(ITEM), price: { amount: '55.0', currency_code: 'EUR' } } } } }; }
      if (e.methode === 'POST' && /^\/api\/v2\/transactions\/\d+\/offers$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && /^\/messaging\/main\/conversations\/[0-9a-f-]{36}\/replies$/.test(e.chemin)) return { status: 201, body: { ok: true } };
      if (e.methode === 'GET' && e.chemin === '/api/v2/authorization/check/phone_verification') return { status: 200, body: {} };
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.ctx.fetch = async (url, op = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) { const c = JSON.parse(op.body || '{}'); global.fetch = b.fetch; const r = await call(c.action, c); return { ok: r.code >= 200 && r.code < 300, status: r.code, json: async () => r.body }; }
    return fetchFond(url, op);
  };
  f.ctx.notifierApp = async () => {};
  const resultats = [];
  for (let k = 0; k < 5; k++) {
    const s = await call('suivant', { carte: true }); const t = s.body && s.body.travail;
    if (!t || typeof t.jeton !== 'string') { resultats.push({ k, sans: true, m: s.body && (s.body.vue && s.body.vue.raison) }); horloge += 2 * 60000; continue; }
    const r = await f.ctx.executerMessageFavori(UID, ACC, t, { manuel: true }).catch((x) => ({ erreur: String(x) }));
    global.fetch = b.fetch;
    const brut = r ? { ok: !!r.ok, data: r.json || null } : {};
    await call('terminer', { jeton: t.jeton, brut, carte: true });
    resultats.push({ k, res: r && r.json && r.json.resultat, raison: r && r.json && r.json.raison });
    horloge += 2 * 60000;
  }
  const W = f.j.vinted.filter((v) => v.methode !== 'GET');
  const corps = (re) => W.filter((x) => re.test(x.chemin)).map((x) => { try { return JSON.parse(x.corps); } catch (_) { return null; } });
  const dem = corps(/inquiries$/), off = corps(/\/offers$/), msg = corps(/replies$/);
  const vue = (await call()).body.vue || {};
  const envoyes = (vue.jobs || []).filter((j) => j.etat === 'envoye').length;
  dit(dem.length === 5 && new Set(dem.map((x) => x && x.receiver_id)).size === 5 && off.length === 5 && off.every((x) => x && x.offer && x.offer.price === '49.5') && msg.length === 5 && envoyes === 5,
    `J3 les 5 envoyés par le vrai background.js : 5 demandes à 5 personnes, 5 offres à 49,50 €, 5 messages ; « ${envoyes} envoyés »`, JSON.stringify({ resultats, dem: dem.length, off: off.map((x) => x && x.offer && x.offer.price), msg: msg.length, envoyes }));
  // ── J4 : une notification SANS personne ──
  { const b2 = faireBase(); global.fetch = b2.fetch; const c2 = appelant(handler, b2);
    monde(b2, [notif(0, web(0)), notif(1, `/items/${ITEM}/want_it/new`), notif(2, web(2))]);
    const a2 = await c2('apercu', { carte: true }); const t2 = (a2.body && a2.body.apercu && a2.body.apercu.tous) || [];
    const sans = t2.find((x) => x.id === 'jn1'), autres = t2.filter((x) => x.id !== 'jn1');
    dit(sans && sans.cochable === false && sans.raison === 'sans_acheteur' && autres.length === 2 && autres.every((x) => x.cochable === true), 'J4 une notification sans personne ⇒ « sans_acheteur » (précis), les deux autres restent cochables', JSON.stringify(t2.map((x) => [x.id, x.cochable, x.raison]))); }
  // ── J5 : le lien d'application ──
  { const R = await import(path.join(racine, 'api', '_lib', 'favoris-cibles.js'));
    const cap = { uid: UID, type: 'notifications', domain: 'www.vinted.fr', payload: { notifications: [{ id: 'ja', user_id: COMMUN, body: 'Quelqu’un a ajouté ton article à ses favoris.', link: `vintedfr://messaging?item_id=${ITEM}&user_id=${ACHETEURS[3]}&portal=fr` }] } };
    let r; try { r = R.resoudreCiblesFavoris({ uid: UID, capture: cap, selection: ['ja'] }); } catch (e) { r = { erreur: e.message }; }
    const d = R.identiteDirecteFavori({ link: `vintedfr://messaging?item_id=${ITEM}&user_id=${UID}`, user_id: COMMUN }, UID, 'www.vinted.fr');
    const d2 = R.identiteDirecteFavori({ link: `/items/${ITEM}/want_it/new?offering_id=${COMMUN}`, user_id: COMMUN }, UID, 'www.vinted.fr');
    dit(Array.isArray(r) && r[0].recipientId === ACHETEURS[3] && r[0].itemId === ITEM && d === null && d2 === null, 'J5 lien d’application ⇒ prouvé seul ; un lien qui désigne le compte lui-même, ou le user_id commun des notifications ⇒ rien', JSON.stringify({ r, d, d2 })); }
  Date.now = ancienNow;
  console.log(ko ? `❌ favoris jujuf38 : ${ko} rouge(s), ${ok} vert(s)` : `✅ favoris jujuf38 : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ J0 a levé : ' + (e && e.stack || e)); process.exit(1); });
