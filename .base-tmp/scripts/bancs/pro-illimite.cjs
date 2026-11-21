require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « PRO ILLIMITÉ » (10 nov., 20 h) — Julien : « on fait un nombre de comptes
//  de vente illimité » (annule « Pro = 10 comptes vendeurs », lot BO). Rendu réel
//  (dist/), données du mode exemple (Vinted 111 et 222) + SIX comptes Leboncoin
//  (lbcA 1 vente, lbcB 4 ventes, lbcC…lbcF), deux eBay, deux Vestiaire = 12 comptes —
//  tout inventé ; faux serveur (aucun Stripe réel) :
//    · Pro (réponse propre, ET réponse avec un reste du lot BO : `proLimite`,
//      `comptesPro` de 10, comptes vendeurs Solo posés) : les 5 ventes Leboncoin
//      sont dans la liste, aucun aperçu « hors offre », aucune ligne de coque,
//      aucune feuille « Quels 10 comptes vendent ? » ;
//    · Paramètres → Abonnement : aucune rangée « Tes 10 comptes vendeurs », l'offre
//      Pro dit « illimités » ; l'accueil (page des offres) aussi, sans « 10 comptes » ;
//    · 390 px tactile et 1512 px, clair et sombre : rien ne déborde.
//  `BANC_MUTATION=limite` : un compte Leboncoin seul vend en Pro (code servi) ⇒ DOIT être rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4574;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-pro-illimite');
const MUTATION = process.env.BANC_MUTATION || '';
fs.mkdirSync(CAPTURES, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const J = 864e5;
const PRIX = { montant: 16.99, devise: 'eur', intervalle: 'month' };
const ABO = { montant: 16.99, devise: 'eur', intervalle: 'month', texte: '16,99 € / mois' };
const cv111 = { uid: '111', le: new Date(Date.now() - 2 * J).toISOString(), prochainChangement: new Date(Date.now() + 28 * J).toISOString() };
const base = { ok: true, proprietaire: false, configure: true, modeTest: true, obligatoire: false, prix: PRIX, prixConforme: true, prixStripe: null, statut: 'active', finPeriode: new Date(Date.now() + 20 * J).toISOString(), annuleFinPeriode: false, peutGerer: true, actif: true, acces: true, lecture: true, lectureSeule: false, mentionsCompletes: true, essaiDispo: false, essaiJours: 7, prixAbonnement: ABO,
  offres: { solo: { texte: '16,99 € / mois', ouvert: true }, pro: { ouvert: false, texte: null } } };
const DIX = ['vinted:111', 'vinted:222', 'leboncoin:lbcA', 'leboncoin:lbcC', 'leboncoin:lbcD', 'leboncoin:lbcE', 'ebay:principal', 'ebay:0123456789abcdef', 'vestiaire:vcA', 'vestiaire:vcB'];
const liste = (l) => l.map((k) => ({ plateforme: k.split(':')[0], id: k.split(':').slice(1).join(':') }));
const proBase = { ...base, plan: 'pro', compteVendeur: null, comptesVendeurs: {}, prixAbonnement: { montant: 19.99, devise: 'eur', intervalle: 'month', texte: '19,99 € / mois' } };
const ETATS = {
  proPropre: proBase,
  // Ce qu'un serveur du lot BO (ou un cache) pouvait encore dire : rien ne doit brider.
  proReste: { ...proBase, compteVendeur: cv111, comptesVendeurs: { leboncoin: { id: 'lbcA' }, ebay: { id: 'principal' }, vestiaire: { id: 'vcA' }, pro: DIX }, proLimite: true, maxVendeursPro: 10,
    comptesPro: { liste: liste(DIX), le: new Date(Date.now() - 2 * J).toISOString(), prochainChangement: new Date(Date.now() + 28 * J).toISOString() } },
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, process.env.BANC_LONG ? 3000 : 160)); } };
let mutee = 0;
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  let corps = fs.readFileSync(p);
  // La mutation : en Pro, un seul compte Leboncoin (lbcA) vend — une limite réintroduite.
  if (MUTATION === 'limite' && /\.js$/.test(p)) {
    const t = corps.toString('utf8');
    const m = t.replace(/function (\w+)\((\w),(\w),(\w)\)\{if\(!\2\|\|\2\.plan!==/g, (x, f, a, b, c) => { mutee++; return `function ${f}(${a},${b},${c}){if(${a}&&${a}.plan==="pro"&&${b}==="leboncoin"&&String(${c}).replace(/^lbc-account:/,"")!=="lbcA")return!0;if(!${a}||${a}.plan!==`; });
    if (m !== t) corps = Buffer.from(m, 'utf8');
  }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(corps);
});

let EX = null;
async function exemple() {
  if (EX) return EX;
  const d = await import('file://' + path.join(__dirname, '..', '..', 'src', 'exempleDonnees.js'));
  const b = await import('file://' + path.join(__dirname, '..', '..', 'src', 'exempleBase.js'));
  const jeu = d.jeuExemple(Date.now());
  const iso = (j) => new Date(Date.now() - j * J).toISOString();
  const pose = (id, data) => { const l = jeu.lignes.find((x) => x.id === id); if (l) l.data = data; else jeu.lignes.push({ id, data }); };
  pose('lbc_accounts', { accounts: { lbcA: { id: 'lbcA', name: 'Ma boutique', sessionAt: iso(1) }, 'lbc-account:lbcB': { id: 'lbc-account:lbcB', name: 'Mes achats', sessionAt: iso(2) },
    lbcC: { id: 'lbcC', name: 'Boutique C', sessionAt: iso(3) }, lbcD: { id: 'lbcD', name: 'Boutique D', sessionAt: iso(3) }, lbcE: { id: 'lbcE', name: 'Boutique E', sessionAt: iso(3) }, lbcF: { id: 'lbcF', name: 'Boutique F', sessionAt: iso(3) } } });
  const lbc = (tx, titre, eur, compte, j) => ({ txId: tx, title: titre, isSeller: true, price: eur * 100, dateVente: iso(j), stepStatus: 'done', account: compte });
  pose('lbc_ventes', { maj: iso(0.1), ventes: {
    LA1: lbc('LA1', 'Asics Gel-Lyte III T42 (boutique)', 90, 'lbcA', 1),
    LB1: lbc('LB1', 'Nike Air Max 90 T41 (achats)', 70, 'lbc-account:lbcB', 2),
    LB2: lbc('LB2', 'New Balance 550 T40 (achats)', 80, 'lbcB', 3),
    LB3: lbc('LB3', 'Puma Suede T43 (achats)', 45, 'lbcB', 4),
    LB4: lbc('LB4', 'Vans Old Skool T39 (achats)', 35, 'lbcB', 5),
  } });
  pose('vc_session', { id: 'vcA', at: iso(0.5), comptes: { vcA: iso(0.5), vcB: iso(3) } });
  pose('vc_listings', { capturedAt: iso(0.5), liens: {} });
  const vc = (titre, eur, compte, j) => ({ titre, date: iso(j), compte, etat: 'Vendu', montant: { valeur: eur, cle: 'payout', devise: 'EUR' } });
  pose('vc_ventes', { capturedAt: iso(0.5), ventes: { VA: vc('Jordan 1 Mid T44 (vc boutique)', 120, 'vcA', 1), VB: vc('Yeezy 350 T42 (vc achats)', 210, 'vcB', 2) } });
  // La configuration de départ déjà faite (sinon son plein écran couvre la coque, src/configurationDepart.js).
  const main = jeu.lignes.find((x) => x.id === 'main'); main.data = { ...main.data, vrm_configuration: { etat: 'fait', at: iso(1), statut: null, version: 1 } };
  pose('ebay_comptes', { comptes: [{ principal: true, pseudo: 'ebay_vend' }, { cle: '0123456789abcdef', pseudo: 'ebay_achete' }] });
  EX = { uid: d.UID_EXEMPLE, servir: b.servirTable, base: { lignes: jeu.lignes }, comptes: { lignes: jeu.comptes } };
  return EX;
}
async function ouvrir(nav, { abo, tab = 'ventes', largeur = 1512, sombre = false, vue = 'abonnement' }) {
  const ex = await exemple();
  const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: ex.uid, email: 'vendeuse@exemple.test' } };
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(({ s, vue, sombre }) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); if (vue) localStorage.setItem('vrm_reglages_vue', vue); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); } catch (_) {} }, { s: SESSION, vue, sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = r.request().url(), m = r.request().method();
    if (/\/rpc\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    const url = new URL(u), table = url.pathname.slice('/rest/v1/'.length).split('/')[0];
    const t = table === 'app_data' ? ex.base : table === 'vinted_accounts' ? ex.comptes : { lignes: [] };
    const x = ex.servir(t, { methode: m, url: url.pathname + url.search, entetes: r.request().headers(), corps: r.request().postData(), owner: ex.uid });
    return r.fulfill({ status: x.status, headers: x.headers, body: x.status === 204 || x.body == null ? '' : (typeof x.body === 'string' ? x.body : JSON.stringify(x.body)) });
  });
  const etat = { abo: JSON.parse(JSON.stringify(abo)) }, appels = [];
  await pg.route('**/api/**', (r) => {
    const u = r.request().url(), m = r.request().method();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(etat.abo) });
    if (/mode=compte-vendeur/.test(u)) {
      const c = JSON.parse(r.request().postData() || '{}'); appels.push({ mode: 'compte-vendeur', m, ...c });
      if (c.plateforme === 'pro') return r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ erreur: 'pro-illimite', message: 'En Pro, tous tes comptes vendent : rien à choisir.' }) });
      if (c.plateforme && c.plateforme !== 'vinted') {
        const cvs = { ...(etat.abo.comptesVendeurs || {}), [c.plateforme]: { id: String(c.id), le: new Date().toISOString(), prochainChangement: new Date(Date.now() + 30 * J).toISOString() } };
        etat.abo = { ...etat.abo, comptesVendeurs: cvs };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, comptesVendeurs: cvs }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, compteVendeur: cv111 }) });
    }
    if (/mode=factures/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"carte":null,"factures":[]}' });
    if (/mode=parrainage/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"installe":true,"ouvert":false}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  // Ventes : attendre que la liste « Tous » soit RENDUE (jamais un délai seul), puis l'aperçu s'il y en a un.
  if (tab === 'ventes') { await pg.waitForSelector('[data-toutes-vente="leboncoin"][data-toutes-id]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(300); }
  return { ctx, pg, erreurs, appels, etat };
}
const lireVentes = (pg) => pg.evaluate(() => {
  const ids = (site) => [...document.querySelectorAll(`[data-toutes-vente="${site}"][data-toutes-id]`)].map((e) => e.getAttribute('data-toutes-id'));
  const h = document.querySelector('[data-ventes-autres-hors-plan]');
  const b = h ? h.querySelector('[data-hors-plan-site="leboncoin"]') : null;
  let bloc = null;
  if (b) {
    const lignes = [...b.querySelectorAll('.vrm-plan-ligne')];
    const fl = lignes.filter((l) => l.hasAttribute('data-apercu-floute'));
    bloc = { compte: b.getAttribute('data-hors-plan-compte'), n: b.getAttribute('data-hors-plan-n'), nettes: lignes.slice(0, 3).filter((l) => !l.hasAttribute('data-apercu-floute')).length,
      floutees: fl.length, inertes: fl.every((l) => l.hasAttribute('inert')), choisir: !!b.querySelector('[data-choisir-pro]'), passerPro: !!b.querySelector('[data-passer-pro]'), phrase: (b.innerText || b.textContent).slice(0, 400) };
  }
  const band = document.querySelector('[data-bandeau-plateforme]');
  const texte = document.body.innerText || '';
  return { lbc: ids('leboncoin'), bloc, horsPlan: !!h, bandeau: !!band, bandeauTexte: band ? band.innerText : '', feuille: !!document.querySelector('[data-quels-comptes-pro]'),
    dix: /10 comptes vendeurs|10 comptes vendent|hors de tes 10/.test(texte), deborde: document.documentElement.scrollWidth - window.innerWidth };
});
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }).catch(() => {});

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    if (MUTATION) console.log(`\n⚠️  MUTATION « ${MUTATION} » : ce banc DOIT être rouge`);
    console.log('\n── Pro, 12 comptes : tous vendent, rien à choisir');
    for (const [etat, largeur, sombre] of [['proPropre', 390, false], ['proPropre', 1512, true], ['proReste', 390, true], ['proReste', 1512, false]]) {
      await essaie(`ventes ${etat} ${largeur}`, async () => {
        const { ctx, pg, appels, erreurs } = await ouvrir(nav, { abo: ETATS[etat], largeur, sombre });
        const nom = `${etat} ${largeur}${sombre ? ' sombre' : ''}`;
        const v = await lireVentes(pg);
        dit(v.lbc.length === 5 && !v.horsPlan && erreurs.length === 0, `${nom} : les 5 ventes Leboncoin (6 comptes) dans la liste, aucun aperçu « hors offre »`, JSON.stringify({ lbc: v.lbc, h: v.horsPlan, e: erreurs }));
        dit(!v.bandeau && !v.feuille && !v.dix && appels.length === 0, '  aucune ligne de coque, aucune feuille, aucun « 10 comptes », rien envoyé', JSON.stringify({ b: v.bandeauTexte, f: v.feuille, dix: v.dix, a: appels.length }));
        dit(v.deborde <= 0, '  rien ne déborde', String(v.deborde));
        await capture(pg, `ventes-${etat}-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
    console.log('\n── Paramètres → Abonnement');
    for (const [etat, largeur, sombre] of [['proReste', 1512, false], ['proPropre', 390, true], ['proReste', 390, false]]) {
      await essaie(`reglages ${largeur}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { abo: ETATS[etat], tab: 'settings', largeur, sombre });
        await pg.waitForSelector('[data-offres]', { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const o = await pg.evaluate(() => ({ rangee: !!document.querySelector('[data-comptes-pro], [data-rangee-compte-vendeur="pro"]'), offre: (document.querySelector('[data-offre="pro"] .vrm-plan-phrase') || {}).innerText || '',
          dix: /10 comptes vendeurs|10 comptes vendent/.test(document.body.innerText || ''), deborde: document.documentElement.scrollWidth - window.innerWidth }));
        dit(!o.rangee && /illimités/.test(o.offre) && !o.dix && o.deborde <= 0 && erreurs.length === 0, `${etat} ${largeur}${sombre ? ' sombre' : ''} : aucune rangée « Tes 10 comptes vendeurs », l’offre Pro dit « illimités »`, JSON.stringify(o));
        await pg.locator('[data-offre="pro"]').first().scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `reglages-${etat}-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
    console.log('\n── Accueil (page des offres)');
    for (const [largeur, sombre] of [[390, false], [1512, true]]) {
      await essaie(`accueil ${largeur}`, async () => {
        const mobile = largeur < 600;
        const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', serviceWorkers: 'block' });
        await ctx.route(/supabase\.co|\/api\//, (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => rt.abort());
        const pg = await ctx.newPage();
        await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-offre-phrase="pro"]', { timeout: 15000 }).catch(() => {});
        const a = await pg.evaluate(() => ({ phrase: (document.querySelector('[data-offre-phrase="pro"]') || {}).innerText || '', faq: /avec Pro, tous tes comptes vendent, sans limite/.test(document.body.innerText || ''),
          dix: /10 comptes vendeurs|10 comptes vendent/.test(document.body.innerText || ''), deborde: document.documentElement.scrollWidth - window.innerWidth }));
        dit(/illimités/.test(a.phrase) && a.faq && !a.dix && a.deborde <= 0, `accueil ${largeur}${sombre ? ' sombre' : ''} : l’offre Pro et la FAQ disent « tous tes comptes, sans limite »`, JSON.stringify(a));
        await pg.locator('[data-offre-phrase="pro"]').scrollIntoViewIfNeeded().catch(() => {});
        await pg.waitForTimeout(1200);
        await capture(pg, `accueil-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
    if (MUTATION === 'limite') console.log(`  (mutation appliquée ${mutee} fois dans le code servi)`);
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 160)); }
  finally {
    await nav.close(); srv.close();
    console.log(`\n  captures : ${CAPTURES}`);
    console.log(ko ? `\n❌ pro-illimite (rendu) : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ pro-illimite (rendu) : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
