// ════════════════════════════════════════════════════════════════════════════
//  LA RÈGLE D'OFFRE eBAY — LE BANC DE RENDU PROUVÉ PAR MUTATION (9 octobre)
//    node scripts/prouve-banc-regle-offre.cjs [--seule nom] [--avant dossier]
//
//  « La fonction n'existait pas avant » ne prouve rien (CLAUDE.md §6.1) : pour
//  chaque mutation, une copie de l'arbre courant (src/, public/, index.html,
//  vite.config.js, package.json et le banc — jamais `scripts/bancs/fx`) dans
//  os.tmpdir()/mut-banc-{nom} — avec api/ et supabase/, que `App.jsx` importe —, UN défaut injecté dans `src/App.jsx` (ancre
//  exacte, trouvée UNE fois — sinon ROUGE « non appliquée »), `vite build`
//  DANS la copie, puis le banc COPIÉ dedans et lancé DEPUIS elle (son `DIST`
//  se déduit de son `__dirname` : il rend le build muté, jamais `dist/` du
//  dépôt). Il doit sortir ≠ 0, avec un rouge dans chacun des blocs nommés.
//  `--avant dossier` : le même banc sur le build de la base d'avant (aucune
//  règle d'offre) doit sortir ROUGE lui aussi.
//  Le banc écoute le port 4761 : lancer ce script SEUL.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const RACINE = path.join(__dirname, '..');
const VITE = path.join(RACINE, 'node_modules', 'vite', 'bin', 'vite.js');
const iSeule = process.argv.indexOf('--seule');
const SEULE = iSeule > 0 ? process.argv[iSeule + 1] : null;
const iAv = process.argv.indexOf('--avant');
const AVANT = iAv > 0 ? path.resolve(process.argv[iAv + 1]) : null;

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// [nom, [[ancre, remplacement], …], blocs du banc qui doivent rougir]
const MUTATIONS = [
  // « pas su » devient « aucune » quand rien n'est rangé pour l'annonce.
  ['pas-su-aucune', [["  if (!e) return { etat: 'pas-su', raison: 'jamais', risque: false };", "  if (!e) return { etat: 'aucune', refuse: null, offresActives: null, offresFaites: null, lueA: 0, lu: { accepte: null, refuse: null } };"]], [1]],
  // la carte envoie le compte de PUBLICATION, pas celui de l'annonce.
  ['compte-vue', [['      Object.assign(corps, corpsCompteEbay(it._compte));', "      Object.assign(corps, corpsCompteEbay(load('vrm_ebay_compte_pub', '') || 'principal'));"]], [7]],
  // le lot part en parallèle.
  ['parallele', [["    for (let i = 0; i < fige.length; i++) {\n      if (!vivant.current || arret.current) break;\n      const x = fige[i];\n      envoyes.current = i + 1;\n      setProgres(i + 1);\n      const rep = await appelEbay(",
    "    const tous = fige.map((x) => appelEbay({ action: 'regleoffre', itemId: x.itemId, accepte: x.seuil, prixVu: x.prixVu, attendu: x.attendu, confirme: true, ...corpsCompteEbay(x.compte) }));\n    for (let i = 0; i < fige.length; i++) {\n      if (!vivant.current || arret.current) break;\n      const x = fige[i];\n      envoyes.current = i + 1;\n      setProgres(i + 1);\n      const rep = await tous[i]; void ("]], [9]],
  // l'envoi part AVANT la feuille de confirmation (la carte et le lot).
  ['annuler-envoie', [
    ['      const ok = await askConfirm({ title: `eBay acceptera seul les offres dès ${eurEbay(X)} ?`', "      await appelEbay({ action: 'regleoffre', itemId: String(it.itemId), accepte: X, prixVu: prixVuN, attendu: attenduDe(et), confirme: true, ...corpsCompteEbay(it._compte) });\n      const ok = await askConfirm({ title: `eBay acceptera seul les offres dès ${eurEbay(X)} ?`"],
    ['    const ok = await askConfirm({ title: `Laisser eBay accepter les offres sur', "    for (const l of selection) await appelEbay({ action: 'regleoffre', itemId: String(l.it.itemId), accepte: l.seuil, prixVu: l.prix, attendu: attenduDe(l.etat), confirme: true, ...corpsCompteEbay(l.it._compte || 'principal') });\n    const ok = await askConfirm({ title: `Laisser eBay accepter les offres sur"],
  ], [5, 9]],
  // l'aperçu porte sur TOUTES les annonces, pas sur celles de la vue.
  ['vue-ignoree', [['<EbayReglesToutes items={itemsVue}', '<EbayReglesToutes items={items}']], [9]],
  // plus aucune paire n'est bloquée (vendue, deux comptes, vente pas vérifiée).
  ['garde-vendue', [['  const regleBloquee = (it) => {\n    const n = numDeSkuEbay(it && it.sku);', '  const regleBloquee = (it) => { if (it) return null;\n    const n = numDeSkuEbay(it && it.sku);']], [10]],
  // la carte envoie toujours `refuse` (null quand rien n'est saisi ni lu).
  ['refuse-null-pas-su', [['      if (refuseCle !== undefined) corps.refuse = refuseCle;', '      corps.refuse = refuseCle === undefined ? null : refuseCle;']], [8]],
  // « ok » sans la relecture conforme d'eBay.
  ['verifie-ignore', [["  if (j && j.ok && j.verifie === true) return { issue: 'ok'", "  if (j && j.ok) return { issue: 'ok'"]], [8, 9]],
  // « Relire chez eBay » sans le compte.
  ['relire-sans-compte', [["          const { j } = await appelEbay({ action: 'regleoffrelire', itemIds: paquet.map((it) => String(it.itemId)), ...corpsCompteEbay(ref) });", "          const { j } = await appelEbay({ action: 'regleoffrelire', itemIds: paquet.map((it) => String(it.itemId)) });"]], [4]],
  // un « ✓ » en VERT (la règle du §7 : une seule couleur d'accent, jamais de vert).
  ['couleur-vert', [
    ["? E.text : E.warn, margin: '0 14px 11px'", "? '#34C759' : E.warn, margin: '0 14px 11px'"],
    ["color: msgTon === 'ok' ? E.text : E.warn, marginTop: 7", "color: msgTon === 'ok' ? '#34C759' : E.warn, marginTop: 7"],
  ], [5, 11]],
  // la fenêtre « Vinted → eBay » cachée quand le retrait automatique est allumé.
  ['fenetre-masquee', [["      <div data-regles-fenetre style={{ marginTop: 6, color: E.muted, fontSize: 12 }}>", "      <div {...(retraitAuto ? { hidden: true } : { 'data-regles-fenetre': '' })} style={{ marginTop: 6, color: E.muted, fontSize: 12 }}>"]], [2]],
];

function copier(dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.join(dest, 'scripts', 'bancs'), { recursive: true });
  // `src/App.jsx` importe aussi `api/_lib/` et `supabase/migrations/` : ils voyagent avec.
  for (const d of ['src', 'public', 'api', 'supabase']) fs.cpSync(path.join(RACINE, d), path.join(dest, d), { recursive: true });
  for (const f of ['index.html', 'package.json', 'vite.config.js']) fs.copyFileSync(path.join(RACINE, f), path.join(dest, f));
  for (const f of ['ebay-regle-offre.cjs', '_meta.cjs']) fs.copyFileSync(path.join(RACINE, 'scripts', 'bancs', f), path.join(dest, 'scripts', 'bancs', f));
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dest, 'node_modules')); } catch (_) {}
}
function appliquer(dest, rempl) {
  const p = path.join(dest, 'src', 'App.jsx');
  let s = fs.readFileSync(p, 'utf8');
  for (const [a, b] of rempl) {
    const n = s.split(a).length - 1;
    if (n !== 1) return `ancre trouvée ${n} fois : ${a.slice(0, 80)}`;
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(p, s);
  return '';
}
const construire = (dest) => cp.spawnSync(process.execPath, [VITE, 'build', '--logLevel', 'error'], { cwd: dest, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
const banc = (dest, args) => cp.spawnSync(process.execPath, [path.join(dest, 'scripts', 'bancs', 'ebay-regle-offre.cjs'), ...args], { cwd: dest, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });

for (const [nom, rempl, blocs] of MUTATIONS) {
  if (SEULE && SEULE !== nom) continue;
  const dest = path.join(os.tmpdir(), 'mut-banc-' + nom);
  copier(dest);
  const err = appliquer(dest, rempl);
  if (err) { dit(false, `mutation « ${nom} » non appliquée`, err); continue; }
  const b = construire(dest);
  if (b.status !== 0) { dit(false, `mutation « ${nom} » : le build de la copie a échoué`, ((b.stderr || '') + (b.stdout || '')).split('\n').slice(0, 3).join(' | ')); continue; }
  const r = banc(dest, ['--blocs', blocs.join(','), '--taille', '1512']);
  const s = (r.stdout || '') + (r.stderr || '');
  const rouges = blocs.map((n) => [n, (s.match(new RegExp('^KO  \\[' + n + '\\]', 'gm')) || []).length]);
  const premier = (s.match(/^KO  .*$/m) || [''])[0].slice(4, 150);
  dit(r.status !== 0 && rouges.every(([, k]) => k > 0), `mutation « ${nom} » : le banc passe au ROUGE`, `sortie ${r.status} · ${rouges.map(([n, k]) => `[${n}] ×${k}`).join(', ')} · ${premier}`);
  fs.rmSync(dest, { recursive: true, force: true });
}

if (AVANT && !SEULE) {
  // Le build de la base d'avant : aucun `data-regle-offre`, le banc doit tomber.
  const dest = path.join(os.tmpdir(), 'mut-banc-avant');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.join(dest, 'scripts', 'bancs'), { recursive: true });
  for (const d of ['src', 'public', 'api', 'supabase']) fs.cpSync(path.join(AVANT, d), path.join(dest, d), { recursive: true });
  for (const f of ['index.html', 'package.json', 'vite.config.js']) fs.copyFileSync(path.join(AVANT, f), path.join(dest, f));
  for (const f of ['ebay-regle-offre.cjs', '_meta.cjs']) fs.copyFileSync(path.join(RACINE, 'scripts', 'bancs', f), path.join(dest, 'scripts', 'bancs', f));
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dest, 'node_modules')); } catch (_) {}
  const b = construire(dest);
  if (b.status !== 0) dit(false, 'le build de la base d\'avant a échoué', (b.stderr || '').split('\n')[0]);
  else {
    const r = banc(dest, ['--taille', '1512']);
    const s = (r.stdout || '') + (r.stderr || '');
    const nKo = (s.match(/^KO  /gm) || []).length, nOk = (s.match(/^OK  /gm) || []).length;
    dit(r.status !== 0 && nKo > 0, 'sur le build de la base d\'avant, le banc est ROUGE', `sortie ${r.status} · ${nKo} rouge(s), ${nOk} vert(s)`);
  }
  fs.rmSync(dest, { recursive: true, force: true });
}

console.log(`\n${ko ? '❌' : '✅'} prouve-banc-regle-offre : ${ok} vert(s), ${ko} rouge(s)${ko ? '' : ' — chaque règle de l\'écran, réaffaiblie, fait tomber le banc'}`);
process.exit(ko ? 1 : 0);
