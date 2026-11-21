#!/bin/bash
# Les audits du chantier Studio « reste » (outil de travail) : une ligne par audit, sa fin.
cd "$(dirname "$0")/../.." || exit 1
for a in ${AUDITS:-traduction tdz variables coherence composants violet rouge-doublon urssaf quoi-de-neuf identite csp}; do
  f="scripts/audit-$a.cjs"
  if [ ! -f "$f" ]; then echo "ABSENT $a"; continue; fi
  sortie=$(timeout 300 node "$f" 2>&1); code=$?
  echo "[$code] $a: $(echo "$sortie" | tail -3 | tr '\n' ' ' | cut -c1-300)"
done
