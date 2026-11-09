#!/usr/bin/env bash
# (9 nov.) Solo par plateforme : la série d'audits du chantier (docs/passation/2026-11-09-solo-plateformes.md).
cd "$(dirname "$0")/.." || exit 1
rouge=0
for a in variables tdz coherence identite statuts fonctions-api bilan-semaine suites-serveur plans-solo-pro; do
  echo "== audit-$a"
  if ! node "scripts/audit-$a.cjs" > "/tmp/audit-solo-$a.log" 2>&1; then rouge=1; echo "   ROUGE"; fi
  tail -2 "/tmp/audit-solo-$a.log"
done
exit $rouge
