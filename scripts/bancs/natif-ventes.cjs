require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  VENTES « VRM NATIF » (19 nov. 2026) — l'écran RENDU, sur une base INVENTÉE de volume ET sur une base vide.
//  Décisions : Julien, 19 nov. (« Regarde les ventes, elles sont pas belles, j'aimais bien comme c'était avant » ;
//  puis « la mise en page est catastrophique, revois absolument tout ») ⇒ UN design, « VRM natif » (docs/design/NATIF.md) ;
//  le CONTENU de Ventes d'avant reste. Code : src/natif/ecrans/Ventes.jsx (+ src/ventes/modeleVentes.js, App.jsx).
//  Récit : docs/passation/2026-11-19-ventes-comme-avant.md. Remplace scripts/bancs/design-v2-ventes.cjs (la liste v2
//  n'existe plus, décision du 19 nov.).
//
//  390 × 844 tactile (zone sûre), 1512 × 950 et 1280 × 800 ; clair ET sombre. Mesure :
//    S  UN segmenté « À envoyer · En route · Terminées », les deux premiers avec leur nombre ;
//    L  la liste « À envoyer » : chaque rangée a sa case (cochée d'office quand le bordereau est là, grisée sinon — JAMAIS
//       cochée sans bordereau), la plaque N°, le titre, la date limite (« avant le » LUE, « vers le » estimée — jamais
//       « en retard » sur une estimée), le prix ; la place dans le stock et le transporteur quand ils sont connus ;
//    P  UN seul bouton plein, « Imprimer N bordereaux », N = les cases cochées ; collé en bas, au-dessus de la barre ;
//    H  téléphone : la 1re rangée utile commence à ≤ 340 px du haut ; rien sous la barre du bas ;
//    C  contraste ≥ 4,5:1 (3:1 grand texte) de CHAQUE texte visible contre son fond rendu ; aucun blanc sur clair ;
//    T  cibles ≥ 44 × 44 au doigt ; X rien ne déborde, aucun élément vide visible (carré blanc, bouton sans texte) ;
//    O  ordinateur : la liste a une largeur BORNÉE (≤ 560), toucher une rangée ouvre le DÉTAIL à droite et la liste reste
//       visible ; une seule recherche ; aucun vide de plus de 400 px entre un titre de rangée et son prix ;
//    R  « En route » : une rangée par colis, ses étapes prouvées dans le détail ;
//    V  base vide : l'écran dit « Aucun colis à envoyer », aucun plein, aucune erreur.
//  `BANC_DIST=…` juge un autre build (le code d'avant : rouge attendu) ; `MUTER=case|plein|largeur|estimee` affaiblit
//  une règle dans une copie du build (preuve par mutation : le banc doit rougir). `SHOTS=dossier` garde les captures
//  (DSF 2). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
if (process.env.MUTER) {
  const src = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-nv-'));
  fs.cpSync(src, dst, { recursive: true });
  const muts = {
    // la case cochée même sans bordereau (« pas su » vaudrait « oui »)
    case: [/possible:(\w+)=!!\((\w+)&&\2\.cochable!==!1&&\2\.pdf!==!1\)/g, 'possible:$1=!!($2)'],
    // un second plein dans la liste
    plein: [/"data-vn-plus":""/g, '"data-vn-plus":"","data-n-variante":"plein"'],
    // la liste n'est plus bornée à l'ordinateur
    largeur: [/--n-l-liste:\s*[^;]+;/g, '--n-l-liste: 100%;'],
    // une estimation dépassée redevient « en retard »
    estimee: [/(\w+)&&(\w+)==="retard"&&\(\2="estimee-depassee"\)/g, '0'],
  };
  const m = muts[process.env.MUTER]; let n = 0;
  if (!m) { console.log('MUTER inconnu'); process.exit(2); }
  for (const f of fs.readdirSync(path.join(dst, 'assets'))) {
    const p = path.join(dst, 'assets', f); if (!/\.(js|css)$/.test(f)) continue;
    const t = fs.readFileSync(p, 'utf8'); const u = t.replace(m[0], m[1]); if (u !== t) { n++; fs.writeFileSync(p, u); }
  }
  console.log(`MUTER=${process.env.MUTER} : ${n} fichier(s) muté(s) dans ${dst}`);
  if (!n) { console.log('  ❌ la mutation ne trouve pas son texte'); process.exit(2); }
  process.env.BANC_DIST = dst;
}
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-natif-ventes');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = process.env.SHOTS ? 2 : 1;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '390,1512,1280').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const sansToasts = async (pg) => { await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {}); await pg.waitForTimeout(300); };

// Le contraste au fond RENDU : les fonds empilés jusqu'au premier opaque (dégradé compris : le pire de ses couleurs).
const CONTRASTE = `(() => {
  const rgba = (t) => { t = String(t || ''); const m = t.match(/^rgba?\\(([^)]+)\\)$/); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.clearRect(0, 0, 1, 1); x.fillStyle = t; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; } catch (_) { return null; } };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const sur = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const stops = (img) => (String(img || '').match(/rgba?\\([^)]+\\)|#[0-9a-fA-F]{3,8}/g) || []).map(rgba).filter(Boolean);
  const fonds = (el) => { const couches = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); const c = rgba(cs.backgroundColor);
      const g = /gradient/.test(cs.backgroundImage) ? stops(cs.backgroundImage) : [];
      if (g.length) { couches.push(g); if (g.every((x) => x.a >= 0.99)) break; continue; }
      if (c && c.a > 0) { couches.push([c]); if (c.a >= 0.99) break; } }
    const bas = rgba(getComputedStyle(document.documentElement).backgroundColor);
    let fs = couches.length && couches[couches.length - 1].every((x) => x.a >= 0.99) ? couches.pop() : [bas && bas.a > 0 ? sur(bas, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 }];
    for (let i = couches.length - 1; i >= 0; i--) fs = fs.flatMap((f) => couches[i].map((h) => sur(h, f)));
    return fs; };
  const pire = (texte, el) => Math.min(...fonds(el).map((f) => ratio(sur(texte, f), f)));
  return { rgba, pire };
})()`;

// Ce que l'écran montre, mesuré dans la page.
function mesure(src) {
  const K = eval(src);
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; if (e.closest('[hidden], [aria-hidden="true"], .n-lu-seul, .v2-cache')) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const R = (e) => e.getBoundingClientRect();
  const ecran = document.querySelector('[data-vn="ventes"]');
  const racines = [ecran, ...document.querySelectorAll('[data-vn-detail]')].filter(Boolean);
  const dansVue = (e) => { const r = R(e); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const textes = racines.flatMap((z) => [...z.querySelectorAll('*')]).filter(vis).filter(dansVue).filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const contrastes = textes.map((e) => { const cs = getComputedStyle(e); const c = K.rgba(cs.color); if (!c) return null; const fz = parseFloat(cs.fontSize); const big = fz >= 24 || (fz >= 18.66 && Number(cs.fontWeight) >= 700);
    return { t: e.textContent.trim().slice(0, 30), r: Math.round(K.pire(c, e) * 100) / 100, min: big ? 3 : 4.5 }; }).filter(Boolean);
  const faibles = contrastes.filter((x) => x.r < x.min);
  const tactile = matchMedia('(pointer: coarse)').matches;
  const touchables = racines.flatMap((z) => [...z.querySelectorAll('button, a[href], input[type=checkbox], [role=tab], label.n-rangee-case')]).filter((e) => e.matches('input') ? vis(e.closest('label') || e) : vis(e)).filter(dansVue)
    .filter((e) => !e.closest('.n-rangee-actions'));
  const petits = tactile ? touchables.map((e) => { const r = R(e.matches('input') ? (e.closest('label') || e) : e); return { t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.w < 44 || x.h < 44) : [];
  // Les vides : un bouton sans texte ni nom, une case dessinée vide (le « carré blanc »).
  const vides = touchables.filter((e) => e.matches('button, a') && !(e.textContent || '').trim() && !e.getAttribute('aria-label') && !e.querySelector('svg, img')).map((e) => e.className.slice(0, 40));
  const W = innerWidth; const deb = document.documentElement.scrollWidth - W;
  const pleins = [...document.querySelectorAll('[data-n-variante="plein"], .sb-btn-plein, [data-v2b="principal"]')].filter(vis);
  const plein = document.querySelector('[data-vn-plein]');
  const rangs = [...document.querySelectorAll('[data-vn-liste] [data-vn-rang], [data-vn-liste] [data-vn-route]')].filter(vis);
  const rg = rangs.map((r) => { const case_ = r.querySelector('input.n-case'); const t = r.querySelector('.n-rangee-titre'); const v = r.querySelector('.n-rangee-valeur');
    return { cle: r.getAttribute('data-vn-rang') || r.getAttribute('data-vn-route'), coche: case_ ? (case_.checked ? 1 : 0) : null, dispo: case_ ? !case_.disabled : null, bord: r.getAttribute('data-vn-bordereau'), lim: r.getAttribute('data-vn-limite'), code: r.getAttribute('data-vn-limite-code'),
      num: !!r.querySelector('.n-plaque'), titre: !!(t && t.textContent.trim()), prix: !!(v && v.textContent.trim()), place: r.getAttribute('data-vn-place') || '', texte: r.textContent,
      ecart: t && v ? Math.round(R(v).left - R(t).right) : null, haut: Math.round(R(r).top), bas: Math.round(R(r).bottom), larg: Math.round(R(r).width), gauche: Math.round(R(r).left) }; });
  const seg = [...document.querySelectorAll('[data-vn="ventes"] .n-segmente [role="tab"], [data-vn="ventes"] .n-segmente button')].filter(vis).map((b) => b.textContent.replace(/\s+/g, ' ').trim());
  const barre = [...document.querySelectorAll('.n-onglets, .vrm-tabbar, nav.v2-barre, [data-v2-barre]')].filter(vis).map((b) => Math.round(R(b).top));
  const hautBarre = barre.length ? Math.min(...barre) : innerHeight;
  const recherches = [...document.querySelectorAll('[data-n-recherche], input[type="search"], .vrm-recherche input')].filter(vis).length;
  const detail = document.querySelector('[data-vn-detail]');
  return { faibles, nC: contrastes.length, minC: contrastes.length ? Math.min(...contrastes.map((x) => x.r)) : null, petits, vides, deb, pleins: pleins.length, pleinTxt: plein ? plein.textContent.trim() : '',
    pleinN: plein ? Number(plein.getAttribute('data-vn-plein')) : null, pleinBas: plein ? Math.round(R(plein).bottom) : null, hautBarre,
    rg, seg, recherches, affiche: (document.querySelector('[data-vn-affiche]') || { getAttribute: () => null }).getAttribute('data-vn-affiche'),
    detail: detail ? { cle: detail.getAttribute('data-vn-detail'), gauche: Math.round(R(detail).left), larg: Math.round(R(detail).width), vis: vis(detail) } : null,
    vide: !!document.querySelector('[data-vn="ventes"] .n-vide'), texte: ecran ? ecran.textContent.replace(/\s+/g, ' ').slice(0, 400) : '' };
}

async function ouvrirVentes(nav, { W, sombre, b }) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url: '/?tab=ventes', dsf: DSF });
  if (W === 1280) await pg.setViewportSize({ width: 1280, height: 800 });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await attendre(pg, () => !!document.querySelector('[data-vn="ventes"]') && (!!document.querySelector('[data-vn-liste] [data-vn-rang]') || !!document.querySelector('[data-vn="ventes"] .n-vide')), 40000);
  await pg.waitForTimeout(1500); await sansToasts(pg);
  return { ctx, pg, erreurs };
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const b = base();
  try {
    for (const W of LARG) for (const th of THEMES) {
      const sombre = th === 'sombre'; const tel = W < 600;
      console.log(`\n── Ventes · ${W} · ${th}`);
      const { ctx, pg, erreurs } = await ouvrirVentes(nav, { W, sombre, b });
      const m = await pg.evaluate(mesure, CONTRASTE);
      await pg.screenshot({ path: path.join(SHOTS, `ventes-${W}-${th}.png`) });
      dit(!!m.rg.length, `la liste « À envoyer » est rendue (${m.rg.length} rangées)`, m.texte);
      dit(m.seg.length === 3 && /\d/.test(m.seg[0]) && /\d/.test(m.seg[1]) && /Termin/.test(m.seg[2]), 'segmenté À envoyer N · En route N · Terminées', m.seg);
      const r = m.rg.filter((x) => x.bord != null);
      dit(r.length && r.every((x) => x.coche !== null), 'chaque rangée a sa case', r.filter((x) => x.coche === null).map((x) => x.cle));
      dit(r.every((x) => x.bord === 'pret' ? x.coche === 1 : x.coche === 0), 'cochée d\'office SI son bordereau est là, jamais sans', r.filter((x) => (x.bord === 'pret') !== (x.coche === 1)).map((x) => x.cle + ':' + x.bord + ':' + x.coche));
      dit(r.some((x) => x.bord === 'pret') && r.some((x) => x.bord === 'attente'), 'la base montre des colis prêts ET sans bordereau', r.map((x) => x.bord).join(','));
      dit(r.every((x) => x.num && x.titre && x.prix), 'plaque N°, titre et prix sur chaque rangée', r.filter((x) => !(x.num && x.titre && x.prix)).map((x) => x.cle));
      dit(r.filter((x) => x.code === 'date').every((x) => x.lim === 'lue' ? /avant le/.test(x.texte) : /vers le/.test(x.texte)), 'date limite : « avant le » LUE, « vers le » estimée', r.filter((x) => x.code === 'date').slice(0, 3).map((x) => x.lim + ':' + x.texte.slice(0, 80)));
      dit(r.filter((x) => x.lim === 'estimee').every((x) => !/retard/i.test(x.texte)), 'jamais « en retard » sur une estimée');
      dit(r.some((x) => x.lim) , 'des dates limites sont écrites', r.slice(0, 3).map((x) => x.texte.slice(0, 80)));
      dit(r.some((x) => x.place), 'la place dans le stock est écrite quand elle est connue');
      dit(m.pleins === 1, `UN seul bouton plein (${m.pleins})`);
      dit(/Imprimer \d+ bordereaux?/.test(m.pleinTxt) && m.pleinN === r.filter((x) => x.coche === 1).length, `le plein dit « Imprimer N bordereaux », N = les cochées (${m.pleinTxt} / ${r.filter((x) => x.coche === 1).length})`);
      dit(!m.faibles.length, `contraste ≥ 4,5:1 sur le fond rendu (${m.nC} textes, pire ${m.minC})`, m.faibles.slice(0, 6));
      dit(!m.petits.length, 'cibles ≥ 44 × 44 au doigt', m.petits.slice(0, 6));
      dit(!m.vides.length, 'aucun bouton vide', m.vides);
      dit(m.deb <= 1, `rien ne déborde (${m.deb})`);
      dit(m.recherches === 1, `UNE recherche (${m.recherches})`);
      if (tel) {
        dit(m.rg[0] && m.rg[0].haut <= 340, `1re rangée utile à ≤ 340 px (${m.rg[0] && m.rg[0].haut})`);
        dit(m.pleinBas != null && m.pleinBas <= m.hautBarre + 1, `le plein est au-dessus de la barre du bas (${m.pleinBas} ≤ ${m.hautBarre})`);
      } else {
        dit(m.rg.every((x) => x.larg <= 600), `la liste a une largeur bornée (${m.rg[0] && m.rg[0].larg} px)`);
        dit(m.rg.every((x) => x.ecart == null || x.ecart <= 400), `aucun vide de plus de 400 px entre titre et prix (${Math.max(...m.rg.map((x) => x.ecart || 0))})`);
        // Le toucher d'une rangée : le détail à droite, la liste reste visible.
        const cle = m.rg[1] ? m.rg[1].cle : m.rg[0].cle;
        await pg.locator(`[data-vn-rang="${cle}"] .n-rangee-corps`).first().click({ timeout: 8000 }).catch(() => {});
        await attendre(pg, (c) => { const d = document.querySelector('[data-vn-detail]'); return d && d.getAttribute('data-vn-detail') === c; }, 8000, cle);
        await pg.waitForTimeout(500);
        const m2 = await pg.evaluate(mesure, CONTRASTE);
        await pg.screenshot({ path: path.join(SHOTS, `ventes-${W}-${th}-fiche.png`) });
        dit(m2.detail && m2.detail.cle === cle && m2.detail.vis, 'toucher une rangée ouvre SON détail', m2.detail);
        const listeD = m2.rg.length ? Math.max(...m2.rg.map((x) => x.gauche + x.larg)) : 0;
        dit(m2.detail && m2.detail.gauche >= listeD - 1 && m2.rg.length > 3, `le détail est À DROITE de la liste, la liste reste visible (${m2.detail && m2.detail.gauche} ≥ ${listeD}, ${m2.rg.length} rangées)`);
        dit(!m2.faibles.length, `contraste dans le détail (${m2.nC} textes, pire ${m2.minC})`, m2.faibles.slice(0, 6));
        dit(m2.pleins <= 1, `toujours UN plein au plus (${m2.pleins})`);
      }
      // En route
      await pg.locator('[data-vn="ventes"] .n-segmente [role="tab"], [data-vn="ventes"] .n-segmente button').nth(1).click({ timeout: 8000 }).catch(() => {});
      await attendre(pg, () => !!document.querySelector('[data-vn-liste="route"] [data-vn-route]') || !!document.querySelector('[data-vn="ventes"] .n-vide'), 15000);
      await pg.waitForTimeout(600);
      const m3 = await pg.evaluate(mesure, CONTRASTE);
      await pg.screenshot({ path: path.join(SHOTS, `route-${W}-${th}.png`) });
      dit(m3.rg.length > 0, `En route : une rangée par colis (${m3.rg.length})`);
      dit(!m3.faibles.length, `En route : contraste (${m3.nC} textes, pire ${m3.minC})`, m3.faibles.slice(0, 6));
      dit(m3.pleins === 0, `En route : aucun plein (${m3.pleins})`);
      dit(!erreurs.length, 'aucune erreur de page', erreurs.slice(0, 3));
      await ctx.close();
    }
    // Base vide
    for (const th of THEMES.slice(0, 1)) {
      console.log(`\n── Ventes · base vide · 390 · ${th}`);
      const bv = base(); for (const k of Object.keys(bv.main[0].data)) if (/^vinted_(sales|orders|transactions)|^harvest|^colis|^label_/.test(k)) delete bv.main[0].data[k];
      bv.rows = bv.rows.filter((x) => !/^(harvest_|label_|colis_|vinted_sales|tx_)/.test(x.id));
      const { ctx, pg, erreurs } = await ouvrirVentes(nav, { W: 390, sombre: th === 'sombre', b: bv });
      const m = await pg.evaluate(mesure, CONTRASTE);
      await pg.screenshot({ path: path.join(SHOTS, `ventes-vide-390-${th}.png`) });
      dit(m.vide && !m.rg.length, 'base vide : l\'écran dit qu\'il n\'y a rien à envoyer', m.texte);
      dit(m.pleins === 0, `base vide : aucun plein (${m.pleins})`);
      dit(!m.faibles.length, 'base vide : contraste', m.faibles.slice(0, 4));
      dit(!erreurs.length, 'base vide : aucune erreur', erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
