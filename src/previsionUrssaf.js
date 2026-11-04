// ── PRÉVISION URSSAF : LE MONTANT DE LA PROCHAINE ÉCHÉANCE (3 nov.) ─────────
// Julien : le montant de la prochaine échéance (mois ou trimestre, SON rythme),
// d'après les versements déjà reçus dans la période.
// Règle PURE : l'écran (Comptabilité → « Prochaine déclaration ») et
// `scripts/audit-prevision-urssaf.cjs` l'appellent (§11).
//
// ⚠️ AUCUNE RÈGLE D'ARGENT N'EST RECOPIÉE ICI. La période (`nextUrssafDeadline`),
//    ses mois (`moisPeriodeUrssaf`), son montant (`montantPeriodeUrssaf` : la
//    ligne PUBLIÉE `vinted_urssaf_mois`, datée au VERSEMENT, « au moins » si
//    publiée avant la fin de la période ou s'il manque des ventes) et le registre
//    (`moisDeclare`) sont ceux de l'app, PASSÉS en argument (`regle`). L'audit
//    passe ceux de api/_lib/urssaf-regle.js, que audit-rappel-urssaf.cjs juge
//    identiques au jeton près à ceux de src/App.jsx.
//
// Ce que ce module décide, et seulement ça :
//   · le statut n'est pas « micro » ⇒ rien (ou la question, s'il n'est pas choisi) ;
//   · le rythme n'a jamais été choisi ⇒ « — » et le geste pour le choisir
//     (jamais « trimestriel » deviné) ;
//   · le registre pas encore lu ⇒ en cours (on ne recompte ni n'affirme rien) ;
//   · une échéance dont TOUS les mois sont notés « déclarés » est faite : la
//     prévision passe à la suivante ;
//   · un mois de la période déjà noté « déclaré » (trimestre à moitié noté)
//     n'est PAS recompté : il est retiré de la ligne avant le calcul ;
//   · « au moins » + le nombre de ventes « à dater » (sans date de versement)
//     quand il en manque.
export const RYTHMES = ['mensuel', 'trimestriel'];

const ligneSansMois = (ligne, retires) => (!ligne || !retires.length) ? ligne
  : { ...ligne, mois: (ligne.mois || []).filter((m) => !(m && retires.includes(m.ym))) };

export const previsionUrssaf = ({ regime, rythme, now = new Date(), ligne = null, declare, taux, regle } = {}) => {
  if (regime === undefined) return { etat: 'encours' };
  if (regime === null) return { etat: 'statut' };          // statut pas choisi : la question est posée
  if (regime !== 'micro') return { etat: 'horsMicro' };
  if (!RYTHMES.includes(rythme)) return { etat: 'rythme' };
  if (declare === undefined || declare === null) return { etat: 'encours', rythme };
  const { nextUrssafDeadline, moisPeriodeUrssaf, montantPeriodeUrssaf, moisDeclare } = regle;
  // L'échéance : la prochaine dont un mois au moins reste à déclarer (2 sauts au plus).
  let due = nextUrssafDeadline(rythme, now), sautees = [];
  for (let i = 0; due && i < 3; i++) {
    const yms = moisPeriodeUrssaf(due);
    if (!(yms.length && yms.every((ym) => moisDeclare(declare, ym)))) break;
    sautees.push(due.label);
    const lendemain = new Date(due.dueDate); lendemain.setDate(lendemain.getDate() + 1);
    const suiv = nextUrssafDeadline(rythme, lendemain);
    // Le compte à rebours part d'aujourd'hui, pas du lendemain de l'échéance faite.
    due = suiv ? { ...suiv, daysLeft: Math.round((new Date(suiv.dueDate).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000) } : null;
  }
  if (!due) return { etat: 'aucune', rythme };
  const yms = moisPeriodeUrssaf(due);
  const declares = yms.filter((ym) => moisDeclare(declare, ym));
  const { ca, apayer, partiel } = montantPeriodeUrssaf(due, ligneSansMois(ligne, declares), taux);
  const fin = new Date(due.periodEnd); fin.setHours(0, 0, 0, 0);
  const auj = new Date(now); auj.setHours(0, 0, 0, 0);
  const enCours = auj <= fin;
  const aDater = ligne && ligne.aDater && Number(ligne.aDater.n) > 0 ? Number(ligne.aDater.n) : 0;
  const base = { rythme, label: due.label, dueDate: due.dueDate, daysLeft: due.daysLeft, periodStart: due.periodStart, periodEnd: due.periodEnd, mois: yms, declares, sautees, enCours };
  if (ca == null) return { etat: 'passu', ...base, ca: null, apayer: null, partiel: false, aDater };
  return { etat: 'lu', ...base, ca, apayer, partiel, aDater: partiel ? aDater : 0 };
};
