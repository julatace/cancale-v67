# 28 nov. — « S'essouffle » : les annonces sans vues remontent en tête de « À republier »

Branche `claude/republier-essouffle` (pas de PR ouverte : demandé par la session mère).

## Le choix de Julien (28 nov.)

> « Relance des annonces qui s'essoufflent : quand une annonce n'a plus ni vues ni favoris depuis plusieurs jours, elle
> remonte en tête de "À republier", avec le gain estimé. C'est toujours toi qui lances. »

## La règle — `src/essoufflement.js` (un propriétaire, module pur)

- **Source** : la courbe de chaque annonce (`courbes_annonces_{uid}_{nav}`, ext. 5.428, `src/courbeAnnonce.js`) : un
  point par jour LU `[jour, vues, favoris, prix, minute]`. Plusieurs navigateurs : la lecture la plus tardive du jour.
  Rien n'est interpolé.
- **Essoufflée** (`etatCourbe`) : en remontant depuis le dernier jour lu (aujourd'hui ou hier, sinon « pas su ») :
  ≥ **4 pas de suite** entre jours **consécutifs et lus**, chacun avec **≤ 1 vue gagnée et 0 favori** (exactement : un
  favori perdu peut cacher un favori gagné). `jours` = nombre de pas plats.
- **Pas su, jamais essoufflée** : un trou (jour non lu), une courbe vieille, des vues à **0** (Vinted écrit 0 quand il ne
  donne plus le nombre — même règle que l'app, 9 nov.), un champ absent, des vues qui reculent, une courbe trop courte,
  une annonce dont le paquet de lecture a raté.
- **Active** : un pas non plat dans les 4 derniers (vues, favori gagné ou perdu).
- **Gain estimé** (`gainCompte`, par compte) : chaque repère « r » du journal de VRM (republiee → r sur l'ancienne ET la
  nouvelle) ; la NOUVELLE annonce se reconnaît à sa courbe (aucun jour lu avant le repère ; l'ancienne, ou une annonce
  modifiée sur place, l'a été). Son gain = ses vues LUES au **3ᵉ jour** après le repère (annonce neuve : le compteur part
  de 0). 3ᵉ jour non lu, vues à 0 ⇒ cette republication n'est pas comptée. Moyenne arrondie + couverture `n`. Aucune ⇒
  `null` (« — », « aucune republication relue sur ce compte »). Jamais le gain d'un autre compte.
- **Sites** : la règle ne regarde pas le site ; seule l'extension Vinted écrit des courbes, donc seules des annonces
  Vinted sont essoufflées aujourd'hui (l'atelier Republier est celui de Vinted).

## Le classement — `src/republierPriorite.js`

- Une annonce Vinted **en ligne** (`<enligne-regle>` : état `enligne`) et essoufflée est proposée **même avant l'âge
  de « Dorment »**, et passe **devant** les autres : gain connu de son compte (le plus grand d'abord ; inconnu après),
  puis jours à plat, puis identité.
- Exclusions (une fonction `raisonEcart` pour les deux entrées, chacune COMPTÉE) : vendue (tout site), masquée,
  **réservée** (nouveau : `is_reserved` LU, porté par `src/articles/sources.js` → `modele.js` `reservee`), litige,
  compte bloqué, personnel / d'achats. « Réservée » s'applique aussi aux paires qui dorment.
- Résultat : `essouffle: { etat: 'lecture'|'passu'|'lu', n, passu, gains }`, chaque ligne `essouffle: { jours }`,
  `gain: { n, moyenne }`.

## La lecture — `src/essoufflementLecture.js`

Projetée (jamais `select=data`) : d'abord `id,ev:data->ev` (repères), puis les points `data->a->"ID"` des annonces en
ligne et des annonces désignées par un repère « r », par paquets de 60, deux à la fois (`selectCourbesPlan`). Paquet
raté ⇒ ses annonces « pas lues ». Mémoire 10 min. Lancée quand l'écran Annonces est calme (`requestIdleCallback`).

## L'écran — `src/natif/ecrans/RepublierPriorite.jsx`

Sur chaque essoufflée : « Presque aucune vue depuis N jours » (≤ 8 mots, 5 langues), dessous « Relancée : +X vues en
3 j · d'après N republications » ou « Relancée : — · aucune republication relue sur ce compte », puis le bouton
**Republier** (icône `sync`, composant `Actions`) et **Pourquoi ?** (la règle en clair). « Republier » = le geste
existant `republierPrio` d'Annonces avec CETTE annonce (SA confirmation, l'atelier du panneau sinon) : rien ne part sans
son « Oui ». Au pied : « S'essouffle : — · les courbes n'ont pas pu être lues » / « — pour N annonces (jours non lus) ».
Le texte « Presque aucune vue » est volontaire : la règle tolère 1 vue par jour, « Plus de vues » serait faux.

## La notification — `api/_lib/essoufflement-notif.js`, action `essouffle` de `/api/push`

« 3 annonces s'essoufflent ». **Éteinte par défaut** : seul `push_prefs.essouffle === true` (Réglages → Notifications,
interrupteur « Annonces qui s'essoufflent ») l'allume ; famille Rappels (`FAMILLE_DE.essouffle`), heures calmes
comprises. **Une par jour (Paris) au plus** : mémo `vrm_essouffle_dit` écrit AVANT l'envoi (illisible / pas écrit ⇒
rien). L'app n'envoie que le NOMBRE, au plus une fois par jour et par appareil (`vrm_essouffle_appel`). Toucher ⇒
`/?tab=annonces&vue=arepublier` (ajout dans `App.jsx`). Aucune carte récurrente (§2.10). Aucune nouvelle fonction `api/`
(12/12 inchangé) ; `getRowVendeur` / `ecrireVendeur` de `veille-chiffres.js` sont maintenant exportées.

## Base

Mesure de la vraie base impossible depuis cette session (le connecteur Supabase ne voit qu'un autre projet). Le
22 nov., aucune ligne `courbes_annonces_*` n'existait encore chez lui (`2026-11-22-apres-finale-app.md`) : tant que ses
extensions ≥ 5.428 n'ont pas écrit 5 jours lus de suite, l'écran dit « — » et personne n'est dit essoufflé. La forme
servie par les bancs est celle de `src/courbeAnnonce.js` (`ajouterPointsCourbe`, `reperesJournalCourbe`).

## Preuves

| contrôle | résultat |
|---|---|
| `node scripts/audit-essoufflement.cjs` | vert (E1–E8) |
| `node scripts/audit-essoufflement.cjs --prouve` | 23/23 mutations attrapées (trou traversé, vue à 0, favori perdu, courbe vieille, seuil, ancienne annonce comptée, 3ᵉ jour deviné, gain à 0, paquet raté, gain d'un autre compte, exclusion/réservée oubliées, pas en tête, gain ignoré, en cours dit lu, notif allumée par défaut / deux fois / mémo après / mémo illisible, interrupteur allumé, lancement seul vue / écran) |
| sur `origin/main` (git archive) | rouge (le module n'existe pas) — les mutations sont la vraie preuve |
| `node scripts/audit-republier-priorite.cjs --prouve` | 15/15 (ancres remises à jour ; la mutation `panneau-effet`, cassée avant, retrouvée) |
| banc `scripts/bancs/republier-essouffle.cjs` | 52 verts, 0 rouge — 390 tactile et 1512, clair et sombre, captures regardées |
| banc `scripts/bancs/republier-priorite.cjs` | vert (attente du pied `reservee:0` ; libellé d'Aujourd'hui recalé sur « N paires à republier », rouge avant ce lot) |
| `audit-coherence`, `audit-traduction`, `audit-quoi-de-neuf`, `audit-boutons`, `audit-icones`, `audit-fonctions-api` | verts |

## Geste de Julien

Aucun pour voir la liste. Pour la notification : Réglages → Notifications → « Annonces qui s'essoufflent ».
