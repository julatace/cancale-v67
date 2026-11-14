# 14 nov. 2026 — Colis plus (propositions 96 à 101, « fais tout »)

Branche `claude/colis-plus`. Julien a validé six propositions autour de l'emballage et de l'envoi.
Règle suivie : **mesurer ce qui existe d'abord, ne rien refaire, compléter.** Toutes les règles
nouvelles sont dans des modules PURS, exécutés par `scripts/audit-colis-plus.cjs` (61 contrôles,
21 mutations, toutes rouges) ; le rendu est jugé par `scripts/bancs/colis-plus.cjs`.

## Ce qui existait, ce qui manquait, ce qui est fait

| n° | demande | existait déjà (mesuré) | manquait | fait |
|---|---|---|---|---|
| 96 | Format de colis retenu par modèle, proposé à chaque vente | Le choix FACULTATIF de l'emballage d'un colis dans « Préparer mes colis » (`ChoixEmballageColis`, `vrm_emballages.choix`, lot L du 10 nov.) ; le défaut ; le modèle d'un titre (`modeleSur`, src/ceQuiRapporte.js, une proposition) | Aucune mémoire par modèle : il rechoisissait à chaque fois | `vrm_emballages.parModele` (synchronisé avec le reste) : SON choix est retenu pour le modèle ; au colis suivant du même modèle, une ligne « Proposé : Grand carton, ton choix pour Nike Air Force 1 · **Prendre** ». Rien n'est posé sans son toucher ; le décompte suit SON choix, sinon le défaut. Dit honnêtement : « sert à prendre le bon carton et à compter ton stock ; le format Vinted reste celui de l'annonce » (Vinted fixe le format à la publication). |
| 97 | Stock de fournitures décompté à chaque colis, avertir avant d'en manquer | Le stock d'emballages (lot L) : saisi par lui, DÉRIVÉ des « Colis fait » datés après le comptage (un « Annuler » rend l'emballage), seuil à lui, alerte ambre, jamais d'achat — sur la carte du Stock | Les fournitures prises par CHAQUE colis (scotch, papier bulle) ; l'alerte au moment de préparer ; le rythme | Un type « **à chaque colis** » (`tous`, `pour` = colis par unité : 1 rouleau ≈ 25 colis) pris par tout « Colis fait » daté (même « Aucun » emballage) ; une unité ENTAMÉE compte comme prise (l'alerte vient avant d'en manquer) ; « ≈ 43 colis » ; « à ton rythme, ≈ N jours » seulement si ≥ 3 colis en 14 j ; dans Préparer, une ligne ambre « Plus que 1 · Scotch. Pense à en racheter. » au seuil qu'IL a choisi. |
| 98 | Bordereaux 4 par page A4 | L'isolation de l'étiquette (`poserBordereau` en thermique, `zoneEtiquette`, `analyserZone`), le tampon, « page entière quand on ne sait pas » ; pdf-lib (impression) et pdf.js (aperçus) dans le projet | La mise en page 2 × 2 | Réglages → Imprimante : troisième choix « **4 par page A4** » (`IMPR_MODES` += `planche4`). « Tout imprimer » isole les étiquettes par la MÊME règle, puis `imposerPlanche` (src/impression/planche4.js) les range quatre par feuille, dans l'ordre, une échelle commune (≈ 95 %, marge d'impression 5 mm), trait de coupe en pointillés ; une page pas découpable part SEULE à 100 % (la feuille entamée est close avant elle). L'aperçu dit « 3 feuilles A4, 4 par page », le résultat « 9 étiquettes sur 3 feuilles A4, à 95 % ». Un bordereau imprimé seul reste en A4 entière (dit dans le « Détail »). |
| 99 | Douchette sur ordinateur | Le scanner caméra (`ScannerColis`, `trouverParScan`, formes MESURÉES du code-barres : 26 chiffres ⇒ n° aux chiffres 3 à 10) ; la cible `vente:{tx}` des notifications | L'écoute du clavier, la vente ouverte | `src/douchette.js` : une rafale (< 50 ms entre deux touches) + Entrée, hors champ de saisie, est un code ; une frappe humaine n'en est jamais un. `venteDuCode` : n° de transaction, n° de suivi (e-mail ET étiquette lue), code-barres du bordereau — égalité EXACTE ; deux ventes ⇒ rien ; inconnu ⇒ dit. `DouchetteGlobale` montée une fois (coque) ; Ventes résout (`enregistrerResolveur`), sinon l'app y mène et le code attend 1 min. Trouvée ⇒ `?tab=ventes&cible=vente&tx=…` (éclairée). L'Entrée de la douchette n'active pas le bouton focalisé. |
| 100 | Mains libres pendant l'emballage | Le moteur de dictée du navigateur (`dicteeNavigateur.js`, une phrase, `fr-FR`, codes d'erreur) ; « Préparer mes colis » (Imprimer, Colis fait différé 5 s + « Annuler », ‹ ›) | Une écoute continue, des commandes | `src/mainsLibres.js` : écoute CONTINUE relancée après un silence, langue de VRM ; commandes FERMÉES « suivant », « précédent », « imprimer », « fait », « stop » (5 langues), une phrase courte faite seulement de la commande et de mots admis (« ok suivant », « c'est fait ») — « il fait froid » ne fait rien. « fait » = le geste « Colis fait » (5 s, « Annuler » visible) ; chaque commande est confirmée à l'écran. Sans reconnaissance (Firefox, Safari d'iPhone selon la version) : la ligne dit pourquoi, puis disparaît (et ne revient pas). Aucune clé, aucun serveur (§2.9). |
| 101 | Temps par colis, gain réel à l'heure | Les « Colis fait » de la séance de Préparer sont datés (`seance.faits`) ; le relevé de Ventes (`vrm_stats_ventes`) et `beneficePaire` | La mesure, la mémoire, l'affichage | `src/tempsColis.js` : sur l'appareil (`vrm_temps_colis_{uid}`), l'écart entre deux « Colis fait » de CETTE ouverture ; > 15 min = pause, < 15 s = colis déjà prêt : « pas mesuré » ; « Annuler » recalcule. Le total est un PLANCHER (« au moins »). Gain = bénéfice des colis mesurés AU PRIX D'ACHAT CONNU / leur temps, « sur N colis » ; aucun ⇒ « — ». Au récapitulatif de Préparer : tuiles « Cette séance » et « 30 derniers jours », « Comment c'est mesuré » replié. |

## Ajout de midi (Julien, mot pour mot)

« Je veux que tu laisses la possibilité de sélectionner imprimante classique ou imprimante thermique et je veux
que quand je mets tout imprimer, je puisse quand même modifier un par un chaque bordereau avec le tamponnage.
J'espère que le tamponnage pour la feuille classique est resté. »

| demande | existait (mesuré) | fait |
|---|---|---|
| Choisir classique / thermique | Seulement dans Réglages → Imprimante ; la feuille « Tout imprimer » n'avait qu'un lien « Changer le papier ou le tampon » | Dans la feuille « Tout imprimer », un segmenté **Classique · A4 / 4 par page A4 / Thermique · 10×15** (le MÊME réglage `vrm_imprimante` que Réglages, écrit sur son toucher, gardé ; l'aperçu suit tout de suite). Réglages garde ses trois choix. |
| Modifier un par un, avec le tampon | Le tampon était un réglage GLOBAL (`tamponA4`, `tamponTh`) ; « Placer le tampon » (la place, par forme) ; décocher une ligne | Sous CHAQUE aperçu : son tampon (**N° seul / N° + titre / + taille / Rien**) et **Retirer du lot**. Le choix vaut pour CE bordereau seulement (`it.tampon` remplace `tamponA4`/`tamponTh` dans `poserBordereau`) ; « Placer le tampon » reste. §5 : la garde `confirmerNumerosAVerifier` DEMANDE toujours avant le lot (audit C10, mutation rouge). |
| Le tampon de la feuille classique est-il resté ? | Oui : `poserBordereau` (page entière) → `tamponnerBordereau` avec `tamponA4` (N° + titre par défaut) | **Prouvé dans la vraie app** (banc `colis-plus` F) : Tout imprimer en classique ⇒ chaque page du PDF (relu par pdf.js) porte SON « N° 31… » et son titre ; le bordereau réglé « Rien » n'a ni N° ni titre ; « N° seul » a son N° sans titre ; le bordereau retiré n'est pas dans le PDF. En 4 par page (isolation thermique) : chaque étiquette porte SON N° (A4/A5). Le thermique pur est jugé par `thermique.cjs` (inchangé). |

## Ajout de l'après-midi : « l'impression beaucoup mieux guidée »

Sur sa capture de Ventes → À expédier. La feuille « Tout imprimer » (Choisir · Imprimer · Déposer, lot DJ3) devient
un parcours qui dit à chaque étape ce qui se passe et ce qu'on attend de lui, un seul bouton plein par étape :

1. **L'imprimante**, en tête : Classique · A4 / Thermique · 10×15 / 4 par page A4, avec UNE phrase sur la différence
   (« Classique : une feuille A4 par bordereau, ton N° tamponné dessus » …), mémorisée (`vrm_imprimante`).
2. **Ce qui part** : cochés par défaut ; « Pas dans ce lot » dit ceux sans bordereau et porte « Générer » groupé
   (`BoutonToutGenerer`, déjà là) ; « à vérifier » à part.
3. **L'aperçu** : chaque bordereau tel qu'il sortira, SON tampon (N° seul, N° + titre, + taille, rien) et « Retirer du lot ».
4. **Imprimer** (le seul bouton plein).
5. **« Tout est sorti ? »** : la liste des bordereaux imprimés ; il coche ceux « mal sortis » ⇒ le bouton devient
   « Réimprimer les N ratés » : les autres passent « prêts à déposer », les ratés repartent SEULS à l'impression
   (preuve : banc F8, et audit C14 + mutations). « Rien n'est sorti » revient à l'étape 1 sans rien marquer.

## Preuves (fin de journée)

- `audit-colis-plus` : 67 verts ; `--prouve` 26/26 mutations rouges ; sur `origin/main` : rouge (modules absents).
- Banc `colis-plus` (lancé par sections, la machine était partagée et chargée) : 390 clair 17/17, 390 sans voix 3/3,
  390 sombre 17/17, 4 par page 8/8, classique un par un + « Tout est sorti ? » 8/8, douchette 7/7, Préparer 1512 17/17.
  Sur `origin/main` (même banc copié dans l'arbre, dist reconstruit) : 18 contrôles rouges.
- Gardés verts : `tout-imprimer` (28), `tout-imprimer-garde` (8), `colis`, `thermique` (403), `tampon-bordereau` (199),
  audits traduction, tdz, coherence, variables, identite, csp, quoi-de-neuf, impression, calculette-emballages.
- ⚠️ `colis-a-leur-place` : son contrôle « I » (clic sur « Oui, imprimé » : « élément pas stable ») est rouge AUSSI
  sur `origin/main` (même dist reconstruit, même vue) : défaut d'avant ce lot, pas corrigé ici.

## Où c'est

- Règles : `src/douchette.js`, `src/mainsLibres.js`, `src/tempsColis.js`, `src/impression/planche4.js`, `src/emballages.js` (étendu, les lignes que l'audit du lot L mute sont gardées mot pour mot).
- Écrans : `src/Douchette.jsx`, `src/MainsLibres.jsx`, `src/TempsColis.jsx`, `src/EmballagesCarte.jsx` (formulaire « à chaque colis », proposition, alerte), `src/PreparerColis.jsx` (trois points d'entrée), `src/styles-colis-plus.css`.
- App.jsx : la douchette montée à côté de `CibleNotif` ; le résolveur dans le `Comptabilite` de Colis (Ventes) ; `IMPR_MODES`, `mergeAndDownloadBordereauxBrut` (imposition), l'aperçu et le résultat du lot ; Réglages → Imprimante (`ImprimanteSetting`).
- Textes : `src/i18n/langues/<l>/colisplus.js` (clés `cp.*`, 5 langues) ; `MainsLibres.jsx` et `TempsColis.jsx` dans la liste « migrés » d'`audit-traduction`.
- Quoi de neuf : six lignes (`colis-format-modele`, `colis-fournitures`, `bordereaux-4-par-page`, `douchette-ordinateur`, `mains-libres-emballage`, `temps-par-colis`).

## Preuves

- `node scripts/audit-colis-plus.cjs` : 61 verts ; `--prouve` : 21/21 mutations rouges (ambiguïté ignorée, titre ou n° approché accepté, frappe humaine prise pour une douchette, champ de saisie écouté, phrase libre ou deux commandes acceptées, pas de relance, pause comptée, gain à 0 ou deviné, coche non datée décomptée, fourniture d'avant le comptage, unité entamée oubliée, proposition imposée ou après son choix, « Aucun » retenu, ordre de la planche, A4 écrasée dans un quart, planche pas branchée, douchette pas montée). Sur `origin/main` : rouge (les modules n'existent pas).
- 99 : 50 ventes au même titre — chaque n° de transaction et chaque n° de suivi désigne LA bonne, et elle seule ; le titre ne désigne rien ; un code inconnu ou tronqué ⇒ rien ; deux ventes au même n° ⇒ rien.
- 97 : décompte seulement sur un « Colis fait » DATÉ après le comptage ; « Annuler » rend le stock.
- 98 : 9 bordereaux ⇒ 3 feuilles A4 (4 + 4 + 1), ordre conservé — dans le plan ET relu dans le PDF produit par pdf-lib (XObjects posés dans l'ordre).
- Banc `scripts/bancs/colis-plus.cjs` (390 tactile clair et sombre, 1512) : voir le résultat en bas de ce fichier.

## Ce qui n'est pas fait (dit)

- eBay : la douchette ne reconnaît pas encore les commandes eBay (le SKU `VRM-{n°}` est une identité, mais l'étiquette eBay se prend dans eBay) ; Leboncoin non plus (aucun n° de suivi dans nos lignes).
- Mode emballage (l'ancien « Emballer », colonne « Prêts à imprimer ») : ni voix ni temps — tout est dans « Préparer mes colis », le chemin d'aujourd'hui.
- `src/ui/*` de `claude/refonte-listes` n'est pas encore sur `main` : pas importé (les deux lignes ajoutées vivent dans des feuilles existantes, avec les jetons `--d-*`).
