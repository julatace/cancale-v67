#!/usr/bin/env bash
# (9 nov.) Les audits que touche Solo / Pro, d'un coup (docs/passation/2026-11-09-plans-solo-pro.md).
cd "$(dirname "$0")/.." || exit 1
rc=0
for a in plans-solo-pro abonnement-propre abonnement boutons coherence fonctions-api icones identite lancement mentions-paiement statuts tdz urssaf variables violet; do
  echo "== audit-$a"
  if ! timeout 600 node "scripts/audit-$a.cjs" > "/tmp/audit-$a.log" 2>&1; then rc=1; echo "ROUGE"; fi
  tail -n 3 "/tmp/audit-$a.log" | cut -c1-300
done
exit $rc
