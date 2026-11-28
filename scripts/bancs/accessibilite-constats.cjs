// ════════════════════════════════════════════════════════════════════════════
//  BANC « LES CONSTATS DE L'AUDIT D'ACCESSIBILITÉ DU 28 NOV. » (lot boutons-donnees).
//
//  L'audit WCAG 2.1 AA du 28 nov. (axe-core : 0 violation) a relevé ce qu'axe ne voit pas. Ce banc les MESURE, sur l'app
//  RENDUE (le vrai `dist/`, base inventée `ecrans-verre-2.baseFiches()`, garde réseau : rien ne sort) :
//   F1 titre du document par écran (WCAG 2.4.2) : « <Écran> · VRM », différent d'un écran à l'autre ;
//   F2 contour d'un contrôle ≥ 3:1 (1.4.11) : le filet du champ de recherche contre son fond, en clair et en sombre ;
//   F3 interrupteur sur « non » (Paramètres) : son contour ≥ 3:1 contre la carte ;
//   F4 segmenté : le choix actif a un filet ≥ 3:1 contre le rail ;
//   F5 niveaux de titres (1.3.1) : aucun titre AVANT le h1 de l'écran (barre latérale), aucun niveau sauté sous le h1
//      (Argent, Ventes), aucun titre en double du h1 ;
//   F6 volet de vente à 1512 (2.4.3) : toucher une vente ⇒ le focus ENTRE dans le volet ; Échap le ferme ; le focus revient ;
//   F7 (lecture du code) l'erreur du code de double vérification est annoncée (role=alert) et reliée au champ ; les
//      champs de connexion portent aria-invalid / aria-describedby ;
//   F8 (lecture du code) les anciennes fenêtres de Republier, Compta (factures), Paramètres (suppression), l'éditeur
//      photo passent par `useModaleAccessible` / `ModaleAccessible` (role=dialog, aria-modal, focus piégé, Échap) ;
//   F9 la croix « × » d'une ancienne fenêtre a un nom (aria-label) dans les fichiers de F8.
//  `BANC_DIST=…` juge un autre build (avant : origin/main) ; F7–F9 lisent `SRC=<dossier src>` (défaut : src/ du dépôt).
//  `BANC_PORT`, `SORTIE` (captures). Rouge (sortie 1) au premier constat qui revient.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const E = require('./ecrans-verre-2.cjs');

const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'banc-accessibilite-constats');
fs.mkdirSync(SORTIE, { recursive: true });
const SRC = process.env.SRC || path.join(__dirname, '..', '..', 'src');
const res = [];
const ok = (id, vrai, quoi) => { res.push({ id, vrai: !!vrai, quoi }); console.log(`${vrai ? '✅' : '❌'} ${id} ${quoi}`); };

async function ouvrir(nav, W, sombre, url) {
  const o = await P.ouvrir(nav, { W, sombre, b: E.baseFiches(), url, api: B.apiVolume });
  await o.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await P.pret(o.pg);
  await o.pg.waitForTimeout(800);
  return o;
}
// Le contraste entre deux couleurs CSS calculées (rgb/rgba posées sur un fond).
const CONTRASTE = () => {
  window.__rgba = (s) => { const m = String(s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  window.__ratio = (a, b) => { const x = lum(a), y = lum(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100; };
  window.__melange = (h, bas) => ({ r: h.r * h.a + bas.r * (1 - h.a), g: h.g * h.a + bas.g * (1 - h.a), b: h.b * h.a + bas.b * (1 - h.a), a: 1 });
  window.__fond = (el) => { const cs = []; for (let p = el; p; p = p.parentElement) { const c = window.__rgba(getComputedStyle(p).backgroundColor); if (c && c.a > 0) { cs.push(c); if (c.a >= 1) break; } } let f = { r: 255, g: 255, b: 255, a: 1 }; for (let i = cs.length - 1; i >= 0; i--) f = window.__melange(cs[i], f); return f; };
  // La couleur d'un filet `inset 0 0 0 Npx <couleur>` dans un box-shadow (la dernière ombre « inset » qui en est un).
  window.__filet = (bs) => { const parts = String(bs || '').split(/,(?![^(]*\))/); for (const p of parts.reverse()) if (/inset/.test(p) && /0px 0px 0px [\d.]+px/.test(p)) return window.__rgba(p); return null; };
};

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    // ── F1 titre du document ──
    const titres = {};
    for (const [cle, url] of [['ventes', '/?tab=ventes'], ['annonces', '/?tab=annonces'], ['argent', '/?tab=dashboard'], ['parametres', '/?tab=settings']]) {
      const o = await ouvrir(nav, 1512, false, url);
      titres[cle] = await o.pg.title();
      await o.ctx.close();
    }
    const vals = Object.values(titres);
    ok('F1', vals.every((t) => / · VRM$/.test(t)) && new Set(vals).size === vals.length, `titre du document par écran : ${JSON.stringify(titres)}`);

    for (const sombre of [false, true]) {
      const th = sombre ? 'sombre' : 'clair';
      // ── F2 champ de recherche, F4 segmenté (Ventes 390) ──
      const o = await ouvrir(nav, 390, sombre, '/?tab=ventes');
      await o.pg.evaluate(CONTRASTE);
      const m = await o.pg.evaluate(() => {
        const r = document.querySelector('.n-recherche');
        const champ = r ? { filet: window.__filet(getComputedStyle(r).boxShadow), fond: window.__fond(r.parentElement || r) } : null;
        const cur = document.querySelector('.n-segmente-curseur');
        const seg = cur ? { filet: window.__filet(getComputedStyle(cur).boxShadow), rail: window.__fond(cur.parentElement) } : null;
        return {
          champ: champ && champ.filet ? window.__ratio(window.__melange(champ.filet, champ.fond), champ.fond) : null,
          seg: seg && seg.filet ? window.__ratio(window.__melange(seg.filet, seg.rail), seg.rail) : null,
        };
      });
      ok('F2', m.champ != null && m.champ >= 3, `(${th}) filet du champ de recherche contre son fond : ${m.champ}:1`);
      ok('F4', m.seg != null && m.seg >= 3, `(${th}) filet du choix actif du segmenté contre le rail : ${m.seg}:1`);
      await o.pg.screenshot({ path: path.join(SORTIE, `ventes-390-${th}.png`) }).catch(() => {});
      await o.ctx.close();
      // ── F3 interrupteur « non » (Paramètres, la 1re page qui en porte) ──
      const p = await ouvrir(nav, 1512, sombre, '/?tab=settings');
      await p.pg.evaluate(CONTRASTE);
      let sw = null;
      for (let i = 0; i < 12 && !sw; i++) {
        sw = await p.pg.evaluate(() => {
          const s = [...document.querySelectorAll('.vrm-switch:not([aria-checked="true"])')].find((x) => x.getClientRects().length);
          if (!s) return null;
          const av = getComputedStyle(s, '::before'); const f = window.__fond(s.parentElement || s);
          const filet = window.__filet(av.boxShadow); const rail = window.__rgba(av.backgroundColor);
          const railR = rail ? window.__ratio(window.__melange(rail, f), f) : 0;
          const filetR = filet ? window.__ratio(window.__melange(filet, f), f) : 0;
          return { r: Math.max(railR, filetR) };
        });
        if (!sw) { const n = p.pg.locator('#vrm-contenu .n-rangee[data-n-fin="chevron"], #vrm-contenu [data-param-section], #vrm-contenu .vrm-pm-cat-ligne').nth(i); if (await n.count()) { await n.click({ timeout: 3000 }).catch(() => {}); await p.pg.waitForTimeout(900); } }
      }
      ok('F3', sw && sw.r >= 3, `(${th}) contour de l'interrupteur « non » : ${sw ? sw.r : '— (aucun interrupteur trouvé)'}:1`);
      await p.ctx.close();
    }

    // ── F5 niveaux de titres (1512 clair) ──
    for (const [cle, url] of [['argent', '/?tab=dashboard'], ['ventes', '/?tab=ventes'], ['parametres', '/?tab=settings']]) {
      const o = await ouvrir(nav, 1512, false, url);
      const h = await o.pg.evaluate(() => {
        const hs = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter((x) => x.getClientRects().length && !x.closest('[aria-hidden="true"], [inert], [hidden]'));
        const i1 = hs.findIndex((x) => x.tagName === 'H1');
        const avant = i1 > 0 ? hs.slice(0, i1).map((x) => x.tagName + ' ' + x.textContent.trim().slice(0, 30)) : [];
        const sauts = []; let prec = 1;
        for (const x of hs.slice(Math.max(0, i1))) { const n = Number(x.tagName[1]); if (n > prec + 1) sauts.push(`${'h' + prec}→${x.tagName.toLowerCase()} « ${x.textContent.trim().slice(0, 30)} »`); prec = n; }
        const t1 = i1 >= 0 ? hs[i1].textContent.trim() : '';
        const doubles = hs.filter((x, i) => i !== i1 && t1 && x.textContent.trim() === t1).map((x) => x.tagName);
        return { avant, sauts: sauts.slice(0, 5), doubles, h1: t1 };
      });
      ok('F5', h.avant.length === 0 && h.sauts.length === 0 && h.doubles.length === 0, `(${cle}) h1 « ${h.h1} » · avant le h1 : ${JSON.stringify(h.avant)} · sauts : ${JSON.stringify(h.sauts)} · doublons du h1 : ${JSON.stringify(h.doubles)}`);
      await o.ctx.close();
    }

    // ── F6 volet de vente (1512) ──
    {
      const o = await ouvrir(nav, 1512, false, '/?tab=ventes');
      const ligne = o.pg.locator('[data-vn="ventes"] [role="row"] button, [data-vn="ventes"] .n-tt-ligne, [data-vn="ventes"] [data-tt-ligne]').first();
      let r = { entre: false, ferme: false, revient: false };
      if (await ligne.count()) {
        await ligne.click({ timeout: 4000 }).catch(() => {});
        await o.pg.waitForTimeout(700);
        r.entre = await o.pg.evaluate(() => { const a = document.querySelector('aside[data-vn-detail]'); return !!(a && a.contains(document.activeElement)); });
        await o.pg.screenshot({ path: path.join(SORTIE, 'volet-1512.png') }).catch(() => {});
        await o.pg.keyboard.press('Escape');
        await o.pg.waitForTimeout(500);
        r.ferme = await o.pg.evaluate(() => !document.querySelector('aside[data-vn-detail]'));
        r.revient = await o.pg.evaluate(() => !!(document.activeElement && document.activeElement !== document.body && document.activeElement.closest('[data-vn="ventes"]')));
      }
      ok('F6', r.entre && r.ferme && r.revient, `volet de vente : focus entré ${r.entre} · Échap ferme ${r.ferme} · focus rendu à la liste ${r.revient}`);
      await o.ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }

  // ── F7–F9 : le code ──
  const lire = (f) => { try { return fs.readFileSync(path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
  const cx = lire('ecrans/Connexion.jsx');
  const mfa = /data-mfa-erreur=""[^>]*role="alert"/.test(cx) && /data-mfa-code=""[\s\S]{0,400}aria-describedby=/.test(cx);
  const champs = /autoComplete="email"[\s\S]{0,300}aria-invalid=/.test(cx) && /id="vrm-cx-password"[\s\S]{0,400}aria-invalid=/.test(cx);
  ok('F7', mfa && champs, `erreur du code annoncée et reliée : ${mfa} · champs de connexion reliés à l'erreur : ${champs}`);
  const F8 = { 'ecrans/Republier.jsx': /const VoileAtelier[\s\S]{0,400}useModaleAccessible/, 'ecrans/Compta.jsx': /function InvoiceForm[\s\S]{0,200}useModaleAccessible[\s\S]*function InvoiceSettings[\s\S]{0,200}useModaleAccessible/,
    'ecrans/Reglages.jsx': /<ModaleAccessible onFermer=\{\(\)=>!delBusy/, 'ecrans/PhotoEditor.jsx': /<ModaleAccessible onFermer=\{onClose\}/ };
  const manque8 = Object.entries(F8).filter(([f, re]) => !re.test(lire(f))).map(([f]) => f);
  ok('F8', manque8.length === 0, `anciennes fenêtres accessibles${manque8.length ? ' — manquent : ' + manque8.join(', ') : ''}`);
  const sansNom = [];
  for (const f of Object.keys(F8)) { const s = lire(f); for (const m of s.matchAll(/<button\b[^>]*>\s*×\s*<\/button>/g)) if (!/aria-label=/.test(m[0])) sansNom.push(f); }
  ok('F9', sansNom.length === 0, `croix « × » sans nom : ${sansNom.length}${sansNom.length ? ' (' + [...new Set(sansNom)].join(', ') + ')' : ''}`);

  const rouges = res.filter((x) => !x.vrai);
  console.log(`\n${res.length - rouges.length}/${res.length} verts · captures : ${SORTIE}`);
  process.exitCode = rouges.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 2; });
