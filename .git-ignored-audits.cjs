const { spawnSync } = require('child_process');
const R = __dirname; const noms = process.argv.slice(2);
for (const n of noms) {
  const r = spawnSync(process.execPath, [`${R}/scripts/audit-${n}.cjs`], { cwd: R, encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const rouges = out.split('\n').filter((l) => /^\s*(❌|KO )/.test(l));
  console.log(`== ${n} : code ${r.status}` + (rouges.length ? '\n' + rouges.slice(0, 6).join('\n') : '') + '\n   ' + out.trim().split('\n').slice(-1)[0].slice(0, 200));
}
