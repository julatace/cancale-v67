# 20 nov. — Relier depuis la liste

Branche `claude/relier-depuis-liste` (partie d'`origin/main` dd3336382). Julien : « on ne peut pas relier des annonces comme
ça, on est obligé d'appuyer dessus, regarder la fiche ; améliore ça ».

## Ce que voit Julien
- **Annonces, ordinateur (tableau)** : une colonne **Liaison**. Une annonce à relier y montre sa proposition : la mini-photo de
  l'article, « N°124 ? », « À relier · sûr » (ambre) ou « À vérifier », puis **Relier** et **Autre…**. Sans proposition :
  **Que sur ce site** et **Autre…**. Une annonce reliée dit « Reliée · N°126 », une annonce propre à son site « Que sur Leboncoin ».
  Un filtre **Liaison** (Toutes · À relier · Reliées · Que sur ce site) et, dans « Choisir une action ▾ », **Relier les sûres** :
  la relecture photo contre photo du parcours, limitée aux annonces cochées, puis un geste.
- **Annonces, téléphone (liste)** : la même proposition sous la rangée (une bande, jamais un bouton DANS la rangée) ; le
  **balayage** d'une rangée à relier donne « Autre… » et « Relier N°… » (le geste principal, balayer jusqu'au bout le fait).
- **La fiche courte** d'une annonce sans N° : la ligne du site non relié porte la même proposition, en place.
- **Un toucher sur Relier** = le lien (le geste du parcours), la pilule « Relié à N°124 · Annuler » 10 s. Touchers mesurés au
  banc : **1** pour une sûre depuis la liste (et 1 pour « à vérifier »).
- Un vrai doute (marque différente, prix du simple au double, deux N° en jeu) : le parcours s'ouvre sur CETTE annonce et pose
  sa question, une seule. « Autre… » ouvre le parcours sur cette annonce.

## La règle (src/liaisonSites.js `propositionsDe`)
Une proposition n'est montrée que si elle est **unique et appuyée** : la « sûre » du parcours (même photo sûre, unique, sans
doute) ; sinon la première candidate du parcours (`candidatesPour`, à la taille de l'annonce) si elle est **seule à son rang
et à sa proximité** (deux à égalité ⇒ rien : 50 paires identiques ne proposent rien), si elle a un appui (même photo à vérifier,
N° écrit sur l'annonce, publiée par VRM, ou même taille + 2 mots du modèle en commun) et si le jugement du parcours ne la refuse
pas (taille différente, déjà prise, N° porté par deux articles…). Rien n'est relié par le calcul.

Le geste (src/liaisonActions.js `relierProposition`) relit la proposition : elle doit être celle qu'il a vue (`paireId`), sinon
rien (« la liste a changé ») ; puis EXACTEMENT `relier` du parcours (`opsRelier`, toutes les gardes, annulable 10 s). Les
écrans n'écrivent rien : ils émettent `relierDepuisListe` / `queSurCeSite` (src/liaisonEtat.js), que l'hôte du parcours
(App.jsx `LiaisonCoque`) reçoit.

## Preuves
- `audit-liaison-sites` R1–R9 (116 contrôles) : sûre unique ⇒ « sûr », rien relié par le calcul ; le geste de la liste écrit
  les MÊMES opérations que le parcours ; « Annuler » rend l'état d'avant ; proposition périmée ⇒ refus ; 50 identiques ⇒
  aucune proposition ; titre et taille ⇒ « à vérifier », taille différente ⇒ rien ; vrai doute ⇒ la question, rien écrit ;
  sans appui ⇒ rien ; jugement refusé ⇒ rien ; « Que sur ce site » = le geste du parcours. Mutations : `propEgalite`,
  `propAppui`, `propJuge`, `propPerimee`, `propAutreGeste` rouges. I4 vérifie que la seule autre porte vers un lien est
  l'écoute de `relierDepuisListe` (qui n'appelle que `relierProposition` / `propreDepuisListe`).
- Banc `liaison-sites` section R (390 tactile, 1512, clair et sombre) : la proposition sur la rangée (sûre, à vérifier,
  aucune), cibles ≥ 44, aucun débordement ni texte coupé lettre à lettre, UN toucher ⇒ le lien et sa preuve sans ouvrir le
  parcours, « Autre… » ⇒ le parcours sur cette annonce. Captures `liaison-*-11-liste.png`, `liaison-*-12-relie-liste.png`.

## Pas fait, et pourquoi
- **Ventes / Achats** : une annonce VENDUE n'est plus dans le calcul de liaison (seules les annonces en vente y entrent) :
  il n'y a pas de proposition à montrer sur une vente Leboncoin / eBay / Vestiaire. Le lien d'une vente reste celui de
  « Relier achats et ventes ».
- La fiche complète (`src/natif/ecrans/Fiche.jsx`) est celle d'un article qui a son N° : ses sites sont déjà reliés ; la
  proposition vit dans la fiche courte (article sans N°).
