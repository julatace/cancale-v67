// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA NOTIFICATION TOUCHÉE MET SON OBJET EN ÉVIDENCE (5 novembre)
//        (node scripts/bancs/cible-evidence.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (vocal du 5 nov.) : « cliquer une notification amène directement sur ce
// qui est arrivé, mis en évidence (le colis souligné), pour TOUTES les
// notifications de VRM » ; « quand un colis arrive, la notification doit ouvrir
// directement le colis, mis en évidence, avec son code ».
//
// Les adresses viennent de la VRAIE règle du serveur (`api/_lib/lien-notif.js`,
// EXÉCUTÉE ici). L'app est ouverte sur chacune (à froid, puis une fois à chaud
// par le message `open-url` du service worker), à 390 px tactile et 1512 px.
// On exige, pour chaque famille :
//   A. l'élément visé porte le crochet unique `data-cible` avec SON identité, et
//      c'est LUI qui est marqué (`data-cible-notif`) — jamais un voisin ;
//   B. il est dans la fenêtre (défilé dessus), son contour d'accent est posé, il
//      l'est encore à 3 s et plus à 6,5 s (« quelques secondes ») ;
//   C. colis arrivé : la ligne est OUVERTE et son CODE se lit ; une ville choisie
//      qui cachait le point est levée ; un colis replié dans « À vérifier » sort ;
//   D. offre : la conversation s'ouvre ET la carte de l'offre est mise en évidence ;
//   E. vente Vestiaire, rappel « colis à poster » (la liste), double vente (la
//      ligne de CE N°), URSSAF ;
//   F. une cible absente : l'écran reste, UNE ligne le dit ; aucune erreur ;
//   G. Paramètres → Notifications : trois groupes, un aperçu par famille dont
//      le lien « Toucher ouvre », et un interrupteur dont l'écriture est REFUSÉE
//      revient à sa place (jamais « coupé » à l'écran et allumé en base).
// Données INVENTÉES (le dépôt est public). BANC_PORT : un port libre.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 7961;
const SHOTS = process.env.SHOTS || os.tmpdir();
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const dans = (j) => new Date(M + j * 86400000).toISOString().slice(0, 10);
const AEXP = 'Le paiement a été validé';
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const v = (tx, titre, statut, tus, j, item) => ({ transaction_id: tx, title: titre, price: { amount: '50', currency_code: 'EUR' }, status: statut, ...(tus ? { transaction_user_status: tus } : {}), date: ilYa(j), ...(item ? { item_id: item } : {}) });
// Beaucoup de ventes : la cible est loin sous la ligne de flottaison (le défilement se mesure).
const VENTES = [
  ...Array.from({ length: 14 }, (_, i) => v(7200 + i, `Paire banc ${i + 1} taille 4${i % 6}`, 'Commande finalisée', 'completed', 3 + i, 'z' + i)),
  v(7001, 'Adidas Samba OG taille 41', AEXP, 'needs_action', 0.2, 'an1'),
  v(7002, 'Nike Air Max 90 taille 42', AEXP, 'needs_action', 0.4, 'an2'),
];
const ACHATS = [
  { transaction_id: 9401, conversation_id: 7801, title: 'Vans Old Skool taille 41', price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(3) },
];
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(M - h * 3600e3), description: desc, opposite_user: { id: 5000 + id, login } });
const fil = (id, login, tx, oid, prix) => ({ id, opposite_user: { id: 5000 + id, login }, transaction: { id: tx, item_id: 400 + id }, description: 'Paire ' + id, allow_reply: true,
  messages: [
    { entity_type: 'message', entity: { user_id: 5000 + id, body: 'Bonjour, vous feriez ' + prix + ' € ?' } },
    { entity_type: 'offer_request_message', entity: { user_id: 5000 + id, current: true, status: 10, status_title: '', price: { amount: prix + '.0' }, transaction_id: tx, offer_request_id: oid } },
  ] });
const CONVS = [conv(301, 'acheteuse_a', 'Vous feriez 45 € ?', true, 3), conv(303, 'curieux_a', 'Merci !', false, 26), ...Array.from({ length: 6 }, (_, i) => conv(310 + i, 'autre_' + i, 'Dispo ?', false, 30 + i))];
const NUMS = { an1: { numero: '117', title: VENTES[14].title, price: 50 }, an2: { numero: '42', title: VENTES[15].title, price: 50 }, 701: { numero: '5', title: 'Paire 301', price: 60, min: 40 } };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const SUIVI_RENNES = '1790000000000002', SUIVI_VANNES = '87654321';
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: NUMS, vinted_regime: 'micro', vinted_urssaf_taux: 12.4, vinted_urssaf_freq: 'mensuel' } },
  { id: 'panel_colis_relais', data: { 9401: { code: '418205', lieu: 'Locker Carrefour, 4 Rue de Paris, 35000 Rennes, France', at: iso(M), url: 'https://www.vinted.fr/inbox/7801' } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(M), payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_inbox', data: { capturedAt: iso(M), payload: { conversations: CONVS } } },
  { id: 'harvest_111_conv_301', data: { capturedAt: iso(M), payload: { conversation: fil(301, 'acheteuse_a', 9001, 77, 45) } } },
  { id: 'harvest_111_conv_303', data: { capturedAt: iso(M), payload: { conversation: { ...fil(303, 'curieux_a', 9003, 78, 30), messages: [{ entity_type: 'message', entity: { user_id: 5303, body: 'Merci !' } }] } } } },
  ...[7001, 7002].map((tx) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi: `TRK${tx}`, receivedAt: iso(M - 3 * 3600e3), pdfB64: 'JVBERi0xLjQK' } })),
  // Deux villes (Rennes, Vannes) : le sélecteur de ville existe, et peut cacher la cible.
  { id: `email_track_vinted_${SUIVI_RENNES}`, data: { type: 'suivi', carrier: 'vinted', suivi: SUIVI_RENNES, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(1), code: '3904112', lieu: 'Relais Pressing Mermoz, 14 Avenue Mermoz, 35000 Rennes', limite: dans(4) } },
  { id: `email_track_mondialrelay_${SUIVI_VANNES}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: SUIVI_VANNES, status: 'available', statusLabel: 'Disponible', subject: `Votre colis ${SUIVI_VANNES} est disponible`, receivedAt: ilYa(1), code: '482913', lieu: 'Phone Cash Banc, 17 Rue Inventée, 56000 Vannes', limite: dans(5) } },
  // Vestiaire : la vente rangée par l'extension, clé = productId (comme l'e-mail).
  { id: 'vc_ventes', data: { ventes: { 48213: { productId: '48213', ref: '48213', titre: 'Sac Longchamp Le Pliage', aExpedier: true, limite: iso(M + 3 * 86400000), date: ilYa(1) } } } },
  { id: 'vc_listings', data: { liens: {} } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x === 'object' ? JSON.stringify(x) : x);
  }
  return out;
};

async function preparer(b, vp, o = {}) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecritures = [];
  await pg.addInitScript((ville) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (ville) localStorage.setItem('vrm_retirer_ville', ville); } catch (_) {} }, o.ville || '');
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"features":[]}' });
    if (/tiles\.openfreemap\.org/.test(u)) return r.abort();
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      const corps = route.request().postData() || '';
      ecritures.push(corps);
      // G. l'écriture du réglage de notification est REFUSÉE (500) quand on le demande.
      if (o.refuserPrefs && /push_prefs/.test(corps)) return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"refus du banc"}' });
      return j([]);
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(M), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecritures };
}

// L'élément marqué, mesuré.
const lire = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-cible-notif]');
  const puis = document.querySelector('[data-cible-notif-puis]');
  const abs = document.querySelector('[data-cible-absente]');
  const r = el ? el.getBoundingClientRect() : null;
  const H = window.innerHeight, W = window.innerWidth;
  return {
    type: el ? el.getAttribute('data-cible-notif') : null,
    jetons: el ? (el.getAttribute('data-cible') || '') : null,
    vu: !!(r && r.height > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W),
    eclaire: !!(el && el.hasAttribute('data-cible-eclaire')),
    ombre: el ? getComputedStyle(el).boxShadow : '',
    ouvert: el ? ((el.querySelector('[aria-expanded]') || el).getAttribute('aria-expanded') || el.getAttribute('data-ouvert') || '') : '',
    texte: el ? el.innerText.replace(/\s+/g, ' ').slice(0, 400) : '',
    puis: puis ? { type: puis.getAttribute('data-cible-notif-puis'), jetons: puis.getAttribute('data-cible') || '', eclaire: puis.hasAttribute('data-cible-eclaire') } : null,
    absente: abs ? abs.getAttribute('data-cible-absente') : null,
    absenteTxt: abs ? abs.innerText : '',
    ville: (document.querySelector('[data-retirer-villes] [aria-pressed="true"]') || { getAttribute: () => null }).getAttribute('data-ville'),
    fil: !!document.querySelector('button[aria-label="Fermer la conversation"]'),
    gardeFou: /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.test(document.body.innerText),
  };
});
const attendre = async (pg, f, ms = 20000) => { const t0 = Date.now(); let e; while (Date.now() - t0 < ms) { e = await lire(pg); if (f(e)) return e; await pg.waitForTimeout(150); } return e || lire(pg); };
const aJeton = (e, j) => !!(e && e.jetons != null && (' ' + e.jetons + ' ').includes(' ' + j + ' '));

(async () => {
  const { DESTINATIONS: D } = await import('file://' + path.join(RACINE, 'api', '_lib', 'lien-notif.js'));
  // Sur un arbre d'AVANT, les destinations neuves n'existent pas : on prend ce que le serveur d'avant envoyait.
  const offre = D.offre ? D.offre({ conv: '301', compte: '111' }) : D.message({ conv: '301', compte: '111' });
  const vcv = D.vcVente ? D.vcVente({ id: '48213' }) : '/?tab=plat_vestiaire';
  const CAS = [
    { nom: 'vente (Vendu !)', url: D.vente({ tx: '7001' }), jeton: 'vente:7001' },
    { nom: 'bordereau reçu → le colis dans Colis', url: D.colis({ tx: '7002' }), jeton: 'colis:7002' },
    { nom: 'rappel « colis à poster » → la liste À envoyer', url: D.colis({}), jeton: 'colonne:prets' },
    { nom: 'colis arrivé (e-mail Mondial Relay, n° de suivi) → la carte OUVERTE sur son code', url: D.retrait({ suivi: SUIVI_VANNES }), jeton: `retrait:suivi:${SUIVI_VANNES}`, code: '482913' },
    { nom: 'code de retrait (conversation, transaction)', url: D.retrait({ tx: '9401' }), jeton: 'retrait:tx:9401', code: '418205' },
    { nom: 'message → la conversation', url: D.message({ conv: '303', compte: '111' }), jeton: 'conv:111:303', fil: true },
    { nom: 'offre → la conversation ET la carte de l’offre', url: offre, jeton: 'conv:111:301', fil: true, puis: 'offre' },
    { nom: 'vente Vestiaire → la vente', url: vcv, jeton: 'vcvente:48213' },
    { nom: 'URSSAF → la déclaration', url: D.urssaf(), jeton: 'urssaf' },
  ];
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = `[${vp.width}]`;
      console.log(`── ${vp.width} px`);
      const { ctx, pg, errs } = await preparer(b, vp);
      for (const c of CAS) {
        await essaie(c.nom, async () => {
          await pg.goto(`http://localhost:${PORT}${c.url}`, { waitUntil: 'domcontentloaded' });
          const e = await attendre(pg, (x) => !!x.type || !!x.absente);
          const tVu = Date.now();
          dit(aJeton(e, c.jeton), `${T} ${c.nom} : l’élément marqué porte SON identité (data-cible « ${c.jeton} »)`, JSON.stringify({ type: e.type, jetons: e.jetons, abs: e.absente }));
          if (!e.type) return;
          await pg.waitForTimeout(700);
          let x = await lire(pg);
          dit(x.vu, `${T} ${c.nom} : défilé dessus (dans la fenêtre)`);
          dit(x.eclaire && x.ombre && x.ombre !== 'none', `${T} ${c.nom} : contour d’accent posé`, x.ombre.slice(0, 80));
          if (c.code) {
            x = await attendre(pg, (y) => y.texte.includes(c.code), 4000);
            dit(x.texte.includes(c.code) && x.ouvert === 'true', `${T} ${c.nom} : la ligne est OUVERTE et le code ${c.code} se lit`, JSON.stringify({ ouvert: x.ouvert, texte: x.texte.slice(0, 160) }));
            // Le code est À L'ÉCRAN (pas sous la barre du bas) une fois la ligne ouverte.
            await pg.waitForTimeout(1200);
            const ou = await pg.evaluate((code) => {
              const el = document.querySelector('[data-cible-notif]'); if (!el) return null;
              const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.nodeValue.includes(code) && n.parentElement && n.parentElement.getClientRects().length) { const r = n.parentElement.getBoundingClientRect(); const barre = document.querySelector('.vrm-tabbar'); const bas = barre && barre.getBoundingClientRect().top > 0 ? Math.min(window.innerHeight, barre.getBoundingClientRect().top) : window.innerHeight; return { top: Math.round(r.top), bottom: Math.round(r.bottom), bas: Math.round(bas) }; } }
              return null;
            }, c.code);
            dit(!!ou && ou.top >= 0 && ou.bottom <= ou.bas, `${T} ${c.nom} : le code ${c.code} est dans la fenêtre, au-dessus de la barre du bas`, JSON.stringify(ou));
          }
          if (c.fil) dit(x.fil, `${T} ${c.nom} : la conversation est ouverte`);
          if (c.puis) {
            const y = await attendre(pg, (z) => !!z.puis, 7000);
            dit(!!y.puis && aJeton(y.puis, c.puis) && y.puis.eclaire, `${T} ${c.nom} : la carte de l’offre est mise en évidence dans le fil`, JSON.stringify(y.puis));
          }
          await pg.waitForTimeout(Math.max(0, 3000 - (Date.now() - tVu)));
          x = await lire(pg);
          dit(x.eclaire, `${T} ${c.nom} : encore en évidence à 3 s`);
          if (c === CAS[0] || c.code) {
            await pg.waitForTimeout(Math.max(0, 6500 - (Date.now() - tVu)));
            x = await lire(pg);
            dit(!x.eclaire && x.type, `${T} ${c.nom} : redevenu neutre à 6,5 s (la marque reste)`);
          }
          if (/Mondial|Vestiaire|offre/.test(c.nom)) await pg.screenshot({ path: path.join(SHOTS, `cible-${vp.width}-${c.nom.slice(0, 12).replace(/\W/g, '')}.png`) });
          dit(!x.gardeFou, `${T} ${c.nom} : ni garde-fou ni écran en erreur`);
        });
      }
      // C bis. Une ville choisie (Rennes) cachait le point de Vannes : la notification la lève.
      await essaie('ville', async () => {
        await pg.goto(`http://localhost:${PORT}${D.retrait({})}`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-retirer-villes]').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
        const villes = await pg.evaluate(() => [...document.querySelectorAll('[data-retirer-villes] [data-ville]')].map((x) => x.getAttribute('data-ville')).filter(Boolean));
        const rennes = villes.find((x) => /rennes|35000/i.test(x)) || '';
        dit(villes.length >= 2 && !!rennes, `${T} deux villes au sélecteur (fixture)`, JSON.stringify(villes));
        const r2 = await preparer(b, vp, { ville: rennes });
        await r2.pg.goto(`http://localhost:${PORT}${D.retrait({ suivi: SUIVI_VANNES })}`, { waitUntil: 'domcontentloaded' });
        const e = await attendre(r2.pg, (x) => !!x.type || !!x.absente);
        dit(aJeton(e, `retrait:suivi:${SUIVI_VANNES}`) && e.ville === '', `${T} ville « Rennes » choisie avant : la notification de Vannes lève le filtre et trouve SA carte`, JSON.stringify({ jetons: e.jetons, ville: e.ville, abs: e.absente }));
        await r2.ctx.close();
      });
      // À CHAUD : l'app est ouverte, le service worker lui transmet l'adresse.
      await essaie('à chaud', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2500);
        await pg.evaluate((u) => { navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'open-url', url: u } })); }, D.retrait({ tx: '9401' }));
        const e = await attendre(pg, (x) => !!x.type || !!x.absente);
        dit(aJeton(e, 'retrait:tx:9401') && e.vu, `${T} à chaud (app ouverte) : le colis arrivé est mis en évidence`, JSON.stringify({ jetons: e.jetons, abs: e.absente }));
      });
      // F. Une cible qui n'existe plus.
      await essaie('absente', async () => {
        await pg.goto(`http://localhost:${PORT}${D.vente({ tx: '99999' })}`, { waitUntil: 'domcontentloaded' });
        const e = await attendre(pg, (x) => !!x.absente, 20000);
        dit(e.absente === 'vente' && !e.type && e.absenteTxt.split('\n').length <= 2 && e.absenteTxt.length < 220 && !e.gardeFou, `${T} vente qui n’est plus là : l’écran reste, UNE ligne le dit`, e.absenteTxt);
      });
      dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 200));
      await ctx.close();

      // G. Paramètres → Notifications.
      await essaie('réglages', async () => {
        const r = await preparer(b, vp, { refuserPrefs: true });
        await r.pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
        const sousPush = r.pg.locator('[data-sous-ouvrir="push"]').first();
        await sousPush.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        if (await sousPush.isVisible().catch(() => false)) await sousPush.click();
        const sum = r.pg.locator('summary', { hasText: 'Ce que tu reçois sur ton téléphone' }).first();
        await sum.waitFor({ state: 'visible', timeout: 10000 });
        await sum.scrollIntoViewIfNeeded(); await sum.click(); await r.pg.waitForTimeout(600);
        const g = await r.pg.evaluate(() => ({ groupes: [...document.querySelectorAll('[data-notif-groupe]')].map((x) => x.getAttribute('data-notif-groupe')), familles: [...document.querySelectorAll('[data-famille-notif]')].map((x) => x.getAttribute('data-famille-notif')) }));
        dit(g.groupes.length === 3 && g.familles.length >= 6, `${T} réglages : trois groupes, chaque famille rangée`, JSON.stringify(g));
        const bArr = r.pg.locator('[data-apercu-ouvrir="arrives"]');
        await bArr.click(); await r.pg.waitForTimeout(300);
        const ap = await r.pg.evaluate(() => { const a = document.querySelector('[data-apercu-famille="arrives"]'); return a ? { n: a.querySelectorAll('[data-apercu-notif]').length, txt: a.innerText.replace(/\s+/g, ' ') } : null; });
        dit(!!ap && ap.n >= 1 && /t'attend/.test(ap.txt) && /code \d/.test(ap.txt) && /Toucher ouvre : Colis · À retirer/.test(ap.txt), `${T} réglages : l’aperçu « Colis arrivés » montre la notification (texte réel) et où elle mène`, ap ? ap.txt.slice(0, 200) : 'absent');
        await r.pg.screenshot({ path: path.join(SHOTS, `cible-reglages-${vp.width}.png`), fullPage: false });
        // Un interrupteur dont l'écriture est refusée revient à sa place.
        const ligne = r.pg.locator('[data-famille-notif="messages"]');
        const avant = await ligne.getAttribute('data-on');
        await ligne.locator('button, [role="switch"]').first().click();
        await r.pg.waitForTimeout(1500);
        const apres = await ligne.getAttribute('data-on');
        dit(avant === '1' && apres === avant, `${T} réglages : écriture refusée ⇒ l’interrupteur revient à « ${avant === '1' ? 'activé' : 'coupé'} » (jamais un faux « coupé »)`, `${avant} → ${apres}`);
        dit(r.errs.length === 0, `${T} réglages : aucune erreur de page`, r.errs.join(' | ').slice(0, 200));
        await r.ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ mise en évidence des notifications : ${ko} rouge(s)` : '\n✅ mise en évidence des notifications : tout est vert');
  process.exit(ko ? 1 : 0);
})();
