# 5 novembre 2026 — Communauté : les groupes d'accompagnement « comme Skool » (branche `v31-communaute-groupes`)

Demande de Julien (pages manuscrites §14 et vocal, `docs/passation/demandes-2026-11-05.md`) :
« qui veut peut créer un groupe pour les membres de son accompagnement : un code ou
un lien d'invitation ; le créateur valide l'accès de chaque personne ; carré, pro,
simple. Si le membre l'accepte, le créateur voit l'évolution de ses ventes et achats
(les chiffres seuls) ; le détail seulement si le membre l'autorise » — « un peu comme Skool ».

## Ce qui existait (mesuré avant de coder, base en LECTURE seule)
- Migrations 018 (carte), 019 (Discord, classement), 020 (groupes à code) **appliquées**
  le 20 oct. : 7 tables `vrm_communaute_*`, 22 fonctions. Écran Communauté (Carte ·
  Classement), Discord relié au compte.
- Les groupes de la 020 sont des groupes de **comparaison** : rattachés à la présence
  PUBLIQUE sur la carte (`pid`, pseudo, ville), on y entre seul, sans validation, et
  tous les membres se voient au classement. **0 groupe, 0 membre** en base le 5 nov.
- Aucun agrégat d'ACHATS publié par l'app (les ventes, oui : `vrm_benefice_jours`).

## Ce qui est fait
### Migration `supabase/migrations/025-communaute-accompagnement.sql` — **PAS APPLIQUÉE**
- Trois tables neuves (`vrm_accomp_groupes`, `vrm_accomp_membres`, `vrm_accomp_partages`),
  RLS activé ET forcé, aucune règle, aucun droit (ni `authenticated`, ni `anon`, ni
  `service_role`) ; tout passe par des fonctions SECURITY DEFINER qui prennent
  l'identité dans le jeton. Refusée sans la 006 et la 020 ; empreinte des tables
  (`a49fae71…`) ; rejouable ; **aucune suppression** dans le fichier (se colle d'un bloc).
- On ne réutilise pas les tables de la 020 (exigeraient la carte publique) mais on
  s'appuie dessus : `vrm_acces_pour` (abonnement), `vrm_communaute_code_lu` (code tapé),
  même alphabet de code, et un code n'est jamais celui d'un groupe de la 020.
- **Entrer = DEMANDER** (`attente`) ; le créateur accepte / refuse / retire ; le membre
  part. 5 groupes ouverts créés, 20 adhésions, 200 membres et 100 demandes par groupe.
- **Le partage, choisi par le membre, PAR DÉFAUT RIEN** : `rien` · `chiffres` (semaine,
  mois : nombre de ventes, vendu, nombre d'achats, dépensé) · `detail` (en plus : chaque
  vente et chaque achat — article, prix, compte, date). Révocable à tout moment :
  `vrm_accomp_elaguer` **efface** de la base ce que le niveau ne permet plus (pas
  seulement caché), aussi au retrait, au départ, à la fermeture du groupe.
- **La base ne lit AUCUNE donnée du membre** (ni `app_data`, ni `vinted_accounts`) :
  les chiffres viennent de `vrm_accomp_partages`, que SEULE l'app du membre remplit
  (`vrm_accomp_publier`), forme stricte vérifiée (entiers ≥ 0, clés connues, 110
  semaines / 36 mois, 300 lignes de détail, 256 Ko), le détail JETÉ s'il n'est pas permis.
- **Une règle pour « ce que voit le créateur »** : `vrm_accomp_vue(adhésion)` ; le
  membre lit la MÊME (`vrm_accomp_ce_que_voit`). Chiffres seulement d'un membre
  ACCEPTÉ ; clé `chiffres` présente et `null` = permis mais pas encore publié (jamais 0).
- « Fermer mon compte » : `vrm_accomp_effacer` (clé de service) vide ses partages,
  détache ses adhésions et ses groupes (identifiant tiré au hasard), ferme ses groupes.

### Route — `api/compte.js?mode=communaute` (aucune fonction ajoutée, toujours 12)
`api/_lib/accompagnement.js`, branché dans `api/_lib/communaute.js` (`action: 'accomp-…'`) :
lire, aperçu d'un code, créer, demander, décider, retirer, nouveau code, fermer, quitter,
partage, « ce que voit le créateur », publier. Jeton de l'APPELANT, jamais la clé de
service. 025 absente ⇒ **503 `non-installe`** (« Les groupes d'accompagnement ne sont
pas encore activés sur ta base. ») ; panne ⇒ 503 `pas-su`. Un partage absent part
« rien » ; un partage inconnu est refusé avant la base. `effacerCommunaute` appelle aussi
`vrm_accomp_effacer` (`null` s'il ne répond pas : la fermeture n'est pas dite faite).

### L'app
- **Communauté → onglet « Groupes »** (`src/communaute/Accompagnement.jsx`) : Créer un
  groupe (nom, description, son nom) ; code lisible ABCD-2345, « Copier le lien »,
  « Copier le code », « Nouveau code » (l'ancien code et l'ancien lien ne marchent plus) ;
  demandes à valider (étiquette **ambre** « N à valider », un geste à faire) ; membres
  (partage de chacun, « Voir », « Retirer ») ; « Fermer le groupe ». Côté membre :
  statut, choix du partage (trois options expliquées), « Voir ce que voit {créateur} »,
  « Quitter ». La vue : tableau par mois / par semaine (ventes, vendu, achats, dépensé),
  une moitié jamais publiée ⇒ « — » ; le détail en liste.
- **Le lien d'invitation** `https://vrm.center/?tab=communaute&groupe=CODE` : l'app garde
  le code (sessionStorage `vrm_accomp_lien`) avant de nettoyer l'adresse ; Communauté
  s'ouvre sur Groupes, aperçu du groupe affiché AVANT de demander, « Rien » coché.
- **Tant que la 025 n'est pas appliquée** : l'onglet dit « pas encore activés sur ta
  base » et ne montre aucun bouton.
- **Ce que l'app publie** (`src/communaute/accompagnement.js`, §11 — aucune règle refaite) :
  ventes = `vrm_benefice_jours` (écran Ventes : finalisées, toutes plateformes, jour de
  la vente) ; achats = **`vrm_achats_jours`** (nouveau, synchronisé : la règle de
  « Dépensé » d'Achats — Vinted, hors annulés — publiée jour par jour par l'écran Achats)
  ; détail = `vrm_stats_ventes` + **`vrm_achats_releve`** (nouveau, cet appareil, 300
  plus récents). Le niveau rendu par la base est rangé (`vrm_accomp_niveau`) ; AppCoeur
  (`ecouterPartage`) republie quand un agrégat change, seulement si le niveau ≥ 1, et
  seulement si le contenu a changé (`vrm_accomp_signature`).
- L'ancien bloc de la 020 s'appelle maintenant « Groupe de comparaison » (renvoie à l'onglet Groupes).

## Preuves
- `node scripts/audit-accompagnement-sql.cjs` — la 025 EXÉCUTÉE sur un Postgres jetable
  (socle 005-007 + 018-020 telles quelles) : **94 verts** ; `--prouve` **16/16 mutations**
  attrapées (chiffres sans partage, détail au niveau chiffres, chiffres avant validation,
  validation par un autre, entrée sans validation, révocation sans effacement, détail
  rangé sans permission, forme libre, compte rendu, retiré visible, défaut « chiffres »,
  table lisible, anon, code inchangé, « fermer mon compte » qui garde, création sans abonnement).
- `node scripts/audit-accompagnement.cjs` — module de l'app et VRAIE route exécutés :
  **35 verts** ; `--prouve` **7/7**.
- Banc de rendu `scripts/bancs/communaute-groupes.cjs` (BANC_PORT 7987, le vrai
  `api/compte.js`, faux PostgREST aux règles de la 025, données inventées) — 1512 clair,
  1512 sombre, 390 tactile sombre, 390 tactile clair : **45 verts** ; sur le build
  d'avant (archive de 85dad5b0, banc copié dedans) **11 rouges** (pas d'onglet
  Groupes) ; `BANC_MUTATION=chiffres-sans-partage` 3 rouges, `revoquer-garde` 1,
  `sans-validation` 4. Captures regardées (création, aperçu du lien, demande ambre,
  « ce que voit », détail, retiré). Le banc de la carte `communaute.cjs` reste vert (176).
- `audit-communaute-sql` (206), `audit-fermer-compte` (36), `audit-fonctions-api` verts.

## Gestes de Julien
1. **Appliquer la 025** (SQL Editor de Supabase, coller le fichier d'un bloc, VRM peu
   sollicité). Vérifier : `select count(*) from pg_proc where proname like 'vrm\_accomp\_%'`
   ⇒ 22 ; les trois tables `vrm_accomp_*` avec RLS forcé.
2. Ouvrir Communauté → Groupes, créer son groupe, s'envoyer le lien depuis un autre compte.
3. Ouvrir Ventes et Achats une fois (les agrégats d'achats se publient à la lecture).

## Ce qui reste
- Pas de notification au créateur quand une demande arrive (la pastille ambre est dans
  l'onglet seulement) ni au membre quand il est accepté.
- Les achats partagés sont les achats **Vinted** (la règle de « Dépensé ») ; les achats
  hors Vinted et Leboncoin/eBay ne sont pas dans « Achats / Dépensé » du partage.
- Le détail ne part que d'un appareil qui a lu Ventes (relevé `vrm_stats_ventes` local).
- Pas de discussion de groupe ni de fil d'annonces « à la Skool » : seulement l'accès
  validé et le partage de chiffres demandés.
