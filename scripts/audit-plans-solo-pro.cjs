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
//   4. les notifications de vente d'un compte d'achat ne partent pas ;
//   6. (9 nov., soir) SOLO PAR PLATEFORME : un compte vendeur Leboncoin, eBay,
//      Vestiaire — deux comptes de chaque, Solo / Pro / ancien Solo / pas su ;
//      le prédicat des totaux (`excluAutreDe(v, regle)`), la route, le webhook (030).
//   7. (10 nov., 20 h) PRO ILLIMITÉ — Julien : « on fait un nombre de comptes de vente
//      illimité » (annule les 10 comptes du lot BO) : 50 comptes par plateforme, une
//      liste de 10 restée dans Stripe, dans la ligne ou dans la réponse ⇒ AUCUN écarté.
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
  await controlesAutres(R, dire);
  await controlesProIllimite(R, dire);
}

// ── 7. (10 nov., 20 h) PRO ILLIMITÉ : 50 comptes par plateforme, aucun n'est écarté ──
// Une liste de 10 « comptes vendeurs Pro » laissée par le lot BO (métadonnées Stripe
// `vrm_pro_vendeurs`, `comptes_vendeurs.pro` de la ligne, `comptesPro` d'une réponse)
// ne doit RIEN brider. Solo, lui, reste bridé (contrôlé plus haut).
async function controlesProIllimite(R, dire) {
  const N = 50;
  const ids = {
    vinted: Array.from({ length: N }, (_, i) => String(2000 + i)),
    leboncoin: Array.from({ length: N }, (_, i) => String(8443000 + i)),
    ebay: ['principal', ...Array.from({ length: N - 1 }, (_, i) => ('e' + i.toString(16)).padStart(16, '0'))],
    vestiaire: Array.from({ length: N }, (_, i) => 'vc' + (500 + i)),
  };
  const abr = { vinted: 'v', leboncoin: 'l', ebay: 'e', vestiaire: 'c' };
  const dix = [];
  for (const p of Object.keys(ids)) for (const id of ids[p].slice(0, p === 'vinted' ? 4 : 2)) dix.push({ plateforme: p, id });
  const cles = dix.map((d) => d.plateforme + ':' + d.id);
  const meta = { cgv_version: '2026-11-10', vrm_pro_vendeurs: dix.map((d) => abr[d.plateforme] + ':' + d.id).join(','), vrm_pro_vendeurs_le: '2026-11-10T18:00:00Z', vrm_compte_vendeur: ids.vinted[0] };
  const lu = R.planDeLAbonnement({ items: { data: [{ id: 'si', quantity: 1, price: { id: 'price_pro', lookup_key: null } }] }, metadata: meta }, { prixPro: 'price_pro' });
  const regles = {
    'liste rendue par le serveur (`comptesPro`)': R.regleVentes({ plan: 'pro', compteVendeur: { uid: ids.vinted[0] }, comptesPro: { liste: dix } }),
    'liste dans la ligne (`comptes_vendeurs.pro`)': R.regleVentes({ plan: 'pro', comptesVendeurs: { pro: cles, leboncoin: { id: ids.leboncoin[0] }, ebay: { id: 'principal' }, vestiaire: { id: ids.vestiaire[0] } } }),
    'liste dans les métadonnées Stripe': R.regleVentes({ plan: lu.plan, compteVendeur: { uid: lu.vendeur }, comptesVendeurs: { ...(lu.autres || {}), pro: lu.pro && lu.pro.liste }, comptesPro: lu.pro }),
  };
  for (const [nom, r] of Object.entries(regles)) {
    let ecartees = 0, total = 0;
    for (const uid of ids.vinted) { total++; if (R.venteHorsPlan(r, uid)) ecartees++; }
    for (const p of ['leboncoin', 'ebay', 'vestiaire']) for (const c of ids[p]) { total++; if (R.venteAutreHorsPlan(r, p, c)) ecartees++; }
    const hors = R.comptesHorsPlan(r, ids.vinted.map((uid) => ({ uid }))).length;
    dire(r.plan === 'pro' && ecartees === 0 && hors === 0 && !R.brideAutres(r) && R.signatureRegle(r) === 'libre',
      `Pro illimité : ${N} comptes par plateforme (${total}), ${nom} ⇒ aucun compte vendeur écarté`, `${ecartees} écartée(s) sur ${total}, ${hors} compte(s) Vinted « hors offre », signature ${R.signatureRegle(r)}`);
  }
  dire(lu.plan === 'pro' && !('pro' in lu && lu.pro) && !lu.proAncien, 'l’abonnement Pro lu chez Stripe ne porte aucune liste de comptes (une liste glissée dans les métadonnées ne décide rien)', JSON.stringify({ plan: lu.plan, pro: lu.pro }));
  dire(!/10 comptes|dix comptes|Jusqu’à \d+ comptes/i.test(R.OFFRES.pro.phrase) && /illimit/i.test(R.OFFRES.pro.phrase), 'l’offre Pro dit « illimités », jamais un nombre de comptes', R.OFFRES.pro.phrase);
  const limite = ['MAX_VENDEURS_PRO', 'listeVendeursPro', 'etatVendeursPro', 'CGV_PRO_DIX_DEPUIS'].filter((k) => k in R);
  dire(limite.length === 0, 'plus aucune limite de comptes Pro dans la règle', limite.join(', '));
}

// ── (9 nov., soir) SOLO PAR PLATEFORME : deux comptes Leboncoin, deux eBay, deux Vestiaire ──
// Chaque plateforme a un compte vendeur (choisi) et un compte d'achat ; chaque vente vaut 10 €.
// L'attendu est la phrase de Julien : Solo = un compte vendeur PAR plateforme ; Pro = tous ;
// un Solo d'avant le 9 nov. et « pas su » ne brident jamais.
const DEUX = { leboncoin: ['8442001', '8442002'], ebay: ['principal', '0123456789abcdef'], vestiaire: ['vc111', 'vc222'] };
async function controlesAutres(R, dire) {
  if (typeof R.venteAutreHorsPlan !== 'function') { dire(false, 'plan-regle porte `venteAutreHorsPlan` (Solo par plateforme)', 'absente'); return; }
  const somme = (r) => { let t = 0; for (const p of Object.keys(DEUX)) for (const c of DEUX[p]) if (!R.venteAutreHorsPlan(r, p, c)) t += 10; return t; };
  const choix = { leboncoin: { id: 'lbc-account:8442001' }, ebay: { id: 'principal' }, vestiaire: { id: 'vc111' } };
  const solo = R.regleVentes({ plan: 'solo', compteVendeur: { uid: '1007' }, comptesVendeurs: choix });
  dire(somme(solo) === 30 && ['leboncoin', 'ebay', 'vestiaire'].every((p) => !R.venteAutreHorsPlan(solo, p, DEUX[p][0]) && R.venteAutreHorsPlan(solo, p, DEUX[p][1])),
    'Solo par plateforme : deux comptes Leboncoin, deux eBay, deux Vestiaire ⇒ seul le compte vendeur de chacune compte (30 € sur 60)', `${somme(solo)} €`);
  dire(!R.venteAutreHorsPlan(solo, 'leboncoin', 'lbc-account:8442001') && R.venteAutreHorsPlan(solo, 'leboncoin', 'lbc-account:8442002'), 'Leboncoin : `8442…` et `lbc-account:8442…` sont le même compte');
  const pro = R.regleVentes({ plan: 'pro', compteVendeur: { uid: '1007' }, comptesVendeurs: choix });
  dire(somme(pro) === 60, 'Pro : toutes les ventes de tous les comptes de chaque plateforme', `${somme(pro)} €`);
  const pasSu = [R.regleVentes(null), R.regleVentes({ plan: null, comptesVendeurs: choix }), R.regleVentes({ plan: 'gold', comptesVendeurs: choix })];
  dire(pasSu.every((r) => somme(r) === 60), 'plan « pas su » ⇒ rien bridé sur aucune plateforme', pasSu.map(somme).join(' · '));
  const prop = R.regleVentes({ proprietaire: true, plan: 'solo', comptesVendeurs: choix });
  dire(somme(prop) === 60, 'propriétaire : Pro sur toutes les plateformes', `${somme(prop)} €`);
  const sansChoix = R.regleVentes({ plan: 'solo', compteVendeur: { uid: '1007' }, comptesVendeurs: { leboncoin: { id: '8442001' } } });
  dire(somme(sansChoix) === 50 && !R.venteAutreHorsPlan(sansChoix, 'ebay', DEUX.ebay[1]), 'Solo sans choix sur eBay et Vestiaire : tous leurs comptes comptent (seul Leboncoin est bridé)', `${somme(sansChoix)} €`);
  dire(!R.venteAutreHorsPlan(solo, 'vestiaire', '-') && !R.venteAutreHorsPlan(solo, 'vestiaire', '') && !R.venteAutreHorsPlan(solo, 'leboncoin', null) && !R.venteAutreHorsPlan(solo, 'ebay', 'pseudo eBay'),
    'une vente sans compte relevé (Vestiaire « non identifié », Leboncoin sans compte, un pseudo) n’est jamais écartée');
  // L'abonnement : les métadonnées que VRM pose ; un Solo d'avant le 9 nov. ne bride rien.
  const sub = (cgv) => ({ items: { data: [{ id: 'si', quantity: 1, price: { id: 'price_s', lookup_key: 'vrm_mensuel' } }] },
    metadata: { cgv_version: cgv, vrm_vendeur_leboncoin: '8442001', vrm_vendeur_ebay: 'principal', vrm_vendeur_vestiaire: 'vc111', vrm_vendeur_ebay_le: '2026-11-09T10:00:00Z' } });
  const lu = R.planDeLAbonnement(sub('2026-11-09'), { prixPro: 'price_pro' });
  const ancien = R.planDeLAbonnement(sub('2026-11-08'), { prixPro: 'price_pro' });
  const rLu = R.regleVentes({ plan: lu.plan, comptesVendeurs: { leboncoin: lu.autres && lu.autres.leboncoin, ebay: lu.autres && lu.autres.ebay, vestiaire: lu.autres && lu.autres.vestiaire } });
  const rAncien = R.regleVentes({ plan: ancien.plan, comptesVendeurs: ancien.autres });
  dire(lu.plan === 'solo' && lu.autres && lu.autres.ebay && lu.autres.ebay.id === 'principal' && lu.autres.ebay.le === '2026-11-09T10:00:00Z' && somme(rLu) === 30,
    'abonnement Stripe : le compte vendeur de chaque plateforme lu des métadonnées VRM (`vrm_vendeur_{plateforme}`), sa date aussi', JSON.stringify(lu.autres));
  dire(ancien.plan === null && somme(rAncien) === 60, 'Solo souscrit sous les CGV d’avant le 9 nov. ⇒ jamais bridé, même avec des comptes vendeurs posés', `${somme(rAncien)} €`);
  dire(R.compteDefautAutre('leboncoin', DEUX.leboncoin, ['8442002', 'lbc-account:8442002', '8442001']) === '8442002'
    && R.compteDefautAutre('ebay', DEUX.ebay, ['principal', DEUX.ebay[1]]) === null && R.compteDefautAutre('vestiaire', DEUX.vestiaire, null) === null,
    'compte proposé par plateforme : le plus de ventes lues, strictement ; égalité ou ventes pas lues ⇒ rien');
  const s1 = R.signatureRegle(solo), s2 = R.signatureRegle(R.regleVentes({ plan: 'solo', compteVendeur: { uid: '1007' }, comptesVendeurs: { ...choix, ebay: { id: DEUX.ebay[1] } } }));
  dire(s1 !== s2 && R.signatureRegle(pro) === 'libre' && R.signatureRegle(R.regleVentes({ plan: 'solo', compteVendeur: '7' })) === 'solo:7', 'la signature change avec le compte vendeur de CHAQUE plateforme (l’app se remonte)', `${s1} ≠ ${s2}`);
}

// ── Les mutations (--prouve) : chacune affaiblit la règle ; il faut du rouge ──
const MUTATIONS = [
  ['autre plateforme : compte vendeur ignoré', (s) => s.replace("return !!c && c !== choisi;", 'return !!c;')],
  ['autre plateforme : bridée hors Solo (Pro, pas su)', (s) => s.replace("autres[p] = plan === PLAN_SOLO && id ? id : null;", 'autres[p] = id || null;').replace("if (!regle || regle.plan !== PLAN_SOLO || !regle.autres", 'if (!regle || !regle.autres')],
  ['Vestiaire « non identifié » écarté', (s) => s.replace("return s !== '-' && /^[\\w-]{1,40}$/.test(s) ? s : null;", "return /^[\\w-]{1,40}$/.test(s) ? s : (s === '' ? null : s);")],
  ['Leboncoin : lbc-account: pas reconnu', (s) => s.replace("const id = s.replace(/^lbc-account:/i, '');", 'const id = s;')],
  ['métadonnées des autres plateformes ignorées', (s) => s.replace("const k = META_VENDEUR[pl], id = idCompteVendeur(pl, m[k]);", 'const k = META_VENDEUR[pl], id = null;')],
  ['venteHorsPlan ignore le compte vendeur', (s) => s.replace("return uidValide(u) && u !== regle.vendeur;", 'return uidValide(u);')],
  ['bride sans compte choisi', (s) => s.replace("bride: plan === PLAN_SOLO && !!vendeur", 'bride: plan === PLAN_SOLO')],
  ['propriétaire bridé', (s) => s.replace("if (x.proprietaire === true) return { plan: PLAN_PRO, vendeur: null, bride: false, autres: AUTRES_LIBRES };", '')],
  ['CGV d’avant bridées', (s) => s.replace("if (plan === PLAN_SOLO && !(String(m.cgv_version || '') >= CGV_PLANS_DEPUIS)) { plan = null; raison = 'cgv-anterieures'; }", '')],
  ['pas su ⇒ Solo', (s) => s.replace("const plan = x.plan === PLAN_PRO || x.plan === PLAN_SOLO ? x.plan : null;", "const plan = x.plan === PLAN_PRO ? x.plan : PLAN_SOLO;")],
  ['Pro limité à 10 comptes Vinted', (s) => s.replace("if (!regle || regle.bride !== true || !regle.vendeur) return false;", "if (regle && regle.plan === PLAN_PRO) { const n = Number(uidDe(uid)); return Number.isFinite(n) && n >= 2010; }\n  if (!regle || regle.bride !== true || !regle.vendeur) return false;")],
  ['Pro : comptes vendeurs des autres plateformes appliqués', (s) => s.replace("autres[p] = plan === PLAN_SOLO && id ? id : null;", "autres[p] = plan && id ? id : null;").replace("if (!regle || regle.plan !== PLAN_SOLO || !regle.autres", "if (!regle || !regle.plan || !regle.autres")],
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
    // (9 nov., suites serveur) La règle est PURE (`compteEcarteRegle`, la règle de l'offre en
    // argument — recopiée telle quelle dans api/_lib/ventes-regle.js) ; `compteEcarte` lui passe
    // la règle courante de l'app. Exécutée app = serveur : audit-bilan-semaine, audit-suites-serveur.
    dit(/const compteEcarteRegle = \(uid, masques, panneau, regle\) => compteEcarteChoix\(uid, masques, panneau\) \|\| venteHorsPlan\(regle, uid\);/.test(app)
      && /const compteEcarte = \(uid, masques, panneau\) => compteEcarteRegle\(uid, masques, panneau, reglePlanCourante\(\)\);/.test(app), 'les totaux des ventes (`compteEcarte`) écartent les comptes hors offre');
    dit(/return compteEcarteChoix\(uid, hiddenAccts, panelAcctOff\);/.test(app) && /const buysBase = useMemo\(\(\) => (?:avecRemboursementsProuves\()?\(buys\.items \|\| \[\]\)\.filter\(o => !acctOffOf\(o\)\)/.test(app),
      'les ACHATS d’un compte d’achat restent (acctOff = le choix seul, sans l’offre)');
    dit(/exclu: \(o\) => compteEcarteChoix\(o && o\._uid/.test(compta), 'Compta → registre des achats : les achats des comptes d’achat comptent');
    dit((/const isHidden = \(o\) => hiddenSales\.has\(String\(o\.transaction_id\)\) \|\| venteOffOf\(o\);/.test(app) || (/const isHiddenCalcul = \(o\) => hiddenSales\.has\(String\(o\.transaction_id\)\) \|\| venteOffOf\(o\);/.test(app) && /const isHidden = \(o\) => \{[^\n]*isHiddenCalcul\(o\)[^\n]*\};/.test(app))) && /const venteOffOf = \(o\) => acctOffOf\(o\) \|\| horsPlanOf\(o\);/.test(app),
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
  let abos, stripe, sub, prixPro, vintedDe, colonne028, colonne030, autresDe;
  const reset = () => {
    abos = { [A]: { statut: 'active', client_stripe: 'cus_A', abonnement_stripe: 'sub_A', fin_periode: null, annule_fin_periode: false } };
    stripe = []; prixPro = { id: 'price_pro', unit_amount: 1999, currency: 'eur', recurring: { interval: 'month', interval_count: 1 }, active: true };
    sub = { id: 'sub_A', status: 'active', customer: 'cus_A', metadata: { owner: A, cgv_version: '2026-11-09' }, items: { data: [{ id: 'si_A', quantity: 1, price: { id: 'price_solo', lookup_key: 'vrm_mensuel', unit_amount: 1699, currency: 'eur', recurring: { interval: 'month' } } }] } };
    vintedDe = { [A]: ['1007', '1008'] }; colonne028 = true; colonne030 = true;
    // (9 nov., soir) Ses comptes des autres plateformes, à la forme réelle de `app_data`.
    autresDe = { [A]: {
      lbc_accounts: { accounts: { 'lbc-account:8442001': { id: 'lbc-account:8442001', name: 'boutique' }, '8442002': { id: '8442002', name: 'achats' } } },
      ebay_comptes: { comptes: [{ principal: true, pseudo: 'vend' }, { cle: '0123456789abcdef', pseudo: 'achete' }] },
      vc_session: { id: 'vc111', comptes: { vc111: '2026-11-09', vc222: '2026-11-08' } },
    } };
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
        if (!colonne030 && lignes.some((l) => 'comptes_vendeurs' in l)) return rep({ code: 'PGRST204', message: "Could not find the 'comptes_vendeurs' column of 'abonnements' in the schema cache" }, 400);
        if (!colonne028 && lignes.some((l) => 'plan' in l || 'compte_vendeur' in l)) return rep({ code: 'PGRST204', message: "Could not find the 'plan' column of 'abonnements' in the schema cache" }, 400);
        for (const l of lignes) abos[l.owner] = { ...(abos[l.owner] || {}), ...l }; return rep('', 201);
      }
      if (m === 'PATCH') {   // (11 nov., H18) l'écriture conditionnelle de ecrireStatut
        const c = JSON.parse(opts.body);
        if (!colonne030 && 'comptes_vendeurs' in c) return rep({ code: 'PGRST204', message: "Could not find the 'comptes_vendeurs' column of 'abonnements' in the schema cache" }, 400);
        if (!colonne028 && ('plan' in c || 'compte_vendeur' in c)) return rep({ code: 'PGRST204', message: "Could not find the 'plan' column of 'abonnements' in the schema cache" }, 400);
        const o = decodeURIComponent((/owner=eq\.([^&]+)/.exec(u) || [])[1] || ''), l = abos[o];
        const cond = [...u.matchAll(/[?&](evenement_ts|maj)=(eq\.[^&]*|is\.null)/g)].every(([, k, v]) => (v === 'is.null' ? !l || l[k] == null : String(l[k]) === decodeURIComponent(v.slice(3))));
        if (!l || !cond) return rep([]);
        abos[o] = { ...l, ...c }; return rep([{ owner: o }]);
      }
      if (qui) return rep(abos[qui.id] ? [abos[qui.id]] : []);
      const o = (/owner=eq\.([^&]+)/.exec(u) || [])[1], c = (/client_stripe=eq\.([^&]+)/.exec(u) || [])[1];
      if (/select=statut,plan,compte_vendeur/.test(u) && !colonne028) return rep({ code: '42703' }, 400);
      if (/comptes_vendeurs/.test(u) && !colonne030) return rep({ code: '42703', message: 'column abonnements.comptes_vendeurs does not exist' }, 400);
      if (o) {
        const id = decodeURIComponent(o);
        if (!abos[id]) return rep([]);
        // Projection : une colonne non demandée ne revient pas (la forme de PostgREST).
        const l = { ...abos[id], owner: id };
        if (/select=/.test(u) && !/comptes_vendeurs/.test(u)) delete l.comptes_vendeurs;
        return rep([l]);
      }
      if (c) { const e = Object.entries(abos).find(([, l]) => l.client_stripe === decodeURIComponent(c)); return rep(e ? [{ owner: e[0] }] : []); }
      return rep([]);
    }
    if (u.includes('/rest/v1/vinted_accounts')) { const o = qui ? qui.id : decodeURIComponent((/owner=eq\.([^&]+)/.exec(u) || [])[1] || ''); return rep((vintedDe[o] || []).map((v) => ({ vinted_user_id: v }))); }
    if (u.includes('/rest/v1/essais_gratuits')) return rep([]);
    if (u.includes('/rest/v1/app_data')) {
      // Lu avec SON jeton (RLS) : seulement ses lignes ; la projection de la route.
      if (!qui) return rep([]);
      const id = decodeURIComponent((/[?&]id=eq\.([^&]+)/.exec(u) || [])[1] || '');
      const d = (autresDe[qui.id] || {})[id];
      if (!d) return rep([]);
      if (id === 'lbc_accounts') return rep([{ a: d.accounts }]);
      if (id === 'ebay_comptes') return rep([{ comptes: d.comptes }]);
      if (id === 'vc_session') return rep([{ id: d.id, comptes: d.comptes }]);
      return rep([]);
    }
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

  console.log('── 6. Solo par plateforme : un compte vendeur Leboncoin, eBay, Vestiaire');
  await essaie('totaux (prédicat de l’app et du serveur)', async () => {
    const E = await import('file://' + path.join(RACINE, 'api', '_lib', 'comptes-exclus.js'));
    const R = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-regle.js'));
    const ventes = [
      ['leboncoin', { account: 'lbc-account:8442001' }], ['leboncoin', { account: '8442002' }], ['leboncoin', { account: '' }],
      ['ebay', { _compte: 'principal' }], ['ebay', { _compte: '0123456789abcdef' }],
      ['vestiaire', { compte: 'vc111' }], ['vestiaire', { compte: 'vc222' }], ['vestiaire', { compte: '' }],
    ];
    const comptees = (f) => ventes.filter(([p, v]) => !(f && f(p, v))).length;
    const choix = { leboncoin: { id: '8442001' }, ebay: { id: 'principal' }, vestiaire: { id: 'vc111' } };
    const cas = {
      solo: R.regleVentes({ plan: 'solo', compteVendeur: { uid: '1007' }, comptesVendeurs: choix }),
      pro: R.regleVentes({ plan: 'pro', comptesVendeurs: choix }),
      ancien: R.regleVentes({ plan: null, comptesVendeurs: choix }),   // Solo d'avant le 9 nov. : le serveur rend plan null
      pasSu: null,
    };
    dit(comptees(E.excluAutreDe({}, cas.solo)) === 5, 'Solo : sur 8 ventes (2 comptes par plateforme + 2 sans compte relevé), 5 comptent — les comptes d’achat Leboncoin, eBay, Vestiaire sortent ; les ventes sans compte restent', String(comptees(E.excluAutreDe({}, cas.solo))));
    dit(E.excluAutreDe({}, cas.pro) === null && E.excluAutreDe({}, cas.ancien) === null && E.excluAutreDe({}, cas.pasSu) === null, 'Pro, ancien Solo, pas su : aucun prédicat (exactement le chemin d’avant : tout compte)');
    const avecChoix = E.excluAutreDe({ leboncoin: ['8442001'] }, cas.solo);
    dit(comptees(avecChoix) === 4, 'un compte écarté par SON choix (Comptes liés) s’ajoute à l’offre (même le compte vendeur)', String(comptees(avecChoix)));
    dit(comptees(E.excluAutreDe({ ebay: ['0123456789abcdef'] }, cas.pro)) === 7, 'Pro : le choix « hors totaux » de Comptes liés marche comme avant');
  });
  await essaie('état de l’app (autres plateformes)', async () => {
    const mem = {}; global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
    const E = await import('file://' + path.join(RACINE, 'src', 'abonnement', 'etatAbonnement.js'));
    const P = await import('file://' + path.join(RACINE, 'src', 'abonnement', 'planVentes.js'));
    const R = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-regle.js'));
    P.demarrerPlan('uid-banc-2');
    let n = 0; const stop = P.suivrePlan(() => n++);
    E.publierAbonnement({ ok: true, plan: 'solo', compteVendeur: null, comptesVendeurs: { leboncoin: { id: '8442001' } } });
    const r1 = P.reglePlanCourante();
    dit(n === 1 && R.venteAutreHorsPlan(r1, 'leboncoin', '8442002') && !R.venteAutreHorsPlan(r1, 'leboncoin', '8442001') && !P.venteHorsPlanUid('9'),
      'Solo sans compte Vinted, compte Leboncoin choisi : Leboncoin bridé, Vinted libre ; un signal de remontage', `${P.signaturePlan()} · ${n}`);
    dit(String(mem['vrm_plan_regle_uid-banc-2'] || '').includes('8442001'), 'le choix Leboncoin est gardé sur l’appareil (juste dès l’ouverture suivante)');
    E.publierAbonnement({ ok: true, plan: 'solo', compteVendeur: null, comptesVendeurs: { leboncoin: { id: '8442001' }, ebay: { id: 'principal' } } });
    dit(n === 2, 'choisir le compte eBay remonte l’app (la signature compte chaque plateforme)', String(n));
    E.publierAbonnement({ ok: true, plan: 'pro', comptesVendeurs: { leboncoin: { id: '8442001' } } });
    dit(P.signaturePlan() === 'libre' && !R.venteAutreHorsPlan(P.reglePlanCourante(), 'leboncoin', '8442002') && !mem['vrm_plan_regle_uid-banc-2'], 'passer à Pro rend tout, sur chaque plateforme');
    stop();
  });
  await essaie('câblage App.jsx (autres plateformes)', async () => {
    const app = sansCommentaires(lire('src/App.jsx'));
    const plans = sansCommentaires(lire('src/abonnement/PlansSoloPro.jsx'));
    const reg = sansCommentaires(lire('src/ecrans/Reglages.jsx'));
    dit(/return React\.useMemo\(\(\) => excluAutreDe\(v, reglePlanCourante\(\)\), \[v, sig\]\);/.test(app), 'les totaux (`useExcluAutre`, Ventes, Compta, Stats, coque) passent l’offre au prédicat des autres plateformes');
    dit(/const horsPlanAutre = \(plateforme, v\) => venteAutreHorsPlan\(reglePlanCourante\(\), plateforme, compteDeVente\(plateforme, v\)\);/.test(app)
      && (app.match(/hp: horsPlanAutre\('(leboncoin|ebay|vestiaire)', /g) || []).length === 3 && /<VentesAutresHorsPlan lignes=\{lignesHorsPlan/.test(app),
      'Ventes « Tous » : une vente d’un compte d’achat Leboncoin / eBay / Vestiaire sort de la liste et passe en aperçu (identité portée par la vente)');
    dit(/<BandeauCompteVendeur [^>]*autres=\{autresSolo\}/.test(app) && /data-quel-compte-plateforme=\{plateforme\}/.test(plans) && /ouvrirQuelCompte\(p\)/.test(reg),
      'le choix : la coque porte la feuille de chaque plateforme ; Paramètres → Abonnement a une rangée par plateforme');
    dit(/data-hors-plan-a-envoyer=\{b\.aEnvoyer\}/.test(plans) && /dont \$\{b\.aEnvoyer\} à envoyer \(dans Colis\)/.test(plans), 'l’aperçu DIT les colis à envoyer d’un compte d’achat (ils restent dans Colis)');
    // Les colis à envoyer ne lisent JAMAIS l'offre : `excluAutre` ne sert qu'aux totaux.
    const colis = lire('src/App.jsx').split('\n').filter((l) => /excluAutre/.test(l) && /colis|aPoster|aExpedier/i.test(l) && !/^\s*\/\//.test(l));
    dit(colis.length === 0, 'aucun calcul de colis à envoyer ne passe par le prédicat des totaux (un colis caché est un colis perdu)', colis.slice(0, 2).join(' | '));
  });
  if (compte) await essaie('route compte-vendeur (autres plateformes) et webhook 030', async () => {
    reset();
    const signer = (c) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${crypto.createHmac('sha256', SECRET).update(`${t}.${c}`).digest('hex')}`; };
    const envoyer = async (objet, ts) => { const c = JSON.stringify({ id: 'evt_x' + ts, type: 'customer.subscription.updated', created: ts, livemode: false, data: { object: objet } }); return appel({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }); };
    let r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { plateforme: 'leboncoin', id: '9999999' } });
    dit(r.code === 403 && postsStripe().length === 0, 'Leboncoin : un compte qui n’est pas à lui ⇒ refusé, rien chez Stripe', `HTTP ${r.code}`);
    r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { plateforme: 'tiktok', id: 'x' } });
    dit(r.code === 400, 'plateforme inconnue ⇒ refusée');
    r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { plateforme: 'leboncoin', id: '8442001' } });
    dit(r.code === 200 && sub.metadata.vrm_vendeur_leboncoin === '8442001' && r.corps.comptesVendeurs.leboncoin.id === '8442001', 'Leboncoin : son compte rangé dans SON abonnement (`vrm_vendeur_leboncoin`), relu', JSON.stringify(r.corps));
    r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { plateforme: 'ebay', id: '0123456789abcdef' } });
    const rv = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { plateforme: 'vestiaire', id: 'vc222' } });
    dit(r.code === 200 && rv.code === 200 && sub.metadata.vrm_vendeur_ebay === '0123456789abcdef' && sub.metadata.vrm_vendeur_vestiaire === 'vc222', 'eBay et Vestiaire : un geste chacun, le choix de Leboncoin ne bloque pas les autres (30 jours par plateforme)');
    const rvi = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { uid: '1007' } });
    dit(rvi.code === 200 && sub.metadata.vrm_compte_vendeur === '1007', 'Vinted garde son geste d’avant ({ uid }), indépendant des autres');
    const n = postsStripe().length;
    r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { plateforme: 'leboncoin', id: '8442002' } });
    dit(r.code === 429 && postsStripe().length === n && /Leboncoin/.test(r.corps.message) && /30 jours/.test(r.corps.message), 'changer de compte Leboncoin avant 30 jours : refusé, la date est dite, rien écrit', r.corps && r.corps.message);
    sub.metadata.vrm_vendeur_leboncoin_le = new Date(Date.now() - 31 * 864e5).toISOString();
    r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { plateforme: 'leboncoin', id: 'lbc-account:8442002' } });
    dit(r.code === 200 && sub.metadata.vrm_vendeur_leboncoin === '8442002' && sub.metadata.vrm_vendeur_leboncoin_avant === '8442001', 'après 30 jours : changé (l’ancien gardé ; `lbc-account:` reconnu)');
    r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: P_, corps: { plateforme: 'ebay', id: 'principal' } });
    dit(r.code === 409, 'propriétaire : rien à choisir (Pro)');
    r = await appel({ mode: 'abonnement', headers: A_ });
    dit(r.corps.comptesVendeurs && r.corps.comptesVendeurs.leboncoin.id === '8442002' && r.corps.comptesVendeurs.ebay.id === '0123456789abcdef' && r.corps.comptesVendeurs.vestiaire.id === 'vc222' && !!r.corps.comptesVendeurs.leboncoin.prochainChangement,
      'l’app relit le compte vendeur de chaque plateforme et son prochain changement', JSON.stringify(r.corps.comptesVendeurs));
    r = await envoyer({ ...sub }, 500);
    dit(r.code === 200 && abos[A].comptes_vendeurs && abos[A].comptes_vendeurs.leboncoin === '8442002' && abos[A].comptes_vendeurs.ebay === '0123456789abcdef' && abos[A].comptes_vendeurs.vestiaire === 'vc222' && abos[A].compte_vendeur === '1007',
      'webhook : `comptes_vendeurs` (030) rangé depuis les métadonnées, à côté du compte Vinted', JSON.stringify(abos[A].comptes_vendeurs));
    colonne030 = false; delete abos[A].comptes_vendeurs;
    r = await envoyer({ ...sub, status: 'past_due' }, 600);
    dit(r.code === 200 && abos[A].statut === 'past_due' && abos[A].plan === 'solo' && abos[A].compte_vendeur === '1007' && !('comptes_vendeurs' in abos[A]), 'sans la migration 030 : statut, plan et compte Vinted quand même rangés', `HTTP ${r.code} · ${JSON.stringify(abos[A])}`.slice(0, 200));
  });
  await essaie('serveur : la règle du vendeur (bilans)', async () => {
    reset();
    const PV = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-vendeur.js'));
    const R = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-regle.js'));
    PV.oublierPlans();
    abos[A] = { statut: 'active', plan: 'solo', compte_vendeur: '1007', comptes_vendeurs: { leboncoin: '8442001', ebay: 'principal' } };
    let r = await PV.regleDuVendeur(A);
    dit(r && R.venteAutreHorsPlan(r, 'leboncoin', '8442002') && !R.venteAutreHorsPlan(r, 'leboncoin', '8442001') && R.venteAutreHorsPlan(r, 'ebay', '0123456789abcdef') && R.venteHorsPlan(r, '1008'),
      'la ligne `abonnements` (030) donne au serveur le compte vendeur de chaque plateforme', JSON.stringify(r && r.autres));
    PV.oublierPlans(); colonne030 = false;
    r = await PV.regleDuVendeur(A);
    dit(r && R.venteHorsPlan(r, '1008') && !R.venteAutreHorsPlan(r, 'leboncoin', '8442002'), 'base sans la 030 : relue sans la colonne — Vinted bridé comme avant, les autres plateformes « pas su » (rien bridé)', JSON.stringify(r));
    PV.oublierPlans(); colonne030 = true; abos[A].plan = 'pro';
    r = await PV.regleDuVendeur(A);
    dit(r && !R.venteAutreHorsPlan(r, 'leboncoin', '8442002'), 'Pro : rien bridé, même avec des comptes vendeurs rangés');
  });

  console.log('── 5. Les prix : Solo 16,99 €, Pro 19,99 € (décision du 9 nov.), une valeur chacun');
  await essaie('prix', async () => {
    const reg = lire('src/accueil-reglages.js'), cpt = lire('api/compte.js'), cgv = lire('public/legal/cgv.html');
    dit(/PRIX_PRO_MOIS = '19,99'/.test(reg) && /PRIX_PRO_CGV = \{ centimes: 1999, devise: 'eur', intervalle: 'month' \}/.test(cpt) && /Offre Pro : 19,99 € par mois/.test(cgv), 'Pro 19,99 € : app, serveur et CGV disent la même chose');
    dit(/Dernière mise à jour : 10 novembre 2026/.test(cgv) && /const CGV_VERSION = '2026-11-10'/.test(cpt), 'CGV du 10 novembre (Solo et Pro illimité), version acceptée à jour');
    dit(/un compte vendeur/.test(cgv) && /comptes d’achat/.test(cgv) && /rien n’est supprimé/.test(cgv), 'CGV : Solo dit « un compte vendeur » et « comptes d’achat », rien supprimé');
    const R = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-regle.js'));
    dit(/un compte vendeur par plateforme<\/b> \(un compte Vinted, un compte Leboncoin, un compte eBay et un compte Vestiaire Collective\)/.test(cgv) && /plateforme par plateforme/.test(cgv) && /colis à envoyer restent affichés/.test(cgv),
      'CGV : « un compte vendeur par plateforme » (Vinted, Leboncoin, eBay, Vestiaire), 30 jours par plateforme, colis gardés');
    dit(/^Un compte vendeur par plateforme \(un Vinted, un Leboncoin, un eBay, un Vestiaire\)/.test(R.OFFRES.solo.phrase) && /un compte vend (?:sur chaque|par) plateforme/.test(lire('src/Accueil.jsx') + lire('src/i18n/langues/fr-accueil.js')),
      'l’offre Solo dit la même chose dans l’app, sur l’accueil et dans Paramètres (une phrase, `OFFRES.solo`)');
  });

  console.log('── 7. Pro illimité (10 nov., 20 h) : aucun compte vendeur écarté, rien à choisir');
  if (compte) await essaie('serveur : Pro illimité', async () => {
    reset();
    process.env.STRIPE_PRIX_PRO = 'price_pro';
    vintedDe[A] = Array.from({ length: 50 }, (_, i) => String(2000 + i));
    sub.items.data[0].price = { id: 'price_pro', lookup_key: null, unit_amount: 1999, currency: 'eur', recurring: { interval: 'month' } };
    sub.metadata = { ...sub.metadata, cgv_version: '2026-11-10', vrm_pro_vendeurs: 'v:2000,v:2001,v:2002,v:2003,v:2004,v:2005,v:2006,v:2007,v:2008,v:2009', vrm_pro_vendeurs_le: '2026-11-10T18:00:00Z' };
    let r = await appel({ mode: 'abonnement', headers: A_ });
    const restes = ['proLimite', 'comptesPro', 'maxVendeursPro'].filter((k) => r.corps && k in r.corps);
    dit(r.code === 200 && r.corps.plan === 'pro' && restes.length === 0, '`mode=abonnement` en Pro : aucune limite ni liste de comptes rendue', `${r.corps && r.corps.plan} · ${restes.join(', ')}`);
    const n = postsStripe().length;
    r = await appel({ method: 'POST', mode: 'compte-vendeur', headers: A_, corps: { plateforme: 'pro', comptes: [{ plateforme: 'vinted', id: '2000' }] } });
    dit(r.code === 409 && postsStripe().length === n && r.corps && r.corps.erreur === 'pro-illimite', '`mode=compte-vendeur` plateforme « pro » : refusé proprement (409), rien écrit chez Stripe', `HTTP ${r.code} · ${r.corps && r.corps.erreur}`);
    const signer = (c) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${crypto.createHmac('sha256', SECRET).update(`${t}.${c}`).digest('hex')}`; };
    const c = JSON.stringify({ id: 'evt_pro_illimite', type: 'customer.subscription.updated', created: 900, livemode: false, data: { object: sub } });
    r = await appel({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c });
    dit(r.code === 200 && abos[A].plan === 'pro' && !(abos[A].comptes_vendeurs && 'pro' in abos[A].comptes_vendeurs), 'webhook Pro : aucune liste de comptes rangée dans `comptes_vendeurs`', JSON.stringify(abos[A].comptes_vendeurs));
    const PV = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-vendeur.js'));
    const R = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-regle.js'));
    PV.oublierPlans();
    abos[A] = { statut: 'active', plan: 'pro', compte_vendeur: '2000', comptes_vendeurs: { pro: ['vinted:2000', 'leboncoin:8443000'], leboncoin: '8443000' } };
    const rg = await PV.regleDuVendeur(A);
    const ec = vintedDe[A].filter((u) => R.venteHorsPlan(rg, u)).length + Array.from({ length: 50 }, (_, i) => String(8443000 + i)).filter((x) => R.venteAutreHorsPlan(rg, 'leboncoin', x)).length;
    dit(rg && ec === 0, 'serveur (bilans, notifications) : Pro avec une ancienne liste dans la ligne ⇒ 100 comptes, aucun écarté', `${ec} écarté(s)`);
    PV.oublierPlans();
    delete process.env.STRIPE_PRIX_PRO;
  });
  await essaie('app : Pro illimité', async () => {
    const mem = {}; global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
    const E = await import('file://' + path.join(RACINE, 'src', 'abonnement', 'etatAbonnement.js'));
    const P = await import('file://' + path.join(RACINE, 'src', 'abonnement', 'planVentes.js'));
    P.demarrerPlan('uid-banc-pro');
    E.publierAbonnement({ ok: true, plan: 'pro', proLimite: true, comptesPro: { liste: [{ plateforme: 'vinted', id: '2000' }] }, comptesVendeurs: { pro: ['vinted:2000'] } });
    const hors = Array.from({ length: 50 }, (_, i) => String(2000 + i)).filter((u) => P.venteHorsPlanUid(u)).length;
    dit(P.signaturePlan() === 'libre' && hors === 0 && !mem['vrm_plan_regle_uid-banc-pro'], 'app : Pro (même avec une liste reçue) ⇒ 50 comptes Vinted, aucun écarté, rien gardé sur l’appareil', `${P.signaturePlan()} · ${hors}`);
    const plans = sansCommentaires(lire('src/abonnement/PlansSoloPro.jsx')), reg = sansCommentaires(lire('src/ecrans/Reglages.jsx')), app = sansCommentaires(lire('src/App.jsx'));
    // (11 nov., lot traduction) Les phrases de l'accueil vivent aussi dans le dictionnaire français.
    const acc = lire('src/Accueil.jsx') + lire('src/i18n/langues/fr-accueil.js'), cgv = lire('public/legal/cgv.html');
    const traces = [[/QuelsComptesPro|data-quels-comptes-pro|Quels 10 comptes/, plans + app], [/comptes vendeurs`|data-comptes-pro|proLimite|MAX_VENDEURS_PRO/, reg + app], [/10 comptes vendeurs|10 comptes vendent|hors de tes 10/, plans + reg + app + acc]]
      .filter(([re, t]) => re.test(t)).map(([re]) => String(re));
    dit(traces.length === 0, 'écrans : ni feuille « Quels 10 comptes vendent ? », ni rangée « Tes 10 comptes vendeurs », ni « hors de tes 10 »', traces.join(' · '));
    dit(/avec Pro, tous tes comptes vendent/.test(acc) && /tous tes comptes vendeurs, sans limite de nombre/.test(cgv) && !/10 comptes vendeurs/.test(cgv),
      'accueil et CGV : Pro = tous les comptes vendeurs, sans limite');
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-plans-solo-pro : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
