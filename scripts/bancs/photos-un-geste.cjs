// ════════════════════════════════════════════════════════════════════════════
//  BANC — AMÉLIORER LES PHOTOS EN UN GESTE (23 nov., lot photos-un-geste). Photos INVENTÉES (dessinées dans la page).
//  Le VRAI Studio photo monté seul (outils/photos-un-geste), 390 tactile et 1512, clair et sombre :
//   G1 le panneau « Améliorer en un geste » : trois réglages allumés, « Améliorer les 3 photos » ;
//   G2 un toucher ⇒ les TROIS photos améliorées, UNE écriture ; l'original de chacune intact (`img` = avant), le
//      résultat à côté (`ameliore`), le même réglage pour toutes (`ameliorePar`) ; l'améliorée est affichée à côté ;
//   G3 la photo améliorée est plus contrastée et son coin est blanc (fond uniforme), au format 3:4 ;
//   G4 « Revenir aux originaux » retire les versions améliorées ; une écriture refusée (?base=ko) ne range rien et le dit ;
//   G5 rien ne déborde, ni NaN, cibles ≥ 44. Doit être ROUGE sur le code d'avant (pas de panneau).
//  Lancer : node scripts/bancs/photos-un-geste.cjs  (SHOTS=dossier pour les captures, à REGARDER)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { lancer, REGLES_PAGE } = require('./_harnais-lots.cjs');
lancer({ lot: 'photos-un-geste', url: '/?base=lu', parcours: async (pg, { W, th, SHOTS, dit }) => {
  await pg.waitForSelector('[data-ug-panneau]', { timeout: 15000 });
  const a = await pg.evaluate(() => ({ n: document.querySelector('[data-ug-panneau]').getAttribute('data-ug-n'), r: [...document.querySelectorAll('[data-ug-reglage]')].map((x) => x.getAttribute('data-ug-reglage') + ':' + x.getAttribute('data-ug-on')), b: document.querySelector('[data-ug-lancer]').textContent }));
  dit(a.n === '3' && a.r.join() === 'lumiere:1,recadrage:1,fond:1' && /Améliorer les 3 photos/.test(a.b), `G1 ${W} ${th} : trois réglages allumés, « Améliorer les 3 photos »`, a);
  const r0 = await pg.evaluate(REGLES_PAGE, '[data-ug-panneau] button');
  dit(!r0.deborde && !r0.nan && r0.petites === 0, `G5 ${W} ${th} : rien ne déborde, aucun NaN, cibles ≥ 44`, r0);
  await pg.screenshot({ path: path.join(SHOTS, `studio-avant-${W}-${th}.png`), fullPage: true });
  await pg.click('[data-ug-lancer]');
  await pg.waitForFunction(() => window.__ECRITURES > 0 && document.querySelectorAll('[data-ug-ameliore]').length === 3, null, { timeout: 20000 }).catch(() => {});
  const b = await pg.evaluate(async () => {
    const L = window.__LIGNE || { photos: [] };
    const mesure = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; let mn = 255, mx = 0; for (let k = 0; k < d.length; k += 16) { const v = d[k + 1]; if (v < mn) mn = v; if (v > mx) mx = v; }
      ok({ w: c.width, h: c.height, ecart: mx - mn, coin: [d[0], d[1], d[2]] }); }; i.src = src; });
    return { ecritures: window.__ECRITURES, intacts: L.photos.every((p, k) => p.img === window.__ORIGINAUX[k]), ameliorees: L.photos.filter((p) => p.ameliore).length,
      memes: L.photos.every((p) => p.ameliorePar && p.ameliorePar.lumiere && p.ameliorePar.recadrage && p.ameliorePar.fond), vues: document.querySelectorAll('[data-ug-ameliore]').length,
      avant: await mesure(window.__ORIGINAUX[0]), apres: L.photos[0] && L.photos[0].ameliore ? await mesure(L.photos[0].ameliore) : null, msg: (document.querySelector('[data-studio-msg]') || {}).textContent || '' };
  });
  dit(b.ecritures === 1 && b.ameliorees === 3 && b.intacts && b.memes && b.vues === 3, `G2 ${W} ${th} : 3 photos améliorées en UNE écriture, originaux intacts, même réglage, affichées à côté`, b);
  dit(b.apres && b.apres.ecart > b.avant.ecart && b.apres.coin.every((v) => v >= 245) && Math.abs(b.apres.w / b.apres.h - 0.75) < 0.03, `G3 ${W} ${th} : plus contrastée, fond blanc, 3:4`, { avant: b.avant, apres: b.apres });
  await pg.screenshot({ path: path.join(SHOTS, `studio-apres-${W}-${th}.png`), fullPage: true });
  await pg.click('[data-ug-original]'); await pg.waitForTimeout(600);
  const c = await pg.evaluate(() => ({ e: window.__ECRITURES, n: (window.__LIGNE || { photos: [] }).photos.filter((p) => p.ameliore).length, vues: document.querySelectorAll('[data-ug-ameliore]').length }));
  dit(c.e === 2 && c.n === 0 && c.vues === 0, `G4 ${W} ${th} : « Revenir aux originaux » retire les versions améliorées`, c);
  await pg.goto(pg.url().replace('base=lu', 'base=ko')); await pg.waitForSelector('[data-ug-lancer]');
  await pg.click('[data-ug-lancer]'); await pg.waitForFunction(() => /base n’a pas répondu/.test((document.querySelector('[data-studio-msg]') || {}).textContent || ''), null, { timeout: 20000 }).catch(() => {});
  const d = await pg.evaluate(() => ({ e: window.__ECRITURES, vues: document.querySelectorAll('[data-ug-ameliore]').length, msg: (document.querySelector('[data-studio-msg]') || {}).textContent || '' }));
  dit(d.e === 0 && d.vues === 0 && /rien n’a été enregistré/.test(d.msg), `G4b ${W} ${th} : écriture refusée ⇒ rien rangé, et c’est dit`, d);
} });
