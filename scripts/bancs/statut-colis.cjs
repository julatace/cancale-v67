require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// Banc : LE STATUT DE CHAQUE COLIS, SON POINT, SON TRANSPORTEUR, SON CODE, SA DATE (6 nov.)
// Julien : « Améliore la fiabilité sur le statut de chaque colis, le point de retrait, etc. »
// (docs/passation/2026-11-06-statut-colis.md). Colis → À retirer, sur des données INVENTÉES de
// la VRAIE forme (lignes `email_track_*`, `transp_*`, `harvest_{uid}_suivi_{tx}`, achats
// `my_orders`, `panel_colis_relais`, e-mails Vinted gardés `email_inconnu_*` avec leur lien de
// suivi en base64, SMS rangés par la vraie route `ligneSms`). Une vingtaine de cas pièges ;
// pour chacun : la section (à retirer · à vérifier · peut-être en double · repartis · fini),
// le point, le transporteur LU, le code, la date limite — jugés sur les data-* et les nombres
// rendus (§6.4), jamais un libellé.
//   C1  e-mail « disponible » 09 h 50 + lecture Mondial Relay « en route » faite à 08 h 07 ⇒ à retirer, lecture dite EN RETARD
//   C2  e-mail « disponible » + « en route » daté APRÈS l'arrivée ⇒ à vérifier (contradiction, la raison dite)
//   C3  e-mail + SMS du même n° (casier), deux codes ⇒ une ligne, le code de l'e-mail, l'autre dit
//   C4  retiré chez le transporteur, PUIS e-mail de relance « Le temps file » ⇒ fini (nulle part)
//   C5  colis postal irlandais (S10 « …IE »), ligne `transp_chronopost_` abandonnée (introuvable, fini) ⇒ transporteur PAS lu
//   C6  casier « LOCKER 24/7 SUPER U » et comptoir « SUPER U » ⇒ deux cartes
//   C7-9 un point écrit trois façons (« TABA'VAP, 29 Rue Hoche, 56000 Vannes », « TABAVAP, TABAVAP, 29 RUE HOCHE… », « Tabavap 29 Rue Hoche ») ⇒ UNE carte
//   C10 le même nom dans une autre ville (Rennes) ⇒ une autre carte
//   C11 retour à l'expéditeur lu chez le transporteur ⇒ « Argent à vérifier », jamais à retirer
//   C12 achat annulé, son e-mail Vinted « t'attend » relié par la conversation ⇒ pas à retirer
//   C13 moitié Vinted sans identité au point d'un colis Mondial Relay ⇒ « peut-être en double », expliqué
//   C14 e-mail Vinted GARDÉ (avant le 3 nov.) dont le lien de suivi (base64) mène à un achat finalisé ⇒ fini
//   C15 e-mail Vinted gardé relié à un achat « déposé » ⇒ UNE ligne comptée, au titre de l'achat
//   C16 SMS seul, sans date limite ⇒ « vers le … (estimé) », garde de Mondial Relay
//   C17 transporteur inconnu (C5) ⇒ « Date limite inconnue », jamais une garde prêtée
//   C18 vieux « t'attend » (à vérifier par la garde) dont l'achat porte un n° que Vinted Go dit retiré ⇒ fini
//   C19 incident « a quitté le point relais » après l'arrivée ⇒ à vérifier
//   C20 limite LUE dans l'e-mail (27/11) et limite déduite du transporteur (11/11) ⇒ l'e-mail fait foi
// 390 tactile clair/sombre + 1512. BANC_PORT (12110-12149), SHOTS=<dossier>, DIST=<build> (mutations,
// arbre d'avant), JR_VUES=390-clair,…
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 12111);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.JR_VUES ? process.env.JR_VUES.split(',') : null;
const maintenant = new Date('2026-11-06T09:00:00Z');   // 10 h à Paris
const MS = maintenant.getTime();
const iso = (t) => new Date(t).toISOString();
const Z = (s) => `2026-${s}:00.000Z`;
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS - 3600e3);
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

// ── Les lignes (inventées, vraie forme) ─────────────────────────────────────────
const MAISON = 'MAISON DE LA PRESSE, 40 RUE DU PORT, 35260 CANCALE';
const mr = (suivi, o) => ({ id: `email_track_mondialrelay_${suivi}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible 📦`, code2: null, qrB64: null, qrUrl: null, qrType: null, consigne: false, account: 'compte_a', artTitle: null, ...o } });
const transp = (carrier, suivi, o) => ({ id: `transp_${carrier}_${suivi}`, data: { v: 1, rev: 1, carrier, suivi, etat: null, detail: null, etatAt: null, libelle: '', lieuNom: '', lieuVille: '', lieuCp: '', lieuRue: '', limite: null, limiteSure: false, lu: null, source: 'serveur', essai: iso(MS - 600e3), essaiRes: 'ok', essais: 0, voie: carrier === 'mondialrelay' ? 'mr-fr-mvc' : 'vg-v3', fini: false, evenements: [], ...o } });
const uuid = (n) => `01a0aaaa-bbbb-7ccc-8ddd-${String(n).padStart(12, '0')}`;
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// L'e-mail Vinted « Commande mise à jour » GARDÉ avant le 3 nov. : le corps reçu, coupé, le lien de la
// conversation dans un lien de suivi `links.vinted.com/t/<base64>` (la forme mesurée sur sa base).
const garde = (id, { titre, lieu, conv, at }) => ({ id: `email_inconnu_${id}`, data: { subject: `Commande mise à jour pour ${titre}`, receivedAt: at, famille: 'vinted', raison: 'connu-sans-action',
  brut: JSON.stringify({ messageId: `<${id}@vinted.test>`, sourceDate: at, text: `Bonjour,\n\nTon colis a été livré dans le Point Relais ${lieu}. Tu peux, dès maintenant, aller le récupérer.\n\nAller sur la conversation \n<https://links.vinted.com/t/${b64url(`https://www.vinted.fr/inbox/${conv}?utm=mail`)}x9>\n\nL'équipe Vinted` }).slice(0, 2000) } });
const achat = (tx, { titre, status, tus = 'needs_action', conv, date }) => ({ transaction_id: tx, conversation_id: conv, title: titre, price: { amount: '30.0', currency_code: 'EUR' }, status, transaction_user_status: tus, date, photo: null });
const DEPOSE = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const ACHATS = [
  achat(9100005, { titre: 'Achat irlandais C5', status: DEPOSE, conv: uuid(5), date: Z('11-02T10:00') }),
  achat(9100012, { titre: 'Achat annulé C12', status: 'Commande annulée', tus: 'failed', conv: uuid(12), date: Z('11-01T10:00') }),
  achat(9100014, { titre: 'Achat finalisé C14', status: "Transaction finalisée - L'acheteur a validé la commande", tus: 'completed', conv: uuid(14), date: Z('10-26T10:00') }),
  achat(9100015, { titre: 'Achat déposé C15', status: DEPOSE, conv: uuid(15), date: Z('11-03T10:00') }),
  achat(9100018, { titre: 'Achat Vinted Go C18', status: DEPOSE, conv: uuid(18), date: Z('10-24T10:00') }),
];
const suiviVinted = (tx, suivi, o) => ({ id: `harvest_111_suivi_${tx}`, data: { v: 1, n: 2, tx: String(tx), uid: '111', suivi, transporteur: null, capturedAt: cap, source: 'extension', ...o } });
// Une moitié Vinted rangée par le SERVEUR (api/email-inbound.js, `ligneArrivee`) : sa clé est la conversation.
const vintedHalf = (conv, { titre, lieu, at, forme = 'attend' }) => ({ id: `email_track_autre_conv-${conv}`, data: { type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)', subject: `Commande mise à jour pour ${titre}`, receivedAt: at, emailAt: at, arriveLe: at, code: null, code2: null, artTitle: titre, lieu, limite: null, consigne: false, conv, source: 'vinted-commande', forme, cleLigne: `email_track_autre_conv-${conv}`, qrB64: null, qrType: null, qrUrl: null, account: '', recuSur: ['acheteur@exemple.test'] } });
let LIGNES = null;
async function fabriquer() {
  const sms = await import('file://' + path.join(__dirname, '..', '..', 'api', '_lib', 'sms-mondialrelay.js'));
  const ligneSms = (texte, at, prev = null) => { const lu = sms.lireSmsMondialRelay({ texte, expediteur: 'MRELAY' }); const l = sms.ligneSms(lu, prev, { smsAt: at, maintenant: at }); return { id: sms.idLigneSms(lu.suivi), data: l.data }; };
  const c3mail = mr('81000003', { lieu: 'LOCKER 24/7 SUPER U, Rue de la Bretonnière, 35260 Cancale', consigne: true, code: '700003', emailAt: Z('11-05T17:00'), receivedAt: Z('11-05T17:01'), arriveLe: Z('11-05T17:00'), limite: '2026-11-10' });
  const c3 = ligneSms('Votre colis 81000003 est disponible au LOCKER 24/7 SUPER U. Retirez-le vite avec le code 711113. Détails sur l\'app mrcolis.fr', Z('11-05T17:05'), c3mail.data);
  const c16 = ligneSms('Votre colis 81000016 est disponible au LOCKER 24/7 INTERMARCHÉ. Retirez-le vite avec le code 716161. Détails sur l\'app mrcolis.fr', Z('11-05T09:00'));
  LIGNES = [
    { id: 'main', data: { vrm_ville: 'Cancale' } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: ACHATS } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
    { id: 'panel_colis_relais', data: { 9100005: { tx: '9100005', code: '', lieu: 'TABAVAP, TABAVAP, 29 RUE HOCHE, 56000 VANNES', at: Z('11-04T15:00'), arriveLe: Z('11-04T15:00'), transporteur: '', qr: '', titre: '', conv: '' } } },
    // C1 — « disponible » à 09 h 50 (Paris) ; le transporteur relu à 08 h 07 disait « en route ».
    mr('81000001', { lieu: MAISON, code: '700001', emailAt: Z('11-06T07:50'), receivedAt: Z('11-06T07:51'), arriveLe: Z('11-06T07:50'), limite: '2026-11-11' }),
    transp('mondialrelay', '81000001', { etat: 'en_route', etatAt: Z('11-06T05:32'), lu: Z('11-06T07:07'), libelle: 'Colis en route vers le point de livraison', cp: '35260' }),
    // C2 — « en route » daté 6 h APRÈS l'arrivée.
    mr('81000002', { lieu: MAISON, code: '700002', emailAt: Z('11-05T09:00'), receivedAt: Z('11-05T09:01'), arriveLe: Z('11-05T09:00'), limite: '2026-11-10' }),
    transp('mondialrelay', '81000002', { etat: 'en_route', etatAt: Z('11-05T15:00'), lu: Z('11-05T16:00'), libelle: 'Colis en route vers le point de livraison', cp: '35260' }),
    // C3 — e-mail + SMS (codes différents) du même casier.
    { id: c3mail.id, data: c3.data },
    // C4 — retiré hier ; la relance « Le temps file » arrive ce matin.
    mr('81000004', { lieu: MAISON, code: '700004', subject: 'Le temps file : votre colis vous attend avec impatience ⏳', emailAt: Z('11-06T06:00'), receivedAt: Z('11-06T06:01'), arriveLe: Z('11-03T09:00'), limite: '2026-11-08' }),
    transp('mondialrelay', '81000004', { etat: 'retire', fini: true, etatAt: Z('11-05T17:00'), lu: Z('11-05T18:00'), libelle: 'Colis livré au destinataire', cp: '35260' }),
    // C5 — S10 irlandais : suivi Vinted sans transporteur, ligne Chronopost d'une ancienne devinette abandonnée.
    suiviVinted(9100005, 'CP123456785IE', { dernier: { t: 'Disponible pour retrait', at: Z('11-04T15:00') }, etapes: [{ t: 'Disponible pour retrait', at: Z('11-04T15:00') }] }),
    { id: 'transp_chronopost_CP123456785IE', data: { v: 1, rev: 3, carrier: 'chronopost', suivi: 'CP123456785IE', fini: true, essaiRes: 'introuvable', essais: 3, essai: Z('11-05T10:00'), essaiSource: 'serveur', voie: 'cp-ws2' } },
    // C6 — le comptoir SUPER U (pas le casier).
    mr('81000006', { lieu: 'SUPER U, Rue de la Bretonnière, 35260 Cancale', code: '700006', emailAt: Z('11-05T11:00'), receivedAt: Z('11-05T11:01'), arriveLe: Z('11-05T11:00'), limite: '2026-11-10' }),
    // C7-C9 — Tabavap écrit trois façons ; C10 — un Tabavap à Rennes.
    mr('81000007', { lieu: "TABA'VAP, 29 Rue Hoche, 56000 Vannes", code: '700007', emailAt: Z('11-05T12:00'), receivedAt: Z('11-05T12:01'), arriveLe: Z('11-05T12:00'), limite: '2026-11-10' }),
    mr('81000008', { lieu: 'TABAVAP, TABAVAP, 29 RUE HOCHE, 56000 VANNES', code: '700008', emailAt: Z('11-05T12:10'), receivedAt: Z('11-05T12:11'), arriveLe: Z('11-05T12:10'), limite: '2026-11-10' }),
    mr('81000009', { lieu: 'Tabavap 29 Rue Hoche', code: '700009', emailAt: Z('11-05T12:20'), receivedAt: Z('11-05T12:21'), arriveLe: Z('11-05T12:20'), limite: '2026-11-10' }),
    mr('81000010', { lieu: 'TABAVAP, 12 RUE NATIONALE, 35000 RENNES', code: '700010', emailAt: Z('11-05T12:30'), receivedAt: Z('11-05T12:31'), arriveLe: Z('11-05T12:30'), limite: '2026-11-10' }),
    // C11 — arrivé le 2, reparti chez l'expéditeur le 5 (lu chez le transporteur).
    mr('81000011', { lieu: MAISON, code: '700011', emailAt: Z('11-02T09:00'), receivedAt: Z('11-02T09:01'), arriveLe: Z('11-02T09:00'), limite: '2026-11-07' }),
    transp('mondialrelay', '81000011', { etat: 'retour_expediteur', etatAt: Z('11-05T08:00'), lu: Z('11-05T09:00'), libelle: 'Colis en retour vers l’expéditeur', cp: '35260' }),
    // C12 — l'achat est annulé ; sa moitié Vinted « t'attend » (relié par la conversation).
    vintedHalf(uuid(12), { titre: 'Achat annulé C12', lieu: MAISON, at: Z('11-04T10:00') }),
    // C13 — une moitié Vinted sans achat relu, au point du C1, le même jour.
    vintedHalf(uuid(13), { titre: 'Baskets C13', lieu: MAISON, at: Z('11-06T08:06') }),
    // C14 — e-mail GARDÉ, lien de suivi base64, achat finalisé.
    garde('c14aa1', { titre: 'Achat finalisé C14', lieu: 'PHONE TEST, 17 RUE THIERS, 56000 VANNES', conv: uuid(14), at: Z('10-28T10:00') }),
    // C15 — e-mail GARDÉ relié à un achat déposé (n° Mondial Relay relevé, aucun e-mail du transporteur).
    garde('c15aa1', { titre: 'Achat déposé C15', lieu: 'TERRA TEST, 11 RUE HOCHE, 56000 VANNES', conv: uuid(15), at: Z('11-05T10:00') }),
    suiviVinted(9100015, '81000015', { transporteur: 'mondialrelay', dernier: { t: 'Disponible pour retrait', at: Z('11-05T09:58') }, etapes: [{ t: 'Disponible pour retrait', at: Z('11-05T09:58') }] }),
    // C16 — un SMS seul (aucune date limite).
    c16,
    // C18 — vieux « t'attend » à Vannes ; l'achat porte un n° que Vinted Go dit retiré.
    vintedHalf(uuid(18), { titre: 'Achat Vinted Go C18', lieu: 'KUSMI TEST, 13 Rue Saint-Vincent, 56000 Vannes', at: Z('10-25T10:00') }),
    suiviVinted(9100018, '1789000000000018', { transporteur: 'vinted', dernier: { t: 'Disponible pour retrait', at: Z('10-25T09:58') }, etapes: [{ t: 'Disponible pour retrait', at: Z('10-25T09:58') }] }),
    transp('vinted', '1789000000000018', { etat: 'retire', fini: true, etatAt: Z('10-27T16:00'), lu: Z('10-27T17:00'), libelle: 'Colis récupéré', lieuNom: 'Kusmi Test', lieuRue: '13 Rue Saint-Vincent', lieuVille: 'Vannes' }),
    // C19 — a quitté le point relais sans être retiré.
    mr('81000019', { lieu: MAISON, code: '700019', emailAt: Z('11-05T08:00'), receivedAt: Z('11-05T08:01'), arriveLe: Z('11-05T08:00'), limite: '2026-11-10' }),
    transp('mondialrelay', '81000019', { etat: 'incident', detail: 'quitte_relais', etatAt: Z('11-05T18:00'), lu: Z('11-05T19:00'), libelle: 'Le colis a quitté le Point Relais', cp: '35260' }),
    // C20 — limite lue 27/11 ; le transporteur déduit « vers le 11/11 ».
    mr('81000020', { lieu: MAISON, code: '700020', emailAt: Z('11-06T07:52'), receivedAt: Z('11-06T07:53'), arriveLe: Z('11-06T07:52'), limite: '2026-11-27' }),
    transp('mondialrelay', '81000020', { etat: 'disponible', etatAt: Z('11-06T07:41'), lu: Z('11-06T08:00'), libelle: '5 jours restants pour retirer le colis en Point Relais', limite: '2026-11-11', limiteSure: false, cp: '35260' }),
  ];
}

// ── Le serveur et la base (PostgREST minimal : projection, id eq/like/in, is.null) ──
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre, tab) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data && r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => ((r.data || {})[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lks = [...u.matchAll(/[?&]id=like\.([^&]*)/g)];
    if (lks.length) { const res = lks.map((lk) => new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); return j(LIGNES.filter((r) => res.every((re) => re.test(r.id)) && passe(r)).map(forme)); }
    const ors = /[?&]or=\(([^&]*)\)/.exec(u);
    if (ors) { const pats = [...ors[1].matchAll(/id\.like\.([^,)]*)/g)].map((m) => new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); if (pats.length) return j(LIGNES.filter((r) => pats.some((re) => re.test(r.id)) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

// ── Ce que l'écran montre, colis par colis ──────────────────────────────────────
const lireEcran = (pg) => pg.evaluate(() => {
  for (const d of document.querySelectorAll('details[data-rp-section]')) d.open = true;
  const pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null');
  const lignes = [...document.querySelectorAll('.vrm-rpf [data-cc-carte]')].map((l) => {
    const pt = l.closest('[data-relais-point],[data-relais-point-suite]');
    return { cle: l.getAttribute('data-cc-carte'), section: (l.closest('[data-rp-section]') || { getAttribute: () => '' }).getAttribute('data-rp-section'),
      point: pt ? (pt.getAttribute('data-relais-point') || pt.getAttribute('data-relais-point-suite')) : '', tr: l.getAttribute('data-transporteur') || '', raison: l.getAttribute('data-a-verifier-raison') || '',
      hors: l.hasAttribute('data-hors-compte'), code: ((l.querySelector('[data-code-retrait]') || { getAttribute: () => '' }).getAttribute('data-code-retrait')) || '', titre: ((l.querySelector('[data-rp-titre]') || {}).textContent || '').trim() };
  });
  const noms = Object.fromEntries([...document.querySelectorAll('[data-relais-point]')].map((p) => [p.getAttribute('data-relais-point'), ((p.querySelector('.vrm-rpf-nom') || {}).textContent || '').trim()]));
  return { pub, lignes, noms, repartis: [...document.querySelectorAll('[data-reparti-suivi],[data-reparti-tx]')].map((e) => e.getAttribute('data-reparti-suivi') || e.getAttribute('data-reparti-tx')),
    doubleExpl: (document.querySelector('[data-double-explication]') || { textContent: '' }).textContent, deb: document.documentElement.scrollWidth - window.innerWidth };
});
const detail = async (pg, sousCle) => {
  const l = pg.locator(`.vrm-rpf [data-cc-carte*="${sousCle}"]`).first();
  if (!(await l.count())) return null;
  const ouvert = await l.getAttribute('data-ouvert');
  if (!ouvert) await l.locator('.vrm-rpf-ouvrir').first().click({ timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(250);
  return l.evaluate((e) => { const d = e.querySelector('[data-rp-detail]') || e;
    const tr = d.querySelector('[data-transp]'); const lim = d.querySelector('[data-colis-limite]');
    return { transp: tr ? tr.getAttribute('data-transp') : null, transpEtat: tr ? tr.getAttribute('data-transp-etat') : null, transpTexte: tr ? tr.textContent : '', limite: lim ? lim.getAttribute('data-colis-limite') : null, estimee: lim ? lim.getAttribute('data-colis-limite-estimee') : null, limTexte: lim ? lim.textContent : '',
      codeSms: (d.querySelector('[data-colis-code-sms]') || { getAttribute: () => null }).getAttribute('data-colis-code-sms'), texte: d.innerText.replace(/\s+/g, ' ').slice(0, 600) }; });
};

(async () => {
  await fabriquer();
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n— Colis → À retirer, statut colis par colis · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'cat_bord');
      await essaie('retirer', async () => {
        await pg.locator('[data-colis-onglet-choix="retirer"]').first().waitFor({ timeout: 40000 });
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        await pg.locator('[data-colis-onglet-choix="retirer"]').first().click();
        await pg.waitForTimeout(2500);
        const m = await lireEcran(pg);
        const L = (s) => m.lignes.filter((l) => l.cle.includes(s));
        const une = (s) => { const x = L(s); return x.length === 1 ? x[0] : null; };
        const sec = (s) => { const x = L(s); return x.length ? x.map((l) => l.section).join(',') : 'absent'; };
        const J = (o) => JSON.stringify(o);
        // C1
        { const x = une('81000001'); dit(!!x && x.section !== 'verifier' && x.section !== 'double' && !x.hors && x.code === '700001', 'C1 e-mail « disponible » + lecture « en route » plus vieille ⇒ à retirer, code 700001', J(L('81000001'))); }
        // C2
        { const x = une('81000002'); dit(!!x && x.section === 'verifier' && x.hors, 'C2 « en route » daté APRÈS l’arrivée ⇒ à vérifier (jamais compté)', J(L('81000002'))); }
        // C3
        { const x = L('81000003'); dit(x.length === 1 && x[0].section !== 'verifier' && x[0].code === '700003' && /casier/.test(x[0].point), 'C3 e-mail + SMS du même n° ⇒ UNE ligne au casier, le code de l’e-mail (700003)', J(x)); }
        // C4
        dit(L('81000004').length === 0 && !m.repartis.includes('81000004'), 'C4 retiré, puis relance « Le temps file » ⇒ fini (aucune ligne)', sec('81000004'));
        // C5
        { const x = L('9100005'); dit(x.length === 1 && x[0].tr !== 'chronopost' && !x[0].hors && /^tabavap\|56000/.test(x[0].point), 'C5 colis postal irlandais ⇒ à retirer à Tabavap (Vannes), transporteur PAS « Chronopost »', J(x)); }
        // C6
        { const a = une('81000006'), c = une('81000003'); dit(!!a && !!c && a.point && c.point && a.point !== c.point && /casier/.test(c.point) && !/casier/.test(a.point), 'C6 le casier et le comptoir « Super U » ⇒ deux cartes', J({ comptoir: a && a.point, casier: c && c.point })); }
        // C7-C9 / C10
        { const p = ['81000007', '81000008', '81000009'].map((s) => (une(s) || {}).point); const r = (une('81000010') || {}).point;
          dit(p.every(Boolean) && new Set(p).size === 1 && /^tabavap\|56000/.test(p[0]), 'C7-C9 un point écrit trois façons ⇒ UNE carte (Tabavap, 56000)', J(p));
          dit(!!r && r !== p[0] && /35000/.test(r), 'C10 le même nom à Rennes ⇒ une autre carte', J({ rennes: r, vannes: p[0] })); }
        { const n = m.lignes.filter((l) => /^tabavap\|56000/.test(l.point)).length; dit(n === 4, 'la carte Tabavap (Vannes) porte ses 4 colis (C5, C7, C8, C9)', String(n)); }
        // C11
        dit(L('81000011').every((l) => l.section !== 'prets' && l.section !== 'avenir' && l.section !== 'aujourdhui') && m.repartis.includes('81000011'), 'C11 retour à l’expéditeur ⇒ « Argent à vérifier », jamais à retirer', J({ lignes: sec('81000011'), repartis: m.repartis }));
        // C12
        dit(L(String(12).padStart(12, '0')).every((l) => l.hors || l.section === 'verifier') && !m.lignes.some((l) => /C12/.test(l.titre) && !l.hors), 'C12 achat annulé ⇒ pas à retirer', J(L(String(12).padStart(12, '0'))));
        // C13
        { const x = L(String(13).padStart(12, '0')); dit(x.length === 1 && x[0].section === 'double' && x[0].hors, 'C13 moitié Vinted sans identité au point d’un colis Mondial Relay ⇒ « peut-être en double », hors compte', J(x));
          dit(/sans rien qui les relie/.test(m.doubleExpl) && /ne compte(nt)? pas/.test(m.doubleExpl), '« Peut-être en double » est expliqué une fois (le fait, pourquoi, le geste)', m.doubleExpl.slice(0, 160)); }
        // C14
        dit(!m.lignes.some((l) => /C14/.test(l.titre) || /c14|Phone Test/i.test(l.point)) && !m.lignes.some((l) => l.raison === 'trop_long' && /phonetest/.test(l.point)), 'C14 e-mail Vinted gardé (lien base64) d’un achat FINALISÉ ⇒ fini, ni « à vérifier » ni « en double »', J(m.lignes.filter((l) => /C14/.test(l.titre) || /phonetest/.test(l.point))));
        // C15
        { const x = m.lignes.filter((l) => /C15/.test(l.titre) || /terratest/.test(l.point)); dit(x.length === 1 && !x[0].hors && /Achat déposé C15/.test(x[0].titre), 'C15 e-mail Vinted gardé relié à son achat « déposé » ⇒ UNE ligne comptée, au titre de l’achat', J(x)); }
        // C18
        dit(!m.lignes.some((l) => /kusmitest/.test(l.point)), 'C18 vieux « t’attend » dont l’achat porte un n° retiré chez Vinted Go ⇒ fini (sort de « à vérifier »)', J(m.lignes.filter((l) => /kusmitest/.test(l.point))));
        // C19
        { const x = une('81000019'); dit(!!x && x.section === 'verifier' && x.hors, 'C19 « a quitté le point relais » après l’arrivée ⇒ à vérifier', J(x)); }
        // Les nombres : à retirer = C1 C3 C5 C6 C7 C8 C9 C10 C15 C16 C20 = 11.
        dit(m.pub && m.pub.total === 11, 'vrm_colis_retirer.total = 11 (aucun fini, aucun doute, aucun « à vérifier » compté)', J(m.pub && { total: m.pub.total, aVerifier: m.pub.aVerifier }));
        dit(m.deb <= 1, 'rien ne déborde', `${m.deb}px`);
        if (SHOTS) { await pg.screenshot({ path: path.join(SHOTS, `statut-colis-${nom}.png`) }); await pg.screenshot({ path: path.join(SHOTS, `statut-colis-${nom}-long.png`), fullPage: true }); }
        // Les détails au toucher.
        { const d = await detail(pg, '81000001'); dit(!!d && d.transp === 'en-retard' && d.transpEtat === 'en_route' && /avant l’arrivée/.test(d.transpTexte), 'C1 la lecture « en route » est dite EN RETARD (« avant l’arrivée »), jamais l’état du colis', J(d && { transp: d.transp, t: d.transpTexte }));
          dit(!!d && d.limite === '2026-11-11', 'C1 date limite LUE dans l’e-mail (11/11)', d && d.limite);
          if (SHOTS && d) await pg.screenshot({ path: path.join(SHOTS, `statut-colis-detail-c1-${nom}.png`) }); }
        { const d = await detail(pg, '81000003'); dit(!!d && d.codeSms === '711113', 'C3 l’autre code du SMS est dit (l’e-mail fait foi)', d && d.codeSms); }
        { const d = await detail(pg, '9100005'); dit(!!d && d.limite === 'inconnue', 'C17 transporteur inconnu ⇒ « Date limite inconnue » (aucune garde prêtée)', J(d && { limite: d.limite, t: d.limTexte })); }
        { const d = await detail(pg, '81000016'); dit(!!d && d.limite === 'estimee' && d.estimee === '2026-11-10' && /estimé/.test(d.limTexte), 'C16 SMS sans date limite ⇒ « vers le 10/11 (estimé) », la garde de Mondial Relay (5 j)', J(d && { limite: d.limite, est: d.estimee, t: d.limTexte }));
          if (SHOTS && d) await pg.screenshot({ path: path.join(SHOTS, `statut-colis-detail-c16-${nom}.png`) }); }
        { const d = await detail(pg, '81000020'); dit(!!d && d.limite === '2026-11-27', 'C20 la limite LUE dans l’e-mail (27/11) gagne sur celle que le transporteur déduit (11/11)', d && d.limite); }
        { const d = await detail(pg, '81000002'); dit(!!d && /après/.test(d.texte) && /rien ne l’explique/.test(d.texte), 'C2 la raison de la contradiction est dite sur la ligne', d && d.texte.slice(0, 200)); }
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
