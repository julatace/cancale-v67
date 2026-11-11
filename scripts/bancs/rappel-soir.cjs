require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE RAPPEL DE LA VEILLE AU SOIR, EXÉCUTÉ (node scripts/bancs/rappel-soir.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// Retenu par Julien le 11 octobre (« Demain : N colis à poster ») ; devenu le
// RÉSUMÉ DU SOIR le 10 nov. (lot AT, api/_lib/resume-soir.js) : seulement ce qu'il
// y a à faire DEMAIN — colis à date limite LUE demain (ou déjà en retard), colis à
// retirer dont le dernier jour lu est demain, offres Vestiaire reçues qui expirent
// avant demain soir — et RIEN si rien demain. UNE notification. §4.10 : on
// lance le VRAI `api/ship-reminders.js?moment=soir` (et le vrai widget pour
// comparer) sur une fausse base CLOISONNÉE à DEUX vendeurs, un faux Web Push
// (rien ne part), un mercredi 21 octobre 2026 à 20 h 05 (Paris). On exige :
//   • A a 4 colis à poster (3 Vinted + 1 eBay ; un coché « posté » exclu) : il
//     reçoit « Demain : 2 colis à déposer » (1 limite lue demain, 1 déjà en
//     retard ; l'eBay dû dans 4 jours et la vente sans bordereau dont la limite
//     ESTIMÉE tombe demain ne sont PAS dits), sur SON appareil ;
//   • le total du cron (`n`) reste CELUI du widget (même règle, §11) ;
//   • rien demain (colis dus plus tard) ⇒ rien ne sonne, rien mémorisé ;
//   • B : un colis à retirer dont le dernier jour LU est demain, une offre
//     Vestiaire reçue qui expire demain ⇒ « Demain : 1 retrait, 1 offre », le
//     toucher ouvre la carte du colis ; l'offre seule ouvre Messages · Vestiaire ;
//     une offre envoyée par lui, une qui expire plus tard, un dernier jour
//     aujourd'hui ou après-demain ne sont pas dits ;
//   • B n'a rien à poster ⇒ rien pour B ;
//   • une fois par jour : relancé ⇒ rien ; mémo non écrit / illisible ⇒ rien ;
//   • préférence « soir » coupée ⇒ rien ; ventes Vinted illisibles ⇒ rien ;
//     eBay illisible ⇒ « au moins », eBay nommé ;
//   • toutes les lectures portent owner=eq.<vendeur> ;
//   • le passage du soir n'envoie NI le rappel du matin, NI l'URSSAF, NI le bilan,
//     et le passage du matin n'envoie pas le rappel du soir ;
//   • vercel.json porte le second cron vers la MÊME route.
// Aucune fixture : tout est inventé ici.
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };

process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
// (9 nov.) Depuis le 7 nov. (api/_lib/cle-service.js) une route sans clé de service répond
// 503 et ne lit rien : le banc lui donne une clé FICTIVE (le faux fetch ne la regarde pas).
// Les vendeurs du banc ne sont pas des UUID ⇒ accesVendeur rend « pas su », qui ne coupe
// pas. Le 503 sans clé est tenu par scripts/audit-cle-service.cjs.
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.CRON_SECRET = 'cle-banc-cron'; // obligatoire depuis dc4799f (la route refuse sans elle)
const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

const SOIR = Date.parse('2026-10-21T18:05:00Z');      // mercredi, 20 h 05 à Paris
const vraiNow = Date.now;
const J = 86400000;
const iso = (t) => new Date(t).toISOString();
const ebayCmd = (id, shipBy) => ({
  orderId: id, creationDate: iso(SOIR - 2 * J), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED',
  cancelStatus: { cancelState: 'NONE_REQUESTED' }, fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO' }],
  lineItems: [{ lineItemId: '1', title: 'Paire ' + id, sku: 'VRM-7', legacyItemId: '117', quantity: 1, lineItemFulfillmentInstructions: { shipByDate: shipBy } }],
});

const vendeurs = () => ({
  A: {
    subs: [{ endpoint: 'https://fcm.googleapis.com/A1', keys: {} }], prefs: null,
    comptes: [{ vinted_user_id: '11', login: 'vendeuse_a' }],
    main: { vinted_sales_hidden: [], vinted_accounts_hidden: [], vinted_ship_done: { 102: true }, vinted_bords_shipped: {}, vrm_widget_token: 'tokA' },
    ventes: { 11: { cap: iso(SOIR - 3600000), txns: ['102', '106', '107', '108'], orders: [
      { transaction_id: 102, status: 'Le paiement a été validé', date: iso(SOIR - J), price: { amount: '23.5' }, transaction_user_status: 'needs_action' },
      { transaction_id: 106, status: 'Le paiement a été validé', date: iso(SOIR - J), price: { amount: '30' }, transaction_user_status: 'needs_action' },
      { transaction_id: 107, status: 'Le paiement a été validé', date: iso(SOIR - 4 * J), price: { amount: '45' }, transaction_user_status: 'needs_action' },
      // (10 nov.) Aucun e-mail de bordereau : limite ESTIMÉE (vente + 7 j) = demain. Un plancher,
      // pas une date lue : le résumé du soir ne la dit PAS « à déposer demain ».
      { transaction_id: 108, status: 'Le paiement a été validé', date: iso(SOIR - 6 * J), price: { amount: '50' }, transaction_user_status: 'needs_action' },
    ] } },
    // §6.3 (22 oct.) : la forme RÉELLE d'un bordereau email — `filename` et
    // `receivedAt` sont sur 204 lignes sur 204 ; la table « un bordereau par
    // vente » de l'app (et désormais des rappels) ne lit que celles-là.
    bords: [
      { id: 'email_bord_106', data: { transaction: '106', dateLimite: '22/10/2026 23:59', numero: '12', filename: 'Bordereau-Vinted-106.pdf', receivedAt: iso(SOIR - J) } },
      { id: 'email_bord_107', data: { transaction: '107', dateLimite: '21/10/2026 23:59', numero: '14', filename: 'Bordereau-Vinted-107.pdf', receivedAt: iso(SOIR - 4 * J) } },     // limite ce soir : demain, c'est en retard
      { id: 'email_bord_102', data: { transaction: '102', dateLimite: '20/10/2026 23:59', numero: '9', filename: 'Bordereau-Vinted-102.pdf', receivedAt: iso(SOIR - J) } },   // coché « posté » : jamais compté
    ],
    ebay: [ebayCmd('E1', '2026-10-25T21:00:00Z')],
  },
  B: {
    subs: [{ endpoint: 'https://fcm.googleapis.com/B1', keys: {} }], prefs: null,
    comptes: [{ vinted_user_id: '22', login: 'vendeur_b' }],
    main: { vinted_sales_hidden: [], vinted_accounts_hidden: [], vinted_ship_done: {}, vinted_bords_shipped: {}, vrm_widget_token: 'tokB' },
    ventes: { 22: { cap: iso(SOIR - 3600000), txns: [], orders: [{ transaction_id: 201, status: 'Commande finalisée', date: iso(SOIR - 9 * J), price: { amount: '40' } }] } },
    bords: [], ebay: [], tracks: [], vcOffres: undefined,
  },
});
// (10 nov., lot AT) Un colis à retirer (ligne e-mail, scalaires dans `meta` comme en base).
const track = (suivi, limite, lieu = 'Tabac des Halles, 8 Rue des Lilas, 44000 Nantes') => {
  const m = { status: 'available', receivedAt: iso(SOIR - 2 * J), arriveLe: iso(SOIR - 2 * J), limite, suivi, subject: `Votre colis ${suivi} est disponible`, carrier: 'mondialrelay', lieu, code: '454602' };
  return { id: 'email_track_mondialrelay_' + suivi, data: m, meta: m };
};
// Une offre Vestiaire (la forme de `vc_offres` rangée par l'extension 5.319).
const offreVc = (id, expireMs, par = 'acheteur') => ({ id, produit: '9' + id, compte: '555', titre: 'Sac', expire: iso(expireMs), ouverte: true, aToi: par === 'acheteur', dernier: { action: 'offer', par, at: iso(SOIR - J) }, offre: 20000, initial: 25000 });

let V, memos, lus, ecrits, pannes;
const reset = () => { V = vendeurs(); memos = {}; lus = []; ecrits = []; pannes = new Set(); pushes.length = 0; };
const rep = (o, status = 200) => new Response(typeof o === 'string' ? o : JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const chemin = (obj, p) => p.reduce((o, k) => (o == null ? undefined : o[k]), obj);
function projette(ligne, select) {
  if (!select || select === '*') return ligne;
  const out = {};
  for (const item of select.split(',')) {
    const [alias, expr] = item.includes(':') ? item.split(/:(.+)/) : [item, item];
    const morceaux = expr.split(/->>?/);
    const b = morceaux.shift();
    let v = b === 'meta' ? ligne.meta : b === 'data' ? ligne.data : ligne[b];
    if (morceaux.length) v = chemin(v, morceaux);
    if (/->>/.test(expr) && v != null) v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v === undefined ? null : v;
  }
  return out;
}
const lignesDe = (o) => {
  const v = V[o]; if (!v) return [];
  const L = [{ id: 'main', data: v.main }];
  for (const [uid, x] of Object.entries(v.ventes)) L.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: x.cap, payload: { my_orders: x.orders }, resume: { txns: x.txns } } });
  for (const b of v.bords) L.push(b);
  for (const t of (v.tracks || [])) L.push(t);
  if (v.vcOffres) L.push({ id: 'vc_offres', data: { capturedAt: iso(SOIR - 3600000), offres: v.vcOffres } });
  L.push({ id: 'ebay_orders', data: { orders: v.ebay } });
  L.push({ id: 'push_subs', data: { subs: v.subs } });
  if (v.prefs) L.push({ id: 'push_prefs', data: v.prefs });
  for (const [id, data] of Object.entries(memos[o] || {})) L.push({ id, data });
  return L;
};
const filtreId = (id, q) => {
  const eq = /(?:^|&)id=eq\.([^&]+)/.exec(q), like = /(?:^|&)id=like\.([^&]+)/.exec(q);
  if (eq) return id === eq[1];
  if (like) { const re = new RegExp('^' + like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '\u0000').replace(/_/g, '.').replace(/\u0000/g, '.*') + '$'); return re.test(id); }
  return true;
};
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url)), m = opts.method || 'GET';
  if (!u.includes('/rest/v1/')) return rep({}, 404);
  const [table, q = ''] = u.split('/rest/v1/')[1].split('?');
  const own = (/(?:^|&)owner=eq\.([^&]+)/.exec(q) || [])[1] || null;
  if (m === 'POST' && table === 'app_data') {
    for (const l of JSON.parse(opts.body || '[]')) {
      ecrits.push({ id: l.id, owner: l.owner || null, data: l.data });
      if (pannes.has(`ecrire:${l.owner}:${l.id}`)) return rep('<html>522</html>', 522);
      (memos[l.owner] = memos[l.owner] || {})[l.id] = l.data;
    }
    return rep('', 201);
  }
  lus.push(u);
  const select = (/(?:^|&)select=([^&]+)/.exec(q) || [])[1] || '';
  if (table === 'app_data' && /select=owner&limit=1/.test(q)) return rep([{ owner: 'A' }]);
  if (table === 'app_data' && /id=eq\.main/.test(q) && !own) return rep(Object.keys(V).map((o) => projette({ owner: o, id: 'main', data: V[o].main }, select)));
  if (!own) return rep({ message: 'lecture sans vendeur' }, 400);
  for (const p of pannes) { const [o, motif] = p.split(':'); if (o === own && (table + '?' + q).includes(motif)) return rep('<html>522</html>', 522); }
  if (table === 'vinted_accounts') return rep((V[own] ? V[own].comptes : []).map((c) => projette(c, select)));
  if (table !== 'app_data') return rep([]);
  return rep(lignesDe(own).filter((l) => filtreId(l.id, q)).map((l) => projette({ ...l, owner: own }, select)));
};
const res = () => ({ code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } });

(async () => {
  reset();
  let cron, widget;
  try { cron = (await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js'))).default; } catch (e) { dit(false, 'api/ship-reminders.js se charge', e.message); }
  try { widget = (await import('file://' + path.join(RACINE, 'api', 'widget.js'))).default; } catch (e) { dit(false, 'api/widget.js se charge', e.message); }
  const lancer = async (t, query = { moment: 'soir' }) => { Date.now = () => t; try { const r = res(); await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query }, r); return r; } finally { Date.now = vraiNow; } };
  const soirDe = (o) => pushes.filter((p) => /^soir-/.test(p.tag || '') && p.endpoint.includes('/' + o));

  console.log('── Le soir : ce qu’il y a à faire DEMAIN, pour chacun le sien');
  await essaie('soir', async () => {
    reset();
    const r = await lancer(SOIR);
    const a = soirDe('A'), b = soirDe('B');
    const p = a[0] || {};
    console.log(`     sur le téléphone de A : « ${p.title} » / « ${p.body} »`);
    dit(a.length === 1, 'A reçoit UN rappel du soir sur son appareil', `A=${a.length} · HTTP ${r.code}`);
    dit(p.title === 'Demain : 2 colis à déposer', 'le titre dit « Demain : 2 colis à déposer » (1 limite lue demain + 1 en retard ; l’eBay dû dans 4 jours, la limite ESTIMÉE de demain et le colis coché « posté » ne sont pas dits)', p.title);
    dit(/^1 colis à déposer avant 23 h 59 demain\./.test(p.body || '') && /1 déjà en retard/.test(p.body || '') && !/2 déjà en retard|à poster/.test(p.body || ''), 'le corps : l’heure LUE de la limite de demain, puis 1 déjà en retard — le bordereau du colis coché « posté » n’est pas compté', p.body);
    dit((p.title || '').length <= 40 && (p.body || '').length <= 170, 'la forme passe par api/_lib/push.js (titre ≤ 40, corps ≤ 170)');
    dit(p.url === '/?tab=ventes&cible=colonne&colonne=prets', 'le clic ouvre Ventes · À expédier, sur la colonne « Prêts à imprimer » (31 oct. ; 11 nov.)', p.url);
    dit(b.length === 0, 'B n’a rien à poster ⇒ rien pour B', `B=${b.length}`);
    const lect = lus.filter((u) => /orders_sold|email_bord|ebay_orders|ebay_comptes|vinted_accounts|soir_reminder_dedup/.test(u));
    dit(lect.length > 0 && lect.every((u) => /owner=eq\./.test(u)), 'toutes les lectures portent owner=eq.<vendeur>', `${lect.length} lectures`);
    dit(!pushes.some((x) => /^(ship-reminder|urssaf-|bilan-)/.test(x.tag || '')), 'le passage du soir n’envoie ni le rappel du matin, ni l’URSSAF, ni le bilan');
  });

  console.log('\n── Le nombre du widget');
  await essaie('widget', async () => {
    reset();
    Date.now = () => SOIR;
    const w = res();
    try { await widget({ method: 'GET', headers: {}, query: { k: 'tokA' } }, w); } finally { Date.now = vraiNow; }
    reset();
    const r = await lancer(SOIR);
    const bil = r.corps && Array.isArray(r.corps.bilans) ? r.corps.bilans.find((x) => x.owner === 'A') : null;
    dit(w.corps && w.corps.ship && bil && bil.n === w.corps.ship.total, 'le soir annonce exactement les colis « à expédier » du widget', `soir=${bil && bil.n} widget=${w.corps && w.corps.ship && w.corps.ship.total}`);
  });

  console.log('\n── Rien demain ⇒ rien ne sonne');
  await essaie('rien demain', async () => {
    reset();
    // A : la limite lue de 106 passe à après-demain + 2, 107 aussi ; l'eBay est dû dans 4 jours.
    V.A.bords[0].data.dateLimite = '24/10/2026 23:59'; V.A.bords[1].data.dateLimite = '25/10/2026 12:00';
    const r = await lancer(SOIR);
    const bil = r.corps && Array.isArray(r.corps.bilans) ? r.corps.bilans.find((x) => x.owner === 'A') : null;
    dit(soirDe('A').length === 0, 'A a 4 colis à poster, aucun pour demain (la limite estimée n’est pas lue) ⇒ rien ne sonne (« rien demain » ne se dit pas)', `${soirDe('A').length}`);
    dit(bil && bil.n === 4 && /rien demain/.test(String(bil.soir)), 'le cron le rapporte : n = 4 à poster, « rien demain »', JSON.stringify(bil && { n: bil.n, soir: bil.soir }));
    dit(!((memos.A || {}).soir_reminder_dedup), 'rien mémorisé : si un colis devient dû ce soir, le prochain passage peut le dire');
  });

  console.log('\n── Codes à retirer et offres Vestiaire qui expirent demain');
  await essaie('retrait et offre', async () => {
    reset();
    V.B.tracks = [track('30000077', '2026-10-22'), track('30000078', '2026-10-21', 'Bar Test, 5 Rue Exemple, 56000 Vannes'), track('30000079', '2026-10-24')];
    V.B.vcOffres = {
      n101: offreVc('101', Date.parse('2026-10-22T13:00:00Z')),          // reçue, expire demain 15 h ⇒ dite
      n102: offreVc('102', Date.parse('2026-10-24T13:00:00Z')),          // reçue, expire dans 3 jours ⇒ non
      n103: offreVc('103', Date.parse('2026-10-22T09:00:00Z'), 'vendeur'), // envoyée par lui ⇒ jamais
    };
    await lancer(SOIR);
    const b = soirDe('B'), p = b[0] || {};
    console.log(`     sur le téléphone de B : « ${p.title} » / « ${p.body} » → ${p.url}`);
    dit(b.length === 1, 'B (aucun colis à poster) reçoit UNE notification du soir', `${b.length}`);
    dit(p.title === 'Demain : 1 retrait, 1 offre', 'le titre : 1 retrait (dernier jour LU demain), 1 offre (Vestiaire, reçue, expire demain)', p.title);
    dit(/Dernier jour pour retirer ton colis à Tabac des Halles\./.test(p.body || '') && !/Vannes|Bar Test/.test(p.body || ''), 'le corps nomme le point du colis de demain — pas celui dont le dernier jour est aujourd’hui (le matin l’a dit)', p.body);
    dit(/1 offre Vestiaire expire avant demain soir\./.test(p.body || '') && !/Vinted/.test(p.body || ''), 'l’offre envoyée par lui et celle qui expire dans 3 jours ne sont pas dites ; aucune offre Vinted (elles n’expirent pas)', p.body);
    dit(p.url === '/?tab=achats&cible=retrait&suivi=30000077', 'le toucher ouvre la carte de CE colis à retirer (son n° de suivi)', p.url);
    reset();
    V.B.vcOffres = { n101: offreVc('101', Date.parse('2026-10-22T13:00:00Z')) };
    await lancer(SOIR);
    const q = soirDe('B')[0] || {};
    dit(q.title === 'Demain : 1 offre expire' && q.url === '/?tab=messages&site=vestiaire', 'une offre seule : « Demain : 1 offre expire », le toucher ouvre Messages · Vestiaire', `${q.title} → ${q.url}`);
    reset();
    V.B.vcOffres = { n101: offreVc('101', Date.parse('2026-10-22T13:00:00Z')) };
    pannes.add('B:vc_offres');
    await lancer(SOIR);
    dit(soirDe('B').length === 0, 'offres illisibles et rien d’autre ⇒ rien ne sonne (« pas su » n’annonce rien)');
  });

  console.log('\n── Une fois par jour');
  await essaie('doublon', async () => {
    reset();
    await lancer(SOIR); await lancer(SOIR + 1800000);
    dit(soirDe('A').length === 1, 'relancé le même soir : aucun second rappel', `${soirDe('A').length}`);
    await lancer(SOIR + J);
    dit(soirDe('A').length === 2, 'le lendemain soir : un nouveau rappel', `${soirDe('A').length}`);
  });
  await essaie('mémo non écrit', async () => {
    reset(); pannes.add('ecrire:A:soir_reminder_dedup');
    await lancer(SOIR);
    dit(soirDe('A').length === 0, 'le mémo de A ne s’écrit pas ⇒ rien (sinon il repartirait au prochain passage)');
  });
  await essaie('mémo illisible', async () => {
    reset(); pannes.add('A:soir_reminder_dedup');
    await lancer(SOIR);
    dit(soirDe('A').length === 0, 'le mémo de A est illisible ⇒ rien (pas su s’il est déjà parti)');
  });

  console.log('\n── Préférence, lectures ratées');
  await essaie('préférence', async () => {
    reset(); V.A.prefs = { soir: false };
    await lancer(SOIR);
    dit(soirDe('A').length === 0, '« Colis de demain » coupé chez A ⇒ rien');
  });
  await essaie('ventes illisibles', async () => {
    reset(); pannes.add('A:orders_sold');
    await lancer(SOIR);
    dit(soirDe('A').length === 0 && !((memos.A || {}).soir_reminder_dedup), 'ventes Vinted illisibles ⇒ rien envoyé, rien mémorisé (jamais un nombre inventé)');
  });
  await essaie('eBay illisible', async () => {
    reset(); pannes.add('A:ebay_orders');
    await lancer(SOIR);
    const p = soirDe('A')[0] || {};
    dit(/au moins 2 colis/.test(p.title || '') && /eBay pas relu/.test(p.body || ''), 'eBay illisible ⇒ « au moins 2 colis », eBay nommé', `${p.title} / ${p.body}`);
  });

  // (11 nov., décision C8) L'heure CHOISIE (Paramètres → Notifications, `push_prefs.soirHeure`, 18–22 h,
  // heure de Paris). Défaut inchangé : le cron de Vercel (SOIR = 20 h 05 l'été d'octobre).
  console.log('\n── (C8) L’heure du résumé, réglable');
  const horaire = { moment: 'soir', passage: 'heure' };
  await essaie('heure choisie', async () => {
    reset(); V.A.prefs = { soirHeure: 22 };
    let r = await lancer(SOIR);
    const bil = r.corps && r.corps.bilans ? r.corps.bilans.find((x) => x.owner === 'A') : null;
    dit(soirDe('A').length === 0 && /pas encore son heure/.test(String(bil && bil.soir)) && !((memos.A || {}).soir_reminder_dedup), 'C8. A a choisi 22 h : le cron de 20 h 05 n’envoie rien, ne mémorise rien', JSON.stringify(bil && bil.soir));
    r = await lancer(SOIR + 3600000, horaire);
    dit(soirDe('A').length === 0, 'C8. passage horaire à 21 h 05 : pas encore 22 h ⇒ rien');
    r = await lancer(SOIR + 2 * 3600000, horaire);
    dit(soirDe('A').length === 1 && (soirDe('A')[0].title || '') === 'Demain : 2 colis à déposer', 'C8. passage horaire à 22 h 05 : le résumé part, le même texte', JSON.stringify(soirDe('A').map((x) => x.title)));
    await lancer(SOIR + 3 * 3600000, horaire);
    dit(soirDe('A').length === 1, 'C8. une fois par soir : 23 h 05 ⇒ rien de plus');
    dit(r.corps && r.corps.passage === 'heure' && !('sondes' in r.corps), 'C8. le passage horaire ne fait que le résumé (ni sondes, ni eBay relu, ni bilan)', JSON.stringify(Object.keys(r.corps || {})));
  });
  await essaie('heure par défaut', async () => {
    reset();
    await lancer(SOIR - 3600000, horaire);
    dit(soirDe('A').length === 0, 'C8. sans heure choisie, le passage horaire ne fait rien (le cron d’avant décide)');
    await lancer(SOIR);
    dit(soirDe('A').length === 1, 'C8. sans heure choisie : 20 h 05, comme avant');
  });
  await essaie('heure plus tôt', async () => {
    reset(); V.A.prefs = { soirHeure: 18 };
    await lancer(SOIR - 2 * 3600000, horaire);
    dit(soirDe('A').length === 1, 'C8. A a choisi 18 h : passage horaire de 18 h 05 ⇒ le résumé part');
    await lancer(SOIR);
    dit(soirDe('A').length === 1, 'C8. le cron de 20 h 05 ne le renvoie pas (mémo du jour)');
  });
  await essaie('heure et catégorie', async () => {
    reset(); V.A.prefs = { soirHeure: 19, soir: false };
    await lancer(SOIR - 3600000 + 600000, horaire);
    dit(soirDe('A').length === 0, 'C8. une heure choisie ne rallume pas une préférence coupée');
  });

  console.log('\n── Le matin ne part pas le soir, et inversement');
  await essaie('matin', async () => {
    reset();
    await lancer(SOIR, {});
    dit(soirDe('A').length === 0, 'sans `moment=soir`, le cron du matin n’envoie pas le rappel du soir');
  });
  await essaie('vercel.json', async () => {
    const vj = JSON.parse(fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8'));
    const crons = Array.isArray(vj.crons) ? vj.crons : [];
    // Un chemin de cron SANS paramètre (la doc de Vercel n'en montre aucun) : une
    // réécriture le mène à la MÊME route avec `?moment=soir`.
    const soir = crons.find((c) => c.path === '/api/rappel-soir');
    const rw = (vj.rewrites || []).find((r) => r.source === '/api/rappel-soir');
    const gh = fs.readFileSync(path.join(RACINE, '.github', 'workflows', 'resume-soir-heure.yml'), 'utf8');
    dit(/cron: '13 16-21 \* \* \*'/.test(gh) && /moment=soir&passage=heure/.test(gh), 'C8. GitHub appelle le passage horaire de 16 h à 21 h UTC (18 h → 22 h à Paris)');
    dit(crons.length === 2 && !!soir && /^0 1[89] \* \* \*$/.test(soir.schedule) && !!rw && rw.destination === '/api/ship-reminders?moment=soir', 'vercel.json : un second cron, une fois par jour, réécrit vers la MÊME route (?moment=soir)', JSON.stringify(crons));
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
