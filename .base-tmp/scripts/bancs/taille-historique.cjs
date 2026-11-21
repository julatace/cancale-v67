// ════════════════════════════════════════════════════════════════════════════
//  BANC (15 nov.) : PARAMÈTRES → TAILLE DU TEXTE, et L'HISTORIQUE sur la fiche d'une paire.
//  Récit : docs/passation/2026-11-15-atelier-arrivee.md
//  Base INVENTÉE (1 000 paires, 1 000 conversations : _base-messages-stock.cjs), garde réseau.
//    P1 Paramètres : la ligne « Taille du texte » existe ; ouverte, quatre choix (radios ≥ 44 px) ;
//    P2 « Très grand » ⇒ `html[data-grand-texte="tres"]`, l'échelle 1,36 posée (`--vrm-zoom`), rangée
//       sur CET appareil ; « Normal » ⇒ plus rien ; rien ne déborde de la page ;
//    P3 au rechargement, la taille choisie s'applique AVANT tout geste (Ma journée, 390) ;
//    F1 la fiche d'une paire (« Tout sur le N° ») montre l'HISTORIQUE (la frise datée) d'emblée ;
//       rien ne déborde.
//  390 tactile clair et 1512 sombre. Captures : SHOTS=dossier. `BANC_DIST=<dist>` : l'arbre de départ rougit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-taille-historique');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
const attendre = async (fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 250)); } return v; };

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const [W, sombre] of [[390, false], [1512, true]]) {
      const T = `${W}${sombre ? ' sombre' : ''}`;
      // ── P · Paramètres → Taille du texte ──
      let o;
      try {
        o = await P.ouvrir(nav, { W, sombre, b: B.baseVolume(), url: '/?tab=settings', api: B.apiVolume, dsf: W < 600 ? 2 : 1 });
        await P.pret(o.pg);
        const ligne = o.pg.locator('[data-sous-ouvrir="taille-texte"]').first();
        const existe = await ligne.count().catch(() => 0);
        dit(existe > 0, `${T} P1 · Paramètres : la ligne « Taille du texte »`);
        if (existe) {
          await ligne.scrollIntoViewIfNeeded().catch(() => {});
          if (o.tel) await ligne.tap(); else await ligne.click();
          const choix = await attendre(() => o.pg.evaluate(() => { const l = [...document.querySelectorAll('[data-taille-texte]')]; return l.length ? l.map((b) => ({ id: b.getAttribute('data-taille-texte'), h: Math.round(b.getBoundingClientRect().height), on: b.getAttribute('aria-checked') })) : null; }), 8000);
          dit(!!choix && choix.map((c) => c.id).join(',') === 'normal,grand,plusGrand,tresGrand' && choix.every((c) => c.h >= 44) && choix[0].on === 'true', `${T} P1 · quatre choix, ≥ 44 px, « Normal » coché`, choix);
          await o.pg.waitForTimeout(400); await o.pg.screenshot({ path: path.join(SHOTS, `reglages-taille-${W}-${sombre ? 'sombre' : 'clair'}.png`) });
          await o.pg.locator('[data-taille-texte="tresGrand"]').first().click();
          await o.pg.waitForTimeout(600);
          const m = await o.pg.evaluate(() => ({ g: document.documentElement.getAttribute('data-grand-texte'), z: document.documentElement.style.getPropertyValue('--vrm-zoom'), rangee: localStorage.getItem('vrm_taille_texte'), deborde: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
          dit(m.g === 'tres' && Number(m.z) >= 1.35 && m.rangee === 'tresGrand' && m.deborde <= 1, `${T} P2 · « Très grand » : l’app passe à l’échelle 1,36, rangée sur cet appareil, rien ne déborde`, m);
          await o.pg.waitForTimeout(400); await o.pg.screenshot({ path: path.join(SHOTS, `reglages-taille-${W}-${sombre ? 'sombre' : 'clair'}-tres.png`) });
          // P3 — au rechargement (Ma journée), la taille s'applique toute seule.
          await o.pg.goto(o.pg.url().replace(/\?.*$/, '') + '?tab=journee', { waitUntil: 'domcontentloaded' });
          await P.pret(o.pg);
          const r = await o.pg.evaluate(() => ({ g: document.documentElement.getAttribute('data-grand-texte'), z: document.documentElement.style.getPropertyValue('--vrm-zoom'), deborde: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
          dit(r.g === 'tres' && Number(r.z) >= 1.35 && r.deborde <= 1, `${T} P3 · au rechargement, Ma journée est en « Très grand », rien ne déborde`, r);
          await o.pg.screenshot({ path: path.join(SHOTS, `journee-tres-grand-${W}-${sombre ? 'sombre' : 'clair'}.png`) });
          await o.pg.evaluate(() => { try { localStorage.removeItem('vrm_taille_texte'); } catch (_) {} });
        }
        if (o.erreurs.length) dit(false, `${T} P · aucune erreur de page`, o.erreurs.slice(0, 2));
      } catch (e) { dit(false, `${T} P · ouverture`, String(e.message || e).slice(0, 200)); }
      finally { if (o) await o.ctx.close().catch(() => {}); }
      // ── F · la fiche d'une paire : l'historique d'emblée ──
      let f;
      try {
        f = await P.ouvrir(nav, { W, sombre, b: B.baseVolume(), url: '/?tab=journee', api: B.apiVolume, dsf: W < 600 ? 2 : 1 });
        await P.pret(f.pg);
        await f.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '1205' })));
        const lt = await attendre(() => f.pg.evaluate(() => { const l = document.querySelector('[data-ligne-temps]'); return l ? { n: Number(l.getAttribute('data-lt-n')), sans: Number(l.getAttribute('data-lt-sans-date')), vue: (document.querySelector('[data-fiche-vue]') || {}).getAttribute ? document.querySelector('[data-fiche-vue]').getAttribute('data-fiche-vue') : '' } : null; }), 15000);
        dit(!!lt && lt.vue === 'temps', `${T} F1 · la fiche montre l’historique (la frise datée) d’emblée`, lt);
        const deb = await f.pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(deb <= 1, `${T} F1 · rien ne déborde`, deb);
        await f.pg.waitForTimeout(800);
        await f.pg.evaluate(() => { const l = document.querySelector('[data-ligne-temps]'); if (l) l.scrollIntoView({ block: 'start' }); });
        await f.pg.waitForTimeout(400);
        await f.pg.screenshot({ path: path.join(SHOTS, `fiche-historique-${W}-${sombre ? 'sombre' : 'clair'}.png`) });
        if (f.erreurs.length) dit(false, `${T} F · aucune erreur de page`, f.erreurs.slice(0, 2));
      } catch (e) { dit(false, `${T} F · ouverture`, String(e.message || e).slice(0, 200)); }
      finally { if (f) await f.ctx.close().catch(() => {}); }
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} taille-historique : ${ok} verts, ${ko} rouge(s) (captures : ${SHOTS})`);
  process.exit(ko ? 1 : 0);
})();
