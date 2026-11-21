require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LES ONGLETS RÉORGANISÉS (21 nov., onglets-menu — Julien : « totalement réorganiser les onglets », « toujours dans le
//  style Vintex », inspiré de Bleam ; puis « toute l'application doit être simplifiée et ergonomique »).
//  Récit : docs/passation/2026-11-21-onglets-menu.md.
//
//  Base INVENTÉE (`design-passe.cjs`), garde réseau. Téléphone 390 × 844 tactile (clair ET sombre) :
//    O1  la barre du bas : Aujourd'hui · Annonces · Publier · Messages · Menu, cinq places de même largeur (±1), ≥ 44,
//        libellés entiers ; Publier = un disque plein au milieu ;
//    O2  l'en-tête : le grand titre et AU PLUS une action à droite ; aucun champ de recherche posé sous le titre ;
//    O3  chaque place de la barre mène où elle dit (data-ecran), l'onglet s'allume ; Publier ouvre sa feuille (3 gestes) ;
//    O4  l'écran Menu : la carte du compte puis des tuiles en deux colonnes (≥ 56 de haut), rien qui déborde ;
//        CHAQUE tuile d'écran ouvre son écran, et Menu reste allumé ; la carte ouvre Paramètres ;
//    O5  les tuiles « Dans l'extension » ouvrent le panneau de l'extension (`?vrm=panneau&page=…`), rien d'autre ;
//    O6  aucun écran perdu : tout écran que l'ancienne navigation ouvrait (barre + « Plus ») est joignable (barre + Menu) ;
//    O7  rien en double : un écran n'a qu'UNE entrée entre la barre et le Menu ;
//    O9  sur chaque écran : un seul titre en haut (jamais petit titre centré + grand titre), ≤ 1 action, une seule recherche ;
//    O10 les pastilles de la barre ne changent pas d'un écran à l'autre (une source par compteur) ;
//    O11 le grand titre commence au même endroit sur chaque écran (audit §1.2) ;
//    O12 un écran ouvert depuis le Menu porte « ‹ Menu » (et il y ramène) ; une place de la barre n'en porte pas.
//  Ordinateur 1512 (clair ET sombre) :
//    O8  la barre latérale suit les mêmes groupes (en tête, Gestion, Dans l'extension, Aide), Paramètres en pied ;
//        chaque entrée d'écran ouvre son écran et s'allume ; aucune barre du bas.
//  Échoue sur le code d'avant (`BANC_DIST=<dist d'avant>`) : O1, O2, O4, O8, O9-O12.
//  `SHOTS=dossier` garde les captures ; `DSF=2` des captures nettes.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-onglets-menu');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = Number(process.env.DSF || 1);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(2600); };
const BARRE = ['journee', 'paires', 'publier', 'messages', 'menu'];
// Les écrans qu'ouvrait l'ANCIENNE navigation du téléphone (barre + « Plus », origin/main du 21 nov.) — « Tout va bien ? »
// ouvrait Paramètres (sa rubrique) : il y reste.
const AVANT = ['journee', 'annonces', 'ventes', 'achats', 'compta', 'garage', 'messages', 'emails', 'settings', 'communaute'];
const TUILES_ECRANS = ['ventes', 'achats', 'garage', 'compta', 'emails', 'extension', 'communaute'];
const ecranVu = (pg) => pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran'); });
const attendreEcran = (pg, id) => pg.waitForFunction((x) => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran') === x; }, id, { timeout: 30000 }).catch(() => {});
async function espionnerOuvertures(pg) {
  await pg.evaluate(() => { window.__ouvertes = []; window.open = (u) => { window.__ouvertes.push(String(u)); return { closed: false, opener: null }; }; });
}

async function telephone(nav, b, sombre, erreursTout) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=journee', dsf: DSF });
  await pret(pg);
  await pg.evaluate(() => { document.documentElement.style.setProperty('--n-bas-sur', '34px'); for (const t of document.querySelectorAll('.vrm-toast')) try { t.click(); } catch (_) {} });
  const t = `390 ${sombre ? 'sombre' : 'clair'}`;
  // O1
  const o1 = await pg.evaluate(() => {
    const bar = document.querySelector('[data-n-onglets]'); if (!bar) return null;
    const tabs = [...bar.querySelectorAll('.n-onglet')];
    return { ordre: tabs.map((x) => x.getAttribute('data-n-onglet')), larg: tabs.map((x) => Math.round(x.getBoundingClientRect().width * 10) / 10), haut: tabs.map((x) => Math.round(x.getBoundingClientRect().height)),
      disque: !!bar.querySelector('[data-n-onglet="publier"] .n-onglet-disque'),
      libelles: tabs.map((x) => { const l = x.querySelector('.n-onglet-libelle'); if (!l) return null; const r = document.createRange(); r.selectNodeContents(l); return { t: l.textContent, entier: r.getBoundingClientRect().width <= l.getBoundingClientRect().width + 1 }; }) };
  });
  dit(o1 && o1.ordre.join(',') === BARRE.join(','), `O1 ${t} : la barre = Aujourd’hui · Annonces · Publier · Messages · Menu`, o1 && o1.ordre);
  dit(o1 && Math.max(...o1.larg) - Math.min(...o1.larg) <= 1 && Math.min(...o1.larg) >= 44 && Math.min(...o1.haut) >= 44 && o1.disque, `O1 ${t} : même largeur (${o1 && o1.larg.join('/')}), ≥ 44, Publier en disque plein`, o1);
  dit(o1 && o1.libelles.every((l) => l && l.entier), `O1 ${t} : libellés entiers`, o1 && o1.libelles);
  // O2 — sur chaque écran de la barre
  for (const id of ['journee', 'paires', 'messages', 'menu']) {
    await pg.locator(`[data-n-onglet="${id}"]`).first().tap({ timeout: 30000 }).catch(() => {});
    await attendreEcran(pg, id === 'paires' ? 'annonces' : id); await pg.waitForTimeout(900);
    const o2 = await pg.evaluate(() => {
      const tete = [...document.querySelectorAll('[data-n-tete]')].find((x) => x.getClientRects().length);
      const droite = tete ? [...tete.querySelectorAll('.n-barre-droite button, .n-barre-droite a')].filter((x) => x.getClientRects().length).length : 0;
      // le champ de la COQUE (`data-recherche-zone`) ; la recherche propre d'un écran de liste (Annonces) est son contenu.
      const champ = [...document.querySelectorAll('.vrm-main [data-n-recherche][data-recherche-zone], .vrm-main [data-n-recherche] [data-recherche-zone]')].filter((x) => x.getClientRects().length && !x.closest('[data-n-recherche-ouverte]')).length;
      return { tete: !!tete, droite, champ };
    });
    dit(o2.droite <= 1 && o2.champ === 0, `O2 ${t} · ${id} : en-tête simple (${o2.droite} action à droite, ${o2.champ} champ sous le titre)`, o2);
    if (!sombre) await pg.screenshot({ path: path.join(SHOTS, `390-${id}.png`) });
    if (sombre && id === 'menu') await pg.screenshot({ path: path.join(SHOTS, `390-menu-sombre.png`) });
  }
  // O3 — chaque place mène où elle dit, son onglet s'allume
  for (const id of ['journee', 'paires', 'messages', 'menu']) {
    const n0 = erreurs.length;
    await pg.locator(`[data-n-onglet="${id}"]`).first().tap({ timeout: 30000 }).catch(() => {});
    const cible = id === 'paires' ? 'annonces' : id;
    await attendreEcran(pg, cible); await pg.waitForTimeout(700);
    const r = await pg.evaluate(() => ({ ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), actif: (document.querySelector('[data-n-onglets] [aria-current="page"]') || { getAttribute: () => null }).getAttribute('data-n-onglet') }));
    dit(r.ecran === cible && r.actif === id && erreurs.length === n0, `O3 ${t} : ${id} ouvre ${cible} et s’allume`, { ...r, erreurs: erreurs.slice(n0) });
  }
  await pg.locator('[data-n-onglet="publier"]').first().tap({ timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(900);
  const pub = await pg.evaluate(() => { const f = document.querySelector('[data-n-feuille-publier]'); if (!f) return null; const g = [...f.querySelectorAll('[data-geste-disque]')]; return { gestes: g.map((x) => x.getAttribute('data-geste-disque')), petits: g.filter((x) => x.getBoundingClientRect().height < 44).length }; });
  dit(pub && pub.gestes.join(',') === 'publier,scanner,imprimer' && !pub.petits, `O3 ${t} : Publier ouvre sa feuille (publier · scanner · imprimer), rangées ≥ 44`, pub);
  if (!sombre) await pg.screenshot({ path: path.join(SHOTS, '390-publier.png') });
  await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(700);
  // O4 — le Menu
  await pg.locator('[data-n-onglet="menu"]').first().tap({ timeout: 30000 }).catch(() => {});
  await attendreEcran(pg, 'menu'); await pg.waitForTimeout(800);
  const o4 = await pg.evaluate(() => {
    const m = document.querySelector('[data-n-menu]'); if (!m) return null;
    const tuiles = [...m.querySelectorAll('.n-tuile-menu')];
    const cols = new Set(tuiles.map((x) => Math.round(x.getBoundingClientRect().left)));
    const deborde = [...m.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 0.5 || r.left < -0.5); }).length;
    const coupes = tuiles.filter((x) => { const l = x.querySelector('.n-tuile-menu-libelle'); return l && l.scrollHeight > l.clientHeight + 1; }).map((x) => x.textContent);
    return { cles: tuiles.map((x) => x.getAttribute('data-n-plus-entree')), groupes: [...m.querySelectorAll('[data-n-menu-groupe]')].map((g) => g.getAttribute('data-n-menu-groupe')),
      carte: !!m.querySelector('.n-carte-compte'), petites: tuiles.filter((x) => x.getBoundingClientRect().height < 56).length, cols: cols.size, deborde, coupes, docDeborde: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  dit(o4 && o4.carte && o4.groupes.join(',') === 'gestion,extension,aide' && o4.cols === 2 && !o4.petites && !o4.deborde && !o4.docDeborde && !o4.coupes.length,
    `O4 ${t} : Menu = carte du compte + Gestion · Dans l’extension · Aide, deux colonnes, tuiles ≥ 56, rien ne déborde ni n’est coupé`, o4);
  const tuilesVues = o4 ? o4.cles : [];
  // O4b le bas du Menu (comme Bleam) : cacher les montants, mode sombre, langue, se déconnecter ; le mode sombre bascule
  const bas = await pg.evaluate(() => [...document.querySelectorAll('[data-n-menu] [data-n-menu-reglages] [data-n-plus-entree], [data-n-menu] [data-n-menu-sortie] [data-n-plus-entree]')].map((x) => x.getAttribute('data-n-plus-entree')));
  const sombreAvant = await pg.evaluate(() => document.documentElement.getAttribute('data-theme') || document.documentElement.className);
  await pg.locator('[data-n-menu] [data-bouton-sombre]').first().tap({ timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(700);
  const sombreApres = await pg.evaluate(() => document.documentElement.getAttribute('data-theme') || document.documentElement.className);
  await pg.locator('[data-n-menu] [data-bouton-sombre]').first().tap({ timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(700);
  const sombreRetour = await pg.evaluate(() => document.documentElement.getAttribute('data-theme') || document.documentElement.className);
  dit(['montants', 'sombre', 'langue', 'deconnexion'].every((x) => bas.includes(x)) && sombreApres !== sombreAvant && sombreRetour === sombreAvant,
    `O4 ${t} : bas du Menu = montants · mode sombre · langue · se déconnecter ; le mode sombre bascule et revient`, { bas, sombreAvant, sombreApres, sombreRetour });
  await pg.locator('[data-n-menu] [data-n-plus-entree="langue"]').first().tap({ timeout: 30000 }).catch(() => {}); await attendreEcran(pg, 'settings'); await pg.waitForTimeout(1200);
  const langue = await pg.evaluate(() => ({ ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), panneau: !![...document.querySelectorAll('[data-sous-panneau="apparence"], [data-reglage-apparence]')].find((x) => x.getClientRects().length) }));
  dit(langue.ecran === 'settings', `O4 ${t} : « Langue » ouvre Paramètres (Apparence et langue)`, langue);
  await pg.locator('[data-n-onglet="menu"]').first().tap({ timeout: 30000 }).catch(() => {}); await attendreEcran(pg, 'menu'); await pg.waitForTimeout(600);
  for (const id of TUILES_ECRANS.filter((x) => tuilesVues.includes(x))) {
    if ((await ecranVu(pg)) !== 'menu') { await pg.locator('[data-n-onglet="menu"]').first().tap({ timeout: 30000 }).catch(() => {}); await attendreEcran(pg, 'menu'); await pg.waitForTimeout(600); }
    const n0 = erreurs.length;
    await pg.locator(`[data-n-menu] [data-n-plus-entree="${id}"]`).first().tap({ timeout: 30000 }).catch(() => {});
    await attendreEcran(pg, id); await pg.waitForTimeout(1000);
    const r = await pg.evaluate(() => ({ ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), actif: (document.querySelector('[data-n-onglets] [aria-current="page"]') || { getAttribute: () => null }).getAttribute('data-n-onglet') }));
    dit(r.ecran === id && r.actif === 'menu' && erreurs.length === n0, `O4 ${t} : Menu → ${id} s’ouvre, Menu reste allumé`, { ...r, erreurs: erreurs.slice(n0) });
    if (!sombre && id === 'ventes') await pg.screenshot({ path: path.join(SHOTS, '390-ventes-depuis-menu.png') });
  }
  await pg.locator('[data-n-onglet="menu"]').first().tap({ timeout: 30000 }).catch(() => {}); await attendreEcran(pg, 'menu'); await pg.waitForTimeout(600);
  await pg.locator('[data-n-menu] .n-carte-compte').first().tap({ timeout: 30000 }).catch(() => {}); await attendreEcran(pg, 'settings'); await pg.waitForTimeout(800);
  dit((await ecranVu(pg)) === 'settings', `O4 ${t} : la carte du compte ouvre Paramètres`, await ecranVu(pg));
  await pg.locator('[data-n-tete] [data-n-retour-menu]').first().tap({ timeout: 30000 }).catch(() => {}); await attendreEcran(pg, 'menu'); await pg.waitForTimeout(800);
  const apresRetour = await pg.evaluate(() => ({ ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), etat: (window.history.state || {}).vrmTab }));
  dit(apresRetour.ecran === 'menu' && apresRetour.etat === 'menu', `O12 ${t} : « ‹ Menu » ramène au Menu (par le retour : l'entrée avait été empilée)`, apresRetour);
  // O9 + O10 (captures de Julien du 21 nov., audit du 20 nov. §1.2–1.3) — sur CHAQUE écran : un seul titre en haut (jamais le
  // petit titre centré de la barre au-dessus du grand titre de l'écran), au plus une action à droite, aucune recherche de
  // la coque si l'écran a la sienne ; les pastilles de la barre sont les MÊMES d'un écran à l'autre (une source chacune).
  const pastilles = {}, hauts = {}, retours = {};
  for (const id of ['journee', 'annonces', 'messages', 'menu', 'ventes', 'achats', 'garage', 'compta', 'emails', 'settings', 'extension']) {
    await pg.evaluate((x) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: x })), id);
    await attendreEcran(pg, id); await pg.waitForTimeout(1200);
    const r = await pg.evaluate(async () => {
      const m = document.querySelector('.vrm-main'); m.scrollTop = 0; await new Promise((ok) => setTimeout(ok, 300));
      const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.4;
      const tete = [...document.querySelectorAll('[data-n-tete]')].find((x) => x.getClientRects().length);
      const centre = tete && tete.querySelector('.n-barre-centre');
      const h1 = [...m.querySelectorAll('h1')].filter((h) => vis(h) && h.getBoundingClientRect().top < 360 && h.textContent.trim());
      // O11 : le grand titre visible le plus haut (celui de la coque ou celui de l'écran), sa position — lue avant tout défilement
      const haut = (() => { const t = [...document.querySelectorAll('h1')].filter((h) => vis(h) && h.textContent.trim() && !h.closest('[data-n-feuille-publier]')).map((h) => { const r = document.createRange(); r.selectNodeContents(h); const b = r.getBoundingClientRect(); return { top: Math.round(b.top), left: Math.round(b.left), t: h.textContent.trim().slice(0, 18) }; }).filter((x) => x.top > -5)[0]; const bloc = [...document.querySelectorAll('[data-numeros-a-ecrire]')].find((x) => x.getClientRects().length); return t ? { ...t, sousBloc: !!(bloc && bloc.getBoundingClientRect().bottom <= t.top) } : null; })();
      m.scrollTop = 200; await new Promise((ok) => setTimeout(ok, 500));
      const centreBas = centre && vis(centre) ? centre.textContent.trim() : '';
      const h1Bas = [...m.querySelectorAll('h1')].filter((h) => vis(h) && h.getBoundingClientRect().top > 0 && h.getBoundingClientRect().top < 300).map((h) => h.textContent.trim());
      m.scrollTop = 0;
      const pas = {}; for (const o of document.querySelectorAll('[data-n-onglets] .n-onglet')) { const p = o.querySelector('.n-onglet-pastille, .n-onglet-point'); pas[o.getAttribute('data-n-onglet')] = p ? (p.textContent || '•') : ''; }
      return { ecran: m.getAttribute('data-ecran'), h1: h1.length, double: !!centreBas && h1Bas.some((x) => x === centreBas), centreBas, h1Bas,
        droite: tete ? [...tete.querySelectorAll('.n-barre-droite button')].filter(vis).length : 0,
        champs: [...m.querySelectorAll('[data-n-recherche], input[type="search"]')].filter(vis).length,
        loupe: !!(tete && [...tete.querySelectorAll('[data-n-tete-loupe]')].some(vis)), pas, haut,
        retour: !!(tete && [...tete.querySelectorAll('[data-n-retour-menu]')].some(vis)) };
    });
    pastilles[id] = r.pas; hauts[id] = r.haut; retours[id] = r.retour;
    // Ma journée : le « Ma journée » de son CONTENU est le second titre que l'audit retire (§2.6) — chantier de l'écran
    // Ma journée, en cours en parallèle ; la coque, elle, ne double rien (`double`).
    dit(r.ecran === id && !r.double && (r.h1 <= 1 || id === 'journee') && r.droite <= 1 && !(r.loupe && r.champs > 0), `O9 ${t} · ${id} : un seul titre, ${r.droite} action à droite, ${r.loupe ? 'la loupe' : 'pas de loupe'} et ${r.champs} champ de l’écran`, r);
    if (!sombre && ['achats', 'compta', 'garage', 'settings'].includes(id)) await pg.screenshot({ path: path.join(SHOTS, `390-${id}.png`) });
  }
  // O11 (audit du 20 nov. §1.2, captures de Julien : « Achats : la recherche AU-DESSUS du grand titre, ailleurs dessous ») le
  // grand titre commence au même endroit sur chaque écran (±6 px en hauteur, ±6 px à gauche).
  // ⚠️ Stock : la liste « À écrire sur tes cartons » (posée au-dessus de l'écran tant que les N° ne sont pas écrits) repousse
  // son titre — la ranger SOUS le titre est un geste du contenu de Stock (src/ecrans/Stock.jsx), hors de ce chantier : dit, pas jugé.
  for (const [k, v] of Object.entries(hauts)) if (v && v.sousBloc) { console.log(`  ⚠️  O11 ${t} · ${k} : titre sous la liste « À écrire sur tes cartons » (haut ${v.top}) — à ranger dans l’écran Stock`); delete hauts[k]; }
  const tops = Object.values(hauts).filter(Boolean).map((x) => x.top), lefts = Object.values(hauts).filter(Boolean).map((x) => x.left);
  dit(Object.values(hauts).every(Boolean) && Math.max(...tops) - Math.min(...tops) <= 6 && Math.max(...lefts) - Math.min(...lefts) <= 6,
    `O11 ${t} : le grand titre au même endroit sur les ${Object.keys(hauts).length} écrans (haut ${Math.min(...tops)}–${Math.max(...tops)}, gauche ${Math.min(...lefts)}–${Math.max(...lefts)})`, hauts);
  // O12 un écran ouvert depuis le Menu porte « ‹ Menu » ; une place de la barre n'en porte pas
  const avecRetour = Object.keys(retours).filter((x) => retours[x]).sort(), attenduRetour = ['achats', 'compta', 'emails', 'extension', 'garage', 'settings', 'ventes'];
  dit(JSON.stringify(avecRetour) === JSON.stringify(attenduRetour), `O12 ${t} : « ‹ Menu » sur les écrans du Menu seulement`, avecRetour);
  const formes = [...new Set(Object.values(pastilles).map((x) => JSON.stringify(x)))];
  dit(formes.length === 1, `O10 ${t} : les pastilles de la barre sont les mêmes sur les ${Object.keys(pastilles).length} écrans`, pastilles);
  await pg.locator('[data-n-onglet="menu"]').first().tap({ timeout: 30000 }).catch(() => {}); await attendreEcran(pg, 'menu'); await pg.waitForTimeout(600);
  // O5
  await pg.locator('[data-n-onglet="menu"]').first().tap({ timeout: 30000 }).catch(() => {}); await attendreEcran(pg, 'menu'); await pg.waitForTimeout(600);
  await espionnerOuvertures(pg);
  for (const k of ['favoris-ext', 'automatisations-ext']) await pg.locator(`[data-n-menu] [data-n-plus-entree="${k}"]`).first().tap({ timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(300);
  const o5 = await pg.evaluate(() => ({ ouvertes: window.__ouvertes || [], ecran: document.querySelector('.vrm-main').getAttribute('data-ecran') }));
  dit(o5.ouvertes.length === 2 && /[?&]vrm=panneau&page=favoris/.test(o5.ouvertes[0]) && /[?&]vrm=panneau&page=automatisations/.test(o5.ouvertes[1]) && o5.ecran === 'menu',
    `O5 ${t} : les tuiles « Dans l’extension » ouvrent le panneau de l’extension (favoris, automatisations)`, o5);
  // O6 + O7 — joignable, sans double
  const o6 = await pg.evaluate(() => {
    const barre = [...document.querySelectorAll('[data-n-onglets] [data-nav-entree]')].map((x) => x.getAttribute('data-nav-entree'));
    const menu = [...document.querySelectorAll('[data-n-menu] [data-nav-entree]')].map((x) => x.getAttribute('data-nav-entree'));
    return { barre, menu };
  });
  const joignables = new Set([...o6.barre.map((x) => (x === 'paires' ? 'annonces' : x)), ...o6.menu]);
  const perdus = AVANT.filter((x) => !joignables.has(x));
  dit(!perdus.length, `O6 ${t} : aucun écran perdu (${joignables.size} joignables depuis la barre et le Menu)`, { perdus, joignables: [...joignables] });
  const toutes = [...o6.barre.filter((x) => x !== 'menu'), ...o6.menu];
  const doubles = toutes.filter((x, i) => toutes.indexOf(x) !== i);
  dit(!doubles.length, `O7 ${t} : rien en double entre la barre et le Menu`, doubles);
  erreursTout.push(...erreurs);
  await ctx.close();
}

async function ordinateur(nav, b, sombre, erreursTout) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 1512, sombre, b, url: '/?tab=journee', dsf: DSF });
  await pret(pg);
  const t = `1512 ${sombre ? 'sombre' : 'clair'}`;
  const o8 = await pg.evaluate(() => {
    const lat = document.querySelector('[data-n-laterale]'); if (!lat) return null;
    const groupes = [...lat.querySelectorAll('.n-laterale-groupe')].map((g) => ({ titre: (g.querySelector('.n-laterale-titre') || {}).textContent || '', entrees: [...g.querySelectorAll('[data-n-entree]')].map((e) => e.getAttribute('data-n-entree')) }));
    const pied = lat.querySelector('.n-laterale-pied [data-n-entree="settings"]');
    const barreBas = [...document.querySelectorAll('[data-n-onglets]')].filter((x) => x.getClientRects().length).length;
    return { groupes, pied: !!pied, barreBas, deborde: lat.scrollHeight > lat.clientHeight + 1 && getComputedStyle(lat).overflowY === 'visible' };
  });
  const attendu = [['journee', 'annonces', 'publier', 'messages'], ['ventes', 'achats', 'garage', 'compta', 'emails'], ['favoris-ext', 'automatisations-ext'], ['notifications', 'extension', 'communaute']];
  const vu = o8 ? o8.groupes.map((g) => g.entrees.filter((x) => x !== 'parrainage' && x !== 'etat-actions')) : [];
  const conforme = o8 && vu.length === 4 && attendu.every((a, i) => a.filter((x) => x !== 'garage').every((x) => vu[i].includes(x)) && vu[i].every((x) => a.includes(x)));
  dit(conforme && o8.pied && o8.barreBas === 0, `O8 ${t} : la barre latérale suit les groupes du Menu, Paramètres en pied, pas de barre du bas`, o8);
  if (!sombre) await pg.screenshot({ path: path.join(SHOTS, '1512-journee.png') });
  else await pg.screenshot({ path: path.join(SHOTS, '1512-journee-sombre.png') });
  for (const id of ['annonces', 'messages', 'ventes', 'achats', 'garage', 'compta', 'emails', 'extension', 'communaute', 'settings', 'journee']) {
    const loc = pg.locator(`[data-n-laterale] [data-n-entree="${id}"]`).first();
    if (!(await loc.count())) { if (id !== 'garage') dit(false, `O8 ${t} : ${id} absent de la barre latérale`); continue; }
    const n0 = erreurs.length;
    await loc.click({ timeout: 30000 }).catch(() => {});
    await attendreEcran(pg, id); await pg.waitForTimeout(700);
    const r = await pg.evaluate(() => ({ ecran: document.querySelector('.vrm-main').getAttribute('data-ecran'), actif: (document.querySelector('[data-n-laterale] [aria-current="page"]') || { getAttribute: () => null }).getAttribute('data-n-entree') }));
    dit(r.ecran === id && r.actif === id && erreurs.length === n0, `O8 ${t} : ${id} s’ouvre depuis la barre latérale et s’allume`, { ...r, erreurs: erreurs.slice(n0) });
  }
  erreursTout.push(...erreurs);
  await ctx.close();
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  const erreurs = [];
  try {
    for (const sombre of [false, true]) { console.log(`\nTéléphone 390 · ${sombre ? 'sombre' : 'clair'}`); await telephone(nav, b, sombre, erreurs); }
    for (const sombre of [false, true]) { console.log(`\nOrdinateur 1512 · ${sombre ? 'sombre' : 'clair'}`); await ordinateur(nav, b, sombre, erreurs); }
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} onglets-menu : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
