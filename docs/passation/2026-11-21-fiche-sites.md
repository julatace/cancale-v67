# 21 nov. 2026 — Fiche article « Sur les sites » (choix 5) et « Relier en série depuis Achats » (choix 7)

Branche `claude/fiche-sites`, partie de `claude/relier-code` (ac175396f, qui contient `claude/integration-21nov`).
Aucun fichier de `vinted-sync-extension/`.

## A. La fiche d'un article : une rangée par site (choix 5)

CLAUDE.md §2.11 : l'objet central est l'ARTICLE ; chaque site a les mêmes informations et les mêmes gestes.

- **`src/ficheSites.js`** (pur, n'écrit rien, aucune règle d'identité) : `rangeesSitesFiche(entrees, { pasLus, montres,
  publier, double, maintenant })` rend au moins UNE rangée par site (Vinted · Leboncoin · eBay · Vestiaire, dans cet ordre) :
  - les entrées que l'app a déjà reliées à CE N° par identité (annonces en ligne de `sitesDuNumero` — fiche Vinted, SKU
    `VRM-{n°}`, lien posé / référence VRM Leboncoin, N° donné Vestiaire — et ventes par transaction) ;
  - + les annonces Vinted de la fiche du N° encore là mais pas en ligne (`sitesAutres`) : **masquée**, **pas revue depuis
    N j** (`<enligne-regle>` : lecture du compte de plus de 24 h ; N = jours pleins depuis `res.lu`, nouveau `numData.luComptes`),
    **plus en ligne** (retirée) ;
  - sans entrée : **« Pas publiée »** si le site est LU, sinon **« — pas lu »** (ou « lecture en cours ») — jamais « pas
    publiée » sur un site pas lu, et aucun geste ;
  - **« Publier »** (Leboncoin, eBay, Vestiaire ; jamais Vinted) seulement sur un site lu où elle n'est pas, jamais pour une
    paire vendue n'importe où, ni deux paires sous un N°. Il ouvre le parcours existant « Publier ailleurs »
    (`setPubAil({ num, site })`, la carte du site en tête ; Leboncoin / Vestiaire passent par le panneau de l'extension,
    `publierfiche`) : rien ne part sans son toucher là-bas ;
  - un site que le vendeur ne montre pas (Paramètres → plateformes) n'a pas de rangée, sauf s'il porte une annonce ou une vente.
- Chaque rangée : logo, compte, prix, vues, favoris (un nombre pas lu = « — » à l'ordinateur, rien au téléphone), date
  (« vendue le … » ou « depuis le … » : la mise en ligne lue — `crees` pour Vinted, `publieeLe` / `depuis` ailleurs), état,
  lien (toucher = l'annonce sur le site ; une vendue n'ouvre rien).
- Branchement : `articleFiche` (src/ficheProduit.js) rend `rangeesSites` — les entrées masquées / pas revues restent HORS de
  `A.sites` (le bouton principal, l'histoire, « si vendue » ne changent pas). `src/natif/ecrans/Fiche.jsx` dessine (8 colonnes
  à l'ordinateur, 2 lignes au téléphone ; une rangée sans annonce : le site, son état dessous, « Publier » à droite).
  `src/FichePaire.jsx` : textes `fd.sites.*`, `fd.col.date`, `fd.col.geste` (5 langues). Titre de la section : « Sur les sites ».
  Le pied « Pas lu : … » est remplacé par la rangée « — pas lu » (rien en double).

## B. Relier en série depuis Achats (choix 7)

- Achats (téléphone et ordinateur), au-dessus de la liste, dès 2 : **« N achats arrivés sans vente · Les relier en série,
  un par un »** (`data-achats-serie`). La file : achats ARRIVÉS (étape 4), ni annulés ni en retour / litige
  (`achatHorsRelier`), encore libres (`achatDisponible` : aucun lien, ou un lot pas complet), du plus récent (`ordreRecent`).
- Le toucher ouvre la feuille du geste inverse de relier-code (`LierArticleGrille`) sur le premier achat, avec la tête de
  série de Ventes (`TeteSerie` : « 1 sur N », barre, « Passer ») : la meilleure vente / annonce proposée (ou les suggestions à
  égalité, jamais tranchées), « Pas celle-ci », « Relier » ⇒ « Non · Oui ». « Oui » = la même écriture (`relierDepuisArticle`
  → `relierAchatVente` / `relierAchatAnnonce`, geste annulable par sa pilule « Annuler ») PUIS l'achat suivant. Un lot reste
  ouvert jusqu'à son nombre (prix demandé article par article, jamais divisé). « Passer » n'écrit rien. Fermer arrête la série.

## Preuves

- `node scripts/audit-fiche-sites.cjs` : **27 verts** (S1 une rangée par site ; S2 pas su ≠ pas publiée ; S3 « Publier » ;
  S4 pas revue / masquée ; S5 nombres absents, dates ; S6 50 annonces au même titre sans référence ⇒ « pas publiée », la seule
  « VRM-12 » ⇒ en ligne, aucun titre lu ; S7 branchement ; S8 série). `--mutation=toutes` : **10/10 rougissent**.
- `audit-identite` §17 (nouveau) : 50 annonces identiques sur Leboncoin / eBay / Vestiaire ⇒ « pas publiée » partout, la seule
  qui porte l'identité est la seule reliée ; vert.
- Banc `scripts/bancs/fiche-sites.cjs` (base inventée : N°3201 Vinted + Leboncoin reliés, eBay lu sans annonce, Vestiaire
  dont la lecture rend 500 ; N°3119 vendue ; 180 achats arrivés chacun avec SA vente) : voir le compte rendu de la session pour
  les chiffres ; sur le build d'avant (`BANC_DIST`, ac175396f) : **9 rouges** (2 rangées, « Sites et comptes », aucun
  « Publier », aucune entrée de série).
- `scripts/bancs/fiche-directe.cjs` adapté : ses comptes d'annonces lisent `data-fd-sites-annonces` (le nombre d'annonces), la
  liste des sites ignore les rangées « pas publiée / pas lu ».
- `audit-traduction`, `audit-parite-sites`, `audit-quoi-de-neuf`, `audit-icones`, `audit-tdz`, `audit-variables`,
  `audit-pluriels-croises`, `audit-relier-facile` verts. Build vert.

## Pas fait / limites

- Leboncoin « en pause » et Vestiaire « pas revue » ne sont pas encore des rangées propres : une annonce Leboncoin en pause ou
  Vestiaire hors ligne n'est pas lue par `sitesDuNumero` (la règle du prix) ; elle apparaît « pas publiée » si rien d'autre ne
  la porte. À faire : les lire par la même identité (`numeroLbcIdentite`, `numeroVcIdentite`) dans `sitesAutresFiche`.
- « Publier sur Vinted » n'existe pas (aucun chemin « vers Vinted » d'une fiche d'un autre site ici) : la rangée Vinted dit
  « Pas publiée » sans geste.
- La série depuis Achats ne propose que ce que la feuille inverse propose (ventes Vinted et annonces Vinted sans achat).

## Geste de Julien
Aucun.
