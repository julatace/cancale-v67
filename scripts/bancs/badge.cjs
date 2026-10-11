// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA PETITE CARTE VRM EN BAS À DROITE » (vrm-badge.js, 2 octobre)
//
//  Julien : « un tout petit écran en bas à droite où tu te connectes à VRM avec
//  les identifiants ; dès que tu appuies dessus, le site VRM s'ouvre ; pas
//  d'autres informations que la connexion, le compte utilisé, le compte
//  connecté et si les informations circulent bien ; le logo de l'app, jamais
//  l'ancien orange ».
//
//  §4.10 : on charge le VRAI vrm-badge.js dans une page, avec un faux `chrome`
//  qui répond ce que dirait le service worker. Aucune fixture : tout est
//  synthétique, rien de réel ne transite.
//  ⚠️ La carte vit dans une shadow root FERMÉE (le site ne doit pas pouvoir la
//  lire). Pour la juger, le banc ouvre `attachShadow` — et vérifie à part que
//  le script, lui, l'a bien demandée fermée.
//  ⚠️ Les DEUX sens (§6) : aucun faux vert quand on ne sait pas, et aucune
//  fausse alerte quand tout va bien.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const path = require('path');
const fs = require('fs');

const EXT = path.join(__dirname, '..', '..', 'vinted-sync-extension');
const JS = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => {
  if (bon) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); }
};
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 160)}`); return null; } };

const MIN = 60000;
const ETATS = {
  deconnecte: { ok: true, plateforme: 'vinted', capte: true, version: '5.130.0', vrm: { ok: true, connecte: false, cloisonne: true }, site: { id: '111', nom: 'angeled92' }, flux: {}, bascule: null },
  connecte: { ok: true, plateforme: 'vinted', capte: true, version: '5.130.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, site: { id: '111', nom: 'angeled92' }, flux: { okAt: Date.now() - 3 * MIN }, bascule: null },
  expiree: { ok: true, plateforme: 'vinted', capte: true, version: '5.130.0', vrm: { ok: true, connecte: false, expiree: true, email: 'sophie@exemple.fr', cloisonne: true }, site: { id: '111', nom: 'angeled92' }, flux: { okAt: Date.now() - 90 * MIN }, bascule: null },
  refuse: { ok: true, plateforme: 'leboncoin', capte: true, version: '5.130.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, site: { id: '9', nom: 'Sophie B.', type: 'particulier' }, flux: { okAt: Date.now() - 60 * MIN, koAt: Date.now() - 2 * MIN }, bascule: null },
  vestiaire: { ok: true, plateforme: 'vestiaire', capte: false, mesure: true, version: '5.154.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, site: null, flux: { okAt: Date.now() - 120000 }, bascule: null },
  bascule: { ok: true, plateforme: 'vinted', capte: true, version: '5.130.0', vrm: { ok: true, connecte: true, email: 'autre@exemple.fr', cloisonne: true }, site: { id: '111', nom: 'angeled92' }, flux: { okAt: Date.now() - MIN }, bascule: { de: 'sophie@exemple.fr', vers: 'autre@exemple.fr', at: Date.now() - 30 * MIN } },
};

async function rendre(nav, etat, { url = 'https://www.vinted.fr/items/1', deuxFois = false, dansIframe = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1512, height: 900 } });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  await pg.route('**/*', (r) => {
    const u = metaVersData(r.request().url());
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    if (/popup\.html/.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body style="background:#07090D;color:#fff">connexion</body>' });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body style="margin:0;background:#fff;font-family:sans-serif"><h1 style="padding:20px">Une page du site</h1><iframe id="sous" src="/sous" style="width:300px;height:120px"></iframe></body></html>' });
  });
  await pg.goto(url);
  const installe = async (frame) => frame.evaluate(({ e, js }) => {
    window.__modes = [];
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { window.__modes.push(o && o.mode); return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.__envoyes = [];
    window.chrome = {
      runtime: {
        id: 'ext',
        getURL: (p) => location.origin + '/' + p,
        getManifest: () => ({ version: e.__manif || 'essai' }),
        lastError: null,
        sendMessage: (msg, cb) => {
          window.__envoyes.push(msg);
          // Un service worker qui ne connaît pas la liaison (code d'avant) : le
          // port se ferme sans réponse.
          if (msg.action === 'lierAvecVRM' && e.__lierMuet) { setTimeout(() => { window.chrome.runtime.lastError = { message: 'The message port closed before a response was received.' }; cb && cb(undefined); window.chrome.runtime.lastError = null; }, 0); return; }
          setTimeout(() => cb && cb(msg.action === 'etat' ? e : { ok: true }), 0);
        },
      },
      storage: { onChanged: { addListener() {} } },
    };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: etat, js: JS });
  await installe(pg.mainFrame());
  if (deuxFois) await installe(pg.mainFrame());
  if (dansIframe) { const f = pg.frames().find((x) => x !== pg.mainFrame()); if (f) await installe(f); }
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}

const lire = (pg) => pg.evaluate(() => {
  const h = document.getElementById('vrm-badge');
  if (!h || !h.shadowRoot) return null;
  const r = h.shadowRoot;
  const img = r.querySelector('.btn img');
  const pt = r.querySelector('.pt');
  return {
    n: document.querySelectorAll('#vrm-badge').length,
    imgSrc: img ? img.getAttribute('src') : null,
    point: pt ? getComputedStyle(pt).display !== 'none' : false,
    pointCouleur: pt ? getComputedStyle(pt).backgroundColor : '',
    carte: (r.querySelector('.carte') || {}).innerText || '',
    carteVisible: r.querySelector('.carte') ? getComputedStyle(r.querySelector('.carte')).display !== 'none' : false,
    iframe: r.querySelector('.connexion iframe') ? r.querySelector('.connexion iframe').getAttribute('src') : null,
    modes: window.__modes,
    envoyes: window.__envoyes.map((m) => m.action),
    // Le mot de passe ne doit JAMAIS être un champ de la page.
    champsPage: Array.from(document.querySelectorAll('input')).length + Array.from(r.querySelectorAll('input')).length,
    // Rien de l'ancien bouton orange.
    orange: /#D2401E|rgb\(210, 64, 30\)/i.test(document.documentElement.outerHTML + r.innerHTML),
  };
});

const survoler = async (pg) => { await pg.mouse.move(1512 - 16 - 22, 900 - 16 - 22); await pg.waitForTimeout(200); };
const cliquer = async (pg) => { await pg.mouse.click(1512 - 16 - 22, 900 - 16 - 22); await pg.waitForTimeout(200); };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });

  // ── 1. PERSONNE N'EST CONNECTÉ ────────────────────────────────────────────
  console.log('\n── Vinted, personne n’est connecté à VRM');
  await essaie('déconnecté', async () => {
    const { ctx, pg, erreurs } = await rendre(nav, ETATS.deconnecte);
    let l = await lire(pg);
    dit(!erreurs.length, 'le script tourne sans erreur', erreurs[0]);
    dit(l && l.n === 1, 'une seule carte VRM sur la page', l && l.n);
    dit(l && l.modes.includes('closed'), 'dans une shadow root FERMÉE (le site ne peut pas la lire)', l && JSON.stringify(l.modes));
    dit(l && /logo-vrm-96\.png$/.test(l.imgSrc || ''), 'le bouton porte le logo de l’app', l && l.imgSrc);
    dit(l && !l.orange, 'rien de l’ancien bouton orange');
    dit(l && l.point, 'la pastille ambre s’allume : il y a quelque chose à faire');
    await survoler(pg);
    l = await lire(pg);
    dit(l.carteVisible && /Pas connecté/i.test(l.carte), 'au survol, la carte dit « pas connecté »', l.carte.replace(/\n/g, ' · ').slice(0, 160));
    await cliquer(pg);
    l = await lire(pg);
    // 11 octobre (Julien : « quand j'appuie sur se connecter ça doit envoyer
    // directement dans l'application VRM ») : le logo OUVRE VRM à chaque fois ;
    // pas connecté, VRM s'ouvre avec l'identifiant de l'extension et la connecte.
    dit(l.envoyes.includes('lierAvecVRM') && !l.iframe, 'pas connecté : le clic OUVRE VRM (qui connecte l’extension) — rien à taper dans le site', JSON.stringify({ envoyes: l.envoyes, iframe: l.iframe }));
    dit(l.champsPage === 0, 'et AUCUN champ (mot de passe compris) dans le DOM du site', 'champs : ' + l.champsPage);
    await ctx.close();
  });
  await essaie('déconnecté, service worker d’avant', async () => {
    const { ctx, pg } = await rendre(nav, Object.assign({}, ETATS.deconnecte, { __lierMuet: true }));
    await cliquer(pg); await pg.waitForTimeout(200);
    const l = await lire(pg);
    dit(/popup\.html\?mode=carte$/.test(l.iframe || '') && l.champsPage === 0, 'en secours (un service worker qui ne connaît pas la liaison) : la connexion s’ouvre dans un iframe de l’extension, jamais dans le site', JSON.stringify({ iframe: l.iframe, champs: l.champsPage }));
    await pg.screenshot({ path: path.join(SORTIE, 'badge-connexion.png') });
    await ctx.close();
  });

  // ── 1bis. CODE PÉRIMÉ (11 octobre) ───────────────────────────────────────
  // Le manifeste dit 5.171, le service worker exécute un code d'avant (⟳ jamais
  // cliqué) : la carte disait « recharge la page » — ce qui ne change RIEN.
  console.log('\n── Code périmé : le manifeste neuf, le service worker d’avant');
  await essaie('périmé', async () => {
    const { ctx, pg } = await rendre(nav, Object.assign({}, ETATS.connecte, { __manif: '5.171.0', version: '5.171.0' }));
    await survoler(pg); await pg.waitForTimeout(200);
    const l = await lire(pg);
    const cadres = await pg.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src')));
    dit(/ancienne version/.test(l.carte) && /⟳/.test(l.carte) && l.point, 'la carte le dit (« elle tourne encore sur son ancienne version… ⟳ »), pastille allumée', l.carte.replace(/\n/g, ' · ').slice(0, 220));
    dit(cadres.some((u) => /popup\.html\?mode=reparer$/.test(u || '')), 'et elle pose la page de réparation de l’extension (qui vérifie avant ⟳)', JSON.stringify(cadres));
    await ctx.close();
    const ok2 = await rendre(nav, Object.assign({}, ETATS.connecte, { __manif: '5.171.0', version: '5.171.0', code: '5.171.0' }));
    await survoler(ok2.pg); await ok2.pg.waitForTimeout(200);
    const l2 = await lire(ok2.pg);
    const c2 = await ok2.pg.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src')));
    dit(!/ancienne version/.test(l2.carte) && !c2.some((u) => /mode=reparer/.test(u || '')) && !l2.point, 'autre sens : le code du manifeste — ni alerte, ni réparation', JSON.stringify({ carte: l2.carte.slice(0, 80), cadres: c2 }));
    await ok2.ctx.close();
  });

  // ── 2. CONNECTÉ, TOUT CIRCULE ─────────────────────────────────────────────
  console.log('\n── Connecté, les données circulent');
  await essaie('connecté', async () => {
    const { ctx, pg, erreurs } = await rendre(nav, ETATS.connecte);
    let l = await lire(pg);
    dit(!erreurs.length, 'aucune erreur', erreurs[0]);
    dit(!l.point, 'aucune pastille : rien à faire, rien ne s’allume (§7)');
    await survoler(pg);
    l = await lire(pg);
    dit(/sophie@exemple\.fr/.test(l.carte), 'la carte nomme le compte VRM utilisé', l.carte.slice(0, 120));
    dit(/angeled92/.test(l.carte), 'et le compte Vinted connecté', l.carte.slice(0, 160));
    dit(/Envoyées à VRM il y a 3 min/.test(l.carte), 'et dit quand les données sont parties pour la dernière fois', l.carte.replace(/\n/g, ' · '));
    await pg.screenshot({ path: path.join(SORTIE, 'badge-connecte.png') });
    await cliquer(pg);
    l = await lire(pg);
    dit(l.envoyes.includes('ouvrirVRM'), 'un clic ouvre VRM', JSON.stringify(l.envoyes));
    dit(!l.iframe, 'et ne montre aucun formulaire', l.iframe);
    await ctx.close();
  });

  // ── 3. SESSION EXPIRÉE ────────────────────────────────────────────────────
  console.log('\n── Session expirée');
  await essaie('expirée', async () => {
    const { ctx, pg } = await rendre(nav, ETATS.expiree);
    await survoler(pg);
    const l = await lire(pg);
    dit(l.point && /expirée/i.test(l.carte), 'ambre, et la carte dit que la session a expiré', l.carte.slice(0, 160));
    await ctx.close();
  });

  // ── 4. DERNIER ENVOI REFUSÉ (Leboncoin) ───────────────────────────────────
  console.log('\n── Leboncoin, le dernier envoi a été refusé');
  await essaie('refusé', async () => {
    const { ctx, pg } = await rendre(nav, ETATS.refuse, { url: 'https://www.leboncoin.fr/mes-annonces' });
    await survoler(pg);
    const l = await lire(pg);
    dit(l.point, 'la pastille s’allume : les données ne passent plus');
    dit(/refusé il y a 2 min/i.test(l.carte), 'la carte dit que le dernier envoi a été refusé, et quand', l.carte.replace(/\n/g, ' · '));
    dit(!/Envoyées à VRM/.test(l.carte), 'et ne dit PAS « envoyées » par-dessus (le refus est plus récent)');
    dit(/Sophie B\./.test(l.carte), 'elle nomme le compte Leboncoin');
    await ctx.close();
  });

  // ── 5. PAS SU : le service worker ne répond pas ──────────────────────────
  console.log('\n── Le service worker ne répond pas (« pas su »)');
  await essaie('pas su', async () => {
    const { ctx, pg } = await rendre(nav, null);
    await survoler(pg);
    const l = await lire(pg);
    dit(!l.point, 'aucune alerte : « pas su » ne vaut pas « pas connecté »');
    dit(!/Pas connecté|Envoyées/i.test(l.carte), 'ni « pas connecté », ni « envoyées » (aucun faux vert)', l.carte.slice(0, 120));
    dit(/ne répond pas/i.test(l.carte), 'elle dit simplement qu’elle ne sait pas', l.carte.slice(0, 120));
    await ctx.close();
  });

  // ── 6. VESTIAIRE : MESURÉ, PAS CAPTÉ — et on le dit (5.154) ──────────────
  // La carte dit que VRM apprend à lire le site (la forme des pages, jamais leur
  // contenu), qu'aucune vente n'est captée, et quand le relevé est parti — sans
  // jamais « Tes données » ni « Envoyées » (ce serait un faux vert).
  console.log('\n── Vestiaire Collective (mesuré, pas encore capté)');
  await essaie('vestiaire', async () => {
    const { ctx, pg } = await rendre(nav, ETATS.vestiaire, { url: 'https://fr.vestiairecollective.com/' });
    await survoler(pg);
    const l = await lire(pg);
    dit(l.n === 1 && /logo-vrm-96/.test(l.imgSrc || ''), 'la même carte, le même logo');
    dit(/apprend à lire Vestiaire/i.test(l.carte) && /Aucune vente ni annonce n'est encore captée/i.test(l.carte), 'elle dit que VRM apprend à lire ce site, et que rien n’est encore capté', l.carte.slice(0, 200));
    dit(/Relevé envoyé/i.test(l.carte), 'elle dit quand le relevé est parti', l.carte.slice(0, 220));
    dit(!/Envoyées|Tes données/i.test(l.carte), 'et ne prétend jamais que des données circulent');
    await ctx.close();
  });

  // ── 7. UNE AUTRE SESSION VRM A ÉTÉ ADOPTÉE (mesuré le 2 octobre) ─────────
  console.log('\n── Ce Chrome a changé de compte VRM');
  await essaie('bascule', async () => {
    const { ctx, pg } = await rendre(nav, ETATS.bascule);
    await survoler(pg);
    const l = await lire(pg);
    dit(l.point, 'la pastille s’allume');
    dit(/sophie@exemple\.fr/.test(l.carte) && /autre@exemple\.fr/.test(l.carte), 'la carte nomme les DEUX comptes VRM (sans les deux, on ne sait pas lequel changer)', l.carte.replace(/\n/g, ' · ').slice(0, 260));
    await pg.screenshot({ path: path.join(SORTIE, 'badge-bascule.png') });
    await ctx.close();
  });

  // ── 8. UNE SEULE CARTE, PAGE DU HAUT SEULEMENT ───────────────────────────
  console.log('\n── Une seule carte par onglet');
  await essaie('unicité', async () => {
    const { ctx, pg } = await rendre(nav, ETATS.connecte, { deuxFois: true, dansIframe: true });
    const n = await pg.evaluate(() => document.querySelectorAll('#vrm-badge').length);
    const nSous = await Promise.all(pg.frames().filter((f) => f !== pg.mainFrame()).map((f) => f.evaluate(() => document.querySelectorAll('#vrm-badge').length).catch(() => 0)));
    dit(n === 1, 'injecté deux fois : toujours une seule carte', n);
    dit(nSous.every((x) => x === 0), 'aucune carte dans un iframe du site', JSON.stringify(nSous));
    await ctx.close();
  });

  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} badge : ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ le banc est tombé :', e && e.message); process.exit(1); });
