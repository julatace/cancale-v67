require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA PASSE DESIGN 3 (14 nov.) — les restes nommés par la passe 2
//  (docs/passation/2026-11-14-design-passe-2.md §5 ; récit : 2026-11-14-design-passe-3.md).
//
//  La MÊME mesure que les deux premières passes (A–I de `design-passe.cjs`, J de
//  `design-passe-2.cjs` — leurs fonctions, rien de recopié), PLUS ce que les captures de la
//  passe 2 ont montré sans qu'une mesure le voie :
//    K bande      — à l'ordinateur, la bande « CA finalisé — · En attente — » d'un site (`[data-plat-resume]`)
//                   est posée dans la colonne (son bord gauche = celui du titre), jamais flottante à droite ;
//    L natif      — aucun `<select>` natif NU (règle 3 : un choix est un composant du système) : un `<select>` qui
//                   reste (un filtre de compte) est au moins habillé en capsule remplie, sans cadre ;
//    M rectangle  — un contrôle qui SE TOUCHE et porte sa propre surface (fond ou cadre) est une capsule
//                   (rayon ≥ la moitié de sa hauteur) : jamais un rectangle encadré (« les jours calmes ») ;
//    N barreVide  — une barre de délai n'est dessinée que si l'on sait le délai (pas de piste vide sous
//                   « Date limite inconnue », « Vérification en cours », « point changé ») ;
//    O grisGras   — un texte GRIS n'est jamais un titre : pas de gris ≥ 15 px en 600/700 (« Code sur Vinted »
//                   17/600 gris) — la hiérarchie vient de la taille et de la graisse, le gris est une note ;
//    P fraicheur  — la ligne de fraîcheur (« Tout est à jour · vérifié… ») est une ligne : ni cadre, ni fond,
//                   ni ombre ;
//    Q cadre      — une surface (carte, encart) n'a pas de cadre (bord 1 px sur trois côtés ou plus, ou
//                   liseré clair la nuit) : la carte du système est un fond et une ombre posée ;
//    R carteDansCarte — une carte à ombre posée n'est jamais DANS une autre carte à ombre posée (elle
//                   devient une case : sans ombre, rayon 12).
//  Écrans : les sous-pages de Paramètres que la passe 2 n'a pas mesurées (`SOUS=`), Notifications
//  (push), Achats (la ligne de retrait, son détail ouvert, le menu « ⋯ », la feuille « note »), Ventes
//  (la feuille d'une vente), un e-mail ouvert, un fil de Messages ouvert, Leboncoin / eBay / Vestiaire
//  (la bande), le parcours plein écran et la carte de démarrage, et les écrans de la première passe
//  (Ma journée, Ventes, Colis, Annonces, Stock, Argent) pour la ligne de fraîcheur.
//  390 tactile ET 1512, clair ET sombre, deviceScaleFactor 1. Base INVENTÉE, garde réseau.
//  `ECRANS=` `LARGEURS=` `THEMES=` `SOUS=` ; `BANC_DIST=` (avant/après) ; `SHOTS=` ; `SUITE=2` défile.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const P = require('./design-passe.cjs');
const D2 = require('./design-passe-2.cjs');
const { base } = P;
const { lancer, baseSites, toucher, attendre, APP, EMAILS } = D2;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const CLES3 = ['bande', 'natif', 'rectangle', 'barreVide', 'grisGras', 'fraicheur', 'cadre', 'carteDansCarte'];
const CLES = [...P.CLES, 'numDouble', ...CLES3];

// Les sous-pages de Paramètres que la passe 2 n'a pas mesurées (+ « push », Notifications, le reste nommé) ; [vue, id].
const SOUS = liste('SOUS', [
  'reglages:push', 'reglages:sante', 'reglages:santecomptes', 'reglages:historique', 'reglages:discretion', 'reglages:copieannonces',
  'reglages:ebay', 'reglages:sms-colis', 'reglages:import', 'reglages:agenda', 'reglages:mes-plateformes', 'reglages:affichage-mode',
  'reglages:ma-journee', 'reglages:objectif-mois', 'reglages:je-vends', 'reglages:stream', 'reglages:zoom', 'reglages:raccourcis-siri',
  'reglages:securite', 'reglages:importer', 'reglages:revenir', 'reglages:corbeille', 'reglages:verifier',
  'compte:equipe', 'compte:journal-vrm', 'compte:tes-donnees', 'compte:conditions', 'compte:fermer',
].join(',')).map((x) => x.split(':'));

// ── La mesure de la passe 3, DANS la page (K–R). ──
function mesurer3({ racines }) {
  const out = { bande: [], natif: [], rectangle: [], barreVide: [], grisGras: [], fraicheur: [], cadre: [], carteDansCarte: [] };
  const roots = [...new Set(racines.flatMap((s) => [...document.querySelectorAll(s)]))].filter((r) => !racines.some((s) => r.parentElement && r.parentElement.closest(s)));
  const vis = (el) => {
    if (!el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    if (el.closest('[inert], .vrm-sr-only, .sr-only, [aria-hidden="true"]')) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };
  const nom = (el) => {
    const c = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const d = [...el.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 1).map((a) => `[${a.name}]`).join('');
    const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 34);
    return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${d} « ${t} »`;
  };
  const rgba = (s) => {
    const t = String(s || '');
    const c = t.match(/color\(srgb ([^)]+)\)/); if (c) { const p = c[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    const m = t.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const px = (v, h) => { const s = String(v || '0'); return /%$/.test(s) ? (parseFloat(s) / 100) * h : parseFloat(s) || 0; };
  // Les ombres d'un élément : un « liseré » (0 0 0 Npx, clair ou foncé) et une ombre portée (flou > 0).
  const ombres = (cs) => {
    const s = cs.boxShadow; if (!s || s === 'none') return { porte: false, lisere: null };
    const parts = s.split(/,(?![^()]*\))/).map((x) => x.trim());
    let porte = false, lisere = null;
    for (const p of parts) {
      if (/inset/.test(p)) continue;
      const col = rgba(p); const n = (p.replace(/rgba?\([^)]*\)|color\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
      const [x = 0, y = 0, flou = 0, ext = 0] = n;
      if (!col || col.a < 0.02) continue;
      if (flou > 0) porte = true; else if (ext > 0 && !x && !y && col.a >= 0.06) lisere = { c: hex(col), a: Math.round(col.a * 100) / 100, ext };
    }
    return { porte, lisere };
  };
  const flottant = (el) => !!el.closest('.vrm-fs-cadre, [role="menu"], [role="dialog"]:not([data-parcours]), [role="tooltip"], .vrm-pop, [data-recherche-panneau]') || ['fixed', 'absolute', 'sticky'].includes(getComputedStyle(el).position);
  const bordsVus = (cs) => ['Top', 'Right', 'Bottom', 'Left'].filter((c) => { const w = parseFloat(cs[`border${c}Width`]); const col = rgba(cs[`border${c}Color`]); return w >= 0.9 && cs[`border${c}Style`] !== 'none' && col && col.a > 0.1; });
  const opaque = (cs) => { const c = rgba(cs.backgroundColor); return !!(c && c.a > 0.5); };
  const gris = new Set(['#6E6E73', '#98989D']);
  const large = innerWidth >= 1024;
  // K. la bande des chiffres d'un site (document entier : elle vit sous `.vrm-main`).
  if (large) for (const b of document.querySelectorAll('[data-plat-resume]')) {
    if (!vis(b)) continue;
    const bande = b.querySelector('.vrm-summary-strip') || b;
    const titre = [...document.querySelectorAll('.vrm-main :is(.vrm-tache-tete h1, .vrm-screen-head .vrm-display, .vrm-market-heading h1)')].find(vis);
    if (!titre) continue;
    if (bande.closest('.vrm-screen-actions, .vrm-tache-tete')) continue;
    // Le bord gauche du TEXTE de la bande (sa première case) contre celui du titre.
    const premier = bande.querySelector(':scope > div') || bande;
    const g = Math.round(premier.getBoundingClientRect().left), t = Math.round(titre.getBoundingClientRect().left);
    if (Math.abs(g - t) > 4) out.bande.push({ gauche: g, titre: t, quoi: nom(b) });
  }
  const cartes = [];
  for (const root of roots) {
    // L. `<select>` natif.
    for (const s of root.querySelectorAll('select')) {
      if (!vis(s)) continue;
      const cs = getComputedStyle(s), r = s.getBoundingClientRect(), f = rgba(cs.backgroundColor);
      const capsule = px(cs.borderTopLeftRadius, r.height) + 1 >= r.height / 2 && !bordsVus(cs).length && f && f.a > 0.04;
      if (!capsule) out.natif.push({ quoi: nom(s) + ' ' + ([...s.options].map((o) => o.text).slice(0, 3).join('/')) });
    }
    // M. contrôles à surface propre : capsule.
    for (const el of root.querySelectorAll('button, [role="button"], [role="switch"], [role="radio"], [role="checkbox"], [role="tab"], summary, a.vrm-b, label:has(> input[type="checkbox"]), label:has(> input[type="radio"]), label:has(input[type="file"])')) {
      if (!vis(el) || el.closest('svg')) continue;
      const r = el.getBoundingClientRect();
      // Un contrôle (≤ 52 px de haut, ≤ 260 de large) — une tuile de choix plus haute est une carte, pas une capsule.
      if (r.height > 52 || r.width > 260 || el.querySelector('img, canvas, video, picture')) continue;
      const cs = getComputedStyle(el);
      const fondC = rgba(cs.backgroundColor);
      // (un cadre peut être un anneau INTÉRIEUR — `inset 0 0 0 1px` — : c'est aussi une surface)
      const anneau = /inset/.test(cs.boxShadow || '') && (cs.boxShadow.split(/,(?![^()]*\))/).some((p) => /inset/.test(p) && (rgba(p) || { a: 0 }).a >= 0.06));
      const surface = (fondC && fondC.a > 0.04) || bordsVus(cs).length >= 3 || anneau;
      if (!surface) continue;
      const rayon = Math.min(px(cs.borderTopLeftRadius, r.height), px(cs.borderBottomRightRadius, r.height));
      if (rayon + 1 < r.height / 2) out.rectangle.push({ h: Math.round(r.height), rayon: Math.round(rayon), quoi: nom(el) });
    }
    // N. barre de délai sans délai su.
    for (const d of root.querySelectorAll('[data-rp-delai]')) {
      const piste = d.querySelector('.vrm-rpf-delai-piste');
      if (!piste || !vis(piste)) continue;
      const code = d.getAttribute('data-rp-delai') || '', txt = (d.innerText || '').trim();
      if (['inconnue', 'point-change', 'verif-transporteur'].includes(code) || (Number(d.getAttribute('data-rp-delai-pct')) === 0 && !/\d/.test(txt))) out.barreVide.push({ code, txt });
    }
    // O. P. Q. R. — textes et surfaces.
    for (const el of root.querySelectorAll('*')) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const cs = getComputedStyle(el);
      // O. gris gras : un texte direct (pas un conteneur).
      const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
      // (un texte RECOUVERT — l'initiale sous la photo d'un acheteur — ne se lit pas : pas jugé)
      const dessus = () => { const b = el.getBoundingClientRect(); return ![...(el.parentElement ? el.parentElement.querySelectorAll('img') : [])].some((im) => { const a = im.getBoundingClientRect(); return vis(im) && a.left <= b.left + 1 && a.top <= b.top + 1 && a.right >= b.right - 1 && a.bottom >= b.bottom - 1; }); };
      if (direct && vis(el) && dessus()) {
        const col = rgba(cs.color), t = parseFloat(cs.fontSize), g = Number(cs.fontWeight);
        if (col && col.a > 0.9 && gris.has(hex(col)) && t >= 15 && g >= 600 && !/^[\s›‹×✓✕·•…—–\-+−⋯▾▸⌄⌃]+$/.test(el.innerText || '')) out.grisGras.push({ t, g, quoi: nom(el) });
      }
      if (!['DIV', 'SECTION', 'DETAILS', 'ARTICLE', 'LI', 'ASIDE', 'FORM', 'FIELDSET', 'UL', 'OL', 'HEADER', 'FOOTER', 'NAV', 'P', 'A', 'LABEL'].includes(el.tagName)) continue;
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      // P. la ligne de fraîcheur.
      if (el.classList.contains('vrm-fraicheur')) {
        const o = ombres(cs), fondC = rgba(cs.backgroundColor);
        if (o.porte || o.lisere || bordsVus(cs).length || (fondC && fondC.a > 0.04)) out.fraicheur.push({ ombre: cs.boxShadow.slice(0, 60), fond: cs.backgroundColor, quoi: nom(el) });
        continue;
      }
      if (r.width < 120 || r.height < 40) continue;
      if (el.closest('.vrm-sidebar, .vrm-topbar, .vrm-nav-bas, nav.vrm-bottom-nav')) continue;
      const o = ombres(cs);
      // Q. un cadre (bord sur trois côtés ou plus, ou liseré clair hors des surfaces flottantes).
      const b = bordsVus(cs);
      const zoneDepot = /dashed|dotted/.test(cs.borderTopStyle);
      // Un liseré (0 0 0 Npx, sans ombre portée) hors d'une surface flottante est un cadre (clair la nuit, gris le jour).
      if ((b.length >= 3 && !zoneDepot) || (o.lisere && !flottant(el) && !o.porte)) {
        if (!el.closest('[data-carte-sombre], .vrm-fu-carte, .vrm-fu-tete, .vrm-compta-carte')) out.cadre.push({ bords: b.join(''), lisere: o.lisere ? `${o.lisere.c}/${o.lisere.a}` : '', quoi: nom(el) });
      }
      // R. une carte (ombre posée, fond plein) DANS une carte.
      if (o.porte && opaque(cs) && !flottant(el)) cartes.push(el);
    }
  }
  for (const c of cartes) {
    for (let x = c.parentElement; x && x !== document.body; x = x.parentElement) {
      if (x.matches('.vrm-fs-cadre, [role="menu"], [role="dialog"], .vrm-main, .vrm-app-shell')) break;
      const cs = getComputedStyle(x);
      if (ombres(cs).porte && opaque(cs)) { out.carteDansCarte.push({ quoi: nom(c), dans: nom(x) }); break; }
    }
  }
  return out;
}

const enPlus = async (o) => o.pg.evaluate(mesurer3, { racines: o.__racines || APP });

// Les e-mails : la liste de la passe 2, et la LECTURE d'un e-mail (`lire=`, la forme de `boite-emails.cjs`).
const TEXTE = 'Bonjour,\n\nVotre colis 12345678 est disponible au Relais Tabac du Port.\nCode de retrait : 418205.\nIl vous attend jusqu’au 09/11/2026.\n\nMondial Relay';
const api = (u, req) => {
  const lire = (u.match(/[?&]lire=([^&]+)/) || [])[1];
  if (/\/api\/email-rattacher/.test(u) && lire) {
    const id = decodeURIComponent(lire); const e = EMAILS.find((x) => x.id === id) || EMAILS[0];
    return { ok: true, id, email: { ...e, receivedAt: e.at, pieces: [], texte: TEXTE, texteCoupe: false } };
  }
  return D2.api ? D2.api(u, req) : null;
};

const ouvrirSous = async (o, mesure, liste) => {
  for (const [vue, id] of liste) {
    await toucher(o, '[data-sous-retour]'); await o.pg.waitForTimeout(250);
    await toucher(o, `[data-onglets-reglages] [data-vue="${vue}"]`); await o.pg.waitForTimeout(400);
    if (!(await toucher(o, `[data-sous-ouvrir="${id}"]`))) { console.log(`  · reglages-${id} : pas de ligne « ${id} » dans la vue ${vue} (pas mesuré)`); continue; }
    await attendre(o.pg, () => o.pg.evaluate((i) => { const e = document.querySelector(`[data-sous-ecran="${i}"]`); return !!e && !e.hidden; }, id), 4000);
    await o.pg.waitForTimeout(700);
    await mesure(id, ['.vrm-set-nav', '.vrm-set-sous-h', `[data-sous-ecran="${id}"]`, '.vrm-fs']);
  }
};
const fermerFeuille = async (o) => {
  await o.pg.keyboard.press('Escape').catch(() => {}); await o.pg.waitForTimeout(450);
  if (await o.pg.$('.vrm-fs')) { await toucher(o, '[data-feuille-croix]'); await o.pg.waitForTimeout(400); }
  if (await o.pg.$('div[style*="z-index: 1360"]')) { await o.pg.mouse.click(4, 4); await o.pg.waitForTimeout(400); }
};

const ECRANS = [
  // La ligne de fraîcheur, sur les écrans de la première passe.
  ...[['journee', '/?tab=journee'], ['ventes', '/?tab=ventes'], ['colis', '/?tab=cat_bord'], ['annonces', '/?tab=annonces'], ['stock', '/?tab=garage'], ['argent', '/?tab=argent']]
    .map(([nom, url]) => ({ nom, url })),
  // K. la bande d'un site.
  { nom: 'leboncoin-annonces', url: '/?tab=annonces&site=leboncoin', base: baseSites },
  { nom: 'ebay-annonces', url: '/?tab=annonces&site=ebay', base: baseSites },
  { nom: 'vestiaire-annonces', url: '/?tab=annonces&site=vestiaire', base: baseSites },
  // Achats : la ligne de retrait, son détail, le menu « ⋯ », la feuille « note ».
  { nom: 'achats', url: '/?tab=achats', jouer: async (o, mesure) => {
    await mesure('', APP);
    if (await toucher(o, '.vrm-rpf-ouvrir')) { await o.pg.waitForTimeout(700); await o.pg.locator('[data-rp-detail]').first().scrollIntoViewIfNeeded().catch(() => {}); await mesure('retrait-ouvert', ['[data-rp-detail]', '.vrm-rpf-ligne[data-ouvert="1"]']); }
    else console.log('  · achats-retrait-ouvert : aucune ligne de retrait (pas mesuré)');
    await o.pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; });
    if (await toucher(o, '.vrm-buy-more')) {
      await o.pg.waitForSelector('.vrm-buy-menu', { timeout: 4000 }).catch(() => {}); await o.pg.waitForTimeout(400);
      await mesure('menu', ['.vrm-buy-menu']);
      const note = o.pg.locator('.vrm-buy-menu [role="menuitem"]', { hasText: /note/i }).first();
      if (await note.count()) {
        await note.click().catch(() => {}); await o.pg.waitForSelector('.vrm-fs, [data-note-achat]', { timeout: 4000 }).catch(() => {}); await o.pg.waitForTimeout(800);
        // (la fenêtre « Note interne » d'avant n'avait ni classe ni attribut : sa carte, mesurée par sa place)
        await mesure('note', ['.vrm-fs', '[data-note-achat]', 'div[style*="z-index: 1360"] > div[style*="max-width: 420px"]']);
        await fermerFeuille(o);
      } else console.log('  · achats-note : pas d’entrée « note » dans le menu (pas mesuré)');
    } else console.log('  · achats-menu : pas de « ⋯ » (pas mesuré)');
    // La feuille d'aide de l'écran (« ? » après la phrase).
    if (await toucher(o, '.vrm-main .vrm-phrase-ecran button')) { await o.pg.waitForSelector('.vrm-fs', { timeout: 4000 }).catch(() => {}); await o.pg.waitForTimeout(900); await mesure('aide', ['.vrm-fs']); await fermerFeuille(o); }
  } },
  // Ventes : la feuille d'une vente (toucher une ligne : `aria-haspopup="dialog"`, son panneau `aria-controls`), et l'aide.
  { nom: 'ventes-feuilles', url: '/?tab=ventes&site=vinted', jouer: async (o, mesure) => {
    const id = await o.pg.evaluate(() => { const b = [...document.querySelectorAll('.vrm-main .vrm-ledger-sale-toggle')].find((x) => x.getClientRects().length); if (!b) return null; b.scrollIntoView({ block: 'center' }); return b.getAttribute('aria-controls'); });
    if (id && await toucher(o, `.vrm-main .vrm-ledger-sale-toggle[aria-controls="${id}"]`)) {
      await o.pg.waitForTimeout(1200);
      await mesure('vente', [`[id="${id}"]`]);
      await fermerFeuille(o);
    } else console.log('  · ventes-vente : aucune ligne de vente (pas mesuré)');
    await o.pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
    if (await toucher(o, '.vrm-main .vrm-phrase-ecran button')) { await o.pg.waitForSelector('.vrm-fs', { timeout: 4000 }).catch(() => {}); await o.pg.waitForTimeout(900); await mesure('aide', ['.vrm-fs']); await fermerFeuille(o); }
  } },
  // Un e-mail ouvert.
  { nom: 'email', url: '/?tab=emails', jouer: async (o, mesure) => {
    await o.pg.waitForSelector('[data-boite-email]', { timeout: 8000 }).catch(() => {});
    if (await toucher(o, '[data-boite-email]')) {
      await o.pg.waitForSelector('[data-boite-lecture] [data-boite-sujet]', { timeout: 6000 }).catch(() => {}); await o.pg.waitForTimeout(900);
      await mesure('ouvert', ['[data-boite-feuille]', '[data-boite-lecture]']);
    } else console.log('  · email-ouvert : aucune ligne (pas mesuré)');
  } },
  // Un fil de Messages ouvert.
  { nom: 'messages', url: '/?tab=messages', jouer: async (o, mesure) => {
    await o.pg.waitForSelector('.vrm-inbox-row', { timeout: 8000 }).catch(() => {});
    if (await toucher(o, '.vrm-inbox-row')) { await o.pg.waitForTimeout(1500); await mesure('fil', ['.vrm-main', '.vrm-fs', '.vrm-chat-panel']); }
    else console.log('  · messages-fil : aucune conversation (pas mesuré)');
  } },
  // Paramètres : les sous-pages (Notifications d'abord).
  { nom: 'reglages', url: '/?tab=settings', jouer: (o, mesure) => ouvrirSous(o, mesure, SOUS) },
  { nom: 'demarrage', url: '/?tab=journee', base: () => D2.baseNeuve(false), attendre: '[data-parcours-carte]', racines: ['[data-parcours-carte]'] },
  { nom: 'parcours', url: '/?tab=journee', base: () => D2.baseNeuve(true), attendre: '[data-parcours]', racines: ['[data-parcours]'] },
];
// Les racines de chaque mesure servent aussi aux mesures K–R (la mesure les pose sur `o`).
for (const E of ECRANS) {
  if (E.jouer) { const j = E.jouer; E.jouer = (o, mesure) => j(o, (sous, racines) => { o.__racines = racines; return mesure(sous, racines); }); }
  else { const r = E.racines || APP; E.jouer = (o, mesure) => { o.__racines = r; return mesure('', r); }; }
}

module.exports = { mesurer3, CLES3 };
if (require.main === module) lancer(ECRANS.filter((E) => true), { cles: CLES, nomRapport: 'rapport-3.json', enPlus, api }).catch((e) => { console.error(e); process.exit(2); });
