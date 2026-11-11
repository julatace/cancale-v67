// ════════════════════════════════════════════════════════════════════════════
//  BANC « ACTIONS EN SÉRIE » (11 nov. ; docs/passation/2026-11-11-actions-serie.md)
//  Données INVENTÉES (le dépôt est public), harnais du banc `nouveau-vendeur` —
//  aucune écriture ne sort du banc. 390 px tactile et 1512 px, clair et sombre.
//  Il MESURE (data-*, localStorage écrit par l'app, nombres rendus) :
//   A  ACHATS — ordinateur : case + Maj-clic = la plage (3 lignes) ; téléphone :
//      APPUI LONG ouvre la sélection, un tap coche ; « Tout sélectionner » = le
//      filtre courant ; « Retiré » écrit `vinted_pickup_done` pour les SEULS
//      colis au point relais, résumé « 3 retirés · 1 pas fait : … » ; Échap /
//      Annuler ferment ; « Annuler » de la pilule défait la série entière.
//   V  VENTES — « Tout sélectionner » puis « Je dépose » : `vinted_ship_done`
//      pour les ventes à envoyer seulement, une finalisée « pas faite » et dite ;
//      « Exporter » télécharge un CSV qui porte les N lignes cochées.
//   G  PARTOUT — aucune erreur JS, rien ne déborde, la barre au-dessus de la
//      navigation du bas au téléphone, cibles de 44 px au doigt.
//  Réglages : `BANC_PORT` (9520 par défaut), `LARGEURS=390,1512`,
//  `THEMES=clair,sombre`, `SCENES=A,V`, `SHOTS=<dossier>`, `BANC_DIST`.
//  Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9520';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SCENES = liste('SCENES', 'A,V');
const SHOTS = process.env.SHOTS || '';

let ko = 0; const compte = {};
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 600) : ''}`);
};

// ── LE JEU INVENTÉ ──────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const RELAIS = 'Colis arrivé au point relais';
const achat = (tx, title, prix, jours, status, tus = 'needs_action') => ({ transaction_id: tx, conversation_id: 8500000 + tx % 1000, title, price: { amount: String(prix), currency_code: 'EUR' }, status, transaction_user_status: tus, date: iso(jours), photo: null });
const vente = (tx, title, prix, status, tus, jours) => ({ transaction_id: tx, title, price: { amount: String(prix), currency_code: 'EUR' }, status, transaction_user_status: tus, date: iso(jours), photo: null });
const jeu = () => [
  { id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vrm_numerotation: { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z' } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(0.01), payload: { my_orders: [
    achat(7400001, 'Adidas Spezial noire 42', 32, 3, RELAIS),
    achat(7400002, 'Nike Dunk Low panda 41', 55, 4, RELAIS),
    achat(7400003, 'Asics Gel-1130 argent 43', 40, 5, RELAIS),
    achat(7400004, 'New Balance 550 crème 44', 50, 6, 'Commande finalisée', 'completed'),
  ] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: [
    vente(64001, 'Salomon XT-6 grise taille 42', 120, 'Bordereau envoyé au vendeur', 'needs_action', 1),
    vente(64002, 'Vans Old Skool taille 42', 42, 'Bordereau envoyé au vendeur', 'needs_action', 2),
    vente(64003, 'Puma Suede bleue taille 40', 45, 'Bordereau envoyé au vendeur', 'needs_action', 2.5),
    vente(64004, 'Converse Chuck 70 taille 41', 48, 'Commande finalisée', 'completed', 9),
  ] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0.02), payload: { my_orders: [] } } },
];
const COMPTES = NV.JEU_COMPTES;

const attendre = async (pg, sel, ms = 15000) => pg.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };
const ls = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const barre = (pg) => pg.evaluate(() => { const b = document.querySelector('[data-serie-barre]:not([data-serie-fermee])'); if (!b) return null; const r = b.getBoundingClientRect(); return { n: b.getAttribute('data-serie-n'), total: b.getAttribute('data-serie-total'), top: r.top, bas: r.bottom, h: innerHeight }; });
const resume = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-serie-resume]'); return e ? e.textContent.trim() : ''; });
const GENERAL = (pg, tel) => pg.evaluate((tel) => {
  const debord = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const b = document.querySelector('[data-serie-barre]');
  const petits = tel && b ? [...b.querySelectorAll('button')].filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => x.textContent.trim()) : [];
  const nav = document.querySelector('.vrm-bottom-nav, .vrm-mobile-nav, nav.vrm-barre-iphone');
  const sousNav = !!(tel && b && nav && nav.getBoundingClientRect().height > 0 && b.getBoundingClientRect().bottom > nav.getBoundingClientRect().top + 1);
  return { debord, petits, sousNav };
}, tel);
const appuiLong = async (pg, sel) => {
  await pg.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(200);
  const box = await pg.locator(sel).first().boundingBox(); if (!box) return false;
  const x = box.x + box.width / 2, y = box.y + Math.min(box.height / 2, 30);
  if (process.env.DBG) await pg.evaluate(() => { window.__ev = []; for (const t of ['pointerdown','pointermove','pointerup','pointercancel','contextmenu','click','touchstart']) document.addEventListener(t, (e) => window.__ev.push(t + ':' + (e.pointerType || '') + ':' + (e.target && e.target.className || '').toString().slice(0, 30)), true); });
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await pg.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  if (process.env.DBG) console.log(await pg.evaluate(() => window.__ev.join(' | ')), x, y);
  return true;
};

async function passe(nav, { W, theme }) {
  const sombre = theme === 'sombre', tel = W < 600, T = `[${W}px ${theme}]`, nomS = (x) => `serie-${W}-${theme}-${x}`;
  const ouvrir = async (tab) => { const base = { lignes: jeu(), comptes: COMPTES, ecritures: 0 }; const o = await NV.ouvrir(nav, { W, sombre, base, tab }); await o.pg.waitForTimeout(1500); return o; };

  if (SCENES.includes('A')) {
    const o = await ouvrir('achats'); const pg = o.pg;
    const lu = await attendre(pg, '[data-achat-tx="7400001"]', 25000);
    dit(lu, 'A', `${T} Achats : les 4 achats inventés sont rendus`);
    const L = (tx) => `[data-achat-tx="${tx}"]`;
    if (tel) {
      const caseCachee = await pg.evaluate(() => { const c = document.querySelector('[data-serie-case]'); return !c || !c.getClientRects().length || getComputedStyle(c).display === 'none'; });
      dit(caseCachee, 'A', `${T} au doigt, aucune case tant que la sélection n'est pas ouverte`);
      await appuiLong(pg, L('7400001'));
      await pg.waitForTimeout(400);
      let b = await barre(pg);
      dit(b && b.n === '1', 'A', `${T} APPUI LONG : la sélection s'ouvre avec la ligne touchée (1)`, JSON.stringify(b));
      await pg.locator(L('7400002')).first().tap().catch(() => {});
      await pg.locator(L('7400004')).first().tap().catch(() => {});
      await pg.waitForTimeout(300);
      b = await barre(pg);
      dit(b && b.n === '3', 'A', `${T} un tap coche une ligne de plus (3), sans ouvrir son menu`, JSON.stringify(b));
      const menu = await pg.evaluate(() => !!document.querySelector('.vrm-buy-menu'));
      dit(!menu, 'A', `${T} le tap en sélection n'ouvre pas la ligne`);
    } else {
      await pg.locator(`${L('7400001')} [data-serie-case] input`).first().click();
      await pg.locator(`${L('7400003')} [data-serie-case] input`).first().click({ modifiers: ['Shift'] });
      await pg.waitForTimeout(300);
      const b = await barre(pg);
      dit(b && b.n === '3', 'A', `${T} case puis Maj-clic : la PLAGE (3 lignes)`, JSON.stringify(b));
      const coches = await pg.evaluate(() => [...document.querySelectorAll('[data-serie-coche="1"]')].map((x) => x.getAttribute('data-serie-ligne')).join(','));
      dit(coches === '7400001,7400002,7400003', 'A', `${T} les 3 lignes cochées sont celles de la plage`, coches);
    }
    await capture(pg, nomS('achats-selection'));
    // Échap ferme (ordinateur), puis on rouvre et on prend tout le filtre.
    if (!tel) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); dit(!(await barre(pg)), 'A', `${T} Échap ferme la sélection`); await pg.locator(`${L('7400001')} [data-serie-case] input`).first().click(); }
    await pg.locator('[data-serie-tout]').first().click().catch(() => {});
    await pg.waitForTimeout(250);
    let b = await barre(pg);
    dit(b && b.n === b.total && Number(b.n) >= 4, 'A', `${T} « Tout sélectionner » = le filtre courant (${b && b.total})`, JSON.stringify(b));
    const g = await GENERAL(pg, tel);
    dit(!g.debord && !g.petits.length && !g.sousNav, 'G', `${T} Achats : ni débord, cibles 44 px, la barre au-dessus de la navigation`, JSON.stringify(g));
    await pg.locator('[data-serie-action="retire"]').first().click();
    await pg.waitForTimeout(700);
    const r = await resume(pg), pd = (await ls(pg, 'vinted_pickup_done')) || {};
    const ecrits = ['7400001', '7400002', '7400003'].filter((k) => pd[k]);
    dit(ecrits.length === 3 && !pd['7400004'], 'A', `${T} « Retiré » : 3 colis au relais écrits, la commande finalisée NON`, JSON.stringify(Object.keys(pd)));
    dit(/^3 retirés · 1 pas fait : /.test(r), 'A', `${T} résumé honnête « 3 retirés · 1 pas fait : raison »`, r);
    await capture(pg, nomS('achats-resume'));
    // La pilule « Annuler » (5 s) défait la SÉRIE entière.
    const annuler = pg.locator('button[data-pilule-annuler]').first();
    if (await annuler.count()) { await annuler.click().catch(() => {}); await pg.waitForTimeout(900); const pd2 = (await ls(pg, 'vinted_pickup_done')) || {}; dit(!['7400001', '7400002', '7400003'].some((k) => pd2[k]), 'A', `${T} « Annuler » de la pilule défait les 3 d'un coup`, JSON.stringify(Object.keys(pd2))); }
    else dit(false, 'A', `${T} la pilule « Annuler » est là après la série`);
    dit(!o.journal.erreurs.length, 'G', `${T} Achats : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }

  if (SCENES.includes('V')) {
    const o = await ouvrir('ventes'); const pg = o.pg;
    await pg.locator('[data-selecteur-logos] button[data-site="vinted"]').first().click().catch(() => {});
    const lu = await attendre(pg, '[data-serie-ligne="64001"]', 25000);
    dit(lu, 'V', `${T} Ventes · Vinted : les lignes portent la sélection`);
    await pg.locator('[data-serie-ouvrir="ventes"]').first().click().catch(() => {});
    await pg.waitForTimeout(250);
    await pg.locator('[data-serie-tout]').first().click().catch(() => {});
    await pg.waitForTimeout(300);
    const b = await barre(pg);
    dit(b && b.n === b.total && Number(b.n) >= 3, 'V', `${T} « Sélectionner » puis « Tout sélectionner » (${b && b.n})`, JSON.stringify(b));
    await capture(pg, nomS('ventes-selection'));
    const g = await GENERAL(pg, tel);
    dit(!g.debord && !g.petits.length && !g.sousNav, 'G', `${T} Ventes : ni débord, cibles 44 px, la barre au-dessus de la navigation`, JSON.stringify(g));
    // Exporter : un CSV qui porte les lignes cochées.
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 6000 }).catch(() => null), pg.locator('[data-serie-action="exporter"]').first().click()]);
    let csv = ''; if (dl) { const p = await dl.path().catch(() => null); if (p) csv = fs.readFileSync(p, 'utf8'); }
    const nl = csv.trim().split(/\r?\n/).length - 1;
    dit(dl && nl === Number(b && b.n) && /64001/.test(csv), 'V', `${T} « Exporter » : un CSV de ${b && b.n} lignes (les cochées)`, `${nl} lignes`);
    // Rouvrir, tout, « Je dépose ».
    await pg.locator('[data-serie-ouvrir="ventes"]').first().click().catch(() => {});
    await pg.locator('[data-serie-tout]').first().click().catch(() => {});
    await pg.waitForTimeout(250);
    await pg.locator('[data-serie-action="depose"]').first().click();
    await pg.waitForTimeout(800);
    const sd = (await ls(pg, 'vinted_ship_done')) || {}, r = await resume(pg);
    dit(['64001', '64002', '64003'].every((k) => sd[k]) && !sd['64004'], 'V', `${T} « Je dépose » : les 3 ventes à envoyer, pas la finalisée`, JSON.stringify(Object.keys(sd)));
    dit(/^3 déposées · \d+ pas faits? : /.test(r) || r === '3 déposées', 'V', `${T} résumé « 3 déposées · … pas fait : raison »`, r);
    await capture(pg, nomS('ventes-resume'));
    dit(!o.journal.erreurs.length, 'G', `${T} Ventes : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
}

(async () => {
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try { for (const W of LARGEURS) for (const theme of THEMES) await passe(nav, { W, theme }); }
  catch (e) { dit(false, 'G', 'le banc a planté', e && e.stack); }
  await nav.close(); try { NV.srv.close(); } catch (_) {}
  const tot = Object.values(compte).reduce((s, x) => s + x.ok, 0);
  console.log(`actions-serie : ${tot} verts, ${ko} rouges · ` + Object.entries(compte).map(([k, v]) => `${k} ${v.ok}/${v.ok + v.ko}`).join(' · '));
  process.exit(ko ? 1 : 0);
})();
