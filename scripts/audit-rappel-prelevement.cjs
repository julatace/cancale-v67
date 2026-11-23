#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — ABONNEMENT SANS SURPRISE : LE RAPPEL 3 JOURS AVANT CHAQUE PRÉLÈVEMENT (16 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Validé par Julien : « aucune mauvaise surprise sur l'abonnement ». Ce banc EXÉCUTE (§4.10)
// la vraie route du cron du matin (`api/ship-reminders.js`), la vraie passe
// (`api/_lib/rappel-prelevement.js`), le vrai client SMTP contre un faux serveur SMTP local,
// la vraie notification (`sendPushToAll` : rangée dans le centre `push_journal` du vendeur)
// et la vraie route `api/compte.js?mode=abonnement`, contre une fausse base ET un FAUX STRIPE
// (abonnements, aperçu de facture) servis à la vraie forme (API « dahlia » : la fin de période
// sur l'ARTICLE, `invoices/create_preview` en POST).
//   K  sans STRIPE_SECRET_KEY : rien n'est lu chez Stripe, rien ne part, le cron le dit ;
//      la route d'abonnement dit l'état du rappel (Paramètres le montre)
//   R  le rappel : 3 jours avant (jours de Paris), le montant et la date LUS chez Stripe
//      (remise comprise : jamais le prix catalogue), le plan nommé, « Gérer · Résilier »,
//      notification ET e-mail (envoi configuré) ; fin d'essai : « ton essai se termine »
//   Q  à qui jamais : résilié (`cancel_at_period_end` chez Stripe, même si la base ne le sait
//      pas encore), propriétaire, mode test, abonnement d'un autre client, à plus de 3 jours
//   P  « pas su » : aperçu illisible ou autre devise ⇒ rien ne part (aucun montant deviné) ;
//      Stripe muet ⇒ rien
//   U  une fois par prélèvement (relancé le même jour, le lendemain) ; sans envoi d'e-mails
//      configuré ⇒ la notification seule ; réservation non confirmée ⇒ rien
//   E  la fin d'essai ne double plus : l'e-mail « se termine demain » de l'essai ne part plus
//      pour un essai qui sera prélevé (le rappel l'a dit 3 jours avant) ; il reste pour un
//      essai résilié (« ton accès se ferme demain »)
// Données inventées (le dépôt est public).
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const path = require('path');
const net = require('net');
const R = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 500)); } };

const JULIEN = '11111111-1111-4111-8111-111111111111';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';      // Solo, renouvelé dans 3 jours, remise de 2 €
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';      // Pro, en essai, l'essai finit dans 3 jours
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';      // résilié chez Stripe (la base pas encore)
const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';      // en mode test
const F = 'ffffffff-ffff-4fff-8fff-ffffffffffff';      // la base dit « dans 3 jours », Stripe dit 10 jours (date déjà repoussée)
const JOUR = 86400e3;

// ── La fausse base et le faux Stripe ───────────────────────────────────────
let base, abonnements, users, reglages, subs, apercus, panneEcriture, sessions, appelsStripe;
const k = (o, i) => o + '|' + i;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const reinit = () => { base = new Map(); abonnements = []; users = new Map(); reglages = { proprietaire: JULIEN }; subs = new Map(); apercus = new Map(); panneEcriture = false; sessions = new Map(); appelsStripe = []; };
// PostgREST : `col=op.valeur` (eq, gt, lte, in.(…)) — les filtres de la vraie requête.
const passe = (row, q) => {
  for (const [col, v] of q.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(col)) continue;
    const m = /^(eq|gt|gte|lt|lte|in)\.(.*)$/.exec(v); if (!m) continue;
    const x = row[col];
    const [op, val] = [m[1], m[2]];
    if (op === 'eq' && String(x) !== val) return false;
    if (op === 'in' && !val.replace(/^\(|\)$/g, '').split(',').includes(String(x))) return false;
    const cmp = (a, b) => (/^\d{4}-/.test(String(b)) ? Date.parse(a) - Date.parse(b) : String(a).localeCompare(String(b)));
    if (op === 'gt' && !(x != null && cmp(x, val) > 0)) return false;
    if (op === 'gte' && !(x != null && cmp(x, val) >= 0)) return false;
    if (op === 'lt' && !(x != null && cmp(x, val) < 0)) return false;
    if (op === 'lte' && !(x != null && cmp(x, val) <= 0)) return false;
  }
  return true;
};
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url));
  const q = u.searchParams;
  const methode = (o.method || 'GET').toUpperCase();
  const p = u.pathname;
  const eq = (n) => (q.get(n) || '').replace(/^eq\./, '');
  // ── Stripe ──
  if (u.hostname === 'api.stripe.com') {
    appelsStripe.push(methode + ' ' + p);
    const ms = /^\/v1\/subscriptions\/([^/]+)$/.exec(p);
    if (ms && methode === 'GET') { const s = subs.get(decodeURIComponent(ms[1])); return s ? rep(s) : rep({ error: { message: 'No such subscription' } }, 404); }
    if (p === '/v1/invoices/create_preview' && methode === 'POST') {
      const f = new URLSearchParams(String(o.body || ''));
      const a = apercus.get(f.get('subscription'));
      if (a === 'panne') return rep({ error: { message: 'boom' } }, 500);
      return a ? rep(a) : rep({ error: { message: 'no preview' } }, 400);
    }
    return rep({ error: { message: 'inconnu ' + p } }, 404);
  }
  if (p.endsWith('/auth/v1/user')) {
    const jeton = String((o.headers || {}).Authorization || '').replace(/^Bearer /, '');
    const s = sessions.get(jeton);
    return s ? rep(s) : rep({ message: 'jwt' }, 401);
  }
  const adm = /\/auth\/v1\/admin\/users\/([0-9a-f-]+)$/.exec(p);
  if (adm) { const x = users.get(adm[1]); return x ? rep({ id: adm[1], ...x }) : rep({ message: 'not found' }, 404); }
  if (p.endsWith('/rpc/vrm_acces')) {
    const jeton = String((o.headers || {}).Authorization || '').replace(/^Bearer /, '');
    const s = sessions.get(jeton);
    return rep({ obligatoire: false, proprietaire: !!(s && s.id === JULIEN), acces: true });
  }
  if (p.endsWith('/rpc/vrm_acces_pour')) return rep(true);
  if (p.endsWith('/rest/v1/abonnements')) {
    const jeton = String((o.headers || {}).Authorization || '').replace(/^Bearer /, '');
    const s = sessions.get(jeton);
    let rows = abonnements.slice();
    if (s) rows = rows.filter((r) => r.owner === s.id);                  // RLS : sa ligne
    rows = rows.filter((r) => passe(r, q));
    return rep(rows);
  }
  if (p.endsWith('/rest/v1/vrm_reglages')) { const v = reglages[eq('cle')]; return rep(v ? [{ valeur: v }] : []); }
  if (!p.endsWith('/rest/v1/app_data')) return rep([]);
  const id = eq('id'), owner = eq('owner');
  if (methode === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep([{ owner: JULIEN }]);
    if (id === 'main' && !owner) return rep([]);                         // aucun vendeur à rappeler (colis)
    const d = base.get(k(owner, id));
    if (d === undefined) return rep([]);
    return rep([{ data: d, id, owner }]);
  }
  if (methode === 'POST') {
    if (panneEcriture) return rep('<html>522</html>', 522);
    const lignes = [].concat(JSON.parse(o.body || '[]'));
    for (const l of lignes) base.set(k(l.owner || owner, l.id), JSON.parse(JSON.stringify(l.data)));
    return rep(lignes.map((l) => ({ id: l.id })), 201);
  }
  if (methode === 'PATCH') {
    if (panneEcriture) return rep('<html>522</html>', 522);
    const d = base.get(k(owner, id));
    if (d === undefined) return rep([]);
    const cond = q.get('data->>rev');
    const lu = d && d.rev != null ? String(d.rev) : null;
    if (cond === 'is.null' ? lu !== null : cond != null && cond !== 'eq.' + lu) return rep([]);
    base.set(k(owner, id), JSON.parse(o.body).data);
    return rep([{ id }]);
  }
  return rep([]);
};
const faireRes = () => { const x = { code: null, corps: null, entetes: {} }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.send = (b) => { x.corps = b; return x; }; x.setHeader = (a, b) => { x.entetes[a] = b; }; x.end = () => x; return x; };

// ── Le faux serveur SMTP (local) ───────────────────────────────────────────
const recus = [];
const serveur = net.createServer((s) => {
  let data = false, buf = '', rcpt = '';
  s.write('220 banc ESMTP\r\n');
  s.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const l = buf.slice(0, i); buf = buf.slice(i + 2);
      if (data) { if (l === '.') { data = false; recus.push({ a: rcpt, brut: s._msg.join('\r\n') }); s.write('250 OK queued\r\n'); } else (s._msg = s._msg || []).push(l); continue; }
      if (/^EHLO/i.test(l)) s.write('250-banc\r\n250 AUTH PLAIN LOGIN\r\n');
      else if (/^AUTH PLAIN/i.test(l)) s.write('235 ok\r\n');
      else if (/^MAIL FROM/i.test(l)) s.write('250 ok\r\n');
      else if (/^RCPT TO:<(.*)>/i.test(l)) { rcpt = /^RCPT TO:<(.*)>/i.exec(l)[1]; s.write('250 ok\r\n'); }
      else if (/^DATA/i.test(l)) { data = true; s._msg = []; s.write('354 go\r\n'); }
      else if (/^QUIT/i.test(l)) { s.write('221 bye\r\n'); s.end(); }
      else s.write('250 ok\r\n');
    }
  });
  s.on('error', () => {});
});
const decoder = (brut) => {
  const [tete] = brut.split('\r\n\r\n');
  const m = /Content-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/.exec(brut);
  const sujet = /^Subject: (.*)$/m.exec(tete);
  const dec = (h) => String(h || '').replace(/=\?UTF-8\?B\?([^?]+)\?=\s*/g, (_, b) => Buffer.from(b, 'base64').toString('utf8'));
  return { tete, texte: m ? Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString('utf8') : '', sujet: sujet ? dec(sujet[1]) : '' };
};
// Les notifications rangées dans le centre du vendeur (la vraie écriture de sendPushToAll).
const notifsDe = (owner) => { const j = base.get(k(owner, 'push_journal')); const e = j && Array.isArray(j.entrees) ? j.entrees : j && Array.isArray(j.entries) ? j.entries : []; return e; };

(async () => {
  await new Promise((ok2) => serveur.listen(0, '127.0.0.1', ok2));
  const port = serveur.address().port;
  process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
  process.env.CRON_SECRET = 'cron-banc';
  delete process.env.VRM_OWNER_UID;
  delete process.env.STRIPE_SECRET_KEY;
  const CONFIG = { RELANCES_SMTP_HOTE: 'smtp.exemple.test', RELANCES_SMTP_PORT: '465', RELANCES_SMTP_UTILISATEUR: 'banc', RELANCES_SMTP_MOT_DE_PASSE: 'mdp-banc', RELANCES_EXPEDITEUR: 'bonjour@vrm.exemple.test' };
  const configurer = (on) => { for (const [a, b] of Object.entries(CONFIG)) { if (on) process.env[a] = b; else delete process.env[a]; } };
  const stripeOn = (on) => { if (on) process.env.STRIPE_SECRET_KEY = 'sk_live_banc_inventee'; else delete process.env.STRIPE_SECRET_KEY; };
  const smtp = await import('file://' + path.join(R, 'api', '_lib', 'smtp.js'));
  smtp._banc.connecter = () => new Promise((ok2, ko2) => { const s = net.connect({ host: '127.0.0.1', port }, () => ok2(s)); s.once('error', ko2); });
  const RP = await import('file://' + path.join(R, 'api', '_lib', 'rappel-prelevement.js'));
  const RE = await import('file://' + path.join(R, 'api', '_lib', 'relances-essai.js'));
  const cron = await import('file://' + path.join(R, 'api', 'ship-reminders.js'));
  const compte = await import('file://' + path.join(R, 'api', 'compte.js'));
  const lancerCron = async () => { const res = faireRes(); await cron.default({ method: 'GET', query: {}, headers: { authorization: 'Bearer cron-banc' } }, res); return res; };
  const maintenant = Date.now();
  // « dans N jours » en jours de PARIS, à 11 h UTC (midi à Paris) : le rappel se juge en jours de Paris.
  const dansJours = (n) => new Date(new Date(maintenant + n * JOUR).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) + 'T11:00:00Z');
  const ts = (d) => Math.floor(d.getTime() / 1000);
  const ligne = (owner, statut, fin, extra = {}) => ({ owner, statut, plan: 'solo', fin_periode: fin.toISOString(), annule_fin_periode: false, mode_test: false, abonnement_stripe: 'sub_' + owner.slice(0, 4), client_stripe: 'cus_' + owner.slice(0, 4), ...extra });
  // La forme « dahlia » : la fin de période sur l'ARTICLE (pas sur l'abonnement).
  const sub = (owner, statut, fin, extra = {}) => ({ id: 'sub_' + owner.slice(0, 4), object: 'subscription', customer: 'cus_' + owner.slice(0, 4), status: statut, cancel_at_period_end: false, cancel_at: null, trial_end: statut === 'trialing' ? ts(fin) : null, items: { data: [{ current_period_end: ts(fin), price: { unit_amount: 1699, currency: 'eur' } }] }, livemode: true, ...extra });
  const monde = () => {
    reinit(); recus.length = 0;
    const fA = dansJours(3), fB = dansJours(3), fC = dansJours(3), fD = dansJours(3), fF = dansJours(10), fJ = dansJours(3);
    abonnements = [ligne(A, 'active', fA), ligne(B, 'trialing', fB, { plan: 'pro' }), ligne(C, 'active', fC), ligne(D, 'active', fD, { mode_test: true }), ligne(F, 'active', fA), ligne(JULIEN, 'active', fJ)];
    subs.set('sub_aaaa', sub(A, 'active', fA)); apercus.set('sub_aaaa', { object: 'invoice', amount_due: 1499, currency: 'eur', total: 1499 });   // remise de 2 € : 14,99 €
    subs.set('sub_bbbb', sub(B, 'trialing', fB)); apercus.set('sub_bbbb', { object: 'invoice', amount_due: 1999, currency: 'eur' });
    subs.set('sub_cccc', sub(C, 'active', fC, { cancel_at_period_end: true })); apercus.set('sub_cccc', { amount_due: 1699, currency: 'eur' });
    subs.set('sub_dddd', sub(D, 'active', fD, { livemode: false })); apercus.set('sub_dddd', { amount_due: 1699, currency: 'eur' });
    subs.set('sub_ffff', sub(F, 'active', fF)); apercus.set('sub_ffff', { amount_due: 1699, currency: 'eur' });
    subs.set('sub_1111', sub(JULIEN, 'active', fJ)); apercus.set('sub_1111', { amount_due: 1699, currency: 'eur' });
    for (const [o, e] of [[A, 'solo.a@exemple.test'], [B, 'pro.b@exemple.test'], [C, 'resilie.c@exemple.test'], [D, 'test.d@exemple.test'], [F, 'loin.f@exemple.test'], [JULIEN, 'proprio@exemple.test']]) users.set(o, { email: e, email_confirmed_at: '2026-10-01T10:00:00Z' });
  };
  const dateCourte = (d) => d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' });

  await essaie('K — sans clé Stripe', async () => {
    monde(); configurer(true); stripeOn(false);
    const res = await lancerCron();
    const r = res.corps && res.corps.rappelsPrelevement;
    dit(recus.length === 0 && notifsDe(A).length === 0 && !appelsStripe.length, 'K1 sans STRIPE_SECRET_KEY : rien n’est lu chez Stripe, aucun e-mail, aucune notification', JSON.stringify({ recus: recus.length, stripe: appelsStripe }));
    dit(!!r && r.pret === false && Array.isArray(r.manque) && r.manque.includes('STRIPE_SECRET_KEY'), 'K2 et la réponse du cron le dit (« pas prêt », ce qui manque)', JSON.stringify(r));
    sessions.set('a.b.vendeur', { id: A, email: 'solo.a@exemple.test' });
    const ra = faireRes(); await compte.default({ method: 'GET', query: { mode: 'abonnement' }, headers: { authorization: 'Bearer a.b.vendeur' } }, ra);
    dit(ra.corps && ra.corps.rappelPrelevement && ra.corps.rappelPrelevement.actif === false, 'K3 la route d’abonnement dit « rappel pas actif » (Paramètres le montre)', JSON.stringify(ra.corps && ra.corps.rappelPrelevement));
    stripeOn(true);
    const rb = faireRes(); await compte.default({ method: 'GET', query: { mode: 'abonnement' }, headers: { authorization: 'Bearer a.b.vendeur' } }, rb);
    dit(rb.corps && rb.corps.rappelPrelevement && rb.corps.rappelPrelevement.actif === true && rb.corps.rappelPrelevement.email === true && rb.corps.rappelPrelevement.joursAvant === 3, 'K4 clé posée et envoi configuré : « 3 jours avant, notification et e-mail »', JSON.stringify(rb.corps && rb.corps.rappelPrelevement));
  });

  await essaie('R — le rappel', async () => {
    monde(); configurer(true); stripeOn(true);
    const res = await lancerCron();
    const aA = recus.filter((x) => x.a === 'solo.a@exemple.test'), aB = recus.filter((x) => x.a === 'pro.b@exemple.test');
    const mA = decoder(aA[0] ? aA[0].brut : ''), mB = decoder(aB[0] ? aB[0].brut : '');
    const d3 = dateCourte(dansJours(3));
    dit(aA.length === 1 && /14,99\s€/.test(mA.texte) && !/16,99/.test(mA.texte) && /VRM Solo/.test(mA.texte), 'R1 Solo : le montant LU dans l’aperçu Stripe (14,99 € remise comprise), jamais le prix catalogue, le plan nommé', mA.texte.slice(0, 300));
    dit(new RegExp(`renouvelé le ${d3}`).test(mA.sujet), 'R2 la date LUE chez Stripe (fin de période sur l’article), au format JJ/MM', mA.sujet);
    dit(/Résilier/.test(mA.texte) && /vue=abonnement/.test(mA.texte), 'R3 « Gérer · Résilier » : le chemin et le lien vers Mon abonnement');
    dit(aB.length === 1 && /essai se termine le/.test(mB.sujet) && /19,99\s€/.test(mB.texte) && /VRM Pro/.test(mB.texte), 'R4 fin d’essai : « ton essai se termine le … », le montant et le plan Pro', mB.sujet + ' · ' + mB.texte.slice(0, 200));
    const nA = notifsDe(A);
    dit(nA.length === 1 && /renouvelé le/.test(JSON.stringify(nA[0])) && /14,99/.test(JSON.stringify(nA[0])), 'R5 la notification aussi, rangée dans le centre de CE vendeur', JSON.stringify(nA).slice(0, 300));
    dit(res.corps && res.corps.rappelsPrelevement && res.corps.rappelsPrelevement.rappels === 2, 'R6 le cron compte deux rappels (A et B)', JSON.stringify(res.corps && res.corps.rappelsPrelevement));
    dit(appelsStripe.includes('POST /v1/invoices/create_preview') && appelsStripe.some((x) => /^GET \/v1\/subscriptions\//.test(x)), 'R7 lus chez Stripe : l’abonnement ET l’aperçu de la prochaine facture');
    const brut = aA[0] ? aA[0].brut : '';
    dit(!/4242|carte\s+\d|•••/.test(mA.texte) && /^Auto-Submitted: auto-generated$/m.test(brut), 'R8 aucune donnée de carte ; message marqué automatique');
  });

  await essaie('Q — à qui jamais', async () => {
    monde(); configurer(true); stripeOn(true);
    await lancerCron();
    dit(!recus.some((x) => /resilie\.c/.test(x.a)) && !notifsDe(C).length, 'Q1 résilié chez Stripe (la base ne le sait pas encore) : rien');
    dit(!recus.some((x) => /proprio|test\.d/.test(x.a)) && !notifsDe(JULIEN).length && !notifsDe(D).length, 'Q2 jamais le propriétaire, jamais un abonnement en mode test');
    dit(!recus.some((x) => /loin\.f/.test(x.a)), 'Q3 la base dit « dans 3 jours » mais Stripe dit 10 jours : la date de Stripe décide, rien aujourd’hui');
    monde(); configurer(true); stripeOn(true);
    subs.set('sub_aaaa', { ...subs.get('sub_aaaa'), customer: 'cus_autre' });
    await lancerCron();
    dit(!recus.some((x) => /solo\.a/.test(x.a)), 'Q4 l’abonnement Stripe d’un AUTRE client : rien');
    monde(); configurer(true); stripeOn(true); reglages = {};
    await lancerCron();
    dit(recus.length === 0, 'Q5 propriétaire de l’installation pas su : personne ne reçoit rien');
  });

  await essaie('P — pas su', async () => {
    monde(); configurer(true); stripeOn(true);
    apercus.set('sub_aaaa', 'panne'); apercus.set('sub_bbbb', { amount_due: 1999, currency: 'usd' });
    const res = await lancerCron();
    dit(recus.length === 0 && !notifsDe(A).length && !notifsDe(B).length, 'P1 aperçu en panne ou en dollars : rien ne part (aucun montant deviné)', JSON.stringify(res.corps && res.corps.rappelsPrelevement));
    dit(!(base.get(k(A, 'rappels_prelevement')) || {}).rappels, 'P2 et rien n’est réservé : on relit demain');
    monde(); configurer(true); stripeOn(true); subs.clear();
    await lancerCron();
    dit(recus.length === 0, 'P3 Stripe ne rend pas l’abonnement : rien');
  });

  await essaie('U — une fois', async () => {
    monde(); configurer(true); stripeOn(true);
    await lancerCron(); const n1 = recus.length;
    await lancerCron();
    dit(n1 === 2 && recus.length === 2 && notifsDe(A).length === 1, 'U1 relancé le même jour : rien de plus (une fois par prélèvement)', `${n1} puis ${recus.length}`);
    const lendemain = await RP.passageRappelsPrelevement({ maintenant: maintenant + JOUR });
    dit(recus.length === 2 && lendemain.rappels === 0, 'U2 le lendemain (2 jours avant) : déjà rappelé, rien', JSON.stringify(lendemain.ignores));
    monde(); configurer(false); stripeOn(true);
    const r = await lancerCron();
    dit(recus.length === 0 && notifsDe(A).length === 1 && notifsDe(B).length === 1, 'U3 sans envoi d’e-mails configuré : la notification seule', JSON.stringify(r.corps && r.corps.rappelsPrelevement));
    monde(); configurer(true); stripeOn(true); panneEcriture = true;
    await lancerCron();
    dit(recus.length === 0, 'U4 réservation non confirmée par la base : rien ne part');
    monde(); configurer(true); stripeOn(true);
    // Le cron du matin a manqué le jour J-3 : à J-1, le rappel part quand même (une fois).
    const fA = dansJours(1); abonnements[0].fin_periode = fA.toISOString(); subs.set('sub_aaaa', sub(A, 'active', fA)); apercus.set('sub_aaaa', { amount_due: 1699, currency: 'eur' });
    await lancerCron();
    dit(recus.some((x) => x.a === 'solo.a@exemple.test'), 'U5 un passage manqué : la veille, le rappel part encore');
  });

  await essaie('E — la fin d’essai ne double plus', async () => {
    const fin = (n) => dansJours(n).toISOString();
    const t0 = maintenant;
    dit(RE.etapeDuJour({ fin: fin(1), maintenant: t0, envois: { j1: { issue: 'envoye' }, j3: { issue: 'envoye' } } }) === null, 'E1 essai qui sera prélevé : plus de « se termine demain » (le rappel 3 jours avant l’a dit, avec le montant)');
    dit(RE.etapeDuJour({ fin: fin(1), maintenant: t0, annule: true, envois: { j1: { issue: 'envoye' }, j3: { issue: 'envoye' } } }) === 'j6', 'E2 essai résilié : la veille, « ton accès se ferme demain » reste');
    dit(RE.etapeDuJour({ fin: fin(3), maintenant: t0, envois: { j1: { issue: 'envoye' } } }) === null && RE.etapeDuJour({ fin: fin(4), maintenant: t0, envois: { j1: { issue: 'envoye' } } }) === 'j3', 'E3 le jour du rappel (3 jours avant) : pas d’e-mail d’essai le même jour ; « ce qui n’est pas relié » la veille');
    const src = require('fs').readFileSync(path.join(R, 'api', 'ship-reminders.js'), 'utf8').replace(/\/\/.*$/gm, '');
    dit(/passageRappelsPrelevement\(\{[^}]*jusqua:/.test(src), 'E4 la route du matin lui donne son heure limite');
  });

  serveur.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
