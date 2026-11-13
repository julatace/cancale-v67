# Extension 5.371 — boutique, carte du logo, Réparer, rapport, file réseau (12 nov. 2026)

Lot `claude/agent2-ext-boutique` (second agent), parti de `claude/agent2-discretion` (5.370, finie @ 0ad032585,
qui CONTIENT 5.356→5.369 et `main` 184f46c2f), `origin/main` fusionné (déjà à jour). **Extension 5.371.0**
(aucune branche distante ne la portait ; réservée dans la coordination). Pas de PR, rien fusionné.
⇒ **Intégrer cette branche À LA PLACE de `agent2-discretion`.**

Validé par Julien le 12 nov. (points 1, 2, 4, 5, 6, 7 ; 3 = refusé : badge sur l'icône, ralentir sur
batterie/inactivité, raccourci clavier — rien de tout ça n'est fait). Ajout de Julien (08 h 35, capture
iPhone Orion sur Vestiaire) : le logo cachait l'onglet « Moi » de la barre du bas.

## Ce qui a changé

### 1. Chrome Web Store / Edge (rien publié par l'agent)
- `docs/passation/2026-11-12-chrome-web-store.md` : le pas-à-pas de Julien (compte développeur 5 $,
  validation en deux étapes, statut de commerçant DSA, envoi du zip, chaque champ, instructions de test
  avec un **compte de démonstration vide** — sans lui l'examinateur refuse —, Edge, ce que fait l'app
  ensuite, et **le risque de refus dit honnêtement** avec ce que la fiche répond).
- Fiches `docs/boutiques/{chrome-web-store,edge,firefox}.md` : `contextMenus` (5.370) justifié, description à
  la réalité du code (baisse de prix, vacances, refus avec SON message, 200/jour, arrêt net à une
  vérification), `vrm.center` justifié par `/extension-version.json`, ancienne adresse retirée (plus dans le manifeste).
- Manifeste : `content_security_policy.extension_pages` explicite (`script-src 'self'; object-src 'self'`),
  `minimum_chrome_version` 111 (monde MAIN), `homepage_url`. Firefox/Safari/Orion : ces clés retirées par
  `zip-extension.cjs` (Orion MV2 : la CSP objet serait refusée). Icône 128 refaite avec ses 16 px de marge
  transparente (conseil de Google). Aucune autorisation, aucun site ajoutés.
- Après validation : l'ID de la boutique va dans `LIENS_BOUTIQUES` (`src/navigateursServis.js`) ; l'app
  propose déjà la boutique dès qu'il y est (`installerExtensionIci`), le zip reste pour le reste.

### 2. « Nouvelle version disponible » (carte du logo + fenêtre)
- `public/extension-version.json` (`{"version":"5.371.0"}`) = `EXT_ATTENDUE` (⚠️ **à monter avec chaque
  version**, comme le zip ; contrôle 0 de `audit-ext-boutique`).
- Fond : `versionServieConnue` (lue au plus toutes les 6 h, pas avant 15 min après un échec), `etatMiseAJour`.
  Installée à la main (pas d'`update_url`) et plus ancienne ⇒ « Nouvelle version disponible · x » +
  « Télécharger » (seulement le zip ou le fichier Orion servis, liste blanche) + 3 étapes.
  Venue d'une boutique (`update_url`) ⇒ rien d'affiché, `requestUpdateCheck` demandé (6 h au plus).
  Servie illisible ⇒ « pas su », rien d'affiché.
- Firefox/Orion : aucune fiche AMO publiée ⇒ toujours « à la main ». Le jour où AMO l'est, `origineInstallation`
  doit le reconnaître (AMO ne pose pas `update_url`).

### 4. Carte du logo en 4 lignes (`quatreLignes`, vrm-badge.js)
Compte (pseudo) · Lu (« il y a 3 min ») · Jauge (« 23/50 cette heure · 112/200 aujourd’hui », tous les Chrome
du compte ; ligne partagée pas lue ⇒ « au moins ») · État (Normal ✓ / Prudence jusqu’à … / Pause / Tout
arrêté / Arrêté : vérification — ambre, seul geste / N gestes en attente de réseau). Leboncoin garde ses
trois lignes (décision du 9 nov.). `data-resume` reste sur le bloc. Carte 352 px au plus, jauge sur une ligne.
« Tout arrêter » (5.370) gardé tel quel dans le détail.

### 5. « Réparer » (`reparerExtension`, `problemesAReparer`)
Seulement sur un état cassé MESURÉ : session VRM perdue (renouvelée), commande « en cours » sans nouvelle
depuis 15 min et plus vivante (arrêtée et dite), canal de page Vinted absent ou douteux (l'onglet est
RECHARGÉ : le canal privé de la 5.356 ne se donne qu'une fois — jamais un second canal), alarmes reposées,
pont de VRM réinjecté. Extension muette ⇒ « Réparer » pose `popup.html?mode=reparer&force=1`, qui relance
l'extension après 6 s sans réponse (une fois par 10 min). **Jamais pendant une republication** : témoin
`vrmRepubVivante` posé par republier/recréer/brouillons (`avecTemoinRepub`) et la mise en ligne planifiée.

### 6. « Envoyer un rapport » (carte + « Tout va bien ? »)
- Fond : `construireRapport` / `envoyerRapport` : version, navigateur, origine, session (mot), nombre de
  comptes, dernières lectures par site (heures + code), compteurs et 30 dernières étiquettes de diagnostic
  (`vrmDiagRecents`), files (comptes par étape), pauses. Étiquette stricte : une majuscule, un espace, un
  « @ », un domaine ⇒ « masque » ; 4 chiffres ou plus ⇒ « # ». Limite dite : un pseudo tout en minuscules
  glissé dans une étiquette passerait — les étiquettes sont écrites par le code (jamais un texte de page).
- Serveur : `api/compte.js?mode=rapport-extension` (pas de 13e fonction) → `api/_lib/rapport-extension.js` :
  liste blanche rejouée, UNE ligne `ext_rapport_<uid>` par vendeur (owner = lui), 5 derniers, 6/h,
  comparer-et-échanger `data.rev`, lecture ratée ⇒ 503 rien écrit ; notification au propriétaire ; GET :
  le vendeur sa ligne, le propriétaire tous (projeté) ou un vendeur (`?de=`).
- App : `src/RapportExtension.jsx` — bouton dans « Tout va bien ? » (commande `rapportExtension`), et
  « Rapports de l’extension » au propriétaire sous les alertes de production.

### 7. Rien perdu si internet coupe (`mettreEnFileReseau`, `viderFileReseau`)
Un geste d'ÉCRITURE de l'app (`executerPourApp`) alors que le navigateur est HORS LIGNE au départ (rien
n'est parti, c'est sûr) ⇒ gardé dans `vrmFileReseau` (20 au plus, 24 h). Jamais « accepter une offre »
(vend la paire : refusé et dit). Au retour (`online`, alarme `vrm-reseau` chaque minute) : il repart par
`executerPourApp` — compte de l'onglet revérifié AU DÉPART, plafonds, pause, Tout arrêter ; refus passager
⇒ il reste ; refus net ⇒ il sort (journal) ; échu ⇒ il sort. Un délai dépassé (statut 0 en ligne) n'est
PAS rejoué : la requête a pu partir. App : pastille « N gestes en attente de réseau · Annuler » (`FileReseauExt`,
montée à côté de `SuiviTravailCoque`) — sorte et heure seulement, jamais le texte.

### Logo jamais sur une barre fixe (`eviterBarres`, demande de Julien)
Les éléments `fixed/sticky` larges (> 30 % de la largeur, < 40 % de la hauteur) dans la zone du logo
(+12 px) le repoussent au-dessus (barre du bas) ou en dessous (barre du haut), jamais sous la zone sûre
de l'iPhone ; recalculé au redimensionnement, au défilement, quand la page change (une mesure par image).
La place glissée reste rangée par site (`vrmBadgePos`, déjà là depuis la 5.351) ; seul l'affichage se décale
(`data-evite-barre`). Logo 38 px au téléphone.

## Preuves
- `scripts/audit-ext-boutique.cjs` (vrai background.js, `_fond-vm.cjs`) : **32 verts** ; rouge sur la
  branche de départ (`BG_SRC=` 0ad032585 / 6c7a56fc4 : 6 rouges) ; `--prouve` **10/10 mutations**. Il a
  trouvé un vrai défaut : la première étiquette laissait passer un e-mail et un pseudo ⇒ règle stricte.
- `scripts/bancs/carte-logo-boutique.cjs` (390 tactile / 1512, clair / sombre) : **59 verts** ; sur le
  vrm-badge.js de départ (`BADGE_SRC=`) 36 rouges ; mutation « barres » (`affiche = bb`) 5 rouges.
  Captures regardées (carte 390/1512 clair/sombre, nouvelle version, Réparer pendant une republication,
  barre du bas Vestiaire-like, barre du haut). Corrigé après capture : jauge sur 2 lignes, deux boutons bleus.
- `extension-visuel` remis à la règle du 12 nov. (63/0) ; `badge` 138/0.
- Verts : coherence, extension-zip, paquets-boutiques, extension-navigateurs (Chrome, Edge, Firefox, Orion…),
  variables, tdz, identite, icones, fonctions-api (12), discretion (82), icone-extension, regles-achat-extension ;
  `npm run build` OK. Les 152 audits qui lisent l’extension, lancés ici puis sur la branche de départ : un seul nouveau rouge (`audit-robustesse-extension`, `FORCE` hors de la fonction extraite) — corrigé ; bancs `carte-orion-sans-onglet`, `lbc-clair-carte`, `carte-resume-mois`, `badge` verts.

## Reste / à savoir
- `public/extension-version.json` à monter à chaque version (contrôle 0 de `audit-ext-boutique`).
- Firefox AMO publié ⇒ adapter `origineInstallation`.
- Les commandes longues (republier, baisses) ne passent pas par la file réseau (multi-étapes : rejouer plus
  tard serait risqué) ; seuls les gestes `executerPourApp` (réponse, offre, refus, message favori).

## Gestes de Julien
1. Remplir `public/legal/editeur.js` et `src/contact.js` ; créer un compte VRM de démonstration vide.
2. Suivre `docs/passation/2026-11-12-chrome-web-store.md` (Chrome 5 $, puis Edge gratuit).
3. Donner l'adresse de la fiche validée à une session (→ `LIENS_BOUTIQUES`), puis retirer la copie
   « non empaquetée » dans chaque Chrome.
