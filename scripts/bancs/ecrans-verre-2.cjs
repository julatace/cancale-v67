// ════════════════════════════════════════════════════════════════════════════
//  BANC « ÉCRANS EN VERRE, 2 » (15 nov., maquettes validées par Julien : « tout est parfait sauf étagères »)
//  Récit : docs/passation/2026-11-15-ecrans-verre-2.md
//
//  Argent (le mois), Argent à venir, Messages (liste, conversation avec une offre), Paramètres (premier
//  écran en tuiles, une catégorie), la fiche d'une paire — sur une base INVENTÉE (1 000 paires, 1 000
//  conversations, 3 comptes : _base-messages-stock.cjs), 390 tactile ET 1512, clair ET sombre.
//  Chaque vue est capturée (SHOTS) et JUGÉE SUR SA RÈGLE (data-* et nombres rendus, jamais un libellé) :
//    A  Argent : le chiffre d'affiche « vendu » ≥ 44 px ; reçu et bénéfice côte à côte (390) ; le bénéfice
//       « au moins » dit sa couverture et le geste des prix à saisir quand il en manque ; l'argent à venir en
//       barre PAR ÉTAPE dont les parts suivent les montants rendus ; l'URSSAF et « J'ai déclaré » ;
//    V  Argent à venir : total une fois, étapes, ventes avec leur N°, le porte-monnaie « pas lu » écrit « — »
//       (jamais 0) quand il n'est pas lu ;
//    M  Messages : groupes PAR COMPTE (compte de l'onglet d'abord), du plus récent au plus ancien DANS chaque
//       groupe (data-*), le N° sur les lignes qui en ont un ; la conversation : la paire en tête, l'offre
//       comparée au prix et au prix mini, UN plein (« Proposer N € ») ;
//    P  Paramètres : le premier écran tient sans défiler (390×844) : recherche, carte Mon compte, les tuiles
//       des catégories ; une catégorie en groupes courts ; les 84 rangées et leurs id inchangés (audit) ;
//    F  la fiche : une ligne par site, prix d'achat et bénéfice, historique, trois gestes ;
//    Z  partout : rien ne déborde, cibles ≥ 44 px au doigt, un plein au plus.
//  Un banc ne meurt pas, il rapporte. `VUES=argent,messages` `LARGEURS=390` `THEMES=clair` ; `SHOTS=<dossier>` ;
//  `DSF=2` pour des captures nettes ; `BANC_DIST=<dist>` pour juger un autre arbre (l'arbre d'avant : ROUGE).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const VUES = {
  'argent-mois': '/?tab=argent', 'argent-avenir': '/?tab=argent', 'messages-liste': '/?tab=messages', 'messages-offre': '/?tab=messages',
  parametres: '/?tab=settings', 'parametres-ventes': '/?tab=settings', 'fiche-paire': '/?tab=journee',
};
const VOULUES = liste('VUES', Object.keys(VUES).join(','));
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const DSF = Number(process.env.DSF || 1);
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-ecrans-verre-2');
const CAPTURE = !!process.env.CAPTURE;   // captures seulement (aucun jugement)
fs.mkdirSync(SHOTS, { recursive: true });

const bilan = { ok: 0, ko: 0 };
const dit = (ok, quoi, detail = '') => { if (ok) bilan.ok++; else bilan.ko++; console.log(`${ok ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

async function preparer(o, vue) {
  const pg = o.pg;
  const toucher = async (sel) => { const l = pg.locator(sel).first(); if (!(await l.count())) return false; try { if (o.tel) await l.tap({ timeout: 4000 }); else await l.click({ timeout: 4000 }); return true; } catch (_) { try { await l.evaluate((e) => e.click()); return true; } catch (__) { return false; } } };
  if (vue === 'argent-avenir') {
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:argent-a-venir')));
    await pg.waitForSelector('[data-argent-a-venir-ecran]', { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(900);
  }
  if (vue === 'messages-offre') {
    // une conversation qui porte une offre (la base en met une toutes les 9 conversations)
    const ok = await toucher('[data-conv-offre="1"], [data-msg-offre]');
    if (!ok) await toucher('[data-conv-id], [data-fil-id]');
    await pg.waitForTimeout(1600);
  }
  if (vue === 'parametres-ventes') {
    const ok = await toucher('[data-parametres-cat="ventes"], [data-param-cat="ventes"]');
    if (!ok) await toucher('[data-cat="ventes"]');
    await pg.waitForTimeout(1200);
  }
  if (vue === 'fiche-paire') {
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '1205' })));
    await pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(1500);
  }
}

module.exports = { VUES, preparer };
if (require.main === module) (async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) for (const vue of VOULUES) {
      const suf = `${vue}-${W}-${th}`;
      let o;
      try {
        o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: B.baseVolume(), url: VUES[vue], api: B.apiVolume, dsf: DSF });
        await P.pret(o.pg);
        await preparer(o, vue);
        await o.pg.waitForTimeout(500);
        await o.pg.screenshot({ path: path.join(SHOTS, suf + '.png') });
        if (CAPTURE) { console.log('capture', suf); continue; }
        if (o.erreurs.length) console.log(`   (erreurs de page : ${o.erreurs.slice(0, 2).join(' | ')})`);
      } catch (err) { dit(false, `${suf} : ouverture`, String(err.message || err).slice(0, 200)); }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${bilan.ok} ✅ · ${bilan.ko} ❌ (captures : ${SHOTS})`);
  process.exit(bilan.ko ? 1 : 0);
})();
