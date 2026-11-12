// ════════════════════════════════════════════════════════════════════════════
//  LA FIN DE LA REVUE DE ROBUSTESSE (12 nov., second agent) — les points de
//  `docs/passation/robustesse/serveur.md` et `metier.md` qui n'étaient faits
//  nulle part (récit : docs/passation/2026-11-12-revue-fin.md). Chaque contrôle
//  EXÉCUTE la règle (fausse base à la vraie forme : filtres PostgREST, PATCH
//  conditionnel, 409) ; quelques basses sont jugées sur le code sans commentaires.
//   S-M79  le plafond du bilan du mois voyage dans le contexte du vendeur ;
//   S-M54  le frein des sessions d'extension est PARTAGÉ par les instances ;
//   S-M75  un numéro de facture abandonné (le dernier) est repris, jamais deviné ;
//   S-M78  la même action eBay sur la même entité, deux fois ⇒ un seul appel ;
//   S-M92  relances de l'essai : les lignes lues en lot ;
//   S-B113 détourage : panne de connexion = 503, pas 401 ;
//   S-B137 sonde du cloisonnement : une panne n'est pas resondée à chaque requête ;
//   S-B114/B135/B138/B143 : sur le code.
//   A1-A4  l'app : valeur du stock sans « 0 € », facture sans prix refusée, case de carte partielle
//          « au moins », App.jsx recollé lisible d'un bloc.
//  `node scripts/audit-revue-fin.cjs [--prouve]`
//  `--prouve` : ROUGE sur la branche de départ (git archive DEPART) et sur chaque mutation.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const ICI = path.join(__dirname, '..');
const R = process.env.AUDIT_RACINE || ICI;
// La branche de départ du lot (familles-serveur + serveur-migrations + familles-app + main).
const DEPART = process.env.AUDIT_DEPART || '57498db0d';

const MUTATIONS = {
  'M79 compteur de module': [['api/ship-reminders.js', '  const compteur = store && store.compteurBilan;', '  const compteur = { reste: 0 };']],
  'M54 frein en mémoire seulement': [['api/_lib/frein-fork.js', '  if (url && entetes) {', '  if (false) {']],
  'M75 aucune reprise': [['api/_lib/facture-pro.js', '    const n = repris ? der.n : c.n + 1;', '    const n = c.n + 1; repris = false;']],
  'M75 reprise sans relire la pièce': [['api/_lib/facture-pro.js', "      repris = l === null || (l && (l.number == null || l.number === ''));", '      repris = true;']],
  'M78 pas de verrou': [['api/_lib/ebay-agent.js', 'doublon=items.some(enCours);', 'doublon=false;']],
  'M92 lecture par vendeur': [['api/_lib/relances-essai.js', "  const enLot = await lireLignesEnLot(essais.filter((a) => a && a.statut === 'trialing').map((a) => String(a.owner || '').toLowerCase()));", '  const enLot = null;']],
  'B113 panne = 401': [['api/_lib/detourage.js', "  if (u === undefined) { res.status(503).json({ ok: false, reason: 'auth-pas-su' }); return; }   // (12 nov., B113)\n", '']],
  'B137 sonde à chaque requête': [['api/_lib/session.js', '  if (Date.now() < _sondeEnPanneJusqua) return true;\n', '']],
  'A pas su : facture à 0 €': [['src/App.jsx', "  if (v == null || !(v > 0)) throw new Error('prix de vente pas lu — aucune facture');", '  if (v == null) return 0;']],
  'A pas su : stock affiché à 0 €': [['src/App.jsx', '    if (a != null) { affiche += a; marcheAffiche += m; }', '    affiche += (a || 0); marcheAffiche += m;']],
  'A case partielle muette': [['src/design/carteChiffres.js', "x.partiel ? 'au moins' : '';", "'';"]],
  'B143 mentions avalées': [['api/_lib/clients-partis.js', "    if (!mentionsOk) { ign('mentions pas lues : rien envoye'); continue; }\n", '']],
};

if (process.argv.includes('--prouve')) {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-revue-fin-'));
  cp.execSync(`git -C "${ICI}" archive ${DEPART} api src scripts/_source-app.cjs package.json | tar -x -C "${t}"`);
  let nm = ICI; while (!fs.existsSync(path.join(nm, 'node_modules')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
  fs.symlinkSync(fs.realpathSync(path.join(nm, 'node_modules')), path.join(t, 'node_modules'));
  const r = cp.spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 300000 });
  const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
  console.log(`${r.status && rouges ? '✅' : '❌'} sur la branche de départ (${DEPART}) : ${rouges} rouge(s)`);
  for (const l of (r.stdout || '').split('\n').filter((x) => x.startsWith('❌')).slice(0, 30)) console.log('     ' + l.slice(0, 170));
  fs.rmSync(t, { recursive: true, force: true });
  if (!(r.status && rouges)) process.exit(1);
  require('./_mutations-audit.cjs').prouver(__filename, ICI, MUTATIONS);
  return;
}

process.env.SUPABASE_URL = 'https://base-de-banc.invalid';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'cle-anon-de-banc';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const importer = (f, q = '') => import(pathToFileURL(path.join(R, f)).href + q);
const { sansCommentaires } = require('./_mutations-audit.cjs');
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' (planté)', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });

// ── LA FAUSSE BASE (app_data), à la vraie forme ─────────────────────────────
// GET  ?id=eq.X&owner=eq.Y&select=data | alias:data->>champ
// POST [ {owner,id,data} ] (409 si la ligne existe)
// PATCH ?…&data->>champ=eq.v | is.null &select=id + return=representation ⇒ lignes touchées
const base = new Map();
const k = (o, i) => `${o}|${i}`;
let appels = [];
let panne = null;   // (url) => Response | undefined : une panne ciblée
function valeurChamp(d, ch) { const v = d == null ? undefined : d[ch]; return v == null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v); }
function passeFiltres(d, params) {
  for (const [n, v] of params) {
    const m = /^data->>(\w+)$/.exec(n);
    if (!m) continue;
    const x = valeurChamp(d, m[1]);
    if (v === 'is.null') { if (x !== null) return false; }
    else if (v.startsWith('eq.')) { if (x !== decodeURIComponent(v.slice(3))) return false; }
    else throw new Error('filtre inconnu du banc : ' + n + '=' + v);
  }
  return true;
}
global.fetch = async (url, o = {}) => {
  const u = String(url);
  appels.push({ url: u, methode: (o.method || 'GET').toUpperCase() });
  if (panne) { const p = panne(u, o); if (p) return p; }
  const U = new URL(u);
  if (!U.pathname.endsWith('/rest/v1/app_data')) return rep([], 404);
  const params = [...U.searchParams.entries()];
  const q = (n) => (U.searchParams.get(n) || '');
  const eq = (n) => q(n).replace(/^eq\./, '');
  const methode = (o.method || 'GET').toUpperCase();
  if (methode === 'POST') {
    const lignes = JSON.parse(o.body || '[]');
    for (const l of lignes) if (base.has(k(l.owner, l.id))) return rep({ code: '23505' }, 409);
    for (const l of lignes) base.set(k(l.owner, l.id), JSON.parse(JSON.stringify(l.data)));
    return rep('', 201);
  }
  const cle = k(eq('owner'), eq('id'));
  const d = base.get(cle);
  if (methode === 'GET') {
    if (d === undefined) return rep([]);
    const sel = q('select') || 'data';
    if (sel === 'data') return rep([{ data: JSON.parse(JSON.stringify(d)) }]);
    const ligne = {};
    for (const s of sel.split(',')) { const m = /^(\w+):data->>(\w+)$/.exec(s); if (!m) throw new Error('select inconnu du banc : ' + s); ligne[m[1]] = valeurChamp(d, m[2]); }
    return rep([ligne]);
  }
  if (methode === 'PATCH') {
    if (d === undefined || !passeFiltres(d, params)) return rep([]);
    const corps = JSON.parse(o.body || '{}');
    base.set(cle, JSON.parse(JSON.stringify(corps.data)));
    return rep([{ id: eq('id') }]);
  }
  return rep([], 405);
};

const OWNER = '11111111-1111-4111-8111-111111111111';
const AUTRE = '22222222-2222-4222-8222-222222222222';

let fini = false;
process.on('exit', (c) => { if (!fini) { console.log('❌ audit-revue-fin : arrêté avant la fin (une promesse jamais tenue)'); process.exitCode = 1; } });
(async () => {
  // ── S-M79 : le plafond du bilan du mois dans le contexte ──────────────────
  await essaie('M79', async () => {
    Object.assign(process.env, { RELANCES_SMTP_HOTE: 'smtp.exemple.test', RELANCES_SMTP_UTILISATEUR: 'u', RELANCES_SMTP_MOT_DE_PASSE: 'p', RELANCES_EXPEDITEUR: 'vrm@exemple.test' });
    const sr = await importer('api/ship-reminders.js');
    const { contexteVendeur } = await importer('api/_lib/owner.js');
    const f = sr._banc && sr._banc.bilanDuMoisVendeur;
    dit(typeof f === 'function', 'M79 le bilan du mois est exposé au banc (`_banc.bilanDuMoisVendeur`)');
    if (typeof f !== 'function') return;
    base.clear();
    for (const o of [OWNER, AUTRE]) base.set(k(o, 'bilan_mois_choix'), { actif: true });
    const t = Date.parse('2026-11-03T10:00:00Z');
    const [a, b] = await Promise.all([
      contexteVendeur.run({ owner: OWNER, compteurBilan: { reste: 0 } }, () => f(t)),
      contexteVendeur.run({ owner: AUTRE, compteurBilan: { reste: 1 } }, () => f(t)),
    ]);
    dit(a === 'plafond du jour — demain', 'M79 plafond 0 dans CE passage ⇒ « plafond du jour »', a);
    dit(b !== 'plafond du jour — demain' && b != null, 'M79 un autre passage simultané garde SA part (pas volée par une variable de module)', b);
    const c = await contexteVendeur.run({ owner: OWNER }, () => f(t));
    dit(c == null || c === 'plafond du jour — demain', 'M79 sans part dans le contexte : rien n’est envoyé', c);
  });

  // ── S-M54 : le frein des sessions, partagé par deux instances ─────────────
  await essaie('M54', async () => {
    base.clear();
    const i1 = await importer('api/_lib/frein-fork.js', '?instance=1');
    const i2 = await importer('api/_lib/frein-fork.js', '?instance=2');
    const opts = { url: process.env.SUPABASE_URL, entetes: { apikey: 'x' } };
    const t0 = Date.parse('2026-11-12T10:00:00Z');
    const r = [];
    for (let n = 0; n < 6; n++) r.push(await (n % 2 ? i2 : i1).freinFork({ uid: OWNER, ...opts, maintenant: t0 + n * 1000 }));
    const septieme = await i1.freinFork({ uid: OWNER, ...opts, maintenant: t0 + 7000 });
    dit(r.every((x) => x === 0) && septieme > 0, 'M54 6 sessions réparties sur DEUX instances, la 7e est freinée (le plafond n’est plus multiplié)', { r, septieme });
    const autre = await i2.freinFork({ uid: AUTRE, ...opts, maintenant: t0 + 7000 });
    dit(autre === 0, 'M54 le frein est PAR vendeur', autre);
    const apres = await i2.freinFork({ uid: OWNER, ...opts, maintenant: t0 + 3600 * 1000 + 1000 });
    dit(apres === 0, 'M54 une heure plus tard, la place est rendue', apres);
    // Base muette : le frein doux en mémoire, jamais un refus inventé ni une porte sans frein.
    panne = () => rep('<html>522</html>', 522);
    const m = []; for (let n = 0; n < 7; n++) m.push(await i1.freinFork({ uid: AUTRE, ...opts, maintenant: t0 + n }));
    panne = null;
    dit(m.slice(0, 6).every((x) => x === 0) && m[6] > 0, 'M54 base muette ⇒ le frein en mémoire d’avant (6 passent, la 7e freinée)', m);
  });

  // ── S-M75 : un numéro abandonné ───────────────────────────────────────────
  await essaie('M75', async () => {
    const fp = await importer('api/_lib/facture-pro.js');
    const vingtMin = new Date(Date.now() - 20 * 60000).toISOString();
    const cas = async ({ compteur, piece, panneLigne = false }) => {
      base.clear();
      base.set(k(OWNER, 'vrm_invoice_counter'), compteur);
      if (piece) base.set(k(OWNER, 'email_invoice_tx1111'), piece);
      panne = panneLigne ? (u) => (u.includes('email_invoice_tx1111') ? rep('<html>522</html>', 522) : undefined) : null;
      const r = await fp.prendreNumero(OWNER, 'vrm_invoice_counter', 'tx2222', 12, (c) => (/^tx\d+$/.test(c) ? fp.idFacture(c.slice(2)) : null));
      panne = null;
      return { n: r.n, compteur: base.get(k(OWNER, 'vrm_invoice_counter')) };
    };
    const j = (at) => ({ n: 40, journal: [{ n: 39, cle: 'tx0000', at }, { n: 40, cle: 'tx1111', at }] });
    const a = await cas({ compteur: j(vingtMin) });
    dit(a.n === 40 && a.compteur.n === 40, 'M75 le dernier numéro (40), pris il y a 20 min, pièce jamais écrite ⇒ repris par la facture suivante (pas de trou)', a);
    const b = await cas({ compteur: j(vingtMin), piece: { number: 'FA-2026-0040', status: 'brouillon' } });
    dit(b.n === 41, 'M75 la pièce porte son numéro (brouillon) ⇒ numéro neuf, jamais repris', b.n);
    const c = await cas({ compteur: j(new Date().toISOString()) });
    dit(c.n === 41, 'M75 moins de 10 min (l’émission peut encore écrire) ⇒ numéro neuf', c.n);
    const d = await cas({ compteur: j(vingtMin), panneLigne: true });
    dit(d.n === 41, 'M75 ligne de la pièce illisible (pas su) ⇒ numéro neuf, jamais une reprise devinée', d.n);
    const e = await cas({ compteur: { n: 41, journal: [{ n: 40, cle: 'tx1111', at: vingtMin }] } });
    dit(e.n === 42, 'M75 le journal ne finit pas sur le dernier numéro donné ⇒ numéro neuf', e.n);
    const f = await cas({ compteur: { n: 40, journal: [{ n: 40, cle: 'tx1111', at: '2025-12-31T22:00:00Z' }] } });
    dit(f.n === 41, 'M75 numéro d’une autre année ⇒ jamais repris', f.n);
    // Deux reprises simultanées : une seule gagne le 40.
    base.clear(); base.set(k(OWNER, 'vrm_invoice_counter'), j(vingtMin));
    const lig = (c) => (/^tx\d+$/.test(c) ? fp.idFacture(c.slice(2)) : null);
    const [x, y] = await Promise.all([fp.prendreNumero(OWNER, 'vrm_invoice_counter', 'tx5555', 12, lig), fp.prendreNumero(OWNER, 'vrm_invoice_counter', 'tx6666', 12, lig)]);
    dit(x.n !== y.n && [x.n, y.n].sort().join() === '40,41', 'M75 deux factures en même temps : 40 et 41, jamais deux fois 40', [x.n, y.n]);
  });

  // ── S-M78 : verrou d'idempotence des actions eBay ─────────────────────────
  await essaie('M78', async () => {
    const { executerAvecJournal } = await importer('api/_lib/ebay-agent.js');
    let journal = { items: [] }, envois = 0, liberer;
    const modifier = async (fn) => { const n = fn(JSON.parse(JSON.stringify(journal))); if (n !== undefined) journal = n; return true; };
    const tenu = new Promise((r) => { liberer = r; });
    const execute = async () => { envois++; await tenu; return { status: 200, body: { ok: true } }; };
    const b = { orderId: '12-34567-89012', confirme: true };
    const p1 = executerAvecJournal({ action: 'rembourserretour', b, execute, modifier });
    await new Promise((r) => setTimeout(r, 10));
    const p2 = executerAvecJournal({ action: 'rembourserretour', b, execute, modifier });
    await new Promise((r) => setTimeout(r, 10));
    liberer();
    const [r1, r2] = await Promise.all([p1, p2]);
    dit(envois === 1 && r2.status === 409 && r1.status === 200, 'M78 deux clics « rembourser » sur la même commande : UN appel eBay, le second refusé (409)', { envois, s2: r2.status });
    const r3 = await executerAvecJournal({ action: 'rembourserretour', b, execute: async () => { envois++; return { status: 200, body: { ok: true } }; }, modifier });
    dit(r3.status === 200 && envois === 2, 'M78 l’action terminée, la suivante passe', { s: r3.status, envois });
    journal = { items: [{ id: 'x', action: 'expedier', entityId: '99', etat: 'en_cours', at: Date.now() - 11 * 60000 }] };
    const r4 = await executerAvecJournal({ action: 'expedier', b: { orderId: '99' }, execute: async () => ({ status: 200, body: { ok: true } }), modifier });
    dit(r4.status === 200, 'M78 une entrée « en cours » de plus de 10 min (coupure) ne bloque pas pour toujours', r4.status);
  });

  // ── S-M92 : relances de l'essai, lues en lot ──────────────────────────────
  await essaie('M92', async () => {
    const re = await importer('api/_lib/relances-essai.js');
    dit(typeof re.lireLignesEnLot === 'function', 'M92 `lireLignesEnLot` existe');
    if (typeof re.lireLignesEnLot !== 'function') return;
    const owners = Array.from({ length: 150 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    appels = [];
    panne = (u) => {
      const U = new URL(u); const o = U.searchParams.get('owner') || '';
      if (!o.startsWith('in.(')) return undefined;
      const liste = o.slice(4, -1).split(',');
      return rep(liste.filter((x) => x.endsWith('1')).map((x) => ({ owner: x, id: 'relances_essai_choix', data: { desinscrit: true } })));
    };
    const m = await re.lireLignesEnLot(owners);
    panne = null;
    dit(m && appels.length === 2 && m.size === 150, 'M92 150 essais ⇒ 2 lectures (au lieu de 300)', { appels: appels.length, n: m && m.size });
    dit(m && m.get(owners[1]).choix.desinscrit === true && JSON.stringify(m.get(owners[2]).choix) === '{}', 'M92 chaque vendeur reçoit SES lignes (absentes ⇒ {})');
    panne = () => rep('<html>522</html>', 522);
    const n = await re.lireLignesEnLot(owners);
    panne = null;
    dit(n === null, 'M92 lecture ratée ⇒ null (pas su : on relit vendeur par vendeur, jamais « aucun choix »)', n);
    const src = sansCommentaires(lire('api/_lib/relances-essai.js'));
    dit(/const enLot = await lireLignesEnLot\(/.test(src) && /enLot && enLot\.get\(owner\)/.test(src), 'M92 le passage des relances lit en lot');
  });

  // ── S-B113 : détourage, panne de connexion ────────────────────────────────
  await essaie('B113', async () => {
    const dt = await importer('api/_lib/detourage.js');
    panne = (u) => (u.includes('/auth/v1/user') ? rep('<html>503</html>', 503) : undefined);
    const res = { code: 0, corps: null, status(c) { this.code = c; return this; }, json(x) { this.corps = x; return this; }, setHeader() {} };
    await dt.handleDetourage({ method: 'POST', query: {}, headers: { authorization: 'Bearer a.b.c' }, body: {} }, res);
    const res2 = { code: 0, corps: null, status(c) { this.code = c; return this; }, json(x) { this.corps = x; return this; }, setHeader() {} };
    await dt.handleDetourage({ method: 'GET', query: { usage: '1' }, headers: { authorization: 'Bearer a.b.c' } }, res2);
    panne = null;
    dit(res.code === 503 && res2.code === 503, 'B113 service de connexion en panne ⇒ 503 (réessaie), pas « pas de session » (401)', [res.code, res2.code]);
  });

  // ── S-B137 : la sonde du cloisonnement ────────────────────────────────────
  await essaie('B137', async () => {
    const s = await importer('api/_lib/session.js', '?b137=1');
    let sondes = 0;
    panne = (u) => (u.includes('select=owner&limit=1') ? (sondes++, rep('<html>522</html>', 522)) : undefined);
    const a = await s.baseCloisonnee(); const b = await s.baseCloisonnee(); const c = await s.baseCloisonnee();
    panne = null;
    dit(a === true && b === true && c === true && sondes === 1, 'B137 base en panne : 3 requêtes ⇒ UNE sonde (10 s), la réponse reste « cloisonnée »', { sondes });
  });

  // ── Basses jugées sur le code (sans commentaires) ─────────────────────────
  {
    const dt = sansCommentaires(lire('api/_lib/detourage.js'));
    dit(/const cacheOk = await ecrireCache\(/.test(dt) && /cacheOk \? \{\} : \{ cache: false \}/.test(dt), 'B114 un cache de détourage raté est DIT (`cache:false`)');
    const pa = sansCommentaires(lire('api/_lib/parrainage.js'));
    dit(/return await patch\(ligne\.filleul, \{ credit_parrain_le/.test(pa) && /if \(!\(await patch\(owner, \{ credit_filleul_le/.test(pa), 'B135 crédit fait mais pas noté ⇒ « à réessayer » (Stripe rejoue, la marque évite un second crédit)');
    const wi = sansCommentaires(lire('api/widget.js'));
    dit(!/fetchPaginated\([^;]*\)\.catch\(/.test(wi), 'B138 widget : plus de `.catch` mort sur une lecture qui ne lève jamais');
    const cpa = sansCommentaires(lire('api/_lib/clients-partis.js'));
    dit(/mentionsOk = !!\(m && !m\.erreur\)/.test(cpa) && /if \(!mentionsOk\) \{ ign\(/.test(cpa), 'B143 mentions légales illisibles ⇒ aucun e-mail de départ');
  }

  // ── A · L'APP (règles EXÉCUTÉES, extraites d'App.jsx recollé) ──────────
  await essaie('A', async () => {
    const vm = require('vm');
    // Le recollage de l'arbre jugé (la branche de départ a le sien) ; sinon celui d'ici.
    const { sourceApp } = require(fs.existsSync(path.join(R, 'scripts', '_source-app.cjs')) ? path.join(R, 'scripts', '_source-app.cjs') : './_source-app.cjs');
    const APP = sourceApp(R);
    const extraire = (nom) => {
      const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(APP);
      if (!m) return '';
      const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
      for (let i = m.index; i < APP.length; i++) {
        const c = APP[i];
        if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
        else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return APP.slice(m.index, i + 1); }
        else if (!estFn && c === ';' && prof === 0) return APP.slice(m.index, i + 1);
      }
      return '';
    };
    const SC = await importer('src/sommeConnue.js');
    const ctx = { Date, Math, Number, String, Object, Array, JSON, Set, Map, isFinite, isNaN, valeurSue: SC.valeurSue,
      extractModel: () => 'samba', extractSize: () => '42' };
    vm.createContext(ctx);
    for (const n of ['montantCommande', 'montantCommandeLu', 'valoriserStock', 'xmlEsc', 'prixFactureLu', 'factureCII']) {
      const t = extraire(n); if (!t) continue;
      try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (_) {}
    }
    // A1 · la valeur du stock : un prix affiché pas lu n'est pas « 0 € » (comparaison sur les mêmes annonces)
    if (typeof ctx.valoriserStock === 'function') {
      const v = ctx.valoriserStock([{ modele: 'samba', taille: '42', med: 80 }], [{ title: 'a', price: { amount: '90', currency_code: 'EUR' } }, { title: 'b', price: null }]);
      dit(v.reconnu === 2 && v.affiche === 90 && v.marcheAffiche === 80, 'A1 valeur du stock : l’annonce au prix pas lu sort de la comparaison (90 € contre 80 €, pas 90 € contre 160 €)', v);
    } else dit(false, 'A1 valoriserStock se lit dans App.jsx');
    // A2 · une facture sans prix lu : AUCUNE facture (jamais 0,00 €)
    if (typeof ctx.factureCII === 'function') {
      let xml = null, err = null;
      try { xml = ctx.factureCII({ sellPrice: null, saleDate: '2026-11-10', number: 'FA-1' }, { siret: '1' }); } catch (e) { err = e; }
      dit(!!err && xml == null, 'A2 facture électronique sans prix lu : refusée (jamais une facture à 0,00 €)', xml ? String(xml).match(/<ram:GrandTotalAmount>[^<]*/) : err);
      let ok2 = null; try { ok2 = ctx.factureCII({ sellPrice: '12,50', saleDate: '2026-11-10', number: 'FA-2' }, { siret: '1' }); } catch (e) { ok2 = String(e); }
      dit(typeof ok2 === 'string' && /12\.50/.test(ok2), 'A2 « 12,50 » est lu (12.50 dans le XML)', String(ok2).slice(0, 80));
    } else dit(false, 'A2 factureCII se lit dans App.jsx');
    // A3 · une case de carte partielle le dit sous son libellé
    const CC = await importer('src/design/carteChiffres.js').catch(() => null);
    dit(!!CC && CC.raisonCourte({ valeur: 30, partiel: true, manque: ['Leboncoin'] }) === 'au moins' && CC.raisonCourte({ valeur: 30, partiel: false }) === '',
      'A3 case de carte partielle : « au moins » sous le libellé (complète : rien)', CC && CC.raisonCourte({ valeur: 30, partiel: true }));
    // A4 · audit-benefice relit App.jsx recollé (MeilleuresSources n'est plus « déclaré deux fois »)
    let lu = true; try { require(path.join(R, 'node_modules', '@babel', 'parser')).parse(APP, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false }); } catch (e) { lu = String(e.message); }
    dit(lu === true, 'A4 App.jsx recollé se lit d’un bloc (Babel) — aucun nom déclaré deux fois', lu);
  });

  fini = true;
  console.log(`\n${ko ? '❌' : '✅'} audit-revue-fin : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
