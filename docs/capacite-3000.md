# VRM à 3 000 vendeurs — ce qui tient, ce qui casse, quoi changer

*19 novembre 2026. Remplace, pour le dimensionnement, la note du 29 octobre
(`docs/capacite-utilisateurs.md`, qui reste pour les contrôles de sécurité).*

Julien : « pour l'instant il n'y a que moi, alors imagine quand il y aura 2 000 /
3 000 utilisateurs ». Cette note dit, en mots simples, **ce qui a été mesuré**, **ce
qui casse en premier et à partir de combien**, **combien ça coûtera par mois**, et
**dans quel ordre faire les changements**. Tous les chiffres viennent de la vraie
base (lue en lecture seule, aucune donnée recopiée ici), des réglages Vercel et
GitHub, et des bancs du dépôt (données inventées).

> ⚠️ Un chiffre « à 3 000 » est une **estimation** : personne n'a encore 3 000
> vendeurs. Chaque estimation dit d'où elle vient. Avant d'ouvrir largement, un essai
> de charge sur une copie de préproduction (pas sur vrm.center) doit la confirmer
> (§ 6, étape 9).

---

## 1. Ce qui a été mesuré (19 nov.)

### La base (Supabase)

| quoi | mesure |
|---|---|
| Offre | **Supabase Pro**, taille de serveur **Micro** (1 Go de mémoire, 60 connexions au plus) |
| Taille totale | **269 Mo** — dont 111 Mo de deux copies de sauvegarde de septembre/octobre (`sauvegarde.app_data_20260930`, `…_20261002`) et 40 Mo de journal des écritures |
| Table `app_data` | **89 Mo** (11 Mo de lignes, 74 Mo de gros contenus compressés, 4,4 Mo d'index), 13 500 lignes, 9 comptes |
| Julien seul | **13 175 lignes, 43 Mo** stockés (compressés). Les autres comptes : moins de 0,4 Mo chacun |
| Ce qui pèse chez lui | transactions Vinted 10,3 Mo (1 422) · e-mails de bordereau avec PDF 7,0 Mo (248) · étiquettes 3,4 Mo (160) · conversations 3,3 Mo (1 376) · catalogue Leboncoin 1,2 Mo (une ligne, 3,4 Mo une fois ouverte) · `main` 188 Ko (471 Ko ouverte) |
| Lectures de la base | 1,63 million d'appels connectés en 61 jours ≈ **27 000 par jour**, **5 ms** en moyenne |
| Temps de calcul de la base | ≈ **270 s par jour** tous rôles confondus : la base dort 99,7 % du temps |
| La requête la plus coûteuse | l'écriture « comparer-et-échanger » d'une grosse ligne : **358 ms** en moyenne (4 084 fois) |
| Écritures | ≈ **6 800 par jour** (journal des écritures), autant de messages « temps réel » diffusés |
| E-mails reçus | **4 701 en 30 jours** (≈ 157 par jour, presque tous les siens) |
| Sécurité par vendeur (RLS) | correcte et rapide : `owner = (select auth.uid())`, index `(owner, id)` — une requête d'un vendeur ne lit que SES lignes, quel que soit le nombre de vendeurs |

### Les serveurs (Vercel) et les tâches planifiées

| quoi | mesure |
|---|---|
| Offre | **Vercel Hobby** (gratuite) : 12 fonctions au plus, journaux gardés 1 h, aucune mesure de durée (« Observability Plus » refusé : offre payante) |
| Erreurs serveur sur 7 jours | **aucune** |
| Mises en production | ≈ **8 à 10 par jour** ces derniers jours |
| Tâches planifiées | 2 par Vercel (matin, soir) + **9 par GitHub** (« colis toutes les 15 min », « notifications toutes les 15 min », « sondes toutes les 10 min »…) |
| ⚠️ Ce que GitHub fait vraiment | **2 à 3 passages par jour** pour chacune, au lieu de 68 à 144 : GitHub saute les tâches planifiées d'un dépôt public très actif. Le « statut des colis toutes les 15 min » passe en réalité 2 fois par jour. **C'est vrai dès aujourd'hui, pour Julien seul.** |
| Durée d'un passage | colis : 6,7 s pour les 8 comptes (8 en parallèle) ; notifications : 2 s ; sondes : 2 s |
| Le cron du matin | passe chaque vendeur, 8 à la fois, s'arrête de commencer un vendeur après 240 s, 60 s au plus par vendeur, reprend les oubliés le lendemain en premier (`api/_lib/cron-lots.js`) |

### Le chargement de l'app (téléphone)

| quoi | mesure |
|---|---|
| Ce qui part au démarrage | le morceau `App` **4,9 Mo** (1,53 Mo compressé) + sa feuille de style **2,4 Mo** (337 Ko compressée) + React et l'entrée ≈ **1,9 Mo compressés** au premier lancement |
| D'où vient le poids du morceau `App` | `src/App.jsx` lui-même : 5,6 Mo de code, 67 500 lignes ; à lui seul le composant des écrans principaux (`Comptabilite`) fait **2,26 Mo de code**, 40 % du fichier |
| Déjà à la demande | la carte (maplibre, 1 Mo), la 3D (three, 0,7 Mo), les langues étrangères, les écrans découpés (`src/ecrans/*`), le PDF |
| Lancement suivant | le service worker sert l'app depuis le téléphone : **≈ 18 Ko** de code téléchargés |
| Après chaque mise en production | chaque appareil re-télécharge l'app (≈ 1,9 Mo compressés), puis, 15 s après l'ouverture, **tout le reste de l'app pour le hors-ligne : 4,37 Mo compressés** (239 fichiers) |
| Lectures de la base à l'ouverture (banc, base au poids de la sienne) | Ma journée : ≈ **150 lectures, 3,0 Mo** (appareil neuf) · **146 lectures, 0,48 Mo** (lancement suivant) ; dont ≈ 26 lectures identiques refaites (budget `scripts/budget-vitesse.json`) |
| Au repos | onglet caché : 0 lecture ; visible : 3 lectures/min au plus (banc `charge-navigateur`) |

Les mesures avant/après des corrections de cette session sont au § 5.

---

## 2. Ce qui grandit avec quoi

| ce qui grandit… | …avec | exemples |
|---|---|---|
| **avec le nombre de vendeurs** | chaque vendeur ajoute la même charge | les tâches planifiées (chaque passage parcourt TOUS les vendeurs) ; les connexions « temps réel » ; les ouvertures de l'app ; la bande passante après chaque mise en production |
| **avec le volume d'un vendeur** | un gros vendeur coûte plus, les autres ne le sentent pas | sa taille de base, les octets lus à SON ouverture, le temps de SON passage dans les tâches (borné à 60 s) |
| **avec le carré du nombre de vendeurs** ⚠️ | chaque e-mail relit ce qui appartient à TOUS | la réception d'un e-mail qui n'arrive pas sur l'adresse unique de VRM relit le registre des adresses de tous les vendeurs (`lireRegistreEmails`) : N vendeurs × N vendeurs |

**Le « vendeur type » des calculs** : 1/5 de Julien (≈ 9 Mo de données, 30 e-mails,
1 300 écritures et 5 000 lectures par jour, 6 ouvertures de l'app). Julien est un
« gros vendeur » (plusieurs comptes, extension toujours ouverte). Si les vendeurs
ressemblent tous à Julien, multiplier les estimations par 5.

---

## 3. Ce qui tient, ce qui casse — et à partir de combien

Classé par **ordre d'arrivée**.

| # | ce qui casse | à partir de | pourquoi | gravité |
|---|---|---|---|---|
| 0 | **Tâches planifiées par GitHub** | **dès aujourd'hui** | GitHub saute 95 % des passages (2-3 par jour au lieu de 68-144) | colis, notifications groupées, sondes, factures : en retard de plusieurs heures |
| 1 | **Vercel Hobby** | **le premier client payant** | l'offre gratuite est réservée à un usage personnel non commercial (règles de Vercel) ; VRM encaisse des abonnements | contractuel : il faut l'offre Pro avant d'ouvrir |
| 2 | **Les e-mails hors adresse unique** | **≈ 500 vendeurs** qui reçoivent par la boîte commune ou le transfert Gmail | à N vendeurs, chaque e-mail relit ≈ N × 1 Ko ; avec 30 e-mails par vendeur et par jour : 30 × N² Ko par jour. À 530 vendeurs ≈ 250 Go/mois (tout le trafic compris dans Supabase Pro) ; **à 3 000 : ≈ 8 To/mois (≈ 700 $/mois)** et chaque e-mail met plusieurs secondes | coût et lenteur ; rien n'est perdu (un e-mail non rangé est rejoué) |
| 3 | **Le serveur de base Micro** | **≈ 300 à 500 vendeurs actifs** (estimation) | 1 Go de mémoire, 2 cœurs partagés, ≈ 15-20 connexions pour l'API : à 500 vendeurs ≈ 2,5 millions de lectures/jour, pointes ≈ 100/s, et les écritures de grosses lignes (358 ms chacune) | l'app ralentit d'abord le soir ; puis des erreurs « base injoignable » |
| 4 | **Les tâches qui parcourent tous les vendeurs** | **≈ 1 000 vendeurs** (estimation : 1,5 s par vendeur type, 8 en parallèle, 240 s par passage) | un passage ne finit plus : les derniers sont repris au passage suivant (rien n'est perdu, tout arrive plus tard) | rappels d'envoi et suivis en retard |
| 5 | **La bande passante après chaque mise en production** | **≈ 1 500 à 2 000 vendeurs** à 8 mises en production par jour | chaque appareil re-télécharge ≈ 1,9 Mo + 3,7 Mo (hors-ligne) à chaque nouvelle version ; 3 000 vendeurs × ≈ 3 versions vues par jour × 5,6 Mo ≈ **1,5 To/mois**, au-delà du 1 To compris dans Vercel Pro | coût (≈ 0,15 $/Go au-delà) |
| 6 | **Les connexions « temps réel »** | **≈ 500 appareils ouverts en même temps** | Supabase Pro en comprend 500 ; au-delà 10 $ par tranche de 1 000 | coût faible |
| 7 | **Le journal des écritures** | **jamais purgé** | une ligne par écriture : à 3 000 vendeurs types ≈ 4 millions de lignes/jour, ≈ 20 Go/mois | disque, sauvegardes plus lentes |
| — | **La séparation des vendeurs (RLS)** | **tient** | une requête d'un vendeur ne lit que ses lignes, par index, quel que soit N (vérifié : politique et index) | — |
| — | **Le stockage** | **tient** | 3 000 × ≈ 18 Mo sur disque ≈ 55 Go (8 Go compris, puis ≈ 0,125 $/Go) ≈ 6 $/mois | — |
| — | **Une ouverture de l'app** | **tient** (pour les autres) | ce qu'un vendeur lit ne dépend pas du nombre de vendeurs (banc `charge-50-vendeurs`) | — |

**La première limite technique** (hors GitHub, déjà cassée, et hors contrat Vercel) :
**la réception des e-mails hors adresse unique, vers 500 vendeurs**, puis **le serveur
de base Micro, vers 300 à 500 vendeurs actifs**. Les deux arrivent ensemble : c'est
vers **500 vendeurs** qu'il faut avoir fait les étapes 1 à 5 ci-dessous.

---

## 4. Ce que ça coûtera par mois (estimation, prix publics de novembre 2026)

| poste | aujourd'hui | à 500 vendeurs | à 3 000 vendeurs |
|---|---|---|---|
| Supabase Pro (offre) | 25 $ | 25 $ | 25 $ |
| Serveur de base | Micro (compris) | Small/Medium : 15-60 $ | **Large : ≈ 111 $** (XL ≈ 210 $ si les vendeurs ressemblent à Julien) |
| Crédit compris | −10 $ | −10 $ | −10 $ |
| Trafic sortant de la base | compris (250 Go) | compris | ≈ 360 Go ⇒ ≈ 10 $ **si l'étape 3 est faite** (sinon ≈ 700 $) |
| Disque | compris (8 Go) | compris | ≈ 55 Go ⇒ ≈ 6 $ |
| Temps réel | compris | compris | ≈ 10-20 $ |
| Vercel | 0 $ (Hobby, interdit au commercial) | **Pro : 20 $** par membre | 20 $ + trafic au-delà de 1 To (≈ 0-75 $ selon le nombre de mises en production) + temps des fonctions (≈ 0-30 $) |
| Tâches planifiées fiables (étape 1) | — | 0 $ (Vercel Pro les fait) | 0 $ |
| **Total** | **≈ 25 $** | **≈ 50 à 100 $** | **≈ 190 à 300 $ par mois** (≈ 0,06 à 0,10 $ par vendeur) |

À 16,99 € par vendeur et par mois, 3 000 vendeurs rapportent ≈ 51 000 € par mois ;
l'hébergement en coûte ≈ 0,5 %. **Le risque n'est pas le prix, c'est l'étape 3 pas
faite** (le seul poste qui grandit au carré).

---

## 5. Ce qui a été corrigé dans cette session (avant / après)

| correction | avant | après | preuve |
|---|---|---|---|
| **Hors-ligne : la langue du vendeur seule** — le service worker rangeait les dictionnaires anglais, espagnol, italien, allemand chez TOUT le monde à chaque mise en production | 4,37 Mo compressés (239 fichiers) par appareil et par version | **3,70 Mo** (231 fichiers) pour un vendeur en français : **−0,67 Mo (−15 %)** ; en anglais, ses deux morceaux anglais seulement | `scripts/audit-langue-hors-ligne.cjs` exécute le vrai `sw.js` (7 verts) ; `--prouve` : l'ancien est rouge (4) ; `audit-gestes-hors-ligne` vert |
| **Migration 048** (pas appliquée) : l'index des preuves d'adresse par adresse, et la purge du journal des écritures | la réception d'un e-mail lit tout le registre (293 pages pour 3 000 vendeurs inventés) | **6 pages** pour l'adresse reçue, même réponse ; purge bornée (≥ 30 jours, clé de service seule) | `scripts/audit-capacite-sql.cjs` sur PostgreSQL jetable (9 verts) |
| **Banc `chargement-propre`** : décalage de la mise en page (CLS), sauts visibles, captures toutes les 100 ms (390 px tactile, processeur ×4, 4G) | n'existait pas | mesure avant/après de Ma journée, Ventes, Annonces, Achats | `scripts/bancs/chargement-propre.cjs` |

*(Les mesures du banc de démarrage et du banc `chargement-propre` sont ajoutées
ci-dessous dès qu'elles ont tourné — la machine des bancs est partagée.)*

---

## 6. Ce qu'il faut changer, dans l'ordre

Chaque étape dit **qui la fait** : « code » = une session Claude ; « Julien » = un
geste dans un tableau de bord ou une décision.

1. **Tâches planifiées fiables** *(Julien + code, maintenant)*. Passer Vercel en **Pro**
   (obligatoire de toute façon, étape 2) : ses tâches planifiées tournent à l'heure, à la
   minute près, sans GitHub. Puis une session déplace les 9 tâches GitHub dans
   `vercel.json` (même adresse `/api/ship-reminders?moment=…`, même secret). En attendant,
   un service gratuit d'appel planifié (type cron-job.org) peut appeler les mêmes adresses.
2. **Vercel Pro** *(Julien, avant le premier client payant)* : 20 $/mois. Il lève aussi la
   limite des 12 fonctions et rend les mesures de durée lisibles.
3. **E-mails : lire seulement les preuves de l'adresse reçue** *(code + Julien, avant
   300 vendeurs)*. Appliquer la migration **048** (Julien, éditeur SQL), puis une session
   change `lirePreuvesProuvees` / `lireRegistreEmails` (`api/email-inbound.js`) pour ne
   lire que `data->>adresse=in.(adresses de livraison normalisées)` et les lignes
   `vrm_email_owners` qui les déclarent (à indexer de la même façon), en gardant TOUTES
   les règles du § 5 « Les emails » : conflit entre deux vendeurs ⇒ quarantaine, pas
   su ⇒ 503, preuve exigée. Les tests `capacite-securite` et `preuves-email-pagination`
   sont à réécrire pour la nouvelle lecture (mêmes cas, même verdict). Et pousser tous
   les nouveaux vendeurs vers l'adresse unique (`jeton@…`), qui ne lit pas le registre.
4. **Serveur de base plus gros, au bon moment** *(Julien)*. Tableau de bord Supabase →
   Rapports : quand le processeur dépasse 50 % en soirée ou la mémoire 80 %, monter
   d'une taille (Micro → Small → Medium → Large). C'est un redémarrage de quelques
   minutes : le faire la nuit. Repère : Small vers 200 vendeurs, Medium vers 800, Large
   vers 2 000 (à confirmer par l'étape 9).
5. **Purger le journal des écritures** *(Julien, après la 048)* :
   `select sauvegarde.vrm_purger_journal(90);` une fois par mois (ou une tâche planifiée).
   Et décider des deux copies de septembre/octobre (111 Mo) : les garder ailleurs, puis
   les retirer.
6. **Moins de mises en production par jour** *(décision de Julien)*. Regrouper les
   fusions en un ou deux « trains » par jour (comme le 18 nov.) : chaque version coûte
   ≈ 5,6 Mo par appareil. À 3 000 vendeurs, 8 versions/jour ≈ 1,5 To/mois ; 2 par jour ≈
   0,4 To (compris dans Vercel Pro).
7. **Tâches qui ne relisent que ce qui a changé** *(code, avant 1 000 vendeurs)*. Une
   colonne « dernière écriture » par vendeur (posée par la base à chaque écriture) ; les
   passages fréquents (colis, notifications) sautent un vendeur qui n'a rien écrit et
   n'a rien à expédier depuis le passage précédent. ⚠️ Jamais sauter un vendeur qui a un
   colis à envoyer ou un retrait en cours (un rappel manqué envoie une chaussure en
   retard) : la règle doit le prouver par un banc avant d'être livrée.
8. **Le poids du démarrage** *(code, à coordonner avec la session « vitesse entre
   onglets »)*. Le gros du morceau `App` est le composant `Comptabilite` (2,26 Mo de
   code, 40 % d'`App.jsx`). Le découper par écran avec l'outil existant
   (`scripts/decouper-app.cjs`, déplacements mécaniques) ferait partir chaque écran à sa
   première ouverture : estimation −40 à −60 % de code au premier lancement. Même chose
   pour la feuille de style (2,4 Mo, 337 Ko compressés, lue avant tout affichage).
   Le lancement suivant, lui, est déjà servi par le téléphone (≈ 18 Ko).
9. **Essai de charge sur une copie** *(code, avant d'ouvrir à plus de 500)* : une copie de
   préproduction (jamais vrm.center), des vendeurs inventés de la taille d'un vendeur
   type, 100 puis 500 puis 1 000 ouvertures en parallèle ; relever les temps (médiane,
   95 %), les erreurs, le processeur et les connexions ; choisir la taille de serveur
   sur ces chiffres. Bancs de départ : `charge-50-vendeurs`, `charge-navigateur`.

---

## 7. Ce que Julien doit décider

- **Passer Vercel en Pro** (20 $/mois) — obligatoire avant le premier client payant, et
  c'est ce qui rend les tâches planifiées fiables (aujourd'hui 2-3 passages par jour au
  lieu de toutes les 15 min).
- **Appliquer la migration 048** (deux index et une fonction de purge ; n'efface rien).
- **Regrouper les mises en production** en un ou deux trains par jour.
- **Les deux copies de sauvegarde de septembre/octobre** (111 Mo dans la base) : les
  exporter puis les retirer, ou les garder.
- **Quand monter le serveur de base** (étape 4) : à la première soirée où il dépasse 50 %.
