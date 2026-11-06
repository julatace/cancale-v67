#!/usr/bin/env node
/**
 * LES SMS DE MONDIAL RELAY (6 nov.) — api/_lib/sms-mondialrelay.js, la route
 * POST /api/widget?mode=sms, et la carte de l'app (src/smsColis.js).
 *
 * Exécute le VRAI lecteur et la VRAIE route sur une fausse base qui parle comme
 * PostgREST (projection `select=owner` / `select=data`, filtre `owner=eq.`,
 * filtre `data->>vrm_sms_token=eq.`, upsert `on_conflict=owner,id`).
 * Données INVENTÉES (n°, codes, enseignes).
 *
 *   A. le lecteur : les 4 formes réelles (anonymisées) + ce qui doit être ignoré ;
 *   B. la route : vendeur = celui du JETON (jamais le texte), 401 sans rien ranger,
 *      code de vérification jamais écrit, fusion avec un e-mail (l'e-mail gagne,
 *      un retiré reste retiré), 503 sur lecture/écriture ratée, 60/h, mode essai ;
 *   C. la relecture de l'app (`relireLigneSuivi`, `etatRetrait`) ;
 *   D. le câblage : le vrai handler de api/widget.js passe la main sur ?mode=sms ;
 *   E. MUTATIONS : chaque garde-fou réaffaibli dans une copie ⇒ rouge.
 *
 *   node scripts/audit-sms-colis.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = path.join(__dirname, '..');
const LIB = path.join(R, 'api/_lib/sms-mondialrelay.js');

// ── LA FAUSSE BASE (forme PostgREST) ─────────────────────────────────────────
function fausseBase() {
  const lignes = new Map();          // `${owner}|${id}` → data
  const journal = [];                // { methode, url, corps }
  const pannes = { ecriture: null, lecture: null, sonde: false };
  const J = (status, x) => ({ ok: status >= 200 && status < 300, status, json: async () => x, text: async () => JSON.stringify(x) });
  const fetch = async (url, o = {}) => {
    const u = decodeURIComponent(String(url));
    const methode = (o.method || 'GET').toUpperCase();
    journal.push({ methode, url: u, corps: o.body || '' });
    if (!/\/rest\/v1\/app_data\?/.test(u)) return J(404, {});
    const q = u.split('?')[1];
    if (methode === 'POST') {
      if (pannes.ecriture && pannes.ecriture(u, o.body)) return J(500, { message: 'panne' });
      if (!/on_conflict=owner,id/.test(q)) return J(400, {});
      for (const r of JSON.parse(o.body)) lignes.set(`${r.owner}|${r.id}`, JSON.parse(JSON.stringify(r.data)));
      return J(201, null);
    }
    if (q === 'select=owner&limit=1') return pannes.sonde ? J(503, {}) : J(200, []);
    if (pannes.lecture && pannes.lecture(u)) return J(503, { message: 'panne' });
    const p = new URLSearchParams(q);
    const id = (p.get('id') || '').replace(/^eq\./, '');
    const owner = (p.get('owner') || '').replace(/^eq\./, '');
    const jeton = p.get('data->>vrm_sms_token');
    const sel = p.get('select');
    const out = [];
    for (const [k, d] of lignes) {
      const [o2, id2] = k.split('|');
      if (id && id2 !== id) continue;
      if (owner && o2 !== owner) continue;
      if (jeton != null && !(d && d.vrm_sms_token === jeton.replace(/^eq\./, ''))) continue;
      out.push(sel === 'owner' ? { owner: o2 } : sel === 'data' ? { data: d } : { owner: o2, id: id2, data: d });
    }
    return J(200, out.slice(0, Number(p.get('limit')) || 1000));
  };
  return { lignes, journal, pannes, fetch, ecrituresColis: () => journal.filter((e) => e.methode === 'POST' && /email_track_/.test(e.corps)) };
}
const resMock = () => { const r = { code: 0, corps: null, entetes: {} };
  r.status = (c) => { r.code = c; return r; }; r.json = (x) => { r.corps = x; return r; }; r.setHeader = (k, v) => { r.entetes[k] = v; };
  r.end = () => r; return r; };

// ── LES SMS (anonymisés : n°, codes, enseignes inventés) ─────────────────────
const SMS = {
  dispoA: 'Votre colis 81234567 est disponible au LOCKER 24/7 INTERMARCHÉ. Retirez-le vite avec le code 712345. Détails sur l\'app mrcolis.fr',
  dispoB: 'Votre colis 41234568 est disponible au LOCKER 24/7 SUPER U. Retirez-le vite avec le code 154321. Détails sur l\'app mrcolis.fr',
  auCasOu: 'Au cas où le point de retrait pour votre colis 81234567 serait indisponible, sélectionnez-en un autre sur : www.mondialrelay.fr/s/?m=V2&e=81234567',
  verif: 'Votre code de vérification est 612345.',
  inconnu: 'Mondial Relay : votre colis 87654321 rencontre un incident, ZORGLUB consultez mrcolis.fr',
  pub: 'Promo -20 % ce week-end chez SUPER U !',
};
const JA = 'JetonA0123456789abcdefghijKLMNOPQ';   // 32
const JB = 'JetonB0123456789abcdefghijKLMNOPQ';
const NOW = Date.parse('2026-11-06T09:00:00Z');

async function suite(lib, { quiet = false } = {}) {
  let ko = 0;
  const ok = (c, m) => { if (!c) ko++; if (!quiet || !c) console.log(`${c ? '✅' : '❌'} ${m}`); };
  const { lireSmsMondialRelay, routeSms, ligneSms } = lib;

  // A. LE LECTEUR
  const a = lireSmsMondialRelay({ texte: SMS.dispoA, expediteur: 'MRELAY' });
  ok(a.type === 'disponible' && a.suivi === '81234567' && a.code === '712345' && a.lieu === 'LOCKER 24/7 INTERMARCHÉ' && a.consigne === true, 'A1 « disponible au LOCKER 24/7 … code » ⇒ colis à retirer {n°, lieu, code, consigne}');
  const b = lireSmsMondialRelay({ texte: SMS.dispoB });
  ok(b.type === 'disponible' && b.suivi === '41234568' && b.code === '154321' && b.lieu === 'LOCKER 24/7 SUPER U', 'A2 la 2ᵉ forme, sans expéditeur (le texte dit mrcolis.fr)');
  const c = lireSmsMondialRelay({ texte: SMS.auCasOu, expediteur: 'MRELAY' });
  ok(c.type === 'en_route' && c.suivi === '81234567' && !c.code, 'A3 « Au cas où … colis N » ⇒ en route, sans code');
  const v = lireSmsMondialRelay({ texte: SMS.verif, expediteur: 'MRELAY' });
  ok(v.type === 'ignore' && v.raison === 'authentification' && !('code' in v), 'A4 code de vérification ⇒ ignoré (même venu de MRELAY), aucun code rendu');
  const i = lireSmsMondialRelay({ texte: SMS.inconnu });
  ok(i.type === 'inconnu' && i.suivi === '87654321' && !('code' in i), 'A5 Mondial Relay de forme inconnue ⇒ « à vérifier » avec le n° seul');
  ok(lireSmsMondialRelay({ texte: SMS.pub }).type === 'ignore', 'A6 un SMS qui n’est pas de Mondial Relay ⇒ ignoré');
  ok(lireSmsMondialRelay({ texte: 'Votre colis 81234567 est disponible au LOCKER 24/7 X. Retirez-le avec le code 81234567' }).type !== 'disponible', 'A7 un « code » qui est le n° de suivi n’est pas un code');

  // B. LA ROUTE
  const base = fausseBase();
  global.fetch = base.fetch;
  base.lignes.set(`A|main`, { vrm_sms_token: JA, vrm_widget_token: 'wA' });
  base.lignes.set(`B|main`, { vrm_sms_token: JB });
  const appel = async (k, corps, extra = {}) => { const res = resMock();
    await routeSms({ method: extra.method || 'POST', query: { mode: 'sms', k }, headers: {}, body: corps }, res, { url: 'https://base.test', key: 'cle-test', maintenant: () => extra.now || NOW });
    return res; };
  let r = await appel(JA, { texte: SMS.dispoA, expediteur: 'MRELAY', date: '2026-11-06T08:41:00+01:00' });
  const lA = base.lignes.get('A|email_track_mondialrelay_81234567');
  ok(r.code === 200 && r.corps.range === true && /rangé · code ✓/.test(r.corps.message) && /…4567/.test(r.corps.message), `B1 SMS « disponible » ⇒ 200, réponse courte (« ${r.corps && r.corps.message} »)`);
  ok(!!lA && lA.status === 'available' && lA.code === '712345' && lA.lieu === 'LOCKER 24/7 INTERMARCHÉ' && lA.consigne === true && lA.carrier === 'mondialrelay' && lA.source === 'sms' && lA.arriveLe === '2026-11-06T07:41:00.000Z' && lA.limite === null,
    'B2 rangé chez A, forme des e-mails Mondial Relay (status available, code, lieu, consigne, arriveLe = date du SMS, limite inconnue ⇒ garde du transporteur)');
  ok(!base.lignes.has('B|email_track_mondialrelay_81234567'), 'B3 rien chez B');
  r = await appel(JB, { texte: SMS.dispoB });
  ok(r.code === 200 && base.lignes.has('B|email_track_mondialrelay_41234568') && !base.lignes.has('A|email_track_mondialrelay_41234568'), 'B4 le jeton de B ⇒ rangé chez B (le vendeur est celui du jeton)');
  // Le texte ne désigne personne : le même SMS envoyé avec le jeton de A va chez A.
  r = await appel(JA, { texte: SMS.dispoB });
  ok(base.lignes.has('A|email_track_mondialrelay_41234568'), 'B5 le même texte avec le jeton de A ⇒ chez A');

  const n0 = base.journal.length;
  r = await appel('JetonInconnu0123456789abcdefghij', { texte: SMS.dispoA });
  ok(r.code === 401 && !base.journal.slice(n0).some((e) => e.methode === 'POST'), 'B6 jeton faux ⇒ 401, rien écrit');
  const n1 = base.journal.length;
  r = await appel('court', { texte: SMS.dispoA });
  ok(r.code === 401 && base.journal.length === n1, 'B7 jeton mal formé ⇒ 401 sans même lire la base');
  r = await appel('coupe', { texte: SMS.dispoA });
  ok(r.code === 401, 'B8 « coupe » (réception coupée) ⇒ 401');

  const n2 = base.journal.length;
  r = await appel(JA, { texte: SMS.verif, expediteur: 'MRELAY' });
  const ecr = base.journal.slice(n2).filter((e) => e.methode === 'POST');
  ok(r.code === 200 && r.corps.range === false && !ecr.some((e) => /612345/.test(e.corps)) && ![...base.lignes.values()].some((d) => JSON.stringify(d).includes('612345')) && !JSON.stringify(r.corps).includes('612345'),
    'B9 code de vérification ⇒ rien rangé, le code n’est écrit nulle part (ni base, ni réponse)');
  r = await appel(JA, { texte: SMS.pub });
  ok(r.code === 200 && r.corps.range === false, 'B10 SMS publicitaire ⇒ 200, rien rangé');

  // Fusion avec un e-mail existant (l'e-mail gagne sur les champs qu'il a).
  base.lignes.set('A|email_track_mondialrelay_55500011', { type: 'suivi', carrier: 'mondialrelay', suivi: '55500011', status: 'available', statusLabel: 'Arrivé au point de retrait',
    subject: 'Votre colis est disponible', receivedAt: '2026-11-05T10:00:00Z', emailAt: '2026-11-05T10:00:00Z', arriveLe: '2026-11-05T10:00:00Z',
    code: '111111', lieu: 'LOCKER 24/7 TESTMARCHE, Rue des Essais, 35000 Testville', limite: '2026-11-10', consigne: true, qrUrl: 'https://exemple.test/qr', account: 'compteA' });
  r = await appel(JA, { texte: 'Votre colis 55500011 est disponible au LOCKER 24/7 TESTMARCHE. Retirez-le vite avec le code 222222. Détails sur l\'app mrcolis.fr', date: '2026-11-05T11:00:00Z' });
  const f = base.lignes.get('A|email_track_mondialrelay_55500011');
  ok(r.code === 200 && f.code === '111111' && f.codeSms === '222222' && f.lieu.startsWith('LOCKER 24/7 TESTMARCHE, Rue') && f.limite === '2026-11-10' && f.qrUrl === 'https://exemple.test/qr' && f.account === 'compteA' && f.arriveLe === '2026-11-05T10:00:00Z' && f.aussiSms === true && f.source !== 'sms',
    'B11 fusion : l’e-mail garde code, lieu, limite, QR, compte, arrivée ; le code différent du SMS est gardé à part (codeSms)');
  base.lignes.set('A|email_track_mondialrelay_55500022', { type: 'suivi', carrier: 'mondialrelay', suivi: '55500022', status: 'delivered', statusLabel: 'Livré / retiré', emailAt: '2026-11-05T10:00:00Z' });
  r = await appel(JA, { texte: 'Votre colis 55500022 est disponible au LOCKER 24/7 TESTMARCHE. Retirez-le vite avec le code 333333. Détails sur l\'app mrcolis.fr', date: '2026-11-06T08:00:00Z' });
  ok(r.code === 200 && base.lignes.get('A|email_track_mondialrelay_55500022').status === 'delivered' && r.corps.action === 'deja-retire', 'B12 un « retiré » reste retiré (même un SMS plus récent)');
  // En route puis disponible ; « Au cas où » après une arrivée ne la fait pas descendre.
  r = await appel(JA, { texte: 'Au cas où le point de retrait pour votre colis 66600033 serait indisponible, sélectionnez-en un autre sur : www.mondialrelay.fr/s/?m=V2&e=66600033' });
  ok(base.lignes.get('A|email_track_mondialrelay_66600033').status === 'transit', 'B13 « Au cas où » ⇒ ligne en route');
  r = await appel(JA, { texte: 'Votre colis 66600033 est disponible au LOCKER 24/7 SUPER U. Retirez-le vite avec le code 444444. Détails sur l\'app mrcolis.fr' });
  ok(base.lignes.get('A|email_track_mondialrelay_66600033').status === 'available', 'B14 puis « disponible » ⇒ à retirer');
  r = await appel(JA, { texte: SMS.auCasOu });
  ok(base.lignes.get('A|email_track_mondialrelay_81234567').status === 'available' && r.corps.action === 'deja-connu', 'B15 « Au cas où » reçu après l’arrivée ne la fait pas descendre');
  r = await appel(JA, { texte: SMS.inconnu });
  const inc = base.lignes.get('A|email_track_mondialrelay_87654321');
  ok(!!inc && inc.status === 'info' && inc.smsAVerifier === true && !JSON.stringify(inc).includes('ZORGLUB'), 'B16 forme inconnue ⇒ « à vérifier » avec le n° seul, jamais le texte du SMS');

  // Pannes.
  base.pannes.ecriture = (u, corps) => /email_track_/.test(corps);
  r = await appel(JA, { texte: 'Votre colis 77700044 est disponible au LOCKER 24/7 SUPER U. Retirez-le vite avec le code 555555. Détails sur l\'app mrcolis.fr' });
  ok(r.code === 503 && !base.lignes.has('A|email_track_mondialrelay_77700044'), 'B17 écriture ratée ⇒ 503 (jamais 200 sur un SMS pas rangé)');
  base.pannes.ecriture = null;
  base.pannes.lecture = (u) => /id=eq\.email_track_mondialrelay_55500011/.test(u);
  const avantF = JSON.stringify(base.lignes.get('A|email_track_mondialrelay_55500011'));
  r = await appel(JA, { texte: 'Votre colis 55500011 est disponible au LOCKER 24/7 TESTMARCHE. Retirez-le vite avec le code 999999. Détails sur l\'app mrcolis.fr' });
  ok(r.code === 503 && JSON.stringify(base.lignes.get('A|email_track_mondialrelay_55500011')) === avantF, 'B18 lecture de la ligne ratée ⇒ 503, la ligne de l’e-mail n’est pas écrasée');
  base.pannes.lecture = (u) => /vrm_sms_token/.test(u);
  r = await appel(JA, { texte: SMS.dispoA });
  ok(r.code === 503, 'B19 lecture du jeton ratée ⇒ 503 (pas su ≠ jeton faux)');
  base.pannes.lecture = null;
  base.pannes.sonde = true; r = await appel(JA, { texte: SMS.dispoA }); base.pannes.sonde = false;
  ok(r.code === 503, 'B20 sonde de cloisonnement ratée ⇒ 503');

  // Mode essai : RIEN n'est écrit.
  const avantEssai = JSON.stringify([...base.lignes]); const nE = base.journal.length;
  r = await appel(JA, { texte: 'Votre colis 80000001 est disponible au LOCKER 24/7 EXEMPLE. Retirez-le vite avec le code 700001. Détails sur l\'app mrcolis.fr', essai: true });
  ok(r.code === 200 && r.corps.essai === true && r.corps.range === false && JSON.stringify([...base.lignes]) === avantEssai && !base.journal.slice(nE).some((e) => e.methode === 'POST') && /rien n'a été rangé/.test(r.corps.message), 'B21 « Tester » (essai) ⇒ lu, rien écrit, pas même le compteur');
  r = await appel('JetonInconnu0123456789abcdefghij', { texte: SMS.dispoA, essai: true });
  ok(r.code === 401, 'B22 l’essai exige aussi un vrai jeton');

  // Anti-abus : 60 / heure / jeton.
  base.lignes.set('A|vrm_sms_compteur', { heure: new Date(NOW).toISOString().slice(0, 13), n: 59 });
  r = await appel(JA, { texte: SMS.pub });
  ok(r.code === 200, 'B23 le 60ᵉ SMS de l’heure passe');
  r = await appel(JA, { texte: SMS.dispoA });
  ok(r.code === 429, 'B24 le 61ᵉ ⇒ 429');
  r = await appel(JA, { texte: SMS.dispoA }, { now: NOW + 3600000 });
  ok(r.code === 200, 'B25 l’heure suivante, ça repart');
  r = await appel(JA, { texte: SMS.dispoA }, { method: 'GET' });
  ok(r.code === 405, 'B26 GET ⇒ 405');

  // C. La relecture de l'app (la règle partagée).
  const sc = await import('file://' + path.join(R, 'api/_lib/suivi-colis.js'));
  const rc = await import('file://' + path.join(R, 'api/_lib/retrait-colis.js'));
  const rl = sc.relireLigneSuivi(base.lignes.get('A|email_track_mondialrelay_41234568'));
  const e = rc.etatRetrait({ limite: rl.limite, arriveeMs: Date.parse(rl.arriveLe), transporteur: rl.carrier }, NOW);
  ok(rl.status === 'available' && rl.code === '154321' && e.etat === 'a_retirer' && e.garde === 5, 'C1 relue par l’app : à retirer, code gardé, garde Mondial Relay (5 j)');
  const e2 = rc.etatRetrait({ limite: null, arriveeMs: Date.parse(rl.arriveLe), transporteur: rl.carrier }, NOW + 6 * 86400000);
  ok(e2.etat === 'trop_long', 'C2 au-delà de la garde ⇒ « à vérifier » (visible, hors compte)');
  const rt = sc.relireLigneSuivi(base.lignes.get('A|email_track_mondialrelay_66600033'));
  ok(rt.status === 'available', 'C3 en route puis disponible : relue disponible');
  const ri = sc.relireLigneSuivi(inc);
  ok(ri.status === 'info', 'C4 la ligne « pas reconnu » reste « info » (jamais comptée à retirer)');
  ok(typeof ligneSms === 'function' && ligneSms({ type: 'disponible', suivi: '' }, null).data === null, 'C5 sans n° de suivi : rien rangé');
  return ko;
}

(async () => {
  let ko = 0;
  if (!fs.existsSync(LIB)) { console.log('❌ api/_lib/sms-mondialrelay.js absent : aucun SMS ne peut être rangé'); process.exit(1); }
  ko += await suite(await import('file://' + LIB));

  // D. LE CÂBLAGE : le vrai handler de api/widget.js.
  {
    const base = fausseBase(); global.fetch = base.fetch;
    base.lignes.set('A|main', { vrm_sms_token: JA });
    const w = (await import('file://' + path.join(R, 'api/widget.js'))).default;
    const res = resMock();
    await w({ method: 'POST', query: { mode: 'sms', k: JA }, headers: {}, body: JSON.stringify({ texte: SMS.dispoB }) }, res);
    const c = res.code === 200 && base.lignes.has('A|email_track_mondialrelay_41234568');
    if (!c) ko++; console.log(`${c ? '✅' : '❌'} D1 POST /api/widget?mode=sms passe par la route des SMS (corps JSON en texte accepté)`);
    const res2 = resMock();
    await w({ method: 'POST', query: { mode: 'sms', k: 'wA' }, headers: {}, body: { texte: SMS.dispoB } }, res2);
    const c2 = res2.code === 401;
    if (!c2) ko++; console.log(`${c2 ? '✅' : '❌'} D2 la clé du WIDGET n’ouvre pas la route des SMS`);
    const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
    const c3 = /'vrm_sms_token',/.test(app) && /SANS_FICHIER = new Set\(\[[^\]]*'vrm_sms_token'/.test(app) && /<SmsColisSetting /.test(app);
    if (!c3) ko++; console.log(`${c3 ? '✅' : '❌'} D3 l’app synchronise le jeton, ne le met jamais dans un fichier de sauvegarde, et rend la carte`);
    const s = await import('file://' + path.join(R, 'src/smsColis.js'));
    const j = s.nouveauJetonSms((n) => require('crypto').randomBytes(n));
    const c4 = s.jetonSmsValide(j) && s.etatJetonSms(j) === 'actif' && s.etatJetonSms('coupe') === 'coupe' && s.etatJetonSms('') === 'aucun' && s.urlSms(j) === `https://vrm.center/api/widget?mode=sms&k=${j}` && s.urlSms('coupe') === '';
    if (!c4) ko++; console.log(`${c4 ? '✅' : '❌'} D4 la carte : jeton au format du serveur, « coupe » ne fait aucune adresse`);
    const lib = await import('file://' + LIB);
    const ex = lib.lireSmsMondialRelay({ texte: s.SMS_EXEMPLE });
    const c5 = ex.type === 'disponible' && ex.suivi === '80000001';
    if (!c5) ko++; console.log(`${c5 ? '✅' : '❌'} D5 le SMS d’exemple de « Tester » est lu par la vraie règle`);
  }

  // E. MUTATIONS : chaque garde-fou réaffaibli ⇒ la suite doit rougir.
  const src = fs.readFileSync(LIB, 'utf8');
  const MUTATIONS = [
    ['code de vérification rangé', (s) => s.replace("if (AUTHENTIFICATION.test(t)) return { type: 'ignore', raison: 'authentification' };", '')],
    ['vendeur pris dans le texte (premier main venu)', (s) => s.replace('data->>vrm_sms_token=eq.${k}&select=owner&limit=2', 'select=owner&limit=2')],
    ['écriture ratée répondue 200', (s) => s.replace("if (!(await ecrire(id, l.data))) { res.status(503)", "if (!(await ecrire(id, l.data)) && false) { res.status(503)")],
    ['le SMS écrase l’e-mail', (s) => s.replace('code: p.code || lu.code, lieu: p.lieu || lu.lieu', 'code: lu.code, lieu: lu.lieu')],
    ['un retiré redevient à retirer', (s) => s.replace("if (p && p.status === 'delivered') return { data: null, action: 'deja-retire' };", '')],
    ['plus de plafond horaire', (s) => s.replace('if (n >= SMS_PAR_HEURE)', 'if (false)')],
    ['l’essai écrit', (s) => s.replace('if (corps.essai) {', 'if (corps.essai && false) {')],
    ['lecture ratée = ligne absente', (s) => s.replace("if (!avant.lu) { res.status(503).json({ ok: false, erreur: 'base-injoignable' }); return; }", '')],
    ['forme inconnue rangée avec son texte', (s) => s.replace("subject: `SMS Mondial Relay pas reconnu (colis ${lu.suivi})`", 'subject: String(lu.texte || "") + `SMS Mondial Relay pas reconnu (colis ${lu.suivi})`').replace("return { type: 'inconnu', suivi: n ? normaliserSuivi(n[1]) : '' };", "return { type: 'inconnu', suivi: n ? normaliserSuivi(n[1]) : '', texte: t };")],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-mutant-'));
  for (const f of fs.readdirSync(path.dirname(LIB))) if (f.endsWith('.js') && f !== 'sms-mondialrelay.js') fs.symlinkSync(path.join(path.dirname(LIB), f), path.join(tmp, f));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  let n = 0;
  for (const [nom, mut] of MUTATIONS) {
    const m = mut(src);
    if (m === src) { ko++; console.log(`❌ E mutation « ${nom} » : motif introuvable (le contrôle ne vise plus rien)`); continue; }
    const f = path.join(tmp, `sms-mutant-${++n}.js`);
    fs.writeFileSync(f, m);
    const k = await suite(await import('file://' + f), { quiet: true }).catch(() => 1);
    const rouge = k > 0;
    if (!rouge) ko++;
    console.log(`${rouge ? '✅' : '❌'} E mutation « ${nom} » ⇒ ${rouge ? `${k} contrôle(s) rouge(s)` : 'RIEN ne rougit'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
