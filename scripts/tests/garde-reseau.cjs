// (11 nov.) La garde réseau des bancs (scripts/bancs/_garde-reseau.cjs) : un banc qui ne
// joint que ce qu'il sert lui-même reste vert ; un banc qui tente la production (même
// refusée, même par `route.continue()`) ou qui reçoit une réponse d'Internet est ROUGE.
'use strict';
const { spawnSync } = require('child_process'), path = require('path');
const GARDE = path.join(__dirname, '..', 'bancs', '_garde-reseau.cjs'), ESSAI = path.join(__dirname, '_garde-reseau-essai.cjs');
let ko = 0;
for (const [mode, attendu] of [['propre', 0], ['prod', 1], ['continue', 1], ['internet', 1]]) {
  const r = spawnSync(process.execPath, ['--require', GARDE, ESSAI], { env: Object.assign({}, process.env, { ESSAI: mode, NODE_OPTIONS: '' }), encoding: 'utf8', timeout: 120000 });
  const sortie = (r.stdout || '') + (r.stderr || '');
  const bon = r.status === attendu && (attendu === 0 ? !/garde réseau/.test(sortie) : /❌ garde réseau/.test(sortie));
  if (!bon) ko++;
  console.log(`${bon ? '✅' : '❌'} ${mode} : code ${r.status} (attendu ${attendu})${bon ? '' : ' — ' + sortie.slice(-300)}`);
}
console.log(ko ? `❌ garde-reseau : ${ko} rouge(s)` : '✅ garde-reseau : la garde rougit tout banc qui sort');
process.exitCode = ko ? 1 : 0;
