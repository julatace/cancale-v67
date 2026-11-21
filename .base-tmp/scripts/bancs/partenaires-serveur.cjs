#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC — LE PROGRAMME PARTENAIRE, CÔTÉ SERVEUR, EXÉCUTÉ (15 nov.)
//  node scripts/bancs/partenaires-serveur.cjs            (le banc)
//  node scripts/bancs/partenaires-serveur.cjs --prouve   (chaque règle du module réaffaiblie ⇒ ROUGE)
//
//  Exécute le VRAI api/compte.js — le webhook Stripe SIGNÉ, `mode=partenaire` (le
//  rattachement, la page du partenaire) et `mode=partenaires` (Julien) — sur un faux
//  PostgREST en mémoire (scripts/bancs/_faux-postgrest.cjs : filtres, clés uniques,
//  tables absentes) et un faux Stripe local. Des événements Stripe INVENTÉS, de la
//  vraie forme (API 2026-08-26) ; aucune clé Stripe, aucune donnée réelle (dépôt PUBLIC).
//  Ce qu'il juge :
//    P1 Julien seul crée, met en pause, pose l'avantage, note « Versé », exporte ;
//    P2 rattacher : un compte neuf, une fois ; pas soi-même (même compte, même e-mail
//       à un point ou un « + » près, un compte Vinted en commun) ; ni ancien, ni déjà
//       client, ni déjà parrainé ; code en pause ⇒ refusé ;
//    P3 webhook : paiement réel ⇒ 300 ; 0 € ⇒ rien ; rejoué ⇒ une seule ; Pro et Solo
//       ⇒ 300 ; une base qui ne range pas ⇒ 503 (Stripe rejoue) puis une seule ;
//    P4 remboursement, litige, avoir ⇒ annulée ; remboursement AVANT la facture ⇒ née annulée ;
//    P5 client résilié ⇒ ne compte plus parmi les clients payants, rien d'effacé ;
//    P6 « Leo · 23 clients payants · 69,00 € à lui verser » ; « Versé » ⇒ soldé ; CSV anonyme ;
//    P7 la page du partenaire : SES nombres seulement (le jeton de Max ne montre rien de
//       Leo), jamais un identifiant, un e-mail, le contact, le coupon ; jeton faux ⇒ 404 ;
//    P8 l'avantage : coupon vérifié chez Stripe, posé au paiement d'un PREMIER abonnement ;
//    P9 043 pas passée : le webhook acquitte, rien ne casse ; l'écran dit « pas installé ».
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto'), os = require('os');
const { spawnSync } = require('child_process');
const { fauxPostgrest } = require('./_faux-postgrest.cjs');
const RACINE_DEPOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const RACINE = process.env.BANC_RACINE || RACINE_DEPOT;

// ── --prouve : chaque mutation de api/_lib/partenaires.js (dans une COPIE) doit rougir ──
const MUTATIONS = {
  'sans-soi-meme-email': ["  if (p.contact && RE_EMAIL.test(String(p.contact).trim()) && emailCanon(p.contact) === moi) return soiMeme;\n", ''],
  'sans-soi-meme-vinted': ["    if (v === 'soi-meme') return soiMeme;\n", ''],
  'sans-compte-neuf': ["  if (!Number.isFinite(cree) || maintenant - cree > FILLEUL_MAX_JOURS * 86400000) return", "  if (false) return"],
  'pause-ignoree': ["  if (p.pause_le) return { ok: false, http: 409, raison: 'pause', message: \"Ce code partenaire n'est plus actif.\" };\n", ''],
  'deux-recompenses': ["  if (parr.ok && parr.lignes.length) return { ok: false, http: 409, raison: 'deja-parraine', message: 'Ton compte a déjà un parrain.' };\n", ''],
  'panne-acquittee': ["  return { ok: false };\n}\n\n// Les signaux (remboursement", "  return { ok: true };\n}\n\n// Les signaux (remboursement"],
  'annulation-perdue': ["      const w = await ecrire('PATCH', `partenaire_commissions?facture=eq.${enc(c.facture)}&annulee_le=is.null`, { annulee_le: le, annulee_raison: rb.raison }, 'return=representation');", "      const w = { ok: true, json: [] };"],
  // (16 nov.) Le remboursement partiel : la réduction perdue, ou un rendu qui redescend.
  'partiel-perdu': ["      const w = await ecrire('PATCH', `partenaire_commissions?facture=eq.${enc(c.facture)}&annulee_le=is.null&rembourse_centimes=lt.${rb.centimes}`, { rembourse_centimes: rb.centimes }, 'return=representation');", "      const w = { ok: true, json: [] };"],
  'partiel-signal-ecrase': ["'partenaire_annulations?on_conflict=cle,signal'", "'partenaire_annulations?on_conflict=cle'"],
  'jeton-de-tous': ["  const c = await lireChiffres(p.id, maintenant);\n  if (!c.ok) return { http: 503, corps: { ok: false, raison: 'pas-su' } };\n  const d = c.chiffres.get(String(p.id)) || vide(maintenant);", "  const c = await lireChiffres(null, maintenant);\n  if (!c.ok) return { http: 503, corps: { ok: false, raison: 'pas-su' } };\n  const d = [...c.chiffres.values()][0] || vide(maintenant);"],
  'page-bavarde': ["    ok: true, nom: p.nom, code: p.code, lien: lienCode(p.code), pause: !!p.pause_le,", "    ok: true, nom: p.nom, code: p.code, lien: lienCode(p.code), pause: !!p.pause_le, contact: p.contact, filleuls: d.commissions,"],
  'coupon-non-verifie': ["    if (!r.ok || !r.data || r.data.id !== brut || r.data.valid === false) return { http: 409, corps: { ok: false, raison: 'coupon-inconnu' } };\n", ''],
};
if (args.includes('--prouve')) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-partenaires-'));
  let rouges = 0;
  try {
    // Une copie minimale : api/, src/ (les règles que le serveur emprunte), public/legal, package.json.
    for (const d of ['api', 'src', 'public/legal']) fs.cpSync(path.join(RACINE_DEPOT, d), path.join(base, d), { recursive: true, filter: (s) => !/node_modules|\.png$|\.jpe?g$|\.woff2?$|\.mp4$/.test(s) });
    fs.copyFileSync(path.join(RACINE_DEPOT, 'package.json'), path.join(base, 'package.json'));
    fs.symlinkSync(fs.realpathSync(path.join(RACINE_DEPOT, 'node_modules')), path.join(base, 'node_modules'), 'dir');
    const cible = path.join(base, 'api/_lib/partenaires.js');
    const origine = fs.readFileSync(cible, 'utf8');
    // Le témoin : la copie NON mutée doit être verte, sinon une mutation « rouge » ne prouve rien.
    const temoin = spawnSync(process.execPath, [__filename], { encoding: 'utf8', env: { ...process.env, BANC_RACINE: base }, maxBuffer: 64 << 20 });
    const rougesTemoin = (temoin.stdout.match(/^❌ /gm) || []).length;
    console.log(`${temoin.status === 0 && !rougesTemoin ? '✅' : '❌'} témoin : la copie non mutée est verte (${rougesTemoin} rouge(s))`);
    if (temoin.status !== 0 || rougesTemoin) { console.log(temoin.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 3).join('\n')); fs.rmSync(base, { recursive: true, force: true }); process.exit(1); }
    for (const [nom, [a, b]] of Object.entries(MUTATIONS)) {
      const n = origine.split(a).length - 1;
      if (n !== 1) { console.log(`❌ mutation « ${nom} » → ancre introuvable (${n})`); continue; }
      fs.writeFileSync(cible, origine.split(a).join(b));
      const r = spawnSync(process.execPath, [__filename], { encoding: 'utf8', env: { ...process.env, BANC_RACINE: base }, maxBuffer: 64 << 20 });
      const k = (r.stdout.match(/^❌ /gm) || []).length;
      const bon = r.status !== 0 && k > 0;
      if (bon) rouges++;
      console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? k + ' rouge(s)' : 'RESTE VERTE'}`);
      if (bon) for (const l of r.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 1)) console.log('      ' + l.slice(0, 180));
    }
    fs.writeFileSync(cible, origine);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
  console.log(`\n${rouges}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(rouges === Object.keys(MUTATIONS).length ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d !== undefined && d !== '' ? ' — ' + String(d).slice(0, 220) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); } };

// ── Le monde INVENTÉ ────────────────────────────────────────────────────────
const J = 86400000, NOW = Date.now();
const LE_OCT = NOW - 17 * 86400000;                       // le premier mois payé (dû : plus de 14 jours)
const moisSuivant = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 2, 12); };
const iso = (ms) => new Date(ms).toISOString();
const uid = (i) => `99999999-0000-4000-8000-${String(i).padStart(12, '0')}`;
const JULIEN = 'aaaaaaaa-1111-4111-8111-000000000001', LEO_VRM = 'aaaaaaaa-1111-4111-8111-000000000002';
const COMPTES = {
  [JULIEN]: { email: 'proprio@exemple.test', created_at: iso(NOW - 400 * J) },
  [LEO_VRM]: { email: 'leo.partenaire@gmail.com', created_at: iso(NOW - 90 * J) },
};
const jetonDe = (id) => 'jt.x.' + id;
const nouveauCompte = (i, o = {}) => { const id = uid(i); COMPTES[id] = { email: o.email || `client${i}@exemple.test`, created_at: o.cree || iso(NOW - 2 * J) }; return id; };
const tokens = () => Object.fromEntries(Object.entries(COMPTES).map(([id, c]) => [jetonDe(id), { id, ...c }]));

const SCH = {
  abonnements: { uniques: [['owner']], colonnes: ['owner', 'statut', 'client_stripe', 'abonnement_stripe', 'evenement_ts', 'maj', 'impaye_depuis'] },
  vrm_reglages: { uniques: [['cle']] },
  parrainages: { uniques: [['filleul']] }, parrainage_codes: { uniques: [['owner'], ['code']] },
  vinted_accounts: {}, essais_gratuits: { uniques: [['cle']] }, app_data: { uniques: [['owner', 'id']] },
  partenaires: { uniques: [['id'], ['code'], ['jeton_empreinte']], defauts: { id: () => crypto.randomUUID(), pause_le: null, coupon: null, compte: null, contact: null } },
  partenaire_filleuls: { uniques: [['filleul']] },
  partenaire_commissions: { uniques: [['facture'], { cols: ['filleul', 'mois'], si: (l) => !l.annulee_le }],
    verifier: (l) => (l.montant_centimes !== 300 ? 'montant' : Date.parse(l.due_le) < Date.parse(l.paye_le) + 14 * J ? 'due' : (!!l.annulee_le) !== (!!l.annulee_raison) ? 'annulee' : '') },
  partenaire_annulations: { uniques: [['cle', 'signal']] },
  partenaire_versements: { defauts: { id: () => crypto.randomUUID() } },
};
const FERMEES = new Set(['partenaires', 'partenaire_filleuls', 'partenaire_commissions', 'partenaire_annulations', 'partenaire_versements', 'parrainages', 'essais_gratuits']);
let db, absentes, stripe, coupons, sansPaiementsStripe;
const reset = ({ sans043 = false } = {}) => {
  absentes = new Set(sans043 ? ['partenaires', 'partenaire_filleuls', 'partenaire_commissions', 'partenaire_annulations', 'partenaire_versements'] : []);
  db = fauxPostgrest({ schemas: SCH, absentes, fermees: FERMEES,
    estService: (h) => !String(h.Authorization || '').startsWith('Bearer jt.'),
    rlsVendeur: { abonnements: (h) => { const id = String(h.Authorization).slice('Bearer jt.x.'.length); return (l) => l.owner === id; } } });
  db.t.vrm_reglages.push({ cle: 'proprietaire', valeur: JULIEN }, { cle: 'parrainage', valeur: '0' });
  db.t.vinted_accounts.push({ owner: LEO_VRM, vinted_user_id: '777' });
  stripe = []; coupons = { LEO50: { id: 'LEO50', valid: true, percent_off: 50, duration: 'once' } }; sansPaiementsStripe = {};
};
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
global.fetch = async (url, opts = {}) => {
  const u = String(url), m = opts.method || 'GET', h = opts.headers || {};
  const bearer = String(h.Authorization || '').replace('Bearer ', '');
  if (u.includes('/auth/v1/admin/users/')) { const id = decodeURIComponent(u.split('/auth/v1/admin/users/')[1].split('?')[0]); return COMPTES[id] ? rep({ id, email: COMPTES[id].email }) : rep({ msg: 'introuvable' }, 404); }
  if (u.includes('/auth/v1/admin/users')) return rep({ users: Object.entries(COMPTES).map(([id, c]) => ({ id, email: c.email, created_at: c.created_at })) });
  if (u.includes('/auth/v1/user')) { const t = tokens()[bearer]; return t ? rep(t) : rep({ msg: 'invalid' }, 401); }
  if (u.includes('/rest/v1/rpc/vrm_acces')) { const t = tokens()[bearer]; return t ? rep({ obligatoire: true, proprietaire: t.id === JULIEN, acces: true, lecture: true }) : rep({}, 401); }
  if (u.includes('/rest/v1/')) return db.traiter(u, opts);
  if (u.startsWith('https://api.stripe.com/v1/')) {
    const chemin = u.slice('https://api.stripe.com/v1/'.length).split('?')[0];
    const corps = new URLSearchParams(opts.body || u.split('?')[1] || '');
    stripe.push({ m, chemin, corps });
    if (chemin === 'invoice_payments') { const f = corps.get('invoice'); return sansPaiementsStripe[f] === 'muet' ? rep({ error: { message: 'muet' } }, 500) : rep({ object: 'list', data: [{ object: 'invoice_payment', invoice: f, payment: { type: 'payment_intent', payment_intent: 'pi_lu_' + f } }] }); }
    if (chemin.startsWith('coupons/')) { const c = coupons[decodeURIComponent(chemin.split('/')[1])]; return c ? rep(c) : rep({ error: { message: 'No such coupon' } }, 404); }
    if (chemin === 'prices') return rep({ data: [{ id: 'price_banc', unit_amount: 1699, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } }] });
    if (chemin === 'checkout/sessions') return rep({ id: 'cs_banc', url: 'https://checkout.stripe.com/c/pay/cs_banc' });
    if (chemin === 'payment_methods') return rep({ object: 'list', data: [] });
    if (/^customers\/[^/]+\/balance_transactions$/.test(chemin)) return rep({ object: 'list', data: [] });
    return rep({ error: { message: 'inconnu ' + chemin } }, 404);
  }
  return rep({}, 404);
};

// ── Les appels ──────────────────────────────────────────────────────────────
const SECRET = 'whsec_banc_partenaires';
const faireRes = () => { const r = { code: null, corps: null, entetes: {}, texte: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = (k, v) => { r.entetes[k.toLowerCase()] = v; }; r.end = (t) => { r.texte = t == null ? null : String(t); return r; }; return r; };
const req = ({ method = 'GET', mode, headers = {}, corps = null, query = {} }) => {
  const buf = corps == null ? null : Buffer.from(typeof corps === 'string' ? corps : JSON.stringify(corps), 'utf8');
  return { method, query: { mode, ...query }, headers, async *[Symbol.asyncIterator]() { if (buf) yield buf; } };
};
const signer = (c, secret = SECRET) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${c}`).digest('hex')}`; };
let nEvt = 0;
const evt = (type, objet) => JSON.stringify({ id: 'evt_banc' + (++nEvt), object: 'event', api_version: '2026-08-26.dahlia', type, created: Math.floor(Date.now() / 1000) + nEvt, livemode: false, data: { object: objet } });
const S = (ms) => Math.floor(ms / 1000);
let nFac = 0;
// Une facture payée de la forme 2026-08-26 (abonnement dans `parent`, paiement dans `payments`).
const facture = (client, o = {}) => {
  const id = o.id || 'in_banc' + (++nFac);
  const le = o.le || LE_OCT;
  return { id, object: 'invoice', status: 'paid', currency: 'eur', customer: client, amount_paid: o.montant ?? 1699, total: o.montant ?? 1699,
    billing_reason: o.motif || 'subscription_cycle', created: S(le), status_transitions: { paid_at: S(le), finalized_at: S(le) },
    parent: { type: 'subscription_details', subscription_details: { subscription: o.sub || 'sub_' + client.slice(4), metadata: {} } },
    ...(o.sansPaiements ? {} : { payments: { object: 'list', data: [{ object: 'invoice_payment', payment: { type: 'payment_intent', payment_intent: o.pi || 'pi_' + id.slice(3) } }] } }),
    lines: { object: 'list', data: [] } };
};

(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc_partenaires';
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  delete process.env.VRM_OWNER_UID;
  let compte;
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }
  try { await import('file://' + path.join(RACINE, 'public', 'legal', 'editeur.js')); } catch (_) {}
  if (globalThis.VRM_EDITEUR) for (const k of Object.keys(globalThis.VRM_EDITEUR)) globalThis.VRM_EDITEUR[k] = 'valeur d’essai ' + k;
  const appel = async (o) => { const r = faireRes(); await compte(req(o), r); return r; };
  const session = (id) => ({ Authorization: 'Bearer ' + jetonDe(id) });
  const admin = (corps) => appel({ method: 'POST', mode: 'partenaires', headers: session(JULIEN), corps });
  const liste = async () => (await appel({ mode: 'partenaires', headers: session(JULIEN) })).corps;
  const rattacher = (id, code) => appel({ method: 'POST', mode: 'partenaire', headers: session(id), corps: { action: 'rattacher', code } });
  const webhook = (type, objet, secret) => { const c = evt(type, objet); return appel({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c, secret) }, corps: c }); };
  const abonne = (owner, client, statut = 'active') => { const l = db.t.abonnements.find((x) => x.owner === owner); if (l) Object.assign(l, { client_stripe: client, statut }); else db.t.abonnements.push({ owner, client_stripe: client, statut, abonnement_stripe: 'sub_' + client.slice(4), evenement_ts: 1, maj: null }); };
  // Le temps passe : les rattachements datent d'il y a 24 jours (inscription, essai, puis paiement).
  const vieillir = () => { for (const l of db.t.partenaire_filleuls) l.inscrit = iso(NOW - 24 * J); };
  const commissions = (f) => db.t.partenaire_commissions.filter(f || (() => true));

  reset();
  let LEO = null, MAX = null, jetonLeo = '', jetonMax = '';
  await essaie('P1 Julien seul', async () => {
    const pirate = await appel({ method: 'POST', mode: 'partenaires', headers: session(LEO_VRM), corps: { action: 'creer', nom: 'Pirate', code: 'PIRATE' } });
    dit(pirate.code === 403 && !db.t.partenaires.length, 'un autre compte que Julien ne crée rien (403)', pirate.code);
    dit((await appel({ mode: 'partenaires', headers: session(LEO_VRM) })).code === 403, 'un autre compte que Julien ne lit pas la liste (403)');
    dit((await appel({ mode: 'partenaires' })).code === 401, 'sans session : 401');
    const r = await admin({ action: 'creer', nom: 'Leo', code: 'leo', contact: 'leo.partenaire@gmail.com' });
    dit(r.code === 200 && r.corps.ok && r.corps.code === 'LEO' && r.corps.lien === 'https://vrm.center/p/LEO', 'Julien crée « Leo » (code « leo » ⇒ « LEO », lien vrm.center/p/LEO)', JSON.stringify(r.corps));
    dit(/^https:\/\/vrm\.center\/pa\/[A-Za-z0-9_-]{43}$/.test(r.corps.lienPrive || ''), 'son lien privé est rendu UNE fois, à la création');
    LEO = db.t.partenaires.find((p) => p.code === 'LEO');
    jetonLeo = r.corps.lienPrive.split('/pa/')[1];
    dit(LEO && /^[0-9a-f]{64}$/.test(LEO.jeton_empreinte) && !JSON.stringify(LEO).includes(jetonLeo), "la base ne garde que l'EMPREINTE du jeton, jamais le jeton");
    dit(LEO && LEO.compte === LEO_VRM, 'son compte VRM est retrouvé par son e-mail (pour « pas soi-même »)');
    dit((await admin({ action: 'creer', nom: 'Leo bis', code: 'LEO' })).code === 409, 'un code déjà pris : 409');
    dit((await admin({ action: 'creer', nom: 'x', code: 'MAX' })).corps.raison === 'nom', 'un nom trop court : refusé');
    dit((await admin({ action: 'creer', nom: 'Max', code: 'M!' })).corps.raison === 'code', 'un code mal formé : refusé');
    const m = await admin({ action: 'creer', nom: 'Max', code: 'MAX', contact: 'max.dupont@gmail.com' });
    MAX = db.t.partenaires.find((p) => p.code === 'MAX'); jetonMax = m.corps.lienPrive.split('/pa/')[1];
    dit(!!MAX, 'Julien crée un second partenaire « Max »');
    const l = await liste();
    dit(l.ok && l.installe && l.partenaires.length === 2 && !JSON.stringify(l).includes(jetonLeo), 'la liste : deux partenaires, aucun jeton');
  });

  // Des clients inventés : 23 payants pour Leo, plus des cas limites.
  const CL = Array.from({ length: 23 }, (_, i) => nouveauCompte(i + 1));
  await essaie('P2 rattacher', async () => {
    const r1 = await rattacher(CL[0], 'leo');
    dit(r1.code === 200 && r1.corps.ok, 'un compte neuf prend le code « leo »', JSON.stringify(r1.corps));
    dit((await rattacher(CL[0], 'LEO')).corps.raison === 'deja-rattache', 'une fois seulement');
    for (const id of CL.slice(1)) await rattacher(id, 'LEO');
    vieillir();
    dit(db.t.partenaire_filleuls.filter((x) => x.partenaire === LEO.id).length === 23, '23 comptes rattachés à Leo');
    dit((await rattacher(LEO_VRM, 'LEO')).corps.raison === 'ancien' || (await rattacher(LEO_VRM, 'LEO')).corps.raison === 'soi-meme', 'Leo lui-même (son compte VRM) : refusé');
    const sosie = nouveauCompte(101, { email: 'leopartenaire+vrm@gmail.com' });
    const rs = await rattacher(sosie, 'LEO');
    dit(rs.code === 400 && rs.corps.raison === 'soi-meme', 'le même e-mail à un point et un « + » près : soi-même, refusé', JSON.stringify(rs.corps));
    const sosieMax = await rattacher(nouveauCompte(108, { email: 'maxdupont+essai@gmail.com' }), 'MAX');
    dit(sosieMax.corps.raison === 'soi-meme' && !db.t.partenaires.find((p) => p.code === 'MAX').compte, 'Max (sans compte VRM) : son e-mail de contact, à un point près, refusé', JSON.stringify(sosieMax.corps));
    const memeVinted = nouveauCompte(102); db.t.vinted_accounts.push({ owner: memeVinted, vinted_user_id: '777' });
    const rv = await rattacher(memeVinted, 'LEO');
    dit(rv.corps.raison === 'soi-meme', 'un compte Vinted en commun avec Leo : soi-même, refusé', JSON.stringify(rv.corps));
    const vieux = nouveauCompte(103, { cree: iso(NOW - 45 * J) });
    dit((await rattacher(vieux, 'LEO')).corps.raison === 'ancien', 'un compte de plus de 30 jours : refusé');
    const client = nouveauCompte(104); abonne(client, 'cus_deja104');
    dit((await rattacher(client, 'LEO')).corps.raison === 'deja-client', 'un compte déjà client Stripe : refusé');
    const parraine = nouveauCompte(105); db.t.parrainages.push({ filleul: parraine, parrain: JULIEN, code: 'K7MQ4RZP', inscrit: iso(NOW) });
    dit((await rattacher(parraine, 'LEO')).corps.raison === 'deja-parraine', 'un compte déjà parrainé : refusé (une récompense par client)');
    const versParrain = await appel({ method: 'POST', mode: 'parrainage', headers: session(CL[0]), corps: { action: 'rattacher', code: 'K7MQ4RZP' } });
    dit(versParrain.corps && versParrain.corps.raison === 'deja-partenaire', "et l'inverse : un compte venu par Leo ne prend pas un parrain", JSON.stringify(versParrain.corps));
    dit((await rattacher(JULIEN, 'LEO')).corps.raison === 'proprietaire', 'le compte de Julien : refusé');
    dit((await rattacher(nouveauCompte(106), 'NOPE')).code === 404, 'un code inconnu : 404');
    dit((await appel({ method: 'POST', mode: 'partenaire', corps: { action: 'rattacher', code: 'LEO' } })).code === 401, 'sans session : 401');
    const triche = await appel({ method: 'POST', mode: 'partenaire', headers: session(nouveauCompte(107)), corps: { action: 'rattacher', code: 'LEO', filleul: CL[5] } });
    dit(triche.code === 200 && !db.t.partenaire_filleuls.some((x) => x.filleul === CL[5] && x.code !== 'LEO'), 'un identifiant glissé dans le corps est ignoré (seule la session compte)');
  });

  await essaie('P3 webhook : la commission', async () => {
    CL.forEach((id, i) => abonne(id, 'cus_cl' + (i + 1)));
    const essai = await webhook('invoice.paid', facture('cus_cl1', { montant: 0, motif: 'subscription_create', le: NOW - 30 * J }));
    dit(essai.code === 200 && commissions().length === 0, "la facture à 0 € de l'essai : rien");
    const f1 = facture('cus_cl1', { id: 'in_cl1oct' });
    const w1 = await webhook('invoice.paid', f1);
    dit(w1.code === 200 && commissions().length === 1 && commissions()[0].montant_centimes === 300, 'un paiement réel (Solo 16,99 €) : une commission de 300 centimes', JSON.stringify(w1.corps));
    dit(commissions()[0].partenaire === LEO.id && commissions()[0].filleul === CL[0] && commissions()[0].payment_intent === 'pi_cl1oct', 'rangée chez Leo, avec le paiement (pour un remboursement)');
    await webhook('invoice.paid', f1); await webhook('invoice.paid', f1);
    dit(commissions().length === 1, 'le même webhook rejoué deux fois : toujours une seule');
    const pro = await webhook('invoice.paid', facture('cus_cl2', { id: 'in_cl2oct', montant: 1999 }));
    dit(pro.code === 200 && commissions((c) => c.facture === 'in_cl2oct')[0].montant_centimes === 300, 'un client Pro (19,99 €) : 300 aussi');
    const autre = nouveauCompte(201); abonne(autre, 'cus_x201');
    await webhook('invoice.paid', facture('cus_x201', { id: 'in_x201' }));
    dit(!commissions((c) => c.facture === 'in_x201').length, 'un client venu sans code : rien');
    const regul = await webhook('invoice.paid', facture('cus_cl2', { id: 'in_cl2regul', montant: 300, motif: 'subscription_update' }));
    dit(regul.code === 200 && !commissions((c) => c.facture === 'in_cl2regul').length, 'une facture de régularisation (Solo ⇒ Pro) : rien');
    const fauxSig = await webhook('invoice.paid', facture('cus_cl3', { id: 'in_pirate' }), 'whsec_faux');
    dit(fauxSig.code === 400 && !commissions((c) => c.facture === 'in_pirate').length, 'une signature fausse : 400, rien');
    // Une base qui ne range pas : 503, Stripe rejoue, une seule commission au bout.
    db.panne('partenaire_commissions', 'POST', 1);
    const f3 = facture('cus_cl3', { id: 'in_cl3oct' });
    const p1 = await webhook('invoice.paid', f3);
    dit(p1.code === 503 && !commissions((c) => c.facture === 'in_cl3oct').length, 'commission pas rangée : 503 (Stripe rejoue), jamais « reçu »', p1.code);
    const p2 = await webhook('invoice.paid', f3);
    dit(p2.code === 200 && commissions((c) => c.facture === 'in_cl3oct').length === 1, 'le rejeu de Stripe : une seule commission');
    // Une facture sans `payments` : le paiement est lu chez Stripe.
    await webhook('invoice.paid', facture('cus_cl4', { id: 'in_cl4oct', sansPaiements: true }));
    dit(commissions((c) => c.facture === 'in_cl4oct')[0] && commissions((c) => c.facture === 'in_cl4oct')[0].payment_intent === 'pi_lu_in_cl4oct', 'paiement absent de la facture : lu chez Stripe (invoice_payments)');
    sansPaiementsStripe.in_cl5oct = 'muet';
    const muet = await webhook('invoice.paid', facture('cus_cl5', { id: 'in_cl5oct', sansPaiements: true }));
    dit(muet.code === 503 && !commissions((c) => c.facture === 'in_cl5oct').length, 'Stripe muet sur le paiement : 503, rien deviné');
    delete sansPaiementsStripe.in_cl5oct;
    for (let i = 5; i <= 23; i++) await webhook('invoice.paid', facture('cus_cl' + i, { id: `in_cl${i}oct` }));
    dit(commissions((c) => c.partenaire === LEO.id && !c.annulee_le).length === 23, '23 clients payants ⇒ 23 commissions');
    const deux = await webhook('invoice.paid', facture('cus_cl6', { id: 'in_cl6bis', le: LE_OCT + 3600e3 }));
    dit(deux.code === 200 && !commissions((c) => c.facture === 'in_cl6bis').length, 'une 2e facture du même client le même mois : rien');
  });

  await essaie('P6 ce que voit Julien', async () => {
    const l = await liste();
    const p = l.partenaires.find((x) => x.code === 'LEO');
    const c = p.chiffres;
    dit(c.inscrits === 24 && c.payantsActifs === 23, '24 inscrits (dont un qui n’a pas encore payé), 23 clients payants', `${c.inscrits} · ${c.payantsActifs}`);
    dit(c.prochainVersement && c.prochainVersement.centimes === 6900 && c.prochainVersement.clients === 23, '« 23 clients payants · 69,00 € à lui verser pour <mois> »', JSON.stringify(c.prochainVersement));
    const txt = JSON.stringify(l);
    dit(!CL.some((id) => txt.includes(id)) && !txt.includes('client1@exemple.test'), 'la liste de Julien ne porte aucun identifiant ni e-mail de client');
    const mois = c.prochainVersement.mois;
    const v = await admin({ action: 'verse', id: p.id, mois, centimes: 6900, le: iso(NOW).slice(0, 10) });
    dit(v.code === 200 && db.t.partenaire_versements.length === 1, '« Versé » noté sur SON clic (date, montant)');
    dit(!stripe.some((x) => /transfers|payouts|accounts/.test(x.chemin)), "VRM n'a fait partir AUCUN argent (ni virement, ni Stripe Connect)");
    const apres = (await liste()).partenaires.find((x) => x.code === 'LEO').chiffres;
    dit(apres.prochainVersement === null && apres.mois.find((m) => m.mois === mois).resteCentimes === 0, 'après « Versé » : soldé, plus rien à verser');
    dit((await admin({ action: 'verse', id: p.id, mois, centimes: 0, le: iso(NOW).slice(0, 10) })).code === 400, 'un versement à 0 : refusé');
    dit((await admin({ action: 'verse', id: p.id, mois, centimes: 100, le: iso(NOW + 9 * J).slice(0, 10) })).code === 400, 'un versement daté dans le futur : refusé');
    const csv = await appel({ mode: 'partenaires', headers: session(JULIEN), query: { csv: p.id } });
    dit(csv.code === 200 && /text\/csv/.test(csv.entetes['content-type'] || '') && /;Client 1;3,00;due;/.test(csv.texte || ''), "l'export CSV : clients anonymes, « 3,00 », « due »", (csv.texte || '').split('\r\n')[1]);
    dit(!CL.some((id) => (csv.texte || '').includes(id)), "le CSV ne porte aucun identifiant de client");
    dit((await appel({ mode: 'partenaires', headers: session(CL[0]), query: { csv: p.id } })).code === 403, "un client ne télécharge pas l'export (403)");
  });

  await essaie('P4 remboursement, litige, avoir', async () => {
    const r = await webhook('charge.refunded', { id: 'ch_cl2', object: 'charge', amount_refunded: 1999, payment_intent: 'pi_cl2oct', customer: 'cus_cl2' });
    const c2 = commissions((c) => c.facture === 'in_cl2oct')[0];
    dit(r.code === 200 && c2.annulee_le && c2.annulee_raison === 'remboursement', 'charge.refunded : la commission est annulée (gardée, marquée)');
    await webhook('charge.dispute.created', { id: 'dp_cl7', object: 'dispute', charge: 'ch_cl7', payment_intent: 'pi_cl7oct' });
    dit(commissions((c) => c.facture === 'in_cl7oct')[0].annulee_raison === 'litige', 'charge.dispute.created : annulée (litige)');
    await webhook('credit_note.created', { id: 'cn_cl8', object: 'credit_note', invoice: 'in_cl8oct', amount: 1699, status: 'issued' });
    dit(commissions((c) => c.facture === 'in_cl8oct')[0].annulee_raison === 'avoir', 'credit_note.created : annulée (avoir)');
    dit(commissions().length >= 23, "rien n'est effacé");
    // Remboursement reçu AVANT la facture payée (événements dans le désordre).
    const tardif = nouveauCompte(301); await rattacher(tardif, 'LEO'); vieillir(); abonne(tardif, 'cus_t301');
    await webhook('charge.refunded', { id: 'ch_t301', object: 'charge', amount_refunded: 1699, payment_intent: 'pi_t301' });
    await webhook('invoice.paid', facture('cus_t301', { id: 'in_t301', pi: 'pi_t301' }));
    const t = commissions((c) => c.facture === 'in_t301')[0];
    dit(t && t.annulee_raison === 'remboursement', 'remboursé AVANT que la facture payée arrive : la commission naît annulée', JSON.stringify(t || null));
    const l = (await liste()).partenaires.find((x) => x.code === 'LEO').chiffres;
    const m = l.mois.find((x) => x.nAnnulees > 0);
    dit(m && m.nAnnulees === 4 && m.dueCentimes === 6000 && m.resteCentimes === -900, 'après versement de 69,00 €, 3 annulées (+ 1 née annulée) ⇒ « trop versé : 9,00 € à reprendre » (dit)', JSON.stringify(m && { n: m.nAnnulees, d: m.dueCentimes, r: m.resteCentimes }));
  });

  await essaie('P5 client résilié', async () => {
    const avant = (await liste()).partenaires.find((x) => x.code === 'LEO').chiffres.payantsActifs;
    const r = await webhook('customer.subscription.deleted', { id: 'sub_cl10', object: 'subscription', customer: 'cus_cl10', status: 'canceled', metadata: { owner: CL[9] }, items: { data: [] } });
    dit(r.code === 200 && db.t.abonnements.find((x) => x.owner === CL[9]).statut === 'canceled', "l'abonnement résilié est rangé (le webhook d'avant, inchangé)");
    const apres = (await liste()).partenaires.find((x) => x.code === 'LEO').chiffres;
    dit(apres.payantsActifs === avant - 1, 'il ne compte plus parmi les clients payants', `${avant} ⇒ ${apres.payantsActifs}`);
    dit(commissions((c) => c.filleul === CL[9] && !c.annulee_le).length === 1, "ce qu'il a déjà rapporté reste (rien de rétroactif)");
  });

  await essaie('P7 la page du partenaire', async () => {
    const r = await appel({ mode: 'partenaire', query: { j: jetonLeo } });
    dit(r.code === 200 && r.corps.ok && r.corps.code === 'LEO' && r.corps.nom === 'Leo', 'le lien privé de Leo ouvre SA page, sans session');
    const s = JSON.stringify(r.corps);
    dit(!CL.some((id) => s.includes(id)) && !/@/.test(s) && !/LEO50|cus_|pi_|in_|ch_/.test(s) && !s.includes(LEO.id) && !('contact' in r.corps), 'aucun identifiant, aucun e-mail (ni le sien), aucun coupon, aucune référence Stripe');
    dit(r.corps.chiffres.inscrits === 25 && r.corps.chiffres.mois.length >= 1, 'ses nombres : inscrits, mois par mois');
    dit(r.entetes['cache-control'] === 'no-store' && r.entetes['x-robots-tag'] === 'noindex', 'jamais mise en cache ni indexée');
    const m = await appel({ mode: 'partenaire', query: { j: jetonMax } });
    dit(m.code === 200 && m.corps.code === 'MAX' && m.corps.chiffres.inscrits === 0 && m.corps.chiffres.mois.length === 0 && m.corps.chiffres.totaux.dueCentimes === 0, 'le lien de Max ne montre RIEN de Leo (un partenaire ne lit pas un autre)', JSON.stringify(m.corps.chiffres.totaux));
    dit((await appel({ mode: 'partenaire', query: { j: 'x'.repeat(43) } })).code === 404, 'un jeton inventé : 404');
    dit((await appel({ mode: 'partenaire', query: { j: 'court' } })).code === 404, 'un jeton mal formé : 404');
    const n = await admin({ action: 'lien', id: LEO.id });
    dit(n.code === 200 && (await appel({ mode: 'partenaire', query: { j: jetonLeo } })).code === 404, "« Nouveau lien privé » : l'ancien ne marche plus");
    jetonLeo = n.corps.lienPrive.split('/pa/')[1];
    dit((await appel({ mode: 'partenaire', query: { j: jetonLeo } })).code === 200, 'le nouveau marche');
  });

  await essaie('P8 pause et avantage', async () => {
    dit((await admin({ action: 'coupon', id: LEO.id, coupon: 'INCONNU' })).corps.raison === 'coupon-inconnu', 'un coupon qui n’existe pas chez Stripe : refusé');
    dit(!db.t.partenaires.find((p) => p.id === LEO.id).coupon, "l'avantage reste éteint (par défaut)");
    // Sans avantage : le paiement d'un filleul part SANS remise.
    const neuf = nouveauCompte(401); await rattacher(neuf, 'LEO');
    stripe = [];
    const c0 = await appel({ method: 'POST', mode: 'checkout', headers: session(neuf), corps: { cgv: true, accesImmediat: true } });
    const s0 = stripe.find((x) => x.chemin === 'checkout/sessions');
    dit(c0.code === 200 && s0 && !s0.corps.get('discounts[0][coupon]'), 'avantage éteint : le paiement part sans remise', c0.code + ' ' + JSON.stringify(c0.corps));
    dit((await admin({ action: 'coupon', id: LEO.id, coupon: 'LEO50' })).corps.ok, 'Julien pose le coupon LEO50 (vérifié chez Stripe)');
    stripe = [];
    const c1 = await appel({ method: 'POST', mode: 'checkout', headers: session(neuf), corps: { cgv: true, accesImmediat: true } });
    const s1 = stripe.find((x) => x.chemin === 'checkout/sessions');
    dit(c1.code === 200 && s1 && s1.corps.get('discounts[0][coupon]') === 'LEO50', 'avantage posé : le premier abonnement du filleul porte le coupon LEO50');
    const horsCode = nouveauCompte(402); stripe = [];
    await appel({ method: 'POST', mode: 'checkout', headers: session(horsCode), corps: { cgv: true, accesImmediat: true } });
    const s2 = stripe.find((x) => x.chemin === 'checkout/sessions');
    dit(s2 && !s2.corps.get('discounts[0][coupon]'), 'un compte venu sans code : jamais de remise');
    const p = await admin({ action: 'pause', id: LEO.id, pause: true });
    dit(p.code === 200 && db.t.partenaires.find((x) => x.id === LEO.id).pause_le, 'Julien met Leo en pause');
    dit((await rattacher(nouveauCompte(403), 'LEO')).corps.raison === 'pause', 'en pause : son code n’attache plus personne');
    const fDec = await webhook('invoice.paid', facture('cus_cl1', { id: 'in_cl1nov', le: moisSuivant(LE_OCT) }));
    dit(fDec.code === 200 && commissions((c) => c.facture === 'in_cl1nov').length === 1, 'en pause : un client déjà venu qui paie compte toujours (« à vie »)');
    const l = (await liste()).partenaires.find((x) => x.code === 'LEO');
    dit(l.pause && l.chiffres.totaux.attenteCentimes >= 300, 'la nouvelle commission est « en attente » (moins de 14 jours)');
    await admin({ action: 'pause', id: LEO.id, pause: false });
    dit(!db.t.partenaires.find((x) => x.id === LEO.id).pause_le, '« Reprendre » rouvre le code');
  });

  // (16 nov., lot compta-donnees) Un remboursement PARTIEL réduit la commission au prorata.
  await essaie('P4b remboursement partiel', async () => {
    const id = nouveauCompte(601); await rattacher(id, 'LEO'); vieillir(); abonne(id, 'cus_p401');
    await webhook('invoice.paid', facture('cus_p401', { id: 'in_p401', pi: 'pi_p401' }));
    const lire = () => commissions((c) => c.facture === 'in_p401')[0];
    dit(lire() && lire().rembourse_centimes === 0, 'la commission naît entière (3,00 €)');
    // Stripe envoie refund.created PUIS charge.refunded pour le MÊME euro rendu.
    const r1 = await webhook('refund.created', { id: 're_p401a', object: 'refund', amount: 100, charge: 'ch_p401', payment_intent: 'pi_p401', status: 'succeeded' });
    const r2 = await webhook('charge.refunded', { id: 'ch_p401', object: 'charge', amount_refunded: 100, payment_intent: 'pi_p401' });
    dit(r1.code === 200 && r2.code === 200 && !lire().annulee_le && lire().rembourse_centimes === 100, '1 € rendu (deux événements du même geste) : réduite de 1 €, PAS annulée', JSON.stringify({ a: lire().annulee_le, r: lire().rembourse_centimes }));
    await webhook('refund.created', { id: 're_p401a', object: 'refund', amount: 100, charge: 'ch_p401', payment_intent: 'pi_p401', status: 'succeeded' });
    dit(lire().rembourse_centimes === 100, 'le même webhook rejoué ne compte rien de plus');
    // Deux remboursements distincts EN MÊME TEMPS : aucun n'efface l'autre.
    await Promise.all([
      webhook('refund.created', { id: 're_p401b', object: 'refund', amount: 200, charge: 'ch_p401', payment_intent: 'pi_p401', status: 'succeeded' }),
      webhook('refund.created', { id: 're_p401c', object: 'refund', amount: 300, charge: 'ch_p401', payment_intent: 'pi_p401', status: 'succeeded' }),
    ]);
    dit(lire().rembourse_centimes === 600 && !lire().annulee_le, 'deux remboursements en même temps (2 € et 3 €) : 6 € rendus en tout, jamais redescendu', lire().rembourse_centimes);
    const ch = (await liste()).partenaires.find((x) => x.code === 'LEO').chiffres;
    const mo = ch.mois.find((x) => x.nReduites > 0);
    dit(mo && mo.nReduites === 1, 'la page de Julien dit « 1 réduite »', JSON.stringify(mo && { n: mo.nReduites }));
    const csv = await appel({ mode: 'partenaires', headers: session(JULIEN), query: { csv: LEO.id } });
    dit(/;1,94;(due|attente);remboursement partiel 6,00/.test(csv.texte || ''), 'le CSV : 3 € × 10,99 / 16,99 = 1,94 € et « remboursement partiel 6,00 »', ((csv.texte || '').split('\r\n').find((l) => /partiel/.test(l)) || '').slice(0, 140));
    // Le reste rendu : toute la facture ⇒ annulée.
    await webhook('charge.refunded', { id: 'ch_p401', object: 'charge', amount_refunded: 1699, payment_intent: 'pi_p401' });
    dit(lire().annulee_le && lire().annulee_raison === 'remboursement', 'puis toute la facture rendue ⇒ annulée (gardée, dite)');
    // Rendu partiel reçu AVANT la facture payée : elle naît réduite.
    const t2 = nouveauCompte(602); await rattacher(t2, 'LEO'); vieillir(); abonne(t2, 'cus_p402');
    await webhook('refund.created', { id: 're_p402', object: 'refund', amount: 500, charge: 'ch_p402', payment_intent: 'pi_p402', status: 'succeeded' });
    await webhook('invoice.paid', facture('cus_p402', { id: 'in_p402', pi: 'pi_p402' }));
    const n2 = commissions((c) => c.facture === 'in_p402')[0];
    dit(n2 && !n2.annulee_le && n2.rembourse_centimes === 500, 'rendu partiel reçu AVANT la facture : elle naît réduite, pas annulée', JSON.stringify(n2 && { a: n2.annulee_le, r: n2.rembourse_centimes }));
    // LECTURE KO, ÉCRITURE OK : la relecture des signaux tombe ⇒ rien n'est écrit sur la
    // commission, 503 (Stripe rejoue) ; le rejeu pose la bonne réduction.
    const t3 = nouveauCompte(603); await rattacher(t3, 'LEO'); vieillir(); abonne(t3, 'cus_p403');
    await webhook('invoice.paid', facture('cus_p403', { id: 'in_p403', pi: 'pi_p403' }));
    db.panne('partenaire_annulations', 'GET', 1);
    const rk = await webhook('refund.created', { id: 're_p403', object: 'refund', amount: 400, charge: 'ch_p403', payment_intent: 'pi_p403', status: 'succeeded' });
    const k1 = commissions((c) => c.facture === 'in_p403')[0];
    dit(rk.code === 503 && k1.rembourse_centimes === 0 && !k1.annulee_le, 'relecture des signaux en panne : 503, la commission n’est PAS touchée (ni annulée, ni réduite au hasard)', JSON.stringify({ code: rk.code, r: k1.rembourse_centimes, a: k1.annulee_le }));
    const rk2 = await webhook('refund.created', { id: 're_p403', object: 'refund', amount: 400, charge: 'ch_p403', payment_intent: 'pi_p403', status: 'succeeded' });
    const k2 = commissions((c) => c.facture === 'in_p403')[0];
    dit(rk2.code === 200 && k2.rembourse_centimes === 400, 'Stripe rejoue : 4 € rendus, posés une fois', JSON.stringify({ code: rk2.code, r: k2.rembourse_centimes }));
  });

  await essaie('P9 sans la 043', async () => {
    reset({ sans043: true });
    const id = nouveauCompte(501); abonne(id, 'cus_s501');
    const w = await webhook('invoice.paid', facture('cus_s501', { id: 'in_s501' }));
    dit(w.code === 200, 'tables absentes : le webhook acquitte (rien ne casse, Stripe ne rejoue pas sans fin)', JSON.stringify(w.corps));
    const r = await webhook('charge.refunded', { id: 'ch_s501', object: 'charge', amount_refunded: 100, payment_intent: 'pi_s501' });
    dit(r.code === 200, 'tables absentes : un remboursement acquitte aussi');
    dit((await liste()).installe === false, "l'écran de Julien dit « pas installé »");
    dit((await rattacher(nouveauCompte(502), 'LEO')).corps.raison === 'ferme', 'rattacher : « pas encore ouvert »');
    stripe = [];
    const c = await appel({ method: 'POST', mode: 'checkout', headers: session(nouveauCompte(503)), corps: { cgv: true, accesImmediat: true } });
    dit(c.code === 200, 'le paiement reste ouvert sans la 043', c.code);
    dit((await appel({ mode: 'partenaire', query: { j: 'y'.repeat(43) } })).code === 404, 'la page partenaire : « lien plus valable »');
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
