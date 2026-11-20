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
  { cle: 'parametres.sous', url: '?tab=settings', clics: ['#vrm-contenu .n-rangee[data-n-fin="chevron"]|#vrm-contenu [data-reglages-entree]|#vrm-contenu .v2-pm-rangee|#vrm-contenu .vrm-pm-cat-ligne'] },
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
  // LA FORME de l'écran (« les mêmes dispositions sur toutes les plateformes », Julien, 20 nov.) : ce qui se compare d'un
  // site à l'autre — composants natifs ou d'hier, segments, en-têtes de groupe, colonnes du tableau, pleins.
  const dansEcran = (sel) => tous.filter((e) => e.matches(sel));
  const forme = {
    natif: dansEcran('.n-rangee, .n-tt-tr, .n-groupe, .n-carte, .n-segmente').length > 0,
    rangeesNatives: dansEcran('.n-rangee, .n-tt-tr').length,
    rangeesAnciennes: dansEcran('[class*="vrm-"][class*="-ligne"], [class*="vrm-"][class*="-rangee"], .v2l, .v2-ligne, [class*="-carte"]:not([class*="n-"])').filter((e) => !e.closest('.n-rangee, .n-tt-tr')).length,
    segments: dansEcran('.n-segmente [role="tab"], .n-segmente button, .vrm-seg .vrm-seg-btn').map((e) => (e.innerText || '').replace(/\s+\d[\d\s]*$/, '').trim()).filter(Boolean).slice(0, 8),
    groupes: dansEcran('.n-groupe-titre, .n-carte-titre, .n-tuiles-titre').map((e) => (e.innerText || '').replace(/[\s·]+\d[\d\s]*$/, '').trim().toUpperCase()).slice(0, 12),
    colonnes: dansEcran('.n-tt-th').map((e) => (e.innerText || '').replace(/[↑↓↕]/g, '').trim()).filter(Boolean),
    pleins: out.pleins.length,
  };
  return { ...out, titre, forme, dialogues: dialogues.length };
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

// Les bases « un seul site » (Julien, 20 nov. : « tu dois appliquer les mêmes dispositions sur toutes les plateformes ») :
// un vendeur SANS compte Vinted, 24 annonces et 5 ventes sur Leboncoin, eBay ou Vestiaire. Données INVENTÉES, aux formes
// lues par l'app (lbc_listings / lbc_ventes, ebay_listings / ebay_orders, vc_listings / vc_ventes).
const MODELES = ['Nike Air Max 1', 'Adidas Samba OG', 'New Balance 550', 'Asics Gel-1130', 'Salomon XT-6', 'Vans Old Skool'];
function baseSite(site) {
  const b = baseVide(); const m = b.main[0].data;
  const J = 86400000, now = Date.now(), iso = (j) => new Date(now - j * J).toISOString();
  b.accounts = [];
  m.vrm_plateformes_affichees = { sites: [site], at: iso(20) };
  const N = 24, titre = (i) => `${MODELES[i % MODELES.length]} taille ${36 + (i % 8)}`, prix = (i) => 30 + (i * 7) % 90;
  if (site === 'leboncoin') {
    const items = {}; for (let i = 0; i < N; i++) { const id = String(3200000000 + i); items[id] = { id, ref: String(101 + i), customRef: 'VRM-' + (101 + i), subject: titre(i), status: 'active', account: 'lbcA', seenAt: iso(0.02), price: prix(i), firstSeenAt: iso(3 + i) }; }
    b.rows.push({ id: 'lbc_accounts', data: { accounts: { lbcA: { id: 'lbcA', name: 'Moi', sessionAt: iso(0.05) } } } });
    b.rows.push({ id: 'lbc_listings', data: { capturedAt: iso(0.02), items, lectures: { lbcA: { at: iso(0.02), total: N, n: N } } } });
    const ventes = {}; for (let i = 0; i < 5; i++) ventes['L' + i] = { txId: 'L' + i, itemId: String(3200000000 + i), isSeller: true, price: prix(i) * 100, stepStatus: i < 2 ? 'to_ship' : 'done', dateVente: iso(i + 1), title: titre(i) };
    b.rows.push({ id: 'lbc_ventes', data: { ventes } });
  } else if (site === 'ebay') {
    const items = []; for (let i = 0; i < N; i++) items.push({ itemId: String(256100000000 + i), sku: 'VRM-' + (101 + i), title: titre(i), listingStatus: 'Active', depuis: iso(3 + i), price: String(prix(i)) + '.00', photo: null });
    b.rows.push({ id: 'ebay_listings', data: { capturedAt: now - 0.02 * J, complet: true, items } });
    const orders = []; for (let i = 0; i < 5; i++) orders.push({ orderId: '12-0000' + i, orderPaymentStatus: 'PAID', orderFulfillmentStatus: i < 2 ? 'NOT_STARTED' : 'FULFILLED', creationDate: iso(i + 1), pricingSummary: { total: { value: prix(i) + '.00', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: (prix(i) - 5) + '.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '6.00', currency: 'EUR' }, lineItems: [{ sku: 'VRM-' + (101 + i), legacyItemId: String(256100000000 + i), title: titre(i) }] });
    b.rows.push({ id: 'ebay_orders', data: { capturedAt: now - 0.02 * J, complet: true, orders } });
  } else if (site === 'vestiaire') {
    const items = {}, liens = {}; for (let i = 0; i < N; i++) { const id = 'P' + (101 + i); items[id] = { statut: 'on_sale', vuAt: iso(0.02), titre: titre(i), compte: 'vcA', prix: prix(i) }; liens[id] = String(101 + i); }
    b.rows.push({ id: 'vc_listings', data: { capturedAt: iso(0.02), complet: true, liens, items } });
    const ventes = {}; for (let i = 0; i < 5; i++) ventes[String(72900100 + i)] = { productId: String(72900100 + i), ref: String(101 + i), titre: titre(i), etat: i < 2 ? 'ACTION_NEEDED' : 'Expédiée', aExpedier: i < 2, date: iso(i + 1), montant: { cle: 'price', devise: 'EUR', valeur: prix(i) } };
    b.rows.push({ id: 'vc_ventes', data: { ventes, lectures: {} } });
  }
  return b;
}
const SITE_DE_BASE = { lbc: 'leboncoin', ebay: 'ebay', vc: 'vestiaire' };
// Ajoute à une base les lignes d'un site (en REMPLAÇANT celles du même identifiant : la base de volume porte déjà des
// `lbc_listings` / `ebay_*` vides — deux lignes du même id, l'app lisait la première).
function ajouterSite(b, site) { const x = baseSite(site); const ids = new Set(x.rows.filter((r) => /^(lbc_|ebay_|vc_)/.test(r.id)).map((r) => r.id)); b.rows = b.rows.filter((r) => !ids.has(r.id)); b.rows.push(...x.rows.filter((r) => ids.has(r.id))); return b; }
const baseDe = (base) => (base === 'vide' ? baseVide() : SITE_DE_BASE[base] ? baseSite(SITE_DE_BASE[base]) : E.baseFiches());

async function ouvrirEcran(nav, fen, sombre, ec, base) {
  const f = FEN[fen];
  // Une base « un seul site » ouvre chaque tâche filtrée sur ce site (`&site=`).
  const url = SITE_DE_BASE[base] && /tab=(annonces|ventes|achats|messages)/.test(ec.url) ? ec.url + '&site=' + SITE_DE_BASE[base] : ec.url;
  const o = await P.ouvrir(nav, { W: f.tel ? 390 : 1512, sombre, b: baseDe(base), url: '/' + url, api: B.apiVolume });
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

// `--formes d1 d2 …` : par écran et par fenêtre, la FORME de chaque base « un seul site » contre celle de Vinted (base de
// volume) : composants natifs, segments, en-têtes de groupe, colonnes du tableau, pleins. « même » = tout égal.
function formes(dossiers) {
  const res = lireDossiers(dossiers).filter((r) => r.forme);
  const cle = (r) => r.ecran + '|' + r.fen + '|' + r.theme;
  const ref = {}; for (const r of res) if (r.base === 'volume') ref[cle(r)] = r.forme;
  const l = ['| écran | fenêtre | base | natif | rangées natives / d\'hier | segments | groupes | colonnes | pleins | comme Vinted |', '|---|---|---|---|---|---|---|---|---|---|'];
  let ecarts = 0;
  for (const r of res.sort((a, b) => (a.ecran + a.fen + a.base).localeCompare(b.ecran + b.fen + b.base))) {
    const f = r.forme, v = ref[cle(r)];
    let meme = '—';
    if (v && r.base !== 'volume' && r.base !== 'vide') {
      const diff = [];
      if (f.natif !== v.natif) diff.push('natif');
      if (f.segments.join('|') !== v.segments.join('|')) diff.push('segments');
      if (f.colonnes.join('|') !== v.colonnes.join('|')) diff.push('colonnes');
      if (f.pleins > 1) diff.push('pleins');
      if (f.rangeesAnciennes > 0 && v.rangeesAnciennes === 0) diff.push('rangées d\'hier');
      meme = diff.length ? '❌ ' + diff.join(', ') : '✅ même';
      if (diff.length) ecarts++;
    }
    l.push(`| ${r.ecran} | ${r.fen} | ${r.base} | ${f.natif ? 'oui' : 'non'} | ${f.rangeesNatives} / ${f.rangeesAnciennes} | ${f.segments.join(' · ')} | ${f.groupes.join(' · ')} | ${f.colonnes.join(' · ')} | ${f.pleins} | ${meme} |`);
  }
  const md = l.join('\n'); fs.writeFileSync(path.join(SORTIE, 'formes.md'), md + `\n\nÉcarts : ${ecarts}\n`); console.log(md + `\n\nÉcarts : ${ecarts}`);
}

// `--selecteur` : LE sélecteur de plateforme global (décision du 20 nov.). Sur une base Vinted + Leboncoin + eBay :
//   S1 il est en tête de Ventes, avec « Tous » et les trois sites reliés (Vestiaire, pas relié, n'y est pas) ;
//   S2 choisir Leboncoin sur Ventes ⇒ Aujourd'hui, Annonces, Achats, Messages s'ouvrent sur Leboncoin (un seul choix) ;
//   S3 « Tous » ⇒ les chiffres d'Aujourd'hui sont ceux d'avant (`AVANT=<json>` : relevé du build d'avant, même base) ;
//   S4 vendeur Leboncoin seul ⇒ aucun sélecteur ; S5 plus aucun filtre de site local (FiltreSites, menu des sites).
// `MUTATION=local` : le choix n'est plus partagé (chaque écran repart de « Tous ») ⇒ S2 rougit.
async function selecteur() {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  let rouges = 0; const dit = (ok, quoi, d) => { if (!ok) rouges++; console.log((ok ? '  ✅ ' : '  ❌ ') + quoi + (ok || d === undefined ? '' : ' — ' + JSON.stringify(d).slice(0, 300))); };
  const multi = () => ajouterSite(ajouterSite(E.baseFiches(), 'leboncoin'), 'ebay');
  const lire = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-selecteur-site]'); const t = document.querySelector('.vrm-tache');
    return { sel: s ? s.getAttribute('data-site-courant') : null, choix: s ? [...s.querySelectorAll('[data-site-choix]')].map((b) => b.getAttribute('data-site-choix')) : [],
      tache: t ? t.getAttribute('data-tache-site') : null, eg: (document.querySelector('[data-eg-ecran][data-eg-site]') || { getAttribute: () => null }).getAttribute('data-eg-site'),
      // À l'ordinateur, le tableau de travail : chaque rangée dit ses sites (`data-eg-sites`).
      egSites: [...document.querySelectorAll('[data-eg-article]')].map((x) => x.getAttribute('data-eg-sites') || ''),
      tuiles: [...document.querySelectorAll('.n-tuile-valeur')].map((x) => x.textContent.trim()),
      locaux: document.querySelectorAll('[data-eg-filtre], [data-vn-plateforme], .vrm-filtre-sites, [data-filtre-sites]').length }; });
  const aller = async (o, url) => { await o.pg.goto(`http://localhost:${P.PORT}/${url}`, { waitUntil: 'domcontentloaded' }); await P.pret(o.pg); await o.pg.waitForTimeout(ATTENTE); };
  try {
    for (const W of [390, 1512]) {
      console.log(`\n── sélecteur · ${W}`);
      const o = await P.ouvrir(nav, { W, sombre: false, b: multi(), url: '/?tab=journee', api: B.apiVolume });
      await o.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} }); await o.pg.reload({ waitUntil: 'domcontentloaded' }); await P.pret(o.pg); await o.pg.waitForTimeout(ATTENTE);
      const j0 = await lire(o.pg);
      fs.writeFileSync(path.join(SORTIE, `tuiles-tous-${W}.json`), JSON.stringify(j0.tuiles));
      if (process.env.AVANT) { let av = null; try { av = JSON.parse(fs.readFileSync(process.env.AVANT.replace('{W}', W), 'utf8')); } catch (_) {}
        dit(!!av && JSON.stringify(av) === JSON.stringify(j0.tuiles), `S3 ${W} « Tous » : les chiffres d'Aujourd'hui sont ceux d'avant`, { avant: av, apres: j0.tuiles }); }
      await aller(o, '?tab=ventes');
      const v0 = await lire(o.pg);
      dit(v0.sel === 'toutes' && v0.choix.join(',') === 'toutes,vinted,leboncoin,ebay', `S1 ${W} Ventes : le sélecteur, « Tous » + les sites reliés`, v0);
      await o.pg.locator('[data-selecteur-site] [data-site-choix="leboncoin"]').first().click({ timeout: 5000 }).catch(() => {});
      await o.pg.waitForTimeout(1500);
      if (MUT === 'local') await o.pg.evaluate(() => { try { localStorage.removeItem('vrm_site_courant'); } catch (_) {} });
      const v1 = await lire(o.pg);
      dit(v1.sel === 'leboncoin' && v1.tache === 'leboncoin', `S2 ${W} Ventes suit le choix (Leboncoin)`, v1);
      for (const [url, cle] of [['?tab=journee', 'journee'], ['?tab=annonces', 'annonces'], ['?tab=achats', 'achats'], ['?tab=messages', 'messages']]) {
        await aller(o, url);
        const x = await lire(o.pg);
        const egOk = x.eg === 'leboncoin' || (W >= 1024 && x.egSites.length > 0 && x.egSites.every((v) => v.split(',').includes('leboncoin')));
        const ok = x.sel === 'leboncoin' && (cle === 'journee' || (cle === 'annonces' ? egOk : x.tache === 'leboncoin'));
        dit(ok, `S2 ${W} ${cle} s'ouvre sur Leboncoin`, x);
        dit(x.locaux === 0, `S5 ${W} ${cle} : aucun filtre de site local`, x.locaux);
        await o.pg.screenshot({ path: path.join(SORTIE, 'ecrans', `selecteur-${cle}-${W}.png`) }).catch(() => {});
      }
      await aller(o, '?tab=ventes');
      await o.pg.locator('[data-selecteur-site] [data-site-choix="toutes"]').first().click({ timeout: 5000 }).catch(() => {});
      await o.pg.waitForTimeout(1200);
      await aller(o, '?tab=journee');
      // Les chiffres se lisent après la coque : attendre qu'ils soient LUS (plus « — » partout), 10 s au plus.
      await o.pg.waitForFunction(() => [...document.querySelectorAll('.n-tuile-valeur')].some((x) => x.textContent.trim() !== '—'), null, { timeout: 10000 }).catch(() => {});
      const j1 = await lire(o.pg);
      dit(j1.sel === 'toutes' && JSON.stringify(j1.tuiles) === JSON.stringify(j0.tuiles), `S3 ${W} revenu à « Tous » : les mêmes chiffres qu'au départ`, { j0: j0.tuiles, j1: j1.tuiles });
      dit(!o.erreurs.length, `${W} aucune erreur de page`, o.erreurs.slice(0, 3));
      await o.ctx.close();
      const o2 = await P.ouvrir(nav, { W, sombre: false, b: baseSite('leboncoin'), url: '/?tab=ventes', api: B.apiVolume });
      await o2.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} }); await o2.pg.reload({ waitUntil: 'domcontentloaded' }); await P.pret(o2.pg); await o2.pg.waitForTimeout(ATTENTE);
      const l = await lire(o2.pg);
      dit(l.sel === null, `S4 ${W} vendeur Leboncoin seul : aucun sélecteur`, l);
      await o2.ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(rouges ? `\n❌ sélecteur : ${rouges} rouge(s)` : '\n✅ sélecteur : tout est vert'); if (rouges) process.exitCode = 1;
}

// `--annonces` (20 nov., Julien : « améliore le visuel » + « divise par comptes ») : 3 comptes Vinted + 1 Leboncoin.
//   A1 un groupe par compte (Vinted d'abord, Leboncoin ensuite), chacun « N annonces » ; A2 aucune rangée ne dit « mini — » ni
//   « acheté — » ; un manque est une rangée en tête du groupe ; A3 pas de pastille teintée sous le titre (« Actions » = rond ⋯) ;
//   A4 le plein est détaché des onglets (≥ 12 px) ; A5 replier un compte tient après rechargement ; A6 une recherche ne montre
//   que les groupes qui ont un résultat ; A7 à 1512 : un intertitre par compte dans le tableau. Captures dans SORTIE/ecrans.
async function annoncesComptes() {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  let rouges = 0; const dit = (ok, quoi, d) => { if (!ok) rouges++; console.log((ok ? '  ✅ ' : '  ❌ ') + quoi + (ok || d === undefined ? '' : ' — ' + JSON.stringify(d).slice(0, 400))); };
  const base = () => ajouterSite(E.baseFiches(), 'leboncoin');
  const lire = (pg) => pg.evaluate(() => {
    const gs = [...document.querySelectorAll('[data-eg-liste] [data-eg-groupe]')].map((g) => ({ cle: g.getAttribute('data-eg-groupe'), n: Number(g.getAttribute('data-eg-groupe-n')), tete: (g.querySelector('.n-groupe-tete') || g).innerText.replace(/\s+/g, ' ').trim(), rangees: g.querySelectorAll('[data-eg-article]').length, manque: !!g.querySelector('[data-eg-manque]'), ouvert: !!g.querySelector('.n-groupe-carte') }));
    const rangees = [...document.querySelectorAll('[data-eg-liste] [data-eg-article]')].map((e) => e.textContent);
    const teintes = document.querySelectorAll('[data-eg-tete] .n-bouton[data-n-variante="teinte"]').length;
    const plein = document.querySelector('[data-eg-publier]'); const onglets = document.querySelector('.n-onglets');
    const ecart = plein && onglets ? Math.round(onglets.getBoundingClientRect().top - plein.getBoundingClientRect().bottom) : null;
    const inter = [...document.querySelectorAll('.n-tt-intertitre')].map((x) => x.getAttribute('data-tt-groupe'));
    const comptesVus = [...new Set([...document.querySelectorAll('tr[data-eg-compte]')].map((x) => x.getAttribute('data-eg-compte')))];
    return { gs, rangees, teintes, ecart, actions: !!document.querySelector('[data-eg-actions].n-bouton-icone-seule, [data-eg-actions]'), inter, comptesVus };
  });
  try {
    for (const [W, th] of [[390, 'clair'], [390, 'sombre'], [1512, 'clair']]) {
      console.log(`\n── Annonces par compte · ${W} · ${th}`);
      const o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: base(), url: '/?tab=annonces', api: B.apiVolume });
      await o.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_annonces_replis'); } catch (_) {} }); await o.pg.reload({ waitUntil: 'domcontentloaded' }); await P.pret(o.pg); await o.pg.waitForTimeout(ATTENTE + 1500);
      const r = await lire(o.pg);
      await o.pg.screenshot({ path: path.join(SORTIE, 'ecrans', `annonces-comptes-${W}-${th}.png`) }).catch(() => {});
      if (W < 1024) {
        const cles = r.gs.map((g) => g.cle);
        const iL = cles.findIndex((c) => c.startsWith('leboncoin:')), iV = cles.map((c, i) => (c.startsWith('vinted:') ? i : -1)).filter((i) => i >= 0);
        dit(r.gs.length >= 4 && iV.length >= 3 && iL > Math.max(...iV), `A1 ${W} ${th} : un groupe par compte, Vinted puis Leboncoin (${cles.join(', ')})`, r.gs);
        dit(r.gs.every((g) => /\d+ annonces?/i.test(g.tete) && g.n >= 1), `A1 ${W} ${th} : chaque en-tête dit « N annonces »`, r.gs.map((g) => g.tete));
        dit(r.rangees.length > 0 && r.rangees.every((t) => !/mini —|acheté —/.test(t)), `A2 ${W} ${th} : aucune rangée ne répète « mini — » / « acheté — »`, r.rangees.find((t) => /mini —|acheté —/.test(t)));
        dit(r.teintes === 0 && r.actions, `A3 ${W} ${th} : aucune pastille teintée sous le titre ; « Actions » est un rond ⋯`, r);
        dit(r.ecart == null || r.ecart >= 12, `A4 ${W} ${th} : le plein est détaché des onglets (${r.ecart} px)`, r.ecart);
        if (th === 'clair') {
          const premier = r.gs[0] && r.gs[0].cle;
          await o.pg.locator(`[data-eg-groupe="${premier}"] .n-groupe-repli`).first().click({ timeout: 4000 }).catch(() => {});
          await o.pg.reload({ waitUntil: 'domcontentloaded' }); await P.pret(o.pg); await o.pg.waitForTimeout(ATTENTE + 1500);
          const r2 = await lire(o.pg);
          const g2 = r2.gs.find((g) => g.cle === premier);
          dit(!!g2 && !g2.ouvert && r2.gs.filter((g) => g.cle !== premier).every((g) => g.ouvert), `A5 ${W} : « ${premier} » replié, gardé après rechargement`, r2.gs);
          await o.pg.locator(`[data-eg-groupe="${premier}"] .n-groupe-repli`).first().click({ timeout: 4000 }).catch(() => {});
          await o.pg.locator('[data-eg-ecran] input[type="search"], [data-eg-ecran] .n-champ input, .n-page-recherche input').first().fill('Vans Old Skool taille 41').catch(() => {});
          await o.pg.waitForTimeout(1200);
          const r3 = await lire(o.pg);
          dit(r3.gs.length >= 1 && r3.gs.every((g) => g.rangees > 0) && r3.gs.length < r.gs.length + 1, `A6 ${W} : la recherche ne montre que les groupes qui ont un résultat (${r3.gs.map((g) => g.cle + ':' + g.rangees).join(', ')})`, r3.gs);
          await o.pg.screenshot({ path: path.join(SORTIE, 'ecrans', `annonces-comptes-${W}-recherche.png`) }).catch(() => {});
        }
      } else {
        // Le tableau montre ses 50 premières lignes : un intertitre pour CHAQUE compte qu'elles portent, dans l'ordre.
        dit(r.inter.length >= 1 && r.inter.join('|') === r.comptesVus.join('|'), `A7 ${W} : un intertitre par compte montré dans le tableau (${r.inter.join(', ')})`, r);
      }
      dit(!o.erreurs.length, `${W} ${th} : aucune erreur de page`, o.erreurs.slice(0, 3));
      await o.ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(rouges ? `\n❌ annonces par compte : ${rouges} rouge(s)` : '\n✅ annonces par compte : tout est vert'); if (rouges) process.exitCode = 1;
}

// `--sites` (20 nov., Julien : « pour toutes les plateformes tout doit être parfait » ; « même squelette, le contenu s'adapte ») :
// une base Vinted (3 comptes) + Leboncoin + eBay + Vestiaire ; pour CHAQUE choix du sélecteur (Tous, Vinted, Leboncoin, eBay,
// Vestiaire) × les 5 onglets (Aujourd'hui, Annonces, Ventes, Achats, Argent) × (390 clair, 390 sombre, 1512 clair) : une capture,
// et le SQUELETTE relevé — grand titre, sélecteur (haut, bord, hauteur, site choisi), segments de la tâche (libellés, haut),
// bord gauche des groupes et des rangées, place du plein (écart à la barre d'onglets). PARITÉ : entre les 4 sites, le squelette
// d'un onglet est le même (tolérance 1 px) ; un écart est NOMMÉ et rougit. Planches : SORTIE/planche-sites-<fen>-<thème>.png
// (5 lignes = onglets, 5 colonnes = choix). `VARIANTES=390:clair,1512:clair` `ONGLETS=journee,annonces`.
const SITES_PLANCHE = ['toutes', 'vinted', 'leboncoin', 'ebay', 'vestiaire'];
const ONGLETS_PLANCHE = [['journee', '?tab=journee'], ['annonces', '?tab=annonces'], ['ventes', '?tab=ventes'], ['achats', '?tab=achats'], ['argent', '?tab=dashboard']];
function squelette() {
  const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const R = (e) => { if (!vis(e)) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top + scrollY), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) }; };
  const racine = document.querySelector('#vrm-contenu, .vrm-main') || document.body;
  const titre = [...document.querySelectorAll('.n-grand-titre, h1')].find(vis);
  const sel = document.querySelector('[data-selecteur-site]');
  const seg = [...racine.querySelectorAll('.n-segmente')].filter((x) => vis(x) && !x.closest('[data-selecteur-site]'))[0] || null;
  const minL = (q) => { const l = [...racine.querySelectorAll(q)].filter(vis).map((e) => Math.round(e.getBoundingClientRect().left)); return l.length ? Math.min(...l) : null; };
  // La PLACE du plein : sa bande (`.n-page-plein`) — le bouton lui-même peut porter sa raison dessous (« Coche un colis… »).
  const plein = [...document.querySelectorAll('.n-page-plein, [data-n-plein]')].find(vis) || [...document.querySelectorAll('[data-n-variante="plein"]')].find(vis);
  const onglets = document.querySelector('.n-onglets');
  return {
    titre: titre ? { txt: titre.innerText.trim().slice(0, 30), ...R(titre) } : null,
    sel: sel ? { site: sel.getAttribute('data-site-courant'), ...R(sel) } : null,
    seg: seg ? { libelles: [...seg.querySelectorAll('.n-segmente-libelle')].map((x) => x.textContent.trim()), ...R(seg) } : null,
    bordGroupes: minL('.n-groupe-carte, .n-carte-corps, .n-tt-cadre, .vrm-buy-list, [data-achats-site] .n-groupe-carte'), bordRangees: minL('.n-rangee, .n-tt-tr, .vrm-buy-row, .vrm-buy-list > *'),   // (les achats Vinted d'avant comptent : même bord)
    plein: plein ? { ecartOnglets: onglets && vis(onglets) ? Math.round(onglets.getBoundingClientRect().top - plein.getBoundingClientRect().bottom) : null, l: Math.round(plein.getBoundingClientRect().left), w: Math.round(plein.getBoundingClientRect().width) } : null,
    debord: document.documentElement.scrollWidth > innerWidth + 1,
  };
}
async function sitesPlanches() {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const base = () => ['leboncoin', 'ebay', 'vestiaire'].reduce((b, s) => ajouterSite(b, s), E.baseFiches());
  const variantes = liste('VARIANTES', '390:clair,390:sombre,1512:clair').map((v) => v.split(':'));
  const ongletsVoulus = liste('ONGLETS', ONGLETS_PLANCHE.map((o) => o[0]).join(','));
  const releve = [];
  let rouges = 0; const dit = (ok, quoi, d) => { if (!ok) rouges++; console.log((ok ? '  ✅ ' : '  ❌ ') + quoi + (ok || d === undefined ? '' : ' — ' + JSON.stringify(d).slice(0, 500))); };
  try {
    for (const [fen, th] of variantes) for (const site of SITES_PLANCHE) {
      const o = await P.ouvrir(nav, { W: Number(fen), sombre: th === 'sombre', b: base(), url: '/?tab=journee', api: B.apiVolume });
      await o.pg.evaluate((s) => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.setItem('vrm_site_courant', JSON.stringify(s)); } catch (_) {} }, site);
      for (const [cle, url] of ONGLETS_PLANCHE.filter((x) => ongletsVoulus.includes(x[0]))) {
        try {
          await o.pg.goto(`http://localhost:${P.PORT}/${url}`, { waitUntil: 'domcontentloaded' }); await P.pret(o.pg); await o.pg.waitForTimeout(ATTENTE);
          await o.pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast, .n-toast button')) t.click(); }).catch(() => {});
          await o.pg.waitForTimeout(300);
          const sq = await o.pg.evaluate(squelette);
          const f = path.join(SORTIE, 'ecrans', `site-${cle}-${site}-${fen}-${th}.png`);
          await o.pg.screenshot({ path: f }).catch(() => {});
          releve.push({ fen, th, site, onglet: cle, sq, erreurs: o.erreurs.slice(0, 3) });
          console.log(`· ${fen} ${th} ${site} ${cle} : titre ${sq.titre ? sq.titre.txt : '—'} · sélecteur ${sq.sel ? sq.sel.site + '@' + sq.sel.t : '—'} · segments ${sq.seg ? sq.seg.libelles.join('/') : '—'} · bords ${sq.bordGroupes}/${sq.bordRangees} · plein ${sq.plein ? sq.plein.ecartOnglets : '—'}`);
        } catch (e) { console.log(`❌ ${fen} ${th} ${site} ${cle} : ${String(e.message || e).slice(0, 160)}`); }
      }
      await o.ctx.close();
      fs.writeFileSync(path.join(SORTIE, 'sites.json'), JSON.stringify(releve, null, 1));
    }
    // PARITÉ du squelette entre les 4 sites (Tous a le sien : la même chose, sans sélection de site).
    console.log('\n── Parité du squelette (Vinted · Leboncoin · eBay · Vestiaire)');
    const t1 = (a, b) => a == null || b == null ? a === b : Math.abs(a - b) <= 1;
    for (const [fen, th] of variantes) for (const cle of ongletsVoulus) {
      const l = releve.filter((r) => r.fen === fen && r.th === th && r.onglet === cle && r.site !== 'toutes');
      if (l.length < 2) continue;
      const ref = l[0].sq; const ecarts = [];
      for (const r of l.slice(1)) {
        const q = r.sq, n = r.site;
        if (!!q.titre !== !!ref.titre || (q.titre && !t1(q.titre.t, ref.titre.t))) ecarts.push(n + ' : titre');
        if (!!q.sel !== !!ref.sel || (q.sel && (!t1(q.sel.t, ref.sel.t) || !t1(q.sel.l, ref.sel.l) || !t1(q.sel.h, ref.sel.h)))) ecarts.push(n + ` : sélecteur ${q.sel ? q.sel.t : '—'} ≠ ${ref.sel ? ref.sel.t : '—'}`);
        if (!!q.seg !== !!ref.seg || (q.seg && (q.seg.libelles.join('/') !== ref.seg.libelles.join('/') || !t1(q.seg.t, ref.seg.t)))) ecarts.push(n + ' : segments ' + (q.seg ? q.seg.libelles.join('/') + '@' + q.seg.t : '—') + ' ≠ ' + (ref.seg ? ref.seg.libelles.join('/') + '@' + ref.seg.t : '—'));
        if (q.bordGroupes != null && ref.bordGroupes != null && !t1(q.bordGroupes, ref.bordGroupes)) ecarts.push(n + ` : bord des groupes ${q.bordGroupes} ≠ ${ref.bordGroupes}`);
        // Le bord des rangées se compare dans la colonne de lecture (la moitié gauche) : une rangée d'une colonne de droite (une
        // carte d'aide à l'ordinateur) n'est pas le bord de la liste.
        const gauche = (x) => x != null && x < Number(fen) * 0.4;
        if (gauche(q.bordRangees) && gauche(ref.bordRangees) && !t1(q.bordRangees, ref.bordRangees)) ecarts.push(n + ` : bord des rangées ${q.bordRangees} ≠ ${ref.bordRangees}`);
        if (q.plein && ref.plein && (!t1(q.plein.l, ref.plein.l) || !t1(q.plein.w, ref.plein.w) || !t1(q.plein.ecartOnglets, ref.plein.ecartOnglets))) ecarts.push(n + ' : place du plein');
        if (q.debord) ecarts.push(n + ' : page plus large que l\'écran');
        if (r.erreurs.length) ecarts.push(n + ' : erreur ' + r.erreurs[0]);
      }
      dit(!ecarts.length, `${fen} ${th} ${cle} : même squelette sur les 4 sites (réf. ${l[0].site})`, ecarts);
    }
    // Planches : une par variante, 5 lignes (onglets) × 5 colonnes (choix du sélecteur).
    for (const [fen, th] of variantes) {
      const tel = Number(fen) < 600;
      const img = (f) => (fs.existsSync(f) ? `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">` : '<i>—</i>');
      const lignes = ongletsVoulus.map((cle) => `<tr><th>${cle}</th>${SITES_PLANCHE.map((s) => `<td>${img(path.join(SORTIE, 'ecrans', `site-${cle}-${s}-${fen}-${th}.png`))}</td>`).join('')}</tr>`).join('');
      const html = `<!doctype html><meta charset="utf-8"><style>body{margin:12px;font:14px -apple-system,system-ui,sans-serif;background:#ccc}td{padding:4px;vertical-align:top}th{writing-mode:vertical-rl;transform:rotate(180deg)}img{width:${tel ? 390 : 756}px;display:block;border:1px solid #999}</style>
        <h1>Sélecteur × onglets · ${fen} · ${th}</h1><table><tr><th></th>${SITES_PLANCHE.map((s) => `<td><b>${s}</b></td>`).join('')}</tr>${lignes}</table>`;
      const f = path.join(SORTIE, `planche-sites-${fen}-${th}.html`); fs.writeFileSync(f, html);
      const ctx = await nav.newContext({ viewport: { width: tel ? 2050 : 3900, height: 1200 } }); const pg = await ctx.newPage();
      await pg.goto('file://' + f); await pg.screenshot({ path: path.join(SORTIE, `planche-sites-${fen}-${th}.png`), fullPage: true }); await ctx.close(); fs.unlinkSync(f);
      console.log('planche : ' + path.join(SORTIE, `planche-sites-${fen}-${th}.png`));
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(rouges ? `\n❌ parité des sites : ${rouges} écart(s)` : '\n✅ parité des sites : même squelette partout'); if (rouges) process.exitCode = 1;
}

if (require.main === module && process.argv[2] === '--sites') sitesPlanches();
else if (require.main === module && process.argv[2] === '--annonces') annoncesComptes();
else if (require.main === module && process.argv[2] === '--selecteur') selecteur();
else if (require.main === module && process.argv[2] === '--formes') formes(process.argv.slice(3));
else if (require.main === module && process.argv[2] === '--fusion') { const r = lireDossiers(process.argv.slice(3)); ecrire(r); console.log(tableau(r.map(resumer))); }
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

module.exports = { mesurer, TOUS, baseVide, baseSite };
