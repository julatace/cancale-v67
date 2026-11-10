# Lot P — raccourcis clavier + lecteur d'écran (10 novembre 2026)

Branche `claude/clavier-voiceover`. Propositions 21 et 22 de `2026-11-09-propositions.md`,
validées par Julien : (1) raccourcis clavier sur ordinateur — aller aux écrans (« g » puis
j/a/v/c/m…), ⌘K existe, « / » pour chercher, « n » = nouvel achat, « ? » = la liste dans
une feuille ; **jamais quand on tape dans un champ ; jamais un geste irréversible au
clavier**. (2) VoiceOver : chaque bouton icône nommé, chiffres des widgets lus avec leur
libellé, feuilles qui piègent le focus (DA4), pastilles d'état avec un texte, ordre logique ;
corrigé à la racine.

## Ce qui a changé

| quoi | où |
|---|---|
| La règle des raccourcis (pure) : `ALLER` (g + j a v c m h s r t e p ⇒ Ma journée, Annonces, Ventes, Colis, Messages, Achats, Stock, Argent, À trancher, E-mails, Paramètres), `SEULES` (n, /, ⌘K, ← →, ?, Échap), `toucheEcoutee` (refuse champ de saisie, role textbox/searchbox/combobox, ⌘/Ctrl/Alt, touche répétée, feuille modale ouverte), `lireTouche` (« g » puis la lettre en moins de 1,5 s) | `src/raccourcisClavier.js` |
| L'écoute et la feuille « ? » (la feuille unique `SheetShell` : portail, focus gardé, Échap). Elle n'envoie que `vrm:aller` (le chemin des liens `?tab=`, la même liste blanche `ONGLETS_LIENS`) ; « n » = `?tab=achats&achat=1` (le lien Siri, sans titre ni prix : formulaire VIDE, rien n'est écrit sans « Ajouter l'achat ») | `src/RaccourcisClavier.jsx`, `src/raccourcis-clavier.css`, monté dans la coque d'`AppCoeur` (à côté du `Toaster`) |
| Paramètres → Affichage → « Raccourcis clavier » ouvre la même feuille (`vrm:raccourcis-clavier`) | `src/ecrans/Reglages.jsx` |
| « / » et ⌘K : **inchangés** (déjà dans App.jsx), seulement rappelés dans la liste | — |
| `BoutonBase` : un bouton en icône seule sans `aria-label` prend son `title`, sinon le nom de l'icône (`NOMS_ICONES`), sinon « Bouton » — jamais muet. `SegmenteBase` : segment en icône seule sans `titre` ⇒ nom de l'icône. `Btn` (App.jsx) : sans texte (icône seule) ⇒ son `title` | `src/composants/Bouton.jsx`, `Btn` dans `src/App.jsx` |
| Widgets (`CarteMois`, toutes les cartes de chiffres) : chaque case se lit « Vendu · mois : 80 € » — le libellé avant le chiffre, « pas su » à la place d'un « — » muet (§5), la raison ensuite ; le dessin ne bouge pas (texte `vrm-sr-seul`, le visible en `aria-hidden`) | `src/design/CarteMois.jsx` |
| Annonces en grille : « Détails et gestes » dit QUELLE paire (« N°12, Adidas…, 65,00 € ») ; le lien de la photo dit « Ouvrir sur Vinted : titre » puis ses pastilles d'état (« En double »…) au lieu de quatre « Ouvrir l'annonce sur Vinted » identiques | `src/App.jsx` (vignette) |
| Un compte collé à son libellé (« Sans achat relié3 ») : une espace insécable avant `.vrm-of-n` / `.vrm-pm-n` (marge 6 px = 2 px + l'espace, rendu inchangé) | `src/design/argent-offres.css` |
| « Ma semaine › » : le chevron n'est plus lu | `src/App.jsx`, `src/ecrans/Stats.jsx` |

Non fait (choix) : « I imprimer » de la proposition 21 — imprimer n'est pas irréversible,
mais il part sur une sélection de bordereaux propre à Colis ; à reprendre si Julien le
redemande. Aucun raccourci ne valide, n'envoie, ne supprime ni n'écrit.

## Preuves

- **Contrôle a11y automatique** : `axe-core` n'est pas en dépendance ⇒ le banc lit l'arbre
  d'accessibilité de **Chrome** lui-même (CDP `Accessibility.getFullAXTree`) : les noms
  qu'un lecteur d'écran lira, pas une règle maison. `scripts/bancs/clavier-voiceover.cjs`,
  données inventées, 390 px tactile et 1512 px, clair et sombre, sur Ma journée, Annonces,
  Ventes, Colis, Messages, Achats, Stock, Argent, Paramètres (le sombre relit trois écrans) :
  A1 aucun contrôle sans nom, A2 aucune image non décorative sans nom, A3 rien de focalisable
  sous `aria-hidden`, A4 « Détails et gestes » dit sa paire, A5 aucune erreur, A6 un widget
  se lit « libellé : valeur ». Partie B (1512, clair et sombre) : g a / g v / g c / g j,
  « g a » tapé dans un champ s'écrit et ne bouge pas, « ? » ouvre un dialog modal nommé,
  focus dedans, **Tab et Maj+Tab tournent dedans (DA4 vérifié)**, Échap ferme, feuille
  ouverte ⇒ « g a » ne bouge pas, « / » ouvre la recherche, « n » ⇒ Nouvel achat ouvert,
  aucune écriture `main` pendant toute la séquence.
  - Branche : **132 ✅ · 0 ❌** (après `git merge origin/main`).
  - `origin/main` (git archive, banc copié dedans, 1512 px) : **18 ❌** — A4, A6, B1, B3, B5
    (clair et sombre).
  - Mesure de départ sur `main` : A1/A2/A3 déjà verts sur ces écrans avec ces données (les
    sessions DA ont nommé la plupart des boutons) ; les défauts réels trouvés étaient de
    QUALITÉ du nom (widgets « — Bénéfice · mois… », quatre liens et quatre boutons au nom
    identique, « relié3 », « › » lu) — c'est ce que A4/A6 tiennent désormais.
- `scripts/audit-raccourcis-clavier.cjs` : la règle exécutée (champ, modificateurs, feuille,
  répétition, séquence et délai, liste blanche lue dans App.jsx, « n » vide, seulement
  `aller`/`ouvrir`, le composant n'envoie que `vrm:aller` et n'écrit rien) et
  `nomBoutonIcone`. `--prouve` : 12 mutations, toutes rouges.
- Captures regardées : feuille « ? » 1512 clair et sombre, Ma journée 390/1512, Annonces
  1512 sombre (espace avant les comptes des filtres, widgets inchangés).
- `npm run build` ; audits variables, tdz, coherence, identite, icones, raccourcis-siri,
  raccourcis-clavier verts. `audit-config-facture` et `audit-photos-vinted` déjà rouges sur
  `main` (inchangés).

## Ce qui reste

- Relecture à la main avec VoiceOver (Safari, iPhone) : le banc juge les noms de Chrome ;
  Safari les calcule presque toujours pareil, pas toujours.
- Contrastes : pas mesurés dans ce lot (la proposition 22 les cite).
- Les écrans hors de la liste du banc (Litiges, E-mails, Communauté, Organisation…) n'ont pas
  été relus.

Geste de Julien : aucun (sur ordinateur, taper « ? » pour voir la liste).
