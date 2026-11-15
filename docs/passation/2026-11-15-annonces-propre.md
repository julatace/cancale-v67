# 15 nov. 2026 — Annonces propre (branche `claude/annonces-propre`)

## Ce que Julien a dit

Capture iPhone d'Annonces, filtre Vestiaire : « Ici c'est horriblement moche et ne met pas paires
tu mets annonces et fait de meilleur logo pour les plateformes etc. » Puis : « Fait mieux encore je
sais que tu peux faire en sorte que c'est plus pratique ». Règle : tout parfait, beau, cohérent,
aucune fonction perdue.

## La cause du chevauchement (mesurée)

`src/design/studio-paires.css` §4 posait sur la tête d'Annonces une hauteur **fixe** :
`.vrm-tache-tete { height: 44px !important }`. Tout ce qui s'ajoutait à cette tête (sur sa capture,
la phrase d'aide « Chaque annonce porte son N° de rangement… Compris ») débordait de ses 44 px et se
dessinait SOUS la ligne suivante, la rangée des sites (qui a son fond) : le sélecteur passait par-dessus
le texte et « À faire · 1 ». Rien de positionné en absolu, aucune marge négative : un débordement.
Le commit de départ (6c40f401) ne rend plus la phrase d'aide, mais le piège restait (n'importe quelle
ligne de plus le rouvrait).

Correctif : `height: auto` + `min-height: 44px` (et 52 px à l'ordinateur). Prouvé par le banc
`annonces-tete`, qui pose une ligne de plus dans la tête : rouge sur 6c40f401 (« sites ⨯ phrase » sur
Leboncoin, eBay, Vestiaire — la capture de Julien reproduite à l'identique), vert ici.

## Ce qui a changé

1. **Tête d'Annonces** : titre · « ? » · « À faire › » sur la 1re ligne ; la rangée des sites sur la
   sienne (défilante si besoin, touches un peu plus serrées au téléphone, 44 px gardés) ; au téléphone,
   sur Vinted, le choix du compte reste à droite de cette rangée et dit « 👤 Tous ▾ » (« Tous les comptes » se coupait en « Tou… » ; le nom entier reste à l'oreille et
   dans la feuille, clé `listes.tousComptesCourt` dans les 5 langues). À l'ordinateur la rangée des
   sites reste dans l'île du haut (§7).
2. **Marques des plateformes**, UNE source : `src/plateformes/marques.js` (tracés, cadres serrés,
   hauteur optique par marque), `src/plateformes/Marque.jsx` (le `<svg>` en ligne, `currentColor`).
   - Vinted et eBay : Simple Icons 16.37.0 (paquet npm `simple-icons`, téléchargé par `npm pack`
     dans un dossier temporaire), **CC0-1.0** — les tracés sont recopiés dans le module.
   - Leboncoin et Vestiaire Collective : **absents** de Simple Icons ⇒ marques **dessinées pour VRM**
     (Leboncoin : le carré au coin replié ; Vestiaire : monogramme « VC » au même trait). Ce ne sont pas
     les logos officiels (dit dans le module et `public/brands/README.md`). Lawnicons (Apache-2.0) n'est
     plus utilisé : `LICENSE-lawnicons.txt` retiré.
   - `public/brands/*.svg` (masques de la navigation, image du rail) sont **fabriqués** depuis le
     module : `node scripts/marques-svg.cjs --ecrire` ; vérifiés par `audit-plateformes-logo` (A2b).
   - Partout : sélecteurs d'Annonces/Ventes/Achats/Messages/Colis (`SelecteurSites`), logo en ligne
     (`LogoSite` : Tous les sites, Publier ailleurs/partout, e-mails, fils), instantané de Ventes
     (`ColisVentesInstantanes`), navigation (masques, mêmes fichiers).
3. **Nombre d'annonces par site** sur la touche d'un site NON choisi (« V 36 », « VC 3 ») :
   `src/plateformes/nombresAnnonces.js` ne compte rien, chaque site publie le nombre de SA règle
   (Vinted : `online` des chiffres de l'app = « en ligne » de la bande ; Vestiaire : ses rangées « En
   ligne », lu aussi sans ouvrir son écran — `compterVcEnLigne`, la règle partagée `etatAnnonceVcBrut` ;
   Leboncoin : `bilanEnLigneLbc` quand son écran a lu). Pas su ⇒ rien d'écrit, jamais 0. Le site
   choisi ne répète pas son nombre (il est dans sa liste : un nombre une seule fois, §7).
   eBay : aucun nombre (ses annonces se lisent par compte, à l'ouverture de son écran) — à faire si
   Julien le demande.
4. **« Relier à Vinted »** (Vestiaire) : plus un bloc bleu sous chaque rangée, un lien court au bout
   de la ligne d'état (« • En ligne · Relier à Vinted »), cible 44 px par marges négatives. Même
   bouton, même `data-vc-relier` / `data-vc-delier`, même geste ; la fiche ouverte le porte toujours
   (`DansFiche`).
5. **Titres sur deux lignes** au lieu d'être coupés à 15 lettres : Leboncoin/eBay/Vestiaire (rangée
   ≤ 76 px) et Vinted au téléphone (40 + 4 + 18 = 62 px : la rangée garde ses 64 px, 1 000 rangées
   inchangées).
6. **« Paires » devient « Annonces »** à l'écran : barre du bas (`nav.paires`), titre du groupe du
   menu (`nav.groupe.paires`), 5 langues (Listings · Anuncios · Annunci · Anzeigen). Identifiants
   inchangés (`data-espace="paires"`, `ID_PAIRES`, routes).

## « Plus pratique » — mesuré au doigt (390 px), avant → après

| geste | avant | après |
|---|---|---|
| Baisser le prix (Vinted) | 2 touchers (la rangée monte → « Baisser ») | 2 (inchangé : déjà le plus court sans geste caché) |
| Republier (Vinted) | 2 (la rangée → « Republier ») | 2 |
| Sélectionner plusieurs (Vinted) | 1 (« Sélectionner ») + 1 par paire | idem |
| Relier à Vinted (Vestiaire) | 1, mais un bloc de 44 px sous CHAQUE rangée (116 px par rangée) | 1, dans la ligne (rangée 64–76 px) |
| Baisser des prix (Vestiaire) | 2 (« À faire › » → « Baisser des prix ») | 2 |
| Changer de site en sachant où sont les annonces | ouvrir chaque site | 0 : le nombre est sur la touche |
| Retrouver un N° | taper le N° : sa ligne vient en tête (vérifié) | idem ; la recherche reste collée sous la tête au défilement (vérifié à 900 px) |

Aucune confirmation ni « Annuler 5 s » ajoutée (refusés par Julien). Pas de « Toutes » dans Annonces :
il n'existe pas de liste d'annonces tous sites confondus (`TACHES_SITE.annonces.toutes = false`) ; la
fabriquer est un écran neuf (identités par site, §5) — pas fait ici, à décider.

## Preuves

- `npm run build` vert.
- Audits verts : traduction, tdz, variables, studio, icones, composants, violet, rouge-doublon, csp,
  coherence, quoi-de-neuf. `plateformes-logo` : A2b–A2d neufs verts ; chaque mutation neuve
  (`marque-couleur`, `fichier-a-la-main`, `selecteur-masque`) rougit SA ligne (`--mutation=`) ; seul
  rouge : D10, le MÊME sur 6c40f401. `coque-parametres` : 1 rouge (icônes de Réglages), le même sur
  6c40f401.
- Bancs :
  - `annonces-tete` (neuf) : vert 390/1512 × clair/sombre ; **rouge sur 6c40f401** (chevauchement
    sites ⨯ phrase sur Leboncoin, eBay, Vestiaire ; « Relier à Vinted » bloc de 116 px ; aucune marque
    SVG ; « Paires » écrit ; aucun nombre) — capture de Julien reproduite à l'identique. Il juge aussi :
    compte coupé (« T… ») ou renvoyé sous les sites = rouge.
  - `studio-paires` vert (forme 390/1512 × clair/sombre, volume 1 000 : 9 rangées entières, monte en 4 ms).
  - `studio-coque` 78 verts ; `afaire-feuille` 768 verts ; `garde-ecrans` rien à signaler ;
    `annonces-grille` 92 verts (G4 mis à la règle neuve : le nom sur DEUX lignes au plus au téléphone,
    lignes VUES seulement — il exigeait « une ligne » depuis le 14 nov.).
  - `refonte-listes` : 7 rouges (Ma journée « murs », Ventes « premiere ») — **les mêmes 7 sur
    6c40f401** ; aucun sur Annonces.
  - `plateformes-logo` : 16 rouges — **les mêmes 16 sur 6c40f401** (Messages avec « Tous », eBay sans
    compte, délais) ; le contrôle des marques (A, svg en ligne) est vert.

## Geste de Julien

Aucun. Regarder Annonces sur l'iPhone (Vinted, puis Vestiaire) et dire ce qui gêne.
