require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC E2E « L'APP ET LA VRAIE EXTENSION ENSEMBLE » (11 nov.)
//
//  Un VRAI Chromium (nouveau mode headless), la VRAIE extension chargée depuis
//  son dossier (`--load-extension`, service worker MV3, content scripts, pont),
//  le VRAI build de l'app (`dist/`). Tout est servi en LOCAL sous les vrais
//  noms par `_e2e-monde.cjs` (DNS de Chromium redirigé, `MAP * ~NOTFOUND` pour
//  le reste : rien ne sort) : un faux www.vinted.fr (pages + API v2 à la forme
//  réelle, le compte est celui du cookie `access_token_web`), un faux Supabase
//  à état (GoTrue + PostgREST, RLS par `owner`), vrm.center = `dist/`.
//  Données INVENTÉES (dépôt public) : deux comptes Vinted, vendeur_a (111) et
//  autre_b (222), un vendeur VRM.
//
//  Scénarios (un seul profil Chrome, dans l'ordre, comme une vraie journée) :
//    1. CONNEXION : « Se connecter en passant par le site VRM » dans la fenêtre
//       de l'extension ⇒ VRM s'ouvre, l'extension reçoit une session À ELLE
//       (fabriquée par le serveur), du MÊME compte VRM que l'app ; VRM le dit.
//    2. DRESSING : il ouvre son dressing sur vinted.fr ⇒ annonces rangées
//       (`harvest_111_listings`, sous son vendeur) ⇒ visibles dans Annonces
//       (l'écran natif : `data-eg-article="vinted#{id}"`, rangée visible). Il regarde
//       ensuite le dressing d'un AUTRE membre (222) : rien de cet autre n'entre dans
//       SES annonces (§5).
//    3. VENTE : sa vente Vinted ⇒ dans Ventes (l'écran natif : `data-vn-rang` =
//       `v:{n° de transaction}`), sur SON compte.
//    4. COMMANDE (25 nov. : par le PANNEAU, décision de Julien du 20 nov.) : Annonces
//       → Ancienneté « Dorment » → la paire cochée → « Baisser » ⇒ l'app ouvre le
//       panneau de l'extension sur vinted.fr (la paire cochée) ; il y tape le prix,
//       revoit l'avant / après, « Lancer » : l'extension TAPE le prix dans la page
//       « Modifier » de l'onglet (5.414, c'est la page qui envoie), au nom du compte
//       de l'onglet (cookie 111, aucun `Authorization`), relit le prix, la commande
//       le garde ; plafond plein (45/50) ⇒ RIEN ne part chez Vinted, la commande
//       attend « plafond » ; un 429 ⇒ pause posée, la commande suivante n'envoie RIEN.
//    5. AUTRE COMPTE dans l'onglet (il bascule sur autre_b) : le panneau ne lance pas
//       la baisse de vendeur_a ; une commande postée directement au pont n'envoie
//       RIEN chez Vinted ; et la vente d'autre_b est rangée sous autre_b.
//    6. EXTENSION EN RETARD (manifeste 5.335, avant le panneau ouvert par un lien,
//       `panneaucomplet` 5.410.0) dans un profil neuf : l'app ne promet rien —
//       « Baisser » fermé, il dit de la mettre à jour, aucun onglet, aucune commande.
//
//  Preuve (§6.1) : `--mutation NOM` exécute le banc sur une copie de
//  l'extension (ou de `dist/`) où UNE règle est réaffaiblie : il doit être
//  ROUGE. `--prouve` les lance toutes (chacune doit rougir) après un passage
//  vert. Mutations (table MUTATIONS) : liaison, autre-membre, compte-capture,
//  garde-compte, plafond, pause-429, capacite.
//
//  Usage : npm run build && node scripts/bancs/e2e-extension.cjs [--mutation m | --prouve] [--seul 1,2]
//  Port : 4796 (`BANC_PORT`). `BANC_CAPTURE=<dossier>` : captures d'écran.
//  `BANC_DIST` / `BANC_EXT` : un autre build / une autre extension (preuve sur un autre arbre).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const { monde, certificat, jetonVinted, HOTES } = require('./_e2e-monde.cjs');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), path.join(__dirname, '..', '..')]) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const RACINE = path.join(__dirname, '..', '..');
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4796;
const DIST0 = path.resolve(process.env.BANC_DIST || path.join(RACINE, 'dist'));
const EXT0 = path.resolve(process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension'));
const CAPT = process.env.BANC_CAPTURE || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SEULS = arg('--seul') ? arg('--seul').split(',') : null;
const MUT = arg('--mutation');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Les mutations : chacune réaffaiblit UNE règle ; le banc doit rougir ──────
//  `ext` : remplacements dans une COPIE de background.js ; `dist` : dans une
//  copie des fichiers .js de dist/ (le build minifié garde ces littéraux).
const MUTATIONS = {
  // 1 — l'app ne fabrique plus la session de l'extension (la liaison casse)
  liaison: { dist: [[/mode=session-extension/g, 'mode=session-extension-cassee']] },
  // 2 — le dressing d'un AUTRE membre rangé comme le sien
  'autre-membre': { ext: [["if (!pid || id == null || String(id) !== pid) { noterDiag('ignore_dressing_autre_membre'); return; }", '']] },
  // 3 — une capture rangée sous un compte qui n'est PAS celui de l'onglet
  'compte-capture': { ext: [['  const uid = await activeAccountId(domain);\n  if (!uid) { noterDiag(`abandon_sans_compte_${type || \'inconnu\'}`); return; }', "  const uid = '111';"]] },
  // 4/5 — la garde du compte de l'onglet ne compare plus les comptes
  'garde-compte': { ext: [['  if (String(actif) !== String(uid)) {\n    return { ok: false, code: \'vinted-autre\'', "  if (false) {\n    return { ok: false, code: 'vinted-autre'"]] },
  // 4 — le plafond d'actions ne compte plus
  plafond: { ext: [['  const c = await compterAction(String(uid), ACTIONS_MAX_HEURE - reserve, nA);', '  const c = { ok: true, at: Date.now() };']] },
  // 4 — un 429 ne pose plus de pause
  'pause-429': { ext: [['const freinVinted = (s) => s === 429 || s === 403;', 'const freinVinted = (s) => false;']] },
  // 6 — l'app croit le lien du panneau arrivé dès la 5.335 (elle promet à une extension qui l'ignore)
  capacite: { dist: [[/panneaucomplet:"5\.410\.0"/g, 'panneaucomplet:"5.335.0"']] },
};

let ko = 0, ok = 0;
const resultats = [];
const dit = (bon, quoi, det) => { resultats.push({ bon: !!bon, quoi }); if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); } };
// Un CONSTAT : un écart mesuré sur le code d'aujourd'hui, rapporté (⚠️) sans rougir le banc —
// sauf BANC_STRICT=1. Il dit ce qui reste à corriger, jamais une règle déclarée tenue.
const constats = [];
const constat = (bon, quoi, det) => { if (process.env.BANC_STRICT) return dit(bon, quoi, det); if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { constats.push(quoi); console.log(`  ⚠️  CONSTAT ${quoi} — ${String(det || '').slice(0, 400)}`); } };
const veut = (n) => !SEULS || SEULS.includes(String(n));

// ── --prouve : un passage vert, puis chaque mutation doit rougir ─────────────
if (process.argv.includes('--prouve')) {
  const lancer = (extra) => spawnSync(process.execPath, [__filename, ...extra], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 900000, encoding: 'utf8' });
  const base = lancer([]);
  const vert = base.status === 0;
  console.log(`${vert ? '✅' : '❌'} passage sur le code tel quel : ${vert ? 'vert' : 'ROUGE'}`);
  if (!vert) console.log(String(base.stdout).split('\n').filter((l) => /❌/.test(l)).join('\n'));
  let rate = vert ? 0 : 1;
  for (const m of Object.keys(MUTATIONS)) {
    const r = lancer(['--mutation', m]);
    const rouges = String(r.stdout).split('\n').filter((l) => /❌/.test(l));
    const bon = r.status !== 0 && rouges.length > 0;
    if (!bon) rate++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${m} » : ${bon ? `rouge (${rouges.length} contrôle(s))` : 'RESTE VERTE — le banc ne la voit pas'}`);
    for (const l of rouges.slice(0, 3)) console.log('     ' + l.trim());
  }
  process.exit(rate ? 1 : 0);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-e2e-ext-'));
const extId = (dir) => crypto.createHash('sha256').update(path.resolve(dir)).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

// Une copie de l'extension (son identifiant ne dépend pas de l'emplacement du
// dépôt), mutée si demandé ; `version` : un manifeste plus ancien (scénario 6).
function preparerExtension(nom, { version } = {}) {
  const d = path.join(TMP, nom);
  fs.cpSync(EXT0, d, { recursive: true });
  const m = MUT && MUTATIONS[MUT] && MUTATIONS[MUT].ext;
  if (m) {
    const f = path.join(d, 'background.js');
    let s = fs.readFileSync(f, 'utf8');
    for (const [a, b] of m) { if (!s.includes(a)) { console.log(`❌ mutation ${MUT} : texte introuvable dans background.js (le banc ne mute plus rien)`); process.exit(2); } s = s.split(a).join(b); }
    fs.writeFileSync(f, s);
  }
  if (version) {
    const mf = path.join(d, 'manifest.json');
    const j = JSON.parse(fs.readFileSync(mf, 'utf8')); j.version = version; fs.writeFileSync(mf, JSON.stringify(j, null, 2));
    const f = path.join(d, 'background.js');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/const CODE_VERSION = '[\d.]+';/, `const CODE_VERSION = '${version}';`));
  }
  return d;
}
function preparerDist() {
  const m = MUT && MUTATIONS[MUT] && MUTATIONS[MUT].dist;
  if (!m) return DIST0;
  const d = path.join(TMP, 'dist');
  fs.cpSync(DIST0, d, { recursive: true });
  let touche = 0;
  const marcher = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) marcher(p); else if (/\.js$/.test(f)) { const s = fs.readFileSync(p, 'utf8'); let t = s; for (const [a, b] of m) t = t.replace(a, b); if (t !== s) { touche++; fs.writeFileSync(p, t); } } } };
  marcher(d);
  if (!touche) { console.log(`❌ mutation ${MUT} : rien trouvé à muter dans dist/`); process.exit(2); }
  return d;
}

// ── Les données inventées ─────────────────────────────────────────────────
const U = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'vendeur@exemple.test', mdp: 'bon-mot-de-passe' };
const ilYa = (j) => Math.floor((Date.now() - j * 86400e3) / 1000);
const COMPTES = () => ({
  111: { login: 'vendeur_a',
    annonces: [{ id: 91010001, titre: 'Nike Cortez blanche', prix: 60, cree: ilYa(95) }, { id: 91010002, titre: 'Adidas Samba noire', prix: 75, cree: ilYa(3) }],
    ventes: [{ tx: 7001001, titre: 'Nike Dunk Low grise', prix: 80, itemId: 91010009 }] },
  222: { login: 'autre_b',
    annonces: [{ id: 92020001, titre: 'Puma Suede rouge', prix: 40, cree: ilYa(20) }, { id: 92020002, titre: 'Asics Gel Lyte', prix: 55, cree: ilYa(20) }, { id: 92020003, titre: 'Vans Old Skool', prix: 35, cree: ilYa(20) }],
    ventes: [{ tx: 8002001, titre: 'New Balance 550', prix: 90, itemId: 92020009 }] },
});

// ── Chromium + extension ────────────────────────────────────────────────────
const regles = () => HOTES.map((h) => `MAP ${h} 127.0.0.1:${PORT}`).concat(['MAP * ~NOTFOUND']).join(', ');
function lancer(udd, ext) {
  const args = ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader',
    '--enable-unsafe-extension-debugging', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`];
  return pw.chromium.launchPersistentContext(udd, { executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1512, height: 950 }, args });
}
// Le service worker VIVANT (ses fonctions évaluées, `chrome.storage` présent).
async function sw(ctx, id, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    for (const s of ctx.serviceWorkers().filter((x) => x.url().startsWith(`chrome-extension://${id}/`)).reverse()) {
      const pret = await Promise.race([s.evaluate(() => typeof chrome !== 'undefined' && !!chrome.storage && typeof authToken === 'function').catch(() => false), attendre(1500).then(() => false)]);
      if (pret) return s;
    }
    await attendre(200);
  }
  return null;
}
const dansSW = async (ctx, id, fn, a) => { const s = await sw(ctx, id, 8000); if (!s) return { erreur: 'pas de service worker' }; return s.evaluate(fn, a).catch((e) => ({ erreur: String(e.message || e).slice(0, 200) })); };
const attendreQue = async (fn, ms, pas = 300) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn().catch(() => null); if (v) return v; await attendre(pas); } return null; };
const capture = async (pg, nom) => { if (process.env.BANC_DEBUG && pg && pg.__enCours) { console.log('     EN COURS', nom, [...pg.__enCours.values()].map((u) => u.slice(0, 140))); console.log('     TEXTE', nom, (await pg.evaluate(() => document.visibilityState + ' focus=' + document.hasFocus() + ' ' + document.body.innerText).catch(() => '')).replace(/\s+/g, ' ').slice(0, 1500)); } if (!CAPT || !pg) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png') }).catch(() => {}); };

// La session de l'app (comme `session.cjs`) : posée une fois, base cloisonnée.
async function poserSessionApp(ctx, s) {
  await ctx.addInitScript(({ s, uid }) => {
    if (location.origin !== 'https://vrm.center') return;
    try {
      localStorage.setItem('schema_cloisonne', '1');
      localStorage.setItem('vrm_ext_separee_' + uid, '1');
      if (s && !localStorage.getItem('__banc_pose')) { localStorage.setItem('__banc_pose', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); }
      window.__VRM_BAISSE_PAUSE = 0;
    } catch (_) {}
  }, { s, uid: U.id });
}

// ── (25 nov., e2e-extension-vert) LA BAISSE PASSE PAR LE PANNEAU DE L'EXTENSION ─────────────────────────────────────────
// Depuis le 20 nov. (décision de Julien, src/actionsExtension.js) l'app ne fait plus AUCUN geste sur Vinted : « Baisser »
// ouvre le PANNEAU de l'extension sur vinted.fr (src/ouvrirPanneau.js, `?vrm=panneau&page=prix&ids=…&action=baisser`), la
// paire pré-cochée ; c'est LÀ qu'il tape le prix, revoit l'avant / après et lance. L'extension range la commande
// (`cmd_prix_*`, `changerPrixCarte`) puis la passe par `baisserPrixVinted` (compte de l'onglet, plafond, pause, relu) ; depuis
// la 5.414 le prix est TAPÉ dans la page « Modifier » et c'est la PAGE qui envoie sa requête. Les règles jugées ne changent
// pas : la même paire (qui dort), UNE modification, au nom du compte de l'onglet, sans Authorization, relue, dite ;
// plafond plein ⇒ rien ; 429 ⇒ pause ; autre compte ⇒ rien ; extension trop ancienne ⇒ l'app ne promet rien.
//
// Annonces (écran natif) : Ancienneté → Dorment, la paire cochée par SON identité Vinted (`data-eg-article="vinted#{id}"`),
// puis le bouton de la barre de sélection. Les gestes passent par le DOM (une feuille « Depuis ta dernière visite » peut
// recouvrir l'écran : elle n'empêche pas son doigt de fermer d'abord, le banc juge la règle, pas la pile des feuilles).
let ID_COURANT = '';   // l'extension du profil principal (son service worker)
const clicDom = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel).catch(() => false);
async function ouvrirAnnoncesDorment(pg) {
  await pg.bringToFront();
  await pg.goto('https://vrm.center/?tab=cat_annonces', { waitUntil: 'domcontentloaded' });
  await attendreQue(() => pg.evaluate(() => document.querySelectorAll('[data-eg-ecran] [data-eg-article]').length > 0), 40000, 300);
  await clicDom(pg, '[data-tt-ouvre="filtre:dort"]'); await attendre(300);
  await clicDom(pg, '[data-tt-filtre-choix="dort:dorment"]'); await attendre(800);
  return pg.evaluate(() => [...document.querySelectorAll('[data-eg-ecran] [data-eg-article]')].map((x) => x.getAttribute('data-eg-article'))).catch(() => []);
}
// Le bouton « Baisser » de la barre de sélection : { ouvert, raison } (raison = la phrase sous un bouton fermé).
const lireBoutonBaisser = (pg) => pg.evaluate(() => {
  const b = document.querySelector('[data-tt-action-directe="baisser"]');
  if (!b) return null;
  const r = b.getAttribute('aria-describedby') ? document.getElementById(b.getAttribute('aria-describedby')) : null;
  return { ouvert: b.getAttribute('aria-disabled') !== 'true' && !b.disabled, raison: r ? r.textContent : '', texte: b.textContent };
}).catch(() => null);
// Coche la paire (qui dort) et touche « Baisser » : rend le lien du panneau ouvert (la requête de navigation), ou ce qui manque.
async function baisserDepuisApp(ctx, pg, id) {
  const lignes = await ouvrirAnnoncesDorment(pg);
  const cle = 'vinted#' + id;
  if (!lignes.includes(cle)) return { absente: true, lignes };
  await pg.evaluate((c) => { const r = document.querySelector(`[data-eg-ecran] [data-eg-article="${c}"]`); const x = r && r.querySelector('input.n-tt-coche'); if (x && !x.checked) x.click(); }, cle);
  await attendreQue(() => pg.evaluate(() => !!document.querySelector('[data-tt-action-directe="baisser"]')), 8000, 200);
  const bouton = await lireBoutonBaisser(pg);
  const liens = [];
  const surRequete = (r) => { try { if (r.isNavigationRequest() && /^https:\/\/www\.vinted\.fr\/\?vrm=panneau/.test(r.url())) liens.push(r.url()); } catch (_) {} };
  ctx.on('request', surRequete);
  const nPages = ctx.pages().length;
  if (bouton && bouton.ouvert) await clicDom(pg, '[data-tt-action-directe="baisser"]');
  await attendreQue(async () => liens.length > 0, bouton && bouton.ouvert ? 15000 : 4000, 200);
  ctx.off('request', surRequete);
  const panneauPg = ctx.pages().slice(nPages).find((p) => /^https:\/\/www\.vinted\.fr\//.test(p.url())) || null;
  return { lignes, bouton, lien: liens[0] || '', panneauPg, onglets: ctx.pages().length - nPages };
}
// Le panneau vit dans une racine d'ombre FERMÉE (vrm-badge.js) que Playwright ne traverse pas : le protocole du navigateur
// la montre (DOM.getDocument pierce). On y lit et on y touche comme ses doigts — rien n'est changé dans l'extension.
async function panneau(pg, fn, arg) {
  try {
    const cdp = pg.__cdp || (pg.__cdp = await pg.context().newCDPSession(pg));
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const trouver = (n) => {
      if (!n) return null;
      const a = n.attributes || []; const i = a.indexOf('id');
      if (i >= 0 && i % 2 === 0 && a[i + 1] === 'vrm-badge' && n.shadowRoots && n.shadowRoots[0]) return n.shadowRoots[0];
      for (const c of [...(n.children || []), ...(n.shadowRoots || [])]) { const r = trouver(c); if (r) return r; }
      return null;
    };
    const sr = trouver(root); if (!sr) return null;
    const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: sr.backendNodeId });
    const r = await cdp.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: `function (a) { return (${fn.toString()})(this, a); }`, arguments: [{ value: arg === undefined ? null : arg }], returnByValue: true, awaitPromise: true });
    return r && r.result ? r.result.value : null;
  } catch (e) { return null; }
}
// La question de l'extension à la première visite d'un compte (« c'est bien un de tes comptes à capter ? ») : il répond Oui,
// une fois (vrm-badge.js `rendreQuestion`) — tant qu'elle attend, le panneau reste fermé.
async function repondreQuestionCompte(page, ms = 8000) {
  return attendreQue(() => panneau(page, (R) => { const b = R.querySelector('.question.on [data-choix="oui"]'); if (b) { b.click(); return true; } return false; }), ms, 400);
}
const lirePanneau = (pp, id) => panneau(pp, (R, id) => {
  const sel = R.querySelector('[data-ann-action]');
  const ligne = R.querySelector(`[data-prix-ligne="${id}"]`);
  const etat = R.querySelector('[data-geste-etat]');
  return { pret: !!sel, action: sel ? sel.value : '', coches: [...R.querySelectorAll('[data-ann-sel]')].filter((c) => c.checked).map((c) => c.getAttribute('data-ann-sel')),
    lignes: [...R.querySelectorAll('[data-ann-sel]')].map((c) => c.getAttribute('data-ann-sel')), question: !!R.querySelector('.question.on [data-choix="oui"]'),
    prix: !!R.querySelector(`[data-prix-nouveau="${id}"]`), ligne: ligne ? ligne.innerText.replace(/\s+/g, ' ') : '', aa: !!R.querySelector('[data-aa-vue]'), garde: !!R.querySelector('[data-garde-oui]'),
    etat: etat ? { ok: etat.getAttribute('data-geste-etat'), texte: etat.textContent } : null };
}, id);
// Dans le panneau : « Baisser le prix » (le menu des actions, la paire déjà cochée par le lien), SON prix tapé, « Revoir »,
// puis « Lancer » sur la feuille Avant | Après (et, si la garde le demande, SA confirmation du chiffre). Rend l'état lu.
async function lancerDansPanneau(ctx, pp, id, prix) {
  await pp.bringToFront();
  await repondreQuestionCompte(pp, 3000);
  const avant = await attendreQue(async () => { const l = await lirePanneau(pp, id); return l && l.pret && l.coches.length ? l : null; }, 30000, 400) || await lirePanneau(pp, id);
  if (!avant || !avant.coches.includes(String(id))) return { avant, lance: false };
  await panneau(pp, (R) => { const s = R.querySelector('[data-ann-action]'); s.value = 'baisser'; s.dispatchEvent(new Event('change')); });
  await attendreQue(async () => { const l = await lirePanneau(pp, id); return l && l.prix ? l : null; }, 10000, 300);
  await panneau(pp, (R, a) => { const c = R.querySelector(`[data-prix-nouveau="${a.id}"]`); c.value = a.prix; c.dispatchEvent(new Event('input')); c.dispatchEvent(new Event('change')); }, { id: String(id), prix: String(prix).replace('.', ',') });
  await panneau(pp, (R) => { const b = R.querySelector('[data-prix-confirmer]'); if (b) b.click(); });
  const aa = await attendreQue(async () => { const l = await lirePanneau(pp, id); return l && l.aa ? l : null; }, 10000, 300);
  // (le temps passé) le vendeur a Vinted ouvert depuis longtemps : la discrétion après une OUVERTURE ne le retient pas ici
  // (elle est jugée par l'audit de la discrétion) ; l'espace entre deux baisses en attente non plus (le temps a passé).
  await dansSW(ctx, ID_COURANT, async () => { const m = (await chrome.storage.local.get('vrmOuverture')).vrmOuverture || {}; for (const k of Object.keys(m)) { m[k].depuis = Date.now() - 3600000; m[k].vu = Date.now(); } await chrome.storage.local.set({ vrmOuverture: m }); await chrome.storage.local.remove('vrmPrixAttSuivant'); });
  await panneau(pp, (R) => { const b = R.querySelector('[data-aa-vue] [data-prix-confirmer]'); if (b) b.click(); });
  let apres = await attendreQue(async () => { const l = await lirePanneau(pp, id); return l && (l.etat || l.garde) ? l : null; }, 20000, 400);
  if (apres && apres.garde) {
    await panneau(pp, (R) => { const b = R.querySelector('[data-garde-oui]'); if (b) b.click(); });
    apres = await attendreQue(async () => { const l = await lirePanneau(pp, id); return l && l.etat ? l : null; }, 20000, 400) || apres;
  }
  return { avant, aa, apres, lance: true };
}
// La commande rangée par le panneau pour CETTE annonce (la plus récente), relue dans la base.
const commandePrix = (M, id, depuis = 0) => M.lignes().filter((r) => /^cmd_prix_/.test(r.id) && r.data && r.data.cle === 'vinted:' + id && Number(r.data.demandeLe) >= depuis).sort((a, b) => Number(b.data.demandeLe) - Number(a.data.demandeLe))[0] || null;
const fermerPanneauPg = async (pp) => { if (pp) await pp.close().catch(() => {}); };

// ════════════════════════════════════════════════════════════════════════════
(async () => {
  if (!pw) { console.log('❌ Playwright introuvable'); process.exit(1); }
  if (!fs.existsSync(path.join(DIST0, 'index.html'))) { console.log(`❌ pas de build dans ${DIST0} — lance npm run build`); process.exit(1); }
  if (MUT && !MUTATIONS[MUT]) { console.log(`❌ mutation inconnue : ${MUT} (${Object.keys(MUTATIONS).join(', ')})`); process.exit(2); }
  const DIST = preparerDist();
  const tls = certificat(TMP);
  const journal = [];
  const M = monde({ tls, port: PORT, dist: DIST, comptes: COMPTES(), journal });
  M.USERS.set(U.email, { id: U.id, email: U.email, mdp: U.mdp });
  try { await M.ecouter(); } catch (e) { console.log(`❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); }
  const EXT = preparerExtension('ext');
  const ID = extId(EXT);
  ID_COURANT = ID;
  const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  console.log(`extension ${VERSION} (${ID.slice(0, 8)}…) · app ${DIST}${MUT ? ` · MUTATION « ${MUT} »` : ''}`);
  const ctxs = [];
  const vinted = (f) => M.st.vinted.filter(f || (() => true));
  try {
    const ctx = await lancer(path.join(TMP, 'profil'), EXT); ctxs.push(ctx);
    const erreursApp = [];
    ctx.on('page', (p) => { p.on('pageerror', (e) => { if (/vrm\.center/.test(p.url())) erreursApp.push(String(e.message).slice(0, 160)); }); if (process.env.BANC_DEBUG) { const enCours = new Map(); p.on('request', (r) => enCours.set(r, r.url())); p.on('requestfinished', (r) => enCours.delete(r)); p.on('requestfailed', (r) => { console.log('     ÉCHEC', r.url().slice(0, 160), r.failure() && r.failure().errorText); enCours.delete(r); }); p.__enCours = enCours; } if (process.env.BANC_DEBUG) p.on('console', (m) => { if (/vrm\.center/.test(p.url()) && m.type() !== 'debug') console.log('     app>', m.type(), m.text().slice(0, 200)); }); });
    const sApp = M.ouvrir(M.USERS.get(U.email));
    await poserSessionApp(ctx, { access_token: sApp.access_token, refresh_token: sApp.refresh_token, expires_at: Date.now() + 3600e3, user: sApp.user });
    const w = await sw(ctx, ID);
    dit(!!w, 'le service worker MV3 de la vraie extension démarre dans Chromium headless');
    if (!w) throw new Error('pas de service worker');

    // ══ 1. CONNEXION DE L'EXTENSION À CE COMPTE VRM ═══════════════════════════
    console.log('\n── 1. connexion de l’extension (liaison par le site VRM)');
    let vrm = null;
    {
      const pop = await ctx.newPage();
      await pop.goto(`chrome-extension://${ID}/popup.html`); await attendre(1000);
      const b = await pop.$('#lierBtn');
      dit(!!b, '1 : la fenêtre de l’extension propose de se connecter en passant par VRM');
      if (b) await b.click().catch(() => {});
      vrm = await attendreQue(async () => ctx.pages().find((x) => /^https:\/\/vrm\.center\//.test(x.url())), 15000, 200);
      dit(!!vrm, '1 : un clic ouvre VRM');
      const s = await attendreQue(async () => { const r = await dansSW(ctx, ID, async () => (await chrome.storage.local.get('vrmSession')).vrmSession || null); return r && r.user_id && !r.mort ? r : null; }, 20000);
      dit(!!s && s.user_id === U.id, '1 : l’extension est connectée à CE compte VRM (le même vendeur que l’app)', JSON.stringify(s && { user_id: s.user_id }));
      dit(!!s && s.refresh_token !== sApp.refresh_token, '1 : avec SA session (jamais celle de l’app)');
      const band = vrm ? await attendreQue(() => vrm.evaluate(() => { const x = document.querySelector('[data-liaison]'); return x ? x.getAttribute('data-liaison') : null; }), 10000) : null;
      dit(band === 'ok' || band === 'deja', '1 : VRM le dit (« Extension connectée »)', String(band));
      await capture(vrm, '1-liaison');
      await pop.close().catch(() => {});
    }

    // ══ 2. LE DRESSING ═══════════════════════════════════════════════════════
    // Il se connecte sur vinted.fr (le site pose le cookie de session), puis
    // ouvre son dressing : la page charge, l'extension lit et range.
    const vt = await ctx.newPage();
    if (veut(2) || veut(3) || veut(4) || veut(5)) {
      console.log('\n── 2. visite du dressing ⇒ Annonces');
      await vt.bringToFront(); await vt.goto('https://www.vinted.fr/banc/connexion?uid=111');
      await vt.bringToFront(); await vt.goto('https://www.vinted.fr/member/111-vendeur_a');
      const lignes = await attendreQue(async () => { const l = M.ligne('harvest_111_listings'); const v = M.ligne('harvest_111_orders_sold'); const a = M.lignes('vinted_accounts').find((x) => String(x.vinted_user_id) === '111'); return l && v && a ? { l, v, a } : null; }, 45000, 500);
      await repondreQuestionCompte(vt);   // « c'est bien un de tes comptes à capter ? » — Oui (une fois, comme lui)
      dit(!!lignes, '2 : la visite range le dressing, les ventes et le compte (lignes écrites par l’extension)', JSON.stringify(M.lignes().map((r) => r.id)));
      const items = lignes ? (lignes.l.data.payload.items || []).map((x) => String(x.id)).sort() : [];
      dit(items.join() === '91010001,91010002', '2 : le dressing rangé est celui du compte de l’onglet (ses 2 annonces)', items.join());
      dit(!!lignes && lignes.l.owner === U.id && lignes.a.owner === U.id, '2 : rangé sous CE vendeur VRM (owner du jeton de l’extension)');
      // CONSTAT (11 nov., pas une règle tenue aujourd'hui) : à l'arrivée, la moisson du fond
      // (dans la page) et celle d'inject.js (`activeHarvest`, hors de `requeteVinted`) lisent
      // les mêmes listes, parfois EN MÊME TEMPS. Rapporté ; rouge seulement avec BANC_STRICT=1.
      await attendre(9000);
      const lus = vinted((e) => !e.site && e.p === '/api/v2/users/current').length;
      constat(M.st.maxEnVol <= 1 && lus <= 1, '2 : la visite lit chaque liste UNE fois, une requête à la fois (§3)', `users/current lu ${lus} fois · en vol au plus ${M.st.maxEnVol}${M.st.maxEnVol > 1 ? ' : ' + (M.st.chevauchement || []).join(' | ') : ''}`);
      // Il regarde le dressing d'un autre membre : la page charge SES annonces.
      const n0 = vinted().length;
      await vt.bringToFront(); await vt.goto('https://www.vinted.fr/member/222-autre_b');
      await attendreQue(async () => vinted((e) => e.p === '/api/v2/wardrobe/222/items').length > 0, 15000);
      await attendre(4000);
      const l2 = M.ligne('harvest_111_listings');
      const items2 = l2 ? (l2.data.payload.items || []).map((x) => String(x.id)).sort().join() : '';
      dit(items2 === '91010001,91010002', '2 : le dressing d’un AUTRE membre, vu en passant, n’entre pas dans SES annonces (§5)', items2);
      void n0;
      // L'app : Annonces — l'écran natif (19 nov.) : une rangée par article, son identité Vinted (`vinted#{id}`), VISIBLE
      // (l'ancienne grille `data-carte-annonce` reste montée cachée derrière l'écran natif : la lire ne prouvait rien).
      const pg = vrm || await ctx.newPage();
      await pg.bringToFront(); await pg.goto('https://vrm.center/?tab=cat_annonces', { waitUntil: 'domcontentloaded' });
      const lireRangees = () => pg.evaluate(() => [...document.querySelectorAll('[data-eg-ecran] [data-eg-article]')].filter((x) => x.getClientRects().length > 0).map((x) => x.getAttribute('data-eg-article')));
      const cartes = await attendreQue(async () => { const c = await lireRangees(); return c.length ? c : null; }, 40000, 500) || [];
      await capture(pg, '2-annonces');
      dit(cartes.includes('vinted#91010001') && cartes.includes('vinted#91010002'), '2 : ses annonces sont visibles dans Annonces', JSON.stringify(cartes));
      dit(!cartes.some((c) => /9202\d{4}/.test(c)), '2 : aucune annonce de l’autre membre dans Annonces', JSON.stringify(cartes));

      // ══ 3. LA VENTE ════════════════════════════════════════════════════════
      // Ventes natif (19 nov.) : « À envoyer » est la vue d'arrivée ; chaque rangée porte son identité `v:{n° de transaction}`
      // (`data-vn-rang`, « En route » : `data-vn-route`) — l'ancienne liste `.vrm-sale-row[data-tx]` n'est plus rendue.
      console.log('\n── 3. une vente ⇒ Ventes');
      await pg.bringToFront(); await pg.goto('https://vrm.center/?tab=cat_ventes', { waitUntil: 'domcontentloaded' });
      const lireVentes = () => pg.evaluate(() => [...document.querySelectorAll('[data-vn-rang], [data-vn-route]')].filter((x) => x.getClientRects().length > 0).map((x) => ({ cle: x.getAttribute('data-vn-rang') || x.getAttribute('data-vn-route') || '', texte: (x.innerText || x.textContent || '').replace(/\s+/g, ' ').slice(0, 160) })));
      const ventes = await attendreQue(async () => { const v = await lireVentes(); return v.some((x) => x.cle === 'v:7001001' && /Dunk/.test(x.texte)) ? v : null; }, 40000, 500) || await lireVentes().catch(() => []);
      await capture(pg, '3-ventes');
      const v1 = ventes.find((v) => v.cle === 'v:7001001');
      dit(!!v1, '3 : la vente Vinted est dans Ventes (par son n° de transaction)', JSON.stringify(ventes));
      dit(!!v1 && /Dunk/.test(v1.texte), '3 : avec son titre', v1 && v1.texte);
      dit(!ventes.some((v) => v.cle === 'v:8002001'), '3 : la vente d’un autre compte n’y est pas (jamais lue sous celui-ci)', JSON.stringify(ventes));
    }

    // ══ 4. « BAISSER » DANS L'APP ⇒ LE PANNEAU DE L'EXTENSION ⇒ L'EXTENSION ════════
    const pg = vrm || await ctx.newPage();
    // Le prix que VRM a LU pour la paire (le dressing rangé) : c'est lui que le panneau montre et envoie comme « prix vu ».
    const prixRange = (id) => { const l = M.ligne('harvest_111_listings'); const it = l && (l.data.payload.items || []).find((x) => String(x.id) === String(id)); return it && it.price ? Number(it.price.amount) : null; };
    if (veut(4)) {
      console.log('\n── 4. « Baisser » dans l’app ⇒ le panneau de l’extension sur vinted.fr ⇒ au nom du compte de l’onglet');
      // Il a modifié une fois l'annonce sur vinted.fr (enregistrée sans rien
      // changer) : la page envoie SA fiche, l'extension apprend le format.
      await vt.bringToFront(); await vt.goto('https://www.vinted.fr/items/91010001-annonce/edit');
      await vt.evaluate(async () => {
        const corps = JSON.stringify({ item: { id: 91010001, title: 'Nike Cortez blanche', description: 'Très bon état', price: { amount: '60.0', currency_code: 'EUR' }, catalog_id: 1234, assigned_photos: [{ id: 910100010, orientation: 0 }] } });
        await fetch('/api/v2/item_upload/items/91010001', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-banc-site': '1' }, body: corps });
      });
      const appris = await attendreQue(async () => { const r = M.ligne('vrm_vinted_modele'); return r && r.data && r.data['91010001'] ? r : null; }, 20000);
      dit(!!appris, '4 : son propre enregistrement sur vinted.fr apprend le format de l’annonce (vrm_vinted_modele)');
      const coffre = M.ligne('coffre_111_91010001');
      dit(!!coffre, '4 : l’annonce est sauvegardée dans le coffre (filet avant tout geste)');
      await vt.bringToFront(); await vt.goto('https://www.vinted.fr/member/111-vendeur_a');      // l'onglet reste sur vinted.fr
      await attendre(1500);
      const d0 = vinted().length, t0 = Date.now();
      M.remiseEnVol();
      const r = await baisserDepuisApp(ctx, pg, 91010001);
      await capture(pg, '4-baisse-app');
      dit(!!r.bouton && r.bouton.ouvert && /[?&]page=prix(&|$)/.test(r.lien) && /[?&]ids=91010001(&|$)/.test(r.lien) && /[?&]action=baisser(&|$)/.test(r.lien) && !(r.lignes || []).includes('vinted#91010002'),
        '4 : l’app propose la baisse de la paire qui dort (extension à jour) et ouvre le panneau de l’extension sur elle', JSON.stringify({ lignes: r.lignes, bouton: r.bouton, lien: r.lien }));
      const pp = r.panneauPg;
      const nAvantLancer = () => vinted().slice(d0).filter((e) => e.m === 'PUT').length;
      const lp = pp ? await lancerDansPanneau(ctx, pp, 91010001, 54) : { avant: null };
      await capture(pp, '4-panneau');
      const diag4 = await dansSW(ctx, ID, async () => ({ cache: typeof _infosPage !== 'undefined' && _infosPage ? { age: Date.now() - _infosPage.at, n: Object.keys(_infosPage.parId || {}).length } : null }));
      const hv = M.ligne('harvest_111_listings');
      dit(!!lp.avant && lp.avant.coches.includes('91010001') && lp.avant.action === 'baisser', '4 : le panneau s’ouvre sur vinted.fr, la paire cochée, « Baisser » pré-choisi', JSON.stringify({ avant: lp.avant, diag4, rangees: hv ? (hv.data.payload.items || []).length : null }));
      dit(!!lp.aa && nAvantLancer() <= 1, '4 : avant / après montré avant SON « Lancer »', JSON.stringify(lp.aa));
      const cmd = await attendreQue(async () => { const c = commandePrix(M, 91010001, t0); return c && !['attente', 'pris'].includes(c.data.etat) ? c : null; }, 90000, 500) || commandePrix(M, 91010001, t0);
      await capture(pp, '4-panneau-apres');
      const apres = vinted().slice(d0);
      const puts = apres.filter((e) => e.m === 'PUT' && /item_upload\/items\/91010001/.test(e.p));
      dit(puts.length === 1, '4 : UNE modification de prix part chez Vinted', `${puts.length} PUT · ${apres.map((e) => e.m + ' ' + e.p).join(' | ')} · commande ${JSON.stringify(cmd && cmd.data)}`);
      const p0 = puts[0] || {};
      let prixEnvoye = null; try { prixEnvoye = Number(JSON.parse(p0.corps).item.price.amount); } catch (_) {}
      dit(p0.uid === '111' && !p0.auth, '4 : au nom du compte de l’onglet (cookie 111), depuis la page — aucun Authorization', JSON.stringify({ uid: p0.uid, auth: p0.auth }));
      dit(prixEnvoye === 54 && M.st.prix[91010001] === prixEnvoye, '4 : le prix voulu est arrivé chez Vinted', `${prixEnvoye} · Vinted ${M.st.prix[91010001]}`);
      const getsApres = apres.filter((e) => e.m === 'GET' && /item_upload\/items\/91010001/.test(e.p) && e.t > (p0.t || 0));
      dit(getsApres.length >= 1, '4 : puis le prix est RELU chez Vinted');
      dit(!!cmd && cmd.data.etat === 'fait' && Number(cmd.data.prixVu) === prixEnvoye, '4 : VRM garde le prix RELU (la commande finie, relue par l’app)', JSON.stringify(cmd && cmd.data));
      dit(M.st.maxEnVol <= 1, '4 : pendant la commande, jamais deux requêtes Vinted de l’extension en vol en même temps', `${M.st.maxEnVol} : ${(M.st.chevauchement || []).join(' | ')}`);
      await fermerPanneauPg(pp);

      // Plafond plein : 45 actions déjà faites dans l'heure sur ce compte (50 − réserve 5).
      const n45 = await dansSW(ctx, ID, async () => { const t = Date.now() - 60000; const cur = (await chrome.storage.local.get('vrmActions')).vrmActions || {}; cur['111'] = Array.from({ length: 45 }, (_, i) => t + i); await chrome.storage.local.set({ vrmActions: cur }); return cur['111'].length; });
      { const pr = prixRange(91010001); if (pr) M.st.prix[91010001] = pr; }   // Vinted montre le prix que VRM a lu (l'aperçu en repart)
      const d1 = vinted().length, t1 = Date.now();
      const r2 = await baisserDepuisApp(ctx, pg, 91010001);
      const lp2 = r2.panneauPg ? await lancerDansPanneau(ctx, r2.panneauPg, 91010001, Math.round((M.st.prix[91010001] - 5) * 100) / 100) : {};
      const cmd2 = await attendreQue(async () => { const c = commandePrix(M, 91010001, t1); return c && (c.data.attend || !['attente', 'pris'].includes(c.data.etat)) ? c : null; }, 30000, 500) || commandePrix(M, 91010001, t1);
      const rien = vinted().slice(d1).filter((e) => /item_upload/.test(e.p));
      dit(n45 === 45 && !!lp2.lance && rien.filter((e) => e.m === 'PUT').length === 0, '4 : plafond plein ⇒ RIEN ne part chez Vinted', `${rien.length} requête(s) · ${rien.map((e) => e.m + ' ' + e.p).join(' | ')}`);
      dit(!!cmd2 && /plafond/.test(String(cmd2.data.attend || '') + String(cmd2.data.code || '')), '4 : VRM dit le plafond (la commande attend, motif « plafond »)', JSON.stringify(cmd2 && cmd2.data));
      await fermerPanneauPg(r2.panneauPg);
      await dansSW(ctx, ID, async () => { await chrome.storage.local.set({ vrmActions: {} }); });

      // 429 : Vinted demande de ralentir sur la modification ⇒ pause posée, la suivante n'envoie rien.
      M.st.forcer.push({ m: 'PUT', re: /item_upload\/items\//, status: 429, fois: 1 });
      { const pr = prixRange(91010001); if (pr) M.st.prix[91010001] = pr; }
      const t2 = Date.now();
      const r3 = await baisserDepuisApp(ctx, pg, 91010001);
      const lp3 = r3.panneauPg ? await lancerDansPanneau(ctx, r3.panneauPg, 91010001, Math.round((M.st.prix[91010001] - 6) * 100) / 100) : null;
      await capture(r3.panneauPg, '4-panneau-429');
      await attendreQue(async () => { const c = commandePrix(M, 91010001, t2); return c && (c.data.attend || !['attente', 'pris'].includes(c.data.etat)) ? c : null; }, 60000, 500);
      await fermerPanneauPg(r3.panneauPg);
      const pause = await dansSW(ctx, ID, async () => (await chrome.storage.local.get('vrmPauseVinted')).vrmPauseVinted || null);
      dit(!!pause && Number(pause.jusqua) > Date.now(), '4 : un 429 de Vinted pose la pause', JSON.stringify({ pause, commande: (commandePrix(M, 91010001, t2) || {}).data, panneau: lp3 && lp3.apres, lien: r3.lien, prixVinted: M.st.prix[91010001], toutes: M.lignes().filter((x) => /^cmd_prix_/.test(x.id)).map((x) => x.data.etat + ':' + (x.data.attend || x.data.code || '') + ':' + x.data.prix) }));
      const d3 = vinted().length;
      const r4 = await baisserDepuisApp(ctx, pg, 91010001);
      if (r4.panneauPg) await lancerDansPanneau(ctx, r4.panneauPg, 91010001, Math.round((M.st.prix[91010001] - 7) * 100) / 100);
      await attendre(4000);
      await fermerPanneauPg(r4.panneauPg);
      const pendant = vinted().slice(d3);
      dit(pendant.length === 0, '4 : pendant la pause, la commande suivante n’envoie RIEN chez Vinted', `${pendant.length} · ${pendant.map((e) => e.m + ' ' + e.p).join(' | ')}`);
      await dansSW(ctx, ID, async () => { await chrome.storage.local.remove('vrmPauseVinted'); });
      // Les commandes encore en attente (pause) : annulées comme il le ferait, pour que la suite parte d'une file vide.
      for (const c of M.lignes().filter((x) => /^cmd_prix_/.test(x.id) && x.data && ['attente', 'pris'].includes(x.data.etat))) c.data = { ...c.data, etat: 'annulee', finiLe: Date.now() };
    }

    // ══ 5. UN AUTRE COMPTE DANS L'ONGLET ═════════════════════════════════════
    if (veut(5)) {
      console.log('\n── 5. il bascule l’onglet sur autre_b ⇒ rien n’est fait pour vendeur_a');
      await vt.bringToFront(); await vt.goto('https://www.vinted.fr/banc/connexion?uid=222');
      await vt.bringToFront(); await vt.goto('https://www.vinted.fr/member/222-autre_b');
      const actif = await attendreQue(async () => { const r = await dansSW(ctx, ID, async () => compteConnecte('www.vinted.fr')); return r === '222' ? r : null; }, 15000);
      dit(actif === '222', '5 : l’extension voit autre_b dans l’onglet');
      await repondreQuestionCompte(vt);   // autre_b est aussi un de SES comptes : Oui
      // La vente d'autre_b, lue à la visite, est rangée sous autre_b.
      const v222 = await attendreQue(async () => M.ligne('harvest_222_orders_sold'), 40000, 500);
      const v111 = M.ligne('harvest_111_orders_sold');
      const tx111 = v111 ? (v111.data.payload.my_orders || []).map((o) => String(o.transaction_id)) : [];
      dit(!!v222 && !tx111.includes('8002001'), '5 : la vente d’autre_b est rangée sous autre_b, jamais sous vendeur_a', JSON.stringify({ v222: !!v222, tx111 }));
      // L'app ouvre le panneau pour la paire de vendeur_a ; l'onglet est sur autre_b : le panneau ne la lance pas.
      await attendre(2000);
      const d4 = vinted().length, t4 = Date.now();
      const r = await baisserDepuisApp(ctx, pg, 91010001);
      const lp = r.panneauPg ? await lancerDansPanneau(ctx, r.panneauPg, 91010001, 50) : { avant: null, lance: false };
      await capture(r.panneauPg || pg, '5-autre-compte');
      await attendre(3000);
      await fermerPanneauPg(r.panneauPg);
      const cmd5 = commandePrix(M, 91010001, t4);
      const tente5 = vinted().slice(d4).filter((e) => e.m !== 'GET' || /item_upload/.test(e.p));
      dit(!!r.lien && !lp.lance && !cmd5 && tente5.length === 0, '5 : le panneau ne lance pas la baisse pour vendeur_a (l’onglet est sur autre_b)', JSON.stringify({ lien: r.lien, avant: lp.avant, lance: lp.lance, commande: cmd5 && cmd5.data, envoye: tente5.map((e) => e.m + ' ' + e.p + ' uid=' + e.uid) }));
      // Et même une commande postée DIRECTEMENT au pont (un écran périmé, un autre onglet) :
      const rep = await pg.evaluate(() => new Promise((ok) => {
        const reqId = 'banc-' + Date.now();
        const h = (e) => { const d = e.data; if (e.source === window && d && d.__vmr === 'cmd:result' && d.reqId === reqId) { window.removeEventListener('message', h); ok(d.resp); } };
        window.addEventListener('message', h);
        window.postMessage({ __vmr: 'cmd', reqId, cmd: 'baisserPrixVinted', uid: '111', id: '91010001', prix: 50, prixAvant: 60, confirme: true }, '*');
        setTimeout(() => ok({ muet: true }), 30000);
      }));
      await attendre(1500);
      const envoye = vinted().slice(d4).filter((e) => e.m !== 'GET' || /item_upload/.test(e.p));
      dit(envoye.length === 0, '5 : une commande pour vendeur_a n’envoie RIEN chez Vinted tant que l’onglet est sur autre_b', `${envoye.length} · ${envoye.map((e) => e.m + ' ' + e.p + ' uid=' + e.uid).join(' | ')}`);
      dit(rep && rep.accepte === false && /autre|absent/.test(String(rep.code)), '5 : l’extension refuse et dit pourquoi (compte de l’onglet)', JSON.stringify(rep).slice(0, 240));
    }

    // ══ 6. UNE EXTENSION EN RETARD ═══════════════════════════════════════════
    // Une 5.335 (avant le panneau ouvert par un lien de l'app, `panneaucomplet` 5.410.0) : « Baisser » ouvrirait vinted.fr
    // sans que rien ne s'y passe. L'app ne promet rien : le bouton est fermé et dit de mettre l'extension à jour.
    if (veut(6)) {
      console.log('\n── 6. extension en retard (5.335, avant le panneau) ⇒ l’app ne promet rien');
      const EXTV = preparerExtension('ext-5335', { version: '5.335.0' });
      const IDV = extId(EXTV);
      const ctx6 = await lancer(path.join(TMP, 'profil-6'), EXTV); ctxs.push(ctx6);
      const s6 = M.ouvrir(M.USERS.get(U.email));
      await poserSessionApp(ctx6, { access_token: s6.access_token, refresh_token: s6.refresh_token, expires_at: Date.now() + 3600e3, user: s6.user });
      const w6 = await sw(ctx6, IDV);
      const co = w6 ? await w6.evaluate(async (a) => { const r = await authLogin(a.e, a.p); return r && r.ok; }, { e: U.email, p: U.mdp }).catch(() => false) : false;
      dit(co === true, '6 : l’extension 5.335 est installée et connectée à ce compte VRM');
      const v6 = await ctx6.newPage();
      await v6.bringToFront(); await v6.goto('https://www.vinted.fr/banc/connexion?uid=111');
      await v6.bringToFront(); await v6.goto('https://www.vinted.fr/member/111-vendeur_a');
      await attendre(3000);
      const p6 = await ctx6.newPage();
      const etat = await (async () => { await p6.goto('https://vrm.center/?tab=cat_annonces', { waitUntil: 'domcontentloaded' }); return attendreQue(() => p6.evaluate(() => new Promise((ok) => { const reqId = 'v' + Math.random(); const h = (e) => { const d = e.data; if (e.source === window && d && d.__vmr === 'etat:result' && d.reqId === reqId) { window.removeEventListener('message', h); ok(d.resp); } }; window.addEventListener('message', h); window.postMessage({ __vmr: 'etat', reqId }, '*'); setTimeout(() => ok(null), 4000); })), 20000); })();
      dit(!!etat && etat.version === '5.335.0', '6 : le pont de VRM parle à la 5.335', JSON.stringify(etat && { version: etat.version, code: etat.code }));
      const d5 = vinted().length;
      const r = await baisserDepuisApp(ctx6, p6, 91010001);
      await capture(p6, '6-retard');
      const envoye = vinted().slice(d5).filter((e) => /item_upload/.test(e.p));
      dit(!r.absente && !!r.bouton, '6 : la paire dort, « Baisser » est dans la barre de sa sélection', JSON.stringify(r).slice(0, 300));
      dit(!!r.bouton && !r.bouton.ouvert && !r.lien && r.onglets === 0, '6 : « Baisser » est fermé : l’app n’ouvre pas un panneau que cette extension ne sait pas ouvrir', JSON.stringify({ bouton: r.bouton, lien: r.lien, onglets: r.onglets }));
      dit(!!r.bouton && /mettre à jour|mets à jour|à jour/i.test(r.bouton.raison || ''), '6 : et elle dit quoi faire (mettre l’extension à jour)', r.bouton && r.bouton.raison);
      dit(envoye.length === 0, '6 : rien n’est parti chez Vinted', String(envoye.length));
    }
    dit(erreursApp.length === 0, 'aucune erreur de page dans l’app', erreursApp.slice(0, 3).join(' | '));
    const fuite = M.st.vinted.filter((e) => e.uid && !['111', '222'].includes(e.uid));
    dit(fuite.length === 0, 'aucune requête Vinted sous un compte inconnu');
  } catch (e) {
    dit(false, 'le banc a tourné jusqu’au bout', String(e && e.stack || e).slice(0, 300));
  } finally {
    if (process.env.BANC_DUMP) fs.writeFileSync(process.env.BANC_DUMP, JSON.stringify(M.st.tables));
    if (process.env.BANC_JOURNAL) for (const a of M.st.api) console.log(`     API ${a.m} ${a.p}${a.q} ${a.src}`);
    if (process.env.BANC_JOURNAL) for (const j of journal) if (j.src === 'app') console.log(`     ${j.m} ${j.t} ${j.q || j.ids || ''} → ${j.n}`);
    for (const c of ctxs) await c.close().catch(() => {});
    await M.fermer();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  }
  console.log(`\n${ko ? '❌' : '✅'} e2e-extension : ${ok} vert(s), ${ko} rouge(s)${constats.length ? `, ${constats.length} constat(s)` : ''}${MUT ? ` — mutation « ${MUT} »` : ''}`);
  process.exit(ko ? 1 : 0);
})();
