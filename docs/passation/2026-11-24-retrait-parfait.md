# 24 nov. 2026 — « À retirer » parfait : le comptoir, avant, après (branche `claude/retrait-parfait`)

Julien : « pour le retrait tu dois vraiment faire quelque chose de parfait ». Base : `claude/retours-suivi` (#1341, proposition C
choisie, point Vinted Go nommé) fusionnée avec `origin/main`. Rien n'est changé à `src/retraitPreuves.js`, `regrouperArrivees`,
`pointsARetirer`, `colisDuPoint`, l'identité : la liste, le tri et les preuves sont ceux d'avant ; ce lot change ce qu'on VOIT et ce
qu'on TOUCHE.

## Mesuré d'abord (lecture seule, projections et formes seulement, rien de personnel copié)

Lignes `email_track_*` : Mondial Relay 231 (101 disponibles, 79 avec `limite`, aucune avec horaires), Chronopost 93 (22 `limite`,
10 `horaires` en tableau, 7 `code2`, 43 QR hébergés), Vinted Go 46 (9 `limite`, 2 horaires, 32 QR hébergés), « autre » 93 (aucune
`limite`), Colissimo 5, DPD 2, Shop2Shop 2 ; **Relais Colis : aucune ligne** (forme commune des e-mails prise pour le banc).
`lieu` : « NOM, n° RUE, CP VILLE » (Mondial Relay, Chronopost), « Relais Vinted Go, <commerce>, <rue> » sans code postal,
« ® … » (anciens Mondial Relay), vide (18 Vinted Go). `horaires` : `[{ jours: [1..7], plages: [{ de, a }] }]`. **Aucune ligne ne
porte `limiteAt` sans `limite`** aujourd'hui (le cas corrigé plus bas est donc préventif).

## Ce qui existait déjà (vérifié, gardé)

- La carte par point (C) : logo, nom lu (ou transporteur), adresse, « Itinéraire » (Plans sur Apple, Google Maps ailleurs), échéance LUE.
- Le tri par urgence (`trierPoints` : la limite lue la plus proche, « à vérifier » seul en dernier).
- Les codes hors ligne : la photo de Ma journée (`src/journeeHorsLigne.js`) et la réserve de QR du service worker (`/hl-qr?u=`).
- Les rappels du matin (`api/ship-reminders.js` → `rappelsRetraitDuJour`) : la veille et le jour J, une fois par colis et par seuil
  (`demain-{n°}`, `dernier-{n°}`, mémo `colis_retrait_dedup`), date LUE seulement, jour de Paris ; « à vérifier » ne sonne plus (3 nov.).
- La feuille d'un colis en grand (`openQrView`, Wake Lock `GardeEcranAllume`, ajout du QR par capture Mondial Relay) : gardée, c'est
  « Détails ».

## Ce qui est livré

1. **Le comptoir d'un point** (`src/natif/Guichet.jsx`, `src/natif/guichet.css`) : toucher un code, un QR, ou « Montrer le(s)
   code(s) » au pied de la carte ouvre UNE feuille pour CE point, sur CE colis. Tous les colis du point s'y suivent (glisser au doigt,
   ‹ › et points de pagination à l'ordinateur). Chaque colis : la photo de la paire (achat relié par identité seulement, sinon rien),
   le titre, le N°, la date limite LUE ; le CODE entier en très grand (44–76 px, chiffres groupés, chasse fixe), l'identifiant d'une
   consigne, le QR à la taille maximale — **sur blanc, encre noire, même en sombre** ; « Retiré » sur SON toucher (le geste d'avant :
   `retirerRelais` ⇒ `markCollected` / `markPickupDone`, annulable), puis « Retiré ✓ · Annuler » ; « Détails » = la feuille d'avant.
   - **L'écran reste allumé** : Wake Lock demandé à l'ouverture (repris au retour sur l'app), relâché à la fermeture (`useEcranAllume`).
     La luminosité, aucune API web ne la règle : une ligne le dit (« Luminosité au maximum »).
   - **Retour** : le geste retour d'iPhone / Android, ← et Échap ferment la feuille (`FermeAuRetourUi`, le vrai `FermeAuRetour`).
   - **Hors ligne** : les codes sont déjà dans la page (rien n'est relu pour les montrer) ; la feuille le dit (« Hors ligne · codes
     gardés ici ») ; un QR hébergé qui ne charge plus est redemandé à la réserve du service worker ; les QR hébergés de tous les
     points y sont mis pendant que le réseau est là (`rechaufferQrs`). Rien gardé ⇒ « QR pas gardé hors ligne : donne le code. »
   - Le dernier colis retiré vide la liste : la feuille reste ouverte (« Retiré ✓ · Annuler ») jusqu'à ce qu'il la ferme.
   - ⚠️ Julien avait retiré le 20 nov. le MODE « Je suis au point » (un bouton qui ouvrait un écran à part) : ce lot n'en remet pas ;
     le comptoir s'ouvre par le geste qu'il fait déjà (toucher le code), et par « Montrer » au pied de la carte.
2. **La carte du point** : l'ouverture CALCULÉE sur les horaires LUS, à l'heure de Paris (« fermé — ouvre à 8 h · aujourd’hui
   8 h–12 h, 14 h–19 h », « ouvert maintenant · ferme à 12 h ») — `horairesDuJour` ajouté à `api/_lib/horaires-relais.js`, l'état
   (`data-rp-ouverture`) ; horaires pas lus ⇒ rien. Plusieurs colis au même point avec des dates différentes : chaque rangée dit SA
   date lue (sinon l'en-tête la dit, une fois). « Montrer le(s) code(s) » sur chaque point qui a un code (plein sur le premier point).
3. **« À vérifier »** : reste dans son point, sa raison (« Date limite dépassée · à vérifier »…), et UN geste : « Retiré » (sur son
   toucher, annulable).
4. **Le rappel de retrait** : `rappelsRetraitDuJour` exigeait `limite` ; une ligne qui ne porte que l'HEURE limite lue (Vinted Go
   `limiteAt`) était muette. Désormais `limite || limiteAt` (toutes deux lues ; jamais `limiteVers` ni la garde).
5. Textes en 5 langues (`retraits.g.*`, `retraits.p.aujourdhui`), « Quoi de neuf » `retrait-comptoir`.

## Les 2 captures iPhone de Julien (production, 24 nov. midi : « regarde c'est moche, corrige »)

Ce qu'elles montraient (production = `main`, variante « b ») et ce que cette branche (sur #1341, variante C) fait — chaque point a
son contrôle dans `retrait-parfait.cjs` (J1–J9) :
- nom du point sur 2 lignes + pastille d'échéance flottante ⇒ nom sur UNE ligne, échéance en texte calme dessous (J1, et #1341) ;
- logo décalé ⇒ centré sur le nom (J1) ;
- adresse coupée (« Saint-Méloir-des-Ondes ») ⇒ jamais coupée, elle passe à la ligne ; l'ouverture a sa propre ligne (J2 ;
  `retrait-point-c` K7 passe de « une ligne » à « deux lignes au plus, entière ») ;
- « Contenu pas encore lu · ouvre vinted.fr sur shop_cancale » à côté d'une case grise ⇒ vignette neutre, « Contenu pas encore lu »,
  le geste sous « Pourquoi ? » (J6) ;
- pastilles « Nouveau » ⇒ un point discret avant le titre (J3) ;
- « Transporteur pas dit · comptoir », « limite pas lue » ⇒ rien d'écrit pour ce qu'on ne sait pas (J4) ;
- traits de progression différents d'un colis à l'autre (ils ne s'allument que sur une date LUE) ⇒ la frise se DIT, « Au point ·
  24 nov. » ; les cinq étapes restent pour le lecteur d'écran (J5) ;
- le message « Nouveau code de retrait » posé sur le contenu ⇒ sur `main` depuis le 23 nov. (style-clarte-4) il se range dans la place
  du bas, dans le flux : il ne recouvre plus rien (J7, mesuré sur la zone visible) ;
- haut d'Achats : « Relier achats et ventes » coupé au bord, « Modifier » seul au-dessus d'un chiffre, bande serrée, onglets coupés
  (« Annu… ») ⇒ au téléphone (`src/styles-achats-photos.css`, fin) les gestes dans la marge, la bande en carte (Modifier discret sur
  la ligne du mois, Dépensé en grand, trois colonnes égales sous un filet), les onglets sur toute la ligne (✓ et « ⋯ » dessous)
  (J8, J9). ⚠️ Ces règles sont dans la couche `vrm-premium` : une déclaration `!important` d'une couche passe devant toute
  déclaration `!important` hors couche (mesuré : hors couche, la règle « correspondait » et ne s'appliquait pas) ;
- « En route · point pas encore dit 21 » ⇒ « 21 en route » (#1341, J8) ;
- « À renvoyer 2 » à moitié sous la barre : c'est le défilement (la section suit, entière, une fois défilée — K12 du banc C).

## Preuves

- `scripts/audit-retrait-rappel-exact.cjs` E1–E4 (la règle EXÉCUTÉE) : vert ; `--prouve` 4/4 mutations rouges (`limite-estimee`,
  `heure-muette` = le code d'avant, `jour-utc`, `cle-sans-seuil`).
- Banc `scripts/bancs/retrait-parfait.cjs` (390 tactile / 1512, clair / sombre, heure fixée 07:10 puis 10:00 Paris) : P1–P6, J1–J9,
  G1–G5, H1 — **160 verts, 0 rouge** ; sur la pointe de #1341 (b343c07fc, bâtie à part) : **10 rouges** (P3, P4, P5, P6, J2, J5, J6, G1…)
  puis le banc s'arrête (pas de comptoir). Captures regardées (390 / 1512, clair / sombre) à côté de celles de Julien.
- H1 (hors ligne) : l'app passe Achats sur sa vue hors ligne (photo de la dernière lecture complète) — les 6 codes y sont, « Au
  comptoir » s'ouvre, écran allumé ; quand la liste reste montée, le comptoir dit « Hors ligne · codes gardés ici ».
- `retrait-point-c` (K2 « Montrer » sur chaque point, K7 l'adresse entière) : 39 verts, 0 rouge (390 et 1512 clair).
- `retrait-point-c` K2 suit la règle neuve (« Montrer » sur chaque point qui a un code).
- Audits intouchables, inchangés et verts : `audit-retrait`, `audit-codes-retrait`, `audit-retrait-preuves`, `audit-retraits-fiables`,
  `audit-retraits-irreprochables`, `audit-retrait-fiable`, `audit-retrait-qr`, `audit-retrait-vinted-go`, `audit-point-vinted-go`,
  `audit-suivi-colis`, `audit-coherence`, `audit-traduction`, `audit-quoi-de-neuf`, `audit-style-vintex`, `audit-textes-courts`,
  `audit-icones`, `audit-studio`. `audit-boutons-natifs` : rouge AUSSI avant (AchatsTableau.jsx, sans lien).

## Reste à faire / à regarder

- Le composant de jeu (`src/natif/Jeu.jsx`, branche `claude/visuel-jeu`) n'est pas sur `main` : la feuille suit #1341.
- Le Wake Lock d'iOS Safari n'existe qu'à partir d'iOS 16.4 (PWA installée : 18.4) : plus ancien ⇒ `data-gc-veille="absent"`, rien
  d'autre ne change.
