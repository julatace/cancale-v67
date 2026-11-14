#!/usr/bin/env node
// ══ BANC DATES DE VERSEMENT (11 nov., lot DJ7) ══════════════════════════════
// Données INVENTÉES. Le jeu de `nouveau-vendeur.cjs` + 50 ventes Vinted finalisées
// IDENTIQUES (même prix, même jour de vente) sur `vendeuse_b`, le mois dernier :
//   · la n° 93000 a sa transaction « Commande finalisée » (450) rangée ;
//   · la n° 93007 est datée par le relevé du porte-monnaie : la SEULE des 50
//     lignes du relevé (toutes au même montant, le même jour) qui porte son n° ;
//   · la n° 93010 a sa transaction rangée, pas encore finalisée (400) ;
//   · (14 nov., lot dates-versement) la n° 93020 est datée par SA conversation (ligne légère
//     `harvest_222_versement_93020`, extension 5.376) ; la n° 93030 par l'e-mail « Transaction
//     finalisée » qui porte son n° ; 49 autres e-mails au même montant, SANS n°, et une ligne de
//     conversation sans n° : ne datent rien (jamais par ressemblance) ;
//   · les 45 autres n'ont jamais eu leur détail relu.
// Juge, 390 tactile et 1512, clair et sombre :
//   D1 Ventes PUBLIE `aDater.datees` (4 datées, 1 par le relevé) et `aDater.raisons`
//      (47 « détail pas relu » sur vendeuse_b, 1 « pas finalisée ») ;
//   D2 « Déclarer » : « 4 datées ✓ dont 1 par ton porte-monnaie · 48 ventes sans
//      date », une ligne par raison, « Ouvrir Vinted » sur vendeuse_b (44 px) ;
//   D3 aucune des 47 n'est datée par ressemblance (le CA du mois = les 4 datées) ;
//   T  aucune erreur de page, aucun « undefined / NaN / null ».
// `SHOTS=<dossier>` : captures (à regarder). `BANC_PORT` (défaut 10671).
'use strict';
require('./_porte-banc.cjs');
process.env.BANC_PORT = process.env.BANC_PORT || '10671';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || '';
const LARGEURS = String(process.env.LARGEURS || '390,1512').split(',').map(Number);
const THEMES = String(process.env.THEMES || 'clair,sombre').split(',');
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };

const now = new Date();
// Le mois dernier (la déclaration mensuelle de ce mois-là est ouverte).
const M0 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const jour = (j, h = 12) => new Date(M0.getFullYear(), M0.getMonth(), j, h).toISOString();
const YM = `${M0.getFullYear()}-${String(M0.getMonth() + 1).padStart(2, '0')}`;
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();
const finalisee = (tx) => ({ transaction_id: tx, title: `Paire inventée ${tx}`, price: { amount: '45.0', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: jour(3, 10) });
const txn = (uid, tx, status, su) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: iso(0.01), payload: { transaction: { id: tx, item_id: tx + 500000, status, status_title: status === 450 ? 'Commande finalisée' : 'En cours', status_updated_at: su } } } });
const jeu = () => {
  const L = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const v2 = L.find((r) => r.id === 'harvest_222_orders_sold');
  for (let i = 0; i < 50; i++) v2.data.payload.my_orders.push(finalisee(93000 + i));
  // Les deux ventes du jeu de base ont leur versement : seules NOS 50 sont en jeu.
  L.push(txn(222, 62005, 450, jour(10)), txn(111, 62002, 450, jour(11)));
  L.push(txn(222, 93000, 450, jour(12)), txn(222, 93010, 400, jour(5)));
  // Le relevé : 50 crédits de 45 € le même jour ; UN seul porte le n° d'une vente.
  const lignes = Array.from({ length: 50 }, (_, i) => ({ id: String(800 + i), date: jour(14, 9), montant: 45, devise: 'EUR', type: 'credit', quoi: 'transaction', ref: String(700000 + i) }));
  lignes[7] = { ...lignes[7], tx: '93007', ref: '93007' };
  L.push({ id: `harvest_222_releve_${YM}`, data: { type: 'releve', uid: '222', mois: YM, capturedAt: iso(0.01), nLignes: 50, nTx: 1, lignes } });
  // (14 nov.) La conversation (ligne légère, forme de `rangerVersementConversation`) et l'e-mail.
  L.push({ id: 'harvest_222_versement_93020', data: { type: 'versement', uid: '222', domain: 'www.vinted.fr', capturedAt: iso(0.01), tx: '93020', at: jour(15, 9), source: 'conversation', cid: '5501' } });
  L.push({ id: 'harvest_222_versement_x', data: { type: 'versement', uid: '222', capturedAt: iso(0.01), at: jour(15, 9), source: 'conversation' } });
  L.push({ id: 'email_final_tx93030', data: { type: 'finalisation', subject: 'Transaction finalisée', article: 'Paire inventée', montant: '45,00', numero: '', transaction: '93030', account: 'vendeuse_b', uid: '222', receivedAt: jour(16, 9) } });
  for (let i = 0; i < 49; i++) L.push({ id: `email_final_h${i}`, data: { type: 'finalisation', subject: 'Transaction finalisée', article: 'Paire inventée', montant: '45,00', numero: '', account: 'vendeuse_b', uid: '222', receivedAt: jour(16, 9) } });
  const main = L.find((r) => r.id === 'main');
  main.data.vinted_regime = 'micro'; main.data.vinted_urssaf_freq = 'mensuel'; main.data.vrm_urssaf_declare = {};
  return { lignes: L, comptes: NV.JEU_COMPTES, ecritures: 0 };
};
const aller = async (pg, tab, attente = 3000) => {
  await pg.goto(`http://localhost:${NV.PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(attente);
};
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: true }).catch(() => {}); };

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      const T = `${W} ${th}`;
      const o = await NV.ouvrir(nav, { W, sombre: th === 'sombre', base: jeu(), tab: 'dashboard' });
      const pg = o.pg;
      try {
        await aller(pg, 'cat_ventes', 5000);
        // (14 nov.) Attendre sur CONDITION (§6.5), pas un délai fixe : machine chargée, la publication peut tarder.
        await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vinted_urssaf_mois') || 'null'); return !!(p && p.aDater && p.aDater.datees); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
        const pub = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_urssaf_mois') || 'null'); } catch (_) { return null; } });
        const ad = pub && pub.aDater;
        dit(!!(ad && ad.n === 46), `D1 ${T} : 46 ventes à dater (50 − la 450 − le relevé − la conversation − l’e-mail)`, JSON.stringify(ad && ad.n));
        dit(!!(ad && ad.datees && ad.datees.n === 6 && ad.datees.releve === 1 && ad.datees.conversation === 1 && ad.datees.email === 1), `D1 ${T} : 6 datées, dont 1 par le relevé, 1 par la conversation, 1 par e-mail (par SON n°)`, JSON.stringify(ad && ad.datees));
        const par = Object.fromEntries(((ad && ad.raisons) || []).map((r) => [r.cle, r]));
        const det = par['vinted-detail'];
        dit(!!(det && det.n === 45 && det.comptes.length === 1 && det.comptes[0].uid === '222' && det.comptes[0].nom === 'vendeuse_b'), `D1 ${T} : 45 « détail pas relu », sur vendeuse_b`, JSON.stringify(det));
        dit(!!(par['vinted-attente'] && par['vinted-attente'].n === 1), `D1 ${T} : 1 relue, pas encore finalisée`, JSON.stringify(par['vinted-attente']));
        const moisPub = pub && Array.isArray(pub.mois) ? pub.mois.find((m) => m.ym === YM) : null;
        dit(!!(moisPub && moisPub.n === 6 && Math.round(moisPub.ca * 100) === 4500 * 4 + (68 + 80) * 100), `D3 ${T} : le CA de ${YM} = les 6 ventes datées, aucune datée par ressemblance (49 e-mails au même montant sans n°)`, JSON.stringify(moisPub && { n: moisPub.n, ca: moisPub.ca }));

        await aller(pg, 'compta', 3500);
        await pg.locator('[data-argent-q="declarer"]').click().catch(() => {});
        await pg.waitForTimeout(1200);
        const K = await pg.evaluate(() => {
          const c = document.querySelector('[data-adater-raisons]');
          if (!c) return null;
          const v = c.querySelector('[data-adater-geste="vinted"]'); const r = v ? v.getBoundingClientRect() : null;
          return {
            datees: (c.querySelector('[data-adater-datees]') || { getAttribute: () => null }).getAttribute('data-adater-datees'),
            releve: (c.querySelector('[data-adater-releve]') || { getAttribute: () => null }).getAttribute('data-adater-releve'),
            conv: (c.querySelector('[data-adater-conversation]') || { getAttribute: () => null }).getAttribute('data-adater-conversation'),
            mail: (c.querySelector('[data-adater-email]') || { getAttribute: () => null }).getAttribute('data-adater-email'),
            jours: (c.querySelector('[data-adater-jours]') || { getAttribute: () => null }).getAttribute('data-adater-jours'),
            sans: (c.querySelector('[data-adater-sans]') || { getAttribute: () => null }).getAttribute('data-adater-sans'),
            raisons: [...c.querySelectorAll('[data-adater-raison]')].map((e) => `${e.getAttribute('data-adater-raison')}:${e.getAttribute('data-adater-compte') || ''}:${e.getAttribute('data-n')}`),
            texte: c.innerText, href: v ? v.getAttribute('href') : null, h: r ? r.height : 0, vis: !!(r && r.width > 0),
          };
        });
        dit(!!K, `D2 ${T} : « Déclarer » montre la carte des ventes sans date`);
        if (K) {
          dit(K.datees === '6' && K.releve === '1' && K.conv === '1' && K.mail === '1' && K.sans === '46', `D2 ${T} : « 6 datées ✓ dont 1 par ton porte-monnaie · 1 par la conversation · 1 par l’e-mail · 46 ventes sans date »`, JSON.stringify(K));
          dit(K.raisons.join(',') === 'vinted-detail:222:45,vinted-attente::1', `D2 ${T} : une ligne par raison, le compte nommé`, K.raisons.join(','));
          dit(/vendeuse_b/.test(K.texte) && /46 ventes sans date/.test(K.texte) && /par la conversation de la vente/.test(K.texte), `D2 ${T} : le compte, le nombre et la source sont écrits`, K.texte.slice(0, 260));
          dit(K.jours === '1' && /Environ 1 jour avec vinted\.fr ouvert sur ce compte/.test(K.texte), `D2 ${T} : « environ 1 jour avec vinted.fr ouvert sur ce compte »`, `${K.jours} ${K.texte.slice(0, 260)}`);
          // (14 nov.) La règle de la passe design : 44 px au doigt (390, tactile), 36 px à la souris.
          dit(K.vis && K.href === 'https://www.vinted.fr/' && K.h >= (W < 600 ? 43.5 : 35.5), `D2 ${T} : « Ouvrir Vinted » visible, ${W < 600 ? 44 : 36} px`, `${K.href} ${K.h}`);
          dit(!/\bundefined\b|\bNaN\b|\bnull\b|encaiss/i.test(K.texte), `T ${T} : ni « undefined/NaN/null », ni « encaissé »`, K.texte);
        }
        await capture(pg, `declarer-${W}-${th}`);
        const el = await pg.$('[data-adater-raisons]');
        if (el && SHOTS) await el.screenshot({ path: path.join(SHOTS, `carte-${W}-${th}.png`) }).catch(() => {});
        dit(!o.journal.erreurs.length, `T ${T} : aucune erreur de page`, o.journal.erreurs.slice(0, 3).join(' | '));
      } catch (e) { dit(false, `${T} : le banc a tourné`, e && e.message); }
      await o.ctx.close().catch(() => {});
    }
  } finally {
    await nav.close(); NV.srv.close();
  }
  console.log(ko ? `❌ banc dates-versement : ${ko} rouge(s), ${ok} vert(s)` : `✅ banc dates-versement : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
