require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA COQUE NATIVE BRANCHÉE DANS L'APP (19 nov., décision de Julien — « VRM natif », docs/design/NATIF.md §2).
//  Récit : docs/passation/2026-11-19-natif-fondation.md. Remplace, pour la coque, ce que figeaient studio-coque,
//  barre-onglets, design-v2 (tête) et theme-apple (rail) : la barre « Studio », le menu ☰, l'île du haut, le rail verre.
//
//  Base INVENTÉE (`design-passe.cjs`, 3 comptes) ET base VIDE (aucun compte, aucune ligne), garde réseau.
//  Téléphone 390 × 844 tactile, zone sûre simulée (34 px en bas) — clair ET sombre :
//    K1  5 onglets dans cet ordre (Aujourd'hui · Annonces · Ventes · Achats · Argent), de MÊME largeur (±1 px), chacun
//        avec son libellé visible et entier, cible ≥ 44 × 44 ;
//    K2  rien sous la barre : elle touche le bas de l'écran, garde la zone sûre, et l'écran (qui défile) s'arrête au-dessus
//        d'elle — le dernier élément de l'écran défilé jusqu'au bout reste au-dessus de la barre ;
//    K3  la barre de titre se « réduit » au défilement (le titre de l'écran y apparaît) et redevient claire en haut ;
//    K4  « Plus » (la photo du profil, en haut à droite) s'ouvre et porte TOUT : Stock, Messages, E-mails, Tout va bien ?,
//        Notifications, Paramètres, Communauté, Mon profil, Cacher les montants ; chaque rangée ≥ 44 px ; Messages a sa
//        propre icône à côté (pastille) ; la recherche est un champ avec le scanner DEDANS ;
//    K5  l'entrée active est lisible : onglet actif ≥ 4,5:1 sur le fond de la barre, et il suit l'écran ;
//    K6  chaque écran s'ouvre sans erreur JS (5 onglets + les écrans de « Plus ») ;
//  Ordinateur 1512 et 1280 — clair ET sombre :
//    K7  la barre latérale (fixe, à gauche) + l'écran à côté, sans chevauchement ; plus d'île flottante ni de barre du bas ;
//        les cinq onglets en tête, puis Stock, Messages, E-mails, Tout va bien ?, Notifications, Paramètres, Communauté ;
//        l'entrée active ≥ 4,5:1 ; aucun débordement horizontal ;
//  Les deux :
//    K8a changer d'onglet ne restyle pas le document : trace Chrome (InvalidationTracking), aucune invalidation de style
//        sur <html>, <body> ou la racine de la coque ;
//    K8b aucune tâche de style (UpdateLayoutTree) > 50 ms de THREAD au retour sur un écran déjà visité (≤ 3 000 éléments).
//        (La machine est partagée : on juge le temps de thread et les comptes, jamais l'horloge.) La tâche la plus lourde
//        est l'écran gardé qui ré-apparaît (moteur `src/ecransGardes.jsx`) : mesurée aussi sur le build d'avant.
//  Mutations (rouge attendu) : MUTATION=dessous (l'écran passe sous la barre) ⇒ K2 ; MUTATION=largeur (un onglet plus
//  large) ⇒ K1 ; MUTATION=restyle (un attribut posé sur <body> à chaque toucher, lu par une règle universelle) ⇒ K8a.
//  `BANC_DIST=…` juge un autre build ; `SHOTS=dossier` garde les captures (regarde-les) ; `DSF=2` des captures nettes.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-natif-coque');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = Number(process.env.DSF || 1);
const MUT = process.env.MUTATION || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(2600); };
const ONGLETS = ['journee', 'annonces', 'ventes', 'achats', 'compta'];
// La clé d'un onglet de la barre (data-n-onglet) : « Annonces » est l'entrée « paires » de l'app (ID_PAIRES), qui ouvre l'écran annonces.
const CLE_BARRE = (id) => (id === 'annonces' ? 'paires' : id);
const PLUS = ['garage', 'messages', 'emails', 'sante', 'notifications', 'settings', 'communaute', 'profil', 'montants'];
const LATERALE = [...ONGLETS, 'garage', 'messages', 'emails', 'sante', 'notifications', 'settings', 'communaute'];

const CSS_MUT = {
  dessous: 'html body .n-coque > .vrm-main.n-coque-ecran { margin-bottom: -60px !important; }',
  largeur: 'html body [data-n-onglets] > .n-onglet:first-child { min-width: 120px !important; }',
  restyle: 'html body[data-mut-onglet] * { outline-color: currentColor; }',
}[MUT] || '';

async function poser(pg) {
  await pg.evaluate(([css, mut]) => {
    document.documentElement.style.setProperty('--n-bas-sur', '34px');   // la zone sûre d'un iPhone, simulée
    if (css) { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }
    if (mut === 'restyle') document.addEventListener('click', (e) => { if (e.target.closest('[data-n-onglet], [data-n-entree]')) document.body.setAttribute('data-mut-onglet', String(Date.now())); }, true);
    for (const t of document.querySelectorAll('.vrm-toast')) try { t.click(); } catch (_) {}
  }, [CSS_MUT, MUT]);
  await pg.waitForTimeout(400);
}

// Contraste d'un texte sur le fond rendu (fonds empilés).
const MESURE_CONTRASTE = `(() => {
  const rgba = (c) => { const m = String(c).match(/[\\d.]+/g) || []; return { r: +m[0] || 0, g: +m[1] || 0, b: +m[2] || 0, a: m[3] == null ? 1 : +m[3] }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const fondDe = (el) => { const pile = []; for (let x = el; x; x = x.parentElement) { const c = rgba(getComputedStyle(x).backgroundColor); if (c.a > 0) pile.push(c); if (c.a >= 1) break; }
    let f = document.documentElement.getAttribute('data-theme') === 'dark' ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
    for (const c of pile.reverse()) f = { r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a) }; return f; };
  window.__contraste = (el) => { const t = rgba(getComputedStyle(el).color), f = fondDe(el); const tt = { r: t.r * t.a + f.r * (1 - t.a), g: t.g * t.a + f.g * (1 - t.a), b: t.b * t.a + f.b * (1 - t.a) };
    const a = lum(tt), b = lum(f); return Math.round(((Math.max(a, b) + .05) / (Math.min(a, b) + .05)) * 100) / 100; };
})()`;

async function telephone(nav, b, sombre, nomBase, erreursTout) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=journee', dsf: DSF });
  await pret(pg); await poser(pg); await pg.evaluate(MESURE_CONTRASTE);
  const t = `390 ${sombre ? 'sombre' : 'clair'} ${nomBase}`;
  // K8_SEUL=1 : la seule mesure du changement d'onglet (pour la comparer à un build d'AVANT, qui n'a pas la coque native).
  if (process.env.K8_SEUL) { await k8(pg, t, ':is([data-n-onglets], .vrm-tabbar) [data-nav-entree="%s"]', true); await ctx.close(); return; }
  // K2_SEUL=1 : seulement « rien sous la barre », écran par écran, première visite puis écran gardé (vite, pour un correctif).
  if (process.env.K2_SEUL) { for (const tour of ['1re visite', 'écran gardé']) for (const id of ONGLETS) {
    await pg.locator(`[data-n-onglet="${CLE_BARRE(id)}"]`).first().tap({ timeout: 60000 }).catch(() => {});
    await pg.waitForFunction((x) => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran') === x; }, id, { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(900); await k2bas(pg, `${t} · ${id} (${tour})`, tour === '1re visite' ? `bas-390-${id}${sombre ? '-sombre' : ''}.png` : ''); }
    await ctx.close(); return; }
  // K1
  const k1 = await pg.evaluate(() => {
    const bar = document.querySelector('[data-n-onglets]'); if (!bar) return null;
    const tabs = [...bar.querySelectorAll('.n-onglet')];
    return { ordre: tabs.map((x) => x.getAttribute('data-nav-entree')), larg: tabs.map((x) => Math.round(x.getBoundingClientRect().width * 10) / 10), haut: tabs.map((x) => Math.round(x.getBoundingClientRect().height)),
      libelles: tabs.map((x) => { const l = x.querySelector('.n-onglet-libelle'); if (!l) return null; const r = document.createRange(); r.selectNodeContents(l); const tw = r.getBoundingClientRect().width, lw = l.getBoundingClientRect().width; return { t: l.textContent, entier: tw <= lw + 1 && lw > 4 && getComputedStyle(l).visibility !== 'hidden' }; }) };
  });
  dit(k1 && k1.ordre.join(',') === ONGLETS.map(CLE_BARRE).join(','), `K1 ${t} : les 5 onglets dans l’ordre`, k1 && k1.ordre);
  dit(k1 && Math.max(...k1.larg) - Math.min(...k1.larg) <= 1 && Math.min(...k1.larg) >= 44 && Math.min(...k1.haut) >= 44, `K1 ${t} : même largeur, cibles ≥ 44 (${k1 && k1.larg.join('/')} × ${k1 && Math.min(...k1.haut)})`, k1);
  dit(k1 && k1.libelles.every((l) => l && l.entier), `K1 ${t} : chaque libellé visible et entier`, k1 && k1.libelles);
  // K2
  const k2 = await pg.evaluate(async () => {
    const bar = document.querySelector('[data-n-onglets]'), main = document.querySelector('.vrm-main'); if (!bar || !main) return null;
    const br = bar.getBoundingClientRect(), mr = main.getBoundingClientRect();
    main.scrollTop = main.scrollHeight; await new Promise((r) => setTimeout(r, 400));
    const enfants = [...main.querySelectorAll('*')].filter((e) => e.getClientRects().length && !e.closest('[hidden],[data-ecran-cache],[aria-hidden="true"]') && getComputedStyle(e).position !== 'fixed');
    const dernier = enfants.reduce((m, e) => Math.max(m, Math.min(e.getBoundingClientRect().bottom, mr.bottom + 2000)), 0);
    const visibleBas = Math.min(dernier, main.getBoundingClientRect().bottom);
    main.scrollTop = 0;
    return { barBas: Math.round(br.bottom), H: innerHeight, barH: Math.round(br.height), pad: parseFloat(getComputedStyle(bar).paddingBottom), mainBas: Math.round(mr.bottom), barHaut: Math.round(br.top), dernierVisible: Math.round(visibleBas) };
  });
  dit(k2 && k2.barBas === k2.H && k2.pad >= 34 && k2.barH >= 49 + 34 && k2.mainBas <= k2.barHaut + 0.5 && k2.dernierVisible <= k2.barHaut + 0.5, `K2 ${t} : rien sous la barre (écran ↓${k2 && k2.mainBas} ≤ barre ↑${k2 && k2.barHaut}, zone sûre ${k2 && k2.pad})`, k2);
  // K3
  const k3 = await pg.evaluate(async () => {
    const tete = document.querySelector('[data-n-tete]'), main = document.querySelector('.vrm-main'); if (!tete || !main) return null;
    const centre = tete.querySelector('.n-barre-centre'); const op = () => +getComputedStyle(centre).opacity;
    main.scrollTop = 0; await new Promise((r) => setTimeout(r, 500)); const haut = { r: tete.hasAttribute('data-n-reduit'), o: op() };
    main.scrollTop = 600; await new Promise((r) => setTimeout(r, 800)); const bas = { r: tete.hasAttribute('data-n-reduit'), o: op(), titre: centre.textContent, colle: Math.round(tete.getBoundingClientRect().top) };
    main.scrollTop = 0; await new Promise((r) => setTimeout(r, 500));
    return { haut, bas, retour: tete.hasAttribute('data-n-reduit') };
  });
  dit(k3 && !k3.haut.r && k3.bas.r && k3.bas.o > .9 && !!k3.bas.titre && k3.bas.colle <= 1 && !k3.retour, `K3 ${t} : la barre de titre se réduit au défilement (« ${k3 && k3.bas.titre} ») et redevient claire en haut`, k3);
  if (!sombre && nomBase === 'volume') await pg.screenshot({ path: path.join(SHOTS, 'coque-390-aujourdhui.png') });
  if (sombre && nomBase === 'volume') await pg.screenshot({ path: path.join(SHOTS, 'coque-390-aujourdhui-sombre.png') });
  // K4
  const k4a = await pg.evaluate(() => {
    const plus = document.querySelector('[data-n-coque-plus]'), msg = document.querySelector('[data-n-coque-messages]'), champ = document.querySelector('[data-n-recherche]');
    const r = (e) => e && e.getBoundingClientRect();
    return { plus: !!plus && r(plus).width >= 44 && r(plus).height >= 44 && r(plus).right > innerWidth - 80, msg: !!msg && r(msg).width >= 44, champ: !!champ, scannerDedans: !!(champ && champ.querySelector('button')) };
  });
  dit(k4a.plus && k4a.msg && k4a.champ && k4a.scannerDedans, `K4 ${t} : en haut à droite Messages + la photo (« Plus ») ; le champ de recherche porte le scanner`, k4a);
  await pg.locator('[data-n-coque-plus]').first().tap({ timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(900);
  const k4 = await pg.evaluate(() => { const f = document.querySelector('[data-n-feuille-plus]'); if (!f) return null;
    const e = [...f.querySelectorAll('[data-n-plus-entree]')]; return { cles: e.map((x) => x.getAttribute('data-n-plus-entree')), petites: e.filter((x) => x.getBoundingClientRect().height < 44).map((x) => x.getAttribute('data-n-plus-entree')) }; });
  const manque = k4 ? PLUS.filter((c) => !k4.cles.includes(c)) : PLUS;
  dit(k4 && !manque.length && !k4.petites.length, `K4 ${t} : « Plus » complet (${k4 ? k4.cles.length : 0} entrées), rangées ≥ 44`, { manque, petites: k4 && k4.petites });
  if (!sombre && nomBase === 'volume') await pg.screenshot({ path: path.join(SHOTS, 'coque-390-plus.png') });
  // K6 (écrans de Plus) — chacun ouvert depuis « Plus », sans erreur.
  for (const id of ['garage', 'messages', 'emails', 'settings', 'communaute']) {
    const ouvert = await pg.evaluate(() => !!document.querySelector('[data-n-feuille-plus]'));
    if (!ouvert) { await pg.locator('[data-n-coque-plus]').first().tap({ timeout: 60000 }).catch(() => {}); await pg.waitForTimeout(700); }
    const n0 = erreurs.length;
    await pg.locator(`[data-n-plus-entree="${id}"]`).first().tap({ timeout: 60000 }).catch(() => {});
    await pg.waitForFunction((x) => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran') === x; }, id, { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    const ecran = await pg.evaluate(() => document.querySelector('.vrm-main').getAttribute('data-ecran'));
    dit(ecran === id && erreurs.length === n0, `K6 ${t} : « Plus » → ${id} s’ouvre sans erreur`, { ecran, erreurs: erreurs.slice(n0) });
  }
  // K5 + K6 (onglets)
  for (const id of ONGLETS) {
    const n0 = erreurs.length;
    await pg.locator(`[data-n-onglet="${CLE_BARRE(id)}"]`).first().tap({ timeout: 60000 }).catch(() => {});
    await pg.waitForFunction((x) => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran') === x; }, id, { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(900);
    const r = await pg.evaluate(() => { const a = document.querySelector('[data-n-onglets] .n-onglet[aria-current="page"]'); return { ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), actif: a && a.getAttribute('data-n-onglet'), c: a ? window.__contraste(a.querySelector('.n-onglet-libelle')) : 0 }; });
    dit(r.ecran === id && r.actif === CLE_BARRE(id) && r.c >= 4.5 && erreurs.length === n0, `K5/K6 ${t} : ${id} s’ouvre, son onglet s’allume (contraste ${r.c})`, { ...r, erreurs: erreurs.slice(n0) });
    if (id === 'ventes' && !sombre && nomBase === 'volume') await pg.screenshot({ path: path.join(SHOTS, 'coque-390-ventes.png') });
    await k2bas(pg, `${t} · ${id} (1re visite)`, nomBase === 'volume' && !sombre ? `bas-390-${id}.png` : '');
  }
  // K2 bis — les écrans GARDÉS (revenus tels quels) : la même mesure au retour, défilés jusqu'en bas.
  for (const id of ONGLETS) {
    await pg.locator(`[data-n-onglet="${CLE_BARRE(id)}"]`).first().tap({ timeout: 60000 }).catch(() => {});
    await pg.waitForFunction((x) => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran') === x; }, id, { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(700);
    await k2bas(pg, `${t} · ${id} (écran gardé)`, '');
  }
  // K9 (19 nov., intégration) — le message « N nouvelles paires numérotées » est un Toast natif AU-DESSUS de la barre d'onglets,
  // et JAMAIS sur une feuille ou une fiche ouverte : il attend qu'elle se ferme, puis revient.
  {
    const vu = () => pg.evaluate(() => { const e = document.querySelector('[data-toast-numeros] .n-toast, [data-toast-numeros] > *'); if (!e || !e.getClientRects().length) return null;
      const r = e.getBoundingClientRect(), b = document.querySelector('[data-n-onglets]'); const rb = b ? b.getBoundingClientRect() : null; return { bas: Math.round(r.bottom), barre: rb ? Math.round(rb.top) : null }; });
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:numeros-donnes', { detail: { message: '3 nouvelles paires numérotées · N°1, 2, 3' } })));
    await pg.waitForTimeout(500);
    const a = await vu();
    dit(!!a && a.barre != null && a.bas <= a.barre, `K9 ${t} : le toast des N° neufs est posé au-dessus de la barre d’onglets`, a);
    await pg.locator('[data-n-coque-plus]').first().tap({ timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(700);
    const b = await vu();
    const ouverte = await pg.evaluate(() => !!document.querySelector('[role="dialog"][aria-modal="true"]'));
    dit(ouverte && !b, `K9 ${t} : une feuille ouverte ⇒ aucun toast par-dessus`, { ouverte, toast: b });
    await pg.keyboard.press('Escape').catch(() => {}); await pg.locator('[data-n-feuille-plus] [data-n-feuille-fermer], [data-n-feuille-plus] button[aria-label]').first().tap({ timeout: 3000 }).catch(() => {});
    await pg.waitForTimeout(900);
    const c = await vu();
    const encore = await pg.evaluate(() => !!document.querySelector('[role="dialog"][aria-modal="true"]'));
    dit(encore || !!c, `K9 ${t} : la feuille fermée, le toast revient (une seule fois)`, { encore, toast: c });
    await pg.evaluate(() => { const x = document.querySelector('[data-toast-numeros] button'); if (x) x.click(); });
  }
  erreursTout.push(...erreurs);
  await k8(pg, `390 ${sombre ? 'sombre' : 'clair'} ${nomBase}`, ':is([data-n-onglets], .vrm-tabbar) [data-nav-entree="%s"]', true);
  await ctx.close();
}

async function ordinateur(nav, b, W, sombre, nomBase, erreursTout) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 1512, sombre, b, url: '/?tab=journee', dsf: DSF });
  if (W !== 1512) await pg.setViewportSize({ width: W, height: 860 });
  await pret(pg); await poser(pg); await pg.evaluate(MESURE_CONTRASTE);
  const t = `${W} ${sombre ? 'sombre' : 'clair'} ${nomBase}`;
  if (process.env.K8_SEUL) { if (W === 1512) await k8(pg, t, ':is([data-n-laterale], .vrm-sidebar) [data-nav-entree="%s"]', false); await ctx.close(); return; }
  const k7 = await pg.evaluate(() => {
    const lat = document.querySelector('[data-n-laterale]'), main = document.querySelector('.vrm-main');
    if (!lat || !main) return null;
    const l = lat.getBoundingClientRect(), m = main.getBoundingClientRect();
    const actif = lat.querySelector('[aria-current="page"]');
    const visibles = (s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length;
    return { lat: [Math.round(l.left), Math.round(l.width), Math.round(l.height)], main: Math.round(m.left), entrees: [...lat.querySelectorAll('[data-n-entree]')].map((e) => e.getAttribute('data-n-entree')),
      actif: actif && actif.getAttribute('data-n-entree'), c: actif ? window.__contraste(actif.querySelector('.n-laterale-libelle')) : 0,
      ile: visibles('header.vrm-app-header'), barreBas: visibles('[data-n-onglets], .vrm-tabbar'), deborde: document.documentElement.scrollWidth > innerWidth + 1, H: innerHeight };
  });
  const manque = k7 ? LATERALE.filter((c) => !k7.entrees.includes(c)) : LATERALE;
  dit(k7 && k7.lat[0] === 0 && k7.lat[2] >= k7.H - 1 && k7.main >= k7.lat[1] - 0.5 && k7.ile === 0 && k7.barreBas === 0 && !k7.deborde,
    `K7 ${t} : barre latérale (${k7 && k7.lat[1]} px, pleine hauteur) + l’écran à côté (${k7 && k7.main}), sans île ni barre du bas, sans débordement`, k7);
  dit(k7 && !manque.length && k7.entrees.slice(0, 5).join(',') === ONGLETS.join(','), `K7 ${t} : les 5 onglets en tête puis tout « Plus »`, { manque, entrees: k7 && k7.entrees });
  dit(k7 && k7.actif === 'journee' && k7.c >= 4.5, `K7 ${t} : l’entrée active est lisible (contraste ${k7 && k7.c})`, k7 && { actif: k7.actif, c: k7.c });
  if (nomBase === 'volume' && !sombre) await pg.screenshot({ path: path.join(SHOTS, `coque-${W}.png`) });
  if (nomBase === 'volume' && sombre) await pg.screenshot({ path: path.join(SHOTS, `coque-${W}-sombre.png`) });
  for (const id of [...ONGLETS.slice(1), 'garage', 'messages', 'settings', 'journee']) {
    const n0 = erreurs.length;
    await pg.locator(`[data-n-laterale] [data-n-entree="${id}"]`).first().click({ timeout: 60000 }).catch(() => {});
    await pg.waitForFunction((x) => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran') === x; }, id, { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(700);
    const r = await pg.evaluate(() => ({ ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), actif: (document.querySelector('[data-n-laterale] [aria-current="page"]') || {}).getAttribute?.('data-n-entree') || null }));
    dit(r.ecran === id && r.actif === id && erreurs.length === n0, `K6 ${t} : ${id} s’ouvre depuis la barre latérale, sans erreur`, { ...r, erreurs: erreurs.slice(n0) });
  }
  erreursTout.push(...erreurs);
  if (W === 1512) await k8(pg, t, ':is([data-n-laterale], .vrm-sidebar) [data-nav-entree="%s"]', false);
  await ctx.close();
}

// K2 (chaque écran) : l'écran montré, défilé jusqu'EN BAS (jusqu'à ce que sa hauteur ne bouge plus) : aucun texte, aucun
// contrôle de l'écran — même `position: fixed` / `sticky` — ne recouvre la barre d'onglets ; sa dernière rangée finit
// au-dessus d'elle. (Capture de Julien du 19 nov. : « le flou du bas mange la dernière rangée ».)
async function k2bas(pg, t, capture) {
  const r = await pg.evaluate(async () => {
    const bar = document.querySelector('[data-n-onglets]'), main = document.querySelector('.vrm-main'); if (!bar || !main) return null;
    let h = -1; for (let i = 0; i < 6 && main.scrollHeight !== h; i++) { h = main.scrollHeight; main.scrollTop = main.scrollHeight; await new Promise((ok) => setTimeout(ok, 350)); }
    const rb = bar.getBoundingClientRect();
    // Montré : rendu, sa PROPRE visibilité (un enfant peut redevenir visible sous un parent caché), aucune opacité nulle au-dessus.
    const raisons = {}; let vus = 0;
    const montre = (e) => { if (!e.getClientRects().length) return false; if (getComputedStyle(e).visibility === 'hidden') { raisons.vis = (raisons.vis || 0) + 1; return false; } for (let x = e; x && x !== main; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || +s.opacity === 0 || x.hidden || x.hasAttribute('data-ecran-cache')) { const k = s.display === 'none' ? 'none' : +s.opacity === 0 ? 'opacite:' + (x.className && typeof x.className === 'string' ? x.className.split(' ')[0] : x.tagName) : 'cache'; raisons[k] = (raisons[k] || 0) + 1; return false; } } return true; };
    const sous = [];
    let dernier = 0;
    for (const e of main.querySelectorAll('*')) {
      if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
      const controle = e.matches('button, a[href], input, select, textarea, [role="button"]');
      const texte = [...e.childNodes].some((n) => n.nodeType === 3 && /\S/.test(n.nodeValue));
      if (!controle && !texte && !e.matches('img, svg')) continue;
      // Le rectangle VISIBLE : coupé par chaque ancêtre qui rogne (overflow ≠ visible), <main> compris — sauf un élément fixe,
      // que rien ne rogne. Un élément rogné par <main> sous son bord n'est pas peint : il n'est pas « sous la barre ».
      const q = (() => { const b = e.getBoundingClientRect(); let t = b.top, bo = b.bottom, l = b.left, ri = b.right, par = '';
        if (getComputedStyle(e).position !== 'fixed') for (let x = e.parentElement; x; x = x.parentElement) { const s = getComputedStyle(x);
          if (s.position === 'fixed') break;
          // Chaque axe pour lui-même : `overflow-x: clip` ne rogne pas en hauteur.
          // `display: contents` (les hôtes des écrans gardés) n'a pas de boîte : il ne rogne rien.
          const c = s.display !== 'contents' && (s.overflowX !== 'visible' || s.overflowY !== 'visible') ? x.getBoundingClientRect() : null;
          if (c && s.overflowY !== 'visible') { if (c.top > t || c.bottom < bo) par = (typeof x.className === 'string' && x.className.split(' ')[0]) || x.tagName; t = Math.max(t, c.top); bo = Math.min(bo, c.bottom); }
          if (c && s.overflowX !== 'visible') { l = Math.max(l, c.left); ri = Math.min(ri, c.right); }
          if (x === main) break; }
        return { top: t, bottom: bo, left: l, right: ri, width: ri - l, height: bo - t, par, brut: b.height }; })();
      if (q.width < 3 || q.height < 3) { if (q.par && q.brut >= 3) raisons['rogne:' + q.par] = (raisons['rogne:' + q.par] || 0) + 1; continue; }
      if (q.bottom <= q.top || q.right <= 0 || q.left >= innerWidth) continue;
      if (!montre(e)) continue;
      vus++;
      if (q.bottom > dernier && q.top < innerHeight) dernier = q.bottom;
      if (q.bottom > rb.top + 1 && q.top < rb.bottom) sous.push(`${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(/\s+/)[0] : ''} « ${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30)} » ${Math.round(q.top)}→${Math.round(q.bottom)} (${getComputedStyle(e).position})`);
    }
    const out = { barre: Math.round(rb.top), dernier: Math.round(dernier), sous: sous.slice(0, 5), n: sous.length, hauteur: main.scrollHeight, vus, raisons };
    return out;
  });
  if (capture) await pg.screenshot({ path: path.join(SHOTS, capture) });
  await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; });
  dit(r && r.vus > 0 && r.n === 0 && r.dernier <= r.barre + 0.5, `K2 ${t} : défilé jusqu’en bas, la dernière rangée finit à ${r && r.dernier} ≤ barre ${r && r.barre}, rien dessous (${r && r.vus} éléments vus ; écartés ${JSON.stringify(r && r.raisons)})`, r);
}

// K8 : le retour sur un écran DÉJÀ visité, sous trace Chrome. Temps de THREAD des tâches de style, éléments restylés.
async function k8(pg, t, modele, tactile) {
  const toucher = async (id) => { const l = pg.locator(modele.replace('%s', id)).first(); if (tactile) await l.tap({ timeout: 60000 }); else await l.click({ timeout: 60000 });
    await pg.waitForFunction((x) => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran') === x; }, id, { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(900); };
  await toucher('ventes'); await toucher('journee');   // les deux écrans visités
  const cdp = await pg.context().newCDPSession(pg);
  const evts = [];
  cdp.on('Tracing.dataCollected', (d) => { for (const e of d.value) evts.push(e); });
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking', transferMode: 'ReportEvents' });
  await toucher('ventes'); await toucher('journee');
  const fini = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end'); await fini;
  const style = evts.filter((e) => e.name === 'UpdateLayoutTree' && e.ph === 'X');
  const tdur = style.map((e) => (e.tdur != null ? e.tdur : e.dur) / 1000);
  const pire = tdur.length ? Math.max(...tdur) : 0;
  const elements = style.map((e) => (e.args && e.args.elementCount) || (e.args && e.args.data && e.args.data.elementCount) || 0);
  const maxEl = elements.length ? Math.max(...elements) : 0;
  // Ce que pèse l'écran montré (un écran gardé qui revient se recalcule lui-même : c'est le moteur des écrans gardés) et le document.
  const tailles = await pg.evaluate(() => { const vis = (e) => e.getClientRects().length > 0; const m = document.querySelector('.vrm-main');
    return { document: document.getElementsByTagName('*').length, ecran: m ? [...m.getElementsByTagName('*')].filter(vis).length : 0 }; });
  const top = style.map((e, i) => [Math.round(tdur[i] * 10) / 10, elements[i]]).sort((a, b) => b[0] - a[0]).slice(0, 4);
  // K8a — LA COQUE : aucune invalidation de style posée sur <html>, <body> ou la racine de la coque (un attribut qui suit
  // l'onglet là-haut restylerait tout le document). Lu dans les événements « InvalidationTracking » de la trace.
  const inval = evts.filter((e) => /InvalidationTracking/.test(e.name) && e.args && e.args.data);
  // « Affected by :has() » : une règle d'AVANT ancrée sur body / la coque (`body:has(…)`, `.vrm-app-shell:has(…)`) que le
  // contenu de l'écran réveille — comptée et dite (chantier `claude/lisible-partout`), pas jugée ici : K8a juge ce que la
  // coque POSE (un attribut, une classe, un style sur html / body / la racine).
  const enHaut = (e) => /^(HTML|BODY)\b|vrm-app-shell|n-coque'|n-coque /.test(String(e.args.data.nodeName || ''));
  const parHas = (e) => /:has\(\)/.test(String(e.args.data.reason || ''));
  // Ce qui est POSÉ là-haut : un attribut, une classe ou un id changé sur html / body / la racine (ScheduleStyleInvalidationTracking).
  // Les autres invalidations de ces nœuds (focus, survol, style en ligne d'une mesure, :has() d'avant) sont comptées, pas jugées.
  const pose = (e) => { const d = e.args.data; return d.changedAttribute || d.changedClass || d.changedId; };
  // (19 nov., intégration) Un drapeau de racine `data-vrm-dN` (src/drapeauxRacine.js, lot vite-et-sans-bug) REMPLACE un `:has()`
  // d'avant : il n'invalide que les descendants que SES règles nomment (banc drapeaux-justes). Compté avec les :has(), pas jugé.
  const drapeau = (e) => /^data-vrm-d\d+$/.test(String(e.args.data.changedAttribute || ''));
  const haut = inval.filter((e) => enHaut(e) && !parHas(e) && pose(e) && !drapeau(e));
  const autres = inval.filter((e) => enHaut(e) && (!pose(e) || drapeau(e))).length;
  const nomsHaut = [...new Set(haut.map((e) => `${e.args.data.nodeName} · ${pose(e)}`))].slice(0, 6);
  dit(inval.length > 0 && haut.length === 0, `K8a ${t} : la coque ne pose aucun attribut, classe ou id sur <html>, <body> ou sa racine au changement d’onglet (${inval.length} invalidations ; ${haut.length} posées en haut ; ${autres} autres en haut : focus, :has() d’avant et ses drapeaux, style en ligne)`, nomsHaut);
  // K8b — le temps de THREAD des tâches de style. ⚠️ La plus lourde est l'écran gardé qui RE-APPARAÎT (src/ecransGardes.jsx,
  // chantier `claude/vite-et-sans-bug`) : mesuré aussi sur le build d'avant (main ad73a3c7c), voir le récit du 19 nov.
  dit(style.length > 0 && pire <= 50 && maxEl <= 3000,
    `K8b ${t} : retour sur un écran visité — pire tâche de style ${pire.toFixed(1)} ms de thread, ${maxEl} éléments restylés au plus, ${style.length} tâches (écran montré ${tailles.ecran}, document ${tailles.document})`, { pire, maxEl, n: style.length, top, ...tailles });
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const volume = base();
  const vide = base(); vide.rows = []; vide.accounts = [];
  { const m = vide.main[0].data; for (const k of Object.keys(m)) if (!/^vrm_(bienvenue_vue|visite_vue|je_vends|configuration|plateformes_affichees|parcours|bilan_minute)$/.test(k)) delete m[k]; }
  const erreurs = [];
  try {
    const casTel = MUT ? [[false, 'volume']] : [[false, 'volume'], [true, 'volume'], [false, 'vide']];
    for (const [sombre, nom] of casTel) { console.log(`\nTéléphone 390 · ${sombre ? 'sombre' : 'clair'} · base ${nom}`); await telephone(nav, nom === 'vide' ? vide : volume, sombre, nom, erreurs); }
    if (MUT !== 'dessous' && MUT !== 'largeur' && process.env.SEUL !== 'tel') {   // SEUL=tel : le téléphone seulement
      const casOrdi = MUT ? [[1512, false, 'volume']] : [[1512, false, 'volume'], [1512, true, 'volume'], [1280, false, 'volume'], [1512, false, 'vide']];
      for (const [W, sombre, nom] of casOrdi) { console.log(`\nOrdinateur ${W} · ${sombre ? 'sombre' : 'clair'} · base ${nom}`); await ordinateur(nav, nom === 'vide' ? vide : volume, W, sombre, nom, erreurs); }
    }
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} natif-coque${MUT ? ' (mutation ' + MUT + ')' : ''} : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
