#!/usr/bin/env node
/**
 * LES SMS DE MONDIAL RELAY (formes réelles du 9 nov.), VESTIAIRECO, VINTED GO,
 * PICKUP ET CHRONOPOST — la VRAIE route POST /api/widget?mode=sms EXÉCUTÉE
 * (handler de api/widget.js) sur une fausse base qui parle comme PostgREST
 * (projections, `id=like.`, `meta->>code=eq.`, `owner=eq.`, upsert on_conflict).
 * Formes RÉELLES (captures de Julien, 9 nov.) avec des valeurs FABRIQUÉES : n°,
 * codes, relais, marques, jetons de lien et dates inventés (dépôt public).
 *
 *   M. Mondial Relay « est arrivé au P. Relais », rappel « Il vous attend au Point
 *      Relais » (même colis ⇒ une ligne, arrivée jamais datée par le rappel) ;
 *   V. VestiaireCo : marque + date limite ⇒ UNE information, le rappel la met à
 *      jour ; rien rattaché à une vente ;
 *   G. Vinted Go : le code est l'identité (ligne d'e-mail au même code, conversation
 *      lue) ; code inconnu ⇒ « à vérifier » ; date limite lue ;
 *   P. Pickup : une information par jeton de Pass, jamais un colis à retirer ;
 *   C. Chronopost (forme pas mesurée) : prudent ;
 *   X. garde-fous : code d'authentification, lecture/écriture ratée ⇒ 503, essai ;
 *   E. MUTATIONS : chaque règle réaffaiblie dans une copie ⇒ rouge.
 *   node scripts/audit-sms-expediteurs.cjs
 */
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = path.join(__dirname, '..');

function fausseBase() {
  const lignes = new Map();
  const journal = [];
  const pannes = { ecriture: null, lecture: null };
  const J = (status, x) => ({ ok: status >= 200 && status < 300, status, json: async () => x, text: async () => JSON.stringify(x) });
  const meta = (d) => { const m = {}; for (const [k, v] of Object.entries(d || {})) if (['string', 'number', 'boolean'].includes(typeof v)) m[k] = String(v); return m; };
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
    if (q === 'select=owner&limit=1') return J(200, []);
    if (pannes.lecture && pannes.lecture(u)) return J(503, { message: 'panne' });
    const p = new URLSearchParams(q);
    const idf = p.get('id') || '';
    const owner = (p.get('owner') || '').replace(/^eq\./, '');
    const jeton = p.get('data->>vrm_sms_token');
    const code = p.get('meta->>code');
    const sel = p.get('select');
    const out = [];
    for (const [k, d] of lignes) {
      const [o2, id2] = k.split('|');
      if (idf.startsWith('eq.') && id2 !== idf.slice(3)) continue;
      if (idf.startsWith('like.') && !new RegExp('^' + idf.slice(5).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(id2)) continue;
      if (owner && o2 !== owner) continue;
      if (jeton != null && !(d && d.vrm_sms_token === jeton.replace(/^eq\./, ''))) continue;
      if (code != null && meta(d).code !== code.replace(/^eq\./, '')) continue;
      const proj = {};
      for (const c of String(sel || '').split(',')) {
        const m = /^(\w+):data->>(\w+)$/.exec(c);
        if (m) proj[m[1]] = d && d[m[2]] != null ? String(d[m[2]]) : null;
        else if (c === 'owner') proj.owner = o2; else if (c === 'id') proj.id = id2; else if (c === 'data') proj.data = d;
      }
      out.push(sel ? proj : { owner: o2, id: id2, data: d });
    }
    return J(200, out.slice(0, Number(p.get('limit')) || 1000));
  };
  return { lignes, journal, pannes, fetch, posts: () => journal.filter((e) => e.methode === 'POST') };
}
const resMock = () => { const r = { code: 0, corps: null };
  r.status = (c) => { r.code = c; return r; }; r.json = (x) => { r.corps = x; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };

// ── Les SMS : formes réelles, valeurs FABRIQUÉES ─────────────────────────────
const S = {
  mrArrive: "Votre colis 81234560 est arrivé au P. Relais TABAC D'ICI.  Retirez-le vite avec le code 712340. + d'infos: mrcolis.fr",
  mrArrive2: "Votre colis 81234561 est arrivé au P. Relais PHONE PLUS. Retirez-le vite avec le code 712341. + d'infos: mrcolis.fr",
  mrRappel: "Retirez vite votre colis 81234560 avec le code 712340! Il vous attend au Point Relais TABAC D'ICI",
  mrRappelSeul: "Retirez vite votre colis 81234562 avec le code 712342! Il vous attend au Point Relais LIBRAIRIE CENTRE",
  mrAuCasOu: 'Au cas où le point de retrait pour votre colis 81234563 serait indisponible, sélectionnez-en un autre sur : www.mondialrelay.fr/s/?m=F3&e=81234563',
  vcVendu: "Votre article Prada vient d'etre vendu. Expédiez-le avant le lundi 16 novembre en utilisant l'étiquette d'expédition prépayée disponible, sinon la vente sera annulée.",
  vcRappel: "N'oubliez pas d'expédier votre article Prada avant le lundi 16 novembre, sinon la vente sera annulée.",
  vcAutre: "Votre article Celine vient d'etre vendu. Expédiez-le avant le mardi 17 novembre en utilisant l'étiquette d'expédition prépayée disponible, sinon la vente sera annulée.",
  vgo: 'RAPPEL : utilise le code K12345 pour récupérer ton colis avant le 18/11/2026. Retrouve ton relais ici : https://p.vintedgo.com/e/100001',
  vgoConnu: 'RAPPEL : utilise le code K22222 pour récupérer ton colis avant le 19/11/2026. Retrouve ton relais ici : https://p.vintedgo.com/e/100002',
  vgoConv: 'RAPPEL : utilise le code K33333 pour récupérer ton colis avant le 20/11/2026. Retrouve ton relais ici : https://p.vintedgo.com/e/100003',
  pk1: 'RAPPEL-Votre colis VINTED est arrivé au relais TABAC DU PORT. Présentez Pass: http://n.pkup.fr/Ab3dEf9Gh',
  pk2: 'RAPPEL-Votre colis VINTED est arrivé au relais TABAC DU PORT. Présentez Pass: http://n.pkup.fr/Zz9yXw8Vu',
  chDispo: 'Chronopost : votre colis XW123456789TS est disponible dans votre relais. Code de retrait : 4821. ',
  chCond: 'Chronopost : si votre colis XW123456780TS est disponible au relais, présentez le code 4822.',
  chSansN: 'Chronopost : votre colis arrive demain entre 9h et 13h.',
  verifVgo: 'Vinted Go : votre code de vérification est 612345.',
};
const JA = 'JetonA0123456789abcdefghijKLMNOPQ';
const JB = 'JetonB0123456789abcdefghijKLMNOPQ';
const NOW = Date.parse('2026-11-10T09:00:00Z');

async function suite(widgetDefault, { quiet = false } = {}) {
  let ko = 0;
  const ok = (c, m, d) => { if (!c) ko++; if (!quiet || !c) console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + String(d).slice(0, 300) : ''}`); };
  const base = fausseBase(); global.fetch = base.fetch;
  base.lignes.set('A|main', { vrm_sms_token: JA });
  base.lignes.set('B|main', { vrm_sms_token: JB });
  const appel = async (texte, { k = JA, expediteur = '', date = '2026-11-10T08:00:00+01:00', essai = false } = {}) => {
    const res = resMock();
    await widgetDefault({ method: 'POST', query: { mode: 'sms', k }, headers: {}, body: { texte, expediteur, date, ...(essai ? { essai: true } : {}) } }, res);
    return res;
  };
  const L = (id, o = 'A') => base.lignes.get(`${o}|${id}`);
  process.env.__now = String(NOW);

  // M. MONDIAL RELAY
  let r = await appel(S.mrArrive, { expediteur: 'MRELAY', date: '2026-11-09T10:00:00+01:00' });
  let l = L('email_track_mondialrelay_81234560');
  ok(r.code === 200 && l && l.status === 'available' && l.code === '712340' && l.lieu === "TABAC D'ICI" && l.consigne === false && l.arriveLe === '2026-11-09T09:00:00.000Z', 'M1 « est arrivé au P. Relais X.  Retirez-le … code » ⇒ à retirer (n°, code, lieu, arrivée = le SMS)', JSON.stringify(l));
  r = await appel(S.mrArrive2, { expediteur: 'MRELAY' });
  ok(L('email_track_mondialrelay_81234561') && L('email_track_mondialrelay_81234561').lieu === 'PHONE PLUS', 'M2 la 2ᵉ forme « P. Relais PHONE PLUS. »');
  const nLignes = base.lignes.size;
  r = await appel(S.mrRappel, { expediteur: 'MRELAY', date: '2026-11-10T08:00:00+01:00' });
  l = L('email_track_mondialrelay_81234560');
  ok(r.code === 200 && base.lignes.size === nLignes && l.code === '712340' && l.lieu === "TABAC D'ICI" && l.arriveLe === '2026-11-09T09:00:00.000Z', 'M3 le rappel du MÊME colis : une seule entrée, code et lieu identiques, arrivée inchangée', JSON.stringify([base.lignes.size, nLignes, l.arriveLe]));
  r = await appel(S.mrRappelSeul, { expediteur: 'MRELAY' });
  l = L('email_track_mondialrelay_81234562');
  ok(l && l.status === 'available' && l.code === '712342' && l.lieu === 'LIBRAIRIE CENTRE' && !l.arriveLe, 'M4 un rappel reçu seul : à retirer, mais il ne date jamais l’arrivée', JSON.stringify(l));
  r = await appel(S.mrAuCasOu, { expediteur: 'MRELAY' });
  ok(L('email_track_mondialrelay_81234563') && L('email_track_mondialrelay_81234563').status === 'transit', 'M5 « Au cas où … m=F3 » ⇒ en route');

  // V. VESTIAIRECO
  r = await appel(S.vcVendu, { expediteur: 'VestiaireCo', date: '2026-11-09T14:20:00+01:00' });
  let inf = L('vrm_sms_infos');
  const cles = inf ? Object.keys(inf.infos || {}) : [];
  const e = inf && inf.infos[cles[0]];
  ok(r.code === 200 && cles.length === 1 && e.source === 'vestiaire' && e.marque === 'Prada' && e.jour === '2026-11-16' && /^2026-11-16T23:59:59\+01:00$/.test(e.limite), 'V1 « Votre article Prada vient d’etre vendu … avant le lundi 16 novembre » ⇒ UNE information datée (année de la réception)', JSON.stringify(inf));
  r = await appel(S.vcRappel, { expediteur: 'VestiaireCo', date: '2026-11-12T08:04:00+01:00' });
  inf = L('vrm_sms_infos');
  const e2 = inf.infos[cles[0]];
  ok(Object.keys(inf.infos).length === 1 && e2.n === 2 && e2.formes.join() === 'vendu,rappel', 'V2 le rappel (même marque, même date) met à jour la MÊME information', JSON.stringify(inf.infos));
  r = await appel(S.vcAutre, { date: '2026-11-10T09:00:00+01:00' });
  inf = L('vrm_sms_infos');
  ok(Object.keys(inf.infos).length === 2, 'V3 reconnu sans expéditeur (ses phrases) ; une autre marque/date ⇒ une autre information', JSON.stringify(Object.keys(inf.infos)));
  ok(![...base.lignes.keys()].some((k) => /\|vc_ventes$|\|vc_email_vente_/.test(k)) && !/annul/i.test(JSON.stringify(inf)), 'V4 rien rattaché à une vente Vestiaire ; « sinon la vente sera annulée » ne constate aucune annulation');

  // G. VINTED GO
  r = await appel(S.vgo, { expediteur: 'VintedGo' });
  l = L('email_track_vinted_code-K12345');
  ok(r.code === 200 && l && l.status === 'info' && l.smsAVerifier === true && l.code === 'K12345' && l.limite === '2026-11-18' && l.relaisVgo === '100001' && !l.suivi, 'G1 code inconnu de VRM ⇒ « à vérifier » avec le code, la date limite LUE, le relais (id)', JSON.stringify(l));
  base.lignes.set('A|email_track_vinted_XX99', { type: 'suivi', carrier: 'vinted', suivi: '', code: 'K22222', status: 'available', limite: null, subject: 'Ton colis t’attend' });
  r = await appel(S.vgoConnu, { expediteur: 'VintedGo' });
  l = L('email_track_vinted_XX99');
  ok(l.limite === '2026-11-19' && l.aussiSms === true && !L('email_track_vinted_code-K22222'), 'G2 le code est porté par un colis d’e-mail ⇒ CE colis reçoit la date limite, aucune ligne en double', JSON.stringify(l));
  base.lignes.set('A|panel_colis_relais', { 4400001: { code: 'K33333', lieu: 'Relais X' } });
  r = await appel(S.vgoConv, { expediteur: 'VintedGo' });
  l = L('email_track_vinted_code-K33333');
  ok(l && l.status === 'available' && !l.smsAVerifier && l.code === 'K33333', 'G3 code lu dans une conversation Vinted ⇒ à retirer, relié par ce code', JSON.stringify(l));

  // P. PICKUP
  r = await appel(S.pk1, { expediteur: 'Pickup' });
  r = await appel(S.pk1, { expediteur: 'Pickup' });
  r = await appel(S.pk2, { expediteur: 'Pickup' });
  inf = L('vrm_sms_infos');
  const pk = Object.entries(inf.infos).filter(([k]) => k.startsWith('pickup|'));
  ok(pk.length === 2 && pk.every(([, v]) => v.relais === 'TABAC DU PORT' && /^http:\/\/n\.pkup\.fr\//.test(v.pass)) && pk.find(([k]) => k === 'pickup|Ab3dEf9Gh')[1].n === 2, 'P1 une information par JETON de Pass (le même jeton ⇒ la même), même relais ⇒ rien deviné', JSON.stringify(pk));
  ok(![...base.lignes.keys()].some((k) => /email_track_.*pickup|email_track_.*TABAC/i.test(k)), 'P2 jamais un colis « à retirer » fabriqué sans identité');

  // C. CHRONOPOST
  r = await appel(S.chDispo, { expediteur: 'Chronopost' });
  l = L('email_track_chronopost_XW123456789TS');
  ok(l && l.status === 'available' && l.code === '4821' && !l.arriveLe, 'C1 n° de forme propre + « disponible » + code ⇒ à retirer (arrivée non datée : forme pas mesurée)', JSON.stringify(l));
  r = await appel(S.chCond, { expediteur: 'Chronopost' });
  l = L('email_track_chronopost_XW123456780TS');
  ok(l && l.status === 'info' && l.smsAVerifier && !l.code, 'C2 une CONDITION (« si votre colis … est disponible … ») ne constate rien ⇒ à vérifier, n° seul', JSON.stringify(l));
  const n1 = base.posts().length;
  r = await appel(S.chSansN, { expediteur: 'Chronopost' });
  ok(r.code === 200 && r.corps.range === false && !base.posts().slice(n1).some((x) => /chronopost/.test(x.corps)), 'C3 sans n° de forme propre ⇒ rien rangé');

  // X. GARDE-FOUS
  const n2 = base.posts().length;
  r = await appel(S.verifVgo, { expediteur: 'VintedGo' });
  ok(r.corps.range === false && !base.posts().slice(n2).some((x) => /612345/.test(x.corps)), 'X1 un code de vérification (même de Vinted Go) n’est jamais rangé');
  r = await appel(S.vcVendu, { k: JB, expediteur: 'VestiaireCo' });
  ok(L('vrm_sms_infos', 'B') && Object.keys(L('vrm_sms_infos', 'B').infos).length === 1 && Object.keys(L('vrm_sms_infos').infos).length === 4, 'X2 le vendeur est celui du JETON (B), jamais le texte');
  base.pannes.lecture = (u) => /vrm_sms_infos/.test(u);
  const avant = JSON.stringify(L('vrm_sms_infos'));
  r = await appel(S.vcAutre.replace('Celine', 'Loewe'), { expediteur: 'VestiaireCo' });
  ok(r.code === 503 && JSON.stringify(L('vrm_sms_infos')) === avant, 'X3 lecture ratée de la ligne d’informations ⇒ 503, rien écrit (elle serait écrasée)');
  base.pannes.lecture = (u) => /email_track_\*/.test(u);
  r = await appel(S.vgo.replace('K12345', 'K44444'), { expediteur: 'VintedGo' });
  ok(r.code === 503 && !L('email_track_vinted_code-K44444'), 'X4 recherche du code ratée ⇒ 503, rien écrit (pas su ≠ inconnu)');
  base.pannes.lecture = null;
  base.pannes.ecriture = (u, b) => /vrm_sms_infos/.test(b);
  r = await appel(S.pk2.replace('Zz9yXw8Vu', 'Qq1wEr2Ty'), { expediteur: 'Pickup' });
  ok(r.code === 503, 'X5 écriture ratée ⇒ 503 (Raccourcis peut renvoyer), jamais 200');
  base.pannes.ecriture = null;
  const n3 = base.posts().length;
  r = await appel(S.vcVendu.replace('Prada', 'Fendi'), { expediteur: 'VestiaireCo', essai: true });
  ok(r.code === 200 && r.corps.essai && /Fendi/.test(r.corps.message) && base.posts().length === n3, 'X6 l’essai lit le SMS et n’écrit RIEN (ni information, ni compteur)', JSON.stringify(r.corps));
  return ko;
}

(async () => {
  let ko = 0;
  const W = path.join(R, 'api/widget.js');
  ko += await suite((await import('file://' + W)).default);

  // E. MUTATIONS — dans une copie des lecteurs ; la VRAIE route charge la copie.
  const LIBS = path.join(R, 'api/_lib');
  const MUT = [
    ['sms-mondialrelay.js', 'la forme « est arrivé au P. Relais » oubliée', (s) => s.replace('const a = ARRIVE.exec(t);', 'const a = null;')],
    ['sms-mondialrelay.js', 'le rappel date l’arrivée', (s) => s.replace("arriveLe: lu.rappel ? null : arriveLeAuRangement(null, subject, 'available', at)", "arriveLe: arriveLeAuRangement(null, 'Votre colis est disponible', 'available', at)")],
    ['sms-infos.js', 'le rappel Vestiaire crée une 2ᵉ information', (s) => s.replace('const prev = infos[cle];', 'const prev = null; cle = cle + Math.random();')],
    ['sms-vintedgo.js', 'code inconnu rangé « à retirer »', (s) => s.replace("return { action: 'a-verifier', data: { ...base, status: 'info', smsAVerifier: true,", "return { action: 'a-verifier', data: { ...base, status: 'available', smsAVerifier: false,")],
    ['sms-autres.js', 'Vinted Go : une ligne en double au lieu du colis au même code', (s) => s.replace('const id = ids.length === 1 ? ids[0]', 'const id = false ? ids[0]')],
    ['sms-autres.js', 'lecture ratée = ligne vide', (s) => s.replace("if (!cur.lu) return ko503('base-injoignable');", '')],
    ['sms-pickup.js', 'Pickup dédoublonné par relais (deviné)', (s) => s.replace('export const cleInfoPickup = (lu) => `pickup|${lu.jeton}`;', 'export const cleInfoPickup = (lu) => `pickup|${lu.relais}`;')],
    ['sms-chronopost.js', 'la condition constate', (s) => s.replace('return !CONDITION.test(t.slice(debut, m.index));', 'return true;')],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-exp-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.mkdirSync(path.join(tmp, 'api'));
  fs.symlinkSync(path.join(R, 'node_modules'), path.join(tmp, 'node_modules'));
  fs.symlinkSync(path.join(R, 'src'), path.join(tmp, 'src'));
  let n = 0;
  for (const [fichier, nom, mut] of MUT) {
    const src = fs.readFileSync(path.join(LIBS, fichier), 'utf8');
    const m = mut(src);
    if (m === src) { ko++; console.log(`❌ E mutation « ${nom} » : motif introuvable`); continue; }
    const d = path.join(tmp, 'api' + (++n));
    fs.mkdirSync(path.join(d, '_lib'), { recursive: true });
    for (const f of fs.readdirSync(LIBS)) if (f !== fichier && f.endsWith('.js')) fs.copyFileSync(path.join(LIBS, f), path.join(d, '_lib', f));   // copiés : un lien ramènerait les imports à l'original
    fs.writeFileSync(path.join(d, '_lib', fichier), m);
    for (const f of fs.readdirSync(path.join(R, 'api'))) if (f.endsWith('.js')) fs.copyFileSync(path.join(R, 'api', f), path.join(d, f));
    let k;
    try { k = await suite((await import('file://' + path.join(d, 'widget.js'))).default, { quiet: true }); } catch (e) { k = 1; }
    const rouge = k > 0;
    if (!rouge) ko++;
    console.log(`${rouge ? '✅' : '❌'} E mutation « ${nom} » ⇒ ${rouge ? `${k} contrôle(s) rouge(s)` : 'RIEN ne rougit'}`);
  }
  console.log(ko ? `\n❌ audit-sms-expediteurs : ${ko} rouge(s)` : '\n✅ audit-sms-expediteurs : tout est vert');
  process.exit(ko ? 1 : 0);
})();
