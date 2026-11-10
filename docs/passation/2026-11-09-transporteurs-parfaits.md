# 9-10 nov. — Transporteurs parfaits (lot AK, branche `claude/transporteurs-parfaits`)

Julien, mot pour mot : « Ce n'est pas possible d'avoir "transporteur inconnu" sachant que tu as les
bordereaux en ta possession » ; « la carte des points relais doit être parfaite » ; « je veux que le suivi
des colis soit parfait, irréprochable, mis à jour très régulièrement pour éviter que tout soit brouillon » ;
« je veux que ce soient les LOGOS des transporteurs qui soient affichés à côté des colis et non les noms ».

Aucune base réelle accessible d'ici : rien n'est mesuré sur sa base (requêtes SQL au §6). Extension : rien
changé (5.340.0 reste libre). 12/12 fonctions `api/` (aucune ajoutée).

## 1. Zéro « Transporteur inconnu » quand VRM a le bordereau

**Avant** : l'étiquette (PDF) était lue à la réception de l'e-mail du bordereau (depuis le 9 nov.) ; les
ANCIENS bordereaux, 6 PDF par jour et par vendeur au cron du matin (`passeTransporteursPdf`). 300 anciens
bordereaux = 50 jours.

**Maintenant**, la même passe (`api/_lib/transporteur-anciens.js`, même règle `transporteurDuPdf`, un seul
nom ⇒ lui, deux ⇒ rien) tourne jusqu'à épuisement, par trois chemins :
| chemin | quand | borne | fichier |
|---|---|---|---|
| cron du matin | chaque vendeur, 5 h UTC | 60 PDF, 15 s | `api/ship-reminders.js` `etiquettesCron` |
| passage « colis » | toutes les 15 min (6 h–23 h Paris), APRÈS les statuts | vendeurs dont `vrm_bord_transporteurs.pdfReste` ≠ 0 (sélection `select=owner` sur `meta`) ; 40 PDF/vendeur ; 25 s au plus et jamais au-delà de 128 s depuis le début du passage | `api/_lib/colis-frequent.js` `passageEtiquettes` |
| app ouverte | Colis, Ventes, Ma journée, quand un bordereau a un PDF jamais lu (`etiquetteALire`) | `POST /api/relais?mode=etiquettes` (session du vendeur, abonnement), 25 PDF / 7 s par appel, 6 appels par série, une série / 10 min ; refus ⇒ recul | `api/relais.js`, `api/_lib/etiquettes-vendeur.js`, `src/App.jsx` `lireEtiquettesManquantes` |
| navigateur | l'étiquette téléchargée pour l'imprimer est lue sur place (même règle, `api/_lib/texte-pdf.js` rendu sans `Buffer`, chargé à la demande) | — | `src/App.jsx` `lireEtiquetteIci` (en mémoire ; le serveur range le même résultat à son passage) |

Garde-fous (§4.4, §5) : UN PDF par requête (`select=pdf:data->>pdfB64`, `id=eq.`), listes projetées, jamais
`select=data` sur un bordereau ; écritures par paquets de 10 dans la ligne LÉGÈRE `vrm_bord_transporteurs`,
RELUE avant chaque écriture et fusionnée (l'app et le cron en même temps ne s'effacent pas) ; relue
illisible ⇒ rien écrit ; un PDF dont la lecture rate n'est pas noté (relu plus tard) ; idempotent. La ligne
porte maintenant `pdfReste` (ce qui reste, scalaire ⇒ `meta`), `pdfAt`, `pdfBilan` (nombres par raison).

**Ce qui reste inconnu est COMPTÉ et DIT** (`src/colisEnvoyes.js` `raisonInconnu`, Colis → Envoyés, sous les
pastilles : « 3 transporteurs inconnus : 2 étiquettes en cours de lecture · 1 vente sans bordereau reçu par
VRM. », `data-envoyes-inconnus`, `data-inconnu-raison`) : étiquette en cours de lecture · sans nom lisible
(image, police sans table — le n° de son e-mail, sa forme propre, l'e-mail du transporteur du même n° et la
ligne `depart_*` sont déjà essayés AVANT par `transporteurDeVente`) · deux transporteurs nommés · PDF
illisible · bordereau sans PDF · aucun bordereau reçu. Jamais un transporteur deviné.

**Mesures (estimées, pas sur sa base)** : un PDF de bordereau ≈ 60 Ko en base64 (mesure du 4 oct. : 51
bordereaux = 6 Mo, PDF en double) ; le plus gros `label_latest` vu : 713 Ko. Égress du rattrapage = une
fois chaque PDF : 1 000 bordereaux ≈ 60 Mo, une seule fois (puis plus rien : la réception lit les neufs).
Débit : une requête Supabase depuis `dub1` + lecture du PDF ≈ 0,1–0,3 s ⇒ ~40 PDF par vendeur et par quart
d'heure, ~150 par visite de l'app : 300 anciens bordereaux lus en une visite de Colis ou en ≈ 2 h de
passages. Requête n° 3 de `2026-11-09-transporteurs-emails.md` pour le vrai poids.

## 2. Les LOGOS à la place des noms

**Licence** : aucun transporteur (Mondial Relay, Chronopost/Shop2Shop/Pickup, La Poste/Colissimo, Relais
Colis, InPost, Vinted Go, DPD, UPS, GLS, DHL, FedEx, Colis Privé) ne publie son logo sous une licence
d'usage libre ; les icônes de site (favicon) que VRM chargeait depuis leurs domaines n'en avaient pas non
plus, échouaient hors réseau (la pastille retombait sur le nom) et donnaient l'adresse IP du vendeur à
chaque transporteur. ⇒ **aucun fichier officiel** : une **marque maison** dessinée en SVG
(`src/transporteursVisuels.js` `TRANSPORTEURS[cle].marque` = couleurs de repère public + sigle : CH, MR,
CO, VG, RC, DPD, UPS, GLS, CP, S2, IP, DHL, FX ; `src/PastilleTransporteur.jsx` `LogoTransporteur`,
`svgMarque` pour l'épingle). Inconnu ⇒ pictogramme NEUTRE (un carton gris, `LogoInconnu`), jamais une
fausse marque. Aucune image, aucune requête.

**Partout** : la puce à côté du bouton bordereau (Ventes, récapitulatif, Colis, Vestiaire, Leboncoin), le
badge dans le coin de la vignette (À envoyer, Envoyés, À retirer, Préparer), la tête d'un point relais,
l'épingle de la carte, les pastilles de filtre d'Envoyés (marque + nombre), Achats, Boîte e-mails, Ma
journée (frise, toutes) passent par `LogoTransporteur`. Le nom n'est plus écrit à côté du colis : il est
en `aria-label`, `title` et `data-transporteur-nom`. Restent écrits (voulu) : les EN-TÊTES de groupe de
« À envoyer » (« Chronopost · 3 colis », un titre de section, pas une étiquette de colis).

## 3. La carte des points relais

- **Points mal placés** : l'ancien géocodage automatique d'Achats (`geocode`, rangé pour toujours dans
  `vrm_points_relais`) cherchait « 13 Rue Saint-Vincent » SANS code postal (`limit=1`) — la première ville
  venue. Maintenant : rien n'est cherché sans code postal LU, et la recherche porte `postcode=`.
- **Marque du transporteur sur l'épingle** quand tous les colis COMPTÉS du point ont le même transporteur
  lu (`transporteurDuPoint`) ; sinon le nombre seul. L'épingle = ce que l'onglet compte (9 nov.), zoom
  initial = tous les points (`fitBounds`), toucher une épingle = le point (inchangé), un doigt fait défiler.
- **Bancs rouges sur main — la vraie cause** : les bancs servaient `meta: null` à la lecture `select=id,meta`
  des e-mails de suivi (l'app lit la colonne `meta` entière depuis le 8 nov.) et ignoraient `id=in.(…)` et
  les filtres `data->>k=…` : chaque e-mail de suivi disparaissait (« 1 colis » au lieu de 2), et « avec QR et
  livré » rendait toutes les lignes. `scripts/bancs/_meta.cjs` a maintenant `metaDe` (la règle SQL) et
  `filtreData`. Puis les attendus périmés par des décisions VOULUES : la carte est dessinée au téléphone
  (retraits frais), les achats en route sont dans le repli « En route » (3 nov.), le code est dans la ligne
  ouverte (3 nov.), la clé d'un point garde son préfixe (« Casier 24/7 … »).

## 4. Le suivi : qui relit quoi, à quelle fréquence

| transporteur | relu par | fréquence | ce qui manque |
|---|---|---|---|
| Mondial Relay | serveur (`mr-fr-mvc`), secours extension (`transpTick`) | app ouverte : demande /5 min ; au point relais 15 min, en route 1 h ; app fermée : passage /15 min 6 h–23 h + crons 6 h/19 h | `CRON_SECRET` GitHub (sans lui : app ouverte + 2 crons seulement) |
| Chronopost / Shop2Shop / Pickup | serveur (`cp-ws2`) | idem | idem ; SMS Chronopost : forme pas apprise |
| Vinted Go | serveur (`vg-v3`) | idem | idem |
| Colissimo, Relais Colis, InPost, DPD, UPS, GLS, DHL | **personne** chez le transporteur : e-mails reçus (réception, temps réel) et suivi Vinted de l'achat (extension, 3/visite, 6/h) | à l'arrivée d'un e-mail | aucune lecture serveur (aucune voie mesurée) |
| colis VENDUS (sortants) | prise en charge lue chez le transporteur (`depart_*`, 2 par passage) ; ensuite l'état vient de Vinted (`my_orders`, relu par l'extension) | départ : comme ci-dessus ; livré : à la visite Vinted | lire le statut transporteur d'un colis sortant demande d'abord de garder ses notifications « à retirer » (sens) — pas fait ici, volontairement |

Corrigé (`api/_lib/colis-frequent.js`) : le passage de 15 min visite aussi les lignes `transp_` ACTIVES
« inconnu », « incident », « retour en cours » relues il y a plus de 2 h, et celles jamais répondues depuis
30 min (avant : seulement les crons de 6 h et 19 h). La règle des états reste celle d'avant (l'état le plus
frais prouvé gagne, un retiré reste retiré : `finsColis`, `finiApres`) ; « Suivi vérifié il y a N min » sous
À retirer (9 nov.) ; la fraîcheur générale est la ligne unique du lot AG (`claude/fraicheur-unique`).

## 5. Preuves (§6)

| contrôle | branche | origin/main | mutations |
|---|---|---|---|
| `audit-transporteurs-parfaits` (EXÉCUTE `ship-reminders?moment=colis` et `relais?mode=etiquettes` sur une fausse base PostgREST à état, PDF fabriqués pdf-lib : 15 étiquettes en un passage, un PDF par requête, rangement, `pdfReste`, sélection en panne, idempotence, session, budget, relecture avant écriture, lecteur sans `Buffer`, suivi « inconnu ») | 19 verts | 13 rouges / 19 | 9/9 rouges (6 PDF, pas de passage 15 min, tous visités, écriture sans relire, budget ignoré, pas de `pdfReste`, route app absente, inconnu jamais relu, lecteur au `Buffer`) |
| banc `colis-envoyes-tri` (390 tactile sombre/clair + 1512 : marque de chaque carte visible, pictogramme neutre ×3, nom plus écrit, inconnus comptés avec raison, pastilles marque + nombre) | 92 verts | 20 rouges | badge inconnu retiré ⇒ 8 rouges |
| banc `transporteurs-logos` (marques, aucune image ni requête, nom en aria-label) | vert | 13 rouges | — |
| banc `retrait-relais-carte` (+ aucune adresse sans code postal) | vert | 2 rouges (géocodage sans CP) | — |
| bancs `retrait-carte`, `retrait-autre-ville`, `retraits-frais`, `colis-retirer-propre` | verts | (rouges avant : forme `meta` servie) | — |
- Verts aussi : `npm run build`, `audit-{variables,tdz,coherence,identite,statuts,fonctions-api,icones}`,
  `transporteur-pdf` 28, `transporteur-anciens` 31, `colis-frequent` 21, `transporteur-bordereau`,
  `transporteur-lu`, `statut-transporteurs`, `transporteurs`, `colis-trois`, `retrait-preuves`.
- Rouges IDENTIQUES sur origin/main, pas touchés : `audit-colis-envoi` (1, « la barre ne dépend pas de
  l'onglet »), banc `design-fusion` (8 : frise, colonne de Ma journée), `carte-stable` (3 : WebGL absent de
  la machine du banc, aucune épingle dessinée), `relais-telephone` (3 : commande par relais/toasts, pas la
  carte).
- Captures regardées : Envoyés 390 sombre (pastilles CH 3 · MR 2 · carton 3, badges sur les vignettes,
  phrase des inconnus), À retirer 1512 sombre (marques en tête de point et sur les vignettes), À envoyer
  1512, récapitulatif 390.
- Merge `origin/main` (vrai merge) fait avant la fin : `colis-frequent.js` (cadence partagée) fusionné sans conflit.

## 6. Requêtes pour Julien (lecture seule, nombres seulement)
```sql
-- Ce qui reste à lire, par vendeur (après une journée : attendu 0 partout)
select coalesce(meta->>'pdfReste','(jamais passé)') as reste, count(*) from app_data where id = 'vrm_bord_transporteurs' group by 1 order by 2 desc;
-- Ce que disent les étiquettes (sur toute la base)
select (data->'pdfBilan'->>'nommes')::int as nommes, (data->'pdfBilan'->>'aucun')::int as sans_nom_lisible,
       (data->'pdfBilan'->>'plusieurs')::int as deux_noms, (data->'pdfBilan'->>'illisible')::int as illisibles
from app_data where id = 'vrm_bord_transporteurs' and data ? 'pdfBilan';
```
Si « sans nom lisible » domine : l'étiquette dessine le nom en image ; une session regardera UN PDF à blanc
(jamais dans le dépôt).

## Gestes de Julien
1. `CRON_SECRET` dans les secrets GitHub (Settings → Secrets → Actions) : sans lui, ni les statuts ni les
   étiquettes ne sont relus toutes les 15 min (l'app ouverte et les crons de 6 h/19 h le font quand même).
2. Ouvrir Colis une fois : l'app demande la lecture de toutes les étiquettes restantes.
3. Facultatif : les deux requêtes du §6 demain.

## Ce qui reste
- Statut chez le transporteur des colis VENDUS après leur départ (aujourd'hui : Vinted) — demande de garder
  les notifications « à retirer » des colis sortants avant.
- Colissimo, Relais Colis, InPost, DPD, UPS, GLS : aucune lecture serveur (pas de voie mesurée).
- Les en-têtes de groupe de « À envoyer » gardent le nom écrit (titres de section) : à trancher par Julien.
