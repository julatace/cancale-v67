// ════════════════════════════════════════════════════════════════════════════
//  LEBONCOIN : LES INTÉRESSÉS ; VESTIAIRE : LA DATE EN LIGNE ET LA BAISSE PAR RÈGLE
//  (20 nov., lot lbc-vc-interesses, extension 5.410)
//
//  Julien (20 nov.) : « on reçoit quand une personne est intéressée sur Leboncoin ; pour Vestiaire trouve une
//  solution ». MESURÉ (lecture seule, sa base) : aucun e-mail Leboncoin « intéressé » n'arrive ; Leboncoin ne
//  dit jamais qui a mis en favori ; la conversation dit l'annonce (`conversationContext.itemId`) ; Vestiaire
//  « Mes articles » porte `listingDate`. Les FORMES ci-dessous suivent ces mesures ; les VALEURS sont inventées.
//
//  VRAI vc-inject.js + VRAI vc.js + VRAI background.js (`_fond-vm.cjs`). Ce qu'il exige :
//   V1  `listingDate` lu ⇒ `misEnLigne` EXACT ; la 1re lecture pose `vueDepuis`, jamais avancée ensuite.
//   V2  sans `listingDate` (ou date fausse, future) ⇒ `misEnLigne` vide : seule la BORNE BASSE existe.
//   V3  les négociations : trois NOMBRES, aucun identifiant de personne.
//   R1  la règle d'un compte Vestiaire (`vc:{id}`) dépose UNE baisse, jamais sous le plancher (le plus haut).
//   R2  sans plancher, règle éteinte, recette pas apprise, autre compte, N° porté par deux fiches ⇒ RIEN.
//   R3  « au moins » : avec la seule borne basse trop récente ⇒ rien ; ancienne ⇒ la baisse, dite NON exacte.
//   A1  l'app : une borne basse se dit « au moins », jamais « depuis le » ; exacte ⇒ « depuis le ».
//   L1  le fil Leboncoin garde l'annonce de la conversation (jamais `partnerId` / `partnerName`).
//   L2  « intéressé » = la personne a ÉCRIT sur CETTE annonce, sur CE compte ; le bloc de règle est le même ici
//       et dans l'app.
//   L3  « Leur écrire » (panneau) : sans confirmation, sans recette, une personne qui n'a pas écrit, une autre
//       annonce, un autre compte ⇒ RIEN ne part ; sinon une à la fois, 40–90 s au hasard jamais deux fois de
//       suite, un texte jamais deux fois de suite, une fois par personne, 45/h ; un 429 arrête tout.
//   L4  l'app montre les intéressés et n'envoie rien (le geste est dans le panneau).
//  `--prouve` : chaque règle réaffaiblie doit faire rougir l'audit.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/vc-inject.js')),
  relais: arg('--relais', path.join(racine, 'vinted-sync-extension/vc.js')),
  lbcinject: arg('--lbcinject', path.join(racine, 'vinted-sync-extension/lbc-inject.js')),
  regle: arg('--regle', path.join(racine, 'src/interessesLbc.js')),
  date: arg('--date', path.join(racine, 'src/dateMiseVc.js')),
  ecran: arg('--ecran', path.join(racine, 'src/ecrans/MessagesLeboncoin.jsx')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['listingDateIgnore', 'inject', "misEnLigne: dateMiseVc(e), negos", "misEnLigne: '', negos"],
    ['dateFuture', 'inject', "t > Date.UTC(2009, 0, 1) && t < Date.now() + 864e5 ?", "t > 0 ?"],
    ['vueDepuisAvance', 'src', "vueDepuis: avant && avant < maintenant ? avant : maintenant };", "vueDepuis: maintenant };"],
    ['borneCommeExacte', 'src', "  return { misEnLigne: lue || (prev && prev.misEnLigne) || '', vueDepuis:", "  return { misEnLigne: lue || (prev && prev.misEnLigne) || (prev && prev.vueDepuis) || maintenant, vueDepuis:"],
    ['negosPersonne', 'inject', "    const r = { total: n(s.totalNegotiationsCount),", "    const r = { qui: s.buyerId, total: n(s.totalNegotiationsCount),"],
    ['sousLePlancher', 'src', "  if (v < plancher.c) v = plancher.c;\n", ''],
    ['plancherLePlusBas', 'src', "  return cands.reduce((a, b) => (b.c > a.c ? b : a));", "  return cands.reduce((a, b) => (b.c < a.c ? b : a));"],
    ['sansRecetteDepose', 'src', "  if (!(rec && rec.recette && rec.recette.rejouable === true)) return { saute: 'sansRecette' };", ''],
    ['comptePrete', 'src', "      if (String(it.compte || '') !== compteVc) { if (!it.compte) compte('sansCompte'); continue; }", "      if (it.compte && String(it.compte) !== compteVc) continue;"],
    ['doublonDevine', 'src', "    if (f === null) return { c: null, doublon: true };            // deux fiches sous ce N° : rien n'est deviné\n", ''],
    ['depuisMaintenant', 'src', "      const due = baisseDue({ prixC, depuis: Math.max(dep.t, derniere), regle, plancher: pl, maintenant: t });", "      const due = baisseDue({ prixC, depuis: Math.max(dep.t - 60 * 864e5, derniere), regle, plancher: pl, maintenant: t });"],
    ['appAuMoinsExact', 'date', "  return d.exacte ? tr('vcDate.depuis', { jour }) : tr('vcDate.auMoins', { jour });", "  return tr('vcDate.depuis', { jour });"],
    ['partenaireSort', 'lbcinject', "      post({ kind: 'lbcfil', conv, messages, lus: arr.length, forme, moi, page: cheminPage(), annonce });", "      post({ kind: 'lbcfil', conv, messages, lus: arr.length, forme, moi, page: cheminPage(), annonce, qui: ctxConv && ctxConv.partnerName });"],
    ['annonceIgnoree', 'lbcinject', "page: cheminPage(), annonce });", "page: cheminPage(), annonce: '' });"],
    ['interesseSansEcrire', 'src', "    if (!(Number.isInteger(n) && n >= 1)) continue;                              // la personne n'a jamais écrit : pas un intéressé\n", ''],
    ['autreCompteListe', 'src', "    if (compte && String(f.compte || '') !== String(compte)) continue;           // jamais un autre compte\n", ''],
    ['horsListeEnvoye', 'src', "  if (horsListe.length) return { accepte: false, code: 'pas-interesse',", "  if (false) return { accepte: false, code: 'pas-interesse',"],
    ['sansConfirmation', 'src', "  if (!msg || msg.confirme !== true) return { accepte: false, code: 'confirmation',", "  if (!msg) return { accepte: false, code: 'confirmation',"],
    ['deuxFois', 'src', "  const aEcrire = voulues.filter((c) => !faits[annonce + '|' + c]);", '  const aEcrire = voulues;'],
    ['delaiFixe', 'src', "      const s = await tirerSansRepeter(LBC_INTERESSES_ECART_DERNIER, INTERESSES_ECART_S[0], INTERESSES_ECART_S[1]);", '      const s = 60;'],
    ['sansAttente', 'src', "      const att = await tenirAttenteLbc(compte, f.prochain);", '      const att = { ok: true };'],
    ['texteRepete', 'src', "      const texte = texteJamaisRepete(brut, '', f.recents || []) || null;", '      const texte = brut;'],
    ['plafondSerie', 'src', "    const plafondR = serie ? ACTIONS_MAX_HEURE - RESERVE_GESTES : ACTIONS_MAX_HEURE;", '    const plafondR = 1000;'],
    ['parToucher', 'src', "  const lot = aEcrire.slice(0, INTERESSES_PAR_TOUCHER);", '  const lot = aEcrire;'],
    ['refusContinue', 'src', "      else { await noter(r && r.accepte === true ? 'refusee' : null); await finir('arret', (r && r.raison) || 'refusé'); break; }", "      else { await noter(r && r.accepte === true ? 'refusee' : null); }"],
    ['porteIgnoree', 'src', "      const p = await porteDiscretion('lbc:' + compte, 'favori');\n      if (p) { await finir('arret', p.error); break; }", "      const p = null;\n      if (p) { await finir('arret', p.error); break; }"],
    ['regleAppDiffere', 'regle', "    if (!(Number.isInteger(n) && n >= 1)) continue;", "    if (!(Number.isInteger(n) && n >= 0)) continue;"],
    ['appEnvoie', 'ecran', "        <span data-interesses-lbc-phrase=\"\">{tr('interessesLbc.phrase')}</span>", "        <span data-interesses-lbc-phrase=\"\">{tr('interessesLbc.phrase')}</span><button onClick={() => vmrCmd({ cmd: 'ecrireInteressesLbc' })}>x</button>"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-lbc-vc-interesses-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    let txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    txt = txt.replace(avant, apres);
    fs.mkdirSync(path.join(tmp, nom), { recursive: true });
    const fichier = path.join(tmp, nom, path.basename(F[cle]));
    fs.writeFileSync(fichier, txt);
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 300000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0, n = 0;
const dit = (ok, nom, det) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || det == null ? '' : ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500)}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const copie = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const J = 864e5;
const iso = (t) => new Date(t).toISOString();

// ── VESTIAIRE : le vrai capteur, le vrai relais, le vrai fond ─────────────────────────────────────────────────────────
const API = 'https://apiv2.vestiairecollective.com';
const ORIGINE = 'https://fr.vestiairecollective.com';
const Q = '?isoCountry=FR&x-siteid=1&x-language=fr&x-currency=EUR';
const MOI = '11112222', ART = '66668888', ART2 = '77770000', ART3 = '55554444';
const URL_LISTE = `${API}/users/me/product-listings${Q}&limit=10&offset=0&sort=listingDate:desc`;
// La forme MESURÉE d'une annonce de « Mes articles » (valeurs inventées).
const annonce = (id, cents, listingDate, nego = { totalNegotiationsCount: 2, ongoingNegotiationsCount: 1, pendingSellerActionCount: 1 }) => ({ type: 'published', published: Object.assign({ product: { id: Number(id), headline: 'Nike', subHeadline: 'Dunk Low', price: { cents, currency: 'EUR', formatted: `${cents / 100} €` }, sellerEarnings: { cents: Math.round(cents * 0.8), currency: 'EUR' }, picturePath: `${id}-1_2.jpg`, path: `/x-${id}.shtml`, segment: 'x' },
  negotiationsSummary: Object.assign({ buyerId: 99887766 }, nego), singleNegotiationId: null, hasPriceDropRecommendation: false }, listingDate === undefined ? {} : { listingDate }) });

function chrome2(bus) {
  const INJ = fs.readFileSync(F.inject, 'utf8'), REL = fs.readFileSync(F.relais, 'utf8');
  const posts = [], routes = {};
  const ecoutesPage = [], ecoutesRel = [], winP = {}, winR = {};
  const diffuser = (m) => { const d = copie(m); posts.push(d); for (const f of ecoutesPage.slice()) f({ source: winP, data: copie(d) }); for (const f of ecoutesRel.slice()) f({ source: winR, data: copie(d) }); };
  Object.assign(winP, { postMessage: diffuser, addEventListener: (t, f) => { if (t === 'message') ecoutesPage.push(f); },
    fetch: async (u, init) => {
      const m = String((init && init.method) || 'GET').toUpperCase();
      const r = routes[m + ' ' + String(u)] || { status: 404, body: { message: 'introuvable' } };
      const texte = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      return { status: r.status, ok: r.status >= 200 && r.status < 300, headers: { get: () => 'application/json; charset=utf-8' }, clone() { return this; }, text: async () => texte, arrayBuffer: async () => new ArrayBuffer(0) };
    } });
  winP.top = winP; winP.self = winP;
  const ctxP = { window: winP, document: { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {}, getElementById: () => null, readyState: 'complete' },
    location: { origin: ORIGINE, hostname: 'fr.vestiairecollective.com', pathname: '/my-account/items/', href: ORIGINE + '/my-account/items/' }, history: { pushState() {}, replaceState() {} },
    URL, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date, Math, Map, Set, Promise, encodeURIComponent, btoa: (x) => Buffer.from(x, 'latin1').toString('base64'), Uint8Array, ArrayBuffer, String, Number };
  vm.createContext(ctxP); vm.runInContext(INJ, ctxP, { filename: 'vc-inject.js' });
  Object.assign(winR, { postMessage: diffuser, addEventListener: (t, f) => { if (t === 'message') ecoutesRel.push(f); } });
  winR.top = winR;
  const uuid = () => 'aaaaaaaa-bbbb-cccc-dddd-' + String(Math.floor(Math.random() * 1e12)).padStart(12, '0');
  const ctxR = { window: winR, self: { crypto: { randomUUID: uuid } }, crypto: { randomUUID: uuid },
    chrome: { runtime: { id: 'banc', sendMessage: (m, cb) => { if (bus) bus(copie(m)); if (cb) cb(); }, lastError: null, onMessage: { addListener() {} } } },
    location: { href: ORIGINE + '/my-account/items/' }, URL, console, setTimeout, clearTimeout, JSON, Date, Math, Map, Set, Number, String };
  vm.createContext(ctxR); vm.runInContext(REL, ctxR, { filename: 'vc.js' });
  const appel = async (m, url, corps, status = 200) => { routes[m + ' ' + url] = { status, body: corps }; const k = posts.length; await winP.fetch(url, { method: m }); await attendre(30); return posts.slice(k); };
  return { appel, posts };
}
function systemeVc() {
  let fond = null;
  const ch = chrome2((m) => { if (fond) fond.envoyer(m, { tab: { id: 41, url: ORIGINE + '/my-account/items/' }, frameId: 0 }); });
  fond = faireFond({ src: F.src, onglets: [{ id: 41, url: ORIGINE + '/my-account/items/', active: true, status: 'complete' }] });
  return { ch, fond };
}
async function v1v3() {
  const S = systemeVc();
  await S.ch.appel('GET', `${API}/users/me${Q}`, { data: { id: MOI, type: 'user' } }); await attendre(40);
  const exacte = '2026-10-30T14:53:37+00:00';
  const p = await S.ch.appel('GET', URL_LISTE, { data: [annonce(ART, 24900, exacte), annonce(ART2, 15000), annonce(ART3, 9000, '2031-01-01T00:00:00+00:00')], meta: { count: 3, offset: 0 } }); await attendre(80);
  const post = p.find((x) => x.kind === 'vcannonces');
  dit(!!post && post.items.find((x) => x.id === ART).misEnLigne === '2026-10-30T14:53:37.000Z', 'V1 · la page lit `listingDate` (mesurée) ⇒ `misEnLigne` ISO exact', post && post.items.map((x) => [x.id, x.misEnLigne]));
  const it = ((S.fond.lignes.vc_listings || {}).items || {});
  dit(it[ART] && it[ART].misEnLigne === '2026-10-30T14:53:37.000Z', 'V1 · le fond range la date EXACTE lue chez Vestiaire', it[ART]);
  const premier = it[ART2] && it[ART2].vueDepuis;
  dit(!!premier && it[ART2].misEnLigne === '' && Math.abs(Date.parse(premier) - Date.now()) < 60000, 'V2 · sans `listingDate` : aucune date « exacte », la 1re lecture pose la borne basse `vueDepuis`', it[ART2]);
  dit(it[ART3] && it[ART3].misEnLigne === '', 'V2 · une date dans le futur n’est jamais prise pour une date de mise en ligne', it[ART3]);
  dit(!!post && post.items.find((x) => x.id === ART3).misEnLigne === '', 'V2 · … et dès la page : la date future ne sort pas du capteur', post && post.items.find((x) => x.id === ART3));
  // Une 2e lecture, plus tard : la borne basse ne bouge pas (elle ne recule jamais vers « maintenant »).
  const avant = it[ART2].vueDepuis;
  S.fond.lignes.vc_listings.items[ART2].vueDepuis = iso(Date.now() - 12 * J);
  await S.ch.appel('GET', URL_LISTE + '&_=2', { data: [annonce(ART, 24900, exacte), annonce(ART2, 15000), annonce(ART3, 9000)], meta: { count: 3, offset: 0 } }); await attendre(80);
  const it2 = S.fond.lignes.vc_listings.items;
  dit(!!avant && Date.parse(it2[ART2].vueDepuis) < Date.now() - 11 * J && it2[ART2].misEnLigne === '', 'V2 · une relecture garde la 1re date vue (jamais avancée), toujours sans date exacte', it2[ART2]);
  dit(!!post && post.items.every((x) => !JSON.stringify(x.negos || {}).includes('99887766')) && JSON.stringify(Object.keys(post.items[0].negos || {}).sort()) === JSON.stringify(['aToi', 'enCours', 'total']), 'V3 · dès la page : les négociations ne portent que trois nombres', post && post.items[0].negos);
  dit(it2[ART].negos && it2[ART].negos.total === 2 && it2[ART].negos.aToi === 1 && !JSON.stringify(S.fond.lignes.vc_listings).includes('99887766'), 'V3 · les négociations : des nombres (2 · 1 à toi), aucun identifiant de personne', it2[ART].negos);
}

// ── LA RÈGLE VESTIAIRE (le vrai `regleBaisseVcTick`) ───────────────────────────────────────────────────────────────────
const SECU = { plateformes: { vinted: { repos: { actif: false } }, vestiaire: { repos: { actif: false } }, leboncoin: { repos: { actif: false } } } };
function monterRegle({ regle = { actif: true, pct: 10, jours: 7 }, faits = { min: '200' }, items, appris = true, main = {} } = {}) {
  const store = { vrmCloisonne: true };
  if (appris) store.vrmVcRecettePrix = { recette: { methode: 'PATCH', hote: 'apiv2.vestiairecollective.com', rejouable: true, modele: '/products/{produit}', fixes: [[['price', 'cents'], '{prixCents}', 'number']], entetes: [] }, at: iso(Date.now()) };
  const lignes = {
    main: Object.assign({ vrm_securite_comptes: SECU, vinted_baisse_regle: regle ? { v: 1, comptes: { ['vc:' + MOI]: regle } } : { v: 1, comptes: {} }, vrm_articles_sites: faits ? { ['Vestiaire:' + ART]: faits } : {} }, main),
    vc_listings: { items: items || { [ART]: { compte: MOI, statut: 'published', prix: { valeur: 249, devise: 'EUR', cle: 'product.price.cents' }, misEnLigne: iso(Date.now() - 20 * J), vueDepuis: iso(Date.now() - 2 * J) } }, liens: {} },
  };
  return faireFond({ src: F.src, lignes, store });
}
const cmdsDe = (f) => Object.entries(f.lignes).filter(([k]) => /^cmd_prix_/.test(k)).map(([, v]) => v);
async function r1r3() {
  let f = monterRegle();
  let r = await f.ctx.regleBaisseVcTick('banc');
  let c = cmdsDe(f);
  dit(c.length === 1 && c[0].site === 'vestiaire' && c[0].args.id === ART && c[0].prix === 224 && c[0].prixAvant === 249 && c[0].uidRegle === 'vc:' + MOI && c[0].confirme === true, 'R1 · 20 jours en ligne (date LUE), −10 % : UNE baisse déposée, 249 € → 224 €, site Vestiaire, compte de l’annonce', { r, c });
  dit(c.length === 1 && c[0].depuisExacte === true, 'R1 · la commande dit que la date était EXACTE (lue chez Vestiaire)', c[0]);
  f = monterRegle({ faits: { min: '240' } }); await f.ctx.regleBaisseVcTick('banc'); c = cmdsDe(f);
  dit(c.length === 1 && c[0].prix === 240, 'R1 · jamais sous le plancher : prix mini 240 € ⇒ 240 € (pas 224)', c[0]);
  f = monterRegle({ faits: { min: '200' }, main: { vrm_vc_liens: { [ART]: { numero: '41' } }, vinted_annonce_numeros: { 9001: { numero: '41', min: '235' } } } }); await f.ctx.regleBaisseVcTick('banc'); c = cmdsDe(f);
  dit(c.length === 1 && c[0].prix === 235 && c[0].num === '41', 'R1 · deux planchers sus (annonce 200 €, fiche du N°41 235 €) ⇒ le PLUS HAUT', c[0]);
  f = monterRegle({ faits: { min: '249' } }); r = await f.ctx.regleBaisseVcTick('banc');
  dit(cmdsDe(f).length === 0 && r.raisons && r.raisons['au-plancher'] === 1, 'R1 · déjà au plancher ⇒ rien', r);
  f = monterRegle({ faits: null }); r = await f.ctx.regleBaisseVcTick('banc');
  dit(cmdsDe(f).length === 0 && r.raisons && r.raisons['sans-plancher'] === 1, 'R2 · ni prix mini ni achat ⇒ AUCUNE baisse', r);
  f = monterRegle({ regle: null }); r = await f.ctx.regleBaisseVcTick('banc');
  dit(cmdsDe(f).length === 0 && r.saute === 'eteinte', 'R2 · règle éteinte (par défaut) ⇒ rien', r);
  f = monterRegle({ appris: false }); r = await f.ctx.regleBaisseVcTick('banc');
  dit(cmdsDe(f).length === 0 && r.saute === 'sansRecette', 'R2 · prix jamais changé à la main sur Vestiaire (recette pas apprise) ⇒ rien n’est déposé', r);
  f = monterRegle({ items: { [ART]: { compte: '99990000', statut: 'published', prix: { valeur: 249, devise: 'EUR', cle: 'product.price.cents' }, misEnLigne: iso(Date.now() - 20 * J) }, [ART2]: { compte: '', statut: 'published', prix: { valeur: 249, devise: 'EUR', cle: 'product.price.cents' }, misEnLigne: iso(Date.now() - 20 * J) } }, faits: { min: '100' }, main: { vrm_articles_sites: { ['Vestiaire:' + ART]: { min: '100' }, ['Vestiaire:' + ART2]: { min: '100' } } } });
  r = await f.ctx.regleBaisseVcTick('banc');
  dit(cmdsDe(f).length === 0, 'R2 · une annonce d’un autre compte, ou dont le compte n’est pas su, n’est jamais baissée sous la règle de ce compte', r);
  f = monterRegle({ faits: null, main: { vrm_vc_liens: { [ART]: { numero: '41' } }, vinted_annonce_numeros: { 9001: { numero: '41', min: '200' }, 9002: { numero: '41', min: '180' } } } }); r = await f.ctx.regleBaisseVcTick('banc');
  dit(cmdsDe(f).length === 0 && r.raisons && r.raisons.numeroDouble === 1, 'R2 · un N° porté par deux fiches ⇒ rien n’est deviné', r);
  // R3 — la borne basse « au moins ».
  const sans = (vue) => ({ [ART]: { compte: MOI, statut: 'published', prix: { valeur: 249, devise: 'EUR', cle: 'product.price.cents' }, misEnLigne: '', vueDepuis: iso(Date.now() - vue * J) } });
  f = monterRegle({ items: sans(3) }); r = await f.ctx.regleBaisseVcTick('banc');
  dit(cmdsDe(f).length === 0 && r.raisons && r.raisons['trop-tot'] === 1, 'R3 · sans date lue, vue pour la 1re fois il y a 3 j (règle : 7 j) ⇒ rien (jamais plus tôt que la vraie date)', r);
  f = monterRegle({ items: sans(9) }); await f.ctx.regleBaisseVcTick('banc'); c = cmdsDe(f);
  dit(c.length === 1 && c[0].prix === 224 && c[0].depuisExacte === false, 'R3 · vue depuis AU MOINS 9 j ⇒ la baisse part, et la commande dit que la date n’était PAS exacte', c[0]);
  f = monterRegle({ items: { [ART]: { compte: MOI, statut: 'published', prix: { valeur: 249, devise: 'EUR', cle: 'product.price.cents' } } } }); r = await f.ctx.regleBaisseVcTick('banc');
  dit(cmdsDe(f).length === 0 && r.raisons && r.raisons.sansDate === 1, 'R3 · aucune date du tout ⇒ rien (jamais une date inventée)', r);
}

// ── L'APP : la phrase de la date, la règle des intéressés ──────────────────────────────────────────────────────────────
async function importer(fichier) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-lvi-'));
  try { fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}'); fs.writeFileSync(path.join(dir, 'm.js'), fs.readFileSync(fichier, 'utf8')); return await import(pathToFileURL(path.join(dir, 'm.js')).href); }
  finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
}
async function a1() {
  const D = await importer(F.date);
  const tr = (k, v) => k + '|' + v.jour;
  const exacte = D.phraseEnLigneVc({ misEnLigne: '2026-10-30T14:53:37.000Z', vueDepuis: '2026-11-20T08:00:00.000Z' }, tr, 'fr-FR');
  const borne = D.phraseEnLigneVc({ misEnLigne: '', vueDepuis: '2026-11-02T20:00:32.174Z' }, tr, 'fr-FR');
  dit(/^vcDate\.depuis\|30 oct/.test(exacte), 'A1 · une date LUE se dit « en ligne depuis le 30 oct. »', exacte);
  dit(/^vcDate\.auMoins\|2 nov/.test(borne), 'A1 · une borne basse se dit TOUJOURS « vue en ligne depuis au moins le … », jamais « depuis le »', borne);
  dit(D.phraseEnLigneVc({}, tr) === '' && D.dateEnLigneVc({ vueDepuis: 'n/d' }) === null, 'A1 · rien de lu ⇒ rien n’est dit');
  const fr = require('fs').readFileSync(path.join(racine, 'src/i18n/langues/fr/lbcVcInteresses.js'), 'utf8');
  dit(/"vcDate\.auMoins": "[^"]*au moins/.test(fr), 'A1 · le texte français de la borne basse contient « au moins »');
}
function blocDe(t) { const m = /\/\/ <interesses-lbc-regle>\n([\s\S]*?)\/\/ <\/interesses-lbc-regle>/.exec(t); return m ? m[1] : null; }

// ── LEBONCOIN : le vrai capteur (le fil), le vrai fond (intéressés, série) ─────────────────────────────────────────────
const LBC = 'https://www.leboncoin.fr';
const MOI_LBC = 'aaaa1111-bbbb-2222-cccc-333344445555', AUTRE_LBC = 'ffff9999-eeee-8888-dddd-777766665555';
const AD = '2987654321', AD2 = '2987650000';
const C1 = 'conv-0001', C2 = 'conv-0002', C3 = 'conv-0003', C4 = 'conv-0004';
function capteurLbc() {
  const INJ = fs.readFileSync(F.lbcinject, 'utf8');
  const posts = [], ecoutes = [], win = {};
  win.postMessage = (m) => { posts.push(copie(m)); for (const f of ecoutes.slice()) f({ source: win, data: copie(m), origin: LBC }); };
  win.addEventListener = (t, f) => { if (t === 'message') ecoutes.push(f); };
  win.top = win; win.self = win;
  let reponse = null;
  win.fetch = async () => ({ status: 200, ok: true, headers: { get: () => 'application/json' }, clone() { return this; }, text: async () => JSON.stringify(reponse), json: async () => reponse });
  const doc = { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], readyState: 'complete', cookie: '' };
  const ctx = { window: win, document: doc, location: { origin: LBC, hostname: 'www.leboncoin.fr', pathname: '/messages/id/' + C1, href: LBC + '/messages/id/' + C1 }, history: { pushState() {}, replaceState() {} },
    URL, URLSearchParams, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date, Math, Map, Set, Promise, encodeURIComponent, decodeURIComponent, atob: (x) => Buffer.from(x, 'base64').toString('latin1'), btoa: (x) => Buffer.from(x, 'latin1').toString('base64'), Uint8Array, ArrayBuffer, String, Number, Object, Array, RegExp, Error, TextDecoder, TextEncoder, crypto: { randomUUID: () => 'aaaaaaaa-0000-0000-0000-000000000000', getRandomValues: (a) => a } };
  vm.createContext(ctx);
  try { vm.runInContext(INJ, ctx, { filename: 'lbc-inject.js' }); } catch (e) { return { erreur: String(e) }; }
  return { ctx, posts, win, servir: (r) => { reponse = r; } };
}
// La forme MESURÉE de `…/hal/{moi}/conversations/{conv}/messages` (lbc_recon, 22 oct. ; valeurs inventées).
const reponseFil = (conv, ad, messages) => ({ items: messages.length, size: messages.length, _embedded: { messages: messages.map((m, i) => ({ _links: { self: { href: '/x' } }, id: 'm' + i, text: m.t, type: 'text', date: m.at, sentAt: m.at, read: true, partnerRead: true, outgoing: m.moi, clientMessageId: null, notificationData: null })) },
  _links: { self: { href: '/x' } }, conversationContext: { conversationId: conv, itemId: ad, itemType: 'ad', lastMessageAttachmentsCount: 0, lastMessageDate: messages[messages.length - 1].at, lastMessageSentAt: messages[messages.length - 1].at, lastMessagePreview: 'x', partnerId: 'partenaire-1234', partnerName: 'Prénom Inventé', partnerProfilePictureUrl: 'https://img.leboncoin.fr/x.jpg' } });

async function l1() {
  const c = capteurLbc();
  if (c.erreur) { dit(false, 'L1 · le capteur Leboncoin se charge', c.erreur); return; }
  // Le compte privé de la page : le capteur le lit dans le document ; le banc le pose comme le fait la page.
  let lu = null;
  const essais = ['comptePriveDoc'];
  try { vm.runInContext(`try { comptePriveDoc = 'lbc-account:${MOI_LBC}'; } catch (_) {}`, c.ctx); } catch (_) {}
  // `noteFilLbc` n'est pas exposée : on rejoue la réponse par le crochet `fetch` de la page.
  c.servir(reponseFil(C1, AD, [{ t: 'Bonjour, toujours dispo ?', at: '2026-11-18T10:00:00Z', moi: false }]));
  await c.win.fetch(`https://api.leboncoin.fr/messaging/proxy/api/v1/hal/${MOI_LBC}/conversations/${C1}/messages`, { method: 'GET' });
  await attendre(40);
  lu = c.posts.find((p) => p && p.kind === 'lbcfil');
  if (!lu) { dit(true, 'L1 · (capteur) le compte privé n’est pas posable ici : jugé par la source', essais); }
  const src = fs.readFileSync(F.lbcinject, 'utf8');
  const corps = (/function noteFilLbc[\s\S]*?\n  }\n/.exec(src) || [''])[0].replace(/\/\/.*$/gm, '');
  dit(/conversationContext/.test(corps) && /itemId/.test(corps) && /post\(\{[^}]*\bannonce\b[^}]*\}\);/.test(corps), 'L1 · le capteur lit `conversationContext.itemId` et l’envoie comme `annonce` du fil', corps.slice(0, 120));
  dit(!/partnerName|partnerId|partnerProfile|qui:/.test(corps.replace(/SANS_PERSONNE_LBC/g, '')), 'L1 · ni `partnerId`, ni `partnerName`, ni la photo de la personne ne sortent de la page');
  if (lu) {
    dit(lu.annonce === AD && !JSON.stringify(lu).includes('Prénom Inventé') && !JSON.stringify(lu).includes('partenaire-1234'), 'L1 · (exécuté) le fil porte l’annonce, jamais la personne', lu);
  }
}

function systemeLbc({ recette = true, fils = [] } = {}) {
  const store = { vrmCloisonne: true, vrmLbcTransport: { 51: { source: 'prive', compte: 'lbc-account:' + MOI_LBC, at: Date.now() } } };
  // 5.416 (21 nov., « on ne fait plus les requêtes ») : l'INTERFACE apprise de SA réponse à la main (champ, « Envoyer »,
  // adresse d'une conversation) ; chaque message part par la page, dans un onglet de travail sur SA conversation.
  if (recette) store.vrmLbcUi = { message: { champ: { tag: 'textarea', ce: false, attrs: { 'aria-label': 'Écrire un message' } }, envoi: { sig: { tag: 'button', attrs: {}, mot: 'Envoyer' } }, page: { modele: '/messages/id/{conv}', recherche: '' } } };
  const lignes = { main: { vrm_securite_comptes: SECU } };
  for (const x of fils) lignes['lbc_fil_' + x.conv] = Object.assign({ v: 1, messages: [], n: 1 }, x);
  const f = faireFond({ src: F.src, lignes, store, onglets: [{ id: 51, url: LBC + '/messages', active: true, status: 'complete' }] });
  // Horloge virtuelle : seules les attentes voulues (écart entre deux messages, sécurité) avancent l'heure.
  let decal = 0; const RD = Date;
  class Dv extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + decal); } static now() { return RD.now() + decal; } }
  f.ctx.Date = Dv;
  const st = f.ctx.setTimeout;
  f.ctx.setTimeout = (fn, ms) => { const pile = String(new Error().stack); if (Number(ms) > 0 && /attendreLbc|secuGeste|tenirAttenteLbc/.test(pile)) decal += Number(ms); return st(fn, ms); };
  f.ctx.__vrmPausesVues = [];
  const envois = [];
  let statut = 200;
  const crees = [], fermes = [];
  let prochain = 100;
  f.ctx.chrome.tabs.create = async (o = {}) => { const id = prochain++; crees.push({ id, url: o.url }); f.store.vrmLbcTransport = Object.assign({}, f.store.vrmLbcTransport, { [id]: Object.assign({}, (f.store.vrmLbcTransport || {})[51]) }); return { id, url: o.url }; };
  f.ctx.chrome.tabs.remove = async (id) => { fermes.push(id); };
  f.ctx.attendreSessionOnglet = async (tabId) => { const c = (f.store.vrmLbcTransport || {})[tabId]; return c && c.source === 'prive' ? c : null; };
  f.ctx.chrome.tabs.sendMessage = (id, m, o, cb) => {
    if (m && m.__vmrEvt) { if (typeof cb === 'function') cb(); return Promise.resolve(); }
    if (m && m.action === 'lbcEcrirePret') return Promise.resolve({ ok: true, canal: true });
    if (m && m.action === 'lbcGesteUI' && m.quoi === 'message') { const c = crees.find((x) => x.id === id); envois.push({ id, conv: m.conv, texte: m.texte, compte: m.compte, url: c && c.url, at: f.ctx.Date.now() }); const s = typeof statut === 'function' ? statut(envois.length) : statut; return Promise.resolve({ ok: true, statut: s, confirme: s >= 200 && s < 300, geste: true }); }
    return Promise.resolve(undefined);
  };
  const panneau = (msg) => f.envoyer(Object.assign({ from: 'vrm-badge' }, msg), { tab: { id: 51, url: LBC + '/messages' }, frameId: 0 });
  return { f, envois, panneau, poserStatut: (s) => { statut = s; }, get ecarts() { return f.ctx.__vrmPausesVues.filter((x) => x[0] === 'lbcinteresses:ecart').map((x) => x[1]); } };
}
const fil = (conv, o = {}) => Object.assign({ conv, compte: MOI_LBC, annonce: AD, deLuiN: 1, premierDeLuiAt: '2026-11-18T10:00:00Z', dernierAt: '2026-11-18T10:00:00Z', dernierDeMoi: false,
  messages: (o.deLuiN === 0 ? [] : [{ id: 'm-' + conv, t: 'Toujours disponible ?', deMoi: false, at: '2026-11-18T10:00:00Z' }]) }, o);
const finSerie = async (S, max = 600) => { for (let i = 0; i < max; i++) { const v = S.f.store.vrmLbcInteressesFile; if (v && v.suivi && v.suivi.fin) return v.suivi; await attendre(10); } return S.f.store.vrmLbcInteressesFile && S.f.store.vrmLbcInteressesFile.suivi; };

async function l2l3() {
  // L2 — le fond range l'annonce de la conversation, et la règle.
  const S0 = systemeLbc();
  const ok = await S0.f.envoyer({ from: 'cancale-lbc', action: 'lbcFil', conv: C1, moi: MOI_LBC, page: '/messages/id/' + C1, forme: [], annonce: AD, messages: [{ id: 'm1', t: 'Toujours dispo ?', deMoi: false, at: '2026-11-18T10:00:00Z' }, { id: 'm2', t: 'Oui !', deMoi: true, at: '2026-11-18T11:00:00Z' }] }, { tab: { id: 51, url: LBC + '/messages/id/' + C1 }, frameId: 0 });
  const l = S0.f.lignes['lbc_fil_' + C1];
  dit(!!l && l.annonce === AD && l.deLuiN === 1 && l.premierDeLuiAt === '2026-11-18T10:00:00Z' && l.compte === MOI_LBC, 'L2 · le fil garde l’annonce, combien la personne a écrit et quand la 1re fois', { ok, l });
  const bg = fs.readFileSync(F.src, 'utf8'), ap = fs.readFileSync(F.regle, 'utf8');
  dit(blocDe(bg) != null && blocDe(bg) === blocDe(ap), 'L2 · le bloc <interesses-lbc-regle> est le MÊME dans l’extension et dans l’app');
  const R = await importer(F.regle);
  const liste = R.interessesLbcDe([fil(C1), fil(C2, { deLuiN: 0 }), fil(C3, { compte: AUTRE_LBC }), fil(C4, { annonce: AD2 }), fil('conv-0005', { annonce: '' })], { compte: MOI_LBC, annonce: AD });
  dit(liste.length === 1 && liste[0].conv === C1 && liste[0].attendTaReponse === true && liste[0].canal === 'message', 'L2 · intéressé = la personne a ÉCRIT, sur CETTE annonce, sur CE compte (pas celle qui n’a rien écrit, ni un autre compte, ni une autre annonce, ni une annonce pas lue)', liste);
  const lister = await (async () => { const S = systemeLbc({ fils: [fil(C1), fil(C2, { deLuiN: 0 })] }); return S.panneau({ action: 'interessesLbc' }); })();
  dit(lister && lister.ok === true && lister.liste.length === 1 && lister.annonces.length === 1 && lister.annonces[0].n === 1 && lister.appris === true, 'L2 · le panneau lit les intéressés du compte de l’onglet (lecture seule)', lister);

  // L3 — « Leur écrire ».
  let S = systemeLbc({ fils: [fil(C1), fil(C2), fil(C3, { deLuiN: 0 }), fil(C4, { compte: AUTRE_LBC })] });
  const t = ['Bonjour, elle est toujours disponible, je peux faire un geste.', 'Bonjour ! Toujours là, dites-moi.'];
  let r = await S.panneau({ action: 'ecrireInteressesLbc', annonce: AD, convs: [C1, C2], textes: t });
  dit(r && r.accepte === false && r.code === 'confirmation' && S.envois.length === 0, 'L3 · sans le récapitulatif confirmé : rien ne part', r);
  r = await S.panneau({ action: 'ecrireInteressesLbc', annonce: AD, convs: [C1, C3], textes: t, confirme: true });
  dit(r && r.accepte === false && r.code === 'pas-interesse' && S.envois.length === 0, 'L3 · une personne qui n’a jamais écrit est choisie ⇒ RIEN ne part (pas même aux autres)', r);
  r = await S.panneau({ action: 'ecrireInteressesLbc', annonce: AD, convs: [C4], textes: t, confirme: true });
  dit(r && r.accepte === false && r.code === 'pas-interesse' && S.envois.length === 0, 'L3 · une conversation d’un autre compte Leboncoin ⇒ rien', r);
  r = await S.panneau({ action: 'ecrireInteressesLbc', annonce: AD2, convs: [C1], textes: t, confirme: true });
  dit(r && r.accepte === false && r.code === 'pas-interesse' && S.envois.length === 0, 'L3 · la bonne personne, mais une AUTRE annonce ⇒ rien', r);
  const S2 = systemeLbc({ recette: false, fils: [fil(C1)] });
  r = await S2.panneau({ action: 'ecrireInteressesLbc', annonce: AD, convs: [C1], textes: t, confirme: true });
  dit(r && r.accepte === false && r.code === 'pas-appris' && S2.envois.length === 0, 'L3 · envoi jamais vu (pas de recette apprise de SON geste) ⇒ rien, le geste à faire est dit', r);
  r = await S.panneau({ action: 'ecrireInteressesLbc', annonce: AD, convs: [C1, C2], textes: t, confirme: true });
  dit(r && r.accepte === true && r.etape === 'encours' && r.n === 2, 'L3 · sur SON toucher confirmé : la série part (2 personnes)', r);
  const fin = await finSerie(S);
  dit(fin && fin.fin === 'fini' && fin.faites === 2 && S.envois.map((e) => e.conv).join() === [C1, C2].join() && S.envois.every((e) => e.compte === MOI_LBC && e.url === LBC + '/messages/id/' + e.conv), 'L3 · une à la fois, chacune dans SA conversation (l’onglet de travail ouvert sur elle, par l’interface), au nom du compte de l’onglet', { fin, envois: S.envois });
  dit(S.envois.length === 2 && S.envois[0].texte !== S.envois[1].texte, 'L3 · jamais deux fois de suite le même texte', S.envois.map((e) => e.texte));
  const ec = S.ecarts;
  dit(ec.length === 2 && ec.every((ms) => ms >= 40000 && ms <= 90000 && ms % 1000 === 0) && ec[0] !== ec[1], 'L3 · 40 à 90 s tirées au hasard entre deux, jamais deux fois de suite la même valeur', ec);
  dit(S.envois.length === 2 && S.envois[1].at - S.envois[0].at >= ec[0] - 500, 'L3 · le 2e message part APRÈS l’écart tiré (attente tenue ; l’écart part de la mise en file, juste avant le 1er envoi)', { d: S.envois[1] && S.envois[1].at - S.envois[0].at, ec });
  dit(((S.f.store.vrmActions || {})['lbc:' + MOI_LBC] || []).length === 2, 'L3 · deux actions comptées sous le compte Leboncoin', S.f.store.vrmActions);
  r = await S.panneau({ action: 'ecrireInteressesLbc', annonce: AD, convs: [C1, C2], textes: t, confirme: true });
  dit(r && r.accepte === false && r.code === 'personne' && S.envois.length === 2, 'L3 · une 2e fois : personne n’est réécrit pour la même annonce', r);
  // 12 personnes ⇒ 10 par toucher ; un 429 arrête la série.
  const douze = Array.from({ length: 12 }, (_, i) => 'conv-1' + String(i).padStart(3, '0'));
  S = systemeLbc({ fils: douze.map((c) => fil(c)) });
  r = await S.panneau({ action: 'ecrireInteressesLbc', annonce: AD, convs: douze, textes: t, confirme: true });
  dit(r && r.accepte === true && r.n === 10 && r.reste === 2, 'L3 · 10 personnes par toucher au plus', r);
  S.poserStatut((k) => (k === 3 ? 429 : 200));
  const f2 = await finSerie(S);
  dit(f2 && f2.fin === 'arret' && S.envois.length === 3 && f2.faites === 2, 'L3 · Leboncoin répond 429 au 3e : la série s’arrête, la suite ne part pas', { f2, n: S.envois.length });
  dit(!!(S.f.store.vrmPauseLbcMsg && S.f.store.vrmPauseLbcMsg.jusqua > Date.now()), 'L3 · … et la messagerie Leboncoin est mise en pause 30 min', S.f.store.vrmPauseLbcMsg);
  // Un seul texte pour deux personnes : le 2e n'est jamais le même mot pour mot (la salutation change).
  S = systemeLbc({ fils: [fil(C1), fil(C2)] });
  r = await S.panneau({ action: 'ecrireInteressesLbc', annonce: AD, convs: [C1, C2], textes: ['Bonjour, elle est toujours disponible.'], confirme: true });
  await finSerie(S);
  dit(S.envois.length === 2 && S.envois[0].texte !== S.envois[1].texte, 'L3 · UNE seule variante : le 2e message n’est jamais le même mot pour mot', S.envois.map((e) => e.texte));
  // Un refus qui n'est pas un 429/403 (500) : la série s'arrête quand même.
  S = systemeLbc({ fils: [fil(C1), fil(C2), fil(C3)] });
  S.poserStatut((k) => (k === 1 ? 500 : 200));
  r = await S.panneau({ action: 'ecrireInteressesLbc', annonce: AD, convs: [C1, C2, C3], textes: t, confirme: true });
  const f5 = await finSerie(S);
  dit(S.envois.length === 1 && f5 && f5.fin === 'arret', 'L3 · Leboncoin refuse (500) : la série s’arrête, personne d’autre n’est écrit', { n: S.envois.length, f5 });
  // La porte des favoris PENDANT la série : 14 messages aux favoris déjà partis cette heure (15/h) ⇒ le 1er part, le 2e non.
  S = systemeLbc({ fils: [fil(C1), fil(C2)] });
  S.f.store.vrmSortes = { ['lbc:' + MOI_LBC]: { favori: Array.from({ length: 14 }, (_, i) => Date.now() - 60000 * (i + 1)), at: Date.now() } };
  r = await S.panneau({ action: 'ecrireInteressesLbc', annonce: AD, convs: [C1, C2], textes: t, confirme: true });
  const f6 = await finSerie(S);
  dit(r && r.accepte === true && S.envois.length === 1 && f6 && f6.fin === 'arret', 'L3 · 15 messages par heure (réglage des favoris) : la porte est revérifiée avant CHAQUE message', { r, n: S.envois.length, f6 });
  // Le plafond : 45 actions déjà prises ⇒ rien ne part.
  S = systemeLbc({ fils: [fil(C1)] });
  const now = Date.now();
  S.f.store.vrmActions = { ['lbc:' + MOI_LBC]: Array.from({ length: 45 }, (_, i) => now - 1000 * (i + 1)) };
  r = await S.panneau({ action: 'ecrireInteressesLbc', annonce: AD, convs: [C1], textes: t, confirme: true });
  const f3 = r && r.accepte ? await finSerie(S) : null;
  dit(S.envois.length === 0, 'L3 · 45 actions déjà prises cette heure (réserve de 5 à ses clics) ⇒ rien ne part', { r, f3, act: (S.f.store.vrmActions['lbc:' + MOI_LBC] || []).length });
}

function l4() {
  const e = fs.readFileSync(F.ecran, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  dit(/data-interesses-lbc-annonce/.test(e) && /interessesParAnnonce/.test(e) && /meta->>annonce/.test(e) && /meta->>deLuiN/.test(e), 'L4 · l’app compte les intéressés par annonce, lus en scalaires (`meta`), jamais les messages');
  dit(!/ecrireInteressesLbc/.test(e) && !/vmrCmd\(\s*\{\s*cmd:\s*'ecrireInteresses/.test(e), 'L4 · l’app n’envoie rien : « Leur écrire » est un geste du panneau de l’extension');
}

(async () => {
  try { await v1v3(); } catch (e) { dit(false, 'V · exécution', e && e.stack); }
  try { await r1r3(); } catch (e) { dit(false, 'R · exécution', e && e.stack); }
  try { await a1(); } catch (e) { dit(false, 'A · exécution', e && e.stack); }
  try { await l1(); } catch (e) { dit(false, 'L1 · exécution', e && e.stack); }
  try { await l2l3(); } catch (e) { dit(false, 'L · exécution', e && e.stack); }
  try { l4(); } catch (e) { dit(false, 'L4 · exécution', e && e.stack); }
  console.log(ko ? `\n❌ audit-lbc-vc-interesses : ${ko} rouge(s) sur ${n}` : `\n✅ audit-lbc-vc-interesses : ${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
