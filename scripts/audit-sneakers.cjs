// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE LOT SNEAKERS (28 nov. 2026) : référence fabricant, pointure, cote VRM, étiquettes, entonnoir, en masse.
//  Lecture seule, aucune donnée réelle (tout est fabriqué ici). Exécute les VRAIS modules de src/sneakers/.
//   I  identité (§5) : 50 paires de la MÊME référence ⇒ aucune vente reliée, aucun N° rendu par une référence ;
//      la référence ne crée aucune table « référence → N° » ; audit-identite.cjs reste vert (lancé ici).
//   R  référence et pointure : formes reconnues, ambiguïté ⇒ rien d'unique, faux amis refusés (code postal, suivi).
//   C  cote VRM : zéro vente ⇒ rien inventé (médiane null) ; ventes simulées ⇒ médiane, nombre, dernière DATÉE,
//      repli « toutes pointures » sous 2 ventes, autre devise et prix pas lu écartés, fenêtre de 12 mois.
//   L  jamais à la mise en ligne (§3) : aucun écran de publication n'importe la cote, la feuille ou la cote d'achat ;
//      la fiche (BlocFiche) n'importe pas la cote ; la cote est montée dans la calculette et la valeur du stock.
//   S  StockX : aucune clé, aucune route, aucune adresse StockX dans le code (décision du 28 nov.).
//   M  en masse : plancher prix mini / achat + 10 % ; sous le plancher jamais envoyé ; sans plancher seulement sur
//      SON choix ; hausse jamais par la file ; la commande de la file a la forme de « Paires qui dorment »
//      (geste 'baisser', file 'prix', args { id, prix, prixAvant }) ; aucune `cmd_prix_*`, aucune commande du pont.
//   T  étiquettes : créer, poser, retirer, compter, filtrer ; ni rouge ni violet.
//   E  entonnoir : vues pas lues ne comptent pas ; vente comptée par IDENTITÉ d'annonce seulement.
//  `--mutation` : chaque règle affaiblie dans une copie des modules ⇒ l'audit doit rougir.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

async function verifier(dossier, { silencieux = false, sansIdentite = false } = {}) {
  const fautes = [];
  const dit = (ok, quoi) => { if (!ok) fautes.push(quoi); else if (!silencieux) console.log('  ✓ ' + quoi); };
  const imp = (f) => import(pathToFileURL(path.join(dossier, f)).href + '?t=' + Date.now() + Math.random());
  const R = await imp('reference.js'), C = await imp('cote.js'), M = await imp('masse.js'), T = await imp('tags.js'), E = await imp('entonnoir.js'), S = await imp('stockage.js');
  const now = Date.parse('2026-11-28T12:00:00Z'), j = (n) => now - n * 86400000;

  // ── I ──
  const ventes50 = Array.from({ length: 50 }, (_, i) => ({ site: 'vinted', prix: 90 + (i % 5), venduMs: j(i + 1), titre: 'Nike Dunk Low Panda DD1391-100 taille 42,5', num: '', itemId: String(1000000 + i) }));
  let etat = {}; for (let i = 1; i <= 50; i++) etat = S.poserFiches(etat, [String(i)], { ref: 'DD1391-100', pointure: 'EU 42,5' });
  const reliees = S.avecFiches(ventes50, etat);
  dit(reliees.every((v) => v.num === ''), 'I1 50 paires de même référence : aucune vente sans N° ne reçoit un N° par sa référence');
  const v1 = S.avecFiches([{ ...ventes50[0], num: '7' }], etat)[0];
  dit(v1.num === '7' && v1.ref === 'DD1391-100', 'I2 une vente garde SON N° (identité) ; la référence vient de la fiche de CE N° seulement');
  const e = S.etatSneakers(etat);
  dit(Object.keys(e).sort().join(',') === 'fiches,poses,tags,v' && Object.keys(e.fiches).every((k) => /^\d+$/.test(k)), 'I3 rangé SOUS le N° (fiches[N°]) : aucune table « référence → N° »');
  const srcSnk = fs.readdirSync(dossier).filter((f) => /\.(js|jsx)$/.test(f)).map((f) => sansCommentaires(fs.readFileSync(path.join(dossier, f), 'utf8'))).join('\n');
  dit(!/\[\s*(?:r|ref|R)(?:\.ref)?\s*\]\s*=\s*[^=]*num/.test(srcSnk) && !/numParRef|numDeRef|refVersNum|parReference\s*\[/.test(srcSnk), 'I4 aucun code ne range un N° sous une référence');
  const cote50 = C.coteVRM(ventes50, { ref: 'DD1391-100', pointure: '42,5' }, { maintenant: now });
  dit(cote50 && !('num' in cote50) && !('nums' in cote50) && !('cle' in cote50), 'I5 la cote ne rend aucun N° ni aucune clé de paire');
  if (!sansIdentite) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'audit-identite.cjs')], { encoding: 'utf8', cwd: RACINE });
    dit(r.status === 0, 'I6 scripts/audit-identite.cjs reste vert' + (r.status === 0 ? '' : ' — ' + (r.stdout + r.stderr).slice(-400)));
  }

  // ── R ──
  dit(R.normaliserRef('dd1391 100') === 'DD1391-100' && R.normaliserRef('555088 134') === '555088-134', 'R1 la référence tapée se normalise (DD1391-100, 555088-134)');
  dit(R.proposerRefs('Dunk DD1391-100 taille 42').unique === 'DD1391-100', 'R2 une seule référence lue ⇒ proposée');
  dit(R.proposerRefs('Dunk DD1391-100 ou DD1391-101').unique === '' && R.proposerRefs('Dunk DD1391-100 ou DD1391-101').refs.length === 2, 'R3 deux références ⇒ ambigu, rien d’unique (son choix)');
  dit(R.proposerRefs('livraison 75012 335, suivi 123456 789').refs.length === 0, 'R4 un code postal ou un n° de suivi ne devient jamais une référence');
  dit(R.refEffective('', 'A DD1391-100 B CW1590-100').ref === '' && R.refEffective('CW1590-100', 'DD1391-100').ref === 'CW1590-100', 'R5 posée > titre unique ; titre ambigu ⇒ rien');
  const p = R.normaliserPointure('US 9');
  dit(R.clePointure(p, 'DD1391-100') === 'EU:42.5' && R.clePointure(p, 'B75806') === 'US:9', 'R6 US→EU seulement par la table Nike homme, pour une référence Nike/Jordan');
  dit(R.pointureDuTexte('taille 42 et taille 43') === null && R.pointureDuTexte('Samba 42 2/3').texte === 'EU 42 2/3', 'R7 deux pointures ⇒ rien ; « 42 2/3 » lue');

  // ── C ──
  const vs = [
    { site: 'vinted', prix: { amount: '95.00', currency_code: 'EUR' }, venduMs: j(10), misEnLigneMs: j(20), titre: 'Dunk DD1391-100 taille 42,5' },
    { site: 'ebay', prix: 105, venduMs: j(40), titre: 'Nike DD1391-100 EU 42.5' },
    { site: 'vinted', prix: 80, venduMs: j(100), titre: 'DD1391-100 T44' },
    { site: 'vinted', prix: 70, venduMs: j(500), titre: 'DD1391-100 T42.5' },
    { site: 'ebay', prix: 300, devise: 'GBP', venduMs: j(5), titre: 'DD1391-100 EU 42.5' },
    { site: 'vinted', prix: null, venduMs: j(6), titre: 'DD1391-100 EU 42.5' },
  ];
  const vide = C.coteVRM([], { ref: 'DD1391-100', pointure: '42,5' }, { maintenant: now });
  dit(vide && vide.medianeC === null && vide.n === 0 && vide.derniere === null && vide.niveau === 'aucune', 'C1 zéro vente ⇒ médiane null, rien inventé');
  const c1 = C.coteVRM(vs, { ref: 'DD1391-100', pointure: '42,5' }, { maintenant: now });
  dit(c1.niveau === 'pointure' && c1.n === 2 && c1.medianeC === 10000, 'C2 deux ventes à la pointure ⇒ médiane 100 € (95 et 105)');
  dit(c1.derniere && c1.derniere.ms === j(10) && c1.derniere.prixC === 9500, 'C3 la dernière vente est DATÉE (son jour, son prix)');
  dit(c1.delaiJours === 10 && c1.nDelai === 1, 'C4 délai moyen sur les seules ventes à date de mise en ligne lue (couverture dite)');
  const c2 = C.coteVRM(vs, { ref: 'DD1391-100', pointure: '45' }, { maintenant: now });
  dit(c2.niveau === 'reference' && c2.n === 3, 'C5 aucune vente à la pointure ⇒ toutes pointures, et c’est dit (niveau)');
  const c44 = C.coteVRM(vs, { ref: 'DD1391-100', pointure: '44' }, { maintenant: now });
  dit(c44.nPointure === 1 && c44.niveau === 'reference' && c44.n === 3, 'C6 UNE seule vente à la pointure (moins de 2) ⇒ toutes pointures');
  dit(C.coteVRM(vs, { ref: 'DD1391-100' }, { maintenant: now }).n === 3, 'C7 autre devise, prix pas lu et vente de plus de 12 mois écartés');
  const vstk = C.valeurStockCote([{ cle: '1', ref: 'DD1391-100', pointure: R.normaliserPointure('42,5') }, { cle: '2', titre: 'sans référence' }, { cle: '3', ref: 'CW1590-100' }], vs, { maintenant: now });
  dit(vstk.total === 3 && vstk.cotees === 1 && vstk.valeurC === 10000 && vstk.sansRef === 1 && vstk.sansVente === 1, 'C8 valeur du stock : « 1 sur 3 cotées », une paire sans cote n’est jamais 0 €');
  dit(C.valeurStockCote([{ cle: '2', titre: 'x' }], vs, { maintenant: now }).valeurC === null, 'C9 aucune paire cotée ⇒ valeur null (« — »), jamais 0 €');
  dit(C.margePossible(c1, 6000) === 4000 && C.margePossible(vide, 6000) === null, 'C10 marge possible = médiane − achat ; sans cote ⇒ null');

  // ── M ──
  const lignes = [
    { cle: 'vinted:1', site: 'vinted', id: '12345', compte: '9', prix: 100, mini: 85 },
    { cle: 'ebay:2', site: 'ebay', id: '22', prix: 120, achat: 100 },
    { cle: 'vinted:3', site: 'vinted', id: '33333', compte: '9', prix: 90 },
    { cle: 'leboncoin:4', site: 'leboncoin', id: '1234567', compte: 'a', prix: 50, mini: 48 },
    { cle: 'ebay:5', site: 'ebay', id: '55', prix: 80, devise: 'GBP', mini: 10 },
  ];
  const op = M.lireOperation('pct', '10');
  const plan = M.planMasse(lignes, op), etatDe = (k) => plan.find((l) => l.cle === k).etat;
  dit(etatDe('vinted:1') === 'ok' && plan[0].apresC === 9000 && plan[0].plancher.source === 'mini', 'M1 −10 % sur 100 € au mini 85 € ⇒ 90 €, part');
  dit(etatDe('ebay:2') === 'sous-plancher' && plan[1].plancher.cents === 11000, 'M2 achat 100 € ⇒ plancher 110 € ; 108 € ne part pas');
  dit(etatDe('vinted:3') === 'sans-plancher' && etatDe('leboncoin:4') === 'sous-plancher' && etatDe('ebay:5') === 'devise', 'M3 sans plancher, sous le plancher, autre devise : dits');
  dit(M.lignesAEnvoyer(plan).map((l) => l.cle).join() === 'vinted:1' && M.lignesAEnvoyer(plan, true).map((l) => l.cle).join() === 'vinted:1,vinted:3', 'M4 « sans plancher » ne part que sur SON choix');
  const hausse = M.planMasse([{ cle: 'vinted:1', site: 'vinted', id: '12345', compte: '9', prix: 50, mini: 40 }], M.lireOperation('prix', '60'));
  dit(hausse[0].etat === 'hausse' && hausse[0].voie === 'panneau' && M.lignesAEnvoyer(hausse, true).length === 0, 'M5 une hausse ne passe jamais par la file (le panneau)');
  dit(M.lireOperation('pct', '95') === null && M.lireOperation('prix', '0,5') === null && M.lireOperation('pct', 'abc') === null, 'M6 une valeur illisible ou hors bornes ⇒ rien');
  const recu = [];
  const f = await M.appliquerFile(plan, async (g) => { recu.push(g); return { ok: true, id: 'cmd_dist_x' }; }, {});
  const g0 = recu[0] || {};
  dit(recu.length === 1 && g0.geste === 'baisser' && g0.distGeste === 'prix' && g0.site === 'vinted' && g0.compte === '9' && g0.args && g0.args.id === '12345' && g0.args.prix === 90 && g0.args.prixAvant === 100 && f.res['vinted:1'].etat === 'file',
    'M7 la commande de la file a la forme de « Paires qui dorment » (baisser · prix · { id, prix, prixAvant }, compte de SON annonce)');
  const f2 = await M.appliquerFile(plan, async () => ({ ok: false, raison: 'lecture', verdict: { ok: false } }), {});
  dit(f2.panneau.length === 1 && f2.res['vinted:1'].etat === 'panneau' && M.liensPanneau(f2.panneau, op)[0].url.includes('ids=12345') && M.liensPanneau(f2.panneau, op)[0].action === 'baisser', 'M8 la porte dit non ⇒ le panneau de l’extension, sur la sélection');
  const ebayRecu = [];
  await M.appliquerEbay(M.planMasse([{ cle: 'ebay:9', site: 'ebay', id: '99', prix: 100, mini: 50 }], op), async (s, eur) => { ebayRecu.push([s.id, eur]); return { etat: 'fait' }; });
  dit(ebayRecu.length === 1 && ebayRecu[0][0] === '99' && ebayRecu[0][1] === 90, 'M9 eBay part par l’API (la route revise), au prix visé');
  const srcMasse = sansCommentaires(fs.readFileSync(path.join(dossier, 'masse.js'), 'utf8') + fs.readFileSync(path.join(dossier, 'FeuilleSneakers.jsx'), 'utf8'));
  dit(!/deposerPrixAttente|nouvelleCommandePrix|cmd_prix_|vmrCmd\b|vmrCmdSuivi\(|baisserPrixVinted|lbcPrix|vcPrix/.test(srcMasse), 'M10 aucune cmd_prix_* rangée, aucune commande de plateforme par le pont');

  // ── T ──
  let t = T.creerTag({}, 'À nettoyer', 'bleu', 'ta1'); t = T.creerTag(t, 'Collection', 'rouge', 'tb2');
  const rougeApres = t.tags[1] && t.tags[1].couleur; t = T.creerTag(t, 'à nettoyer', 'vert', 'tc3');
  dit(t.tags.length === 2 && rougeApres === 'gris', 'T1 un nom en double refusé ; une couleur interdite (rouge) ⇒ gris');
  t = T.basculerTag(t, 'ta1', ['1', '2', '3'], true); t = T.basculerTag(t, 'ta1', ['2'], false);
  dit(T.compterTags(t, ['1', '2', '3', '4']).ta1 === 2 && T.compterTags(t, ['1', '2', '3', '4'])['-'] === 2 && T.filtrerParTag(t, ['1', '2', '3'], 'ta1').join() === '1,3', 'T2 poser, retirer, compter, filtrer');
  dit(!T.COULEURS_TAG.some((c) => /rouge|violet|ambre|orange/.test(c)), 'T3 ni rouge, ni violet, ni ambre (§7)');
  dit(T.supprimerTag(t, 'ta1').poses['1'] === undefined, 'T4 supprimer une étiquette la retire de chaque N°');

  // ── E ──
  const en = E.entonnoirParModele([{ id: '1', titre: 'DD1391-100', vues: 100, favoris: 10 }, { id: '2', titre: 'DD1391-100', vues: null, favoris: 3 }, { id: '3', titre: 'Dunk Panda', vues: 5, favoris: 1 }], new Set(['1']));
  const d = en.find((x) => x.ref === 'DD1391-100');
  dit(d.annonces === 2 && d.vues === 100 && d.nVues === 1 && d.tauxFavoris === null && d.ventes === 1, 'E1 vues pas lues hors somme, taux « — » sur couverture partielle, vente par identité');
  dit(en[en.length - 1].ref === '' && en[en.length - 1].annonces === 1, 'E2 sans référence : un groupe à part, jamais réparti par ressemblance');
  return fautes;
}

function verifierFichiers({ silencieux = false } = {}, src = null) {
  const fautes = [];
  const dit = (ok, quoi) => { if (!ok) fautes.push(quoi); else if (!silencieux) console.log('  ✓ ' + quoi); };
  const L = (f) => (src && src[f] != null ? src[f] : (fs.existsSync(path.join(RACINE, f)) ? lire(f) : ''));
  // ── L ── les écrans de MISE EN LIGNE
  const PUBLIER = ['src/PublierPartout.jsx', 'src/ecrans/PublierAgent.jsx', 'src/natif/ecrans/Annonces.jsx', 'src/ecrans/Republier.jsx', 'src/ecrans/Vestiaire.jsx', 'src/ecrans/Leboncoin.jsx', 'src/ecrans/Ebay.jsx', 'src/natif/ecrans/Fiche.jsx', 'src/FichePaire.jsx', 'src/sneakers/BlocFiche.jsx']
    .concat(fs.existsSync(path.join(RACINE, 'src/publier')) ? fs.readdirSync(path.join(RACINE, 'src/publier')).filter((f) => /\.jsx?$/.test(f)).map((f) => 'src/publier/' + f) : []);
  const COTE = /from\s+['"][./]*(?:sneakers\/)?(?:cote\.js|CoteAchat\.jsx|FeuilleSneakers\.jsx)['"]|coteVRM\s*\(|valeurStockCote\s*\(/;
  const mauvais = PUBLIER.filter((f) => COTE.test(sansCommentaires(L(f))));
  dit(!mauvais.length, 'L1 aucun écran de mise en ligne (ni la fiche) ne monte la cote' + (mauvais.length ? ' — ' + mauvais.join(', ') : ''));
  dit(/CoteAchat/.test(sansCommentaires(L('src/CalculetteAchat.jsx'))), 'L2 la cote est montée À L’ACHAT (la calculette)');
  dit(/valeurStockCote\s*\(/.test(sansCommentaires(L('src/sneakers/FeuilleSneakers.jsx'))) && /vrm:sneakers/.test(L('src/ecrans/PrixMarche.jsx')), 'L3 et dans la VALEUR DU STOCK (Argent → Prix qui marche → Sneakers)');
  // ── S ── StockX
  const code = ['src/sneakers/reference.js', 'src/sneakers/cote.js', 'src/sneakers/masse.js', 'src/sneakers/stockage.js', 'src/sneakers/FeuilleSneakers.jsx', 'src/sneakers/CoteAchat.jsx', 'src/sneakers/BlocFiche.jsx', 'api/compte.js']
    .map((f) => sansCommentaires(L(f)).replace(/tr\('[^']*'/g, '')).join('\n');
  dit(!/stockx\.com|api\.stockx|stockx[-_]cle|STOCKX_|mode\s*===\s*'stockx'/i.test(code) && !fs.existsSync(path.join(RACINE, 'api/_lib/stockx-cle.js')), 'S1 aucune clé, aucune route, aucune adresse StockX (décision du 28 nov.)');
  // ── la clé synchronisée et la traduction
  dit(/'vrm_sneakers'/.test(L('src/App.jsx').slice(L('src/App.jsx').indexOf('const SYNC_KEYS'), L('src/App.jsx').indexOf('const SYNC_KEYS') + 4000)), 'K1 `vrm_sneakers` est dans SYNC_KEYS (le même sur tous ses appareils)');
  return fautes;
}

(async () => {
  const mutation = process.argv.includes('--mutation');
  console.log('audit-sneakers');
  const f1 = await verifier(path.join(RACINE, 'src/sneakers'));
  const f2 = verifierFichiers();
  const fautes = f1.concat(f2);
  for (const f of fautes) console.log('  ✗ ' + f);
  if (!mutation) { console.log(fautes.length ? `ROUGE : ${fautes.length} faute(s)` : 'VERT'); process.exit(fautes.length ? 1 : 0); }
  if (fautes.length) { console.log('ROUGE avant les mutations'); process.exit(1); }
  // Chaque mutation affaiblit UNE règle dans une copie des modules : l'audit doit rougir.
  const MUT = [
    ['masse.js', "if (apres < r.plancher.cents) return { ...r, etat: 'sous-plancher' };", '', 'plancher retiré'],
    ['masse.js', 'Math.ceil(a * 1.1)', 'Math.ceil(a * 1.0)', 'achat + 0 % au lieu de + 10 %'],
    ['masse.js', "(avecSansPlancher && l.etat === 'sans-plancher')", "(l.etat === 'sans-plancher')", 'sans plancher envoyé sans son choix'],
    ['masse.js', "if (apres > base.avantC && voie === 'file') return { ...r, voie: 'panneau', etat: 'hausse' };", '', 'hausse par la file'],
    ['masse.js', "geste: 'baisser', distGeste: 'prix'", "geste: 'baisser', distGeste: 'baisser'", 'mauvaise file'],
    ['cote.js', 'if (!l.length) return { ...base, medianeC: null', 'if (!l.length) return { ...base, medianeC: 0', 'zéro vente ⇒ 0 € inventé'],
    ['cote.js', "aLaPointure.length >= minPointure ? 'pointure'", "aLaPointure.length >= 1 ? 'pointure'", 'repli toutes pointures retiré'],
    ['cote.js', "if (v.devise && String(v.devise).toUpperCase() !== 'EUR') return null;", '', 'autre devise comptée'],
    ['cote.js', 'v.venduMs >= depuis &&', '', 'fenêtre de 12 mois retirée'],
    ['cote.js', 'return { total: (stock || []).filter(Boolean).length, cotees, valeurC: cotees ? valeurC : null,', 'return { total: (stock || []).filter(Boolean).length, cotees, valeurC,', 'valeur 0 € au lieu de —'],
    ['reference.js', "{ sorte: 'jordan', re: /(?<![A-Z0-9-])(\\d{6})-(\\d{3})(?![0-9])/g", "{ sorte: 'jordan', re: /(?<![A-Z0-9-])(\\d{6})[-\\s](\\d{3})(?![0-9])/g", 'n° de suivi pris pour une référence'],
    ['reference.js', "unique: toutes.length === 1 ? toutes[0] : ''", "unique: toutes[0] || ''", 'ambiguïté posée seule'],
    ['stockage.js', 'const f = v && v.num ? e.fiches[cleNum(v.num)] : null;', "const f = v && v.num ? e.fiches[cleNum(v.num)] : Object.values(e.fiches)[0]; if (f && !v.num) v = { ...v, num: Object.keys(e.fiches)[0] };", 'vente reliée par sa référence'],
    ['tags.js', "COULEURS_TAG.includes(couleur) ? couleur : 'gris'", "couleur || 'gris'", 'couleur rouge acceptée'],
    ['entonnoir.js', 'if (v != null) { x.vues += v; x.nVues++; }', 'x.vues += v || 0; x.nVues++;', 'vues pas lues comptées 0'],
  ];
  const MUTF = [
    ['src/PublierPartout.jsx', (s) => "import { coteVRM } from './sneakers/cote.js';\n" + s, 'cote montée à la mise en ligne'],
    ['src/sneakers/BlocFiche.jsx', (s) => "import { coteVRM } from './cote.js';\n" + s, 'cote sur la fiche'],
    ['api/compte.js', (s) => s + "\nconst U = 'https://api.stockx.com/v2';\n", 'route StockX'],
    ['src/App.jsx', (s) => s.replace("  'vrm_sneakers',\n", ''), 'clé pas synchronisée'],
  ];
  let rate = 0;
  for (const [f, de, vers, nom] of MUT) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snk-mut-'));
    for (const x of fs.readdirSync(path.join(RACINE, 'src/sneakers'))) fs.copyFileSync(path.join(RACINE, 'src/sneakers', x), path.join(tmp, x));
    fs.writeFileSync(path.join(tmp, 'ouvrirPanneau.js'), "export const lienPanneau = ({ site, page, ids, action }) => `https://x/?vrm=panneau&page=${page}&ids=${ids.join(',')}&action=${action}`;\n");
    for (const x of fs.readdirSync(tmp)) { const p = path.join(tmp, x); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace("from '../ouvrirPanneau.js'", "from './ouvrirPanneau.js'")); }
    const s = fs.readFileSync(path.join(tmp, f), 'utf8');
    if (!s.includes(de)) { console.log('  ? mutation introuvable : ' + nom); rate++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(tmp, f), s.replace(de, vers));
    let r; try { r = await verifier(tmp, { silencieux: true, sansIdentite: true }); } catch (e) { r = ['plantage ' + e.message]; }
    console.log((r.length ? '  ✓ ROUGE' : '  ✗ VERT ') + ' sous la mutation : ' + nom);
    if (!r.length) rate++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  for (const [f, fn, nom] of MUTF) {
    const r = verifierFichiers({ silencieux: true }, { [f]: fn(lire(f)) });
    console.log((r.length ? '  ✓ ROUGE' : '  ✗ VERT ') + ' sous la mutation : ' + nom);
    if (!r.length) rate++;
  }
  console.log(rate ? `MUTATIONS : ${rate} ne rougissent pas` : 'MUTATIONS : toutes rougissent');
  process.exit(rate ? 1 : 0);
})();
