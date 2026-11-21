#!/usr/bin/env bash
# Sauvegarde chiffrée du schéma public de la base VRM (Supabase).
#
#   SUPABASE_DB_URL     URL de connexion (pooler « Session », port 5432) — secret
#   SAUVEGARDE_PHRASE   phrase de chiffrement (20 caractères ou plus) — secret
#   DOSSIER_SORTIE      où poser le fichier chiffré (créé au besoin)
#   PG_BIN              (facultatif) dossier des outils PostgreSQL à la version du serveur
#
# Ce que fait le script, dans l'ordre, et rien d'autre :
#   1. compte les lignes (table, et famille d'id dans app_data) — LECTURE SEULE ;
#   2. pg_dump du schéma public (structure + données), format « custom » ;
#   3. recompte (la base vit pendant la copie : la restauration devra tomber
#      entre les deux comptes, famille par famille) ;
#   4. emballe la copie, les deux comptes et une fiche (dates, versions, empreinte) ;
#   5. chiffre (gpg, AES-256, phrase lue par un descripteur, jamais sur la ligne
#      de commande), PUIS relit le chiffré avec la phrase et compare l'empreinte ;
#   6. efface tout ce qui est en clair. Seul `vrm-sauvegarde-*.tar.gpg` reste.
#
# Aucune écriture sur la base : pg_dump ne fait que lire, compter.sql ouvre une
# transaction en lecture seule. Rien de la base n'est écrit dans le journal
# (le dépôt est PUBLIC, les journaux d'Actions aussi) : ni l'URL, ni une ligne,
# ni un compte par famille — seulement des totaux et des états.
set -euo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_BIN="${PG_BIN:-}"; [ -n "$PG_BIN" ] && PG_BIN="${PG_BIN%/}/"

stop() { echo "::error::$*" >&2; exit 1; }

[ -n "${SUPABASE_DB_URL:-}" ] || stop "Le secret SUPABASE_DB_URL est absent. Geste : GitHub → le dépôt → Settings → Secrets and variables → Actions → New repository secret (voir docs/passation/2026-11-06-sauvegarde-prix.md)."
[ -n "${SAUVEGARDE_PHRASE:-}" ] || stop "Le secret SAUVEGARDE_PHRASE est absent : sans lui la copie partirait en clair sur un dépôt public. Rien n'est sauvegardé."
[ "${#SAUVEGARDE_PHRASE}" -ge 20 ] || stop "SAUVEGARDE_PHRASE fait moins de 20 caractères : trop courte pour protéger une copie posée sur un dépôt public."
[ -n "${DOSSIER_SORTIE:-}" ] || stop "DOSSIER_SORTIE absent."

mkdir -p "$DOSSIER_SORTIE"
TRAVAIL="$(mktemp -d)"
export GNUPGHOME="$(mktemp -d)"; chmod 700 "$GNUPGHOME"
nettoyer() { rm -rf "$TRAVAIL" "$GNUPGHOME"; }
trap nettoyer EXIT

JOUR="$(date -u +%Y-%m-%dT%H%MZ)"
NOM="vrm-sauvegarde-$JOUR"
mkdir "$TRAVAIL/$NOM"
D="$TRAVAIL/$NOM"

compter() { "${PG_BIN}psql" "$SUPABASE_DB_URL" -X -q -f "$ICI/compter.sql" | sed '/^$/d' | sort; }

compter > "$D/comptes-avant.txt" || stop "Lecture des comptes impossible (URL, mot de passe ou réseau) : rien n'est sauvegardé."
TOTAL_APP="$(awk -F'|' '$1=="app_data" && $2=="*" {print $3}' "$D/comptes-avant.txt")"
# « Une liste vide n'est jamais une réponse » : une base qui répond 0 ligne
# n'est pas une base à sauvegarder par-dessus les bonnes copies.
[ -n "$TOTAL_APP" ] && [ "$TOTAL_APP" -gt 0 ] || stop "app_data rend 0 ligne : base vide ou mauvaise base. Aucune copie n'est faite (elle remplacerait les bonnes dans 30 jours)."
grep -q '^app_data|main|' "$D/comptes-avant.txt" || stop "Aucune ligne « main » dans app_data : ce n'est pas la base VRM attendue."

"${PG_BIN}pg_dump" "$SUPABASE_DB_URL" --schema=public --format=custom --compress=6 \
  --no-owner --no-acl --no-subscriptions --no-publications \
  --file="$D/public.dump" || stop "pg_dump a échoué : rien n'est sauvegardé."

compter > "$D/comptes-apres.txt" || stop "Recompte impossible après la copie."

# La copie doit se relire (table des matières) et contenir la table app_data.
"${PG_BIN}pg_restore" --list "$D/public.dump" > "$TRAVAIL/toc.txt" || stop "La copie ne se relit pas."
grep -q 'TABLE DATA public app_data ' "$TRAVAIL/toc.txt" || stop "La copie ne contient pas les données de app_data."

{
  echo "date_utc=$JOUR"
  echo "pg_dump=$("${PG_BIN}pg_dump" --version)"
  echo "serveur=$("${PG_BIN}psql" "$SUPABASE_DB_URL" -X -Atc 'show server_version')"
  echo "serveur_majeur=$("${PG_BIN}psql" "$SUPABASE_DB_URL" -X -Atc 'show server_version_num' | cut -c1-2)"
  echo "sha256_dump=$(sha256sum "$D/public.dump" | cut -d' ' -f1)"
  echo "octets_dump=$(stat -c %s "$D/public.dump")"
} > "$D/fiche.txt"

tar -C "$TRAVAIL" -cf "$TRAVAIL/$NOM.tar" "$NOM"
SORTIE="$DOSSIER_SORTIE/$NOM.tar.gpg"
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
    --symmetric --cipher-algo AES256 --s2k-digest-algo SHA512 --s2k-mode 3 --s2k-count 65011712 \
    --compress-algo none --output "$SORTIE" "$TRAVAIL/$NOM.tar" 3<<<"$SAUVEGARDE_PHRASE" \
  || stop "Chiffrement impossible : rien n'est gardé."

# Relire le chiffré AVEC la phrase : un fichier qu'on ne sait pas rouvrir n'est
# pas une sauvegarde.
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$SORTIE" 3<<<"$SAUVEGARDE_PHRASE" \
  | sha256sum | cut -d' ' -f1 > "$TRAVAIL/relu.sha"
[ "$(cat "$TRAVAIL/relu.sha")" = "$(sha256sum "$TRAVAIL/$NOM.tar" | cut -d' ' -f1)" ] \
  || { rm -f "$SORTIE"; stop "Le fichier chiffré ne se relit pas à l'identique : copie jetée."; }

NFAM="$(grep -c '^app_data|' "$D/comptes-avant.txt")"
echo "Sauvegarde faite : $(basename "$SORTIE") — $(stat -c %s "$SORTIE") octets chiffrés, app_data en $((NFAM - 1)) familles d'id, relue avec la phrase."
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "fichier=$SORTIE" >> "$GITHUB_OUTPUT"
  echo "nom=$NOM" >> "$GITHUB_OUTPUT"
fi
