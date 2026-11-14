// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA VENTE VESTIAIRE CAPTÉE SUR ORION, JUSTE À L'ÉCRAN » (13 nov., ext. 5.374)
//  docs/passation/2026-11-13-vestiaire-vente-orion.md
//  Julien : « l'extension a mal capté la vente de Vestiaire Collective sur Orion sur
//  mon iPhone, je veux que ça soit mieux ».
//  De bout en bout : le VRAI capteur (vc-inject.js), le VRAI relais (vc.js) et le VRAI
//  fond (background.js) jouent la page « Mes ventes » d'Orion sur iPhone (capteur posé
//  APRÈS la page, `Date.parse` de WebKit — scripts/_vc-vente-orion.cjs, valeurs
//  INVENTÉES). Les lignes que la base reçoit (`vc_ventes`, `vc_session`) sont servies
//  à l'app, et l'écran Ventes · Vestiaire est MESURÉ (data-* et nombres rendus) :
//   V  la vente est là (`data-vc-vente`), datée du jour de la VENTE (13 nov.), « à envoyer » ;
//   F  sa fiche : Vendue 13 nov. · Prix 209,52 € · Frais Vestiaire −6,29 € (3 %) · Pour toi 203,23 € ;
//   G  aucune erreur JS, rien ne déborde.
//  390 px tactile et 1512 px, clair et sombre. Réglages : `BANC_PORT`, `LARGEURS`, `THEMES`, `SHOTS`.
//  Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || String(25000 + Math.floor(Math.random() * 500));
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const H = require('../_vc-vente-orion.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || '';

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();

let LIGNES_EXT = null;
const jeu = () => [
  { id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vrm_numerotation: { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z' } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: [] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0.02), payload: { my_orders: [] } } },
  { id: 'vc_listings', data: { capturedAt: iso(0.01), items: {}, liens: {} } },
  ...(LIGNES_EXT.vc_ventes ? [{ id: 'vc_ventes', data: LIGNES_EXT.vc_ventes }] : []),
  ...(LIGNES_EXT.vc_session ? [{ id: 'vc_session', data: LIGNES_EXT.vc_session }] : []),
];

async function passe(nav, { W, theme }) {
  const sombre = theme === 'sombre', T = `[${W}px ${theme}]`, nomS = (x) => `vc-orion-${W}-${theme}-${x}`;
  const o = await NV.ouvrir(nav, { W, sombre, base: { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 }, tab: 'ventes&site=vestiaire' });
  const pg = o.pg; await pg.waitForTimeout(1500);
  await pg.locator('[data-selecteur-logos] button[data-site="vestiaire"]').first().click().catch(() => {});
  const lu = await pg.waitForSelector(`[data-vc-vente="${H.ART}"]`, { timeout: 25000 }).then(() => true).catch(() => false);
  dit(lu, `${T} V · la vente Vestiaire captée sur Orion est à l'écran`, await pg.evaluate(() => (document.querySelector('[data-vc-ventes]') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 300)));
  if (lu) {
    const ligne = await pg.evaluate((id) => { const l = document.querySelector(`[data-vc-vente="${id}"]`); return l ? (l.querySelector('.vrm-ledger-sale-toggle') || l).innerText.replace(/\s+/g, ' ') : ''; }, H.ART);
    dit(/\b13 nov\./.test(ligne) && !/\b14 nov\./.test(ligne), `${T} V · la ligne est datée du jour de la VENTE (13 nov., 00:41 à Paris)`, ligne);
    dit(/Frais Vestiaire 6,29\s€/.test(ligne), `${T} V · les frais lus sur la ligne (209,52 − 203,23)`, ligne);
    await pg.locator(`[data-vc-vente="${H.ART}"]`).first().scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(300);
    await capture(pg, nomS('ligne'));
    await pg.locator(`[data-vc-vente="${H.ART}"] .vrm-ledger-sale-toggle`).first().click().catch(() => {});
    await pg.waitForSelector('.vrm-recap-argent', { timeout: 6000 }).catch(() => {});
    await pg.waitForTimeout(300);
    const f = await pg.evaluate(() => {
      const a = document.querySelector('.vrm-recap-argent'); if (!a) return null;
      const fr = a.querySelector('[data-vc-frais-etat]'), p = a.querySelector('[data-vc-prix]'), t = a.querySelector('[data-prix-vente]');
      const recap = a.closest('[role="dialog"]') || document.body;
      const vendue = [...recap.querySelectorAll('.vrm-recap-ligne')].find((x) => /^Vendue/.test((x.querySelector('dt') || {}).innerText || ''));
      const r = a.getBoundingClientRect();
      return { etat: fr && fr.getAttribute('data-vc-frais-etat'), frais: fr && fr.getAttribute('data-vc-frais'), prix: p && p.getAttribute('data-vc-prix'), pourToi: t && t.getAttribute('data-prix-vente'),
        vendue: vendue ? vendue.querySelector('dd').innerText : null, texte: a.innerText.replace(/\s+/g, ' '), deborde: r.right > innerWidth + 1 };
    });
    dit(f && f.etat === 'lu' && f.frais === '629' && f.prix === '20952' && f.pourToi === '20323', `${T} F · fiche : Prix 209,52 · Frais 6,29 · Pour toi 203,23 (ce que Vestiaire verse)`, JSON.stringify(f));
    dit(f && f.vendue === '13 nov.', `${T} F · fiche : « Vendue 13 nov. » (pas le jour de la lecture)`, JSON.stringify(f && f.vendue));
    dit(f && !f.deborde, `${T} G · la fiche ne déborde pas`);
    await capture(pg, nomS('fiche'));
  }
  const deb = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  dit(!deb, `${T} G · Ventes : rien ne déborde`);
  dit(!o.journal.erreurs.length, `${T} G · Ventes : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  // La base reçoit ce que le VRAI code de l'extension range (la page d'Orion jouée de bout en bout).
  const r = await H.scenarioOrion(H.fichiers());
  LIGNES_EXT = { vc_ventes: r.vc_ventes || null, vc_session: r.vc_session || null };
  dit(!!(r.vc_ventes && r.vc_ventes.ventes && r.vc_ventes.ventes[H.ART]), 'E · l’extension (vrai code) a rangé la vente captée sur Orion', JSON.stringify(r.vc_ventes || null).slice(0, 300));
  await new Promise((okk) => NV.srv.listen(NV.PORT, okk));
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  for (const W of LARGEURS) for (const theme of THEMES) {
    try { await passe(nav, { W, theme }); } catch (e) { dit(false, `[${W}px ${theme}] le banc a planté`, e && e.message); }
  }
  await nav.close(); try { NV.srv.close(); } catch (_) {}
  console.log(`vestiaire-vente-orion : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
