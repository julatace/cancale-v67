// Audit « Solo et Pro » (9 nov.) — Julien : « Ça peut être 1 compte vendeur et
// plein de comptes achat, donc sur ces comptes on prend que les achats ; pour
// avoir toutes ses ventes de tous ses comptes il prend l'abonnement du dessus. »
// Exécute la VRAIE règle (api/_lib/plan-regle.js), le VRAI état de l'app
// (src/abonnement/planVentes.js), le VRAI api/compte.js (faux Stripe, fausse base)
// et le VRAI api/_lib/plan-vendeur.js :
//   1. la règle : Solo = le seul compte vendeur ; Pro = tout ; pas su ⇒ rien bridé ;
//      50 comptes au même pseudo ⇒ l'identité seule décide ;
//   2. l'app : la règle suit le serveur, une réponse illisible ne débride ni ne
//      bride, le propriétaire n'est jamais bridé ; câblage d'App.jsx (les achats
//      d'un compte d'achat restent) ;
//   3. le serveur : le plan vient du PRIX Stripe, jamais du navigateur ; le compte
//      vendeur est à LUI, une fois / 30 j ; Pro fermé tant que son prix n'est pas
//      posé ; changement d'offre avec prorata ; webhook (avec et sans la 028) ;
//   4. les notifications de vente d'un compte d'achat ne partent pas.
// `--prouve` : rejoue des MUTATIONS de la règle (chacune doit rendre du rouge).
// Aucune donnée réelle : tout est inventé ici.
const path = require('path'), fs = require('fs'), crypto = require('crypto'), os = require('os');
const RACINE = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); } };
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// ── Les contrôles de la RÈGLE (rejoués sur chaque mutation avec --prouve) ──────
async function controlesRegle(R, dire) {
  const V = (uid, prix = 10) => ({ _acc: { vinted_user_id: uid, login: 'shop' }, price: { amount: prix } });
  // 50 comptes au MÊME pseudo, chacun une vente de 10 € ; le compte vendeur : n° 1007.
  const ventes = Array.from({ length: 50 }, (_, i) => V(String(1000 + i)));
  const somme = (r) => ventes.filter((o) => !R.venteHorsPlan(r, o._acc.vinted_user_id)).reduce((s, o) => s + o.price.amount, 0);
  const solo = R.regleVentes({ plan: 'solo', compteVendeur: { uid: '1007' } });
  dire(solo.bride === true && somme(solo) === 10, 'Solo : le total = les ventes du SEUL compte vendeur (50 comptes au même pseudo, 1 compté)', `${somme(solo)} €`);
  const pro = R.regleVentes({ plan: 'pro', compteVendeur: { uid: '1007' } });
  dire(pro.bride === false && somme(pro) === 500, 'Pro : toutes les ventes de tous les comptes', `${somme(pro)} €`);
  const pasSu = [R.regleVentes(null), R.regleVentes({ plan: null, compteVendeur: { uid: '1007' } }), R.regleVentes({ plan: 'gold', compteVendeur: '1007' })];
  dire(pasSu.every((r) => r.bride === false && somme(r) === 500), 'plan illisible ⇒ « pas su » ⇒ comportement d’avant, jamais bridé à tort', pasSu.map((r) => somme(r)).join(' · '));
  const sansChoix = R.regleVentes({ plan: 'solo', compteVendeur: null });
  dire(sansChoix.bride === false && somme(sansChoix) === 500, 'Solo SANS compte choisi : rien n’est bridé (jamais deviné)', String(somme(sansChoix)));
  const prop = R.regleVentes({ proprietaire: true, plan: 'solo', compteVendeur: { uid: '1007' } });
  dire(prop.bride === false && prop.plan === 'pro', 'le propriétaire de l’installation : Pro, jamais bridé', JSON.stringify(prop));
  dire(!R.venteHorsPlan(solo, '') && !R.venteHorsPlan(solo, null) && !R.venteHorsPlan(solo, 'shop'), 'une vente sans compte relevé (ou un pseudo) n’est jamais écartée');
  dire(R.venteHorsPlan(solo, '1008') && !R.venteHorsPlan(solo, '1007') && !R.venteHorsPlan(solo, ' 1007 '), 'identité : le n° de compte, pas le pseudo');
  // Le plan vient du PRIX.
  const sub = (prix, meta = {}) => ({ items: { data: [{ id: 'si_1', quantity: 1, price: prix }] }, metadata: meta });
  const opts = { prixPro: 'price_pro', cleSolo: 'vrm_mensuel' };
  const s1 = R.planDeLAbonnement(sub({ id: 'price_s', lookup_key: 'vrm_mensuel' }, { cgv_version: '2026-11-09', vrm_compte_vendeur: '1007' }), opts);
  const s0 = R.planDeLAbonnement(sub({ id: 'price_s', lookup_key: 'vrm_mensuel' }, { cgv_version: '2026-11-08', vrm_compte_vendeur: '1007' }), opts);
  const p1 = R.planDeLAbonnement(sub({ id: 'price_pro', lookup_key: null }, { cgv_version: '2026-11-09' }), opts);
  const p2 = R.planDeLAbonnement(sub({ id: 'price_x', lookup_key: 'vrm_pro_mensuel' }, {}), opts);
  const inc = R.planDeLAbonnement(sub({ id: 'price_ancien', lookup_key: null }, { cgv_version: '2026-11-09', plan: 'pro' }), opts);
  dire(s1.plan === 'solo' && s1.vendeur === '1007', 'le prix `vrm_mensuel` (CGV du 9 nov.) ⇒ Solo, compte vendeur lu des métadonnées', JSON.stringify(s1));
  dire(s0.plan === null && s0.raison === 'cgv-anterieures', 'Solo souscrit sous les CGV d’avant (« tous tes comptes ») ⇒ jamais bridé', JSON.stringify(s0));
  dire(p1.plan === 'pro' && p2.plan === 'pro', 'le prix posé dans STRIPE_PRIX_PRO (ou la clé `vrm_pro_mensuel`) ⇒ Pro');
  dire(inc.plan === null, 'un prix inconnu ⇒ pas su (un champ « plan » dans les métadonnées ne décide rien)', JSON.stringify(inc));
  const deux = R.planDeLAbonnement({ items: { data: [{ price: { lookup_key: 'vrm_mensuel' } }, { price: { id: 'price_pro' } }] }, metadata: { cgv_version: '2026-11-09' } }, opts);
  dire(deux.plan === null, 'deux articles ⇒ pas su');
  // Proposé, jamais appliqué ; égalité ⇒ rien.
  const comptes = [{ uid: '1' }, { uid: '2' }, { uid: '3' }];
  dire(R.compteDefaut(comptes, [V('1'), V('2'), V('2')]) === '2' && R.compteDefaut(comptes, [V('1'), V('2')]) === null && R.compteDefaut(comptes, null) === null,
    'compte proposé : le plus de ventes lues, strictement ; égalité ou ventes pas lues ⇒ rien de proposé');
  const T = Date.parse('2026-11-09T10:00:00Z');
  dire(R.prochainChangement(null, T) === null && R.prochainChangement(new Date(T - 31 * 864e5).toISOString(), T) === null && !!R.prochainChangement(new Date(T - 3 * 864e5).toISOString(), T),
    'changer de compte vendeur : premier choix libre, puis une fois tous les 30 jours');
}

// ── Les mutations (--prouve) : chacune affaiblit la règle ; il faut du rouge ──
const MUTATIONS = [
  ['venteHorsPlan ignore le compte vendeur', (s) => s.replace("return uidValide(u) && u !== regle.vendeur;", 'return uidValide(u);')],
  ['bride sans compte choisi', (s) => s.replace("bride: plan === PLAN_SOLO && !!vendeur", 'bride: plan === PLAN_SOLO')],
  ['propriétaire bridé', (s) => s.replace("if (x.proprietaire === true) return { plan: PLAN_PRO, vendeur: null, bride: false };", '')],
  ['CGV d’avant bridées', (s) => s.replace("if (plan === PLAN_SOLO && !(String(m.cgv_version || '') >= CGV_PLANS_DEPUIS)) { plan = null; raison = 'cgv-anterieures'; }", '')],
  ['pas su ⇒ Solo', (s) => s.replace("const plan = x.plan === PLAN_PRO || x.plan === PLAN_SOLO ? x.plan : null;", "const plan = x.plan === PLAN_PRO ? x.plan : PLAN_SOLO;")],
  ['égalité ⇒ un compte proposé', (s) => s.replace("return meilleur && !egal ? meilleur : null;", 'return meilleur;')],
];

(async () => {
  const PROUVE = process.argv.includes('--prouve');
  let R;
  try { R = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-regle.js')); }
  catch (e) { dit(false, 'api/_lib/plan-regle.js se charge', e.message); console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }
  console.log('── 1. La règle');
  await essaie('règle', () => controlesRegle(R, dit));

  if (PROUVE) {
    console.log('── Mutations (chacune doit être rouge)');
    const src = lire('api/_lib/plan-regle.js');
    for (const [nom, f] of MUTATIONS) {
      const m = f(src);
      if (m === src) { dit(false, `mutation « ${nom} » applicable`, 'le texte visé a changé'); continue; }
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-mut-'));
      fs.writeFileSync(path.join(dir, 'plan-regle.mjs'), m);
      let rouges = 0;
      try { const RM = await import('file://' + path.join(dir, 'plan-regle.mjs')); await controlesRegle(RM, (c) => { if (!c) rouges++; }); } catch (_) { rouges++; }
      dit(rouges > 0, `mutation « ${nom} » ⇒ rouge`, `${rouges} rouge(s)`);
    }
  }

  console.log('── 2. L’app : la règle suit le serveur ; App.jsx garde les achats des comptes d’achat');
  await essaie('état app', async () => {
    const mem = {}; global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
    const E = await import('file://' + path.join(RACINE, 'src', 'abonnement', 'etatAbonnement.js'));
    const P = await import('file://' + path.join(RACINE, 'src', 'abonnement', 'planVentes.js'));
    P.demarrerPlan('uid-banc');
    dit(P.signaturePlan() === 'libre' && !P.venteHorsPlanUid('9'), 'au départ (rien su) : libre');
    let changes = 0; P.suivrePlan(() => changes++);
    E.publierAbonnement({ ok: true, plan: 'solo', compteVendeur: { uid: '7' } });
    dit(P.signaturePlan() === 'solo:7' && P.venteHorsPlanUid('9') && !P.venteHorsPlanUid('7') && changes === 1, 'Solo, compte 7 : les ventes du compte 9 sortent, celles du 7 restent ; un seul signal de remontage', `${P.signaturePlan()} · ${changes}`);
    E.publierAbonnement(null);
    dit(P.signaturePlan() === 'solo:7', 'une réponse illisible ne change rien (ni débridé, ni bridé sur un hoquet)');
    dit(String(mem['vrm_plan_regle_uid-banc'] || '').includes('"7"'), 'la règle est gardée sur l’appareil (juste dès l’ouverture suivante)');
    E.publierAbonnement({ ok: true, proprietaire: true, plan: 'solo', compteVendeur: { uid: '7' } });
    dit(P.signaturePlan() === 'libre' && !P.venteHorsPlanUid('9') && !mem['vrm_plan_regle_uid-banc'], 'propriétaire : libre, rien gardé');
    E.publierAbonnement({ ok: true, plan: 'pro', compteVendeur: { uid: '7' } });
    dit(P.signaturePlan() === 'libre', 'passer à Pro rend tout immédiatement (signature libre)');
  });
  await essaie('câblage App.jsx', async () => {
    const app = sansCommentaires(lire('src/App.jsx'));
    const compta = sansCommentaires(lire('src/ecrans/Compta.jsx'));
    dit(/const compteEcarte = \(uid, masques, panneau\) => compteEcarteChoix\(uid, masques, panneau\) \|\| venteHorsPlanUid\(uid\);/.test(app), 'les totaux des ventes (`compteEcarte`) écartent les comptes hors offre');
    dit(/return compteEcarteChoix\(uid, hiddenAccts, panelAcctOff\);/.test(app) && /const buysBase = useMemo\(\(\) => \(buys\.items \|\| \[\]\)\.filter\(o => !acctOffOf\(o\)\)/.test(app),
      'les ACHATS d’un compte d’achat restent (acctOff = le choix seul, sans l’offre)');
    dit(/exclu: \(o\) => compteEcarteChoix\(o && o\._uid/.test(compta), 'Compta → registre des achats : les achats des comptes d’achat comptent');
    dit(/const isHidden = \(o\) => hiddenSales\.has\(String\(o\.transaction_id\)\) \|\| venteOffOf\(o\);/.test(app) && /const venteOffOf = \(o\) => acctOffOf\(o\) \|\| horsPlanOf\(o\);/.test(app),
      'listes de ventes, colis à envoyer, CA : hors offre écarté (`isHidden`)');
    dit(/exclu: venteOffOf, excluAutre, versements, declare: declUrssaf/.test(app), 'CA déclaré (URSSAF) : les ventes hors offre n’y entrent pas');
    dit(/<VentesHorsPlan /.test(app) && /<BandeauCompteVendeur /.test(app), 'Ventes : l’aperçu des ventes hors offre est rendu ; la coque porte la feuille « Quel compte vend ? »');
    dit(/<React\.Fragment key=\{sigPlan\}>\{children\}<\/React\.Fragment>/.test(app), 'quand la règle change, l’app se remonte (chaque total se recalcule)');
    // Les gardes de sécurité ne sont PAS bridées : double vente, annulées, litiges, stock.
    dit((app.match(/!acctOffOf\(o\) &&\s*classifyOrderStatus\(o\.status\) !== "cancelled"/g) || []).length >= 2, 'la double vente garde TOUTES les ventes (un compte d’achat qui vend reste protégé)');
  });

  console.log('── 3. Le serveur : le plan vient du prix Stripe');
  const A = '11111111-1111-4111-8111-111111111111', PROP = '99999999-9999-4999-8999-999999999999';
  const JETONS = { 'aa.bb.A': { id: A, email: 'a@exemple.test' }, 'aa.bb.P': { id: PROP, email: 'p@exemple.test' } };
  let abos, stripe, sub, prixPro, vintedDe, colonne028;
  const reset = () => {
    abos = { [A]: { statut: 'active', client_stripe: 'cus_A', abonnement_stripe: 'sub_A', fin_periode: null, annule_fin_periode: false } };
    stripe = []; prixPro = { id: 'price_pro', unit_amount: 1999, currency: 'eur', recurring: { interval: 'month', interval_count: 1 }, active: true };
    sub = { id: 'sub_A', status: 'active', customer: 'cus_A', metadata: { owner: A, cgv_version: '2026-11-09' }, items: { data: [{ id: 'si_A', quantity: 1, price: { id: 'price_solo', lookup_key: 'vrm_mensuel', unit_amount: 1699, currency: 'eur', recurring: { interval: 'month' } } }] } };
    vintedDe = { [A]: ['1007', '1008'] }; colonne028 = true;
  };
  const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
  global.fetch = async (url, opts = {}) => {
    const u = String(url), m = opts.method || 'GET', h = opts.headers || {};
    const jwt = String(h.Authorization || '').replace('Bearer ', '');
    const qui = JETONS[jwt];
    if (u.includes('/auth/v1/user')) return qui ? rep(qui) : rep({ msg: 'invalid' }, 401);
    if (u.includes('/rest/v1/rpc/vrm_acces_pour')) return rep(true);
    if (u.includes('/rest/v1/rpc/vrm_acces')) return qui ? rep({ obligatoire: false, proprietaire: qui.id === PROP, acces: true, lecture: true }) : rep({}, 401);
    if (u.includes('/rest/v1/abonnements')) {
      if (m === 'POST') {
        const lignes = JSON.parse(opts.body);
        if (!colonne028 && lignes.some((l) => 'plan' in l || 'compte_vendeur' in l)) return rep({ code: 'PGRST204', message: "Could not find the 'plan' column of 'abonnements' in the schema cache" }, 400);
        for (const l of lignes) abos[l.owner] = { ...(abos[l.owner] || {}), ...l }; return rep('', 201);
      }
      if (qui) return rep(abos[qui.id] ? [abos[qui.id]] : []);
      const o = (/owner=eq\.([^&]+)/.exec(u) || [])[1], c = (/client_stripe=eq\.([^&]+)/.exec(u) || [])[1];
      if (/select=statut,plan,compte_vendeur/.test(u) && !colonne028) return rep({ code: '42703' }, 400);
      if (o) { const id = decodeURIComponent(o); return rep(abos[id] ? [{ ...abos[id], owner: id }] : []); }
      if (c) { const e = Object.entries(abos).find(([, l]) => l.client_stripe === decodeURIComponent(c)); return rep(e ? [{ owner: e[0] }] : []); }
      return rep([]);
    }
    if (u.includes('/rest/v1/vinted_accounts')) { const o = qui ? qui.id : decodeURIComponent((/owner=eq\.([^&]+)/.exec(u) || [])[1] || ''); return rep((vintedDe[o] || []).map((v) => ({ vinted_user_id: v }))); }
    if (u.includes('/rest/v1/essais_gratuits')) return rep([]);
    if (u.startsWith('https://api.stripe.com/v1/')) {
      const chemin = u.slice('https://api.stripe.com/v1/'.length).split('?')[0];
      const corps = new URLSearchParams(opts.body || '');
      stripe.push({ m, chemin, corps });
      if (chemin === 'prices') return rep({ data: [{ id: 'price_solo', lookup_key: 'vrm_mensuel', unit_amount: 1699, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } }] });
      if (chemin === 'prices/price_pro') return prixPro ? rep(prixPro) : rep({ error: {} }, 404);
      if (chemin === 'subscriptions/sub_A') {
        if (m === 'POST') {
          const meta = {}; for (const [k, v] of corps) { const mm = /^metadata\[(.+)\]$/.exec(k); if (mm) meta[mm[1]] = v; }
          sub = { ...sub, metadata: { ...sub.metadata, ...meta } };
          if (corps.get('items[0][price]') === 'price_pro') sub.items.data[0].price = { id: 'price_pro', lookup_key: null, unit_amount: 1999, currency: 'eur', recurring: { interval: 'month' } };
          if (corps.get('items[0][price]') === 'price_solo') sub.items.data[0].price = { id: 'price_solo', lookup_key: 'vrm_mensuel', unit_amount: 1699, currency: 'eur', recurring: { interval: 'month' } };
        }
        return rep(sub);
      }
      return rep({ error: { message: 'inconnu' } }, 404);
    }
    return rep({}, 404);
  };
  const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
  const req = ({ method = 'GET', mode, headers = {}, corps = null }) => {
    const buf = corps == null ? null : Buffer.from(typeof corps === 'string' ? corps : JSON.stringify(corps), 'utf8');
    return { method, query: { mode }, headers, async *[Symbol.asyncIterator]() { if (buf) yield buf; } };
  };
  const SECRET = 'whsec_banc_plans';
  process.env.STRIPE_WEBHOOK_SECRET = SECRET; process.env.STRIPE_SECRET_KEY = 'sk_test_banc'; process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  delete process.env.STRIPE_PRIX_PRO;
  let compte;
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; } catch (e) { dit(false, 'api/compte.js se charge', e.message); }
  const appel = async (o) => { const r = faireRes(); await compte(req(o), r); return r; };
  const A_ = { authorization: 'Bearer aa.bb.A' }, P_ = { authorization: 'Bearer aa.bb.P' };
  const postsStripe = () => stripe.filter((x) => x.m === 'POST' && x.chemin.startsWith('subscriptions/'));

  if (compte) {
    await essaie('abonnement', async () => {
      reset();
      let r = await appel({ mode: 'abonnement', headers: A_ });
      dit(r.code === 200 && r.corps.plan === 'solo' && r.corps.compteVendeur === null, 'Solo lu du prix Stripe ; compte vendeur pas encore choisi', JSON.stringify({ plan: r.corps.plan, cv: r.corps.compteVendeur }));
      dit(r.corps.offres && r.corps.offres.pro.ouvert === false && r.corps.offres.pro.raison === undefined, 'STRIPE_PRIX_PRO absent : Pro fermé, la raison ne part pas au vendeur', JSON.stringify(r.corps.offres));
      sub.metadata.cgv_version = '2026-11-08';
      r = await appel({ mode: 'abonnement', headers: A_ });
      dit(r.corps.plan === null && r.corps.planRaison === 'cgv-anterieures', 'abonnement pris sous les CGV d’avant : plan « pas su », rien bridé', String(r.corps.planRaison));
      r = await appel({ mode: 'abonnement', headers: P_ });
      dit(r.corps.plan === 'pro' && r.corps.offres.pro.raison === 'sans-prix-stripe', 'propriétaire : Pro ; il lit le geste qui ouvre Pro', JSON.stringify({ plan: r.corps.plan, raison: r.corps.offres.pro.raison }));
      process.env.STRIPE_PRIX_PRO = 'price_pro';
      r = await appel({ mode: 'abonnement', headers: A_ });
      dit(r.corps.offres.pro.ouvert === true && r.corps.offres.pro.texte === '19,99 € / mois', 'prix Pro posé et Stripe dit 19,99 € : Pro ouvert, montant lu chez Stripe', JSON.stringify(r.corps.offres.pro));
      prixPro.unit_amount = 2499;
      r = await appel({ mode: 'abonnement', headers: P_ });
      dit(r.corps.offres.pro.ouvert === false && r.corps.offres.pro.raison === 'prix-different' && /24,99/.test(r.corps.offres.pro.texteStripe || ''), 'Stripe dit un autre montant : Pro fermé, le propriétaire voit le montant de Stripe', JSON.stringify(r.corps.offres.pro));
      const rv = await appel({ mode: 'abonnement', headers: A_ });
      dit(rv.corps.offres.pro.texte === null && rv.corps.offres.pro.texteStripe === undefined, '  … et le vendeur ne voit pas ce montant');
      delete process.env.STRIPE_PRIX_PRO;
    });
    await essaie('compte vendeur', async () => {
      reset();
      let r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { uid: '5555' } });
      dit(r.code === 403 && postsStripe().length === 0, 'un compte qui n’est pas à lui : refusé, rien écrit chez Stripe', `HTTP ${r.code}`);
      r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { uid: '1007' } });
      dit(r.code === 200 && sub.metadata.vrm_compte_vendeur === '1007' && r.corps.compteVendeur.uid === '1007', 'son compte : rangé dans SON abonnement Stripe (métadonnées), relu', JSON.stringify(r.corps));
      const n = postsStripe().length;
      r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { uid: '1008' } });
      dit(r.code === 429 && postsStripe().length === n && /30 jours/.test(r.corps.message), 'changer avant 30 jours : refusé, la date est dite, rien écrit', `HTTP ${r.code} · ${r.corps.message}`);
      sub.metadata.vrm_compte_vendeur_le = new Date(Date.now() - 31 * 864e5).toISOString();
      r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { uid: '1008' } });
      dit(r.code === 200 && sub.metadata.vrm_compte_vendeur === '1008' && sub.metadata.vrm_compte_vendeur_avant === '1007', 'après 30 jours : changé (l’ancien gardé)');
      r = await appel({ mode: 'abonnement', headers: A_ });
      dit(r.corps.compteVendeur && r.corps.compteVendeur.uid === '1008' && !!r.corps.compteVendeur.prochainChangement, 'l’app relit le compte vendeur et le prochain changement possible');
      r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: P_, corps: { uid: '1007' } });
      dit(r.code === 409, 'propriétaire : rien à choisir (Pro)');
    });
    await essaie('changer d’offre', async () => {
      reset();
      let r = await appel({ method: 'POST', mode: 'changer-plan', headers: A_, corps: { plan: 'pro', cgv: true } });
      dit(r.code === 503 && postsStripe().length === 0, 'Pro pas encore posé : passer à Pro est refusé, rien chez Stripe', `HTTP ${r.code}`);
      process.env.STRIPE_PRIX_PRO = 'price_pro';
      r = await appel({ method: 'POST', mode: 'changer-plan', headers: A_, corps: { plan: 'pro' } });
      dit(r.code === 400 && postsStripe().length === 0, 'sans les CGV cochées : refusé');
      r = await appel({ method: 'POST', mode: 'changer-plan', headers: A_, corps: { plan: 'pro', cgv: true } });
      const p = postsStripe().pop();
      dit(r.code === 200 && r.corps.plan === 'pro' && p && p.corps.get('items[0][id]') === 'si_A' && p.corps.get('items[0][price]') === 'price_pro' && p.corps.get('proration_behavior') === 'create_prorations',
        'Solo → Pro : le PRIX de son abonnement change chez Stripe, au prorata', p ? p.corps.toString().slice(0, 160) : 'aucun appel');
      r = await appel({ mode: 'abonnement', headers: A_ });
      dit(r.corps.plan === 'pro', 'relu : Pro (le plan vient du prix, pas d’un champ)');
      delete process.env.STRIPE_PRIX_PRO;
    });
    await essaie('webhook', async () => {
      reset();
      const signer = (c) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${crypto.createHmac('sha256', SECRET).update(`${t}.${c}`).digest('hex')}`; };
      const envoyer = async (objet, ts) => { const c = JSON.stringify({ id: 'evt_' + ts, type: 'customer.subscription.updated', created: ts, livemode: false, data: { object: objet } }); return appel({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }); };
      process.env.STRIPE_PRIX_PRO = 'price_pro';
      let r = await envoyer({ ...sub, metadata: { ...sub.metadata, vrm_compte_vendeur: '1007', plan: 'pro' } }, 100);
      dit(r.code === 200 && abos[A].plan === 'solo' && abos[A].compte_vendeur === '1007', 'webhook : plan lu du PRIX (Solo) — un « plan: pro » glissé dans les métadonnées ne décide rien', JSON.stringify({ plan: abos[A].plan, cv: abos[A].compte_vendeur }));
      r = await envoyer({ ...sub, items: { data: [{ id: 'si_A', quantity: 1, price: { id: 'price_pro' } }] } }, 200);
      dit(abos[A].plan === 'pro', 'webhook : prix Pro ⇒ Pro');
      colonne028 = false;
      r = await envoyer({ ...sub, status: 'past_due' }, 300);
      dit(r.code === 200 && abos[A].statut === 'past_due', 'sans la migration 028 (colonne absente) : le STATUT est quand même rangé', `HTTP ${r.code} · ${abos[A].statut}`);
      delete process.env.STRIPE_PRIX_PRO;
    });
  }

  console.log('── 4. Les notifications de vente d’un compte d’achat ne partent pas');
  await essaie('push', async () => {
    reset();
    const PV = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-vendeur.js'));
    abos[A] = { statut: 'active', plan: 'solo', compte_vendeur: '1007' };
    dit(await PV.venteHorsPlanServeur(A, '1008') === true && await PV.venteHorsPlanServeur(A, '1007') === false, 'Solo : la vente du compte 1008 ne sonne pas, celle du compte vendeur sonne');
    PV.oublierPlans(); abos[A].plan = 'pro';
    dit(await PV.venteHorsPlanServeur(A, '1008') === false, 'Pro : tout sonne');
    PV.oublierPlans(); colonne028 = false;
    dit(await PV.venteHorsPlanServeur(A, '1008') === false, 'base sans la 028 (pas su) : la vente sonne');
    PV.oublierPlans(); colonne028 = true; abos[A] = { statut: 'canceled', plan: 'solo', compte_vendeur: '1007' };
    dit(await PV.venteHorsPlanServeur(A, '1008') === false, 'abonnement pas vivant : rien bridé ici (la base décide de l’accès)');
    const inbound = sansCommentaires(lire('api/email-inbound.js'));
    const gardes = (inbound.match(/if \(!\(await venteHorsPlanServeur\(proprietaireCourant\(\), acc\.uid\)\)\) try \{ await pushOnce\(\{\s*\.\.\.(texteVendu|texteArgentRecu)/g) || []);
    dit(gardes.length === 2, 'email-inbound : « vendu » et « argent reçu » passent par la règle avant de sonner (la vente est rangée quand même)', `${gardes.length}/2`);
  });

  console.log('── 5. Les prix : Solo 16,99 €, Pro 19,99 € (décision du 9 nov.), une valeur chacun');
  await essaie('prix', async () => {
    const reg = lire('src/accueil-reglages.js'), cpt = lire('api/compte.js'), cgv = lire('public/legal/cgv.html');
    dit(/PRIX_PRO_MOIS = '19,99'/.test(reg) && /PRIX_PRO_CGV = \{ centimes: 1999, devise: 'eur', intervalle: 'month' \}/.test(cpt) && /Offre Pro : 19,99 € par mois/.test(cgv), 'Pro 19,99 € : app, serveur et CGV disent la même chose');
    dit(/Dernière mise à jour : 9 novembre 2026/.test(cgv) && /const CGV_VERSION = '2026-11-09'/.test(cpt), 'CGV du 9 novembre (Solo et Pro), version acceptée à jour');
    dit(/un compte vendeur/.test(cgv) && /comptes d’achat/.test(cgv) && /rien n’est supprimé/.test(cgv), 'CGV : Solo dit « un compte vendeur » et « comptes d’achat », rien supprimé');
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-plans-solo-pro : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
