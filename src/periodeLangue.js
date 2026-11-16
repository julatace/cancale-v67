// ══ LA PÉRIODE DU LIVRE ET DU REGISTRE, DANS LA LANGUE DE L'ÉCRAN (16 nov., lot traduction-restes) ══
// `libellePeriode` (src/registres.js) écrit « novembre 2026 », « 1er trimestre 2026 », « année 2026 » :
// c'est le titre des DOCUMENTS (livre des recettes, registre des achats, export comptable — en
// français, documents fiscaux français). Ce que l'écran AFFICHE (le choix de la période) suit la
// langue : en français, le texte d'avant mot pour mot (la même fonction) ; ailleurs, le mois par
// Intl et l'année / le trimestre par tr().
import { libellePeriode } from './registres.js';
import { t as tr, langueCourante, date as dateLangue, ajouterSourceApp } from './i18n/index.js';
import frRestes from './i18n/langues/fr/restes.js';
ajouterSourceApp(frRestes);

export function libellePeriodeLangue(p) {
  if (langueCourante() === 'fr') return libellePeriode(p);
  const s = String(p || '');
  if (/^\d{4}$/.test(s)) return tr('periode.annee', { a: s });
  const t = /^(\d{4})-T([1-4])$/.exec(s);
  if (t) return t[2] === '1' ? tr('periode.trimestre.1', { a: t[1] }) : tr('periode.trimestre.n', { t: t[2], a: t[1] });
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(s);
  if (m) return dateLangue(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15, 12)), { month: 'long', year: 'numeric' }) || libellePeriode(p);
  return libellePeriode(p);
}
