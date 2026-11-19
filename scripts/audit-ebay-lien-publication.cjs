#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT : LE LIEN eBay POSÉ À LA PUBLICATION (19 nov., src/ebay/lienPublication.js)
//  Julien : « ça aurait dû se relier tout seul ». Mesuré : 0 lien « publication » sur ses
//  annonces eBay — l'écran ne posait le lien que s'il connaissait encore la paire.
//  Rejoue la publication telle que l'écran eBay la fait (l'annonce construite par
//  `itemDeBrouillon` ne porte PAS `pairId`), puis vérifie les deux appels de l'écran.
//  `--mutation=<nom>|toutes` : réaffaiblit la règle ⇒ ROUGE.  `--src <dossier>` : un autre arbre.
//  Sur `git archive origin/main` : ROUGE (la règle n'existe pas, le lien n'est pas posé).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const R = 'src/ebay/lienPublication.js', E = 'src/ecrans/Ebay.jsx', D = 'api/_lib/double-vente.js';
const MUTATIONS = {
  sansRepli: [R, '  if (!n || !fiches || typeof fiches !== \'object\') return null;', '  return null;'],
  premiere: [R, '  return ids.length === 1 ? { itemId: id, pairId: ids[0], numero: n } : null;', '  return ids.length >= 1 ? { itemId: id, pairId: ids[0], numero: n } : null;'],
  serveurSansArticle: [D, "  if (lien && !lien.pairId && (lien.article === true || lien.propre === true) && lien.numero != null && cleNum(String(lien.numero))) return cleNum(String(lien.numero));", ''],
  ecranAncien: [E, "      try { const li = lienApresPublication({ itemId: j.itemId, pairId: (b && b.pairId) || pairId, numero: (b && b.item && b.item.numero) || (j.sku ? numDeSkuEbay(j.sku) : ''), fiches: fichesPourEbay(), cle: cleNum }); if (li) noterLienEbay(li.itemId, li.pairId, li.numero, 'publication'); } catch (_) {}",
    "      try { const pid = (b && b.pairId) || pairId; if (j.itemId && pid) noterLienEbay(j.itemId, pid, b && b.item && b.item.numero, 'publication'); } catch (_) {}"],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  let rouges = 0;
  for (const nom of noms) {
    const [f, a, b] = MUTATIONS[nom];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-lien-'));
    for (const d of ['api', 'src']) fs.cpSync(path.join(RACINE, d), path.join(tmp, d), { recursive: true, filter: (s) => !/node_modules/.test(s) });
    if (fs.existsSync(path.join(RACINE, 'package.json'))) fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(tmp, 'package.json'));
    const t = fs.readFileSync(path.join(tmp, f), 'utf8');
    if (!t.includes(a)) { console.log(`❓ mutation ${nom} : texte introuvable`); continue; }
    fs.writeFileSync(path.join(tmp, f), t.replace(a, b));
    const r = spawnSync(process.execPath, [__filename, '--src', tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0; if (rouge) rouges++;
    console.log(`${rouge ? '✅' : '❌'} mutation ${nom} ⇒ ${rouge ? 'ROUGE' : 'reste vert'}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`${rouges}/${noms.length} mutations rouges`);
  process.exit(rouges === noms.length ? 0 : 1);
}

let ko = 0, n = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${c ? '' : ' — ' + JSON.stringify(d)}`); };
(async () => {
  try {
    const { lienApresPublication } = await import(path.join(RACINE, R));
    const fiches = { 9001: { numero: '125' }, 9002: { numero: '126' }, 9003: { numero: 'B230' } };
    // La publication telle que l'écran la fait : l'annonce construite (`itemDeBrouillon`) ne porte que `item`.
    const b = { item: { title: 'Adidas Samba noire', numero: '125' } };
    const j = { ok: true, itemId: '187654321098', sku: 'VRM-125' };
    const r1 = lienApresPublication({ itemId: j.itemId, pairId: null, numero: b.item.numero, fiches });
    dit(r1 && r1.pairId === '9001' && r1.itemId === j.itemId, 'A1 · paire perdue par l’écran, N° 125 porté par UNE fiche ⇒ le lien est posé sur elle', r1);
    const r2 = lienApresPublication({ itemId: j.itemId, pairId: '9002', numero: '125', fiches });
    dit(r2 && r2.pairId === '9002', 'A2 · la paire choisie à l’écran gagne', r2);
    const deux = { ...fiches, 9004: { numero: '125' } };
    dit(lienApresPublication({ itemId: j.itemId, numero: '125', fiches: deux }) === null, 'A3 · deux fiches sous le N° ⇒ AUCUN lien (jamais la première)', '');
    dit(lienApresPublication({ itemId: j.itemId, numero: '', fiches }) === null && lienApresPublication({ itemId: j.itemId, numero: '999', fiches }) === null, 'A4 · sans N° ou N° inconnu ⇒ aucun lien (jamais par le titre)', '');
    dit(lienApresPublication({ itemId: 'abc', pairId: '9001', numero: '125', fiches }) === null, 'A5 · sans identifiant d’annonce eBay valide ⇒ aucun lien', '');
    dit(lienApresPublication({ itemId: j.itemId, numero: 'b230', fiches }).pairId === '9003', 'A6 · N° à lettres : la même identité (`cleNum`)', '');
    // L'écran : les deux chemins (publication, brouillon programmé) passent par la règle.
    const ecran = fs.readFileSync(path.join(RACINE, E), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    dit(/lienApresPublication\(\{ itemId: j\.itemId, pairId: \(b && b\.pairId\) \|\| pairId/.test(ecran) && /noterLienEbay\(li\.itemId, li\.pairId, li\.numero, 'publication'\)/.test(ecran),
      'B1 · l’écran eBay pose le lien par cette règle à la publication (le N° est celui envoyé à l’instant)', '');
    // Le serveur (notification de double vente, app fermée) lit le lien vers un article SANS Vinted comme l'app (`numEbayLu`).
    const DV = await import(path.join(RACINE, 'api', '_lib', 'double-vente.js'));
    const a0 = { itemId: '187654321098', sku: '', depuis: '2026-11-01T10:00:00Z' };
    dit(DV.numeroAnnonceEbay(a0, null, fiches, { 187654321098: { numero: '61', article: true, at: 1 } }) === '61' && DV.numeroAnnonceEbay(a0, null, fiches, { 187654321098: { numero: '62', propre: true } }) === '62'
      && DV.numeroAnnonceEbay(a0, null, fiches, { 187654321098: { numero: '63' } }) === '',
      'C1 · le serveur lit un lien eBay vers un article sans Vinted (`article` / `propre`) ; un N° nu sans marque n’est pas un lien', '');
  } catch (e) { dit(false, 'la règle du lien de publication existe (src/ebay/lienPublication.js)', String(e && e.message).slice(0, 160)); }
  console.log(`\n${ko ? '❌' : '✅'} audit-ebay-lien-publication : ${ko ? ko + ' rouge(s) sur ' + n : n + ' contrôles verts'}`);
  process.exit(ko ? 1 : 0);
})();
