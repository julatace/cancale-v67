# 8 nov. — Zéro audit rouge

Branche `claude/zero-audit-rouge` (depuis `claude/amazing-lovelace-xd7obl`, qui porte le
découpage d'App.jsx). Sept audits étaient rouges sur `main` comme sur la branche depuis
plusieurs jours. Pour chacun : la cause, ce qui a été changé, la preuve. Aucun contrôle
retiré ; aucun garde-fou de l'extension, aucune règle d'identité ni de numéro touchés.

## `audit-argent-a-venir` — contrôle périmé (orthographe)
Cause : le contrôle « Ventes (Tous les sites) monte la carte « À venir » » exigeait
`<ArgentAVenirCarte A={liveStatsVus && liveStatsVus.aVenir}/>` au caractère près. Le 6 nov.
(banc chargement, commit 68372770) la carte a reçu la prop `reserve` (elle garde sa place en
squelette pendant la lecture, CLS 0,036 évité) : une présentation, pas la règle.
Correctif : `reserve` est admis ; le `A=` de la coque reste exigé.
Preuve : vert (51/51). Mutation `A={liveStatsVus && liveStatsVus.autre}` ⇒ rouge.

## `audit-chemin-json-guillemets` — contrôle trop large, jugé sur la règle
Cause : deux clés interpolées sans guillemets — `->>${CHAMP_JETON[genre]}`
(`api/_lib/jeton-index.js`) et `->${cleOffreVc(nego)}` (`background.js`). Aucune n'est un
défaut : la première est une table de constantes (`vrm_widget_token`, `vrm_sms_token`),
la seconde un helper qui préfixe une lettre (`'n' + String(id)`) ; PostgREST ne peut les
lire comme un index. Le danger que l'audit chasse est la clé NUMÉRIQUE.
Correctif : une clé est admise seulement si elle est NON NUMÉRIQUE PAR CONSTRUCTION,
vérifiée sur sa DÉFINITION (table : chaque valeur commence par une lettre ; helper : préfixe
d'une lettre devant `String(id)`) — jamais sur son nom. Extension non modifiée.
Preuve : vert. `--prouve` (guillemets retirés de `lireFicheAnnonce`) ⇒ rouge ; mutation
`cleOffreVc = (id) => String(id)` ⇒ rouge ; mutation `widget: '3290'` ⇒ rouge.

## `audit-export-donnees` (X6) — contrôle périmé (décision écrite)
Cause : X6 exigeait « Exporter mes données » SANS aucune phrase. Le 6 nov. (Onglets D,
« Paramètres par intention, une phrase par réglage » ; Visuel : « une ligne d'explication
au plus ») chaque réglage a reçu son `desc`.
Correctif : X6 juge « au plus une phrase courte » (≤ 90 signes, un point final au plus) ;
la ligne, son geste et son `data-exporter-donnees` restent exigés.
Preuve : vert (19/19). Un paragraphe de 145 signes ⇒ rouge ; libellé changé ⇒ rouge.

## `audit-journee-coherence` (A4) — contrôle périmé (liste figée)
Cause : A4 attendait une expression `nGestes` figée au 6 nov. ; la carte « Relier la boîte
de <compte> » (`comptesARelierJour`, 6 nov., commit 046ac344) y a été ajoutée — et elle est
bien comptée. L'app était juste, le contrôle en retard d'une carte.
Correctif : la RÈGLE plutôt que la liste — chaque carte rendue dans « À faire »
(`{cond ? carteX() : null}`, `{liste.map(…)}`, `tache(urssafJob)`) doit avoir son terme
dans `nGestes` ; les sept cartes nommées depuis le 4 nov. restent exigées.
Preuve : vert (30/30). Retirer de `nGestes` le terme de « Relier la boîte », de la sortie
du Stock, ou `autres.length` ⇒ rouge, et le message nomme la carte non comptée.

## `audit-photos-vinted` — VRAI DÉFAUT (corrigé dans l'app) + 3 sources nommées
Cause 1 (défaut) : l'écran E-mails (`src/BoiteEmails.jsx`, Heros et vignette de ligne)
affichait la photo de la paire — une photo VINTED (`photoEmailParTx` →
`photosVenteVintedCandidates`) — par un `<img>` nu : pas de secours par l'extension, image
cassée quand le lien Vinted meurt.
Correctif : `BoiteEmails` reçoit `Photo={PhotoVinted}` (de `EcranEmails`, App.jsx) par un
contexte ; `PhotoPaire` garde le cadre de la classe (taille, coins, grille) et y pose
`PhotoVinted` (sans référent, secours, pictogramme). Sans `Photo`, aucune photo.
Cause 2 (contrôle) : trois `<img>` arrivés après la liste fermée, relus un à un, aucun ne
peut être une photo Vinted : `EnGrandHorsLigne` (QR data:image ou `/hl-qr` local, la même
source que `QrHorsLigne`), `ReglagesStream` (constante data:image/svg), `RecherchePhoto`
(`URL.createObjectURL` de SA photo). Ajoutés à `PERMIS` avec leur raison.
Preuve : rouge sur le code d'avant (5 inconnus dont les 2 de BoiteEmails), vert après ;
`vite build` passe.

## `audit-politique-hotes` — contrôle en retard du découpage
Cause : la liste fermée des couples (fichier, hôte) disait `src/App.jsx|www.vinted.fr`… ;
le découpage du 8 nov. a déplacé ces lignes dans `src/ecrans/*.jsx`, et
`src/enLigneLbc.js` porte le lien « Mes annonces » Leboncoin.
Correctif : les 18 couples nouveaux, relus à leur ligne (tous des `<a href>`, un `lien` de
pied « ↗ » ou une table d'adresses ouverte d'un clic ; `vrm.center` = le lien du widget) :
classés « lien »/« vrm » avec leur raison. Aucun n'est contacté seul par le navigateur.
Preuve : vert ; `--prouve` 11/11 mutations attrapées (dont « un nouvel hôte non déclaré »).

## `audit-registres` — dépendance d'ENVIRONNEMENT (le dépôt est juste)
Cause : `pdfjs-dist` 4.10.38 est déclaré dans `package.json` (devDependencies) mais n'était
pas installé dans le `node_modules` de ce conteneur. Rien à corriger dans le dépôt.
Correctif : l'audit dit désormais en clair « pdfjs-dist n'est pas installé dans … (il est
déclaré dans package.json : lance « npm install ») » et reste ROUGE (un PDF non relu n'est
pas vérifié — « pas su » ≠ « oui »). Dans ce conteneur, pdfjs-dist a été installé à part
(hors dépôt) pour le lancer.
Preuve : vert (64/64) avec pdfjs-dist ; sans lui, rouge avec la phrase ci-dessus.

## Tous les audits
Voir la section « Relance complète » ci-dessous.
