// ════════════════════════════════════════════════════════════════════════════
//  BANC « RETIRER DES AUTRES SITES » — vendu sur un site ⇒ retiré des autres en
//  un toucher (11 nov. ; récit : docs/passation/2026-11-11-anti-double-vente.md).
//  Données INVENTÉES (le dépôt est public) : le jeu du banc `nouveau-vendeur`,
//  servi par SON harnais (aucune écriture ne sort du banc), plus :
//   · la N°42 VENDUE sur Vinted (transaction finalisée reliée à son annonce) ;
//   · la même N°42 encore en ligne sur Leboncoin (référence VRM-42, lecture
//     complète de « Mes annonces » fraîche) et sur eBay (SKU VRM-42) ;
//   · deux AUTRES annonces Leboncoin au MÊME titre (N°43, N°44) — jamais touchées ;
//   · l'extension simulée par son pont (5.342, sait supprimer sur Leboncoin) ;
//   · la route eBay simulée (`retirer` ⇒ ok, l'annonce sort de `ebay_listings`).
//  Scénarios : `plein` · `sansext` (pas d'extension : Leboncoin à faire à la main) ·
//  `vieux` (lectures de 30 h : « peut-être », aucun bouton) · `ambigu` (le N°42 porté
//  par deux paires : rien proposé). 390 px tactile et 1512 px.
//  Il MESURE (data-*, rectangles, commandes interceptées — jamais un libellé seul,
//  sauf la phrase qui EST la règle) :
//   R1 la carte de Ma journée porte « Retirer des autres sites » (et Ventes, en tête) ;
//   R2 Annuler n'envoie RIEN ; Confirmer : UNE commande `lbcSupprime` (l'identifiant du
//      N°42) et UN `retirer` eBay (sans `auto`) — jamais les N°43/44 au même titre ;
//   R3 le résultat par site, puis « relu » après la relecture ;
//   R4 sans extension : Leboncoin « à faire sur le site » (lien), eBay seul part ;
//   R5 lectures anciennes : « peut-être encore en ligne · vérifier », aucun bouton ;
//   R6 N° ambigu : aucun bloc, aucun bouton ;
//   R0 aucune erreur JS, aucun débordement, 44 px au doigt, aucun rouge.
//  Réglages : `BANC_PORT` (9676 par défaut), `LARGEURS`, `SCENARIOS`, `SHOTS=<dossier>`.
//  Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9676';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const SCENARIOS = liste('SCENARIOS', 'plein,sansext,vieux,ambigu');
const SHOTS = process.env.SHOTS || '';

let ko = 0;
const compte = {};
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 600) : ''}`);
};

const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const TITRE = 'Nike Air Max 90 blanche taille 42';
const ID_LBC = '3100000042', ID_EBAY = '256000000042';
const jeu = (scenario) => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const main = l.find((x) => x.id === 'main');
  main.data.vinted_annonce_numeros['51900'] = { numero: '42', title: TITRE, accountId: '111' };
  main.data.vinted_annonce_numeros['51901'] = { numero: '43', title: TITRE, accountId: '111' };
  main.data.vinted_annonce_numeros['51902'] = { numero: '44', title: TITRE, accountId: '111' };
  if (scenario === 'ambigu') main.data.vinted_annonce_numeros['51999'] = { numero: '42', title: 'Asics Gel Lyte III verte', accountId: '222' };
  l.push({ id: 'harvest_111_txn_62002', data: { capturedAt: iso(0.01), payload: { transaction: { id: 62002, item_id: 51900, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(1), shipment: { status_title: 'Livré' } } } } });
  const vieux = scenario === 'vieux' ? 1.25 : 0.02;   // 30 h ou 30 min
  const lbcL = l.find((x) => x.id === 'lbc_listings');
  const ann = (id, num) => ({ id, ref: num, customRef: 'VRM-' + num, subject: TITRE, status: 'active', account: 'lbcA', seenAt: iso(vieux), price: 90 });
  Object.assign(lbcL.data.items, { [ID_LBC]: ann(ID_LBC, '42'), '3100000043': ann('3100000043', '43'), '3100000044': ann('3100000044', '44') });
  lbcL.data.lectures = { lbcA: { at: iso(vieux), total: 4, n: 4 } };
  l.push({ id: 'ebay_listings', data: { capturedAt: now - vieux * 86400000, complet: true, items: [{ itemId: ID_EBAY, sku: 'VRM-42', title: TITRE, listingStatus: 'Active', depuis: iso(5), photo: null }, { itemId: '256000000043', sku: 'VRM-43', title: TITRE, listingStatus: 'Active', depuis: iso(5), photo: null }] } });
  l.push({ id: 'ebay_orders', data: { capturedAt: now - vieux * 86400000, complet: true, orders: [] } });
  return l;
};

// Le pont de l'extension, simulé dans la page (la même forme que le banc `lbc-supprimer`).
const PONT = ({ mode }) => {
  window.__cmds = [];
  if (mode === 'absente') return;
  const version = '5.342.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, lbcPause: true, lbcSupprime: true } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => !['__vmr', 'reqId'].includes(k)))));
      if (d.cmd !== 'lbcSupprime') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'inconnue', raison: 'commande inconnue' } }); return; }
      // L'extension note l'annonce supprimée dans `lbc_listings` (ce que la relecture verra).
      Promise.resolve(window.__bancLbcSupprimee && window.__bancLbcSupprimee(String(d.id))).then(() =>
        setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'fait', statut: 200, reponse: '{"ok":true}', note: true } }), 150));
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

const MESURE = (pg, tel) => pg.evaluate((tel) => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width >= 1 && r.height >= 1 && getComputedStyle(e).visibility !== 'hidden'; };
  const txt = (e) => (e ? (e.innerText || '').trim().replace(/\s+/g, ' ') : '');
  const carte = [...document.querySelectorAll('[data-vendus-ailleurs]')].find(vis) || null;
  const blocs = [...document.querySelectorAll('[data-retirer-ailleurs-bloc]')].filter(vis);
  const boutons = [...document.querySelectorAll('[data-retirer-ailleurs]')].filter(vis);
  const petits = [];
  if (tel) for (const e of [...boutons, ...document.querySelectorAll('[data-retirer-ailleurs-bloc] a, [data-retirer-ailleurs-bloc] button, .vrm-va-voir')]) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.height < 43.5) petits.push(`${txt(e).slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`); }
  const rouge = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return !!m && +m[1] > 150 && +m[2] < 70 && +m[3] > 20; };   // rouge (#FF3B30…), pas l'ambre (#B25000)
  const rouges = [...document.querySelectorAll('[data-retirer-ailleurs-bloc] *, [data-retirer-ailleurs]')].filter((e) => vis(e) && rouge(getComputedStyle(e).color)).map((e) => txt(e).slice(0, 30));
  return {
    carte: carte ? { texte: txt(carte), bouton: !!carte.querySelector('[data-retirer-ailleurs]'), ra: carte.getAttribute('data-ra-carte') } : null,
    blocs: blocs.map((b) => ({ auto: b.getAttribute('data-ra-auto'), verifier: b.getAttribute('data-ra-verifier'), texte: txt(b), sites: [...b.querySelectorAll('[data-ra-site]')].map((s) => ({ cle: s.getAttribute('data-ra-site'), voie: s.getAttribute('data-ra-voie'), statut: s.getAttribute('data-ra-statut'), lien: (s.querySelector('a[href]') || {}).href || '' })), bouton: !!b.querySelector('[data-retirer-ailleurs]') })),
    nBoutons: boutons.length, petits, rouges,
    debord: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
}, tel);
const dialogue = (pg) => pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Oui, retirer'); if (!b) return null; let n = b, t = ''; for (let i = 0; i < 8 && n; i++) { n = n.parentElement; if (n && n.innerText && n.innerText.length > t.length && n.innerText.length < 2000) t = n.innerText; } return t.replace(/\s+/g, ' '); });
const cliquer = (pg, texte) => pg.evaluate((tx) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === tx); if (b) b.click(); return !!b; }, texte);

async function tournee(nav, { W, scenario }) {
  const tel = W < 600, T = `[${scenario} ${W}px]`;
  const base = { lignes: jeu(scenario), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre: false, base, tab: 'journee' });
  const pg = o.pg;
  const ebay = [], relire = [];
  await pg.exposeFunction('__bancLbcSupprimee', (id) => { const r = base.lignes.find((x) => x.id === 'lbc_listings'); if (r && r.data.items[id]) Object.assign(r.data.items[id], { status: 'deleted', supprimeeAt: new Date().toISOString() }); return true; });
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    let b = null; try { b = JSON.parse(req.postData() || 'null'); } catch (_) { b = null; }
    if (req.method() === 'POST' && b && b.action === 'retirer') {
      ebay.push(b);
      const r = base.lignes.find((x) => x.id === 'ebay_listings');   // la route sort l'annonce terminée (`sortirDesAnnonces`)
      if (r) r.data.items = r.data.items.filter((x) => String(x.itemId) !== String(b.itemId));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fin: new Date().toISOString(), listes: true, regles: true }) });
    }
    if (req.method() === 'POST' && b && b.action === 'relire') {
      // La synchro relit eBay : la liste complète est réécrite, datée de maintenant.
      relire.push(b);
      const r = base.lignes.find((x) => x.id === 'ebay_listings'); if (r) r.data.capturedAt = Date.now();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.addInitScript(PONT, { mode: scenario === 'sansext' ? 'absente' : 'ok' });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-fu-journee', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(6500);
  const m = await MESURE(pg, tel);
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `ra-journee-${scenario}-${W}.png`), fullPage: true }); }
  dit(!m.debord && !m.petits.length && !m.rouges.length, 'R0', `${T} Ma journée : aucun débordement, 44 px, aucun rouge`, JSON.stringify({ d: m.debord, p: m.petits, r: m.rouges }));

  if (scenario === 'plein' || scenario === 'sansext') {
    dit(!!m.carte && m.carte.bouton && /N°42 vendu sur Vinted/.test(m.carte.texte), 'R1', `${T} la carte « N°42 vendu sur Vinted » porte « Retirer des autres sites »`, JSON.stringify(m.carte));
    if (scenario === 'plein') dit(!!m.carte && /Leboncoin et eBay/.test(m.carte.texte) && m.carte.ra === '2', 'R1', `${T} … « Encore en ligne sur Leboncoin et eBay », 2 retirables`, JSON.stringify(m.carte));
    else dit(!!m.carte && m.carte.ra === '1', 'R4', `${T} sans extension : seul eBay est retirable par VRM`, JSON.stringify(m.carte));
    // R2 — Annuler n'envoie rien.
    await pg.locator('[data-vendus-ailleurs] [data-retirer-ailleurs]').first().click().catch(() => {});
    await pg.waitForTimeout(500);
    const d1 = await dialogue(pg);
    dit(!!d1 && /Leboncoin/.test(d1) && /eBay/.test(d1) && /sans retour/.test(d1), 'R2', `${T} la confirmation nomme chaque site et dit « sans retour »`, d1);
    if (scenario === 'sansext') dit(!!d1 && /Leboncoin[^\n]*à faire sur le site/.test(d1), 'R4', `${T} … Leboncoin « à faire sur le site — rien n’y part »`, d1);
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ra-confirmation-${scenario}-${W}.png`) });
    await cliquer(pg, 'Annuler');
    await pg.waitForTimeout(600);
    const c0 = await pg.evaluate(() => window.__cmds.filter((x) => /lbcSupprime/.test(x)));
    dit(!c0.length && !ebay.length, 'R2', `${T} Annuler n'envoie RIEN`, JSON.stringify({ c0, ebay }));
    // Confirmer.
    await pg.locator('[data-vendus-ailleurs] [data-retirer-ailleurs]').first().click().catch(() => {});
    await pg.waitForTimeout(500);
    await cliquer(pg, 'Oui, retirer');
    await pg.waitForSelector('[data-feuille-ailleurs] [data-ra-statut="relu"]', { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(800);
    const c1 = await pg.evaluate(() => window.__cmds.filter((x) => /lbcSupprime/.test(x)));
    if (scenario === 'plein') dit(c1.length === 1 && c1[0] === JSON.stringify({ cmd: 'lbcSupprime', id: ID_LBC, confirme: true }), 'R2', `${T} UNE commande Leboncoin, l'identifiant du N°42 (jamais les N°43/44 au même titre)`, JSON.stringify(c1));
    else dit(!c1.length, 'R4', `${T} sans extension : aucune commande Leboncoin`, JSON.stringify(c1));
    dit(ebay.length === 1 && ebay[0].itemId === ID_EBAY && ebay[0].confirme === true && ebay[0].auto === undefined, 'R2', `${T} UN retrait eBay : le N°42, confirmé, jamais en « auto »`, JSON.stringify(ebay));
    const f = await pg.evaluate(() => { const d = document.querySelector('[data-feuille-ailleurs]'); return d ? [...d.querySelectorAll('[data-ra-site]')].map((s) => ({ p: s.getAttribute('data-ra-plateforme'), st: s.getAttribute('data-ra-statut'), voie: s.getAttribute('data-ra-voie'), t: (s.innerText || '').replace(/\s+/g, ' '), lien: (s.querySelector('a[href]') || {}).href || '' })) : null; });
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ra-resultat-${scenario}-${W}.png`) });
    const eb = (f || []).find((x) => x.p === 'eBay'), lb = (f || []).find((x) => x.p === 'Leboncoin');
    dit(!!eb && eb.st === 'relu' && /retiré ✓ relu/.test(eb.t), 'R3', `${T} eBay : « retiré ✓ relu » (absente de la relecture)`, JSON.stringify(f));
    dit(relire.length === 1, 'R3', `${T} eBay se relit (synchro) après le retrait, une fois`, JSON.stringify(relire));
    if (scenario === 'plein') {
      dit(!!lb && lb.st === 'retire' && /pas encore relu/.test(lb.t), 'R3', `${T} Leboncoin accepté mais pas relu en entier : « pas encore relu » (la note de VRM n'est pas une relecture)`, JSON.stringify(f));
      // L'extension relit « Mes annonces » en entier (plus tard) ; « Revérifier » : relu.
      const r = base.lignes.find((x) => x.id === 'lbc_listings'); r.data.lectures = { lbcA: { at: new Date().toISOString(), total: 3, n: 3 } };
      // (une lecture identique se partage 2 s, src/lecturesPartagees.js ; en vrai, l'écriture de
      // l'extension la vide par son signal) : « Revérifier » touché après.
      await pg.waitForTimeout(2500);
      await pg.locator('[data-feuille-ailleurs] button', { hasText: 'Revérifier' }).first().click().catch(() => {});
      await pg.waitForSelector('[data-feuille-ailleurs] [data-ra-plateforme="Leboncoin"][data-ra-statut="relu"]', { timeout: 10000 }).catch(() => {});
      const lb2 = await pg.evaluate(() => { const s = document.querySelector('[data-feuille-ailleurs] [data-ra-plateforme="Leboncoin"]'); return s ? { st: s.getAttribute('data-ra-statut'), t: s.innerText.replace(/\s+/g, ' ') } : null; });
      dit(!!lb2 && lb2.st === 'relu' && /retiré ✓ relu/.test(lb2.t), 'R3', `${T} après la lecture complète de « Mes annonces » : Leboncoin « retiré ✓ relu »`, JSON.stringify(lb2));
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ra-relu-${scenario}-${W}.png`) });
    }
    else dit(!!lb && lb.voie === 'main' && !lb.st && /leboncoin\.fr/.test(lb.lien), 'R4', `${T} Leboncoin : à faire sur le site, avec le lien`, JSON.stringify(f));
    await pg.locator('[data-feuille-ailleurs] [data-feuille-croix]').click().catch(() => {});
    await pg.waitForTimeout(400);
  }
  if (scenario === 'vieux' || scenario === 'ambigu') {
    dit(m.nBoutons === 0, scenario === 'vieux' ? 'R5' : 'R6', `${T} aucun « Retirer des autres sites »`, JSON.stringify(m));
  }
  // Ventes : le bloc en tête.
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(6500);
  const v = await MESURE(pg, tel);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ra-ventes-${scenario}-${W}.png`), fullPage: false });
  dit(!v.debord && !v.petits.length && !v.rouges.length, 'R0', `${T} Ventes : aucun débordement, 44 px, aucun rouge`, JSON.stringify({ d: v.debord, p: v.petits, r: v.rouges }));
  if (scenario === 'plein') {
    // Les retraits de la journée ont eu lieu (même base) : plus rien à proposer.
    dit(v.nBoutons === 0, 'R3', `${T} Ventes après les retraits : plus rien à retirer (relu)`, JSON.stringify(v.blocs));
  }
  if (scenario === 'vieux') {
    const b = v.blocs[0];
    dit(!!b && b.auto === '0' && !b.bouton && /peut-être encore en ligne sur Leboncoin et eBay · vérifier/.test(b.texte) && b.sites.every((s) => s.voie === 'verifier'), 'R5', `${T} Ventes : « peut-être encore en ligne sur Leboncoin et eBay · vérifier », jamais affirmé`, JSON.stringify(v.blocs));
  }
  if (scenario === 'ambigu') dit(v.blocs.length === 0, 'R6', `${T} Ventes : aucun bloc (N° porté par deux paires)`, JSON.stringify(v.blocs));
  dit(!o.journal.erreurs.length, 'R0', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const scenario of SCENARIOS) for (const W of LARGEURS) await tournee(nav, { W, scenario });
  } catch (e) { dit(false, 'R0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ retirer-ailleurs : ${ko} défaut(s)` : '\n✅ retirer-ailleurs : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
