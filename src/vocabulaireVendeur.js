// ── LES MOTS ET LES EXEMPLES DU VENDEUR (11 nov., lot DJ2) ──────────────────────
// Julien, 11 nov. : « tout le monde ne vend pas des sneakers » ; « pour les suggestions
// sur les notes pour les annonces, je veux que tu arrêtes de faire allusion à des
// chaussures, il y a des personnes qui vendent des lunettes ».
//
// UNE source pour les EXEMPLES (placeholders, annonce d'exemple, note d'un article) et
// les petits mots qui supposaient des chaussures (« pointure », « boîte à chaussures »).
// Ce qu'il vend se lit dans `vrm_je_vends` (src/profilVendeur.js, son propriétaire) :
//   · `vend` = 'sneakers' | 'autre' (le mot « paire » / « article » : `motsArticle`) ;
//   · `categories` = les tuiles cochées dans « Tu vends quoi ? ».
// Règle des exemples : UNE catégorie cochée ⇒ ses exemples ; Sneakers (seules, ou rien
// coché chez le propriétaire, dont le défaut est « sneakers ») ⇒ les exemples d'avant,
// mot pour mot (Julien inchangé) ; plusieurs catégories ou rien ⇒ des exemples NEUTRES.
// Jamais un exemple de chaussure chez un vendeur qui n'a pas dit « Sneakers ».
//
// JS pur, sans lecture : `scripts/audit-vendeur-generaliste.cjs` l'exécute.

const SNEAKERS = Object.freeze({
  note: 'ex : petite tache semelle gauche',
  annonce: Object.freeze({ titre: 'Nike Air Max 90 blanches taille 42', description: 'Portées quelques fois, très bon état.\nSemelle propre, boîte d’origine.\nEnvoi rapide et soigné.', prix: '45,00 €' }),
  essaiNumero: 'Très bon état, pointure 42.\nN° 125',
  modele: 'Modèle (ex : Nike Air Max 90, gel-lyte…)',
  achat: 'ex : Nike Air Max 90',
  taille: 'Pointure',
  emballage: 'Boîte à chaussures',
});
const NEUTRE = Object.freeze({
  note: 'ex : petite rayure sur le côté',
  annonce: Object.freeze({ titre: 'Lampe de bureau vintage en laiton', description: 'Très bon état, peu servie.\nAucun défaut visible.\nEnvoi rapide et soigné.', prix: '45,00 €' }),
  essaiNumero: 'Très bon état, peu servi.\nN° 125',
  modele: 'Modèle ou titre (ex : lampe vintage, veste en jean…)',
  achat: 'ex : lampe vintage en laiton',
  taille: 'Taille',
  emballage: 'Carton moyen',
});
// Par catégorie : seulement ce qui CHANGE du neutre (le reste en hérite).
const PAR_CATEGORIE = {
  sneakers: SNEAKERS,
  vetements: { note: 'ex : petit accroc manche gauche', annonce: { titre: 'Veste en jean Levi’s taille M', description: 'Portée quelques fois, très bon état.\nAucune tache, aucun trou.\nEnvoi rapide et soigné.' }, essaiNumero: 'Très bon état, taille M.\nN° 125', modele: 'Modèle (ex : veste en jean Levi’s…)', achat: 'ex : veste en jean Levi’s', emballage: 'Pochette souple' },
  luxe: { note: 'ex : facture et dust bag fournis', annonce: { titre: 'Foulard Hermès en soie', description: 'Très bon état, couleurs vives.\nBoîte et facture fournies.\nEnvoi rapide et soigné.' }, essaiNumero: 'Très bon état, boîte fournie.\nN° 125', achat: 'ex : foulard Hermès en soie' },
  sacs: { note: 'ex : coin un peu usé', annonce: { titre: 'Sac Longchamp Le Pliage noir', description: 'Très bon état, coins propres.\nAnses et fermeture intactes.\nEnvoi rapide et soigné.' }, essaiNumero: 'Très bon état, coins propres.\nN° 125', achat: 'ex : sac Longchamp Le Pliage' },
  montres: { note: 'ex : petite rayure sur le verre', annonce: { titre: 'Montre Casio vintage dorée', description: 'Fonctionne parfaitement, pile neuve.\nBracelet d’origine, boîte fournie.\nEnvoi rapide et soigné.' }, essaiNumero: 'Fonctionne, pile neuve.\nN° 125', achat: 'ex : montre Casio vintage', emballage: 'Petite boîte' },
  lunettes: { note: 'ex : petite rayure verre gauche', annonce: { titre: 'Ray-Ban Wayfarer noires', description: 'Très bon état, verres sans rayure.\nÉtui et chiffon d’origine.\nEnvoi rapide et soigné.' }, essaiNumero: 'Verres sans rayure, étui d’origine.\nN° 125', modele: 'Modèle (ex : Ray-Ban Wayfarer…)', achat: 'ex : Ray-Ban Wayfarer', emballage: 'Petite boîte' },
  accessoires: { note: 'ex : boucle légèrement rayée', annonce: { titre: 'Ceinture en cuir noir', description: 'Très bon état, cuir souple.\nBoucle d’origine.\nEnvoi rapide et soigné.' }, achat: 'ex : ceinture en cuir' },
  vintage: { note: 'ex : légère patine, d’époque', annonce: { titre: 'Blouson en cuir vintage années 80', description: 'Bon état d’époque, légère patine.\nDoublure intacte.\nEnvoi rapide et soigné.' }, achat: 'ex : blouson en cuir vintage' },
  enfants: { note: 'ex : petite tache, part au lavage', annonce: { titre: 'Lot de 5 bodies bébé 6 mois', description: 'Très bon état, lavés.\nAucune tache.\nEnvoi rapide et soigné.' }, achat: 'ex : lot de bodies 6 mois', emballage: 'Pochette souple' },
  livres: { note: 'ex : coin corné, pas annoté', annonce: { titre: 'Harry Potter à l’école des sorciers, Folio', description: 'Bon état, aucune annotation.\nCouverture légèrement usée.\nEnvoi rapide et soigné.' }, essaiNumero: 'Bon état, aucune annotation.\nN° 125', achat: 'ex : lot de romans Folio', emballage: 'Enveloppe matelassée' },
  jeux: { note: 'ex : boîte et notice, testé', annonce: { titre: 'Mario Kart 8 Deluxe — Switch', description: 'Testé, fonctionne parfaitement.\nBoîte et notice d’origine.\nEnvoi rapide et soigné.' }, essaiNumero: 'Testé, boîte et notice.\nN° 125', modele: 'Jeu ou console (ex : Mario Kart 8…)', achat: 'ex : Mario Kart 8 Switch', emballage: 'Enveloppe matelassée' },
  hightech: { note: 'ex : écran sans rayure', annonce: { titre: 'iPhone 12 128 Go bleu', description: 'Écran sans rayure, batterie 89 %.\nChargeur fourni.\nEnvoi rapide et soigné.' }, essaiNumero: 'Écran sans rayure, chargeur fourni.\nN° 125', achat: 'ex : iPhone 12 128 Go', emballage: 'Petite boîte' },
  cartes: { note: 'ex : sous sleeve, coins parfaits', annonce: { titre: 'Carte Pokémon Dracaufeu holo', description: 'Sortie de booster, sous sleeve.\nCoins parfaits.\nEnvoi rapide et soigné.' }, essaiNumero: 'Sous sleeve, coins parfaits.\nN° 125', achat: 'ex : carte Pokémon holo', emballage: 'Enveloppe rigide' },
  jouets: { note: 'ex : complet, boîte abîmée', annonce: { titre: 'Lego Star Wars 75192 complet', description: 'Complet, notice fournie.\nBoîte un peu abîmée.\nEnvoi rapide et soigné.' }, essaiNumero: 'Complet, notice fournie.\nN° 125', achat: 'ex : Lego Star Wars complet' },
  maison: { note: 'ex : petit éclat au pied', annonce: { titre: 'Lampe de bureau vintage en laiton', description: 'Très bon état, fonctionne.\nPetit éclat au pied.\nEnvoi rapide et soigné.' }, achat: 'ex : lampe vintage en laiton' },
  sport: { note: 'ex : servi une saison', annonce: { titre: 'Raquette de tennis Babolat Pure Drive', description: 'Utilisée une saison, aucun choc.\nGrip neuf.\nEnvoi rapide et soigné.' }, achat: 'ex : raquette Babolat' },
  beaute: { note: 'ex : neuf sous blister', annonce: { titre: 'Palette Urban Decay Naked neuve', description: 'Neuve sous blister.\nJamais ouverte.\nEnvoi rapide et soigné.' }, essaiNumero: 'Neuve sous blister.\nN° 125', achat: 'ex : palette Urban Decay', emballage: 'Petite boîte' },
  musique: { note: 'ex : pochette un peu usée', annonce: { titre: 'Vinyle Daft Punk — Discovery', description: 'Disque sans rayure.\nPochette légèrement usée.\nEnvoi rapide et soigné.' }, essaiNumero: 'Disque sans rayure.\nN° 125', achat: 'ex : vinyle Daft Punk', emballage: 'Carton à vinyle' },
};
const fusion = (p) => Object.freeze({ ...NEUTRE, ...p, annonce: Object.freeze({ ...NEUTRE.annonce, ...(p.annonce || {}) }) });
const EXEMPLES = Object.fromEntries(Object.entries(PAR_CATEGORIE).map(([k, p]) => [k, k === 'sneakers' ? SNEAKERS : fusion(p)]));
export const CATEGORIES_AVEC_EXEMPLES = Object.keys(EXEMPLES);

// La catégorie dont on montre les exemples (ou null ⇒ neutre).
export function categorieExemples({ vend, categories } = {}) {
  const cats = Array.isArray(categories) ? categories.filter((c) => typeof c === 'string') : [];
  if (cats.length === 1) return EXEMPLES[cats[0]] ? cats[0] : null;
  if (cats.length > 1) return null;
  return vend === 'sneakers' ? 'sneakers' : null;
}
// Les exemples à montrer. `vend` : 'sneakers' | 'autre' ; `categories` : la liste cochée (ou null).
export function exemplesVendeur(profil = {}) {
  const c = categorieExemples(profil);
  return c ? EXEMPLES[c] : NEUTRE;
}
export const EXEMPLES_NEUTRES = NEUTRE;
export const EXEMPLES_SNEAKERS = SNEAKERS;

// « Pointure » pour un vendeur de sneakers, « Taille » sinon.
export const motTaille = (vend) => (vend === 'sneakers' ? 'Pointure' : 'Taille');

// ── LE NUMÉRO DE RANGEMENT N'EST PAS « LE CARTON » ───────────────────────────────
// (9 nov., puis 11 nov.) Julien : « ça peut très bien être sur des étagères et pas dans
// des cartons ». Les phrases qui disent où le N° s'écrit passent par ici.
export const OU_RANGE = 'là où l’article est rangé';
export const RANGEMENTS = 'carton, étagère, bac…';

// Les mots de chaussure, pour l'audit et les bancs (un vendeur hors Sneakers n'en voit aucun).
export const MOTS_CHAUSSURE = /\b(chaussures?|baskets?|sneakers?|pointures?|semelles?|lacets?|paires?)\b/i;
