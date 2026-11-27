// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DU 27 NOV. — CHASSE AUX BUGS DU CODE FUSIONNÉ LE 27 NOV. (PR #1440 à #1452). Données INVENTÉES, lecture seule.
//  Chaque bloc rejoue un chemin réel (la FORME des lignes que l'app construit) jusqu'au faux résultat qu'il donnait.
//
//  C · Ventes, filtre « Compte » (src/filtrePlateforme.js, PR #1444) : un compte = SON IDENTITÉ (`compteCle`, le site et
//      l'identifiant lu), jamais son nom. Deux comptes Leboncoin au même nom affiché (« Julien ») et le même pseudo sur
//      Vinted et sur eBay étaient UN choix : « Julien » montrait les ventes des deux comptes.
//  B · les branchements (texte de src/App.jsx, commentaires retirés) : chaque ligne de Ventes « Toutes » porte `compteCle`
//      par `identiteCompteVente` ; le menu prend `x.cle` / `x.libelle`.
//
//  `--src <dossier>` : un autre arbre (le code d'avant : il doit rougir). `--prouve` : chaque MUTATION doit rougir.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const iS = process.argv.indexOf('--src');
const RACINE = iS > 0 ? path.resolve(process.argv[iS + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
let ko = 0, ok = 0;
const dit = (c, nom, det) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${nom}${c || det === undefined ? '' : ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 400)}`); };
const imp = (rel) => import(pathToFileURL(path.join(RACINE, rel)).href);
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const MUTATIONS = [
  ['src/filtrePlateforme.js', "if (typeof x.compteCle === 'string' && x.compteCle) return x.compteCle;", '', 'C : la clé redevient le nom'],
  ['src/filtrePlateforme.js', "return lignes.filter((x) => x && cleCompteLigne(x) === compte);", 'return lignes.filter((x) => x && x.compte === compte);', 'C : filtre par le nom'],
  ['src/filtrePlateforme.js', "c.libelle = `${c.libelle} · …${id.slice(-4)}`;", '', 'C : deux libellés identiques'],
  ['src/App.jsx', "compteCle: identiteCompteVente('leboncoin', v) ? 'leboncoin:' + identiteCompteVente('leboncoin', v) : '',", '', 'B : la ligne Leboncoin sans identité'],
];

async function principal() {
  // ── C · le filtre « Compte » ──
  const F = await imp('src/filtrePlateforme.js');
  // La forme des lignes de Ventes « Toutes » (src/App.jsx `toutesLignes`) : `compte` = le NOM lu, `compteCle` = l'identité.
  const L = [
    { cle: 'vinted:1', site: 'vinted', compte: 'julien35', compteCle: 'vinted:111' },
    { cle: 'vinted:2', site: 'vinted', compte: 'marie', compteCle: 'vinted:222' },
    { cle: 'leboncoin:a', site: 'leboncoin', compte: 'Julien', compteCle: 'leboncoin:84420001' },
    { cle: 'leboncoin:b', site: 'leboncoin', compte: 'Julien', compteCle: 'leboncoin:99990002' },
    { cle: 'leboncoin:c', site: 'leboncoin', compte: 'Julien', compteCle: 'leboncoin:99990002' },
    { cle: 'ebay:x', site: 'ebay', compte: 'julien35', compteCle: 'ebay:principal' },
    { cle: 'vestiaire:z', site: 'vestiaire', compte: '' },
  ];
  const C = F.comptesDeLignes(L);
  const cles = C.map((c) => (c && typeof c === 'object' ? c.cle : c));
  dit(cles.length === 5, 'C1 · cinq comptes (deux « Julien » Leboncoin, « julien35 » sur Vinted et sur eBay) : cinq choix', cles);
  const libs = C.map((c) => (c && typeof c === 'object' ? c.libelle : c));
  dit(new Set(libs.map((x) => String(x).toLowerCase())).size === libs.length, 'C2 · chaque choix a SON libellé (jamais deux fois le même)', libs);
  // Chaque choix rend EXACTEMENT les lignes de son compte.
  const attendu = { 'vinted:111': ['vinted:1'], 'vinted:222': ['vinted:2'], 'leboncoin:84420001': ['leboncoin:a'], 'leboncoin:99990002': ['leboncoin:b', 'leboncoin:c'], 'ebay:principal': ['ebay:x'] };
  let tous = true; const det = {};
  for (const c of C) {
    const k = c && typeof c === 'object' ? c.cle : c;
    const r = (F.filtrerCompte(L, k) || []).map((x) => x.cle).sort();
    det[k] = r;
    const a = attendu[k];
    if (!a || JSON.stringify(a) !== JSON.stringify(r)) tous = false;
  }
  dit(tous, 'C3 · chaque choix montre les ventes de CE compte seulement (jamais celles d’un compte au même nom)', det);
  // Un choix retenu (une clé) reste choisi ; un ancien choix retenu par le NOM retombe sur « Tous les comptes ».
  dit(F.choixCompteEffectif('leboncoin:84420001', C) === 'leboncoin:84420001', 'C4 · le choix retenu (clé) reste choisi', F.choixCompteEffectif('leboncoin:84420001', C));
  dit(F.choixCompteEffectif('Julien', C) === '', 'C5 · un choix par nom (ancien) ⇒ « Tous les comptes », jamais deux comptes', F.choixCompteEffectif('Julien', C));
  // Sans identité lue : le site et le nom (deux sites ne se mêlent jamais).
  const L2 = [{ site: 'vinted', compte: 'zoe' }, { site: 'ebay', compte: 'zoe' }];
  dit(F.comptesDeLignes(L2).length === 2 && F.filtrerCompte(L2, (F.comptesDeLignes(L2)[0] || {}).cle).length === 1, 'C6 · sans identifiant, un même nom sur deux sites : deux choix', F.comptesDeLignes(L2));
  dit(F.comptesDeLignes([{ site: 'ebay', compteCle: 'ebay:principal', compte: '' }]).length === 0, 'C7 · une ligne sans NOM de compte n’entre dans aucun choix (aucun identifiant brut montré)');

  // ── B · les branchements ──
  const app = sansCommentaires(lire('src/App.jsx'));
  dit(/compteCle: uid \? 'vinted:' \+ uid : ''/.test(app), 'B1 · la ligne Vinted porte son identité (uid)');
  dit(/compteCle: identiteCompteVente\('leboncoin', v\)/.test(app), 'B2 · la ligne Leboncoin porte son identité (compte de la transaction)');
  dit(/compteCle: identiteCompteVente\('ebay', c\)/.test(app), 'B3 · la ligne eBay porte son identité (référence du compte)');
  dit(/comptesC\.map\(\(x\) => \(\{ cle: x\.cle, libelle: x\.libelle/.test(app) && /cptsT\.map\(\(x\) => \(\{ cle: x\.cle, libelle: x\.libelle/.test(app), 'B4 · téléphone et ordinateur : le menu prend la clé et le libellé');
}

function prouver() {
  let rougies = 0;
  for (const [rel, de, vers, nom] of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chasse27-'));
    const fichiers = ['src/filtrePlateforme.js', 'src/plateformes.js', 'src/stockageSur.js', 'src/App.jsx'];
    for (const f of fichiers) { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.copyFileSync(path.join(RACINE, f), path.join(tmp, f)); }
    // les imports de src/plateformes.js et src/stockageSur.js
    for (const f of fs.readdirSync(path.join(RACINE, 'src'))) if (/\.js$/.test(f) && !fs.existsSync(path.join(tmp, 'src', f))) fs.copyFileSync(path.join(RACINE, 'src', f), path.join(tmp, 'src', f));
    const p = path.join(tmp, rel); const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(de)) { console.log(`⚠️  mutation introuvable : ${nom}`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, s.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename, '--src', tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    if (rouge) rougies++;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'rouge' : 'VERT (le contrôle ne la voit pas)'}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return rougies === MUTATIONS.length;
}

principal().then(() => {
  console.log(`\n${ko ? '❌' : '✅'} audit-chasse-27nov : ${ok} vert(s), ${ko} rouge(s)`);
  if (ko) process.exit(1);
  if (PROUVE && !prouver()) process.exit(1);
}).catch((e) => { console.error(e); process.exit(1); });
