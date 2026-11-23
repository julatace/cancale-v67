# 17 nov. 2026 — La carte de la Communauté : le coucou remplace les messages (branche `claude/carte-coucou`)

Julien (17 nov.), la même règle que pour les groupes : « que les personnes puissent se
faire coucou, mais pas échanger des messages dans mon app, mais sur Discord ».

## Ce qui change
- **Plus aucun message dans VRM.** La carte n'a plus de « Écrire », de fil, de premier
  message ni de carte « Messages · N non lus ». La route refuse `ecrire`, `fil`,
  `bloquer`, `signaler` (410 « Les messages se font sur Discord »), ne lit plus les
  conversations (plus aucun « non lu », donc plus aucune alerte des anciens messages).
- **Le « 👋 Coucou » de la carte** est le même signe que dans les groupes : un toucher,
  aucun texte (la requête ne porte que le `pid` public). Celui qui le reçoit voit
  « Coucous » sur la carte avec UN geste : « Lui écrire sur Discord » (le profil Discord
  signé de l'auteur), sinon « Pas de Discord lié ». Notification « Coucous de la
  communauté » (« … t'a fait coucou · Sur la carte de VRM »). « ⋯ » ⇒ ne plus recevoir
  ses coucous. Mêmes bornes que les groupes, **comptées ensemble** : une paire par 24 h
  (dans un sens ou l'autre, groupe ou carte), 20 par jour ; un blocage d'avant (018)
  empêche aussi le coucou.
- **L'historique est gardé** : ⚠️ les conversations et messages d'avant existent toujours
  en base (`vrm_communaute_conversations`, `vrm_communaute_messages`, migration 018) —
  rien n'est effacé, l'app ne les montre plus.

## Base : migration `supabase/migrations/047-communaute-carte-coucou.sql` — **PAS APPLIQUÉE**
Exige la 018 **et la 046**. Une table `vrm_communaute_coucous` (id, de, à, quand — aucun
texte ; un coucou de la 046 appartient à un groupe, la carte n'en a pas), RLS forcé, règle
de lecture « seuls les deux ». Réutilise `vrm_accomp_sourdines` (046) pour « ne plus
recevoir » et les blocages de la 018. 8 fonctions (deux réservées à la clé de service).
**Retire le droit d'exécuter `vrm_communaute_ecrire` aux navigateurs** (plus aucun message
ne s'écrit, même en contournant l'app). Aucune suppression ; essai en fin de fichier.
Sans elle : « Coucou : bientôt » sur la carte, et jamais de repli vers un message (la
route bloque déjà l'écriture).

## Preuves
- `audit-carte-coucou-sql` — la 047 exécutée sur un Postgres jetable (socle + 018-020,
  025, 046) : 40 verts ; `--prouve` 12/12.
- `audit-coucou` (route et écrans, groupes + carte) : 76 verts ; `--prouve` 16/16 (dont
  un champ de message remis sur la carte, `ecrire` rouvert, un texte relayé, un repli
  vers un message sans la 047).
- Banc `scripts/bancs/communaute-sans-message.cjs` (BANC_PORT 7993) : voir la PR.

## Gestes de Julien
1. D'abord la **046** (passation `2026-11-17-groupes-coucou.md`), puis la **047** :
   Supabase → SQL Editor → coller `supabase/migrations/047-communaute-carte-coucou.sql`
   d'un bloc → Run ⇒ notice « ESSAI OK : coucou de la carte sans texte (8 fonctions),
   plus aucun message écrit, l'historique gardé ».
2. Relier son Discord (Paramètres → Mon compte) pour que ses coucous ouvrent son profil.

## Ce qui reste
- Bloquer quelqu'un sur la carte n'a plus de bouton (il passait par la conversation) :
  « Ne plus recevoir ses coucous » le remplace ; les blocages d'avant restent actifs.
- Les annonces de l'espace formateur (032, pas appliquée) sont des messages du formateur
  à son groupe : à trancher par Julien si la règle s'applique aussi.
