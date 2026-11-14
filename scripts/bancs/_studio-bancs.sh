#!/bin/bash
# Les bancs existants des écrans du chantier Studio « reste » (outil de travail) : une ligne de bilan par banc.
cd "$(dirname "$0")/../.." || exit 1
for b in ${BANCS:-argent urssaf messages-naturel reglages connexion-claire accueil garde-ecrans communaute boite-emails finitions-12nov}; do
  f="scripts/bancs/$b.cjs"
  if [ ! -f "$f" ]; then echo "ABSENT $b"; continue; fi
  sortie=$(timeout 1500 node "$f" 2>&1); code=$?
  v=$(echo "$sortie" | grep -c "✅"); r=$(echo "$sortie" | grep -c "❌")
  echo "[$code] $b : $v ✅ · $r ❌"
  echo "$sortie" | grep "❌" | head -8 | cut -c1-400
done
