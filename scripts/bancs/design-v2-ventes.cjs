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
    // un groupe oublié : les colis à date estimée ne sont plus rangés (des colis cachés)
    groupe: [/"plusTard","estimee","sansDate"/g, '"plusTard","sansDate"'],
    // le compte redit sur chaque rangée (ce qui était interdit)
    compte: [/cle:"vendue",icone:"clock",texte:/g, 'cle:"vendue",icone:"clock",texte:"vendeur_1 · "+'],
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
// Les messages passagers d'avant la capture (toasts, l'alerte locale « N nouvelles paires numérotées ») sont fermés : la
// capture montre l'écran.
const sansToasts = async (pg) => { await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click();
  for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position !== 'fixed' || !/paires? numérotées?/.test(e.textContent || '') || e.closest('.vrm-tabbar')) continue;
    const f = [...e.querySelectorAll('button')].find((b) => /fermer|close|×/i.test((b.getAttribute('aria-label') || '') + b.textContent)); if (f) { f.click(); break; } } }).catch(() => {}); await pg.waitForTimeout(400); };

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
  await sansToasts(pg); x.palette = await palette(pg);
  await pg.screenshot({ path: path.join(SHOTS, `eteint-ventes-390-${sombre ? 'sombre' : 'clair'}.png`) });
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
      sansTitre: lignes.filter((r) => !(r.querySelector('.v2l-a-titre') || {}).textContent).length,
      // Plusieurs infos par rangée (Julien) : la 3e ligne, ses faits ; la taille sortie du titre ; l'ambre seulement sur une limite.
      faits: lignes.map((r) => r.querySelectorAll('.v2l-l3').length), orphelins: lignes.filter((r) => /\btaille\s*\d{2}(?:[.,]5)?\s*$/i.test(((r.querySelector('.v2l-a-titre') || {}).textContent || '').trim())).length,
      ambresHorsLimite: [...document.querySelectorAll('[data-v2v-liste] .v2l-l3.is-ambre')].filter((x) => x.getAttribute('data-v2l-l3') !== 'limite').length,
      bande: [...document.querySelectorAll('[data-heros-hote="ventes"]')].filter(vis).length };
  }, CONTRASTE);
}

// LA GRILLE « QUALITÉ ET FLUIDITÉ » (Julien : « ça doit être beaucoup plus quali et fluide »), mesurée sur l'écran rendu.
async function qualite(pg, th) {
  // L'appui RÉEL : `:active` forcé par le protocole du navigateur sur la rangée et le plein (la transition de l'appui, pas
  // celle du retour au repos, qui est un ressort plus lent).
  const appuiForce = {};
  try {
    const cdp = await pg.context().newCDPSession(pg); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    for (const [k, sel] of [['rangee', '.v2v-liste .v2l'], ['plein', '[data-v2-principal="imprimer"]']]) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel }); if (!nodeId) continue;
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
      appuiForce[k] = await pg.evaluate((sel) => { const e = document.querySelector(sel); const cs = getComputedStyle(e); const ms = (x) => (x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000);
        const props = cs.transitionProperty.split(',').map((x) => x.trim()); const durs = cs.transitionDuration.split(',').map(ms);
        const v = props.map((p, i) => (/^(all|transform|background-color|background|scale|filter)$/.test(p) ? durs[i % durs.length] : null)).filter((x) => x != null); return v.length ? Math.max(...v) : 0; }, sel);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    }
    await cdp.detach();
  } catch (e) { appuiForce.erreur = String(e.message || e).slice(0, 120); }
  const t0 = await pg.evaluate(() => performance.now());
  await pg.waitForTimeout(2500);   // l'écran au repos : plus rien ne doit bouger tout seul
  const q = await pg.evaluate((t0) => {
    const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden], .v2-cache, .vrm-sr-seul');
    const zones = [...document.querySelectorAll('.v2v-titre-ligne, .v2v-tete, .v2v-corps')].filter(vis);
    const tous = zones.flatMap((z) => [z, ...z.querySelectorAll('*')]).filter(vis).filter((e) => !e.closest('.v2-etiquette, svg, .vrm-retours-lot, .v2v-note, [data-lg-tiroir]'));
    const px = (v) => String(v || '').split(/\s+/).map(parseFloat).filter((x) => Number.isFinite(x));
    const ms = (v) => Math.max(...String(v || '0s').split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000)));
    const row = document.querySelector('.v2v-liste .v2l'); const plein = document.querySelector('[data-v2-principal="imprimer"]');
    // La réponse à l'appui : la durée de la transition de CE qui change à l'appui (fond, transformation), pas des autres.
    const appuiDe = (e) => { const cs = getComputedStyle(e); const props = cs.transitionProperty.split(',').map((x) => x.trim()); const durs = cs.transitionDuration.split(',').map((x) => ms(x));
      const v = props.map((p, i) => (/^(all|transform|background-color|background|scale|filter)$/.test(p) ? durs[i % durs.length] : null)).filter((x) => x != null); return v.length ? Math.max(...v) : 0; };
    const appui = { rangee: row ? appuiDe(row) : null, plein: plein ? appuiDe(plein) : null };
    const repos = (window.__cls || []).filter((x) => x.t > t0 && !x.input).reduce((s, x) => s + x.v, 0);
    const cv = row ? getComputedStyle(row).contentVisibility : null;
    const img = document.querySelector('.v2v-liste .v2l-photo img'); const fondu = img ? getComputedStyle(img).animationName : null;
    const boite = img ? (() => { const r = img.parentElement.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() : null;
    const tailles = [...new Set(tous.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => Math.round(parseFloat(getComputedStyle(e).fontSize))))].sort((a, b) => a - b);
    const rayons = tous.map((e) => { const r = parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0; const q = e.getBoundingClientRect(); return { r, rond: r >= Math.min(q.width, q.height) / 2 - 1, c: e.className && e.className.baseVal === undefined ? String(e.className).slice(0, 30) : '' }; })
      .filter((x) => x.r > 0 && !x.rond && ![12, 14, 20].includes(Math.round(x.r)));
    const mes = (e) => e.matches('[class*="v2v-"], .v2l, .v2l *');
    const grille = tous.filter(mes).flatMap((e) => { const cs = getComputedStyle(e); return ['padding', 'margin', 'rowGap', 'columnGap'].flatMap((k) => px(cs[k]).map((v) => ({ k, v, c: String(e.className).slice(0, 30) }))); })
      .filter((x) => Math.abs(x.v) % 4 !== 0);
    const champ = document.querySelector('.v2v-recherche .v2v-champ'), plus = document.querySelector('[data-v2v-plus]');
    const segs = [...document.querySelectorAll('[data-v2v-segment] button')].map((b) => b.offsetHeight);
    const hauteurs = { champ: champ ? champ.offsetHeight : null, plus: plus ? plus.offsetHeight : null, segs };
    const restes = [...document.querySelectorAll('.vrm-main :is(.vv-hero, .vv-seg, .vv-pied, .vv-filtres, .vrm-colis-grille, [data-bord-card], .vrm-colis-resume, .vrm-colis-afaire, [data-heros-hote])')].filter(vis).map((e) => String(e.className).slice(0, 30));
    return { appuiRepos: appui, repos: Math.round(repos * 1000) / 1000, cv, fondu, boite, tailles, rayons: rayons.slice(0, 5), grille: grille.slice(0, 6), nGrille: grille.length, hauteurs, restes };
  }, t0);
  q.appui = { rangee: appuiForce.rangee != null ? appuiForce.rangee : null, plein: appuiForce.plein != null ? appuiForce.plein : null, ...(appuiForce.erreur ? { erreur: appuiForce.erreur } : {}) };
  dit(q.appui.rangee != null && q.appui.rangee <= 100 && q.appui.plein != null && q.appui.plein <= 100, `Q ${th} : réponse au toucher ≤ 100 ms (rangée ${q.appui.rangee} ms, plein ${q.appui.plein} ms)`, q.appui);
  dit(q.repos === 0, `Q ${th} : au repos, rien ne saute (CLS hors geste = ${q.repos})`, q.repos);
  dit(q.cv === 'auto', `Q ${th} : 1 000 rangées sans à-coup (content-visibility: ${q.cv})`, q.cv);
  dit(/fondu/.test(q.fondu || '') && q.boite && q.boite[0] === 64 && q.boite[1] === 64, `Q ${th} : la photo arrive en fondu dans sa boîte de 64 × 64 (le texte ne bouge pas)`, { f: q.fondu, b: q.boite });
  dit(q.tailles.every((t) => [13, 15, 17, 34, 56].includes(t)), `Q ${th} : trois tailles de texte + chiffres d'affiche (${q.tailles.join(', ')})`, q.tailles);
  dit(!q.rayons.length, `Q ${th} : rayons 12 / 14 / 20 seulement (ou rond)`, q.rayons);
  dit(!q.nGrille, `Q ${th} : grille de 4 (marges, retraits, espaces)`, q.grille);
  dit(q.hauteurs.champ === 44 && q.hauteurs.plus === 44 && q.hauteurs.segs.length === 3 && new Set(q.hauteurs.segs).size === 1, `Q ${th} : même hauteur dans une rangée (champ ${q.hauteurs.champ}, ⋯ ${q.hauteurs.plus}, segments ${q.hauteurs.segs.join('/')})`, q.hauteurs);
  dit(!q.restes.length, `Q ${th} : aucun reste de l'écran d'hier à l'écran`, q.restes);
}

// Q (suite) : pendant la lecture, le squelette de la forme des rangées, jamais un écran blanc ; mouvement réduit respecté.
async function chargementEtMouvement(nav, b) {
  console.log('\n── chargement lent et mouvement réduit (390 clair)');
  // Ouvert sur une page SANS l'app (aucune lecture, aucun cache), puis la lecture des ventes retenue, puis Ventes.
  const { ctx, pg } = await ouvrir(nav, { W: 390, sombre: false, b, url: '/vide-banc.txt' });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
  // La lecture des ventes retenue 5 s (page ET contexte : le service worker de l'app passe par le contexte).
  const lent = async (r) => { await new Promise((ok) => setTimeout(ok, 5000)); return r.fallback(); };
  const ventesLues = (u) => /\/rest\/v1\//.test(String(u)) && /orders_sold/.test(decodeURIComponent(String(u)));
  await pg.route(ventesLues, lent); await ctx.route(ventesLues, lent);
  await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
  const vu = { squelette: false, blanc: 0, ligne: false };
  for (let k = 0; k < 40; k++) {
    const x = await pg.evaluate(() => ({ sq: !!document.querySelector('[data-v2v-corps] [data-v2-squelette]'), ligne: !!document.querySelector('[data-v2v-liste="envoyer"] [data-v2v-ligne]'),
      blanc: !((document.querySelector('.vrm-main') || { innerText: '' }).innerText || '').trim() })).catch(() => ({}));
    if (x.sq) vu.squelette = true; if (x.blanc) vu.blanc++; if (x.ligne) { vu.ligne = true; break; }
    await pg.waitForTimeout(250);
  }
  if (vu.squelette) await pg.screenshot({ path: path.join(SHOTS, 'ventes-squelette-390-clair.png') }).catch(() => {});
  dit(vu.squelette && vu.blanc <= 4, `Q pendant la lecture : le squelette des rangées (vu : ${vu.squelette}), pas d'écran blanc (${vu.blanc} relevés vides au tout début)`, vu);
  await ctx.close();
  const { ctx: c2, pg: p2 } = await ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=ventes' });
  await p2.emulateMedia({ reducedMotion: 'reduce' });
  await p2.evaluate(() => localStorage.setItem('vrm_design_v2', '1')); await p2.reload({ waitUntil: 'domcontentloaded' });
  await attendre(p2, () => document.querySelectorAll('[data-v2v-liste="envoyer"] [data-v2v-ligne]').length > 0, 30000);
  const r = await p2.evaluate(() => { const h = document.createElement('div'); h.className = 'v2-faite is-faite'; h.innerHTML = '<div class="v2-faite-dedans"></div>'; document.body.appendChild(h);
    const l = document.createElement('div'); l.className = 'v2v-liste'; l.innerHTML = '<div class="v2l"><span class="v2l-photo"><img alt=""></span></div><div class="v2-squelette"><span class="v2-squelette-l1"></span></div>'; document.body.appendChild(l);
    return { faite: getComputedStyle(h.firstChild).transform, img: getComputedStyle(l.querySelector('img')).animationName, sq: getComputedStyle(l.querySelector('.v2-squelette-l1')).animationName }; });
  dit(r.faite === 'none' && r.img === 'none' && r.sq === 'none', 'Q mouvement réduit : la rangée faite ne glisse pas (fondu), photos et squelette immobiles', r);
  await c2.close();
}

// LA PALETTE RENDUE d'un écran (l'audit visuel du 17 nov. : l'écran d'hier comptait 20 tailles, 6 graisses, 13 rayons,
// 572 espacements sur 1 281 hors de la grille de 4/8) : relevée sur ce qui est À L'ÉCRAN dans la zone de Ventes.
async function palette(pg) {
  return pg.evaluate(() => {
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden], .v2-cache, .vrm-sr-seul, svg');
    const zone = document.querySelector('.vrm-tache[data-tache="ventes"]') || document.querySelector('.vrm-main');
    const els = [...zone.querySelectorAll('*')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight * 3; }).slice(0, 4000);
    const textes = els.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const tailles = new Set(textes.map((e) => Math.round(parseFloat(getComputedStyle(e).fontSize))));
    const graisses = new Set(textes.map((e) => getComputedStyle(e).fontWeight));
    const rayons = new Set(els.map((e) => { const r = parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0; const q = e.getBoundingClientRect(); return r > 0 && r < Math.min(q.width, q.height) / 2 - 1 ? Math.round(r) : null; }).filter((x) => x != null));
    let n = 0, hors = 0;
    for (const e of els) { const cs = getComputedStyle(e); for (const k of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'rowGap', 'columnGap']) { const v = parseFloat(cs[k]); if (!Number.isFinite(v) || v === 0) continue; n++; if (Math.abs(v) % 4 !== 0) hors++; } }
    const choisir = [...document.querySelectorAll('.vrm-main *')].filter(vis).filter((e) => e.children.length === 0 && /Choisir la vente/.test(e.textContent)).length;
    return { tailles: tailles.size, graisses: graisses.size, rayons: rayons.size, espacements: n, hors, part: n ? Math.round(hors / n * 100) : 0, choisir };
  });
}

// À 375 (normal et « Très grand », ×1,36) : aucun mot coupé, aucun segment rogné, la 1re vente sur le premier écran.
async function etroit(nav, b, grand) {
  const th = '375x667-' + (grand ? 'tres-grand' : 'normal');
  console.log(`\n── allumé · ${th}`);
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=ventes', dsf: 2 });
  await pg.setViewportSize({ width: 375, height: 667 });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await pg.evaluate((g) => { localStorage.setItem('vrm_design_v2', '1'); if (g) localStorage.setItem('vrm_taille_texte', 'tresGrand'); }, grand);
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await attendre(pg, () => document.querySelectorAll('[data-v2v-liste="envoyer"] [data-v2v-ligne]').length > 0, process.env.BANC_DIST ? 15000 : 45000);
  await pg.waitForTimeout(2500); await sansToasts(pg);
  const m = await pg.evaluate(() => {
    const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden], .v2-cache, .vrm-sr-seul');
    const zones = [...document.querySelectorAll('.v2v-titre-ligne, .v2-sous-titre, .v2v-tete, .v2v-corps')].filter(vis);
    const coupes = [];
    for (const z of zones) { const w = document.createTreeWalker(z, NodeFilter.SHOW_TEXT); let t;
      while ((t = w.nextNode())) { if (!vis(t.parentElement)) continue; const re = /[^\s\-–/·]+/g; let m;
        while ((m = re.exec(t.textContent))) { if (m[0].length < 3) continue; const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length);
          const tops = [...new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)))]; if (tops.length > 1) coupes.push(m[0]); } } }
    const rognes = [...document.querySelectorAll('[data-v2v-segment] .v2-seg, [data-v2v-segment] button, [data-v2v-segment] .v2-seg-l, .v2v-titre-ligne button, .v2v-titre-ligne .v2b-lib')].filter(vis).filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim());
    const l = [...document.querySelectorAll('[data-v2v-liste] [data-v2v-ligne]')].filter(vis)[0];
    const pl = document.querySelector('[data-v2-principal="imprimer"]'); const pq = pl && pl.getBoundingClientRect();
    return { coupes: [...new Set(coupes)].slice(0, 8), rognes, premiere: l ? Math.round(l.getBoundingClientRect().top) : null, deb: document.documentElement.scrollWidth - innerWidth,
      plein: pq ? pq.right <= innerWidth + 1 && pq.left >= -1 : null, h: innerHeight };
  });
  dit(!m.coupes.length, `W ${th} : aucun mot coupé au milieu`, m.coupes);
  dit(!m.rognes.length, `W ${th} : aucun segment ni libellé du plein rogné`, m.rognes);
  dit(m.premiere != null && m.premiere < m.h - 80, `W ${th} : la 1re vente sur le premier écran (${m.premiere} px sur ${m.h})`, m.premiere);
  dit(m.deb <= 1 && m.plein === true, `W ${th} : rien ne déborde, le plein est entier à l'écran`, m);
  dit(!erreurs.length, `${th} : aucune erreur JS`, erreurs);
  await pg.screenshot({ path: path.join(SHOTS, `ventes-${th}.png`) });
  await ctx.close();
}

async function allume(nav, b, sombre, W, ref) {
  const th = (W < 600 ? '390-' : '1512-') + (sombre ? 'sombre' : 'clair');
  console.log(`\n── allumé · ${th}`);
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, b, url: '/?tab=ventes', dsf: W < 600 ? 2 : 1 });
  await pg.addInitScript(() => { window.__cls = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__cls.push({ t: e.startTime, v: e.value, input: e.hadRecentInput }); }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {} });
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
  dit(m.faits.length && m.faits.every((n) => n >= 2) && m.orphelins === 0 && m.ambresHorsLimite === 0, `I ${th} : plusieurs infos par rangée (${Math.min(...m.faits)} à ${Math.max(...m.faits)} faits en 3e ligne), taille sortie du titre, ambre seulement sur une limite`, { faits: m.faits.slice(0, 8), orphelins: m.orphelins, ambres: m.ambresHorsLimite });
  dit(m.bande === 0, `I ${th} : la bande des chiffres d'hier n'est pas à l'écran`, m.bande);
  dit(!m.petits.length, `T ${th} : ${m.nB} boutons, tous ≥ 44 × 44`, m.petits);
  dit(!m.tronques.length, `X ${th} : aucun texte tronqué sans « … »`, m.tronques);
  dit(m.deb <= 1 && !m.hors.length, `X ${th} : rien ne déborde`, { deb: m.deb, hors: m.hors });
  dit(m.nC > 10 && !m.faibles.length, `C ${th} : ${m.nC} textes ≥ 4,5:1 (3:1 grand) — min ${m.minC}`, m.faibles);
  if (ref) {
    dit(m.affiche != null && m.affiche === ref.chiffre, `N ${th} : l'affiche (${m.affiche}) = le grand chiffre d'avant (${ref.chiffre})`, { v2: m.affiche, avant: ref.chiffre });
    dit(String(m.n) === String(ref.chiffre), `N ${th} : ${m.n} rangées « À envoyer » = ce nombre (${ref.chiffre}) — aucun colis caché`, { n: m.n, avant: ref.chiffre });
    dit(m.tete.pleinN != null && m.tete.pleinN === ref.lot, `N ${th} : le plein (${m.tete.pleinN}) = le plein d'avant (${ref.lot})`, { v2: m.tete.pleinN, avant: ref.lot });
  }
  // Les vignettes du haut chargées avant la capture (une capture sans photos ne montre pas l'écran).
  await attendre(pg, () => [...document.querySelectorAll('[data-v2v-liste] img')].slice(0, 6).every((i) => i.complete && i.naturalWidth > 0), 8000);
  await pg.screenshot({ path: path.join(SHOTS, `ventes-${th}.png`) });
  await qualite(pg, th);
  if (ref && ref.palette && tel) {
    const p = await palette(pg), o = ref.palette;
    console.log(`   palette : avant ${o.tailles} tailles · ${o.graisses} graisses · ${o.rayons} rayons · ${o.hors}/${o.espacements} hors grille (${o.part} %) · « Choisir la vente » ×${o.choisir} — ici ${p.tailles} · ${p.graisses} · ${p.rayons} · ${p.hors}/${p.espacements} (${p.part} %) · ×${p.choisir}`);
    dit(p.tailles < o.tailles && p.graisses <= o.graisses && p.rayons < o.rayons && p.part < o.part && p.choisir === 0,
      `Q ${th} : moins de tailles (${p.tailles} < ${o.tailles}), de graisses (${p.graisses} ≤ ${o.graisses}), de rayons (${p.rayons} < ${o.rayons}), d'espacements hors grille (${p.part} % < ${o.part} %) ; « Choisir la vente » jamais redit`, { avant: o, ici: p });
  }
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
      // Un témoin posé AVANT le geste note chaque état vu de la rangée qui part (le mouvement dure ~0,5 s).
      await pg.evaluate((cle) => { window.__fait = { part: false, faite: false, coche: false };
        const voir = () => { const r = document.querySelector(`[data-v2v-ligne="${CSS.escape(cle)}"][data-v2v-fait="part"]`); if (!r) return; window.__fait.part = true;
          const h = r.closest('.v2-faite'); if (h && h.classList.contains('is-faite')) window.__fait.faite = true; if (h && h.querySelector('.v2-faite-coche')) window.__fait.coche = true; };
        new MutationObserver(voir).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-v2v-fait'] }); }, f0.cle);
      await pg.evaluate((cle) => { const b = document.querySelector(`.v2-cache [data-colis-ident="${CSS.escape(cle)}"] button[data-geste="imprime"]`); if (b) b.click(); }, f0.cle);
      await pg.waitForTimeout(300);
      const temoin = await pg.evaluate(() => window.__fait); const vu = temoin.part, enCours = temoin.faite && temoin.coche;
      await pg.screenshot({ path: path.join(SHOTS, `ventes-fait-${th}.png`) });
      await pg.waitForTimeout(1200);
      const f1 = await pg.evaluate((cle) => { const r = [...document.querySelectorAll(`[data-v2v-ligne="${CSS.escape(cle)}"]`)].filter((x) => x.getAttribute('data-v2v-fait') !== 'part');
        const pl = document.querySelector('[data-v2-principal="imprimer"]');
        return { groupe: r[0] ? r[0].getAttribute('data-v2v-groupe') : null, n: r.length, part: !!document.querySelector(`[data-v2v-ligne="${CSS.escape(cle)}"][data-v2v-fait="part"]`), plein: Number(pl && pl.getAttribute('data-impr-lot')), affiche: (document.querySelector('[data-v2v-affiche]') || { getAttribute: () => '' }).getAttribute('data-v2v-affiche') }; }, f0.cle);
      dit(vu && enCours, `F ${th} : la rangée imprimée joue le mouvement « fait » (coche, glisse, se replie)`, temoin);
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
    // SEUL=chargement : le chargement lent et le mouvement réduit seulement (une retouche du banc).
    if (process.env.SEUL === 'chargement') { await chargementEtMouvement(nav, b); throw null; }
    console.log('\n── éteint (l\'écran d\'avant, la référence des nombres)');
    const refC = await avant(nav, b, false);
    sigs.ventes = refC.sig;
    dit(refC.attr == null, 'E éteint : aucun data-design sur <html>', refC.attr);
    dit(refC.chiffre != null && refC.chiffre !== '' && refC.lot != null, `E l'écran d'avant donne ses nombres (affiche ${refC.chiffre}, plein ${refC.lot}, envoyés ${refC.envoyes})`, refC);
    if (SIG_AVANT && fs.existsSync(SIG_AVANT)) {
      // Les éléments de la feuille « À faire » (`data-ui-afaire-item`) arrivent dans l'ordre où leurs écrans les posent (le
      // temps des lectures, pas le code) : comparés comme un ENSEMBLE (blocs triés), tout le reste dans l'ordre.
      const blocs = (l) => { const out = []; let i = 0; while (i < l.length) { const m = /^(\d+):DIV\[data-ui-afaire-item\]$/.exec(l[i]); if (!m) { out.push(l[i]); i++; continue; }
        const d = +m[1]; const g = []; while (i < l.length && /^(\d+):DIV\[data-ui-afaire-item\]$/.test(l[i]) && +RegExp.$1 === d) { const b = [l[i++]]; while (i < l.length && +l[i].split(':')[0] > d) b.push(l[i++]); g.push(b.join('\n')); }
        out.push(...g.sort().join('\n').split('\n')); } return out; };
      const a = blocs((JSON.parse(fs.readFileSync(SIG_AVANT, 'utf8')).ventes || []).map((x) => x.replace(/,data-vu(?=[,\]])|\[data-vu\]|(?<=\[)data-vu,/g, '')));
      const c = blocs((refC.sig || []).map((x) => x.replace(/,data-vu(?=[,\]])|\[data-vu\]|(?<=\[)data-vu,/g, '')));
      let i = 0; while (i < a.length && i < c.length && a[i] === c[i]) i++;
      dit(a.length > 20 && a.length === c.length && i === a.length, `E éteint : Ventes a le DOM de la base (${c.length} nœuds)`, i < Math.max(a.length, c.length) ? { n: [a.length, c.length], ecart: i, base: a[i], ici: c[i] } : undefined);
    } else console.log('  (pas de SIGNATURE_AVANT : la comparaison au DOM de la base n\'est pas jouée)');
    await allume(nav, b, false, 390, refC);
    // RAPIDE=1 (les mutations) : le téléphone clair seulement.
    if (!process.env.RAPIDE) {
      await allume(nav, b, true, 390, refC);
      await allume(nav, b, false, 1512, refC);
      await chargementEtMouvement(nav, b);
      await etroit(nav, b, false);
      await etroit(nav, b, true);
    }
  } catch (e) { if (e !== null) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1500)); } }
  if (!process.env.SEUL) fs.writeFileSync(path.join(SHOTS, 'signature-eteint.json'), JSON.stringify(sigs));
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} design-v2-ventes : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
