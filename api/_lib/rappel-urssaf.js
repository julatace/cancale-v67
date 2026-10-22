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
import { rappelUrssaf, tauxDe, nextUrssafDeadline, moisPeriodeUrssaf, moisDeclare, _startOfDay } from './urssaf-regle.js';

// Les seules clés de `main` qu'elle lit (§4.4 : `main` pèse ~200 Ko).
export const MAIN_URSSAF = ['vinted_urssaf_freq', 'vinted_urssaf_taux', 'vrm_urssaf_declare', 'vinted_urssaf_mois'];
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const TITRE_URSSAF = '🧾 Déclaration URSSAF';
export const RAPPEL_SANS_MONTANT = 'Nouveau mois : pense à déclarer ton chiffre d\'affaires sur autoentrepreneur.urssaf.fr.';

// `today` = 'AAAA-MM-JJ' (Paris) ; `main` = la ligne projetée (objet) · `null`
// (aucune ligne) · `undefined` (pas su). Rend `{ envoyer, titre, corps, url,
// montant, raison }` — `montant` = à payer (nombre) ou `null`.
export function notificationUrssaf({ today, main }) {
  const url = '/?tab=journee';
  if (main === undefined) return { envoyer: true, titre: TITRE_URSSAF, corps: RAPPEL_SANS_MONTANT, url, montant: null, raison: 'réglages illisibles — rappel sans montant' };
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
  return { envoyer: true, titre: TITRE_URSSAF, corps: `${r.text}. ${r.sub}`, url, montant: r.apayer, raison: r.apayer == null ? 'sans ligne publiée — rappel sans montant' : 'avec le montant publié' };
}
