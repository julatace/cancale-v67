# 27 nov. 2026 — Scan au point relais ⇒ la paire en stock · « Ce matin » en tête d'Aujourd'hui

Branche `claude/scan-ce-matin`. Deux fonctions choisies par Julien le 27 nov.

## 1. Au point relais : je scanne, la paire entre dans le stock

**Ce qui existait déjà (et qui est gardé)** : le scanner d'arrivée (`ScannerRetrouver` en mode `arrivee`) reconnaissait
un colis d'ACHAT par son **n° de suivi** (`achatDuScan`) et ouvrait l'écran d'arrivée (`ArriveeAchat`) : N° par les
règles (`numeroArrivee` → `numerosEnSerie` / `prochainLibre`, pool écrit AVANT le geste), case, prix du **reçu**
seulement (`lignesArrivee`, source `recu`), colis noté retiré (`opsRetire`), un « Annuler » 10 s. Un achat déjà rangé
(fiche d'arrivée qui porte SON n° de transaction) dit « Déjà rangé ».

**Ajouté** :
- `achatDuRetraitScan` (src/arriveeAchat.js) : n° de suivi d'abord, puis le **code de retrait ENTIER** (≥ 4
  caractères, égalité sans séparateurs) d'un colis à retirer. Un achat ⇒ lui ; deux ⇒ la question ; un colis sans
  achat relié ⇒ « sansAchat » ; rien ⇒ « aucun ». Jamais un titre, jamais un début de code.
- Le scanner d'arrivée laisse la **caméra** lire le code de retrait (le QR / code-barres du retrait) ; avant, seule la
  saisie y avait droit. Le n° de transaction reste réservé à la saisie. Un code quelconque lu par la caméra se tait
  (indice), il n'ouvre rien.
- « aucun » et « sansAchat » disent **« À vérifier : … »**.
- Rangé ⇒ le titre du groupe devient **« Écris N°X sur la boîte »** (`data-arv-ecrire`), sauf méthode « imprimée »
  (l'étiquette) et hors ligne (aucun N° donné).
- Le scanner universel (« Ranger » sur la fiche d'un achat à retirer trouvé par son code) passe maintenant par la même
  entrée que l'arrivée : le colis est noté **retiré** dans le même geste (avant, « Ranger » oubliait le retrait).

**Deux scans** : le 2e scan du même code désigne le même achat ⇒ l'écran dit « Déjà rangé · N°… » ; aucune 2e paire.

Preuves : `scripts/audit-scan-retrait.cjs` (20 verts, `--prouve` 10/10, rouge sur origin/main), dont 2 colis au même
titre et 50 identiques. `audit-arrivee-scan` B3 et `audit-scan-achat-suite` B mis à jour (la caméra lit le code à
l'arrivée ; la transaction reste tapée).

## 2. « Ce matin »

En tête d'Aujourd'hui (au-dessus du tableau de bord), un groupe natif : une rangée par chose à faire, **dans l'ordre de
Julien** — Répondre aux acheteurs · Imprimer les bordereaux · Retirer les colis (« Ferme à HH:MM ») · Trancher les offres
· Vérifier les comptes. Une rangée ouvre son geste (Messages, impression des bordereaux, À retirer, Offres sans réponse,
écran Extension). Rien ⇒ « Rien d'urgent ». Une source pas lue n'est jamais « rien » : liste vide ⇒ « Pas encore tout
lu », liste partielle ⇒ « Pas lu : … » en pied.

⚠️ Le bandeau de l'en-tête d'Aujourdhui.jsx disait « PAS DE LISTE À FAIRE ICI » (19 nov.) : le choix du 27 nov. le
remplace pour cette liste-là (cinq lignes, pas les groupes « À régler », qui restent dans leurs onglets).

**Aucun nombre recompté** (§5) : `src/aujourdhui/ceMatin.js` range ceux de leurs propriétaires — la case « Messages »
(`xM`), les bordereaux PRÊTS (`nPrets`, le même que le disque « Imprimer »), « À retirer » (`xR`, `vrm_colis_retirer`),
« offres sans réponse » (`offresSR`), et la santé des comptes : `comptesEnVerification` (src/fiabilite/regles.js) partage
avec la carte de santé la règle `arretDeJauge` (captcha / modération / déconnecté, éteint par SON « Reprendre »).
L'heure de fermeture : les horaires lus du point (`horairesDuPoint` / `etatOuverture`), seulement s'il est ouvert.

Preuves : `scripts/audit-ce-matin.cjs` (23 verts, `--prouve` 8/8, rouge sur origin/main) ; banc
`scripts/bancs/ce-matin.cjs` (390/1512, clair/sombre ; nombres = ceux du disque « Imprimer » et de la case « À retirer »).
`aujourdhui-moins-texte` : la base sert l'extension À JOUR (elle disait « Extension ancienne » : +8 mots, rouge sur main),
budget +14 mots pour « Ce matin » ; « Saisis 2 prix › » ne déborde plus (pastille 6 px).

## Pour Julien
- Le même nombre s'écrit deux fois sur Aujourd'hui (« Imprimer les bordereaux 2 » et le disque « Imprimer 2 » ; « Retirer
  les colis 8 » et la case « À retirer 8 ») : c'est la liste qu'il a demandée, mais §7 dit « jamais deux fois ». À trancher.
- Le code lu sur le QR du point relais doit être le code de retrait lui-même : si un réseau code autre chose, le scan dit
  « À vérifier » (rien d'inventé) — le n° de suivi de l'étiquette marche toujours.
