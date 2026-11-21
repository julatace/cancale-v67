#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — FOURNISSEURS : LES PERSONNES À QUI IL ACHÈTE EN GROS (5 nov.)
//        node scripts/audit-fournisseurs.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Julien, 5 nov. : « le fournisseur dans achat, c'est pas du tout ça c'est une
// personne à qui tu achètes en gros pas des vendeurs particuliers sur vinted ».
// EXÉCUTE les règles (src/fournisseurs.js, src/achatsSourcing.js) — aucun
// libellé ne sert à juger, sauf les mots de la règle elle-même (« au moins »,
// « au plus », la couverture), produits par ses fonctions :
//   V. aucun vendeur Vinted ne devient fournisseur : ni par l'ancienne
//      dérivation (`achatsSourcing`), ni par le bilan (même nourri d'achats
//      Vinted aux pseudos lus) ; la liste = les personnes QU'IL a créées ;
//   R. répartition au centime : N parts égales = le total (100 € / 3, 300 € / 10,
//      0,10 € / 3) ; frais seulement sur SON choix (sans choix : rien proposé) ;
//      paire par paire : jamais au-dessus du total, juste quand tout est relié ;
//   M. un prix saisi à la main n'est JAMAIS écrasé sans SA réponse (« Remplacer ») ;
//      rien sans `confirme` ; délier rend le prix d'avant, garde le prix saisi ;
//   I. identité : une vente n'est attribuée que par le lien posé sur SA fiche
//      (`buyGros`) ou le N° d'un achat hors plateforme RATTACHÉ par lui, s'il
//      n'en désigne qu'un — 50 paires au même titre ne s'attribuent pas ;
//   C. chiffres : « au moins » sur Dépensé quand un prix manque, « — » quand
//      rien n'est su, couverture « sur N vendues, prix d'achat connu pour M »,
//      JAMAIS « au moins » sur un bénéfice (src/beneficeNoms.js), « au plus »
//      gardé quand des frais ne sont pas confirmés.
// --prouve : chaque mutation DOIT rougir.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'vendeur-devient-fournisseur': ["  const parAchat = {};\n  for (const [id, a] of Object.entries(reg.achats)) {",
    "  for (const x of (arguments[0].achats || [])) { const n = String((x && x.vendeur) || '').trim(); if (n && !lignes.has('v:' + n)) lignes.set('v:' + n, { id: 'v:' + n, nom: n, achatsGros: 0, achatsHors: 0, paires: 1, pairesPrixConnu: 1, depense: 0, sansPrix: 0, relies: 0, revendues: 0, achatConnu: 0, benefice: 0, beneficesConnus: 0, partiel: false }); }\n  const parAchat = {};\n  for (const [id, a] of Object.entries(reg.achats)) {"],
  'registre-sans-nom': ["    if (!p || typeof p !== 'object' || !str(p.nom)) continue;", "    if (!p || typeof p !== 'object') continue;"],
  'parts-arrondies': ["  const eg = partsEgales(base, achat.paires);\n  return (relies || []).map((_, i) => (i < eg.length ? eg[i] : null));",
    "  return (relies || []).map((_, i) => (i < achat.paires ? Math.round(base / achat.paires) : null));"],
  'frais-devines': ["  if (achat.repartition && achat.repartition.base === 'prix') return achat.total;\n  return null;", "  return achat.total + achat.frais;"],
  'main-depasse': ["(toutes ? reste === 0 : reste >= 0)", "(toutes ? reste === 0 : true)"],
  'main-pas-juste': ["(toutes ? reste === 0 : reste >= 0)", "(reste >= 0)"],
  'ecrase-prix-main': ["    if (o.etat === 'main') {\n", "    if (false) {\n"],
  'remplace-sans-demander': ["if (oui.has(x.cle)) ecrire(x.cle, x.part, x.prix); else gardes.push(x);", "ecrire(x.cle, x.part, x.prix);"],
  'garde-sans-prix': ["      else if (achat && achat.gardes && o.centimes != null && achat.gardes[r.cle] === o.centimes) gardes.push(r.cle);", "      else if (achat && achat.gardes && r.cle in achat.gardes) gardes.push(r.cle);"],
  'garde-oubliee': ["      else if (achat && achat.gardes && o.centimes != null && achat.gardes[r.cle] === o.centimes) gardes.push(r.cle);", ""],
  'sans-clic': ["  if (confirme !== true || !achat || !achat.id) return null;", "  if (!achat || !achat.id) return null;"],
  'prix-par-numero-ignore': ["  const parNum = !surFiche && e.numero != null && typeof prixParNum === 'function' ? str(prixParNum(e.numero)) : '';", "  const parNum = '';"],
  'delier-efface-main': ["  if (o.etat === 'lot') patch.buyPrice = g.avant != null ? str(g.avant) : '';", "  patch.buyPrice = '';"],
  'delier-perd-avant': ["  if (o.etat === 'lot') patch.buyPrice = g.avant != null ? str(g.avant) : '';", "  if (o.etat === 'lot') patch.buyPrice = '';"],
  'lien-sur-achat-vinted': ["  if (str(e.buyFromId) || lienGros(e)) return null;", "  if (lienGros(e)) return null;"],
  'trop-de-paires': ["  if (nRelies >= achat.paires) return null;\n", ''],
  'vente-par-titre': ["    if (g) { const a = reg.achats[g.id]; l = a ? lignes.get(a.fournisseur) : null; }",
    "    if (!g && str(e.title)) { for (const f of Object.values(objet(fiches))) { const gf = lienGros(f); if (gf && str(f.title) === str(e.title) && reg.achats[gf.id]) { l = lignes.get(reg.achats[gf.id].fournisseur); break; } } }\n    if (g) { const a = reg.achats[g.id]; l = a ? lignes.get(a.fournisseur) : null; }"],
  'hors-rattache-seul': ["    const h = b && reg.hors[b.id]; if (!h) continue;", "    const h = b && (reg.hors[b.id] || (String(b.source) === 'Fournisseur' && Object.keys(reg.personnes)[0] ? { fournisseur: Object.keys(reg.personnes)[0] } : null)); if (!h) continue;"],
  'hors-ambigu': ["      const h = b && b !== 'ambigu' ? reg.hors[b.id] : null;", "      const h = b && b !== 'ambigu' ? reg.hors[b.id] : (b === 'ambigu' ? Object.values(reg.hors)[0] : null);"],
  'au-moins-benefice': ["  return l.partiel ? 'au plus ' + s : s;", "  return l.partiel ? 'au plus ' + s : (l.beneficesConnus < l.revendues ? 'au moins ' + s : s);"],
  'au-plus-perdu': ["  return l.partiel ? 'au plus ' + s : s;", "  return s;"],
  'depense-sans-au-moins': ["  return (l.sansPrix ? 'au moins ' : '') + eurosC(l.depense);", "  return eurosC(l.depense);"],
  'couverture-fausse': ["    if (centimesDe(e.buyPrice) != null) l.achatConnu++;", "    l.achatConnu++;"],
  'benefice-zero-pas-su': ["    benefice: l.beneficesConnus ? l.benefice : null }));", "    benefice: l.benefice }));"],
  'pas-su-compte-zero': ["    if (bn.valeur != null && Number.isFinite(Number(bn.valeur))) {", "    if (true) { bn.valeur = bn.valeur == null ? 0 : bn.valeur;"],
  'moyen-sur-toutes': ["    prixMoyen: l.pairesPrixConnu ? Math.round((l.depense) / l.pairesPrixConnu) : null,", "    prixMoyen: l.paires ? Math.round((l.depense) / l.paires) : null,"],
  'frais-oublies': ["    l.achatsGros++; l.paires += a.paires; l.pairesPrixConnu += a.paires; l.depense += a.total + (a.frais || 0);", "    l.achatsGros++; l.paires += a.paires; l.pairesPrixConnu += a.paires; l.depense += a.total;"],
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fourn-'));
  fs.mkdirSync(path.join(d, 'src'));
  for (const f of ['fournisseurs.js', 'achatsSourcing.js', 'prixAchatPropose.js', 'modePaiement.js']) fs.copyFileSync(path.join(R, 'src', f), path.join(d, 'src', f));
  const f = path.join(d, 'src', 'fournisseurs.js');
  const [de, vers] = MUTS[MUT] || []; const s = fs.readFileSync(f, 'utf8');
  if (!de || !s.includes(de)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(de, vers)); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;
const cleNum = (n) => String(n == null ? '' : n).toUpperCase().replace(/\s+/g, '').replace(/^0+(?=\d)/, '');
const somme = (xs) => xs.reduce((t, x) => t + (x || 0), 0);

(async () => {
  // Des achats Vinted INVENTÉS, chacun avec le pseudo lu de son vendeur.
  const achatsVinted = [1, 2, 3].map((i) => ({ transaction_id: String(7000000 + i), title: 'Nike Dunk Low 42', price: { amount: '30', currency_code: 'EUR' }, status: 'Commande finalisée', vendeur: 'vendeuse_' + i }));
  const vendeurDe = (tx) => (achatsVinted.find((a) => a.transaction_id === tx) || {}).vendeur || '';

  console.log('\n── V. Aucun vendeur Vinted ne devient fournisseur');
  let S = null;
  try { S = await import(url('achatsSourcing.js')); } catch (e) { dit(false, 'src/achatsSourcing.js se charge', e.message); }
  if (S) {
    // L'ancienne feuille (4 nov.) : `fournisseurs({ achats, vendeurDe })` faisait une ligne par pseudo.
    const derive = Object.entries(S).filter(([, f]) => typeof f === 'function').some(([nom, f]) => {
      if (!/fournisseur/i.test(nom)) return false;
      try { const r = f({ achats: achatsVinted, vendeurDe }) || f(achatsVinted[0], vendeurDe); const l = (r && r.lignes) || (r ? [r] : []); return l.some((x) => x && /vendeuse_/.test(String(x.nom || ''))); } catch (_) { return false; }
    });
    dit(!derive, 'V1 src/achatsSourcing.js ne fait plus de fournisseur d’un vendeur Vinted (ancienne dérivation `fournisseurVinted` retirée)');
  }
  let F;
  try { F = await import(url('fournisseurs.js')); }
  catch (e) { dit(false, 'src/fournisseurs.js se charge (les fournisseurs = les personnes qu’il crée)', e.message); console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`); process.exit(1); }

  const vide = F.bilanFournisseurs({ registre: {}, fiches: {}, ventes: [], hors: [], achats: achatsVinted, vendeurDe });
  dit(vide.lignes.length === 0, 'V2 aucun fournisseur créé ⇒ liste vide, même avec 3 achats Vinted aux pseudos lus', JSON.stringify(vide.lignes.map((l) => l.nom)));
  let reg = F.avecFournisseur({}, 'fA', { nom: 'Karim', tel: '06 12 34 56 78', email: 'karim@exemple.test', note: 'Arrivage le mardi' }, '2026-11-05').registre;
  const r1 = F.bilanFournisseurs({ registre: reg, achats: achatsVinted, vendeurDe });
  dit(r1.lignes.length === 1 && r1.lignes[0].nom === 'Karim' && !r1.lignes.some((l) => /vendeuse_/.test(l.nom)), 'V3 la liste = les personnes QU’IL a créées, aucune autre', JSON.stringify(r1.lignes.map((l) => l.nom)));
  dit(F.champsFournisseur({ nom: '   ' }).erreur && F.avecFournisseur({}, 'x', { nom: '' }).erreur && Object.keys(F.lireRegistre({ personnes: { z: { tel: '0600000000' } } }).personnes).length === 0, 'V4 un fournisseur sans nom n’existe pas (ni créé, ni relu)');
  dit(F.champsFournisseur({ nom: 'A', email: 'pas une adresse' }).erreur && F.champsFournisseur({ nom: 'A', tel: 'abc' }).erreur && !F.champsFournisseur({ nom: 'A', tel: '+33 6 12 34 56 78', email: 'a@b.fr' }).erreur, 'V5 téléphone et e-mail en option, refusés s’ils sont illisibles');
  const mod = F.avecFournisseur(reg, 'fA', { nom: 'Karim B.', tel: '' }).registre;
  dit(mod.personnes.fA.nom === 'Karim B.' && mod.personnes.fA.creeLe === '2026-11-05', 'V6 modifier garde sa date de création');

  console.log('\n── R. Répartition au centime, sur SON choix');
  reg = F.avecAchatGros(reg, 'g1', { fournisseur: 'fA', date: '2026-10-12', paires: '10', total: '300', frais: '' }, 'x').registre;
  dit(reg.achats.g1 && reg.achats.g1.total === 30000 && reg.achats.g1.paires === 10 && reg.achats.g1.frais === 0, 'R1 achat en gros : 10 paires, 300 € (centimes entiers)', JSON.stringify(reg.achats.g1));
  dit(F.champsAchatGros({ fournisseur: 'fA', date: '2026-10-12', paires: '0', total: '300' }, reg).erreur && F.champsAchatGros({ fournisseur: 'fA', date: '2026-10-12', paires: '3', total: 'abc' }, reg).erreur && F.champsAchatGros({ fournisseur: 'zz', date: '2026-10-12', paires: '3', total: '30' }, reg).erreur, 'R2 nombre de paires, montant et fournisseur exigés');
  const fiche = (n, o = {}) => ({ numero: String(n), title: 'Nike Air Max 90 blanc 42', ...o });
  const lien = (id, at, o = {}) => ({ buyGros: { id, at, ...o } });
  const g1 = () => F.achatGros(reg, 'g1');
  let fiches = { a: fiche(1, lien('g1', '2026-10-13T10:00:00Z')), b: fiche(2, lien('g1', '2026-10-13T11:00:00Z')), c: fiche(3, lien('g1', '2026-10-13T12:00:00Z')), z: fiche(9) };
  let rel = F.reliesDuLot(fiches, 'g1');
  dit(rel.map((x) => x.numero).join() === '1,2,3', 'R3 les paires reliées (SON clic, lien sur la fiche), dans l’ordre du lien');
  dit(F.partsDuLot(g1(), rel).join() === '3000,3000,3000', 'R4 part égale : 300 € / 10 = 30 € par paire');
  const tous = (paires, total) => { const a = { ...g1(), paires, total, frais: 0 }; const r = Array.from({ length: paires }, (_, i) => ({ cle: 'k' + i })); return F.partsDuLot(a, r); };
  const p3 = tous(3, 10000), p7 = tous(7, 10), p10 = tous(10, 29999);
  dit(somme(p3) === 10000 && JSON.stringify(p3) === '[3334,3333,3333]' && somme(p7) === 10 && somme(p10) === 29999 && p10.every((c) => c === 2999 || c === 3000), 'R5 juste au centime : 100 €/3 = 33,34+33,33+33,33 ; 0,10 €/7 ; 299,99 €/10', JSON.stringify([p3, p7, p10]));
  // Frais : jamais devinés.
  reg = F.avecAchatGros(reg, 'g2', { fournisseur: 'fA', date: '2026-10-20', paires: '4', total: '200', frais: '20' }, 'x').registre;
  const r2 = (base) => F.achatGros(base ? F.avecRepartition(reg, 'g2', { base }) : reg, 'g2');
  const relG2 = [0, 1, 2, 3].map((i) => ({ cle: 'q' + i }));
  dit(F.baseRepartition(r2()) === null && F.partsDuLot(r2(), relG2).every((c) => c === null), 'R6 des frais sans SON choix ⇒ aucune part proposée (ni 200 €, ni 220 € devinés)');
  dit(F.baseRepartition(r2('prix')) === 20000 && somme(F.partsDuLot(r2('frais'), relG2)) === 22000, 'R7 « prix seul » = 200 € ; « avec les frais » = 220 € répartis au centime');
  // Paire par paire.
  const aMain = F.achatGros(F.avecRepartition(reg, 'g1', { mode: 'main', parts: { a: 4000, b: 2500 } }), 'g1');
  dit(F.partsDuLot(aMain, rel).join() === '4000,2500,', 'R8 paire par paire : SES saisies, une case vide reste vide (jamais une part inventée)');
  const e1 = F.etatSaisieGros(aMain, rel, ['40', '25', '35']);
  const e2 = F.etatSaisieGros(aMain, rel, ['200', '100', '1']);
  dit(e1.ok && e1.reste === 20000 && !e1.toutes && !e2.ok && e2.depasse, 'R9 3 paires reliées sur 10 : 100 € saisis ⇒ reste 200 € ; 301 € ⇒ refusé (au-dessus de 300 €)', JSON.stringify([e1, e2].map((e) => [e.ok, e.reste])));
  const rel10 = Array.from({ length: 10 }, (_, i) => ({ cle: 'k' + i }));
  const e3 = F.etatSaisieGros(aMain, rel10, Array(10).fill('29,99'));
  const e4 = F.etatSaisieGros(aMain, rel10, [...Array(9).fill('30'), '30']);
  dit(!e3.ok && e3.reste === 10 && e4.ok && e4.reste === 0, 'R10 les 10 reliées : juste au centime exigé (299,90 € ⇒ « reste 0,10 € »)', JSON.stringify([e3.reste, e4.reste]));

  console.log('\n── M. Un prix saisi à la main n’est jamais écrasé sans lui');
  const pn = (n) => ({ 5: '41' })[String(n)];          // un prix saisi PAR N° (vinted_buyprice_by_num)
  fiches = { a: fiche(1, lien('g1', '2026-10-13T10:00:00Z')), b: fiche(2, { buyPrice: '35', ...lien('g1', '2026-10-13T11:00:00Z') }), c: fiche(3, { buyPrice: '30,00', ...lien('g1', '2026-10-13T12:00:00Z') }),
    d: fiche(5, lien('g1', '2026-10-13T13:00:00Z')), e: fiche(6, { buyPrice: '30', ...lien('g1', '2026-10-13T14:00:00Z', { part: 3000 }) }) };
  rel = F.reliesDuLot(fiches, 'g1');
  const plan = F.planPrixGros({ achat: g1(), relies: rel, prixParNum: pn });
  dit(plan.aEcrire.map((x) => x.numero).join() === '1' && plan.aDemander.map((x) => x.numero).join() === '2,5' && plan.identiques.length === 2, 'M1 plan : N°1 sans prix ⇒ à poser ; N°2 (35 € saisi) et N°5 (41 € saisi par N°) ⇒ à DEMANDER ; N°3 et N°6 déjà à 30 €', JSON.stringify({ e: plan.aEcrire.map((x) => x.numero), d: plan.aDemander.map((x) => x.numero), i: plan.identiques }));
  dit(F.ecrituresPrixGros({ achat: g1(), relies: rel, prixParNum: pn }) === null, 'M2 aucune écriture sans SON clic (`confirme`)');
  const w0 = F.ecrituresPrixGros({ achat: g1(), relies: rel, prixParNum: pn, confirme: true });
  dit(w0 && w0.ecritures.map((x) => x.cle).join() === 'a' && w0.gardes.map((x) => x.numero).join() === '2,5', 'M3 confirmé SANS « Remplacer » : seul le N°1 reçoit 30 € ; 35 € et 41 € restent', JSON.stringify(w0 && w0.ecritures));
  const w1 = F.ecrituresPrixGros({ achat: g1(), relies: rel, prixParNum: pn, remplacer: ['b'], confirme: true });
  const wb = w1 && w1.ecritures.find((x) => x.cle === 'b');
  dit(wb && wb.patch.buyPrice === '30,00' && wb.patch.buyGros.avant === '35' && wb.patch.buyGros.part === 3000 && !w1.ecritures.some((x) => x.cle === 'd'), 'M4 « Remplacer » sur le N°2 seulement : 30 € posé, 35 € gardé pour le rendre ; le N°5 reste', JSON.stringify(wb));
  const fb = { ...fiches.b, ...wb.patch };
  dit(F.ecritureDelierGros(fb, 'g1', pn).buyPrice === '35', 'M5 délier rend le prix d’avant (35 €)');
  dit(F.ecritureDelierGros(fiches.b, 'g1', pn).buyPrice === undefined && F.ecritureDelierGros(fiches.b, 'g1', pn).buyGros === null, 'M6 délier une paire au prix saisi à la main : le lien part, le prix reste');
  const fa = { ...fiches.a, ...w0.ecritures[0].patch };
  dit(F.ecritureDelierGros(fa, 'g1', pn).buyPrice === '', 'M7 délier une paire au prix posé par le lot : le prix part avec');
  const retape = { ...fa, buyPrice: '28' };                       // il a retapé le prix à la main après coup
  dit(F.origineDuPrix(retape, 'g1', pn).etat === 'main' && F.planPrixGros({ achat: g1(), relies: [{ cle: 'a', numero: '1', entree: retape }], prixParNum: pn }).aDemander.length === 1, 'M8 un prix retapé à la main après le lot redevient « saisi à la main » (demandé, jamais écrasé)');
  dit(F.ecritureLienGros(fiche(7, { buyFromId: '7000001' }), g1(), { nRelies: 0 }) === null && F.ecritureLienGros(fiche(8, lien('autre', 'x')), g1(), { nRelies: 0 }) === null, 'M9 une paire déjà reliée (achat Vinted ou autre achat en gros) ne se relie pas');
  dit(F.ecritureLienGros(fiche(7), g1(), { nRelies: 10 }) === null && F.ecritureLienGros(fiche(7), g1(), { nRelies: 3, at: 't' }).buyGros.id === 'g1', 'M10 un achat de 10 paires n’en relie pas une 11ᵉ');
  dit(F.ecritureLienGros(fiche(7, { buyPrice: '50' }), g1(), { nRelies: 3 }).buyPrice === undefined, 'M11 relier ne pose jamais de prix lui-même (le prix passe par la règle des prix)');
  // « Garder 35 € » : SA réponse est gardée — la question ne revient pas ; s'il retape un autre prix, elle revient.
  const regG = F.avecGardes(reg, 'g1', { b: 3500 });
  const gG = F.achatGros(regG, 'g1');
  const planG = F.planPrixGros({ achat: gG, relies: rel, prixParNum: pn });
  const relAutre = rel.map((x) => (x.cle === 'b' ? { ...x, entree: { ...x.entree, buyPrice: '36' } } : x));
  const planA = F.planPrixGros({ achat: gG, relies: relAutre, prixParNum: pn });
  dit(planG.aDemander.map((x) => x.numero).join() === '5' && planG.gardes.join() === 'b' && planA.aDemander.map((x) => x.numero).join() === '2,5', 'M12 « Garder 35 € » : le N°2 n’est plus redemandé ; retapé à 36 €, la question revient', JSON.stringify([planG.aDemander.map((x) => x.numero), planG.gardes, planA.aDemander.map((x) => x.numero)]));
  const wG = F.ecrituresPrixGros({ achat: gG, relies: rel, prixParNum: pn, remplacer: ['b', 'd'], confirme: true });
  dit(wG && !wG.ecritures.some((x) => x.cle === 'b') && fiches.b.buyPrice === '35', 'M13 une paire « gardée » n’est jamais réécrite, même dans un lot confirmé');

  console.log('\n── I. Identité : SON lien, jamais le titre');
  reg = F.avecFournisseur(reg, 'fB', { nom: 'Sofia' }).registre;
  reg = F.avecAchatGros(reg, 'g3', { fournisseur: 'fB', date: '2026-09-01', paires: '50', total: '1000' }, 'x').registre;
  const memes = {};
  for (let i = 0; i < 50; i++) memes['m' + i] = fiche(100 + i, i < 5 ? { buyPrice: '20', ...lien('g3', 't' + String(i).padStart(2, '0'), { part: 2000 }) } : { buyPrice: '20' });
  const ventesMemes = Object.entries(memes).map(([k, e]) => ({ id: 'v' + k, entree: e, benefice: { valeur: 15, partiel: false } }));
  const bm = F.bilanFournisseurs({ registre: reg, fiches: memes, ventes: ventesMemes, cleNum });
  const so = bm.lignes.find((l) => l.id === 'fB');
  dit(so && so.relies === 5 && so.revendues === 5 && so.benefice === 7500 && bm.parAchat.g3.relies === 5 && bm.parAchat.g3.sur === 50, 'I1 50 paires au MÊME titre, 5 reliées par lui : 5 revendues, pas 50 ; « 5 sur 50 reliées »', JSON.stringify(so));
  dit(F.texteRelies(bm.parAchat.g3) === '5 sur 50 reliées', 'I2 la fiche dit « 5 sur 50 reliées »', F.texteRelies(bm.parAchat.g3));
  const hors = [{ id: 'h1', title: 'Jordan', price: '60', numero: '007', source: 'Fournisseur' }, { id: 'h2', price: '8', numero: '8', source: 'Fournisseur' }, { id: 'h3', price: '5', numero: '8', source: 'Brocante' }, { id: 'h4', price: '9', numero: '9', source: 'Fournisseur' }];
  dit(F.horsRattachables(hors, reg).map((b) => b.id).join() === 'h1,h2,h4', 'I3 seuls les achats saisis « Fournisseur » sont PROPOSÉS au rattachement');
  let regH = F.avecHors(F.avecHors(reg, 'h1', 'fB', 't'), 'h2', 'fB', 't');
  const fichesH = { x: fiche(7, { buyPrice: '60' }), y: fiche(8, { buyPrice: '8' }), w: fiche(9, { buyPrice: '9' }) };
  const ventesH = [{ id: 'vx', entree: fichesH.x, benefice: { valeur: 40 } }, { id: 'vy', entree: fichesH.y, benefice: { valeur: 4 } }, { id: 'vw', entree: fichesH.w, benefice: { valeur: 3 } }];
  const bhs = F.bilanFournisseurs({ registre: regH, fiches: fichesH, ventes: ventesH, hors, cleNum, prixHors: (b) => Number(String(b.price).replace(',', '.')) }).lignes;
  const bh = bhs.find((l) => l.id === 'fB'), ka = bhs.find((l) => l.id === 'fA');
  dit(bh.achatsHors === 2 && bh.revendues === 1 && bh.benefice === 4000 && ka.achatsHors === 0 && ka.revendues === 0, 'I4 rattachés par lui : h1 (N°007 = N°7) revendu ; h2 au N°8 porté aussi par h3 ⇒ ambigu, rien ; h4 jamais rattaché ⇒ à personne', JSON.stringify([bh, ka.achatsHors]));
  dit(bh.paires === 52 && bh.depense === 100000 + 6000 + 800, 'I5 Dépensé et paires : l’achat en gros + les deux achats rattachés (un achat non rattaché n’est pas compté)', JSON.stringify([bh.paires, bh.depense]));
  const regD = F.sansHors(regH, 'h1');
  dit(!regD.hors.h1 && regD.hors.h2, 'I6 « Détacher » retire le rattachement, rien d’autre');
  const regR = F.sansFournisseur(regH, 'fB');
  dit(!regR.registre.personnes.fB && !regR.registre.achats.g3 && !Object.keys(regR.registre.hors).length && regR.achatsRetires.join() === 'g3' && regR.registre.personnes.fA, 'I7 retirer un fournisseur : ses achats en gros et rattachements partent (à délier), les autres restent');

  console.log('\n── C. Les chiffres : « au moins », « — », couverture');
  // Karim : achat de 10 paires à 300 € + achat de 4 paires 200 € + 20 € de frais ; un achat rattaché au prix illisible.
  let regC = F.avecRepartition(reg, 'g2', { base: 'frais' });
  regC = F.avecHors(regC, 'h9', 'fA', 't');
  const horsC = [{ id: 'h9', price: 'illisible', numero: '' }];
  const fichesC = { a: fiche(1, { buyPrice: '30', ...lien('g1', 't1', { part: 3000 }) }), b: fiche(2, lien('g1', 't2')), c: fiche(3, { buyPrice: '30', ...lien('g1', 't3', { part: 3000 }) }) };
  const ventesC = [
    { id: 'v1', entree: fichesC.a, benefice: { valeur: 25, partiel: false } },
    { id: 'v2', entree: fichesC.b, benefice: { valeur: null, partiel: false } },          // prix d'achat pas su
    { id: 'v3', entree: fichesC.c, benefice: { valeur: 10, partiel: true } },            // frais pas confirmés
    { id: 'v1', entree: fichesC.a, benefice: { valeur: 25 } },                           // la même vente vue deux fois
    { id: 'v4', entree: fiche(77, { buyPrice: '10', buyFromId: '7000001' }), benefice: { valeur: 99 } },   // un achat Vinted : pas à lui
  ];
  const lc = F.bilanFournisseurs({ registre: regC, fiches: fichesC, ventes: ventesC, hors: horsC, cleNum }).lignes.find((l) => l.id === 'fA');
  dit(lc.paires === 15 && lc.depense === 30000 + 22000 && lc.sansPrix === 1, 'C1 Dépensé = 300 € + 200 € + 20 € de frais, le prix illisible compté à part', JSON.stringify([lc.paires, lc.depense, lc.sansPrix]));
  dit(F.texteDepense(lc).replace(/\u00a0/g, ' ') === 'au moins 520 €', 'C2 un prix illisible ⇒ « au moins 520 € »', F.texteDepense(lc));
  dit(lc.prixMoyen === Math.round(52000 / 14) && F.texteMoyen(lc).replace(/\u00a0/g, ' ') === '37,14 €', 'C3 prix moyen = sur les paires au prix connu (520 € / 14), jamais 520 € / 15', JSON.stringify([lc.prixMoyen, F.texteMoyen(lc)]));
  dit(lc.revendues === 3 && lc.achatConnu === 2 && lc.beneficesConnus === 2 && lc.benefice === 3500, 'C4 3 revendues (une vente vue deux fois comptée une fois, l’achat Vinted dehors), prix d’achat connu pour 2, bénéfice 35 €', JSON.stringify(lc));
  dit(F.texteCouverture(lc) === 'sur 3 vendues, prix d’achat connu pour 2', 'C5 couverture « sur 3 vendues, prix d’achat connu pour 2 »', F.texteCouverture(lc));
  const sp = (t) => String(t).replace(/\u00a0/g, ' '); // (6 nov., finition) l'espace avant « € » est insécable
  dit(sp(F.texteBeneficeFournisseur(lc)) === 'au plus +35 €' && !/au moins/.test(F.texteBeneficeFournisseur(lc)), 'C6 frais pas confirmés ⇒ « au plus +35 € » ; jamais « au moins » sur un bénéfice', F.texteBeneficeFournisseur(lc));
  const lp = F.bilanFournisseurs({ registre: regC, fiches: fichesC, ventes: ventesC.filter((v) => v.id !== 'v3'), hors: horsC, cleNum }).lignes.find((l) => l.id === 'fA');
  dit(sp(F.texteBeneficeFournisseur(lp)) === '+25 €' && F.texteCouverture(lp) === 'sur 2 vendues, prix d’achat connu pour 1', 'C7 bénéfice partiel ⇒ « +25 € » et sa couverture « sur 2 vendues, prix d’achat connu pour 1 », jamais « au moins »', F.texteBeneficeFournisseur(lp) + ' | ' + F.texteCouverture(lp));
  const ln = F.bilanFournisseurs({ registre: regC, fiches: fichesC, ventes: [ventesC[1]], hors: [], cleNum }).lignes.find((l) => l.id === 'fA');
  dit(ln.benefice === null && F.texteBeneficeFournisseur(ln) === '—' && F.texteCouverture(ln) === 'sur 1 vendue, prix d’achat connu pour 0', 'C8 aucun bénéfice connu ⇒ « — » (jamais 0 €), la couverture le dit', JSON.stringify([ln.benefice, F.texteCouverture(ln)]));
  const l0 = F.bilanFournisseurs({ registre: F.avecFournisseur({}, 'fZ', { nom: 'Zoé' }).registre }).lignes[0];
  dit(l0.prixMoyen === null && F.texteMoyen(l0) === '—' && sp(F.texteDepense(l0)) === '0 €' && F.texteCouverture(l0) === '', 'C9 un fournisseur sans achat : prix moyen « — », aucune couverture inventée');
  const lt = F.bilanFournisseurs({ registre: F.avecHors(F.avecFournisseur({}, 'fZ', { nom: 'Zoé' }).registre, 'h9', 'fZ'), hors: horsC }).lignes[0];
  dit(F.texteDepense(lt) === '—', 'C10 rien de lisible ⇒ « — », jamais « au moins 0 € »', F.texteDepense(lt));
  // 10 paires à 300 €, 3 reliées : le scénario du banc.
  const b10 = F.bilanFournisseurs({ registre: reg, fiches: { a: fiche(1, lien('g1', 't1')), b: fiche(2, lien('g1', 't2')), c: fiche(3, lien('g1', 't3')) } });
  dit(b10.parAchat.g1.relies === 3 && F.texteRelies(b10.parAchat.g1) === '3 sur 10 reliées', 'C11 10 paires à 300 €, 3 N° reliés : « 3 sur 10 reliées »');

  // (5 nov., intégration lot 2) La fiche complète d'une paire (« Voir l'état »)
  // et Fournisseurs disent la MÊME origine du prix (une règle : `origineDuPrix`).
  console.log('\n── P. La fiche d’une paire dit l’origine du prix comme Fournisseurs');
  try {
    const u = (f) => require('url').pathToFileURL(path.join(R, 'src', f)).href;
    const { parcoursPaire } = await import(u('fichePaire.js'));
    const { histoireArticle } = await import(u('histoireArticle.js'));
    const { etatArticle } = await import(u('etatArticle.js'));
    const voir = (prix) => {
      const rn = { etat: 'ok', cle: '7', annonces: [{ id: 'a1', title: 'Nike Air Max 90 blanc 42' }], ventes: { vinted: [], lbc: [], ebay: [] }, manques: [] };
      const d = { fiches: { a1: { numero: '7', title: 'Nike Air Max 90 blanc 42', buyPrice: prix, buyGros: { id: 'g1', at: '2026-10-13T10:00:00Z', part: 3000 } } } };
      const pp = parcoursPaire(rn, d, {}); const h = histoireArticle(rn, d, {});
      return { etape: pp && pp.etapes[0], etat: h ? etatArticle(h, { fiches: d.fiches, ids: ['a1'] }) : null };
    };
    const lot = voir('30'), main = voir('35');
    dit(lot.etape && lot.etape.gros === true && !/saisi à la main/.test(lot.etape.detail) && lot.etat && lot.etat.prixAchat.source === 'gros',
      'P1 prix posé par le lot (part 30 €) : la fiche dit « achat en gros », jamais « saisi à la main »', JSON.stringify([lot.etape, lot.etat && lot.etat.prixAchat]));
    dit(main.etape && !main.etape.gros && main.etat && main.etat.prixAchat.source === 'saisi',
      'P2 prix retapé (35 €) sur une paire du lot : « saisi à la main » (la règle de Fournisseurs)', JSON.stringify([main.etape, main.etat && main.etat.prixAchat]));
  } catch (e) { dit(false, 'P la fiche complète se charge', e.message); }

  console.log('\n── A. L’app ne nourrit pas la feuille avec les achats Vinted');
  const sansCom = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const APP = sansCom(fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8'));
  const memo = (/const asoFournisseurs = useMemo\(\(\) => \{([\s\S]*?)\n  \}, \[/.exec(APP) || [])[1] || '';
  dit(memo && /bilanFournisseurs\(/.test(memo) && !/buysBase|buys\.items|vendeurDe|fournisseursAchats|infosAchatsLues/.test(memo), 'A1 la feuille Fournisseurs = `bilanFournisseurs` sur SON registre ; ni achats Vinted ni pseudos lus passés', memo ? '' : 'bloc introuvable');
  dit(/'vrm_fournisseurs'/.test((/const SYNC_KEYS = \[[\s\S]*?\];/.exec(APP) || [''])[0]), 'A2 `vrm_fournisseurs` est synchronisé (ligne `main`, fusion clé par clé)');
  const src = sansCom(fs.readFileSync(path.join(SRC, 'fournisseurs.js'), 'utf8'));
  dit(!/fetch\(|localStorage|\bsave\(|setNumeros|\.title\s*===|titre\s*===|seller|vendeur/.test(src), 'A3 src/fournisseurs.js : aucune écriture, aucune lecture réseau, aucun titre comparé, aucun vendeur');

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
