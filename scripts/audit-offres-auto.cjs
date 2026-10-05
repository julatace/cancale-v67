// L'ACCEPTATION AUTOMATIQUE DES OFFRES EST RETIRÉE — et ne doit pas revenir.
//
// Julien, 4 octobre : « je ne veux pas que ça accepte tout seul les offres »
// (coupée), puis 5 octobre : « enlève l'acceptation de l'offre » (retirée).
// Accepter une offre engage une VENTE FERME, et une acceptation faite par un
// programme ressemble à un robot (§3, le compte bloqué). Ce qui reste permis :
// accepter UNE offre précise depuis la messagerie de l'app, sur SON clic, avec
// confirmation — c'est la voie `executerPourApp` / `EXEC_PERMIS`, couverte par
// `audit-exec.cjs` (origine de l'app, compte connecté strict, plafond).
//
// Avant, cet audit EXÉCUTAIT le moteur pour prouver qu'il n'acceptait rien.
// Le moteur n'existe plus : on vérifie l'INVARIANT, sur le code SANS ses
// commentaires (un commentaire qui raconte l'histoire n'est pas du code — leçon
// des sondes et de « télécharg », treizième cri au loup) :
//   1. dans l'extension, la route `/offer_requests/{id}/accept` n'apparaît QUE
//      dans la liste blanche `EXEC_PERMIS` — aucun code ne la construit ;
//   2. aucun reste du moteur (fonctions, planchers, interrupteur local) ;
//   3. dans l'app : plus de champ « Min. accepté », plus de capacité « offres »,
//      plus aucune phrase qui promet une acceptation automatique ;
//   4. l'AUTRE SENS : l'acceptation manuelle existe toujours (liste blanche +
//      bouton de la messagerie), et `vinted_offres_auto` reste synchronisé (les
//      extensions 5.130 à 5.150 retomberaient sinon sur l'interrupteur local).
//
// `--src dossier` : lance l'audit sur une autre copie du dépôt (preuve §6.1).
const fs = require('fs'), path = require('path');
let parser;
try { parser = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser')); }
catch (_) { parser = require('/home/user/cancale-v67/node_modules/@babel/parser'); }

const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

// Le code sans ses commentaires, positions et retours à la ligne conservés.
function sansCommentaires(texte, jsx) {
  const ast = parser.parse(texte, { sourceType: jsx ? 'module' : 'script', errorRecovery: true, allowReturnOutsideFunction: true, plugins: jsx ? ['jsx'] : [] });
  const t = texte.split('');
  for (const c of ast.comments || []) for (let i = c.start; i < c.end; i++) if (t[i] !== '\n') t[i] = ' ';
  return t.join('');
}
const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');
const ligneDe = (txt, idx) => txt.slice(0, idx).split('\n').length;

let BG = '', APP = '';
essaie('lecture du code', () => {
  BG = sansCommentaires(lire('vinted-sync-extension/background.js'), false);
  APP = sansCommentaires(lire('src/App.jsx'), true);
});

// ── 1. La route d'acceptation n'existe que dans la liste blanche ────────────
essaie('route accept', () => {
  const debut = BG.indexOf('EXEC_PERMIS');
  const fin = debut >= 0 ? BG.indexOf('];', debut) : -1;
  const hors = [];
  const re = /accept/g; let m;
  while ((m = re.exec(BG))) {
    if (debut >= 0 && m.index > debut && m.index < fin) continue;           // la liste blanche
    const autour = BG.slice(Math.max(0, m.index - 60), m.index + 30);
    // `Accept:` / `'accept'` d'un en-tête HTTP ne sont pas une offre
    if (/offer|offre|\/accept\b|quoi\s*:\s*['"]accept/i.test(autour)) hors.push('l.' + ligneDe(BG, m.index) + ' « ' + autour.replace(/\s+/g, ' ').trim().slice(0, 70) + ' »');
  }
  dit(debut >= 0, "l'extension garde sa liste blanche des actions permises (EXEC_PERMIS)");
  dit(hors.length === 0, "aucun code de l'extension ne construit l'acceptation d'une offre hors de la liste blanche",
    hors.slice(0, 3).join(' · '));
});

// ── 2. Aucun reste du moteur ────────────────────────────────────────────────
essaie('restes du moteur', () => {
  const restes = ['autoAccepterOffres', 'offresAutoActif', 'offresEnAttente', 'saluerAcheteurApresOffre', 'repondreOffre',
    'OFFRE_SALUT', 'OFFRES_MAX_PAR_VISITE', 'panel_min_prices', 'vrmAutoOffres', 'offresAutoLocal']
    .filter((n) => new RegExp('\\b' + n + '\\b').test(BG));
  dit(restes.length === 0, "aucun reste du moteur d'acceptation dans l'extension", restes.join(', '));
  dit(!/\bfunction\s+planchers\b/.test(BG), "plus aucune lecture des prix planchers dans l'extension");
});

// ── 3. L'app ne promet plus rien ────────────────────────────────────────────
essaie('app', () => {
  dit(!/Min\. accepté/.test(APP), "l'app ne propose plus de champ « Min. accepté »");
  dit(!/onCommit=\{[^}]*minPrice/.test(APP), "aucun champ de l'app n'écrit un prix plancher (minPrice)");
  const cap = /const EXT_CAPACITES\s*=\s*\{([^}]*)\}/.exec(APP);
  dit(!!cap && !/\boffres\s*:|\boffresapp\s*:/.test(cap[1]), "l'app ne déclare plus de capacité « offres » à l'extension",
    cap ? '' : 'EXT_CAPACITES introuvable');
  dit(!/extSait\(\s*['"]offres(app)?['"]\s*\)/.test(APP), "plus aucune décision de l'app sur cette capacité");
  const promesses = [];
  const re = /accept\w*[^\n<>{}]{0,40}(automatiquement|tout(?:e)?\s+seule?)|acceptation\s+auto/gi; let m;
  while ((m = re.exec(APP))) promesses.push('l.' + ligneDe(APP, m.index) + ' « ' + m[0].slice(0, 60) + ' »');
  dit(promesses.length === 0, "aucune phrase de l'app ne promet une acceptation automatique", promesses.slice(0, 3).join(' · '));
});

// ── 4. L'autre sens : la voie manuelle reste, et l'ancien réglage reste éteint
essaie('autre sens', () => {
  const debut = BG.indexOf('EXEC_PERMIS'), fin = BG.indexOf('];', debut);
  const liste = debut >= 0 ? BG.slice(debut, fin) : '';
  dit(/offer_requests[^\n]*\(accept\|reject\)|offer_requests[^\n]*accept/.test(liste),
    "l'acceptation MANUELLE (son clic dans la messagerie) reste dans la liste blanche");
  dit(/offreEnAttenteDe/.test(APP) && /Accepter/.test(APP), "la messagerie de l'app propose toujours d'accepter une offre précise, sur son clic");
  const sync = /const SYNC_KEYS\s*=\s*\[([\s\S]*?)\];/.exec(APP);
  dit(!!sync && /'vinted_offres_auto'/.test(sync[1]),
    "`vinted_offres_auto` reste synchronisé (les extensions 5.130 à 5.150 retomberaient sinon sur l'interrupteur local)");
});

console.log(ko ? `\n❌ audit-offres-auto : ${ko} contrôle(s) rouge(s), ${ok} vert(s)` : `\n✅ audit-offres-auto : ${ok} contrôles — rien n'accepte une offre tout seul`);
process.exit(ko ? 1 : 0);
