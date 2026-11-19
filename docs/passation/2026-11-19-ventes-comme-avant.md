# Ventes « VRM natif » — 19 nov. 2026

Branche `claude/ventes-comme-avant`. Pas de PR (consigne). Rien changé dans l'extension, la base ou CLAUDE.md.

## Ce que Julien a dit, dans l'ordre

1. « Regarde les ventes, elles sont pas belles, j'aimais bien comme c'était avant » ; « sur l'app en mobile c'est pas
   fou du tout, même sur ordi là c'est une catastrophe, l'ergonomie est atroce ».
2. Puis : « la mise en page est catastrophique, revois absolument tout […] je veux quelque chose de drastique, nouveau,
   totalement différent » ⇒ UN seul design, « VRM natif » (`docs/design/NATIF.md`) ; les habillages « VRM », « Apple »
   et l'ancien design disparaissent.
3. Audit d'utilité (`docs/design/2026-11-19-audit-utilite.md` §2, ligne Ventes) : segments **À envoyer · En route ·
   Terminées**, un bouton **Filtrer** au lieu des rangées de sites, la recherche avec le scanner dans le champ, pas de
   « ? », plus de grande carte « À envoyer : 30 » (le segment porte le nombre). La décision n° 6 (retirer Préparer mes
   colis, Je dépose, la tournée, Emballer) est soumise à Julien : en attendant ces gestes RESTENT, derrière « ⋯ ».

## Ce qui a été fait

- `src/designV2/VentesV2.jsx` et son banc `design-v2-ventes.cjs` : **retirés** (la liste v2 n'est plus le défaut,
  décision du 19 nov.).
- `src/ventes/modeleVentes.js` (pur, aucune règle neuve) : chaque colis en rangée-objet — échéance LUE (« avant le … ·
  dans N j ») ou ESTIMÉE (« vers le … », jamais « dans N j », jamais « en retard » : une estimée dépassée devient
  `estimee-depassee`), case du lot (cochée d'office par `cochesEffectives`, grisée et jamais cochée sans bordereau),
  place lue ou rien, état du bordereau, écart nommé, plein « Imprimer N bordereaux » (N = cochés, sinon sa raison),
  recherche par N° / titre / acheteur / suivi (contient, jamais « ressemble »), détail choisi (jamais une autre vente).
  Juge : `scripts/audit-ventes-modele.cjs` (31 verts, 12 mutations sur 12 rougissent).
- `src/App.jsx` (Comptabilite) : `rangsEnvoyerNatif` / `rangsRouteNatif` remplissent ces rangées avec les règles
  d'avant (`aExpedier`, `echeanceCourteColis`, `avantDemainColis`, `lignesLotTous`, `preuvesFriseDe`, `ouDansMeubles`) ;
  les gestes sont les fonctions d'avant (imprimer le lot, format, choisir, préparer, déposer, tournée, emballer,
  scanner, retrouver, la fiche par identité). Aucune règle ni calcul changé. `VENTES_NATIF` : la tête, la liste et
  « En route » d'avant ne sont plus rendues pour Ventes ; leurs feuilles (papier, impression, scanner…) restent.
- `src/natif/ecrans/Ventes.jsx` : l'écran, composé des composants natifs, sans style en ligne ni classe de mise en page.
  `Page` · `Segmente` (À envoyer N · En route N · Terminées) · liste groupée de `Rangee` 72 (case, vignette, plaque N°,
  titre sur 2 lignes, « T · avant le … · dans N j », prix et transporteur à droite, 3e ligne : place · bordereau ·
  compte · site) · plein collé « Imprimer N bordereaux » · balayage = Imprimer (franc) / Déposé · toucher = la fiche
  de la vente poussée (`PagePoussee`) : faits (vendu, pour toi, date limite, place, transport, acheteur), étapes
  prouvées, gestes en rangées. En route : une rangée par colis, son étape « 2/4 · Déposé », balayage « Suivre ».
  Filtrer (feuille des plateformes), « ⋯ » (Format, Choisir, Préparer, Je dépose, tournée, Emballer, Scanner).
- `src/natif/Rangee.jsx` (ajouts, rien renommé) : `selection` (la case à gauche, 44 × 44, à côté du corps) et `note`
  (3e ligne grise).
- Ventes est dans `ECRANS_NATIFS` (App.jsx, coque de la fondation, livraison 2) : la coque dessine le grand titre ; à
  l'ordinateur, trois volets — la liste (380–520) et le détail à droite, la liste toujours visible ; sans vente touchée,
  le volet dit « Touche une vente pour la voir ici. ». Terminées garde la liste d'avant (deux volets).
- Textes par `tr()` (fr, en, es, it, de) ; ligne « Quoi de neuf » `ventes-natif`.

## Preuves

`scripts/bancs/natif-ventes.cjs` — base inventée (`design-passe.cjs`), 390 × 844 tactile, 1512 et 1280, clair et
sombre, base vide. Chiffres : voir la fin de ce récit (dernière exécution).

## Ce qui reste

- « Terminées » montre encore la liste d'avant (elle n'est pas refaite en natif) ; l'audit veut « la date de versement ».
- La décision n° 6 (gestes de « ⋯ ») attend Julien.
- Le code d'avant de Ventes (VentesVerre, ARegarder, la tête v2) n'est plus rendu mais reste dans App.jsx : à retirer
  quand Terminées sera natif.
