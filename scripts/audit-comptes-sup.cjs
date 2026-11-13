// Audit « plusieurs comptes Vinted dès Solo » (13 nov., lot 56).
// Solo : 1 compte Vinted vendeur inclus · +X €/mois par compte de plus (X =
// `PRIX_COMPTE_SUP_CENTIMES`, api/_lib/plan-regle.js, la seule valeur ; 3 € à
// confirmer par Julien). Pro reste illimité.
// Exécute la VRAIE règle (api/_lib/plan-regle.js), le VRAI api/compte.js (faux
// Stripe, fausse base, routes `abonnement`, `compte-vendeur`, `changer-plan`,
// `webhook`), le VRAI api/_lib/plan-vendeur.js et le VRAI état de l'app :
//   1. la règle : vendeur inclus + comptes payés ; JAMAIS plus que la quantité
//      payée chez Stripe ; Pro et « pas su » n'en lisent rien ; 50 comptes au
//      même pseudo ⇒ l'identité seule décide ;
//   2. le serveur : prix `vrm_compte_sup` absent ⇒ « bientôt », rien d'achetable,
//      AUCUN appel d'écriture chez Stripe ; prix présent et conforme ⇒ la quantité
//      monte (prorata, CGV exigées) ; place déjà payée ⇒ rien facturé ; pas à lui
//      ⇒ 403 ; Pro / propriétaire ⇒ 409 ; retirer ⇒ la quantité redescend ;
//      vers Pro ⇒ l'article part ; webhook ⇒ la ligne ne porte que les payés ;
//   3. les bilans / notifications du serveur lisent la même borne ;
//   4. la valeur unique : CGV, écran, accueil la disent depuis la constante.
// `--prouve` : rejoue des MUTATIONS (règle ET route) — chacune doit rendre du rouge.
// Aucune donnée réelle : tout est inventé ici.
const path = require('path'), fs = require('fs'), crypto = require('crypto'), os = require('os');
const RACINE = path.join(__dirname, '..');
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// ── 1. LA RÈGLE (rejouée sur chaque mutation de plan-regle.js) ─────────────────
async function controlesRegle(R, dire) {
  const V = (uid) => ({ uid, prix: 10 });
  const comptes = Array.from({ length: 50 }, (_, i) => String(1000 + i));   // 50 comptes, même pseudo « shop »
  const somme = (r) => comptes.filter((u) => !R.venteHorsPlan(r, u)).length * 10;
  const sub = (sup, meta, base = { id: 'price_solo', lookup_key: 'vrm_mensuel' }) => ({
    items: { data: [{ id: 'si_base', quantity: 1, price: base }, ...(sup ? [{ id: 'si_sup', quantity: sup, price: { id: 'price_sup', lookup_key: 'vrm_compte_sup' } }] : [])] },
    metadata: { cgv_version: '2026-11-13', vrm_compte_vendeur: '1007', ...meta },
  });
  const opts = { prixPro: 'price_pro', cleSolo: 'vrm_mensuel' };
  const l2 = R.planDeLAbonnement(sub(2, { vrm_comptes_sup: '1008,1009,1010' }), opts);
  dire(l2.plan === 'solo' && l2.comptesSup && l2.comptesSup.payes === 2 && JSON.stringify(l2.comptesSup.liste) === '["1008","1009"]',
    'Stripe : 2 comptes payés, 3 rangés ⇒ seuls les 2 PREMIERS vendent (la quantité payée borne la liste)', JSON.stringify(l2.comptesSup));
  const l0 = R.planDeLAbonnement(sub(0, { vrm_comptes_sup: '1008,1009' }), opts);
  dire(l0.plan === 'solo' && l0.comptesSup.liste.length === 0, 'aucun article « compte de plus » ⇒ aucun compte de plus, même avec une liste glissée dans les métadonnées', JSON.stringify(l0.comptesSup));
  const lp = R.planDeLAbonnement(sub(3, { vrm_comptes_sup: '1008,1009' }, { id: 'price_pro', lookup_key: null }), opts);
  const rp = R.regleVentes({ plan: lp.plan, compteVendeur: { uid: lp.vendeur }, comptesSup: lp.comptesSup });
  dire(lp.plan === 'pro' && lp.comptesSup.liste.length === 0 && somme(rp) === 500, 'Pro (même avec un article de plus resté) : illimité, aucune liste lue, 50 comptes comptent', `${lp.plan} · ${somme(rp)} €`);
  const deux = R.planDeLAbonnement({ items: { data: [{ id: 'a', quantity: 1, price: { lookup_key: 'vrm_mensuel' } }, { id: 'b', quantity: 1, price: { lookup_key: 'autre' } }] }, metadata: { cgv_version: '2026-11-13' } }, opts);
  dire(deux.plan === null, 'un autre 2e article qu’un compte de plus ⇒ « pas su » (rien bridé)', JSON.stringify({ plan: deux.plan, raison: deux.raison }));
  const doublons = R.planDeLAbonnement(sub(3, { vrm_comptes_sup: '1007,1008,1008,abc,1009' }), opts);
  dire(JSON.stringify(doublons.comptesSup.liste) === '["1008","1009"]', 'liste nettoyée : ni le compte inclus, ni un doublon, ni un pseudo', JSON.stringify(doublons.comptesSup.liste));

  const solo = R.regleVentes({ plan: 'solo', compteVendeur: { uid: '1007' } });
  const solo2 = R.regleVentes({ plan: 'solo', compteVendeur: { uid: '1007' }, comptesSup: { liste: ['1008', '1009'] } });
  dire(somme(solo) === 10 && somme(solo2) === 30, 'Solo : 50 comptes au même pseudo ⇒ 1 compté ; avec 2 comptes de plus ⇒ 3 comptés (l’identité seule décide)', `${somme(solo)} € puis ${somme(solo2)} €`);
  dire(!R.venteHorsPlan(solo2, '1008') && !R.venteHorsPlan(solo2, ' 1009 ') && R.venteHorsPlan(solo2, '1010'), 'un compte de plus vend ; le suivant reste compte d’achat');
  dire(R.signatureRegle(solo2) !== R.signatureRegle(solo), 'ajouter un compte change la signature (l’app se remonte, chaque total se recalcule)', `${R.signatureRegle(solo)} → ${R.signatureRegle(solo2)}`);
  const ligne = R.regleVentes({ plan: 'solo', compteVendeur: '1007', comptesVendeurs: { vinted_sup: ['1008'] } });
  dire(!R.venteHorsPlan(ligne, '1008') && R.venteHorsPlan(ligne, '1009'), 'la ligne du serveur (`comptes_vendeurs.vinted_sup`) donne la même règle');
  const pasSu = [R.regleVentes({ plan: null, compteVendeur: { uid: '1007' }, comptesSup: { liste: ['1008'] } }), R.regleVentes({ plan: 'pro', comptesSup: { liste: ['1008'] } }), R.regleVentes({ proprietaire: true, plan: 'solo', compteVendeur: { uid: '1007' }, comptesSup: { liste: ['1008'] } })];
  dire(pasSu.every((r) => somme(r) === 500), 'pas su / Pro / propriétaire : rien bridé, aucune liste ne compte', pasSu.map(somme).join(' · '));
  const sansInclus = R.regleVentes({ plan: 'solo', compteVendeur: null, comptesSup: { liste: ['1008'] } });
  dire(somme(sansInclus) === 500, 'Solo sans compte inclus choisi : rien bridé (jamais deviné)');
  dire(R.PRIX_COMPTE_SUP_CENTIMES === 300 && R.CLE_PRIX_COMPTE_SUP === 'vrm_compte_sup' && R.COMPTES_INCLUS_SOLO === 1, 'une valeur : 3 € (300 centimes), clé Stripe `vrm_compte_sup`, 1 compte inclus', `${R.PRIX_COMPTE_SUP_CENTIMES} · ${R.CLE_PRIX_COMPTE_SUP}`);
  dire(R.OFFRES.solo.supplement === `1 compte Vinted vendeur inclus · +${R.prixCompteSupTexte()}/mois par compte de plus`, 'la phrase de l’offre se fabrique depuis la constante', R.OFFRES.solo.supplement);
  dire(R.prixCompteSupTexte(250) === '2,50 €' && R.prixCompteSupTexte(300) === '3 €', 'changer la constante change le texte (2,50 € / 3 €)');
  void V;
}

const MUTATIONS_REGLE = [
  ['quantité payée ignorée', (s) => s.replace('listeComptesSup(m[META_COMPTES_SUP], vendeur).slice(0, payes)', 'listeComptesSup(m[META_COMPTES_SUP], vendeur)')],
  ['comptes de plus ignorés par la règle', (s) => s.replace(" && !(Array.isArray(regle.vendeursSup) && regle.vendeursSup.includes(u))", '')],
  ['doublons et compte inclus gardés (une place payée pour rien)', (s) => s.replace('if (uidValide(u) && !vus.has(u)) { vus.add(u); out.push(u); }', 'if (uidValide(u)) out.push(u);')],
  ['signature aveugle aux comptes de plus', (s) => s.replace("if (r.bride && Array.isArray(r.vendeursSup) && r.vendeursSup.length) parts.push('+' + r.vendeursSup.join('+'));", '')],
  ['liste sans article payé', (s) => s.replace("(s0.quantity == null ? 1 : 0)) : 0;", "(s0.quantity == null ? 1 : 0)) : 99;")],
];

// ── 2. LE SERVEUR (exécuté ; rejoué sur chaque mutation de api/compte.js) ─────
async function controlesServeur(compteMod, PV, dire) {
  const A = '11111111-1111-4111-8111-111111111111', PROP = '99999999-9999-4999-8999-999999999999';
  const JETONS = { 'aa.bb.A': { id: A, email: 'a@exemple.test' }, 'aa.bb.P': { id: PROP, email: 'p@exemple.test' } };
  let abos, stripe, sub, prixSup, prixPro, vintedDe;
  const SOLO = { id: 'price_solo', lookup_key: 'vrm_mensuel', unit_amount: 1699, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } };
  const reset = () => {
    abos = { [A]: { statut: 'active', client_stripe: 'cus_A', abonnement_stripe: 'sub_A', fin_periode: null, annule_fin_periode: false } };
    stripe = []; prixSup = null;
    prixPro = { id: 'price_pro', unit_amount: 1999, currency: 'eur', recurring: { interval: 'month', interval_count: 1 }, active: true };
    sub = { id: 'sub_A', status: 'active', customer: 'cus_A', metadata: { owner: A, cgv_version: '2026-11-13', vrm_compte_vendeur: '1007' }, items: { data: [{ id: 'si_A', quantity: 1, price: { ...SOLO } }] } };
    vintedDe = { [A]: ['1007', '1008', '1009', '1010'] };
  };
  const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
  global.fetch = async (url, opts = {}) => {
    const u = String(url), m = opts.method || 'GET', h = opts.headers || {};
    const qui = JETONS[String(h.Authorization || '').replace('Bearer ', '')];
    if (u.includes('/auth/v1/user')) return qui ? rep(qui) : rep({ msg: 'invalid' }, 401);
    if (u.includes('/rest/v1/rpc/vrm_acces_pour')) return rep(true);
    if (u.includes('/rest/v1/rpc/vrm_acces')) return qui ? rep({ obligatoire: false, proprietaire: qui.id === PROP, acces: true, lecture: true }) : rep({}, 401);
    if (u.includes('/rest/v1/abonnements')) {
      if (m === 'POST') { for (const l of JSON.parse(opts.body)) abos[l.owner] = { ...(abos[l.owner] || {}), ...l }; return rep('', 201); }
      if (m === 'PATCH') {
        const c = JSON.parse(opts.body);
        const o = decodeURIComponent((/owner=eq\.([^&]+)/.exec(u) || [])[1] || ''), l = abos[o];
        const cond = [...u.matchAll(/[?&](evenement_ts|maj)=(eq\.[^&]*|is\.null)/g)].every(([, k, v]) => (v === 'is.null' ? !l || l[k] == null : String(l[k]) === decodeURIComponent(v.slice(3))));
        if (!l || !cond) return rep([]);
        abos[o] = { ...l, ...c }; return rep([{ owner: o }]);
      }
      if (qui) return rep(abos[qui.id] ? [abos[qui.id]] : []);
      const o = (/owner=eq\.([^&]+)/.exec(u) || [])[1], c = (/client_stripe=eq\.([^&]+)/.exec(u) || [])[1];
      if (o) { const id = decodeURIComponent(o); return rep(abos[id] ? [{ ...abos[id], owner: id }] : []); }
      if (c) { const e = Object.entries(abos).find(([, l]) => l.client_stripe === decodeURIComponent(c)); return rep(e ? [{ owner: e[0] }] : []); }
      return rep([]);
    }
    if (u.includes('/rest/v1/vinted_accounts')) { const o = qui ? qui.id : ''; return rep((vintedDe[o] || []).map((v) => ({ vinted_user_id: v }))); }
    if (u.includes('/rest/v1/essais_gratuits') || u.includes('/rest/v1/app_data')) return rep([]);
    if (u.startsWith('https://api.stripe.com/v1/')) {
      const [chemin, qs] = u.slice('https://api.stripe.com/v1/'.length).split('?');
      const corps = new URLSearchParams(opts.body || '');
      stripe.push({ m, chemin, corps });
      if (chemin === 'prices') {
        const cle = new URLSearchParams(qs || '').get('lookup_keys[]');
        if (cle === 'vrm_compte_sup') return rep({ data: prixSup ? [prixSup] : [] });
        return rep({ data: [SOLO] });
      }
      if (chemin === 'prices/price_pro') return rep(prixPro);
      if (chemin === 'subscriptions/sub_A') {
        if (m === 'POST') {
          const meta = {}; for (const [k, v] of corps) { const mm = /^metadata\[(.+)\]$/.exec(k); if (mm) meta[mm[1]] = v; }
          const md = { ...sub.metadata, ...meta }; for (const k of Object.keys(md)) if (md[k] === '') delete md[k];
          let data = sub.items.data.map((x) => ({ ...x }));
          for (let i = 0; corps.has(`items[${i}][id]`) || corps.has(`items[${i}][price]`); i++) {
            const id = corps.get(`items[${i}][id]`), pr = corps.get(`items[${i}][price]`), q = corps.get(`items[${i}][quantity]`), del = corps.get(`items[${i}][deleted]`) === 'true';
            if (id) {
              if (del) { data = data.filter((x) => x.id !== id); continue; }
              data = data.map((x) => (x.id !== id ? x : { ...x, quantity: q != null ? Number(q) : x.quantity, price: pr === 'price_pro' ? { id: 'price_pro', lookup_key: null } : pr === 'price_solo' ? { ...SOLO } : x.price }));
            } else if (pr) data.push({ id: 'si_sup', quantity: Number(q || 1), price: pr === (prixSup && prixSup.id) ? { ...prixSup } : { id: pr } });
          }
          sub = { ...sub, metadata: md, items: { data } };
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
  const appel = async (o) => { const r = faireRes(); await compteMod(req(o), r); return r; };
  const A_ = { authorization: 'Bearer aa.bb.A' }, P_ = { authorization: 'Bearer aa.bb.P' };
  const ecrits = () => stripe.filter((x) => x.m === 'POST' && x.chemin.startsWith('subscriptions/'));
  const ajouter = (uid, extra = {}) => appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { action: 'ajouter-sup', uid, ...extra } });
  const PRIX_SUP = { id: 'price_sup', lookup_key: 'vrm_compte_sup', unit_amount: 300, currency: 'eur', recurring: { interval: 'month', interval_count: 1 }, active: true };

  // Prix absent ⇒ « bientôt », rien d'achetable, rien chez Stripe.
  reset();
  let r = await appel({ mode: 'abonnement', headers: A_ });
  const cs = r.corps && r.corps.offres && r.corps.offres.compteSup;
  dire(r.code === 200 && cs && cs.ouvert === false && cs.prixCentimes === 300 && cs.raison === undefined && r.corps.comptesSup && r.corps.comptesSup.payes === 0,
    'prix `vrm_compte_sup` absent : offre fermée (« bientôt »), la valeur 3 € dite, la raison ne part pas au vendeur', JSON.stringify({ cs, sup: r.corps && r.corps.comptesSup }));
  r = await appel({ mode: 'abonnement', headers: P_ });
  dire(r.corps && r.corps.offres.compteSup.raison === 'sans-prix-stripe' && r.corps.offres.compteSup.cle === 'vrm_compte_sup', 'propriétaire : il lit le geste (prix à créer, clé `vrm_compte_sup`)', JSON.stringify(r.corps && r.corps.offres.compteSup));
  r = await ajouter('1008', { cgv: true });
  dire(r.code === 503 && r.corps.erreur === 'compte-sup-ferme' && ecrits().length === 0 && /rien n'a été prélevé/.test(r.corps.message), 'acheter sans prix Stripe : refusé (503), AUCUNE écriture chez Stripe, « rien n’a été prélevé »', `HTTP ${r.code} · ${r.corps && r.corps.message}`);

  // Prix présent mais pas 3 € ⇒ fermé.
  prixSup = { ...PRIX_SUP, unit_amount: 400 };
  r = await appel({ mode: 'abonnement', headers: P_ });
  dire(r.corps.offres.compteSup.ouvert === false && r.corps.offres.compteSup.raison === 'prix-different' && /4,00/.test(r.corps.offres.compteSup.texteStripe || ''), 'Stripe dit 4 € : fermé, le propriétaire voit le montant de Stripe', JSON.stringify(r.corps.offres.compteSup));
  r = await ajouter('1008', { cgv: true });
  dire(r.code === 503 && ecrits().length === 0, '  … et rien ne s’achète', `HTTP ${r.code}`);

  // Prix conforme.
  prixSup = { ...PRIX_SUP };
  r = await appel({ mode: 'abonnement', headers: A_ });
  dire(r.corps.offres.compteSup.ouvert === true && r.corps.offres.compteSup.texte === '3,00 € / mois', 'prix posé et Stripe dit 3 € : ouvert, montant lu chez Stripe', JSON.stringify(r.corps.offres.compteSup));
  r = await ajouter('5555', { cgv: true });
  dire(r.code === 403 && ecrits().length === 0, 'un compte Vinted qui n’est pas à lui : 403, rien chez Stripe', `HTTP ${r.code}`);
  r = await ajouter('1008');
  dire(r.code === 400 && r.corps.erreur === 'cgv' && ecrits().length === 0, 'sans les CGV cochées : refusé, rien chez Stripe', `HTTP ${r.code}`);
  r = await ajouter('1008', { cgv: true });
  let p = ecrits().pop();
  dire(r.code === 200 && p && p.corps.get('items[0][price]') === 'price_sup' && p.corps.get('items[0][quantity]') === '1' && p.corps.get('proration_behavior') === 'create_prorations' && p.corps.get('metadata[vrm_comptes_sup]') === '1008' && JSON.stringify(r.corps.comptesSup.liste) === '["1008"]',
    '1er compte de plus : un article `vrm_compte_sup` × 1 ajouté à SON abonnement, au prorata, le compte rangé et relu', p ? p.corps.toString().slice(0, 220) : 'aucun appel');
  r = await ajouter('1009', { cgv: true });
  p = ecrits().pop();
  dire(r.code === 200 && p && p.corps.get('items[0][id]') === 'si_sup' && p.corps.get('items[0][quantity]') === '2' && !p.corps.has('items[0][price]') && JSON.stringify(r.corps.comptesSup.liste) === '["1008","1009"]',
    '2e compte : la QUANTITÉ du même article passe à 2 (jamais un 2e abonnement)', p ? p.corps.toString().slice(0, 200) : '');
  const n = ecrits().length;
  r = await ajouter('1008', { cgv: true });
  dire(r.code === 200 && r.corps.inchange === true && ecrits().length === n, 'un compte qui vend déjà : rien écrit, rien facturé');
  r = await ajouter('1007', { cgv: true });
  dire(r.code === 200 && r.corps.inchange === true && ecrits().length === n, 'le compte inclus : rien à ajouter');

  // La liste ne dépasse JAMAIS la quantité payée.
  sub.metadata.vrm_comptes_sup = '1008,1009,1010';   // glissée à la main, quantité 2
  r = await appel({ mode: 'abonnement', headers: A_ });
  dire(JSON.stringify(r.corps.comptesSup.liste) === '["1008","1009"]' && r.corps.comptesSup.payes === 2 && r.corps.comptesSup.libres === 0, 'une liste plus longue que la quantité payée (2) : l’app ne reçoit que les 2 payés', JSON.stringify(r.corps.comptesSup));
  sub.metadata.vrm_comptes_sup = '1008,1009';
  // Webhook ⇒ la ligne (bilans, notifications) porte les payés seulement.
  const SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const signer = (c) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${crypto.createHmac('sha256', SECRET).update(`${t}.${c}`).digest('hex')}`; };
  const objet = { ...sub, metadata: { ...sub.metadata, vrm_comptes_sup: '1008,1009,1010' } };
  const c = JSON.stringify({ id: 'evt_sup', type: 'customer.subscription.updated', created: 500, livemode: false, data: { object: objet } });
  r = await appel({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c });
  const cv = abos[A].comptes_vendeurs || {};
  dire(r.code === 200 && JSON.stringify(cv.vinted_sup) === '["1008","1009"]', 'webhook : la ligne `abonnements.comptes_vendeurs.vinted_sup` ne porte que les 2 payés', JSON.stringify(cv));
  PV.oublierPlans();
  dire(await PV.venteHorsPlanServeur(A, '1009') === false && await PV.venteHorsPlanServeur(A, '1010') === true && await PV.venteHorsPlanServeur(A, '1007') === false,
    'serveur (notifications, bilans) : le 2e compte payé sonne, le 3e (non payé) non');
  PV.oublierPlans();

  // Place libre (quantité 3, 2 comptes) ⇒ rien facturé.
  sub.items.data = sub.items.data.map((x) => (x.id === 'si_sup' ? { ...x, quantity: 3 } : x));
  r = await ajouter('1010', { cgv: true });
  p = ecrits().pop();
  dire(r.code === 200 && p && !p.corps.has('items[0][id]') && !p.corps.has('items[0][price]') && JSON.stringify(r.corps.comptesSup.liste) === '["1008","1009","1010"]', 'une place déjà payée et libre : seulement rangé, rien facturé', p ? p.corps.toString().slice(0, 160) : '');

  // Retirer ⇒ la quantité redescend ; à 0 l'article part.
  r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { action: 'retirer-sup', uid: '1009' } });
  p = ecrits().pop();
  dire(r.code === 200 && p.corps.get('items[0][id]') === 'si_sup' && p.corps.get('items[0][quantity]') === '2' && p.corps.get('proration_behavior') === 'create_prorations' && JSON.stringify(r.corps.comptesSup.liste) === '["1008","1010"]', 'retirer un compte : il ne vend plus, la quantité suit (2), au prorata', p.corps.toString().slice(0, 160));
  await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { action: 'retirer-sup', uid: '1008' } });
  r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { action: 'retirer-sup', uid: '1010' } });
  p = ecrits().pop();
  dire(r.code === 200 && p.corps.get('items[0][deleted]') === 'true' && !sub.items.data.some((x) => x.id === 'si_sup') && r.corps.comptesSup.payes === 0, 'le dernier retiré : l’article part de l’abonnement (plus rien facturé)', p.corps.toString().slice(0, 160));

  // Pro : illimité, rien à ajouter ; vers Pro l'article part.
  reset(); prixSup = { ...PRIX_SUP };
  await ajouter('1008', { cgv: true });
  process.env.STRIPE_PRIX_PRO = 'price_pro';
  r = await appel({ method: 'POST', mode: 'changer-plan', headers: A_, corps: { plan: 'pro', cgv: true } });
  p = ecrits().pop();
  dire(r.code === 200 && p && p.corps.get('items[1][id]') === 'si_sup' && p.corps.get('items[1][deleted]') === 'true' && !sub.items.data.some((x) => x.id === 'si_sup'), 'Solo → Pro : l’article des comptes de plus part (jamais de supplément en Pro)', p ? p.corps.toString().slice(0, 200) : '');
  const nP = ecrits().length;
  r = await ajouter('1009', { cgv: true });
  dire(r.code === 409 && r.corps.erreur === 'pro' && ecrits().length === nP, 'en Pro : ajouter un compte est refusé (409), rien chez Stripe');
  r = await appel({ mode: 'abonnement', headers: A_ });
  dire(r.corps.plan === 'pro' && r.corps.comptesSup === null, 'en Pro, `mode=abonnement` ne rend aucune liste de comptes de plus');
  delete process.env.STRIPE_PRIX_PRO;
  r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: P_, corps: { action: 'ajouter-sup', uid: '1008', cgv: true } });
  dire(r.code === 409 && r.corps.erreur === 'proprietaire', 'propriétaire : rien à acheter');
  // Sans compte inclus.
  reset(); prixSup = { ...PRIX_SUP }; delete sub.metadata.vrm_compte_vendeur;
  r = await ajouter('1008', { cgv: true });
  dire(r.code === 409 && r.corps.erreur === 'sans-compte-inclus' && ecrits().length === 0, 'Solo sans compte inclus choisi : il le choisit d’abord, rien facturé');
  // Le plafond.
  reset(); prixSup = { ...PRIX_SUP };
  vintedDe[A] = Array.from({ length: 30 }, (_, i) => String(3000 + i)).concat(['1007']);
  sub.items.data.push({ id: 'si_sup', quantity: 20, price: { ...PRIX_SUP } });
  sub.metadata.vrm_comptes_sup = Array.from({ length: 20 }, (_, i) => String(3000 + i)).join(',');
  r = await ajouter('3025', { cgv: true });
  dire(r.code === 409 && r.corps.erreur === 'max' && ecrits().length === 0, '20 comptes de plus au plus (métadonnée Stripe 500 caractères) : le 21e est refusé, Pro proposé', `HTTP ${r.code}`);
}

const MUTATIONS_ROUTE = [
  ['achat sans prix Stripe', (s) => s.replace("if (!offre.ouvert) return repondre(res, 503, { erreur: 'compte-sup-ferme'", "if (false) return repondre(res, 503, { erreur: 'compte-sup-ferme'")],
  ['place gratuite au-delà de la quantité', (s) => s.replace('if (liste.length < s0.payes) {', 'if (true) {')],
  ['CGV non exigées', (s) => s.replace("if (corps.cgv !== true) return repondre(res, 400, { erreur: 'cgv', message: \"Coche « J'accepte les conditions générales de vente » avant d'ajouter un compte.\" });", '')],
  ['compte d’un autre accepté', (s) => s.replace("if (ajouter && !siens.has(uid)) return", "if (false) return")],
  ['supplément gardé en Pro', (s) => s.replace("const supId = cible === PLAN_PRO && lu.comptesSup && lu.comptesSup.articleId;", 'const supId = null;')],
  ['webhook range la liste brute', (s) => s.replace('if (sup && Array.isArray(sup.liste) && sup.liste.length) o.vinted_sup = sup.liste.slice();', "if (sup && Array.isArray(sup.liste)) o.vinted_sup = ['1008','1009','1010'];")],
];

(async () => {
  const PROUVE = process.argv.includes('--prouve');
  let ok = 0, ko = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); } };
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_banc_sup'; process.env.STRIPE_SECRET_KEY = 'sk_test_banc'; process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  delete process.env.STRIPE_PRIX_PRO; delete process.env.STRIPE_PRIX_COMPTE_SUP;

  console.log('── 1. La règle');
  const R = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-regle.js'));
  await essaie('règle', () => controlesRegle(R, dit));

  console.log('── 2. Le serveur (api/compte.js exécuté)');
  const PV = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-vendeur.js'));
  let compte = null;
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; } catch (e) { dit(false, 'api/compte.js se charge', e.message); }
  if (compte) await essaie('serveur', () => controlesServeur(compte, PV, dit));

  console.log('── 3. L’app : l’état suit le serveur');
  await essaie('app', async () => {
    const mem = {}; global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
    const E = await import('file://' + path.join(RACINE, 'src', 'abonnement', 'etatAbonnement.js'));
    const P = await import('file://' + path.join(RACINE, 'src', 'abonnement', 'planVentes.js'));
    P.demarrerPlan('uid-sup');
    E.publierAbonnement({ ok: true, plan: 'solo', compteVendeur: { uid: '7' }, comptesSup: { payes: 1, liste: ['8'], libres: 0 } });
    dit(!P.venteHorsPlanUid('8') && P.venteHorsPlanUid('9') && /"8"/.test(mem['vrm_plan_regle_uid-sup'] || ''), 'app : le compte de plus rendu par le serveur vend, l’autre non ; gardé sur l’appareil', P.signaturePlan());
    P.demarrerPlan('uid-sup');
    dit(!P.venteHorsPlanUid('8') && P.venteHorsPlanUid('9'), 'à la réouverture, la règle gardée sur l’appareil garde le compte de plus');
    E.publierAbonnement({ ok: true, plan: 'pro', comptesSup: { liste: ['8'] } });
    dit(P.signaturePlan() === 'libre' && !P.venteHorsPlanUid('9'), 'Pro : libre');
  });

  console.log('── 4. Une valeur : CGV, écran, accueil');
  await essaie('valeur unique', async () => {
    const cgv = lire('public/legal/cgv.html'), cpt = lire('api/compte.js');
    const euros = R.prixCompteSupTexte().replace(' ', ' ');
    dit(cgv.includes(`compte Vinted vendeur de plus » : ${euros} par mois et par compte`) && cgv.includes(`chacun pour ${euros} par mois`), `CGV : l’option dit ${euros} par mois (la constante)`, euros);
    dit(/Dernière mise à jour : 13 novembre 2026/.test(cgv) && /const CGV_VERSION = '2026-11-13'/.test(cpt), 'CGV du 13 novembre, version acceptée à jour');
    dit(/il ne peut pas être dépassé/.test(cgv) && /elle n’existe pas en Pro/.test(cgv), 'CGV : la quantité payée est la limite ; Pro inchangé (illimité)');
    const plans = sansCommentaires(lire('src/abonnement/PlansSoloPro.jsx')), reg = sansCommentaires(lire('src/ecrans/Reglages.jsx')), acc = sansCommentaires(lire('src/Accueil.jsx'));
    dit(!/[+]\s?3\s?€|3,00 €|3 € \/ mois/.test(plans + reg) && /texteSup\(/.test(plans) && /texteSup\(/.test(reg), 'écran : aucun « 3 € » écrit en dur (Paramètres, feuille, aperçu des ventes)');
    dit(/OFFRES\.solo\.supplement/.test(acc) && /OFFRES\.solo\.supplement/.test(plans), 'accueil et offres de Paramètres : la phrase `OFFRES.solo.supplement`');
    dit(/PRIX_COMPTE_SUP_CGV = \{ centimes: PRIX_COMPTE_SUP_CENTIMES/.test(cpt), 'serveur : la conformité du prix Stripe compare à la constante');
    const nApi = fs.readdirSync(path.join(RACINE, 'api')).filter((f) => f.endsWith('.js')).length;
    dit(nApi <= 12, 'toujours 12 fonctions `api/` au plus', String(nApi));
  });

  if (PROUVE) {
    console.log('── Mutations (chacune doit être rouge)');
    const src = lire('api/_lib/plan-regle.js');
    for (const [nom, f] of MUTATIONS_REGLE) {
      const m = f(src);
      if (m === src) { dit(false, `mutation « ${nom} » applicable`, 'le texte visé a changé'); continue; }
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sup-mut-'));
      fs.writeFileSync(path.join(dir, 'plan-regle.mjs'), m);
      let rouges = 0;
      try { const RM = await import('file://' + path.join(dir, 'plan-regle.mjs')); await controlesRegle(RM, (c) => { if (!c) rouges++; }); } catch (_) { rouges++; }
      finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
      dit(rouges > 0, `mutation « ${nom} » ⇒ rouge`, `${rouges} rouge(s)`);
    }
    const srcC = lire('api/compte.js');
    for (const [i, [nom, f]] of MUTATIONS_ROUTE.entries()) {
      const m = f(srcC);
      if (m === srcC) { dit(false, `mutation « ${nom} » applicable`, 'le texte visé a changé'); continue; }
      const fichier = path.join(RACINE, 'api', `.mut-sup-${process.pid}-${i}.js`);
      let rouges = 0;
      try {
        fs.writeFileSync(fichier, m);
        const CM = (await import('file://' + fichier)).default;
        await controlesServeur(CM, PV, (c) => { if (!c) rouges++; });
      } catch (_) { rouges++; } finally { try { fs.unlinkSync(fichier); } catch (_) {} }
      dit(rouges > 0, `mutation « ${nom} » ⇒ rouge`, `${rouges} rouge(s)`);
    }
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-comptes-sup : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
