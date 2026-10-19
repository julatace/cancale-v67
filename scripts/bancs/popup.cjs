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
  // La carte (2 octobre) : la même page, dans un iframe de 300 × 380 posé par
  // vrm-badge.js sur le site — `?mode=carte`.
  // `mobile` (19 oct.) : un VRAI téléphone au doigt — Firefox pour Android
  // ouvre cette fenêtre dans un onglet entier ; Orion, dans une feuille.
  const ctx = await nav.newContext(mobile
    ? Object.assign({ colorScheme: scheme, viewport: { width: mobile.largeur || 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, mobile.ua ? { userAgent: mobile.ua } : {})
    : { colorScheme: scheme, viewport: carte ? { width: 300, height: 380 } : { width: 360, height: 900 } });
  const pg = await ctx.newPage();
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8')
    .replace('<script src="popup.js"></script>', '');
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
            : msg.action === 'authLogin' ? { ok: true, __lent: 300 }
            : { ok: true };
          if (faux.codeMuet && msg.action === 'codeVersion') return;   // ne répond jamais
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
      } },
      // 30 sept. : connecté, l'icône OUVRE VRM (onglet réutilisé ou créé).
      tabs: {
        query: (q, cb) => setTimeout(() => cb(q && q.active ? [{ id: 1, url: e.__url || 'https://www.vinted.fr/items/1' }] : []), 0),
        create: (o, cb) => { window.__ouvert = o.url; cb && cb(); },
        update: (id, o, cb) => { window.__ouvert = o.url; cb && cb(); },
      },
      windows: { update: () => {} },
    };
    window.close = () => { window.__ferme = true; };
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
  // Tout doit tenir dans la carte, sans défilement horizontal ni coupe.
  const deborde = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight + 1);
  // Rien de l'ancienne palette (or, menthe) : la famille « VRM Noir » (§7).
  const anciens = await pg.evaluate(() => /#4aa87d|#E0B972|#F7E3B6/i.test(document.documentElement.outerHTML));
  // 5.191 — le graphisme (§7) : fond, accent, et la taille des cibles au doigt.
  const look = await pg.evaluate(() => {
    const vis = (el) => !!(el && el.offsetParent);
    const h = (el) => Math.round(el.getBoundingClientRect().height);
    const b = document.getElementById('lierBtn') || document.getElementById('vrmBtn');
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
  await ctx.close();
  return { txt, champs, liens, erreurs, ouvert, ferme, envoyes, messages, boutons, deborde, anciens, recharges, reparation, mem, secours, look };
}
const ouvrirMdp = async (pg) => { const a = await pg.$('#mdpLien'); if (a) { await a.click(); await pg.waitForTimeout(120); } };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

  // ── 1. PAS CONNECTÉ — l'état d'un nouveau venu ───────────────────────────
  console.log('\n── Fenêtre de l’extension, personne n’est connecté');
  await essaie('pas connecté', async () => {
    const neuf = await rendre(nav, { ok: true, connecte: false, cloisonne: false });
    dit(!neuf.erreurs.length, 'la popup s’exécute sans erreur', neuf.erreurs[0]);
    // 11 octobre : le geste principal OUVRE VRM — aucun mot de passe à taper.
    dit(neuf.boutons.includes('lierBtn') && /Se connecter avec VRM/.test(neuf.txt), 'le bouton principal est « Se connecter avec VRM »', JSON.stringify(neuf.boutons));
    dit(!neuf.champs.some((c) => c.visible), 'aucun champ à remplir au premier regard (VRM s’ouvre et connecte l’extension)', JSON.stringify(neuf.champs.filter((c) => c.visible)));
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
    dit(cd.boutons.includes('lierBtn') && !cd.champs.some((c) => c.visible), 'pas connecté : « Se connecter avec VRM », sans champ visible', JSON.stringify(cd.boutons));
    dit(!cd.deborde, 'tout tient dans la carte (300 × 380), sans défilement');
    const cl = await rendre(nav, { ok: true, connecte: false }, { carte: true, geste: (pg) => pg.click('#lierBtn') });
    dit(cl.envoyes.includes('lierAvecVRM') && !cl.ferme, 'dans la carte : le clic demande au service worker d’ouvrir VRM (la carte, elle, reste dans le site)', JSON.stringify(cl.envoyes));
    const cm = await rendre(nav, { ok: true, connecte: false }, { carte: true, geste: async (pg) => { await ouvrirMdp(pg); await pg.fill('#mail', 'a@b.fr'); await pg.fill('#pw', 'x'); await pg.click('#inBtn'); } });
    const login = cm.messages.find((m) => m.action === 'authLogin');
    dit(!!login && login.ouvrir === true, 'au mot de passe, dans la carte : c’est le service worker qui ouvrira VRM après la connexion', JSON.stringify(login));
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
    for (const [scheme, fond, accent] of [['dark', 'rgb(7, 9, 13)', 'rgb(61, 123, 255)'], ['light', 'rgb(244, 246, 250)', 'rgb(36, 88, 230)']]) {
      for (const carte of [false, true]) {
        const r = await rendre(nav, { ok: true, connecte: false }, { carte, scheme, geste: ouvrirMdp });
        const ou = `${scheme}${carte ? ' · carte' : ''}`;
        dit(r.look.fond === fond, `${ou} : le fond suit le système (${fond})`, r.look.fond);
        dit(r.look.accent === accent, `${ou} : le bouton principal porte LE bleu de la marque (${accent})`, r.look.accent);
        dit(r.look.rayon === '8px', `${ou} : bouton au rayon 8 (5 / 8 / 10 / 12)`, r.look.rayon);
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
