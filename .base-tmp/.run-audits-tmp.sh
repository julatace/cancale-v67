#!/bin/bash
# usage: .run-audits-tmp.sh <outfile> [liste]
cd "$(dirname "$0")"
OUT="$1"; shift
LISTE="${1:-}"
if [ -z "$LISTE" ]; then FILES=$(ls scripts/audit-*.cjs); else FILES=$(cat "$LISTE"); fi
: > "$OUT"
echo "$FILES" | xargs -P 6 -I{} bash -c 'f={}; t0=$(date +%s); timeout 300 node "$f" > /home/user/cancale-v67/.claude/worktrees/agent-ab1dedaa8d06c0930/.aud-logs/base-$(basename $f).log 2>&1; c=$?; echo "$c $(( $(date +%s)-t0 ))s $f" >> '"$OUT"
