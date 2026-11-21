# 14 nov. — Photos et fiches (propositions 102 à 107, validées par Julien)

Branche `claude/photos-fiches` (partie de `origin/main`, puis `origin/claude/fiche-partout` fusionnée :
tout vit dans LA fiche de la paire). Julien : « fais tout, lance tout en même temps ».

## Ce qui existait (mesuré avant de coder)

| pièce | où | ce qu'elle fait |
|---|---|---|
| Studio photo | `src/StudioPhoto.jsx`, `src/studioPhoto.js` | cadre 3:4, détourage local U²-Netp ; photos rangées en data: URL dans `studio_photos_{N°}` (`{ photos: [{ id, at, img, cadre, detoure? }] }`, CAS sur `data.rev`) ; ouvert seulement par Annonces → Outils, sur une paire choisie dans une liste |
| Éditeur photo | `src/ecrans/PhotoEditor.jsx` | retouches d'une photo d'annonce ; aucune mesure de qualité |
| Note privée | `src/notePaire.js`, `src/NotePaire.jsx`, `NotePaireCoque` (App.jsx) | `vrm_notes_paires` (`n:<N°>` / `a:<annonce>`), 200 caractères, geste annulable ; **lue à un seul endroit** (`audit-note-achat-double` BD 6) |
| Dictée | `src/dicteeNavigateur.js` (`ecouter`, `fr-FR` en dur), `MicDictee` | la loupe et quelques champs ; aucune note dictée |
| Empreintes / « Retrouve un article par sa photo » | `src/empreintePhoto.js`, `src/indexPhotos.js`, `src/RecherchePhoto.jsx`, `src/photoEmpreinte.js` | histogramme couleur PONDÉRÉ (fond, centre), hachages ; index IndexedDB par adresse exacte ; octets Vinted lus par l'extension ou `/api/compte?mode=photo` (`chargerPhotoBoite`) — aucune couleur NOMMÉE, aucune recherche par mot |
| Pièces jointes | `achat_facture_*` (`src/factureAchat.js`), `colis_photo_*`, `depense_ticket_*` | une ligne `app_data` par pièce, scalaires projetés, contenu au toucher, « Retirer » vide la ligne ; plafond 4 Mo / ~2,2 Mo rangés |
| Lien de partage expirant | — | **aucun** (mesuré : rien dans `src/`, `api/`) |
| Même paire | `recreeDe` / `repriseDe`, `jumellesParPhoto`, `src/enLigneDeuxFois.js`, `doublonsAReattribuer` | identités par republication et photo exacte ; aucune fusion sur son clic |

## Ce qui est livré

- **102 · Photo floue ou trop sombre** (`src/qualitePhoto.js`, worker `src/qualitePhoto.worker.js`,
  client `src/qualitePhotoClient.js`, `src/AvisPhoto.jsx`) : variance du laplacien après étirement du
  contraste, case par case (85e centile d'une grille 6 × 6 : un fond uni ne fait pas passer une paire nette
  pour floue) ; « sombre » = moyenne basse ET aucune zone claire (une basket noire sur blanc n'est jamais
  sombre). Seuils PRUDENTS mesurés sur des images inventées : σ ≤ 1,2 jamais signalé, σ ≥ 3 toujours ;
  × 0,75 jamais « sombre », × 0,2 toujours. Calculé dans un worker (repli sur la page au repos). « Floue ? »
  / « Sombre ? » sur la vignette : studio (rangé AVEC la photo, `qualite`), « Créer sur Vinted », fiche.
  **Jamais bloquant** : la photo est rangée quel que soit le verdict.
- **103 · Séance photo** (`src/seancePhoto.js`, `src/SeancePhoto.jsx`, Annonces → Outils) : paires
  présentes (`vinted_nums_physiques`) sans photo dans VRM, avec moins de N (1–5, 3 par défaut), ou une
  photo signalée ; l'ordre des N° (lettres après) ; liste FIGÉE au départ ; coche par clé N° (son toucher,
  ou automatiquement quand le studio range une photo de CETTE paire) ; toucher la rangée ouvre le studio
  sur elle. Le studio est lu en PROJECTION (`data->photos->i->>at`, `->qualite->>juge`), jamais les images.
  Rangée dans `vrm_seance_photo` (SYNC_KEYS). Photos pas lues ⇒ pas de liste (pas su).
- **104 · Recherche par couleur** (`src/couleurPhoto.js`, `src/indexCouleurs.js`, `src/RechercheCouleur.jsx`,
  `src/LigneCouleurLoupe.jsx`) : 12 familles, couleur DOMINANTE de la paire (fond = médiane de chaque bord ;
  pondération centre / écart au fond), 5 langues (accents, pluriels : « bleue », « grün », « weiß »). Taper
  une couleur dans la loupe ⇒ « Photos : bleu › » ⇒ feuille (nuancier, grille de photos avec leur N°).
  Gardée par IDENTITÉ DE PHOTO (adresse exacte) dans IndexedDB ; « N photos pas encore lues · Lire » (sur
  l'appareil, le chemin de la recherche par photo). Une recherche : rien n'est relié ni écrit.
- **105 · Note vocale** (`src/noteVocale.js`, `DicterNote` dans `src/AtelierPaire.jsx`, rendu par
  `NotePaireCoque` sous la note : la note reste lue à UN endroit) : la reconnaissance du NAVIGATEUR
  seulement (`ecouter`, qui prend maintenant `lang` = la langue de VRM) ; le texte s'AJOUTE à la note
  (200 caractères, ce qui dépasse est dit) par le geste annulable ; sans reconnaissance / micro refusé /
  note cachée : le bouton reste et dit pourquoi.
- **106 · Certificat d'authenticité** (`src/certificatPaire.js`, `CertificatPaire`) : `certificat_paire_{n|a}_…`
  (N°, sinon annonce ; jamais un titre), même forme et mêmes plafonds que la facture d'achat, liste en
  scalaires (`id=in.(…)`), contenu par SON id au toucher ; « Envoyer » = feuille de partage du téléphone
  (fichier « Certificat-N124.pdf »), sinon téléchargement — **aucun lien public créé** (aucun mécanisme
  n'existait ; en créer un = une route publique vers un fichier privé, hors de ce lot) ; « Retirer » vide.
- **107 · Fusionner deux fiches** (`src/fusionFiches.js`, `FeuilleFusion`) : depuis la fiche, « Même paire ? »
  → chercher l'autre fiche par N° (propositions : même photo, même titre — c'est SON choix) → aperçu (les
  deux côtés, ce qui sera gardé) → **le N° du carton à choisir** (le bouton reste éteint sans) → « Fusionner ».
  **Aucun N° changé, réattribué ni perdu** : chaque fiche garde le sien ; l'autre N° reste visible comme
  ALIAS (« Même paire que N°213 · le carton porte le N°211 »). Les champs vides (prix d'achat, frais,
  fournisseur, taille) sont complétés, jamais écrasés ; deux valeurs différentes = désaccord montré.
  Refusée (et dit) : même fiche, déjà la même paire (`recreeDe`/`repriseDe`), déjà fusionnée, deux ventes
  prouvées, rangées dans deux cases. Registre `vrm_fusions_fiches` (SYNC_KEYS) = historique ; « Défaire »
  30 jours (retire ce qui a été recopié s'il n'a pas changé). La fusion devient une IDENTITÉ pour
  `enLigneDeuxFois` (preuve « fusion »), `numerosAmbigus` (notes) et `doublonsAReattribuer`.
- Textes par `tr()` dans les cinq langues (`src/i18n/langues/*/atelier.js`), écrans ajoutés à `MIGRES`.
  Six lignes dans « Quoi de neuf ». Dessin : sections titrées hors carte, photos en vedette (rayon 16),
  rangées de liste, pastilles d'icône teintées, un seul bouton plein par feuille, ambre pour « à revoir ».

## Preuves

- `scripts/audit-qualite-photo.cjs` (102 : images nette / douce / floue / sombre / noire sur blanc /
  uniforme ; worker ; jamais bloquant) — mutations `laplacien`, `lumiere` rouges.
- `scripts/audit-couleur-photo.cjs` (104 : 11 couleurs sur leur fond, mots en 5 langues, 50 photos au même
  titre = 50 résultats, aucune règle d'identité ne lit la couleur, aucun réseau) — mutations `fond`, `titre` rouges.
- `scripts/audit-fusion-fiches.cjs` (107 : 50 paires au même titre ; JAMAIS un N° perdu ni réattribué —
  après fusion, « Annuler », « Défaire » ; carton jamais deviné ; compléter sans écraser ; refus ; 30 jours ;
  identité dans enLigneDeuxFois / notes / doublons, exécutés) — mutations `numero`, `ecrase`, `carton`,
  `doublons` rouges.
- `scripts/audit-atelier-paire.cjs` (103 · 105 · 106) — mutations `ordre`, `coche`, `passu`, `ecrase`, `titre` rouges.
- `scripts/bancs/photos-fiches.cjs` (390 tactile, 1512 clair et sombre ; 50 + 300 paires inventées).
- Gardés verts : build, traduction, tdz, coherence, variables, identite, icones, composants,
  conflits-numeros, en-ligne-deux-fois, note-achat-double, numeros-clenum, numeros-lettres, rouge-doublon,
  quoi-de-neuf, parler-loupe (mutation `langue` remise sur la nouvelle ligne), recherche-photo.

## Limites, et ce qui reste

- Les photos d'annonces Vinted ne sont pas lisibles par la page (CORS) : 102 ne juge que SES photos
  (studio, « Créer sur Vinted ») ; 104 lit les photos d'annonces par l'extension ou la route de VRM, et
  ne lit pas (encore) les photos du studio (il faudrait relire chaque image).
- 103 : « paires présentes » = la liste publiée par Annonces ; sans elle, la séance dit « pas su ».
- 107 : deux fiches fusionnées comptent toujours pour deux annonces dans les totaux d'annonces (une paire
  en ligne deux fois : la carte « en ligne deux fois » de Ma journée dit d'en supprimer une).
- Seuils de 102 mesurés sur des images INVENTÉES : à regarder sur ses vraies photos (un avertissement
  de trop se règle en montant `SEUILS.nettete`, jamais en bloquant).
- Geste de Julien : aucun.
