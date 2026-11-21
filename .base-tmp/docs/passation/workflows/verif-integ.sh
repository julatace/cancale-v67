#!/bin/bash
# Vérification complète de l'intégration : build, tous les audits, bancs touchés un par un.
cd /home/user/cancale-v67/.claude/worktrees/integ-11oct || exit 1
S=/tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad
O=$S/verif-integ-$1.txt; : > $O
npm run build > $S/build-$1.txt 2>&1 && echo "BUILD OK" >> $O || { echo "BUILD KO" >> $O; exit 1; }
for f in scripts/audit-*.cjs; do
  case "$f" in *audit-renum-b.cjs) echo "SKIP $f (migration inchangée)" >> $O; continue;; esac
  timeout 900 node "$f" > $S/a.txt 2>&1; c=$?
  [ $c -eq 0 ] && echo "AUDIT OK $f" >> $O || { echo "AUDIT KO($c) $f :: $(tail -5 $S/a.txt | tr '\n' ' ' | cut -c1-600)" >> $O; }
done
[ -e scripts/bancs/fx ] || ln -s /home/user/cancale-v67/scripts/bancs/fx scripts/bancs/fx
shift
for b in "$@"; do
  timeout 1500 node scripts/bancs/$b.cjs > $S/b.txt 2>&1; c=$?
  echo "BANC($c) $b :: $(tail -3 $S/b.txt | tr '\n' ' ' | cut -c1-400)" >> $O
done
rm -f scripts/bancs/fx
echo FIN >> $O
