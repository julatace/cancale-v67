#!/usr/bin/env node
// ── audit-recherche-tolerante — LA LOUPE PARDONNE UNE FAUTE (16 novembre) ─────
// Julien (validé) : « la loupe trouve tout — air max 42, 124, B124, tomj606, un n° de
// suivi, un code de retrait, un n° de transaction — MÊME avec une faute de frappe ou
// sans accent ». Exécute la VRAIE règle (src/rechercheUnique.js, et la pastille de
// src/rechercheEcran.js) sur des données INVENTÉES à la forme lue par l'app.
// Ce qu'il exige :
//   · un mot du titre tapé avec une faute trouve sa paire / vente / achat
//     (« air mxa » ⇒ Air Max ; « jordn chicgo » ⇒ Jordan Chicago ; « gazele ») ;
//     sans accent aussi (« medicis » ⇒ « Médicis ») ;
//   · combien de fautes : 3-4 lettres = deux voisines inversées seulement ; 5-7 = une ;
//     8 et plus = deux (« slmon » n'est pas Salomon, « nikr » n'est pas Nike) ;
//   · ⚠️ §5 : AUCUNE identité n'est tolérée — N°, suivi, code de retrait, transaction,
//     montant, et un mot à CHIFFRES (« 43 » n'est pas la 42) : égalité seulement ;
//   · une trouvaille « à une faute près » n'est JAMAIS exacte, passe APRÈS toute
//     trouvaille exacte, ouvre SON objet (sa transaction), dit le mot compris (« ≈ … ») ;
//   · 50 paires au même titre : « 124 » met LA N°124 en tête, seule ; « B124 », « 007 » ;
//   · un pseudo à une faute près (« tmoj606 » ⇒ tomj606), après le pseudo exact — jamais
//     sur un CHIFFRE (« tomj660 » n’est pas tomj606) ;
//   · rapide : 20 000 ventes, index construit une fois, < 50 ms par frappe (mesuré).
//   node scripts/audit-recherche-tolerante.cjs [--mutation=NOM | --prouve]
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src', 'rechercheUnique.js');
const ECRAN = path.join(__dirname, '..', 'src', 'rechercheEcran.js');

const MUTATIONS = {
  // Plus aucune tolérance (la loupe d'avant).
  'sans-tolerance': ['const tolere = cents == null && tolerance !== false &&', 'const tolere = false &&'],
  // Un code de retrait comparé « à peu près » : le casier d'un autre colis.
  'code-tolere': ['const c = e.codes.find((x) => x === qa);', 'const c = e.codes.find((x) => x === qa || distanceFautes(x, qa, 1) <= 1);'],
  // Le suivi comparé à une faute près.
  'suivi-tolere': ['const s = e.suivis.find((x) => x.includes(qa));', 'const s = e.suivis.find((x) => x.includes(qa) || distanceFautes(x, qa, 1) <= 1);'],
  // Une trouvaille approchée rangée devant le titre exact.
  'proche-devant': ['const RANG_PROCHE = { pseudo: 4.6, titre: 4.8 };', 'const RANG_PROCHE = { pseudo: 2.6, titre: 2.8 };'],
  // Une trouvaille approchée dite « exacte ».
  'proche-exact': ["trouve.push({ e, par: 'titre', exact: false, proche: true, valeur: pardonne,", "trouve.push({ e, par: 'titre', exact: true, proche: true, valeur: pardonne,"],
  // Une faute pardonnée aux mots de 3-4 lettres (« nikr » ⇒ Nike).
  'courts-toleres': ['return n >= 8 ? 2 : n >= 5 ? 1 : -1;', 'return n >= 8 ? 2 : n >= 3 ? 1 : -1;'],
  // Deux fautes pardonnées dès 5 lettres (« slmon » ⇒ Salomon).
  'deux-fautes-partout': ['return n >= 8 ? 2 : n >= 5 ? 1 : -1;', 'return n >= 5 ? 2 : -1;'],
  // L'inversion de deux voisines oubliée (« mxa » ne trouve plus « max »).
  inversion: ['  if (k < 0) return inversionVoisine(m, w);', '  if (k < 0) return false;'],
  // Les mots à chiffres tolérés (« 43 » ⇒ la 42).
  'chiffres-2': ["  if (!/^[a-z]+$/.test(str(mot)) || n < 3) return 0;", "  if (n < 1) return 0;"],
  // Le vocabulaire refait à chaque frappe (plus de mémo) : trop lent.
  'vocab-memo': ['  let v = _vocab.get(index);\n  if (v) return v;', '  let v = null;'],
  // Le pseudo approché oublié.
  // Un chiffre de pseudo pardonné (« acheteur_1998 » ⇒ acheteur_1999 : une autre personne).
  'pseudo-chiffres': ['  if (chiffresDe(m) !== chiffresDe(p)) return false;\n', ''],
  'pseudo-proche': ["if (pseudoTape && e.pseudos.length) {", "if (false && pseudoTape && e.pseudos.length) {"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src = src.replace(m[0], m[1]);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rech-tol-'));
  const f = path.join(dir, 'r.mjs'); fs.writeFileSync(f, src);
  const fe = path.join(dir, 'e.mjs'); fs.writeFileSync(fe, fs.readFileSync(ECRAN, 'utf8'));
  let R, E; try { R = await import(pathToFileURL(f).href); E = await import(pathToFileURL(fe).href); } catch (e) { console.log('❌ la règle ne se charge pas : ' + e.message); process.exit(1); }
  fs.rmSync(dir, { recursive: true, force: true });
  let ko = 0;
  const dit = (c, msg, det) => { if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 300) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; console.log('❌ ' + nom + ' a levé : ' + e.message); } };

  // ── Les données (inventées) : 50 paires au même titre, quelques ventes, un colis ──
  const T = 'Jordan 1 Mid Chicago taille 42';
  const fiches = {};
  for (let i = 101; i <= 150; i++) fiches['it' + i] = { numero: String(i), title: T, price: '80', accountId: '1' };
  fiches.itb124 = { numero: 'B124', title: 'Asics Gel Kayano 14 argent', price: '95', accountId: '1' };
  fiches.it7 = { numero: '7', title: 'Puma Speedcat rouge', price: '60', accountId: '1' };
  fiches.it1124 = { numero: '1124', title: 'New Balance 550 blanc', price: '70', accountId: '1' };
  const ventes = [
    { transaction_id: 22000000777, title: 'Nike Air Max 90 blanche taille 42', date: '2026-11-10T10:00:00Z', price: { amount: '52.0' } },
    { transaction_id: 22000000778, title: 'Adidas Gazelle bleu taille 41', date: '2026-11-09T10:00:00Z' },
    { transaction_id: 22000000779, title: 'Salomon XT-6 noir taille 43', date: '2026-11-08T10:00:00Z' },
    { transaction_id: 22000000780, title: 'Asics Gel Kayano 14', date: '2026-11-07T10:00:00Z' },
    { transaction_id: 22000000781, title: 'Asics Gel Kayamo 14 copie', date: '2026-11-11T10:00:00Z' },
    { transaction_id: 22000000782, title: 'Mocassins Médicis cuir', date: '2026-11-06T10:00:00Z' },
  ];
  const achats = [{ transaction_id: 23000000001, title: 'Nike Air Max 1 rouge', date: '2026-11-05T10:00:00Z' }];
  const pseudos = [{ tx: '22000000778', pseudo: 'tomj606' }, { tx: '22000000779', pseudo: 'tomj660x' }, { tx: '22000000780', pseudo: 'tmoj606' }];
  const bordereaux = [{ tx: '22000000777', suivi: 'XW300000777FR' }];
  const colis = [{ id: 'email_track_1', suivi: 'MR7000123', code: '500123', status: 'available', sens: 'entrant', art: 'Colis Asics', carrier: 'mondialrelay', at: '2026-11-12T08:00:00Z' }];
  const idx = R.indexRecherche({ ventes, achats, pseudos, bordereaux, colis, fiches, annonces: [] });
  const c = (q, o) => R.chercherPartout(idx, q, o);
  const cles = (r, g) => r.groupes[g].map((x) => x.e.cle);
  const tous = (r) => Object.values(r.groupes).flat();

  essaie('fautes de frappe', () => {
    const a = c('air mxa');
    dit(cles(a, 'vente').join() === 'vente:22000000777' && cles(a, 'achat').join() === 'achat:23000000001', '« air mxa » (deux voisines inversées) ⇒ la vente ET l’achat Air Max', [cles(a, 'vente'), cles(a, 'achat')]);
    dit(a.groupes.vente[0] && a.groupes.vente[0].proche === true && a.groupes.vente[0].par === 'titre' && a.groupes.vente[0].valeur === 'max', '… trouvée « à une faute près » (proche, par le titre, mot compris « max »)', a.groupes.vente[0] && { par: a.groupes.vente[0].par, proche: a.groupes.vente[0].proche, valeur: a.groupes.vente[0].valeur });
    const j = c('jordn chicgo');
    dit(j.totaux.paire === 50 && j.groupes.paire.every((x) => x.proche && !x.exact), '« jordn chicgo » ⇒ les 50 paires Jordan Chicago (proches, jamais exactes)', j.totaux);
    dit(cles(c('gazele'), 'vente').join() === 'vente:22000000778', '« gazele » (une lettre en moins) ⇒ Gazelle', cles(c('gazele'), 'vente'));
    dit(cles(c('salomn'), 'vente').join() === 'vente:22000000779', '« salomn » ⇒ Salomon', cles(c('salomn'), 'vente'));
    dit(cles(c('nkie air'), 'vente').join() === 'vente:22000000777', '« nkie air » (inversion, 4 lettres) ⇒ Nike Air', cles(c('nkie air'), 'vente'));
    dit(cles(c('medicis'), 'vente').join() === 'vente:22000000782', 'sans accent : « medicis » ⇒ « Médicis »', cles(c('medicis'), 'vente'));
    dit(cles(c('MÉDICIS'), 'vente').join() === 'vente:22000000782', 'avec accent et majuscules : « MÉDICIS » ⇒ « Médicis »');
  });

  essaie('combien de fautes', () => {
    dit(c('nikr').total === 0, '« nikr » (4 lettres, lettre changée) : rien — seule une inversion se pardonne si court', tous(c('nikr')).map((x) => x.e.cle));
    dit(c('slmon').total === 0, '« slmon » (5 lettres, deux fautes) : rien — une seule faute de 5 à 7 lettres', tous(c('slmon')).map((x) => x.e.cle));
    dit(R.motProche('chicagooo', 'chicago') && R.motProche('chicagxx', 'chicago') && !R.motProche('chiicagooo', 'chicago') && R.motProche('chcago', 'chicago') && !R.motProche('chcagoo', 'chicago'), '8 lettres et plus : deux fautes, pas trois');
    dit(R.motProche('mxa', 'max') && !R.motProche('mxa', 'mxe') && !R.motProche('ma', 'am'), 'court : l’inversion seule (et rien sous 3 lettres)');
  });

  essaie('identités jamais tolérées', () => {
    const s = c('XW300000778FR');
    dit(!tous(s).some((x) => x.e.cle === 'vente:22000000777'), 'un n° de suivi à un chiffre près ne trouve PAS la vente', tous(s).map((x) => [x.e.cle, x.par]));
    const k = c('500132');
    dit(!tous(k).some((x) => x.e.cle === 'colis:MR7000123'), 'un code de retrait inversé (« 500132 ») ne trouve PAS le colis', tous(k).map((x) => [x.e.cle, x.par]));
    dit(tous(c('500123')).some((x) => x.e.cle === 'colis:MR7000123' && x.par === 'code' && x.exact), '… le code exact le trouve');
    const t = c('22000000787');
    dit(!tous(t).some((x) => x.e.cle === 'vente:22000000778' || x.e.cle === 'vente:22000000777'), 'un n° de transaction à un chiffre près : rien', tous(t).map((x) => x.e.cle));
    const n = c('142', { numero: '142' });
    dit(!tous(n).some((x) => x.e.numero === '124') && n.exactes.map((x) => x.e.numero).join() === '142', '« 142 » ne trouve pas la N°124 (un N° n’est jamais « à une faute près »)', n.exactes.map((x) => x.e.numero));
    const m = c('52,10 €');
    dit(m.total === 0, '« 52,10 € » ne trouve pas la vente à 52,00 € (montant au centime)', m.total);
    const z = c('air max 43');
    dit(!cles(z, 'vente').includes('vente:22000000777'), '« air max 43 » ne trouve pas la 42 (un mot à chiffres n’est pas toléré)', cles(z, 'vente'));
    dit(tous(c('jordn chicgo')).every((x) => !R.estIdentiteExacte(x)) && c('jordn chicgo').exactes.length === 0, 'une trouvaille approchée n’est jamais une « correspondance exacte »');
  });

  essaie('le N° exact gagne', () => {
    const r = c('124', { numero: '124', exactesEnTete: true });
    dit(r.exactes.length === 1 && r.exactes[0].e.numero === '124' && r.exactes[0].par === 'numero', '50 paires au même titre : « 124 » ⇒ LA N°124 seule en tête', r.exactes.map((x) => x.e.numero));
    dit(!r.groupes.paire.some((x) => x.e.numero === '124') && r.groupes.paire.some((x) => x.e.numero === '1124'), '… pas deux fois ; la N°1124 (qui contient 124) en dessous', r.groupes.paire.map((x) => x.e.numero));
    const b = c('b124', { numero: 'B124', exactesEnTete: true });
    dit(b.exactes.map((x) => x.e.numero).join() === 'B124', '« b124 » ⇒ la B124 (cleNum)', b.exactes.map((x) => x.e.numero));
    const s = c('007', { numero: '7', exactesEnTete: true });
    dit(s.exactes.map((x) => x.e.numero).join() === '7', '« 007 » = la N°7', s.exactes.map((x) => x.e.numero));
  });

  essaie('ordre et pseudo', () => {
    const k = c('kayano');
    const v = k.groupes.vente.map((x) => x.e.cle);
    dit(v[0] === 'vente:22000000780' && v.includes('vente:22000000781') && v.indexOf('vente:22000000781') > 0, '« kayano » : le titre EXACT d’abord, « Kayamo » (une faute, plus récente) après', v);
    dit(k.groupes.vente[0].proche !== true && k.groupes.vente[1].proche === true, '… la première exacte, la seconde dite proche', k.groupes.vente.map((x) => !!x.proche));
    const p = c('tomj606');
    dit(p.groupes.vente[0] && p.groupes.vente[0].e.cle === 'vente:22000000778' && p.groupes.vente[0].par === 'pseudo' && p.groupes.vente[0].exact, '« tomj606 » ⇒ SA vente (pseudo exact) en tête', p.groupes.vente.map((x) => [x.e.cle, x.par, x.exact]));
    const q = c('tomj660');
    dit(q.groupes.vente.map((x) => x.e.cle).join() === 'vente:22000000779' && !q.groupes.vente[0].proche, '« tomj660 » : le pseudo qui le CONTIENT (tomj660x), et PAS tomj606 (un chiffre de pseudo n’est jamais pardonné)', q.groupes.vente.map((x) => [x.e.cle, x.par, !!x.proche]));
    const t = c('tmoj606');
    dit(t.groupes.vente.map((x) => x.e.cle).join() === 'vente:22000000780,vente:22000000778' && t.groupes.vente[1].par === 'pseudo' && t.groupes.vente[1].proche && !t.groupes.vente[0].proche, '« tmoj606 » : le pseudo EXACT tmoj606 d’abord, puis tomj606 à une faute près (lettres inversées)', t.groupes.vente.map((x) => [x.e.cle, x.par, !!x.proche]));
    const d = R.destinationResultat(c('air mxa').groupes.vente[0]);
    dit(d && d.tab === 'ventes' && d.cible && d.cible.tx === '22000000777', 'une vente trouvée à une faute près ouvre SA transaction', d);
    dit(E.motPastille(c('air mxa').groupes.vente[0]) === '≈ max' && E.motPastille(c('kayano').groupes.vente[0]) === '', 'la pastille dit le mot compris (« ≈ max »), rien pour un titre exact');
    dit(c('air mxa', { tolerance: false }).total === 0, '« tolerance: false » : la règle d’avant (rien)');
  });

  essaie('vitesse sur 20 000 ventes', () => {
    const MOTS = ['nike', 'adidas', 'jordan', 'salomon', 'asics', 'vintage', 'blanche', 'noire', 'rouge', 'chicago', 'panda', 'kayano', 'samba', 'gazelle', 'spezial', 'retro', 'low', 'high', 'mid', 'dunk', 'force', 'neuve', 'occasion', 'cuir', 'daim', 'max', 'air'];
    const V = []; for (let i = 0; i < 20000; i++) { const w = []; for (let k = 0; k < 6; k++) w.push(MOTS[(i * 7 + k * 13 + (i >> k)) % MOTS.length]); V.push({ transaction_id: 22100000000 + i, title: w.join(' ') + ' taille ' + (36 + (i % 10)) + ' modele' + i, date: new Date(1.79e12 + i * 6e4).toISOString() }); }
    const P = V.slice(0, 8000).map((o, i) => ({ tx: String(o.transaction_id), pseudo: 'acheteur' + i }));
    const F = {}; for (let i = 1; i <= 2000; i++) F['f' + i] = { numero: String(i), title: MOTS[i % MOTS.length] + ' ' + MOTS[(i * 3) % MOTS.length] + ' paire ' + i };
    const I = R.indexMemo({ ventes: V, pseudos: P, fiches: F });
    const frappes = []; for (const mot of ['air mxa 42', 'jordn chicgo', 'tomj660', 'salomn noire', 'B124', 'gazele']) for (let i = 1; i <= mot.length; i++) frappes.push(mot.slice(0, i));
    // Une première passe (le moteur JavaScript chauffe ; le vocabulaire est déjà prêt avec l’index), puis la mesure.
    for (const q of frappes) R.chercherPartout(I, q, { exactesEnTete: true });
    const t0 = performance.now();
    let pire = 0, qPire = "";
    for (const q of frappes) { const t = performance.now(); R.chercherPartout(I, q, { exactesEnTete: true }); const d = performance.now() - t; if (d > pire) { pire = d; qPire = q; } }
    const moy = (performance.now() - t0) / frappes.length;
    dit(moy < 50, `une frappe sur ${I.n} entrées : ${moy.toFixed(1)} ms en moyenne (${frappes.length} frappes, pire ${pire.toFixed(0)} ms sur « ${qPire} »)`, moy);
    const t2 = performance.now(); for (const q of frappes) R.chercherPartout(I, q, { exactesEnTete: true, tolerance: false }); const sans = (performance.now() - t2) / frappes.length;
    console.log(`   (sans tolérance, les mêmes frappes : ${sans.toFixed(1)} ms en moyenne)`);
    const t1 = performance.now(); for (let k = 0; k < 3; k++) R.chercherPartout(I, 'jordn chicgo'); const re = (performance.now() - t1) / 3;
    dit(re < 50, `la même frappe refaite : ${re.toFixed(1)} ms (vocabulaire et mots proches gardés)`, re);
  });

  console.log(ko ? `\n❌ recherche tolérante : ${ko} rouge(s)` : '\n✅ recherche tolérante : tout est vert');
  process.exit(ko ? 1 : 0);
})();
