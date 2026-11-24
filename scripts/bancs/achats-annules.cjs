// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES ACHATS ANNULÉS CACHÉS PAR DÉFAUT, « Annulés · N » POUR LES VOIR (17 nov., chasse-bugs)
//        node scripts/bancs/achats-annules.cjs — après `npm run build`
// ═══════════════════════════════════════════════════════════════════════════
// Julien (capture d'Achats) : « Je veux pas voir les achats annulés sauf si je les sélectionne ». Données INVENTÉES :
// le jeu de `nouveau-vendeur` + un achat « Commande annulée » (titre unique). 390 tactile et 1512. Exige :
//   A1 sous « Tous » (la liste par défaut des achats), l'achat annulé n'est PAS montré ; les autres le sont ;
//   A2 le filtre « Annulés » existe et porte son nombre (data-n = 1) : rien n'est caché en silence ;
//   A3 « Annulés » choisi : l'achat annulé seul ;
//   A4 les nombres de l'écran (onglets En route / Arrivés, chiffres d'Achats) sont les mêmes sous « Tous » et « Annulés »
//      — le filtre ne change que l'affichage ;
//   A5 aucune erreur de page.
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '10793';
const path = require('path');
const NV = require('./nouveau-vendeur.cjs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { lancer } = require('./_navigateur.cjs');
const SHOTS = process.env.SHOTS || '';
const TITRE_ANNULE = 'Vans Sk8 annulée banc taille 40';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d != null ? ' — ' + String(d).slice(0, 400) : '')); };
const base = () => {
  const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const l = lignes.find((x) => x.id === 'harvest_111_orders_purchased');
  l.data.payload.my_orders.push({ transaction_id: 73999, conversation_id: 84999, title: TITRE_ANNULE, price: { amount: '33', currency_code: 'EUR' }, status: 'Commande annulée', transaction_user_status: 'completed', date: new Date(Date.now() - 2 * 864e5).toISOString(), photo: null });
  return { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
};
const mesure = (pg) => pg.evaluate((T) => {
  const m = document.querySelector('.vrm-main'); const t = m ? m.innerText : '';
  const ong = Object.fromEntries([...document.querySelectorAll('[data-achats-onglet]')].map((b) => [b.getAttribute('data-achats-onglet'), b.getAttribute('data-n')]));
  const chiffres = [...document.querySelectorAll('.vrm-main [data-montant]')].map((x) => x.getAttribute('data-montant') + ':' + (x.innerText || '').trim()).join('|');
  // Les LIGNES de la liste des achats (`data-achat-tx`) — pas les autres blocs de l'écran (À retirer, retours…).
  const vis = (e) => e.getClientRects().length > 0;
  const tx = [...document.querySelectorAll('[data-achat-tx]')].filter(vis).map((e) => e.getAttribute('data-achat-tx'));
  return { annuleVu: tx.includes('73999') && t.includes(T), autresVus: tx.some((x) => x !== '73999'), tx, ong, chiffres };
}, TITRE_ANNULE);
const toucher = async (pg, sel, tel) => { const l = pg.locator(sel).filter({ visible: true }).first(); if (!(await l.count())) return false; if (tel) await l.tap(); else await l.click(); await pg.waitForTimeout(1500); return true; };

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await lancer(PW, { executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of [390, 1512]) {
      const o = await NV.ouvrir(nav, { W, sombre: false, base: base(), tab: 'achats' });
      const { pg, journal, tel } = o;
      await pg.waitForSelector('[data-achats-onglet]', { timeout: 30000 }).catch(() => {});
      await pg.waitForTimeout(2500);
      await toucher(pg, '[data-achats-onglet="all"]', tel);
      const a = await mesure(pg);
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `achats-annules-${W}-tous.png`) });
      dit(!a.annuleVu && a.autresVus, `[${W}] A1 sous « Tous », l’achat annulé n’est pas montré (les autres oui)`, JSON.stringify(a));
      // (24 nov., main-vert) À l'ordinateur, Achats est le TABLEAU DE TRAVAIL (src/natif/ecrans/AchatsTableau.jsx) : « Annulés » est
      // un statut du filtre « Statut » ([data-tt-ouvre="statut"], case [data-tt-statut="annule"] et son nombre [data-tt-n]).
      let la;
      if (!tel && !Object.keys(a.ong).length) {
        await toucher(pg, '[data-tt-ouvre="statut"]', tel);
        const nAnnul = await pg.evaluate(() => { const c = document.querySelector('[data-tt-statut="annule"] [data-tt-n]'); return c ? c.getAttribute('data-tt-n') : null; });
        dit(nAnnul === '1', `[${W}] A2 « Annulés » porte son nombre (1)`, JSON.stringify({ statut: nAnnul }));
        la = await toucher(pg, '[data-tt-statut="annule"] input', tel);
        await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(600);
      } else {
        dit(a.ong.annules === '1', `[${W}] A2 « Annulés » porte son nombre (1)`, JSON.stringify(a.ong));
        la = await toucher(pg, '[data-achats-onglet="annules"]', tel);
      }
      const b = await mesure(pg);
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `achats-annules-${W}-annules.png`) });
      dit(la && b.annuleVu && !b.autresVus, `[${W}] A3 « Annulés » choisi : l’achat annulé seul`, JSON.stringify(b));
      dit(a.ong.route === b.ong.route && a.ong.recus === b.ong.recus && a.chiffres === b.chiffres, `[${W}] A4 les nombres de l’écran ne bougent pas (affichage seulement)`, JSON.stringify({ a: [a.ong, a.chiffres], b: [b.ong, b.chiffres] }));
      dit(!journal.erreurs.filter((x) => !/access control checks|lgonxzrzjcqthjtbdpzo\.supabase\.co/.test(x)).length, `[${W}] A5 aucune erreur de page`, journal.erreurs.filter((x) => !/access control checks|lgonxzrzjcqthjtbdpzo\.supabase\.co/.test(x)).join(' | '));
      await o.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.stack || e).slice(0, 400)); }
  finally { await nav.close().catch(() => {}); NV.srv.close(); }
  console.log(`\n${ko ? 'KO' : 'OK'} achats-annules : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
