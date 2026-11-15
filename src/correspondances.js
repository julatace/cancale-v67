// ════════════════════════════════════════════════════════════════════════════
//  LES CORRESPONDANCES ENTRE SITES — VINTED → LEBONCOIN · EBAY · VESTIAIRE (15 nov. 2026)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « quand je poste une paire sur Vinted, je veux pouvoir la poster sans
// souci sur Leboncoin, eBay et Vestiaire, pour que les catégories correspondent
// parfaitement entre elles […] quand on met en ligne sur Leboncoin tout doit être
// vraiment parfait. »
//
// UNE TABLE, VÉRIFIÉE, JAMAIS DEVINÉE (§5) :
//   · la clé est la catégorie Vinted de l'annonce (`catalog_id`, lue par
//     l'extension sur la page de l'annonce — `codes.catalog_id`) ; jamais le titre ;
//   · chaque cible vient de la liste que le SITE lui-même sert :
//       Leboncoin — `lbc_catalogue` (fdata v7 du 8 nov. 2026 : rubriques, catégories,
//         critères et leurs valeurs ; formulaire de dépôt de la catégorie 53 du
//         15 oct. : Univers, Type de chaussures, Marque, Pointure, État, Couleur) ;
//       Vestiaire — `vc_catalogue.deposit_catalog` (libellés relevés le 27 oct.) ;
//       eBay — l'API Taxonomy (`get_category_suggestions`) sur SON jeton, au moment
//         où il choisit (route `parametres` d'api/ebay.js) : AUCUN id eBay n'est écrit
//         ici, il n'y en a aucun de vérifié ;
//   · une correspondance pas sûre ⇒ `demande` : la fiche montre les valeurs du site
//     et retient SA réponse pour la prochaine fois (`vrm_correspondances`, par
//     catégorie Vinted) ; jamais un choix au hasard ;
//   · le genre (Femme/Homme/Enfant) ne vient QUE du chemin Vinted ;
//   · la pointure reste EU : la conversion US/UK dépend de la marque (une 42,5 Nike
//     n'est pas une 42,5 adidas en US) ⇒ jamais convertie, la grille EU est celle
//     des quatre sites.
//
// Module PUR (aucune lecture, aucune écriture) : la feuille Publier partout, son
// hôte (App.jsx) et scripts/audit-correspondances.cjs exécutent CES fonctions.

const str = (v) => String(v == null ? '' : v).trim();
const norm = (v) => str(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

export const SOURCES = Object.freeze({
  leboncoin: 'lbc_catalogue · fdata v7 (8 nov. 2026) + formulaire de dépôt catégorie 53 (15 oct. 2026)',
  vestiaire: 'vc_catalogue · deposit_catalog (27 oct. 2026), libellés relevés',
  ebay: 'API Taxonomy eBay France (get_category_suggestions), sur ton jeton, quand tu choisis',
  vinted: 'vinted_catalogue (catalog_id → chemin), vu sur tes annonces et tes ventes',
});

// ── LEBONCOIN : CE QUE LE SITE SERT (fdata v7, 8 nov.) ─────────────────────
// Rubrique → catégorie → son identifiant chez Leboncoin.
export const LBC_RUBRIQUES = Object.freeze({
  Mode: Object.freeze({ id: '72', sous: Object.freeze({ 'Vêtements': '22', 'Chaussures': '53', 'Accessoires & Bagagerie': '47', 'Montres & Bijoux': '42' }) }),
  Famille: Object.freeze({ id: '79', sous: Object.freeze({ 'Vêtements bébé': '54', 'Vêtements enfants': '1011', 'Chaussures enfants': '1013', 'Montres & bijoux enfants': '1014', 'Accessoires & bagagerie enfants': '1015', 'Jeux & Jouets': '1016' }) }),
  Loisirs: Object.freeze({ id: '24', sous: Object.freeze({ 'Livres': '27', 'Jeux & Jouets': '41', 'Loisirs créatifs': '88', 'Sport & Plein air': '29' }) }),
});
// `cle` : le libellé de la catégorie, ou « Rubrique › Catégorie » quand deux rubriques
// portent le même nom (« Jeux & Jouets » : Famille et Loisirs) — jamais un nom ambigu.
export const lbcSousCategories = () => {
  const l = Object.entries(LBC_RUBRIQUES).flatMap(([r, x]) => Object.keys(x.sous).map((s) => ({ rubrique: r, sous: s, id: x.sous[s] })));
  return l.map((x) => ({ ...x, cle: l.filter((y) => y.sous === x.sous).length > 1 ? `${x.rubrique} › ${x.sous}` : x.sous, ambigu: l.filter((y) => y.sous === x.sous).length > 1 }));
};
// Les critères, valeur par valeur (libellés EXACTS du site).
export const LBC_VALEURS = Object.freeze({
  shoe_type: Object.freeze(['Femme', 'Homme', 'Enfant']),
  shoe_category_a: Object.freeze(['Baskets & Sneakers', 'Chaussures à lacets', 'Chaussures à scratch', 'Mocassins', 'Bottines & lowboots', 'Bottes', 'Escarpins', 'Sandales & Nu-pieds', 'Chaussons & Pantoufles', 'Ballerines', 'Chaussures de randonnées', 'Chaussures aquatiques', 'Autre']),
  shoe_size: Object.freeze([...Array.from({ length: 34 }, (_, i) => { const n = 16 + Math.floor(i / 2); return i % 2 ? `${n},5` : String(n); }), '33', '33,5', '34', '34,5', '35', '35,5', '36', '36,5', '37', '37,5', '38', '38,5', '39', '39,5', '40', '40,5', '41', '41,5', '42', '42,5', '43', '43,5', '44', '44,5', '45', '45,5', '46', '46,5', '47', '47,5', '48', '48,5', '49', '49,5', '50 et plus']),
  clothing_condition_a: Object.freeze(['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'État satisfaisant']),
  clothing_color_a: Object.freeze(['Argenté / Acier', 'Beige / Camel', 'Blanc', 'Bleu / Ciel', 'Crème / Blanc cassé / Écru', 'Doré / Bronze / Cuivre', 'Gris / Anthracite', 'Imprimé', 'Jaune / Moutarde', 'Kaki', 'Lavande / Lilas', 'Marine / Turquoise', 'Marron', 'Multicolore', 'Noir', 'Orange / Corail', 'Rose / Fuchsia', 'Rouge / Bordeaux', 'Vert', 'Violet / Mauve', 'Autre']),
  clothing_type: Object.freeze(['Femme', 'Maternité', 'Homme', 'Enfant']),
  clothing_tag: Object.freeze(['Robes / jupes', 'Manteaux & Vestes', 'Hauts / T-Shirts / Polos', 'Pantalons', 'Pulls / Gilets / Mailles', 'Jeans', 'Chemises / Chemisiers', 'Costumes / Tailleurs', 'Shorts / Pantacourts / Bermudas', 'Sports / Danse', 'Maillots de bain & vêtements de plage', 'Lingerie', 'Sous-vêtements & vêtements de nuit', 'Déguisement', 'Mariage', 'Autre']),
  clothing_st_2: Object.freeze(['Taille unique', '30 - XXXS', '32 - XXS', '34 - XS', '36 - S', '38 - M', '40 - L', '42 - XL', '44 - XXL', '46 - XXXL', '48 - 4XL', '50 - 5XL', '52 - 6XL', '54 - 7XL', '56 - 8XL et plus']),
  clothing_st_3: Object.freeze(['Taille unique', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL', '6XL', '7XL', '8XL et plus']),
  clothing_st_4: Object.freeze(['3 ans / 98 cm', '4 ans / 104 cm', '5 ans / 110 cm', '6 ans / 116 cm', '7 ans / 122 cm', '8 ans / 128 cm', '9 ans / 134 cm', '10 ans / 140 cm', '11 ans / 146 cm', '12 ans / 152 cm', '13 ans / 158 cm', '14 ans / 164 cm', '15 ans / 170 cm', '16 ans / 176 cm', '18 ans / 182 cm +']),
  accessories_univers: Object.freeze(['Femme', 'Homme', 'Enfant', 'Mixte']),
  accessories_type: Object.freeze(['Accessoire pour cheveux', 'Bonnet, bob, béret', 'Bretelles', 'Cartable', 'Casquette', 'Ceinture', 'Châle et étole', 'Chapeau', 'Cravate & noeud papillon', 'Echarpe & foulard', 'Etui téléphone', 'Gants, mitaines & moufles', 'Housse de tablette & ordinateur', 'Lunettes', 'Mallette', 'Parapluie', 'Perruque', 'Pochette', 'Porte-cartes', 'Porte-chéquier', 'Porte-clés', 'Porte documents, serviette', 'Porte-habits', 'Porte-monnaie & portefeuille', 'Sac à dos', 'Sac à main', 'Sac de voyage', 'Sac en bandoulière', 'Sac weekender', 'Sacoche', 'Tote bag', 'Trousse', 'Valise cabine', 'Valise moyenne et grande taille', 'Autre']),
  // Marques : le site en sert 793 pour les chaussures ; celles de SES ventes, relevées dans la liste.
  shoe_brand_a: Object.freeze(['Adidas', 'Asics', 'Converse', 'Dr. Martens', 'Hoka One One', 'Jordan', 'New Balance', 'Nike', 'Paraboot', 'Puma', 'Reebok', 'Salomon', 'Vans', 'Veja', 'Autre']),
});
// Les critères de chaque catégorie Leboncoin. `vu` : 'depot' = vu dans le
// formulaire de dépôt de cette catégorie ; 'liste' = valeurs servies par le site,
// formulaire de la catégorie pas encore vu (l'extension choisit au libellé
// exact, ou ne choisit rien et le dit) ; une catégorie absente : rien de connu.
export const LBC_CRITERES_DE = Object.freeze({
  'Chaussures': Object.freeze({ vu: 'depot', univers: 'shoe_type', type: 'shoe_category_a', taille: 'shoe_size', etat: 'clothing_condition_a', couleur: 'clothing_color_a', marque: 'shoe_brand_a' }),
  'Chaussures enfants': Object.freeze({ vu: 'liste', type: 'shoe_category_a', taille: 'shoe_size', etat: 'clothing_condition_a', couleur: 'clothing_color_a', marque: 'shoe_brand_a' }),
  'Vêtements': Object.freeze({ vu: 'liste', univers: 'clothing_type', type: 'clothing_tag', taille: 'clothing_st', etat: 'clothing_condition_a', couleur: 'clothing_color_a' }),
  'Vêtements enfants': Object.freeze({ vu: 'liste', type: 'clothing_tag', taille: 'clothing_st_4', etat: 'clothing_condition_a', couleur: 'clothing_color_a' }),
  'Accessoires & Bagagerie': Object.freeze({ vu: 'liste', univers: 'accessories_univers', type: 'accessories_type', etat: 'clothing_condition_a', couleur: 'clothing_color_a' }),
  'Accessoires & bagagerie enfants': Object.freeze({ vu: 'liste', type: 'accessories_type', etat: 'clothing_condition_a', couleur: 'clothing_color_a' }),
});

// ── VESTIAIRE : CE QUE LE SITE SERT (catalogue de dépôt, 27 oct.) ───────────
// Seulement les libellés RELEVÉS ; la liste entière des sous-catégories n'a pas été
// vue (ce qui n'y est pas se demande, et se choisit sur Vestiaire).
export const VC_CATALOGUE = Object.freeze({
  'Mode femme': Object.freeze({ 'Chaussures': Object.freeze(['Baskets', 'Bottes', 'Mocassins']), 'Sacs': Object.freeze(['Sacs à main', 'Pochettes', 'Sacs à dos']), 'Vêtements': Object.freeze(['Jeans', 'Tops']) }),
  'Mode homme': Object.freeze({ 'Chaussures': Object.freeze(['Baskets', 'Bottes & Boots', 'Mocassins']), 'Vêtements': Object.freeze(['Tee shirts', 'Jeans']) }),
  'Mode fille': Object.freeze({ 'Chaussures': Object.freeze(['Baskets']) }),
});

// ── LA TABLE : CHAQUE CATÉGORIE VINTED VUE CHEZ LUI ────────────────────────
// (mesuré le 15 nov. en lecture seule : ses annonces — `vinted_item_details.codes` —
//  et ses ventes et achats — transactions —, 23 catégories ; aucun nombre ni donnée
//  personnelle ici, seulement la taxonomie publique de Vinted.)
//   lbc : { sous, univers?, type? } — une valeur absente d'un critère que la catégorie
//         a ⇒ demandée ; `demande: [...]` nomme ce qui ne se décide pas ;
//   vc  : { univers, categorie, sous } ou `demande` ; `hors: true` = le site ne vend pas ça ;
//         `posee` : l'extension d'aujourd'hui pose-t-elle cette catégorie toute seule ?
//   ebay: { requete } — ce que VRM demande à eBay pour te proposer SES catégories.
const T = (chemin, genre, lbc, vc, ebay) => Object.freeze({ chemin, genre, lbc: Object.freeze(lbc), vc: Object.freeze(vc), ebay: Object.freeze(ebay) });
export const TABLE_VINTED = Object.freeze({
  1242: T('Hommes > Chaussures > Baskets', 'homme',
    { sous: 'Chaussures', univers: 'Homme', type: 'Baskets & Sneakers' }, { univers: 'Mode homme', categorie: 'Chaussures', sous: 'Baskets', posee: true }, { requete: 'baskets homme' }),
  2632: T('Femmes > Chaussures > Baskets', 'femme',
    { sous: 'Chaussures', univers: 'Femme', type: 'Baskets & Sneakers' }, { univers: 'Mode femme', categorie: 'Chaussures', sous: 'Baskets', posee: true }, { requete: 'baskets femme' }),
  2678: T('Hommes > Chaussures > Chaussures de sport > Chaussures et bottes de randonnée', 'homme',
    { sous: 'Chaussures', univers: 'Homme', type: 'Chaussures de randonnées' }, { univers: 'Mode homme', categorie: 'Chaussures', demande: ['sous'] }, { requete: 'chaussures randonnée homme' }),
  2645: T('Femmes > Chaussures > Chaussures de sport > Chaussures et bottes de randonnée', 'femme',
    { sous: 'Chaussures', univers: 'Femme', type: 'Chaussures de randonnées' }, { univers: 'Mode femme', categorie: 'Chaussures', demande: ['sous'] }, { requete: 'chaussures randonnée femme' }),
  1453: T('Hommes > Chaussures > Chaussures de sport > Chaussures de course', 'homme',
    { sous: 'Chaussures', univers: 'Homme', type: 'Baskets & Sneakers' }, { univers: 'Mode homme', categorie: 'Chaussures', demande: ['sous'] }, { requete: 'chaussures running homme' }),
  2651: T('Femmes > Chaussures > Chaussures de sport > Chaussures de course', 'femme',
    { sous: 'Chaussures', univers: 'Femme', type: 'Baskets & Sneakers' }, { univers: 'Mode femme', categorie: 'Chaussures', demande: ['sous'] }, { requete: 'chaussures running femme' }),
  2686: T('Hommes > Chaussures > Chaussures de sport > Chaussures de tennis', 'homme',
    { sous: 'Chaussures', univers: 'Homme', type: 'Baskets & Sneakers' }, { univers: 'Mode homme', categorie: 'Chaussures', demande: ['sous'] }, { requete: 'chaussures tennis homme' }),
  2672: T('Hommes > Chaussures > Chaussures de sport > Chaussures de basket', 'homme',
    { sous: 'Chaussures', univers: 'Homme', type: 'Baskets & Sneakers' }, { univers: 'Mode homme', categorie: 'Chaussures', demande: ['sous'] }, { requete: 'chaussures basketball homme' }),
  2618: T('Femmes > Chaussures > Bottes > Bottines', 'femme',
    { sous: 'Chaussures', univers: 'Femme', type: 'Bottines & lowboots' }, { univers: 'Mode femme', categorie: 'Chaussures', demande: ['sous'] }, { requete: 'bottines femme' }),
  1238: T('Hommes > Chaussures > Chaussures habillées', 'homme',
    { sous: 'Chaussures', univers: 'Homme', demande: ['type'] }, { univers: 'Mode homme', categorie: 'Chaussures', demande: ['sous'] }, { requete: 'chaussures habillées homme' }),
  2656: T('Hommes > Chaussures > Mocassins et chaussures bateau', 'homme',
    { sous: 'Chaussures', univers: 'Homme', type: 'Mocassins' }, { univers: 'Mode homme', categorie: 'Chaussures', sous: 'Mocassins', posee: true }, { requete: 'mocassins homme' }),
  2954: T('Femmes > Chaussures > Mocassins et chaussures bateau', 'femme',
    { sous: 'Chaussures', univers: 'Femme', type: 'Mocassins' }, { univers: 'Mode femme', categorie: 'Chaussures', sous: 'Mocassins', posee: true }, { requete: 'mocassins femme' }),
  2664: T('Hommes > Chaussures > Bottes > Bottes de travail', 'homme',
    { sous: 'Chaussures', univers: 'Homme', demande: ['type'] }, { univers: 'Mode homme', categorie: 'Chaussures', demande: ['sous'] }, { requete: 'bottes de travail homme' }),
  2622: T('Femmes > Chaussures > Bottes > Bottes de travail', 'femme',
    { sous: 'Chaussures', univers: 'Femme', demande: ['type'] }, { univers: 'Mode femme', categorie: 'Chaussures', demande: ['sous'] }, { requete: 'bottes de travail femme' }),
  2719: T('Enfants > Vêtements pour filles > Chaussures > Baskets > Baskets à lacets', 'enfant',
    { sous: 'Chaussures enfants', type: 'Baskets & Sneakers' }, { univers: 'Mode fille', categorie: 'Chaussures', sous: 'Baskets', posee: false }, { requete: 'baskets fille' }),
  2752: T('Enfants > Vêtements pour garçons > Chaussures > Baskets > Baskets sans lacets', 'enfant',
    { sous: 'Chaussures enfants', type: 'Baskets & Sneakers' }, { demande: ['univers', 'categorie', 'sous'] }, { requete: 'baskets garçon' }),
  1662: T('Enfants > Vêtements pour garçons > Chemises et t-shirts > T-shirts', 'enfant',
    { sous: 'Vêtements enfants', type: 'Hauts / T-Shirts / Polos' }, { demande: ['univers', 'categorie', 'sous'] }, { requete: 't-shirt garçon' }),
  1697: T('Enfants > Vêtements pour garçons > Pantalons et shorts > Jeans slim', 'enfant',
    { sous: 'Vêtements enfants', type: 'Jeans' }, { demande: ['univers', 'categorie', 'sous'] }, { requete: 'jean garçon' }),
  156: T('Femmes > Sacs > Sacs à main', 'femme',
    { sous: 'Accessoires & Bagagerie', univers: 'Femme', type: 'Sac à main' }, { univers: 'Mode femme', categorie: 'Sacs', sous: 'Sacs à main', posee: true }, { requete: 'sac à main femme' }),
  2614: T('Femmes > Vêtements > Manteaux et vestes > Vestes > Doudounes', 'femme',
    { sous: 'Vêtements', univers: 'Femme', type: 'Manteaux & Vestes' }, { univers: 'Mode femme', categorie: 'Vêtements', demande: ['sous'] }, { requete: 'doudoune femme' }),
  1043: T('Femmes > Vêtements > Hauts et t-shirts > Blouses', 'femme',
    { sous: 'Vêtements', univers: 'Femme', demande: ['type'] }, { univers: 'Mode femme', categorie: 'Vêtements', sous: 'Tops', posee: false }, { requete: 'blouse femme' }),
  5426: T('Livres et médias > Livres > Manuels scolaires et ressources pédagogiques', '',
    { sous: 'Livres' }, { hors: true }, { requete: 'manuel scolaire' }),
  3317: T('Enfants > Jeux et jouets > Loisirs créatifs > Argile et pâte à modeler', 'enfant',
    { demande: ['sous'] }, { hors: true }, { requete: 'pâte à modeler' }),
});
export const CATEGORIES_VUES = Object.freeze(Object.keys(TABLE_VINTED));

// ── LES TRADUCTIONS CHAMP PAR CHAMP ─────────────────────────────────────────
// L'état Vinted → Leboncoin (les cinq de Vinted ont leur mot exact).
export const ETAT_VERS_LBC = Object.freeze({ 'Neuf avec étiquette': 'Neuf avec étiquette', 'Neuf sans étiquette': 'Neuf sans étiquette', 'Très bon état': 'Très bon état', 'Bon état': 'Bon état', 'Satisfaisant': 'État satisfaisant' });
// eBay : l'identifiant d'état (1000 neuf avec étiquettes, 1500 neuf sans, 3000 occasion).
export const ETAT_VERS_EBAY = Object.freeze({ 'Neuf avec étiquette': '1000', 'Neuf sans étiquette': '1500', 'Très bon état': '3000', 'Bon état': '3000', 'Satisfaisant': '3000' });
// La couleur Vinted → Leboncoin (groupes du site). Absente ⇒ demandée.
export const COULEUR_VERS_LBC = Object.freeze({
  'Noir': 'Noir', 'Blanc': 'Blanc', 'Gris': 'Gris / Anthracite', 'Beige': 'Beige / Camel', 'Camel': 'Beige / Camel', 'Bleu': 'Bleu / Ciel', 'Bleu clair': 'Bleu / Ciel',
  'Marine': 'Marine / Turquoise', 'Turquoise': 'Marine / Turquoise', 'Rouge': 'Rouge / Bordeaux', 'Bordeaux': 'Rouge / Bordeaux', 'Rose': 'Rose / Fuchsia', 'Fuchsia': 'Rose / Fuchsia',
  'Violet': 'Violet / Mauve', 'Mauve': 'Violet / Mauve', 'Lila': 'Lavande / Lilas', 'Lilas': 'Lavande / Lilas', 'Lavande': 'Lavande / Lilas', 'Vert': 'Vert', 'Vert foncé': 'Vert', 'Kaki': 'Kaki',
  'Jaune': 'Jaune / Moutarde', 'Moutarde': 'Jaune / Moutarde', 'Orange': 'Orange / Corail', 'Corail': 'Orange / Corail', 'Marron': 'Marron', 'Crème': 'Crème / Blanc cassé / Écru',
  'Argenté': 'Argenté / Acier', 'Doré': 'Doré / Bronze / Cuivre', 'Multicolore': 'Multicolore',
});
const chercheExact = (liste, v) => { const n = norm(v); return n ? (liste || []).find((x) => norm(x) === n) || null : null; };
export function etatLbc(etatVinted) { return ETAT_VERS_LBC[str(etatVinted)] || chercheExact(LBC_VALEURS.clothing_condition_a, etatVinted); }
export function etatEbayId(etatVinted) { return ETAT_VERS_EBAY[str(etatVinted)] || null; }
// La couleur principale (Vinted peut en donner deux : « Noir, Blanc »).
export function couleurLbc(couleurVinted) {
  const c = str(couleurVinted).split(/[,/]/)[0].trim();
  if (!c) return null;
  const k = Object.keys(COULEUR_VERS_LBC).find((x) => norm(x) === norm(c));
  return k ? COULEUR_VERS_LBC[k] : chercheExact(LBC_VALEURS.clothing_color_a, c);
}
// La taille. Chaussures : la pointure EU (« 42.5 » ⇒ « 42,5 », ≥ 50 ⇒ « 50 et plus »).
// Vêtements : la grille de l'univers — femme « L / 40 / 12 » ⇒ « 40 - L », homme « M »,
// enfant « 6 ans / 116 cm » (le même libellé), « Taille unique ». Hors grille ⇒ null.
export function tailleLbc(tailleVinted, { grille = '', univers = '' } = {}) {
  const t = str(tailleVinted).replace(/\s+/g, ' ');
  if (!t) return null;
  if (grille === 'shoe_size') {
    const m = /^(\d{2})(?:[.,](5))?$/.exec(t);
    if (!m) return null;
    if (Number(m[1]) >= 50) return '50 et plus';
    return chercheExact(LBC_VALEURS.shoe_size, m[2] ? `${m[1]},5` : m[1]);
  }
  const g = grille === 'clothing_st' ? (univers === 'Femme' ? 'clothing_st_2' : univers === 'Homme' ? 'clothing_st_3' : univers === 'Enfant' ? 'clothing_st_4' : '') : grille;
  if (!g || !LBC_VALEURS[g]) return null;
  if (/^taille unique$/i.test(t)) return chercheExact(LBC_VALEURS[g], 'Taille unique');
  if (g === 'clothing_st_2') { const m = /^([A-Z0-9]+)\s*\/\s*(\d{2})(?:\s*\/\s*\d+)?$/i.exec(t); return m ? chercheExact(LBC_VALEURS[g], `${m[2]} - ${m[1].toUpperCase()}`) : null; }
  return chercheExact(LBC_VALEURS[g], t);
}
// La marque : le libellé EXACT de la liste du site (casse et accents ignorés).
export function marqueLbc(marque, grille) { return grille && LBC_VALEURS[grille] ? chercheExact(LBC_VALEURS[grille], marque) : null; }

// ── LA MÉMOIRE : SES RÉPONSES, PAR CATÉGORIE VINTED ────────────────────────
// `vrm_correspondances` (SYNC_KEYS) : { v: 1, cat: { [catalogId]: { leboncoin:
//   { sous, univers, type }, vestiaire: { univers, categorie, sous }, ebay: { id, nom,
//   chemin } } }, marque: { leboncoin: { [marque Vinted]: libellé } } }.
// Écrite seulement sur SON clic ; une valeur hors de la liste du site n'y entre jamais.
export const CLE_CORRESPONDANCES = 'vrm_correspondances';
const CHOIX_VC = () => ({ univers: Object.keys(VC_CATALOGUE), categorie: [...new Set(Object.values(VC_CATALOGUE).flatMap((x) => Object.keys(x)))], sous: [...new Set(Object.values(VC_CATALOGUE).flatMap((x) => Object.values(x).flat()))] });
// Les valeurs permises d'un champ (celles du site), pour une demande ou la mémoire.
export function choixDe(site, champ, contexte = {}) {
  if (site === 'leboncoin') {
    if (champ === 'sous') return lbcSousCategories().map((x) => x.cle);
    const c = LBC_CRITERES_DE[contexte.sous || ''];
    if (!c) return [];
    if (champ === 'univers') return c.univers ? LBC_VALEURS[c.univers].slice() : [];
    if (champ === 'type') return c.type ? LBC_VALEURS[c.type].slice() : [];
    if (champ === 'marque') return c.marque ? LBC_VALEURS[c.marque].slice() : [];
    if (champ === 'couleur') return c.couleur ? LBC_VALEURS[c.couleur].slice() : [];
    if (champ === 'etat') return c.etat ? LBC_VALEURS[c.etat].slice() : [];
    if (champ === 'taille') {
      const g = c.taille === 'clothing_st' ? (contexte.univers === 'Femme' ? 'clothing_st_2' : contexte.univers === 'Homme' ? 'clothing_st_3' : contexte.univers === 'Enfant' ? 'clothing_st_4' : '') : c.taille;
      return g && LBC_VALEURS[g] ? LBC_VALEURS[g].slice() : [];
    }
    return [];
  }
  if (site === 'vestiaire') {
    if (champ === 'univers') return Object.keys(VC_CATALOGUE);
    if (champ === 'categorie') return contexte.univers && VC_CATALOGUE[contexte.univers] ? Object.keys(VC_CATALOGUE[contexte.univers]) : CHOIX_VC().categorie;
    if (champ === 'sous') { const u = VC_CATALOGUE[contexte.univers || '']; return u && u[contexte.categorie || ''] ? u[contexte.categorie].slice() : CHOIX_VC().sous; }
    return [];
  }
  return [];
}
export function lireMemoire(brut) {
  const b = brut && typeof brut === 'object' ? brut : {};
  const out = { v: 1, cat: {}, marque: { leboncoin: {} } };
  const cat = b.cat && typeof b.cat === 'object' ? b.cat : {};
  for (const [id, x] of Object.entries(cat)) {
    if (!/^\d{1,7}$/.test(id) || !x || typeof x !== 'object') continue;
    const e = {};
    const t = TABLE_VINTED[id] || null;
    if (x.leboncoin && typeof x.leboncoin === 'object') {
      const l = {}; const sous = chercheExact(choixDe('leboncoin', 'sous'), x.leboncoin.sous);
      if (sous) l.sous = sous;
      const ctxSous = sous || (t && t.lbc.sous) || '';
      for (const k of ['univers', 'type']) { const v = chercheExact(choixDe('leboncoin', k, { sous: ctxSous }), x.leboncoin[k]); if (v) l[k] = v; }
      if (Object.keys(l).length) e.leboncoin = l;
    }
    if (x.vestiaire && typeof x.vestiaire === 'object') {
      const v = {}; const u = chercheExact(choixDe('vestiaire', 'univers'), x.vestiaire.univers); if (u) v.univers = u;
      const ctx = { univers: u || (t && t.vc.univers) || '' };
      const c = chercheExact(choixDe('vestiaire', 'categorie', ctx), x.vestiaire.categorie); if (c) v.categorie = c;
      ctx.categorie = c || (t && t.vc.categorie) || '';
      const s = chercheExact(choixDe('vestiaire', 'sous', ctx), x.vestiaire.sous); if (s) v.sous = s;
      if (Object.keys(v).length) e.vestiaire = v;
    }
    if (x.ebay && typeof x.ebay === 'object' && /^\d{1,9}$/.test(str(x.ebay.id))) e.ebay = { id: str(x.ebay.id), nom: str(x.ebay.nom).slice(0, 80), chemin: str(x.ebay.chemin).slice(0, 200) };
    if (Object.keys(e).length) out.cat[id] = e;
  }
  const ml = b.marque && b.marque.leboncoin && typeof b.marque.leboncoin === 'object' ? b.marque.leboncoin : {};
  for (const [m, v] of Object.entries(ml)) { const ok = chercheExact(LBC_VALEURS.shoe_brand_a, v); if (str(m) && ok) out.marque.leboncoin[str(m).slice(0, 40)] = ok; }
  return out;
}
// Retenir SA réponse (rend une NOUVELLE mémoire ; une valeur hors liste ⇒ inchangée).
//   ebay : valeur = { id, nom, chemin } (une catégorie que l'API eBay lui a proposée).
export function retenir(memoire, catalogId, site, champ, valeur) {
  const m = lireMemoire(memoire);
  const id = str(catalogId);
  if (site === 'leboncoin' && champ === 'marque') {
    const ok = chercheExact(LBC_VALEURS.shoe_brand_a, valeur && valeur.libelle);
    if (!ok || !str(valeur && valeur.vinted)) return m;
    return lireMemoire({ ...m, marque: { leboncoin: { ...m.marque.leboncoin, [str(valeur.vinted)]: ok } } });
  }
  if (!/^\d{1,7}$/.test(id)) return m;
  const e = { ...(m.cat[id] || {}) };
  if (site === 'ebay') { if (valeur && /^\d{1,9}$/.test(str(valeur.id))) e.ebay = { id: str(valeur.id), nom: str(valeur.nom), chemin: str(valeur.chemin) }; else return m; }
  else {
    const cur = { ...(e[site] || {}) };
    const ctx = site === 'leboncoin' ? { sous: champ === 'sous' ? '' : cur.sous || (TABLE_VINTED[id] && TABLE_VINTED[id].lbc.sous) || '' } : { univers: cur.univers || (TABLE_VINTED[id] && TABLE_VINTED[id].vc.univers) || '', categorie: cur.categorie || (TABLE_VINTED[id] && TABLE_VINTED[id].vc.categorie) || '' };
    const ok = chercheExact(choixDe(site, champ, ctx), valeur);
    if (!ok) return m;
    cur[champ] = ok;
    if (site === 'leboncoin' && champ === 'sous') { delete cur.univers; delete cur.type; }
    e[site] = cur;
  }
  return lireMemoire({ ...m, cat: { ...m.cat, [id]: e } });
}

// ── LA FICHE D'UN SITE, PRÊTE ───────────────────────────────────────────────
// paire : { catalogId, taille, etat, couleur, marque } (les FAITS de l'annonce Vinted).
// Rend { site, catalogId, chemin, connue, valeurs: { champ: valeur }, origine:
//   { champ: 'table'|'memoire'|'traduit' }, demandes: [{ champ, choix, bloque }], hors, raison }.
//   · `connue` : la catégorie Vinted est dans la table OU il a déjà répondu pour elle ;
//   · rien de lu (catalogId absent) ⇒ tout ce qui dépend de la catégorie est demandé,
//     la réponse vaut pour CETTE annonce seulement (rien à retenir sans catégorie).
// reponses : { champ: valeur } tapées dans la feuille pour CETTE annonce sur CE site —
//   elles passent avant tout (une valeur hors de la liste du site est ignorée).
//   Ordre d'une valeur : sa réponse > sa mémoire > la table > la traduction des faits.
export function ficheSite(site, paire, memoire, reponses) {
  const p = paire || {};
  const rep = reponses && typeof reponses === 'object' ? reponses : {};
  const id = p.catalogId == null || p.catalogId === '' ? '' : str(p.catalogId);
  const t = id ? TABLE_VINTED[id] || null : null;
  const mem = lireMemoire(memoire);
  const mc = (id && mem.cat[id]) || {};
  const out = { site, catalogId: id || null, chemin: t ? t.chemin : '', connue: !!(t || mc[site]), valeurs: {}, origine: {}, demandes: [], hors: false, raison: id ? '' : 'categorie-pas-lue' };
  const demander = (champ, choix, bloque) => { if (!out.demandes.some((d) => d.champ === champ)) out.demandes.push({ champ, choix: choix || [], bloque: !!bloque }); };
  // Une valeur : la réponse (dans la liste), sinon les candidats dans l'ordre ; rien ⇒ demandée.
  const choisir = (champ, choix, candidats, bloque) => {
    const r = choix.length ? chercheExact(choix, rep[champ]) : null;
    if (r) { out.valeurs[champ] = r; out.origine[champ] = 'reponse'; return r; }
    for (const [v, o] of candidats) {
      const ok = v != null && v !== '' ? (choix.length ? chercheExact(choix, v) : v) : null;
      if (ok) { out.valeurs[champ] = ok; out.origine[champ] = o; return ok; }
    }
    demander(champ, choix, bloque);
    return null;
  };
  if (site === 'leboncoin') {
    const tl = (t && t.lbc) || {};
    const ml = mc.leboncoin || {};
    const sous = choisir('sous', choixDe('leboncoin', 'sous'), [[ml.sous, 'memoire'], [tl.sous, 'table']], true);
    if (!sous) return out;
    const r0 = lbcSousCategories().find((x) => x.cle === sous) || null;
    if (r0) { out.valeurs.rubrique = r0.rubrique; out.valeurs.sousNom = r0.sous; out.ambigu = r0.ambigu; }
    const c = LBC_CRITERES_DE[r0 ? r0.sous : sous] || null;
    out.vu = c ? c.vu : '';
    // La table ne vaut que pour SA catégorie (une autre choisie ⇒ ses critères se demandent).
    const tableOk = sous === tl.sous;
    const memOk = !ml.sous || ml.sous === sous;
    for (const k of ['univers', 'type']) {
      if (!c || !c[k]) continue;
      choisir(k, choixDe('leboncoin', k, { sous: r0 ? r0.sous : sous }), [[memOk ? ml[k] : null, 'memoire'], [tableOk ? tl[k] : null, 'table']], true);
    }
    const ctx = { sous: r0 ? r0.sous : sous, univers: out.valeurs.univers || (c && c.taille === 'clothing_st_4' ? 'Enfant' : '') };
    if (c && c.taille) choisir('taille', choixDe('leboncoin', 'taille', ctx), [[tailleLbc(p.taille, { grille: c.taille, univers: ctx.univers }), 'traduit']], true);
    if (c && c.etat) choisir('etat', choixDe('leboncoin', 'etat', ctx), [[etatLbc(p.etat), 'traduit']], true);
    if (c && c.couleur && str(p.couleur)) choisir('couleur', choixDe('leboncoin', 'couleur', ctx), [[couleurLbc(p.couleur), 'traduit']], false);
    if (c && c.marque && str(p.marque)) choisir('marque', choixDe('leboncoin', 'marque', ctx), [[mem.marque.leboncoin[str(p.marque)], 'memoire'], [marqueLbc(p.marque, c.marque), 'traduit']], false);
    return out;
  }
  if (site === 'vestiaire') {
    const tv = (t && t.vc) || {};
    if (tv.hors) { out.hors = true; return out; }
    const mv = mc.vestiaire || {};
    for (const k of ['univers', 'categorie', 'sous']) {
      choisir(k, choixDe('vestiaire', k, { univers: out.valeurs.univers, categorie: out.valeurs.categorie }), [[mv[k], 'memoire'], [tv[k], 'table']], false);
    }
    // L'extension d'aujourd'hui retrouve-t-elle CE choix seule ? (table `posee` ; une
    // réponse ou une mémoire n'est jamais portée par la voie : « à finir sur Vestiaire »).
    out.posee = !!(tv.posee && !Object.values(out.origine).some((o) => o === 'reponse' || o === 'memoire'));
    return out;
  }
  if (site === 'ebay') {
    out.requete = (t && t.ebay.requete) || '';
    const r = rep.categorie && /^\d{1,9}$/.test(str(rep.categorie.id)) ? { id: str(rep.categorie.id), nom: str(rep.categorie.nom), chemin: str(rep.categorie.chemin) } : null;
    if (r) { out.valeurs.categorie = r; out.origine.categorie = 'reponse'; }
    else if (mc.ebay && rep.categorie !== null) { out.valeurs.categorie = mc.ebay; out.origine.categorie = 'memoire'; }   // null : « Changer » ⇒ redemandée
    else demander('categorie', [], false);
    const e = etatEbayId(p.etat); if (e) { out.valeurs.etat = e; out.origine.etat = 'traduit'; }
    if (/^\d{2}(?:[.,]5)?$/.test(str(p.taille))) { out.valeurs.pointureEU = str(p.taille).replace('.', ','); out.origine.pointureEU = 'traduit'; }
    return out;
  }
  return out;
}
// Les trois fiches d'une annonce d'un coup.
export const fichesSites = (paire, memoire, reponses = {}) => ({ leboncoin: ficheSite('leboncoin', paire, memoire, reponses.leboncoin), vestiaire: ficheSite('vestiaire', paire, memoire, reponses.vestiaire), ebay: ficheSite('ebay', paire, memoire, reponses.ebay) });
// La catégorie et les critères que la fiche Leboncoin porte à l'extension
// (capacité `lbccriteres`). Rien d'incertain : seulement les valeurs posées.
export function criteresPourLbc(fiche) {
  const v = (fiche && fiche.valeurs) || {};
  const crit = {};
  for (const k of ['univers', 'type', 'taille', 'etat', 'couleur', 'marque']) if (str(v[k])) crit[k] = str(v[k]);
  // Un nom porté par deux rubriques n'est pas envoyé (l'extension clique un libellé EXACT) : à choisir sur le site.
  return { categorie: fiche && fiche.ambigu ? '' : str(v.sousNom || v.sous) || '', criteres: crit };
}
// En clair : « Mode › Chaussures · Homme · Baskets & Sneakers ».
export function texteFiche(fiche) {
  const v = (fiche && fiche.valeurs) || {};
  if (!fiche) return '';
  if (fiche.site === 'leboncoin') return [v.rubrique && v.sousNom ? `${v.rubrique} › ${v.sousNom}` : v.sous, v.univers, v.type].filter(Boolean).join(' · ');
  if (fiche.site === 'vestiaire') return [v.univers, v.categorie, v.sous].filter(Boolean).join(' › ');
  if (fiche.site === 'ebay') return v.categorie ? (v.categorie.chemin || v.categorie.nom || '') : '';
  return '';
}
// La couverture de la table (pour l'audit et le récit).
export function couverture() {
  const n = { leboncoin: { sure: 0, demande: 0 }, vestiaire: { sure: 0, demande: 0, hors: 0 }, ebay: { sure: 0, demande: 0 } };
  for (const id of CATEGORIES_VUES) {
    const t = TABLE_VINTED[id];
    const l = ficheSite('leboncoin', { catalogId: id, taille: '', etat: 'Très bon état' }, null);
    if (l.demandes.some((d) => ['sous', 'univers', 'type'].includes(d.champ))) n.leboncoin.demande++; else n.leboncoin.sure++;
    if (t.vc.hors) n.vestiaire.hors++; else if (t.vc.demande) n.vestiaire.demande++; else n.vestiaire.sure++;
    n.ebay.demande++;
  }
  return n;
}
