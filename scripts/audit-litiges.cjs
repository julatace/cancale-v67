#!/usr/bin/env node
// ── audit-litiges — LITIGES, RETOURS ET RÉCLAMATIONS EN COURS (3 novembre) ─────
// Exécute la VRAIE règle (src/litiges.js) — et la vraie lecture des retours eBay
// (api/_lib/ebay-apres-vente.js) — sur des données INVENTÉES à la forme mesurée
// dans sa base le 3 novembre (sujets d'e-mails Vinted, lien de suivi
// `links.vinted.com/t/<base64>` → `/inbox/<id>`, listes « Mes ventes / Mes
// achats » avec `conversation_id`, transactions 430/440). Aucune vraie donnée.
// Ce qu'il exige :
//   · la commande reliée PAR SA CONVERSATION, jamais par le titre (deux ventes au
//     même titre ; un e-mail sans conversation n'est relié à rien) ;
//   · la date limite seulement si elle est LUE (« d'ici le 14 oct. », eBay
//     `respondByDate`) ; « Action requise » et l'annulation n'en ont pas ⇒ null ;
//   · l'année d'une date sans année (décembre → janvier) ;
//   · « clos » PROUVÉ par la commande (finalisée, remboursée) ; une annulation
//     sur une vente déjà partie n'est plus une question ;
//   · ancien (replié, jamais caché) : e-mail sans commande de plus de 30 j, date
//     lue dépassée ;
//   · trois états (en cours · pas su · lu), le manque NOMMÉ ;
//   · deux conversations dans un e-mail ⇒ aucune (on ne choisit pas).
//   node scripts/audit-litiges.cjs                 la règle du dépôt
//   node scripts/audit-litiges.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-litiges.cjs --prouve        toutes les mutations : chacune doit rougir
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src', 'litiges.js');
const EBAY = path.join(RACINE, 'api', '_lib', 'ebay-apres-vente.js');

const MUTATIONS = {
  // Un e-mail sans conversation relié à la vente de même TITRE (interdit, §5).
  titre: ["const o = e.conv ? (parConversation(e.conv, e.sens === 'vente' ? V : A) || parConversation(e.conv, e.sens === 'vente' ? A : V)) : null;",
    "const o = e.conv ? (parConversation(e.conv, e.sens === 'vente' ? V : A) || parConversation(e.conv, e.sens === 'vente' ? A : V)) : (V.find((x) => x && e.article && str(x.title).toLowerCase() === e.article.toLowerCase()) || null);"],
  // Un délai DEVINÉ (réception + 5 jours) quand l'e-mail n'en écrit pas.
  'delai-devine': ["return { source: 'email', emailId: str(r.id), genre: 'probleme', sens: 'vente', article: m[1].slice(0, 140), qui: '', raison: '', conv, limite: null, recuLe: recu };",
    "return { source: 'email', emailId: str(r.id), genre: 'probleme', sens: 'vente', article: m[1].slice(0, 140), qui: '', raison: '', conv, limite: new Date(Date.parse(recu) + 5 * 864e5).toISOString(), recuLe: recu };"],
  // La commande close (finalisée, remboursée) ignorée : le litige reste ouvert.
  'clos-ignore': ['      if (commandeClose(o)) continue;                                  // clos : la commande le PROUVE', ''],
  // Des e-mails illisibles tus (« pas su » lu comme « rien »).
  'passu-tu': ["  if (emails === null) manques.push('tes e-mails Vinted');", ''],
  // L'année jamais avancée (« d'ici le 3 janv. » reçu fin décembre ⇒ dans le passé).
  annee: ['  if (midi(y) < r - 2 * 86400000) y += 1;                           // décembre → janvier', ''],
  // Deux conversations dans un e-mail : la première est prise.
  'deux-conv': ["  return vus.size === 1 ? [...vus][0] : '';                        // deux conversations : on ne choisit pas", "  return [...vus][0] || '';"],
  // Un vieil e-mail sans commande reste « en cours » pour toujours.
  ancien: ['ancien: ageJ > LITIGE_EMAIL_MAX_J });', 'ancien: false });'],
  // Une date lue dépassée reste en tête de « À faire ».
  depassee: ['    const depassee = isFinite(lm) && now - lm > 86400000;', '    const depassee = false;'],
  // Le lien de suivi (base64) n'est plus décodé : plus aucune identité.
  base64: ['  for (const m of t.matchAll(SUIVI)) { const d = base64(m[1]); for (const k of d.matchAll(INBOX)) vus.add(k[1].toLowerCase()); }', ''],
  // Une annulation demandée sur une vente déjà PARTIE reste à trancher.
  'annulation-partie': ["      if (e.genre === 'annulation' && RE_PARTI.test(str(o.status))) continue;", ''],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  if (!fs.existsSync(SRC)) { console.log('❌ src/litiges.js absent : la règle n’existe pas'); process.exit(1); }
  let src = fs.readFileSync(SRC, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src = src.replace(m[0], m[1]);
  }
  // La copie (mutée ou non) importe la VRAIE lecture du corps (api/_lib) par chemin absolu.
  src = src.replace("'../api/_lib/achat-arrive-relais.js'", JSON.stringify(pathToFileURL(path.join(RACINE, 'api', '_lib', 'achat-arrive-relais.js')).href));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'litiges-'));
  const f = path.join(dir, 'litiges.mjs'); fs.writeFileSync(f, src);
  let L, E;
  try { L = await import(pathToFileURL(f).href); } catch (e) { console.log('❌ la règle ne se charge pas : ' + e.message); process.exit(1); }
  // La lecture des retours eBay est PURE ; seul `lireXmlEbay` (inutile ici) tire
  // fast-xml-parser, absent de certains conteneurs : il est remplacé par un bouchon.
  const fE = path.join(dir, 'ebay-apres-vente.mjs');
  fs.writeFileSync(fE, fs.readFileSync(EBAY, 'utf8').replace(/import \{lireXmlEbay\} from '\.\/ebay-gestion\.js';/, 'const lireXmlEbay = () => null;').replace("'./fetch-delai.js'", JSON.stringify(pathToFileURL(path.join(RACINE, 'api', '_lib', 'fetch-delai.js')).href)));
  try { E = await import(pathToFileURL(fE).href); } catch (e) { console.log('❌ la lecture eBay ne se charge pas : ' + e.message); process.exit(1); }
  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 400) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + e.message); } };

  const DAY = 864e5;
  const b64 = (s) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const lien = (conv) => `https://links.vinted.com/t/${b64(`https://www.vinted.fr/inbox/${conv}|0f3c-aa|sig`)}`;
  // Le corps gardé par le serveur : du JSON (`brut`) dont le champ `text` porte le texte.
  const brut = (texte) => JSON.stringify({ from: '"L\'équipe Vinted" <no-reply@vinted.fr>', subject: 'x', text: texte });
  const T = 'Adidas Spezial noir taille 40';   // deux ventes au MÊME titre (§5)
  const CONV_A = '01a1452f-4b49-7bb1-9dd8-e969bdcd3001', CONV_B = '01a1452f-4b49-7bb1-9dd8-e969bdcd3002';
  const ventes = [
    { transaction_id: 7001, title: T, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', conversation_id: CONV_A, date: '2026-10-28T10:00:00Z' },
    { transaction_id: 7002, title: T, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', conversation_id: CONV_B, date: '2026-10-28T11:00:00Z' },
    { transaction_id: 7003, title: 'Nike Air Max 1 taille 44', status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', conversation_id: '24618670001', date: '2026-09-01T10:00:00Z' },
    { transaction_id: 7004, title: 'Salomon XT-6 taille 41', status: 'Retour initié', transaction_user_status: 'needs_action', conversation_id: '24618670002', date: '2026-10-20T10:00:00Z' },
    { transaction_id: 7005, title: 'New Balance 550', status: "Commande expédiée et en cours d'acheminement ! ", transaction_user_status: 'waiting', conversation_id: CONV_A.replace(/1$/, '5'), date: '2026-10-29T10:00:00Z' },
    { transaction_id: 7006, title: 'Asics Gel 1130', status: 'Commande livrée ! ', transaction_user_status: 'waiting', conversation_id: '24618670006', date: '2026-10-15T10:00:00Z' },
    { transaction_id: 7007, title: 'Puma Speedcat', status: 'Commande livrée ! ', transaction_user_status: 'completed', conversation_id: '24618670007', date: '2026-10-10T10:00:00Z' },
    { transaction_id: 7008, title: 'Remboursée', status: 'Remboursement effectué', transaction_user_status: 'failed', conversation_id: CONV_A.replace(/1$/, '8'), date: '2026-10-10T10:00:00Z' },
  ];
  const achats = [
    { transaction_id: 8001, title: 'Jordan 4', status: 'Transaction suspendue - en attente de vérification.', transaction_user_status: 'waiting', conversation_id: '01a14e83-2b7a-7845-b66e-d2303ce10001', date: '2026-10-18T10:00:00Z' },
    { transaction_id: 8002, title: 'Vans Old Skool', status: 'Transaction finalisée - L\'acheteur a validé la commande', transaction_user_status: 'completed', conversation_id: '01a14e83-2b7a-7845-b66e-d2303ce10002', date: '2026-10-18T10:00:00Z' },
  ];
  const etatsMap = { 7006: { s: 440 }, 7007: { s: 440 } };
  const etats = (tx) => etatsMap[tx] || null;
  const numeros = { 7001: '12', 7002: '13', 7004: '20', 7006: 'B230' };
  const numeroDe = (o) => numeros[String(o.transaction_id)] || null;
  const now = Date.parse('2026-11-03T10:00:00Z');
  const mails = [
    // Litige sur la vente 7001 (conversation A, lien de suivi en base64).
    { id: 'email_inconnu_l1', subject: 'Action requise : problème avec la commande « ' + T + ' »', receivedAt: '2026-11-02T09:00:00Z',
      brut: brut(`julienf765,\nL'acheteur a signalé un problème avec la commande « ${T} ». Consulte les détails et propose-lui une solution. Nous avons suspendu la commande jusqu'à ce que tu le fasses.\nVoir le litige \n<${lien(CONV_A)}>\n*Remboursement intégral avec retour* : l'acheteur renvoie le ou les articles concernés sous 5 jours ouvrés.`) },
    // Litige sur une vente FINALISÉE (7003) ⇒ clos.
    { id: 'email_inconnu_l2', subject: 'Action requise : problème avec la commande « Nike Air Max 1 taille 44 »', receivedAt: '2026-09-03T09:00:00Z', brut: brut(`Voir le litige <${lien('24618670001')}>`) },
    // Annulation sur une vente REMBOURSÉE (7008) ⇒ close.
    { id: 'email_inconnu_a1', subject: "L'acheteur souhaite annuler son achat !", receivedAt: '2026-10-11T09:00:00Z', brut: brut(`poupacho souhaiterait annuler l'achat de l'article Remboursée pour la raison suivante : "erreur ". Aller sur la conversation <${lien(CONV_A.replace(/1$/, '8'))}>`) },
    // Annulation sur une vente déjà PARTIE (7005) ⇒ plus une question.
    { id: 'email_inconnu_a2', subject: "L'acheteur souhaite annuler son achat !", receivedAt: '2026-10-30T09:00:00Z', brut: brut(`zed souhaiterait annuler l'achat de l'article New Balance 550 pour la raison suivante : "taille". <${lien(CONV_A.replace(/1$/, '5'))}>`) },
    // Annulation dont la conversation n'est dans aucune liste, MÊME TITRE que 7001/7002 ⇒ ligne seule, sans N°.
    { id: 'email_inconnu_a3', subject: "L'acheteur souhaite annuler son achat !", receivedAt: '2026-11-03T08:00:00Z', brut: brut(`dkresel souhaiterait annuler l'achat de l'article ${T} pour la raison suivante : "je me suis trompé de taille ". Aller sur la conversation <${lien('01a1452f-4b49-7bb1-9dd8-e969bdcd3999')}>`) },
    // Retour d'un ACHAT, date dans le sujet, aucune conversation (mesuré : aucune).
    { id: 'email_inconnu_r1', subject: "Retourne ta commande d'ici le 4 nov. : Salomon xt6", receivedAt: '2026-10-29T15:10:32Z', brut: brut('Bonjour, le_baka a demandé le retour de la commande Salomon xt6. Retourne la commande d\'ici le 4 nov.. Sinon, tu devras la garder.') },
    // Le même, sans corps (forme `email_achat_*`), à l'échéance passée ⇒ ancien.
    { id: 'email_achat_r2', subject: "Retourne ta commande d'ici le 14 oct. : Jordan 4", receivedAt: '2026-10-07T15:10:32Z' },
    // Un vieil e-mail de litige sans conversation ⇒ ancien (jamais caché).
    { id: 'email_inconnu_l3', subject: 'Action requise : problème avec la commande « Vieille paire »', receivedAt: '2026-09-01T09:00:00Z', brut: brut('Sans lien.') },
    // Deux conversations différentes dans le même e-mail ⇒ aucune (et aucun N°).
    { id: 'email_inconnu_l4', subject: 'Action requise : problème avec la commande « ' + T + ' »', receivedAt: '2026-11-03T07:00:00Z', brut: brut(`<${lien(CONV_A)}> <${lien(CONV_B)}>`) },
    // Rien à voir (offre) ⇒ ignoré.
    { id: 'email_inconnu_x', subject: 'Nouvelle offre pour Nike', receivedAt: '2026-11-03T07:00:00Z', brut: brut('...') },
  ];
  const base = { ventes, achats, emails: mails, etats, numeroDe, ebay: undefined, maintenant: now };

  essaie('lecture des e-mails', () => {
    const e1 = L.litigeDEmail(mails[0]);
    dit(e1 && e1.genre === 'probleme' && e1.sens === 'vente', '« Action requise : problème avec la commande » (espace insécable compris) ⇒ litige d’une vente', e1);
    dit(e1 && e1.conv === CONV_A.toLowerCase(), 'la conversation est lue dans le lien de suivi (base64)', e1 && e1.conv);
    dit(e1 && e1.limite === null, '« Action requise » n’écrit aucune date ⇒ limite null (« sous 5 jours ouvrés » est le délai de l’ACHETEUR)', e1 && e1.limite);
    const a3 = L.litigeDEmail(mails[4]);
    dit(a3 && a3.genre === 'annulation' && a3.qui === 'dkresel' && /trompé de taille/.test(a3.raison) && a3.limite === null, 'annulation : pseudo et raison LUS, aucune date', a3);
    const r1 = L.litigeDEmail(mails[5]);
    dit(r1 && r1.genre === 'retour' && r1.sens === 'achat' && r1.limiteJour === '2026-11-04', '« Retourne ta commande d’ici le 4 nov. » ⇒ retour d’un achat, avant le 4 nov. 2026', r1);
    dit(r1 && r1.limite === '2026-11-04T22:59:59.000Z', 'la fin de journée est celle de Paris (heure d’hiver : 23:59:59 = 22:59:59 Z)', r1 && r1.limite);
    dit(L.litigeDEmail(mails[9]) === null, 'un e-mail d’offre n’est pas un litige');
    dit(L.litigeDEmail(mails[8]) && L.litigeDEmail(mails[8]).conv === '', 'deux conversations dans un e-mail ⇒ aucune (on ne choisit pas)', L.litigeDEmail(mails[8]));
    const ete = L.limiteDuJour('14', 'oct.', '2026-10-07T15:00:00Z');
    dit(ete && ete.iso === '2026-10-14T21:59:59.000Z', 'heure d’été : 23:59:59 Paris = 21:59:59 Z', ete);
    const jan = L.limiteDuJour('3', 'janv.', '2026-12-28T10:00:00Z');
    dit(jan && jan.jour === '2027-01-03', '« d’ici le 3 janv. » reçu le 28 déc. ⇒ janvier de l’année SUIVANTE', jan);
    dit(L.limiteDuJour('31', 'avr.', '2026-04-01T10:00:00Z') === null, 'une date impossible (31 avril) ⇒ null, jamais un 1er mai deviné');
    dit(L.limiteDuJour('5', 'brumaire', '2026-04-01T10:00:00Z') === null, 'un mois illisible ⇒ null');
    for (const [m, k] of [['janv.', 0], ['févr.', 1], ['mars', 2], ['avr.', 3], ['mai', 4], ['juin', 5], ['juil.', 6], ['août', 7], ['sept.', 8], ['oct.', 9], ['nov.', 10], ['déc.', 11]]) {
      if (L.moisVinted(m) !== k) dit(false, `mois « ${m} »`, L.moisVinted(m));
    }
    dit(true, 'les douze mois de Vinted sont lus');
  });

  essaie('la règle', () => {
    const r = L.litigesEnCours(base);
    const par = (cle) => r.lignes.find((l) => l.cle === cle) || null;
    dit(r.etat === 'lu', 'trois états : lu', r.etat);
    const v1 = par('v:7001');
    dit(v1 && v1.genre === 'probleme' && v1.num === '12' && v1.tx === '7001', 'le litige est relié à la vente 7001 PAR SA CONVERSATION (N°12), pas à 7002 au même titre', v1);
    dit(!par('v:7002'), 'la vente 7002 (même titre, autre conversation) n’a aucun litige');
    dit(v1 && v1.limite === null && v1.geste.url === `https://www.vinted.fr/inbox/${CONV_A}` && /Répondre/.test(v1.geste.libelle), 'le geste : « Répondre sur Vinted », lien vers SA conversation ; délai non lu', v1 && v1.geste);
    dit(!par('v:7003') && !r.lignes.some((l) => l.emailId === 'email_inconnu_l2'), 'litige sur une vente FINALISÉE ⇒ clos (prouvé par la commande)');
    dit(!par('v:7008') && !r.lignes.some((l) => l.emailId === 'email_inconnu_a1'), 'annulation sur une vente REMBOURSÉE ⇒ close');
    dit(!par('v:7005') && !r.lignes.some((l) => l.emailId === 'email_inconnu_a2'), 'annulation sur une vente déjà PARTIE ⇒ plus une question');
    const a3 = r.lignes.find((l) => l.emailId === 'email_inconnu_a3');
    dit(a3 && a3.tx === '' && a3.num === null && a3.cle === 'c:01a1452f-4b49-7bb1-9dd8-e969bdcd3999' && !a3.ancien, 'annulation sans commande lue : une ligne SEULE, sans N° (jamais celui des ventes au même titre)', a3);
    dit(a3 && /Accepter ou refuser/.test(a3.geste.libelle), 'annulation : « Accepter ou refuser sur Vinted »', a3 && a3.geste);
    const v4 = par('v:7004');
    dit(v4 && v4.genre === 'retour' && v4.num === '20' && v4.source === 'commande', 'une vente « Retour initié » ⇒ ligne retour (N°20)', v4);
    const v6 = par('v:7006');
    dit(v6 && v6.genre === 'retour' && v6.num === 'B230', 'transaction 440 sur une vente pas close ⇒ retour', v6);
    dit(!par('v:7007'), 'transaction 440 sur une vente finalisée ⇒ rien');
    const s1 = par('v:8001');
    dit(s1 && s1.genre === 'suspendue' && s1.sens === 'achat' && s1.num === null, 'un achat « Transaction suspendue » ⇒ ligne de l’achat', s1);
    dit(!par('v:8002'), 'un achat finalisé ⇒ rien');
    const r1 = r.lignes.find((l) => l.emailId === 'email_inconnu_r1');
    dit(r1 && r1.limite === '2026-11-04T22:59:59.000Z' && !r1.ancien && r1.presse && /Renvoyer/.test(r1.geste.libelle), 'retour d’achat avant le 4 nov. : date LUE, pressé (moins de 48 h), « Renvoyer sur Vinted »', r1);
    const r2 = r.lignes.find((l) => l.emailId === 'email_achat_r2');
    dit(r2 && r2.ancien && r2.depassee, 'échéance lue dépassée ⇒ ancien (replié, jamais caché)', r2);
    const l3 = r.lignes.find((l) => l.emailId === 'email_inconnu_l3');
    dit(l3 && l3.ancien && l3.limite === null, 'litige sans commande de plus de 30 j ⇒ ancien, délai jamais deviné', l3);
    const l4 = r.lignes.find((l) => l.emailId === 'email_inconnu_l4');
    dit(l4 && l4.tx === '' && l4.num === null, 'deux conversations ⇒ la ligne n’est reliée à AUCUNE vente', l4);
    const frais = r.lignes.filter((l) => !l.ancien);
    dit(frais.length && frais[0].emailId === 'email_inconnu_r1', 'la date la plus proche passe en tête', frais.map((l) => l.cle));
    dit(r.lignes.every((l) => l.limite === null || l.source === 'email' || l.source === 'ebay' || l.source === 'commande+email'), 'aucune date sur une ligne qui n’en a pas LU');
  });

  essaie('fusion commande + e-mail', () => {
    const m = { id: 'email_inconnu_l9', subject: 'Action requise : problème avec la commande « Salomon XT-6 taille 41 »', receivedAt: '2026-10-21T09:00:00Z', brut: brut(`<${lien('24618670002')}>`) };
    const r = L.litigesEnCours({ ...base, emails: [m] });
    const l = r.lignes.filter((x) => x.tx === '7004');
    dit(l.length === 1 && l[0].genre === 'probleme' && l[0].source === 'commande+email' && l[0].num === '20', 'la vente en retour ET son e-mail de litige : UNE ligne (identité), le genre de l’e-mail', l);
  });

  essaie('trois états', () => {
    dit(L.litigesEnCours({ maintenant: now }).etat === 'encours', 'rien de lu encore ⇒ « en cours », jamais « aucun litige »');
    const p = L.litigesEnCours({ ventes: null, achats: null, emails: null, maintenant: now });
    dit(p.etat === 'passu' && p.lignes.length === 0 && p.manques.length === 3, 'tout illisible ⇒ « pas su », les trois manques nommés', p);
    const q = L.litigesEnCours({ ...base, emails: null });
    dit(q.etat === 'lu' && q.manques.includes('tes e-mails Vinted') && q.lignes.some((l) => l.cle === 'v:7004'), 'e-mails illisibles : le manque est NOMMÉ, les lignes des commandes restent', q.manques);
    const e = L.litigesEnCours({ ...base, ebay: null });
    dit(e.manques.includes('tes retours eBay'), 'retours eBay illisibles ⇒ nommés');
  });

  essaie('eBay', () => {
    const lu = E.retoursEbay({ members: [
      { returnId: '5001', orderId: '11-1', state: 'RETURN_REQUESTED', creationInfo: { item: { itemId: '9', itemTitle: 'Paire' }, reason: 'NOT_AS_DESCRIBED', creationDate: { value: '2026-11-01T10:00:00.000Z' } }, sellerResponseDue: { activityDue: 'SELLER_APPROVE_REQUEST', respondByDate: { value: '2026-11-04T10:00:00.000Z' } } },
      { returnId: '5002', orderId: '11-2', state: 'RETURN_REQUESTED', creationInfo: { item: { itemId: '8' } } },
      { returnId: '5003', orderId: '11-3', state: 'CLOSED', creationInfo: { item: { itemId: '7' } }, sellerResponseDue: { respondByDate: { value: '2026-11-04T10:00:00.000Z' } } },
      { returnId: '5004', orderId: '11-4', state: 'RETURN_REQUESTED', creationInfo: { item: { itemId: '6' } }, sellerResponseDue: { respondByDate: { value: 'bientôt' } } },
    ] });
    dit(lu && lu[0].limite === '2026-11-04T10:00:00.000Z', 'eBay : `sellerResponseDue.respondByDate` est lu', lu && lu[0]);
    dit(lu && lu[1].limite === null && lu[3].limite === null, 'eBay : absent ou illisible ⇒ null', lu && [lu[1].limite, lu[3].limite]);
    const r = L.litigesEnCours({ ...base, ebay: lu.map((x, i) => ({ retour: x, compte: 'principal', num: i === 0 ? '44' : null })) });
    const e1 = r.lignes.find((l) => l.cle === 'ebay:5001');
    dit(e1 && e1.limite === '2026-11-04T10:00:00.000Z' && e1.num === '44' && e1.presse && /ReturnDetails\?returnId=5001/.test(e1.geste.url), 'retour eBay ouvert : date LUE, N° par SKU (appelant), « Répondre sur eBay »', e1);
    dit(!r.lignes.some((l) => l.cle === 'ebay:5003'), 'retour eBay clos ⇒ rien');
    const e2 = r.lignes.find((l) => l.cle === 'ebay:5002');
    dit(e2 && e2.limite === null, 'retour eBay sans date ⇒ « délai non lu »', e2);
  });

  essaie('lecture projetée', () => {
    const q = L.requeteEmailsLitiges(now);
    dit(!/select=data(&|$)/.test(q) && /select=id,subject:data->>subject,receivedAt:data->>receivedAt,brut:data->>brut/.test(q), 'les e-mails sont lus en PROJECTION (§4.4)', q);
    dit(/limit=\d+/.test(q) && /email_inconnu_\*/.test(q) && /receivedAt=gte\./.test(q), 'bornés (90 jours, limite) et seulement les e-mails gardés', q);
    dit(L.litigeDeVente(L.litigesEnCours(base), ventes[0]).cle === 'v:7001' && L.litigeDeVente(L.litigesEnCours(base), ventes[1]) === null, 'le tiroir d’une vente trouve SON litige (transaction), pas celui de sa jumelle de titre');
  });

  console.log(`\n${n - ko}/${n} contrôles verts.`);
  process.exit(ko ? 1 : 0);
})();
