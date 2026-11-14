// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES PHOTOS DU MODE EXEMPLE (14 nov.)
//  Julien : « fais des exemples avec des photos pour les annonces ». Dépôt PUBLIC,
//  app commerciale : une photo d'exemple n'entre que sous une licence permise,
//  créditée, légère, et une photo = une paire (VRM tient deux fiches au même
//  fichier photo pour la même paire, CLAUDE.md §5).
//  C1  public/exemple/CREDITS.md existe et porte le tableau des photos ;
//  C2  chaque ligne de crédit : fichier, ce qu'on voit, auteur, page source https,
//      licence PERMISE (src/exemplePhotos.js, LICENCES_PERMISES) et page source
//      sur le site de CETTE licence, date de vérification ;
//  F1  chaque fichier de public/exemple/ (hors CREDITS.md) est un WebP
//      `{fichier}-400.webp` 400×400 ou `-120.webp` 120×120, < 40 Ko, et sa photo
//      a sa ligne de crédit (aucune image d'exemple sans crédit) ;
//  F2  chaque photo créditée a ses deux fichiers ;
//  L1  chaque entrée de PHOTOS_EXEMPLE : fichier unique, marque/modèle/couleur
//      écrits, ligne de crédit dont « ce qu'on voit » nomme la marque et le modèle ;
//  B1  le branchement (jeuExemple, avec une liste de 20 entrées SIMULÉES dans une
//      copie temporaire, jamais livrée) : chaque paire avec photo l'a sous
//      `{origine}/exemple/…-400.webp`, jamais deux paires sur la même photo, la
//      même paire garde sa photo (vente ⇔ bordereau), le titre nomme marque,
//      modèle et couleur de SA photo ; au-delà de la liste : pas de photo ;
//  B2  sans origine, ou avec le catalogue mélangé de l'accueil : aucune photo ;
//      liste vide : le jeu d'avant, sans photo ;
//  S1  aucune adresse d'image en dur dans src/exempleDonnees.js ni d'hôte externe
//      dans src/exemplePhotos.js (les images viennent de public/, CSP) ;
//  N   le nombre de photos (20 à 30 attendues) : `--complet` le rend obligatoire.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const R = process.env.EXPH_RACINE || path.join(__dirname, '..');
const COMPLET = process.argv.includes('--complet');
const MAX = 40 * 1024;
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 300) : ''}`); };

// Dimensions d'un WebP (VP8, VP8L, VP8X), ou null si ce n'en est pas un.
function tailleWebp(b) {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const t = b.toString('ascii', 12, 16);
  if (t === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (t === 'VP8L') { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
  if (t === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  return null;
}

async function main() {
  const photos = await import(pathToFileURL(path.join(R, 'src', 'exemplePhotos.js')).href);
  const { PHOTOS_EXEMPLE, LICENCES_PERMISES } = photos;
  const DOS = path.join(R, 'public', 'exemple');

  // ── C. Les crédits ──
  const credits = fs.existsSync(path.join(DOS, 'CREDITS.md')) ? fs.readFileSync(path.join(DOS, 'CREDITS.md'), 'utf8') : '';
  dit(/\n## Photos\n/.test(credits) && /\| fichier \| ce qu'on voit \| auteur \| page source \| licence \| vérifiée le \|/.test(credits), 'C1 public/exemple/CREDITS.md porte le tableau des photos');
  const corps = credits.split(/\n## Photos\n/)[1] || '';
  const lignes = corps.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*fichier\s*\|/.test(l) && !/^\|[-|\s]+\|$/.test(l));
  const credit = new Map();
  for (const l of lignes) {
    const c = l.split('|').slice(1, -1).map((x) => x.trim().replace(/^`|`$/g, ''));
    const [fichier, voit, auteur, source, licence, date] = c;
    const motif = LICENCES_PERMISES[licence];
    dit(c.length === 6 && /^[a-z0-9-]+$/.test(fichier || '') && !!voit && !!auteur && /^https:\/\//.test(source || '') && /^\d{4}-\d{2}-\d{2}$/.test(date || ''), `C2 crédit « ${fichier} » : fichier, ce qu'on voit, auteur, page source, date`, l);
    dit(!!motif, `C2 crédit « ${fichier} » : licence permise (${licence})`, Object.keys(LICENCES_PERMISES));
    dit(!!motif && motif.test(source || ''), `C2 crédit « ${fichier} » : la page source est sur le site de SA licence`, source);
    dit(!credit.has(fichier), `C2 crédit « ${fichier} » : une seule ligne`);
    credit.set(fichier, { voit, auteur, source, licence });
  }

  // ── F. Les fichiers ──
  const fichiers = fs.existsSync(DOS) ? fs.readdirSync(DOS).filter((f) => f !== 'CREDITS.md') : [];
  for (const f of fichiers) {
    const m = /^([a-z0-9-]+)-(400|120)\.webp$/.exec(f);
    const b = fs.readFileSync(path.join(DOS, f));
    const t = tailleWebp(b);
    dit(!!m && !!t && t.w === Number(m[2]) && t.h === Number(m[2]), `F1 ${f} : WebP ${m ? m[2] + '×' + m[2] : '{fichier}-400|120.webp'}`, t);
    dit(b.length < MAX, `F1 ${f} : ${(b.length / 1024).toFixed(1)} Ko < 40 Ko`);
    dit(!!m && credit.has(m[1]), `F1 ${f} : sa photo a sa ligne de crédit`);
  }
  for (const nom of credit.keys()) dit(['400', '120'].every((s) => fichiers.includes(`${nom}-${s}.webp`)), `F2 « ${nom} » : ses deux fichiers (-400, -120)`);

  // ── L. La liste ──
  const vus = new Set();
  for (const p of PHOTOS_EXEMPLE) {
    dit(p && /^[a-z0-9-]+$/.test(p.fichier || '') && !vus.has(p.fichier) && !!p.marque && !!p.modele && !!p.couleur, `L1 entrée « ${p && p.fichier} » : fichier unique, marque, modèle, couleur`, p);
    vus.add(p && p.fichier);
    const c = credit.get(p && p.fichier);
    dit(!!c && c.voit.toLowerCase().includes(String(p.marque).toLowerCase()) && c.voit.toLowerCase().includes(String(p.modele).toLowerCase()), `L1 entrée « ${p && p.fichier} » : crédit dont « ce qu'on voit » nomme ${p && p.marque} ${p && p.modele}`, c);
  }

  // ── B. Le branchement, sur une copie temporaire avec 20 entrées simulées ──
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exph-'));
  try {
    const simulees = Array.from({ length: 20 }, (_, i) => ({ fichier: `simulee-${i}`, marque: `Marque${i}`, modele: `Modele${i}`, couleur: `couleur${i}` }));
    const srcPh = fs.readFileSync(path.join(R, 'src', 'exemplePhotos.js'), 'utf8');
    fs.writeFileSync(path.join(tmp, 'exemplePhotos.js'), srcPh.replace(/export const PHOTOS_EXEMPLE = \[[\s\S]*?\];/, 'export const PHOTOS_EXEMPLE = ' + JSON.stringify(simulees) + ';'));
    fs.copyFileSync(path.join(R, 'src', 'exempleDonnees.js'), path.join(tmp, 'exempleDonnees.js'));
    fs.writeFileSync(path.join(tmp, 'vide.js'), srcPh.replace(/export const PHOTOS_EXEMPLE = \[[\s\S]*?\];/, 'export const PHOTOS_EXEMPLE = [];'));
    fs.mkdirSync(path.join(tmp, 'v'));
    fs.copyFileSync(path.join(tmp, 'vide.js'), path.join(tmp, 'v', 'exemplePhotos.js'));
    fs.copyFileSync(path.join(R, 'src', 'exempleDonnees.js'), path.join(tmp, 'v', 'exempleDonnees.js'));
    const { jeuExemple } = await import(pathToFileURL(path.join(tmp, 'exempleDonnees.js')).href);
    const ORI = 'https://vrm.center';
    const jeu = jeuExemple(1.7e12, { origine: ORI });
    const ligne = (id) => (jeu.lignes.find((l) => l.id === id) || {}).data || {};
    const articles = [...(ligne('harvest_111_listings').payload || {}).items || [], ...(ligne('harvest_222_listings').payload || {}).items || [],
      ...(ligne('harvest_111_orders_sold').payload || {}).my_orders || [], ...(ligne('harvest_222_orders_sold').payload || {}).my_orders || [],
      ...(ligne('harvest_111_orders_purchased').payload || {}).my_orders || []];
    const urls = articles.map((a) => (a.photo && a.photo.url) || null);
    dit(articles.length === 19 && urls.every((u) => u && u.startsWith(ORI + '/exemple/simulee-') && u.endsWith('-400.webp')), 'B1 chaque paire (19) a sa photo sous {origine}/exemple/…-400.webp', urls);
    dit(new Set(urls).size === urls.length, 'B1 jamais deux paires sur la même photo', urls);
    dit(articles.every((a) => { const m = /simulee-(\d+)-400/.exec((a.photo && a.photo.url) || ''); return m && a.title.includes(`Marque${m[1]} Modele${m[1]} couleur${m[1]}`); }), 'B1 le titre nomme la marque, le modèle et la couleur de SA photo', articles.map((a) => [a.title, a.photo && a.photo.url]));
    const v0 = articles.find((a) => a.transaction_id === 62000);
    dit(!!v0 && ligne('email_bord_62000').modele === v0.title, 'B1 la même paire (vente 62000 ⇔ son bordereau) garde son titre — donc sa photo');
    const peu = await import(pathToFileURL(path.join(tmp, 'exemplePhotos.js')).href);
    dit(peu.photoDeLaPaire(20, ORI) === null && peu.photoDeLaPaire(-1, ORI) === null, 'B1 au-delà de la liste : aucune photo prêtée');
    const sans = jeuExemple(1.7e12, {});
    const cat = jeuExemple(1.7e12, { origine: ORI, catalogue: [['Sac seau', 'Marque', '']] });
    const aucune = (j) => !JSON.stringify(j).includes('/exemple/');
    dit(aucune(sans) && aucune(cat), 'B2 sans origine, ou avec le catalogue de l\'accueil : aucune photo');
    const { jeuExemple: jeuVide } = await import(pathToFileURL(path.join(tmp, 'v', 'exempleDonnees.js')).href);
    const vide = jeuVide(1.7e12, { origine: ORI });
    const titres = (j) => JSON.stringify(j.lignes.filter((l) => /^harvest_/.test(l.id)).map((l) => l.data.payload));
    dit(aucune(vide) && /Nike Air Max 90 blanche taille 38/.test(titres(vide)) && titres(vide) === titres(sans), 'B2 liste vide : le jeu d\'avant, sans photo');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  // ── S. La source ──
  const sd = fs.readFileSync(path.join(R, 'src', 'exempleDonnees.js'), 'utf8').replace(/\/\/.*$/gm, '');
  const sp = fs.readFileSync(path.join(R, 'src', 'exemplePhotos.js'), 'utf8').replace(/\/\/.*$/gm, '');
  dit(!/https?:\/\/|\.(webp|jpe?g|png|avif)\b/i.test(sd), 'S1 aucune adresse d\'image en dur dans src/exempleDonnees.js');
  const hotes = (sp.match(/https?:\/\/[^'"`\s)]+/g) || []).filter((u) => !/^https:\\\/\\\/\(/.test(u));
  dit(!/(['"`])https?:\/\//.test(sp) && /'\/exemple\/'/.test(sp), 'S1 src/exemplePhotos.js ne sert que /exemple/ (aucun hôte externe)', hotes);

  // ── N. Le nombre ──
  const n = PHOTOS_EXEMPLE.length;
  if (COMPLET) dit(n >= 20 && n <= 30, `N ${n} photos (20 à 30 attendues)`);
  else console.log(`${n >= 20 ? 'OK  ' : 'EN ATTENTE  '}N ${n} photo(s) d'exemple (20 à 30 attendues ; \`--complet\` l'exige)`);

  console.log(ko ? `\n❌ audit-exemple-photos : ${ko} rouge(s)` : '\n✅ audit-exemple-photos : vert');
  return ko;
}

// ── --prouve : chaque mutation, sur une copie, doit rougir ──
function prouver() {
  const MUT = [
    ['licence non permise', (d) => { ajouterPhoto(d, 'nike-test', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:X.jpg'); }],
    ['licence permise mais page source d\'un autre site', (d) => { ajouterPhoto(d, 'nike-test', 'Unsplash License', 'https://www.pexels.com/photo/x-1/'); }],
    ['image sans ligne de crédit', (d) => { fs.writeFileSync(path.join(d, 'public/exemple/orpheline-400.webp'), webp(400)); }],
    ['image trop lourde', (d) => { ajouterPhoto(d, 'nike-test', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:X.jpg', 41 * 1024); }],
    ['mauvaise taille', (d) => { ajouterPhoto(d, 'nike-test', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:X.jpg', 0, 300); }],
    ['photo prêtée à deux paires (modulo)', (d) => { remplacer(d, 'src/exemplePhotos.js', 'k >= PHOTOS_EXEMPLE.length) return null;\n  const p = PHOTOS_EXEMPLE[k];', 'PHOTOS_EXEMPLE.length === 0) return null;\n  const p = PHOTOS_EXEMPLE[k % PHOTOS_EXEMPLE.length];'); remplacer(d, 'src/exemplePhotos.js', 'k < PHOTOS_EXEMPLE.length ? PHOTOS_EXEMPLE[k] : null', 'PHOTOS_EXEMPLE.length ? PHOTOS_EXEMPLE[k % PHOTOS_EXEMPLE.length] : null'); }],
    ['titre qui ne suit pas la photo', (d) => { remplacer(d, 'src/exempleDonnees.js', 'return d ? `${d.marque} ${d.modele} ${d.couleur} taille ${taille}` : avant;', 'return avant;'); }],
    ['la vente perd sa photo', (d) => { remplacer(d, 'src/exempleDonnees.js', 'date: iso(jours), photo: photo(kVente(i)) });', 'date: iso(jours), photo: null });'); }],
    ['photo d\'un hôte externe', (d) => { remplacer(d, 'src/exemplePhotos.js', "const base = String(origine).replace(/\\/+$/, '') + '/exemple/' + p.fichier;", "const base = 'https://images.unsplash.com/' + p.fichier;"); }],
    ['photo même sans origine', (d) => { remplacer(d, 'src/exemplePhotos.js', "if (!origine || !Number.isInteger(k)", "if (!Number.isInteger(k)"); remplacer(d, 'src/exemplePhotos.js', "const base = String(origine).replace", "const base = String(origine || 'https://vrm.center').replace"); }],
  ];
  function webp(cote, poids = 0) {
    const b = Buffer.alloc(Math.max(40, poids)); b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(b.length - 8, 4); b.write('WEBP', 8, 'ascii'); b.write('VP8X', 12, 'ascii');
    b.writeUIntLE(cote - 1, 24, 3); b.writeUIntLE(cote - 1, 27, 3); return b;
  }
  function remplacer(d, f, a, n) { const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error(`mutation introuvable dans ${f} : ${a.slice(0, 60)}`); fs.writeFileSync(p, s.replace(a, n)); }
  function ajouterPhoto(d, nom, licence, source, poids = 0, cote = 400) {
    fs.writeFileSync(path.join(d, `public/exemple/${nom}-400.webp`), webp(cote, poids));
    fs.writeFileSync(path.join(d, `public/exemple/${nom}-120.webp`), webp(cote === 400 ? 120 : cote));
    const c = path.join(d, 'public/exemple/CREDITS.md');
    fs.writeFileSync(c, fs.readFileSync(c, 'utf8').replace('|---|---|---|---|---|---|\n', `|---|---|---|---|---|---|\n| ${nom} | Nike Air Max 90 blanche | Auteur | ${source} | ${licence} | 2026-11-14 |\n`));
    remplacer(d, 'src/exemplePhotos.js', 'export const PHOTOS_EXEMPLE = [];', `export const PHOTOS_EXEMPLE = [{ fichier: '${nom}', marque: 'Nike', modele: 'Air Max 90', couleur: 'blanche' }];`);
  }
  let rates = 0;
  // Le TÉMOIN : une photo en règle (CC0, Commons, 400/120, < 40 Ko, créditée) garde l'audit VERT —
  // sans lui, une mutation pourrait rougir à cause de l'aide qui pose la photo, pas de la règle.
  MUT.unshift(['(témoin) une photo en règle reste verte', (d) => { ajouterPhoto(d, 'nike-test', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:X.jpg'); }, 'vert']);
  for (const [nom, muter, attendu] of MUT) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'exph-mut-'));
    try {
      for (const f of ['src/exemplePhotos.js', 'src/exempleDonnees.js']) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.copyFileSync(path.join(R, f), path.join(d, f)); }
      fs.mkdirSync(path.join(d, 'public/exemple'), { recursive: true });
      for (const f of fs.readdirSync(path.join(R, 'public/exemple'))) fs.copyFileSync(path.join(R, 'public/exemple', f), path.join(d, 'public/exemple', f));
      muter(d);
      const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, EXPH_RACINE: d }, encoding: 'utf8' });
      const rouge = r.status !== 0;
      const bon = attendu === 'vert' ? !rouge : rouge;
      if (!bon) rates++;
      console.log(`${bon ? 'OK  ' : 'KO  '}mutation « ${nom} » : ${rouge ? 'rouge' : 'vert'}${bon ? '' : ' — ' + (r.stdout || '').split('\n').filter((l) => /^KO/.test(l)).join(' | ').slice(0, 300)}`);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  }
  console.log(rates ? `\n❌ --prouve : ${rates} contrôle(s) faux` : `\n✅ --prouve : témoin vert, ${MUT.length - 1}/${MUT.length - 1} mutations rouges`);
  process.exit(rates ? 1 : 0);
}

if (process.argv.includes('--prouve')) prouver();
else main().then((k) => process.exit(k ? 1 : 0), (e) => { console.error(e); process.exit(1); });
