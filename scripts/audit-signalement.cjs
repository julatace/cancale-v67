#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « SIGNALER UN PROBLÈME » ET LA PAGE D'ÉTAT PUBLIQUE (6 nov.)
//          node scripts/audit-signalement.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Il EXÉCUTE (§4.10) la vraie route `api/compte.js?mode=signalement` et
// `?mode=sante` contre une fausse base qui sert la VRAIE FORME (PostgREST :
// filtres, projections `data->>`, `order`, `on_conflict` + `resolution=…`,
// `return=representation`, PATCH conditionnel — scripts/bancs/_minipgrest.cjs).
//   R  la règle : ce qui part = l'aperçu (même fonction, idempotente) ; un jeu
//      inventé RICHE (ventes, pseudos, e-mails, IBAN, jetons, adresse…) passé
//      dans le corps et dans le texte : AUCUNE de ces valeurs n'est rangée, ni
//      notifiée, ni relue ; seuls les champs permis existent ;
//   E  l'envoi : rangé chez le PROPRIÉTAIRE DE L'INSTALLATION (VRM_OWNER_UID,
//      sinon vrm_reglages), jamais chez le vendeur ni chez le NEUTRE ; `de` =
//      l'identifiant de SA session (jamais un champ du corps) ; sans session 401 ;
//   A  anti-abus : 5 par heure et par compte (6ᵉ ⇒ 429, rien d'écrit), tenu même
//      quand 8 envois partent EN MÊME TEMPS ; un autre compte n'est pas bloqué ;
//   P  la notification : lue chez le propriétaire (ses appareils), rangée dans
//      SON centre, une par signalement, regroupée au-delà de 3 dans l'heure ;
//   F  écriture ratée / destinataire pas su / clé absente ⇒ 503, RIEN d'écrit,
//      et l'app (`posterSignalement`, la vraie, branchée sur la route) dit
//      « Pas envoyé », jamais « envoyé » ;
//   L  la liste et « Traité » : au propriétaire seul (403 sinon) ; une lecture
//      ratée n'écrit rien ;
//   S  /api/sante : ses oui/non intacts + `etat` (base · e-mails · notifications
//      · heure), une seule lecture courte (deux scalaires du collecteur, chez le
//      NEUTRE), gardée 30 s en mémoire, `s-maxage=30` ; base tombée ⇒ 'panne',
//      e-mails 'inconnu' (jamais 'ok') ; aucune donnée d'un vendeur ;
//   W  la page /etat : réécriture, aucun script en ligne, ses fichiers existent,
//      le service worker la laisse au réseau.
// `--prouve` : réaffaiblit le code, une mutation à la fois ⇒ ROUGE exigé.
// Données inventées (le dépôt est public).
'use strict';
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path'), fs = require('fs');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const PG = require(path.join(__dirname, 'bancs', '_minipgrest.cjs'));

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['un champ inconnu passe (corps recopié)', 'api/_lib/signalement.js', "  return {\n    texte,\n    ecran: ecranValide(c.ecran),", "  return {\n    ...c,\n    texte,\n    ecran: ecranValide(c.ecran),"],
    ['l’e-mail tapé n’est plus masqué', 'api/_lib/signalement.js', ".replace(/[\\w.+-]+@[\\w-]+\\.[\\w.-]+/g, '{email}')", ''],
    ['plafond 5/h retiré', 'api/_lib/signalement.js', 'for (let k = 1; k <= SIGNALEMENTS_PAR_HEURE; k++) {', 'for (let k = 1; k <= 50; k++) {'],
    ['place prise comptée comme écrite', 'api/_lib/signalement.js', 'if (j.length === 1) return id;', 'return id;'],
    ['rangé chez le vendeur', 'api/_lib/signalement.js', 'body: JSON.stringify([{ owner: proprio, id, data,', 'body: JSON.stringify([{ owner: String(uid), id, data,'],
    ['« envoyé » sans confirmation', 'api/_lib/signalement.js', "if (r.ok && j && j.ok === true && typeof j.id === 'string' && j.id.startsWith(PREFIXE)) return", 'if (true) return'],
    ['liste ouverte à tous', 'api/_lib/signalement.js', "if (String(utilisateur.id).toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };\n  const rows", 'const rows'],
    ['pas de regroupement', 'api/_lib/signalement.js', 'const groupe = Number.isInteger(n) && n > REGROUPER_AU_DELA;', 'const groupe = false;'],
    ['santé sans mémoire de 30 s', 'api/_lib/etat-public.js', 'if (memo && t - memo.t < MEMO_MS) return memo.v;', ''],
    ['collecteur arrêté dit « ok »', 'api/_lib/etat-public.js', "if (age > COLLECTEUR_ARRETE_MS) return 'panne';", "if (age > COLLECTEUR_ARRETE_MS) return 'ok';"],
    ['base tombée : e-mails « ok »', 'api/_lib/etat-public.js', "(env.EMAIL_INBOUND_SECRET ? 'inconnu' : 'panne')", "(env.EMAIL_INBOUND_SECRET ? 'ok' : 'panne')"],
    ['santé sans s-maxage', 'api/compte.js', "res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');", ''],
  ];
  let rouges = 0;
  const sauf = new Map();
  process.on('exit', () => { for (const [f, s] of sauf) fs.writeFileSync(f, s); });
  for (const [nom, rel, avant, apres] of MUTS) {
    const f = path.join(R, rel);
    const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
    sauf.set(f, src);
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 120000 });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); sauf.delete(f); }
  }
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d !== '' && d != null ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 600)); } };

const JULIEN = '11111111-1111-4111-8111-111111111111';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const JETONS = { 'j.julien.x': { id: JULIEN, email: 'editeur@vrm.exemple.test' }, 'j.a.x': { id: A, email: 'client.a@exemple.test' }, 'j.b.x': { id: B, email: 'client.b@exemple.test' }, 'j.c.x': { id: C, email: 'client.c@exemple.test' } };

// ── Le jeu inventé RICHE : tout ce qui ne doit JAMAIS sortir ─────────────────
const SECRETS = {
  pseudo: 'julatace3535', acheteur: 'marie_dupont75', emailCorps: 'vendeuse.secrete@exemple.test', emailTexte: 'perso.julien@exemple.test',
  emailSession: 'client.a@exemple.test', titre: 'Nike Dunk Low Panda T42', prix: '87,50', tx: '18273645501', iban: 'FR7630006000011234567890189',
  jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJiYW5jLXNlY3JldCJ9.c2lnbmF0dXJlLWJhbmM', tel: '06 12 34 56 78', adresse: '12 rue des Lilas', code: 'RETRAIT-9F3K',
  uuidAutre: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', cle: 'sk_live_bancbancbancbanc',
};
const corpsRiche = () => ({
  texte: `Ventes vides depuis ce matin. Mon mail ${SECRETS.emailTexte}, iban ${SECRETS.iban}, tel ${SECRETS.tel}, tx ${SECRETS.tx}, jeton ${SECRETS.jwt}, id ${SECRETS.uuidAutre}, apikey=${SECRETS.cle}`,
  ecran: 'ventes', ecranAvant: 'colis; drop table', version: '6 novembre à 14:32', extension: '5.322.0', navigateur: SECRETS.pseudo,
  ecranTaille: { largeur: 390, hauteur: 844, pseudo: SECRETS.pseudo },
  plantages: [
    { message: `Cannot read properties of undefined (reading 'numero') ${SECRETS.emailCorps}`, ecran: 'ventes', origine: 'ecran', version: '6 novembre à 14:32', at: '2026-11-06T09:00:00Z', pile: `at x (https://vrm.center/assets/App.js?token=${SECRETS.cle})`, acheteur: SECRETS.acheteur },
    { message: 'x', ecran: SECRETS.pseudo, origine: SECRETS.adresse, version: SECRETS.titre, at: 'pas une date' },
  ],
  de: SECRETS.uuidAutre, owner: SECRETS.uuidAutre, at: '2001-01-01T00:00:00Z', traite: true,
  pseudo: SECRETS.pseudo, email: SECRETS.emailCorps, iban: SECRETS.iban, adresse: SECRETS.adresse,
  ventes: [{ title: SECRETS.titre, price: { amount: SECRETS.prix }, buyer: SECRETS.acheteur, transaction_id: SECRETS.tx, code: SECRETS.code }],
  main: { vinted_account_labels: { 1: SECRETS.pseudo } },
});
const CHAMPS = ['texte', 'ecran', 'ecranAvant', 'version', 'extension', 'navigateur', 'ecranTaille', 'plantages'];

// ── La fausse base (forme PostgREST) ─────────────────────────────────────────
let rows, reglages, journal, pannes;
const reinit = () => {
  rows = [
    // Des lignes de vendeurs : la santé et l'envoi ne doivent RIEN en lire.
    { owner: A, id: 'main', data: { vinted_account_labels: { 1: SECRETS.pseudo }, ventes: [{ title: SECRETS.titre }] } },
    { owner: A, id: 'push_subs', data: { subs: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/banc-a', keys: { p256dh: 'x', auth: 'y' } }] } },
    { owner: JULIEN, id: 'push_subs', data: { subs: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/banc-julien', keys: { p256dh: 'x', auth: 'y' } }] } },
    { owner: NEUTRE, id: 'vrm_email_collecteur_succes', data: { at: new Date(Date.now() - 120e3).toISOString(), etat: 'succes', version: 3 } },
    { owner: NEUTRE, id: 'vrm_email_collecteur_passage', data: { at: new Date(Date.now() - 125e3).toISOString(), etat: 'debut', version: 3 } },
  ];
  reglages = { proprietaire: JULIEN };
  journal = [];
  pannes = { ecriture: false, lecture: false, base: false, reglages: false };
};
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const filtrer = (url) => { const u = new URL(url); const keep = []; for (const r of rows) { const res = PG.servir([r], url, {}); if (res.body.length) keep.push(r); } return keep; };
global.fetch = async (url, o = {}) => {
  const s = String(url);
  const u = new URL(s);
  const p = u.pathname, m = (o.method || 'GET').toUpperCase();
  const h = Object.fromEntries(Object.entries(o.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  journal.push({ m, url: decodeURIComponent(s), corps: o.body ? String(o.body) : '' });
  if (pannes.base) throw new TypeError('fetch failed');
  if (p.endsWith('/auth/v1/user')) { const t = String(h.authorization || '').replace(/^Bearer /, ''); const x = JETONS[t]; return x ? rep(x) : rep({ msg: 'jwt' }, 401); }
  if (p.endsWith('/rpc/vrm_acces_pour')) return rep(true);
  if (p.endsWith('/rpc/vrm_acces')) return rep({ obligatoire: false, proprietaire: false, acces: true });
  if (p.endsWith('/rest/v1/vrm_reglages')) {
    if (pannes.reglages) return rep('<html>522</html>', 522);
    const cle = (u.searchParams.get('cle') || '').replace(/^eq\./, '');
    return rep(reglages[cle] ? [{ valeur: reglages[cle] }] : []);
  }
  if (!p.endsWith('/rest/v1/app_data')) return rep([]);
  if (m === 'GET' || m === 'HEAD') {
    if (pannes.lecture) return rep('<html>522</html>', 522);
    return rep(PG.servir(rows, s, h).body);
  }
  if (pannes.ecriture) return rep('<html>522</html>', 522);
  const retour = String(h.prefer || '').includes('return=representation');
  if (m === 'POST') {
    const lignes = JSON.parse(o.body || '[]');
    const ignore = String(h.prefer || '').includes('resolution=ignore-duplicates');
    const faites = [];
    for (const l of lignes) {
      const i = rows.findIndex((r) => r.owner === l.owner && r.id === l.id);
      if (i >= 0 && ignore) continue;
      const ligne = { owner: l.owner, id: l.id, data: JSON.parse(JSON.stringify(l.data)), updated_at: l.updated_at };
      if (i >= 0) rows[i] = ligne; else rows.push(ligne);
      faites.push(ligne);
    }
    return retour ? rep(faites.map((r) => ({ id: r.id, owner: r.owner, data: r.data })), 201) : rep('', 201);
  }
  if (m === 'PATCH') {
    const cibles = filtrer(s);
    const maj = JSON.parse(o.body || '{}');
    for (const r of cibles) Object.assign(r, JSON.parse(JSON.stringify(maj)));
    return retour ? rep(cibles.map((r) => ({ id: r.id }))) : rep('', 204);
  }
  return rep([]);
};
const faireRes = () => { const x = { code: null, corps: null, entetes: {} }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.send = (b) => { x.corps = b; return x; }; x.setHeader = (a, b) => { x.entetes[a] = b; }; x.end = () => x; return x; };
const lignesSignalements = () => rows.filter((r) => /^signalement_/.test(r.id));

(async () => {
  process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
  process.env.EMAIL_INBOUND_SECRET = 'secret-de-banc';
  delete process.env.VRM_OWNER_UID;
  delete process.env.VAPID_PRIVATE_KEY;
  reinit();
  const SIG = await import('file://' + path.join(R, 'api', '_lib', 'signalement.js'));
  const ETAT = await import('file://' + path.join(R, 'api', '_lib', 'etat-public.js'));
  const compte = await import('file://' + path.join(R, 'api', 'compte.js'));
  // L'heure est TENUE (une heure qui tourne pendant le banc changerait de plage).
  const vraiNow = Date.now; let decal = 0;
  const T0 = Date.parse('2026-11-06T10:20:00Z');
  Date.now = () => T0 + decal;
  reinit();
  const route = async (jeton, { methode = 'POST', corps, mode = 'signalement' } = {}) => {
    const res = faireRes();
    await compte.default({ method: methode, query: { mode }, headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, body: corps }, res);
    return res;
  };
  // L'app, la VRAIE fonction d'envoi, branchée sur la route.
  const fetcherApp = (jeton) => async (_url, o) => { const res = await route(jeton, { corps: JSON.parse(o.body) }); return rep(res.corps, res.code); };

  console.log('── R. la règle : ce qui part = l’aperçu, et rien de ses données');
  await essaie('R', async () => {
    const ap = SIG.normaliserSignalement(corpsRiche());
    dit(ap && JSON.stringify(Object.keys(ap)) === JSON.stringify(CHAMPS), 'l’aperçu n’a QUE les champs permis', ap && Object.keys(ap));
    dit(JSON.stringify(SIG.normaliserSignalement(ap)) === JSON.stringify(ap), 'la règle est idempotente : rejouée par le serveur, l’aperçu ne change pas');
    const fuite = Object.entries(SECRETS).filter(([, v]) => JSON.stringify(ap).includes(v));
    dit(!fuite.length, 'aucune valeur du jeu inventé dans l’aperçu (e-mails, IBAN, jeton, n°, pseudo, titre, adresse…)', fuite.map(([k]) => k));
    dit(ap.navigateur === 'inconnu' && ap.ecranAvant === '' && ap.ecranTaille.largeur === 390 && ap.extension === '5.322.0' && ap.plantages.length === 2 && ap.plantages[1].ecran === '' && ap.plantages[1].at === null, 'un champ hors règle est vidé (navigateur inconnu, écran mal formé, date illisible)', ap);
    dit(SIG.normaliserSignalement({ texte: '  ' }) === null && SIG.normaliserSignalement(null) === null, 'sans texte : rien ne part');
    // Les navigateurs permis = ceux que l'app sait nommer (src/navigateurExtension.js).
    const src = fs.readFileSync(path.join(R, 'src', 'navigateurExtension.js'), 'utf8');
    const nom = /const NOM_NAV = (\{[^}]*\})/.exec(src);
    const noms = nom ? Object.values(Function('return ' + nom[1])()) : [];
    dit(noms.length && JSON.stringify([...noms].sort()) === JSON.stringify([...SIG.NAVIGATEURS].sort()), 'les navigateurs permis sont ceux que nomme l’app (NOM_NAV)', noms);
    // Les écrans permis : chaque `tab` de l'app (sinon un vrai écran partirait vide).
    const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
    const ol = /const ONGLETS_LIENS=\[([^\]]*)\]/.exec(app);
    const tabs = new Set([...(ol ? ol[1].match(/'([a-z_]+)'/g) || [] : []).map((x) => x.slice(1, -1)), ...[...app.matchAll(/tab===['"]([a-z_]+)['"]/g)].map((m) => m[1])]);
    const manque = [...tabs].filter((t) => !SIG.ECRANS.includes(t));
    dit(tabs.size > 20 && !manque.length, `chaque écran de l’app est un écran permis (${tabs.size})`, manque);
  });

  console.log('\n── E. l’envoi, par la vraie route');
  let apercuEnvoye = null;
  await essaie('E', async () => {
    const r0 = await route(null, { corps: corpsRiche() });
    dit(r0.code === 401 && !lignesSignalements().length, 'sans session : 401, rien d’écrit', r0.code);
    journal = [];
    apercuEnvoye = SIG.normaliserSignalement(corpsRiche());
    // L'app envoie l'APERÇU (src/composants/SignalerProbleme.jsx) — mais on envoie
    // ici le corps RICHE brut : le serveur doit tenir seul.
    const r = await route('j.a.x', { corps: corpsRiche() });
    dit(r.code === 200 && r.corps.ok === true && /^signalement_2026110610_aaaaaaaaaaaa_1$/.test(r.corps.id), 'envoyé : 200, id de la plage et du compte', r.corps);
    const l = lignesSignalements();
    dit(l.length === 1 && l[0].owner === JULIEN, 'rangé chez le PROPRIÉTAIRE de l’installation (vrm_reglages), ni chez le vendeur ni chez le neutre', l.map((x) => x.owner));
    const d = l[0] && l[0].data;
    dit(d && d.de === A && d.at === new Date(T0).toISOString() && d.traite === false, '`de` = l’identifiant de SA session (le `de` du corps est ignoré), l’heure du serveur', d && { de: d.de, at: d.at, traite: d.traite });
    const { de, at, traite, ...reste } = d || {};
    dit(JSON.stringify(reste) === JSON.stringify(apercuEnvoye), 'ce qui est rangé = EXACTEMENT l’aperçu montré (même règle)', reste);
    const brut = JSON.stringify(rows.filter((x) => /^signalement_/.test(x.id) || x.id === 'push_journal'));
    const fuite = Object.entries(SECRETS).filter(([, v]) => brut.includes(v));
    dit(!fuite.length, 'aucune valeur du jeu inventé dans la base (signalement ET centre des notifications) — ni l’e-mail de sa session', fuite.map(([k]) => k));
    dit(!rows.some((x) => x.owner === NEUTRE && /signalement/.test(x.id)), 'rien chez le propriétaire NEUTRE');
  });

  console.log('\n── P. la notification au propriétaire');
  await essaie('P', async () => {
    const lus = journal.filter((j) => j.m === 'GET' && /id=eq\.push_subs/.test(j.url));
    dit(lus.length >= 1 && lus.every((j) => j.url.includes(`owner=eq.${JULIEN}`)), 'les appareils lus sont ceux du PROPRIÉTAIRE (jamais ceux du vendeur qui signale)', lus.map((j) => j.url.slice(-80)));
    const jn = rows.find((x) => x.owner === JULIEN && x.id === 'push_journal');
    const e = jn && jn.data && Array.isArray(jn.data.entrees) ? jn.data.entrees : [];
    dit(e.length === 1 && e[0].cat === 'signalement' && /Problème signalé/.test(e[0].titre) && /signalements/.test(e[0].url || ''), 'une entrée « Problème signalé » dans SON centre, qui mène à la liste', e);
    dit(!rows.some((x) => x.owner === A && x.id === 'push_journal'), 'rien dans le centre du vendeur qui signale');
  });

  console.log('\n── A. anti-abus : 5 par heure et par compte');
  await essaie('A', async () => {
    for (let i = 2; i <= 5; i++) { decal += 1000; await route('j.a.x', { corps: { texte: `Essai numéro ${i} du banc` } }); }
    const avant = lignesSignalements().length;
    decal += 1000;
    const r6 = await route('j.a.x', { corps: { texte: 'Sixième essai du banc' } });
    dit(r6.code === 429 && r6.corps.ok === false && r6.corps.raison === 'trop' && lignesSignalements().length === avant && avant === 5, '6ᵉ dans l’heure : 429, rien d’écrit', { code: r6.code, avant, apres: lignesSignalements().length });
    const ph = SIG.phraseRefus({ envoye: false, raison: 'trop', reessayerDans: r6.corps.reessayerDans });
    dit(/^Pas envoyé : 5 signalements par heure au plus\. Réessaie dans 40 min\.$/.test(ph), 'l’app dit pourquoi et quand réessayer', ph);
    decal += 1000;
    const rb = await route('j.b.x', { corps: { texte: 'Le compte B, pas bloqué' } });
    dit(rb.code === 200 && rb.corps.ok === true, 'un autre compte n’est pas bloqué');
    // 8 envois EN MÊME TEMPS : la base tient la place, jamais plus de 5.
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => route('j.c.x', { corps: { texte: `Rafale ${i} du banc` } })));
    const oks = rs.filter((x) => x.code === 200).length, trop = rs.filter((x) => x.code === 429).length;
    dit(oks === 5 && trop === 3 && lignesSignalements().filter((x) => x.data.de === C).length === 5, '8 envois simultanés : 5 rangés, 3 refusés (429)', { oks, trop });
    // L'heure suivante, la place revient.
    decal += 3600e3;
    const rn = await route('j.a.x', { corps: { texte: 'Une heure plus tard' } });
    dit(rn.code === 200 && /_2026110611_/.test(rn.corps.id), 'l’heure suivante : il peut de nouveau signaler', rn.corps);
    decal -= 3600e3;
  });

  console.log('\n── P2. regroupées au-delà de 3 dans l’heure');
  await essaie('P2', async () => {
    const jn = rows.find((x) => x.owner === JULIEN && x.id === 'push_journal');
    const e = (jn && jn.data && jn.data.entrees) || [];
    const titres = e.filter((x) => x.cat === 'signalement').map((x) => x.titre);
    dit(titres.length >= 6 && titres.filter((t) => t === '🛟 Problème signalé').length === 3, 'les 3 premiers de l’heure : une notification chacun', titres.slice(0, 6));
    dit(titres.some((t) => /^🛟 4 problèmes signalés depuis une heure$/.test(t)) && titres.some((t) => /^🛟 6 problèmes signalés depuis une heure$/.test(t)), 'au-delà : regroupées, le titre dit combien', titres.slice(0, 8));
    const n = SIG.notifSignalement({ id: 'signalement_x', s: { texte: 'abc', ecran: 'ventes' }, n: 5 });
    dit(n.tag === 'vrm-signalements' && SIG.notifSignalement({ id: 'signalement_x', s: { texte: 'abc', ecran: '' }, n: 2 }).tag === 'signalement-signalement_x', 'regroupées = une seule notification qui se remplace (même étiquette)');
  });

  console.log('\n── F. ce qui n’est pas rangé se dit « pas envoyé »');
  await essaie('F', async () => {
    const env = (jeton) => SIG.posterSignalement(SIG.normaliserSignalement({ texte: 'Un vrai problème du banc' }), { fetcher: fetcherApp(jeton) });
    decal += 5000;
    const n0 = lignesSignalements().length;
    pannes.ecriture = true;
    const r = await route('j.julien.x', { corps: { texte: 'Écriture ratée du banc' } });
    const a = await env('j.julien.x');
    pannes.ecriture = false;
    dit(r.code === 503 && r.corps.ok === false && lignesSignalements().length === n0, 'écriture ratée : 503, rien d’écrit', r);
    dit(a.envoye === false && /^Pas envoyé/.test(SIG.phraseRefus(a)), 'l’app dit « Pas envoyé » (jamais « envoyé »)', a);
    pannes.reglages = true;
    const r2 = await route('j.julien.x', { corps: { texte: 'Destinataire inconnu du banc' } });
    pannes.reglages = false;
    dit(r2.code === 503 && r2.corps.raison === 'destinataire-inconnu' && lignesSignalements().length === n0, 'propriétaire pas su : 503, rien d’écrit nulle part (pas chez le neutre)', r2.corps);
    const sk = process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_SERVICE_KEY;
    const r3 = await route('j.julien.x', { corps: { texte: 'Sans clé de service' } });
    process.env.SUPABASE_SERVICE_KEY = sk;
    dit(r3.code === 503 && lignesSignalements().length === n0, 'clé de service absente : 503, rien d’écrit', r3.corps);
    const a2 = await SIG.posterSignalement({ texte: 'x' }, { fetcher: async () => rep({ ok: true }, 200) });
    const a3 = await SIG.posterSignalement({ texte: 'x' }, { fetcher: async () => { throw new TypeError('fetch failed'); } });
    const a4 = await SIG.posterSignalement({ texte: 'x' }, { fetcher: async () => new Response('<html>502</html>', { status: 502 }) });
    dit(a2.envoye === false && a3.envoye === false && a4.envoye === false, 'réponse sans id rangé, réseau coupé, 502 : « pas envoyé »', [a2, a3, a4]);
    const a5 = await env('j.julien.x');
    dit(a5.envoye === true && /^signalement_/.test(a5.id), 'et quand le serveur confirme : « envoyé »', a5);
    // VRM_OWNER_UID d'abord (la variable de l'installation).
    process.env.VRM_OWNER_UID = JULIEN; reglages = {};
    decal += 1000;
    const r4 = await route('j.b.x', { corps: { texte: 'Avec la variable de l’installation' } });
    delete process.env.VRM_OWNER_UID; reglages = { proprietaire: JULIEN };
    dit(r4.code === 200 && lignesSignalements().find((x) => x.id === r4.corps.id).owner === JULIEN, 'VRM_OWNER_UID désigne le propriétaire quand elle est posée', r4.corps);
  });

  console.log('\n── L. la liste et « Traité » : au propriétaire seul');
  await essaie('L', async () => {
    const ra = await route('j.a.x', { methode: 'GET' });
    dit(ra.code === 403 && !ra.corps.signalements, 'un client : 403, rien de lu', ra.corps);
    const rj = await route('j.julien.x', { methode: 'GET' });
    const l = rj.corps && rj.corps.signalements;
    dit(rj.code === 200 && Array.isArray(l) && l.length === lignesSignalements().length && l.every((x, i) => i === 0 || String(l[i - 1].at) >= String(x.at)), 'Julien : toute la liste, la plus récente en tête', rj.corps && rj.corps.nonTraites);
    const fuite = Object.entries(SECRETS).filter(([, v]) => JSON.stringify(rj.corps).includes(v));
    dit(!fuite.length, 'la liste ne relit aucune valeur du jeu inventé', fuite.map(([k]) => k));
    const id = l[l.length - 1].id;
    const ta = await route('j.a.x', { corps: { action: 'traite', id, traite: true } });
    dit(ta.code === 403 && rows.find((x) => x.id === id).data.traite === false, 'un client ne marque rien « traité » (403)');
    pannes.lecture = true;
    const tr = await route('j.julien.x', { corps: { action: 'traite', id, traite: true } });
    pannes.lecture = false;
    dit(tr.code === 503 && rows.find((x) => x.id === id).data.traite === false && !journal.slice(-3).some((j) => j.m === 'PATCH'), 'lecture ratée : rien d’écrit', tr.corps);
    const tj = await route('j.julien.x', { corps: { action: 'traite', id, traite: true } });
    const d = rows.find((x) => x.id === id).data;
    dit(tj.code === 200 && d.traite === true && d.texte && d.de, '« Traité » : la ligne garde tout, porte traite=true', d);
    const rj2 = await route('j.julien.x', { methode: 'GET' });
    dit(rj2.corps.nonTraites === l.length - 1, 'le compte « à traiter » descend d’un');
  });

  console.log('\n── S. /api/sante et l’état public');
  await essaie('S', async () => {
    ETAT.oublierEtat(); journal = [];
    const s1 = await route(null, { methode: 'GET', mode: 'sante' });
    const c = s1.corps || {};
    const oui = ['ok', 'serviceKey', 'owner', 'ia', 'detourage', 'stripe', 'stripeWebhook', 'relancesEssai'];
    dit(s1.code === 200 && oui.every((k) => typeof c[k] === 'boolean'), 'ses oui/non sont intacts', c);
    dit(c.etat && c.etat.base === 'ok' && c.etat.emails === 'ok' && c.etat.notifications === 'panne' && c.etat.verifieA === new Date(Date.now()).toISOString(), 'etat : base ok, e-mails ok (collecteur passé il y a 2 min), notifications en panne (clé VAPID absente)', c.etat);
    dit(/s-maxage=30/.test(s1.entetes['Cache-Control'] || ''), 'Cache-Control : s-maxage=30', s1.entetes);
    const lu = journal.filter((j) => /\/rest\/v1\//.test(j.url));
    dit(lu.length === 1 && lu[0].url.includes(`owner=eq.${NEUTRE}`) && /select=id,at:data->>at,etat:data->>etat/.test(lu[0].url) && !/select=data(&|$)/.test(lu[0].url), 'UNE lecture courte : deux scalaires du collecteur, chez le neutre (jamais `select=data`)', lu.map((x) => x.url));
    const fuite = Object.entries(SECRETS).filter(([, v]) => JSON.stringify(c).includes(v));
    dit(!fuite.length && !JSON.stringify(c).includes(A), 'aucune donnée d’un vendeur dans la réponse', fuite);
    decal += 20e3; journal = [];
    const s2 = await route(null, { methode: 'GET', mode: 'sante' });
    dit(!journal.some((j) => /\/rest\/v1\//.test(j.url)) && s2.corps.etat.verifieA === c.etat.verifieA, 'dans les 30 s : la mémoire répond, la base n’est pas relue');
    decal += 11e3; pannes.base = true;
    const s3 = await route(null, { methode: 'GET', mode: 'sante' });
    pannes.base = false;
    dit(s3.code === 200 && s3.corps.ok === true && s3.corps.etat.base === 'panne' && s3.corps.etat.emails === 'inconnu', 'après 30 s, base tombée : base « panne », e-mails « inconnu » (pas su, jamais « ok »)', s3.corps.etat);
  });

  console.log('\n── S2. la règle des e-mails');
  await essaie('S2', async () => {
    const t = T0, mn = 60e3;
    const L = (passage, succes) => [passage && { id: 'vrm_email_collecteur_passage', ...passage }, succes && { id: 'vrm_email_collecteur_succes', ...succes }].filter(Boolean);
    const cas = [
      ['clé de réception absente', { secret: false, lignes: L(null, { at: new Date(t - mn).toISOString() }) }, 'panne'],
      ['pas lu', { secret: true, lignes: null }, 'inconnu'],
      ['jamais vu', { secret: true, lignes: [] }, 'inconnu'],
      ['passé il y a 2 min', { secret: true, lignes: L({ at: new Date(t - 2 * mn).toISOString(), etat: 'debut' }, { at: new Date(t - 2 * mn).toISOString() }) }, 'ok'],
      ['plus de passage depuis 45 min', { secret: true, lignes: L(null, { at: new Date(t - 45 * mn).toISOString() }) }, 'panne'],
      ['retiré depuis 10 jours', { secret: true, lignes: L(null, { at: new Date(t - 10 * 86400e3).toISOString() }) }, 'inconnu'],
      ['erreur, dernier succès il y a 20 min', { secret: true, lignes: L({ at: new Date(t - mn).toISOString(), etat: 'erreur' }, { at: new Date(t - 20 * mn).toISOString() }) }, 'panne'],
      ['erreur passagère (succès il y a 5 min)', { secret: true, lignes: L({ at: new Date(t - mn).toISOString(), etat: 'erreur' }, { at: new Date(t - 5 * mn).toISOString() }) }, 'ok'],
    ];
    for (const [nom, arg, att] of cas) { const v = ETAT.etatEmails({ ...arg, maintenant: t }); dit(v === att, `e-mails — ${nom} : ${att}`, v); }
    const e1 = await ETAT.sonderEtat({ env: { SUPABASE_SERVICE_KEY: 'k', EMAIL_INBOUND_SECRET: 's' }, pushPret: true, fetcher: async () => rep([]), maintenant: t });
    const e2 = await ETAT.sonderEtat({ env: { EMAIL_INBOUND_SECRET: 's' }, anon: 'anon', pushPret: true, fetcher: async () => rep([]), maintenant: t });
    dit(e1.notifications === 'ok' && e2.notifications === 'panne' && e2.base === 'ok' && e2.emails === 'inconnu', 'notifications : clé VAPID ET clé de service ; sans clé de service, e-mails « inconnu »', [e1, e2]);
  });

  console.log('\n── W. la page /etat');
  await essaie('W', async () => {
    const v = JSON.parse(fs.readFileSync(path.join(R, 'vercel.json'), 'utf8'));
    dit((v.rewrites || []).some((x) => x.source === '/etat' && x.destination === '/etat.html'), 'vercel.json : /etat → /etat.html');
    const html = fs.readFileSync(path.join(R, 'public', 'etat.html'), 'utf8');
    const enLigne = html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || [];
    dit(!enLigne.length && !/\son[a-z]+="/i.test(html), 'aucun script ni gestionnaire en ligne (la CSP n’en permet aucun)');
    const srcs = [...html.matchAll(/<(?:script|img|link)[^>]*\b(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
    dit(srcs.length && srcs.every((f) => fs.existsSync(path.join(R, 'public', f))), 'ses fichiers existent dans public/', srcs);
    const js = fs.readFileSync(path.join(R, 'public', 'etat.js'), 'utf8');
    dit(/fetch\(url/.test(js) && /'\/api\/sante'/.test(js) && /visibilityState === 'visible'/.test(js) && /PERIODE = 60000/.test(js), 'elle lit /api/sante, toutes les 60 s, seulement page visible');
    dit(!/supabase|localStorage\.setItem|vrm_session|access_token/i.test(js), 'elle ne lit ni la base ni la session (aucune donnée d’un vendeur)');
    const sw = fs.readFileSync(path.join(R, 'public', 'sw.js'), 'utf8');
    const iE = sw.indexOf("url.pathname === '/etat'"), iN = sw.indexOf("if (req.mode === 'navigate') {");
    dit(iE > 0 && iE < iN, 'le service worker la laisse au réseau (elle ne remplace jamais l’app en cache)');
    const vite = fs.readFileSync(path.join(R, 'vite.config.js'), 'utf8');
    dit(/fileName: 'etat-version\.json'/.test(vite) && /vinted-sync-extension\/manifest\.json/.test(vite), 'la version servie est posée au build depuis le manifeste (rien à tenir à la main)');
  });

  Date.now = vraiNow;
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
