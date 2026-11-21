#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  audit-relances — RELANCER LES ACHETEURS (46) · TRIER LES CONVERSATIONS (48) (21 nov., ext. 5.425)
//  node scripts/audit-relances.cjs [--recopie] [--prouve] [--src <background.js>]
//
//  C. le bloc <relances-regle> de background.js est la COPIE exacte de src/relancesAcheteurs.js ; la garde des
//     transporteurs est celle d'api/_lib/retrait-colis.js ; le moteur est dans l'alarme ; les capacités sont posées.
//  R. la règle, sur des corpus INVENTÉS :
//     R1 statuts : « Commande livrée ! » ⇒ livrée ; au point relais (règle `isAtRelayStatus`) ⇒ relais ; finalisée,
//        « non réclamée », remboursée, litige ⇒ jamais ; la date vient du FIL (message d'état de Vinted), sinon du
//        premier passage vu ; rien ⇒ « depuis » pas su ⇒ jamais de relance ;
//     R2 éligibilité : trop tôt ⇒ non ; une relance ⇒ rang 1 ; la 2ᵉ seulement s'il l'autorise et après le délai ;
//        jamais une 3ᵉ ; litige (statut, transaction 430/440, message de Vinted, mots de l'acheteur) ⇒ jamais ;
//     R3 garde : date lue gagne ; estimée par le transporteur LU ; inconnu ⇒ rien ;
//     R4 message : SES versions, 5 langues, la langue de la conversation, jamais deux fois la même de suite,
//        {date_limite} seulement si LUE, {pseudo} retiré poliment ;
//     R5 tri : à répondre / offre / litige / en attente / traité / pas lu, urgentes d'abord, compteurs.
//  E. le VRAI background.js dans un vm (scripts/_fond-vm.cjs, fausse page vinted.fr) :
//     E1 lecture : seules les commandes prouvées et assez anciennes sont « à relancer », le litige n'apparaît pas ;
//     E2 envoi sur SON toucher : un message dans LA conversation, noté au registre AVANT ; rejoué ⇒ jamais deux fois ;
//     E3 registre illisible ⇒ rien ne part ; autre compte dans l'onglet ⇒ rien ;
//     E4 automatique éteint par défaut ⇒ aucune lecture ; allumé ⇒ une relance ; le rappel au point relais de
//        l'après-vente et la relance ne se doublent jamais ;
//     E5 2ᵉ relance : refusée sans son accord, permise avec, jamais une 3ᵉ ;
//     E6 tri des conversations : lecture seule (aucune requête Vinted).
//  `--prouve` : chaque mutation (de la règle ou du fond) doit rendre l'audit ROUGE.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const REGLE0 = path.join(RACINE, 'src', 'relancesAcheteurs.js');
const DEB = '// <relances-regle>', FIN = '// </relances-regle>';
const args = process.argv.slice(2);
const bloc = (s) => { const a = s.indexOf(DEB), b = s.indexOf(FIN); return a >= 0 && b > a ? s.slice(a, b + FIN.length) : null; };
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const BG0 = cheminSource();

if (args.includes('--recopie')) {
  const s = bloc(fs.readFileSync(REGLE0, 'utf8')); const bg = fs.readFileSync(BG0, 'utf8'); const b = bloc(bg);
  if (!s || !b) { console.error('balises introuvables'); process.exit(1); }
  fs.writeFileSync(BG0, bg.replace(b, () => s)); console.log('✅ bloc <relances-regle> recopié dans background.js'); process.exit(0);
}
// Les mutations : [fichier, avant, après]. 'R' = la règle (src ET sa copie), 'B' = le fond seul.
const MUTATIONS = {
  litigeStatut: ['R', "  if (RL_STATUT_LITIGE.test(String(statut || ''))) return { oui: true, raison: 'statut' };\n", ''],
  litigeTx: ['R', "  if ([430, 440].includes(Number(txStatus))) return { oui: true, raison: 'transaction' };\n", ''],
  litigeMots: ['R', "  if (siens.some((m) => RL_MOTS_LITIGE.test(m.texte))) return { oui: true, raison: 'mots' };\n", ''],
  troisieme: ['R', "  if (l.length >= RL_MAX_ENVOIS) return res(false, 'deja-deux', { jours, seuil });\n", ''],
  deuxiemeSansAccord: ['R', "  if (!R.deuxieme) return res(false, 'deja', { jours, seuil });\n", ''],
  tropTot: ['R', "  if (t - e.depuis < seuil * RL_JOUR) return res(false, 'trop-tot', { jours, seuil });\n", ''],
  depuisDevine: ['R', "  if (!Number.isFinite(e.depuis) || e.depuis <= 0 || e.depuis > t) return res(false, 'depuis-pas-su', { seuil });\n", "  if (!Number.isFinite(e.depuis)) e.depuis = 1;\n"],
  finie: ['R', "  if (/finalis/i.test(st) || tus === 'completed'", "  if (false && /finalis/i.test(st) || tus === 'xx'"],
  absence: ['R', "  if (x.auRelais === true) {", "  if (x.auRelais !== false) {"],
  dateEstimeeDansMessage: ['R', ".filter(({ x }) => !/\\{date_limite\\}/.test(x) || su('date_limite'))", ''],
  memeVersion: ['R', "  const autres = possibles.length > 1 ? possibles.filter((p) => p.n !== Number(derniere)) : possibles;", '  const autres = possibles;'],
  triLitige: ['R', "  if (l.oui && !(fini && l.raison === 'mots')) return { groupe: 'litige'", "  if (false) return { groupe: 'litige'"],
  noteAvant: ['B', "  if (!(await relanceNoter(uid, ligne.tx, ligne.motif, at, ligne.eligible.rang))) return { pasParti: true, code: 'ecriture', raison: 'Le registre des relances n’a pas pu être écrit : rien n’est parti.' };\n", '  await relanceNoter(uid, ligne.tx, ligne.motif, at, null);\n'],
  memoIllisible: ['B', "  if (!lu || !lu.memoOk) return { pasParti: true, code: 'lecture'", "  if (!lu) return { pasParti: true, code: 'lecture'"],
  litigeVinted: ['B', "    if (litiges.has(tx)) { etat.litige = true; etat.raison = 'litige-vinted'; }\n", ''],
  autoEteint: ['B', "  if (R.actif !== true) return { saute: 'eteint' };", "  if (false) return { saute: 'eteint' };"],
  doublonApresVente: ['B', "  if (a.sorte === 'relais') {\n    const env = await sbGet(", "  if (false) {\n    const env = await sbGet("],
  doublonRelance: ['B', "    if (etat.motif === 'relais' && Number.isFinite(Number((bmTx[tx] || {}).relais))", "    if (false && Number.isFinite(Number((bmTx[tx] || {}).relais))"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 400000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let BG = BG0, REGLE = REGLE0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [ou, a, b] = MUTATIONS[mut];
  const appliquer = (src, suffixe) => { let s = fs.readFileSync(src, 'utf8'); if (!s.includes(a)) { console.log('mutation introuvable : ' + mut + ' dans ' + src); process.exit(2); } s = s.replace(a, () => b); const out = path.join(path.dirname(src), `.mut-rl-${mut}-${process.pid}${suffixe}`); fs.writeFileSync(out, s); process.on('exit', () => { try { fs.unlinkSync(out); } catch (_) {} }); return out; };
  BG = appliquer(BG0, '.js');
  if (ou === 'R') REGLE = appliquer(REGLE0, '.mjs');
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 500) : '')); } };
const T0 = Date.now(), H = 3600000, J = 864e5, iso = (t) => new Date(t).toISOString();
const UID = '111', OPP = 555;
// La VRAIE forme d'un fil côté vendeur (mesurée le 21 nov., textes inventés) : messages { entity_type, entity, created_at_ts }.
const etatMsg = (titre, sous, at) => ({ entity_type: 'action_message', created_at_ts: iso(at), entity: { title: titre, subtitle: sous } });
const statutMsg = (titre, at) => ({ entity_type: 'status_message', created_at_ts: iso(at), entity: { title: titre } });
const ecrit = (de, body, at) => ({ entity_type: 'message', created_at_ts: iso(at), entity: { user_id: de, body } });
const offre = (de, prix, at, oid) => ({ entity_type: 'offer_request_message', created_at_ts: iso(at), entity: { user_id: de, status: 10, current: true, status_title: '', price: { amount: String(prix) }, transaction_id: 77, offer_request_id: oid } });
const LIVREE = (at) => etatMsg('Commande livrée !', "L'acheteur a reçu sa commande. Ton paiement te sera transféré d'ici le 30 nov. 10:00, sauf s'il signale un problème entre-temps.", at);
const AU_POINT = (at) => etatMsg('Ton colis est arrivé !', 'Le colis est arrivé au point relais (informations de suivi)', at);
const ST_LIVREE = 'Commande livrée ! ', ST_POINT = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
// AT_RELAY de l'extension (la règle `isAtRelayStatus`), lu dans le VRAI fichier.
const AT_RELAY = (() => { const s = fs.readFileSync(BG0, 'utf8'); const m = /^const AT_RELAY = .*$/m.exec(s); return new Function(m[0] + '; return AT_RELAY;')(); })();

async function regle() {
  console.log('\nC · une seule règle');
  const bs = bloc(fs.readFileSync(REGLE, 'utf8')), bb = bloc(fs.readFileSync(BG, 'utf8'));
  if (!mut) dit(!!bs && bs === bb, 'C1 le bloc <relances-regle> de background.js est la copie exacte de src/relancesAcheteurs.js (--recopie)');
  const rc = fs.readFileSync(path.join(RACINE, 'api', '_lib', 'retrait-colis.js'), 'utf8');
  const g = /export const GARDE_PAR_TRANSPORTEUR = (\{[^}]*\})/.exec(rc);
  const R = await import(pathToFileURL(REGLE).href + '?v=' + Math.random());
  dit(g && JSON.stringify(new Function('return ' + g[1])()) === JSON.stringify(R.RL_GARDE), 'C2 la garde par transporteur = celle d’api/_lib/retrait-colis.js', g && g[1]);
  const bg = fs.readFileSync(BG, 'utf8');
  dit(/lance\('relancesauto', \(\) => relancesAutoTick\(\)\)/.test(bg) && /lance\('relanceslot', \(\) => relancesLotTick\(\)\)/.test(bg), 'C3 le moteur automatique et l’envoi en lot sont dans l’alarme vrm-relais');
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  dit(/relances: '5\.425\.0'/.test(app) && /triconversations: '5\.425\.0'/.test(app), 'C4 capacités relances et triconversations à 5.425.0 dans EXT_CAPACITES');

  console.log('\nR · la règle (corpus inventés)');
  const T = T0;
  const base = (o) => Object.assign({ statut: ST_LIVREE, tus: 'waiting', txStatus: 230, complete: false, auRelais: false, msgs: [LIVREE(T - 3 * J)], opp: OPP }, o);
  let e = R.rlEtatVente(base());
  dit(e.motif === 'livre' && e.depuis === T - 3 * J && e.preuve === 'fil', 'R1a « Commande livrée ! » + message de Vinted ⇒ livrée, datée par le fil', JSON.stringify(e));
  e = R.rlEtatVente(base({ msgs: [], vu: { livre: T - 2.5 * J } }));
  dit(e.motif === 'livre' && e.depuis === T - 2.5 * J && e.preuve === 'vu', 'R1b sans le message : la 1re fois VUE (borne basse)', JSON.stringify(e));
  e = R.rlEtatVente(base({ msgs: [] }));
  dit(e.motif === 'livre' && e.depuis === null && R.rlEligible({ etat: e, reglage: {}, envois: [], maintenant: T }).raison === 'depuis-pas-su', 'R1c ni fil ni vu : « depuis » pas su ⇒ jamais de relance');
  e = R.rlEtatVente(base({ statut: ST_POINT, auRelais: AT_RELAY(ST_POINT), msgs: [AU_POINT(T - 4 * J)] }));
  dit(AT_RELAY(ST_POINT) && e.motif === 'relais' && e.depuis === T - 4 * J, 'R1d au point relais (règle isAtRelayStatus) ⇒ relais, daté par « Le colis est arrivé au point relais »', JSON.stringify(e));
  e = R.rlEtatVente(base({ statut: "Commande expédiée et en cours d'acheminement ! ", auRelais: false, msgs: [] }));
  dit(e.motif === null, 'R1e en route ⇒ rien (ni livrée ni au point)', JSON.stringify(e));
  e = R.rlEtatVente(base({ statut: "Commande expédiée et en cours d'acheminement ! ", auRelais: false, msgs: [AU_POINT(T - 4 * J)] }));
  dit(e.motif === null, 'R1f un message du fil SEUL ne fait pas un statut (la liste ne dit pas « au point »)', JSON.stringify(e));
  for (const [st, nom] of [["Commande finalisée - l'acheteur a validé la commande", 'finalisée'], ["Commande non réclamée - Retournée à l'expéditeur.rice", 'non réclamée'], ['Remboursement effectué', 'remboursée'], ['Retour initié', 'retour']]) {
    const x = R.rlEtatVente(base({ statut: st }));
    dit(!x.motif && !R.rlEligible({ etat: x, reglage: {}, envois: [], maintenant: T }).ok && (nom === 'finalisée' ? x.fini : x.litige), `R1g ${nom} ⇒ jamais (${nom === 'finalisée' ? 'finie' : 'litige / retour'})`, JSON.stringify(x));
  }
  dit(R.rlEtatVente(base({ statut: ST_POINT, auRelais: undefined, msgs: [AU_POINT(T - 4 * J)] })).motif === null, 'R1i « au point » non prouvé par la règle (auRelais absent) ⇒ rien (jamais déduit)');
  dit(R.rlLitige({ statut: 'Réclamation ouverte par l’acheteur' }).oui && R.rlEtatVente(base({ statut: 'Commande livrée ! — réclamation en cours' })).litige, 'R1j un statut qui dit réclamation / litige ⇒ litige, même « livrée »');
  dit(R.rlEtatVente(base({ tus: 'completed' })).fini === true, 'R1h `transaction_user_status` completed ⇒ fini');
  // Litiges.
  dit(R.rlEtatVente(base({ txStatus: 440 })).litige && R.rlEtatVente(base({ txStatus: 430 })).litige, 'R2a transaction 430 / 440 ⇒ litige');
  dit(R.rlEtatVente(base({ msgs: [LIVREE(T - 3 * J), statutMsg('Problème après la livraison', T - 2 * J)] })).litige, 'R2b message d’état « Problème après la livraison » ⇒ litige');
  for (const [txt, lg] of [['Bonjour, la paire est abîmée, je veux un remboursement', 'fr'], ['Hi, the item is damaged', 'en'], ['Hola, quiero un reembolso', 'es'], ['Ciao, è arrivato rotto', 'it'], ['Hallo, das Paket ist beschädigt', 'de'], ['C’est un fake', 'fr']]) {
    const x = R.rlEtatVente(base({ msgs: [LIVREE(T - 3 * J), ecrit(OPP, txt, T - 2 * J)] }));
    dit(x.litige && !R.rlEligible({ etat: x, reglage: {}, envois: [], maintenant: T }).ok, `R2c mots de l’acheteur (${lg}) ⇒ litige, jamais de relance`, txt);
  }
  dit(!R.rlEtatVente(base({ msgs: [LIVREE(T - 3 * J), ecrit(Number(UID), 'Si tu as un problème, dis-le moi', T - 2 * J)] })).litige, 'R2d les mots du VENDEUR ne font pas un litige');
  // Éligibilité.
  const el = (o, envois, reglage) => R.rlEligible({ etat: R.rlEtatVente(base(o)), reglage: reglage || {}, envois: envois || [], maintenant: T });
  dit(el({ msgs: [LIVREE(T - 1.5 * J)] }).raison === 'trop-tot' && el({ msgs: [LIVREE(T - 2 * J - 60000)] }).ok, 'R3a livrée : rien avant 2 j, relance à 2 j', JSON.stringify(el({ msgs: [LIVREE(T - 1.5 * J)] })));
  dit(el({ msgs: [LIVREE(T - 3 * J)] }, [], { livreJours: 5 }).raison === 'trop-tot', 'R3b le seuil se règle (5 j)');
  const rel = (j, envois, reglage) => R.rlEligible({ etat: R.rlEtatVente(base({ statut: ST_POINT, auRelais: true, msgs: [AU_POINT(T - j * J)] })), reglage: reglage || {}, envois: envois || [], maintenant: T });
  dit(rel(2.9).raison === 'trop-tot' && rel(3).ok && rel(3).rang === 1, 'R3c au point : 3 j par défaut');
  dit(rel(5, [T - 1 * J]).raison === 'deja', 'R3d déjà relancée ⇒ plus rien sans son accord');
  dit(rel(8, [T - 1 * J], { deuxieme: true }).raison === 'trop-tot-2' && rel(8, [T - 4 * J], { deuxieme: true }).ok && rel(8, [T - 4 * J], { deuxieme: true }).rang === 2, 'R3e 2ᵉ relance : seulement s’il l’autorise, après le délai, rang 2');
  dit(rel(20, [T - 10 * J, T - 5 * J], { deuxieme: true }).raison === 'deja-deux', 'R3f jamais une 3ᵉ');
  // Garde.
  const lim = R.rlLimite({ depuis: T - 3 * J, transporteur: 'mondialrelay', maintenant: T });
  dit(lim && lim.estimee === true && lim.reste === 2, 'R4a Mondial Relay (5 j), au point depuis 3 j ⇒ « il reste 2 j » (estimé)', JSON.stringify(lim));
  dit(R.rlLimite({ depuis: T - 3 * J, transporteur: '', maintenant: T }) === null && R.rlLimite({ depuis: null, transporteur: 'chronopost', maintenant: T }) === null, 'R4b transporteur ou arrivée inconnus ⇒ pas de garde (jamais celle d’un autre)');
  const lue = R.rlLimite({ depuis: T - 3 * J, transporteur: 'mondialrelay', limiteLue: iso(T + 4 * J), maintenant: T });
  dit(lue && lue.estimee === false && lue.reste === 4, 'R4c une date LUE gagne');
  // Langue et message.
  dit(R.rlLangue([ecrit(OPP, 'Hello, thanks, I got the parcel', T)], OPP) === 'en' && R.rlLangue([ecrit(OPP, 'Hola, gracias por el pedido', T)], OPP) === 'es' && R.rlLangue([ecrit(OPP, 'Ciao, grazie mille per il pacco', T)], OPP) === 'it' && R.rlLangue([ecrit(OPP, 'Hallo, danke für das Paket', T)], OPP) === 'de' && R.rlLangue([ecrit(OPP, 'Bonjour, merci pour le colis', T)], OPP) === 'fr', 'R5a la langue de la conversation (5 langues)');
  dit(R.rlLangue([ecrit(Number(UID), 'Hello thanks you', T)], OPP) === null && R.rlLangue([ecrit(OPP, 'ok', T)], OPP) === null, 'R5b pas assez de mots de l’acheteur ⇒ pas de langue (repli : la sienne)');
  const vars = { pseudo: 'acheteur_x', article: 'Paire test', point: '', date_limite: '' };
  const t1 = R.rlTexte({ modeles: {}, motif: 'relais', langue: 'en', vars, derniere: 0, hasard: () => 0 });
  dit(t1.texte && /pick-up point/.test(t1.texte) && t1.langue === 'en' && /acheteur_x/.test(t1.texte), 'R5c le message proposé, dans SA langue, avec le pseudo', t1.texte);
  let dl = 0; for (let i = 0; i < 40; i++) { const x = R.rlTexte({ modeles: {}, motif: 'relais', langue: 'fr', vars, derniere: 0, hasard: () => i / 40 }); if (/\{|avant le/.test(x.texte)) dl++; }
  dit(dl === 0, 'R5d {date_limite} pas LUE ⇒ la version qui la demande n’est jamais choisie (aucune date estimée dans un message)', dl);
  const avecDate = R.rlTexte({ modeles: {}, motif: 'relais', langue: 'fr', vars: Object.assign({}, vars, { date_limite: '26/11/2026' }), derniere: 1, hasard: () => 0.99 });
  dit(/26\/11\/2026/.test(avecDate.texte), 'R5e une date LUE entre dans la version qui la demande', avecDate.texte);
  const siennes = { relais: { fr: ['Coucou {pseudo}, ton colis t’attend !', 'Hello {pseudo}, pense au point relais.'] } };
  const vs = new Set(); let prec = 0, rep = 0;
  for (let i = 0; i < 30; i++) { const x = R.rlTexte({ modeles: siennes, motif: 'relais', langue: 'fr', vars, derniere: prec, hasard: () => (i * 7 % 10) / 10 }); vs.add(x.n); if (x.n === prec) rep++; prec = x.n; }
  dit(vs.size === 2 && rep === 0, 'R5f SES versions, au hasard, jamais deux fois la même de suite', JSON.stringify([...vs, rep]));
  const sansPseudo = R.rlTexte({ modeles: siennes, motif: 'relais', langue: 'fr', vars: { article: 'x' }, derniere: 2, hasard: () => 0 });
  dit(sansPseudo.texte === 'Coucou, ton colis t’attend !', 'R5g {pseudo} pas su ⇒ retiré poliment', sansPseudo.texte);
  // Tri.
  const cl = (o) => R.rlClasser(Object.assign({ conv: '1', uid: UID, opp: String(OPP), txStatus: 1, msgs: [] }, o), T);
  dit(cl({ msgs: [ecrit(Number(UID), 'Salut', T - 2 * H), ecrit(OPP, 'Elle taille grand ?', T - H)] }).groupe === 'repondre', 'R6a dernier message de l’acheteur ⇒ À répondre');
  dit(cl({ msgs: [ecrit(OPP, 'Elle taille grand ?', T - 2 * H), ecrit(Number(UID), 'Oui', T - H)] }).groupe === 'attente', 'R6b dernier message de moi ⇒ En attente de l’acheteur');
  const of = cl({ msgs: [offre(OPP, 45, T - 5 * H, 9)], offre: { prix: 45, oid: '9', tx: '77' } });
  dit(of.groupe === 'offre' && of.urgent && of.heures === 5 && of.prix === 45, 'R6c offre en attente ⇒ Offre en attente, urgente, son âge', JSON.stringify(of));
  dit(cl({ msgs: [ecrit(OPP, 'Bonjour', T - H)], txStatus: 440 }).groupe === 'litige' && cl({ msgs: [statutMsg('Problème après la livraison', T - H)] }).groupe === 'litige', 'R6d transaction 440 / message de Vinted ⇒ Litige / retour (urgent)');
  const pt = cl({ msgs: [ecrit(Number(UID), 'Expédié !', T - H)], venteStatut: ST_POINT, auRelais: true });
  dit(pt.groupe === 'attente' && pt.urgent && pt.raison === 'colis-point', 'R6e colis au point relais ⇒ urgent, raison dite', JSON.stringify(pt));
  dit(cl({ msgs: [ecrit(Number(UID), 'Merci', T - H)], txStatus: 450 }).groupe === 'traite', 'R6f vente finalisée, rien à répondre ⇒ Traité');
  dit(cl({ msgs: null }).groupe === 'passu', 'R6g fil jamais lu ⇒ « pas lu », jamais rangé au hasard');
  const tri = R.rlTrier([{ groupe: 'attente', urgent: false, at: T }, { groupe: 'litige', urgent: true, at: T - J }, { groupe: 'repondre', urgent: false, at: T - H }]);
  dit(tri.lignes[0].groupe === 'litige' && tri.compte.attente === 1 && tri.compte.repondre === 1 && tri.compte.litige === 1, 'R6h urgentes d’abord, compteur par groupe');
}

// ── E · le vrai fond
const vente = (tx, o = {}) => Object.assign({ transaction_id: Number(tx), conversation_id: Number('9' + tx), status: ST_LIVREE, transaction_user_status: 'waiting', date: iso(T0 - 10 * J), title: 'Paire ' + tx, price: { amount: '50.0' } }, o);
const fil = (tx, msgs, o = {}) => ({ capturedAt: iso(T0 - H), payload: { conversation: Object.assign({ id: Number('9' + tx), opposite_user: { id: OPP, login: 'acheteur_' + tx }, transaction: { id: Number(tx), status: 230, is_completed: false }, messages: msgs }, o) } });
function monde({ ventes = [], fils = {}, main = {}, connecte = UID, store = {}, lignes: plus = {}, memoKo = false, casKo = false } = {}) {
  const lignes = Object.assign({ main: Object.assign({}, main), [`harvest_${UID}_orders_sold`]: { capturedAt: iso(T0 - 60000), nItems: ventes.length, payload: { my_orders: ventes } } }, plus);
  for (const [tx, d] of Object.entries(fils)) lignes[`harvest_${UID}_conv_9${tx}`] = d;
  store.vrmCloisonne = true;
  const f = faireFond({ src: BG, lignes, store, connecte, vinted: () => ({ status: 200, body: { code: 0 } }) });
  f.ctx.attendreEcriture = async () => ({ ok: true });
  f.ctx.porteDiscretion = async () => null;
  f.ctx.secuGeste = async () => null;
  if (memoKo) { const sb = f.ctx.sbGet; f.ctx.sbGet = async (q) => (/vrm_relances_.*select=env/.test(q) ? null : sb(q)); }
  if (casKo) f.ctx.modifierLigneCas = async () => null;
  return f;
}
const ecrits = (f) => f.j.vinted.filter((x) => String(x.methode || '').toUpperCase() !== 'GET');
const replies = (f) => ecrits(f).filter((x) => /\/conversations\/\d+\/replies$/.test(x.chemin));
const corps = (x) => { try { return JSON.parse(x.corps).reply.body; } catch (_) { return ''; } };
const sender = { tab: { id: 1, url: 'https://www.vinted.fr/inbox' } };
async function attendreLot(f) { for (let i = 0; i < 40; i++) { await f.ctx.relancesLotTick(); const l = (await f.ctx.chrome.storage.local.get('vrmRelancesLot')).vrmRelancesLot; if (!l || l.fin) return l; l.prochainAt = 0; await f.ctx.chrome.storage.local.set({ vrmRelancesLot: l }); } return null; }

async function fond() {
  console.log('\nE · le vrai background.js');
  const ventes = [vente(101, { status: ST_LIVREE }), vente(102, { status: ST_POINT }), vente(103, { status: ST_LIVREE }), vente(104, { status: ST_LIVREE }), vente(105, { status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed' })];
  const fils = { 101: fil(101, [LIVREE(T0 - 3 * J)]), 102: fil(102, [AU_POINT(T0 - 4 * J)]), 103: fil(103, [LIVREE(T0 - 1 * J)]), 104: fil(104, [LIVREE(T0 - 5 * J), statutMsg('Problème après la livraison', T0 - 4 * J)]) };
  const f = monde({ ventes, fils });
  const r = await f.ctx.relancesCarte({ langue: 'fr' }, sender);
  const parTx = Object.fromEntries((r.lignes || []).map((x) => [x.tx, x]));
  dit(r.ok && parTx['101'] && parTx['101'].eligible.ok && parTx['101'].motif === 'livre' && parTx['102'] && parTx['102'].eligible.ok && parTx['102'].motif === 'relais', 'E1a livrée depuis 3 j et au point depuis 4 j ⇒ à relancer', JSON.stringify(r).slice(0, 400));
  dit(parTx['103'] && !parTx['103'].eligible.ok && parTx['103'].eligible.raison === 'trop-tot', 'E1b livrée depuis 1 j ⇒ pas encore');
  dit(!parTx['104'] && r.litiges === 1 && !parTx['105'], 'E1c le litige n’apparaît pas (compté à part), la finalisée non plus');
  dit(parTx['101'].texte && /acheteur_101/.test(parTx['101'].texte), 'E1d un message poli est prêt, avec SON pseudo', parTx['101'].texte);
  dit(ecrits(f).length === 0, 'E1e lire les listes n’écrit rien chez Vinted');
  // E2 envoi sur SON toucher.
  const sansConf = await f.ctx.relancesEnvoyerCarte({ items: [{ tx: '101', motif: 'livre' }] }, sender);
  dit(sansConf.ok === false && sansConf.code === 'confirmation' && replies(f).length === 0, 'E2a sans SA confirmation ⇒ rien');
  const env = await f.ctx.relancesEnvoyerCarte({ items: [{ tx: '101', motif: 'livre' }, { tx: '102', motif: 'relais' }], confirme: true, langue: 'fr' }, sender);
  const lot = await attendreLot(f);
  const rp = replies(f);
  dit(env.ok && lot && lot.fin && lot.fin.raison === 'fait' && rp.length === 2 && rp.some((x) => /\/conversations\/9101\/replies$/.test(x.chemin)) && rp.some((x) => /\/conversations\/9102\/replies$/.test(x.chemin)), 'E2b le lot confirmé ⇒ un message dans CHAQUE conversation, par la page', JSON.stringify([env, lot, rp.map((x) => x.chemin)]));
  const reg = f.lignes[`vrm_relances_${UID}`];
  dit(reg && reg.envois && reg.envois['101'] && reg.envois['101'].livre.length === 1 && reg.envois['102'].relais.length === 1, 'E2c chaque relance est au registre (vrm_relances_{uid})', JSON.stringify(reg && reg.envois));
  await f.ctx.relancesEnvoyerCarte({ items: [{ tx: '101', motif: 'livre' }], confirme: true }, sender);
  const lot2 = await attendreLot(f);
  dit(replies(f).length === 2 && lot2 && lot2.res && lot2.res['101:livre'] && lot2.res['101:livre'].ok === false, 'E2d rejoué ⇒ jamais deux fois (refus dit)', JSON.stringify(lot2 && lot2.res));
  const pub = f.lignes[`vrm_relances_${UID}`].liste;
  dit(Array.isArray(pub) && pub.every((x) => !('texte' in x) && !('pseudo' in x)), 'E2e publié pour l’app : sans texte ni pseudo');
  // E3 registre illisible / autre compte.
  const g = monde({ ventes, fils, memoKo: true });
  await g.ctx.relancesEnvoyerCarte({ items: [{ tx: '101', motif: 'livre' }], confirme: true }, sender);
  await attendreLot(g);
  dit(replies(g).length === 0, 'E3a registre des relances illisible ⇒ rien ne part');
  const h = monde({ ventes, fils, connecte: '222' });
  const rh = await h.ctx.relancesEnvoyerCarte({ items: [{ tx: '101', motif: 'livre' }], confirme: true }, sender);
  await attendreLot(h);
  dit(replies(h).length === 0, 'E3b un autre compte dans l’onglet ⇒ rien ne part', JSON.stringify(rh));
  const k = monde({ ventes, fils, casKo: true });
  await k.ctx.relancesEnvoyerCarte({ items: [{ tx: '101', motif: 'livre' }], confirme: true }, sender);
  await attendreLot(k);
  dit(replies(k).length === 0, 'E3c le registre n’a pas pu être écrit AVANT ⇒ rien ne part');
  const lt = monde({ ventes: [vente(106, { status: ST_LIVREE })], fils: { 106: fil(106, [LIVREE(T0 - 4 * J)]) }, lignes: { [`harvest_${UID}_litige_106`]: { payload: { transaction_id: 106 } } } });
  const rl = await lt.ctx.relancesCarte({}, sender);
  await lt.ctx.relancesEnvoyerCarte({ items: [{ tx: '106', motif: 'livre' }], confirme: true }, sender); await attendreLot(lt);
  dit(rl.ok && !rl.lignes.length && rl.litiges === 1 && replies(lt).length === 0, 'E3d litige ouvert chez Vinted (ligne litige) ⇒ jamais', JSON.stringify(rl).slice(0, 300));
  // E4 automatique.
  const a0 = monde({ ventes, fils });
  const ta = await a0.ctx.relancesAutoTick();
  dit(ta && ta.saute === 'eteint' && a0.j.vinted.length === 0 && !a0.lignes[`vrm_relances_${UID}`], 'E4a automatique ÉTEINT par défaut ⇒ rien, pas même une lecture', JSON.stringify(ta));
  const a1 = monde({ ventes, fils, main: { vinted_bleam: { v: 1, comptes: { [UID]: { relances: { actif: true } } } } } });
  await a1.ctx.relancesAutoTick(); await a1.ctx.chrome.storage.local.set({ vrmRelancesProchain: {} }); await a1.ctx.relancesAutoTick(); await a1.ctx.chrome.storage.local.set({ vrmRelancesProchain: {} }); await a1.ctx.relancesAutoTick();
  dit(replies(a1).length === 2, 'E4b allumé ⇒ une relance par commande éligible, jamais plus', JSON.stringify(replies(a1).map((x) => x.chemin)));
  // Le rappel au point relais de l'après-vente, puis la relance : jamais deux messages.
  const b = monde({ ventes: [vente(201, { status: ST_POINT })], fils: { 201: fil(201, [AU_POINT(T0 - 4 * J)]) }, main: { vinted_bleam: { v: 1, comptes: { [UID]: { msgRelais: { actif: true, textes: ['Ton colis t’attend au point relais.'], heures: 24 }, relances: { actif: true } } } } } });
  await b.ctx.chrome.storage.local.set({ vrmBleamMemo: { [UID]: { init: T0 - 10 * J, tx: { 201: { vente: T0 - 9 * J, relaisVu: T0 - 2 * J } } } } });
  await b.ctx.apresVenteTick('banc');
  await b.ctx.relancesAutoTick(); await b.ctx.chrome.storage.local.set({ vrmRelancesProchain: {} }); await b.ctx.relancesAutoTick();
  dit(replies(b).length === 1, 'E4c le rappel « 24 h après l’arrivée au relais » compte comme LA relance : jamais un doublon', JSON.stringify(replies(b).map((x) => corps(x))));
  const c = monde({ ventes: [vente(301, { status: ST_POINT })], fils: { 301: fil(301, [AU_POINT(T0 - 4 * J)]) }, main: { vinted_bleam: { v: 1, comptes: { [UID]: { msgRelais: { actif: true, textes: ['Ton colis t’attend au point relais.'], heures: 24 } } } } } });
  await c.ctx.chrome.storage.local.set({ vrmBleamMemo: { [UID]: { init: T0 - 10 * J, tx: { 301: { vente: T0 - 9 * J, relaisVu: T0 - 2 * J } } } } });
  await c.ctx.relancesEnvoyerCarte({ items: [{ tx: '301', motif: 'relais' }], confirme: true }, sender); await attendreLot(c);
  await c.ctx.apresVenteTick('banc');
  dit(replies(c).length === 1, 'E4d relancée de SON toucher ⇒ le rappel de l’après-vente ne repart pas', JSON.stringify(replies(c).map((x) => corps(x))));
  const ancien = monde({ ventes: [vente(311, { status: ST_POINT })], fils: { 311: fil(311, [AU_POINT(T0 - 4 * J)]) } });
  await ancien.ctx.chrome.storage.local.set({ vrmBleamMemo: { [UID]: { init: T0 - 10 * J, tx: { 311: { vente: T0 - 9 * J, relaisVu: T0 - 4 * J, relais: T0 - 3 * J } } } } });
  await ancien.ctx.relancesEnvoyerCarte({ items: [{ tx: '311', motif: 'relais' }], confirme: true }, sender); await attendreLot(ancien);
  dit(replies(ancien).length === 0, 'E4e un rappel au point relais parti AVANT la 5.425 (mémo de l’après-vente) compte comme la relance');
  // E5 2ᵉ relance.
  const d = monde({ ventes: [vente(401, { status: ST_POINT })], fils: { 401: fil(401, [AU_POINT(T0 - 9 * J)]) }, lignes: { [`vrm_relances_${UID}`]: { v: 1, envois: { 401: { relais: [T0 - 5 * J] } } } } });
  await d.ctx.relancesEnvoyerCarte({ items: [{ tx: '401', motif: 'relais' }], confirme: true }, sender); await attendreLot(d);
  dit(replies(d).length === 0, 'E5a 2ᵉ relance sans SON accord ⇒ rien');
  const d2 = monde({ ventes: [vente(401, { status: ST_POINT })], fils: { 401: fil(401, [AU_POINT(T0 - 9 * J)]) }, main: { vinted_bleam: { v: 1, comptes: { [UID]: { relances: { deuxieme: true } } } } }, lignes: { [`vrm_relances_${UID}`]: { v: 1, envois: { 401: { relais: [T0 - 5 * J] } } } } });
  await d2.ctx.relancesEnvoyerCarte({ items: [{ tx: '401', motif: 'relais' }], confirme: true }, sender); await attendreLot(d2);
  await d2.ctx.relancesEnvoyerCarte({ items: [{ tx: '401', motif: 'relais' }], confirme: true }, sender); await attendreLot(d2);
  dit(replies(d2).length === 1 && d2.lignes[`vrm_relances_${UID}`].envois['401'].relais.length === 2, 'E5b avec son accord : la 2ᵉ part, jamais une 3ᵉ', JSON.stringify(d2.lignes[`vrm_relances_${UID}`].envois));
  // E6 tri.
  const e6 = monde({ ventes: [vente(501, { status: ST_POINT })], fils: { 501: fil(501, [ecrit(Number(UID), 'Expédié', T0 - 2 * H)]), 502: fil(502, [ecrit(OPP, 'Dispo ?', T0 - H)]) }, lignes: { [`harvest_${UID}_inbox`]: { capturedAt: iso(T0), payload: { conversations: [{ id: 9501, updated_at: iso(T0 - 2 * H), unread: false }, { id: 9502, updated_at: iso(T0 - H), unread: true }, { id: 9503, updated_at: iso(T0 - 3 * H), unread: false }] } } } });
  const tr = await e6.ctx.triConversationsCarte({}, sender);
  const pc = Object.fromEntries((tr.lignes || []).map((x) => [x.conv, x]));
  dit(tr.ok && pc['9501'] && pc['9501'].urgent && pc['9501'].raison === 'colis-point' && pc['9502'].groupe === 'repondre' && pc['9503'].groupe === 'passu' && tr.lignes[0].conv === '9501', 'E6a tri : colis au point d’abord (urgent), à répondre, pas lu', JSON.stringify(tr).slice(0, 400));
  dit(e6.j.vinted.length === 0 && Object.keys(e6.lignes).every((k) => !/^vrm_relances_/.test(k)), 'E6b le tri ne lit ni n’écrit rien chez Vinted, n’écrit rien en base');
}
(async () => {
  try { await regle(); } catch (e) { dit(false, 'la règle a planté', e && e.stack); }
  try { await fond(); } catch (e) { dit(false, 'le fond a planté', e && e.stack); }
  console.log(`\n${ko ? '❌' : '✅'} audit-relances : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
