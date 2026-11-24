require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  SIMULATION DE BOUT EN BOUT DE LA VRAIE EXTENSION (24 nov.) — « regarde tout, fais des simulations » (Julien)
//
//  Un vrai Chromium, la VRAIE extension chargée (`--load-extension`, service worker MV3, scripts de contenu, pont),
//  et des sites SIMULÉS sous leurs vrais noms (DNS de Chromium redirigé, rien ne sort) :
//    · www.vinted.fr / api.vinted.fr : `_sim-vinted.cjs` (la cloche, la nouvelle messagerie, la commande escrow — formes
//      MESURÉES en base, valeurs inventées) ; la page fait elle-même les écritures quand VRM clique ;
//    · vrm.center : `/api/compte?mode=favoris` servi par la VRAIE file du serveur (`api/_lib/favoris-file.js`) et le VRAI
//      résumé de la carte (`api/_lib/favoris-carte.js`) ; le reste par `_e2e-monde.cjs` (GoTrue + PostgREST à état).
//  On juge ce que l'extension FAIT : les requêtes que la page envoie après les clics de VRM (qui, quoi, combien), les
//  lignes écrites, l'état de la file chez VRM et celui de la fenêtre (`vrmActionEnCours`), les captures d'écran.
//
//  Scénarios (`--seul F1,F2…`) :
//    F1  3 favoris lancés depuis la carte : la cloche, la conversation ouverte par la page, l'identité par la COMMANDE
//        (la conversation sans `data.items`), le message puis l'offre ; les nombres de la fenêtre = ceux de VRM.
//    F2  le 2ᵉ favori : la commande dit un AUTRE acheteur ⇒ rien tapé pour lui, « pas envoyé », le 3ᵉ part.
//    F3  autre article dans la commande ; F4 autre conversation (uuid) dans la commande — même règle.
//    F5  429 de Vinted sur la cloche ⇒ pause posée, rien d'écrit.
//    F6  captcha sur la conversation ⇒ arrêt, la file en pause « vérification », plus rien ne part.
//    F7  un autre compte dans l'onglet ⇒ rien ne part.
//    F8  l'onglet de travail fermé en cours de route ⇒ la file s'arrête chez VRM, rien de plus.
//    F9  l'extension rechargée en cours de route ⇒ rien ne part deux fois.
//    F1T / F1T2 (24 nov., 5.440.2) : 17 (25) notifications plus récentes avant les 3 favoris, la cloche n'en montre que 5,
//        la page complète 15 puis la suite au défilement (2 s) ; F1T2 : les favoris sur la page 2 de l'API. 5.440.1 :
//        « Sauté · Favori trop ancien » (le cas de Julien) ; 5.440.2 : 3/3 envoyés.
//  `BANC_EXT=<dossier>` : une autre copie de l'extension ; `SIM_RACINE=<arbre>` : la file du serveur de cet arbre ;
//  `BANC_CAPTURE=<dossier>` : les captures. Données INVENTÉES.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { pathToFileURL } = require('url');
const { monde, certificat, jetonVinted, lireJwt } = require('./_e2e-monde.cjs');
const { fauxVinted } = require('./_sim-vinted.cjs');
const pw = require('playwright');
const RACINE = path.join(__dirname, '..', '..');
const SRV = path.resolve(process.env.SIM_RACINE || RACINE);
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4797;
const EXT0 = path.resolve(process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension'));
const CAPT = process.env.BANC_CAPTURE || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SEULS = arg('--seul') ? arg('--seul').split(',') : null;
const veut = (n) => !SEULS || SEULS.includes(n);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const HOTES = ['vrm.center', 'lgonxzrzjcqthjtbdpzo.supabase.co', 'www.vinted.fr', 'api.vinted.fr', 'images1.vinted.net', 'geo.captcha-delivery.com'];
let ok = 0, ko = 0; const rouges = [];
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; rouges.push(quoi); console.log(`  ❌ ${quoi}${det != null ? ' — ' + String(det).slice(0, 600) : ''}`); } };
const note = (quoi) => console.log(`  ·  ${quoi}`);
const attendreQue = async (fn, ms, pas = 400) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn().catch(() => null); if (v) return v; await attendre(pas); } return null; };

const U = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'vendeur@exemple.test', mdp: 'bon-mot-de-passe' };
const UID = '111', AUTRE = '222';
const ANNONCES = [{ id: 91010001, titre: 'Nike Cortez blanche 42', prix: 60 }, { id: 91010002, titre: 'Adidas Samba noire 41', prix: 75 }, { id: 91010003, titre: 'New Balance 550 grise 43', prix: 90 }];
const FAVORIS = [{ nid: 'n-0001', itemId: '91010001', userId: '3000001', login: 'acheteuse_un' }, { nid: 'n-0002', itemId: '91010002', userId: '3000002', login: 'acheteur_deux' }, { nid: 'n-0003', itemId: '91010003', userId: '3000003', login: 'acheteuse_trois' }];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-sim-ext-'));
const extId = (dir) => crypto.createHash('sha256').update(path.resolve(dir)).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

(async () => {
  const FF = await import(pathToFileURL(path.join(SRV, 'api', '_lib', 'favoris-file.js')).href);
  const FC = await import(pathToFileURL(path.join(SRV, 'api', '_lib', 'favoris-carte.js')).href);
  const FP = await import(pathToFileURL(path.join(SRV, 'src', 'favorisProgression.js')).href);
  const tls = certificat(TMP);
  const M = monde({ tls, port: PORT, dist: TMP, comptes: {}, journal: [] });
  M.USERS.set(U.email, { id: U.id, email: U.email, mdp: U.mdp });
  const V = fauxVinted({ jetonVinted, lireJwt });
  // ── La file du SERVEUR (vraies règles), un état par simulation ─────────────────────────────────────────────
  const S = { d: null, appels: [] };
  const MSG_PSEUDO = 'Bonjour {pseudo}, ton favori est toujours dispo !', MSG_SIMPLE = 'Bonjour, ton favori est toujours dispo !';
  const REGLAGES = { version: 1, envoisActifs: false, message: MSG_PSEUDO, offreMode: 'pct', pourcentage: 10, arrondi: false, intervalleMinutes: 0 };
  const apercu = () => ({ etat: 'pret', total: FAVORIS.length, raison: '', reglages: REGLAGES,
    tous: FAVORIS.map((f) => ({ id: f.nid, notificationId: f.nid, itemId: f.itemId, recipientId: f.userId, cochable: true, envoi: 'a_envoyer', titre: (ANNONCES.find((a) => String(a.id) === f.itemId) || {}).titre, photo: `https://images1.vinted.net/t/${f.itemId}/f800/photo.jpeg` })),
    liste: FAVORIS.map((f) => f.nid) });
  const favorisRoute = (req, res, url, corps) => {
    const u = M.lireJwt(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    const j = (code, o) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(o)); };
    if (!u || u.sub !== U.id) return j(401, { message: 'session' });
    const owner = U.id, maintenant = Date.now();
    let c = {}; try { c = corps ? JSON.parse(corps) : {}; } catch (_) {}
    S.appels.push({ m: req.method, action: c.action || (req.method === 'GET' ? 'lire' : ''), at: maintenant, jeton: c.jeton, brut: c.brut });
    try {
      let r;
      if (req.method === 'GET') r = { valeur: FF.vueFile(FF.initialiserFile(S.d), owner) };
      else if (c.action === 'apercu') return j(200, { ok: true, uid: UID, apercu: apercu(), serveur: maintenant });
      else if (c.action === 'lancer') {
        const targets0 = (c.selection || []).map((nid) => { const f = FAVORIS.find((x) => x.nid === nid); return f && { notificationId: f.nid, itemId: f.itemId, recipientId: f.userId, initiator: f.login }; }).filter(Boolean);
        // La file part des favoris les plus récents (règle du serveur, `ordreRecents`), dates de la liste simulée.
        const targets = FF.ordreRecents ? FF.ordreRecents(targets0, (t) => { const i = FAVORIS.findIndex((x) => x.nid === t.notificationId); return i >= 0 ? new Date(Date.now() - (i + 1) * 300000).toISOString() : null; }) : targets0;
        r = FF.lancerFile(S.d, { owner, targets, message: REGLAGES.message, intervalleMinutes: 0, maintenant, lot: crypto.randomUUID(), pourcentage: 10, offre: { mode: 'pct', valeur: 10, arrondi: false }, rythme: null, plage: { min: 20000, max: 21000 } });
      } else if (c.action === 'suivant') r = FF.reserverFile(S.d, { owner, maintenant, jeton: crypto.randomUUID(), suivi: crypto.randomUUID() });
      else if (c.action === 'consommer') r = FF.consommerFile(S.d, { owner, jeton: c.jeton, maintenant });
      else if (c.action === 'verifier') r = FF.verifierReservation(S.d, { owner, jeton: c.jeton, maintenant });
      else if (c.action === 'terminer') { const t = c.brut && typeof c.brut === 'object' ? FP.traduireResultatFavori(c.brut) : { resultat: c.resultat, raison: c.raison }; r = FF.terminerFile(S.d, { owner, jeton: c.jeton, resultat: t.resultat, raison: t.raison, maintenant, ecrits: Number.isInteger(t.ecrits) ? t.ecrits : null, etape: t.etape || null, cause: t.cause || null }); }
      else if (c.action === 'arreter') r = FF.arreterFile(S.d, owner);
      else if (c.action === 'reprendre') r = FF.reprendreFile(S.d, { owner, maintenant });
      else if (c.action === 'clore') r = FF.cloreIncertains(S.d, { owner, maintenant });
      else return j(400, { message: 'Commande inconnue.' });
      if (r.data) S.d = r.data;
      const act = c.action;
      const vueR = ['suivant', 'consommer', 'verifier'].includes(act) ? r.valeur && r.valeur.vue : r.valeur;
      const pourCarte = req.method === 'GET' ? url.searchParams.get('carte') === '1' : c.carte === true;
      return j(200, { ok: true, uid: UID, ...(['suivant', 'consommer', 'verifier'].includes(act) ? r.valeur : { vue: r.valeur }), ...(pourCarte && vueR ? { carte: FC.resumeFileCarte(vueR, maintenant) } : {}), serveur: maintenant });
    } catch (e) { return j(e instanceof FF.RefusFavoris ? e.status : 503, { message: String(e.message) }); }
  };
  // ── Le routeur : Vinted simulé, la file des favoris, puis le monde e2e (base, GoTrue, vrm.center) ──────────────
  const orig = M.srv.listeners('request')[0];
  M.srv.removeAllListeners('request');
  M.srv.on('request', (req, res) => {
    const host = String(req.headers.host || '').split(':')[0];
    const url = new URL(req.url, 'https://' + host);
    const moi = host === 'www.vinted.fr' || host === 'api.vinted.fr' || host === 'geo.captcha-delivery.com' || (host === 'vrm.center' && url.pathname === '/api/compte' && url.searchParams.get('mode') === 'favoris');
    if (!moi) return orig(req, res);
    let corps = ''; req.on('data', (c) => { corps += c; });
    req.on('end', () => {
      if (host === 'geo.captcha-delivery.com') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><body style="font:16px sans-serif;padding:20px">Vérification DataDome (simulée)</body>'); }
      if (host === 'vrm.center') { if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' }); return res.end(); } return favorisRoute(req, res, url, corps); }
      V.servir(req, res, url, corps, host).catch((e) => { try { res.writeHead(500); res.end(String(e)); } catch (_) {} });
    });
  });
  await M.ecouter();
  // ── Les données (base) : le compte Vinted relié, la capture des notifications, le dressing ─────────────────────
  V.st.comptes[UID] = { login: 'vendeur_a', annonces: ANNONCES, favoris: FAVORIS };
  V.st.comptes[AUTRE] = { login: 'autre_b', annonces: [], favoris: [] };
  const maintenantIso = () => new Date().toISOString();
  const seed = () => {
    M.st.tables.vinted_accounts = [{ id: 1, owner: U.id, vinted_user_id: UID, login: 'vendeur_a', domain: 'www.vinted.fr', updated_at: maintenantIso() }];
    M.st.tables.app_data = [
      { id: `harvest_${UID}_notifications`, owner: U.id, updated_at: maintenantIso(), data: { uid: UID, type: 'notifications', domain: 'www.vinted.fr', capturedAt: maintenantIso(), payload: { notifications: FAVORIS.map((f) => ({ id: f.nid, body: `${f.login} a ajouté ton article à ses favoris`, link: V.st.lienNotif(f), user_id: Number(f.userId), entry_type: 20, subject_id: Number(f.itemId), is_read: false, updated_at: maintenantIso() })) } } },
    ];
  };
  seed();
  const regles = () => HOTES.map((h) => `MAP ${h} 127.0.0.1:${PORT}`).concat(['MAP * ~NOTFOUND']).join(', ');
  const EXT = path.join(TMP, 'ext'); fs.cpSync(EXT0, EXT, { recursive: true });
  // `--mutation nom` : UNE règle réaffaiblie dans la copie de l'extension ; la simulation doit rougir.
  const MUTATIONS = {
    // la conversation ouverte gardée d'un tour à l'autre (la 5.440.1 d'avant le 24 nov.)
    'conv-garde': ['vrm-formulaire.js', "        conv = memeQuAvant ? '' : ici; route = memeQuAvant ? '' : rIci;", '        if (ici) conv = ici; if (rIci) route = rIci;'],
    // l'acheteur de la commande n'est plus comparé
    'commande-acheteur': ['background.js', "if(!acheteur||!attendu||acheteur!==String(attendu.recipientId))return non('commande_autre_acheteur');", ''],
    // (5.440.2) la liste de la cloche jugée sur sa PREMIÈRE page (absente ⇒ « trop ancien »), comme la 5.440.1
    'liste-premiere-page': ['background.js', 'for(let page=2;;page++){', 'for(let page=2;;page++){ix.bout=true;return {bout:true};'],
    // (5.440.2) la page complète déclarée lue sans attendre la suite (≈ la 5.440.1 : 1,4 s sans changement)
    'page-sans-attente': ['vrm-formulaire.js', 'while (Date.now() - t0 < 4000) {', 'while (Date.now() - t0 < 300) {'],
  };
  const MUT = arg('--mutation');
  if (MUT) { const m = MUTATIONS[MUT]; if (!m) { console.log('mutation inconnue'); process.exit(2); } const f = path.join(EXT, m[0]); const t = fs.readFileSync(f, 'utf8'); if (t.split(m[1]).length !== 2) { console.log(`❌ mutation ${MUT} : ancre introuvable`); process.exit(2); } fs.writeFileSync(f, t.replace(m[1], m[2])); console.log(`(mutation « ${MUT} »)`); }
  const ID = extId(EXT);
  const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  console.log(`extension ${VERSION} (${EXT0}) · file du serveur : ${SRV}`);
  const ctx = await pw.chromium.launchPersistentContext(path.join(TMP, 'profil'), { executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1512, height: 950 },
    args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader', '--enable-unsafe-extension-debugging', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  // L'espion d'erreurs du worker (erreurs et rejets non tenus, rangés dans chrome.storage.local : ils survivent au redémarrage).
  const ESPION = () => { if (self.__espion) return; self.__espion = 1; const noter = (k, m) => chrome.storage.local.get('__erreursBanc').then((x) => chrome.storage.local.set({ __erreursBanc: [...((x && x.__erreursBanc) || []), new Date().toISOString().slice(11, 19) + ' ' + k + ' ' + String(m).slice(0, 400)].slice(-30) })).catch(() => {}); self.addEventListener('error', (e) => noter('error', (e.message || '') + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno)); self.addEventListener('unhandledrejection', (e) => noter('rejet', e.reason && (e.reason.stack || e.reason.message) || e.reason)); };
  const sw = async (ms = 20000) => attendreQue(async () => { for (const s of ctx.serviceWorkers().filter((x) => x.url().startsWith(`chrome-extension://${ID}/`)).reverse()) { const p = await Promise.race([s.evaluate(() => typeof authToken === 'function').catch(() => false), attendre(1500).then(() => false)]); if (p) { await s.evaluate(ESPION).catch(() => {}); return s; } } return null; }, ms, 200);
  const dansSW = async (fn, a) => { const s = await sw(8000); if (!s) return { erreur: 'pas de service worker' }; return s.evaluate(fn, a).catch((e) => ({ erreur: String(e.message || e).slice(0, 300) })); };
  const shot = async (pg, nom) => { if (!CAPT || !pg) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, `${VERSION}-${nom}.png`) }).catch(() => {}); };
  const page = async (url) => { const p = await ctx.newPage(); await p.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {}); return p; };
  const fenetre = () => dansSW(async () => { const x = await chrome.storage.local.get(['vrmActionEnCours', 'vrmFavorisCarte']); const f = x.vrmFavorisCarte || null; return { a: Object.assign({}, x.vrmActionEnCours || {}, { lignes: f ? lignesFavoris(f) : null }), f }; });
  const ecrituresVinted = () => V.st.req.filter((e) => e.m !== 'GET' && !e.page && e.m !== 'OPTIONS');
  let erreurs = [];
  ctx.on('page', (p) => p.on('pageerror', (e) => erreurs.push(String(e.message).slice(0, 160))));
  try {
    const w = await sw();
    dit(!!w, 'le service worker de la vraie extension démarre');
    if (!w) throw new Error('pas de service worker');
    // ── Connexion de l'extension à VRM (sa session à elle, comme « Me connecter » de la carte) ──────────────────
    const s = M.ouvrir(M.USERS.get(U.email));
    await dansSW(async (s) => { await chrome.storage.local.set({ vrmSession: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user_id: s.user.id, email: s.user.email } }); }, s);
    // Vinted « ouvert » depuis longtemps (la garde des 2–6 min après l'ouverture n'est pas ce qu'on mesure ici).
    const vt = await page(`https://www.vinted.fr/banc/connexion?uid=${UID}&vers=/inbox`);
    await attendre(2500);
    await dansSW(async () => { const o = (await chrome.storage.local.get('vrmOuverture')).vrmOuverture; const n = {}; for (const k of Object.keys(o || {})) n[k] = Number(o[k]) - 3600e3; if (o) await chrome.storage.local.set({ vrmOuverture: n }); });
    const compteOnglet = await dansSW(async () => compteConnecte('www.vinted.fr'));
    dit(String(compteOnglet) === UID, 'le compte de l’onglet est lu (cookie de Vinted)', compteOnglet);
    await shot(vt, '0-inbox');

    // Lance une file depuis la carte, par le VRAI gestionnaire du message de la carte (`favorisCarte`).
    const lancer = async (sel) => {
      const tabId = await dansSW(async () => { const t = await chrome.tabs.query({ url: 'https://www.vinted.fr/*' }); return t.length ? t[0].id : null; });
      const ap = await dansSW(async ([uid, tabId]) => favorisCarte({ quoi: 'apercu', uid }, { tab: await chrome.tabs.get(tabId) }), [UID, tabId]);
      const r = await dansSW(async ([uid, tabId, sel, reg, ids]) => favorisCarte({ quoi: 'lancer', uid, confirme: true, selection: sel, reglages: reg, items: sel.map((n) => ({ itemId: ids[n], notificationId: n, photo: `https://images1.vinted.net/t/${n}/f800/photo.jpeg`, titre: 'Paire ' + n.slice(-1) })) }, { tab: await chrome.tabs.get(tabId) }), [UID, tabId, sel, REGLAGES, Object.fromEntries(FAVORIS.map((f) => [f.nid, f.itemId]))]);
      return { ap, r };
    };
    const vue = () => FF.vueFile(FF.initialiserFile(S.d), U.id);
    const finFile = (ms) => attendreQue(async () => { const v = vue(); const f = await fenetre(); return !v.active && f.f && !f.f.actif ? { v, f } : null; }, ms, 1500);
    const jobs = () => (vue().jobs || []);
    const parItem = () => Object.fromEntries(jobs().map((x) => [String(x.itemId || String(x.id || '').split(':')[0]), `${x.etat}${x.raison ? ':' + x.raison : ''}${x.cause ? '/' + x.cause : ''}${x.etape ? '@' + x.etape : ''}`]));
    const reset = async () => {
      S.d = null; V.st.req = []; V.st.ancienneConv = 200; Object.assign(V.st, { avant: 0, intercale: null, paginer: false, clocheN: 0, pageTaille: 20, suiteMs: 0 }); REGLAGES.message = MSG_PSEUDO; V.st.forcer = []; V.st.captchaSur = null; V.st.commande = {}; V.st.convs.clear(); seed();
      await dansSW(async () => { await chrome.storage.local.remove(['vrmFavorisCarte', 'vrmActionEnCours', 'vrmPauseVinted', 'vrmCaptcha', 'vrmFavorisApercu', 'vrmTextesRecents', 'vrmToutArrete']); });
    };

    // ══ F1 : 3 favoris, identité par la commande ═════════════════════════════════════════════════════════════════
    for (const F1 of ['F1', 'F1W', 'F1M', 'F1E', 'F1P', 'F1T', 'F1T2', 'F1X']) if (veut(F1)) {
      const T = F1 === 'F1T' || F1 === 'F1T2' || F1 === 'F1X';
      // F1X (Julien, 24 nov. : « si les favoris sont dans la cloche, rends l'extension intelligente ») : 6 favoris, la cloche
      // n'en montre que 2, les 4 autres seulement sur la page complète (3 lignes, puis la suite au défilement) ⇒ 6/6.
      FAVORIS.splice(3); ANNONCES.splice(3);
      if (F1 === 'F1X') for (let k = 4; k <= 6; k++) { FAVORIS.push({ nid: `n-000${k}`, itemId: String(91010000 + k), userId: String(3000000 + k), login: `acheteur_${k}` }); ANNONCES.push({ id: 91010000 + k, titre: `Paire simulée ${k}`, prix: 50 + k }); }
      const N = FAVORIS.length;
      for (const [i, f] of FAVORIS.entries()) f.forme = F1 === 'F1W' || T ? 'web' : F1 === 'F1M' ? (i === 1 ? 'web' : 'app') : 'app';
      if (F1 === 'F1X') console.log('\n── F1X. 6 favoris (liens web) : 2 dans la cloche ; 12 autres notifications ; les 4 autres seulement sur la page complète, après défilement (10 lignes, puis la suite en 2 s)');
      else if (T) console.log(`\n── ${F1}. (24 nov., Julien : « Sauté · Favori trop ancien » pour des favoris de la veille) liens web ; ${F1 === 'F1T' ? 17 : 25} notifications plus récentes avant les 3 favoris ; la cloche n’en montre que 5 ; la page complète 15, puis la suite au défilement (2 s)${F1 === 'F1T2' ? ' ; les favoris sur la page 2 de l’API' : ''}`);
      if (T) {} else if (F1 === 'F1W' || F1 === 'F1M') console.log(`\n── ${F1}. trois favoris, liens ${F1 === 'F1W' ? 'web (/items/N/want_it/new?offering_id=N)' : 'mêlés (app, web, app)'}`); else console.log(F1 === 'F1P' ? '\n── F1P. ancienne relecture refusée (commande), message avec {pseudo}' : F1 === 'F1' ? '\n── F1. trois favoris lancés depuis la carte (l’ancienne relecture répond, comme mesuré le 21 nov.)' : '\n── F1E. les mêmes, l’ancienne relecture REFUSÉE : nouvelle messagerie, identité par la commande');
      await reset();
      if (F1 === 'F1X') Object.assign(V.st, { avant: 0, intercale: { apres: 2, n: 12 }, paginer: true, clocheN: 2, pageTaille: 10, suiteMs: 2000 }); seed();
      if (T && F1 !== 'F1X') Object.assign(V.st, { avant: F1 === 'F1T' ? 17 : 25, paginer: true, clocheN: 5, pageTaille: 15, suiteMs: 2000 });
      if (F1 === 'F1E' || F1 === 'F1P') V.st.ancienneConv = 404;
      if (F1 === 'F1E') REGLAGES.message = MSG_SIMPLE;
      if (F1 === 'F1P') console.log('   (F1P : la même chose avec un message qui porte {pseudo})');
      const { ap, r } = await lancer(FAVORIS.map((f) => f.nid));
      dit(ap && ap.ok, 'l’aperçu est relu chez VRM', JSON.stringify(ap).slice(0, 300));
      dit(r && r.ok, 'la file part (son clic « Lancer »)', JSON.stringify(r).slice(0, 400));
      let vuFen = false;
      const t0 = Date.now();
      const res = await attendreQue(async () => {
        const f = await fenetre();
        if (!vuFen && f.a && f.a.lignes) { vuFen = true; const tw = ctx.pages().find((p) => /vinted\.fr\/inbox\//.test(p.url())); if (tw) await shot(tw, F1 + '-pendant'); }
        const v = vue(); return !v.active && f.f && !f.f.actif ? { v, f } : null;
      }, 600000, 2000);
      note(`durée ${Math.round((Date.now() - t0) / 1000)} s`);
      const ecr = ecrituresVinted();
      const inq = ecr.filter((e) => /inquiries$/.test(e.p)), msgs = ecr.filter((e) => /\/replies$/.test(e.p)), offres = ecr.filter((e) => /\/offers$/.test(e.p));
      const envT = (jobs() || []).filter((x) => x.etat === 'envoye').length, E = T ? envT : N;
      dit(!!res, 'la file se termine', JSON.stringify(parItem()));
      dit(inq.length === E && inq.every((e) => e.uid === UID), E + ' conversations ouvertes PAR LA PAGE, au nom du compte de l’onglet', inq.map((e) => e.corps).join(' | '));
      dit(msgs.length === E && msgs.every((e) => { let t = ''; try { t = String(JSON.parse(e.corps).content || ''); } catch (_) {} return e.uid === UID && /ton favori est toujours dispo/.test(t) && !/[{}]/.test(t); }), N + ' messages envoyés par la page', msgs.map((e) => e.corps.slice(0, 80)).join(' | '));
      dit(offres.length === E, E + ' offres (réduction de 10 %) envoyées par la page', offres.map((e) => e.p + ' ' + e.corps).join(' | '));
      if (F1 === 'F1E' || F1 === 'F1P') dit(V.st.req.some((e) => /escrow-orders/.test(e.p)), 'la commande escrow est relue (identité par la commande)', V.st.req.filter((e) => e.h === 'api.vinted.fr').map((e) => e.m + ' ' + e.p).slice(0, 12).join(' '));
      dit(ecr.every((e) => !e.origine.startsWith('chrome-extension')), 'aucune écriture partie du service worker (toutes de la page)', ecr.map((e) => e.origine).join(','));
      for (const cv of V.st.convs.values()) { const ordre = [...cv.messages.map(() => 'm'), ...cv.offres.map(() => 'o')]; void ordre; }
      const b = FP.bilanFavoris(jobs());
      const f = res && res.f;
      note(`bilan VRM ${JSON.stringify(b)} · carte ${JSON.stringify(f && f.f && f.f.file)}`);
      dit(T ? b.envoyes >= (F1 === 'F1X' ? 2 : 0) && jobs().every((x) => x.etat === 'envoye' || (x.etat === 'refuse' && x.raison === 'notification_pas_trouvee' && x.ecrits === 0)) : b.envoyes === N, T ? `VRM : ${b.envoyes}/${N} envoyés, les autres « pas trouvé sur la page : ouvre la page des notifications sur vinted.fr », rien d’écrit pour eux` : `VRM : ${N} envoyés`, JSON.stringify(parItem()));
      if (F1 === 'F1X') { const ordre = inq.map((e) => { try { return String(JSON.parse(e.corps).item_id || ''); } catch (_) { return ''; } }); const pages = V.st.req.filter((e) => e.page && /^\/member\/notifications/.test(e.p)).length;
        dit(ordre.length >= 2 && JSON.stringify(ordre) === JSON.stringify(FAVORIS.slice(0, ordre.length).map((f) => f.itemId)), 'du plus récent au plus ancien (ceux de la cloche d’abord)', JSON.stringify(ordre));
        dit(pages >= 1, 'la page complète ouverte pour les favoris plus bas que la cloche', 'pages complètes : ' + pages); }
      if (T) dit(!jobs().some((x) => x.raison === 'favori_trop_ancien'), 'aucun favori « trop ancien » (la liste de Vinted les contient, de la veille)', JSON.stringify(parItem()));
      const fenL = f && f.a && Array.isArray(f.a.lignes) ? f.a.lignes : [];
      dit(fenL.length === N && fenL.filter((l) => l.etat === 'envoye').length === b.envoyes, `la fenêtre : ${N} lignes, autant « envoyé » que chez VRM`, JSON.stringify(fenL.map((l) => l.etat)));
      dit(f && f.f && f.f.file && Number(f.f.file.envoyes) === b.envoyes, 'les nombres de la carte = ceux de VRM', JSON.stringify(f && f.f && f.f.file));
      const tw = ctx.pages().find((p) => /vinted\.fr\/inbox\//.test(p.url())); if (tw) await shot(tw, F1 + '-fin'); await vt.bringToFront().catch(() => {}); await attendre(800); await shot(vt, F1 + '-onglet-de-julien');
    }
    // ══ F2/F3/F4 : un désaccord sur la commande ⇒ ce favori n'est pas envoyé, la file continue ══════════════════════
    FAVORIS.splice(3); ANNONCES.splice(3);
    for (const [nom, desaccord, quoi] of [['F2', { buyer: '3999999' }, 'un AUTRE acheteur'], ['F3', { item: '91019999' }, 'un AUTRE article'], ['F4', { conv: '01a1fdff-0000-7000-a000-000000000000' }, 'une AUTRE conversation']]) {
      if (!veut(nom)) continue;
      console.log(`\n── ${nom}. la commande du 2ᵉ favori dit ${quoi}`);
      await reset(); V.st.ancienneConv = 404; REGLAGES.message = MSG_SIMPLE;
      // Le désaccord ne vaut que pour la conversation du 2ᵉ favori.
      const cmd0 = V.st.commande; void cmd0;
      Object.defineProperty(V.st, 'commande', { configurable: true, get() { const cours = [...V.st.convs.values()].pop(); return cours && cours.itemId === FAVORIS[1].itemId ? desaccord : {}; } });
      await lancer(FAVORIS.map((f) => f.nid));
      for (const f of FAVORIS) f.forme = 'app';
      const res = await finFile(600000);
      Object.defineProperty(V.st, 'commande', { configurable: true, writable: true, value: {} });
      const msgs = ecrituresVinted().filter((e) => /\/replies$/.test(e.p));
      const conv2 = [...V.st.convs.values()].find((c) => c.itemId === FAVORIS[1].itemId);
      dit(!!res, 'la file se termine', JSON.stringify(parItem()));
      dit(conv2 && conv2.messages.length === 0 && conv2.offres.length === 0, `${quoi} ⇒ rien tapé ni offert au 2ᵉ`, conv2 && JSON.stringify({ m: conv2.messages.length, o: conv2.offres.length }));
      const p = parItem();
      dit(/^refuse/.test(p[FAVORIS[1].itemId] || ''), 'le 2ᵉ est « pas envoyé » chez VRM', JSON.stringify(p));
      dit(/^envoye/.test(p[FAVORIS[2].itemId] || '') && msgs.length === 2, 'le 3ᵉ part quand même (la file continue)', JSON.stringify(p));
      const f = res && res.f; const fenL = f && f.a && Array.isArray(f.a.lignes) ? f.a.lignes : [];
      dit(fenL.length === 3 && fenL[1] && fenL[1].etat === 'pas', 'la fenêtre : la ligne du 2ᵉ dit « pas envoyé »', JSON.stringify(fenL.map((l) => [l.etat, l.r || l.raison])));
      const tw = ctx.pages().find((p2) => /vinted\.fr/.test(p2.url())); if (tw) await shot(tw, `${nom}-fin`);
    }
    // ══ F5 : 429 ══════════════════════════════════════════════════════════════════════════════════════════════════
    if (veut('F5')) {
      console.log('\n── F5. Vinted répond 429 sur la liste de la cloche');
      await reset();
      V.st.forcer.push({ h: 'api', m: 'GET', re: /inbox-notifications\/v1\/notifications$/, status: 429, fois: 50 });
      await lancer(FAVORIS.map((f) => f.nid));
      const pause = await attendreQue(async () => (await dansSW(async () => (await chrome.storage.local.get('vrmPauseVinted')).vrmPauseVinted || null)), 90000, 1500);
      await attendre(4000);
      dit(!!pause, 'la pause de Vinted est posée', JSON.stringify(pause));
      dit(ecrituresVinted().length === 0, 'rien d’écrit chez Vinted', ecrituresVinted().map((e) => e.p).join(' '));
      const f = await fenetre();
      note(`file VRM ${JSON.stringify(parItem())} · attente carte ${f.f && f.f.attente}`);
      dit(!jobs().some((x) => x.etat === 'envoye'), 'aucun favori compté envoyé', JSON.stringify(parItem()));
      const tw = ctx.pages().find((p) => /vinted\.fr/.test(p.url())); if (tw) await shot(tw, 'F5-pause');
    }
    // ══ F6 : captcha ══════════════════════════════════════════════════════════════════════════════════════════════
    if (veut('F6')) {
      console.log('\n── F6. un captcha apparaît sur la conversation');
      await reset();
      V.st.captchaSur = /^\/inbox\/[0-9a-f-]{36}/;
      await lancer(FAVORIS.map((f) => f.nid));
      const robot = await attendreQue(async () => { const f = await fenetre(); return f.f && (f.f.robot || f.f.attente === 'verification' || !f.f.actif) ? f : null; }, 240000, 1500);
      await attendre(8000);
      const msgs = ecrituresVinted().filter((e) => /\/replies$|\/offers$/.test(e.p));
      dit(!!robot && (robot.f.robot || robot.f.attente === 'verification'), 'la file est en pause « vérification »', JSON.stringify(robot && { robot: robot.f.robot, attente: robot.f.attente, actif: robot.f.actif, fin: robot.f.fin }));
      dit(msgs.length === 0, 'aucun message ni offre après le captcha', msgs.map((e) => e.p).join(' '));
      dit(ecrituresVinted().filter((e) => /inquiries$/.test(e.p)).length <= 1, 'pas d’autre conversation ouverte ensuite', ecrituresVinted().map((e) => e.p).join(' '));
      const tw = ctx.pages().find((p) => /vinted\.fr\/inbox\//.test(p.url())); if (tw) await shot(tw, 'F6-captcha');
      V.st.captchaSur = null;
      await dansSW(async () => { await chrome.storage.local.remove(['vrmCaptcha', 'vrmFavorisCarte']); try { const s = await secuLire(); void s; } catch (_) {} });
    }
    // ══ F7 : autre compte dans l'onglet ═══════════════════════════════════════════════════════════════════════════
    if (veut('F7')) {
      console.log('\n── F7. un autre compte connecté dans l’onglet');
      await reset();
      await dansSW(async () => { await chrome.storage.local.remove(['secu']); });
      const r0 = await lancer(FAVORIS.map((f) => f.nid));
      const p2 = await page(`https://www.vinted.fr/banc/connexion?uid=${AUTRE}&vers=/inbox`);
      await attendre(20000);
      const f = await fenetre();
      note(`lancement ${JSON.stringify(r0.r && { ok: r0.r.ok, code: r0.r.code })} · attente ${f.f && f.f.attente} · file ${JSON.stringify(parItem())}`);
      dit(ecrituresVinted().filter((e) => /\/replies$|\/offers$/.test(e.p)).length === 0, 'aucun message ni offre au nom de l’autre compte', ecrituresVinted().map((e) => `${e.uid} ${e.p}`).join(' '));
      dit(ecrituresVinted().every((e) => e.uid === UID), 'aucune écriture sous un autre compte', ecrituresVinted().map((e) => `${e.uid} ${e.p}`).join(' '));
      await shot(p2, 'F7-autre-compte');
      await p2.goto(`https://www.vinted.fr/banc/connexion?uid=${UID}&vers=/inbox`).catch(() => {}); await attendre(1500);
      await dansSW(async ([u]) => { await favorisCarte({ quoi: 'arreter', uid: u }, { tab: (await chrome.tabs.query({ url: 'https://www.vinted.fr/*' }))[0] }); }, [UID]);
    }
    // ══ F8 : onglet de travail fermé ══════════════════════════════════════════════════════════════════════════════
    if (veut('F8')) {
      console.log('\n── F8. l’onglet de travail est fermé pendant l’envoi');
      await reset();
      await lancer(FAVORIS.map((f) => f.nid));
      const premier = await attendreQue(async () => (ecrituresVinted().some((e) => /\/replies$/.test(e.p)) ? true : null), 300000, 1000);
      dit(!!premier, 'le premier message part');
      const st = (await fenetre()).f; const travail = st && st.travail;
      await dansSW(async (id) => { try { await chrome.tabs.remove(id); } catch (_) {} }, travail);
      const n0 = ecrituresVinted().filter((e) => /\/replies$/.test(e.p)).length;
      const res = await attendreQue(async () => { const f = await fenetre(); return f.f && !f.f.actif ? f : null; }, 180000, 2000);
      await attendre(30000);
      const n1 = ecrituresVinted().filter((e) => /\/replies$/.test(e.p)).length;
      dit(!!res && res.f.fin && res.f.fin.raison === 'travail_ferme', 'la file s’arrête : « l’onglet de travail a été fermé »', JSON.stringify(res && res.f.fin));
      dit(n1 <= n0 + 0, 'plus rien ne part après la fermeture', `${n0} → ${n1}`);
      dit(!vue().active, 'la file est arrêtée chez VRM aussi', JSON.stringify(parItem()));
    }
    // ══ F9 : extension rechargée en cours de route ════════════════════════════════════════════════════════════════
    if (veut('F9')) {
      console.log('\n── F9. l’extension est rechargée pendant l’envoi');
      await reset();
      await page(`https://www.vinted.fr/inbox`);
      await lancer(FAVORIS.map((f) => f.nid));
      await attendreQue(async () => (ecrituresVinted().some((e) => /inquiries$/.test(e.p)) ? true : null), 300000, 500);
      const nouveau = ctx.waitForEvent('serviceworker', { timeout: 30000 }).catch(() => null);
      await dansSW(async () => { setTimeout(() => chrome.runtime.reload(), 50); return true; }).catch(() => {});
      const nv = await nouveau; note('nouveau service worker : ' + (nv ? nv.url().split('/').pop() : 'aucun événement'));
      await attendre(3000);
      const w2 = await sw(30000);
      dit(!!w2, 'le service worker redémarre');
      const res = await finFile(600000);
      const parConv = [...V.st.convs.values()].map((c) => c.messages.length);
      note(`file VRM ${JSON.stringify(parItem())} · messages par conversation ${JSON.stringify(parConv)}`);
      dit(parConv.every((n) => n <= 1), 'aucun message envoyé deux fois', JSON.stringify(parConv));
      dit(!jobs().some((x) => x.etat === 'reserve'), 'aucune réservation laissée en suspens chez VRM', JSON.stringify(parItem()));
      void res;
    }
    // ══ L1 : Leboncoin — le compte et ses annonces lus par la page (lbc-inject → lbc-relay → fond) ══════════════
    if (veut('L1')) {
      console.log('\n── L1. Leboncoin : la page lit le compte privé et « Mes annonces »');
      const LBC = 'aaaa1111-0000-4000-8000-000000000001';
      await ctx.route('https://www.leboncoin.fr/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="fr"><head><title>leboncoin (simulation)</title></head><body><h1>Mes annonces</h1></body></html>' }));
      await ctx.route('https://api.leboncoin.fr/**', (r) => { const u = r.request().url(); return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.leboncoin.fr', 'access-control-allow-credentials': 'true' },
        body: JSON.stringify(u.includes('/counter') ? { unread: 2 } : /\/members\/me\/account/.test(u) ? { account: { account_id: LBC, type: 'private' }, member: { account_id: LBC, nickname: { value: 'Vendeur banc' } } } : u.includes('/myads') ? { ads: [{ list_id: 123, subject: 'Nike Air Max 90 blanche', price: [40], images: { urls: ['https://img.leboncoin.fr/photo-banc.jpg'] }, status: 'active' }] } : {}) }); });
      const pl = await page('https://www.leboncoin.fr/compte/part/mes-annonces');
      await attendre(1500);
      await pl.evaluate(async (id) => { await fetch(`https://api.leboncoin.fr/api/messaging/proxy/api/hal/${id}/counter`, { credentials: 'include' }); await fetch('https://api.leboncoin.fr/api/account/v1/members/me/account', { credentials: 'include' }); await fetch('https://api.leboncoin.fr/api/adfinder/v2/myads', { credentials: 'include' }); }, LBC).catch(() => {});
      const lus = await attendreQue(async () => { const a = M.ligne('lbc_accounts'), l = M.ligne('lbc_listings'); return a && l ? { a, l } : null; }, 20000, 500);
      dit(!!lus && lus.a.owner === U.id, 'Leboncoin : le compte est rangé sous CE vendeur', JSON.stringify(M.lignes().map((r) => r.id).filter((x) => /lbc/.test(x))));
      const it = lus && lus.l.data && lus.l.data.items && lus.l.data.items['123'];
      dit(!!it && Array.isArray(it.images) && it.images.length === 1, 'Leboncoin : l’annonce et sa photo sont rangées', JSON.stringify(lus && lus.l.data).slice(0, 300));
      await shot(pl, 'L1-leboncoin');
      await pl.close().catch(() => {});
    }
    // ══ V1 : Vestiaire — le compte de l'onglet lu dans la page, les compteurs de « Mes articles » ═════════════════
    if (veut('V1')) {
      console.log('\n── V1. Vestiaire : le compte de l’onglet (page) et les compteurs de « Mes articles »');
      const nd = { props: { pageProps: { dehydratedState: { queries: [{ queryKey: ['user.user'], state: { status: 'success', data: { id: 4242001 } } }] } } } };
      await ctx.route('https://www.vestiairecollective.com/**', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="fr"><head><title>Vestiaire (simulation)</title></head><body><h1>Mes articles</h1><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nd)}</script></body></html>` }));
      await ctx.route('https://apiv2.vestiairecollective.com/**', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.vestiairecollective.com', 'access-control-allow-credentials': 'true' }, body: JSON.stringify(/products\/count/.test(r.request().url()) ? { data: { productOnSale: 3, productWaitingPicture: 0, productWaitingValidation: 1, productSold: 2, productRefused: 0, productUnreceived: 0 } } : {}) }));
      const pv = await page('https://www.vestiairecollective.com/members/profile/selling/');
      await attendre(2500);
      await pv.evaluate(() => fetch('https://apiv2.vestiairecollective.com/users/me/products/count', { credentials: 'include' })).catch(() => {});
      const vs = await attendreQue(async () => M.ligne('vc_session'), 20000, 500);
      dit(!!vs && vs.data && vs.data.id === '4242001' && vs.owner === U.id, 'Vestiaire : le compte de l’onglet est rangé (`vc_session`, canal de la page)', JSON.stringify(vs && vs.data).slice(0, 200));
      await attendre(2500);
      note('lignes Vestiaire : ' + M.lignes().map((r) => r.id).filter((x) => /^vc_/.test(x)).join(' '));
      await shot(pv, 'V1-vestiaire');
      await pv.close().catch(() => {});
    }
    // ══ C1 : la carte du logo sur vinted.fr (compte relié, « Tout va bien ») ════════════════════════════════════════
    if (veut('C1')) {
      console.log('\n── C1. la carte du logo sur vinted.fr');
      const pc = await page('https://www.vinted.fr/inbox');
      await attendre(3500);
      const etat = await pc.evaluate(() => { const h = document.querySelector('#vrm-badge, [id^="vrm-badge"], vrm-badge'); return { hote: !!h, id: h && h.id }; }).catch(() => null);
      dit(!!etat && etat.hote, 'la carte du logo est posée sur la page Vinted', JSON.stringify(etat));
      await shot(pc, 'C1-logo');
      // Le logo touché : la carte s'ouvre.
      const box = await pc.evaluate(() => { const h = document.querySelector('#vrm-badge, [id^="vrm-badge"], vrm-badge'); if (!h) return null; const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; }).catch(() => null);
      if (box && box.w > 0) { await pc.mouse.click(box.x, box.y); await attendre(2500); await shot(pc, 'C1-carte-ouverte'); }
      // La carte vit dans une racine FERMÉE : « Oui, capter ce compte » est touché à sa place à l'écran (au-dessus du logo).
      if (box && box.w > 0) { await pc.mouse.click(box.x - 168, box.y - 122); await attendre(3000); await shot(pc, 'C1-apres-oui'); }
      const question = await dansSW(async () => { const x = await chrome.storage.local.get(null); return Object.keys(x).filter((k) => /capt|ignor|confirm/i.test(k)).reduce((o, k) => (o[k] = x[k], o), {}); });
      note('après « Oui » : ' + JSON.stringify(question).slice(0, 400));
      if (box && box.w > 0) { await pc.mouse.move(box.x, box.y); await pc.mouse.click(box.x, box.y); await attendre(2500); await shot(pc, 'C1-carte-compte'); }
      const texte = await pc.evaluate(() => { const h = document.getElementById('vrm-badge'); const r = h && h.shadowRoot; return r ? r.textContent.replace(/\s+/g, ' ').slice(0, 600) : '(racine fermée)'; }).catch(() => '');
      note('carte : ' + texte);
      const capte = await dansSW(async () => { try { return await compteNonCapte('111'); } catch (e) { return 'err ' + e.message; } });
      dit(capte === false, 'après « Oui », le compte est capté dans ce navigateur', JSON.stringify(capte));
      note('logo : ' + JSON.stringify(box));
      await pc.close().catch(() => {});
    }
  } catch (e) { dit(false, 'la simulation a levé', e && e.stack); }
  finally {
    if (process.env.SIM_REQ) console.log('REQ\n' + V.st.req.filter((e) => !e.page || process.env.SIM_REQ === '2').map((e) => `${new Date(e.t).toISOString().slice(14, 23)} ${e.uid} ${e.m} ${e.h} ${e.p}${e.page ? ' (page)' : ''} → ${e.status} ${String(e.origine).slice(0, 30)}`).join('\n'));
    if (erreurs.length) note('erreurs de page : ' + [...new Set(erreurs)].slice(0, 5).join(' | '));
    { const e = await dansSW(async () => (await chrome.storage.local.get('__erreursBanc')).__erreursBanc || []); note('erreurs du worker : ' + JSON.stringify(e).slice(0, 1500)); note('workers vus : ' + ctx.serviceWorkers().map((x) => x.url().split('/').pop()).join(',')); }
    if (process.env.SIM_DIAG) { const d = await dansSW(async () => { try { return ((await chrome.storage.local.get('vrmDiagRecents')).vrmDiagRecents || []).map((x) => x.k); } catch (_) { return null; } }); console.log('DIAG', JSON.stringify(d).slice(0, 3000)); }
    await ctx.close().catch(() => {}); await M.fermer().catch(() => {});
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
    console.log(`\n${ko ? '❌' : '✅'} sim-extension ${VERSION} : ${ok} vert(s), ${ko} rouge(s)${ko ? '\n   ' + rouges.join('\n   ') : ''}`);
    process.exit(ko ? 1 : 0);
  }
})();
