// ════════════════════════════════════════════════════════════════════════════
//  LES ANCIENS ÉCRANS (Catalogue, Ventes « sales », Factures) SUIVENT §7 (12 nov., finitions)
//  « UNE SEULE couleur d'accent, et elle est RARE. ambre pour un geste à faire,
//  rouge seulement pour deux paires sous un N°. » Ces trois écrans hérités coloraient
//  de l'INFORMATION : « 📋 Affichage complet » et « 🔍 Recherche active » en ambre,
//  le multiplicateur « ×1,8 » en ambre, la colonne « N° Article » en ambre, l'âge d'un
//  article (« 45j ») et le fond de sa ligne en ambre/rouge, le badge « Vendu » et un
//  bénéfice négatif en rouge, un bénéfice positif en bleu d'accent.
//  Règle jugée : dans le CORPS de ces trois composants (commentaires retirés), aucun
//  `C.warn` ; `C.danger` seulement pour un message d'erreur (`{err&&`) ou le bouton
//  « supprimer » d'une facture ; aucune teinte rouge écrite en dur (#ff4d6d).
//  `node scripts/audit-couleurs-anciens-ecrans.cjs`
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ecrans', 'Compta.jsx'), 'utf8');
let rouges = 0;
const dit = (ok, quoi, detail) => { if (!ok) rouges++; console.log(`${ok ? '✅' : '❌'} ${quoi}${ok ? '' : ' — ' + String(detail || '').slice(0, 400)}`); };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const corps = (nom) => {
  const i = src.indexOf(`\nfunction ${nom}(`);
  if (i < 0) return null;
  const j = src.indexOf('\nfunction ', i + 10);
  return sansCommentaires(src.slice(i, j < 0 ? undefined : j));
};
for (const nom of ['Catalog', 'Sales', 'Invoices']) {
  const c = corps(nom);
  dit(!!c, `${nom} : composant trouvé`);
  if (!c) continue;
  const lignes = c.split('\n');
  const ambre = lignes.filter((l) => /C\.warn/.test(l));
  dit(!ambre.length, `${nom} : aucune information en ambre (§7 : l'ambre est pour un geste à faire)`, ambre.map((l) => l.trim().slice(0, 140)).join(' | '));
  const rouge = lignes.filter((l) => /C\.danger|#ff4d6d/i.test(l) && !/\{err&&/.test(l) && !/deleteInvoice\(/.test(l));
  dit(!rouge.length, `${nom} : aucun rouge hors d'une erreur ou de « supprimer » (§7)`, rouge.map((l) => l.trim().slice(0, 140)).join(' | '));
}
console.log(`\n${rouges ? '❌' : '✅'} couleurs des anciens écrans : ${rouges} rouge(s)`);
process.exit(rouges ? 1 : 0);
