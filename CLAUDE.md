# VRM — dossier de passation

**Lis ce fichier en entier avant de coder. Il est court exprès (moins de 60 Ko).**
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
| **Dépôt** | `julatace/cancale-v67`, **PUBLIC** ⚠️ | branche de travail : `claude/new-session-gzdgur` |

---

## 2. Les règles de Julien — permanentes, jamais à re-négocier

1. **Pousse à chaque modification.** Aucun travail ne reste en local : une session
   qui perd son conteneur perd tout, et la suivante le refait à l'envers.
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
| **Palette** | Une palette violette a été essayée puis **REFUSÉE** le 27 oct. : ne pas la reproposer ; la palette Perle (pétrole et sauge, `src/themeMineral.js`) reste. |
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
    ⚠️ **Et un composant jamais rendu ne lève rien non plus.** `Nav` (un tiroir de
    navigation avec `TABS` et `ARCHIVE_TABS`) était défini, complet, et
    **référencé nulle part** — un `<Nav …>` n'existait pas dans le fichier. Il
    portait une SECONDE navigation, aux libellés différents de la vraie
    (« Stats » contre « Statistiques », un « Comptabilité » qui n'existe nulle
    part ailleurs) et sept emojis-icônes qui ressortaient à chaque audit du §7.
    Retiré le 7 septembre (66 lignes) après avoir vérifié que « Ancien
    catalogue » et « Anciennes ventes » restent joignables depuis Réglages.
    **Avant de « corriger » une navigation, vérifier qu'elle est rendue** :
    `grep -c '<Nom'` — et compter les écrans montés (`tab===`) avant ET après
    la coupe (13 des deux côtés).
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
  `api/widget.js`) sur le champ machine `transaction_user_status` ; sur un ACHAT,
  `needs_action` veut dire « à retirer ».
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

- Palette Perle (pétrole et sauge, `src/themeMineral.js`), mode sombre CHOISI
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
- Avant de « corriger » une navigation, vérifier qu'elle est rendue (`grep -c '<Nom'`).

---

## 8. Ce que sait faire l'extension dépend de SA version — `EXT_CAPACITES`

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
| `repond` | `repondreAuxMessages` | **5.77.0** (19 sept.) | « elle répond aux questions posées sur tes annonces » |
| `commande` | `executerCommande` | **5.129.0** (2 oct.) | « Générer le bordereau » depuis l'app : l'app COMMANDE l'extension |
| `publication` | `publierDepuisApp` | **5.130.0** (3 oct.) | « Publier sur Leboncoin » / « Préparer sur eBay » depuis l'app |
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
| `confirmer` | `capterConfirmations` | **5.204.0** (21 oct.) | « relever les colis à confirmer (« Tout est OK ») avant leur date limite » |
| `retraitnotif` | `envoyerNotifsRetrait` | **5.204.0** (21 oct.) | « te prévenir quand elle lit un code de retrait dans une conversation » |
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


---

## 9. État actuel et décisions récentes

Une ligne par chantier ou décision, le plus récent d'abord. Détail : le fichier
d'historique du thème (cherche le titre ou la date).

**Extension servie : 5.291.0** (30 oct.). **Production** : https://vrm.center,
vérifier par `curl https://vrm.center/api/sante`.

### Gestes encore attendus de Julien
- Installer l'extension **5.291.0** (remplacer le dossier, puis ⟳ dans CHAQUE Chrome).
- Sur leboncoin.fr, ouvrir « Mes annonces » sur CHACUN de ses comptes Leboncoin.
- Recoller `scripts/gmail-forwarder.gs` (avec sa clé) dans la boîte qui fait tourner le
  script, puis poser `EMAIL_INBOUND_SECRET` sur Vercel (l'ancien script lit encore la
  base avec l'ancienne clé : aucune facture Pro ni lien de preuve d'adresse ne part).
- Recoller le Worker Cloudflare de `docs/email-pipeline.md` (Message-ID, rejeu sur 503).
- Remplir `public/legal/editeur.js` (10 champs) ET `src/contact.js` : **tant qu'ils sont
  vides, personne ne peut payer** ; faire relire CGV et formulaire de rétractation.
- Stripe : recréer le prix `vrm_mensuel` à **12,99 €** (sinon le paiement reste fermé),
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

### Décisions et chantiers (octobre 2026)
- **31 oct.** — Compétence **taste** (Leonxlnx/taste-skill, MIT) installée dans `.claude/skills/taste-skill/` à sa demande : tout changement de style passe par elle (`references/app-screens.md` pour les écrans de l'app) ; §7 et ses refus priment. → `.claude/skills/README.md`.
- **31 oct. (soir)** — Vinted/extension **5.293.0** (intégrée avec Leboncoin en 5.293.0) : le pont photo relaie le `statut` du CDN (lien mort 404/410 plus redemandé avant 30 min, refus passagers en tête du témoin) ; détourage Vestiaire : `cle-pas-su` arrête la série et se dit en français. → historique vinted-extension. Geste : installer la 5.293.0 une fois fusionnée.
- **31 oct.** — Tournée de tous les bancs et audits : 5 défauts corrigés (purge d'un
  compte supprimé, cartes Leboncoin remontées, table de reprise lue deux fois…). Les
  panneaux des Paramètres s'ouvrent en sous-écran aussi sur ordinateur (`[data-sous-ouvrir]`).
  Rouges laissés : `session` G/P (Chrome 153), `mobile`, `profil-avatar` (instables).
  → historique divers / interface.
- **31 oct.** — CLAUDE.md allégé (1,36 Mo → < 60 Ko), historique déplacé tel quel dans
  `docs/passation/historique-*.md`.
- **30 oct.** — Intégration v30, extension **5.291.0** (5.288/5.290 étaient des numéros de
  branche) : `docs/passation/2026-10-30.md`.
- **29 oct.** — Leboncoin comme Vinted (5.288→5.291) : liste « Mes annonces » complète qui
  fait sortir les disparues, « à retirer de Leboncoin » par identité, « Supprimer de
  Leboncoin » (confirmé, 10/h), Republier Leboncoin, favoris en NOMBRES seulement. → leboncoin.
- **29 oct.** — Statut chez le transporteur lu par le SERVEUR (Mondial Relay, Chronopost,
  Vinted Go), l'extension en secours. → colis-retraits.
- **29 oct.** — Messages : une offre sur une annonce plus en vente ne reste pas en tête
  (`src/offresVinted.js`) ; « Retirer de la liste ». ⚠️ depuis le 18 oct. aucune requête
  `/api/v2/conversations/…` ne part de la page : l'extension mesure la nouvelle route. → favoris-messages.
- **29 oct.** — Écrans Vinted : grandes photos, état en jauge, calendrier de périodes,
  pastille Actions. → interface.
- **29 oct.** — Comptabilité simple (ordre seul changé), micro-entreprise repliée, suivi
  URSSAF (mensuel/trimestriel), cotisations dans Ma journée, déclaration de revenus
  (cases 5KO/5TA), CFE, rappel 3 jours avant l'échéance. → compta.
- **29 oct.** — Reçu d'achat par email relié à SON achat par n° (`api/_lib/recu-achat.js`) ;
  le mot est « reçu », pas « facture » (`NOM_RECU_ACHAT`). → compta / colis.
- **29 oct.** — Agent eBay qui DEMANDE (jamais sans son oui) ; eBay → Achats : recherche
  et fil (jeton d'application). → ebay.
- **29 oct.** — Clé Photoroom par vendeur, chiffrée, sur l'écran Vestiaire (pas dans
  Paramètres). → vestiaire.
- **29 oct.** — Plafond d'actions **50/h** (sa décision) ; Republier comme Vintex (5.277-5.285).
  → vinted-extension.
- **29 oct.** — Favoris comme Vintex (5.280-5.281) : variables `{username}`, `{a|b}`,
  offre réelle ; plafond de file retiré. → favoris-messages.
- **29 oct.** — shop_cancale : tout retiré, ventes comprises (sa décision) ; un compte
  supprimé ne sort plus d'aucune lecture (`src/comptesSupprimes.js`, sauf
  `{ vrmVoirSupprimes: true }`). → divers / sécurité.
- **29 oct.** — Ventes masquées impossibles ; Organisation hors du menu ; saisie « N° +
  Entrée » retirée ; carte de la communauté gardée claire en mode sombre.
- **28 oct.** — VRM reste sur la France (décision). Stock : un article une fois, toutes
  plateformes ; meubles, plateaux, planches, hauteurs et « max N » partout. → interface-stock.
- **28 oct.** — Republier : supprime et recrée (5.248), brouillons Vinted, menu « Actions »,
  « Refaire le brouillon », couleur et taille vérifiées avant la mise en ligne. → vinted-extension.
- **28 oct.** — Vestiaire : formulaire « smart listing », étiquette en 2ᵉ photo, Taille/État/Prix.
- **28 oct.** — Tour de chaque espace sur ses vraies données (Vinted, Leboncoin, eBay,
  Vestiaire, Ma journée, Colis).
- **27 oct.** — Atelier de republication (tranches 1-5) ; Vestiaire depuis VRM (publier
  sans booster, ventes, achats, messages) ; statut fiscal adapté à la personne ; arrivée
  guidée (`Bienvenue.jsx`) ; annonces en fiches produit ; un article parti sort du Stock.
- **26 oct.** — eBay multi-sites (chaque compte sur SON site, argent en euros), eBay à
  l'international (destination, douane) ; retrait « pour de bon » par catégorie
  (annonces, messages) ; suppression ciblée (bordereaux et relevés séparés). → ebay / divers.
- **23-24 oct.** — Suivi des colis par n° et par Vinted (5.216-5.217), colis à retirer
  fiables (date limite lue, « à vérifier »), eBay « Inactives » (lecture seule), reçu
  d'achat lisible, feuilles au-dessus de la barre sur iPhone. → colis / ebay / interface.
- **22 oct.** — Double vérification gratuite (second appareil) ; adresse de réception
  PROUVÉE ; CSP en Report-Only (la bascule à faire : historique sécurité) ; Ma journée en
  widgets ; carte de la communauté (OpenFreeMap) ; colis à l'heure ; « C'est déclaré ».
  → `docs/passation/2026-10-22-integration.md`.
- **21 oct.** — Discord sur téléphone, date d'arrivée des colis, rappel du soir, « Tout
  sur le N° », captcha prêt, revue visuelle. → `docs/passation/2026-10-21.md`.
- **20 oct.** — Doublons de N° réglés seuls ; revues « argent » (app, extension, eBay) ;
  eBay se relit tout seul ; Leboncoin : compte de session, date de vente. → numeros / ebay.
- **16-19 oct.** — Relais du téléphone (5.183), double vérification TOTP, studio photo,
  mode équipe (016), carte et classement de la communauté (018-020, appliquées). → divers.
- **11 oct.** — Remise à zéro des numéros (013, appliquée), prix 12,99 €, Messages eBay.
- **3-9 oct.** — L'app pilote l'extension (bordereaux, publication), messagerie intégrée,
  numéros à lettres, CA daté au versement, abonnement Stripe (mode test), sécurité
  (routes fermées, RLS, origines exactes de l'extension).
- **Septembre** — le reste : `docs/journal-2026.md` et les historiques.

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
