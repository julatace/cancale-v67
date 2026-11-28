// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LA CONNEXION DANS LE PANNEAU » (27 nov., ext. 5.456.0, capacité `connexionpanneau`)
//
//  Julien (27 nov., 23 h) : « je veux pouvoir bien se connecter avec l'adresse mail et le mot de passe, parce que là, ça
//  ne marche pas très bien. Pareil, avec le code, ça ne marche pas. »
//  LA CAUSE, MESURÉE le 27 nov. sur le vrai Supabase (clé publique, adresse inventée, rien créé) : la protection
//  anti-robot est allumée — `token?grant_type=password` et `/otp` répondent 400 `captcha_failed` sans jeton Turnstile ;
//  l'extension n'en envoyait aucun. Le faux GoTrue sert ici CETTE forme (`captcha: true`, `formeReelle: true`).
//
//  Le VRAI background.js (`_fond-vm.cjs`) :
//   P1  mot de passe + jeton ⇒ connecté ; le jeton part dans `gotrue_meta_security.captcha_token` ; session RANGÉE.
//   P2  mot de passe SANS jeton ⇒ refusé, `captcha: true`, une phrase française avec un geste ; rien rangé.
//   P3  mauvais mot de passe (forme d'aujourd'hui, `invalid_credentials`) ⇒ « incorrect » + un geste ; rien rangé.
//   P4  adresse pas confirmée (`email_not_confirmed`) ⇒ dit, avec le geste (le code confirme) ; rien rangé.
//   C1  « Recevoir un code » + jeton ⇒ le code part (`create_user:false`, jeton dans le corps) ; le BON code ⇒ connecté ;
//       le code n'est rangé nulle part.
//   C2  un code de plus d'une heure ⇒ « expiré », `expire: true` ; rien rangé.
//   C3  « Créer un compte » ⇒ `create_user:true` + la langue, puis le code ⇒ connecté.
//   R1  la session survit au redémarrage du navigateur (un AUTRE service worker sur le même stockage ⇒ « connecte »).
//   I1  pas connecté, l'icône ⇒ le panneau DANS l'onglet du site (message `panneauConnexion`), aucun onglet vrm.center,
//       la page n'est pas rechargée ; hors d'un site ⇒ un onglet vinted.fr sur le panneau.
//   V1  la page de vérification (public/verif-extension.js, exécutée) ne répond qu'à un parent permis, à SON origine
//       exacte (jamais '*'), avec le nonce ; vercel.json la laisse encadrer par l'extension et les sites, `/` jamais.
//  `--src chemin` : un autre background.js (preuve sur le code d'avant, §6.1).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const { fauxGoTrue } = require('./tests/_faux-gotrue.cjs');
const SRC = cheminSource();
const RACINE = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log('✅ ' + quoi); } else { ko++; console.log('❌ ' + quoi + (det ? ' — ' + String(det).slice(0, 300) : '')); } };
const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { ko++; console.log('❌ ' + quoi + ' — a levé : ' + String(e && e.message).slice(0, 200)); } };
const JETON = () => 'jeton-banc-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const ONGLET = { id: 7, url: 'https://www.vinted.fr/items/1', status: 'complete' };
const depuisOnglet = { id: 'x', tab: ONGLET, url: ONGLET.url };
function monde(opts = {}) {
  const gt = fauxGoTrue(Object.assign({ captcha: true, formeReelle: true, comptes: { 'julien@exemple.fr': 'bon-mot-de-passe', 'google@exemple.fr': null, 'neuf@exemple.fr': 'mdp-neuf' }, nonConfirmes: ['neuf@exemple.fr'] }, opts.gt || {}));
  const f = faireFond({ src: SRC, store: opts.store || { __sansSession: true }, onglets: opts.onglets || [Object.assign({}, ONGLET)] });
  gt.brancher(f.ctx);
  f.gt = gt;
  return f;
}
const jetonDans = (f, route) => f.gt.j.corps.filter((c) => c.includes(route)).map((c) => { try { return JSON.parse(c.slice(c.indexOf(' ') + 1)); } catch (_) { return {}; } });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('\n── mot de passe');
  await essaie('P1', async () => {
    const f = monde();
    const j = JETON();
    const r = await f.envoyer({ from: 'vrm-badge', action: 'authLogin', email: 'Julien@exemple.fr', password: 'bon-mot-de-passe', captcha: j }, depuisOnglet);
    const corps = jetonDans(f, 'grant_type=password');
    dit(r && r.ok === true, 'P1 mot de passe + jeton anti-robot ⇒ connecté', JSON.stringify(r));
    dit(corps.length === 1 && corps[0].gotrue_meta_security && corps[0].gotrue_meta_security.captcha_token === j, 'P1 le jeton part dans gotrue_meta_security.captcha_token (comme l’app)', JSON.stringify(corps));
    dit(f.store.vrmSession && f.store.vrmSession.refresh_token && f.store.vrmSession.email === 'julien@exemple.fr', 'P1 la session est RANGÉE (chrome.storage.local)', JSON.stringify(f.store.vrmSession || null).slice(0, 120));
    dit(!JSON.stringify(f.store).includes('bon-mot-de-passe') && !JSON.stringify(f.store).includes(j), 'P1 ni le mot de passe ni le jeton ne sont rangés');
    // la fenêtre de l'icône (popup.js) passe aussi le jeton
    const g = monde();
    const r2 = await g.envoyer({ from: 'cancale-popup', action: 'authLogin', email: 'julien@exemple.fr', password: 'bon-mot-de-passe', captcha: JETON(), ouvrir: false }, { id: 'x' });
    dit(r2 && r2.ok === true, 'P1 la fenêtre de l’icône aussi (cancale-popup)', JSON.stringify(r2));
  });
  await essaie('P2', async () => {
    const f = monde();
    const r = await f.envoyer({ from: 'vrm-badge', action: 'authLogin', email: 'julien@exemple.fr', password: 'bon-mot-de-passe' }, depuisOnglet);
    dit(r && r.ok === false && r.captcha === true, 'P2 sans jeton ⇒ refusé et marqué « captcha »', JSON.stringify(r));
    dit(/vérification anti-robot/i.test(String(r && r.error)) && /réessaie/i.test(String(r && r.error)) && !/captcha protection|disallowed/i.test(String(r && r.error)), 'P2 une phrase française avec un geste, pas le message brut', r && r.error);
    dit(!f.store.vrmSession, 'P2 aucune session rangée');
  });
  await essaie('P3', async () => {
    const f = monde();
    const r = await f.envoyer({ from: 'vrm-badge', action: 'authLogin', email: 'julien@exemple.fr', password: 'faux', captcha: JETON() }, depuisOnglet);
    dit(r && r.ok === false && r.faux === true && /incorrect/i.test(r.error) && /Recevoir un code/.test(r.error), 'P3 mauvais mot de passe (invalid_credentials) ⇒ « incorrect » + le geste', JSON.stringify(r));
    dit(!f.store.vrmSession, 'P3 aucune session rangée');
  });
  await essaie('P4', async () => {
    const f = monde();
    const r = await f.envoyer({ from: 'vrm-badge', action: 'authLogin', email: 'neuf@exemple.fr', password: 'mdp-neuf', captcha: JETON() }, depuisOnglet);
    dit(r && r.ok === false && r.nonConfirme === true && /pas encore confirmée/.test(r.error) && /Recevoir un code/.test(r.error), 'P4 adresse pas confirmée (email_not_confirmed) ⇒ dit, avec le geste', JSON.stringify(r));
    dit(!f.store.vrmSession, 'P4 aucune session rangée');
  });

  console.log('\n── code par e-mail');
  await essaie('C1', async () => {
    const f = monde();
    const j = JETON();
    const d = await f.envoyer({ from: 'vrm-badge', action: 'authCodeDemande', email: 'google@exemple.fr', captcha: j }, depuisOnglet);
    const corps = jetonDans(f, '/otp');
    dit(d && d.ok === true, 'C1 « Recevoir un code » + jeton ⇒ le code part', JSON.stringify(d));
    dit(corps.length === 1 && corps[0].create_user === false && corps[0].gotrue_meta_security && corps[0].gotrue_meta_security.captcha_token === j, 'C1 /otp : create_user:false et le jeton dans le corps', JSON.stringify(corps));
    const sans = monde();
    const d2 = await sans.envoyer({ from: 'vrm-badge', action: 'authCodeDemande', email: 'google@exemple.fr' }, depuisOnglet);
    dit(d2 && d2.ok === false && d2.captcha === true && /anti-robot/.test(d2.error), 'C1 sans jeton ⇒ refusé, dit (anti-robot), jamais « code envoyé »', JSON.stringify(d2));
    const faux = await f.envoyer({ from: 'vrm-badge', action: 'authCodeVerif', email: 'google@exemple.fr', code: '000000' }, depuisOnglet);
    dit(faux && faux.ok === false && faux.faux === true && !f.store.vrmSession, 'C1 un faux code ⇒ refusé, rien rangé', JSON.stringify(faux));
    const v = await f.envoyer({ from: 'vrm-badge', action: 'authCodeVerif', email: 'google@exemple.fr', code: '482913' }, depuisOnglet);
    const ver = jetonDans(f, '/verify');
    dit(v && v.ok === true && f.store.vrmSession && f.store.vrmSession.email === 'google@exemple.fr', 'C1 le BON code ⇒ connecté, session rangée', JSON.stringify(v));
    dit(ver.length >= 1 && ver[ver.length - 1].type === 'email', 'C1 /verify avec le type « email » (le code d’un signInWithOtp)', JSON.stringify(ver));
    dit(!JSON.stringify(f.store).includes('482913') && !f.store.vrmCodeEnvoi, 'C1 le code n’est rangé nulle part, l’envoi est oublié');
  });
  await essaie('C2', async () => {
    const f = monde({ store: { __sansSession: true, vrmCodeEnvoi: { email: 'google@exemple.fr', at: Date.now() - 61 * 60000 } } });
    const v = await f.envoyer({ from: 'vrm-badge', action: 'authCodeVerif', email: 'google@exemple.fr', code: '482913' }, depuisOnglet);
    dit(v && v.ok === false && v.expire === true && /expiré/.test(v.error) && /nouveau code/.test(v.error), 'C2 un code de plus d’une heure ⇒ « expiré » + « demande un nouveau code »', JSON.stringify(v));
    dit(!f.store.vrmSession, 'C2 aucune session rangée');
  });
  await essaie('C3', async () => {
    const f = monde();
    const d = await f.envoyer({ from: 'vrm-badge', action: 'authCodeDemande', email: 'nouvelle@exemple.fr', captcha: JETON(), creer: true }, depuisOnglet);
    const corps = jetonDans(f, '/otp');
    dit(d && d.ok === true && d.creer === true, 'C3 « Créer un compte » ⇒ le code part', JSON.stringify(d));
    dit(corps.length === 1 && corps[0].create_user === true && corps[0].data && /^(fr|en|es|it|de)$/.test(corps[0].data.langue), 'C3 /otp : create_user:true et la langue du compte', JSON.stringify(corps));
    const v = await f.envoyer({ from: 'vrm-badge', action: 'authCodeVerif', email: 'nouvelle@exemple.fr', code: '482913' }, depuisOnglet);
    dit(v && v.ok === true && f.store.vrmSession && f.store.vrmSession.email === 'nouvelle@exemple.fr', 'C3 le code ⇒ compte créé ET connecté', JSON.stringify(v));
    const g = monde();
    const sansCreer = await g.envoyer({ from: 'vrm-badge', action: 'authCodeDemande', email: 'nouvelle@exemple.fr', captcha: JETON() }, depuisOnglet);
    dit(sansCreer && sansCreer.ok === false && sansCreer.inconnu === true && /Créer un compte/.test(sansCreer.error), 'C3 sans « Créer » : une adresse inconnue n’ouvre aucun compte, le geste est dit', JSON.stringify(sansCreer));
  });

  console.log('\n── rester connecté');
  await essaie('R1', async () => {
    const f = monde();
    await f.envoyer({ from: 'vrm-badge', action: 'authLogin', email: 'julien@exemple.fr', password: 'bon-mot-de-passe', captcha: JETON() }, depuisOnglet);
    await attendre(20);
    const store = JSON.parse(JSON.stringify(f.store));
    const g = faireFond({ src: SRC, store, onglets: [Object.assign({}, ONGLET)] });   // le navigateur redémarre : un autre service worker, le même stockage
    f.gt.brancher(g.ctx);
    const e = await g.envoyer({ from: 'cancale-popup', action: 'etatConnexion' });
    dit(e && e.etat === 'connecte' && e.email === 'julien@exemple.fr', 'R1 après un redémarrage : toujours « connecte », le compte nommé', JSON.stringify(e));
  });

  console.log('\n── l’icône, pas connecté');
  await essaie('I1', async () => {
    const f = monde();
    const msgs = [];
    f.ctx.chrome.tabs.sendMessage = (id, m, cb) => { msgs.push({ id, m }); if (typeof cb === 'function') cb({ ok: true }); };
    f.ctx.chrome.contextMenus = { create() {}, onClicked: { addListener() {} }, removeAll() {} };
    await f.ctx.surClicIcone(Object.assign({}, ONGLET, { windowId: 1 }));
    const nav = (f.j.navigations || []).map((x) => x.url), crees = (f.j.ongletsCrees || []).map((x) => x.url);
    dit(msgs.some((x) => x.id === 7 && x.m && x.m.action === 'panneauConnexion'), 'I1 l’icône ⇒ le panneau est demandé à l’onglet Vinted (message `panneauConnexion`)', JSON.stringify(msgs));
    dit(!nav.length && !crees.length, 'I1 aucune page rechargée, aucun onglet ouvert (ni vrm.center)', JSON.stringify({ nav, crees }));
    const g = monde({ onglets: [{ id: 9, url: 'https://www.google.com/', status: 'complete' }] });
    await g.ctx.surClicIcone({ id: 9, url: 'https://www.google.com/', status: 'complete', windowId: 1 });
    const c2 = (g.j.ongletsCrees || []).map((x) => x.url);
    dit(c2.length === 1 && /^https:\/\/www\.vinted\.fr\/\?vrm=panneau$/.test(c2[0]) && !c2.some((u) => /vrm\.center/.test(u)), 'I1 hors d’un site ⇒ UN onglet vinted.fr sur le panneau, jamais vrm.center', JSON.stringify(c2));
  });

  console.log('\n── la page de vérification');
  await essaie('V1', async () => {
    const JS = fs.readFileSync(path.join(RACINE, 'public', 'verif-extension.js'), 'utf8');
    const jouer = (search) => {
      const envois = [], ecoutes = [];
      let rendu = null;
      const doc = { getElementById: () => ({ textContent: '' }), createElement: () => ({}), head: { appendChild(s) { setTimeout(() => { ctx.window.turnstile = { render(sel, o) { rendu = o; setTimeout(() => o.callback('jeton-banc-turnstile-0000000000'), 1); return 'w1'; }, reset() {} }; ctx.window.__vrmVerifPret(); }, 1); } }, body: { getBoundingClientRect: () => ({ height: 66 }) } };
      const parentW = { postMessage: (d, o) => envois.push({ d, o }) };
      const ctx = { location: { search }, document: doc, navigator: { language: 'fr-FR' }, URLSearchParams, setTimeout, setInterval: () => 0, ResizeObserver: function () { this.observe = () => {}; } };
      ctx.window = ctx; ctx.window.parent = parentW; ctx.addEventListener = (t, fn) => ecoutes.push(fn);
      vm.runInNewContext(JS, ctx);
      return new Promise((res) => setTimeout(() => res({ envois, rendu }), 30));
    };
    const bon = await jouer('?parent=' + encodeURIComponent('chrome-extension://abcdefghijklmnop') + '&n=nonce12345678&theme=sombre');
    const jet = bon.envois.find((x) => x.d && x.d.__vrmVerif === 'jeton');
    dit(!!jet && jet.o === 'chrome-extension://abcdefghijklmnop' && jet.d.n === 'nonce12345678', 'V1 un parent d’extension : le jeton lui est rendu, à SON origine exacte, avec le nonce', JSON.stringify(bon.envois.slice(0, 3)));
    dit(bon.envois.every((x) => x.o !== '*'), 'V1 jamais « * »');
    dit(bon.rendu && bon.rendu.sitekey === '0x4AAAAAAGNgOaYgd8NsqNB9' && bon.rendu.theme === 'dark', 'V1 la clé de site de vrm.center (lue dans l’app servie), le thème suit', JSON.stringify(bon.rendu && { k: bon.rendu.sitekey, t: bon.rendu.theme }));
    const vinted = await jouer('?parent=' + encodeURIComponent('https://www.vinted.fr') + '&n=nonce12345678');
    dit(vinted.envois.some((x) => x.d.__vrmVerif === 'jeton' && x.o === 'https://www.vinted.fr'), 'V1 la carte dessinée (Orion) sur vinted.fr : permis');
    for (const mauvais of ['https://evil.test', 'https://vinted.fr.evil.test', 'javascript:alert(1)', '*', '']) {
      const r = await jouer('?parent=' + encodeURIComponent(mauvais) + '&n=nonce12345678');
      dit(r.envois.length === 0 && !r.rendu, 'V1 parent refusé : ' + (mauvais || '(vide)') + ' ⇒ rien rendu, rien chargé', JSON.stringify(r.envois));
    }
    const cfg = JSON.parse(fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8'));
    const V = require('./bancs/_vercel.cjs');
    const e = (p) => { const x = V.entetesPour(p, { brut: true }); const o = {}; for (const [k, v] of Object.entries(x)) o[k.toLowerCase()] = v; return o; };
    const fa = (p) => ((e(p)['content-security-policy'] || '').match(/frame-ancestors ([^;]+)/) || [])[1] || '';
    dit(/chrome-extension:/.test(fa('/verif-extension.html')) && /moz-extension:/.test(fa('/verif-extension.html')) && /https:\/\/\*\.vinted\.fr/.test(fa('/verif-extension.html')) && !/\*(?!\.)|https:(?!\/\/)/.test(fa('/verif-extension.html')), 'V1 vercel.json : /verif-extension.html se laisse encadrer par l’extension et les sites du panneau, pas par tous', fa('/verif-extension.html'));
    dit(fa('/') === "'none'" && fa('/verif-extension.htm') === "'none'", 'V1 l’app et toute autre page : jamais dans un cadre', fa('/'));
    dit(/challenges\.cloudflare\.com/.test((e('/verif-extension.html')['content-security-policy'] || '').match(/script-src ([^;]+)/)[1]), 'V1 la page peut charger Turnstile (script-src)');
    void cfg;
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-connexion-panneau : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
