// ════════════════════════════════════════════════════════════════════════════
//  BANC — « TOUT LE SITE SIMPLE ET MINIMALISTE COMME PARAMÈTRES » (20 nov., NATIF.md §1 bis).
//
//  Julien, 20 nov. : « en gros tout le site doit être comme la fiche Paramètres, simple et minimaliste ».
//
//  Sur l'app RENDUE (le vrai `dist/`, base INVENTÉE de volume — `ecrans-verre-2.baseFiches()` — ou base VIDE, garde
//  réseau : rien ne sort), il ouvre chaque écran du §1 bis et relève, DANS l'écran (la coque native n'est pas comptée) :
//    · C1 cartes décorées : une boîte ≥ 120 × 40 avec ombre, dégradé, bordure sur ses quatre côtés, ou fond TEINTÉ
//      (ni blanc, ni gris, ni noir : un fond coloré) — un groupe blanc ou gris uni sans ombre n'en est pas une ;
//      seule la boîte la plus haute est comptée (une carte dans une carte = une carte) ;
//    · C2 ombres : toute ombre portée (box-shadow non incrustée, flou > 0) ou ombre de texte, visible ;
//    · C3 liens soulignés : un texte souligné (hors champ de saisie) ;
//    · C4 textes gris de plus de deux lignes : un texte en gris (encre secondaire : neutre, contraste < 9:1) haut de plus
//      de 2,4 lignes — une explication permanente ;
//    · C5 pleins : un bouton plein (data-n-variante=plein, .sb-btn-plein, ou fond d'accent saturé ≥ 120 px de large
//      avec un texte blanc) ; plus d'un est un défaut ;
//    · C6 boutons gris pleine largeur : un bouton (pas une rangée de liste) au fond NEUTRE différent de son conteneur,
//      large de plus de 80 % de son conteneur et de 240 px ;
//    · K contraste < 4,5:1 (fond effectif, fonds empilés) · T cibles < 44 au doigt (32 à la souris) · X débordement
//      horizontal de la page ou texte coupé à l'ellipse dans un bouton.
//  Fenêtres : `390` (390 × 844 tactile), `safari` (390 × 664 tactile : la place laissée par les barres de Safari),
//  `1512`, `1280`. Thèmes clair / sombre. Bases `volume` / `vide`.
//  Sorties (`SORTIE=…`, défaut /tmp/banc-minimaliste) : `releve.json`, `releve.md`, `ecrans/<écran>-<fen>-<th>-<base>.png`.
//  `BANC_DIST=…` juge un autre build (avant : origin/main). `ECRANS=a,b` `FENETRES=390,1512` `THEMES=clair` `BASES=volume`.
//  `--fusion d1 d2 …` réunit plusieurs passages ; `--compare avant… -- après…` le tableau avant / après par écran ;
//  `--planches avant… -- après…` les planches avant / après des 12 écrans principaux (390 et 1512, clair).
//  `SEUIL=1` : rouge si un écran (hors exceptions NOMMÉES ci-dessous) garde une carte décorée, une ombre, un lien
//  souligné, un texte gris de plus de deux lignes, plus d'un plein, un bouton gris pleine largeur, un contraste faible
//  ou une cible trop petite.  `MUTATION=ombre|carte|souligne` : pose le défaut dans l'écran ⇒ le compteur monte (prouvé).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const E = require('./ecrans-verre-2.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'banc-minimaliste');
fs.mkdirSync(path.join(SORTIE, 'ecrans'), { recursive: true });
const FENETRES = liste('FENETRES', '390,1512');
const THEMES = liste('THEMES', 'clair,sombre');
const BASES = liste('BASES', 'volume');
const MUT = process.env.MUTATION || '';
const NUM_FICHE = '3102';
const ATTENTE = Number(process.env.ATTENTE || 2200);

const ev = (nom, detail) => ({ nom, detail });
// `clics` : sélecteurs touchés l'un après l'autre (le premier présent de chaque ligne `a|b`).
const TOUS = [
  { cle: 'aujourdhui', url: '?tab=journee', principal: true },
  { cle: 'annonces', url: '?tab=annonces', principal: true },
  { cle: 'ventes', url: '?tab=ventes', principal: true },
  { cle: 'achats', url: '?tab=achats', principal: true },
  { cle: 'stock', url: '?tab=garage', principal: true },
  { cle: 'messages', url: '?tab=messages', principal: true },
  { cle: 'emails', url: '?tab=emails', principal: true },
  { cle: 'parametres', url: '?tab=settings', principal: true },
  { cle: 'parametres.sous', url: '?tab=settings', clics: ['#vrm-contenu .n-rangee[data-n-fin="chevron"]|#vrm-contenu [data-reglages-entree]|#vrm-contenu .v2-pm-rangee'] },
  { cle: 'notifications', url: '?tab=journee', evt: ev('vrm:centre-notifs', null), principal: true },
  { cle: 'automatisations', url: '?tab=automatisations', principal: true },
  { cle: 'extension', url: '?tab=extension', principal: true },
  { cle: 'fiche', url: '?tab=annonces', evt: ev('vrm:fiche-paire', NUM_FICHE), principal: true },
  { cle: 'completer', url: '?tab=annonces', evt: ev('vrm:completer', { sujet: 'tout', num: '', lot: false, at: 1 }) },
  { cle: 'relier', url: '?tab=annonces', evt: ev('vrm:liaison-ouvrir', { site: null, id: null, vue: null, article: null }) },
  { cle: 'publier', url: '?tab=annonces', evt: ev('vrm:publier-ailleurs', { site: 'leboncoin' }) },
  { cle: 'sante', url: '?tab=journee', clics: ['[data-n-coque-plus]|.n-laterale [data-nav-entree="sante"]', '[data-n-plus-entree="sante"]|[data-nav-entree="sante"]'] },
  { cle: 'communaute', url: '?tab=communaute' },
];
const VOULUS = liste('ECRANS', TOUS.map((e) => e.cle).join(','));
const ECRANS = TOUS.filter((e) => VOULUS.includes(e.cle));

// Exceptions NOMMÉES (§1 bis) : ce qui garde sa forme exprès, jamais compté.
//  · la feuille et le volet (leur ombre est la seule permise, NATIF §1) ; la barre d'onglets et la barre de titre ;
//  · la photo de la fiche, une vignette, une image, un canvas (le dessin du Stock) ;
//  · l'ambre d'un geste à faire (`--n-ambre-fond`) et le rouge d'un doublon de N° (fonds teintés voulus) ;
//  · la plaque d'un N° (`.n-plaque`), une pastille, un interrupteur, un champ de saisie ;
//  · les tuiles chiffres d'Aujourd'hui (`[data-n-affiche]`, `.n-affiche`) : grandes mais sobres, jamais une ombre.
const FEUILLES = '.n-feuille-panneau, .n-feuille, .n-volet, .vrm-fs, .sb-feuille, .v2-feuille, .vrm-sheet, .n-poussee';
const EXCEPTIONS = '.n-onglets, .n-barre-titre, .n-laterale, .n-plaque, .n-pastille, .n-interrupteur, input, textarea, select, img, canvas, video, svg, [data-banc-exception]';

function mesurer({ tel, mut }) {
  const COQUE = '.n-onglets, .n-laterale, .n-barre-titre, .vrm-mobile-nav, .vrm-atelier-rail, .vrm-toasts, .n-toast';
  const dialogues = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .n-poussee, .vrm-sheet, dialog[open]')]
    .filter((d) => d.getClientRects().length && getComputedStyle(d).visibility !== 'hidden' && !d.closest('[data-n-feuille-plus]'));
  const racines = dialogues.length ? dialogues : [document.querySelector('#vrm-contenu, .vrm-main') || document.body];
  const EXC = window.__bancExceptions;
  if (mut) {
    const r = racines[0]; const d = document.createElement('div');
    d.textContent = 'Mutation du banc minimaliste — une carte décorée comme avant';
    d.style.cssText = 'width:300px;height:60px;margin:8px;border-radius:14px;background:#fff;' + (mut === 'ombre' ? 'box-shadow:0 4px 18px rgba(0,0,0,.18)' : mut === 'carte' ? 'border:1px solid #c7d2fe;background:#eef2ff' : 'text-decoration:underline');
    r.prepend(d);
  }
  const rgba = (s) => {
    const t = String(s || '');
    const c = t.match(/color\(srgb ([^)]+)\)/); if (c) { const p = c[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    const m = t.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const melange = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const chroma = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  const fondDe = (el) => {
    const couches = [];
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) return null;
      const c = rgba(cs.backgroundColor); if (c && c.a > 0) { couches.push(c); if (c.a >= 1) break; }
    }
    let f = { r: 255, g: 255, b: 255, a: 1 };
    const racine = rgba(getComputedStyle(document.body).backgroundColor); if (racine && racine.a > 0) f = melange(racine, f);
    for (let i = couches.length - 1; i >= 0; i--) f = melange(couches[i], f);
    return f;
  };
  const visible = (e) => {
    if (e.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = e.getBoundingClientRect(); return r.width >= 2 && r.height >= 2 && r.right > 0 && r.left < innerWidth;
  };
  const enCoque = (e) => e.closest(COQUE) && !e.closest('.n-feuille, .n-poussee, [role="dialog"]');
  const nom = (e) => { const c = (typeof e.className === 'string' ? e.className : '').split(/\s+/).filter(Boolean).slice(0, 2).join('.'); return e.tagName.toLowerCase() + (c ? '.' + c : '') + ' « ' + (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) + ' »'; };
  const tous = []; const vus = new Set();
  for (const r of racines) for (const e of [r, ...r.querySelectorAll('*')]) { if (vus.has(e)) continue; vus.add(e); if (!enCoque(e) && visible(e)) tous.push(e); }
  // Une feuille n'est exceptée qu'ELLE-MÊME (son ombre, son fond) : ce qu'elle contient est jugé.
  const exc = (e) => e.matches(window.__bancFeuilles) || !!e.closest(EXC);
  const out = { cartes: [], ombres: [], soulignes: [], gris: [], pleins: [], grisLarges: [], contraste: [], cibles: [], coupes: [], nTextes: 0 };
  const cartesEls = new Set();
  for (const e of tous) {
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
    // C2 ombres
    const om = cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow.split(/,(?![^(]*\))/).filter((s) => !/inset/.test(s) && (() => { const n = s.replace(/rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]+/gi, '').trim().split(/\s+/).map(parseFloat); return (n[2] || 0) > 0.5 || Math.abs(n[1] || 0) > 0.5; })()) : [];
    const ombreTexte = cs.textShadow && cs.textShadow !== 'none' && (e.innerText || '').trim();
    if ((om.length || ombreTexte) && !e.matches(window.__bancFeuilles) && !e.closest('[data-banc-exception]') && !e.matches(':focus, :focus-within')) out.ombres.push(nom(e));
    // C1 cartes décorées
    if (!exc(e) && r.width >= 120 && r.height >= 40) {
      // Un dégradé d'UNE couleur (un filet de séparation dessiné en dégradé) n'est pas une décoration.
      const bi = (() => { const t = cs.backgroundImage || ''; if (!/gradient/.test(t)) return ''; const cols = new Set((t.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi) || []).map((x) => x.replace(/\s/g, ''))); return cols.size > 1 ? t : ''; })();
      const bords = ['Top', 'Right', 'Bottom', 'Left'].every((k) => parseFloat(cs['border' + k + 'Width']) > 0.4 && cs['border' + k + 'Style'] !== 'none' && (rgba(cs['border' + k + 'Color']) || { a: 0 }).a > 0.05);
      const f = rgba(cs.backgroundColor);
      const teinte = f && f.a > 0.05 && chroma(f) > 24 && !e.closest('[data-n-ambre], .n-ambre');
      const deco = om.length > 0 || /gradient/.test(bi) || bords || teinte;
      const pourquoi = om.length ? 'ombre' : /gradient/.test(bi) ? 'dégradé' : bords ? 'bordure' : teinte ? 'fond teinté' : '';
      if (deco && !e.matches('button, [role="button"], a, label') && ![...cartesEls].some((c) => c.contains(e))) { cartesEls.add(e); out.cartes.push(nom(e) + ' · ' + pourquoi); }
    }
    // Textes
    const direct = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (direct && !e.closest('input, textarea, select, svg')) {
      out.nTextes++;
      const c = rgba(cs.color); const f = fondDe(e);
      if (/underline/.test(cs.textDecorationLine)) out.soulignes.push(nom(e));
      if (c && f) {
        const cc = c.a < 1 ? melange(c, f) : c; const k = ratio(cc, f);
        const taille = parseFloat(cs.fontSize); const gras = Number(cs.fontWeight) >= 700;
        if (k < ((taille >= 24 || (taille >= 18.66 && gras)) ? 3 : 4.5) && !e.closest('[aria-disabled="true"], :disabled')) out.contraste.push(nom(e) + ' · ' + k.toFixed(2));
        // C4 gris de plus de deux lignes : neutre, nettement moins contrasté que l'encre.
        const lh = parseFloat(cs.lineHeight) || taille * 1.3;
        if (chroma(cc) < 30 && k < 9 && r.height > lh * 2.4 && (e.innerText || '').trim().length > 60 && !exc(e)) out.gris.push(nom(e));
      }
      if (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && e.closest('button, [role="button"]') && !e.closest('.n-rangee, [class*="rangee"], [class*="ligne"]')) out.coupes.push(nom(e));
    }
    // Touchables
    if (e.matches('button, [role="button"], a[href], summary, [role="tab"], [role="switch"]') && !(e.parentElement && e.parentElement.closest('button, [role="button"]'))) {
      const plein = e.getAttribute('data-n-variante') === 'plein' || e.classList.contains('sb-btn-plein') || (() => { const f = rgba(cs.backgroundColor); const t = rgba(cs.color); return f && f.a > 0.9 && chroma(f) > 120 && f.b > f.r && t && lum(t) > 0.8 && r.width >= 120 && r.height >= 40; })();
      if (plein) out.pleins.push(nom(e));
      const f = rgba(cs.backgroundColor); const pf = e.parentElement ? fondDe(e.parentElement) : null;
      const rangee = /rangee|ligne|n-tt|row|item|entree/i.test(typeof e.className === 'string' ? e.className : '') || e.closest('.n-groupe-corps, [role="list"], ul, table');
      const conteneur = e.parentElement ? e.parentElement.getBoundingClientRect().width : innerWidth;
      if (!plein && !rangee && f && f.a > 0.3 && chroma(f) < 30 && pf && Math.abs(lum(melange(f, pf)) - lum(pf)) > 0.01 && r.width >= 240 && r.width >= conteneur * 0.8) out.grisLarges.push(nom(e));
      const enLigne = cs.display === 'inline';
      const min = tel ? 44 : 32;
      if (!enLigne && !exc(e) && (r.height < min - 0.5 || r.width < min - 0.5) && e.tagName !== 'SUMMARY') out.cibles.push(nom(e) + ` ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) out.coupes.push('page plus large que la fenêtre : ' + document.documentElement.scrollWidth);
  const titre = (() => { const h = [...document.querySelectorAll('.n-grand-titre, .n-page-titre, h1')].find((x) => visible(x)); return h ? h.innerText.trim().slice(0, 40) : ''; })();
  return { ...out, titre, dialogues: dialogues.length };
}

const FEN = {
  390: { W: 390, H: 844, tel: true },
  safari: { W: 390, H: 664, tel: true },
  1512: { W: 1512, H: 950, tel: false },
  1280: { W: 1280, H: 800, tel: false },
};

function baseVide() {
  const b = E.baseFiches();
  const m = b.main[0].data;
  const garder = /^(vrm_bienvenue_vue|vrm_visite_vue|vrm_je_vends|vrm_configuration|vrm_plateformes_affichees|vrm_parcours|vrm_bilan_minute)$/;
  for (const k of Object.keys(m)) if (!garder.test(k)) delete m[k];
  b.rows = b.rows.filter((x) => /^ext_appareil_/.test(x.id));
  return b;
}

async function ouvrirEcran(nav, fen, sombre, ec, base) {
  const f = FEN[fen];
  const o = await P.ouvrir(nav, { W: f.tel ? 390 : 1512, sombre, b: base === 'vide' ? baseVide() : E.baseFiches(), url: '/' + ec.url, api: B.apiVolume });
  if (f.W !== (f.tel ? 390 : 1512) || f.H !== (f.tel ? 844 : 950)) await o.pg.setViewportSize({ width: f.W, height: f.H });
  await o.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await P.pret(o.pg);
  await o.pg.evaluate((x) => { window.__bancExceptions = x[0]; window.__bancFeuilles = x[1]; }, [EXCEPTIONS, FEUILLES]);
  if (ec.evt) { await o.pg.evaluate((x) => window.dispatchEvent(x.detail == null ? new Event(x.nom) : new CustomEvent(x.nom, { detail: x.detail })), ec.evt); await o.pg.waitForTimeout(ATTENTE); }
  for (const c of ec.clics || []) {
    let fait = false;
    for (const s of c.split('|')) { const l = o.pg.locator(s).filter({ visible: true }).first(); if (await l.count()) { await l.click({ timeout: 4000 }).catch(() => {}); fait = true; break; } }
    if (!fait) o.manque = 'clic introuvable : ' + c; await o.pg.waitForTimeout(ATTENTE);
  }
  // Fermer les messages passagers (ils couvrent le bas de l'écran) : ceux d'avant et le Toast natif.
  await o.pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast, .n-toast button')) t.click(); }).catch(() => {});
  await o.pg.waitForTimeout(300);
  return o;
}

const COMPTES = ['cartes', 'ombres', 'soulignes', 'gris', 'grisLarges', 'contraste', 'cibles', 'coupes'];
function resumer(r) {
  const s = { ecran: r.ecran, fen: r.fen, theme: r.theme, base: r.base, titre: r.titre, pleins: r.pleins.length, erreurs: r.erreurs.length, manque: r.manque || '' };
  for (const k of COMPTES) s[k] = r[k].length;
  return s;
}
function tableau(resumes) {
  const l = ['| écran | fenêtre | thème | base | cartes déco. | ombres | liens soul. | gris > 2 l. | pleins | gris larges | contraste < 4,5 | cibles < 44 | coupé |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const s of resumes) l.push(`| ${s.ecran} | ${s.fen} | ${s.theme} | ${s.base} | ${s.cartes} | ${s.ombres} | ${s.soulignes} | ${s.gris} | ${s.pleins} | ${s.grisLarges} | ${s.contraste} | ${s.cibles} | ${s.coupes}${s.manque ? ' ⚠️ ' + s.manque : ''}${s.erreurs ? ' ❌' : ''} |`);
  return l.join('\n');
}
function ecrire(resultats) {
  fs.writeFileSync(path.join(SORTIE, 'releve.json'), JSON.stringify(resultats, null, 1));
  fs.writeFileSync(path.join(SORTIE, 'releve.md'), `# Relevé minimaliste (${new Date().toISOString().slice(0, 16)}, ${process.env.BANC_DIST || 'dist'})\n\n${tableau(resultats.map(resumer))}\n`);
}
const lireDossiers = (ds) => ds.flatMap((d) => { try { return JSON.parse(fs.readFileSync(path.join(d, 'releve.json'), 'utf8')); } catch (_) { return []; } });

// Par écran : la somme sur toutes ses fenêtres / thèmes / bases ; `pleins` : le maximum.
function parEcran(res) {
  const t = {};
  for (const r of res) {
    const s = resumer(r); const k = s.ecran; const x = t[k] || (t[k] = { ecran: k, n: 0, pleinsMax: 0 });
    x.n++; x.pleinsMax = Math.max(x.pleinsMax, s.pleins); for (const c of COMPTES) x[c] = (x[c] || 0) + s[c];
  }
  return t;
}
function compare(args) {
  const k = args.indexOf('--'); const av = parEcran(lireDossiers(args.slice(0, k))), ap = parEcran(lireDossiers(args.slice(k + 1)));
  const l = ['| écran | passages | cartes déco. | ombres | liens soul. | gris > 2 l. | pleins (max) | gris larges | contraste | cibles | coupé |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  const tot = { a: {}, b: {} };
  for (const e of TOUS.map((x) => x.cle)) {
    const a = av[e] || {}, b = ap[e] || {};
    const c = (n) => `${a[n] ?? '—'} → **${b[n] ?? '—'}**`;
    for (const n of COMPTES) { tot.a[n] = (tot.a[n] || 0) + (a[n] || 0); tot.b[n] = (tot.b[n] || 0) + (b[n] || 0); }
    l.push(`| ${e} | ${a.n || 0}/${b.n || 0} | ${c('cartes')} | ${c('ombres')} | ${c('soulignes')} | ${c('gris')} | ${a.pleinsMax ?? '—'} → **${b.pleinsMax ?? '—'}** | ${c('grisLarges')} | ${c('contraste')} | ${c('cibles')} | ${c('coupes')} |`);
  }
  l.push(`| **TOTAL** | | ${COMPTES.slice(0, 4).map((n) => `${tot.a[n]} → **${tot.b[n]}**`).join(' | ')} | | ${COMPTES.slice(4).map((n) => `${tot.a[n]} → **${tot.b[n]}**`).join(' | ')} |`);
  const md = l.join('\n'); fs.writeFileSync(path.join(SORTIE, 'avant-apres.md'), md + '\n'); console.log(md);
}

async function planches(args) {
  const k = args.indexOf('--'); const avant = args.slice(0, k), apres = args.slice(k + 1);
  const trouver = (ds, n) => { for (const d of ds) { const f = path.join(d, 'ecrans', n); if (fs.existsSync(f)) return f; } return null; };
  const principaux = TOUS.filter((e) => e.principal).map((e) => e.cle);
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const fen of (process.env.PLANCHES || '390,1512').split(',')) for (const th of (process.env.PLANCHES_THEMES || 'clair').split(',')) {
      const tel = FEN[fen].tel;
      const cases = principaux.map((e) => {
        const a = trouver(avant, `${e}-${fen}-${th}-volume.png`), b = trouver(apres, `${e}-${fen}-${th}-volume.png`);
        const img = (f) => (f ? `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">` : '<i>—</i>');
        return `<div class="e"><h2>${e}</h2><div class="p"><figure>${img(a)}<figcaption>avant</figcaption></figure><figure>${img(b)}<figcaption>après</figcaption></figure></div></div>`;
      }).join('');
      const html = `<!doctype html><meta charset="utf-8"><style>body{margin:16px;font:14px -apple-system,system-ui,sans-serif;background:#ddd}
        .g{display:grid;grid-template-columns:repeat(${tel ? 6 : 3},1fr);gap:14px}.e{background:#fff;border-radius:10px;padding:8px}h2{margin:0 0 6px;font-size:16px}
        .p{display:grid;grid-template-columns:1fr 1fr;gap:6px}figure{margin:0}img{width:100%;display:block;border:1px solid #ccc}figcaption{text-align:center;color:#444}</style>
        <h1>Minimaliste — avant / après · ${fen} · ${th}</h1><div class="g">${cases}</div>`;
      const f = path.join(SORTIE, `planche-${fen}-${th}.html`); fs.writeFileSync(f, html);
      const ctx = await nav.newContext({ viewport: { width: tel ? 2600 : 2700, height: 1200 } }); const pg = await ctx.newPage();
      await pg.goto('file://' + f); await pg.screenshot({ path: path.join(SORTIE, `planche-${fen}-${th}.png`), fullPage: true }); await ctx.close();
      fs.unlinkSync(f); console.log('planche : ' + path.join(SORTIE, `planche-${fen}-${th}.png`));
    }
  } finally { await nav.close(); }
}

if (require.main === module && process.argv[2] === '--fusion') { const r = lireDossiers(process.argv.slice(3)); ecrire(r); console.log(tableau(r.map(resumer))); }
else if (require.main === module && process.argv[2] === '--compare') compare(process.argv.slice(3));
else if (require.main === module && process.argv[2] === '--planches') planches(process.argv.slice(3));
else if (require.main === module) (async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const resultats = [];
  try {
    for (const base of BASES) for (const fen of FENETRES) for (const th of THEMES) for (const ec of ECRANS) {
      let o;
      try {
        o = await ouvrirEcran(nav, fen, th === 'sombre', ec, base);
        const m = await o.pg.evaluate(mesurer, { tel: FEN[fen].tel, mut: MUT });
        await o.pg.screenshot({ path: path.join(SORTIE, 'ecrans', `${ec.cle}-${fen}-${th}-${base}.png`), fullPage: !!process.env.PLEINE_PAGE }).catch(() => {});
        const r = { ecran: ec.cle, fen, theme: th, base, erreurs: o.erreurs.slice(0, 5), manque: o.manque || '', ...m };
        resultats.push(r); ecrire(resultats);
        const s = resumer(r);
        console.log(`· ${ec.cle} ${fen} ${th} ${base} « ${s.titre} » : ${COMPTES.map((k) => k + ' ' + s[k]).join(' · ')} · pleins ${s.pleins}${s.manque ? ' ⚠️ ' + s.manque : ''}${r.erreurs.length ? ' ❌ ' + r.erreurs.join(' / ') : ''}`);
      } catch (e) { console.log(`❌ ${ec.cle} ${fen} ${th} ${base} : ${String(e.message || e).slice(0, 200)}`); }
      if (o) await o.ctx.close();
    }
    ecrire(resultats);
    console.log('\n' + tableau(resultats.map(resumer)) + '\nSorties : ' + SORTIE);
    if (process.env.SEUIL) {
      const rouges = resultats.filter((r) => r.erreurs.length || r.pleins.length > 1 || COMPTES.some((k) => r[k].length));
      if (rouges.length) { console.log(`❌ ${rouges.length} relevés au-dessus de la cible`); process.exitCode = 1; } else console.log('✅ cible tenue partout');
    }
    if (MUT) { const t = resultats.reduce((n, r) => n + r.cartes.length + r.ombres.length + r.soulignes.length, 0); console.log(`mutation ${MUT} : ${t} défauts relevés`); }
  } finally { await nav.close(); P.srv.close(); }
})();

module.exports = { mesurer, TOUS, baseVide };
