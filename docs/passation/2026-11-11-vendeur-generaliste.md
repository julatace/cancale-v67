# Lot DJ2 — « Pas que des sneakers » (11 nov. 2026, branche `claude/vendeur-generaliste`)

## La demande de Julien
Première question de la configuration : « Sneakers ou autre chose ? » avec plein de
propositions ; plus d'allusion aux chaussures (suggestions de notes…) ; le N° « dit dans
quel carton est l'article » est FAUX (étagère, bac, tiroir…) ⇒ « où est l'article » ;
l'étape « Simple ou complet ? » n'est pas claire.

## Ce qui est fait
1. **« Tu vends quoi ? »** (1re étape de « Ma configuration ») : 18 tuiles à cocher
   (Sneakers, Vêtements, Luxe, Sacs, Montres, **Lunettes**, Accessoires, Vintage, Enfants,
   Livres, Jeux vidéo, High-tech, Cartes, Jouets, Maison, Sport, Beauté, Musique, Autre
   chose + champ libre). Un compte déjà installé (Julien compris) la voit UNE fois, seule,
   rien de pré-coché ; « Plus tard » ne range que `vu` dans `vrm_je_vends`. Tant qu'il
   n'a pas choisi, le propriétaire garde « paire ».
2. **Les exemples suivent ce qu'il vend** (`src/vocabulaireVendeur.js`, une source) :
   note d'un article, annonce d'exemple, essai du N°, modèle, achat, emballage, taille.
   Sneakers seules (ou rien choisi chez le propriétaire) = les textes d'avant mot pour mot.
3. **Reprise (cette session)** — ce qui parlait encore de baskets chez un vendeur hors
   Sneakers, corrigé : recherche eBay (titre « des articles », plus de champ « Pointure »,
   exemple selon ce qu'il vend) ; titre d'annonce eBay ; désignation de facture (Compta)
   et facture d'exemple de « Ma facture » ; erreur « Donne un nom à cet achat » ;
   vérificateur d'achat ; ajout manuel au Stock et recherche vocale ; aperçu du mode
   stream ; **dessins** : la basket des états vides (« Rien à faire »…) devient une
   étiquette, « Comment marche le Stock » montre une étiquette, « Article », « Vendu ».
4. **Le N° ne dit plus « carton »** comme rangement (« où est l'article », « là où
   l'article est rangé ») — le carton d'EMBALLAGE d'expédition reste (légitime).
   `audit-config-facture` T1 : vert sur la branche (« tes cartons » retiré
   d'EmballagesCarte et InventaireAnnuel).
5. **« Quel VRM te ressemble ? »** : deux grandes cartes (Simple / Complet), pour qui,
   3 puces à icône, aperçu, « Tu pourras changer dans Paramètres → Affichage ».

## Tranché (Julien : « tranche le reste toi-même »)
- « Pointure » eBay (veille d'achat) : masquée hors Sneakers (la règle attend 2 chiffres ;
  la taille s'écrit dans les mots), pas renommée.
- Gardés tels quels (pas affichés au vendeur hors Sneakers, ou démo publique) : listes de
  marques/modèles de lecture d'un titre, démo de l'Accueil (`accueil-demo.js`), données
  du mode « exemple » (`exempleDonnees.js`), le petit dessin abstrait du guide de démarrage.
- Le mot « paire » dans les écrans secondaires (Republier, Leboncoin, eBay…) n'est pas
  entièrement converti : hors demande (« allusion aux chaussures »), chantier à part.

## Preuves
- `npm run build` vert.
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, config-facture, vendeur-generaliste, ebay-recherche,
  mode-stream, factures-pro-2, facture-en-tva, double-vente, stream-photos.
  (`audit-photos-vinted` est rouge AUSSI sans mes changements — « src/App.jsx se lit » :
  préexistant, pas de ce lot.)
- `audit-vendeur-generaliste --prouve` : **20/20 mutations attrapées** ; rejoué sur le code
  d'avant la reprise (58b559ad, `git archive`) : **3 rouges** (S3 exemples de baskets, S4
  basket des états vides, S5 « Comment marche le Stock »).
- Banc `vendeur-generaliste` (390 et 1512 px, clair) : tout vert — 9 écrans sans mot de
  chaussure NI exemple/dessin de basket, explication du Stock avec étiquette (contrôle
  positif, pas vide). Captures regardées (Tu vends quoi ?, Quel VRM te ressemble ?, note
  « ex : petite rayure verre gauche », explication du Stock).

## Reste / geste de Julien
Rien à faire de son côté : au prochain chargement, la question « Tu vends quoi ? »
s'ouvre une fois ; « Sneakers » ⇒ rien ne change pour lui.
