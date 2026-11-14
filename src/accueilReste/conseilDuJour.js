// ── UN CONSEIL PAR JOUR PENDANT 30 JOURS (14 nov., idée d'accueil 140) ───────
// Dans Ma journée, en BAS (jamais au-dessus d'un geste à faire), une ligne : le
// conseil du jour N (N = jours depuis la création du compte VRM, 1 à 30), et « Voir »
// quand il mène à un écran. « × » le range pour aujourd'hui ; Paramètres → Aide le
// coupe pour de bon (`vrm_aides_accueil`, par compte). Après le 30e jour : plus rien.
// Le texte vit dans les dictionnaires (`cj.<n>`, 5 langues) ; un conseil décrit une
// fonction qui EXISTE (son `tab` est un écran que `?tab=` sait ouvrir).
// JS pur : scripts/audit-accueil-reste.cjs l'exécute.
import { aideActive, jourDuCompte, lireAides, JOURS_NEUF } from './aides.js';

// `tab` : l'écran que « Voir » ouvre (ONGLETS_LIENS), ou null (un conseil sans écran).
export const CONSEILS = Object.freeze([
  { n: 1, tab: 'annonces' }, { n: 2, tab: 'ventes' }, { n: 3, tab: 'achats' }, { n: 4, tab: 'garage' },
  { n: 5, tab: 'ventes' }, { n: 6, tab: 'compta' }, { n: 7, tab: 'settings' }, { n: 8, tab: 'annonces' },
  { n: 9, tab: 'messages' }, { n: 10, tab: 'achats' }, { n: 11, tab: 'garage' }, { n: 12, tab: 'stats' },
  { n: 13, tab: 'annonces' }, { n: 14, tab: 'compta' }, { n: 15, tab: 'settings' }, { n: 16, tab: 'ventes' },
  { n: 17, tab: 'emails' }, { n: 18, tab: 'annonces' }, { n: 19, tab: 'achats' }, { n: 20, tab: 'settings' },
  { n: 21, tab: 'stats' }, { n: 22, tab: 'garage' }, { n: 23, tab: 'messages' }, { n: 24, tab: 'compta' },
  { n: 25, tab: 'annonces' }, { n: 26, tab: 'settings' }, { n: 27, tab: 'ventes' }, { n: 28, tab: 'journee' },
  { n: 29, tab: 'settings' }, { n: 30, tab: null },
]);
export const cleConseil = (n) => `cj.${n}`;

// La date locale « AAAA-MM-JJ » (le jour où il l'a fermé).
export const jourLocal = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Le conseil à montrer aujourd'hui : { n, cle, tab } ou null.
//   · aide coupée, compte de plus de 30 jours, date de création illisible ⇒ null ;
//   · fermé aujourd'hui (× touché) ⇒ null jusqu'à demain ;
//   · `urgent` (un geste à faire est en tête de Ma journée) ne cache RIEN : la ligne
//     est rangée en bas, sous les gestes — c'est l'emplacement qui garantit qu'elle
//     n'est jamais au-dessus d'eux (`ordreConseil` le dit à l'écran).
export function conseilDuJour(reglage, { creeLe, maintenant = Date.now(), exemple = false } = {}) {
  if (!aideActive(reglage, 'conseil', { creeLe, maintenant, exemple })) return null;
  const j = jourDuCompte(creeLe, maintenant);
  if (j == null || j < 1 || j > JOURS_NEUF) return null;
  const r = lireAides(reglage);
  if (r.conseil && r.conseil.ferme && r.conseil.jour === jourLocal(maintenant)) return null;
  const c = CONSEILS[j - 1];
  return c ? { n: c.n, cle: cleConseil(c.n), tab: c.tab, jour: j } : null;
}
