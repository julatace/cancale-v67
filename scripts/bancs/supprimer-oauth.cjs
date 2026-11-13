require('./_porte-banc.cjs');
// ═════════════════════════════════════════════════════════════════════════
//  BANC « SUPPRIMER MON COMPTE » SELON LE COMPTE (11 nov., lot suppression-oauth)
//  Bug vécu : un compte créé par Discord (aucun mot de passe) voyait « Ton mot
//  de passe ». 390 px tactile ET 1512 px, clair ET sombre, QUATRE comptes :
//   A  Discord seul, connecté il y a 2 min ⇒ « Tu viens de te connecter avec
//      Discord. », AUCUN champ mot de passe ; « SUPPRIMER » ⇒ envoyé, et le
//      SERVEUR SIMULÉ (la vraie règle api/_lib/suppression-compte.js, sur le jeton
//      reçu) accepte ;
//   B  Discord seul, connecté il y a 30 min ⇒ aucun champ, aucun « SUPPRIMER » :
//      « Me reconnecter avec Discord » ⇒ /authorize?provider=discord, retour sur
//      section=supprimer, contexte de reconnexion posé, AUCUNE intention ; le
//      retour (code PKCE) du MÊME compte ⇒ le panneau rouvert, cas A ; d'un AUTRE
//      compte ⇒ refusé, dit, la session d'avant gardée ;
//   C  mot de passe, connecté il y a 30 min ⇒ le champ ; éteint sans lui ;
//   D  mot de passe (+ Discord relié), connecté il y a 3 min ⇒ pas de champ,
//      « Tu viens de te connecter. » ; « SUPPRIMER » suffit.
//  Données INVENTÉES. Captures : SHOTS (défaut <tmp>/banc-supprimer-oauth) — à REGARDER.
//  Rouge sur le code d'avant (BANC_DIST = un build d'origin/main) : A et B y
//  montrent le champ mot de passe.
// ═════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-supprimer-oauth');
fs.mkdirSync(SHOTS, { recursive: true });
const LARGEURS = (process.env.LARGEURS || '390,1512').split(',').map(Number), THEMES = ['clair', 'sombre'];
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000aa', AUTRE = '7a1e0c55-2b1d-4c3e-9f00-0000000000bb';
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 220) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jeton = ({ providers, methode, ilYaMin, sub = UID }) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: { provider: providers[0], providers }, amr: [{ method: methode, timestamp: Math.floor((Date.now() - ilYaMin * 60e3) / 1000) }] })}.signature-du-banc`;
const INVENTAIRE = { ok: true, proprietaire: false, nombres: { donnees: 12, facturesPro: 0, comptesVinted: 1, preuvesAdresse: 0, indexJetons: 0, signalements: 0 }, abonnement: { actif: false }, fenetreMinutes: 10, mot: 'SUPPRIMER' };
const CAS = {
  A: { providers: ['discord'], methode: 'oauth', ilYaMin: 2 },
  B: { providers: ['discord'], methode: 'oauth', ilYaMin: 30 },
  C: { providers: ['email'], methode: 'password', ilYaMin: 30 },
  D: { providers: ['email', 'discord'], methode: 'password', ilYaMin: 3 },
};

(async () => {
  const NV = require('./nouveau-vendeur.cjs');
  const regle = await import(path.join(__dirname, '..', '..', 'api', '_lib', 'suppression-compte.js'));
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  // Une page du vendeur, avec SA session (le jeton du cas) et le serveur simulé.
  const ouvrirCas = async (W, sombre, cas, { retour } = {}) => {
    const c = CAS[cas], tok = jeton(c);
    const base = { lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 };
    const o = await NV.ouvrir(nav, { W, sombre, base, tab: 'settings' });
    const { pg } = o;
    o.posts = []; o.authorize = []; o.tok = tok;
    await pg.addInitScript(([t, uid]) => { try { if (!sessionStorage.getItem('banc_cas')) { localStorage.setItem('vrm_session', JSON.stringify({ access_token: t, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: uid, email: 'vendeuse@exemple.test' } })); sessionStorage.setItem('banc_cas', '1'); } } catch (_) {} }, [tok, UID]);
    await pg.route('**/auth/v1/user', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: UID, email: 'vendeuse@exemple.test', identities: c.providers.map((p, i) => ({ provider: p, identity_id: 'id-' + i })) }) }));
    await pg.route('**/auth/v1/authorize**', (r) => { o.authorize.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Discord (banc)</title><p>Discord</p>' }); });
    // Le retour PKCE : un NOUVEAU jeton (connexion à l'instant) du compte `retour`.
    await pg.route('**/auth/v1/token?grant_type=pkce*', (r) => {
      const sub = retour === 'autre' ? AUTRE : UID;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: jeton({ providers: c.providers, methode: 'oauth', ilYaMin: 0, sub }), refresh_token: 'r2', expires_in: 3600, user: { id: sub, email: 'vendeuse@exemple.test', identities: c.providers.map((p) => ({ provider: p })), created_at: '2026-01-01T00:00:00Z' } }) });
    });
    await pg.route('**/api/compte?mode=supprimer*', async (r) => {
      const req = r.request();
      if (req.method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INVENTAIRE) });
      const corps = JSON.parse(req.postData() || '{}');
      const jet = String(req.headers().authorization || '').replace(/^Bearer\s+/i, '');
      o.posts.push({ corps, jet });
      // LE SERVEUR SIMULÉ : la vraie règle, sur le jeton reçu (mot de passe du banc : « bon-mot-de-passe »).
      const conf = await regle.verifierConfirmation({ corps, utilisateur: { id: UID, email: 'vendeuse@exemple.test' }, jeton: jet, verifier: async (_e, m) => m === 'bon-mot-de-passe' });
      if (!conf.ok) return r.fulfill({ status: conf.code, contentType: 'application/json', body: JSON.stringify({ ok: false, erreur: conf.erreur, message: conf.message }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, message: `Ton compte VRM est supprimé (banc, ${conf.par}).` }) });
    });
    return o;
  };
  const deplier = async (pg, tag) => {
    await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
    await pg.click('[data-onglets-reglages] [data-vue="compte"]').catch(() => {}); await attendre(400);
    await pg.click('[data-sous-ouvrir="fermer"]', { timeout: 4000 }).catch(() => {}); await attendre(400);
    await pg.locator('[data-fermer-compte] button[aria-expanded="false"]:visible').first().click({ timeout: 10000 }).catch((e) => dit(false, `${tag} : la ligne se déplie`, e.message.split('\n')[0]));
    await attendre(900);
  };
  const lire = (pg) => pg.evaluate(() => {
    const h = [...document.querySelectorAll('[data-fermer-compte]')].find((e) => e.getClientRects().length);
    if (!h) return null;
    const vis = (sel) => [...h.querySelectorAll(sel)].some((e) => e.getClientRects().length);
    const p = h.querySelector('[data-supprimer-preuve]');
    const cibles = [...h.querySelectorAll('button, input')].filter((b) => b.getClientRects().length).map((b) => Math.round(b.getBoundingClientRect().height));
    return { cas: p ? p.getAttribute('data-supprimer-preuve') : null, texte: p ? p.innerText : '', mdp: vis('input[type="password"]'), mot: vis('[data-fermer-confirmation]'),
      bouton: vis('[data-fermer-bouton]'), eteint: !!(h.querySelector('[data-fermer-bouton]') || {}).disabled,
      reco: [...h.querySelectorAll('[data-supprimer-reconnecter]')].filter((e) => e.getClientRects().length).map((e) => e.getAttribute('data-supprimer-reconnecter')),
      erreur: (h.querySelector('[data-supprimer-reco-erreur]') || {}).innerText || '', resultat: (h.querySelector('[data-fermer-resultat]') || {}).getAttribute ? h.querySelector('[data-fermer-resultat]').getAttribute('data-fermer-resultat') : null,
      petit: cibles.length ? Math.min(...cibles) : 0, deborde: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  const capture = async (pg, nom) => {
    const haut = await pg.evaluate(() => { const h = [...document.querySelectorAll('[data-fermer-compte]')].find((e) => e.getClientRects().length); return h ? Math.ceil(h.getBoundingClientRect().bottom + window.scrollY + 120) : 0; });
    const vp = pg.viewportSize();
    if (haut > vp.height) { await pg.setViewportSize({ width: vp.width, height: Math.min(haut, 6000) }); await attendre(300); }
    await pg.evaluate(() => { const h = [...document.querySelectorAll('[data-supprimer-preuve]')].find((e) => e.getClientRects().length); if (h) h.scrollIntoView({ block: 'center' }); });
    await attendre(250);
    await pg.screenshot({ path: path.join(SHOTS, `${nom}.png`) });
  };
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const sombre = theme === 'sombre', tel = W < 600;
      // ── A : Discord, connexion récente ──
      { const tag = `${W}-${theme} A`, o = await ouvrirCas(W, sombre, 'A'); await deplier(o.pg, tag);
        const r = await lire(o.pg);
        dit(r && r.cas === 'oauth-recent', `${tag} : compte Discord récent ⇒ cas oauth-recent`, r);
        dit(r && /Tu viens de te connecter avec Discord\./.test(r.texte) && /SUPPRIMER pour confirmer/.test(r.texte), `${tag} : « Tu viens de te connecter avec Discord. Tape SUPPRIMER pour confirmer. »`, r && r.texte);
        dit(r && !r.mdp, `${tag} : AUCUN champ mot de passe`, r);
        dit(r && r.mot && r.bouton && r.eteint, `${tag} : « SUPPRIMER » demandé, bouton éteint sans lui`, r);
        if (tel) dit(r && r.petit >= 43.5, `${tag} : 44 px au doigt`, r && r.petit);
        dit(r && !r.deborde, `${tag} : rien ne déborde`);
        await capture(o.pg, `A-${W}-${theme}`);
        await o.pg.locator('[data-fermer-confirmation]:visible').first().fill('SUPPRIMER'); await attendre(200);
        await o.pg.locator('[data-fermer-bouton]:visible').first().click(); await attendre(900);
        const f = await lire(o.pg);
        dit(o.posts.length === 1 && !o.posts[0].corps.motDePasse && o.posts[0].corps.confirmation === 'SUPPRIMER', `${tag} : envoyé avec « SUPPRIMER », sans mot de passe`, o.posts.map((p) => p.corps));
        dit(f && f.resultat === 'ferme', `${tag} : le serveur simulé (vraie règle) accepte la connexion récente`, f);
        dit(!o.journal.erreurs.length, `${tag} : aucune erreur de page`, o.journal.erreurs);
        await o.ctx.close(); }
      // ── B : Discord, connexion ancienne ⇒ reconnexion ──
      for (const retour of ['meme', 'autre']) {
        const tag = `${W}-${theme} B/${retour}`, o = await ouvrirCas(W, sombre, 'B', { retour }); await deplier(o.pg, tag);
        const r = await lire(o.pg);
        if (retour === 'meme') {
          dit(r && r.cas === 'oauth-ancien', `${tag} : compte Discord, connexion de 30 min ⇒ cas oauth-ancien`, r);
          dit(r && !r.mdp && !r.mot && !r.bouton, `${tag} : ni mot de passe, ni « SUPPRIMER », ni bouton de suppression`, r);
          dit(r && r.reco.join() === 'discord' && /pas de mot de passe/.test(r.texte), `${tag} : « Me reconnecter avec Discord », et pourquoi`, r);
          if (tel) dit(r && r.petit >= 43.5, `${tag} : 44 px au doigt`, r && r.petit);
          dit(r && !r.deborde, `${tag} : rien ne déborde`);
          await capture(o.pg, `B-${W}-${theme}`);
        }
        // Ce que l'app a rangé AU DÉPART (copié juste avant de quitter la page : Discord est une autre origine).
        await o.pg.evaluate(() => addEventListener('pagehide', () => { try { localStorage.setItem('banc_copie', JSON.stringify({ reco: sessionStorage.getItem('vrm_oauth_reconnexion') || localStorage.getItem('vrm_oauth_reconnexion'), intention: sessionStorage.getItem('vrm_oauth_intention') || localStorage.getItem('vrm_oauth_intention') })); } catch (_) {} }));
        await o.pg.locator('[data-supprimer-reconnecter="discord"]:visible').first().click(); await attendre(1500);
        const u = o.authorize[0] ? new URL(o.authorize[0]) : null;
        dit(u && u.searchParams.get('provider') === 'discord' && /section=supprimer/.test(u.searchParams.get('redirect_to') || ''), `${tag} : /authorize?provider=discord, retour sur « Supprimer mon compte »`, o.authorize[0]);
        // Le retour de Discord (même onglet : le vérificateur PKCE est là).
        await o.pg.goto(`http://localhost:${NV.PORT}/?tab=settings&vue=compte&section=supprimer&code=code-du-banc`, { waitUntil: 'domcontentloaded' }); await attendre(2600);
        await o.pg.click('[data-sous-ouvrir="fermer"]', { timeout: 3000 }).catch(() => {}); await attendre(600);
        const s = await lire(o.pg);
        const ctxReco = await o.pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('banc_copie') || 'null'); } catch (_) { return null; } });
        const sess = await o.pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) { return null; } });
        dit(ctxReco && ctxReco.reco && JSON.parse(ctxReco.reco).owner === UID && !ctxReco.intention, `${tag} : au départ, contexte de reconnexion (ce compte), AUCUNE intention de connexion (rien annulé au retour)`, ctxReco);
        if (retour === 'meme') {
          dit(s && s.cas === 'oauth-recent' && !s.mdp && s.mot, `${tag} : au retour, le panneau rouvert dit « Tu viens de te connecter » ; « SUPPRIMER » demandé`, s);
          dit(sess && sess.user && sess.user.id === UID && sess.access_token !== o.tok, `${tag} : la nouvelle session est celle du MÊME compte`, sess && sess.user);
          await capture(o.pg, `B-retour-${W}-${theme}`);
        } else {
          dit(s && /autre compte VRM/.test(s.erreur) && s.cas === 'oauth-ancien', `${tag} : un AUTRE compte au retour ⇒ refusé, dit, rien d'autre proposé`, s);
          dit(sess && sess.access_token === o.tok, `${tag} : la session d'avant est gardée (l'autre compte n'entre pas)`, sess && sess.user);
          await capture(o.pg, `B-autre-${W}-${theme}`);
        }
        dit(!o.journal.erreurs.length, `${tag} : aucune erreur de page`, o.journal.erreurs);
        await o.ctx.close();
      }
      // ── C : mot de passe, connexion ancienne ──
      { const tag = `${W}-${theme} C`, o = await ouvrirCas(W, sombre, 'C'); await deplier(o.pg, tag);
        const r = await lire(o.pg);
        dit(r && r.cas === 'mdp' && r.mdp && r.mot && !r.reco.length, `${tag} : compte à mot de passe ⇒ le champ mot de passe`, r);
        await o.pg.locator('[data-fermer-confirmation]:visible').first().fill('SUPPRIMER'); await attendre(200);
        dit(await o.pg.locator('[data-fermer-bouton]:visible').first().isDisabled(), `${tag} : « SUPPRIMER » seul ⇒ éteint (connexion ancienne)`);
        await o.pg.locator('[data-supprimer-mdp]:visible').first().fill('mauvais'); await attendre(200);
        await capture(o.pg, `C-${W}-${theme}`);
        await o.pg.locator('[data-fermer-bouton]:visible').first().click(); await attendre(900);
        const f = await o.pg.evaluate(() => { const e = [...document.querySelectorAll('[data-fermer-resultat]')].find((x) => x.getClientRects().length); return e ? { etat: e.getAttribute('data-fermer-resultat'), texte: e.innerText } : null; });
        dit(f && f.etat === 'incomplet' && /Mot de passe incorrect\. Rien n'a été effacé\./.test(f.texte), `${tag} : mauvais mot de passe ⇒ la phrase du serveur, telle quelle`, f);
        dit(!o.journal.erreurs.length, `${tag} : aucune erreur de page`, o.journal.erreurs);
        await o.ctx.close(); }
      // ── D : mot de passe, connexion récente ──
      { const tag = `${W}-${theme} D`, o = await ouvrirCas(W, sombre, 'D'); await deplier(o.pg, tag);
        const r = await lire(o.pg);
        dit(r && r.cas === 'mdp-recent' && !r.mdp && /Tu viens de te connecter\./.test(r.texte), `${tag} : mot de passe + connexion récente ⇒ « Tu viens de te connecter. », pas de champ`, r);
        await o.pg.locator('[data-fermer-confirmation]:visible').first().fill('SUPPRIMER'); await attendre(200);
        dit(!(await o.pg.locator('[data-fermer-bouton]:visible').first().isDisabled()), `${tag} : « SUPPRIMER » suffit`);
        await capture(o.pg, `D-${W}-${theme}`);
        dit(!o.journal.erreurs.length, `${tag} : aucune erreur de page`, o.journal.erreurs);
        await o.ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.stack || e).slice(0, 300)); }
  finally { await nav.close(); NV.srv.close(); }
  console.log(`\n${ok} OK, ${ko} en échec — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
