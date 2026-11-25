# 25 nov. — « Après la sélection, plus rien ne marche » (ext. 5.453.1)

Branche `claude/favoris-sequence-repare` (partie de `claude/favoris-gestes-humains`, a42c4ff26, 5.453.0). Pas de PR.

## Ce que Julien a constaté (5.453.0)
« Ça repère le favori, ça te propose de le sélectionner, mais après plus rien ne marche » : ni cloche, ni ligne, ni
conversation, ni message, ni offre, et aucun message d'erreur.

## Ce qui a été mesuré (vraie extension, Chromium, `scripts/bancs/sim-extension.cjs`)
- **P1 (nouveau) — depuis le PANNEAU, de vrais clics** (`?vrm=panneau&page=favoris` : cocher, « Envoyer », les étapes,
  « Lancer ») : **vert sur 5.453.0** — cloche lue, ligne touchée (la page ouvre la conversation), texte tapé, « Envoyer »,
  offre, file finie. Le chemin du panneau n'est pas cassé dans le banc.
- **D1 (nouveau) — « Envoyer aux favoris » DEPUIS VRM** (décision du 24 nov. : tout faire depuis VRM si l'extension est
  connectée ; la commande « À distance » écrite comme l'app l'écrit, `nouvelleCommandeDistance`, geste `favoris`,
  `ids: []`) : **rouge sur 5.453.0** — la commande est refusée « aucun favori à contacter pour ce compte », rien ne part.

## La cause
`vinted-sync-extension/background.js` `distFavoris` (ajoutée en **5.450, lot agir-tout #1374**, donc présente en 5.452 et
5.453.0) choisissait les favoris dans `apercu.liste` en exigeant `cochable === true`. Or le serveur
(`api/_lib/favoris-carte.js`) ne met `cochable` que sur `apercu.tous` ; les lignes de `liste` n'en ont jamais ⇒ choix
toujours vide ⇒ « aucun favori à contacter », jamais rien d'envoyé depuis VRM. L'audit `audit-agir-si-connecte` servait une
fixture inventée (`cochable` dans `liste`) qui cachait la panne ; le banc de bout en bout servait `liste` en identifiants nus.

## La correction (5.453.1)
- `distFavoris` choisit exactement ce que `lancer` accepte (`cochablesApercu` : `tous`, cochable, « à envoyer »), du plus
  récent au plus ancien ; rien à envoyer ⇒ une phrase qui dit pourquoi.
- Capacité `favorisdistance` (5.453.1) : l'app n'envoie la commande « favoris » qu'à une extension qui sait la faire ;
  une 5.450–5.453.0 ⇒ « mets à jour » (avant : la commande partait et était refusée).
- La file des favoris RETENUE par une garde le dit sur l'écran plein (« Tout arrêter » posé, pas de réseau, autre compte,
  pas d'onglet vinted.fr, VRM muet, garde de sécurité) au lieu de « En attente du prochain favori » (`vrm-action.js`
  `ATTENTES_FAV`, textes en 5 langues).

## Preuves
- `sim-extension --seul D1` : 3 verts / 6 rouges sur 5.453.0 ; 9 verts après. `P1` 9/0 avant et après. F1, F5, F7 verts.
- `audit-agir-si-connecte` (fixture à la vraie forme) : 63/0 ; mutation « choix 5.453.0 » ⇒ 2 rouges. ⚠️ Son `--prouve`
  est faussé (la copie de `src/` oublie `compatSafari.js` : toutes les mutations « rougissent » sur l'import) — mutation
  faite à la main. coherence, extension-zip, favoris-gestes-humains, ecriture-humaine, formulaire-rythme, cadence,
  actions-app, moteur-offres, connexion-simple, traduction ; bancs popup, interface-vinted, favoris-auto, cloche-favoris.

## Ce qui ne se vérifie que sur son compte
Si Julien lançait depuis le PANNEAU (pas depuis VRM), le banc ne reproduit pas la panne : il faut sa trace. Demande :
installer la 5.453.1, ouvrir le panneau → Paramètres → « Observer Vinted (10 min) », lancer UN favori depuis le panneau,
puis envoyer la phrase affichée sur l'écran plein (elle dit maintenant la garde qui retient) et la trace.
