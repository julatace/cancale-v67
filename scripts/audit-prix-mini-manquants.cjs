#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « PRIX MINI MANQUANTS » (11 nov., lot prix-mini)
//        node scripts/audit-prix-mini-manquants.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/prixMiniManquants.js et lit le branchement :
//   L  la liste : en ligne seulement, sans mini LU PAR LE MOTEUR (absent, ou à
//      virgule pour une extension qui ne la lit pas) ; annonces pas lues ⇒ null ;
//      le prix d'achat est celui passé par l'app (identité), jamais deviné ;
//   N  jamais un prix mini proposé : aucune ligne ne porte de montant à poser ;
//   B  le bénéfice à SON prix : mini − achat − frais saisis (centimes justes) ;
//      achat inconnu ⇒ null ; frais illisibles ⇒ null ;
//   G  le garde-fou : sous achat + frais ⇒ « sous », redemandé avant d'écrire ;
//      au prix ou plus ⇒ dit ; saisie illisible ⇒ rien d'écrit, enregistrement fermé ;
//   E  l'écriture : « 45,5 » ⇒ « 45.5 » (lisible par le moteur), seulement SES saisies ;
//   J  la carte de Ma journée : seulement allumée (true), lue, et s'il en manque ;
//   S  le branchement : l'écran monte la liste sous l'interrupteur ; Entrée ⇒ la
//      suivante ; UN « Enregistrer » ⇒ `poserSeuils` (le chemin `updatePair`
//      normalisé) ; la confirmation « sous ton coût » ; la carte de Ma journée
//      gardée par `offresAuto === true` et ouvrant Offres auto ; rien vers Vinted.
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'hors-ligne': ['src/prixMiniManquants.js', "    if (a.etat != null && a.etat !== 'en-ligne') continue;", ''],
  'virgule-lue-toujours': ['src/prixMiniManquants.js', 'if (seuilMoteur(f.min, virgule) != null) continue;', 'if (seuilMoteur(f.min, true) != null) continue;'],
  'pas-lues-vide': ['src/prixMiniManquants.js', '  if (!Array.isArray(annonces)) return null;', '  if (!Array.isArray(annonces)) return [];'],
  'achat-devine': ['src/prixMiniManquants.js', 'const achatBrut = a.verif ? a.verif.achat : a.achat;', 'const achatBrut = (a.verif ? a.verif.achat : a.achat) ?? (a.prix != null ? a.prix * 0.6 : null);'],
  'frais-oublies': ['src/prixMiniManquants.js', 'r.benefice = (cts(s.valeur) - cts(l.achat) - cts(l.frais)) / 100;', 'r.benefice = (cts(s.valeur) - cts(l.achat)) / 100;'],
  'garde-sans-frais': ['src/prixMiniManquants.js', 'r.sousCout = cts(s.valeur) < cts(l.achat) + cts(l.frais);', 'r.sousCout = cts(s.valeur) < cts(l.achat);'],
  'illisible-ecrit': ['src/prixMiniManquants.js', "    if (a.erreur) { erreurs.push(l.id); continue; }", ''],
  'ecrit-brut': ['src/prixMiniManquants.js', 'ecrire.push({ id: l.id, min: montantSeuil(String(a.valeur)) });', "ecrire.push({ id: l.id, min: String((saisies || {})[l.id]) });"],
  'carte-eteinte': ['src/prixMiniManquants.js', 'if (actif !== true || !Array.isArray(lignes) || !lignes.length) return null;', 'if (!Array.isArray(lignes) || !lignes.length) return null;'],
  'propose-mini': ['src/prixMiniManquants.js', "      refuse: seuilMoteur(f.refuse, virgule),\n", "      refuse: seuilMoteur(f.refuse, virgule), propose: prix != null ? Math.round(prix * 0.9) : null,\n"],
  'ecran-sans-confirmation': ['src/PrixMiniManquants.jsx', '      if (!ok) return;\n', ''],
  'ecran-entree': ['src/PrixMiniManquants.jsx', "if (e.key === 'Enter') { e.preventDefault(); aller(i); }", "if (e.key === 'Enter') { e.preventDefault(); }"],
  'ecran-absent': ['src/OffresAuto.jsx', '<PrixMiniManquants annonces={annonces}', '<PrixMiniManquants annonces={null}'],
  'journee-toujours': ['src/App.jsx', 'const lPM = offresAuto === true && Array.isArray(listings.items)', 'const lPM = Array.isArray(listings.items)'],
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
const lireApp = (dir) => {
  // App.jsx découpé : on lit le fichier entier tel quel (le bloc de Ma journée y vit).
  return fs.readFileSync(path.join(dir, 'App.jsx'), 'utf8');
};
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'prix-mini-manq-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const [f, de, vers] = MUTS[MUT];
  const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(de)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(p, s.replace(de, vers)); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300))); };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  let M = {};
  try { M = await import(require('url').pathToFileURL(path.join(SRC, 'prixMiniManquants.js')).href); } catch (e) { M = {}; }
  if (typeof M.lignesManquantes !== 'function') dit(false, '`lignesManquantes` existe (src/prixMiniManquants.js)');
  else {
    const ann = [
      { id: '1', uid: '111', etat: 'en-ligne', numero: '12', titre: 'Nike Air Max 1', prix: 60, photo: 'https://images.exemple.test/a.jpg', verif: { achat: 40 } },
      { id: '2', uid: '111', etat: 'en-ligne', numero: '13', titre: 'Adidas Samba', prix: 45.5, verif: { achat: null } },
      { id: '3', uid: '111', etat: 'en-ligne', numero: '14', titre: 'Déjà réglée', prix: 80, verif: { achat: 50 } },
      { id: '4', uid: '222', etat: 'en-ligne', numero: '15', titre: 'Mini à virgule', prix: 70, verif: { achat: 30 } },
      { id: '5', uid: '222', etat: 'vendue', numero: '16', titre: 'Pas en ligne', prix: 90, verif: { achat: 20 } },
      { id: '6', uid: '222', etat: 'en-ligne', numero: '17', titre: 'Frais illisibles', prix: 50, verif: { achat: 20 } },
      { id: '7', uid: '222', etat: 'en-ligne', numero: '18', titre: 'Refus seul', prix: 100, verif: { achat: 60 } },
    ];
    const numeros = { '1': { numero: '12', emballage: '1,5', fraisComplets: true }, '3': { numero: '14', min: '70' }, '4': { numero: '15', min: '45,5' }, '6': { numero: '17', autresFrais: 'beaucoup' }, '7': { numero: '18', refuse: '50' } };
    const L = M.lignesManquantes({ annonces: ann, numeros });
    const ids = (L || []).map((l) => l.id);
    const par = Object.fromEntries((L || []).map((l) => [l.id, l]));
    console.log('\n── L. La liste');
    dit(Array.isArray(L) && !ids.includes('3') && !ids.includes('5'), 'L1 une annonce déjà réglée, ou pas en ligne, n’y est pas', ids);
    dit(ids.includes('1') && ids.includes('2') && ids.includes('7'), 'L2 sans mini (ou « Refuser sous » seul) ⇒ dans la liste', ids);
    dit(ids.includes('4') && par['4'].illisible === true, 'L3 mini « 45,5 » ignoré par une extension d’avant 5.342 ⇒ manquant, dit « illisible »', par['4']);
    const L2 = M.lignesManquantes({ annonces: ann, numeros, virgule: true });
    dit(Array.isArray(L2) && !L2.some((l) => l.id === '4'), 'L4 extension 5.342 (virgule lue) ⇒ « 45,5 » compte, plus manquant');
    dit(M.lignesManquantes({ annonces: null, numeros }) === null && M.lignesManquantes({ annonces: undefined }) === null, 'L5 annonces pas lues ⇒ null (pas su), jamais « aucune »');
    dit(par['1'] && par['1'].achat === 40 && par['2'] && par['2'].achat === null, 'L6 le prix d’achat est celui de l’app (identité) ; inconnu ⇒ null, jamais deviné', [par['1'] && par['1'].achat, par['2'] && par['2'].achat]);
    dit(ids[0] === '7' && ids.indexOf('1') < ids.indexOf('2'), 'L7 le plus d’argent en jeu d’abord', ids);
    dit(par['1'] && par['1'].photo === 'https://images.exemple.test/a.jpg' && par['1'].numero === '12' && par['1'].prix === 60, 'L8 photo, N°, prix portés par la ligne');

    console.log('\n── N. Jamais un prix proposé');
    const champsArgent = (L || []).flatMap((l) => Object.keys(l).filter((k) => !['id', 'uid', 'numero', 'titre', 'photo', 'prix', 'achat', 'frais', 'illisible', 'refuse'].includes(k)));
    dit(!champsArgent.length, 'N1 une ligne ne porte que ce qui est LU (aucun mini proposé)', champsArgent);
    const vide = M.apercuLigne(par['1'], '');
    dit(vide.vide && vide.valeur == null && vide.benefice == null, 'N2 rien tapé ⇒ aucune valeur, aucun bénéfice', vide);
    dit(M.bilanSerie(L, {}).ecrire.length === 0, 'N3 rien tapé ⇒ rien à écrire');

    console.log('\n── B. Le bénéfice à SON prix');
    const a1 = M.apercuLigne(par['1'], '50');
    dit(a1.benefice === 8.5 && a1.cout === 41.5 && !a1.sousCout, 'B1 50 € − achat 40 € − emballage 1,50 € = 8,50 € ; coût 41,50 €', a1);
    dit(M.apercuLigne(par['1'], '45,5').benefice === 4, 'B2 « 45,5 » ⇒ 4 € (centimes justes)');
    const a2 = M.apercuLigne(par['2'], '40');
    dit(a2.valeur === 40 && a2.benefice === null && a2.raison === 'achat', 'B3 achat inconnu ⇒ bénéfice null (« — »), jamais le prix', a2);
    const a6 = M.apercuLigne(par['6'], '40');
    dit(a6.benefice === null && a6.raison === 'frais', 'B4 frais saisis illisibles ⇒ bénéfice null', a6);

    console.log('\n── G. Le garde-fou');
    const g = M.apercuLigne(par['1'], '41');
    dit(g.sousCout === true && g.benefice === -0.5, 'G1 41 € < achat 40 € + frais 1,50 € ⇒ « sous ton coût », −0,50 €', g);
    dit(M.apercuLigne(par['1'], '60').auPrix === true && M.apercuLigne(par['1'], '59').auPrix === false, 'G2 au prix ou plus ⇒ dit (aucune offre ne l’atteint)');
    for (const x of ['abc', '-5', '0', '12,345', '1e3']) { const e = M.apercuLigne(par['1'], x); if (!e.erreur) dit(false, `G3 « ${x} » illisible`, e); }
    dit(true, 'G3 « abc », « -5 », « 0 », « 12,345 », « 1e3 » ⇒ illisibles');
    const b = M.bilanSerie(L, { '1': '41', '2': '38', '7': 'x' });
    dit(b.erreurs.join() === '7' && b.sous.length === 1 && b.sous[0].id === '1' && b.sous[0].cout === 41.5, 'G4 le bilan nomme la saisie illisible et la ligne sous le coût', b);

    console.log('\n── E. L’écriture');
    const e = M.bilanSerie(L, { '1': '45,5 €', '2': '38' });
    const w = Object.fromEntries(e.ecrire.map((x) => [x.id, x.min]));
    dit(w['1'] === '45.5' && w['2'] === '38' && e.ecrire.length === 2, 'E1 « 45,5 € » ⇒ « 45.5 », « 38 » ⇒ « 38 » ; seulement ce qu’il a tapé', e.ecrire);
    const off = await import(require('url').pathToFileURL(path.join(SRC, 'offresSures.js')).href);
    dit(e.ecrire.every((x) => off.seuilMoteur(x.min, false) != null), 'E2 chaque mini écrit est lu par le moteur, même une extension d’avant 5.342');

    console.log('\n── J. Ma journée');
    dit(M.carteJournee({ actif: true, lignes: L }) && M.carteJournee({ actif: true, lignes: L }).n === L.length, 'J1 allumée et il en manque ⇒ une carte, le nombre');
    dit(M.carteJournee({ actif: false, lignes: L }) === null && M.carteJournee({ actif: undefined, lignes: L }) === null, 'J2 éteinte, ou pas su ⇒ aucune carte');
    dit(M.carteJournee({ actif: true, lignes: null }) === null && M.carteJournee({ actif: true, lignes: [] }) === null, 'J3 annonces pas lues, ou rien ne manque ⇒ aucune carte');
    const ph = M.carteJournee({ actif: true, lignes: [{ photo: 'javascript:x' }, { photo: 'https://a/b.jpg' }] });
    dit(ph && ph.photos.length === 1 && ph.photos[0] === 'https://a/b.jpg', 'J4 les photos de la carte : https ou data:image seulement');
  }

  console.log('\n── S. Le branchement');
  const ecr = sansCommentaires(fs.readFileSync(path.join(SRC, 'PrixMiniManquants.jsx'), 'utf8'));
  const oa = sansCommentaires(fs.readFileSync(path.join(SRC, 'OffresAuto.jsx'), 'utf8'));
  const app = sansCommentaires(lireApp(SRC));
  dit(/<PrixMiniManquants annonces=\{annonces\} numeros=\{numeros\} virgule=\{virguleLue === true\} poserSeuils=\{poserSeuils\}/.test(oa) && oa.indexOf('<PrixMiniManquants') < oa.indexOf('data-oa-apercu'), 'S1 Offres auto monte la liste juste sous l’interrupteur, avec SES annonces en ligne et le chemin des seuils');
  dit(/onKeyDown=\{\(e\) => \{ if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); aller\(i\); \} \}\}/.test(ecr) && /inputMode="decimal"/.test(ecr), 'S2 clavier décimal, Entrée ⇒ la suivante');
  dit(/if \(bilan\.sous\.length\) \{\s*const ok = await askConfirm\(/.test(ecr) && /if \(!ok\) return;/.test(ecr), 'S3 sous le coût ⇒ redemandé avant d’écrire');
  dit((ecr.match(/poserSeuils\(/g) || []).length === 1 && /poserSeuils && poserSeuils\(bilan\.ecrire\)/.test(ecr) && /disabled=\{!bilan\.ecrire\.length \|\| !!bilan\.erreurs\.length/.test(ecr), 'S4 UN « Enregistrer » : SES saisies lisibles, d’un coup ; fermé s’il reste un chiffre illisible');
  dit(/poserSeuils=\{\(liste\)=>\{[\s\S]{0,400}?updatePair\(it, patch\)/.test(app) && /poserSeuils=\{\(liste\)=>\{[\s\S]{0,300}?patch\.min=montantSeuil\(w\.min\)/.test(app), 'S5 l’app écrit par `updatePair`, normalisé (`montantSeuil`)');
  dit(!/vmrCmd|vmrExec|executerCommande|offer_requests|\/api\//.test(ecr), 'S6 rien ne part chez Vinted ni au serveur d’ici');
  const iJ = app.indexOf("id: 'prix-mini-manquants'"), blocJ = iJ > 0 ? app.slice(Math.max(0, iJ - 900), iJ + 700) : '';
  dit(/const lPM = offresAuto === true && Array\.isArray\(listings\.items\) && !listings\.error \?/.test(blocJ) && /carteJourneePrixMini\(\{ actif: offresAuto === true, lignes: lPM \}\)/.test(blocJ), 'S7 Ma journée : la carte seulement allumée, annonces lues, par la même règle');
  dit(/tab: 'messages'/.test(blocJ) && /demanderVue\('offresauto'\)/.test(blocJ), 'S8 « Saisir » ouvre Messages → Offres auto');
  dit(/value=\{saisies\[l\.id\] \|\| ''\}/.test(ecr) && /placeholder=\{tr\('prixMini\.placeholder'\)\}/.test(ecr) && !/setSaisies\(\{\s*\.\.\.[^}]*prix/.test(ecr), 'S9 le champ est vide tant qu’il ne tape rien (aucun prix proposé)');

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
