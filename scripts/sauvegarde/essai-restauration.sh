#!/usr/bin/env bash
# Essai de restauration d'une sauvegarde VRM dans une base Postgres JETABLE.
#
#   FICHIER             le fichier `vrm-sauvegarde-*.tar.gpg`
#   SAUVEGARDE_PHRASE   la phrase de chiffrement — secret
#   CIBLE_URL           base jetable VIDE (localhost / 127.0.0.1 seulement)
#   PG_BIN              (facultatif) dossier des outils PostgreSQL
#   GARDER_DOSSIER      (facultatif) où laisser la copie déchiffrée (restauration
#                       à la main) ; sinon tout est effacé à la fin.
#
# Déchiffre, vérifie l'empreinte de la copie, prépare la base nue (rôles et
# schéma auth de Supabase, stub-supabase.sql), restaure structure + données,
# pose les propriétaires, rejoue les contraintes / politiques / déclencheurs,
# puis compte les lignes famille par famille : chaque compte restauré doit
# tomber entre le compte d'AVANT et celui d'APRÈS la copie. Sinon : échec.
#
# Ce script REFUSE toute cible qui n'est pas sur cette machine : il ne peut pas
# écrire sur Supabase. Le journal ne dit que des états et les noms des familles
# en écart (jamais un contenu, jamais un compte par famille : dépôt public).
set -euo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_BIN="${PG_BIN:-}"; [ -n "$PG_BIN" ] && PG_BIN="${PG_BIN%/}/"
stop() { echo "::error::$*" >&2; exit 1; }

[ -n "${FICHIER:-}" ] && [ -f "$FICHIER" ] || stop "Fichier de sauvegarde introuvable."
[ -n "${SAUVEGARDE_PHRASE:-}" ] || stop "SAUVEGARDE_PHRASE absente : impossible de déchiffrer."
[ -n "${CIBLE_URL:-}" ] || stop "CIBLE_URL absente."

# Garde-fou : la cible est une base de CETTE machine, jamais la vraie base.
HOTE="$(printf '%s' "$CIBLE_URL" | sed -E 's#^[a-z]+://##; s#^[^@]*@##; s#[:/?].*$##')"
case "$HOTE" in
  localhost|127.0.0.1|::1|"[::1]") ;;
  *) stop "Cible refusée ($HOTE) : l'essai ne restaure que dans une base jetable de cette machine (localhost)." ;;
esac
case "$CIBLE_URL" in *supabase*) stop "Cible refusée : une URL Supabase n'est jamais une base jetable." ;; esac

TRAVAIL="$(mktemp -d)"
export GNUPGHOME="$(mktemp -d)"; chmod 700 "$GNUPGHOME"
nettoyer() { rm -rf "$TRAVAIL" "$GNUPGHOME"; }
trap nettoyer EXIT

gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$FICHIER" 3<<<"$SAUVEGARDE_PHRASE" \
  > "$TRAVAIL/copie.tar" 2>/dev/null || stop "Déchiffrement impossible : mauvaise phrase ou fichier abîmé."
tar -C "$TRAVAIL" -xf "$TRAVAIL/copie.tar"
D="$(find "$TRAVAIL" -mindepth 1 -maxdepth 1 -type d -name 'vrm-sauvegarde-*' | head -1)"
[ -n "$D" ] && [ -f "$D/public.dump" ] && [ -f "$D/fiche.txt" ] || stop "Archive incomplète (copie ou fiche absente)."
ATTENDU="$(sed -n 's/^sha256_dump=//p' "$D/fiche.txt")"
[ "$(sha256sum "$D/public.dump" | cut -d' ' -f1)" = "$ATTENDU" ] || stop "Empreinte de la copie différente de la fiche : copie abîmée."

# La base doit être VIDE : un essai ne s'empile pas sur une restauration.
DEJA="$("${PG_BIN}psql" "$CIBLE_URL" -X -Atc "select count(*) from pg_class where relnamespace='public'::regnamespace")"
[ "$DEJA" = "0" ] || stop "La base cible n'est pas vide : l'essai ne s'empile pas sur une autre restauration."

"${PG_BIN}psql" "$CIBLE_URL" -X -q -f "$ICI/stub-supabase.sql" > /dev/null
# La copie contient « CREATE SCHEMA public » ; toute base Postgres l'a déjà :
# on retire cette seule entrée de la table des matières (rien n'est effacé).
"${PG_BIN}pg_restore" --list "$D/public.dump" | grep -v -E '^[0-9]+; [0-9]+ [0-9]+ SCHEMA - public ' > "$TRAVAIL/liste.txt"
"${PG_BIN}pg_restore" --dbname="$CIBLE_URL" --no-owner --no-acl --exit-on-error --use-list="$TRAVAIL/liste.txt" \
  --section=pre-data --section=data "$D/public.dump" || stop "La structure ou les données ne se restaurent pas."
"${PG_BIN}psql" "$CIBLE_URL" -X -q -f "$ICI/proprietaires.sql" > /dev/null
"${PG_BIN}pg_restore" --dbname="$CIBLE_URL" --no-owner --no-acl --exit-on-error --use-list="$TRAVAIL/liste.txt" \
  --section=post-data "$D/public.dump" || stop "Les contraintes, index, politiques ou déclencheurs ne se rejouent pas."

"${PG_BIN}psql" "$CIBLE_URL" -X -q -f "$ICI/compter.sql" | sed '/^$/d' | sort > "$TRAVAIL/restaure.txt"

# Comparer famille par famille : avant ≤ restauré ≤ après (ou l'inverse si des
# lignes sont parties pendant la copie). Une famille absente compte 0.
ECARTS="$(awk -F'|' '
  FILENAME==ARGV[1] { k=$1"|"$2; av[k]=$3; cles[k]=1; next }
  FILENAME==ARGV[2] { k=$1"|"$2; ap[k]=$3; cles[k]=1; next }
                    { k=$1"|"$2; re[k]=$3; cles[k]=1 }
  END {
    for (k in cles) {
      a=(k in av)?av[k]+0:0; b=(k in ap)?ap[k]+0:0; r=(k in re)?re[k]+0:0;
      lo=(a<b)?a:b; hi=(a<b)?b:a;
      if (r<lo || r>hi) print k
    }
  }' "$D/comptes-avant.txt" "$D/comptes-apres.txt" "$TRAVAIL/restaure.txt" | sort)"

NFAM="$(sed '/^$/d' "$TRAVAIL/restaure.txt" | wc -l)"
TOTAL="$(awk -F'|' '$1=="app_data" && $2=="*" {print $3}' "$TRAVAIL/restaure.txt")"
[ -n "$TOTAL" ] && [ "$TOTAL" -gt 0 ] || stop "app_data restaurée VIDE : la sauvegarde ne sert à rien."

if [ -n "${GARDER_DOSSIER:-}" ]; then mkdir -p "$GARDER_DOSSIER"; cp "$D"/* "$GARDER_DOSSIER"/; fi

RESUME="Essai de restauration — $(sed -n 's/^date_utc=//p' "$D/fiche.txt") : $NFAM comptes (tables et familles d'id) relus"
if [ -n "$ECARTS" ]; then
  echo "$RESUME ; HORS FOURCHETTE : $(echo "$ECARTS" | tr '\n' ' ')" >&2
  [ -n "${GITHUB_STEP_SUMMARY:-}" ] && printf '### Sauvegarde : essai de restauration RATÉ\n\nFamilles hors fourchette : %s\n' "$(echo "$ECARTS" | tr '\n' ' ')" >> "$GITHUB_STEP_SUMMARY"
  stop "La restauration ne rend pas le même nombre de lignes que la base au moment de la copie."
fi
echo "$RESUME, tous dans la fourchette avant/après la copie."
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && printf '### Sauvegarde : essai de restauration réussi\n\n%s, tous dans la fourchette avant/après la copie.\n' "$RESUME" >> "$GITHUB_STEP_SUMMARY"
exit 0
