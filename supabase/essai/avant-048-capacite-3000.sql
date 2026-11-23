-- Avant 048 sur la base d'essai (20 nov., chasse-bugs) : 048 indexe et purge
-- `sauvegarde.journal_ecritures`, la table que remplit le garde-fou des écritures
-- (014-agent.sql, `insert into sauvegarde.journal_ecritures(...)`). Sur la vraie base
-- elle a été créée À LA MAIN (aucune migration ne la crée) ; ici, sur une base vide,
-- on la pose sous la même forme (colonnes relevées sur la vraie base le 20 nov.).
create schema if not exists sauvegarde;
create table if not exists sauvegarde.journal_ecritures (
  at timestamptz default now(),
  role text,
  uid uuid,
  tbl text,
  row_id text,
  op text,
  agent text
);
