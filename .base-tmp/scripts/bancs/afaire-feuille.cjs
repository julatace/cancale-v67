require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA FEUILLE « À FAIRE » SE FERME, ET LA PAGE REVIENT TELLE QUELLE (14 nov.)
//  Récit : docs/passation/2026-11-14-correctif-afaire.md.
//
//  Julien, sur son iPhone, Annonces · Vestiaire : la feuille « À faire » (« Baisser des prix »)
//  ouverte, le voile gris, la page derrière décalée vers la gauche — « OK », le voile, rien ne
//  fermait. Cause : `AFaireSite` gardait sa feuille montée avec `hidden`, et le
//  `display:flex !important` de `.vrm-ui-voile` (ui.css, spécificité 0,7,1) passait devant la règle
//  `[hidden]` de plateformes.css (0,5,1) : la feuille « fermée » était dessinée dès l'arrivée sur
//  l'écran, et « OK » posait `false` sur un état qui l'était déjà.
//
//  Sur l'app RENDUE (base inventée à la vraie forme : `design-passe-2.cjs` `baseSites`, Vinted +
//  Leboncoin + eBay + Vestiaire ; et le mode exemple), 390 tactile (iPhone : isMobile, hasTouch)
//  ET 1512 souris, clair ET sombre, pour chaque « À faire » (Annonces · Vinted / Vestiaire /
//  Leboncoin / eBay, Ventes · Colis, et l'exemple) :
//    F0 arrivée   aucun voile ni feuille dessinés avant qu'on touche quoi que ce soit ; aucun
//                 élément `[hidden]` dessiné ;
//    F1 ouvre     toucher « À faire » ouvre SA feuille, au-dessus de tout (« OK » n'est couvert
//                 par rien : point le plus haut au centre du bouton) ;
//    F2 ferme ×4  « OK », le voile, glisser vers le bas (la poignée, au doigt ; la tête à la souris),
//                 le geste « retour » (history.back) — chacun ferme la feuille, ne laisse AUCUN
//                 voile (aucun calque fixe qui couvre l'écran de plus qu'au départ), et la page
//                 revient telle quelle : même défilement vertical (± 2 px), mêmes défilements
//                 horizontaux internes, l'écran n'a pas changé ;
//    F3 ailleurs  un geste de la feuille qui OUVRE une autre feuille (« Baisser des prix »,
//                 « Préparer la tournée », « Compléter »…) : « À faire » est fermée d'abord, la
//                 nouvelle est seule et au-dessus ; refermée, plus aucun voile ;
//    H  horizontal à CHAQUE mesure (avant, pendant, après) : `scrollX === 0`,
//                 `scrollWidth <= innerWidth`, et aucun élément qui dépasse l'écran sans un
//                 parent qui le coupe (ce qu'un iPhone laisserait glisser de côté) ;
//    H2 Vestiaire une ligne longue posée dans chaque carte de la section (la forme de « N°215 · adidas
//                 handball spezial marron taille 38… ») : aucune carte ne sort de l'écran. La section était
//                 un `flex` en colonne sous la règle `align-items:center` d'une ancienne GRILLE
//                 (`.vrm-market-space`, styles-mineral.css) : la carte s'élargissait des deux côtés ;
//  B. BALAYAGE (`PARTIES=balayage`) : chaque écran au téléphone, voir plus bas.
//  `CAS=annonces-vestiaire,colis` `LARGEURS=390` `THEMES=clair` pour un sous-ensemble ;
//  `BANC_DIST=` le build jugé (avant/après) ; `SHOTS=` les captures (à REGARDER, §6.2).
//  Un banc ne meurt pas, il rapporte. Preuve : rouge sur origin/claude/integration-refonte,
//  vert après ; mutation (la feuille fermée garde `vrm-ui-voile`) ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const D2 = require('./design-passe-2.cjs');
const { chromium, ouvrir, pret, srv, PORT } = P;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const CAS_VOULUS = liste('CAS', '');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-afaire-feuille');
fs.mkdirSync(SHOTS, { recursive: true });

// Un geste qui ouvre AILLEURS : celui que l'écran marque comme tel (`data-*ouvrir`, `data-*completer`,
// `aria-haspopup`, `data-afaire-ferme` + une feuille derrière) — la même lecture que src/ui/AFaire.jsx.
const SEL_AILLEURS = '[data-vc-baisse-ouvrir], [data-tournee-ouvrir], [data-refaire-ouvrir], [data-depot-ouvrir], [data-ann-achats-completer], [data-lbc-baisse-ouvrir], [data-repub-lbc-ouvrir], button[aria-haspopup="dialog"]';
const CAS = [
  { nom: 'annonces-vestiaire', url: '/?tab=annonces&site=vestiaire', ligne: '[data-pf-afaire="vestiaire"]', feuille: '[data-pf-afaire-feuille="vestiaire"]', base: D2.baseSites, largeurs: [390, 1512], sonde: '[data-tache-vestiaire]' },
  { nom: 'annonces-leboncoin', url: '/?tab=annonces&site=leboncoin', ligne: '[data-pf-afaire="leboncoin"]', feuille: '[data-pf-afaire-feuille="leboncoin"]', base: D2.baseSites, largeurs: [390, 1512] },
  { nom: 'annonces-ebay', url: '/?tab=annonces&site=ebay', ligne: '[data-pf-afaire="ebay"]', feuille: '[data-pf-afaire-feuille="ebay"]', base: D2.baseSites, largeurs: [390, 1512] },
  // Annonces · Vinted et Colis : à l'ordinateur, les alertes sont posées dans la page (aucune feuille).
  { nom: 'annonces-vinted', url: '/?tab=annonces', ligne: '.vrm-ann-afaire[data-ui-afaire]', feuille: '[data-ui-afaire-feuille]', base: D2.baseSites, largeurs: [390] },
  { nom: 'colis', url: '/?tab=ventes', ligne: '.vrm-colis-afaire[data-ui-afaire]', feuille: '[data-ui-afaire-feuille]', base: D2.baseSites, largeurs: [390] },
  { nom: 'exemple-annonces', exemple: true, url: '/?tab=annonces', ligne: '[data-ui-afaire]', feuille: '[data-ui-afaire-feuille], [data-pf-afaire-feuille]', largeurs: [390] },
  { nom: 'exemple-colis', exemple: true, url: '/?tab=ventes', ligne: '[data-ui-afaire]', feuille: '[data-ui-afaire-feuille], [data-pf-afaire-feuille]', largeurs: [390] },
];

// ── La mesure, DANS la page ─────────────────────────────────────────────────
function mesurer() {
  const iw = window.innerWidth, ih = window.innerHeight;
  const vis = (el) => { if (!el || !el.isConnected) return false; if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const nom = (el) => { const c = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : ''; const d = [...el.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 1).map((a) => `[${a.name}]`).join(''); return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${d}`; };
  const alpha = (s) => { const m = String(s || '').match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length > 3 ? p[3] : 1; };
  // Les calques fixes qui couvrent l'écran et prennent les touchers (un voile, une feuille plein écran).
  const couvrants = [...document.body.querySelectorAll('*')].filter((el) => {
    const cs = getComputedStyle(el); if (cs.position !== 'fixed' || cs.pointerEvents === 'none' || !vis(el)) return false;
    const r = el.getBoundingClientRect(); if (r.width < iw * 0.9 || r.height < ih * 0.9) return false;
    return alpha(cs.backgroundColor) > 0.04 || el.matches('.vrm-ui-voile, .vrm-fs-voile, .vrm-fs-cadre');
  }).map(nom);
  const voiles = [...document.querySelectorAll('.vrm-ui-voile, .vrm-fs-voile, [role="dialog"]')].filter(vis).map(nom);
  const hiddenDessines = [...document.querySelectorAll('body [hidden]')].filter((el) => getComputedStyle(el).display !== 'none' && vis(el)).slice(0, 6).map(nom);
  // Ce qu'un iPhone laisserait glisser de côté : un élément hors de l'écran qu'aucun parent ne coupe.
  const depasse = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (depasse.length >= 6) break;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    if (r.right <= iw + 1 && r.left >= -1) continue;
    if (getComputedStyle(el).position === 'fixed' && r.right <= iw + 1) continue;
    let coupe = false;
    for (let x = el.parentElement; x && x !== document.documentElement; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.overflowX !== 'visible' || cs.clipPath !== 'none' || cs.contain.includes('paint')) { const q = x.getBoundingClientRect(); if (q.right <= iw + 1 && q.left >= -1) { coupe = true; break; } }
      if (cs.position === 'fixed') break;
    }
    if (!coupe && vis(el)) depasse.push(`${nom(el)} [${Math.round(r.left)}…${Math.round(r.right)}]`);
  }
  // Les défilements horizontaux internes (une rangée de capsules) : ils ne doivent pas bouger tout seuls.
  const internes = {};
  let i = 0;
  for (const el of document.body.querySelectorAll('*')) { i++; if (el.scrollLeft) internes[nom(el) + '#' + i] = el.scrollLeft; }
  const main = document.querySelector('.vrm-main');
  const scroller = document.scrollingElement || document.documentElement;
  return { iw, sx: window.scrollX, sl: scroller.scrollLeft, sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, sy: window.scrollY, mainY: main ? main.scrollTop : 0, mainX: main ? main.scrollLeft : 0, mainSW: main ? main.scrollWidth : 0, mainCW: main ? main.clientWidth : 0, couvrants, voiles, hiddenDessines, depasse, internes, url: location.search };
}
// `.vrm-main` défile en hauteur ; en largeur, il ne doit RIEN avoir à faire défiler (sinon un focus, un
// `scrollIntoView` ou un toucher le décale — et il reste décalé).
const horizontalOk = (m) => m.sx === 0 && m.sl === 0 && m.mainX === 0 && m.sw <= m.iw && m.bw <= m.iw && m.mainSW <= m.mainCW && m.depasse.length === 0;
const dirH = (m) => `scrollX ${m.sx}, scrollLeft ${m.sl}, main ${m.mainX} (largeur défilable ${m.mainSW}/${m.mainCW}), scrollWidth ${m.sw}/${m.bw} pour ${m.iw}${m.depasse.length ? ', dépasse : ' + m.depasse.join(' ; ') : ''}`;

// La feuille ouverte (celle de CE cas), visible.
const feuilleVisible = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].some((el) => el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && el.getBoundingClientRect().height > 1 : el.getClientRects().length > 0), sel);
const attendreQue = async (pg, f, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f().catch(() => false)) return true; await pg.waitForTimeout(150); } return false; };

// Qui est au-dessus, au centre d'un élément de la feuille ?
const dessus = (pg, sel) => pg.evaluate((sel) => {
  const el = [...document.querySelectorAll(sel)].find((x) => x.getClientRects().length && x.getBoundingClientRect().height > 1); if (!el) return { ok: false, quoi: 'absent' };
  const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { ok: !!h && (h === el || el.contains(h)), quoi: h ? `${h.tagName.toLowerCase()}.${String(h.className).slice(0, 40)}` : 'rien' };
}, sel);

async function glisser(o, feuilleSel) {
  const pt = await o.pg.evaluate((sel) => {
    const f = [...document.querySelectorAll(sel)].find((x) => x.getClientRects().length); if (!f) return null;
    const p = f.querySelector('[data-ui-feuille-poignee], [data-feuille-poignee]');
    const t = f.querySelector('.vrm-ui-feuille-titre, .vrm-fs-titre');
    const cible = p && p.getBoundingClientRect().height > 1 ? p : t; if (!cible) return null;
    const r = cible.getBoundingClientRect(); return { x: Math.round(r.left + Math.min(r.width / 2, 40)), y: Math.round(r.top + r.height / 2) };
  }, feuilleSel);
  if (!pt) return false;
  if (o.tel) {
    const cdp = await o.ctx.newCDPSession(o.pg);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] });
    for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pt.x, y: pt.y + k * 25, id: 1 }] }); await o.pg.waitForTimeout(12); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach().catch(() => {});
  } else {
    await o.pg.mouse.move(pt.x, pt.y); await o.pg.mouse.down();
    for (let k = 1; k <= 12; k++) { await o.pg.mouse.move(pt.x, pt.y + k * 25); await o.pg.waitForTimeout(12); }
    await o.pg.mouse.up();
  }
  return true;
}
async function toucherVoile(o) {
  // Un point du voile hors de la feuille : en haut au téléphone, à gauche à l'ordinateur. On vérifie que c'est
  // bien LE VOILE qui est là (un calque au-dessus de lui prendrait le toucher : c'est un défaut, dit).
  const W = o.tel ? 390 : 1512;
  const pt = o.tel ? { x: W / 2, y: 70 } : { x: 60, y: 400 };
  const qui = await o.pg.evaluate(({ x, y }) => { const h = document.elementFromPoint(x, y); return h ? { voile: !!h.closest('.vrm-ui-voile, .vrm-fs-voile') && !h.closest('[role="dialog"]'), quoi: `${h.tagName.toLowerCase()}.${String(h.className).slice(0, 40)}` } : { voile: false, quoi: 'rien' }; }, pt);
  if (o.tel) await o.pg.touchscreen.tap(pt.x, pt.y); else await o.pg.mouse.click(pt.x, pt.y);
  return qui;
}
async function toucherSel(o, sel) {
  const l = o.pg.locator(sel).filter({ visible: true }).first();
  if (!(await l.count())) return false;
  await l.scrollIntoViewIfNeeded().catch(() => {});
  if (o.tel) await l.tap({ timeout: 4000 }).catch(() => l.click({ timeout: 4000, force: true }).catch(() => {}));
  else await l.click({ timeout: 4000 }).catch(() => {});
  return true;
}

let rouges = 0, verts = 0;
const rapport = [];
const dit = (ok, quoi, detail = '') => { if (ok) verts++; else rouges++; rapport.push({ ok, quoi, detail }); console.log(`${ok ? '  ✓' : '  ✗'} ${quoi}${!ok && detail ? '\n      ' + String(detail).slice(0, 600) : ''}`); };

async function preparer(nav, c, W, sombre) {
  if (c.exemple) {
    const o = await ouvrir(nav, { W, sombre, b: { main: [], rows: [], accounts: [] }, url: '/?exemple', sansSession: true });
    await o.pg.waitForSelector('[data-exemple-bandeau]', { timeout: 25000 }).catch(() => {});
    await o.pg.waitForTimeout(1500);
    await o.pg.goto(`http://localhost:${PORT}${c.url}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await o.pg.waitForSelector('[data-exemple-bandeau]', { timeout: 20000 }).catch(() => {});
    await pret(o.pg);
    return o;
  }
  const o = await ouvrir(nav, { W, sombre, b: c.base(), url: c.url, api: D2.api });
  await pret(o.pg);
  return o;
}

async function unCas(nav, c, W, theme) {
  const sombre = theme === 'sombre';
  const T = `[${c.nom} ${W}${W < 600 ? ' tactile' : ''} ${theme}]`;
  let o;
  try {
    o = await preparer(nav, c, W, sombre);
    o.pg.on('dialog', (d) => d.dismiss().catch(() => {}));
    await o.pg.waitForTimeout(1200);
    const m0 = await o.pg.evaluate(mesurer);
    // F0 — à l'arrivée, rien n'est ouvert.
    dit(m0.voiles.length === 0, `${T} F0 à l'arrivée, aucune feuille ni voile dessinés`, m0.voiles.join(', '));
    dit(m0.hiddenDessines.length === 0, `${T} F0 aucun élément [hidden] dessiné`, m0.hiddenDessines.join(', '));
    dit(horizontalOk(m0), `${T} H avant : rien ne décale la page de côté`, dirH(m0));
    await o.pg.screenshot({ path: path.join(SHOTS, `${c.nom}-${W}-${theme}-0-arrivee.png`) }).catch(() => {});
    // H2 — une ligne LONGUE dans chaque carte de l'écran (la forme de la ligne de Julien : « N°215 · adidas
    // handball spezial marron taille 38 · 62 € · 13 photos », sans retour possible) : la carte garde la largeur
    // de l'écran (elle coupe ou passe à la ligne), elle ne s'élargit pas de part et d'autre. Sonde posée puis retirée.
    if (c.sonde) {
      const s = await o.pg.evaluate((sel) => {
        const sec = document.querySelector(sel); if (!sec) return { absent: true };
        const iw = window.innerWidth, out = [];
        for (const k of [...sec.children]) {
          if (!k.getClientRects().length) continue;
          const d = document.createElement('div'); d.setAttribute('data-banc-sonde', '');
          d.style.cssText = 'white-space:nowrap;font:600 13px/1.3 system-ui;overflow:hidden;text-overflow:ellipsis';
          d.textContent = 'N°215 · adidas handball spezial marron taille 38 · 62 € · 13 photos · Étiquette : pas choisie · Photos Vestiaire 1 manque · 7 à vérifier';
          k.appendChild(d);
          const r = k.getBoundingClientRect(); const sw = document.documentElement.scrollWidth;
          out.push({ quoi: `${k.tagName.toLowerCase()}.${String(k.className).slice(0, 30)}`, l: Math.round(r.left), r: Math.round(r.right), sw });
          d.remove();
        }
        return { iw, out, alignement: getComputedStyle(sec).alignItems };
      }, c.sonde);
      const mauvais = (s.out || []).filter((x) => x.l < 0 || x.r > s.iw || x.sw > s.iw);
      dit(!s.absent && mauvais.length === 0, `${T} H2 une ligne longue ne fait pas déborder les cartes de l'écran`, JSON.stringify({ alignement: s.alignement, mauvais }));
    }
    if (!(await o.pg.locator(c.ligne).filter({ visible: true }).count())) {
      dit(false, `${T} F1 la ligne « À faire » est à l'écran (sans elle, ce banc ne juge rien)`, `${c.ligne} absent — ${m0.url}`);
      return;
    }
    // F1 + F2 : ouvrir, puis chaque fermeture.
    const methodes = ['ok', 'voile', 'glisser', 'retour'].concat(W >= 600 ? ['echap'] : []);
    for (const mth of methodes) {
      const avant = await o.pg.evaluate(mesurer);
      await toucherSel(o, c.ligne);
      const ouverte = await attendreQue(o.pg, () => feuilleVisible(o.pg, c.feuille));
      if (!ouverte) { dit(false, `${T} F1 toucher « À faire » ouvre sa feuille (${mth})`); continue; }
      await o.pg.waitForTimeout(450);   // l'animation d'entrée
      const pendant = await o.pg.evaluate(mesurer);
      if (mth === 'ok') {
        dit(true, `${T} F1 toucher « À faire » ouvre sa feuille`);
        const d = await dessus(o.pg, `${c.feuille.split(',')[0]} [data-ui-feuille-ok], ${c.feuille.split(',')[0]} .vrm-ui-feuille-fermer`);
        dit(d.ok, `${T} F1 « OK » n'est couvert par rien`, d.quoi);
        dit(horizontalOk(pendant), `${T} H pendant : la feuille ouverte ne décale rien`, dirH(pendant));
        await o.pg.screenshot({ path: path.join(SHOTS, `${c.nom}-${W}-${theme}-1-ouverte.png`) }).catch(() => {});
      }
      let note = '';
      if (mth === 'ok') await toucherSel(o, `${c.feuille.split(',')[0]} .vrm-ui-feuille-fermer`).then((x) => { if (!x) note = 'OK introuvable'; });
      else if (mth === 'voile') { const q = await toucherVoile(o); if (!q.voile) note = `au point touché : ${q.quoi}`; }
      else if (mth === 'glisser') { if (!(await glisser(o, c.feuille))) note = 'ni poignée ni titre'; }
      else if (mth === 'retour') await o.pg.evaluate(() => history.back());
      else if (mth === 'echap') await o.pg.keyboard.press('Escape');
      const fermee = await attendreQue(o.pg, async () => !(await feuilleVisible(o.pg, c.feuille)), 3500);
      await o.pg.waitForTimeout(500);
      const apres = await o.pg.evaluate(mesurer);
      const nouveaux = apres.couvrants.filter((x) => !avant.couvrants.includes(x));
      const internesBouges = Object.keys({ ...avant.internes, ...apres.internes }).filter((k) => (avant.internes[k] || 0) !== (apres.internes[k] || 0));
      dit(fermee && !note, `${T} F2 « ${mth} » ferme la feuille`, note || (fermee ? '' : 'toujours ouverte'));
      dit(apres.voiles.length === 0 && nouveaux.length === 0, `${T} F2 « ${mth} » : aucun voile laissé`, `voiles ${apres.voiles.join(', ')} · couvrants nouveaux ${nouveaux.join(', ')}`);
      dit(horizontalOk(apres) && internesBouges.length === 0, `${T} H après « ${mth} » : la page n'est pas décalée`, `${dirH(apres)}${internesBouges.length ? ' · défilements internes bougés : ' + internesBouges.join(', ') : ''}`);
      const memeEcran = apres.url === avant.url && (await o.pg.locator(c.ligne).filter({ visible: true }).count()) > 0;
      dit(Math.abs(apres.sy - avant.sy) <= 2 && Math.abs(apres.mainY - avant.mainY) <= 2 && memeEcran, `${T} F2 « ${mth} » : la page revient telle quelle (défilement, même écran : « À faire » toujours là)`, `y ${avant.sy}→${apres.sy}, main ${avant.mainY}→${apres.mainY}, ${avant.url}→${apres.url}, même écran ${memeEcran}`);
      if (!memeEcran) { await o.pg.goto(`http://localhost:${PORT}${c.url}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await pret(o.pg); }
      if (!fermee || apres.voiles.length) { await o.pg.screenshot({ path: path.join(SHOTS, `${c.nom}-${W}-${theme}-2-${mth}-PAS-FERMEE.png`) }).catch(() => {}); }
    }
    // F3 : un geste qui ouvre une AUTRE feuille.
    await toucherSel(o, c.ligne);
    if (await attendreQue(o.pg, () => feuilleVisible(o.pg, c.feuille))) {
      await o.pg.waitForTimeout(400);
      const cible = c.feuille.split(',').map((f) => `${f.trim()} :is(${SEL_AILLEURS})`).join(', ');
      const n = await o.pg.locator(cible).filter({ visible: true }).count();
      if (!n) dit(true, `${T} F3 (aucun geste qui ouvre ailleurs dans cette feuille : rien à juger)`);
      else {
        const lib = await o.pg.locator(cible).filter({ visible: true }).first().innerText().catch(() => '');
        await toucherSel(o, cible);
        await o.pg.waitForTimeout(1500);
        const afaire = await feuilleVisible(o.pg, c.feuille);
        const m = await o.pg.evaluate(mesurer);
        const top = await o.pg.evaluate(() => {
          const d = [...document.querySelectorAll('[role="dialog"]')].filter((x) => x.getClientRects().length && x.getBoundingClientRect().height > 1);
          const el = d[d.length - 1]; if (!el) return { n: 0 };
          const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + 30, r.bottom - 4));
          return { n: d.length, dessus: !!h && el.contains(h) };
        });
        dit(!afaire, `${T} F3 « ${lib.trim().slice(0, 40)} » : « À faire » est fermée d'abord`);
        dit(top.n <= 1 && (top.n === 0 || top.dessus), `${T} F3 la feuille ouverte est seule et au-dessus`, JSON.stringify({ ...top, voiles: m.voiles }));
        dit(horizontalOk(m), `${T} H pendant l'autre feuille : rien ne décale la page`, dirH(m));
        await o.pg.screenshot({ path: path.join(SHOTS, `${c.nom}-${W}-${theme}-3-ailleurs.png`) }).catch(() => {});
        // Refermer l'autre feuille (« retour », comme son pouce), puis plus rien.
        for (let k = 0; k < 3; k++) {
          const encore = await o.pg.evaluate(() => [...document.querySelectorAll('.vrm-ui-voile, .vrm-fs-voile, [role="dialog"]')].some((x) => x.getClientRects().length && x.getBoundingClientRect().height > 1));
          if (!encore) break;
          await o.pg.keyboard.press('Escape').catch(() => {}); await o.pg.waitForTimeout(500);
          const encore2 = await o.pg.evaluate(() => [...document.querySelectorAll('.vrm-ui-voile, .vrm-fs-voile, [role="dialog"]')].some((x) => x.getClientRects().length && x.getBoundingClientRect().height > 1));
          if (!encore2) break;
          await o.pg.evaluate(() => history.back()); await o.pg.waitForTimeout(700);
        }
        const fin = await o.pg.evaluate(mesurer);
        dit(fin.voiles.length === 0, `${T} F3 l'autre feuille refermée : aucun voile laissé`, fin.voiles.join(', '));
        dit(horizontalOk(fin), `${T} H à la fin : la page n'est pas décalée`, dirH(fin));
      }
    } else dit(false, `${T} F3 « À faire » se rouvre`);
    // F4 — CHAQUE geste de la feuille (au plus 8) : s'il ouvre une feuille, un menu ou une saisie, « À faire »
    // n'est plus au-dessus d'elle (sinon : une feuille ouverte DERRIÈRE le voile, invisible, et le doigt
    // qui ne trouve rien). Un geste qui agit sur place (déplier, cocher) peut laisser « À faire » ouverte.
    if (await o.pg.locator(c.ligne).filter({ visible: true }).count()) {
      const premier = c.feuille.split(',')[0].trim();
      for (let i = 0; i < 8; i++) {
        await fermerTout(o);
        if (!(await o.pg.locator(c.ligne).filter({ visible: true }).count())) { await o.pg.goto(`http://localhost:${PORT}${c.url}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await pret(o.pg); }
        await toucherSel(o, c.ligne);
        if (!(await attendreQue(o.pg, () => feuilleVisible(o.pg, c.feuille)))) break;
        await o.pg.waitForTimeout(350);
        const gestes = o.pg.locator(`${premier} :is(button, a[href], [role="button"], summary):not(.vrm-ui-feuille-fermer)`).filter({ visible: true });
        const n = await gestes.count();
        if (i >= n) break;
        const g = gestes.nth(i);
        const lib = ((await g.getAttribute('aria-label').catch(() => '')) || (await g.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        const href = await g.getAttribute('href').catch(() => null);
        if (href && /^https?:/.test(href)) continue;   // un lien qui part sur un autre site : rien à juger ici
        const avant = await o.pg.evaluate(() => [...document.querySelectorAll('[role="dialog"], .vrm-fs-voile, [data-feuille]')].filter((x) => x.getClientRects().length && x.getBoundingClientRect().height > 1).length);
        if (o.tel) await g.tap({ timeout: 3000 }).catch(() => {}); else await g.click({ timeout: 3000 }).catch(() => {});
        await o.pg.waitForTimeout(1200);
        const r = await o.pg.evaluate((sel) => {
          const nous = [...document.querySelectorAll(sel)].find((x) => x.getClientRects().length && x.getBoundingClientRect().height > 1);
          const autres = [...document.querySelectorAll('[role="dialog"], [data-feuille], [data-confirm], .vrm-confirm')].filter((x) => x.getClientRects().length && x.getBoundingClientRect().height > 1 && (!nous || (!nous.contains(x) && !x.contains(nous))));
          // Une autre couche est-elle visible AU-DESSUS de nous ? (point au centre de l'autre couche)
          const derriere = nous ? autres.filter((x) => { const q = x.getBoundingClientRect(); const h = document.elementFromPoint(q.left + q.width / 2, q.top + Math.min(40, q.height / 2)); return !(h && x.contains(h)); }) : [];
          return { ouverte: !!nous, autres: autres.length, derriere: derriere.map((x) => `${x.tagName.toLowerCase()}.${String(x.className).slice(0, 30)}`) };
        }, premier);
        dit(r.derriere.length === 0, `${T} F4 « ${lib} » : rien ne s'ouvre derrière « À faire »`, JSON.stringify(r));
      }
      await fermerTout(o);
    }
    if (o.erreurs.length) dit(false, `${T} aucune erreur JS`, o.erreurs.join(' | '));
  } catch (e) {
    dit(false, `${T} le cas a pu se jouer`, String(e && e.stack || e).slice(0, 400));
  } finally { if (o) await o.ctx.close().catch(() => {}); }
}

// ── B. LE BALAYAGE : chaque écran au téléphone (390 tactile, clair), chaque feuille ou menu visible ──
//  B0 à l'arrivée : rien ne dépasse, aucun [hidden] dessiné, aucun voile ; B1 un balayage horizontal du
//  doigt au milieu de l'écran ne décale pas la page ; B2 chaque ouvreur visible (`aria-haspopup`, « À faire »,
//  menu de compte, `data-*-ouvrir`, au plus OUVREURS par écran) : ouvert, rien ne dépasse ; refermé par
//  « retour » (puis Échap, puis le voile), aucun calque couvrant de plus qu'au départ, page pas décalée.
const ECRANS_BALAYAGE = liste('ECRANS', 'journee,ventes,annonces,annonces&site=leboncoin,annonces&site=ebay,annonces&site=vestiaire,ventes&site=leboncoin,ventes&site=ebay,ventes&site=vestiaire,achats,stockvinted,messages,emails,compta,settings,communaute,trancher,semaine,litiges,garage,masques,organisation,parrainage,vintedaccounts,inventory,catalog,cat_msg,cat_bord,dashboard');
const OUVREURS = Number(process.env.OUVREURS || 6);
const SEL_OUVREURS = '.vrm-main :is(button[aria-haspopup], [data-ui-afaire], [data-pf-afaire], .vrm-ui-menu-compte, button[data-refaire-ouvrir], button[data-tournee-ouvrir], button[data-depot-ouvrir], button[data-num-neufs-ouvrir])';
async function fermerTout(o) {
  const ouvert = () => o.pg.evaluate(() => [...document.querySelectorAll('.vrm-ui-voile, .vrm-fs-voile, [role="dialog"]')].some((x) => x.getClientRects().length && x.getBoundingClientRect().height > 1)).catch(() => false);
  let dernier = 'deja';   // le geste qui a fermé (le précédent de celui qu'on trouve fermé)
  for (const geste of ['retour', 'echap', 'voile']) {
    if (!(await ouvert())) return dernier;
    dernier = geste;
    if (geste === 'retour') await o.pg.evaluate(() => history.back()).catch(() => {});
    else if (geste === 'echap') await o.pg.keyboard.press('Escape').catch(() => {});
    else await o.pg.touchscreen.tap(195, 60).catch(() => {});
    await o.pg.waitForTimeout(700);
  }
  return (await ouvert()) ? 'reste' : 'voile';
}
async function balayage(nav) {
  for (const ecran of ECRANS_BALAYAGE) {
    if (nav.vivant) await nav.vivant();
    const url = `/?tab=${ecran}`;
    const T = `[balayage ${ecran} 390 tactile]`;
    let o;
    try {
      o = await ouvrir(nav, { W: 390, sombre: false, b: D2.baseSites(), url, api: D2.api });
      o.pg.on('dialog', (d) => d.dismiss().catch(() => {}));
      await pret(o.pg); await o.pg.waitForTimeout(800);
      const m0 = await o.pg.evaluate(mesurer);
      dit(horizontalOk(m0) && m0.hiddenDessines.length === 0 && m0.voiles.length === 0, `${T} B0 à l'arrivée : rien ne dépasse, rien de caché dessiné, aucun voile`, `${dirH(m0)} · hidden dessinés ${m0.hiddenDessines.join(', ')} · voiles ${m0.voiles.join(', ')}`);
      // B1 : le doigt balaie de droite à gauche au milieu de l'écran.
      const cdp = await o.ctx.newCDPSession(o.pg);
      await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 500, xDistance: -160, yDistance: 0, gestureSourceType: 'touch', speed: 800 }).catch(() => {});
      await cdp.detach().catch(() => {});
      await o.pg.waitForTimeout(400);
      const m1 = await o.pg.evaluate(mesurer);
      dit(m1.sx === 0 && m1.sl === 0 && m1.mainX === 0, `${T} B1 un balayage horizontal ne décale pas la page`, dirH(m1));
      const n = Math.min(OUVREURS, await o.pg.locator(SEL_OUVREURS).filter({ visible: true }).count());
      for (let i = 0; i < n; i++) {
        const l = o.pg.locator(SEL_OUVREURS).filter({ visible: true }).nth(i);
        if (!(await l.count())) break;
        const lib = ((await l.getAttribute('aria-label').catch(() => '')) || (await l.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        const avant = await o.pg.evaluate(mesurer);
        await l.scrollIntoViewIfNeeded().catch(() => {});
        const base = await o.pg.evaluate(mesurer);
        await l.tap({ timeout: 3000 }).catch(() => {});
        await o.pg.waitForTimeout(800);
        const p = await o.pg.evaluate(mesurer);
        const changeEcran = p.url !== avant.url;
        dit(horizontalOk(p), `${T} B2 « ${lib} » ouvert : rien ne dépasse`, dirH(p));
        const comment = await fermerTout(o);
        const a = await o.pg.evaluate(mesurer);
        const nouveaux = a.couvrants.filter((x) => !base.couvrants.includes(x));
        dit(comment !== 'reste' && a.voiles.length === 0 && nouveaux.length === 0, `${T} B2 « ${lib} » se referme sans laisser de voile (${comment})`, `voiles ${a.voiles.join(', ')} · couvrants nouveaux ${nouveaux.join(', ')}`);
        dit(horizontalOk(a), `${T} B2 après « ${lib} » : la page n'est pas décalée`, dirH(a));
        if (comment === 'reste' || a.voiles.length) await o.pg.screenshot({ path: path.join(SHOTS, `balayage-${ecran.replace(/\W+/g, '_')}-${i}-reste.png`) }).catch(() => {});
        if (changeEcran || a.url !== avant.url) { await o.pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await pret(o.pg); }
      }
      if (o.erreurs.length) dit(false, `${T} aucune erreur JS`, o.erreurs.join(' | '));
    } catch (e) {
      dit(false, `${T} l'écran a pu se jouer`, String(e && e.stack || e).slice(0, 400));
    } finally { if (o) await o.ctx.close().catch(() => {}); }
  }
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  // Un navigateur tombé (machine chargée : « Target crashed ») est relancé pour le cas suivant — le cas
  // tombé reste dit rouge (« le cas a pu se jouer ») : relancer le banc seul avant de conclure.
  const lancer = () => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage'] });
  let navR = await lancer();
  const nav = new Proxy({}, { get: (_, k) => { const v = navR[k]; return typeof v === 'function' ? v.bind(navR) : v; } });
  const vivant = async () => { if (!navR.isConnected()) { try { navR = await lancer(); } catch (_) {} } };
  const PARTIES = liste('PARTIES', 'feuilles,balayage');
  if (PARTIES.includes('feuilles')) for (const W of LARGEURS) for (const theme of THEMES) for (const c of CAS) {
    if (CAS_VOULUS.length && !CAS_VOULUS.includes(c.nom)) continue;
    if (!c.largeurs.includes(W)) continue;
    console.log(`— ${c.nom} ${W} ${theme}`);
    await vivant();
    await unCas(nav, c, W, theme);
  }
  if (PARTIES.includes('balayage')) { console.log('— balayage de tous les écrans (390 tactile)'); await balayage(Object.assign(Object.create(nav), { vivant, newContext: (...a) => navR.newContext(...a) })); }
  await navR.close().catch(() => {}); srv.close();
  fs.writeFileSync(path.join(SHOTS, 'rapport.json'), JSON.stringify(rapport, null, 1));
  console.log(`\nafaire-feuille : ${verts} vert(s), ${rouges} rouge(s) — captures ${SHOTS}`);
  process.exit(rouges ? 1 : 0);
})();
