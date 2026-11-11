// ════════════════════════════════════════════════════════════════════════════
//  BANC « LES FRAIS QUE VESTIAIRE PREND » (11 nov. soir ; docs/passation/2026-11-11-ventes-vestiaire.md)
//  Julien : « Sur Vestiaire Collective, je veux voir les frais que la plateforme prend. »
//  Données INVENTÉES (dépôt public), harnais du banc `nouveau-vendeur`. L'extension
//  a rangé (`vc_ventes`) trois ventes terminées :
//    V1 prix 250 € (`sellerPrice`) · versé 212,50 € (`sellerEarning`) ⇒ frais LUS 37,50 € (15 %) ;
//    V2 versé 203,23 €, AUCUN prix (extension d'avant 5.364) ⇒ « frais pas lus » ;
//    V3 prix 120 € · versé 102 € ⇒ 18 € (15 %).
//  Il MESURE (data-* et nombres rendus) :
//   L  Ventes · Vestiaire : la ligne V1 dit « Frais Vestiaire 37,50 € (15 %) », V2 ne dit
//      AUCUN frais (ni 0) ;
//   F  la fiche de V1 : Prix 250,00 € · Frais Vestiaire −37,50 € (15 %) · Pour toi 212,50 € ;
//      la fiche de V2 : « frais pas lus », jamais 0 ;
//   S  Argent → Statistiques → « Frais par site » : Vestiaire 55,50 € (37,50 + 18), frais lus
//      sur 2/3 ventes, 15 % du prix des ventes aux frais lus ;
//   G  aucune erreur JS, rien ne déborde.
//  390 px tactile et 1512 px, clair et sombre. Réglages : `BANC_PORT`, `LARGEURS`, `THEMES`, `SHOTS`.
//  Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || String(9300 + Math.floor(Math.random() * 300));
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || '';

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };

const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const eur = (valeur, cle) => ({ valeur, devise: 'EUR', cle });
const VENTES = {
  '71000001': { productId: '71000001', etat: 'Commande terminée', date: iso(3), titre: 'Sac Speedy toile', photo: '', montant: eur(212.5, 'sellerEarning'), prixVente: eur(250, 'sellerPrice'), compte: '', sources: ['ventes'] },
  '71000002': { productId: '71000002', etat: 'Commande terminée', date: iso(4), titre: 'Mocassins cuir noir', photo: '', montant: eur(203.23, 'sellerEarning'), compte: '', sources: ['ventes'] },
  '71000003': { productId: '71000003', etat: 'Commande terminée', date: iso(5), titre: 'Ceinture cuir', photo: '', montant: eur(102, 'sellerEarning'), prixVente: eur(120, 'sellerPrice'), compte: '', sources: ['ventes'] },
};
const jeu = () => [
  { id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vrm_numerotation: { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z' } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: [] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0.02), payload: { my_orders: [] } } },
  { id: 'vc_session', data: { capturedAt: iso(0.01), compte: '' } },
  { id: 'vc_ventes', data: { capturedAt: iso(0.01), ventes: VENTES, lectures: {} } },
  { id: 'vc_listings', data: { capturedAt: iso(0.01), items: {}, liens: {} } },
];
// Le relevé de Ventes (`vrm_stats_ventes`), forme réelle : la vente Vestiaire au VERSÉ, frais 0
// (règle du bénéfice) ; l'écran Ventes le republie lui-même s'il le recalcule.
const releve = () => ({ v: 1, at: now, l: Object.entries(VENTES).map(([id, v]) => ['Vestiaire', '', 'vestiaire:' + id, Date.parse(v.date), v.montant.valeur, null, 0, '', '', v.date]) });

async function passe(nav, { W, theme }) {
  const sombre = theme === 'sombre', tel = W < 600, T = `[${W}px ${theme}]`, nomS = (x) => `frais-vc-${W}-${theme}-${x}`;
  // ── L et F : Ventes · Vestiaire
  {
    const o = await NV.ouvrir(nav, { W, sombre, base: { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 }, tab: 'ventes&site=vestiaire' });
    const pg = o.pg; await pg.waitForTimeout(1500);
    await pg.locator('[data-selecteur-logos] button[data-site="vestiaire"]').first().click().catch(() => {});
    const lu = await pg.waitForSelector('[data-vc-vente="71000001"]', { timeout: 25000 }).then(() => true).catch(() => false);
    dit(lu, `${T} L · les ventes Vestiaire inventées sont rendues`);
    if (lu) {
      const lignes = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-vc-vente]')].map((l) => [l.getAttribute('data-vc-vente'), (l.querySelector('.vrm-ledger-sale-toggle') || l).innerText.replace(/\s+/g, ' ')])));
      dit(/Frais Vestiaire 37,50\s€ \(15\s%\)/.test(lignes['71000001'] || ''), `${T} L · V1 : « Frais Vestiaire 37,50 € (15 %) » sur la ligne`, lignes['71000001']);
      dit(!/Frais Vestiaire/.test(lignes['71000002'] || 'x') && !/0,00/.test(lignes['71000002'] || ''), `${T} L · V2 (prix pas lu) : aucun frais écrit, ni 0`, lignes['71000002']);
      await pg.locator('[data-vc-vente="71000001"]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(300);
      await capture(pg, nomS('ligne'));
      const fiche = async (id) => {
        await pg.locator(`[data-vc-vente="${id}"] .vrm-ledger-sale-toggle`).first().click().catch(() => {});
        await pg.waitForSelector('.vrm-recap-argent', { timeout: 6000 }).catch(() => {});
        await pg.waitForTimeout(300);
        return pg.evaluate(() => {
          const a = document.querySelector('.vrm-recap-argent'); if (!a) return null;
          const f = a.querySelector('[data-vc-frais-etat]'), p = a.querySelector('[data-vc-prix]'), t = a.querySelector('[data-prix-vente]');
          const r = a.getBoundingClientRect();
          return { etat: f && f.getAttribute('data-vc-frais-etat'), frais: f && f.getAttribute('data-vc-frais'), pct: (f && f.querySelector('[data-vc-frais-pct]') || { getAttribute: () => null }).getAttribute('data-vc-frais-pct'), prix: p && p.getAttribute('data-vc-prix'), pourToi: t && t.getAttribute('data-prix-vente'), texte: a.innerText.replace(/\s+/g, ' '), deborde: r.right > innerWidth + 1 };
        });
      };
      const f1 = await fiche('71000001');
      dit(f1 && f1.etat === 'lu' && f1.frais === '3750' && f1.pct === '15' && f1.prix === '25000' && f1.pourToi === '21250', `${T} F · fiche V1 : Prix 250 · Frais 37,50 (15 %) · Pour toi 212,50`, JSON.stringify(f1));
      dit(f1 && /Prix 250,00\s€/.test(f1.texte) && /Frais Vestiaire −37,50\s€ \(15\s%\)/.test(f1.texte) && /Pour toi 212,50\s€/.test(f1.texte) && !f1.deborde, `${T} F · les mots de la fiche, sans débord`, f1 && f1.texte);
      await capture(pg, nomS('fiche-lue'));
      // La fiche suivante sur une page neuve (la feuille garde son contenu pendant sa sortie).
      await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(1500);
      await pg.locator('[data-selecteur-logos] button[data-site="vestiaire"]').first().click().catch(() => {});
      await pg.waitForSelector('[data-vc-vente="71000002"]', { timeout: 20000 }).catch(() => {});
      const f2 = await fiche('71000002');
      dit(f2 && f2.etat === 'passu' && f2.frais === '' && /frais pas lus/.test(f2.texte) && !/Frais Vestiaire −?0,00/.test(f2.texte) && f2.pourToi === '20323', `${T} F · fiche V2 : « frais pas lus », jamais 0 ; Pour toi 203,23`, JSON.stringify(f2));
      await capture(pg, nomS('fiche-paslue'));
    }
    const deb = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    dit(!deb, `${T} G · Ventes : rien ne déborde`);
    dit(!o.journal.erreurs.length, `${T} G · Ventes : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
  // ── S : Statistiques → Frais par site
  {
    const o = await NV.ouvrir(nav, { W, sombre, base: { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 }, tab: 'dashboard' });
    const pg = o.pg;
    await pg.evaluate((r) => { try { localStorage.setItem('vrm_stats_ventes', JSON.stringify(r)); localStorage.setItem('vinted_stats_periode', JSON.stringify('mois')); } catch (_) {} }, releve());
    await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500);
    // La période qui contient les trois ventes (il y a 3 à 5 jours) : on prend « 30 jours » si proposé.
    const site = await pg.waitForSelector('[data-frais-site="Vestiaire"]', { timeout: 20000 }).then(() => true).catch(() => false);
    if (!site) for (const p of ['30j', '30 jours', 'Année', 'Tout']) { const b = pg.locator(`button:has-text("${p}")`).first(); if (await b.count()) { await b.click().catch(() => {}); await pg.waitForTimeout(800); if (await pg.$('[data-frais-site="Vestiaire"]')) break; } }
    const s = await pg.evaluate(() => { const e = document.querySelector('[data-frais-site="Vestiaire"]'); return e ? { eur: e.getAttribute('data-frais-eur'), pct: e.getAttribute('data-frais-pct'), lus: e.getAttribute('data-frais-lus'), texte: e.innerText.replace(/\s+/g, ' ') } : null; });
    const ok3 = s && s.lus === '2/3', ok2 = s && s.lus === '2/2';   // V2 n'est pas datée hors période ; selon la période : 2/3
    dit(s && s.eur === '5550' && s.pct === '15' && (ok3 || ok2) && /frais lus sur 2\/\d ventes/.test(s.texte), `${T} S · Frais par site · Vestiaire 55,50 €, 15 %, « frais lus sur 2/3 »`, JSON.stringify(s));
    if (s) await pg.locator('[data-frais-site="Vestiaire"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, nomS('stats'));
    dit(!o.journal.erreurs.length, `${T} G · Statistiques : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
}

(async () => {
  await new Promise((okk) => NV.srv.listen(NV.PORT, okk));
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  for (const W of LARGEURS) for (const theme of THEMES) {
    try { await passe(nav, { W, theme }); } catch (e) { dit(false, `[${W}px ${theme}] le banc a planté`, e && e.message); }
  }
  await nav.close(); try { NV.srv.close(); } catch (_) {}
  console.log(`frais-vestiaire : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
