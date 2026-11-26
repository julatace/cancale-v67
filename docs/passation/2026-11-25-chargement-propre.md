# 25 nov. 2026 — Chargement propre et mise à jour sans relancer (`claude/chargement-propre`)

Julien, 25 nov. :
- « quand les données s'affichent c'est moche, long et déstructuré » (le MOMENT du chargement) ;
- « ça doit se mettre à jour tout seul car je dois fermer l'app et la rouvrir pour avoir les nouvelles infos »
  (il se sert surtout de VRM en app de l'écran d'accueil de l'iPhone) ;
- « elle doit se mettre à jour si elle reçoit un mail ou que quelque chose se met à jour sur Vinted ».

Geste de Julien : **aucun** (pas de migration : la 040 du temps réel est déjà posée, vérifiée le 22 nov.).

---

## 1. Mesurer d'abord — deux bancs neufs

| banc | ce qu'il fait | rouge si |
|---|---|---|
| `scripts/bancs/chargement-structure.cjs` | chaque écran principal (Aujourd'hui, Annonces, Ventes, Colis/achats, Argent, Messages) ouvert à 390 px tactile sur la base inventée de `vitesse.cjs`, réponses Supabase RALENTIES (`VITESSE_RTT`, 700 ms), deux ouvertures (appareil neuf, puis 2ᵉ ouverture avec les copies rangées) ; une sonde posée AVANT l'app mesure le CLS (fenêtres de session, comme Chrome), les sauts, tout texte « chargement / Lecture… / lecture en cours… » VU (ni texte pour lecteur d'écran, ni encre transparente d'un squelette), et tout « 0 € » vu pendant le chargement que l'écran remplace ensuite par un autre montant ; captures à la fin de l'écran de démarrage (t0), +300 ms, +1 s, +2 s et au calme ; `CHARGEMENT_PLANCHE=avant,après,sortie` assemble les planches | un texte de chargement visible, un 0 € de chargement, CLS > 0,05 |
| `scripts/bancs/mise-a-jour-auto.cjs` | Ventes ouverte et au calme ; le banc tient AUSSI la prise Realtime (`routeWebSocket` : jonction du sujet privé `vrm-lignes:<uid>`, diffusion de l'id et de la version comme le déclencheur 040) et change les lignes servies sans rien recharger | (1) une vente captée par l'extension, (2) le bordereau d'un e-mail, (3) une vente arrivée pendant 40 s d'arrière-plan avec la prise coupée (iPhone), (4) une vente avec la prise refusée — pas à l'écran à temps (30 s ; 10 s pour le retour au premier plan) |

`vitesse.cjs` gagne trois options, sans rien changer pour les autres bancs : `VITESSE_RTT`, `opts.avantGoto` (des routes du
banc posées avant la page) et `opts.images` (les photos Vinted servies, un pixel, au lieu d'être refusées : sans elles,
le bandeau « Les photos de Vinted ne s'affichent pas ici » s'insérait EN TÊTE de l'écran au bout de 15 s — un saut de
0,14 propre au banc, pas à l'iPhone). `avantDeuxieme` relève la 1re ouverture avant le rechargement.

⚠️ Le dossier `scratchpad` est partagé : un `dist-avant` qui existait déjà contenait un build du 9 nov. (`cp -r` copie
DANS un dossier existant). Toujours un dossier neuf et daté pour « le code d'avant ».

---

## 2. « Je dois fermer l'app et la rouvrir » — la cause

La mise à jour sans recharger existe depuis le 11 nov. (`src/tempsReel.js`, `src/VeilleTempsReel.jsx`) : une sonde des
VERSIONS des lignes du vendeur (scalaires, `owner=eq.`, lignes écrites ces 10 dernières minutes) et la prise Realtime de
la migration 040. Ce qui la cassait sur l'iPhone :

1. `src/VeilleTempsReel.jsx` (avant, l. 57) : `const periode = veille.realtimeProuve() ? PERIODE_REALTIME_MS : PERIODE_MS`.
   Dès que Realtime a apporté UN message, la sonde ralentit à **2 min pour toujours**, même quand la prise est morte.
   Or iOS gèle une app de l'écran d'accueil en arrière-plan : au retour, la prise est coupée (ou se dit ouverte et ne
   reçoit plus rien) ⇒ rien n'arrive pendant jusqu'à 2 min. Mesuré au banc (cas 4) : **jamais à l'écran en 30 s**.
2. `src/tempsReel.js` `ouvrirCanal` : une prise fermée est rouverte avec un recul exponentiel (10 s, 20 s, 40 s… 5 min),
   rien ne la rouvre au retour au premier plan, et une prise RE-jointe ne rattrape pas ce qu'elle a manqué.
3. Au retour au premier plan, la veille n'était relancée que si la page était restée inactive plus de 10 min
   (`rythmeLectures.surReveil`) ; sinon au prochain tic de 5 s, et seulement si la période (2 min) était passée.
4. Le service worker reçoit chaque push (vente, offre, message, e-mail) mais ne prévenait l'app que pour montrer la
   carte, et seulement si elle était visible.

Le service worker ne sert jamais de données (Supabase et `/api/` vont au réseau, `public/sw.js`) : il n'est pas en cause.
Le cache des lectures (`viderLecturesMemo`) est déjà vidé au retour au premier plan.

## 3. Ce qui a changé (mise à jour)

- **Au réveil, tout de suite** (`src/VeilleTempsReel.jsx`) : `visibilitychange` (visible), `pageshow` (page gardée en
  mémoire), `focus`, `online`, prise rejointe, message du service worker ⇒ une sonde des VERSIONS (au plus une toutes les
  2 s, `REVEIL_MIN_MS`), rien pour une page cachée. Ce qui a changé est relu par l'écran qui le montre (`vrm:neuf`, le
  chemin existant : `listePlusRiche`, « une lecture ratée n'écrit rien », aucun réordonnancement de plus).
- **La prise Realtime rouverte au retour** (`ouvrirCanal().reprendre({ force })`) : fermée ⇒ rouverte sans attendre son
  recul ; cachée plus de 30 s (`REPRISE_FORCEE_MS`) ⇒ rouverte d'office (gelée par iOS). Rejointe ⇒ une sonde rattrape.
- **La sonde ne ralentit à 2 min que si la prise est jointe MAINTENANT** ; sinon 15 s (`PERIODE_MS`, 25 s avant).
- **Le service worker prévient toute fenêtre de l'app** à chaque push (`signalerApp`, message `vrm-signal`, aucune donnée
  dedans) : une app gelée le reçoit à son retour.
- Aucune écriture de `main`, aucune nouvelle fonction `api/`, aucune migration.
- Le petit signe « à jour · il y a 2 min » existait déjà (`src/aujourdhui/TeteDroite.jsx`, `tete.lu`, nourri par la
  sonde) : rien de nouveau à l'écran.

### Mesures (banc `mise-a-jour-auto`, Ventes, 390 px, design natif)

| cas | avant (`origin/main`) | après |
|---|---|---|
| 1. Vinted (vente captée), prise jointe | 0,9 s | 1,3 s |
| 2. E-mail (bordereau rangé), prise jointe | 0,6 s | 0,8 s |
| 3. iPhone : 40 s en arrière-plan, prise coupée, retour | 9,8 s (Ventes a sa propre sonde au retour ; les autres écrans non) | **0,9 s** |
| 4. Prise morte (refusée), page visible | **jamais en 30 s** (sonde ralentie à 2 min) | **8,3 s** |
| au repos, page visible, 2 min | 14,5 lectures/min · 179 Ko/min | 16,5 lectures/min · 193 Ko/min |

Au repos, la différence est la sonde des versions (toutes les 15 s au lieu de 25 s tant que la prise n'a rien apporté :
+1,6 lecture/min). Au banc chaque sonde pèse ~7 Ko parce que TOUTE la base inventée vient d'être « écrite » (moins de
10 min) ; en production elle ne rend que les lignes écrites ces 10 dernières minutes — quelques centaines d'octets. Le
gros des lectures au repos existait avant (les versions de la famille `harvest_*`, ~110 Ko par lecture au banc).
Avec la prise jointe ET un message reçu, la sonde reste à 2 min comme avant.

Preuve : le banc est **rouge sur `origin/main`** (cas 4) et vert après (même banc, même base, même machine).

---

## 4. Le chargement — ce qui était moche (mesuré, design natif, 700 ms par réponse)

⚠️ Les bancs voient par défaut le DOM d'AVANT le 17 nov. (`_garde-reseau.cjs` pose `vrm_banc_dom_ancien`) : les deux bancs
neufs posent `BANC_DESIGN_V2=defaut` (le design que Julien voit). Mesuré d'abord sur l'ancien DOM par erreur — ses défauts
(tuiles d'Aujourd'hui qui se replacent, « 67 colis pressés » inséré en tête, Achats) ne sont PAS ceux de l'app d'aujourd'hui ;
rien de cette mesure n'a été gardé dans le code.

Sur le design natif (`origin/main`) :
- **Annonces** : « Lecture en cours… » écrit en toutes lettres sous les filtres pendant toute la lecture ;
- **Argent** : « Reçu en novembre : lecture… » en tête ; « À venir » (deux cartes) arrivait après l'écran et poussait
  « Versements de novembre » de 91 px (CLS 0,052) ;
- **Messages** : « Lecture… » à la place de la liste de conversations, puis la liste ;
- **Aujourd'hui** : « N nouveaux N° à écrire sur leurs rangements » arrivait avec le nuage (~7 s après l'écran) et poussait
  « Porte-monnaie » de 162 px (CLS 0,041) ;
- (ancien DOM seulement) des faits « ventes : lecture… », « lecture… » sous les chiffres du mois.
Le reste était déjà propre (squelettes natifs `Attente`, chiffres en squelette du 24 nov., copies d'écran) : Ventes et
Colis/achats à CLS 0.

## 5. Ce qui a changé (chargement)

- **`src/natif/PlaceGardee.jsx`** (neuf, réutilisable) : un bloc qui n'existe que s'il y a quelque chose à dire tient, pendant
  la lecture, la HAUTEUR qu'il avait la dernière fois sur CET appareil (`vrm_place_{cle}`, mesurée une fois tout lu,
  effacée avec les données locales), par un squelette `.n-os` (reflet doux, coupé sous `prefers-reduced-motion`) ; rien la
  dernière fois ⇒ rien de réservé (option `defaut` pour un bloc presque toujours là). Jamais un contenu inventé.
  Posé sur : la carte « N° à écrire » d'Aujourd'hui (`CarteNumerosAEcrire`, App.jsx), « À venir » d'Argent
  (`AVenirCartes`, défaut 115 px).
- **Un chiffre ou une phrase EN COURS de lecture = un squelette** (la règle `attenteDe`/`attrsAttente` du 24 nov.,
  src/styles-chiffre-attente.css, étendue) : « mis à jour » d'Annonces (`n-ad-maj-texte`), « Reçu en … : » d'Argent
  (`ArgentMois`), cases des cartes du mois (`CarteMois`), faits du jour, chiffres d'Argent (ancien DOM).
- **Messages** (`FilsTous.jsx`) : la liste en lecture = des rangées de squelette (`<Attente forme="rangees" vignette={44}>`),
  le fil en lecture = des lignes ; plus de mot « Lecture… ».
- **Achats** : « À retirer » devient une donnée essentielle de l'écran (`ESSENTIELS_ECRAN.achats`, `useEssentiel('retirer')`),
  au plus le plafond de 2,5 s : la ligne ne s'insère plus après l'ouverture.
- **Apparition** : le fondu d'un écran qui arrive passe de 180 à 140 ms (≤ 150 ms), aucun sous « réduire les animations ».
- Aucun texte visible nouveau (rien à traduire) ; deux lignes dans « Quoi de neuf » (`chargement-propre`, `maj-sans-relancer`).

### Mesures (banc `chargement-structure`, 390 px, réponses à 700 ms, design natif)

| écran | ouverture | CLS avant | CLS après | texte « lecture » avant → après | fin de l'écran de démarrage avant → après |
|---|---|---|---|---|---|
| Aujourd'hui | appareil neuf | 0,041 | 0,038 ¹ | — | 5,3 s → 6,0 s ² |
| Aujourd'hui | 2ᵉ ouverture | 0 | 0 | — | 4,6 s → 4,0 s |
| Annonces | appareil neuf | 0,015 | 0,015 | « Lecture en cours… » → aucun | 6,8 s → 4,5 s |
| Annonces | 2ᵉ ouverture | 0 | 0 | — | 3,4 s → 2,3 s |
| Ventes | neuf / 2ᵉ | 0 / 0 | 0,001 / 0 | — | 5,5 / 3,2 s → 4,7 / 3,9 s |
| Colis (achats) | neuf / 2ᵉ | 0 / 0 | 0 / 0 | — | 7,0 / 2,8 s → 5,1 / 1,8 s |
| Argent | appareil neuf | **0,052** | 0,023 | « Reçu en novembre : lecture… » → aucun | 4,8 s → 4,7 s |
| Argent | 2ᵉ ouverture | 0 | 0 | — | 1,9 s → 1,9 s |
| Messages | neuf / 2ᵉ | 0,007 / 0,007 | 0,007 / 0,007 | « Lecture… » → aucun | 5,1 / 2,5 s → 4,6 / 2,5 s |

¹ Appareil NEUF : aucune hauteur encore mesurée pour « N° à écrire », la carte arrive comme avant (sous 0,05) ; à
l'ouverture suivante sa place est tenue. ² Les temps varient de ±1,5 s d'un passage à l'autre (machine partagée, 4 cœurs,
mémoire à 13/15 Go) : ils ne prouvent rien seuls ; les CLS et les textes, eux, sont stables.
Aucun « 0 € de chargement » relevé, ni avant ni après (la règle des trois états tenait déjà).

Preuve : le banc est **rouge sur `origin/main`** (Annonces, Argent, Messages) et **vert** après.

## 6. Planches (captures séquencées, avant en haut, après en bas)

Hors dépôt (dossier de travail de la session) : `planche-{écran}.png` (appareil neuf) et `planche-2-{écran}.png`
(2ᵉ ouverture), pour journee, annonces, ventes, achats, compta, messages — refaites par
`CHARGEMENT_PLANCHE=<captures avant>,<captures après>,<sortie> node scripts/bancs/chargement-structure.cjs`.

## 7. Ce qui reste

- Aujourd'hui, 2ᵉ ouverture : quand aucune COPIE d'écran n'est rangée, l'instantané résumé (`JourneeInstantanee`) a une
  autre forme que l'écran vrai (vu sur l'ancien DOM : texte du sous-titre qui chevauche « À jour à l'instant ») ; sur le
  design natif le banc ne l'a pas vu (copie présente ou squelette).
- Annonces, appareil neuf : les pastilles de comptes se recalent (CLS 0,015, sous le seuil).
- `audit-stockage-sur` : rouge AVANT ce lot (clés d'index dans 5 fichiers natifs que ce lot ne touche pas) — inchangé.
- `audit-boutons-natifs` : sa partie navigateur ne se lançait plus depuis le 24 nov. (`outils.js` importe `tr`) — réparée
  (la même traduction de banc que `Bouton.jsx`).
