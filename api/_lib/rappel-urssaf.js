// ── LA NOTIFICATION URSSAF DU 1er — LA RÈGLE DE L'APP, LE MONTANT PUBLIÉ (22 octobre) ──
// Avant : un texte fixe (« pense à déclarer ton chiffre d'affaires »), sans
// montant, qui sonnait le 1er de CHAQUE mois quel que soit son rythme, et même
// pour un mois déjà noté « déclaré ». Mesuré le 22 octobre : septembre, 89 ventes,
// 4 330,90 € reçus, ~584,67 € à payer avant le 31 octobre — la notification ne
// le disait pas.
// Maintenant (§11, une règle, un propriétaire) :
//   · la décision et le texte viennent de `rappelUrssaf` — la règle de l'app,
//     recopiée telle quelle dans ./urssaf-regle.js (jugée identique par
//     scripts/audit-rappel-urssaf.cjs) : rythme (`vinted_urssaf_freq`), période
//     FINIE, mois déjà notés dans `vrm_urssaf_declare` ⇒ rien ;
//   · le montant vient de la ligne PUBLIÉE par l'écran Ventes
//     (`vinted_urssaf_mois`), la même que la carte de Comptabilité et le
//     widget — le serveur ne recalcule aucun CA ;
//   · « pas su » (la ligne `main` n'a pas répondu) ⇒ le rappel d'aujourd'hui,
//     SANS montant : un rappel de trop coûte moins qu'une déclaration oubliée.
// Fonction PURE (aucune lecture, aucun envoi) : exécutée par l'audit.
import { rappelUrssaf, tauxDe, nextUrssafDeadline, moisPeriodeUrssaf, moisDeclare, montantPeriodeUrssaf, _startOfDay } from './urssaf-regle.js';
import { DESTINATIONS } from './lien-notif.js';
import { previsionUrssaf, RYTHMES } from '../../src/previsionUrssaf.js';

// Les seules clés de `main` qu'elle lit (§4.4 : `main` pèse ~200 Ko).
export const MAIN_URSSAF = ['vinted_regime', 'vinted_urssaf_freq', 'vinted_urssaf_taux', 'vrm_urssaf_declare', 'vinted_urssaf_mois'];
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const TITRE_URSSAF = '🧾 Déclaration URSSAF';
export const RAPPEL_SANS_MONTANT = 'Nouveau mois : pense à déclarer ton chiffre d\'affaires sur autoentrepreneur.urssaf.fr.';

// `today` = 'AAAA-MM-JJ' (Paris) ; `main` = la ligne projetée (objet) · `null`
// (aucune ligne) · `undefined` (pas su). Rend `{ envoyer, titre, corps, url,
// montant, raison }` — `montant` = à payer (nombre) ou `null`.
export function notificationUrssaf({ today, main }) {
  // (31 oct.) Comptabilité → « Ta déclaration URSSAF » : la carte du mois, son
  // montant et « C'est déclaré » (la même que Ma journée rappelle).
  const url = DESTINATIONS.urssaf();
  // (27 oct.) SEUL un micro-entrepreneur reçoit ce rappel : un particulier, une
  // société, un régime de la marge, ou un statut jamais choisi n'ont rien à
  // déclarer à l'URSSAF (règle de l'app : `urssafConcerne`). Réglages illisibles
  // ⇒ on ne sait pas s'il est concerné : rien (Ma journée le rappelle, elle).
  if (main === undefined) return { envoyer: false, raison: 'réglages illisibles — statut pas su' };
  if (!main || main.vinted_regime !== 'micro') return { envoyer: false, raison: 'pas micro-entrepreneur (statut : ' + ((main && main.vinted_regime) || 'pas choisi') + ')' };
  const [y, m, d] = String(today || '').split('-').map(Number);
  const now = new Date(y, (m || 1) - 1, d || 1, 12);
  const mm = objet(main);
  const freq = mm.vinted_urssaf_freq || 'trimestriel';          // le défaut de l'app (`load('vinted_urssaf_freq','trimestriel')`)
  const declare = objet(mm.vrm_urssaf_declare);                   // lue, absente : rien n'a été noté
  const ligne = mm.vinted_urssaf_mois && Array.isArray(mm.vinted_urssaf_mois.mois) ? mm.vinted_urssaf_mois : null;
  const r = rappelUrssaf({ freq, now, declare, ligne, taux: tauxDe(mm.vinted_urssaf_taux) });
  if (!r) {
    const due = nextUrssafDeadline(freq, now);
    const finie = due && _startOfDay(now) > _startOfDay(due.periodEnd);
    const toutNote = finie && moisPeriodeUrssaf(due).every((ym) => moisDeclare(declare, ym));
    return { envoyer: false, raison: toutNote ? 'déjà notée « déclarée »' : 'rien à déclarer ce mois-ci' };
  }
  // La phrase et le montant de Ma journée, mot pour mot (`text`, `sub`).
  // (22 oct., revue) Une ligne publiée trop tôt (avant la période, ou sans aucun
  // de ses mois avant sa fin) ne donne AUCUN montant — jamais « au moins 0,00 € ».
  return { envoyer: true, titre: TITRE_URSSAF, corps: `${r.text}. ${r.sub}`, url, montant: r.apayer, raison: r.apayer == null ? (ligne ? 'ligne publiée trop tôt pour cette période — rappel sans montant' : 'sans ligne publiée — rappel sans montant') : 'avec le montant publié' };
}

// ── LE RAPPEL LA VEILLE DE L'ÉCHÉANCE (13 nov., point 17 de Julien) ──────────
// Remplace le rappel « 3 jours ou moins » du 29 octobre (`rappelAvantEcheance`,
// retiré) : UNE notification la VEILLE de l'échéance, le montant prêt à recopier —
//   « Demain : déclaration URSSAF · 2927,47 € à déclarer »
// (« au moins » devant si la période est partielle ; jamais « encaissé »).
// Le toucher ouvre Argent → « Déclarer » (`DESTINATIONS.urssafDeclarer`), la
// carte où vit « Copier ».
// LA MÊME RÈGLE QUE CETTE CARTE (§11) : `previsionUrssaf` (src/previsionUrssaf.js)
// avec les règles d'argent de l'app (le miroir ./urssaf-regle.js, jugé identique
// par audit-rappel-urssaf.cjs) : le montant de la notification est celui écrit à
// côté de « Copier », au centime. Elle décide aussi :
//   · statut pas « micro » (ou pas choisi) ⇒ rien ;
//   · rythme jamais choisi ⇒ rien (jamais « trimestriel » deviné) ;
//   · une échéance dont tous les mois sont notés « déclarés » est faite : la
//     prévision passe à la suivante, qui n'est pas demain ⇒ rien ;
//   · un mois déjà noté d'un trimestre n'est pas recompté.
// Une seule fois par échéance : la clé (`cle`) est l'IDENTITÉ de l'échéance (sa
// date et ses mois) ; le cron la note dans `urssaf_reminder_dedup.veilleEcheance`.
// Le passage du matin manqué la veille ⇒ le jour même, « Aujourd'hui », une fois
// (la même clé). Heures calmes : celles de `sendPushToAll` (famille « Rappels »).
// Pas su (réglages illisibles) ⇒ rien. Fonction PURE : exécutée par
// scripts/audit-rappel-echeance.cjs (la règle ET le vrai cron).
const isoJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Le montant tel qu'il se tape sur le site de l'URSSAF (virgule, sans séparateur de milliers).
const eurRecopie = (n) => Number(n).toFixed(2).replace('.', ',') + ' €';
export function rappelVeilleUrssaf({ today, main }) {
  if (main === undefined || main === null) return { envoyer: false, raison: 'réglages illisibles — rien' };
  const mm = objet(main);
  if (mm.vinted_regime !== 'micro') return { envoyer: false, raison: 'pas micro-entrepreneur (statut : ' + (mm.vinted_regime || 'pas choisi') + ')' };
  const rythme = mm.vinted_urssaf_freq;
  if (!RYTHMES.includes(rythme)) return { envoyer: false, raison: 'rythme de déclaration pas choisi' };
  const [y, m, d] = String(today || '').split('-').map(Number);
  if (!y || !m || !d) return { envoyer: false, raison: 'date illisible' };
  const now = new Date(y, m - 1, d, 12);
  const ligne = mm.vinted_urssaf_mois && Array.isArray(mm.vinted_urssaf_mois.mois) ? mm.vinted_urssaf_mois : null;
  const P = previsionUrssaf({ regime: 'micro', rythme, now, ligne, declare: objet(mm.vrm_urssaf_declare), taux: tauxDe(mm.vinted_urssaf_taux),
    regle: { nextUrssafDeadline, moisPeriodeUrssaf, montantPeriodeUrssaf, moisDeclare } });
  if (P.etat !== 'lu' && P.etat !== 'passu') return { envoyer: false, raison: 'aucune échéance à rappeler (' + P.etat + ')' };
  if (P.enCours) return { envoyer: false, raison: 'période pas finie' };
  if (P.daysLeft !== 1 && P.daysLeft !== 0) return { envoyer: false, raison: P.daysLeft > 1 ? "pas encore la veille de l'échéance" : 'échéance passée' };
  const due = new Date(P.dueDate);
  const cle = `${isoJour(due)}:${(P.mois || []).join('+')}`;
  const quand = P.daysLeft === 1 ? 'Demain' : "Aujourd'hui";
  const montantTxt = P.ca == null ? null : `${P.partiel ? 'au moins ' : ''}${eurRecopie(P.ca)} à déclarer`;
  const titre = `${quand} : déclaration URSSAF${montantTxt ? ' · ' + montantTxt : ''}`;
  const periode = P.label ? P.label.charAt(0).toUpperCase() + P.label.slice(1) : '';
  const date = due.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const manque = P.partiel ? (P.aDater > 0 ? ` · ${P.aDater} vente${P.aDater > 1 ? 's' : ''} pas encore datée${P.aDater > 1 ? 's' : ''}` : ' · total pas encore complet') : '';
  const corps = P.ca == null
    ? `${periode}, à faire au plus tard le ${date}. Le montant se calcule dans Ventes (ouvre-le une fois), puis « Déclarer ».`
    : `${periode}, à faire au plus tard le ${date}${P.apayer != null ? ` · cotisations ≈ ${P.partiel ? 'au moins ' : ''}${eurRecopie(P.apayer)}` : ''}${manque}. Touche pour ouvrir « Déclarer » et copier le montant.`;
  return { envoyer: true, cle, titre, corps, url: DESTINATIONS.urssafDeclarer(), montant: P.ca == null ? null : P.ca, partiel: !!P.partiel, daysLeft: P.daysLeft,
    raison: (P.daysLeft === 1 ? 'la veille' : 'le jour même (veille manquée)') + (P.ca == null ? ' · sans montant' : P.partiel ? ' · montant partiel' : ' · avec le montant') };
}
