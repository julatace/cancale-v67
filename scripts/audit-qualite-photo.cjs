// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : PHOTO FLOUE OU TROP SOMBRE (14 nov., proposition 102)
//   node scripts/audit-qualite-photo.cjs        (CALIBRER=1 : imprime les mesures)
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE la vraie règle (src/qualitePhoto.js) sur des images INVENTÉES
// (scripts/_images-inventees.cjs) :
//   A. nettes (plusieurs couleurs, grain, fond uni à 80 %, basket noire sur blanc) ⇒ « ok » ;
//   B. légèrement douces (σ 0,8 et 1,2) ⇒ PAS signalées (seuils prudents) ;
//   C. nettement floues (σ 3 et plus) ⇒ « flou » ;
//   D. sous-exposées (× 0,15 et × 0,2) ⇒ « sombre », même nettes ; une basket NOIRE sur fond
//      blanc n'est jamais « sombre » ;
//   E. une image uniforme ⇒ « passu » (rien n'est dit) ;
//   F. le calcul tourne dans un WORKER (src/qualitePhoto.worker.js importe la règle) et
//      n'appelle aucun réseau ; l'avertissement n'est JAMAIS bloquant (aucun `disabled`,
//      aucun refus d'enregistrer dans le studio / « Créer sur Vinted » à cause d'un verdict).
// AUDIT_MUTATION=laplacien | lumiere : la règle réaffaiblie ⇒ l'audit doit rougir.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const { dessiner, flouter, assombrir } = require('./_images-inventees.cjs');
const MUT = process.env.AUDIT_MUTATION || '';
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const SRC = path.join(RACINE, 'src', 'qualitePhoto.js');
const MUTATIONS = {
  // La netteté ne regarde plus les bords (un flou passe pour net).
  laplacien: ['const L = k * (g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]);', 'const L = k * g[i];'],
  // « Sombre » oublie la zone claire : une basket noire sur fond blanc devient « sombre ».
  lumiere: ['const sombre = m.lum < seuils.lumMoy && m.p95 < seuils.lumHaute;', 'const sombre = m.lum < seuils.lumMoy + 140;'],
};

(async () => {
  if (!fs.existsSync(SRC)) { dit(false, 'src/qualitePhoto.js existe', 'absent : la mesure de qualité n’existe pas sur cet arbre'); return fin(); }
  let chemin = SRC;
  if (MUT) {
    const m = MUTATIONS[MUT]; let s = fs.readFileSync(SRC, 'utf8');
    if (!m || !s.includes(m[0])) { console.log('KO  mutation inconnue ou plus applicable : ' + MUT); process.exit(2); }
    chemin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mut-qualite-')), 'qualitePhoto.mjs');
    fs.writeFileSync(chemin, s.replace(m[0], m[1]));
    console.log('── mutation : ' + MUT);
  }
  const Q = await import(chemin);
  const juge = (img) => Q.qualiteDePixels(img.px, img.w, img.h);
  const CAL = !!process.env.CALIBRER;
  const voir = (nom, q) => { if (CAL) console.log('   ' + nom.padEnd(34) + JSON.stringify(q.mesures) + ' → ' + q.juge); return q; };

  const modeles = [
    { tige: '#1d4ed8', graine: 1 }, { tige: '#c8102e', col: '#111111', graine: 2 }, { tige: '#15803d', semelle: '#111111', graine: 3 },
    { tige: '#f4f4f2', bande: '#111111', lacets: '#111111', graine: 4 }, { tige: '#a16207', fond: ['#f5f5f5', '#e0e0e0'], graine: 5 },
    { tige: '#ec4899', fond: ['#e8ecef', '#c9cfd6'], graine: 6 },
  ];
  const noireSurBlanc = { tige: '#151515', col: '#151515', semelle: '#f4f4f2', bande: '#2a2a2a', lacets: '#f4f4f2', fond: ['#fafafa', '#f0f0f0'], uni: true, graine: 9 };
  const petiteSurUni = { tige: '#1d4ed8', uni: true, echelle: 0.45, fond: ['#f2f2f2', '#f2f2f2'], graine: 11 };

  // A. nettes
  let a = 0;
  for (const [i, m] of modeles.entries()) { const q = voir('nette ' + i, juge(dessiner(m))); if (q.juge === 'ok') a++; else dit(false, 'nette ' + i + ' jugée ok', q.juge); }
  dit(a === modeles.length, `A. ${a}/${modeles.length} photos nettes jugées « ok »`);
  dit(voir('noire sur blanc', juge(dessiner(noireSurBlanc))).juge === 'ok', 'A. une basket NOIRE sur fond blanc : « ok » (ni floue, ni sombre)');
  dit(voir('petite sur fond uni', juge(dessiner(petiteSurUni))).juge === 'ok', 'A. une petite paire sur un fond uni à 80 % : « ok »');
  dit(voir('nette sans grain', juge(dessiner({ ...modeles[0], grain: 0 }))).juge === 'ok', 'A. nette sans grain : « ok »');

  // B. légèrement douce
  let b = 0;
  for (const s of [0.8, 1.2]) for (const [i, m] of modeles.entries()) { const q = voir(`douce σ${s} ${i}`, juge(flouter(dessiner(m), s))); if (!q.flou) b++; }
  dit(b === 2 * modeles.length, `B. ${b}/${2 * modeles.length} photos légèrement douces (σ 0,8 et 1,2) NON signalées (prudent)`);

  // C. nettement floues
  for (const s of [3, 5]) {
    let c = 0;
    for (const [i, m] of modeles.entries()) { const q = voir(`floue σ${s} ${i}`, juge(flouter(dessiner(m), s))); if (q.flou) c++; }
    dit(c === modeles.length, `C. ${c}/${modeles.length} photos floues (σ ${s}) signalées « flou »`);
  }
  dit(voir('noire sur blanc floue', juge(flouter(dessiner(noireSurBlanc), 4))).flou, 'C. la basket noire sur blanc, floue (σ 4) : « flou »');

  // D. sombres
  for (const k of [0.15, 0.2]) {
    let d = 0;
    for (const [i, m] of modeles.entries()) { const q = voir(`sombre ×${k} ${i}`, juge(assombrir(dessiner(m), k))); if (q.sombre && !q.flou) d++; }
    dit(d === modeles.length, `D. ${d}/${modeles.length} photos nettes sous-exposées (× ${k}) : « sombre » et pas « flou »`);
  }
  { let d = 0; for (const [i, m] of modeles.entries()) { const q = juge(assombrir(dessiner(m), 0.75)); if (!q.sombre) d++; } dit(d === modeles.length, `D. ${d}/${modeles.length} photos un peu sombres (× 0,75) NON signalées`); }
  { const q = voir('sombre et floue', juge(assombrir(flouter(dessiner(modeles[0]), 4), 0.15))); dit(q.sombre, 'D. sombre ET floue : signalée (au moins « sombre » — le grain d’une photo noire étiré ne se juge pas)', q.juge); }

  // E. uniforme
  { const W = 200, H = 260, px = new Uint8ClampedArray(W * H * 4).fill(200); dit(juge({ px, w: W, h: H }).juge === 'passu', 'E. une image uniforme : « passu » (rien n’est dit)'); }
  dit(Q.juger(null).juge === 'passu', 'E. une image illisible : « passu »');
  dit(Q.photoDouteuse(Q.resumeQualite(juge(flouter(dessiner(modeles[0]), 4)))) === true && Q.photoDouteuse(Q.resumeQualite(juge(dessiner(modeles[0])))) === false, 'E. `photoDouteuse` lit le résumé gardé avec la photo');

  // F. worker, aucun réseau, jamais bloquant
  const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
  const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  const wk = lire('src/qualitePhoto.worker.js'), cl = lire('src/qualitePhotoClient.js');
  dit(/from '\.\/qualitePhoto\.js'/.test(wk) && /qualiteDePixels/.test(wk), 'F. le worker exécute la MÊME règle (src/qualitePhoto.worker.js)');
  dit(/new Worker\(new URL\('\.\/qualitePhoto\.worker\.js', import\.meta\.url\)/.test(cl), 'F. le client calcule dans un worker (repli sur la page s’il n’y en a pas)');
  for (const f of ['src/qualitePhoto.js', 'src/qualitePhoto.worker.js', 'src/qualitePhotoClient.js', 'src/AvisPhoto.jsx']) {
    const s = sansCom(lire(f));
    dit(s && !/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//.test(s), `F. ${f} : aucun réseau`);
  }
  const av = sansCom(lire('src/AvisPhoto.jsx'));
  dit(av && !/disabled|preventDefault|return false/.test(av), 'F. l’avertissement ne bloque rien (aucun disabled, aucun refus)');
  const studio = sansCom(lire('src/StudioPhoto.jsx'));
  dit(/analyserPhoto/.test(studio) && /<AvisPhoto/.test(studio), 'F. le studio mesure chaque photo prise et l’affiche');
  dit(!/(flou|sombre|douteuse)[^;\n]{0,80}\?\s*false/.test(studio) && !/if\s*\([^)]*(flou|sombre|photoDouteuse)[^)]*\)\s*(\{\s*)?return/.test(studio), 'F. le studio range la photo quel que soit le verdict');
  const cv = sansCom(lire('src/CreerSurVinted.jsx'));
  dit(/<AvisPhoto/.test(cv), 'F. « Créer sur Vinted » montre l’avertissement sur chaque photo avant l’envoi');
  fin();
})().catch((e) => { console.log('KO  exception : ' + (e && e.stack || e)); process.exit(1); });

function fin() { console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert'); process.exit(ko ? 1 : 0); }
