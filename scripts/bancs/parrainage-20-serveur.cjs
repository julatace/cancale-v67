#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC — LE PARRAINAGE À 20 %, CÔTÉ SERVEUR, EXÉCUTÉ (25 nov. 2026)
//  node scripts/bancs/parrainage-20-serveur.cjs            (le banc)
//  node scripts/bancs/parrainage-20-serveur.cjs --prouve   (chaque règle réaffaiblie ⇒ ROUGE)
//
//  Décision de Julien (25 nov.) : « le client économise 10 % le premier mois et le
//  parrain touche 20 % de ce que je perçois tous les mois tant que son filleul paye » ;
//  le parrain choisit « payer son abonnement avec » ou « le virement » ; le mois
//  offert devient une semaine offerte.
//  Exécute le VRAI api/compte.js (webhook Stripe SIGNÉ, `mode=parrainage`,
//  `mode=checkout`, `mode=partenaires`) sur le faux PostgREST en mémoire
//  (scripts/bancs/_faux-postgrest.cjs) et un faux Stripe local qui GARDE les crédits
//  posés sur les soldes clients. Aucune clé, aucune donnée réelle (dépôt PUBLIC).
//    Q1 la règle pure : 16,99 € ⇒ 3,39 € ; 19,99 € ⇒ 3,99 € ; 0 € ⇒ rien ; rejeu ⇒ rien ;
//       due 14 j après ; avant le rattachement ⇒ rien ; IBAN mod 97 ; mode à l'échéance ;
//    Q2 webhook : facture d'essai 0 € ⇒ rien ; 1er paiement ⇒ un gain de 339 + UNE semaine
//       (396) créditée au filleul et au parrain ; rejoué ⇒ rien de plus ;
//    Q3 remboursement total ⇒ annulé ; partiel ⇒ prorata ; litige ⇒ annulé ;
//    Q4 soi-même (même carte) ⇒ refus, aucun gain ; parrainage fermé ⇒ rien ;
//    Q5 choix « crédit » ⇒ crédit Stripe UNE fois (GET rejoué, invoice.created rejoué) ;
//       filleul pas encore vérifié ⇒ rien ne part ;
//    Q6 choix « virement » ⇒ rien chez Stripe, « à verser » chez Julien dès 20 €,
//       « Versé » ⇒ soldé ; le choix ne touche que les gains dus APRÈS lui ;
//    Q7 IBAN : faux ⇒ 400 ; vrai ⇒ masqué partout sauf chez Julien ; jamais un filleul nommé ;
//    Q8 coupon −10 % au paiement du filleul, créé une fois chez Stripe ; jamais cumulé avec
//       un code partenaire ; un compte sans parrain n'en a pas ;
//    Q9 049 pas passée : le webhook acquitte, l'écran dit « pas installé » ; une écriture
//       qui tombe ⇒ 503 (Stripe rejoue) puis un seul gain.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto'), os = require('os');
const { spawnSync } = require('child_process');
const { fauxPostgrest } = require('./_faux-postgrest.cjs');
const RACINE_DEPOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const RACINE = process.env.BANC_RACINE || RACINE_DEPOT;

// ── --prouve : chaque mutation (dans une COPIE de l'arbre) doit rougir ──────
const MUTATIONS = {
  'regle:arrondi-haut': ['api/_lib/parrainage-regle.js', 'Math.floor((Number(centimes) * POURCENT_PARRAIN) / 100)', 'Math.round((Number(centimes) * POURCENT_PARRAIN) / 100)'],
  'regle:rejeu-double': ['api/_lib/parrainage-regle.js', "  if (existantes.some((g) => g && g.facture === facture.id)) return { rien: 'deja' };\n", ''],
  'regle:refus-ignore': ['api/_lib/parrainage-regle.js', "  if (parrainage.refus) return { rien: 'refuse' };\n", ''],
  'regle:du-tout-de-suite': ['api/_lib/parrainage-regle.js', '    due_le: new Date(paye + DELAI_DUE_JOURS * 86400000).toISOString(),', '    due_le: new Date(paye).toISOString(),'],
  'regle:retroactif': ['api/_lib/parrainage-regle.js', "  if (!Number.isFinite(inscrit) || paye < inscrit) return { rien: 'avant-rattachement' };\n", ''],
  'regle:choix-retroactif': ['api/_lib/parrainage-regle.js', '    if (t <= instantMs && t >= le) { mode = c.mode; le = t; }', '    if (t >= le) { mode = c.mode; le = t; }'],
  'regle:seuil-ignore': ['api/_lib/parrainage-regle.js', '    virementPret: aVerser >= SEUIL_VIREMENT_CENTIMES,', '    virementPret: aVerser > 0,'],
  'regle:verification-ignoree': ['api/_lib/parrainage-regle.js', "    else if (verifies && !verifies.has(String(g.filleul))) etat = 'verification';\n", ''],
  'regle:iban-sans-cle': ['api/_lib/parrainage-regle.js', '  return m === 1 ? t : \'\';', '  return t;'],
  'gains:credit-double': ['api/_lib/parrainage-gains.js', 'await crediter(client, `gain:${x.facture}`, x.net,', 'await crediter(client, `gain:${x.facture}:${Math.random()}`, x.net,'],
  'gains:annulation-perdue': ['api/_lib/parrainage-gains.js', "      const w = await ecrire('PATCH', `parrainage_gains?facture=eq.${enc(g.facture)}&annulee_le=is.null`, { annulee_le: le, annulee_raison: rb.raison }, 'return=representation');", "      const w = { ok: true, json: [] };"],
  'gains:partiel-perdu': ['api/_lib/parrainage-gains.js', "      const w = await ecrire('PATCH', `parrainage_gains?facture=eq.${enc(g.facture)}&annulee_le=is.null&rembourse_centimes=lt.${rb.centimes}`, { rembourse_centimes: rb.centimes }, 'return=representation');", "      const w = { ok: true, json: [] };"],
  'gains:panne-acquittee': ['api/_lib/parrainage-gains.js', "  if (w.absent) return { ok: true, rien: 'non-installe' };\n  return { ok: false };\n}", "  return { ok: true };\n}"],
  'gains:iban-en-clair': ['api/_lib/parrainage-gains.js', "    installe: true, mode: modeActuel(c.lignes, maintenant), iban: i && i.iban ? ibanMasque(i.iban) : null,", "    installe: true, mode: modeActuel(c.lignes, maintenant), iban: i && i.iban ? i.iban : null,"],
  'compte:sans-remise': ['api/compte.js', "      if (remise) { params.discounts = [{ coupon: remise }];", "      if (false) { params.discounts = [{ coupon: remise }];"],
  'compte:remise-cumulee': ['api/compte.js', "    // (25 nov.) LE FILLEUL : −10 % sur son 1er mois payé (jamais cumulé avec un code partenaire).\n    else {", "    // (25 nov.) LE FILLEUL : −10 % sur son 1er mois payé (jamais cumulé avec un code partenaire).\n    {"],
  'compte:mois-au-lieu-semaine': ['api/compte.js', 'const p = await factureFilleulPayee(owner, client, obj, creditSemaine(PRIX_CGV.centimes));', 'const p = await factureFilleulPayee(owner, client, obj, PRIX_CGV.centimes);'],
  'compte:gain-oublie': ['api/compte.js', '    const g = await gainFacturePayee(owner, obj);', '    const g = { ok: true };'],
  // (25 nov.) Tous les filleuls, le potentiel, la vie privée.
  'regle:potentiel-prix-solo': ['api/_lib/parrainage-regle.js', "    const p = prixDe(plan || 'solo');", "    const p = prixDe('solo');"],
  'regle:si-tous-sans-payants': ['api/_lib/parrainage-regle.js', '  return { filleuls, nPayants, nPossibles, potentielMoisCentimes: potentiel, siTousCentimes: potentiel + possibles };', '  return { filleuls, nPayants, nPossibles, potentielMoisCentimes: potentiel, siTousCentimes: possibles };'],
  'regle:essai-vu-inscrit': ['api/_lib/parrainage-regle.js', "    else if (statut === 'trialing') { etat = 'essai';", "    else if (false) { etat = 'essai';"],
  'gains:fuite-email': ['api/_lib/parrainage-gains.js', '  const noms = identites instanceof Map ? identites : await nomsMontres(lignes.map((x) => x.filleul));', '  const noms = new Map(await Promise.all(lignes.map(async (x) => [String(x.filleul), await emailDe(x.filleul)])));'],
  'gains:consentement-ignore': ['api/_lib/parrainage-gains.js', "      if (!x || String(x.montrer) !== 'true' || !x.nom) continue;", "      if (!x || !x.nom) continue;"],
  'gains:nom-non-revalide': ['api/_lib/parrainage-gains.js', '      if (ok.ok) noms.set(String(x.owner), ok.nom);', '      noms.set(String(x.owner), x.nom);'],
  'compte:admin-ouvert': ['api/compte.js', "  if (String(proprio) !== String(u.id)) return repondre(res, 403, { ok: false, raison: 'proprietaire' });", ''],
};
if (args.includes('--prouve')) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-parrainage20-'));
  let rouges = 0;
  try {
    for (const d of ['api', 'src', 'public/legal']) fs.cpSync(path.join(RACINE_DEPOT, d), path.join(base, d), { recursive: true, filter: (s) => !/node_modules|\.png$|\.jpe?g$|\.woff2?$|\.mp4$/.test(s) });
    fs.copyFileSync(path.join(RACINE_DEPOT, 'package.json'), path.join(base, 'package.json'));
    fs.symlinkSync(fs.realpathSync(path.join(RACINE_DEPOT, 'node_modules')), path.join(base, 'node_modules'), 'dir');
    const temoin = spawnSync(process.execPath, [__filename], { encoding: 'utf8', env: { ...process.env, BANC_RACINE: base }, maxBuffer: 64 << 20 });
    const rt = (temoin.stdout.match(/^❌ /gm) || []).length;
    console.log(`${temoin.status === 0 && !rt ? '✅' : '❌'} témoin : la copie non mutée est verte (${rt} rouge(s))`);
    if (temoin.status !== 0 || rt) { console.log(temoin.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 5).join('\n')); process.exit(1); }
    for (const [nom, [fichier, a, b]] of Object.entries(MUTATIONS)) {
      const cible = path.join(base, fichier);
      const origine = fs.readFileSync(cible, 'utf8');
      const n = origine.split(a).length - 1;
      if (n !== 1) { console.log(`❌ mutation « ${nom} » → ancre introuvable (${n})`); continue; }
      fs.writeFileSync(cible, origine.split(a).join(b));
      const r = spawnSync(process.execPath, [__filename], { encoding: 'utf8', env: { ...process.env, BANC_RACINE: base }, maxBuffer: 64 << 20 });
      fs.writeFileSync(cible, origine);
      const k = (r.stdout.match(/^❌ /gm) || []).length;
      const bon = r.status !== 0 && k > 0;
      if (bon) rouges++;
      console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? k + ' rouge(s)' : 'RESTE VERTE'}`);
      if (bon) for (const l of r.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 1)) console.log('      ' + l.slice(0, 180));
    }
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
  console.log(`\n${rouges}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(rouges === Object.keys(MUTATIONS).length ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d !== undefined && d !== '' ? ' — ' + String(d).slice(0, 240) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.stack || e).split('\n').slice(0, 3).join(' ')); } };

// ── Le monde INVENTÉ ────────────────────────────────────────────────────────
const J = 86400000, NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const uid = (i) => `77777777-0000-4000-8000-${String(i).padStart(12, '0')}`;
const JULIEN = 'aaaaaaaa-2222-4222-8222-000000000001';
const COMPTES = { [JULIEN]: { email: 'proprio@exemple.test', created_at: iso(NOW - 400 * J) } };
const jetonDe = (id) => 'jt.x.' + id;
const nouveauCompte = (i, o = {}) => { const id = uid(i); COMPTES[id] = { email: o.email || `vendeur${i}@exemple.test`, created_at: o.cree || iso(NOW - 2 * J) }; return id; };
const tokens = () => Object.fromEntries(Object.entries(COMPTES).map(([id, c]) => [jetonDe(id), { id, ...c }]));
const SCH = {
  abonnements: { uniques: [['owner']], defauts: { plan: null, fin_periode: null } }, vrm_reglages: { uniques: [['cle']] },
  parrainages: { uniques: [['filleul']] }, parrainage_codes: { uniques: [['owner'], ['code']] },
  vinted_accounts: {}, essais_gratuits: { uniques: [['cle']] }, app_data: { uniques: [['owner', 'id']] },
  partenaires: { uniques: [['id'], ['code'], ['jeton_empreinte']], defauts: { id: () => crypto.randomUUID(), pause_le: null, coupon: null, compte: null, contact: null } },
  partenaire_filleuls: { uniques: [['filleul']] }, partenaire_commissions: { uniques: [['facture']] }, partenaire_annulations: { uniques: [['cle', 'signal']] }, partenaire_versements: {},
  parrainage_gains: { uniques: [['facture']], defauts: { credite_le: null, credit_centimes: null },
    verifier: (l) => (l.montant_centimes * 5 > l.facture_centimes ? 'plus de 20 %' : Date.parse(l.due_le) < Date.parse(l.paye_le) + 14 * J ? 'due' : (!!l.annulee_le) !== (!!l.annulee_raison) ? 'annulee' : '') },
  parrainage_annulations: { uniques: [['cle', 'signal']] },
  parrainage_choix: { defauts: { id: () => crypto.randomUUID() } },
  parrainage_iban: { uniques: [['parrain']] },
  parrainage_versements: { defauts: { id: () => crypto.randomUUID() } },
};
const T049 = ['parrainage_gains', 'parrainage_annulations', 'parrainage_choix', 'parrainage_iban', 'parrainage_versements'];
let db, stripe, soldes, coupons, cartes, idem;
const reset = ({ sans049 = false, ouvert = '1' } = {}) => {
  db = fauxPostgrest({ schemas: SCH, absentes: new Set(sans049 ? T049 : []), fermees: new Set([...T049, 'parrainages']),
    estService: (h) => !String(h.Authorization || '').startsWith('Bearer jt.'),
    rlsVendeur: { abonnements: (h) => { const id = String(h.Authorization).slice('Bearer jt.x.'.length); return (l) => l.owner === id; } } });
  db.t.vrm_reglages.push({ cle: 'proprietaire', valeur: JULIEN }, { cle: 'parrainage', valeur: ouvert });
  stripe = []; soldes = {}; coupons = { LEO50: { id: 'LEO50', valid: true, percent_off: 50, duration: 'once' } }; cartes = {}; idem = new Map();
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
    const cle = h['Idempotency-Key'] || h['idempotency-key'] || '';
    stripe.push({ m, chemin, corps, cle });
    if (cle && m === 'POST' && idem.has(cle)) return rep(idem.get(cle));
    const garder = (o) => { if (cle && m === 'POST') idem.set(cle, o); return rep(o); };
    if (chemin === 'invoice_payments') return rep({ object: 'list', data: [{ object: 'invoice_payment', payment: { type: 'payment_intent', payment_intent: 'pi_lu_' + corps.get('invoice') } }] });
    if (chemin === 'coupons' && m === 'POST') { const id = corps.get('id'); coupons[id] = { id, valid: true, percent_off: Number(corps.get('percent_off')), duration: corps.get('duration'), duration_in_months: Number(corps.get('duration_in_months')) || null }; return garder(coupons[id]); }
    if (chemin.startsWith('coupons/')) { const c = coupons[decodeURIComponent(chemin.split('/')[1])]; return c ? rep(c) : rep({ error: { message: 'No such coupon' } }, 404); }
    if (chemin === 'prices') return rep({ data: [{ id: 'price_banc', unit_amount: 1699, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } }] });
    if (chemin === 'checkout/sessions') return rep({ id: 'cs_banc', url: 'https://checkout.stripe.com/c/pay/cs_banc' });
    if (chemin === 'payment_methods') { const c = corps.get('customer'); return rep({ object: 'list', data: (cartes[c] || []).map((f, i) => ({ id: 'pm_' + i, card: { fingerprint: f } })) }); }
    const bt = /^customers\/([^/]+)\/balance_transactions$/.exec(chemin);
    if (bt) {
      const c = decodeURIComponent(bt[1]);
      if (m === 'GET') return rep({ object: 'list', data: soldes[c] || [] });
      const t = { id: 'cbtxn_' + crypto.randomBytes(4).toString('hex'), amount: Number(corps.get('amount')), description: corps.get('description'), metadata: { vrm_parrainage: corps.get('metadata[vrm_parrainage]') } };
      (soldes[c] = soldes[c] || []).push(t);
      return garder(t);
    }
    return rep({ error: { message: 'inconnu ' + chemin } }, 404);
  }
  return rep({}, 404);
};

const SECRET = 'whsec_banc_parrainage20';
const faireRes = () => { const r = { code: null, corps: null, entetes: {}, texte: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = (k, v) => { r.entetes[k.toLowerCase()] = v; }; r.end = (t) => { r.texte = t == null ? null : String(t); return r; }; return r; };
const req = ({ method = 'GET', mode, headers = {}, corps = null, query = {} }) => {
  const buf = corps == null ? null : Buffer.from(typeof corps === 'string' ? corps : JSON.stringify(corps), 'utf8');
  return { method, query: { mode, ...query }, headers, async *[Symbol.asyncIterator]() { if (buf) yield buf; } };
};
const signer = (c) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${crypto.createHmac('sha256', SECRET).update(`${t}.${c}`).digest('hex')}`; };
let nEvt = 0;
const evt = (type, objet) => JSON.stringify({ id: 'evt_p20_' + (++nEvt), object: 'event', type, created: Math.floor(Date.now() / 1000) + nEvt, livemode: false, data: { object: objet } });
const S = (ms) => Math.floor(ms / 1000);
let nFac = 0;
const facture = (client, o = {}) => {
  const id = o.id || 'in_p20x' + (++nFac); const le = o.le || NOW - 20 * J;
  return { id, object: 'invoice', status: 'paid', currency: 'eur', customer: client, amount_paid: o.montant ?? 1699, total: o.montant ?? 1699,
    billing_reason: o.motif || 'subscription_cycle', created: S(le), status_transitions: { paid_at: S(le), finalized_at: S(le) },
    parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_' + client.slice(4), metadata: {} } },
    payments: { object: 'list', data: [{ object: 'invoice_payment', payment: { type: 'payment_intent', payment_intent: o.pi || 'pi_' + id.slice(3) } }] } };
};

(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc_parrainage20';
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  delete process.env.VRM_OWNER_UID;
  let compte, R;
  try {
    compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default;
    R = await import('file://' + path.join(RACINE, 'api', '_lib', 'parrainage-regle.js'));
  } catch (e) { dit(false, 'api/compte.js et la règle se chargent', e.message); console.log(`\n${ok} vert(s), ${ko} rouge(s).`); process.exit(1); }
  try { await import('file://' + path.join(RACINE, 'public', 'legal', 'editeur.js')); } catch (_) {}
  if (globalThis.VRM_EDITEUR) for (const k of Object.keys(globalThis.VRM_EDITEUR)) globalThis.VRM_EDITEUR[k] = 'valeur d’essai ' + k;
  const appel = async (o) => { const r = faireRes(); await compte(req(o), r); return r; };
  const session = (id) => ({ Authorization: 'Bearer ' + jetonDe(id) });
  const webhook = (type, objet) => { const c = evt(type, objet); return appel({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }); };
  const abonne = (owner, client, statut = 'active') => { const l = db.t.abonnements.find((x) => x.owner === owner); if (l) Object.assign(l, { client_stripe: client, statut }); else db.t.abonnements.push({ owner, client_stripe: client, statut, abonnement_stripe: 'sub_' + client.slice(4), evenement_ts: 1, maj: null }); };
  const vue = async (id) => (await appel({ mode: 'parrainage', headers: session(id) })).corps;
  const choisir = (id, mode) => appel({ method: 'POST', mode: 'parrainage', headers: session(id), corps: { action: 'choix', mode } });
  // Un parrain et un filleul neufs : le code, le rattachement (par la VRAIE route), les comptes Vinted.
  let n = 0;
  const couple = async (o = {}) => {
    const p = nouveauCompte(++n * 10), f = nouveauCompte(n * 10 + 1);
    db.t.vinted_accounts.push({ owner: p, vinted_user_id: String(5000 + n) });
    if (!o.sansVinted) db.t.vinted_accounts.push({ owner: f, vinted_user_id: String(9000 + n) });
    const v = await vue(p);
    const r = await appel({ method: 'POST', mode: 'parrainage', headers: session(f), corps: { action: 'rattacher', code: v.code } });
    if (!r.corps || !r.corps.ok) throw new Error('rattacher : ' + JSON.stringify(r.corps));
    for (const l of db.t.parrainages) if (l.filleul === f) l.inscrit = iso(NOW - 40 * J);   // le temps passe
    const cp = 'cus_p' + n, cf = 'cus_f' + n;
    abonne(p, cp); abonne(f, cf);
    cartes[cp] = ['fp_p' + n]; cartes[cf] = [o.memeCarte ? 'fp_p' + n : 'fp_f' + n];
    return { p, f, cp, cf, code: v.code };
  };
  const gains = (f) => db.t.parrainage_gains.filter(f || (() => true));

  reset();
  await essaie('Q1 la règle pure', async () => {
    const PARR = { filleul: uid(1), parrain: uid(2), inscrit: iso(NOW - 40 * J) };
    const d = R.decisionGain({ facture: facture('cus_x', { id: 'in_q1' }), parrainage: PARR });
    dit(d.creer && d.creer.montant_centimes === 339, 'facture de 16,99 € ⇒ 20 % = 3,39 € (arrondi inférieur)', JSON.stringify(d).slice(0, 120));
    dit(R.decisionGain({ facture: facture('cus_x', { montant: 1999 }), parrainage: PARR }).creer.montant_centimes === 399, 'Pro 19,99 € ⇒ 3,99 €');
    dit(R.decisionGain({ facture: facture('cus_x', { montant: 0, motif: 'subscription_create' }), parrainage: PARR }).rien === 'zero', "la facture à 0 € de l'essai ⇒ rien");
    dit(R.decisionGain({ facture: facture('cus_x', { id: 'in_q1' }), parrainage: PARR, existantes: [{ facture: 'in_q1' }] }).rien === 'deja', 'la même facture rejouée ⇒ rien de plus');
    dit(R.decisionGain({ facture: facture('cus_x', { motif: 'subscription_update' }), parrainage: PARR }).rien === 'motif', 'une régularisation (update) ⇒ rien');
    dit(R.decisionGain({ facture: facture('cus_x', { le: NOW - 50 * J }), parrainage: PARR }).rien === 'avant-rattachement', 'payée avant le rattachement ⇒ rien (pas rétroactif)');
    dit(R.decisionGain({ facture: facture('cus_x'), parrainage: { ...PARR, refus: 'meme-carte' } }).rien === 'refuse', 'filleul refusé par la règle anti-abus ⇒ rien');
    dit(Date.parse(d.creer.due_le) - Date.parse(d.creer.paye_le) === 14 * J, 'dû 14 jours après le paiement');
    dit(R.gainNet({ montant_centimes: 339, facture_centimes: 1699, rembourse_centimes: 1000 }) === 139, 'partiel : 3,39 × 6,99 / 16,99 = 1,39 € (inférieur)');
    dit(R.creditSemaine(1699) === 396, 'la semaine offerte vaut 16,99 × 7 / 30 = 3,96 €');
    dit(R.ibanPropre('FR76 3000 6000 0112 3456 7890 189') === 'FR7630006000011234567890189' && R.ibanPropre('FR76 3000 6000 0112 3456 7890 188') === '', 'IBAN : clé mod 97 vérifiée (un chiffre faux ⇒ refusé)');
    dit(R.ibanMasque('FR7630006000011234567890189') === 'FR76 •••• 0189', 'IBAN affiché masqué « FR76 •••• 0189 »');
    const ch = [{ mode: 'virement', le: iso(NOW - 10 * J) }, { mode: 'credit', le: iso(NOW - 2 * J) }];
    const petit = { gains: [{ ...d.creer, due_le: iso(NOW - J) }], choix: [{ mode: 'virement', le: iso(NOW - 60 * J) }], maintenant: NOW };
    const cp = R.chiffresParrain(petit);
    dit(cp.aVerserCentimes === 339 && cp.virementPret === false && R.aVerserAdmin([{ parrain: uid(2), ...petit }], NOW).totalCentimes === 0, 'virement sous 20 € : « prochain virement à 20 € », rien dans le total à verser de Julien');
    dit(R.modeAuJour(ch, NOW - 5 * J) === 'virement' && R.modeAuJour(ch, NOW) === 'credit' && R.modeAuJour([], NOW) === 'credit', 'le mode d’un gain = celui en vigueur à son échéance (crédit par défaut)');
  });

  let A;
  await essaie('Q2 webhook : le premier paiement', async () => {
    A = await couple();
    const essai = await webhook('invoice.paid', facture(A.cf, { montant: 0, motif: 'subscription_create', le: NOW - 27 * J }));
    dit(essai.code === 200 && gains().length === 0 && !(soldes[A.cf] || []).length, "la facture à 0 € de l'essai : ni gain, ni semaine");
    const f1 = facture(A.cf, { id: 'in_a1', le: NOW - 20 * J });
    const w = await webhook('invoice.paid', f1);
    const g = gains((x) => x.facture === 'in_a1')[0];
    dit(w.code === 200 && g && g.montant_centimes === 339 && g.parrain === A.p && g.filleul === A.f, '1er paiement 16,99 € : un gain de 3,39 € au parrain', JSON.stringify(w.corps));
    const sf = (soldes[A.cf] || []), sp = (soldes[A.cp] || []);
    dit(sf.length === 1 && sf[0].amount === -396 && /semaine/.test(sf[0].description), 'le filleul : une semaine offerte (−3,96 € sur son solde)', JSON.stringify(sf));
    dit(sp.some((t) => t.amount === -396 && t.metadata.vrm_parrainage === A.f + ':parrain'), 'le parrain : une semaine offerte aussi', JSON.stringify(sp));
    const avant = JSON.stringify([gains().length, sf.length, sp.length]);
    await webhook('invoice.paid', f1); await webhook('invoice.paid', f1);
    dit(JSON.stringify([gains().length, (soldes[A.cf] || []).length, (soldes[A.cp] || []).length]) === avant, 'le même webhook rejoué deux fois : rien de plus (ni gain, ni crédit)');
    await webhook('invoice.paid', facture(A.cf, { id: 'in_a2', le: NOW - 16 * J, montant: 1999, motif: 'subscription_cycle' }));
    dit(gains((x) => x.facture === 'in_a2')[0].montant_centimes === 399 && (soldes[A.cf] || []).length === 1, '2e facture (Pro 19,99 €) : 3,99 € au parrain, aucune semaine de plus');
  });

  await essaie('Q3 remboursements et litiges', async () => {
    await webhook('invoice.paid', facture(A.cf, { id: 'in_a3', pi: 'pi_a3', le: NOW - 3 * J }));
    await webhook('refund.created', { id: 're_a3', object: 'refund', amount: 1000, charge: 'ch_a3', payment_intent: 'pi_a3', status: 'succeeded' });
    const g3 = gains((x) => x.facture === 'in_a3')[0];
    dit(g3 && !g3.annulee_le && g3.rembourse_centimes === 1000 && R.gainNet(g3) === 139, 'remboursement partiel de 10 € : 3,39 € ⇒ 1,39 € (prorata)', JSON.stringify(g3 && { r: g3.rembourse_centimes, a: g3.annulee_le }));
    await webhook('charge.refunded', { id: 'ch_a3', object: 'charge', amount_refunded: 1699, payment_intent: 'pi_a3' });
    dit(gains((x) => x.facture === 'in_a3')[0].annulee_raison === 'remboursement', 'toute la facture rendue ⇒ annulé (gardé, dit)');
    await webhook('invoice.paid', facture(A.cf, { id: 'in_a4', pi: 'pi_a4', le: NOW - 2 * J }));
    await webhook('charge.dispute.created', { id: 'dp_a4', object: 'dispute', charge: 'ch_a4', payment_intent: 'pi_a4' });
    dit(gains((x) => x.facture === 'in_a4')[0].annulee_raison === 'litige', 'un litige ⇒ annulé');
    await webhook('refund.created', { id: 're_a5', object: 'refund', amount: 1699, charge: 'ch_a5', payment_intent: 'pi_a5', status: 'succeeded' });
    await webhook('invoice.paid', facture(A.cf, { id: 'in_a5', pi: 'pi_a5', le: NOW - 1 * J }));
    dit(gains((x) => x.facture === 'in_a5')[0].annulee_le, 'remboursement reçu AVANT la facture payée : le gain naît annulé');
  });

  await essaie('Q4 soi-même, fermé', async () => {
    const B = await couple({ memeCarte: true });
    await webhook('invoice.paid', facture(B.cf, { id: 'in_b1' }));
    dit(!gains((x) => x.filleul === B.f).length && db.t.parrainages.find((x) => x.filleul === B.f).refus === 'meme-carte' && !(soldes[B.cp] || []).length, 'la même carte que le parrain : refusé, aucun gain, aucune semaine');
    const memeVinted = nouveauCompte(900); db.t.vinted_accounts.push({ owner: memeVinted, vinted_user_id: String(5000 + 1) });
    const r = await appel({ method: 'POST', mode: 'parrainage', headers: session(memeVinted), corps: { action: 'rattacher', code: A.code } });
    dit(r.corps.raison === 'soi-meme', 'un compte Vinted du parrain ⇒ « pas soi-même », pas rattaché', JSON.stringify(r.corps));
    const C = await couple();
    db.t.vrm_reglages.find((x) => x.cle === 'parrainage').valeur = '0';
    await webhook('invoice.paid', facture(C.cf, { id: 'in_c1' }));
    dit(!gains((x) => x.filleul === C.f).length, 'parrainage éteint : aucun gain');
    db.t.vrm_reglages.find((x) => x.cle === 'parrainage').valeur = '1';
  });

  await essaie('Q5 choix « crédit » : le solde Stripe, une fois', async () => {
    const v = await vue(A.p);
    const avant = (soldes[A.cp] || []).length;
    const credits = (soldes[A.cp] || []).filter((t) => /^gain:/.test(t.metadata.vrm_parrainage || ''));
    dit(v.gains && v.gains.installe && v.gains.mode === 'credit', 'le mode par défaut : « payer mon abonnement »');
    dit(credits.length === 2 && credits.map((t) => t.amount).sort((a, b) => a - b).join(',') === '-399,-339', 'les deux gains DUS (3,39 € et 3,99 €) crédités sur le solde du parrain', JSON.stringify(credits.map((t) => t.amount)));
    dit(gains((x) => x.facture === 'in_a1')[0].credite_le && !gains((x) => x.facture === 'in_a5')[0].credite_le, 'noté « crédité » ; un gain annulé ne part jamais');
    await vue(A.p); await webhook('invoice.created', { id: 'in_prochaine', object: 'invoice', customer: A.cp, status: 'draft' });
    dit((soldes[A.cp] || []).length === avant, 'écran rouvert, invoice.created : aucun crédit de plus');
    dit(v.gains.chiffres.crediteCentimes === 738 && v.gains.chiffres.filleulsPayants === 1, 'l’écran : « 7,38 € crédités · 1 filleul payant »', JSON.stringify(v.gains.chiffres).slice(0, 200));
    dit(!JSON.stringify(v).includes(A.f) && !JSON.stringify(v).includes(A.cf), 'jamais l’identité du filleul (ni son compte, ni son client Stripe)');
    // Un filleul pas encore vérifié (aucun compte Vinted : la semaine attend) : rien ne part.
    const D = await couple({ sansVinted: true });
    await webhook('invoice.paid', facture(D.cf, { id: 'in_d1' }));
    const vd = await vue(D.p);
    dit(gains((x) => x.facture === 'in_d1').length === 1 && !(soldes[D.cp] || []).some((t) => /^gain:/.test(t.metadata.vrm_parrainage || '')) && vd.gains.chiffres.historique[0].etat === 'verification', 'filleul pas encore vérifié (pas de compte Vinted) : le gain attend, rien ne part', JSON.stringify(vd.gains && vd.gains.chiffres.historique));
  });

  let E;
  await essaie('Q6 choix « virement » : chez Julien', async () => {
    E = await couple();
    const c = await choisir(E.p, 'virement');
    dit(c.code === 200 && c.corps.mode === 'virement', 'le parrain choisit « virement »');
    db.t.parrainage_choix.forEach((x) => { if (x.parrain === E.p) x.le = iso(NOW - 60 * J); });
    for (let i = 1; i <= 6; i++) await webhook('invoice.paid', facture(E.cf, { id: 'in_e' + i, le: NOW - (40 - i) * J + 3600000 }));
    const v = await vue(E.p);
    dit(!(soldes[E.cp] || []).some((t) => /^gain:/.test(t.metadata.vrm_parrainage || '')), 'virement : rien chez Stripe');
    dit(v.gains.chiffres.aVerserCentimes === 2034 && v.gains.chiffres.virementPret, '6 × 3,39 € = 20,34 € dus, au-dessus du seuil de 20 €', JSON.stringify(v.gains.chiffres).slice(0, 200));
    const pirate = await appel({ mode: 'partenaires', headers: session(E.p), query: { vue: 'parrains' } });
    dit(pirate.code === 403, 'un autre compte que Julien ne voit pas « à verser » (403)');
    const l = (await appel({ mode: 'partenaires', headers: session(JULIEN), query: { vue: 'parrains' } })).corps;
    const ligne = l.parrains && l.parrains.find((x) => x.parrain === E.p);
    dit(l.ok && ligne && ligne.centimes === 2034 && ligne.pret && l.totalCentimes >= 2034, 'Julien voit « 20,34 € à verser »', JSON.stringify(l).slice(0, 200));
    const ib = await appel({ method: 'POST', mode: 'parrainage', headers: session(E.p), corps: { action: 'iban', iban: 'FR76 3000 6000 0112 3456 7890 189', titulaire: 'Camille Martin' } });
    dit(ib.code === 200 && ib.corps.iban === 'FR76 •••• 0189', 'IBAN posé : rendu MASQUÉ au parrain');
    const faux = await appel({ method: 'POST', mode: 'parrainage', headers: session(E.p), corps: { action: 'iban', iban: 'FR76 3000 6000 0112 3456 7890 188', titulaire: 'Camille Martin' } });
    dit(faux.code === 400 && faux.corps.raison === 'iban', 'un IBAN faux (clé) : refusé');
    const ve = await vue(E.p);
    dit(!JSON.stringify(ve).includes('30006000011234567890') && ve.gains.iban === 'FR76 •••• 0189', 'le parrain ne relit jamais son IBAN en clair');
    const l2 = (await appel({ mode: 'partenaires', headers: session(JULIEN), query: { vue: 'parrains' } })).corps.parrains.find((x) => x.parrain === E.p);
    dit(l2.iban === 'FR7630006000011234567890189' && l2.titulaire === 'Camille Martin', 'Julien, lui, le lit (pour verser)');
    const v1 = await appel({ method: 'POST', mode: 'partenaires', headers: session(JULIEN), corps: { action: 'verse-parrain', parrain: E.p, centimes: 2034, le: iso(NOW).slice(0, 10) } });
    const l3 = (await appel({ mode: 'partenaires', headers: session(JULIEN), query: { vue: 'parrains' } })).corps.parrains.find((x) => x.parrain === E.p);
    dit(v1.code === 200 && !l3, '« Versé » noté ⇒ plus rien à verser');
    const ve2 = await vue(E.p);
    dit(ve2.gains.chiffres.verseCentimes === 2034 && ve2.gains.chiffres.historique.filter((x) => x.etat === 'verse').length === 6, 'le parrain voit « versé » sur chaque gain');
    // Il repasse en « crédit » : seuls les gains dus APRÈS ce choix vont sur son solde.
    await choisir(E.p, 'credit');
    db.t.parrainage_choix.forEach((x) => { if (x.parrain === E.p && x.mode === 'credit') x.le = iso(NOW - 15 * J); });
    await webhook('invoice.paid', facture(E.cf, { id: 'in_e7', le: NOW - 20 * J }));
    await vue(E.p);
    const ce = (soldes[E.cp] || []).filter((t) => /^gain:/.test(t.metadata.vrm_parrainage || ''));
    dit(ce.length === 1 && ce[0].metadata.vrm_parrainage === 'gain:in_e7', 'retour au crédit : seul le gain dû après le changement part sur le solde (aucun versé ne repart)', JSON.stringify(ce.map((t) => t.metadata.vrm_parrainage)));
  });

  await essaie('Q10 tous les filleuls, le potentiel, la vie privée', async () => {
    // Un parrain, cinq filleuls : paie (Solo), paie (Pro), en essai (Pro), inscrit, a arrêté.
    const P = nouveauCompte(800); db.t.vinted_accounts.push({ owner: P, vinted_user_id: '8000' }); abonne(P, 'cus_p800');
    const code = (await vue(P)).code;
    const F = [];
    for (let i = 1; i <= 5; i++) {
      const f = nouveauCompte(800 + i, { email: `filleul${i}.secret@exemple.test` }); db.t.vinted_accounts.push({ owner: f, vinted_user_id: String(8000 + i), login: 'pseudo_vinted_' + i });
      await appel({ method: 'POST', mode: 'parrainage', headers: session(f), corps: { action: 'rattacher', code } });
      db.t.parrainages.find((x) => x.filleul === f).inscrit = iso(NOW - (50 - i) * J);
      F.push(f);
    }
    const sousc = (f, cus, statut, plan, fin) => { abonne(f, cus, statut); Object.assign(db.t.abonnements.find((x) => x.owner === f), { plan, fin_periode: fin || null }); cartes[cus] = ['fp_' + cus]; };
    sousc(F[0], 'cus_q1', 'active', 'solo'); sousc(F[1], 'cus_q2', 'active', 'pro'); sousc(F[2], 'cus_q3', 'trialing', 'pro', iso(NOW + 4 * J));
    sousc(F[4], 'cus_q5', 'canceled', 'solo', iso(NOW - 5 * J));
    await webhook('invoice.paid', facture('cus_q1', { id: 'in_q1a', le: NOW - 30 * J })); await webhook('invoice.paid', facture('cus_q1', { id: 'in_q1b', le: NOW - 3 * J }));
    await webhook('invoice.paid', facture('cus_q2', { id: 'in_q2a', montant: 1999, le: NOW - 20 * J }));
    await webhook('invoice.paid', facture('cus_q5', { id: 'in_q5a', le: NOW - 35 * J }));
    const brut = (await appel({ mode: 'parrainage', headers: session(P) })).corps;
    const g = brut.gains, fl = g && g.filleuls;
    dit(fl && fl.map((x) => x.etat).join(',') === 'paie,paie,essai,inscrit,arrete', 'cinq filleuls, dans l’ordre d’inscription : paie · paie · en essai · inscrit · a arrêté', fl && fl.map((x) => x.etat).join(','));
    dit(fl && fl.map((x) => x.rang).join(',') === '1,2,3,4,5', '  numérotés 1 à 5 (stables, ordre d’inscription)');
    dit(fl && fl[0].moisPayes === 2 && fl[0].gagneCentimes === 678 && fl[0].prochainCentimes === 339 && fl[0].paiements.length === 2, '  Filleul 1 (Solo) : 2 mois payés, 6,78 € gagnés, 3,39 € le mois prochain, ses 2 paiements', JSON.stringify(fl && fl[0]).slice(0, 200));
    dit(fl && fl[1].plan === 'pro' && fl[1].prochainCentimes === 399, '  Filleul 2 (Pro) : 3,99 € le mois prochain (20 % du prix Pro, pas du Solo)');
    dit(fl && fl[2].jusquau === iso(NOW + 4 * J).slice(0, 10) && fl[2].pourraitCentimes === 399 && fl[2].prochainCentimes === null, '  Filleul 3 en essai (Pro) jusqu’au …, pourrait rapporter 3,99 €/mois');
    dit(fl && fl[3].pourraitCentimes === 339 && fl[4].pourraitCentimes === null && fl[4].le === iso(NOW - 5 * J).slice(0, 10), '  Filleul 4 inscrit : ~3,39 € possibles ; Filleul 5 a arrêté le … : rien d’estimé');
    dit(g.potentiel.estimation === true && g.potentiel.moisCentimes === 738 && g.potentiel.siTousCentimes === 738 + 399 + 339, '« Potentiel / mois » 7,38 € ; « si tous payaient » 14,76 € — marqués ESTIMATION', JSON.stringify(g.potentiel));
    dit(g.chiffres.totalCentimes === 339 * 2 + 399 + 339 && g.chiffres.totalCentimes !== g.chiffres.totalCentimes + g.potentiel.moisCentimes, '  le gagné (14,16 €) reste le gagné : l’estimation n’y est jamais ajoutée', g.chiffres.totalCentimes);
    const texte = JSON.stringify(brut);
    const fuites = F.filter((f) => texte.includes(f)).length + (texte.match(/secret@|pseudo_vinted_|cus_q/g) || []).length;
    dit(fuites === 0 && fl.every((x) => x.nom === null), 'la RÉPONSE de la route ne porte aucune identité de filleul (ni uuid, ni e-mail, ni pseudo Vinted, ni client Stripe) sans son choix', 'fuites=' + fuites);
    // Une ligne écrite par le navigateur (montrer: false) : rien ne sort.
    db.t.app_data.push({ owner: F[3], id: 'vrm_parrainage_montrer', data: { montrer: false, nom: 'Zoé' } });
    dit(!JSON.stringify((await appel({ mode: 'parrainage', headers: session(P) })).corps).includes('Zoé'), '  « montrer : non » écrit à la main : rien ne sort');
    // Une ligne écrite à la main avec « montrer : oui » et son pseudo Vinted / son e-mail : REVALIDÉE, rien ne sort.
    db.t.app_data.push({ owner: F[4], id: 'vrm_parrainage_montrer', data: { montrer: true, nom: 'pseudo_vinted_5' } });
    const rv = JSON.stringify((await appel({ mode: 'parrainage', headers: session(P) })).corps);
    dit(!rv.includes('pseudo_vinted_5'), '  « montrer : oui » écrit à la main avec son pseudo Vinted : revalidé, rien ne sort');
    // Le filleul 1 choisit de montrer son prénom ; un pseudo Vinted est refusé.
    const refus = await appel({ method: 'POST', mode: 'parrainage', headers: session(F[0]), corps: { action: 'montrer', montrer: true, nom: 'pseudo_vinted_1' } });
    dit(refus.code === 400 && refus.corps.raison === 'pseudo-vinted', 'le filleul ne peut pas montrer son pseudo Vinted (400)', JSON.stringify(refus.corps));
    const okm = await appel({ method: 'POST', mode: 'parrainage', headers: session(F[0]), corps: { action: 'montrer', montrer: true, nom: 'Léa' } });
    const apres = (await appel({ mode: 'parrainage', headers: session(P) })).corps;
    dit(okm.code === 200 && apres.gains.filleuls[0].nom === 'Léa' && apres.gains.filleuls[1].nom === null && !/secret@/.test(JSON.stringify(apres)), 'il active « Montrer mon prénom » : le parrain lit « Léa » (et rien des autres)');
    const vueF = (await appel({ mode: 'parrainage', headers: session(F[0]) })).corps;
    dit(vueF.montrer && vueF.montrer.montrer === true && vueF.montrer.nom === 'Léa', '  le filleul relit son choix');
    await appel({ method: 'POST', mode: 'parrainage', headers: session(F[0]), corps: { action: 'montrer', montrer: false } });
    dit((await appel({ mode: 'parrainage', headers: session(P) })).corps.gains.filleuls[0].nom === null, '  il le retire : « Filleul 1 » de nouveau');
    // Coché à l'inscription par lien : posé avec le rattachement.
    const f6 = nouveauCompte(806); db.t.vinted_accounts.push({ owner: f6, vinted_user_id: '8006' });
    await appel({ method: 'POST', mode: 'parrainage', headers: session(f6), corps: { action: 'rattacher', code, montrer: true, nom: 'Noé' } });
    dit((await appel({ mode: 'parrainage', headers: session(P) })).corps.gains.filleuls.some((x) => x.nom === 'Noé'), 'coché à l’inscription par lien : le parrain lit « Noé »');
    // Julien voit tout, un autre non.
    dit((await appel({ mode: 'partenaires', headers: session(P), query: { vue: 'parrain', id: P } })).code === 403, 'la vue détaillée d’un parrain : 403 pour un autre que Julien');
    const adm = (await appel({ mode: 'partenaires', headers: session(JULIEN), query: { vue: 'parrain', id: P } })).corps;
    dit(adm.ok && adm.vue.filleuls.length === 6 && adm.vue.filleuls[1].nom === 'filleul2.secret@exemple.test' && adm.vue.filleuls[0].paiements.length === 2, 'Julien : la même vue, chaque filleul nommé (son e-mail), ses paiements', JSON.stringify(adm.vue && adm.vue.filleuls.map((x) => x.nom)));
    const tous = (await appel({ mode: 'partenaires', headers: session(JULIEN), query: { vue: 'parrains' } })).corps.tous;
    dit(Array.isArray(tous) && tous.some((x) => x.parrain === P && x.filleuls === 6 && x.payants === 3), 'Julien : la liste de TOUS les parrains (filleuls, payants, gagné)', JSON.stringify(tous && tous.find((x) => x.parrain === P)));
  });

  await essaie('Q8 le coupon −10 % du filleul', async () => {
    const f = nouveauCompte(700); const p = nouveauCompte(701);
    db.t.vinted_accounts.push({ owner: p, vinted_user_id: '7011' });
    const code = (await vue(p)).code;
    await appel({ method: 'POST', mode: 'parrainage', headers: session(f), corps: { action: 'rattacher', code } });
    stripe = [];
    const c1 = await appel({ method: 'POST', mode: 'checkout', headers: session(f), corps: { cgv: true, accesImmediat: true } });
    const s1 = stripe.find((x) => x.chemin === 'checkout/sessions');
    dit(c1.code === 200 && s1 && s1.corps.get('discounts[0][coupon]') === 'VRM_PARRAINAGE_10', 'le paiement du filleul porte le coupon −10 %', c1.code + ' ' + (s1 && s1.corps.toString().slice(0, 120)));
    dit(coupons.VRM_PARRAINAGE_10 && coupons.VRM_PARRAINAGE_10.percent_off === 10 && coupons.VRM_PARRAINAGE_10.duration === 'repeating' && coupons.VRM_PARRAINAGE_10.duration_in_months === 1, 'coupon créé chez Stripe : 10 %, un mois (jamais consommé par la facture à 0 € de l’essai)');
    stripe = [];
    await appel({ method: 'POST', mode: 'checkout', headers: session(f), corps: { cgv: true, accesImmediat: true } });
    dit(!stripe.some((x) => x.chemin === 'coupons' && x.m === 'POST'), 'un 2e paiement ne recrée pas le coupon');
    const seul = nouveauCompte(702); stripe = [];
    await appel({ method: 'POST', mode: 'checkout', headers: session(seul), corps: { cgv: true, accesImmediat: true } });
    dit(!stripe.find((x) => x.chemin === 'checkout/sessions').corps.get('discounts[0][coupon]'), 'un compte sans parrain : aucune remise');
    // Un compte venu par un code partenaire (coupon LEO50) : le coupon partenaire seul, jamais les deux.
    const rc = await appel({ method: 'POST', mode: 'partenaires', headers: session(JULIEN), corps: { action: 'creer', nom: 'Leo', code: 'LEO' } });
    await appel({ method: 'POST', mode: 'partenaires', headers: session(JULIEN), corps: { action: 'coupon', id: rc.corps.id, coupon: 'LEO50' } });
    const pf = nouveauCompte(703);
    await appel({ method: 'POST', mode: 'partenaire', headers: session(pf), corps: { action: 'rattacher', code: 'LEO' } });
    db.t.parrainages.push({ filleul: pf, parrain: p, code, inscrit: iso(NOW) });   // forcé : la base ne devrait jamais l'avoir
    stripe = [];
    await appel({ method: 'POST', mode: 'checkout', headers: session(pf), corps: { cgv: true, accesImmediat: true } });
    const s3 = stripe.find((x) => x.chemin === 'checkout/sessions');
    dit(s3 && s3.corps.get('discounts[0][coupon]') === 'LEO50' && !s3.corps.get('discounts[1][coupon]') && !s3.corps.toString().includes('VRM_PARRAINAGE_10'), 'code partenaire : son coupon seul, jamais cumulé avec −10 %', s3 && s3.corps.toString().slice(0, 160));
  });

  await essaie('Q9 pannes et 049 pas passée', async () => {
    const F = await couple();
    db.panne('parrainage_gains', 'POST', 1);
    const w = await webhook('invoice.paid', facture(F.cf, { id: 'in_f1' }));
    dit(w.code === 503, 'l’écriture du gain tombe : 503 (Stripe rejoue)', w.code);
    await webhook('invoice.paid', facture(F.cf, { id: 'in_f1' }));
    dit(gains((x) => x.facture === 'in_f1').length === 1, 'le rejeu : un seul gain');
    reset({ sans049: true });
    const G = await couple();
    const w2 = await webhook('invoice.paid', facture(G.cf, { id: 'in_g1' }));
    dit(w2.code === 200, 'tables absentes : le webhook acquitte', JSON.stringify(w2.corps));
    const vg = await vue(G.p);
    dit(vg.ok && vg.gains && vg.gains.installe === false, 'l’écran dit « pas installé »', JSON.stringify(vg.gains));
    const l = (await appel({ mode: 'partenaires', headers: session(JULIEN), query: { vue: 'parrains' } })).corps;
    dit(l.ok && l.installe === false, 'la vue de Julien dit « pas installé »');
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
