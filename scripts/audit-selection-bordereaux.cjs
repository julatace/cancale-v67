#!/usr/bin/env node
// ── audit-selection-bordereaux — le lot de bordereaux, toutes plateformes (4 nov.) ──
// Exécute la VRAIE règle (src/lotSelection.js) et lit App.jsx :
//  1. Vestiaire et Leboncoin ont TOUJOURS leur ligne cochable (avant : seulement avec un PDF déjà là,
//     et Leboncoin seulement avec l'extension de ce navigateur) ; `pdf` dit le bordereau ;
//  2. eBay : une ligne non cochable (« eBay ») ; jamais dans une sélection imprimable ;
//  3. cochées d'office = avec bordereau, ni anciennes ni déjà imprimées ;
//  4. « N sans bordereau : N°x titre, … » nomme les lignes ;
//  5. App : le lot utilise ces règles ; la fusion partage la place du tampon par FORME (`deja`
//     partagé), rouvre la feuille avec « Placer le tampon » ('force'), et un Annuler ARRÊTE le lot
//     (jamais compté comme un PDF raté).
//   node scripts/audit-selection-bordereaux.cjs [--mutation=NOM | --prouve]
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const F = { sel: 'src/lotSelection.js', app: 'src/App.jsx' };
const MUTATIONS = {
  'vc-pdf-seulement': ['sel', "  if (x.__autre === 'vc') {\n    const v = x.v || {};", "  if (x.__autre === 'vc') {\n    const v = x.v || {};\n    if (!(v.bordereau && v.bordereau.id)) return null;"],
  'lbc-extension-seulement': ['sel', "  if (x.__autre === 'lbc') {\n    const o = x.o || {}, lien = !!(o.label && o.label.voucherUrl);", "  if (x.__autre === 'lbc') {\n    const o = x.o || {}, lien = !!(o.label && o.label.voucherUrl);\n    if (!lbcPdf) return null;"],
  'ebay-cochable': ['sel', "      pdf: false, cochable: false, num: x.num || ''", "      pdf: false, cochable: true, num: x.num || ''"],
  'sans-pdf-coche': ['sel', "l.cochable !== false && l.pdf !== false && !l.ancienne", "l.cochable !== false && !l.ancienne"],
  'selection-ebay': ['sel', "(L || []).filter((l) => l && l.cochable !== false && (!coches || coches.has(l.cle)))", "(L || []).filter((l) => l && (!coches || coches.has(l.cle)))"],
  'sans-nom': ['sel', "return `${L.length} sans bordereau : ${L.slice(0, 4).map(nom).join(', ')}${L.length > 4 ? '…' : ''}`;", "return `${L.length} sans bordereau`;"],
  'deja-par-bordereau': ['app', "apercu: opts.apercu === undefined ? false : opts.apercu, deja: dejaLot }", "apercu: opts.apercu === undefined ? false : opts.apercu }"],
  'annuler-avale': ['app', "} catch (e) { if (estTamponAnnule(e)) throw e; rates.push(index); }", "} catch (e) { rates.push(index); }"],
  'placer-sans-force': ['app', "apercu: placer ? 'force' : true", "apercu: true"],
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
  const src = { sel: fs.readFileSync(path.join(R, F.sel), 'utf8'), app: fs.readFileSync(path.join(R, F.app), 'utf8') };
  if (mut) { const [k, a, b] = MUTATIONS[mut] || []; if (!k || !src[k].includes(a)) { console.log('❌ mutation introuvable : ' + mut); process.exit(2); } src[k] = src[k].replace(a, b); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sel-bord-'));
  fs.writeFileSync(path.join(tmp, 'lotSelection.js'), src.sel);
  const S = await import(pathToFileURL(path.join(tmp, 'lotSelection.js')));
  const app = src.app;
  const vc1 = { __autre: 'vc', key: 'vc:V1', trNom: 'Chronopost', v: { id: 'V1', num: '12', titre: 'Cabas', bordereau: { id: 'vc_label_1' } } };
  const vc2 = { __autre: 'vc', key: 'vc:V2', trNom: 'Chronopost', v: { id: 'V2', num: '13', titre: 'Pochette' } };
  const lb1 = { __autre: 'lbc', key: 'l:1', trNom: 'Mondial Relay', x: { titre: 'Vans', itemId: '9' }, o: { label: { voucherUrl: 'https://x' } } };
  const lb2 = { __autre: 'lbc', key: 'l:2', trNom: 'Mondial Relay', x: { titre: 'Golf' }, o: {} };
  const eb = { __autre: 'eb', key: 'e:p:E1', trNom: 'Autres', x: { titre: 'Commande eBay', orderId: 'E1' } };
  const sansExt = [vc1, vc2, lb1, lb2, eb].map((x, i) => S.ligneLotAutre(x, i, { imprimesVc: {}, lbcPdf: false, numLbc: () => '' }));
  const avecExt = [vc1, vc2, lb1, lb2, eb].map((x, i) => S.ligneLotAutre(x, i, { imprimesVc: {}, lbcPdf: true, numLbc: () => '' }));
  dit(sansExt.filter((l) => l && l.site === 'vestiaire' && l.cochable).length === 2, '1a les 2 ventes Vestiaire ont leur ligne cochable (avec ET sans bordereau)', JSON.stringify(sansExt.map((l) => l && [l.cle, l.cochable, l.pdf])));
  dit(sansExt.filter((l) => l && l.site === 'leboncoin' && l.cochable).length === 2, '1b Leboncoin cochable, même sans extension ici (téléphone)', JSON.stringify(sansExt.map((l) => l && [l.cle, l.cochable, l.pdf])));
  dit(sansExt[0].pdf && !sansExt[1].pdf && !sansExt[2].pdf && avecExt[2].pdf && !avecExt[3].pdf, '1c `pdf` : Vestiaire = bordereau rangé ; Leboncoin = lien lu ET extension de ce navigateur');
  const e = sansExt[4];
  dit(e && e.site === 'ebay' && e.cochable === false && e.sous === 'eBay', '2a eBay : ligne non cochable, nommée « eBay »', JSON.stringify(e));
  const L = [{ cle: 'v1', site: 'vinted', pdf: true, cochable: true }, { cle: 'v2', site: 'vinted', pdf: true, cochable: true, ancienne: true }, ...avecExt];
  dit(S.selectionImprimable(L, new Set(L.map((l) => l.cle))).every((l) => l.site !== 'ebay'), '2b « tout coché » n’envoie jamais eBay à l’impression');
  const d = [...S.cochesParDefaut(L)].sort().join(',');
  dit(d === 'l:1,v1,vc:V1', '3 cochées d’office : avec bordereau, pas anciennes', d);
  const t = S.texteSansBordereau([sansExt[1], sansExt[3]]);
  dit(/^2 sans bordereau : N°13 Pochette, Golf$/.test(t), '4 « 2 sans bordereau : N°13 Pochette, Golf »', t);
  dit(S.texteSansBordereau([]) === '', '4b rien à nommer ⇒ rien');
  const lotBloc = app.slice(app.indexOf('const lignesLotTous = () =>'), app.indexOf('const [progressionLot,setProgressionLot]'));
  dit(/ligneLotAutre\(/.test(lotBloc) && !/__autre === 'vc' && x\.v && x\.v\.bordereau/.test(lotBloc) && !/lbcPdf && x\.o && x\.o\.label/.test(lotBloc), '5a App : le lot prend les lignes de `ligneLotAutre` (plus de filtre « PDF déjà là »)');
  dit(/coches:cochesParDefaut\(L\)/.test(app) && /const aImprimer = selectionImprimable\(lignesLotTous\(\), choisis\);/.test(app), '5b App : cochées d’office et sélection imprimable par la règle');
  const merge = app.slice(app.indexOf('const mergeAndDownloadBordereauxBrut'), app.indexOf('const mergeAndDownloadBordereaux = '));
  dit(/const dejaLot = \{\};/.test(merge) && /deja: dejaLot\s*[,}]/.test(merge), '5c la place choisie vaut pour TOUS les bordereaux de la même forme du lot (une question par forme)');
  dit(/if \(estTamponAnnule\(e\)\) throw e;/.test(merge), '5d « Annuler » dans la feuille arrête le lot (rien n’est imprimé)');
  dit(/apercu: placer \? 'force' : true/.test(app) && /data-lot-placer=/.test(app), '5e « Placer le tampon » rouvre la feuille de chaque forme ; sinon seulement les formes sans place gardée');
  dit(/const choisirTampon = \(\{ PL, src, numero, titre, apercu = true, deja = \{\}(?:, [\w ={}]+)? \}\)/.test(app), '5f `choisirTampon` accepte une mémoire partagée (`deja`)');
  console.log(`\n${ko ? '❌' : '✅'} audit-selection-bordereaux : ${n - ko}/${n}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(ko ? 1 : 0);
})();
