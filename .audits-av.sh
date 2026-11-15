#!/bin/bash
# Lance une liste d'audits l'un après l'autre (temporaire, non commité).
cd "$(dirname "$0")"
for a in "$@"; do
  f=scripts/audit-$a.cjs
  if [ ! -f "$f" ]; then echo "$a: ABSENT"; continue; fi
  r=$(timeout 300 node "$f" 2>&1 | grep -v '^\s*$' | tail -2 | tr '\n' ' ')
  echo "$a: ${r:0:260}"
done
