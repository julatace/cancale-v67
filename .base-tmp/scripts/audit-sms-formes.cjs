#!/usr/bin/env node
/**
 * LES SMS DE COLIS, TOUTES LES FORMES (12 nov., Julien : « aucune erreur, pareil ») — et « Tester » de bout en bout.
 *
 * Exécute les VRAIS lecteurs (api/_lib/sms-*.js) sur des SMS SYNTHÉTIQUES (n°, codes, enseignes, adresses
 * inventés), écrits sur le modèle des formes réelles et publiques :
 *   M. Mondial Relay : relais, casier LOCKER 24/7, adresse dans le SMS, date limite, rappel, dernier jour,
 *      retourné (constat) / « sera retourné si… » (condition, rien constaté), forme inconnue ⇒ « à vérifier »
 *      avec le n° seul (jamais le texte) ;
 *   C. Chronopost : Relais Pickup / Pickup Station, point + adresse + date limite + code ; condition ⇒ rien
 *      constaté ; forme inconnue ⇒ « à vérifier » avec son n° ;
 *   G. Vinted Go (code + limite), Pickup (relais + Pass) ;
 *   A. un code d'AUTHENTIFICATION n'est jamais rangé, quel que soit l'expéditeur ;
 *   R. la ligne rangée se relit avec la MÊME règle que les e-mails (`relireLigneSuivi`) : point montré ;
 *   T. « Tester » (Réglages → Recevoir les SMS) : l'URL et le corps EXACTS de la carte (src/smsColis.js,
 *      `urlSms`, `SMS_EXEMPLE`) envoyés au VRAI handler api/widget.js en mode essai ⇒ 200, rien écrit,
 *      `texteEssai` dit « réussi » ; jeton pas encore enregistré ⇒ 401 et la phrase qui dit quoi faire.
 *   node scripts/audit-sms-formes.cjs   ·   --mutations : chaque règle réaffaiblie ⇒ rouge
 */
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';
const path = require('path');
const R = path.join(__dirname, '..');
let ko = 0, okn = 0;
const ok = (c, m, d) => { if (c) okn++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const J = (x) => JSON.stringify(x);

(async () => {
  const MR = await import('file://' + path.join(R, 'api/_lib/sms-mondialrelay.js'));
  const CH = await import('file://' + path.join(R, 'api/_lib/sms-chronopost.js'));
  const VG = await import('file://' + path.join(R, 'api/_lib/sms-vintedgo.js'));
  const PK = await import('file://' + path.join(R, 'api/_lib/sms-pickup.js'));
  const AU = await import('file://' + path.join(R, 'api/_lib/sms-autres.js'));
  const SC = await import('file://' + path.join(R, 'api/_lib/suivi-colis.js'));
  const DATE = '2026-11-12T08:30:00+01:00';
  const mr = (texte) => MR.lireSmsMondialRelay({ texte, expediteur: 'MRELAY', date: DATE });

  // ── M. MONDIAL RELAY ──
  let l = mr('Votre colis 81234567 est disponible au LOCKER 24/7 TEST MARCHE. Retirez-le vite avec le code 712345. Détails sur l\'app mrcolis.fr');
  ok(l.type === 'disponible' && l.lieu === 'LOCKER 24/7 TEST MARCHE' && l.code === '712345' && l.consigne === true, 'M1 casier LOCKER 24/7 : n°, lieu, code, casier', J(l));
  l = mr('Votre colis 81234560 est arrivé au P. Relais TABAC DU TEST.  Retirez-le vite avec le code 712340. + d\'infos: mrcolis.fr');
  ok(l.type === 'disponible' && l.lieu === 'TABAC DU TEST' && l.code === '712340', 'M2 relais « P. Relais » (forme réelle)', J(l));
  l = mr('Votre colis 81234571 est disponible au Point Relais TABAC TEST, 12 rue du Port, 35260 CANCALE. Retirez-le avant le 18/11 avec le code 712351.');
  ok(l.type === 'disponible' && l.lieu === 'Point Relais TABAC TEST, 12 rue du Port, 35260 CANCALE' && l.code === '712351' && l.limite === '2026-11-18', 'M3 point + ADRESSE + date limite lus dans le SMS', J(l));
  l = mr('Retirez vite votre colis 81234572 avec le code 712352! Il vous attend au Point Relais TABAC TEST');
  ok(l.type === 'disponible' && l.rappel === true && l.lieu === 'TABAC TEST' && l.code === '712352', 'M4 rappel', J(l));
  l = mr('Dernier jour pour retirer votre colis 81234569 au Point Relais TABAC TEST avec le code 712349. + d\'infos: mrcolis.fr');
  ok(l.type === 'disponible' && l.dernierJour === true && l.limite === '2026-11-12' && l.code === '712349' && l.lieu === 'TABAC TEST', 'M5 « dernier jour » ⇒ à retirer, limite = le jour du SMS (Paris)', J(l));
  l = mr('Votre colis 81234570 n\'a pas été retiré : il a été retourné à l\'expéditeur. + d\'infos: mrcolis.fr');
  ok(l.type === 'retour' && l.suivi === '81234570', 'M6 « a été retourné à l’expéditeur » (constat) ⇒ retour', J(l));
  l = mr('Votre colis 81234573 est disponible au LOCKER 24/7 TEST. S\'il n\'est pas retiré, il sera retourné à l\'expéditeur. Code 712353.');
  ok(l.type === 'disponible' && l.code === '712353', 'M7 « sera retourné si… » est une condition : rien constaté, le colis reste à retirer', J(l));
  l = mr('Mondial Relay : votre colis 81234574 sera retourné à l\'expéditeur s\'il n\'est pas retiré avant le 18/11.');
  ok(l.type === 'inconnu' && l.suivi === '81234574', 'M7b un retour AU FUTUR seul ne constate rien ⇒ « à vérifier », jamais « reparti »', J(l));
  l = mr('Mondial Relay : votre colis 87654321 rencontre un incident, consultez mrcolis.fr');
  ok(l.type === 'inconnu' && l.suivi === '87654321' && !('texte' in l) && !('code' in l), 'M8 forme inconnue ⇒ « à vérifier » avec le n° seul', J(l));
  const lr = MR.ligneSms(mr('Votre colis 81234570 a été retourné à l\'expéditeur.'), { type: 'suivi', carrier: 'mondialrelay', suivi: '81234570', status: 'available', code: '1', lieu: 'X', emailAt: '2026-11-10T08:00:00Z' }, { smsAt: '2026-11-12T08:00:00Z', maintenant: '2026-11-12T08:00:00Z' });
  ok(lr.data && lr.data.status === 'retour' && lr.data.lieu === 'X', 'M9 un colis à retirer devient « reparti » sur le SMS de retour (lieu gardé)', J(lr));
  const lr2 = MR.ligneSms(mr('Votre colis 81234570 a été retourné à l\'expéditeur.'), { status: 'delivered', suivi: '81234570' }, {});
  ok(!lr2.data && lr2.action === 'deja-retire', 'M10 un retiré reste retiré');
  const ld = MR.ligneSms(mr('Votre colis 81234571 est disponible au Point Relais TABAC TEST, 12 rue du Port, 35260 CANCALE. Retirez-le avant le 18/11 avec le code 712351.'), null, { smsAt: DATE });
  ok(ld.data && ld.data.limite === '2026-11-18' && ld.data.lieu === 'Point Relais TABAC TEST, 12 rue du Port, 35260 CANCALE', 'M11 la ligne rangée porte la limite et le point lus', J(ld.data));

  // ── C. CHRONOPOST ──
  const ch = (texte, expediteur = 'Chronopost') => CH.lireSmsChronopost({ texte, expediteur, date: DATE });
  l = ch('Chronopost : votre colis XW123456789TS est disponible dans votre Relais Pickup TABAC TEST, 12 rue du Port 35260 CANCALE jusqu\'au 19/11. Code de retrait : 482913');
  ok(l.type === 'disponible' && l.code === '482913' && l.lieu === 'TABAC TEST, 12 rue du Port 35260 CANCALE' && l.limite === '2026-11-19', 'C1 Relais Pickup : point + adresse + limite + code', J(l));
  l = ch('Votre colis XW123456780TS vous attend en Pickup Station GARE TEST. Code : 48A913. Chronopost');
  ok(l.type === 'disponible' && l.code === '48A913' && l.lieu === 'GARE TEST' && l.consigne === true, 'C2 Pickup Station (casier) : point + code', J(l));
  l = ch('Chronopost : si votre colis XW123456781TS est disponible, un code vous sera envoyé.');
  ok(l.type === 'inconnu' && l.suivi === 'XW123456781TS', 'C3 une condition ne constate rien ⇒ « à vérifier » avec le n°', J(l));
  l = ch('Chronopost : votre colis XW123456782TS est en cours de livraison.');
  ok(l.type === 'inconnu' && l.suivi === 'XW123456782TS' && !('code' in l), 'C4 forme pas apprise ⇒ « à vérifier » avec le n° seul', J(l));
  const lc = CH.ligneSmsChronopost(ch('Chronopost : votre colis XW123456789TS est disponible dans votre Relais Pickup TABAC TEST, 12 rue du Port 35260 CANCALE jusqu\'au 19/11. Code de retrait : 482913'), null, { smsAt: DATE });
  ok(lc.data && lc.data.status === 'available' && lc.data.lieu && lc.data.limite === '2026-11-19', 'C5 la ligne rangée porte le point et la limite', J(lc.data));

  // ── G. VINTED GO, PICKUP ──
  l = VG.lireSmsVintedGo({ texte: 'RAPPEL : utilise le code K12345 pour récupérer ton colis avant le 18/11/2026. Retrouve ton relais ici : https://p.vintedgo.com/e/100001', expediteur: 'VintedGo' });
  ok(l.type === 'vintedgo' && l.code === 'K12345' && l.limite === '2026-11-18', 'G1 Vinted Go : code + limite', J(l));
  l = PK.lireSmsPickup({ texte: 'RAPPEL-Votre colis VINTED est arrivé au relais TABAC TEST. Présentez Pass: http://n.pkup.fr/Ab3dEf9Gh', expediteur: 'Pickup' });
  ok(l.type === 'pickup' && l.relais === 'TABAC TEST', 'G2 Pickup : relais + Pass', J(l));

  // ── A. AUTHENTIFICATION ──
  for (const [nom, f] of [['Mondial Relay', () => mr('Votre code de vérification est 612345.')], ['Chronopost', () => ch('Chronopost : votre code de validation est 612345, ne le communiquez pas.')], ['aiguillage', () => (AU.lireAutreSms({ texte: 'Vinted Go : code de connexion 612345', expediteur: 'VintedGo' }, DATE) || { lu: { type: 'ignore' } }).lu]]) {
    const x = f(); ok(x.type === 'ignore' && !('code' in x), `A ${nom} : un code d’authentification n’est jamais rangé`, J(x));
  }

  // ── R. MÊME RÈGLE D'AFFICHAGE QUE LES E-MAILS ──
  const rr = SC.relireLigneSuivi(ld.data);
  ok(rr.status === 'available' && rr.lieu === ld.data.lieu && rr.code === '712351', 'R1 la ligne SMS relue par la règle des e-mails : à retirer, point et code montrés', J({ s: rr.status, l: rr.lieu }));

  // ── T. « TESTER » DE BOUT EN BOUT ──
  const S = await import('file://' + path.join(R, 'src/smsColis.js'));
  const JETON = 'JetonT0123456789abcdefghijKLMNOPQ';
  const lignes = new Map([['A|main', { vrm_sms_token: JETON }]]);
  const posts = [];
  global.fetch = async (url, o = {}) => {
    const u = decodeURIComponent(String(url)); const m = (o.method || 'GET').toUpperCase();
    const rep = (st, x) => ({ ok: st < 300, status: st, json: async () => x, text: async () => JSON.stringify(x) });
    if (m === 'POST') { posts.push(u); return rep(201, null); }
    if (/select=owner&limit=1$/.test(u)) return rep(200, []);
    const q = new URLSearchParams(u.split('?')[1] || '');
    const id = (q.get('id') || '').replace(/^eq\./, ''); const jt = q.get('data->>vrm_sms_token');
    const out = [];
    for (const [k, d] of lignes) { const [ow, i] = k.split('|'); if (id && i !== id) continue; if (jt != null && d.vrm_sms_token !== jt.replace(/^eq\./, '')) continue; out.push({ owner: ow, id: i, data: d, t: d.vrm_sms_token }); }
    return rep(200, out);
  };
  const w = (await import('file://' + path.join(R, 'api/widget.js'))).default;
  const envoyer = async (jeton) => {
    const u = new URL(S.urlSms(jeton, ''), 'https://vrm.center');
    const res = { code: 0, corps: null, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.corps = x; return this; }, end() { return this; } };
    // Le corps EXACT de la carte (src/SmsColis.jsx, `tester`) : JSON en texte, comme fetch l'envoie.
    await w({ method: 'POST', query: Object.fromEntries(u.searchParams), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texte: S.SMS_EXEMPLE, expediteur: 'MRELAY', date: new Date().toISOString(), essai: true }) }, res);
    return { res, texte: S.texteEssai(res.code, res.corps) };
  };
  let t = await envoyer(JETON);
  ok(S.urlSms(JETON, '') === `/api/widget?mode=sms&k=${JETON}`, 'T1 « Tester » appelle la même origine (/api/widget?mode=sms&k=…)');
  ok(t.res.code === 200 && t.res.corps && t.res.corps.essai === true && t.res.corps.range === false && posts.length === 0, 'T2 le vrai handler répond à l’essai : 200, rien écrit (ni colis ni compteur)', J({ code: t.res.code, corps: t.res.corps, posts }));
  ok(t.texte.ok === true && /80000001|…0001/.test(t.texte.t) && /rien n'a été rangé/.test(t.texte.t), 'T3 la carte dit « réussi » avec le colis d’exemple lu', J(t.texte));
  t = await envoyer('JetonPasEncoreEnregistre0123456');
  ok(t.res.code === 401 && t.texte.ok === false && /attends quelques secondes/.test(t.texte.t), 'T4 jeton pas encore enregistré ⇒ 401 et la phrase dit quoi faire', J(t.texte));

  console.log(`\n${ko ? `❌ audit-sms-formes : ${ko} rouge(s), ${okn} vert(s)` : `✅ audit-sms-formes : ${okn} verts`}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit-sms-formes a levé : ' + (e && e.stack || e)); process.exit(1); });
