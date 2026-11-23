// (22 nov., latence-totale) Les causes de rendus AU REPOS trouvées au banc latence-repos, tenues par des contrôles qui
// échouent sur le code d'avant (origin/main 63a045263) :
//   1. src/departVente.js — publier une Map de départs ÉGALE à la précédente (une autre instance de Comptabilite, un
//      recalcul) ne fait PAS monter la version des données (src/versionDonnees.js) ; un contenu changé, si ;
//   2. src/ecrans/Comptabilite.jsx — l'effet sans liste qui publie les retours en stock (`setNumsRemisCle`) ne repose
//      jamais la même valeur (le setter de la vague met CHAQUE appel en transition : un rendu complet par appel) ;
//   3. src/design/polices.js — la police Inter n'est plus préchargée au démarrage (le texte est en police du système).
//   node scripts/tests/latence-repos.test.mjs [--prouve]      (--prouve : rejoue les contrôles sur des mutations ⇒ rouge)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const prouve = process.argv.includes('--prouve');
let ok = 0, ko = 0;
const dit = (bon, quoi) => { if (bon) ok++; else ko++; console.log((bon ? '  ✅ ' : '  ❌ ') + quoi); };

// 1. La version ne monte que sur un contenu neuf.
{
  const { publierDepartsVinted, raisonDepartPubliee } = await import(path.join(RACINE, 'src/departVente.js'));
  const { versionMemoire } = await import(path.join(RACINE, 'src/versionDonnees.js'));
  const pub = prouve ? ((m) => { publierDepartsVinted(new Map()); publierDepartsVinted(m); }) : publierDepartsVinted;
  const a = new Map([['11', { raison: 'colis-fait' }], ['12', { raison: 'email' }]]);
  const b = new Map([['11', { raison: 'colis-fait' }], ['12', { raison: 'email' }]]);
  const c = new Map([['11', { raison: 'colis-fait' }], ['12', { raison: 'transporteur' }]]);
  pub(a); const v0 = versionMemoire();
  pub(b); const v1 = versionMemoire();
  dit(v1 === v0, `1a une Map ÉGALE (autre objet) ne fait pas monter la version (${v0} → ${v1})`);
  pub(a); pub(b); pub(a);
  dit(versionMemoire() === v0, `1b deux instances qui publient tour à tour la même chose : version inchangée (${v0} → ${versionMemoire()})`);
  pub(c); const v2 = versionMemoire();
  dit(v2 > v1, `1c un contenu CHANGÉ la fait monter (${v1} → ${v2})`);
  dit(raisonDepartPubliee('12') && raisonDepartPubliee('12').raison === 'transporteur', '1d la Map publiée est la plus récente');
  pub(null); dit(versionMemoire() > v2 && raisonDepartPubliee('11') === null, '1e retirée (null) : version montée, rien de servi');
}

// 2. L'effet des retours en stock : comparé à la dernière valeur posée avant d'appeler le setter.
{
  let src = fs.readFileSync(path.join(RACINE, 'src/ecrans/Comptabilite.jsx'), 'utf8');
  if (prouve) src = src.replace(/if \(numsRemisPoseRef\.current === v\) return;/, '');
  const i = src.indexOf("const avant = () => { const p = load('vinted_nums_physiques', null);");
  const bloc = i >= 0 ? src.slice(i, src.indexOf('\n  });', i) + 6) : '';
  const sansCom = bloc.replace(/\/\/[^\n]*/g, '');
  const garde = /if \(numsRemisPoseRef\.current === v\) return;[\s\S]*setNumsRemisCle\(v\)/.test(sansCom);
  dit(!!bloc && garde && !/setNumsRemisCle\(\(/.test(sansCom), "2 l'effet sans liste des retours en stock ne repose jamais la même valeur (garde par la dernière posée, plus d'appel par fonction)");
}

// 3. Plus de préchargement de police au démarrage.
{
  let src = fs.readFileSync(path.join(RACINE, 'src/design/polices.js'), 'utf8').replace(/\/\/[^\n]*/g, '');
  if (prouve) src += '\nprechargerPolices();\n';
  dit(!/^\s*prechargerPolices\(\)\s*;?\s*$/m.test(src), '3 polices.js ne précharge plus Inter au chargement du morceau');
}

console.log(`\n${ko ? '❌' : '✅'} latence-repos (tests) : ${ok} OK · ${ko} KO${prouve ? ' — mutation : un rouge est ATTENDU' : ''}`);
process.exit(prouve ? (ko ? 0 : 1) : (ko ? 1 : 0));
