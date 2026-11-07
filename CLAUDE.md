# VRM — dossier de passation

**Lis ce fichier en entier avant de coder. Il est court exprès : il doit rester sous 60 Ko** (`wc -c CLAUDE.md` ; au-delà, déplacer tel quel le détail le plus ancien de §9 dans `docs/passation/`).
Le 31 octobre 2026 il pesait 1,36 Mo et étouffait chaque session : tout l'historique
détaillé (chaque chantier, chaque mesure, chaque revue, chaque preuve) a été
**déplacé tel quel**, sans rien réécrire, dans les fichiers ci-dessous. Ici ne restent
que les règles, les décisions et l'état actuel. Avant de toucher un sujet, **ouvre son
historique** (`grep` y marche très bien) : c'est là qu'est le « pourquoi ».

## Où est l'historique

| sujet | fichier |
|---|---|
| eBay (connexion, publication, règle d'offre, planificateur, agent, après-vente, multi-sites) | `docs/passation/historique-ebay.md` |
| Leboncoin (publication, sans booster, comptes, « à retirer », pause, suppression) | `docs/passation/historique-leboncoin.md` |
| Vestiaire Collective | `docs/passation/historique-vestiaire.md` |
| Vinted et l'extension (capture, pont, session, republication, navigateurs, versions) | `docs/passation/historique-vinted-extension.md` |
| Favoris, messages, offres | `docs/passation/historique-favoris-messages.md` |
| Colis, bordereaux, codes de retrait, suivi transporteur | `docs/passation/historique-colis-retraits.md` |
| Compta, URSSAF, bénéfice, DAC7, abonnement Stripe, CGV | `docs/passation/historique-compta-urssaf-abonnement.md` |
| Numéros de rangement (doublons, migration 013, panne de `main`, 017) | `docs/passation/historique-numeros.md` |
| Sécurité, base, routes serveur, emails, pannes, notifications, CSP, MFA | `docs/passation/historique-securite-base-serveur.md` |
| Interface, écrans, Stock 3D, photos, Ma journée, vitesse | `docs/passation/historique-interface-stock.md` |
| Communauté, Discord, mode équipe (016), Organisation | `docs/passation/historique-communaute-equipe.md` |
| Le reste | `docs/passation/historique-divers.md` |
| Les §1-4 et §6 complets d'avant l'allègement | `docs/passation/historique-regles-de-base.md` |
| Les sessions de juillet à septembre, en entier | `docs/journal-2026.md` |
| Passations datées (20 oct. → 30 oct.) | `docs/passation/*.md`, `docs/passation/README.md` |

⚠️ Le classement par thème a été fait automatiquement (mots du titre) : un paragraphe
peut être rangé dans un thème voisin. **Cherche dans tous les `historique-*.md`.**

⚠️ **Règle pour la suite** : une nouvelle session écrit son récit détaillé dans
l'historique du thème (ou un `docs/passation/AAAA-MM-JJ-*.md`) et n'ajoute ici
qu'**une ligne** dans « État actuel » (date · décision · où est le détail · geste de
Julien). Ne recolle jamais un long récit dans ce fichier.

---

## 1. Le projet en dix lignes

Julien revend des sneakers d'occasion sur Vinted (plusieurs comptes). **VRM** est
son outil de gestion : annonces, ventes, achats, colis, numéros de rangement,
comptabilité. Il n'est **pas développeur** et pilote tout par des sessions Claude.

| pièce | où | quoi |
|---|---|---|
| **App** | `src/App.jsx` — un seul fichier, ~22 000 lignes | React + Vite, styles en ligne |
| **Extension Chrome** | `vinted-sync-extension/` | capte les données Vinted depuis SON navigateur |
| **Serverless** | `api/*.js` | emails entrants, widget iPhone, notifications push, IA |
| **Données** | Supabase `app_data` (clé-valeur JSONB) + `vinted_accounts` | pas de vrai schéma relationnel |
| **Prod** | https://vrm.center (Vercel, auto-déployé sur `main`) | |
| **Dépôt** | `julatace/cancale-v67`, **PUBLIC** ⚠️ | une branche `claude/…` par session, fusionnée par PR (en cours : `claude/chantiers-2nov`) |

---

## 2. Les règles de Julien — permanentes, jamais à re-négocier

1. **Pousse à chaque modification.** Aucun travail ne reste en local : une session
   qui perd son conteneur perd tout, et la suivante le refait à l'envers.
   **Les branches d'agents aussi**, à chaque commit (7 chantiers perdus le 2 nov.).
2. **Déploie toi-même** (autorisation donnée le 5 septembre) : ouvrir une PR
   depuis la branche et la merger. Ne plus lui demander.
3. **N'invente jamais de données.** Aucune ligne de test dans la base de
   production. Les bancs servent des copies.
4. **« Même avec 50 articles identiques, tu ne dois pas pouvoir te tromper »** —
   aucun rapprochement par ressemblance (titre, marque, taille). Voir §5.
5. **Il saisit les prix d'achat lui-même.** Ne pas les deviner.
6. **L'extension se livre en zip qui se dézippe en UN dossier.**
7. **Il n'est pas développeur** : une alerte qui ne dit pas quoi faire ne sert à
   rien ; un chiffre qu'on ne peut pas vérifier est invendable.
8. **Sur eBay, c'est l'acheteur qui paie le bordereau** (11 octobre, mot pour
   mot : « pour ebay on est d'accord c'est l'acheteur qui paye le bordereau »).
   Son compte est en livraison gérée par eBay : l'acheteur paie le port à eBay,
   eBay fournit l'étiquette prépayée. VRM n'achète **jamais** une étiquette avec
   son argent, ne pose **jamais** « livraison gratuite », et le port n'est ni une
   recette ni une charge dans sa compta. L'achat d'étiquettes chez un agrégateur
   (chantier K14 de l'agent eBay) est **gelé** pour lui.
9. **Aucune fonction payante à l'usage ne tourne sur SA clé pour les autres**
   (11 octobre : « trouve une solution sans IA ou avec leur clé API mais pas la
   mienne »). Traduction, détourage, IA, lecture d'image : d'abord **sans IA**
   (ce que le navigateur fait seul : reconnaissance vocale, traducteur intégré à
   Chrome, modèle local dans la page) ; sinon **la clé du vendeur**, collée par
   lui, rangée côté serveur, jamais relue par le navigateur. Une fonction qui
   n'a ni l'un ni l'autre se tait et dit pourquoi — jamais un repli sur sa clé.

---

## 3. Ce qui est refusé — et les nuances qui comptent

Chaque refus a une raison technique ou une décision de Julien. Détail complet :
`docs/passation/historique-regles-de-base.md` (§3 d'origine).

| sujet | état aujourd'hui |
|---|---|
| **Republication** | Refusée : une republication **à l'aveugle** (délais aléatoires sans qu'il la lance). **Permis et livré** : l'atelier « Republier » (Annonces → Actions) — C'EST LUI qui choisit les paires, l'ordre, l'espacement (fixe ou aléatoire, son choix) et qui lance. Depuis le 28 oct. (5.254, sa décision) l'ordre est **enregistrer dans le coffre → supprimer → brouillon → mise en ligne** ; ⚠️ **ne PAS remettre « recréer puis supprimer » sur ce chemin** (son choix, en connaissance du risque). Depuis le 29 oct. (5.277), tout part **de l'onglet vinted.fr** comme Vintex (`vintedPage`, aucun `Authorization`), sans onglet Vinted rien n'est envoyé ; pauses mesurées ; mise en ligne planifiée +1–3 min (5.279) ; `REPUB_PAR_JOUR` 50. ⚠️ `completionSecoursPhotos`, `photosNeuvesBrouillon`, `secoursTaille` sont **RETIRÉS, ne pas les remettre** (un refus s'arrête et dit le geste). ⚠️ Le réglage photo **par annonce** et « Varier » sont retirés (un réglage pour toutes, une photo affichée par annonce) : ne pas les remettre. **Ne pas re-refuser l'atelier** sur la ligne « refusé ». |
| **Accepter une offre automatiquement — Vinted** | Retiré le 5 oct., puis **RÉTABLI le 27 oct. sur sa décision** : moteur `autoAccepterOffres`, **éteint par défaut**, offre ≥ prix mini posé à côté du N° ; refus auto sous un seuil `refuse` avec SON message (vide par défaut) ; délai **aléatoire** 3–20 min (5.273). ⚠️ Il a **démenti** la théorie « l'acceptation auto a fait bloquer vanessa5723 » : **ne jamais re-régler l'espacement en fixe ni ré-interdire le moteur sur cette théorie**. Garde-fous jamais retirés : `garde`, plafond horaire, pause 429/403, une requête à la fois, chaque offre une fois (`audit-moteur-offres.cjs`). |
| **Accepter une offre — eBay** | Permis sous UNE forme : le seuil natif d'eBay (`BestOfferAutoAcceptPrice`) posé sur son clic, avec confirmation « une offre acceptée vend la paire ». C'est eBay qui accepte, VRM n'appelle aucune route d'acceptation (`audit-offres-auto.cjs` §5). |
| **Piloter souris / clavier** | Refusé : même requête pour Vinted, et `isTrusted:false` ajoute une preuve d'automatisation. |
| **Modifier les photos pour tromper / changer de compte** | Refusé : Vinted relie les comptes par appareil, navigateur, adresse, paiement. (Les réglages photo de Republier servent la présentation, pas à tromper.) |
| **Supprimer une annonce Vinted automatiquement** | Refusé (irréversible). Supprimer passe toujours par son clic (Republier, ou Leboncoin « Supprimer », confirmé). |
| **Messages aux favoris** | **Permis sur sa demande** (24 oct., refait « comme Vintex » le 29 oct., 5.280-5.281) : sur son clic, file serveur à autorisation unique, offre Vinted réelle, rythme « comme Vintex ». ⚠️ Le plafond de 10 messages/60 min de la file est **RETIRÉ (sa décision)** ; reste le plafond d'actions de l'extension. Leboncoin : il ne dit pas QUI a mis en favori, VRM n'écrit à personne. |
| **Plafond d'actions** | ⚠️⚠️ **50 actions/heure/compte (sa décision du 29 oct., « comme Vintex »)** ; `RESERVE_GESTES` = 5 ⇒ les commandes de l'app et les gestes automatiques s'arrêtent à 45 ; une republication réserve ses 3 gestes d'un coup. **Ne PAS le redescendre à 20 sans qu'il le demande.** Budget de LECTURE séparé (20/h). |
| **Double vérification par SMS** | ⛔ Refusée le 22 oct. : **payant** (75 $/mois + chaque SMS). La méthode reste l'app d'authentification (TOTP, gratuite) + un second appareil de secours. Clés d'accès (passkey) : expérimentales chez Supabase, ne pas livrer. Jamais d'invitation forcée au démarrage (retirée à sa demande, 21 oct.). |
| **Téléphone (vérification par SMS à l'inscription)** | Pas fait exprès (§2.9, payant sur sa clé). |
| **International** | ⛔ **28 oct. : VRM RESTE SUR LA FRANCE** (pas de traduction, dollars, compta étrangère, Depop/Poshmark/Mercari). Les comptes eBay.co.uk/.com déjà gérés restent, sans plus ; l'argent reste en euros (une commande en GBP/USD est écartée et dite, jamais convertie). |
| **Détourage** | Vestiaire Collective SEUL (sa décision du 17 oct. : « pas du tout pour Leboncoin, ne le mets pas dans les paramètres »). La carte « Ta clé Photoroom » vit sur l'écran Vestiaire, **pas dans Paramètres** (`detourage-reglage.cjs` le refuse). Studio photo : détourage local gratuit (U²-Net, licences vérifiées). |
| **Palette** | Violet **REFUSÉ** ; Vitrine (31 oct.) + **Apple (2 nov., sa demande)** : blanc, encre, accent **bleu Apple** `#0071E3`/`#0A84FF` rare, police système (SF Pro), chiffres alignés sans chasse fixe (`src/themeMineral.js`, `src/styles-vitrine.css`). |
| **Ventes masquées** | ⚠️ 29 oct. : **on ne peut plus masquer une vente** (« on ne doit plus pouvoir les masquer ») ; `vinted_sales_hidden` n'est plus lu nulle part. Les ACHATS masqués restent. |
| **Saisie « N° + Entrée »** | Retirée de Ventes, Colis, Annonces, Leboncoin, eBay (29 oct.) ; la loupe « Tout sur le N° » et la saisie du Stock restent. |
| **Bloc « offres à trancher » des emails dans Messages** | Retiré le 24 oct. sur sa demande (moyennes par modèle et liens génériques compris). Ne pas le rétablir. Les offres dans les conversations restent. |
| **Organisation** | Retirée du menu le 29 oct. (inutilisée) ; l'écran reste joignable par Réglages → Stock et rangement → Organisation. |

**Refusé par Julien le 11 octobre (son choix) — ne pas reproposer** : « imprimer la
journée » triée par emplacement ; étiquettes de carton avec QR ; prix conseillé à la
mise en ligne ; alerte « achat jamais arrivé » ; alerte « argent bloqué » ; rappel des
messages sans réponse depuis 24 h ; rappel des évaluations à laisser ; sauvegarde
hebdomadaire envoyée chez lui ; widget iPhone enrichi ; badge « bonne affaire » ;
saisonnalité ; photo d'étiquette → fiche ; acheteurs fidèles.

**Retenu le 11 octobre (à construire, plusieurs faits depuis — voir « État actuel »)** :
prix d'achat au numérotage · double vente app fermée · rappel URSSAF · fiche
« republier » · app plus rapide · page « tout va bien ? » · codes de retrait hors ligne
· rappel la veille au soir · fiche prête à l'arrivée d'un achat · plan des paires qui
dorment · bénéfice réel · récap comptable · réponses rapides · double vérification ·
achats à vérifier avant la date limite · retour → stock · favoris sans vente · boost
rentable ? · compte qui vend le mieux · ce qui part vite · studio photo + détourage ·
saisie vocale · traduction des messages · mode équipe — les fonctions payantes selon §2.9.

**Ce qui EST autorisé et automatique** : générer un bordereau et récupérer son PDF, et
toute **lecture** sur ses propres données.

**Garde-fous de l'extension, à ne jamais retirer** : agir uniquement au nom du **compte
connecté dans l'onglet** (`garde` / `gardeStricte`), plafond de **50 actions/heure par
compte**, plafond par visite, requêtes Vinted **une par une** (`requeteVinted`,
`avecVinted`), pause posée sur un 429/403 (`vrmPauseVinted`).

---
## 4. Les lois du code — chacune a coûté cher

1. **Une liste vide n'est jamais une réponse.** Session expirée, page pas ouverte,
   appel refusé → `[]`, pas une erreur.
2. **Une capture partielle ne doit jamais écraser une capture complète**
   (`listePlusRiche`). Le compteur se lit **en scalaire** (`select=n:data->>nItems`).
3. **`updated_at` ment** : la table n'a aucun trigger, la colonne garde la date de
   **création**. Utiliser `harvestTs(row)` (lit `data.capturedAt`). Toute écriture
   passe par `withOwner`, qui estampille `updated_at`.
4. **Jamais `select=data` sur une ligne lourde** (bordereaux avec PDF, commandes).
   Projeter les scalaires. Un `select=data` sur le widget a crevé le quota d'égress
   (5,7 Go). Quand tu corriges ça côté app, **vérifie aussitôt les `api/*.js`** :
   ils ont leur propre code de lecture.
5. **Supabase plafonne une réponse à 1 000 lignes sans le dire.** Utiliser
   `lireTout(query)` (pagination par en-tête `Range`).
6. **Piège TDZ** : un `useMemo` s'exécute immédiatement — il doit être placé
   **après** tout ce qu'il lit, sinon écran blanc au premier rendu.
7. **`( {/* … */} )` n'est pas un commentaire, c'est un objet vide** → React
   error #31, écran en erreur.
8. **Un helper n'est utilisable que dans la fonction où il est déclaré**
   (`background.js` en particulier). `node --check` ne le voit pas.
9. **Dans un service worker MV3, aucun tampon ne survit à 30 s en variable de
   module.** Chrome tue le worker. Utiliser `chrome.storage.local`.
10. **Une fonction serverless n'est vérifiée que si un banc l'EXÉCUTE.**
    `npm run build` ne compile pas `api/`.
11. **Une découpe par numéros de ligne se vérifie sur ce qui RESTE.** Deux écrans
    entiers ont disparu comme ça, sans qu'aucune erreur soit levée.
    ⚠️ **Et un composant jamais rendu ne lève rien non plus** (le tiroir `Nav`, retiré le
    7 sept. : récit dans `historique-regles-de-base.md`). **Avant de « corriger » une
    navigation, vérifier qu'elle est rendue** (`grep -c '<Nom'`) et compter les écrans
    montés (`tab===`) avant ET après la coupe.
12. **`-0 < 0` est faux en JavaScript** (calcul de délais).

---

## 5. Les règles métier intouchables

Chaque règle ci-dessous a son récit (mesures, défauts, preuves) dans l'historique du
thème. Ce qui suit est ce qu'il faut savoir pour ne rien casser.

### L'identité d'une paire
**Jamais par titre, jamais par ressemblance.** Dans l'ordre :
1. **identifiant d'annonce Vinted** — `transaction_id` → détail de transaction →
   `item_id` (`identiteAnnonce`) ;
2. **photo** (`entryKeyByPhoto` : fichier exact, puis dossier **non ambigu** ;
   `jumellesParPhoto` : deux fiches au même fichier = la même paire) ;
3. **n° de transaction**, **n° de suivi**, **code de retrait**, **SKU `VRM-{n°}`**
   (eBay), **référence VRM / lien posé à la main** (Leboncoin) — des identités elles aussi.

Mesuré : 22 % des ventes portent un titre en double ; le titre désignait la
**mauvaise** annonce dans des cas réels. **Mieux vaut un blanc qu'un faux** — un
numéro faux ne se voit pas, il envoie la mauvaise chaussure.
`scripts/audit-identite.cjs` pose 50 paires identiques et vérifie qu'aucune règle
n'en désigne une. Une proposition (suggestion de paire, d'achat) peut utiliser la
ressemblance ; **c'est toujours SON clic qui relie** (et une marque différente ou
aucun mot de modèle commun écarte la suggestion).

- **« Vendue » se PROUVE** : transaction avec un état de commande (`status_title`
  non vide) qui ne la fait pas revenir (`PAS_UNE_VENTE` : annulée, retour,
  suspendue, paiement échoué), ou bordereau `label_{tx}` d'une vente lue du même
  compte. Une conversation (statut 1, titre vide) n'est PAS une vente. L'état le plus
  frais gagne (liste des ventes relue après la transaction). Jamais déduite d'une
  ABSENCE (une annonce en pause n'est pas vendue). Bloc partagé
  `<preuve-vente-regle>`, même texte dans l'app et l'extension.
- **« En ligne »** : la lecture COMPLÈTE la plus récente du dressing fait foi
  (`<enligne-regle>`, app = extension) ; plus de 24 h ⇒ « à confirmer » (hors totaux,
  rien supprimé) ; masquée par Vinted (`is_hidden`) = toujours chez lui (comptée
  parmi les paires présentes, `annoncesPresentes`), pas « en ligne ».

### Les numéros de rangement
- **Un numéro n'est JAMAIS réattribué** (il est écrit sur un carton réel). Le pool
  est append-only ; `freedNums` a été supprimé — **ne pas le réintroduire**.
- Le compteur qui monte haut est **normal** (paires passées). **Ne pas « corriger »**.
  « Renuméroter à la suite » n'est plus proposé nulle part.
- `prochainLibre` part du plus haut, **jamais d'un trou** (un trou peut être écrit sur
  un carton).
- **Rien ne change un numéro tout seul**, sauf : (a) une annonce **sans** numéro en
  reçoit un ; (b) ⚠️ **les doublons se règlent seuls (décision de Julien du
  20 oct.)** : `doublonsAReattribuer` — une vente à poster garde le N°, sinon le N°
  saisi à la main puis le plus ancien ; garage ou vente annulée en jeu ⇒ rien n'est
  deviné ; « pas su » ne change rien ; la liste « nouveaux numéros à écrire sur tes
  cartons » reste jusqu'à « C'est écrit » ; (c) une paire **republiée** garde le N°
  de l'ancienne (`src/repriseNumero.js`, par identité).
- **Deux paires présentes sous le même numéro** est le seul risque irréversible :
  c'est le seul endroit où le **rouge** est justifié.
- **Numéros à lettres** (B125…) : une identité `cleNum` (majuscules, sans espace,
  « 007 » = « 7 »), la même dans l'app et l'extension. « B » est l'archive (013) :
  jamais une série de nouveaux numéros.
- ⚠️⚠️ **Remise à zéro du 11 octobre (migration 013, appliquée)** : tout ce qui a été
  mis en ligne avant le 9 oct. est passé en « B + l'ancien », les nouvelles annonces
  repartent de 1. **Un ancien numéro ne se redonne JAMAIS** (ni « B230 » ni « 230 »).
  Un « 230 » écrit AVANT la coupure (SKU eBay, référence Leboncoin) désigne l'ANCIENNE
  paire (`numeroExterne`, carte PAR ANNONCE `ebayAnnonces`/`lbcAnnonces`). Le marqueur
  `main.vrm_numerotation` n'est écrit que par le serveur. Garde-fous en base :
  `vrm_pool_retreci`, `vrm_numeros_perimes`, `vrm_fiche_perdue`…
- ⚠️ **Aucune migration de données ne s'arme sur un drapeau du `localStorage`** (il ne
  survit ni à une déconnexion ni à un autre appareil) : elle appartient au serveur
  (SQL), une fois, avec une sauvegarde. (Trois migrations d'août ont renuméroté des
  cartons à la reconnexion — retirées.)
- **Le chargement FUSIONNE** les numéros de l'appareil et du nuage
  (`fusionNumerosAuChargement`, 18 oct.) : la panne de `main` du 11 au 18 oct. avait
  fait renuméroter 36 paires. Après le bloc « Recharger », les fiches ne fusionnent pas
  (`vrm_recharge_sans_fiches`).
- Impression : tamponner un N° « à vérifier sur son carton » ou porté par deux fiches
  DEMANDE d'abord (`confirmerNumerosAVerifier`).

### Les chiffres
- **Le chiffre faux est la porte pour le corriger** (« Coût d'achat · 1/184
  renseigné » ouvre la saisie en série).
- **Un total partiel qui se présente comme complet est pire qu'un total absent** : on
  somme ce qu'on connaît et on affiche la couverture à côté (« au moins », « sur N »),
  le manque NOMMÉ. Vaut pour le bénéfice, l'argent en attente, l'URSSAF, les colis.
- **« Pas su » ne vaut pas « oui », et « rien lu » ne vaut pas « rien »** : une lecture
  ratée rend `null` (jamais `[]` ni `0`) et l'écran dit « — » avec la raison. Trois
  états partout : `undefined` en cours · `null` pas su · valeur lue.
- **Une seule règle par notion, un seul propriétaire (§11)** : un écran publie
  (`vinted_nums_physiques`, `vinted_urssaf_mois`, `vrm_benefice_jours`,
  `vrm_colis_aposter`, `vrm_colis_retirer`, `widget_stats`…), les autres consomment.
  Le serveur qui a besoin d'une règle de l'app en porte une **copie refabriquée par
  script** (ex. `api/_lib/ventes-regle.js` par `audit-bilan-semaine.cjs --recopie`,
  `api/_lib/urssaf-regle.js`) — jamais modifiée à la main.
- **La phrase qui explique un chiffre vient de la même source que lui.**
- **Vendu ≠ reçu** : VENDU = `ventesFaites` (date de vente, toutes plateformes) ;
  REÇU = `ventesDeclarables` (date de VERSEMENT). Un `0,00 €` qui veut dire « on ne
  sait pas » s'écrit `—`. « Au moins 0,00 € » ne se dit jamais.
- ⚠️ **LE CA DÉCLARÉ EST DATÉ AU JOUR DU VERSEMENT** (redemandé par Julien le
  3 oct.) : transaction « Commande finalisée » (450). Sans date de versement, une
  vente n'est dans AUCUN mois (« à dater », dite). Leboncoin : date de vente (relevée
  par l'extension ou datée à la main, `vrm_lbc_dates` ; une date lue gagne toujours).
  eBay : « l'argent que tu reçois » = `totalDueSeller − totalMarketplaceFee`
  (`montantRecuEbay`), frais inconnus ou autre devise ⇒ écartée et dite.
- Bilan et CA déclaré = **les comptes sélectionnés** ; un compte exclu n'entre dans
  aucun total. **Ne plus lui parler des comptes retirés** (sa demande).
- Le registre « J'ai déclaré ce mois » (`vrm_urssaf_declare`) n'est écrit que sur
  SON clic ; une vente déclarée compte dans le mois de sa déclaration, plus ailleurs.
- **Jamais « encaissé »** à l'écran (l'URSSAF parle de recettes encaissées, l'app ne
  les connaît pas tous) — `audit-urssaf` l'interdit. Taux micro achat-revente par
  défaut **12,4 %** ; le régime n'est jamais deviné (`null` = pas choisi).
- Statut fiscal, seuils 2026 vérifiés (plafond 203 100 €, TVA 85 000 € / 93 500 €),
  DAC7 (30 ventes ou plus de 2 000 €) : historique compta.

### L'argent sur eBay (§2.8)
VRM n'achète **jamais** une étiquette, ne pose **jamais** « livraison gratuite »
(`livraisonDe`), et le prix envoyé est le prix vu (`prixLu`, `prixVu` relu chez eBay).

### Les emails
- **C'est l'adresse de RÉCEPTION qui décide** à quel vendeur appartient un email —
  jamais l'expéditeur, le sujet ou le corps. Le vendeur d'une adresse est celui de la
  LIGNE du registre (colonne `owner`), jamais un champ écrit par le navigateur.
- Base cloisonnée : une adresse ne vaut que **PROUVÉE** (lien envoyé à l'adresse,
  cliqué depuis la session du vendeur, `api/_lib/preuve-adresse.js`) ; le
  propriétaire de l'installation garde ses adresses déclarées. Non attribuable ⇒
  **quarantaine au propriétaire NEUTRE** (`00000000-…`), réclamable ensuite — jamais
  donné au hasard.
- **On ne jette aucun email** : ce qu'aucune règle ne reconnaît est conservé.
- Une écriture ratée ⇒ la route répond **503** (le service de réception rejoue) —
  jamais 200 sur un email pas rangé.
- Le classement d'un colis se lit **sur le SUJET d'abord** ; un retour se juge phrase
  par phrase (une condition « s'il n'est pas retiré… » ne constate rien).
- **Un colis caché est un colis perdu** : on n'écarte jamais un colis en silence ; un
  colis douteux va dans « à vérifier », visible avec son code, jamais « perdu ».

### Colis et retraits (le résumé — tout le reste : historique colis)
- « Prêt à imprimer » est porté par la ligne (`pret`) ; Colis se range sur ce qu'il
  PEUT faire (prêts · en attente · partis).
- « À expédier » : une règle (`aExpedier`, la même dans l'app, l'extension et
  `api/widget.js`) sur le champ machine `transaction_user_status`. ⚠️ Sur un ACHAT,
  `needs_action` veut dire « une action », PAS « à retirer » (« Commande livrée ! » et « non
  réclamée » le portent) : seul le statut « au point relais » (`isAtRelayStatus`) compte.
- **À retirer** = preuve d'arrivée ET aucune fin prouvée par AUCUNE identité du colis (son n°,
  le n° de SA commande, son code de retrait) ; une moitié Vinted sans identité au point d'un
  colis du transporteur est « peut-être en double », jamais comptée (`src/retraitPreuves.js`,
  `regrouperArrivees`). Un point = une carte.
- Date limite : celle de l'email du bordereau (heure de Paris) ; vente + 7 j n'est
  qu'une **estimation** (un plancher), jamais « en retard ». Règle :
  `api/_lib/limite-envoi.js`.
- Retrait : date limite et lieu LUS dans l'email (`api/_lib/retrait-colis.js`), sinon
  la garde du transporteur ; au-delà ⇒ « à vérifier ». Un retiré reste retiré
  (`api/_lib/suivi-colis.js`, par n° de suivi). La photo du code à côté d'un colis :
  mesurée impossible (aucune identité commune) — ne pas réessayer sans identité neuve.
- Le reçu d'achat dit qui achète et qu'il n'est pas la facture de Vinted ; un achat se
  relie à son reçu par SON n° de transaction seulement.

### Lectures et écritures (le résumé)
- Jamais `select=data` sur une ligne lourde (bordereaux, transactions, `main`) :
  projeter, ou lire `meta->>` (colonne remplie par un déclencheur, migration 004).
- Lire-fusionner-réécrire : **une lecture ratée n'écrit RIEN** (sinon elle efface tout
  ce qu'on n'a pas relu). Le cas qui détruit est « lecture KO, écriture OK » — c'est
  celui qu'un banc doit servir. Écritures concurrentes : comparer-et-échanger sur
  `data.rev` (`modifierDonnee`, `modifierCas`).
- L'extension n'écrit **jamais** la ligne `main` ; elle a ses lignes dédiées.
- Les effets de données ne partent qu'**après la session** (`AppCoeur` monte avec la
  session ; **ne jamais remettre un effet de données dans `App`**).
- Toute donnée synchronisée lue au montage passe par `onCloudReady` et ne remplace que
  ce qui est resté VIDE (ou au défaut).
- Base injoignable : la coque dit la panne UNE fois (`BaseInjoignable`), jamais « tout
  est à jour ».

### Le panneau « Sécurité des données » (Réglages)
Seul endroit où le vocabulaire technique est assumé (gestes qui n'appartiennent qu'à
lui) : ne pas le « simplifier ». Une sonde qui n'a pas répondu n'est **pas** une
alerte, ni un feu vert.

### Le mode équipe : migration 016 — résumé (détail : historique communauté-équipe)
L'aide invité voit les colis à expédier et à retirer, les codes de retrait, imprime
les bordereaux, rien d'autre (liste blanche d'`id`, projection sans montant, en-tête
`x-vrm-equipe` exigé). ⚠️ Appliquer la 016 **met en service une écriture du membre
hors RLS** : la route Organisation (`/api/compte?mode=operations`, clé de service)
réécrit `vrm_operations_v1` du vendeur quand `vrm_equipe_lister` rend `membre_de`.
Bornes tenues par `src/operations/metier.js` : `mission.etat` et `mission.etape`
seulement, sur SES missions, jamais valider ; accès du vendeur fermé ⇒ rien.
`audit-equipe-ecriture-membre.cjs` exige que cette section nomme ce chemin.
**État** : 016 retouchée pour la 021 et essayée (annulée) sur la vraie base le 22 oct.,
**pas encore appliquée** (geste de Julien, voir « État actuel »).

---

## 6. Comment on vérifie

**Mesurer la vraie base AVANT de coder** (lecture seule). La moitié des « bugs » venait
d'un script qui lisait le mauvais champ : vérifier le **nom** et la **forme** (le prix
Vinted est un **objet** `{amount}` ; les données vivent sous `data.payload`).

| outil | quoi |
|---|---|
| `npm run build` | compile — ne voit ni les variables absentes ni le rendu, ni `api/` |
| `node scripts/audit-*.cjs` | ~160 audits ; ceux qui touchent l'extension EXÉCUTENT le vrai `background.js` (`scripts/_fond-vm.cjs`) |
| `scripts/bancs/*.cjs` | ~180 bancs de rendu (390 px tactile et 1512 px) — `scripts/bancs/README.md`. ⚠️ Les fixtures réelles (`fx/`) ne montent **jamais** dans le dépôt (public). |

**Règles de preuve :**
1. **Un contrôle doit ÉCHOUER sur le code d'avant** : `git archive <avant> | tar -x -C
   <dossier>`, copier le banc DEDANS et le lancer DEPUIS cet arbre. Et le prouver aussi
   par **mutation** (réaffaiblir la règle ⇒ rouge) : « la fonction n'existait pas »
   n'est pas une preuve. Un contrôle qui ne peut pas échouer est pire qu'absent.
2. **Regarder la capture d'écran fait partie du test** (un écran tombé sur le
   garde-fou passe tous les contrôles ; un défaut de canvas ne se voit pas dans le DOM).
3. **Servir la vraie FORME** : projection `select=`, `meta->>`, filtres, URL décodée,
   bon ordre de grandeur (PDF), `Range`. Un banc qui sert une autre forme mesure une fiction.
4. **Juger la RÈGLE, pas son orthographe** (data-* et nombres rendus, jamais un libellé ;
   commentaires retirés avant de chercher). **Un banc ne meurt pas, il rapporte.**
5. Un geste « pendant » se joue sur une requête TENUE, jamais sur un délai fixe.
6. Playwright prend la DERNIÈRE route enregistrée en premier.
7. Chemins des bancs déduits de `__dirname` (jamais un chemin absolu).
8. Dans un worktree dont `node_modules` est un lien, poser la porte de banc
   (`_porte-banc.cjs`) sur le playwright du chemin absolu ; un banc rouge en masse ⇒
   regarder d'abord la capture (écran de connexion ?) et `df -h /` (disque plein).

⚠️⚠️ **Plusieurs sessions mergent sur `main` en même temps** : amener `main` par un
**vrai `git merge origin/main`**, jamais `-s ours` ; après, `git diff origin/main --stat`
ne montre que ses fichiers. **Commiter AVANT toute manipulation de branche.** Une
version d'extension publiée ne change jamais de contenu : deux contenus, deux numéros
(`audit-extension-zip`, `_versions-publiees.cjs`). Après toute modification de
`vinted-sync-extension/`, monter la version (`CODE_VERSION`, manifeste,
`EXT_ATTENDUE`) et régénérer le zip (`public/VRM-extension.zip`, un seul dossier).
⚠️ Vercel gratuit : 100 déploiements / 24 h — les branches `claude/**` ne se
déploient pas (`vercel.json`) ; ne jamais « promouvoir » une prévisualisation.
⚠️ Plan Hobby : **12 fonctions** `api/` au plus (`audit-fonctions-api.cjs`).
⚠️ L'outil SQL attend une confirmation humaine pour tout `DROP`/`DELETE`.

---

## 7. Le visuel

> **UNE SEULE couleur d'accent, et elle est RARE.** Tout le reste est neutre. Un
> chiffre ne porte une couleur que s'il y a vraiment quelque chose à rattraper ;
> **ambre** pour un geste à faire, **rouge** seulement pour deux paires sous un N°.

- Vitrine + Apple (police système, bleu Apple ; styles-vitrine.css en dernier), mode sombre CHOISI
  (`vinted_dark`, estampillé sur la racine avant le premier rendu).
- Une forme par fonction : boutons (une règle de base, jamais `display:inline-flex`),
  `Segmente`, `vrm-filtres`, `vrm-repli`, `vrm-lien-action`, rangées défilantes.
  Cibles au doigt **44 px** affichés.
- Une même phrase sur chaque ligne est UNE phrase (dans l'en-tête du groupe) ; le même
  nombre ne s'écrit jamais deux fois sur un écran ; pas de « n/d ».
- Un nom d'icône absent de `ICON_PATHS` ne dessine rien sans erreur (`audit-icones`).
- Sur ordinateur, les actions du haut sont une île flottante : tout ce qu'un écran pose
  sur sa ligne de titre passe par le slot `right` de `ScreenHead`.
- Sur iPhone, `-webkit-overflow-scrolling: touch` sur un conteneur crée un contexte
  d'empilement : **ne jamais le remettre sur un conteneur qui peut contenir une
  feuille** ; les feuilles et confirmations passent par un portail (`Z_CONFIRMATION`,
  `Z_MESSAGES`). Toute feuille plein écran porte `FermeAuRetour`.

---

## 8. Ce que sait faire l'extension dépend de SA version — `EXT_CAPACITES`

⚠️ **La vérité est `EXT_CAPACITES` dans `src/App.jsx`** (vérifiée par `audit-coherence`) ; cette table la recopie.
L'app tient **une table**, chaque capacité portant **la version où elle est arrivée**
(jamais la dernière publiée). `extSait(quoi)` rend **trois états** : `absente` ·
`retard` · `ok` ; une extension muette compte comme `retard`. **« Pas su » ne vaut pas
« oui ».** Une promesse ne se fait qu'à une extension de CE navigateur, à jour,
connectée à CE compte VRM, seule, au code à jour. `audit-coherence.cjs` vérifie que
chaque fonction existe et que chaque seuil est au-dessus de toute version publiée
sans la fonction.

| capacité | fonction de l'extension | arrivée en | ce que l'app promet |
|---|---|---|---|
| `codes` | `capterRetraits` | **5.45.0** (27 août) | « l'extension va chercher les codes toute seule » |
| `releve` | `capterReleves` | **5.52.0** (5 sept.) | « l'extension récupère le relevé à ta prochaine visite » |
| `places` | `mpChoisi` | **5.54.0** (11 sept.) | « seules les annonces cochées partent sur Leboncoin » |
| `ebay` | `buildEbayData` | **5.55.0** (12 sept.) | « l'extension prépare tes annonces sur eBay » |
| `lbctitre` | `lbcTitre` | **5.55.4** (12 sept.) | « le titre exactement tel qu'il partira sur Leboncoin » |
| `photoslbc` | `photosEnOctets` | **5.58.0** (13 sept.) | « photos attachées au formulaire Leboncoin, rien sur ton ordinateur » |
| `photosebay` | `photosPourEbay` | **5.59.0** (13 sept.) | la même promesse, pour eBay |
| ~~`repond`~~ | `repondreAuxMessages` | ⛔ n'existe plus dans l'extension ni dans `EXT_CAPACITES` (constaté le 2 nov.) | aucune promesse |
| `commande` | `executerCommande` | **5.129.0** (2 oct.) | « Générer le bordereau » depuis l'app : l'app COMMANDE l'extension |
| `publication` | `publierDepuisApp` | **5.160.0** (le code fait foi ; arrivée 5.130.0 le 3 oct.) | « Publier sur Leboncoin » / « Préparer sur eBay » depuis l'app |
| `lbcdate` | `dateVenteLbc` | **5.131.0** (3 oct.) | « ouvre Mes transactions, l'extension relève la date de vente » |
| `versement` | `capterDatesVersement` | **5.133.0** (3 oct.) | « l'extension va chercher la date de versement de tes ventes finalisées » |
| `messagerie` | `executerPourApp` | **5.135.0** (3 oct.) | lire un fil, accepter/refuser/faire une offre depuis l'app |
| `lbcpdf` | `pdfBordereauLbc` | **5.136.0** (3 oct.) | « 🖨 Imprimer le bordereau » Leboncoin, tamponné du titre et du N° |
| `lbcmsg` | `storeLbcMessages` | **5.153.0** (4 oct.) | Leboncoin → Messages : « l'extension relève tes non-lus, compte par compte » |
| `vestiaire` | `storeVcRecon` | **5.154.0** (4 oct.) | Vestiaire : « ouvre Vestiaire dans ce Chrome, l'extension apprend à le lire » |
| `vcmessages` | `rangerVcMessages` | **5.238.0** (27 oct.) | « elle relève le nombre de messages non lus Vestiaire en passant » |
| `vcachats` | `rangerVcAchats` | **5.239.0** (27 oct.) | « elle lit tes achats Vestiaire en passant » |
| ~~`detourage`~~ | `detourerPhotos` | ⛔ retiré de la table le 17 oct. (5.185) | Leboncoin/eBay ne détourent plus ; Vestiaire seul (`photosPourVestiaire`), sans réglage ni promesse |
| `supprimees` | `noterSuppression` | **5.165.0** (11 oct.) | « une suppression faite sur vinted.fr dans ce Chrome sort d'ici tout de suite » |
| `enligne` | `relireAnnoncesAutresComptes` | **5.170.0** (11 oct. — les 5.167/5.168 de production ne la portent pas) | « tes autres comptes sont relus à ta prochaine visite sur Vinted, sur n'importe lequel de tes comptes » — et seulement si l'extension est connectée à CE compte VRM (revue, 5.170) |
| `preuves` | `capterPreuvesVente` | **5.172.0** (11 oct. — ni la 5.167, ni la 5.168, ni la 5.170 publiées ne l'ont ; la 5.169 et la 5.171 sont prises par d'autres chantiers) | « l'extension lit toute seule la transaction des ventes en cours pas encore reliées (anti double vente) » |
| `relais` | `traiterRelais` | **5.183.0** (16 oct. — la 5.182 publiée par main, fiche Leboncoin, ne l'a pas) | « sur le téléphone : actions via ton ordinateur » (le relais lit le signe de vie, pas le pont) |
| `lbcpack` | `noterPackPhoto` | **5.185.0** (17 oct.) | « l'extension voit si tu as un pack photo Leboncoin » (`lbc_pack_photo`) |
| `vcpublier` | `publierVestiaire` | **5.235.0** (27 oct.) | « Préparer sur Vestiaire » depuis l'app |
| `annulee` | `purgeBordereauxAnnules` | **5.185.0** (17 oct.) | « le bordereau d'une vente annulée part tout seul » |
| `liaison` | `demanderLiaison` | **5.171.0** (11 oct. — la 5.170 de production ne la porte pas) | « je connecte l'extension à ton compte VRM — rien à taper » (session adressée) |
| `etatcompte` | `noterEtatCompte` | **5.181.0** (16 oct.) | « compte actif / banni par Vinted » relevé par l'extension (`panel_comptes_etat`) |
| `lbcfiche` | `appliquerAnnonceLbc` | **5.182.0** (16 oct.) | publier sur Leboncoin l'annonce CORRIGÉE dans la fiche de VRM (titre, prix, état, photos, description) |
| `confirmer` | `capterConfirmations` | **5.206.0** (le code fait foi ; arrivée 5.204.0 le 21 oct.) | « relever les colis à confirmer (« Tout est OK ») avant leur date limite » |
| `retraitnotif` | `envoyerNotifsRetrait` | **5.206.0** (le code fait foi ; arrivée 5.204.0 le 21 oct.) | « te prévenir quand elle lit un code de retrait dans une conversation » |
| `suivivinted` | `capterSuivisAchats` | **5.217.0** (24 oct. — ni la 5.214.0, ni la 5.215.0, ni la 5.216.0 publiées par `main` ne l'ont ; la table disait 5.216.0, le code dit 5.217.0) | « l'extension relève le suivi Vinted de tes achats » — seulement connectée à CE compte VRM, seule, au code à jour (revue du 24 oct.) |
| `transp` | `transpTick` | **5.291.0** (30 oct. — aucune version publiée ne l'a ; 5.290 était un numéro de branche) | « l'extension lit le statut chez le transporteur à la place du serveur quand celui-ci est refusé » |
| `lbcsupprime` | `supprimeLbcDepuisApp` | **5.291.0** (30 oct. — 5.288 était un numéro de branche) | « Supprimer de Leboncoin » depuis VRM, sur son clic et confirmé |
| `lbcstats` | `noterStatsAnnonceLbc` | **5.291.0** (30 oct.) | « favoris, vues et messages relevés sur tes annonces Leboncoin » |
| `favorisouvrir` | `ouvrirFavoriNatif` | **5.225.0** | (ajoutée à la table le 30 oct.) |
| `favorisliste` | `lirePageFavoris` | **5.218.0** | (ajoutée à la table le 30 oct.) |
| `favoris` | `executerMessageFavori` | **5.217.0** | (ajoutée à la table le 30 oct.) |
| `offresauto` | `autoAccepterOffres` | **5.234.0** | (ajoutée à la table le 30 oct.) |
| `vcauto` | `rangerVcAnnonces` | **5.236.0** | (ajoutée à la table le 30 oct.) |
| `vcventes` | `rangerVcVentes` | **5.237.0** | (ajoutée à la table le 30 oct.) |
| `republier` | `republierVinted` | **5.240.0** | (ajoutée à la table le 30 oct.) |
| `republiermodif` | `corpsAvecPrixBaisse` | **5.247.0** | (ajoutée à la table le 30 oct.) |
| `recreer` | `recreerVinted` | **5.248.0** | (ajoutée à la table le 30 oct.) |
| `lettre` | `recreerVinted` | **5.250.0** | (ajoutée à la table le 30 oct.) |
| `brouillon` | `publierBrouillon` | **5.251.0** | (ajoutée à la table le 30 oct.) |
| `versbrouillon` | `recreerVinted` | **5.253.0** | (ajoutée à la table le 30 oct.) |
| `republierbrouillon` | `recreerVinted` | **5.254.0** | (ajoutée à la table le 30 oct.) |
| `refaire` | `refaireBrouillon` | **5.255.0** | (ajoutée à la table le 30 oct.) |
| `republierpage` | `vintedPage` | **5.277.0** | (ajoutée à la table le 30 oct.) |
| `republierfile` | `miseEnLigneTick` | **5.279.0** | (ajoutée à la table le 30 oct.) |
| `favorisperso` | `erreurVariablesFavori` | **5.281.0** | (ajoutée à la table le 30 oct.) |
| `vcsession` | `noterSessionVc` | **5.295.0** (31 oct.) | le compte Vestiaire ouvert dans l'onglet (`vc_session`) — si Vestiaire charge `/users/me` |
| `vcfil` | `rangerVcFil` | **5.317.0** (3 nov. ; la 5.295 ne lisait pas la messagerie Stream) | « lire tes conversations Vestiaire » (messagerie Stream + fil des notifications ; texte, date, « de toi », jamais un nom) |
| `vcrepondre` | `repondreVestiaire` | **5.295.0** | « Envoyer sur Vestiaire » sur son clic — seulement après une recette APPRISE de son propre envoi (`vc_envoi.appris`) |
| `vcfavoris` | `rangerVcAnnonces` | **5.295.0** | le NOMBRE de favoris par annonce Vestiaire (jamais qui) |
| `relaisdest` | `relaisDestination` | **5.295.0** | « le point relais où arrivent tes achats (quand le suivi Vinted le donne) » |
| `vcfiche` | `ficheVcAnnonce` | **5.296.0** (1er nov.) | annonces Vestiaire en fiches (photo, titre, prix, état) et le compte de l'onglet sur annonces/ventes/achats (flou par compte) |
| `favorisauto` | `freinFavoriAuto` | **5.309.0** (2 nov.) | mode auto des favoris |
| `plafondcompte` | `publierActions` | **5.312.0** (2 nov.) | le plafond de 50 actions/heure est celui du COMPTE, tous Chrome confondus |
| `freinrepub` | `poserFreinRepub` | **5.311.0** (2 nov.) | un refus de Vinted freine la republication de CE compte (30 min ; 24 h si restreint) |
| `numeroscompte` | `numerosDuCompte` | **5.311.0** (2 nov.) | sur Vinted, seuls les N° du compte connecté dans l'onglet |
| `republierquestion` | `reglerAvant` | **5.310.0** (2 nov.) | Republier remplit un champ manquant depuis l'annonce elle-même, sinon DEMANDE (valeurs de Vinted) ; un refus nommé n'est jamais renvoyé tel quel |
| `lbcfil` | `rangerLbcFil` | **5.318.0** (3 nov.) | « lire tes conversations Leboncoin » (texte, date, « de toi », jamais un nom ; rangé seulement quand la page et l'onglet disent le même compte privé) |
| `lbcrepondre` | `repondreLeboncoin` | **5.318.0** (3 nov.) | « Envoyer sur Leboncoin » sur son clic, au nom du compte connecté dans l'onglet, dans les 50 actions/h — seulement après une recette APPRISE de son propre envoi (`lbc_envoi.appris`) |
| `vcoffres` | `rangerVcOffres` | **5.319.0** (4 nov.) | « tes offres reçues sur Vestiaire » (article, prix, gestes datés, à toi de répondre ; jamais l'acheteur) |
| `vcoffrerepondre` | `repondreOffreVestiaire` | **5.319.0** (4 nov.) | « Accepter / Refuser / Contre-offre » sur son clic, au nom du compte de l'onglet, dans les 50 actions/h — seulement après une recette APPRISE de son propre geste sur Vestiaire (`vc_offres_recette`) |
| `avis` | `capterAvis` | **5.319.0** (4 nov.) | « tes avis Vinted reçus (note, date) » : la 1re page de `user_feedbacks`, compte connecté seulement, budget de LECTURE 20/h, une fois par 24 h, rangée dans `harvest_{uid}_feedbacks` ; forme pas encore mesurée (une forme inconnue n'écrit rien) ; aucun rappel d'évaluation |
| `ventesfusion` | `fusionnerCommandes` | **5.323.0** (6 nov.) | une lecture partielle des ventes/achats se FUSIONNE par n° de transaction (rien perdu) ; fenêtre inchangée < 1 h ni relue ni réécrite |
| `releveidentite` | `txDeLigneReleve` | **5.323.0** (6 nov.) | relevé du porte-monnaie (`wallet/invoices/current`) rangé sans rien de personnel, `tx` si la ligne porte la vente ; forme inconnue ⇒ `harvest_{uid}_forme_releve` |

---

## 9. État actuel et décisions récentes

- **6 nov. · Audit des chiffres** : « à imprimer » = pas encore imprimés partout (`compteAImprimer`), Tournée « à déposer » = avec bordereau, widget sans colis sans n° (15→12) ; banc `chiffres-coherents`. `docs/passation/2026-11-06-audit-chiffres.md`. Geste : aucun.

- **7 nov. · PASSATION GÉNÉRALE** : prod = PR #1027 ; 4 chantiers finis ou presque en attente sur `claude/attente-*` (hors réseau, e-mails HTML, audit des chiffres, finition textes/grand texte/sombre — dans cet ordre) ; découpage d'App.jsx et relecture finale pas commencés ; au plus 2 agents de bancs (le conteneur tombe). `docs/passation/2026-11-07-passation-generale.md`.

- **6 nov. · E-mails mis en page (v36)** : HTML d'origine ASSAINI des seuls e-mails à geste, 30 jours, ligne à part `email_html_*` (liste blanche, images sur geste, pixels retirés, 150 Ko ; jamais 503 pour lui ; purge au cron du matin ; relu et ré-assaini), cadre `sandbox` sans scripts, masqué en stream. `docs/passation/2026-11-06-emails-html.md`. Geste : aucun.

- **6 nov. · Loupe universelle (v36)** : une loupe pour tout (N°, pseudo, suivi, code ⇒ colis « En grand », transaction, montant au centime, titre, marque/taille, facture, e-mail par le moteur de l'écran E-mails) ; 50 jumelles = 50 lignes ; texte tapé hors de la coque (frappe 32 ms médiane au banc). `docs/passation/2026-11-06-recherche.md`. Geste : taper un code de retrait.

- **6 nov. · Visuel 2 (v36)** : grand titre qui se replie (téléphone ; barre de verre retirée : CLS au chargement) ; Colis (nom sur sa ligne, adresse dessous), eBay (À faire en Réglages, « Relier » au maillon, photo 64), Ma journée (À faire en UNE carte, paires du jour en pile), états vides dessinés, chiffre qui roule, `montant()` partout ; violet interdit (`audit-violet`, pastilles de compte). `docs/passation/2026-11-06-visuel-2.md`. Geste : regarder Colis et eBay sur l’iPhone.

- **6 nov. · Visuel (v36)** : une ligne d'explication au plus, le reste en feuille (`Pourquoi`, ⓘ collé au texte) ; Réglages eBay en rangées iOS (`src/composants/Ios.jsx`), `Notice` en rangée, plus de barres latérales, listes en groupes iOS. `docs/passation/2026-11-06-visuel.md`.

- **6 nov. · Statut des colis** : règle d'état datée (`api/_lib/etat-colis.js` : fini prouvé gagne, une lecture plus vieille ne fait pas reculer, « en route » daté après l'arrivée ⇒ à vérifier) ; conversation des e-mails Vinted relus décodée dans le navigateur (À vérifier 34 → 2) ; date estimée par la garde. `docs/passation/2026-11-06-statut-colis.md`. Geste : aucun.

- **6 nov. · « Annuler » partout (v36)** : geste interne instantané + pilule 5 s « Annuler » (`src/gesteAnnulable.js`, `PiluleAnnuler`, `gesteVrm`) sur 10 gestes ; refus ⇒ l'écran revient, « Pas enregistré — Réessayer » ; réseau ⇒ « pas encore envoyé » (file d'envoi) ; jamais sur un geste chez un tiers. `docs/passation/2026-11-06-annuler.md`. Geste : Colis → « J'ai retiré » → Annuler.

- **6 nov. · Chargement** : écran de démarrage dans `index.html` (avant le JS, retiré par `src/demarrage.js`) ; chaque écran attend ses données essentielles derrière son squelette (`src/AttenteEcran.jsx`, `ESSENTIELS_ECRAN`, plafond 2,5 s) ; « lecture… », jamais « pas lu », pendant qu'une publication se prépare ; banc `chargement.cjs`. `docs/passation/2026-11-06-chargement.md`.

- **6 nov. · Boîte mail façon Mail (v36)** : lu / non lu (`api/_lib/emails-lus.js`, ligne `vrm_emails_lus`, glisser au doigt, « Tout marquer lu », rien de caché, pas d'« Archiver »), code de retrait copiable sur la ligne (lu seulement), piles des rafales, avatars (logos de l'app), carte « ce qu'il faut savoir » (code façon carte d'embarquement), gestes par identité, message rendu sans HTML, rubrique Offres, 50 par page au défilement. `docs/passation/2026-11-06-boite-mail.md`. Geste : copier un code depuis la ligne ; décider du HTML d'origine.

- **6 nov. · Accompagnement (v36)** : visite à 4 bulles ; conseils = 1 bulle non modale sur le VRAI bouton (halo, Plus tard, Ne plus montrer), 2/jour, 1/écran, 3 j de repos, sur un chiffre publié par l'écran (`<ChiffreConseil>`, pas su ⇒ rien), « vu » écrit d'abord dans `vrm_accompagnement` (rev) ; `src/accompagnement.js`, `audit-conseils`. `docs/passation/2026-11-06-accompagnement.md`. Geste : aucun.

- **6 nov. · Facture Pro (v36)** : bouton « Envoyer la facture » sur la LIGNE de la vente seulement si l'acheteur est PROUVÉ (même n° de transaction Vinted + e-mail Pro, heure −2/+15 min, montant ; sinon la raison, `src/facturePro/rattachement.js`, relue par le serveur) ; envoi PAR VRM (From « … via VRM », Reply-To et Cc au vendeur, 50/jour) ; « Ma facture » avec aperçu en direct. `docs/passation/2026-11-06-facture-pro.md`. Geste : remplir Ma facture, poser `RELANCES_SMTP_*`.

- **6 nov. · Bancs rouges d'avant (v36)** : Facturation Pro ne plante plus (réponse sans boîte = pas su), « Ajouter » du stream dit pourquoi, Statistiques à l'échelle 28/20/15/13/11, transporteurs 2 × 2 au téléphone ; 15 bancs jugent la règle actuelle. `docs/passation/2026-11-06-bancs-preexistants.md`. Geste : aucun.

- **6 nov. · Onglets D (Annonces, Compta, Statistiques, Paramètres)** : sa base recalculée = l'app (25 mois de CA, 49 en ligne, 19 vendues) ; une vente « à dater » vendue ET lue finalisée la même année compte dans le CA de l'ANNÉE, jamais d'un mois (`src/aDaterAnnee.js` ; seuils, revenus, DAC7, « CA de l'année » de Ventes) ; « Déclarer » en 3 étapes avec « ? » ; Annonces « Prochain geste » ; Paramètres par intention, une phrase par réglage. `docs/passation/2026-11-06-onglets-d.md`. Geste : Compta → Déclarer octobre.

- **6 nov. · Finitions (v36)** : « Plus tard » revient après 7 j (et relu au nuage) ; N° d'archive remis en vente ⇒ « à écrire sur tes cartons » ; Actions à deux comptes dit « Prix mini : possible » ; Colis une voix de fraîcheur ; `data-aller-chercher` ; « — » de Compta au jeton ; une paire en ligne deux fois = ambre seul, plus le rouge ; banc transporteurs à la forme du 3 nov. + ambre sombre, phrase « code postal », « transporteur pas encore connu ». `docs/passation/2026-11-06-finitions.md`. Geste : aucun.

- **6 nov. · eBay + Leboncoin (v36)** : Leboncoin « en ligne » = la lecture COMPLÈTE de « Mes annonces » de son compte de moins de 24 h (`src/enLigneLbc.js`, règle de Vinted), sinon « à confirmer » hors des totaux (mesuré : 8 « Actives », 0 lecture complète jamais rangée) ; alertes anti double vente inchangées ; carte eBay = photo · titre · N° · prix · une ligne, UN geste + « … » (fiche : règle d'offre, modifier, supprimer). `docs/passation/2026-11-06-ebay-lbc.md` (§3 : correctifs extension à faire). Geste : se reconnecter à Leboncoin et ouvrir « Mes annonces » sur chaque compte.

- **6 nov. · Onglets B (Colis, Stock)** : le prochain geste en une ligne en tête de Colis (urgent d'abord, colis comptés seuls, `src/prochainGesteColis.js`) ; « à imprimer » = pas encore imprimés (9→3 mesuré) ; un S10 étranger n'est plus « Chronopost » (« Colis international (pays) », Chronopost = forme XW/ZW…TS/SP) ; comptes muets → Comptes liés ; légende du Stock. `docs/passation/2026-11-06-onglets-b.md`. Geste : supprimer s'il veut les 3 `transp_chronopost_…IE` vides.

- **6 nov. · Onglets C (E-mails)** : 3 comptes sur 9 muets, tous en relais d'Apple ; « Relier la boîte de <compte> » (pas-à-pas par compte, Yahoo et relais Apple, VÉRIFIÉ sur e-mail lu, `src/relierCompte.js`) depuis E-mails, Comptes liés, Colis, Ma journée (`relierBoiteDe`) ; recherche et « À vérifier » dans la boîte. `docs/passation/2026-11-06-onglets-c.md`. Geste : Transférer à une boîte reliée.

- **6 nov. · Inventaire (v36)** : Stock → « Inventaire » (et Ma journée si en cours) : il tape les N° vus ⇒ « ✓ Attendu » neutre (pas de vert, §7) · ambre en trop / vendu · rouge deux paires sous un N° ; bilan manque / en trop / vendu rangé ; attendu = celui du Stock, pas su ≠ manque, aucun N° changé ; « N° + Entrée » ICI seulement ; ligne `vrm_inventaire` (rev). `docs/passation/2026-11-06-inventaire.md`. Geste : faire le tour des cartons.

- **6 nov. · Vitesse 2** : dressings projetés (`lireDressings`, comptes liés, vide ⇒ motif), achats des comptes liés (`lireAchatsLies` ; la cloche reprend ceux du démarrage), 15 morceaux à la demande (`aLaDemande` = `React.lazy`, leur CSS reste dans App) ; −700 Ko lus par écran, 1er chargement 1 405 → 1 299 Ko gz. `docs/passation/2026-11-06-vitesse2.md`.

- **6 nov. · Onglets A (Ma journée, Ventes, Achats)** : « 0 € aujourd'hui » corrigé (la coque relit ses ventes par sa sonde, `src/sondeVentes.js`, le même « aujourd'hui » partout sans recharger) ; « lecture… » au lieu de « pas lu » pendant la lecture ; « Colis envoyés » jamais 0 sans gestes ; achat suspendu hors « en route » ; un nombre une fois ; « ? » « D'où viennent ces chiffres » (`AIDE_CHIFFRES`). `docs/passation/2026-11-06-onglets-a.md`. Geste : toucher le « ? » de Ventes.

- **6 nov. · Filets anti-bug (v36)** : `verifier.yml` sur chaque PR (build, tous les audits en 3 parts — rouges connus dans `scripts/audits-exceptions.json` —, bancs, WebKit non bloquant), un garde-fou par écran et par feuille (`GardeEcran`), morceau d'un ancien déploiement compté à part (jamais un plantage), veille des plantages au cron du matin (propriétaire seul), `controle-prod.yml` après mise en ligne (lecture seule). `docs/passation/2026-11-06-filets-anti-bug.md`. Geste : rendre le contrôle obligatoire (règle de branche `main`, pas-à-pas dans la passation).

- **6 nov. · Films (motion design)** : la VRAIE app filmée image par image, données inventées (`scripts/films/`, vidéos hors dépôt). `docs/passation/2026-11-06-films.md`. Geste : regarder et publier.

- **6 nov. · Recherche par photo (v36)** : appareil photo dans la loupe et le Stock ; empreinte locale SANS modèle (`src/empreintePhoto.js` : couleur sans le fond + balance des blancs, grille, bords, hachages), index sur l'appareil par URL exacte, octets par `chargerPhotoBoite` ; 5 propositions « très proche / proche / peu sûr », SON clic ouvre « Tout sur le N° », rien relié ; mesure 3D inventée top 5 100 %, top 1 82,5 %. `docs/passation/2026-11-06-recherche-photo.md`. Geste : l'essayer dans le navigateur de l'extension.

- **6 nov. · Ouvrir aux clients** : pas-à-pas `docs/ouvrir-aux-clients.md` (mentions, Supabase SMTP, Vercel Pro, Stripe, verrou `abonnement_obligatoire`) ; « Découvrir avec des exemples » (`src/modeExemple.js` : tout en mémoire, 0 écriture) ; guide de démarrage coché sur preuve (`src/guideDemarrage.js`). `docs/passation/2026-11-06-clients.md`. Geste : suivre le pas-à-pas.















Une ligne par chantier ou décision, le plus récent d'abord. Détail : le fichier
d'historique du thème (cherche le titre ou la date).

**Extension servie : 5.323.0** (6 nov.). **À lire en premier : `docs/passation/2026-11-07-passation-generale.md`** (tout ce qui reste, 4 branches `claude/attente-*` à fusionner), puis `docs/passation/2026-11-02-liste.md`. **Production** : https://vrm.center,
vérifier par `curl https://vrm.center/api/sante`.

### Gestes encore attendus de Julien
- Facture Pro : compléter « Ma facture » (Comptabilité → Factures : SIRET, forme, régime de TVA, son e-mail) ; poser `RELANCES_SMTP_*` + `RELANCES_EXPEDITEUR` (SPF/DKIM, Brevo 300/j) — VRM envoie par défaut.
- Installer l'extension **5.317.0** (remplacer le dossier, puis ⟳ dans CHAQUE Chrome), puis sur Vestiaire ouvrir la messagerie (`/chat/`) et une conversation.
- Sur leboncoin.fr, ouvrir « Mes annonces » sur CHACUN de ses comptes Leboncoin.
- Recoller `scripts/gmail-forwarder.gs` (avec sa clé) dans la boîte qui fait tourner le
  script, puis poser `EMAIL_INBOUND_SECRET` sur Vercel (l'ancien script lit encore la
  base avec l'ancienne clé : aucune facture Pro ni lien de preuve d'adresse ne part).
- Recoller le Worker Cloudflare de `docs/email-pipeline.md` (Message-ID, rejeu sur 503).
- Remplir `public/legal/editeur.js` (10 champs) ET `src/contact.js` : **tant qu'ils sont
  vides, personne ne peut payer** ; faire relire CGV et formulaire de rétractation.
- Stripe : recréer le prix `vrm_mensuel` à **16,99 €** (sinon le paiement reste fermé),
  poser `STRIPE_SECRET_KEY`, régler l'adresse des CGV ; passer en mode réel.
- Supabase : Site URL `https://vrm.center` et Redirect URLs, SMTP personnalisé,
  confirmation d'email obligatoire ; (pour Discord) activer le fournisseur Discord.
- Migration **016** (mode équipe) : essai annulé, appliquer VRM peu sollicité, puis
  `node scripts/equipe-sql/essai-annule.cjs --verifier`.
- Captcha Turnstile : prêt et éteint ; l'ordre des gestes est dans l'historique sécurité
  (d'abord l'extension, puis la clé de site, puis Supabase).
- Repasser sur Vinted connecté sur les comptes dont la lecture est ancienne (la ligne de
  fraîcheur les nomme).
- Les 6 paires renumérotées le 2 oct. (543→266…, historique numéros) : regarder le carton.
- Boutiques d'extensions (AMO Firefox, Edge, Opera) : `docs/boutiques-extension.md`.
- Décider : second cron le dimanche soir ; garder ou non le retrait eBay automatique
  (ALLUMÉ chez lui) ; libellés de la barre du bas à 9 px.

### Décisions et chantiers (octobre–novembre 2026)
Une ligne par chantier. Le récit complet des lignes du 31 oct. au 2 nov. est, mot pour mot, dans `docs/passation/etat-detaille-2026-10-31-au-11-02.md`.
- **Avant le 20 oct.** — `docs/passation/etat-detaille-2026-10-31-au-11-02.md` (fin) et `docs/journal-2026.md`.

---

## 10. Chemins utiles

```
src/App.jsx                     l'app (grep avant de lire — le fichier est énorme)
vinted-sync-extension/          background.js · inject.js · content.js · bridge.js · lbc*.js · vc*.js
api/                            12 fonctions : email-inbound · push · widget · ship-reminders · ai · ebay · compte · relais …
api/_lib/                       règles partagées serveur (copies refabriquées des règles de l'app)
supabase/migrations/            013 numéros · 014 agent · 016 équipe · 017 garde rapide · 018-020 communauté · 021
scripts/audit-*.cjs             les audits
scripts/bancs/                  les bancs (README : comment les lancer)
docs/passation/                 passations datées et historiques par thème
docs/journal-2026.md            l'historique de juillet à septembre
SECURITE.md · .env.example      ce qui doit rester hors du dépôt
```

Chromium du banc : `/opt/pw-browsers/chromium` (lien stable),
`--use-angle=swiftshader --no-sandbox`.
