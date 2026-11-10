# 10 nov. — Vérification au scan + photo du carton fermé (lot AZ, fusionné avec le lot M « photos d'emballage »)

Branche `claude/photo-colis-scan` (pas de PR, pas fusionnée par la session). Validé par Julien (peu de texte,
du visuel). Extension : rien touché. Aucune migration, aucune fonction `api/` ajoutée (12/12).

## 1. « Vérification au scan »

Au scan d'un bordereau (Colis → Scanner, et « Scanner » depuis « Préparer mes colis »), dès qu'une paire est
trouvée, la feuille passe en **vérification** (`data-scan-verif`, classe `is-verif`) : sous la tête (la croix
reste), la photo de la paire attendue occupe la largeur de la feuille (≈ 50 % de l'écran au téléphone), et son
**N° en pastille blanche, 64–108 px** (`clamp(64px, 21vw, 108px)`), puis titre, taille, compte, acheteur ;
UN geste bleu « C'est la bonne paire · Colis fait » ; « Scanner un autre » (ne note rien). Au téléphone : plein
écran ; à l'ordinateur : la feuille de 520 px.

- **Identité inchangée** (lot V) : n° de suivi lu ⇒ SA vente (`colisScannables`, `expeditions()`) ⇒ SA fiche
  (`paireDeVente`, `effEntry`). Aucune règle nouvelle ; c'est le rendu qui change (CSS `src/design/scanner.css`
  « VÉRIFICATION AU SCAN » + 3 attributs dans `src/ScannerColis.jsx`).
- Sans N° : « Sans N° » en grand, gris (jamais un N° deviné).
- « Relié à aucune vente », « 2 ventes portent ce n° », « Pas ce colis » (Préparer) : PAS de vérification, le
  message de toujours, aucun bouton. « Déjà noté colis fait » : la vérification, sans geste.
- Mode retrait (Achats) : inchangé (la demande portait sur le bordereau).
- **Relecture du même bordereau** pendant qu'il photographie le carton (le code reste dans le cadre) : ignorée
  tant que l'écran est « Colis fait » de CE colis — sinon il aurait perdu « Annuler » et la photo
  (`traiter`, `ref.current.res`). Un AUTRE bordereau remplace l'écran comme avant (la série continue).

## 2. « Photo du carton » (lot AZ + lot M : UN mécanisme)

Après « C'est la bonne paire · Colis fait » (ou sur un colis « déjà noté »), et dans « Préparer mes colis »
après « Colis fait » : **« Photo du carton · facultatif »** ⇒ l'appareil photo du téléphone
(`<input type=file accept=image/* capture=environment>`) ⇒ la photo réduite DANS la page (JPEG, 1280 px au plus,
≤ 480 Ko de data URL, `compresserPhotoCarton`) ⇒ rangée avec la vente ⇒ « Photo du carton rangée ✓ » (vignette
qui s'ouvre en grand, « Refaire »). Écriture refusée ⇒ « Photo pas envoyée : réessaie… » en ambre, jamais
« rangée ». Rien n'est publié vers Vinted ni ailleurs.

### Où elle vit (`src/photoCarton.js`)
- UNE ligne `app_data` par vente : **`colis_photo_{site}_{identité}`** — `v_{n° de transaction}` (Vinted),
  `vc_{id}` (Vestiaire), `lbc_{n° de transaction}` (Leboncoin). L'identité vient de `venteDuColis(colis)` :
  `o.transaction_id` / `v.id` / `txId` — jamais le titre, jamais le bordereau seul (§5).
- `data` = `{ b64, at, site, tx, num }` ; « vider » = `{ b64: null, supprime: true, at, … }` (un DELETE ne
  supprime rien sur app_data, comme le ticket de dépense).
- Comme les autres photos de l'app (`depense_ticket_{id}`, `achat_hors_photo_{id}`, `studio_photos_{N°}`, et la
  facture d'achat du lot AN) : `withOwner`, `on_conflict = SB_CONFLICT`, RLS 021 ⇒ chacun ses lignes. Jamais
  dans `main` ni une ligne lue souvent (§4.4). Le mode équipe (016) ne la lit pas (hors liste blanche).
- Lecture : **existence en scalaire** (`select=at:data->>at,vide:data->>supprime`), la photo par SON id au
  toucher (`select=b:data->>b64,at:data->>at`), jamais `select=data`. Cache de l'appareil par propriétaire.
- La sauvegarde « toutes mes données » (Réglages) l'emporte comme les tickets ; la suppression de compte l'efface
  (toutes les lignes du vendeur).

### Pour les autres écrans (Litiges, lot BB)
```js
import { photoCartonDe, aPhotoCarton, idPhotoCarton } from './photoCarton.js';
await photoCartonDe(tx, 'vinted')  // { src: 'data:image/jpeg;base64,…', at: ISO } · false (aucune) · null (pas su)
await aPhotoCarton(tx, 'vinted')   // { at } · false · null — lecture scalaire, sans la photo
idPhotoCarton('vinted', tx)        // 'colis_photo_v_{tx}'
```
L'app branche la base une fois (`brancherPhotoCarton`, App.jsx après `withOwner`). Composants :
`src/PhotoCarton.jsx` — `BoutonPhotoCarton` (le geste), `PhotoCartonVente` (la ligne de fiche),
`VuePhotoCarton` (la photo en grand). « Pas su » ne vaut jamais « aucune » (§5).

### Sur la fiche de la vente
Ventes → une vente Vinted → « Détails » : ligne **« Photo du carton »** — « Voir · 10 nov. · 14:02 » (lue au
toucher, en grand), sinon « Ajouter » (facultatif, le même geste), lecture ratée ⇒ « — ». Pas sur une vente
annulée. Vestiaire et Leboncoin : la photo est rangée (clé `vc_`/`lbc_`) mais leurs fiches ne la montrent pas
encore.

## 3. Preuves
- `scripts/bancs/photo-colis-scan.cjs` (390 tactile et 1512, clair et sombre) : **112 verts**. 8 ventes au même
  titre : photo b{k} et N° de SA fiche, en très grand (largeur ≥ 85 % de la feuille, ≥ 30 % de l'écran, N° ≥ 60 px),
  visibles, rien ne les couvre ; deux ventes au même n° / inconnu ⇒ pas de vérification ; rien écrit au scan ;
  pas de photo avant « Colis fait » ; la photo ⇒ UNE écriture `colis_photo_v_9203` (JPEG ≤ 480 Ko, tx 9203),
  aucune image vers une autre ligne ni un autre hôte ; relecture du même bordereau ne remplace pas l'écran ;
  écriture refusée ⇒ ambre ; Préparer ⇒ le même geste pour la vente de l'étape ; fiche ⇒ « Voir » (lue en
  projection `data->>b64`, jamais `select=data`), « Ajouter », « — » si la lecture rate ; cibles ≥ 44 px ;
  rien ne déborde ; aucune erreur. La photo du carton est une capture d'écran du banc (aucune donnée réelle).
- **Rouge sur origin/main** (3d22ef9f, `git archive`, banc copié dedans, 390-clair) : 10 rouges sur 19.
- **Mutations** (390-clair) : voir §5.
- Bancs touchés, un à la fois (BANC_PORT aléatoire) : `scanner-colis-achats` 204/204, `colis-scan` 42/42,
  `preparer-relais` 131/131 (inchangés : mêmes `data-*`).
- `npm run build` ; audits : voir §5.
- Captures regardées (scratchpad, hors dépôt) : `photo-colis-{390,1512}-{clair,sombre}-{1-verif,2-deux-ventes,
  3-fait,4-photo-rangee,5-echec,6-preparer,7-fiche,8-vue}.png`.

## 4. Ce qui reste
- **Caméra réelle non essayée** : sur iPhone, ouvrir l'appareil photo (`capture`) pendant que le scanner tient la
  caméra (`getUserMedia`) — Safari met le flux en pause ; à essayer au vrai (au retour, « Scanner le suivant »
  relance la lecture ; si la vidéo reste noire, fermer/rouvrir le scanner).
- « Annuler » le « Colis fait » ne retire pas la photo déjà rangée (elle reste une preuve de la vente ; « Refaire »
  la remplace).
- La visionneuse du lot AN (`claude/photos-achats`, pas sur main au moment du chantier) : `VuePhotoCarton` est
  simple ; à fondre dans la leur quand elle arrive.
  **Fait le 10 nov. (lot AN, reprise)** : `VuePhotoCarton` retirée, la photo du carton s'ouvre dans LA
  visionneuse (`ouvrirVisionneuse`, légende) — `docs/passation/2026-11-10-photos-achats.md` « Reprise ».
- Fiches Vestiaire / Leboncoin : montrer la photo (la clé existe).
- Geste de Julien : aucun.
