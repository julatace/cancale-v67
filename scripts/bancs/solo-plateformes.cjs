require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « SOLO PAR PLATEFORME » (9 nov., soir) — Julien : « fais absolument tout ».
//  Solo = UN compte vendeur PAR plateforme (un Vinted, un Leboncoin, un eBay, un
//  Vestiaire) ; Pro = tous. (Interprétation par défaut, à confirmer par Julien.)
//  Rendu réel (dist/), données du mode exemple (comptes Vinted 111 et 222) + DEUX
//  comptes Leboncoin (lbcA « Ma boutique » 1 vente, lbcB « Mes achats » 4 ventes),
//  DEUX comptes Vestiaire (vcA 1 vente, vcB 1 vente), DEUX comptes eBay (registre
//  seul) — tout inventé ; faux serveur (aucun Stripe réel) :
//    · Pro : Ventes « Tous » montre les 5 ventes Leboncoin et les 2 Vestiaire, aucun aperçu ;
//    · Solo (111, lbcA, vcA) : la liste ne garde que lbcA et vcA ; « Ventes Leboncoin
//      de Mes achats » en aperçu — 3 nettes, la 4e floutée, `inert`, aucun geste ;
//      Vestiaire vcB en aperçu ;
//    · Solo sans choix Leboncoin : la ligne de la coque nomme Leboncoin ; la feuille
//      « Quel compte vend sur Leboncoin ? » : ses deux comptes, le plus vendeur
//      PROPOSÉ (lbcB), rien coché ni envoyé ; son clic (lbcA) part UNE fois avec
//      `{ plateforme: 'leboncoin', id: 'lbcA' }`, puis la liste suit ;
//    · Paramètres → Abonnement : une rangée « Le compte qui vend » par plateforme
//      (Leboncoin, eBay, Vestiaire) ; la rangée eBay ouvre SA feuille ;
//    · 390 px tactile et 1512 px, clair et sombre : rien ne déborde.
//  `BANC_MUTATION=autres` : `venteAutreHorsPlan` neutralisée dans le code servi
//  ⇒ le banc DOIT être rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4561;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-solo-plateformes');
const MUTATION = process.env.BANC_MUTATION || '';
fs.mkdirSync(CAPTURES, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const J = 864e5;
const PRIX = { montant: 16.99, devise: 'eur', intervalle: 'month' };
const ABO = { montant: 16.99, devise: 'eur', intervalle: 'month', texte: '16,99 € / mois' };
const cv111 = { uid: '111', le: new Date(Date.now() - 2 * J).toISOString(), prochainChangement: new Date(Date.now() + 28 * J).toISOString() };
const base = { ok: true, proprietaire: false, configure: true, modeTest: true, obligatoire: false, prix: PRIX, prixConforme: true, prixStripe: null, statut: 'active', finPeriode: new Date(Date.now() + 20 * J).toISOString(), annuleFinPeriode: false, peutGerer: true, actif: true, acces: true, lecture: true, lectureSeule: false, mentionsCompletes: true, essaiDispo: false, essaiJours: 7, prixAbonnement: ABO,
  offres: { solo: { texte: '16,99 € / mois', ouvert: true }, pro: { ouvert: false, texte: null } } };
const ETATS = {
  pro: { ...base, plan: 'pro', compteVendeur: null, comptesVendeurs: {} },
  solo: { ...base, plan: 'solo', compteVendeur: cv111, comptesVendeurs: { leboncoin: { id: 'lbcA', le: cv111.le, prochainChangement: cv111.prochainChangement }, vestiaire: { id: 'vcA', le: null, prochainChangement: null } } },
  soloSansLbc: { ...base, plan: 'solo', compteVendeur: cv111, comptesVendeurs: {} },
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
  if (MUTATION === 'autres' && /\.js$/.test(p)) {
    const t = corps.toString('utf8');
    const m = t.replace(/return!!(\w+)&&\1!==(\w+)\}/g, () => { mutee++; return 'return!1}'; });
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
  pose('lbc_accounts', { accounts: { lbcA: { id: 'lbcA', name: 'Ma boutique', sessionAt: iso(1) }, 'lbc-account:lbcB': { id: 'lbc-account:lbcB', name: 'Mes achats', sessionAt: iso(2) } } });
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
  return { ctx, pg, erreurs, appels, etat };
}
const lireVentes = (pg) => pg.evaluate(() => {
  const ids = (site) => [...document.querySelectorAll(`[data-toutes-vente="${site}"][data-toutes-id]`)].map((e) => e.getAttribute('data-toutes-id'));
  const h = document.querySelector('[data-ventes-autres-hors-plan]');
  const bloc = (site) => {
    const b = h ? h.querySelector(`[data-hors-plan-site="${site}"]`) : null;
    if (!b) return null;
    const lignes = [...b.querySelectorAll('.vrm-plan-ligne')];
    const fl = lignes.filter((l) => l.hasAttribute('data-apercu-floute'));
    const s = fl[0] ? getComputedStyle(fl[0]) : null;
    return { compte: b.getAttribute('data-hors-plan-compte'), n: b.getAttribute('data-hors-plan-n'), nettes: lignes.slice(0, 3).filter((l) => !l.hasAttribute('data-apercu-floute')).length,
      floutees: fl.length, inertes: fl.every((l) => l.hasAttribute('inert') && l.getAttribute('aria-hidden') === 'true'), flou: s ? s.filter : '', pro: !!b.querySelector('[data-passer-pro]'), phrase: b.innerText.slice(0, 600) };
  };
  const band = document.querySelector('[data-bandeau-compte-vendeur]');
  return { lbc: ids('leboncoin'), vc: ids('vestiaire'), hors: !!h, blocLbc: bloc('leboncoin'), blocVc: bloc('vestiaire'),
    bandeau: band ? band.getAttribute('data-bandeau-plateforme') : null, bandeauTexte: band ? band.innerText : '',
    deborde: document.documentElement.scrollWidth - window.innerWidth };
});
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }).catch(() => {});

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    if (MUTATION) console.log(`\n⚠️  MUTATION « ${MUTATION} » : ce banc DOIT être rouge`);
    console.log('\n── Ventes « Tous » : Pro, puis Solo (un compte vendeur par plateforme)');
    await essaie('pro', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { abo: ETATS.pro });
      const v = await lireVentes(pg);
      dit(v.lbc.length === 5 && v.vc.length === 2 && !v.hors && erreurs.length === 0, 'Pro : les 5 ventes Leboncoin et les 2 Vestiaire de tous les comptes, aucun aperçu', `${v.lbc.length} LBC · ${v.vc.length} VC · ${erreurs.join('|')}`);
      await capture(pg, 'pro-ventes-1512'); await ctx.close();
    });
    for (const [largeur, sombre] of [[1512, false], [390, true], [390, false], [1512, true]]) {
      await essaie(`solo ${largeur}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { abo: ETATS.solo, largeur, sombre });
        const v = await lireVentes(pg);
        const nom = `${largeur}${sombre ? ' sombre' : ''}`;
        dit(v.lbc.join(',') === 'LA1' && v.vc.join(',') === 'VA' && erreurs.length === 0, `Solo ${nom} : la liste ne garde que le compte vendeur Leboncoin (lbcA) et Vestiaire (vcA)`, `${v.lbc.join(',')} · ${v.vc.join(',')} · ${erreurs.join('|')}`);
        const b = v.blocLbc || {};
        dit(v.hors && b.compte === 'lbcB' && b.n === '4' && b.nettes === 3 && b.floutees === 1 && b.inertes && /blur/.test(b.flou), '  Leboncoin « Mes achats » (lbcB, `lbc-account:` compris) : 4 ventes en aperçu, 3 nettes, la 4e floutée et `inert`', JSON.stringify({ c: b.compte, n: b.n, nettes: b.nettes, fl: b.floutees, inertes: b.inertes }));
        dit(b.pro && /Passe à Pro/.test(b.phrase) && /Rien n'est supprimé/.test(b.phrase) && /un compte vendeur par plateforme/.test(b.phrase), '  « Passe à Pro pour gérer les ventes Leboncoin de … », rien supprimé', (b.phrase || '').replace(/\n/g, ' · '));
        dit(v.blocVc && v.blocVc.compte === 'vcB' && v.blocVc.n === '1', '  Vestiaire vcB : sa vente en aperçu', JSON.stringify(v.blocVc && { c: v.blocVc.compte, n: v.blocVc.n }));
        dit(v.deborde <= 0, '  rien ne déborde', String(v.deborde));
        await pg.locator('[data-ventes-autres-hors-plan]').scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `solo-ventes-${largeur}${sombre ? '-sombre' : ''}`);
        if (largeur === 1512 && !sombre) {
          const url = pg.url();
          await pg.locator('[data-ventes-autres-hors-plan] .vrm-plan-ligne').first().click({ timeout: 2000 }).catch(() => {});
          await pg.waitForTimeout(400);
          dit(pg.url() === url && !(await pg.evaluate(() => !!document.querySelector('[role="dialog"]'))), '  aucun geste sur une vente hors offre (clic arrêté)');
        }
        await ctx.close();
      });
    }

    console.log('\n── Solo sans compte vendeur Leboncoin : la feuille « Quel compte vend sur Leboncoin ? »');
    for (const [largeur, sombre] of [[390, false], [1512, true], [390, true], [1512, false]]) {
      await essaie(`feuille ${largeur}`, async () => {
        const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.soloSansLbc, largeur, sombre });
        let v = await lireVentes(pg);
        const nom = `${largeur}${sombre ? ' sombre' : ''}`;
        dit(v.bandeau === 'leboncoin' && /sur Leboncoin/.test(v.bandeauTexte) && v.lbc.length === 5 && !v.blocLbc, `${nom} : rien n’est bridé sur Leboncoin avant SON choix ; la coque nomme Leboncoin`, JSON.stringify({ b: v.bandeau, lbc: v.lbc.length }));
        await pg.locator('[data-bandeau-compte-vendeur] button').first().click(); await pg.waitForTimeout(700);
        const f = await pg.evaluate(() => { const d = document.querySelector('[data-quel-compte]'); if (!d) return null; const r = d.getBoundingClientRect(); return { p: d.getAttribute('data-quel-compte-plateforme'), titre: (d.querySelector('#vrm-plan-titre') || {}).innerText, propose: d.getAttribute('data-propose'), comptes: [...d.querySelectorAll('[data-compte-uid]')].map((b) => b.getAttribute('data-compte-uid')), noms: [...d.querySelectorAll('.vrm-plan-compte-nom')].map((x) => x.innerText), coches: [...d.querySelectorAll('[aria-checked="true"]')].length, valide: !d.querySelector('[data-valider-compte]').disabled, dedans: r.left >= 0 && r.right <= window.innerWidth + 0.5, cibles: [...d.querySelectorAll('button')].every((b) => b.getBoundingClientRect().height >= 44) }; });
        dit(f && f.p === 'leboncoin' && /Leboncoin/.test(f.titre) && f.comptes.join(',') === 'lbcA,lbcB' && f.noms.join('|').includes('Ma boutique') && f.propose === 'lbcB' && f.coches === 0 && !f.valide && appels.length === 0,
          '  ses deux comptes Leboncoin (nom lu), le plus vendeur PROPOSÉ (lbcB), rien coché ni envoyé', JSON.stringify(f));
        dit(f && f.dedans && f.cibles, '  la feuille tient dans l’écran ; chaque bouton fait au moins 44 px', JSON.stringify(f && { dedans: f.dedans, cibles: f.cibles }));
        await capture(pg, `quel-compte-leboncoin-${largeur}${sombre ? '-sombre' : ''}`);
        if (largeur === 390 && !sombre) {
          await pg.locator('[data-quel-compte] [data-compte-uid="lbcA"]').click(); await pg.locator('[data-valider-compte]').click(); await pg.waitForTimeout(3500);
          v = await lireVentes(pg);
          const a = appels.filter((x) => x.mode === 'compte-vendeur');
          dit(a.length === 1 && a[0].plateforme === 'leboncoin' && a[0].id === 'lbcA' && v.lbc.join(',') === 'LA1' && v.blocLbc && v.blocLbc.compte === 'lbcB',
            '  son clic (lbcA) : envoyé UNE fois `{ plateforme, id }`, la liste suit, lbcB passe en aperçu', JSON.stringify({ a, lbc: v.lbc, c: v.blocLbc && v.blocLbc.compte }));
          await capture(pg, 'apres-choix-390');
        }
        await ctx.close();
      });
    }

    console.log('\n── Paramètres → Abonnement : le compte qui vend, plateforme par plateforme');
    for (const [largeur, sombre] of [[1512, false], [390, true]]) {
      await essaie(`reglages ${largeur}`, async () => {
        const { ctx, pg } = await ouvrir(nav, { abo: ETATS.solo, tab: 'settings', largeur, sombre });
        await pg.waitForSelector('[data-offres]', { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const o = await pg.evaluate(() => ({
          rangees: [...document.querySelectorAll('[data-compte-vendeur-plateforme]')].map((e) => `${e.getAttribute('data-compte-vendeur-plateforme')}=${e.getAttribute('data-compte-vendeur') || '-'}`),
          textes: [...document.querySelectorAll('[data-compte-vendeur-plateforme]')].map((e) => e.innerText),
          offre: (document.querySelector('[data-offre="solo"] .vrm-plan-phrase') || {}).innerText || '',
          deborde: document.documentElement.scrollWidth - window.innerWidth,
        }));
        dit(o.rangees.join(',') === 'leboncoin=lbcA,ebay=-,vestiaire=vcA' && /Ma boutique/.test(o.textes[0] || '') && /Pas encore choisi/.test(o.textes[1] || ''),
          `${largeur} : une rangée par plateforme (Leboncoin « Ma boutique », eBay pas encore choisi, Vestiaire vcA)`, JSON.stringify(o.rangees.concat(o.textes)));
        dit(/un compte vendeur par plateforme/i.test(o.offre), '  l’offre Solo dit « un compte vendeur par plateforme »', o.offre.slice(0, 120));
        dit(o.deborde <= 0, '  rien ne déborde', String(o.deborde));
        await pg.locator('[data-rangee-compte-vendeur]').first().scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `reglages-${largeur}${sombre ? '-sombre' : ''}`);
        await pg.locator('[data-rangee-compte-vendeur="ebay"]').click({ timeout: 3000 }).catch(() => {});
        await pg.waitForTimeout(700);
        const f = await pg.evaluate(() => { const d = document.querySelector('[data-quel-compte]'); return d ? { p: d.getAttribute('data-quel-compte-plateforme'), comptes: [...d.querySelectorAll('[data-compte-uid]')].map((b) => b.getAttribute('data-compte-uid')) } : null; });
        dit(f && f.p === 'ebay' && f.comptes.join(',') === 'principal,0123456789abcdef', '  la rangée eBay ouvre SA feuille (compte principal et l’autre compte, par identité)', JSON.stringify(f));
        await capture(pg, `quel-compte-ebay-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
    if (MUTATION === 'autres') console.log(`  (mutation appliquée ${mutee} fois dans le code servi)`);
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 160)); }
  finally {
    await nav.close(); srv.close();
    console.log(`\n  captures : ${CAPTURES}`);
    console.log(ko ? `\n❌ solo-plateformes (rendu) : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ solo-plateformes (rendu) : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
