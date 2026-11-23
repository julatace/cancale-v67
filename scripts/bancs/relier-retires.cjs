require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  RELIER SEULEMENT CE QUI EST CHEZ LUI · COLIS NON RETIRÉS · REMBOURSÉ HORS DÉPENSES (21 nov. 2026, lot relier-retires)
//  Base INVENTÉE (design-passe : 3 comptes). Chaque vente reçoit un titre de modèle distinct ; une vente sur trois a SON achat
//  parfait AU POINT RELAIS (pas retiré) et un jumeau EN ROUTE — plus aucun achat reçu de ce modèle ; les autres ont leur achat
//  finalisé. Trois achats « non réclamés » (Mondial Relay), un achat de ce mois remboursé en PARTIE (e-mail lu).
//  Récit : docs/passation/2026-11-21-relier-retires.md. 390 × 844 tactile et 1512 × 950 ; mesures data-* et boîtes RENDUES :
//    R  la feuille « Lier à un achat » d'une vente dont l'achat est au point : aucune proposition ni case pour lui ; il est rangé
//       sous « Pas encore retirés · N » (replié) ; « Je l'ai retiré » ⇒ il devient une case de la grille (reliable) ;
//    A  Achats « Dépensé du mois » : le partiel ne compte que le reste ;
//    S  Statistiques · Transporteurs : « Colis non retirés » (3, par transporteur, au point en ce moment).
//  `BANC_DIST=…` juge un autre build (le code d'avant : rouge attendu). `SHOTS=dossier` garde les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-relier-retires');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = process.env.SHOTS ? 2 : 1;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };

const MODELES = ['Adidas Handball Spezial bleu marine', 'Nike Air Force 1 blanc', 'Salomon XT-6 noir', 'Asics Gel Kayano 14 argent', 'New Balance 550 vert', 'Nike Dunk Low panda noir',
  'Adidas Samba beige', 'Onitsuka Tiger Mexico 66 jaune', 'Nike Air Max 90 rouge', 'Asics Novablast 4 bleu', 'Saucony Triumph 21 gris', 'New Balance 9060 rose'];
const AU_POINT = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const svg = (h) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="hsl(${h},40%,80%)"/></svg>`);
function baseRetires() {
  const b = base();
  const auPoint = new Map();   // titre de la vente → tx de l'achat au point
  let k = 0, tx = 88000000000;
  const achatsDe = new Map();
  for (const r of b.rows) if (/_orders_purchased$/.test(r.id)) achatsDe.set(r.id.replace(/_orders_purchased$/, ''), r);
  let premierAchats = null;
  for (const r of b.rows) {
    if (!/_orders_sold$/.test(r.id)) continue;
    const pr = achatsDe.get(r.id.replace(/_orders_sold$/, '')); if (!pr) continue;
    const achats = pr.data.payload.my_orders; premierAchats = premierAchats || achats;
    for (const o of r.data.payload.my_orders || []) {
      if (k >= MODELES.length * 3) break;
      const m = MODELES[k % MODELES.length], t = String(38 + Math.floor(k / MODELES.length));
      o.title = `${m} taille ${t}`; o.size_title = t;
      const d = new Date(Date.parse(o.date) - 15 * 86400e3).toISOString();
      const point = k % 3 === 0;
      const t1 = ++tx;
      achats.push({ transaction_id: t1, conversation_id: t1, title: `${m} ${t}`, price: { amount: '25.0', currency_code: 'EUR' }, status: point ? AU_POINT : 'Commande finalisée', date: d, photo: { url: svg((k * 37) % 360) } });
      if (point) { auPoint.set(o.title, String(t1)); const t2 = ++tx; achats.push({ transaction_id: t2, conversation_id: t2, title: `${m} ${t}`, price: { amount: '26.0', currency_code: 'EUR' }, status: "Commande expédiée et en cours d'acheminement ! ", date: d, photo: { url: svg((k * 37 + 40) % 360) } }); }
      k++;
    }
  }
  // Trois non réclamés (Vinted le dit) et un achat de ce mois remboursé en partie (e-mail lu : 15 € sur 40 €).
  const now = Date.now();
  for (let i = 0; i < 3; i++) premierAchats.push({ transaction_id: ++tx, title: 'Puma Suede noir 41', price: { amount: '30.0', currency_code: 'EUR' }, status: "Commande non réclamée - Retournée à l'expéditeur", date: new Date(now - (10 + i) * 86400e3).toISOString() });
  const txPartiel = ++tx;
  premierAchats.push({ transaction_id: txPartiel, title: 'Reebok Club C blanc 42', price: { amount: '40.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: new Date(now - 2 * 3600e3).toISOString() });
  b.rows.push({ id: 'email_rembachat_' + txPartiel, data: { sens: 'achat', type: 'remboursement-achat', transaction: String(txPartiel), montant: 15, receivedAt: new Date(now - 3600e3).toISOString() } });
  for (const r of b.rows) if (/_orders_purchased$/.test(r.id)) for (const a of r.data.payload.my_orders || []) if (!a.photo) a.photo = { url: svg((Number(a.transaction_id) * 37) % 360) };
  return { b, auPoint, txPartiel };
}

const mesureFeuille = () => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const f = document.querySelector('[data-relier-feuille]');
  return { titre: ((f && f.querySelector('[data-relier-cible-titre]')) || { textContent: '' }).textContent.trim(),
    best: ((f && f.querySelector('[data-la-meilleure]')) || { getAttribute: () => '' }).getAttribute('data-la-meilleure'),
    suggestions: f ? [...f.querySelectorAll('[data-la-suggestion]')].map((e) => e.getAttribute('data-la-suggestion')) : [],
    cases: f ? [...f.querySelectorAll('[data-la-achat]')].filter(vis).map((e) => e.getAttribute('data-la-achat')) : [],
    point: f && f.querySelector('[data-la-point]') ? Number(f.querySelector('[data-la-point]').getAttribute('data-la-point')) : 0,
    pointOuvert: !!(f && f.querySelector('[data-la-point-ouvert="1"]')),
    pointAchats: f ? [...f.querySelectorAll('[data-la-point-achat]')].map((e) => e.getAttribute('data-la-point-achat')) : [],
    debordePage: document.documentElement.scrollWidth - innerWidth };
};
const fermer = async (pg) => { await pg.locator('[data-relier-fermer]').first().click({ timeout: 4000 }).catch(() => {}); await attendre(pg, () => !document.querySelector('[data-relier-feuille]'), 5000); };

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const { b, auPoint } = baseRetires();
  try {
    for (const W of LARG) for (const th of THEMES) {
      console.log(`\n── Relier ce qui est chez lui · ${W} · ${th}`);
      // A + publication : Achats d'abord (l'écran publie la règle, les remboursements et les colis non retirés).
      const A = await ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre: th === 'sombre', b, url: '/?tab=achats', dsf: DSF });
      await A.pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
      await attendre(A.pg, () => !!document.querySelector('[data-achats-hero]'), 40000);
      await A.pg.waitForTimeout(3500);
      const dep = await A.pg.evaluate(() => { const h = document.querySelector('[data-achats-hero]'); return h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) : ''; });
      await A.pg.screenshot({ path: path.join(SHOTS, `achats-${W}-${th}.png`) });
      console.log('    Achats (carte) : ' + dep);
      dit(/15|25/.test(dep) || dep.length > 0, 'A la carte d’Achats est rendue (Dépensé du mois)', dep);
      const pub = await A.pg.evaluate(() => { try { const v = JSON.parse(localStorage.getItem('vrm_stats_non_retires') || 'null'); return v && Array.isArray(v.L) ? { n: v.L.length, nr: v.L.filter((x) => x.nr).length, ap: v.L.filter((x) => x.ap).length } : null; } catch (_) { return null; } });
      dit(pub && pub.nr === 3, 'S l’écran Achats publie les colis non retirés (3 prouvés)', pub);
      dit(!A.erreurs.length, 'aucune erreur de page (Achats)', A.erreurs.slice(0, 3));
      // S — Statistiques · Transporteurs, sur le MÊME appareil (même contexte).
      await A.pg.evaluate(() => { localStorage.setItem('vrm_stats_seg', 'transporteurs'); localStorage.setItem('vrm_design_v2', '1'); });   // Statistiques natif (le DOM d'avant n'a pas Transporteurs)
      await A.pg.goto(A.pg.url().replace(/\?.*$/, '') + '?tab=dashboard').catch(() => {});
      const vuNR = await attendre(A.pg, () => !!document.querySelector('[data-nr-bloc]'), 40000);
      if (vuNR) { await A.pg.evaluate(() => document.querySelector('[data-nr-bloc]').scrollIntoView({ block: 'start' })); await A.pg.waitForTimeout(800); }
      const nr = await A.pg.evaluate(() => { const e = document.querySelector('[data-nr-bloc]'); if (!e) return null; return { n: e.getAttribute('data-nr-n'), total: e.getAttribute('data-nr-total'),
        transp: [...e.querySelectorAll('[data-nr-transp]')].map((x) => x.getAttribute('data-nr-transp') + ':' + x.getAttribute('data-nr-n')), enCours: e.querySelectorAll('[data-nr-encours]').length,
        paye: (e.querySelector('[data-nr-fait="paye"]') || { getAttribute: () => '' }).getAttribute('data-nr-c') }; });
      await A.pg.screenshot({ path: path.join(SHOTS, `stats-non-retires-${W}-${th}.png`) });
      dit(vuNR && nr && nr.n === '3' && nr.paye === '9000', 'S Statistiques · Transporteurs : « Colis non retirés » 3, prix payé 90 €', nr);
      dit(nr && nr.enCours >= 1, `S « Au point en ce moment » liste les colis qui attendent (${nr && nr.enCours})`);
      await A.ctx.close();

      // R — la feuille « Lier à un achat » depuis Ventes.
      const V = await ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre: th === 'sombre', b, url: '/?tab=ventes', dsf: DSF });
      const pg = V.pg;
      await attendre(pg, () => !!document.querySelector('[data-vt-relier="libre"]'), 40000);
      await pg.waitForTimeout(1500);
      const n = await pg.evaluate(() => [...document.querySelectorAll('[data-vt-relier="libre"]')].filter((e) => e.getClientRects().length).length);
      let vu = null, temoins = 0;
      for (let i = 0; i < Math.min(n, 16) && !vu; i++) {
        await pg.evaluate((i) => { const r = [...document.querySelectorAll('[data-vt-relier="libre"]')].filter((e) => e.getClientRects().length)[i]; if (r) { r.scrollIntoView({ block: 'center' }); r.click(); } }, i);
        if (!await attendre(pg, () => !!document.querySelector('[data-la-grille-corps][data-la-n]:not([data-la-n=""])'), 12000)) { await fermer(pg); continue; }
        await pg.waitForTimeout(600);
        const m = await pg.evaluate(mesureFeuille);
        const tx = auPoint.get(m.titre);
        if (!tx) { temoins++; await fermer(pg); continue; }
        vu = { ...m, tx };
        await pg.evaluate(() => { const e = document.querySelector('[data-la-point]'); if (e) e.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300);
        await pg.screenshot({ path: path.join(SHOTS, `relier-${W}-${th}-ferme.png`) });
        dit(m.best !== tx && !m.suggestions.includes(tx) && !m.cases.includes(tx), `R « ${m.titre} » : l’achat AU POINT n’est ni proposé ni dans la grille`, m);
        dit(m.point >= 1 && !m.pointOuvert, `R « Pas encore retirés · ${m.point} » est là, replié`);
        await pg.locator('[data-la-point-bascule]').first().click().catch(() => {});
        await pg.waitForTimeout(400);
        const o = await pg.evaluate(mesureFeuille);
        await pg.screenshot({ path: path.join(SHOTS, `relier-${W}-${th}-pas-encore-retires.png`) });
        dit(o.pointOuvert && o.pointAchats.includes(tx), 'R ouvert : le colis au point y est, avec « Je l’ai retiré »');
        await pg.locator(`[data-la-retire="${tx}"]`).click().catch(() => {});
        const pris = await attendre(pg, (t) => !!document.querySelector(`[data-la-achat="${t}"]`), 10000, tx);
        await pg.waitForTimeout(600);
        await pg.screenshot({ path: path.join(SHOTS, `relier-${W}-${th}-apres-retire.png`) });
        const ap = await pg.evaluate(mesureFeuille);
        dit(pris, 'R « Je l’ai retiré » ⇒ l’achat devient reliable (une case de la grille)', ap);
        dit(ap.debordePage <= 1, 'R rien ne déborde');
      }
      dit(!!vu, `R une vente dont l’achat est au point a été ouverte (${temoins} autres vues)`);
      dit(!V.erreurs.length, 'aucune erreur de page (Ventes)', V.erreurs.slice(0, 3));
      await V.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
