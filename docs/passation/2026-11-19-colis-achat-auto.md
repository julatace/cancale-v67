# 19 nov. 2026 — Un colis à retirer dit ce qu'il contient tout seul ; plus de « Relier l'achat »

Branche `claude/colis-achat-auto` (partie de `origin/main` ed9399cb). Pas de PR ouverte.

## La demande de Julien (19 nov., mot pour mot)

> « je ne dois pas relier l'achat au colis qui est au point relais, ça doit être automatique : quand je fais
> l'achat, l'extension doit capter le numéro de suivi, et ensuite le numéro de suivi est sur le code de retrait
> normalement ou dans le mail, donc on doit pouvoir voir il y a quoi dans chaque code de retrait, ça doit être
> automatique. Sinon ce n'est pas grave, mais on ne doit pas avoir le bouton relier un achat, c'est totalement
> débile et c'est une perte de temps monumentale. »

Puis, sur deux photos de son écran : la passe de retrait « géante » (« tu peux faire ça beaucoup plus petit :
simplement une ligne comme pour les achats ») et, dans E-mails → À traiter, une série de « Colis à retirer · code
pas encore lu · à vérifier — Je n'ai pas trouvé le n° de suivi dans cet e-mail ».

## 1. La mesure (base de production, lecture seule, projections scalaires — aucun n°, pseudo ni lieu recopié)

### Les colis à retirer et leur achat

| | nombre |
|---|---|
| colis « à retirer » publiés le 19 nov. à midi (`vrm_colis_retirer`) | **15** |
| … dont l'achat est trouvé par identité | **0** |
| colis du transporteur arrivés en 30 jours (e-mails « disponible », n° de suivi lu) | 111 |
| … reliés par le n° de suivi lu sur Vinted (`harvest_{uid}_suivi_{tx}`) | 31 |
| … reliés par le seul code de retrait lu dans la conversation (`panel_colis_relais`) | 4 |
| … reliés par le seul code de retrait de l'e-mail Vinted (consigne) | 2 |
| … reliés par rien | **74** |
| depuis le 12 nov. : arrivés / reliés | 39 / 5 |
| liens posés à la main (`colis_suivi_*` portant une transaction), tous vendeurs confondus | **0** |

Le bouton « Relier l'achat » n'a donc jamais produit un seul lien : il n'y avait rien à perdre à le retirer.

### Pourquoi les 15 colis d'aujourd'hui n'ont pas leur achat — les causes, classées

| cause | colis | corrigeable où |
|---|---|---|
| l'achat n'a AUCUN n° de suivi capté — compte d'achat principal, lu par une extension ≥ 5.372 qui n'a écrit aucune ligne de suivi depuis le 11 nov. | **11** | extension (§5) |
| l'achat n'a aucun n° capté — compte où Vinted n'a pas été rouvert depuis le 11 nov. (extension 5.336 dans ce navigateur) | **3** | geste (ouvrir vinted.fr sur ce compte, extension à jour) |
| le n° du colis est celui du 2e transporteur du trajet ; l'achat a été lu par un navigateur en 5.273, qui ne garde que le premier n° (la liste arrive en 5.403) | **1** | geste (retrouver le navigateur en 5.273, déjà demandé) |
| le n° existe sous une autre forme (espaces, préfixe, chiffre de contrôle, InPost ↔ Mondial Relay) | **0** | — |
| achat d'un autre site | **0** | — |

Vérifié, pour ne pas conclure trop vite :

- **la forme des n° n'est jamais en cause** : sur tous les n° de la base (e-mails, suivis Vinted, suivis
  transporteur), aucune paire « l'un contient l'autre », aucun préfixe ni suffixe commun ; `normaliserSuivi`
  (majuscules, espaces et tirets ôtés) suffit ;
- **l'e-mail de Vinted ne porte jamais le n° de suivi** : 921 e-mails « Commande mise à jour » gardés, 0 contient un
  n° de colis, et leurs liens (décodés) ne mènent qu'à la conversation ;
- **ni les conversations, ni les transactions, ni les captures de requêtes** rangées par l'extension ne portent un
  de ces n° (993 lignes fouillées) ;
- **l'e-mail du transporteur** donne n° de suivi, code, lieu, date — aucune référence Vinted (il n'est pas gardé en
  entier : ce point ne peut pas être re-mesuré sans garder un extrait) ;
- côté achats : sur le compte principal, **36 achats en cours sur 38 n'ont pas de n° de suivi** (8 au point relais,
  20 en route, 5 « livré à confirmer »). Les 46 lignes de suivi de la base datent d'avant le 11 nov. ou viennent du
  navigateur resté en 5.273. Les 15 colis ont tous leur compte connu (l'adresse qui a reçu l'e-mail) : trois comptes.

Conclusion : la seule identité qui relie un colis du transporteur à son achat est **le n° de suivi lu sur Vinted par
l'extension** (ou, pour une consigne, le code). Rien d'autre n'existe ; un rapprochement par point relais, date ou
titre serait une ressemblance (§5 : le 21 oct., deux colis au même relais à 4 secondes d'écart n'étaient pas le même).

### Les e-mails « Commande mise à jour pour {titre} » (casier, point relais) rangés « à vérifier »

| | nombre (30 jours) |
|---|---|
| e-mails Vinted « ton achat t'attend / t'attend ici / livré dans le Point Relais » | 78 (10 le 19 nov.) |
| … rangés « à vérifier · relié à aucun colis » dans E-mails | **78** |
| lignes de colis qu'ils forment (une par conversation) | 61 |
| … dont la clé est la conversation de la commande | 61 |
| … dont la conversation est celle d'un achat connu | **61** |
| … avec un code dans l'e-mail (consigne « utilise le code ») | 5 |
| … avec un code lu dans la conversation par l'extension | 4 |
| … sans code nulle part côté Vinted | 53 |
| … pour lesquelles un e-mail de transporteur (n° + code) est arrivé le même jour, même code postal, même compte | 59 (indicatif : une ressemblance, jamais utilisée pour relier) |

Donc : cet e-mail n'a jamais de n° de suivi, mais il porte **la conversation de sa commande dans son lien** — une
identité, déjà lue par la route (`conversationVinted`). Il était « à vérifier » parce que le résumé du classement ne
regardait que l'absence de n° de suivi. Le code, lui, est dans l'e-mail du transporteur (53 cas sur 61) : l'e-mail de
Vinted annonce le même colis une seconde fois ; ce qui manque pour fondre les deux lignes est, là encore, le n° de
suivi de l'achat (extension).

## 2. Ce qui est corrigé

### Plus aucun « Relier l'achat » sur un colis à retirer

- `src/contenuColis.js` (neuf, pur) :
  - `achatDuRetrait` — la règle « l'achat d'une ligne à retirer » sortie d'App.jsx (n° de suivi seul ET jonction
    conversation / n° / code doivent dire la même commande, sinon personne) ;
  - `contenuDuColis` — **le sélecteur du contenu**, posé sur chaque carte « à retirer » (`x.contenu`) :
    `{ etat: 'relie', tx, titre, photo, prix, compte }` · `{ etat: 'pas-lu', raison, compte }` ·
    `{ etat: 'autre-site', site, titre }` · `null` ;
  - `texteContenu` — la phrase (clés `achats.contenu.*`, 5 langues) : « Payé 24 € · compte » ou « Contenu pas encore
    lu · ouvre vinted.fr sur {compte} » (le geste seulement quand le compte du colis est su) ;
  - `limiteDuColis`, `rangeeRetrait` — voir §3.
- `src/App.jsx` : `commandeRetrait` = `achatDuRetrait` ; `cartesColis` pose `contenu`, `limite`, `qrDispo` sur les
  quatre sortes de cartes ; `relierRetrait` supprimé ; la feuille de choix d'un achat ne s'ouvre plus que depuis le
  scanner.
- `src/designV2/PassesRetrait.jsx`, `src/CarteRelais.jsx` : le bouton disparaît ; une ligne de texte à la place. Le
  minimum : le dessin sera refait par « VRM natif ».
- La proposition « C'est sans doute le même colis — Relier / Ce n'est pas le même » (17 nov.) est retirée elle aussi :
  c'était un « Relier » de plus sur un colis à retirer, par ressemblance (même point, même transporteur).
  `propositionsMemeColis` reste dans `src/memeColis.js`, exécutée par son audit, appelée par aucun écran.
  « Ce lien ne correspond pas au suivi Vinted — Délier » reste (il ne concerne que d'anciens liens manuels).
- Clés retirées (5 langues) : `v2.passe.relier`, `achats.relier.pasRelie`, `achats.relier.bouton`,
  `achats.memeColis.propose`, `.proposeTitre`, `.pasMeme`.
- Un lien posé à la main par le passé reste lu (index `suivis`, app et serveur) : prouvé par l'audit et le banc.

Ce qui n'est PAS retiré, exprès : « Relier à un achat » du **scanner** (un colis qu'il tient en main et scanne
lui-même), l'outil des n° ajoutés à la main (Achats → en attente), « relier l'achat à la vente » de la fiche et
l'écran « Relier achats et ventes ». À décider par Julien pour le scanner.

### L'e-mail Vinted d'un achat arrivé n'est plus « à vérifier »

- `api/_lib/resume-email.js` : le résumé garde `cv` (la conversation) ; avec elle, plus de raison « sans-suivi » ⇒
  l'e-mail est rangé « intégré » dès son arrivée.
- `src/journalEmail.js` (`arriveeAchatVinted`, `lectureEmail`) : « Rangé avec ton achat, par la conversation de sa
  commande » ; les e-mails déjà classés (sans `cv`) de cette famille se lisent rangés eux aussi.
- `src/boiteEmails.js` : leur ligne ne porte plus « à vérifier » (elle garde « à retirer »).
- Un e-mail de TRANSPORTEUR sans n° de suivi reste « à vérifier », avec sa raison.

**Reste à faire à la main (une fois)** : les 78 lignes déjà rangées « a-verifier » en base comptent encore dans le
nombre « À traiter » (le serveur compte l'état rangé). SQL à passer sur la base, avec confirmation humaine — d'abord
le compte, puis la correction :

```sql
-- 1) combien (attendu : ~78 pour le propriétaire de l'installation)
select owner, count(*) from app_data
where id like 'email_reception_%' and data->>'etat' = 'a-verifier'
  and data->'resume'->>'t' = 'suivi' and data->'resume'->>'tr' = 'autre' and data->'resume'->>'st' = 'available'
  and data->'resume'->>'av' = 'sans-suivi' and data->'resume'->>'s' is null
  and data->>'subject' ~* '^\s*((TR|Fwd?|Re)\s*:\s*)*Commande mise [àa] jour pour\s+\S'
group by owner;
-- 2) la correction (même filtre) : rangé, plus de raison « sans-suivi »
update app_data set data = jsonb_set(jsonb_set(data, '{etat}', '"integre"'), '{raison}', '""') #- '{resume,av}'
where id like 'email_reception_%' and data->>'etat' = 'a-verifier'
  and data->'resume'->>'t' = 'suivi' and data->'resume'->>'tr' = 'autre' and data->'resume'->>'st' = 'available'
  and data->'resume'->>'av' = 'sans-suivi' and data->'resume'->>'s' is null
  and data->>'subject' ~* '^\s*((TR|Fwd?|Re)\s*:\s*)*Commande mise [àa] jour pour\s+\S';
```

(La colonne `meta` de ces lignes est remplie par un déclencheur depuis `data` : vérifier `meta->>'etat'` après.)

## 3. Le sélecteur « un colis à retirer en une rangée »

`rangeeRetrait(x)` (`src/contenuColis.js`), `x` = une carte de `parPoint.points[].arrives` ou de la colonne. L'écran
Achats en rangées (« VRM natif ») se construit dessus ; aucun écran n'a été refait ici.

| champ | sens |
|---|---|
| `cle` | l'identité de la carte (`r:e:{n° de suivi}`, `r:v:{transaction}`) |
| `contenu` | `{ etat: 'relie', tx, titre, photo, prix, compte }` · `{ etat: 'pas-lu', raison: 'ouvrir-vinted' \| '', compte }` · `{ etat: 'autre-site', site, titre }` · `null` |
| `titre`, `titreDe` | le nom à écrire et d'où il vient : `'achat'` (relié par identité) · `'email'` (l'e-mail de CE colis le nomme) · `''` (l'écran écrit « Colis {transporteur} ») |
| `photo` | la photo de l'achat relié, sinon `null` (logo du transporteur) |
| `point` | `{ nom, adresse }` tels que lus |
| `transporteur` | `{ cle, nom }`, vide si pas su (jamais deviné) |
| `code`, `codeEtat` | le code en clair ; `'lu'` · `'desaccord'` (deux sources, deux codes : aucun choisi) · `'qr-seul'` · `'pas-lu'` |
| `qr` | un QR existe pour ce colis (lu, jamais fabriqué) |
| `limite` | `{ jour, at, source: 'lue' \| 'estimee' \| 'inconnue' }` — la préséance de la barre de délai : lue, puis « vers le » du transporteur, puis sa garde |
| `aVerifier` | hors du compte « à retirer » : visible, jamais compté |

La phrase du contenu : `texteContenu(contenu, tr)`. Sur l'écran d'aujourd'hui, ces faits sont posés en `data-v2-*`
sur chaque face de passe (`data-v2-contenu`, `-contenu-tx`, `-contenu-raison`, `-limite-source`, `-qr-dispo`,
`-code-etat`, `-titre-de`, `-transporteur`) et en `data-rp-contenu*` dans le détail : les bancs les jugent.

## 4. Combien seraient reliés après

Avec le code de ce chantier seul : **le même nombre qu'avant** (0 sur 15 aujourd'hui, 37 sur 111 en 30 jours) — le
rapprochement n'avait pas de défaut ; il lui manque la donnée. Ce qui change tout de suite : plus de bouton, une
phrase honnête qui nomme le compte à ouvrir, et 78 e-mails qui sortent de « à vérifier ».

Avec le correctif d'extension du §5 et vinted.fr ouvert sur chaque compte d'achat : les 14 colis des deux premières
causes se relient (le n° de 8 chiffres de l'e-mail est exactement celui du suivi Vinted, mesuré sur 31 liens) ; le
15e demande la 5.403 dans le navigateur resté en 5.273. Pendant la semaine où le suivi était lu (1er–11 nov.),
22 colis sur 42 se reliaient déjà, sans aucun geste.

## 5. Ce qui demande l'extension (non modifiée ici — à intégrer avec sa version)

**Constat exécuté** (`node scripts/mesure-famine-suivi.cjs`, le vrai `background.js` 5.408) : `capterSuivisAchats`
lit en classe « suivi », plafonnée à 20 − la réserve des lecteurs prioritaires (versement 5 + relevé 2 + retrait 3 +
preuve 3 = 13 quand leur reste n'est pas su) = **7**. Dès que le compte a fait 7 lectures dans l'heure, **aucun suivi
n'est lu**, même pour un achat au point relais sans n°. Or depuis le 11 nov. les rattrapages de fond tiennent le
compteur au-dessus : `tickVersements` (5.341, 10 détails par passage, 15/h) et l'import de l'historique (5.344 /
5.375, jusqu'à 20/h), et dans la visite elle-même `capterSuivisAchats` passe APRÈS les preuves, les codes, les
versements et les relevés (jusqu'à 13 lectures). C'est la date à laquelle les lignes de suivi cessent d'arriver.
(Cause probable, pas prouvée dans son navigateur : le diagnostic des versions récentes n'est pas dans la base.)

Changements nécessaires :

1. **Le n° de suivi d'un achat EXPÉDIÉ sans n° (rangs 0 et 1 de `rangSuivi` : au point relais, puis en route) est
   une lecture de colis, pas un rafraîchissement** : le lire avec `gardeLecture(uid, acc, 'colis')` (tout le budget),
   les autres rangs restant en classe « suivi ». Garder `SUIVI_MAX_HEURE = 6` et 3 par visite.
2. **L'ordre de la visite** : appeler `capterSuivisAchats` juste après `capterRetraits`, avant
   `capterDatesVersement` et `capterReleves`.
3. **La réserve des rattrapages de fond** : ajouter `suivi` à ce que `reserveAutresQueVersement` et l'import laissent
   (noter `noterLecturesDues(uid, 'suivi', n)` = le nombre d'achats expédiés sans n°, plafonné à 3), pour que
   `tickVersements` et l'import s'arrêtent avant.
4. **« Quand je fais l'achat »** : au moment de l'achat le n° n'existe pas encore (il naît quand le vendeur prend son
   bordereau). Ce qui peut être fait : à chaque capture de « Mes commandes », un achat qui PASSE à « expédié » ou
   « au point relais » sans ligne de suivi est mis en tête de file (mémo `vrmSuiviAFaire`), lu au passage de fond
   suivant sans attendre une nouvelle visite ; et la capture passive (la page de l'achat ou sa conversation ouverte)
   continue d'écrire la ligne.
5. **Diagnostic** : `panel_diag_capture` est réécrit par le navigateur resté en 5.273 ; les compteurs
   `suivi_plafond_heure`, `lectures-reservees` des versions récentes n'y sont pas lisibles. Ranger le diagnostic par
   navigateur (`ext_appareil_{nav}`) pour que la prochaine mesure tranche.
6. Contrôle rouge → vert : `scripts/mesure-famine-suivi.cjs` (aujourd'hui 0 suivi lu dès 7 lectures) ; avec le
   correctif, les achats expédiés sans n° doivent être lus dans tous les cas « réserves pas sues ».

Capacité côté app : `suivinumero` (5.372) et `suivisliste` (5.403) existent déjà ; rien à ajouter à `EXT_CAPACITES`
tant que la fonction ne change pas de nom.

## 6. Ce qui reste impossible, et pourquoi

- Relier un colis Mondial Relay ou Chronopost à son achat **sans** que l'extension ait lu le suivi de cet achat :
  aucune identité commune n'existe dans les e-mails (mesuré). Par le point relais, la date ou le titre : refusé (§5).
- Fondre la ligne « e-mail de Vinted » (titre, conversation) et la ligne « e-mail du transporteur » (n°, code) du
  même colis sans ce n° : même raison. Elles restent « peut-être en double » jusqu'à la lecture du suivi.
- Savoir pourquoi, dans SON navigateur, le suivi n'est plus lu : voir §5.5.

## 7. Trouvé en passant (pas traité)

- Deux tournures de Vinted ne sont pas reconnues comme une arrivée et restent « sans action » : « Ton colis a été
  réacheminé. Il t'attend désormais à l'adresse suivante : … » (8 en 30 jours) et « Le colis a été livré à l'adresse
  suivante : … » (1). La première change le LIEU d'un colis déjà annoncé (même conversation) : à ajouter à
  `api/_lib/achat-arrive-relais.js` avec son audit.
- Sur l'écran actuel à 1512 px, la colonne des passes commence sous un grand vide et les boutons « précédent /
  suivant » d'une passe sont deux carrés empilés : dessin d'avant, laissé au natif.

## 8. Les preuves

- `node scripts/audit-colis-achat-auto.cjs` : les vraies règles exécutées — n° identique ⇒ relié ; n° sous une autre
  forme (espaces, tirets, minuscules, 2e transporteur) ⇒ relié ; 50 achats au même titre, un seul au bon n° ⇒ lui et
  aucun autre ; aucun n° ⇒ « pas lu », aucun geste ; lien manuel ancien ⇒ toujours lu (app et serveur) ; deux achats
  au même n°, chemins en désaccord, autre compte ⇒ personne ; le sélecteur en une rangée ; l'e-mail Vinted rangé ;
  le branchement ; les 5 langues. `--prouve` : un témoin vert puis chaque mutation rouge.
  Sur l'arbre d'avant (`git archive origin/main`, l'audit copié dedans) : rouge, sans mourir.
- `scripts/bancs/colis-achat-auto.cjs` : l'app rendue (390 et 1512, clair et sombre), six colis inventés ; juge les
  données de chaque colis sur la passe ET dans le détail, et l'absence de tout « Relier ». Sur le build d'avant
  (`BANC_DIST`) : rouge (le bouton est là, aucune donnée de contenu).
- Bancs mis à jour pour la décision du 19 nov. : `achats-qr.cjs` (Q5 : plus de feuille de choix ; le n° lu par
  l'extension relie seul), `retirer-multi-transporteurs.cjs` (scène 2 : plus de proposition ; scène 4 retirée),
  audit `relier-colis` (R5).
- Preuves de rendu « VRM natif » : à faire quand la fondation sera fusionnée ; d'ici là ce sont les données et
  l'absence du bouton qui sont jugées (consigne du coordinateur).

## 9. Achats · Leboncoin : « À retirer · 15 » sur une liste vide (capture iPhone de Julien, 19 nov., 15 h 34)

**Le constat.** Sous le filtre « Leboncoin », la tête d'Achats disait « À retirer · 15 · 2 d'ici demain · 15 avec code ·
5 à vérifier », « Mode relais », « Ajouter un QR Mondial Relay · 11 sans QR », « Sortis de à retirer · 13 », et aucun
colis dessous. Ce n'était pas la liste qui était vidée à tort (ses 15 colis sont des colis Vinted : sous Leboncoin, la
colonne filtrée est bien vide) — c'étaient **les nombres qui ne suivaient pas le filtre** : le grand chiffre et
« d'ici demain » lisaient la publication de tous les sites (`vrm_colis_retirer`), « avec code » / « à vérifier »,
« Mode relais », le bloc Mondial Relay et « Sortis » lisaient `pickupUnion` (tous les sites), la liste lisait
`colonnesColis(cartes, site)`. Deux règles pour une notion.

**La correction** (`src/retirerSite.js`, branchée dans `src/App.jsx`) : `chiffresRetirer({ site, pub, union, colRet, lu })`.
« toutes » (Achats · Vinted, l'écran d'arrivée qui montre tout) ⇒ la publication, inchangée (Ma journée, cloche,
widget) ; un site ⇒ les nombres se comptent sur les cartes de la colonne de CE site (une carte `horsCompte` visible,
jamais comptée ; « d'ici demain » = `jours ≤ 1` ; « avec code » = code ou QR — la règle de la carte d'une ville) ;
e-mails pas lus ⇒ « — ». Suivent aussi le filtre : « Mode relais » (montré seulement si le site a des colis), le bloc
Mondial Relay (les colis MR de SA liste), « Sortis de à retirer » (`siteDuColisSorti` : le site par le n° de suivi d'un
achat d'un autre site, comme la carte), la ligne « adresse reliée à aucun compte », les achats Vinted en route et les
colis redirigés (Vinted seulement). Vide ⇒ une ligne sobre « Aucun colis Leboncoin à retirer. »
(`achats.retirer.aucunSite`, 5 langues, `data-retraits-vide="site"`). Le badge de la barre du bas (15) reste le
total de tous les sites : c'est celui de l'app.

**Preuves.** `node scripts/audit-retirer-site.cjs` (la vraie règle exécutée + le branchement) ; `--prouve` : témoin vert,
5 mutations rouges. Banc `scripts/bancs/achats-retirer-site.cjs` (deux colis Vinted au relais ; Achats · Vinted / eBay
/ Leboncoin, 390 clair et 1512 sombre) : sur le build d'avant (`BANC_DIST`), rouge (« 2 » sous eBay et Leboncoin,
« 2 avec code », « Mode relais ») ; vert après.

**Le bouton « Ajouter » d'Achats** (pas retiré : l'écran sera refait) : il envoie `vrm:v2-ajouter-achat`, que seul le
formulaire « Achats hors plateforme » (`src/ecrans/Achats.jsx`) écoute — il ouvre la saisie d'un achat hors
plateforme (vide-grenier, boutique). Ce formulaire n'est monté que dans la liste des achats Vinted : sur les autres
sites, personne n'écoute et le toucher ne fait rien (mesuré par le banc, ligne « ajouter »).
