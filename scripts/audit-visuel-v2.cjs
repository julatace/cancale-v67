#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  L'AUDIT VISUEL PERMANENT DU NOUVEAU DESIGN (18 nov.) — `node scripts/audit-visuel-v2.cjs`
//
//  Un BANC : il rend l'app (build `dist/`, ou `BANC_DIST=…`) sur la base INVENTÉE des bancs
//  (`scripts/bancs/design-passe.cjs` : 3 comptes, ventes, colis, achats, vignettes SVG ; garde réseau),
//  le design v2 allumé, et MESURE ce que Julien reproche à ses captures (« trop compact », « bricolé »,
//  « tout bouge ») — les 19 règles de l'audit visuel du 17 nov. (récit : docs/passation/2026-11-18-design-v2-suite.md).
//
//  Formats : 390 tactile clair (c390) · 390 tactile sombre (s390) · 375 × 667 en « Très grand » (x375,
//  `vrm_taille_texte`) · 1512 clair (d1512). Écrans JUGÉS : Aujourd'hui, Annonces, Achats, la fiche d'une
//  paire (feuille) ; la coque et la barre du bas sur chacun. Ventes, Argent, Stock, Messages, Paramètres :
//  RAPPORTÉS (leurs lots les refont), jamais rouges ici.
//
//   1  liste d'abord : 1re rangée utile à y ≤ 300 (390), ≤ 0,75 × la hauteur (375 grand) ; ≤ 4 bandes avant
//   2  un seul plein visible et non recouvert (coque comprise) ; aucun plein dans une rangée de liste
//   3  le plein dit son nombre en entier (libellé et nombre jamais tronqués)
//   4  aucun mot coupé (deux rectangles de ligne pour un mot)
//   5  aucun texte rogné sans « … » ; aucun « … » dans un h1 ni dans un plein
//   6  cibles ≥ 44 × 44 au doigt
//   7  composant unique : les boutons hors composant ne font que BAISSER (cliquet par écran)
//   8  échelle fermée dans .v2-* : tailles 11·13·15·17·20·28·34·56 (× l'échelle du texte), graisses
//      400·600·700, rayons 8·12·14·16·20·pilule, espacements multiples de 4 (cliquet par écran)
//   9  rangées régulières : contrôles d'une rangée ± 2 px, rangées d'une liste v2 ± 1 px
//  10  contraste mesuré sur les PIXELS rendus (≥ 4,5:1 ; 3:1 grand texte), clair et sombre
//  11  aucun nombre écrit deux fois dans deux contextes sur le premier écran
//  12  rien de répété sur ≥ 80 % des rangées d'une liste
//  13  ambre = un geste (dans [data-a-faire] ou [data-geste]), ≤ 1 par rangée, ≤ 3 par écran ; rouge réservé aux doublons
//  14  la pile du bas ne se chevauche pas ; la dernière rangée défile au-dessus du plein
//  15  rien ne se pose sur le titre (0 à 3 s après l'arrivée)
//  16  états vide / erreur / chargement : une phrase qui dit quoi faire, un geste, jamais « — » en affiche,
//      aucun plein posé sur un texte
//  17  traits des icônes : au plus 2 épaisseurs rendues par écran
//  18  anti-générique : aucun reste de code rendu (« ))} », « undefined »), aucun emoji, verre seulement sur la coque, aucun dégradé dans .v2-*, aucune ombre de rangée
//  19  preuve : rouge sur le build d'avant (`BANC_DIST=<dist de main>`) et par mutation (`MUTATION=titre|pile|bouton`)
//  +   CLS : changer d'onglet ne fait rien sauter (somme des décalages ≤ 0,02) ;
//  +   fluidité : Annonces à ~1 000 annonces en ligne montées, processeur ralenti × 4 : 95e centile du temps d'image < 50 ms
//      (RAPPORTÉ : rendu logiciel des bancs ; jugé avec FLUIDITE_JUGEE=1).
//
//  `SHOTS=dossier` garde les captures ANNOTÉES (les défauts encadrés) : regarde-les. `FORMATS=c390,d1512`,
//  `ECRANS=annonces` pour un sous-ensemble ; `CLIQUET_ECRIRE=1` réécrit scripts/bancs/_cliquets-visuel.json
//  (seulement pour BAISSER un cliquet, jamais pour faire passer un rouge). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const RACINE = path.join(__dirname, '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log(`audit-visuel-v2 : pas de build (${DIST}/index.html) — lance « npm run build » d'abord.`); process.exit(1); }
process.env.BANC_DIST = DIST;
require('./bancs/_porte-banc.cjs');
const P = require('./bancs/design-passe.cjs');
const { fabriquer } = require('./bancs/_base-volume.cjs');
const MESURE = fs.readFileSync(path.join(__dirname, 'bancs', '_mesure-visuel-v2.js'), 'utf8');
const CLIQUETS_F = path.join(__dirname, 'bancs', '_cliquets-visuel.json');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'audit-visuel-v2');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const FORMATS_VOULUS = liste('FORMATS', 'c390,s390,x375,d1512');
const ECRANS_VOULUS = liste('ECRANS', '');
const MUTATION = process.env.MUTATION || '';
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';

let ok = 0, ko = 0; const rouges = [];
const ecrire = (s) => { try { fs.writeSync(1, s + '\n'); } catch (_) { console.log(s); } };
const court = (d) => (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 360);
function dit(c, m, d) { if (c) { ok++; ecrire('  ✅ ' + m); } else { ko++; rouges.push(m); ecrire('  ❌ ' + m + (d !== undefined ? ' — ' + court(d) : '')); } return c; }
const rapporte = (m, d) => ecrire('  ·  ' + m + (d !== undefined ? ' — ' + court(d) : ''));

const FORMATS = {
  c390: { W: 390, H: 844, sombre: false, dsf: 2, tactile: true },
  s390: { W: 390, H: 844, sombre: true, dsf: 2, tactile: true },
  x375: { W: 375, H: 667, sombre: false, dsf: 2, tactile: true, texte: 'tresGrand' },
  d1512: { W: 1512, H: 950, sombre: false, dsf: 1, tactile: false },
};
const PREMIER = {
  aujourdhui: ['.v2-bande-carte', '.v2-afaire-ligne', '.v2-passe-mini', '.v2-paslu', '[data-v2-rien]'],
  annonces: ['[data-v2l]', '.v2-squelette-rangee'],
  achats: ['.v2-achats-verifier', '.v2-passe', '.v2-ligne', '[data-v2-rien]'],
};
// [id, url, jugé ?, geste]
const ECRANS = [
  ['aujourdhui', '/?tab=journee', true], ['annonces', '/?tab=annonces', true], ['achats', '/?tab=achats', true], ['feuille', '/?tab=annonces', true, 'feuille'],
  ['ventes', '/?tab=ventes', false], ['stock', '/?tab=garage', false], ['argent', '/?tab=argent', false], ['messages', '/?tab=messages', false], ['parametres', '/?tab=settings', false],
].filter((e) => !ECRANS_VOULUS.length || ECRANS_VOULUS.includes(e[0]));

const cliquets = fs.existsSync(CLIQUETS_F) ? JSON.parse(fs.readFileSync(CLIQUETS_F, 'utf8')) : {};
const cliquetsNeufs = JSON.parse(JSON.stringify(cliquets));

// Les MUTATIONS de la règle 19 : réaffaiblir ce que l'audit garde ⇒ il doit rougir.
const MUTATIONS = {
  titre: `.v2-titre-ligne{flex-wrap:nowrap!important}.v2-titre-ligne h1,.v2-titre,h1.v2-titre{overflow-wrap:anywhere!important;word-break:break-all!important;flex:0 1 auto!important;min-width:0!important}`,
  pile: `@layer vrm-v2{html body .v2-pouce.v2-pouce.v2-pouce{bottom:calc(var(--vrm-barre-bas,84px) - 40px)!important}} html body .v2-pouce.v2-pouce.v2-pouce{bottom:calc(var(--vrm-barre-bas,84px) - 40px)!important}`,
  bouton: null,
};
async function preparer(pg, f, regle) {
  await pg.addInitScript(([texte, mut, css]) => {
    try { localStorage.setItem('vrm_design_v2', '1'); if (texte) localStorage.setItem('vrm_taille_texte', texte); } catch (_) {}
    document.addEventListener('DOMContentLoaded', () => {
      if (css) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }
      if (mut === 'bouton') new MutationObserver(() => { for (const l of document.querySelectorAll('.v2-afaire-ligne:not([data-mut])')) { l.setAttribute('data-mut', '1'); const b = document.createElement('button'); b.type = 'button'; b.className = 'v2b v2b-secondaire'; b.setAttribute('data-v2b', 'secondaire'); b.textContent = 'Voir'; (l.querySelector('.v2-afaire-txt') || l).after(b); } }).observe(document.documentElement, { childList: true, subtree: true });
    });
  }, [f.texte || '', MUTATION, MUTATIONS[MUTATION] || '']);
  if (regle) await regle(pg);
}
async function ouvrirEcran(nav, b, f, url, regle) {
  const o = await P.ouvrir(nav, { W: f.W, sombre: f.sombre, b, url, dsf: f.dsf });
  if (f.W !== 390 && f.W !== 1512) await o.pg.setViewportSize({ width: f.W, height: f.H });
  await preparer(o.pg, f, regle);
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  return o;
}
async function pret(pg, ms = 4500) {
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await pg.waitForFunction(() => !document.querySelector('[data-v2-ecran="aujourdhui"]') || !!document.querySelector('[data-v2-affiche]:not([data-v2-affiche=""]), [data-v2-paslu], [data-v2-rien]'), null, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(ms);
}
async function geste(pg, id, f) {
  if (id !== 'feuille') return true;
  // Le message passager « N nouvelles paires numérotées » (artefact du banc : la numérotation se refait à chaque contexte) est fermé, comme il le ferait.
  await pg.evaluate(() => { for (const x of document.querySelectorAll('.vrm-acc-apres [data-acc-fermer], .vrm-toast')) x.click(); }).catch(() => {}); await pg.waitForTimeout(500);
  const l = pg.locator('[data-v2l]:visible').first(); await l.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
  const bx = await l.boundingBox({ timeout: 4000 }).catch(() => null); if (!bx) return false;
  if (f.tactile) await pg.touchscreen.tap(bx.x + Math.min(160, bx.width / 2), bx.y + Math.min(40, bx.height / 2)).catch(() => {}); else await pg.mouse.click(bx.x + Math.min(160, bx.width / 2), bx.y + Math.min(40, bx.height / 2)).catch(() => {});
  await pg.waitForTimeout(1800);
  return pg.evaluate(() => [...document.querySelectorAll('[role="dialog"], .v2-feuille, [data-fiche-paire], .fd-feuille, .vrm-fs')].some((e) => e.getClientRects().length));
}

// ── 10. Le contraste sur les PIXELS : la capture décodée dans une page vierge (canvas), fond dominant / encre la plus contrastée. ──
async function contrastePixels(decodeur, png, textes, dsf) {
  return decodeur.evaluate(async ([b64, textes, dsf]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const out = [];
    for (const t of textes) {
      const X = Math.max(0, Math.floor(t.rect.x * dsf)), Y = Math.max(0, Math.floor(t.rect.y * dsf)), Wd = Math.min(img.width - X, Math.ceil(t.rect.w * dsf)), Hd = Math.min(img.height - Y, Math.ceil(t.rect.h * dsf));
      if (Wd < 3 || Hd < 3) continue;
      const d = x.getImageData(X, Y, Wd, Hd).data; const hist = new Map(); let n = 0;
      for (let i = 0; i < d.length; i += 4) { const k = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3); hist.set(k, (hist.get(k) || 0) + 1); n++; }
      // Le FOND : la couleur dominante du BORD du rectangle (un grand texte gras couvre plus de la moitié de sa boîte).
      const bord = new Map(); let nb = 0; const px = (i) => (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3);
      for (let xx = 0; xx < Wd; xx++) for (const yy of [0, Hd - 1]) { const k = px((yy * Wd + xx) * 4); bord.set(k, (bord.get(k) || 0) + 1); nb++; }
      for (let yy = 0; yy < Hd; yy++) for (const xx of [0, Wd - 1]) { const k = px((yy * Wd + xx) * 4); bord.set(k, (bord.get(k) || 0) + 1); nb++; }
      let best = 0, kb = 0; for (const [k, v] of bord) if (v > best) { best = v; kb = k; }
      if (best / nb < 0.35) continue;   // fond non uni (photo, dégradé fort) : pas jugé
      const br = ((kb >> 10) & 31) * 8 + 4, bg = ((kb >> 5) & 31) * 8 + 4, bb = (kb & 31) * 8 + 4; const lb = lum(br, bg, bb);
      let mx = 1;
      for (let i = 0; i < d.length; i += 4) { const l = lum(d[i], d[i + 1], d[i + 2]); const r = (Math.max(l, lb) + 0.05) / (Math.min(l, lb) + 0.05); if (r > mx) mx = r; }
      out.push({ t: t.t, r: Math.round(mx * 100) / 100, min: t.grand ? 3 : 4.5 });
    }
    return out;
  }, [png.toString('base64'), textes, dsf]);
}

// La capture ANNOTÉE : chaque défaut encadré, sa lettre de règle (le banc rapporte, on regarde).
async function capturer(pg, nom, defauts) {
  await pg.evaluate((defs) => { const h = document.createElement('div'); h.id = 'audit-v2-annot'; h.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    for (const d of defs) { const b = document.createElement('div'); b.style.cssText = `position:absolute;left:${d.rect.x - 2}px;top:${d.rect.y - 2}px;width:${d.rect.w + 4}px;height:${d.rect.h + 4}px;border:2px solid #E0002A;border-radius:4px`; const l = document.createElement('span'); l.textContent = d.r; l.style.cssText = 'position:absolute;left:-2px;top:-16px;background:#E0002A;color:#fff;font:700 11px system-ui;padding:0 3px;border-radius:3px'; b.appendChild(l); h.appendChild(b); }
    document.body.appendChild(h); }, defauts.filter((d) => d.rect).slice(0, 40)).catch(() => {});
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});
  await pg.evaluate(() => { const h = document.getElementById('audit-v2-annot'); if (h) h.remove(); }).catch(() => {});
}

function base() { return P.base(); }
function baseVide() { const v = P.base(); v.rows = v.rows.filter((r) => /_profile$|^ext_appareil/.test(r.id)); return v; }
// 1 000 annonces en ligne (la base du banc design-v2-annonces : `_base-volume` `annonces: 2500`, 40 % en ligne), les N° à leur forme réelle.
function baseMille() {
  const b = P.base(); const q = fabriquer({ comptes: 3, annonces: 2500 });
  const listings = q.rows.filter((r) => /_listings$/.test(r.id));
  b.rows = b.rows.filter((r) => !/_listings$/.test(r.id)).concat(listings);
  b.main[0].data.vinted_annonce_numeros = Object.fromEntries(Object.entries(q.main[0].data.vinted_annonce_numeros).map(([k, v]) => [k, { ...v, numero: v.numero || v.num }]));
  b.main[0].data.vinted_used_nums = q.main[0].data.vinted_used_nums;
  return b;
}

async function jugerEcran(nav, decodeur, b, fk, f, id, url, juge, g) {
  const nom = `${id}-${fk}`; ecrire(`\n── ${nom}${juge ? '' : ' (rapporté)'}`);
  let o; try { o = await ouvrirEcran(nav, b, f, url); } catch (e) { return dit(!juge, `${nom} : l'écran s'ouvre`, e.message); }
  const { ctx, pg, erreurs } = o;
  try {
    await pret(pg);
    // 15. Rien sur le titre, 0 à 3 s après l'arrivée (la fraîcheur, un toast, une pastille ne se posent jamais dessus).
    const surTitre = new Set();
    if (id !== 'feuille') for (let k = 0; k < 4; k++) { const r = await pg.evaluate(`(${MESURE})(${JSON.stringify({ tactile: f.tactile, premier: [] })})`).catch(() => null); if (r) for (const x of r.surTitre) surTitre.add(x); if (k < 3) await pg.waitForTimeout(1000); }
    const okGeste = await geste(pg, id, f);
    // L'échelle du texte telle que la lit getComputedStyle (le réglage « Très grand » passe par un zoom de l'app) : une sonde de 100 px.
    const echelle = await pg.evaluate(() => { const m = document.querySelector('.v2-ecran, .vrm-main') || document.body; const s = document.createElement('span'); s.style.cssText = 'font-size:100px;position:absolute;visibility:hidden'; s.className = 'v2-sonde'; m.appendChild(s); const v = parseFloat(getComputedStyle(s).fontSize) / 100; s.remove(); return v > 0 ? v : 1; });
    const m = await pg.evaluate(`(${MESURE})(${JSON.stringify({ tactile: f.tactile, premier: PREMIER[id] || [], echelle: Number.isFinite(echelle) ? echelle : 1 })})`);
    const png = await pg.screenshot();
    const pix = m.textes.length ? await contrastePixels(decodeur, png, m.textes, f.dsf) : [];
    const faibles = pix.filter((x) => x.r < x.min);
    const D = []; const J = juge ? dit : (c, msg, d) => { if (!c) rapporte(msg, d); return c; };
    const tel = f.W < 600;
    if (id === 'feuille') J(okGeste, `${nom} · la fiche s'ouvre en touchant la 1re annonce`);
    if (tel && id !== 'feuille' && PREMIER[id]) {
      const lim = fk === 'x375' ? Math.round(0.75 * f.H) : 300;
      J(!!m.premiere && m.premiere.y <= lim, `1 ${nom} · 1re rangée utile à y ≤ ${lim} (${m.premiere ? m.premiere.y + ' : ' + m.premiere.t : 'aucune'})`, m.premiere);
      J(m.bandes.length <= 4, `1 ${nom} · au plus 4 bandes avant elle (${m.bandes.length})`, m.bandes);
    }
    J(m.pleins.length <= 1 && !m.pleins.some((p) => p.rangee), `2 ${nom} · un seul plein visible, aucun dans une rangée (${m.pleins.length})`, m.pleins.map((p) => p.t)); m.pleins.slice(1).forEach((p) => D.push({ r: 'P', rect: p.rect }));
    J(!m.pleinsCoupes.length, `3 ${nom} · le plein dit son nombre en entier`, m.pleinsCoupes);
    J(!m.mots.length, `4 ${nom} · aucun mot coupé (${m.mots.length})`, m.mots.map((x) => x.mot)); m.mots.forEach((x) => D.push({ r: 'M', rect: x.rect }));
    J(!m.rognes.length && !m.suspensionsInterdites.length, `5 ${nom} · aucun texte rogné, aucun « … » dans un titre ou un plein`, { rognes: m.rognes.map((x) => x.t + ' [' + x.cls + ']'), titre: m.suspensionsInterdites.map((x) => x.t) }); [...m.rognes, ...m.suspensionsInterdites].forEach((x) => D.push({ r: 'T', rect: x.rect }));
    if (f.tactile) { J(!m.petits.length, `6 ${nom} · cibles ≥ 44 × 44 (${m.petits.length} trop petites)`, m.petits.map((x) => `${x.t || x.cls}:${x.w}x${x.h}`)); m.petits.forEach((x) => D.push({ r: 'C', rect: x.rect })); }
    // 7 et 8 : cliquets (ne font que baisser).
    const cle = `${id}-${fk}`; const c0 = cliquets[cle] || {}; const n7 = m.horsComposant.length, n8 = m.nHorsEchelle;
    cliquetsNeufs[cle] = { horsComposant: Math.min(n7, c0.horsComposant != null ? c0.horsComposant : n7), horsEchelle: Math.min(n8, c0.horsEchelle != null ? c0.horsEchelle : n8) };
    J(c0.horsComposant == null || n7 <= c0.horsComposant, `7 ${nom} · boutons hors composant : ${n7} (cliquet ${c0.horsComposant != null ? c0.horsComposant : 'neuf'})`, [...new Set(m.horsComposant)]);
    J(c0.horsEchelle == null || n8 <= c0.horsEchelle, `8 ${nom} · valeurs hors échelle dans .v2-* : ${n8} (cliquet ${c0.horsEchelle != null ? c0.horsEchelle : 'neuf'})`, m.horsEchelle);
    J(!m.hauteurs.length && !m.listesInegales.length, `9 ${nom} · rangées régulières (contrôles ± 2 px, listes ± 1 px)`, { controles: m.hauteurs.slice(0, 4), listes: m.listesInegales });
    J(pix.length > 0 && !faibles.length, `10 ${nom} · ${pix.length} textes jugés sur les pixels, tous ≥ 4,5:1 (3:1 grands)`, faibles.slice(0, 6));
    J(!m.doubles.length, `11 ${nom} · aucun nombre écrit deux fois (premier écran)`, m.doubles);
    J(!m.repetes.length, `12 ${nom} · rien de répété sur chaque rangée`, m.repetes);
    const amb = m.ambres.filter((a) => !a.geste);
    J(!amb.length && m.ambres.length <= 3 && m.ambreRangeeMax <= 1 && !m.rouges.length, `13 ${nom} · ambre = geste (${m.ambres.length} à l'écran, ${amb.length} sans geste), rouge réservé`, { sansGeste: amb.map((a) => a.t), rouges: m.rouges.map((r) => r.t), parRangee: m.ambreRangeeMax }); amb.forEach((a) => D.push({ r: 'A', rect: a.rect }));
    J(!m.pileChevauche.length, `14 ${nom} · la pile du bas ne se chevauche pas`, m.pileChevauche);
    if (id !== 'feuille') J(![...surTitre].length, `15 ${nom} · rien ne se pose sur le titre (0–3 s)`, [...surTitre]);
    const nTraits = Object.keys(m.traits).length;
    J(nTraits <= 2, `17 ${nom} · traits d'icône : ${nTraits} épaisseurs (${Object.keys(m.traits).join(' · ')})`, m.traitsOu);
    J(!m.ia.restesCode.length && !m.ia.emoji.length && !m.ia.verreHors.length && !m.ia.degV2.length && !m.ia.ombreRangee, `18 ${nom} · aucun reste de code à l'écran, aucun emoji, verre seulement sur la coque, aucun dégradé dans .v2-*, aucune ombre de rangée`, m.ia);
    J(m.debord <= 1, `${nom} · rien ne déborde de l'écran (${m.debord})`);
    J(!erreurs.length, `${nom} · aucune erreur de page`, erreurs);
    await capturer(pg, nom, D);   // la capture annotée, l'écran en haut (avant le défilement de la règle 14)
    // 14 (suite) : la dernière rangée défile au-dessus du plein au pouce.
    if (tel && m.pouceHaut != null && id !== 'feuille') {
      const bas = await pg.evaluate(() => { const sc = [document.querySelector('.vrm-main'), document.scrollingElement].find((e) => e && e.scrollHeight > e.clientHeight + 10); if (sc) sc.scrollTop = sc.scrollHeight; return new Promise((r) => setTimeout(() => { const l = [...document.querySelectorAll('.v2-ecran [data-v2-bloc]:not(.v2-pouce), .v2-ecran .v2-afaire-ligne, .v2-ecran .v2-bande-carte')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().bottom); r(l.length ? Math.round(Math.max(...l)) : null); }, 500)); });
      J(bas == null || bas <= m.pouceHaut + 1, `14 ${nom} · défilé jusqu'en bas, le contenu finit au-dessus du plein (${bas} ≤ ${m.pouceHaut})`);
    }
  } catch (e) { dit(!juge, `${nom} : mesuré`, e.message.slice(0, 200)); }
  await ctx.close();
}

async function jugerEtats(nav, f) {
  const vide = baseVide(), b = base();
  for (const [id, url] of [['aujourdhui', '/?tab=journee'], ['annonces', '/?tab=annonces'], ['achats', '/?tab=achats']].filter((e) => !ECRANS_VOULUS.length || ECRANS_VOULUS.includes(e[0]))) {
    for (const etat of ['vide', 'erreur', 'chargement']) {
      const nom = `${id}-etat-${etat}`; ecrire(`\n── ${nom}`);
      let o; try {
        o = await ouvrirEcran(nav, etat === 'vide' ? vide : b, f, url, async (pg) => {
          if (etat === 'erreur') { const ko = (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"panne"}' }); await pg.route('**/rest/v1/**', ko); await pg.context().route(/\/rest\/v1\//, ko); }
          if (etat === 'chargement') { const lent = async (r) => { await new Promise((ok) => setTimeout(ok, 25000)); return r.fallback().catch(() => {}); }; await pg.route('**/rest/v1/**', lent); }
        });
      } catch (e) { dit(false, `${nom} : s'ouvre`, e.message); continue; }
      const { ctx, pg } = o;
      try {
        if (etat === 'chargement') { await pg.waitForSelector('.vrm-main', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(1500); } else await pret(pg, 4000);
        const r = await pg.evaluate(() => {
          const main = document.querySelector('.vrm-main') || document.body; const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
          const t = main.innerText.replace(/\s+/g, ' ').trim();
          const gestes = [...main.querySelectorAll('button, a[href], [role="button"]')].filter(vis).filter((e) => { const q = e.getBoundingClientRect(); return q.top < innerHeight && q.bottom > 0; }).length;
          const tiret = [...main.querySelectorAll('*')].filter(vis).some((e) => /^[—–-]$/.test((e.textContent || '').trim()) && parseFloat(getComputedStyle(e).fontSize) >= 34);
          const plein = [...document.querySelectorAll('.v2-pouce')].filter(vis).map((e) => e.getBoundingClientRect())[0];
          const sous = plein ? [...main.querySelectorAll('p, span, h2, h3')].filter(vis).filter((e) => !e.closest('.v2-pouce') && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).filter((e) => { const q = e.getBoundingClientRect(); return q.bottom > plein.top + 2 && q.top < plein.bottom - 2 && q.right > plein.left && q.left < plein.right; }).map((e) => e.textContent.trim().slice(0, 30)) : [];
          const squelette = main.querySelectorAll('[class*="squelette"], [class*="skeleton"], [aria-busy="true"], [data-v2-attente]').length;
          const quoiFaire = /ouvr|réessa|reessa|relis|install|connect|ajout|publie|lis |va sur|touche|vérifie|vinted/i.test(t);
          return { long: t.length, debut: t.slice(0, 160), gestes, tiret, sous, squelette, quoiFaire };
        });
        if (etat === 'chargement') dit((r.squelette > 0 || r.long >= 20) && !r.tiret && !r.sous.length, `16 ${nom} · une forme d'attente (squelette ou phrase), jamais « — » en affiche, aucun plein sur un texte`, r);
        else dit(r.long >= 20 && r.quoiFaire && r.gestes >= 1 && !r.tiret && !r.sous.length, `16 ${nom} · une phrase qui dit quoi faire, un geste, jamais « — » en affiche, aucun plein sur un texte`, r);
        await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});
      } catch (e) { dit(false, `${nom} : mesuré`, e.message.slice(0, 160)); }
      await ctx.close();
    }
  }
}

// CLS : de Aujourd'hui à Annonces, Achats, puis retour — la somme des décalages mesurée sur 3 s après chaque toucher.
async function jugerCLS(nav, f) {
  ecrire('\n── CLS · changement d’onglet (390)');
  const o = await ouvrirEcran(nav, base(), f, '/?tab=journee'); const { ctx, pg } = o;
  try {
    await pret(pg, 3000);
    await pg.evaluate(() => { window.__cls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__cls.push({ v: e.value, t: e.startTime, src: (e.sources || []).map((s) => s.node ? String(s.node.className || s.node.nodeName).slice(0, 30) : '?').slice(0, 3) }); }).observe({ type: 'layout-shift', buffered: false }); });
    for (const cible of ['annonces', 'achats', 'journee']) {
      const avant = await pg.evaluate(() => window.__cls.length);
      const t = pg.locator(`.vrm-tabbar [data-tab="${cible}"], .vrm-tabbar [data-onglet="${cible}"], .vrm-tabbar a[href*="tab=${cible}"]`).first();
      const okT = await t.count().then((n) => n > 0).catch(() => false);
      if (okT) await t.tap({ timeout: 4000 }).catch(() => {}); else await pg.evaluate((c) => { const b = [...document.querySelectorAll('.vrm-tabbar button, .vrm-tabbar a')].find((x) => (x.getAttribute('data-tab') || x.getAttribute('aria-label') || x.textContent || '').toLowerCase().includes(c === 'journee' ? 'aujourd' : c)); if (b) b.click(); }, cible);
      await pg.waitForTimeout(3000);
      const ent = await pg.evaluate((a) => window.__cls.slice(a), avant);
      const s = Math.round(ent.reduce((x, e) => x + e.v, 0) * 1000) / 1000;
      dit(s <= 0.02, `CLS · vers ${cible} : ${s} (≤ 0,02)`, ent.slice(0, 4));
    }
  } catch (e) { dit(false, 'CLS : mesuré', e.message.slice(0, 160)); }
  await ctx.close();
}

// FLUIDITÉ : Annonces à 1 000 annonces en ligne, processeur × 4, défilement continu 4 s.
async function jugerDefilement(nav, f) {
  ecrire('\n── Fluidité · Annonces, 1 000 annonces en ligne, processeur × 4');
  const o = await ouvrirEcran(nav, baseMille(), { ...f, dsf: 1 }, '/?tab=annonces'); const { ctx, pg } = o;
  try {
    await pg.waitForSelector('[data-v2l]', { timeout: 60000 }).catch(() => {}); await pg.waitForTimeout(4000);
    // La liste se rend par paquets (SuitePaquets, 72 de plus à l'approche du bas) : on demande la suite jusqu'à ~1 000 rangées montées,
    // puis on attend que l'app se taise (aucune longue image pendant 3 s) avant de mesurer le DÉFILEMENT seul.
    let n = 0;
    for (let k = 0; k < 30; k++) {
      n = await pg.evaluate(() => document.querySelectorAll('[data-v2l]').length); if (n >= 1000) break;
      const plus = await pg.evaluate(() => { const b = document.querySelector('.vrm-suite-paquets button'); if (!b) return false; b.click(); return true; }); if (!plus) break;
      await pg.waitForFunction((m) => document.querySelectorAll('[data-v2l]').length > m, n, { timeout: 60000 }).catch(() => {});
    }
    await pg.evaluate(() => { window.__loaf = 0; try { new PerformanceObserver((l) => { window.__loaf += l.getEntries().length; }).observe({ type: 'long-animation-frame' }); } catch (_) {} });
    for (let k = 0; k < 20; k++) { await pg.waitForTimeout(3000); const x = await pg.evaluate(() => { const v = window.__loaf; window.__loaf = 0; return v; }); if (!x && k) break; }
    const enLigne = await pg.evaluate(() => [...document.querySelectorAll('.v2-ann-groupe-n')].reduce((t, e) => t + (parseInt(e.textContent.replace(/\D/g, ''), 10) || 0), 0));
    const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const r = await pg.evaluate(() => new Promise((ok) => {
      const sc = [document.querySelector('.vrm-main'), document.scrollingElement].find((e) => e && e.scrollHeight > e.clientHeight + 100) || document.scrollingElement;
      const fin = performance.now() + 4000; const dt = []; let der = null;
      const pas = (t) => { if (der != null) dt.push(t - der); der = t; sc.scrollTop += 60; if (t < fin && sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2) requestAnimationFrame(pas); else { dt.sort((a, b) => a - b); ok({ n: dt.length, p95: Math.round(dt[Math.floor(dt.length * 0.95)] || 0), med: Math.round(dt[Math.floor(dt.length / 2)] || 0), h: sc.scrollHeight }); } };
      requestAnimationFrame(pas); }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    dit(n >= Math.min(1000, enLigne) && enLigne >= 900, `Fluidité · ${n} rangées montées sur ${enLigne} annonces en ligne`);
    // Le temps d'image dépend AUSSI de la machine (rendu logiciel, processeurs partagés) : jugé quand elle est calme, rapporté sinon.
    const charge = os.loadavg()[0], coeurs = os.cpus().length || 1;
    const msg = `Fluidité · 95e centile du temps d’image ${r.p95} ms (< 50), médiane ${r.med} ms, ${r.n} images (charge ${charge.toFixed(1)} / ${coeurs} cœurs)`;
    // Rendu LOGICIEL (swiftshader) sur des processeurs partagés : le temps d'image mesure la machine autant que l'app
    // (18 nov. : 83 à 333 ms de p95 selon la charge, les longues images sans aucun script). Rapporté ; jugé avec
    // FLUIDITE_JUGEE=1 sur une machine calme avec un vrai GPU.
    if (process.env.FLUIDITE_JUGEE === '1') dit(r.n >= 20 && r.p95 < 50, msg, r); else rapporte(msg + ' — rapporté (rendu logiciel), jugé avec FLUIDITE_JUGEE=1');
  } catch (e) { dit(false, 'Fluidité : mesurée', e.message.slice(0, 160)); }
  await ctx.close();
}

(async () => {
  const t0 = Date.now();
  ecrire(`audit-visuel-v2 · build ${DIST}${MUTATION ? ' · MUTATION=' + MUTATION : ''}`);
  await new Promise((ok) => P.srv.listen(P.PORT, ok));
  const nav = await P.chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const dctx = await nav.newContext(); const decodeur = await dctx.newPage(); await decodeur.setContent('<!doctype html><title>d</title>');
  const b = base();
  for (const fk of FORMATS_VOULUS) { const f = FORMATS[fk]; if (!f) continue;
    for (const [id, url, juge, g] of ECRANS) { if (!juge && fk !== 'c390') continue; await jugerEcran(nav, decodeur, b, fk, f, id, url, juge, g); } }
  if (!process.env.SANS_ETATS && FORMATS_VOULUS.includes('c390')) await jugerEtats(nav, FORMATS.c390);
  if (!process.env.SANS_CLS && FORMATS_VOULUS.includes('c390') && !ECRANS_VOULUS.length) await jugerCLS(nav, FORMATS.c390);
  if (!process.env.SANS_FLUIDITE && FORMATS_VOULUS.includes('c390') && (!ECRANS_VOULUS.length || ECRANS_VOULUS.includes('annonces'))) await jugerDefilement(nav, FORMATS.c390);
  await nav.close();
  if (process.env.CLIQUET_ECRIRE === '1' && !MUTATION) { fs.writeFileSync(CLIQUETS_F, JSON.stringify(Object.fromEntries(Object.entries(cliquetsNeufs).sort()), null, 1) + '\n'); ecrire('cliquets écrits : ' + CLIQUETS_F); }
  ecrire(`\naudit-visuel-v2 : ${ok} ✅ · ${ko} ❌ · ${Math.round((Date.now() - t0) / 1000)} s · captures annotées : ${SHOTS}`);
  if (ko) ecrire('Rouges :\n' + rouges.map((r) => '  - ' + r).join('\n'));
  process.exit(ko ? 1 : 0);
})().catch((e) => { ecrire('audit-visuel-v2 : ' + (e && e.stack || e)); process.exit(1); });
