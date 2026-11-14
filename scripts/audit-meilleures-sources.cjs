#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : TES MEILLEURES SOURCES (11 nov.) — où acheter ce qui se revend le mieux
//         node scripts/audit-meilleures-sources.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/meilleuresSources.js (et src/sourceAchats.js qu'il importe) sur des
// données INVENTÉES (le dépôt est public), et lit dans le code des écrans que :
//   M. une vente n'est rattachée à SON achat que par identité (n° de transaction
//      Vinted relié, achat en gros, N° UNIQUE d'un achat hors plateforme) —
//      50 achats identiques : seuls ceux reliés sont revendus ; une vente sans
//      achat relié n'entre dans aucune source (comptée à part, dite) ; un achat
//      annulé n'est pas un achat ; un prix illisible n'est pas un 0 (« au moins »,
//      « N sans prix d'achat ») ; un bénéfice partiel se dit « au plus » ; un achat
//      de N articles n'a jamais plus de N revendus ; le délai et l'attente datés ;
//      un fournisseur par SON nom ; classement par bénéfice / par vitesse, une
//      source sans la mesure jamais classée dessus, « source pas saisie » en dernier ;
//   E. Ventes/Achats publie avec la règle unique du bénéfice ; la carte LIT (aucun
//      second calcul) ; elle est montée dans Argent (Statistiques) ET dans Achats ;
//      chaque ligne ouvre la liste de ses achats ; aucun rouge.
// `--mutation=…` réaffaiblit une règle dans une copie de src/ : rouge exigé.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const F = 'meilleuresSources.js';
const MUTS = {
  'par-titre': ["    const a = id ? achats.get(id.genre + ':' + id.id) : null;", "    const a = id ? achats.get(id.genre + ':' + id.id) : [...achats.values()].find((x) => x.titre && v.entree && x.titre === v.entree.title);", F],
  'sans-plafond': ['.slice(0, a.articles);', ';', F],
  'prix-zero': ['if (a.investi == null) sansPrix++; else investi += a.investi;', 'investi += a.investi || 0;', F],
  'annule-compte': ["    if (typeof estAnnule === 'function' && estAnnule(o)) continue;\n", '', F],
  'au-plus-tu': ["return (s.partiel ? 'au plus ' : '') + euros(s.benefice, { signe: true });", 'return euros(s.benefice, { signe: true });', F],
  'non-saisie-classee': ["l.sort((a, b) => (a.cle === 'non-saisie') - (b.cle === 'non-saisie')\n    || ", 'l.sort((a, b) => ', F],
  'sans-mesure-classee': ['    || (v(a) == null) - (v(b) == null)\n', '', F],
  'ambigu-relie': ["if (k) m.set(k, m.has(k) ? 'ambigu' : b);", 'if (k && !m.has(k)) m.set(k, b);', 'sourceAchats.js'],
  'sans-achat-tu': ["  if (r.sansAchat) l.push(", '  if (false) l.push(', F],
  'ecran-second-calcul': ["import './styles-meilleures-sources.css';", "import './styles-meilleures-sources.css';\nimport { bilanSources } from './meilleuresSources.js';", 'MeilleuresSources.jsx'],
  'ecran-rouge': ['.vrm-ms-ligne[data-ms-tete] .vrm-ms-chiffre { color: var(--d-encre, #1D1D1F); }', '.vrm-ms-ligne[data-ms-tete] .vrm-ms-chiffre { color: #D70015; }', 'styles-meilleures-sources.css'],
  'achats-absente': ['<MeilleuresSources owner={AUTH.user?.id || \'\'} Retour={FermeAuRetour} ici="achats"/>', '', 'App.jsx'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'meilleures-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const f = path.join(d, 'src', MUTS[MUT][2]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lire = (f) => { try { return fs.readFileSync(path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

(async () => {
  let M;
  try { M = await import(url(F)); }
  catch (e) { dit(false, 'src/meilleuresSources.js existe et se charge', e.message); console.log(`\n${ok} verts, ${ko} rouges`); process.exit(1); }

  const J = 864e5, T0 = Date.parse('2026-09-01T12:00:00Z'), NOW = T0 + 100 * J;
  const jour = (j) => new Date(T0 + j * J).toISOString().slice(0, 10);
  const cleNum = (x) => String(x == null ? '' : x).toUpperCase().replace(/\s+/g, '').replace(/^0+(?=\d)/, '');
  // 50 achats Vinted IDENTIQUES (même titre, même prix, même jour).
  const vinted = Array.from({ length: 50 }, (_, i) => ({ transaction_id: 900000 + i, title: 'Nike Dunk Low Panda 42', price: { amount: '40.00', currency_code: 'EUR' }, date: new Date(T0).toISOString(), status: 'Commande finalisée' }));
  vinted.push({ transaction_id: 999999, title: 'Nike Dunk Low Panda 42', price: { amount: '40.00', currency_code: 'EUR' }, date: new Date(T0).toISOString(), status: 'Commande annulée' });
  vinted.push({ transaction_id: 888888, title: 'Lot 3 paires', price: { amount: '90.00', currency_code: 'EUR' }, date: new Date(T0).toISOString(), status: 'Commande finalisée' });
  const fiches = { a: { numero: '1', buyFromId: '900007' }, b: { numero: '2', buyFromId: '900031' }, l1: { numero: '10', buyFromId: '888888' }, l2: { numero: '11', buyFromId: '888888' }, l3: { numero: '12', buyFromId: '888888' } };
  const hors = [
    { id: 'h1', title: 'Air Max 90', price: '25', date: jour(0), source: 'Brocante', numero: '20' },
    { id: 'h2', title: 'Jordan 1', price: '', date: jour(10), source: 'brocante', numero: '21' },
    { id: 'h3', title: 'Samba', price: '30', date: jour(5), source: 'Ebay', numero: '22' },
    { id: 'h4', title: 'Gazelle', price: '15', date: jour(5), source: '', numero: '23' },
    { id: 'h5', title: 'X', price: '10', date: jour(2), source: 'Vide grenier', numero: '30' },
    { id: 'h6', title: 'Y', price: '12', date: jour(2), source: 'Vide grenier', numero: '30' },   // N° 30 porté par DEUX achats
    { id: 'h7', title: 'Z', price: '50', date: jour(1), source: 'Fournisseur', numero: '40' },
  ];
  const registre = { personnes: { p1: { nom: 'Karim (grossiste)' } }, achats: { g1: { fournisseur: 'p1', date: jour(3), paires: 10, total: 30000, frais: 2000 } }, hors: { h7: { fournisseur: 'p1' } } };
  const v = (id, j, entree, prix, benefice, partiel = false) => ({ id, ts: T0 + j * J, entree, prix, benefice, partiel });
  const ventes = [
    v('vinted:1', 20, { buyFromId: '900007', numero: '1', title: 'Nike Dunk Low Panda 42' }, 9000, 4000),
    v('vinted:2', 40, { buyFromId: '900031', numero: '2', title: 'Nike Dunk Low Panda 42' }, 8000, 3000, true),
    v('vinted:3', 15, { numero: '99', title: 'Nike Dunk Low Panda 42' }, 9000, null),                  // aucun achat relié
    v('vinted:4', 30, { buyFromId: '888888', numero: '10' }, 6000, 3000),
    v('vinted:5', 32, { buyFromId: '888888', numero: '11' }, 6000, 3000),
    v('vinted:5b', 33, { buyFromId: '888888', numero: 'x' }, 6000, 3000),
    v('vinted:5c', 34, { buyFromId: '888888', numero: 'y' }, 6000, 3000),                             // 4e vente d'un lot de 3
    v('lbc:1', 10, { numero: '20' }, 6000, 3500),
    v('lbc:2', 50, { numero: '21' }, 7000, null),                                                      // prix d'achat pas saisi
    v('ebay:1', 25, { numero: '30' }, 5000, 4000),                                                     // N° ambigu
    v('vinted:6', 13, { buyGros: { id: 'g1' }, numero: '50' }, 6000, 2800),
    v('vinted:7', 23, { buyGros: { id: 'g1' }, numero: '51' }, 6000, 2800),
    v('vinted:8', 9, { numero: '40' }, 9000, 4000),
    v('vinted:1', 20, { buyFromId: '900007' }, 9000, 4000),                                            // la même vente deux fois
  ];
  const r = M.bilanSources({ achatsVinted: vinted, estAnnule: (o) => /annul|rembours/i.test(o.status), montantVinted: (o) => Number(o.price.amount),
    hors, prixHors: (b) => { const p = parseFloat(String(b.price).replace(',', '.')); return isNaN(p) ? null : p; }, registre, fiches, saleOv: {}, ventes, cleNum, maintenant: NOW });
  const src = (c) => r.sources.find((s) => s.cle === c) || null;

  console.log('\n── M. Par source, par identité seulement');
  const vi = src('vinted');
  dit(vi && vi.achats === 51 && vi.articles === 53, 'M1 Vinted : 51 achats (l’annulé n’en est pas un), 53 articles (le lot relié à 3 fiches compte 3)', vi && `${vi.achats} / ${vi.articles}`);
  const revDunk = vi && vi.liste.filter((a) => a.titre === 'Nike Dunk Low Panda 42' && a.revendus).map((a) => a.id).sort().join(',');
  dit(revDunk === '900007,900031', 'M2 50 achats identiques : SEULS les deux reliés par leur n° de transaction sont revendus', revDunk);
  dit(r.sansAchat === 2 && !r.sources.some((s) => s.liste.some((a) => a.id === '900000' && a.revendus)), 'M3 une vente au même titre mais sans achat relié : dans aucune source, comptée à part (avec la vente au N° ambigu : 2)', `sansAchat=${r.sansAchat}`);
  dit(M.texteHorsSources(r).some((t) => /2 ventes sans achat relié/.test(t)), 'M4 … et c’est DIT sous la carte', JSON.stringify(M.texteHorsSources(r)));
  const lot = vi && vi.liste.find((a) => a.id === '888888');
  dit(lot && lot.revendus === 3 && lot.articles === 3, 'M5 un lot de 3 articles n’a jamais plus de 3 revendus (4 ventes reliées)', lot && `${lot.revendus}/${lot.articles}`);
  dit(vi && vi.investi === 50 * 4000 + 9000 && vi.sansPrix === 0, 'M6 investi Vinted : chaque achat une fois (le lot une fois, pas par article)', vi && String(vi.investi));
  dit(vi && vi.benefice === 4000 + 3000 + 9000 && vi.partiel && M.texteBenefice(vi).startsWith('au plus '), 'M7 bénéfice des revendus, « au plus » quand des frais ne sont pas confirmés', vi && M.texteBenefice(vi));
  const br = src('brocante');
  dit(br && br.achats === 2 && br.sansPrix === 1 && br.investi === 2500 && M.texteInvesti(br) === 'au moins 25 €', 'M8 un prix illisible n’est pas un 0 : « au moins 25 € », 1 sans prix', br && M.texteInvesti(br));
  dit(br && M.texteCouvertureSource(br) === '2 revendus sur 2 achetés · 1 sans prix d’achat · bénéfice connu pour 1', 'M9 la couverture dite : « 2 revendus sur 2 achetés · 1 sans prix d’achat · bénéfice connu pour 1 »', br && M.texteCouvertureSource(br));
  dit(br && br.marge === Math.round(3500 / 6000 * 1000) / 10 && br.beneficeMoyen === 3500, 'M10 la marge sur les seuls revendus au bénéfice connu (3 500 / 6 000)', br && String(br.marge));
  const vg = src('vide-grenier');
  dit(vg && vg.revendus === 0 && vg.achats === 2, 'M11 un N° porté par DEUX achats hors plateforme ne relie aucune vente', vg && String(vg.revendus));
  const eb = src('ebay');
  dit(eb && eb.libelle === 'eBay' && eb.achats === 1, 'M12 « Ebay » écrit à la main : la source eBay', eb && eb.libelle);
  const fo = src('fournisseur:p1');
  dit(fo && fo.libelle === 'Karim (grossiste)' && fo.genre === 'Fournisseur' && fo.articles === 11 && fo.investi === 32000 + 5000 && fo.revendus === 3, 'M13 un fournisseur par SON nom : achat en gros (10 paires, total + frais) + achat hors plateforme rattaché', fo && JSON.stringify([fo.libelle, fo.articles, fo.investi, fo.revendus]));
  dit(fo && fo.delaiMoyen === Math.round(((13 - 3) + (23 - 3) + (9 - 1)) / 3) && fo.nDelai === 3, 'M14 délai moyen de revente = date de vente − date d’achat', fo && String(fo.delaiMoyen));
  dit(fo && fo.pasRevendus === 8 && fo.plusVieux === 97 && fo.attenteMoyenne === 97, 'M15 pas encore revendus, et depuis combien de temps (le plus ancien)', fo && M.texteAttente(fo));
  const ns = src('non-saisie');
  dit(ns && ns.achats === 1 && r.sources[r.sources.length - 1].cle === 'non-saisie', 'M16 « source pas saisie » : comptée, classée en dernier', r.sources.map((s) => s.cle).join(','));
  const parB = M.classer(r.sources, 'benefice').map((s) => s.cle);
  dit(parB[0] === 'vinted' && parB.indexOf('vide-grenier') > parB.indexOf('brocante'), 'M17 par bénéfice : le bénéfice réalisé le plus haut d’abord, une source sans bénéfice après', parB.join(','));
  const parV = M.classer(r.sources, 'vitesse').map((s) => s.cle);
  dit(parV[0] === 'fournisseur:p1' && parV[1] === 'brocante' && parV.indexOf('vide-grenier') > parV.indexOf('vinted') && parV.indexOf('ebay') > parV.indexOf('vinted'), 'M18 par vitesse : le délai le plus court d’abord ; une source sans revente jamais classée sur la vitesse', parV.join(','));
  const vide = M.bilanSources({ achatsVinted: [], ventes: [{ id: 'x', ts: T0, entree: { numero: '1' }, prix: 100, benefice: 50 }], cleNum });
  dit(vide.sources.length === 0 && vide.sansAchat === 1, 'M19 sans aucun achat : aucune source inventée, la vente comptée à part');
  const pasLu = M.bilanSources({ achatsVinted: null, ventes: [], cleNum });
  dit(M.texteHorsSources(pasLu).some((t) => /pas lus/.test(t)), 'M20 achats Vinted pas lus : dit (jamais « 0 achat »)');

  console.log('\n── E. Les écrans');
  const app = sansCommentaires(lire('App.jsx'));
  const carte = sansCommentaires(lire('MeilleuresSources.jsx'));
  const stats = sansCommentaires(lire('ecrans/Stats.jsx'));
  const css = lire('styles-meilleures-sources.css');
  const eff = (app.match(/const r = bilanSources\(\{[\s\S]{0,600}?publierMeilleures\(r/) || [''])[0];
  const avant = app.slice(Math.max(0, app.indexOf('const r = bilanSources({') - 3000), app.indexOf('const r = bilanSources({'));
  dit(!!eff && /beneficeLigneVente\(/.test(avant) && /achatAnnule/.test(eff), 'E1 Ventes/Achats publie avec la règle unique du bénéfice (`beneficeLigneVente`) et la règle de « Dépensé »');
  dit(!/bilanSources|beneficePaire|beneficeLigneVente|achatDeVente/.test(carte), 'E2 la carte LIT la publication : aucun second calcul');
  dit(/<MeilleuresSources\b[^>]*ici="argent"/.test(stats) && /<MeilleuresSources\b[^>]*ici="achats"/.test(app), 'E3 la carte est montée dans Argent (Statistiques) ET dans Achats');
  dit(/onClick=\{\(\) => setOuverte\(s\.cle\)\}/.test(carte) && /<ListeAchats\b/.test(carte) && /Retour=\{Retour\}/.test(carte), 'E4 chaque ligne ouvre la liste de SES achats (feuille fermée au retour)');
  dit(!/#(D70015|FF3B30|ff3b30|d70015)|\bred\b/.test(css) && /\[data-ms-tete\][^{]*\{[^}]*--d-encre/.test(css) && !/vrm-ms-chiffre[^{]*\{[^}]*accent/.test(css), 'E5 les montants à l’encre (14 nov. : le bleu est pour les gestes, §7), la source en tête comprise ; aucun rouge');
  dit(/min-height:\s*44px/.test(css), 'E6 cibles au doigt 44 px');

  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
