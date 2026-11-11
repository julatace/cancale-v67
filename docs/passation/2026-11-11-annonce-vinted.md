# Créer une annonce Vinted depuis une fiche VRM (11 nov., lot `annonce-vinted`, extension 5.367.0)

Demande validée par Julien : les photos, le titre, la taille, l'état, la marque, la couleur, la catégorie,
le prix et le N° sont déjà dans VRM ⇒ sur SON clic « Créer sur Vinted », l'extension prépare un
BROUILLON sur vinted.fr ; tout champ que VRM ne sait pas faire correspondre au catalogue de Vinted est
DEMANDÉ avec les vraies valeurs de Vinted ; le N° est écrit selon le réglage ; l'annonce est reliée à la
fiche par l'identifiant rendu par Vinted ; c'est LUI qui clique « Publier ». En série aussi.

Branche `claude/annonce-vinted` (partie d'`origin/main` f04d4a580, `origin/claude/suivi-travail`
856e49dca fusionnée dedans). Version d'extension réservée dans `COORDINATION-AGENTS.md` : **5.367.0**.
Aucune PR, aucune fusion sur `main`.

## Ce qui est livré

### Extension — `creerVintedFiche` (background.js, commande `creerVintedFiche`)
- Briques de Republier, rien de neuf côté Vinted : `vintedPage` (onglet vinted.fr, cookies de la page,
  aucun `Authorization`), `vintedPagePhoto` (photos une par une), `POST item_upload/drafts` (la forme
  de Republier : `{ draft, feedback_id: null, parcel: null, upload_session_id }`), `rangerBrouillon`
  (`parVRM`, `ficheId`, `numero` ⇒ « Publier » depuis VRM le reconnaît), `pauseRepub` (pauses au hasard).
- Gardes, AVANT toute requête : confirmation, compte de l'onglet (`gardeStricte`), frein de
  republication, onglet vinted.fr présent, fiche déjà créée (verrou local 30 min ET base :
  `vinted_brouillon_*` avec `ficheId`, base muette ⇒ refus), N° déjà porté par une annonce (fiches +
  `panel_num_reserves.items`), même corps déjà refusé (`refusDejaVu`) ; puis UNE action réservée
  (`gardeStricte` réserve 5 ⇒ 45/h) et rendue si rien n'est parti.
- Le catalogue, jamais deviné (`valeurExacteFiche`) : catégorie (catalogue capté `vinted_catalogue`,
  catégories FINALES avec leur chemin ; repli : catégories de ses annonces), taille et état (grille de la
  catégorie, une LECTURE `item_upload/attributes`), couleur (`couleursConnues`), marque (marques de Vinted
  vues sur SES annonces, `vrm_vinted_modele`). Posé seulement si le texte de la fiche EST une valeur de
  Vinted (casse/accents mis à part ; « Baskets » seul, présent sous Hommes ET Femmes ⇒ demandé). Sinon
  `code: 'question'` avec les valeurs ; la réponse revient validée contre ces mêmes valeurs ;
  `'vinted'` = « je le choisirai sur Vinted » (champ vide, DIT dans `aFinir`). La taille du colis et
  les autres obligatoires inconnus restent vides et sont DITS (la page de Vinted les demande).
- Après le brouillon : le N° LIÉ à l'identifiant rendu (`panel_num_reserves.items[draftId]`, la voie du
  « N° à côté de Publier ») ; l'app le donne à l'annonce quand elle est lue (règle des réservations).
  Journal « Ce que VRM a fait » : sorte `brouillon`.
- Issues : `fait` · `incertain` (5xx/sans id ⇒ fiche bloquée 30 min, « peut-être dans tes brouillons ») ·
  `echec` (refus ⇒ frein 30 min, jamais renvoyé) · refus avant envoi.
- Jamais : mise en ligne, suppression, création directe (`item_upload/items`).

### App
- `src/annonceVinted.js` (règle pure) : `texteAnnonceVinted` (étiquette `vrm_num_vinted` via
  `poserEtiquette` ; « Je numérote moi-même » allumé avec « fin de la description » ⇒ « N°41 » en
  dernière ligne, relu par `lireNumeroEcrit` ; un AUTRE N° écrit ⇒ refus ; titre > 100 ⇒ refus),
  `manquesFiche`, `payloadFiche` (liste blanche), `etatFicheVinted` (par `vinted.draftId`, jamais un
  titre), `issueCreation` (pour `lancerTravail`), `filtrerOptions`.
- `src/CreerSurVinted.jsx` (+ `styles-creer-vinted.css`) : feuille (bas d'écran au téléphone, centrée
  sur ordinateur) — compte de l'onglet affiché (`vintedDeChrome`), photos de la fiche ou ajoutées
  (réduites dans la page, 1600 px JPEG), manques dits en ambre, premier clic ⇒ « Confirmer : N brouillons
  sur {compte} », second ⇒ `lancerTravail` (VRM figé, barre, journal) ; la question est montée APRÈS le
  gel (relevée au-dessus), recherche dans une longue liste.
- Annonces → « À publier » (`FichesNeuves`, App.jsx) : « Créer sur Vinted » par fiche, cases à cocher
  ⇒ « Créer sur Vinted · N » ; une fiche créée reste « Brouillon sur Vinted » avec « Publier »
  (`publierBrouillon` + `avecCouleurBrouillon`, confirmé, suivi) ; elle sort quand l'annonce de SON
  identifiant est lue en ligne (ou publiée depuis VRM). Le brouillon créé ne fait plus sortir la fiche
  de la liste (son identifiant est exclu des N° « portés »).
- `EXT_CAPACITES.creervinted = '5.367.0'` (`raisonExtGlobale` ⇒ la feuille dit pourquoi et rien ne part).
- 40 clés `creerVinted.*` en fr/en/es/it/de ; « Quoi de neuf » `creer-vinted`.

## Décisions prises seul (dans l'esprit de la demande)
- Les « fiches VRM » sont celles d'« À publier » (`vrm_fiches_neuves` : Dupliquer, N° neuf) : ce sont les
  seules fiches de VRM qui n'ont pas encore d'annonce Vinted. Elles n'ont pas de photos ⇒ ajoutées dans
  la feuille, gardées le temps de la création seulement (pas de stockage de photos lourd en base).
  Non fait : créer depuis une annonce Leboncoin / eBay / Vestiaire (photos sur d'autres hôtes).
- Taille du colis : aucune source sûre (les identifiants de Vinted n'ont jamais été mesurés avec leur
  nom) ⇒ laissée vide et dite ; Vinted la demande à la publication.
- Brouillon partiel : si Vinted refuse un brouillon incomplet, c'est un refus ordinaire (frein 30 min,
  raison dite) — pas mesuré chez lui.

## Preuves
- `node scripts/audit-annonce-vinted.cjs` : **42 ✅ · 0 ❌** (vrai background.js dans `_fond-vm.cjs`,
  faux vinted.fr) — séquence `PPB` (photos ×2, un brouillon), tout depuis la page, corps aux valeurs
  exactes, N° lié, 1 action, questions sans aucun geste, gardes sans requête, refus/flou/photo refusée.
- `--prouve` : sur `origin/main` la fonction n'existe pas (rouge) ; **5/5 mutations** de la règle de
  l'app rouges.
- Banc `scripts/bancs/annonce-vinted.cjs` (390 tactile / 1512, clair / sombre) : voir « État ».
- Audits communs : coherence, traduction (44), textes-courts, variables, tdz, icones, quoi-de-neuf,
  identite, secrets, fonctions-api — verts ; `audit-extension-zip` vert ; zips régénérés.

## État à la reprise
Voir la fin de ce fichier (mis à jour à la fin du lot).
