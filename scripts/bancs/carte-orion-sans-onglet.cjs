// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA CARTE DU LOGO SUR ORION : SE CONNECTER SANS IFRAME NI ONGLET » (5.329)
//
//  Julien, 8 nov., 22 h, iPhone, Orion, 5.328 : « quand j'appuie sur Vinted et
//  "Se connecter avec VRM", ça ouvre encore VRM. Je veux avoir les outils de
//  connexion directement là, et que ça n'ouvre AUCUN autre onglet. »
//
//  Le VRAI vrm-badge.js dans une page vinted.fr (Chromium 390 px tactile), et
//  le VRAI background.js (scripts/_fond-vm.cjs) derrière `chrome.runtime.
//  sendMessage`, contre un faux GoTrue (scripts/tests/_faux-gotrue.cjs).
//  Comme Orion : la page d'extension posée en iframe ne s'affiche JAMAIS
//  (`popup.html` muet), pas de `chrome.windows`, paquet Orion (`__vrmOrionCompat`).
//  On juge des RÈGLES : formulaire dans la shadow root fermée, aucun champ dans
//  le DOM du site, rien entendu par la page, `tabs.create` jamais appelé, session
//  rangée, compte nommé ; et l'autre sens (mauvais mot de passe : rien rangé).
//  `--badge chemin --src chemin` : d'autres copies (preuve sur la 5.328, §6.1).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { faireFond } = require('../_fond-vm.cjs');
const { fauxGoTrue } = require('../tests/_faux-gotrue.cjs');

const EXT = path.join(__dirname, '..', '..', 'vinted-sync-extension');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : null; };
const BADGE = fs.readFileSync(arg('--badge') || path.join(EXT, 'vrm-badge.js'), 'utf8');
const SRC = arg('--src') || path.join(EXT, 'background.js');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
const SORTIE = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');
const URL_VINTED = 'https://www.vinted.fr/items/1';

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 200)}`); return null; } };

// Un fond : le vrai service worker, avec ou sans fenêtres (Orion n'en a pas).
function fond({ fenetres = false, orion = true, store = { __sansSession: true, vrmChoixComptes: { 111: { choix: 'oui', at: 1 } } } } = {}) {
  const gt = fauxGoTrue();
  const f = faireFond({ src: SRC, store, onglets: [{ id: 7, url: URL_VINTED, status: 'complete' }] });
  gt.brancher(f.ctx);
  f.ouvertures = { tabs: [], fenetres: [], maj: [] };
  const t = f.ctx.chrome.tabs;
  t.create = (o, cb) => { f.ouvertures.tabs.push(o && o.url); const x = { id: 99 }; if (typeof cb === 'function') { cb(x); return; } return Promise.resolve(x); };
  t.update = (id, o, cb) => { f.ouvertures.maj.push(o && o.url); if (typeof cb === 'function') { cb({}); return; } return Promise.resolve({}); };
  t.remove = (id, cb) => { if (typeof cb === 'function') cb(); return Promise.resolve(); };
  if (fenetres) f.ctx.chrome.windows.create = (o, cb) => { f.ouvertures.fenetres.push(o); if (typeof cb === 'function') { cb({ id: 5 }); return; } return Promise.resolve({ id: 5 }); };
  if (orion) f.ctx.__vrmOrionCompat = true;
  f.gt = gt;
  return f;
}

async function page(nav, f, { scheme = 'light', mobile = true } = {}) {
  const ctx = await nav.newContext(mobile
    ? { colorScheme: scheme, viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { colorScheme: scheme, viewport: { width: 1512, height: 900 } });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  pg.on('popup', () => erreurs.push('une fenêtre ou un onglet s’est ouvert depuis la page'));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    // Comme Orion : la page d'extension dans un iframe ne s'affiche jamais.
    if (/popup\.html/.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body></body>' });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><h1 style="padding:20px">vinted.fr (banc)</h1><input id="recherche-vinted" placeholder="Rechercher"></body></html>' });
  });
  const messages = [];
  await pg.exposeFunction('__fond', async (msg) => {
    messages.push(msg && msg.action);
    const r = await f.envoyer(msg, { id: 'x', tab: { id: 7, url: URL_VINTED }, url: URL_VINTED });
    return r === undefined ? null : JSON.parse(JSON.stringify(r));
  });
  await pg.goto(URL_VINTED);
  await pg.evaluate(({ js, version }) => {
    // La page du site : ses propres écouteurs, posés AVANT la carte (bulle) et
    // APRÈS (capture), qui notent tout ce qu'ils entendent.
    window.__entendu = [];
    document.addEventListener('keydown', (e) => window.__entendu.push('doc-keydown:' + e.key + ':' + (e.target && e.target.id)), false);
    document.addEventListener('input', (e) => window.__entendu.push('doc-input:' + (e.data || '') + ':' + (e.target && e.target.id)), false);
    window.__ouverts = [];
    const ouvrir = window.open; window.open = (...a) => { window.__ouverts.push(a[0]); return null; };
    // La racine fermée est GARDÉE pour le banc (mode inchangé : `closed`).
    const orig = Element.prototype.attachShadow;
    window.__modes = [];
    Element.prototype.attachShadow = function (o) { window.__modes.push(o && o.mode); const r = orig.call(this, o); if (this.id === 'vrm-badge') window.__racine = r; return r; };
    window.chrome = {
      runtime: {
        id: 'x', lastError: null,
        getURL: (p) => location.origin + '/' + p,
        getManifest: () => ({ version }),
        sendMessage: (msg, cb) => { window.__fond(msg).then((r) => { if (typeof cb === 'function') cb(r === null ? undefined : r); }); },
      },
      storage: { onChanged: { addListener() {} } },
    };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
    window.addEventListener('keydown', (e) => window.__entendu.push('win-keydown-capture-apres:' + e.key), true);
  }, { js: BADGE, version: VERSION });
  await pg.waitForTimeout(300);
  return { ctx, pg, erreurs, messages };
}

const lire = (pg) => pg.evaluate(() => {
  const r = window.__racine, h = document.getElementById('vrm-badge');
  const q = (s) => (r ? r.querySelector(s) : null);
  const form = q('form[data-connexion-carte]');
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const carte = q('.carte');
  return {
    modes: window.__modes,
    racinePage: h ? h.shadowRoot : 'pas de carte',
    carteVisible: !!(carte && cs(carte).display !== 'none'),
    carte: carte ? carte.innerText : '',
    form: !!form,
    iframes: (r ? r.querySelectorAll('iframe').length : 0) + document.querySelectorAll('iframe:not([aria-hidden])').length,
    champsPage: document.querySelectorAll('input').length,
    champsCarte: r ? r.querySelectorAll('input').length : 0,
    autocomplete: r ? [...r.querySelectorAll('input')].map((i) => i.getAttribute('autocomplete')) : [],
    hauteurs: r ? [...r.querySelectorAll('.connexion input, .connexion button:not([hidden])')].filter((x) => x.offsetParent).map((x) => Math.round(x.getBoundingClientRect().height)) : [],
    fondBouton: cs(q('[data-me-connecter]')) ? cs(q('[data-me-connecter]')).backgroundColor : '',
    tailleChamp: cs(q('#vrm-cx-mail')) ? cs(q('#vrm-cx-mail')).fontSize : '',
    fournisseurs: q('[data-fournisseurs-carte]') ? q('[data-fournisseurs-carte]').getAttribute('data-fournisseurs') : null,
    boutonsFourn: r ? r.querySelectorAll('[data-fournisseur]').length : 0,
    erreur: q('#vrm-cx-err') && !q('#vrm-cx-err').hidden ? q('#vrm-cx-err').textContent : '',
    lierSecours: /Se connecter avec VRM/.test(r ? r.textContent : ''),
    entendu: window.__entendu.slice(),
    ouverts: window.__ouverts.slice(),
    largeur: carte ? Math.round(carte.getBoundingClientRect().width) : 0,
    deborde: document.documentElement.scrollWidth > window.innerWidth,
  };
});
const taper = async (pg, sel, texte) => { await pg.evaluate((s) => window.__racine.querySelector(s).focus(), sel); await pg.keyboard.type(texte, { delay: 5 }); };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });

  console.log('\n── Orion (390 px, au doigt) : toucher le logo, pas connecté');
  await essaie('formulaire', async () => {
    const f = fond();
    const { ctx, pg, erreurs, messages } = await page(nav, f);
    await pg.tap('#vrm-badge'); await pg.waitForTimeout(500);
    let l = await lire(pg);
    dit(!erreurs.length, 'aucune erreur dans la page', erreurs[0]);
    dit(l.modes.includes('closed') && l.racinePage === null, 'la carte est dans une shadow root FERMÉE (la page lit `null`)', JSON.stringify({ modes: l.modes, racine: String(l.racinePage) }));
    dit(l.carteVisible && l.form, 'le formulaire e-mail + mot de passe est DANS la carte', JSON.stringify({ visible: l.carteVisible, form: l.form }));
    dit(l.iframes === 0, 'aucun iframe (la 5.328 en posait un qu’Orion n’affichait pas)', 'iframes : ' + l.iframes);
    dit(l.champsPage === 1 && l.champsCarte === 2, 'aucun champ de la carte dans le DOM du site (seul celui du site y est)', JSON.stringify({ page: l.champsPage, carte: l.champsCarte }));
    dit(l.autocomplete.length === 2 && l.autocomplete.every((a) => a === 'off'), 'autocomplete="off" sur les deux champs (pas mélangés avec les identifiants Vinted)', JSON.stringify(l.autocomplete));
    dit(l.fournisseurs === 'sans-fenetre' && l.boutonsFourn === 0, 'Orion n’a pas de petite fenêtre : ni Google ni Discord dans la carte', JSON.stringify({ f: l.fournisseurs, n: l.boutonsFourn }));
    await pg.waitForTimeout(6500);
    l = await lire(pg);
    dit(l.form && !l.lierSecours && !messages.includes('lierAvecVRM'), 'au bout de 6,5 s : toujours le formulaire, jamais « Se connecter avec VRM »', JSON.stringify({ form: l.form, secours: l.lierSecours, messages }));
    for (const scheme of ['light', 'dark']) {
      await pg.emulateMedia({ colorScheme: scheme }); await pg.waitForTimeout(150);
      l = await lire(pg);
      dit(l.hauteurs.length >= 3 && l.hauteurs.every((x) => x >= 44), `${scheme} : champs et bouton de 44 px au moins`, JSON.stringify(l.hauteurs));
      dit(l.fondBouton === (scheme === 'dark' ? 'rgb(10, 132, 255)' : 'rgb(0, 113, 227)'), `${scheme} : « Me connecter » au bleu Apple, le seul accent`, l.fondBouton);
      dit(l.tailleChamp === '16px' && !l.deborde && l.largeur <= 358, `${scheme} : champs en 16 px (iOS ne zoome pas), une colonne, rien ne déborde`, JSON.stringify({ t: l.tailleChamp, largeur: l.largeur, deborde: l.deborde }));
      await pg.screenshot({ path: path.join(SORTIE, `carte-orion-formulaire-${scheme}.png`) });
    }
    await pg.emulateMedia({ colorScheme: 'light' });

    // L'autre sens : mauvais mot de passe.
    await taper(pg, '#vrm-cx-mail', 'julien@exemple.fr');
    await taper(pg, '#vrm-cx-mdp', 'mauvais');
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
    l = await lire(pg);
    dit(/incorrect/i.test(l.erreur) && !f.store.vrmSession, 'mauvais mot de passe : « incorrect » dit dans la carte, rien rangé', JSON.stringify({ err: l.erreur, session: !!f.store.vrmSession }));
    const vide = await pg.evaluate(() => window.__racine.querySelector('#vrm-cx-mdp').value);
    dit(vide === '', 'le mot de passe est vidé du champ après la réponse', 'reste : ' + vide.length);

    // Le bon.
    await taper(pg, '#vrm-cx-mdp', 'bon-mot-de-passe');
    l = await lire(pg);
    dit(!l.entendu.some((x) => /mot|bon|:vrm-badge|:$/.test(x) && /keydown|input/.test(x)) && l.entendu.length === 0, 'la page n’a rien entendu de ce qui est tapé dans la carte (clavier, saisie)', JSON.stringify(l.entendu.slice(0, 6)));
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(700);
    l = await lire(pg);
    dit(f.gt.j.login.length === 2 && !!(f.store.vrmSession && f.store.vrmSession.refresh_token), 'Entrée : la connexion part au service worker, la session est rangée', JSON.stringify({ logins: f.gt.j.login.length, session: !!f.store.vrmSession }));
    dit(!JSON.stringify(f.store).includes('bon-mot-de-passe'), 'le mot de passe n’est rangé nulle part dans l’extension');
    dit(l.carteVisible && /julien@exemple\.fr/.test(l.carte) && /compte_banc/.test(l.carte) && /C’est fait/.test(l.carte) && !l.form, 'la carte reste ouverte, NOMME le compte VRM et le compte Vinted, et dit « C’est fait »', l.carte.replace(/\n/g, ' · ').slice(0, 220));
    dit(f.ouvertures.tabs.length === 0 && f.ouvertures.maj.length === 0 && !l.ouverts.length && !messages.includes('ouvrirVRM') && !messages.includes('lierAvecVRM'),
      'chrome.tabs.create JAMAIS appelé, aucun onglet mis à jour, aucune fenêtre, aucune redirection', JSON.stringify({ tabs: f.ouvertures.tabs, maj: f.ouvertures.maj, ouverts: l.ouverts, messages: [...new Set(messages)] }));
    dit(pg.url() === URL_VINTED, 'on est resté sur la page Vinted', pg.url());
    await pg.screenshot({ path: path.join(SORTIE, 'carte-orion-connecte-light.png') });
    await ctx.close();

    // Onglet fermé puis rouvert : la même extension (même stockage), nouvelle page.
    const p2 = await page(nav, f, { scheme: 'dark' });
    await p2.pg.tap('#vrm-badge'); await p2.pg.waitForTimeout(500);
    const l2 = await lire(p2.pg);
    dit(/julien@exemple\.fr/.test(l2.carte) && !l2.form && !/Pas connecté/.test(l2.carte), 'onglet rouvert : toujours connecté, aucun formulaire', l2.carte.replace(/\n/g, ' · ').slice(0, 200));
    await p2.pg.screenshot({ path: path.join(SORTIE, 'carte-orion-connecte-dark.png') });
    await p2.ctx.close();
  });

  console.log('\n── Ordinateur (Chrome) : Google / Discord en petite fenêtre seulement');
  await essaie('fenetre', async () => {
    const f = fond({ fenetres: true, orion: false });
    const { ctx, pg } = await page(nav, f, { mobile: false });
    await pg.mouse.click(1512 - 16 - 22, 900 - 16 - 22); await pg.waitForTimeout(700);
    let l = await lire(pg);
    dit(l.form && l.boutonsFourn === 2, 'formulaire + « Continuer avec Google / Discord » (la petite fenêtre existe ici)', JSON.stringify({ form: l.form, n: l.boutonsFourn, f: l.fournisseurs }));
    await pg.evaluate(() => window.__racine.querySelector('[data-fournisseur="google"]').click()); await pg.waitForTimeout(400);
    dit(f.ouvertures.fenetres.length === 1 && f.ouvertures.fenetres[0].type === 'popup' && /\/auth\/v1\/authorize\?provider=google/.test(f.ouvertures.fenetres[0].url) && f.ouvertures.tabs.length === 0,
      'Google : UNE petite fenêtre (type popup), aucun onglet', JSON.stringify({ fen: f.ouvertures.fenetres.map((x) => x.type), tabs: f.ouvertures.tabs }));
    await ctx.close();
  });

  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} carte-orion-sans-onglet : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
