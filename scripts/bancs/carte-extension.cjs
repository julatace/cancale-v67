// ════════════════════════════════════════════════════════════════════════
//  BANC « LA CARTE DU LOGO, TELLE QUE JULIEN L'A VUE » (5.379, 15 nov.)
//
//  Trois captures de Julien (iPhone, Orion, vinted.fr en sombre, compte de l'onglet) :
//   1. « Mes ventes » menait à « Page not found » ;
//   2. l'onglet Favoris n'affichait qu'une phrase (« Écris ton message une seule fois
//      dans VRM… »), AUCUNE liste ;
//   3. une case « — » au début de chaque vente ;
//   4. une carte grise, « Tout arrêter » en gros bouton gris tout en haut, des titres
//      coupés à une ligne (« Chaussures Running Asi… »).
//
//  Le banc assemble la VRAIE chaîne, de bout en bout, sur des données INVENTÉES :
//   · `api/_lib/favoris-carte.js` (`apercuCarte`, la règle du serveur) fabrique les
//     aperçus des favoris (pas de message écrit · prêt · cloche jamais lue) ;
//   · le VRAI `background.js` (scripts/_fond-vm.cjs) fabrique les listes de la carte
//     (`carteListes`, depuis une fausse base à état) et ses liens (`liensCartePour`) ;
//   · le VRAI `vrm-badge.js` les dessine dans une page vinted.fr (fausse `chrome`).
//  Il juge (data-*, adresses, mesures — jamais un libellé seul) :
//   L. chaque lien de la carte pointe vers une adresse ATTESTÉE (liste blanche tirée du
//      code : ce que l'app ou l'extension ouvre ou lit déjà) ; jamais `/my_orders/sold` ;
//      `/member/{id}` porte l'id du compte de l'onglet ; le seul lien vers VRM est
//      « Écris d'abord ton message », et seulement quand il manque ;
//   F. favoris lus ⇒ la LISTE est visible tout de suite (sans « Voir »), du plus récent
//      au plus ancien ; sans message ⇒ la liste ET « Écris d'abord ton message dans VRM »;
//      prêt ⇒ cases + « Envoyer le message (N) », seul bouton plein ; cloche jamais lue
//      ⇒ dit pourquoi (jamais une liste vide muette) ;
//   V. aucune case « — » (ni plaque vide) quand le N° n'est pas connu ; chaque vente
//      dont la conversation est connue s'ouvre sur Vinted (`/inbox/{n°}`) ;
//   T. un titre long passe sur DEUX lignes (pas coupé à une) ;
//   S. « Tout arrêter » vient APRÈS les listes, en touche (pas le premier geste) ;
//   A. « Tous les comptes » : l'autre compte flouté, `inert`, aucune commande ;
//   D. le fond de la carte est OPAQUE (plus de verre gris posé sur la page sombre).
//  390 px au doigt (page sombre, comme Orion chez lui) et 1512 px à la souris, clair et
//  sombre ; captures dans `captures/carte-extension` — à REGARDER.
//  Preuve (§6.1) : `BANC_RACINE=<arbre d'avant>` dessine l'ancien code (rouge attendu).
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ICI = path.join(__dirname, '..', '..');
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : ICI;
const EXT = path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
const LOGO = fs.readFileSync(path.join(ICI, 'vinted-sync-extension', 'logo-vrm-96.png'));
const { faireFond } = require(path.join(ICI, 'scripts', '_fond-vm.cjs'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'carte-extension') : path.join(__dirname, 'captures', 'carte-extension');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && (e.stack || e.message)).slice(0, 400)}`); return null; } };

const MIN = 60000, H = 3600000, J = 86400000, T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const UID = '111', NOM = 'shop_banc';
const ONGLET = { tab: { id: 7, url: 'https://www.vinted.fr/catalog' } };

// ── Les adresses ATTESTÉES (tirées du code : l'app et l'extension les ouvrent ou les lisent déjà).
//    Vinted : /inbox (src/App.jsx, conversations), /inbox/{n°} (ventes, App.jsx), /member/{id}
//    (src/ecrans/Reglages.jsx « Ouvrir »), /items/{id} (annonces). VRM : l'écran Messages → Favoris
//    (`tab=messages&vue=favoris`, lu par App.jsx), seulement quand le message manque.
const ATTESTE_VINTED = [/^\/inbox$/, /^\/inbox\/[1-9]\d{0,19}$/, new RegExp('^/member/' + UID + '$'), /^\/items\/[1-9]\d{0,19}$/];
const ECRIRE = 'https://vrm.center/?tab=messages&vue=favoris';
const attestee = (href) => { try { const u = new URL(href); if (href === ECRIRE) return true; return u.origin === 'https://www.vinted.fr' && !u.search && !u.hash && ATTESTE_VINTED.some((re) => re.test(u.pathname)); } catch (_) { return false; } };

// ── Le monde inventé : six ventes SANS N° connu (aucune fiche), titres longs, n° de conversation.
const TITRES = ['Chaussures Running Asics Gel-Nimbus 25 bleu turquoise et vert fluo taille 42', 'Nike Air Max 1 Aquatone blanc et bleu 43', 'Autry Reelwind Low noir et blanc 41', 'Adidas Handball Spezial gomme marron 44', 'Autry Reelwind Low gris 40', 'New Balance 9060 Rain Cloud 42'];
function monde() {
  const ventes = TITRES.map((t, i) => ({ transaction_id: 91000000 + i, conversation_id: i === 5 ? null : 77000000 + i, title: t, price: { amount: String(36 + i * 9) + '.0' }, item_id: 600000 + i, date: iso(T0 - (4 + i) * J),
    status: i < 2 ? 'Le paiement a été validé. Envoie le colis avant le 20/11/2026' : 'Colis en route', transaction_user_status: i < 2 ? 'needs_action' : 'waiting', status_title: 'Commande' }));
  const items = Array.from({ length: 5 }, (_, i) => ({ id: 700000 + i, title: TITRES[i], price: { amount: String(50 + i) }, created_at_ts: Math.floor((T0 - (i + 1) * J) / 1000), favourite_count: i, is_closed: false, is_hidden: false, is_reserved: false, is_draft: false, can_edit: true }));
  const lignes = {
    main: { vinted_annonce_numeros: { 700000: { numero: '124', accountId: UID } }, vinted_buyprice_by_num: {} },
    vinted_listing_dates: {},
    [`harvest_${UID}_listings`]: { type: 'listings', capturedAt: iso(T0 - 20 * MIN), nItems: 5, payload: { items } },
    [`harvest_${UID}_orders_sold`]: { type: 'orders_sold', capturedAt: iso(T0 - MIN / 2), nItems: 2011, payload: { my_orders: ventes } },
    harvest_222_listings: { type: 'listings', capturedAt: iso(T0 - H / 2), nItems: 3, payload: { items: items.slice(0, 3).map((x) => Object.assign({}, x, { id: x.id + 1000 })) } },
    harvest_222_orders_sold: { type: 'orders_sold', capturedAt: iso(T0 - MIN), nItems: 3, payload: { my_orders: ventes.slice(0, 3).map((x) => Object.assign({}, x, { transaction_id: x.transaction_id + 500 })) } },
  };
  const f = faireFond({ src: path.join(EXT, 'background.js'), connecte: UID, lignes, comptes: [{ vinted_user_id: UID, login: NOM, domain: 'www.vinted.fr' }, { vinted_user_id: '222', login: 'julien_kicks', domain: 'www.vinted.fr' }] });
  f.ctx.compteConnecte = async () => UID;
  f.ctx.retourSurVinted = async () => ({ ok: true });
  return f;
}

// ── Les favoris (notifications Vinted, forme réelle), dans le DÉSORDRE.
const NOTIFS = Array.from({ length: 12 }, (_, i) => ({ id: 'n' + i, user_id: 900 + i, body: `acheteur_${i} a ajouté ton article à ses favoris.`, link: `/items/${700000 + (i % 5)}/conversation/new?from_notification=true`, created_at: iso(T0 - (((i * 5) % 12) + 1) * 37 * MIN) }));
const ITEMS_F = Array.from({ length: 5 }, (_, i) => ({ id: 700000 + i, title: TITRES[i], price: { amount: String(50 + i) + '.0', currency_code: 'EUR' } }));
const PREFS = { version: 1, message: 'Bonjour {pseudo}, je te fais une offre sur {article} !', pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null, envoisActifs: false };

async function apercus() {
  const m = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-carte.js')).href);
  const capture = { payload: { notifications: NOTIFS }, domain: 'www.vinted.fr' };
  const dressing = { cap: iso(T0 - H / 2), pg: { total_entries: 5 }, items: ITEMS_F };
  return {
    sansMessage: m.apercuCarte({ prefs: null, capture, dressing, prouve: () => true }),
    pret: m.apercuCarte({ prefs: PREFS, capture, dressing, prouve: () => true }),
    jamaisLue: m.apercuCarte({ prefs: null }),
  };
}

async function ouvrir(nav, { etat, listes, apercu, scheme = 'light', largeur = 1512, hauteur = 900, mobile = false }) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  // La page de Vinted chez lui était SOMBRE (Orion) : le banc la sert sombre au téléphone.
  const fondPage = mobile ? '#15171a' : '#ffffff', textePage = mobile ? '#e8e8e8' : '#222';
  await pg.route('**/*', (r) => {
    if (/logo-vrm-96\.png/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:${fondPage};color:${textePage};font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #444;padding:20px">Une page Vinted</header><main style="padding:20px;height:2000px">Annonces…</main></body></html>` });
  });
  await pg.goto('https://www.vinted.fr/catalog');
  await pg.evaluate(({ e, js, ap, L0, L1 }) => {
    window.__envoyes = [];
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    let stock = {};
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, cb) => {
          window.__envoyes.push(copie(msg));
          let rep = { ok: true };
          if (msg.action === 'etat') rep = copie(e);
          else if (msg.action === 'carteListes') rep = copie(msg.tous ? L1 : L0);
          else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
          else if (msg.action === 'favorisCarte' && msg.quoi === 'apercu') rep = { ok: true, uid: e.site.id, apercu: copie(ap) };
          else if (msg.action === 'favorisCarte' && msg.quoi === 'lancer') rep = msg.confirme === true ? { ok: true } : { ok: false };
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb(copie(stock)), 0); return Promise.resolve(copie(stock)); }, set: (o, cb) => { stock = Object.assign(stock, o); if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: etat, js: BADGE, ap: apercu, L0: listes.ce, L1: listes.tous });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(400);
};
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(300); };
const lire = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const carte = q('.carte');
  const ctl = Array.from(r.querySelectorAll('.carte button, .carte a[href], .carte input')).filter(vis);
  const autre = q('[data-autre]');
  const ordre = (a, b) => { const x = q(a), y = q(b); return x && y ? !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING) : null; };
  // Le titre d'une rangée : combien de lignes il occupe, et s'il est coupé.
  const titres = Array.from(r.querySelectorAll('.rangs .ti, .ap-liste .quoi')).filter(vis).map((t) => { const lh = parseFloat(getComputedStyle(t).lineHeight) || 18; return { t: t.textContent, lignes: Math.round(t.clientHeight / lh), coupe: t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1 }; });
  const fond = getComputedStyle(carte);
  return {
    onglet: q('[data-listes]') && q('[data-listes]').getAttribute('data-onglet'),
    liens: Array.from(r.querySelectorAll('.carte a[href]')).filter(vis).map((a) => a.href),
    fav: q('[data-fav]') && q('[data-fav]').getAttribute('data-fav'), favRaison: q('[data-fav]') && q('[data-fav]').getAttribute('data-fav-raison'),
    favTexte: q('[data-fav]') ? q('[data-fav]').innerText.replace(/\s+/g, ' ').trim() : '',
    favRangs: Array.from(r.querySelectorAll('[data-fav-qui]')).filter(vis).map((li) => ({ d: Date.parse(li.getAttribute('data-fav-date') || ''), h: li.offsetHeight })),
    ecrire: q('[data-fav-ecrire]') ? { href: q('[data-fav-ecrire]').href, target: q('[data-fav-ecrire]').target, t: q('[data-fav-ecrire]').innerText.trim() } : null,
    voir: !!q('[data-fav-voir]'),
    coches: Array.from(r.querySelectorAll('[data-fav-coche]')).filter((c) => c.checked).length,
    envoyer: q('[data-fav-lancer]') ? { t: q('[data-fav-lancer]').innerText.trim(), off: q('[data-fav-lancer]').disabled } : null,
    ventes: Array.from(r.querySelectorAll('[data-vente]')).map((x) => ({ tx: x.getAttribute('data-vente'), href: x.href || '', plaques: x.querySelectorAll('.plaque').length, tirets: Array.from(x.querySelectorAll('*')).filter((c) => !c.children.length && c.textContent.trim() === '—').length })),
    teteVentes: q('[data-ventes-total]') ? q('[data-ventes-total]').innerText.trim() : (q('.panneau .lu') ? q('.panneau .lu').innerText.trim() : ''),
    titres,
    secu: q('[data-secu]') ? { apresListes: ordre('[data-listes]', '[data-secu]'), touche: !!q('[data-secu-arret]').classList.contains('touche'), plein: q('[data-secu-arret]').classList.contains('b') && !q('[data-secu-arret]').classList.contains('sec') } : null,
    premierGeste: (ctl.find((b) => b.tagName === 'BUTTON' && !b.classList.contains('fermer')) || {}).innerText || '',
    autre: autre ? { inert: autre.inert === true, flou: getComputedStyle(autre.querySelector('.flou')).filter, actifs: autre.querySelectorAll('button, a[href], input, [tabindex]').length } : null,
    pleins: ctl.filter((b) => b.classList.contains('b') && !b.classList.contains('sec')).length,
    petits: ctl.filter((b) => b.offsetHeight < 44 && !b.closest('.outils') && b.tagName !== 'INPUT').map((b) => (b.className || b.tagName) + ':' + b.offsetHeight),
    fond: { image: fond.backgroundImage, couleur: fond.backgroundColor, flou: fond.backdropFilter || fond.webkitBackdropFilter || 'none' },
    debord: document.documentElement.scrollWidth > window.innerWidth || (carte && carte.scrollWidth > carte.clientWidth + 1),
    envoyes: window.__envoyes.filter((m) => m.action !== 'etat' && m.action !== 'capteLot'),
  };
});

(async () => {
  const f = monde();
  const L0 = await f.envoyer({ from: 'vrm-badge', action: 'carteListes' }, ONGLET);
  const L1 = await f.envoyer({ from: 'vrm-badge', action: 'carteListes', tous: true }, ONGLET);
  const liens = typeof f.ctx.liensCartePour === 'function' ? f.ctx.liensCartePour('https://www.vinted.fr/catalog', 'vinted', { id: UID }) : [];
  const AP = await apercus();
  const etat = (apercu) => ({ ok: true, plateforme: 'vinted', capte: true, version: VERSION, code: VERSION, vrm: { ok: true, connecte: true, email: 'banc@exemple.fr', cloisonne: true },
    site: { id: UID, nom: NOM, choix: 'oui', jauge: { h: 0, maxH: 50, j: 0, maxJ: 200, complet: true }, favoris: { apercu: { at: T0 - MIN, etat: apercu.etat, total: Number(apercu.total) || 0, raison: apercu.raison || '' }, file: null } },
    flux: { okAt: T0 - MIN }, liens, capteCoupe: false, secu: { niveau: 'ok', texte: 'Calme · 0 gestes de VRM aujourd’hui', arrete: false },
    capture: { k: 'ok', n: 0, phrase: 'Bordereaux : tous récupérés', geste: '' } });
  console.log(`Monde : ${L0 && L0.ventes ? L0.ventes.liste.length : '?'} ventes, liens ${JSON.stringify(liens.map((l) => l.url))}`);

  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const [largeur, hauteur, mobile] of [[390, 844, true], [1512, 900, false]]) for (const scheme of ['light', 'dark']) {
      const T = `${largeur} ${scheme}`;
      console.log(`\n${T}`);
      // ── 1. Pas de message écrit pour ce compte (la capture de Julien).
      await essaie(T + ' sans message', async () => {
        const t = await ouvrir(nav, { etat: etat(AP.sansMessage), listes: { ce: L0, tous: L1 }, apercu: AP.sansMessage, scheme, largeur, hauteur, mobile });
        await montrer(t.pg, mobile);
        await clic(t.pg, '[data-onglet-b="favoris"]');
        await t.pg.waitForTimeout(250);
        let a = await lire(t.pg);
        await cap(t.pg, `favoris-sans-message-${largeur}-${scheme}`);
        const d = a.favRangs.map((x) => x.d);
        dit(a.onglet === 'favoris' && a.favRangs.length === 12 && d.every((x, i) => isFinite(x) && (i === 0 || d[i - 1] >= x)), `${T} : F sans message écrit, la LISTE des 12 favoris lus est là, du plus récent au plus ancien`, JSON.stringify({ o: a.onglet, n: a.favRangs.length, fav: a.fav, t: a.favTexte.slice(0, 160) }));
        dit(!!a.ecrire && a.ecrire.href === ECRIRE && a.ecrire.target === '_blank' && /Écris d’abord ton message dans VRM/.test(a.ecrire.t), `${T} : F le geste dit ce qui manque : « Écris d’abord ton message dans VRM › » (Messages → Favoris, nouvel onglet)`, JSON.stringify(a.ecrire));
        dit(!a.voir && a.pleins === 0, `${T} : F aucune étape « Voir », aucun bouton plein tant que rien ne peut partir`, JSON.stringify({ v: a.voir, p: a.pleins }));
        dit(a.liens.length > 0 && a.liens.every(attestee), `${T} : L chaque lien de la carte pointe vers une adresse attestée`, JSON.stringify(a.liens));
        dit(!a.liens.some((h) => /my_orders/.test(h)) && a.liens.includes('https://www.vinted.fr/member/' + UID) && a.liens.includes('https://www.vinted.fr/inbox'), `${T} : L plus de « Mes ventes » /my_orders/sold (404 chez Vinted) ; Messages /inbox et Mon dressing /member/${UID} (compte de l’onglet)`, JSON.stringify(a.liens));
        dit(a.secu && a.secu.apresListes === true && a.secu.touche && !a.secu.plein && !/Tout arrêter/.test(a.premierGeste), `${T} : S « Tout arrêter » APRÈS les listes, en touche, jamais le premier geste`, JSON.stringify({ s: a.secu, p: a.premierGeste }));
        dit(/gradient/.test(a.fond.image) && a.fond.flou === 'none', `${T} : D fond de carte opaque (dégradé studio), plus de verre posé sur la page`, JSON.stringify(a.fond));
        dit(a.petits.length === 0 && !a.debord && t.erreurs.length === 0, `${T} : cibles ≥ 44 px, rien ne déborde, aucune erreur de page`, JSON.stringify({ p: a.petits, e: t.erreurs }));
        // Le bas de la carte (liens du site, sécurité du compte, détails) : à regarder.
        await t.pg.evaluate(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('.carte'); c.scrollTop = c.scrollHeight; });
        await t.pg.waitForTimeout(150);
        await cap(t.pg, `bas-${largeur}-${scheme}`);
        await t.pg.evaluate(() => { document.getElementById('vrm-badge').shadowRoot.querySelector('.carte').scrollTop = 0; });
        // ── Ventes (même carte).
        await clic(t.pg, '[data-onglet-b="ventes"]');
        a = await lire(t.pg);
        await cap(t.pg, `ventes-${largeur}-${scheme}`);
        dit(a.ventes.length === 6 && a.ventes.every((v) => v.plaques === 0 && v.tirets === 0), `${T} : V aucune case « — » ni plaque vide au début des ventes (N° pas connu)`, JSON.stringify(a.ventes));
        const avecConv = a.ventes.filter((v) => v.href);
        dit(avecConv.length === 5 && avecConv.every((v) => attestee(v.href) && /\/inbox\/77\d{6}$/.test(v.href)) && a.ventes.some((v) => !v.href), `${T} : V chaque vente à conversation connue s’ouvre sur Vinted (/inbox/{n°}) ; sans n°, pas de lien`, JSON.stringify(a.ventes.map((v) => v.href)));
        dit(/^2\s?011 ventes · lues (à l'instant|il y a \d+ min)$/.test(a.teteVentes.replace(/ | /g, ' ')), `${T} : V « 2 011 ventes · lues à l’instant »`, a.teteVentes);
        const long = a.titres.find((x) => /Gel-Nimbus/.test(x.t));
        dit(!!long && long.lignes >= 2, `${T} : T un titre long passe sur deux lignes (pas coupé à une)`, JSON.stringify(long));
        dit(a.liens.every(attestee), `${T} : L onglet Ventes : tous les liens attestés`, JSON.stringify(a.liens.filter((h) => !attestee(h))));
        // ── Tous les comptes.
        await clic(t.pg, '[data-portee-b="tous"]');
        await t.pg.waitForTimeout(200);
        a = await lire(t.pg);
        await cap(t.pg, `tous-${largeur}-${scheme}`);
        dit(a.autre && a.autre.inert && /blur/.test(a.autre.flou) && a.autre.actifs === 0, `${T} : A l’autre compte flouté, inert, aucune commande`, JSON.stringify(a.autre));
        await t.ctx.close();
      });
      // ── 2. Prêt : la liste à cocher, tout de suite.
      await essaie(T + ' prêt', async () => {
        const t = await ouvrir(nav, { etat: etat(AP.pret), listes: { ce: L0, tous: L1 }, apercu: AP.pret, scheme, largeur, hauteur, mobile });
        await montrer(t.pg, mobile);
        await clic(t.pg, '[data-portee-b="ce"]');
        await clic(t.pg, '[data-onglet-b="favoris"]');
        await t.pg.waitForTimeout(250);
        const a = await lire(t.pg);
        await cap(t.pg, `favoris-pret-${largeur}-${scheme}`);
        const d = a.favRangs.map((x) => x.d);
        dit(a.fav === 'pret' && a.favRangs.length > 1 && d.every((x, i) => i === 0 || d[i - 1] >= x) && !a.voir, `${T} : F prêt : les favoris cochables tout de suite (sans « Voir »), du plus récent au plus ancien`, JSON.stringify({ f: a.fav, n: a.favRangs.length, v: a.voir }));
        dit(a.envoyer && /^Envoyer le message \(\d+\)$/.test(a.envoyer.t) && a.coches === a.favRangs.length && a.pleins === 1 && !a.ecrire, `${T} : F « Envoyer le message (N) », seul bouton plein ; aucun lien vers VRM`, JSON.stringify({ e: a.envoyer, c: a.coches, p: a.pleins, w: a.ecrire }));
        dit(!a.envoyes.some((m) => m.quoi === 'lancer'), `${T} : rien n’est envoyé sans son clic`, JSON.stringify(a.envoyes));
        await t.ctx.close();
      });
      // ── 3. Cloche jamais lue : « pas su » ⇒ dit pourquoi.
      await essaie(T + ' jamais lue', async () => {
        const t = await ouvrir(nav, { etat: etat(AP.jamaisLue), listes: { ce: L0, tous: L1 }, apercu: AP.jamaisLue, scheme, largeur, hauteur, mobile });
        await montrer(t.pg, mobile);
        await clic(t.pg, '[data-portee-b="ce"]');
        await clic(t.pg, '[data-onglet-b="favoris"]');
        await t.pg.waitForTimeout(250);
        const a = await lire(t.pg);
        await cap(t.pg, `favoris-pas-su-${largeur}-${scheme}`);
        dit(a.favRangs.length === 0 && /cloche Vinted/.test(a.favTexte) && !!a.ecrire, `${T} : F favoris jamais lus ⇒ « Ouvre une fois ta cloche Vinted… » + le message à écrire (jamais une liste vide muette)`, a.favTexte);
        await t.ctx.close();
      });
    }
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ carte-extension : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ carte-extension : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
