# 8 nov. 2026 (soir) — Extension 5.329 : se connecter DANS la carte, sans iframe ni onglet ; rester connecté

Branche `claude/connexion-carte-2` (depuis `origin/main`, qui sert la 5.328). Pas de PR, pas de merge (consigne).

## Ce que Julien a dit (8 nov., 22 h, iPhone, Orion, 5.328) — ses mots
« Je suis obligé d'appuyer sur l'icône dans les paramètres de l'extension, et non directement dans Vinted.
Quand j'appuie sur Vinted et "Se connecter avec VRM", ça ouvre encore VRM. Je ne veux pas du tout de ça. Je
veux avoir les outils de connexion directement là, et que ça n'ouvre AUCUN autre onglet, parce que ça devient
problématique et ça se DÉCONNECTE À CHAQUE FOIS de mon compte. »

## 1. Pourquoi la carte n'affichait pas le formulaire (lu dans le code, reproduit au banc — pas mesuré sur l'iPhone)
La 5.328 posait dans la carte un `<iframe src="popup.html?mode=carte">` (une page de l'EXTENSION dans la page
vinted.fr) et attendait qu'il envoie `{__vrmCarte:'prete'}` par `postMessage`, en vérifiant
`ev.source === iframe.contentWindow` depuis le monde isolé du script de contenu. Pas de « prête » en 6 s ⇒
`secoursFormulaire()` : « Le formulaire ne s'affiche pas… » + **« Se connecter avec VRM »**, qui appelle
`lierAvecVRM` ⇒ `ouvrirVRMDepuis` ⇒ `chrome.tabs.create(vrm.center/?lier-extension=…)`. C'est exactement ce que
Julien décrit. Sur Orion, rien ne garantit l'iframe : le paquet Orion est un MV2 refabriqué
(`scripts/zip-extension.cjs`, `manifesteOrion` : `web_accessible_resources` aplati, pas
d'`externally_connectable`, `compat-orion.js` devant chaque script), et le moteur WebExtension d'Orion sur iOS
n'est ni Chrome ni Safari : charger une page d'extension DANS une page web, puis l'identité
`ev.source === iframe.contentWindow` entre le monde de la page et le monde isolé, sont deux points qu'aucun test
réel n'a jamais confirmés (les passations Orion du 25 oct. et du 5 nov. disent « aucun iPhone réel testé »). La
fenêtre de l'icône, elle, est une page d'extension chargée par le navigateur lui-même : elle marche, d'où « je
suis obligé d'appuyer sur l'icône dans les paramètres ». Reproduit : `scripts/bancs/carte-orion-sans-onglet.cjs`
sur la 5.328 (page d'extension muette comme sur Orion) ⇒ 15 rouges, dont « au bout de 6,5 s : `Se connecter avec
VRM` ».

## 2. Le formulaire directement dans la carte (vrm-badge.js)
- E-mail + mot de passe VRM **dessinés dans la shadow root FERMÉE** de la carte (la page lit
  `hote.shadowRoot === null`, aucun `<input>` de la carte dans son DOM), `autocomplete="off"` et des noms à nous
  (`vrm-carte-identifiant`, `vrm-carte-secret`) — pas mélangés avec les identifiants Vinted. Champs 44 px,
  16 px (iOS ne zoome pas), « Me connecter » (bleu Apple, le seul accent), Entrée (envoi du `<form>`), erreurs
  dites dans la carte (champs vides, e-mail mal formé, « Email ou mot de passe incorrect », service worker muet
  20 s), « Mot de passe oublié ? » (lien, seul geste qui mène au site, sur demande).
- **Bouclier** : `keydown/keyup/keypress/beforeinput/input/composition*/paste/copy/cut` arrêtés à la frontière
  de la carte (sur l'hôte, et sur `window` en capture). ⚠️ Limite dite : un écouteur que la page a posé sur
  `window` en capture AVANT la carte entend toujours la touche ; la VALEUR des champs ne lui est jamais lisible.
- Le mot de passe part UNE fois au service worker (`{from:'vrm-badge', action:'authLogin'}` — accepté seulement
  d'un onglet, jamais suivi d'une ouverture), le champ est vidé dès la réponse ; jamais rangé, jamais dans une
  adresse, jamais `postMessage`.
- **Supprimé de la carte** : l'iframe, `secoursFormulaire`, « Se connecter avec VRM », `lierVRM`.
  « Changer de compte VRM » montre le formulaire dans la carte (avec « Annuler ») au lieu d'ouvrir VRM.
  « Ouvrir VRM » (connecté) reste : c'est un geste qu'il fait exprès.
- **Google / Discord** : impossible sans afficher la page de Google/Discord. La carte les montre SEULEMENT si le
  service worker peut ouvrir une **petite fenêtre** (`chrome.windows.create({type:'popup'})`, que `oauthRetour`
  referme) : Chrome, Edge, Firefox ordinateur. **Orion (iPhone) n'a pas de fenêtres ⇒ pas de Google/Discord
  dans la carte** (`oauthFenetre:false`, `data-fournisseurs="sans-fenetre"`) — le mot de passe suffit ; ils
  restent dans la fenêtre de l'icône. Un `oauthDepart` de la carte sans fenêtre possible est refusé, jamais un
  onglet.

## 3. « Ça se déconnecte à chaque fois » — ce qui est trouvé et corrigé
Pas de journaux d'authentification lisibles depuis cette session (accès Supabase refusé) : rien n'est mesuré
chez lui. Trois causes trouvées dans le code, prouvées au banc :
1. **« Pas su » affiché comme « déconnecté »** (la plus probable sur un téléphone). Quand le jeton d'accès a
   expiré (toutes les heures), la fenêtre de l'icône demande `authEtat`, qui n'attend le renouvellement que 2 s ;
   au-delà (réseau mobile, service worker qui se réveille, ou pause après un échec réseau — iOS coupe le réseau
   d'Orion en arrière-plan), elle rendait `connecte:false, expiree:true, incertain:true` ⇒ la fenêtre affichait
   **« Session expirée » + le mot de passe**, et l'icône rouvrait la connexion, alors que rien n'était perdu.
   ⇒ `popup.js` : `incertain` (et pas `mort`) = connecté, « ta session se renouvelle », relu dans 4 s ;
   `chrome.action.onClicked` ne rouvre plus la connexion sur un `incertain`.
2. **Deux renouvellements du même jeton** : le verrou était en mémoire (`_refreshEnVol`) ; deux réveils du
   service worker (Chrome le coupe à 30 s, iOS gèle Orion) envoyaient le MÊME jeton. Supabase pardonne une fois
   (le parent du jeton actif), mais chaque rotation de trop rapproche du « déjà utilisé » qui révoque toute la
   famille. ⇒ verrou dans `chrome.storage.local` (`vrmRenouvVerrou` : empreinte du jeton, 12 s), attente de la
   session rangée par l'autre ; la session rangée remplace la copie en mémoire (`storage.onChanged`) ; on
   n'envoie jamais un jeton qui n'est plus celui du stockage.
3. **Rangement de la session non vérifié** (`try { set } catch {}`) : stockage plein ou refusé ⇒ la session ne
   vivait qu'en mémoire, et au réveil suivant l'extension relisait l'ancienne ou rien. ⇒ `rangerSession` relit
   ce qu'elle écrit, réessaie une fois, et le note (`session_non_rangee`) — jamais en silence.
Non changé : la liaison par VRM (`demanderLiaison`) ne déconnecte rien ; « Se déconnecter » dans VRM déconnecte
l'extension (geste voulu) ; une session MORTE (refus définitif) redemande toujours le mot de passe.

## Preuves (§6)
- `scripts/bancs/carte-orion-sans-onglet.cjs` (vrai `vrm-badge.js` + VRAI `background.js` derrière
  `sendMessage`, faux GoTrue, page d'extension muette comme Orion) : **25 verts** ; 5.328 : **15 rouges** ;
  mutation « bouclier retiré » ⇒ rouge. Juge : shadow root fermée, formulaire présent, 0 iframe, 0 champ dans le
  DOM du site, autocomplete off, 6,5 s sans « Se connecter avec VRM », 44 px, bleu Apple clair/sombre, mauvais
  mot de passe dit et rien rangé, la page n'entend rien, session rangée, mot de passe nulle part,
  **`chrome.tabs.create` jamais appelé**, onglet rouvert ⇒ toujours connecté ; ordinateur : Google en petite
  fenêtre, aucun onglet.
- `scripts/tests/extension-reste-connecte.cjs` (vrai `background.js`, faux GoTrue à rotation, horloge avancée) :
  **12 verts** (connexion, redémarrage, +6 h, deux contextes simultanés ⇒ UN jeton envoyé, service worker tué
  en plein renouvellement, rangement raté noté, icône) ; 5.328 : **3 rouges** (2 jetons envoyés, rangement raté
  muet, icône).
- `scripts/bancs/badge.cjs` 126 verts (règles iframe ⇒ formulaire) ; `scripts/bancs/popup.cjs` 151 verts (+
  « renouvellement en cours » ; rouge sur le `popup.js` 5.328).
- Verts : `audit-extension-oauth`, `audit-sans-session-envoi`, `audit-coherence`, `audit-extension-zip`,
  `audit-paquets-boutiques`, `audit-pont-session`, `audit-extension-ui` (règle 3 réécrite : un champ mot de passe
  n'est permis que dans la carte, shadow fermée + autocomplete off + bouclier + `authLogin`),
  `audit-extension-navigateurs`, `audit-extension-captcha`, `audit-liaison-visite`, `audit-garde-fous-capture`,
  `audit-fiabilite-fond`, `audit-violet`, tests `orion-*` (auth-autonome, connexion, pont-canal, injection,
  paquet, cors-reel) ; `npm run build`.
- Captures regardées (390 tactile) : `carte-orion-formulaire-light/dark.png`, `carte-orion-connecte-light/dark.png`.

## Version
5.329.0 : `CODE_VERSION`, manifeste, `lbc-inject.js`, `lbc-relay.js`, `EXT_ATTENDUE`, `EXT_CAPACITES.cartesansonglet`
(→ `prendreVerrouRenouv`, audit-coherence), table §8, paquets régénérés (`node scripts/zip-extension.cjs`).
Aucune permission ajoutée.

## Pas fait / pas vérifié
- Rien n'est mesuré sur un vrai iPhone. La cause de l'iframe est déduite du code et reproduite au banc, pas
  observée dans Orion.
- Les journaux d'auth Supabase n'ont pas pu être lus : la part réelle de chaque cause de « déconnexion » n'est pas
  connue. Si ça continue, regarder `session_non_rangee`, `session_morte_*`, `session_renouv_*` dans les diagnostics.
- Un verrou laissé par un service worker tué retarde le renouvellement suivant de 12 s au plus (le jeton d'accès
  encore valide sert pendant ce temps).

## Geste de Julien
Installer la 5.329 (`VRM-Orion-dossier.zip` sur l'iPhone), puis sur vinted.fr : toucher le logo VRM → e-mail +
mot de passe VRM → « Me connecter ». Aucun onglet ne s'ouvre.
