// ── LE MINI-GLOSSAIRE (14 nov., idée d'accueil 139) ──────────────────────────
// Julien : « toucher un mot (versement, à retirer, N°) l'explique en une phrase ».
// Chaque mot a UNE phrase (≤ 22 mots), écrite d'après la VRAIE règle de l'app
// (CLAUDE.md §5) — jamais une promesse que l'app ne tient pas. Le texte vit dans
// les dictionnaires (`glo.<mot>.mot` / `glo.<mot>.def`, 5 langues) ; ici la liste
// et l'ordre seulement. Désactivable (Paramètres → Aide, `vrm_aides_accueil`) :
// coupé, le mot reste écrit, sans soulignement ni bulle. Rien ne s'ouvre seul.
// JS pur : scripts/audit-accueil-reste.cjs l'exécute.

export const MOTS_GLOSSAIRE = Object.freeze([
  'versement',     // le CA déclaré est daté au versement (§5 « Les chiffres »)
  'aretirer',      // « À retirer » = preuve d'arrivée, aucune fin prouvée (§5 « Colis et retraits »)
  'numero',        // le N° de rangement, jamais réattribué (§5 « Les numéros »)
  'aexpedier',     // « À expédier » : le champ machine de la transaction (§5)
  'adater',        // une vente sans date de versement n'est dans aucun mois
  'enligne',       // la lecture complète la plus récente du dressing fait foi
  'vendue',        // « Vendue » se prouve
  'bordereau',     // VRM le génère et récupère son PDF
  'archive',       // « B… » : un ancien numéro ne se redonne jamais (013)
  'pasSu',         // « — » : pas su ne vaut pas 0
]);
export const MOTS_MAX_DEF = 22;
export const estMot = (m) => MOTS_GLOSSAIRE.includes(m);
export const cleMot = (m) => `glo.${m}.mot`;
export const cleDef = (m) => `glo.${m}.def`;
export const nombreDeMots = (t) => String(t || '').trim().split(/\s+/).filter((x) => /[\p{L}\p{N}]/u.test(x)).length;

// Les entrées dans l'ordre de l'alphabet de la langue (le mot traduit), pour la liste
// du « ? ». `tr` : la traduction ; `locale` : la langue courante (tri).
export function entreesGlossaire(tr, locale = 'fr') {
  const l = MOTS_GLOSSAIRE.map((m) => ({ cle: m, mot: tr(cleMot(m)), def: tr(cleDef(m)) }));
  try { const c = new Intl.Collator(locale, { sensitivity: 'base' }); return l.sort((a, b) => c.compare(a.mot, b.mot)); } catch (_) { return l; }
}
