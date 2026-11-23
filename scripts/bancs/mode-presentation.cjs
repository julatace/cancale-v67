require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « MODE PRÉSENTATION » (23 nov., Julien présente VRM) — l'app RENDUE,
//  données INVENTÉES (le jeu de `nouveau-vendeur.cjs` : 2 comptes Vinted, un
//  compte Leboncoin, ventes, achats, conversations, codes de retrait, un n° de
//  suivi). 390 px tactile ET 1512 px. Jugé sur des `data-*` et le TEXTE RENDU.
//   A. Hors présentation, le banc n'est pas vide : montants et pseudos lisibles.
//   B. L'interrupteur de Paramètres (`data-reglage-presentation`) allume le mode :
//      `data-presentation="1"` sur la racine, la pastille `data-pastille-presentation`
//      visible, mémorisé sur l'appareil (`vrm_presentation`), RIEN envoyé au nuage.
//   C. Sur CHAQUE écran monté (et le menu du compte) : aucun montant (« 45,90 € »,
//      « 120 € »), aucun nom de ses comptes, aucun pseudo d'acheteur, aucune
//      adresse, aucun code de retrait, aucun n° de suivi lisible ; les N° restent ;
//      aucune photo floutée par la présentation ; « Compte 1 » apparaît quelque part.
//   D. Éteint d'un toucher sur la pastille : le texte revient sans recharger.
//  `SHOTS=dossier` : une capture par écran (à REGARDER).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const NV = require('./nouveau-vendeur.cjs');
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair');
const ECRANS = liste('ECRANS', 'journee,annonces,vinted_annonces,ventes,plat_vinted,plat_leboncoin,cat_bord,messages,garage,achats,dashboard,compta,extension,settings');

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };

// Ce qui ne doit JAMAIS être lisible en présentation (le jeu inventé du banc).
const INTERDITS = {
  comptes: ['vendeuse_a', 'vendeuse_b', 'Ma boutique', 'nouvelle.vendeuse@exemple.test'],
  acheteurs: ['acheteuse_lyon', 'marc.b', 'sneaker_fan'],
  adresses: ['8 Rue de la Paix', '35000 Rennes'],
  codes: ['K48291', '582913'],
  suivis: ['40817263'],
};
const LIRE = (pg, interdits) => pg.evaluate((I) => {
  const t = document.body.innerText || '';
  const montants = t.match(/\d(?:[\d   .,]*\d)?[   ]?(?:[kM][   ]?)?€|€[   ]?\d|\d+,\d\d ?€/g) || [];
  const fuites = {};
  for (const [cat, mots] of Object.entries(I)) for (const m of mots) {
    const re = new RegExp('(^|[^\\p{L}\\p{N}_])' + m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}_])', 'iu');
    if (re.test(t)) (fuites[cat] = fuites[cat] || []).push(m);
  }
  // Un code écrit un chiffre par case (« 5 », « 8 »… : innerText les sépare) : le texte du DOM, sans aucun blanc
  // (scripts et styles exclus) — un code ou un n° de suivi n'y apparaît jamais en entier.
  const clone = document.body.cloneNode(true);
  for (const x of clone.querySelectorAll('script, style, noscript')) x.remove();
  const compact = (clone.textContent || '').replace(/[\s\u200b]+/g, '');
  for (const cat of ['codes', 'suivis']) for (const m of I[cat] || []) if (compact.includes(m) && !(fuites[cat] || []).includes(m)) (fuites[cat] = fuites[cat] || []).push(m + ' (DOM)');
  const p = document.querySelector('[data-pastille-presentation]');
  const r = p ? p.getBoundingClientRect() : null;
  return {
    montants: montants.length, exMontants: montants.slice(0, 3), fuites,
    nums: (t.match(/N°\s?[A-Z]?\d+/g) || []).length,
    comptesN: (t.match(/\bCompte [0-9]+\b/g) || []).length,
    photosFloues: document.querySelectorAll('[data-stream-photo]').length,
    racine: document.documentElement.getAttribute('data-presentation'),
    pastille: !!(r && r.width > 0 && r.height > 0 && r.top >= 0),
    long: t.length,
  };
}, interdits);
const aller = async (pg, e) => {
  try { await pg.goto(`http://localhost:${NV.PORT}/?tab=${e}`, { waitUntil: 'domcontentloaded' }); }
  catch (_) { await attendre(800); await pg.goto(`http://localhost:${NV.PORT}/?tab=${e}`, { waitUntil: 'domcontentloaded' }); }
  await pg.waitForSelector('.vrm-main', { timeout: 15000 }).catch(() => {});
  await attendre(2200);
};

(async () => {
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const sombre = theme === 'sombre', tag = `${W}-${theme}`;
      const b = { lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 };
      const { ctx, pg } = await NV.ouvrir(nav, { W, sombre, base: b, tab: 'journee' });
      pg.on('dialog', (d) => d.accept().catch(() => {}));
      const envois = [];
      pg.on('request', (q) => { if (/rest\/v1\//.test(q.url()) && q.method() !== 'GET') envois.push(String(q.postData() || '')); });
      await attendre(2000);
      // ── A. Hors présentation, le banc n'est pas vide ─────────────────────
      const vu = { montants: 0, pseudos: 0 };
      for (const e of ['ventes', 'messages', 'achats']) {
        await aller(pg, e);
        const r = await LIRE(pg, INTERDITS);
        vu.montants += r.montants; vu.pseudos += (r.fuites.comptes || []).length + (r.fuites.acheteurs || []).length;
      }
      dit(vu.montants > 0 && vu.pseudos > 0, `A ${tag} : hors présentation, montants et pseudos sont lisibles (le banc n'est pas vide)`, JSON.stringify(vu));
      // ── B. L'interrupteur de Paramètres ──────────────────────────────────
      await aller(pg, 'settings&reglage=presentation');
      let cible = await pg.$('[data-reglage-presentation]');
      if (!cible) { await pg.click('[data-sous-ouvrir="affichage"]', { timeout: 3000 }).catch(() => {}); await attendre(600); cible = await pg.$('[data-reglage-presentation]'); }
      if (cible) { await cible.scrollIntoViewIfNeeded().catch(() => {}); const sw = await cible.$('button[role="switch"], input[role="switch"], [role="switch"]'); await (sw || cible).click().catch(() => {}); }
      await attendre(800);
      const etat = await pg.evaluate(() => ({ racine: document.documentElement.getAttribute('data-presentation'), cle: localStorage.getItem('vrm_presentation'), on: (document.querySelector('[data-reglage-presentation]') || {}).getAttribute && document.querySelector('[data-reglage-presentation]').getAttribute('data-reglage-presentation') }));
      dit(!!cible && etat.racine === '1' && etat.cle === '1', `B ${tag} : Paramètres → « Mode présentation » allume le mode (racine, appareil)`, JSON.stringify(etat));
      if (etat.cle !== '1') await pg.evaluate(() => localStorage.setItem('vrm_presentation', '1'));
      await capture(pg, `${tag}-settings`);
      // ── C. Chaque écran ─────────────────────────────────────────────────
      let comptesN = 0, nums = 0;
      for (const e of ECRANS) {
        await aller(pg, e);
        const r = await LIRE(pg, INTERDITS);
        comptesN += r.comptesN; nums += r.nums;
        const fuites = Object.entries(r.fuites).map(([k, v]) => k + ':' + v.join('|')).join(' ; ');
        dit(r.long > 40 && r.racine === '1' && r.pastille, `C ${tag} ${e} : écran monté, mode allumé, pastille « Présentation » visible`, JSON.stringify({ long: r.long, racine: r.racine, pastille: r.pastille }));
        dit(r.montants === 0, `C ${tag} ${e} : aucun montant lisible`, r.exMontants.join(' / '));
        dit(!fuites, `C ${tag} ${e} : aucun compte, pseudo, adresse, code de retrait, n° de suivi lisible`, fuites);
        dit(r.photosFloues === 0, `C ${tag} ${e} : aucune photo floutée par la présentation`, r.photosFloues);
        await capture(pg, `${tag}-${e}`);
      }
      dit(nums > 0, `C ${tag} : les N° de rangement restent lisibles`, nums);
      dit(comptesN > 0, `C ${tag} : les comptes s'appellent « Compte 1, 2… »`, comptesN);
      // Le menu du compte / la feuille « Plus » (au téléphone) : même règle.
      await aller(pg, 'journee');
      const menu = await pg.$('[data-nav-plus], [data-n-onglet="plus"], [data-onglet-plus], [data-hdr-profil], .vrm-hdr-profil');
      if (menu) { await menu.click().catch(() => {}); await attendre(900); const r = await LIRE(pg, INTERDITS); const f = Object.entries(r.fuites).map(([k, v]) => k + ':' + v.join('|')).join(' ; '); dit(r.montants === 0 && !f, `C ${tag} menu : rien de lisible`, f + ' ' + r.exMontants.join('/')); await capture(pg, `${tag}-menu`); await pg.keyboard.press('Escape').catch(() => {}); }
      dit(!envois.some((x) => /vrm_presentation/.test(x)), `B ${tag} : rien n'est envoyé au nuage (le mode est propre à l'appareil)`);
      // ── D. Éteint d'un toucher sur la pastille ───────────────────────────
      await aller(pg, 'ventes');
      await pg.click('[data-pastille-presentation]').catch(() => {});
      await attendre(900);
      const off = await LIRE(pg, INTERDITS);
      dit(off.racine !== '1' && !off.pastille && off.montants > 0, `D ${tag} : un toucher sur la pastille éteint, les montants reviennent sans recharger`, JSON.stringify({ racine: off.racine, pastille: off.pastille, montants: off.montants }));
      await ctx.close();
    }
  } catch (e) { dit(false, 'banc', e && e.stack); } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nmode-presentation : tout est vert');
  process.exit(ko ? 1 : 0);
})();
