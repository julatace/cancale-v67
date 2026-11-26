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

## Suite du 26 nov. — 5.453.2 (retour réel de Julien, 5.453.1 lancée depuis le PANNEAU, compte angeled92)
Constaté : 1er favori (jcbr12) « Pas parti · Vérifie les envois incertains sur Vinted avant de préparer une nouvelle
file », toute la file bloquée ; l'onglet de travail sur `inbox/<uuid>` ; RIEN parti, champ vide. Son indice : « quand on
appuie sur le favori, ça propose DIRECTEMENT l'offre ».

**Causes (dans le code, 5.453.0/5.453.1)** :
1. Le favori ouvre la conversation AVEC la fenêtre « Faire une offre » par-dessus (elle remplace le champ du message). La
   séquence « comme Bleam » cherchait d'abord le champ du message (`vrm-formulaire.js` étape `message`) ⇒ introuvable ou
   pas rempli ⇒ rien tapé.
2. La frappe posait la valeur à la main (setter natif / `textContent` + `InputEvent` fabriqué) : un éditeur riche (React)
   ne la garde pas ⇒ champ vide, « Envoyer » ne part pas ⇒ aucune requête vue ⇒ `sans-reponse, parti` ⇒ « incertain ».
3. Un incertain bloque toute nouvelle file chez VRM (`lancerFile`, `reserverFile`) — garde-fou voulu — mais le panneau
   n'avait AUCUN geste pour le trancher.

**Corrections (5.453.2)** :
- `favoriOuvrir` dit si la fenêtre d'offre est ouverte (`offreOuverte`) ; `sequenceFavoriBleam` fait alors l'offre D'ABORD,
  dans cette fenêtre (garde du prix, plancher), le message dans le champ de la fenêtre s'il y en a un (vu dans le fil, sinon
  « incertain »), sinon ensuite dans la conversation. Sans offre réglée, la fenêtre est fermée (son bouton, sinon Échap)
  avant de taper ; elle ne se ferme pas ⇒ « pas parti » nommé (`offre-fenetre-ouverte`).
- Étape `offre` : la fenêtre déjà ouverte est utilisée (sans toucher « Faire une offre »).
- Frappe : chaque lettre par `document.execCommand('insertText')` (champ au focus — le chemin d'édition du navigateur),
  sinon l'ancienne pose ; la valeur relue 0,4 s après (un éditeur qui la remet à vide ⇒ « pas parti » certain).
- « Envoyer » touché sans aucune requête d'envoi, texte toujours dans le champ, rien de plus dans le fil ⇒ « pas parti »
  CERTAIN (`message-non-parti`), la file continue. Le texte compté hors du champ (un champ riche est dans `innerText`).
  Preuve de plus : la réponse de Vinted à CET envoi qui porte CE texte.
- « C'est parti » / « Pas parti » sur la ligne d'un envoi à vérifier (panneau → favoris) ⇒ route serveur `trancher`
  (`trancherIncertain` : parti ⇒ envoyé, jamais recontacté ; pas parti ⇒ refusé sans écriture, re-choisissable par lui).
  Le refus de lancement « incertains » dit ce geste en bandeau. Jamais un renvoi automatique.
- Capacité `favorisfenetreoffre` (5.453.2).

**Preuves** : `sim-extension --seul P2` (fenêtre d'offre au favori + éditeur riche) : 7 verts / 3 rouges sur 5.453.1
(`element_absent:message-champ`, ni message ni offre), 10/0 sur 5.453.2 ; mutation « sans execCommand » ⇒ rouge.
`audit-favoris-trancher` 8/0 (nouveau).

**Geste de Julien** : installer la 5.453.2 ; sur la ligne de jcbr12, regarder la conversation sur Vinted puis toucher
« C'est parti » ou « Pas parti » ; relancer 1 favori. Si ça ne part pas, la ligne dit maintenant l'élément qui manque :
envoyer cette phrase + la trace d'« Observer Vinted (10 min) » (la forme réelle de la fenêtre d'offre y est relevée).
