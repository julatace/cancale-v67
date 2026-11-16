require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA COQUE DU STUDIO BLEU CLAIR (14 nov., décision de Julien) — l'app RENDUE.
//  Spec : docs/design/studio-bleu-clair.md · récit : docs/passation/2026-11-14-studio-fondation.md
//
//  Base INVENTÉE (`design-passe.cjs` : 3 comptes, ventes, bordereaux, vignettes SVG), garde réseau.
//  À 390 tactile ET 1512, clair ET sombre :
//    F  le FOND : la lumière du studio (dégradé haut → bas) sur la coque, l'aplat de l'espace
//       (`data-espace` sur la coque, <main> et la racine de l'écran gardé) ;
//    B  (390) la barre du bas en VERRE dépoli (flou + fond translucide), flottante (rayon ≥ 20, à
//       ≥ 8 px des bords), le contenu passe DESSOUS ; l'onglet actif porte la pastille ENFONCÉE
//       (46 × 30) et sa diode ; quatre onglets + le disque au centre ;
//    E  (390) le disque ⇒ l'éventail : quatre gestes, UN seul plein (« Imprimer N », N = le nombre de
//       « Tout imprimer (N) » de Ventes, jamais deviné), tous dans l'écran ; puis chaque geste RÉEL :
//       Chercher ⇒ le champ de la loupe ; Scanner ⇒ le scanner de bordereau de Ventes ; Publier ⇒
//       « Publier ailleurs » ; Imprimer ⇒ Ventes et sa feuille « Tout imprimer » ; GLISSER le pouce
//       du disque vers « Chercher » et relâcher ⇒ la loupe ; le voile referme ;
//    L  la LOUPE s'ouvre toujours au toucher de l'en-tête (téléphone) ;
//    O  l'ONDULATION au changement d'espace (anneau de lumière + entrée du contenu) ; en
//       mouvement réduit : aucun anneau ;
//    N  (1512) la navigation de gauche en verre, l'entrée active enfoncée avec sa diode ; pas de disque ;
//    P  un seul `.sb-btn-plein` visible par écran rendu ;
//    C  contraste AA (4,5:1) mesuré sur les fonds RÉELS : libellés de la barre sur le verre posé sur le
//       bas de la lumière, titre d'écran sur le haut, libellés de l'éventail sur le voile, mot du plein ;
//    D  rien ne déborde : ni la page, ni la barre, ni une lame de l'éventail.
//  Écrans comptés (§4.11) : tous les onglets de la barre s'ouvrent et rendent leur écran.
//  `BANC_DIST=…` juge un autre build ; `SHOTS=dossier` garde les captures (regarde-les).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-studio-coque');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } return c; };
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(2600); };
// Un toucher (tactile) ; sur une machine chargée, le moteur peut mettre longtemps à rendre la main : on attend.
const toucher = async (pg, sel) => { await pg.locator(sel).first().waitFor({ state: 'visible', timeout: 30000 }); await pg.locator(sel).first().tap({ timeout: 90000 }); };
const visible = (pg, sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length, sel);

// Le contraste, dans la page : la couleur d'un texte contre un fond donné (couches composées).
const CONTRASTE = `(() => {
  const rgba = (t) => { t = String(t || ''); const c = t.match(/color\\(srgb ([^)]+)\\)/); if (c) { const p = c[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    const m = t.match(/^rgba?\\(([^)]+)\\)$/); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    // oklab(), color-mix()… : le navigateur la peint sur un pixel, on relit le pixel.
    try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.clearRect(0, 0, 1, 1); x.fillStyle = t; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; } catch (_) { return null; } };
  const hex = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const sur = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const jeton = (v) => { const d = document.createElement('i'); d.style.color = 'var(' + v + ')'; document.body.appendChild(d); const c = rgba(getComputedStyle(d).color); d.remove(); return c; };
  return { rgba, hex, sur, ratio, jeton };
})()`;

async function telephone(nav, sombre, b) {
  const th = sombre ? 'sombre' : 'clair';
  console.log(`\n── 390 tactile · ${th}`);
  // Ventes d'abord : il PUBLIE « Tout imprimer (N) » (vrm_colis_prets.lot) que le plein de l'éventail redit.
  let { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=ventes' });
  await pret(pg); await pg.waitForTimeout(1500);
  const nLot = await pg.evaluate(() => { const x = document.querySelector('[data-imprimer-prets]'); return x ? Number(x.getAttribute('data-imprimer-prets')) : null; });
  // F — le fond.
  const fond = await pg.evaluate(() => { const s = document.querySelector('.vrm-app-shell'), m = document.querySelector('.vrm-main'); const cs = getComputedStyle(s);
    // (15 nov., « Verre dépoli ») La règle : la COQUE porte la lumière — sur elle, ou sur son ::before fixe (posé une fois,
    // sans background-attachment:fixed, cassé sur iOS). Le contrôle juge la règle, pas l'endroit où elle est peinte.
    const avant = getComputedStyle(s, '::before'); const imgAvant = avant.content !== 'none' && avant.position === 'fixed' ? avant.backgroundImage : '';
    return { img: /gradient/.test(cs.backgroundImage) ? cs.backgroundImage : (imgAvant || cs.backgroundImage), esp: s.getAttribute('data-espace'), espMain: m && m.getAttribute('data-espace'), vivant: [...document.querySelectorAll('.vrm-ecran-vivant[data-espace]')].map((x) => x.getAttribute('data-espace')) }; });
  dit(/linear-gradient/.test(fond.img) && /radial-gradient/.test(fond.img), 'F la coque porte la lumière du studio (halo + dégradé haut → bas)', fond.img.slice(0, 90));
  dit(fond.esp === 'ventes' && fond.espMain === 'ventes' && fond.vivant.includes('ventes'), 'F data-espace="ventes" sur la coque, <main> et la racine de l’écran', fond);
  // B — la barre en verre.
  const barre = await pg.evaluate(() => { const n = document.querySelector('.vrm-tabbar'); const cs = getComputedStyle(n); const r = n.getBoundingClientRect(); const m = document.querySelector('.vrm-main').getBoundingClientRect();
    const p = document.querySelector('.vrm-tab-pastille'); const pr = p && p.getBoundingClientRect(); const act = document.querySelector('.vrm-tabbar > .vrm-tab[aria-current="page"] .vrm-tab-ic'); const ar = act && act.getBoundingClientRect();
    const diode = p && getComputedStyle(p, '::after');
    return { flou: cs.backdropFilter || cs.webkitBackdropFilter, fond: cs.backgroundColor, rayon: parseFloat(cs.borderTopLeftRadius), g: r.left, d: innerWidth - r.right, bas: innerHeight - r.bottom, dessous: m.bottom > r.top + 10,
      onglets: document.querySelectorAll('.vrm-tabbar > .vrm-tab').length, disque: !!document.querySelector('.vrm-tabbar > [data-sb-disque]'),
      pastille: pr ? { w: Math.round(pr.width), h: Math.round(pr.height), cx: Math.round(pr.left + pr.width / 2), cy: Math.round(pr.top + pr.height / 2), op: getComputedStyle(p).opacity, ombre: getComputedStyle(p).boxShadow } : null,
      ic: ar ? { cx: Math.round(ar.left + ar.width / 2), cy: Math.round(ar.top + ar.height / 2) } : null, diode: diode && diode.content !== 'none' ? diode.backgroundColor : null }; });
  dit(/blur/.test(barre.flou) && /rgba|\/ 0\./.test(barre.fond), 'B la barre du bas est en verre (flou + fond translucide)', barre);
  dit(barre.rayon >= 20 && barre.g >= 8 && barre.d >= 8 && barre.bas >= 8, 'B la barre flotte (rayon ≥ 20, ≥ 8 px des bords)', barre);
  dit(barre.dessous, 'B le contenu passe SOUS la barre (elle ne prend pas de bande à elle)');
  dit(barre.onglets === 4 && barre.disque, 'B quatre onglets et le disque au centre', barre);
  dit(barre.pastille && barre.pastille.w === 46 && barre.pastille.h === 30 && barre.ic && Math.abs(barre.pastille.cx - barre.ic.cx) <= 1 && Math.abs(barre.pastille.cy - barre.ic.cy) <= 1 && /inset/.test(barre.pastille.ombre) && barre.pastille.op !== '0',
    'B la pastille ENFONCÉE (46 × 30, ombre intérieure) est sur l’icône de l’espace actif', barre.pastille && barre.ic ? [barre.pastille, barre.ic] : barre);
  dit(!!barre.diode, 'B sa diode est allumée', barre.diode);
  // C — contrastes de la barre (le verre posé sur le BAS de la lumière, le pire endroit).
  const cBarre = await pg.evaluate((src) => { const K = eval(src); const n = document.querySelector('.vrm-tabbar'); const verre = K.rgba(getComputedStyle(n).backgroundColor); const bas = K.jeton('--sb-bas');
    const f = K.sur(verre, bas); const lab = [...document.querySelectorAll('.vrm-tabbar .vrm-nav-label')].map((l) => K.ratio(K.rgba(getComputedStyle(l).color), f));
    const titre = document.querySelector('.vrm-main :is(.vrm-screen-head .vrm-display, .vrm-tache-tete h1, h1)'); const haut = K.jeton('--sb-haut');
    return { lab: lab.map((x) => Math.round(x * 100) / 100), titre: titre ? Math.round(K.ratio(K.rgba(getComputedStyle(titre).color), haut) * 100) / 100 : null }; }, CONTRASTE);
  dit(cBarre.lab.length === 4 && cBarre.lab.every((x) => x >= 4.5), `C libellés de la barre ≥ 4,5:1 sur le verre posé sur le bas (${cBarre.lab.join(' · ')})`, cBarre.lab);
  dit(cBarre.titre == null || cBarre.titre >= 4.5, `C le titre d’écran ≥ 4,5:1 sur le haut de la lumière (${cBarre.titre})`, cBarre.titre);
  dit(nLot != null, 'E Ventes dit combien « Tout imprimer (N) » ferait partir', nLot);
  await pg.screenshot({ path: path.join(SHOTS, `ventes-390-${th}.png`) });
  // D — rien ne déborde.
  const deb = await pg.evaluate(() => ({ page: document.documentElement.scrollWidth - innerWidth, main: (() => { const m = document.querySelector('.vrm-main'); return m.scrollWidth - m.clientWidth; })() }));
  dit(deb.page <= 1 && deb.main <= 1, 'D rien ne déborde à 390', deb);
  // P — un seul plein par écran.
  dit(await visible(pg, '.sb-btn-plein') <= 1, 'P au plus un .sb-btn-plein sur Ventes');

  // E — l'éventail, depuis Ma journée.
  await pg.locator('.vrm-tabbar [data-nav-entree="journee"]').click(); await pg.waitForSelector('.vrm-main[data-ecran="journee"]'); await pg.waitForTimeout(2500);
  const ondes = await pg.evaluate(() => document.querySelectorAll('[data-sb-onde]').length);
  await toucher(pg, '[data-sb-disque]'); await pg.waitForTimeout(500);
  // Les lames finissent leur entrée (300 ms + décalage) avant d'être mesurées.
  await pg.waitForFunction(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('[data-sb-eventail]')).every((a) => a.playState !== 'running'), null, { timeout: 8000 }).catch(() => {});
  const ev = await pg.evaluate((src) => { const K = eval(src); const lames = [...document.querySelectorAll('[data-sb-lame]')];
    const voile = document.querySelector('[data-sb-voile]'); const fv = voile ? K.sur(K.rgba(getComputedStyle(voile).backgroundColor), K.jeton('--sb-aplat')) : null;
    const plein = document.querySelector('[data-sb-lame] .sb-btn-plein'); const pc = plein && getComputedStyle(plein);
    const cs = (e) => getComputedStyle(e);
    return { n: lames.length, ids: lames.map((l) => l.getAttribute('data-sb-lame')), pleins: document.querySelectorAll('[data-sb-lame] .sb-btn-plein').length,   // (version studio) DANS l'éventail : `data-sb-eventail` est posé sur <html>, il comptait aussi le plein de l'écran derrière (Ma journée en Bento)
     
      dedans: lames.every((l) => { const r = l.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }),
      places: lames.map((l) => { const r = l.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }),
      nImprimer: (lames.find((l) => l.getAttribute('data-sb-lame') === 'imprimer') || { getAttribute: () => null }).getAttribute('data-sb-n'),
      recul: document.documentElement.hasAttribute('data-sb-eventail'), expanded: document.querySelector('[data-sb-disque]').getAttribute('aria-expanded'),
      contrastes: fv ? lames.map((l) => Math.round(K.ratio(K.rgba(cs(l.querySelector('.sb-lame-mot')).color), fv) * 100) / 100) : [],
      plein: pc ? Math.round(K.ratio(K.rgba(pc.color), K.jeton('--sb-encre')) * 100) / 100 : null }; }, CONTRASTE);
  dit(ev.n === 4 && ev.ids.join() === 'chercher,scanner,publier,imprimer', 'E le disque ouvre l’éventail : Chercher · Scanner · Publier · Imprimer', ev.ids);
  dit(ev.pleins === 1, 'E UN seul plein dans l’éventail (Imprimer)', ev.pleins);
  dit(ev.dedans, 'D toutes les lames sont dans l’écran', ev.places);
  dit(ev.recul && ev.expanded === 'true', 'E l’écran recule sous le voile, le disque est enfoncé (aria-expanded)');
  dit(String(ev.nImprimer) === String(nLot), 'E « Imprimer N » redit le nombre de « Tout imprimer (N) » de Ventes', { lame: ev.nImprimer, ventes: nLot });
  dit(ev.contrastes.length === 4 && ev.contrastes.every((x) => x >= 4.5), `C les mots de l’éventail ≥ 4,5:1 sur le voile (${ev.contrastes.join(' · ')})`, ev.contrastes);
  dit(ev.plein == null || ev.plein >= 4.5, `C le mot du plein ≥ 4,5:1 sur l’encre (${ev.plein})`, ev.plein);
  await pg.screenshot({ path: path.join(SHOTS, `eventail-390-${th}.png`) });
  // Le voile referme.
  await pg.mouse.click(195, 140); await pg.waitForTimeout(400);
  dit(await visible(pg, '[data-sb-lame]') === 0 && !(await pg.evaluate(() => document.documentElement.hasAttribute('data-sb-eventail'))), 'E toucher le voile referme l’éventail');
  // Chercher (toucher).
  await toucher(pg, '[data-sb-disque]'); await pg.waitForTimeout(400);
  await toucher(pg, '[data-sb-lame="chercher"]'); await pg.waitForTimeout(700);
  dit(await visible(pg, '[data-recherche-champ]') >= 1, 'E Chercher ⇒ le champ de la loupe');
  await pg.keyboard.press('Escape').catch(() => {}); await pg.locator('.vrm-hdr-recherche-fermer').first().tap({ timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(400);
  // Chercher (GLISSER du disque vers la lame, relâcher).
  {
    const d = await pg.locator('[data-sb-disque]').boundingBox();
    await pg.evaluate(({ x, y }) => { const el = document.querySelector('[data-sb-disque]'); const ev = (t, X, Y) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: X, clientY: Y, button: 0 })); ev('pointerdown', x, y); }, { x: d.x + d.width / 2, y: d.y + d.height / 2 });
    await pg.waitForTimeout(400);
    const c = await pg.locator('[data-sb-lame="chercher"]').boundingBox();
    await pg.evaluate(({ x0, y0, x, y }) => { const el = document.querySelector('[data-sb-disque]'); const ev = (t, X, Y) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: X, clientY: Y, button: 0 }));
      for (let i = 1; i <= 6; i++) ev('pointermove', x0 + (x - x0) * i / 6, y0 + (y - y0) * i / 6); ev('pointerup', x, y); }, { x0: d.x + d.width / 2, y0: d.y + d.height / 2, x: c.x + c.width / 2, y: c.y + 20 });
    await pg.waitForTimeout(700);
    dit(await visible(pg, '[data-recherche-champ]') >= 1, 'E GLISSER du disque vers Chercher, relâcher ⇒ la loupe');
    await pg.locator('.vrm-hdr-recherche-fermer').first().tap({ timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(400);
  }
  // L — la loupe de l'en-tête s'ouvre toujours au toucher.
  await toucher(pg, 'button[data-recherche-loupe]'); await pg.waitForTimeout(600);
  dit(await visible(pg, '[data-recherche-champ]') >= 1, 'L la loupe de l’en-tête s’ouvre au toucher');
  await pg.locator('.vrm-hdr-recherche-fermer').first().tap({ timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(400);
  // Publier.
  await toucher(pg, '[data-sb-disque]'); await pg.waitForTimeout(400);
  await toucher(pg, '[data-sb-lame="publier"]'); await pg.waitForTimeout(1500);
  dit(await pg.evaluate(() => !!document.querySelector('[class*="vrm-pa"], [data-pa-site], [data-publier-ailleurs]')), 'E Publier ⇒ « Publier ailleurs »');
  await pg.keyboard.press('Escape').catch(() => {}); await pg.goBack().catch(() => {}); await pg.waitForTimeout(600);
  await ctx.close();

  // Imprimer et Scanner : chacun sur une page neuve (Ma journée).
  ({ ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=ventes' })); await pret(pg); await pg.waitForTimeout(1200);
  await pg.locator('.vrm-tabbar [data-nav-entree="journee"]').click(); await pg.waitForTimeout(1200);
  await toucher(pg, '[data-sb-disque]'); await pg.waitForTimeout(400);
  await toucher(pg, '[data-sb-lame="imprimer"]');
  await pg.waitForFunction(() => document.querySelector('.vrm-main[data-ecran="ventes"]') && document.querySelector('.vrm-fs, [role="dialog"]'), null, { timeout: 12000 }).catch(() => {});
  const impr = await pg.evaluate(() => ({ ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), feuille: !!document.querySelector('.vrm-fs, [role="dialog"]') }));
  dit(impr.ecran === 'ventes' && impr.feuille, 'E Imprimer ⇒ Ventes et sa feuille « Tout imprimer » (rien n’est imprimé avant son clic)', impr);
  await pg.screenshot({ path: path.join(SHOTS, `imprimer-390-${th}.png`) });
  await ctx.close();
  ({ ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=journee' })); await pret(pg);
  await toucher(pg, '[data-sb-disque]'); await pg.waitForTimeout(400);
  await toucher(pg, '[data-sb-lame="scanner"]');
  // (16 nov., intégration de claude/scanner-colis) Le disque « + » ⇒ Scanner ouvre désormais le scanner
  // POUR RETROUVER (`ouvrirRetrouver('disque')`, docs/passation/2026-11-15-scanner-colis.md §1) ; le
  // scanner de dépôt reste sur le bouton « Scanner » de Ventes → À envoyer.
  await pg.waitForSelector('[data-scan-r]', { timeout: 12000 }).catch(() => {});
  dit(await visible(pg, '[data-scan-r]') >= 1, 'E Scanner ⇒ le scanner pour retrouver un colis (sa vente, son achat)');
  await ctx.close();
  // O — l'ondulation (et pas en mouvement réduit). Écrans comptés : chaque onglet rend son écran.
  ({ ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=journee' })); await pret(pg);
  const vus = [];
  for (const id of ['paires', 'ventes', 'compta', 'journee']) {
    // Un témoin posé AVANT le toucher : il voit l'anneau et l'entrée même si la machine rend la main tard
    // (l'anneau ne vit que 560 ms, l'entrée 320 ms).
    await pg.evaluate(() => { const v = window.__sbVu = { onde: 0, entree: false }; const main = document.querySelector('.vrm-main');
      if (window.__sbObs) window.__sbObs.disconnect();
      window.__sbObs = new MutationObserver((ms) => { for (const m of ms) { for (const n of m.addedNodes || []) if (n.nodeType === 1 && n.hasAttribute('data-sb-onde')) v.onde++; if (m.type === 'attributes' && m.target === main && main.hasAttribute('data-sb-entree')) v.entree = true; } });
      window.__sbObs.observe(document.body, { childList: true }); window.__sbObs.observe(main, { attributes: true, attributeFilter: ['data-sb-entree'] }); });
    await pg.locator(`.vrm-tabbar [data-nav-entree="${id}"]`).click(); await pg.waitForTimeout(120);
    const o = await pg.evaluate(() => ({ ...window.__sbVu }));
    await pg.waitForTimeout(1400);
    const e = await pg.evaluate(() => ({ ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), esp: document.querySelector('.vrm-main').getAttribute('data-espace'), texte: (document.querySelector('.vrm-main').innerText || '').trim().length }));
    vus.push({ id, ...o, ...e });
  }
  dit(vus.every((v) => v.onde >= 1 && v.entree), 'O chaque changement d’espace : l’anneau de lumière et l’entrée du contenu', vus.map((v) => `${v.id}:${v.onde}/${v.entree}`));
  dit(vus.map((v) => v.esp).join() === 'paires,ventes,argent,journee' && vus.every((v) => v.texte > 40), 'O les quatre espaces rendent leur écran (aucun écran perdu)', vus.map((v) => `${v.ecran}/${v.esp}/${v.texte}`));
  dit(!erreurs.length, 'aucune erreur JS', erreurs);
  await ctx.close();
  {
    const x = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=journee' }); await pret(x.pg);
    await x.pg.emulateMedia({ reducedMotion: 'reduce' });
    await x.pg.evaluate(() => { const v = window.__sbVu = { onde: 0 }; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes || []) if (n.nodeType === 1 && n.hasAttribute('data-sb-onde')) v.onde++; }).observe(document.body, { childList: true }); });
    await x.pg.locator('.vrm-tabbar [data-nav-entree="ventes"]').click(); await x.pg.waitForTimeout(400);
    const vu = await x.pg.evaluate(() => ({ onde: window.__sbVu.onde, ecran: document.querySelector('.vrm-main').getAttribute('data-ecran') }));
    dit(vu.onde === 0 && vu.ecran === 'ventes', 'O mouvement réduit : aucun anneau (un fondu seul), l’écran change', vu);
    await x.ctx.close();
  }
}

async function ordinateur(nav, sombre, b) {
  const th = sombre ? 'sombre' : 'clair';
  console.log(`\n── 1512 · ${th}`);
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 1512, sombre, b, url: '/?tab=ventes' });
  await pret(pg);
  const r = await pg.evaluate((src) => { const K = eval(src); const s = document.querySelector('.vrm-app-shell'); const n = document.querySelector('.vrm-sidebar'); const cs = getComputedStyle(n);
    const ind = document.querySelector('.vrm-nav-indicateur'); const ia = ind && getComputedStyle(ind, '::after');
    const lib = [...n.querySelectorAll('.vrm-rail-button .vrm-rail-lib')].map((l) => Math.round(K.ratio(K.rgba(getComputedStyle(l).color), K.sur(K.rgba(cs.backgroundColor), K.jeton('--sb-aplat'))) * 100) / 100);
    const avant = getComputedStyle(s, '::before');   // (15 nov., verre) la lumière sur la coque OU sur son ::before fixe
    return { fond: /gradient/.test(getComputedStyle(s).backgroundImage) ? getComputedStyle(s).backgroundImage : (avant.content !== 'none' && avant.position === 'fixed' ? avant.backgroundImage : getComputedStyle(s).backgroundImage), flou: cs.backdropFilter || cs.webkitBackdropFilter, rayon: parseFloat(cs.borderTopLeftRadius), ind: ind ? getComputedStyle(ind).boxShadow : '', diode: ia && ia.content !== 'none' ? ia.backgroundColor : null,
      disque: !!document.querySelector('[data-sb-disque]'), lib, deb: document.documentElement.scrollWidth - innerWidth, pleins: [...document.querySelectorAll('.sb-btn-plein')].filter((e) => e.getClientRects().length).length }; }, CONTRASTE);
  dit(/linear-gradient/.test(r.fond), 'F 1512 : la lumière du studio sur la coque');
  dit(/blur/.test(r.flou) && r.rayon >= 20, 'N la navigation de gauche est en verre (flou, rayon ≥ 20)', r);
  dit(/inset/.test(r.ind) && !!r.diode, 'N l’entrée active est ENFONCÉE avec sa diode', { ind: r.ind.slice(0, 60), diode: r.diode });
  dit(!r.disque, 'N pas de disque à l’ordinateur (la colonne montre tout)');
  dit(r.lib.length >= 4 && r.lib.every((x) => x >= 4.5), `C libellés de la navigation ≥ 4,5:1 sur le verre (min ${Math.min(...r.lib)})`, r.lib);
  dit(r.deb <= 1, 'D rien ne déborde à 1512', r.deb);
  dit(r.pleins <= 1, 'P au plus un .sb-btn-plein sur Ventes (1512)', r.pleins);
  dit(!erreurs.length, 'aucune erreur JS', erreurs);
  await pg.screenshot({ path: path.join(SHOTS, `ventes-1512-${th}.png`) });
  await ctx.close();
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try {
    for (const sombre of [false, true]) { await telephone(nav, sombre, b); await ordinateur(nav, sombre, b); }
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1500)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} studio-coque : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
