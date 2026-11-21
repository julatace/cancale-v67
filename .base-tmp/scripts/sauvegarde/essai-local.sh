#!/usr/bin/env bash
# Banc local de la sauvegarde, sur un Postgres JETABLE monté dans un dossier
# temporaire (jamais la vraie base, aucune donnée réelle) :
#
#   1. une base « source » de la même forme que Supabase (stub-supabase.sql +
#      schema-exemple.sql, ou SCHEMA_SQL=<fichier> pour un autre schéma),
#      remplie de lignes INVENTÉES ;
#   2. sauvegarder.sh  → un .tar.gpg ;
#   3. essai-restauration.sh dans une base vide → doit réussir ;
#   4. les cas qui DOIVENT échouer, chacun vérifié :
#      a. mauvaise phrase                       → échec
#      b. cible distante (supabase.co)          → refusée
#      c. app_data vide à la source             → aucune copie produite
#      d. copie trafiquée (comptes gonflés)     → « hors fourchette »
#      e. phrase de moins de 20 caractères      → refusée
#      f. base cible déjà remplie               → refusée
#      g. secret SUPABASE_DB_URL absent         → refusé, le geste est dit
#
#   PG_BIN (facultatif)  dossier des outils postgres (initdb, pg_ctl…)
#   PORT   (facultatif)  10150 par défaut
set -uo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PORT:-10150}"
SCHEMA_SQL="${SCHEMA_SQL:-$ICI/schema-exemple.sql}"
B="$(mktemp -d)"
ROUGES=0
ok()   { echo "  ✓ $*"; }
ko()   { echo "  ✗ $*"; ROUGES=$((ROUGES+1)); }
# Postgres refuse de tourner sous root : le serveur jetable tourne alors sous
# l'utilisateur « postgres » de la machine.
SOUS=(); if [ "$(id -u)" = "0" ]; then SOUS=(runuser -u postgres --); fi
mkdir -p "$B/pg" "$B/sock"
if [ ${#SOUS[@]} -gt 0 ]; then chown postgres "$B/pg" "$B/sock"; chmod 755 "$B"; fi
fin()  { "${SOUS[@]}" "$PG_BIN/pg_ctl" -D "$B/pg" -m immediate stop >/dev/null 2>&1; rm -rf "$B"; }
trap fin EXIT

"${SOUS[@]}" "$PG_BIN/initdb" -D "$B/pg" -U banc --auth=trust >/dev/null || { echo "initdb impossible"; exit 2; }
"${SOUS[@]}" "$PG_BIN/pg_ctl" -D "$B/pg" -o "-p $PORT -k $B/sock -c listen_addresses=127.0.0.1" -l "$B/pg/serveur.log" -w start >/dev/null || { cat "$B/pg/serveur.log"; exit 2; }
U="postgresql://banc@127.0.0.1:$PORT"
q() { "$PG_BIN/psql" "$U/$1" -X -q -v ON_ERROR_STOP=1 "${@:2}"; }
q postgres -c "create database source" -c "create database vide_source" -c "create database jetable" -c "create database jetable2" -c "create database jetable3"

GRAINE="
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
insert into public.app_data(id, data, owner)
select f.fam || '_' || g,
       jsonb_build_object('payload', jsonb_build_object('items', jsonb_build_array(
         jsonb_build_object('title', 'Paire inventée ' || g, 'price', jsonb_build_object('amount', '42.0'))))),
       case when g % 3 = 0 then '22222222-2222-4222-8222-222222222222'::uuid else '11111111-1111-4111-8111-111111111111'::uuid end
  from (values ('harvest', 300), ('email', 200), ('coffre', 50), ('transp', 20)) f(fam, n), generate_series(1, f.n) g;
insert into public.app_data(id, data, owner) values
  ('main', '{\"inventaire\": []}', '11111111-1111-4111-8111-111111111111'),
  ('main', '{\"inventaire\": []}', '22222222-2222-4222-8222-222222222222');
insert into public.vinted_accounts(vinted_user_id, owner) values ('900001', '11111111-1111-4111-8111-111111111111'), ('900002', '22222222-2222-4222-8222-222222222222');
insert into public.abonnements(owner, statut) values ('11111111-1111-4111-8111-111111111111', 'actif');
"
q source -f "$ICI/stub-supabase.sql" >/dev/null && q source -f "$SCHEMA_SQL" >/dev/null && q source -c "$GRAINE" >/dev/null \
  || { echo "Impossible de monter la base source"; exit 2; }
q vide_source -f "$ICI/stub-supabase.sql" >/dev/null && q vide_source -f "$SCHEMA_SQL" >/dev/null

PHRASE="phrase inventée pour le banc, assez longue"
export PG_BIN
echo "Sauvegarde puis essai de restauration (schéma : $(basename "$SCHEMA_SQL"))"
if SUPABASE_DB_URL="$U/source" SAUVEGARDE_PHRASE="$PHRASE" DOSSIER_SORTIE="$B/sortie" bash "$ICI/sauvegarder.sh" > "$B/s.log" 2>&1; then
  ok "sauvegarde produite : $(ls "$B/sortie")"
else ko "la sauvegarde a échoué"; cat "$B/s.log"; fi
F="$(ls "$B"/sortie/*.tar.gpg 2>/dev/null | head -1)"
[ -n "$F" ] && ! grep -q 'Paire inventée' "$F" && ok "le fichier est chiffré (aucun texte de la base lisible dedans)" || ko "fichier absent ou lisible en clair"
[ -z "$(ls "$B/sortie" | grep -v '\.tar\.gpg$')" ] && ok "rien en clair à côté du fichier chiffré" || ko "des fichiers en clair restent dans la sortie"

if FICHIER="$F" SAUVEGARDE_PHRASE="$PHRASE" CIBLE_URL="$U/jetable" bash "$ICI/essai-restauration.sh" > "$B/r.log" 2>&1; then
  ok "restauration réussie : $(tail -1 "$B/r.log")"
else ko "la restauration a échoué"; cat "$B/r.log"; fi
N="$(q jetable -Atc "select count(*) from public.app_data")"
[ "$N" = "572" ] && ok "app_data restaurée : 572 lignes inventées sur 572" || ko "app_data restaurée : $N au lieu de 572"
P="$(q jetable -Atc "select count(*) from pg_policies where schemaname='public'") / $(q jetable -Atc "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace='public'::regnamespace and not t.tgisinternal") / $(q jetable -Atc "select count(*) from pg_constraint where contype='f' and connamespace='public'::regnamespace")"
PS="$(q source -Atc "select count(*) from pg_policies where schemaname='public'") / $(q source -Atc "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace='public'::regnamespace and not t.tgisinternal") / $(q source -Atc "select count(*) from pg_constraint where contype='f' and connamespace='public'::regnamespace")"
[ "$P" = "$PS" ] && ok "politiques / déclencheurs / clés étrangères rejoués : $P (source $PS)" || ko "politiques / déclencheurs / clés : $P au lieu de $PS"
H="$(q jetable -Atc "select md5(string_agg(owner::text||id||data::text, ',' order by owner, id)) from public.app_data")"
HS="$(q source -Atc "select md5(string_agg(owner::text||id||data::text, ',' order by owner, id)) from public.app_data")"
[ "$H" = "$HS" ] && ok "contenu de app_data identique ligne à ligne (empreinte)" || ko "contenu de app_data différent"

echo "Cas qui doivent échouer"
FICHIER="$F" SAUVEGARDE_PHRASE="mauvaise phrase de plus de vingt caractères" CIBLE_URL="$U/jetable2" bash "$ICI/essai-restauration.sh" > "$B/a.log" 2>&1 \
  && ko "a. une mauvaise phrase a déchiffré" || { grep -q 'Déchiffrement impossible' "$B/a.log" && ok "a. mauvaise phrase : refusée" || { ko "a. échec, mais pas pour la bonne raison"; cat "$B/a.log"; }; }
FICHIER="$F" SAUVEGARDE_PHRASE="$PHRASE" CIBLE_URL="postgresql://postgres.abc:x@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" bash "$ICI/essai-restauration.sh" > "$B/b.log" 2>&1 \
  && ko "b. une cible distante a été acceptée" || { grep -q 'Cible refusée' "$B/b.log" && ok "b. cible distante : refusée avant toute connexion" || ko "b. mauvaise raison"; }
FICHIER="$F" SAUVEGARDE_PHRASE="$PHRASE" CIBLE_URL="postgresql://u@localhost.supabase.co:5432/postgres" bash "$ICI/essai-restauration.sh" > "$B/b2.log" 2>&1 \
  && ko "b2. un hôte « localhost.supabase.co » a été accepté" || { grep -q 'Cible refusée' "$B/b2.log" && ok "b2. « localhost.supabase.co » : refusé" || ko "b2. mauvaise raison"; }
SUPABASE_DB_URL="$U/vide_source" SAUVEGARDE_PHRASE="$PHRASE" DOSSIER_SORTIE="$B/sortie-vide" bash "$ICI/sauvegarder.sh" > "$B/c.log" 2>&1 \
  && ko "c. une base vide a été sauvegardée" || { [ -z "$(ls "$B/sortie-vide" 2>/dev/null)" ] && grep -q '0 ligne' "$B/c.log" && ok "c. app_data vide : aucune copie produite" || ko "c. mauvaise raison ou fichier produit"; }

# d. Copie trafiquée : on gonfle de 5 la famille « email » dans les deux comptes.
mkdir "$B/d" && export GNUPGHOME="$B/gpg" && mkdir -m 700 "$GNUPGHOME"
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$F" 3<<<"$PHRASE" | tar -C "$B/d" -xf -
DD="$(ls -d "$B"/d/vrm-sauvegarde-*)"
sed -i -E 's/^(app_data\|email\|)([0-9]+)$/echo "\1$((\2+5))"/e' "$DD/comptes-avant.txt" "$DD/comptes-apres.txt"
grep -q '^app_data|email|205$' "$DD/comptes-avant.txt" || ko "d. la falsification du banc n'a pas pris"
tar -C "$B/d" -cf "$B/d.tar" "$(basename "$DD")"
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 -o "$B/d.tar.gpg" "$B/d.tar" 3<<<"$PHRASE"
FICHIER="$B/d.tar.gpg" SAUVEGARDE_PHRASE="$PHRASE" CIBLE_URL="$U/jetable3" bash "$ICI/essai-restauration.sh" > "$B/d.log" 2>&1 \
  && ko "d. 5 lignes manquantes n'ont pas été vues" || { grep -q 'HORS FOURCHETTE : app_data|email' "$B/d.log" && ok "d. 5 lignes manquantes dans « email » : vues, essai en échec" || { ko "d. mauvaise raison"; cat "$B/d.log"; }; }

SUPABASE_DB_URL="$U/source" SAUVEGARDE_PHRASE="courte" DOSSIER_SORTIE="$B/sortie-e" bash "$ICI/sauvegarder.sh" > "$B/e.log" 2>&1 \
  && ko "e. une phrase courte a été acceptée" || { grep -q 'moins de 20' "$B/e.log" && ok "e. phrase courte : refusée" || ko "e. mauvaise raison"; }
FICHIER="$F" SAUVEGARDE_PHRASE="$PHRASE" CIBLE_URL="$U/jetable" bash "$ICI/essai-restauration.sh" > "$B/f.log" 2>&1 \
  && ko "f. restauration empilée sur une base remplie" || { grep -q "n'est pas vide" "$B/f.log" && ok "f. base cible déjà remplie : refusée" || ko "f. mauvaise raison"; }
env -u SUPABASE_DB_URL SAUVEGARDE_PHRASE="$PHRASE" DOSSIER_SORTIE="$B/sortie-g" bash "$ICI/sauvegarder.sh" > "$B/g.log" 2>&1 \
  && ko "g. sauvegarde lancée sans URL" || { grep -q 'Settings → Secrets' "$B/g.log" && ok "g. secret absent : refusé, le geste est dit" || ko "g. mauvaise raison"; }

echo
[ "$ROUGES" -eq 0 ] && echo "VERT — sauvegarde, chiffrement, restauration et garde-fous vérifiés." || echo "ROUGE — $ROUGES contrôle(s) en échec."
exit "$ROUGES"
