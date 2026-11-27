// ════════════════════════════════════════════════════════════════════════════
//  AUJOURD'HUI À 1280 PX — aucun geste coupé (27 nov., zero-rouge-bancs-2).
//
//  Vu en passant par une autre session : à 1280 px (un portable 13 pouces), les colonnes d'Aujourd'hui font ~265 px ;
//  « Écrire aux favoris dans l'extension » (la carte « Relancer au bon moment », sous Messages) sortait de sa carte
//  (587 px de bouton, coupé de moitié) et « Imprimer les 6 bordereaux » débordait de son bouton plein (nowrap).
//  Mesuré avec la police de la CI (sans Inter : `FONTCONFIG_FILE` qui la refuse), la plus large.
//
//  Pour chaque bouton ou lien visible de l'écran, à 1280 et 1512 px, clair et sombre :
//   B1 le bouton tient dans son premier ancêtre qui coupe (overflow ≠ visible) — sinon une partie est invisible ;
//   B2 chaque ligne de son texte tient dans le bouton — sauf une coupe VOULUE (un ancêtre en `text-overflow: ellipsis`, ou
//      `UneLigne` — `data-lignes` — qui coupe au mot et le dit) ; un texte pour lecteur d'écran seul (clip-path, 1 px) n'est pas vu.
//  Données inventées (design-passe.cjs), aucun réseau. `BANC_DIST` (un autre build), `SHOTS` (captures), `LARGEURS=1280,…`.
//    npm run build && node scripts/bancs/journee-1280.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path');
const P = require('./design-passe.cjs');
const LARG = String(process.env.LARGEURS || '1280,1512').split(',').map(Number).filter((n) => n >= 600);
let ko = 0, ok = 0;
const dit = (vrai, quoi, detail) => { if (vrai) { ok++; console.log('OK  ' + quoi); } else { ko++; console.log('KO  ' + quoi + (detail ? ' — ' + JSON.stringify(detail).slice(0, 600) : '')); } return vrai; };

const MESURE = () => {
  const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const nom = (b) => (b.innerText || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const hors = [], coupes = [];
  for (const b of document.querySelectorAll('.vrm-main button, .vrm-main a[href], .vrm-main [role="button"]')) {
    if (!vis(b) || b.closest('[inert], [aria-hidden="true"]')) continue;
    const rb = b.getBoundingClientRect(); if (rb.width < 2 || rb.height < 2) continue;
    // B1 — le premier ancêtre qui coupe
    for (let a = b.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.contain.includes('paint')) {
        const ra = a.getBoundingClientRect();
        // un ancêtre qui défile (auto/scroll) montre tout en défilant : seul un ancêtre qui CACHE juge
        const cache = /hidden|clip/.test(cs.overflowX) || cs.contain.includes('paint');
        // coupé = en partie visible seulement (un bouton tout entier hors de sa boîte est caché, pas coupé)
        const vu = Math.min(rb.right, ra.right) - Math.max(rb.left, ra.left);
        if (cache && vu > 0 && (rb.right > ra.right + 1 || rb.left < ra.left - 1)) hors.push({ nom: nom(b), bouton: [Math.round(rb.left), Math.round(rb.right)], ancetre: [Math.round(ra.left), Math.round(ra.right)], classe: String(a.className).slice(0, 50) });
        if (cache) break;
      }
    }
    // B2 — chaque ligne de texte dans le bouton
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (!t.textContent.trim()) continue;
      const p = t.parentElement; if (!p || !vis(p)) continue;
      let voulu = false; for (let a = p; a && a !== b.parentElement; a = a.parentElement) { const c = getComputedStyle(a); if (c.textOverflow === 'ellipsis' || a.hasAttribute('data-lignes') || c.clipPath !== 'none' || a.getBoundingClientRect().width <= 1) { voulu = true; break; } }
      if (voulu) continue;
      const r = document.createRange(); r.selectNodeContents(t);
      for (const q of r.getClientRects()) if (q.width > 0 && (q.right > rb.right + 1 || q.left < rb.left - 1)) { coupes.push({ nom: nom(b), texte: t.textContent.trim().slice(0, 40), ligne: [Math.round(q.left), Math.round(q.right)], bouton: [Math.round(rb.left), Math.round(rb.right)] }); break; }
    }
  }
  return { hors, coupes, n: document.querySelectorAll('.vrm-main button').length, ecran: (document.querySelector('.vrm-main[data-ecran]') || {}).getAttribute ? document.querySelector('.vrm-main[data-ecran]').getAttribute('data-ecran') : '' };
};

(async () => {
  await new Promise((okk) => P.srv.listen(P.PORT, okk));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const W of LARG) for (const sombre of [false, true]) {
      const T = `[journee ${W} ${sombre ? 'sombre' : 'clair'}]`;
      const o = await P.ouvrir(nav, { W: 1512, sombre, b: P.base(), url: '/?tab=journee' });
      try {
        await o.pg.setViewportSize({ width: W, height: 900 });
        await o.pg.waitForSelector('.vrm-main .sj-journee, .vrm-main [data-v2-cj-ligne]', { timeout: 40000 }).catch(() => {});
        // l'écran se pose (lectures, cartes) : on attend deux relevés identiques
        let avant = '', egaux = 0;
        for (let k = 0; k < 20 && egaux < 2; k++) { await o.pg.waitForTimeout(800); const s = await o.pg.evaluate(() => (document.querySelector('.vrm-main') || {}).innerText || ''); if (s && s === avant) egaux++; else egaux = 0; avant = s; }
        const m = await o.pg.evaluate(MESURE);
        dit(m.ecran === 'journee' && m.n > 5, `${T} Aujourd'hui est rendu (${m.n} boutons)`, m.ecran);
        dit(!m.hors.length, `${T} B1 chaque bouton tient dans sa carte (${m.hors.length} dehors)`, m.hors.slice(0, 4));
        dit(!m.coupes.length, `${T} B2 le texte de chaque bouton tient dedans (${m.coupes.length} coupés)`, m.coupes.slice(0, 4));
        if (process.env.SHOTS) await o.pg.screenshot({ path: path.join(process.env.SHOTS, `journee-${W}-${sombre ? 'sombre' : 'clair'}.png`) });
      } catch (e) { dit(false, `${T} le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 400)); }
      await o.ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} journee-1280 : ${ok} OK · ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
