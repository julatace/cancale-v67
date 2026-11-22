require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';   // l'app telle qu'elle est servie (pas le DOM d'avant des vieux bancs)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  STYLE ET CLARTÉ (22 nov., docs/passation/2026-11-22-style-clarte.md) — ce que Julien a demandé, mesuré sur l'app RENDUE.
//    C1 Aujourd'hui : la carte héros (bénéfice du mois) + le graphique (7 barres par défaut, 30 au choix) + le trio ;
//    C2 aucune tuile n'écrit un LIEN comme valeur (« Ouvrir Ventes », « Compléter ») ;
//    C3 au téléphone, les cartes d'Aujourd'hui sont à 16 px du bord (plus le cadre qui doublait la marge : 32 px) ;
//    C4 l'accent est l'encre (décision du 22 nov.) : --n-accent rendu = rgb(22, 24, 29) (nuit : rgb(244, 244, 245)) ;
//    C5 une seule ligne « extension » sur Aujourd'hui quand rien ne tourne (pas le groupe « En direct » + un autre message) ;
//    C6 la feuille « Ton extension » : ≤ 520 px de large à l'ordinateur, les comptes en groupes (À relire / À jour / …),
//       chaque rangée garde ses data-fraicheur-* ;
//    C7 les actions rondes : Imprimer porte data-v2-principal (LE plein), chaque disque ≥ 44 × 44 au doigt ;
//    C8 rien ne déborde à 390 ni à 1512.
//  `BANC_DIST=<dist d'avant>` : rouge sur origin/main (C1, C2 si la base le montre, C3, C4, C5, C6, C7). `SHOTS=…` les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-style-clarte');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(4500); };

async function journee(nav, b, W, sombre) {
  const t = `${W} ${sombre ? 'sombre' : 'clair'}`;
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, b, url: '/?tab=journee' });
  try {
    await pret(pg);
    await pg.waitForSelector('[data-v2-bloc="pilotage"]', { timeout: 15000 }).catch(() => {});
    const m = await pg.evaluate(() => {
      const h = document.querySelector('[data-v2-bloc="pilotage"]');
      const tuiles = [...document.querySelectorAll('.n-tuile-valeur')].map((x) => x.textContent.trim());
      const cartes = [...document.querySelectorAll('.n-page-contenu .n-carte, .n-page-contenu .n-tuiles, .n-page-contenu .n-heros')].filter((x) => x.getClientRects().length).map((x) => Math.round(x.getBoundingClientRect().left));
      const acc = getComputedStyle(document.documentElement).getPropertyValue('--n-accent').trim();
      const sonde = document.createElement('span'); sonde.style.color = 'var(--n-accent)'; document.body.appendChild(sonde); const accRendu = getComputedStyle(sonde).color; sonde.remove();
      const direct = [...document.querySelectorAll('[data-direct-lieu="journee"]')];
      const enDirectTitre = direct.some((g) => /En direct/.test((g.querySelector('.n-groupe-titre') || { textContent: '' }).textContent));
      const imprimer = document.querySelector('.n-action-ronde[data-v2-principal]');
      const disques = [...document.querySelectorAll('.n-action-ronde')].map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
      return { heros: !!(h && h.matches('.n-heros')), barres: h ? h.querySelectorAll('.n-graphe-barre, .n-graphe-passu').length : 0, trio: h ? h.querySelectorAll('.n-heros-trio-case').length : 0,
        tuiles, cartes, accRendu, acc, direct: direct.length, enDirectTitre, court: direct.some((g) => g.hasAttribute('data-direct-court')), imprimer: !!imprimer, disques,
        deborde: document.documentElement.scrollWidth - innerWidth };
    });
    dit(m.heros && m.barres === 7 && m.trio === 3, `C1 ${t} : la carte héros, 7 barres (fenêtre 7 j), le trio`, m);
    dit(!m.tuiles.some((x) => /^(Ouvrir Ventes|Compléter)$/i.test(x)), `C2 ${t} : aucune tuile n'écrit un lien comme valeur`, m.tuiles);
    if (W < 600) dit(m.cartes.length > 0 && m.cartes.every((x) => x >= 12 && x <= 20), `C3 ${t} : les cartes à 16 px du bord (pas 32)`, m.cartes);
    dit(m.accRendu === (sombre ? 'rgb(244, 244, 245)' : 'rgb(22, 24, 29)'), `C4 ${t} : l'accent est l'encre`, m.accRendu);
    dit(!m.enDirectTitre || !m.court, `C5 ${t} : « En direct » sans en-tête quand rien ne tourne (une ligne)`, m);
    dit(m.imprimer && m.disques.length >= 3 && m.disques.every(([w, h]) => w >= 44 && h >= 44), `C7 ${t} : Imprimer = le plein des disques ; chaque disque ≥ 44`, m.disques);
    dit(m.deborde <= 1, `C8 ${t} : rien ne déborde`, m.deborde);
    await pg.screenshot({ path: path.join(SHOTS, `journee-${W}-${sombre ? 'sombre' : 'clair'}.png`) });
    // 30 jours : 30 barres
    await pg.locator('[data-v2-bloc="pilotage"] .n-segmente-choix').nth(1).click({ timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(500);
    const n30 = await pg.evaluate(() => { const h = document.querySelector('[data-v2-bloc="pilotage"]'); return h ? h.querySelectorAll('.n-graphe-barre, .n-graphe-passu').length : 0; });
    dit(n30 === 30, `C1 ${t} : « 30 j » montre 30 jours`, n30);
    // La feuille d'état de l'extension
    await pg.evaluate(() => window.dispatchEvent(new Event('vrm:etat-actions-ouvrir')));
    await pg.waitForFunction(() => { const x = document.querySelector('[data-fraicheur-comptes]'); return x && x.getAttribute('data-fraicheur-comptes') !== 'encours'; }, null, { timeout: 10000 }).catch(() => {});
    const f = await pg.evaluate(() => {
      const p = document.querySelector('.vrm-etat-panneau'); if (!p) return null;
      const r = p.getBoundingClientRect();
      return { l: Math.round(r.width), groupes: [...p.querySelectorAll('[data-ec-groupe]')].map((g) => g.getAttribute('data-ec-groupe')), lignes: p.querySelectorAll('[data-fraicheur-compte][data-fraicheur-id][data-fraicheur-etat]').length,
        deborde: p.scrollWidth > p.clientWidth + 1 };
    });
    dit(f && (W < 600 || f.l <= 520) && f.groupes.length >= 1 && f.lignes >= 1 && !f.deborde, `C6 ${t} : la feuille « Ton extension » compacte, comptes en groupes`, f);
    await pg.screenshot({ path: path.join(SHOTS, `extension-${W}-${sombre ? 'sombre' : 'clair'}.png`) });
    dit(!erreurs.length, `${t} : aucune erreur d'app`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try {
    for (const [W, s] of [[390, false], [390, true], [1512, false]]) { console.log(`\n── Aujourd'hui ${W} ${s ? 'sombre' : 'clair'}`); await journee(nav, b, W, s); }
  } catch (e) { ko++; console.log('  ❌ le banc a planté — ' + String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} style-clarte : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
