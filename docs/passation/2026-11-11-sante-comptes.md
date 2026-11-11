# 11 novembre 2026 — La santé de chaque compte Vinted (lot `sante-comptes`)

Branche `claude/sante-comptes` (partie d'`origin/main`), poussée à chaque commit, **aucune
PR, aucune fusion**. Demande de Julien (validée) : pour CHAQUE compte Vinted, un état simple
« En forme » / « À surveiller » avec LA raison et LE geste, chaque point lisible, jamais de
note inventée ni de score opaque. **Aucune modification de l'extension.**

## Ce qui est livré

| où | quoi |
|---|---|
| `src/santeComptes.js` | **la règle pure** : 7 indicateurs, seuils écrits (`SEUILS`), ordre des raisons (`ORDRE`), gestes (`GESTES`), et la publication `vrm_sante_envois` (`lignesEnvois`, `publierEnvois`, `lireEnvois`) |
| `src/SanteComptes.jsx` | l'écran : lectures (projections, jamais `select=data`), `useSanteComptes`, la carte / le panneau, `titreJournee`, `texteRaison` |
| `src/styles-sante-comptes.css` | neutre ; **ambre** seulement pour « À surveiller », sa raison et la valeur qui passe son seuil ; jamais rouge ni vert |
| `src/ecrans/Reglages.jsx` | Paramètres → Mes comptes → **Santé des comptes** (`id:'santecomptes'`, lien `?tab=settings&section=santecomptes`) |
| `src/ecrans/Stats.jsx` | une carte **Santé des comptes** sous « Vitesse d'envoi » |
| `src/App.jsx` | (1) la publication des envois, dans l'effet qui publie déjà `vrm_vitesse_envoi` (même propriétaire : `Comptabilite`) ; (2) Ma journée : la carte `sante-comptes` **seulement quand un compte glisse** ; (3) le lien `section=santecomptes` |
| `src/journeePerso.js` | la carte `sante-comptes` au catalogue (« Modifier ma journée » peut la cacher) |
| `src/i18n/langues/*.js` | ~70 clés `sante.*`, `reglages.santecomptes.*` en fr, en, es, it, de |
| `src/nouveautes.js` | « La santé de chaque compte Vinted » |
| `scripts/audit-sante-comptes.cjs` | 39 contrôles sur la VRAIE règle + le code ; `--prouve` : 6/6 mutations rougissent |
| `scripts/bancs/sante-comptes.cjs` | rendu 390 tactile / 1512, clair / sombre, + scénario « tout va bien » |

## La règle (seuils montrés à l'écran, sous « Pourquoi ? »)

| point | valeur | tendance (30 j contre les 30 j d'avant) | « À surveiller » si | source |
|---|---|---|---|---|
| Note Vinted | la note AFFICHÉE par Vinted (`feedback_reputation` ×5) et le nombre d'avis (`notesParCompte`) | moyenne de la page lue au point d'historique d'il y a 30-60 j contre la dernière (`avishisto`, 5.340) ; « +N avis » | < 4,5/5 | `harvest_{uid}_profile`, `harvest_{uid}_feedbacks.historique` |
| Avis bas récents | avis de 3★ ou moins parmi les **10 plus récents lus** | les 10 récents contre les 10 d'avant (⚠️ Vinted ne date pas les avis : jamais « ce mois ») | ≥ 2 | `harvest_{uid}_feedbacks.user_feedbacks` |
| Délai d'envoi | médiane vente ⇒ dépôt PROUVÉ, ventes des 30 j | médiane des 30 j d'avant (dès 3 colis) | > 3 j, dès 3 colis datés | `vrm_sante_envois` (= `lignesVitesse`, règle `raisonDepartVente`) |
| Après la date limite | colis partis APRÈS la limite **lue dans l'e-mail du bordereau** (30 j) + colis encore à poster après leur limite lue | même compte sur les 30 j d'avant | ≥ 2, ou 1 encore à poster | `vrm_sante_envois` (`lireDateLimite`) ; **une limite estimée ne compte jamais** (api/_lib/limite-envoi.js) |
| Ventes annulées | annulées / ventes (30 j, date de la vente) | annulées des 30 j d'avant | ≥ 3, ou ≥ 10 % dès 5 ventes | ventes de la coque, `classifyOrderStatus` ; ⚠️ **Vinted ne dit pas qui a annulé** : toutes comptent, et c'est écrit |
| Modération | banni · restreint (< 7 j) · annonces masquées ouvertes (30 j) | événements des 30 j d'avant | banni, restreint ou masquée | `panel_comptes_etat` ; `moderation_vinted_{uid}` **si la ligne existe** |
| Dernière lecture | âge de la lecture du profil | — | **jamais une alerte** (« à relire » au-delà de 48 h) | `capturedAt` du profil |

- **État** : « À surveiller » dès qu'UN point LU passe son seuil ; LA raison = la première dans
  l'ordre modération → retards → annulations → avis bas → note → délai, « +N autres points » ;
  « En forme » seulement si **3 points au moins sont lus** dont la note ou le délai ; sinon
  « Pas assez lu ». **Un point pas lu ne fait ni l'un ni l'autre** (« — » + raison + geste).
- **Ma journée** : une carte `sante-comptes` (point ambre `is-urgent`, la forme des autres
  gestes) seulement s'il y a un compte « À surveiller » ; « Voir » mène au geste de LA raison
  (`?tab=ventes` pour retards/délai, `?tab=stats` pour avis/note/annulations, Paramètres pour la
  modération) ; plusieurs comptes ⇒ « N comptes à surveiller » vers Paramètres.
- **Pas de nouvelle notification** (demande) ; aucune écriture en base ; la seule écriture est
  la publication locale `vrm_sante_envois` (localStorage de l'appareil, estampillée du compte
  VRM, même forme que `vrm_vitesse_envoi`).
- Colis : rien n'est touché dans les écrans Colis ; la publication est posée dans l'effet
  « vitesse d'envoi » du même écran propriétaire (lecture de `bordsParTxn`, `estParti`, `aExpedier`).

## Décisions prises seul (règle : trancher et l'écrire)

1. **« Annulées par toi »** : impossible à prouver (l'état lu ne dit pas qui annule — cherché dans
   tout le code, aucune donnée). J'ai compté **toutes** les annulations et l'écran le dit. Pour faire
   mieux, il faudrait que l'extension garde un champ « annulée par » s'il existe dans la transaction
   (non mesuré) — noté, pas fait (pas d'extension dans ce lot).
2. **Avis négatifs récents** : le lot `avis-negatif` (pas encore sur `main`) range `vrm_avis_bas`
   côté serveur. Je ne m'y appuie PAS (absent de `main`) : je compte sur la page des 20 derniers
   avis déjà lue. Quand `avis-negatif` sera fusionné, rien ne casse (aucune dépendance).
3. **Modération** : `moderation_vinted_{uid}` (lot `alerte-moderation`, pas encore sur `main`) est
   lue **si elle existe** (projection `data->e`) ; sinon seul « banni » du profil compte.
4. **Seuils** : 4,5/5 ; 2 avis bas sur 10 ; 3 j de médiane ; 2 retards ; 3 annulations ou 10 % ;
   restreint < 7 j. Une seule source (`SEUILS`), montrée telle quelle sous « Pourquoi ? ».
5. **La publication** vit dans `Comptabilite` (Ma journée / Ventes) : une Statistiques ouverte
   sans être passé par Ma journée dit « Envois pas encore relus : ouvre Ma journée une fois »
   (mesuré au banc : l'onglet Ventes « Tous » ne monte pas cet écran, Ma journée oui).

## Preuves

- `npm run build` vert.
- `node scripts/audit-sante-comptes.cjs` : **39 verts** ; `--prouve` : **6/6 mutations** rougissent
  (limite estimée comptée en retard, « pas su » qui alerte, seuil de note, ordre des raisons,
  fenêtre de 30 j, « en forme » sans lecture). Sur `origin/main` l'audit est rouge (la règle n'existe pas).
- Audits voisins verts : `traduction`, `quoi-de-neuf`, `journee-perso`, `icones`, `notes-recues`,
  `annulations-compte`, `fonctions-api` (`coherence` : même rouge d'environnement que `main`,
  historique git superficiel). Tous les audits : voir la fin de ce récit.
- Banc `scripts/bancs/sante-comptes.cjs` vert à 390 tactile et 1512, clair et sombre : la
  publication porte la limite LUE (jamais l'estimée), Statistiques (compte_a « En forme »,
  compte_b « À surveiller » — 2 colis après la date limite, +2 autres points), « Pourquoi ? »
  (7 points, valeurs, seuils, sources, « — » + raison), Paramètres, Ma journée (une ligne, point
  ambre), cibles 44 px, aucun débordement, aucun rouge, aucune écriture, aucune erreur ;
  « tout va bien » ⇒ deux comptes « En forme » et **aucune** ligne dans Ma journée.
- Captures **regardées** (clair/sombre, 390/1512) : « Voir » s'affichait en bouton gris bordé ⇒
  corrigé en lien (styles du lien de l'app), recapturé.

## Pour la suite (non faits, notés)

- Extension (une version réservée ailleurs, rien touché ici) : garder « annulée par » si la
  transaction le dit ; dater les avis si Vinted les date un jour.
- Brancher `vrm_avis_bas` (lot avis-negatif) une fois fusionné, pour un « avis bas » daté par
  l'arrivée (le serveur sait quand il l'a vu) ; la règle a sa place (`indicAvisBas`).
