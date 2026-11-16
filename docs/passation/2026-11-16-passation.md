# Passation du 16 novembre 2026 — ce qui reste à faire

À lire après CLAUDE.md. Un seul fichier, à jour au 16 nov. au matin. Le détail de chaque
chantier est dans son récit `docs/passation/2026-11-15-*.md` (nom du chantier).

---

## 1. Ce qui est EN LIGNE (vrm.center, vérifié : Vercel READY, `/api/sante` ok)

| PR | contenu |
|---|---|
| julatace/cancale-v67#1176 | « À retirer ailleurs », finition écran par écran, republier guidé, « Sans achat relié » |
| julatace/cancale-v67#1177 | extension **5.385.0** servie (N° des annonces publiées hors VRM, Vestiaire juste, même photo, lecture publique vide, retours suivis) |
| julatace/cancale-v67#1178 | **« Verre dépoli »** partout (palette choisie par Julien) + Stock en étagères + dossier Chrome Web Store |
| julatace/cancale-v67#1179 | **Écrans refaits sur les maquettes validées** : Ma journée, Annonces, Ventes, Achats, fiche D, Argent, Messages, Paramètres, rail ordinateur ; « À envoyer » partout |
| (PR de la vague C) | **Extension 5.393.0** (verre de la carte/site/e-mails, même photo · sûr, versements, Vestiaire « aimés », scanner pour retrouver) + banc `sante-donnees` réparé : aucune donnée réécrite à l'ouverture d'Achats (le banc servait une `main` à 2 clés) |
| julatace/cancale-v67#1180 | **Nouveautés** : transporteur lu sur l'étiquette, atelier d'arrivée (N° puis case sur la fiche), contrôle de nuit + santé des comptes, baisse conseillée, relance des favoris, loupe universelle, bilan du mois, alertes de seuils, bénéfice réel, sauvegarde zip, écran de chargement verre, retours, eBay, purge des bordereaux |

Base de prod (avec l'accord de Julien, 15 nov.) : migrations `bordereau_retirer_pdf_044`,
`securite_durcissement_045`, `politiques_uniques_036` appliquées ; compte Vinted copié
du 2 oct. nettoyé (sauvegarde `sauvegarde.copie_compte_20261115`).

---

## 2. En cours au moment de la passation (branches poussées, PAS en ligne)

| chantier | branche | état |
|---|---|---|
| **Finitions** | `claude/finitions-16nov` | « Week-end calme » qui se remet à « oui » (`push_prefs`, centre-notifs F11) ; segments 40 px → 44 ; banc tout-va-bien sans session ; message passager qui couvre ‹ et Retirer d'une conversation ; « Imprimer le bordereau » qui chevauche le logo dans « Tout voir » ; fiche D depuis le Stock : « Sites » ≠ sites du Stock (une seule source : `src/stockAnnonces.js`) ; `audit-politique-hotes`. |
| **Stock v4** (fini, à intégrer) | `claude/stock-v4` | étagère personnalisable (Cartons / Rayonnage / Plan, teintes, étiquette à cocher, densités, « Personnaliser », « La pièce »), Stock ordinateur en 3 volets. Audit 75/75 + 23/23 mutations, banc 165. **À relancer à l'intégration** : `fiche-partout`, `stock-gestes`, `stock-finitions`, `stock-2d-revue`, `stock-hors-reseau`, `rangement`, `journee-coherence`, `vague3-ecrans` (à l'ordinateur, toucher une case ouvre le volet de droite, plus la fiche). `stock-2d` : 4 rouges déjà sur main (« Voir l'état »). Texte de la pile peu lisible sur le bleu (vu sur main) : à vérifier sur la v4. |

**Ordre de mise en ligne conseillé** : finitions → stock-v4.
Rouges connus après la vague C : `verre` V4 (9 flous pour 8 à 390 selon le moment où « Quoi de neuf » apparaît, aussi sur main), `popup` (« ⟳ = chrome.runtime.reload », déjà rouge avant), `scan-colis` (chrono < 1 s à 1512 sous charge). Titre de la carte « deux comptes » sur deux lignes à 1512 (banc assoupli, écran inchangé). Toujours : `npm run build` + `audit-traduction` après
chaque fusion (une union a déjà créé deux `export default` dans les dictionnaires),
bancs UN PAR UN (machine chargée, disque ~1,5 Go libre), PR, merge avec le SHA complet,
Vercel READY, `/api/sante`, `/extension-version.json` via `mcp__Vercel__web_fetch_vercel_url`.

---

## 3. Décisions prises cette nuit (ne pas redemander)

- **« Applique ce que tu me proposes »** (Julien, 15 nov. 23 h) : sur un choix de design, appliquer la recommandation et lui MONTRER le résultat (capture), sans attendre.
- Palette « Verre dépoli » ; maquettes téléphone et ordinateur validées ; étagère v4 validée (pas de boîtes à chaussures : « ça peut être des chemises ») ; fiche d'un article = **direction D « fiche produit »** (la B a été refusée), avec « Relier · N € » sur la vente.
- **On range un article, pas un achat** : plus aucune proposition de case sur un achat (cloche, Ma journée, « J'ai retiré »). L'atelier d'arrivée donne le N°, la case vient sur la fiche (`casesProposees`).
- **Ma journée ne montre que ce qui demande un geste** ; le reste derrière « Tout va bien ? · N points » ; litiges d'achat et de vente ensemble ; plus d'import du passé ni de contrôle de nuit dans Ma journée.
- **« Ventes à dater » retiré** partout : c'est à l'extension de lire les dates.
- **Transporteur jamais « inconnu »** : lu sur l'étiquette, sinon « pas encore lu » + le compte à ouvrir.
- **Un seul mot : « À envoyer »** (`src/libelles.js`).
- Bordereaux supprimés quand la vente est finalisée ET l'argent reçu ; données des acheteurs Vestiaire gardées ; lettre au hasard en fin de description gardée.
- Vestiaire : offres aux personnes qui ont aimé, « tout comme Vinted ».
- Choix d'un agent, non contredit, à montrer à Julien : « J'ai retiré » ouvre l'atelier sur le N° ; Ma journée dit « N achats arrivés à numéroter » (clé `vrm_arrivees_a_numeroter`).

---

## 4. À faire ensuite (rien ne dépend de Julien)

**Défauts connus, rouges hors des lots** (vus par les agents, pas corrigés) :
- `enligne` (25 KO) : attend qu'une annonce vue seulement en lecture publique entre dans la grille, refusé depuis le 2 nov. → réécrire le banc sur la règle.
- `vestiaire-bout-en-bout` B2 : à 390 px, `?tab=messages&site=vestiaire` montre l'écran Vestiaire alors que Vestiaire n'est ni choisi ni relié (effet de `FiltreSites`) → probable défaut de l'app.
- `reglages-premium` : un `span` recouvre l'interrupteur « Mots expliqués » (toast ?).
- `audit-revue-fin` A4 : `partageFichiersPossible` déclaré deux fois.
- `vendre-plus` (2 rouges « Agir… Leboncoin · eBay · Vestiaire ») ; `baisse-prix` G2 dépend de « Varier » — or « Varier » est RETIRÉ (CLAUDE.md §3) : vérifier qu'il ne reste rien.
- `audit-recherche-universelle` : contrôles à l'horloge murale, faux rouges sous charge → mesurer en temps CPU.
- Audits rouges vus par fiabilite-auto : fraicheur-unique (ligne montée 2×), safari, stockage-sur, vocabulaire-article, secrets (`src/exempleDonnees.js`), textes-courts (Ebay.jsx).
- Bancs visant d'anciennes classes de la fiche : `lot1415`, `stock-2d`.

**Limites assumées** (pas de source, ne pas inventer) : pas de date limite d'envoi sur la fiche D (elle n'existe que dans l'e-mail) ; « À vérifier · Tout est bon » des achats (aucune date limite de vérification lue) ; photos eBay jamais « même photo · sûr » sans l'hôte `i.ebayimg.com` (demanderait son accord à la mise à jour).

**Liste proposée le 15 nov., pas encore faite** :
annuler partout (10 s) · résumé de notifications du matin · raccourcis clavier ordinateur ·
glisser-déposer dans le Stock à l'ordinateur · animations douces (réduction respectée) ·
écrans vides soignés · passe de lisibilité · aide « ? » par écran · démo du mode exemple ·
ouverture plus rapide (découper le gros `App-*.js`) · hors ligne complet · import complet
Leboncoin et Vestiaire · empreinte des photos d'achat pour la liaison achats-articles.

**Plus tard, avec l'App Store** : raccourcis iPhone.

---

## 5. Gestes de Julien (lui seul peut)

1. **Installer l'extension 5.393.0** (servie depuis le 16 nov.) (remplacer le dossier, ⟳ dans chaque Chrome ; Orion : `VRM-Orion-dossier.zip`). Retrouver le navigateur resté en **5.273**.
2. **Déposer l'Autry** (Chronopost XU…JF) **avant le lundi 23 nov. à 10 h**.
3. Ouvrir vinted.fr sur le compte qui porte la vente **N°193** (transporteur pas encore lu).
4. Laisser vinted.fr et leboncoin.fr ouverts sur le compte pour que la mesure « même photo · sûr » tourne.
5. Ce soir/demain (dit par lui) : essai Safari sur Mac (`VRM-safari.zip`), **Chrome Web Store** (dossier + captures `visuels-verre`), **éditeur et Stripe** (`public/legal/editeur.js`, `src/contact.js`, prix `vrm_mensuel` 16,99 €, `STRIPE_SECRET_KEY` — sans eux personne ne peut payer), **clé de signature eBay et reconnexion**, **modèles d'e-mail Supabase**.
6. La liste longue (SMTP, Gmail forwarder, Worker Cloudflare, migration 016, Turnstile, partenaires/migration 043…) : CLAUDE.md §9 « Gestes encore attendus ».
7. Questions ouvertes : frais de sponsorisation eBay dans le bénéfice ? vieilles sauvegardes (30 sept., 2 oct.) à garder ? eBay multi-sites ?

---

## 6. Où sont les choses

- **Maquettes validées** (copie réduite, données inventées) : `docs/design/maquettes-validees/` — `telephone/`, `ordinateur/` (1512 et 1280), `etagere/` (v4), `fiche/` (direction D). Les originaux et leurs générateurs étaient dans le bloc-notes de session (effacé avec le conteneur).
- Avant/après : `docs/design/avant-apres/`.
- Couche verre : `src/design/studio-verre.css` (`@layer vrm-verre` nommée la première), écrans : `verre-ecrans.css`, `ventes-verre.css`, `fiche-d.css`.
- Règles nouvelles : `src/ventesVerre.js`, `src/ficheProduit.js`, `src/paireASortir.js`, `src/colisEnvoyes.js` (transporteur), `src/ouRanger.js` (`casesProposees`), `src/fiabilite/`, `src/baisseConseillee.js`, `src/relanceFavoris.js`, `src/rechercheUnique.js`, `src/bilanFinMois.js`, `src/alertesSeuils.js`, `src/beneficeArticle.js`, `src/photoFine.js` (vague C).
