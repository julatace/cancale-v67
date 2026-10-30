// Le titre eBay ne répète jamais la taille (16 oct., capture de Julien :
// « Autry reelwind blanc taille 36 taille 36 »). lbcTitre écrit lui-même
// « taille 36 » ; ebayTitre doit retirer cette forme avant d'écrire la sienne.
// Exécute les VRAIES fonctions extraites d'App.jsx.
const fs = require('fs'), path = require('path');
const A = require('./_source-app.cjs').sourceApp(path.join(__dirname, '..'));
const g = (a, b) => { const i = A.indexOf(a); const j = i >= 0 ? A.indexOf(b, i) : -1; return i >= 0 && j > i ? A.slice(i, j) : ''; };
let ko = 0; const dit = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) ko++; };
let ebayTitre = null;
try { ebayTitre = new Function(g('const LBC_TITRE_MAX', '// <annonce-lbc-regle>') + g('function ebayTitre(', '\n}\n') + '\n}\n;return ebayTitre;')(); }
catch (e) { dit(false, 'ebayTitre ne se charge pas : ' + e.message); }
const cas = [
  ['autry reelwind blanc taille 36', '36', 'Autry reelwind blanc taille 36'],
  ['Nike air max 1 T44', '44', 'Nike air max 1 taille 44'],
  ['Adidas samba', '42', 'Adidas samba taille 42'],
  ['Salomon xt-6 taille 40,5', '40,5', 'Salomon xt-6 taille 40,5'],
  ['Sweat nike', 'M', 'Sweat nike M'],
];
for (const [b, t, att] of cas) {
  let r = ''; try { r = ebayTitre ? ebayTitre(b, t) : ''; } catch (e) { r = 'ERREUR ' + e.message; }
  dit(r === att, `« ${b} » + ${t} → « ${r} »` + (r === att ? '' : ` (attendu « ${att} »)`));
  dit(!/taille\s+\S+.*taille\s/i.test(r), `la taille n'est écrite qu'une fois : « ${r} »`);
}
console.log(ko ? `\n${ko} ❌` : '\n✅ titre eBay : la taille une seule fois');
process.exit(ko ? 1 : 0);
