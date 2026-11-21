// ════════════════════════════════════════════════════════════════════════════
//  VITESSE À 20 000 VENTES, EN MÉDIANE (12 nov., lot vitesse-volume)
//  node scripts/bancs/vitesse-volume.cjs <distA> [<distB>]   (PASSES=5, TABS=journee,ventes,achats, VENTES=20000)
//  Lance `_mesure-demarrage.cjs` (téléphone 390, CPU ×4, 4G) PASSES fois par build,
//  en ALTERNANT les builds (A, B, A, B…) pour que la charge de la machine les touche
//  pareil, et rend la MÉDIANE par écran : prêt (ms), tâches longues (ms), plus longue.
//  Une passe seule varie du simple au double : seule la médiane se compare.
// ════════════════════════════════════════════════════════════════════════════
const { execFileSync } = require('child_process');
const path = require('path');
const dists = process.argv.slice(2);
const PASSES = Number(process.env.PASSES || 5);
const TABS = process.env.TABS || 'journee,ventes,achats';
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const res = dists.map(() => ({}));
for (let p = 0; p < PASSES; p++) {
  dists.forEach((d, i) => {
    const port = 9500 + Math.floor(Math.random() * 400);
    let out = '';
    try { out = execFileSync(process.execPath, [path.join(__dirname, '_mesure-demarrage.cjs'), d, String(port)], { env: { ...process.env, VENTES: process.env.VENTES || '20000', TABS }, encoding: 'utf8', timeout: 900000, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { out = String(e.stdout || ''); }
    for (const l of out.split('\n')) if (l.startsWith('{')) { const x = JSON.parse(l); const r = (res[i][x.tab] = res[i][x.tab] || { pret: [], longues: [], plus: [] }); r.pret.push(x.pret_ms); r.longues.push(x.longues_ms); r.plus.push(x.plusLongue); }
    console.log(`passe ${p + 1} · ${path.basename(d)} : ${Object.entries(res[i]).map(([t, r]) => `${t} ${r.pret[r.pret.length - 1]}`).join(' ')}`);
  });
}
const bilan = res.map((r, i) => ({ dist: dists[i], ecrans: Object.fromEntries(Object.entries(r).map(([t, v]) => [t, { pret: med(v.pret), longues: med(v.longues), plusLongue: med(v.plus), passes: v.pret }])) }));
console.log(JSON.stringify(bilan, null, 1));
