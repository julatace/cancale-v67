# 11 nov. 2026 — « Le temps que VRM te fait gagner » sur la page d'accueil publique (lot temps-gagne)

Branche `claude/temps-gagne` (pas de PR, pas de merge dans `main` : consigne de la session).
Demande validée par Julien : un bloc sur la PAGE D'ACCUEIL PUBLIQUE, avant la création de
compte, pour convaincre — un calculateur simple et honnête.

## Ce qui a changé

- **Section `#temps`** (`src/Accueil.jsx`), entre « la journée » et « comment ça marche » :
  titre « Le temps que VRM te fait gagner », une phrase (« VRM gère toute ton activité, pas
  seulement la publication : colis, numéros, compta, messages et offres… »). ⚠️ Jamais
  « le seul » (StoFlow, FLUF, Vendoo gèrent aussi Vestiaire) — l'audit le refuse dans les cinq langues.
- **Le calculateur** (`src/accueil/TempsGagne.jsx`) : cinq curseurs (ventes / semaine,
  achats / semaine, comptes tous sites, plateformes 1–4, baisses de prix / semaine), le total
  « ≈ 55 min par semaine, soit ≈ 4 h par mois », puis sept gestes, chacun avec sa durée de
  référence (« 2 min → 20 s par vente ») et son gain. Sous le résultat : « Estimation : des
  durées de référence raisonnées geste par geste (à la main → avec VRM), pas des résultats de
  clients. Ton temps réel peut être plus court ou plus long. »
- **La règle** (`src/accueil/tempsGagne.js`, fonction pure) : chaque geste porte `sans`,
  `avec` (secondes par unité), `nature` (`raisonnée` aujourd'hui pour toutes ; `mesurée`
  exigerait une date) et `pourquoi` (le geste à la main ET avec VRM, en clair). « Avec VRM »
  garde toujours le geste qui reste (sortir le bordereau de l'imprimante, lire l'état…).
  Le premier compte ne compte pas dans « tous tes comptes sur un écran ». Arrondis : 5 min la
  semaine (à la minute sous 5 min), 15 min le mois (52/12 semaines) — pas de fausse précision.

| geste | à la main → avec VRM | par |
|---|---|---|
| Bordereaux tamponnés du N°, imprimés en une fois | 2 min → 20 s | vente |
| L'article retrouvé par son N° de rangement | 1 min → 10 s | vente |
| Ventes datées pour l'URSSAF | 30 s → rien | vente |
| Colis suivis dans une seule liste | 1 min → 10 s | colis (ventes + achats) |
| Tous tes comptes sur un écran | 5 min → rien | semaine et compte en plus |
| Codes de retrait réunis | 1 min 30 → 15 s | achat |
| Prix baissés en série | 1 min → 10 s | baisse |

- **Poids** : le calculateur est un morceau à part (`React.lazy`, ≈ 6,9 Ko non compressés),
  demandé seulement à l'approche de sa section (IntersectionObserver, marge 60 %). Dans le
  fichier d'entrée n'entrent que les textes (fr-accueil.js) et quelques lignes : +0,14 Ko compressés.
- **Traduction** : 30 clés `accueil.temps.*` dans `{fr,en,es,it,de}-accueil.js` ;
  `TempsGagne.jsx` ajouté aux écrans migrés d'`audit-traduction` (aucun texte en dur) et à
  la liste des fichiers publics (clés dans la partie publique).

## Preuves

- `node scripts/audit-temps-gagne.cjs` : 46 ✅. `--prouve` : **8/8 mutations rougissent**
  (nature « devinée », sans < avec, premier compte compté, gain sans soustraire « avec »,
  note sans « pas des résultats de clients », « The only… » en anglais, clé allemande
  manquante, import en dur dans Accueil.jsx).
- Banc `scripts/bancs/accueil-temps.cjs` (390 et 1512, clair et sombre) : voir « ÉTAT À LA REPRISE ».

## ⚠️ Constaté, pas de ce lot

Le fichier d'entrée de `origin/main` (f04d4a580) pèse déjà **≈ 33,7 Ko** compressés, au-dessus
du budget de 26 Ko du banc `accueil` (il pesait 25,9 Ko au lot accueil-public) : d'autres lots
ont fait grossir l'entrée. Ce lot y ajoute +0,14 Ko (33,84 Ko). À rechercher (quel import
est entré dans `main.jsx`) — hors de ce lot.

## ÉTAT À LA REPRISE

(rempli en fin de lot)

## Geste de Julien

Aucun.
