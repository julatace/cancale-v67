// ════════════════════════════════════════════════════════════════════════════
//  LE CONSEILLER — LES RÈGLES, EXÉCUTÉES (23 nov.). docs/passation/2026-11-23-conseiller.md
//  Ce script EXÉCUTE (esbuild → CommonJS) src/conseiller/regles.js et src/conseiller/sources.js sur des données
//  inventées, et les propriétaires qu'ils appellent (vendsMieux, alertesSeuils, parCompteEtSite, lireValeurStock) :
//    A  chaque règle se TAIT sans données suffisantes (undefined, null, sous le seuil) — et parle au-dessus ;
//    B  les chiffres d'un conseil = ceux du propriétaire (même source que l'écran : Statistiques, Argent, Annonces) ;
//    C  la carte d'Aujourd'hui et l'écran Conseiller appellent LA même fonction de sources ; Annonces publie le nombre
//       qu'il affiche ; aucune requête IA (tranche 1 : aucun `fetch` dans src/conseiller/ hors « Demande à VRM ») ;
//    D  §3 : aucun texte de conseil refusé le 11 oct. (bonne affaire, saison, acheteur fidèle, prix à la mise en ligne…).
//  Mutation : `node scripts/audit-conseiller.cjs --mutation=<nom>` (ou `--mutation=toutes`) réaffaiblit une règle ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const NM = [path.join(R, 'node_modules'), path.join(R, '..', '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
const esbuild = require(path.join(NM, 'esbuild'));
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const RG = 'src/conseiller/regles.js', SO = 'src/conseiller/sources.js';

const MUTATIONS = {
  ambre_demain:    [RG, "ton: nAuj > 0 || nPasse > 0 ? 'aujourdhui' : 'neutre'", "ton: 'aujourdhui'"],
  ui_orange:       ['src/conseiller/Conseiller.jsx', "ton=\"neutre\" attrs={attrs}", "ton=\"ambre\" attrs={attrs}"],
  ambre_partout:   [RG, "id: 'offres', ton: 'neutre'", "id: 'offres', ton: 'aujourdhui'"],
  somme_partielle: [RG, "&& Number(offres.nSomme) === Number(offres.n) ?", "?"],
  colis_auj:       [RG, "nAuj === presses.length ? 'auj'", "nAuj > 0 ? 'auj'"],
  colis_estimee:   [RG, "c && c.estimee !== true && typeof c.jour", "c && typeof c.jour"],
  colis_loin:      [RG, "c.jour <= dem);", "c.jour <= jourIso(maintenant + 5 * JOUR));"],
  offres_vieille:  [RG, "|| !frais(offres.at, maintenant)) return null;\n  const jours", ") return null;\n  const jours"],
  baisses_zero:    [RG, "!(Number(baisses.n) > 0) ||", ""],
  prix_complet:    [RG, "if (!(manque > 0)) return null;", ""],
  racheter_min:    [RG, "x.n >= SEUILS.rachatMin && fini(x.mediane)", "fini(x.mediane)"],
  rapporte_autres: [RG, "(g) => g && g.k && g.nom && fini(g.nCout)", "(g) => g && g.nom && fini(g.nCout)"],
  rapporte_min:    [RG, "g.nCout >= SEUILS.rapporteMin &&", ""],
  dorment_min:     [RG, "dorment.valeur < SEUILS.dormentMin", "dorment.valeur < 0"],
  jour_min:        [RG, "J.total < SEUILS.joursVentesMin", "J.total < 1"],
  jour_ecart:      [RG, "if (J.n[best] < SEUILS.joursEcart * moyenne) return null;", ""],
  jour_vieux:      [RG, "x < de ||", ""],
  compte_seul:     [RG, "if (L.length < 2) return null;\n  const [a, b", "const [a, b"],
  compte_ecart:    [RG, "|| a.n < SEUILS.compteEcart * Math.max(1, b.n)", ""],
  seuil_compris:   [SO, "vues && typeof vues === 'object' ? vues : {}", "{}"],
  pub_autre:       ['src/conseiller/publications.js', "|| !owner || String(p.owner || '') !== String(owner)", ""],
  colis_vieille:   [SO, "&& publicationColisFraiche(pubE, maintenant)", ""],
};
const arg = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

let ok = 0, ko = 0, SILENCE = false;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; if (!SILENCE) console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + det : ''}`); };
const texte = (f, m) => { const t = lire(f); if (!m || m[0] !== f) return t; if (!t.includes(m[1])) throw new Error(`motif de mutation absent dans ${f} : ${m[1].slice(0, 50)}`); return t.replace(m[1], m[2]); };

async function charger(mutation) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cons-'));
  const src = (f) => JSON.stringify(path.join(R, f));
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
export * as RG from ${src(RG)};
export * as SO from ${src(SO)};
export * as PU from ${src('src/conseiller/publications.js')};
export * as VM from ${src('src/vendsMieux.js')};
export * as AS from ${src('src/alertesSeuils.js')};
export * as MO from ${src('src/aujourdhui/modele.js')};
export * as LE from ${src('src/aujourdhui/lectures.js')};
export * as OS from ${src('src/offresSansReponse.js')};
`);
  const cible = mutation ? path.join(R, mutation[0]) : null;
  const plugins = [{ name: 'mutant', setup(b) {
    b.onLoad({ filter: /\.(jsx?)$/ }, (a) => (!cible || path.resolve(a.path) !== cible ? undefined : { contents: texte(mutation[0], mutation), loader: 'jsx' }));
  } }];
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outfile: path.join(dir, 'sortie.cjs'), format: 'cjs', platform: 'node', jsx: 'automatic',
    loader: { '.js': 'jsx', '.css': 'empty' }, nodePaths: [NM], logLevel: 'silent', plugins, define: { 'process.env.NODE_ENV': '"production"' } });
  return require(path.join(dir, 'sortie.cjs'));
}

// Un localStorage d'essai (Node) : la publication d'un écran, par compte VRM.
const MEM = new Map();
global.localStorage = { getItem: (k) => (MEM.has(k) ? MEM.get(k) : null), setItem: (k, v) => MEM.set(k, String(v)), removeItem: (k) => MEM.delete(k) };
global.window = global.window || { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
global.CustomEvent = global.CustomEvent || class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };

const JOUR = 86400000;
const NOW = new Date(2026, 10, 23, 12, 0, 0).getTime();   // lundi 23 nov. 2026, midi
const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ids = (L) => L.map((c) => c.id).join(',');

async function verifier(mutation) {
  const { RG: G, SO: S, PU, VM, AS, MO, LE, OS } = await charger(mutation);
  MEM.clear();

  // ═══ A. Chaque règle se tait sans données suffisantes ═══
  dit(G.conseils(null, NOW).length === 0 && G.conseils({}, NOW).length === 0, 'A0 aucune source ⇒ aucun conseil');
  const tout = { colis: undefined, offres: undefined, seuils: undefined, baisses: undefined, stock: undefined, aRacheter: undefined, groupes: undefined, dorment: undefined, ventesTs: undefined, comptes: undefined };
  dit(G.conseils(tout, NOW).length === 0, 'A0 tout en lecture (undefined) ⇒ aucun conseil');
  const pasSu = Object.fromEntries(Object.keys(tout).map((k) => [k, null]));
  dit(G.conseils(pasSu, NOW).length === 0, 'A0 tout « pas su » (null) ⇒ aucun conseil');
  // A1 colis
  const dem = iso(NOW + JOUR), loin = iso(NOW + 4 * JOUR);
  dit(G.conseilColis({ liste: [{ num: '12', jour: dem, estimee: true }] }, NOW) === null, 'A1 colis : une limite ESTIMÉE (vente + 7 j) ne presse jamais');
  dit(G.conseilColis({ liste: [{ num: '12', jour: loin }] }, NOW) === null, 'A1 colis : une limite dans 4 jours ⇒ rien');
  dit(G.conseilColis({ liste: [] }, NOW) === null && G.conseilColis(null, NOW) === null, 'A1 colis : liste vide ou pas lue ⇒ rien');
  const C1 = G.conseilColis({ liste: [{ num: '12', jour: dem }, { num: '13', jour: iso(NOW) }, { num: '14', jour: loin }] }, NOW);
  dit(C1 && C1.params.n === 2 && C1.params.quand === 'demain' && C1.params.nAuj === 1 && C1.ton === 'aujourdhui', 'A1 colis : 2 limites lues (aujourd’hui, demain) ⇒ « 2 colis d’ici demain », dont 1 aujourd’hui (jamais « 2 aujourd’hui »)', JSON.stringify(C1));
  const C2 = G.conseilColis({ liste: [{ jour: iso(NOW) }, { jour: iso(NOW) }] }, NOW), C3 = G.conseilColis({ liste: [{ jour: iso(NOW - 2 * JOUR) }, { jour: dem }] }, NOW);
  dit(C2 && C2.params.quand === 'auj' && C2.params.n === 2 && C3 && C3.params.quand === 'passe' && C3.params.n === 1, 'A1 colis : tous aujourd’hui ⇒ « aujourd’hui » ; une limite passée ⇒ « 1 colis a passé sa date limite »', JSON.stringify([C2 && C2.params, C3 && C3.params]));
  const C4 = G.conseilColis({ liste: [{ num: '5', jour: dem }] }, NOW);
  dit(C4 && C4.ton === 'neutre' && C1.ton === 'aujourdhui' && C3.ton === 'aujourdhui', 'A1 « aujourd’hui » seulement pour une limite aujourd’hui ou passée ; « demain » seul reste neutre');
  // A2 offres
  dit(G.conseilOffres({ n: 3, at: NOW - 3 * JOUR }, NOW) === null, 'A2 offres : publication de plus de 24 h ⇒ rien');
  dit(G.conseilOffres({ n: 0, at: NOW }, NOW) === null, 'A2 offres : 0 offre ⇒ rien');
  const O1 = G.conseilOffres({ n: 3, at: NOW - 3600000, plusAncienne: NOW - 2.5 * JOUR }, NOW);
  dit(O1 && O1.params.n === 3 && O1.params.jours === 2, 'A2 offres : 3 offres, la plus ancienne il y a 2 j', JSON.stringify(O1));
  // A3 baisses / prix / dorment
  dit(G.conseilBaisses({ n: 0, at: NOW }, NOW) === null && G.conseilBaisses({ n: 4, at: NOW - 2 * JOUR }, NOW) === null, 'A3 baisses : 0, ou publication périmée ⇒ rien');
  dit((G.conseilBaisses({ n: 4, at: NOW - 60000 }, NOW) || {}).params?.n === 4, 'A3 baisses : 4 baisses publiées par Annonces ⇒ « 4 paires à baisser »');
  dit(G.conseilPrix({ n: 20, nPrix: 20 }) === null && G.conseilPrix({ n: 20 }) === null, 'A3 prix : tout saisi, ou pas lu ⇒ rien');
  dit((G.conseilPrix({ n: 20, nPrix: 14 }) || {}).params?.n === 6, 'A3 prix : 6 prix d’achat manquent sur 20');
  dit(G.conseilDorment({ valeur: 4 }) === null && G.conseilDorment({ valeur: null }) === null, 'A3 dorment : 4 paires (sous 5), ou pas su ⇒ rien');
  const D1 = G.conseilDorment({ valeur: 9, partiel: true });
  dit(D1 && D1.params.n === 9 && D1.params.auMoins === 1, 'A3 dorment : 9 paires, lecture partielle ⇒ « au moins 9 »');
  // A4 racheter / rapporte
  dit(G.conseilRacheter([{ k: 'a', nom: 'Adidas Samba', n: 2, moyen: 30, mediane: 5 }]) === null, 'A4 racheter : 2 ventes ⇒ rien');
  dit(G.conseilRacheter([{ k: 'a', nom: 'Adidas Samba', n: 4, moyen: -2, mediane: 5 }]) === null, 'A4 racheter : bénéfice moyen négatif ⇒ rien');
  dit(G.conseilRapporte([{ k: '', nom: 'Autres', nCout: 9, moyen: -5 }]) === null, 'A4 rapporte : « Autres » (non reconnus) n’est jamais nommé');
  dit(G.conseilRapporte([{ k: 'b', nom: 'Nike Dunk', nCout: 2, moyen: -5 }]) === null, 'A4 rapporte : 2 ventes au prix connu ⇒ rien');
  dit((G.conseilRapporte([{ k: 'b', nom: 'Nike Dunk', nCout: 4, moyen: -3.5 }, { k: 'c', nom: 'Vans', nCout: 5, moyen: 12 }]) || {}).params?.nom === 'Nike Dunk', 'A4 rapporte : Nike Dunk, 4 ventes, −3,50 € ⇒ nommé');
  // A5 jour de la semaine
  const tsJours = (n, jourSem, autres) => { const L = []; let t = NOW - JOUR; while (L.length < n) { if (new Date(t).getDay() === jourSem) L.push(t); t -= JOUR / 4; if (t < NOW - 89 * JOUR) t = NOW - JOUR; } for (let i = 0; i < autres; i++) L.push(NOW - (i % 80 + 1) * JOUR - 3600000); return L; };
  dit(G.conseilJour(tsJours(10, 0, 20), NOW) === null, 'A5 jour : 30 ventes datées (sous 40) ⇒ rien');
  const egal = []; for (let i = 0; i < 84; i++) egal.push(NOW - (i + 1) * JOUR); dit(G.conseilJour(egal, NOW) === null, 'A5 jour : ventes réparties également ⇒ rien');
  const vieux = tsJours(30, 0, 40).map((t) => t - 120 * JOUR); dit(G.conseilJour(vieux, NOW) === null, 'A5 jour : ventes de plus de 90 j ⇒ ignorées');
  const J1 = G.conseilJour(tsJours(30, 0, 40), NOW);
  dit(J1 && J1.params.jour === 0 && J1.params.veille === 6 && J1.params.total === 70, 'A5 jour : 30 ventes le dimanche sur 70 ⇒ « surtout le dimanche », republier le samedi', JSON.stringify(J1 && J1.params));
  // A6 compte
  dit(G.conseilCompte([{ nom: 'shop_a', n: 9 }]) === null, 'A6 compte : un seul compte ⇒ rien');
  dit(G.conseilCompte([{ nom: 'shop_a', n: 4 }, { nom: 'shop_b', n: 1 }]) === null, 'A6 compte : 4 ventes (sous 5) ⇒ rien');
  dit(G.conseilCompte([{ nom: 'shop_a', n: 9 }, { nom: 'shop_b', n: 7 }]) === null, 'A6 compte : 9 contre 7 (pas net) ⇒ rien');
  dit((G.conseilCompte([{ nom: 'shop_b', n: 3 }, { nom: 'shop_a', n: 12 }]) || {}).params?.nom === 'shop_a', 'A6 compte : shop_a 12 contre 3 ⇒ nommé');
  // A7 classement et carte
  const L = G.conseils({ colis: { liste: [{ jour: dem }] }, dorment: { valeur: 8 }, stock: { n: 3, nPrix: 1 }, baisses: { n: 2, at: NOW }, comptes: null }, NOW);
  dit(ids(L) === 'colis,baisses,prix,dorment' && G.pourCarte(L).length === 3, 'A7 l’urgent d’abord (colis, baisses, prix, dorment) ; la carte en montre 3', ids(L));

  // A8 l'ambre, les groupes, la phrase du jour
  const tous = G.conseils({ colis: { liste: [{ jour: dem }] }, offres: { n: 2, at: NOW, somme: 130, nSomme: 2 }, seuils: [{ seuil: 'tva', palier: 80, pct: 82 }], stock: { n: 10, nPrix: 4 }, dorment: { valeur: 9 }, ventesTs: null }, NOW);
  dit(tous.every((c) => c.ton === 'neutre'), 'A8 sans limite aujourd’hui, AUCUN conseil « aujourd’hui » (offres, seuil, prix, colis de demain)', tous.map((c) => c.id + ':' + c.ton).join(','));
  const Gp = G.grouper(tous);
  dit(Gp.faire.map((c) => c.id).join() === 'colis,offres,prix' && Gp.gagner.map((c) => c.id).join() === 'dorment' && Gp.savoir.map((c) => c.id).join() === 'seuil', 'A8 trois groupes : à faire aujourd’hui · pour gagner plus · à savoir', JSON.stringify(Object.fromEntries(Object.entries(Gp).map(([k, v]) => [k, v.map((c) => c.id)]))));
  const Sy = G.syntheseDuJour(tous);
  dit(Sy.faire === 3 && Sy.gagner === 1 && Sy.sommeOffres === 130, 'A8 la phrase du jour : 3 gestes, 1 piste, 130 € d’offres (la somme publiée, entière)', JSON.stringify(Sy));
  const Sy2 = G.syntheseDuJour(G.conseils({ offres: { n: 3, at: NOW, somme: 130, nSomme: 2 } }, NOW));
  dit(Sy2.sommeOffres === null, 'A8 une offre sans montant lu ⇒ AUCUNE somme (jamais un total partiel présenté comme complet)', JSON.stringify(Sy2));
  dit(G.syntheseDuJour([]).faire === 0 && G.syntheseDuJour([]).sommeOffres === null, 'A8 rien ⇒ 0 geste, aucune somme');
  const V = (id) => (tous.find((c) => c.id === id) || {}).visuel;
  dit(V('seuil') && V('seuil').type === 'barre' && V('seuil').pct === 82 && V('prix') && V('prix').pct === 40, 'A8 mini-visuels : barre du seuil (82 %), barre des prix saisis (4/10 = 40 %)', JSON.stringify([V('seuil'), V('prix')]));

  // ═══ B. Même source que l'écran : les propriétaires, exécutés ═══
  const uid = '11111111-1111-1111-1111-111111111111';
  const MODS = [['Adidas', 'Adidas Samba OG noir'], ['Nike', 'Nike Dunk Low panda'], ['New Balance', 'New Balance 550 blanche'], ['Asics', 'Asics Gel-Kayano 14']];
  const rows = [], txn = {}, items = {};
  let k = 0;
  for (let i = 0; i < 48; i++) {
    const [marque, titre] = MODS[i % 4];
    const ts = NOW - (i + 1) * 1.5 * JOUR, id = 'tx' + i, item = 'it' + i;
    const achat = i % 4 === 1 ? 70 : 40, eur = i % 4 === 1 ? 65 : 80;
    rows.push(['Vinted', i % 3 ? 'shop_a' : 'shop_b', id, ts, eur, achat, 4, titre]);
    txn[id] = { item }; items[item] = { id: item, brand: marque, size: '42', title: titre, listed: ts - (5 + (i % 4)) * JOUR };
    k++;
  }
  const extras = { txn, items, dates: null };
  const enLigne = (it) => it.listed;
  const ligneUrssaf = { mois: [{ ym: '2026-01', ca: 70000, n: 400, parPlateforme: { Vinted: { ca: 70000, n: 400 } } }] };
  const store = { vinted_urssaf_mois: ligneUrssaf, vrm_seuils_vus: {}, vrm_colis_aposter: { at: NOW - 3600000, total: 2, liste: [{ num: '7', jour: iso(NOW), nom: 'Samba' }, { num: '8', jour: dem, estimee: true }] } };
  const o = { uid: () => uid, load: (kk) => (kk in store ? store[kk] : null), regime: () => 'micro', enLigne };
  localStorage.setItem(OS.CLE_PUB_OSR, JSON.stringify({ owner: uid, n: 2, plusAncienne: NOW - 3 * JOUR, at: NOW - 60000 }));
  PU.publierBaisses(5, { owner: uid, lu: true, maintenant: NOW - 60000 });
  localStorage.setItem('vrm_valeur_stock', JSON.stringify({ owner: uid, n: 30, nPrix: 25, nSans: 5, c: 120000, at: NOW }));
  const valeurSel = (id) => (id === 'dorment' ? { valeur: 11, partiel: false } : { valeur: null });
  const live = { venduLignes: rows.map((r) => ({ plateforme: 'Vinted', compte: r[1], tx: r[2], ts: r[3] })) };
  const valeurComptes = (id, p, sel) => { const c = sel && sel.compte ? sel.compte.login : null; const n = live.venduLignes.filter((l) => (!c || l.compte === c) && l.ts >= p.de && l.ts < p.a).length; return { valeur: n }; };
  const src = S.sourcesConseiller({ o, valeurSel: (id, p, sel) => (id === 'dorment' ? valeurSel(id) : valeurComptes(id, p, sel)), live, L: { releve: rows, extras }, maintenant: NOW });
  // Le propriétaire, appelé comme Statistiques › Finances (vendsMieux sur les lignes du relevé de la fenêtre).
  const lignes = LE.lignesReleve(rows, extras, enLigne).filter((l) => l.ts >= NOW - 90 * JOUR && l.ts <= NOW + 60000);
  const VMx = VM.vendsMieux({ lignes, annonces: null, de: NOW - 90 * JOUR, a: NOW + 1 }).modele;
  const Lc = G.conseils(src, NOW);
  const cR = Lc.find((c) => c.id === 'racheter');
  dit(!!cR && VMx.aRacheter.length > 0 && cR.chiffres.k === VMx.aRacheter[0].k && cR.chiffres.moyen === VMx.aRacheter[0].moyen && cR.chiffres.mediane === VMx.aRacheter[0].mediane && cR.chiffres.n === VMx.aRacheter[0].n,
    'B1 « Rachète » = le 1er « à racheter » de Statistiques (même modèle, même bénéfice moyen, même médiane)', JSON.stringify({ c: cR && cR.chiffres, vm: VMx.aRacheter[0] }));
  const cP = Lc.find((c) => c.id === 'rapporte');
  const gNeg = VMx.groupes.filter((g) => g.k && g.nCout >= 3 && g.moyen <= 0).sort((a, b) => a.moyen - b.moyen)[0];
  dit(!!cP && !!gNeg && cP.chiffres.k === gNeg.k && cP.chiffres.moyen === gNeg.moyen, 'B2 « ne rapporte rien » = le groupe du classement de Statistiques (Nike Dunk, même bénéfice moyen)', JSON.stringify({ c: cP && cP.chiffres, g: gNeg && { k: gNeg.k, moyen: gNeg.moyen } }));
  const AL = AS.alertesADire(AS.alertesSeuils({ ligne: ligneUrssaf, now: new Date(NOW), regime: 'micro', activite: 'vente' }), {});
  const cS = Lc.find((c) => c.id === 'seuil');
  const top = [...AL].sort((a, b) => b.palier - a.palier)[0];
  dit(!!cS && !!top && cS.chiffres.seuil === top.seuil && cS.chiffres.pct === top.pct, 'B3 seuil = la règle d’Argent (alertesSeuils + alertesADire)', JSON.stringify({ c: cS && cS.chiffres, a: top && { s: top.seuil, pct: top.pct } }));
  store.vrm_seuils_vus = Object.fromEntries(AL.flatMap((a) => (a.marquer || [a.cle]).map((x) => [x, NOW])));
  const src2 = S.sourcesConseiller({ o, valeurSel: (id, p, sel) => (id === 'dorment' ? valeurSel(id) : valeurComptes(id, p, sel)), live, L: { releve: rows, extras }, maintenant: NOW });
  dit(!G.conseils(src2, NOW).some((c) => c.id === 'seuil'), 'B3 seuil « Compris » dans Argent ⇒ le Conseiller ne le redit pas');
  store.vrm_seuils_vus = {};
  const src3 = S.sourcesConseiller({ o: { ...o, regime: () => undefined }, valeurSel: () => ({ valeur: null }), live: null, L: { releve: undefined, extras: undefined }, maintenant: NOW });
  dit(!G.conseils(src3, NOW).some((c) => c.id === 'seuil' || c.id === 'racheter' || c.id === 'dorment' || c.id === 'compte'), 'B3 régime pas lu, relevé en lecture, ventes pas lues ⇒ ni seuil, ni rachat, ni dorment, ni compte');
  const cC = Lc.find((c) => c.id === 'colis');
  dit(!!cC && cC.chiffres.n === 1, 'B4 colis = la liste publiée par Ventes : 1 limite lue aujourd’hui (l’estimée écartée)', JSON.stringify(cC && cC.chiffres));
  store.vrm_colis_aposter = { ...store.vrm_colis_aposter, at: NOW - 13 * 3600000 };
  dit(!G.conseils(S.sourcesConseiller({ o, valeurSel: () => ({ valeur: null }), live: null, L: { releve: null, extras: null }, maintenant: NOW }), NOW).some((c) => c.id === 'colis'), 'B4 publication de Ventes de plus de 12 h ⇒ aucun conseil colis');
  const cO = Lc.find((c) => c.id === 'offres'), cB = Lc.find((c) => c.id === 'baisses'), cX = Lc.find((c) => c.id === 'prix'), cD = Lc.find((c) => c.id === 'dorment');
  dit(cO && cO.chiffres.n === 2 && cB && cB.chiffres.n === 5 && cX && cX.chiffres.manque === 5 && cD && cD.chiffres.n === 11, 'B5 offres 2, baisses 5, prix 5 sur 30, dorment 11 = les publications des écrans', JSON.stringify([cO, cB, cX, cD].map((c) => c && c.chiffres)));
  const autre = '22222222-2222-2222-2222-222222222222';
  dit(PU.lirePub(PU.CLE_PUB_BAISSES, autre) === null, 'B5 la publication d’un AUTRE compte VRM (même appareil) ne compte pas');
  dit(PU.publierBaisses(3, { owner: uid, lu: false }) === false, 'B5 annonces pas lues ⇒ Annonces ne publie rien (un 0 publié est un fait)');
  const cK = Lc.find((c) => c.id === 'compte');
  const nA = live.venduLignes.filter((l) => l.compte === 'shop_a' && l.ts >= NOW - 30 * JOUR).length, nB = live.venduLignes.filter((l) => l.compte === 'shop_b' && l.ts >= NOW - 30 * JOUR).length;
  dit(!!cK && cK.chiffres.nom === 'shop_a' && cK.chiffres.n === nA && cK.chiffres.n2 === nB, 'B6 compte = la table par compte de Statistiques (parCompteEtSite, 30 j)', JSON.stringify({ c: cK && cK.chiffres, nA, nB }));
  dit(!JSON.stringify(src.resume || {}).match(/acheteur|buyer|login|tx\d/), 'B7 le résumé pour « Demande à VRM » ne porte aucun acheteur, aucune transaction');

  // ═══ C. Une source, aucune IA ═══
  const bA = lire('src/aujourdhui/Branche.jsx'), bC = lire('src/conseiller/Branche.jsx');
  dit(/sourcesConseiller\(/.test(bA) && /sourcesConseiller\(/.test(bC), 'C1 la carte d’Aujourd’hui et l’écran Conseiller appellent LA même fonction de sources');
  const cpt = lire('src/ecrans/Comptabilite.jsx');
  dit(/publierBaisses\(nBaissesConseillees,/.test(cpt) && /<EntreeBaissesConseillees n=\{nBaissesConseillees\}/.test(cpt), 'C2 Annonces publie LE nombre qu’affiche « Baisses conseillées »');
  dit(/publierOffresSansReponse\(offresSR,/.test(cpt), 'C2 Messages publie la liste des offres sans réponse qu’il affiche (la source du conseil « offres »)');
  const dossier = fs.readdirSync(path.join(R, 'src', 'conseiller')).filter((f) => /\.(js|jsx)$/.test(f));
  const sansCom = (t) => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const avecFetch = dossier.filter((f) => /\bfetch\s*\(|api\/ai|XMLHttpRequest/.test(sansCom(lire('src/conseiller/' + f))));
  dit(avecFetch.every((f) => f === 'DemandeVRM.jsx' || f === 'cleClaude.js'), 'C3 aucune requête réseau dans les règles et les écrans du Conseiller (seule « Demande à VRM » peut en faire)', avecFetch.join(','));
  dit(!/\bsave\(|fetch\(|withOwner|modifierCle|setItem\(|numero\s*=/.test(sansCom(lire(SO))), 'C4 sources.js ne fait que LIRE (aucune écriture, aucun lien, aucun N°)');
  dit(!/\bfetch\s*\(/.test(sansCom(lire(RG))) && !/localStorage|fetch/.test(sansCom(lire(RG))), 'C4 regles.js est PUR (aucune lecture, aucune écriture)');

  const ui = ['src/conseiller/Conseiller.jsx', 'src/conseiller/conseiller.css', 'src/conseiller/Presentation.jsx', 'src/conseiller/DemandeVRM.jsx', 'src/conseiller/demande.css'].filter((f) => fs.existsSync(path.join(R, f))).map((f) => sansCom(lire(f))).join('\n');
  dit(!/ambre|--n-ambre|orange|#f[0-9a-f]{2}[0-9a-f]{0,3}\b/i.test(ui.replace(/\/\*[\s\S]*?\*\//g, '')), 'C5 Julien (23 nov.) : AUCUN orange dans l’écran du Conseiller (ni ton ambre, ni jeton ambre, ni couleur en dur)');
  // ═══ D. §3 : les refus du 11 octobre ═══
  const fr = lire('src/i18n/langues/fr/conseiller.js').toLowerCase();
  const interdits = ['bonne affaire', 'saison', 'fidèle', 'prix conseillé', 'jamais arrivé', 'argent bloqué', 'évaluation', 'sans réponse depuis'];
  dit(!interdits.some((x) => fr.includes(x)), 'D1 aucun conseil refusé le 11 oct. (bonne affaire, saisonnalité, acheteurs fidèles, prix à la mise en ligne…)', interdits.filter((x) => fr.includes(x)).join(','));
  dit(G.IDS.length === 10 && G.IDS.every((i) => G.GESTES[i]), 'D2 la liste des conseils et de leurs gestes est FERMÉE (10)');
  const gestes = lire('src/conseiller/gestes.js');
  dit(!/accepter|refuser|baisserPrix|vmrCmd|executerCommande/.test(sansCom(gestes)), 'D3 un geste OUVRE un écran ; aucun ne fait l’action (offre, baisse, envoi)');
}

(async () => {
  if (arg) {
    const noms = arg === 'toutes' ? Object.keys(MUTATIONS) : arg.split(',');
    let tuees = 0;
    for (const n of noms) {
      ok = 0; ko = 0; SILENCE = true;
      try { await verifier(MUTATIONS[n]); } catch (e) { ko++; }
      SILENCE = false;
      console.log(`${ko > 0 ? '✅' : '❌'} mutation ${n} : ${ko > 0 ? 'vue (' + ko + ' rouge)' : 'PAS VUE'}`);
      if (ko > 0) tuees++;
    }
    console.log(`\n${tuees}/${noms.length} mutations vues`);
    process.exit(tuees === noms.length ? 0 : 1);
  }
  await verifier(null);
  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌', e && e.stack || e); process.exit(1); });
