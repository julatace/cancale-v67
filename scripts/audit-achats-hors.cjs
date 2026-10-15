// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : ACHATS HORS PLATEFORME — coût, lots, rattachements (15 octobre)
//         (node scripts/audit-achats-hors.cjs [--src chemin/achatsHors.js])
// ═══════════════════════════════════════════════════════════════════════════
// Exécute les VRAIES règles de `src/achatsHors.js` (celles que l'écran Achats et
// la modale « Prix d'achat » appellent) et exige :
//   1. le coût = prix + frais, en centimes ; un montant illisible ⇒ `null`,
//      jamais 0 (on ne compte pas ce qu'on ne sait pas lire) ;
//   2. un lot se répartit en parts dont la SOMME vaut EXACTEMENT le prix
//      (100 € / 3 ⇒ 33,34 + 33,33 + 33,33) ;
//   3. AUCUN DOUBLON : un achat d'une paire ne se propose plus une fois
//      rattaché ; un lot de N, plus après N rattachements ; la cible qui le
//      porte déjà peut le revoir (rouvrir la modale ne le « consomme » pas deux
//      fois) ;
//   4. AUCUN RAPPROCHEMENT AUTOMATIQUE (§5) : 50 achats identiques et 50 fiches
//      identiques ⇒ zéro lien tant que personne n'a cliqué ; et le fichier des
//      règles ne compare aucun titre.
// `--src` lance l'audit sur une copie réaffaiblie (preuve par mutation).
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let ko = 0, n = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

(async () => {
  const i = process.argv.indexOf('--src');
  const src = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..', 'src', 'achatsHors.js');
  let R;
  try {
    // Une copie hors de `src/` doit pouvoir importer `beneficePaire.js` : on la
    // pose à côté de l'original le temps de l'import.
    let cible = src;
    if (path.dirname(src) !== path.join(__dirname, '..', 'src')) {
      cible = path.join(__dirname, '..', 'src', `.achatsHors-mutation-${process.pid}.js`);
      fs.copyFileSync(src, cible);
      process.on('exit', () => { try { fs.unlinkSync(cible); } catch (_) {} });
    }
    R = await import(pathToFileURL(cible).href);
  } catch (e) {
    dit(false, 'les règles des achats hors plateforme existent (src/achatsHors.js)', String(e && e.message).slice(0, 160));
    console.log(`\n❌ achats hors plateforme : ${ko} rouge(s) sur ${n}`);
    process.exit(1);
  }

  essaie('coût', () => {
    dit(R.coutHorsCentimes({ price: '25', frais: '3,50' }) === 2850, 'coût = prix + frais, en centimes (25 + 3,50 = 28,50 €)', String(R.coutHorsCentimes({ price: '25', frais: '3,50' })));
    dit(R.coutHorsCentimes({ price: '25' }) === 2500, 'sans frais : le prix seul');
    dit(R.coutHorsCentimes({ price: 'abc' }) === null, 'prix illisible ⇒ null (jamais 0)', String(R.coutHorsCentimes({ price: 'abc' })));
    dit(R.coutHorsCentimes({ price: '25', frais: 'x' }) === null, 'frais illisibles ⇒ null (on ne compte pas un total faux)');
  });

  essaie('lots', () => {
    const p = R.partsHors(10000, 3);
    dit(JSON.stringify(p) === '[3334,3333,3333]', 'un lot de 3 à 100 € ⇒ 33,34 · 33,33 · 33,33', JSON.stringify(p));
    dit(p.reduce((a, b) => a + b, 0) === 10000, 'la somme des parts vaut EXACTEMENT le prix du lot');
    dit(R.quantiteHors({}) === 1 && R.quantiteHors({ quantite: '3' }) === 3 && R.quantiteHors({ quantite: '0' }) === 1 && R.quantiteHors({ quantite: 'x' }) === 1, 'quantité : 1 par défaut, une valeur illisible ne crée pas de lot');
    const lot = { id: 'L', price: '100', quantite: 3 };
    const parts = R.partsDesLiens(lot, [{ type: 'paire', cle: 'b' }, { type: 'vente', cle: '9' }, { type: 'paire', cle: 'a' }]);
    dit(parts.length === 3 && parts.reduce((a, x) => a + x.cents, 0) === 10000, 'les parts écrites sur 3 cibles somment au prix du lot', JSON.stringify(parts));
    const parts2 = R.partsDesLiens(lot, [{ type: 'paire', cle: 'a' }, { type: 'paire', cle: 'b' }, { type: 'vente', cle: '9' }]);
    dit(JSON.stringify(parts) === JSON.stringify(parts2), 'et la part de chaque cible ne dépend pas de l’ordre dans lequel on les lit');
    const snap = R.instantaneHors(lot, 3334);
    dit(snap.hors === true && snap.reparti === true && snap.price === 33.34, 'l’instantané dit « hors Vinted » et « réparti » (aucun reçu Vinted fabriqué)', JSON.stringify(snap));
  });

  essaie('doublons', () => {
    const achat = { id: 'A', price: '40' };
    const lot = { id: 'L', price: '90', quantite: 2 };
    const numeros = { '9001': { numero: '1', buyFromId: R.cleHors('A'), buyPrice: '40.00' }, '9002': { numero: '2', buyFromId: R.cleHors('L') } };
    const saleOv = { 7001: { buyFromId: '7777' } };   // un achat VINTED : pas un lien hors plateforme
    const liens = R.liensHors(numeros, saleOv);
    dit(JSON.stringify(Object.keys(liens).sort()) === '["A","L"]', 'les liens se LISENT sur les fiches et les ventes (aucune liste tenue en double)', JSON.stringify(liens));
    const pourAutre = R.achatsHorsDisponibles([achat, lot], liens, { type: 'paire', cle: '9003' }).map((x) => x.id);
    dit(!pourAutre.includes('A'), 'un achat d’une paire déjà rattaché n’est PLUS proposé à une autre paire', JSON.stringify(pourAutre));
    dit(pourAutre.includes('L'), 'un lot de 2 rattaché une fois reste proposé une fois de plus');
    const pourLuiMeme = R.achatsHorsDisponibles([achat], liens, { type: 'paire', cle: '9001' }).map((x) => x.id);
    dit(pourLuiMeme.includes('A'), 'la paire qui le porte déjà le revoit (rouvrir la modale ne le compte pas deux fois)');
    const plein = R.liensHors({ ...numeros, '9003': { buyFromId: R.cleHors('L') } }, {});
    const apres = R.achatsHorsDisponibles([lot], plein, { type: 'vente', cle: '8001' }).map((x) => x.id);
    dit(apres.length === 0, 'un lot de 2 rattaché deux fois n’est plus proposé (jamais un 3e coût)', JSON.stringify(apres));
    dit(R.achatsHorsDisponibles([{ id: 'X', price: '' }], {}, { type: 'paire', cle: '1' }).length === 0, 'un achat sans prix lisible ne se rattache pas (il poserait un coût faux)');
  });

  essaie('ressemblance', () => {
    const achats = Array.from({ length: 50 }, (_, k) => ({ id: 'ob' + k, title: 'Nike Air Max 90 T42', price: '30' }));
    const fiches = Object.fromEntries(Array.from({ length: 50 }, (_, k) => [String(9000 + k), { numero: String(k + 1), title: 'Nike Air Max 90 T42' }]));
    const liens = R.liensHors(fiches, {});
    dit(Object.keys(liens).length === 0, '50 achats et 50 paires IDENTIQUES ⇒ aucun lien tant que personne n’a cliqué (§5)', JSON.stringify(liens).slice(0, 80));
    dit(R.achatsHorsDisponibles(achats, liens, { type: 'paire', cle: '9000' }).length === 50, 'et les 50 restent proposés, sans qu’aucun soit choisi à sa place');
    const code = fs.readFileSync(src, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');
    const m = /\.title\s*===|normTitle|extractBrand|extractModel|extractSize|scoreAchat/.exec(code);
    dit(!m, 'les règles ne comparent aucun titre, marque, modèle ni taille', m && m[0]);
  });

  console.log(ko ? `\n❌ achats hors plateforme : ${ko} rouge(s) sur ${n}` : `\n✅ achats hors plateforme : ${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
