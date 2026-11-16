require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  VENTES PLUS CLAIR (16 nov., lot ventes-clair — captures iPhone de Julien) — jugé sur l'app RENDUE.
//  Récit : docs/passation/2026-11-16-ventes-clair.md ; styles : src/design/ventes-clair.css ;
//  le repli : src/ventes/ARegarder.jsx.
//
//  Base inventée à la vraie forme (`_base-volume.cjs` : 3 comptes, 2 000 ventes), Ventes · Vinted · « Toutes ».
//  On juge la RÈGLE (data-*, nombres, géométrie), pas un libellé :
//  H  la 1re vente de la liste est VISIBLE sans défiler à 390 (son haut < 844 − la barre du bas) ;
//  D  aucun nombre redit : la ligne des étapes d'« À venir » (`data-a-venir-etapes`) se tait sur Ventes · Vinted, et la
//     bande du mois ne redit pas « À envoyer » / « En route » (le segment les porte) ;
//  R  « N choses à regarder » (`data-ventes-regarder` = N ≥ 1) : fermé, ses cartes (prix d'achat, après frais…)
//     ne se voient pas ; un toucher l'ouvre et elles se voient ;
//  L  une ligne de vente tient en trois lignes (≤ 96 px au téléphone), rien n'y dépasse à droite ;
//  F  les filtres de la liste sont entiers (aucun coupé par son conteneur) ;
//  C  contraste ≥ 4,5:1 : les chiffres de la bande du mois, « Sélectionner », la tête du repli.
//  `LARGEURS=390,1512` `THEMES=clair,sombre` ; `BANC_DIST=` le build jugé ; `SHOTS=` les captures.
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { fabriquer } = require('./_base-volume.cjs');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-ventes-clair');
fs.mkdirSync(SHOTS, { recursive: true });

function base() {
  const b = fabriquer({ comptes: 3, ventes: 2000 });
  const m = b.main[0].data; const at = '2026-11-01T10:00:00.000Z';
  Object.assign(m, { vrm_bienvenue_vue: { at }, vrm_visite_vue: { at }, vrm_je_vends: { choix: 'sneakers', at }, vrm_configuration: { etat: 'fait', at, statut: null, version: 1 },
    vrm_plateformes_affichees: { sites: ['vinted'], at }, vrm_parcours: { etat: 'fini', at }, vrm_bilan_minute: { vu: at, fin: 'vu' } });
  const vus = {}; for (const a of b.accounts) vus[a.vinted_user_id] = Date.now() - 120000;
  b.rows.push({ id: 'ext_appareil_0123456789abcdef', data: { appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: '5.375.0', code: '5.375.0', atMs: Date.now() - 60000, flux: {}, vus: { vinted: vus } } });
  return b;
}
const B = base();
const URL = '/?tab=ventes&site=vinted';

let ok = 0, ko = 0; const rouges = [];
const dit = (cond, quoi, detail) => { if (cond) { ok++; console.log('  ✅', quoi); } else { ko++; rouges.push(quoi); console.log('  ❌', quoi, detail !== undefined ? '— ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''); } };

function mesurer() {
  const vis = (el) => !!el && el.getClientRects().length > 0 && (!el.checkVisibility || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) && el.getBoundingClientRect().height > 1;
  const rgba = (s) => { const m = String(s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Le fond EFFECTIF : les fonds translucides s'empilent sur le premier fond opaque (ou la stop la plus défavorable d'un dégradé).
  const fonds = (el) => {
    const pile = [];
    for (let x = el; x; x = x.parentElement) {
      const cs = getComputedStyle(x); const c = rgba(cs.backgroundColor);
      if (c && c.a > 0) { pile.push(c); if (c.a >= 0.95) return [pile]; }
      if (cs.backgroundImage && /gradient/.test(cs.backgroundImage) && x !== el) { const st = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(rgba).filter((k) => k && k.a >= 0.95); if (st.length) return st.map((s0) => [...pile, s0]); }
    }
    return [[...pile, { r: 255, g: 255, b: 255, a: 1 }]];
  };
  const melange = (pile) => { let c = pile[pile.length - 1]; for (let i = pile.length - 2; i >= 0; i--) { const h = pile[i]; c = { r: h.r * h.a + c.r * (1 - h.a), g: h.g * h.a + c.g * (1 - h.a), b: h.b * h.a + c.b * (1 - h.a), a: 1 }; } return c; };
  const contraste = (el) => { const c = rgba(getComputedStyle(el).color); if (!c) return null; return Math.min(...fonds(el).map((p) => ratio(c, melange(p)))); };
  const lignes = [...document.querySelectorAll('.vrm-ventes-liste .vrm-sale-row[data-fu-forme]')].filter(vis);
  const l1 = lignes[0];
  const barre = document.querySelector('.vrm-bottom-nav, .vrm-barre-bas, nav[data-barre-bas]');
  const regarder = document.querySelector('[data-ventes-regarder]');
  const cartesRepli = regarder ? [...regarder.querySelectorAll('.vrm-ventes-regarder-corps > *')] : [];
  const filtres = [...document.querySelectorAll('.vrm-sales-workbar .vrm-filtres > button')].filter(vis);
  const coupes = filtres.filter((b) => { const r = b.getBoundingClientRect(); for (let x = b.parentElement; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.overflowX !== 'visible' || cs.overflow !== 'visible') { const q = x.getBoundingClientRect(); if (q.width < 2) continue; if (r.left < q.left - 1 || r.right > q.right + 1) return true; } } return r.right > window.innerWidth + 1 || r.left < -1; }).map((b) => b.textContent.trim());
  const hauteurs = lignes.slice(0, 12).map((l) => Math.round(l.getBoundingClientRect().height));
  const debord = lignes.slice(0, 12).filter((l) => { const r = l.getBoundingClientRect(); return [...l.querySelectorAll('*')].some((x) => { const q = x.getBoundingClientRect(); return q.width > 1 && vis(x) && q.right > r.right + 1; }); }).length;
  const bandes = [...document.querySelectorAll('.vrm-fu-ventes [data-fu-case-chiffre], .vrm-fu-ventes .vrm-fu-grand')].filter(vis).map((x) => ({ t: x.textContent.trim().slice(0, 12), c: contraste(x) }));
  const sel = document.querySelector('[data-serie-ouvrir]');
  const tete = regarder && regarder.querySelector('summary');
  return {
    iw: window.innerWidth, ih: window.innerHeight, barre: barre ? barre.getBoundingClientRect().top : window.innerHeight,
    premiere: l1 ? Math.round(l1.getBoundingClientRect().top) : null, n: lignes.length,
    etapes: [...document.querySelectorAll('[data-a-venir-etapes]')].filter(vis).length,
    redits: [...document.querySelectorAll('.vrm-fu-ventes :is([data-fu-case="aposter"], [data-fu-case="enroute"])')].filter(vis).length,
    regarder: regarder ? { n: regarder.getAttribute('data-ventes-regarder'), ouvert: regarder.open, cachee: !!regarder.hidden, visibles: cartesRepli.filter(vis).length, total: cartesRepli.length } : null,
    hauteurs, debord, coupes, nFiltres: filtres.length,
    bandes, sel: sel && vis(sel) ? contraste(sel) : null, tete: tete && vis(tete) ? contraste(tete.querySelector('span:nth-child(2)') || tete) : null,
  };
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      const t = `${W} ${th}`;
      const o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: B, url: URL });
      const { pg } = o;
      try {
        await P.pret(pg);
        if (!(await pg.evaluate(() => /site=vinted/.test(location.search)))) { await pg.goto(`http://localhost:${P.PORT}${URL}`, { waitUntil: 'domcontentloaded' }); await P.pret(pg); }
        await pg.evaluate(() => { const b = document.querySelector('[data-ventes-seg-choix="toutes"]'); if (b) b.click(); });
        for (let k = 0; k < 80; k++) { if (await pg.evaluate(() => document.querySelectorAll('.vrm-ventes-liste .vrm-sale-row[data-fu-forme]').length > 5)) break; await pg.waitForTimeout(400); }
        await pg.waitForTimeout(1500);
        await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
        await pg.waitForTimeout(300);
        const m = await pg.evaluate(mesurer);
        await pg.screenshot({ path: path.join(SHOTS, `ventes-${W}-${th}.png`) });
        console.log(`── ${t}`, JSON.stringify({ premiere: m.premiere, n: m.n, hauteurs: m.hauteurs.slice(0, 4), regarder: m.regarder }));
        dit(m.n > 0, `${t} : la liste des ventes est rendue`, m.n);
        if (W < 600) dit(m.premiere != null && m.premiere + 40 < m.barre, `H ${t} : la 1re vente est visible sans défiler (haut ${m.premiere} px, barre ${Math.round(m.barre)})`, m.premiere);
        dit(m.etapes === 0, `D ${t} : « À venir » ne redit pas les compteurs (étapes tues)`, m.etapes);
        dit(m.redits === 0, `D ${t} : la bande ne redit pas « À envoyer » / « En route » du segment`, m.redits);
        dit(!!m.regarder && Number(m.regarder.n) >= 1 && !m.regarder.ouvert && m.regarder.visibles === 0, `R ${t} : « N choses à regarder », fermé, ses cartes cachées`, m.regarder);
        if (W < 600) dit(m.hauteurs.length > 3 && Math.max(...m.hauteurs) <= 96, `L ${t} : chaque ligne de vente tient en trois lignes (≤ 96 px)`, m.hauteurs);
        dit(m.debord === 0, `L ${t} : rien ne dépasse d'une ligne de vente`, m.debord);
        dit(m.nFiltres >= 3 && m.coupes.length === 0, `F ${t} : les filtres sont entiers`, m.coupes);
        const bas = m.bandes.filter((x) => x.c != null && x.c < 4.5);
        dit(m.bandes.length > 0 && !bas.length, `C ${t} : chiffres de la bande lisibles (≥ 4,5:1)`, m.bandes);
        dit(m.sel == null || m.sel >= 4.5, `C ${t} : « Sélectionner » lisible`, m.sel);
        dit(m.tete != null && m.tete >= 4.5, `C ${t} : la tête du repli lisible`, m.tete);
        // R (suite) : un toucher ouvre le repli, ses cartes se voient.
        const tete = pg.locator('[data-ventes-regarder-ouvrir]').first();
        if (await tete.count()) {
          if (W < 600) await tete.tap().catch(() => {}); else await tete.click().catch(() => {});
          await pg.waitForTimeout(400);
          const r2 = await pg.evaluate(() => { const r = document.querySelector('[data-ventes-regarder]'); const c = r ? [...r.querySelectorAll('.vrm-ventes-regarder-corps > *')] : []; return { ouvert: !!(r && r.open), visibles: c.filter((x) => x.getClientRects().length && x.getBoundingClientRect().height > 1).length, total: c.length }; });
          dit(r2.ouvert && r2.visibles >= 1, `R ${t} : un toucher ouvre le repli, ses cartes se voient`, r2);
          await pg.screenshot({ path: path.join(SHOTS, `ventes-${W}-${th}-repli.png`) });
        }
        dit(!o.erreurs.filter((e) => !/ServiceWorker/.test(e)).length, `${t} : aucune erreur de page`, o.erreurs.join(' | '));
      } catch (x) { dit(false, `${t} : le passage s'est arrêté`, String(x).slice(0, 200)); } finally { await o.ctx.close(); }
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌${ko ? '\n' + rouges.map((r) => '  - ' + r).join('\n') : ''}`);
  process.exitCode = ko ? 1 : 0;
})();
