// ════════════════════════════════════════════════════════════════════════════
//  BANC « ACCESSIBILITÉ — ZOOM 200 % ET CLAVIER SEUL » (11 nov., lot accessibilité, suite).
//  Socle et données INVENTÉES : `_a11y.cjs` (le même que `accessibilite.cjs`). Aucune écriture.
//
//  Z. ZOOM 200 % (WCAG 1.4.4 / 1.4.10) : un écran de 1512 px zoomé à 200 % = 756 px CSS de large,
//     2 pixels par pixel CSS (ce que fait le navigateur). Sur chaque écran principal, en clair :
//      Z1 la PAGE ne défile pas en largeur ;
//      Z2 aucun texte COUPÉ sans moyen de le lire : un texte qui dépasse la boîte qui le rogne
//         (overflow hidden/clip) sans `title` ni nom qui le contienne (sur lui ou un parent proche)
//         est rouge. Une rangée qui défile (overflow auto/scroll) se lit en la faisant défiler.
//  K. CLAVIER SEUL (1512 px) :
//      K1 chaque entrée de la colonne de navigation est atteinte par Tab depuis le haut de la
//         page, et Entrée y mène (l'écran change) — chaque écran est atteignable au clavier ;
//      K2 sur chaque écran (clair ET sombre), les 40 premiers arrêts de Tab : le focus est
//         toujours VISIBLE — un contour (outline, ombre, bordure ou fond) qui APPARAÎT au focus,
//         avec un contraste ≥ 3:1 contre ce qui l'entoure (WCAG 2.4.7, et 2.4.11 de 2.2) ; et
//         jamais sur un élément invisible ou caché.
//  BANC_MUTATION=focus|largeur|coupe : la PREUVE que le contrôle sait échouer — la page est
//  sabotée après son ouverture (focus sans contour ; un bloc de 2000 px ; un texte rogné sans
//  title) et Z1/Z2/K2 doivent sortir rouges.
//  BANC_PORT, BANC_DIST, BANC_CAPTURES, BANC_ECRANS=a,b, BANC_SEUL=Z|K, BANC_DUMP=1.
// ════════════════════════════════════════════════════════════════════════════
const A = require('./_a11y.cjs');
const { dit, essaie } = A;

// Z2 : les textes rognés sans moyen de les lire (dans la page).
const textesCoupes = (pg) => pg.evaluate(() => {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const rognant = (el) => {
    for (let x = el, i = 0; x && x !== document.body && i < 8; x = x.parentElement, i++) {
      const cs = getComputedStyle(x);
      if (/^(auto|scroll)$/.test(cs.overflowX)) return null;          // il défile : lisible
      if (/^(hidden|clip)$/.test(cs.overflowX) || cs.textOverflow === 'ellipsis') return x;
    }
    return null;
  };
  const lisibleAilleurs = (el, t) => {
    for (let x = el, i = 0; x && i < 5; x = x.parentElement, i++) {
      const s = ((x.getAttribute && (x.getAttribute('title') || x.getAttribute('aria-label') || x.getAttribute('data-plein'))) || '');
      if (s && s.replace(/\s+/g, ' ').includes(t.slice(0, 40))) return true;
    }
    return false;
  };
  let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.replace(/\s+/g, ' ').trim(); if (t.length < 2) continue;
    // (un texte caché au LECTEUR mais affiché compte : c'est l'œil qui le lit coupé)
    const el = n.parentElement; if (!el || el.closest('[inert],script,style,.vrm-sr-seul,[hidden]')) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    const boite = rognant(el); if (!boite) continue;
    const c = boite.getBoundingClientRect();
    if (c.width <= 2 || c.height <= 2) continue;                          // motif « lecteur d'écran seul »
    const coupe = b.right > c.right + 2 || b.left < c.left - 2 || (boite.scrollWidth > boite.clientWidth + 1 && getComputedStyle(boite).textOverflow === 'ellipsis' && boite.contains(el));
    if (!coupe) continue;
    if (lisibleAilleurs(el, t)) continue;
    out.push(`${Math.round(b.width)}>${Math.round(c.width)} « ${t.slice(0, 60)} » dans ${(boite.className || boite.tagName).toString().slice(0, 50)}`);
  }
  return [...new Set(out)];
});

// Z1 (suite) : un élément VISIBLE qui dépasse le bord droit de l'écran — la page ne défile pas
// (un parent rogne) mais ce morceau est perdu. Une rangée qui défile (overflow auto/scroll), un
// élément caché ou hors du flux visible (translaté hors écran, `inert`, aria-hidden) est écarté.
const horsEcran = (pg) => pg.evaluate(() => {
  const out = []; const W = document.documentElement.clientWidth;
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.right <= W + 2 || r.left >= W) continue;
    if (e.closest('[aria-hidden="true"],[inert],[hidden],.vrm-sr-seul')) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    let defile = false;
    for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const c = getComputedStyle(x); if (/^(auto|scroll)$/.test(c.overflowX)) { defile = true; break; } if (+c.opacity === 0 || c.visibility === 'hidden') { defile = true; break; } }
    if (defile) continue;
    // Seul le plus haut élément fautif est dit (ses enfants dépassent avec lui).
    if (e.parentElement && e.parentElement.getBoundingClientRect().right > W + 2 && e.parentElement !== document.body) continue;
    out.push(`${Math.round(r.right - W)} px : ${(e.outerHTML || '').replace(/\s+/g, ' ').slice(0, 100)}`);
  }
  return out;
});

// K2 : l'indicateur de focus de l'élément actif (dans la page).
const lireFocus = (pg) => pg.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return { rien: true };
  const rgba = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const melange = (c, fond) => (c.a >= 1 ? c : { r: c.r * c.a + fond.r * (1 - c.a), g: c.g * c.a + fond.g * (1 - c.a), b: c.b * c.a + fond.b * (1 - c.a), a: 1 });
  const fondDe = (x) => {
    const pile = [];
    for (let y = x; y; y = y.parentElement) { const c = rgba(getComputedStyle(y).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } }
    let f = { r: 255, g: 255, b: 255, a: 1 };
    if (!pile.length || pile[pile.length - 1].a < 1) f = document.documentElement.getAttribute('data-theme') === 'dark' ? { r: 0, g: 0, b: 0, a: 1 } : f;
    for (let i = pile.length - 1; i >= 0; i--) f = melange(pile[i], f);
    return f;
  };
  // L'indicateur peut être posé sur l'élément, ses pseudo-éléments, un parent proche (`:has`,
  // `:focus-within`) ou un enfant direct (la pastille du « ? » d'aide) : on lit tout, avant et après.
  const cibles = [[el, null], [el, '::before'], [el, '::after'], [el.parentElement, null], [el.parentElement && el.parentElement.parentElement, null],
    ...[...el.children].slice(0, 3).map((c) => [c, null])].filter((x) => x[0]);
  const lire = () => cibles.map(([x, p]) => { const s = getComputedStyle(x, p); return { o: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1 ? s.outlineColor : '', ow: parseFloat(s.outlineWidth) || 0, sh: s.boxShadow, bc: s.borderTopColor, bw: parseFloat(s.borderTopWidth) || 0, bg: s.backgroundColor }; });
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  // Un contrôle natif transparent posé SUR son habillage (le <select> du tri, à opacité 0, couvre
  // son bouton dessiné) est « visible » si cet habillage l'est et le couvre.
  const p = el.parentElement, pr = p && p.getBoundingClientRect(), pcs = p && getComputedStyle(p);
  const habille = +cs.opacity === 0 && p && pcs.visibility !== 'hidden' && +pcs.opacity > 0 && pr.width > 0 && Math.abs(pr.left - r.left) < 2 && Math.abs(pr.top - r.top) < 2 && Math.abs(pr.width - r.width) < 2 && Math.abs(pr.height - r.height) < 2;
  const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && (+cs.opacity > 0 || habille) && r.bottom > -2 && r.right > -2 && r.top < innerHeight * 4 && r.left < innerWidth + 2;
  const cache = !!el.closest('[aria-hidden="true"]');
  const avec = lire();
  el.setAttribute('data-banc-focus', '1'); el.blur();
  const sans = lire();
  el.focus({ preventScroll: true });
  // Ce qui APPARAÎT au focus, et son contraste avec ce qui l'entoure.
  let meilleur = 0, quoi = '';
  avec.forEach((a, i) => {
    const s = sans[i]; const x = cibles[i][0];
    const fondAutour = fondDe(x.parentElement || x);
    if (a.o && (a.o !== s.o || a.ow !== s.ow)) { const c = rgba(a.o); if (c) { const k = contraste(melange(c, fondAutour), fondAutour); if (k > meilleur) { meilleur = k; quoi = 'outline'; } } }
    if (a.sh !== s.sh && a.sh && a.sh !== 'none') {
      for (const m of a.sh.matchAll(/rgba?\([^)]+\)/g)) { const c = rgba(m[0]); if (c) { const k = contraste(melange(c, fondAutour), fondAutour); if (k > meilleur) { meilleur = k; quoi = 'ombre'; } } }
    }
    if (a.bw >= 1 && a.bc !== s.bc) { const c = rgba(a.bc), d = rgba(s.bc); if (c && d) { const f = fondDe(x); const k = contraste(melange(c, f), melange(d, f)); if (k > meilleur) { meilleur = k; quoi = 'bordure'; } } }
    if (a.bg !== s.bg) { const c = rgba(a.bg), d = rgba(s.bg); if (c && d) { const f = fondDe(x.parentElement || x); const k = contraste(melange(c, f), melange(d, f)); if (k > meilleur) { meilleur = k; quoi = 'fond'; } } }
  });
  el.removeAttribute('data-banc-focus');
  return { visible, cache, contraste: Math.round(meilleur * 100) / 100, quoi, html: (el.outerHTML || '').replace(/\s+/g, ' ').slice(0, 110) };
});

const MUTATION = process.env.BANC_MUTATION || '';
const saboter = (pg) => (!MUTATION ? null : pg.evaluate((m) => {
  const main = document.querySelector('main') || document.body;
  if (m === 'focus') { const st = document.createElement('style'); st.textContent = '*,*::before,*::after,*:focus,*:focus-visible,*:focus-within{outline:none!important;box-shadow:none!important;transition:none!important}'; document.head.appendChild(st); }
  if (m === 'largeur') { const d = document.createElement('div'); d.style.cssText = 'width:2000px;height:4px'; main.prepend(d); }
  if (m === 'coupe') { const d = document.createElement('div'); d.style.cssText = 'width:80px;overflow:hidden;white-space:nowrap'; d.textContent = 'Un texte bien trop long pour sa boîte de quatre-vingts pixels'; main.prepend(d); }
}, MUTATION));
async function main() {
  A.srv.listen(A.PORT);
  const b = await A.lancerNavigateur();
  const ECR = (process.env.BANC_ECRANS || '').split(',').filter(Boolean);
  const SEUL = process.env.BANC_SEUL || '';
  const garde = (tab) => !ECR.length || ECR.includes(tab);
  try {
    // ── Z. Zoom 200 % ───────────────────────────────────────────────────────
    if (!SEUL || SEUL === 'Z') for (const [tab, nom, url] of A.ECRANS) {
      if (!garde(tab)) continue;
      await essaie(`🔍 ${nom}`, async () => {
        const { pg, ctx, errs } = await A.ouvrir(b, { largeur: 1512, zoom: 2, sombre: false, tab, url });
        await saboter(pg);
        await A.finirAnimations(pg);
        await A.capture(pg, `zoom200-${tab}`);
        const deb = await pg.evaluate(() => { const d = document.scrollingElement || document.documentElement; return { sw: d.scrollWidth, cw: d.clientWidth }; });
        dit(deb.sw <= deb.cw + 1, `🔍 ${nom} · Z1 zoom 200 % : la page ne défile pas en largeur`, JSON.stringify(deb));
        const hors = await horsEcran(pg);
        dit(hors.length === 0, `🔍 ${nom} · Z1 zoom 200 % : rien ne sort de l'écran par la droite (contenu perdu)`, `${hors.length} : ` + hors.slice(0, 5).join(' ║ '));
        const c = await textesCoupes(pg);
        dit(c.length === 0, `🔍 ${nom} · Z2 zoom 200 % : aucun texte coupé sans moyen de le lire`, `${c.length} : ` + c.slice(0, 6).join(' ║ '));
        if (process.env.BANC_DUMP) c.forEach((x) => console.log('       · ' + x));
        dit(errs.length === 0, `🔍 ${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
    // ── K1. Chaque écran atteint au clavier ─────────────────────────────────
    if (!SEUL || SEUL === 'K') await essaie('⌨️ K1', async () => {
      const { pg, ctx, errs } = await A.ouvrir(b, { largeur: 1512, sombre: false, tab: 'journee' });
      const entrees = await pg.evaluate(() => [...document.querySelectorAll('.vrm-sidebar [data-nav-entree]')].filter((e) => e.getClientRects().length).map((e) => e.getAttribute('data-nav-entree')));
      dit(entrees.length >= 8, '⌨️ K1 la colonne de navigation a ses entrées', JSON.stringify(entrees));
      const rates = [];
      for (const cible of entrees) {
        await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur(); } catch (_) {} window.scrollTo(0, 0); });
        await pg.mouse.click(2, 2).catch(() => {});                       // le haut de la page, hors de tout contrôle
        await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur(); } catch (_) {} });
        let trouve = false;
        for (let i = 0; i < 80 && !trouve; i++) {
          await pg.keyboard.press('Tab');
          trouve = await pg.evaluate((c) => { const a = document.activeElement; return !!(a && a.getAttribute && a.getAttribute('data-nav-entree') === c && a.closest('.vrm-sidebar')); }, cible);
        }
        if (!trouve) { rates.push(cible + ' (pas atteinte)'); continue; }
        const avant = await pg.evaluate(() => location.search + '|' + (document.querySelector('main[data-ecran]') || {}).getAttribute?.('data-ecran'));
        await pg.keyboard.press('Enter'); await pg.waitForTimeout(900);
        const apres = await pg.evaluate(() => ({ s: location.search + '|' + (document.querySelector('main[data-ecran]') || {}).getAttribute?.('data-ecran'), courant: (document.querySelector(`.vrm-sidebar [aria-current="page"]`) || {}).getAttribute?.('data-nav-entree') }));
        if (apres.courant !== cible && apres.s === avant) rates.push(cible + ' (Entrée sans effet)');
      }
      dit(rates.length === 0, `⌨️ K1 chaque écran de la colonne est atteint par Tab et ouvert par Entrée (${entrees.length})`, rates.join(', '));
      dit(errs.length === 0, '⌨️ K1 aucune erreur de page', errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
    // ── K2. Le focus toujours visible ───────────────────────────────────────
    if (!SEUL || SEUL === 'K') for (const sombre of [false, true]) for (const [tab, nom, url] of A.ECRANS) {
      if (!garde(tab)) continue;
      const T = `⌨️${sombre ? '🌙' : '☀️'}`;
      await essaie(`${T} ${nom}`, async () => {
        const { pg, ctx, errs } = await A.ouvrir(b, { largeur: 1512, sombre, tab, url });
        await saboter(pg);
        await A.finirAnimations(pg);
        await pg.mouse.click(2, 2).catch(() => {});
        await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur(); } catch (_) {} });
        const pbVisibles = [], pbIndic = [], vus = new Set(); let dansMain = 0;
        for (let i = 0; i < 40; i++) {
          await pg.keyboard.press('Tab'); await pg.waitForTimeout(40);
          const f = await lireFocus(pg);
          if (f.rien) continue;
          if (vus.has(f.html)) continue; vus.add(f.html);
          if (await pg.evaluate(() => !!(document.activeElement && document.activeElement.closest('main')))) dansMain++;
          if (!f.visible || f.cache) pbVisibles.push(`${f.cache ? 'caché au lecteur' : 'invisible'} : ${f.html}`);
          else if (f.contraste < 3) pbIndic.push(`${f.contraste ? f.contraste + ':1 (' + f.quoi + ')' : 'aucun contour'} : ${f.html}`);
        }
        dit(dansMain > 0, `${T} ${nom} · K2 Tab entre dans le contenu de l'écran`, `${vus.size} arrêts, aucun dans <main>`);
        dit(pbVisibles.length === 0, `${T} ${nom} · K2 le focus ne va jamais sur un élément invisible ou caché`, `${pbVisibles.length} : ` + pbVisibles.slice(0, 4).join(' ║ '));
        dit(pbIndic.length === 0, `${T} ${nom} · K2 le focus est toujours visible (contour ≥ 3:1)`, `${pbIndic.length} : ` + pbIndic.slice(0, 5).join(' ║ '));
        if (process.env.BANC_DUMP) [...pbVisibles, ...pbIndic].forEach((x) => console.log('       · ' + x));
        dit(errs.length === 0, `${T} ${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  } finally { await b.close(); A.srv.close(); }
  const { ok, ko } = A.compte();
  console.log(`\n${ok} ✅ · ${ko} ❌ — captures : ${A.CAPTURES}`);
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
