// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA CONNEXION DANS LE GRAND PANNEAU FLOUTÉ » (27 nov., ext. 5.456.0)
//
//  Julien (27 nov., 23 h) : « Je ne veux pas que ce soit un petit module à droite avec connexion à Google dans une autre
//  page ou avec Discord. Je veux que ce soit le gros panneau directement qui s'affiche avec les données floutées […]. Et
//  on se connecte ici. […] je veux pouvoir bien se connecter avec l'adresse mail et le mot de passe […]. Pareil, avec le
//  code, ça ne marche pas. Tout doit être absolument parfait. »
//
//  Vrai Chromium. Une page vinted.fr reçoit les VRAIS vrm-ui.js, vrm-mots.js, vrm-badge.js (l'ordre du manifeste) ; le
//  cadre de l'extension est servi depuis https://ext.test (une autre origine, comme chrome-extension://…) : la VRAIE
//  popup.html + popup.js, qui charge le VRAI vrm-badge.js en mode cadre ; la VRAIE page public/verif-extension.html /.js
//  est servie sous https://vrm.center ; le VRAI background.js (`_fond-vm.cjs`) répond derrière `sendMessage`, devant un
//  faux GoTrue À CAPTCHA (la forme mesurée sur le vrai Supabase le 27 nov. : `captcha_failed` sans jeton), et un faux
//  Turnstile (challenges.cloudflare.com) qui rend un jeton à usage unique. Rien ne sort ; tout est inventé.
//  ⚠️ Seule substitution : la page de vérification accepte aussi le parent `https://ext.test` (le banc ne peut pas servir
//     une origine chrome-extension://) ; la vraie règle des parents est jugée par audit-connexion-panneau V1.
//
//  Juge (des RÈGLES, pas des libellés) : l'icône ouvre le GRAND panneau (data-grand) flouté (`filter: blur`), `inert`,
//  aria-hidden, aucun élément du panneau atteignable au clic ; la connexion DANS le panneau (feuille au centre) ; le mot
//  de passe d'abord (Chrome : dans le cadre de l'extension), la vérification anti-robot posée, Google et Discord en
//  boutons ; le mot de passe ⇒ connecté, le jeton est parti, la page n'est PAS rechargée, le panneau se dé-floute sur
//  place ; mauvais mot de passe ⇒ dit ; le code ⇒ envoyé puis vérifié ⇒ connecté ; un code expiré ⇒ dit ; Orion (carte
//  dessinée, pas de mot de passe) ⇒ le code, la vérification posée par la page du site ; « Créer un compte » au même
//  endroit. Captures : 390 tactile (Orion ≤ 760 px) et 1512, clair et sombre.
//  `--badge chemin` / `--ext dossier` / `--src chemin` : d'autres copies (preuve sur le code d'avant, §6.1).
//  Usage : node scripts/bancs/panneau-connexion.cjs   (captures dans scripts/bancs/captures/ ou $BANC_CAPTURES)
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { faireFond } = require('../_fond-vm.cjs');
const { fauxGoTrue } = require('../tests/_faux-gotrue.cjs');

const RACINE = path.join(__dirname, '..', '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : null; };
const EXT = arg('--ext') || path.join(RACINE, 'vinted-sync-extension');
const lireExt = (nom) => { try { return fs.readFileSync(path.join(EXT, nom), 'utf8'); } catch (_) { return ''; } };
const BADGE = arg('--badge') ? fs.readFileSync(arg('--badge'), 'utf8') : lireExt('vrm-badge.js');
const UI = lireExt('vrm-ui.js'), MOTS = lireExt('vrm-mots.js');
const SRC = arg('--src') || path.join(EXT, 'background.js');
const LOGO = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'logo-vrm-96.png'));
const { servirVerif } = require('./_faux-turnstile.cjs');   // la vraie page de vérification + un faux Turnstile
const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
const SORTIE = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');
const URL_VINTED = 'https://www.vinted.fr/items/1';
const CODE_BON = '482913';

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 260) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 240)}`); return null; } };

function fond({ orion = false } = {}) {
  const gt = fauxGoTrue({ codeOtp: CODE_BON, captcha: true, formeReelle: true, comptes: { 'julien@exemple.fr': 'bon-mot-de-passe', 'google@exemple.fr': null } });
  const f = faireFond({ src: SRC, store: { __sansSession: true, vrmChoixComptes: { 111: { choix: 'oui', at: 1 } } }, onglets: [{ id: 7, url: URL_VINTED, status: 'complete' }] });
  gt.brancher(f.ctx);
  f.ouvertures = { tabs: [], fenetres: [], maj: [] };
  const t = f.ctx.chrome.tabs;
  t.create = (o, cb) => { f.ouvertures.tabs.push(o && o.url); const x = { id: 99 }; if (typeof cb === 'function') { cb(x); return; } return Promise.resolve(x); };
  t.update = (id, o, cb) => { f.ouvertures.maj.push(o && (o.url || 'active')); if (typeof cb === 'function') { cb({}); return; } return Promise.resolve({}); };
  if (!orion) f.ctx.chrome.windows.create = (o, cb) => { f.ouvertures.fenetres.push(o); if (typeof cb === 'function') { cb({ id: 5 }); return; } return Promise.resolve({ id: 5 }); };
  if (orion) f.ctx.__vrmOrionCompat = true;
  f.gt = gt;
  return f;
}

const PAGE_VINTED = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #ddd;display:flex;align-items:center;padding:0 20px"><b style="color:#007782;font-size:22px">Vinted</b></header><main style="padding:20px"><h1>Baskets — vinted.fr (banc)</h1><p>Une page du site, pour le fond.</p></main></body></html>';
const EXT_FICHIERS = { 'popup.html': 'text/html', 'popup.js': 'text/javascript', 'vrm-badge.js': 'text/javascript', 'vrm-ui.js': 'text/javascript', 'parcours-popup.js': 'text/javascript', 'logo-vrm-96.png': 'image/png', 'inter-vrm.woff2': 'font/woff2' };
async function onglet(nav, f, { scheme = 'light', mobile = true, orionPage = false } = {}) {
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
    if (r.request().isNavigationRequest() && r.request().frame() === pg.mainFrame()) urls.push(u);
    if (/^https:\/\/ext\.test\//.test(u)) {
      const nom = new URL(u).pathname.slice(1);
      if (EXT_FICHIERS[nom]) { const p = path.join(EXT, nom); if (fs.existsSync(p)) return r.fulfill({ status: 200, contentType: EXT_FICHIERS[nom], body: fs.readFileSync(p) }); }
      return r.fulfill({ status: 404, body: '' });
    }
    if (servirVerif(r)) return;
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    if (/^https:\/\/vrm\.center\//.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>app VRM (banc)</p>' });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE_VINTED });
  });
  // La session rangée par le service worker est SIGNALÉE à chaque cadre (chrome.storage.onChanged), comme Chrome.
  let sessionAvant = null;
  await pg.exposeFunction('__fond', async (msg, ici) => {
    messages.push(msg && msg.action);
    const r = await f.envoyer(msg, { id: 'x', tab: { id: 7, url: ici }, url: ici });
    const s = JSON.stringify(f.store.vrmSession || null);
    if (s !== sessionAvant) {
      sessionAvant = s;
      setTimeout(() => { for (const fr of pg.frames()) fr.evaluate((v) => { try { window.__signalerStockage && window.__signalerStockage({ vrmSession: { newValue: v } }); } catch (_) {} }, JSON.parse(s)).catch(() => {}); }, 30);
    }
    return r === undefined ? null : JSON.parse(JSON.stringify(r));
  });
  await ctx.addInitScript(({ ui, mots, badge, version, orionPage, urlVinted }) => {
    window.__ouverts = [];
    window.open = (...a) => { window.__ouverts.push(a[0]); return null; };
    const ext = location.hostname === 'ext.test';
    if (location.hostname === 'vrm.center') return;
    const ici = ext ? urlVinted : location.href;
    const ecoutes = [];
    window.__signalerStockage = (ch) => { for (const fn of ecoutes.slice()) { try { fn(ch, 'local'); } catch (_) {} } };
    window.chrome = {
      runtime: {
        id: 'x', lastError: null,
        getURL: (p) => 'https://ext.test/' + p,
        getManifest: () => ({ version, manifest_version: orionPage ? 2 : 3 }),
        sendMessage: (msg, cb) => { window.__fond(msg, ici).then((r) => { if (typeof cb === 'function') cb(r === null ? undefined : r); }); },
        onMessage: { addListener(fn) { (window.__surMessage = window.__surMessage || []).push(fn); } },
      },
      storage: { onChanged: { addListener(fn) { ecoutes.push(fn); } }, local: { get(k, cb) { if (typeof cb === 'function') cb({}); return Promise.resolve({}); }, set(o, cb) { if (typeof cb === 'function') cb(); return Promise.resolve(); } } },
    };
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { const r = orig.call(this, o); if (this.id === 'vrm-badge') window.__racine = r; return r; };
    if (ext) return;
    if (orionPage) window.__vrmOrionCompat = true;
    document.addEventListener('DOMContentLoaded', () => {
      for (const code of [ui, mots, badge]) { if (!code) continue; const s = document.createElement('script'); s.textContent = code; document.documentElement.appendChild(s); }
    });
  }, { ui: UI, mots: MOTS, badge: BADGE, version: VERSION, orionPage, urlVinted: URL_VINTED });
  return { ctx, pg, erreurs, urls, messages };
}
// L'icône de l'extension, pas connectée : le fond envoie `panneauConnexion` à l'onglet (background.js `ouvrirPanneauConnexion`).
const icone = (pg) => pg.evaluate(() => new Promise((res) => { const l = window.__surMessage || []; if (!l.length) { res(null); return; } let fini = false; for (const fn of l) fn({ from: 'vrm-fond', action: 'panneauConnexion' }, { id: 'x' }, (r) => { if (!fini) { fini = true; res(r); } }); setTimeout(() => { if (!fini) res(null); }, 500); }));
const lirePanneau = (pg) => pg.evaluate(() => {
  const r = window.__racine; const q = (s) => (r ? r.querySelector(s) : null);
  const carte = q('.carte'), contenu = q('.carte > .contenu'), cx = q('.carte > .connexion');
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const rc = carte ? carte.getBoundingClientRect() : null, rx = cx ? cx.getBoundingClientRect() : null;
  // Un élément du panneau flouté est-il atteignable ? (le centre d'un bouton de la barre : `elementFromPoint` dans la racine)
  let atteint = '';
  try { const nav = r.querySelector('.carte > .contenu [data-onglet-b]'); if (nav) { const b = nav.getBoundingClientRect(); const el = r.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); atteint = el && contenu && contenu.contains(el) ? 'oui' : 'non'; } } catch (_) { atteint = '?'; }
  const fr = cx && cx.querySelector('iframe[src*="popup.html"]');
  return {
    ouvert: !!(carte && carte.classList.contains('on')), grand: !!(carte && carte.hasAttribute('data-grand')), horsLigne: !!(carte && carte.hasAttribute('data-hors-ligne')),
    inert: !!(contenu && contenu.inert), ariaCache: contenu ? contenu.getAttribute('aria-hidden') : null, flou: contenu ? getComputedStyle(contenu).filter : '',
    structure: contenu ? { barre: !!contenu.querySelector('.vx6 nav'), accueil: !!contenu.querySelector('[data-apercu-flou]'), tuiles: contenu.querySelectorAll('[data-apercu-tuile]').length, lignes: contenu.querySelectorAll('[data-apercu-ligne]').length } : null,
    chiffres: contenu ? (contenu.querySelector('[data-apercu-flou]') || { textContent: '' }).textContent.match(/\d/g) : null,
    atteint,
    feuille: vis(cx), feuilleCentree: !!(rc && rx && rx.left - rc.left >= 15 && rc.right - rx.right >= 15 && rx.top >= rc.top && rx.bottom <= rc.bottom + 1),
    largeurCarte: rc ? Math.round(rc.width) : 0, hauteurCarte: rc ? Math.round(rc.height) : 0,
    tete: !!(cx && cx.querySelector('[data-cx-tete]')), fermer: !!(cx && cx.querySelector('[data-cx-fermer]')),
    cadre: cx ? cx.getAttribute('data-cadre') || '' : '', cadreVisible: !!(fr && getComputedStyle(fr).visibility === 'visible' && fr.getBoundingClientRect().height > 100),
    formTop: !!q('.carte > .connexion form[data-connexion-carte]'), mode: q('.carte > .connexion form') ? q('.carte > .connexion form').getAttribute('data-mode') : '',
    verifTop: !!q('.carte > .connexion iframe[data-verif-cadre]'),
    texte: carte ? carte.innerText.slice(0, 400) : '',
    deborde: document.documentElement.scrollWidth > window.innerWidth,
  };
});
const cadreFrame = (pg) => pg.frames().find((x) => /^https:\/\/ext\.test\/popup\.html\?mode=carte/.test(x.url()));
const attendreCadre = async (pg) => { for (let i = 0; i < 50; i++) { const fr = cadreFrame(pg); if (fr) { const pret = await fr.evaluate(() => !!(window.__racine && window.__racine.querySelector('form[data-connexion-carte]'))).catch(() => false); if (pret) return fr; } await pg.waitForTimeout(100); } return cadreFrame(pg); };
const lireCadre = (fr) => fr.evaluate(() => {
  const r = window.__racine; const q = (s) => (r ? r.querySelector(s) : null);
  const f = q('form[data-connexion-carte]'); const v = q('iframe[data-verif-cadre]');
  const y = (s) => { const el = q(s); return el && el.getClientRects().length ? Math.round(el.getBoundingClientRect().top) : null; };
  return { form: !!f, mode: f ? f.getAttribute('data-mode') : '', mail: !!q('#vrm-cx-mail'), mdp: !!q('#vrm-cx-mdp'), verif: !!v, verifH: v ? Math.round(v.getBoundingClientRect().height) : 0, verifSrc: v ? v.getAttribute('src') : '',
    principal: q('[data-principal]') ? q('[data-principal]').textContent.trim() : '', fourn: [...(r ? r.querySelectorAll('[data-fournisseur]') : [])].filter((b) => b.getClientRects().length).map((b) => b.getAttribute('data-fournisseur')),
    creer: !!q('[data-cx-creer]'), code: !!q('[data-basculer-mode]'), err: q('#vrm-cx-err') && !q('#vrm-cx-err').hidden ? q('#vrm-cx-err').textContent : '',
    ordre: { mail: y('#vrm-cx-mail'), mdp: y('#vrm-cx-mdp'), verif: y('iframe[data-verif-cadre]'), plein: y('[data-principal]'), google: y('[data-fournisseur="google"]'), code: y('[data-basculer-mode]') },
    cles: /\bcx_[a-z_]+\b/.test(r ? r.textContent : '') };
});
const taperCadre = async (pg, fr, sel, texte) => { await fr.evaluate((s) => { const el = window.__racine.querySelector(s); el.focus(); if (el.select) el.select(); }, sel); await pg.keyboard.type(texte, { delay: 4 }); };
const toucherCadre = (fr, sel) => fr.evaluate((s) => window.__racine.querySelector(s).click(), sel);
const attendreVerif = (fr) => fr.waitForFunction(() => { const b = window.__racine && window.__racine.querySelector('[data-verif]'); return b && b.getAttribute('data-verif-etat-v') === 'pret'; }, null, { timeout: 6000 }).then(() => true, () => false);
const jetonsVus = (f, route) => f.gt.j.corps.filter((c) => c.includes(route)).map((c) => { try { return (JSON.parse(c.slice(c.indexOf(' ') + 1)).gotrue_meta_security || {}).captcha_token || ''; } catch (_) { return ''; } });

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });

  // ══ 1. CHROME : l'icône ⇒ le grand panneau flouté ; le mot de passe dans le panneau ══
  for (const [mobile, scheme] of [[false, 'light'], [false, 'dark'], [true, 'light'], [true, 'dark']]) {
    const L = mobile ? '390' : '1512';
    await essaie(`chrome ${L} ${scheme}`, async () => {
      console.log(`\n── Chrome ${L} ${scheme} : pas connecté, l’icône ⇒ le grand panneau flouté, la connexion dedans`);
      const f = fond();
      const o = await onglet(nav, f, { mobile, scheme }); const { pg } = o;
      await pg.goto(URL_VINTED); await pg.waitForTimeout(500);
      const rep = await icone(pg);
      dit(rep && rep.ok === true, 'l’icône de l’extension : l’onglet ouvre le panneau lui-même (`panneauConnexion` ⇒ ok)', JSON.stringify(rep));
      await pg.waitForFunction(() => { const c = window.__racine && window.__racine.querySelector('.carte > .connexion'); return c && /pret|repli/.test(c.getAttribute('data-cadre') || ''); }, null, { timeout: 5000 }).catch(() => {});
      const fr = await attendreCadre(pg);
      if (fr) await attendreVerif(fr);
      await pg.waitForTimeout(350);
      let l = await lirePanneau(pg);
      dit(l.ouvert && l.grand && l.horsLigne, 'le GRAND panneau (data-grand), pas la petite carte', JSON.stringify({ o: l.ouvert, g: l.grand, h: l.horsLigne, w: l.largeurCarte }));
      dit(mobile ? l.largeurCarte >= 388 : l.largeurCarte >= 1400, `il prend l’écran (${l.largeurCarte} px de large)`, l.largeurCarte);
      dit(l.structure && l.structure.barre && l.structure.accueil && l.structure.tuiles === 4 && l.structure.lignes >= 4, 'sa vraie structure : la barre, l’Accueil, 4 tuiles, les lignes', JSON.stringify(l.structure));
      dit(/blur\(/.test(l.flou) && l.inert && l.ariaCache === 'true', 'flouté (filter: blur), `inert`, aria-hidden', JSON.stringify({ flou: l.flou, inert: l.inert, aria: l.ariaCache }));
      dit(l.atteint === 'non', 'aucun bouton du panneau n’est atteignable (le centre d’un bouton de la barre ne touche pas le panneau)', l.atteint);
      dit(!l.chiffres, 'aucun chiffre inventé dans l’aperçu (des formes grises)', JSON.stringify(l.chiffres));
      dit(l.feuille && l.feuilleCentree && l.tete && l.fermer, 'la connexion est DANS le panneau : une feuille, sa tête (logo, titre), son ×', JSON.stringify({ f: l.feuille, c: l.feuilleCentree, t: l.tete, x: l.fermer }));
      dit(l.cadre === 'pret' && l.cadreVisible && !l.formTop, 'Chrome : le formulaire vit dans le cadre de l’extension (la page n’entend rien)', JSON.stringify({ cadre: l.cadre, vis: l.cadreVisible }));
      const c = fr ? await lireCadre(fr) : null;
      dit(!!c && c.mode === 'mdp' && c.mail && c.mdp && c.ordre.mdp > c.ordre.mail && c.ordre.plein > c.ordre.mdp, 'le mot de passe d’abord : e-mail, mot de passe, « Me connecter »', JSON.stringify(c && { m: c.mode, o: c.ordre }));
      dit(!!c && c.verif && c.verifH >= 60 && /^https:\/\/vrm\.center\/verif-extension\.html\?parent=https%3A%2F%2Fext\.test&n=[0-9a-f]{24}/.test(c.verifSrc) && c.ordre.verif < c.ordre.plein, 'la vérification anti-robot de vrm.center est posée au-dessus du bouton (parent = l’extension, un nonce)', JSON.stringify(c && { h: c.verifH, src: c.verifSrc }));
      dit(!!c && c.fourn.includes('google') && c.fourn.includes('discord') && c.creer && c.code, 'Google et Discord en boutons, « Recevoir un code », « Créer un compte » : au même endroit', JSON.stringify(c && { f: c.fourn, cr: c.creer, co: c.code }));
      dit(!!c && !c.cles && !l.texte.match(/\bcx_[a-z_]+/), 'aucune clé de texte brute affichée (les cinq langues de vrm-ui.js)');
      dit(!l.deborde && !o.erreurs.length, 'rien ne déborde, aucune erreur', JSON.stringify({ d: l.deborde, e: o.erreurs[0] }));
      await pg.screenshot({ path: path.join(SORTIE, `panneau-connexion-chrome-${L}-${scheme}.png`) });
      if (!fr) { await o.ctx.close(); return; }
      if (!mobile && scheme === 'light') {
        // mauvais mot de passe
        await taperCadre(pg, fr, '#vrm-cx-mail', 'julien@exemple.fr');
        await taperCadre(pg, fr, '#vrm-cx-mdp', 'pas-le-bon');
        await toucherCadre(fr, '[data-me-connecter]');
        await fr.waitForFunction(() => { const e = window.__racine.querySelector('#vrm-cx-err'); return e && !e.hidden; }, null, { timeout: 5000 }).catch(() => {});
        const e = await lireCadre(fr);
        dit(/incorrect/i.test(e.err) && !f.store.vrmSession, 'mauvais mot de passe ⇒ dit dans le panneau (« incorrect », avec un geste) ; rien rangé', e.err);
        await pg.screenshot({ path: path.join(SORTIE, `panneau-connexion-chrome-${L}-${scheme}-erreur.png`) });
        await attendreVerif(fr);
      }
      // le bon mot de passe
      const avant = o.urls.length;
      await taperCadre(pg, fr, '#vrm-cx-mail', 'julien@exemple.fr');
      await taperCadre(pg, fr, '#vrm-cx-mdp', 'bon-mot-de-passe');
      await toucherCadre(fr, '[data-me-connecter]');
      await pg.waitForFunction(() => { const c = window.__racine && window.__racine.querySelector('.carte'); return c && !c.hasAttribute('data-hors-ligne'); }, null, { timeout: 6000 }).catch(() => {});
      await pg.waitForTimeout(400);
      l = await lirePanneau(pg);
      const jetons = jetonsVus(f, 'grant_type=password');
      dit(!!(f.store.vrmSession && f.store.vrmSession.refresh_token), 'le mot de passe ⇒ connecté, la session rangée par le service worker', JSON.stringify(f.gt.j.login.slice(-1)));
      dit(jetons.length >= 1 && /^jeton-banc-/.test(jetons[jetons.length - 1]) && new Set(jetons).size === jetons.length, 'le jeton anti-robot est parti avec le mot de passe (un neuf à chaque essai)', JSON.stringify(jetons.map((x) => x.slice(0, 16))));
      dit(!l.horsLigne && !l.inert && !/blur/.test(l.flou), 'le panneau se dé-floute SUR PLACE (plus de flou, plus d’inert)', JSON.stringify({ h: l.horsLigne, i: l.inert, f: l.flou }));
      dit(o.urls.length === avant && pg.url() === URL_VINTED && !f.ouvertures.tabs.length && !f.ouvertures.maj.filter((x) => x !== 'active').length, 'aucun rechargement, aucun onglet (ni vrm.center)', JSON.stringify({ urls: o.urls.slice(avant), tabs: f.ouvertures.tabs, maj: f.ouvertures.maj }));
      dit(!JSON.stringify(f.store).includes('bon-mot-de-passe'), 'le mot de passe n’est rangé nulle part');
      await pg.screenshot({ path: path.join(SORTIE, `panneau-connexion-chrome-${L}-${scheme}-connecte.png`) });
      await o.ctx.close();
    });
  }

  // ══ 2. CHROME : le code dans le panneau (envoyé, vérifié), puis un code expiré ══
  await essaie('chrome code', async () => {
    console.log('\n── Chrome 1512 : « Recevoir un code par e-mail » dans le panneau');
    const f = fond();
    const o = await onglet(nav, f, { mobile: false }); const { pg } = o;
    await pg.goto(URL_VINTED); await pg.waitForTimeout(400);
    await icone(pg);
    await pg.waitForFunction(() => { const c = window.__racine && window.__racine.querySelector('.carte > .connexion'); return c && c.getAttribute('data-cadre') === 'pret'; }, null, { timeout: 5000 }).catch(() => {});
    const fr = await attendreCadre(pg);
    await toucherCadre(fr, '[data-basculer-mode]');
    await attendreVerif(fr);
    let c = await lireCadre(fr);
    dit(c.mode === 'code' && c.verif && !c.mdp, 'le mode code : l’e-mail et la vérification (pas de mot de passe)', JSON.stringify({ m: c.mode, v: c.verif }));
    await taperCadre(pg, fr, '#vrm-cx-mail', 'google@exemple.fr');
    await toucherCadre(fr, '[data-code-demander]');
    await fr.waitForFunction(() => !!window.__racine.querySelector('#vrm-cx-code'), null, { timeout: 6000 }).catch(() => {});
    const jot = jetonsVus(f, '/otp');
    dit(f.gt.j.otp.length === 1 && f.gt.j.otp[0].create_user === false && jot.length === 1 && /^jeton-banc-/.test(jot[0]), 'le code est demandé, AVEC le jeton anti-robot (create_user:false)', JSON.stringify({ otp: f.gt.j.otp, jot }));
    await pg.screenshot({ path: path.join(SORTIE, 'panneau-connexion-chrome-1512-light-code.png') });
    // un faux code d'abord, l'envoi vieilli d'une heure ⇒ « expiré »
    f.store.vrmCodeEnvoi = Object.assign({}, f.store.vrmCodeEnvoi, { at: Date.now() - 61 * 60000 });
    await taperCadre(pg, fr, '#vrm-cx-code', '111111');
    await toucherCadre(fr, '[data-code-valider]');
    await fr.waitForFunction(() => { const e = window.__racine.querySelector('#vrm-cx-err'); return e && !e.hidden; }, null, { timeout: 5000 }).catch(() => {});
    c = await lireCadre(fr);
    dit(/expiré/.test(c.err) && c.mode === 'code' && !f.store.vrmSession, 'un code expiré ⇒ « expiré », retour à la demande d’un nouveau code ; rien rangé', JSON.stringify({ e: c.err, m: c.mode }));
    await pg.screenshot({ path: path.join(SORTIE, 'panneau-connexion-chrome-1512-light-code-expire.png') });
    // nouveau code ⇒ le bon
    await attendreVerif(fr);
    f.store.vrmCodeEnvoi = undefined; delete f.store.vrmCodeEnvoi; f.gt.codes.delete('google@exemple.fr');
    await toucherCadre(fr, '[data-code-demander]');
    await fr.waitForFunction(() => !!window.__racine.querySelector('#vrm-cx-code'), null, { timeout: 6000 }).catch(() => {});
    await taperCadre(pg, fr, '#vrm-cx-code', CODE_BON);
    await toucherCadre(fr, '[data-code-valider]').catch(() => {});
    await pg.waitForFunction(() => { const c = window.__racine && window.__racine.querySelector('.carte'); return c && !c.hasAttribute('data-hors-ligne'); }, null, { timeout: 6000 }).catch(() => {});
    const l = await lirePanneau(pg);
    dit(!!(f.store.vrmSession && f.store.vrmSession.email === 'google@exemple.fr') && !l.horsLigne && !l.inert, 'le bon code ⇒ connecté, le panneau se dé-floute', JSON.stringify({ s: !!f.store.vrmSession, h: l.horsLigne }));
    dit(!JSON.stringify(f.store).includes(CODE_BON) && !f.ouvertures.tabs.length, 'le code n’est rangé nulle part ; aucun onglet');
    await o.ctx.close();
  });

  // ══ 3. ORION (390, paquet MV2, pas de cadre d'extension) : le code, la vérification posée par la carte dessinée ══
  for (const scheme of ['light', 'dark']) {
    await essaie(`orion ${scheme}`, async () => {
      console.log(`\n── Orion 390 ${scheme} : toucher le logo ⇒ le grand panneau flouté, le code dedans`);
      const f = fond({ orion: true });
      const o = await onglet(nav, f, { mobile: true, scheme, orionPage: true }); const { pg } = o;
      await pg.goto(URL_VINTED); await pg.waitForTimeout(500);
      await pg.tap('#vrm-badge'); await pg.waitForTimeout(400);
      await pg.waitForFunction(() => { const b = window.__racine && window.__racine.querySelector('[data-verif]'); return b && b.getAttribute('data-verif-etat-v') === 'pret'; }, null, { timeout: 6000 }).catch(() => {});
      let l = await lirePanneau(pg);
      dit(l.grand && l.horsLigne && l.inert && /blur\(/.test(l.flou) && l.largeurCarte >= 388, 'toucher le logo : le GRAND panneau, flouté, inert, plein écran', JSON.stringify({ g: l.grand, h: l.horsLigne, i: l.inert, w: l.largeurCarte }));
      dit(l.formTop && l.mode === 'code' && l.verifTop && l.feuille && l.tete, 'la carte dessinée (Orion) : le code, la vérification posée, dans la feuille du panneau', JSON.stringify({ f: l.formTop, m: l.mode, v: l.verifTop }));
      const mdp = await pg.evaluate(() => !!window.__racine.querySelector('input[type="password"]'));
      dit(!mdp, 'aucun champ mot de passe dans la carte dessinée (règle du 5.362 : la page du site pourrait l’entendre)');
      const src = await pg.evaluate(() => (window.__racine.querySelector('iframe[data-verif-cadre]') || {}).src || '');
      dit(/parent=https%3A%2F%2Fwww\.vinted\.fr&/.test(src), 'la vérification répond à l’origine du site (la vraie règle des parents l’accepte)', src);
      await pg.screenshot({ path: path.join(SORTIE, `panneau-connexion-orion-390-${scheme}.png`) });
      await pg.evaluate(() => { const el = window.__racine.querySelector('#vrm-cx-mail'); el.focus(); });
      await pg.keyboard.type('google@exemple.fr', { delay: 4 });
      await pg.evaluate(() => window.__racine.querySelector('[data-code-demander]').click());
      await pg.waitForFunction(() => !!window.__racine.querySelector('#vrm-cx-code'), null, { timeout: 6000 }).catch(() => {});
      const jot = jetonsVus(f, '/otp');
      dit(jot.length === 1 && /^jeton-banc-/.test(jot[0]), 'le code part avec le jeton (Orion)', JSON.stringify(jot));
      await pg.screenshot({ path: path.join(SORTIE, `panneau-connexion-orion-390-${scheme}-code.png`) });
      await pg.evaluate(() => window.__racine.querySelector('#vrm-cx-code').focus());
      await pg.keyboard.type(CODE_BON, { delay: 4 });
      await pg.evaluate(() => { const b = window.__racine.querySelector('[data-code-valider]'); if (b && !b.disabled) b.click(); });
      await pg.waitForFunction(() => { const c = window.__racine && window.__racine.querySelector('.carte'); return c && !c.hasAttribute('data-hors-ligne'); }, null, { timeout: 6000 }).catch(() => {});
      l = await lirePanneau(pg);
      dit(!!f.store.vrmSession && !l.horsLigne && !l.inert && pg.url() === URL_VINTED, 'le bon code ⇒ connecté, dé-flouté sur place, la page n’a pas bougé', JSON.stringify({ s: !!f.store.vrmSession, h: l.horsLigne, u: pg.url() }));
      if (scheme === 'light') {
        // « Créer un compte », au même endroit
        const g = fond({ orion: true });
        const o2 = await onglet(nav, g, { mobile: true, scheme, orionPage: true });
        await o2.pg.goto(URL_VINTED); await o2.pg.waitForTimeout(400);
        await o2.pg.tap('#vrm-badge'); await o2.pg.waitForTimeout(400);
        await o2.pg.evaluate(() => window.__racine.querySelector('[data-cx-creer]').click());
        await o2.pg.waitForFunction(() => { const b = window.__racine && window.__racine.querySelector('[data-verif]'); return b && b.getAttribute('data-verif-etat-v') === 'pret'; }, null, { timeout: 6000 }).catch(() => {});
        const m2 = await lirePanneau(o2.pg);
        dit(m2.mode === 'creer' && m2.verifTop, '« Créer un compte » : dans la même feuille (e-mail, vérification)', JSON.stringify({ m: m2.mode }));
        await o2.pg.screenshot({ path: path.join(SORTIE, 'panneau-connexion-orion-390-light-creer.png') });
        await o2.pg.evaluate(() => { const el = window.__racine.querySelector('#vrm-cx-mail'); el.focus(); });
        await o2.pg.keyboard.type('nouvelle@exemple.fr', { delay: 4 });
        await o2.pg.evaluate(() => window.__racine.querySelector('[data-code-demander]').click());
        await o2.pg.waitForFunction(() => !!window.__racine.querySelector('#vrm-cx-code'), null, { timeout: 6000 }).catch(() => {});
        dit(g.gt.j.otp.length === 1 && g.gt.j.otp[0].create_user === true, '« Créer mon compte » ⇒ le code part avec create_user:true', JSON.stringify(g.gt.j.otp));
        await o2.pg.evaluate(() => window.__racine.querySelector('#vrm-cx-code').focus());
        await o2.pg.keyboard.type(CODE_BON, { delay: 4 });
        await o2.pg.evaluate(() => { const b = window.__racine.querySelector('[data-code-valider]'); if (b && !b.disabled) b.click(); });
        await o2.pg.waitForFunction(() => { const c = window.__racine && window.__racine.querySelector('.carte'); return c && !c.hasAttribute('data-hors-ligne'); }, null, { timeout: 6000 }).catch(() => {});
        dit(!!(g.store.vrmSession && g.store.vrmSession.email === 'nouvelle@exemple.fr'), 'le code ⇒ compte créé et connecté, sans quitter la page');
        await o2.ctx.close();
      }
      await o.ctx.close();
    });
  }

  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} panneau-connexion : ${ok} verts, ${ko} rouges  (captures : ${SORTIE})`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
