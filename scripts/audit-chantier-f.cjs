// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — COMPTA ET STATISTIQUES (5 nov., chantier F de la revue de cohérence)
//
//  Il EXÉCUTE (esbuild → CommonJS, puis require) les règles qui se jugent sans
//  rendu d'écran :
//   D. `delaisPaiement` (src/delaiPaiement.js) : la médiane entre la vente et le
//      versement, SEULEMENT sur les versements lus (Vinted, Vestiaire), le
//      nombre mesuré, une vente sans date comptée à part, un versement avant la
//      vente écarté ; Leboncoin et eBay « — » (aucune date de versement lue) ;
//   B. `bilanDuMois` / `meilleurCompte` (src/bilanMois.js) : « au moins 0 » ne se
//      dit jamais (« — »), un reçu pas su reste « — », pas de meilleur compte
//      sur une lecture partielle ni sur une égalité ;
//   A. `RepartitionAnneau` (revue 2.26) : rien à répartir ⇒ ne rend RIEN ;
//   R. dans App.jsx : le reçu de « Comparer » (`recuAvecADater`) dit « — »
//      quand des ventes sont à dater et qu'il vaut 0, « au moins » sinon ; le
//      montant à recopier sur l'URSSAF (`montantARecopier`) ; la prévision URSSAF
//      ne propose pas de choisir le statut (un seul endroit, revue 2.27) ; la
//      carte « Ton entreprise » ne choisit plus le régime ; pas de date en
//      surtitre au-dessus de « Compta » ;
//   C. styles-statut.css : le survol des cartes d'option seulement sous
//      `(hover: hover)` (revue 2.27).
//  `--mutation` : chaque mutation réaffaiblit une règle ; l'audit doit rougir.
//  `node scripts/audit-chantier-f.cjs [--mutation]`
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const NM = [path.join(R, 'node_modules'), path.join(R, '..', '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
const esbuild = require(path.join(NM, 'esbuild'));
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');

const MUTATIONS = {
  mediane_haute:   ['src/delaiPaiement.js', 'const brut = v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;', 'const brut = v[m];'],
  versement_lbc:   ['src/delaiPaiement.js', "export const SITES_VERSEMENT_LU = ['Vinted', 'Vestiaire'];", "export const SITES_VERSEMENT_LU = ['Vinted', 'Vestiaire', 'Leboncoin'];"],
  sans_date_zero:  ['src/delaiPaiement.js', 'if (!(verse > 0) || !(vendu > 0)) { s.nSans += 1; continue; }', 'if (!(verse > 0)) { s.nSans += 1; continue; }'],
  negatif_garde:   ['src/delaiPaiement.js', 'if (j < 0) { s.nIncoherentes += 1; continue; }', ''],
  au_moins_zero:   ['src/bilanMois.js', 'const venduOk = vendu && Number.isFinite(Number(vendu.eur)) && !(partielVendu && !(vendu.eur > 0));', 'const venduOk = vendu && Number.isFinite(Number(vendu.eur));'],
  meilleur_partiel:['src/bilanMois.js', 'meilleur: venduOk && !partielVendu ? meilleur : null,', 'meilleur,'],
  egalite:         ['src/bilanMois.js', '  if (tri.length > 1 && Math.round(tri[0].eur * 100) === Math.round(tri[1].eur * 100) && tri[0].n === tri[1].n) return null;\n', ''],
  anneau_vide:     ['src/RepartitionAnneau.jsx', " if(!valeurs.length||!(Number(total)>0))return null;\n", ''],
  recu_zero:       ['src/App.jsx', "  if (!(r.valeur > 0)) return { valeur: null, partiel: false, manque, raison: 'aDater', nAd };", ''],
  statut_deux:     ['src/App.jsx', "P.etat === 'aucune' || P.etat === 'statut') return null;", "P.etat === 'aucune') return null;"],
  // (11 nov.) l'en-tête s'appelle « Argent » depuis la fusion Statistiques + Compta (da3446a4) : même règle, pas de date en surtitre
  date_surtitre:   ['src/App.jsx', '<ScreenHead icon="euro" title={L.argent} phrase="compta" ', '<ScreenHead icon="euro" title={L.argent} phrase="compta" date="Novembre 2026" '],
  survol_colle:    ['src/styles-statut.css', '@media (hover: hover) and (pointer: fine) {\n  .vrm-statut-option:hover', '@media all {\n  .vrm-statut-option:hover'],
};

let ok = 0, ko = 0;
const journal = [];
const dit = (bon, quoi, det) => { if (bon) { if (!SILENCE) ok++; } else { ko++; journal.push(quoi); } if (!SILENCE) console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + det : ''}`); };
let SILENCE = false;

// Le texte d'un fichier, muté ou non.
const texte = (f, mutation) => { const t = lire(f); if (!mutation || mutation[0] !== f) return t; if (!t.includes(mutation[1])) throw new Error(`motif de mutation absent dans ${f}`); return t.replace(mutation[1], mutation[2]); };

async function charger(mutation) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-f-'));
  const src = (f) => JSON.stringify(path.join(R, 'src', f));
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
export * as D from ${src('delaiPaiement.js')};
export * as B from ${src('bilanMois.js')};
export { default as RepartitionAnneau } from ${src('RepartitionAnneau.jsx')};
export const rendre = (el) => renderToStaticMarkup(el);
export { React };
`);
  const plugins = mutation ? [{ name: 'mutant', setup(b) {
    const cible = path.join(R, mutation[0]);
    b.onLoad({ filter: /\.(jsx?)$/ }, (a) => (path.resolve(a.path) !== cible ? undefined : { contents: texte(mutation[0], mutation), loader: 'jsx' }));
  } }] : [];
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outfile: path.join(dir, 'sortie.cjs'), format: 'cjs', platform: 'node', jsx: 'automatic',
    loader: { '.js': 'jsx' }, nodePaths: [NM], logLevel: 'silent', plugins, define: { 'process.env.NODE_ENV': '"production"' } });
  const M = require(path.join(dir, 'sortie.cjs'));
  return M;
}
// Une fonction d'App.jsx, extraite par son nom et EXÉCUTÉE (elle ne dépend de rien).
const extraire = (app, debut, fin) => { const i = app.indexOf(debut); if (i < 0) return null; const j = app.indexOf(fin, i); return j < 0 ? null : app.slice(i, j); };

async function verifier(mutation) {
  const M = await charger(mutation);
  const { D, B, RepartitionAnneau, rendre, React } = M;
  const J = 86400000, t0 = Date.UTC(2026, 9, 1, 12);
  // ── D. délai de paiement ──
  const lignes = [
    { plateforme: 'Vinted', id: 'v1', ts: t0 + 3 * J, o: { date: new Date(t0).toISOString() } },
    { plateforme: 'Vinted', id: 'v2', ts: t0 + 2 * J, o: { date: new Date(t0).toISOString() } },
    { plateforme: 'Vinted', id: 'v3', ts: t0 + 5 * J, o: { date: '' } },                       // vente sans date lisible
    { plateforme: 'Vinted', id: 'v4', ts: t0 - 1 * J, o: { date: new Date(t0).toISOString() } }, // versé avant la vente
    { plateforme: 'Vestiaire', id: 'vestiaire:1', ts: t0 + 6 * J },
    { plateforme: 'Leboncoin', id: 'lbc:1', ts: t0 },
    { plateforme: 'eBay', id: 'ebay:1', ts: t0 },
  ];
  const vente = (l) => (l.plateforme === 'Vinted' ? (Date.parse((l.o && l.o.date) || '') || null) : l.plateforme === 'Vestiaire' ? t0 : null);
  const Rd = D.delaisPaiement({ lignes, dateVenteDe: vente });
  const site = (p) => Rd && Rd.sites.find((x) => x.plateforme === p);
  dit(site('Vinted') && site('Vinted').mediane === 2.5 && site('Vinted').n === 2, 'D Vinted : médiane de 2 et 3 jours = 2,5 j, sur 2 versements lus', JSON.stringify(site('Vinted')));
  dit(site('Vinted') && site('Vinted').nSans === 1 && site('Vinted').nIncoherentes === 1, 'D une vente sans date comptée à part, un versement avant la vente écarté', JSON.stringify(site('Vinted')));
  dit(site('Vestiaire') && site('Vestiaire').mediane === 6 && site('Vestiaire').n === 1, 'D Vestiaire : la date de versement lue donne le délai', JSON.stringify(site('Vestiaire')));
  dit(site('Leboncoin') && site('Leboncoin').mediane == null && site('Leboncoin').lu === false && site('eBay').mediane == null, 'D Leboncoin et eBay : « — » (aucune date de versement lue), jamais 0 j', JSON.stringify([site('Leboncoin'), site('eBay')]));
  dit(D.delaisPaiement({ lignes: null }) === null, 'D lecture ratée ⇒ null (« pas su »), jamais une liste vide');
  dit(D.mediane([1, 2, 3, 10]) === 2.5 && D.mediane([]) === null, 'D la médiane (paire ⇒ moyenne des deux du milieu ; rien ⇒ null)');
  dit(D.texteDelai(null) === '—' && D.texteDelai(0.4) === 'moins d’un jour' && D.texteDelai(2.5) === '2,5 jours', 'D le délai en mots');
  // ── B. bilan du mois ──
  const b1 = B.bilanDuMois({ ym: '2026-10', vendu: { n: 0, eur: 0, manque: ['eBay'] }, recu: { valeur: null, raison: 'absente', manque: [] }, depense: 0, benefice: { valeur: null, raison: 'achats' }, B: { n: 3, nCout: 1 } });
  const lg = (d, k) => d.lignes.find((x) => x.cle === k);
  dit(lg(b1, 'vendu').valeur === null && lg(b1, 'paires').valeur === null, 'B « au moins 0 » ne se dit jamais : vendu partiel nul ⇒ « — »', JSON.stringify(lg(b1, 'vendu')));
  dit(lg(b1, 'recu').valeur === null && lg(b1, 'depense').valeur === 0, 'B reçu pas su ⇒ « — » ; dépensé lu à 0 ⇒ 0 €');
  dit(lg(b1, 'benefice').note === 'prix d’achat connus 1/3', 'B la couverture du bénéfice est écrite', lg(b1, 'benefice').note);
  const L2 = [{ plateforme: 'Vinted', compte: 'a', eur: 50 }, { plateforme: 'Vinted', compte: 'b', eur: 50 }];
  dit(B.meilleurCompte(L2, (l) => l.compte) === null, 'B égalité ⇒ aucun meilleur compte');
  const mc = B.meilleurCompte([...L2, { plateforme: 'Vinted', compte: 'a', eur: 10 }], (l) => l.compte);
  dit(mc && mc.nom === 'a' && mc.n === 2 && mc.eur === 60, 'B le compte qui a vendu le plus', JSON.stringify(mc));
  const b2 = B.bilanDuMois({ ym: '2026-10', vendu: { n: 2, eur: 60, manque: ['Leboncoin'] }, meilleur: mc });
  dit(b2.meilleur === null && lg(b2, 'vendu').auMoins === true, 'B lecture partielle ⇒ « au moins », et aucun meilleur compte désigné', JSON.stringify(b2.meilleur));
  dit(B.texteBilan({ valeur: null, type: 'eur' }, String) === '—', 'B « — » pour pas su');
  // ── A. l'anneau vide ──
  dit(rendre(React.createElement(RepartitionAnneau, { elements: [], total: 0 })) === '' && rendre(React.createElement(RepartitionAnneau, { elements: [{ k: 'Nike', n: 0 }], total: 3 })) === '', 'A rien à répartir ⇒ l’anneau ne rend rien');
  dit(/<svg/.test(rendre(React.createElement(RepartitionAnneau, { elements: [{ k: 'Nike', n: 2 }], total: 3 }))), 'A avec des parts ⇒ l’anneau se dessine');
  // ── R. App.jsx ──
  const app = texte('src/App.jsx', mutation);
  const fRecu = extraire(app, 'const recuAvecADater = ', '\n};\n');
  const recuAvecADater = fRecu ? new Function(`${fRecu}\n}; return recuAvecADater;`)() : null;
  const lig = { aDater: { n: 1, ca: 70 } };
  const r0 = recuAvecADater && recuAvecADater({ valeur: 0, partiel: false, manque: [] }, lig);
  const r1 = recuAvecADater && recuAvecADater({ valeur: 68, partiel: false, manque: [] }, lig);
  dit(!!r0 && r0.valeur === null && /1 vente sans date de versement/.test(r0.manque.join(',')), 'R « Comparer » : reçu 0 avec des ventes à dater ⇒ « — » et la raison', JSON.stringify(r0));
  dit(!!r1 && r1.valeur === 68 && r1.partiel === true, 'R reçu positif avec des ventes à dater ⇒ « au moins »', JSON.stringify(r1));
  dit(!!recuAvecADater && recuAvecADater({ valeur: 0, partiel: false, manque: [] }, { aDater: { n: 0 } }).valeur === 0, 'R rien à dater ⇒ un 0 lu reste 0 €');
  const fMt = extraire(app, 'const montantARecopier = ', ';\n');
  const montantARecopier = fMt ? new Function(`${fMt}; return montantARecopier;`)() : null;
  dit(!!montantARecopier && montantARecopier(80) === '80' && montantARecopier(9.5) === '9,50' && montantARecopier(1234.56) === '1234,56' && montantARecopier(null) === '', 'R le montant à recopier : chiffres et virgule, sans espace ni « € »');
  const prev = extraire(app, 'function PrevisionUrssafCarte(', '\nfunction ComptaFusion(');
  dit(!!prev && /P\.etat === 'statut'\) return null;/.test(prev) && !/Choisir mon statut/.test(prev), 'R la prévision URSSAF ne propose pas de choisir le statut (un seul endroit)');
  const profil = extraire(app, 'function ProfilFiscalCarte(', '\n// ── FACTURATION ÉLECTRONIQUE');
  dit(!!profil && !/data-regime-choix/.test(profil) && !/save\('vinted_regime'/.test(profil), 'R « Ton entreprise » ne choisit plus le régime');
  const pro = extraire(app, 'function ComptaPro(', '\n/* ── Comptabilité (onglet dédié');
  dit(!!pro && /<ScreenHead icon="euro" title=\{L\.(compta|argent)\}/.test(pro) && !/<ScreenHead icon="euro"[^>]*\bdate=/.test(pro), 'R « Compta » sans date en surtitre');
  // ── C. le survol ──
  const css = texte('src/styles-statut.css', mutation);
  const horsMedia = css.replace(/@media \(hover: hover\)[^{]*\{[\s\S]*?\n\}/g, '');
  dit(!/\.vrm-statut-option:hover/.test(horsMedia) && /@media \(hover: hover\)/.test(css), 'C le survol des cartes d’option seulement sous (hover: hover)');
}

(async () => {
  try { await verifier(null); } catch (e) { dit(false, 'l’audit s’arrête', e.message); }
  const base = ko;
  if (process.argv.includes('--mutation')) {
    let rouges = 0;
    for (const [nom, mut] of Object.entries(MUTATIONS)) {
      const avant = ko; SILENCE = true;
      try { await verifier(mut); } catch (e) { ko++; }
      SILENCE = false;
      const r = ko > avant; if (r) rouges++;
      ko = avant;
      console.log(`${r ? '✅' : '❌'} mutation ${nom} : ${r ? 'rouge (la règle est gardée)' : 'RESTE VERTE — la règle n’est pas jugée'}`);
      if (!r) ko++;
    }
    console.log(`\n${rouges}/${Object.keys(MUTATIONS).length} mutations rouges`);
  }
  console.log(ko ? `\n❌ audit-chantier-f : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-chantier-f : vert (${ok} contrôles)`);
  process.exit(ko || base ? 1 : 0);
})();
