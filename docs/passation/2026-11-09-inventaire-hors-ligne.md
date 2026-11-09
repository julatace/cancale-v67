# 9 nov. — L'inventaire au téléphone, et le hors connexion complet

Branche `claude/inventaire-hors-ligne` (depuis `origin/main` `b3ec1b17`), poussée à chaque
commit, **pas de PR ni de merge** (consigne de la session). Rien de `vinted-sync-extension/`
n'est touché (aucune extension à réinstaller). Aucune migration. Données des bancs et audits
inventées.

L'existant a été **étendu, pas doublé** : l'inventaire du 6 nov. (`src/inventaire.js`,
`src/InventaireStock.jsx`, passation `2026-11-06-inventaire.md`) et le hors réseau du 21 oct. /
6 nov. (`src/journeeHorsLigne.js`, `JourneeHorsLigne` dans App.jsx, passation
`2026-11-06-hors-reseau.md`).

## 1. L'inventaire au téléphone

### Ce qui existait (6 nov.) et reste
Stock → « Faire l'inventaire » ; retour immédiat (attendu à l'encre, ambre « à vérifier » et
« vendu — à sortir », rouge seulement pour deux paires sous un N°, gris « pas su ») ; « Annuler » ;
case par case ; bilan ; ligne `vrm_inventaire` en lire-fusionner-réécrire sur `rev` ; copie sur
l'appareil `vrm_inventaire_local_{uid}` ; reprise ; Ma journée « Inventaire en cours ». AUCUN N°
n'est changé (§5).

### Ce qui est nouveau
- **Le pavé géant** (`PaveGeant`, src/InventaireStock.jsx) : au doigt (pointeur grossier), VRM
  dessine son propre pavé — 12 touches de 64 px (1-9, « B » pour l'archive, 0, ⌫) — et le
  clavier du téléphone ne s'ouvre pas par-dessus (`inputMode="none"`). « ABC » rend le clavier
  texte (B125). À la souris : rien ne change (clavier, Entrée).
- **La vibration** (`motifVibration`, src/inventaireHorsLigne.js) : courte = attendu ; double =
  un geste (à vérifier, vendu) ; longue = deux paires sous un N° ; triple courte = pas un N°.
  Android/Chrome seulement — l'iPhone l'ignore, rien n'en dépend (le mot et la couleur disent tout).
- **Les mots de Julien** : le bilan dit **« À chercher »** (attendues, pas vues) et
  **« À vérifier »** (vues, pas attendues ; et « À vérifier — vendues, encore rangées ») ; le
  retour immédiat dit « À vérifier · Pas attendu ici : … » au lieu de « En trop ». Les attributs
  `data-inv-*` ne changent pas (les bancs jugent la règle, pas le libellé).
- **Le constat FIGÉ** (`constatInventaire`, src/inventaire.js) : à « Terminer », le bilan de CE
  jour-là est gardé dans la session (`constat` : N° à chercher, à vérifier, vendues rangées,
  doublons, pas su, lectures manquantes nommées, nombre de vus, heure de la liste si fait hors
  connexion). Des N° et des nombres seulement (ni titre, ni photo). À la fusion de deux
  appareils, le constat le plus récent gagne. « Inventaires précédents » (les 3 derniers) →
  « Revoir » le montre TEL QU'IL ÉTAIT, sans rien recalculer. Un inventaire d'avant le 9 nov.
  n'a pas de constat : on montre ses N° vus et on le dit, rien d'inventé. **Pas su ≠ manque** :
  une lecture pas faite ne fige aucun « à chercher ».
- **La comparaison sans ordre de clés** (`memeContenu`, src/inventaire.js) : une ligne relue
  après fusion portait les mêmes saisies dans un autre ordre ⇒ chaque synchronisation réécrivait
  la ligne pour rien (rev +1). Rejouer est maintenant sans effet quand rien n'a changé.

### Hors connexion (dans la cave, sans réseau)
- **La liste figée** (src/inventaireHorsLigne.js) : chaque fois que le Stock a LU l'attendu
  (`aa.su`), il le fige sur l'appareil, au nom de CE vendeur : `vrm_hl_inventaire_{uid}`
  (préfixe `vrm_` ⇒ effacée à la déconnexion). Même source que la feuille
  (`fabriquerStockInv` dans src/ecrans/Stock.jsx : `aa.articles`, `aa.manque`, `vrm_stock_vendus`,
  `vinted_nums_physiques`, `vrm_num_doublons`, gardées, cases, meubles). La règle `jugeable`
  n'est pas copiée : ses RÉPONSES sont gardées pour chaque N° qui a une fiche, plus une pour un
  N° inconnu. Une liste « pas su » n'est jamais figée ; une liste au nom d'un autre vendeur n'est
  jamais servie. Ni photo ni fonction dedans (≈ quelques Ko).
- **Hors connexion**, la coque montre `JourneeHorsLigne` : sur l'onglet Stock elle propose
  maintenant « Faire l'inventaire » (`BlocInventaireHorsLigne`), et Ma journée hors connexion
  aussi. La feuille est la MÊME (`InventaireStock`, chargée à la demande — son morceau est déjà
  là si le Stock a été ouvert), jugée contre la liste figée, avec UNE ligne en tête :
  « Hors connexion · liste des paires du 9 nov. à 14:02. Tes N° restent sur cet appareil et
  partent au retour du réseau. » Au-delà d'un jour : une ligne ambre (« refais le bilan avec du
  réseau »). Hors connexion, l'inventaire ne lit ni n'écrit la base (`lire` rend « pas su » ⇒
  aucune écriture, règle §5).
- **Le réseau coupe pendant le tour** : la feuille revient aussitôt, au même point
  (`INVENTAIRE_FEUILLE.ouverte`, tenu par le Stock) ; le réseau revient : le Stock la rouvre
  (`DEMANDE_STOCK_INVENTAIRE`).
- **Au retour du réseau, feuille fermée ou non** : `useRejouerInventaire` (AppCoeur, après la
  session ; évènement `online` et 1,5 s après l'ouverture) envoie la copie de l'appareil par la
  règle normale (`enregistrerInventaire` : lire-fusionner-réécrire sur `rev`) — seulement si le
  drapeau `vrm_inventaire_attente_{uid}` dit que des saisies attendent. Union par saisie : rejouer
  deux fois ne double rien et n'écrit plus rien la 2ᵉ fois. Lecture ratée ⇒ rien d'écrit, on
  réessaie au prochain retour.

## 2. Le hors connexion complet (au point relais)

### Ce qui existait et reste
Ma journée hors ligne (la photo après une lecture COMPLÈTE, par vendeur), Colis hors réseau (un
point relais = une carte, codes + QR, « En grand »), « J'ai retiré » / « Colis fait » mis en file
(`save` → file d'envoi `src/fileEnvoi.js`, rejoués au retour, clé par clé), « N changements en
attente d'envoi », jamais « tout est à jour ».

### Ce qui est nouveau
- **Les bordereaux déjà ouverts** (src/bordereauxHorsLigne.js) : `lirePdfLigne` range au passage
  le PDF d'une ligne de BORDEREAU (`email_bord_*`, `harvest_{uid}_label_{tx}` — jamais
  `label_latest`, jamais un reçu ni une facture), au nom de CE vendeur, jamais pour une lecture
  d'équipe, dans la réserve `vrm-hl-pdf` (au plus 30, les plus anciens partent). Rien n'est
  téléchargé d'avance (§4.4 : ligne lourde). La photo de Ma journée relie chaque colis à SES
  lignes de bordereau par sa transaction (`envoyer[].pdf`, identité — jamais le titre). Hors
  connexion, « Bordereau » est un vrai lien (`<a href=blob:…>`, s'ouvre aussi sur iPhone) vers
  le PDF tel que fourni (sans le tampon du N°, dit dans la phrase du bas) ; pas gardé ⇒ « Bordereau
  pas gardé ici », jamais un faux bouton. La réserve part à la déconnexion (`wipeLocalData`).
- **« À déposer »** : la liste hors connexion s'appelle « À déposer » et le geste « Déposé »
  (le même marqueur `vinted_ship_done` que « Colis fait » / « Déposé » en ligne). Un colis eBay
  ou sans identité dit pourquoi il n'a pas de geste, en clair (plus seulement au survol).
- La phrase « ce qui ne part pas » dit maintenant : générer un bordereau, imprimer avec le N°
  tamponné, répondre — demandent le réseau ; un bordereau déjà ouvert se rouvre.

### Le service worker (`public/sw.js`) — UNE ligne changée
À l'activation, la purge des anciennes réserves gardait `vrm-shell-v6` et `vrm-hl-qr` ; elle
garde maintenant aussi tout ce qui commence par `vrm-hl-` (les réserves du hors connexion :
QR, et les bordereaux `vrm-hl-pdf`) :
`keys.filter(k => k !== CACHE && k !== CACHE_QR && !k.startsWith('vrm-hl-'))`.
Rien d'autre : ni la stratégie réseau, ni le cache des `/assets/`, ni `/print-pdf/`, ni les
notifications (`push`, `notificationclick`, `pushsubscriptionchange`) ne bougent
(`audit-inventaire-hors-ligne` H6 le vérifie). Coordination : l'agent `claude/vitesse-demarrage`
peut toucher le cache JS du même fichier — la ligne changée est dans `activate` seulement.

## 3. ⚠️ Ce qui bloque ENCORE le hors connexion « à froid » (décision à prendre)

**`src/PorteConfidentialite.jsx` ferme l'app sans réseau.** Ouvrir VRM SANS réseau (app
fermée, puis rouverte au point relais) : la porte appelle `/api/compte?mode=confidentialite`,
échoue, et affiche « Vérification indisponible » — Ma journée hors ligne, les codes, l'inventaire
hors connexion ne s'affichent pas. Les bancs `hors-ligne`, `hors-reseau`, `codes-hors-ligne`
passaient parce que `_porte-banc.cjs` répond À LA PLACE du serveur, dans la page, même hors ligne.
Ce qui marche sans rien changer : l'app DÉJÀ OUVERTE quand le réseau coupe (le cas « je perds la
4G dans le relais »).

Correctif proposé (écrit, puis refusé par le garde-fou de sécurité de la session — pas appliqué) :
ouvrir la porte seulement si (1) `navigator.onLine === false` ET (2) CE vendeur a déjà passé le
contrôle sur CET appareil (`vrm_porte_ok_{uid}`, effacé à la déconnexion) ; rien de la base n'est
lisible sans réseau, seules ses propres données déjà gardées s'affichent ; au retour du réseau le
contrôle est refait aussitôt et la porte se referme s'il échoue ; en ligne, rien ne change (elle
échoue fermée). **À décider par Julien** (c'est une porte de sécurité).

## 4. Preuves

- `node scripts/audit-inventaire-hors-ligne.cjs` (nouveau) : 37/37 ; `--prouve` : 9/9 mutations
  rouges (jugeable perdu au gel, ventes perdues, « pas su » figé, autre vendeur servi, constat
  perdu à la fusion, « à chercher » figé sans lecture, `label_latest` gardé, bordereau d'un autre
  lu, réserve sans borne).
- `node scripts/audit-inventaire.cjs` 69/69, `--prouve` 17/17 (I7 relu sur `fabriquerStockInv`,
  le drapeau « en attente » admis à côté de la copie locale, `inputMode` au doigt).
- `audit-journee-hors-ligne` vert (fenêtre de lecture 4 000 car. : la ligne porte `pdf`).
- Bancs : `scripts/bancs/inventaire.cjs` (phases G-H-I-J ajoutées) et
  `scripts/bancs/hors-ligne.cjs` (phase E ajoutée) — résultats et captures ci-dessous.

## 5. Geste de Julien
- Ouvrir le Stock une fois avec du réseau (la liste se fige toute seule), puis Stock →
  « Faire l'inventaire », même sans réseau.
- Décider du §3 (la porte hors connexion).
