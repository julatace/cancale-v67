// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA TRADUCTION » (11 nov., lot traduction). Données INVENTÉES : le petit
//  jeu du banc `nouveau-vendeur`, servi par SON harnais (aucune écriture ne sort).
//  Les écrans DÉJÀ migrés (src/i18n/) dans les cinq langues, à 390 px tactile et
//  1512 px : la page d'accueil publique, la connexion et l'inscription (sans
//  session), puis la coque (barre du bas / colonne), le menu « Plus », Paramètres
//  et son panneau Langue. Il MESURE (jamais un libellé écrit ici) :
//   L1 `<html lang>` = la langue servie ;
//   L2 le texte rendu est CELUI du dictionnaire de la langue (titre, onglets) ;
//   L3 aucune clé brute (« reglages.langue.lib ») à l'écran ;
//   L4 rien ne déborde à droite, aucun titre coupé, aucun bouton court sur deux
//      lignes (l'allemand d'abord) ; cibles au doigt de 44 px (règles du banc
//      `nouveau-vendeur`, `INSPECTE`) ;
//   L5 choisir une langue dans Paramètres → Langue : l'écran change SANS
//      rechargement, `vrm_langue` est rangé ; le retour au français aussi ;
//   L6 aucune erreur JS ni console.
//  Réglages : `BANC_PORT` (9350 par défaut), `LARGEURS=390,1512`,
//  `LANGUES=fr,en,es,it,de`, `SHOTS=<dossier>` (captures à REGARDER), `BANC_DIST`.
//  Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9350';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const LANGUES = liste('LANGUES', 'fr,en,es,it,de');
const SHOTS = process.env.SHOTS || '';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };
const capture = async (pg, nom, plein = false) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein }).catch(() => {}); };

const charger = async (l) => { const imp = async (n) => (await import('file://' + path.join(__dirname, '..', '..', 'src', 'i18n', 'langues', n))).default; return { ...(await imp(`${l}-accueil.js`)), ...(await imp(`${l}.js`)) }; };

// La forme commune d'une page : langue, débordement, clés brutes.
const sondeLangue = (pg, cles) => pg.evaluate((cles) => {
  const txt = document.body.innerText || '';
  const brutes = [...new Set((txt.match(/\b[a-z][\w-]*(?:\.[\w-]+){1,4}\b/g) || []).filter((m) => cles.includes(m)))];
  const de = document.documentElement;
  const dehors = [];
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(e).position === 'fixed') continue;
    if (r.right > innerWidth + 1.5 && dehors.length < 6 && !e.closest('[aria-hidden="true"], .av-reveil, svg')) dehors.push(`${e.tagName.toLowerCase()}.${String(e.className || '').split(' ')[0]} (${Math.round(r.right)} > ${innerWidth}) « ${(e.innerText || '').trim().slice(0, 40)} »`);
  }
  return { lang: de.lang, brutes, debord: de.scrollWidth > innerWidth + 1, largeur: de.scrollWidth, dehors };
}, cles);

async function sansSession(nav, l, W, D, cles) {
  const tel = W < 600;
  const T = `[${l} ${W}px]`;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), locale: { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE' }[l] });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/settings**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { google: true, discord: false, email: true } }) }));
  await pg.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  // Accueil : la langue vient du NAVIGATEUR (aucun choix rangé).
  await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-accueil]', { timeout: 20000 }).catch(() => {});
  await attendre(1200);
  let s = await sondeLangue(pg, cles);
  const h1 = await pg.locator('[data-definition]').first().innerText().catch(() => '');
  dit(s.lang === l, `${T} accueil : <html lang="${l}"> (langue du navigateur)`, s.lang);
  dit(h1.trim() === D['accueil.hero.titre'], `${T} accueil : le titre est celui du dictionnaire`, h1);
  dit(!s.brutes.length, `${T} accueil : aucune clé brute`, s.brutes.join(', '));
  dit(!s.debord && !s.dehors.length, `${T} accueil : rien ne déborde`, `${s.largeur} px · ${s.dehors.join(' ¦ ')}`);
  await capture(pg, `trad-${l}-${W}-accueil`);
  await pg.locator('[data-section="prix"]').scrollIntoViewIfNeeded().catch(() => {});
  await attendre(400);
  await capture(pg, `trad-${l}-${W}-accueil-prix`);
  // Connexion, puis inscription.
  for (const q of ['connexion', 'inscription']) {
    await pg.goto(`http://localhost:${PORT}/?${q}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-auth-valider]', { timeout: 25000 }).catch(() => {});
    await attendre(800);
    s = await sondeLangue(pg, cles);
    const titre = await pg.locator('#vrm-cx-titre-formulaire').innerText().catch(() => '');
    const attendu = q === 'connexion' ? D['auth.titre.in'] : D['auth.titre.up'];
    dit(titre.trim() === attendu, `${T} ${q} : le titre est celui du dictionnaire`, `${titre} ≠ ${attendu}`);
    dit(!s.brutes.length, `${T} ${q} : aucune clé brute`, s.brutes.join(', '));
    dit(!s.debord && !s.dehors.length, `${T} ${q} : rien ne déborde`, `${s.largeur} px · ${s.dehors.join(' ¦ ')}`);
    await capture(pg, `trad-${l}-${W}-${q}`);
  }
  dit(!erreurs.length, `${T} sans session : aucune erreur JS`, erreurs.join(' ¦ '));
  await ctx.close();
}

async function avecSession(nav, l, W, D, cles) {
  const T = `[${l} ${W}px]`;
  const base = { lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 };
  // La langue CHOISIE est rangée par le vendeur (ligne `main`, synchronisée) : servie telle quelle.
  base.lignes.find((x) => x.id === 'main').data.vrm_langue = l;
  const o = await NV.ouvrir(nav, { W, sombre: false, base, tab: 'journee' });
  const pg = o.pg;
  await pg.evaluate((l) => { try { localStorage.setItem('vrm_langue', JSON.stringify(l)); } catch (_) {} }, l);
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  await attendre(2500);
  let s = await sondeLangue(pg, cles);
  dit(s.lang === l, `${T} app : <html lang="${l}">`, s.lang);
  const navTxt = await pg.evaluate(() => [...document.querySelectorAll('[data-nav-entree], .vrm-tabbar .vrm-nav-label')].map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim()).filter(Boolean));
  const attendus = o.tel ? [D['nav.journee.court'], D['nav.annonces'], D['nav.ventes'], D['nav.cat_bord']] : [D['nav.journee'], D['nav.annonces'], D['nav.ventes'], D['nav.messages'], D['nav.cat_bord']];
  dit(attendus.every((a) => navTxt.some((t) => t.split('\n')[0] === a)), `${T} la navigation dit les noms du dictionnaire`, `${navTxt.slice(0, 10).join(' | ')} ⇐ ${attendus.join(' | ')}`);
  dit(!s.brutes.length, `${T} Ma journée : aucune clé brute`, s.brutes.join(', '));
  await capture(pg, `trad-${l}-${W}-journee`);
  // (11 nov., lot 2) Les écrans migrés : chacun dit au moins une phrase de SON dictionnaire
  // (dans la langue choisie), aucune clé brute, rien ne déborde à droite.
  const ECRANS_MIGRES = (process.env.ECRANS || 'journee:journee,ventes:ventes,achats:achats,annonces:annonces').split(',').map((x) => x.split(':'));
  for (const [tab, pref] of ECRANS_MIGRES) {
    if (tab !== 'journee') { await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {}); await attendre(2500); }
    const phrases = Object.entries(D).filter(([k, v]) => k.startsWith(pref + '.') && typeof v === 'string' && v.replace(/\{\w+\}/g, '').trim().length >= 6).map(([, v]) => v.split(/\{\w+\}/).sort((a, b) => b.length - a.length)[0].trim()).filter((v) => v.length >= 6);
    const r2 = await pg.evaluate(({ phrases, cles }) => { const t = (document.body.innerText || '').replace(/\s+/g, ' '); return { vues: phrases.filter((p) => t.includes(p.replace(/\s+/g, ' '))).slice(0, 5), brutes: [...new Set((t.match(/\b[a-z][\w-]*(?:\.[\w-]+){1,4}\b/g) || []).filter((m) => cles.includes(m)))], debord: document.documentElement.scrollWidth > innerWidth + 1 }; }, { phrases, cles });
    dit(r2.vues.length >= 1, `${T} ${tab} : au moins une phrase de « ${pref}.* » dans la langue choisie`, JSON.stringify(r2.vues));
    dit(!r2.brutes.length, `${T} ${tab} : aucune clé brute`, r2.brutes.join(', '));
    dit(!r2.debord, `${T} ${tab} : rien ne déborde à droite`);
    await capture(pg, `trad-${l}-${W}-${tab}`);
  }
  // Le menu « Plus » (téléphone) / la colonne (ordinateur).
  if (o.tel) {
    const plus = pg.locator('.vrm-nav-more').first();
    if (await plus.count()) { await plus.click().catch(() => {}); await attendre(700); s = await sondeLangue(pg, cles); dit(!s.brutes.length && !s.debord, `${T} menu « Plus » : aucune clé brute, rien ne déborde`, s.brutes.join(', ') + ' ' + s.dehors.join(' ¦ ')); await capture(pg, `trad-${l}-${W}-plus`); await pg.keyboard.press('Escape').catch(() => {}); await attendre(300); }
    else dit(false, `${T} le bouton « Plus » existe`);
  }
  // Paramètres.
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-set', { timeout: 25000 }).catch(() => {});
  await attendre(2500);
  const r = await NV.INSPECTE(pg, o.tel);
  s = await sondeLangue(pg, cles);
  const h = await pg.locator('.vrm-set-h1').first().innerText().catch(() => '');
  dit(h.trim() === D['ecran.settings'], `${T} Paramètres : le titre est celui du dictionnaire`, h);
  const libs = await pg.evaluate(() => [...document.querySelectorAll('[data-groupe-reglages] h3')].map((e) => e.innerText.trim()));
  dit(libs.length >= 3, `${T} Paramètres : ${libs.length} groupes titrés`, libs.join(' | '));
  dit(!s.brutes.length, `${T} Paramètres : aucune clé brute`, s.brutes.join(', '));
  dit(!r.debord && !r.dehors.length && !s.debord, `${T} Paramètres : rien ne déborde à droite`, JSON.stringify(r.dehors) + ' ' + s.dehors.join(' ¦ '));
  dit(!r.coupes.length, `${T} Paramètres : aucun titre coupé`, r.coupes.join(' ¦ '));
  const deuxLignes = r.colles.filter((c) => /sur \d lignes/.test(c));
  dit(!deuxLignes.length, `${T} Paramètres : aucun bouton court sur deux lignes`, deuxLignes.join(' ¦ '));
  if (o.tel) dit(!r.petits.length, `${T} Paramètres : chaque cible au doigt fait 44 px`, r.petits.slice(0, 6).join(' ¦ '));
  await capture(pg, `trad-${l}-${W}-parametres`, true);
  // La ligne Langue : son panneau, chaque langue écrite dans sa langue, le choix coché.
  const ligne = pg.locator('[data-reglage-langue]').first();
  dit(await ligne.count() > 0, `${T} Paramètres : la ligne Langue existe`);
  if (await ligne.count()) {
    await ligne.scrollIntoViewIfNeeded().catch(() => {});
    if (!(await pg.locator('[data-langue-choix] [data-langue]:visible').count())) { await ligne.click().catch(() => {}); await attendre(700); }
    const choix = await pg.evaluate(() => { const g = [...document.querySelectorAll('[data-langue-choix]')].find((e) => e.getBoundingClientRect().height > 0) || document.querySelector('[data-langue-choix]'); return g ? { val: g.getAttribute('data-langue-choix'), coche: (g.querySelector('[aria-checked="true"]') || {}).getAttribute && g.querySelector('[aria-checked="true"]').getAttribute('data-langue'), n: g.querySelectorAll('[data-langue]').length } : null; });
    dit(choix && choix.val === l && choix.coche === l && choix.n === 5, `${T} Langue : cinq choix, « ${l} » coché`, JSON.stringify(choix));
    await capture(pg, `trad-${l}-${W}-langue`);
    // L5 : changer de langue sans rechargement (vers l'anglais, ou le français depuis l'anglais).
    const cible = l === 'en' ? 'fr' : 'en';
    const Dc = await charger(cible);
    await pg.evaluate(() => { window.__bancPasRecharge = 1; });
    await pg.locator(`[data-langue-choix] [data-langue="${cible}"]:visible`).first().click().catch(() => {});
    await attendre(1500);
    const apres = await pg.evaluate(() => ({ lang: document.documentElement.lang, garde: window.__bancPasRecharge === 1, range: localStorage.getItem('vrm_langue'), h: (document.querySelector('.vrm-set-h1, .vrm-set-sous-h') || {}).innerText || '' }));
    dit(apres.lang === cible && apres.garde && apres.range === JSON.stringify(cible), `${T} Langue → ${cible} : l'écran change sans rechargement, le choix est rangé`, JSON.stringify(apres));
    const navApres = await pg.evaluate(() => [...document.querySelectorAll('[data-nav-entree], .vrm-tabbar .vrm-nav-label')].map((e) => (e.innerText || '').trim().split('\n')[0]).filter(Boolean));
    dit(navApres.includes(Dc['nav.annonces']), `${T} Langue → ${cible} : la navigation suit`, navApres.slice(0, 8).join(' | '));
  }
  dit(!o.journal.erreurs.length, `${T} app : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((r) => NV.srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const fr = await charger('fr');
  const cles = Object.keys(fr);
  try {
    for (const l of LANGUES) {
      const D = await charger(l);
      for (const W of LARGEURS) {
        try { await sansSession(nav, l, W, D, cles); } catch (e) { dit(false, `[${l} ${W}px] sans session : le banc a levé`, e.message); }
        try { await avecSession(nav, l, W, D, cles); } catch (e) { dit(false, `[${l} ${W}px] avec session : le banc a levé`, e.message); }
      }
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc traduction : ${ok} OK, ${ko} KO${SHOTS ? ' — captures dans ' + SHOTS : ''}`);
  process.exit(ko ? 1 : 0);
})();
