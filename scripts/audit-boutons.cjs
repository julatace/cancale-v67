// ═══════════════════════════════════════════════════════════════════════════
// AUDIT DE LA FORME DES BOUTONS   —   node scripts/audit-boutons.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « la forme des boutons ne me convient pas, je veux que ça fasse plus
// premium ». Mesuré AVANT de toucher quoi que ce soit, sur 561 boutons rendus :
// 22 hauteurs différentes, 22 paddings, 13 tailles de texte — dont 47 boutons à
// 13,3333 px, la valeur PAR DÉFAUT du navigateur : ils n'héritaient même pas de
// la police de l'app. C'est cette dispersion qui se lit « pas fini », pas la
// couleur (six passes de palette avaient déjà échoué là-dessus).
//
// Ce que ce fichier protège :
//   • la règle de base des boutons existe et pose police + hauteur plancher ;
//   • elle ne touche PAS à `display` — un `<button>` centre déjà son contenu, et
//     le passer en `inline-flex` a cassé deux choses en capture (le rail de
//     navigation s'est centré, le chiffre cliquable « Coût d'achat » a mis son
//     étiquette et son nombre sur une seule ligne) ;
//   • l'échelle de rayons reste cohérente (plus de 2/3/4 px éparpillés) ;
//   • les ombres restent à DEUX couches (contact + diffusion).
//
// ⚠️ Contrôle STATIQUE. La forme réelle se mesure au banc, en rendant les
// écrans et en comptant les hauteurs (scratchpad `btn.cjs`) — un audit ne voit
// pas un bouton écrasé.
//
// Lecture seule.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const APP  = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
const HTML = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// la règle de base
const i = HTML.indexOf('button, a.vrm-btn {');
const R = i < 0 ? '' : HTML.slice(i, HTML.indexOf('}', i));
dit(R.length > 20, 'la règle de base des boutons existe');
dit(/font-family:\s*inherit/.test(R), 'les boutons héritent de la police de l\'app',
  R ? '' : 'sans elle, 47 boutons restaient à la police du navigateur');
dit(/font-size:/.test(R) && /font-weight:/.test(R), 'ils partagent une taille et une graisse');
dit(/min-height:/.test(R), 'ils ont une hauteur plancher');
// ⚠️ celui-là a cassé deux écrans : il ne doit pas revenir.
dit(!/display:\s*inline-flex/.test(R), 'la règle ne force PAS `display: inline-flex`',
  /display:\s*inline-flex/.test(R) ? 'le rail de navigation se recentre et « Coût d\'achat » s\'aplatit' : '');
dit(/transition:/.test(R), 'ils répondent au clic (transition)');

// l'échelle de rayons : plus de 2/3/4 px éparpillés dans le fichier
const restes = (APP.match(/borderRadius:[2-4]\b/g) || []).length;
dit(restes === 0, 'plus aucun rayon de 2, 3 ou 4 px dans l\'app', restes ? restes + ' restant(s)' : '');

const rayons = {};
(APP.match(/borderRadius:(\d+)\b/g) || []).forEach(x => { const v = x.split(':')[1]; rayons[v] = (rayons[v] || 0) + 1; });
const distincts = Object.keys(rayons).filter(v => v !== '0' && v !== '999').length;
dit(distincts <= 5, 'l\'échelle de rayons reste courte',
  Object.entries(rayons).sort((a,b)=>b[1]-a[1]).map(([a,b])=>a+'px×'+b).join(' '));

// les ombres : deux couches, pas une
const deuxCouches = (APP.match(/shadow(?:Md|Lg)?:"[^"]*,[^"]*"/g) || []).length;
dit(deuxCouches >= 6, 'les ombres sont à deux couches (contact + diffusion)', deuxCouches + ' sur 6');

console.log(ko
  ? `\n${ko} contrôle(s) non conforme(s).`
  : '\nLes boutons partagent une seule forme, et rien ne recentre le reste.');
process.exit(ko ? 1 : 0);
