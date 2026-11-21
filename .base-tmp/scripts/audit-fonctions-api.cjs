// ⚠️ CONTRÔLE PERMANENT — PAS DE 13ᵉ FONCTION VERCEL.
// Le plan Hobby de Vercel plafonne un projet à 12 fonctions serverless. Le
// 26 septembre (#250), trois routes eBay l'avaient fait passer à 15 : TOUS les
// déploiements échouaient, et la route de détourage Photoroom a dû être retirée
// pour redescendre. Ce nombre ne figurait dans aucun audit. Une nouvelle route
// devient un MODE d'une route existante (?mode=…, avec une réécriture dans
// vercel.json) — comme /api/sante, /api/stripe-webhook, /api/detourage.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const PLAFOND = 12;
const api = fs.readdirSync(path.join(R, 'api')).filter((f) => /\.(js|mjs|cjs|ts)$/.test(f));
const ok = api.length <= PLAFOND;
console.log(`${ok ? '✅' : '❌'} ${api.length} fonction(s) dans api/ (plafond du plan Hobby : ${PLAFOND})${ok ? '' : ' — ' + api.join(', ')}`);
// Chaque réécriture de vercel.json doit viser une route qui EXISTE (sinon 404).
let ko = ok ? 0 : 1;
try {
  const v = JSON.parse(fs.readFileSync(path.join(R, 'vercel.json'), 'utf8'));
  for (const rw of (v.rewrites || [])) {
    const m = /^\/api\/([^?/]+)/.exec(rw.destination || '');
    if (!m) continue;
    const existe = api.some((f) => f.replace(/\.[^.]+$/, '') === m[1]);
    if (!existe) ko++;
    console.log(`${existe ? '✅' : '❌'} ${rw.source} → ${rw.destination}${existe ? '' : ' : cette route n’existe pas'}`);
  }
} catch (e) { ko++; console.log('❌ vercel.json illisible — ' + e.message); }
console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'}`);
process.exit(ko ? 1 : 0);
