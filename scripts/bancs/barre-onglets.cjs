require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA BARRE D'ONGLETS — ses cinq styles (17 nov. soir ; src/designV2/barre.js, barre.css).
//  Julien : « prends la C et propose un menu déroulant, je choisirai le mieux ». Pour CHAQUE style (C, A, B, D, E),
//  à 390 clair, 390 sombre et 375 « Très grand » :
//    O1  l'onglet allumé = l'écran : chacun des cinq onglets touché ⇒ il porte `aria-current`, l'écran suit ;
//    O2  cibles ≥ 44 × 44 (la colonne entière) ;
//    O3  rien de coupé : chaque libellé montré tient dans sa boîte (pas d'ellipse) ; une pastille ne touche aucun libellé ;
//    O4  rien sous la barre : la page garde au moins la hauteur que la barre lui prend ;
//    O5  contraste : libellé montré ≥ 4,5:1, icône inactive ≥ 3:1, sur le fond de la barre ;
//    O6  un nom pour chaque onglet (lu par un lecteur d'écran, même quand le libellé est caché) ;
//  et une fois : Paramètres → Apparence → « Barre d'onglets » (menu natif + aperçu) change la barre TOUT DE SUITE,
//  et le choix tient après un rechargement (O7).
//  Mutations (rouge attendu) : MUTATION=coupe (libellés coupés à 18 px) ⇒ O3 ; MUTATION=dessous (la page ne garde plus
//  la place) ⇒ O4 ; MUTATION=pale (gris trop pâle) ⇒ O5.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium, pret } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-barre-onglets');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 600) : '')); } };
const MUT = process.env.MUTATION || '';
const CSS_MUT = { coupe: '.vrm-tabbar .vrm-nav-label{max-width:18px!important;overflow:hidden!important;text-overflow:ellipsis!important;opacity:1!important}',
  dessous: '.vrm-app-shell>.vrm-main{padding-bottom:0!important}', pale: '.vrm-tabbar>.vrm-tab:not([aria-current]){color:#C9D1DB!important}' }[MUT] || '';

async function preparer(pg, style, taille) {
  await pg.evaluate(([s, t]) => { localStorage.setItem('vrm_design_v2', '1'); localStorage.setItem('vrm_barre_style', JSON.stringify(s)); if (t) localStorage.setItem('vrm_taille_texte', t); else localStorage.removeItem('vrm_taille_texte'); }, [style, taille]);
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pret(pg);
  if (CSS_MUT) await pg.addStyleTag({ content: '@layer vrm-v2{' + CSS_MUT + '}' + CSS_MUT });
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
  await pg.waitForTimeout(500);
}

// Mesures dans la page : cibles, coupes, pastilles, place gardée, contraste, noms.
function mesurer() {
  const lum = (c) => { const m = String(c).match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const rgba = (c) => { const m = String(c).match(/[\d.]+/g) || []; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] == null ? 1 : +m[3] }; };
  const sur = (h, f) => `rgb(${Math.round(h.r * h.a + f.r * (1 - h.a))},${Math.round(h.g * h.a + f.g * (1 - h.a))},${Math.round(h.b * h.a + f.b * (1 - h.a))})`;
  const ct = (a, b) => { const x = lum(a), y = lum(b); return x == null || y == null ? null : (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const bar = document.querySelector('.vrm-tabbar'); if (!bar) return null;
  const br = bar.getBoundingClientRect(); const sombre = document.documentElement.getAttribute('data-theme') === 'dark';
  const fond = sur(rgba(getComputedStyle(bar).backgroundColor), sombre ? { r: 5, g: 13, b: 28, a: 1 } : { r: 30, g: 79, b: 140, a: 1 });
  const tabs = [...bar.querySelectorAll(':scope > .vrm-tab')];
  const out = { style: document.documentElement.getAttribute('data-barre'), n: tabs.length, petites: [], coupes: [], collisions: [], contrastes: [], sansNom: [], fond };
  for (const t of tabs) {
    const q = t.getBoundingClientRect(); const id = t.getAttribute('data-nav-entree');
    if (q.width < 44 || q.height < 44) out.petites.push(id + ' ' + Math.round(q.width) + '×' + Math.round(q.height));
    const l = t.querySelector('.vrm-nav-label'); const ls = l && getComputedStyle(l); const lr = l && l.getBoundingClientRect();
    const montre = !!(l && lr.width > 2 && +ls.opacity > .5 && ls.visibility !== 'hidden');
    if (montre && l.scrollWidth > l.clientWidth + 1) out.coupes.push(id + ' « ' + l.textContent + ' » ' + l.scrollWidth + '>' + l.clientWidth);
    if (montre && (lr.left < q.left - 1 || lr.right > q.right + 1)) out.coupes.push(id + ' déborde de sa colonne');
    const bd = t.querySelector('.vrm-nav-badge-barre'); if (bd && montre) { const b = bd.getBoundingClientRect(); if (b.bottom > lr.top + 1 && b.top < lr.bottom - 1 && b.right > lr.left + 1 && b.left < lr.right - 1) out.collisions.push(id); }
    const on = t.getAttribute('aria-current') === 'page';
    const fondT = rgba(getComputedStyle(t).backgroundColor).a > .5 ? sur(rgba(getComputedStyle(t).backgroundColor), rgba(fond)) : sur(rgba(getComputedStyle(t).backgroundColor), rgba(fond));
    const c = ct(getComputedStyle(t).color, fondT);
    const seuil = montre ? 4.5 : 3;
    if (c != null && c < seuil) out.contrastes.push(`${id}${on ? ' (actif)' : ''} ${c.toFixed(2)} < ${seuil}`);
    const nom = (t.getAttribute('aria-label') || t.textContent || '').trim(); if (nom.length < 3) out.sansNom.push(id);
  }
  const main = document.querySelector('.vrm-app-shell > .vrm-main'); const mr = main && main.getBoundingClientRect();
  out.garde = main ? Math.round(parseFloat(getComputedStyle(main).paddingBottom)) : null;
  out.prend = mr ? Math.round(mr.bottom - br.top) : null;
  return out;
}

async function unStyle(nav, b, style, cas) {
  const { W, sombre, taille, nom } = cas;
  const { ctx, pg } = await ouvrir(nav, { W, sombre, b, url: '/?tab=journee' });
  if (W === 375) await pg.setViewportSize({ width: 375, height: 812 });
  await preparer(pg, style, taille);
  const m = await pg.evaluate(mesurer);
  if (!m) { dit(false, `${style} ${nom} : la barre est rendue`); await ctx.close(); return; }
  dit(m.style === style && m.n === 5, `${style} ${nom} : style posé, cinq onglets (${m.n})`, m.style);
  // O1 : chaque onglet touché s'allume et l'écran suit.
  const ids = await pg.$$eval('.vrm-tabbar > .vrm-tab', (l) => l.map((t) => t.getAttribute('data-nav-entree')));
  const rates = [];
  for (const id of ids) {
    await pg.locator(`.vrm-tabbar > .vrm-tab[data-nav-entree="${id}"]`).tap().catch(() => {});
    await pg.waitForTimeout(900);
    const r = await pg.evaluate((id) => ({ cur: (document.querySelector('.vrm-tabbar > .vrm-tab[aria-current="page"]') || {}).getAttribute?.('data-nav-entree') || null, ecran: (document.querySelector('.vrm-main') || {}).getAttribute?.('data-ecran') || null }), id);
    if (r.cur !== id) rates.push(id + '→' + r.cur + ' (' + r.ecran + ')');
  }
  dit(!rates.length, `O1 ${style} ${nom} : l’onglet allumé = l’écran touché (5)`, rates);
  await pg.locator('.vrm-tabbar > .vrm-tab').first().tap().catch(() => {}); await pg.waitForTimeout(900);
  const m2 = await pg.evaluate(mesurer);
  dit(!m2.petites.length, `O2 ${style} ${nom} : cibles ≥ 44 × 44`, m2.petites);
  dit(!m2.coupes.length && !m2.collisions.length, `O3 ${style} ${nom} : aucun libellé coupé, aucune pastille sur un libellé`, [...m2.coupes, ...m2.collisions]);
  dit(m2.garde != null && m2.prend != null && m2.garde >= m2.prend - 1, `O4 ${style} ${nom} : rien sous la barre (la page garde ${m2.garde} px, la barre en prend ${m2.prend})`);
  dit(!m2.contrastes.length, `O5 ${style} ${nom} : contrastes (libellé 4,5:1, icône 3:1)`, m2.contrastes);
  dit(!m2.sansNom.length, `O6 ${style} ${nom} : chaque onglet a un nom`, m2.sansNom);
  await pg.screenshot({ path: path.join(SHOTS, `barre-${style}-${nom}.png`) });
  await ctx.close();
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try {
    const CAS = [{ W: 390, sombre: false, nom: '390-clair' }, { W: 390, sombre: true, nom: '390-sombre' }, { W: 375, sombre: false, taille: 'tresGrand', nom: '375-tres-grand' }];
    for (const style of (process.env.STYLES || 'C,A,B,D,E').split(',')) for (const cas of (MUT ? CAS.slice(0, 1) : CAS)) { console.log(`\n${style} · ${cas.nom}`); await unStyle(nav, b, style, cas); }
    if (!MUT) {
      // L'ordinateur (1512) : la colonne de gauche, mêmes icônes, mêmes pastilles, même onglet allumé — capture.
      { const { ctx, pg } = await ouvrir(nav, { W: 1512, sombre: false, b, url: '/?tab=journee' }); await pret(pg);
        await pg.evaluate(() => localStorage.setItem('vrm_design_v2', '1')).catch(() => {}); await pg.reload({ waitUntil: 'domcontentloaded' }); await pret(pg);
        const r = await pg.evaluate(() => { const a = document.querySelector('.vrm-sidebar [aria-current="page"], .vrm-rail [aria-current="page"]'); return a ? a.getAttribute('data-nav-entree') : null; });
        dit(r === 'journee', `O8 1512 : la colonne de gauche allume l’écran ouvert (${r})`);
        await pg.screenshot({ path: path.join(SHOTS, 'colonne-1512.png') }); await ctx.close(); }
      // O7 : Paramètres → Apparence → « Barre d'onglets » : tout de suite, puis après un rechargement.
      console.log('\nRéglage');
      const { ctx, pg } = await ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=settings' }); await pret(pg);
      await pg.evaluate(() => { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_barre_style'); }); await pg.reload({ waitUntil: 'domcontentloaded' }); await pret(pg);
      const defaut = await pg.evaluate(() => document.documentElement.getAttribute('data-barre'));
      dit(defaut === 'C', `O7 sans choix : la barre C (« Épurée ») par défaut (${defaut})`);
      const ap = pg.locator('[data-sous-ouvrir="apparence"]').first(); await ap.waitFor({ timeout: 30000 }).catch(() => {});
      if (await ap.count()) { await ap.click().catch(() => {}); await pg.waitForTimeout(900); }
      const sel = pg.locator('[data-barre-choix]').first();
      const vu = await sel.count();
      let errSel = null;
      if (vu) { await sel.scrollIntoViewIfNeeded().catch(() => {}); await sel.selectOption('D', { timeout: 8000 }).catch((e) => { errSel = String(e.message || e).slice(0, 300); }); await pg.waitForTimeout(400); }
      if (errSel) console.log('     (selectOption : ' + errSel + ')');
      const tout = await pg.evaluate(() => ({ racine: document.documentElement.getAttribute('data-barre'), apercu: (document.querySelector('[data-barre-apercu]') || {}).getAttribute?.('data-barre-apercu') || null,
        options: [...document.querySelectorAll('[data-barre-choix] option')].map((o) => o.value).join(',') }));
      await pg.screenshot({ path: path.join(SHOTS, 'reglage-barre.png') });
      dit(vu > 0 && tout.racine === 'D' && tout.apercu === 'D' && tout.options === 'C,A,B,D,E', `O7 le menu « Barre d’onglets » (C, A, B, D, E) change la barre tout de suite, l’aperçu suit`, { vu, ...tout });
      await pg.reload({ waitUntil: 'domcontentloaded' }); await pret(pg);
      const apres = await pg.evaluate(() => ({ racine: document.documentElement.getAttribute('data-barre'), ls: localStorage.getItem('vrm_barre_style') }));
      dit(apres.racine === 'D', `O7 le choix tient après un rechargement`, apres);
      await ctx.close();
    }
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} barre-onglets : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
