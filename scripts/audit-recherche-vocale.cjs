// Audit : LA RECHERCHE PAR LA VOIX (3 novembre) — src/rechercheVocale.js.
// Ce que le navigateur a reconnu → la requête de la barre de recherche :
// un N° dit en chiffres ou en lettres ⇒ le N° ; « B 125 » ⇒ B125 ; sinon le
// texte tel quel (jamais deviné). Plus le branchement dans App.jsx (le micro
// de la barre passe par `requeteDeLaVoix`, n'apparaît que si l'API existe et
// disparaît si le micro est refusé).
// `--prouve` : chaque règle réaffaiblie doit faire passer l'audit au rouge.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'rechercheVocale.js');
const APP = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');

const CAS = [
  ['numéro 124', '124', true], ['Numéro 124.', '124', true], ['N 124', '124', true], ['n° 124', '124', true], ['N124', '124', true],
  ['le 124', '124', true], ['124', '124', true], ['1 24', '124', true],
  ['cent vingt-quatre', '124', true], ['numéro cent vingt quatre', '124', true], ['cent', '100', true], ['deux cents', '200', true],
  ['quatre-vingt-dix-sept', '97', true], ['soixante et onze', '71', true], ['soixante-dix', '70', true], ['quatre-vingts', '80', true],
  ['deux cent quatre-vingt-un', '281', true], ['mille deux', '1002', true], ['douze', '12', true], ['un', '1', true],
  ['B 125', 'B125', true], ['b125', 'B125', true], ['bé 125', 'B125', true], ['B cent vingt-cinq', 'B125', true], ['numéro B 125', 'B125', true],
  ['Nike Dunk noire', 'Nike Dunk noire', false], ['nike 42', 'nike 42', false], ['air max 90', 'air max 90', false],
  ['la samba', 'la samba', false], ['taille 42', 'taille 42', false], ['et', 'et', false], ['', '', false], ['  ', '', false],
  ['New Balance 550 !', 'New Balance 550', false],
  // (11 nov., parler à la loupe) une TAILLE dite en lettres : après « taille », ou un 16–50 qui finit la phrase.
  ['Nike rouge quarante-deux', 'Nike rouge 42', false], ['nike taille quarante deux', 'nike taille 42', false], ['pointure trente-neuf adidas', 'pointure 39 adidas', false],
  ['air max quatre-vingt-dix', 'air max quatre-vingt-dix', false], ['quarante-deux', '42', true], ['Jordan quatre noire', 'Jordan quatre noire', false], ['deux nike', 'deux nike', false], ['douze paires noires', 'douze paires noires', false],
];

const MUTATIONS = {
  quatre_vingt_naif: (s) => s.replace("if ((m === 'vingt' || m === 'vingts') && i > 0 && mots[i - 1] === 'quatre') { courant += 80 - 4; vu = true; continue; }", ''),
  cent_seul_zero: (s) => s.replace('courant = (courant || 1) * 100;', 'courant = courant * 100;'),
  mot_inconnu_ignore: (s) => s.replace("    return null;\n  }\n  return vu ? total + courant : null;", "    continue;\n  }\n  return vu ? total + courant : null;"),
  sans_lettre: (s) => s.replace("if (lireNombre(reste) != null) { lettre = l.toUpperCase(); t = reste; }", ''),
  sans_appel: (s) => s.replace("  do { avant = t; t = t.replace(APPEL, ''); } while (t !== avant);\n", ''),
  sans_taille: (s) => s.replace("if (n == null) return { requete: taillesEnChiffres(brut), numero: false };", "if (n == null) return { requete: brut, numero: false };"),
  taille_partout: (s) => s.replace("const finit = j === mots.length && i > 0 && n != null && n >= 16 && n <= 50;", "const finit = n != null;"),
  texte_devine: (s) => s.replace("if (n == null) return { requete: taillesEnChiffres(brut), numero: false };", "if (n == null) { const d = /\\d+/.exec(t); return d ? { requete: d[0], numero: true } : { requete: brut, numero: false }; }"),
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `rechercheVocale-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function audit(src, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
  let M; try { M = await charger(src); } catch (e) { dit(false, 'le module se charge', e.message); return ko || 1; }
  for (const [dite, att, num] of CAS) {
    const r = M.requeteDeLaVoix(dite);
    dit(r.requete === att && r.numero === num, `« ${dite} » ⇒ « ${att} »${num ? ' (un N°)' : ''}`, `${r.requete} · ${r.numero}`);
  }
  return ko;
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  if (process.argv.includes('--prouve')) {
    let rate = 0;
    for (const [nom, f] of Object.entries(MUTATIONS)) {
      const m = f(src);
      if (m === src) { console.log(`❌ mutation ${nom} : motif absent`); rate++; continue; }
      const ko = await audit(m, false);
      console.log(`${ko ? '✅' : '❌'} mutation ${nom} : ${ko ? ko + ' rouge(s)' : 'AUCUN rouge'}`);
      if (!ko) rate++;
    }
    console.log(rate ? `\n❌ ${rate} mutation(s) non détectée(s)` : `\n✅ toutes les mutations (${Object.keys(MUTATIONS).length}) sont rouges`);
    process.exit(rate ? 1 : 0);
  }
  let ko = await audit(src, true);
  // Branchement (commentaires retirés).
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');
  const dit = (c, m) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m); };
  const MOTEUR = fs.readFileSync(path.join(R, 'src', 'dicteeNavigateur.js'), 'utf8');
  // (11 nov., saisie rapide) « vendues en octobre » passe d'abord par `ventesDuMois` (Ventes sur ce mois).
  dit(/const dicterRecherche = \(t\) => \{ (?:\{ const vm = ventesDuMois\(t\);[^\n]*\n\s*)?const r = requeteDeLaVoix\(t\);[\s\S]{0,700}?setGsQ\(r\.requete\)/.test(code),'la barre de recherche pose la requête lue par `requeteDeLaVoix`');
  dit(/const micLoupe = <MicDictee nu canal="loupe"[^>]*onText=\{dicterRecherche\}/.test(code) && (code.match(/\{micLoupe\}/g) || []).length === 2, 'le micro est dans la barre, sur ordinateur ET au téléphone');
  dit(/if \(!DICTEE_OK \|\| refus\) return null;/.test(code) && /typeof \(window\.SpeechRecognition \|\| window\.webkitSpeechRecognition\) === 'function'/.test(code), 'sans l’API, ou micro refusé : pas de bouton');
  dit(/rec\.lang = 'fr-FR'/.test(MOTEUR), 'reconnaissance en fr-FR (le moteur commun)');
  dit(![code, MOTEUR].some((c) => /fetch\([^)]*(speech|whisper|transcri|audio)/i.test(c) || /MediaRecorder|getUserMedia/.test(c)), 'aucun son enregistré ni envoyé à un service (ni MediaRecorder, ni appel de transcription)');
  console.log(ko ? `\n❌ audit-recherche-vocale : ${ko} rouge(s)` : '\n✅ audit-recherche-vocale : tout vert');
  process.exit(ko ? 1 : 0);
})();
