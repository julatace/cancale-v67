#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  CI : installer les navigateurs de Playwright ET leurs dépendances, sans dépendre d'un seul essai réseau
#  (27 nov., zero-rouge-bancs-2). Les mêmes navigateurs, les mêmes dépendances qu'avant
#  (`npx playwright install --with-deps <navigateurs>`) ; en plus :
#   · la source apt de Microsoft de l'image est retirée d'abord (scripts/ci-sans-source-microsoft.sh : son
#     « 403 … no longer signed » faisait échouer apt, donc l'installation, PR #1437) ;
#   · 4 essais au plus, 20/40/60 s entre deux, `apt-get update` refait entre deux (miroirs d'Ubuntu qui ne
#     répondent pas : « Temporary failure resolving », 11 nov.). Le 4ᵉ échec fait échouer le pas.
#    bash scripts/ci-installer-navigateurs.sh chromium
#    bash scripts/ci-installer-navigateurs.sh webkit
# ════════════════════════════════════════════════════════════════════════════
set -u
[ "$#" -ge 1 ] || { echo "usage : $0 <navigateur>…" >&2; exit 2; }
bash "$(dirname "$0")/ci-sans-source-microsoft.sh"
for essai in 1 2 3 4; do
  npx playwright install --with-deps "$@" && exit 0
  [ "$essai" = 4 ] && { echo "ci-installer-navigateurs : 4 essais ratés" >&2; exit 1; }
  sleep $((essai * 20))
  sudo apt-get update || true
done
