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
| **Piloter souris / clavier** | ⚠️ 20 nov. soir (Julien : « on fait absolument tout comme Bleam ») : **PERMIS** pour la republication par le formulaire de Vinted (`recreerParFormulaire`, `vrm-formulaire.js`) et la séquence des favoris (`sequenceFavoriBleam`) — clics de l'extension `isTrusted:false` ASSUMÉS (prévenu une fois du risque). **REFUSÉ** : tout maquillage (isTrusted, debugger/CDP, souris inventée), photos « anti-doublon », empreinte/IP par compte (Bleam Cloud). Écran plein `avecActionPlein` pendant tout le travail. `2026-11-20-comme-bleam.md`, `2026-11-20-bleam-suite.md`. |
| **Modifier les photos pour tromper / changer de compte** | Refusé : Vinted relie les comptes par appareil, navigateur, adresse, paiement. (Les réglages photo de Republier servent la présentation, pas à tromper.) |
| **Supprimer une annonce Vinted automatiquement** | Refusé (irréversible). Supprimer passe toujours par son clic (Republier, ou Leboncoin « Supprimer », confirmé). |
| **Baisse de prix par règle** | ⚠️ 19 nov. (« 1 oui ») : **PERMIS**, éteinte par défaut, un réglage par compte (−5/−10/−15 % après 7/14/30 j sans vente), appliquée par l'extension dans ses plafonds (45/h, réserve 5, prudence, arrêt au captcha), au journal. **Plancher** : prix mini, sinon achat + 10 % ; ni l'un ni l'autre ⇒ aucune baisse (`src/reglesAuto.js`, `regleBaisseTick`). |
| **Vendue ailleurs ⇒ masquée sur Vinted** | ⚠️ 19 nov. (« 3 oui ») : vente PROUVÉE sur un autre site ⇒ l'annonce Vinted est MASQUÉE (réversible) par l'extension, compte de l'onglet, dans les plafonds, geste rejoué seulement s'il a été appris ; vente annulée ⇒ démasquée. La SUPPRESSION reste son toucher (`masquerAilleursTick`). |
| **Prix d'achat** | ⚠️ 19 nov. (« 2 oui », remplace l'ancien §2.5) : le montant du REÇU de CET achat (par identité) se pose seul ; jamais deviné, un lot jamais divisé, une saisie jamais écrasée (`src/prixAchatRecu.js`). |
| **Gestes d'envoi** | ⚠️ 19 nov. (« 4 oui ») : « Préparer mes colis », « Je dépose », la tournée et « Emballer » sont **RETIRÉS** ; le dépôt est constaté par le suivi du transporteur ; « Imprimer N bordereaux » depuis Aujourd'hui. Ne pas les remettre. |
| **Messages aux favoris** | **Permis sur sa demande** (24 oct., refait « comme Vintex » le 29 oct., 5.280-5.281) : sur son clic, file serveur à autorisation unique, offre Vinted réelle, rythme « comme Vintex ». ⚠️ Le plafond de 10 messages/60 min de la file est **RETIRÉ (sa décision)** ; reste le plafond d'actions de l'extension. ⚠️ 19 nov. (« on garde toujours le temps aléatoire ») : rythme **au hasard 20 à 60 s** (21 nov., 5.419, sa demande ; 40 à 90 s avant) entre deux messages par défaut (jamais deux fois le même temps), « Plus prudent » 2 à 4 min, plus le temps d'écriture ; plafonds inchangés (15/h, 50/h, jour, prudence) — `api/_lib/favoris-file.js` `delaiRythme`. Leboncoin : il ne dit pas QUI a mis en favori, VRM n'écrit à personne. |
| **Plafond d'actions** | ⚠️⚠️ **50 actions/heure/compte PAR DÉFAUT (sa décision du 29 oct.), et depuis le 20 nov. (« vas-y fais ») SA CADENCE PAR COMPTE**, réglée dans Paramètres du panneau de l'extension (5.410, `vinted_cadence`) : favoris/h 15 par défaut (1–60), actions/h 50 par défaut (10–100), plafond du jour réglable (déf. Discrétion), pause entre messages 20–60 s par défaut (5.419), réglable de 20 s à 4 min, **toujours au hasard** ; plus vite ⇒ confirmation. `RESERVE_GESTES` = 5 reste ; une republication réserve ses 3 gestes. **Ne PAS changer les défauts sans qu'il le demande.** NON réglables : arrêt au captcha + prudence, pause 403/429, un compte à la fois, une requête à la fois, compte de l'onglet. ⚠️ **Toutes les actions de plateforme se font dans le panneau de l'extension (l'app ouvre `lienPanneau`), les automatisations y sont réglées** (`audit-actions-app`, `audit-cadence`). Budget de LECTURE séparé (20/h). |
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
| `sauvegardereglages` `lbcoffres` `retoursautres` | `sauvegardeReglagesCarte` · `lbc-inject.js:offreMsgLbc` · `retourLbcDe` | **5.435.0** (22 nov.) | Paramètres du panneau : « Sauvegarder mes réglages » (fichier JSON daté, liste blanche, aucun secret ni personne) et « Restaurer » (avant/après, rien sans SON « Oui », un compte = le même uid ou SON choix) ; offre Leboncoin captée dans le fil (forme apprise) et notifiée une fois ; retours Leboncoin/Vestiaire/eBay par `api/_lib/retour-vente-suivi.js` — `2026-11-22-apres-finale-ext.md` |
| `filevisible` `pauseapres` `reessai` `apprisclic` | `dansFile` · `fileGeste` · `peutReessayer` · `vrm-appris.js:apprendre` | **5.433.0** (21 nov.) | UNE file d'écriture (`vrmFile`) : panneau « File d'actions » (retirer, ↑↓ ce qui n'a pas commencé), « Pause après celle-ci » (panneau, écran plein, « En direct » de l'app) ; étape pas prête réessayée 2 fois (jamais un geste parti) ; bouton absent appris de SON clic, irréversible après « Oui » — `2026-11-21-ext-5433.md` |
| `gardeprix` `prixpartout` | `gardePrixEcriture` · `prixPartoutSites` | **5.432.0** (21 nov.) | toute écriture de prix ou d'offre passe par UNE garde (`src/gardePrix.js` : sous le plancher, > SON seuil 40 % sous le prix, ×10/÷10, ≤ 0) : à la main confirmation du chiffre, auto bloqué + journal ; « prix partout » par identité, un site à la fois — `2026-11-21-ext-5432.md` |
| `retoursuivi` | `capterSuivisRetours` | **5.431.0** (21 nov.) | le colis RETOUR d'une vente de CE compte (440, vendeur) suivi dans les bornes du suivi des achats (6/h, 2 par visite, mémo 3 h) ⇒ `harvest_{uid}_retour_{tx}` ; l'app le montre dans « Retours et litiges », notification « Retour arrivé » une fois — `2026-11-21-retours-suivi.md` |
| `noteacheteur` `traductionlocale` | `noteAcheteurLue` · `vrm-badge.js:tradBulle` | **5.430.0** (21 nov.) | note de l'acheteur (« ★ 4,9 · 132 évaluations », ambre ≤ seuil ou compte neuf) sur offres et conversations, lue (mémo 7 j, conversation rangée, sinon profil dans le budget de LECTURE) ; offres auto, Agent VRM, relance : JAMAIS d'acceptation ni de contre-offre seule ≤ SON seuil (1,5 ★) ni sur une note pas lue (`<note-acheteur-regle>`, `src/noteAcheteur.js`) ; à la main : avertissement ; « Traduire » sur l'appareil (Translator/LanguageDetector de Chrome, aucun service), absent ⇒ dit — `2026-11-21-ext-5430.md` |
| `depotprepare` `depotpanneau` `ordrephotos` `suiviboost` | `depotTick` · `vrm-depot.js:depotHtml` · `vrm-formulaire.js:nomsFichiers` · `noterSuiviAnnonces` | **5.429.0** (21 nov.) | « Préparer » une fiche dans l'app puis « Déposer N sur Vinted » au panneau (brouillon ou publier, par l'interface, relu, N° lié, jamais deux dépôts, frise) ; couverture en 1re, ordre des photos relu ; relevé journalier pour « boost rentable » ; « Republier maintenant » direct — `2026-11-21-ext-5429.md` |
| `alertemasquee` `courbeannonce` `endirect` | `masquesConnusLocaux` · `noterCourbes` · `etatDirectPourApp` | **5.428.0** (21 nov.) | masquée PAR VINTED seulement (ni par lui — sa requête vue —, ni par VRM — journal), titre, taille, raison si Vinted la donne (jamais vue en base : « ne dit pas pourquoi »), conseil, une alerte, levée ; courbe vues/favoris par annonce et par jour (`courbes_annonces_{uid}_{nav}`, 120 j, jamais interpolée) ; « En direct » (Aujourd'hui, Extension) + « Tout arrêter » — `2026-11-21-ext-5428.md` |
| `retirerpartout` | `retirerPartoutTick` | **5.426.0** (21 nov.) | vendue PROUVÉE sur un site ⇒ ses autres annonces (identité) retirées, réversible : Leboncoin en pause par la page (réglage + confirmation), Vestiaire dit ; annulée ⇒ remise ; sonne à 30 min — `2026-11-21-ext-5426.md` |
| `relances` `triconversations` | `relancesAcheteursCarte` · `triConversationsCarte` | **5.425.0** (21 nov.) | Commandes → « À relancer » : livrée pas confirmée (≥ 2 j) / au point relais pas retirée (≥ 3 j, garde estimée par le transporteur LU), statuts PROUVÉS, litige jamais ; message poli prêt (ses versions, 5 langues, langue de la conversation), SON toucher ou lot confirmé ; une relance par commande et par motif (2ᵉ s'il l'autorise), registre `vrm_relances_{uid}` AVANT le geste, rappel relais de l'après-vente sans doublon ; automatique éteint ; Messagerie triée (lecture seule) — `2026-11-21-ext-5425.md` |
| `publieraussi` | `publierAussiLancer` | **5.424.0** (21 nov.) | « Publier aussi sur… » LBC / Vestiaire depuis SON annonce Vinted : avant/après, rien ne part s'il reste « à choisir », dépôt par l'interface, relu avant « Publier » — `2026-11-21-ext-5424.md` |
| `modifavantapres` | `preuveModif` | **5.423.0** (21 nov.) | avant / après de chaque modification (prix, republier, masquer) avant de lancer ; frise des étapes cochées sur leur preuve (écran plein, panneau) ; bilan, « Reprendre » — `2026-11-21-ext-5423.md` |
| `pushcapte` `repubprogramme` | `pousserCapte` · `atelierProgrammer` | **5.422.0** (21 nov.) | vente/offre/message captés ⇒ push (identités relues, une fois, 2 min) ; atelier « Programmer à … » (alarme, un par compte, jamais répété) ; `2026-11-21-ext-5422.md` |
| `reponsesrapides` `lotfavoris` `relanceoffres` `agentvrm` | `reponsesRapidesCarte` · `lotsFavorisCarte` · `relancesCarte` · `agentTick` | **5.421.0** (21 nov.) | réponses rapides SANS IA (mots-clés 5 langues, SES modèles `vrm_reponses_rapides`, par identité, Envoyer = son toucher) ; lot aux favoris (receiver_id, ≥ somme des planchers) ; relance des offres ratées (une par acheteur et article) ; Agent VRM éteint, Essai d'abord, « à toi » sinon — `2026-11-21-ext-5421.md` |
| `bordereauxunpdf` `vacancesinterface` `favorisreponses` `santecomptes` `favorisetapes` `ventesfavoris` | `bordereauxUnPdf` · `vacancesCarte` · `noterReponsesFavori` · `santeComptes` · `vrm-badge.js:etapesEnvHtml` · `attribuerVentesFavoris` | **5.420.0** (21 nov.) | « Imprimer N bordereaux » = UN PDF (pdf-lib MIT embarqué, les PDF déjà rangés, une page par bordereau) ; mode vacances par l'interrupteur des réglages Vinted (SA confirmation, preuve à l'écran) ; 1re réponse d'un favori (identité) ⇒ ligne `favoris_reponses_*`, taux de réponse et ventes obtenues (`src/favorisVentes.js`, Pilotage) ; page Santé (Bon · Attention · Pause) ; favoris en 4 étapes (rien avant « Lancer »), l'automatique avec ses réglages enregistrés — `2026-11-21-ext-5420.md` |
| `favorisenvoi9` `commandeslot` | `vrm-badge.js:envTauxHtml` · `bordereauxCommanderCarte` | **5.419.0** (21 nov.) | favoris : envoi dès « Confirmer » (plus d'attente après l'ouverture pour SON toucher), pause 20–60 s au hasard, taux de réduction choisi et gardé par compte, message pré-rempli modifiable ; Commandes : cases, « Commander / Imprimer N bordereaux » (Vinted seulement) — `2026-11-21-ext-5419.md` |
| `favorisperso2` | `choisirMessageFavori` | **5.417.0** (21 nov.) | messages aux favoris personnalisés (versions, lot, variables sues seulement, règles la plus précise puis la plus haute, offre %, aperçu, stats) — `2026-11-21-favoris-perso.md` |
| `lbcinterface` | `gesteLbcInterface` · `lbc-ecrire.js` | **5.416.0** (21 nov.) | Leboncoin « on ne fait plus les requêtes » : pause, suppression (son clic confirmé), prix, réponses et « Leur écrire » se font PAR LA PAGE (onglet de travail, gestes appris de SON geste à la main, « fait » sur l’envoi VU) — `2026-11-21-lbc-interface.md` |
| `connexionsimple` | `etatConnexion` | **5.415.0** (21 nov.) | fenêtre : UNE source d'état, une phrase, deux chemins (plein « Me connecter » ici ; contour « Relier par vrm.center », retour au site) ; « Se déconnecter » tient ; panne dite + « Réessayer » — `2026-11-21-extension-connexion.md` |
| `toutinterface` | `interfaceVinted` | **5.414.0** (21 nov.) | plus AUCUNE écriture Vinted par requête : clic et saisie dans l'onglet de travail, vérifiés à l'écran ; « Directe » retirée — `2026-11-21-extension-interface.md` |
| `panneautelephone` | `vrm-badge.js:barreTelephone6` | **5.413.0** (21 nov.) | le panneau au téléphone / Orion (≤ 760 px), style de ses photos : 5 onglets égaux en bas + « Plus » (feuille), rangées empilées (vignette 48, titre complet, méta prix · date · étiquette), menus en feuille du bas, champs 16 px ; ordinateur inchangé — présentation seule ; `2026-11-21-panneau-telephone.md` |
| `vcecrireui` `vcfilpanneau` `vcaimespanneau` | `vc-ecrire.js:ecrire` · `filVcCarte` · `aimesVcCarte` | **5.412.0** (21 nov.) | Vestiaire au panneau : fil, réponse par l'INTERFACE (champ, bouton, adresse appris de SON envoi, vu sinon arrêt), « aimés » ⇒ leur conversation ; plus de requête d'écriture — `2026-11-21-vestiaire-messages.md` |
| `relaisprevu` | `relaisDestinationEscrow` | **5.411.0** (21 nov.) | point relais d'arrivée d'un achat en route (expédition de SA commande, budget lecture) ⇒ « En route vers ce point » — `2026-11-21-relais-prevision.md` |
| … | … | … | les capacités de la 5.45 à la `lbcfiche` (12 nov.), puis `confirmer` à `favorisliste` (13 nov.), puis `favoris` à `favorisperso`, `vcsession` à `vcfiche`, `favorisauto` à `republierquestion` et `lbcfil` à `avis` (14 nov.), puis `ventesfusion` à `cartesansonglet` (5.323–5.329), `comptepush`, `cartecode`, `cartecadre`, `numerodescription`, `lbcclair`, puis `baisseprix` à `repubdepart` (5.336–5.372) et `relevemois` à `memephotosure` (5.378–5.393), déplacées le 19 nov., puis `suivinumero` à `popupcapte` (5.372–5.377) et `salutation` à `vccategorie` (5.398–5.399), déplacées le 20 nov., puis `fichepublier` `empreinteebay` (5.400), `suivisliste` (5.403), `actionplein` à `repubreprise` (5.406–5.408), `favorisliste2` (5.407), `comptebloque` à `etatici` (5.409), déplacées le 21 nov., puis `prixattente` `baisseregle` `masquerailleurs` (5.409), `panneaucomplet` à `baissevc` (5.410.0), `panneaureste` `imprimerpanneau` (5.410.2), `repubformulaire` à `favfiltres` (5.410.3–5.410.4), déplacées le 22 nov. : déplacées telles quelles dans `docs/passation/historique-vinted-extension.md` — `EXT_CAPACITES` reste la vérité |

---

## 9. État actuel et décisions récentes
- **22 nov. · train du 21–22 nov. (app + ext. 5.434) (`claude/integration-finale`)** : personnel-compta (« Argent bloqué » corrigé, compte personnel hors totaux côté serveur, Comptabilite sort d'App.jsx), style-vintex, ux-reglages, relier-code, fiche-sites, transp-depenses, rentabilite, prio-recherche, retours-suivi ; extension 5.420 à 5.433 (et 5.427 visuel) réunies en UNE version **5.434.0** ; atelier : avant/après + « Programmer à… » + republier direct + file d'actions + garde du prix ; relier-retires ; Annonces « Vendue » = toutes les ventes PROUVÉES, tous sites, filtre Site compté. `2026-11-22-integration-finale.md`. Geste : installer la 5.434.0 dans CHAQUE Chrome (Orion : dossier 5.434.0).
- **21 nov. · train du 21 nov. (`claude/integration-21nov`)** : intégration de l'app sur l'ext. 5.419.0 (ext-5419 : favoris envoyés dès « Valider », taux et message pré-rempli, Commandes en lot) — fluidite (photos par `PhotoVinted`, `lectureBornee`), onglets-menu (5 onglets gardés, Menu sous la photo), annonces-dressing (liste/grille, compte bloqué, tableaux qui tiennent), ventes-lisibles, journee-stats (dont Transporteurs), argent-vintex ; relue pour les bugs. `2026-11-21-integration-21nov.md`. Geste : installer la 5.419.0.
- **21 nov. · Extension 5.418.0 : tout le travail du 21 nov. en un zip (`claude/integration-ext-5418`)** : ci-offres-panneau, relais-prevision, vestiaire-messages, panneau-telephone, extension-interface (plus aucune écriture Vinted par requête), extension-connexion, lbc-interface, favoris-perso. `2026-11-21-integration-ext-5418.md`. Geste : installer la 5.418.0, apprendre une fois Vestiaire et Leboncoin, essayer UNE republication et UN favori.
- **21 nov. · Panneau de l'extension au téléphone (ext. 5.413.0, `claude/panneau-telephone`)** : 5 onglets en bas + « Plus », rangées empilées, feuilles du bas, 16 px ; présentation seule, banc `panneau-telephone`. `2026-11-21-panneau-telephone.md`. Geste : installer la 5.413 (après l'intégration).

Une ligne par chantier ou décision, le plus récent d'abord (les lignes du 17, du 19 et les plus anciennes du 20 nov. : `historique-divers.md`, fin). Détail : le fichier
d'historique du thème (cherche le titre ou la date).

**Extension servie : 5.434.0** (22 nov. : les 5.420 à 5.433 en une version — file d'actions, garde du prix, avant/après, programmation, publier aussi, retirer partout, relances, courbes, note des acheteurs, traduction sur l'appareil, suivi des retours ; avant, 5.419.0, 21 nov. nuit : favoris immédiats, taux et message pré-rempli, Commandes en lot ; avant, 5.418.0, 21 nov. soir : 5.418.0 rassemble les 5.410.9 à 5.417 — interface seule, connexion, Leboncoin et Vestiaire par l'interface, favoris personnalisés, panneau au téléphone, points relais ; avant, 5.410.8, 21 nov. : favoris corrigés, onglet voilé, offre toujours ; 5.410.7 : favoris en tableau, onglet de travail épinglé ouvert d'abord ; 5.410.6 : fausse vérification corrigée ; 5.410.5 : onglet de travail comme Bleam, faux anti-robot ; 20 nov. nuit : tout « comme Bleam », 5.410.3 contenue ; avant, 5.410.2, 20 nov. soir : le panneau reste ouvert jusqu'à son ×, bordereau et livreur de chaque vente, « Pas revue depuis N j » ; avant, 5.410.1, 20 nov. : panneau de l'extension « comme Vintex », toute action de plateforme dedans, cadence par compte, republier fidèle + contrôle, intéressés Leboncoin, baisse Vestiaire ; avant, 5.409.0, 19 nov. : un seul lot pour le train — prix en attente, baisse par règle, vendue ailleurs masquée, compte bloqué, suivi des achats expédiés, page Extension, « Depuis ta dernière visite » ; avant, 17 nov. : 5.408 republication parfaite — chaque étape visible, reprise ; 5.407 favoris en liste à cocher ; 5.406 carte v2 ; 5.403 tous les n° de suivi d'un achat à deux transporteurs ; avant, 5.400.0 extension-restes — InPost = Mondial Relay, N° de la fiche à « Publier », empreintes eBay ; règles d’achat recopiées ; contient 5.399 plateformes-restes — catégorie Vestiaire à « Publier partout » ; contient 5.398 favoris et offres, et aussi 5.386 verre de la carte, 5.388 même photo sûre, 5.390 versements, 5.392 deux comptes/aimés Vestiaire — jamais servies seules). **À lire en premier : `docs/passation/2026-11-20-passation-generale.md`** (20 nov., la plus récente et la plus complète), puis `docs/passation/2026-11-16-passation-generale.md` (la plus complète : en ligne, prêt, en pause, en file, refusé, gestes), puis `2026-11-16-passation.md`, `2026-11-10-passation-finale.md` et `2026-11-09-passation-generale.md` (puis, pour l'ancien, `2026-11-07-passation-generale.md` et `2026-11-02-liste.md`). **Production** : https://vrm.center,
vérifier par `curl https://vrm.center/api/sante`.

### Gestes encore attendus de Julien
- Facture Pro : compléter « Ma facture » (Argent → Factures : SIRET, forme, régime de TVA, son e-mail) ; poser `RELANCES_SMTP_*` + `RELANCES_EXPEDITEUR` (SPF/DKIM, Brevo 300/j) — VRM envoie par défaut.
- Installer l’extension **5.434.0** (22 nov. ; avant 5.419.0, 21 nov. nuit ; avant 5.418.0, 21 nov. soir ; avant 5.410.8, 21 nov. ; avant 5.410.2, 20 nov. : remplacer le dossier, puis ⟳ dans CHAQUE Chrome ; Orion : `VRM-Orion-dossier.zip` ; mesuré le 19 nov. : Chrome 5.406, 5.400, 5.329, Orion 5.377, 5.368, 5.336). La liste complète et à jour des gestes : `docs/passation/2026-11-09-passation-generale.md` §5.
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
