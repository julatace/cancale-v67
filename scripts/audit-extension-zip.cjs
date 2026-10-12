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
//   4. il contient tous les fichiers de l'extension, et ce sont CEUX de la source ;
//   5. aucun zip périmé ne traîne à côté ;
//   6. UNE VERSION PUBLIÉE NE CHANGE JAMAIS DE CONTENU (revue du 11 octobre) :
//      la 5.168.0 a été publiée par `main` (PR #472) pendant qu'un chantier
//      modifiait `background.js` SOUS LE MÊME NUMÉRO. Une 5.168 installée depuis
//      la production se serait dite « à jour » sans le correctif. Le numéro de la
//      source, s'il a déjà été servi par `main`, doit l'avoir été avec CE contenu.
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

// 4b) LE CONTENU — revue de la 5.165 (11 octobre). Le zip pouvait porter la
//     BONNE version et un `background.js` d'avant : une correction faite après
//     le bump (ici `dateLectureDressing`) partait sans être livrée, et le
//     contrôle de version restait vert. Chaque fichier du zip doit être,
//     octet pour octet, celui de la source.
{
  const differents = attendus.filter((f) => {
    const e = entrees[`${racines[0]}/${f}`];
    if (!e || !e.contenu) return false;              // déjà dit plus haut
    return !Buffer.from(e.contenu).equals(fs.readFileSync(path.join(SRC, f)));
  });
  dit(differents.length === 0, 'chaque fichier du zip est celui de la source (octet pour octet)',
    differents.length ? 'périmé dans le zip : ' + differents.join(', ') + ' — régénère le zip' : '');
}

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
// ⚠️ LES DEUX GESTES, DANS CET ORDRE (11 octobre) :
//   · « ⟳ » seul recharge le dossier du disque : la même vieille version ;
//   · remplacer le dossier SEUL ne suffit pas non plus — mesuré chez lui, 5
//     Chrome sur 6 exécutaient une 5.95–5.129 sous un manifeste « 5.164 » :
//     Chrome garde l'ancien code tant qu'on n'a pas cliqué ⟳, et seulement
//     dans le Chrome (le profil) où on le clique.
// L'ancien contrôle n'exigeait que « Dézippe » — vert sur une consigne qui ne
// dit jamais ⟳ : la moitié du geste. On juge la PHRASE affichée (la chaîne de
// `detail=`), pas une fenêtre de texte qui déborderait sur un commentaire.
{
  const chaineApres = (repere, champ) => {
    const i = APP.indexOf(repere);
    if (i < 0) return '';
    const j = APP.indexOf(champ, i);
    if (j < 0 || j - i > 4000) return '';
    const m = /^\s*\{?\s*"([^"]*)"|^\s*\{?\s*`([^`]*)`/.exec(APP.slice(j + champ.length));
    return m ? (m[1] || m[2] || '') : '';
  };
  const juge = (F, ou) => {
    dit(/Dézippe|dézippe/.test(F) && /remplace|à la place/i.test(F), `${ou} : la consigne dit de REMPLACER le dossier`,
      '⟳ seul recharge le dossier du disque — donc la même version');
    dit(/⟳/.test(F) && /chaque Chrome|CHAQUE Chrome/.test(F), `${ou} : PUIS ⟳ dans chaque Chrome où elle est installée`,
      'sans ⟳, Chrome garde l\'ancien code — et seulement dans le Chrome où on le clique');
    const iRemp = F.search(/remplace|à la place/i), iRech = F.indexOf('⟳');
    dit(iRemp >= 0 && iRech > iRemp, `${ou} : dans cet ordre (remplacer, PUIS ⟳)`, `remplacer@${iRemp} · ⟳@${iRech}`);
  };
  juge(chaineApres('Ton extension VRM est en retard', 'detail='), 'bandeau « en retard »');
  // Réglages : la phrase sous le bouton de téléchargement.
  const k = APP.indexOf('Le zip se dézippe en un seul dossier');
  const R = k < 0 ? '' : APP.slice(k, APP.indexOf('\n', k));
  juge(R, 'Réglages');
}

// 6) UNE VERSION PUBLIÉE NE CHANGE JAMAIS DE CONTENU
//    On lit l'historique de `main` (première lignée, celle qui se déploie) : le
//    contenu publié sous `vSrc` est celui du DERNIER commit de main dont le
//    manifeste porte `vSrc`. Chaque fichier de la source doit être, octet pour
//    octet, celui de ce commit — sinon c'est un autre contenu sous un numéro
//    déjà servi : monter la version (jamais un numéro réservé par un autre
//    chantier). Historique illisible ⇒ on le DIT, on ne conclut rien.
{
  const { execFileSync } = require('child_process');
  const crypto = require('crypto');
  const git = (...a) => execFileSync('git', a, { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 });
  const versionA = (rev) => { try { return JSON.parse(git('show', `${rev}:vinted-sync-extension/manifest.json`)).version || null; } catch (_) { return null; } };
  const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
  let ref = process.env.VRM_REF_MAIN || null;
  if (!ref) for (const r of ['origin/main', 'main']) { try { git('rev-parse', '--verify', '-q', `${r}^{commit}`); ref = r; break; } catch (_) {} }
  let publie = null;                                   // le commit de main qui a servi vSrc en dernier
  let lisible = !!ref;
  if (ref) {
    try {
      if (versionA(ref) === vSrc) publie = ref;
      else {
        const chg = git('log', '--first-parent', '--format=%H', ref, '--', 'vinted-sync-extension/manifest.json').split('\n').filter(Boolean);
        for (const c of chg) {
          const avant = versionA(`${c}^1`);
          if (avant === vSrc) { publie = `${c}^1`; break; }
          if (avant && cmp(avant, vSrc) < 0) break;     // plus ancien que vSrc : jamais servi
        }
      }
    } catch (_) { lisible = false; }
  }
  if (!lisible) {
    console.log('⚠️  historique de main illisible — impossible de dire si la version ' + vSrc + ' a déjà été servie (aucune conclusion)');
  } else if (!publie) {
    dit(true, `la version ${vSrc} n'a jamais été servie par ${ref}`, 'numéro neuf');
  } else {
    const blob = (buf) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
    const arbre = {};
    for (const l of git('ls-tree', '-r', publie, '--', 'vinted-sync-extension/').split('\n').filter(Boolean)) {
      const m = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(l);
      if (m) arbre[m[2].replace(/^vinted-sync-extension\//, '')] = m[1];
    }
    const differents = [];
    for (const f of attendus) if (arbre[f] !== blob(fs.readFileSync(path.join(SRC, f)))) differents.push(f);
    for (const f of Object.keys(arbre)) if (!f.includes('/') && !attendus.includes(f)) differents.push(f + ' (retiré)');
    dit(differents.length === 0, `la version ${vSrc}, déjà servie par ${ref}, n'a pas changé de contenu`,
      differents.length ? `${vSrc} publiée avec un AUTRE contenu (${differents.join(', ')}) — monte la version (un numéro jamais servi ni réservé)` : '');
  }
}

// 5) AUCUN ZIP PÉRIMÉ À CÔTÉ
const traine = fs.readdirSync(RACINE).filter(f => /\.zip$/i.test(f));
dit(traine.length === 0, 'aucun zip périmé ne traîne à la racine', traine.join(', '));

console.log(ko
  ? `\n${ko} contrôle(s) non conforme(s).`
  : '\nLe zip livré est celui du code, et il est à un clic.');
process.exit(ko ? 1 : 0);
