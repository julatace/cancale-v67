# 10 nov. 2026 — Textes courts, 3e série

Branche `claude/textes-courts-3`, partie de `origin/main` puis de `claude/textes-courts-suite` (pas encore
fusionnée dans `main`, fusionnée ici en avance rapide pour ne pas réécrire ses textes), puis un vrai
`git merge origin/main` (factures Pro du lot Q : leur code gardé, conflit d'import de `src/FacturePro.jsx`
réglé en prenant celui de `main`). Poussée à chaque commit, pas de PR.

Règle : `docs/passation/2026-11-09-popups-propre.md` et `2026-11-10-textes-courts-suite.md` — chaque texte de
plus de 90 caractères est RÉÉCRIT (le fait + le geste), le détail utile replié sous `<Pourquoi>` ; jamais une
obligation, un chiffre, « au moins », « pas su », un manque nommé ou un geste retiré.

## Relevé (textes JSX visibles > 90 caractères, hors `Pourquoi` / `details` / `style`)

Script de relevé (babel) : un élément bloc = son texte + ses enfants en ligne (`b`, `span`, `a`…).

| fichier | avant | après |
|---|---|---|
| `src/ecrans/Compta.jsx` (Argent) | 17 | 3 (titre + sous-titre d'export compté ensemble ; une `SourceChiffre` repliée ; Super PDP « facturés par Super PDP » gardé visible : un coût) |
| `Comptabilite` d'App.jsx (Colis, Achats, Messages, reçus, prix, trésorerie, rapport URSSAF, inventaire) | 52 | 1 (l'aide des offres automatiques, déjà repliée derrière « i ») |
| `src/ecrans/Republier.jsx` | 15 | 0 |
| `src/Accueil.jsx` | 16 | 3 (accroche du haut, chapo, « Ton ordinateur reste nécessaire… » : phrase verrouillée par `audit-accueil-navigateurs --prouve`) |
| `src/FacturePro.jsx` | 8 | 1 (« Acheteur prouvé : le même n° de transaction (…) … arrivé … » lu mot pour mot par le banc `facture-pro`) |
| `src/ecrans/Stats.jsx` | 6 | 0 |
| `src/ecrans/Stock.jsx` | 8 | 2 (dans la feuille `InfoPop`, déjà repliés) |

Exemples :
- CFE : « si tu as reçu un avis, il est à payer au plus tard le …, dans ton espace professionnel… Pas d'avis
  l'année de création… sous 5 000 € » → « CFE : si tu as reçu un avis, paie-le avant le … sur impots.gouv.fr. ⓘ »
  (le reste sous « Pas d'avis ? » ; `audit-plateformes-2nov` P6 lit toujours « si tu as reçu un avis » et « sous 5 000 € »).
- Rapport URSSAF : « N ventes vendues en sept. et versées ce mois-ci : déclaré à la date de vente, elles relèvent
  de … pas de celle-ci : rien à régulariser. Note … » → « N ventes vendues en sept. : **rien à régulariser**. Note
  ce mois-là ici. ⓘ ».
- Republier : « Quand la nouvelle est en ligne, supprime l’ancienne sur Vinted : sinon la même paire est en vente
  deux fois. VRM ne supprime rien. » → « Nouvelle en ligne : supprime l’ancienne sur Vinted, sinon double vente. »

## Ce qui est gardé exprès

- « Mêmes réglages que Republier » / « Mêmes réglages que « Republier à la main » » / « Gardés : »
  (`audit-republier-main` B5, banc `republier-main`).
- Accueil : les deux `data-automatisme`, « favori », « republi », « sans engagement », « résili », « ne vend
  rien », « un compte vend sur chaque plateforme » (`audit-plans-solo-pro`), Vestiaire seulement dans la FAQ.
- Pas de `<Pourquoi>` (un `<details>`) dans un `<p>` : deux phrases réécrites sans lui ; `<p className="vrm-rm-memes">`
  devenu `<div>` (même classe, `margin: 0`).
- Pas touchés : « Sécurité des données », confirmations de suppression eBay/Leboncoin, `ExtEnRetard`,
  `FavorisVinted.jsx` (rythme et « Aucune garantie contre un blocage Vinted » : à voir avec Julien).

## Preuves

- `npm run build` vert ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`, `urssaf`, `boutons`,
  `statuts`, `plateformes-2nov`, `facture-pro`, `republier-main`, `accueil-navigateurs`, `plans-solo-pro`,
  `lancement`, `superpdp-route`, `suivi-urssaf` verts.
- Avant chaque remplacement, les morceaux du texte d'avant cherchés dans `scripts/` (les bancs lisent des `data-*`,
  sauf les phrases gardées ci-dessus).
- Banc `scripts/bancs/popups-propre.cjs` : `ECRANS` prolongé de `argent`, `argent-stats`, `argent-declarer`,
  `argent-factures`. P1 ignore désormais les `<table>` (des données, comme la liste du Stock ; le tableau
  accessible caché de « Vendu par semaine » et l'en-tête du tableau des factures étaient lus comme un paragraphe).
  Le premier passage a trouvé 4 vrais textes (tuile « Société », « CA déclaré pas encore calculé », Factur-X et
  « Où l'envoyer », raison « Régime fiscal pas renseigné. » de `src/facturationElectronique.js`) ⇒ réécrits.
  - cette branche : **266 verts / 9 rouges** au 1er passage complet (les 9 sur les écrans Argent ajoutés), puis
    Argent seul **36 verts, 0 rouge** ;
  - `origin/main` (git archive, son build, le banc copié dedans), Argent seul : **8 rouges** (« Pas encore
    calculés : ils se lisent… », « Je n'ai pas pu lire ta connexion Super PDP… », Factur-X, « Société »).
  - Captures 390 sombre/clair et 1512 regardées (Argent → Factures).
- Banc `facturx` : 3 rouges (« un PDF est téléchargé », CSV/JSON, `scrollIntoViewIfNeeded`) **à l'identique sur
  `origin/main`** (mesuré dans l'arbre `git archive`) — pas de ce lot.

## Ce qui reste

- `FavorisVinted.jsx` (8), `Operations.jsx` (9), `Communaute.jsx` (7), Ebay/Leboncoin/Réglages (le reste
  volontaire, cf. récit précédent), les écrans de connexion et d'installation de l'extension d'App.jsx.
