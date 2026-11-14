require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA REFONTE DE LA COQUE (14 nov.) — récit : docs/passation/2026-11-14-refonte-coque.md
//
//  Julien, sur son iPhone : « c'est moche, rien n'a changé » (une barre du haut à
//  cinq ronds dont une cloche « 99+ » bleue, « Tout est à jour » encadré en tête de
//  chaque page, « Mis à jour à 08:19 » posé sur la liste) ; puis (choix n° 61) :
//  QUATRE onglets en bas — Aujourd'hui · Paires · Ventes · Argent — et « un menu qui
//  s'ouvre en haut avec le reste des onglets » ; et « imagine si j'ai 1000 articles ».
//
//  Ce banc REND l'app (390 tactile, base inventée `design-passe.cjs`) et juge :
//    H1 en haut, à droite, TROIS icônes au plus (cloche · loupe · compte) ; à gauche le ☰ ;
//    H2 un GRAND titre (≥ 30 px) dans la page en haut ; le petit titre de la barre caché
//       en haut, visible ET centré une fois défilé ;
//    H3 la pastille « Mis à jour à … » n'est plus sur le contenu 3 s après son apparition ;
//    H4 la pastille de la cloche ≤ « 9+ » (120 non lues servies) et pas à l'accent ;
//    H5 « Tout est à jour » ne prend aucune place en tête de page ;
//    F  toutes les fonctions de la barre d'hier restent joignables : loupe, cloche, menu du
//       compte (Paramètres), panneau « Actions Vinted », œil des montants ;
//    N  la barre du bas : exactement 4 onglets (journee · paires · ventes · compta) ; CHAQUE
//       écran d'hier joignable en ≤ 2 touchers depuis Ma journée ; pastilles conservées
//       (segment Achats = son nombre ; onglet Paires = la somme, muet sur un écran de Paires) ;
//    D  pas de débordement horizontal ;
//    A3 (AJOUT 3) « N choses à revoir » jamais au-dessus du titre (point ambre sur la cloche, la ligne dans sa
//       feuille) ; sous le grand titre aucune phrase, le « ? » sur sa ligne ; « Nouvelle version » jamais un
//       bandeau sur la liste ni au-dessus de la barre du bas (une ligne sous la barre du haut qui pousse la page) ;
//    P  (avec `BANC_DIST_AVANT`) 1 000 annonces : premier rendu de la liste, nœuds DOM, saut de
//       mise en page au défilement — jamais pires que l'arbre d'avant (tolérance de bruit).
//  `BANC_DIST=` juge un autre build (avant/après). `CAPTURES=dossier` : les captures 390 × dsf 2
//  (clair) de Ma journée, Achats, Annonces défilée, menu ☰ et menu du compte, suffixe `SUFFIXE`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const CAPTURES = process.env.CAPTURES || '';
const SUFFIXE = process.env.SUFFIXE || 'apres';
const AVANT = process.env.BANC_DIST_AVANT || '';
const SEUL = String(process.env.SEUL || '').split(',').filter(Boolean);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const veut = (k) => !SEUL.length || SEUL.includes(k);
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f().catch(() => false)) return true; await pg.waitForTimeout(200); } return false; };
// Prêt = l'écran est là ET la page est CALME (aucune tâche longue depuis 1,5 s) : pendant les ~6 s du
// démarrage, un toucher attend que la page réponde (mesuré : même charge avant et après la refonte).
const calme = async (pg) => {
  await pg.evaluate(() => { if (window.__ltObs) return; window.__ltDer = performance.now(); try { window.__ltObs = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ltDer = Math.max(window.__ltDer, e.startTime + e.duration); }); window.__ltObs.observe({ type: 'longtask', buffered: true }); } catch (_) {} }).catch(() => {});
  const t0 = Date.now(); while (Date.now() - t0 < 20000) { if (await pg.evaluate(() => performance.now() - window.__ltDer > 1500).catch(() => false)) return; await pg.waitForTimeout(300); }
};
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {}); await pg.waitForTimeout(1500); await calme(pg); };
const ilYa = (min) => new Date(Date.now() - min * 60000).toISOString();

// 120 notifications non lues (la cloche d'hier écrivait « 99+ » en bleu).
function baseCloche() {
  const b = base();
  const entrees = Array.from({ length: 120 }, (_, i) => ({ seq: 120 - i, at: ilYa(5 + i * 7), famille: 'ventes', cat: 'vente', titre: 'Vendu', texte: `Paire ${i + 1}`, url: '/?tab=ventes', etat: 'envoyee' }));
  b.rows.push({ id: 'push_journal', data: { n: 120, rev: 'r1', entrees } }, { id: 'push_journal_lu', data: { luJusqua: 0, lus: [] } });
  return b;
}
// 1 000 annonces en ligne sur un compte (inventées), pour la vitesse.
function baseMille() {
  const b = base();
  const r = b.rows.find((x) => /^harvest_\d+_listings$/.test(x.id));
  const modele = r.data.payload.items[0];
  const items = Array.from({ length: 1000 }, (_, i) => ({ ...modele, id: 8800000000 + i, title: `Paire inventée ${i + 1} taille ${36 + (i % 10)}`, is_closed: false,
    price: { amount: String(30 + (i * 7) % 90) + '.0', currency_code: 'EUR' }, photo: { ...modele.photo, url: `https://images1.vinted.net/t/${8800000000 + i}/f800/p.jpeg?s=abc` } }));
  r.data.payload.items = items; r.data.nItems = items.length; r.data.payload.pagination = { total_entries: items.length };
  return b;
}

const visibles = (pg, sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > .05; }).length, sel);
const toucher = async (pg, sel) => { const l = pg.locator(sel).filter({ visible: true }).first(); if (!(await l.count())) return false; await l.tap({ timeout: 4000 }).catch(() => l.click({ timeout: 4000, force: true }).catch(() => {})); return true; };
const ecran = (pg) => pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return m ? m.getAttribute('data-ecran') : null; });
const fermer = async (pg) => { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(350); };

async function regles(nav) {
  // ── H1 · H5 · D : la barre du haut, à Ma journée et Achats ──
  for (const url of ['/?tab=journee', '/?tab=achats']) {
    const o = await ouvrir(nav, { W: 390, sombre: false, b: base(), url }); await pret(o.pg);
    const h = await o.pg.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > .05; };
      const head = document.querySelector('.vrm-app-header');
      const tous = head ? [...head.querySelectorAll('button')].filter(vis) : [];
      const droite = tous.filter((b) => b.getBoundingClientRect().left > innerWidth / 2);
      const gauche = tous.filter((b) => b.getBoundingClientRect().left <= innerWidth / 2);
      const hote = document.querySelector('.vrm-fraicheur-hote');
      const f = document.querySelector('[data-fraicheur-unique]');
      return { droite: droite.map((b) => b.getAttribute('aria-label')), gauche: gauche.map((b) => b.getAttribute('aria-label')), menu: !!head && !!head.querySelector('[data-menu-ecrans]') && vis(head.querySelector('[data-menu-ecrans]')),
        fr: f ? f.getAttribute('data-fraicheur-unique') : null, frH: hote ? Math.round(hote.getBoundingClientRect().height) : 0, debord: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    dit(h.droite.length <= 3, `${url} · H1 à droite, trois icônes au plus (cloche · loupe · compte)`, h.droite.join(' | '));
    // (14 nov., maquette de Julien) Rien à gauche : le reste des écrans s'ouvre par l'avatar (H1 « menu » ci-dessous).
    dit(h.gauche.length === 0, `${url} · H1 à gauche, rien (le menu du haut s'ouvre par l'avatar)`, h.gauche.join(' | '));
    dit(!(h.fr === 'a-jour' || h.fr === 'encours') || h.frH <= 1, `${url} · H5 « Tout est à jour » ne prend aucune place en tête de page`, `${h.fr} · ${h.frH} px`);
    dit(!h.debord, `${url} · D aucun débordement horizontal`);
    dit(!o.erreurs.length, `${url} · aucune erreur d'app`, o.erreurs.join(' | ').slice(0, 200));
    await o.ctx.close();
  }

  // ── H2 : le grand titre dans la page ; le petit titre de la barre au défilement seulement, centré ──
  for (const url of ['/?tab=ventes', '/?tab=achats', '/?tab=compta', '/?tab=annonces']) {
    const o = await ouvrir(nav, { W: 390, sombre: false, b: base(), url }); await pret(o.pg);
    const haut = await o.pg.evaluate(() => {
      const grands = [...document.querySelectorAll('.vrm-main :is(h1,h2)')].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top < 330 && parseFloat(getComputedStyle(e).fontSize) >= 30; });
      const t = document.querySelector('.vrm-hdr-titre');
      return { grand: grands.map((e) => `${e.textContent.trim().slice(0, 20)}:${parseFloat(getComputedStyle(e).fontSize)}`), op: t ? +getComputedStyle(t).opacity : 1 };
    });
    dit(haut.grand.length >= 1, `${url} · H2 un grand titre (≥ 30 px) dans la page, en haut`, haut.grand.join(' | ') || 'aucun');
    dit(haut.op < 0.1, `${url} · H2 le petit titre de la barre est caché en haut de page (jamais deux fois)`, String(haut.op));
    // Défiler (deux fois : un écran qui finit d'arriver peut ramener le défilement en haut).
    await o.pg.waitForTimeout(1500);
    for (let i = 0; i < 2; i++) { await o.pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) { m.scrollTop = 500; m.dispatchEvent(new Event('scroll')); } }); await o.pg.waitForTimeout(900); }
    await attendre(o.pg, () => o.pg.evaluate(() => { const t = document.querySelector('.vrm-hdr-titre'); return t && +getComputedStyle(t).opacity > .9; }), 5000);
    const bas = await o.pg.evaluate(() => { const t = document.querySelector('.vrm-hdr-titre'); if (!t) return null; const r = t.getBoundingClientRect(); return { op: +getComputedStyle(t).opacity, centre: Math.round(r.left + r.width / 2), txt: t.textContent.trim() }; });
    dit(!!bas && bas.op > 0.9 && Math.abs(bas.centre - 195) <= 8, `${url} · H2 défilé : le petit titre arrive, CENTRÉ dans la barre`, JSON.stringify(bas));
    await o.ctx.close();
  }

  // ── H3 : « Mis à jour à … » ne reste pas sur le contenu ──
  {
    // Sans attendre le calme : la pastille vit 2 s, on la guette dès l'ouverture.
    const o = await ouvrir(nav, { W: 390, sombre: false, b: base(), url: '/?tab=achats' });
    const vu = await o.pg.waitForSelector('[data-temps-reel-neuf]', { timeout: 30000 }).then(() => true).catch(() => false);
    dit(vu, 'H3 la pastille « Mis à jour à … » apparaît bien (la veille a trouvé du neuf)');
    if (vu) {
      await o.pg.waitForTimeout(3000);
      const encore = await visibles(o.pg, '[data-temps-reel-neuf]');
      dit(encore === 0, 'H3 3 s après son apparition, la pastille n\'est plus sur le contenu', `${encore} visible(s)`);
      // Et elle ne revient pas aussitôt (la veille relit toutes les 5 à 30 s).
      let revue = 0; for (let i = 0; i < 12; i++) { await o.pg.waitForTimeout(1000); revue += await visibles(o.pg, '[data-temps-reel-neuf]'); }
      dit(revue === 0, 'H3 … et ne revient pas dans les 12 s qui suivent', `${revue} relevé(s) visible(s)`);
    }
    await o.ctx.close();
  }

  // ── H4 : la cloche, 120 non lues ──
  {
    const o = await ouvrir(nav, { W: 390, sombre: false, b: baseCloche(), url: '/?tab=journee' }); await pret(o.pg);
    await attendre(o.pg, () => o.pg.evaluate(() => !!document.querySelector('[data-centre-notifs-cloche] .vrm-cn-pastille')), 15000);
    const p = await o.pg.evaluate(() => {
      const e = document.querySelector('[data-centre-notifs-cloche] .vrm-cn-pastille'); if (!e) return null;
      const acc = getComputedStyle(document.documentElement).getPropertyValue('--d-accent').trim();
      const tmp = document.createElement('i'); tmp.style.color = acc || '#0071E3'; document.body.appendChild(tmp); const accRgb = getComputedStyle(tmp).color; tmp.remove();
      return { t: e.innerText.trim(), fond: getComputedStyle(e).backgroundColor, accRgb };
    });
    dit(!!p && /^([1-9]|9\+)$/.test(p.t), 'H4 la pastille de la cloche dit « 9+ » au plus (120 non lues)', p ? p.t : 'absente');
    dit(!!p && p.fond !== p.accRgb && !/rgb\(0, 113, 227\)|rgb\(10, 132, 255\)/.test(p.fond), 'H4 … et n\'est pas à la couleur d\'accent', p ? p.fond : '');
    await o.ctx.close();
  }

  // ── F : les fonctions de la barre d'hier, toujours joignables ──
  {
    const o = await ouvrir(nav, { W: 390, sombre: false, b: base(), url: '/?tab=journee' }); await pret(o.pg);
    const pg = o.pg;
    // Chaque fonction depuis une page neuve : un panneau resté ouvert ne masque jamais la suivante.
    const neuf = async () => { await pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); await pret(pg); };
    await toucher(pg, 'button[data-recherche-loupe]');
    await attendre(pg, async () => (await visibles(pg, '[data-recherche-champ]')) >= 1, 6000);
    dit(await visibles(pg, '[data-recherche-champ]') >= 1, 'F la loupe ouvre la recherche'); await toucher(pg, '.vrm-hdr-recherche-fermer'); await pg.waitForTimeout(400);
    await neuf();
    await toucher(pg, '[data-centre-notifs-cloche]'); await pg.waitForTimeout(900);
    dit(await visibles(pg, '[data-centre-notifs]') >= 1, 'F la cloche ouvre ses notifications'); await fermer(pg);
    await neuf();
    await toucher(pg, '[data-profil-tete]'); await pg.waitForSelector('[data-menu-profil] [data-profil-menu="montants"]', { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(300);
    const lignes = await pg.evaluate(() => [...document.querySelectorAll('[data-menu-profil] [data-profil-menu]')].map((e) => e.getAttribute('data-profil-menu')));
    dit(['parametres', 'etat-actions', 'montants'].every((x) => lignes.includes(x)) && lignes[0] === 'parametres', 'F le menu du compte : Paramètres d\'abord, puis « Actions Vinted » et l\'œil des montants', lignes.join(','));
    await toucher(pg, '[data-profil-menu="etat-actions"]');
    await attendre(pg, async () => (await visibles(pg, '[data-etat-panneau]')) >= 1, 5000);
    dit(await visibles(pg, '[data-etat-panneau]') >= 1, 'F « Actions Vinted » ouvre le panneau d\'état de la pastille d\'hier');
    await toucher(pg, '[data-etat-fermer]'); await pg.waitForTimeout(400);
    await neuf();
    await toucher(pg, '[data-profil-tete]'); await pg.waitForSelector('[data-menu-profil] [data-profil-menu="montants"]', { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(300);
    await toucher(pg, '[data-profil-menu="montants"] input');
    await attendre(pg, () => pg.evaluate(() => { const b = document.querySelector('.vrm-app-header [data-bouton-montants]'); return !!b && b.getAttribute('data-montants-caches') === '1'; }), 6000);
    const caches = await pg.evaluate(() => { const b = document.querySelector('.vrm-app-header [data-bouton-montants]'); return b ? b.getAttribute('data-montants-caches') : null; });
    dit(caches === '1', 'F l\'œil du menu cache les montants — et l\'œil revient dans la barre tant qu\'ils sont cachés (pour les montrer d\'un geste)', String(caches));
    await fermer(pg);
    if (caches === '1') { await toucher(pg, '.vrm-app-header [data-bouton-montants]'); await attendre(pg, async () => (await visibles(pg, '.vrm-app-header [data-bouton-montants]')) === 0, 6000); }
    dit(await visibles(pg, '.vrm-app-header [data-bouton-montants]') === 0, 'F montants remontrés : l\'œil quitte la barre');
    dit(!o.erreurs.length, 'F aucune erreur d\'app', o.erreurs.join(' | ').slice(0, 200));
    await o.ctx.close();
  }

  // ── N : quatre onglets, chaque écran d'hier en ≤ 2 touchers, pastilles ──
  {
    const o = await ouvrir(nav, { W: 390, sombre: false, b: base(), url: '/?tab=journee' }); await pret(o.pg);
    const pg = o.pg;
    const onglets = await pg.evaluate(() => [...document.querySelectorAll('.vrm-tabbar > button')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.getAttribute('data-nav-entree') || (b.classList.contains('vrm-nav-more') ? 'plus' : '?')));
    dit(onglets.join(',') === 'journee,paires,ventes,compta', 'N la barre du bas : quatre onglets — Aujourd\'hui · Paires · Ventes · Argent', onglets.join(','));
    await attendre(pg, () => pg.evaluate(() => !!document.querySelector('.vrm-tabbar [data-badge-nav="paires"]')), 12000);
    const pastilles = await pg.evaluate(() => { const b = document.querySelector('.vrm-tabbar [data-badge-nav="paires"]'); return b ? b.getAttribute('data-badge-n') : null; });
    dit(pastilles != null && Number(pastilles) > 0, 'N l\'onglet Paires porte la somme de ses écrans (ailleurs que sur Paires)', String(pastilles));
    // Les écrans d'hier : barre (journee, annonces, ventes, achats) + « Plus » (messages, garage, emails, compta, communaute) + Paramètres.
    const chemins = {
      journee: [['.vrm-tabbar [data-nav-entree="journee"]']], ventes: [['.vrm-tabbar [data-nav-entree="ventes"]']], compta: [['.vrm-tabbar [data-nav-entree="compta"]']],
      annonces: [['.vrm-tabbar [data-nav-entree="paires"]'], ['.vrm-tabbar [data-nav-entree="paires"]', '[data-paires-segment="annonces"]'], ['[data-profil-tete]', '[data-menu-profil] [data-nav-entree="annonces"]']],
      garage: [['.vrm-tabbar [data-nav-entree="paires"]', '[data-paires-segment="garage"]'], ['[data-profil-tete]', '[data-menu-profil] [data-nav-entree="garage"]']],
      achats: [['.vrm-tabbar [data-nav-entree="paires"]', '[data-paires-segment="achats"]'], ['[data-profil-tete]', '[data-menu-profil] [data-nav-entree="achats"]']],
      messages: [['[data-profil-tete]', '[data-menu-profil] [data-nav-entree="messages"]']], emails: [['[data-profil-tete]', '[data-menu-profil] [data-nav-entree="emails"]']],
      communaute: [['[data-profil-tete]', '[data-menu-profil] [data-nav-entree="communaute"]']], settings: [['[data-profil-tete]', '[data-profil-menu="parametres"]']],
    };
    for (const [cible, essais] of Object.entries(chemins)) {
      let atteint = null;
      for (const ch of essais) {
        // Le départ : Ma journée (un lien rechargé peut rouvrir le dernier écran : on y retourne par la barre).
        for (let k = 0; k < 3; k++) { const ok = await pg.goto(pg.url().replace(/\?.*$/, '?tab=journee')).then(() => true).catch(() => false); if (ok) break; await pg.waitForTimeout(1000); }
        await pret(pg);
        if ((await ecran(pg)) !== 'journee') { await toucher(pg, '.vrm-tabbar [data-nav-entree="journee"]'); await pg.waitForTimeout(900); }
        let n = 0; for (const s of ch) { await pg.locator(s).filter({ visible: true }).first().waitFor({ timeout: 5000 }).catch(() => {}); if (await toucher(pg, s)) n++; await pg.waitForTimeout(900); }
        await attendre(pg, async () => (await ecran(pg)) === cible, 4000);
        if ((await ecran(pg)) === cible) { atteint = `${n} toucher(s) : ${ch.join(' → ')}`; break; }
      }
      dit(!!atteint, `N « ${cible} » joignable en ≤ 2 touchers depuis Ma journée`, atteint || 'introuvable');
    }
    // Sur Achats : le segment porte le nombre, l'onglet Paires se tait (un nombre une fois).
    await toucher(pg, '.vrm-tabbar [data-nav-entree="paires"]'); await pg.waitForTimeout(900);
    await toucher(pg, '[data-paires-segment="achats"]'); await pg.waitForTimeout(1500);
    const surPaires = await pg.evaluate(() => ({ seg: (document.querySelector('[data-paires-segment="achats"] .vrm-seg-n') || {}).textContent || '', onglet: !!document.querySelector('.vrm-tabbar [data-badge-nav="paires"]'), actif: (document.querySelector('.vrm-tabbar [aria-current="page"]') || {}).getAttribute?.('data-nav-entree') }));
    dit(/\d/.test(surPaires.seg) && !surPaires.onglet, 'N sur Achats : le segment porte le nombre d\'Achats, l\'onglet Paires se tait', JSON.stringify(surPaires));
    dit(surPaires.actif === 'paires', 'N sur Achats, l\'onglet allumé est Paires', String(surPaires.actif));
    // Le menu du haut : tout ce que « Plus » portait, groupé ; il ne répète pas les onglets de la barre.
    await toucher(pg, '[data-profil-tete]'); await pg.waitForSelector('[data-menu-profil] [data-nav-entree]', { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(400);
    const menu = await pg.evaluate(() => [...document.querySelectorAll('[data-menu-profil] [data-nav-entree]')].map((e) => e.getAttribute('data-nav-entree')));
    dit(['messages', 'garage', 'emails', 'communaute'].every((x) => menu.includes(x)) && !['journee', 'ventes', 'compta'].some((x) => menu.includes(x)), 'N le menu de l\'avatar porte tout ce que « Plus » portait, sans répéter la barre', menu.join(','));
    if (CAPTURES) await pg.screenshot({ path: path.join(CAPTURES, `coque-menu-${SUFFIXE}.png`) });
    dit(!o.erreurs.length, 'N aucune erreur d\'app', o.erreurs.join(' | ').slice(0, 200));
    await o.ctx.close();
  }
}


// ── A3 : AJOUT 3 (capture d'Annonces, 09:01) — ce que la coque met en tête de page ──
function baseRetard() {
  const b = base();
  const e = b.rows.find((r) => /^ext_appareil_/.test(r.id));
  const uid = Object.keys(e.data.vus.vinted)[0];
  e.data.vus.vinted[uid] = Date.now() - 3 * 864e5;   // un compte pas relu depuis 3 jours ⇒ « à revoir »
  for (const r of b.rows) if (r.id.startsWith(`harvest_${uid}_`) && !/_txn_|_label_/.test(r.id) && r.data && r.data.capturedAt) r.data.capturedAt = typeof r.data.capturedAt === 'number' ? Date.now() - 3 * 864e5 : new Date(Date.now() - 3 * 864e5).toISOString();
  return b;
}
async function ajout3(nav) {
  // A3.1 · « N choses à revoir » jamais au-dessus du titre : rien dans la page ; la cloche porte le point ambre ; sa feuille, la ligne.
  {
    const o = await ouvrir(nav, { W: 390, sombre: false, b: baseRetard(), url: '/?tab=annonces' }); await pret(o.pg);
    await attendre(o.pg, () => o.pg.evaluate(() => { const f = document.querySelector('[data-fraicheur-unique]'); return f && !/encours|charge/.test(f.getAttribute('data-fraicheur-unique')); }), 15000);
    const e = await o.pg.evaluate(() => {
      const f = document.querySelector('[data-fraicheur-unique]'); const h = document.querySelector('.vrm-main h1');
      const hote = f && f.closest('.vrm-fraicheur-hote'); const r = hote ? hote.getBoundingClientRect() : null;
      return { etat: f && f.getAttribute('data-fraicheur-unique'), hauteur: r ? Math.round(r.height) : 0, au_dessus: !!(r && h && r.height > 1 && r.bottom <= h.getBoundingClientRect().top + 1),
        point: (document.querySelector('[data-centre-notifs-cloche]') || {}).getAttribute?.('data-cn-alerte') || null };
    });
    dit(e.etat === 'retard', 'A3.1 le cas servi : un compte pas relu depuis 3 jours ⇒ « à revoir »', String(e.etat));
    dit(e.hauteur <= 1 && !e.au_dessus, 'A3.1 « à revoir » ne s\'écrit pas en tête de page (jamais au-dessus du titre)', `${e.hauteur} px`);
    dit(e.point === '1', 'A3.1 … la cloche porte un point ambre', String(e.point));
    await toucher(o.pg, '[data-centre-notifs-cloche]'); await o.pg.waitForTimeout(1500);
    await attendre(o.pg, () => o.pg.evaluate(() => { const x = document.querySelector('[data-centre-fraicheur] [data-fraicheur-unique]'); return x && x.getAttribute('data-fraicheur-unique') === 'retard'; }), 12000);
    const f = await o.pg.evaluate(() => { const x = document.querySelector('[data-centre-fraicheur] [data-fraicheur-unique]'); if (!x) { const d = document.querySelector('[data-centre-fraicheur]'); return { absent: true, entete: d ? d.innerHTML.slice(0, 120) : null, feuille: !!document.querySelector('[data-centre-notifs]') }; } const r = x.getBoundingClientRect(); return { etat: x.getAttribute('data-fraicheur-unique'), h: Math.round(r.height), txt: x.innerText.replace(/\s+/g, ' ').slice(0, 60) }; });
    dit(!!f && f.etat === 'retard' && f.h >= 40, 'A3.1 … et sa feuille montre la ligne entière (détail et geste)', JSON.stringify(f));
    if (CAPTURES) await o.pg.screenshot({ path: path.join(CAPTURES, `coque-cloche-${SUFFIXE}.png`) });
    await o.ctx.close();
  }
  // A3.1 bis · Paramètres (sa capture du 14 nov. : « N choses à revoir » au-dessus du titre de Paramètres).
  {
    const o = await ouvrir(nav, { W: 390, sombre: false, b: baseRetard(), url: '/?tab=settings' }); await pret(o.pg);
    await attendre(o.pg, () => o.pg.evaluate(() => { const f = document.querySelector('[data-fraicheur-unique]'); return f && f.getAttribute('data-fraicheur-unique') === 'retard'; }), 15000);
    const e = await o.pg.evaluate(() => { const f = document.querySelector('.vrm-main [data-fraicheur-unique]'); const hote = f && f.closest('.vrm-fraicheur-hote'); const r = hote ? hote.getBoundingClientRect() : null;
      return { etat: f && f.getAttribute('data-fraicheur-unique'), h: r ? Math.round(r.height) : 0, visible: /choses à revoir|pas relu/.test((document.querySelector('.vrm-main') || {}).innerText || '') }; });
    dit(e.h <= 1, 'A3.1 Paramètres : « à revoir » ne s\'écrit pas au-dessus du titre', JSON.stringify(e));
    await o.ctx.close();
  }
  // A3.2 · le titre : le « ? » à côté, pas de phrase écrite dessous.
  for (const url of ['/?tab=annonces', '/?tab=ventes']) {
    const o = await ouvrir(nav, { W: 390, sombre: false, b: base(), url }); await pret(o.pg);
    const t = await o.pg.evaluate(() => {
      const h = [...document.querySelectorAll('.vrm-main h1')].find((x) => x.getBoundingClientRect().height > 0); if (!h) return null;
      const p = h.parentElement.querySelector('.vrm-phrase-ecran'); if (!p) return { sans: true };
      const lisible = [...p.childNodes].map((n) => (n.nodeType === 3 ? n.nodeValue : (n.classList && n.classList.contains('vrm-sr-seul') ? '' : n.innerText || ''))).join('').replace(/[?\s]/g, '');
      const b = p.querySelector('button, [role="button"]'); const rh = h.getBoundingClientRect(); const rb = b ? b.getBoundingClientRect() : null;
      return { lisible, memeLigne: !!rb && Math.abs((rb.top + rb.height / 2) - (rh.top + rh.height / 2)) < 20 };
    });
    dit(!!t && (t.sans || (t.lisible === '' && t.memeLigne)), `${url} · A3.2 sous le grand titre, aucune phrase écrite ; le « ? » sur la ligne du titre`, JSON.stringify(t));
    await o.ctx.close();
  }
  // A3.3 · « Nouvelle version de VRM » : jamais un bandeau posé sur la liste ni au-dessus de la barre du bas.
  {
    const o = await ouvrir(nav, { W: 390, sombre: false, b: base(), url: '/?tab=achats' }); await pret(o.pg);
    await o.pg.evaluate(() => { window.__vrmMajDispo = 'assets/index-banc.js'; window.dispatchEvent(new Event('vrm:maj-dispo')); });
    await o.pg.waitForTimeout(3200);
    const m = await o.pg.evaluate(() => {
      const x = document.querySelector('[data-maj-dispo]'); if (!x) return null;
      const r = x.getBoundingClientRect(); const bar = document.querySelector('.vrm-tabbar'); const rb = bar ? bar.getBoundingClientRect() : null;
      const main = document.querySelector('.vrm-main'); const premier = main && [...main.children].find((c) => c.getBoundingClientRect().height > 2 && getComputedStyle(c).position !== 'fixed');
      const rp = premier ? premier.getBoundingClientRect() : null;
      return { haut: Math.round(r.top), bas: Math.round(r.bottom), barre: rb ? Math.round(rb.top) : null, contenu: rp ? Math.round(rp.top) : null };
    });
    dit(!!m, 'A3.3 « Mettre à jour » toujours proposé (rien de perdu)');
    dit(!!m && m.barre != null && m.bas < m.barre - 200, 'A3.3 … pas au-dessus de la barre du bas', JSON.stringify(m));
    dit(!!m && m.contenu != null && m.contenu >= m.bas - 1, 'A3.3 … une ligne sous la barre du haut qui pousse la page : rien du contenu dessous', JSON.stringify(m));
    if (CAPTURES) await o.pg.screenshot({ path: path.join(CAPTURES, `coque-maj-${SUFFIXE}.png`) });
    await o.ctx.close();
  }
}

// ── P : 1 000 annonces, l'arbre d'avant contre celui-ci ──
// Les annonces inventées à l'écran (leur titre, la feuille de texte la plus fine), par le texte seulement.
const vusALecranSrc = `window.vusALecran = (m) => { const vus = new Set(); const it = document.createTreeWalker(m, NodeFilter.SHOW_TEXT); let n; while ((n = it.nextNode())) { const t = n.nodeValue; const k = /Paire inventée (\\d+)/.exec(t || ''); if (!k) continue; const e = n.parentElement; const r = e.getBoundingClientRect(); if (r.height > 0 && r.top < innerHeight - 60 && r.bottom > 60) vus.add(k[1]); } return vus.size; };`;
async function mesureMille(nav, port) {
  const o = await ouvrir(nav, { W: 390, sombre: false, b: baseMille(), url: '/?tab=journee' });
  await o.pg.waitForTimeout(1500);
  await o.pg.addInitScript(vusALecranSrc);
  await o.pg.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {} });
  const t0 = Date.now();
  await o.pg.goto(`http://localhost:${port}/?tab=annonces`, { waitUntil: 'domcontentloaded' });
  const pretListe = await attendre(o.pg, () => o.pg.evaluate(() => { const m = document.querySelector('.vrm-main[data-ecran="annonces"]'); if (!m) return false; return vusALecran(m) >= 4; }), 30000);
  const premier = Date.now() - t0;
  await o.pg.waitForTimeout(1500);
  const noeuds = await o.pg.evaluate(() => document.querySelectorAll('.vrm-main *').length);
  const aLecran = await o.pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return m ? window.vusALecran(m) : 0; });
  const cls0 = await o.pg.evaluate(() => window.__cls || 0);
  const tr0 = Date.now();
  await o.pg.evaluate(async () => { const m = document.querySelector('.vrm-main'); for (let i = 0; i < 60; i++) { m.scrollTop += 700; await new Promise((r) => requestAnimationFrame(() => r())); } });
  const defile = Date.now() - tr0;
  await o.pg.waitForTimeout(600);
  const cls = (await o.pg.evaluate(() => window.__cls || 0)) - cls0;
  await o.ctx.close();
  return { pretListe, premier, noeuds, aLecran, cls: Math.round(cls * 1000) / 1000, defile };
}
async function vitesse(nav) {
  if (!AVANT) { console.log('  · P : sans BANC_DIST_AVANT, la vitesse à 1 000 annonces n\'est pas comparée'); return; }
  const DIST2 = path.resolve(AVANT);
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp' };
  const srv2 = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST2, f); if (!p.startsWith(DIST2) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
  const PORT2 = PORT + 1; await new Promise((ok2) => srv2.listen(PORT2, ok2));
  const res = { avant: [], apres: [] };
  for (let i = 0; i < 3; i++) { res.avant.push(await mesureMille(nav, PORT2)); res.apres.push(await mesureMille(nav, PORT)); }
  srv2.close();
  const med = (l, k) => l.map((x) => x[k]).sort((a, b) => a - b)[Math.floor((l.length - 1) / 2)];
  const A = { aLecran: med(res.avant, 'aLecran'), premier: med(res.avant, 'premier'), noeuds: med(res.avant, 'noeuds'), cls: Math.max(...res.avant.map((x) => x.cls)), defile: med(res.avant, 'defile') };
  const B = { aLecran: med(res.apres, 'aLecran'), premier: med(res.apres, 'premier'), noeuds: med(res.apres, 'noeuds'), cls: Math.max(...res.apres.map((x) => x.cls)), defile: med(res.apres, 'defile') };
  console.log('  · P avant', JSON.stringify(A), '· après', JSON.stringify(B));
  dit(res.apres.every((x) => x.pretListe), 'P 1 000 annonces : la liste s\'affiche (photos à l\'écran)');
  dit(B.aLecran >= A.aLecran, 'P articles visibles sur un écran 390 : jamais moins qu\'avant (la coque ne mange pas de place)', `${A.aLecran} → ${B.aLecran}`);
  dit(B.premier <= A.premier * 1.25 + 400, 'P premier rendu de la liste jamais pire que l\'arbre d\'avant (+25 % + 400 ms de bruit au plus)', `${A.premier} → ${B.premier} ms`);
  dit(B.noeuds <= A.noeuds + 150, 'P nœuds DOM de l\'écran : la coque n\'en ajoute pas plus de 150', `${A.noeuds} → ${B.noeuds}`);
  dit(B.cls <= A.cls + 0.01, 'P défilement jusqu\'en bas : aucun saut de mise en page de plus', `${A.cls} → ${B.cls}`);
  dit(B.defile <= A.defile * 1.25 + 300, 'P défilement : jamais plus lent que l\'arbre d\'avant', `${A.defile} → ${B.defile} ms`);
}

// ── Les captures à montrer (390 × dsf 2, clair) ──
async function captures(nav) {
  if (!CAPTURES) return;
  fs.mkdirSync(CAPTURES, { recursive: true });
  const shot = async (url, nom, jouer) => {
    const o = await ouvrir(nav, { W: 390, sombre: false, b: baseCloche(), url, dsf: 2 }); await pret(o.pg);
    // La pastille « Mis à jour » (2 s) : on attend qu'elle soit passée, et que l'écran ait ses nombres.
    await o.pg.waitForSelector('[data-temps-reel-neuf]', { timeout: 9000 }).catch(() => {}); await o.pg.waitForTimeout(3500);
    if (jouer) await jouer(o.pg);
    await o.pg.screenshot({ path: path.join(CAPTURES, `coque-${nom}-${SUFFIXE}.png`) });
    await o.ctx.close();
  };
  await shot('/?tab=journee', 'journee');
  await shot('/?tab=achats', 'achats');
  await shot('/?tab=ventes', 'ventes-defile', async (pg) => { await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 520; }); await pg.waitForTimeout(900); });
  await shot('/?tab=journee', 'compte', async (pg) => { await toucher(pg, '[data-profil-tete]'); await pg.waitForTimeout(1000); });
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    if (veut('regles')) await regles(nav);
    if (veut('ajout3')) await ajout3(nav);
    if (veut('vitesse')) await vitesse(nav);
    if (veut('captures')) await captures(nav);
  } catch (e) { dit(false, 'le banc a planté', String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(`\nrefonte-coque : ${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
