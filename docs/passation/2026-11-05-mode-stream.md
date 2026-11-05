# Mode stream programmé — 5 novembre 2026 (branche `v31-mode-stream`)

Demande : `docs/passation/demandes-2026-11-05.md` §11 et « Précisions du vocal » :
« Remplacer le bouton « masqué » par un bouton « stream » ; la personne prédéfinit tout ce
qu'elle veut cacher » — « pour qui filme VRM, il programme ce qu'il veut flouter — marques,
prix, numéros de compte, noms de ses comptes Vinted, “les mots qui commencent par…”,
“toutes les annonces qui ont…” ».

## Ce qui existait
- `src/streamFlou.js` (17 oct.) : en mode stream (`vrm_stream`, propre à l'appareil), un
  observateur posait un FLOU CSS (`data-stream-flou`) sur l'élément qui contenait un pseudo
  de ses comptes, un e-mail, un téléphone, un IBAN ; `.vrm-sensible` flouté aussi. Le texte
  restait dans la page (un flou de 6 px sur un grand titre se relit ; une capture du DOM,
  un lecteur d'écran le donnaient en clair). Pastille ROUGE « Stream » dans l'en-tête
  (rouge réservé au doublon de N°, §7). Les montants n'étaient PAS cachés.
- `src/montantsCaches.js` (4 nov.) : l'œil de l'en-tête (`data-bouton-montants`) qui
  réécrivait chaque montant en « ••• ».

## Ce qui est fait — UNE règle
- **`src/modeStream.js`** remplace `streamFlou.js` (supprimé) et l'œil. En mode stream, le
  TEXTE rendu est réécrit « ••• » dans le rappel de l'observateur (une micro-tâche après le
  rendu de React, avant que l'image soit peinte) ; la règle d'origine est rendue à
  l'extinction. Ce qu'elle cache, selon SON programme :
  - catégories à cocher (toutes cochées par défaut ; seul un `false` explicite montre une
    catégorie — « pas su » ne montre rien) : prix et montants (règle de
    `montantsCaches.js`, y compris un montant coupé en deux nœuds) · noms de ses comptes
    (Vinted, eBay, Leboncoin, Vestiaire, e-mail VRM, entreprise, SIRET) · pseudos des
    acheteurs et des vendeurs de ses achats · adresses (rue, code postal + ville), e-mails,
    téléphones · numéros de compte (IBAN, SIRET/SIREN, carte) · codes de retrait et QR ·
    bordereaux à l'écran ;
  - trois listes : **marques et mots** (mot entier, majuscules ignorées), **les mots qui
    commencent par…**, **cacher toute l'annonce qui contient…** (la LIGNE entière : carte
    d'annonce, vente, achat, colis, conversation, ligne de Ma journée — texte réécrit et
    ligne floutée, photo comprise ; ailleurs, l'ancêtre qui a des frères de même forme).
- Les **jetons** (ce que la règle reconnaît dans n'importe quelle phrase) : ses comptes
  Vinted (pseudos, e-mails, étiquettes), eBay, le compte ouvert dans Chrome, l'e-mail VRM,
  l'entreprise (comme avant) ; NOUVEAU : les pseudos des ventes, achats et conversations
  Vinted (`Comptabilite`), les acheteurs eBay, les comptes Leboncoin (`lbc_accounts`, nom)
  et Vestiaire (`vc_session`, identifiants) — ces deux lignes ne sont lues qu'en mode stream,
  projetées.
- **Partout** : tous les nœuds de texte de `document.body` (listes, fiches, feuilles,
  portails, toasts, menus `<option>`), les infobulles `title`, les champs dont la valeur est
  à cacher (floutés), la **notification système** (`pushNotif` → `textePourStream`).
  Les `.vrm-sensible` sont cachés en bloc ; leur `data-stream-type` suit une case
  (`acheteur`, `code`, `compte`), sans type : toujours. CSS (index.html, posé avant le
  premier rendu) : `[data-stream-ligne]` flouté ; `data-stream-image="bordereau"` (aperçus
  PDF, visionneuse, page du tampon) et `"code"` / `img[alt^="QR de retrait"]` floutés selon
  les cases ; le QR de la double vérification (`data-mfa-qr`) toujours.
- **Le bouton « Stream »** (`BoutonStream`, `data-bouton-stream`) remplace l'œil ET la
  pastille rouge : icône « diffusion » (44 px au téléphone), « Stream » écrit à côté sur
  ordinateur, point d'accent bleu quand il est allumé. Un tap allume/éteint (sur cet
  appareil). L'œil allumé sur un appareil (`vrm_montants_caches=1`) passe une fois en mode
  stream allumé (il cache les montants par défaut).
- **Réglages → Affichage → Mode stream** (`type:'panneau'`, `ReglagesStream`) :
  l'interrupteur, les catégories, les trois listes (puces 44 px, « × » pour retirer, saisie
  « a, b, c » acceptée), un **aperçu en direct** sur des données INVENTÉES
  (`ton_compte`, `acheteur_exemple`, une adresse et un IBAN d'exemple — jamais ses vrais
  pseudos dans une démonstration) et un champ « Essaie un texte ».
- **Synchronisé** : le programme est la clé `vrm_stream_regles` (SYNC_KEYS, ligne `main`) ;
  suivi par `useReglesStream()` au niveau d'`AppCoeur` (le nuage relu change la règle tout
  de suite). L'interrupteur `vrm_stream` reste propre à l'appareil (on filme depuis un
  appareil). Un geste pas encore écrit par `save` (délai) gagne sur une relecture du nuage
  arrivée entre-temps (`_reglesStreamEnAttente`) — défaut vu au banc à 390 px avant ce
  correctif.

## Preuves
- `npm run build` vert.
- `node scripts/audit-mode-stream.cjs` : 35 contrôles verts (programme, règle texte, lignes,
  nœuds coupés, branchement : œil et pastille retirés, `<BoutonStream/>` rendu une fois,
  SYNC_KEYS, notification, CSS, panneau) ; `--prouve` : **11/11 mutations** passent au rouge.
  Sur l'arbre d'avant (`git archive c52bb8ee`) : rouge (module absent).
- Banc `scripts/bancs/mode-stream.cjs` (données inventées de `nouveau-vendeur.cjs` +
  programme `Nike`, `Adidas`, « Sal… », « contient Asics »), 390 tactile et 1512, clair et
  sombre : A le banc n'est pas vide hors stream ; B le bouton, 44 px, mémorisé ; C sur 13
  écrans (journee, annonces, vinted_annonces, ventes, plat_vinted, plat_leboncoin, cat_bord,
  messages, garage, achats, dashboard, compta, settings) aucun montant, aucun nom de compte
  (`vendeuse_a`, `vendeuse_b`, `Ma boutique`, e-mail), aucun pseudo d'acheteur, aucune marque
  programmée, aucun « Sal… », aucune adresse ni code de retrait dans `innerText`, les N°
  restent, l'annonce Asics cachée en ligne entière ; D réglages : catégories, programme relu
  du nuage, aperçu en direct, POST de `main.vrm_stream_regles` ; E éteint d'un tap, tout
  revient. **Après : 170 OK, 0 KO** (4 configurations). **Avant** (`git archive c52bb8ee`,
  banc copié dedans) : **116 KO**. Pas de bouton ; montants, comptes, pseudos et marques
  lisibles sur chaque écran ; pas de réglages ; pas de synchronisation.
- Bancs adaptés au nouveau bouton : `comptes-securite.cjs` (partie B : `data-bouton-stream`),
  `compte-supprime.cjs` (bouton au lieu de la pastille, texte caché au lieu du flou),
  `entreprise-stream.cjs` (le texte caché se compte, il n'est plus « vu »).
  `revue-ecrans.cjs` (mode stream) n'a pas besoin de changer. Relancés : `comptes-securite`
  (B) vert, `compte-supprime` vert, `entreprise-stream` B et C verts. Ses 2 rouges de la
  partie A (nom à côté du logo au téléphone, phrase « registre muet ») sont AUSSI rouges sur
  l'arbre d'avant : sans lien avec le mode stream, pas traités ici.

## Ce qui reste / limites dites
- **Notifications push du serveur** (`public/sw.js`, envoyées app fermée) : le serveur ne
  connaît pas l'interrupteur de l'appareil ; elles ne passent pas par la règle. Côté app,
  les toasts et la notification système de `pushNotif` y passent.
- **Les photos** : une marque visible SUR la photo d'un article n'est pas reconnue ; la
  photo n'est floutée que dans une ligne « qui contient… ».
- **PDF ouverts dans un autre onglet** (« Ouvrir dans un onglet ») : hors de la page, pas
  floutés.
- **Extension** : rien à faire pour cette fonction (le panneau de l'extension n'est pas
  dans la page de VRM). Si Julien veut le même mode dans le panneau de l'extension : lire
  `vrm_stream_regles` (ligne `main`, lecture seule, projetée `select=r:data->vrm_stream_regles`)
  et appliquer la même règle (recopie refabriquée de `src/modeStream.js`, jamais modifiée à
  la main) — non fait ici (l'extension est en chantier dans une autre session).
- **Geste de Julien** : toucher « Stream » en haut, puis Paramètres → Réglages → Mode stream
  pour écrire ses marques et ses mots ; regarder l'aperçu.
