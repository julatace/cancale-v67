require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « PLUSIEURS COMPTES VINTED DÈS SOLO » (13 nov., lot 56). Rendu réel (dist/),
//  données du mode exemple (comptes Vinted 111 et 222, tout inventé), faux serveur
//  (aucun Stripe réel) — la RÈGLE du serveur est jouée par audit-comptes-sup.cjs :
//    · Paramètres → Abonnement, Solo, prix `vrm_compte_sup` ABSENT : « 1 compte Vinted
//      vendeur inclus · +3 €/mois par compte de plus » + « Bientôt » ; la rangée
//      « Un compte Vinted qui vend de plus » n'ouvre RIEN (rien d'achetable) ;
//    · prix PRÉSENT : la rangée ouvre la feuille, le compte inclus n'y est pas, la case
//      CGV est exigée, « Ajouter » envoie `ajouter-sup` (uid, cgv) ; la réponse du
//      serveur range le compte (rangée « Vend aussi ») ;
//    · Ventes : le compte 222 hors offre ⇒ « Faire vendre ce compte · +3 €/mois »
//      (ouvert) ou « Bientôt » (fermé) ; une fois payé ⇒ plus d'aperçu « hors offre » ;
//    · retirer : confirmation, `retirer-sup` ;
//    · accueil : la même phrase ; 390 px tactile et 1512 px, clair et sombre.
//  `BANC_MUTATION=ouvert` : l'écran croit l'offre toujours ouverte (code servi) ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4576;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-comptes-sup');
const MUTATION = process.env.BANC_MUTATION || '';
fs.mkdirSync(CAPTURES, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const J = 864e5;
const cv111 = { uid: '111', le: new Date(Date.now() - 40 * J).toISOString(), prochainChangement: null };
const base = { ok: true, proprietaire: false, configure: true, modeTest: true, obligatoire: false, prix: { montant: 16.99, devise: 'eur', intervalle: 'month' }, prixConforme: true, prixStripe: null, statut: 'active',
  finPeriode: new Date(Date.now() + 20 * J).toISOString(), annuleFinPeriode: false, peutGerer: true, actif: true, acces: true, lecture: true, lectureSeule: false, mentionsCompletes: true, essaiDispo: false, essaiJours: 7,
  prixAbonnement: { montant: 16.99, devise: 'eur', intervalle: 'month', texte: '16,99 € / mois' }, plan: 'solo', planRaison: null, compteVendeur: cv111, comptesVendeurs: {} };
const sup = (liste, payes) => ({ inclus: 1, payes, liste, libres: Math.max(0, payes - liste.length), max: 20 });
const offres = (ouvert) => ({ solo: { texte: '16,99 € / mois', ouvert: true }, pro: { ouvert: false, texte: null }, compteSup: { ouvert, texte: ouvert ? '3,00 € / mois' : null, prixCentimes: 300, inclus: 1, max: 20 } });
const ETATS = {
  ferme: { ...base, comptesSup: sup([], 0), offres: offres(false) },
  ouvert: { ...base, comptesSup: sup([], 0), offres: offres(true) },
  avec222: { ...base, comptesSup: sup(['222'], 1), offres: offres(true) },
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 160)); } };
let mutee = 0;
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  let corps = fs.readFileSync(p);
  // La mutation : `supDe` croit l'offre toujours ouverte (une promesse que le serveur ne tient pas).
  if (MUTATION === 'ouvert' && /\.js$/.test(p)) {
    const t = corps.toString('utf8');
    const m = t.replace(/ouvert:(\w+)\.ouvert===!0,texte:/g, () => { mutee++; return 'ouvert:!0,texte:'; });
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
  const main = jeu.lignes.find((x) => x.id === 'main'); main.data = { ...main.data, vrm_configuration: { etat: 'fait', at: new Date(Date.now() - J).toISOString(), statut: null, version: 1 } };
  EX = { uid: d.UID_EXEMPLE, servir: b.servirTable, base: { lignes: jeu.lignes }, comptes: { lignes: jeu.comptes } };
  return EX;
}
async function ouvrir(nav, { abo, tab = 'settings', largeur = 1512, sombre = false, vue = 'abonnement' }) {
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
      const c = JSON.parse(r.request().postData() || '{}'); appels.push({ m, ...c });
      const s = etat.abo.comptesSup;
      if (c.action === 'ajouter-sup') {
        if (!etat.abo.offres.compteSup.ouvert && !(s.libres > 0)) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erreur: 'compte-sup-ferme', message: "Bientôt : un compte vendeur de plus ne s'achète pas encore. Rien n'a changé, rien n'a été prélevé." }) });
        const n = sup([...s.liste, String(c.uid)], Math.max(s.payes, s.liste.length + 1));
        etat.abo = { ...etat.abo, comptesSup: n };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, comptesSup: n }) });
      }
      if (c.action === 'retirer-sup') {
        const reste = s.liste.filter((x) => x !== String(c.uid)); const n = sup(reste, reste.length);
        etat.abo = { ...etat.abo, comptesSup: n };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, comptesSup: n }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, compteVendeur: cv111 }) });
    }
    if (/mode=factures/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"carte":null,"factures":[]}' });
    if (/mode=parrainage/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"installe":true,"ouvert":false}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4000);
  return { ctx, pg, erreurs, appels, etat };
}
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }).catch(() => {});
const lireReglage = (pg) => pg.evaluate(() => {
  const sup = document.querySelector('[data-solo-supplement]');
  const r = document.querySelector('[data-rangee-sup-ajouter]');
  return { sup: sup ? sup.innerText.replace(/\s+/g, ' ') : null, bientot: !!document.querySelector('[data-sup-pastille-bientot]'), rangee: r ? r.getAttribute('data-rangee-sup-ajouter') : null,
    rangeeTexte: r ? r.innerText.replace(/\s+/g, ' ') : '', cliquable: !!(r && r.querySelector('button')), lignesSup: [...document.querySelectorAll('[data-rangee-compte-sup]')].map((e) => e.getAttribute('data-rangee-compte-sup')),
    feuille: !!document.querySelector('[data-ajouter-compte-sup]'), deborde: document.documentElement.scrollWidth - window.innerWidth };
});

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    if (MUTATION) console.log(`\n⚠️  MUTATION « ${MUTATION} » : ce banc DOIT être rouge`);
    console.log('\n── Paramètres → Abonnement, prix `vrm_compte_sup` absent : « bientôt », rien d’achetable');
    for (const [largeur, sombre] of [[390, false], [1512, true]]) {
      await essaie(`ferme ${largeur}`, async () => {
        const { ctx, pg, appels, erreurs } = await ouvrir(nav, { abo: ETATS.ferme, largeur, sombre });
        await pg.waitForSelector('[data-solo-supplement]', { timeout: 10000 }).catch(() => {});
        const o = await lireReglage(pg);
        dit(o.sup && /1 compte Vinted vendeur inclus · \+3 €\/mois par compte de plus/.test(o.sup) && o.bientot, `${largeur}${sombre ? ' sombre' : ''} : « 1 compte Vinted vendeur inclus · +3 €/mois par compte de plus » + « Bientôt »`, JSON.stringify(o.sup));
        dit(o.rangee === 'bientot' && !o.cliquable && /Bientôt/.test(o.rangeeTexte), '  la rangée « Un compte Vinted qui vend de plus » dit « Bientôt » et n’ouvre rien', JSON.stringify({ r: o.rangee, t: o.rangeeTexte, c: o.cliquable }));
        dit(appels.length === 0 && erreurs.length === 0 && o.deborde <= 0, '  rien envoyé, aucune erreur, rien ne déborde', JSON.stringify({ a: appels.length, e: erreurs, d: o.deborde }));
        await pg.locator('[data-rangee-sup-ajouter]').scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `reglages-ferme-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
    console.log('\n── Prix présent : la feuille, la case CGV, « Ajouter »');
    for (const [largeur, sombre] of [[390, true], [1512, false]]) {
      await essaie(`ouvert ${largeur}`, async () => {
        const { ctx, pg, appels, erreurs } = await ouvrir(nav, { abo: ETATS.ouvert, largeur, sombre });
        await pg.waitForSelector('[data-rangee-sup-ajouter="ouvert"] button', { timeout: 10000 }).catch(() => {});
        const o = await lireReglage(pg);
        dit(o.rangee === 'ouvert' && o.cliquable && !o.bientot, `${largeur}${sombre ? ' sombre' : ''} : offre ouverte ⇒ la rangée s’ouvre, plus de « Bientôt »`, JSON.stringify({ r: o.rangee, b: o.bientot }));
        await pg.click('[data-rangee-sup-ajouter] button');
        await pg.waitForSelector('[data-ajouter-compte-sup]', { timeout: 4000 }).catch(() => {});
        const f = await pg.evaluate(() => { const x = document.querySelector('[data-ajouter-compte-sup]'); return x ? { uids: [...x.querySelectorAll('[data-sup-uid]')].map((e) => e.getAttribute('data-sup-uid')), prix: (x.querySelector('[data-sup-prix]') || {}).innerText || '', cgv: !!x.querySelector('[data-sup-cgv] input'), off: x.querySelector('[data-valider-sup]').disabled } : null; });
        dit(f && JSON.stringify(f.uids) === '["222"]' && /\+3,00 €\/mois/.test(f.prix) && f.cgv && f.off, '  la feuille : seul 222 (le compte inclus 111 n’y est pas), le prix lu chez Stripe, case CGV, bouton fermé', JSON.stringify(f));
        await capture(pg, `feuille-${largeur}${sombre ? '-sombre' : ''}`);
        await pg.click('[data-sup-uid="222"]');
        const ferme = await pg.evaluate(() => document.querySelector('[data-valider-sup]').disabled);
        dit(ferme === true, '  un compte choisi, CGV pas cochées ⇒ bouton toujours fermé');
        await pg.click('[data-sup-cgv] input');
        await pg.click('[data-valider-sup]');
        await pg.waitForSelector('[data-rangee-compte-sup="222"]', { timeout: 5000 }).catch(() => {});
        const a = appels.find((x) => x.action === 'ajouter-sup');
        const apres = await lireReglage(pg);
        dit(a && a.uid === '222' && a.cgv === true && !apres.feuille && JSON.stringify(apres.lignesSup) === '["222"]', '  « Ajouter » envoie `ajouter-sup` (222, CGV) ; la réponse du serveur range le compte (« Vend aussi »)', JSON.stringify({ a, l: apres.lignesSup }));
        dit(erreurs.length === 0 && apres.deborde <= 0, '  aucune erreur, rien ne déborde', JSON.stringify({ e: erreurs, d: apres.deborde }));
        await capture(pg, `reglages-apres-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
    console.log('\n── Retirer un compte de plus');
    await essaie('retirer', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.avec222, largeur: 390 });
      await pg.waitForSelector('[data-rangee-compte-sup="222"] button', { timeout: 10000 }).catch(() => {});
      await pg.click('[data-rangee-compte-sup="222"] button'); await pg.waitForTimeout(600);
      await pg.keyboard.press('Enter'); await pg.waitForTimeout(1500);
      const a = appels.find((x) => x.action === 'retirer-sup');
      const o = await lireReglage(pg);
      dit(a && a.uid === '222' && o.lignesSup.length === 0, 'retirer (confirmé) envoie `retirer-sup` ; la rangée disparaît', JSON.stringify({ a, l: o.lignesSup }));
      await ctx.close();
    });
    console.log('\n── Ventes : le compte 222 hors offre');
    for (const [etat, attendu] of [['ferme', 'bientot'], ['ouvert', 'bouton'], ['avec222', 'compte']]) {
      await essaie(`ventes ${etat}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { abo: ETATS[etat], tab: 'ventes', largeur: 390, sombre: etat === 'ouvert' });
        await pg.waitForTimeout(2500);
        const v = await pg.evaluate(() => ({ bloc: !!document.querySelector('[data-ventes-hors-plan] [data-hors-plan-compte="222"]'), bouton: !!document.querySelector('[data-sup-ajouter="222"]'), bientot: !!document.querySelector('[data-sup-bientot-bloc="222"]'), deborde: document.documentElement.scrollWidth - window.innerWidth }));
        const bon = attendu === 'bientot' ? v.bloc && v.bientot && !v.bouton : attendu === 'bouton' ? v.bloc && v.bouton && !v.bientot : !v.bloc;
        dit(bon && erreurs.length === 0 && v.deborde <= 0, `Ventes (${etat}) : ${attendu === 'bientot' ? '« Bientôt : faire vendre ce compte »' : attendu === 'bouton' ? '« Faire vendre ce compte · +3 €/mois »' : 'le compte 222 payé n’est plus « hors offre »'}`, JSON.stringify({ ...v, e: erreurs }));
        await pg.locator('[data-ventes-hors-plan]').first().scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `ventes-${etat}`);
        await ctx.close();
      });
    }
    console.log('\n── Accueil');
    for (const [largeur, sombre] of [[390, false], [1512, true]]) {
      await essaie(`accueil ${largeur}`, async () => {
        const mobile = largeur < 600;
        const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', serviceWorkers: 'block' });
        await ctx.route(/supabase\.co|\/api\//, (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => rt.abort());
        const pg = await ctx.newPage();
        await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-offre="solo"]', { timeout: 15000 }).catch(() => {});
        const a = await pg.evaluate(() => ({ s: ((document.querySelector('[data-offre="solo"] [data-solo-supplement]') || {}).innerText || '').replace(/\s+/g, ' '), deborde: document.documentElement.scrollWidth - window.innerWidth }));
        dit(/1 compte Vinted vendeur inclus · \+3 €\/mois par compte de plus/.test(a.s), `accueil ${largeur}${sombre ? ' sombre' : ''} : l’offre Solo dit le supplément`, JSON.stringify(a));
        await pg.locator('[data-offre="solo"]').scrollIntoViewIfNeeded().catch(() => {});
        await pg.waitForTimeout(1200);
        await capture(pg, `accueil-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
    if (MUTATION === 'ouvert') console.log(`  (mutation appliquée ${mutee} fois dans le code servi)`);
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 160)); }
  finally {
    await nav.close(); srv.close();
    console.log(`\n  captures : ${CAPTURES}`);
    console.log(ko ? `\n❌ comptes-sup (rendu) : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ comptes-sup (rendu) : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
