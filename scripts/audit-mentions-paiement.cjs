// Audit : le paiement ne s'ouvre pas sur des CGV qui ne disent ni QUI vend,
// ni OÙ écrire (22 octobre, proposition n°15).
//
//   node scripts/audit-mentions-paiement.cjs [--mutation=sans-porte|detail-vendeur|passu-ouvert|sans-acces|liste-a-tous|sans-metadonnee]
//
// MESURÉ le 22 octobre : les 10 champs de public/legal/editeur.js valent `null`
// en production, src/contact.js est vide, et l'article 5 des CGV renvoie à
// « écrire à » une adresse qui n'existe pas. Vendre un abonnement sur ces CGV,
// c'est une information précontractuelle incomplète (L221-5, L221-20 : le délai
// de rétractation s'allonge alors de 12 mois).
//
// §4.10 : on EXÉCUTE la vraie route (api/compte.js, modes `checkout` et
// `abonnement`) avec un faux Stripe et une fausse base, et on juge :
//   1. mentions vides ⇒ 503 `mentions-legales`, AUCUN appel à Stripe, message
//      générique au vendeur (aucun libellé), le détail dans les journaux ;
//   2. une seule mention vide ⇒ fermé aussi ;
//   3. fichier illisible (« pas su ») ⇒ fermé, jamais ouvert ;
//   4. le propriétaire lit la LISTE de ce qui manque, un vendeur ne la lit pas ;
//   5. mentions complètes : sans la case d'accès immédiat ⇒ 400, rien chez
//      Stripe ; avec ⇒ la session s'ouvre, et la demande est DATÉE dans les
//      métadonnées de l'abonnement, comme les CGV ;
//   6. la vraie table de l'éditeur : chaque champ obligatoire existe.
// Aucune donnée réelle : les valeurs remplies ici sont inventées et ne sont
// jamais écrites dans le dépôt.
const path = require('path'), fs = require('fs'), os = require('os');
const RACINE_DEPOT = path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : lève', String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); } };

// Une mutation réaffaiblit la règle dans une COPIE (api/, public/legal/, les
// deux dossiers de src/ qu'api/ importe) : le dépôt n'est jamais touché.
let RACINE = RACINE_DEPOT;
if (MUT) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mentions-'));
  for (const rel of ['api', 'public/legal', 'src/communaute', 'src/operations', 'src/favorisVinted.js', 'src/favorisMessage.js', 'src/reglagesFavoris.js', 'package.json']) fs.cpSync(path.join(RACINE_DEPOT, rel), path.join(tmp, rel), { recursive: true });
  fs.symlinkSync(path.join(RACINE_DEPOT, 'node_modules'), path.join(tmp, 'node_modules'));
  const muter = (rel, avant, apres) => {
    const p = path.join(tmp, rel); const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(avant)) { console.log('❌ mutation impossible : motif absent dans ' + rel); process.exit(2); }
    fs.writeFileSync(p, s.replace(avant, apres));
  };
  if (MUT === 'sans-porte') muter('api/compte.js', 'if (manque === null || manque.length) {', 'if (false) {');
  else if (MUT === 'detail-vendeur') muter('api/compte.js', `return repondre(res, 503, { erreur: 'mentions-legales', message: "Le paiement n'est pas encore ouvert : rien n'a été prélevé. Réessaie plus tard." });`,
    `return repondre(res, 503, { erreur: 'mentions-legales', message: "Manque : " + (manque || []).map((x) => x.libelle).join(', ') });`);
  else if (MUT === 'passu-ouvert') muter('api/compte.js', 'if (manque === null || manque.length) {', 'if (manque && manque.length) {');
  else if (MUT === 'erreur-a-tous') muter('api/compte.js', 'mentionsErreur: acc.proprietaire && manque === null', 'mentionsErreur: manque === null');
  else if (MUT === 'sans-cause') muter('api/compte.js', "mentionsErreur: acc.proprietaire && manque === null ? String((lues && lues.erreur) || 'illisible') : undefined,", '');
  else if (MUT === 'sans-acces') muter('api/compte.js', 'if (corps.accesImmediat !== true) return', 'if (false) return');
  else if (MUT === 'liste-a-tous') muter('api/compte.js', 'mentionsManquantes: acc.proprietaire ? (', 'mentionsManquantes: true ? (');
  else if (MUT === 'sans-metadonnee') muter('api/compte.js', "subscription_data: { metadata: { owner: u.id, app: 'vrm', cgv_version: CGV_VERSION, cgv_acceptees_le: accepteLe, acces_immediat_demande_le: accepteLe } },",
    "subscription_data: { metadata: { owner: u.id, app: 'vrm', cgv_version: CGV_VERSION, cgv_acceptees_le: accepteLe } },");
  else { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  RACINE = tmp;
}

const A = '11111111-1111-4111-8111-111111111111', P = '99999999-9999-4999-8999-999999999999';
const appelsStripe = [];
const rep = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
global.fetch = async (url, o = {}) => {
  const u = String(url), h = o.headers || {};
  const auth = String(h.Authorization || h.authorization || '');
  if (u.includes('/auth/v1/user')) return /aa\.bb\.A/.test(auth) ? rep({ id: A, email: 'a@exemple.test' }) : /aa\.bb\.P/.test(auth) ? rep({ id: P, email: 'p@exemple.test' }) : rep({}, 401);
  if (u.includes('/rest/v1/rpc/vrm_acces')) return rep({ obligatoire: false, proprietaire: /aa\.bb\.P/.test(auth), acces: true });
  if (u.includes('/rest/v1/abonnements')) return rep([]);
  if (u.startsWith('https://api.stripe.com/v1/')) {
    const chemin = u.slice('https://api.stripe.com/v1/'.length).split('?')[0];
    appelsStripe.push({ chemin, corps: decodeURIComponent(String(o.body || '')) });
    if (chemin === 'prices') return rep({ data: [{ id: 'price_banc', unit_amount: 1499, currency: 'eur', recurring: { interval: 'month' } }] });
    if (chemin === 'checkout/sessions') return rep({ id: 'cs_banc', url: 'https://checkout.stripe.com/c/pay/cs_banc' });
  }
  return rep({}, 404);
};

(async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  process.env.VRM_OWNER_UID = P;
  let compte;
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }
  const appeler = async (mode, jeton, body) => {
    const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (x) => { r.corps = x; return r; }; r.setHeader = () => {};
    const req = { method: mode === 'abonnement' ? 'GET' : 'POST', query: { mode }, headers: { authorization: 'Bearer aa.bb.' + jeton }, async *[Symbol.asyncIterator]() {} };
    if (body) req.body = body;
    await compte(req, r);
    return r;
  };
  const journaux = [];
  const warn0 = console.warn;
  console.warn = (...a) => { journaux.push(a.join(' ')); };
  const stripeChecks = () => appelsStripe.filter((x) => x.chemin === 'checkout/sessions').length;

  // La VRAIE table de l'éditeur, chargée comme le serveur la charge.
  await essaie('table de l’éditeur', async () => {
    await import('file://' + path.join(RACINE, 'public', 'legal', 'editeur.js'));
    const E = globalThis.VRM_EDITEUR, O = globalThis.VRM_EDITEUR_OBLIGATOIRES, L = globalThis.VRM_EDITEUR_LIBELLES;
    dit(!!E && Array.isArray(O) && O.length >= 10 && O.every((k) => k in E && L && typeof L[k] === 'string'),
      'editeur.js se lit côté serveur : chaque champ obligatoire existe et a son libellé', Array.isArray(O) ? O.join(',') : String(O));
    dit(['nom', 'adresse', 'siret', 'email', 'telephone', 'mediateur'].every((k) => (O || []).includes(k)),
      '… dont qui vend, où il est, comment le joindre et le médiateur (CGV art. 1, 5 et 7)');
  });
  const VRAI = { ...(globalThis.VRM_EDITEUR || {}) };
  const remplir = () => { for (const k of Object.keys(VRAI)) globalThis.VRM_EDITEUR[k] = 'valeur d’essai ' + k; };
  const vider = () => { for (const k of Object.keys(VRAI)) globalThis.VRM_EDITEUR[k] = VRAI[k]; };

  console.log('\n── 1. Mentions vides : le paiement ne s’ouvre pas');
  await essaie('vides', async () => {
    vider(); appelsStripe.length = 0; journaux.length = 0;
    const r = await appeler('checkout', 'A', { cgv: true, accesImmediat: true });
    dit(r.code === 503 && r.corps && r.corps.erreur === 'mentions-legales', 'checkout refusé : 503 mentions-legales', `HTTP ${r.code} · ${r.corps && r.corps.erreur}`);
    dit(appelsStripe.length === 0, '… et RIEN ne part chez Stripe (ni prix, ni session)', `${appelsStripe.length} appel(s)`);
    const m = String((r.corps && r.corps.message) || '');
    dit(/pas encore ouvert/.test(m) && /rien n'a été prélevé/.test(m) && !/SIRET|médiateur|raison sociale|editeur\.js/i.test(m),
      'le vendeur lit une phrase générique (comme le refus « prix ≠ CGV »), sans le détail', m);
    dit(journaux.some((j) => /mentions/.test(j) && /SIRET/.test(j) && /médiateur/.test(j) && /editeur\.js/.test(j)), 'le détail et le geste sont dans les journaux du serveur', journaux[0] && journaux[0].slice(0, 120));
  });
  await essaie('une seule vide', async () => {
    remplir(); globalThis.VRM_EDITEUR.mediateur = '   ';
    appelsStripe.length = 0;
    const r = await appeler('checkout', 'A', { cgv: true, accesImmediat: true });
    dit(r.code === 503 && r.corps && r.corps.erreur === 'mentions-legales' && stripeChecks() === 0, 'UNE mention vide (le médiateur, des espaces) suffit à fermer le paiement', `HTTP ${r.code}`);
  });

  console.log('\n── 2. « Pas su » ne vaut pas « complet »');
  await essaie('illisible', async () => {
    remplir();
    const O = globalThis.VRM_EDITEUR_OBLIGATOIRES; globalThis.VRM_EDITEUR_OBLIGATOIRES = undefined;
    appelsStripe.length = 0;
    const r = await appeler('checkout', 'A', { cgv: true, accesImmediat: true });
    const s = await appeler('abonnement', 'A');
    globalThis.VRM_EDITEUR_OBLIGATOIRES = O;
    dit(r.code === 503 && r.corps && r.corps.erreur === 'mentions-legales' && stripeChecks() === 0, 'fichier illisible : le paiement reste FERMÉ', `HTTP ${r.code}`);
    dit(s.code === 200 && s.corps && s.corps.mentionsCompletes === null, '… et l’écran lit « pas su » (null), jamais « complet »', `mentionsCompletes=${s.corps && s.corps.mentionsCompletes}`);
  });
  // 23 oct. (revue) : la forme qu'il écrira VRAIMENT un jour — une apostrophe
  // dans une chaîne entre apostrophes. Le fichier ne se charge plus du tout.
  // Une COPIE de l'arbre (api/, public/legal/…) avec ce fichier-là : le dépôt
  // n'est jamais touché.
  await essaie('apostrophe', async () => {
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mentions-apos-'));
    for (const rel of ['api', 'public/legal', 'src/communaute', 'src/operations', 'src/favorisVinted.js', 'src/favorisMessage.js', 'src/reglagesFavoris.js', 'package.json']) fs.cpSync(path.join(RACINE, rel), path.join(tmp2, rel), { recursive: true });
    fs.symlinkSync(path.join(RACINE_DEPOT, 'node_modules'), path.join(tmp2, 'node_modules'));
    const pe = path.join(tmp2, 'public', 'legal', 'editeur.js');
    const src = fs.readFileSync(pe, 'utf8');
    const casse = src.replace(/(\bnom:\s*)null/, "$1'Julien d'Exemple (entrepreneur individuel)'");
    if (casse === src) { dit(false, 'apostrophe : le champ « nom: null » est introuvable dans editeur.js'); return; }
    fs.writeFileSync(pe, casse);
    const compte2 = (await import('file://' + path.join(tmp2, 'api', 'compte.js'))).default;
    const appeler2 = async (mode, jeton, body) => {
      const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (x) => { r.corps = x; return r; }; r.setHeader = () => {};
      const req = { method: mode === 'abonnement' ? 'GET' : 'POST', query: { mode }, headers: { authorization: 'Bearer aa.bb.' + jeton }, async *[Symbol.asyncIterator]() {} };
      if (body) req.body = body;
      await compte2(req, r); return r;
    };
    appelsStripe.length = 0;
    const r = await appeler2('checkout', 'A', { cgv: true, accesImmediat: true });
    const v = await appeler2('abonnement', 'A');
    const p = await appeler2('abonnement', 'P');
    dit(r.code === 503 && r.corps && r.corps.erreur === 'mentions-legales' && stripeChecks() === 0, 'editeur.js mal écrit (apostrophe) : le paiement reste FERMÉ, rien chez Stripe', `HTTP ${r.code} · ${stripeChecks()} session(s)`);
    dit(v.code === 200 && v.corps && v.corps.mentionsCompletes === null && v.corps.mentionsErreur === undefined,
      '… un vendeur lit « pas su » (null) — et rien de l’erreur', JSON.stringify({ c: v.corps && v.corps.mentionsCompletes, e: v.corps && v.corps.mentionsErreur }));
    dit(p.code === 200 && p.corps && p.corps.mentionsCompletes === null && typeof p.corps.mentionsErreur === 'string' && /Exemple/.test(p.corps.mentionsErreur),
      '… le propriétaire lit l’erreur MESURÉE (la ligne fautive), pour corriger le fichier', JSON.stringify(p.corps && p.corps.mentionsErreur));
  });

  console.log('\n── 3. Qui lit la liste de ce qui manque');
  await essaie('liste', async () => {
    vider();
    const v = await appeler('abonnement', 'A');
    const p = await appeler('abonnement', 'P');
    dit(v.code === 200 && v.corps && v.corps.mentionsCompletes === false && v.corps.mentionsManquantes === undefined,
      'un vendeur sait que le paiement est fermé (mentionsCompletes: false), SANS la liste', JSON.stringify({ c: v.corps && v.corps.mentionsCompletes, l: v.corps && v.corps.mentionsManquantes }));
    const l = p.corps && p.corps.mentionsManquantes;
    dit(p.code === 200 && Array.isArray(l) && l.length === (globalThis.VRM_EDITEUR_OBLIGATOIRES || []).length && l.includes('SIRET') && l.includes('médiateur de la consommation'),
      'le propriétaire lit la liste, en libellés', Array.isArray(l) ? l.join(', ') : String(l));
    remplir();
    const c = await appeler('abonnement', 'A');
    dit(c.corps && c.corps.mentionsCompletes === true, 'mentions remplies : mentionsCompletes = true', `mentionsCompletes=${c.corps && c.corps.mentionsCompletes}`);
  });

  console.log('\n── 4. La demande d’accès immédiat (art. L221-25)');
  await essaie('acces', async () => {
    remplir(); appelsStripe.length = 0;
    const r0 = await appeler('checkout', 'A', { cgv: true });
    dit(r0.code === 400 && r0.corps && r0.corps.erreur === 'acces-immediat' && stripeChecks() === 0,
      'les CGV cochées SANS l’accès immédiat : 400, aucune session de paiement', `HTTP ${r0.code} · ${r0.corps && r0.corps.erreur}`);
    const r00 = await appeler('checkout', 'A', { cgv: true, accesImmediat: 'true' });
    dit(r00.code === 400 && stripeChecks() === 0, '… et « true » en texte ne vaut pas une case cochée', `HTTP ${r00.code}`);
    appelsStripe.length = 0;
    const r1 = await appeler('checkout', 'A', { cgv: true, accesImmediat: true });
    const s = appelsStripe.find((x) => x.chemin === 'checkout/sessions');
    const corps = (s && s.corps) || '';
    dit(r1.code === 200 && r1.corps && /checkout\.stripe\.com/.test(r1.corps.url || ''), 'les deux cases cochées et les mentions remplies : le paiement s’ouvre', `HTTP ${r1.code}`);
    const date = (/subscription_data\[metadata\]\[acces_immediat_demande_le\]=([^&]+)/.exec(corps) || [])[1] || '';
    const cgvLe = (/subscription_data\[metadata\]\[cgv_acceptees_le\]=([^&]+)/.exec(corps) || [])[1] || '';
    dit(/^\d{4}-\d{2}-\d{2}T/.test(date) && date === cgvLe && /&metadata\[acces_immediat_demande_le\]=/.test('&' + corps),
      'la demande est DATÉE et rangée dans l’abonnement, à la même date que l’acceptation des CGV', `${date} · CGV ${cgvLe}`);
  });

  console.warn = warn0;
  console.log(ko ? `\n❌ audit-mentions-paiement${MUT ? ' (mutation ' + MUT + ')' : ''} : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-mentions-paiement : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
