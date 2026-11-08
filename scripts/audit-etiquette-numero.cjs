// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LE N° DANS LE TEXTE DE L'ANNONCE ET LE N° CHANGÉ À LA MAIN » (5 nov.)
//  1. La règle src/etiquetteNumero.js, EXÉCUTÉE : par défaut rien ne change ;
//     chaque place × forme pose UNE étiquette au bon bord ; un N° changé
//     remplace l'ancienne étiquette (jamais « N°12 N°40 ») ; un nombre nu n'est
//     jamais pris pour une étiquette (« Air Max 90 », « brun12 », « taille (42) »
//     quand on écrit ailleurs) ; un titre > 100 est refusé, jamais coupé ; la
//     lettre de Republier reste la dernière ligne ; poser deux fois = poser une
//     fois ; un réglage inconnu retombe sur « Nulle part ».
//  2. §5 : l'étiquette n'est jamais une identité — le module n'exporte aucune
//     fonction qui LIRAIT un numéro dans un texte.
//  3. App.jsx : le réglage est synchronisé (SYNC_KEYS) ; chaque écriture d'un N°
//     par `poserNumero` note l'ancien à barrer (`changeAMain`) ; « le carton dit
//     N°58 » (`corrigerCarton`) ne le fait pas ; `reattribueAEcrire` est la même.
//  `--src <arbre>` : juge une autre copie (preuve sur le code d'avant, §6.1).
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const i = process.argv.indexOf('--src');
const RACINE = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };

(async () => {
  const mod = path.join(RACINE, 'src', 'etiquetteNumero.js');
  let E = null;
  try { E = await import('file://' + mod); } catch (e) { dit(false, 'src/etiquetteNumero.js existe et se charge', String(e && e.message).slice(0, 120)); }
  if (E) {
    const { poserEtiquette: P, retirerEtiquette: R, lireReglageEtiquette: L, etiquetteDe, proposition, PLACES, FORMES, TITRE_MAX_VINTED } = E;
    console.log('— La règle');
    const A = { titre: 'Nike Air Max 90 blanches taille 42', description: 'Très bon état.\nEnvoi rapide.' };
    let r = P(A, '12', null);
    dit(!r.pose && r.titre === A.titre && r.description === A.description, 'sans réglage : « Nulle part », rien ne change');
    dit(JSON.stringify(L({ place: 'partout', forme: 'xx' })) === JSON.stringify({ place: 'aucune', forme: 'numero' }), 'un réglage inconnu retombe sur « Nulle part »');
    const compte = (s, e) => s.split(e).length - 1;
    let toutes = true, detail = '';
    for (const p of PLACES.filter((x) => x.v !== 'aucune')) for (const f of FORMES) {
      const e = etiquetteDe('12', f.v); r = P(A, '12', { place: p.v, forme: f.v });
      const zone = p.v.startsWith('titre') ? r.titre : r.description;
      const bon = r.pose && compte(r.titre + '\n' + r.description, e) === 1
        && (p.v === 'titre_fin' ? zone.endsWith(' ' + e) : p.v === 'titre_debut' ? zone.startsWith(e + ' ') : p.v === 'desc_debut' ? zone.startsWith(e + '\n\n') : zone.endsWith('\n\n' + e))
        && (p.v.startsWith('titre') ? r.description === A.description : r.titre === A.titre);
      const deux = P(r, '12', { place: p.v, forme: f.v });
      if (!bon || deux.titre !== r.titre || deux.description !== r.description) { toutes = false; detail = `${p.v}/${f.v} : ${JSON.stringify([r.titre, r.description, deux.titre])}`; }
    }
    dit(toutes, 'chaque place × forme : une étiquette, au bon bord, l\'autre zone intacte, et poser deux fois = une fois', detail);
    r = P({ titre: 'Air Max 90 N°12', description: 'x' }, '40', { place: 'titre_fin', forme: 'numero' }, { ancien: '12' });
    dit(r.titre === 'Air Max 90 N°40', 'N° changé 12 → 40 : l\'étiquette est REMPLACÉE, jamais empilée', r.titre);
    r = P({ titre: 'T', description: 'Bon état\n\nRéf 012' }, '40', { place: 'desc_fin', forme: 'ref' }, { ancien: '12' });
    dit(r.description === 'Bon état\n\nRéf 40', '« Réf 012 » = l\'étiquette du 12 (clé du N°) : remplacée', JSON.stringify(r.description));
    r = P({ titre: 'Nike Air Max 90', description: 'x' }, '90', { place: 'titre_fin', forme: 'numero' });
    dit(r.titre === 'Nike Air Max 90 N°90', 'un nombre nu n\'est jamais une étiquette (« Air Max 90 » reste)', r.titre);
    dit(R({ titre: 'Chaussures brun12', description: '' }, '12').titre === 'Chaussures brun12', '« brun12 » n\'est pas l\'étiquette « n12 »');
    r = P({ titre: 'Nike taille (42)', description: 'x' }, '42', { place: 'desc_fin', forme: 'parentheses' });
    dit(r.titre === 'Nike taille (42)' && r.description === 'x\n\n(42)', 'écrire en description ne touche jamais le titre (« taille (42) » reste)', JSON.stringify(r));
    r = P({ titre: 'Nike taille (42)', description: 'x' }, '42', { place: 'titre_debut', forme: 'parentheses' });
    dit(r.titre === '(42) Nike taille (42)', 'écrire au début du titre ne retire rien à la fin', r.titre);
    const long = 'A'.repeat(TITRE_MAX_VINTED - 2);
    r = P({ titre: long, description: 'x' }, '40', { place: 'titre_fin', forme: 'numero' });
    dit(!r.pose && r.titre === long && /100/.test(r.refus), 'titre de plus de 100 caractères : refusé et dit, jamais coupé', r.refus);
    r = P({ titre: 'T', description: 'Bon état\n\nk' }, '40', { place: 'desc_fin', forme: 'numero' });
    dit(r.description === 'Bon état\n\nN°40\n\nk', 'la lettre de Republier reste la dernière ligne', JSON.stringify(r.description));
    r = P({ titre: 'T', description: 'Bon état\n\nN°12\n\nk' }, '40', { place: 'desc_fin', forme: 'numero' }, { ancien: '12' });
    dit(r.description === 'Bon état\n\nN°40\n\nk', 'et l\'ancienne étiquette avant la lettre est remplacée', JSON.stringify(r.description));
    dit(etiquetteDe('B125', 'ref') === 'Réf B125' && etiquetteDe(' c 40 ', 'diese') === '#c40', 'un N° à lettres s\'écrit tel quel (« Réf B125 »)');
    const pr = proposition({ ou: 'liste', vu: 'egal' }), pd = proposition({ ou: 'annonce', vu: 'discret' });
    dit(pr && pr.place === 'titre_fin' && pd && pd.place === 'desc_fin' && proposition({ ou: 'liste' }) === null && proposition({ ou: 'vrm' }).place === 'aucune', 'l\'accompagnement propose une place selon ses deux réponses, rien sans réponse');
    console.log('— §5 : jamais une identité');
    const exp = Object.keys(E);
    dit(!exp.some((k) => /^(lire|trouver|extraire)(Numero|Num)|numeroDu|numeroDe/i.test(k)), 'le module n\'exporte aucune lecture de N° dans un texte', exp.join(','));
  }
  console.log('— App.jsx');
  let src = '';
  try { src = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8'); } catch (_) {}
  const sync = (/const SYNC_KEYS = \[([\s\S]*?)\n\];/.exec(src) || [])[1] || '';
  dit(/'vrm_num_vinted'/.test(sync.replace(/\/\/.*$/gm, '')), 'le réglage `vrm_num_vinted` est synchronisé (SYNC_KEYS)');
  const a = src.indexOf('const poserNumero = async'), b = src.indexOf('\n  };', a);
  const corps = a > 0 && b > a ? src.slice(a, b) : '';
  const poses = corps.match(/updatePair\(item, (?:prendre \? )?\{ numero: [^}]*manuelAt[^}]*\}/g) || [];
  dit(poses.length >= 4 && poses.every((x) => /changeAMain\(/.test(x)), `chaque N° posé à la main par poserNumero note l'ancien à barrer (${poses.length} écritures)`, poses.filter((x) => !/changeAMain\(/.test(x)).join(' | ').slice(0, 160));
  dit(/repriseDe: String\(autres\[0\]\), \.\.\.changeAMain\(/.test(corps), 'la reprise d\'un N° déjà servi note aussi l\'ancien');
  dit(/poserNumero\(it, brut, f\.numero, \{ carton: true \}\)/.test(src) && /if \(opts && opts\.carton\) return \{\};/.test(src), '« le carton dit N°58 » ne met rien à barrer (le carton porte déjà le bon)');
  dit(/const reattribueAEcrire = \(f\) => !!\(f && f\.reattribue && !f\.reattribue\.ecrit && cleNum\(f\.numero\) === cleNum\(f\.reattribue\.vers\)\);/.test(src), '« à écrire sur tes cartons » reste UNE règle (`reattribueAEcrire`, inchangée)');
  console.log(ko ? `\n❌ étiquette du N° : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ étiquette du N° : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
