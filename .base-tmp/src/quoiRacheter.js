// ═══════════════════════════════════════════════════════════════════════════
// QUOI RACHETER — BÉNÉFICE PAR MODÈLE ET PAR TAILLE (14 nov., proposition 80)
// « Bénéfice par modèle et par taille : ce qui rapporte, ce qui part vite, quoi
// racheter. » docs/passation/2026-11-14-argent-choix.md
// ═══════════════════════════════════════════════════════════════════════════
// AUCUNE règle neuve pour les chiffres (§5, une règle par notion) : le classement
// est `classementRapporte` (src/ceQuiRapporte.js, « Ce qui rapporte le plus »), sur
// l'axe « modèle et taille » (`cleAxe`, modèle SÛR `modeleSur` + taille de la vente).
// Ce module ne fait que trois choses :
//   1. il ne garde que les ventes RELIÉES à leur prix d'achat (le relevé
//      `vrm_stats_ventes` : ventes finalisées, prix d'achat relié par IDENTITÉ — jamais
//      par ressemblance) : bénéfice, marge, délai et nombre se lisent sur elles seules,
//      et la couverture est dite (« sur 120 ventes reliées · 340 ventes ») ;
//   2. il trie (bénéfice total, par paire, marge, le plus vite, le plus vendu) ;
//   3. « À racheter » : un groupe d'au moins `MIN_RACHAT` ventes reliées ET datées,
//      dont le bénéfice par paire est au moins la médiane des groupes classables, et
//      le délai médian au plus leur médiane — les plus rentables ET les plus rapides.
//      Moins de 3 groupes classables ⇒ rien n'est conclu (`peu`), jamais un conseil
//      sur deux ventes.
// Module PUR : exécuté par scripts/audit-argent-choix.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { classementRapporte } from './ceQuiRapporte.js';

export const MIN_RACHAT = 3;
export const GROUPES_POUR_CONCLURE = 3;
export const TRIS_RACHAT = ['brut', 'moyen', 'marge', 'vite', 'nombre'];

const connu = (l) => l && l.achat != null && String(l.achat).trim() !== '' && Number.isFinite(Number(l.achat));
const mediane = (s) => { const a = s.slice().sort((x, y) => x - y); return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
const nulsApres = (a, b, f) => { const x = f(a), y = f(b); if ((x == null) !== (y == null)) return x == null ? 1 : -1; return x == null ? 0 : null; };

export function trierRachat(groupes, tri = 'brut') {
  const g = (groupes || []).slice();
  const parNom = (a, b) => (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0);
  const cmp = {
    brut: (a, b) => (nulsApres(a, b, (x) => x.brut) ?? (b.brut - a.brut)) || b.n - a.n || parNom(a, b),
    moyen: (a, b) => (nulsApres(a, b, (x) => x.moyen) ?? (b.moyen - a.moyen)) || b.n - a.n || parNom(a, b),
    marge: (a, b) => (nulsApres(a, b, (x) => x.marge) ?? (b.marge - a.marge)) || b.n - a.n || parNom(a, b),
    vite: (a, b) => (nulsApres(a, b, (x) => x.mediane) ?? (a.mediane - b.mediane)) || b.n - a.n || parNom(a, b),
    nombre: (a, b) => b.n - a.n || (nulsApres(a, b, (x) => x.brut) ?? (b.brut - a.brut)) || parNom(a, b),
  }[TRIS_RACHAT.includes(tri) ? tri : 'brut'];
  return g.sort(cmp);
}

// `lignes` : le relevé de la période (une ligne par vente finalisée, comme « Ce qui
// rapporte le plus » : { plateforme, eur, ts, achat, taille, modeleSur, enLigne… }).
// Rend null (relevé pas lu) ou { n, nReliees, nDelai, ecartees, groupes, autres, aRacheter,
// classables, seuil, peu }.
export function quoiRacheter(lignes, { tri = 'brut', min = MIN_RACHAT } = {}) {
  if (!Array.isArray(lignes)) return null;
  const tout = classementRapporte(lignes, 'site');           // la population (et ce qui est écarté)
  const reliees = lignes.filter(connu);
  const C = classementRapporte(reliees, 'modeleTaille');
  const nommes = C.groupes.filter((g) => g.k !== '');
  const autres = C.groupes.find((g) => g.k === '') || null;
  const classables = nommes.filter((g) => g.n >= min && g.nDelai >= min && g.moyen != null);
  let aRacheter = [], seuil = null;
  const peu = classables.length < GROUPES_POUR_CONCLURE;
  if (!peu) {
    seuil = { moyen: Math.round(mediane(classables.map((g) => g.moyen)) * 100) / 100, mediane: Math.round(mediane(classables.map((g) => g.mediane)) * 10) / 10 };
    aRacheter = classables.filter((g) => g.moyen > 0 && g.moyen >= seuil.moyen && g.mediane <= seuil.mediane)
      .sort((a, b) => b.moyen - a.moyen || a.mediane - b.mediane || b.n - a.n || (a.nom < b.nom ? -1 : 1));
  }
  return {
    n: tout.n, ecartees: tout.ecartees, nReliees: C.n, nDelai: C.nDelai,
    groupes: trierRachat(nommes, tri), autres: autres ? { n: autres.n, brut: autres.brut } : { n: 0, brut: null },
    classables: classables.length, aRacheter, seuil, peu, min,
  };
}
