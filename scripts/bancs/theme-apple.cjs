require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LE STYLE « APPLE » (18 nov.) — src/designV2/theme-apple.css, src/designV2/style.js, Paramètres → Apparence → Style.
//  Base INVENTÉE (design-passe.cjs, `_base-volume`, 3 comptes), garde réseau : rien ne sort.
//  Écrans : Aujourd'hui, Annonces, Achats, Ventes, Stock, Argent, Paramètres — 390 tactile clair ET nuit, 1512 clair.
//  Ce qu'il MESURE, sur l'app RENDUE, style allumé :
//    A. aucun dégradé BLEU visible (le fond, le ::before de la coque, toute surface de plus de 40 × 40) ;
//    B. contraste : chaque texte visible ≥ 4,5:1 (3:1 en gros) contre le fond EFFECTIF (fonds empilés composés) ;
//    C. un seul bouton principal (plein) visible par écran ;
//    D. cibles : chaque bouton visible de la v2 et de la barre fait ≥ 44 px au doigt (390) ;
//    E. le réglage : « Apple » touché dans Paramètres → la racine porte `data-theme-style="apple"`, et après un
//       rechargement aussi (le choix TIENT) ; « Studio bleu » l'enlève ;
//    F. éteint (le défaut) : aucun attribut, le dégradé bleu d'hier est là, et chaque règle de la couche `vrm-apple`
//       est sous `[data-theme-style="apple"]` (rien ne fuit sur l'ancien style).
//  Preuve par mutation : MUTATION=gris (le gris redevient #AEAEB2) ⇒ B rouge ; MUTATION=degrade (le fond bleu
//  revient) ⇒ A rouge ; MUTATION=deux (un second bouton plein) ⇒ C rouge ; MUTATION=persiste (le choix n'est pas
//  rangé) ⇒ E rouge ; MUTATION=fuite (une règle hors du sélecteur) ⇒ F rouge.
//  `ECRANS=…` `SHOTS=…` ; les captures servent à REGARDER (contraste, rien coupé, rien superposé).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-theme-apple');
fs.mkdirSync(SHOTS, { recursive: true });
const MUT = process.env.MUTATION || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 600) : '')); } return c; };
const ECRANS = [['journee', '/?tab=journee'], ['annonces', '/?tab=annonces'], ['achats', '/?tab=achats'], ['ventes', '/?tab=ventes'], ['stock', '/?tab=garage'], ['argent', '/?tab=argent'], ['parametres', '/?tab=settings']]
  .filter(([k]) => !process.env.ECRANS || process.env.ECRANS.split(',').includes(k));

// Les mesures, dans la page (aucune dépendance) : couleurs normalisées par un canevas 1×1.
function mesurer() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (s) => { if (!s || s === 'transparent') return [0, 0, 0, 0]; cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const sur = (h, b) => [0, 1, 2].map((i) => h[i] * h[3] + b[i] * (1 - h[3])).concat(1);
  const vis = (e) => { if (!e.getClientRects().length) return false; const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false; const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 0 && r.height > 0; };
  const cache = new Map();
  // Le fond effectif d'un élément : ses ancêtres, composés du plus haut (opaque) au plus proche. Une image (photo,
  // dégradé) sous le texte ⇒ « pas su » (jamais jugé).
  const fond = (e) => { const pile = []; let x = e, img = false;
    while (x && x.nodeType === 1) { const s = getComputedStyle(x); if (s.backgroundImage && s.backgroundImage !== 'none' && !/^linear-gradient\((rgb|#|color)/.test(s.backgroundImage) ) { img = true; break; }
      const c = rgba(s.backgroundColor); if (c[3] > 0) { pile.push(c); if (c[3] >= .99) break; } x = x.parentElement; }
    if (img) return null; let b = rgba(getComputedStyle(document.documentElement).backgroundColor); if (b[3] < 1) b = [255, 255, 255, 1];
    for (let i = pile.length - 1; i >= 0; i--) b = sur(pile[i], b); return b; };
  // B. Le contraste de chaque texte (un nœud texte non vide, son parent visible).
  const faibles = []; let jugés = 0;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vus = new Set();
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.trim(); if (!t || t.length < 2) continue; const e = n.parentElement; if (!e || vus.has(e)) continue; vus.add(e);
    if (e.closest('svg, [aria-hidden="true"], .vrm-boot, [data-vrm-boot-texte], .vrm-toasts, img, canvas, video, [data-banc-ignore]') || !vis(e)) continue;
    const s = getComputedStyle(e); const fs_ = parseFloat(s.fontSize); if (fs_ < 6) continue;
    const r = document.createRange(); r.selectNodeContents(n); const rr = r.getBoundingClientRect(); if (rr.width <= 2 || rr.height <= 2 || rr.bottom < 0 || rr.top > innerHeight) continue;
    { const er = e.getBoundingClientRect(); if (er.width <= 2 || er.height <= 2) continue; }   // un texte réservé au lecteur d'écran (1 × 1, rogné) ne se voit pas
    const b = fond(e); if (!b) continue; let c = rgba(s.color); const op = [...(function* () { let x = e; while (x) { yield Number(getComputedStyle(x).opacity); x = x.parentElement; } })()].reduce((a, v) => a * v, 1);
    // Un texte DÉSACTIVÉ (bouton indisponible, raison dite à côté) n'est pas jugé : WCAG 1.4.3 l'exempte.
    if (e.closest('[disabled], [aria-disabled="true"]')) continue;
    c = [c[0], c[1], c[2], c[3] * op]; const cf = sur(c, b);
    const L1 = lum(cf), L2 = lum(b); const k = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const gros = fs_ >= 24 || (fs_ >= 18.66 && Number(s.fontWeight) >= 700); jugés++;
    if (k < (gros ? 3 : 4.5)) faibles.push({ t: t.slice(0, 40), k: Math.round(k * 100) / 100, c: s.color, f: 'rgb(' + b.slice(0, 3).map(Math.round).join(',') + ')', cl: (e.className && String(e.className).slice(0, 50)) || e.tagName });
  }
  // A. Les dégradés BLEUS : le fond, le ::before de la coque, toute surface visible de plus de 40 × 40.
  const bleu = (s) => (s.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi) || []).some((c) => { const [r, g, b, a] = rgba(c); return a > .2 && b > r + 40 && b > g + 10; });
  const degrades = [];
  const coque = document.querySelector('.vrm-app-shell'); const avant = coque ? getComputedStyle(coque, '::before').backgroundImage : 'none';
  if (/gradient/.test(avant) && bleu(avant)) degrades.push({ où: 'coque::before', img: avant.slice(0, 120) });
  for (const x of [document.documentElement, document.body]) { const i = getComputedStyle(x).backgroundImage; if (/gradient/.test(i) && bleu(i)) degrades.push({ où: x.tagName, img: i.slice(0, 120) }); }
  for (const x of document.querySelectorAll('body *')) { const r = x.getBoundingClientRect(); if (r.width < 40 || r.height < 40) continue; const i = getComputedStyle(x).backgroundImage; if (i === 'none' || !/gradient/.test(i)) continue; if (!vis(x)) continue; if (bleu(i)) degrades.push({ où: String(x.className).slice(0, 40) || x.tagName, img: i.slice(0, 100) }); if (degrades.length > 8) break; }
  // C. Les boutons principaux visibles (le plein de la v2 et d'hier).
  const principaux = [...document.querySelectorAll('button.v2b-principal, .vrm-b.vrm-b-primaire')].filter(vis).filter((x) => !x.closest('[role="dialog"], .vrm-fs'));
  // D. Les cibles de la v2 et de la barre d'onglets (le système qu'on habille).
  const petites = [...document.querySelectorAll('button.v2b, button.v2-rangee, button.v2-seg-btn, .vrm-tabbar > .vrm-tab, .vrm-ios-switch, [data-style]')].filter(vis)
    .map((x) => { const r = x.getBoundingClientRect(); return { t: (x.textContent || x.getAttribute('aria-label') || '').trim().slice(0, 24), h: Math.round(r.height), w: Math.round(r.width) }; })
    .filter((x) => x.h < 44 || x.w < 44);
  return { jugés, faibles: faibles.slice(0, 12), nFaibles: faibles.length, degrades, principaux: principaux.map((x) => x.textContent.trim().slice(0, 30)), petites: petites.slice(0, 10), attr: document.documentElement.getAttribute('data-theme-style') };
}

async function ouvrir(nav, W, sombre, url, avecStyle) {
  const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, sombre, b: P.base(), url, dsf: W < 600 ? 2 : 1 });
  await pg.addInitScript(([on, mut]) => { try { if (on && !sessionStorage.getItem('banc_style')) { localStorage.setItem('vrm_style', 'apple'); sessionStorage.setItem('banc_style', '1'); } } catch (_) {} }, [avecStyle, MUT]);
  await pg.goto('http://localhost:' + P.PORT + url, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 45000 }).catch(() => {});
  await pg.waitForTimeout(4500);
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
  if (MUT === 'gris') await pg.addStyleTag({ content: 'html[data-theme-style="apple"]{--ap-gris:#AEAEB2 !important}' });
  // (dans la couche vrm-apple : hors couche, la mutation perdrait contre ses !important et ne prouverait rien)
  if (MUT === 'degrade') await pg.addStyleTag({ content: '@layer vrm-apple { html[data-theme-style="apple"] body .vrm-app-shell[data-espace].vrm-app-shell::before { background: linear-gradient(170deg, #2563A8, #0E2C52) !important } }' });
  if (MUT === 'deux') await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) { for (let i = 0; i < 2; i++) { const b = document.createElement('button'); b.className = 'v2b v2b-principal'; b.textContent = 'Essai'; m.prepend(b); } } });
  await pg.waitForTimeout(300);
  return { ctx, pg, erreurs };
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    // ── A–D : chaque écran, style allumé ──
    for (const [W, sombre] of [[390, false], [390, true], [1512, false]]) {
      const th = sombre ? 'nuit' : 'jour';
      for (const [k, url] of ECRANS) {
        const { ctx, pg, erreurs } = await ouvrir(nav, W, sombre, url, true);
        const m = await pg.evaluate(mesurer);
        console.log(`\n── ${k} · ${W} · ${th} — ${m.jugés} textes jugés`);
        dit(m.attr === 'apple', `${k} ${W} ${th} : le style est posé (data-theme-style="apple")`, m.attr);
        dit(!m.degrades.length, `${k} ${W} ${th} : aucun dégradé bleu`, m.degrades);
        dit(m.jugés >= 5 && m.nFaibles === 0, `${k} ${W} ${th} : contraste ≥ 4,5:1 (3:1 en gros) partout (${m.nFaibles} sous le seuil)`, m.faibles);
        dit(m.principaux.length <= 1, `${k} ${W} ${th} : un seul bouton principal (${m.principaux.length})`, m.principaux);
        if (W < 600) dit(!m.petites.length, `${k} ${W} ${th} : cibles ≥ 44 px`, m.petites);
        dit(!erreurs.length, `${k} ${W} ${th} : aucune erreur JS`, erreurs);
        await pg.screenshot({ path: path.join(SHOTS, `${k}-${W}-${th}.png`) });
        await ctx.close();
      }
    }
    // ── E : le réglage, touché comme lui, tient au rechargement ──
    {
      const { ctx, pg } = await ouvrir(nav, 390, false, '/?tab=settings', false);
      const avant = await pg.evaluate(() => document.documentElement.getAttribute('data-theme-style'));
      dit(avant === null, 'éteint par défaut : aucun data-theme-style', avant);
      // Le réglage est dans la page Apparence de Paramètres : on la cherche comme lui (le bouton « Apple »).
      const ap = pg.locator('[data-sous-ouvrir="apparence"]').first();
      await ap.waitFor({ timeout: 30000 }).catch(() => {});
      if (await ap.count()) { await ap.click().catch(() => {}); await pg.waitForTimeout(900); }
      const b = pg.locator('[data-style="apple"]').first();
      await b.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
      if (MUT === 'persiste') await pg.evaluate(() => { Storage.prototype.setItem = function () {}; });
      await b.click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(800);
      const pose = await pg.evaluate(() => ({ a: document.documentElement.getAttribute('data-theme-style'), c: (document.querySelector('[data-style="apple"]') || {}).getAttribute && document.querySelector('[data-style="apple"]').getAttribute('aria-checked') }));
      dit(pose.a === 'apple' && pose.c === 'true', '« Apple » touché : le style s’allume aussitôt, coché', pose);
      await pg.screenshot({ path: path.join(SHOTS, 'reglage-style-390-jour.png') });
      await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3000);
      const apres = await pg.evaluate(() => document.documentElement.getAttribute('data-theme-style'));
      dit(apres === 'apple', 'après un rechargement, le choix tient', apres);
      await ctx.close();
    }
    // ── F : éteint, l'ancien style est intact ──
    {
      const { ctx, pg } = await ouvrir(nav, 390, false, '/?tab=journee', false);
      const f = await pg.evaluate((mut) => {
        if (mut === 'fuite') { const s = document.createElement('style'); s.textContent = '@layer vrm-apple { body .vrm-main { background: #F2F2F7 !important } }'; document.head.appendChild(s); }
        const hors = [];
        // Un sélecteur coupé à ses virgules de premier niveau (jamais celles d'un :is(…) ou d'un :not(…)).
        const decouper = (t) => { const out = []; let p = 0, c = ''; for (const ch of t) { if (ch === '(') p++; if (ch === ')') p--; if (ch === ',' && !p) { out.push(c); c = ''; } else c += ch; } out.push(c); return out; };
        const voir = (rules, dansCouche) => { for (const r of rules) {
          if (r instanceof CSSLayerBlockRule) voir(r.cssRules, dansCouche || r.name === 'vrm-apple');
          else if (r.cssRules && !(r instanceof CSSStyleRule)) voir(r.cssRules, dansCouche);
          else if (dansCouche && r.selectorText) for (const s of decouper(r.selectorText)) if (!/data-theme-style="apple"/.test(s)) hors.push(s.trim().slice(0, 80));
        } };
        for (const sh of document.styleSheets) { try { voir(sh.cssRules, false); } catch (_) {} }
        const coque = document.querySelector('.vrm-app-shell');
        return { attr: document.documentElement.getAttribute('data-theme-style'), avant: coque ? getComputedStyle(coque, '::before').backgroundImage.slice(0, 80) : null, hors: hors.slice(0, 6), nHors: hors.length };
      }, MUT);
      dit(f.attr === null && /gradient/.test(f.avant || ''), 'éteint : le fond bleu d’hier est là (Studio bleu inchangé)', f);
      dit(f.nHors === 0, 'chaque règle de la couche vrm-apple est sous [data-theme-style="apple"] : rien ne fuit sur l’ancien style', f.hors);
      await ctx.close();
    }
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); }
  await nav.close(); P.srv.close();
  console.log(`\n${ko ? '❌' : '✅'} theme-apple : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
