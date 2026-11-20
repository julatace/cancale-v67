# 20 nov. 2026 — Ventes en tableau de travail (branche `claude/ventes-tableau`)

Julien, sur sa capture de Ventes à l'ordinateur (Edge ~1500 px : liste étroite au centre, « AU MOINS 10 À ENVOYER · 1 AVANT
DEMAIN · 4 SANS BORDEREAU · 1 À DÉPOSER », « Imprimer » pâle désactivé, « Tes bordereaux reçus par e-mail : pas su », grand
volet vide « Touche une vente pour la voir ici ») : « j'aime pas ça du tout, je veux que tu fasses comme Vintex et comme
l'extension avec les transporteurs ». Référence : la page « Commandes » du panneau de l'extension 5.410.

## Ce qui change (la disposition seulement — mêmes rangées-objets, mêmes règles, aucun chiffre ne change)
- **Ordinateur (≥ 1024)** : « À envoyer » et « En route » sont le `TableauTravail` (src/natif/ecrans/Ventes.jsx, `VentesBureau`) :
  segmenté au-dessus de la barre d'outils, recherche, « Statut ▾ » à compteurs (À envoyer : bordereau prêt / sans / imprimé /
  sur son site ; En route : En route / Livrée / Terminée), tableau pleine largeur : case · vignette · titre + état en petit ·
  N° (plaque) · Prix · Date · Transporteur (LOGO + nom, `LogoTransporteur`, « — » pas lu) · Statut (« À expédier » ambre,
  le reste neutre) · Date limite (en-tête « · N avant demain ») · ⋯ ; tri, colonnes mémorisées.
- Les **cases** de « À envoyer » sont le LOT d'impression (`cochesEffectives` : cochées d'office là où le bordereau est prêt,
  jamais sans) — `TableauTravail` accepte `coches` + `onCocher` (mode piloté, pas de barre de sélection). « Imprimer N
  bordereaux » est dans la barre d'outils, montré seulement quand N > 0 ; plus de bouton désactivé. « ⋯ » : format, choix, scanner.
- **Détail** : seulement au toucher d'une vente — à côté du tableau à ≥ 1440 px, posé au bord droit en dessous ; ✕ / Échap.
  Plus de troisième volet vide (`ECRANS_TABLEAU` contient `ventes`) ; plus de barre du haut (sa recherche) sur Ventes : une
  seule recherche, ⌘K garde son panneau.
- Plus aucun « à déposer » : l'écart de tête ne dit plus « N à déposer » ; l'étape de la fiche se dit « Déposé » (un fait), sans
  « à faire ».
- **Téléphone** : la liste native garde sa forme ; à droite, le prix puis l'étiquette d'état ; le logo du transporteur sur la
  ligne du N° et de la date limite (jamais coupée).
- **Terminées** : le segmenté reste visible (la règle `data-vv-toutes` de ventes-verre.css cachait la page natif : on ne
  pouvait plus revenir à « À envoyer » ni au téléphone ni à l'ordinateur) — enveloppé dans `.vv-tete`.
- `modeleVentes.js` : `transporteurCle`, `t` (date de vente lue, `tempsVente`) et `statutRangee` (lu sur les étapes prouvées).

## Preuves
- `scripts/bancs/ventes-tableau.cjs` : 1512, 1280, 390 tactile, clair et sombre, base de volume (chaque transporteur posé
  sur les bordereaux inventés) et base vide — 172 verts ; rouge sur le build d'avant (16 rouges) ; mutations (logo, case sans
  bordereau) ⇒ rouge. `natif-ventes.cjs` juge désormais le téléphone (titre ≥ 100 px avec l'étiquette).
- `chiffres-volume` : relevé identique avant / après. Audits tdz, variables, traduction, quoi-de-neuf, icones, coherence,
  actions-app, depose-retire, ventes-modele : verts.
