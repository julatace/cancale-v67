#!/usr/bin/env node
// ══ BANC « DATES DE VERSEMENT : L'EXTENSION LES RÉCUPÈRE » (15 nov., extension 5.390) ══════
// Julien : « Enlève les 1741 ventes à dater, cela n'a aucun sens. Le but est que l'extension
// récupère ces infos, pas que ça soit à nous de le faire. »
// Données INVENTÉES : le jeu de `nouveau-vendeur.cjs` + 50 ventes Vinted finalisées le mois
// dernier sur `vendeuse_b` (la forme de `dates-versement.cjs`) — 11 datées (450, relevé
// vérifié, conversation, e-mail), 39 dont le détail n'a jamais été lu, 1 encore à 400 ;
// variante `toutDate` : les 50 ont leur 450.
// Juge, 390 tactile et 1512, clair et sombre :
//   L1 Argent → Déclarer : UNE ligne discrète « Dates de versement : l'extension les récupère
//      (≈ 41 restantes · environ 3 h avec vinted.fr ouvert) » — sans bouton ni lien ;
//   L2 plus aucun « à dater », « Les dater », « Dater à la main », « Ouvrir Vinted » pour dater,
//      nulle part dans l'écran Argent (cases du haut comprises) ; le montant dit « au moins » ;
//   L3 Ma journée : aucun « à dater », aucun contrôle « ventes sans versement » ;
//   L4 tout daté : la ligne n'existe pas ;
//   L5 sans extension : la ligne sans délai promis (« environ X h » seulement à une 5.390) ;
//   T  aucune erreur de page, aucun « undefined / NaN / null ».
// `SHOTS=<dossier>` : captures (à regarder). `BANC_PORT` (défaut 10673).
'use strict';
require('./_porte-banc.cjs');
process.env.BANC_PORT = process.env.BANC_PORT || '10673';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || '';
const LARGEURS = String(process.env.LARGEURS || '390,1512').split(',').map(Number);
const THEMES = String(process.env.THEMES || 'clair,sombre').split(',');
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };

const now = new Date();
const M0 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const jour = (j, h = 12) => new Date(M0.getFullYear(), M0.getMonth(), j, h).toISOString();
const YM = `${M0.getFullYear()}-${String(M0.getMonth() + 1).padStart(2, '0')}`;
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();
const finalisee = (tx) => ({ transaction_id: tx, title: `Paire inventée ${tx}`, price: { amount: '45.0', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: jour(3, 10) });
const txn = (uid, tx, status, su) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: iso(0.01), payload: { transaction: { id: tx, item_id: tx + 500000, status, status_title: status === 450 ? 'Commande finalisée' : 'En cours', status_updated_at: su } } } });
const jeu = ({ toutDate = false } = {}) => {
  const L = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const v2 = L.find((r) => r.id === 'harvest_222_orders_sold');
  for (let i = 0; i < 50; i++) v2.data.payload.my_orders.push(finalisee(93000 + i));
  L.push(txn(222, 62005, 450, jour(10)), txn(111, 62002, 450, jour(11)));
  if (toutDate) { for (let i = 0; i < 50; i++) L.push(txn(222, 93000 + i, 450, jour(12 + (i % 10)))); }
  else {
    L.push(txn(222, 93000, 450, jour(12)), txn(222, 93010, 400, jour(5)));
    const lignes = Array.from({ length: 50 }, (_, i) => ({ id: String(800 + i), date: jour(14, 9), montant: 45, devise: 'EUR', type: 'credit', quoi: 'transaction', ref: String(700000 + i) }));
    lignes[7] = { ...lignes[7], tx: '93007', ref: '93007' };
    for (let i = 0; i < 5; i++) { L.push(txn(222, 93040 + i, 450, jour(14, 12))); lignes[40 + i] = { ...lignes[40 + i], tx: String(93040 + i), ref: String(93040 + i) }; }
    L.push({ id: `harvest_222_releve_${YM}`, data: { type: 'releve', uid: '222', mois: YM, capturedAt: iso(0.01), nLignes: 50, nTx: 6, lignes } });
    L.push({ id: 'harvest_222_versement_93020', data: { type: 'versement', uid: '222', domain: 'www.vinted.fr', capturedAt: iso(0.01), tx: '93020', at: jour(15, 9), source: 'conversation', cid: '5501' } });
    L.push({ id: 'email_final_tx93030', data: { type: 'finalisation', subject: 'Transaction finalisée', article: 'Paire inventée', montant: '45,00', numero: '', transaction: '93030', account: 'vendeuse_b', uid: '222', receivedAt: jour(16, 9) } });
  }
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
const INTERDIT = /à dater|À dater|Les dater|La dater|Dater à la main|Ventes à dater/;
// Une extension 5.390 présente : le pont annonce sa version (`__vmr: 'ready'`), répété le temps
// que l'app charge (la promesse « environ X h » ne se fait qu'à elle, `extSait('versementsauto')`).
const avecExtension = (pg, version) => pg.addInitScript((v) => {
  let n = 0; const t = setInterval(() => { try { window.postMessage({ __vmr: 'ready', version: v }, '*'); } catch (_) {} if (++n > 60) clearInterval(t); }, 200);
}, version);
const publie = async (pg) => {
  await aller(pg, 'cat_ventes', 5000);
  await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vinted_urssaf_mois') || 'null'); return !!(p && p.aDater && p.aDater.datees); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
  return pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_urssaf_mois') || 'null'); } catch (_) { return null; } });
};
const lireArgent = async (pg) => {
  await aller(pg, 'compta', 3500);
  const haut = await pg.evaluate(() => (document.querySelector('.vrm-main') || document.body).innerText);
  await pg.locator('[data-argent-q="declarer"]').click().catch(() => {});
  await pg.waitForTimeout(1500);
  return pg.evaluate((hautTexte) => {
    // La ligne de « Déclarer » (la même ligne vit aussi, repliée, dans « Vendu et reçu » et la carte du mois).
    const l = document.querySelector('.vrm-urssaf-manque [data-dates-versement-ligne]');
    const toutes = document.querySelectorAll('[data-dates-versement-ligne]').length;
    const m = document.querySelector('.vrm-urssaf-manque');
    const r = l ? l.getBoundingClientRect() : null;
    return {
      haut: hautTexte, page: (document.querySelector('.vrm-main') || document.body).innerText,
      ligne: l ? { n: l.getAttribute('data-dates-versement-ligne'), h: l.getAttribute('data-dates-versement-heures'), t: l.innerText, gestes: l.querySelectorAll('button,a,[role="button"]').length, vis: !!(r && r.width > 0 && r.height > 0) } : null,
      manqueGestes: m ? m.querySelectorAll('button,a,[role="button"]').length : null, manque: m ? m.innerText : null,
      toutes, anciennes: document.querySelectorAll('[data-adater-raisons],[data-adater-geste],[data-urssaf-dater],[data-dater-lbc]').length,
      ca: (document.querySelector('[data-urssaf-ligne="ca"] .vrm-urssaf-val') || { innerText: '' }).innerText,
    };
  }, haut);
};

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      const T = `${W} ${th}`;
      const o = await NV.ouvrir(nav, { W, sombre: th === 'sombre', base: jeu(), tab: 'dashboard' });
      const pg = o.pg;
      await avecExtension(pg, '5.396.0');
      try {
        const pub = await publie(pg);
        const ad = pub && pub.aDater;
        dit(!!(ad && ad.n === 41), `L0 ${T} : 41 ventes sans date publiées (la règle §5 ne bouge pas)`, JSON.stringify(ad && ad.n));
        const K = await lireArgent(pg);
        dit(!!K.ligne && K.ligne.vis && K.ligne.n === '41' && K.ligne.h === '3', `L1 ${T} : la ligne discrète (41 restantes, environ 3 h)`, JSON.stringify(K.ligne));
        dit(!!K.ligne && /Dates de versement : l’extension les récupère/.test(K.ligne.t) && /41 restantes/.test(K.ligne.t) && /environ 3 h avec vinted\.fr ouvert/.test(K.ligne.t), `L1 ${T} : « Dates de versement : l’extension les récupère (≈ 41 restantes · environ 3 h avec vinted.fr ouvert) »`, K.ligne && K.ligne.t);
        dit(!!K.ligne && K.ligne.gestes === 0 && K.manqueGestes === 0, `L1 ${T} : aucun bouton ni lien (rien ne lui est demandé)`, `${K.ligne && K.ligne.gestes} / ${K.manqueGestes} · ${K.manque}`);
        dit(!INTERDIT.test(K.page) && !INTERDIT.test(K.haut) && K.anciennes === 0, `L2 ${T} : plus aucun « à dater » ni geste de datation dans l’écran Argent`, (INTERDIT.exec(K.page + ' ' + K.haut) || [''])[0] + ` · anciens éléments ${K.anciennes}`);
        dit(/au moins/i.test(K.ca), `L2 ${T} : le montant à déclarer dit « au moins » (couverture, §5)`, K.ca);
        dit(!/\bundefined\b|\bNaN\b|\bnull\b|encaiss/i.test(K.page), `T ${T} : ni « undefined/NaN/null », ni « encaissé »`, (/\bundefined\b|\bNaN\b|\bnull\b|encaiss/i.exec(K.page) || [''])[0]);
        await capture(pg, `argent-declarer-${W}-${th}`);
        const el = await pg.$('.vrm-urssaf-geste');
        if (el && SHOTS) await el.screenshot({ path: path.join(SHOTS, `carte-declarer-${W}-${th}.png`) }).catch(() => {});
        await aller(pg, 'journee', 4000);
        const J = await pg.evaluate(() => ({ t: (document.querySelector('.vrm-main') || document.body).innerText, ctl: document.querySelectorAll('[data-controle-ligne="versement-30j"]').length }));
        dit(!INTERDIT.test(J.t) && J.ctl === 0, `L3 ${T} : Ma journée sans « à dater » ni contrôle « ventes sans versement »`, (INTERDIT.exec(J.t) || [''])[0]);
        await capture(pg, `journee-${W}-${th}`);
        dit(!o.journal.erreurs.length, `T ${T} : aucune erreur de page`, o.journal.erreurs.slice(0, 3).join(' | '));
      } catch (e) { dit(false, `${T} : le banc a tourné`, e && e.message); }
      await o.ctx.close().catch(() => {});
    }
    // Sans extension (téléphone, autre navigateur) : la ligne, SANS délai promis.
    for (const W of LARGEURS.slice(0, 1)) {
      const T = `${W} sans extension`;
      const o = await NV.ouvrir(nav, { W, sombre: false, base: jeu(), tab: 'dashboard' });
      const pg = o.pg;
      try {
        await publie(pg);
        const K = await lireArgent(pg);
        dit(!!K.ligne && K.ligne.n === '41' && K.ligne.h === '0' && /41 restantes\)/.test(K.ligne.t) && !/environ/.test(K.ligne.t), `L5 ${T} : la ligne sans délai (le délai ne se promet qu’à une extension 5.390)`, JSON.stringify(K.ligne));
        dit(!!K.ligne && K.ligne.gestes === 0 && !INTERDIT.test(K.page), `L5 ${T} : aucun geste, aucun « à dater »`, K.ligne && K.ligne.t);
        await capture(pg, `argent-declarer-sans-extension-${W}`);
      } catch (e) { dit(false, `${T} : le banc a tourné`, e && e.message); }
      await o.ctx.close().catch(() => {});
    }
    for (const W of LARGEURS) {
      const T = `${W} tout daté`;
      const o = await NV.ouvrir(nav, { W, sombre: false, base: jeu({ toutDate: true }), tab: 'dashboard' });
      const pg = o.pg;
      try {
        const pub = await publie(pg);
        dit(!!(pub && pub.aDater && pub.aDater.n === 0), `L4 ${T} : rien à dater publié`, JSON.stringify(pub && pub.aDater && pub.aDater.n));
        const K = await lireArgent(pg);
        dit(K.ligne === null && K.toutes === 0 && !/Dates de versement : l’extension/.test(K.page), `L4 ${T} : la ligne n’existe nulle part`, `${JSON.stringify(K.ligne)} · ${K.toutes}`);
        dit(!INTERDIT.test(K.page), `L4 ${T} : aucun « à dater »`, (INTERDIT.exec(K.page) || [''])[0]);
        await capture(pg, `argent-declarer-tout-date-${W}`);
        dit(!o.journal.erreurs.length, `T ${T} : aucune erreur de page`, o.journal.erreurs.slice(0, 3).join(' | '));
      } catch (e) { dit(false, `${T} : le banc a tourné`, e && e.message); }
      await o.ctx.close().catch(() => {});
    }
  } finally {
    await nav.close(); NV.srv.close();
  }
  console.log(ko ? `❌ banc versements-auto : ${ko} rouge(s), ${ok} vert(s)` : `✅ banc versements-auto : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
