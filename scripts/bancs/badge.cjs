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
  refuse403: { ok: true, plateforme: 'leboncoin', capte: true, version: '5.189.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, site: { id: '9', nom: 'Sophie B.', type: 'particulier' }, flux: { okAt: Date.now() - 60 * MIN, koAt: Date.now() - 2 * MIN, koStatut: '403' }, bascule: null },
  refuse503: { ok: true, plateforme: 'leboncoin', capte: true, version: '5.189.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, site: { id: '9', nom: 'Sophie B.', type: 'particulier' }, flux: { okAt: Date.now() - 60 * MIN, koAt: Date.now() - 2 * MIN, koStatut: '503' }, bascule: null },
  vestiaire: { ok: true, plateforme: 'vestiaire', capte: false, mesure: true, version: '5.154.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, site: null, flux: { okAt: Date.now() - 120000 }, bascule: null },
  bascule: { ok: true, plateforme: 'vinted', capte: true, version: '5.130.0', vrm: { ok: true, connecte: true, email: 'autre@exemple.fr', cloisonne: true }, site: { id: '111', nom: 'angeled92' }, flux: { okAt: Date.now() - MIN }, bascule: { de: 'sophie@exemple.fr', vers: 'autre@exemple.fr', at: Date.now() - 30 * MIN } },
};

async function rendre(nav, etat, { url = 'https://www.vinted.fr/items/1', deuxFois = false, dansIframe = false, scheme = 'dark', mobile = null } = {}) {
  // `mobile` (19 oct.) : un téléphone AU DOIGT — `isMobile + hasTouch` fait
  // déclarer `hover: none` et les touchers arrivent en `pointerType: touch`.
  const ctx = await nav.newContext(mobile
    ? Object.assign({ colorScheme: scheme, viewport: { width: mobile.largeur || 390, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, mobile.ua ? { userAgent: mobile.ua } : {})
    : { colorScheme: scheme, viewport: { width: 1512, height: 900 } });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  await pg.route('**/*', (r) => {
    const u = metaVersData(r.request().url());
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    if (/popup\.html/.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body style="background:#07090D;color:#fff">connexion</body>' });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><h1 style="padding:20px">Une page du site</h1><iframe id="sous" src="/sous" style="width:300px;height:120px"></iframe></body></html>' });
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
          // 5.191 : le choix est rangé par le service worker — l'état suivant le porte.
          if (msg.action === 'choixCompte' && e && e.site) e.site.choix = msg.choix;
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
    choix: window.__envoyes.filter((m) => m.action === 'choixCompte').map((m) => m.uid + ':' + m.choix),
    question: r.querySelector('.question') && getComputedStyle(r.querySelector('.question')).display !== 'none' ? r.querySelector('.question').innerText : '',
    questionLogin: (r.querySelector('[data-question-login]') || { getAttribute: () => null }).getAttribute('data-question-login'),
    // Les boutons de la question : la forme unique (§7), et ≥ 44 px au doigt.
    fondQ: r.querySelector('.question') ? getComputedStyle(r.querySelector('.question')).backgroundColor : '',
    accentQ: r.querySelector('.question [data-choix="oui"]') ? getComputedStyle(r.querySelector('.question [data-choix="oui"]')).backgroundColor : '',
    hauteursQ: Array.from(r.querySelectorAll('.question button')).map((b) => Math.round(b.getBoundingClientRect().height)),
    // Le mot de passe ne doit JAMAIS être un champ de la page.
    champsPage: Array.from(document.querySelectorAll('input')).length + Array.from(r.querySelectorAll('input')).length,
    // Rien de l'ancien bouton orange.
    orange: /#D2401E|rgb\(210, 64, 30\)/i.test(document.documentElement.outerHTML + r.innerHTML),
  };
});

const survoler = async (pg) => { await pg.mouse.move(1512 - 16 - 22, 900 - 16 - 22); await pg.waitForTimeout(200); };
const cliquer = async (pg) => { await pg.mouse.click(1512 - 16 - 22, 900 - 16 - 22); await pg.waitForTimeout(200); };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
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

  // ── 4bis. LE REFUS DIT POURQUOI (5.189) ──────────────────────────────────
  // Julien, 18 octobre : « Dernier envoi refusé … ça réessaie tout seul » alors
  // que la base refusait DURABLEMENT (403 de la barrière d'abonnement RLS). Un
  // 4xx ne repart pas tout seul : la carte doit dire le GESTE, pas une fausse
  // promesse de nouvel essai (le défaut le plus coûteux du projet).
  console.log('\n── Le refus DIT pourquoi (code HTTP)');
  await essaie('refusé 403 — accès coupé', async () => {
    const { ctx, pg } = await rendre(nav, ETATS.refuse403, { url: 'https://www.leboncoin.fr/mes-annonces' });
    await survoler(pg);
    const l = await lire(pg);
    dit(/abonnement|compte principal/i.test(l.carte), 'un 403 dit le vrai geste (abonnement / compte principal)', l.carte.replace(/\n/g, ' · ').slice(0, 240));
    dit(!/ça réessaie tout seul/i.test(l.carte), 'et NE promet PLUS « ça réessaie tout seul » (un 403 ne repart pas seul)', l.carte.replace(/\n/g, ' · ').slice(0, 240));
    await ctx.close();
  });
  await essaie('refusé 503 — vrai hoquet', async () => {
    const { ctx, pg } = await rendre(nav, ETATS.refuse503, { url: 'https://www.leboncoin.fr/mes-annonces' });
    await survoler(pg);
    const l = await lire(pg);
    dit(/ça réessaie tout seul/i.test(l.carte), 'autre sens : un 5xx (la base ne répond pas) garde bien « ça réessaie tout seul »', l.carte.replace(/\n/g, ' · ').slice(0, 240));
    dit(!/abonnement/i.test(l.carte), 'et ne parle pas d’abonnement sur un simple hoquet');
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

  // ── 9. CONFIRMER LE BON COMPTE VINTED (5.191, 19 octobre) ────────────────
  // Julien : « à l'installation de l'extension, confirmer le bon compte
  // Vinted ». UNE question, avec le login lu (jamais deviné) ; « Non » coupe la
  // capture de CE compte (section 10, vrai background.js) ; « Oui » ne
  // redemande plus ; login inconnu ⇒ aucune question.
  console.log('\n── Confirmer le bon compte Vinted');
  const AC = (site, autre) => Object.assign({}, ETATS.connecte, { site: Object.assign({ id: '111', nom: 'angeled92', choix: null }, site) }, autre || {});
  await essaie('question posée', async () => {
    const { ctx, pg, erreurs } = await rendre(nav, AC());
    let l = await lire(pg);
    dit(!erreurs.length, 'aucune erreur', erreurs[0]);
    dit(/angeled92/.test(l.question) && l.questionLogin === 'angeled92', 'la question apparaît d’elle-même, avec le BON login', l.question.replace(/\n/g, ' · ').slice(0, 200));
    dit(/Oui, capter ce compte/.test(l.question) && /Non, ignorer ce compte/.test(l.question), 'deux réponses : « Oui, capter ce compte » / « Non, ignorer ce compte »');
    dit(l.hauteursQ.length >= 2 && l.hauteursQ.every((h) => h >= 44), 'chaque bouton fait au moins 44 px', JSON.stringify(l.hauteursQ));
    dit(!l.point, 'pas de pastille ambre : une question n’est pas une panne');
    await pg.screenshot({ path: path.join(SORTIE, 'badge-question.png') });
    // « Non »
    await pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-choix="non"]').click());
    await pg.waitForTimeout(150);
    l = await lire(pg);
    dit(l.choix.join(',') === '111:non', 'le clic « Non » envoie le choix pour CE compte (uid du cookie)', JSON.stringify(l.choix));
    dit(!l.question, 'et la question disparaît', l.question.slice(0, 80));
    await survoler(pg);
    l = await lire(pg);
    dit(/ignoré/i.test(l.carte) && /Capter ce compte/.test(l.carte), 'au survol : « ignoré (ton choix) » et le moyen de revenir dessus', l.carte.replace(/\n/g, ' · ').slice(0, 240));
    dit(!/Envoyées à VRM/.test(l.carte) && !l.point, 'ni « envoyées », ni pastille : un CHOIX n’est pas une panne', l.carte.replace(/\n/g, ' · ').slice(0, 200));
    await pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-capter]').click());
    await pg.waitForTimeout(150);
    l = await lire(pg);
    dit(l.choix.join(',') === '111:non,111:oui', '« Capter ce compte » le rallume (choix « oui » envoyé)', JSON.stringify(l.choix));
    await ctx.close();
  });
  await essaie('oui ne redemande plus', async () => {
    const { ctx, pg } = await rendre(nav, AC());
    await pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-choix="oui"]').click());
    await pg.waitForTimeout(150);
    let l = await lire(pg);
    dit(l.choix.join(',') === '111:oui' && !l.question, '« Oui » : le choix part, la question se ferme', JSON.stringify(l.choix));
    await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await survoler(pg);
    l = await lire(pg);
    dit(!l.question && /angeled92/.test(l.carte) && !/ignoré/i.test(l.carte), 'et ne revient pas (état relu : déjà confirmé)', JSON.stringify({ q: l.question.slice(0, 60) }));
    await ctx.close();
    const d = await rendre(nav, AC({ choix: 'oui' }));
    const l2 = await lire(d.pg);
    dit(!l2.question, 'un compte déjà confirmé : aucune question');
    await d.ctx.close();
  });
  await essaie('graphisme', async () => {
    for (const [scheme, fond, accent] of [['dark', 'rgb(16, 20, 27)', 'rgb(61, 123, 255)'], ['light', 'rgb(255, 255, 255)', 'rgb(36, 88, 230)']]) {
      const { ctx, pg } = await rendre(nav, AC(), { scheme });
      const l = await lire(pg);
      dit(l.fondQ === fond && l.accentQ === accent, `${scheme} : la carte suit le système (VRM Noir, un seul bleu)`, JSON.stringify({ fond: l.fondQ, accent: l.accentQ }));
      if (scheme === 'light') await pg.screenshot({ path: path.join(SORTIE, 'badge-question-clair.png') });
      await ctx.close();
    }
  });
  await essaie('login inconnu', async () => {
    const { ctx, pg } = await rendre(nav, AC({ nom: '' }));
    const l = await lire(pg);
    dit(!l.question, 'login inconnu (on ne sait que « compte n° 111 ») : on ne demande PAS', l.question.slice(0, 80));
    await ctx.close();
    const lbc = await rendre(nav, Object.assign({}, ETATS.refuse503, { site: { id: '9', nom: 'Sophie B.' } }), { url: 'https://www.leboncoin.fr/' });
    const l2 = await lire(lbc.pg);
    dit(!l2.question, 'ailleurs que sur Vinted : aucune question');
    await lbc.ctx.close();
    const deco = await rendre(nav, Object.assign({}, ETATS.deconnecte, { site: { id: '111', nom: 'angeled92', choix: null } }));
    const l3 = await lire(deco.pg);
    dit(!l3.question, 'pas connecté à VRM : la connexion d’abord, pas la question');
    await deco.ctx.close();
  });

  // ── 9 bis. AU DOIGT (19 octobre, « l'extension pour iPhone et Samsung ») ─
  // Sur Firefox pour Android et dans Orion il n'y a PAS de survol : la carte et
  // le « Capter ce compte » (le retour sur un « Non ») n'étaient joignables qu'à
  // la souris. Toucher le logo ouvre la carte, qui porte le geste du logo.
  console.log('\n── Au doigt, sur un téléphone');
  const UA_FX = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0';
  const UA_IP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const rect = (pg, sel) => pg.evaluate((sel) => {
    const r = document.getElementById('vrm-badge').shadowRoot;
    const el = sel === '.btn' ? r.querySelector('.btn') : r.querySelector(sel);
    if (!el || !el.offsetParent && getComputedStyle(el).position !== 'fixed' && el.getClientRects().length === 0) return null;
    const b = el.getBoundingClientRect();
    return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2, l: b.left, r: b.right, t: b.top, h: b.height, w: b.width } : null;
  }, sel);
  const toucher = async (pg, sel) => { const b = await rect(pg, sel); if (!b) return false; await pg.touchscreen.tap(b.x, b.y); await pg.waitForTimeout(250); return true; };
  for (const [nom, ua, largeur] of [['Firefox Android 360', UA_FX, 360], ['iPhone 412', UA_IP, 412]]) {
    await essaie(`doigt ${nom}`, async () => {
      const { ctx, pg, erreurs } = await rendre(nav, AC({ choix: 'oui' }), { mobile: { ua, largeur } });
      await toucher(pg, '.btn');
      let l = await lire(pg);
      dit(!erreurs.length, `${nom} : aucune erreur`, erreurs[0]);
      dit(l.carteVisible && /angeled92/.test(l.carte), `${nom} : toucher le logo OUVRE la carte d'état (pas de survol au doigt)`, l.carte.replace(/\n/g, ' · ').slice(0, 120));
      dit(!l.envoyes.includes('ouvrirVRM'), `${nom} : le premier toucher n'ouvre pas VRM à l'aveugle`, JSON.stringify(l.envoyes));
      const c = await rect(pg, '.carte');
      dit(c && c.l >= 0 && c.r <= largeur, `${nom} : la carte tient dans l'écran (${c && Math.round(c.l)}–${c && Math.round(c.r)} sur ${largeur})`, JSON.stringify(c));
      const o = await rect(pg, '[data-ouvrir-vrm]');
      const f = await rect(pg, '[data-fermer-carte]');
      dit(o && o.h >= 44 && f && f.h >= 44 && f.w >= 44, `${nom} : « Ouvrir VRM » et la croix ≥ 44 px`, JSON.stringify({ o: o && o.h, f: f && [f.w, f.h] }));
      await toucher(pg, '[data-ouvrir-vrm]');
      l = await lire(pg);
      dit(l.envoyes.includes('ouvrirVRM'), `${nom} : « Ouvrir VRM » fait ce que faisait le logo`, JSON.stringify(l.envoyes));
      // Toucher ailleurs referme.
      await toucher(pg, '.btn');
      l = await lire(pg);
      dit(l.carteVisible, `${nom} : retoucher le logo rouvre la carte`);
      await pg.touchscreen.tap(30, 120); await pg.waitForTimeout(200);
      l = await lire(pg);
      dit(!l.carteVisible, `${nom} : toucher ailleurs dans la page la referme`);
      const sw = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      dit(sw <= 1, `${nom} : aucun débordement horizontal`, String(sw));
      await ctx.close();
    });
  }
  await essaie('doigt question', async () => {
    const { ctx, pg } = await rendre(nav, AC(), { mobile: { ua: UA_FX, largeur: 360 } });
    let l = await lire(pg);
    dit(/angeled92/.test(l.question), 'au doigt : la question apparaît d’elle-même');
    const q = await rect(pg, '.question');
    dit(q && q.l >= 0 && q.r <= 360, 'au doigt : la question tient dans 360 px', JSON.stringify(q));
    await toucher(pg, '[data-choix="non"]');
    l = await lire(pg);
    dit(l.choix.join(',') === '111:non' && !l.question, 'toucher « Non » : le choix part, la question se ferme', JSON.stringify(l.choix));
    await toucher(pg, '.btn');
    l = await lire(pg);
    dit(l.carteVisible && /ignoré/i.test(l.carte), 'puis toucher le logo : la carte dit « ignoré (ton choix) » — on peut REVENIR sur le « Non »', l.carte.replace(/\n/g, ' · ').slice(0, 160));
    const cap = await rect(pg, '[data-capter]');
    dit(cap && cap.h >= 44, '« Capter ce compte » ≥ 44 px au doigt', JSON.stringify(cap));
    await toucher(pg, '[data-capter]');
    l = await lire(pg);
    dit(l.choix.join(',') === '111:non,111:oui', 'toucher « Capter ce compte » le rallume', JSON.stringify(l.choix));
    dit(!/passant la souris sur le logo\)/.test(l.question + l.carte), 'plus aucune consigne « passe la souris » seule');
    await ctx.close();
  });
  await essaie('souris inchangée', async () => {
    const { ctx, pg } = await rendre(nav, AC({ choix: 'oui' }));
    await cliquer(pg);
    const l = await lire(pg);
    dit(l.envoyes.includes('ouvrirVRM'), 'à la souris rien ne change : un clic sur le logo ouvre VRM', JSON.stringify(l.envoyes));
    await ctx.close();
  });

  // ── 10. LE VRAI background.js : « Non » COUPE LA CAPTURE DE CE COMPTE ────
  console.log('\n── Le vrai background.js : ce qu’un « Non » coupe');
  await essaie('fond', async () => {
    const { faireFond } = require(path.join(__dirname, '..', '_fond-vm.cjs'));
    const SRC_FOND = process.env.BANC_FOND_SRC || path.join(EXT, 'background.js');
    const profil = JSON.stringify({ user: { id: 9, login: 'angeled92' } });
    const tour = async (store) => {
      // Compte lié SANS login en base (premier passage) : seul users/current le nomme.
      const f = faireFond({ src: SRC_FOND, store, comptes: [{ vinted_user_id: '111', login: '', domain: 'www.vinted.fr', access_token: 'jeton' }] });
      try { await f.ctx.storeHarvest('www.vinted.fr', 'profile', 'x', profil); } catch (_) {}
      try { await f.ctx.storeHarvestRow('111', 'orders_sold', { my_orders: [{ transaction_id: 1, title: 'a', price: { amount: '10' } }] }, 'www.vinted.fr'); } catch (_) {}
      await new Promise((r) => setTimeout(r, 40));
      return { f, ecrits: [].concat(...f.j.posts).filter((id) => /^harvest_111_/.test(String(id))) };
    };
    const non = await tour({ vrmChoixComptes: { 111: { choix: 'non', login: 'angeled92', at: 1 } } });
    dit(non.ecrits.length === 0, '« Non » : AUCUNE écriture harvest_111_* ne part', JSON.stringify(non.ecrits));
    const oui = await tour({ vrmChoixComptes: { 111: { choix: 'oui', login: 'angeled92', at: 1 } } });
    dit(oui.ecrits.includes('harvest_111_orders_sold'), 'autre sens : « Oui » capte (les ventes partent)', JSON.stringify(oui.ecrits));
    const rien = await tour({});
    dit(rien.ecrits.includes('harvest_111_orders_sold'), 'pas encore répondu : la capture continue COMME AVANT', JSON.stringify(rien.ecrits));
    const lv = rien.f.store.vrmLoginsVus || {};
    dit(lv['111'] && lv['111'].login === 'angeled92', 'le login lu dans users/current est retenu (pour NOMMER le compte)', JSON.stringify(lv));
    // L'état de la carte porte le login et le choix ; le message ne vaut que pour le compte du cookie.
    const f = rien.f;
    const vinted = { tab: { url: 'https://www.vinted.fr/items/1' } };
    const e1 = await f.envoyer({ from: 'vrm-badge', action: 'etat' }, vinted);
    dit(e1 && e1.site && e1.site.nom === 'angeled92' && e1.site.choix === null, 'l’état de la carte nomme le compte et dit « jamais répondu »', JSON.stringify(e1 && e1.site));
    const autre = await f.envoyer({ from: 'vrm-badge', action: 'choixCompte', uid: '222', choix: 'non' }, vinted);
    dit(autre && autre.ok === false && !((f.store.vrmChoixComptes || {})['222']), 'un AUTRE compte que celui du cookie : refusé, rien de noté', JSON.stringify(autre));
    const r = await f.envoyer({ from: 'vrm-badge', action: 'choixCompte', uid: '111', choix: 'non' }, vinted);
    dit(r && r.ok && f.store.vrmChoixComptes['111'].choix === 'non', 'le choix du compte du cookie est rangé (chrome.storage.local)', JSON.stringify(r));
    const e2 = await f.envoyer({ from: 'vrm-badge', action: 'etat' }, vinted);
    dit(e2 && e2.site && e2.site.choix === 'non', 'et l’état suivant le porte', JSON.stringify(e2 && e2.site));
    f.j.posts.length = 0;
    try { await f.ctx.storeHarvestRow('111', 'listings', { items: [{ id: 5, title: 't', price: { amount: '9' } }] }, 'www.vinted.fr'); } catch (_) {}
    await new Promise((x) => setTimeout(x, 40));
    const apres = [].concat(...f.j.posts).filter((id) => /^harvest_111_/.test(String(id)));
    dit(apres.length === 0, 'et dès lors, plus rien n’est écrit pour lui', JSON.stringify(apres));
  });

  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} badge : ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ le banc est tombé :', e && e.message); process.exit(1); });
