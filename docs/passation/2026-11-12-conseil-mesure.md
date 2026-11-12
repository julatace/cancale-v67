# 12 nov. 2026 — Le conseil de baisse, mesuré (second agent)

Branche `claude/agent2-conseil-mesure`, partie de `origin/claude/agent2-revue-fin`
(elle la CONTIENT) puis `git merge origin/main`. Pas de PR, pas de fusion.

## La décision de Julien (12 nov.)

Sur le « X € conseillé » d'une paire qui dort (fiche d'annonce, liste « Repricing ») :
« oui, on le garde, mais ça ne doit pas être abusif ».

## Avant

Deux règles différentes, toutes deux larges :
- la fiche : −15 % dès 30 j en ligne **ou** 30 vues sans favori, plancher = prix d'achat
  (sans prix d'achat : −15 % quand même) ;
- le repricing : −12 % / −20 % / −30 % selon l'âge, ou −10/−12 % sur les vues ;
  plancher = prix d'achat s'il est connu ;
- aucune limite dans le temps : baisser, puis se voir reproposer aussitôt une baisse.

## Maintenant — une règle, `src/conseilPrix.js` (pure)

`conseilBaisse({ prix, ageJours, achat, vendue, favoris, derniereBaisse, memo })` :
- **30 jours en ligne au moins**, âge LU (date Vinted ou « Ajouté il y a… » relevé par
  l'extension, `listedAgeDays`) ; pas lu ⇒ rien. Vendue (bordereau reçu) ⇒ rien.
- **−10 % au plus** du prix actuel, arrondi à l'euro **vers le haut** (49,90 € ⇒ 45 €,
  jamais plus de 10 %).
- **Jamais sous le prix d'achat + 10 %** (arrondi à l'euro au-dessus) ; le palier
  s'arrête au plancher ; plancher ≥ prix ⇒ rien. **Prix d'achat inconnu ⇒ rien**
  (CLAUDE.md §2.5 : il le saisit, jamais deviné).
- **Une proposition par paire tous les 14 jours** : date de la dernière baisse LUE
  (`derniereBaisseLue` : journal des prix lus `vrm_prix_lus`, point plus bas que le
  précédent ; prix changés par VRM `vinted_prix_historique`, apres < avant — par
  l'identifiant de l'annonce) ou de la dernière proposition (`vrm_conseil_prix`,
  SYNC_KEYS, `{ v:1, a: { [item_id]: { at, prix, sugg } } }`). Dans les 14 jours, la
  MÊME proposition reste (prix inchangé) ; prix changé ⇒ rien. La proposition est notée
  quand elle apparaît (un effet, seulement si une proposition est NOUVELLE) ; au retour
  du nuage, fusion par la plus récente (la plus prudente).
- Une **suggestion** : « Baisser à 92 € ? » + « en ligne depuis 45 j · 3 favoris »
  (favoris seulement s'ils ont été lus). Gris (`--vrm-muted`), jamais rouge ; le geste
  reste « Changer le prix » (rien ne part sans lui).
- Aucun prix conseillé à la **mise en ligne** (refusé le 11 oct.) : une paire neuve n'a
  pas 30 jours.

Dans l'app (`src/App.jsx`) : une carte `conseilsPrix` (id → conseil) lue par la fiche
(`const conseil = soldBord ? null : conseilsPrix.get(…)`) ET par `repriceList` ; la baisse
eBay en proportion passe par `baisseProportion` (−10 % au plus, plancher achat + 10 %).
Le sous-titre du repricing dit la règle : « En ligne depuis 30 j · −10 % au plus · jamais
sous achat + 10 % ». CSS : la question reste entière, la raison s'efface au bord
(`styles-annonces-coherence.css`).

Hors de ce chantier (inchangé) : la **baisse en série** (`src/baissePrix.js`) — c'est
LUI qui choisit le montant, rien n'y est conseillé.

## Preuves

- `node scripts/audit-conseil-mesure.cjs --prouve` : 33 contrôles verts (10 j ⇒ rien,
  45 j ⇒ −10 %, balayage de 2 137 propositions, achat absent ⇒ rien, plancher 94 € /
  rien, 14 j entre deux, vendeur qui accepte tout sur 200 j ⇒ 12 propositions espacées
  d'au moins 14 j, phrase et raison, eBay 60 → 55 €, l'app lit la même carte) ; **10
  mutations** de la règle, chacune vue (−15 %, 7 j, écart 0, plancher = achat, achat
  deviné, âge inconnu = 30 j, arrondi au plus proche, mémo ignoré, baisse lue ignorée,
  vendue ignorée).
- Sur la branche de départ (`git archive origin/claude/agent2-revue-fin`, audit copié
  DEDANS et lancé depuis cet arbre) : **6 rouges** (règle absente, fiche et repricing
  hors règle, −15 % / 12–30 % encore là, « X € conseillé »).
- `audit-robustesse-metier` J2 suit la nouvelle règle (achat + 10 %).
- Bancs : `annonces-coherence` (fixture : le prix d'achat de la N°11 passe à la N°12 qui
  dort — 120 €, 45 j, achat 60 € ⇒ « Baisser à 108 € ? · en ligne depuis 45 j »),
  `annonces-carte` (eBay : 49 → 45 ⇒ 60 → 55 €).
- `npm run build` ; audits variables, tdz, coherence, identite, icones, robustesse-metier,
  conseils, vendre-plus, baisse-prix, annonces-outils et ceux qui lisent SYNC_KEYS : verts.

## Geste de Julien

Aucun.
