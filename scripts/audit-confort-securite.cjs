#!/usr/bin/env node
// ── audit-confort-securite — LES LOTS 117 À 130 DU 14 NOVEMBRE ────────────────────
// Exécute les VRAIES règles (aucune copie) sur des données INVENTÉES (dépôt public) :
//   Q  119 connexion par QR (api/_lib/qr-connexion.js, la route ENTIÈRE avec une base
//      et un Supabase de doublure) : sans clic de l'iPhone ⇒ rien ; défi rejoué ⇒
//      refusé ; expiré ⇒ refusé ; ticket altéré ⇒ refusé ; mauvais secret ⇒ refusé ;
//      double vérification ⇒ aal2 exigé ; deux récupérations simultanées ⇒ une seule
//      session ; la session vient de la fabrique du serveur (jamais le jeton de l'iPhone) ;
//   L  120 lien d'aide (api/_lib/lien-aide.js) : aucun montant dans la projection (clés
//      en liste blanche, aucun « € » même glissé dans un titre) ; expiré, révoqué,
//      altéré, d'un autre vendeur, inconnu ⇒ 404 ; chaque ouverture journalisée ; un
//      bordereau hors liste ⇒ 404 ; un journal relu avant « Couper » ne ré-ouvre jamais ;
//      lecture seule ; 3 liens actifs au plus ; aucune 016 demandée ;
//   C  127 code local (src/codeLocal.js, WebCrypto de Node) : jamais le code en clair
//      dans le stockage, salé (deux poses ⇒ deux empreintes), 5 erreurs ⇒ déconnexion
//      et code effacé, verrou à l'ouverture et après N min cachée ;
//   T  129 inventaire tournant (src/inventaireTournant.js) : tirage déterministe par
//      jour, parmi les présentes seulement, JAMAIS un N° modifié (entrées gelées, N°
//      rendus tels quels), « pas trouvé » ⇒ un signal, rien supprimé ;
//   J  117 Ma journée selon l'heure ; A 118 atelier (lecture seule, « pas su ») ;
//   D  126 échanges du dossier (identité exacte du n°, rien de l'acheteur, PDF réel) ;
//   P  128 aperçu (rendu local, aucune requête) ; M 130 carte merci (rien de l'acheteur).
//   + le branchement (App.jsx, Réglages, Stock, Créer sur Vinted, api/compte.js).
//   node scripts/audit-confort-securite.cjs                 la règle du dépôt
//   node scripts/audit-confort-securite.cjs --mutation=NOM  une règle réaffaiblie (doit rougir)
//   node scripts/audit-confort-securite.cjs --prouve        toutes les mutations : chacune doit rougir
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { webcrypto } = require('crypto');
const RACINE = path.join(__dirname, '..');

const FICHIERS = ['api/_lib/qr-connexion.js', 'api/_lib/lien-aide.js', 'src/lienAideProjection.js', 'src/codeLocal.js', 'src/inventaireTournant.js',
  'src/journeeSelonHeure.js', 'src/atelierEcran.js', 'src/dossierLitige.js', 'src/dateParis.js', 'src/apercuAnnonce.js', 'src/carteMerci.js'];
// [fichier, ancre, remplacement]
const MUTATIONS = {
  'qr-sans-clic': ['api/_lib/qr-connexion.js', "if (!l) return { status: 200, body: { ok: true, etat: 'attente', exp: tk.exp } };", "if (!l) { const s0 = await auth.session('u-julien', 'j@exemple.test'); return { status: 200, body: { ok: true, etat: 'connecte', session: s0 } }; }"],
  'qr-rejoue': ['api/_lib/qr-connexion.js', "const g = await depot.remplacerSi(id, 'approuve', { ...d, etat: 'consomme', consommeAt: maintenant, rev: (Number(d.rev) || 0) + 1 });", 'const g = true;'],
  'qr-sans-expiration': ['api/_lib/qr-connexion.js', "if (!(maintenant < c.e)) return { refus: 'expire' };", ''],
  'qr-sans-signature': ['api/_lib/qr-connexion.js', "if (!egal(sig, attendu)) return { refus: 'ticket' };", ''],
  'qr-sans-secret': ['api/_lib/qr-connexion.js', "if (!egal(sha(String(corps.secret || '')), tk.h)) return { status: 403, body: { erreur: 'secret' } };", ''],
  'qr-sans-mfa': ['api/_lib/qr-connexion.js', "if (aDoubleVerif(u) && aalDe(jeton) !== 'aal2') return { status: 403, body: { erreur: 'mfa' } };", ''],
  'aide-montant': ['src/lienAideProjection.js', "pdf: (Array.isArray(e && e.pdf)", "prix: e && e.prix, pdf: (Array.isArray(e && e.pdf)"],
  'aide-euro-titre': ['src/lienAideProjection.js', ".replace(SANS_MONTANT, '')", ''],
  'aide-sans-expiration': ['api/_lib/lien-aide.js', '  if (!(maintenant < j.exp)) return false;\n', ''],
  'aide-sans-revocation': ['api/_lib/lien-aide.js', '  if (d.revoque) return false;\n', ''],
  'aide-journal-ecrase': ['api/_lib/lien-aide.js', ".slice(-MAX_JOURNAL) }, { siActif: true })", '.slice(-MAX_JOURNAL) })'],
  'aide-bord-libre': ['api/_lib/lien-aide.js', 'if (!permis || !PDF_OK.test(bord)) return NON_TROUVE;', 'if (!PDF_OK.test(bord)) return NON_TROUVE;'],
  'aide-sans-journal': ['api/_lib/lien-aide.js', "    await noter('ouvert');\n", ''],
  'code-en-clair': ['src/codeLocal.js', "return { v: 1, sel: selB64,", "return { v: 1, clair: String(code), sel: selB64,"],
  'code-sans-sel': ['src/codeLocal.js', 'const sel = new Uint8Array(16); alea(sel);', 'const sel = new Uint8Array(16);'],
  'code-sans-plafond': ['src/codeLocal.js', 'if (erreurs >= CODE_ERREURS_MAX) {', 'if (false) {'],
  'tournant-hasard': ['src/inventaireTournant.js', 'note: fnv1a(`${jour}·${uid}·${cle}`)', 'note: Math.floor(Math.random() * 1e9)'],
  'tournant-vendues': ['src/inventaireTournant.js', "    if (u.etat === 'aconfirmer' || u.etat === 'vendu') continue;\n", ''],
  'tournant-numero-change': ['src/inventaireTournant.js', 'numero: String(u.numero),', "numero: String(Number(u.numero) || u.numero),"],
  'tournant-sans-signal': ['src/inventaireTournant.js', "absents[k] = absents[k] || at; faits[k] = 'absent';", "faits[k] = 'absent';"],
  'heure-ignore-sien': ['src/journeeSelonHeure.js', '  if (sienOrdre) return liste;\n', ''],
  'heure-fixe-bouge': ['src/journeeSelonHeure.js', "  liste.forEach((id, i) => { if (estFixe(id)) range.splice(Math.min(i, range.length), 0, id); });\n", "  liste.forEach((id) => { if (estFixe(id)) range.push(id); });\n"],
  'atelier-autre-jour': ['src/atelierEcran.js', ' && jourCle(Number(benefice.at)) === auj', ''],
  'echanges-ressemblance': ['src/dossierLitige.js', "filter((c) => c && str(c.tx) === t)", "filter((c) => c && str(c.tx).startsWith(t))"],
  'echanges-pseudo': ['src/dossierLitige.js', "map((x) => ({ de: x.de, quand:", "map((x) => ({ qui: miennes[0].opp, de: x.de, quand:"],
  'merci-acheteur': ['src/carteMerci.js', '  return {\n    signature: net(r.signature', '  return {\n    ...r,\n    signature: net(r.signature'],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ${rouge ? 'rougit' : 'RESTE VERTE'}`);
    if (rouge) ok++;
  }
  console.log(ok === Object.keys(MUTATIONS).length ? `\n✅ ${ok} mutations, toutes rouges` : `\n❌ ${Object.keys(MUTATIONS).length - ok} mutation(s) restent vertes`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

// Les modules, copiés dans un dossier temporaire (la mutation s'y applique), importés de là.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-confort-'));
fs.writeFileSync(path.join(TMP, 'package.json'), '{"type":"module"}');
for (const f of FICHIERS) {
  const dst = path.join(TMP, f); fs.mkdirSync(path.dirname(dst), { recursive: true });
  let s = fs.readFileSync(path.join(RACINE, f), 'utf8');
  if (mut && MUTATIONS[mut] && MUTATIONS[mut][0] === f) {
    if (!s.includes(MUTATIONS[mut][1])) { console.error(`ancre de la mutation « ${mut} » introuvable dans ${f}`); process.exit(2); }
    s = s.replace(MUTATIONS[mut][1], MUTATIONS[mut][2]);
  }
  fs.writeFileSync(dst, s);
}
if (mut && !MUTATIONS[mut]) { console.error('mutation inconnue'); process.exit(2); }
const imp = (f) => import(pathToFileURL(path.join(TMP, f)).href);

let rouges = 0, verts = 0;
const ok = (c, t) => { if (c) { verts++; console.log('✅ ' + t); } else { rouges++; console.log('❌ ' + t); } };
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (o) => `${b64u({ alg: 'HS256' })}.${b64u(o)}.signature`;

(async () => {
  const PDFLib = await import(pathToFileURL(require.resolve('pdf-lib', { paths: [RACINE] })).href);
  // ═══ Q · 119 ═══
  {
    const Q = await imp('api/_lib/qr-connexion.js');
    const CLE = 'cle-de-test-inventee-' + 'x'.repeat(40);
    const lignes = new Map();
    let ecrituresLignes = 0;
    const depot = {
      async lire(id) { await null; return lignes.has(id) ? { data: JSON.parse(JSON.stringify(lignes.get(id))) } : null; },
      async inserer(id, d) { await null; if (lignes.has(id)) return false; lignes.set(id, d); ecrituresLignes++; return true; },
      async remplacerSi(id, avant, d) { await null; const l = lignes.get(id); if (!l || l.etat !== avant) return false; lignes.set(id, d); ecrituresLignes++; return true; },
    };
    const JULIEN = { id: 'u-julien', email: 'j@exemple.test', emailConfirme: true, factors: [] };
    const MFA = { id: 'u-mfa', email: 'm@exemple.test', emailConfirme: true, factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] };
    const jetonIphone = jwt({ sub: 'u-julien', aal: 'aal1' }), jetonMfa1 = jwt({ sub: 'u-mfa', aal: 'aal1' }), jetonMfa2 = jwt({ sub: 'u-mfa', aal: 'aal2' });
    const users = { [jetonIphone]: JULIEN, [jetonMfa1]: MFA, [jetonMfa2]: MFA };
    const sessionsFaites = [];
    const auth = {
      async utilisateur(j) { return users[j] || null; },
      async session(uid, email) { sessionsFaites.push(uid); return { access_token: jwt({ sub: uid, aal: 'aal1', neuve: sessionsFaites.length }), refresh_token: 'r-' + sessionsFaites.length, expires_in: 3600, user: { id: uid, email, factors: uid === 'u-mfa' ? MFA.factors : [] } }; },
    };
    let t0 = Date.parse('2026-11-14T09:00:00Z');
    const R = (corps, jeton = '', maintenant = t0) => Q.routeQrConnexion({ corps, jeton, cle: CLE, depot, auth, maintenant });
    const c = await R({ action: 'creer', appareil: 'Mac de Julien <script>' });
    ok(c.status === 200 && c.body.ticket && c.body.secret && c.body.exp - t0 <= 120000, 'Q1 l\'ordinateur reçoit un ticket signé valable ≤ 2 min, et son secret');
    ok(!c.body.ticket.includes(c.body.secret), 'Q1 le ticket (le QR) ne porte pas le secret');
    ok(lignes.size === 0, 'Q1 créer un ticket n\'écrit rien en base (un inconnu ne remplit pas la base)');
    ok(c.body.appareil === 'Mac de Julien script', 'Q1 le nom de l\'appareil est nettoyé (aucune balise)');
    const { ticket, secret } = c.body;
    // Sans clic : rien.
    const a0 = await R({ action: 'attendre', ticket, secret }, '', t0 + 5000);
    const a0b = await R({ action: 'attendre', ticket, secret }, '', t0 + 9000);
    ok(a0.status === 200 && a0.body.etat === 'attente' && !a0.body.session && a0b.body.etat === 'attente' && sessionsFaites.length === 0, 'Q2 sans clic de l\'iPhone : « en attente », AUCUNE session fabriquée');
    const v0 = await R({ action: 'voir', ticket }, '', t0 + 6000);
    ok(v0.status === 401, 'Q2 voir sans session ⇒ 401');
    const ap0 = await R({ action: 'approuver', ticket }, 'jeton-bidon', t0 + 6000);
    ok(ap0.status === 401 && lignes.size === 0, 'Q2 approuver sans session valide ⇒ 401, rien écrit');
    const v1 = await R({ action: 'voir', ticket }, jetonIphone, t0 + 7000);
    ok(v1.status === 200 && v1.body.appareil === 'Mac de Julien script', 'Q3 l\'iPhone connecté voit « Connecter “Mac de Julien …” ? »');
    const ap1 = await R({ action: 'approuver', ticket }, jetonIphone, t0 + 8000);
    ok(ap1.status === 200 && ap1.body.etat === 'approuve', 'Q3 SON clic approuve');
    const ap2 = await R({ action: 'approuver', ticket }, jetonIphone, t0 + 8500);
    ok(ap2.status === 409, 'Q3 une seconde approbation du même ticket ⇒ refusée');
    const mauvais = await R({ action: 'attendre', ticket, secret: secret.slice(0, -2) + 'AA' }, '', t0 + 9000);
    ok(mauvais.status === 403 && sessionsFaites.length === 0, 'Q4 mauvais secret (quelqu\'un qui a vu le QR) ⇒ refusé, aucune session');
    const g1 = await R({ action: 'attendre', ticket, secret }, '', t0 + 10000);
    ok(g1.status === 200 && g1.body.etat === 'connecte' && g1.body.session && g1.body.session.user.id === 'u-julien', 'Q5 approuvé ⇒ la session de CE vendeur');
    ok(g1.body.session && g1.body.session.access_token !== jetonIphone && sessionsFaites.length === 1, 'Q5 la session est NEUVE (fabriquée par le serveur), jamais le jeton de l\'iPhone');
    const g2 = await R({ action: 'attendre', ticket, secret }, '', t0 + 11000);
    ok(g2.status === 410 && !g2.body.session && sessionsFaites.length === 1, 'Q6 défi REJOUÉ ⇒ refusé (410), aucune seconde session');
    // Expiré.
    const c2 = await R({ action: 'creer', appareil: 'PC' });
    const exp = c2.body.exp;
    const ve = await R({ action: 'voir', ticket: c2.body.ticket }, jetonIphone, exp + 1);
    const ape = await R({ action: 'approuver', ticket: c2.body.ticket }, jetonIphone, exp + 1);
    const ae = await R({ action: 'attendre', ticket: c2.body.ticket, secret: c2.body.secret }, '', exp + 1);
    ok(ve.status === 410 && ape.status === 410 && ae.status === 410, 'Q7 défi EXPIRÉ ⇒ refusé partout (voir, approuver, attendre)');
    // Approuvé à temps, récupéré après l'expiration : refusé.
    const c2b = await R({ action: 'creer', appareil: 'PC' });
    await R({ action: 'approuver', ticket: c2b.body.ticket }, jetonIphone, t0 + 1000);
    const aeb = await R({ action: 'attendre', ticket: c2b.body.ticket, secret: c2b.body.secret }, '', c2b.body.exp + 1);
    ok(aeb.status === 410 && sessionsFaites.length === 1, 'Q7 approuvé mais récupéré après 2 min ⇒ refusé, aucune session');
    // Ticket altéré : signature, expiration rallongée.
    const [ch, sg] = c2b.body.ticket.split('.');
    const corpsT = JSON.parse(Buffer.from(ch.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    const rallonge = b64u({ ...corpsT, e: corpsT.e + 3600000 }) + '.' + sg;
    const alt = await R({ action: 'voir', ticket: rallonge }, jetonIphone, t0 + 1000);
    const alt2 = await R({ action: 'voir', ticket: ch + '.' + sg.slice(0, -3) + 'abc' }, jetonIphone, t0 + 1000);
    ok(alt.status === 400 && alt2.status === 400, 'Q8 ticket altéré (expiration rallongée, signature changée) ⇒ refusé');
    // Double vérification.
    const c3 = await R({ action: 'creer', appareil: 'Mac' });
    const m1 = await R({ action: 'approuver', ticket: c3.body.ticket }, jetonMfa1, t0 + 1000);
    ok(m1.status === 403 && m1.body.erreur === 'mfa', 'Q9 compte avec double vérification : approuver depuis une session aal1 ⇒ refusé');
    const m2 = await R({ action: 'approuver', ticket: c3.body.ticket }, jetonMfa2, t0 + 1000);
    const m3 = await R({ action: 'attendre', ticket: c3.body.ticket, secret: c3.body.secret }, '', t0 + 2000);
    const pl = m3.body.session ? JSON.parse(Buffer.from(m3.body.session.access_token.split('.')[1], 'base64').toString()) : {};
    ok(m2.status === 200 && m3.body.etat === 'connecte' && pl.aal === 'aal1' && m3.body.session.user.factors.length === 1, 'Q9 aal2 approuve ; l\'ordinateur reçoit une session aal1 AVEC ses facteurs ⇒ la porte du code (PorteMfa) le lui demande');
    // Refus sur l'iPhone.
    const c4 = await R({ action: 'creer', appareil: 'Mac' });
    await R({ action: 'refuser', ticket: c4.body.ticket }, jetonIphone, t0 + 1000);
    const avant = sessionsFaites.length;
    const r4 = await R({ action: 'attendre', ticket: c4.body.ticket, secret: c4.body.secret }, '', t0 + 2000);
    ok(r4.body.etat === 'refuse' && sessionsFaites.length === avant, 'Q10 refusé sur l\'iPhone ⇒ l\'ordinateur le dit, aucune session');
    // Deux récupérations simultanées.
    const c5 = await R({ action: 'creer', appareil: 'Mac' });
    await R({ action: 'approuver', ticket: c5.body.ticket }, jetonIphone, t0 + 1000);
    const av5 = sessionsFaites.length;
    const [x, y] = await Promise.all([R({ action: 'attendre', ticket: c5.body.ticket, secret: c5.body.secret }, '', t0 + 2000), R({ action: 'attendre', ticket: c5.body.ticket, secret: c5.body.secret }, '', t0 + 2000)]);
    ok([x, y].filter((r) => r.body.etat === 'connecte').length === 1 && sessionsFaites.length === av5 + 1, 'Q11 deux récupérations en même temps ⇒ UNE seule session (comparer-et-échanger)');
    const sansCle = await Q.routeQrConnexion({ corps: { action: 'creer' }, cle: '', depot, auth });
    ok(sansCle.status === 503, 'Q12 sans clé de signature ⇒ 503 (rien n\'est inventé)');
  }
  // ═══ L · 120 ═══
  {
    const L = await imp('api/_lib/lien-aide.js');
    const CLE = 'cle-aide-inventee-' + 'y'.repeat(40);
    const rows = new Map();
    let ecritures = 0;
    const depot = {
      async lire(id) { await null; const r = rows.get(id); return r ? JSON.parse(JSON.stringify(r)) : null; },
      async listerDe(owner) { await null; return [...rows.values()].filter((r) => r.owner === owner).map((r) => JSON.parse(JSON.stringify(r))); },
      async inserer(row) { await null; rows.set(row.id, JSON.parse(JSON.stringify(row))); ecritures++; return true; },
      async modifier(id, owner, data, { siActif = false } = {}) { await null; const r = rows.get(id); if (!r || r.owner !== owner) return true; if (siActif && r.data.revoque) return true; r.data = JSON.parse(JSON.stringify(data)); ecritures++; return true; },
      async pdf(owner, id) { await null; return /^email_bord_(4001|5555)$/.test(id) && owner === 'u-julien' ? 'JVBERi0xLjQK' + 'A'.repeat(200) : null; },
    };
    const users = { 'jeton-julien': { id: 'u-julien' }, 'jeton-autre': { id: 'u-autre' } };
    const auth = { async utilisateur(j) { return users[j] || null; } };
    const t0 = Date.parse('2026-11-14T09:00:00Z');
    const R = (o, maintenant = t0) => L.routeLienAide({ cle: CLE, depot, auth, maintenant, ...o });
    // Une photo de Ma journée avec TOUT ce qui ne doit pas sortir (inventé).
    const photo = { v: 2, uid: 'u-julien', at: t0 - 60000, nEnvoyer: 2, nRetirer: 1,
      envoyer: [
        { titre: 'Nike Air Max 90 — 120 €', numero: '124', compte: 'shop_julien_long', plateforme: 'vinted', tx: '4001', prix: 120, price: { amount: '120.00' }, montant: 99, benefice: 40, pdf: ['email_bord_4001', 'harvest_77_label_latest'], jour: '2026-11-15', heure: '10:00', trNom: 'Mondial Relay', acheteur: 'pseudo_acheteur', adresse: '12 rue Inventée' },
        { titre: 'Adidas Samba €85', numero: '007', compte: 'shop_2', plateforme: 'ebay', total: 85, limite: '2026-11-16' },
      ],
      retirer: [{ titre: 'Asics Gel', lieu: 'Relais Inventé, 10 place Test', code: 'AB12 CD', qr: 'https://exemple.test/qr.png', compte: 'shop_julien_long', transporteur: 'Vinted Go', suivi: 'XY123', limite: '2026-11-18', prix: 60 }],
      aVerifier: [{ titre: 'à vérifier', code: '9999' }] };
    const cr = await R({ methode: 'POST', jeton: 'jeton-julien', corps: { action: 'creer', projection: photo } });
    ok(cr.status === 200 && /^[A-Za-z0-9_-]{22}\.\d{13}\.[A-Za-z0-9_-]{43}$/.test(cr.body.jeton) && cr.body.exp - t0 === 24 * 3600000, 'L1 le vendeur crée un lien SIGNÉ de 24 h exactement (posé par le serveur)');
    const g = await R({ methode: 'GET', query: { t: cr.body.jeton }, ua: 'Mozilla/5.0 (iPhone) Safari inventé' });
    const p = g.body.projection || {};
    const cles = new Set();
    const parcourir = (o) => { if (Array.isArray(o)) o.forEach(parcourir); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { cles.add(k); parcourir(v); } };
    parcourir(p);
    const PERMIS = new Set(['v', 'at', 'envoyer', 'retirer', 'nEnvoyer', 'nRetirer', 'numero', 'titre', 'limite', 'heure', 'plateforme', 'transporteur', 'pdf', 'lieu', 'code', 'qr', 'suivi']);
    ok(g.status === 200 && [...cles].every((k) => PERMIS.has(k)), 'L2 la projection n\'a QUE des clés de la liste blanche (' + [...cles].filter((k) => !PERMIS.has(k)).join(',') + ')');
    const texte = JSON.stringify(p);
    ok(!/€|\$|£|\beur\b|euros?\b/i.test(texte) && !/\b(120|99|85|60|40)\b/.test(texte.replace(/"numero":"[^"]*"/g, '')), 'L2 AUCUN montant, même glissé dans un titre (« 120 € », « €85 »)');
    ok(!/shop_julien|pseudo_acheteur|Inventée/.test(texte) && !('aVerifier' in p), 'L2 ni compte, ni acheteur, ni adresse ; rien d\'autre que les deux listes');
    ok(p.envoyer && p.envoyer[0].numero === '124' && p.envoyer[1].numero === '007' && p.retirer[0].code === 'AB12 CD' && p.envoyer[0].pdf.join() === 'email_bord_4001', 'L2 ce qui sert reste : N° tels quels, code de retrait, bordereau de CETTE vente (jamais label_latest)');
    const ligne = rows.get('lien_aide_' + cr.body.id);
    ok(ligne.data.journal.length === 1 && ligne.data.journal[0].quoi === 'ouvert' && ligne.data.journal[0].ua.length <= 40, 'L3 l\'ouverture est JOURNALISÉE (heure, navigateur en 40 caractères)');
    const b1 = await R({ methode: 'GET', query: { t: cr.body.jeton, bord: 'email_bord_4001' } });
    const b2 = await R({ methode: 'GET', query: { t: cr.body.jeton, bord: 'email_bord_5555' } });
    ok(b1.status === 200 && b1.pdf && rows.get('lien_aide_' + cr.body.id).data.journal.some((x) => x.quoi === 'bordereau'), 'L3 un bordereau de la liste s\'imprime (et c\'est noté)');
    ok(b2.status === 404, 'L3 un bordereau HORS de la liste ⇒ 404');
    const [idT, expT, sigT] = cr.body.jeton.split('.');
    const alt = await R({ methode: 'GET', query: { t: `${idT}.${expT}.${sigT.slice(0, -2)}AA` } });
    const rallonge = await R({ methode: 'GET', query: { t: `${idT}.${Number(expT) + 3600000}.${sigT}` } });
    const inconnu = await R({ methode: 'GET', query: { t: `${'Z'.repeat(22)}.${expT}.${sigT}` } });
    const expire = await R({ methode: 'GET', query: { t: cr.body.jeton } }, t0 + 24 * 3600000 + 1);
    ok(alt.status === 404 && rallonge.status === 404 && inconnu.status === 404, 'L4 signature changée, expiration rallongée, lien inconnu ⇒ 404');
    ok(expire.status === 404 && !expire.body.projection, 'L4 EXPIRÉ (24 h passées) ⇒ 404');
    // Le lien d'un autre vendeur ne s'ouvre pas avec une signature fabriquée pour soi.
    const crA = await R({ methode: 'POST', jeton: 'jeton-autre', corps: { action: 'creer', projection: photo } });
    const usurpe = await R({ methode: 'GET', query: { t: `${crA.body.id}.${crA.body.exp}.${L.fabriquerJeton(CLE, crA.body.id, 'u-julien', crA.body.exp).split('.')[2]}` } });
    ok(usurpe.status === 404, 'L4 une signature faite pour un autre vendeur que celui de la ligne ⇒ 404');
    const coupeAutre = await R({ methode: 'POST', jeton: 'jeton-autre', corps: { action: 'revoquer', id: cr.body.id } });
    ok(coupeAutre.status === 404 && !rows.get('lien_aide_' + cr.body.id).data.revoque, 'L5 un autre vendeur ne peut ni voir ni couper MON lien');
    // Révocation, puis un journal relu AVANT la révocation qui arrive APRÈS.
    const lu = await depot.lire('lien_aide_' + cr.body.id);
    const rv = await R({ methode: 'POST', jeton: 'jeton-julien', corps: { action: 'revoquer', id: cr.body.id } });
    await depot.modifier(lu.id, lu.owner, { ...lu.data, journal: [...lu.data.journal, { at: t0, quoi: 'ouvert', ua: '' }] }, { siActif: true });
    const apres = await R({ methode: 'GET', query: { t: cr.body.jeton } });
    ok(rv.status === 200 && apres.status === 404, 'L5 RÉVOQUÉ ⇒ 404 tout de suite');
    // La route publique elle-même, lue juste avant la coupure : son journal ne ré-ouvre pas.
    const cr2 = await R({ methode: 'POST', jeton: 'jeton-julien', corps: { action: 'creer', projection: photo } });
    const lireOrig = depot.lire;
    depot.lire = async (id) => { const r = await lireOrig(id); if (id === 'lien_aide_' + cr2.body.id) { const x = rows.get(id); x.data.revoque = true; } return r; };
    await R({ methode: 'GET', query: { t: cr2.body.jeton } });
    depot.lire = lireOrig;
    ok(rows.get('lien_aide_' + cr2.body.id).data.revoque === true, 'L5 une ouverture lue AVANT « Couper » et notée APRÈS ne ré-ouvre jamais le lien (écriture sous condition)');
    const avantEcr = ecritures;
    await R({ methode: 'POST', corps: { action: 'creer', projection: photo } });
    await R({ methode: 'POST', corps: { action: 'revoquer', id: cr2.body.id } });
    ok(ecritures === avantEcr, 'L6 sans session, aucune écriture (créer, couper) — la page de l\'aide ne fait que LIRE');
    await R({ methode: 'POST', jeton: 'jeton-julien', corps: { action: 'creer', projection: photo } });
    await R({ methode: 'POST', jeton: 'jeton-julien', corps: { action: 'creer', projection: photo } });
    await R({ methode: 'POST', jeton: 'jeton-julien', corps: { action: 'creer', projection: photo } });
    const trop = await R({ methode: 'POST', jeton: 'jeton-julien', corps: { action: 'creer', projection: photo } });
    ok(trop.status === 409, 'L6 trois liens actifs au plus');
    const src = sansCommentaires(lire('api/_lib/lien-aide.js'));
    ok(!/vrm_equipe|rpc\//.test(src), 'L7 aucune fonction de la 016 n\'est appelée (le lien marche sans la migration)');
  }
  // ═══ C · 127 ═══
  {
    const K = await imp('src/codeLocal.js');
    const stock = new Map();
    const stockage = { getItem: (k) => (stock.has(k) ? stock.get(k) : null), setItem: (k, v) => stock.set(k, String(v)), removeItem: (k) => stock.delete(k) };
    const subtle = webcrypto.subtle, alea = (u) => webcrypto.getRandomValues(u);
    const r1 = await K.fabriquerCode('4826', { subtle, alea });
    K.ecrireCode(stockage, r1);
    const brut = stockage.getItem(K.CLE_CODE_LOCAL);
    ok(!brut.includes('4826') && !/"(code|pin|clair)"/.test(brut), 'C1 le code n\'est JAMAIS en clair dans le stockage');
    const r2 = await K.fabriquerCode('4826', { subtle, alea });
    ok(r1.sel !== r2.sel && r1.empreinte !== r2.empreinte && r1.iter >= 100000, 'C1 dérivé et SALÉ (PBKDF2 ≥ 100 000 tours) : deux poses du même code ⇒ deux empreintes');
    ok(!(await K.fabriquerCode('1234', { subtle, alea })) && !(await K.fabriquerCode('0000', { subtle, alea })) && !(await K.fabriquerCode('12a4', { subtle, alea })), 'C2 1234, 0000, des lettres : refusés');
    const bon = await K.essayerCode('4826', stockage, { subtle });
    ok(bon.ok, 'C3 le bon code ouvre');
    const essais = [];
    for (let i = 0; i < 4; i++) essais.push(await K.essayerCode('1111', stockage, { subtle }));
    ok(essais.map((e) => e.reste).join() === '4,3,2,1' && K.lireCode(stockage), 'C3 chaque erreur est comptée et RANGÉE (fermer l\'app ne remet pas à zéro)');
    const cinq = await K.essayerCode('2222', stockage, { subtle });
    ok(cinq.deconnecter === true && K.lireCode(stockage) === null, 'C3 5 erreurs ⇒ déconnexion propre, le code est effacé');
    K.ecrireCode(stockage, { ...r1, apresMin: 5 });
    const r = K.lireCode(stockage), t = Date.now();
    ok(K.doitVerrouiller(r, { ouverture: true }) && !K.doitVerrouiller(r, { cacheeDepuis: t - 4 * 60000, maintenant: t }) && K.doitVerrouiller(r, { cacheeDepuis: t - 6 * 60000, maintenant: t }) && !K.doitVerrouiller(null, { ouverture: true }), 'C4 verrou à l\'ouverture et après 5 min cachée ; aucun code ⇒ aucun verrou');
    const ecran = sansCommentaires(lire('src/VerrouCode.jsx'));
    ok(/onDeconnexion\(\)/.test(ecran) && /pasServeur/.test(ecran) && /onDeconnexion=\{authSignOut\}/.test(sansCommentaires(lire('src/App.jsx'))), 'C5 5 erreurs ⇒ `authSignOut` de l\'app ; le réglage DIT que ce n\'est pas une sécurité du serveur');
  }
  // ═══ T · 129 ═══
  {
    const T = await imp('src/inventaireTournant.js');
    const unites = [];
    for (let i = 1; i <= 60; i++) unites.push({ cles: [String(i)], numero: i === 7 ? '007' : String(i), titre: 'Nike Dunk Low', photo: '', etat: i % 13 === 0 ? 'vendu' : i % 11 === 0 ? 'aconfirmer' : 'enligne' });
    unites.push({ cles: ['B125'], numero: 'B125', titre: 'Nike Dunk Low', etat: 'enligne' }, { cles: [], numero: '', titre: 'Sans N°', etat: 'enligne' });
    const gel = (o) => { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) gel(v); return o; };
    const avant = JSON.stringify(unites); gel(unites);
    const etat0 = gel({ v: 1, vus: {}, absents: {} });
    const a = T.tirageDuJour(unites, { jour: '2026-11-14', uid: 'u-julien', etat: etat0 });
    const b = T.tirageDuJour(unites, { jour: '2026-11-14', uid: 'u-julien', etat: etat0 });
    const c = T.tirageDuJour(unites, { jour: '2026-11-15', uid: 'u-julien', etat: etat0 });
    ok(a.length === 10 && JSON.stringify(a) === JSON.stringify(b), 'T1 le même jour, le même vendeur ⇒ les mêmes 10 N° (déterministe)');
    ok(JSON.stringify(a.map((x) => x.cle)) !== JSON.stringify(c.map((x) => x.cle)), 'T1 le lendemain, un autre tirage');
    const dix = new Set();
    for (let j = 1; j <= 30; j++) T.tirageDuJour(unites, { jour: `2026-11-${String(j).padStart(2, '0')}`, uid: 'u-julien', etat: etat0 }).forEach((x) => dix.add(x.cle));
    ok([...dix].every((k) => { const u = unites.find((x) => x.cles[0] === k); return u && u.numero && u.etat !== 'vendu' && u.etat !== 'aconfirmer'; }), 'T2 sur 30 jours : jamais une vendue, une « à confirmer », une sans N°');
    ok(JSON.stringify(unites) === avant && a.every((x) => x.numero === unites.find((u) => u.cles[0] === x.cle).numero), 'T3 JAMAIS un N° modifié : entrées gelées intactes, chaque N° rendu tel quel');
    const tirage7 = T.tirageDuJour(unites.filter((u) => u.cles[0] === '7'), { jour: '2026-11-14', etat: etat0 });
    ok(tirage7.length === 1 && tirage7[0].numero === '007', 'T3 « 007 » reste « 007 »');
    const k0 = a[0].cle;
    const e1 = T.noterTournant(etat0, { cle: k0, geste: 'absent', at: Date.parse('2026-11-14T10:00:00'), jour: '2026-11-14' });
    ok(e1.absents[k0] && JSON.stringify(unites) === avant && !Object.keys(e1).some((k) => /numero|supprim|fiche/i.test(k)), 'T4 « Pas trouvé » ⇒ un SIGNAL (à chercher), rien supprimé, aucun N° touché');
    const e2 = T.noterTournant(e1, { cle: k0, geste: 'retrouve', at: Date.parse('2026-11-14T11:00:00'), jour: '2026-11-14' });
    ok(!e2.absents[k0] && e2.vus[k0], 'T4 « Retrouvé » lève le signal');
    const f = T.fusionnerTournant(e1, { vus: { [k0]: Date.parse('2026-11-14T12:00:00') } });
    const f2 = T.fusionnerTournant(e1, { vus: { [k0]: Date.parse('2026-11-01T12:00:00') } });
    ok(!f.absents[k0] && f2.absents[k0], 'T5 deux appareils : un « vu » plus récent lève l\'absence, un plus ancien non');
    const vus = {}; a.forEach((x) => { vus[x.cle] = Date.parse('2026-11-14T10:00:00'); });
    const lend = T.tirageDuJour(unites, { jour: '2026-11-15', uid: 'u-julien', etat: { vus } });
    ok(lend.every((x) => !(x.cle in vus)), 'T6 le tour passe par tout le stock : un N° vu hier n\'est pas retiré tant qu\'il en reste d\'autres');
    const ecr = sansCommentaires(lire('src/InventaireTournant.jsx'));
    ok(!/save\(|setItem|cleNum|numero\s*=/.test(ecr), 'T7 la carte n\'écrit QUE sa ligne (par `ecrire`), jamais un N°');
  }
  // ═══ J · 117 ═══
  {
    const J = await imp('src/journeeSelonHeure.js');
    ok(J.momentDuJour(Date.parse('2026-11-14T07:30:00Z')) === 'matin' && J.momentDuJour(Date.parse('2026-11-14T13:00:00Z')) === 'journee' && J.momentDuJour(Date.parse('2026-11-14T19:00:00Z')) === 'soir' && J.momentDuJour(Date.parse('2026-11-14T02:00:00Z')) === 'soir', 'J1 matin / journée / soir à l\'heure de Paris');
    const af = ['trancher', 'ailleurs', 'deux-fois', 'envoyer', 'retirer', 'messages', 'prix', 'favoris', 'republier', 'autres'];
    const m = J.ordreSelonHeure(af, 'afaire', { moment: 'matin' });
    const s = J.ordreSelonHeure(af, 'afaire', { moment: 'soir' });
    ok(m[0] === 'trancher' && m[1] === 'envoyer' && m[2] === 'retirer', 'J2 le matin : les colis en tête (« À trancher », fixe, garde sa place)');
    ok(s[0] === 'trancher' && s.slice(1, 5).join() === 'messages,prix,favoris,republier'.split(',').sort((x, y) => ['messages', 'favoris', 'prix', 'republier'].indexOf(x) - ['messages', 'favoris', 'prix', 'republier'].indexOf(y)).join(), 'J2 le soir : le bilan et les messages avant');
    const t = J.ordreSelonHeure(['phrase', 'prochain', 'frise', 'chiffres'], 'tete', { moment: 'soir' });
    ok(t[0] === 'frise' && t.indexOf('chiffres') === 3, 'J2 le soir, en haut : les 7 derniers jours d\'abord');
    ok(JSON.stringify(J.ordreSelonHeure(af, 'afaire', { moment: 'matin', sienOrdre: true })) === JSON.stringify(af), 'J3 SON ordre gagne toujours');
    ok([m, s].every((o) => o.length === af.length && [...o].sort().join() === [...af].sort().join()), 'J3 rien caché, rien ajouté : la même liste');
    const app = sansCommentaires(lire('src/App.jsx'));
    ok(/ordreJourneeHeure\('afaire', persoJ\)/.test(app) && /ordreJourneeHeure\('tete', persoJ\)/.test(app), 'J4 Ma journée passe par la règle (un seul point d\'entrée)');
  }
  // ═══ A · 118 ═══
  {
    const A = await imp('src/atelierEcran.js');
    const now = Date.parse('2026-11-14T10:00:00');
    const k = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const v0 = A.vueAtelier({ photo: null, benefice: null, maintenant: now });
    ok(v0.envoyer === null && v0.retirer === null && v0.jour === null, 'A1 sans photo ni publication ⇒ « pas su » (null), jamais 0');
    const photo = { at: now - 13 * 3600000, envoyer: [{ numero: '12', titre: 'A', jour: k(now - 86400000) }, { numero: '13', titre: 'B', jour: k(now + 86400000) }], retirer: [{ titre: 'C', code: '1234', limite: k(now) }], nEnvoyer: 2, nRetirer: 1 };
    const v1 = A.vueAtelier({ photo, benefice: { at: now - 3600000, jours: { [k(now)]: [3, 25500] } }, maintenant: now });
    ok(v1.envoyer.n === 2 && v1.envoyer.retard === 1 && v1.envoyer.lignes[0].numero === '12' && v1.vieux === true && v1.retirer.lignes[0].dernierJour, 'A2 colis du jour : retard d\'abord, dernier jour signalé, une liste de plus de 12 h DITE ancienne');
    ok(v1.jour && v1.jour.n === 3 && v1.jour.ca === 255, 'A2 le chiffre du jour : 3 ventes, 255 €');
    const v2 = A.vueAtelier({ photo, benefice: { at: now - 30 * 3600000, jours: { [k(now - 30 * 3600000)]: [9, 900] } }, maintenant: now });
    ok(v2.jour === null, 'A3 une publication d\'un AUTRE jour ⇒ « — » (jamais « 0 vente aujourd\'hui »)');
    const ecr = sansCommentaires(lire('src/EcranAtelier.jsx'));
    ok(!/fetch\(|setItem|save\(|method:\s*'(POST|PATCH|DELETE)'/.test(ecr) && /wakeLock\.request\('screen'\)/.test(ecr) && /ATELIER_RELECTURE_MS/.test(ecr), 'A4 lecture seule (aucune requête, aucune écriture), Wake Lock, relu tout seul');
  }
  // ═══ D · 126 ═══
  {
    const D = await imp('src/dossierLitige.js');
    const convs = [
      { tx: '123', opp: '900', messages: [{ entity_type: 'message', created_at_ts: 1763100000, entity: { body: 'Bonjour, la paire est arrivée abîmée', user_id: 900 } }, { entity_type: 'message', created_at_ts: 1763103600, entity: { body: 'Je regarde tout de suite', user_id: 555 } }, { entity_type: 'status', entity: { body: 'Commande finalisée' } }] },
      { tx: '1234', opp: '901', messages: [{ entity: { body: 'AUTRE VENTE', user_id: 901 } }] },
    ];
    const e = D.echangesDossier(convs, '123');
    ok(e && e.length === 3 && !e.some((x) => /AUTRE VENTE/.test(x.texte)), 'D1 seulement la conversation de CETTE transaction (123 ≠ 1234)');
    ok(e[0].de === 'acheteur' && e[1].de === 'toi' && e[2].de === 'vinted' && !JSON.stringify(e).includes('900'), 'D1 « l\'acheteur » / « toi » / « Vinted », jamais son identifiant');
    ok(D.echangesDossier(convs, '777') === null && D.echangesDossier([], '123') === null, 'D2 aucune conversation lue ⇒ null (« pas lue »), jamais « aucun échange »');
    const contenu = D.contenuDossierLitige({ carte: { num: '124', titre: 'Air Max', tx: '123' }, echanges: e, maintenant: Date.parse('2026-11-14T10:00:00Z') });
    const octets = await D.pdfDossierLitige(contenu, { PDFLib });
    const doc = await PDFLib.PDFDocument.load(octets);
    const sans = await PDFLib.PDFDocument.load(await D.pdfDossierLitige(D.contenuDossierLitige({ carte: { num: '124' } }), { PDFLib }));
    ok(doc.getPageCount() === sans.getPageCount() + 1, 'D3 le PDF porte une page « Échanges » (pdf-lib, dans le navigateur)');
    const app = sansCommentaires(lire('src/App.jsx'));
    ok(/conversation->transaction->>id=eq\.\$\{tx\}/.test(app) && /echangesDossier\(rows, tx\)/.test(app), 'D4 l\'app relie la conversation par le n° de transaction, projeté (jamais `select=data`)');
  }
  // ═══ P · 128 ═══
  {
    const P = await imp('src/apercuAnnonce.js');
    const a = P.apercuAnnonce({ titre: 'brut', prix: { amount: '89.5' }, marque: 'Nike', taille: '42', etat: 'Très bon état' }, { ok: true, titre: 'Nike Dunk N°124', description: 'Belle paire.\nN°124' }, ['data:image/jpeg;base64,AAA', 'javascript:alert(1)', 'https://images.exemple.test/a.jpg']);
    ok(a.titre === 'Nike Dunk N°124' && a.description.includes('N°124') && a.prix === '89,50 €' && a.photos.length === 2 && a.details.length === 3, 'P1 l\'aperçu montre le texte qui PARTIRA (titre, description avec le N°), le prix, les détails ; une adresse douteuse est écartée');
    ok(P.apercuAnnonce({}, null, []).prix === '—', 'P1 pas de prix ⇒ « — »');
    const src = sansCommentaires(lire('src/apercuAnnonce.js') + lire('src/ApercuAnnonce.jsx'));
    ok(!/fetch\(|vinted\.fr|XMLHttpRequest|envoyer\(/.test(src), 'P2 aucune requête Vinted (rendu local)');
    ok(/data-creer-vinted-apercu/.test(lire('src/CreerSurVinted.jsx')), 'P3 « Aperçu » sur chaque fiche de « Créer sur Vinted »');
  }
  // ═══ M · 130 ═══
  {
    const M = await imp('src/carteMerci.js');
    const c = M.contenuCarteMerci({ signature: 'Julien', boutique: 'Atelier Inventé', message: '', acheteur: 'pseudo_acheteur', adresse: '1 rue Test', lien: 'javascript:alert(1)' }, { messageDefaut: 'Merci !' });
    ok(Object.keys(c).sort().join() === 'boutique,lien,message,signature' && c.lien === '' && c.message === 'Merci !' && !JSON.stringify(c).includes('pseudo_acheteur'), 'M1 la carte : SES champs seulement, rien de l\'acheteur, un lien douteux écarté');
    const pdf = await PDFLib.PDFDocument.load(await M.pdfCarteMerci(c, { PDFLib, parPage: 4 }));
    ok(pdf.getPageCount() === 1 && Math.round(pdf.getPage(0).getWidth()) === 595, 'M2 4 cartes sur une page A4');
    const src = sansCommentaires(lire('src/carteMerci.js') + lire('src/CarteMerci.jsx'));
    ok(!/sales\.items|buyer|transaction_id|\.acheteur|opposite_user/.test(src), 'M3 aucune vente, aucune commande, aucun acheteur lu');
  }
  // ═══ B · le branchement ═══
  {
    const app = sansCommentaires(lire('src/App.jsx'));
    const compte = sansCommentaires(lire('api/compte.js'));
    const regl = sansCommentaires(lire('src/ecrans/Reglages.jsx'));
    const stock = sansCommentaires(lire('src/ecrans/Stock.jsx'));
    ok(/mode === 'qr-connexion'/.test(compte) && /mode === 'lien-aide'/.test(compte) && !fs.existsSync(path.join(RACINE, 'api', 'qr-connexion.js')) && !fs.existsSync(path.join(RACINE, 'api', 'lien-aide.js')), 'B1 deux modes de la route existante api/compte.js (aucune 13ᵉ fonction)');
    ok(/admin\/generate_link', sbCle\(SERVICE\), \{ type: 'magiclink', email \}/.test(compte) && /async function sessionNeuvePour[\s\S]{0,900}appelAuth\('verify'/.test(compte), 'B2 la session de l\'ordinateur : lien magique d\'administration aussitôt échangé (voie de Supabase), comme session-extension');
    ok(/QrOrdinateur onSession=\{\(j\)=>\{ writeSession\(sessionFrom\(j\)\); \}\}/.test(app) && /etatMfa\(authState\.session\) !== 'ok'\) return <PorteMfa/.test(app), 'B2 l\'ordinateur range la session par `sessionFrom` (facteurs compris) : la porte de la double vérification s\'applique');
    ok(/if \(LIEN_AIDE_JETON\) return <VueLienAide/.test(app) && /<ConfortCoque uid=/.test(app), 'B3 la page de l\'aide (sans compte) et la coque (QR, atelier, code, lien) sont montées');
    ok(/<ReglageCodeLocal/.test(regl) && /<ReglageLienAide/.test(regl) && /<ReglageCarteMerci/.test(regl) && /vrm:atelier/.test(regl), 'B4 Paramètres → « Confort et sécurité »');
    ok(/<InventaireTournant unites=\{unitesTournant\}/.test(stock), 'B5 le Stock porte l\'inventaire tournant');
    ok(/'vrm_inventaire_tournant', 'vrm_carte_merci'/.test(app), 'B6 les deux réglages suivent sur tous ses appareils (SYNC_KEYS)');
  }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  console.log(rouges ? `\n❌ audit-confort-securite : ${rouges} rouge(s), ${verts} vert(s)` : `\n✅ audit-confort-securite : ${verts} verts`);
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
