require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA MÊME PHRASE RÉPÉTÉE SOUS CHAQUE LIGNE (24 nov., livrable — Julien : « je veux que tous les designs de merde
//  soient corrigés » ; CLAUDE.md §7 : « une même phrase sur chaque ligne est UNE phrase (dans l'en-tête du groupe) »).
//  Sur l'app RENDUE (base du banc, `_base-volume.cjs`), chaque écran principal, 390 tactile et 1512 : on relève les
//  textes VISIBLES d'au moins 3 mots (un titre d'article, « N°… », un montant ne comptent pas : on retire chiffres et
//  numéros avant de comparer) ; une même phrase DE L'APP (écrite dans src/ — jamais un titre d'article ni le message
//  d'un acheteur) dessinée 3 fois ou plus sur l'écran est une RÉPÉTITION.
//  R1 aucun écran ne dépasse son PLAFOND (le nombre de phrases répétées relevé le 24 nov.) — il ne fait que DESCENDRE ;
//  R2 la carte « Relancer au bon moment » (Ma journée) ne répète plus son geste sous chaque ligne (0 phrase répétée
//     dans `[data-rf-carte]`) et chaque ligne Vinted reste UN geste (`[data-rf-geste]`, le lien du panneau).
//  `INVENTAIRE=1` imprime les phrases ; `ECRANS=a,b` ; `SHOTS=…` ; `BANC_DIST=…` pour juger un autre build.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { base, srv, PORT, chromium } = P;
const PLAFONDS = { 'journee@390': 0, 'cat_annonces@390': 0, 'ventes@390': 0, 'achats@390': 0, 'compta@390': 0, 'messages@390': 0, 'settings@390': 0,
  'journee@1512': 0, 'cat_annonces@1512': 0, 'ventes@1512': 0, 'achats@1512': 0, 'compta@1512': 0, 'messages@1512': 0, 'settings@1512': 0 };
const ECRANS = (process.env.ECRANS || 'journee,cat_annonces,ventes,achats,compta,messages,settings').split(',');
const LARGEURS = (process.env.LARGEURS || '390,1512').split(',').map(Number);
// Seul le TEXTE DE L'APP compte (une phrase écrite dans src/, dictionnaire `fr` compris) : les titres d'articles,
// les messages des acheteurs (données du banc) se répètent légitimement.
const norme = (t) => String(t).replace(/N°\s*\S+/gi, '#').replace(/[\d\s.,€%:+·–—-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const LITTERAUX = (() => {
  const exact = new Set(), motifs = [];
  const lire = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!/^(langues)$/.test(f.name) || true) lire(p); continue; }
    if (!/\.(jsx?|mjs)$/.test(f.name) || /langues[\/](en|es|it|de)[\/]/.test(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(/(['"`])((?:(?!\1)[^\n\\]|\\.){6,300})\1/g)) {
      const brut = m[2];
      if (/\{[a-zA-Z_]+\}|\$\{/.test(brut)) { const morceaux = brut.split(/\{[a-zA-Z_]+\}|\$\{[^}]*\}/).map(norme);
        if (morceaux.join(' ').split(' ').filter((w) => /\p{L}{2,}/u.test(w)).length >= 2) motifs.push(new RegExp('^' + morceaux.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'u')); }
      else exact.add(norme(brut));
    } } };
  lire(path.join(__dirname, '..', '..', 'src'));
  return { a: (cle) => exact.has(cle) || motifs.some((r) => r.test(cle)) };
})();
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? ' — ' + String(d).slice(0, 700) : '')); } };
function repetes(racineSel) {
  const vu = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden') return false;
    for (let x = el; x && x.nodeType === 1; x = x.parentElement) if (Number(getComputedStyle(x).opacity) < 0.05) return false;
    return !el.closest('details:not([open]) > :not(summary), [aria-hidden="true"], [hidden], [inert], .vrm-sr-seul, .n-lu-seul, input, textarea, select'); };
  const racine = document.querySelector(racineSel); if (!racine) return null;
  const n = new Map();
  for (const el of racine.querySelectorAll('*')) {
    const t = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const cle = t.replace(/N°\s*\S+/gi, '#').replace(/[\d\s.,€%:+·–—-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (cle.split(' ').filter((w) => /\p{L}{2,}/u.test(w)).length < 3 || !vu(el)) continue;
    n.set(cle, (n.get(cle) || 0) + 1);
  }
  return [...n].filter(([, k]) => k >= 3).map(([t, k]) => [t, k]);
}
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base(); const inv = {};
  try {
    for (const W of LARGEURS) for (const e of ECRANS) {
      const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, sombre: false, b, url: '/?tab=' + e });
      try {
        await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(Number(process.env.ATTENTE || 12000));
        // Ce qui se monte au défilement (cartes du bas de Ma journée) : on parcourt l'écran jusqu'en bas.
        for (let i = 0; i < 12; i++) {
          const fini = await pg.evaluate(() => { const s = [document.scrollingElement, ...document.querySelectorAll('body *')].filter((x) => x && x.scrollHeight > x.clientHeight + 40 && (x === document.scrollingElement || /auto|scroll/.test(getComputedStyle(x).overflowY))).sort((a, b2) => b2.clientHeight - a.clientHeight)[0];
            if (!s) return true; const av = s.scrollTop; s.scrollTop += s.clientHeight * 0.8; return s.scrollTop === av; });
          await pg.waitForTimeout(700); if (fini) break;
        }
        if (e === 'journee') await pg.waitForSelector('[data-rf-carte]', { timeout: 15000 }).catch(() => {});
        const L0 = await pg.evaluate(repetes, '.vrm-main'); const L = L0 && L0.filter(([t]) => LITTERAUX.a(t)).map(([t, k]) => `${k}× ${t.slice(0, 60)}`); const cle = `${e}@${W}`; inv[cle] = L ? L.length : null;
        dit(L != null && L.length <= PLAFONDS[cle], `R1 ${cle} : ${L ? L.length : '?'} phrases répétées 3 fois ou plus (plafond ${PLAFONDS[cle]})`, L && L.join(' ¦ '));
        if (process.env.INVENTAIRE && L && L.length) console.log('     ' + L.join('\n     '));
        if (e === 'journee') {
          const rf = await pg.evaluate(() => { const s = document.querySelector('[data-rf-carte]'); if (!s) return null;
            return { g: [...s.querySelectorAll('[data-rf-ligne][data-rf-plateforme="vinted"]')].map((li) => li.querySelectorAll('[data-rf-geste][data-vrm-panneau-lien]').length) }; });
          if (rf) rf.rep = await pg.evaluate(repetes, '[data-rf-carte]');
          if (rf && rf.rep) rf.rep = rf.rep.filter(([t]) => LITTERAUX.a(t)).map(([t, k]) => `${k}× ${t.slice(0, 60)}`);
          if (rf) {
            dit(rf.rep && rf.rep.length === 0, `R2 ${e}@${W} « Relancer au bon moment » : aucune phrase répétée sous les lignes (${rf.rep ? rf.rep.length : '?'})`, rf.rep && rf.rep.join(' ¦ '));
            dit(rf.g.length > 0 && rf.g.every((k) => k === 1), `R2 ${e}@${W} chaque ligne Vinted est UN geste vers le panneau de l'extension (${rf.g.join(',')})`);
          } else console.log(`  · ${e}@${W} : pas de carte « Relancer au bon moment » rendue`);
        }
        if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(process.env.SHOTS, `rep-${e}-${W}.png`) }); }
        if (erreurs.length) console.log('     erreurs : ' + erreurs.join(' | ').slice(0, 200));
      } finally { await ctx.close(); }
    }
  } catch (e) { dit(false, 'banc', String(e && e.message || e).slice(0, 300)); }
  finally { await nav.close(); srv.close(); }
  if (process.env.INVENTAIRE) console.log('INVENTAIRE ' + JSON.stringify(inv));
  console.log(`\n${ko ? '❌' : '✅'} phrases-repetees : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
