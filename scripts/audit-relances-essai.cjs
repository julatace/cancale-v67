#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES E-MAILS DE L'ESSAI GRATUIT (5 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (5 nov.) : « des e-mails de relance pendant l'essai gratuit sans
// engagement, pour convertir le client ». Ce banc EXÉCUTE (§4.10) :
//   · la vraie route du cron du matin `api/ship-reminders.js` (qui porte la
//     passe des relances) et le vrai client SMTP (`api/_lib/smtp.js`) contre un
//     faux serveur SMTP local (`_banc.connecter`) ;
//   · la vraie route `api/compte.js?mode=relances` (état, choix, lien de
//     désinscription) ;
// contre une fausse base (abonnements, vrm_reglages, Auth admin, app_data).
//   E  sans envoi configuré : RIEN ne part, et la route le dit
//   Q  à qui : en essai seulement, jamais un abonné payant, jamais le
//      propriétaire, jamais un essai en mode test, jamais une adresse non
//      confirmée, jamais l'adresse d'ailleurs que le compte ; propriétaire pas
//      su ⇒ personne
//   S  la séquence : j1 (jours 1-2), j3 (3-5, ce qui n'est pas relié — jamais
//      un « pas su » écrit comme « pas relié »), j6 (la veille de la fin) ; une
//      fois chacun ; au plus un par jour
//   D  désinscription en un clic (lien signé, et l'en-tête List-Unsubscribe
//      « One-Click ») ; un lien trafiqué ne désinscrit personne
//   G  garde-fous : réservation non confirmée ⇒ rien ; refus SMTP avant le
//      message ⇒ l'étape est libérée ; aucune donnée du vendeur dans le texte
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
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';      // en essai, adresse confirmée
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';      // abonné qui paie
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';      // essai en mode test
const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';      // adresse non confirmée
const JOUR = 86400e3;

// ── La fausse base ─────────────────────────────────────────────────────────
let base, abonnements, users, reglages, comptesVinted, panneEcriture, sessions;
const k = (o, i) => o + '|' + i;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const reinit = () => {
  base = new Map(); abonnements = []; users = new Map(); reglages = { proprietaire: JULIEN }; comptesVinted = []; panneEcriture = false;
  sessions = new Map();
};
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url));
  const q = u.searchParams;
  const methode = (o.method || 'GET').toUpperCase();
  const p = u.pathname;
  const eq = (n) => (q.get(n) || '').replace(/^eq\./, '');
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
  if (p.endsWith('/rest/v1/abonnements')) {
    const jeton = String((o.headers || {}).Authorization || '').replace(/^Bearer /, '');
    const s = sessions.get(jeton);
    let rows = abonnements.slice();
    if (s) rows = rows.filter((r) => r.owner === s.id);                  // RLS : sa ligne
    if (q.get('statut')) rows = rows.filter((r) => r.statut === eq('statut'));
    return rep(rows);
  }
  if (p.endsWith('/rest/v1/vrm_reglages')) { const v = reglages[eq('cle')]; return rep(v ? [{ valeur: v }] : []); }
  if (p.endsWith('/rest/v1/vinted_accounts')) return rep(comptesVinted.filter((c) => c.owner === eq('owner')).map((c) => ({ vinted_user_id: c.id })));
  if (!p.endsWith('/rest/v1/app_data')) return rep([]);
  const id = eq('id'), owner = eq('owner');
  if (methode === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep([{ owner: JULIEN }]);
    if (id === 'main' && !owner) return rep([]);                         // aucun vendeur à rappeler
    const d = base.get(k(owner, id));
    if (d === undefined) return rep([]);
    const sel = q.get('select') || 'data';
    if (sel === 'id') return rep([{ id }]);
    if (sel === 'subs:data->subs') return rep([{ subs: d.subs }]);
    return rep([{ data: d }]);
  }
  if (methode === 'POST') {
    if (panneEcriture) return rep('<html>522</html>', 522);
    const lignes = JSON.parse(o.body || '[]');
    for (const l of lignes) base.set(k(l.owner, l.id), JSON.parse(JSON.stringify(l.data)));
    return rep(lignes.map((l) => ({ id: l.id })), 201);
  }
  return rep([]);
};
const faireRes = () => { const x = { code: null, corps: null, entetes: {} }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.send = (b) => { x.corps = b; return x; }; x.setHeader = (a, b) => { x.entetes[a] = b; }; x.end = () => x; return x; };

// ── Le faux serveur SMTP (local) ───────────────────────────────────────────
const recus = [];
let refuserRcpt = false;
const serveur = net.createServer((s) => {
  let data = false, buf = '', rcpt = '';
  s.write('220 banc ESMTP\r\n');
  s.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const l = buf.slice(0, i); buf = buf.slice(i + 2);
      if (data) {
        if (l === '.') { data = false; recus.push({ a: rcpt, brut: s._msg.join('\r\n') }); s.write('250 OK queued\r\n'); } else (s._msg = s._msg || []).push(l);
        continue;
      }
      if (/^EHLO/i.test(l)) s.write('250-banc\r\n250 AUTH PLAIN LOGIN\r\n');
      else if (/^AUTH PLAIN/i.test(l)) s.write('235 ok\r\n');
      else if (/^MAIL FROM/i.test(l)) s.write('250 ok\r\n');
      else if (/^RCPT TO:<(.*)>/i.test(l)) { rcpt = /^RCPT TO:<(.*)>/i.exec(l)[1]; s.write(refuserRcpt ? '550 non\r\n' : '250 ok\r\n'); }
      else if (/^DATA/i.test(l)) { data = true; s._msg = []; s.write('354 go\r\n'); }
      else if (/^QUIT/i.test(l)) { s.write('221 bye\r\n'); s.end(); }
      else s.write('250 ok\r\n');
    }
  });
  s.on('error', () => {});
});
const decoder = (brut) => {
  // Le texte brut (base64) du premier morceau text/plain, et les en-têtes.
  const [tete] = brut.split('\r\n\r\n');
  const m = /Content-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/.exec(brut);
  const sujet = /^Subject: (.*)$/m.exec(tete);
  const dec = (h) => String(h || '').replace(/=\?UTF-8\?B\?([^?]+)\?=\s*/g, (_, b) => Buffer.from(b, 'base64').toString('utf8'));
  return { tete, texte: m ? Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString('utf8') : '', sujet: sujet ? dec(sujet[1]) : '' };
};

(async () => {
  await new Promise((ok2) => serveur.listen(0, '127.0.0.1', ok2));
  const port = serveur.address().port;
  process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
  process.env.CRON_SECRET = 'cron-banc';
  delete process.env.VRM_OWNER_UID;
  const CONFIG = { RELANCES_SMTP_HOTE: 'smtp.exemple.test', RELANCES_SMTP_PORT: '465', RELANCES_SMTP_UTILISATEUR: 'banc', RELANCES_SMTP_MOT_DE_PASSE: 'mdp-banc', RELANCES_EXPEDITEUR: 'bonjour@vrm.exemple.test' };
  const configurer = (on) => { for (const [a, b] of Object.entries(CONFIG)) { if (on) process.env[a] = b; else delete process.env[a]; } };
  const smtp = await import('file://' + path.join(R, 'api', '_lib', 'smtp.js'));
  smtp._banc.connecter = () => new Promise((ok2, ko2) => { const s = net.connect({ host: '127.0.0.1', port }, () => ok2(s)); s.once('error', ko2); });
  const RE = await import('file://' + path.join(R, 'api', '_lib', 'relances-essai.js'));
  const cron = await import('file://' + path.join(R, 'api', 'ship-reminders.js'));
  const compte = await import('file://' + path.join(R, 'api', 'compte.js'));
  const lancerCron = async () => { const res = faireRes(); await cron.default({ method: 'GET', query: {}, headers: { authorization: 'Bearer cron-banc' } }, res); return res; };
  const maintenant = Date.now();
  const essai = (owner, finDans, extra = {}) => ({ owner, statut: 'trialing', fin_periode: new Date(maintenant + finDans).toISOString(), annule_fin_periode: false, mode_test: false, ...extra });
  const monde = () => {
    reinit(); recus.length = 0; refuserRcpt = false;
    abonnements = [
      essai(A, 6.5 * JOUR),
      { owner: B, statut: 'active', fin_periode: new Date(maintenant + 20 * JOUR).toISOString(), annule_fin_periode: false, mode_test: false },
      essai(C, 6.5 * JOUR, { mode_test: true }),
      essai(D, 6.5 * JOUR),
      essai(JULIEN, 6.5 * JOUR),
    ];
    users.set(A, { email: 'essai.a@exemple.test', email_confirmed_at: '2026-11-01T10:00:00Z' });
    users.set(B, { email: 'paie.b@exemple.test', email_confirmed_at: '2026-10-01T10:00:00Z' });
    users.set(C, { email: 'test.c@exemple.test', email_confirmed_at: '2026-11-01T10:00:00Z' });
    users.set(D, { email: 'pasconfirme.d@exemple.test', email_confirmed_at: null });
    users.set(JULIEN, { email: 'proprio@exemple.test', email_confirmed_at: '2026-07-01T10:00:00Z' });
    base.set(k(A, 'email_journal'), { entries: [{ at: '2026-11-04T10:00:00Z' }] });   // e-mails reliés, rien d'autre
  };

  await essaie('E — sans envoi configuré', async () => {
    monde(); configurer(false);
    const res = await lancerCron();
    dit(recus.length === 0 && res.corps && res.corps.relances && res.corps.relances.pret === false, 'E1 aucune variable SMTP : RIEN ne part, la réponse du cron dit « pas prêt »', JSON.stringify(res.corps && res.corps.relances));
    dit(res.corps.relances.manque.includes('RELANCES_SMTP_HOTE') && res.corps.relances.manque.includes('RELANCES_EXPEDITEUR'), 'E2 et nomme ce qui manque');
    sessions.set('a.b.julien', { id: JULIEN, email: 'proprio@exemple.test' });
    sessions.set('a.b.vendeur', { id: A, email: 'essai.a@exemple.test' });
    const r1 = faireRes(); await compte.default({ method: 'GET', query: { mode: 'relances' }, headers: { authorization: 'Bearer a.b.julien' } }, r1);
    const r2 = faireRes(); await compte.default({ method: 'GET', query: { mode: 'relances' }, headers: { authorization: 'Bearer a.b.vendeur' } }, r2);
    dit(r1.corps && r1.corps.configure === false && Array.isArray(r1.corps.manque) && r1.corps.manque.length > 0, 'E3 Réglages (propriétaire) : « pas configuré » et la liste de ce qui manque', JSON.stringify(r1.corps));
    dit(r2.corps && r2.corps.configure === false && r2.corps.manque === undefined && r2.corps.essai === true, 'E4 Réglages (vendeur en essai) : « pas configuré », sans les noms des variables', JSON.stringify(r2.corps));
  });

  await essaie('Q — à qui', async () => {
    monde(); configurer(true);
    const res = await lancerCron();
    dit(recus.length === 1 && recus[0].a === 'essai.a@exemple.test', 'Q1 un seul e-mail, à l’adresse DU COMPTE en essai', recus.map((x) => x.a).join(', ') + ' ' + JSON.stringify(res.corps && res.corps.relances));
    dit(!recus.some((x) => /paie\.b|proprio|test\.c|pasconfirme/.test(x.a)), 'Q2 jamais l’abonné qui paie, ni le propriétaire, ni un essai en mode test, ni une adresse non confirmée');
    monde(); configurer(true); reglages = {};
    await lancerCron();
    dit(recus.length === 0, 'Q3 propriétaire de l’installation pas su (ni réglage, ni VRM_OWNER_UID) : personne ne reçoit rien');
    monde(); configurer(true); reglages = {}; process.env.VRM_OWNER_UID = JULIEN;
    await lancerCron();
    dit(recus.length === 1 && recus[0].a === 'essai.a@exemple.test', 'Q4 le propriétaire connu par VRM_OWNER_UID seul suffit');
    delete process.env.VRM_OWNER_UID;
    monde(); configurer(true); process.env.RELANCES_ESSAI_MODE_TEST = '1';
    await lancerCron();
    dit(recus.length === 2 && recus.some((x) => x.a === 'test.c@exemple.test'), 'Q5 l’essai en mode test seulement si RELANCES_ESSAI_MODE_TEST=1 est posé exprès');
    delete process.env.RELANCES_ESSAI_MODE_TEST;
  });

  await essaie('S — la séquence', async () => {
    monde(); configurer(true);
    await lancerCron();
    const m1 = decoder(recus[0] ? recus[0].brut : '');
    dit(/Bienvenue/.test(m1.sujet) && /premier geste/i.test(m1.texte), 'S1 jour 1 : « Bienvenue » et le premier geste', m1.sujet);
    await lancerCron();
    dit(recus.length === 1, 'S2 relancé le même jour : rien de plus (une fois par étape)');
    const env = { ...process.env };
    const t0 = Date.parse('2026-11-05T09:00:00Z');
    const ed = (fin, envois = {}) => RE.etapeDuJour({ fin, maintenant: t0, envois });
    dit(ed('2026-11-11T15:00:00Z') === 'j1' && ed('2026-11-10T15:00:00Z') === 'j3' && ed('2026-11-08T15:00:00Z') === 'j3' && ed('2026-11-07T15:00:00Z') === null && ed('2026-11-06T15:00:00Z') === 'j6' && ed('2026-11-05T15:00:00Z') === null && ed('2026-11-09T15:00:00Z', { j3: { issue: 'incertain' } }) === null && ed('2026-11-09T15:00:00Z', { j3: { issue: 'refuse' } }) === 'j3', 'S3 jours 1-2 ⇒ j1 ; 3-5 ⇒ j3 ; jour 6 ⇒ rien ; la veille de la fin ⇒ j6 ; le jour de la fin ⇒ rien ; « incertain » ne se refait pas, « refusé » si (jours de Paris)');
    // j3 réel, par la route : Vinted et notifications pas reliés, e-mails reliés.
    monde(); configurer(true);
    abonnements = [essai(A, 4.5 * JOUR)];
    base.set(k(A, 'relances_essai'), { envois: { j1: { at: new Date(maintenant - 2 * JOUR).toISOString(), issue: 'envoye' } } });
    await lancerCron();
    const m3 = decoder(recus[0] ? recus[0].brut : '');
    dit(/pas encore relié/.test(m3.sujet) && /compte Vinted/.test(m3.texte) && /notifications/i.test(m3.texte) && !/Tes e-mails Vinted/.test(m3.texte), 'S4 j3 : nomme ce qui n’est PAS relié (Vinted, notifications), pas ce qui l’est (e-mails)', m3.texte.slice(0, 300));
    const t = RE.texteRelance('j3', { fin: new Date(maintenant + 4 * JOUR).toISOString(), relie: { vinted: null, emails: true, notifications: null }, lien: 'https://vrm.center/x' });
    dit(!/compte Vinted :/.test(t.texte) && /Comptes liés/.test(t.texte), 'S5 « pas su » n’est jamais écrit « pas relié » (renvoi vers Comptes liés)');
    monde(); configurer(true);
    abonnements = [essai(A, 1 * JOUR + 2 * 3600e3)];
    base.set(k(A, 'relances_essai'), { envois: { j1: { issue: 'envoye' }, j3: { issue: 'envoye' } } });
    // « demain » se juge en jours de Paris : on cale la fin sur midi de demain.
    const demainMidi = new Date(new Date(maintenant + JOUR).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) + 'T11:00:00Z').toISOString();
    abonnements = [essai(A, 0, { fin_periode: demainMidi })];
    await lancerCron();
    const m6 = decoder(recus[0] ? recus[0].brut : '');
    dit(/se termine demain/.test(m6.sujet) && /Paramètres → Abonnement → « Résilier »/.test(m6.texte), 'S6 la veille de la fin : « se termine demain », et comment arrêter', m6.sujet);
    monde(); configurer(true);
    abonnements = [essai(A, 0, { fin_periode: demainMidi, annule_fin_periode: true })];
    base.set(k(A, 'relances_essai'), { envois: { j1: { issue: 'envoye' }, j3: { issue: 'envoye' } } });
    await lancerCron();
    dit(/arrêté l’abonnement/.test(decoder(recus[0] ? recus[0].brut : '').texte), 'S7 abonnement déjà arrêté : le j6 le dit (accès qui se ferme, données gardées)');
    Object.assign(process.env, env);
  });

  await essaie('D — désinscription', async () => {
    monde(); configurer(true);
    await lancerCron();
    const m = decoder(recus[0] ? recus[0].brut : '');
    const lien = (/(https:\/\/vrm\.center\/api\/compte\?mode=relances&d=[0-9a-f-]+\.[A-Za-z0-9_-]+)/.exec(m.texte) || [])[1];
    dit(!!lien && /^List-Unsubscribe: <https:\/\/vrm\.center\/api\/compte\?mode=relances&d=/m.test(m.tete) && /^List-Unsubscribe-Post: List-Unsubscribe=One-Click$/m.test(m.tete), 'D1 le lien est dans l’e-mail ET dans l’en-tête « List-Unsubscribe » (un clic)', m.tete.split('\r\n').filter((l) => /^List/.test(l)).join(' | '));
    const d = new URL(lien).searchParams.get('d');
    const faux = d.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    const rf = faireRes(); await compte.default({ method: 'GET', query: { mode: 'relances', d: faux }, headers: {} }, rf);
    dit(rf.code === 400 && !(base.get(k(A, 'relances_essai_choix')) || {}).desinscrit, 'D2 un lien trafiqué ne désinscrit personne');
    const rg = faireRes(); await compte.default({ method: 'GET', query: { mode: 'relances', d }, headers: {} }, rg);
    dit(rg.code === 200 && !(base.get(k(A, 'relances_essai_choix')) || {}).desinscrit && /<form method="post"/.test(String(rg.corps)), 'D3a ouvrir le lien (un antivirus le fait seul) ne désinscrit PAS : une page avec un bouton');
    const rd = faireRes(); await compte.default({ method: 'POST', query: { mode: 'relances', d, page: '1' }, headers: {}, body: '' }, rd);
    dit(rd.code === 200 && (base.get(k(A, 'relances_essai_choix')) || {}).desinscrit === true && /C'est fait/.test(String(rd.corps)), 'D3 le bouton : désinscrit, une page le dit');
    abonnements = [essai(A, 4.5 * JOUR)];
    recus.length = 0;
    await lancerCron();
    dit(recus.length === 0, 'D4 désinscrit : plus rien, même à l’étape suivante');
    const rp = faireRes(); await compte.default({ method: 'POST', query: { mode: 'relances', d }, headers: {}, body: 'List-Unsubscribe=One-Click' }, rp);
    dit(rp.code === 200 && rp.corps && rp.corps.ok === true, 'D5 le « un clic » du logiciel de messagerie (POST) répond 200');
    sessions.set('a.b.vendeur', { id: A, email: 'essai.a@exemple.test' });
    const rr = faireRes(); await compte.default({ method: 'POST', query: { mode: 'relances' }, headers: { authorization: 'Bearer a.b.vendeur' }, body: { abonne: true } }, rr);
    dit(rr.code === 200 && (base.get(k(A, 'relances_essai_choix')) || {}).desinscrit === false, 'D6 il peut se réinscrire depuis Réglages (sa session)');
  });

  await essaie('G — garde-fous', async () => {
    monde(); configurer(true); panneEcriture = true;
    await lancerCron();
    dit(recus.length === 0, 'G1 la réservation n’est pas confirmée par la base : rien ne part');
    monde(); configurer(true); refuserRcpt = true;
    await lancerCron();
    dit(recus.length === 0 && !RE.etapeFaite((base.get(k(A, 'relances_essai')) || {}).envois, 'j1'), 'G2 le serveur SMTP refuse le destinataire : rien n’est parti, l’étape est libérée pour demain');
    refuserRcpt = false;
    await lancerCron();
    dit(recus.length === 1, 'G3 le lendemain (ou au passage suivant) elle part');
    const tout = ['j1', 'j3', 'j6'].map((e) => RE.texteRelance(e, { fin: new Date(maintenant + 3 * JOUR).toISOString(), relie: { vinted: false, emails: false, notifications: false }, lien: RE.lienDesinscription(A, 'cle-de-service-de-banc') }));
    dit(tout.every((t) => t && !/@/.test(t.texte) && !/€/.test(t.texte) && !/\d+ ventes?/.test(t.texte)), 'G4 les gabarits ne portent ni adresse, ni montant, ni chiffre de ventes');
    // (5 nov., soir — « ça doit être bcp plus clair ») La forme : un titre qui dit
    // ce que c'est, UN bouton d'action, le lien « ne plus recevoir » seulement
    // dans le pied ; le texte brut commence par le même titre.
    const forme = tout.map((t) => {
      const corps = t.html.split('<hr')[0], piedH = t.html.split('<hr')[1] || '';
      const h1 = (t.html.match(/<h1\b[^>]*>([^<]*)<\/h1>/g) || []);
      const titre = ((/<h1\b[^>]*>([^<]*)<\/h1>/.exec(t.html) || [])[1] || '').trim();
      return { h1: h1.length, titre, liensCorps: (corps.match(/<a\s/g) || []).length, desinscritPied: /mode=relances/.test(piedH) && !/mode=relances/.test(corps), texteTitre: t.texte.split('\n')[0].trim() === titre.replace(/&#39;/g, "'").replace(/&amp;/g, '&') };
    });
    dit(forme.every((f) => f.h1 === 1 && f.titre && f.liensCorps === 1 && f.desinscritPied && f.texteTitre), 'G6 chaque e-mail : UN titre, UN bouton d’action, « ne plus recevoir » en pied seulement ; le texte brut commence par le titre', JSON.stringify(forme));
    const brut = recus[0] ? recus[0].brut : '';
    dit(/^From: =\?UTF-8|^From: VRM <bonjour@vrm\.exemple\.test>$/m.test(brut) && /^Auto-Submitted: auto-generated$/m.test(brut), 'G5 expéditeur = la boîte de VRM réglée (jamais celle du vendeur), message marqué automatique');
  });

  await essaie('B — le temps du cron', async () => {
    // (revue du 5 nov.) Le cron du matin fait d'abord les rappels de tous les
    // vendeurs ; une fonction Vercel s'arrête à 300 s. Passé l'heure donnée,
    // aucun envoi ne COMMENCE (un envoi coupé resterait « en cours », jamais refait).
    monde(); configurer(true);
    const r = await RE.passageRelances({ jusqua: Date.now() - 1 });
    dit(recus.length === 0 && r.envoyes === 0 && r.ignores && r.ignores['temps du passage'] >= 1 && !(base.get(k(A, 'relances_essai')) || {}).envois, 'B1 l’heure passée : rien ne commence, rien n’est réservé (l’étape attend le lendemain)', JSON.stringify(r));
    const src = require('fs').readFileSync(path.join(R, 'api', 'ship-reminders.js'), 'utf8').replace(/\/\/.*$/gm, '');
    dit(/passageRelances\(\{\s*jusqua:/.test(src), 'B2 la route du matin lui donne son heure limite');
  });

  serveur.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
