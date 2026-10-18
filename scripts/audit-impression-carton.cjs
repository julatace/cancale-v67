#!/usr/bin/env node
// AUDIT — un numéro pas encore vérifié sur son carton n'est pas tamponné sans
// question (18 octobre). Pendant la panne de synchronisation (11-18 octobre),
// 36 paires ont été renumérotées : leur N° peut désigner une AUTRE paire, et
// tamponné sur un bordereau c'est la mauvaise chaussure dans le colis.
// On EXÉCUTE la vraie fonction (`confirmerNumerosAVerifier`, extraite d'App.jsx)
// dans un `vm`, et on vérifie que les trois chemins d'impression l'appellent.
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const prend = (re, nom) => { const m = APP.match(re); if (!m) { dit(false, `${nom} trouvé dans App.jsx`); return ''; } return m[0]; };

const code = [
  prend(/const cleNum = \(v\) => \{[\s\S]*?\n\};/, 'cleNum'),
  prend(/const PANNE_NUMEROS = \{[^\n]*\};/, 'PANNE_NUMEROS'),
  prend(/const ficheAVerifier = \(f\) => \{[\s\S]*?\n\};/, 'ficheAVerifier'),
  prend(/const NUM_A_VERIFIER_ANNULE = [^\n]*;/, 'NUM_A_VERIFIER_ANNULE'),
  prend(/const confirmerNumerosAVerifier = async \(numeros\) => \{[\s\S]*?\n\};/, 'confirmerNumerosAVerifier'),
].join('\n') + '\n;({ confirmerNumerosAVerifier })';

(async () => {
  let fiches = {}, demandes = [], reponse = false;
  const ctx = { load: () => fiches, askConfirm: async (o) => { demandes.push(o); return reponse; }, String, Number, Object, Set, Array };
  let f;
  try { f = vm.runInNewContext(code, ctx).confirmerNumerosAVerifier; } catch (e) { dit(false, 'la fonction se charge', e.message); }
  if (f) {
    const PANNE = '2026-10-18T08:26:45.251Z';
    fiches = { a: { numero: '82', auto: true, numberedAt: PANNE, title: 'Vapor' }, b: { numero: '7', auto: true, numberedAt: '2026-10-10T08:00:00Z', title: 'Ancienne' } };
    demandes = []; reponse = false;
    dit((await f(['82'])) === false && demandes.length === 1, 'N°82 renuméroté pendant la panne : on DEMANDE, et « Annuler » n\'imprime pas', `${demandes.length} question(s)`);
    dit(/82/.test(demandes[0] && demandes[0].title || '') && /mauvaise chaussure/.test(demandes[0] && demandes[0].desc || ''), 'la question nomme le numéro et le risque', JSON.stringify(demandes[0] && demandes[0].title));
    demandes = []; reponse = true;
    dit((await f(['82'])) === true, '« J\'ai vérifié, imprimer » laisse imprimer');
    demandes = [];
    dit((await f(['7'])) === true && demandes.length === 0, 'un numéro d\'avant la panne : aucune question');
    fiches.a.cartonVerifie = '2026-10-18T10:00:00Z'; demandes = [];
    dit((await f(['82'])) === true && demandes.length === 0, 'un numéro VÉRIFIÉ sur son carton : aucune question');
    demandes = [];
    dit((await f([])) === true && demandes.length === 0, 'sans numéro : aucune question');
  }
  // Les trois chemins d'impression l'appellent, juste après la garde de version.
  const appels = (APP.match(/await confirmerNumerosAVerifier\(/g) || []).length;
  dit(appels >= 3, 'les trois chemins d\'impression (un bordereau, un lot, bordereau + facture) posent la question', `${appels} appel(s)`);
  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ un numéro pas vérifié n\'est jamais tamponné sans question');
  process.exit(ko ? 1 : 0);
})();
