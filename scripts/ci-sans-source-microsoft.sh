#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  CI : retirer la source apt de Microsoft que l'image des runners embarque (27 nov., zero-rouge-bancs-2).
#  PR #1437, « Audits (part 2/3) » : `npx playwright install --with-deps` lance apt, et apt est tombé sur
#  « Failed to fetch https://packages.microsoft.com/ubuntu/24.04/prod/dists/noble/InRelease 403 Forbidden …
#  is no longer signed » ⇒ « Failed to install browsers … exit code 100 », avant qu'aucun audit ne tourne.
#  Aucun paquet que la CI installe ne vient de cette source (les dépendances des navigateurs et postgresql
#  viennent des dépôts d'Ubuntu) : on la retire avant tout `apt-get`. Les paquets installés restent les mêmes.
#  Sans effet si la source n'est pas là. Ne touche qu'aux fichiers qui nomment packages.microsoft.com.
# ════════════════════════════════════════════════════════════════════════════
set -u
DOSSIER="${VRM_APT_SOURCES:-/etc/apt/sources.list.d}"   # (essai local : un dossier jetable)
SUDO=sudo; [ "$(id -u)" = 0 ] && SUDO=
for f in "$DOSSIER"/*; do
  [ -f "$f" ] || continue
  if grep -qs 'packages\.microsoft\.com' "$f"; then
    echo "ci-sans-source-microsoft : source apt retirée : $f"
    $SUDO rm -f "$f"
  fi
done
exit 0
