require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LE GRIS DE VRM.CENTER (23 nov., Julien : « le gris de l'écran d'accueil […] mais il faut que les infos ressortent bien »)
//  docs/passation/2026-11-23-style-gris.md. Mesuré sur l'app RENDUE, apparence PAR DÉFAUT (aucun choix posé) :
//    G1 l'app s'ouvre en SOMBRE quand rien n'est choisi, et le fond est le gris-ardoise de vrm.center (#1C1C20) ;
//    G2 chaque texte visible de chaque écran monté tient 4,5:1 sur ce qu'il y a derrière lui (3:1 au-dessus de 24 px, ou
//       18,66 px gras) — le fond est recomposé couche par couche (couleurs et transparences, opacités des parents) ;
//       un texte posé sur un DÉGRADÉ est jugé sur la couleur la plus claire de ce dégradé (le pire cas) ;
//    G3 les cartes sont plus claires que le fond (un cran) ; le héros d'Aujourd'hui s'en détache (écart de luminance) ;
//    G4 rien ne déborde, aucune erreur d'app.
//  `BANC_DIST=<dist d'avant>` : rouge sur l'app d'avant (G1 : clair par défaut). `SHOTS=…` les captures. `ECRANS=a,b`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-contraste-gris');
fs.mkdirSync(SHOTS, { recursive: true });
const ECRANS = (process.env.ECRANS || 'journee,cat_annonces,ventes,achats,compta,garage,messages,settings').split(',');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 900) : '')); } return c; };

// Le contexte de design-passe (session, base, routes), puis on RETIRE le choix d'apparence qu'il pose (`vinted_dark`) et on
// recharge : l'app doit s'ouvrir dans son apparence par défaut (les scripts d'ouverture passent dans l'ordre où ils sont posés).
async function ouvrirDefaut(nav, W, b, url) {
  const o = await P.ouvrir(nav, { W, sombre: false, b, url });
  await o.pg.addInitScript(() => { try { localStorage.removeItem('vinted_dark'); localStorage.removeItem('vrm_apparence'); } catch (_) {} });
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  o.erreurs.length = 0;
  return o;
}

const MESURE = () => {
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const sur = (h, f) => ({ r: h.r * h.a + f.r * (1 - h.a), g: h.g * h.a + f.g * (1 - h.a), b: h.b * h.a + f.b * (1 - h.a), a: 1 });
  const lum = (c) => { const t = [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; };
  const rapport = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // La couleur la plus claire d'un dégradé (le pire cas pour un texte clair) — et la plus sombre (pour un texte sombre).
  const arrets = (img) => (img.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}\b/g) || []).map((x) => { if (x[0] === '#') { const h = x.length === 4 ? x.slice(1).split('').map((c) => c + c).join('') : x.slice(1, 7); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }; } return parse(x); }).filter(Boolean);
  const racine = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  const fondDe = (el, clair) => {
    const couches = []; let x = el;
    while (x && x.nodeType === 1) { const cs = getComputedStyle(x); const img = cs.backgroundImage;
      if (img && img !== 'none' && /gradient/.test(img)) { const a = arrets(img).filter((c) => c.a > 0.5); if (a.length) { const pire = a.sort((p, q) => (clair ? lum(q) - lum(p) : lum(p) - lum(q)))[0]; couches.push({ ...pire, a: 1 }); break; } }
      const c = parse(cs.backgroundColor); if (c && c.a > 0) { couches.push(c); if (c.a >= 0.999) break; }
      x = x.parentElement; }
    let f = x && x.nodeType === 1 ? null : { ...racine, a: 1 };
    if (!f) f = { r: 28, g: 28, b: 32, a: 1 };
    for (let i = couches.length - 1; i >= 0; i--) f = couches[i].a >= 0.999 ? couches[i] : sur(couches[i], f);
    return f;
  };
  const opacite = (el) => { let o = 1, x = el; while (x && x.nodeType === 1) { o *= Number(getComputedStyle(x).opacity); x = x.parentElement; } return o; };
  const vu = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') return false; if (el.closest('[aria-hidden="true"], [hidden], [inert], .vrm-sensible-cache')) return false; return true; };
  const ko = [], vus = new Set(); let n = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (!vu(el)) continue;
    const t = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim();
    if (!t || t.length < 2 || !/[\p{L}\p{N}]/u.test(t)) continue;
    if (el.closest('input, textarea, select, svg, [disabled], [aria-disabled="true"]')) continue;
    const cs = getComputedStyle(el); const fc = parse(cs.color); if (!fc) continue;
    const o = opacite(el); if (o < 0.05) continue;
    const clair = lum(fc) > 0.4;
    const f = fondDe(el, clair);
    const c = sur({ ...fc, a: fc.a * o }, f);
    const taille = parseFloat(cs.fontSize), gras = Number(cs.fontWeight) >= 700;
    const seuil = taille >= 24 || (taille >= 18.66 && gras) ? 3 : 4.5;
    const k = rapport(c, f); n++;
    if (k < seuil - 0.005) { const cle = t.slice(0, 30); if (vus.has(cle)) continue; vus.add(cle); ko.push(`${cle} ${k.toFixed(2)}<${seuil}`); }
  }
  const fondApp = getComputedStyle(document.documentElement).getPropertyValue('--n-fond').trim();
  const carte = document.querySelector('.n-carte-corps, .n-tuile, .n-cc') ; const heros = document.querySelector('.n-heros');
  const lc = carte ? lum(fondDe(carte.firstElementChild || carte, false)) : null;
  return { n, ko, theme: document.documentElement.getAttribute('data-theme'), fondApp, lumCarte: lc, lumFond: lum(parse(getComputedStyle(document.body).backgroundColor) || racine),
    heros: heros ? arrets(getComputedStyle(heros).backgroundImage).map(lum) : null, deborde: document.documentElement.scrollWidth - innerWidth };
};

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try {
    for (const W of [390, 1512]) for (const e of ECRANS) {
      console.log(`\n── ${e} ${W}`);
      const { ctx, pg, erreurs } = await ouvrirDefaut(nav, W, b, '/?tab=' + e);
      try {
        await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(5500);
        const m = await pg.evaluate(MESURE);
        dit(m.theme === 'dark' && /^#1C1C20$/i.test(m.fondApp), `G1 ${e} ${W} : sans choix posé, l'app est en sombre, fond #1C1C20 (vrm.center)`, { theme: m.theme, fond: m.fondApp });
        dit(m.n > 5 && m.ko.length === 0, `G2 ${e} ${W} : chaque texte visible tient 4,5:1 (3:1 en grand) — ${m.n} textes mesurés`, m.ko.slice(0, 25));
        if (e === 'journee') {
          dit(m.lumCarte != null && m.lumCarte > m.lumFond, `G3 ${e} ${W} : les cartes sont plus claires que le fond`, { carte: m.lumCarte, fond: m.lumFond });
          dit(!!m.heros && m.heros.length > 0 && Math.max(...m.heros) > m.lumFond * 1.6, `G3 ${e} ${W} : le héros se détache du fond (son ardoise plus claire)`, m.heros);
        }
        dit(m.deborde <= 1 && !erreurs.length, `G4 ${e} ${W} : rien ne déborde, aucune erreur d'app`, { deborde: m.deborde, erreurs });
        await pg.screenshot({ path: path.join(SHOTS, `${e}-${W}.png`) });
      } finally { await ctx.close(); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} contraste-gris : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
