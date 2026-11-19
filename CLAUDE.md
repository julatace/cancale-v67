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
5. **Les prix d'achat ne se devinent jamais.** Depuis le 19 nov. (sa décision « 2 oui ») le montant du REÇU d'un achat relié par identité se pose seul (`src/prixAchatRecu.js`) ; un lot reste à saisir, une saisie n'est jamais écrasée.
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
10. **« L'outil doit être pratique, pas chiant »** (19 nov.) : pas de carte de reproche récurrente, pas de
    confirmation sans risque, pas d'étape à la main que l'extension sait faire, ce qui est certain se remplit seul,
    1 à 2 touchers par geste courant.
11. **« Vinted n'est pas la plateforme principale des autres vendeurs »** (19 nov.) : l'objet central est
    l'ARTICLE ; chaque site (Vinted, Leboncoin, eBay, Vestiaire) a les mêmes informations et les mêmes gestes.

---

## 3. Ce qui est refusé — et les nuances qui comptent

Chaque refus a une raison technique ou une décision de Julien. Détail complet :
`docs/passation/historique-regles-de-base.md` (§3 d'origine).

| sujet | état aujourd'hui |
|---|---|
| **Republication** | Refusée : une republication **à l'aveugle** (délais aléatoires sans qu'il la lance). **Permis et livré** : l'atelier « Republier » (Annonces → Actions) — C'EST LUI qui choisit les paires, l'ordre, l'espacement (fixe ou aléatoire, son choix) et qui lance. L'ordre est **coffre → brouillon → suppression → mise en ligne** (5.277, 29 oct., « comme Vintex » ; reconfirmé par Julien le 17 nov.) ; ⚠️ **ne pas inverser (supprimer avant le brouillon)**. Depuis le 29 oct. (5.277), tout part **de l'onglet vinted.fr** comme Vintex (`vintedPage`, aucun `Authorization`), sans onglet Vinted rien n'est envoyé ; pauses mesurées ; mise en ligne planifiée +1–3 min (5.279) ; `REPUB_PAR_JOUR` 50. ⚠️ `completionSecoursPhotos`, `photosNeuvesBrouillon`, `secoursTaille` sont **RETIRÉS, ne pas les remettre** (un refus s'arrête et dit le geste). ⚠️ Le réglage photo **par annonce** et « Varier » sont retirés (un réglage pour toutes, une photo affichée par annonce) : ne pas les remettre. **Ne pas re-refuser l'atelier** sur la ligne « refusé ». |
| **Accepter une offre automatiquement — Vinted** | Retiré le 5 oct., puis **RÉTABLI le 27 oct. sur sa décision** : moteur `autoAccepterOffres`, **éteint par défaut**, offre ≥ prix mini posé à côté du N° ; refus auto sous un seuil `refuse` avec SON message (vide par défaut) ; délai **aléatoire** 3–20 min (5.273). ⚠️ Il a **démenti** la théorie « l'acceptation auto a fait bloquer vanessa5723 » : **ne jamais re-régler l'espacement en fixe ni ré-interdire le moteur sur cette théorie**. Garde-fous jamais retirés : `garde`, plafond horaire, pause 429/403, une requête à la fois, chaque offre une fois (`audit-moteur-offres.cjs`). |
| **Accepter une offre — eBay** | Permis sous UNE forme : le seuil natif d'eBay (`BestOfferAutoAcceptPrice`) posé sur son clic, avec confirmation « une offre acceptée vend la paire ». C'est eBay qui accepte, VRM n'appelle aucune route d'acceptation (`audit-offres-auto.cjs` §5). |
| **Piloter souris / clavier** | Refusé : même requête pour Vinted, et `isTrusted:false` ajoute une preuve d'automatisation. |
| **Modifier les photos pour tromper / changer de compte** | Refusé : Vinted relie les comptes par appareil, navigateur, adresse, paiement. (Les réglages photo de Republier servent la présentation, pas à tromper.) |
| **Supprimer une annonce Vinted automatiquement** | Refusé (irréversible). Supprimer passe toujours par son clic (Republier, ou Leboncoin « Supprimer », confirmé). |
| **Baisse de prix par règle** | ⚠️ 19 nov. (« 1 oui ») : **PERMIS**, éteinte par défaut, un réglage par compte (−5/−10/−15 % après 7/14/30 j sans vente), appliquée par l'extension dans ses plafonds (45/h, réserve 5, prudence, arrêt au captcha), au journal. **Plancher** : prix mini, sinon achat + 10 % ; ni l'un ni l'autre ⇒ aucune baisse (`src/reglesAuto.js`, `regleBaisseTick`). |
| **Vendue ailleurs ⇒ masquée sur Vinted** | ⚠️ 19 nov. (« 3 oui ») : vente PROUVÉE sur un autre site ⇒ l'annonce Vinted est MASQUÉE (réversible) par l'extension, compte de l'onglet, dans les plafonds, geste rejoué seulement s'il a été appris ; vente annulée ⇒ démasquée. La SUPPRESSION reste son toucher (`masquerAilleursTick`). |
| **Prix d'achat** | ⚠️ 19 nov. (« 2 oui », remplace l'ancien §2.5) : le montant du REÇU de CET achat (par identité) se pose seul ; jamais deviné, un lot jamais divisé, une saisie jamais écrasée (`src/prixAchatRecu.js`). |
| **Gestes d'envoi** | ⚠️ 19 nov. (« 4 oui ») : « Préparer mes colis », « Je dépose », la tournée et « Emballer » sont **RETIRÉS** ; le dépôt est constaté par le suivi du transporteur ; « Imprimer N bordereaux » depuis Aujourd'hui. Ne pas les remettre. |
| **Messages aux favoris** | **Permis sur sa demande** (24 oct., refait « comme Vintex » le 29 oct., 5.280-5.281) : sur son clic, file serveur à autorisation unique, offre Vinted réelle, rythme « comme Vintex ». ⚠️ Le plafond de 10 messages/60 min de la file est **RETIRÉ (sa décision)** ; reste le plafond d'actions de l'extension. ⚠️ 19 nov. (« on garde toujours le temps aléatoire ») : rythme **au hasard 40 à 90 s** entre deux messages par défaut (jamais deux fois le même temps), « Plus prudent » 2 à 4 min, plus le temps d'écriture ; plafonds inchangés (15/h, 50/h, jour, prudence) — `api/_lib/favoris-file.js` `delaiRythme`. Leboncoin : il ne dit pas QUI a mis en favori, VRM n'écrit à personne. |
| **Plafond d'actions** | ⚠️⚠️ **50 actions/heure/compte (sa décision du 29 oct., « comme Vintex »)** ; `RESERVE_GESTES` = 5 ⇒ les commandes de l'app et les gestes automatiques s'arrêtent à 45 ; une republication réserve ses 3 gestes d'un coup. **Ne PAS le redescendre à 20 sans qu'il le demande.** Budget de LECTURE séparé (20/h). |
| **Double vérification par SMS** | ⛔ Refusée le 22 oct. : **payant** (75 $/mois + chaque SMS). La méthode reste l'app d'authentification (TOTP, gratuite) + un second appareil de secours. Clés d'accès (passkey) : expérimentales chez Supabase, ne pas livrer. Jamais d'invitation forcée au démarrage (retirée à sa demande, 21 oct.). |
| **Téléphone (vérification par SMS à l'inscription)** | Pas fait exprès (§2.9, payant sur sa clé). |
| **International** | ⚠️ **11 nov. : décision de Julien du 11 nov. — VRM se TRADUIT en anglais, espagnol, italien, allemand, compta comprise** (remplace le refus du 28 oct.) : les TEXTES seulement, par `tr()` (`src/i18n/`, langue = Paramètres → Langue, `vrm_langue`) ; aucune règle de calcul ne change (compta par pays : lot d'étude `fiscalite-pays`). L'argent reste en euros (une commande en GBP/USD est écartée et dite, jamais convertie). Écrans traduits et ce qui reste en français : `2026-11-11-traduction.md`, `2026-11-13-integration-traduction.md`. |
| **Détourage** | Vestiaire Collective SEUL (sa décision du 17 oct. : « pas du tout pour Leboncoin, ne le mets pas dans les paramètres »). La carte « Ta clé Photoroom » vit sur l'écran Vestiaire, **pas dans Paramètres** (`detourage-reglage.cjs` le refuse). Studio photo : détourage local gratuit (U²-Net, licences vérifiées). |
| **Palette** | ⚠️ 19 nov. (Julien : « drastique, nouveau, totalement différent ») : **« VRM natif »**, le SEUL design (`docs/design/NATIF.md`, `src/natif/`, jetons `--n-*`) : structure d'une app iOS/macOS (grands titres, listes groupées, 5 onglets égaux en bas, feuilles, trois volets à l'ordinateur), clair/sombre par `vinted_dark`, accent `#0068D6` rare, ambre = geste à faire. Plus de réglage « Style » ni d'« Ancien design » ; le « Verre dépoli » (15 nov.) est remplacé. Violet **REFUSÉ**, rouge = doublon de N° seulement. |
| **Sans abonnement** | ⛔ 8 nov. (Julien) : ni la lecture seule complète, ni la porte qui cache tout — **un extrait net (titres, 3 premières lignes de chaque liste), le reste flouté, `inert`, aucune action ni export, aucune écriture** ; rien n'est supprimé. Ne pas rendre le reste lisible (`src/abonnement/apercu.js`, banc `abonnement-propre`). |
| **Ventes masquées** | ⚠️ 29 oct. : **on ne peut plus masquer une vente** (« on ne doit plus pouvoir les masquer ») ; `vinted_sales_hidden` n'est plus lu nulle part. Les ACHATS masqués restent. |
| **Saisie « N° + Entrée »** | Retirée de Ventes, Colis, Annonces, Leboncoin, eBay (29 oct.) ; la loupe « Tout sur le N° » et la saisie du Stock restent. |
| **Bloc « offres à trancher » des emails dans Messages** | Retiré le 24 oct. sur sa demande (moyennes par modèle et liens génériques compris). Ne pas le rétablir. Les offres dans les conversations restent. |
| **Offres** | ⚠️ 10 nov. (Julien) : **Solo 16,99 € = 1 compte vendeur par plateforme** (+ comptes d'achat illimités) · **Pro 19,99 € = comptes vendeurs ILLIMITÉS** — ne pas remettre la limite des 10 (lot BO annulé, `2026-11-10-pro-illimite.md`). |
| **Messages, comptes** | 12 nov. (Julien) : comptes SÉPARÉS — compte de l'onglet d'abord, puis chaque autre compte ; du plus récent au plus ancien DANS chaque groupe. Ne pas mélanger. |
| **403 de Vinted** | 12 nov. : l'extension garde la pause sur TOUT 403. |
| **Discrétion** | 12 nov. VALIDÉ : temps d'écriture et messages variés, plafond par jour en plus des 50/h, rythme irrégulier, attente après l'ouverture de Vinted, jamais deux comptes à la fois sur un ordinateur ni la même action partout au même moment, compte neuf en douceur, offres selon l’heure, republication par petits groupes, baisses irrégulières, arrêt + alerte au 1er captcha, santé du compte. REFUSÉ : blocage auto la nuit, étalement des messages aux favoris sur la journée. « X € conseillé » gardé mais mesuré. Mode prudence : la relecture des ventes à chaque visite RESTE ; historique complet ⇒ seulement le nouveau. |
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

- **VRM natif** (19 nov., remplace « Verre dépoli ») : `src/natif/` (jetons `--n-*`, couche `@layer vrm-natif`, composants `Page`, `Groupe`, `Rangee`, `BarreOnglets`…), contrat `docs/design/NATIF.md`, mode d'emploi `docs/design/NATIF-composants.md` ; mode sombre CHOISI (`vinted_dark`). Une règle sur la racine (html, body, `.vrm-app-shell`, `.vrm-main`) ne s'écrit plus en `:has(...)` : un drapeau `data-vrm-dN` posé par `src/drapeauxRacine.js` (`node scripts/alleger-has.cjs`, banc `drapeaux-justes`).
- **Quatre formes de bouton, aucune autre** : `.sb-btn-plein` (rond d'encre, **UN par écran** au plus),
  `.sb-touche`, `.sb-rond`, `.sb-lien` ; une rangée ou une tuile entière se touche. Aucun bouton inutile
  (navigation seule, doublon, explication, état) ; actif = enfoncé + diode. Matières : porcelaine
  (tuiles), verre (barres, plan de liste), plaque gravée (N°). Gestes globaux : le disque « + »
  (`audit-studio`, banc `studio-coque`). Cibles au doigt **44 px** affichés.
- Une même phrase sur chaque ligne est UNE phrase (dans l'en-tête du groupe) ; le même
  nombre ne s'écrit jamais deux fois sur un écran ; pas de « n/d ».
- Un nom d'icône absent de `ICON_PATHS` ne dessine rien sans erreur (`audit-icones`).
- **Tout nouveau texte visible passe par `tr()`** (`src/i18n/`, clé d'abord dans `fr.js` puis en/es/it/de ; `audit-traduction`, méthode : `docs/passation/2026-11-11-traduction.md`).
- « Quoi de neuf » : chaque lot visible ajoute sa ligne dans `src/nouveautes.js` (titre ≤ 8 mots, écran cible ; `audit-quoi-de-neuf`).
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
| `prixattente` `baisseregle` `masquerailleurs` | `prixAttenteTick` · `regleBaisseTick` · `masquerAilleursTick` | **5.409.0** (19 nov.) | « Changer le prix » en UN geste : `cmd_prix_{id}` (prix vu, `confirme`, 24 h) exécuté par l'extension ou mis en attente ; baisse par RÈGLE (`vinted_baisse_regle`, éteinte par défaut, plancher prix mini / achat + 10 %) ; vendue ailleurs ⇒ masquée sur Vinted (`vinted_masquer_ailleurs`, geste appris seulement, réversible) — compte de l'onglet, 45/h, journal |
| `comptebloque` | `pauseCompteBloqueDit` | **5.409.0** (19 nov.) | compte Vinted bloqué PROUVÉ + SON choix « pause » (`vrm_comptes_bloques`) ⇒ gestes automatiques et séries refusés `compte-bloque` (un clic passe), remis quand Vinted débloque ; règle `<compte-bloque-regle>` de `src/compteBloque.js` |
| `suivicolis` | `noterAchatsExpedies` | **5.409.0** (19 nov.) | le n° de suivi d'un achat qui passe « expédié » lu sur le budget des colis ⇒ un colis à retirer dit ce qu'il contient seul (plus de « Relier l'achat ») |
| `publierfiche` | `publierFicheSite` | **5.409.0** (19 nov.) | « Publier sur… » : une fiche de l'agent (n'importe quel site source) vers Leboncoin / Vestiaire ; fiche revérifiée, catégorie sûre exigée, marque Vestiaire cherchée dans SA liste, compte de l'onglet, 50/h, un dépôt à la fois |
| `listesvinted` `lbcformulaire` `vcrelu` | `listesVintedPourApp` · `formulaireLbcDe` · `categorieRelueVc` | **5.409.0** (19 nov.) | couleurs Vinted publiées (`vinted_listes`) ; formulaire Leboncoin appris par catégorie (`lbc_formulaires`) ; catégorie Vestiaire relue dans la réponse du dépôt ; photos i.ebayimg.com par le fond |
| `captejournal` | `journalCapte` | **5.409.0** (19 nov.) | « Depuis ta dernière visite » : ce que l'extension a capté (ventes, codes, messages) dit dans une feuille à l'arrivée, chacun mène à l'élément |
| `etatici` | `etatIciPourApp` | **5.409.0** (19 nov.) | la page « Extension » : ce navigateur (id), onglets vinted/leboncoin/vestiaire ouverts, comptes ouverts et lus (48 h), verrou « un autre compte vient d'agir », attente après l'ouverture — dits AVANT le geste ; lecture locale seule, rien dans le plafond |
| `suivisliste` | `numerosDuTrajet` | **5.403.0** (17 nov. ; 5.401/5.402 réservées par d'autres lots) | TOUS les n° de suivi d'un achat (trajet à deux transporteurs : `carriers[]`, `current_carrier`, `details[].carrier`) rangés en scalaires (`suivisVinted`, `transporteursVinted`, `suiviCourant`, `suivisLusAt`) ; une ligne d'avant (sans `suivisLusAt`) relue EN PREMIER, mêmes bornes ; « liste lue » ⇒ l'app ne propose plus, elle relie par identité |
| `fichepublier` `empreinteebay` | `annoncerFicheAPublier` · `empreintesImagesPourApp` | **5.400.0** (17 nov. ; 5.395 sur sa branche, servie après la 5.399) | « Ouvrir Vinted » d'une fiche (SON clic) ⇒ la 1re page de dépôt (30 min) montre et réserve LE N° DE LA FICHE, lié à l'annonce créée (`items[id].fiche`) ; l'empreinte d'une photo `i.ebayimg.com` (droit d'hôte, sans cookie, 5/demande, 60/h, empreinte seule) pour « même photo » eBay |
| `memephotosure` `versementsauto` `photovrm` `vcaimes` | `verifFineUnTour` · `ordrePlusRecentes` · `noterPhotosVrm` · `offrirAuxAimesVc` | **5.393.0** (16 nov. ; 5.386–5.392 jamais servies) | « Même photo · sûr » : 2e mesure sur les deux images (empreinte ≤ 10 ET s ≥ 0,85 ET r ≥ 0,998), 6 couples/h dans le budget de lecture, eBay toujours « à vérifier » ; dates de versement lues du plus récent ; photos réglées par Republier reconnues ; Vestiaire : offres aux « aimés » comme Vinted (son clic, compte de l'onglet, 15/h) |
| `memephoto` | `empreintesSitesUnTour` | **5.384.0** (15 nov.) | « Même photo · à relier » : empreinte des photos Leboncoin/Vestiaire (compte de l'onglet, 1 image/45 s, ≤ 8 des 20 lectures/h, empreinte seule) ; proposition seulement à distance ≤ 12 (`SEUIL_MEME_PHOTO`), deux paires possibles ⇒ il choisit ; relier = SON clic |
| `numerotes` | `annoncerNumerotes` | **5.382.0** (15 nov.) | les N° neufs que VRM vient de donner aux annonces publiées hors de VRM (app Vinted) dits une fois : bandeau, notification, et « VRM a numéroté » dans la carte du logo (identités `id:N°`, compte de l'onglet) ; « je numérote moi-même » ⇒ l'app DEMANDE le N° de chaque nouvel article |
| `lbccriteres` | `criteresFicheLbc` | **5.381.0** (15 nov.) | Publier partout : la catégorie, l'univers et le type Leboncoin posés depuis la table `src/correspondances.js` (par `catalog_id` Vinted, jamais le titre) ; pas posé ⇒ rien publié, dit |
| `relevemois` | `apprendreRecetteReleve` | **5.378.0** (15 nov.) | relevé du porte-monnaie d'un mois passé : adresse APPRISE de son propre geste (Porte-monnaie → Historique → un mois), mois listés par Vinted seulement, 2 par visite, budget de lecture ; ne date une vente qu'après ≥ 5 accords avec le détail « Commande finalisée » et 0 désaccord (`src/versementReleve.js`) |
| `popupcapte` `cartelistes` `favoriscoches` | `annoncerCapte` · `carteListes` · `listeFavTriee` (vrm-badge.js) | **5.377.0** (14 nov.) | « VRM a capté · 2 nouvelles ventes » près du logo et dans l'app (par identité, une fois, réglage partagé) ; carte Favoris · Annonces · Ventes du compte de l'onglet, autres comptes floutés `inert` ; favoris du plus récent, cochés |
| `remiseprix` | `remisePermise` | **5.376.0** (14 nov.) | « Remettre les prix » d'un solde : la seule hausse des chemins de baisse (Vinted, Leboncoin, Vestiaire), `remise` + `confirme` + prix = l'origine mémorisée, sur son clic |
| `importpasse` | `importerAnnonces` | **5.375.0** (13 nov.) | « Import de ton passé · 340 / ~1 200 ventes » : 12 mois (horizon par date), annonces d'un trait, état noté après chaque page, souci dit ; `import_vinted_{uid}` v 2 |
| `favoriattente` | `attendreOffreMessage` | **5.372.0** (12 nov.) | favoris : après l'offre ACCEPTÉE, 8 à 20 s au hasard (jamais deux fois la même valeur) puis le temps d'écriture ; attente dans `chrome.storage.local` (`vrmFavoriAttente`), reprise par un worker neuf (`reprendreMessagesFavoris`) ; Tout arrêter, captcha, pause, autre compte, onglet fermé ⇒ le message ne part pas, dit |
| `suivinumero` | `suiviDeTransaction` | **5.372.0** (12 nov.) | chaque achat en cours (payé, en attente de livraison, expédié, au point, livré sans n°) reçoit n° de suivi + transporteur + point de destination (détail de la transaction quand le suivi ne les porte pas), 6 lectures/h ; codes de retrait cherchés aussi quand Vinted demande son geste ou que le suivi dit « disponible » |
| … | … | … | les capacités de la 5.45 à la `lbcfiche` (12 nov.), puis `confirmer` à `favorisliste` (13 nov.), puis `favoris` à `favorisperso`, `vcsession` à `vcfiche`, `favorisauto` à `republierquestion` et `lbcfil` à `avis` (14 nov.), puis `ventesfusion` à `cartesansonglet` (5.323–5.329), `comptepush`, `cartecode`, `cartecadre`, `numerodescription`, `lbcclair`, puis `baisseprix` à `repubdepart` (5.336–5.372, déplacées le 19 nov.) : déplacées telles quelles dans `docs/passation/historique-vinted-extension.md` — `EXT_CAPACITES` reste la vérité |
| `vccategorie` | `categorieVcDemandee` | **5.399.0** (16 nov. ; 5.397 sur sa branche, servie après la 5.398) | « Publier partout » envoie la catégorie Vestiaire ; posée seulement si chaque libellé existe tel quel dans le catalogue capté, sinon dépôt ouvert sans publier |
| `relueoffre` | `relireOffre` | **5.398.0** (16 nov.) | l'offre auto relue depuis l'onglet juste avant le geste ; plus en attente ⇒ rien |
| `salutation` | `texteJamaisRepete` | **5.398.0** (16 nov.) | jamais deux fois de suite le même texte (favoris, refus) : seule la salutation change |
| `favorisliste2` | `cochablesApercu` | **5.407.0** (17 nov.) | carte vinted.fr, segment Favoris : la LISTE des favoris du compte de l'onglet (encore en vente, du plus récent), une case 44 px chacun, déjà contactés grisés avec la raison, filtres (annonce, « pas encore contactés »), pages de 100 (« Voir les 100 suivants »), choix gardé par compte, 15 par heure (les autres restent cochés, « Envoyer les 15 suivants à 20:45 ») ; « Envoyer à N favoris » ⇒ récapitulatif ⇒ « Confirmer l'envoi » ; `lancer` n'accepte que les cochables de l'aperçu lu < 30 min |
| `actionplein` `carte5` | `avecActionPlein` · `vrm-ui.js:habiller` | **5.406.0** (17 nov.) | écran plein pendant une action VRM sur vinted.fr (favoris, republier, baisse) : Vinted flouté, clic et clavier retenus, « Tout arrêter » / « Réduire », s'écarte sur un captcha ; carte design v2 et feuille commune `vrm-ui.js` (5 langues) |
| `repubetapes` `repubreprise` | `vbAvecEtapes` · `reprendreRepub` | **5.408.0** (17 nov.) | chaque étape d'une paire datée sur sa preuve (coffre · brouillon · supprimée · en ligne), dite sur l'écran plein ; « Reprendre » sur son clic relit chez Vinted et finit une paire interrompue (jamais deux en ligne) ; mise en ligne interrompue relue, alarme à l'heure ; forme de chaque requête et refus (sans valeurs) dans `repub_trace_{uid}_{nav}` |

---

## 9. État actuel et décisions récentes
- **19 nov. · Publier sur… : fiche neutre + agent sans IA (ext. `publierfiche`, 5.409)** : tables par champ et par site dans les deux sens, Vinted cible par `creerVintedFiche`, une question groupée par article, réponses retenues (`vrm_agent_publier`), l'extension publie, catégorie relue, formulaires Leboncoin appris. `2026-11-19-publier-agent.md`. Geste : publier UN article Leboncoin → Vestiaire et regarder.
- **19 nov. · Train du 19 nov. (ext. 5.409.0, branche `claude/integration-19nov`)** : un seul lot d'extension pour tout le train. Décisions « 1, 2, 3, 4 oui » : §3. `2026-11-19-demandes-julien.md`. Geste : installer 5.409, appliquer rien de neuf (048 déjà appliquée).
- **19 nov. · VRM natif, coque (natif-fondation)** : 5 onglets égaux en bas, titre et barre latérale natifs, « Plus » derrière la photo du profil (`src/natif/`). `2026-11-19-natif-fondation.md`. Geste : aucun.
- **19 nov. · Lisible partout (lisible-partout)** : un seul style, habillages « VRM »/« Apple »/ancien design retirés, aucun texte blanc sur clair. `2026-11-19-lisible-partout.md`. Geste : aucun.
- **19 nov. · Vite et sans bug (vite-et-sans-bug)** : `:has` de racine remplacés par des drapeaux `data-vrm-dN` (`src/drapeauxRacine.js`, banc `drapeaux-justes`). `2026-11-19-vite-et-sans-bug.md`. Geste : aucun.
- **19 nov. · Aujourd'hui natif (aujourdhui-propre)** : tes chiffres d'abord (jour, semaine, mois), « À régler » rangé dans chaque onglet. `2026-11-19-aujourdhui-propre.md`. Geste : aucun.
- **19 nov. · Compléter (reprise-completer)** : une question à la fois (prix d'achat, prix mini, N°) ; prix d'achat repris du reçu. `2026-11-19-completer-infos.md`. Geste : aucun.
- **19 nov. · Annonces à égalité (annonces-a-egalite)** : Leboncoin, eBay, Vestiaire portent prix mini, achat, N° comme Vinted (`vrm_articles_sites`). `2026-11-19-annonces-a-egalite.md`. Geste : aucun.
- **19 nov. · Changer le prix en un geste, baisse par règle, vendue ailleurs masquée (prix-sans-manuel)** : ext. `prixattente` `baisseregle` `masquerailleurs`. `2026-11-19-prix-sans-manuel.md`. Geste : allumer la règle s'il la veut.
- **19 nov. · Compte bloqué par Vinted (compte-bloque)** : VRM demande pause/garder, remet seul au déblocage (ext. `comptebloque`). `2026-11-19-compte-bloque.md`. Geste : répondre à la question pour le compte bloqué.
- **19 nov. · Colis : ce qu'il y a dedans, seul (colis-achat-auto + codes de retrait en liste, PR #1273)** : plus de « Relier l'achat » (ext. `suivicolis`). `2026-11-19-colis-achat-auto.md`. Geste : aucun.
- **19 nov. · E-mails comme Mail (emails-mail)** : segments en haut, liste en grand, l'e-mail à côté ; « Relier ma boîte » pas à pas (Gmail, Outlook, iCloud), essai vérifié en direct. `2026-11-19-emails-mail.md`. Geste : aucun.
- **19 nov. · Page Extension (extension-claire puis extension-utile)** : UN endroit pour l'extension et les comptes, dit avant le geste (ext. `etatici`) ; grand panneau, feuille « Depuis ta dernière visite » (ext. `captejournal`), rythme favoris 40–90 s, `audit-actions-gardees`. `2026-11-19-extension-claire.md`, `2026-11-19-extension-utile.md`. Geste : aucun.
- **19 nov. · Capacité 3 000 vendeurs (capacite-3000)** : mesures et plan ; Vercel reste Hobby, 048 appliquée, trains 1–2/jour. `docs/capacite-3000.md`. Geste : aucun.
- **19 nov. · Ventes natif (ventes-comme-avant)** : À envoyer · En route · Terminées, rangée = titre sur 2 lignes + N° + date limite (la place dans la fiche), plein collé au-dessus des onglets, détail à droite à l'ordinateur. `2026-11-19-ventes-comme-avant.md`. Geste : aucun.
- **19 nov. · Prix d'achat repris du reçu (décision « 2 oui »)** : achat relié par identité + reçu lu et juste ⇒ son montant posé seul (`src/prixAchatRecu.js`, `champsSiVide` : une saisie gagne toujours), jamais un lot, dit une fois ; l'atelier « Compléter » n'en garde pas de copie. `2026-11-19-completer-infos.md` (fin). Geste : aucun.
- **19 nov. · Codes de retrait parfaits** : 5 colis sur 16 jamais lus chez Mondial Relay (code postal du point refusé, reproposé sans fin) ⇒ l'essai par le code postal prouvé ; codes de consigne, mêlés, en groupes, UPS/InPost lus ; consigne ≠ comptoir (deux passes) ; « Nouveau code de retrait » en direct (veille `email_track_*`, `panel_colis_relais`). `2026-11-19-retraits-parfaits.md`. Geste : aucun. Geste : aucun.

Une ligne par chantier ou décision, le plus récent d'abord (les lignes du 17 nov. : `historique-divers.md`, fin). Détail : le fichier
d'historique du thème (cherche le titre ou la date).

**Extension servie : 5.409.0** (19 nov. : un seul lot pour le train — prix en attente, baisse par règle, vendue ailleurs masquée, compte bloqué, suivi des achats expédiés, page Extension, « Depuis ta dernière visite » ; avant, 17 nov. : 5.408 republication parfaite — chaque étape visible, reprise ; 5.407 favoris en liste à cocher ; 5.406 carte v2 ; 5.403 tous les n° de suivi d'un achat à deux transporteurs ; avant, 5.400.0 extension-restes — InPost = Mondial Relay, N° de la fiche à « Publier », empreintes eBay ; règles d’achat recopiées ; contient 5.399 plateformes-restes — catégorie Vestiaire à « Publier partout » ; contient 5.398 favoris et offres, et aussi 5.386 verre de la carte, 5.388 même photo sûre, 5.390 versements, 5.392 deux comptes/aimés Vestiaire — jamais servies seules). **À lire en premier : `docs/passation/2026-11-16-passation-generale.md`** (la plus complète : en ligne, prêt, en pause, en file, refusé, gestes), puis `2026-11-16-passation.md`, `2026-11-10-passation-finale.md` et `2026-11-09-passation-generale.md` (puis, pour l'ancien, `2026-11-07-passation-generale.md` et `2026-11-02-liste.md`). **Production** : https://vrm.center,
vérifier par `curl https://vrm.center/api/sante`.

### Gestes encore attendus de Julien
- Facture Pro : compléter « Ma facture » (Argent → Factures : SIRET, forme, régime de TVA, son e-mail) ; poser `RELANCES_SMTP_*` + `RELANCES_EXPEDITEUR` (SPF/DKIM, Brevo 300/j) — VRM envoie par défaut.
- Installer l’extension **5.409.0** (19 nov. : remplacer le dossier, puis ⟳ dans CHAQUE Chrome ; Orion : `VRM-Orion-dossier.zip` ; mesuré le 19 nov. : Chrome 5.406, 5.400, 5.329, Orion 5.377, 5.368, 5.336). La liste complète et à jour des gestes : `docs/passation/2026-11-09-passation-generale.md` §5.
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
  confirmation d'email obligatoire ; (pour Discord) activer le fournisseur Discord et « Allow manual linking » (lot DJ6).
- Migration **016** (mode équipe) : pas à pas sans terminal dans `2026-11-11-equipe-pret.md` §4.
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
src/ecrans/*.jsx                écrans découpés d'App.jsx, chargés à la demande (scripts/decouper-app.cjs ; audits : scripts/_source-app.cjs)
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
