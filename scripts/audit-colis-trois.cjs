#!/usr/bin/env node
// ── audit-colis-trois — les trois choix de Julien du 3 novembre ────────────────
// Exécute les VRAIES règles pures, sur des colis et des ventes INVENTÉS :
//  1. src/scanColis.js — le scan désigne un colis par son N° DE SUIVI EXACT (ou ce que
//     la FORME mesurée du code-barres désigne : 26 chiffres ⇒ chiffres 3 à 10 ; un
//     seul n° Chronopost dans un code plus long), jamais un titre ; deux colis ⇒ rien ;
//     déjà déposé ⇒ « deja » ; inconnu ⇒ rien.
//  2. src/lotTransporteurs.js — « Tout imprimer » suit l'ordre des GROUPES de l'écran.
//  3. src/retoursStock.js — « Retour reçu ? » seulement pour un retour PROUVÉ et
//     REVENU avec son N° ; la remise garde SON N° ; ce N° redevient présent ; et dans
//     App.jsx : rien sans tap (un seul appelant, un clic), la vente retournée sort des
//     totaux par la règle existante (`PAS_UNE_VENTE`), la remise n'écrit que ses deux clés.
//   node scripts/audit-colis-trois.cjs [--mutation=NOM | --prouve]
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const F = { scan: 'src/scanColis.js', lot: 'src/lotTransporteurs.js', ret: 'src/retoursStock.js', app: 'src/App.jsx' };
const MUTATIONS = {
  'scan-sans-forme26': ['scan', "  if (/^\\d{26}$/.test(s)) ajoute(s.slice(2, 10));", ''],
  'scan-ambigu-premier': ['scan', "  if (L.length > 1) return { etat: 'ambigu', colis: L, candidats: cands };", ''],
  'scan-contient': ['scan', "if (ns.some((n) => cands.includes(n)))", "if (ns.some((n) => cands.some((c) => c.includes(n) || n.includes(c))))"],
  'scan-deja-ignore': ['scan', "etat: L[0].deja ? 'deja' : 'trouve'", "etat: 'trouve'"],
  'scan-chrono-multiple': ['scan', 'if (chrono.length === 1) ajoute(chrono[0]);', 'for (const c of chrono) ajoute(c);'],
  'lot-ordre-recu': ['lot', 'return L.map((x, i) => [x, i]).sort((a, b) => g(a[0]) - g(b[0])', 'return L.map((x, i) => [x, i]).sort((a, b) => 0'],
  'ecran-sans-urgence': ['lot', 'sort((a, b) => joursDe(jours(a[0])) - joursDe(jours(b[0])) || a[1] - b[1])', 'sort((a, b) => a[1] - b[1])'],
  'retour-initie-carte': ['ret', "return l.etape === 'en-route' || l.etape === 'rembourse' || !!l.livreeSelonVinted;", 'return true;'],
  'retour-sans-num': ['ret', "if (!l.num || l.recu || l.ancien || l.remis) return false;", "if (l.recu || l.ancien || l.remis) return false;"],
  'remis-num-conflit': ['ret', "const n = l && l.remis && l.remis.num != null ? String(l.remis.num).trim() : '';", "const n = l && l.num ? String(l.num).trim() : '';"],
  'retour-auto': ['app', "  useEffect(() => { const c = JSON.stringify(numsRemisEnStock(retoursSuivis));", "  useEffect(() => { try { for (const l of (retoursSuivis.lignes || [])) if (retourAReceptionner(l)) remettreDepuisCarte(l); } catch (_) {} const c = JSON.stringify(numsRemisEnStock(retoursSuivis));"],
  'retour-touche-vente': ['app', "    setRetoursRemis(prev => { const u = { ...prev, [k]: { at, num, archive", "    save('vinted_sale_overrides', { ...(load('vinted_sale_overrides', {}) || {}), [k]: { numero: num } });\n    setRetoursRemis(prev => { const u = { ...prev, [k]: { at, num, archive"],
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
let ko = 0, n = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'colis-trois-'));
  const src = {};
  for (const [k, f] of Object.entries(F)) src[k] = fs.readFileSync(path.join(R, f), 'utf8');
  if (mut) {
    const [k, a, b] = MUTATIONS[mut] || [];
    if (!k || !src[k].includes(a)) { console.log('❌ mutation introuvable : ' + mut); process.exit(2); }
    src[k] = src[k].replace(a, b);
  }
  for (const k of ['scan', 'lot', 'ret']) fs.writeFileSync(path.join(tmp, path.basename(F[k])), src[k]);
  const S = await import(pathToFileURL(path.join(tmp, 'scanColis.js')));
  const L = await import(pathToFileURL(path.join(tmp, 'lotTransporteurs.js')));
  const RS = await import(pathToFileURL(path.join(tmp, 'retoursStock.js')));
  const app = src.app;

  // ── 1. SCANNER ─────────────────────────────────────────────────────────────
  const T = 'Nike Air Max 90 blanche taille 42';
  const colis = [
    { cle: 'v:1', suivis: ['XA123456789FR'], titre: T, deja: false },
    { cle: 'v:2', suivis: ['XB223456789FR'], titre: T, deja: false },
    { cle: 'v:3', suivis: ['41234567'], titre: 'Samba', deja: false },
    { cle: 'v:4', suivis: ['XC323456789FR'], titre: 'Asics', deja: true },
    { cle: 'v:5', suivis: ['XD423456789FR'], titre: 'A' }, { cle: 'vc:6', suivis: ['XD423456789FR'], titre: 'B' },
    { cle: 'v:7', suivis: ['12345678'], titre: 'C' }, { cle: 'v:8', suivis: [], titre: T },
  ];
  const t = (brut) => S.trouverParScan(brut, colis);
  let r = t('XA123456789FR'); dit(r.etat === 'trouve' && r.colis.cle === 'v:1', '1a n° exact ⇒ SON colis (pas l’autre au même titre)', JSON.stringify(r));
  r = t(' xb 223-456 789 fr '); dit(r.etat === 'trouve' && r.colis.cle === 'v:2', '1b espaces, tirets, minuscules ⇒ même n°', JSON.stringify(r));
  r = t('56412345670101402623166859'); dit(r.etat === 'trouve' && r.colis.cle === 'v:3', '1c 26 chiffres (forme mesurée InPost/Mondial Relay) ⇒ chiffres 3 à 10', JSON.stringify(r));
  r = t('%0075XA123456789FR250'); dit(r.etat === 'trouve' && r.colis.cle === 'v:1', '1d un seul n° Chronopost dans un code plus long ⇒ ce n°', JSON.stringify(r));
  r = t('XA123456789FRXZ999999999FR'); dit(r.etat !== 'trouve', '1e deux n° Chronopost dans un code ⇒ rien (jamais le premier)', JSON.stringify(r));
  r = t('XC323456789FR'); dit(r.etat === 'deja' && r.colis.cle === 'v:4', '1f colis déjà déposé ⇒ « deja »', JSON.stringify(r));
  r = t('XD423456789FR'); dit(r.etat === 'ambigu', '1g deux colis au même n° ⇒ rien n’est choisi', JSON.stringify(r));
  r = t('XZ999999999FR'); dit(r.etat === 'inconnu', '1h n° inconnu ⇒ « inconnu »', JSON.stringify(r));
  r = t(T); dit(r.etat === 'inconnu', '1i un TITRE n’est jamais une identité', JSON.stringify(r));
  r = t('123456789'); dit(r.etat === 'inconnu', '1j un n° qui CONTIENT un n° connu n’est pas ce n° (pas d’approximation)', JSON.stringify(r));
  r = t('2345678'); dit(r.etat === 'vide' || r.etat === 'inconnu', '1k un morceau de n° ne désigne rien', JSON.stringify(r));
  r = t('99412345670101402623166859'); dit(r.etat === 'trouve' && r.colis.cle === 'v:3', '1l le préfixe à 2 chiffres ne compte pas (forme fixe, 2 vrais bordereaux mesurés)', JSON.stringify(r));
  const f = S.filtreRepetition(2500);
  dit(f('A1234567', 0) && !f('a1234567', 1000) && f('A1234567', 3000), '1m une lecture répétée ne compte qu’une fois en 2,5 s');
  // L'App : le colis du scan vient d'un n° LU (b.suivi / v.suivi), le « Déposé » est le geste existant différé.
  const scanBloc = app.slice(app.indexOf('const colisScannables = () =>'), app.indexOf('const trouverScan ='));
  dit(/suivis: b && b\.suivi \? \[b\.suivi\] : \[\]/.test(scanBloc) && /suivis: v\.suivi \? \[v\.suivi\] : \[\]/.test(scanBloc) && [...scanBloc.matchAll(/suivis: ([^\]]*\])/g)].every((x) => !/titre|title/.test(x[1])), '1n App : les n° d’un colis sont ceux LUS (bordereau, Vestiaire), jamais le titre');
  dit(/useDeposeDiffere\(\s*\(x\) => \{ if \(!x\) return; if \(x\.site === 'vinted'\) marquerColisFait\(x\.o, x\.b\)/.test(scanBloc) && /onDeposer=\{\(x\) => deposeScan\.demander\(/.test(app), '1o App : « Déposé » = `marquerColisFait` différé (Annuler 5 s)');

  // ── 2. TOUT IMPRIMER PAR TRANSPORTEUR ─────────────────────────────────────
  const items = [
    { id: 'a', tr: 'Mondial Relay', dl: 3 }, { id: 'b', tr: 'Chronopost', dl: 0 }, { id: 'c', tr: 'Mondial Relay', dl: 1 },
    { id: 'd', tr: 'Autres', dl: null }, { id: 'e', tr: 'Chronopost', dl: 5 }, { id: 'f', tr: 'Vinted Go', dl: 2 },
  ];
  const ranges = L.rangerParTransporteur(items, { trNom: (x) => x.tr, jours: (x) => x.dl });
  dit(ranges.map((x) => x.id).join('') === 'becafd', '2a l’écran : le plus pressé d’abord, puis les transporteurs dans l’ordre de leur premier colis', ranges.map((x) => x.id).join(''));
  const ordre = L.ordreDesGroupes(ranges, (x) => x.tr);
  dit(ordre.join('|') === 'Chronopost|Mondial Relay|Vinted Go|Autres', '2b l’ordre des groupes', ordre.join('|'));
  const lignes = [{ cle: 'x-a', trNom: 'Mondial Relay', rang: 2 }, { cle: 'x-f', trNom: 'Vinted Go', rang: 4 }, { cle: 'x-b', trNom: 'Chronopost', rang: 0 }, { cle: 'x-z', trNom: 'Colissimo' }, { cle: 'x-c', trNom: 'Mondial Relay' }, { cle: 'x-e', trNom: 'Chronopost', rang: 1 }];
  const lot = L.ordonnerLot(lignes, ordre, (l) => l.trNom).map((l) => l.cle);
  dit(lot.join(',') === 'x-b,x-e,x-a,x-c,x-f,x-z', '2c le lot : tous les colis d’un transporteur à la suite, groupes dans l’ordre de l’écran, un transporteur absent à la fin', lot.join(','));
  const lotBloc = app.slice(app.indexOf('const lignesLotTous = () =>'), app.indexOf('const [progressionLot,setProgressionLot]'));
  dit(/ordonnerLot\(L, ordre/.test(lotBloc) && /colisAEnvoyerRanges\(\)/.test(lotBloc) && /rangerParTransporteur\(tous, \{ trNom: trNomDe|rangerColisEnvoi\(tous, trNomDe\)/.test(app) && /colisAEnvoyerRanges = \(\) => \{[^\n]*rangerColisEnvoi\(|colisAEnvoyerRanges = \(\) => \{[^\n]*rangerParTransporteur\(/.test(app), '2d App : l’écran et le lot passent par la MÊME règle d’ordre');
  // (4 nov.) eBay a désormais une ligne GRISÉE dans l'aperçu (sélection) : jamais cochable,
  // jamais dans le PDF — la règle vit dans src/lotSelection.js (audit-selection-bordereaux).
  const selSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'lotSelection.js'), 'utf8');
  const blocEb = selSrc.slice(selSrc.indexOf("x.__autre === 'eb'"), selSrc.indexOf("x.__autre === 'eb'") + 600);
  dit(/__autre === 'vc'/.test(lotBloc + selSrc) && /__autre === 'lbc'/.test(lotBloc + selSrc) && /cochable: false/.test(blocEb), '2e App : Vinted, Vestiaire, Leboncoin dans le lot ; eBay jamais (étiquette dans eBay, §2.8)');
  const merge = app.slice(app.indexOf('const mergeAndDownloadBordereauxBrut'), app.indexOf('const mergeAndDownloadBordereaux = '));
  dit(/confirmerNumerosAVerifier\(/.test(merge) && /poserBordereau\(PL, out, src/.test(merge), '2f App : la fusion demande les N° « à vérifier » et tamponne chaque page (`poserBordereau` → `tamponnerBordereau`)');

  dit(/choisir: choisirTampon\(\{ PL, src, numero: it\.numero, titre: it\.title, apercu: /.test(merge) && /await mergeAndDownloadBordereaux\(items,/.test(app.slice(app.indexOf('const batchBordereaux = async'), app.indexOf('const batchBordereaux = async') + 12000)), '2g App : chaque bordereau du lot sort à la place gardée pour SA forme (`choisirTampon`, `vrm_tampon_positions`), sans aperçu');

  // ── 3. RETOUR → STOCK ─────────────────────────────────────────────────────
  const etats = { 1: { s: 440, ss: '' }, 2: { s: 440, ss: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais" }, 3: { s: 440, ss: 'Commande livrée ! ' },
    4: { s: 440, ss: '' }, 5: { s: 450, ss: 'Commande livrée ! ' }, 6: { s: 440, ss: 'Bordereau envoyé au vendeur' }, 7: { s: 440, ss: "colis déposé en point relais" } };
  const v = (id, status, tus = 'needs_action', extra = {}) => ({ transaction_id: id, title: T, status, transaction_user_status: tus, date: new Date(Date.now() - 5 * 864e5).toISOString(), ...extra });
  const ventes = [v(1, 'Retour initié'), v(2, 'Commande livrée ! '), v(3, 'Commande livrée ! '), v(4, 'Remboursement effectué', 'failed'), v(5, 'Commande finalisée', 'completed'), v(6, 'Retour initié'), v(7, 'Commande livrée ! ')];
  const txnItem = { 1: 'i1', 2: 'i2', 3: 'i3', 4: 'i4', 5: 'i5', 6: 'i6' };   // 7 : aucune identité
  const numeros = { i1: { numero: '11' }, i2: { numero: '12' }, i3: { numero: '13' }, i4: { numero: '14' }, i5: { numero: '15' }, i6: { numero: '16' }, autre: { numero: '12', title: 'en ligne' } };
  const res = RS.retoursEnCours({ ventes, etats: (tx) => etats[tx] || null, txnItem, numeros, numeroVente: () => null, recus: {}, remis: {}, masques: {}, republiee: () => false, ebay: [] });
  const carte = res.lignes.filter(RS.retourAReceptionner).map((l) => l.tx).sort().join(',');
  dit(carte === '2,3,4', '3a « Retour reçu ? » : retour PROUVÉ et REVENU avec son N° (déposé, livré, remboursé) — ni initié (1, 6), ni finalisée (5), ni sans N° (7)', carte);
  const l2 = res.lignes.find((l) => l.tx === '2');
  const rem = RS.remiseEnStock({ ...l2, recu: true }, { numeros, presentes: new Set(['i2']), cleNum: (x) => String(x), estArchive: () => false });
  dit(rem.ok && rem.num === '12' && !rem.conflit, '3b la remise garde SON N° (12), jamais un nouveau', JSON.stringify(rem));
  const rem2 = RS.remiseEnStock({ ...l2, recu: true }, { numeros, presentes: new Set(['autre']), cleNum: (x) => String(x), estArchive: () => false });
  dit(rem2.ok && rem2.conflit && rem2.conflit.id === 'autre', '3c le N° porté par un autre article PRÉSENT ⇒ conflit (la carte demande)', JSON.stringify(rem2));
  const res2 = RS.retoursEnCours({ ventes, etats: (tx) => etats[tx] || null, txnItem, numeros, numeroVente: () => null, recus: { 2: 'x', 3: 'x' }, remis: { 2: { num: '12' }, 3: { num: null } }, masques: {}, republiee: () => false, ebay: [] });
  dit(JSON.stringify(RS.numsRemisEnStock(res2)) === '["12"]', '3d remis ⇒ son N° redevient présent ; remis SANS N° (conflit) ⇒ aucun N°', JSON.stringify(RS.numsRemisEnStock(res2)));
  dit(!res2.lignes.filter(RS.retourAReceptionner).some((l) => l.tx === '2' || l.tx === '3'), '3e une fois remis, plus de carte');
  // Les totaux : la vente retournée sort par la règle EXISTANTE (`PAS_UNE_VENTE`), jamais une règle neuve.
  const m = /const PAS_UNE_VENTE = (\/.*\/[a-z]*);/.exec(app);
  const PAS = m ? eval(m[1]) : null;
  dit(PAS && PAS.test('Remboursement effectué') && PAS.test('Retour initié') && !PAS.test('Commande finalisée'), '3f « Remboursement effectué » / « Retour initié » sortent des ventes par `PAS_UNE_VENTE` (règle existante)');
  const remBloc = app.slice(app.indexOf('const remettreDepuisCarte = async'), app.indexOf('const remettreEnStock = async'));
  const cles = [...remBloc.matchAll(/save\('([a-z_]+)'/g)].map((x) => x[1]).sort().join(',');
  dit(cles === 'vinted_retours_recus,vinted_retours_remis', '3g le tap n’écrit QUE « reçu » et « remis » (ni la vente, ni le pool, ni une fiche)', cles);
  const appels = (app.match(/remettreDepuisCarte/g) || []).length;
  dit(appels === 2 && /onRemettre=\{remettreDepuisCarte\}/.test(app) && /onClick=\{\(\) => onRemettre\(l\)\}/.test(app), '3h rien sans tap : un seul appelant, le bouton « Remettre en stock »', String(appels));
  dit(/for \(const n of JSON\.parse\(numsRemisCle \|\| '\[\]'\)\) if \(n\) vivants\.add/.test(app), '3i App : les N° remis entrent dans les paires présentes (`vinted_nums_physiques`)');

  console.log(`\n${ko ? '❌' : '✅'} audit-colis-trois : ${n - ko}/${n}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(ko ? 1 : 0);
})();
