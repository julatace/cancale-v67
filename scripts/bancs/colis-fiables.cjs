// ── BANC : LES COLIS À RETIRER, FIABLES (23 octobre)
// Julien : « Pareil nouveau colis Mondial Relay mais c'est pas mis à jour dans
// l'app… je veux que ça soit fiable, pour l'instant c'est catastrophique : il
// doit prendre en compte si une paire est repartie au vendeur et n'est plus
// disponible. »
// Formes MESURÉES sur sa base (lecture seule, 23 oct.), valeurs INVENTÉES :
//   · Mondial Relay « disponible » arrivé sur une adresse reliée à AUCUN compte
//     (`recuSur`, pas de `account`) : il doit apparaître, « compte non reconnu »
//     dit UNE fois — jamais écarté ;
//   · un point relais garde un colis 4 à 7 jours (Mondial Relay 5, Chronopost 4 à
//     7, Vinted Go 6) : une date limite ÉCRITE et passée ⇒ « à vérifier », même si
//     le colis est arrivé il y a 4 jours ; sans date limite, plus de 7 jours ⇒
//     « à vérifier » ; jamais « perdu », jamais compté « à retirer » ;
//   · un achat Vinted « déposé en point relais » lu il y a 9 jours (le compte n'a
//     pas été relu) ⇒ « à vérifier », la fraîcheur dite une fois avec le compte ;
//   · le transporteur ÉCRIT « retourné à l'expéditeur » ⇒ « reparti » ; la
//     commande liée par IDENTITÉ (n° de suivi) dit « non réclamée » ⇒ « reparti » ;
//   · une commande au MÊME TITRE (une autre paire) ne désigne jamais un colis (§5).
// Rendu à 390 px tactile clair, 390 px tactile sombre, 1512 px, horloge pilotée
// (23 oct. puis 27 oct. : la date limite du Mondial Relay passe).
// `BANC_DIST` : un autre build (preuve §6.1 et mutations).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 8139);

const NOW = Date.parse('2026-10-23T08:00:00Z');          // 10 h à Paris
const APRES = Date.parse('2026-10-27T08:00:00Z');        // la limite du 26/10 est passée
const iso = (ms) => new Date(ms).toISOString();
const j = (n) => iso(NOW - n * 86400000);
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const NON_RECL = "Commande non réclamée — retournée à l'expéditeur";

const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(NOW) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(NOW) },
];
const ACHATS_A = [
  // Au point relais, code lu dans la conversation : à retirer.
  { transaction_id: 9601, conversation_id: 7601, title: 'Asics Gel bleue taille 43', price: { amount: '45', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: j(5) },
  // Le colis de l'e-mail 30000005 : sa TRANSACTION (ligne `harvest_111_txn_9603`,
  // plus bas) porte ce n° de suivi — l'identité que l'app lit (`indexSuivisAchats`).
  // ⚠️ Le n° n'est PAS sur la commande : mesuré, `my_orders` n'en porte aucun.
  { transaction_id: 9603, conversation_id: 7603, title: 'New Balance 550 taille 40', price: { amount: '60', currency_code: 'EUR' }, status: NON_RECL, transaction_user_status: 'failed', date: j(20) },
  // Une AUTRE paire au même titre que l'article d'un e-mail : ne désigne rien.
  { transaction_id: 9604, conversation_id: 7604, title: 'Nike Air Max 90 taille 42', price: { amount: '50', currency_code: 'EUR' }, status: NON_RECL, transaction_user_status: 'failed', date: j(25) },
];
const ACHATS_B = [
  // « Déposé » lu il y a 9 jours : le compte n'a pas été relu depuis.
  { transaction_id: 9602, conversation_id: 7602, title: 'Salomon XT-6 noire taille 42', price: { amount: '90', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: j(14) },
];
const track = (id, o) => ({ id, data: { type: 'suivi', status: 'available', statusLabel: 'Arrivé au point de retrait', consigne: false, ...o } });
const ROWS = [
  { id: 'main', data: { vinted_account_emails: { '111': 'achats_a@banc.test' } } },
  { id: 'panel_colis_relais', data: { '9601': { code: 'C11111', lieu: 'Tabac du Port, 4 Quai Gambetta, 35260 Cancale', at: j(1), url: 'https://www.vinted.fr/inbox/7601' } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: j(0), payload: { my_orders: ACHATS_A } } },
  { id: 'harvest_222_orders_purchased', data: { capturedAt: j(9), payload: { my_orders: ACHATS_B } } },
  // La transaction de l'achat 9603, telle que l'extension la range (forme lue par
  // `indexSuivisAchats` : payload.transaction.shipment.tracking_code). Mesuré le
  // 23 oct. : AUCUNE transaction réelle ne porte encore de n° de suivi — c'est la
  // forme que le code attend, servie ici pour prouver la règle (Achats ET Ma journée).
  { id: 'harvest_111_txn_9603', data: { capturedAt: j(1), payload: { transaction: { id: 9603, shipment: { id: 1, status: 600, status_title: "Commande non réclamée - Retournée à l'expéditeur.rice", tracking_code: '30000005' } } } } },
  // 1. Mondial Relay, adresse de réception reliée à AUCUN compte. Limite 26/10.
  track('email_track_mondialrelay_30000001', { carrier: 'mondialrelay', suivi: '30000001', artTitle: 'Nike Air Max 90 taille 42', subject: 'Votre colis 30000001 est disponible 📦', receivedAt: iso(Date.parse('2026-10-21T11:33:00Z')), recuSur: ['inconnu@banc.test'], code: '123456', lieu: "TABA'TEST, 12 Rue Exemple, 56000 Vannes", limite: '2026-10-26' }),
  // 2. Chronopost sur compte_a, limite 29/10.
  track('email_track_chronopost_09440000000002', { carrier: 'chronopost', suivi: '09440000000002', subject: 'Votre colis VINTED est arrivé en relais Pickup', receivedAt: iso(Date.parse('2026-10-22T09:28:00Z')), recuSur: ['achats_a@banc.test'], code: '654321', lieu: 'TERRA TEST, 11 Rue Exemple, 56000 Vannes', limite: '2026-10-29' }),
  // 3. Chronopost arrivé il y a 4 jours, limite ÉCRITE hier : délai dépassé.
  track('email_track_chronopost_09440000000003', { carrier: 'chronopost', suivi: '09440000000003', subject: 'Votre colis VINTED est arrivé en relais Pickup', receivedAt: j(4), account: 'compte_a', code: '777777', lieu: 'PRESSE TEST, 3 Rue Exemple, 56000 Vannes', limite: '2026-10-22' }),
  // 4. Vinted Go sans date limite, arrivé il y a 11 jours : plus que la garde.
  track('email_track_vinted_1790000000000004', { carrier: 'vinted', suivi: '1790000000000004', subject: 'Ton colis est arrivé à la consigne', receivedAt: j(11), account: 'compte_a', code: 'A90067', lieu: 'Kusmi Test, 13 Rue Exemple, 56000 Vannes', limite: null }),
  // 5. Disponible, mais la commande (même n° de suivi) dit « non réclamée ».
  track('email_track_mondialrelay_30000005', { carrier: 'mondialrelay', suivi: '30000005', subject: 'Votre colis 30000005 est disponible 📦', receivedAt: j(2), account: 'compte_a', code: '555555', lieu: 'BAR TEST, 5 Rue Exemple, 56000 Vannes', limite: '2026-10-27' }),
  // 6. Le transporteur écrit le retour à l'expéditeur.
  track('email_track_mondialrelay_30000006', { carrier: 'mondialrelay', suivi: '30000006', status: 'retour', statusLabel: 'Reparti chez l’expéditeur', subject: "Votre colis 30000006 a été retourné à l'expéditeur", receivedAt: j(1), account: 'compte_a' }),
  // 7. « Disponible » rangé chez Mondial Relay, le retour arrivé d'un autre
  //    expéditeur (rangé sur une AUTRE ligne) : le même n° de suivi les relie.
  track('email_track_mondialrelay_30000007', { carrier: 'mondialrelay', suivi: '30000007', subject: 'Votre colis 30000007 est disponible 📦', receivedAt: j(3), account: 'compte_a', code: '888888', lieu: 'CAFE TEST, 7 Rue Exemple, 56000 Vannes', limite: '2026-10-25' }),
  track('email_track_vinted_30000007', { carrier: 'vinted', suivi: '30000007', status: 'retour', statusLabel: 'Reparti chez l’expéditeur', subject: "Votre colis 30000007 a été retourné à l'expéditeur", receivedAt: j(0.5), account: 'compte_a' }),
  // 8. LA FORME DE LA LIGNE RÉELLE DU MONDIAL RELAY DU 21 OCTOBRE (rangée avant le correctif) :
  //    lieu et date limite vides, le nom et l'adresse gardés dans `extraitLieu`
  //    avec le pied de l'e-mail. Le lieu doit être relu ; la date limite, elle,
  //    n'est pas dans ces lignes : « inconnue », jamais inventée.
  track('email_track_mondialrelay_30000008', { carrier: 'mondialrelay', suivi: '30000008', subject: 'Votre colis 30000008 est disponible 📦', receivedAt: j(2), arriveLe: j(2), account: '', code: '444444', lieu: null, limite: null,
    extraitLieu: "TABA'BANC | 9 Rue Exemple | 56000 Vannes | Avec 19 000 points de proximité partout en France, déposer ou récupérer vos colis à pied ou à vélo devient un jeu d’enfant | MONDIAL RELAY, 1 avenue de l’horizon, 59650 VILLENEUVE D’ASCQ" }),
  // 9. LA FORME RÉELLE DE « Information sur votre colis » (Chronopost, rangée
  //    « disponible » avec ce futur pour lieu, sans code ni QR) : pas arrivé.
  track('email_track_chronopost_XW000000009TS', { carrier: 'chronopost', suivi: 'XW000000009TS', subject: 'Information sur votre colis XW000000009TS', receivedAt: j(0.1), account: 'compte_a', code: null, lieu: 'les prochains jours dans votre Relais Pickup', limite: null }),
];

const SESSION = { access_token: 'session-colis-fiables', refresh_token: 'r', totp: [], expires_at: NOW + 30 * 86400000, user: { id: '11111111-1111-4111-8111-111111111111', email: 'colis@example.test', totp: [] } };
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
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = iso(NOW); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function preparer(b, vp, quand, sombre) {
  const mobile = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(mobile ? { isMobile: true, hasTouch: true } : {}), locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
  await ctx.clock.install({ time: new Date(quand) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([s, dark]) => { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vinted_dark', dark ? 'true' : 'false'); }, [SESSION, !!sombre]);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const rep = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return rep([]);
    if (/select=owner/.test(u)) return rep([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return rep(ACCOUNTS);
    if (/\/rest\/v1\/rpc\//.test(u)) return rep(null);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel) && !/^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(NOW), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return rep(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const ins = /id=in\.\(([^)]*)\)/.exec(u); if (ins) { const ids = ins[1].split(','); return rep(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return rep(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return rep([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('mode=confidentialite') ? { ok: true, uid: SESSION.user.id } : { ok: true, pret: true, obligatoire: false, acces: true }) }));
  return { ctx, pg, errs };
}

const lire = (pg) => pg.evaluate(() => {
  const at = (s, a) => { const e = document.querySelector(s); return e ? e.getAttribute(a) : null; };
  const cartes = [...document.querySelectorAll('.vrm-pickup-card')].map((c) => {
    const s = c.querySelector('[data-colis-suivi]'), l = c.querySelector('[data-colis-limite]');
    const r = c.getBoundingClientRect();
    return { t: c.innerText, suivi: s ? s.getAttribute('data-colis-suivi') : null, compte: s ? s.getAttribute('data-colis-compte') : null, limite: l ? l.getAttribute('data-colis-limite') : null, limiteTxt: l ? l.innerText : '', large: r.right <= window.innerWidth + 1 };
  });
  const aVerif = [...document.querySelectorAll('[data-a-verifier-raison]')].map((x) => ({ raison: x.getAttribute('data-a-verifier-raison'), suivi: (x.querySelector('[data-colis-suivi]') || x).getAttribute('data-colis-suivi') || '', t: x.innerText }));
  const repartis = [...document.querySelectorAll('[data-reparti-suivi],[data-reparti-tx]')].map((x) => ({ suivi: x.getAttribute('data-reparti-suivi') || '', tx: x.getAttribute('data-reparti-tx') || '', t: x.innerText }));
  return {
    total: at('[data-pickup-total]', 'data-pickup-total'), aVerifier: at('[data-pickup-a-verifier]', 'data-pickup-a-verifier'),
    sansCompte: at('[data-pickup-sans-compte]', 'data-pickup-sans-compte'), nSansCompte: document.querySelectorAll('[data-pickup-sans-compte]').length,
    blocAVerifier: at('[data-a-verifier]', 'data-a-verifier'), fraicheur: at('[data-fraicheur-achats]', 'data-fraicheur-achats'), nFraicheur: document.querySelectorAll('[data-fraicheur-achats]').length,
    cartes, aVerif, repartis, texte: document.body.innerText, deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
    // L'ordre des points relais : la liste des n° de suivi de chaque bloc, dans l'ordre affiché.
    blocs: [...document.querySelectorAll('.vrm-pickup-point')].map((b) => [...b.querySelectorAll('[data-colis-suivi]')].map((x) => x.getAttribute('data-colis-suivi'))),
    blocsTexte: [...document.querySelectorAll('.vrm-pickup-point')].map((b) => b.innerText),
    publie: (() => { try { return JSON.parse(localStorage.getItem('vinted_vrm_colis_retirer') || localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return null; } })(),
  };
});

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const passes = [
      { vp: { width: 390, height: 844 }, sombre: false, nom: '390 clair' },
      { vp: { width: 390, height: 844 }, sombre: true, nom: '390 sombre' },
      { vp: { width: 1512, height: 950 }, sombre: false, nom: '1512' },
    ];
    for (const P of passes) {
      const T = P.nom;
      await essaie(T, async () => {
        const { ctx, pg, errs } = await preparer(b, P.vp, NOW, P.sombre);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('.vrm-pickup-point, [data-pickup-total]').first().waitFor({ timeout: 20000 }).catch(async (e) => { console.log('ÉCRAN : ' + (await pg.locator('body').innerText()).slice(0, 1500)); throw e; });
        await pg.waitForTimeout(2500);
        const L = await lire(pg);
        const carte = (s) => L.cartes.find((c) => c.suivi === s);
        // ── à retirer : deux e-mails + un colis vu par Vinted (code lu)
        dit(L.total === '4', `${T} « à retirer » = 4 (trois e-mails dans les délais + le colis Vinted au code lu)`, `total=${L.total}`);
        const c8 = carte('30000008');
        // Le lieu s'écrit UNE fois, en tête du point relais (pas sur chaque carte).
        const b8 = L.blocsTexte[L.blocs.findIndex((b) => b.includes('30000008'))] || '';
        dit(c8 && /taba'banc/i.test(b8) && !/lieu non indiqu/i.test(b8), `${T} ligne rangée avant le correctif : le lieu est RELU dans les lignes gardées (« POINT RELAIS® » le faisait manquer)`, b8.replace(/\n/g, ' ¦ ').slice(0, 160) || 'absent');
        dit(c8 && c8.limite === 'inconnue' && /Date limite de retrait inconnue/.test(c8.limiteTxt) && !/non indiqu/i.test(L.texte), `${T} … sa date limite est « inconnue » (jamais « non indiquée dans l'e-mail » : l'e-mail la portait, la route ne savait pas la lire)`, c8 && `${c8.limite} « ${c8.limiteTxt} »`);
        dit(!L.cartes.some((c) => c.suivi === 'XW000000009TS') && !L.aVerif.some((x) => x.suivi === 'XW000000009TS') && !/prochains jours/i.test(L.texte), `${T} « Information sur votre colis » (« sera disponible dans les prochains jours ») n'est ni à retirer ni à vérifier : il n'est pas arrivé`);
        const ordre = (s) => L.blocs.findIndex((b) => b.includes(s));
        dit(ordre('30000008') >= 0 && ordre('30000008') < ordre('09440000000002'), `${T} un point relais sans date limite ne passe plus derrière tous les autres (trié sur ce qui reste de la garde)`, `ordre : ${L.blocs.map((b) => b.join('+')).join(' · ')}`);
        dit(L.publie && L.publie.total === 4 && L.publie.aVerifier === 3 && Array.isArray(L.publie.colis) && L.publie.colis.length === 4, `${T} la publication lue par le widget dit 4 à retirer, 3 à vérifier, et la liste des 4 colis comptés`, L.publie ? JSON.stringify({ total: L.publie.total, aVerifier: L.publie.aVerifier, n: (L.publie.colis || []).length }) : 'absente');
        const c1 = carte('30000001');
        dit(!!c1, `${T} le Mondial Relay arrivé sur une adresse reliée à aucun compte APPARAÎT (jamais écarté)`, c1 ? '' : 'absent');
        dit(c1 && c1.compte === '' && L.sansCompte === '2' && L.nSansCompte === 1 && (L.texte.match(/compte non reconnu/g) || []).length === 1, `${T} … « compte non reconnu » dit UNE fois pour les deux colis sans compte`, `sansCompte=${L.sansCompte} ×${L.nSansCompte}`);
        dit(/Relie-la dans Réglages/.test(L.texte), `${T} … avec le geste, puisqu'une adresse de réception connue n'est reliée à aucun compte`);
        dit(c1 && c1.limite === '2026-10-26' && /jusqu'au 26\/10/.test(c1.limiteTxt), `${T} sa date limite (26/10) est sur la carte`, c1 && `${c1.limite} « ${c1.limiteTxt} »`);
        dit(c1 && /30000001/.test(c1.t) && /123456/.test(c1.t), `${T} son n° de suivi et son code sont sur la carte`);
        const c2 = carte('09440000000002');
        dit(c2 && /compte_a/.test(c2.compte || ''), `${T} le Chronopost reçu sur l'adresse de compte_a nomme compte_a`, c2 && c2.compte);
        dit(L.cartes.every((c) => c.large) && !L.deborde, `${T} aucune carte ne déborde`);
        // ── à vérifier : jamais « à retirer », jamais « perdu »
        dit(L.aVerifier === '3' && L.blocAVerifier === '3', `${T} 3 colis « à vérifier » (délai écrit dépassé · trop longtemps au relais · Vinted lu il y a 9 j)`, `entête=${L.aVerifier} bloc=${L.blocAVerifier}`);
        const r3 = L.aVerif.find((x) => x.suivi === '09440000000003');
        dit(r3 && r3.raison === 'delai_depasse' && !carte('09440000000003'), `${T} date limite écrite et passée ⇒ « délai dépassé », pas « à retirer » (arrivé il y a 4 jours seulement)`, r3 && r3.raison);
        const r4 = L.aVerif.find((x) => x.suivi === '1790000000000004');
        dit(r4 && r4.raison === 'trop_long' && /A90067/.test(r4.t), `${T} sans date limite et 11 jours au relais ⇒ « à vérifier », son code reste visible`, r4 && r4.raison);
        dit(L.aVerif.some((x) => x.raison === 'trop_long' && /Salomon XT-6/.test(x.t) && /il y a 9 j/.test(x.t)), `${T} l'achat Vinted lu « déposé » il y a 9 j ⇒ « à vérifier », l'âge de la lecture est dit`);
        dit(!/\bperdus?\b/i.test(L.texte), `${T} le mot « perdu » n'apparaît nulle part`);
        // ── repartis : par le transporteur, ou par la commande liée par IDENTITÉ
        dit(L.repartis.some((x) => x.suivi === '30000006'), `${T} « retourné à l'expéditeur » (écrit par le transporteur) ⇒ « reparti »`);
        dit(L.repartis.some((x) => x.suivi === '30000007') && !carte('30000007'), `${T} le retour rangé sur une AUTRE ligne (même n° de suivi) sort le colis de « à retirer »`);
        dit(L.repartis.some((x) => x.suivi === '30000005' || x.tx === '9603') && !carte('30000005'), `${T} commande liée par son n° de suivi « non réclamée » ⇒ « reparti », plus « à retirer »`);
        dit(!L.repartis.some((x) => x.suivi === '30000001'), `${T} une commande au MÊME TITRE (une autre paire) ne fait pas repartir le Mondial Relay (§5)`);
        // ── fraîcheur, une fois, avec le compte et le geste
        dit(L.nFraicheur === 1 && /222:9/.test(L.fraicheur || '') && /compte_b/.test(L.texte), `${T} « achats relus il y a 9 j sur compte_b » dit une fois`, `${L.fraicheur} ×${L.nFraicheur}`);
        if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, `colis-fiables-${P.vp.width}${P.sombre ? '-sombre' : ''}.png`), fullPage: true });
        // ── Ma journée : le même nombre, et la ligne « à vérifier »
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4000);
        const J = await pg.evaluate(() => {
          const t = document.querySelector('[data-tuile="retirer"]'); const v = document.querySelector('[data-job="retrait-a-verifier"]');
          return { tuile: t ? t.getAttribute('data-n') : null, job: v ? v.getAttribute('data-n') : null, texte: document.body.innerText };
        });
        // ⚠️ Le MÊME nombre qu'Achats (§11) : sur Ma journée aussi, le colis relié par
        // son n° de suivi à une commande non réclamée n'est plus « à retirer ».
        dit(J.tuile === '4', `${T} Ma journée : la case « À retirer » dit 4 — le même nombre qu'Achats`, `tuile=${J.tuile}`);
        dit(J.job === '3' && !/\bperdus?\b/i.test(J.texte), `${T} Ma journée : « 3 colis à vérifier », jamais « perdu »`, `job=${J.job}`);
        dit(!errs.length, `${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
    // ── Quatre jours plus tard : la date limite du Mondial Relay (26/10) est passée.
    await essaie('27 oct.', async () => {
      const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 }, APRES, false);
      await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
      await pg.locator('.vrm-pickup-point, [data-pickup-total]').first().waitFor({ timeout: 20000 });
      await pg.waitForTimeout(2500);
      const L = await lire(pg);
      const r1 = L.aVerif.find((x) => x.suivi === '30000001');
      dit(!L.cartes.some((c) => c.suivi === '30000001') && r1 && r1.raison === 'delai_depasse', '27 oct. : le Mondial Relay dont la limite (26/10) est passée n\'est plus « à retirer » — « délai dépassé », à vérifier', r1 ? r1.raison : 'absent');
      dit(L.total === '3' && L.aVerifier === '4', '27 oct. : « à retirer » 3, « à vérifier » 4', `total=${L.total} · à vérifier=${L.aVerifier}`);
      dit(r1 && /123456/.test(r1.t), '27 oct. : son code reste visible (il est peut-être encore au relais)');
      dit(!errs.length, '27 oct. aucune erreur d\'app', errs[0]);
      await ctx.close();
    });
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ colis à retirer fiables : ${ko} rouge(s).` : `\n✅ colis à retirer fiables : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
