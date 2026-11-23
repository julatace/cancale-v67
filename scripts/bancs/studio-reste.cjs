require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC : STUDIO BLEU CLAIR — LES ÉCRANS « RESTE » (14 nov.)
//         npm run build && node scripts/bancs/studio-reste.cjs
//
//  Julien (14 nov.) a choisi la direction t25 « Studio bleu clair » : quatre formes de
//  bouton, un seul bouton plein par écran, aucun bouton inutile, rien ne disparaît.
//  Ce banc rend l'app sur une base INVENTÉE au volume réel (`_base-messages-stock.cjs` :
//  3 comptes, 1 000 conversations, 1 000 e-mails, 1 000 paires) et juge, à 390 tactile
//  et à 1512, en clair et en sombre, chaque écran du chantier :
//
//    S1 la MATIÈRE Studio est posée (racine `data-espace`, fond bleu clair, cartes en
//       porcelaine) — rouge sur le build d'avant ;
//    S2 au plus UN bouton plein (fond = l'encre, la forme (a)) visible sur l'écran ;
//    S3 QUATRE FORMES : chaque bouton visible est (a) plein · (b) touche · (c) rond ·
//       (d) lien — ou une rangée / tuile entière qu'on touche ; un bouton hors des quatre
//       est NOMMÉ (pastille pleine bleue, capsule grise à bord, bouton de 30 px…) ;
//    S4 CONTRASTE AA : chaque texte ≥ 4,5:1 (3:1 grand texte) contre son fond EFFECTIF,
//       dégradés compris (le pire arrêt du dégradé) ;
//    S5 RIEN NE DÉBORDE (page, cartes, tuiles) ;
//    S6 L'INVENTAIRE : chaque geste relevé sur le build d'avant (data-*, nom lu, texte)
//       est encore dans l'écran (`BANC_INVENTAIRE=f` l'écrit depuis `BANC_DIST=<avant>`,
//       `BANC_REFERENCE=f` l'exige) — un geste rangé (« ⋯ », repli, segment caché) compte ;
//    S7 aucune erreur JS, jamais « encaissé », jamais « au moins 0 », ni NaN.
//
//  `ECRANS=compta,messages` · `LARGEURS=390` · `THEMES=clair` restreignent ;
//  `SHOTS=<dossier>` écrit les captures. Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const SHOTS = process.env.SHOTS || '';
const INV_OUT = process.env.BANC_INVENTAIRE || '';
// L'inventaire d'avant (relevé sur origin/claude/integration-refonte, base inventée) est versionné à côté du banc.
const INV_REF = INV_OUT ? null : (process.env.BANC_REFERENCE ? JSON.parse(fs.readFileSync(process.env.BANC_REFERENCE, 'utf8')) : require('./studio-reste-inventaire.cjs'));
const LARG = String(process.env.LARGEURS || '390,1512').split(',').map(Number);
const THEMES = String(process.env.THEMES || 'clair,sombre').split(',');

// Les écrans du chantier : leur adresse, leur racine, et le geste qui ouvre une vue de plus. La racine d'un écran de
// l'app est le cadre que pose la coque autour de lui (`data-attente-ecran`), le même sur le build d'avant : les bandeaux
// de la coque (fraîcheur, « Mis à jour ») sont hors de lui.
const RAC = '.vrm-attente[data-attente-ecran]';
const ECRANS = {
  compta: { url: '/?tab=compta', racine: RAC },
  declarer: { url: '/?tab=argent_declarer', racine: RAC },
  factures: { url: '/?tab=invoices', racine: RAC },
  stats: { url: '/?tab=dashboard', racine: RAC },
  messages: { url: '/?tab=messages', racine: RAC },
  // (16 nov., Messages « Verre dépoli ») une conversation est une rangée `[data-fil]`, plus `.vrm-inbox-row`.
  conversation: { url: '/?tab=messages', racine: '.vrm-chat-panel', avant: async (pg) => { await pg.locator('.vrm-inbox-row, [data-fil]').first().click(); await pg.waitForTimeout(1600); } },
  // (16 nov., Paramètres en tuiles, maquette validée le 15 nov.) le premier écran montre les catégories ; leurs rangées
  // vivent DANS chaque catégorie : l'inventaire (S6) est l'union du premier écran et de chaque catégorie ouverte.
  settings: { url: '/?tab=settings', racine: RAC, categories: true },
  securite: { url: '/?tab=settings', racine: RAC, avant: async (pg) => {
    // « Sécurité des données » (son vocabulaire technique est gardé, §5) : Réglages, sinon Mon compte.
    for (const vue of [null, 'compte']) {
      if (vue) { await pg.locator(`[data-vue="${vue}"]`).first().click().catch(() => {}); await pg.waitForTimeout(800); }
      // le groupe « Sécurité et sauvegarde » est replié dans les options avancées
      const av = pg.locator('[data-reglages-avances="sauvegarde"] > summary');
      if (await av.count() && await av.first().isVisible()) { await av.first().click().catch(() => {}); await pg.waitForTimeout(500); }
      const l = pg.locator('[data-sous-ouvrir="securite"]');
      if (await l.count() && await l.first().isVisible()) { await l.first().click(); await pg.waitForTimeout(1800); return; }
    }
  } },
  communaute: { url: '/?tab=communaute', racine: RAC },
  emails: { url: '/?tab=emails', racine: RAC },
  connexion: { url: '/?connexion', racine: '[data-connexion]', sansSession: true },
};
// Les gestes d'avant qu'on a RETIRÉS EXPRÈS, chacun avec la place où il vit maintenant (Règles des boutons, note t25) :
const RANGES = [
  /^data-reglage-sombre=(on|off)$/,   // (16 nov., lot apparence-rangee — décidé par Julien) l'interrupteur « Mode sombre » doublait « Apparence » : data-apparence=clair|sombre (même catégorie)
  /^texte:\+ Nouvelle facture$/,   // le doublon de l'état vide de Factures : le geste est le plein en tête (data-fac-principal)
  // (16 nov.) Paramètres en catégories (maquette validée le 15 nov., docs/passation/2026-11-15-ecrans-verre-2.md) : ces rangées
  // nommées par leur TEXTE portent maintenant leur identité (`data-reglage-id`), le même geste dans sa catégorie :
  /^texte:Mon compte$/,   // la carte « Mon compte » en tête (data-categorie-ouvrir=compte, data-vue=compte)
  /^texte:Réglages$/,   // l'ancien segment Réglages · Mon compte : le premier écran EST les catégories (data-categorie-ouvrir)
  /^texte:Abonnement$/,   // data-reglage-abonnement (data-reglage-id=abonnement), catégorie Mon compte
  /^texte:Compléter les prix d'achat/,   // data-reglage-id=prixachat, catégorie Argent
  /^texte:Comptes liés/,   // data-reglage-id=liens, catégorie Mes plateformes
  /^texte:Restaurer une sauvegarde/,   // data-reglage-id=restaurer, catégorie Sécurité des données
  /^repli:texte:Réglages avancésSécurité et sauvegarde/,   // le repli est devenu la catégorie « Sécurité des données » (data-categorie-ouvrir=donnees)
];
// Les gestes qui n'apparaissent qu'APRÈS une lecture asynchrone (la même place, le même geste — présents ou non
// selon que la lecture a répondu avant la mesure, sur une machine chargée) :
const VOLATILS = [
  /^repli:texte:Points à vérifier/,   // Paramètres → Suivi des comptes : le repli naît quand la capture des comptes est lue
  /^texte:V?vendeur_#/,   // la jauge du compte (pseudo inventé « vendeur_N ») : son libellé DIT un état lu à la volée (« Calme · N gestes », « … »), même bouton
];
const VOULUS = String(process.env.ECRANS || Object.keys(ECRANS).join(',')).split(',');
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 700) : ''}`); };

// ── La mesure, DANS la page ────────────────────────────────────────────────────
function mesurer({ racine, tactile }) {
  // La racine VISIBLE (la coque garde d'autres écrans montés, cachés) ; la plus grande d'abord.
  const roots = [...document.querySelectorAll(racine)].filter((r) => r.getClientRects().length && r.getBoundingClientRect().height > 2)
    .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height).slice(0, 1);
  const vis = (el) => {
    if (!el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    if (el.closest('[inert], .vrm-sr-seul, .vrm-sr-only, .sr-only')) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };
  const rgbs = (s) => [...String(s || '').matchAll(/rgba?\(([^)]+)\)|color\(srgb ([^)]+)\)/g)].map((m) => {
    if (m[2]) { const p = m[2].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const melange = (h, bas) => ({ r: h.r * h.a + bas.r * (1 - h.a), g: h.g * h.a + bas.g * (1 - h.a), b: h.b * h.a + bas.b * (1 - h.a), a: 1 });
  const proche = (a, b, t = 18) => a && b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) <= t;
  // Les fonds possibles sous un élément : chaque couleur pleine et chaque arrêt de dégradé, en remontant.
  const fonds = (el) => {
    const pile = [];
    for (let x = el; x; x = x.parentElement) {
      const cs = getComputedStyle(x);
      // une capsule DESSINÉE en ::before (position absolue, sous le texte) est le vrai fond du texte
      const av = getComputedStyle(x, "::before");
      const cAv = av && av.content !== "none" && av.position === "absolute" ? rgbs(av.backgroundColor)[0] : null;
      const c = cAv && cAv.a >= 0.5 ? cAv : rgbs(cs.backgroundColor)[0];
      const g = cs.backgroundImage && cs.backgroundImage !== 'none' ? rgbs(cs.backgroundImage).filter((k) => k.a >= 0.5) : [];
      pile.push({ c, g });
      // (15 nov., « Verre dépoli ») un dégradé TRANSLUCIDE (le verre : .80 le jour, .62 la nuit) laisse voir ce qui est
      // dessous : on continue de remonter ; seul un fond opaque arrête.
      if ((c && c.a >= 0.99) || (g.length && g.every((k) => k.a >= 0.99))) break;
    }
    // Rien d'opaque jusqu'en haut : le FOND de l'app. (15 nov., « Verre dépoli », docs/passation/2026-11-15-verre-depoli.md
    // « La preuve ») Il se lit sur les jetons rendus — le haut éclairé de ses reflets, l'aplat, le bas — et le texte est
    // jugé sur le pire (la règle de verre.cjs V3) ; il n'est plus figé en blanc (jour) / noir (nuit), l'hypothèse
    // du studio d'hier. Sans jetons lisibles : ce blanc / ce noir.
    const sombre = document.documentElement.getAttribute('data-theme') === 'dark';
    let bases = fondApp.length ? fondApp.slice() : [sombre ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 }];
    if (pile.length && ((pile[pile.length - 1].c && pile[pile.length - 1].c.a >= 0.99) || (pile[pile.length - 1].g.length && pile[pile.length - 1].g.every((k) => k.a >= 0.99)))) bases = [bases[0]];
    for (let i = pile.length - 1; i >= 0; i--) {
      const { c, g } = pile[i];
      if (c && c.a > 0) bases = bases.map((b) => melange(c, b));
      if (g.length) bases = g.flatMap((k) => bases.map((b) => melange(k, b))).slice(0, 24);
    }
    return bases;
  };
  const fondApp = (() => {
    const coque = document.querySelector('.vrm-app-shell[data-espace]') || document.querySelector('.vrm-app-shell') || document.documentElement;
    const tok = (n) => { const v = getComputedStyle(coque).getPropertyValue(n).trim(); const h = /^#([0-9a-f]{6})$/i.exec(v); return h ? { r: parseInt(h[1].slice(0, 2), 16), g: parseInt(h[1].slice(2, 4), 16), b: parseInt(h[1].slice(4, 6), 16), a: 1 } : rgbs(v)[0] || null; };
    let haut = tok('--sb-haut'); const aplat = tok('--sb-aplat'), bas = tok('--sb-bas'), reflet = tok('--sv-reflet'), reflet2 = tok('--sv-reflet-2');
    if (haut && reflet2) haut = melange(reflet2, haut);
    if (haut && reflet) haut = melange(reflet, haut);
    return [haut, aplat, bas].filter((k) => k && k.a >= 0.99);
  })();
  const nom = (el) => {
    const c = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const d = [...el.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 1).map((a) => `[${a.name}]`).join('');
    const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 34);
    return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${d} « ${t} »`;
  };
  const encre = (() => { const t = document.createElement('span'); t.style.color = 'var(--sb-encre)'; document.body.appendChild(t); const c = rgbs(getComputedStyle(t).color)[0]; t.remove(); return c; })();
  const out = { racine: roots.length, matiere: {}, pleins: [], horsForme: [], formes: {}, contraste: [], deborde: [], textes: 0, boutons: 0, inventaire: [], encaisse: false, auMoins0: false, nan: false };
  if (!roots.length) return out;
  const R = roots[0];
  out.matiere.espace = !!R.closest('[data-espace]') || !!R.querySelector('[data-espace], .vrm-tache[data-tache="messages"]') || R.hasAttribute('data-espace') || R.matches('.vrm-chat-panel');
  const fondMain = getComputedStyle(document.querySelector('.vrm-main') || R).backgroundImage;
  // (15 nov., « Verre dépoli ») la lumière peut être portée par le ::before fixe de la coque (règle de studio-coque F).
  const avantCoque = document.querySelector('.vrm-app-shell') ? getComputedStyle(document.querySelector('.vrm-app-shell'), '::before') : null;
  out.matiere.fondBleu = (!!avantCoque && avantCoque.content !== 'none' && avantCoque.position === 'fixed' && /gradient/.test(avantCoque.backgroundImage)) || /gradient/.test(fondMain) || /gradient/.test(getComputedStyle(document.querySelector('.vrm-app-shell') || R).backgroundImage) || /gradient/.test(getComputedStyle(R).backgroundImage) || /gradient/.test(getComputedStyle(document.querySelector('.vrm-cx') || R).backgroundImage);
  // ── Les boutons et leurs formes ──
  const sel = 'button, a[href], [role="button"], summary, [role="tab"]';
  const tous = [...new Set(roots.flatMap((r) => [...r.querySelectorAll(sel)]))];
  for (const el of tous) {
    if (!vis(el)) continue;
    // une rangée de liste / une tuile entière / une ligne de réglage ou de repli : on la touche entière
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const parentW = (el.parentElement && el.parentElement.getBoundingClientRect().width) || r.width;
    const bg = rgbs(cs.backgroundColor)[0];
    const img = cs.backgroundImage;
    const rad = parseFloat(cs.borderTopLeftRadius) || 0;
    const ombre = cs.boxShadow && cs.boxShadow !== 'none';
    const bord = parseFloat(cs.borderTopWidth) > 0.6 && cs.borderTopStyle !== 'none' && (rgbs(cs.borderTopColor)[0] || {}).a > 0.3;
    // le plein : l’encre en fond (couleur, ou le dégradé d’encre de la fondation, --sb-plein-fond)
    const stopsImg = /gradient/.test(img) ? rgbs(img) : [];
    const plein = (bg && bg.a > 0.9 && proche(bg, encre, 30)) || (stopsImg.length > 0 && proche(stopsImg[stopsImg.length - 1], encre, 30));
    let forme = null;
    const ligne = el.matches('.sb-rangee, .sb-tuile, .vrm-set-ligne, .vrm-inbox-row, .vrm-argent-w, summary, [data-fil], [role="tab"]:not(.vrm-seg-btn), .vrm-fiche-menu > button, tr, li > a') || (r.width >= parentW * 0.9 && r.width >= 240 && r.height >= 44);
    // une tuile (Bento, record, carte qu'on touche entière) : porcelaine, grand rayon, haute
    // (16 nov.) les tuiles des catégories de Paramètres, trois par rangée au téléphone : 113 px de large
    const tuile = el.matches('.sb-tuile') || (rad >= 18 && r.height >= 80 && r.width >= 100);
    // un lien DANS une phrase (pied de page, « ouvre Ventes ») : WCAG 2.5.8 l'exempte du gabarit de 44
    const enLigne = cs.display === 'inline' && el.tagName === 'A';
    if (el.matches('.sb-btn-plein') || (plein && r.height >= 40)) forme = 'plein';
    else if (ligne || tuile) forme = 'ligne';
    else if (el.matches('.sb-rond') || (Math.abs(r.width - r.height) <= 2 && r.width >= 43 && rad >= r.width / 2 - 1)) forme = 'rond';
    else if (el.matches('.sb-touche, .vrm-seg-btn, .vrm-sel-sites > button') || ((/gradient/.test(img) || (bg && bg.a > 0.5) || (el.disabled && ombre)) && rad >= 9 && rad <= 18 && r.height >= 32 && r.height <= 48 && !bord)) forme = 'touche';
    else if (el.matches('.sb-lien') || ((!bg || bg.a < 0.05) && img === 'none' && !ombre && !bord)) forme = 'lien';
    out.boutons++;
    out.formes[forme || 'hors'] = (out.formes[forme || 'hors'] || 0) + 1;
    if (forme === 'plein') out.pleins.push(nom(el));
    if (!forme) out.horsForme.push(`${nom(el)} (${Math.round(r.width)}×${Math.round(r.height)}, r${Math.round(rad)}${bord ? ', bord' : ''}${bg && bg.a > 0.05 ? ', fond ' + [bg.r, bg.g, bg.b].map(Math.round).join(',') : ''})`);
    if (tactile && forme !== 'ligne' && !enLigne && r.height < 43.5 && !el.closest('.vrm-seg, .vrm-sel-sites')) out.horsForme.push(`${nom(el)} : ${Math.round(r.height)} px au doigt (< 44)`);
  }
  // ── Le contraste de chaque texte ──
  const marche = document.createTreeWalker(R, NodeFilter.SHOW_TEXT);
  const vus = new Set();
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement; if (!el || vus.has(el) || !vis(el)) continue; vus.add(el);
    const cs = getComputedStyle(el);
    if (parseFloat(cs.opacity) < 0.3) continue;
    const c = rgbs(cs.color)[0]; if (!c || c.a < 0.2) continue;
    out.textes++;
    const t = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight, 10) || 400;
    const grand = t >= 24 || (t >= 18.66 && w >= 700);
    const seuil = grand ? 3 : 4.5;
    const desactive = el.closest('button:disabled, [aria-disabled="true"]');
    if (desactive) continue;   // un geste désactivé dit sa raison ailleurs (WCAG l'exempte)
    const pire = Math.min(...fonds(el).map((f) => ratio(melange(c, f), f)));
    if (pire < seuil - 0.05) out.contraste.push(`${nom(el)} ${pire.toFixed(2)}:1 (< ${seuil})`);
  }
  // ── Débordements ──
  const de = document.scrollingElement;
  if (de.scrollWidth > de.clientWidth + 1) out.deborde.push(`page ${de.scrollWidth} > ${de.clientWidth}`);
  for (const el of R.querySelectorAll('.vrm-argent-w, .sb-tuile, .vrm-surface, .vrm-set-liste, .vrm-compta-replis, .vrm-msg-list, .vrm-carte-mfa, .vrm-settings-todo')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 1) { out.deborde.push(`${nom(el)} sort de l'écran (${Math.round(r.right)} > ${innerWidth})`); continue; }
    for (const k of el.querySelectorAll('button, b, strong, span')) {
      if (!vis(k) || k.closest('[data-defile], .vrm-rangee, .vrm-seg, [style*="overflow"]')) continue;
      const q = k.getBoundingClientRect();
      if (q.right > r.right + 1 && q.width < 900) { out.deborde.push(`${nom(k)} sort de ${nom(el)} (${Math.round(q.right - r.right)} px)`); break; }
    }
  }
  // ── L'inventaire des gestes (montés, visibles ou rangés) ──
  const VOLATILE = /^data-(vrm-tone|fil|vrm-vignette|photo|vu|temps|neuf|attente|reprise|argent-valeur|argent-raison|argent-echeance|eur|compta|benef|prevision|ca-|carte-valeur|valeur|n$|fraicheur|conv-paire|fils?-|defile|seg-deborde|point|tx|id|at|depense|abo|ticket|msg-n)/;
  const inv = new Set();
  for (const el of tous) {
    if (el.closest('.vrm-inbox-row, [data-fil], .vrm-msg-list') && !el.matches('.vrm-msg-list > :first-child')) { if (el.matches('.vrm-inbox-row, [data-fil]')) inv.add('rangée:conversation'); continue; }
    const d = [...el.attributes].filter((a) => a.name.startsWith('data-') && !VOLATILE.test(a.name)).map((a) => a.name + (a.value && a.value.length < 30 && !/\d{4,}/.test(a.value) ? '=' + a.value : '')).sort();
    const lu = (el.getAttribute('aria-label') || '').trim();
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().replace(/\d[\d\s,.]*/g, '#').slice(0, 40);
    const cle = d.length ? d.join(' ') : lu ? 'nom:' + lu.replace(/\d[\d\s,.]*/g, '#').slice(0, 60) : txt ? 'texte:' + txt : '';
    if (cle) inv.add(el.tagName.toLowerCase() === 'summary' ? 'repli:' + cle : cle);
  }
  out.inventaire = [...inv].sort();
  const txt = R.innerText || '';
  out.encaisse = /encaiss/i.test(txt); out.auMoins0 = /au moins 0[,\s]*0?0?\s*€/i.test(txt); out.nan = /\bNaN\b|\bundefined\b|Invalid Date/.test(txt);
  return out;
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const inventaire = {};
  try {
    for (const e of VOULUS) {
      const E = ECRANS[e]; if (!E) { console.log('écran inconnu', e); continue; }
      for (const W of LARG) for (const t of THEMES) {
        const T = `${e} ${W} ${t}`;
        let o = null;
        for (let essai = 0; essai < 2 && !o; essai++) o = await P.ouvrir(nav, { W, sombre: t === 'sombre', b: B.baseVolume(), url: E.url, api: B.apiVolume, sansSession: !!E.sansSession }).catch((err) => { console.log(`·  ${T} : ouverture ratée (${String(err.message).slice(0, 80)}), on réessaie`); return null; });
        if (!o) { dit(false, `${T} : l'écran ne s'est pas ouvert`); continue; }
        try {
          if (E.sansSession) { await o.pg.waitForSelector(E.racine, { timeout: 20000 }).catch(() => {}); await o.pg.waitForTimeout(2500); }
          else { await P.pret(o.pg); }
          if (E.avant) await E.avant(o.pg);
          await o.pg.waitForTimeout(600);
          // Une machine chargée rend lentement : un écran encore vide (aucun bouton) est relu, jusqu'à 3 fois.
          let m = await o.pg.evaluate(mesurer, { racine: E.racine, tactile: W < 600 });
          for (let i = 0; i < 3 && (!m.racine || m.boutons < 2); i++) { await o.pg.waitForTimeout(4000); m = await o.pg.evaluate(mesurer, { racine: E.racine, tactile: W < 600 }); }
          // L'inventaire d'un écran : l'union de ses quatre rendus (390/1512, clair/sombre).
          inventaire[e] = [...new Set([...(inventaire[e] || []), ...m.inventaire])].sort();
          if (E.categories) {
            const ids = await o.pg.evaluate(() => [...new Set([...document.querySelectorAll('[data-categorie-ouvrir]')].map((x) => x.getAttribute('data-categorie-ouvrir')))]);
            for (const id of ids) {
              await o.pg.locator(`[data-categorie-ouvrir="${id}"]`).first().click({ timeout: 8000 }).catch(() => {});
              await o.pg.waitForTimeout(900);
              const mc = await o.pg.evaluate(mesurer, { racine: E.racine, tactile: W < 600 });
              inventaire[e] = [...new Set([...inventaire[e], ...mc.inventaire])].sort();
              await o.pg.locator('[data-categorie-retour]').first().click({ timeout: 8000 }).catch(() => {});
              await o.pg.waitForTimeout(500);
            }
          }
          if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await o.pg.screenshot({ path: path.join(SHOTS, `${e}-${W}-${t}.png`), timeout: 120000 }).catch(() => console.log(`·  ${T} : capture ratée (machine lente)`)); }
          if (INV_OUT) { console.log(`·  ${T} : ${m.inventaire.length} gestes relevés, ${m.boutons} boutons visibles`); continue; }
          dit(m.racine > 0, `S0 ${T} : l'écran est rendu`, E.racine);
          dit(m.matiere.espace && m.matiere.fondBleu, `S1 ${T} : la matière Studio (racine data-espace, fond bleu clair)`, JSON.stringify(m.matiere));
          dit(m.pleins.length <= 1, `S2 ${T} : au plus UN bouton plein (${m.pleins.length})`, m.pleins.join(' ¦ '));
          dit(!m.horsForme.length, `S3 ${T} : quatre formes seulement (${JSON.stringify(m.formes)})`, m.horsForme.slice(0, 12).join(' ¦ '));
          dit(!m.contraste.length, `S4 ${T} : contraste AA, ${m.textes} textes`, m.contraste.slice(0, 10).join(' ¦ '));
          dit(!m.deborde.length, `S5 ${T} : rien ne déborde`, m.deborde.slice(0, 6).join(' ¦ '));
          dit(!m.encaisse && !m.auMoins0 && !m.nan && !o.erreurs.length, `S7 ${T} : ni « encaissé », ni « au moins 0 », ni NaN, aucune erreur JS`, JSON.stringify({ e: m.encaisse, z: m.auMoins0, n: m.nan, err: o.erreurs }));
        } catch (err) { dit(false, `${T} : le banc a rapporté une exception`, err.message); }
        await o.ctx.close();
      }
    }
  } finally { await nav.close(); P.srv.close(); }
  // ── S6 : chaque geste d'avant est encore là (union des rendus de l'écran, avant ⊆ après) ──
  if (INV_REF) for (const e of VOULUS) {
    if (!INV_REF[e] || !inventaire[e]) continue;
    // Un libellé se juge sur ses quatre premiers mots (la suite dit un état : « Charge… », « 3 sur 5 ») ;
    // un libellé « en cours » (qui finit par « … ») et les lectures asynchrones (VOLATILS) ne sont pas des gestes.
    // (16 nov., Paramètres en catégories) une rangée porte en plus `data-reglage-id` (son identité) : cette marque ne compte pas.
    // Un geste nommé par ses data-* est encore là quand un élément les porte TOUS (il peut en porter de nouveaux).
    const marques = (k) => k.split(' ').filter((x) => x && !/^data-reglage-id(=|$)/.test(x));
    const norme = (k) => { const m = /^((?:repli:)?(?:texte|nom):)(.*)$/.exec(k); return m ? m[1] + m[2].split(/\s+/).slice(0, 4).join(' ').replace(/[#\s]+$/, '') : marques(k).join(' '); };
    const ici = new Set(inventaire[e].map(norme));
    const iciData = inventaire[e].filter((k) => /^data-/.test(k)).map((k) => new Set(marques(k)));
    const present = (k) => ici.has(norme(k)) || (/^data-/.test(k) && iciData.some((t) => marques(k).every((x) => t.has(x))));
    const manque = INV_REF[e].filter((k) => !/…$/.test(k) && !present(k) && !RANGES.some((x) => x.test(k)) && !VOLATILS.some((x) => x.test(k)));
    dit(!manque.length, `S6 ${e} : l'inventaire d'avant est entier (${INV_REF[e].length} gestes relevés, ${inventaire[e].length} après)`, manque.join(' ¦ '));
  }
  if (INV_OUT) { fs.writeFileSync(INV_OUT, JSON.stringify(inventaire, null, 1)); console.log('inventaire écrit :', INV_OUT); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exitCode = ko ? 1 : 0;
})();
