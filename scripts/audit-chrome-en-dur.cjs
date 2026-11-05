// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « CHROME » EN DUR DANS UNE PHRASE   —   node scripts/audit-chrome-en-dur.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 5 nov. (sur Orion) : « elle affiche Chrome alors que je suis sur
// Orion ». Une phrase de l'app qui parle du navigateur d'ICI passe par
// `motsNavigateur()` (src/navigateurExtension.js) ; une phrase qui part du
// SERVEUR ou qui parle de l'ordinateur dit « le navigateur où est l'extension
// VRM ». Cet audit cherche, hors commentaires, les FORMES qui désignent un
// navigateur comme s'il était Chrome : « dans (ce) Chrome », « ce Chrome »,
// « profil Chrome », « Chrome est/était/n'est… », « en haut de Chrome »,
// « ouvre Chrome », « le Chrome de… », « ton Chrome », « son Chrome ».
// Restent permis : une liste de navigateurs à choisir (« Chrome, Edge, Brave
// ou Opera »), une précision explicite (« ⟳ sur Chrome », « chrome://extensions
// sur Chrome »), le Chrome Web Store, les repères d'agent utilisateur.
// ⚠️ src/Accueil.jsx (la page publique, AVANT toute installation) est hors de
//    cet audit : elle présente ce qu'il faut pour commencer — décision à part.
// Revue du 5 nov. : la branche v31-indicateur-pro en laissait 7 (Brouillons,
// Republier, Favoris, progression des favoris, notification serveur).
// Lecture seule.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src');
const HORS = new Set(['Accueil.jsx', 'navigateurExtension.js']);

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// Retire les commentaires sans toucher aux adresses (« https:// », « chrome:// »).
const sansCommentaires = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[\s;{}(),])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));

const FORMES = [
  /\bdans (?:ce |le |ton |son |un )?Chrome\b(?! Web Store|, Edge)/,
  /\bce Chrome\b/i,
  /\bprofil Chrome\b/,
  /\bChrome (?:est|était|n’|n'|ne |y |garde |la |le |les )/,
  /\ben haut de Chrome\b/,
  /\bouvre Chrome\b/i,
  /\b(?:le|du|au) Chrome\b/i,
  /\b(?:ton|son|mon) Chrome\b/i,
  /\bChrome fermé\b/,
];

const fichiers = [];
(function parcours(d) {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, n.name);
    if (n.isDirectory()) parcours(p);
    else if (/\.(jsx?|mjs)$/.test(n.name) && !HORS.has(n.name)) fichiers.push(p);
  }
})(SRC);
// Les phrases que le SERVEUR envoie (notifications) viennent aussi de src/ ; et
// celles écrites dans api/ directement.
(function parcours(d) {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, n.name);
    if (n.isDirectory()) parcours(p);
    else if (/\.js$/.test(n.name)) fichiers.push(p);
  }
})(path.join(RACINE, 'api'));

const trouves = [];
for (const f of fichiers) {
  const lignes = sansCommentaires(fs.readFileSync(f, 'utf8')).split('\n');
  lignes.forEach((l, i) => {
    if (/userAgent|User-Agent/.test(l)) return;              // repère d'agent, pas une phrase
    for (const re of FORMES) if (re.test(l)) { trouves.push(`${path.relative(RACINE, f)}:${i + 1} « ${(l.match(new RegExp('.{0,30}' + re.source.replace(/^\\b/, '') + '.{0,20}')) || [l.trim().slice(0, 80)])[0].trim()} »`); break; }
  });
}
dit(fichiers.length > 50, `${fichiers.length} fichiers lus (src/ et api/)`);
dit(trouves.length === 0, 'aucune phrase ne désigne le navigateur comme « Chrome » en dur', trouves.length ? `${trouves.length} :\n   ` + trouves.join('\n   ') : '');

// La règle existe et sait dire Orion / « ce navigateur ».
const nav = fs.readFileSync(path.join(SRC, 'navigateurExtension.js'), 'utf8');
dit(/export function motsNavigateur/.test(nav), '`motsNavigateur` est la seule source des mots du navigateur');
// Les phrases que le serveur envoie au téléphone ne dépendent pas du navigateur
// où le module a été chargé (un import côté serveur n'a pas de navigateur).
const auto = fs.readFileSync(path.join(SRC, 'favorisAuto.js'), 'utf8');
dit(!/motsNavigateur|navigateurExtension/.test(sansCommentaires(auto)), 'src/favorisAuto.js (DEMANDES_AUTO, notifications du serveur) ne nomme aucun navigateur');

console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) non conforme(s).' : '✅ tout est conforme.'}`);
process.exit(ko ? 1 : 0);
