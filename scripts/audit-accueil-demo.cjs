// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LA DÉMO DE LA PAGE D'ACCUEIL SE TIENT »  —  node scripts/audit-accueil-demo.cjs [--prouve]
//
//  La page d'accueil et le film montrent une journée INVENTÉE (src/accueil-demo.js) :
//  une vente de la N°128 à 85,00 € fait passer « Colis à poster » de 2 à 3, et le
//  chiffre du mois de 1 159,50 € à 1 244,50 €. Les écrans LISENT cette table — aucun
//  nombre n'est tapé dans un composant. Si la table ne se tient pas, l'écran roule
//  vers un chiffre faux, et c'est ce que lit un inconnu sur la page qui doit le
//  convaincre que VRM compte juste.
//
//  Il juge la DONNÉE (les nombres de la table), jamais une formulation.
//  `--prouve` : chaque règle est réaffaiblie seule (la table est modifiée d'un
//  cran dans une copie) et doit passer au rouge — sinon la règle ne mord pas.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const { pathToFileURL } = require('url');

const RACINE = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => {
  if (bon) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); }
};
const c = (x) => Math.round(Number(x) * 100);   // centimes entiers : jamais de flottant comparé à l'œil
const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const dist = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 0);
const COMPTES_PERMIS = ['Perso', 'Boutique', 'Leboncoin', 'eBay'];
const chaines = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (o && typeof o === 'object') Object.values(o).forEach((v) => chaines(v, out)); return out; };

// Les règles : chacune rend [vrai/faux, détail].
const REGLES = [
  ['le total du mois d’avant + la vente = le total d’après', (D) => [c(D.mois.avant) + c(D.vente.prix) === c(D.mois.apres), `${D.mois.avant} + ${D.vente.prix} ≠ ${D.mois.apres}`]],
  ['Vinted d’avant + la vente = Vinted d’après', (D) => [c(D.mois.vintedAvant) + c(D.vente.prix) === c(D.mois.vinted), `${D.mois.vintedAvant} + ${D.vente.prix} ≠ ${D.mois.vinted}`]],
  ['Vinted + Leboncoin + eBay (avant) = le total d’avant', (D) => [c(D.mois.vintedAvant) + c(D.mois.leboncoin) + c(D.mois.ebay) === c(D.mois.avant), 'la somme des plateformes ne fait pas le total']],
  ['Vinted + Leboncoin + eBay (après) = le total d’après', (D) => [c(D.mois.vinted) + c(D.mois.leboncoin) + c(D.mois.ebay) === c(D.mois.apres), 'la somme des plateformes ne fait pas le total']],
  ['une vente de plus dans le mois (22 → 23)', (D) => [D.mois.ventesAvant + 1 === D.mois.ventesApres, `${D.mois.ventesAvant} → ${D.mois.ventesApres}`]],
  ['« Colis à poster » après la vente = les colis de l’écran Colis', (D) => [D.jour.colisApres === D.colis.length, `${D.jour.colisApres} ≠ ${D.colis.length}`]],
  ['« Colis à poster » avant la vente = un de moins', (D) => [D.jour.colisAvant === D.colis.length - 1, `${D.jour.colisAvant} ≠ ${D.colis.length - 1}`]],
  ['« dont N à poster aujourd’hui » = les colis pressés de l’écran Colis', (D) => [D.jour.urgents === D.colis.filter((x) => x.urgent).length, `${D.jour.urgents}`]],
  ['« Annonces à retirer » = les annonces de la N°128 ailleurs', (D) => [D.jour.aRetirerApres === D.vente.ailleurs.length, `${D.jour.aRetirerApres} ≠ ${D.vente.ailleurs.length}`]],
  ['« Reçu ce mois-ci » (le matin) est sous le chiffre de fin de mois', (D) => [c(D.jour.recu) < c(D.mois.avant), `${D.jour.recu} ≥ ${D.mois.avant}`]],
  ['la N°128 vendue est bien un des colis et un des cartons', (D) => [D.colis.some((x) => x.n === D.vente.n) && D.stock.includes(D.vente.n), `N°${D.vente.n}`]],
  ['les comptes sont des LIBELLÉS (Perso, Boutique…), jamais un pseudo', (D) => { const noms = [...D.comptes.map((x) => x.nom), D.jour.derniereAvant.compte, ...D.jour.messages.comptes, D.reste.vente.compte]; const hors = noms.filter((n) => !COMPTES_PERMIS.includes(n)); return [hors.length === 0, hors.join(', ')]; }],
  ['aucune chaîne qui ressemble à une adresse email (« @ »)', (D) => { const x = chaines(D).filter((s) => s.includes('@')); return [x.length === 0, x.join(', ')]; }],
  ['aucun montant à zéro', (D) => {
    const m = [D.vente.prix, ...D.vente.ailleurs.map((a) => a.prix), D.jour.recu, D.jour.derniereAvant.prix, D.mois.avant, D.mois.apres, D.mois.vintedAvant, D.mois.vinted, D.mois.leboncoin, D.mois.ebay, D.mois.aDater.total, D.reste.attente, D.reste.dispo, D.reste.vente.prix];
    const zeros = m.filter((x) => !(Number(x) > 0)); return [zeros.length === 0, `${zeros.length} montant(s) nul(s) ou absent(s)`];
  }],
];

(async () => {
  let mod;
  try { mod = await import(pathToFileURL(path.join(RACINE, 'src', 'accueil-demo.js')).href); }
  catch (e) { dit(false, 'src/accueil-demo.js se charge', String(e && e.message || e).slice(0, 160)); console.log(`\n❌ audit-accueil-demo : ${ko} rouge(s)`); process.exit(1); }
  const { DEMO, PLATEFORMES, euros } = mod;
  const prouve = process.argv.includes('--prouve');

  console.log('\n── LA TABLE DE LA DÉMO SE TIENT');
  REGLES.forEach(([nom, f]) => { let r; try { r = f(DEMO); } catch (e) { r = [false, 'la règle a levé : ' + e.message]; } dit(r[0], nom, r[1]); });

  console.log('\n── LES COULEURS ET LE FORMAT');
  const ebay = hex(PLATEFORMES && PLATEFORMES.ebay && PLATEFORMES.ebay.point);
  const dA = dist(ebay, hex('#3D7BFF')), dC = dist(ebay, hex('#2458E6'));
  dit(ebay && dA > 120 && dC > 120, 'le point eBay ne se confond pas avec l’accent bleu (distance RVB > 120)', `${Math.round(dA)} et ${Math.round(dC)}`);
  const f = typeof euros === 'function' ? euros(1244.5) : '';
  dit(/^1[   ]244,50 €$/.test(f), 'les montants s’écrivent à la française : « 1 244,50 € »', JSON.stringify(f));

  if (prouve) {
    // Chaque règle, réaffaiblie seule, doit tomber. On modifie la table d'UN cran.
    console.log('\n── PREUVE : chaque règle réaffaiblie seule passe au rouge');
    const copie = () => JSON.parse(JSON.stringify(DEMO));
    const MUTATIONS = [
      (D) => { D.mois.apres += 1; D.mois.vinted += 1; },
      (D) => { D.mois.vinted += 1; D.mois.apres += 1; },
      (D) => { D.mois.avant += 1; D.mois.apres += 1; },
      (D) => { D.mois.ebay += 1; D.mois.avant += 1; },
      (D) => { D.mois.ventesApres += 1; },
      (D) => { D.jour.colisApres = 4; },
      (D) => { D.jour.colisAvant = 3; },
      (D) => { D.jour.urgents = 2; },
      (D) => { D.jour.aRetirerApres = 3; },
      (D) => { D.jour.recu = 2000; },
      (D) => { D.stock = D.stock.filter((n) => n !== D.vente.n); },
      (D) => { D.comptes[0].nom = 'julatace3535'; },
      (D) => { D.reste.lieu = 'contact@exemple.fr'; },
      (D) => { D.reste.dispo = 0; },
    ];
    REGLES.forEach(([nom, regle], i) => {
      const D = copie(); MUTATIONS[i](D);
      let r; try { r = regle(D); } catch (_) { r = [false]; }
      dit(r[0] === false, `réaffaiblie, « ${nom} » tombe`);
    });
  }
  console.log(ko ? `\n❌ audit-accueil-demo : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-accueil-demo : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
