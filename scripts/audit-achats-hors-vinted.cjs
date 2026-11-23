// ════════════════════════════════════════════════════════════════════════════
// AUDIT : ACHATS HORS VINTED — UN TICKET À PLUSIEURS ARTICLES ⇒ UN LOT PROPOSÉ
//         node scripts/audit-achats-hors-vinted.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// (23 nov., lot achats-hors-vinted) Julien (validé le 23 nov.) : ajouter des achats
// faits hors Vinted (magasin, Leboncoin, vide-grenier) — photo du ticket lue DANS
// le navigateur (§2.9), chaque ligne devient un achat avec coût, date, lieu ;
// relier aux paires reste SON toucher. Cet audit EXÉCUTE src/achatTicket.js sur
// des textes de tickets INVENTÉS :
//   H1 3 lignes dont la somme = le total lu ⇒ un lot de 3, titres et montants lus ;
//   H2 somme ≠ total ⇒ rien proposé (mieux vaut un blanc qu'un faux) ;
//   H3 le ticket écrit « 3 articles » et 2 lignes sont lues ⇒ rien ;
//   H4 une ligne de quantité (« 2 x … ») ⇒ rien (combien d'articles ? pas su) ;
//   H5 total, sous-total, TVA, CB, rendu, remise ne sont jamais des articles ; un
//      article qui CONTIENT « ht » (« Night ») en reste un ;
//   H6 un seul article ⇒ pas de lot ; au-delà du plafond ⇒ pas de lot ;
//   H7 le formulaire : mode « à la main », ce qu'il avait tapé GARDÉ, aucun N° posé ;
//   H8 une lecture ratée ⇒ aucun lot ; le prix qu'il a tapé n'est jamais remplacé ;
//   B  l'écran : un bouton « Diviser en N articles » (tr, 5 langues) qui ne fait que
//      remplir le formulaire (aucune écriture) ; le plafond = LOT_MAX de grosLot.js.
// `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const charger = async (texte) => {
  const tmp = path.join(R, 'src', `.audit-ahv-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte);
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};
const TICKET = ['VIDE GRENIER DE LA MAIRIE', 'Nike Air Max 90 Night 25,00', 'Adidas Samba OG 15,00 €', 'New Balance 550 12,50', 'Sous-total 52,50', 'Remise 0,00', 'TVA 20% 8,75',
  'TOTAL 52,50', 'CB 52,50', 'Rendu 0,00', 'Merci de votre visite'].join('\n');

async function verifier(SRC, B) {
  let ko = 0;
  const dit = (c, m) => { if (!c) { ko++; if (!PROUVE) console.log('  ❌ ' + m); } else if (process.env.BAVARD) console.log('  ✅ ' + m); };
  let M; try { M = await charger(SRC); } catch (e) { dit(false, 'src/achatTicket.js ne se charge pas : ' + e.message); return ko; }
  if (typeof M.lignesDuTicket !== 'function' || typeof M.lotDuTicket !== 'function') { dit(false, 'H0 lignesDuTicket / lotDuTicket existent'); return ko; }
  const L = M.lignesDuTicket(TICKET);
  dit(L.length === 3 && L.map((x) => x.centimes).join(',') === '2500,1500,1250', 'H5 trois lignes d’articles, ni total, ni TVA, ni CB, ni rendu, ni remise — ' + JSON.stringify(L));
  dit(L[0] && L[0].libelle === 'Nike Air Max 90 Night', 'H5b « Night » (contient « ht ») reste un article');
  const lot = M.lotDuTicket({ montant: 5250 }, L);
  dit(lot && lot.n === 3 && lot.total === 5250 && lot.articles[2].titre === 'New Balance 550' && lot.articles[2].centimes === 1250, 'H1 un lot de 3 : titres et montants lus — ' + JSON.stringify(lot));
  dit(M.lotDuTicket({ montant: 5300 }, L) === null, 'H2 somme ≠ total ⇒ rien proposé');
  dit(M.lotDuTicket({ montant: 5250, articles: 4 }, L) === null && !!M.lotDuTicket({ montant: 5250, articles: 3 }, L), 'H3 le nombre d’articles écrit doit être le même');
  dit(M.lotDuTicket({ montant: 5550 }, M.lignesDuTicket(TICKET + '\n2 x Chaussettes 3,00')) === null, 'H4 une ligne de quantité ⇒ rien');
  dit(M.lotDuTicket({ montant: 2500 }, L.slice(0, 1)) === null, 'H6 un seul article ⇒ pas de lot');
  const beaucoup = Array.from({ length: 61 }, (_, i) => ({ libelle: 'Paire ' + i, centimes: 100 }));
  dit(M.lotDuTicket({ montant: 6100 }, beaucoup) === null, 'H6b au-delà de 60 lignes ⇒ pas de lot');
  dit(M.lotDuTicket({ montant: null }, L) === null, 'H6c total pas lu ⇒ pas de lot');
  const avant = { n: '', frais: '', mode: 'egal', articles: [{ titre: 'Ma Nike', taille: '42', visee: '', main: '', photo: null, numero: '' }], ranger: true };
  const f = M.lotFormulaireDuTicket(avant, lot, (c) => (c / 100).toFixed(2).replace('.', ','));
  dit(f.mode === 'main' && f.n === '3' && f.articles.length === 3 && f.articles[0].titre === 'Ma Nike' && f.articles[0].taille === '42' && f.articles[0].main === '25,00' && f.articles[1].titre === 'Adidas Samba OG', 'H7 mode « à la main », ce qu’il avait tapé est GARDÉ — ' + JSON.stringify(f.articles.map((a) => [a.titre, a.main])));
  dit(f.articles.every((a) => !a.numero), 'H7b aucun N° posé par le ticket (relier reste son toucher)');
  const d0 = { title: '', price: '40,00', date: '2026-11-23', source: '', ticket: null };
  const d1 = M.ticketVersBrouillon(d0, { lu: { montant: 5250, date: null, lieu: null, articles: null }, texte: TICKET, aujourdhui: '2026-11-23', enMontant: (c) => String(c) });
  dit(d1.price === '40,00' && d1.ticket && d1.ticket.lot && d1.ticket.lot.n === 3, 'H8 le prix tapé reste ; la proposition est rangée sur le ticket');
  const d2 = M.ticketVersBrouillon(d0, { lu: { montant: 5250 }, raison: 'delai', texte: TICKET, aujourdhui: '2026-11-23' });
  dit(d2.ticket && d2.ticket.lot === null, 'H8b lecture ratée ⇒ aucun lot');
  // B
  const A = sansCommentaires(B.achats);
  const bouton = (A.match(/data-achat-ticket-lot=\{t\.lot\.n\}[\s\S]*?<\/Bouton>/) || [''])[0];
  dit(/tr\('ahv\.diviser', \{ n: t\.lot\.n \}\)/.test(bouton) && /lotFormulaireDuTicket\(d\.lot, t\.lot, texteMontantSaisie\)/.test(bouton), 'B1 « Diviser en N articles » remplit le formulaire de lot');
  dit(!/withOwner|save\(|fetch\(|creer\(/.test(bouton), 'B2 le bouton n’écrit rien (SON « Ajouter le lot » enregistre)');
  dit(/export const LOT_MAX = 60;/.test(B.groslot) && /export const LOT_MAX_TICKET = 60;/.test(SRC), 'B3 le plafond du ticket = LOT_MAX de grosLot.js');
  for (const l of ['fr', 'en', 'es', 'it', 'de']) dit(/"ahv\.diviser"/.test(lire(`src/i18n/langues/${l}/achatsHorsVinted.js`)) && /ecran_achats_hors_vinted/.test(lire(`src/i18n/langues/${l}.js`)), `B4 textes ${l}`);
  return ko;
}

(async () => {
  const SRC = lire('src/achatTicket.js');
  const B = { achats: lire('src/ecrans/Achats.jsx'), groslot: lire('src/grosLot.js') };
  const ko = await verifier(SRC, B);
  if (!PROUVE) { console.log(ko ? `❌ audit-achats-hors-vinted : ${ko} contrôle(s) rouge(s)` : '✅ audit-achats-hors-vinted : vert'); process.exit(ko ? 1 : 0); }
  if (ko) { console.log(`❌ --prouve : le code actuel n'est pas vert (${ko})`); process.exit(1); }
  const MUT = [
    ['somme non vérifiée', '  if (somme !== lu.montant) return null;\n', ''],
    ['nombre écrit ignoré', '  if (Number.isInteger(lu.articles) && lu.articles !== L.length) return null;\n', ''],
    ['quantité ignorée', '  if (L.some((x) => x && x.quantite)) return null;\n', ''],
    ['total lu comme article', '/total|sous[\\s-]?tot|', '/sous[\\s-]?tot|'],
    ['« ht » sans bornes', '\\bht\\b', 'ht'],
    ['saisie écrasée', "titre: String(x.titre || '').trim() ? x.titre : a.titre", 'titre: a.titre'],
    ['lecture ratée proposée', 'lot: raison ? null : lotDuTicket(', 'lot: lotDuTicket('],
  ];
  let rouges = 0;
  for (const [nom, a, b] of MUT) {
    if (!SRC.includes(a)) { console.log('❌ mutation impossible (motif absent) : ' + nom); process.exit(2); }
    const k = await verifier(SRC.replace(a, b), B);
    console.log((k ? '  ✅ rouge : ' : '  ❌ RESTE VERT : ') + nom); if (k) rouges++;
  }
  console.log(rouges === MUT.length ? `✅ --prouve : ${rouges}/${MUT.length} mutations rougissent` : `❌ --prouve : ${MUT.length - rouges} mutation(s) restent vertes`);
  process.exit(rouges === MUT.length ? 0 : 1);
})();
