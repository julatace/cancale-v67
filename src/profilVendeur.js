// ── LE PROFIL DU VENDEUR : AFFICHAGE SIMPLE / COMPLET, ET CE QU'IL VEND (8 nov.) ──
// Julien : « fais tout » — d'autres vendeurs vont payer. Deux réglages, rangés
// dans Paramètres → Affichage, synchronisés (SYNC_KEYS) :
//
//  · `vrm_affichage` = { choix: 'auto' | 'simple' | 'complet', at }
//    En SIMPLE, la navigation ne montre pas ce qui ne sert pas encore (Stock,
//    Republier, les sites jamais reliés) et Ma journée garde les seuls gestes
//    dus. RIEN n'est supprimé : chaque écran reste joignable par son lien et
//    revient d'un geste (« Complet »). Aucun total ne change : on ne cache que
//    des ENTRÉES de navigation et un conseil (« Prix à baisser »), jamais une
//    ligne d'un calcul.
//    Défaut automatique : Simple seulement si l'on SAIT qu'il a UN compte Vinted
//    et moins de 30 ventes lues sur 30 jours ; jamais pour le propriétaire de
//    l'installation (Julien) ; « pas su » ⇒ Complet (on ne cache rien sur un doute).
//
//  · `vrm_je_vends` = { choix: 'auto' | 'sneakers' | 'autre', at }
//    « Sneakers » garde le vocabulaire de Julien (« paire ») et juge taille et
//    marque avant une publication. « Autre » (vêtements, sacs, livres…) : taille
//    et marque sont FACULTATIVES — jamais un « manquante » ni un geste ambre — et
//    l'app dit « article ». Défaut : Sneakers pour le propriétaire, Autre sinon
//    (un mot neutre ne trompe personne ; un « taille absente » sur un livre, si).
//
// Règles PURES (aucune lecture) : exécutées par scripts/audit-vendeurs-differents.cjs.

export const CLE_AFFICHAGE = 'vrm_affichage';
export const CLE_JE_VENDS = 'vrm_je_vends';
export const SEUIL_VENTES_SIMPLE = 30;
export const JOURS_VENTES_SIMPLE = 30;

const choixDe = (r, permis) => {
  const c = r && typeof r === 'object' ? r.choix : r;
  return permis.includes(c) ? c : 'auto';
};
export const lireReglageAffichage = (r) => ({ choix: choixDe(r, ['auto', 'simple', 'complet']), at: (r && r.at) || null });
export const lireReglageJeVends = (r) => ({ choix: choixDe(r, ['auto', 'sneakers', 'autre']), at: (r && r.at) || null });

// Le défaut automatique. `proprietaire` : true · false · null (pas su).
// `nComptesVinted` : nombre de comptes Vinted reliés (null = pas su).
// `nVentes30j` : ventes lues sur les 30 derniers jours (null = pas su / partiel).
export function affichageAuto({ proprietaire, nComptesVinted, nVentes30j } = {}) {
  if (proprietaire !== false) return 'complet';
  if (nComptesVinted !== 1) return 'complet';
  if (typeof nVentes30j !== 'number' || !Number.isFinite(nVentes30j)) return 'complet';
  return nVentes30j < SEUIL_VENTES_SIMPLE ? 'simple' : 'complet';
}
// → { mode: 'simple' | 'complet', auto: boolean }
export function affichageEffectif(reglage, contexte) {
  const r = lireReglageAffichage(reglage);
  if (r.choix === 'simple' || r.choix === 'complet') return { mode: r.choix, auto: false };
  return { mode: affichageAuto(contexte), auto: true };
}
// → { vend: 'sneakers' | 'autre', auto: boolean }
export function jeVendsEffectif(reglage, { proprietaire } = {}) {
  const r = lireReglageJeVends(reglage);
  if (r.choix === 'sneakers' || r.choix === 'autre') return { vend: r.choix, auto: false };
  return { vend: proprietaire === true ? 'sneakers' : 'autre', auto: true };
}

// Le nombre de ventes des 30 derniers jours, depuis les lignes de « Vendu »
// (`ventesFaites` : lignes comptées + non comptées datées). `null` si la lecture
// est partielle ou en cours : « pas su » ne vaut pas « peu ».
export function ventesSur30j({ lignes, nonComptees, partiel, maintenant = Date.now() } = {}) {
  if (partiel || !Array.isArray(lignes)) return null;
  const depuis = maintenant - JOURS_VENTES_SIMPLE * 86400000;
  let n = 0;
  for (const l of lignes) if (l && l.ts >= depuis) n += 1;
  for (const l of (Array.isArray(nonComptees) ? nonComptees : [])) if (l && l.ts && l.ts >= depuis) n += 1;
  return n;
}

// ── LA NAVIGATION EN SIMPLE ────────────────────────────────────────────────
// Une entrée (cle = `t.cle || t.id`, celle de GROUPES_PLUS) est-elle montrée ?
//  · Complet : toujours (la règle d'avant, inchangée).
//  · Simple  : Stock (`garage`) seulement s'il a déjà des meubles ; Republier
//    seulement s'il a déjà republié ; un site (eBay, Leboncoin, Vestiaire)
//    seulement s'il est RELIÉ ou pas su (`relies[site]` : true · false · null).
// `usage` : { stock: bool|null, republier: bool|null } — null = pas su ⇒ montré.
export const ENTREES_SIMPLE = { garage: 'stock', republier: 'republier' };
export function entreeMontree(t, { mode, usage = {}, relies = {} } = {}) {
  if (mode !== 'simple' || !t) return true;
  const cle = t.cle || t.id;
  const u = ENTREES_SIMPLE[cle];
  if (u) return usage[u] !== false;
  if (t.site) return relies[t.site] !== false;
  return true;
}
// Les filtres de site (Ventes, Annonces, Messages, Achats) en Simple : Vinted,
// le site choisi, et ceux qui ne sont pas PROUVÉS absents.
export function siteMontre(site, { mode, relies = {}, choisi = '' } = {}) {
  if (mode !== 'simple') return true;
  if (site === 'vinted' || site === 'toutes' || site === choisi) return true;
  return relies[site] !== false;
}
// Ma journée en Simple : les gestes DUS restent tous (colis, retraits, messages,
// litiges, numéros…) ; seul le CONSEIL « Prix à baisser » se tait. Son compteur
// reste publié (même nombre pour les autres écrans).
export const CASES_JOURNEE_CONSEIL = ['prix'];
export const caseJourneeMontree = (id, mode) => mode !== 'simple' || !CASES_JOURNEE_CONSEIL.includes(id);

// ── LES MOTS ────────────────────────────────────────────────────────────────
// « paire » pour un vendeur de sneakers (Julien), « article » sinon. Chaque
// forme est écrite en entier (le genre change l'accord : « une paire vendue »,
// « un article vendu ») : jamais un remplacement de mot dans une phrase.
const MOTS = {
  sneakers: { nom: 'paire', noms: 'paires', un: 'une paire', Un: 'Une paire', le: 'la paire', Le: 'La paire', ce: 'cette paire', tes: 'tes paires', e: 'e', es: 'es', chaque: 'Chaque paire', elle: 'elle', Elle: 'Elle', une: 'une' },
  autre:    { nom: 'article', noms: 'articles', un: 'un article', Un: 'Un article', le: 'l’article', Le: 'L’article', ce: 'cet article', tes: 'tes articles', e: '', es: 's', chaque: 'Chaque article', elle: 'il', Elle: 'Il', une: 'un' },
};
export const motsArticle = (vend) => MOTS[vend === 'sneakers' ? 'sneakers' : 'autre'];
// « 3 paires » / « 1 article » (le nombre et le nom accordé).
export const nArticles = (n, vend) => { const m = motsArticle(vend); return `${n} ${n > 1 ? m.noms : m.nom}`; };

// ── TAILLE ET MARQUE : FACULTATIVES HORS SNEAKERS ───────────────────────────
// Ce qu'on passe à `problemesAnnonce` (src/verifAnnonce.js) : `facultatifs: true`
// ⇒ taille et marque ne sont ni jugées ni dites « pas lues ».
export const champsFacultatifs = (vend) => vend !== 'sneakers';
