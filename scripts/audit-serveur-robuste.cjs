// ════════════════════════════════════════════════════════════════════════════
//  SERVEUR ROBUSTE (16 nov., lot serveur-robuste) — les points restants de la
//  revue de robustesse du serveur (docs/passation/robustesse/serveur.md, branche
//  claude/agent2-robustesse) et de la revue de sécurité du 11 nov. Récit :
//  docs/passation/2026-11-16-serveur-robuste.md. Chaque contrôle EXÉCUTE la
//  vraie route ou la vraie règle (fausse base à la forme PostgREST, faux Stripe
//  À ÉTAT, faux Vinted) :
//    H19      jamais deux abonnements prélevés (deux onglets, paiement qui vient
//             d'aboutir, abonnement vivant chez Stripe, Stripe muet) ;
//    H21/H22  un seul renouvellement Vinted par compte ; jamais par-dessus une
//             paire posée entre-temps ; l'écriture réessayée ;
//    M73      l'envoi léger d'un compte Vinted jamais vu chez ce vendeur : refusé ;
//    DÉBIT    les liens publics à jeton (agenda, catalogue, comptable, widget,
//             SMS) : un débit par adresse et par jeton, AVANT toute lecture ;
//    MDP      la page « nouveau mot de passe » : sa règle (lien pas demandé ici) ;
//    B141     le jeton SMS encodé dans le filtre (jugé sur le code : la forme du
//             jeton est déjà vérifiée, aucune entrée ne peut le montrer) ;
//  et, par processus fils sur le MÊME arbre : H20/H30 (audit-clients-partis),
//  H9/H29 (audit-robustesse-serveur), H24 (audit-ebay-route).
//  `node scripts/audit-serveur-robuste.cjs [--prouve]`
//  `--prouve` : ROUGE sur origin/main (git archive) et sur chaque mutation.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const ICI = path.join(__dirname, '..');
const R = process.env.AUDIT_RACINE || ICI;
const DEPART = process.env.AUDIT_DEPART || 'origin/main';

const MUTATIONS = {
  'H19 aucune relecture de Stripe': [['api/compte.js', "    if (!v.ok) { const m = MESSAGES_VERROU[v.raison]", "    if (false) { const m = MESSAGES_VERROU[v.raison]"]],
  'H19 session ouverte gardée': [['api/_lib/checkout-unique.js', "    if (cs.status === 'open') {", "    if (false) {"]],
  'H19 pas su = passe': [['api/_lib/checkout-unique.js', "    if (!s || !s.ok || !s.data || !Array.isArray(s.data.data)) return { ok: false, raison: 'pas-su' };", "    if (!s || !s.ok || !s.data || !Array.isArray(s.data.data)) return { ok: true, expirees: 0 };"]],
  'H21 sans bail': [['api/_lib/renouvellement-vinted.js', '  const pris = bail ? await bail.prendre(jeton).catch(() => null) : null;', '  const pris = null;']],
  'H21 base pas relue': [['api/_lib/renouvellement-vinted.js', "    if (change(relu, ancien)) return { jetons: relu, source: 'autre', persiste: true };", '']],
  'H22 écriture sans condition': [['api/vinted-refresh.js', "  const cond = consomme ? `&refresh_token=eq.${encodeURIComponent(consomme)}` : '';", "  const cond = '';"]],
  'H22 un seul essai': [['api/_lib/renouvellement-vinted.js', 'for (let e = 0; e < 3 && n == null; e++)', 'for (let e = 0; e < 1 && n == null; e++)']],
  'M73 compte jamais vu accepté': [['api/_lib/commandes-leger.js', "    if (c === false) return res.status(409).json({ ok: false, erreur: 'compte-inconnu' });", '']],
  'DÉBIT agenda libre': [['api/compte.js', "  if (fichier != null) { const d = prendreDebitPublic('agenda', req, fichier); if (!d.ok) return refuserTropVite(res, d); }", '']],
  'DÉBIT par jeton retiré': [['api/_lib/debit-vendeur.js', '  if (jeton) essais.push([`pub_jeton_${route}`, empreinteJeton(jeton)]);', '']],
  'DÉBIT widget libre': [['api/widget.js', "  { const d = prendreDebitPublic(String((req.query && req.query.mode) || '') === 'sms' ? 'sms' : 'widget'", "  if (false) { const d = prendreDebitPublic(String((req.query && req.query.mode) || '') === 'sms' ? 'sms' : 'widget'"]],
  'MDP lien d’ailleurs accepté': [['public/recuperation.js', " if(ici===lien||demandeIci)return 'oui';", " return 'oui';"]],
  'B141 jeton brut': [['api/_lib/sms-mondialrelay.js', 'data->>vrm_sms_token=eq.${encodeURIComponent(k)}&', 'data->>vrm_sms_token=eq.${k}&']],
  'H20 un seul abonnement relu': [['api/_lib/clients-partis.js', "    if (tous.data.data.some((s) => s && s.id !== a.abonnement_stripe && finDeStripe(s, maintenant) == null)) { ign('autre abonnement vivant'); continue; }", '']],
  'H30 un seul constat': [['api/_lib/clients-partis.js', "      if (maintenant - c < ECART_CONSTAT_H * 3600e3) { ign('second constat trop tot'); continue; }", '']],
  'H30 un échec n’arrête rien': [['api/_lib/clients-partis.js', 'incomplets++; maxSuppressions = 0; continue;', 'incomplets++; continue;']],
  'H24 GetItem en série': [['api/ebay.js', 'const SYNC_PARALLELE = 4,', 'const SYNC_PARALLELE = 1,']],
};

if (process.argv.includes('--prouve')) {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-serveur-robuste-'));
  cp.execSync(`git -C "${ICI}" archive ${DEPART} api src public package.json vercel.json | tar -x -C "${t}"`);
  let nm = ICI; while (!fs.existsSync(path.join(nm, 'node_modules')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
  fs.symlinkSync(fs.realpathSync(path.join(nm, 'node_modules')), path.join(t, 'node_modules'));
  const r = cp.spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 900000 });
  const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
  console.log(`${r.status && rouges ? '✅' : '❌'} sur ${DEPART} : ${rouges} rouge(s)`);
  for (const l of (r.stdout || '').split('\n').filter((x) => x.startsWith('❌')).slice(0, 40)) console.log('     ' + l.slice(0, 170));
  fs.rmSync(t, { recursive: true, force: true });
  if (!(r.status && rouges)) process.exit(1);
  // `MUTATIONS_FILTRE=<regex>` : rejouer seulement certaines mutations.
  const filtre = process.env.MUTATIONS_FILTRE ? new RegExp(process.env.MUTATIONS_FILTRE) : null;
  require('./_mutations-audit.cjs').prouver(__filename, ICI, filtre ? Object.fromEntries(Object.entries(MUTATIONS).filter(([k]) => filtre.test(k))) : MUTATIONS, ['public', 'vercel.json']);
  return;
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || d === undefined ? '' : ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 260))); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' (planté)', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };
const importer = (f) => import(pathToFileURL(path.join(R, f)).href);
const rep = (corps, status = 200) => new Response(corps === null || status === 204 ? null : (typeof corps === 'string' ? corps : JSON.stringify(corps)), { status, headers: { 'content-type': 'application/json' } });
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
const { sansCommentaires } = require('./_mutations-audit.cjs');

// ── Une fausse base PostgREST générique (app_data, vinted_accounts) ─────────────
// GET : col=eq.|like.|not.like.|in.() · data->>x=eq.|is.null · select= (alias:data->>x,
// alias:data->x, data, colonnes) · limit. POST : 409 sur clé existante (sauf
// merge-duplicates). PATCH : filtres + return=representation ⇒ lignes touchées.
function fausseBase() {
  const T = { app_data: [], vinted_accounts: [] };
  const cles = { app_data: ['owner', 'id'], vinted_accounts: ['owner', 'vinted_user_id'] };
  const journal = [];
  let panne = null;
  const likeRe = (p) => new RegExp('^' + p.replace(/\\_/g, '\u0001').replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*').replace(/_/g, '.').replace(/\u0001/g, '_') + '$');
  const valeur = (l, ch) => { const m = /^data(->>|->)(\w+)$/.exec(ch); if (m) { const v = l.data ? l.data[m[2]] : undefined; return v === undefined ? null : (m[1] === '->>' && v !== null && typeof v === 'object' ? JSON.stringify(v) : v); } return l[ch] === undefined ? null : l[ch]; };
  const passe = (l, k, v) => {
    const x = valeur(l, k);
    if (v === 'is.null') return x == null;
    if (v.startsWith('eq.')) return x != null && String(x) === v.slice(3);
    if (v.startsWith('like.')) return x != null && likeRe(v.slice(5)).test(String(x));
    if (v.startsWith('not.like.')) return !(x != null && likeRe(v.slice(9)).test(String(x)));
    if (v.startsWith('in.(')) return v.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(x));
    throw new Error('filtre inconnu du banc : ' + k + '=' + v);
  };
  const traiter = async (u, o) => {
    const U = new URL(u); const table = U.pathname.split('/').pop(); const m = (o.method || 'GET').toUpperCase();
    journal.push({ table, m, u: decodeURIComponent(U.search), corps: o.body || '' });
    if (panne) { const p = panne(table, m, decodeURIComponent(U.search), o); if (p) return p; }
    if (!T[table]) return rep({ message: 'table inconnue du banc ' + table }, 404);
    const params = [...U.searchParams.entries()];
    const filtres = params.filter(([k]) => !['select', 'order', 'limit', 'on_conflict', 'offset'].includes(k));
    const lignes = () => T[table].filter((l) => filtres.every(([k, v]) => passe(l, k, v)));
    if (m === 'POST') {
      const arr = [].concat(JSON.parse(o.body || '[]'));
      const fusion = /merge-duplicates/.test(String((o.headers && o.headers.Prefer) || ''));
      for (const x of arr) {
        const i = T[table].findIndex((l) => cles[table].every((c) => String(l[c]) === String(x[c])));
        if (i >= 0 && !fusion) return rep({ code: '23505' }, 409);
        const neuf = JSON.parse(JSON.stringify(x));
        if (i >= 0) T[table][i] = { ...T[table][i], ...neuf }; else T[table].push(neuf);
      }
      return rep('', 201);
    }
    if (m === 'PATCH') {
      const corps = JSON.parse(o.body || '{}'); const touche = lignes();
      for (const l of touche) Object.assign(l, JSON.parse(JSON.stringify(corps)));
      return /return=representation/.test(String((o.headers && o.headers.Prefer) || '')) ? rep(touche.map((l) => ({ id: l.id, vinted_user_id: l.vinted_user_id }))) : rep('', 204);
    }
    let out = lignes();
    const lim = Number(U.searchParams.get('limit')); if (lim > 0) out = out.slice(0, lim);
    const sel = U.searchParams.get('select') || '*';
    if (sel === '*') return rep(JSON.parse(JSON.stringify(out)));
    return rep(out.map((l) => { const r = {}; for (const it of sel.split(',')) { const i = it.indexOf(':'); const [al, ch] = i > 0 ? [it.slice(0, i), it.slice(i + 1)] : [it.replace(/^.*(->>|->)/, ''), it]; r[al] = valeur(l, ch); } return r; }));
  };
  return { T, journal, traiter, set panne(f) { panne = f; } };
}

const A = '11111111-1111-4111-8111-111111111111';
const JWT = (o) => 'e30.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.sig';
const SESSION_A = JWT({ sub: A });
const faireRes = () => { const r = { code: 200, corps: null, entetes: {} }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = (k, v) => { r.entetes[String(k).toLowerCase()] = v; }; r.end = (b) => { if (b !== undefined) r.corps = b; return r; }; r.send = (b) => { r.corps = b; return r; }; Object.defineProperty(r, 'statusCode', { get() { return r.code; }, set(v) { r.code = v; } }); return r; };

(async () => {
  // ══ H19 : jamais deux abonnements prélevés ════════════════════════════════
  console.log('── H19 · jamais deux abonnements prélevés (le vrai api/compte.js, faux Stripe à état)');
  await essaie('H19', async () => {
    const { creerMonde, appeler, livrer, brancherEnv, remplirMentions } = require('./_monde-paiement.cjs');
    const M = creerMonde(); brancherEnv(M);
    const fetchAvant = global.fetch;
    global.fetch = (u, o) => M.fetch(u, o);
    let compte;
    try { compte = (await importer('api/compte.js')).default; } catch (e) { dit(false, 'H19 api/compte.js se charge', e.message); global.fetch = fetchAvant; return; }
    const restaurer = await remplirMentions(R);
    try {
      const V = M.ajouterUtilisateur(1, 'vendeuse@exemple.test');
      const co = () => appeler(compte, { method: 'POST', mode: 'checkout', headers: { authorization: 'Bearer ' + V.jeton }, corps: { cgv: true, accesImmediat: true } });
      const sid = (r) => String((r.corps && r.corps.url) || '').split('/').pop();
      const r1 = await co(); const r2 = await co();
      dit(r1.code === 200 && r2.code === 200, 'H19 deux onglets : chacun reçoit une page de paiement', `${r1.code}/${r2.code}`);
      let paye1 = null; try { M.payer(sid(r1)); paye1 = true; } catch (_) { paye1 = false; }
      dit(paye1 === false && M.stripe.sessions[sid(r1)].status === 'expired', 'H19 … la session du 1er onglet est EXPIRÉE : elle ne peut plus être payée', `payée=${paye1} · ${M.stripe.sessions[sid(r1)] && M.stripe.sessions[sid(r1)].status}`);
      const p2 = M.payer(sid(r2));
      dit(!!p2.sub, 'H19 … le 2e onglet paie normalement');
      // Le webhook n'est pas encore arrivé : notre ligne ne dit rien, Stripe a encaissé.
      const n0 = Object.keys(M.stripe.sessions).length;
      const r3 = await co();
      dit(r3.code === 409 && Object.keys(M.stripe.sessions).length === n0, 'H19 un paiement qui vient d’aboutir (webhook pas encore reçu) ⇒ 409, aucune nouvelle session', `HTTP ${r3.code} ${r3.corps && r3.corps.erreur}`);
      await livrer(compte, M, p2.evenements);
      // La ligne retombe « terminé » par erreur (webhook perdu), Stripe dit vivant.
      M.base.abonnements[V.id] = { ...M.base.abonnements[V.id], statut: 'canceled' };
      const n1 = Object.keys(M.stripe.sessions).length;
      const r4 = await co();
      dit(r4.code === 409 && Object.keys(M.stripe.sessions).length === n1, 'H19 notre ligne dit « terminé », Stripe dit « actif » ⇒ 409, rien d’ouvert', `HTTP ${r4.code} ${r4.corps && r4.corps.erreur}`);
      // Stripe muet sur la liste : rien n'ouvre.
      const W = M.ajouterUtilisateur(2, 'autre@exemple.test');
      const fetchMonde = global.fetch;
      global.fetch = (u, o) => (/api\.stripe\.com\/v1\/checkout\/sessions\?/.test(String(u)) && String((o && o.method) || 'GET').toUpperCase() === 'GET' ? Promise.resolve(rep({ error: { message: 'panne' } }, 500)) : M.fetch(u, o));
      const n2 = Object.keys(M.stripe.sessions).length;
      const r5 = await appeler(compte, { method: 'POST', mode: 'checkout', headers: { authorization: 'Bearer ' + W.jeton }, corps: { cgv: true, accesImmediat: true } });
      global.fetch = fetchMonde;
      dit(r5.code === 503 && Object.keys(M.stripe.sessions).length === n2, 'H19 Stripe ne dit pas les paiements en cours ⇒ 503, aucune session (jamais un double prélèvement)', `HTTP ${r5.code}`);
      // Client connu, la liste de SES abonnements ne se lit pas : rien n'ouvre non plus.
      M.base.abonnements[W.id] = { owner: W.id, statut: 'canceled', client_stripe: 'cus_W' };
      global.fetch = (u, o) => (/api\.stripe\.com\/v1\/subscriptions\?/.test(String(u)) ? Promise.resolve(rep({ error: { message: 'panne' } }, 500)) : M.fetch(u, o));
      const n3 = Object.keys(M.stripe.sessions).length;
      const r6 = await appeler(compte, { method: 'POST', mode: 'checkout', headers: { authorization: 'Bearer ' + W.jeton }, corps: { cgv: true, accesImmediat: true } });
      global.fetch = fetchMonde;
      dit(r6.code === 503 && Object.keys(M.stripe.sessions).length === n3, 'H19 client connu, ses abonnements chez Stripe ne se lisent pas ⇒ 503, rien d’ouvert', `HTTP ${r6.code}`);
    } finally { restaurer(); global.fetch = fetchAvant; }
  });

  // ══ H21/H22 : le renouvellement Vinted ════════════════════════════════════
  console.log('\n── H21/H22 · un seul renouvellement Vinted par compte, jamais par-dessus une paire neuve');
  process.env.SUPABASE_URL = 'https://projet-banc.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-banc';
  const expire = JWT({ exp: Math.floor(Date.now() / 1000) - 60, n: 'vieux' });
  const neuf = (n) => JWT({ exp: Math.floor(Date.now() / 1000) + 7200, n });
  const monter = (B, { vinted }) => async (url, o = {}) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) { const h = o.headers || {}; return (h.Authorization || h.authorization) === `Bearer ${SESSION_A}` ? rep({ id: A, email: 'a@exemple.test', email_confirmed_at: '2026-01-01' }) : rep({}, 401); }
    if (u.includes('/rest/v1/rpc/vrm_acces_pour')) return rep(true);
    if (u.includes('.supabase.co/rest/v1/app_data?select=owner&limit=1')) return rep([{ owner: A }]);
    if (u.includes('.supabase.co/rest/v1/')) return B.traiter(u, o);
    if (/vinted\.(fr|it)/.test(u)) return vinted(u, o);
    return rep({}, 404);
  };
  let refresh = null, proxy = null;
  try { refresh = (await importer('api/vinted-refresh.js')).default; } catch (e) { dit(false, 'H22 api/vinted-refresh.js se charge', e.message); }
  try { proxy = (await importer('api/vinted-proxy.js')).default; } catch (e) { dit(false, 'H21 api/vinted-proxy.js se charge', e.message); }
  const appelRefresh = async () => { const r = faireRes(); await refresh({ method: 'GET', query: {}, headers: { authorization: `Bearer ${SESSION_A}` } }, r); return r; };
  const actions = (r) => ((r.corps && r.corps.summary) || []).map((x) => x.action);
  if (refresh) {
    await essaie('H22 deux simultanés', async () => {
      const B = fausseBase(); B.T.vinted_accounts.push({ owner: A, vinted_user_id: '501', domain: 'www.vinted.fr', access_token: expire, refresh_token: 'rt-0' });
      let appelsRefresh = 0;
      global.fetch = monter(B, { vinted: async (u) => { if (/auth\/refresh/.test(u)) { appelsRefresh++; await attendre(300); return rep({ access_token: neuf('a' + appelsRefresh), refresh_token: 'rt-' + appelsRefresh }); } return rep({}); } });
      const [x, y] = await Promise.all([appelRefresh(), appelRefresh()]);
      const ligne = B.T.vinted_accounts[0];
      dit(appelsRefresh === 1, 'H21 deux renouvellements simultanés du MÊME compte ⇒ Vinted n’est appelé qu’UNE fois (l’autre attend la paire neuve)', `${appelsRefresh} appel(s) · ${actions(x)} / ${actions(y)}`);
      dit(ligne.refresh_token === 'rt-1' && x.code === 200 && y.code === 200, 'H21 … la paire rangée est la seule émise, les deux réponses disent « fait »', `${ligne.refresh_token} · ${x.code}/${y.code} · ${actions(x)} / ${actions(y)}`);
    });
    await essaie('H22 paire posée entre-temps', async () => {
      const B = fausseBase(); B.T.vinted_accounts.push({ owner: A, vinted_user_id: '502', domain: 'www.vinted.fr', access_token: expire, refresh_token: 'rt-0' });
      global.fetch = monter(B, { vinted: async (u) => {
        if (/auth\/refresh/.test(u)) { Object.assign(B.T.vinted_accounts[0], { access_token: neuf('ext'), refresh_token: 'rt-extension' }); return rep({ access_token: neuf('srv'), refresh_token: 'rt-serveur' }); }
        return rep({});
      } });
      const r = await appelRefresh();
      dit(B.T.vinted_accounts[0].refresh_token === 'rt-extension', 'H22 l’extension reconnecte le compte PENDANT le renouvellement ⇒ sa paire n’est jamais écrasée (écriture conditionnelle)', `${B.T.vinted_accounts[0].refresh_token} · ${actions(r)}`);
    });
    await essaie('H21 base relue avant de renouveler', async () => {
      const B = fausseBase(); B.T.vinted_accounts.push({ owner: A, vinted_user_id: '505', domain: 'www.vinted.fr', access_token: expire, refresh_token: 'rt-0' });
      // Un autre relais vient de finir entre la lecture de la route et le bail : la base porte déjà une paire neuve.
      let fait = false;
      B.panne = (t, m, q) => { if (!fait && t === 'vinted_accounts' && m === 'GET' && /select=access_token,refresh_token/.test(q)) { fait = true; Object.assign(B.T.vinted_accounts[0], { access_token: neuf('autre'), refresh_token: 'rt-autre' }); } return null; };
      let appelsRefresh = 0;
      global.fetch = monter(B, { vinted: async (u) => { if (/auth\/refresh/.test(u)) { appelsRefresh++; return rep({ access_token: neuf('x'), refresh_token: 'rt-x' }); } return rep({}); } });
      const r = await appelRefresh();
      dit(appelsRefresh === 0 && B.T.vinted_accounts[0].refresh_token === 'rt-autre', 'H21 une paire déjà renouvelée par un autre (vue à la relecture) ⇒ reprise telle quelle, Vinted pas rappelé', `${appelsRefresh} appel(s) · ${B.T.vinted_accounts[0].refresh_token} · ${actions(r)}`);
    });
    await essaie('H22 écriture réessayée', async () => {
      const B = fausseBase(); B.T.vinted_accounts.push({ owner: A, vinted_user_id: '503', domain: 'www.vinted.fr', access_token: expire, refresh_token: 'rt-0' });
      let pannes = 2;
      B.panne = (t, m) => (t === 'vinted_accounts' && m === 'PATCH' && pannes-- > 0 ? rep('<html>522</html>', 522) : null);
      global.fetch = monter(B, { vinted: async (u) => (/auth\/refresh/.test(u) ? rep({ access_token: neuf('b'), refresh_token: 'rt-b' }) : rep({})) });
      const r = await appelRefresh();
      dit(r.code === 200 && actions(r)[0] === 'refreshed' && B.T.vinted_accounts[0].refresh_token === 'rt-b', 'H22 l’écriture de la paire neuve rate deux fois ⇒ réessayée, rangée (Vinted a consommé l’ancienne)', `HTTP ${r.code} · ${actions(r)} · ${B.T.vinted_accounts[0].refresh_token}`);
    });
  }
  if (proxy) {
    await essaie('H21 relais', async () => {
      const B = fausseBase(); B.T.vinted_accounts.push({ owner: A, vinted_user_id: '504', domain: 'www.vinted.fr', access_token: expire, refresh_token: 'rt-0', anon_id: 'an', csrf_token: 'cs' });
      let appelsRefresh = 0;
      global.fetch = monter(B, { vinted: async (u, o) => {
        if (/auth\/refresh/.test(u)) { appelsRefresh++; await attendre(300); return rep({ access_token: neuf('p' + appelsRefresh), refresh_token: 'rt-p' + appelsRefresh }); }
        const cookie = String((o.headers && (o.headers.Cookie || o.headers.cookie)) || '');
        return cookie.includes(expire) ? rep({ code: 100 }, 401) : rep({ items: [] });
      } });
      const appel = async () => { const r = faireRes(); await proxy({ method: 'POST', query: {}, body: { endpoint: '/api/v2/users/current', uid: '504' }, headers: { authorization: `Bearer ${SESSION_A}` } }, r); return r; };
      const [x, y] = await Promise.all([appel(), appel()]);
      dit(appelsRefresh === 1 && x.corps && y.corps && x.corps.status === 200 && y.corps.status === 200, 'H21 deux relais simultanés sur un jeton expiré ⇒ UN renouvellement, les deux lectures aboutissent', `${appelsRefresh} renouvellement(s) · ${x.code}:${x.corps && x.corps.status} / ${y.code}:${y.corps && y.corps.status} ${JSON.stringify(x.corps).slice(0, 120)}`);
      dit(!JSON.stringify([x.corps, y.corps]).includes('rt-p'), 'H21 … et aucun jeton ne sort vers la page');
    });
  }

  // ══ M73 : l'envoi léger d'un compte jamais vu chez ce vendeur ═════════════
  console.log('\n── M73 · un compte Vinted jamais vu chez ce vendeur ne range rien');
  await essaie('M73', async () => {
    const CL = await importer('api/_lib/commandes-leger.js');
    const B = fausseBase();
    global.fetch = monter(B, { vinted: async () => rep({}) });
    const { empreinteCommande } = await importer('src/commandesFusion.js');
    const cmd = { transaction_id: 9001, title: 'Paire', status: 'Commande finalisée' };
    const envoi = (uid) => ({ type: 'orders_sold', uid, fenetre: `9001:${empreinteCommande(cmd)}`, commandes: [cmd], ae: [], pagination: { current_page: 1, per_page: 20 }, luA: Date.now() });
    const route = async (e) => { const r = faireRes(); await CL.routeCommandes({ method: 'POST', headers: { authorization: `Bearer ${SESSION_A}` }, body: e }, r); return r; };
    const r1 = await route(envoi('777'));
    dit(r1.code === 409 && r1.corps && r1.corps.erreur === 'compte-inconnu' && !B.T.app_data.some((l) => /harvest_777_/.test(l.id)), 'M73 uid ni relié ni capté chez lui ⇒ 409 « compte-inconnu », rien écrit', `HTTP ${r1.code} ${JSON.stringify(r1.corps)}`);
    B.T.app_data.push({ owner: A, id: 'harvest_778_profile', data: { capturedAt: 1 } });
    const r2 = await route(envoi('778'));
    dit(r2.code === 200 && B.T.app_data.some((l) => l.id === 'harvest_778_orders_sold'), 'M73 un compte déjà capté chez lui (pas encore dans vinted_accounts — 12 lignes sur 47 en vrai) ⇒ rangé comme avant', `HTTP ${r2.code} ${JSON.stringify(r2.corps)}`);
    B.T.app_data.push({ owner: A, id: 'harvest_7790_profile', data: {} });
    const r3 = await route(envoi('779'));
    dit(r3.code === 409, 'M73 « harvest_7790_… » ne vaut pas « harvest_779_… » (le _ du motif est échappé)', `HTTP ${r3.code}`);
    B.T.vinted_accounts.push({ owner: A, vinted_user_id: '780' });
    const r4 = await route(envoi('780'));
    dit(r4.code === 200, 'M73 un compte relié (vinted_accounts) ⇒ rangé', `HTTP ${r4.code}`);
    B.panne = (t, m) => (t === 'vinted_accounts' ? rep('<html>522</html>', 522) : null);
    const r5 = await route(envoi('781'));
    dit(r5.code === 503 && !B.T.app_data.some((l) => /harvest_781_/.test(l.id)), 'M73 lecture ratée ⇒ 503, rien écrit (jamais « pas su » = « à lui »)', `HTTP ${r5.code}`);
  });

  // ══ DÉBIT : les liens publics à jeton ══════════════════════════════════════
  console.log('\n── DÉBIT · les liens publics à jeton : un débit par adresse et par jeton, avant toute lecture');
  await essaie('DÉBIT', async () => {
    const B = fausseBase();
    global.fetch = monter(B, { vinted: async () => rep({}) });
    const compte = (await importer('api/compte.js')).default;
    const widget = (await importer('api/widget.js')).default;
    const agenda = async (ip, f) => { const r = faireRes(); await compte({ method: 'GET', query: { mode: 'agenda', f }, headers: { 'x-forwarded-for': ip } }, r); return r; };
    let codes = [];
    for (let i = 0; i < 35; i++) codes.push((await agenda('203.0.113.7', 'j' + i.toString(36).padStart(40, 'x'))).code);
    const n0 = B.journal.length;
    const r = await agenda('203.0.113.7', 'y'.repeat(43));
    dit(codes.slice(0, 30).every((c) => c !== 429) && codes.slice(30).every((c) => c === 429), 'DÉBIT agenda : 30 jetons inventés par minute depuis une adresse, puis 429', codes.join(','));
    dit(r.code === 429 && B.journal.length === n0 && r.entetes['retry-after'], 'DÉBIT … refusé AVANT toute lecture de la base, avec Retry-After', `HTTP ${r.code} · ${B.journal.length - n0} lecture(s)`);
    codes = [];
    for (let i = 0; i < 22; i++) codes.push((await agenda('198.51.100.' + i, 'z'.repeat(43))).code);
    dit(codes.slice(0, 20).every((c) => c !== 429) && codes.slice(20).every((c) => c === 429), 'DÉBIT le MÊME jeton depuis 22 adresses : 20 par minute, puis 429', codes.join(','));
    const w = async (ip, k) => { const x = faireRes(); await widget({ method: 'GET', query: { k }, headers: { 'x-forwarded-for': ip } }, x); return x; };
    codes = [];
    for (let i = 0; i < 32; i++) codes.push((await w('192.0.2.9', 'K' + String(i).padStart(27, '0'))).code);
    dit(codes.slice(30).every((c) => c === 429) && codes.slice(0, 30).every((c) => c !== 429), 'DÉBIT widget : une clé inventée en boucle depuis une adresse ⇒ 429 après 30', codes.join(','));
  });

  // ══ MDP : la page « nouveau mot de passe » ═════════════════════════════════
  console.log('\n── MDP · un lien de récupération qui n’a pas été demandé ici n’ouvre rien tout seul');
  await essaie('MDP', async () => {
    const P = await importer('public/recuperation.js');
    dit(typeof P.decisionLien === 'function', 'MDP la page a une règle pour un lien pas demandé ici');
    if (typeof P.decisionLien !== 'function') return;
    const X = '22222222-2222-4222-8222-222222222222';
    dit(P.decisionLien({ demandeIci: false, sessionId: '', compteId: A }) === 'confirmer', 'MDP ni demandé ici ni connecté ⇒ il faut écrire l’adresse du compte');
    dit(P.decisionLien({ demandeIci: true, sessionId: X, compteId: A }) === 'autre_session', 'MDP un AUTRE compte connecté ici ⇒ rien, même demandé (on ne change jamais de compte)');
    dit(P.decisionLien({ demandeIci: true, sessionId: '', compteId: A }) === 'oui' && P.decisionLien({ demandeIci: false, sessionId: A, compteId: A }) === 'oui', 'MDP demandé ici, ou le même compte connecté ⇒ le formulaire');
    const st = (o) => ({ getItem: (k) => (k in o ? o[k] : null) });
    dit(P.lienDemandeIci(st({ vrm_lien_demande: String(Date.now() - 3600e3) })) === true && P.lienDemandeIci(st({ vrm_lien_demande: String(Date.now() - 49 * 3600e3) })) === false && P.lienDemandeIci(st({})) === false, 'MDP la marque de la demande vaut 48 h (la même que l’app)');
    dit(P.memeAdresse(' Moi@Exemple.test ', 'moi@exemple.test') && !P.memeAdresse('', '') && !P.memeAdresse('a@b.c', 'a@b.cd'), 'MDP l’adresse se compare sans casse ni espaces ; vide ne vaut rien');
  });

  // ══ B141 : le jeton SMS encodé (jugé sur le code) ══════════════════════════
  await essaie('B141', async () => {
    const s = sansCommentaires(fs.readFileSync(path.join(R, 'api/_lib/sms-mondialrelay.js'), 'utf8'));
    dit(/data->>vrm_sms_token=eq\.\$\{encodeURIComponent\(k\)\}/.test(s) && !/vrm_sms_token=eq\.\$\{k\}/.test(s), 'B141 le jeton SMS est ENCODÉ dans le filtre PostgREST');
  });

  // ══ Par processus fils, sur le MÊME arbre ══════════════════════════════════
  console.log('\n── Les autres audits du lot, sur le même arbre');
  const fils = (script, args, env, motifs) => {
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, script), ...args], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 900000 });
    const out = r.stdout || '';
    for (const [re, nom] of motifs) { const l = out.split('\n').filter((x) => re.test(x)); dit(l.length > 0 && l.every((x) => x.startsWith('✅')), nom, l.filter((x) => !x.startsWith('✅')).slice(0, 2).join(' | ') || (l.length ? '' : 'contrôle absent')); }
    dit(r.status === 0, `${script} : vert en entier`, out.split('\n').filter((x) => x.startsWith('❌')).slice(0, 3).join(' | '));
  };
  fils('audit-clients-partis.cjs', ['--src', R], {}, [[/^(✅|❌) H20 :/, 'H20 un client réabonné sous un NOUVEL abonnement n’est jamais effacé'], [/^(✅|❌) H30 :/, 'H30 double constat sur deux passages, un échec arrête les suivants']]);
  fils('audit-robustesse-serveur.cjs', ['--src', R], {}, [[/^.{2}H29 /, 'H29 jamais le plus gros montant rangé comme le net viré'], [/^.{2}H9 /, 'H9 jamais un N° départagé par la taille']]);
  fils('audit-ebay-route.cjs', ['--src', R], {}, [[/R-sync-parallele/, 'H24 les GetItem de la synchro en parallèle (4), chaque annonce son détail']]);

  console.log(`\n${ko ? '❌' : '✅'} audit-serveur-robuste : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
