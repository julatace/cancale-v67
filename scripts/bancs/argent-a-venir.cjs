// ════════════════════════════════════════════════════════════════════════════
// BANC : L'ARGENT À VENIR — le résumé et son écran (15 nov.)
//        npm run build && BANC_PORT=9341 node scripts/bancs/argent-a-venir.cjs
// ════════════════════════════════════════════════════════════════════════════
// Julien : « je veux que les stats des montants en attente soient mieux affichées ».
// Données INVENTÉES, de la vraie forme (le dépôt est public) : le jeu de
// `nouveau-vendeur` + des ventes Vinted à chaque étape sur deux comptes (liste
// `my_orders`, prix `{amount, currency_code}`), leurs transactions (`status` 450
// versée, 440 retour) et deux ventes Vestiaire (`vc_ventes`, `montant` sellerEarning,
// `etapesVc`, « paiement estimé » écrit en toutes lettres). Attendu, À LA MAIN :
//   envoyer   64 + 85 + 150      = 299,00 € (3)
//   route     72 + 58 + 203,23   = 333,23 € (3)
//   livree    95 + 120           = 215,00 € (2)
//   total                         = 847,23 € (8)  ·  bloquée (retour 440) 110 € À PART
//   compte vendeuse_b écarté ⇒ 847,23 − 120 − 85 = 642,23 € (6)
// R1 le résumé (Ventes · Tous) : le total, ses étapes en une ligne, un toucher ⇒ l'écran ;
// R2 l'écran : le total = la somme des étapes ; chaque étape = la somme de ses ventes
//    dépliées ; la bloquée hors total ; la date « vers le … » seulement là où le site
//    l'écrit (Vestiaire), « — » + la raison pour Vinted ;
// R3 la frise : semaine + suivante + plus tard + sans date = le total ; 2 ventes datées ;
// R4 par site puis par compte : Vinted = la somme de ses comptes ; Vestiaire 353,23 € ;
// R5 les deux autres sommes (porte-monnaie, reçu) nommées, jamais additionnées :
//    aucun texte n'écrit total + l'une d'elles ; le total n'est écrit qu'UNE fois ;
// R6 Ma journée et Argent montrent le résumé, et il ouvre le même écran ;
// R7 compte écarté ⇒ hors total ;
// R8 à 390 px : rien ne déborde, cibles ≥ 44 px dans l'écran ; aucune erreur, ni NaN.
// `SHOTS=<dossier>` : les captures (390 et 1512, clair et sombre).
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || '';
const TAILLES = String(process.env.TAILLES || '390:clair,1512:clair,390:sombre,1512:sombre').split(',').map((x) => { const [w, t] = x.split(':'); return { W: Number(w), sombre: t === 'sombre' }; });
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };

const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const enLettres = (j) => { const d = new Date(now + j * 86400000); return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const vente = (tx, titre, eur, statut, tus, j) => ({ transaction_id: tx, conversation_id: tx + 9000, title: titre, price: { amount: String(eur), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(j), photo: null });
const txn = (uid, tx, s, titre) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: iso(0.01), payload: { transaction: { id: tx, item_id: tx + 500000, status: s, status_title: titre, status_updated_at: iso(0.5), shipment: { id: tx + 1, status: 1, status_title: '', status_updated_at: iso(0.5) } } } } });
const VA = [
  vente(62100, 'Nike Air Max 90 blanche T42', 64, 'Bordereau envoyé au vendeur', 'needs_action', 0.2),
  vente(62101, 'Adidas Samba OG noire T39', 72, "Commande expédiée et en cours d'acheminement ! ", 'waiting', 1),
  vente(62102, 'New Balance 550 crème T41', 58, RELAIS_ST, 'waiting', 2),
  vente(62103, 'Asics Gel-1130 argent T43', 95, 'Commande livrée ! ', 'waiting', 3),
  vente(62104, 'Salomon XT-6 grise T44', 40, 'Commande finalisée', 'completed', 8),
  vente(62105, 'Nike Dunk Low panda T40', 110, "Commande expédiée et en cours d'acheminement ! ", 'waiting', 4),
];
const VB = [
  vente(62200, 'Nike Air Force 1 blanche T42', 120, 'Commande livrée ! ', 'waiting', 3),
  vente(62201, 'Adidas Gazelle bleue T40', 66, "Commande expédiée et en cours d'acheminement ! ", 'waiting', 5),
  vente(62202, 'New Balance 2002R grise T43', 85, 'Le paiement a été validé', 'needs_action', 0.1),
];
const VC = {
  V9001: { id: 'V9001', productId: 'V9001', titre: 'Jordan 1 Mid chicago T42', etat: 'IN_PROGRESS', statutVc: 'deliveryInProgress', compte: 'vc_moi', date: iso(5), aExpedier: false,
    montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 203.23 }, prixVente: { cle: 'sellerPrice', devise: 'EUR', valeur: 240 },
    etapesVc: { sellerSale: 'done', sellerShipment: 'done', sellerConformity: 'done', sellerDelivery: 'ongoing', sellerPayment: 'upcoming' }, paiementEstime: enLettres(4) },
  V9002: { id: 'V9002', productId: 'V9002', titre: 'Yeezy 350 zebra T41', etat: 'ACTION_NEEDED', compte: 'vc_moi', date: iso(0.5), aExpedier: true,
    montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 150 }, prixVente: { cle: 'sellerPrice', devise: 'EUR', valeur: 180 },
    etapesVc: { sellerSale: 'done', sellerShipment: 'pending', sellerConformity: 'upcoming', sellerDelivery: 'upcoming', sellerPayment: 'upcoming' }, paiementEstime: enLettres(12) },
};
const jeu = (exclu) => {
  const L = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  L.find((r) => r.id === 'harvest_111_orders_sold').data.payload.my_orders = VA;
  L.find((r) => r.id === 'harvest_222_orders_sold').data.payload.my_orders = VB;
  L.push(txn(111, 62105, 440, 'Retour initié'), txn(222, 62201, 450, 'Commande finalisée'), txn(111, 62104, 450, 'Commande finalisée'));
  for (const v of [...VA, ...VB]) if (![62105, 62201, 62104].includes(v.transaction_id)) L.push(txn(VA.includes(v) ? 111 : 222, v.transaction_id, 230, 'Payée'));
  L.push({ id: 'vc_ventes', data: { capturedAt: iso(0.05), forme: 'v2', ventes: VC } });
  if (exclu) { const m = L.find((r) => r.id === 'main'); m.data.vinted_accounts_hidden = ['222']; }
  return { lignes: L, comptes: NV.JEU_COMPTES, ecritures: 0 };
};
const aller = async (pg, q, attente = 3000) => {
  const url = `http://localhost:${NV.PORT}/?${q.includes('=') ? q : 'tab=' + q}`;
  // Une navigation de l'app en cours (elle réécrit l'adresse) peut annuler celle du banc : une seconde fois.
  try { await pg.goto(url, { waitUntil: 'domcontentloaded' }); } catch (_) { await pg.waitForTimeout(800); await pg.goto(url, { waitUntil: 'domcontentloaded' }); }
  await pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(attente);
};
const capture = async (pg, nom) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.screenshot({ path: path.join(SHOTS, `${nom}.png`), fullPage: false });
};
const resume = (pg) => pg.evaluate(() => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().height > 0;
  const s = [...document.querySelectorAll('section.vrm-a-venir')].find(vis);
  if (!s) return null;
  const et = s.querySelector('[data-a-venir-etapes]');
  return { total: s.getAttribute('data-a-venir'), n: s.getAttribute('data-a-venir-n'), etapes: et ? et.getAttribute('data-a-venir-etapes') : '', texte: s.innerText.replace(/\s+/g, ' ').trim() };
});
const ouvrirEcran = async (pg) => {
  const b = await pg.$$('section.vrm-a-venir [data-a-venir-ouvrir]');
  for (const x of b) { if (await x.isVisible()) { await x.click(); break; } }
  await pg.waitForSelector('[data-argent-a-venir-ecran]', { timeout: 6000 }).catch(() => {});
  await pg.waitForTimeout(500);
  return !!(await pg.$('[data-argent-a-venir-ecran]'));
};
const fermerEcran = async (pg) => { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(500); };
const lireEcran = (pg) => pg.evaluate(() => {
  const E = document.querySelector('[data-argent-a-venir-ecran]');
  if (!E) return null;
  const a = (el, k) => (el ? el.getAttribute(k) : null);
  const aff = E.querySelector('[data-av-total]');
  const etapes = [...E.querySelectorAll('[data-av-etape]')].map((x) => ({ k: a(x, 'data-av-etape'), eur: Number(a(x, 'data-eur')), n: Number(a(x, 'data-n')), hors: a(x, 'data-av-hors-total') === '1', prevu: a(x, 'data-prevu'), date: (x.querySelector('[data-av-date]') || {}).getAttribute ? x.querySelector('[data-av-date]').getAttribute('data-av-date') : '', texte: x.innerText.replace(/\s+/g, ' ') }));
  const frise = [...E.querySelectorAll('[data-av-frise-case]')].map((x) => ({ k: a(x, 'data-av-frise-case'), eur: Number(a(x, 'data-eur')), n: Number(a(x, 'data-n')) }));
  const sd = E.querySelector('[data-av-sans-date]');
  const sites = [...E.querySelectorAll('[data-av-site]')].map((x) => ({ p: a(x, 'data-av-site'), eur: Number(a(x, 'data-eur')), n: Number(a(x, 'data-n')) }));
  const sommes = [...E.querySelectorAll('[data-av-somme]')].map((x) => ({ k: a(x, 'data-av-somme'), eur: a(x, 'data-eur') }));
  return { total: Number(a(aff, 'data-av-total')), n: Number(a(aff, 'data-av-n')), partiel: a(aff, 'data-av-partiel'), etapes, frise, sansDate: sd ? { n: Number(a(sd, 'data-av-sans-date')), eur: Number(a(sd, 'data-eur')) } : { n: 0, eur: 0 },
    datees: Number(a(E.querySelector('[data-av-frise]'), 'data-av-frise') || 0), sites, sommes, texte: E.innerText };
});
const deplier = async (pg, sel) => { const t = await pg.$(`${sel} > button`); if (t) { await t.click(); await pg.waitForTimeout(250); } };
const ventesDe = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(`${sel} [data-av-vente]`)].map((x) => Number(x.getAttribute('data-eur'))), sel);
const fr = (c) => (c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const { W, sombre } of TAILLES) {
      const T = `${W}${sombre ? ' sombre' : ''}`, tel = W < 600;
      const o = await NV.ouvrir(nav, { W, sombre, base: jeu(false), tab: 'cat_ventes' });
      const pg = o.pg;
      try {
        await pg.waitForSelector('section.vrm-a-venir[data-a-venir]', { timeout: 25000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        // ── R1 le résumé ──
        const R = await resume(pg);
        // Ventes s'ouvre sur Vinted : le résumé y dit SA part (la même règle, `aVenirPour`).
        dit(!!R && R.total === '49400' && R.n === '6', `R1 ${T} Ventes · Vinted : le résumé dit la part Vinted, 494 € pour 6 ventes`, JSON.stringify(R));
        dit(!!R && R.etapes === 'envoyer=2 route=2 livree=2 bloquee=1', `R1 ${T} les étapes Vinted en une ligne (2 à envoyer, 2 en route, 2 livrées, 1 en litige hors total)`, R && R.etapes);
        await capture(pg, `av-ventes-${W}-${sombre ? 'sombre' : 'clair'}`);
        const ouvert = await ouvrirEcran(pg);
        dit(ouvert, `R1 ${T} un toucher sur le résumé ouvre l'écran « Argent à venir »`);
        const E = await lireEcran(pg);
        if (E) {
          // ── R2 les étapes ──
          const dans = E.etapes.filter((x) => !x.hors);
          const somme = dans.reduce((t, x) => t + x.eur, 0);
          dit(E.total === 84723 && somme === E.total, `R2 ${T} le total (${fr(E.total)} €) = la somme des étapes (${fr(somme)} €)`, JSON.stringify(dans));
          dit(dans.map((x) => `${x.k}:${x.n}:${x.eur}`).join(' ') === 'envoyer:3:29900 route:3:33323 livree:2:21500', `R2 ${T} chaque étape, son nombre et son montant`, dans.map((x) => `${x.k}:${x.n}:${x.eur}`).join(' '));
          const bl = E.etapes.find((x) => x.k === 'bloquee');
          dit(!!bl && bl.hors && bl.eur === 11000 && bl.n === 1, `R2 ${T} la vente en retour (440) : à part, 110 €, hors total`, JSON.stringify(bl));
          dit(E.etapes.find((x) => x.k === 'livree').date === 'passu' && /Vinted n’écrit pas/.test(E.etapes.find((x) => x.k === 'livree').texte), `R2 ${T} « livrée » (Vinted) : « — » et la raison, jamais une date inventée`, E.etapes.find((x) => x.k === 'livree').texte);
          for (const x of dans) {
            await deplier(pg, `[data-av-etape="${x.k}"]`);
            const L = await ventesDe(pg, `[data-av-etape="${x.k}"]`);
            dit(L.length === x.n && L.reduce((t, v) => t + v, 0) === x.eur, `R2 ${T} « ${x.k} » déplie ses ${x.n} ventes, leur somme = son montant`, JSON.stringify(L));
          }
          // ── R3 la frise ──
          const fs3 = E.frise.reduce((t, x) => t + x.eur, 0) + E.sansDate.eur;
          dit(E.datees === 2 && E.frise.length === 3 && fs3 === E.total && E.sansDate.n === 6, `R3 ${T} la frise : 2 ventes datées (Vestiaire), cette semaine + la suivante + plus tard + sans date = le total`, JSON.stringify({ frise: E.frise, sansDate: E.sansDate, datees: E.datees }));
          // ── R4 par site, par compte ──
          const vin = E.sites.find((x) => x.p === 'Vinted'), vc = E.sites.find((x) => x.p === 'Vestiaire');
          dit(!!vin && !!vc && vin.eur === 49400 && vc.eur === 35323 && vin.eur + vc.eur === E.total, `R4 ${T} par site : Vinted 494 €, Vestiaire 353,23 €`, JSON.stringify(E.sites));
          await deplier(pg, '[data-av-site="Vinted"]');
          const comptes = await pg.evaluate(() => [...document.querySelectorAll('[data-av-site="Vinted"] [data-av-compte]')].map((x) => ({ c: x.getAttribute('data-av-compte'), eur: Number(x.getAttribute('data-eur')), n: Number(x.getAttribute('data-n')) })));
          dit(comptes.length === 2 && comptes.reduce((t, x) => t + x.eur, 0) === vin.eur && comptes.some((x) => x.c === 'vendeuse_a' && x.eur === 28900) && comptes.some((x) => x.c === 'vendeuse_b' && x.eur === 20500), `R4 ${T} Vinted déplie ses comptes : vendeuse_a 289 €, vendeuse_b 205 €`, JSON.stringify(comptes));
          // ── R5 trois sommes, jamais additionnées ; le total écrit une fois ──
          const E2 = await lireEcran(pg);
          dit(E2.sommes.map((x) => x.k).join(',') === 'dispo,recu', `R5 ${T} les deux autres sommes sont nommées à part (porte-monnaie, reçu)`, JSON.stringify(E2.sommes));
          const txt = E2.texte.replace(/\s+/g, ' ');
          const add = E2.sommes.filter((x) => x.eur).map((x) => fr(E.total + Number(x.eur)));
          dit(!add.some((s) => txt.includes(s)), `R5 ${T} aucune somme « à venir + porte-monnaie / reçu » écrite`, add.join(' | '));
          dit(txt.split(fr(E.total)).length - 1 === 1, `R5 ${T} le total (${fr(E.total)} €) n'est écrit qu'une fois sur l'écran`, String(txt.split(fr(E.total)).length - 1));
          // ── R8 l'écran au doigt ──
          if (tel) {
            const m = await pg.evaluate(() => {
              const E = document.querySelector('[data-argent-a-venir-ecran]');
              const petits = [...E.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect()).filter((r) => r.height < 43.5).length;
              return { debord: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || E.scrollWidth > E.clientWidth + 1, petits };
            });
            dit(!m.debord && m.petits === 0, `R8 ${T} l'écran : rien ne déborde, chaque cible ≥ 44 px`, JSON.stringify(m));
          }
          dit(!/\bNaN\b|undefined|\[object Object\]|Invalid Date/.test(E2.texte), `R8 ${T} ni NaN, ni undefined dans l'écran`);
          await pg.evaluate(() => { const E = document.querySelector('[data-argent-a-venir-ecran]'); if (E) for (const x of [E, ...E.querySelectorAll('*')]) if (x.scrollTop) x.scrollTop = 0; });
          await pg.waitForTimeout(300);
          await capture(pg, `av-ecran-${W}-${sombre ? 'sombre' : 'clair'}`);
          await pg.evaluate(() => { const E = document.querySelector('[data-argent-a-venir-ecran]'); const s = E && E.querySelector('[data-av-sites]'); if (s) s.scrollIntoView({ block: 'start' }); });
          await pg.waitForTimeout(300);
          await capture(pg, `av-ecran-bas-${W}-${sombre ? 'sombre' : 'clair'}`);
          await fermerEcran(pg);
        }
        // ── R6 Ma journée et Argent ──
        for (const [ecran, q] of [['Ma journée', 'journee'], ['Argent', 'compta']]) {
          await aller(pg, q, 4000);
          const r = await resume(pg);
          dit(!!r && r.total === '84723', `R6 ${T} ${ecran} montre le résumé (847,23 €)`, JSON.stringify(r));
          const ok2 = r ? await ouvrirEcran(pg) : false;
          const e = ok2 ? await lireEcran(pg) : null;
          dit(!!e && e.total === 84723, `R6 ${T} ${ecran} : un toucher ouvre le même écran, le même total`, e && e.total);
          if (ok2) { if (ecran === 'Ma journée') await capture(pg, `av-journee-ecran-${W}-${sombre ? 'sombre' : 'clair'}`); await fermerEcran(pg); }
          await capture(pg, `av-${q}-${W}-${sombre ? 'sombre' : 'clair'}`);
        }
        const errs = [...o.journal.erreurs, ...o.journal.console];
        dit(!errs.length, `R8 ${T} aucune erreur d'app`, errs.join(' | '));
      } finally { await o.ctx.close(); }
    }
    // ── R7 compte écarté ──
    {
      const o = await NV.ouvrir(nav, { W: 1512, sombre: false, base: jeu(true), tab: 'cat_ventes' });
      try {
        await o.pg.waitForSelector('section.vrm-a-venir[data-a-venir]', { timeout: 25000 }).catch(() => {});
        await o.pg.waitForTimeout(1500);
        const R = await resume(o.pg);
        const ouv = R ? await ouvrirEcran(o.pg) : false;
        const E = ouv ? await lireEcran(o.pg) : null;
        dit(!!E && E.total === 64223 && E.n === 6 && !/vendeuse_b/.test(E.texte), 'R7 vendeuse_b écartée : 642,23 € pour 6 ventes, ni son argent ni son nom', JSON.stringify(E && { t: E.total, n: E.n }));
      } finally { await o.ctx.close(); }
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc argent-a-venir : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
