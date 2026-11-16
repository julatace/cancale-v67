// Branche de MESURE seulement (jamais fusionnée) : sur LA MÊME machine, construit origin/main, puis mesure en ALTERNANCE
// main / branche (donnees_ms, réseau libre, ×4, 20 000 ventes) et relève les chiffres DEUX fois par build.
const { execFileSync, execSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const crypto = require('crypto');
const R = path.join(__dirname, '..', '..'); const M = '/tmp/vrm-main';
const sh = (c, o = {}) => execSync(c, { stdio: 'inherit', ...o });
sh(`git -C ${R} fetch --depth=1 origin main && rm -rf ${M} && git -C ${R} worktree add ${M} FETCH_HEAD && ln -s ${R}/node_modules ${M}/node_modules && cd ${M} && npx vite build --outDir ${M}/dist-main > /dev/null`);
const D = { main: `${M}/dist-main`, branche: path.join(R, 'dist') };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const res = {};
for (let p = 0; p < 3; p++) for (const tab of ['journee', 'ventes']) for (const k of (p % 2 ? ['branche', 'main'] : ['main', 'branche'])) {
  let out = ''; try { out = execFileSync(process.execPath, [path.join(__dirname, '_mesure-demarrage.cjs'), D[k], String(9300 + p * 10 + (tab === 'ventes' ? 2 : 0) + (k === 'main' ? 1 : 0))], { env: { ...process.env, VENTES: '20000', CPU: '4', COMPLET: '1', RESEAU: 'libre', COMPLET_MAX_MS: '240000', TABS: tab }, encoding: 'utf8', timeout: 900000, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { out = String(e.stdout || ''); }
  const l = out.split('\n').find((x) => x.startsWith('{')); const x = l ? JSON.parse(l) : {};
  (res[k + '.' + tab] = res[k + '.' + tab] || []).push(x.donnees_ms);
  console.log(`MESURE passe ${p + 1} ${tab} ${k} : données ${x.donnees_ms} ms · complet ${x.complet_ms} · tâches longues ${x.longues_ms}`);
}
for (const [k, v] of Object.entries(res)) console.log(`MEDIANE ${k} ${med(v)} (${v.join(' · ')})`);
const h = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
for (const k of ['main', 'branche', 'main', 'branche']) {
  const out = path.join(require('os').tmpdir(), 'ch.json');
  try { execFileSync(process.execPath, [path.join(__dirname, 'chiffres-volume.cjs'), D[k], out, String(9400 + Math.floor(Math.random() * 100))], { env: { ...process.env, VENTES: '20000' }, stdio: 'inherit', timeout: 1500000 }); } catch (e) { console.log('CHIFFRES ' + k + ' échec'); continue; }
  const C = JSON.parse(fs.readFileSync(out, 'utf8'));
  for (const [t, e] of Object.entries(C.ecrans)) for (const kk of ['montants', 'comptes', 'attrs']) { const v = (e[kk] || []).filter((x) => !/^data-photos-perdues=/.test(x)).map((x) => { const n = Number(String(x).split('=')[1]); return n > 1.6e12 && n < 2.2e12 ? String(x).split('=')[0] + '=·ms·' : x; }); console.log(`EMPREINTE ${k} ${t}.${kk} ${v.length} ${h(v)}${kk === 'montants' ? ' ' + JSON.stringify(v).slice(0, 400) : ''}`); }
  for (const [kk, v] of Object.entries(C.publie)) console.log(`EMPREINTE ${k} publie.${kk} ${h(v)}`);
}
console.log('✅ comparaison faite');
