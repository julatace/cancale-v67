# 5 nov. — Chantier D : Colis, côté envoi

Feuille de route : `docs/passation/2026-11-05-revue-coherence.md` (points 2.17, 2.20, 2.21,
2.22 pour l'envoi), avec les jetons du chantier A et les composants du chantier B. Branche
locale `v35-chantier-d`, partie de `claude/project-review-nsk5su`, puis vraie fusion de
`claude/project-review-nsk5su` (ea4a1ad6, puis c534f843). Rien dans `vinted-sync-extension/`. Zone :
Colis → « À envoyer », « Envoyés », « En grand » (`qrView`), la frise, `BoutonSuivreColis`,
la barre du haut de Colis, `styles-colis-colonnes.css` (partie envoi). **Pas touché** :
l'onglet « À retirer », sa règle, `CarteRelais.jsx` (une autre branche les refait).

## Les points de la revue

### 2.20 — La frise ne contredit plus l'état
- `src/design/friseFusion.js` : chaque étape porte `derniere` (la dernière FAITE, une seule,
  aucune si rien n'est fait) ; l'étape en cours n'a plus de ton « encre » : `attente`, ou
  `urgent` (ambre) seulement quand un geste est dû.
- `src/design/Frise.jsx` rend `data-derniere` ; `src/design/fusion.css` : le MOT à l'encre
  seulement sur `[data-derniere]` (plus sur `[data-fait="1"]` ni `[data-cours]`), le TRAIT de
  l'étape en cours n'est plus à l'encre (piste grise, ou ambre si geste).
- Avant : « Livré » à l'encre sur un colis en route, « Imprimé » à l'encre sur un colis dont
  rien n'est imprimé. Après : seule la dernière étape faite est à l'encre ; rien de fait ⇒
  aucune encre. La même loi vaut pour les frises de Ventes (Leboncoin, eBay, Vestiaire, Vinted :
  même composant).
- La frise d'un colis Vinted n'est ambre que si l'étape en cours est FAISABLE (bordereau là ou
  déjà imprimé) : un colis sans bordereau ne montre plus « Imprimé » en ambre.

### 2.21 — La barre du haut est stable
- `data-colis-barre` : les trois mêmes boutons (`Bouton`, une forme : même hauteur, même
  rayon), à la même place sur « À envoyer », « Envoyés » et « À retirer » : Scanner · Tout
  imprimer · « … ». Avant : « Scanner » disparaissait sur « À retirer », « Tout imprimer »
  ailleurs que sur « À envoyer », « … » était un rond d'une autre forme.
- « Tout imprimer » reste le geste principal (aplat) tant qu'un bordereau est prêt ; sans
  bordereau prêt il reste à sa place, grisé, son infobulle dit pourquoi.
- « … » : un état React (`outilsColis`) posé sur la racine ; `aria-expanded` est vrai à chaque
  rendu ; les outils se rangent quand on quitte Colis.
- Retirés de Colis : le lien technique « Tes emails, ce que VRM en a fait » (le journal reste
  dans E-mails) et le réglage d'imprimante (« Normale (A4) / Thermique »), en double avec
  Paramètres → Imprimante et bordereaux.

### 2.22 — « En grand »
- `SheetShell lumineuse` (poignée, croix de 44 px, retour du navigateur, blanche même la nuit),
  `data-qr-plein*` gardés. Titre = l'article relié par identité, sinon le titre d'article de
  l'e-mail, sinon « Colis <transporteur> » — jamais le sujet vouvoyé (`titreEnGrand`,
  `src/colisEnvoi.js`). Sous-titre = le lieu.
- Une phrase par idée : la façon de présenter le colis est dite UNE fois (l'encadré « QR dans
  l'app … » quand il existe, sinon sous le code) — avant, « Le code suffit au comptoir » ET
  « Donne ce code au comptoir… : il suffit ».
- Aucun emoji (⏰ 🗓 🔍 ☀︎ retirés) ; les faits en liste (échéance, transporteur et n°, compte,
  accord des codes) ; l'échéance n'est ambre qu'aujourd'hui, demain ou dépassée (avant : ambre
  à 6 jours) ; date « 10 nov. » au lieu de « 10/11/2026 » ; « Suivre le colis » et « Ajouter le
  QR » en `Bouton` de 44 px ; plus de second bouton « Fermer » (la croix et le glissé ferment).

### 2.17 — Les colonnes à l'ordinateur
La liste « À envoyer » et « Envoyés » occupe toute la largeur (des lignes larges et fines, le
choix de Julien du 19 oct. ; mesuré par le banc : liste, groupes, bandeau ≥ 96 % du contenu).
La limite à 900 px de la revue concernait « À retirer » (hors zone).

## Les deux fonctions demandées

### « Tournée de dépôt » (`data-tournee-ouvrir`, `data-tournee-sheet`)
Un bouton au-dessus des colis ouvre une feuille : les colis À ENVOYER de la liste (les mêmes,
dans le même ordre), regroupés par transporteur — le réseau où on les dépose. Le point de
dépôt précis d'un colis n'est relié à lui par aucune identité (src/tournee.js) : il n'est
jamais deviné, c'est dit une fois (« Le point précis n'est pas lu par VRM »). Chaque colis une
fois, par SA clé (`v:{tx}`, `vc:{id}`, `lbc:{tx}` — jamais le titre ; `groupesTournee`).
« Déposé » en un geste = le geste existant (`deposeScan` : « Colis fait », annulable 5 s, la
ligne dit « Déposé · annulable » et son bouton devient « Annuler ») ; Leboncoin y entre aussi
(sa coche `vrm_lbc_colis_done`). Un colis sans bordereau n'a pas de bouton (« Bordereau pas
encore là ») ; eBay renvoie à eBay (l'étiquette vient d'eBay, §2.8). Le scanner existant
(`ScannerColis`) s'ouvre depuis la feuille. Le sous-titre dit combien ont déjà été déposés
aujourd'hui (`gestesDepuis`).

### « Temps de préparation » (`data-attente-j`, `data-colis-attente`)
Chaque vente à envoyer dit depuis combien de jours elle attend (« attend depuis 3 j », « vendue
aujourd'hui ») : jours de calendrier à Paris depuis la date de VENTE lue (`joursAttente`) ;
date illisible ⇒ rien écrit (jamais 0). L'ordre (`rangerColisEnvoi`, le même pour l'écran et
« Tout imprimer ») : la limite la plus proche d'abord (LUE dans l'e-mail du bordereau quand on
l'a, sinon l'estimation vente + 7 j), à limite égale la vente la plus ANCIENNE, puis par
transporteur dans l'ordre de leur premier colis. L'attente est neutre ; seule la limite LUE dit
le retard : une date estimée dépassée reste « date estimée dépassée — vérifie… » (§5), et le
bord ambre de la carte ne vient plus que d'un retard LU (`lim.retard`).

## Les améliorations (avant → après)
Chaque ligne : avant → après. Règles prouvées par le banc `colis-envoi` et l'audit
`audit-colis-envoi` ; les retouches visuelles, par les captures regardées.

**La barre et l'en-tête**
1. « Scanner » absent sur « À retirer » → présent sur les trois onglets, même place.
2. « Tout imprimer » absent hors « À envoyer » / sans bordereau → toujours là, grisé et expliqué (infobulle) sans bordereau prêt.
3. « … » rond d'une autre forme (`vrm-fu-plus`) → `Bouton` de la même forme que les deux autres (hauteur, rayon).
4. « … » : `aria-expanded` écrit à la main, faux après un rendu → état React, vrai à chaque rendu ; rangé en quittant Colis.
5. « Scanner » nommé « Scanner » pour le lecteur d'écran → « Scanner un bordereau », infobulle qui dit ce qu'il fait.
6. Lien technique « Tes emails, ce que VRM en a fait » sous la liste → retiré (le journal reste dans E-mails).
7. Réglage d'imprimante « Normale (A4) / Thermique » en double → retiré (Paramètres → Imprimante et bordereaux).
8. 30 px de vide entre les onglets et la liste (fraîcheur vide avec marge, récapitulatif « seul bouton » caché mais haut de 16 px + 12 de marge) → plus de vide.
9. Bandeau « 3 à poster en priorité » → « 3 à envoyer en priorité » ; « — du retard » → « · du retard ».
10. Détail du bandeau à 11 px à l'encre → 12 px gris, interligne 1,4.
11. Phrase du bandeau qui renvoyait à des groupes disparus (« 2 dans « Prêts à imprimer », 1 plus bas dans « En attente de leur bordereau » ») → l'ordre réel : « dans chaque transporteur, le plus pressé est en haut » (+ combien attendent leur bordereau).

**La carte d'un colis à envoyer**
12. N° écrit deux fois (« N°31 · … » et une pastille « N°31 » dessous) → une pastille `Numero` dans le titre, rouge seulement si deux articles le portent.
13. Pastille N° qui se lisait « N°\n31 » au copier-coller → « N°31 » (bloc en ligne dans Colis).
14. Titre coupé à une ligne au téléphone (« Samba noir… ») → deux lignes.
15. Titre très long sans espace → coupé proprement (`overflow-wrap: anywhere`).
16. Prix « 50,00 € » (`toFixed`) → `montant()` : « 50 € », « — » si pas su, devise étrangère écartée.
17. Compte écrit sur chaque carte même avec un seul compte → dit seulement s'il y a plusieurs comptes.
18. « à poster demain » → « à envoyer demain » ; « 4 j pour poster » → « 4 j pour l'envoyer ».
19. « avant demain 12\nh » coupé → « 12 h » insécable.
20. Aucune trace de l'attente → « attend depuis N j » / « vendue aujourd'hui » (`data-attente-j`).
21. À limite égale, la plus récente d'abord → la plus ancienne d'abord (écran ET « Tout imprimer »).
22. Bord ambre aussi pour une date ESTIMÉE dépassée → seulement pour un retard LU (§5).
23. Frise : « Imprimé » ambre sur un colis sans bordereau (rien à imprimer) → ambre seulement si l'étape est faisable.
24. Logo du transporteur qui ne charge pas ⇒ carré gris vide en tête de groupe → icône de camion.
25. Case du stock en bleu `C.accent` (texte) → `C.accentTexte`.
26. « Poser le N° » / « Relier » : pilule de 32 px → la pilule reste, la cible fait 44 px (bord transparent).
27. « ✓ Colis fait » / « ↺ Pas encore » → « Déposé » / « Pas encore déposé » (le mot du scanner et de la tournée), infobulles qui disent où va le colis.
28. « · ✓ posté » → « · déposé ».
29. Carte Vestiaire : N° deux fois, prix `toFixed`, « vendue le 2 nov. » → pastille, `montant()`, « attend depuis N j » (date en infobulle).
30. Carte eBay/Leboncoin : « N°x · » → pastille `Numero`.

**Les états de « À envoyer »**
31. Ventes en panne : `LoadError` + une seconde phrase plus bas → `EtatPanne` (« Tes ventes Vinted : pas su pour l'instant », « Réessayer »), dit une fois.
32. Bordereaux e-mail, ventes eBay, colis Vestiaire illisibles : `LignePanne` (trois écritures) → `EtatPanne` compact, une raison chacun.
33. « Je lis tes ventes… » écrit à la main → `PAS_SU.enCours`, `role="status"`.
34. État vide : deux phrases, la seconde sur l'extension → « Aucun colis à envoyer » + une phrase + « Voir les envoyés » quand il y en a.
35. Bannière « Bordereau téléchargé » : vert hors palette, emojis 🆕 📄, bouton fait main → carte neutre, icône, une phrase, `Bouton` « Tamponner ».
36. Confirmation « 📄 Tamponner en 1 clic… OK = oui (auto) · Annuler = choisir un fichier » → titre, phrase, « Tamponner » / « Choisir un fichier ».
37. « Où sont ces articles dans le stock » : carte faite main → `Bouton` discret.
38. « Bordereaux déjà traités » : « voir » 12 px bleu sans hauteur, 📄, 🖨 → « Voir » / « Masquer » 44 px, `PhotoVide`, icône d'imprimante.

**« Tout imprimer »**
39. Calque fait main (fond, croix « Fermer » en bas) → `SheetShell` (poignée, titre, croix de 44 px, retour du navigateur).
40. Deux boutons de formes différentes + un « Fermer » → deux `Bouton` (« Placer le tampon », « Imprimer N bordereaux »), pied collé en bas de la feuille.
41. Marges de 18 px redoublées dans la feuille → une marge.
42. « Tout sélectionner » / « Tout décocher » : boutons nus → 44 px, fond gris.

**« Envoyés »**
43. « En transit » → « En route » ; « Livrée » → « Livré » ; « Au relais » → « Au relais de l'acheteur ».
44. « vendue il y a 0 j » → « vendue aujourd'hui ».
45. « ↺ Pas encore posté » → « Pas encore déposé ».
46. Aucun moyen de suivre un colis parti → « Suivre » (`BoutonSuivreColis`) quand le n° est lu (Vinted, Vestiaire).
47. N° « N°x · » → pastille `Numero`.
48. État vide une ligne grise → titre « Aucun colis envoyé » + « Un colis marqué « Déposé » arrive ici, jusqu'à sa livraison ».

**La frise (Colis et Ventes)**
49. « Livré » à l'encre sur un colis en route → seule la dernière étape faite est à l'encre.
50. « Imprimé » à l'encre quand rien n'est imprimé → aucune encre.
51. Trait de l'étape en cours à l'encre (lu comme fait) → piste grise (ambre si geste).

**« En grand »**
52. Calque fait main, coins de 12 px, fond noir à 82 % → `SheetShell` lumineuse.
53. Titre « Votre colis 81000001 est disponible dans votre Point Relais » → « Colis Mondial Relay » (ou l'article).
54. Lieu en gras au milieu de la feuille → sous-titre de la feuille.
55. « Le code suffit au comptoir » + « Donne ce code au comptoir… : il suffit » → une phrase.
56. ⏰ 🗓 🔍 ☀︎ → aucun emoji.
57. « à retirer avant le 10/11/2026 · 6 j » en ambre → « À retirer avant le 10 nov. · encore 6 j » neutre (ambre à J-1, J ou dépassé).
58. Faits empilés au milieu (compte, accord, n°) → une liste à filets, un fait par ligne.
59. « Suivre le colis » 36 px → `Bouton` 44 px pleine largeur, icône camion.
60. « Ajouter le QR » fait main → `Bouton` 44 px.
61. Grand bouton noir « Fermer » en double de la croix → la croix (et le glissé, le retour).
62. Phrase de luminosité de trois lignes (« VRM ne peut pas la régler à ta place ») → deux phrases.

**Nouveau**
63. Tournée de dépôt (feuille par transporteur, « Déposé » en un geste annulable, scanner, « déjà déposés aujourd'hui », « Tout est déposé »).
64. Temps de préparation (« attend depuis N j », ordre limite puis ancienneté).

## Preuves
- `npm run build` vert (après la vraie fusion de `claude/project-review-nsk5su` c534f843).
- **Banc `scripts/bancs/colis-envoi.cjs`** (données INVENTÉES, horloge figée au 5 nov. 11 h,
  `BANC_PORT` 9051, 390 tactile et 1512, clair et sombre ; F frise, B barre, G « En grand »,
  L largeur, T tournée, P préparation, Z erreurs/débordement) : **114 verts, 0 rouge** ;
  sur la base intégrée (archive de c534f843 construite à part, banc copié dedans) :
  **58 rouges** (F 16, G 16, B 14, P 8, T 4), 24 verts. L (largeur) est vert avant et après :
  la liste occupait déjà la largeur (choix de Julien du 19 oct.), le banc le garde.
- **Audit `scripts/audit-colis-envoi.cjs`** : 53 verts ; `--mutations` **11/11 tuées**
  (encre sur l'étape en cours, `derniere` posée partout, CSS d'encre sur `[data-fait]`, attente
  0 au lieu de « pas su », ordre « récent d'abord », titre = sujet d'e-mail, doublon dans la
  tournée, barre qui dépend de l'onglet, journal revenu, « En grand » sombre, « Tout imprimer »
  rangé autrement que l'écran). Sur la base (module copié pour que le chargement passe) :
  **26 rouges**.
- Audits verts : `audit-rouge-doublon`, `audit-composants`, `audit-coherence`, `audit-identite`,
  `audit-icones`, `audit-fonctions-api`, `audit-frise-sites` (17), `audit-colis-trois` (31/31,
  `--prouve` 12/12), `audit-colis-heure` (32), `audit-colis-sens`, `audit-qr`,
  `audit-retrait-qr` (43, `--prouve` 15/15), `audit-file-envoi`.
- Bancs voisins (après la fusion) : `colis-scan` 42/0, `colis-qr` 100/0, `tout-imprimer` 26/0,
  `selection-bordereaux` 54/0, `lot-bordereaux` 17/0, `journal-emails` 58/0, `vestiaire-parite`
  68/0, `postes` vert, `poste-sans-depart` vert, `lien-vc-frise` 62/0, `colis-tous-sites` 12/0,
  `tampon-libre` 38/0, `jetons-coherence` vert, `composants` 274/0, **`fusion-app` (Colis) 25/0**
  (l'écart F5 « Poser le N° » 93×32 relevé par le coordinateur : cible 44 px). Identiques à la
  base : `colis-heure` 3 rouges (Ma journée, hors zone), `emballage` 3 rouges (« Emballer » caché
  derrière « … » depuis le 2 nov.), `statuts-colis` 26 rouges (26 sur la base).
- **Bancs adaptés, et pourquoi** (chacun jugeait l'ancien rendu, jamais la règle) :
  · `colis-heure` : « à poster » → « à (poster|envoyer) » (mot retenu par la revue) ;
  · `tout-imprimer`, `selection-bordereaux` : « N°x · Titre » → « N°x Titre » (le N° est une pastille) ;
  · `lot-bordereaux` : le premier `button[data-imprime]` de la page → `[data-lot] button[data-lot-imprimer]`
    (la feuille est un portail : le premier « data-imprime » de la page était devenu une carte) ;
  · `postes` : le bouton au texte « Colis fait » → `button[data-geste="fait"]` (le geste s'appelle « Déposé ») ;
  · `vestiaire-parite` : la pastille « N°… » lue aussi dans le titre (`Numero`) ;
  · `colis-qr` : « Fermer » → la croix de la SheetShell, et l'animation d'entrée terminée avant
    « Ajouter le QR » (à 1512, un clic dans les 150 ms suivant l'ouverture n'ouvrait pas le
    sélecteur de fichier — attendre 500 ms le rend sûr) ;
  · `journal-emails` : l'entrée « Tes emails » n'est plus dans Colis (revue 2.21) : le banc
    juge qu'on arrive sur Colis et que l'entrée n'y est plus ;
  · `audit-colis-trois` 2d : l'écran et le lot passent par `rangerColisEnvoi` (même règle) ;
  · `audit-retrait-qr` : l'ancre de la mutation E6 suit la nouvelle ligne d'échéance.
- **Captures** (regardées) : avant
  `/tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/d-avant3/` et
  `/tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/d-avant/` ; après
  `/tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/d-apres/`
  (`colis-envoi-{390,1512}-{clair,sombre}-{envoyer,liste1,liste2,liste3,outils,tournee,envoyes,retirer,en-grand}.png`).

## Ce qui reste
- **Partagé, non modifié (à reprendre par leur chantier)** :
  · `src/design/carteChiffres.js` : la case `aposter` dit « À poster / à poster » sur la carte
    sombre de Colis, Ventes, Ma journée — à passer à « À envoyer » (mot de la revue) ;
  · `Numero` (chantier B) est `inline-flex` : son texte se lit « N°\n31 » (copier-coller,
    `innerText`, bancs). Colis le pose en `inline-block` localement ; à faire dans le composant ;
  · `Bouton variante="discret"` lit `--vrm-b-lien` = l'aplat `#0071E3` : 4,21:1 sur le gris de la
    page (fusion-app F6). Colis utilise « secondaire » à la place ; le jeton devrait lire `accentTexte`.
- « Tout imprimer » : la ligne « 1 · N sélectionné(s) » et « N sélectionnés sur M » disent le même
  nombre deux fois (feuille du lot) — à fondre en une ligne.
- La tournée regroupe par transporteur : le point de dépôt précis d'un colis n'est lu nulle part
  (aucune identité ne le relie) — si un jour le bordereau le porte, le groupe pourra le nommer.
- eBay dans la tournée : pas de « Déposé » (VRM n'a pas de coche eBay), lien vers eBay.
- `emballage` (3 rouges, comme la base) : « Emballer » est derrière « … » depuis le 2 nov. ; le
  banc clique un bouton invisible — à adapter par qui reprend le mode emballage.
- Les cartes d'un colis à envoyer ont encore leurs gestes faits main (`sec` en ligne) sous « … ».
