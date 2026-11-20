// ═══════════════════════════════════════════════════════════════════════════
// PARAMÈTRES RANGÉS PAR CE QUE LE VENDEUR VEUT FAIRE (15 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « je veux que les paramètres soient améliorés », « quelque chose de
// pratique et de compréhensible », « un meilleur visuel » — il va ouvrir VRM à
// d'autres vendeurs. Mesuré avant (docs/passation/2026-11-15-parametres.md) :
// 73 rangées sur six écrans d'iPhone dans l'onglet « Réglages », 11 dans « Mon
// compte », l'abonnement dans un troisième onglet ; la recherche ne cherchait que
// dans le premier.
//
// Ici, la RÈGLE seule (aucun React) : dix catégories, chacune ses groupes, et la
// table des liens profonds. Le rendu est `src/ecrans/Reglages.jsx` ; les rangées
// (leurs `id`, leurs `data-*`, leurs panneaux) n'y changent pas : elles sont
// RANGÉES ailleurs, rien d'autre.
//
// ⚠️ Un réglage ajouté plus tard dans un groupe d'avant (`GROUPES_REGLAGES` /
// `GROUPES_COMPTE`) sans être nommé ici n'est JAMAIS perdu : il part dans la
// catégorie de son ancien groupe (`CATEGORIE_DU_GROUPE`), à la fin, sous le titre
// de ce groupe. (« Qui numérote ? » posé dans le groupe `stock`, par exemple,
// arrive dans « Stock et numéros ».) Un groupe inconnu va dans « Aide ».
// Vérifié par `scripts/audit-parametres.cjs` et le banc `parametres-refonte`.
// ═══════════════════════════════════════════════════════════════════════════

// Chaque catégorie : son id (stable : liens, bancs), son icône (ICON_PATHS), sa clé de
// titre et de phrase (tr), et ses groupes — un groupe = un titre (ou aucun) et ses
// rangées, dans l'ordre. `pied` : l'id d'un groupe d'avant dont la note de bas se garde.
export const CATEGORIES = [
  { id: 'compte', ic: 'key', groupes: [
    { id: 'profil', items: ['prenom'], pied: 'profil' },
    { id: 'offre', titre: 'parametres.g.abonnement', items: ['abonnement', 'abonnement-ouvrir'] },
    { id: 'connexion', titre: 'reglages.groupe.connexion', items: ['email', 'motdepasse', 'google', 'double', 'appareils', 'code-local', 'connexion-qr'] },
    { id: 'equipe', titre: 'parametres.g.equipe', items: ['equipe', 'lien-aide'] },
    { id: 'sortir', items: ['deconnexion'], pied: 'sortir' },
    { id: 'supprimer', items: ['fermer'] },
  ] },
  { id: 'plateformes', ic: 'grid', groupes: [
    { id: 'comptes', items: ['liens', 'connexions', 'verifier', 'ebay'] },
    { id: 'onglets', titre: 'parametres.g.onglets', items: ['mes-plateformes', 'historique'] },
    { id: 'emails', titre: 'reglages.groupe.emails-reglages', items: ['adresses', 'adresse-vrm', 'import'] },
  ] },
  { id: 'ventes', ic: 'truck', groupes: [
    { id: 'impression', titre: 'reglages.groupe.impression', items: ['imprimante'] },
    { id: 'colis', titre: 'parametres.g.colis', items: ['sms-colis', 'carte-merci'] },
    { id: 'annonces', titre: 'reglages.groupe.annonces-reglages', items: ['modeles'] },
  ] },
  { id: 'stock', ic: 'tag', groupes: [
    // « Stock et rangement » : le titre d'avant, et le lien « Organisation » dessous (CLAUDE.md §3).
    { id: 'stock', titre: 'reglages.groupe.stock', items: ['etiquetage', 'numeros', 'je-vends'], pied: 'stock' },
  ] },
  { id: 'argent', ic: 'euro', groupes: [
    { id: 'compta', items: ['regime', 'prixachat', 'masques', 'objectif-mois'] },
  ] },
  { id: 'notifications', ic: 'bell2', groupes: [
    { id: 'notifications', items: ['push', 'rappels', 'agenda', 'alertes', 'capte'] },
  ] },
  { id: 'apparence', ic: 'contraste', groupes: [
    { id: 'langue', items: ['langue', 'apparence', 'sombre', 'zoom', 'taille-texte'] },
    { id: 'ecrans', titre: 'parametres.g.ecrans', items: ['affichage-mode', 'ma-journee', 'configuration', 'atelier'] },
    { id: 'stream', titre: 'parametres.g.stream', items: ['stream-on', 'stream'] },
    { id: 'raccourcis', titre: 'parametres.g.raccourcis', items: ['widget', 'raccourcis-siri', 'raccourcis-clavier'] },
  ] },
  { id: 'securite-comptes', ic: 'shield', groupes: [
    { id: 'gardes', items: ['securite-comptes', 'discretion', 'vacances', 'santecomptes', 'copieannonces'] },
  ] },
  { id: 'aide', ic: 'help', groupes: [
    { id: 'etat', items: ['toutvabien', 'sante', 'statut', 'depannage'] },
    { id: 'aide', titre: 'reglages.groupe.aide', items: ['centre-aide', 'support', 'signaler', 'mes-signalements', 'quoi-de-neuf'] },
    { id: 'revoir', titre: 'parametres.g.revoir', items: ['bien-demarrer', 'visite', 'bilan-minute', 'premier-colis', 'aides-accueil', 'conseils', 'conseils-revoir'] },
    { id: 'proprietaire', titre: 'parametres.g.proprietaire', items: ['pilotage', 'nouveaux-comptes', 'paiements', 'signalements', 'demandes-aide', 'simulation-compte'] },
  ] },
  // « Sécurité des données » : le panneau expert (§5, vocabulaire technique assumé) TEL QUEL,
  // et ce qui touche aux données elles-mêmes (sauvegarde, retour en arrière, corbeille, confidentialité).
  { id: 'donnees', ic: 'lock', expert: true, groupes: [
    { id: 'securite', items: ['securite'] },
    { id: 'sauvegarde', titre: 'parametres.g.sauvegarde', items: ['export', 'restaurer', 'revenir', 'corbeille', 'importer', 'donnees'], pied: 'sauvegarde' },
    { id: 'confidentialite', titre: 'reglages.groupe.donnees', items: ['tes-donnees', 'journal-vrm', 'conditions'] },
  ] },
];

// Le groupe d'AVANT ⇒ sa catégorie (le filet des réglages ajoutés sans être nommés ci-dessus).
export const CATEGORIE_DU_GROUPE = {
  comptes: 'plateformes', 'emails-reglages': 'plateformes', notifications: 'notifications', 'abonnement-lien': 'compte',
  stock: 'stock', 'annonces-reglages': 'ventes', impression: 'ventes', compta: 'argent', affichage: 'apparence',
  sauvegarde: 'donnees', confort: 'compte', aide: 'aide',
  profil: 'compte', 'connexions-rapides': 'compte', boutique: 'compte', connexion: 'compte', sortir: 'compte', supprimer: 'compte', donnees: 'donnees',
  abonnement: 'compte',
};
export const CATEGORIE_PAR_DEFAUT = 'aide';

const ITEM_CAT = (() => { const m = {}; for (const c of CATEGORIES) for (const g of c.groupes) for (const id of g.items) m[id] = c.id; return m; })();

// La catégorie d'un réglage (son id de rangée). `groupeAvant` : le groupe d'avant, pour le filet.
export function categorieDe(id, groupeAvant) {
  const k = String(id || '');
  if (ITEM_CAT[k]) return ITEM_CAT[k];
  if (groupeAvant && CATEGORIE_DU_GROUPE[groupeAvant]) return CATEGORIE_DU_GROUPE[groupeAvant];
  return null;
}

// Ranger : `groupes` = les groupes d'avant (rangées déjà filtrées : seules celles qui EXISTENT ici,
// propriétaire, session…). Rend, par catégorie, ses groupes non vides — chaque rangée UNE fois.
// Une rangée qu'aucune catégorie ne nomme part dans celle de son groupe d'avant, sous son titre.
export function rangerParCategorie(groupes) {
  const parId = new Map(), groupeDe = new Map(), pieds = {}, titres = {};
  for (const g of groupes || []) {
    if (!g) continue;
    if (g.pied != null) pieds[g.id] = g.pied;
    titres[g.id] = g.titre || null;
    for (const it of g.items || []) { if (!it || parId.has(it.id)) continue; parId.set(it.id, it); groupeDe.set(it.id, g.id); }
  }
  const pris = new Set();
  const sortie = CATEGORIES.map((c) => ({ id: c.id, ic: c.ic, expert: !!c.expert, groupes: c.groupes.map((g) => {
    const items = g.items.map((id) => parId.get(id)).filter(Boolean);
    for (const it of items) pris.add(it.id);
    return { id: `${c.id}-${g.id}`, titreCle: g.titre || null, items, pied: g.pied != null ? pieds[g.pied] : undefined };
  }) }));
  // Le filet : ce qui n'est nommé nulle part, rangé sous le titre de son groupe d'avant.
  for (const [id, it] of parId) {
    if (pris.has(id)) continue;
    const ga = groupeDe.get(id);
    const cat = sortie.find((c) => c.id === (CATEGORIE_DU_GROUPE[ga] || CATEGORIE_PAR_DEFAUT));
    let g = cat.groupes.find((x) => x.id === `${cat.id}-autre-${ga}`);
    if (!g) { g = { id: `${cat.id}-autre-${ga}`, titre: titres[ga] || null, items: [] }; cat.groupes.push(g); }
    g.items.push(it); pris.add(id);
  }
  for (const c of sortie) { c.groupes = c.groupes.filter((g) => g.items.length); c.ids = c.groupes.flatMap((g) => g.items.map((it) => it.id)); }
  return sortie.filter((c) => c.groupes.length);
}

// ── LES LIENS PROFONDS ──────────────────────────────────────────────────────
// Chaque lien qui ouvrait un réglage avant le 15 nov. (`?tab=settings&reglage=X`, `&section=Y`,
// `DEMANDE_REGLAGE_SOUS.id = Z`, les conseils `reglages:Z`) ⇒ la rangée qu'il ouvre. La catégorie
// se déduit de la rangée (`categorieDe`). Relevée dans le code le 15 nov. (`grep -rn "reglage="`).
export const SECTIONS_ANCIENNES = { notifications: 'push', supprimer: 'fermer', demandesaide: 'demandes-aide', rappels: 'rappels', appareils: 'appareils', importer: 'importer', toutvabien: 'toutvabien', sante: 'sante', santecomptes: 'santecomptes', discretion: 'discretion' };
export const LIENS_PROFONDS = [
  // `?tab=settings&reglage=…` (src/aideFiches.js `REGLAGES_AIDE`, et les liens écrits dans l'app)
  'push', 'agenda', 'vacances', 'etiquetage', 'numeros', 'modeles', 'imprimante', 'regime', 'apparence', 'stream', 'zoom', 'corbeille',
  'verifier', 'toutvabien', 'connexions', 'depannage', 'appareils', 'double', 'equipe', 'abonnement', 'widget',
  'mes-plateformes', 'mes-signalements', 'nouveaux-comptes',
  // `DEMANDE_REGLAGE_SOUS` posé ailleurs (cloche, conseils, ligne de fraîcheur, santé, MFA, sections)
  'sante', 'santecomptes', 'discretion', 'rappels', 'importer', 'demandes-aide', 'fermer', 'signalements', 'ebay', 'securite-comptes', 'historique', 'copieannonces', 'journal-vrm', 'tes-donnees',
];
// Deux noms pour la même rangée : l'ancienne ligne « Mon abonnement » (un renvoi vers l'onglet) et la section.
export const ALIAS_LIENS = { 'abonnement-ouvrir': 'abonnement', notifications: 'push' };
export const rangeeDuLien = (id) => { const k = String(id || ''); return ALIAS_LIENS[k] || SECTIONS_ANCIENNES[k] || k; };

// ── L'ÉTAT DIT À DROITE D'UNE CATÉGORIE ─────────────────────────────────────
// La valeur d'UNE rangée de la catégorie, lue telle qu'elle est déjà dite sur sa ligne (§11 : une
// source). `null` ⇒ rien d'écrit (jamais « — » ni « n/d »).
export const VALEUR_DE_CATEGORIE = { ventes: 'imprimante', stock: 'numeros', argent: 'regime', apparence: 'langue' };
