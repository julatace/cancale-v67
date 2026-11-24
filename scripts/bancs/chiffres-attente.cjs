require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';   // l'app telle qu'elle est servie (le design natif)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  UN CHIFFRE EN COURS DE LECTURE SE DESSINE EN SQUELETTE (24 nov., livrable — Julien : « écran de chargement etc.,
//  tout doit être parfait »). Récit : docs/passation/2026-11-24-livrable.md.
//  Sur l'app RENDUE, base du banc tenue (chaque réponse de la base attend BANC_LENT, 2,5 s par défaut) :
//   A. pendant la lecture, sur Aujourd'hui et Argent (le design servi, src/natif : héros, tuiles, cases, rangées d'Argent) (390 et 1512, clair et sombre), pas PLUS de « — » de chiffre
//      DESSINÉS (couleur de remplissage calculée non transparente) qu'une fois tout lu (les « pas su » légitimes),
//      et aucune raison « lecture… » / « Pas encore lu » visible ; au moins un squelette de chiffre (`data-chiffre-attente`) est là (sinon le banc n'a rien mesuré) ;
//   B. une lecture qui ne revient pas ne laisse pas un squelette éternel : à 17 s, le « — » est de nouveau dessiné ;
//   C. les données arrivées (base rapide, écran fini) : plus aucun `data-chiffre-attente`, des chiffres dessinés.
//  Le « — » reste dans la page (lecteur d'écran, bancs) : seul son dessin change (src/styles-chiffre-attente.css).
//  `BANC_DIST=…` pour juger un autre build (avant/après) ; `SHOTS=…` les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
process.env.BANC_LENT = process.env.BANC_LENT || '2500';
const LENT = process.env.BANC_LENT;
const P = require('./design-passe.cjs');
const { base, srv, PORT, chromium } = P;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? ' — ' + String(d).slice(0, 500) : '')); } };
const CHIFFRES = '.n-tuile-valeur, .n-heros-valeur, .n-heros-trio-v, .n-heros-trio-case dd, .n-cc-valeur, .n-arg-l-val, .n-arg-recu-n';
function mesure(CH) {
  const vu = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) return false;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') return false;
    // L'opacité EFFECTIVE (celle des parents compte : une raison cachée par son paragraphe ne se voit pas).
    for (let x = el; x && x.nodeType === 1; x = x.parentElement) if (Number(getComputedStyle(x).opacity) < 0.05) return false;
    return !el.closest('[hidden],[aria-hidden="true"]:not([data-fu-case-chiffre]),.vrm-sr-seul'); };
  const peint = (el) => { const c = getComputedStyle(el).webkitTextFillColor || ''; return !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(c); };
  const racine = document.body;
  const feuille = (el) => ![...el.children].some((c) => c.textContent.trim() === '—');   // le « — » lui-même, pas sa case
  const tirets = [...racine.querySelectorAll(CH)].filter((el) => el.textContent.trim() === '—' && feuille(el) && vu(el) && peint(el)).map((el) => el.className || el.tagName);
  const raisons = [];
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const t = w.currentNode.textContent.trim(); const el = w.currentNode.parentElement;
    if (/lecture…|^Pas encore lu$/.test(t) && el && vu(el)) raisons.push(t); }
  const osL = [...racine.querySelectorAll('[data-chiffre-attente]')].filter(vu); const os = osL.length;
  const osQui = osL.map((el) => el.className);
  const chiffresPeints = [...racine.querySelectorAll(CH)].filter((el) => /\d/.test(el.textContent) && vu(el) && peint(el)).length;
  return { tirets, raisons, os, osQui, chiffresPeints };
}
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try {
    // La fin d'un écran (base rapide) : ses « — » légitimes (pas su, dit) — pendant la lecture il n'en dessine pas PLUS.
    const fin = async (W, sombre, e) => {
      process.env.BANC_LENT = '0';
      const { ctx, pg } = await P.ouvrir(nav, { W, sombre, b, url: '/?tab=' + e });
      try { await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {});
        await pg.waitForFunction(() => !document.getElementById('vrm-demarrage') && !document.querySelector('.vrm-main [data-chiffre-attente]'), null, { timeout: 45000 }).catch(() => {});
        await pg.waitForTimeout(4000); return await pg.evaluate(mesure, CHIFFRES); } finally { await ctx.close(); }
    };
    for (const [W, sombre] of [[390, false], [390, true], [1512, false]]) for (const e of ['journee', 'compta']) {
      const cle = `${e}@${W}${sombre ? ' sombre' : ''}`;
      const F = await fin(W, sombre, e);
      process.env.BANC_LENT = LENT;
      const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, sombre, b, url: '/?tab=' + e });
      try {
        await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {});
        await pg.waitForFunction(() => !document.getElementById('vrm-demarrage'), null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(300);
        const m = await pg.evaluate(mesure, CHIFFRES);
        if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(process.env.SHOTS, `attente-${e}-${W}${sombre ? '-sombre' : ''}.png`) }); }
        dit(m.os > 0, `A ${cle} : la lecture est en cours (${m.os} chiffres en squelette)`);
        dit(m.tirets.length <= F.tirets.length, `A ${cle} : pendant la lecture, pas plus de « — » dessinés qu'une fois tout lu (${m.tirets.length} ≤ ${F.tirets.length})`, m.tirets.join(' ¦ '));
        dit(m.raisons.length === 0, `A ${cle} : aucune raison « lecture… » visible pendant la lecture (${m.raisons.length})`, m.raisons.join(' ¦ '));
        if (erreurs.length) console.log('     erreurs : ' + erreurs.join(' | ').slice(0, 200));
      } finally { await ctx.close(); }
    }
    // B. une base qui ne répond pas : le squelette rend la main à « — » au bout de 15 s.
    process.env.BANC_LENT = '60000';
    { const { ctx, pg } = await P.ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=compta' });
      try { await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(17500);
        const m = await pg.evaluate(mesure, CHIFFRES);
        dit(m.tirets.length > 0, `B compta@390 base muette : à 17 s, le « — » est de nouveau dessiné (${m.tirets.length}), jamais un squelette éternel`);
      } finally { await ctx.close(); } }
    // C. base rapide : les chiffres arrivent, plus aucun squelette.
    process.env.BANC_LENT = '0';
    { const { ctx, pg } = await P.ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=journee' });
      try { await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {});
        await pg.waitForFunction(() => !document.querySelector('.vrm-main [data-chiffre-attente]') && document.querySelector('.n-heros-valeur') && /\d/.test(document.querySelector('.n-heros-valeur').textContent), null, { timeout: 45000 }).catch(() => {});
        const m = await pg.evaluate(mesure, CHIFFRES);
        dit(m.os === 0 && m.chiffresPeints > 0, `C journee@390 données lues : plus aucun squelette (${m.os}), ${m.chiffresPeints} chiffres dessinés`, m.osQui.join(' ¦ '));
      } finally { await ctx.close(); } }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} chiffres-attente : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
