#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — DE BELLES NOTIFICATIONS, ET SEULEMENT CELLES QUI SERVENT (8 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (8 nov.) : « fais de belles notifications, là elles ne sont pas très
// belles et pas forcément utiles, des fois des infos qui servent à rien ».
// Ce banc EXÉCUTE la vraie porte d'envoi (`api/_lib/push.js`, `sendPushToAll`),
// la vraie fin de file des favoris (`api/_lib/favoris.js`), le vrai récapitulatif
// du réveil (`api/_lib/reveil-calme.js`) et le VRAI service worker (`public/sw.js`,
// dans une machine virtuelle) contre une fausse base (forme app_data
// owner/id/data, comparer-et-échanger sur `rev`), téléphones interceptés.
//   F  la forme : aucun emoji, titre ≤ 40 caractères, un fait coupé sur son
//      séparateur (rien perdu), icône v5 + badge monochrome, même texte dans la cloche
//   R  regroupement PAR GENRE, allumé par défaut : « 3 bordereaux prêts à imprimer »,
//      une étiquette par genre, l'écran de la liste ; pas su ⇒ aucun nombre ;
//      coupé ⇒ une étiquette par objet
//   C  heures calmes ALLUMÉES par défaut 22 h → 8 h (Paris, horloge simulée) ; la
//      double vente et ce qui expire avant 10 h sonnent ; un `actif:false` posé est gardé
//   U  le toucher (et l'action) ouvre l'écran EXACT — vrai service worker
//   I  la photo seulement prouvée (même e-mail), jamais sur un groupe
//   D  une information sans geste (file des favoris finie sans souci) : dans la
//      cloche, sans sonner ; avec un souci : elle sonne
//   X  aucune catégorie retirée ne part ; aucune famille refusée au §3 n'existe
//   W  le réveil : UNE notification gardée sonne telle quelle
// `--sur <dossier>` : juge un autre arbre (le code d'avant). Données inventées.
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const iSur = process.argv.indexOf('--sur');
const R = iSur > 0 ? path.resolve(process.argv[iSur + 1]) : path.join(__dirname, '..');
const NM = path.join(__dirname, '..', 'node_modules');
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 300)); } };
const J = '11111111-1111-4111-8111-111111111111';

// ── La fausse base (même forme que audit-notifs-centre) ────────────────────
let base = new Map(); let panne = new Set();
const k = (o, i) => o + '|' + i;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const q = u.searchParams; const m = (o.method || 'GET').toUpperCase();
  if (u.pathname.endsWith('/rpc/vrm_acces_pour')) return rep(true);
  if (!u.pathname.endsWith('/rest/v1/app_data')) return rep([]);
  const id = (q.get('id') || '').replace(/^eq\./, ''); const owner = (q.get('owner') || '').replace(/^eq\./, '');
  if (m === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep([{ owner: J }]);
    if (panne.has(id)) return rep('<html>522</html>', 522);
    if (!id || !owner) return rep([]);
    const d = base.get(k(owner, id));
    return rep(d === undefined ? [] : [{ id, data: d }]);
  }
  if (m === 'POST') {
    const ls = JSON.parse(o.body || '[]'); const ign = /ignore-duplicates/.test(((o.headers || {}).Prefer) || ''); const out = [];
    for (const l of ls) { if (ign && base.has(k(l.owner, l.id))) continue; base.set(k(l.owner, l.id), JSON.parse(JSON.stringify(l.data))); out.push({ id: l.id }); }
    return rep(out, 201);
  }
  if (m === 'PATCH') {
    const kk = k(owner, id); if (!owner || !base.has(kk)) return rep([]);
    const d = base.get(kk); const rev = q.get('data->>rev');
    if (rev === 'is.null' ? d.rev != null : rev && String(d.rev) !== rev.replace(/^eq\./, '')) return rep([]);
    base.set(kk, JSON.parse(o.body).data); return rep([{ id }]);
  }
  return rep([]);
};
const pushes = [];
const TEL = 'https://web.push.apple.com/iphone-banc';
const prepare = (prefs = null, lu = {}) => {
  base = new Map(); pushes.length = 0; panne = new Set();
  base.set(k(J, 'push_subs'), { subs: [{ endpoint: TEL, keys: { p256dh: 'x', auth: 'y' } }] });
  if (prefs) base.set(k(J, 'push_prefs'), prefs);
  if (lu) base.set(k(J, 'push_journal_lu'), lu);
};
const journal = () => (base.get(k(J, 'push_journal')) || { entrees: [] });
// Un instant de Paris (heure locale `hh:mm`) aujourd'hui, en ISO — calculé ICI.
const parisA = (hh, mm = 0, jours = 0) => {
  const now = Date.now() + jours * 864e5;
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  for (const dec of [1, 2]) { const t = Date.parse(`${jour}T${String((hh - dec + 24) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`); const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t)); if (p === `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`) return new Date(t).toISOString(); }
  return null;
};
const EMOJI = /\p{Extended_Pictographic}/u;

(async () => {
  process.env.VRM_OWNER_UID = J;
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
  const webpush = require(path.join(NM, 'web-push'));
  webpush.sendNotification = async (sub, body) => { pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
  const P = await import('file://' + path.join(R, 'api', '_lib', 'push.js'));
  const T = await import('file://' + path.join(R, 'api', '_lib', 'notif-textes.js'));
  const L = await import('file://' + path.join(R, 'api', '_lib', 'lien-notif.js'));
  const { contexteVendeur } = await import('file://' + path.join(R, 'api', '_lib', 'owner.js'));
  const comme = (f) => { P.oublierPrefsVues(); return contexteVendeur.run({ owner: J }, f); };
  const midi = parisA(12), nuit = parisA(23);
  const aHeure = async (iso, f) => { const av = process.env.VRM_NOTIF_HORLOGE; process.env.VRM_NOTIF_HORLOGE = iso; try { return await f(); } finally { if (av === undefined) delete process.env.VRM_NOTIF_HORLOGE; else process.env.VRM_NOTIF_HORLOGE = av; } };
  const VENTE = (tx) => ({ cat: 'vente', title: '💸 Vendu !', body: `Baskets de banc — 40 € (compte A)`, tag: `sale-${tx}`, url: L.DESTINATIONS.vente({ tx }) });
  const BORD = (tx) => ({ cat: 'expedier', title: '📦 Bordereau prêt à imprimer', body: `Air Max de banc — N°1${tx} : déjà tamponné — à expédier avant le 12/11.`, tag: `bord-${tx}`, url: L.DESTINATIONS.colis({ tx }) });
  const DV = { cat: 'doublevente', title: '⚠️ N°12 vendu sur Vinted · encore en ligne sur Leboncoin', body: 'Baskets de banc', tag: 'dv-12', url: L.DESTINATIONS.doublon({ plat: 'leboncoin', num: '12' }) };

  await essaie('F — la forme', () => aHeure(midi, async () => {
    prepare();
    await comme(() => P.sendPushToAll(DV));
    const p = pushes[0] || {};
    dit(p.title && !EMOJI.test(p.title + p.body) && p.title.length <= 40, 'F1 aucun emoji, titre ≤ 40 caractères', JSON.stringify(p.title));
    dit(p.title === 'N°12 vendu sur Vinted' && /^Encore en ligne sur Leboncoin · Baskets de banc$/.test(p.body || ''), 'F2 le fait trop long est coupé sur son séparateur : rien n’est perdu (« Leboncoin » descend dans le corps)', `${p.title} / ${p.body}`);
    dit(p.icon === '/vrm-icon-v5-192.png' && p.badge === '/vrm-badge-96.png' && fs.existsSync(path.join(R, 'public', 'vrm-badge-96.png')), 'F3 icône v5 et badge monochrome 96 px (fichier présent)');
    const e = journal().entrees[0] || {};
    dit(e.titre === p.title && e.texte === p.body, 'F4 la cloche range le MÊME texte que le téléphone', JSON.stringify([e.titre, e.texte]));
  }));

  await essaie('R — regroupement par genre', () => aHeure(midi, async () => {
    prepare(null, {});
    for (const tx of ['901', '902', '903']) await comme(() => P.sendPushToAll(BORD(tx)));
    const [a, , c] = pushes;
    dit(pushes.length === 3 && a.tag === 'bord-901' && a.genre === 'bordereau' && !a.tagGroupe && c.tagGroupe === 'vrm-bordereau' && c.genre === 'bordereau', 'R1 seule, elle garde l’étiquette de SON colis ; à plusieurs, l’étiquette du genre « bordereau » (le téléphone n’en montre qu’une)', pushes.map((x) => x.tagGroupe || x.tag).join(','));
    dit(a.title === 'Bordereau prêt à imprimer' && a.url === L.DESTINATIONS.colis({ tx: '901' }), 'R2 la première reste elle-même (son colis)', `${a.title} ${a.url}`);
    dit(c.title === '3 bordereaux prêts à imprimer' && c.url === L.DESTINATIONS.colis({}) && /^Dernier : Air Max de banc/.test(c.body), 'R3 la troisième dit « 3 bordereaux prêts à imprimer » et ouvre la LISTE des prêts', `${c.title} | ${c.body} | ${c.url}`);
    dit(c.renotify === true, 'R4 un fait nouveau re-sonne (renotify)');
    prepare(null, {}); panne.add('push_journal_lu');
    for (const tx of ['911', '912']) await comme(() => P.sendPushToAll(BORD(tx)));
    dit(pushes[1] && pushes[1].title === 'Bordereau prêt à imprimer', 'R5 « lu » illisible : aucun nombre inventé, la notification reste seule', pushes[1] && pushes[1].title);
    prepare({ regrouper: false }, {});
    for (const tx of ['921', '922']) await comme(() => P.sendPushToAll(BORD(tx)));
    dit(pushes.map((x) => x.tagGroupe || x.tag).join(',') === 'bord-921,bord-922' && pushes[1].title === 'Bordereau prêt à imprimer' && !pushes.some((x) => x.genre), 'R6 regroupement coupé à la main : une étiquette PAR OBJET', pushes.map((x) => x.tagGroupe || x.tag).join(','));
    prepare(null, {});
    await comme(() => P.sendPushToAll(VENTE('931'))); await comme(() => P.sendPushToAll(BORD('932')));
    dit(pushes[1] && !pushes[1].tagGroupe && pushes[1].title === 'Bordereau prêt à imprimer', 'R7 deux genres différents ne se comptent pas ensemble');
  }));

  await essaie('C — heures calmes', async () => {
    prepare();
    const r = await aHeure(nuit, () => comme(() => P.sendPushToAll(VENTE('941'))));
    const e = journal().entrees[0] || {};
    dit(pushes.length === 0 && r.calme === true && e.etat === 'calme', 'C1 sans réglage, 23 h à Paris : rien ne sonne, rangée « heures calmes » dans la cloche', JSON.stringify(r));
    prepare();
    await aHeure(nuit, () => comme(() => P.sendPushToAll(DV)));
    dit(pushes.length === 1, 'C2 la double vente sonne quand même la nuit');
    prepare();
    await aHeure(nuit, () => comme(() => P.sendPushToAll({ cat: 'colis', title: 'Dernier jour · Tabac de banc', body: 'À retirer avant 9 h 30', tag: 'retrait-x1', url: L.DESTINATIONS.retrait({ suivi: '12345678' }), echeance: parisA(9, 30, 1) })));
    dit(pushes.length === 1, 'C3 ce qui expire avant 10 h le lendemain matin sonne la nuit');
    prepare();
    await aHeure(nuit, () => comme(() => P.sendPushToAll({ cat: 'colis', title: 'Dernier jour · Tabac de banc', body: 'À retirer avant 11 h', tag: 'retrait-x2', url: '/', echeance: parisA(11, 0, 1) })));
    dit(pushes.length === 0, 'C4 ce qui expire à 11 h attend le matin');
    prepare();
    await aHeure(parisA(7, 30), () => comme(() => P.sendPushToAll(VENTE('942'))));
    dit(pushes.length === 0, 'C5 7 h 30 : encore calme');
    prepare();
    await aHeure(parisA(8, 5), () => comme(() => P.sendPushToAll(VENTE('943'))));
    dit(pushes.length === 1, 'C6 8 h 05 : elle sonne');
    prepare({ calme: { actif: false } });
    await aHeure(nuit, () => comme(() => P.sendPushToAll(VENTE('944'))));
    dit(pushes.length === 1, 'C7 « heures calmes » coupées à la main : gardé, ça sonne la nuit');
  });

  await essaie('U — le toucher ouvre l’écran exact (vrai service worker)', () => aHeure(midi, async () => {
    prepare();
    await comme(() => P.sendPushToAll(BORD('951')));
    const p = pushes[0] || {};
    dit(p.url === L.DESTINATIONS.colis({ tx: '951' }) && Array.isArray(p.actions) && p.actions[0].url === p.url && p.actions[0].title === 'Imprimer', 'U1 la charge porte l’adresse du colis et une action « Imprimer » vers la même carte', JSON.stringify(p.actions));
    const ecoute = {}; const montrees = []; const ouvertes = [];
    const fermees = [];
    const ctx = { self: { addEventListener: (n, f) => { ecoute[n] = f; }, registration: { showNotification: async (t, o) => { montrees.push({ t, o }); }, getNotifications: async () => montrees.map((m) => ({ data: m.o.data, close: () => fermees.push(m.o.tag) })) }, skipWaiting() {} },
      clients: { matchAll: async () => [], openWindow: async (u) => { ouvertes.push(u); } }, caches: {}, URL, Response, fetch: async () => rep(''), atob: (s) => Buffer.from(s, 'base64').toString('binary'), console };
    vm.runInNewContext(fs.readFileSync(path.join(R, 'public', 'sw.js'), 'utf8'), ctx);
    const attente = []; const ev = (x) => ({ ...x, waitUntil: (pr) => attente.push(pr) });
    ecoute.push(ev({ data: { json: () => p, text: () => JSON.stringify(p) } }));
    await Promise.all(attente.splice(0));
    const m = montrees[0] || { o: {} };
    dit(m.t === p.title && m.o.badge === '/vrm-badge-96.png' && m.o.tag === p.tag && m.o.actions && m.o.actions[0].title === 'Imprimer', 'U2 le service worker montre titre, badge, étiquette et action', JSON.stringify(m.o.actions));
    const attendu = p.url + '&notif=' + p.notif;
    ecoute.notificationclick(ev({ action: '', notification: { close() {}, data: m.o.data } }));
    ecoute.notificationclick(ev({ action: 'voir', notification: { close() {}, data: m.o.data } }));
    await Promise.all(attente.splice(0));
    dit(ouvertes[0] === attendu && ouvertes[1] === attendu, 'U3 toucher ET action ouvrent la carte du colis (avec le n° de la cloche)', JSON.stringify(ouvertes));
    ecoute.push(ev({ data: { json: () => ({ ...p, url: 'https://ailleurs.example/x', actions: [{ action: 'voir', title: 'x', url: '//ailleurs.example' }] }) } }));
    await Promise.all(attente.splice(0));
    ecoute.notificationclick(ev({ action: 'voir', notification: { close() {}, data: montrees[1].o.data } }));
    await Promise.all(attente.splice(0));
    dit(/^\/(\?|$)/.test(ouvertes[2] || ''), 'U4 une adresse hors de l’app n’est jamais ouverte', ouvertes[2]);
    // U5 : un groupe ferme les notifications du même genre déjà affichées.
    ecoute.push(ev({ data: { json: () => ({ ...p, title: '2 bordereaux prêts à imprimer', tagGroupe: 'vrm-bordereau', genre: 'bordereau' }) } }));
    await Promise.all(attente.splice(0));
    const g = montrees[montrees.length - 1];
    dit(g.o.tag === 'vrm-bordereau' && fermees.includes(p.tag), 'U5 le groupe prend l’étiquette du genre et ferme la notification seule du même genre', JSON.stringify(fermees));
  }));

  await essaie('I — la photo prouvée', () => aHeure(midi, async () => {
    const PH = 'https://images1.vinted.net/t/banc-photo-001/f800/1.jpeg';
    prepare(null, {});
    await comme(() => P.sendPushToAll({ ...VENTE('961'), photo: { url: PH, preuve: 'meme-email' } }));
    dit(pushes[0] && pushes[0].image === PH, 'I1 la photo de l’e-mail de CETTE vente part');
    prepare(null, {});
    await comme(() => P.sendPushToAll({ ...VENTE('962'), photo: { url: PH, preuve: 'titre' } }));
    await comme(() => P.sendPushToAll({ ...VENTE('963'), image: PH }));
    await comme(() => P.sendPushToAll({ ...VENTE('964'), photo: { url: 'https://ailleurs.example/t/x.jpeg', preuve: 'meme-email' } }));
    dit(pushes.every((x) => !x.image), 'I2 retrouvée par titre, posée nue ou d’un autre serveur : aucune image', JSON.stringify(pushes.map((x) => x.image || null)));
    dit(pushes[2] && /^3 ventes$/.test(pushes[2].title), 'I3 et le groupe « 3 ventes » ne porte la photo d’aucune', pushes[2] && pushes[2].title);
    const src = fs.readFileSync(path.join(R, 'api', 'email-inbound.js'), 'utf8').replace(/\/\/.*$/gm, '');
    dit(/texteVendu\([^)]*\)[^;]*photo:\s*\{\s*url:\s*data\.photo,\s*preuve:\s*'meme-email'/.test(src), 'I4 l’e-mail de vente passe SA photo (photoVenteEmail du même e-mail)');
  }));

  await essaie('D — une info sans geste ne sonne pas', () => aHeure(midi, async () => {
    const F = await import('file://' + path.join(R, 'api', '_lib', 'favoris.js'));
    const fin = F.notifierFinFavoris || null;
    const src = fs.readFileSync(path.join(R, 'api', '_lib', 'favoris.js'), 'utf8');
    dit(/discret\s*=\s*!interrompue&&!incertains&&!interrompus/.test(src.replace(/\s+/g, '')) || /discret=!interrompue&&!incertains&&!interrompus/.test(src.replace(/\s+/g, '')), 'D0 la fin de file des favoris décide « discret » sur les seuls soucis');
    prepare();
    const r = await comme(() => P.sendPushToAll({ cat: 'favoris', title: '✅ Messages aux favoris : file terminée', body: '5 messages envoyés sur 5.', tag: 'favoris-file-1', url: '/', discret: true }));
    const e = journal().entrees[0] || {};
    dit(pushes.length === 0 && r.discret && e.etat === 'discret', 'D1 « discret » : rangée dans la cloche, ne sonne pas', JSON.stringify(r));
    void fin;
    const sr = fs.readFileSync(path.join(R, 'api', 'ship-reminders.js'), 'utf8').replace(/\/\/.*$/gm, '');
    dit((sr.match(/envoyer:\s*\(notif\)\s*=>\s*sendPushToAll\(\{\s*\.\.\.notif,\s*cat:\s*'signalement'\s*\}\)/g) || []).length === 2, 'D2 la veille des plantages et des lenteurs porte une catégorie : rangée dans la cloche, soumise aux heures calmes (plus de « VRM » à 6 h)');
  }));

  await essaie('X — retirées et refusées', () => aHeure(midi, async () => {
    for (const cat of ['suivi', 'achat', 'favori', 'agentebay']) {
      prepare({ [cat]: true });
      await comme(() => P.sendPushToAll({ cat, title: 'x', body: 'y', tag: cat + '-1', url: '/' }));
      dit(pushes.length === 0, `X1 « ${cat} » (retirée) ne part pas, même allumée avant`);
    }
    const cats = Object.keys(T.FAMILLE_DE).join(' ');
    dit(!/evaluation|avis|sansreponse|bloque|jamais|retard/i.test(cats), 'X2 aucune famille refusée le 11 oct. (évaluation, messages sans réponse, argent bloqué, achat jamais arrivé)', cats);
    const api = fs.readdirSync(path.join(R, 'api', '_lib')).map((f) => path.join(R, 'api', '_lib', f)).concat(fs.readdirSync(path.join(R, 'api')).filter((f) => f.endsWith('.js')).map((f) => path.join(R, 'api', f)));
    const fautif = api.filter((f) => /\.js$/.test(f)).filter((f) => /title:\s*[`'"][^`'"]*(évaluation à laisser|sans réponse depuis|argent bloqué|jamais arrivé)/i.test(fs.readFileSync(f, 'utf8')));
    dit(!fautif.length, 'X3 aucun texte de notification de ces familles dans api/', fautif.join(','));
  }));

  await essaie('W — le réveil', async () => {
    const W = await import('file://' + path.join(R, 'api', '_lib', 'reveil-calme.js'));
    const t = Date.parse(parisA(8, 10));
    const une = { seq: 4, at: new Date(t - 3 * 3600e3).toISOString(), famille: 'arrives', cat: 'colis', titre: 'Ton colis Mondial Relay t’attend', texte: 'Tabac de banc · code 454602', url: '/?tab=cat_bord&cible=retrait&suivi=12345678', etat: 'calme' };
    const r1 = W.resumeReveil({ prefs: {}, journal: { entrees: [une] }, lu: {}, dejaJour: null, maintenant: t });
    dit(r1.envoyer && r1.title === une.titre && r1.url === une.url, 'W1 sans réglage (calme par défaut), UNE gardée : elle sonne telle quelle, sur son colis', JSON.stringify(r1));
    const r2 = W.resumeReveil({ prefs: {}, journal: { entrees: [une, { ...une, seq: 5, famille: 'ventes', cat: 'vente' }] }, lu: {}, dejaJour: null, maintenant: t });
    dit(r2.envoyer && /^Cette nuit : 2 notifications$/.test(r2.title) && r2.title.length <= 40, 'W2 plusieurs : « Cette nuit : 2 notifications »', r2.title);
  });

  await essaie('K — la cloche dit la même chose, regroupée pareil', async () => {
    const SN = await import('file://' + path.join(R, 'src', 'journalNotifs.js'));
    const t0 = Date.parse('2026-11-08T10:00:00Z');
    const brut = { entrees: [
      { seq: 3, at: new Date(t0).toISOString(), famille: 'poster', cat: 'expedier', genre: 'bordereau', titre: '📦 Bordereau prêt à imprimer', texte: 'A', url: '/?tab=cat_bord', etat: 'envoyee' },
      { seq: 2, at: new Date(t0 - 6e5).toISOString(), famille: 'ventes', cat: 'vente', genre: 'vente', titre: '💸 Vendu !', texte: 'B', url: '/?tab=ventes', etat: 'envoyee' },
      { seq: 1, at: new Date(t0 - 9e5).toISOString(), famille: 'poster', cat: 'expedier', genre: 'bordereau', titre: '📦 Bordereau prêt à imprimer', texte: 'C', url: '/?tab=cat_bord', etat: 'envoyee' },
    ] };
    const l = SN.entreesDuJournal(brut);
    dit(l.every((e) => !EMOJI.test(e.titre)), 'K1 une entrée rangée avant le 8 nov. perd ses emoji dans la cloche', l.map((e) => e.titre).join(' | '));
    const g = SN.regrouperLignes(l);
    dit(g.length === 2 && g[0].groupe && g[0].titre === '2 bordereaux prêts à imprimer' && g[0].items.length === 2 && g[1].seq === 2, 'K2 deux bordereaux du jour : UNE ligne « 2 bordereaux prêts à imprimer », dépliable ; la vente reste seule', JSON.stringify(g.map((x) => x.titre || x.seq)));
    dit(SN.quandRelatif(t0 - 5 * 60e3, t0) === 'Il y a 5 min' && SN.quandRelatif(t0 - 30e3, t0) === 'À l’instant', 'K3 l’heure dite comme un téléphone');
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
