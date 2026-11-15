// ════════════════════════════════════════════════════════════════════════════
//  BANC « À RETIRER AILLEURS » — vendue sur un site ⇒ retirée des autres, accompagnée
//  (15 nov. ; récit : docs/passation/2026-11-15-retrait-ailleurs.md). Remplace le banc
//  `retirer-ailleurs` (« Retirer des autres sites », 11 nov.), qui le lance désormais.
//  Données INVENTÉES (le dépôt est public) : le jeu du banc `nouveau-vendeur`, servi par SON
//  harnais (aucune écriture ne sort du banc), plus :
//   · la N°42 VENDUE sur Vinted (transaction finalisée reliée à son annonce) ;
//   · la même N°42 encore en ligne sur Leboncoin (réf. VRM-42, lecture complète fraîche),
//     sur eBay (SKU VRM-42) et sur Vestiaire (lien posé P42 → 42) ;
//   · deux AUTRES annonces Leboncoin au MÊME titre (N°43, N°44) — jamais touchées ;
//   · l'extension simulée par son pont (sait supprimer sur Leboncoin) ; la route eBay simulée.
//  Scénarios : `plein` (un geste par site) · `serie` (« Tout retirer (2) ») · `onglet` (pas
//  d'onglet leboncoin.fr : « Ouvre leboncoin.fr », puis reprise SEULE) · `sansext` (pas
//  d'extension : Leboncoin à la main + « C'est retiré ») · `douteuse` (la commande n'a pas
//  d'état : « peut-être vendue · à vérifier », aucun geste). 390 px tactile et 1512 px, clair
//  ET sombre. Il MESURE (data-*, rectangles, commandes interceptées) et COMPTE les touchers.
//   T1 le bloc est EN TÊTE de Ma journée (au-dessus du chiffre du jour), seul endroit : la
//      coque ne redit pas « à retirer de Leboncoin / d'eBay » à côté ;
//   T2 chaque site : sa marque, son état, UN geste ; jamais les N°43/44 au même titre ;
//   T3 Leboncoin : UNE confirmation, UNE commande `lbcSupprime` (l'id du N°42), puis « retirée » ;
//      eBay : UN `retirer` sans `auto`, puis « retirée ✓ relu » ; Vestiaire : « C'est retiré »
//      sans confirmation ⇒ « notée retirée » ;
//   T4 « Tout retirer (2) » : une confirmation, deux envois un par un, la progression dite ;
//   T5 pas d'onglet : « Ouvre leboncoin.fr » + lien ; l'extension relit leboncoin.fr ⇒ VRM
//      reprend SEUL (aucune seconde confirmation), « retirée » ;
//   T6 vente non prouvée : « Peut-être vendue », « à vérifier » avec pourquoi, AUCUN geste ;
//   T0 aucune erreur JS, aucun débordement, 44 px au doigt, aucun rouge.
//  Réglages : `BANC_PORT` (9677), `LARGEURS`, `SCENARIOS`, `THEMES`, `SHOTS=<dossier>`,
//  `BANC_DIST=<build>` (preuve §6.1 : ROUGE sur le build d'avant). Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9677';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const SCENARIOS = liste('SCENARIOS', 'plein,serie,onglet,sansext,douteuse');
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || '';

let ko = 0;
const compte = {};
const touchers = {};
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
  const douteuse = scenario === 'douteuse';
  // La commande 62002 : finalisée (prouvée) — ou SANS état (« peut-être vendue »).
  if (douteuse) { const o = l.find((x) => x.id === 'harvest_111_orders_sold'); o.data.payload.my_orders = o.data.payload.my_orders.map((v) => (v.transaction_id === 62002 ? { ...v, status: '' } : v)); }
  l.push({ id: 'harvest_111_txn_62002', data: { capturedAt: iso(0.01), payload: { transaction: douteuse ? { id: 62002, item_id: 51900, status: 1, status_title: '' } : { id: 62002, item_id: 51900, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(1), shipment: { status_title: 'Livré' } } } } });
  const lbcL = l.find((x) => x.id === 'lbc_listings');
  const ann = (id, num) => ({ id, ref: num, customRef: 'VRM-' + num, subject: TITRE, status: 'active', account: 'lbcA', seenAt: iso(0.02), price: 90 });
  Object.assign(lbcL.data.items, { [ID_LBC]: ann(ID_LBC, '42'), '3100000043': ann('3100000043', '43'), '3100000044': ann('3100000044', '44') });
  lbcL.data.lectures = { lbcA: { at: iso(0.02), total: 4, n: 4 } };
  l.push({ id: 'ebay_listings', data: { capturedAt: now - 0.02 * 86400000, complet: true, items: [{ itemId: ID_EBAY, sku: 'VRM-42', title: TITRE, listingStatus: 'Active', depuis: iso(5), photo: null }, { itemId: '256000000043', sku: 'VRM-43', title: TITRE, listingStatus: 'Active', depuis: iso(5), photo: null }] } });
  l.push({ id: 'ebay_orders', data: { capturedAt: now - 0.02 * 86400000, complet: true, orders: [] } });
  l.push({ id: 'vc_listings', data: { capturedAt: iso(0.02), liens: { P42: '42' }, items: { P42: { statut: 'on_sale', vuAt: iso(0.02), titre: TITRE, compte: 'vcA' } } } });
  l.push({ id: 'vc_ventes', data: { ventes: {} } });
  return l;
};

// Le pont de l'extension, simulé dans la page. `onglet` : la PREMIÈRE suppression répond « pas
// d'onglet leboncoin.fr connecté » (rien n'est parti), les suivantes passent.
const PONT = ({ mode }) => {
  window.__cmds = [];
  if (mode === 'absente') return;
  const version = '5.377.0';
  let premiere = true;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, lbcPause: true, lbcSupprime: true } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => !['__vmr', 'reqId'].includes(k)))));
      if (d.cmd !== 'lbcSupprime') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'inconnue', raison: 'commande inconnue' } }); return; }
      if (mode === 'onglet' && premiere) { premiere = false; setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'lbc-absent', raison: 'ouvre leboncoin.fr dans ce Chrome, connecté sur Ma boutique, puis réessaie' } }), 200); return; }
      Promise.resolve(window.__bancLbcSupprimee && window.__bancLbcSupprimee(String(d.id))).then(() =>
        setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'fait', statut: 200, reponse: '{"ok":true}', note: true } }), 400));
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

const MESURE = (pg, tel) => pg.evaluate((tel) => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width >= 1 && r.height >= 1 && getComputedStyle(e).visibility !== 'hidden'; };
  const txt = (e) => (e ? (e.innerText || '').trim().replace(/\s+/g, ' ') : '');
  const bloc = [...document.querySelectorAll('[data-retirer-ailleurs-liste]')].find(vis) || null;
  const chiffre = [...document.querySelectorAll('.sb-chiffre-affiche, .sj-affiche, [data-journee-affiche]')].find(vis) || null;
  const petits = [];
  if (tel && bloc) for (const e of bloc.querySelectorAll('button, a')) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.height < 43.5) petits.push(`${txt(e).slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`); }
  const rouge = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return !!m && +m[1] > 150 && +m[2] < 70 && +m[3] > 20 && +m[3] < 90; };
  const rouges = bloc ? [...bloc.querySelectorAll('*')].filter((e) => vis(e) && rouge(getComputedStyle(e).color)).map((e) => txt(e).slice(0, 30)) : [];
  // Un lien ou un bouton du bloc doit se LIRE : contraste de luminance avec le fond de sa rangée (≥ 3).
  const lum = (c) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(c || ''); if (!m) return null; const f = (v) => { v = +v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[1]) + 0.7152 * f(m[2]) + 0.0722 * f(m[3]); };
  const fond = (e) => { for (let p = e; p; p = p.parentElement) { const b = getComputedStyle(p).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; } return 'rgb(255, 255, 255)'; };
  const illisibles = bloc ? [...bloc.querySelectorAll('a, button')].filter(vis).filter((e) => { if (e.disabled) return false; const a1 = lum(getComputedStyle(e).color), b1 = lum(fond(e)); if (a1 == null || b1 == null) return false; return (Math.max(a1, b1) + 0.05) / (Math.min(a1, b1) + 0.05) < 3; }).map((e) => {
    // Le diagnostic : la couleur, le fond, et les règles qui posent une couleur sur ce lien (couches comprises).
    const regles = []; const fouiller = (rules) => { for (const r of rules || []) { if (r.cssRules && !r.selectorText) { fouiller(r.cssRules); continue; } try { if (r.selectorText && e.matches(r.selectorText) && /(^|;)\s*color\s*:/.test(r.style.cssText)) regles.push(r.selectorText.slice(0, 90) + ' { color: ' + r.style.getPropertyValue('color') + (r.style.getPropertyPriority('color') ? ' !important' : '') + ' }'); } catch (_) {} } };
    for (const sh of document.styleSheets) { try { fouiller(sh.cssRules); } catch (_) {} }
    return `${txt(e).slice(0, 30)} [${getComputedStyle(e).color} sur ${fond(e)}] ${regles.slice(-4).join(' ¦ ')}`; }) : [];
  const doublons = [...document.querySelectorAll('[data-job="double-vente"]')].filter(vis).map(txt).filter((t) => /retirer (de Leboncoin|d'eBay|d’eBay|de Vestiaire)/i.test(t));
  return {
    bloc: bloc ? {
      top: Math.round(bloc.getBoundingClientRect().top + scrollY), tout: bloc.getAttribute('data-rx-serie'), texte: txt(bloc),
      articles: [...bloc.querySelectorAll('[data-ra-numero]')].map((a) => ({ n: a.getAttribute('data-ra-numero'), douteuse: a.hasAttribute('data-rx-douteuse'), plaque: !!a.querySelector('.sb-plaque'),
        sites: [...a.querySelectorAll('[data-rx-site]')].map((s) => ({ cle: s.getAttribute('data-rx-site'), p: s.getAttribute('data-rx-plateforme'), etat: s.getAttribute('data-rx-etat'), statut: s.getAttribute('data-ra-statut'),
          marque: !!s.querySelector('svg[data-marque]'), gestes: [...s.querySelectorAll('button, a')].filter(vis).map((b) => b.getAttribute('data-rx-geste') || (b.hasAttribute('data-rx-marquer') ? 'marquer' : b.hasAttribute('data-rx-ouvrir-lbc') ? 'ouvrir-lbc' : b.hasAttribute('data-rx-ouvrir') ? 'ouvrir' : '?')),
          lien: (s.querySelector('a[href]') || {}).href || '', t: txt(s.querySelector('[data-rx-phrase]')) })) })),
    } : null,
    chiffreTop: chiffre ? Math.round(chiffre.getBoundingClientRect().top + scrollY) : null,
    doublons, petits, rouges, illisibles,
    debord: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
}, tel);
const dialogue = (pg) => pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Oui, retirer'); if (!b) return null; let n = b, t = ''; for (let i = 0; i < 8 && n; i++) { n = n.parentElement; if (n && n.innerText && n.innerText.length > t.length && n.innerText.length < 2000) t = n.innerText; } return t.replace(/\s+/g, ' '); });
const site = (m, p) => (m.bloc && m.bloc.articles.flatMap((a) => a.sites).find((s) => s.p === p)) || null;

async function tournee(nav, { W, scenario, sombre }) {
  const tel = W < 600, T = `[${scenario} ${W}px ${sombre ? 'sombre' : 'clair'}]`;
  const nom = `${scenario}-${W}-${sombre ? 'sombre' : 'clair'}`;
  let n = 0;
  const base = { lignes: jeu(scenario), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre, base, tab: 'journee' });
  const pg = o.pg;
  const ebay = [], relire = [];
  await pg.exposeFunction('__bancLbcSupprimee', (id) => { const r = base.lignes.find((x) => x.id === 'lbc_listings'); if (r && r.data.items[id]) Object.assign(r.data.items[id], { status: 'deleted', supprimeeAt: new Date().toISOString() }); return true; });
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    let b = null; try { b = JSON.parse(req.postData() || 'null'); } catch (_) { b = null; }
    if (req.method() === 'POST' && b && b.action === 'retirer') {
      ebay.push(b);
      const r = base.lignes.find((x) => x.id === 'ebay_listings');
      if (r) r.data.items = r.data.items.filter((x) => String(x.itemId) !== String(b.itemId));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fin: new Date().toISOString(), listes: true, regles: true }) });
    }
    if (req.method() === 'POST' && b && b.action === 'relire') {
      relire.push(b);
      const r = base.lignes.find((x) => x.id === 'ebay_listings'); if (r) r.data.capturedAt = Date.now();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.addInitScript(PONT, { mode: scenario === 'sansext' ? 'absente' : scenario === 'onglet' ? 'onglet' : 'ok' });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-fu-journee', { timeout: 20000 }).catch(() => {});
  await pg.waitForSelector('[data-retirer-ailleurs-liste]', { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  const toucher = async (sel) => { const l = pg.locator(sel).first(); if (!(await l.count())) return false; n++; await l.click().catch(() => {}); return true; };
  const oui = async () => { await pg.waitForTimeout(400); const ok = await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Oui, retirer'); if (b) b.click(); return !!b; }); if (ok) n++; return ok; };
  const shot = async (quoi) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `rx-${quoi}-${nom}.png`) }); };

  const m0 = await MESURE(pg, tel);
  await shot('journee');
  dit(!!m0.bloc, 'T1', `${T} « À retirer ailleurs » est sur Ma journée`, JSON.stringify(m0).slice(0, 300));
  dit(!m0.debord && !m0.petits.length && !m0.rouges.length, 'T0', `${T} aucun débordement, 44 px, aucun rouge`, JSON.stringify({ d: m0.debord, p: m0.petits, r: m0.rouges }));
  dit(!m0.illisibles.length, 'T0', `${T} chaque lien et bouton du bloc se lit (contraste ≥ 3)`, JSON.stringify(m0.illisibles));
  if (!m0.bloc) { dit(!o.journal.erreurs.length, 'T0', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ ')); await o.ctx.close(); return; }
  dit(m0.chiffreTop == null || m0.bloc.top < m0.chiffreTop, 'T1', `${T} EN TÊTE : au-dessus du chiffre du jour`, JSON.stringify({ bloc: m0.bloc.top, chiffre: m0.chiffreTop }));
  dit(m0.bloc.articles.length === 1 && m0.bloc.articles[0].n === '42' && m0.bloc.articles[0].plaque, 'T2', `${T} une seule paire, la N°42 (plaque), jamais les N°43/44 au même titre`, JSON.stringify(m0.bloc.articles.map((a) => a.n)));
  if (scenario !== 'douteuse') dit(!m0.doublons.length, 'T1', `${T} UN endroit : la coque ne redit pas « à retirer de Leboncoin / d’eBay »`, JSON.stringify(m0.doublons));
  const lb = site(m0, 'Leboncoin'), eb = site(m0, 'eBay'), vc = site(m0, 'Vestiaire');
  dit(!!lb && !!eb && !!vc && [lb, eb, vc].every((s) => s.marque), 'T2', `${T} Leboncoin, eBay, Vestiaire : chacun avec sa marque`, JSON.stringify(m0.bloc.articles));

  if (scenario === 'douteuse') {
    const a = m0.bloc.articles[0];
    dit(a.douteuse && /Peut-être vendue sur Vinted/.test(m0.bloc.texte), 'T6', `${T} « Peut-être vendue sur Vinted »`, m0.bloc.texte);
    dit(a.sites.every((s) => s.etat === 'verifier' && !s.gestes.some((g) => g === 'lbc' || g === 'ebay' || g === 'marquer')) && /pas prouvée/.test(m0.bloc.texte), 'T6', `${T} chaque site « à vérifier » (vente pas prouvée), AUCUN geste de retrait`, JSON.stringify(a.sites));
    dit(m0.bloc.tout === '0' && !(await pg.locator('[data-rx-tout]').count()), 'T6', `${T} pas de « Tout retirer »`);
    await pg.waitForTimeout(500);
    dit(!(await pg.evaluate(() => window.__cmds.filter((x) => /lbcSupprime/.test(x)).length)) && !ebay.length, 'T6', `${T} rien n’est parti`);
  }
  if (scenario === 'plein') {
    dit(lb.etat === 'aRetirer' && lb.gestes.join() === 'lbc' && eb.etat === 'aRetirer' && eb.gestes.join() === 'ebay' && vc.etat === 'main' && vc.gestes.includes('marquer'), 'T2', `${T} UN geste par site : « Retirer de Leboncoin », « Retirer d’eBay », Vestiaire « C’est retiré »`, JSON.stringify([lb, eb, vc]));
    // Leboncoin : une confirmation (la seule), une commande.
    await toucher('[data-rx-geste="lbc"]');
    const d1 = await dialogue(pg);
    await shot('confirmation');
    dit(!!d1 && /N°42/.test(d1) && /Leboncoin/.test(d1) && !/eBay/.test(d1), 'T3', `${T} la confirmation nomme la N°42 et Leboncoin seulement`, d1);
    await oui();
    await pg.waitForSelector('[data-rx-plateforme="Leboncoin"][data-rx-etat="retire"]', { timeout: 15000 }).catch(() => {});
    const c1 = await pg.evaluate(() => window.__cmds.filter((x) => /lbcSupprime/.test(x)));
    dit(c1.length === 1 && c1[0] === JSON.stringify({ cmd: 'lbcSupprime', id: ID_LBC, confirme: true }), 'T3', `${T} UNE commande Leboncoin, l’identifiant de la N°42`, JSON.stringify(c1));
    await shot('apres-lbc');
    // eBay.
    await toucher('[data-rx-geste="ebay"]');
    await oui();
    await pg.waitForSelector('[data-rx-plateforme="eBay"][data-ra-statut="relu"]', { timeout: 15000 }).catch(() => {});
    dit(ebay.length === 1 && ebay[0].itemId === ID_EBAY && ebay[0].confirme === true && ebay[0].auto === undefined, 'T3', `${T} UN retrait eBay : la N°42, confirmé, jamais « auto »`, JSON.stringify(ebay));
    // Vestiaire : « C'est retiré », sans confirmation.
    await toucher('[data-rx-marquer]');
    await pg.waitForTimeout(600);
    dit(!(await dialogue(pg)), 'T3', `${T} « C’est retiré » : aucune confirmation (son clic suffit)`);
    const m1 = await MESURE(pg, tel);
    await shot('fini');
    const lb1 = site(m1, 'Leboncoin'), eb1 = site(m1, 'eBay'), vc1 = site(m1, 'Vestiaire');
    dit(!!lb1 && lb1.etat === 'retire' && /Leboncoin a dit oui/.test(lb1.t), 'T3', `${T} Leboncoin « Retirée · Leboncoin a dit oui » (la relecture le confirmera)`, JSON.stringify(lb1));
    dit(!!eb1 && eb1.statut === 'relu' && /relu/.test(eb1.t), 'T3', `${T} eBay « Retirée ✓ · relu »`, JSON.stringify(eb1));
    dit(!!vc1 && vc1.etat === 'note' && !vc1.gestes.includes('marquer'), 'T3', `${T} Vestiaire « notée retirée par toi »`, JSON.stringify(vc1));
    dit(!m1.doublons.length, 'T1', `${T} après les retraits : la coque ne redit toujours rien à côté`, JSON.stringify(m1.doublons));
    dit(!m1.debord && !m1.petits.length && !m1.rouges.length, 'T0', `${T} après : aucun débordement, 44 px, aucun rouge`, JSON.stringify({ d: m1.debord, p: m1.petits, r: m1.rouges }));
    touchers[`plein ${W}`] = n;
    dit(n === 5, 'T3', `${T} 5 touchers pour les trois sites (Leboncoin 2, eBay 2, Vestiaire 1), sans quitter Ma journée`, String(n));
  }
  if (scenario === 'serie') {
    dit(m0.bloc.tout === '2', 'T4', `${T} « Tout retirer (2) » (Leboncoin et eBay)`, m0.bloc.tout);
    await toucher('[data-rx-tout]');
    const d1 = await dialogue(pg);
    dit(!!d1 && /Leboncoin/.test(d1) && /eBay/.test(d1), 'T4', `${T} UNE confirmation pour la série (chaque site nommé)`, d1);
    await oui();
    const vuPendant = await pg.waitForSelector('[data-acc-pendant="annonce.retirer"]', { timeout: 4000 }).then(() => true).catch(() => false);
    await shot('serie-pendant');
    dit(vuPendant, 'T4', `${T} la progression est dite pendant (« 1 / 2 », « Tout arrêter »)`);
    await pg.waitForSelector('[data-rx-plateforme="eBay"][data-rx-etat="retire"]', { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    const c1 = await pg.evaluate(() => window.__cmds.filter((x) => /lbcSupprime/.test(x)));
    dit(c1.length === 1 && ebay.length === 1, 'T4', `${T} deux envois, un par site`, JSON.stringify({ c1, ebay }));
    const m1 = await MESURE(pg, tel);
    await shot('serie-fini');
    dit(['Leboncoin', 'eBay'].every((p) => { const s = site(m1, p); return s && s.etat === 'retire'; }), 'T4', `${T} les deux « Retirées »`, JSON.stringify(m1.bloc && m1.bloc.articles));
    touchers[`serie ${W}`] = n;
    dit(n === 2, 'T4', `${T} 2 touchers pour Leboncoin + eBay`, String(n));
  }
  if (scenario === 'onglet') {
    await toucher('[data-rx-geste="lbc"]');
    await oui();
    await pg.waitForSelector('[data-rx-plateforme="Leboncoin"][data-rx-etat="onglet"]', { timeout: 10000 }).catch(() => {});
    const m1 = await MESURE(pg, tel);
    await shot('onglet');
    const l1 = site(m1, 'Leboncoin');
    dit(!!l1 && l1.etat === 'onglet' && l1.gestes.includes('ouvrir-lbc') && /leboncoin\.fr/.test(l1.lien) && /reprend tout seul/.test(l1.t), 'T5', `${T} « Ouvre leboncoin.fr … VRM reprend tout seul », le lien`, JSON.stringify(l1));
    // Il ouvre leboncoin.fr ; l'extension le lit (`maj · lbc`) ; VRM reprend SEUL, sans redemander.
    await pg.waitForTimeout(15500);
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'lbc' } })));
    await pg.waitForTimeout(500);
    dit(!(await dialogue(pg)), 'T5', `${T} la reprise ne redemande pas de confirmation`);
    await pg.waitForSelector('[data-rx-plateforme="Leboncoin"][data-rx-etat="retire"]', { timeout: 15000 }).catch(() => {});
    const c = await pg.evaluate(() => window.__cmds.filter((x) => /lbcSupprime/.test(x)));
    const m2 = await MESURE(pg, tel);
    await shot('onglet-repris');
    dit(c.length === 2 && site(m2, 'Leboncoin') && site(m2, 'Leboncoin').etat === 'retire', 'T5', `${T} reprise seule : la suppression repart, « Retirée »`, JSON.stringify({ c, s: site(m2, 'Leboncoin') }));
    touchers[`onglet ${W}`] = n;
  }
  if (scenario === 'sansext') {
    dit(lb.etat === 'main' && lb.gestes.includes('marquer') && lb.gestes.includes('ouvrir') && /extension/i.test(lb.t), 'T2', `${T} sans extension : Leboncoin à la main (annonce + « C’est retiré »), la raison dite`, JSON.stringify(lb));
    await pg.locator('[data-rx-plateforme="Leboncoin"] [data-rx-marquer]').first().click().catch(() => {}); n++;
    await pg.waitForTimeout(600);
    const l1 = site(await MESURE(pg, tel), 'Leboncoin');
    await shot('sansext-note');
    dit(!!l1 && l1.etat === 'note' && !(await pg.evaluate(() => window.__cmds.filter((x) => /lbcSupprime/.test(x)).length)), 'T2', `${T} « C’est retiré » : notée, rien n’est envoyé`, JSON.stringify(l1));
  }
  dit(!o.journal.erreurs.length, 'T0', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const scenario of SCENARIOS) for (const W of LARGEURS) for (const th of THEMES) {
      // Un onglet de Chromium qui plante (mémoire du conteneur) est REJOUÉ une fois, puis dit — jamais tu.
      for (let essai = 1; essai <= 2; essai++) {
        try { await tournee(nav, { W, scenario, sombre: th === 'sombre' }); break; }
        catch (e) { if (essai === 2 || !/crash|closed/i.test(String(e && e.message))) { dit(false, 'T0', `[${scenario} ${W}px ${th}] la tournée a pu aller au bout`, String(e && e.stack).slice(0, 400)); break; } }
      }
    }
  } catch (e) { dit(false, 'T0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Touchers (après)');
  for (const [k, v] of Object.entries(touchers)) console.log(`   ${k} : ${v}`);
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ a-retirer-ailleurs : ${ko} défaut(s)` : '\n✅ a-retirer-ailleurs : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
