// api/_lib/bilan-mois.js
// ════════════════════════════════════════════════════════════════════════════
// LE BILAN DU MOIS PAR E-MAIL (8 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Le 1er du mois, pour le mois écoulé, un e-mail court par vendeur QUI L'A
// ACTIVÉ : ventes, vendu, reçu, bénéfice brut, sa plus belle vente, un lien vers
// Compta. Ce n'est PAS la « sauvegarde hebdomadaire envoyée chez lui » refusée
// le 11 octobre (§3) : aucune donnée, aucun fichier — un résumé de chiffres.
//
// ⚠️ LE DÉFAUT (13 nov., lot 53 — VRM s'ouvre à d'autres vendeurs) : ACTIVÉ pour
//    les comptes CRÉÉS depuis le 13 novembre 2026 (`DEFAUT_ACTIF_DEPUIS`, date de
//    création lue chez Supabase Auth), ÉTEINT pour les comptes d'avant (rien ne
//    change pour qui n'a rien choisi). Le choix vit dans la ligne
//    `bilan_mois_choix` du vendeur, écrite par le SERVEUR seul (api/compte.js
//    `?mode=bilan-mois` : sa session depuis Réglages, ou le lien signé « ne plus
//    recevoir » de l'e-mail) ; un choix posé gagne toujours sur le défaut.
//    Ligne illisible, ou date de création pas sue ⇒ rien ne part (« pas su » ne
//    vaut pas « oui ») ; éteint ⇒ aucune vente n'est lue.
// ⚠️ LES RÈGLES NE SONT PAS ICI (§5, §11) :
//    · vendu / reçu = `calculerBilan` (api/_lib/bilan-semaine.js), lui-même le
//      miroir EXACT de `ventesFaites` / `ventesDeclarables` de l'app
//      (api/_lib/ventes-regle.js) — VENDU au jour de la vente, REÇU au jour du
//      VERSEMENT ; un total partiel se dit « au moins » et NOMME ce qui manque ;
//    · bénéfice brut = la publication de l'écran Ventes (`vrm_benefice_jours`,
//      son propriétaire) cumulée par `beneficeDesJours`, recopiée de l'app par
//      script (api/_lib/benefice-regle.js, `audit-bilan-mois.cjs --recopie`) :
//      vente − prix d'achat, SEULEMENT sur les ventes au prix d'achat connu ;
//      des prix manquent ⇒ le brut connu, sa couverture (« sur 4 ventes de 6 »)
//      et le manque NOMMÉ — ⚠️ (13 nov.) jamais « au moins » devant un bénéfice
//      (src/beneficeNoms.js : une vente au prix d'achat inconnu peut être à
//      perte, ce n'est pas un plancher) ; aucun prix d'achat, ou jamais publié
//      ⇒ « — » et la raison, jamais 0 € ;
//    · temps gagné = SEULEMENT les gestes MESURÉS de la règle du calculateur
//      (src/accueil/tempsGagne.js, `nature: 'mesurée'`) × le nombre de ventes
//      du mois ; aucun geste mesuré (aujourd'hui) ou ventes pas sues ⇒ la ligne
//      n'est PAS écrite (une estimation raisonnée n'est pas un temps gagné) ;
//    · « pas su » ⇒ « — », jamais un 0 inventé.
// ⚠️ (22 nov., Julien, choix n° 36 « Résumé du mois par e-mail ») TROIS CHOSES DE PLUS, chacune par la règle
//    serveur qui existe déjà (jamais une seconde) :
//    · les COLIS NON RETIRÉS : la liste que l'app PUBLIE (`vrm_colis_retirer`, son propriétaire §11), relue par
//      `retirerPublie` (api/_lib/retrait-colis.js, la règle du widget) — jamais publiée ⇒ « — » ;
//    · le MONTANT À DÉCLARER À L'URSSAF : `notificationUrssaf` (api/_lib/rappel-urssaf.js), celle de la
//      notification du 1er, sur le miroir refabriqué des règles de l'app (api/_lib/urssaf-regle.js) : pas
//      micro-entrepreneur ⇒ la ligne n'existe pas ; période déjà notée « déclarée » ⇒ elle le dit ; montant pas
//      publié ⇒ « — » ; partiel ⇒ « au moins » ;
//    · LE DÉFAUT : allumé par défaut SEULEMENT si l'envoi est configuré (`config.pret`) — remplace le défaut par
//      date de création du 13 nov. Un choix posé gagne toujours ; envoi pas configuré ⇒ rien ne part et
//      Paramètres le dit (api/compte.js `?mode=bilan-mois` rend `configure`).
// ⚠️ LE CANAL EXISTANT : le même serveur SMTP que les e-mails de l'essai
//    (`RELANCES_SMTP_*`, `RELANCES_EXPEDITEUR`), la même adresse — celle DU
//    COMPTE, confirmée (`adresseDuCompte`) —, le même gabarit
//    (api/_lib/mail-gabarit.js). Pas configuré ⇒ rien ne part (et le cron le dit).
// ⚠️ LE PLAFOND : Brevo gratuit = 300 e-mails par jour pour TOUT VRM. Le passage
//    du matin donne au bilan ce qui reste après les e-mails de l'essai, et 150 au
//    plus (`VRM_EMAILS_PAR_JOUR`, 300 par défaut) ; ceux qui n'ont pas eu leur
//    bilan l'ont le lendemain — jusqu'au 7 du mois, un seul par mois.
// ⚠️ JAMAIS DEUX FOIS : le mois est RÉSERVÉ dans `bilan_mois_envois` AVANT
//    l'envoi ; réservation non confirmée ⇒ rien ne part ; un refus SMTP avant le
//    message libère le mois (demain) ; un envoi « incertain » ne se refait pas.
// ⚠️ La réponse du cron ne porte AUCUN montant ni adresse : des états seulement.
import crypto from 'node:crypto';
import { calculerBilan, minuitParis, dateParis } from './bilan-semaine.js';
import { beneficeDesJours } from './benefice-regle.js';
import { gabaritMail as gabaritEmail } from './mail-gabarit.js';
import { tm, tmN, langueMail, eurosFr, eurosMail, dateMail, moisMail } from './mail-textes.js';
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai
import { lienNotif } from './lien-notif.js';
// (22 nov., résumé du mois) Les deux règles serveur qui existent déjà : la déclaration URSSAF (la notification du 1er)
// et les colis à retirer publiés par l'app (la règle du widget).
import { notificationUrssaf, MAIN_URSSAF } from './rappel-urssaf.js';
import { retirerPublie } from './retrait-colis.js';
// Les clés de `main` que le résumé lit (projetées, jamais `select=data`, §4.4).
export const MAIN_RESUME = [...MAIN_URSSAF, 'vrm_colis_retirer'];
// (13 nov., lot 53) La règle du temps gagné (page d'accueil) : un module pur, la MÊME.
import { GESTES as GESTES_TEMPS } from '../../src/accueil/tempsGagne.js';

export const SITE = 'https://vrm.center';
export const ID_CHOIX = 'bilan_mois_choix';
export const ID_ENVOIS = 'bilan_mois_envois';
export const JOUR_MAX = 7;                       // rattrapage du 2 au 7
export const PART_MAX_BILAN = 150;               // au plus, par passage du matin
export const PLAFOND_JOUR_DEFAUT = 300;          // Brevo gratuit : 300 / jour, tout VRM
// Le choix EFFECTIF : true · false · null (pas su ⇒ rien ne part).
// `choix` : objet (posé) · null (jamais choisi) · undefined (illisible).
// `configure` : l'envoi est-il configuré (`configurationRelances().pret`) ? (22 nov., Julien : « allumé par défaut
// seulement si l'envoi est configuré ») — jamais choisi ⇒ allumé si configuré, éteint sinon ; pas su ⇒ null.
export function choixEffectif(choix, configure) {
  if (choix === undefined) return null;
  if (choix && typeof choix === 'object' && typeof choix.actif === 'boolean') return choix.actif;
  if (typeof configure !== 'boolean') return null;
  return configure;
}
// L'adresse du récap du mois DANS l'app (Compta → Bilan du mois, CE mois-là), par
// le contrat des notifications (api/_lib/lien-notif.js ⇔ src/cibleNotif.js).
export const lienRecapMois = (ym) => SITE + lienNotif('compta', { cible: 'bilanmois', mois: /^\d{4}-\d{2}$/.test(String(ym || '')) ? ym : '' });

// ── LE TEMPS GAGNÉ, SEULEMENT S'IL EST MESURÉ ───────────────────────────────
// Les gestes « par vente » dont la durée est MESURÉE (chronométrée, datée) dans la
// règle du calculateur ; × les ventes du mois (seulement si elles sont toutes lues).
// `null` ⇒ la ligne n'existe pas. `gestes` : pour le banc (une règle mutée).
export function tempsGagneMesure(vendu, gestes = GESTES_TEMPS) {
  const mesures = (Array.isArray(gestes) ? gestes : []).filter((g) => g && g.nature === 'mesurée' && g.par === 'vente' && Number(g.sans) > Number(g.avec));
  if (!mesures.length || !vendu || vendu.etat !== 'su' || !(Number(vendu.n) > 0)) return null;
  const secondes = mesures.reduce((t, g) => t + Number(vendu.n) * (Number(g.sans) - Number(g.avec)), 0);
  return { minutes: Math.round(secondes / 60), gestes: mesures.map((g) => g.id), n: Number(vendu.n) };
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// ── LE MOIS ÉCOULÉ, À L'HEURE DE PARIS ──────────────────────────────────────
// `debut` = le 1er du mois écoulé à 00:00 (Paris), `fin` = le 1er du mois en
// cours à 00:00 (Paris), `jour` = le jour du mois d'aujourd'hui (1…31).
export function moisPasse(maintenant = Date.now()) {
  const auj = dateParis(maintenant);
  const [y, m, d] = auj.split('-').map(Number);
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const ym = `${py}-${String(pm).padStart(2, '0')}`;
  const debut = minuitParis(`${ym}-01`), fin = minuitParis(`${y}-${String(m).padStart(2, '0')}-01`);
  return { ym, debut, fin, jour: d, libelle: `${MOIS[pm - 1]} ${py}` };
}

// La part du plafond quotidien laissée au bilan, ce passage-ci.
export function partBilan({ env = process.env, dejaEnvoyes = 0 } = {}) {
  const p = Number(env.VRM_EMAILS_PAR_JOUR);
  const plafond = Number.isFinite(p) && p > 0 ? Math.floor(p) : PLAFOND_JOUR_DEFAUT;
  return Math.max(0, Math.min(PART_MAX_BILAN, plafond - Math.max(0, Number(dejaEnvoyes) || 0)));
}

// ── LE BÉNÉFICE BRUT DU MOIS (la publication de Ventes, la règle de l'app) ──
// Trois états : 'su' (tous les prix d'achat connus) · 'partiel' (« au moins »,
// le manque nommé) · 'pas-su' (« — », la raison). Jamais un 0 inventé.
export function beneficeDuMois(pub, mois) {
  if (!pub || typeof pub !== 'object' || !pub.jours || typeof pub.jours !== 'object') return { etat: 'pas-su', raison: 'pas encore calculé : ouvre l’écran Ventes une fois' };
  const [y, m] = mois.ym.split('-').map(Number);
  // Les clés publiées sont des jours locaux (AAAA-MM-JJ) : bornes à minuit UTC
  // ⇒ `jourClef` (lu en UTC sur le serveur) rend exactement le 1er de chaque mois.
  const r = beneficeDesJours(pub.jours, new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)));
  const vieux = !(Number(pub.at) >= mois.fin);
  // (17 nov.) + `code` : la même raison, pour l'e-mail dans une autre langue (mail-textes.js).
  if (!r.n) return { etat: 'pas-su', raison: vieux ? 'pas recalculé depuis la fin du mois : ouvre l’écran Ventes' : 'aucune vente finalisée ce mois-ci', code: vieux ? 'raisonVieux' : 'raisonAucune' };
  if (!r.nCout) return { etat: 'pas-su', raison: 'aucun prix d’achat noté sur les ventes du mois', code: 'raisonSansCout' };
  const manque = [];
  if (r.nCout < r.n) manque.push(`${r.n - r.nCout} prix d’achat manque${r.n - r.nCout > 1 ? 'nt' : ''}`);
  if (vieux) manque.push(`calculé le ${new Date(Number(pub.at) || 0).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' })}`);
  return { etat: manque.length ? 'partiel' : 'su', brut: Math.round(r.brut * 100) / 100, n: r.n, nCout: r.nCout, manque, ...(vieux ? { calculeLe: Number(pub.at) || 0 } : {}) };
}

// ── LE CALCUL (pur) ─────────────────────────────────────────────────────────
// `d` = les lectures du bilan de la semaine (`lireDonneesBilan`, chaque source
// `null` si illisible) ; `pub` = `vrm_benefice_jours` (ou null).
// (22 nov.) LES COLIS NON RETIRÉS, la publication de l'app relue par la règle du widget : { etat: 'su', n, aVerifier, at }
// · { etat: 'pas-su' } (jamais publiée, illisible). `main` undefined = pas su.
export function colisDuResume(main, maintenant = Date.now()) {
  if (!main || typeof main !== 'object') return { etat: 'pas-su' };
  const r = retirerPublie(main.vrm_colis_retirer, maintenant, dateParis(maintenant));
  if (!r) return { etat: 'pas-su' };
  return { etat: 'su', n: r.n, aVerifier: r.aVerifier + (r.enVerification || 0), at: Number.isFinite(r.at) ? r.at : null };
}
// (22 nov.) LE MONTANT À DÉCLARER À L'URSSAF : la notification du 1er (`notificationUrssaf`), la MÊME règle et le
// même montant. null ⇒ la ligne n'existe pas (pas micro-entrepreneur, rien à déclarer ce mois-ci) ;
// { etat: 'declare' } (période notée « déclarée ») · { etat: 'pas-su', code } · { etat: 'su'|'partiel', eur, label, dueIso }.
export function urssafDuResume(main, maintenant = Date.now()) {
  if (main === undefined) return { etat: 'pas-su', code: 'reglages' };
  const n = notificationUrssaf({ today: dateParis(maintenant), main: main === null ? null : main });
  if (!n.envoyer) {
    if (/déjà notée/.test(String(n.raison || ''))) return { etat: 'declare' };
    if (/illisibles/.test(String(n.raison || ''))) return { etat: 'pas-su', code: 'reglages' };
    return null;
  }
  if (n.montant == null || !Number.isFinite(Number(n.montant))) return { etat: 'pas-su', code: 'montant', label: n.label || '', dueIso: n.dueIso || '' };
  return { etat: n.partiel ? 'partiel' : 'su', eur: Number(n.montant), label: n.label || '', dueIso: n.dueIso || '' };
}
export function calculerBilanMois({ d, pub, mois, main = null, maintenant = Date.now() }) {
  const b = calculerBilan({ ...d, debut: mois.debut, fin: mois.fin, seuilCapture: mois.fin, maintenant });
  const benefice = beneficeDuMois(pub, mois);
  // La plus belle vente : la plus haute du mois (par la règle VENDU), et son
  // titre lu sur SA commande Vinted (par son n° de transaction) — sinon le site.
  let meilleure = null;
  const best = b.vendu && b.vendu.meilleure;
  if (best) {
    let titre = '';
    if (best.plateforme === 'Vinted' && best.tx && d && d.commandes) {
      for (const l of Object.values(d.commandes)) {
        const o = (l.orders || []).find((x) => x && String(x.transaction_id) === String(best.tx));
        if (o) { titre = String(o.title || '').trim(); break; }
      }
    }
    meilleure = { eur: best.eur, plateforme: best.plateforme, titre };
  }
  return { mois: mois.ym, libelle: mois.libelle, vendu: b.vendu, recu: b.recu, benefice, meilleure, temps: tempsGagneMesure(b.vendu),
    colis: colisDuResume(main, maintenant), urssaf: urssafDuResume(main, maintenant) };
}
export const bilanMoisAEnvoyer = (b) => !!b && (b.vendu.etat !== 'pas-su' || b.recu.etat !== 'pas-su');

// ── LE TEXTE ────────────────────────────────────────────────────────────────
// Montants : virgule, espace fine insécable des milliers, espace insécable avant « € ».
// (17 nov.) La même règle, rangée dans api/_lib/mail-textes.js (`eurosFr`) ; les autres
// langues prennent la forme de l'app traduite (`eurosMail`).
export const euros = (x) => eurosFr(x);
const liste = (xs, max = 3) => (xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} et ${xs.length - max} autre${xs.length - max > 1 ? 's' : ''}`);

// « d’octobre », « d’avril », « d’août », mais « de novembre ».
export const deMois = (libelle) => (/^[aeiouyàâéèêîôû]/i.test(String(libelle)) ? 'd’' : 'de ') + libelle;
const duree = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`);
// (17 nov., « Améliore les emails aussi ») Dans la langue du compte (`langue`) : les mots
// d'api/_lib/mail-textes.js ; le français reste celui d'avant, mot pour mot. Les manques
// NOMMÉS par la lecture (« compte_x (lu le 28 oct.) ») sont des phrases françaises de
// bilan-semaine.js : dans une autre langue, l'e-mail dit qu'il en manque et renvoie à Compta.
export function texteBilanMois(b, { lien = '', parDefaut = false, langue = 'fr' } = {}) {
  const L = langueMail(langue), T = (k, v) => tm(L, k, v), fr = L === 'fr';
  const eur = (x) => eurosMail(x, L);
  // « Au moins 0 » ne se dit jamais (§5) : un total partiel nul s'écrit « — ».
  const val = (etat, x, f) => (etat === 'pas-su' || (etat === 'partiel' && !(Math.abs(Number(x)) > 0)) ? '—' : etat === 'partiel' ? T('bilan.auMoins', { x: f(x) }) : f(x));
  const v = b.vendu, r = b.recu, be = b.benefice;
  // « sur 4 ventes de 6 » : les ventes dont le prix d'achat est connu, sur toutes.
  const couverture = Number.isInteger(be.n) && Number.isInteger(be.nCout) && be.n > 0 ? tmN(L, 'bilan.couverture', be.nCout, { k: be.nCout, n: be.n }) : '';
  const manqueBe = fr ? (be.manque || []) : [
    ...(Number.isInteger(be.n) && Number.isInteger(be.nCout) && be.n > be.nCout ? [tmN(L, 'bilan.prixManquent', be.n - be.nCout)] : []),
    ...(Number.isFinite(be.calculeLe) && be.calculeLe > 0 ? [T('bilan.calculeLe', { jour: dateMail(be.calculeLe, L) })] : []),
  ];
  const raisonBe = fr || !be.code ? (fr ? be.raison : '') : T(`bilan.${be.code}`);
  const chiffres = [
    [T('bilan.ventes'), val(v.etat, v.n, String), v.etat === 'pas-su' ? T('bilan.pasLues') : ''],
    [T('bilan.vendu'), val(v.etat, v.eur, eur), T('bilan.auJourVente')],
    [T('bilan.recu'), val(r.etat, r.eur, eur), r.etat === 'pas-su' ? T('bilan.versementsPasLus') : T('bilan.verseMois')],
    // (8 nov.) La COUVERTURE à côté du chiffre (§5) : « sur 4 ventes de 6 » et le manque nommé ;
    // un partiel nul s'écrit « — » comme les autres (« au moins 0,00 € » ne se dit jamais).
    // (13 nov.) Jamais « au moins » devant un bénéfice (src/beneficeNoms.js) : le brut
    // connu, sa couverture et le manque nommé ; un partiel nul s'écrit « — ».
    [T('bilan.benefice'), be.etat === 'pas-su' || (be.etat === 'partiel' && !(Math.abs(Number(be.brut)) > 0)) ? '—' : eur(be.brut), be.etat === 'pas-su' ? raisonBe
      : be.etat === 'partiel' ? [couverture, ...manqueBe].filter(Boolean).join(' · ') : [T('bilan.formule'), be.n ? tmN(L, 'bilan.surVentes', be.n) : ''].filter(Boolean).join(', ')],
  ];
  // (22 nov.) Les colis non retirés (la publication de l'app) et le montant à déclarer à l'URSSAF (la notification du 1er).
  const co = b.colis;
  if (co) chiffres.push([T('bilan.colis'), co.etat === 'su' ? String(co.n) : '—',
    co.etat !== 'su' ? T('bilan.colisPasSu') : [Number.isFinite(co.at) ? T('bilan.colisReleve', { jour: dateMail(co.at, L) }) : '', co.aVerifier > 0 ? tmN(L, 'bilan.colisAVerifier', co.aVerifier) : ''].filter(Boolean).join(' · ')]);
  const ur = b.urssaf;
  if (ur) {
    const echeance = ur.dueIso && /^\d{4}-\d{2}-\d{2}$/.test(ur.dueIso) ? dateMail(Date.parse(ur.dueIso + 'T12:00:00Z'), L) : '';
    chiffres.push([T('bilan.urssaf'), ur.etat === 'declare' ? T('bilan.urssafDeclare') : ur.etat === 'pas-su' || !(Number(ur.eur) > 0) && ur.etat === 'partiel' ? '—' : ur.etat === 'partiel' ? T('bilan.auMoins', { x: eur(ur.eur) }) : eur(ur.eur),
      ur.etat === 'declare' ? '' : ur.etat === 'pas-su' ? T(ur.code === 'reglages' ? 'bilan.urssafReglages' : 'bilan.urssafPasSu')
        : [ur.label ? T('bilan.urssafPeriode', { periode: ur.label }) : '', echeance ? T('bilan.urssafAvant', { jour: echeance }) : ''].filter(Boolean).join(' · ')]);
  }
  if (b.meilleure) chiffres.push([T('bilan.plusBelle'), eur(b.meilleure.eur), [b.meilleure.titre, b.meilleure.plateforme].filter(Boolean).join(' · ')]);
  // (13 nov., lot 53) Le temps gagné : seulement MESURÉ (sinon la ligne n'existe pas).
  if (b.temps && b.temps.minutes > 0) chiffres.push([T('bilan.temps'), `≈ ${duree(b.temps.minutes)}`, tmN(L, 'bilan.mesure', b.temps.n)]);
  const manque = [...new Set([...(v.etat === 'partiel' ? v.manque : []), ...(r.etat === 'partiel' ? r.manque : [])])];
  const suite = [];
  if (manque.length) suite.push(fr ? T('bilan.manque', { liste: liste(manque) }) : T('bilan.manqueGenerique'));
  if (be.etat === 'partiel') suite.push(T('bilan.partielNote'));
  suite.push(T('bilan.regles'));
  // Le mois : « d’octobre 2026 » en français ; ailleurs, le nom du mois dans la langue.
  const dm = fr ? deMois(b.libelle) : (moisMail(b.mois, L) || String(b.libelle || ''));
  const titre = T('bilan.titre', { deMois: dm });
  // Le préentête : les deux chiffres qui comptent, tels qu'écrits dans le tableau.
  const preentete = T('bilan.apercu', { vendu: chiffres[1][1], recu: chiffres[2][1] });
  const { texte, html } = gabaritEmail({
    titre, preentete, paras: [T('bilan.intro', { deMois: dm })], chiffres, suite, facultatif: true, langue: L,
    bouton: { mot: T('bilan.bouton'), url: lienRecapMois(b.mois) },
    pied: { texte: parDefaut ? T('bilan.piedDefaut') : T('bilan.piedActive'), ...(lien ? { lien, motLien: T('bilan.desinscrire') } : {}) },
  });
  // (17 nov.) Un sujet PRÉCIS : le vendu du mois quand il est SU en entier (jamais un partiel,
  // jamais « 0 ») ; sinon le sujet d'avant. 70 caractères au plus.
  const avecVendu = v.etat === 'su' && Number(v.eur) > 0 ? T('bilan.sujetVendu', { deMois: dm, vendu: eur(v.eur) }) : '';
  return { sujet: avecVendu && avecVendu.length <= 70 ? avecVendu : T('bilan.sujet', { deMois: dm }), texte, html };
}

// ── LE LIEN « NE PLUS RECEVOIR » (signé, comme celui de l'essai) ───────────
const b64url = (x) => x.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function cleLien(service) {
  if (!service) return null;
  return crypto.createHmac('sha256', String(service)).update('vrm-bilan-mois-v1').digest();
}
export function jetonBilan(owner, service = process.env.SUPABASE_SERVICE_KEY || '') {
  const k = cleLien(service);
  if (!k || !UUID.test(String(owner || ''))) return null;
  const o = String(owner).toLowerCase();
  return `${o}.${b64url(crypto.createHmac('sha256', k).update(o).digest()).slice(0, 32)}`;
}
export function lireJetonBilan(t, service = process.env.SUPABASE_SERVICE_KEY || '') {
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{32})$/.exec(String(t || '').trim());
  if (!m || !UUID.test(m[1])) return null;
  const attendu = jetonBilan(m[1], service);
  if (!attendu) return null;
  const a = Buffer.from(attendu), c = Buffer.from(`${m[1]}.${m[2]}`);
  return a.length === c.length && crypto.timingSafeEqual(a, c) ? m[1] : null;
}
export const lienBilan = (owner, service) => { const t = jetonBilan(owner, service); return t ? `${SITE}/api/compte?mode=bilan-mois&d=${t}` : null; };

// ── LE PASSAGE D'UN VENDEUR (dans le cron du matin, son contexte) ──────────
// Les entrées sont des FONCTIONS (le cron donne les siennes, le banc les fausses) :
//   lireChoix() / lireEnvois()  → objet · null (absente) · undefined (pas su)
//   ecrireEnvois(data)          → true si la base a confirmé
//   lireDonnees()               → les lectures du bilan (`lireDonneesBilan`)
//   lirePub()                   → `vrm_benefice_jours` · null · undefined
//   adresse()                   → { etat:'ok', email } | { etat:… }
//   envoyer(message)            → { issue: 'envoye' | 'refuse' | 'incertain' }
//   compteur                    → { reste } partagé par tout le passage
//   config                      → `configurationRelances()` (le canal existant)
//   lireMain()                  → (22 nov.) `main` projeté sur MAIN_RESUME · null · undefined (pas su ⇒ « — »)
export async function bilanMoisVendeur({ owner, maintenant = Date.now(), lireChoix, lireEnvois, ecrireEnvois, lireDonnees, lirePub, lireMain = async () => undefined, adresse, envoyer, compteur, config, service }) {
  const mois = moisPasse(maintenant);
  if (mois.jour > JOUR_MAX) return null;                           // hors de la fenêtre : on ne lit RIEN
  const choix = await lireChoix();
  if (choix === undefined) return 'réglage illisible — rien';
  // (22 nov.) Jamais choisi ⇒ le défaut : allumé SEULEMENT si l'envoi est configuré. Éteint ⇒ aucune vente n'est lue.
  const pose = !!(choix && typeof choix === 'object' && typeof choix.actif === 'boolean');
  let adr = null;
  const configure = !!(config && config.pret);
  const actif = choixEffectif(choix, configure);
  if (actif === null) return 'défaut pas su — rien';
  if (!configure) return actif ? 'envoi non configuré' : 'éteint (envoi non configuré)';
  if (!actif) return 'éteint';
  const envois = await lireEnvois();
  if (envois === undefined) return 'mémo illisible — rien';
  const deja = envois && envois.mois && envois.mois[mois.ym];
  if (deja && ['envoye', 'incertain', 'en-cours'].includes(deja.issue)) return 'déjà envoyé';
  if (!compteur || compteur.reste <= 0) return 'plafond du jour — demain';
  const d = await lireDonnees();
  if (d && Array.isArray(d.comptes) && !d.comptes.length && !Array.isArray(d.lbc) && !Array.isArray(d.ebay)) return 'aucun compte lié';
  const pub = await lirePub();
  let main; try { main = await lireMain(); } catch (_) { main = undefined; }
  const b = calculerBilanMois({ d, pub: pub === undefined ? null : pub, mois, main, maintenant });
  if (!bilanMoisAEnvoyer(b)) return 'données illisibles — réessai demain';
  if (!adr) adr = await adresse();
  if (!adr || adr.etat !== 'ok') return `adresse ${adr ? adr.etat : 'pas su'}`;
  const lien = lienBilan(owner, service);
  if (!lien) return 'lien de désinscription impossible — rien';
  const t = texteBilanMois(b, { lien, parDefaut: !pose, langue: adr.langue });
  // Le plafond se prend AVANT tout envoi (les vendeurs passent 8 à la fois).
  if (compteur.reste <= 0) return 'plafond du jour — demain';
  compteur.reste -= 1;
  const base = { ...((envois && envois.mois) || {}) };
  if (!(await ecrireEnvois({ mois: { ...base, [mois.ym]: { at: new Date(maintenant).toISOString(), issue: 'en-cours' } } }))) { compteur.reste += 1; return 'réservation non confirmée — rien'; }
  let r;
  try {
    r = await envoyer({ a: adr.email, sujet: t.sujet, texte: t.texte, html: t.html,
      entetes: { 'List-Unsubscribe': `<${lien}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click', 'Auto-Submitted': 'auto-generated' } });
  } catch (e) { r = { issue: 'incertain' }; }
  const issue = ['envoye', 'refuse', 'incertain'].includes(r && r.issue) ? r.issue : 'incertain';
  const fin = issue === 'refuse' ? base : { ...base, [mois.ym]: { at: new Date(maintenant).toISOString(), issue } };
  if (issue === 'refuse') compteur.reste += 1;
  // (22 nov.) Une écriture ratée de la fin : rejouée UNE fois. Un refus doit libérer le mois (sinon « en cours »
  // le tiendrait pour toujours) ; un envoi parti reste « en cours » au pire — jamais renvoyé, jamais deux fois.
  if (!(await ecrireEnvois({ mois: fin })) && issue === 'refuse') await ecrireEnvois({ mois: fin });
  return { mois: mois.ym, issue, vendu: b.vendu.etat, recu: b.recu.etat, benefice: b.benefice.etat, colis: b.colis ? b.colis.etat : null, urssaf: b.urssaf ? b.urssaf.etat : null, ...(pose ? {} : { parDefaut: true }) };
}

// ── LE CHOIX DU VENDEUR (écrit par le serveur seul : sa session, ou le lien signé) ──
// Trois états à la lecture : objet · null (jamais choisi ⇒ le défaut, `choixEffectif`) · undefined (pas su).
const URL_BASE = () => process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
async function ligne(owner, id) {
  const service = process.env.SUPABASE_SERVICE_KEY || '';
  if (!service || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetchAvecDelai(`${URL_BASE()}/rest/v1/app_data?owner=eq.${encodeURIComponent(owner)}&id=eq.${id}&select=data&limit=1`, { headers: { ...sbCle(service) } });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!Array.isArray(j)) return undefined;
    const d = j[0] && j[0].data;
    return d && typeof d === 'object' ? d : null;
  } catch (_) { return undefined; }
}
export const lireChoixBilan = (owner) => ligne(owner, ID_CHOIX);
export const lireEnvoisBilan = (owner) => ligne(owner, ID_ENVOIS);
export async function ecrireChoixBilan(owner, actif) {
  const service = process.env.SUPABASE_SERVICE_KEY || '';
  if (!service || !UUID.test(String(owner || '')) || typeof actif !== 'boolean') return false;
  try {
    const r = await fetchAvecDelai(`${URL_BASE()}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{ owner: String(owner).toLowerCase(), id: ID_CHOIX, data: { actif, at: new Date().toISOString() } }]),
    });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) && j.length === 1;
  } catch (_) { return false; }
}
