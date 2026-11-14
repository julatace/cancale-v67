# 14 novembre 2026 — Idées 154, 157, 158 : l'histoire d'une paire, l'autre taille, la meilleure heure

Branche `claude/idees-paires` (depuis `origin/main`). Cinq idées avaient été demandées (154 à 158) ;
**Julien n'en a gardé que trois : 154, 157 et 158.** Les deux autres — **155** (note de chaque annonce)
et **156** (modèles de description qui remplissent une fiche) — ont été construites puis **retirées
entièrement** de la branche sur sa décision (code, textes, audits, nouveautés) : `src/noteAnnonce/`,
`src/modelesDescription/` supprimés ; `src/AnnoncesACompleter.jsx` et `src/modelesDescription.js`
rendus tels qu'ils sont sur `main` ; l'audit le vérifie (B5). Ne pas les reprendre sans qu'il le demande.

Consigne de Julien pour ces trois-là : « je ne tolère plus d'erreurs » — chaque cas limite est
vérifié par un contrôle qui EXÉCUTE la règle, chaque contrôle est prouvé par mutation.

## Ce qui existait (lu avant de coder)

| demande | ce qui existait | ce qui manquait |
|---|---|---|
| 154 histoire d'une paire | `histoireArticle` (3 nov.) : la fiche raconte la paire **par étape**, chaque événement lu par identité | une **ligne de temps** dans l'ordre des dates ; « reçue » (la date existait dans `ficheExtra.reception`, pas affichée) ; « photographiée » (les dates du studio `studio_photos_{N°}`) ; « publiée » à la date **donnée par Vinted** (`numData.crees`) ; « baisse / hausse » distinguées ; « date inconnue » |
| 157 autre taille | « Dupliquer » (3 nov., `src/dupliquerFiche.js`, N° par `prochainLibre`) | changer la **taille** (et la taille écrite dans le texte), retirer l'ancienne étiquette N° |
| 158 meilleure heure | Statistiques → « Quand tu vends » (`quandTuVends`, jours et heures séparés, ventes sans heure à part) | le croisement **jour × heure**, un seuil, « rien ne se détache », la suggestion dans l'atelier Republier |

## 154 · La ligne de temps — `src/paireHistoire/`
- `ligneDeTemps.js` (pur) range dans le temps ce que `histoireArticle` a trouvé **par identité**, plus
  trois sources, chacune par identité : la réception de l'**achat relié par son n° de transaction**
  (`dateReception` : « Commande livrée » ou son clic « Récupéré » ; un achat non relié n'a jamais de
  « reçue ») ; la date de création **lue chez Vinted** pour CETTE annonce (sinon « vue en ligne », la
  première vue de VRM — jamais « publiée » à une date qui n'est pas la sienne) ; les photos du
  **studio** sous CE N° (lues en **projection scalaire** `a0..a5`, jamais `select=data`).
- Événements : achetée, reçue, numérotée (N° changé), photographiée (n photos), publiée / vue en ligne
  / republiée par plateforme, prix baissé / remonté / lu, vendue, bordereau reçu, colis déposé (SON
  clic), arrivée au point relais, livrée, colis en retour, versement reçu, vente annulée.
- « Pas su » ne s'invente pas : une source pas lue est **nommée** (« Pas encore lu : … ») ; un
  événement prouvé sans date va dans **« Date inconnue »** ; rien n'est daté par déduction.
- **N° porté par deux paires présentes** : AUCUN événement — on ne mélange pas deux histoires sous une
  clé (la fiche dit déjà le doublon en rouge) ; la phrase le dit.
- **Compte exclu** : ses annonces ne sont pas lues par la recherche du N° (`comptesOk`) ⇒ rien.
- Dans la fiche de la paire : deux onglets **« Par étape » · « Dans l'ordre »** (segment creusé, touches
  ≥ 44 px). Le choix est un confort de l'appareil (`localStorage`, rien de synchronisé).
- `histoireArticle.js` : les événements de prix portent `avant` / `apres` en nombres (et le N°
  réattribué `sorte: 'reattribue'`) — la ligne de temps ne relit jamais un texte pour un chiffre.

## 157 · Dans une autre taille — `src/autreTaille/`
- `autreTaille.js` (pur) : la copie (liste blanche de « Dupliquer ») avec la nouvelle taille ; la taille
  écrite dans le texte n'est remplacée **que là où elle est marquée** (« Taille 42 », « T42 », « EU 42 »,
  « Pointure 42 ») ou en dernier mot du titre ; « 28 cm », « 42 cm » ne bougent pas ; ce qui a changé est
  compté et montré. L'étiquette de l'ancien N° est retirée (`retirerEtiquette`) ; un autre N° au milieu
  du texte est **signalé** (« Créer sur Vinted » refuse deux numéros), jamais effacé.
- `AutreTaille.jsx` : la feuille (nouvelle taille, titre et description relus) ; « Créer la fiche » ⇒
  `dupliquerNumero(rn, ex, { taille, titre, description })` : une fiche « À publier », **N° neuf**
  (`prochainLibre`, donné à la création — aucun N° affiché avant), photos à prendre ; puis le chemin
  d'avant « Créer sur Vinted ».
- Gardes : **N° porté par deux paires** ⇒ pas de touche (on ne choisit pas quelle paire copier) ;
  **« Je numérote moi-même »** allumé ⇒ VRM ne donne pas de N° (la règle des lots) : la feuille le
  dit, champ et bouton éteints, et la création le refuse encore ; numéros pas chargés ⇒ dit.
- ⚠️ **Défaut trouvé et corrigé** : `dupliquerNumero` construisait sa propre liste des N° servis, en
  retard sur `numerosServisLus` (11 nov.) — il lui manquait les **cases du Stock** (`vrm_slots` : un N°
  écrit sur un carton) et les **achats hors plateforme**. Si le plus haut N° servi était dans une case,
  « Dupliquer » l'aurait redonné. Il lit maintenant LA liste (`numerosServisLus`, réservés relus en base,
  refus sur « pas su »). `audit-annonces-outils` A3 suit la délégation.

## 158 · La meilleure heure — `src/meilleureHeure/`
- `quandTuVends` (Statistiques) rend aussi `grille` (jour × heure) — la même boucle, les mêmes
  exclusions (une vente sans heure lue n'entre dans aucune case).
- `meilleureHeure.js` : 7 jours × 8 créneaux de 3 h ; la meilleure case n'est dite que si **30 ventes**
  au moins ont leur heure et si elle porte au moins 5 ventes et 1,5 fois la moyenne — sinon « pas assez
  de ventes » ou « aucun moment ne se détache ». Toujours avec la couverture (« sur 412 ventes datées à
  l'heure, 12 derniers mois · 12 sans heure, pas comptées »).
- Les lignes sont celles de Statistiques (`liveStats.venduLignes` : comptes choisis, comptes écartés et
  ventes cachées hors, annulées hors). Lecture en cours ⇒ rien ; ratée ⇒ « pas su » ; partielle ⇒
  « Lecture de tes ventes incomplète : le résultat peut encore bouger ». Toutes plateformes et tous les
  comptes choisis ensemble (pas par compte).
- Dans l'atelier Republier → « Programmer » : la phrase et **« Choisir dimanche 15 nov. à 18:00 › »**, un
  lien qui met ce moment dans le champ. « Programmer » reste SON clic (§3 : aucun lancement).

## Les preuves

- `node scripts/audit-idees-paires.cjs` — **36 verts** : la VRAIE chaîne `toutSurLeNumero` →
  `histoireArticle` → `ligneDeTemps` sur **50 paires identiques** (même titre, prix, taille : chaque ligne
  de temps ne porte que SA paire, une vente au même titre sans lien n'est attribuée à personne), compte
  exclu, rien de lu, **N° en double**, vente annulée, Leboncoin sans date ; le vrai `prochainLibre`
  d'App.jsx (241 après 1…230 + 240 d'une case du Stock + B231 ; C10 dans une série à lettre) ; ventes sans
  heure, seuil, « plat », lecture partielle, comptes écartés (`cachee`, `excluAutre`).
- `node scripts/audit-idees-paires.cjs --prouve` — **16 mutations, toutes rouges**.
- Sur `origin/main` (`git archive`, `--src`) : rouge.
- `scripts/bancs/idees-paires.cjs` (harnais esbuild, vrais composants, données inventées), 390 px tactile
  et 1512 px, clair et sombre : ligne de temps, N° en double, autre taille, « Je numérote moi-même »,
  meilleure heure, lecture partielle ; rien ne déborde, cibles ≥ 44 px, ni violet ni rouge, aucune clé de
  traduction brute à l'écran. Rouge sur `main` et sur quatre mutations (garde du N° en double retirée ;
  date Vinted d'une jumelle ; couverture absente ; « Je numérote moi-même » ignoré). Captures regardées
  (390 et 1512, clair et sombre).
- Audits relancés verts : traduction, tdz, variables, coherence, identite, violet, rouge-doublon,
  quoi-de-neuf, numero-ecrit, numero-etiquette, numero-vinted, numeros-clenum, numeros-lettres,
  numeros-vestiaire, numerotation-lecteurs, annonces-a-completer, annonces-outils, annonce-vinted,
  stats-ventes, fiche-modif, republier-programme, recherche-fiche, fournisseurs. `npm run build` vert
  (après un vrai `git merge origin/main`).
  (`politique-hotes` et `stockage-sur` sont rouges sur `main` pour d'autres fichiers ; aucun fichier de
  ce lot n'y est cité.)

## Design

Direction « Studio bleu clair » : touches (`.sb-touche`), liens (`.sb-lien`), rond de fermeture
(`.sb-rond`), un seul plein dans la feuille (`.sb-btn-plein--barre`), segment creusé pour les onglets.
`src/design/studio.css` n'étant pas encore fusionné, `src/paireHistoire/idees.css` porte les jetons
`--sb-*` avec leurs valeurs de repli et une définition minimale des formes sous `:where()` (marquée
« provisoire : vient de studio.css ») : à retirer quand la fondation arrive.

## Gestes de Julien

Aucun. (La meilleure heure demande au moins 30 ventes datées à l'heure sur 12 mois.)
