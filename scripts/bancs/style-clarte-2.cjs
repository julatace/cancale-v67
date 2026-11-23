require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  STYLE ET CLARTÉ, TRANCHE 2 (22 nov. soir, maquettes de Julien — docs/passation/2026-11-22-style-clarte.md §6)
//    T1 Annonces (1512) : UNE recherche à l'écran (celle du tableau) et pas de bande vide au-dessus de la barre d'outils ;
//    T2 le tableau : rangées denses (≤ 64 px), cadre à bord fin, en-tête sur un fond distinct de la carte ;
//    T3 la barre de sélection (une annonce cochée) est NOIRE (l'encre) et son plein est clair ;
//    T4 la fiche d'une annonce (1512) : le prix en très grand (≥ 40 px) ;
//    T5 rien ne déborde, aucune erreur d'app (390 et 1512).
//  `BANC_DIST=<dist d'avant>` : rouge sur la tranche 1 (T1, T2, T3, T4). `SHOTS=…` les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-style-clarte-2');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); } return c; };
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(5000); };

async function annonces(nav, b, W) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: false, b, url: '/?tab=cat_annonces' });
  try {
    await pret(pg);
    await pg.waitForSelector('[data-tt-ligne]', { timeout: 15000 }).catch(() => {});
    const m = await pg.evaluate(() => {
      const vis = (x) => !!x && x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden';
      const champs = [...document.querySelectorAll('.vrm-main input[type="search"], .vrm-main .n-recherche input, .vrm-main .vrm-barre-recherche input')].filter(vis).length;
      const outils = document.querySelector('.n-tt-outils'), titre = document.querySelector('.vrm-main h1, .n-page-titre');
      const lignes = [...document.querySelectorAll('tr[data-tt-ligne]')].filter(vis).map((x) => Math.round(x.getBoundingClientRect().height));
      const cadre = document.querySelector('.n-tt-cadre'), th = document.querySelector('.n-tt-th');
      const cs = cadre ? getComputedStyle(cadre) : null;
      return { champs, ecart: outils && titre ? Math.round(outils.getBoundingClientRect().top - titre.getBoundingClientRect().bottom) : null, lignes: lignes.slice(0, 5),
        bord: cs ? cs.borderTopWidth : '', fondTh: th ? getComputedStyle(th).backgroundColor : '', fondCadre: cs ? cs.backgroundColor : '', deborde: document.documentElement.scrollWidth - innerWidth };
    });
    if (W >= 1024) {
      dit(m.champs === 1 && m.ecart != null && m.ecart <= 120, `T1 ${W} : une seule recherche, pas de bande vide au-dessus des outils`, m);
      dit(m.lignes.length > 0 && m.lignes.every((h) => h <= 64) && m.bord !== '0px' && m.fondTh && m.fondTh !== m.fondCadre && m.fondTh !== 'rgba(0, 0, 0, 0)', `T2 ${W} : rangées denses, cadre à bord fin, en-tête distinct`, m);
    }
    dit(m.deborde <= 1, `T5 ${W} : rien ne déborde (Annonces)`, m.deborde);
    await pg.screenshot({ path: path.join(SHOTS, `annonces-${W}.png`) });
    if (W >= 1024) {
      await pg.locator('tr[data-tt-ligne] .n-tt-cible-case').first().click({ timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(600);
      const s = await pg.evaluate(() => { const b = document.querySelector('[data-tt-barre-sel]'); if (!b) return null; const p = b.querySelector('[data-tt-lancer]');
        const lum = (c) => { const x = (c.match(/\d+(\.\d+)?/g) || []).map(Number); return x.length >= 3 ? (x[0] * 299 + x[1] * 587 + x[2] * 114) / 1000 : -1; };
        return { fond: lum(getComputedStyle(b).backgroundColor), plein: p ? lum(getComputedStyle(p).backgroundColor) : -1 }; });
      dit(s && s.fond >= 0 && s.fond < 60 && s.plein > 200, `T3 ${W} : la barre de sélection est noire, son plein clair`, s);
      await pg.screenshot({ path: path.join(SHOTS, `annonces-selection-${W}.png`) });
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.locator('tr[data-tt-ligne] .n-tt-article').first().click({ timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(1500);
      const f = await pg.evaluate(() => { const v = document.querySelector('.nf-prix-valeur'); return v ? parseFloat(getComputedStyle(v).fontSize) : null; });
      dit(f != null && f >= 40, `T4 ${W} : la fiche, le prix en très grand`, f);
      await pg.screenshot({ path: path.join(SHOTS, `fiche-${W}.png`) });
    }
    dit(!erreurs.length, `T5 ${W} : aucune erreur d'app`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}

async function ventes(nav, b, W) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: false, b, url: '/?tab=ventes' });
  try {
    await pret(pg);
    const d = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    dit(d <= 1, `T5 ${W} : rien ne déborde (Ventes)`, d);
    await pg.screenshot({ path: path.join(SHOTS, `ventes-${W}.png`) });
    dit(!erreurs.length, `T5 ${W} : Ventes sans erreur d'app`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try {
    for (const W of [1512, 390]) { console.log(`\n── ${W}`); await annonces(nav, b, W); await ventes(nav, b, W); }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} style-clarte-2 : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
