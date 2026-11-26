require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';   // l'app telle qu'elle est servie (le design natif)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  CE QUE L'ÉCRAN DIT PENDANT LA LECTURE, ET RIEN QUI SAUTE (24 nov., livrable-2). Récit : docs/passation/2026-11-24-livrable.md.
//   A1 Argent (390), base tenue : pendant la lecture, ni le bandeau « Pas encore calculé · Ouvrir Ventes »
//      (`[data-compta-pas-calcule]`) ni « pas calculé » / « ouvre Ventes » visibles — la publication de Ventes n'est
//      pas encore lue, elle n'est pas « absente » ;
//   A2 Argent (390), base rapide, la base du banc SANS publication de Ventes : une fois tout lu, le bandeau est là
//      (« — » et sa raison seulement quand c'est VRAIMENT pas su) ;
//   J1 Aujourd'hui (390 et 1512), base tenue : « Colis » et « Tes chiffres » ne bougent pas entre la fin de l'écran de
//      démarrage et la fin de la lecture (± 4 px) — le porte-monnaie et « Par site » tiennent leur place ;
//   C1 Aujourd'hui (390) : la phrase de chaque case à chiffre se lit en entier (jamais « Ouvre ton porte-monnai… ») ;
//   V1 Ventes (390), « À envoyer » : la ligne de détail d'aucune rangée n'est coupée (« sans bordereau · à véri… »),
//      et chaque morceau tient sur une ligne.
//  `BANC_DIST=…` pour juger un autre build ; `SHOTS=…`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { base, srv, PORT, chromium } = P;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? ' — ' + String(d).slice(0, 500) : '')); } };
const VU = `(el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let x = el; x && x.nodeType === 1; x = x.parentElement) { const c = getComputedStyle(x); if (c.visibility === 'hidden' || Number(c.opacity) < 0.05 || c.display === 'none') return false; } return !el.closest('[hidden],.vrm-sr-seul'); }`;
const ouvrir = async (nav, b, W, url, lent) => { process.env.BANC_LENT = String(lent); const o = await P.ouvrir(nav, { W, sombre: false, b, url }); return o; };
const finDemarrage = (pg) => pg.waitForFunction(() => !document.getElementById('vrm-demarrage') && document.querySelector('.vrm-main'), null, { timeout: 45000 }).catch(() => {});
const shot = async (pg, nom) => { if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(process.env.SHOTS, nom + '.png') }); } };
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try {
    // A1
    { const { ctx, pg } = await ouvrir(nav, b, 390, '/?tab=compta', 2500);
      try { await finDemarrage(pg); await pg.waitForTimeout(400);
        const m = await pg.evaluate((vu) => { const v = eval(vu); const bandeau = [...document.querySelectorAll('[data-compta-pas-calcule]')].filter(v).length;
          const txt = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const t = w.currentNode.textContent.trim(); if (/^(pas calculé|ouvre Ventes)$/.test(t) && v(w.currentNode.parentElement)) txt.push(t); }
          return { bandeau, txt }; }, VU);
        await shot(pg, 'argent-lecture-390');
        dit(m.bandeau === 0 && m.txt.length === 0, `A1 Argent 390 en lecture : ni « Pas encore calculé » ni « pas calculé / ouvre Ventes » (${m.bandeau} bandeau, ${m.txt.length} textes)`, m.txt.join(' ¦ '));
      } finally { await ctx.close(); } }
    // A2
    { const { ctx, pg } = await ouvrir(nav, b, 390, '/?tab=compta', 0);
      try { await finDemarrage(pg); await pg.waitForSelector('[data-compta-pas-calcule]', { timeout: 30000 }).catch(() => {});
        const n = await pg.evaluate(() => document.querySelectorAll('[data-compta-pas-calcule]').length);
        dit(n === 1, `A2 Argent 390 tout lu, aucune publication de Ventes : le bandeau le dit (${n})`);
      } finally { await ctx.close(); } }
    // J1
    for (const W of [390, 1512]) {
      const { ctx, pg } = await ouvrir(nav, b, W, '/?tab=journee', 1500);
      try { await finDemarrage(pg); await pg.waitForTimeout(300);
        const pos = () => pg.evaluate(() => Object.fromEntries(['colis', 'chiffres'].map((k) => { const e = document.querySelector(`.vrm-main [data-v2-bloc="${k}"]`); return [k, e ? Math.round(e.getBoundingClientRect().top) : null]; })));
        const a = await pos();
        await pg.waitForFunction(() => !document.querySelector('.vrm-main [data-v2-bloc-attente], .vrm-main [data-chiffre-attente]') && document.querySelector('.vrm-main [data-v2-bloc="portemonnaie"]'), null, { timeout: 45000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const z = await pos();
        await shot(pg, `journee-fin-${W}`);
        const bouge = ['colis', 'chiffres'].filter((k) => a[k] == null || z[k] == null || Math.abs(a[k] - z[k]) > 4);
        dit(!bouge.length, `J1 Aujourd'hui ${W} : Colis et Tes chiffres restent en place pendant la lecture (${JSON.stringify(a)} → ${JSON.stringify(z)})`, bouge.join(', '));
        if (W === 390) {
          const c = await pg.evaluate((vu) => { const v = eval(vu); return [...document.querySelectorAll('.vrm-main .n-cc-sous')].filter(v).filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 40)); }, VU);
          dit(!c.length, `C1 Aujourd'hui 390 : la phrase de chaque case à chiffre se lit en entier (${c.length} coupée)`, c.join(' ¦ '));
        }
      } finally { await ctx.close(); } }
    // V1
    { const { ctx, pg } = await ouvrir(nav, b, 390, '/?tab=ventes', 0);
      try { await finDemarrage(pg); await pg.waitForSelector('[data-vn-rang]', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(1500);
        const m = await pg.evaluate(() => { const rangs = [...document.querySelectorAll('.n-vt-rang')];
          const coupes = rangs.map((r) => r.querySelector('.n-rangee-sous-texte')).filter(Boolean).filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => e.textContent.slice(0, 50));
          const casses = [...document.querySelectorAll('.n-vt-rang .n-vt-morceau')].filter((e) => e.getClientRects().length > 1).map((e) => e.textContent);
          return { n: rangs.length, coupes, casses, sans: document.querySelectorAll('[data-vn-bordereau="attente"]').length }; });
        await shot(pg, 'ventes-390');
        dit(m.n > 0 && m.sans > 0 && !m.coupes.length, `V1 Ventes 390 : aucune ligne de détail coupée sur ${m.n} rangées (${m.sans} sans bordereau)`, m.coupes.slice(0, 4).join(' ¦ '));
        dit(!m.casses.length, `V1 Ventes 390 : chaque morceau tient sur une ligne (${m.casses.length} cassés)`, m.casses.slice(0, 4).join(' ¦ '));
      } finally { await ctx.close(); } }
  } catch (e) { dit(false, 'banc', String(e && e.message || e).slice(0, 300)); }
  finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} etats-justes : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
