require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « POPUP DE L'EXTENSION » — la fenêtre où se fait l'étape 2.
//
//  ⚠️ §4.10 : `node --check` ne lit que la syntaxe. Un sélecteur qui ne trouve
//  rien, un `null` déréférencé, un bouton qui n'écoute pas — rien de tout ça ne
//  se voit sans EXÉCUTER le script dans une page. C'est ce qui manquait à
//  `lbc.js` et `ebay.js` ; `popup.js` n'avait jamais tourné non plus.
//
//  Ce qui se joue ici : c'est l'étape qui SÉPARE LES VENDEURS. Si quelqu'un se
//  trompe de compte, ses captures partent dans la boutique d'un autre — et si
//  la fenêtre ne dit pas QUEL mot de passe elle attend, on arrive de Vinted et
//  on tape celui de Vinted.
//
//  11 octobre (Julien) : « quand j'appuie sur se connecter, ça doit envoyer
//  directement dans l'application VRM ». Le bouton principal OUVRE VRM (qui
//  connecte l'extension par une session adressée) ; le mot de passe VRM ne se
//  tape plus ici que si on le demande. Et `?mode=reparer` : la page posée par le
//  pont quand le code qui tourne n'est pas celui du manifeste.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXT = path.join(__dirname, '..', '..', 'vinted-sync-extension');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => {
  if (bon) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); }
};
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

// Rend la vraie popup dans une page, avec un faux `chrome` qui répond ce qu'on
// lui dit. `etat` est ce que `authEtat` renvoie côté service worker.
// `geste(pg)` : ce qu'on fait dans la fenêtre avant de relever.
async function rendre(nav, etat, { carte = false, mode = '', geste = null, faux = {}, scheme = 'dark', mobile = null } = {}) {
  // La carte (2 octobre) : la même page, dans un iframe de 300 × 460 (5.325 ; 380 avant) posé par
  // vrm-badge.js sur le site — `?mode=carte`.
  // `mobile` (19 oct.) : un VRAI téléphone au doigt — Firefox pour Android
  // ouvre cette fenêtre dans un onglet entier ; Orion, dans une feuille.
  const ctx = await nav.newContext(mobile
    ? Object.assign({ colorScheme: scheme, viewport: { width: mobile.largeur || 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, mobile.ua ? { userAgent: mobile.ua } : {})
    : { colorScheme: scheme, viewport: carte ? { width: 320, height: 720 } : { width: 360, height: 900 } });
  const pg = await ctx.newPage();
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8')
    .replace('<script src="popup.js"></script>', '')
    // (26 oct.) popup.html charge aussi `parcours-popup.js` (enregistreur de
    // favoris local, ajouté après ce banc). Le banc n'exerce que la fenêtre
    // d'AUTH : on le retire comme popup.js, sinon la route fourre-tout sert le
    // HTML de la page pour ce <script> → « SyntaxError: Unexpected token '<' ».
    .replace('<script src="parcours-popup.js"></script>', '');
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');

  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
  await pg.route('**/*', (r) => /logo-vrm-96\.png/.test(r.request().url())
    ? r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(path.join(EXT, 'logo-vrm-96.png')) })
    : r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await pg.goto('https://ext.test/popup.html' + (carte ? '?mode=carte' : mode ? '?mode=' + mode : ''));
  // Le faux `chrome` : même forme que le vrai (callbacks), rien de plus.
  await pg.evaluate(({ e, faux }) => {
    window.__envoyes = [];
    window.__recharges = 0;
    const mem = Object.assign({}, faux.stock || {});
    window.__mem = mem;
    window.chrome = {
      runtime: {
        sendMessage: (msg, cb) => {
          window.__envoyes.push(msg);
          // Un service worker d'AVANT (code périmé) ne connaît pas ce message :
          // Chrome ferme le port, le rappel reçoit `undefined` avec `lastError`.
          if ((faux.lierFerme && msg.action === 'lierAvecVRM') || (faux.codeFerme && msg.action === 'codeVersion')) {
            setTimeout(() => { window.chrome.runtime.lastError = { message: 'The message port closed before a response was received.' }; try { cb && cb(undefined); } finally { window.chrome.runtime.lastError = null; } }, 5);
            return;
          }
          const r = msg.action === 'authEtat' ? e
            : msg.action === 'freshness' ? { ok: true, fresh: [] }
            : msg.action === 'codeVersion' ? (faux.codeMuet ? undefined : { ok: true, code: faux.code || null })
            // Une connexion qui met 300 ms : de quoi cliquer plusieurs fois.
            : msg.action === 'authLogin' ? (faux.loginRep || { ok: true, __lent: 300 })
            // 5.290 : le fond dit si la lecture des transporteurs est permise ICI.
            : msg.action === 'transpPermis' ? (faux.permis === undefined ? { ok: true } : { ok: true, permis: faux.permis, origines: ['https://www.mondialrelay.be/*', 'https://www.mondialrelay.fr/*', 'https://ws.chronopost.fr/*', 'https://carrier.vintedgo.com/*'] })
            : { ok: true };
          if (msg.action === 'oauthDepart') {
            if (faux.oauthFerme) { setTimeout(() => { window.chrome.runtime.lastError = { message: 'The message port closed before a response was received.' }; try { cb && cb(undefined); } finally { window.chrome.runtime.lastError = null; } }, 5); return; }
            setTimeout(() => cb && cb(faux.oauthRep || { ok: true }), 0); return;
          }
          if (faux.codeMuet && msg.action === 'codeVersion') return;   // ne répond jamais
          if (faux.permisMuet && msg.action === 'transpPermis') return; // ne répond jamais
          // 5.325 : les fournisseurs activés chez Supabase (lus par le fond).
          if (msg.action === 'fournisseursConnexion') {
            if (faux.fournisseurs === 'muet') return;                  // code périmé : ne répond jamais
            if (faux.fournisseurs === 'ferme') { setTimeout(() => { window.chrome.runtime.lastError = { message: 'The message port closed before a response was received.' }; try { cb && cb(undefined); } finally { window.chrome.runtime.lastError = null; } }, 5); return; }
            setTimeout(() => cb && cb(faux.fournisseurs || { ok: false }), 0); return;
          }
          setTimeout(() => cb && cb(r), (r && r.__lent) || 0);
        },
        lastError: null,
        id: 'abcdefghijklmnopabcdefghijklmnop',
        getManifest: () => ({ version: faux.manifeste || '5.171.0' }),
        reload: () => { window.__recharges++; },
      },
      storage: { local: {
        get: (k, cb) => { if (faux.stockKO) return Promise.reject(new Error('stockage illisible')); const out = {}; for (const c of [].concat(k)) if (mem[c] !== undefined) out[c] = mem[c]; if (cb) { setTimeout(() => cb(out), 0); return; } return Promise.resolve(out); },
        set: (o, cb) => { Object.assign(mem, o); if (cb) { setTimeout(cb, 0); return; } return Promise.resolve(); },
      }, onChanged: { addListener: (fn) => { window.__surStock = fn; } } },
      // 30 sept. : connecté, l'icône OUVRE VRM (onglet réutilisé ou créé).
      tabs: {
        query: (q, cb) => setTimeout(() => cb(q && q.active ? [{ id: 1, url: e.__url || 'https://www.vinted.fr/items/1' }] : []), 0),
        create: (o, cb) => { window.__ouvert = o.url; cb && cb(); },
        update: (id, o, cb) => { window.__ouvert = o.url; cb && cb(); },
      },
      windows: { update: () => {} },
    };
    // `chrome.permissions.request` (5.290) : noté, et l'on sait s'il part DANS le
    // geste (Firefox refuse une demande faite après une attente).
    window.__permisDemandes = [];
    window.__enClic = false;
    window.addEventListener('click', () => { window.__enClic = true; }, true);
    window.addEventListener('click', () => { window.__enClic = false; }, false);
    if (!faux.sansApiPermis) window.chrome.permissions = { request: (q, cb) => { window.__permisDemandes.push({ origins: (q && q.origins) || [], dansLeGeste: window.__enClic === true }); setTimeout(() => cb && cb(faux.permisAccorde === true), 0); } };
    window.close = () => { window.__ferme = true; };
    if (faux.orion) window.__vrmOrionCompat = true;
  }, { e: etat, faux });
  await pg.addScriptTag({ content: js });
  await pg.waitForTimeout(400);
  if (geste) { await geste(pg); await pg.waitForTimeout(500); }

  const txt = await pg.evaluate(() => document.body.innerText);
  const champs = await pg.evaluate(() => Array.from(document.querySelectorAll('input'))
    .map((i) => ({ id: i.id, ph: i.placeholder, type: i.type, visible: !!(i.offsetParent), valeur: i.value })));
  const liens = await pg.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map((a) => a.href));
  const ouvert = await pg.evaluate(() => window.__ouvert || null);
  const ferme = await pg.evaluate(() => !!window.__ferme);
  const messages = await pg.evaluate(() => window.__envoyes);
  const envoyes = messages.map((m) => m.action);
  const boutons = await pg.evaluate(() => Array.from(document.querySelectorAll('button')).filter((b) => b.offsetParent).map((b) => b.id));
  const recharges = await pg.evaluate(() => window.__recharges);
  const reparation = await pg.evaluate(() => document.body.getAttribute('data-reparation'));
  const secours = await pg.evaluate(() => document.body.getAttribute('data-lier-secours'));
  const mem = await pg.evaluate(() => window.__mem);
  const transp = await pg.evaluate(() => { const b = document.getElementById('transpBox'); const btn = document.getElementById('transpPermisBtn');
    return { etat: b && !b.hidden ? b.getAttribute('data-transp-permis') : null, demandes: window.__permisDemandes, bouton: !!(btn && btn.offsetParent), h: btn && btn.offsetParent ? Math.round(btn.getBoundingClientRect().height) : 0 }; });
  // Tout doit tenir dans la carte, sans défilement horizontal ni coupe.
  const deborde = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight + 1);
  // Rien de l'ancienne palette (or, menthe) : la famille « VRM Noir » (§7).
  const anciens = await pg.evaluate(() => /#4aa87d|#E0B972|#F7E3B6/i.test(document.documentElement.outerHTML));
  // 5.191 — le graphisme (§7) : fond, accent, et la taille des cibles au doigt.
  const look = await pg.evaluate(() => {
    const vis = (el) => !!(el && el.offsetParent);
    const h = (el) => Math.round(el.getBoundingClientRect().height);
    // 5.328 : le geste principal est « Me connecter » (email + mot de passe VRM).
    const b = (document.getElementById('inBtn') && document.getElementById('inBtn').offsetParent ? document.getElementById('inBtn') : null) || document.getElementById('vrmBtn') || document.getElementById('lierBtn');
    return {
      fond: getComputedStyle(document.body).backgroundColor,
      accent: b ? getComputedStyle(b).backgroundColor : '',
      rayon: b ? getComputedStyle(b).borderTopLeftRadius : '',
      cibles: Array.from(document.querySelectorAll('button, input, #mdpLien')).filter(vis).map((el) => ({ id: el.id || el.tagName, h: h(el) })),
      largeurCorps: Math.round(document.body.getBoundingClientRect().width),
      policeChamps: Array.from(document.querySelectorAll('input')).filter(vis).map((i) => parseFloat(getComputedStyle(i).fontSize)),
      debordeX: document.documentElement.scrollWidth - window.innerWidth,
      viewport: !!document.querySelector('meta[name="viewport"]'),
    };
  });
  if (carte && process.env.BANC_CAPTURES) await pg.screenshot({ path: path.join(process.env.BANC_CAPTURES, `popup-carte-${etat.connecte ? 'co' : 'deco'}.png`) });
  if (faux.capture && process.env.BANC_CAPTURES) await pg.screenshot({ path: path.join(process.env.BANC_CAPTURES, faux.capture), fullPage: true });
  const fourn = await pg.evaluate(() => ({
    attr: document.body.getAttribute('data-fournisseurs'),
    boutons: Array.from(document.querySelectorAll('button[data-fournisseur]')).filter((b) => b.offsetParent).map((b) => ({ id: b.getAttribute('data-fournisseur'), txt: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height), svg: !!b.querySelector('svg'), y: Math.round(b.getBoundingClientRect().top) })),
    lierY: (() => { const b = document.getElementById('lierBtn'); return b && b.offsetParent ? Math.round(b.getBoundingClientRect().top) : null; })(),
    formY: (() => { const b = document.getElementById('mdpForm'); return b && !b.hidden ? Math.round(b.getBoundingClientRect().top) : null; })(),
    mot: (() => { const m = document.getElementById('mdpOauthMot'); return m && !m.hidden && m.offsetParent ? m.textContent : ''; })(),
  }));
  await ctx.close();
  return { txt, champs, liens, erreurs, ouvert, ferme, envoyes, messages, boutons, deborde, anciens, recharges, reparation, mem, secours, look, transp, fourn };
}
const ouvrirMdp = async (pg) => { const a = await pg.$('#mdpLien'); if (a) { await a.click(); await pg.waitForTimeout(120); } };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

  // ── 1. PAS CONNECTÉ — l'état d'un nouveau venu ───────────────────────────
  console.log('\n── Fenêtre de l’extension, personne n’est connecté');
  await essaie('pas connecté', async () => {
    const neuf = await rendre(nav, { ok: true, connecte: false, cloisonne: false });
    dit(!neuf.erreurs.length, 'la popup s’exécute sans erreur', neuf.erreurs[0]);
    // 5.328 (Julien : « je ne veux pas avoir besoin d'aller sur le site pour
    // connecter l'extension ») : le geste principal est le mot de passe VRM ICI.
    dit(neuf.boutons[0] === 'inBtn' && neuf.champs.filter((c) => c.visible).map((c) => c.id).join() === 'mail,pw', 'le geste principal : email + mot de passe VRM, « Me connecter » en premier', JSON.stringify({ b: neuf.boutons, c: neuf.champs.filter((c) => c.visible).map((c) => c.id) }));
    dit(neuf.boutons[neuf.boutons.length - 1] === 'lierBtn', '« Se connecter en passant par le site VRM » : en tout dernier recours', JSON.stringify(neuf.boutons));
    dit(neuf.liens.some((h) => /mot-de-passe-oublie/.test(h)), '« Mot de passe oublié ? » mène à la récupération de VRM', JSON.stringify(neuf.liens));
    dit(neuf.liens.some((h) => /vrm\.center/.test(h)), 'et on peut aller créer son compte depuis ici');
    dit(!neuf.ouvert, 'pas connecté : rien ne s’ouvre tout seul', neuf.ouvert);
    dit(!neuf.envoyes.includes('freshness') && !neuf.envoyes.includes('syncNow'), 'la fenêtre ne lit plus de données (tout est dans l’app)', JSON.stringify(neuf.envoyes));
    dit(!neuf.anciens, 'plus rien de l’ancien logo doré ni de la menthe');
  });
  await essaie('« Se connecter avec VRM »', async () => {
    const r = await rendre(nav, { ok: true, connecte: false }, { geste: (pg) => pg.click('#lierBtn') });
    const m = r.messages.find((x) => x.action === 'lierAvecVRM');
    dit(!!m && /vinted\.fr/.test(m.urlActive || ''), 'un clic : le service worker OUVRE VRM (avec l’identifiant de cette extension) — rien à taper', JSON.stringify(r.messages));
    dit(!r.envoyes.includes('authLogin'), 'et aucun mot de passe n’est envoyé', JSON.stringify(r.envoyes));
    dit(r.ferme, 'la petite fenêtre se referme (VRM est devant)');
  });
  // ⚠️⚠️ Revue du 11 octobre — CODE PÉRIMÉ : l'ancien service worker ne connaît
  //    pas `lierAvecVRM`. Le clic fermait la fenêtre et RIEN ne se passait
  //    (mesuré dans un vrai Chromium, sur 5 de ses 6 Chrome).
  await essaie('« Se connecter avec VRM » sur un code périmé', async () => {
    const r = await rendre(nav, { ok: true, connecte: false }, { geste: async (pg) => { await pg.click('#lierBtn'); await pg.waitForTimeout(400); }, faux: { lierFerme: true, codeFerme: true, manifeste: '5.171.0' } });
    dit(/lier-extension=abcdefghijklmnopabcdefghijklmnop/.test(r.ouvert || ''), 'le service worker ne répond pas : la fenêtre OUVRE VRM elle-même, avec l’identifiant de cette extension', String(r.ouvert));
    dit(r.recharges === 1 && r.secours === 'recharge', 'et répare le code (⟳ = `chrome.runtime.reload`, une fois)', JSON.stringify({ recharges: r.recharges, secours: r.secours }));
    const d = await rendre(nav, { ok: true, connecte: false }, { geste: async (pg) => { await pg.click('#lierBtn'); await pg.waitForTimeout(400); }, faux: { lierFerme: true, codeFerme: true, manifeste: '5.171.0', stock: { vrmReparation: { cle: '5.171.0', at: Date.now() } } } });
    dit(d.recharges === 0 && d.champs.some((c) => c.id === 'pw' && c.visible) && /⟳/.test(d.txt) && /mot de passe VRM/.test(d.txt) && !d.ferme, 'réparation déjà tentée : le mot de passe VRM se déplie, et la fenêtre dit le geste (⟳) — elle ne se ferme pas sur rien', JSON.stringify({ recharges: d.recharges, champs: d.champs.filter((c) => c.visible).map((c) => c.id), ferme: d.ferme }));
    const ok = await rendre(nav, { ok: true, connecte: false }, { geste: (pg) => pg.click('#lierBtn') });
    dit(ok.recharges === 0 && !/lier-extension/.test(ok.ouvert || '') && ok.ferme, 'autre sens : un service worker à jour répond — rien d’autre (ni rechargement, ni second onglet)', JSON.stringify({ recharges: ok.recharges, ouvert: ok.ouvert, ferme: ok.ferme }));
  });
  // Le mot de passe VRM reste possible — sur demande, avec la mise en garde.
  await essaie('mot de passe sur demande', async () => {
    const r = await rendre(nav, { ok: true, connecte: false }, { geste: ouvrirMdp });
    dit(r.champs.some((c) => c.id === 'mail' && c.visible) && r.champs.some((c) => c.id === 'pw' && c.visible), '« avec mon mot de passe VRM » : les deux champs apparaissent', JSON.stringify(r.champs));
    // ⚠️⚠️ LE DÉFAUT QUI COÛTE : on arrive de Vinted, on lit « Mot de passe », et
    //    on tape celui de Vinted. La fenêtre doit dire DE QUEL compte il s'agit.
    dit(/VRM/.test(r.txt) && /pas ton mot de passe Vinted|jamais besoin/i.test(r.txt), 'et elle dit que c’est le compte VRM, PAS le mot de passe Vinted', r.txt.replace(/\n/g, ' · ').slice(0, 220));
    dit(r.champs.every((c) => !/^Mot de passe$/.test(c.ph || '')) && r.champs.some((c) => /VRM/.test(c.ph || '')), 'les placeholders disent VRM (c’est eux qu’on lit en tapant)', JSON.stringify(r.champs.map((c) => c.ph)));
  });
  // Une connexion à la fois : un double clic + Entrée ouvrait plusieurs sessions.
  await essaie('une connexion à la fois', async () => {
    const r = await rendre(nav, { ok: true, connecte: false }, { geste: async (pg) => {
      await ouvrirMdp(pg);
      await pg.fill('#mail', 'sophie@exemple.fr'); await pg.fill('#pw', 'motdepasse-vrm');
      await pg.click('#inBtn'); await pg.press('#pw', 'Enter'); await pg.press('#pw', 'Enter');
    } });
    const n = r.envoyes.filter((a) => a === 'authLogin').length;
    dit(n === 1, 'un clic et deux Entrée pendant la connexion : UNE seule connexion envoyée', `${n} envois`);
  });

  // ⚠️⚠️ CAPTCHA (21 oct.) : le jour où Turnstile est allumé dans Supabase,
  //    GoTrue refuse `grant_type=password` sans jeton (400 « captcha
  //    protection: request disallowed »). La fenêtre ne peut pas afficher
  //    Turnstile : elle doit le DIRE en français et donner le geste qui marche.
  //    Deux formes servies : le refus brut (ce que relaie un service worker
  //    d'avant la 5.202) et le refus traduit (`captcha: true`, 5.202).
  const tape = async (pg) => { await ouvrirMdp(pg); await pg.fill('#mail', 'sophie@exemple.fr'); await pg.fill('#pw', 'motdepasse-vrm'); await pg.click('#inBtn'); };
  const BRUT = { ok: false, error: 'captcha protection: request disallowed (no captcha response (captcha_token) found in request)' };
  const TRADUIT = { ok: false, captcha: true, error: 'La connexion par mot de passe n’est plus possible depuis l’extension : utilise « Se connecter avec VRM ».' };
  for (const [nom, rep] of [['refus brut', BRUT], ['refus traduit', TRADUIT]]) {
    for (const carte of [false, true]) {
      await essaie('captcha ' + nom + (carte ? ' (carte)' : ''), async () => {
        const r = await rendre(nav, { ok: true, connecte: false }, { carte, geste: tape, faux: { loginRep: rep } });
        const lieu = carte ? ' (carte)' : '';
        dit(/plus possible depuis l.extension/i.test(r.txt) && /Se connecter avec VRM/.test(r.txt), `GoTrue refuse pour captcha (${nom})${lieu} : la phrase claire, en français`, r.txt.replace(/\n/g, ' · ').slice(0, 260));
        dit(!/captcha protection|request disallowed/i.test(r.txt), `et pas le message brut de GoTrue${lieu}`);
        dit(r.boutons.includes('captchaLierBtn'), `et le bouton « Se connecter avec VRM » est proposé juste là${lieu}`, JSON.stringify(r.boutons));
        dit(!r.champs.some((c) => c.id === 'pw' && c.visible), `et le champ mot de passe ne réclame plus rien${lieu}`, JSON.stringify(r.champs));
      });
    }
  }
  await essaie('captcha : le bouton ouvre VRM', async () => {
    const r = await rendre(nav, { ok: true, connecte: false }, { geste: async (pg) => { await tape(pg); await pg.waitForTimeout(150); await pg.click('#captchaLierBtn'); }, faux: { loginRep: TRADUIT } });
    dit(r.envoyes.includes('lierAvecVRM'), 'le bouton du refus captcha lance « Se connecter avec VRM »', JSON.stringify(r.envoyes));
  });
  // L'autre sens : un mauvais mot de passe n'est PAS un refus captcha.
  await essaie('mauvais mot de passe', async () => {
    const r = await rendre(nav, { ok: true, connecte: false }, { geste: tape, faux: { loginRep: { ok: false, error: 'Email ou mot de passe incorrect.' } } });
    dit(/E-?mail ou mot de passe incorrect/.test(r.txt) && !r.boutons.includes('captchaLierBtn') && !/plus possible depuis/.test(r.txt), 'un mauvais mot de passe reste un mauvais mot de passe (pas de phrase captcha)', r.txt.replace(/\n/g, ' · ').slice(0, 200));
  });

  // ── 1 bis. « CONTINUER AVEC GOOGLE / DISCORD » (5.325, 8 nov.) ───────────
  // Julien : « une personne qui a créé son compte avec Google ou Discord et qui
  // veut se connecter à l'extension, il ne va pas pouvoir ». Deux boutons sous
  // « Se connecter avec VRM », SEULEMENT pour un fournisseur que Supabase dit
  // activé ; « pas su » ⇒ rien (jamais un bouton qui mène à une erreur).
  console.log('\n── Continuer avec Google / Discord');
  const LES_DEUX = { ok: true, google: true, discord: true };
  await essaie('fournisseurs activés', async () => {
    for (const scheme of ['dark', 'light']) {
      const r = await rendre(nav, { ok: true, connecte: false }, { scheme, faux: { fournisseurs: LES_DEUX, capture: `popup-oauth-${scheme}.png` } });
      const b = r.fourn.boutons;
      dit(!r.erreurs.length, `${scheme} : sans erreur`, r.erreurs[0]);
      dit(b.length === 2 && b[0].id === 'google' && b[1].id === 'discord' && b[0].txt === 'Continuer avec Google' && b[1].txt === 'Continuer avec Discord', `${scheme} : « Continuer avec Google » puis « Continuer avec Discord »`, JSON.stringify(b));
      dit(b.every((x) => x.svg && x.h >= 44), `${scheme} : chacun avec son logo, au moins 44 px`, JSON.stringify(b));
      dit(r.fourn.formY != null && r.fourn.lierY != null && b.every((x) => x.y > r.fourn.formY && x.y < r.fourn.lierY), `${scheme} : SOUS le mot de passe, AU-DESSUS du dernier recours par le site`, JSON.stringify({ form: r.fourn.formY, lier: r.fourn.lierY, b: b.map((x) => x.y) }));
      dit(r.look.accent === (scheme === 'dark' ? 'rgb(10, 132, 255)' : 'rgb(0, 113, 227)'), `${scheme} : « Me connecter » porte le bleu de l’app (un seul accent)`, r.look.accent);
    }
  });
  for (const [nom, rep, attendu] of [['Google seul', { ok: true, google: true, discord: false }, ['google']], ['Discord seul', { ok: true, google: false, discord: true }, ['discord']], ['aucun activé', { ok: true, google: false, discord: false }, []], ['pas su (ok:false)', { ok: false }, []], ['pas su (fond muet)', 'muet', []], ['pas su (code périmé)', 'ferme', []]]) {
    await essaie('fournisseurs ' + nom, async () => {
      const r = await rendre(nav, { ok: true, connecte: false }, { faux: { fournisseurs: rep }, geste: nom === 'pas su (fond muet)' ? (pg) => pg.waitForTimeout(3200) : null });
      const ids = r.fourn.boutons.map((x) => x.id);
      dit(JSON.stringify(ids) === JSON.stringify(attendu), `${nom} : ${attendu.length ? 'seulement ' + attendu.join(', ') : 'aucun bouton'}`, JSON.stringify({ ids, attr: r.fourn.attr }));
      dit(r.boutons.includes('lierBtn') && !r.erreurs.length, `${nom} : « Se connecter avec VRM » reste, sans erreur`, JSON.stringify(r.boutons));
    });
  }
  for (const fourn of ['google', 'discord']) {
    await essaie('clic ' + fourn, async () => {
      const r = await rendre(nav, { ok: true, connecte: false }, { faux: { fournisseurs: LES_DEUX }, geste: (pg) => pg.click('#oauth-' + fourn) });
      const m = r.messages.find((x) => x.action === 'oauthDepart');
      dit(!!m && m.fournisseur === fourn && !r.envoyes.includes('lierAvecVRM'), `clic « Continuer avec ${fourn} » : l’OAuth part DANS l’extension (oauthDepart), pas par VRM`, JSON.stringify(r.messages.map((x) => x.action)));
      dit(r.ferme && !r.envoyes.includes('authLogin'), 'la fenêtre se referme, aucun mot de passe envoyé', JSON.stringify(r.envoyes));
      const k = await rendre(nav, { ok: true, connecte: false }, { carte: true, faux: { fournisseurs: LES_DEUX, oauthRep: { ok: false, code: 'ferme', message: 'La connexion avec Discord n’est pas ouverte sur VRM. Connecte-toi avec ton email et ton mot de passe VRM.' } }, geste: (pg) => pg.click('#oauth-' + fourn) });
      dit(/n’est pas ouverte sur VRM/.test(k.txt) && !k.ferme, 'un départ refusé : la raison est DITE, jamais un échec muet', k.txt.replace(/\n/g, ' · ').slice(0, 200));
      const p = await rendre(nav, { ok: true, connecte: false }, { faux: { fournisseurs: LES_DEUX, oauthFerme: true, lierFerme: true, codeFerme: true, manifeste: '5.325.0' }, geste: async (pg) => { await pg.click('#oauth-' + fourn); await pg.waitForTimeout(400); } });
      dit(p.ouvert === `https://vrm.center/?tab=plat_vinted&lier-extension=abcdefghijklmnopabcdefghijklmnop&connexion=${fourn}`, `fond d’avant (sans oauthDepart) : la fenêtre ouvre VRM elle-même, avec connexion=${fourn}`, String(p.ouvert));
    });
  }
  await essaie('« Se connecter avec VRM » ne porte pas de fournisseur', async () => {
    const r = await rendre(nav, { ok: true, connecte: false }, { faux: { fournisseurs: LES_DEUX }, geste: (pg) => pg.click('#lierBtn') });
    const m = r.messages.find((x) => x.action === 'lierAvecVRM');
    dit(!!m && !('connexion' in m), 'le bouton principal n’envoie aucun `connexion` (un clic passe un événement, pas un nom)', JSON.stringify(m));
  });
  await essaie('le mot de passe le dit', async () => {
    const r = await rendre(nav, { ok: true, connecte: false }, { faux: { fournisseurs: LES_DEUX }, geste: ouvrirMdp });
    dit(r.fourn.mot === 'Compte créé avec Google ou Discord ? Utilise les boutons au-dessus.', 'sous les boutons : « Compte créé avec Google ou Discord ? Utilise les boutons au-dessus. »', r.fourn.mot);
    const g = await rendre(nav, { ok: true, connecte: false }, { faux: { fournisseurs: { ok: true, google: true, discord: false } }, geste: ouvrirMdp });
    dit(g.fourn.mot === 'Compte créé avec Google ? Utilise le bouton au-dessus.', 'un seul activé : la phrase ne nomme que lui', g.fourn.mot);
    const n = await rendre(nav, { ok: true, connecte: false }, { faux: { fournisseurs: { ok: false } }, geste: ouvrirMdp });
    dit(n.fourn.mot === '', 'pas su : la phrase ne renvoie pas vers des boutons absents', n.fourn.mot);
  });
  await essaie('Orion', async () => {
    const r = await rendre(nav, { ok: true, connecte: false }, { faux: { fournisseurs: LES_DEUX, orion: true } });
    dit(r.fourn.boutons.length === 2 && r.fourn.formY != null && r.fourn.boutons.every((x) => x.y > r.fourn.formY), 'Orion : le même ordre que partout (mot de passe, puis Google / Discord)', JSON.stringify(r.fourn));
    dit(r.fourn.mot === 'Compte créé avec Google ou Discord ? Utilise les boutons au-dessus.', 'Orion : et la phrase est vraie (« au-dessus »)', r.fourn.mot);
  });
  await essaie('carte', async () => {
    const r = await rendre(nav, { ok: true, connecte: false }, { carte: true, faux: { fournisseurs: LES_DEUX, capture: 'popup-oauth-carte.png' } });
    dit(r.fourn.boutons.length === 2, 'dans la petite carte aussi', JSON.stringify(r.fourn.boutons));
    dit(!r.deborde, 'et tout y tient (320 × 720, la plus grande hauteur que la carte donne au cadre), sans défilement');
  });

  // ── 2. CONNECTÉ — on ne redemande rien ───────────────────────────────────
  console.log('\n── Connecté : la fenêtre ne redemande pas de mot de passe');
  await essaie('connecté', async () => {
    const co = await rendre(nav, { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true });
    dit(!co.erreurs.length, 'toujours aucune erreur', co.erreurs[0]);
    // 30 sept. (Julien) : « quand on ouvre l'extension, je veux que ça ouvre VRM ».
    dit(/^https:\/\/vrm\.center\/\?tab=plat_vinted$/.test(co.ouvert || ''), 'connecté, depuis Vinted : l’icône ouvre VRM sur l’onglet Vinted', co.ouvert);
    dit(co.ferme, 'et la petite fenêtre se referme');
    dit(!co.champs.some((c) => c.id === 'pw'), 'et aucun champ mot de passe');
    const lbc = await rendre(nav, { ok: true, connecte: true, cloisonne: true, __url: 'https://www.leboncoin.fr/compte/part/transaction/1' });
    dit(/tab=plat_leboncoin$/.test(lbc.ouvert || ''), 'depuis Leboncoin : l’onglet Leboncoin de VRM', lbc.ouvert);
  });

  // ── 2 bis. LE SUIVI DES TRANSPORTEURS (5.290) — la permission manque ────
  // Firefox peut laisser non accordées les permissions d'hôte MV3 : sans elles
  // l'extension se tait. Le seul endroit où le geste est possible est CETTE
  // fenêtre (une page de l'extension) : connectée, elle ne s'ouvre plus sur VRM
  // toute seule, elle propose « Autoriser VRM à lire le suivi des transporteurs ».
  console.log('\n── Connecté, la lecture des transporteurs n’est pas permise (Firefox)');
  const CO = { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true };
  await essaie('permission manquante', async () => {
    const r = await rendre(nav, CO, { faux: { permis: false } });
    dit(!r.erreurs.length, 'la popup s’exécute sans erreur', r.erreurs[0]);
    dit(!r.ouvert && !r.ferme, 'la permission manque : la fenêtre RESTE ouverte (elle ne file pas sur VRM)', JSON.stringify({ ouvert: r.ouvert, ferme: r.ferme }));
    dit(r.transp.bouton && r.transp.etat === 'manque' && /Autoriser VRM à lire le suivi des transporteurs/.test(r.txt), 'et propose « Autoriser VRM à lire le suivi des transporteurs »', r.txt.replace(/\n/g, ' · ').slice(0, 260));
    dit(r.transp.h >= 44, 'le bouton fait au moins 44 px', String(r.transp.h));
    dit(/sophie@exemple\.fr/.test(r.txt) && r.boutons.includes('vrmBtn'), 'le compte VRM est nommé et « Ouvrir VRM » reste là', JSON.stringify(r.boutons));
    dit(r.transp.demandes.length === 0, 'rien n’est demandé avant le clic', JSON.stringify(r.transp.demandes));
  });
  for (const [accorde, nom] of [[true, 'accordée'], [false, 'refusée']]) {
    await essaie('clic ' + nom, async () => {
      const r = await rendre(nav, CO, { faux: { permis: false, permisAccorde: accorde }, geste: (pg) => pg.click('#transpPermisBtn') });
      const d = r.transp.demandes[0] || {};
      dit(r.transp.demandes.length === 1 && d.origins.length === 4 && d.origins.every((o) => /^https:\/\/[a-z.]+\/\*$/.test(o)), `clic (${nom}) : les quatre sites des transporteurs sont demandés, une fois`, JSON.stringify(r.transp.demandes));
      dit(d.dansLeGeste === true, `et la demande part DANS le geste (sans attente)`, JSON.stringify(d));
      dit(r.transp.etat === (accorde ? 'accorde' : 'refuse'), `l’issue est dite : ${accorde ? 'autorisé' : 'pas autorisé'}`, String(r.transp.etat));
      dit(accorde ? (!r.transp.bouton && /C.est autorisé/.test(r.txt)) : (r.transp.bouton && /pas autorisé/.test(r.txt)), accorde ? 'accordée : le bouton s’efface, la phrase le dit' : 'refusée : le bouton reste, la phrase dit que rien n’est lu', r.txt.replace(/\n/g, ' · ').slice(0, 240));
    });
  }
  await essaie('permission : l’autre sens', async () => {
    const a = await rendre(nav, CO, { faux: { permis: true } });
    dit(/^https:\/\/vrm\.center\/\?tab=plat_vinted$/.test(a.ouvert || '') && a.ferme && !a.transp.bouton, 'tout est permis (Chrome) : l’icône ouvre VRM comme avant, aucun bouton', JSON.stringify({ ouvert: a.ouvert, bouton: a.transp.bouton }));
    const b = await rendre(nav, CO, { faux: { permis: null } });
    dit(!!b.ouvert && !b.transp.bouton, '« pas su » (le fond n’a pas pu mesurer) : on ne propose rien, VRM s’ouvre', JSON.stringify({ ouvert: b.ouvert, bouton: b.transp.bouton }));
    const c = await rendre(nav, CO, { faux: { permis: false, sansApiPermis: true } });
    dit(!!c.ouvert && !c.transp.bouton, 'un navigateur qui ne sait pas demander la permission : aucun bouton qui ne mènerait à rien', JSON.stringify({ ouvert: c.ouvert, bouton: c.transp.bouton }));
    const d = await rendre(nav, CO, { faux: { permisMuet: true }, geste: (pg) => pg.waitForTimeout(1700) });
    dit(!!d.ouvert && d.ferme, 'le fond ne répond pas : VRM s’ouvre quand même (au plus 1,5 s d’attente)', JSON.stringify({ ouvert: d.ouvert, ferme: d.ferme }));
    const e = await rendre(nav, { ok: true, connecte: false }, { faux: { permis: false } });
    dit(!e.transp.bouton, 'pas connecté : pas de bouton (la connexion d’abord)', JSON.stringify(e.boutons));
    const f = await rendre(nav, CO, { carte: true, faux: { permis: false } });
    dit(f.transp.etat === 'manque-carte' && !f.transp.bouton && /icône VRM/.test(f.txt) && !f.deborde, 'dans la petite carte : une ligne qui dit où le faire (l’icône), et tout y tient', JSON.stringify({ etat: f.transp.etat, bouton: f.transp.bouton, deborde: f.deborde }));
  });

  // ── 3. SESSION EXPIRÉE — un troisième état, pas « non connecté » ─────────
  // ⚠️ « pas su » ne vaut pas « non » : une session expirée n'est pas une
  //    absence de compte, et la consigne n'est pas la même.
  console.log('\n── Session expirée : c’est un état à part');
  await essaie('expirée', async () => {
    const exp = await rendre(nav, { ok: true, connecte: false, expiree: true, email: 'sophie@exemple.fr', cloisonne: true }, { geste: ouvrirMdp });
    dit(/expir/i.test(exp.txt), 'elle dit que la session a expiré', exp.txt.replace(/\n/g, ' · ').slice(0, 140));
    dit(/VRM/.test(exp.txt) && exp.champs.some((c) => c.id === 'mail' && c.valeur === 'sophie@exemple.fr'), 'le geste est le même (VRM la reconnecte) ; au mot de passe, l’email est déjà rempli', JSON.stringify(exp.champs));
  });

  // ── 4. LA CARTE (iframe sur le site, 2 octobre) ──────────────────────────
  console.log('\n── La même connexion, dans la petite carte en bas à droite');
  await essaie('carte', async () => {
    const cd = await rendre(nav, { ok: true, connecte: false, cloisonne: true }, { carte: true });
    dit(!cd.erreurs.length, 'elle s’exécute sans erreur', cd.erreurs[0]);
    dit(cd.boutons[0] === 'inBtn' && cd.champs.filter((c) => c.visible).length === 2, 'pas connecté : le mot de passe VRM tout de suite dans la carte (5.328)', JSON.stringify(cd.boutons));
    dit(!cd.deborde, 'tout tient dans la carte (320 × 720), sans défilement');
    const cl = await rendre(nav, { ok: true, connecte: false }, { carte: true, geste: (pg) => pg.click('#lierBtn') });
    dit(cl.envoyes.includes('lierAvecVRM') && !cl.ferme, 'dans la carte : le clic demande au service worker d’ouvrir VRM (la carte, elle, reste dans le site)', JSON.stringify(cl.envoyes));
    const cm = await rendre(nav, { ok: true, connecte: false }, { carte: true, geste: async (pg) => { await ouvrirMdp(pg); await pg.fill('#mail', 'a@b.fr'); await pg.fill('#pw', 'x'); await pg.click('#inBtn'); } });
    const login = cm.messages.find((m) => m.action === 'authLogin');
    dit(!!login && login.ouvrir === false && !cm.ouvert, 'au mot de passe : la connexion reste dans l’extension, sans ouvrir VRM', JSON.stringify(login));
    const cc = await rendre(nav, { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, { carte: true });
    dit(!cc.ouvert && !cc.ferme, 'connectée, la carte ne s’ouvre pas toute seule sur VRM (elle est dans le site)', cc.ouvert);
    dit(/sophie@exemple\.fr/.test(cc.txt), 'elle nomme le compte VRM', cc.txt.slice(0, 120));
    dit(cc.boutons.includes('vrmBtn') && cc.boutons.includes('outBtn'), 'et propose « Ouvrir VRM » et « Se déconnecter »', JSON.stringify(cc.boutons));
    dit(!cc.champs.some((c) => c.id === 'pw'), 'sans champ mot de passe');
  });

  // ── 5. LA RÉPARATION D'UN CODE PÉRIMÉ (`?mode=reparer`, 11 octobre) ───────
  // ⚠️⚠️ Mesuré : sous un manifeste neuf, le service worker exécutait encore
  //    l'ancien code tant que ⟳ n'avait pas été cliqué dans CE Chrome. Le pont
  //    pose cette page ; elle ne le croit pas sur parole.
  console.log('\n── La page de réparation');
  await essaie('réparation', async () => {
    const a = await rendre(nav, {}, { mode: 'reparer', faux: { manifeste: '5.171.0', code: '5.129.0' } });
    dit(a.recharges === 1 && a.reparation === 'recharge', 'le code qui répond (5.129.0) n’est pas celui du manifeste (5.171.0) : ⟳ (chrome.runtime.reload), UNE fois', `${a.recharges} · ${a.reparation}`);
    dit(a.mem.vrmReparation && a.mem.vrmReparation.cle === '5.171.0', 'et la garde est rangée (chrome.storage.local)', JSON.stringify(a.mem.vrmReparation));
    const b = await rendre(nav, {}, { mode: 'reparer', faux: { manifeste: '5.171.0', code: '5.129.0', stock: { vrmReparation: a.mem.vrmReparation } } });
    dit(b.recharges === 0 && b.reparation === 'deja', 'déjà rechargé pour cette version : pas une seconde fois (aucune boucle)', `${b.recharges} · ${b.reparation}`);
    const c = await rendre(nav, {}, { mode: 'reparer', faux: { manifeste: '5.171.0', code: '5.171.0' } });
    dit(c.recharges === 0 && c.reparation === 'a-jour', 'autre sens : le code est celui du manifeste — rien (un service worker lent n’est pas rechargé)', `${c.recharges} · ${c.reparation}`);
    const d = await rendre(nav, {}, { mode: 'reparer', faux: { manifeste: '5.171.0', code: '5.129.0', stockKO: true } });
    dit(d.recharges === 0, 'stockage illisible : PAS de ⟳ (sans garde, une boucle de rechargements est possible)', `${d.recharges} · ${d.reparation}`);
    dit(!a.champs.some((x) => x.visible) && !a.envoyes.includes('authEtat'), 'la page de réparation ne montre rien et ne demande rien d’autre', JSON.stringify(a.envoyes));
  });

  // ── 6. LE GRAPHISME (5.191, 19 octobre) ──────────────────────────────────
  // « VRM Noir » (§7) : sombre #07090D / accent #3D7BFF ; clair #F4F6FA /
  // accent #2458E6 — suivant le système (prefers-color-scheme). Une seule forme
  // de bouton, et toute cible au doigt ≥ 44 px (boutons, champs, le lien du
  // mot de passe).
  console.log('\n── Le graphisme : VRM Noir, clair et sombre, cibles ≥ 44 px');
  await essaie('graphisme', async () => {
    // 5.328 : les jetons de l'app (--d-*) — fond iOS #F2F2F7 / #000, bleu Apple
    // #0071E3 / #0A84FF, rayon 12 ; dans la carte, le cadre est transparent (le
    // verre de la carte est derrière).
    for (const [scheme, fond, accent] of [['dark', 'rgb(0, 0, 0)', 'rgb(10, 132, 255)'], ['light', 'rgb(242, 242, 247)', 'rgb(0, 113, 227)']]) {
      for (const carte of [false, true]) {
        const r = await rendre(nav, { ok: true, connecte: false }, { carte, scheme, geste: ouvrirMdp });
        const ou = `${scheme}${carte ? ' · carte' : ''}`;
        const fondAttendu = carte ? 'rgba(0, 0, 0, 0)' : fond;
        dit(r.look.fond === fondAttendu, `${ou} : le fond suit le système (${fondAttendu})`, r.look.fond);
        dit(r.look.accent === accent, `${ou} : le bouton principal porte LE bleu de l’app (${accent})`, r.look.accent);
        dit(r.look.rayon === '12px', `${ou} : bouton au rayon 12 (contrôles de l’app)`, r.look.rayon);
        const petits = r.look.cibles.filter((c) => c.h < 44);
        dit(r.look.cibles.length >= 4 && !petits.length, `${ou} : chaque cible (boutons, champs, lien) fait au moins 44 px`, JSON.stringify(petits.length ? petits : r.look.cibles));
      }
    }
    const co = await rendre(nav, { ok: true, connecte: true, email: 'sophie@exemple.fr' }, { carte: true, scheme: 'light' });
    const petits = co.look.cibles.filter((c) => c.h < 44);
    dit(!petits.length && co.look.cibles.length >= 2, 'connectée (carte, clair) : « Ouvrir VRM » et « Se déconnecter » ≥ 44 px', JSON.stringify(co.look.cibles));
  });

  // ── 19 octobre : AU DOIGT, SUR UN TÉLÉPHONE (Firefox Android, iPhone) ──
  // La fenêtre est lue sur un écran de 360 à 412 px : elle suit sa largeur,
  // aucun défilement de côté, et ses champs à 16 px (en dessous, iOS zoome).
  console.log('\n── Au doigt, sur un téléphone');
  await essaie('mobile', async () => {
    const UA_FX = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0';
    const UA_IP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    for (const [nom, ua, largeur] of [['Firefox Android 360', UA_FX, 360], ['Firefox Android 412', UA_FX, 412], ['iPhone 390', UA_IP, 390]]) {
      const r = await rendre(nav, { ok: true, connecte: false }, { mobile: { ua, largeur }, geste: ouvrirMdp });
      dit(r.look.viewport, `${nom} : la page déclare sa largeur d'écran (meta viewport)`);
      dit(r.look.largeurCorps >= largeur - 2, `${nom} : la fenêtre suit l'écran (${r.look.largeurCorps} px sur ${largeur})`, String(r.look.largeurCorps));
      dit(r.look.debordeX <= 0, `${nom} : aucun défilement de côté`, String(r.look.debordeX));
      dit(r.look.policeChamps.length >= 1 && r.look.policeChamps.every((f) => f >= 16), `${nom} : champs à 16 px au moins (iOS ne zoome pas au toucher)`, JSON.stringify(r.look.policeChamps));
      const petits = r.look.cibles.filter((c) => c.h < 44);
      dit(!petits.length, `${nom} : chaque cible au doigt ≥ 44 px`, JSON.stringify(petits));
    }
  });

  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} popup : ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ le banc est tombé :', e && e.message); process.exit(1); });
