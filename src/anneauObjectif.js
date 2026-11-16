// ── LES MOTS DE L'ANNEAU DE L'OBJECTIF (15 nov., lot securite-ventes) ─────────────────────────────
// Pur (aucune lecture) : à partir de la progression (`progressionObjectif`, src/objectifMois.js — la
// valeur est la case « Vendu · mois », règle VENDU `ventesFaites`, comptes sélectionnés) et du reste
// (`resteObjectif`), ce que l'anneau de Ma journée écrit. Trois états (§5) :
//   · pas su (valeur `null`) ⇒ centre « — », la raison ; JAMAIS « 0 % » ;
//   · « au moins » (`partiel`) ⇒ « ≥ 35 % », le reste « au plus » ;
//   · atteint ⇒ « Objectif atteint ».
// Exécuté par scripts/audit-securite-ventes.cjs (A).
import { tr, date as dateLoc } from './i18n/index.js';
import { montant } from './format.js';
import { TYPES_OBJECTIF, estEuros, resteObjectif } from './objectifMois.js';

const euros = (v) => montant(v, { centimes: 'jamais' });

export function motsAnneau(prog, maintenant = Date.now()) {
  if (!prog) return null;
  const eur = estEuros(prog.type);
  const q = (v) => (eur ? euros(v) : tr('ann.nVentes', { n: v }));
  const type = TYPES_OBJECTIF[prog.type] ? prog.type : 'ca';
  const titre = tr('ann.titre.' + type, { cible: q(prog.objectif) });
  const pasSu = { titre, centre: '—', ligne: tr('ann.pasSu.' + type), etat: 'passu', pct: null };
  if (prog.valeur == null || prog.pct == null) return pasSu;
  const r = resteObjectif(prog, maintenant);
  if (!r) return pasSu;
  const centre = `${prog.partiel && !prog.atteint ? '≥ ' : ''}${prog.pct} %`;
  if (r.atteint) return { titre, centre, ligne: tr('ann.atteint'), etat: 'atteint', pct: 100 };
  const d = new Date(maintenant);
  const jour = dateLoc(new Date(d.getFullYear(), d.getMonth(), r.dernier), { day: 'numeric', month: 'short' });
  const ligne = r.jours <= 1
    ? tr(r.auPlus ? 'ann.aujourdhuiAuPlus' : 'ann.aujourdhui', { reste: q(r.reste) })
    : tr(r.auPlus ? 'ann.resteAuPlus' : 'ann.reste', { reste: q(r.reste), parJour: q(r.parJour), jour });
  return { titre, centre, ligne, etat: prog.partiel ? 'auMoins' : 'reste', pct: prog.pct };
}
