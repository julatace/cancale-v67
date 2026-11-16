# Passation générale — 16 novembre 2026 (soir)

> **À lire en premier par toute nouvelle session.** Ce dossier rassemble TOUT ce que Julien a demandé
> du 11 au 16 novembre, ce qui est en ligne, ce qui est prêt mais pas encore en ligne, ce qui est
> commencé, ce qui est en file, ce qui est refusé, et ses gestes à lui. Il a été écrit parce que la
> limite d'usage hebdomadaire était à 90 % : beaucoup de chantiers ont été **mis en pause** avec leur
> travail poussé sur leur branche. Rien ne doit être refait de zéro : reprendre chaque branche.
>
> Aucune donnée réelle (nom, e-mail d'acheteur, photo) n'est recopiée ici : le dépôt est PUBLIC.

---

## 0. Comment reprendre (méthode qui marche)

1. Lire `CLAUDE.md` en entier, puis ce fichier, puis le récit du lot concerné
   (`docs/passation/2026-11-1x-<lot>.md`, chacun a une section « ÉTAT À LA REPRISE »).
2. **Une PR à la fois sur `main`**, mise en ligne dès que la CI n'ajoute **aucun rouge nouveau**
   par rapport à la CI du dernier commit de `main` (règle « zéro rouge » assouplie par Julien le
   16 nov. à midi : « fais le mieux »). Toujours `git merge origin/main` (vrai merge) avant de fusionner.
   Fusion : `gh api repos/julatace/cancale-v67/pulls/<n>/merge -X PUT -f merge_method=merge`
   (GraphQL est interdit dans ces sessions : REST seulement). Puis vérifier le statut « Vercel »
   du commit de `main` (success).
3. **Machine partagée à 4 processeurs** : pas plus d'une douzaine d'agents en parallèle ; commandes
   lourdes (build, bancs, passe d'audits) via un sémaphore (3 créneaux) ; jamais de `pkill` large
   (deux agents ont tué les bancs des autres) ; surveiller `df -h /` (disque plein deux fois le 16 nov. :
   supprimer les worktrees des lots fusionnés et les copies `/tmp/vrm-*`).
4. Julien veut des **messages courts**, en français simple, et être prévenu à chaque mise en ligne.
5. Jamais d'écriture dans la vraie base (lecture seule, projections scalaires). Les migrations SQL
   sont des gestes de Julien.

---

## 1. Ce qui est EN LIGNE (vrm.center) — fusionné sur `main`

Du 11 au 13 nov. (paquets F, G1, G2, traduction, 12nov-*, 13nov-*) : tout ce qui avait été lancé
(achats auto, TVA sur marge, santé des comptes, Publier partout, Vinted Pro, temps gagné accueil,
visuels réseaux, import historique, retours et litiges, imprimante thermique, hors ligne, gros lot,
rangement guidé, livre des recettes + « Payé en », alerte arnaque, favoris refaits, prix mini,
« Quelles annonces republier ? », « Achetés pas en ligne », alertes eBay, eBay complet, Leboncoin plus,
Vestiaire plus, sécurité des comptes, Créer sur Vinted, republication programmée, traduction 5 langues).
L'autre agent de Julien (branche `claude/project-review-nsk5su`, PR #1150 à #1180) a fusionné les
refontes de design du 14 au 16 nov. (Studio bleu, Inter, Verre dépoli, écrans sur maquettes).

**Le 16 nov. :**
| PR | quoi |
|---|---|
| #1183 | Parcours critiques au vert + 7 défauts d'affichage (boutons eBay 44 px, titre des ventes écrasé, pied de barre latérale, feuille de style perdue après mise à jour…) |
| #1196 | 69 → 3 audits rouges sur `main` ; vrais défauts corrigés (notifications coupées : montant URSSAF, « ne poste pas » eBay ; « Rien n'a été créé » à la création d'annonce ; iPhone en paysage ; dates UTC → Paris ; N° comparés en texte → `cleNum`) |
| #1192 | Barre de sélection de Ventes : « Tout sélectionner » = lignes affichées (et plus 2 185 ventes) ; appui long + défilement ne sélectionne plus ; sélection vidée au changement de filtre ; barre opaque à la place de la barre du bas ; chaque action dit « N sur M » |
| #1198 | Fluidité iPhone 1 : flou retiré des listes de Ventes là où il ne se voit pas ; propositions d'achat préparées une fois ; rangées hors écran non mises en page (934 → 248 ms) ; barre du bas lisible ; eBay de Ventes sur des cartes ; Argent « au moins » plus doublé, titre URSSAF entier |
| #1208 | Fluidité iPhone 2 : boucle ResizeObserver de Ma journée ; aperçu de Ma journée pendant le chargement (chiffres coupés/superposés, squelette blanc, carte colis blanc sur blanc) corrigé ; contrastes « vendu », « 999+ » |
| #1201 | Barre du bas : Aujourd'hui · Annonces · **Achats** · + · Ventes · Argent ; plus de glissement entre onglets (l'historique est remplacé entre onglets, `touch-action`) ; onglet actif = écran |

---

## 2. PRÊT mais PAS ENCORE EN LIGNE — PR ouvertes, dans la file de fusion

Le « train de mise en ligne » (un agent) les fusionnait une par une. **Ordre de priorité décidé :**

1. **#1199** `claude/relier-fiable` — liaison achat ↔ vente fiable : seulement « très probable »
   (taille + couleur + modèle, couleur lue sur l'annonce, le titre ou la photo sur l'appareil, sans IA),
   exclusive (un achat ⇄ un article) ; mesuré sur sa base : 986 → 9 propositions affichées, 161 → 0
   ventes proposées sous plusieurs achats, 4 → 0 fausses ; fiche → Argent : « Délier » et « Reçu » ;
   Annonces : puce « Relier un achat ». À relancer avant fusion : bancs achats-liaison et ventes-verre.
2. **#1204** `claude/bancs-rouges-a` — compteur « 2 changements » faux à l'ouverture d'Achats ;
   prix d'achat impossible à saisir dans la fiche D (le « ? » ouvre la saisie) ; lien `?tab=trancher` ;
   titre de panneau Paramètres doublé ; politique de confidentialité (Base Adresse Nationale).
   **ARBITRAGE** : elle remet « Retirer de la case » dans la feuille ⋯ de la fiche — **NE PAS le garder**
   (décision de Julien : la case s'allume dans le Stock, pas de bouton) ; « Déplacer » peut rester.
3. **#1203** `claude/bancs-rouges-b` — titres de colis plus coupés par « … » ; Achats « au moins 0 € » →
   « — » ; focus qui revient sur la ligne touchée ; noms accessibles ; e2e-extension et WebKit iphone-reprise R verts.
4. **#1197** `claude/retirer-case-compact` — Stock : la case d'une paire vendue encore rangée est en
   surbrillance (toucher = sortir, annulable) ; **sortie automatique du Stock quand l'expédition est
   prouvée** (`src/stockSortie.js`, `partieDuStock`) ; plus aucun bloc « Vendues à sortir » / « Retirer
   de la case » / « Je l'ai sortie ». **La carte « La paire à sortir » de Ma journée est SUPPRIMÉE**
   (décision finale de Julien à 15 h 40 : « tu ne l'as pas enlevée »).
5. **#1193** `claude/personnalisation-simple` — « Modifier ma journée » simple (3 groupes, interrupteur,
   ↑↓ et glisser, enregistré tout de suite, 281 → 106 mots). Au merge : retirer la carte « paire à sortir »
   de l'éditeur (cf. #1197) et ignorer sans erreur les préférences qui la contiennent.
6. **#1202** `claude/ventes-clair` — Ventes plus clair : 1re vente à 640 px au lieu de 982 ; bande du mois
   lisible ; plus de compteurs répétés ; « N choses à regarder » repliable ; vente sur 3 lignes ; **plus de
   « ⋯ » : toucher la vente ouvre sa fiche** ; puce « Prix d'achat ? » seulement si manque ; « Imprimer »
   et « Déposé » en ronds compacts ; corrigé le 16 au soir pour l'ordinateur (lignes ≤ 96 px, ff539538c).
7. **#1206** `claude/favoris-offres-irreprochable` (extension **5.398.0**) — revue anti-blocage :
   arrêt anti-robot dans `requeteVinted` pour toutes les voies ; « Tout arrêter » coupe un message en
   cours ; offre auto relue juste avant le geste ; annonce réservée/masquée/vendue ⇒ rien ; favori refusé
   jamais repris ; pause jamais pile une minute ; jamais deux fois le même texte (salutation variée).
   Règles de Julien inchangées (50/h, 3–20 min, rythme « comme Vintex », pas de plafond 10/60 min).
8. **#1187** `claude/ebay-a-traiter` — « Compte eBay mal désigné » (vrai défaut : `compte:'principal'`
   refusé + action `agent` supprimée) → action `taches` ; « Réponse eBay illisible pour les retours »
   (réponse vide = aucun retour) ; bouton « Reconnecter mon compte eBay ».
9. **#1184** `claude/ecrans-restes` — stock importé visible ; date limite d'envoi dans la fiche et la loupe ;
   N° de tous les articles d'un lot tamponnés ; MFA « plus tard » synchronisé ; iPad/900 px ; code mort retiré.
10. **#1195** `claude/vitesse-lectures` — lectures en double (Messages, Ma journée) ; accueil 37,7 → 25,8 Ko ;
    veille temps réel étendue à Messages Vinted, Leboncoin, Vestiaire, e-mails.
11. **#1194** `claude/impression-retours` — bordereaux de RETOUR imprimés avec les ventes, cartouche
    « RETOUR · Achat renvoyé · pas une vente », jamais comptés dans « à envoyer » (demande de Julien :
    « bien préciser que c'est un retour et pas une vente »).
12. **#1185** `claude/compta-donnees` — notification URSSAF → « Déclarer » ; comparer-et-échanger sur
    les réglages ; file par clé ; dates à l'heure de Paris ; facture « Envoyer avec VRM » ; partenaires :
    commission proportionnelle au remboursement partiel (**migration 043 modifiée : à recoller en entier**).
13. **#1182** `claude/transporteurs-suivi` — suivi Mondial Relay des colis VENDUS (sans clé) ; **suivi
    Colissimo/UPS par clé RETIRÉ entièrement** (décision de Julien : « on laisse tomber, on garde le suivi
    de Vinted ») ; variables Vercel `LAPOSTE_OKAPI_KEY`, `UPS_CLIENT_*` plus lues.
14. **#1188** `claude/plateformes-restes` (extension 5.397 → **passera 5.399**) — « Vendu ! » notifié pour
    Leboncoin, eBay, Vestiaire (une fois, jamais l'historique) ; douchette eBay/Leboncoin ; facture eBay
    multi-lignes ; catégorie Vestiaire envoyée ; règle unique « finalisé / CA » Vestiaire.
15. **#1190** `claude/extension-restes` (extension 5.395 → **passera 5.400**) — « Mondial Relay by InPost » ;
    photos eBay pour « même photo » ; anti-arnaque dans « Tous » ; avis bas dans la santé des comptes ;
    notification « republication programmée pas partie » ; « Publier cette fiche » réserve le N° ;
    photos du studio dans « Créer sur Vinted » ; « N acceptées par VRM ».
16. **#1205** `claude/design-restes` — toucher une rangée Leboncoin/eBay/Vestiaire/Stock monte la paire
    en place ; contrastes ; meuble glissé au doigt.
17. **#1200** `claude/vitesse-volume` — accélérations (même chiffres) ; décision : poser `budget-volume.json`
    au niveau actuel (garde anti-régression), l'objectif 2 s reste écrit comme cible, pas bloquant.
18. **#1210** `claude/regles-achat-recopie` — recopie `vrm-regles-achat.js` : à faire partir **dans la
    dernière version d'extension fusionnée** (5.400).

**Versions d'extension** : servie ≥ 5.385 ; réservées 5.394 (traduction-restes, en pause), 5.396
(extension-robuste, en pause), 5.398 (#1206), 5.399/5.400 (train), 5.401 (photo-identite, en pause).
Fichier de réservation : voir l'ancien scratchpad ; règle : une version au-dessus de toute version servie
et réservée ; zip régénéré en UN dossier ; `EXT_CAPACITES` à la version réelle de fusion.

---

## 3. COMMENCÉ puis MIS EN PAUSE (limite d'usage) — à reprendre sur la branche

| Lot / branche / PR | Demande de Julien | État à la pause |
|---|---|---|
| `claude/vente-email-absente` #1214 | **URGENT, régression** : une vente reçue par e-mail (« Vendu 64 € ») n'apparaît plus dans Ventes (avant : « l'extension n'a pas encore capté · bordereau à venir ») ; « expire dans 24 h » affiché sur une offre VINTED (les offres Vinted n'expirent jamais, seulement Vestiaire) | laissé tourner le dernier ; reprendre en premier si pas fusionné |
| `claude/achats-qr` #1211 | QR de retrait visible (bouton « Afficher le QR », écran allumé) ; « encore 3 j » ligne ≠ « 4 j » feuille → une règle ; n° de suivi entier copiable ; **photo + titre de l'achat sur chaque colis à retirer** (relier par n° de suivi, `achatDuColis`) | 27/27 verts, à fusionner |
| `claude/achats-retour` #1207 + `claude/relier-glisser` #1213 | **Achats en retour/litige/remboursés jamais proposés à relier** (« j'ai demandé un retour, ne me la propose pas ») ; puis **relier en glissant** (appui long, l'achat se soulève, on le pose sur la vente ; vibration impossible sur iPhone Safari, le dire) ; après liaison : **bénéfice + reçu tout de suite**, sans recouvrir la liste | #1207 en CI ; glisser commencé |
| `claude/tampons-parametres` #1209 | **Tampons réglables visuellement AU MOMENT D'IMPRIMER** : sélection → aperçu en vignettes des bordereaux → déplacer le tampon au doigt sur chaque vignette (zones interdites QR/codes/adresse) → « Imprimer » applique ; case « pour tous de ce type » ; galerie dans Paramètres avec le même éditeur ; **« Créé par vrm.center » centré juste AU-DESSUS du QR code** (visible même sous le scotch), sinon dessous ; QR toujours décodable ; bouton « Imprimer » qui ne fait plus bouger la ligne ; feuille « Bordereau prêt » refaite sans émoji (aperçu, « Imprimer » ouvre directement le partage iOS) | PR en CI |
| `claude/ebay-achats-refonte` #1212 | « Améliore eBay, c'est de la merde » : partie eBay d'Achats en 3 blocs lisibles (Chercher · Mes recherches · Nouvelles annonces), plus de titres doublés ni « GESTION », paragraphe technique « Les données » replié | passe d'audits en cours |
| `claude/argent-mieux` #1216 | Argent illisible (blanc sur clair, « Copier ») ; **mur de texte « deux prix chez Vinted » à regrouper en une ligne** ; sections sur fond bleu en cartes ; vérifier (lecture seule) ce que sont les « deux prix » — si c'est la protection acheteur, proposer à Julien de trancher (ne pas changer la règle sans lui) | en cours |
| `claude/factures-mieux` | e-mail de facture en **une seule langue** (celle de l'acheteur si sûre, sinon français), sobre, mentions légales gardées ; PDF propre ; feuille « Facture » simple ; **« Facture envoyée » → pastille compacte « Facturée » sur la ligne** ; **reçus d'achat au modèle validé par Julien** (bandeau, montant payé en grand, article / port / frais Vinted, vendeur, paiement, date, n° de transaction ; « — » si inconnu) ; **accents dans les PDF** (« Reçu », « déductible ») ; montants d'achat au format français (« 11,95 € », pas « 11.95 ») dans le rapport comptable | en cours |
| `claude/stock-mieux` | « Tu peux faire tellement mieux » : **N° lisibles en grand dans chaque case** (plus de « N… »), cases vides discrètes sans « + » partout, en-tête de meuble lisible, recherche qui allume la case ; comparer « liste d'abord + mini-plan » vs « étagère réaliste » | commencé |
| `claude/photo-identite-sites` | « Quand je poste la paire sur Leboncoin et Vinted sans passer par VRM, VRM la reconnaît parce que **le CODE de la photo est exactement le même** » (pas la ressemblance). Les sites réencodent les photos ⇒ **validé par Julien** : calculer le SHA-256 du **fichier d'origine au moment du téléversement** (Chrome + extension) ⇒ même N° automatiquement ; limite : pas depuis les applis mobiles ; même photo sur deux N° ⇒ rien ; photo réutilisée par ≥ 3 paires ⇒ ignorée | commencé ; version 5.401 réservée |
| `claude/vitesse-moteur` | calculs dérivés UNE fois par version des données, hors du rendu (moteur `Comptabilite` rendu 20–40 fois) ; Web Worker si utile ; chiffres identiques (contrôle) ; mesurer aussi à ~2 200 ventes | commencé |
| `claude/derniers-rouges` #1215 | `audit-vendeur-generaliste` / `vocabulaire-article` (mots « paire, semelle, pointure » montrés aux vendeurs qui ne font pas de sneakers) ; `notifs-redaction` ; bancs annonces-actions, chiffres-coherents, statut-colis, navigation-tache, budget-vitesse ; part 2 des bancs qui dépasse 45 min | PR ouverte |
| `claude/traduction-restes` #1191 | extension traduite (`_locales`), `motsVendeur` par langue, textes hors `tr()`, centre d'aide « Mon abonnement » | en pause depuis midi |
| `claude/extension-robuste` #1186 | revue robustesse extension (points 27–123 : `postMessage('*')`, verrous, compteurs, hôtes photo, popup encadrable) | en pause |
| `claude/serveur-robuste` #1189 | revue robustesse serveur (M50 contrainte même compte chez deux vendeurs — migration à écrire, pas appliquer —, H14 verrou du cron, H18 webhooks, H19 double checkout, B141) + sécurité (liens publics : expiration serveur, limite de débit) | en pause |

---

## 4. EN FILE — validé par Julien, PAS COMMENCÉ

(missions détaillées, prêtes à donner telles quelles à un agent : `docs/passation/file-attente-16nov/*.md`, avec le brief commun `00-brief-commun.md` — remplacer ses chemins de scratchpad par ceux de la nouvelle session)

- **Anti-bug** : tests WebKit/iPhone bloquants dans la CI ; vérification automatique de vrm.center après
  chaque mise en ligne (pas de retour arrière automatique : geste à confirmer) ; journal des plantages
  (il n'a rien reçu depuis le 12 nov. — la collecte des mesures marche, vérifier les plantages/écrans
  bloqués) ; rechargement propre après une nouvelle version (jamais au milieu d'une saisie).
- **Scanner un bordereau d'ACHAT** ⇒ ce qu'il y a dans le colis (par n° de suivi, jamais par ressemblance) ;
  colis inconnu ⇒ « Relier à un achat ».
- **Satisfaction des clients (vendeurs)** : contrôle de nuit iPhone de tous les écrans ; « Signaler un
  problème » avec suivi (reçu / en cours / corrigé + notification) ; mesure ANONYME et minimale des
  10 premières minutes (« sans abus », coupable, ≥ 5 personnes avant affichage) ; récap hebdomadaire clair.
- **Vidéos d'aide améliorées** (chaque « ? » ouvre la bonne vidéo, refaites sur les écrans actuels, ≤ 30 s,
  sous-titrées, réponse de 2 lignes au-dessus, recherche).
- **Abonnement sans surprise** : rappel 3 jours avant prélèvement et fin d'essai, reçu mensuel (Stripe lu).
- **Reprendre là où j'étais** (12 h, lien/notification prioritaire).
- **Alerte du soir** : une fois, colis à poster avant date limite (retenu le 11 oct.).
- **Impression directe** sur ordinateur (« Imprimer les N », réglages déjà choisis).
- **Partage du stock avec un aidant** (lien lecture seule qui expire, aucun prix ni pseudo).
- **Recherche tolérante** (fautes, sans accent, N° exact d'abord ; lecture seule).
- **Mode sombre automatique** (suit l'iPhone ; choix manuel prioritaire) ; **retirer l'interrupteur
  « Mode sombre » en doublon d'« Apparence »** ; **ranger « Affichage » (17 lignes)** — décidés.
- **Doublons sur un même compte** (même N° ou même photo, par identité).
- **Confiance** : alerte de connexion inhabituelle (e-mail + « Appareils connectés ») ; page publique
  « État de VRM » ; calendrier fiscal (selon SON régime, jamais deviné).
- **Aide à la décision** : contre-offre automatique (éteinte par défaut, au prix mini, mêmes garde-fous) ;
  argent qui dort par meuble ; rentabilité réelle par modèle ; délai d'envoi par compte.
- **Widget iPhone** : seulement quand une app native existera (décision de Julien).
- **Découpe d'App.jsx** (outil prêt : `claude/decoupe-app`, répétition −29,8 % du JS au premier
  chargement) : à rejouer sur `main` actuel, EN DERNIER, seule.
- **Vestiaire relit ses 1 000 annonces 5 à 6 fois à l'ouverture** (vu par un banc de volume) : un lecteur partagé.
- Plaque N° 40×22 px sur ordinateur dans Annonces : à trancher (cible trop petite ?).

---

## 5. REFUSÉ par Julien (ne jamais reproposer)

Tout ce qui est dans `CLAUDE.md` §3, plus, du 11 au 16 nov. :
pubs dans l'app (« pas de pub ») ; rapprochement bancaire ; vitrine publique (refusée le 11 ; l'autre
agent en a refait une le 15 — demander avant d'y toucher) ; raccourci « où est le N° » ; cadre photo ;
virement porte-monnaie ; calendrier de l'argent ; annonces à améliorer ; mode équipe complet ; apps
natives (pour l'instant) ; accès comptable ; brocante hors réseau ; historique de prix ; envoi groupé ;
recherche vocale « où est ma paire » ; fiche IA ; calendrier de baisses auto ; IA pour les messages ;
Etsy/Beebs ; modèles de message multiples (favoris) ; réponses prêtes Leboncoin ; repos entre comptes ;
suivi Colissimo/UPS par clé ; la liste d'idées du 16 nov. (argent versé, histoire de la paire, emballages,
raccourcis clavier, grand texte, mode vacances programmé, impôts annuels, Siri, contrôle bonne paire,
photo du colis fermé, points relais ouverts) sauf « doublons sur un même compte » ; aide sur place
(existe déjà : vidéos) ; « Où vendre cette paire », budget d'achat, notes privées, mode aide à distance,
avis négatifs reliés : non retenus.

---

## 6. Décisions de Julien du 16 nov. à respecter

- **Pas de glissement entre onglets** ; **Achats dans la barre du bas** (fait, #1201).
- **Stock** : case en surbrillance tant qu'une paire vendue n'est pas sortie, **pas de pop-up, pas de bouton
  dans la fiche** ; **sortie automatique à l'expédition prouvée** ; la carte « paire à sortir » de Ma journée
  est **supprimée**.
- **Ventes** : plus de « ⋯ » sur les lignes, toucher = fiche ; « Prix d'achat » / « Relier » toujours
  visibles quand ils manquent (petite puce).
- **Relier un achat** : fiable sinon inutile (exclusif, couleur/taille/modèle) ; achats en retour/litige
  exclus ; bénéfice + reçu tout de suite après ; « Délier » + « Reçu » dans la fiche ; puce aussi dans Annonces.
- **Reçu d'achat** : le modèle de la feuille « Reçu d'achat » (bandeau, montant, détail, paiement) partout.
- **Tampon** « Créé par vrm.center » centré **au-dessus du QR** ; tampons réglables visuellement à l'impression.
- **Le fond bleu dégradé plaît à Julien** : garder l'aspect, n'alléger le flou que là où il ne se voit pas.
- **Retours** imprimables avec les ventes mais jamais confondus avec une vente.
- **Pas de suivi Colissimo/UPS par clé.** **Pas de pub.**
- **Règle de fusion** : aucun rouge nouveau par rapport à `main` (assouplie le 16 nov. à midi).

---

## 7. Gestes de Julien (lui seul peut les faire)

- **Installer l'extension** une fois les PR d'extension fusionnées (5.400 attendue ; remplacer le dossier,
  ⟳ dans CHAQUE Chrome ; Orion : son zip).
- Sur vinted.fr : ouvrir une fois la page « Vendre » (catalogue pour « Créer sur Vinted ») ; changer un prix
  à la main sur Vestiaire puis rouvrir « Mes articles » ; changer UN prix à la main sur leboncoin.fr ;
  ouvrir « Mes commandes » Vestiaire ; déposer une annonce Leboncoin hors chaussures.
- **Migrations à coller** dans Supabase (SQL Editor) : 016 (équipe), 029, 038 (vraie base étape 1), 040,
  042, **043 en entier (modifiée le 16 nov.)** ; vérifier 027, 028, 030.
- Supprimer de Vercel les variables `LAPOSTE_OKAPI_KEY`, `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET`.
- Stripe : prix `vrm_mensuel` 16,99 €, `STRIPE_SECRET_KEY`, mode réel ; remplir `public/legal/editeur.js`
  et `src/contact.js` ; faire relire CGV.
- Facture Pro : compléter « Ma facture » ; `RELANCES_SMTP_*` + `RELANCES_EXPEDITEUR`.
- Recoller `scripts/gmail-forwarder.gs` + `EMAIL_INBOUND_SECRET` ; recoller le Worker Cloudflare.
- Supabase Auth : Site URL, Redirect URLs, SMTP, confirmation d'e-mail, Discord.
- Les e-mails GitHub « PR run failed » viennent des PR de Claude (rouges hérités) : à ignorer.
- Accepter les demandes « Supabase : Execute sql » des agents (lecture seule).
- Faire relire les traductions par des natifs avant l'ouverture hors de France.
- Retirer la branche parasite `claude/agent2-integ-wip`.

---

## 8. Mesures et chiffres utiles

- Contrôles de `main` : 69 audits rouges le matin du 16 → 3 le soir (#1196) ; bancs principaux encore
  rouges : nouveau-vendeur, colis-retirer-propre, annonces-actions, chiffres-coherents, statut-colis,
  navigation-tache, budget-vitesse ; la part 2 des bancs dépasse son délai de 45 min (toujours « cancelled »).
- iPhone de Julien (`mesures_jour_*`, touchers sur Ventes) : le 15, aucun > 650 ms ; le 16 au matin,
  7/9 entre 1,25 et 4 s → corrigé par #1198/#1208 ; **à vérifier dans `mesures_jour_2026-11-17`**.
- Vitesse à 20 000 ventes (téléphone simulé) : Ma journée 27,6 → 24,9 s ; Ventes 30,6 → 29,9 s (#1200) ;
  objectif < 2 s non atteint ; levier : calculs hors du rendu (lot vitesse-moteur).
- Liaison des achats (#1199) : 986 → 9 propositions, 161 → 0 ventes multi-proposées, 4 → 0 fausses.

---

## 9. Où est le détail

Chaque lot a son récit `docs/passation/2026-11-16-<lot>.md` (ou `2026-11-15-*` pour l'autre agent),
avec « ÉTAT À LA REPRISE ». Les missions complètes des lots en file étaient dans le scratchpad de la session
(`file/*.md`) : leur contenu est résumé au §4 ci-dessus.
