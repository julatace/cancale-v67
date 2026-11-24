#!/usr/bin/env bash
set -euo pipefail
umask 077

if (( EUID == 0 )); then
  echo 'Lancer l’installation depuis le compte Linux dédié au pilote VRM.' >&2
  exit 1
fi

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
if [[ "$(pwd -P)" != "$(cd -- "$HOME" && pwd -P)/vrm" ]]; then
  echo 'Le service VRM Cloud attend le dépôt dans ~/vrm.' >&2
  exit 1
fi

if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 22 ? 1 : 0)'; then
  echo 'Installer Node.js 22 ou ultérieur sur le serveur.' >&2
  exit 1
fi
if ! systemctl --user show-environment >/dev/null; then
  echo 'Ouvrir une session Linux avec le compte qui exécutera le service VRM.' >&2
  exit 1
fi

npm ci --include=dev
npx playwright install --with-deps --no-shell chromium
node outils/vrm-cloud/lancer.mjs verification-installation --verifier

install -Dm644 outils/vrm-cloud/vrm-cloud@.service "$HOME/.config/systemd/user/vrm-cloud@.service"
systemctl --user daemon-reload
echo 'Pilote installé. Associer le compte depuis une session graphique privée avant d’activer le service.'
