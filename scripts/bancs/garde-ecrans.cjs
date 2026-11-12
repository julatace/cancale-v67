// ════════════════════════════════════════════════════════════════════════════
//  BANC « UN GARDE-FOU PAR ÉCRAN » — filet 2 du 6 nov. (« l'app ne bug jamais »)
//  (docs/passation/2026-11-06-filets-anti-bug.md ; src/composants/GardeEcran.jsx)
//  Données INVENTÉES : le jeu et le harnais du banc `nouveau-vendeur` (aucune
//  écriture ne sort du banc). À 390 px tactile et 1512 px.
//  Le crochet de banc `window.__VRM_BANC_PLANTE = '<nom>'` (servi depuis
//  localhost seulement) fait planter UN écran ou UNE feuille :
//   P1 l'écran planté dit « Cet écran a un souci » À SA PLACE (data-garde-ecran),
//      jamais le dernier filet « L'application n'a pas pu démarrer » ;
//   P2 la navigation reste là et MARCHE : un autre écran s'ouvre, sans garde-fou ;
//   P3 le plantage est noté par le chemin existant (src/plantages.js), avec le
//      NOM de l'écran (file d'attente ou base du banc) ;
//   P4 revenir sur l'écran (crochet retiré) le rend normalement : le garde-fou
//      s'est remis à zéro ; « Réessayer » le remonte aussi ;
//   P5 une FEUILLE plantée (la recherche) dit son souci dans une feuille qu'on
//      FERME, la coque reste ; « Fermer » la retire ;
//   P6 une section de site plantée (Ventes · Vinted) garde le titre et le
//      filtre des sites : on change de site sans quitter l'écran.
//  `MESURE=fichier.json` : écrit, pour Ma journée, Ventes et Colis, le texte de
//  l'écran, le nombre de nœuds et de lectures (/rest/v1) — pour comparer deux
//  dist/ (`BANC_DIST=…`) : « ça ne doit pas nuire à l'app ». `COMPARER=a.json,b.json`
//  compare deux mesures et rend 1 s'il y a un écart.
//  Réglages : `BANC_PORT` (défaut 10021), `LARGEURS=390,1512`, `SHOTS=<dossier>`.
//  Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');

if (process.env.COMPARER) {
  const [a, b] = process.env.COMPARER.split(',').map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  let ecarts = 0;
  for (const cle of Object.keys(a)) {
    const x = a[cle], y = b[cle];
    if (!y) { console.log(`KO  ${cle} : absent de la seconde mesure`); ecarts++; continue; }
    // `lectures` et `ecritures` (des NOMBRES) bougent avec l'horloge : dits, jamais jugés.
    console.log(`··  ${cle} lectures ${x.lectures} / ${y.lectures}, écritures ${x.ecritures} / ${y.ecritures} (selon l'horloge, non jugés)`);
    for (const k of ['texte', 'noeuds', 'formes']) {
      const same = k === 'formes' ? JSON.stringify(x[k] || null) === JSON.stringify(y[k] || null) : x[k] === y[k];
      if (!same) {
        ecarts++;
        if (k === 'texte') {
          const lx = x.texte.split('\n'), ly = y.texte.split('\n');
          const diff = lx.filter((l) => !ly.includes(l)).slice(0, 4).concat(['→'], ly.filter((l) => !lx.includes(l)).slice(0, 4));
          console.log(`KO  ${cle} texte différent : ${diff.join(' ¦ ')}`);
        } else if (k === 'formes') {
          const a1 = new Set(x.formes || []), b1 = new Set(y.formes || []);
          console.log(`KO  ${cle} lectures différentes : en moins ${[...a1].filter((u) => !b1.has(u)).slice(0, 3).join(' ¦ ')} · en plus ${[...b1].filter((u) => !a1.has(u)).slice(0, 3).join(' ¦ ')}`);
        } else console.log(`KO  ${cle} ${k} : ${x[k]} ≠ ${y[k]}`);
      } else console.log(`OK  ${cle} ${k} identique${k === 'texte' ? ` (${x.texte.length} caractères)` : k === 'formes' ? ` (${(x.formes || []).length} lectures différentes)` : ` (${x[k]})`}`);
    }
  }
  console.log(ecarts ? `\n❌ ${ecarts} écart(s)` : '\n✅ mêmes textes, mêmes nœuds, les mêmes lectures (ensemble des requêtes différentes)');
  process.exit(ecarts ? 1 : 0);
}

process.env.BANC_PORT = process.env.BANC_PORT || '10021';
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const LARGEURS = String(process.env.LARGEURS || '390,1512').split(',').map(Number).filter(Boolean);
const SHOTS = process.env.SHOTS || '';

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const capture = async (pg, nom) => { if (!SHOTS) return; try { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); } catch (_) {} };
const base = () => ({ lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 });

const etat = (pg) => pg.evaluate(() => {
  const t = document.body.innerText || '';
  const nav = document.querySelector('.vrm-mobile-nav, .vrm-sidebar');
  const r = nav && nav.getBoundingClientRect();
  return {
    garde: [...document.querySelectorAll('[data-garde-ecran]')].map((e) => e.getAttribute('data-garde-ecran')),
    gardeFeuille: [...document.querySelectorAll('[data-garde-feuille]')].map((e) => e.getAttribute('data-garde-feuille')),
    souci: /Cet écran a un souci/.test(t) && /n'a pas pu s'afficher/.test(t),
    dernierFilet: /L'application n'a pas pu démarrer/.test(t),
    nav: !!(r && r.width > 0 && r.height > 0),
    entete: !!document.querySelector('.vrm-app-header'),
    ecran: (document.querySelector('.vrm-main') || {}).getAttribute ? document.querySelector('.vrm-main').getAttribute('data-ecran') : null,
    texteMain: ((document.querySelector('.vrm-main') || {}).innerText || '').length,
  };
});
const plante = (pg, nom) => pg.evaluate((n) => { window.__VRM_BANC_PLANTE = n; }, nom);
const aller = async (pg, tel, id) => {
  const sel = tel ? `.vrm-mobile-nav [data-nav-entree="${id}"]` : `.vrm-sidebar [data-nav-entree="${id}"]`;
  let b = pg.locator(sel).first();
  if (!(await b.count()) && tel) {
    // Au téléphone, l'écran peut être sous « Plus » (les tuiles au-dessus de la barre).
    const plus = pg.locator('.vrm-tabbar button[aria-label^="Plus"]').first();
    if (await plus.count()) { await plus.click(); await pg.waitForTimeout(400); b = pg.locator(`[data-nav-entree="${id}"]:visible`).first(); }
  }
  if (!(await b.count())) return false;
  await b.click(); await pg.waitForTimeout(1500); return true;
};
const notes = (pg, bv) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_plantages_attente') || '[]'); } catch (_) { return []; } })
  .then((file) => file.concat(bv.lignes.filter((l) => /^plantage_/.test(l.id)).map((l) => l.data)));

async function tournee(nav, W) {
  const tel = W < 600, T = `[${W}px]`;
  const bv = base();
  const o = await NV.ouvrir(nav, { W, sombre: false, base: bv, tab: 'journee' });
  await o.pg.waitForTimeout(2500);
  // P1 — Ventes plante.
  await plante(o.pg, 'ventes');
  const alle = await aller(o.pg, tel, 'ventes');
  dit(alle, `${T} (contrôle du banc) l'entrée « Ventes » est dans la navigation`);
  let e = await etat(o.pg);
  await capture(o.pg, `garde-${W}-ventes-plante`);
  dit(e.garde.includes('ventes') && e.souci, `${T} P1 Ventes planté : « Cet écran a un souci » à sa place`, JSON.stringify(e));
  dit(!e.dernierFilet && e.entete, `${T} P1 la coque reste (jamais « L'application n'a pas pu démarrer »)`, JSON.stringify(e));
  dit(e.nav, `${T} P2 la navigation est là`, JSON.stringify(e));
  await o.pg.waitForTimeout(3500);   // la file part vers la base 3 s après
  const n1 = await notes(o.pg, bv);
  dit(n1.some((x) => x && x.ecran === 'ventes' && /plantage de banc/.test(x.message || '') && x.origine === 'ecran'), `${T} P3 le plantage est noté avec le nom de l'écran (« ventes »)`, JSON.stringify(n1.map((x) => [x.ecran, x.origine, x.message])));
  // P2 — un autre écran marche.
  await aller(o.pg, tel, 'journee');
  e = await etat(o.pg);
  dit(e.ecran === 'journee' && !e.garde.length && e.texteMain > 40, `${T} P2 Ma journée s'ouvre normalement après le plantage`, JSON.stringify(e));
  // P4 — revenir sur Ventes, crochet retiré : rendu normal (remis à zéro).
  await plante(o.pg, null);
  await aller(o.pg, tel, 'ventes');
  e = await etat(o.pg);
  dit(e.ecran === 'ventes' && !e.garde.length && e.texteMain > 40, `${T} P4 de retour sur Ventes : l'écran est rendu (garde-fou remis à zéro)`, JSON.stringify(e));
  // P4 bis — « Réessayer » remonte l'écran. (intégration g1) Depuis DJ3 Colis vit DANS Ventes (« À expédier ») :
  // c'est cette section (`ventes:colis`) qui plante ; le reste de Ventes et la coque restent.
  // La section est montée dans un écran gardé (déjà rendu) : on la plante AU CHARGEMENT (le crochet lu
  // d'une case de session, effacée ensuite), comme un vrai plantage au premier rendu.
  await o.pg.addInitScript(() => { try { const n = sessionStorage.getItem('banc_plante'); if (n) window.__VRM_BANC_PLANTE = n; } catch (_) {} });
  await o.pg.evaluate(() => { try { sessionStorage.setItem('banc_plante', 'ventes:colis'); } catch (_) {} });
  await o.pg.goto(o.pg.url().replace(/\?.*$/, '') + '?tab=ventes', { waitUntil: 'domcontentloaded' });
  await o.pg.waitForTimeout(4000);
  await o.pg.evaluate(() => { try { sessionStorage.removeItem('banc_plante'); } catch (_) {} });
  e = await etat(o.pg);
  dit(e.garde.includes('ventes:colis') && e.ecran === 'ventes' && e.entete && !e.dernierFilet, `${T} P1 Colis (Ventes · À expédier) planté : son garde-fou, Ventes et la coque restent`, JSON.stringify(e));
  await plante(o.pg, null);
  await o.pg.locator('[data-garde-ecran="ventes:colis"] [data-garde-reessayer]').first().click().catch(() => {});
  await o.pg.waitForTimeout(1500);
  e = await etat(o.pg);
  dit(!e.garde.length && e.ecran === 'ventes' && e.texteMain > 40, `${T} P4 « Réessayer » remonte Colis (Ventes · À expédier)`, JSON.stringify(e));
  // P6 — une section de site plantée : le titre et le filtre des sites restent.
  await aller(o.pg, tel, 'ventes');
  const vinted = o.pg.locator('[data-filtre-site] button[data-site="vinted"]').first();
  if (await vinted.count()) {
    await plante(o.pg, 'ventes:vinted');
    await vinted.click(); await o.pg.waitForTimeout(1200);
    e = await etat(o.pg);
    const filtre = await o.pg.locator('[data-filtre-site] button[data-site="toutes"]').count();
    dit(e.garde.includes('ventes:vinted') && filtre > 0, `${T} P6 Ventes · Vinted planté : le filtre des sites reste`, JSON.stringify(e));
    await plante(o.pg, null);
    await o.pg.locator('[data-filtre-site] button[data-site="toutes"]').first().click().catch(() => {}); await o.pg.waitForTimeout(1200);
    e = await etat(o.pg);
    dit(!e.garde.length && e.ecran === 'ventes', `${T} P6 un autre site s'ouvre sans quitter Ventes`, JSON.stringify(e));
  } else dit(false, `${T} (contrôle du banc) le filtre « Vinted » de Ventes est là`);
  // P5 — une feuille plante : la recherche. D'abord la recherche NORMALE, pour
  // savoir ce que la coque montre quand elle est ouverte (au téléphone, la barre
  // du bas peut s'effacer derrière le clavier) : le garde-fou ne doit rien y changer.
  await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-article', { detail: '1' })));
  await o.pg.waitForTimeout(1200);
  const normale = await etat(o.pg);
  await o.pg.keyboard.press('Escape').catch(() => {});
  await o.pg.locator('.vrm-hdr-recherche-fermer').first().click({ timeout: 2000 }).catch(() => {});
  await o.pg.waitForTimeout(600);
  await plante(o.pg, 'recherche');
  await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-article', { detail: '1' })));
  await o.pg.waitForTimeout(1200);
  e = await etat(o.pg);
  await capture(o.pg, `garde-${W}-recherche-plante`);
  dit(e.gardeFeuille.includes('recherche') && !e.dernierFilet && e.entete && e.nav === normale.nav, `${T} P5 la recherche plantée : une feuille qui le dit, la coque et la navigation restent comme avec la recherche normale`, JSON.stringify({ plantee: e, normale }));
  await plante(o.pg, null);
  await o.pg.locator('[data-garde-feuille="recherche"] [data-garde-fermer]').first().click().catch(() => {});
  await o.pg.waitForTimeout(800);
  e = await etat(o.pg);
  dit(!e.gardeFeuille.length && !e.dernierFilet, `${T} P5 « Fermer » retire la feuille`, JSON.stringify(e));
  await aller(o.pg, tel, 'journee');
  e = await etat(o.pg);
  dit(e.ecran === 'journee' && !e.garde.length, `${T} P2 après tout ça, Ma journée marche`, JSON.stringify(e));
  await o.ctx.close();
}

// « Ça ne doit pas nuire à l'app » : la même mesure sur deux dist/.
async function mesurer(nav, sortie) {
  const res = {};
  for (const W of LARGEURS) for (const tab of ['journee', 'ventes', 'cat_bord']) {
    const bv = base();
    let lectures = 0;
    const formes = new Set();
    const o = await NV.ouvrir(nav, { W, sombre: false, base: bv, tab });
    // Le NOMBRE de lectures dépend de l'horloge (relectures périodiques : mesuré, le
    // même dist/ deux fois donne 71 puis 75) ; l'ENSEMBLE des lectures différentes
    // (adresse sans dates ni nombres) ne dépend que du code : c'est lui qui juge.
    o.pg.on('request', (r) => {
      if (!/\/rest\/v1\//.test(r.url()) || r.method() !== 'GET') return;
      lectures++;
      formes.add(decodeURIComponent(r.url().replace(/^https?:\/\/[^/]+/, '')).replace(/\d{4}-\d\d-\d\dT[\d:.]+Z?/g, 'DATE').replace(/\d+/g, 'N'));
    });
    // On recharge : le compteur voit TOUTES les lectures depuis l'ouverture.
    lectures = 0;
    await o.pg.reload({ waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
    await o.pg.waitForTimeout(Number(process.env.MESURE_ATTENTE) || 6000);   // MESURE_ATTENTE : machine chargée ⇒ plus long
    const m = await o.pg.evaluate(() => {
      const main = document.querySelector('.vrm-main');
      // Les heures relatives (« il y a 2 min ») bougent avec l'horloge : retirées.
      const t = ((main && main.innerText) || '').replace(/\b\d{1,2}[:h]\d{2}\b/g, 'HH:MM').replace(/il y a \d+ ?(s|min|h|j)\b/g, 'il y a N');
      return { texte: t, noeuds: main ? main.querySelectorAll('*').length : 0 };
    });
    res[`${tab}@${W}`] = { ...m, lectures, formes: [...formes].sort(), ecritures: bv.ecritures };
    console.log(`MESURE ${tab}@${W} : ${m.texte.length} caractères, ${m.noeuds} nœuds, ${lectures} lectures, ${bv.ecritures} écritures`);
    await o.ctx.close();
  }
  fs.writeFileSync(sortie, JSON.stringify(res, null, 1));
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    if (process.env.MESURE) await mesurer(nav, process.env.MESURE);
    else for (const W of LARGEURS) {
      try { await tournee(nav, W); } catch (e) { dit(false, `[${W}px] le passage a pu aller au bout`, String(e && e.stack).slice(0, 300)); }
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log(ko ? `\n❌ garde-ecrans : ${ko} défaut(s)` : '\n✅ garde-ecrans : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
