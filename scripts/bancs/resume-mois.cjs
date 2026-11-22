require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE RÉSUMÉ DU MOIS PAR E-MAIL, EXÉCUTÉ (node scripts/bancs/resume-mois.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// (22 nov., Julien, choix n° 36) §4.10 — une route serveur n'est vérifiée que si un banc l'EXÉCUTE. On lance le VRAI
// cron du matin (`api/ship-reminders.js`, aucune fonction de plus) sur une fausse base CLOISONNÉE à deux vendeurs, un
// FAUX serveur SMTP local (le vrai client `api/_lib/smtp.js`, branché par `_banc.connecter` : rien ne quitte la
// machine), et le 1er décembre 2026 figé. On exige :
//   • A (jamais choisi, envoi configuré ⇒ allumé par défaut) reçoit UN e-mail, à l'adresse de SON compte : ses ventes
//     de novembre, le vendu et le reçu (daté au VERSEMENT), le bénéfice et sa couverture, les colis non retirés (la
//     publication de l'app), le montant à déclarer à l'URSSAF (la règle serveur : 101 € × 12,4 % = 12,52 €), un lien
//     vers Argent ; B (qui l'a coupé) ne reçoit rien et rien de B n'est lu pour lui ;
//   • UN SEUL envoi par mois : relancé le jour même, puis le 2 ⇒ rien de plus (dédoublonnage par la clé du mois) ;
//   • la réservation du mois ne s'écrit pas ⇒ rien ne part ; au passage suivant (base revenue) ⇒ il part, une fois ;
//   • l'envoi n'est pas configuré (RELANCES_SMTP_* absent) ⇒ rien ne part, et la route de Paramètres
//     (`/api/compte?mode=bilan-mois`, exécutée aussi) dit `configure: false`, `actif: false` ;
//   • le 8 du mois ⇒ rien.
// Aucune fixture : tout est inventé ici. `--mutations` : chaque affaiblissement de la règle doit faire rougir le banc.
'use strict';
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.resolve(process.env.BANC_RACINE || path.join(__dirname, '..', '..'));

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };

const ENV_SMTP = { RELANCES_SMTP_HOTE: 'smtp.exemple.test', RELANCES_SMTP_PORT: '465', RELANCES_SMTP_UTILISATEUR: 'u', RELANCES_SMTP_MOT_DE_PASSE: 'p', RELANCES_EXPEDITEUR: 'noreply@vrm.exemple.test' };
const poserSmtp = (oui) => { for (const [k, v] of Object.entries(ENV_SMTP)) { if (oui) process.env[k] = v; else delete process.env[k]; } };
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.CRON_SECRET = 'cle-banc-cron';
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
poserSmtp(true);
const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
webpush.setVapidDetails = () => {};
webpush.sendNotification = async () => ({ statusCode: 201 });

// ── Le faux serveur SMTP (ce qui partirait, rien ne part) ───────────────────
function fauxSmtp() {
  const recus = [];
  const serveur = net.createServer((s) => {
    let tampon = '', enData = false;
    s.write('220 faux.smtp.test\r\n');
    s.on('data', (d) => {
      tampon += d.toString('utf8');
      for (;;) {
        if (enData) { const i = tampon.indexOf('\r\n.\r\n'); if (i < 0) return; recus.push(tampon.slice(0, i)); tampon = tampon.slice(i + 5); enData = false; s.write('250 ok\r\n'); continue; }
        const i = tampon.indexOf('\r\n'); if (i < 0) return;
        const l = tampon.slice(0, i); tampon = tampon.slice(i + 2);
        if (/^EHLO/i.test(l)) s.write('250-faux.smtp.test\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (/^AUTH/i.test(l)) s.write('235 ok\r\n');
        else if (/^(MAIL|RCPT)/i.test(l)) s.write('250 ok\r\n');
        else if (/^DATA/i.test(l)) { s.write('354 go\r\n'); enData = true; }
        else if (/^QUIT/i.test(l)) { s.write('221 bye\r\n'); s.end(); }
        else s.write('250 ok\r\n');
      }
    });
    s.on('error', () => {});
  });
  return new Promise((r) => serveur.listen(0, '127.0.0.1', () => r({ serveur, recus, port: serveur.address().port })));
}
function decoder(brut) {
  const tete = brut.split('\r\n\r\n')[0];
  const partie = (type) => { const m = new RegExp(`Content-Type: ${type}; charset=UTF-8\\r\\nContent-Transfer-Encoding: base64\\r\\n\\r\\n([A-Za-z0-9+/=\\r\\n]+?)\\r\\n--`).exec(brut); return m ? Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString('utf8') : ''; };
  const sujet = ((/^Subject: (.*(?:\r\n .*)*)$/m.exec(tete) || [])[1] || '').replace(/\r\n /g, '').replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_, b) => Buffer.from(b, 'base64').toString('utf8'));
  const a = ((/^To: (.*)$/m.exec(tete) || [])[1] || '').trim();
  return { tete, a, sujet, texte: partie('text/plain'), html: partie('text/html') };
}

// ── Deux vendeurs (UUID : le lien de désinscription signé l'exige) ──────────
const A = '0b6f2f4e-aaaa-4222-8333-444455556661', B = '0b6f2f4e-bbbb-4222-8333-444455556662';
const J = 86400000;
const DEC1 = Date.parse('2026-12-01T05:10:00Z');            // 1er décembre, 6 h 10 à Paris
const NOV = (j, h = 14) => new Date(Date.UTC(2026, 10, j, h)).toISOString();
const vendeurs = () => ({
  [A]: {
    email: 'vendeuse.a@exemple.invalid', choix: null,
    comptes: [{ vinted_user_id: '11', login: 'vendeuse_a' }],
    main: {
      vinted_regime: 'micro', vinted_urssaf_freq: 'mensuel',
      // La ligne que l'écran Ventes publie (son propriétaire) : 101 € reçus en novembre, publiée après la fin du mois.
      vinted_urssaf_mois: { at: Date.parse('2026-11-30T23:30:00Z'), mois: [{ ym: '2026-11', ca: 101 }] },
      // La liste que l'app publie (`pickupUnion`) : 2 colis à retirer, limite LUE dans 2 et 3 jours.
      vrm_colis_retirer: { at: Date.parse('2026-11-30T20:00:00Z'), colis: [['2026-12-03', Date.parse('2026-11-28T10:00:00Z'), 'mondialrelay', 'e:MR1', 1], ['2026-12-04', Date.parse('2026-11-29T10:00:00Z'), 'vinted', 'e:VG2', 1]] },
      // La publication de Ventes (centimes, `BENEF_CHAMPS`) : 41 € vendus pour 20 € d'achat ; 60 € au prix d'achat inconnu.
      vrm_benefice_jours: { at: Date.parse('2026-11-30T23:30:00Z'), jours: { '2026-11-10': { n: 1, ca: 4100, nCout: 1, cout: 2000, caCouvert: 4100 }, '2026-11-20': { n: 1, ca: 6000 } } },
      vinted_accounts_hidden: [],
    },
    ventes: { 11: { cap: new Date(DEC1 - 3600000).toISOString(), txns: [], orders: [
      { transaction_id: 301, status: 'Commande finalisée', date: NOV(10), price: { amount: '41.0', currency_code: 'EUR' } },
      { transaction_id: 302, status: 'Commande finalisée', date: NOV(20), price: { amount: '60', currency_code: 'EUR' } },
      { transaction_id: 303, status: 'Commande finalisée', date: new Date(Date.UTC(2026, 9, 25)).toISOString(), price: { amount: '999' } },   // octobre : hors du mois
    ] } },
    txn: [{ tx: '301', s: '450', su: NOV(12) }, { tx: '302', s: '450', su: NOV(22) }, { tx: '303', s: '450', su: new Date(Date.UTC(2026, 9, 27)).toISOString() }],
  },
  [B]: {
    email: 'vendeur.b@exemple.invalid', choix: { actif: false, at: '2026-11-01T00:00:00Z' },
    comptes: [{ vinted_user_id: '22', login: 'vendeur_b' }],
    main: { vinted_regime: 'micro', vinted_urssaf_freq: 'mensuel', vinted_accounts_hidden: [] },
    ventes: { 22: { cap: new Date(DEC1 - 3600000).toISOString(), txns: [], orders: [{ transaction_id: 401, status: 'Commande finalisée', date: NOV(5), price: { amount: '777' } }] } },
    txn: [{ tx: '401', s: '450', su: NOV(6) }],
  },
});

// ── La fausse base (la forme PostgREST : `select=` projeté, `id=like`, `owner=eq`) ─
let V, memos, lus, pannes;
const reset = () => { V = vendeurs(); memos = {}; lus = []; pannes = new Set(); };
const rep = (o, status = 200) => new Response(typeof o === 'string' ? o : JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const chemin = (obj, p) => p.reduce((o, k) => (o == null ? undefined : o[k]), obj);
function projette(ligne, select) {
  if (!select || select === '*') return ligne;
  const out = {};
  for (const item of select.split(',')) {
    const [alias, expr] = item.includes(':') ? item.split(/:(.+)/) : [item, item];
    const morceaux = expr.split(/->>?/); const base = morceaux.shift();
    let v = base === 'meta' ? ligne.meta : base === 'data' ? ligne.data : ligne[base];
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
  for (const t of v.txn) L.push({ id: `harvest_${v.comptes[0].vinted_user_id}_txn_${t.tx}`, meta: { id: t.tx, status: t.s, status_updated_at: t.su }, data: {} });
  L.push({ id: 'lbc_ventes', data: { ventes: {} } });
  L.push({ id: 'ebay_orders', data: { orders: [] } });
  if (v.choix) L.push({ id: 'bilan_mois_choix', data: v.choix });
  for (const [id, data] of Object.entries(memos[o] || {})) L.push({ id, data });
  return L;
};
const filtreId = (id, q) => {
  const eq = /(?:^|&)id=eq\.([^&]+)/.exec(q), like = /(?:^|&)id=like\.([^&]+)/.exec(q);
  if (eq) return id === eq[1];
  if (like) return new RegExp('^' + like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '\u0000').replace(/_/g, '.').replace(/\u0000/g, '.*') + '$').test(id);
  return true;
};
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url)), m = opts.method || 'GET';
  // Supabase Auth (service) : l'adresse DU COMPTE, confirmée.
  const au = /\/auth\/v1\/admin\/users\/([0-9a-f-]{36})/.exec(u);
  if (au) { const v = V[au[1]]; return v ? rep({ id: au[1], email: v.email, email_confirmed_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z', user_metadata: {} }) : rep({}, 404); }
  // La session de Paramètres (api/compte.js) : le jeton « jeton-A » est la session de A.
  if (/\/auth\/v1\/user/.test(u)) { const h = (opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || ''; return /jeton-A/.test(h) ? rep({ id: A, email: V[A].email, created_at: '2026-10-01T00:00:00Z' }) : rep({}, 401); }
  if (!u.includes('/rest/v1/')) return rep({}, 404);
  const [table, q = ''] = u.split('/rest/v1/')[1].split('?');
  const own = ((/(?:^|&)owner=eq\.([^&]+)/.exec(q) || [])[1] || '').toLowerCase() || null;
  if (m === 'POST' && table === 'app_data') {
    let lignes; try { lignes = JSON.parse(opts.body || '[]'); } catch (_) { lignes = []; }
    if (!Array.isArray(lignes)) lignes = [lignes];
    for (const l of lignes) {
      const o = String(l.owner || own || '').toLowerCase();
      if (pannes.has(`ecrire:${o}:${l.id}`)) return rep('<html>522</html>', 522);
      (memos[o] = memos[o] || {})[l.id] = l.data;
    }
    return rep(lignes.map((l) => ({ ...l })), 201);
  }
  if (m === 'PATCH' && table === 'app_data') return rep([], 200);
  lus.push(u);
  const select = (/(?:^|&)select=([^&]+)/.exec(q) || [])[1] || '';
  if (table === 'app_data' && /select=owner&limit=1/.test(q)) return rep([{ owner: A }]);
  if (table === 'app_data' && /id=eq\.main/.test(q) && !own) return rep(Object.keys(V).map((o) => projette({ owner: o, id: 'main', data: V[o].main }, select)));
  if (!own) return rep({ message: 'lecture sans vendeur' }, 400);
  for (const p of pannes) { const [o, motif] = p.split(':'); if (o === own && (table + '?' + q).includes(motif)) return rep('<html>522</html>', 522); }
  if (table === 'vinted_accounts') return rep((V[own] ? V[own].comptes : []).map((c) => projette(c, select)));
  if (table !== 'app_data') return rep([]);
  return rep(lignesDe(own).filter((l) => filtreId(l.id, q)).map((l) => projette({ ...l, owner: own }, select)));
};
const res = () => ({ code: null, corps: null, entetes: {}, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader(k, v) { this.entetes[k] = v; }, send(x) { this.corps = x; return this; }, end() { return this; } });
const vraiNow = Date.now;

// ── --mutations : la règle réaffaiblie dans une COPIE (api/, src/), le banc relancé dessus doit rougir ─────────
const MUTATIONS = [
  ['un mois peut repartir', 'api/_lib/bilan-mois.js', "if (deja && ['envoye', 'incertain', 'en-cours'].includes(deja.issue)) return 'déjà envoyé';", ''],
  ['défaut toujours allumé', 'api/_lib/bilan-mois.js', "if (typeof configure !== 'boolean') return null;\n  return configure;", 'return true;'],
  ['URSSAF retiré', 'api/_lib/bilan-mois.js', 'urssaf: urssafDuResume(main, maintenant) };', 'urssaf: null };'],
  ['colis retirés', 'api/_lib/bilan-mois.js', 'colis: colisDuResume(main, maintenant), ', 'colis: null, '],
  ['réservation ignorée', 'api/_lib/bilan-mois.js', "{ compteur.reste += 1; return 'réservation non confirmée — rien'; }", '{}'],
];
if (process.argv.includes('--mutations')) {
  const { execFileSync } = require('child_process');
  let rouges = 0;
  for (const [nom, fichier, avant, apres] of MUTATIONS) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-mois-'));
    try {
      for (const x of ['api', 'src']) fs.cpSync(path.join(RACINE, x), path.join(d, x), { recursive: true });
      fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(d, 'package.json'));
      fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules'));
      const fi = path.join(d, fichier), t = fs.readFileSync(fi, 'utf8');
      if (!t.includes(avant)) { console.log(`KO  mutation « ${nom} » : texte introuvable`); rouges++; continue; }
      fs.writeFileSync(fi, t.replace(avant, apres));
      let code = 0; try { execFileSync(process.execPath, [__filename], { env: { ...process.env, BANC_RACINE: d }, stdio: 'pipe', timeout: 300000 }); } catch (e) { code = e.status || 1; }
      console.log(code ? `OK  mutation « ${nom} » : le banc rougit` : `KO  mutation « ${nom} » : le banc reste VERT`); if (!code) rouges++;
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  }
  process.exit(rouges ? 1 : 0);
}

(async () => {
  reset();
  const f = await fauxSmtp();
  let cron, compte, smtp;
  try { smtp = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'smtp.js')).href); smtp._banc.connecter = () => new Promise((r, k) => { const s = net.connect({ host: '127.0.0.1', port: f.port }, () => r(s)); s.once('error', k); }); } catch (e) { dit(false, 'api/_lib/smtp.js se charge', e.message); }
  try { cron = (await import(pathToFileURL(path.join(RACINE, 'api', 'ship-reminders.js')).href)).default; } catch (e) { dit(false, 'api/ship-reminders.js se charge', e.message); }
  try { compte = (await import(pathToFileURL(path.join(RACINE, 'api', 'compte.js')).href)).default; } catch (e) { dit(false, 'api/compte.js se charge', e.message); }
  if (!cron || !smtp) { console.log(`\n${ok} OK, ${ko} en échec`); f.serveur.close(); process.exit(1); }
  const lancer = async (t) => { Date.now = () => t; try { const r = res(); await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, r); return r; } finally { Date.now = vraiNow; } };
  const bilans = () => f.recus.map(decoder).filter((m) => /bilan/i.test(m.sujet));
  const de = (email) => bilans().filter((m) => m.a.includes(email));

  console.log('── Le 1er décembre : A (allumé par défaut, envoi configuré) reçoit SON résumé, B (coupé) rien');
  await essaie('1er', async () => {
    reset(); f.recus.length = 0;
    const r = await lancer(DEC1);
    const a = de(V[A].email), b = de(V[B].email);
    dit(a.length === 1 && b.length === 0, 'UN e-mail pour A, à l’adresse de SON compte ; aucun pour B (il l’a coupé)', `A=${a.length} B=${b.length} · code ${r.code}`);
    const m = a[0] || { texte: '', html: '', sujet: '' };
    const t = m.texte.replace(/[\u00a0\u202f]/g, ' ');
    dit(/novembre 2026/.test(m.sujet), 'sujet : le mois écoulé (novembre 2026)', m.sujet);
    dit(/Ventes\s*:?\s*2\b/.test(t) && /101,00 €/.test(t) && !/999|777/.test(t), 'ses 2 ventes de novembre, 101,00 € vendus (octobre et les ventes de B écartés)', t.split('\n').filter((l) => /Vente|Vendu/.test(l)).join(' | '));
    dit(/Reçu\s*:?\s*101,00 €/.test(t), 'reçu : 101,00 €, daté au VERSEMENT (12 et 22 nov.)', t.split('\n').filter((l) => /Reçu/.test(l)).join(' | '));
    dit(/Bénéfice brut\s*:?\s*21,00 €/.test(t) && /sur 1 vente de 2/.test(t) && !/au moins 21/i.test(t), 'bénéfice brut 21,00 € « sur 1 vente de 2 » (un prix d’achat manque), jamais « au moins »', t.split('\n').filter((l) => /Bénéfice/.test(l)).join(' | '));
    dit(/Colis non retirés\s*:?\s*2\b/.test(t), 'colis non retirés : 2 (la liste publiée par l’app, relue par la règle du widget)', t.split('\n').filter((l) => /Colis/.test(l)).join(' | '));
    dit(/À déclarer à l’URSSAF\s*:?\s*12,52 €/.test(t) && /novembre 2026/.test(t), 'à déclarer à l’URSSAF : 12,52 € (101 € × 12,4 %, la règle serveur), période novembre 2026', t.split('\n').filter((l) => /URSSAF/.test(l)).join(' | '));
    dit(/https:\/\/vrm\.center\/\?tab=compta/.test(m.html) && /tab=compta/.test(m.texte), 'un lien vers Argent (l’onglet compta)');
    dit(!/encaiss/i.test(m.texte + m.html), 'jamais « encaissé »');
    const memo = (memos[A] || {}).bilan_mois_envois;
    dit(memo && memo.mois && memo.mois['2026-11'] && memo.mois['2026-11'].issue === 'envoye', 'le mois est noté « envoyé » sous SA clé (2026-11)', JSON.stringify(memo));
    const lectMain = lus.filter((u) => u.includes('owner=eq.' + A) && /id=eq\.main/.test(u));
    dit(lectMain.length > 0 && lectMain.every((u) => !/select=data(&|$)/.test(u)), '`main` toujours lu PROJETÉ (jamais select=data)', lectMain.length);
  });

  console.log('\n── Un seul envoi par mois');
  await essaie('doublon', async () => {
    reset(); f.recus.length = 0;
    await lancer(DEC1); await lancer(DEC1 + 3600000); await lancer(DEC1 + J);
    dit(de(V[A].email).length === 1, 'relancé le jour même puis le 2 décembre : UN seul résumé', de(V[A].email).length);
  });

  console.log('\n── Une écriture ratée ⇒ rien ne part, rejoué au passage suivant');
  await essaie('réservation', async () => {
    reset(); f.recus.length = 0;
    pannes.add(`ecrire:${A}:bilan_mois_envois`);
    await lancer(DEC1);
    dit(de(V[A].email).length === 0, 'la réservation du mois ne s’écrit pas ⇒ aucun e-mail (sinon il pourrait partir deux fois)');
    pannes.clear();
    await lancer(DEC1 + J);
    dit(de(V[A].email).length === 1, 'le passage du lendemain (base revenue) ⇒ il part, une fois', de(V[A].email).length);
  });
  await essaie('mémo illisible', async () => {
    reset(); f.recus.length = 0;
    pannes.add(`${A}:bilan_mois_envois`);
    await lancer(DEC1);
    dit(de(V[A].email).length === 0, 'le mémo du mois illisible ⇒ rien (pas su s’il est déjà parti)');
  });

  console.log('\n── Envoi pas configuré : rien ne part, Paramètres le dit');
  await essaie('pas configuré', async () => {
    reset(); f.recus.length = 0; poserSmtp(false);
    try {
      await lancer(DEC1);
      dit(bilans().length === 0, 'RELANCES_SMTP_* absent ⇒ aucun e-mail, pour personne');
      if (compte) {
        const r = res();
        Date.now = () => DEC1;
        try { await compte({ method: 'GET', headers: { authorization: 'Bearer x.jeton-A.y' }, query: { mode: 'bilan-mois' } }, r); } finally { Date.now = vraiNow; }
        dit(r.corps && r.corps.ok === true && r.corps.configure === false && r.corps.actif === false && r.corps.defaut === true, 'la route de Paramètres dit : envoi pas configuré, éteint (défaut)', JSON.stringify(r.corps));
      }
    } finally { poserSmtp(true); }
    if (compte) {
      const r = res(); Date.now = () => DEC1;
      try { await compte({ method: 'GET', headers: { authorization: 'Bearer x.jeton-A.y' }, query: { mode: 'bilan-mois' } }, r); } finally { Date.now = vraiNow; }
      dit(r.corps && r.corps.configure === true && r.corps.actif === true && r.corps.defaut === true, 'envoi configuré ⇒ la même route dit : allumé par défaut', JSON.stringify(r.corps));
    }
  });

  console.log('\n── Hors de la fenêtre');
  await essaie('le 8', async () => {
    reset(); f.recus.length = 0;
    await lancer(DEC1 + 7 * J);
    dit(bilans().length === 0, 'le 8 décembre : aucun résumé');
  });

  f.serveur.close();
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
