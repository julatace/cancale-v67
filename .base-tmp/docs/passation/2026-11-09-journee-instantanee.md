# 9 nov. 2026 — Ma journée tout de suite (instantané) + objectif du mois

Branche `claude/journee-instantanee` (depuis `origin/main` `080956a8`), poussée à chaque commit.
**Pas de PR ni de fusion** (consigne du coordinateur). Décision attendue n°1 de
`2026-11-09-passation-generale.md` §4 : Julien a dit oui (« vas-y, fais absolument tout »).

## 1. Ma journée affichée tout de suite

### Ce que voit Julien
À l'ouverture, au lieu du squelette pendant la relecture complète (≈ 8 à 10 s au téléphone,
plafond d'`AttenteEcran`), Ma journée montre **en ≈ 1 s** les derniers chiffres que CET appareil
a affichés pour CE compte VRM : la prochaine chose à faire, la frise des sept jours, le jour
choisi, les cases du mois (Bénéfice · Vendu · Reçu), la barre de l'objectif, « Ensuite · N
gestes ». À la place de « Modifier » : **« ● Mis à jour il y a 7 min »** (point qui respire,
discret). Les chiffres sont un ton plus doux. Le geste de la prochaine chose dit
**« Vérification… »**, sans bleu. Quand la relecture est finie, l'écran vrai prend la place
**en place** (même cadre, même hauteur, sans fondu) — CLS mesuré 0,000.

### Comment (fichiers)
- `src/journeeInstantanee.js` — la règle : `capturerJournee` (relit l'écran VRAI rendu : texte
  et `data-*`, rien n'est recalculé, §11), `lireInstantane` (par uid), `instantaneMontrable`
  (un autre jour ⇒ ni phrase du jour ni panneau du jour choisi ; un autre mois ⇒ ni cases ni
  objectif ; plus de 3 jours ⇒ rien), `ecrireInstantane` (un seul instantané sur l'appareil),
  `ageTexte`.
- `src/JourneeInstantanee.jsx` — le rendu : les classes de la tête (`vrm-fu-tete`,
  `vrm-jv2-*`, `vrm-fu-case`…) dans le cadre de `Comptabilite` (`padding 16px 14px 40px`) ; la
  hauteur de la tête capturée sert de `min-height` à la même largeur d'écran. **Aucun
  attribut de l'écran vrai** (`data-jv2-*`, `data-fu-case`, `data-prochain`, `data-objectif`…) :
  tout est en `data-ji-*`, rien ne peut lire un chiffre ancien comme frais. `inert` sur tout.
- `src/AttenteEcran.jsx` — prop `instantane` : montré à la place du squelette (sans
  `data-demarrage-attente` ⇒ l'écran de démarrage s'en va), l'écran vrai s'ouvre quand **toutes**
  ses données sont là (`tout`) ou au plafond long `PLAFOND_INSTANTANE_MS` (20 s) ; il garde
  `vrm-attente-pret` (ses marges) + `vrm-attente-sans-fondu`. `useAttenteComplete()` (nouveau).
  Sans instantané : **rien ne change** (squelette, plafond 2,5 s).
- `src/App.jsx` — `CaptureJournee` (dans les enfants de l'attente de Ma journée) : prend
  l'instantané 1,2 s après que tout est là, puis 1,5 s après chaque changement de l'écran
  (MutationObserver), et à `pagehide` / page cachée. `capturerJournee` refuse tout ce qui
  contient « lecture… » (jamais un chiffre en cours figé). AppCoeur lit l'instantané de
  `authState.user.id` à chaque arrivée sur Ma journée ; base injoignable ⇒ aucun instantané.
  `FriseJournee` porte `data-jv2-choix` (auto/main) : un jour touché à la main n'est pas
  rangé comme « le jour choisi » (l'instantané montre alors le dernier jour vendu).
- `src/styles-journee-instantanee.css` — la mention, le ton doux, le geste neutre (dans
  `@layer vrm-premium`, plus précis que la règle du bleu), `vrm-attente-sans-fondu`.

### Les règles tenues
- **Pas su ≠ 0** : ce qui est rangé est ce qui était rendu ; « — » reste « — », « au moins »
  reste « au moins ». Montré avec son âge, jamais comme frais.
- **Clé par uid** : `vrm_journee_instantane:<uid>`, et l'uid DANS la valeur ; un instantané
  d'un autre uid (même rangé sous la clé de ce compte) n'est jamais rendu.
- **Déconnexion / autre vendeur** : la clé commence par `vrm_` ⇒ `wipeLocalData` l'efface
  (déconnexion, `ensureLocalOwner`). Jamais synchronisée (écrite par `localStorage.setItem`,
  hors de `save`, absente de la liste des clés du nuage).
- **Rien de personnel** : montants, compteurs, dates, libellés de VRM, son prénom (`vrm_prenom`).
  Ni photo, ni titre d'article, ni compte, ni suivi, ni adresse, ni acheteur ; la prochaine
  chose garde son titre, et sa sous-ligne seulement pour une case de comptage de VRM (« 2 à
  imprimer »). ~1,2 Ko.
- **Aucun geste irréversible** : l'instantané est `inert` ; « Imprimer » devient
  « Vérification… » ; un clic ne fait rien (vérifié au banc). Les gestes n'existent que dans
  l'écran vrai, qui n'apparaît que relu.
- §4.6 : les ajouts d'AppCoeur sont placés après tout ce qu'ils lisent (`essentielsCoque`,
  `tab`, `baseKO`) et avant les retours anticipés (hooks) ; effets de données dans `AppCoeur`.

## 2. L'objectif du mois

Il existait depuis le 4 nov. (`vrm_objectif_mois`, synchronisé, lu par `onCloudReady` qui ne
remplace que le vide ; réglable dans « Modifier »). Ajouté sur la demande de Julien :
- La barre dit **« 185 € sur 2 000 € »** puis **« encore 1 815 € · ≈ 83 €/jour d'ici le 30 »**
  (`resteObjectif`, `phraseResteObjectif` dans `src/objectifMois.js`) : aujourd'hui compte
  parmi les jours restants ; le rythme s'arrondit **vers le haut** (celui qui tient
  l'objectif) ; dernier jour ⇒ « encore 760 € aujourd'hui » ; valeur « au moins » ⇒ reste
  « au plus » ; pas su ⇒ « — » et « Vendu du mois pas lu » ; atteint ⇒ **« Objectif atteint »**
  (blanc, rien d'autre). Nombre de ventes : « encore 28 ventes · ≈ 2 ventes par jour… ».
- La valeur EST la case « Vendu · mois » (`valeurObjectif` → `valeurChiffre('vendu', mois)`,
  la même source ; vérifié au banc : `data-objectif-valeur` = `data-carte-valeur` de la case).
- **Toucher la barre** ouvre « Modifier » avec l'objectif déplié (`ObjectifFeuille ouvertDepart`).
- **Réglages → Affichage → Objectif du mois** (`ObjectifMoisSetting`, src/ecrans/Reglages.jsx) :
  un montant en €, « Enregistrer », « Retirer l'objectif ». Vide par défaut ⇒ aucune barre.
- Accent rare : la piste reste neutre (`rgba(255,255,255,.14)`), seule la part faite est bleue.

## 3. Preuves

**Banc `scripts/bancs/journee-instantanee.cjs`** (390 tactile et 1512, clair et sombre) :
111 verts, 0 rouge. Il sert la forme de production (sonde de schéma cloisonnée, écritures
acceptées) et **TIENT** les lectures (requêtes gardées puis rendues, jamais un délai, §6.5).
Contrôles : A (rangé pour CE uid, case Vendu = rendue, rien de personnel), I (chiffres en
< 4 s base tenue, « Mis à jour il y a 7 min », mêmes valeurs que l'écran vrai, aucun chiffre
« frais » pendant ce temps, écran de démarrage retiré, inerte + « Vérification… », clic sans
effet, remplacement par l'écran vrai, CLS ≤ 0,01 au remplacement, aucun débordement), U (autre
uid jamais rendu), V (autre vendeur ⇒ effacé), S (sans instantané : le squelette d'avant),
O (barre = case, reste et rythme faits à la main, phrase, piste neutre, toucher ⇒ réglage,
atteint, aucune barre sans objectif, Réglages → 1 500 € enregistré).

- **Sur `origin/main`** (dist construit depuis `080956a8`, le commit de départ, avant tout changement) : **20 rouges**
  (aucun instantané, aucun chiffre en 12 s base tenue, phrase « 185 € / 2 000 € » sans reste ni
  rythme, barre inerte, pas de ligne Réglages).
- **Mutations** (390 clair), chacune ROUGE : contrôle d'uid retiré ⇒ U rouge ; geste
  « Vérification… » remplacé par « Imprimer » ⇒ I rouge ; rythme arrondi vers le bas ⇒ O rouge
  (2) ; âge retiré de la mention ⇒ I rouge.
- `scripts/tests/journee-instantanee.test.mjs` : 6/6 (uid clé+valeur, un seul instantané,
  trop vieux / futur / illisible, autre jour / autre mois, âge, reste et rythme de l'objectif).
- Bancs relancés sur cette branche, un à la fois : `journee-v2` 74/0, `journee-coherence` vert,
  `journee-photos` 105/0, `journee-premium` 15/0, `demarrage-vitesse` 5/0.
- Audits verts : `variables`, `tdz`, `coherence`, `identite`, `statuts`, `objectif-mois`
  (33), `journee-coherence` (30), `icones`, `fusion-nuage`, `onglets-a`. `npm run build` vert.
- Captures regardées (390 et 1512, clair et sombre) : instantané et écran vrai superposables
  (même place de la tête, à 0 px près au téléphone) ; seule différence voulue : pas de pile
  de photos à côté du chiffre du jour (aucune photo rangée).

### Temps mesurés (banc, conteneur partagé, `performance.now()` depuis la navigation)
| | avant (`origin/main`) | après |
|---|---|---|
| chiffres de Ma journée, lectures de la base TENUES (2e ouverture) | **jamais** (squelette, 12 s) | **0,7 à 1,6 s** (8 passages : 0,73 · 0,81 · 1,07 · 1,12 · 1,12 · 1,13 · 1,54 · 1,58) |
| écran vrai, base servie (1re ouverture, sans instantané) | 10,4–10,7 s | 9,5–11,1 s (inchangé : rien ne change sans instantané) |
| CLS au remplacement | 0,016 (ouverture au plafond, chiffres qui arrivent ensuite) | **0,000** |

## 4. Ce qui reste
- L'instantané n'existe qu'après une première ouverture COMPLÈTE sur l'appareil (par
  construction) ; une ouverture où une valeur reste « lecture… » longtemps (une publication
  jamais revenue) ne range rien.
- Le plafond long (20 s) est un choix : au-delà, l'écran vrai s'ouvre comme aujourd'hui au
  plafond. À régler si Julien trouve l'attente des chiffres frais trop longue.
- Les autres écrans (Colis, Ventes) gardent leur squelette ; la même mécanique
  (`instantane` d'`AttenteEcran`) s'y brancherait, avec leur propre capture.

## 5. Geste de Julien
Aucun. (Pour voir l'instantané : ouvrir Ma journée une fois jusqu'au bout, puis rouvrir VRM.)
