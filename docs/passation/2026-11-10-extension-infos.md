# Lot AA — ce que VRM sait, au bon endroit sur Vinted (extension 5.339.0, 11 nov.)

Propositions **40** et **41** (`2026-11-09-propositions.md`), validées par Julien le 9 nov. au soir
(« fais tout »). Branche `claude/extension-infos`.

## Ce qui change pour Julien

1. **Sur son dressing Vinted** (et sur la page d'une de ses annonces), sous chaque annonce :
   « **N°124** · acheté 60 € · en ligne depuis 23 j ». Discret, gris, sa couleur suit la page
   (clair ou sombre). La pastille N° posée sur la photo se tait sur cette carte (le N° une fois, §7).
2. **Sur l'annonce d'un AUTRE vendeur**, sous le titre : un encart replié « **VRM** · Calculette
   et ton stock » (44 px). Ouvert : « Je l'achète » (le prix lu sur la page, modifiable), « Je la
   revends » (vide : c'est lui qui tape, aucun prix conseillé), le site (Vinted, Leboncoin, eBay,
   Vestiaire), l'emballage ⇒ « Tu gagnes au plus 60 € » ; puis « Peut-être N paires proches en
   ligne chez toi » et trois titres. Rien n'est enregistré.

Lecture seule : rien n'est envoyé à Vinted, rien n'est cliqué, rien n'est écrit, **aucune requête
Vinted** (la page est lue telle qu'affichée ; le reste vient de la base VRM par le fond).

## Les règles tenues

- **Identité** : une annonce est à lui par son **identifiant Vinted** — dans SA fiche
  (`vinted_annonce_numeros[id].accountId` = le compte connecté dans l'onglet) ou dans le dressing
  capté de CE compte (`harvest_{uid}_listings`). Jamais un titre. Annonce d'un autre de ses
  comptes, fiche sans compte hors du dressing ⇒ rien. Dressing d'un autre profil ⇒ rien
  (`portee: 'hors_compte'`, la règle de `numerosPermisDansPage`).
- **Pas su ⇒ rien** : prix d'achat absent ⇒ « prix d'achat ? » (gris) sur une paire numérotée,
  jamais un montant ; date absente ⇒ pas de « depuis » ; une lecture ratée (main, dates, dressing)
  ⇒ `ok:false`, aucune ligne.
- Prix d'achat : `prixAchatDe` de l'app (la fiche, puis `vinted_buyprice_by_num` du N°), recopiée.
  Date : l'ordre de l'écran Annonces (`listedAgeDays`) — « Ajouté il y a… » lu sur la page
  (`vinted_listing_dates`), puis la date Vinted du dressing (`created_at_ts`, photo).
- **« Je numérote moi-même »** (`numeroEcritAllume`) : la fiche d'abord ; sans N° de fiche, le N°
  ÉCRIT lu dans la description (`numEcrit`, 5.334) — seulement allumé. Aucune réservation.
- **Encart d'achat** seulement si c'est SÛR (`annonceDUnAutre`) : son profil connecté est connu,
  la page montre un lien `/member/{id}` qui n'est AUCUN de ses profils (`harvest_*_profile`), et
  l'annonce n'est dans aucune de ses fiches. Profils pas lus ⇒ pas d'encart.
- **« Peut-être N paires proches »** = une PROPOSITION (§5) : la règle du lot F
  (`pairesDuModele`, même marque obligatoire, modèle ou mot de modèle commun, taille), sur ses
  paires EN LIGNE tous comptes (`lireDressingsEnLigne`, règle `enligne`), titre/marque/taille
  seulement. Lu seulement quand il ouvre l'encart (cache 5 min). Marque pas lue ⇒ « je ne compare
  pas » ; dressings pas lus ⇒ « Ton stock n'a pas pu être lu » (jamais « aucune »).
- **Calculette** : `calculer` de src/calculetteAchat.js (`cascadeVente`). Sans les commandes eBay
  dans l'extension, les frais eBay sont « pas lus » ⇒ « au plus », dit.

## Une règle, un propriétaire

L'extension ne peut pas importer `src/` : `vinted-sync-extension/vrm-regles-achat.js` est une
**copie refabriquée** par `node scripts/regles-achat-extension.cjs --recopie` (esbuild, iife,
global `__vrmReglesAchat`) de `src/calculetteAchat.js`, `src/dejaEnStock.js` et de
`extractBrand`/`extractModel`/`extractColors`/`prixAchatDe` tirés tels quels de `src/App.jsx`.
Sans option, le script vérifie que la copie est à jour (audit I10). **Quand une de ces règles
change dans l'app : `--recopie`, monter la version, `zip-extension`.**

## Fichiers

- `vinted-sync-extension/vinted-infos.js` (nouveau script de contenu, ombre FERMÉE, aucun
  `innerHTML`, aucune requête, touches gardées dans l'encart) ; manifeste : `vrm-regles-achat.js`
  puis `vinted-infos.js`, `document_idle`, page principale.
- `background.js` : `donneesInfosPage`, `infosDuCompte`, `sesProfils`, `annonceDUnAutre`,
  `infosVintedPage`, `stockPourModele` ; messages `cancale-vinfos` (`infos`, `stockModele`).
- `EXT_CAPACITES` : `infosvinted` (`infosDuCompte`) et `achatvinted` (`annonceDUnAutre`) à 5.339.0.

## Preuves

- `node scripts/audit-infos-vinted.cjs` — VRAI background.js (`_fond-vm`) : 50 annonces au même
  titre ⇒ chacune SON N° (50/50, aucun doublon) ; autre compte / fiche orpheline ⇒ rien ; autre
  profil ⇒ rien ; pas de prix / pas de date ⇒ aucun champ ; lectures ratées ⇒ rien ; écrit allumé /
  éteint ; encart seulement chez un autre vendeur ; stock « en ligne » seulement ; aucune requête
  Vinted ni écriture. **Rouge sur origin/main** (`--src`), **9 mutations toutes attrapées**
  (`--mutation=toutes`).
- `node scripts/bancs/infos-vinted.cjs` — fausse page vinted.fr inventée, vrais scripts de
  contenu, réponses du VRAI fond : 390 tactile et 1512, clair et sombre, captures regardées.
  Rouge sur origin/main (`BANC_EXT=`) et par mutation (pastille pas tue ; contrôle du compte retiré).
- Audits verts : coherence, extension-zip, extension-navigateurs, variables, tdz, identite,
  icones, numero-etiquette, calculette-emballages, plancher-stock, garde-fous-capture, pont-session,
  extension-ui ; `npm run build`.

## Ce qui reste

- Les sélecteurs de la page d'annonce (titre `h1`, `item-price`, `itemprop=brand/size`, lien
  `/member/`) n'ont pas été mesurés sur le vrai Vinted : s'ils changent, l'encart ne s'affiche
  pas (pas d'autre vendeur prouvé) ou le prix n'est pas pré-rempli — rien de faux n'est dit.
- Les frais eBay de la calculette restent « au plus » dans l'extension (les commandes eBay n'y
  sont pas lues).

## Geste de Julien

Installer l'extension **5.339.0** (remplacer le dossier, puis ⟳ dans chaque Chrome), ouvrir son
dressing Vinted, puis l'annonce d'un autre vendeur.
