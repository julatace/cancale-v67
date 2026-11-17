require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  VENTES, NOUVEAU DESIGN — PHASE 2 (17 nov.) — l'écran RENDU, allumé et éteint, sur la MÊME base.
//  Code : src/designV2/VentesV2.jsx (+ App.jsx : `lignesEnvoyerV2`, `lignesRouteV2`, la tête). Récit :
//  docs/passation/2026-11-17-design-v2-ventes.md.
//
//  Base INVENTÉE (`design-passe.cjs` : 3 comptes, 30 colis à envoyer, des envois partis, bordereaux), garde réseau.
//  390 tactile clair ET sombre, 1512 clair. Mesure :
//    E  ÉTEINT ⇒ Ventes est celui d'avant : la signature du DOM (balises, classes, noms des data-*) est IDENTIQUE à celle
//       du même banc lancé sur le build de la base (`SIGNATURE_AVANT=…`, écrite par `BANC_DIST=<dist de design-v2>`) ;
//    H  la tête : « Ventes », le plein « Imprimer N bordereaux » et la cloche sur UNE ligne ; le menu plateforme dessous ;
//    S  UN segmenté À envoyer · En route · Toutes, sans nombre redit ; la recherche avec le scanner DANS le champ ;
//    L  la 1re rangée utile à ≤ 310 px (≈ 300) ; les groupes par échéance, chacun nommé UNE fois avec son nombre ;
//    R  rien redit par rangée : ni « Choisir la vente », ni le nom du compte ; chaque rangée a photo, titre, prix ;
//    P  exactement UN bouton plein visible ;
//    T  cibles ≥ 44 × 44 ; X aucun texte tronqué sans « … », rien ne déborde ; C contraste ≥ 4,5:1 (3:1 grand texte) ;
//    N  LES NOMBRES = l'écran d'avant, même base : affiche = le grand chiffre d'hier (`data-sb-chiffre`) ; rangées
//       « À envoyer » = ce nombre ; le plein = le plein d'hier (`data-impr-lot`) ; rangées « En route » = les envoyés
//       d'hier (`data-colis-envoyes`) ;
//    G  glisser à gauche : Imprimer · Plus ; toucher : la fiche de la paire s'ouvre ; la recherche par N° trouve la rangée ;
//    O  « ⋯ » ouvre une feuille avec les gestes d'hier (choisir, papier, préparer, déposer…).
//  `BANC_DIST=…` juge un autre build ; `MUTER=plein|groupe|compte` affaiblit une règle dans une copie du build (preuve par
//  mutation : le banc doit rougir). `SHOTS=dossier` garde les captures. Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
// La mutation se fait AVANT que design-passe ne lise BANC_DIST : une copie du build, un texte affaibli.
if (process.env.MUTER) {
  const src = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-v2v-'));
  fs.cpSync(src, dst, { recursive: true });
  const muts = {
    // le plein n'est plus posé sur la ligne du titre (sa place n'est plus trouvée)
    plein: [/\[data-v2-tete-plein="ventes"\]/g, '[data-v2-tete-plein="nulle-part"]'],
    // un groupe oublié : les colis « sans date » ne sont plus rangés (des colis cachés)
    groupe: [/"estimee","sansDate","imprimes"/g, '"estimee","imprimes"'],
    // le compte redit sur chaque rangée (ce qui était interdit)
    compte: [/sous:\[nomPlateforme\(([a-zA-Z]+)\)\]/g, 'sous:[nomPlateforme($1),"vendeur_1"]'],
  };
  const m = muts[process.env.MUTER]; let n = 0;
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
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-design-v2-ventes');
fs.mkdirSync(SHOTS, { recursive: true });
const SIG_AVANT = process.env.SIGNATURE_AVANT || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(arg !== undefined ? 50 : 400); } return false; };
const sansToasts = async (pg) => { await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {}); await pg.waitForTimeout(400); };

// Le contraste au fond EFFECTIF (fonds composés jusqu'au premier opaque, sinon la lumière du Studio) — la règle du banc design-v2.
const CONTRASTE = `(() => {
  const rgba = (t) => { t = String(t || ''); const m = t.match(/^rgba?\\(([^)]+)\\)$/); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.clearRect(0, 0, 1, 1); x.fillStyle = t; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; } catch (_) { return null; } };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const sur = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const jeton = (v) => { const d = document.createElement('i'); d.style.color = 'var(' + v + ')'; document.body.appendChild(d); const c = rgba(getComputedStyle(d).color); d.remove(); return c; };
  // Un fond en DÉGRADÉ (le plateau du segmenté, la porcelaine) compte : chacune de ses couleurs est un fond possible, le pire gagne.
  const stops = (img) => (String(img || '').match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/g) || []).map(rgba).filter(Boolean);
  const fonds = (el) => { const couches = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); const c = rgba(cs.backgroundColor);
      const g = /gradient/.test(cs.backgroundImage) ? stops(cs.backgroundImage) : [];
      if (g.length) { couches.push(g); if (g.every((x) => x.a >= 0.99)) break; continue; }
      if (c && c.a > 0) { couches.push([c]); if (c.a >= 0.99) break; } }
    const lum0 = (() => { const v = jeton('--sv-haut'); return v && v.a > 0 ? v : jeton('--sb-bas'); })();
    let fs = couches.length && couches[couches.length - 1].every((x) => x.a >= 0.99) ? couches.pop() : [lum0];
    for (let i = couches.length - 1; i >= 0; i--) fs = fs.flatMap((f) => couches[i].map((h) => sur(h, f)));
    return fs; };
  const fond = (el) => fonds(el)[0];
  const pire = (texte, el) => Math.min(...fonds(el).map((f) => ratio(sur(texte, f), f)));
  return { rgba, sur, ratio, fond, pire };
})()`;
const SIGNATURE = () => { const m = document.querySelector('.vrm-main'); if (!m) return null; const out = [];
  const pas = (e, d) => { if (d > 60 || e.matches('.vrm-fraicheur-hote, [data-temps-reel-neuf], [data-fraicheur-unique]')) return; const cl = [...e.classList].sort().join('.'); const da = [...e.attributes].map((a) => a.name).filter((n) => n.startsWith('data-') && !/^data-(sb-|v2|vu$)/.test(n)).sort().join(',');
    out.push(d + ':' + e.tagName + (cl ? '.' + cl : '') + (da ? '[' + da + ']' : '')); for (const c of e.children) pas(c, d + 1); };
  pas(m, 0); return out; };
async function signatureStable(pg) { let avant = null;
  for (let k = 0; k < 14; k++) { const s = await pg.evaluate((f) => eval('(' + f + ')')(), SIGNATURE.toString()); if (avant && JSON.stringify(s) === JSON.stringify(avant)) return s; avant = s; await pg.waitForTimeout(1500); }
  return avant; }

// L'écran d'AVANT (réglage éteint) : ses nombres et sa signature.
async function avant(nav, b, sombre) {
  const { ctx, pg } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=ventes' });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await attendre(pg, () => !!document.querySelector('[data-sb-chiffre]') && document.querySelector('[data-sb-chiffre]').getAttribute('data-sb-chiffre') !== '');
  const sig = await signatureStable(pg);
  const x = await pg.evaluate(() => ({ attr: document.documentElement.getAttribute('data-design'),
    chiffre: (document.querySelector('[data-sb-chiffre]') || { getAttribute: () => null }).getAttribute('data-sb-chiffre'),
    lot: (document.querySelector('.vv-pied [data-impr-lot]') || { getAttribute: () => null }).getAttribute('data-impr-lot'),
    nRoute: (document.querySelector('[data-colis-onglet-choix="envoyes"]') || { getAttribute: () => null }).getAttribute('data-colis-onglet-n') }));
  await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `eteint-ventes-390-${sombre ? 'sombre' : 'clair'}.png`) });
  await pg.locator('[data-ventes-seg-choix="envoyes"]').first().tap({ timeout: 8000 }).catch(() => {});
  await attendre(pg, () => !!document.querySelector('[data-colis-envoyes]'), 15000);
  x.envoyes = await pg.evaluate(() => (document.querySelector('section[data-colis-envoyes]') || { getAttribute: () => null }).getAttribute('data-colis-envoyes'));
  await ctx.close();
  return { sig, ...x };
}

async function mesurer(pg) {
  return pg.evaluate((src) => { const K = eval(src);
    const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden], .v2-cache, .vrm-sr-seul') && e.getBoundingClientRect().width > 1;
    const q = (e) => e.getBoundingClientRect();
    const zones = [...document.querySelectorAll('.v2v-titre-ligne, .v2v-tete, .v2v-corps, .v2-sous-titre')].filter(vis);
    const boutons = zones.flatMap((z) => [...z.querySelectorAll('button')]).filter(vis).filter((b) => !b.closest('[data-lg-tiroir], .vrm-retours-lot'));
    const petits = boutons.filter((b) => b.offsetHeight < 44 || b.offsetWidth < 44).map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30) + ':' + b.offsetWidth + 'x' + b.offsetHeight);
    const textes = zones.flatMap((z) => [...z.querySelectorAll('*')]).filter(vis).filter((e) => !e.closest('[data-lg-tiroir]')).filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const tronques = textes.filter((e) => { const cs = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && /hidden|clip/.test(cs.overflowX) && e.clientWidth > 0 && !/-webkit-box/.test(cs.display); }).map((e) => e.className + ':' + e.textContent.trim().slice(0, 30));
    const W = innerWidth; const deb = document.documentElement.scrollWidth - W;
    const hors = textes.filter((e) => { const r = q(e); return r.width && (r.right > W + 1 || r.left < -1); }).map((e) => e.textContent.trim().slice(0, 30));
    const contrastes = textes.filter((e) => q(e).bottom > 0 && q(e).top < innerHeight).map((e) => { const cs = getComputedStyle(e); const c = K.rgba(cs.color); if (!c) return null; const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
      if (Number(cs.opacity) === 0) return null; return { t: e.textContent.trim().slice(0, 24), r: Math.round(K.pire(c, e) * 100) / 100, min: big ? 3 : 4.5 }; }).filter(Boolean);
    const faibles = contrastes.filter((x) => x.r < x.min);
    const pleins = [...document.querySelectorAll('[data-v2b="principal"], .sb-btn-plein, .vv-pied [data-colis-barre-btn="imprimer"]')].filter(vis);
    const h1 = document.querySelector('.v2v-titre-ligne h1'); const pl = document.querySelector('[data-v2-principal="imprimer"]'); const cl = document.querySelector('.vrm-app-header .vrm-header-actions');
    const cy = (e) => (e ? Math.round(q(e).top + q(e).height / 2) : null);
    const lignes = [...document.querySelectorAll('[data-v2v-liste] [data-v2v-ligne]')].filter(vis).filter((r) => r.getAttribute('data-v2v-fait') !== 'part');
    const tetes = [...document.querySelectorAll('[data-v2v-groupe-tete]')].filter(vis).map((h) => ({ g: h.getAttribute('data-v2v-groupe-tete'), n: Number(h.getAttribute('data-v2v-groupe-n')), t: h.textContent.trim() }));
    const parGroupe = {}; for (const r of lignes) { const g = r.getAttribute('data-v2v-groupe'); parGroupe[g] = (parGroupe[g] || 0) + 1; }
    const segN = [...document.querySelectorAll('[data-v2v-segment] button')].filter(vis).map((b) => b.textContent.trim());
    const menu = document.querySelector('.v2-sous-titre [data-v2-menu]');
    return { petits, nB: boutons.length, tronques, deb, hors, faibles, nC: contrastes.length, minC: contrastes.length ? Math.min(...contrastes.map((x) => x.r)) : null, pleins: pleins.length,
      tete: { h1: cy(h1), plein: cy(pl), cloche: cy(cl), pleinTxt: pl ? pl.textContent.trim() : '', pleinN: pl ? pl.getAttribute('data-impr-lot') : null, pleinAria: pl ? pl.getAttribute('aria-label') : '', h1Bas: h1 ? Math.round(q(h1).bottom) : null, menuHaut: menu ? Math.round(q(menu).top) : null },
      premiere: lignes[0] ? Math.round(q(lignes[0]).top) : null, n: lignes.length, tetes, parGroupe, segN,
      affiche: (document.querySelector('[data-v2v-affiche]') || { getAttribute: () => null }).getAttribute('data-v2v-affiche'),
      ecart: (document.querySelector('.v2v-tete [data-v2-ecart]') || {}).textContent || '',
      scanDansChamp: !!document.querySelector('[data-v2v-champ] [data-v2v-scanner]'),
      redits: lignes.filter((r) => /Choisir la vente|vendeur_\d/.test(r.textContent)).length,
      sansPrix: lignes.filter((r) => r.querySelector('[data-v2l]') ? false : !r.querySelector('.v2l-a-prix')).length,
      sansTitre: lignes.filter((r) => !(r.querySelector('.v2l-a-titre') || {}).textContent).length };
  }, CONTRASTE);
}

async function allume(nav, b, sombre, W, ref) {
  const th = (W < 600 ? '390-' : '1512-') + (sombre ? 'sombre' : 'clair');
  console.log(`\n── allumé · ${th}`);
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, b, url: '/?tab=ventes', dsf: W < 600 ? 2 : 1 });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await pg.evaluate(() => localStorage.setItem('vrm_design_v2', '1')); await pg.reload({ waitUntil: 'domcontentloaded' });
  await attendre(pg, () => document.querySelectorAll('[data-v2v-liste="envoyer"] [data-v2v-ligne]').length > 0 && (document.querySelector('[data-v2v-affiche]') || { getAttribute: () => '' }).getAttribute('data-v2v-affiche') !== '', process.env.BANC_DIST ? 15000 : 45000);
  await pg.waitForTimeout(2500); await sansToasts(pg);
  const m = await mesurer(pg);
  console.log(`   1re rangée à ${m.premiere} px · ${m.n} rangées · groupes ${m.tetes.map((t) => t.g + ':' + t.n).join(' ')} · plein « ${m.tete.pleinTxt} »`);
  const tel = W < 600;
  dit(m.tete.h1 != null && m.tete.plein != null && Math.abs(m.tete.h1 - m.tete.plein) <= 10 && (!tel || (m.tete.cloche != null && Math.abs(m.tete.h1 - m.tete.cloche) <= 12)),
    `H ${th} : « Ventes », le plein et la cloche sur UNE ligne`, m.tete);
  dit(m.tete.menuHaut != null && m.tete.h1Bas != null && m.tete.menuHaut >= m.tete.h1Bas - 2 && m.tete.menuHaut - m.tete.h1Bas <= 16, `H ${th} : le menu plateforme juste sous le titre`, m.tete);
  dit(/\d/.test(m.tete.pleinTxt) && new RegExp('Imprimer ' + m.tete.pleinN + ' bordereau').test(m.tete.pleinAria), `H ${th} : le plein dit son nombre (« ${m.tete.pleinAria} »)`, m.tete);
  dit(m.segN.join('|') === 'À envoyer|En route|Toutes', `S ${th} : UN segmenté, sans nombre redit (${m.segN.join(' · ')})`, m.segN);
  dit(m.scanDansChamp, `S ${th} : le scanner est DANS le champ de recherche`);
  if (tel) dit(m.premiere != null && m.premiere <= 310, `L ${th} : la 1re rangée utile à ${m.premiere} px (≤ 310)`, m.premiere);
  const somme = m.tetes.reduce((t, x) => t + x.n, 0);
  dit(m.tetes.length > 0 && m.tetes.every((t) => t.n === (m.parGroupe[t.g] || 0)) && new Set(m.tetes.map((t) => t.g)).size === m.tetes.length && somme === m.n,
    `L ${th} : ${m.tetes.length} groupes, chacun dit une fois avec son nombre (somme ${somme} = ${m.n} rangées)`, { tetes: m.tetes, par: m.parGroupe });
  dit(m.redits === 0 && m.sansTitre === 0, `R ${th} : rien redit par rangée (ni « Choisir la vente », ni compte), chaque rangée a son titre`, m);
  dit(m.pleins === 1, `P ${th} : exactement UN bouton plein visible (${m.pleins})`, m.pleins);
  dit(!m.petits.length, `T ${th} : ${m.nB} boutons, tous ≥ 44 × 44`, m.petits);
  dit(!m.tronques.length, `X ${th} : aucun texte tronqué sans « … »`, m.tronques);
  dit(m.deb <= 1 && !m.hors.length, `X ${th} : rien ne déborde`, { deb: m.deb, hors: m.hors });
  dit(m.nC > 10 && !m.faibles.length, `C ${th} : ${m.nC} textes ≥ 4,5:1 (3:1 grand) — min ${m.minC}`, m.faibles);
  if (ref) {
    dit(m.affiche != null && m.affiche === ref.chiffre, `N ${th} : l'affiche (${m.affiche}) = le grand chiffre d'avant (${ref.chiffre})`, { v2: m.affiche, avant: ref.chiffre });
    dit(String(m.n) === String(ref.chiffre), `N ${th} : ${m.n} rangées « À envoyer » = ce nombre (${ref.chiffre}) — aucun colis caché`, { n: m.n, avant: ref.chiffre });
    dit(m.tete.pleinN != null && m.tete.pleinN === ref.lot, `N ${th} : le plein (${m.tete.pleinN}) = le plein d'avant (${ref.lot})`, { v2: m.tete.pleinN, avant: ref.lot });
  }
  await pg.screenshot({ path: path.join(SHOTS, `ventes-${th}.png`) });
  if (tel) {
    // G : la recherche par N° trouve la rangée.
    const num = await pg.evaluate(() => { const p = document.querySelector('[data-v2v-liste] [data-v2v-ligne] .v2-etiquette'); return p ? p.getAttribute('data-v2-etiquette') : ''; });
    await pg.locator('[data-v2v-champ] input').fill(num, { timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(500);
    const tr = await pg.evaluate((n) => [...document.querySelectorAll('[data-v2v-liste] [data-v2v-ligne] .v2-etiquette')].map((p) => p.getAttribute('data-v2-etiquette')), num);
    dit(num && tr.length >= 1 && tr.includes(num) && tr.length < 5, `G ${th} : « ${num} » tapé ⇒ ${tr.length} rangée(s), dont N°${num}`, tr);
    await pg.screenshot({ path: path.join(SHOTS, `ventes-recherche-${th}.png`) });
    await pg.locator('[data-v2v-champ] input').fill('', { timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(400);
    // G : glisser à gauche ⇒ Imprimer · Plus (le tiroir de la rangée).
    const gl = await pg.evaluate(() => { const r = document.querySelector('[data-v2v-liste] [data-v2v-ligne][data-v2v-pret="1"]') || document.querySelector('[data-v2v-liste] [data-v2v-ligne]');
      return r ? [...r.querySelectorAll('[data-v2l-glisse]')].map((b) => b.getAttribute('data-v2l-glisse')) : []; });
    dit(gl.length === 2 && gl.includes('imprimer') && gl.includes('plus'), `G ${th} : glisser à gauche ⇒ Imprimer · Plus (${gl.join(', ')})`, gl);
    // G : toucher ⇒ la fiche.
    await pg.locator('[data-v2v-liste] [data-v2v-ligne] .v2l-a-titre').first().tap({ timeout: 4000 }).catch(() => {});
    const fiche = await attendre(pg, () => !!document.querySelector('.vrm-fp, [data-fiche-paire], [data-fp]'), 8000);
    dit(fiche, `G ${th} : toucher la rangée ouvre la fiche de la paire`);
    await pg.screenshot({ path: path.join(SHOTS, `ventes-fiche-${th}.png`) });
    // La fiche se referme par la page rechargée (le réglage reste allumé), puis la liste revient.
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await attendre(pg, () => document.querySelectorAll('[data-v2v-liste="envoyer"] [data-v2v-ligne]').length > 0, 45000); await pg.waitForTimeout(1500); await sansToasts(pg);
    // O : « ⋯ » ⇒ la feuille des gestes d'hier.
    await pg.locator('[data-v2v-plus]').first().tap({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(600);
    const outils = await pg.evaluate(() => [...document.querySelectorAll('[data-v2-feuille="ventes-outils"] [data-v2v-outil]')].map((b) => b.getAttribute('data-v2v-outil')));
    dit(['choisir', 'papier', 'preparer', 'deposer', 'scanner', 'tous'].every((k) => outils.includes(k)), `O ${th} : « ⋯ » ⇒ ${outils.join(', ')}`, outils);
    await pg.screenshot({ path: path.join(SHOTS, `ventes-outils-${th}.png`) });
    await pg.evaluate(() => { const v = document.querySelector('[data-v2-feuille="ventes-outils"] .v2-voile'); if (v) v.click(); }); await pg.waitForTimeout(400);
    // F : une rangée imprimée (le geste « Marquer imprimé » de SA carte d'hier, le même état `vinted_bords_printed`) joue le
    //     mouvement « fait » (coche, glisse, se replie), rejoint « Imprimés, à déposer », le plein descend d'un cran, et le
    //     chiffre d'affiche ne bouge pas (imprimé n'est pas envoyé).
    const f0 = await pg.evaluate(() => { const r = document.querySelector('[data-v2v-liste="envoyer"] [data-v2v-ligne][data-v2v-pret="1"][data-v2v-imprime="0"]');
      const pl = document.querySelector('[data-v2-principal="imprimer"]');
      return r ? { cle: r.getAttribute('data-v2v-ligne'), plein: Number(pl && pl.getAttribute('data-impr-lot')), affiche: (document.querySelector('[data-v2v-affiche]') || { getAttribute: () => '' }).getAttribute('data-v2v-affiche') } : null; });
    if (f0) {
      await pg.evaluate((cle) => { const b = document.querySelector(`.v2-cache [data-colis-ident="${CSS.escape(cle)}"] button[data-geste="imprime"]`); if (b) b.click(); }, f0.cle);
      const vu = await attendre(pg, (cle) => !!document.querySelector(`[data-v2v-ligne="${CSS.escape(cle)}"][data-v2v-fait="part"]`), 1500, f0.cle).catch(() => false);
      const enCours = await pg.evaluate(() => !!document.querySelector('.v2-faite.is-faite .v2v-ligne, .v2-faite.is-faite [data-v2v-ligne]') || !!document.querySelector('.v2-faite.is-faite'));
      await pg.screenshot({ path: path.join(SHOTS, `ventes-fait-${th}.png`) });
      await pg.waitForTimeout(1200);
      const f1 = await pg.evaluate((cle) => { const r = [...document.querySelectorAll(`[data-v2v-ligne="${CSS.escape(cle)}"]`)].filter((x) => x.getAttribute('data-v2v-fait') !== 'part');
        const pl = document.querySelector('[data-v2-principal="imprimer"]');
        return { groupe: r[0] ? r[0].getAttribute('data-v2v-groupe') : null, n: r.length, part: !!document.querySelector(`[data-v2v-ligne="${CSS.escape(cle)}"][data-v2v-fait="part"]`), plein: Number(pl && pl.getAttribute('data-impr-lot')), affiche: (document.querySelector('[data-v2v-affiche]') || { getAttribute: () => '' }).getAttribute('data-v2v-affiche') }; }, f0.cle);
      dit(vu && enCours, `F ${th} : la rangée imprimée joue le mouvement « fait » (coche, glisse, se replie)`, { vu, enCours });
      dit(f1.n === 1 && !f1.part && f1.groupe === 'imprimes', `F ${th} : puis elle est rangée, une fois, dans « Imprimés, à déposer »`, f1);
      dit(f1.plein === f0.plein - 1 && f1.affiche === f0.affiche, `F ${th} : le plein descend d'un cran (${f0.plein} → ${f1.plein}), l'affiche ne bouge pas (${f1.affiche})`, { f0, f1 });
      await pg.screenshot({ path: path.join(SHOTS, `ventes-fait-apres-${th}.png`) });
    } else dit(false, `F ${th} : une rangée prête, pas encore imprimée, à imprimer`);
    // En route.
    await pg.locator('[data-v2v-seg="envoyes"]').first().tap({ timeout: 8000 }).catch(() => {});
    await attendre(pg, () => document.querySelectorAll('[data-v2v-liste="route"] [data-v2v-ligne]').length > 0, 15000); await pg.waitForTimeout(800);
    const r = await mesurer(pg);
    const nRoute = await pg.evaluate(() => document.querySelectorAll('[data-v2v-liste="route"] [data-v2v-ligne]').length);
    if (ref) dit(String(nRoute) === String(ref.envoyes), `N ${th} : ${nRoute} rangées « En route » = les envoyés d'avant (${ref.envoyes})`, { v2: nRoute, avant: ref.envoyes });
    dit(r.tetes.length > 0 && r.tetes.every((t) => t.n === (r.parGroupe[t.g] || 0)), `L ${th} : En route groupé par état (${r.tetes.map((t) => t.t).join(' · ')})`, r.tetes);
    dit(r.pleins === 1 && !r.petits.length && !r.tronques.length && r.deb <= 1 && !r.faibles.length, `P/T/X/C ${th} : En route propre`, { p: r.pleins, petits: r.petits, t: r.tronques, f: r.faibles });
    await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTo(0, 0); }); await sansToasts(pg);
    await pg.screenshot({ path: path.join(SHOTS, `ventes-route-${th}.png`) });
    await pg.locator('[data-v2v-seg="toutes"]').first().tap({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1500); await sansToasts(pg);
    dit(await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1), `X ${th} : « Toutes » se rend sans débordement`);
    await pg.screenshot({ path: path.join(SHOTS, `ventes-toutes-${th}.png`) });
  }
  dit(!erreurs.length, `${th} : aucune erreur JS`, erreurs);
  await ctx.close();
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  const sigs = {};
  try {
    console.log('\n── éteint (l\'écran d\'avant, la référence des nombres)');
    const refC = await avant(nav, b, false);
    sigs.ventes = refC.sig;
    dit(refC.attr == null, 'E éteint : aucun data-design sur <html>', refC.attr);
    dit(refC.chiffre != null && refC.chiffre !== '' && refC.lot != null, `E l'écran d'avant donne ses nombres (affiche ${refC.chiffre}, plein ${refC.lot}, envoyés ${refC.envoyes})`, refC);
    if (SIG_AVANT && fs.existsSync(SIG_AVANT)) {
      const a = (JSON.parse(fs.readFileSync(SIG_AVANT, 'utf8')).ventes || []).map((x) => x.replace(/,data-vu(?=[,\]])|\[data-vu\]|(?<=\[)data-vu,/g, ''));
      const c = (refC.sig || []).map((x) => x.replace(/,data-vu(?=[,\]])|\[data-vu\]|(?<=\[)data-vu,/g, ''));
      let i = 0; while (i < a.length && i < c.length && a[i] === c[i]) i++;
      dit(a.length > 20 && a.length === c.length && i === a.length, `E éteint : Ventes a le DOM de la base (${c.length} nœuds)`, i < Math.max(a.length, c.length) ? { n: [a.length, c.length], ecart: i, base: a[i], ici: c[i] } : undefined);
    } else console.log('  (pas de SIGNATURE_AVANT : la comparaison au DOM de la base n\'est pas jouée)');
    await allume(nav, b, false, 390, refC);
    await allume(nav, b, true, 390, refC);
    await allume(nav, b, false, 1512, refC);
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1500)); }
  fs.writeFileSync(path.join(SHOTS, 'signature-eteint.json'), JSON.stringify(sigs));
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} design-v2-ventes : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
