require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « SOLO ET PRO » (9 nov.) — Julien : « Ça peut être 1 compte vendeur et
//  plein de comptes achat, donc sur ces comptes on prend que les achats ; pour
//  avoir toutes ses ventes de tous ses comptes il prend l'abonnement du dessus. »
//  Rendu réel (dist/), données du mode exemple (comptes 111 et 222, inventés) +
//  quatre ventes inventées sur le compte 222 (pour une liste de plus de 3) ;
//  faux serveur (aucun Stripe réel) :
//    · Pro : toutes les ventes dans la liste, aucun aperçu ;
//    · Solo, compte vendeur 111 : la liste ne montre que les ventes de 111 ; les
//      ventes de 222 en aperçu — 3 nettes, la suite floutée, `inert`, aucun geste,
//      « Passe à Pro » ; le colis à envoyer est DIT ;
//    · Solo sans choix : la ligne de la coque, la feuille « Quel compte vend ? »
//      (comptes par n°, le plus vendeur PROPOSÉ, rien envoyé avant le clic), puis
//      le choix envoyé et la liste qui suit ;
//    · Paramètres → Abonnement : Solo et Pro côte à côte, Pro 19,99 € « bientôt »
//      sans bouton tant que son prix Stripe n'est pas posé ; ouvert ⇒ « Passer à Pro » ;
//    · 390 px tactile et 1512 px, clair et sombre : rien ne déborde.
//  `BANC_MUTATION=horsplan` : la règle `venteHorsPlan` neutralisée dans le code
//  servi ⇒ le banc DOIT être rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4547;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-plans-solo-pro');
const MUTATION = process.env.BANC_MUTATION || '';
fs.mkdirSync(CAPTURES, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const J = 864e5;
const PRIX = { montant: 16.99, devise: 'eur', intervalle: 'month' };
const ABO = { montant: 16.99, devise: 'eur', intervalle: 'month', texte: '16,99 € / mois' };
const base = { ok: true, proprietaire: false, configure: true, modeTest: true, obligatoire: false, prix: PRIX, prixConforme: true, prixStripe: null, statut: 'active', finPeriode: new Date(Date.now() + 20 * J).toISOString(), annuleFinPeriode: false, peutGerer: true, actif: true, acces: true, lecture: true, lectureSeule: false, mentionsCompletes: true, essaiDispo: false, essaiJours: 7, prixAbonnement: ABO,
  offres: { solo: { texte: '16,99 € / mois', ouvert: true }, pro: { ouvert: false, texte: null } } };
const ETATS = {
  pro: { ...base, plan: 'pro', compteVendeur: null },
  solo111: { ...base, plan: 'solo', compteVendeur: { uid: '111', le: new Date(Date.now() - 2 * J).toISOString(), prochainChangement: new Date(Date.now() + 28 * J).toISOString() } },
  soloSansChoix: { ...base, plan: 'solo', compteVendeur: null },
  soloProOuvert: { ...base, plan: 'solo', compteVendeur: { uid: '111', le: null, prochainChangement: null }, offres: { solo: { texte: '16,99 € / mois', ouvert: true }, pro: { ouvert: true, texte: '19,99 € / mois' } } },
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 160)); } };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  let corps = fs.readFileSync(p);
  // La mutation : `venteHorsPlan` ne dit plus jamais « hors offre ».
  if (MUTATION === 'horsplan' && /\.js$/.test(p)) {
    const t = corps.toString('utf8');
    const m = t.replace(/(\w+)\(\w+\)&&\w+!==(\w+)\.vendeur/g, '!1');
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
  // Quatre ventes inventées de plus sur le compte 222 (une liste de 5, pour juger l'extrait).
  const l222 = jeu.lignes.find((l) => l.id === 'harvest_222_orders_sold');
  const mod = l222.data.payload.my_orders[0];
  for (let i = 1; i <= 4; i++) l222.data.payload.my_orders.push({ ...mod, transaction_id: 62005 + i * 11, title: `Paire inventée ${i} taille 4${i}`, date: new Date(Date.now() - i * J).toISOString(), status: i === 1 ? 'Bordereau envoyé au vendeur' : 'Commande finalisée', transaction_user_status: i === 1 ? 'needs_action' : 'completed' });
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
      const c = JSON.parse(r.request().postData() || '{}'); appels.push({ mode: 'compte-vendeur', m, uid: c.uid });
      const cv = { uid: String(c.uid), le: new Date().toISOString(), prochainChangement: new Date(Date.now() + 30 * J).toISOString() };
      etat.abo = { ...etat.abo, compteVendeur: cv };
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, compteVendeur: cv }) });
    }
    if (/mode=changer-plan/.test(u)) { appels.push({ mode: 'changer-plan', m }); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"plan":"pro"}' }); }
    if (/mode=factures/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"carte":null,"factures":[]}' });
    if (/mode=parrainage/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"installe":true,"ouvert":false}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  return { ctx, pg, erreurs, appels, etat };
}
const lireVentes = (pg) => pg.evaluate(() => {
  // La liste « Tous » de l'écran Ventes (une rangée par vente, `data-toutes-id` = son n°).
  const rows = [...document.querySelectorAll('[data-toutes-vente="vinted"][data-toutes-id]')].map((e) => e.getAttribute('data-toutes-id'));
  const h = document.querySelector('[data-ventes-hors-plan]');
  const bloc = h ? h.querySelector('[data-hors-plan-compte]') : null;
  const lignes = bloc ? [...bloc.querySelectorAll('.vrm-plan-ligne')] : [];
  const fl = lignes.filter((l) => l.hasAttribute('data-apercu-floute'));
  const s = fl[0] ? getComputedStyle(fl[0]) : null;
  return {
    rows, hors: !!h, compte: bloc && bloc.getAttribute('data-hors-plan-compte'), n: bloc && bloc.getAttribute('data-hors-plan-n'), aEnvoyer: bloc && bloc.getAttribute('data-hors-plan-a-envoyer'),
    nettes: lignes.slice(0, 3).filter((l) => !l.hasAttribute('data-apercu-floute')).length, floutees: fl.length,
    inertes: fl.every((l) => l.hasAttribute('inert') && l.getAttribute('aria-hidden') === 'true'), flou: s ? s.filter : '',
    pro: !!(bloc && bloc.querySelector('[data-passer-pro]')), phrase: bloc ? bloc.innerText.slice(0, 800) : '',
    bandeau: !!document.querySelector('[data-bandeau-compte-vendeur]'),
    deborde: document.documentElement.scrollWidth - window.innerWidth,
  };
});
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }).catch(() => {});

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    if (MUTATION) console.log(`\n⚠️  MUTATION « ${MUTATION} » : ce banc DOIT être rouge`);
    console.log('\n── Ventes : Pro, puis Solo');
    let toutes = [];
    await essaie('pro', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { abo: ETATS.pro });
      const v = await lireVentes(pg); toutes = v.rows;
      dit(v.rows.length >= 8 && !v.hors && erreurs.length === 0, 'Pro : les ventes de TOUS les comptes dans la liste, aucun aperçu', `${v.rows.length} ventes · ${erreurs.join('|')}`);
      await capture(pg, 'pro-ventes-1512'); await ctx.close();
    });
    for (const [largeur, sombre] of [[1512, false], [390, true], [390, false], [1512, true]]) {
      await essaie(`solo ${largeur}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { abo: ETATS.solo111, largeur, sombre });
        const v = await lireVentes(pg);
        const nom = `${largeur}${sombre ? ' sombre' : ''}`;
        dit(v.rows.length === 3 && v.rows.every((t) => Number(t) < 62005) && erreurs.length === 0, `Solo (compte 111) ${nom} : la liste ne garde que les ventes du compte vendeur`, `${v.rows.join(',')} · ${erreurs.join('|')}`);
        dit(v.hors && v.compte === '222' && v.n === '5' && v.aEnvoyer === '1', '  les ventes du compte 222 : en aperçu, comptées et le colis à envoyer DIT', JSON.stringify({ c: v.compte, n: v.n, e: v.aEnvoyer }));
        dit(v.nettes === 3 && v.floutees === 2 && v.inertes && /blur/.test(v.flou), '  extrait : 3 nettes, la suite floutée, `inert` + `aria-hidden`', JSON.stringify({ nettes: v.nettes, fl: v.floutees, inertes: v.inertes, flou: v.flou }));
        dit(v.pro && /Passe à Pro/.test(v.phrase) && /Rien n'est supprimé/.test(v.phrase), '  « Passe à Pro pour gérer les ventes de … », rien supprimé', v.phrase.replace(/\n/g, ' · '));
        dit(v.deborde <= 0, '  rien ne déborde', String(v.deborde));
        await pg.locator('[data-ventes-hors-plan]').scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `solo-ventes-${largeur}${sombre ? '-sombre' : ''}`);
        if (largeur === 1512 && !sombre) {
          const url = pg.url();
          await pg.locator('[data-ventes-hors-plan] .vrm-plan-ligne').first().click({ timeout: 2000 }).catch(() => {});
          await pg.waitForTimeout(400);
          dit(pg.url() === url && !(await pg.evaluate(() => !!document.querySelector('[role="dialog"]'))), '  aucun geste sur une vente hors offre (clic arrêté)');
          await pg.locator('[data-ventes-hors-plan] [data-passer-pro]').first().click({ timeout: 2000 }).catch(() => {});
          await pg.waitForTimeout(1800);
          dit(await pg.evaluate(() => !!document.querySelector('[data-offres]')), '  « Passe à Pro » ouvre Paramètres → Abonnement, les deux offres');
        }
        await ctx.close();
      });
    }

    console.log('\n── Solo sans compte choisi : la feuille « Quel compte vend ? »');
    await essaie('sans choix', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.soloSansChoix, largeur: 390 });
      let v = await lireVentes(pg);
      dit(v.bandeau && !v.hors && v.rows.length === toutes.length, 'rien n’est bridé avant SON choix ; la coque demande de choisir', JSON.stringify({ bandeau: v.bandeau, rows: v.rows.length }));
      await pg.locator('[data-bandeau-compte-vendeur] button').first().click(); await pg.waitForTimeout(600);
      const f = await pg.evaluate(() => { const d = document.querySelector('[data-quel-compte]'); return d ? { propose: d.getAttribute('data-propose'), comptes: [...d.querySelectorAll('[data-compte-uid]')].map((b) => b.getAttribute('data-compte-uid')), coches: [...d.querySelectorAll('[aria-checked="true"]')].length, valide: !d.querySelector('[data-valider-compte]').disabled } : null; });
      dit(f && f.comptes.join(',') === '111,222' && f.propose === '222' && f.coches === 0 && !f.valide && appels.length === 0, 'feuille : ses comptes par n°, le plus vendeur PROPOSÉ (222), rien coché ni envoyé', JSON.stringify(f));
      await capture(pg, 'quel-compte-390');
      await pg.locator('[data-quel-compte] [data-compte-uid="111"]').click(); await pg.locator('[data-valider-compte]').click(); await pg.waitForTimeout(3500);
      v = await lireVentes(pg);
      dit(appels.length === 1 && appels[0].uid === '111' && v.rows.length === 3 && v.compte === '222', 'son clic (111) : envoyé une fois, la liste suit (ventes de 111), 222 en aperçu', JSON.stringify({ appels, rows: v.rows.length, c: v.compte }));
      await ctx.close();
    });

    console.log('\n── Paramètres → Abonnement : deux offres côte à côte');
    for (const [nom, abo, largeur, sombre] of [['fermé', ETATS.solo111, 1512, false], ['fermé', ETATS.solo111, 390, true], ['ouvert', ETATS.soloProOuvert, 1512, true]]) {
      await essaie(`offres ${nom} ${largeur}`, async () => {
        const { ctx, pg } = await ouvrir(nav, { abo, tab: 'settings', largeur, sombre });
        await pg.waitForSelector('[data-offres]', { timeout: 10000 }).catch(() => {});   // l'écran Paramètres est chargé à la demande
        const o = await pg.evaluate(() => { const g = document.querySelector('[data-offres]'); if (!g) return null; const r = (s) => g.querySelector(s); return { plan: g.getAttribute('data-plan'), solo: (r('[data-prix-solo]') || {}).innerText, pro: (r('[data-prix-pro]') || {}).innerText, bientot: !!r('[data-pro-bientot]'), bouton: !!r('[data-passer-pro]'), actuelle: (g.querySelector('[data-offre-actuelle]') || {}).getAttribute ? g.querySelector('[data-offre-actuelle]').getAttribute('data-offre') : null, cv: (document.querySelector('[data-compte-vendeur]') || {}).getAttribute ? document.querySelector('[data-compte-vendeur]').getAttribute('data-compte-vendeur') : null, cote: (() => { const a = g.children[0].getBoundingClientRect(), b = g.children[1].getBoundingClientRect(); return Math.abs(a.top - b.top) < 4; })(), deborde: document.documentElement.scrollWidth - window.innerWidth }; });
        if (nom === 'fermé') dit(o && o.plan === 'solo' && /16,99/.test(o.solo) && /19,99\s€ \/ mois/.test(o.pro) && o.bientot && !o.bouton && o.actuelle === 'solo' && o.cv === '111', `${largeur} : Solo 16,99 € (ton offre) · Pro 19,99 € « bientôt », sans bouton ; le compte qui vend`, JSON.stringify(o));
        else dit(o && o.bouton && !o.bientot && /19,99/.test(o.pro), 'Pro ouvert (prix Stripe posé) : « Passer à Pro »', JSON.stringify(o));
        if (largeur === 1512) dit(o && o.cote, '  1512 : côte à côte'); else dit(o && o.deborde <= 0, '  390 : rien ne déborde', String(o && o.deborde));
        await pg.locator('[data-offres]').scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `offres-${nom}-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 160)); }
  finally {
    await nav.close(); srv.close();
    console.log(`\n  captures : ${CAPTURES}`);
    console.log(ko ? `\n❌ plans-solo-pro (rendu) : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ plans-solo-pro (rendu) : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
