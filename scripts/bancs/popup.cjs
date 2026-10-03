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

// Rend la vraie popup dans une page, avec un faux `chrome` qui répond ce qu'on
// lui dit. `etat` est ce que `authEtat` renvoie côté service worker.
async function rendre(nav, etat, { carte = false } = {}) {
  // La carte (2 octobre) : la même page, dans un iframe de 300 × 380 posé par
  // vrm-badge.js sur le site — `?mode=carte`.
  const ctx = await nav.newContext({ viewport: carte ? { width: 300, height: 380 } : { width: 360, height: 900 } });
  const pg = await ctx.newPage();
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8')
    .replace('<script src="popup.js"></script>', '');
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');

  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
  await pg.route('**/*', (r) => /logo-vrm-96\.png/.test(r.request().url())
    ? r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(path.join(EXT, 'logo-vrm-96.png')) })
    : r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await pg.goto('https://ext.test/popup.html' + (carte ? '?mode=carte' : ''));
  // Le faux `chrome` : même forme que le vrai (callbacks), rien de plus.
  await pg.evaluate((e) => {
    window.__envoyes = [];
    window.chrome = {
      runtime: {
        sendMessage: (msg, cb) => {
          window.__envoyes.push(msg);
          const r = msg.action === 'authEtat' ? e
            : msg.action === 'freshness' ? { ok: true, fresh: [] }
            : { ok: true };
          setTimeout(() => cb && cb(r), 0);
        },
      },
      storage: { local: { get: (k, cb) => setTimeout(() => cb && cb({}), 0) } },
      // 30 sept. : connecté, l'icône OUVRE VRM (onglet réutilisé ou créé).
      tabs: {
        query: (q, cb) => setTimeout(() => cb(q && q.active ? [{ id: 1, url: e.__url || 'https://www.vinted.fr/items/1' }] : []), 0),
        create: (o, cb) => { window.__ouvert = o.url; cb && cb(); },
        update: (id, o, cb) => { window.__ouvert = o.url; cb && cb(); },
      },
      windows: { update: () => {} },
    };
    window.close = () => { window.__ferme = true; };
  }, etat);
  await pg.addScriptTag({ content: js });
  await pg.waitForTimeout(400);

  const txt = await pg.evaluate(() => document.body.innerText);
  const champs = await pg.evaluate(() => Array.from(document.querySelectorAll('input'))
    .map((i) => ({ id: i.id, ph: i.placeholder, type: i.type })));
  const liens = await pg.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map((a) => a.href));
  const ouvert = await pg.evaluate(() => window.__ouvert || null);
  const ferme = await pg.evaluate(() => !!window.__ferme);
  const envoyes = await pg.evaluate(() => window.__envoyes.map((m) => m.action));
  const boutons = await pg.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => b.id));
  // Tout doit tenir dans la carte, sans défilement horizontal ni coupe.
  const deborde = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight + 1);
  // Rien de l'ancienne palette (or, menthe) : la famille « VRM Noir » (§7).
  const anciens = await pg.evaluate(() => /#4aa87d|#E0B972|#F7E3B6/i.test(document.documentElement.outerHTML));
  if (carte && process.env.BANC_CAPTURES) await pg.screenshot({ path: path.join(process.env.BANC_CAPTURES, `popup-carte-${etat.connecte ? 'co' : 'deco'}.png`) });
  await ctx.close();
  return { txt, champs, liens, erreurs, pg, ouvert, ferme, envoyes, boutons, deborde, anciens };
}

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

  // ── 1. PAS CONNECTÉ — l'état d'un nouveau venu ───────────────────────────
  console.log('\n── Fenêtre de l’extension, personne n’est connecté');
  const neuf = await rendre(nav, { ok: true, connecte: false, cloisonne: false });
  dit(!neuf.erreurs.length, 'la popup s’exécute sans erreur', neuf.erreurs[0]);
  dit(neuf.champs.some((c) => c.id === 'mail') && neuf.champs.some((c) => c.id === 'pw'),
    'les deux champs sont là', JSON.stringify(neuf.champs));

  // ⚠️⚠️ LE DÉFAUT QUI COÛTE : on arrive de Vinted, on lit « Mot de passe », et
  //    on tape celui de Vinted. La fenêtre doit dire DE QUEL compte il s'agit.
  dit(/VRM/.test(neuf.txt), 'elle dit de quel compte il s’agit (VRM)',
    neuf.txt.replace(/\n/g, ' · ').slice(0, 180));
  dit(/pas ton mot de passe Vinted|jamais besoin/i.test(neuf.txt),
    'et elle dit explicitement que ce n’est PAS le mot de passe Vinted',
    neuf.txt.replace(/\n/g, ' · ').slice(0, 220));
  // Le placeholder compte autant que la phrase : c'est lui qu'on lit en tapant.
  dit(neuf.champs.every((c) => !/^Mot de passe$/.test(c.ph || '')),
    'le champ lui-même ne dit plus « Mot de passe » tout court',
    JSON.stringify(neuf.champs.map((c) => c.ph)));
  dit(neuf.liens.some((h) => /vrm\.center/.test(h)),
    'et on peut aller créer son compte depuis ici');

  // ── 2. CONNECTÉ — on ne redemande rien ───────────────────────────────────
  console.log('\n── Connecté : la fenêtre ne redemande pas de mot de passe');
  const co = await rendre(nav, { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true });
  dit(!co.erreurs.length, 'toujours aucune erreur', co.erreurs[0]);
  // 30 sept. (Julien) : « quand on ouvre l'extension, je veux que ça ouvre VRM ».
  dit(/^https:\/\/vrm\.center\/\?tab=plat_vinted$/.test(co.ouvert || ''), 'connecté, depuis Vinted : l’icône ouvre VRM sur l’onglet Vinted', co.ouvert);
  dit(co.ferme, 'et la petite fenêtre se referme');
  dit(!co.champs.some((c) => c.id === 'pw'), 'et aucun champ mot de passe');
  const lbc = await rendre(nav, { ok: true, connecte: true, cloisonne: true, __url: 'https://www.leboncoin.fr/compte/part/transaction/1' });
  dit(/tab=plat_leboncoin$/.test(lbc.ouvert || ''), 'depuis Leboncoin : l’onglet Leboncoin de VRM', lbc.ouvert);
  dit(!neuf.ouvert, 'pas connecté : rien ne s’ouvre, on montre la connexion', neuf.ouvert);

  // ── 3. SESSION EXPIRÉE — un troisième état, pas « non connecté » ─────────
  // ⚠️ « pas su » ne vaut pas « non » : une session expirée n'est pas une
  //    absence de compte, et la consigne n'est pas la même.
  console.log('\n── Session expirée : c’est un état à part');
  const exp = await rendre(nav, { ok: true, connecte: false, expiree: true, email: 'sophie@exemple.fr', cloisonne: true });
  dit(/expir/i.test(exp.txt), 'elle dit que la session a expiré', exp.txt.replace(/\n/g, ' · ').slice(0, 140));
  dit(exp.champs.some((c) => c.id === 'pw'), 'et elle redemande le mot de passe');

  // ── 4. LA CARTE (iframe sur le site, 2 octobre) ──────────────────────────
  console.log('\n── La même connexion, dans la petite carte en bas à droite');
  const cd = await rendre(nav, { ok: true, connecte: false, cloisonne: true }, { carte: true });
  dit(!cd.erreurs.length, 'elle s’exécute sans erreur', cd.erreurs[0]);
  dit(cd.champs.some((c) => c.id === 'pw') && /pas ton mot de passe Vinted/i.test(cd.txt), 'pas connecté : la connexion VRM, avec la même mise en garde', cd.txt.slice(0, 160));
  dit(!cd.deborde, 'tout tient dans la carte (300 × 380), sans défilement');
  dit(!cd.anciens && !neuf.anciens, 'plus rien de l’ancien logo doré ni de la menthe');
  const cc = await rendre(nav, { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, { carte: true });
  dit(!cc.ouvert && !cc.ferme, 'connectée, la carte ne s’ouvre pas toute seule sur VRM (elle est dans le site)', cc.ouvert);
  dit(/sophie@exemple\.fr/.test(cc.txt), 'elle nomme le compte VRM', cc.txt.slice(0, 120));
  dit(cc.boutons.includes('vrmBtn') && cc.boutons.includes('outBtn'), 'et propose « Ouvrir VRM » et « Se déconnecter »', JSON.stringify(cc.boutons));
  dit(!cc.champs.some((c) => c.id === 'pw'), 'sans champ mot de passe');
  dit(!neuf.envoyes.includes('freshness') && !neuf.envoyes.includes('syncNow'), 'la fenêtre ne lit plus de données (tout est dans l’app)', JSON.stringify(neuf.envoyes));

  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} popup : ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ le banc est tombé :', e && e.message); process.exit(1); });
