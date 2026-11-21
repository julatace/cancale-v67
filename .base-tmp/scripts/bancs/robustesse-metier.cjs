require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « ROBUSTESSE MÉTIER » (11 nov., second agent) — les trois écrans touchés
//  par `claude/agent2-robustesse-metier`, RENDUS. 390 px tactile ET 1512 px, clair
//  ET sombre. Données INVENTÉES (le jeu de `nouveau-vendeur.cjs`, dépôt public).
//   I. Inventaire → « Mettre à jour les ventes » : 50 paires au MÊME titre, une
//      vente sans identité ⇒ AUCUNE paire touchée, une proposition (« C'est la
//      N°… » × 49) ; SON clic sur « N°17 » relie CETTE paire (vendue, transaction
//      posée) ; une vente portant la transaction déjà posée sur la N°50 la passe
//      « vendue » sans rien demander.
//      ⚠️ (11 nov.) L'écran Inventaire n'est joignable par AUCUN chemin (lot DJ4 l'a
//      retiré du menu ; `inventory` n'est pas dans ONGLETS_LIENS) : `?tab=inventory`
//      ouvre Ma journée. La partie I constate donc d'abord que l'écran n'est pas
//      monté et s'arrête (la règle est jugée par audit-robustesse-metier A1-A7) ;
//      si l'écran revient un jour, elle joue tout le parcours.
//   V. Ventes saisies (Compta) : un achat inconnu s'écrit « — » (jamais un
//      bénéfice = prix de vente) ; « Bénéf. » dit « sur 1 vente sur 2 » ; aucun
//      bénéfice en rouge.
//   A. Messages → « Accepter » : la paire (N°2) vendue sur Leboncoin (lien posé) ⇒
//      le message « Déjà vendue sur un autre site », AUCUNE confirmation, rien
//      envoyé ; Leboncoin pas relu (500) ⇒ la confirmation DIT « VRM n'a pas pu
//      vérifier tes autres sites » ; rien ne part sans son clic.
//   F. aucun débordement horizontal, aucune erreur de page, 44 px au doigt.
//  §6.1 : sur origin/main (7b54b0dc5, build à part, BANC_DIST) : V1, V2, V3, A1, A2 rouges.
//  Captures : SHOTS (défaut /tmp/banc-robustesse-metier) — à REGARDER (§6.2).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-robustesse-metier');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const PARTIES = liste('PARTIES', 'I,V,A');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.339.0';
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.__envois = [];
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'vendeuse_a' }, cmds: {} } });
    if (d.__vmr === 'exec') {
      if (d.method !== 'GET') window.__envois.push({ method: d.method, endpoint: d.endpoint });
      post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: d.method === 'GET' ? { conversation: o.fil } : {} });
    }
    if (d.__vmr === 'cmd') { window.__envois.push({ cmd: d.cmd }); post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { ok: false } }); }
  });
  post({ __vmr: 'ready', version: o.version });
};
const TITRE = 'Nike Air Max 90 blanche taille 42';
const FIL = { id: 301, opposite_user: { id: 9301, login: 'acheteuse_x' }, transaction: { id: 70301, item_id: 51001, status: 1, current_user_side: 'seller', item_title: 'Adidas Samba OG noire taille 39' },
  messages: [{ id: 1, entity_type: 'offer_request_message', created_at_ts: new Date(Date.now() - 600000).toISOString(), entity: { id: 1, user_id: 9301, current: true, status: 10, status_title: '', price: { amount: '48.0', currency_code: 'EUR' }, transaction_id: 70301, offer_request_id: 88 } }] };

const debord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

(async () => {
  const NV = require('./nouveau-vendeur.cjs');
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const tag = `${W}-${theme}`, sombre = theme === 'sombre';
      // ── I. Inventaire ─────────────────────────────────────────────────────
      if (PARTIES.includes('I')) partieI: {
        const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
        const main = lignes.find((l) => l.id === 'main').data;
        main.vinted_inventory = Array.from({ length: 50 }, (_, i) => ({ id: 'p' + (i + 1), numero: String(i + 1), title: TITRE, status: 'online', vintedItemId: String(80000 + i + 1), vintedAccountId: '111', price: 60, photo: null, soldAt: null, transactionId: i === 49 ? '99050' : null, createdAt: '01/11/2026' }));
        const ventes = lignes.find((l) => l.id === 'harvest_111_orders_sold');
        ventes.data.payload.my_orders.push(
          { transaction_id: 99001, title: TITRE, price: { amount: '60.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: new Date().toISOString() },
          { transaction_id: 99050, title: TITRE, price: { amount: '58.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: new Date().toISOString() });
        const base = { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
        const { ctx, pg, journal, tel } = await NV.ouvrir(nav, { W, sombre, base, tab: 'inventory' });
        try {
          const monte = await pg.waitForFunction(() => /Mettre à jour les ventes/.test(document.body.innerText), null, { timeout: 15000 }).then(() => true, () => false);
          if (!monte) { console.log(`--  I ${tag} : l'écran Inventaire n'est monté par aucun chemin (\`?tab=inventory\` ⇒ Ma journée) : rien à rendre, règle jugée par l'audit`); await ctx.close(); break partieI; }
          await pg.getByRole('button', { name: /Mettre à jour les ventes/ }).first().click();
          await pg.waitForSelector('[data-inv-propositions]', { timeout: 15000 }).catch(() => {});
          await attendre(500);
          const inv = () => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_inventory')); } catch (_) { return null; } });
          const avant = await inv();
          const vendues = (avant || []).filter((p) => p.status === 'sold').map((p) => p.numero);
          dit(Array.isArray(avant) && avant.length === 50 && vendues.length === 1 && vendues[0] === '50', `I1 ${tag} : 50 paires au même titre ⇒ seule la N°50 (transaction déjà posée) passe vendue, aucune autre sans son clic`, vendues);
          const props = await pg.evaluate(() => { const e = document.querySelector('[data-inv-propositions]'); return e ? { n: e.getAttribute('data-inv-propositions'), boutons: e.querySelectorAll('[data-inv-relier]').length, txt: e.innerText.slice(0, 120), h: Math.min(...[...e.querySelectorAll('[data-inv-relier]')].map((b) => b.getBoundingClientRect().height)) } : null; });
          dit(props && props.n === '1' && props.boutons === 49 && props.h >= 44, `I2 ${tag} : UNE proposition (vente 99001), 49 paires candidates (la N°50 est vendue), boutons ≥ 44 px`, props);
          await pg.screenshot({ path: path.join(SHOTS, `inv-${tag}-1-proposition.png`) });
          await pg.locator('[data-inv-relier="p17"]').scrollIntoViewIfNeeded();
          await pg.locator('[data-inv-relier="p17"]').click();
          await attendre(400);
          const apres = await inv();
          const p17 = (apres || []).find((p) => p.id === 'p17');
          const autres = (apres || []).filter((p) => p.status === 'sold').map((p) => p.numero).sort();
          dit(p17 && p17.status === 'sold' && p17.transactionId === '99001' && JSON.stringify(autres) === '["17","50"]', `I3 ${tag} : SON clic relie CETTE paire (N°17, transaction 99001), rien d'autre`, { p17, autres });
          dit(await pg.locator('[data-inv-propositions]').count() === 0, `I4 ${tag} : la proposition reliée disparaît`);
          dit(await debord(pg) <= 1 && journal.erreurs.length === 0, `F ${tag} inventaire : aucun débordement, aucune erreur`, { d: await debord(pg), e: journal.erreurs });
          await pg.evaluate(() => window.scrollTo(0, 0)); await pg.screenshot({ path: path.join(SHOTS, `inv-${tag}-2-relie.png`) });
        } catch (e) { dit(false, `I ${tag} : le parcours`, e.message.split('\n')[0]); await pg.screenshot({ path: path.join(SHOTS, `inv-${tag}-ko.png`) }).catch(() => {}); }
        await ctx.close();
      }
      // ── V. Ventes saisies (Compta) ────────────────────────────────────────
      if (PARTIES.includes('V')) {
        const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
        const main = lignes.find((l) => l.id === 'main').data;
        const d = new Date(), jj = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0'), aaaa = d.getFullYear();
        const recu = `${jj}/${mm}/${aaaa}`;
        main.vinted_catalog = [{ id: '801', name: 'Nike Air Max 90', buyPrice: 20, status: 'vendu' }];
        main.vinted_sales = [
          { id: 's1', productId: '801', saleDate: `${aaaa}-${mm}-${jj}`, receiveDate: recu, sellPrice: 50, buyPrice: 20, profit: 30, multi: 2.5 },
          { id: 's2', productId: '999', saleDate: `${aaaa}-${mm}-${jj}`, receiveDate: recu, sellPrice: 40, buyPrice: null, profit: null, multi: null },
          { id: 's3', productId: '802', saleDate: `${aaaa}-${mm}-${jj}`, receiveDate: '01/01/2020', sellPrice: 10, buyPrice: 25, profit: -15, multi: 0.4 },
        ];
        const base = { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
        const { ctx, pg, journal } = await NV.ouvrir(nav, { W, sombre, base, tab: 'sales' });
        try {
          await pg.waitForSelector('[data-ventes-man-total]', { timeout: 15000 }).catch(() => {});
          await attendre(400);
          const r = await pg.evaluate(() => {
            const t = document.querySelector('[data-ventes-man-total]'), m = document.querySelector('[data-ventes-man-benef]');
            const lignes = [...document.querySelectorAll('[data-ventes-man-ligne]')].map((e) => ({ v: e.getAttribute('data-ventes-man-ligne'), t: e.innerText.trim(), c: getComputedStyle(e).color }));
            return { total: t && t.getAttribute('data-ventes-man-total'), totalTxt: t && t.parentElement.innerText, mois: m && m.getAttribute('data-ventes-man-benef'), moisTxt: m && m.parentElement.innerText, lignes };
          });
          const vide = r.lignes.find((l) => l.v === '');
          dit(vide && vide.t === '—', `V1 ${tag} : l'achat inconnu s'écrit « — » (jamais 40 € de bénéfice)`, r.lignes);
          dit(r.total === '15' && /sur 2 ventes sur 3/.test(r.totalTxt || '') && r.mois === '30' && /sur 1 vente sur 2/.test(r.moisTxt || ''), `V2 ${tag} : « Bénéf. » somme les ventes au coût connu et dit la couverture`, r);
          const rouge = r.lignes.filter((l) => /rgb\((2[0-5]\d|1[5-9]\d), (\d{1,2}), (\d{1,2})\)/.test(l.c) && l.v !== '' && Number(l.v) < 0);
          dit(r.lignes.length === 3 && rouge.length === 0, `V3 ${tag} : un bénéfice négatif n'est pas rouge (§7)`, r.lignes);
          dit(await debord(pg) <= 1 && journal.erreurs.length === 0, `F ${tag} ventes saisies : aucun débordement, aucune erreur`, { d: await debord(pg), e: journal.erreurs });
          await pg.screenshot({ path: path.join(SHOTS, `ventes-${tag}.png`) });
        } catch (e) { dit(false, `V ${tag} : le parcours`, e.message.split('\n')[0]); }
        await ctx.close();
      }
      // ── A. Accepter une offre à la main ───────────────────────────────────
      if (PARTIES.includes('A')) for (const cas of ['vendue', 'passu']) {
        const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
        const main = lignes.find((l) => l.id === 'main').data;
        main.vinted_offres_auto = true;   // l'app publie aussi la garde : le banc la lit pour dire POURQUOI
        main.vrm_lbc_liens = { lbc_2: '2' };
        lignes.find((l) => l.id === 'lbc_ventes').data.ventes = { lbc_2: { id: 'lbc_2', itemId: 'lbc_2', isSeller: true, subject: 'Adidas Samba OG noire', price: 55, status: 'paid', dateVente: new Date().toISOString() } };
        lignes.find((l) => l.id === 'harvest_111_inbox').data.payload.conversations.unshift({ id: 301, unread: true, updated_at: new Date().toISOString(), description: 'Offre 48 €', opposite_user: { id: 9301, login: 'acheteuse_x' } });
        lignes.push({ id: 'harvest_111_conv_301', data: { capturedAt: new Date().toISOString(), payload: { conversation: FIL } } });
        const base = { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
        const { ctx, pg, journal } = await NV.ouvrir(nav, { W, sombre, base, tab: 'cat_msg' });
        if (cas === 'passu') await pg.route(/id=in\.\(lbc_listings/, (r) => r.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne"}' }));
        await pg.addInitScript(PONT, { version: VERSION, fil: FIL });
        await pg.reload({ waitUntil: 'domcontentloaded' });
        try {
          await pg.waitForSelector('[data-conv="301"]', { timeout: 20000 });
          await attendre(2500);
          await pg.click('[data-conv="301"]');
          await pg.waitForSelector('[data-offre-geste="accepter"]', { timeout: 15000 });
          await attendre(1500);
          await pg.waitForFunction(() => !!localStorage.getItem('vinted_offres_garde'), null, { timeout: 12000 }).catch(() => {});
          const garde = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_offres_garde')); } catch (_) { return null; } });
          await pg.click('[data-offre-geste="accepter"]');
          await attendre(1800);
          const dlg = await pg.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].map((x) => x.innerText.replace(/\s+/g, ' ')).filter((t) => /^\s*Accepter \d/.test(t)).pop(); return d || null; });   // la CONFIRMATION (pas le volet du fil)
          const msg = await pg.evaluate(() => [...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText).join(' | ') || null);
          const envois = await pg.evaluate(() => window.__envois || []);
          await pg.screenshot({ path: path.join(SHOTS, `accepter-${cas}-${tag}.png`) });
          if (cas === 'vendue') {
            dit(!dlg && /Déjà vendue sur un autre site/.test(msg || '') && envois.length === 0, `A1 ${tag} : N°2 vendue sur Leboncoin ⇒ « Déjà vendue sur un autre site », aucune confirmation, rien envoyé`, { msg, dlg, envois, garde: garde && { complet: garde.complet, manques: garde.manques, items: garde.items } });
          } else {
            dit(dlg && /n['’]a pas pu vérifier tes autres sites/.test(dlg) && envois.length === 0, `A2 ${tag} : Leboncoin pas relu ⇒ la confirmation le DIT, rien n'est parti`, { dlg, msg, envois });
            if (dlg) { await pg.keyboard.press('Escape'); await attendre(400); }
            dit((await pg.evaluate(() => window.__envois || [])).length === 0, `A3 ${tag} : « Annuler » ⇒ rien n'est parti`);
          }
          dit(await debord(pg) <= 1 && journal.erreurs.length === 0, `F ${tag} messages (${cas}) : aucun débordement, aucune erreur`, { d: await debord(pg), e: journal.erreurs });
        } catch (e) { dit(false, `A ${tag} (${cas}) : le parcours`, e.message.split('\n')[0]); await pg.screenshot({ path: path.join(SHOTS, `accepter-${cas}-${tag}-ko.png`) }).catch(() => {}); }
        await ctx.close();
      }
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\nKO  ${ko} rouge(s) — captures : ${SHOTS}` : `\nOK  tout est vert — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
