// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : CHERCHER PAR COULEUR (14 nov., proposition 104) — node scripts/audit-couleur-photo.cjs
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE la vraie règle (src/couleurPhoto.js) sur des « photos » INVENTÉES
// (scripts/_images-inventees.cjs) :
//   A. la couleur DOMINANTE d'une paire est la sienne, pas celle du fond (bleue sur mur
//      beige ⇒ bleu ; rouge, vert, jaune, rose, noire, blanche sur fond gris…) ;
//   B. une photo sombre (× 0,7) ou floue garde sa famille ;
//   C. les mots : chaque famille dans les CINQ langues (fr, en, es, it, de), accents et
//      pluriels compris (« bleue », « blancs », « grün », « weiß ») ; un mot qui n'est pas
//      une couleur ne déclenche rien ;
//   D. une RECHERCHE, jamais une identité (§5) : 50 photos bleues au MÊME titre ⇒ 50
//      résultats distincts, rangés par identité de photo ; une photo pas lue n'est jamais
//      rendue ; aucune règle d'identité (`entryKeyByPhoto`, `jumellesParPhoto`,
//      `identiteAnnonce`) ne lit ces modules, et la feuille n'écrit rien ;
//   E. 100 % sur l'appareil : aucun réseau dans la règle, l'index et la feuille (hors le
//      `lireOctets` injecté, celui de la recherche par photo).
// AUDIT_MUTATION=fond | titre : la règle réaffaiblie ⇒ l'audit doit rougir.
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const { dessiner, flouter, assombrir } = require('./_images-inventees.cjs');
const MUT = process.env.AUDIT_MUTATION || '';
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const SRC = path.join(RACINE, 'src', 'couleurPhoto.js');
const MUTATIONS = {
  // Le fond compte autant que la paire (la photo d'une paire bleue sur un mur beige devient beige).
  fond: ['const loinFond = unif ? 1 : Math.min(1, Math.max(0, (d - 18) / 50));', 'const loinFond = 1;'],
  // Les résultats se dédoublonnent par TITRE (ce que §5 interdit).
  titre: ["if (!e || e.cle == null || vues.has(String(e.cle)) || !Array.isArray(e.couleurs)) continue;", "if (!e || e.cle == null || vues.has(String(e.titre)) || !Array.isArray(e.couleurs)) continue;"],
};
(async () => {
  if (!fs.existsSync(SRC)) { dit(false, 'src/couleurPhoto.js existe', 'absent : la recherche par couleur n’existe pas sur cet arbre'); return fin(); }
  let chemin = SRC;
  if (MUT) {
    const m = MUTATIONS[MUT]; let s = fs.readFileSync(SRC, 'utf8');
    if (!m || !s.includes(m[0])) { console.log('KO  mutation inconnue ou plus applicable : ' + MUT); process.exit(2); }
    s = s.replace(m[0], m[1]);
    if (MUT === 'titre') s = s.replace('vues.add(String(e.cle));', 'vues.add(String(e.titre));');
    chemin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mut-couleur-')), 'couleurPhoto.mjs');
    fs.writeFileSync(chemin, s);
    console.log('── mutation : ' + MUT);
  }
  const K = await import(chemin);
  const dom = (img) => { const c = K.couleursDePixels(img.px, img.w, img.h); return c && c[0] ? c[0].c : null; };
  const W = 192, H = 256;
  const cas = [
    ['bleu', { tige: '#1d4ed8', col: '#1d4ed8', semelle: '#1d4ed8', bande: '#1e40af', lacets: '#1d4ed8', fond: ['#e9dfcf', '#d8c8ae'] }],
    ['rouge', { tige: '#c8102e', col: '#c8102e', semelle: '#c8102e', bande: '#a00d25', lacets: '#c8102e', fond: ['#e5e7eb', '#d1d5db'] }],
    ['vert', { tige: '#15803d', col: '#15803d', semelle: '#15803d', bande: '#166534', lacets: '#15803d', fond: ['#f4f4f2', '#e0e0e0'] }],
    ['jaune', { tige: '#fde047', col: '#facc15', semelle: '#fde047', bande: '#facc15', lacets: '#fde047', fond: ['#e8ecef', '#c9cfd6'] }],
    ['rose', { tige: '#ec4899', col: '#ec4899', semelle: '#f472b6', bande: '#db2777', lacets: '#ec4899', fond: ['#f5f5f5', '#e5e5e5'] }],
    ['noir', { tige: '#111111', col: '#111111', semelle: '#1a1a1a', bande: '#222222', lacets: '#111111', fond: ['#f5f5f5', '#e7e7e7'] }],
    ['blanc', { tige: '#fafafa', col: '#f8f8f8', semelle: '#ffffff', bande: '#f2f2f2', lacets: '#ffffff', fond: ['#8e9399', '#6b7076'] }],
    ['orange', { tige: '#f97316', col: '#f97316', semelle: '#ea580c', bande: '#f97316', lacets: '#f97316', fond: ['#e8ecef', '#c9cfd6'] }],
    ['marron', { tige: '#6b3f1d', col: '#6b3f1d', semelle: '#5a3417', bande: '#7a4a24', lacets: '#6b3f1d', fond: ['#eeeeee', '#dddddd'] }],
    ['violet', { tige: '#6d28d9', col: '#6d28d9', semelle: '#5b21b6', bande: '#6d28d9', lacets: '#6d28d9', fond: ['#f2f2f2', '#e2e2e2'] }],
    ['gris', { tige: '#8a8f96', col: '#8a8f96', semelle: '#7c8188', bande: '#8a8f96', lacets: '#8a8f96', fond: ['#f9f6ef', '#efe7d8'] }],
  ];
  let a = 0;
  for (const [att, m] of cas) { const d = dom(dessiner({ ...m, W, H, graine: 3 })); if (d === att) a++; else dit(false, `A. paire ${att} sur son fond`, 'lue : ' + d); }
  dit(a === cas.length, `A. ${a}/${cas.length} paires : la couleur de la PAIRE, pas celle du fond`);
  let b = 0;
  for (const [att, m] of cas) { const i = dessiner({ ...m, W, H, graine: 4 }); if (dom(assombrir(i, 0.75)) === att && dom(flouter(i, 2)) === att) b++; }
  dit(b >= cas.length - 1, `B. ${b}/${cas.length} gardent leur famille un peu sombres (× 0,75) et floues`);
  dit(K.couleursDePixels(new Uint8ClampedArray(4), 1, 1) === null, 'B. une image illisible : null (pas su), jamais « aucune couleur »');

  // C. les mots, cinq langues
  const MOTS = { bleu: ['bleu', 'Bleue', 'BLEUS', 'blue', 'azul', 'blu', 'blau', 'Nike bleue 42'], blanc: ['blanc', 'blanches', 'white', 'blanco', 'bianco', 'weiß', 'weiss'], noir: ['noir', 'black', 'negra', 'nero', 'schwarz'], rouge: ['rouge', 'red', 'rojo', 'rosso', 'rot'], vert: ['vert', 'verte', 'green', 'verde', 'grün'], gris: ['gris', 'grey', 'gray', 'grigio', 'grau'], rose: ['rose', 'pink', 'rosa'], jaune: ['jaune', 'yellow', 'amarillo', 'giallo', 'gelb'], marron: ['marron', 'brown', 'marrone', 'braun'], beige: ['beige', 'crème', 'beis'], orange: ['orange', 'naranja', 'arancione'], violet: ['violet', 'purple', 'morado', 'viola', 'lila'] };
  let c = 0, n = 0;
  for (const [f, mots] of Object.entries(MOTS)) for (const w of mots) { n++; const r = K.couleurDeRequete(w); if (r && r.famille === f) c++; else dit(false, `C. « ${w} » ⇒ ${f}`, r ? r.famille : 'rien'); }
  dit(c === n, `C. ${c}/${n} mots de couleur reconnus dans les cinq langues`);
  dit(['N°124', 'Nike Dunk 42', 'jordan', 'semelle', ''].every((w) => K.couleurDeRequete(w) === null), 'C. un mot qui n’est pas une couleur ne déclenche rien');
  for (const l of ['fr', 'en', 'es', 'it', 'de']) dit(K.FAMILLES.every((f) => typeof K.nomCouleur(f, l) === 'string' && K.nomCouleur(f, l)), `C. chaque famille a son nom en « ${l} »`);

  // D. une recherche, jamais une identité
  const entrees = Array.from({ length: 50 }, (_, i) => ({ cle: `https://images1.vinted.net/t/x/f800/${1000 + i}.jpeg`, titre: 'Nike Dunk Low Panda 42', num: String(201 + i), couleurs: [{ c: 'bleu', part: 0.6 + (i % 5) / 100 }] }));
  entrees.push({ cle: 'pas-lue', titre: 'Nike Dunk Low Panda 42', num: '300', couleurs: null });
  const r = K.photosDeCouleur(entrees, 'bleu');
  dit(r.length === 50 && new Set(r.map((x) => x.cle)).size === 50 && new Set(r.map((x) => x.num)).size === 50, 'D. 50 photos bleues au même titre ⇒ 50 résultats distincts (par identité de photo)', String(r.length));
  dit(!r.some((x) => x.cle === 'pas-lue'), 'D. une photo pas encore lue n’est jamais rendue');
  dit(K.photosDeCouleur(entrees, 'pas-une-couleur').length === 0, 'D. une famille inconnue ne rend rien');
  const app = require('./_source-app.cjs').lireApp ? require('./_source-app.cjs').lireApp() : fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const corps = (nom) => { const i = app.search(new RegExp('function ' + nom + '\\b|const ' + nom + '\\s*=')); return i < 0 ? '' : app.slice(i, i + 4000); };
  dit(['entryKeyByPhoto', 'jumellesParPhoto', 'identiteAnnonce'].every((f) => !/couleur|Couleur/.test(corps(f).split('\n}')[0])), 'D. aucune règle d’identité ne lit la couleur');
  const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
  const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  const feuille = sansCom(lire('src/RechercheCouleur.jsx'));
  dit(feuille && !/save\(|cloudPush|gesteVrm|withOwner|method:\s*'(POST|PATCH)'/.test(feuille), 'D. la feuille n’écrit rien (ni base, ni réglage)');
  // E. aucun réseau
  for (const f of ['src/couleurPhoto.js', 'src/indexCouleurs.js', 'src/RechercheCouleur.jsx', 'src/LigneCouleurLoupe.jsx']) {
    const s = sansCom(lire(f));
    dit(s && !/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//.test(s), `E. ${f} : aucun réseau`);
  }
  dit(/import\('\.\/RechercheCouleur\.jsx'\)/.test(app), 'E. la feuille se charge À LA DEMANDE');
  fin();
})().catch((e) => { console.log('KO  exception : ' + (e && e.stack || e)); process.exit(1); });
function fin() { console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert'); process.exit(ko ? 1 : 0); }
