// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA CARTE DU LOGO SUR ORION : SE CONNECTER SANS IFRAME NI ONGLET »
//  (5.329, étendu en 5.330 : code par e-mail, Google / Discord dans le MÊME onglet)
//
//  Julien, 8 nov., 22 h, iPhone, Orion, 5.328 : « quand j'appuie sur Vinted et
//  "Se connecter avec VRM", ça ouvre encore VRM. Je veux avoir les outils de
//  connexion directement là, et que ça n'ouvre AUCUN autre onglet. »
//  Puis (5.329) : « il n'y a pas la connexion Discord et Google, parce que
//  certains ont créé leur compte comme ça » — ces comptes n'ont pas de mot de passe.
//
//  Le VRAI vrm-badge.js dans une page vinted.fr (Chromium 390 px tactile), le
//  VRAI oauth-retour.js sur la vraie page public/extension-retour.html, et le
//  VRAI background.js (scripts/_fond-vm.cjs) derrière `chrome.runtime.
//  sendMessage`, contre un faux GoTrue (scripts/tests/_faux-gotrue.cjs : mot de
//  passe, /otp, /verify, PKCE). Comme Orion : la page d'extension posée en
//  iframe ne s'affiche JAMAIS, pas de `chrome.windows`, paquet Orion
//  (`__vrmOrionCompat`). On juge des RÈGLES : formulaire dans la shadow root
//  fermée, ordre des moyens, aucun champ dans le DOM du site, rien entendu par
//  la page, `tabs.create` / `window.open` jamais appelés, session rangée, code
//  et mot de passe rangés nulle part et dans aucune adresse ; et l'autre sens
//  (mauvais code, mauvais mot de passe, adresse inconnue : rien rangé).
//  5.332 (défaut #6) : sur Chrome / Edge / Firefox (manifeste v3, pas le paquet
//  Orion), le formulaire vit dans l'IFRAME de l'extension (une autre origine :
//  la page n'entend aucune touche) ; cadre muet ⇒ cette carte en < 2 s ; cadre
//  détourné par la page ⇒ jamais montré ; Orion ⇒ aucun iframe tenté.
//  `--badge chemin --src chemin --retour chemin --ext dossier` : d'autres copies (preuve §6.1).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { faireFond } = require('../_fond-vm.cjs');
const { fauxGoTrue } = require('../tests/_faux-gotrue.cjs');

const RACINE = path.join(__dirname, '..', '..');
const EXT = path.join(RACINE, 'vinted-sync-extension');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : null; };
const BADGE = fs.readFileSync(arg('--badge') || path.join(EXT, 'vrm-badge.js'), 'utf8');
// 5.332 : les fichiers du cadre (popup.html, popup.js, vrm-badge.js) — `--ext dossier` pour une autre copie.
const EXT_CADRE = arg('--ext') || (arg('--badge') ? path.dirname(arg('--badge')) : EXT);
const SRC = arg('--src') || path.join(EXT, 'background.js');
const RETOUR_JS = fs.readFileSync(arg('--retour') || path.join(EXT, 'oauth-retour.js'), 'utf8');
const RETOUR_HTML = fs.readFileSync(path.join(RACINE, 'public', 'extension-retour.html'), 'utf8');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
const SORTIE = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');
const URL_VINTED = 'https://www.vinted.fr/items/1';
const CODE_BON = '482913';

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 240)}`); return null; } };

// Un fond : le vrai service worker, avec ou sans fenêtres (Orion n'en a pas).
function fond({ fenetres = false, orion = true, store = { __sansSession: true, vrmChoixComptes: { 111: { choix: 'oui', at: 1 } } } } = {}) {
  const gt = fauxGoTrue({ codeOtp: CODE_BON });
  const f = faireFond({ src: SRC, store, onglets: [{ id: 7, url: URL_VINTED, status: 'complete' }] });
  gt.brancher(f.ctx);
  f.ouvertures = { tabs: [], fenetres: [], maj: [], fermes: [] };
  const t = f.ctx.chrome.tabs;
  t.create = (o, cb) => { f.ouvertures.tabs.push(o && o.url); const x = { id: 99 }; if (typeof cb === 'function') { cb(x); return; } return Promise.resolve(x); };
  t.update = (id, o, cb) => { f.ouvertures.maj.push(o && (o.url || 'active')); if (typeof cb === 'function') { cb({}); return; } return Promise.resolve({}); };
  t.remove = (id, cb) => { f.ouvertures.fermes.push(id); if (typeof cb === 'function') cb(); return Promise.resolve(); };
  if (fenetres) f.ctx.chrome.windows.create = (o, cb) => { f.ouvertures.fenetres.push(o); if (typeof cb === 'function') { cb({ id: 5 }); return; } return Promise.resolve({ id: 5 }); };
  if (orion) f.ctx.__vrmOrionCompat = true;
  f.gt = gt;
  return f;
}

const PAGE_VINTED = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><h1 style="padding:20px">vinted.fr (banc)</h1><input id="recherche-vinted" placeholder="Rechercher"></body></html>';

// Un onglet (un contexte Playwright) : chaque page vinted.fr reçoit le vrai
// vrm-badge.js, chaque page vrm.center le vrai oauth-retour.js (document_start),
// et les deux parlent au même faux service worker. L'onglet garde l'id 7.
async function onglet(nav, f, { scheme = 'light', mobile = true, autoriser = null } = {}) {
  const ctx = await nav.newContext(mobile
    ? { colorScheme: scheme, viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { colorScheme: scheme, viewport: { width: 1512, height: 900 } });
  const pg = await ctx.newPage();
  const erreurs = [], urls = [], messages = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  pg.on('popup', () => erreurs.push('une fenêtre ou un onglet s’est ouvert depuis la page'));
  ctx.on('page', (p) => { if (p !== pg) erreurs.push('un AUTRE onglet s’est ouvert : ' + p.url()); });
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (r.request().isNavigationRequest()) urls.push(u);
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    // Comme Orion : la page d'extension dans un iframe ne s'affiche jamais.
    if (/popup\.html/.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body></body>' });
    // Supabase → Google → Supabase : ici, d'un trait, le retour avec le code
    // d'autorisation lié au défi PKCE (ou un refus, si le banc le demande).
    if (/\.supabase\.co\/auth\/v1\/authorize\?/.test(u)) {
      const q = new URL(u).searchParams;
      const vers = autoriser ? autoriser(q) : `${q.get('redirect_to')}?code=${encodeURIComponent(f.gt.autoriser(q.get('code_challenge')))}`;
      return r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>Google (banc)</title><p>Google…</p><script>setTimeout(()=>location.replace(${JSON.stringify(vers)}),50)</script>` });
    }
    if (/^https:\/\/vrm\.center\/extension-retour\.html/.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: RETOUR_HTML });
    if (/^https:\/\/vrm\.center\//.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>VRM</title><p>app VRM (banc)</p>' });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE_VINTED });
  });
  await pg.exposeFunction('__fond', async (msg, ici) => {
    messages.push(msg && msg.action);
    const r = await f.envoyer(msg, { id: 'x', tab: { id: 7, url: ici }, url: ici });
    return r === undefined ? null : JSON.parse(JSON.stringify(r));
  });
  await ctx.addInitScript(({ badge, retour, version }) => {
    window.__ouverts = [];
    window.open = (...a) => { window.__ouverts.push(a[0]); return null; };
    window.chrome = {
      runtime: {
        id: 'x', lastError: null,
        getURL: (p) => location.origin + '/' + p,
        getManifest: () => ({ version }),
        sendMessage: (msg, cb) => { window.__fond(msg, location.href).then((r) => { if (typeof cb === 'function') cb(r === null ? undefined : r); }); },
      },
      storage: { onChanged: { addListener() {} } },
    };
    if (location.hostname === 'vrm.center') { (0, eval)(retour); return; }   // document_start, comme le manifeste
    // La page du site : ses propres écouteurs, qui notent tout ce qu'ils entendent.
    window.__entendu = [];
    document.addEventListener('keydown', (e) => window.__entendu.push('doc-keydown:' + e.key + ':' + (e.target && e.target.id)), false);
    document.addEventListener('input', (e) => window.__entendu.push('doc-input:' + (e.data || '') + ':' + (e.target && e.target.id)), false);
    // La racine fermée est GARDÉE pour le banc (mode inchangé : `closed`).
    const orig = Element.prototype.attachShadow;
    window.__modes = [];
    Element.prototype.attachShadow = function (o) { window.__modes.push(o && o.mode); const r = orig.call(this, o); if (this.id === 'vrm-badge') window.__racine = r; return r; };
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('script'); s.textContent = badge; document.documentElement.appendChild(s);
      window.addEventListener('keydown', (e) => window.__entendu.push('win-keydown-capture-apres:' + e.key), true);
    });
  }, { badge: BADGE, retour: RETOUR_JS, version: VERSION });
  return { ctx, pg, erreurs, urls, messages };
}
async function allerVinted(o, url = URL_VINTED) { await o.pg.goto(url); await o.pg.waitForTimeout(400); }

const lire = (pg) => pg.evaluate(() => {
  const r = window.__racine, h = document.getElementById('vrm-badge');
  const q = (s) => (r ? r.querySelector(s) : null);
  const form = q('form[data-connexion-carte]');
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const carte = q('.carte');
  const vis = (el) => !!(el && el.offsetParent && !el.closest('[hidden]'));
  const y = (s) => { const el = q(s); return vis(el) ? Math.round(el.getBoundingClientRect().top) : null; };
  return {
    modes: window.__modes || [],
    racinePage: h ? h.shadowRoot : 'pas de carte',
    carteVisible: !!(carte && cs(carte).display !== 'none'),
    // 5.351 : le détail est replié quand tout va bien — ouvert le temps de lire, puis remis.
    carte: carte ? (() => { const ds = Array.from(carte.querySelectorAll('details[data-detail]')); const av = ds.map((d) => d.open); ds.forEach((d) => { d.open = true; }); const t = carte.innerText; ds.forEach((d, i) => { d.open = av[i]; }); return t; })() : '',
    form: !!form, mode: form ? form.getAttribute('data-mode') : '',
    iframes: (r ? r.querySelectorAll('iframe').length : 0) + document.querySelectorAll('iframe:not([aria-hidden])').length,
    champsPage: document.querySelectorAll('input').length,
    champsCarte: r ? r.querySelectorAll('input').length : 0,
    mdpVisible: vis(q('#vrm-cx-mdp')),
    autocomplete: r ? [...r.querySelectorAll('input')].map((i) => i.getAttribute('autocomplete')) : [],
    hauteurs: r ? [...r.querySelectorAll('.connexion input, .connexion button')].filter(vis).map((x) => Math.round(x.getBoundingClientRect().height)) : [],
    fondPrincipal: cs(q('[data-principal]')) ? cs(q('[data-principal]')).backgroundColor : '',
    principal: q('[data-principal]') ? q('[data-principal]').textContent.trim() : '',
    tailleChamp: cs(q('#vrm-cx-mail')) ? cs(q('#vrm-cx-mail')).fontSize : (cs(q('#vrm-cx-code')) ? cs(q('#vrm-cx-code')).fontSize : ''),
    ordre: { mail: y('#vrm-cx-mail'), code: y('[data-code-demander]'), mdp: y('[data-basculer-mode]'), google: y('[data-fournisseur="google"]'), discord: y('[data-fournisseur="discord"]') },
    fournisseurs: q('[data-fournisseurs-carte]') ? q('[data-fournisseurs-carte]').getAttribute('data-fournisseurs') : null,
    oauth: q('[data-fournisseurs-carte]') ? q('[data-fournisseurs-carte]').getAttribute('data-oauth') : null,
    boutonsFourn: r ? [...r.querySelectorAll('[data-fournisseur]')].filter(vis).length : 0,
    cases: r ? [...r.querySelectorAll('.case')].filter(vis).map((c) => c.textContent) : [],
    codeAuto: q('#vrm-cx-code') ? q('#vrm-cx-code').getAttribute('autocomplete') : '',
    codeMode: q('#vrm-cx-code') ? q('#vrm-cx-code').getAttribute('inputmode') : '',
    codeValeur: q('#vrm-cx-code') ? q('#vrm-cx-code').value : null,
    renvoi: q('[data-code-renvoyer]') ? { off: q('[data-code-renvoyer]').disabled, t: q('[data-code-renvoyer]').textContent } : null,
    erreur: q('#vrm-cx-err') && !q('#vrm-cx-err').hidden ? q('#vrm-cx-err').textContent : '',
    lierSecours: /Se connecter avec VRM/.test(r ? r.textContent : ''),
    entendu: (window.__entendu || []).slice(),
    ouverts: (window.__ouverts || []).slice(),
    largeur: carte ? Math.round(carte.getBoundingClientRect().width) : 0,
    deborde: document.documentElement.scrollWidth > window.innerWidth,
  };
});
const taper = async (pg, sel, texte) => { await pg.evaluate((s) => { const el = window.__racine.querySelector(s); el.focus(); el.select && el.select(); }, sel); await pg.keyboard.type(texte, { delay: 5 }); };
const vider = (pg, sel) => pg.evaluate((s) => { const el = window.__racine.querySelector(s); if (el) el.value = ''; }, sel);
const toucher = (pg, sel) => pg.evaluate((s) => window.__racine.querySelector(s).click(), sel);
const resume = (l) => l.carte.replace(/\n/g, ' · ').slice(0, 240);
// Le secret ne doit vivre nulle part : ni dans le stockage de l'extension, ni
// dans une adresse visitée, ni dans une adresse appelée par le service worker.
const nullePart = (f, o, secret) => !JSON.stringify(f.store).includes(secret) && !o.urls.some((u) => u.includes(secret)) && !f.gt.j.corps.some((c) => c.split(' ')[0].includes(secret));
const aucuneOuverture = (f, o, l) => f.ouvertures.tabs.length === 0 && f.ouvertures.fenetres.length === 0 && !(l.ouverts || []).length && !o.erreurs.some((e) => /onglet|fenêtre/.test(e)) && !o.messages.includes('ouvrirVRM') && !o.messages.includes('lierAvecVRM');

// ── 5.332 : un onglet « Chrome » (manifeste v3, pas de paquet Orion) ────────
// Le cadre de l'extension est servi depuis https://ext.test (une AUTRE origine
// que la page, comme chrome-extension://…) : la vraie popup.html, le vrai
// popup.js, le vrai vrm-badge.js. `cadre: 'muet'` : la page d'extension ne dit
// rien (comme Orion en 5.328). `orionPage` : le paquet Orion (compat posée).
const EXT_FICHIERS = { 'popup.html': 'text/html', 'popup.js': 'text/javascript', 'vrm-badge.js': 'text/javascript', 'parcours-popup.js': 'text/javascript', 'logo-vrm-96.png': 'image/png' };
async function ongletChrome(nav, f, { scheme = 'light', mobile = true, cadre = 'vrai', orionPage = false } = {}) {
  const ctx = await nav.newContext(mobile
    ? { colorScheme: scheme, viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { colorScheme: scheme, viewport: { width: 1512, height: 900 } });
  const pg = await ctx.newPage();
  const erreurs = [], urls = [], messages = [], cadreDemandes = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  pg.on('popup', () => erreurs.push('une fenêtre ou un onglet s’est ouvert depuis la page'));
  ctx.on('page', (p) => { if (p !== pg) erreurs.push('un AUTRE onglet s’est ouvert : ' + p.url()); });
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (r.request().isNavigationRequest()) urls.push(u);
    if (/^https:\/\/ext\.test\//.test(u)) {
      const nom = new URL(u).pathname.slice(1);
      if (nom === 'popup.html') cadreDemandes.push(u);
      if (nom === 'popup.html' && cadre === 'muet') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body></body>' });
      if (EXT_FICHIERS[nom]) return r.fulfill({ status: 200, contentType: EXT_FICHIERS[nom], body: fs.readFileSync(path.join(EXT_CADRE, nom)) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (/^https:\/\/evil\.test\//.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body style="background:#fff"><p>evil — connexion VRM</p><input type="password" placeholder="Mot de passe VRM"></body>' });
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE_VINTED });
  });
  await pg.exposeFunction('__fond', async (msg, ici) => {
    messages.push(msg && msg.action);
    const r = await f.envoyer(msg, { id: 'x', tab: { id: 7, url: ici }, url: ici });
    return r === undefined ? null : JSON.parse(JSON.stringify(r));
  });
  await ctx.addInitScript(({ badge, version, orionPage, urlVinted }) => {
    window.__ouverts = [];
    window.open = (...a) => { window.__ouverts.push(a[0]); return null; };
    const ext = location.hostname === 'ext.test';
    // Le service worker voit l'ONGLET (vinted.fr), y compris pour son cadre.
    const ici = ext ? urlVinted : location.href;
    window.chrome = {
      runtime: {
        id: 'x', lastError: null,
        getURL: (p) => 'https://ext.test/' + p,
        getManifest: () => ({ version, manifest_version: 3 }),
        sendMessage: (msg, cb) => { window.__fond(msg, ici).then((r) => { if (typeof cb === 'function') cb(r === null ? undefined : r); }); },
      },
      storage: { onChanged: { addListener() {} } },
    };
    const orig = Element.prototype.attachShadow;
    window.__modes = [];
    Element.prototype.attachShadow = function (o) { window.__modes.push(o && o.mode); const r = orig.call(this, o); if (this.id === 'vrm-badge') window.__racine = r; return r; };
    if (ext || location.hostname === 'evil.test') return;
    if (orionPage) window.__vrmOrionCompat = true;
    // La page du site : un écouteur posé en capture AVANT la carte (la limite de la 5.329).
    window.__entendu = [];
    window.addEventListener('keydown', (e) => window.__entendu.push('win-keydown-capture-avant:' + e.key), true);
    window.addEventListener('input', (e) => window.__entendu.push('win-input-capture-avant:' + (e.data || '')), true);
    document.addEventListener('keydown', (e) => window.__entendu.push('doc-keydown:' + e.key), false);
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('script'); s.textContent = badge; document.documentElement.appendChild(s);
    });
  }, { badge: BADGE, version: VERSION, orionPage, urlVinted: URL_VINTED });
  return { ctx, pg, erreurs, urls, messages, cadreDemandes };
}
const lireCadre = (pg) => pg.evaluate(() => {
  const r = window.__racine;
  const c = r && r.querySelector('.connexion');
  const f = r && r.querySelector('iframe');
  const carte = r && r.querySelector('.carte');
  return {
    cadre: c ? (c.getAttribute('data-cadre') || '') : '',
    iframes: r ? r.querySelectorAll('iframe').length : 0,
    iframeSrc: f ? f.getAttribute('src') : '',
    iframeVisible: !!(f && getComputedStyle(f).visibility === 'visible' && f.getBoundingClientRect().height > 0 && carte && getComputedStyle(carte).display !== 'none'),
    iframeH: f ? Math.round(f.getBoundingClientRect().height) : 0,
    formTop: !!(r && r.querySelector('form[data-connexion-carte]')),
    champsPage: document.querySelectorAll('input').length,
    // 5.351 : le détail est replié quand tout va bien — ouvert le temps de lire, puis remis.
    carte: carte ? (() => { const ds = Array.from(carte.querySelectorAll('details[data-detail]')); const av = ds.map((d) => d.open); ds.forEach((d) => { d.open = true; }); const t = carte.innerText; ds.forEach((d, i) => { d.open = av[i]; }); return t; })() : '',
    ouverts: (window.__ouverts || []).slice(),
    deborde: document.documentElement.scrollWidth > window.innerWidth,
  };
});
const cadreFrame = (pg) => pg.frames().find((x) => /^https:\/\/ext\.test\/popup\.html\?mode=carte/.test(x.url()));
const lireDansCadre = (fr) => fr.evaluate(() => {
  const r = window.__racine; const q = (s) => (r ? r.querySelector(s) : null);
  const form = q('form[data-connexion-carte]');
  const y = (s) => { const el = q(s); return el && el.offsetParent ? Math.round(el.getBoundingClientRect().top) : null; };
  const o = { mail: y('#vrm-cx-mail'), code: y('[data-code-demander]'), mdp: y('[data-basculer-mode]'), google: y('[data-fournisseur="google"]') };
  return { form: !!form, mode: form ? form.getAttribute('data-mode') : '', principal: q('[data-principal]') ? q('[data-principal]').textContent.trim() : '',
    ordreOk: o.mail != null && o.code > o.mail && o.mdp > o.code && (o.google == null || o.google > o.mdp), ordre: o, mdpVisible: !!(q('#vrm-cx-mdp') && q('#vrm-cx-mdp').offsetParent) };
});

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });

  console.log('\n── Orion (390 px, au doigt) : toucher le logo, pas connecté — l’ordre des moyens');
  await essaie('formulaire', async () => {
    const f = fond();
    const o = await onglet(nav, f); await allerVinted(o);
    const { pg } = o;
    await pg.tap('#vrm-badge'); await pg.waitForTimeout(600);
    let l = await lire(pg);
    dit(!o.erreurs.length, 'aucune erreur dans la page', o.erreurs[0]);
    dit(l.modes.includes('closed') && l.racinePage === null, 'la carte est dans une shadow root FERMÉE (la page lit `null`)', JSON.stringify({ modes: l.modes, racine: String(l.racinePage) }));
    dit(l.carteVisible && l.form && l.mode === 'code', 'le formulaire est DANS la carte, et commence par le code par e-mail', JSON.stringify({ visible: l.carteVisible, form: l.form, mode: l.mode }));
    dit(l.iframes === 0, 'aucun iframe', 'iframes : ' + l.iframes);
    dit(l.champsPage === 1 && l.champsCarte === 1 && !l.mdpVisible, 'un seul champ (l’e-mail), dans la carte ; aucun dans le DOM du site ; le mot de passe replié', JSON.stringify({ page: l.champsPage, carte: l.champsCarte, mdp: l.mdpVisible }));
    const od = l.ordre;
    dit(od.mail != null && od.code > od.mail && od.mdp > od.code && od.google > od.mdp && od.discord > od.google,
      'ordre : e-mail · « Me connecter avec un code » · « J’ai un mot de passe » · Google · Discord', JSON.stringify(od));
    dit(/Me connecter avec un code/.test(l.principal), 'le bouton principal est « Me connecter avec un code »', l.principal);
    dit(l.fournisseurs === 'google,discord' && l.oauth === 'meme-onglet' && l.boutonsFourn === 2, 'Orion (sans petite fenêtre) : Google ET Discord sont là, dans le même onglet', JSON.stringify({ f: l.fournisseurs, o: l.oauth, n: l.boutonsFourn }));
    await pg.waitForTimeout(6500);
    l = await lire(pg);
    dit(l.form && !l.lierSecours && !o.messages.includes('lierAvecVRM'), 'au bout de 6,5 s : toujours le formulaire, jamais « Se connecter avec VRM »', JSON.stringify({ form: l.form, secours: l.lierSecours }));
    for (const scheme of ['light', 'dark']) {
      await pg.emulateMedia({ colorScheme: scheme }); await pg.waitForTimeout(150);
      l = await lire(pg);
      dit(l.hauteurs.length >= 5 && l.hauteurs.every((x) => x >= 44), `${scheme} : champ et boutons de 44 px au moins`, JSON.stringify(l.hauteurs));
      dit(l.fondPrincipal === (scheme === 'dark' ? 'rgb(10, 132, 255)' : 'rgb(0, 113, 227)'), `${scheme} : le bouton principal au bleu Apple, le seul accent`, l.fondPrincipal);
      dit(l.tailleChamp === '16px' && !l.deborde && l.largeur <= 358, `${scheme} : champ en 16 px (iOS ne zoome pas), une colonne, rien ne déborde`, JSON.stringify({ t: l.tailleChamp, largeur: l.largeur, deborde: l.deborde }));
      await pg.screenshot({ path: path.join(SORTIE, `carte-orion-formulaire-${scheme}.png`) });
    }
    await pg.emulateMedia({ colorScheme: 'light' });
    await o.ctx.close();
  });

  console.log('\n── Orion : « Me connecter avec un code » (compte créé avec Google, sans mot de passe)');
  await essaie('code', async () => {
    const f = fond();
    let o = await onglet(nav, f); await allerVinted(o);
    let pg = o.pg;
    await pg.tap('#vrm-badge'); await pg.waitForTimeout(600);
    // Adresse inconnue : rien ne part, aucun compte n'est créé.
    await taper(pg, '#vrm-cx-mail', 'inconnu@exemple.fr');
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
    let l = await lire(pg);
    dit(/Aucun compte VRM/.test(l.erreur) && l.mode === 'code' && !f.store.vrmSession && f.gt.j.otp.length === 1 && f.gt.j.otp[0].create_user === false,
      'adresse inconnue : « Aucun compte VRM… », create_user:false (aucun compte créé), rien rangé', JSON.stringify({ err: l.erreur, otp: f.gt.j.otp }));
    await vider(pg, '#vrm-cx-mail');
    await taper(pg, '#vrm-cx-mail', 'google@exemple.fr');
    await toucher(pg, '[data-code-demander]'); await pg.waitForTimeout(600);
    l = await lire(pg);
    dit(f.gt.j.otp.length === 2 && f.gt.j.otp[1].email === 'google@exemple.fr' && f.gt.j.otp[1].create_user === false, 'le code est demandé à Supabase (/otp, create_user:false)', JSON.stringify(f.gt.j.otp));
    dit(l.mode === 'saisie' && l.cases.length === 6 && l.codeAuto === 'one-time-code' && l.codeMode === 'numeric' && /google@exemple\.fr/.test(l.carte),
      'la carte montre 6 cases (champ chiffres, « one-time-code ») et nomme l’adresse', JSON.stringify({ mode: l.mode, cases: l.cases.length, a: l.codeAuto, m: l.codeMode }));
    dit(l.renvoi && l.renvoi.off && /dans \d+ s/.test(l.renvoi.t), '« Renvoyer le code » attend 60 s', JSON.stringify(l.renvoi));
    for (const scheme of ['light', 'dark']) {
      await pg.emulateMedia({ colorScheme: scheme }); await pg.waitForTimeout(150);
      l = await lire(pg);
      dit(l.hauteurs.every((x) => x >= 44) && l.fondPrincipal === (scheme === 'dark' ? 'rgb(10, 132, 255)' : 'rgb(0, 113, 227)') && !l.deborde, `${scheme} : cases et boutons de 44 px au moins, « Valider » au bleu Apple`, JSON.stringify({ h: l.hauteurs, fond: l.fondPrincipal }));
      await pg.screenshot({ path: path.join(SORTIE, `carte-orion-code-${scheme}.png`) });
    }
    await pg.emulateMedia({ colorScheme: 'light' });
    // iOS recharge la page pendant qu'il lit ses e-mails : la carte reprend aux cases.
    await o.ctx.close();
    o = await onglet(nav, f); await allerVinted(o); pg = o.pg;
    await pg.tap('#vrm-badge'); await pg.waitForTimeout(800);
    l = await lire(pg);
    dit(l.mode === 'saisie' && l.cases.length === 6 && /google@exemple\.fr/.test(l.carte), 'page rechargée (Mail ouvert entre-temps) : la carte reprend aux cases, sans redemander de code', JSON.stringify({ mode: l.mode, otp: f.gt.j.otp.length }));
    // Le mauvais code.
    await taper(pg, '#vrm-cx-code', '111111');
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
    l = await lire(pg);
    dit(/pas le bon/.test(l.erreur) && !f.store.vrmSession && l.codeValeur === '' && l.cases.every((c) => c === ''), 'mauvais code : « n’est pas le bon » dit, rien rangé, cases vidées', JSON.stringify({ err: l.erreur, session: !!f.store.vrmSession, v: l.codeValeur }));
    // Le bon, tapé.
    await taper(pg, '#vrm-cx-code', CODE_BON);
    l = await lire(pg);
    dit(l.cases.join('') === CODE_BON, 'les chiffres tapés s’affichent dans les cases', JSON.stringify(l.cases));
    dit(l.entendu.length === 0, 'la page n’a rien entendu de ce qui est tapé dans la carte (clavier, saisie)', JSON.stringify(l.entendu.slice(0, 6)));
    await toucher(pg, '[data-code-valider]'); await pg.waitForTimeout(800);
    l = await lire(pg);
    const v = f.gt.j.verify;
    dit(v.length === 2 && v[1].type === 'email' && v[1].email === 'google@exemple.fr' && !!(f.store.vrmSession && f.store.vrmSession.refresh_token) && f.store.vrmSession.email === 'google@exemple.fr',
      '« Valider » : /verify type email, la session est rangée (comme le mot de passe)', JSON.stringify({ verify: v, session: !!f.store.vrmSession }));
    dit(nullePart(f, o, CODE_BON) && !f.store.vrmCodeEnvoi, 'le code n’est rangé nulle part ni dans aucune adresse ; l’envoi en cours est effacé', JSON.stringify(Object.keys(f.store)));
    dit(l.carteVisible && /google@exemple\.fr/.test(l.carte) && /C’est fait/.test(l.carte) && !l.form, 'la carte reste ouverte, NOMME le compte VRM et dit « C’est fait »', resume(l));
    dit(aucuneOuverture(f, o, l) && f.ouvertures.maj.length === 0 && pg.url() === URL_VINTED, 'chrome.tabs.create / window.open JAMAIS appelés, aucune fenêtre, on est resté sur la page Vinted', JSON.stringify({ tabs: f.ouvertures.tabs, maj: f.ouvertures.maj, url: pg.url() }));
    await o.ctx.close();
  });

  console.log('\n── Orion : « J’ai un mot de passe »');
  await essaie('mot de passe', async () => {
    const f = fond();
    const o = await onglet(nav, f); await allerVinted(o);
    const { pg } = o;
    await pg.tap('#vrm-badge'); await pg.waitForTimeout(600);
    await taper(pg, '#vrm-cx-mail', 'julien@exemple.fr');
    await toucher(pg, '[data-basculer-mode]'); await pg.waitForTimeout(200);
    let l = await lire(pg);
    dit(l.mode === 'mdp' && l.mdpVisible && l.champsCarte === 2 && l.autocomplete.every((a) => a === 'off') && /julien@exemple\.fr/.test(await pg.evaluate(() => window.__racine.querySelector('#vrm-cx-mail').value)),
      'le champ mot de passe se déplie, l’e-mail est gardé, autocomplete="off"', JSON.stringify({ mode: l.mode, ac: l.autocomplete }));
    await taper(pg, '#vrm-cx-mdp', 'mauvais');
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
    l = await lire(pg);
    dit(/incorrect/i.test(l.erreur) && !f.store.vrmSession, 'mauvais mot de passe : « incorrect » dit dans la carte, rien rangé', l.erreur);
    await taper(pg, '#vrm-cx-mdp', 'bon-mot-de-passe');
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(700);
    l = await lire(pg);
    dit(!!(f.store.vrmSession && f.store.vrmSession.refresh_token) && /julien@exemple\.fr/.test(l.carte) && /compte_banc/.test(l.carte) && /C’est fait/.test(l.carte), 'bon mot de passe : session rangée, la carte nomme les comptes', resume(l));
    dit(nullePart(f, o, 'bon-mot-de-passe') && aucuneOuverture(f, o, l), 'le mot de passe n’est rangé nulle part ; aucun onglet, aucune fenêtre');
    await pg.screenshot({ path: path.join(SORTIE, 'carte-orion-connecte-light.png') });
    await o.ctx.close();
    const o2 = await onglet(nav, f, { scheme: 'dark' }); await allerVinted(o2);
    await o2.pg.tap('#vrm-badge'); await o2.pg.waitForTimeout(500);
    const l2 = await lire(o2.pg);
    dit(/julien@exemple\.fr/.test(l2.carte) && !l2.form && !/Pas connecté/.test(l2.carte), 'onglet rouvert : toujours connecté, aucun formulaire', resume(l2));
    await o2.pg.screenshot({ path: path.join(SORTIE, 'carte-orion-connecte-dark.png') });
    await o2.ctx.close();
  });

  console.log('\n── Orion : « Continuer avec Google » dans le MÊME onglet (aucun onglet de plus)');
  await essaie('google même onglet', async () => {
    const f = fond();
    const o = await onglet(nav, f); const depart = URL_VINTED + '?vue=bas#photo';
    await allerVinted(o, depart);
    const { pg } = o;
    await pg.tap('#vrm-badge'); await pg.waitForTimeout(600);
    let verif = '';
    const surVrm = pg.waitForURL(/vrm\.center\/extension-retour\.html/, { timeout: 8000 }).then(() => true, () => false);
    await toucher(pg, '[data-fournisseur="google"]');
    // Le vérificateur PKCE rangé au départ (consommé au retour) : pour vérifier qu'il ne sort jamais.
    for (let i = 0; i < 20 && !verif; i++) { await pg.waitForTimeout(25); verif = (f.store.vrmOAuthDepart && f.store.vrmOAuthDepart.v) || ''; }
    const passe = await surVrm;
    await pg.waitForURL((u) => String(u).startsWith('https://www.vinted.fr/'), { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(900);
    const auth = o.urls.find((u) => /\/auth\/v1\/authorize\?/.test(u)) || '';
    const q = auth ? new URL(auth).searchParams : new URLSearchParams();
    dit(!!auth && q.get('provider') === 'google' && q.get('redirect_to') === 'https://vrm.center/extension-retour.html' && q.get('code_challenge_method') === 's256' && !!q.get('code_challenge'),
      'CET onglet est parti vers /auth/v1/authorize (google, PKCE s256, retour extension-retour.html)', auth.slice(0, 200));
    dit(passe && f.gt.j.pkce.length === 1 && !!(f.store.vrmSession && f.store.vrmSession.refresh_token) && f.store.vrmSession.email === 'google@exemple.fr',
      'au retour, oauth-retour.js remet le code à l’extension, qui l’échange avec SON vérificateur : session rangée', JSON.stringify({ passe, pkce: f.gt.j.pkce.length, session: !!f.store.vrmSession }));
    dit(pg.url() === depart, 'l’onglet est RAMENÉ sur la page Vinted d’origine (même adresse)', pg.url());
    const l = await lire(pg);
    dit(l.carteVisible && /Connecté à VRM : google@exemple\.fr/.test(l.carte) && /C’est fait/.test(l.carte) && (l.carte.match(/google@exemple\.fr/g) || []).length === 1 && !l.form, 'la carte s’ouvre d’elle-même : « Connecté à VRM : google@exemple.fr », adresse dite une fois', resume(l));
    dit(aucuneOuverture(f, o, l) && f.ouvertures.maj.length === 0 && f.ouvertures.fermes.length === 0, 'chrome.tabs.create / tabs.update / tabs.remove / window.open JAMAIS appelés : c’est le même onglet', JSON.stringify({ o: f.ouvertures, e: o.erreurs }));
    dit(!!verif && nullePart(f, o, verif) && !f.store.vrmOAuthDepart, 'le vérificateur PKCE n’est dans aucune adresse et ne sert qu’une fois', JSON.stringify({ verif: !!verif, reste: !!f.store.vrmOAuthDepart }));
    dit(!o.erreurs.length, 'aucune erreur dans les pages', o.erreurs[0]);
    await pg.screenshot({ path: path.join(SORTIE, 'carte-orion-google-retour-light.png') });
    // Revenir encore sur la page ne rouvre pas la carte (dit une fois).
    await pg.reload(); await pg.waitForTimeout(600);
    const l3 = await lire(pg);
    dit(!l3.carteVisible, 'page rechargée ensuite : la carte ne se rouvre pas toute seule (dit une fois)', resume(l3));
    await o.ctx.close();
  });

  console.log('\n── Orion : Google annulé — retour sur la page, la carte le dit, rien rangé');
  await essaie('google annulé', async () => {
    const f = fond();
    const o = await onglet(nav, f, { scheme: 'dark', autoriser: (q) => `${q.get('redirect_to')}?error=access_denied&error_description=The+user+cancelled` });
    await allerVinted(o);
    const { pg } = o;
    await pg.tap('#vrm-badge'); await pg.waitForTimeout(600);
    await toucher(pg, '[data-fournisseur="discord"]');
    await pg.waitForURL(/vrm\.center/, { timeout: 8000 }).catch(() => {});
    await pg.waitForURL((u) => String(u).startsWith('https://www.vinted.fr/'), { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(900);
    const l = await lire(pg);
    dit(pg.url() === URL_VINTED && l.carteVisible && l.form && /annulée/.test(l.erreur) && !f.store.vrmSession, 'annulé : de retour sur Vinted, la carte ouverte dit « annulée », rien rangé', JSON.stringify({ url: pg.url(), err: l.erreur, s: !!f.store.vrmSession }));
    await pg.screenshot({ path: path.join(SORTIE, 'carte-orion-google-annule-dark.png') });
    await o.ctx.close();
  });

  console.log('\n── Ordinateur (Chrome) : Google / Discord en petite fenêtre seulement');
  await essaie('fenetre', async () => {
    const f = fond({ fenetres: true, orion: false });
    const o = await onglet(nav, f, { mobile: false }); await allerVinted(o);
    const { pg } = o;
    await pg.mouse.click(1512 - 16 - 22, 900 - 16 - 22); await pg.waitForTimeout(700);
    const l = await lire(pg);
    dit(l.form && l.boutonsFourn === 2 && l.oauth === 'fenetre', 'formulaire + « Continuer avec Google / Discord » (petite fenêtre)', JSON.stringify({ form: l.form, n: l.boutonsFourn, o: l.oauth }));
    await toucher(pg, '[data-fournisseur="google"]'); await pg.waitForTimeout(400);
    dit(f.ouvertures.fenetres.length === 1 && f.ouvertures.fenetres[0].type === 'popup' && /\/auth\/v1\/authorize\?provider=google/.test(f.ouvertures.fenetres[0].url) && f.ouvertures.tabs.length === 0 && pg.url() === URL_VINTED,
      'Google : UNE petite fenêtre (type popup), aucun onglet, la page ne bouge pas', JSON.stringify({ fen: f.ouvertures.fenetres.map((x) => x.type), tabs: f.ouvertures.tabs, url: pg.url() }));
    await o.ctx.close();
  });

  // ══ 5.332 : CHROME / EDGE / FIREFOX — LE FORMULAIRE DANS L'IFRAME DE L'EXTENSION ══
  // Décision de Julien (9 nov., défaut #6). Le cadre est servi depuis une AUTRE
  // origine (`https://ext.test`, comme `chrome-extension://…`) : la VRAIE
  // popup.html + popup.js, qui charge le VRAI vrm-badge.js en mode cadre. La page
  // vinted.fr pose un écouteur de clavier en capture AVANT la carte (la limite
  // de la shadow root, 5.329) : avec l'iframe, il n'entend rien.
  await essaie('chrome iframe', async () => {
    for (const [nomCas, mobile] of [['ordinateur 1512', false], ['Chrome Android 390', true]]) {
      console.log(`\n── Chrome (${nomCas}) : le formulaire dans l’iframe de l’extension, la page n’entend rien`);
      const f = fond({ fenetres: !mobile, orion: false });
      const o = await ongletChrome(nav, f, { mobile }); await allerVinted(o);
      const { pg } = o;
      const t0 = Date.now();
      if (mobile) await pg.tap('#vrm-badge'); else await pg.mouse.click(1512 - 16 - 22, 900 - 16 - 22);
      await pg.waitForFunction(() => { const r = window.__racine; const c = r && r.querySelector('.connexion'); return c && /pret|repli/.test(c.getAttribute('data-cadre') || ''); }, null, { timeout: 4000 }).catch(() => {});
      const dt = Date.now() - t0;
      await pg.waitForTimeout(300);   // la hauteur dite par le cadre après « prête »
      let l = await lireCadre(pg);
      dit(l.cadre === 'pret' && l.iframeVisible && /^https:\/\/ext\.test\/popup\.html\?mode=carte/.test(l.iframeSrc) && !l.formTop && l.champsPage === 1, 'pas connecté : le formulaire est dans l’iframe de l’extension (popup.html?mode=carte), aucun champ dans la carte du site ni dans son DOM', JSON.stringify({ cadre: l.cadre, vis: l.iframeVisible, src: l.iframeSrc, formTop: l.formTop, champs: l.champsPage, dt }));
      const fr = cadreFrame(pg);
      const lf = fr ? await lireDansCadre(fr) : null;
      dit(!!lf && lf.form && lf.mode === 'code' && lf.ordreOk && lf.principal.includes('code'), 'dans le cadre : le même formulaire (e-mail, « Me connecter avec un code », mot de passe replié, Google / Discord)', JSON.stringify(lf));
      dit(l.iframeH >= 150 && l.iframeH <= 640 && !l.deborde, 'le cadre prend la hauteur du formulaire (dit par lui), rien ne déborde', JSON.stringify({ h: l.iframeH, deborde: l.deborde }));
      await pg.screenshot({ path: path.join(SORTIE, `carte-cadre-chrome-${mobile ? '390' : '1512'}.png`) });
      // La frappe : l'e-mail puis le code, DANS le cadre. (Sans cadre — code
      // d'avant — on tape dans la carte : la page doit alors ENTENDRE, c'est la limite.)
      if (!fr) {
        await pg.evaluate(() => window.__racine.querySelector('#vrm-cx-mail').focus());
        await pg.keyboard.type('google@exemple.fr', { delay: 5 });
        const ent = await pg.evaluate(() => (window.__entendu || []).slice());
        dit(ent.length === 0, 'la page du site n’a RIEN entendu — même son écouteur posé en capture AVANT la carte', JSON.stringify(ent.slice(0, 4)));
        await o.ctx.close(); continue;
      }
      await fr.evaluate(() => { const el = window.__racine.querySelector('#vrm-cx-mail'); el.focus(); });
      await pg.keyboard.type('google@exemple.fr', { delay: 5 });
      await fr.evaluate(() => window.__racine.querySelector('[data-code-demander]').click());
      await fr.waitForFunction(() => !!window.__racine.querySelector('#vrm-cx-code'), null, { timeout: 4000 });
      dit(f.gt.j.otp.length === 1 && f.gt.j.otp[0].create_user === false && f.gt.j.otp[0].email === 'google@exemple.fr', 'le code est demandé (create_user:false) depuis le cadre', JSON.stringify(f.gt.j.otp));
      await fr.evaluate(() => window.__racine.querySelector('#vrm-cx-code').focus());
      await pg.keyboard.type(CODE_BON, { delay: 5 });
      await fr.evaluate(() => window.__racine.querySelector('[data-code-valider]').click());
      await pg.waitForTimeout(700);
      const entendu = await pg.evaluate(() => (window.__entendu || []).slice());
      dit(entendu.length === 0, 'la page du site n’a RIEN entendu — même son écouteur posé en capture AVANT la carte', JSON.stringify(entendu.slice(0, 6)));
      dit(!!(f.store.vrmSession && f.store.vrmSession.access_token) && nullePart(f, o, CODE_BON), 'bon code ⇒ session rangée par le service worker ; le code n’est rangé nulle part', JSON.stringify({ s: !!f.store.vrmSession }));
      await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await pg.waitForTimeout(500);
      l = await lireCadre(pg);
      dit(/Connecté à VRM/.test(l.carte) && l.iframes === 0, 'connecté : la carte nomme le compte, le cadre est retiré', JSON.stringify({ carte: l.carte.slice(0, 120), n: l.iframes }));
      dit(aucuneOuverture(f, o, { ouverts: l.ouverts }), 'aucun onglet, aucune fenêtre', JSON.stringify({ tabs: f.ouvertures.tabs, fen: f.ouvertures.fenetres.length, ouverts: l.ouverts }));
      await o.ctx.close();
    }
  });

  console.log('\n── Chrome : cadre MUET (la page d’extension ne s’affiche pas) ⇒ la carte actuelle en moins de 2 s');
  await essaie('cadre muet', async () => {
    const f = fond({ fenetres: true, orion: false });
    const o = await ongletChrome(nav, f, { mobile: true, cadre: 'muet' }); await allerVinted(o);
    const { pg } = o;
    const t0 = Date.now();
    await pg.tap('#vrm-badge');
    await pg.waitForFunction(() => { const r = window.__racine; return !!(r && r.querySelector('form[data-connexion-carte]')); }, null, { timeout: 6000 }).catch(() => {});
    const dt = Date.now() - t0;
    const l = await lireCadre(pg);
    dit(l.formTop && l.cadre === 'repli' && l.iframes === 0 && dt < 2000, `repli en ${dt} ms (< 2 s) : le formulaire dessiné dans la carte, plus d’iframe`, JSON.stringify({ form: l.formTop, cadre: l.cadre, n: l.iframes, dt }));
    dit(aucuneOuverture(f, o, { ouverts: l.ouverts }) && !o.messages.includes('lierAvecVRM'), 'jamais d’onglet, jamais « Se connecter avec VRM »', JSON.stringify(f.ouvertures.tabs));
    await o.ctx.close();
  });

  console.log('\n── Chrome : le cadre navigue ailleurs (fausse connexion) ⇒ jamais montré');
  await essaie('cadre détourné', async () => {
    const f = fond({ fenetres: true, orion: false });
    const o = await ongletChrome(nav, f, { mobile: true }); await allerVinted(o);
    const { pg } = o;
    await pg.tap('#vrm-badge');
    await pg.waitForFunction(() => { const r = window.__racine; const c = r && r.querySelector('.connexion'); return c && c.getAttribute('data-cadre') === 'pret'; }, null, { timeout: 4000 }).catch(() => {});
    // Mesuré ici : `window.frames` de la page ne voit PAS le cadre (il est dans la
    // racine fermée) — la page ne peut pas le viser. On fait naviguer le cadre
    // de l'extérieur (le banc), comme le ferait une redirection : la règle
    // « montré seulement après un “prête” venu de l'extension » doit tenir.
    const nFrames = await pg.evaluate(() => window.frames.length);
    dit(nFrames === 0, 'la page ne peut même pas atteindre le cadre (`window.frames` vide : il vit dans la racine fermée)', 'frames : ' + nFrames);
    const fr0 = cadreFrame(pg);
    await fr0.evaluate(() => { location.href = 'https://evil.test/phish'; }).catch(() => {});
    await pg.waitForFunction(() => true, null, { timeout: 100 }).catch(() => {});
    for (let i = 0; i < 40 && !pg.frames().some((x) => /evil\.test/.test(x.url())); i++) await pg.waitForTimeout(50);
    await pg.waitForTimeout(150);
    let l = await lireCadre(pg);
    const vuPendant = l.iframeVisible && /evil/.test(l.iframeDoc || '');
    dit(!l.iframeVisible || l.iframes === 0, 'dès son chargement, la fausse page est CACHÉE (jamais montrée dans la carte)', JSON.stringify({ vis: l.iframeVisible, cadre: l.cadre, vuPendant }));
    await pg.waitForTimeout(1800);
    l = await lireCadre(pg);
    dit(l.formTop && l.cadre === 'repli' && l.iframes === 0, 'puis la carte retombe sur son formulaire dessiné (l’iframe est retiré)', JSON.stringify({ form: l.formTop, cadre: l.cadre, n: l.iframes }));
    await o.ctx.close();
  });

  console.log('\n── Orion simulé (paquet compat, même avec un manifeste v3) : la carte actuelle, aucun iframe tenté');
  await essaie('orion sans iframe', async () => {
    const f = fond();
    const o = await ongletChrome(nav, f, { mobile: true, orionPage: true }); await allerVinted(o);
    const { pg } = o;
    await pg.tap('#vrm-badge'); await pg.waitForTimeout(500);
    const l = await lireCadre(pg);
    dit(l.formTop && l.iframes === 0 && !o.cadreDemandes.length, 'formulaire dessiné tout de suite, aucune page d’extension demandée', JSON.stringify({ form: l.formTop, n: l.iframes, demandes: o.cadreDemandes }));
    await o.ctx.close();
  });

  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} carte-orion-sans-onglet : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
