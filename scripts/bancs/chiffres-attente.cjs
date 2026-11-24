require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  UN CHIFFRE EN COURS DE LECTURE SE DESSINE EN SQUELETTE (24 nov., livrable — Julien : « écran de chargement etc.,
//  tout doit être parfait »). Récit : docs/passation/2026-11-24-livrable.md.
//  Sur l'app RENDUE, base du banc tenue (chaque réponse de la base attend BANC_LENT, 2,5 s par défaut) :
//   A. pendant la lecture, sur Aujourd'hui et Argent (390 et 1512, clair et sombre), AUCUN « — » de chiffre n'est
//      DESSINÉ (couleur de remplissage calculée non transparente) et aucune raison « lecture… » / « Pas encore lu »
//      n'est visible ; au moins un squelette de chiffre (`data-attente`) est là (sinon le banc n'a rien mesuré) ;
//   B. une lecture qui ne revient pas ne laisse pas un squelette éternel : à 17 s, le « — » est de nouveau dessiné ;
//   C. les données arrivées (base rapide, écran fini) : plus aucun `data-attente`, des chiffres dessinés.
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
const CHIFFRES = '.sj-n, [data-fu-case-chiffre], .vrm-jv2-grand, .vrm-fu-grand, .vrm-argent-w-n';
function mesure(CH) {
  const vu = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) return false;
    const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && !el.closest('[hidden],[aria-hidden="true"]:not([data-fu-case-chiffre]),.vrm-sr-seul'); };
  const peint = (el) => { const c = getComputedStyle(el).webkitTextFillColor || ''; return !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(c); };
  const racine = document.querySelector('.vrm-main') || document.body;
  const tirets = [...racine.querySelectorAll(CH)].filter((el) => el.textContent.trim() === '—' && vu(el) && peint(el)).map((el) => el.className || el.tagName);
  const raisons = [];
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const t = w.currentNode.textContent.trim(); const el = w.currentNode.parentElement;
    if (/lecture…|^Pas encore lu$/.test(t) && el && vu(el)) raisons.push(t); }
  const os = [...racine.querySelectorAll('[data-attente]')].filter(vu).length;
  const chiffresPeints = [...racine.querySelectorAll(CH)].filter((el) => /\d/.test(el.textContent) && vu(el) && peint(el)).length;
  return { tirets, raisons, os, chiffresPeints };
}
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try {
    for (const [W, sombre] of [[390, false], [390, true], [1512, false]]) for (const e of ['journee', 'compta']) {
      const cle = `${e}@${W}${sombre ? ' sombre' : ''}`;
      process.env.BANC_LENT = LENT;
      const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, sombre, b, url: '/?tab=' + e });
      try {
        await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {});
        await pg.waitForFunction(() => !document.getElementById('vrm-demarrage'), null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(300);
        const m = await pg.evaluate(mesure, CHIFFRES);
        if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(process.env.SHOTS, `attente-${e}-${W}${sombre ? '-sombre' : ''}.png`) }); }
        dit(m.os > 0, `A ${cle} : la lecture est en cours (${m.os} chiffres en squelette)`);
        dit(m.tirets.length === 0, `A ${cle} : aucun « — » de chiffre dessiné pendant la lecture (${m.tirets.length})`, m.tirets.join(' ¦ '));
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
        await pg.waitForFunction(() => !document.querySelector('.vrm-main [data-attente]') && document.querySelector('[data-sj-tuile="envoyer"] .sj-n') && /\d/.test(document.querySelector('[data-sj-tuile="envoyer"] .sj-n').textContent), null, { timeout: 45000 }).catch(() => {});
        const m = await pg.evaluate(mesure, CHIFFRES);
        dit(m.os === 0 && m.chiffresPeints > 0, `C journee@390 données lues : plus aucun squelette (${m.os}), ${m.chiffresPeints} chiffres dessinés`);
      } finally { await ctx.close(); } }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} chiffres-attente : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
