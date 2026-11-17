# 16 nov. 2026 — « Imprimer les N » sur ordinateur (lot `impression-directe`, mission 6)

Branche `claude/impression-directe` (depuis `origin/main`). Mission :
`docs/passation/file-attente-16nov/6-impression-directe.md` (validée par Julien : « impression sans réfléchir »).

## Ce qui existait (lu avant de coder)
« Imprimer » en un toucher (#1169, `2026-11-14-impression-simple.md`) : dans Ventes → À expédier, « Imprimer (N) »
= le moteur `imprimerLot` (papier retenu `vrm_imprimante`, question du papier une seule fois, tampons gardés, N°
« à vérifier » §5, visionneuse qui imprime seule sur ordinateur), puis la feuille « Tout est sorti ? ». Ventes publie
le nombre du lot (`vrm_colis_prets.lot`). Les demandes venues d'ailleurs (⌘K, ?print=bord) ouvraient, elles, la feuille
« Choisir » (`ouvrirLot`).

## Ce qui change (on complète, rien n'est dupliqué)
- `src/impressionDirecte.js` (pur) : `proposer` (ordinateur, lot publié > 0, pas « Plus tard »), `nombreAProposer`
  (pas su ⇒ 0, jamais deviné), `marquesDe` / `retirerMarques` (ce qu'une impression a marqué, et « Annuler »).
- `src/ImpressionDirecte.jsx` + `impression-directe.css` : sur ORDINATEUR seulement, une île en bas à droite
  « 5 bordereaux prêts · **Imprimer les 5** · Plus tard », à l'ouverture et à chaque retour sur l'onglet (« Plus tard »
  la range jusqu'au retour suivant). Après : « 4 imprimés · Annuler » (8 s comptées hors visionneuse).
- `App.jsx` : la bannière pose `_pendingBordPrint = 'direct'` et ouvre À expédier ; les deux prises de demande
  (`prendreDemandeImpression`) appellent alors le MOTEUR `imprimerLot` (pas la feuille « Choisir ») ; en mode direct,
  `montrerApres` marque comme avant puis dit « N imprimés · Annuler » au lieu de la feuille d'après ; une question
  annulée désarme le mode ; « Annuler » retire CES marques (Vinted, retours, Vestiaire) seulement.
- (17 nov., après la fusion de `tampons-parametres`) « Imprimer (N) » ouvre maintenant l'APERÇU avant impression
  (tampons déplaçables). En mode direct, PAS d'aperçu : `lancerImpression` prend le chemin d'attente
  (`attendrePuisOuvrir` : question des N° §5, puis la visionneuse) avec les tampons et places DÉJÀ gardés — c'est ce
  que la mission demande (« sans étape intermédiaire »). Le bouton d'À expédier garde l'aperçu.
- Rien ne s'imprime sans son clic ; §5 tenu (la question du N° à vérifier est celle du moteur).
- Textes `impdir.*` en 5 langues ; « Quoi de neuf » `impression-directe`.

## Preuves
- `node scripts/audit-impression-directe.cjs` (neuf) : vert ; `--prouve` **11/11 mutations**.
- Banc `scripts/bancs/impression-simple.cjs` (+ D, D-sombre, D1, « Plus tard ») : **86/86** à 1512 et 390 (après la fusion de main du 17 nov.)
  (A, B, C inchangés et verts). D : bannière « Imprimer les 5 » vraiment visible (point au centre = le bouton),
  UN clic ⇒ visionneuse, impression lancée seule, PDF de 4 bordereaux chacun SON N°, aucune feuille « Choisir » ni
  « Tout est sorti ? », « 4 imprimés · Annuler », 4 marqués puis retirés par « Annuler » ; D1 (papier jamais choisi) :
  une question puis le PDF ; « Plus tard » range ; rien lu ni imprimé avant le clic. Sur le build d'origin/main
  (1b358a738) : **5 rouges** (pas de bannière). Captures regardées (clair, sombre).
- `audit-traduction`, `audit-quoi-de-neuf` verts ; build vert.

## ÉTAT À LA REPRISE
- PR ouverte (voir le rapport). Rien à faire pour Julien.
- À regarder : sur Ma journée, la carte « À envoyer » dit « Imprimer les 4 bordereaux » (ceux qui ont un PDF) quand le
  nombre publié par Ventes (`lot`, celui d'« Imprimer (N) » et de la bannière) vaut 5 (un Vestiaire sans PDF compté) —
  écart d'avant ce lot entre deux sources ; la bannière suit la source de Ventes (§11).
