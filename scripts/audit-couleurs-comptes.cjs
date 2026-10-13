// AUDIT : une pastille d'IDENTITÉ de compte n'emprunte jamais une couleur
//   SÉMANTIQUE (§7). Le rouge est réservé à « deux paires sous un numéro » ;
//   l'ambre à un avertissement ; le bleu est l'accent, rare. Un point d'identité
//   qui tombe sur l'une d'elles est une FAUSSE ALERTE — et « une fausse alerte
//   fait cesser de lire les vraies ».
//
//   On ne juge pas l'ORTHOGRAPHE des hex mais la RÈGLE : chaque couleur de
//   `ACCT_COLORS` doit rester à distance perceptuelle de TOUTE couleur réservée
//   (accent/accentSoft/danger/warn/gold/blue, des DEUX thèmes), et les pastilles
//   doivent rester distinctes entre elles. Les seuils et la palette sont lus
//   dans `src/App.jsx` — rien n'est recopié.
//
//   node scripts/audit-couleurs-comptes.cjs [chemin/App.jsx]
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', 'src', 'App.jsx');
const APP = fs.readFileSync(SRC, 'utf8');
const SEUIL_RES = 70, SEUIL_PAIR = 55;
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

const hex = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
// distance perceptuelle "redmean" (bonne approximation, sans dépendance)
const dist = (a, b) => { const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b); const rm = (r1 + r2) / 2; const dr = r1 - r2, dg = g1 - g2, db = b1 - b2; return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db); };

// ── La palette d'identité ───────────────────────────────────────────────────
const mPal = /const ACCT_COLORS\s*=\s*\[([^\]]*)\]/.exec(APP);
dit(!!mPal, 'ACCT_COLORS est lisible');
const PAL = mPal ? (mPal[1].match(/#[0-9a-fA-F]{6}/g) || []) : [];
dit(PAL.length >= 2, `ACCT_COLORS porte ${PAL.length} teintes`);

// ── Les couleurs RÉSERVÉES, lues dans les deux thèmes ───────────────────────
// On prend toute valeur hex affectée à une clé sémantique, où qu'elle soit.
const RES = new Map();
for (const k of ['accent', 'accentSoft', 'danger', 'warn', 'gold', 'blue']) {
  const re = new RegExp(k + '\\s*:\\s*"(#[0-9a-fA-F]{6})"', 'g');
  let m; while ((m = re.exec(APP))) RES.set(m[1].toLowerCase(), k);
}
dit(RES.size >= 6, `couleurs réservées lues : ${RES.size}`, [...RES].map(([c, k]) => k + ' ' + c).join(', '));

// ── 1) Aucune pastille ne tombe sur une couleur réservée ────────────────────
for (const c of PAL) {
  let worst = 1e9, wk = '';
  for (const [rc, k] of RES) { const d = dist(c, rc); if (d < worst) { worst = d; wk = `${k} ${rc}`; } }
  dit(worst >= SEUIL_RES, `${c} reste loin de toute couleur sémantique (${worst.toFixed(0)} ≥ ${SEUIL_RES})`, worst < SEUIL_RES ? `trop proche de ${wk} — un compte sain porterait ce signal` : '');
}

// ── 2) Les pastilles restent distinctes entre elles ─────────────────────────
let minp = 1e9, mpair = '';
for (let i = 0; i < PAL.length; i++) for (let j = i + 1; j < PAL.length; j++) { const d = dist(PAL[i], PAL[j]); if (d < minp) { minp = d; mpair = `${PAL[i]}/${PAL[j]}`; } }
dit(minp >= SEUIL_PAIR, `les pastilles restent distinguables entre elles (${minp.toFixed(0)} ≥ ${SEUIL_PAIR})`, minp < SEUIL_PAIR ? `deux comptes auraient le même point : ${mpair}` : '');

console.log(ko ? `\n❌ audit-couleurs-comptes : ${ko} rouge(s)` : '\n✅ audit-couleurs-comptes : aucune pastille de compte n’emprunte une couleur d’alarme');
process.exit(ko ? 1 : 0);
