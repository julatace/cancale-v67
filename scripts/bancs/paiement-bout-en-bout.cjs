require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « PAIEMENT DE BOUT EN BOUT » (12 nov., lot agent2-ouverture-clients)
//  Stripe SIMULÉ (scripts/_monde-paiement.cjs : un faux Stripe qui a un état,
//  une fausse base à la forme PostgREST) — aucune vraie clé, aucune vraie carte.
//  Le VRAI api/compte.js sert l'app (Playwright route /api/compte vers lui) ET
//  reçoit les webhooks signés. Chaque étape est vérifiée côté ROUTE et dans l'APP :
//    E1 inscription : compte neuf, essai disponible, l'app propose l'essai ;
//    E2 l'app coche les CGV et paie : la route ouvre la session Stripe (CGV et
//       accès immédiat datés, essai 7 j) ; le client paie avec « 4242 » ;
//       les webhooks rangent l'essai ; l'app dit « Essai gratuit » ;
//    E3 fin de l'essai : premier prélèvement 16,99 € ; l'app dit « Abonné » ;
//    E4 Solo : 1 compte vendeur par plateforme — la vente d'un autre compte
//       Vinted est hors offre ; Pro (19,99 €) : tous les comptes vendent ;
//    E5 parrainage : lien du parrain, rattaché à l'inscription du filleul ;
//       au PREMIER paiement réel (jamais l'essai à 0 €), un mois offert à chacun
//       (crédit −16,99 € sur les deux soldes Stripe), webhook rejoué sans doublon ;
//       la MÊME carte que le parrain ⇒ rien pour le parrain (si la règle est là) ;
//    E6 résiliation depuis l'app (2 clics) : accès jusqu'à la fin de période ;
//    E7 fin de période : accès réduit à l'APERÇU (décision du 8 nov.) — extrait
//       net, reste flouté, `inert`, aucune écriture, rien supprimé.
//  390 px tactile et 1512 px, clair et sombre. Rouge si une étape casse.
//  `--prouve` : mutations (webhook sans signature vérifiée, essai à 0 € qui
//  crédite, lecture seule qui laisse écrire…) ⇒ rouge exigé.
//  Aucune donnée réelle : tout est inventé ici (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const RACINE = process.env.AUDIT_RACINE || path.join(__dirname, '..', '..');
if (process.argv.includes('--prouve')) {
  const { prouver } = require('../_mutations-audit.cjs');
  process.env.BANC_SANS_RENDU = '1';   // la partie ROUTE suffit à juger les mutations serveur
  prouver(__filename, path.join(__dirname, '..', '..'), {
    'signature non vérifiée': [['api/compte.js', "if (!brut || !signatureValide(brut, entete, secret)) return repondre(res, 400, { erreur: 'signature invalide' });", "if (!brut) return repondre(res, 400, { erreur: 'signature invalide' });"]],
    'essai à 0 € crédite': [['api/_lib/parrainage.js', 'const paye = Number(facture && facture.amount_paid) > 0;', 'const paye = true;']],
    'crédit rejoué': [['api/_lib/parrainage.js', "if (lu.data.data.some((t) => t && t.metadata && t.metadata.vrm_parrainage === cle)) return true;", '']],
    'résiliation immédiate': [['api/compte.js', "{ cancel_at_period_end: reprendre ? 'false' : 'true' },", "{ cancel_at_period_end: 'false' },"]],
    'CGV pas exigées': [['api/compte.js', "if (!corps || corps.cgv !== true) return repondre(res, 400, { erreur: 'cgv', message: \"Coche « J'accepte les conditions générales de vente » avant de payer.\" });", '']],
    'Solo jamais bridé': [['api/_lib/plan-regle.js', "  return uidValide(u) && u !== regle.vendeur;", '  return false;']],
  }, ['public']);
  return;
}
const { creerMonde, appeler, livrer, brancherEnv, remplirMentions, uuid } = require(path.join(__dirname, '..', '_monde-paiement.cjs'));
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4547;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-paiement-bout-en-bout');
fs.mkdirSync(CAPTURES, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
let ko = 0, ok = 0, attente = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.stack || e).split('\n').slice(0, 2).join(' ').slice(0, 220)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

(async () => {
  const M = creerMonde({ proprio: uuid(9) });
  brancherEnv(M);
  global.fetch = M.fetch;
  let compte, plan;
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; plan = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-regle.js')); }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); return fin(); }
  const parrainageLib = await import('file://' + path.join(RACINE, 'api', '_lib', 'parrainage.js'));
  await remplirMentions(RACINE);
  const ex = await import('file://' + path.join(RACINE, 'src', 'exempleDonnees.js'));
  const exBase = await import('file://' + path.join(RACINE, 'src', 'exempleBase.js'));
  const jeu = ex.jeuExemple(Date.now());
  // Une cliente qui a déjà fait « Tu vends quoi ? » (le parcours d'arrivée a son banc).
  const main = jeu.lignes.find((l) => l.id === 'main');
  if (main) main.data.vrm_configuration = { etat: 'fait', at: new Date().toISOString(), statut: null, version: 1 };

  // Les personnes (inventées). La cliente est le compte du mode exemple : ses
  // données (ventes, annonces) servent à juger l'aperçu flouté.
  const jwt = (id, email) => `eyJhbGciOiJub25lIn0.${b64({ sub: id, email, exp: Math.floor(Date.now() / 1000) + 3600, amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] })}.sig`;
  const personne = (id, email, creeIlYa = 0) => { const jeton = jwt(id, email); M.users[jeton] = { id, email, created_at: new Date(Date.now() - creeIlYa).toISOString() }; return { id, email, jeton, h: { authorization: 'Bearer ' + jeton } }; };
  const P = personne(uuid(2), 'parrain@exemple.test', 60 * 864e5);            // le parrain, client depuis longtemps
  const F = personne(ex.UID_EXEMPLE, 'cliente@exemple.test');                   // la cliente (filleule)
  const G = personne(uuid(3), 'filleul2@exemple.test');                         // un 2e filleul… à la carte du parrain
  const H = personne(uuid(4), 'pro@exemple.test');                              // une cliente Pro
  M.base.vinted.push({ owner: F.id, vinted_user_id: '111', login: 'vendeuse_a' }, { owner: F.id, vinted_user_id: '222', login: 'vendeuse_b' },
    { owner: P.id, vinted_user_id: '333', login: 'parrain_a' }, { owner: G.id, vinted_user_id: '444', login: 'g_a' }, { owner: H.id, vinted_user_id: '555', login: 'h_a' }, { owner: H.id, vinted_user_id: '666', login: 'h_b' });
  const route = (qui, mode, corps, method) => appeler(compte, { method: method || (corps ? 'POST' : 'GET'), mode, headers: qui.h, corps });
  const abonnement = async (qui) => (await route(qui, 'abonnement')).corps;
  const sessionDe = (url) => (/\/pay\/(cs_\d+)/.exec(url || '') || [])[1];
  // Un abonnement complet par la route (pour le parrain et la cliente Pro).
  const abonner = async (qui, extra = {}, carte) => {
    const r = await route(qui, 'checkout', { cgv: true, accesImmediat: true, ...extra });
    if (r.code !== 200) throw new Error('checkout ' + r.code + ' ' + JSON.stringify(r.corps));
    const p = M.payer(sessionDe(r.corps.url), carte ? { empreinte: carte } : {});
    await livrer(compte, M, p.evenements);
    return p;
  };

  console.log('\n── Côté ROUTE (le vrai api/compte.js, webhooks signés)');
  let pP, pF, pG;
  await essaie('parrain', async () => {
    pP = await abonner(P, {}, 'fp_carte_du_parrain');
    await livrer(compte, M, M.finEssai(pP.sub));
    dit(M.base.abonnements[P.id] && M.base.abonnements[P.id].statut === 'active', 'le parrain est abonné (essai puis 16,99 €)', M.base.abonnements[P.id] && M.base.abonnements[P.id].statut);
  });
  let code = null;
  await essaie('E1', async () => {
    const a = await abonnement(F);
    dit(a.ok && a.essaiDispo === true && a.actif === false && a.prixConforme === true && a.offres.solo.texte === '16,99 € / mois', 'E1 · inscription : compte neuf, essai disponible, Solo 16,99 € / mois', JSON.stringify({ essai: a.essaiDispo, actif: a.actif, solo: a.offres && a.offres.solo }));
    code = (await route(P, 'parrainage')).corps.code;
    const r = await route(F, 'parrainage', { action: 'rattacher', code });
    dit(/^[A-Z0-9]{8}$/.test(code || '') && r.code === 200 && M.base.parrainages[F.id] && M.base.parrainages[F.id].parrain === P.id, 'E5a · le lien du parrain rattache la cliente (inscrite il y a moins de 30 jours)', `${code} · HTTP ${r.code}`);
    const r2 = await route(P, 'parrainage', { action: 'rattacher', code });
    dit(r2.code >= 400 && r2.corps.raison === 'soi-meme', '  soi-même : refusé', JSON.stringify(r2.corps));
  });
  await essaie('E2 route', async () => {
    const sans = await route(F, 'checkout', { accesImmediat: true });
    dit(sans.code === 400 && sans.corps.erreur === 'cgv' && !Object.keys(M.stripe.sessions).some((k) => M.stripe.sessions[k].f.client_reference_id === F.id), 'E2 · sans CGV cochées : refusé, aucune session Stripe', `HTTP ${sans.code}`);
  });

  // ── La partie APP (Playwright) ─────────────────────────────────────────────
  const rendu = !process.env.BANC_SANS_RENDU && fs.existsSync(path.join(DIST, 'index.html'));
  let nav = null, srv = null;
  const visites = [];
  if (rendu) {
    const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
    srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
    await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); });
    nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  } else console.log('  (rendu sauté : ' + (process.env.BANC_SANS_RENDU ? 'BANC_SANS_RENDU' : 'dist/ absent, lance npm run build') + ')');
  async function ouvrir({ qui = F, tab = 'settings', vue = 'abonnement', largeur = 1512, sombre = false, url = null }) {
    const mobile = largeur < 600;
    const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light' });
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
    const session = { access_token: qui.jeton, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: qui.id, email: qui.email } };
    await pg.addInitScript(({ s, vue, sombre }) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); if (vue) localStorage.setItem('vrm_reglages_vue', vue); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: new Date().toISOString() })); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ at: Date.now() })); } catch (_) {} }, { s: session, vue, sombre });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue());
    await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: qui.jeton, refresh_token: 'r', expires_in: 3600, user: session.user }) }));
    const rest = { lectures: 0, ecritures: 0, origine: '' };
    await pg.route('**/rest/v1/**', async (r) => {
      const u = r.request().url(), m = r.request().method();
      if (!rest.origine) rest.origine = new URL(u).origin;
      if (/\/rpc\//.test(u)) { const x = await M.fetch(u, { method: m, headers: { authorization: 'Bearer ' + qui.jeton, Authorization: 'Bearer ' + qui.jeton }, body: r.request().postData() }); return r.fulfill({ status: x.status, contentType: 'application/json', body: await x.text() }); }
      if (m === 'GET') rest.lectures++; else rest.ecritures++;
      const url = new URL(u), table = url.pathname.slice('/rest/v1/'.length).split('/')[0];
      const t = table === 'app_data' ? { lignes: jeu.lignes } : table === 'vinted_accounts' ? { lignes: jeu.comptes } : { lignes: [] };
      const x = exBase.servirTable(t, { methode: m, url: url.pathname + url.search, entetes: r.request().headers(), corps: r.request().postData(), owner: ex.UID_EXEMPLE });
      return r.fulfill({ status: x.status, headers: x.headers, body: x.status === 204 || x.body == null ? '' : (typeof x.body === 'string' ? x.body : JSON.stringify(x.body)) });
    });
    const appels = [];
    // ⚠️ /api/compte : le VRAI handler, dans ce processus, dans le monde simulé.
    await pg.route('**/api/**', async (r) => {
      const q = r.request(), url = new URL(q.url());
      // Les modes de l'ARGENT vont au vrai handler ; les autres (confidentialité, mesures…) ont leurs bancs.
      if (url.pathname === '/api/compte' && /^(abonnement|checkout|portail|resilier|reprendre|parrainage|factures|compte-vendeur|changer-plan)$/.test(url.searchParams.get('mode') || '')) {
        const query = Object.fromEntries(url.searchParams);
        appels.push({ mode: query.mode, m: q.method() });
        const res = await appeler(compte, { method: q.method(), query, headers: q.headers(), corps: q.postData() });
        return r.fulfill({ status: res.code || 200, contentType: 'application/json', body: JSON.stringify(res.corps == null ? {} : res.corps) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    const stripe = [];
    await pg.route('https://checkout.stripe.com/**', (r) => { stripe.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe simulé</title><p>Paiement simulé</p>' }); });
    await pg.goto(url || `http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3800);
    return { ctx, pg, erreurs, appels, rest, stripe };
  }
  const lirePage = (pg) => pg.evaluate(() => {
    const w = document.querySelector('[data-abonnement]');
    return { etat: w && w.getAttribute('data-abonnement'), fin: w && w.getAttribute('data-abonnement-etat'), texte: w ? w.innerText : '', boutons: w ? [...w.querySelectorAll('button')].map((x) => x.innerText.trim()) : [], deborde: document.documentElement.scrollWidth - window.innerWidth };
  });
  const capture = async (pg, nom) => { const f = path.join(CAPTURES, nom + '.png'); await pg.screenshot({ path: f }).catch(() => {}); visites.push(f); };

  await essaie('E1 aperçu', async () => {
    if (!rendu) return;
    // Abonnement obligatoire, jamais abonnée : un DÉBUT (« Bienvenue »), pas « a pris fin ».
    const { ctx, pg } = await ouvrir({ tab: 'ventes', vue: 'reglages', largeur: 1512 });
    await pg.waitForTimeout(1200);
    const c = await pg.evaluate(() => { const k = document.querySelector('[data-carte-apercu]'); return k ? { t: k.innerText, nouveau: !!k.querySelector('[data-apercu-nouveau]') } : null; });
    dit(c && c.nouveau && /Bienvenue sur VRM/.test(c.t) && !/a pris fin/.test(c.t), 'E1 (app, 1512) · nouvelle cliente : la carte dit « Bienvenue sur VRM », jamais « a pris fin »', c && c.t.replace(/\n/g, ' · '));
    await capture(pg, 'e1-apercu-nouvelle-1512');
    await ctx.close();
  });
  await essaie('E2 app', async () => {
    if (!rendu) {   // le même chemin, par la route seule
      pF = await abonner(F, {}, 'fp_carte_cliente');
      return;
    }
    const { ctx, pg, erreurs, appels, stripe } = await ouvrir({ largeur: 390 });
    const p = await lirePage(pg);
    dit(p.fin === 'sans' && /7 jours gratuits/.test(p.texte) && p.boutons.some((b) => /Commencer l'essai gratuit de 7 jours/.test(b)) && !erreurs.length, 'E1 (app, 390) · « 7 jours gratuits », puis 16,99 €, et le bouton d’essai', `${p.fin} · ${p.boutons.join(' · ')} ${erreurs.join('|')}`);
    await capture(pg, 'e1-inscription-390');
    const bouton = pg.locator('[data-sabonner]');
    dit(await bouton.isDisabled(), '  le bouton reste fermé tant que les deux cases ne sont pas cochées');
    await pg.locator('[data-case-cgv]').click(); await pg.locator('[data-case-acces-immediat]').click();
    await bouton.click(); await pg.waitForTimeout(1800);
    const sid = sessionDe(stripe[0]);
    const s = sid && M.stripe.sessions[sid];
    dit(!!s && appels.some((a) => a.mode === 'checkout' && a.m === 'POST'), 'E2 (app → route) · le clic ouvre la VRAIE session Stripe', stripe[0] || JSON.stringify(appels));
    dit(s && s.f['subscription_data[trial_period_days]'] === '7' && s.f['line_items[0][price]'] === 'price_solo_monde' && /^\d{4}-/.test(s.f['subscription_data[metadata][cgv_acceptees_le]'] || '') && s.f['subscription_data[metadata][acces_immediat_demande_le]'] === s.f['subscription_data[metadata][cgv_acceptees_le]'] && s.f.client_reference_id === F.id,
      '  session : prix Solo, essai 7 j, CGV et accès immédiat DATÉS, au nom de la cliente (jamais d’un champ du navigateur)', s && JSON.stringify({ essai: s.f['subscription_data[trial_period_days]'], prix: s.f['line_items[0][price]'] }));
    // La cliente paie avec 4242 sur la page Stripe ; Stripe envoie ses webhooks.
    pF = M.payer(sid, { empreinte: 'fp_carte_cliente' });
    const r = await livrer(compte, M, pF.evenements);
    dit(r.every((x) => x.code === 200) && M.base.abonnements[F.id].statut === 'trialing' && Object.keys(M.base.essais).some((k) => k === 'email:cliente@exemple.test'), 'E2 (webhook) · essai rangé (trialing), essai consommé pour cet e-mail', r.map((x) => x.code).join(','));
    await ctx.close();
  });
  await essaie('E2 bis', async () => {
    const a = await abonnement(F);
    dit(a.statut === 'trialing' && a.actif === true && a.essaiDispo === false && !!a.finEssai && a.plan === 'solo', 'E2 (route) · « essai », accès ouvert, plus d’essai à reprendre, plan Solo', JSON.stringify({ s: a.statut, plan: a.plan }));
    const encore = await route(F, 'checkout', { cgv: true, accesImmediat: true });
    dit(encore.code === 409 && encore.corps.erreur === 'deja', '  un 2e paiement : refusé (« déjà abonné »)', `HTTP ${encore.code}`);
    const soldes = Object.values(M.stripe.soldes).flat().length;
    dit(soldes === 0, 'E5b · la facture d’essai à 0 € n’offre AUCUN mois', `${soldes} crédit(s)`);
    if (!rendu) return;
    const { ctx, pg } = await ouvrir({ largeur: 1512, sombre: true, url: `http://localhost:${PORT}/?tab=settings&vue=abonnement&abonnement=merci` });
    const p = await lirePage(pg);
    dit(p.fin === 'essai' && /Encore 7 jours d'essai|Encore 6 jours d'essai/.test(p.texte) && /16,99\s€/.test(p.texte) && p.boutons.includes('Résilier'), 'E2 (app, 1512 sombre) · retour de Stripe : « Encore 7 jours d’essai », 16,99 € ensuite, « Résilier »', p.texte.replace(/\n/g, ' ').slice(0, 140));
    await capture(pg, 'e2-essai-1512-sombre');
    await ctx.close();
  });

  await essaie('E3', async () => {
    const n0 = M.appels.length; const r = await livrer(compte, M, M.finEssai(pF.sub)); if (process.env.DEBUG) console.log(M.appels.slice(n0));
    const a = await abonnement(F);
    dit(r.every((x) => x.code === 200) && a.statut === 'active' && a.prixAbonnement && a.prixAbonnement.texte === '16,99 € / mois', 'E3 (webhook → route) · fin d’essai : premier prélèvement, « Abonné · 16,99 € / mois »', JSON.stringify({ s: a.statut, p: a.prixAbonnement && a.prixAbonnement.texte, codes: r.map((x) => x.code + ':' + JSON.stringify(x.corps)) }));
    const sf = M.stripe.soldes[pF.client] || [], sp = M.stripe.soldes[pP.client] || [];
    dit(sf.length === 1 && sf[0].amount === -1699 && sp.length === 1 && sp[0].amount === -1699, 'E5c · premier paiement réel : un mois offert (−16,99 €) à la cliente ET au parrain', `cliente ${JSON.stringify(sf.map((x) => x.amount))} · parrain ${JSON.stringify(sp.map((x) => x.amount))}`);
    const s = (await route(P, 'parrainage')).corps.suivi;
    dit(s && s.inscrits === 1 && s.payes === 1 && s.moisOfferts === 1, '  le parrain voit « 1 inscrit, 1 a payé, 1 mois offert » (des nombres)', JSON.stringify(s));
    const deja = M.stripe.subs[pF.sub]; const rejeu = M.evenement('invoice.paid', { id: 'in_rejoue', customer: pF.client, amount_paid: 1699, subscription: deja.id });
    await appeler(compte, { method: 'POST', mode: 'webhook', headers: { 'stripe-signature': M.signer(rejeu) }, corps: rejeu });
    dit((M.stripe.soldes[pF.client] || []).length === 1 && (M.stripe.soldes[pP.client] || []).length === 1, '  webhook rejoué : rien en double', JSON.stringify({ c: (M.stripe.soldes[pF.client] || []).length, p: (M.stripe.soldes[pP.client] || []).length }));
    // Stripe a crédité mais la base n'a pas noté (écriture perdue) : le rejeu ne crédite pas deux fois.
    M.base.parrainages[F.id].credit_filleul_le = null; M.base.parrainages[F.id].credit_parrain_le = null;
    const rejeu2 = M.evenement('invoice.paid', { id: 'in_rejoue2', customer: pF.client, amount_paid: 1699, subscription: deja.id });
    await appeler(compte, { method: 'POST', mode: 'webhook', headers: { 'stripe-signature': M.signer(rejeu2) }, corps: rejeu2 });
    dit((M.stripe.soldes[pF.client] || []).length === 1 && (M.stripe.soldes[pP.client] || []).length === 1, '  crédit déjà posé chez Stripe mais pas noté en base : toujours UN mois (relu chez Stripe)', JSON.stringify({ c: (M.stripe.soldes[pF.client] || []).length, p: (M.stripe.soldes[pP.client] || []).length }));
    const pirate = M.evenement('customer.subscription.updated', { ...deja, status: 'canceled' });
    const rp = await appeler(compte, { method: 'POST', mode: 'webhook', headers: { 'stripe-signature': M.signer(pirate, 'whsec_pirate') }, corps: pirate });
    dit(rp.code === 400 && M.base.abonnements[F.id].statut === 'active', '  un webhook mal signé ne change RIEN', `HTTP ${rp.code}`);
    if (!rendu) return;
    const { ctx, pg } = await ouvrir({ largeur: 390, sombre: true });
    const p = await lirePage(pg);
    dit(p.fin === 'actif' && /Abonné · 16,99/.test(p.texte) && /Prochain prélèvement le/.test(p.texte) && p.deborde <= 0, 'E3 (app, 390 sombre) · « Abonné · 16,99 € / mois », prochain prélèvement, rien ne déborde', p.texte.replace(/\n/g, ' ').slice(0, 120));
    await capture(pg, 'e3-abonne-390-sombre');
    await ctx.close();
  });

  await essaie('E5 même carte', async () => {
    const r = await route(G, 'parrainage', { action: 'rattacher', code });
    pG = await abonner(G, {}, 'fp_carte_du_parrain');                 // la carte du parrain
    await livrer(compte, M, M.finEssai(pG.sub));
    const sp = M.stripe.soldes[pP.client] || [];
    if (typeof parrainageLib.memeCarte !== 'function') {
      attente++;
      console.log(`  ⏸ E5d · même carte que le parrain : la règle (memeCarte, branche claude/agent2-argent-parrainage) n’est pas sur cette branche — le parrain a ${sp.length} crédit(s). Ce contrôle s’allume tout seul quand elle arrive.`);
    } else dit(r.code === 200 && sp.length === 1, 'E5d · un filleul qui paie avec la CARTE du parrain : aucun mois de plus pour le parrain', `${sp.length} crédit(s) parrain`);
  });

  await essaie('E4', async () => {
    const choix = await route(F, 'compte-vendeur', { uid: '111' });
    const a = await abonnement(F);
    const regle = plan.regleVentes(a);
    dit(choix.code === 200 && a.plan === 'solo' && a.compteVendeur && a.compteVendeur.uid === '111' && regle.bride === true, 'E4 · Solo : la cliente choisit SON compte vendeur Vinted (111)', JSON.stringify({ http: choix.code, plan: a.plan, cv: a.compteVendeur }));
    dit(plan.venteHorsPlan(regle, '222') === true && plan.venteHorsPlan(regle, '111') === false, '  Solo : la vente du compte 222 est hors offre (compte d’achat), celle de 111 compte');
    const pH = await abonner(H, { plan: 'pro' }, 'fp_carte_pro');
    const b = await abonnement(H);
    const rb = plan.regleVentes(b);
    dit(b.plan === 'pro' && M.stripe.subs[pH.sub].items.data[0].price.unit_amount === 1999 && rb.bride === false && plan.venteHorsPlan(rb, '555') === false && plan.venteHorsPlan(rb, '666') === false, 'E4 · Pro 19,99 € : comptes vendeurs illimités (555 et 666 vendent)', JSON.stringify({ plan: b.plan, bride: rb.bride }));
    const choixPro = await route(H, 'compte-vendeur', { uid: '555', plateforme: 'pro' });
    dit(choixPro.code === 409, '  en Pro, rien à choisir', `HTTP ${choixPro.code}`);
    if (!rendu) return;
    const { ctx, pg } = await ouvrir({ largeur: 1512 });
    const t = await pg.evaluate(() => { const g = document.querySelector('[data-rangee-compte-vendeur]'); return { g: !!g, t: (document.querySelector('[data-abonnement]') || {}).innerText || '' }; });
    dit(t.g && /Solo/.test(t.t), 'E4 (app, 1512) · la page dit Solo et le compte vendeur choisi', t.t.replace(/\n/g, ' ').slice(0, 160));
    await capture(pg, 'e4-solo-1512');
    await ctx.close();
  });

  await essaie('E6', async () => {
    if (rendu) {
      const { ctx, pg, appels } = await ouvrir({ largeur: 1512 });
      await pg.locator('[data-abonnement] button', { hasText: /^Résilier$/ }).first().click(); await pg.waitForTimeout(500);
      const avant = appels.filter((a) => a.mode === 'resilier').length;
      dit(avant === 0, 'E6 (app) · clic 1 : rien ne part avant la confirmation');
      await pg.locator('button', { hasText: /Confirmer la résiliation|Oui, résilier|^Résilier$/ }).last().click(); await pg.waitForTimeout(1500);
      dit(appels.some((a) => a.mode === 'resilier' && a.m === 'POST'), '  clic 2 : la VRAIE route de résiliation est appelée', JSON.stringify(appels.filter((a) => /resil/.test(a.mode))));
      const p = await lirePage(pg);
      dit(p.fin === 'resilie' && /Fin le/.test(p.texte) && p.boutons.some((b) => /Reprendre/.test(b)), '  la page dit « Résilié · Fin le … » et « Reprendre »', p.texte.replace(/\n/g, ' ').slice(0, 120));
      await capture(pg, 'e6-resilie-1512');
      await ctx.close();
    } else await route(F, 'resilier', {});
    const w = await livrer(compte, M, M.enAttente());                 // Stripe confirme par webhook
    const s = M.stripe.subs[pF.sub], a = await abonnement(F);
    dit(w.length >= 1 && w.every((x) => x.code === 200) && s.cancel_at_period_end === true && s.status === 'active' && a.annuleFinPeriode === true && a.acces === true, 'E6 (Stripe → route) · résiliée À LA FIN de la période : accès gardé jusque-là, aucun autre prélèvement', JSON.stringify({ cape: s.cancel_at_period_end, st: s.status, acces: a.acces }));
  });

  await essaie('E7', async () => {
    const r = await livrer(compte, M, M.finPeriode(pF.sub));
    const a = await abonnement(F);
    dit(r[0].code === 200 && a.statut === 'canceled' && a.acces === false && a.lecture === true && a.lectureSeule === true, 'E7 (webhook → route) · fin de période : accès coupé, LECTURE gardée (aperçu)', JSON.stringify({ s: a.statut, acces: a.acces, lecture: a.lecture }));
    dit(M.base.vinted.filter((x) => x.owner === F.id).length === 2, '  rien n’est supprimé (ses comptes sont là)');
    if (!rendu) return;
    for (const [tab, largeur, sombre] of [['ventes', 1512, false], ['ventes', 390, true]]) {
      const { ctx, pg, rest, erreurs } = await ouvrir({ tab, vue: 'reglages', largeur, sombre });
      await pg.waitForTimeout(1500);
      const x = await pg.evaluate((tab) => {
        const r = document.querySelector('[data-attente-ecran="' + tab + '"]');
        if (!r) return null;
        const fl = [...r.querySelectorAll('[data-apercu-floute]')];
        const listes = [...r.querySelectorAll('*')].filter((e) => e.children.length >= 4 && e.children[3].hasAttribute('data-apercu-floute'));
        const s = fl[0] ? getComputedStyle(fl[0]) : null;
        return { apercu: r.hasAttribute('data-apercu'), floutes: fl.length, extraits: listes.filter((e) => [0, 1, 2].every((i) => !e.children[i].hasAttribute('data-apercu-floute'))).length,
          inertes: fl.every((e) => e.hasAttribute('inert') && e.getAttribute('aria-hidden') === 'true'), flou: s ? s.filter : '', carte: (document.querySelector('[data-carte-apercu]') || {}).innerText || '', porte: !!document.querySelector('[data-abonnement-requis]'), deborde: document.documentElement.scrollWidth - window.innerWidth };
      }, tab);
      const nom = `${tab} ${largeur}${sombre ? ' sombre' : ''}`;
      dit(x && x.apercu && !x.porte && x.extraits >= 1 && x.floutes > 0 && x.inertes && /blur/.test(x.flou) && !erreurs.length, `E7 (app, ${nom}) · aperçu : 3 premières lignes nettes, le reste flouté, inert`, JSON.stringify(x && { a: x.apercu, e: x.extraits, f: x.floutes, i: x.inertes, flou: x.flou }) + ' ' + erreurs.join('|'));
      dit(x && /Ton abonnement a pris fin/.test(x.carte) && /rien n'est supprimé/.test(x.carte) && x.deborde <= 0, '  la carte : « a pris fin · rien n’est supprimé »', x && x.carte.replace(/\n/g, ' · ').slice(0, 120));
      const w = await pg.evaluate(async (o) => { const z = await fetch(o + '/rest/v1/app_data?on_conflict=owner,id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' }); return { s: z.status, j: await z.json().catch(() => null) }; }, rest.origine || 'https://lgonxzrzjcqthjtbdpzo.supabase.co');
      dit(w.s === 403 && w.j && w.j.code === 'vrm-lecture-seule' && rest.ecritures === 0, '  AUCUNE écriture n’atteint la base', JSON.stringify(w) + ` · parties=${rest.ecritures}`);
      await capture(pg, `e7-apercu-${tab}-${largeur}${sombre ? '-sombre' : ''}`);
      await ctx.close();
    }
    const { ctx, pg } = await ouvrir({ largeur: 390 });
    const p = await lirePage(pg);
    dit(p.fin === 'expire' && /a pris fin/.test(p.texte) && p.boutons.some((b) => /Reprendre l'abonnement/.test(b)), 'E7 (app, 390) · Paramètres → Abonnement reste net : « Reprendre l’abonnement »', p.boutons.join(' · '));
    await capture(pg, 'e7-abonnement-390');
    await ctx.close();
  });

  if (nav) await nav.close();
  if (srv) srv.close();
  if (rendu) console.log(`\n  captures : ${CAPTURES}`);
  fin();
  function fin() {
    console.log(ko ? `\n❌ paiement-bout-en-bout : ${ko} rouge(s), ${ok} vert(s)${attente ? `, ${attente} en attente` : ''}` : `\n✅ paiement-bout-en-bout : ${ok} verts, 0 rouge${attente ? `, ${attente} en attente (⏸)` : ''}`);
    process.exit(ko ? 1 : 0);
  }
})();
