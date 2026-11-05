// ════════════════════════════════════════════════════════════════════════════
//  BANC « JETONS ET FORMES DE BASE » — chantier A de la revue de cohérence du
//  5 nov. (docs/passation/2026-11-05-revue-coherence.md, points 1.1, 1.3, 1.5,
//  1.6, 2.33 et 3.1 ; récit : docs/passation/2026-11-05-chantier-a.md).
//  Données INVENTÉES (le dépôt est public) : le petit jeu du banc
//  `nouveau-vendeur` (deux comptes Vinted, 12 annonces, ventes, achats, un compte
//  Leboncoin), servi par SON harnais — aucune écriture ne sort du banc. Un second
//  passage pose DEUX annonces présentes sous le même N° (le doublon).
//  Chaque écran principal, à 390 px tactile et 1512 px, clair et sombre. Il MESURE,
//  par styles calculés (jamais un libellé) :
//   J1 ACCENT    — une seule couleur d'accent sur les APLATS (fond bleu) de tous les
//                  écrans : #0071E3 en clair, #0A84FF en sombre ; texte blanc dessus ;
//   J2 SEGMENTÉ  — aucun `.vrm-seg-btn` avec un retrait latéral sous 10 px ;
//   J3 COUPÉ     — aucun libellé de segment (ni du sélecteur de site) coupé : texte
//                  plus large que sa case, ellipse, ou poussé hors de la piste ;
//   J4 CHIFFRES  — aucun texte (hors nombres, montants, N°) en `tabular-nums` ;
//   J5 ROUGE     — aucune couleur rouge (texte, fond, filet, trait) hors du doublon
//                  de N° (les logos de transporteur gardent leur couleur de marque) ;
//                  et, dans le passage « doublon », le doublon EST rouge ;
//   J6 FILTRE    — en sombre, le filtre actif n'est pas une pilule blanche : il suit
//                  le segment actif ;
//   J7 SITES     — sélecteur de site : le nom seulement sur le site choisi, jamais
//                  « eBay eBay » ;
//   J8 CASSE     — les tuiles (cases de la carte sombre, tuiles des Statistiques)
//                  commencent par une majuscule.
//  Réglages : `BANC_PORT` (8700–8749, 8731 par défaut), `LARGEURS=390,1512`,
//  `THEMES=clair,sombre`, `ECRANS=<regex>`, `SHOTS=<dossier>` (une capture par
//  écran, à REGARDER), `BANC_DIST` (un autre dist/, pour juger la base),
//  `JC_MUTATION=1` (remet dans la page les anciennes règles — segment à 4 px, page en
//  `tnum`, filtre blanc la nuit, `--vrm-danger` rouge : le banc DOIT rougir).
//  Un banc ne meurt pas : il rapporte (le nombre de rouges par mesure, à la fin).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '8731';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const FILTRE = process.env.ECRANS ? new RegExp(process.env.ECRANS) : null;
const SHOTS = process.env.SHOTS || '';
const ATTENDU = { clair: 'rgb(0, 113, 227)', sombre: 'rgb(10, 132, 255)' };

let ko = 0;
const compte = {};
// Rapporté, pas jugé : les `fontVariantNumeric: 'tabular-nums'` écrits EN LIGNE dans src/App.jsx sur
// du texte (hors de la zone du chantier A, qui ne touche que les feuilles de style et les jetons).
const resteEnLigne = new Set();
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 600) : ''}`);
};

// ── Ce que la page MONTRE, par styles calculés ──────────────────────────────
const MESURE = (pg) => pg.evaluate(() => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.05) return false; } return !e.closest('details:not([open]) > :not(summary)'); };
  const rgba = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; } return { h, s, l }; };
  const bleu = (c) => { const x = rgba(c); if (!x || x.a < 0.9) return false; const { h, s, l } = hsl(x); return h >= 195 && h <= 235 && s >= 0.6 && l >= 0.3 && l <= 0.7; };
  const rouge = (c) => { const x = rgba(c); if (!x || x.a < 0.3) return false; const { h, s, l } = hsl(x); return (h >= 345 || h <= 12) && s >= 0.45 && l >= 0.25 && l <= 0.75; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const nom = (e) => ((e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : e.tagName.toLowerCase()) + ' « ' + (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30) + ' »');
  // Les couleurs de MARQUE (logos de transporteur, Google) ne sont pas le rouge de l'app.
  const MARQUES = ['rgb(226, 0, 26)', 'rgb(227, 6, 19)', 'rgb(220, 0, 50)', 'rgb(212, 5, 17)', 'rgb(234, 67, 53)'];
  const tous = [...document.querySelectorAll('body *')].filter((e) => !e.closest('script, style, noscript'));
  const visibles = tous.filter(vis);

  // J1 — les aplats bleus.
  const aplats = {};
  for (const e of visibles) {
    const s = getComputedStyle(e);
    if (!bleu(s.backgroundColor)) continue;
    const r = e.getBoundingClientRect(); if (r.width * r.height < 40) continue;   // un point, une puce : pas un aplat
    const k = s.backgroundColor.replace(/rgba\((\d+), (\d+), (\d+), 1\)/, 'rgb($1, $2, $3)');
    const t = rgba(s.color);
    (aplats[k] = aplats[k] || []).push({ ou: nom(e), texte: s.color, contraste: t ? Math.round(contraste(rgba(s.backgroundColor), t) * 100) / 100 : null, aTexte: !!(e.innerText || '').trim() });
  }
  // J2 / J3 — les segmentés.
  const segs = [], coupes = [];
  const clip = (e) => { let r = e.getBoundingClientRect(); let L = r.left, R = r.right; for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { const q = p.getBoundingClientRect(); L = Math.max(L, q.left); R = Math.min(R, q.right); } } return { L, R }; };
  for (const b of visibles.filter((e) => e.matches('.vrm-seg-btn, .vrm-seg > button, .vrm-filtre-site > button'))) {
    const s = getComputedStyle(b);
    if (b.matches('.vrm-seg-btn')) segs.push({ ou: nom(b), pl: parseFloat(s.paddingLeft), pr: parseFloat(s.paddingRight), h: Math.round(b.getBoundingClientRect().height) });
    const { L, R } = clip(b);
    const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let coupe = '';
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!/\S/.test(n.nodeValue) || !vis(n.parentElement)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const x of rg.getClientRects()) if (x.width > 1 && (x.right > R + 1 || x.left < L - 1)) coupe = `texte hors de sa case (${Math.round(x.left)}–${Math.round(x.right)} pour ${Math.round(L)}–${Math.round(R)})`;
      const pe = n.parentElement;
      if (!coupe && pe.scrollWidth > pe.clientWidth + 1 && /ellipsis/.test(getComputedStyle(pe).textOverflow)) coupe = 'coupé par une ellipse';
    }
    if (!coupe && b.scrollWidth > b.clientWidth + 1 && /hidden|clip/.test(s.overflowX)) coupe = 'plus large que sa case';
    if (coupe) coupes.push(nom(b) + ' : ' + coupe);
  }
  // J4 — tabular-nums sur du texte. Un NOMBRE peut porter son unité ou son mot (« 2 ventes »,
  // « hier 15:07 », « au moins 0 / 30 », « octobre 2026 ») ; un TEXTE n'a aucun chiffre
  // (« Comptes et emails ») ou fait une phrase, un titre (3 mots ou plus : « Nike XT - 6 blanche »).
  // Les mots qui tiennent la place d'un nombre inconnu (§5 : « pas lu », « pas su ») restent des nombres.
  const UNITES = /^(€|k|j|h|min|mo|ko|go|n°|x|km|kg|g)$/i;
  const A_LA_PLACE = /^(pas lu|pas su|à dater|—)$/i;
  const tabTexte = [], tabEnLigne = [];
  for (const e of visibles) {
    const s = getComputedStyle(e);
    const tab = /tabular-nums/.test(s.fontVariantNumeric) || /"tnum"(?!\s+0)/.test(s.fontFeatureSettings);
    if (!tab) continue;
    let t = ''; for (const n of e.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    t = t.trim(); if (!t || A_LA_PLACE.test(t)) continue;
    const mots = (t.match(/[A-Za-zÀ-ÿ°]{2,}/g) || []).filter((m) => !UNITES.test(m));
    if (!mots.length || (/\d/.test(t) && mots.length < 3)) continue;
    // D'où vient-il ? Un style EN LIGNE de App.jsx (hors des feuilles de style) est rapporté à part.
    let enLigne = false; for (let p = e; p && p !== document.body; p = p.parentElement) if (/tabular|tnum/.test(p.getAttribute('style') || '')) { enLigne = true; break; }
    const ou = nom(e) + ' [' + t.slice(0, 30) + ']';
    if (enLigne) { if (tabEnLigne.length < 100) tabEnLigne.push(ou); } else if (tabTexte.length < 400) tabTexte.push(ou);
  }
  // J5 — le rouge.
  const DOUBLON = /par deux (paires|articles|annonces)|deux (paires|articles) (présentes )?portent|portent le même numéro|est porté par un autre article|deux articles !/i;
  const estDoublon = (e) => { if (e.closest('[data-tout-double]')) return true; let p = e; for (let i = 0; i < 6 && p; i++, p = p.parentElement) if (DOUBLON.test(p.innerText || '')) return true; return false; };
  const rouges = [], rougesDoublon = [];
  for (const e of visibles) {
    const s = getComputedStyle(e);
    const faces = [['texte', (e.innerText || '').trim() || e.tagName === 'svg' ? s.color : ''], ['fond', s.backgroundColor]];
    for (const c of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(s['border' + c + 'Width']) > 0 && s['border' + c + 'Style'] !== 'none') faces.push(['filet', s['border' + c + 'Color']]);
    if (e instanceof SVGElement) { faces.push(['trait', s.stroke]); faces.push(['remplissage', s.fill]); }
    for (const [face, c] of faces) {
      if (!c || !rouge(c) || MARQUES.includes(c.replace(/rgba\((\d+), (\d+), (\d+), 1\)/, 'rgb($1, $2, $3)'))) continue;
      (estDoublon(e) ? rougesDoublon : rouges).push(`${face} ${c} ${nom(e)}`);
      break;
    }
  }
  // J6 — le filtre actif en sombre : TOUT choix marqué choisi (pilule, onglet, filtre, quelle que
  // soit sa classe) — jamais un aplat blanc, le point le plus lumineux de l'écran.
  const filtres = [];
  for (const b of visibles.filter((e) => e.matches('button[aria-pressed="true"], button[aria-selected="true"], [role="tab"][aria-selected="true"], [role="radio"][aria-checked="true"], button[aria-current="page"]:not(.vrm-tab):not(.vrm-sidebar *)'))) {
    const x = rgba(getComputedStyle(b).backgroundColor); if (x) filtres.push({ ou: nom(b) + ' ' + String((b.parentElement && b.parentElement.className) || '').slice(0, 40), fond: getComputedStyle(b).backgroundColor, clair: x.a > 0.5 && hsl(x).l > 0.8 });
  }
  const segActif = visibles.find((e) => e.matches('.vrm-seg > .vrm-seg-btn[aria-pressed="true"], .vrm-seg > .vrm-seg-btn[aria-current="page"], .vrm-filtre-site > button[aria-pressed="true"]'));
  // J7 — le sélecteur de site.
  const sites = [];
  for (const g of visibles.filter((e) => e.matches('[data-selecteur-logos]'))) {
    for (const b of g.querySelectorAll(':scope > button')) {
      const n = b.querySelector('.vrm-ss-nom'); const nomVu = !!(n && vis(n) && n.textContent.trim());
      sites.push({ site: b.dataset.site, actif: b.getAttribute('aria-pressed') === 'true', nomVu, texte: (b.innerText || '').trim() });
    }
  }
  // J8 — la casse des tuiles.
  const casse = [];
  for (const e of visibles.filter((x) => x.matches('.vrm-fu-case > span, .vrm-sv-tuile-lib, .vrm-of-tuile > span'))) {
    const t = (e.textContent || '').trim(); if (!t) continue;
    const c = t[0]; if (c.toLowerCase() === c.toUpperCase() || c === c.toUpperCase()) continue;   // pas une lettre, ou déjà en capitale
    const s = getComputedStyle(e), fl = getComputedStyle(e, '::first-letter');
    if (/uppercase|capitalize/.test(s.textTransform) || fl.textTransform === 'uppercase') continue;
    casse.push(nom(e));
  }
  // Les jetons posés sur la page (themeMineral.js → variablesTheme) : `--vrm-danger` sert à
  // 88 endroits (erreurs, annulations, pertes) — il ne doit plus être rouge ; `--vrm-doublon` l'est.
  const jeton = (n) => { const d = document.createElement('i'); d.style.color = getComputedStyle(document.querySelector('.vrm-app-shell') || document.documentElement).getPropertyValue(n).trim() || 'transparent'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
  const jetons = { danger: jeton('--vrm-danger'), doublon: jeton('--vrm-doublon'), dangerRouge: rouge(jeton('--vrm-danger')), doublonRouge: rouge(jeton('--vrm-doublon')) };
  return { aplats, segs, coupes, tabTexte, tabEnLigne, rouges, rougesDoublon, casse, jetons, filtres, segActif: segActif ? getComputedStyle(segActif).backgroundColor : null, sites };
});

const ECRANS = [['journee', 'Ma journée'], ['annonces', 'Annonces'], ['ventes', 'Ventes'], ['cat_bord', 'Colis'], ['cat_bord:retirer', 'Colis · À retirer'], ['messages', 'Messages'], ['garage', 'Stock'], ['achats', 'Achats'], ['dashboard', 'Statistiques'], ['compta', 'Comptabilité'], ['settings', 'Paramètres']];

// Le jeu : celui de `nouveau-vendeur`, plus deux états que l'app disait en rouge (`C.danger`)
// alors qu'aucun N° n'y est en jeu : une vente ANNULÉE et un compte que l'extension a lu
// « banni » — J5 doit les voir hors du rouge.
const jeu = () => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const v2 = l.find((x) => x.id === 'harvest_222_orders_sold');
  v2.data.payload.my_orders.push({ transaction_id: 62090, title: 'Asics Gel-1130 argent taille 42', price: { amount: '70', currency_code: 'EUR' }, status: 'Commande annulée', transaction_user_status: 'failed', date: new Date(Date.now() - 3 * 86400000).toISOString(), photo: null });
  l.push({ id: 'panel_comptes_etat', data: { comptes: { 222: { etat: 'banni', at: new Date(Date.now() - 3600e3).toISOString() } } } });
  return l;
};
// Le doublon : l'annonce N°4, PRÉSENTE, et la vente à envoyer reliée à la main au N°4 sans
// identité d'annonce — un cas que l'app ne règle pas seule (`doublonsAReattribuer` : vente
// sans identité ⇒ rien n'est deviné, le rouge reste). Colis le montre.
const avecDoublon = () => {
  const l = jeu();
  const main = l.find((x) => x.id === 'main');
  const nums = main.data.vinted_annonce_numeros; const ids = Object.keys(nums);
  main.data.vinted_sale_overrides = { 62000: { numero: nums[ids[3]].numero } };
  return l;
};

async function tournee(nav, { W, theme, scenario, base, aplatsTheme }) {
  const sombre = theme === 'sombre';
  const T = `[${scenario} ${W}px ${theme}]`;
  const o = await NV.ouvrir(nav, { W, sombre, base, tab: 'journee' });
  const vus = {};
  for (const [ecran, nom] of ECRANS) {
    if (scenario === 'doublon' && !/^(journee|annonces|cat_bord|ventes)$/.test(ecran)) continue;
    if (FILTRE && !FILTRE.test(ecran)) continue;
    const [tab, sous] = ecran.split(':');
    await o.pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
    await o.pg.waitForTimeout(2600);
    if (sous) { const c = o.pg.locator(`[data-colis-onglet-choix="${sous}"]`).first(); if (await c.count()) { await c.click(); await o.pg.waitForTimeout(1300); } }
    if (process.env.JC_MUTATION === '1') await o.pg.addStyleTag({ content: ':root .vrm-seg > .vrm-seg-btn:not(#a):not(#b):not(#c) { padding: 0 4px !important; } html body.x, html body { font-feature-settings: "tnum" 1 !important; } :root[data-theme="dark"] :is(button[aria-pressed="true"], [role="radio"][aria-checked="true"]):not(#a):not(#b):not(#c) { background: #f5f5f7 !important; } :root .vrm-app-shell.vrm-app-shell { --vrm-danger: #D70015 !important; }' }).then(() => o.pg.waitForTimeout(800));   // les transitions de fond finissent
    const m = await MESURE(o.pg);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await o.pg.screenshot({ path: path.join(SHOTS, `jc-${scenario}-${W}-${theme}-${ecran.replace(':', '-')}.png`), fullPage: true }); }
    for (const [k, v] of Object.entries(m.aplats)) { (aplatsTheme[k] = aplatsTheme[k] || []).push(...v.map((x) => ({ ...x, ecran: nom, W }))); }
    const E = `${T} ${nom}`;
    if (scenario === 'jeu') {
      const bas = m.segs.filter((s) => s.pl < 10 || s.pr < 10);
      dit(!bas.length, 'J2', `${E} : chaque segment a au moins 10 px de retrait latéral (${m.segs.length} vus)`, bas.slice(0, 8).map((s) => `${s.ou} ${s.pl}/${s.pr}`).join(' ¦ '));
      dit(!m.coupes.length, 'J3', `${E} : aucun libellé de segment coupé`, m.coupes.slice(0, 8).join(' ¦ '));
      dit(!m.tabTexte.length, 'J4', `${E} : aucun texte en tabular-nums par une feuille de style (chiffres alignés seulement sur les nombres)`, `${m.tabTexte.length} : ` + m.tabTexte.slice(0, 8).join(' ¦ '));
      if (m.tabEnLigne.length) { for (const x of m.tabEnLigne) resteEnLigne.add(`${nom} · ${x}`); }
      dit(!m.rouges.length, 'J5', `${E} : aucun rouge hors du doublon de N°`, `${m.rouges.length} : ` + m.rouges.slice(0, 8).join(' ¦ '));
      if (ecran === 'journee') dit(!m.jetons.dangerRouge && m.jetons.doublonRouge, 'J5', `${T} jetons : « danger » n'est plus rouge (ambre), « doublon » l'est`, JSON.stringify(m.jetons));
      if (sombre) { const blancs = m.filtres.filter((f) => f.clair); dit(!blancs.length, 'J6', `${E} : en sombre, aucun choix actif (filtre, pilule, onglet) en aplat blanc (${m.filtres.length} vus)`, blancs.map((f) => `${f.ou} ${f.fond} (segment actif : ${m.segActif})`).join(' ¦ ')); }
      const mal = m.sites.filter((s) => s.actif ? (s.site === 'ebay' && s.nomVu) : s.nomVu);
      dit(!mal.length, 'J7', `${E} : sélecteur de site — le nom seulement sur le site choisi, jamais « eBay eBay » (${m.sites.length} segments)`, mal.map((s) => `${s.site}${s.actif ? ' (choisi)' : ''} « ${s.texte} »`).join(' ¦ '));
      dit(!m.casse.length, 'J8', `${E} : chaque tuile commence par une majuscule`, m.casse.join(' ¦ '));
    } else {
      vus[ecran] = m;
      dit(!m.rouges.length, 'J5', `${E} (doublon posé) : aucun rouge hors du doublon de N°`, `${m.rouges.length} : ` + m.rouges.slice(0, 8).join(' ¦ '));
    }
  }
  if (scenario === 'doublon' && vus.cat_bord) dit(vus.cat_bord.rougesDoublon.length > 0, 'J5', `${T} Colis : le doublon de N° EST rouge`, JSON.stringify(vus.cat_bord.rougesDoublon.slice(0, 3)));
  dit(!o.journal.erreurs.length, 'J0', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const theme of THEMES) {
      const aplatsTheme = {};
      for (const W of LARGEURS) {
        await tournee(nav, { W, theme, scenario: 'jeu', base: { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 }, aplatsTheme });
        await tournee(nav, { W, theme, scenario: 'doublon', base: { lignes: avecDoublon(), comptes: NV.JEU_COMPTES, ecritures: 0 }, aplatsTheme: {} });
      }
      const teintes = Object.keys(aplatsTheme);
      const detail = teintes.map((k) => `${k} ×${aplatsTheme[k].length} (${[...new Set(aplatsTheme[k].map((x) => x.ecran + ' ' + x.W + ' ' + x.ou))].slice(0, 4).join(' ; ')})`).join(' ¦ ');
      dit(teintes.length === 1 && teintes[0] === ATTENDU[theme], 'J1', `[${theme}] une seule couleur d'accent sur les aplats de tous les écrans : ${ATTENDU[theme]} (${teintes.length} teinte(s))`, detail);
      const sansBlanc = [].concat(...Object.values(aplatsTheme)).filter((x) => x.aTexte && x.texte !== 'rgb(255, 255, 255)');
      dit(!sansBlanc.length, 'J1', `[${theme}] texte blanc sur l'aplat d'accent`, sansBlanc.slice(0, 6).map((x) => `${x.ecran} ${x.W} ${x.ou} ${x.texte}`).join(' ¦ '));
      const c = [...new Set([].concat(...Object.values(aplatsTheme)).filter((x) => x.aTexte).map((x) => x.contraste))];
      console.log(`     [${theme}] contraste du texte sur l'aplat d'accent : ${c.join(', ') || '—'}`);
    }
  } catch (e) { dit(false, 'J0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  if (resteEnLigne.size) console.log(`\n── Reste (J4, style EN LIGNE dans src/App.jsx, rapporté) : ${resteEnLigne.size}\n   ` + [...resteEnLigne].slice(0, 30).join('\n   '));
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ jetons-coherence : ${ko} défaut(s)` : '\n✅ jetons-coherence : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
