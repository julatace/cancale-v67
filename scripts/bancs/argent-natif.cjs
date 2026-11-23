require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ARGENT AU STYLE CONVENU + BARRE DU HAUT (20 nov., lot argent-natif) — docs/passation/2026-11-20-argent-natif.md
//      npm run build && node scripts/bancs/argent-natif.cjs
//  Julien (20 nov., captures iPhone) : « Améliore le visuel, tu n'as pas respecté ce qu'on avait dit » ; référence :
//  la feuille « Plus » (listes groupées iOS, rangées sobres, rien de chargé).
//  Bases INVENTÉES (aucune donnée réelle) : `volume` (3 comptes, 150 ventes) et `vide` (un compte, rien vendu) — les
//  mêmes que aujourdhui-propre. Tailles : 390 tactile à zone sûre (47/34), 390×664 (Safari, barres du navigateur),
//  1512 et 1280 ; clair et sombre. Mesure, sur les 4 segments d'Argent (Mois · Statistiques · Déclarer · Factures) :
//    G  le grand titre « Argent » est rendu et VISIBLE en haut (téléphone) ; un seul segmenté ;
//    B  LA BARRE DU HAUT : défilé de 120, 400, 900 px sur Argent, Aujourd'hui, Ventes, Annonces, Achats — chaque
//       icône de la barre (Messages, avatar) ne recouvre aucun texte du contenu SANS que la barre ait son fond opaque
//       (le fond est mesuré : `::before` d'opacité 1) ; le contenu ne se lit jamais à travers ;
//    P  au plus UN bouton plein (`.n-bouton[data-n-variante="plein"]`, `.v2-plein`) visible par segment ;
//    T  cibles ≥ 44 × 44 au doigt ; X aucun texte coupé sans « … » (les montants : jamais), rien ne déborde la page ;
//    C  contraste ≥ 4,5:1 sur le fond rendu ;
//    S  le style : aucun lien souligné, aucun bouton pleine largeur hors du plein, cartes à filet sans ombre ;
//       « Les offres » : aucune colonne vide de bout en bout ; un compte sans rien de lu = une ligne grise ;
//       santé des comptes : des rangées qui se touchent (pas de « Pourquoi ? » souligné) ;
//    N  LES CHIFFRES NE CHANGENT PAS : chaque nombre porté par un data-* de chaque segment (hors mise en page) est égal
//       à celui du build de référence (`BANC_REFERENCE=f`, écrit par `BANC_JSON=f` sur le build d'avant).
//  `SHOTS=dossier` garde les captures (regarde-les). `SEULEMENT_CAPTURES=1` : photographier sans juger.
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';   // l'app telle qu'en production (le design natif)
const P = require('./design-passe.cjs');
const { baseVolume, baseVide } = require('./aujourdhui-propre.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-argent-natif');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const BASES = liste('BASES', 'volume,vide'), TAILLES = liste('TAILLES', '390,390s,1512,1280'), THEMES = liste('THEMES', 'clair,sombre');
const SEGMENTS = liste('SEGMENTS', 'argent,stats,argent_declarer,invoices');
const ECRANS_BARRE = liste('ECRANS_BARRE', 'argent,journee,ventes,annonces,achats');
const JSON_OUT = process.env.BANC_JSON || '';
const REF = process.env.BANC_REFERENCE ? JSON.parse(fs.readFileSync(process.env.BANC_REFERENCE, 'utf8')) : null;
const CAPTURES = process.env.SEULEMENT_CAPTURES === '1';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (CAPTURES) return c; if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };
const releve = {};

async function ouvrir(nav, { taille, sombre, b, url }) {
  const W = taille === '390s' ? 390 : Number(taille);
  const { ctx, pg, erreurs } = await P.ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url });
  if (taille === '390s') await pg.setViewportSize({ width: 390, height: 664 });
  else if (W >= 600 && W !== 1512) await pg.setViewportSize({ width: W, height: 800 });
  if (taille === '390') { try { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }); } catch (_) {} }
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {});
  return { ctx, pg, erreurs };
}
// L'écran ne bouge plus (les lectures arrivent par vagues).
async function calme(pg) {
  let avant = '', egaux = 0;
  for (let k = 0; k < 18 && egaux < 2; k++) { await pg.waitForTimeout(1200); const s = await pg.evaluate(() => { const e = document.querySelector('.vrm-main'); return e ? e.innerText : ''; }); if (s && s === avant) egaux++; else egaux = 0; avant = s; }
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
  await pg.waitForTimeout(400);
}
const defile = (pg, y) => pg.evaluate((y) => { const m = document.querySelector('.vrm-main'); const s = m && m.scrollHeight > m.clientHeight + 4 && getComputedStyle(m).overflowY !== 'visible' ? m : document.scrollingElement; s.scrollTop = y; return s.scrollTop; }, y);

// Ce que montre le segment (mesures de style, nombres rendus).
const MESURE = () => {
  const main = document.querySelector('.vrm-main'); if (!main) return null;
  const vu = (e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || x.hidden) return false; } return true; };
  const texte = (main.innerText || '').replace(/[  ]/g, ' ');
  const montants = (texte.match(/-?\d[\d ]*(?:,\d{1,2})? ?€/g) || []).map((x) => x.replace(/\s/g, ''));
  const tete = document.querySelector('[data-tete-native]');
  const grand = document.querySelector('.vrm-main .n-grand-titre, [data-tete-native] ~ .n-grand-titre, .n-grand-titre');
  const grandVu = !!grand && vu(grand) && grand.getBoundingClientRect().top < 260;
  const pleins = [...main.querySelectorAll('.n-bouton[data-n-variante="plein"], .v2-plein, [data-n-plein] button')].filter(vu).filter((e, i, a) => !a.some((f) => f !== e && f.contains(e)));
  const soulignes = [...main.querySelectorAll('a, button, [role="button"]')].filter(vu).filter((e) => /underline/.test(getComputedStyle(e).textDecorationLine)).map((e) => e.innerText.trim().slice(0, 30));
  const W = document.documentElement.clientWidth;
  const largeurs = [...main.querySelectorAll('button')].filter(vu).filter((e) => !e.closest('[data-n-plein], .n-rangee, .n-segmente, .v2-seg, [role="tablist"], .n-tuile, .vrm-seg, details > summary, .n-groupe-repli, [data-arg-rangee]') && !/plein/.test(e.getAttribute('data-n-variante') || '') && !e.classList.contains('v2-plein'))
    .filter((e) => { const t = (e.innerText || '').trim(); return t && !/\n/.test(t) && t.split(/\s+/).length <= 4 && !/›$/.test(t) && e.getBoundingClientRect().width > W * 0.8 && e.getBoundingClientRect().height < 70; })
    .map((e) => e.innerText.trim().slice(0, 30) + ' ' + (e.className || '').toString().split(' ')[0]);
  const coupes = [];
  const lecteurSeul = (e) => !!e.closest('.vrm-sr-seul, .n-lu-seul, .vg-sr, [data-sr]') || /inset\(50%\)|rect\(0/.test(getComputedStyle(e).clipPath + getComputedStyle(e).clip);
  const nom = (e) => (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase());
  for (const e of main.querySelectorAll('*')) { if (!vu(e) || e.children.length || lecteurSeul(e)) continue; const t = (e.innerText || '').trim(); if (!t) continue; const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis') coupes.push(nom(e) + ' ' + t.slice(0, 40));
    if (/€/.test(t) && e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible') coupes.push('€ ' + t.slice(0, 40)); }
  const deborde = document.documentElement.scrollWidth > W + 1;
  const ombres = [...main.querySelectorAll('[data-arg-carte], .n-carte, .n-groupe-corps')].filter(vu).filter((e) => getComputedStyle(e).boxShadow !== 'none').length;
  const offres = main.querySelector('[data-arg-offres]');
  // Une colonne vide de bout en bout (que des « — » sur les comptes lus) : ce que Julien a vu (« Reçues, Acceptées… vides »).
  const colsVides = (() => { const t = offres || [...main.querySelectorAll('[role="table"]')].find((x) => x.closest('[data-stats-carte="sv-offres"]')); if (!t) return null;
    const tete = [...t.querySelectorAll('[role="columnheader"]')].map((h) => h.innerText.trim());
    const lignes = [...t.querySelectorAll('[role="row"]')].filter((r) => !r.querySelector('[role="columnheader"]') && r.querySelectorAll('[role="cell"]').length === tete.length);
    if (!lignes.length) return [];
    return tete.slice(1).filter((_, k) => lignes.every((r) => r.querySelectorAll('[role="cell"]')[k + 1].innerText.trim() === '—')); })();
  const muets = offres ? offres.querySelectorAll('[data-arg-rien-lu]').length : 0;
  const sante = main.querySelectorAll('[data-arg-sante-rangee]').length;
  const pourquoi = [...main.querySelectorAll('a, button')].filter(vu).filter((e) => /^Pourquoi/.test(e.innerText.trim())).length;
  // LES CHIFFRES PORTÉS (les nombres des data-*, jamais un libellé) : le même relevé avant et après. Écartés : ce qui
  // dépend de la MISE EN PAGE (combien de rangées sont montrées, la barre choisie, les attributs neufs `data-arg-*`, `data-n-*`)
  // et les rangées de versements (8 montrées au lieu de 30 : leur NOMBRE est porté par `data-v2-argent-versements`).
  const MISE_EN_PAGE = /^data-(arg-|n-|rev-lignes|v2-argent-faits|v2-argent-barre-v|v2-argent-versement$|v2-bande|v2-dernieres|sc-lus|qr-liste|photos-perdues|ms-rang)/;
  const chiffres = [];
  for (const e of main.querySelectorAll('*')) { if (e.closest('[data-v2-argent-versement]')) continue;
    for (const a of e.attributes) if (a.name.startsWith('data-') && !MISE_EN_PAGE.test(a.name) && /^-?\d+(?:[.,]\d+)?$/.test(a.value) && !(Number(a.value) > 1.6e12 && Number(a.value) < 2.2e12)) chiffres.push(a.name + '=' + a.value); }
  return { chiffres: [...new Set(chiffres)].sort(), tete: !!tete, grandVu, pleins: pleins.length, soulignes, largeurs, coupes: [...new Set(coupes)].slice(0, 12), deborde, ombres, colsVides, sante, pourquoi, montants: montants.slice().sort(), haut: main.scrollHeight };
};
// Petites cibles au doigt (les éléments touchables visibles).
const CIBLES = () => { const main = document.querySelector('.vrm-main'); const out = [];
  for (const e of main.querySelectorAll('button, a[href], [role="button"], input:not([type="hidden"]), select, summary')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; let cache = false; for (let x = e; x; x = x.parentElement) if (x.hidden || getComputedStyle(x).display === 'none') { cache = true; break; } if (cache) continue;
    if (e.closest('[inert]') || e.matches('.vrm-source-q')) continue; if (r.width < 43.5 || r.height < 43.5) out.push((e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30) + ' ' + Math.round(r.width) + '×' + Math.round(r.height) + ' ' + (e.className || '').toString().split(' ')[0]); }
  return [...new Set(out)].slice(0, 10); };
// La barre du haut : chaque icône (Messages, avatar) recouvre-t-elle un texte du contenu sans fond opaque derrière ?
const BARRE = () => {
  const tete = document.querySelector('[data-tete-native]'); if (!tete) return { tete: false };
  const fondOpaque = (() => { const cs = getComputedStyle(tete, '::before'); return Number(cs.opacity) >= 0.99 && cs.content !== 'none'; })();
  const icones = [...tete.querySelectorAll('.n-barre-droite button')].map((b) => b.getBoundingClientRect()).filter((r) => r.width);
  const main = document.querySelector('.vrm-main'); const touches = [];
  const tr = tete.getBoundingClientRect();
  for (const e of main.querySelectorAll('*')) { if (e.children.length || tete.contains(e)) continue; const t = (e.innerText || '').trim(); if (!t) continue; const r = e.getBoundingClientRect(); if (!r.width) continue;
    let cache = false; for (let x = e; x; x = x.parentElement) if (x.hidden || getComputedStyle(x).display === 'none' || getComputedStyle(x).visibility === 'hidden') { cache = true; break; } if (cache) continue;
    for (const i of icones) if (r.left < i.right && r.right > i.left && r.top < i.bottom && r.bottom > i.top) touches.push(t.slice(0, 30)); }
  return { tete: true, fondOpaque, touches: [...new Set(touches)].slice(0, 6), basBarre: Math.round(tr.bottom), icones: icones.length };
};

async function unSegment(nav, nomBase, b, taille, sombre, seg) {
  const ou = `${nomBase} ${taille} ${sombre ? 'sombre' : 'clair'} ${seg}`;
  const { ctx, pg, erreurs } = await ouvrir(nav, { taille, sombre, b, url: '/?tab=ventes' });
  try {
    // Ventes d'abord (comme le vendeur : la ligne du CA déclaré se publie là), puis le segment.
    await calme(pg);
    await pg.goto(`http://localhost:${P.PORT}/?tab=${seg}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {});
    await calme(pg);
    const tel = taille.startsWith('390');
    const m = await pg.evaluate(MESURE);
    // L'écran défile dans `.vrm-main` : une capture par hauteur d'écran (au plus 8), puis retour en haut.
    const hv = await pg.evaluate(() => window.innerHeight);
    for (let k = 0; k < 8; k++) { const y = await defile(pg, k * (hv - 160)); if (k && y < (k - 1) * (hv - 160) + 10) break; await pg.waitForTimeout(250);
      await pg.screenshot({ path: path.join(SHOTS, `${nomBase}-${taille}-${sombre ? 'sombre' : 'clair'}-${seg}-${k}.png`) }); if (y < k * (hv - 160) - 10) break; }
    await defile(pg, 0); await pg.waitForTimeout(300);
    if (!m) { dit(false, `${ou} : l'écran est rendu`); return; }
    (releve[nomBase] = releve[nomBase] || {})[seg] = releve[nomBase][seg] || m.chiffres;
    if (tel && seg !== 'invoices') dit(m.grandVu, `G ${ou} : le grand titre « Argent » est visible en haut`);
    dit(m.pleins <= 1, `P ${ou} : au plus un bouton plein (${m.pleins})`);
    dit(!m.soulignes.length, `S ${ou} : aucun lien souligné`, m.soulignes);
    if (tel) dit(!m.largeurs.length, `S ${ou} : aucun bouton pleine largeur hors du plein`, m.largeurs);
    dit(!m.ombres, `S ${ou} : cartes à filet, sans ombre`, m.ombres);
    dit(!m.coupes.length, `X ${ou} : rien de coupé`, m.coupes);
    dit(!m.deborde, `X ${ou} : la page ne déborde pas en largeur`);
    if (seg === 'stats' && m.colsVides) dit(!m.colsVides.length, `S ${ou} : « Les offres » sans colonne vide`, m.colsVides);
    if (seg === 'stats') dit(!m.pourquoi, `S ${ou} : plus de « Pourquoi ? » en lien (le toucher de la rangée)`, m.pourquoi);
    if (tel) { const c = await pg.evaluate(CIBLES); dit(!c.length, `T ${ou} : cibles ≥ 44`, c); }
    const ct = await contraste(pg);
    dit(!ct.length, `C ${ou} : contraste ≥ 4,5:1`, ct);
    dit(!erreurs.length, `${ou} : aucune erreur JS`, erreurs);
    if (REF && REF[nomBase] && REF[nomBase][seg] && taille === '1512' && !sombre) {
      const avant = REF[nomBase][seg], apres = m.chiffres;
      const manquent = avant.filter((x) => !apres.includes(x)), neufs = apres.filter((x) => !avant.includes(x));
      dit(!manquent.length && !neufs.length, `N ${ou} : chaque chiffre porté (data-*) est le même qu'avant (${avant.length})`, { manquent: manquent.slice(0, 20), neufs: neufs.slice(0, 20) });
    }
  } catch (e) { dit(false, `${ou} : le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 500)); }
  await ctx.close();
}
async function contraste(pg) {
  return pg.evaluate(() => {
    const px = (t) => { const m = String(t).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const fond = (e) => { const pile = []; for (let x = e; x; x = x.parentElement) { const c = px(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 0.99) break; } } let r = { r: 255, g: 255, b: 255 }; if (!pile.length || pile[pile.length - 1].a < 0.99) r = px(getComputedStyle(document.body).backgroundColor) || r; for (let i = pile.length - 1; i >= 0; i--) { const c = pile[i]; r = { r: c.r * c.a + r.r * (1 - c.a), g: c.g * c.a + r.g * (1 - c.a), b: c.b * c.a + r.b * (1 - c.a) }; } return r; };
    const out = []; const main = document.querySelector('.vrm-main');
    for (const e of main.querySelectorAll('*')) { if ([...e.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim())) continue; const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
      let cache = false, op = 1; for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (x.hidden || cs.display === 'none' || cs.visibility === 'hidden') { cache = true; break; } op *= Number(cs.opacity); } if (cache || op < 0.99) continue;
      if (e.closest('[inert], [aria-hidden="true"], .vrm-flou, .vrm-sensible-cache')) continue;
      const cs = getComputedStyle(e); const c = px(cs.color); if (!c || c.a < 0.99) continue; const f = fond(e);
      const a = lum(c), b = lum(f); const k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const grand = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && Number(cs.fontWeight) >= 700);
      if (k < (grand ? 3 : 4.5)) out.push(e.textContent.trim().slice(0, 30) + ' ' + k.toFixed(2) + ' ' + (e.className || e.tagName).toString().split(' ')[0]); }
    return [...new Set(out)].slice(0, 8);
  });
}
async function laBarre(nav, nomBase, b, taille, sombre, ecran) {
  const ou = `${nomBase} ${taille} ${sombre ? 'sombre' : 'clair'} ${ecran}`;
  const { ctx, pg } = await ouvrir(nav, { taille, sombre, b, url: '/?tab=' + ecran });
  try {
    await calme(pg);
    const haut = await pg.evaluate(BARRE);
    if (!haut.tete) { dit(false, `B ${ou} : la barre du haut est rendue`); return; }
    for (const y of [120, 400, 900]) {
      const vrai = await defile(pg, y); if (y > 120 && vrai < y - 50) break;
      await pg.waitForTimeout(450);
      const r = await pg.evaluate(BARRE);
      dit(r.fondOpaque || !r.touches.length, `B ${ou} défilé ${vrai} : aucune icône de la barre posée sur le contenu sans fond`, r);
      if (y === 400) await pg.screenshot({ path: path.join(SHOTS, `barre-${nomBase}-${taille}-${sombre ? 'sombre' : 'clair'}-${ecran}.png`) });
    }
  } catch (e) { dit(false, `B ${ou} : le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 500)); }
  await ctx.close();
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  // Le statut de Julien : micro-entrepreneur, déclaration mensuelle (la carte « Déclarer » complète).
  const micro = (b) => { const m = b.main[0].data; m.vinted_regime = 'micro'; m.vinted_urssaf_freq = 'mensuel'; m.vrm_urssaf_declare = {};
    // La ligne du CA déclaré telle que Ventes la publie (`vinted_urssaf_mois`) : la base inventée n'a pas les détails de
    // transaction qui la font calculer ; posée ici (inventée, à sa forme) pour que Mois et Déclarer montrent des chiffres.
    if (b.ventesLues !== false && !b.vide) { const mois = [], recu = {}; const d = new Date(); d.setDate(1);
      for (let k = 0; k < 7; k++) { const ym = d.toISOString().slice(0, 7); const ca = [1840.5, 2604.2, 15070.84, 1988, 2210.4, 1760, 2390][k]; mois.push({ ym, n: 20 + k * 3, ca, nMasq: 0, caMasq: 0, par: { Vinted: { n: 18 + k * 3, ca: ca - 120 }, Leboncoin: { n: 2, ca: 120 } }, nApres: 0, caApres: 0, nDouble: 0, caDouble: 0, nAilleurs: 0, caAilleurs: 0, declare: null }); recu[ym] = ca; d.setMonth(d.getMonth() - 1); }
      m.vinted_urssaf_mois = { mois, aDater: null, ecartees: 0, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' }, declare: {}, recu, recuJours: {}, nonComptees: { n: 0, par: {}, parC: {} }, at: Date.now() }; }
    return b; };
  const FAB = { volume: () => micro(baseVolume()), vide: () => micro(Object.assign(baseVide(), { vide: true })) };
  try {
    if (!process.env.SEULEMENT_BARRE) for (const nomBase of BASES) for (const taille of TAILLES) for (const t of THEMES) for (const seg of SEGMENTS) await unSegment(nav, nomBase, FAB[nomBase](), taille, t === 'sombre', seg);
    if (!process.env.SANS_BARRE) for (const taille of liste('TAILLES_BARRE', '390,390s')) for (const t of THEMES) for (const e of ECRANS_BARRE) await laBarre(nav, 'volume', FAB.volume(), taille, t === 'sombre', e);
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); }
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(releve));
  await nav.close(); P.srv.close();
  console.log(`\n${ko ? '❌' : '✅'} argent-natif : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
