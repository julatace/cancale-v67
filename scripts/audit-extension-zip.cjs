// ═══════════════════════════════════════════════════════════════════════════
// AUDIT DU ZIP DE L'EXTENSION   —   node scripts/audit-extension-zip.cjs
// ═══════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUI A COÛTÉ LE PLUS CHER DE TOUTE L'HISTOIRE DU PROJET.
// Pendant des semaines, l'app a dit à Julien « ton extension est en retard,
// mets-la à jour » — et le zip de cette version n'existait NULLE PART :
//   • `vinted-sync-extension/manifest.json` était en 5.52.0 ;
//   • le seul zip du dépôt datait du 30 août et portait la 4.13.0 ;
//   • l'app n'offrait AUCUN lien de téléchargement.
// Pire, la consigne affichée disait « clique sur ⟳ dans chrome://extensions » :
// la flèche ronde recharge le DOSSIER du disque, donc la même vieille version.
// Il ne pouvait pas mettre à jour, quoi qu'il fasse. Et tout ce que l'app lui
// promettait ensuite (les codes de retrait lus dans ses conversations) dépendait
// de cette mise à jour : la ligne `panel_colis_relais` était vide, mesurée à
// 0 colis.
//
// Ce que ce fichier protège :
//   1. un zip est livré, et l'app le propose ;
//   2. il porte la version du manifeste — donc `EXT_ATTENDUE` aussi ;
//   3. il se dézippe en UN SEUL dossier (règle de Julien) ;
//   4. il contient tous les fichiers de l'extension ;
//   5. aucun zip périmé ne traîne à côté.
//
// Lecture seule.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
const SRC = path.join(RACINE, 'vinted-sync-extension');
const ZIP = path.join(RACINE, 'public/VRM-extension.zip');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// ── Lecteur de zip minimal : on parcourt les en-têtes locaux. ───────────────
const lireZip = (buf) => {
  const out = {};
  let i = 0;
  while ((i = buf.indexOf('PK\x03\x04', i, 'latin1')) >= 0) {
    const meth = buf.readUInt16LE(i + 8);
    const csize = buf.readUInt32LE(i + 18), usize = buf.readUInt32LE(i + 22);
    const nlen = buf.readUInt16LE(i + 26), elen = buf.readUInt16LE(i + 28);
    const nom = buf.slice(i + 30, i + 30 + nlen).toString('utf8');
    const deb = i + 30 + nlen + elen;
    const brut = buf.slice(deb, deb + csize);
    let contenu = null;
    try { contenu = meth === 0 ? brut : zlib.inflateRawSync(brut); } catch (_) {}
    out[nom] = { contenu, usize };
    i = deb + csize;
  }
  return out;
};

dit(fs.existsSync(ZIP), 'un zip de l\'extension est livré avec l\'app',
  fs.existsSync(ZIP) ? '' : 'public/VRM-extension.zip est introuvable — rien à installer');
if (!fs.existsSync(ZIP)) { console.log(`\n${ko} contrôle(s) non conforme(s).`); process.exit(1); }

const entrees = lireZip(fs.readFileSync(ZIP));
const noms = Object.keys(entrees);

// 3) UN SEUL DOSSIER (règle de Julien, §2.6)
const racines = [...new Set(noms.map(n => n.split('/')[0]))];
dit(racines.length === 1 && noms.every(n => n.includes('/')),
  'il se dézippe en UN seul dossier', racines.join(', '));

// 4) TOUS LES FICHIERS
const attendus = fs.readdirSync(SRC).filter(f => fs.statSync(path.join(SRC, f)).isFile());
const manquants = attendus.filter(f => !noms.includes(`${racines[0]}/${f}`));
dit(manquants.length === 0, 'il contient tous les fichiers de l\'extension',
  manquants.length ? 'manque : ' + manquants.join(', ') : attendus.length + ' fichiers');

// 2) LA VERSION — le contrôle qui aurait évité des semaines de blocage.
const vSrc = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8')).version;
const mZip = entrees[`${racines[0]}/manifest.json`];
let vZip = null;
try { vZip = JSON.parse(mZip.contenu.toString('utf8')).version; } catch (_) {}
dit(vZip === vSrc, 'le zip livré porte la version du manifeste',
  `zip ${vZip || '?'} · source ${vSrc}`);
// 2b) LA VERSION ÉCRITE DANS LE CODE (5.165). Mesuré le 9 octobre : des
//     sessions qui disaient `ver = 5.164.0` envoyaient des requêtes que seul un
//     `background.js` d'avant la 5.134 sait former — on n'a pas pu savoir si
//     c'était une copie partielle. `CODE_VERSION` voyage avec `ver` dans
//     `panel_diag_capture` : il doit être égal au manifeste, dans la source ET
//     dans le zip, sinon la mesure mentirait elle-même.
{
  const cv = (t) => { const m = /const CODE_VERSION\s*=\s*'([^']+)'/.exec(t || ''); return m ? m[1] : null; };
  const cSrc = cv(fs.readFileSync(path.join(SRC, 'background.js'), 'utf8'));
  const bZip = entrees[`${racines[0]}/background.js`];
  const cZip = cv(bZip && bZip.contenu ? bZip.contenu.toString('utf8') : '');
  dit(cSrc === vSrc && cZip === vSrc, '`CODE_VERSION` (background.js) suit le manifeste, dans la source et dans le zip',
    `source ${cSrc || '?'} · zip ${cZip || '?'} · manifeste ${vSrc}`);
}
const mAtt = /EXT_ATTENDUE\s*=\s*'([^']+)'/.exec(APP);
dit(mAtt && mAtt[1] === vSrc, '`EXT_ATTENDUE` suit la même version',
  `app ${mAtt ? mAtt[1] : '?'} · source ${vSrc}`);

// 1) L'APP LE PROPOSE, ET LA CONSIGNE EST COMPLÈTE
dit(/VRM-extension\.zip/.test(APP), 'l\'app offre le téléchargement');
dit((APP.match(/VRM-extension\.zip/g) || []).length >= 2,
  'il est proposé là où le retard est annoncé ET dans Réglages');
// ⚠️ « ⟳ » seul recharge le dossier du disque : la même vieille version.
{
  const i = APP.indexOf('Ton extension VRM est en retard');
  const F = i < 0 ? '' : APP.slice(i, i + 2000);
  dit(/Dézippe|dézippe/.test(F), 'la consigne dit de REMPLACER le dossier, pas seulement de cliquer sur ⟳',
    '⟳ recharge le dossier du disque — donc la même version');
}

// 5) AUCUN ZIP PÉRIMÉ À CÔTÉ
const traine = fs.readdirSync(RACINE).filter(f => /\.zip$/i.test(f));
dit(traine.length === 0, 'aucun zip périmé ne traîne à la racine', traine.join(', '));

console.log(ko
  ? `\n${ko} contrôle(s) non conforme(s).`
  : '\nLe zip livré est celui du code, et il est à un clic.');
process.exit(ko ? 1 : 0);
