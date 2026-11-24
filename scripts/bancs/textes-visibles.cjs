require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  TROP DE TEXTE À L'ÉCRAN (23 nov., Julien : « trop de texte, pas assez de beaux boutons » — CLAUDE.md §7)
//  Sur l'app RENDUE, chaque écran : on compte les textes VISIBLES de plus de 8 mots (un texte replié sous « Pourquoi ? »,
//  un `<details>` fermé, un texte masqué ou lu seulement par le lecteur d'écran ne comptent pas ; les champs non plus).
//  T1 aucun écran ne dépasse son PLAFOND (scripts/bancs/_textes-visibles-plafonds.cjs) : le plafond est ce que l'écran
//     montrait quand la règle a été posée, il ne fait que DESCENDRE (un chantier qui retire des phrases le baisse) ;
//  la CIBLE (au plus 3 textes longs par écran) est rapportée pour chaque écran au-dessus, sans rougir.
//  `INVENTAIRE=1` imprime les comptes (pour baisser les plafonds). `ECRANS=a,b`, `SHOTS=…`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { base, srv, PORT, chromium } = P;
const PLAFONDS = require('./_textes-visibles-plafonds.cjs');
const CIBLE = 3, MOTS = 8;
const ECRANS = (process.env.ECRANS || Object.keys(PLAFONDS).map((k) => k.split('@')[0]).filter((x, i, a) => a.indexOf(x) === i).join(',') || 'journee').split(',');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? ' — ' + String(d).slice(0, 700) : '')); } };
const MESURE = (mots) => {
  const vu = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    if (/inset\(50%\)|rect\(0/.test(cs.clipPath + ' ' + cs.clip)) return false;
    if (el.closest('details:not([open]) > :not(summary), [aria-hidden="true"], [hidden], [inert], .n-lu-seul, .vrm-sr-seul, .sr-only, .visually-hidden, input, textarea, select, .n-galerie, .n-pops')) return false; return true; };
  const longs = [];
  for (const el of document.querySelectorAll('.vrm-main *, [role="dialog"] *')) {
    const t = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (!t) continue; const n = t.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    if (n > mots && vu(el)) longs.push(t.slice(0, 70));
  }
  return [...new Set(longs)];
};
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base(); const inv = {};
  try {
    for (const W of [390, 1512]) for (const e of ECRANS) {
      const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, sombre: false, b, url: '/?tab=' + e });
      try {
        await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(6000);
        const L = await pg.evaluate(MESURE, MOTS); const cle = `${e}@${W}`; inv[cle] = L.length;
        const plafond = PLAFONDS[cle];
        if (plafond == null) { console.log(`  · ${cle} : ${L.length} textes longs (pas de plafond posé)`); }
        else dit(L.length <= plafond, `T1 ${cle} : ${L.length} textes longs visibles (plafond ${plafond})`, L.slice(0, 12).join(' ¦ '));
        if (L.length > CIBLE) console.log(`     à faire (cible ${CIBLE}) : ${L.slice(0, 6).join(' ¦ ')}`);
        if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(process.env.SHOTS, `${e}-${W}.png`) }); }
        if (erreurs.length) console.log('     erreurs : ' + erreurs.join(' | ').slice(0, 200));
      } finally { await ctx.close(); }
    }
  } finally { await nav.close(); srv.close(); }
  if (process.env.INVENTAIRE) console.log('INVENTAIRE ' + JSON.stringify(inv));
  console.log(`\n${ko ? '❌' : '✅'} textes-visibles : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
