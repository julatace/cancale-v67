# Intégration 11nov-f — 14 lots réunis sur vert-11nov (11-12 nov. 2026)

Branche : `claude/integration-11nov-f`. Pas de PR ici (le coordinateur fusionne).

## Ce qui est réuni (vrais `git merge`, dans cet ordre)
1. `claude/vert-11nov` (base) · 2. `integration-extension-2` (5.355 + oauth) · 3. `suivi-travail` ·
4. `sante-comptes` · 5. `photos-comptes` (5.358) · 6. `tva-marge` · 7. `achats-auto` · 8. `accessibilite` ·
9. `base-tables` (migration 038 **pas appliquée**) · 10. `vinted-pro` · 11. `publier-partout` · 12. `offres-vc` ·
13. `temps-gagne` · 14. `visuels-reseaux` · 15. `import-historique-sites` (5.365) · puis `origin/main` (déjà inclus).
Pas inclus : revue-colis, thermique, retours-litiges (paquet suivant).

## Conflits et résolution (les deux intentions gardées)
- Ma journée « À faire » : cartes **santé des comptes**, **avis négatif** et **photos sur deux comptes** toutes
  gardées (compteurs `nParCarteAF` / `nGestesTout`, feuilles des avis et des photos).
- Exports d'App.jsx, imports (Republier, FilsTous), `FONCTIONS` d'audit-coherence, `EXT_CAPACITES` : union
  (`empreintes` 5.358, `importsites` 5.365, `resumemois`…). Alarme du fond : `tickImport` + `tickImportSites` + `tickEmpreintes`.
- i18n (5 langues), `nouveautes.js`, `journeePerso.js`, CI (`verifier.yml`, `lancer-bancs.cjs`) : union.
- Fiche N° (accessibilité × vocabulaire) : `Fiche {motsVendeur().de}` et l'aria-label commence par le texte visible.
- api/ebay.js (programmer) : le compte (`avecSku(it0, ctx.compte)`, refus « paramètres ») + le texte au vocabulaire du vendeur.
- Annonces : « Publier partout… » ET « Nouveautés de la semaine » (liens sous les tuiles, entrées de la fiche, actions).
- CLAUDE.md §9 refait (< 59 000 o) ; les lignes sorties sont, telles quelles, dans `historique-divers.md`.

## Extension
Version finale **5.365.0** (aucun contenu publié ne la porte : `main` sert 5.344). CODE_VERSION, manifeste,
capteur/relais Leboncoin, `EXT_ATTENDUE` alignés ; zips Chrome + Orion refaits (un dossier `VRM-extension/`).

## Rouges nés du croisement, corrigés ici
- Audits : photos-comptes C1 (version ≥ 5.358), frein-relais-vinted (harnais + `appliquerPrixProCompte`),
  relais-lbc-kinds (`lbcimportmodele`), publier-partout (dépendances copiées en chaîne), politique-hotes (3 liens
  ouverts d'un clic), chrome-en-dur, centre-aide, confiance C11 (`peutEnvoyer`), coque-parametres (icône),
  comptes-emails-ligne, photos-vinted (photo d'achat lue dans l'e-mail), vocabulaire-article et vendeur-generaliste
  (textes neutres, plus « paire »/« baskets » hors Sneakers).
- Tests : rls-migrations lit la boucle de la 038 par signature (mutation : entrée retirée ⇒ rouge) ;
  bilan-synchronisation-adaptateur reçoit `motsVendeur`.
- Banc annonces-actions A : « Publier partout » et « Nouveautés » n'agissent au nom d'aucun compte.
- budget-vitesse : lectures en double corrigées (vrm_pro_facture ×5 ⇒ une lecture en vol + gardée 20 s,
  oubliée à l'écriture ; panel_comptes_etat partagé, `src/etatsComptesLecture.js` ; vc_listings des pastilles
  d'Annonces lu seulement sur Annonces). Budget JS relevé (+22-23 Ko, code des lots) avec raison.

## Demandes du coordinateur
- **VRM travaille, barre** : un travail terminé avec une annonce restée « en cours » (mise en ligne programmée de
  Republier) laissait la barre à 50 % sur « Terminé ». Travail fini/arrêté/interrompu ⇒ barre = fait/total
  exactement ; tout fini ⇒ pleine (`progression`, src/suiviTravail.js). Preuves : audit-suivi-travail P6-P9 +
  mutation, banc 7c (largeur mesurée, 390/1512, clair/sombre) : rouges sur le code d'avant (0,5), verts après.
- **`--vrm-card`** (jamais posé ⇒ blanc sur blanc en sombre) : absent de suivi-travail.css dans cet arbre (qui
  lit `--vrm-card2`) ; trouvé et remplacé par `--vrm-surface` dans facture-pro.css, journal-emails.css,
  styles-avis-bas.css. audit-suivi-travail B7 : la feuille n'utilise que des jetons posés (mutation ⇒ rouge).
  Capture 390 sombre de la feuille regardée.

## CI de la PR 1137 (12 nov.) — rouges vus seulement sur GitHub, causes et corrections
- **reprise-chantiers / regles** : `lot-preparation-reprise.cjs` exécute la tranche `batchBordereaux` dans une vm ;
  depuis suivi-travail elle pilote `suiviTravail` (importé dans App.jsx, absent du contexte du test) ⇒
  `ReferenceError`, puis `liberer is not a function` (conséquence). Le test charge le VRAI `src/suiviTravail.js`.
- **controle-prod-quotidien S1** : en **mode exemple**, l'effet de la carte des relais géocodait les adresses
  FICTIVES (api-adresse.data.gouv.fr puis Nominatim) — 24 requêtes réelles mesurées ; sur GitHub, Nominatim
  répondait sans en-tête CORS ⇒ erreur de console « … has been blocked by CORS policy ». En local la requête
  ne sortait pas (aucun réseau pour le Chromium du contrôle), d'où rien vu. Correctif app : `exempleActif()` ⇒
  rien géocodé, rien rangé (relevé après : 0 requête). Nominatim/API Adresse restent pour les vrais points :
  services gratuits, sans clé (§2.9 respecté), pas une fonction payante.
- **Garde réseau des bancs** : statut-colis, colis-retirer-propre, retraits-suivi servaient l'API Adresse vide
  ⇒ l'app retombe sur Nominatim (géocodage des points relais, `geocode`) qui partait sur Internet : servi vide
  aussi. budget-vitesse (`vitesse.cjs`) et annonces-actions : une photo Vinted coupée déclenche la SONDE
  (`essaiSonde`, fetch no-cors, src/photosVinted.js — voulue) qui passait par `continue()` : coupée comme
  l'image. Preuve : traceur de sorties (requête ni coupée ni servie) : 0 sur les 6 bancs ; mutation (ligne
  Nominatim retirée de retraits-suivi) ⇒ 6 sorties vers nominatim.openstreetmap.org.
- **nouveau-vendeur** : la note de Statistiques passait à la ligne devant « · » : espaces insécables avant
  chaque « · » (`&nbsp;·`).
- **parcours-critiques / comptes-et-reception** (sur main il tombait avant, garde absente) : atelier-brouillon
  (VoileAtelier hors tranche), favoris-historique (JaugeActions importe App.jsx : lecture muette servie),
  connexion-actions (`tr`, `ChoixLangue`, dictionnaire fr), bordereau-zone-protegee et bordereau-qr-lecture
  (texte retenu « Créé par vrm.center ») : tests remis à la forme actuelle du code, préexistants sur main.
- **ecrans (parcours-quotidien)** : rouge identique sur main (`vueSynchronisee is not defined` : useVueSession
  synchronisé par reprise-ecrans, le banc ne sert pas ce chemin) — préexistant, laissé.

## Ce qui reste rouge
- `audit-colis-envoi` B (attendu, réglé par revue-colis).
- Banc `ebay-complet` : 11 KO **identiques sur la branche publier-partout seule** (préexistant, pas du croisement).
- Tests node `journee-instantanee`, `lbc-persistance`, `retraits-confirmes` : déjà rouges sur vert-11nov.
- Messages : les sources du compteur de la coque relues une 2e fois depuis les fils eBay (noté « à corriger »
  dans `scripts/budget-vitesse.json`).
