// ═══════════════════════════════════════════════════════════════════════════
// LE PRIX D'ACHAT AU NUMÉROTAGE — UNE SEULE ÉCRITURE (6 nov., sa décision)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré en lecture seule le 5 nov. : aucune des 56 annonces en ligne n'avait
// de prix d'achat — le bénéfice est inconnu partout. Le moment où la paire est
// sous la main, c'est quand elle reçoit son N°. Julien (§2.5) : « il saisit les
// prix d'achat lui-même. Ne pas les deviner. »
//
// Ce module dit, pour TOUS les endroits où un prix est TAPÉ (saisie en série,
// feuille « Prix d'achat de la N°… » au numérotage, « Saisir » de la file Sans
// achat relié, ligne « mise en ligne numérotée par VRM », coût d'une vente) :
//   • ce que le texte tapé vaut : vide ⇒ RIEN n'est écrit (jamais un « 0 », jamais
//     un lien effacé) ; illisible ⇒ rien n'est écrit, on le dit ; sinon le
//     montant en centimes exacts (« 25 » → « 25,00 ») — jamais un parseFloat qui
//     lirait « 25 € environ » ou « 2x30 » comme un prix (une devinette) ;
//   • l'écriture : { buyPrice, buyFromId: null, buyFrom: null } — un prix tapé
//     n'est pas « relié à un achat » (la carte montrerait un achat qui n'a plus
//     rien à voir avec le chiffre) ;
//   • quand le demander : ni prix connu ni achat relié.
// Une suggestion d'achat (marque + taille + achat antérieur, `meilleureSuggestion`)
// peut être PROPOSÉE à côté (« Relier · 32 € ») : c'est SON tap qui relie, par
// l'écriture de « Relier un achat » (`ecritureRelierAchat` dans l'app). Rien ici
// ne remplit le champ, ne pré-remplit une valeur, ni n'écrit quoi que ce soit.
//
// Règles PURES, exécutées par scripts/audit-prix-numerotage.cjs.
// ─────────────────────────────────────────────────────────────────────────────
import { centimes } from './beneficePaire.js';

// Le prix tapé, relu en centimes (« 12,5 » → « 12,50 »). `undefined` = vide,
// `null` = illisible (on refuse, on ne devine pas).
export const prixAchatSaisi = (v) => {
  const t = String(v == null ? '' : v).trim();
  if (!t) return undefined;
  const c = centimes(t.replace(/\s|€/g, ''));
  return (c == null || c < 0) ? null : (c / 100).toFixed(2).replace('.', ',');
};

// L'ÉCRITURE d'un prix tapé. { etat: 'vide' | 'illisible' | 'ok', patch }.
// `patch` n'existe que pour 'ok' : c'est lui, et lui seul, qui part dans la fiche.
export function ecriturePrixSaisi(v) {
  const p = prixAchatSaisi(v);
  if (p === undefined) return { etat: 'vide', patch: null };
  if (p === null) return { etat: 'illisible', patch: null };
  return { etat: 'ok', patch: { buyPrice: p, buyFromId: null, buyFrom: null } };
}

// La phrase quand le montant est illisible (la même partout).
export const MONTANT_ILLISIBLE = 'Un montant en euros (ex : 25 ou 25,50).';

// Faut-il demander le prix d'achat à cette fiche ? Ni prix d'achat connu
// (`prixConnu` : la règle de l'app, nombre | null), ni achat relié.
export function prixADemander(fiche, prixConnu) {
  const e = fiche && typeof fiche === 'object' ? fiche : {};
  if (e.buyFromId != null && String(e.buyFromId).trim() !== '') return false;
  if (e.buyPrice != null && String(e.buyPrice).trim() !== '') return false;
  return !(prixConnu != null && Number.isFinite(Number(prixConnu)));
}

// Ce que la feuille du numérotage montre d'une suggestion : le bouton
// (« Relier · 32,90 € », ou « Relier » pour un lot / un prix inconnu) et une
// ligne de détail. `null` sans suggestion. N'écrit rien, ne pré-remplit rien.
export function suggestionNumerotage(texte, fmt) {
  if (!texte) return null;
  const f = typeof fmt === 'function' ? fmt : (n) => `${n.toFixed(2).replace('.', ',')}\u00a0€`;
  const prop = texte.proposition && Number.isSafeInteger(texte.proposition.centimes) && !texte.lot ? texte.proposition : null;
  return {
    bouton: prop ? `Relier · ${f(prop.centimes / 100)}` : 'Relier',
    detail: [texte.titre || 'Achat sans titre', texte.lot ? 'lot : le prix de cet article te sera demandé' : prop ? (prop.source === 'recu' ? 'prix du reçu' : 'article seul') : (texte.prixLu != null ? `payé ${f(texte.prixLu)}` : '')].filter(Boolean).join(' · '),
  };
}
