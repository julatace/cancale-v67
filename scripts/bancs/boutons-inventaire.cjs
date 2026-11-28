// ════════════════════════════════════════════════════════════════════════════
//  BANC — L'INVENTAIRE MESURÉ DES BOUTONS (20 nov., chantier « boutons natifs »).
//
//  Julien, 20 nov. : « c'est vraiment parfait pour le téléphone […] il reste pas mal de choses qui ne font pas
//  qualitatif et pas fiable : des boutons pas très beaux, améliore ça ».
//
//  Sur l'app RENDUE (le vrai `dist/`, base INVENTÉE `ecrans-verre-2.baseFiches()`, garde réseau : rien ne sort), il
//  ouvre chaque écran et chaque feuille courante — Aujourd'hui (et « Personnaliser »), Annonces, Ventes, Achats, Argent,
//  Messages, E-mails, Stock, Paramètres et ses sous-pages, la fiche d'un article, Automatisations, Extension, Compléter,
//  Relier mes annonces, Publier sur…, Changer le prix — à 390 tactile et 1512, clair et sombre, et relève TOUT ce qui se
//  touche (button, [role=button], a sans destination, summary) dans l'écran (la coque native n'est pas comptée : elle
//  est déjà native). Pour chaque bouton :
//    · son ORIGINE : `natif` (src/natif/Bouton : .n-bouton, .n-bouton-icone-seule), `natif-autre` (une autre pièce
//      native : segment, rangée, onglet…), `sb` (.sb-*), `vrm-btn` (.vrm-btn*, .vrm-b-*), `v2` (.v2b*, BoutonV2),
//      `ancien` (une autre classe d'avant), `brut-style` (<button> sans classe, styles en ligne), `brut` ;
//    · ses DÉFAUTS : D1 cible < 44 au doigt (< 32 à la souris) ; D2 rayon hors 8/10/12/14/rond ; D3 graisse hors
//      400/600/700 ; D4 contraste < 4,5:1 (texte contre le fond EFFECTIF, fonds empilés) ; D5 texte coupé ; D6 icône
//      désalignée (> 2 px du centre du texte) ; D7 gris d'une règle GLOBALE (fond = `--fu-remplir` sur un bouton d'avant
//      qui n'en pose aucun) ; D8 aucun focus visible au clavier ; D9 indisponible MUET (sans raison) ; D10 lien souligné
//      qui sert de bouton ; D11 deux pleins sur un écran (par écran) ; D12 taille de texte hors 13·15·17 ;
//      D13 style en ligne sur le bouton ; D14 doublon (même libellé deux fois dans l'écran ou la feuille, hors rangées
//      répétées) ; D15 sans nom accessible (28 nov., boutons-donnees).
//  Sorties (`SORTIE=dossier`, défaut /tmp/banc-boutons-inventaire) : `inventaire.json`, `inventaire.md` (un tableau par
//  écran), `planche-pires.png` (les pires cas, découpés), `ecrans/<écran>-<W>-<thème>.png` (pour la planche avant/après).
//  `BANC_DIST=…` juge un autre build (avant : le build d'origin/main). `ECRANS=a,b` `LARGEURS=390` `THEMES=clair`.
//  `SEUIL_ANCIENS=n` : rouge s'il reste plus de n boutons d'avant dans les écrans (défaut : aucun seuil, il rapporte).
//  `MUTATION=focus` (retire le focus visible) | `cible` (rétrécit un bouton natif) : le défaut correspondant doit monter.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const E = require('./ecrans-verre-2.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'banc-boutons-inventaire');
fs.mkdirSync(path.join(SORTIE, 'ecrans'), { recursive: true });
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const MUT = process.env.MUTATION || '';
const NUM_FICHE = '3102';

// Les écrans : `url` (lien profond), `evt` (l'événement de l'app qui ouvre la feuille ou la page), `clic` (un sélecteur
// à toucher après l'arrivée). `principal` : dans la planche avant/après des 10 écrans principaux.
const ev = (nom, detail) => ({ nom, detail });
const TOUS = [
  { cle: 'aujourdhui', url: '?tab=journee', principal: true },
  { cle: 'personnaliser', url: '?tab=journee', clic: '[data-v2-perso]' },
  { cle: 'annonces', url: '?tab=annonces', principal: true },
  { cle: 'ventes', url: '?tab=ventes', principal: true },
  { cle: 'achats', url: '?tab=achats', principal: true },
  { cle: 'argent', url: '?tab=dashboard', principal: true },
  { cle: 'messages', url: '?tab=messages', principal: true },
  { cle: 'emails', url: '?tab=emails', principal: true },
  { cle: 'stock', url: '?tab=garage', principal: true },
  { cle: 'parametres', url: '?tab=settings', principal: true, sousPages: true },
  { cle: 'fiche', url: '?tab=annonces', evt: ev('vrm:fiche-paire', NUM_FICHE), principal: true },
  { cle: 'automatisations', url: '?tab=automatisations' },
  { cle: 'extension', url: '?tab=extension' },
  { cle: 'completer', url: '?tab=annonces', evt: ev('vrm:completer', { sujet: 'tout', num: '', lot: false, at: 1 }) },
  { cle: 'relier', url: '?tab=annonces', evt: ev('vrm:liaison-ouvrir', { site: null, id: null, vue: null, article: null }) },
  { cle: 'publier', url: '?tab=annonces', evt: ev('vrm:publier-ailleurs', { site: 'leboncoin' }) },
  { cle: 'changer-prix', url: '?tab=annonces', evt: ev('vrm:prix-partout', NUM_FICHE) },
];
const VOULUS = liste('ECRANS', TOUS.map((e) => e.cle).join(','));
const ECRANS = TOUS.filter((e) => VOULUS.includes(e.cle));

// ── La mesure, DANS la page ────────────────────────────────────────────────
function mesurer({ tel, mut }) {
  // La portée : le contenu de l'écran et ce qui est ouvert par-dessus (feuilles, pages poussées, dialogues) ; la coque
  // native (onglets, barre latérale, barre de titre, « Plus ») n'est pas un écran.
  const COQUE = '.n-onglets, .n-laterale, .n-barre-titre, .vrm-mobile-nav, .vrm-atelier-rail, .vrm-toasts, .n-toast';
  const dialogues = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .n-feuille, .n-poussee, .vrm-sheet, dialog[open]')]
    .filter((d) => d.getClientRects().length && getComputedStyle(d).visibility !== 'hidden');
  const contenu0 = document.querySelector('#vrm-contenu, .vrm-main') || document.body;
  const racines = dialogues.length ? dialogues : [contenu0];
  const SEL = 'button, [role="button"], a:not([href]), a[href="#"], a[href^="javascript"], summary';
  const vus = new Set(); const els = [];
  for (const r of racines) for (const e of r.querySelectorAll(SEL)) {
    if (vus.has(e)) continue; vus.add(e);
    if (e.closest(COQUE) && !e.closest('.n-feuille, .n-poussee, [role="dialog"]')) continue;
    if (e.closest('[hidden], [inert]')) continue;
    if (e.parentElement && e.parentElement.closest(SEL) && !e.matches('summary')) continue;
    if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const rr = e.getBoundingClientRect(); if (rr.width < 2 || rr.height < 2) continue;
    // Hors de la fenêtre en largeur (un carrousel) : pas une cible du moment.
    if (rr.right < 0 || rr.left > innerWidth) continue;
    els.push(e);
  }
  if (mut === 'cible') { const n = els.find((e) => e.classList.contains('n-bouton')); if (n) { n.style.minHeight = '20px'; n.style.height = '20px'; n.style.minWidth = '20px'; n.style.padding = '0'; } }
  if (mut === 'focus') for (const e of els) { e.style.setProperty('outline', 'none', 'important'); e.style.setProperty('box-shadow', 'none', 'important'); e.style.setProperty('background-color', getComputedStyle(e).backgroundColor, 'important'); e.style.setProperty('border-color', getComputedStyle(e).borderColor, 'important'); }
  const rgba = (s) => {
    const t = String(s || '');
    const c = t.match(/color\(srgb ([^)]+)\)/); if (c) { const p = c[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    const m = t.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const melange = (haut, bas) => ({ r: haut.r * haut.a + bas.r * (1 - haut.a), g: haut.g * haut.a + bas.g * (1 - haut.a), b: haut.b * haut.a + bas.b * (1 - haut.a), a: 1 });
  // Le fond EFFECTIF : les fonds empilés du bouton jusqu'à la page ; une image de fond rend le fond inconnu (null).
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
  // Le gris d'une règle globale : la valeur de `--fu-remplir` rendue dans la coque.
  const sonde = document.createElement('button'); sonde.className = 'banc-sonde-gris'; sonde.style.cssText = 'position:fixed;left:-999px;top:0;background-color:var(--fu-remplir)';
  (document.querySelector('.vrm-app-shell') || document.body).append(sonde);
  const gris = getComputedStyle(sonde).backgroundColor; sonde.remove();
  const sondeNue = document.createElement('button'); sondeNue.style.cssText = 'position:fixed;left:-999px;top:0';
  (document.querySelector('#vrm-contenu, .vrm-main') || document.body).append(sondeNue);
  const grisNu = getComputedStyle(sondeNue).backgroundColor; sondeNue.remove();

  const origine = (e) => {
    const c = typeof e.className === 'string' ? e.className : (e.getAttribute('class') || '');
    if (/(^|\s)n-bouton(-icone-seule)?(\s|$)/.test(c)) return 'natif';
    if (/(^|\s)n-[a-z]/.test(c)) return 'natif-autre';
    if (/(^|\s)nf-[a-z]/.test(c)) return 'natif-ecran';   // un contrôle propre à un écran natif (la fiche : src/natif/ecrans/Fiche.jsx)
    if (/(^|\s)sb-/.test(c)) return 'sb';
    if (/(^|\s)vrm-(btn|b-|bouton)/.test(c)) return 'vrm-btn';
    if (/(^|\s)v2b|(^|\s)v2-/.test(c)) return 'v2';
    if (c.trim()) return 'ancien';
    return e.getAttribute('style') ? 'brut-style' : 'brut';
  };
  const TAILLES = [13, 15, 17];
  const RAYONS = [8, 10, 12, 14];
  const out = [];
  for (const e of els) {
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
    const o = origine(e);
    const txt = (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 48);
    const d = [];
    // D1 cible : la zone étendue d'un ::before / ::after compte (une rangée de 44 dont le libellé est plus petit).
    let w = r.width, h = r.height;
    for (const ps of ['::before', '::after']) { const p = getComputedStyle(e, ps); if (p.content && p.content !== 'none' && p.position === 'absolute') { const ins = ['top', 'bottom', 'left', 'right'].map((k) => parseFloat(p[k]) || 0); h = Math.max(h, r.height - ins[0] - ins[1]); w = Math.max(w, r.width - ins[2] - ins[3]); } }
    const enLigne = cs.display === 'inline' && e.parentElement && (e.parentElement.innerText || '').trim().length > (e.innerText || '').trim().length + 8;
    const min = tel ? 44 : 32;
    // Une RANGÉE (toute la largeur de sa liste) : son rayon est celui du groupe, son titre se replie exprès (2 lignes).
    const rangee = /rangee|ligne|n-tt-ligne/.test(typeof e.className === 'string' ? e.className : '') || r.width >= Math.min(innerWidth, (e.parentElement || e).getBoundingClientRect().width) * 0.92 && r.width > 280;
    if (!enLigne && (Math.round(h) < min || Math.round(w) < min) && e.tagName !== 'SUMMARY') d.push('D1');
    // D2 rayon (le plus petit coin : un bouton rond fait la moitié de sa hauteur ou plus).
    const rayon = Math.min(...['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].map((k) => parseFloat(cs[k]) || 0));
    const fondPropre = rgba(cs.backgroundColor); const aUnFond = (fondPropre && fondPropre.a > 0.02) || (cs.borderStyle !== 'none' && parseFloat(cs.borderWidth) > 0);
    const rond = rayon >= Math.min(r.height, r.width) / 2 - 1;
    if (!rangee && aUnFond && !rond && !RAYONS.includes(Math.round(rayon)) && !(rayon === 0 && !aUnFond)) d.push('D2');
    // D3 graisse, D12 taille — sur le texte du bouton (le premier nœud de texte visible).
    let texteEl = null; const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.textContent.trim()) { texteEl = n.parentElement; break; }
    const ts = texteEl ? getComputedStyle(texteEl) : null;
    const graisse = ts ? Number(ts.fontWeight) : null; const taille = ts ? parseFloat(ts.fontSize) : null;
    if (ts && ![400, 600, 700].includes(graisse)) d.push('D3');
    if (ts && !TAILLES.includes(Math.round(taille * 2) / 2)) d.push('D12');
    // D4 contraste.
    let contraste = null;
    if (ts) {
      const c = rgba(ts.color); const f = fondDe(texteEl);
      if (c && f) { const cc = c.a < 1 ? melange(c, f) : c; contraste = Math.round(ratio(cc, f) * 100) / 100; const grand = taille >= 24 || (taille >= 18.66 && graisse >= 700); if (contraste < (grand ? 3 : 4.5)) d.push('D4'); }
    }
    // D5 texte coupé : le bouton ou un descendant qui coupe (ellipsis, overflow) plus large que sa boîte.
    const coupe = [e, ...e.querySelectorAll('*')].some((x) => { const s = getComputedStyle(x); return (s.overflow !== 'visible' || s.textOverflow === 'ellipsis') && x.scrollWidth > x.clientWidth + 1 && (x.innerText || '').trim().length > 1 && x.clientWidth > 0; });
    if (coupe && !rangee) d.push('D5');
    // D6 icône désalignée : un svg et un texte, centres verticaux à plus de 2 px.
    const svg = e.querySelector('svg');
    if (svg && texteEl && texteEl !== e) {
      const a = svg.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(texteEl); const b = rg.getBoundingClientRect();
      if (a.height && b.height && Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)) > 2 && Math.abs(a.left - b.left) > 2 && b.height < 30) d.push('D6');
    }
    // D7 gris d'une règle globale : un bouton d'avant dont le fond est EXACTEMENT celui posé sur tout <button>.
    if (o !== 'natif' && o !== 'natif-autre' && cs.backgroundColor === grisNu && grisNu === gris && fondPropre && fondPropre.a > 0) d.push('D7');
    // D9 indisponible muet.
    const indispo = e.disabled || e.getAttribute('aria-disabled') === 'true';
    if (indispo) {
      const desc = e.getAttribute('aria-describedby'); const raison = (e.getAttribute('title') || '') + (desc && document.getElementById(desc) ? document.getElementById(desc).textContent : '') + (e.getAttribute('data-raison') || '');
      if (!raison.trim()) d.push('D9');
    }
    // D10 lien souligné qui sert de bouton.
    if (/underline/.test(ts ? ts.textDecorationLine : cs.textDecorationLine) && !(fondPropre && fondPropre.a > 0.02) && !enLigne) d.push('D10');
    // D13 style en ligne.
    if (e.getAttribute('style') && e.getAttribute('style').trim()) d.push('D13');
    out.push({ o, txt, tag: e.tagName.toLowerCase(), cls: (typeof e.className === 'string' ? e.className : '').split(/\s+/).filter(Boolean).slice(0, 3).join(' '),
      w: Math.round(w), h: Math.round(h), rayon: Math.round(rayon), graisse, taille, contraste, fond: cs.backgroundColor, couleur: ts ? ts.color : cs.color,
      rangee, plein: e.getAttribute('data-n-variante') === 'plein' || /(^|\s)sb-btn-plein(\s|$)/.test(typeof e.className === 'string' ? e.className : ''), d, idx: out.length });
    e.setAttribute('data-banc-bouton', String(out.length - 1));
  }
  // D8 focus visible : le bouton FOCALISÉ au clavier (la page a déjà reçu un Tab) dessine-t-il un contour ou une ombre
  // qu'il n'a pas au repos ?
  const style = (x) => { const s = getComputedStyle(x); return [s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 ? s.outlineStyle + s.outlineWidth + s.outlineColor : '', s.boxShadow, s.backgroundColor, s.borderColor].join('|'); };
  const actif = document.activeElement;
  els.slice(0, 80).forEach((e, i) => {
    if (e.disabled) return;
    const repos = style(e);
    try { e.focus({ preventScroll: true, focusVisible: true }); } catch (_) { return; }
    if (document.activeElement !== e) return;
    const focal = style(e);
    const visible = e.matches(':focus-visible');
    e.blur();
    if (!visible || focal === repos) { const it = out.find((x) => x.idx === i); if (it) it.d.push('D8'); }
  });
  try { actif && actif.focus && actif.focus({ preventScroll: true }); } catch (_) {}
  // (28 nov., boutons-donnees) D14 doublon : deux touchables du MÊME libellé dans la même racine (l'écran ou une feuille),
  // hors des rangées répétées d'une liste (« Modifier » sur chaque ligne n'est pas un doublon). D15 sans nom : un touchable
  // qu'un lecteur d'écran ne sait pas nommer (ni texte, ni aria-label, ni aria-labelledby, ni title).
  const REPETE = 'li, tr, .n-rangee, [data-n-rangee], [role="row"], [role="listitem"], article, .n-tt-ligne';
  const parRacine = new Map();
  for (const b of out) {
    const e = els[b.idx]; const racine = e.closest('[role="dialog"], [aria-modal="true"], .n-feuille, .n-poussee, .vrm-sheet, dialog') || contenu0;
    const nomAcc = (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') ? (document.getElementById(e.getAttribute('aria-labelledby')) || {}).textContent : '') || e.innerText || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    if (!nomAcc) b.d.push('D15');
    if (b.rangee || e.closest(REPETE) || nomAcc.length < 2 || e.tagName === 'SUMMARY') continue;
    const k = nomAcc.toLowerCase();
    const m = parRacine.get(racine) || new Map(); parRacine.set(racine, m);
    (m.get(k) || m.set(k, []).get(k)).push(b);
  }
  for (const m of parRacine.values()) for (const [, bs] of m) if (bs.length > 1) for (const b of bs.slice(1)) b.d.push('D14');
  const pleins = out.filter((x) => x.plein).length;
  return { boutons: out, pleins, dialogues: dialogues.length };
}

const ATTENTE = Number(process.env.ATTENTE || 2500);
async function ouvrirEcran(nav, W, sombre, ec) {
  const o = await P.ouvrir(nav, { W, sombre, b: E.baseFiches(), url: '/' + ec.url, api: B.apiVolume });
  // Comme fiche-directe : le 1er chargement pose ses réglages d'arrivée, le 2e est l'app telle qu'il la voit chaque jour
  // (sans ce rechargement, la coque montre encore l'écran d'avant — mesuré : « Ma journée » au lieu d'« Aujourd'hui »).
  await o.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await P.pret(o.pg);
  if (ec.evt) { await o.pg.evaluate((x) => window.dispatchEvent(new CustomEvent(x.nom, { detail: x.detail })), ec.evt); await o.pg.waitForTimeout(ATTENTE); }
  if (ec.clic) { const l = o.pg.locator(ec.clic).first(); if (await l.count()) { await l.click({ timeout: 4000 }).catch(() => {}); await o.pg.waitForTimeout(ATTENTE); } else o.manque = 'clic introuvable : ' + ec.clic; }
  // Fermer les messages passagers (ils couvrent le bas de l'écran).
  await o.pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
  return o;
}

async function releve(o, nom, W, th, tel) {
  const pg = o.pg;
  await pg.keyboard.press('Tab').catch(() => {});   // la page sait maintenant que l'utilisateur est au clavier (:focus-visible)
  await pg.keyboard.press('Shift+Tab').catch(() => {});
  const m = await pg.evaluate(mesurer, { tel, mut: MUT });
  const shot = path.join(SORTIE, 'ecrans', `${nom}-${W}-${th}.png`);
  await pg.screenshot({ path: shot }).catch(() => {});
  // Les pires cas, découpés (les 3 plus touchés de l'écran), pour la planche.
  const pires = m.boutons.filter((b) => b.o !== 'natif' && b.d.length).sort((a, b) => b.d.length - a.d.length).slice(0, 3);
  for (const p of pires) {
    const h = pg.locator(`[data-banc-bouton="${p.idx}"]`).first();
    try { const buf = await h.screenshot({ timeout: 2000 }); p.png = buf.toString('base64'); } catch (_) {}
  }
  return { ecran: nom, W, theme: th, erreurs: o.erreurs.slice(0, 5), manque: o.manque || '', ...m };
}

function resumer(r) {
  const parOrigine = {}; const parDefaut = {};
  // Une RANGÉE n'est pas jugée comme un bouton dessiné : seuls comptent pour elle la cible (D1), le contraste (D4), le focus
  // (D8) et l'indisponible muet (D9) — son icône posée sur la 1re ligne, sa taille de titre, son style sont ceux d'une liste.
  const POUR_RANGEE = new Set(['D1', 'D4', 'D8', 'D9', 'D15']);
  for (const b of r.boutons) { parOrigine[b.o] = (parOrigine[b.o] || 0) + 1; for (const d of b.d) if (!b.rangee || POUR_RANGEE.has(d)) parDefaut[d] = (parDefaut[d] || 0) + 1; }
  if (r.pleins > 1) parDefaut.D11 = r.pleins;
  // Une RANGÉE d'avant (toute la largeur de sa liste : une conversation, un réglage, un achat) est comptée à part : ce n'est
  // pas un bouton dessiné, c'est une ligne qui se touche (NATIF.md : « une rangée ENTIÈRE se touche »).
  const anciensTous = r.boutons.filter((b) => !/^natif/.test(b.o));
  const rangees = anciensTous.filter((b) => b.rangee).length;
  const anciens = anciensTous.length - rangees;
  return { ecran: r.ecran, W: r.W, theme: r.theme, total: r.boutons.length, natifs: r.boutons.length - anciensTous.length, anciens, rangees, parOrigine, parDefaut, pleins: r.pleins, erreurs: r.erreurs.length, manque: r.manque };
}

const NOMS_D = { D1: 'cible petite', D2: 'rayon', D3: 'graisse', D4: 'contraste', D5: 'texte coupé', D6: 'icône désalignée', D7: 'gris global', D8: 'focus invisible', D9: 'indisponible muet', D10: 'lien souligné', D11: 'deux pleins', D12: 'taille de texte', D13: 'style en ligne', D14: 'doublon', D15: 'sans nom' };
function tableau(resumes) {
  const lignes = ['| écran | W | thème | touchables | natifs | boutons d\'avant | rangées d\'avant | origines | défauts |', '|---|---|---|---|---|---|---|---|---|'];
  for (const s of resumes) lignes.push(`| ${s.ecran} | ${s.W} | ${s.theme} | ${s.total} | ${s.natifs} | ${s.anciens} | ${s.rangees} | ${Object.entries(s.parOrigine).map(([k, v]) => k + ' ' + v).join(', ')} | ${Object.entries(s.parDefaut).map(([k, v]) => `${k} ${NOMS_D[k]} ${v}`).join(', ') || '—'}${s.manque ? ' · ⚠️ ' + s.manque : ''} |`);
  const tot = { total: 0, natifs: 0, anciens: 0, rangees: 0, d: {} };
  for (const s of resumes) { tot.total += s.total; tot.natifs += s.natifs; tot.anciens += s.anciens; tot.rangees += s.rangees; for (const [k, v] of Object.entries(s.parDefaut)) tot.d[k] = (tot.d[k] || 0) + v; }
  lignes.push(`| **TOTAL** | | | **${tot.total}** | **${tot.natifs}** | **${tot.anciens}** | **${tot.rangees}** | | ${Object.entries(tot.d).sort().map(([k, v]) => `${k} ${v}`).join(', ')} |`);
  return { md: lignes.join('\n'), tot };
}

async function planche(nav, resultats) {
  const cas = [];
  for (const r of resultats) for (const b of r.boutons) if (b.png) cas.push({ ...b, ecran: r.ecran, W: r.W, theme: r.theme });
  cas.sort((a, b) => b.d.length - a.d.length);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = `<!doctype html><meta charset="utf-8"><style>body{font:13px -apple-system,system-ui,sans-serif;margin:16px;background:#f2f2f7;color:#111}
  h1{font-size:20px}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.c{background:#fff;border-radius:10px;padding:8px}
  .c img{max-width:100%;max-height:120px;display:block;margin:6px 0;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0/12px 12px}
  .d{color:#8a4b00}</style><h1>Boutons — les pires cas (${cas.length} découpés, ${esc(path.basename(process.env.BANC_DIST || 'dist'))})</h1><div class="g">${cas.slice(0, 60).map((c) => `<div class="c"><b>${esc(c.ecran)} · ${c.W} · ${c.theme}</b><br>${esc(c.o)} <code>${esc(c.cls)}</code><img src="data:image/png;base64,${c.png}"><span class="d">${c.d.map((x) => x + ' ' + NOMS_D[x]).join(' · ')}</span><br>${c.w}×${c.h} · r${c.rayon} · ${c.graisse}/${c.taille}px · ${c.contraste ?? '—'}:1</div>`).join('')}</div>`;
  const f = path.join(SORTIE, 'planche-pires.html'); fs.writeFileSync(f, html);
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } }); const pg = await ctx.newPage();
  await pg.goto('file://' + f); await pg.screenshot({ path: path.join(SORTIE, 'planche-pires.png'), fullPage: true }); await ctx.close();
}

function ecrire(resultats) {
  const resumes = resultats.map(resumer);
  const { md, tot } = tableau(resumes);
  fs.writeFileSync(path.join(SORTIE, 'inventaire.md'), `# Inventaire des boutons (${new Date().toISOString().slice(0, 16)}, ${process.env.BANC_DIST || 'dist'})\n\n${md}\n\nDéfauts : ${Object.entries(NOMS_D).map(([k, v]) => k + ' ' + v).join(' · ')}\n`);
  fs.writeFileSync(path.join(SORTIE, 'inventaire.json'), JSON.stringify(resultats, null, 1));
  return { md, tot };
}

// `node boutons-inventaire.cjs --fusion d1 d2 …` : un seul tableau et une seule planche pour plusieurs passages
// (une largeur et un thème par passage tiennent chacun sous 15 min).
async function fusion(dossiers) {
  const resultats = dossiers.flatMap((d) => { try { return JSON.parse(fs.readFileSync(path.join(d, 'inventaire.json'), 'utf8')); } catch (_) { return []; } });
  const { md, tot } = ecrire(resultats);
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try { await planche(nav, resultats); } finally { await nav.close(); }
  console.log(md + `\n\nTOTAL : ${tot.total} touchables · ${tot.natifs} natifs · ${tot.anciens} boutons d'avant · ${tot.rangees} rangées d'avant · défauts ${JSON.stringify(tot.d)}\nSorties : ${SORTIE}`);
}

// `node boutons-inventaire.cjs --avant-apres <dossiers avant…> -- <dossiers après…>` : la planche avant / après des 10 écrans
// principaux, 390 et 1512 (clair), une capture par écran et par largeur, côte à côte ; écrite dans SORTIE.
async function avantApres(args) {
  const k = args.indexOf('--'); const avant = args.slice(0, k), apres = args.slice(k + 1);
  const trouver = (ds, nom) => { for (const d of ds) { const f = path.join(d, 'ecrans', nom); if (fs.existsSync(f)) return f; } return null; };
  const principaux = TOUS.filter((e) => e.principal).map((e) => e.cle);
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of [390, 1512]) {
      const cases = principaux.map((e) => {
        const a = trouver(avant, `${e}-${W}-clair.png`), b = trouver(apres, `${e}-${W}-clair.png`);
        const img = (f) => (f ? `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">` : '<i>—</i>');
        return `<div class="e"><h2>${e}</h2><div class="p"><figure>${img(a)}<figcaption>avant</figcaption></figure><figure>${img(b)}<figcaption>après</figcaption></figure></div></div>`;
      }).join('');
      const html = `<!doctype html><meta charset="utf-8"><style>body{margin:16px;font:14px -apple-system,system-ui,sans-serif;background:#ddd}
        .g{display:grid;grid-template-columns:repeat(${W < 600 ? 5 : 2},1fr);gap:16px}.e{background:#fff;border-radius:10px;padding:8px}h2{margin:0 0 6px;font-size:16px}
        .p{display:grid;grid-template-columns:1fr 1fr;gap:6px}figure{margin:0}img{width:100%;display:block;border:1px solid #ccc}figcaption{text-align:center;color:#444}</style>
        <h1>Boutons natifs — avant / après · ${W}</h1><div class="g">${cases}</div>`;
      const f = path.join(SORTIE, `planche-avant-apres-${W}.html`); fs.writeFileSync(f, html);
      const ctx = await nav.newContext({ viewport: { width: W < 600 ? 2400 : 2000, height: 1200 } }); const pg = await ctx.newPage();
      await pg.goto('file://' + f); await pg.screenshot({ path: path.join(SORTIE, `planche-avant-apres-${W}.png`), fullPage: true }); await ctx.close();
      fs.unlinkSync(f);
      console.log('planche : ' + path.join(SORTIE, `planche-avant-apres-${W}.png`));
    }
  } finally { await nav.close(); }
}

if (require.main === module && process.argv[2] === '--fusion') fusion(process.argv.slice(3));
else if (require.main === module && process.argv[2] === '--avant-apres') avantApres(process.argv.slice(3));
else if (require.main === module) (async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const resultats = [];
  const garder = (r) => { resultats.push(r); ecrire(resultats); return resumer(r); };
  try {
    for (const W of LARGEURS) for (const th of THEMES) for (const ec of ECRANS) {
      const tel = W < 600; const sombre = th === 'sombre';
      let o;
      try {
        o = await ouvrirEcran(nav, W, sombre, ec);
        const r = await releve(o, ec.cle, W, th, tel);
        const s = garder(r);
        console.log(`· ${ec.cle} ${W} ${th} : ${s.total} boutons, ${s.anciens} anciens, défauts ${JSON.stringify(s.parDefaut)}${s.manque ? ' ⚠️ ' + s.manque : ''}${r.erreurs.length ? ' ❌ erreurs ' + r.erreurs.join(' / ') : ''}`);
        // Les sous-pages de Paramètres : chaque rangée de la liste qui pousse une page.
        if (ec.sousPages) {
          const SEL_SOUS = '#vrm-contenu .n-rangee[data-n-fin="chevron"], #vrm-contenu [data-reglages-entree], #vrm-contenu [data-param-section], #vrm-contenu .v2-pm-rangee, #vrm-contenu .vrm-pm-cat-ligne';
          const n = await o.pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((x) => x.getClientRects().length).length, SEL_SOUS);
          for (let i = tel ? 0 : 1; i < Math.min(n, Number(process.env.MAX_SOUS || 6)); i++) {
            const o2 = await ouvrirEcran(nav, W, sombre, ec);
            const cible = o2.pg.locator(SEL_SOUS).nth(i);
            const nomSous = ((await cible.innerText().catch(() => '')) || String(i)).split('\n')[0].trim().toLowerCase().replace(/[^a-z0-9àâçéèêëîïôûùüÿœ]+/g, '-').slice(0, 24);
            await cible.click({ timeout: 4000 }).catch(() => {}); await o2.pg.waitForTimeout(ATTENTE);
            const r2 = await releve(o2, 'parametres.' + nomSous, W, th, tel);
            const s2 = garder(r2); console.log(`  · ${r2.ecran} : ${s2.total} boutons, ${s2.anciens} anciens, défauts ${JSON.stringify(s2.parDefaut)}`);
            await o2.ctx.close();
          }
        }
      } catch (e) { console.log(`❌ ${ec.cle} ${W} ${th} : ${String(e.message || e).slice(0, 200)}`); }
      if (o) await o.ctx.close();
    }
    const { md, tot } = ecrire(resultats);
    await planche(nav, resultats);
    console.log('\n' + md);
    console.log(`\nTOTAL : ${tot.total} touchables · ${tot.natifs} natifs · ${tot.anciens} boutons d'avant · ${tot.rangees} rangées d'avant · défauts ${JSON.stringify(tot.d)}`);
    console.log('Sorties : ' + SORTIE);
    const seuil = process.env.SEUIL_ANCIENS; const rouge = (seuil != null && tot.anciens > Number(seuil)) || resultats.some((r) => r.erreurs.length);
    if (rouge) { console.log('❌ ' + (resultats.some((r) => r.erreurs.length) ? 'erreurs JS' : `plus de ${seuil} boutons d'avant`)); process.exitCode = 1; }
  } finally { await nav.close(); P.srv.close(); }
})();

module.exports = { mesurer, TOUS };
