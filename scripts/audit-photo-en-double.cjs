// ════════════════════════════════════════════════════════════════════════════
// LA MÊME PHOTO SUR DEUX ANNONCES EN LIGNE (22 nov., Julien — choix n° 35)
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/photoEnDouble.js avec la VRAIE clé de photo (`photoKey`, extraite de src/App.jsx) et exige :
//   1. le FICHIER exact seulement : 50 annonces au même titre, même marque, même taille, sans la même photo ⇒ AUCUN
//      signal ; le même dossier avec un autre fichier ⇒ aucun ; le même fichier servi par un autre hôte / une autre
//      taille ⇒ signalé (c'est le même fichier) ; la clé `photoK` d'une fiche compte comme la photo ;
//   2. une paire volontairement en plusieurs exemplaires (stock auto, quantité ≥ 2 posée sur son N°) n'est pas
//      signalée ; quantité 1 ⇒ signalée ;
//   3. « Ce n'est pas un doublon » : ce groupe ne revient plus ; une annonce de plus au même fichier ⇒ signalé ;
//   4. rien n'est modifié (entrées gelées) ; rien n'est relié (le module ne rend que des signaux) ;
//   5. le branchement : Annonces (filtre « Photo en double », annonces EN LIGNE seulement), Aujourd'hui (la rangée),
//      le registre synchronisé, les textes par tr().
//   node scripts/audit-photo-en-double.cjs            → le contrôle
//   node scripts/audit-photo-en-double.cjs --prouve   → chaque mutation de la règle doit faire ROUGIR
// Aucune donnée réelle : tout est inventé ici.
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R0 = path.join(__dirname, '..');
const REGLE = path.join(R0, 'src', 'photoEnDouble.js');
const lire = (f) => { try { return fs.readFileSync(path.join(R0, f), 'utf8'); } catch (_) { return ''; } };

const MUTATIONS = {
  'dossier-seul': ["typeof clePhoto === 'function' && a.photo ? clePhoto(a.photo) : ''", "typeof clePhoto === 'function' && a.photo ? String(clePhoto(a.photo) || '').split('/')[0] : ''"],
  'par-titre': ["str(f.photoK)].filter(Boolean))];", "str(f.photoK), 't:' + str(a.titre).toLowerCase()].filter(Boolean))];"],
  'exemplaires-ignores': ["nums.some((n) => exemplaires.has(cle(n)))", 'false'],
  'refus-ignore': ['if (R[c]) { ecartes.refus++; continue; }', ''],
  'photoK-ignoree': ["str(f.photoK)].filter(Boolean))];", "''].filter(Boolean))];"],
};
const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  let ko = 0, n = 0;
  const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + String(d).slice(0, 300) : '')); };
  let regleSrc = fs.existsSync(REGLE) ? fs.readFileSync(REGLE, 'utf8') : null;
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue'); process.exit(2); }
    if (!regleSrc || !regleSrc.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    regleSrc = regleSrc.replace(m[0], m[1]);
  }
  // La VRAIE clé de photo (App.jsx).
  const appSrc = fs.readFileSync(path.join(R0, 'src', 'App.jsx'), 'utf8');
  const ctx = {}; vm.createContext(ctx);
  const deb = appSrc.indexOf('const photoKey = (url) => {');
  const fin = appSrc.indexOf('\n};\n', deb);
  vm.runInContext(appSrc.slice(deb, fin + 3) + '\nthis.photoKey = photoKey;', ctx);
  const photoKey = ctx.photoKey;
  let M = null;
  if (regleSrc != null) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-photo-double-'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'photoEnDouble.js'), regleSrc);
    try { M = await import(pathToFileURL(path.join(dir, 'photoEnDouble.js')).href); } catch (e) { dit(false, 'la règle se charge', e.message); }
  } else dit(false, 'src/photoEnDouble.js existe (la règle « même photo sur deux annonces »)');
  if (!M) { console.log(`\n❌ audit-photo-en-double : ${n - ko} vert(s), ${ko} rouge(s)`); process.exit(1); }

  const ph = (dossier, fichier, hote = 'images1', taille = 'f800') => `https://${hote}.vinted.net/t/${dossier}/${taille}/${fichier}.jpeg?s=abc`;
  const ann = (id, photo, o = {}) => ({ id: String(id), compte: '11', pseudo: 'vendeuse_a', titre: 'Nike Air Max 90 blanc 42', photo, prix: 60, url: `https://www.vinted.fr/items/${id}`, ...o });
  const gele = (x) => { if (x && typeof x === 'object') { Object.freeze(x); for (const v of Object.values(x)) gele(v); } return x; };
  const lancer = (o) => M.photosEnDouble({ clePhoto: photoKey, ...o });

  console.log('── 1. Le fichier exact, jamais la ressemblance');
  {
    const annonces = Array.from({ length: 50 }, (_, i) => ann(1000 + i, ph('01_00a' + (i % 3), 'photo' + i)));
    const fiches = Object.fromEntries(annonces.map((a, i) => [a.id, { numero: String(100 + i) }]));
    const r = lancer({ annonces: gele(annonces), fiches: gele(fiches) });
    dit(r.groupes.length === 0, '50 annonces au même titre, même marque, même taille, même dossier par trois, photos différentes ⇒ AUCUN signal', JSON.stringify(r.groupes.slice(0, 1)));
    const deux = [ann(1, ph('01_abc', 'p1', 'images1', 'f800')), ann(2, ph('01_abc', 'p1', 'images3', '310x430'), { titre: 'Autre titre' })];
    const r2 = lancer({ annonces: deux, fiches: { 1: { numero: '142' }, 2: { numero: '157' } } });
    dit(r2.groupes.length === 1 && r2.groupes[0].numeros.join(',') === '142,157' && r2.groupes[0].annonces.length === 2, 'le même FICHIER (autre hôte, autre taille, titre différent) ⇒ UN signal, N°142 et N°157', JSON.stringify(r2.groupes));
    const r3 = lancer({ annonces: [ann(1, ph('01_abc', 'p1')), ann(2, ph('01_abc', 'p2'))], fiches: {} });
    dit(r3.groupes.length === 0, 'le même DOSSIER, deux fichiers ⇒ aucun signal (jamais le dossier seul)');
    const r4 = lancer({ annonces: [ann(1, ph('01_abc', 'p1')), ann(2, ph('09_zzz', 'p9'))], fiches: { 2: { numero: '157', photoK: photoKey(ph('01_abc', 'p1')) } } });
    dit(r4.groupes.length === 1, 'la clé `photoK` de la fiche (posée au numérotage) vaut la photo de l’annonce');
    const r5 = lancer({ annonces: [ann(1, null), ann(2, null)], fiches: {} });
    dit(r5.groupes.length === 0, 'sans photo, aucun signal (rien n’est deviné)');
  }

  console.log('\n── 2. Plusieurs exemplaires voulus');
  {
    const deux = [ann(1, ph('01_abc', 'p1')), ann(2, ph('01_abc', 'p1'))];
    const fiches = { 1: { numero: '142' }, 2: { numero: '142' } };
    const ex = M.numerosEnExemplaires({ comptes: { 11: { stockAuto: { actif: true, stock: { 142: 3 } } } } });
    dit(ex.has('142') && lancer({ annonces: deux, fiches, exemplaires: ex }).groupes.length === 0, 'stock auto : quantité 3 posée sur N°142 ⇒ pas signalé');
    const ex1 = M.numerosEnExemplaires({ comptes: { 11: { stockAuto: { stock: { 142: 1 } } } } });
    dit(!ex1.has('142') && lancer({ annonces: deux, fiches, exemplaires: ex1 }).groupes.length === 1, 'quantité 1 ⇒ signalé');
  }

  console.log('\n── 3. « Ce n’est pas un doublon »');
  {
    const deux = [ann(1, ph('01_abc', 'p1')), ann(2, ph('01_abc', 'p1'))];
    const g = lancer({ annonces: deux }).groupes[0];
    const refus = M.refuserGroupe({}, g.cle, 5);
    dit(lancer({ annonces: deux, refus }).groupes.length === 0, 'mémorisé : ce groupe ne revient plus');
    dit(lancer({ annonces: [...deux, ann(3, ph('01_abc', 'p1'))], refus }).groupes.length === 1, 'une annonce de plus au même fichier ⇒ signalé de nouveau');
    dit(M.cleGroupe(['2', '1']) === M.cleGroupe(['1', '2']), 'la clé d’un groupe ne dépend pas de l’ordre');
  }

  console.log('\n── 4. Rien n’est modifié, rien n’est relié');
  {
    const a = gele([ann(1, ph('01_abc', 'p1')), ann(2, ph('01_abc', 'p1'))]), f = gele({ 1: { numero: '1' } });
    let leve = null; try { lancer({ annonces: a, fiches: f }); } catch (e) { leve = e; }
    dit(!leve, 'entrées gelées : la règle n’écrit rien (ni photo, ni fiche, ni annonce)', leve && leve.message);
    dit(!/save\(|localStorage|fetch\(|withOwner|gesteVrm/.test(regleSrc), 'le module n’écrit nulle part (aucun save, fetch, geste)');
  }

  console.log('\n── 5. Le branchement');
  {
    const comp = lire('src/ecrans/Comptabilite.jsx'), eg = lire('src/ecrans/AnnoncesEgalite.jsx'), aj = lire('src/natif/ecrans/Aujourdhui.jsx'), app = lire('src/App.jsx'), va = lire('src/natif/ecrans/Annonces.jsx');
    dit(/photosEnDouble\(\{[\s\S]{0,200}clePhoto: photoKey/.test(comp) && /listings\.items/.test(comp), 'Aujourd’hui : la règle sur les annonces EN LIGNE (`listings.items`) avec la vraie `photoKey`');
    dit(/photosEnDouble\(\{[\s\S]{0,200}clePhoto: photoKey/.test(eg) && /x\.etat === 'enligne'/.test(eg) && /'photodouble'/.test(eg), 'Annonces : la même règle, annonces EN LIGNE seulement, le filtre « Photo en double »');
    dit(/photoDouble/.test(aj) && /data-photo-double-journee/.test(aj), 'Aujourd’hui dessine la rangée « Même photo sur N annonces »');
    dit(/'vrm_photo_double_non'/.test(app.split('const SYNC_KEYS = [')[1] || ''), '« Ce n’est pas un doublon » est synchronisé (SYNC_KEYS)');
    dit(/photoDouble/.test(va) && /'photodouble'/.test(va), 'l’écran Annonces porte le segment « Photo en double »');
  }

  console.log(`\n${ko ? '❌' : '✅'} audit-photo-en-double : ${n - ko} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
