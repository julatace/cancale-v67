require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « PRO = 10 COMPTES VENDEURS » (10 nov.) — Julien : « 19,99 pour 10 comptes
//  vendeurs ». Rendu réel (dist/), données du mode exemple (Vinted 111 et 222) +
//  SIX comptes Leboncoin (lbcA 1 vente, lbcB 4 ventes, lbcC…lbcF), deux eBay, deux
//  Vestiaire = 12 comptes — tout inventé ; faux serveur (aucun Stripe réel) :
//    · Pro, rien choisi : TOUT compte (5 ventes Leboncoin) ; la coque demande « choisis
//      tes 10 comptes vendeurs » ; la feuille « Quels 10 comptes vendent ? » : 12 cases,
//      rien coché ni envoyé, la 11e refusée ; son clic part UNE fois `{ plateforme:
//      'pro', comptes }` (10), puis lbcB sort de la liste et passe en aperçu ;
//    · Pro, 10 choisis : lbcB en aperçu (« hors de tes 10 comptes vendeurs »), 3 nettes,
//      la 4e floutée et `inert`, le geste ouvre la feuille (pas « Passe à Pro ») ;
//      plus aucune ligne de coque (liste pleine) ;
//    · Pro d'avant le 10 nov. : rien demandé, tout compte ;
//    · Paramètres → Abonnement : « Tes 10 comptes vendeurs · 10 / 10 », ouvre la feuille ;
//    · 390 px tactile et 1512 px, clair et sombre : rien ne déborde, cibles 44 px.
//  `BANC_MUTATION=pro` : la liste Pro neutralisée dans le code servi ⇒ DOIT être rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4573;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-pro-10-comptes');
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
const proBase = { ...base, plan: 'pro', compteVendeur: null, comptesVendeurs: {}, proLimite: true, maxVendeursPro: 10, prixAbonnement: { montant: 19.99, devise: 'eur', intervalle: 'month', texte: '19,99 € / mois' } };
const ETATS = {
  proSans: { ...proBase, comptesPro: null },
  proChoisi: { ...proBase, comptesPro: { liste: liste(DIX), le: new Date(Date.now() - 2 * J).toISOString(), prochainChangement: new Date(Date.now() + 28 * J).toISOString() } },
  proAncien: { ...proBase, proLimite: false, comptesPro: null },
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
  // La mutation : `venteAutreHorsPlan` ne dit plus jamais « hors offre ».
  if (MUTATION === 'pro' && /\.js$/.test(p)) {
    const t = corps.toString('utf8');
    const m = t.replace(/return!!(\w+)&&!(\w+)\.pro\.includes\(\1\)/g, () => { mutee++; return 'return!1'; });
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
      if (c.plateforme === 'pro') {
        const comptesPro = { liste: c.comptes, le: new Date().toISOString(), prochainChangement: new Date(Date.now() + 30 * J).toISOString() };
        etat.abo = { ...etat.abo, comptesPro };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, comptesPro }) });
      }
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
  if (tab === 'ventes') { await pg.waitForSelector('[data-toutes-vente="leboncoin"][data-toutes-id]', { timeout: 20000 }).catch(() => {}); if (abo.comptesPro) await pg.waitForSelector('[data-ventes-autres-hors-plan]', { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(300); }
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
  const band = document.querySelector('[data-bandeau-plateforme="pro"]');
  return { lbc: ids('leboncoin'), bloc, bandeau: !!band, bandeauTexte: band ? band.innerText : '', deborde: document.documentElement.scrollWidth - window.innerWidth };
});
const lireFeuille = (pg) => pg.evaluate(() => {
  const d = document.querySelector('[data-quels-comptes-pro]'); if (!d) return null;
  const r = d.getBoundingClientRect();
  const cases = [...d.querySelectorAll('[data-compte-pro]')];
  return { n: cases.length, cles: cases.map((c) => c.getAttribute('data-compte-pro')), coches: cases.filter((c) => c.getAttribute('aria-checked') === 'true').map((c) => c.getAttribute('data-compte-pro')),
    bloquees: cases.filter((c) => c.disabled).map((c) => c.getAttribute('data-compte-pro')), compteur: d.getAttribute('data-pro-coches'), valide: !d.querySelector('[data-valider-pro]').disabled,
    groupes: [...d.querySelectorAll('[data-pro-plateforme]')].map((g) => g.getAttribute('data-pro-plateforme')), dedans: r.left >= 0 && r.right <= window.innerWidth + 0.5,
    cibles: [...d.querySelectorAll('button')].every((x) => x.getBoundingClientRect().height >= 44), titre: (d.querySelector('#vrm-plan-titre-pro') || {}).innerText };
});
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }).catch(() => {});

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    if (MUTATION) console.log(`\n⚠️  MUTATION « ${MUTATION} » : ce banc DOIT être rouge`);
    console.log('\n── Pro, 12 comptes, rien choisi : tout compte, la feuille « Quels 10 comptes vendent ? »');
    for (const [largeur, sombre] of [[390, false], [1512, true], [390, true], [1512, false]]) {
      await essaie(`feuille ${largeur}`, async () => {
        const { ctx, pg, appels, erreurs } = await ouvrir(nav, { abo: ETATS.proSans, largeur, sombre });
        const nom = `${largeur}${sombre ? ' sombre' : ''}`;
        let v = await lireVentes(pg);
        dit(v.lbc.length === 5 && !v.bloc && v.bandeau && /10 comptes vendeurs/.test(v.bandeauTexte) && erreurs.length === 0, `${nom} : rien bridé avant SON choix (5 ventes Leboncoin) ; la coque demande ses 10 comptes`, JSON.stringify({ lbc: v.lbc.length, b: v.bandeau, e: erreurs }));
        await pg.locator('[data-bandeau-plateforme="pro"] button').first().click(); await pg.waitForTimeout(700);
        let f = await lireFeuille(pg);
        dit(f && f.n === 12 && f.coches.length === 0 && !f.valide && appels.length === 0 && f.groupes.join(',') === 'vinted,leboncoin,ebay,vestiaire',
          '  12 comptes, 4 plateformes, rien coché ni envoyé', JSON.stringify(f && { n: f.n, c: f.coches, g: f.groupes }));
        dit(f && f.dedans && f.cibles, '  la feuille tient dans l’écran ; chaque bouton fait au moins 44 px', JSON.stringify(f && { d: f.dedans, c: f.cibles }));
        await capture(pg, `feuille-vide-${largeur}${sombre ? '-sombre' : ''}`);
        if (largeur === 390 && !sombre) {
          for (const k of DIX) await pg.locator(`[data-compte-pro="${k}"]`).click();
          f = await lireFeuille(pg);
          dit(f.coches.length === 10 && f.compteur === '10' && f.bloquees.sort().join(',') === 'leboncoin:lbcB,leboncoin:lbcF' && f.valide, '  10 cochés : les 2 autres refusés (la 11e case ne se coche pas)', JSON.stringify({ c: f.coches.length, b: f.bloquees }));
          await capture(pg, 'feuille-dix-390');
          await pg.locator('[data-valider-pro]').click(); await pg.waitForTimeout(3500);
          v = await lireVentes(pg);
          const a = appels.filter((x) => x.mode === 'compte-vendeur');
          dit(a.length === 1 && a[0].plateforme === 'pro' && Array.isArray(a[0].comptes) && a[0].comptes.length === 10 && v.lbc.join(',') === 'LA1' && v.bloc && v.bloc.compte === 'lbcB' && !v.bandeau,
            '  son clic : envoyé UNE fois (10 comptes), lbcB sort de la liste et passe en aperçu, plus rien à demander', JSON.stringify({ a: a.length, lbc: v.lbc, c: v.bloc && v.bloc.compte, b: v.bandeau }));
        }
        await ctx.close();
      });
    }
    console.log('\n── Pro, 10 choisis : l’aperçu des comptes hors des 10');
    for (const [largeur, sombre] of [[1512, false], [390, true], [390, false], [1512, true]]) {
      await essaie(`choisi ${largeur}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { abo: ETATS.proChoisi, largeur, sombre });
        const nom = `${largeur}${sombre ? ' sombre' : ''}`;
        const v = await lireVentes(pg), b = v.bloc || {};
        dit(v.lbc.join(',') === 'LA1' && !v.bandeau && erreurs.length === 0, `${nom} : la liste ne garde que les comptes Leboncoin choisis ; liste pleine ⇒ aucune ligne de coque`, JSON.stringify({ lbc: v.lbc, b: v.bandeau, e: erreurs }));
        dit(b.compte === 'lbcB' && b.n === '4' && b.nettes === 3 && b.floutees === 1 && b.inertes, '  lbcB : 4 ventes en aperçu, 3 nettes, la 4e floutée et `inert`', JSON.stringify(b));
        dit(b.choisir && !b.passerPro && /hors de tes 10 comptes vendeurs/.test(b.phrase) && /Rien n'est supprimé/.test(b.phrase), '  « hors de tes 10 comptes vendeurs », rien supprimé ; le geste ouvre la feuille (pas « Passe à Pro »)', (b.phrase || '').replace(/\n/g, ' · '));
        dit(v.deborde <= 0, '  rien ne déborde', String(v.deborde));
        await pg.locator('[data-ventes-autres-hors-plan]').scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `ventes-choisi-${largeur}${sombre ? '-sombre' : ''}`);
        if (largeur === 390 && sombre) {
          await pg.locator('[data-choisir-pro]').first().click({ timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(700);
          const f = await lireFeuille(pg);
          dit(f && f.coches.length === 10 && f.bloquees.includes('leboncoin:lbcA') && f.bloquees.includes('leboncoin:lbcB'), '  la feuille s’ouvre cochée de ses 10 ; moins de 30 jours ⇒ aucun ne se retire, aucune place libre', JSON.stringify(f && { c: f.coches.length, b: f.bloquees.length }));
          await capture(pg, 'feuille-choisie-390-sombre');
        }
        await ctx.close();
      });
    }
    await essaie('pro ancien', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.proAncien });
      const v = await lireVentes(pg);
      dit(v.lbc.length === 5 && !v.bloc && !v.bandeau, 'Pro souscrit avant le 10 nov. : rien demandé, tout compte', JSON.stringify({ lbc: v.lbc.length, b: v.bandeau }));
      await ctx.close();
    });
    console.log('\n── Paramètres → Abonnement');
    for (const [largeur, sombre] of [[1512, false], [390, true]]) {
      await essaie(`reglages ${largeur}`, async () => {
        const { ctx, pg } = await ouvrir(nav, { abo: ETATS.proChoisi, tab: 'settings', largeur, sombre });
        await pg.waitForSelector('[data-offres]', { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const o = await pg.evaluate(() => ({ n: (document.querySelector('[data-comptes-pro]') || { getAttribute: () => null }).getAttribute('data-comptes-pro'), offre: (document.querySelector('[data-offre="pro"] .vrm-plan-phrase') || {}).innerText || '', deborde: document.documentElement.scrollWidth - window.innerWidth }));
        dit(o.n === '10' && /10 comptes vendeurs/.test(o.offre) && o.deborde <= 0, `${largeur} : « Tes 10 comptes vendeurs · 10 / 10 », l’offre Pro dit 10 comptes vendeurs`, JSON.stringify(o));
        await pg.locator('[data-rangee-compte-vendeur="pro"]').scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `reglages-${largeur}${sombre ? '-sombre' : ''}`);
        await pg.locator('[data-rangee-compte-vendeur="pro"]').click({ timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(700);
        const f = await lireFeuille(pg);
        dit(f && f.n === 12 && f.coches.length === 10, '  la rangée ouvre « Quels 10 comptes vendent ? »', JSON.stringify(f && { n: f.n, c: f.coches.length }));
        await ctx.close();
      });
    }
    if (MUTATION === 'pro') console.log(`  (mutation appliquée ${mutee} fois dans le code servi)`);
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 160)); }
  finally {
    await nav.close(); srv.close();
    console.log(`\n  captures : ${CAPTURES}`);
    console.log(ko ? `\n❌ pro-10-comptes (rendu) : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ pro-10-comptes (rendu) : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
