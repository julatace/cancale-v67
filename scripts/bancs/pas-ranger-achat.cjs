// ════════════════════════════════════════════════════════════════════════════
//  BANC « ON RANGE UN ARTICLE, PAS UN ACHAT » (15 nov.)
//  Julien, sur la capture du centre de notifications : « Enlève ça, on range une
//  ANNONCE, pas un achat » (chaque achat arrivé y portait « Première case libre :
//  Meuble · rangée 1, colonne 1 · [Ranger] Déjà rangé », la même case pour tous).
//  Récit : docs/passation/2026-11-15-pas-ranger-achat.md ; la règle :
//  scripts/audit-pas-ranger-achat.cjs.
//
//  Données INVENTÉES (dépôt public), servies par le harnais du banc `nouveau-vendeur`
//  (aucune écriture ne sort du banc). Un meuble « Étagère A » 3 × 2 dont deux cases
//  sont prises (B900, N°1) ; les N°2 à 9 en ligne sans case ; l'achat 73001 vu « en
//  route » puis « arrivé » sur cet appareil ; une proposition « à ranger » gardée
//  d'avant (l'achat 73002, `vrm_ranger_proposes`) ; l'achat 73000 au point relais.
//  Exigé, à 390 px tactile (clair) et à 1512 px (sombre) :
//   P1 la cloche : aucune ligne « À ranger » (ni l'achat arrivé, ni la proposition
//      gardée d'avant), la pastille ne les compte pas ;
//   P2 Ma journée : aucune ligne « N achats à ranger » (l'écran est rendu : il a des lignes) ;
//   P3 « J'ai retiré » (73000) : aucune feuille « Ranger cet achat », rien de proposé ;
//   P4 le Stock : la fiche de N°2 et celle de N°3 disent chacune SA case proposée,
//      DIFFÉRENTES, libres ; « Ranger ici » pose N°3 dans la sienne ;
//   + aucune erreur JS ; captures (SHOTS=dossier) à REGARDER.
//  Réglages : `BANC_PORT` (4985 par défaut), `BANC_DIST`. Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '4985';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const SHOTS = process.env.SHOTS || '';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d !== undefined ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };
const attendre = async (fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 250)); } return v; };

const MEUBLES = [{ id: 'mA', name: 'Étagère A', cols: 3, rows: 2 }];
const SLOTS = { B900: { m: 'mA', i: 0 }, 1: { m: 'mA', i: 1 } };
const jeu = () => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const main = l.find((x) => x.id === 'main').data;
  main.vrm_meubles = MEUBLES; main.vrm_slots = SLOTS;
  const b = l.find((x) => x.id === 'harvest_111_orders_purchased').data.payload.my_orders;
  b[1].status = 'Commande finalisée'; b[1].transaction_user_status = 'completed';   // 73001 : arrivé
  return l;
};
const AVANT = { vus: { 73000: 'autre', 73001: 'autre', 73002: 'autre' }, proposes: { 73002: { tx: '73002', titre: 'Asics Gel-1130 argent taille 43', at: Date.now() - 3600e3, site: 'vinted' } } };
const poserAvant = (pg) => pg.evaluate((a) => { try { localStorage.setItem('vrm_ranger_vus', JSON.stringify(a.vus)); localStorage.setItem('vrm_ranger_proposes', JSON.stringify(a.proposes)); } catch (_) {} }, AVANT);
const lireLocal = (pg) => pg.evaluate(() => { const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }; return { proposes: j('vrm_ranger_proposes') || {}, slots: j('vrm_slots') || {} }; });

async function ouvrir(nav, { W, sombre, tab }) {
  const base = { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre, base, tab });
  await poserAvant(o.pg);
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  return o;
}

async function passe(nav, { W, sombre }) {
  const T = `[${W}px ${sombre ? 'sombre' : 'clair'}]`;
  // P1 + P2 : Ma journée et la cloche (l'ancienne cloche calculait 4 s après le nuage : on laisse 9 s).
  {
    const o = await ouvrir(nav, { W, sombre, tab: 'journee' });
    await o.pg.waitForSelector('[data-job]', { timeout: 25000 }).catch(() => {});
    await o.pg.waitForTimeout(9000);
    const j = await o.pg.evaluate(() => ({ lignes: document.querySelectorAll('[data-job]').length, ranger: document.querySelectorAll('[data-job="achats-a-ranger"]').length }));
    dit(j.lignes > 0, `${T} P2 (contrôle du banc) Ma journée est rendue (${j.lignes} lignes)`, j);
    dit(j.ranger === 0, `${T} P2 Ma journée : aucune ligne « N achats à ranger »`, j);
    await capture(o.pg, `pas-ranger-journee-${W}`);
    const pastille = await o.pg.evaluate(() => { const p = document.querySelector('[data-centre-notifs-cloche] [data-cn-pastille]'); return p ? p.getAttribute('data-cn-pastille') : ''; });
    await o.pg.locator('[data-centre-notifs-cloche]').first().click().catch(() => {});
    await o.pg.waitForSelector('[data-centre-notifs]', { timeout: 8000 }).catch(() => {});
    await o.pg.waitForTimeout(1500);
    const c = await o.pg.evaluate(() => { const s = document.querySelector('[data-centre-notifs]'); return s ? { etat: s.getAttribute('data-centre-etat'), lignes: s.querySelectorAll('[data-centre-ranger-tx], [data-centre-ranger], [data-centre-ranger-ouvrir], [data-centre-ranger-fait]').length, texte: /Première case libre|Déjà rangé/.test(s.innerText) } : null; });
    dit(!!c, `${T} P1 (contrôle du banc) la cloche s’ouvre`);
    dit(!!c && c.lignes === 0 && !c.texte, `${T} P1 la cloche : aucun achat « à ranger » (ni l’arrivé 73001, ni la proposition gardée 73002)`, c);
    dit(pastille === '', `${T} P1 la pastille ne compte aucune notification locale « à ranger » (journal vide ⇒ pas de pastille)`, pastille);
    await capture(o.pg, `pas-ranger-cloche-${W}`);
    dit(!o.journal.erreurs.length, `${T} aucune erreur JS (Ma journée, cloche)`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
  // P3 : « J'ai retiré » l'achat 73000 (au point relais).
  {
    const o = await ouvrir(nav, { W, sombre, tab: 'cat_achats' });
    const RETIRE = '[data-colis-retire], .vrm-pickup-collect';
    await o.pg.locator(`[data-cc-colonne="retirer"] .vrm-rpf-ouvrir, ${RETIRE}`).first().waitFor({ timeout: 30000 }).catch(() => {});
    if (!(await o.pg.locator(RETIRE).count())) await o.pg.locator('[data-cc-colonne="retirer"] .vrm-rpf-ouvrir').first().click().catch(() => {});
    await o.pg.locator(RETIRE).first().waitFor({ timeout: 12000 }).catch(() => {});
    const avant = await lireLocal(o.pg);
    const n = await o.pg.locator(RETIRE).count();
    dit(n > 0, `${T} P3 (contrôle du banc) « J’ai retiré » est là`, n);
    if (n) await o.pg.locator(RETIRE).first().click().catch(() => {});
    await o.pg.waitForTimeout(3500);
    const feuille = await o.pg.evaluate(() => !!document.querySelector('[data-ranger-feuille]'));
    const apres = await lireLocal(o.pg);
    dit(!feuille, `${T} P3 « J’ai retiré » n’ouvre aucune feuille « Ranger cet achat »`);
    dit(JSON.stringify(Object.keys(apres.proposes).sort()) === JSON.stringify(Object.keys(avant.proposes).sort()), `${T} P3 rien n’est proposé à ranger pour cet achat`, { avant: Object.keys(avant.proposes), apres: Object.keys(apres.proposes) });
    await capture(o.pg, `pas-ranger-retire-${W}`);
    dit(!o.journal.erreurs.length, `${T} aucune erreur JS (Achats)`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
  // P4 : le Stock, une case par article.
  {
    const o = await ouvrir(nav, { W, sombre, tab: 'garage' });
    const fiche = async (num) => {
      await o.pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
      const champ = o.pg.locator('[data-stock-recherche] input').first();
      await champ.waitFor({ timeout: 25000 }).catch(() => {});
      await o.pg.waitForTimeout(1200);
      await champ.fill(String(num)).catch(() => {});
      await o.pg.waitForTimeout(500);
      await champ.press('Enter').catch(() => {});
      return attendre(() => o.pg.evaluate(() => { const e = document.querySelector('[data-fiche-case-proposee]'); return e ? e.getAttribute('data-fiche-case-proposee') : null; }), 10000);
    };
    const c2 = await fiche(2);
    await capture(o.pg, `pas-ranger-fiche2-${W}`);
    const c3 = await fiche(3);
    const ici = await o.pg.evaluate(() => { const b = document.querySelector('[data-fiche-ranger-ici]'); return b ? b.getAttribute('data-fiche-ranger-ici') : null; });
    await capture(o.pg, `pas-ranger-fiche3-${W}`);
    const prises = new Set(Object.values(SLOTS).map((s) => s.m + ':' + s.i));
    dit(!!c2 && !!c3, `${T} P4 la fiche de N°2 et celle de N°3 disent chacune une case proposée`, { c2, c3 });
    dit(!!c2 && !!c3 && c2 !== c3 && !prises.has(c2) && !prises.has(c3), `${T} P4 deux articles à ranger ⇒ deux cases DIFFÉRENTES, libres (jamais la même à deux)`, { c2, c3 });
    dit(c2 === 'mA:2' && c3 === 'mA:3', `${T} P4 dans l’ordre des N° : N°2 la première libre (mA:2), N°3 la suivante (mA:3)`, { c2, c3 });
    if (ici) {
      // (16 nov., intégration vague B) Fiche D : les gestes de la case vivent derrière « ⋯ » → « Tout voir » (c39b2131) :
      // on les ouvre d'abord quand « Ranger ici » n'est pas visible — le même chemin que lui.
      if (!(await o.pg.locator('[data-fiche-ranger-ici]').first().isVisible().catch(() => false))) {
        await o.pg.evaluate(() => { const b = document.querySelector('.vrm-fp [data-fd-plus-ouvrir]'); if (b) b.click(); });
        await o.pg.waitForTimeout(300);
        await o.pg.evaluate(() => { const d = document.querySelector('.vrm-fp [data-fiche-plus]'); if (d) d.open = true; });
        await o.pg.waitForTimeout(500);
        await o.pg.locator('[data-fiche-ranger-ici]').first().scrollIntoViewIfNeeded().catch(() => {});
      }
      await o.pg.locator('[data-fiche-ranger-ici]').first().click().catch(() => {});
      const pose = await attendre(async () => { const l = await lireLocal(o.pg); return l.slots['3'] ? l.slots['3'] : null; }, 6000);
      dit(!!pose && pose.m + ':' + pose.i === c3, `${T} P4 « Ranger ici » pose N°3 dans SA case proposée`, pose);
      await o.pg.waitForTimeout(800); await capture(o.pg, `pas-ranger-pose-${W}`);
    } else dit(false, `${T} P4 « Ranger ici » est sur la fiche de N°3`);
    dit(!o.journal.erreurs.length, `${T} aucune erreur JS (Stock)`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
}

(async () => {
  await new Promise((r) => NV.srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const [W, sombre] of [[390, false], [1512, true]]) await passe(nav, { W, sombre }).catch((e) => dit(false, `[${W}px] le banc a pu aller au bout`, String(e && e.stack).slice(0, 400)));
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\n❌ pas-ranger-achat : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ pas-ranger-achat : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
