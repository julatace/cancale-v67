# Intégration 12nov-b — trois branches du second agent (12 nov. 2026)

Branche : `claude/integration-12nov-b`, partie de `integration-12nov-a` (puis `origin/main`).
Intégrateur : le second agent. Aucune extension, aucune migration, aucune fonction `api/` de plus.

## Ce qui est réuni
`agent2-ouverture-clients` (Ouvrir les paiements, banc paiement bout en bout, export RGPD, aide client) ·
`agent2-fiabilite-prod` (sauvegarde du jour, base d'essai, surveillance, retour arrière) ·
`agent2-facture-mobile` (factures sur iPhone). Récits : `docs/passation/2026-11-12-*.md` de chaque branche.

## Conflits et rouges nés du croisement
- `api/_lib/signalement.js` : `fetchAvecDelai` par défaut ET `repondreA`.
- `api/ship-reminders.js` : `?moment=sauvegarde` passe AVANT le bail du cron ; la sauvegarde du soir est rapportée
  avec le reste (bail, reportés gardés).
- `fetch` nus apportés : `export-rgpd.js`, `sauvegarde-quotidienne.js` (l'envoi de l'export : 60 s) ⇒ `fetchAvecDelai`.
- `audit-base-essai` E1 : la migration 040 (temps réel) suppose le schéma `realtime` de Supabase ; le Postgres
  jetable des essais l'imite désormais (`scripts/sauvegarde/stub-supabase.sql`, comme `audit-temps-reel-sql`).
- Réglages : « Ouvrir les paiements » a sa propre icône (`cart`, une icône par ligne).

## Restes connus (paquets a et b)
- Banc `temps-reel` à 1512 px : après une vente écrite par l'extension, Ventes relit les ventes de TOUS les
  comptes (1,2 Mo) au lieu du seul compte touché — Ventes monte deux écrans depuis revue-colis (g2) ; 390 px vert.
  Pas dans la CI ; à reprendre (une veille commune aux deux écrans).
