# 24 nov. 2026 — « 1 paire → 4 sites » : la feuille « Mettre aussi sur… » (branche `claude/quatre-sites`, ext. 5.451.0)

Base : `origin/main` + `origin/claude/style-clair` (#1326) + `origin/claude/lbc-numero-ecrit` (#1354). Conflit unique :
CLAUDE.md §9 (les deux lignes gardées).

## La demande (Julien, 24 nov.)

> Depuis une annonce Vinted, créer en UN geste les annonces Leboncoin, Vestiaire Collective et eBay (photos, titre,
> taille, prix, N°). Quand elle se vend quelque part, VRM propose de la retirer ailleurs. Plus de visibilité, zéro
> double saisie.

## 1. Inventaire — ce qui existait déjà (mesuré dans le code)

Beaucoup existait, en quatre parcours qui se recouvrent. Rien n'a été réécrit : la feuille neuve passe par eux.

| site | voie existante pour « créer depuis une paire VRM » | ce qu'elle demande | ce qui manque |
|---|---|---|---|
| **Leboncoin** | panneau de l'extension, « Publier aussi sur… » (5.424, `publierAussiLancer`, `src/publier/aussi.js` recopié dans le fond) ; la voie app `lbcPublier` est FERMÉE depuis la décision du 20 nov. (« toute action dans l'extension », `refusPanneau`) | extension ≥ 5.424 dans CE navigateur, onglet vinted.fr (la source est l'annonce du compte de l'onglet, par identifiant, `coffre_{uid}_{id}`), un onglet leboncoin.fr connecté (`compteUniqueOnglets`), SA confirmation dans le panneau | (a) l'app ne pouvait pas OUVRIR directement « Publier aussi » (le lien pré-cochait l'annonce, il fallait choisir le geste) ⇒ **5.451** `action=aussi` ; (b) la voie RECALCULE tout depuis l'annonce Vinted (« tout recalculé ») : un titre / une description modifiés dans l'app ne partent PAS sur Leboncoin (seul le « +N % » passe) ; (c) pas de recette apprise nécessaire (le formulaire est rempli par son interface et relu) |
| **Vestiaire** | la même voie « Publier aussi » (5.424) ; l'ancienne `vcPreparer` (5.235) aussi fermée côté app | idem + un onglet vestiairecollective.com connecté ; la marque doit être dans `deposit_brands` (`marqueVcListee`) ; détourage : la voie Vestiaire (seule détourée, décision du 17 oct.) — pas de clé Photoroom exigée pour publier | (a) et (b) comme Leboncoin ; la commission Vestiaire n'est pas lue (« frais pas lus », jamais 0) ; la suppression Vestiaire n'a toujours aucune voie (« retirer ailleurs » le dit « à faire sur Vestiaire ») |
| **eBay** | `preparerBrouillonPartout` (src/ecrans/Ebay.jsx) : un BROUILLON par l'API officielle (`ebay_brouillons`, SKU `VRM-{n°}`, livraison gérée par eBay, aucun port) ; la mise en ligne reste SA confirmation dans les brouillons (frais, `prixLu`/`prixVu`, P12) ; « eBay en série » (#1328) est dans la file de fusion | un compte eBay relié (jeton) ; la catégorie eBay se choisit dans le brouillon (aucune devinée) | la mise en ligne n'est PAS en un geste d'ici (choix : elle annonce des frais et vend la paire au premier acheteur — une confirmation par annonce) ; la catégorie reste à choisir dans le brouillon quand eBay n'en propose pas une sûre |
| **Vendu ⇒ retirer ailleurs** | `planRetirerAilleurs` (src/retirerAilleurs.js) + `BlocARetirerAilleurs` (Ma journée, Ventes, fiche) : vente PROUVÉE seulement, SON toucher confirmé (`gesteRA` / `confirmerRA`), Leboncoin par le panneau, eBay par la route `retirer` | — | la question en une ligne « Vendue sur X — retirer de Y et Z ? » n'existait pas ; ajoutée dans la nouvelle feuille, au-dessus du même bloc |

Parcours voisins gardés tels quels : « Publier ailleurs » (`HotePublierAilleurs`, un site à la fois, depuis « Sur les
sites » de la fiche), « Publier partout » (`HotePublierPartout`, plusieurs annonces), l'agent « Publier sur… »
(`PublierAgent`, Annonces à égalité).

## 2. Ce qui est livré

| pièce | rôle |
|---|---|
| `src/publier/quatreSites.js` (PUR) | `formeDepuisVinted` (la fiche partagée, par identifiant ; sans N° ⇒ rien), `modifierForme` (une photo qui ne vient pas de l'annonce n'entre jamais), `prixSite` (Leboncoin/Vestiaire : `prixAussi` de la voie, +0/5/10/15/20 %, euro supérieur, jamais sous le plancher ; eBay : libre au centime, jamais sous le plancher ; frais par `fraisSite` : zéro · taux lu · « pas lus »), `dispoSite` (raison + geste), `envoiSite` (EXACTEMENT `CHAMPS_QUATRE[site]`), `descriptionAvecNumero` (« N°{n} » en fin, relu par `lireNumeroTexte` de #1354 ; un autre N° ⇒ refus), `descriptionAvecReference` (Vestiaire « Réf. VRM-{n} »), `planQuatre`, `executerQuatre` (prix Vinted relu avant CHAQUE envoi, un pas à la fois), `etatSuivi`, `questionRetrait` (vente prouvée seulement) |
| `src/MettreAussiSur.jsx` + `src/mettre-aussi.css` | la feuille (composants natifs : Feuille, Groupe, Rangee avec case, Segmente, LogoSite, Plaque) ; gris clair étagé, accent ardoise, aucun orange ; mode sombre par les jetons |
| `src/App.jsx` `HoteMettreAussiSur` | lit (paire `useEbayPaires`, comptes `useComptesAutresSites`, « déjà là » `sitesPrixDe` → `enLigneSur`, frais eBay sur SES commandes), envoie (panneau + brouillon), suit en direct (relecture des listes toutes les 15 s tant qu'un site attend) ; la règle se charge AVEC la feuille (import dynamique : l'agent de publication ne pèse pas sur l'app) |
| entrée | fiche d'une paire → tuile « Ailleurs » (avant : « Publier ailleurs », un site à la fois) ; événement `vrm:mettre-aussi` { num } |
| `src/ouvrirPanneau.js` | `lienPanneau` prend `sites` et `pct` (ajout, rien renommé) |
| extension **5.451.0** (`vrm-badge.js`) | `action=aussi` dans le lien du panneau : `aussiDepuisLien` ouvre « Publier aussi sur… » avec l'annonce, les sites et les « +N % » pré-choisis — seulement sur vinted.fr, 1 à 10 identifiants d'annonces ; **rien n'est lancé** (SA confirmation « Publier sur N sites » reste due, le fond refait toutes ses gardes) ; `sites`/`pct` retirés de l'adresse. Capacité `aussilien` (EXT_CAPACITES, audit-coherence). Versions montées (CODE_VERSION, manifeste, lbc-inject, lbc-relay, EXT_ATTENDUE, extension-version.json), zips régénérés (`scripts/zip-extension.cjs`). Base 5.440 (main) : les 5.441–5.450 du train sont à fusionner avant/avec, la 5.451 se remonte au-dessus. |
| textes | `q4.*`, 5 langues (`src/i18n/langues/*/quatreSites.js`) ; Quoi de neuf `mettre-aussi-sur` |

## 3. Le geste « Créer »

1. SON toucher ouvre tout de suite un onglet vide (un onglet ouvert après une lecture serait bloqué) ;
2. pas « panneau » (Leboncoin + Vestiaire cochés et possibles) : le prix Vinted est RELU (dressing du compte de la
   paire) — changé, pas su, retirée ⇒ arrêté, l'onglet se referme ; sinon l'onglet reçoit
   `vinted.fr/?vrm=panneau&page=publier&ids={id}&action=aussi&sites=…&pct=…` ; l'état dit « À confirmer dans
   l'extension (onglet Vinted) » ;
3. pas « eBay » : prix relu de nouveau, puis `preparerBrouillonPartout` avec les champs de la fiche (titre ≤ 80,
   description, photos, taille, état, marque, prix) ; « Brouillon eBay prêt · à mettre en ligne dans tes brouillons » ;
4. ensuite, l'état passe à « Créée ✓ · Voir » quand la liste du site MONTRE l'annonce par identité.

Une extension sans `aussilien` (≤ 5.450) : le lien `action=publier` pré-coche l'annonce, il choisit « Publier aussi
sur… » dans le menu du panneau (un toucher de plus).

## 4. Preuves

- `node scripts/audit-quatre-sites.cjs` : 32 verts (C champs exacts, E eBay sans port ni étiquette ni mise en ligne,
  N N° écrit relu par #1354 / référence Vestiaire, P prix relu avant chaque envoi + plancher + frais « pas lus »,
  U compte pas relié / pas lu / extension pas à jour / déjà là / vendue ⇒ jamais dans la file, O un à la fois,
  R retrait seulement prouvé et jamais fait par l'hôte, I 50 annonces au même titre, L lien + extension qui
  n'ouvre que la feuille). **Rouge sur `origin/main`** (la règle n'existe pas : 0 ✅ · 1 ❌) et **13/13 mutations
  détectées** (`--prouve`).
- `scripts/bancs/quatre-sites.cjs` (**60 ✅ · 0 ❌**) : 390 tactile et 1512, clair et sombre — feuille, Leboncoin sans extension grisé,
  Vestiaire « déjà en ligne » par lien posé, prix changé ⇒ eBay arrêté sans brouillon (le banc a trouvé que la relecture lisait la réponse gardée : corrigé, `force`), « Créer » ⇒ UN brouillon N°13
  sans port, eBay pas relié ⇒ grisé. Captures regardées (voir le récit de la PR).
- `npm run build`, audits voisins (voir la PR).

## 5. Ce qui reste (gaps)

- **Leboncoin / Vestiaire : les champs modifiés dans la feuille ne partent pas** (la voie de l'extension recalcule
  depuis l'annonce Vinted ; seul le +N % passe). La feuille le DIT (« Tes changements partent sur eBay… »). Pour les
  porter : passer une fiche à `feuilleAussi` (src/publier/aussi.js, recopiée dans le fond) — un lot d'extension.
- **eBay : brouillon, pas annonce en ligne** — la mise en ligne reste sa confirmation dans les brouillons (frais) ;
  « eBay en série » (#1328) pourra la faire en série.
- **Vestiaire : commission pas lue** (frais « pas lus ») ; **suppression Vestiaire : aucune voie** (retirer ailleurs
  le dit « à faire sur Vestiaire »).
- iPhone Safari sans extension : Leboncoin et Vestiaire grisés (« extension absente ») ; Orion porte l'extension.
- Le banc ne simule pas une extension 5.451 vivante : le chemin panneau est prouvé par l'audit (L1-L3) et le code,
  pas par un vrai dépôt — à essayer avec Julien sur un vrai compte.
