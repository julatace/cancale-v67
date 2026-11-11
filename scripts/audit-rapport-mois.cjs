#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// audit-rapport-mois — « Rapport du mois » : le PDF EXÉCUTÉ puis RELU (11 nov.)
// ═══════════════════════════════════════════════════════════════════════════
//   node scripts/audit-rapport-mois.cjs                 contrôles sur le code du dépôt
//   node scripts/audit-rapport-mois.cjs --png=DOSSIER   + les pages en PNG (pdftoppm) pour les regarder
//   node scripts/audit-rapport-mois.cjs --mutation=NOM  la règle réaffaiblie (doit rougir)
//   node scripts/audit-rapport-mois.cjs --prouve        chaque mutation doit rougir
//
// Le vrai code (src/rapportMois.js, src/bilanMois.js, src/margePlateforme.js,
// src/statsCategories.js, src/coutVente.js, src/design/carteChiffres.js…) est
// copié dans un dossier temporaire et importé. Octobre 2026, des ventes
// INVENTÉES POUR LE BANC (aucune base touchée) : 14 ventes sur 4 plateformes et
// 3 comptes, une vente au montant pas lu, un compte Vinted pas lu, 6 articles en
// stock dont 2 sans prix, 3 achats dont un au montant pas lu.
//   R1. un PDF A4 de 2 à 4 pages, titré, au nom de SA boutique
//   R2. les chiffres clés = ceux de `bilanDuMois` (vendu, reçu, ventes), le panier
//       moyen = vendu ÷ ventes, la marge = bénéfice ÷ ventes comptées (règle de Stats)
//   R3. vendu par jour : la somme des jours = le vendu du mois ; le reçu par jour
//       n'est dessiné que si sa somme EST le reçu du mois (sinon dit)
//   R4. couverture dite : « au moins » sur un vendu partiel, « sur N » au stock,
//       « N sur M » au bénéfice ; jamais « au moins » devant un bénéfice
//   R5. répartitions : plateformes (margeParPlateforme), comptes (somme = vendu),
//       catégories (statsParCategorie)
//   R6. top 10 : 10 lignes triées, titre et N° PAR IDENTITÉ (un titre d'une autre
//       vente au même montant n'est jamais pris) ; sans relevé ⇒ « — »
//   R7. URSSAF : régime pas choisi ⇒ section ABSENTE ; particulier ⇒ la raison,
//       aucun montant ; micro ⇒ CA et cotisations au taux
//   R8. les manques NOMMÉS en fin (compte pas lu, vente au montant pas lu, stock
//       sans prix, achat au montant pas lu, ventes sans titre)
//   R9. jamais « encaissé », aucun pseudo d'acheteur
//   R10. défaut : le dernier mois BOUCLÉ
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const R0 = path.resolve(__dirname, '..');
const NM = (() => { try { return fs.realpathSync(path.join(R0, 'node_modules')); } catch (_) { return path.join(R0, 'node_modules'); } })();
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };

const MUTATIONS = {
  'recu-sans-garde': ['src/rapportMois.js', 'recuDessine = !!rj && lr.valeur != null && somme === cts(lr.valeur);', 'recuDessine = !!rj;'],
  'urssaf-devinee': ['src/rapportMois.js', 'if (urssaf && urssaf.regime != null) {', "if (urssaf) { urssaf = { ...urssaf, regime: urssaf.regime == null ? 'micro' : urssaf.regime };"],
  'titre-par-ressemblance': ['src/rapportMois.js', 'const t = titres && titres[cleVente(l.plateforme, l.tx)] || null;', 'const t = titres && Object.values(titres)[i] || null;'],
  'manque-tu': ['src/rapportMois.js', 'const ajoute = (m) => { if (m && !manques.includes(m)) manques.push(m); };', 'const ajoute = () => {};'],
  'au-moins-perdu': ['src/rapportMois.js', "const ecrit = (l, t = 'eur') => (l.valeur == null ? '—' : `${l.auMoins ? 'au moins ' : ''}", "const ecrit = (l, t = 'eur') => (l.valeur == null ? '—' : `${''}"],
  'stock-sans-couverture': ['src/rapportMois.js', "`sur ${pl(d.stock.n, 'article')}${d.stock.nSans ? ` · ${d.stock.nSans} sans prix` : ''}`", "''"],
  'pas-su-zero': ['src/rapportMois.js', "{ cle: 'panier', nom: 'Panier moyen', valeur: panier, texte: panier == null ? '—' : eurosTexte(panier)", "{ cle: 'panier', nom: 'Panier moyen', valeur: panier, texte: panier == null ? eurosTexte(0) : eurosTexte(panier)"],
};

if (process.argv.includes('--prouve')) {
  let ko = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe' }); } catch (_) { rouge = true; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} : ${rouge ? 'rouge (gardée)' : 'VERTE — aucun contrôle ne la voit'}`);
    if (!rouge) ko += 1;
  }
  process.exit(ko ? 1 : 0);
}

let ok = 0, ko = 0;
const dit = (c, t, x) => { if (c) ok += 1; else ko += 1; console.log(`  ${c ? '✅' : '❌'} ${t}${x != null && x !== '' ? ` — ${x}` : ''}`); };
const eur = (c) => { const n = Math.abs(c); return (c < 0 ? '-' : '') + String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + String(n % 100).padStart(2, '0') + ' €'; };

(async () => {
  const src = path.join(R0, 'src', 'rapportMois.js');
  if (!fs.existsSync(src)) { dit(false, 'src/rapportMois.js existe', 'absent'); console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-rapport-mois-'));
  fs.cpSync(path.join(R0, 'src'), path.join(dir, 'src'), { recursive: true, filter: (p) => !/\.(png|jpg|jpeg|webp|svg|css|jsx)$/i.test(p) });
  fs.cpSync(path.join(R0, 'api', '_lib'), path.join(dir, 'api', '_lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const mut = arg('mutation');
  if (mut) {
    const [f, a, b] = MUTATIONS[mut] || [];
    const p = path.join(dir, f || ''); const s = f ? fs.readFileSync(p, 'utf8') : '';
    if (!f || !s.includes(a)) { console.log(`mutation ${mut} : motif introuvable`); process.exit(2); }
    fs.writeFileSync(p, s.replace(a, b));
  }
  const imp = (f) => import('file://' + path.join(dir, 'src', f));
  const RM = await imp('rapportMois.js'), BM = await imp('bilanMois.js'), MP = await imp('margePlateforme.js'), SC = await imp('statsCategories.js'), CV = await imp('coutVente.js');
  const CC = await imp('design/carteChiffres.js'), BN = await imp('beneficeNoms.js');
  const PDFLib = await import('file://' + path.join(NM, 'pdf-lib', 'cjs', 'index.js')).then((m) => m.default || m);
  const pdfjs = await import('file://' + path.join(NM, 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
  const lire = async (octets) => {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(octets), isEvalSupported: false, useSystemFonts: false, standardFontDataUrl: path.join(NM, 'pdfjs-dist', 'standard_fonts') + '/' }).promise;
    const pages = [], tailles = [];
    for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const v = p.getViewport({ scale: 1 }); tailles.push([Math.round(v.width), Math.round(v.height)]); pages.push((await p.getTextContent()).items.map((x) => x.str).join(' ').replace(/\s+/g, ' ')); }
    return { pages, tailles, tout: pages.join(' \n ') };
  };

  // ── Les données inventées (octobre 2026, rapport établi le 11 novembre) ──
  const MAINT = new Date(2026, 10, 11, 10, 0).getTime();
  const ym = '2026-10';
  const T = (j, h = 12) => new Date(2026, 9, j, h).getTime();
  const lignes = [
    { plateforme: 'Vinted', ts: T(2), eur: 85, compte: 'shop_a', tx: '9001', acheteur: 'acheteur_zz' },
    { plateforme: 'Vinted', ts: T(2), eur: 40, compte: 'shop_a', tx: '9002' },
    { plateforme: 'Vinted', ts: T(5), eur: 120, compte: 'shop_b', tx: '9003' },
    { plateforme: 'Vinted', ts: T(9), eur: 60, compte: 'shop_a', tx: '9004' },
    { plateforme: 'Vinted', ts: T(12), eur: 60, compte: 'shop_b', tx: '9005' },
    { plateforme: 'Vinted', ts: T(15), eur: 35.5, compte: 'shop_a', tx: '9006' },
    { plateforme: 'Leboncoin', ts: T(15), eur: 95, compte: 'lbc_moi', tx: '7001' },
    { plateforme: 'eBay', ts: T(18), eur: 142.3, compte: 'ebay_moi', tx: '12-345' },
    { plateforme: 'Vestiaire', ts: T(20), eur: 210, compte: '', tx: 'vc88' },
    { plateforme: 'Vinted', ts: T(22), eur: 55, compte: 'shop_b', tx: '9007' },
    { plateforme: 'Vinted', ts: T(25), eur: 48, compte: 'shop_a', tx: '9008' },
    { plateforme: 'Vinted', ts: T(28), eur: 72, compte: 'shop_a', tx: '9009' },
    { plateforme: 'Leboncoin', ts: T(30), eur: 30, compte: 'lbc_moi', tx: '7002' },
    { plateforme: 'Vinted', ts: T(31, 22), eur: 65, compte: 'shop_b', tx: '9010' },
    // Hors du mois : jamais dans le rapport.
    { plateforme: 'Vinted', ts: new Date(2026, 8, 30, 23).getTime(), eur: 999, compte: 'shop_a', tx: '8999' },
    { plateforme: 'Vinted', ts: new Date(2026, 10, 1, 0, 5).getTime(), eur: 888, compte: 'shop_a', tx: '9100' },
  ];
  const dansMois = lignes.filter((l) => l.ts >= T(1, 0) && l.ts < new Date(2026, 10, 1).getTime());
  const venduC = dansMois.reduce((s, l) => s + Math.round(l.eur * 100), 0);
  const nonComptees = [{ plateforme: 'Vestiaire', raison: 'montant pas sûr', ts: T(11) }];
  const manque = ['shop_c'];
  const vendu = { n: dansMois.length, eur: venduC / 100, manque: [...manque, 'Vestiaire'] };
  // Le reçu : la ligne publiée par Ventes (forme de `vinted_urssaf_mois`), lue par LA règle.
  const recuJours = { '2026-10-04': 125, '2026-10-10': 120, '2026-10-19': 237.3, '2026-10-27': 60, '2026-09-30': 400 };
  const recuMoisC = 12500 + 12000 + 23730 + 6000;
  const publie = { mois: [{ ym, ca: recuMoisC / 100, n: 5 }], at: MAINT - 3600000, recu: { [ym]: recuMoisC / 100 }, recuJours, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' } };
  const recu = CC.recuPublieEntre(publie, { de: T(1, 0), a: new Date(2026, 10, 1).getTime(), ym, complet: true }, MAINT);
  // Le bénéfice : la forme de `beneficePeriode` (complet : 12 sur 12) et de `chiffreBenefice`.
  const B = { n: 12, nCout: 12, ca: 1017.8, brut: 402.1, net: 380, netFinal: 301.6, raison: '' };
  const CB = BN.chiffreBenefice(B, 'lu'), CBr = BN.chiffreBrut(B);
  const meilleur = BM.meilleurCompte(dansMois, RM.nomGroupeVente);
  const bilan = BM.bilanDuMois({ ym, vendu, recu, depense: 42.5, benefice: CB, B, meilleur, maintenant: MAINT, enCours: false });
  const releve = dansMois.map((l) => ({ plateforme: l.plateforme, ts: l.ts, eur: l.eur, achat: l.plateforme === 'eBay' ? null : Math.round(l.eur * 0.55 * 100) / 100, frais: 0 }));
  const plateformes = MP.margeParPlateforme({ vendu: lignes, manque: vendu.manque, nonComptees, releve, de: T(1, 0), a: new Date(2026, 10, 1).getTime() });
  // Les titres, PAR IDENTITÉ (relevé de Ventes) ; 9007 et 9008 n'y sont pas. Un leurre : une vente
  // d'un AUTRE mois au même montant que 9007 (55 €) — son titre ne doit jamais monter.
  const titres = {};
  for (const l of dansMois) if (!['9007', '9008'].includes(l.tx)) titres[SC.cleVente(l.plateforme, l.tx)] = { titre: `Paire ${l.tx}`, num: String(100 + dansMois.indexOf(l)) };
  titres['vinted:8000'] = { titre: 'LEURRE 55', num: '999' };
  const fam = { '9001': 'chaussures', '9002': 'chaussures', '9003': 'vetements', '7001': 'chaussures', '12-345': 'sacs', '9004': 'chaussures' };
  const categories = SC.statsParCategorie({ vendu: dansMois, releve: null, famDe: (p, id) => (fam[id] ? { famille: fam[id], source: 'vinted' } : null), stock: null });
  const paires = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }];
  const prix = { 1: '30', 2: '45', 3: '', 4: '22,5', 5: null, 6: '50' };
  const vs = CV.valeurStock(paires, (it) => ({ buyPrice: prix[it.id] }));
  const stock = { centimes: vs.centimes, n: vs.n, nPrix: vs.nPrix, nSans: vs.nSans, partiel: false, at: MAINT - 86400000 };
  const achats = { type: 'achats', periode: ym, lignes: [], n: 3, total: 152.4, sansMontant: 1, articleSeul: 0, nGros: 0, manque: [], complet: false };
  const boutique = { nom: 'Sneakers du Port', sous: 'SIRET 123 456 789 00012' };
  const base = { ym, maintenant: MAINT, boutique, bilan, vendu: { lignes, manque: vendu.manque, nonComptees }, B, benefice: CB, brut: CBr, recuJours, plateformes, categories, titres, stock, achats };

  console.log('R1. Un PDF A4 de 2 à 4 pages, au nom de SA boutique');
  const dMicro = RM.donneesRapportMois({ ...base, urssaf: { regime: 'micro', regimeTexte: 'Micro-entrepreneur', taux: 12.4, ca: recuMoisC / 100, apayer: Math.round(recuMoisC * 0.124) / 100, partiel: false } });
  const octets = await RM.pdfRapportMois(dMicro, { PDFLib });
  const P = await lire(octets);
  dit(P.pages.length >= 2 && P.pages.length <= 4, '2 à 4 pages', `${P.pages.length} pages`);
  dit(P.tailles.every(([w, h]) => w === 595 && h === 842), 'chaque page en A4', JSON.stringify(P.tailles[0]));
  dit(P.pages[0].includes('Sneakers du Port') && P.pages[0].includes('Rapport du mois') && /Octobre 2026/.test(P.pages[0]), 'en-tête : boutique, titre, période');
  dit(P.pages.every((p, i) => p.includes(`page ${i + 1} sur ${P.pages.length}`)), 'chaque page numérotée « page n sur N »');
  if (arg('png')) {
    const out = path.resolve(arg('png')); fs.mkdirSync(out, { recursive: true });
    const f = path.join(out, 'rapport-micro.pdf'); fs.writeFileSync(f, octets);
    try { execFileSync('pdftoppm', ['-png', '-r', '80', f, path.join(out, 'page')]); console.log(`  (pages en PNG : ${out})`); } catch (e) { console.log('  (pdftoppm absent : pas de PNG)'); }
  }

  console.log('R2. Les chiffres clés = ceux des règles');
  const p1 = P.pages[0];
  const lv = bilan.lignes.find((l) => l.cle === 'vendu');
  dit(lv.auMoins && p1.includes(`au moins ${eur(venduC)}`), 'vendu = bilanDuMois (au moins, compte pas lu)', `au moins ${eur(venduC)}`);
  dit(p1.includes(eur(recuMoisC)), 'reçu au versement = recuPublieEntre', eur(recuMoisC));
  dit(new RegExp(`au moins ${dansMois.length}\\b`).test(p1), 'ventes = paires du bilan (au moins)', String(dansMois.length));
  const panierC = Math.round(venduC / dansMois.length);
  dit(p1.includes(eur(panierC)) && p1.includes(`sur ${dansMois.length} ventes au montant lu`), 'panier moyen = vendu ÷ ventes, couverture dite', eur(panierC));
  dit(p1.includes(eur(30160)), 'bénéfice = chiffreBenefice', eur(30160));
  const marge = String(Math.round(301.6 / 1017.8 * 1000) / 10).replace('.', ',');
  dit(p1.includes(`${marge} %`), 'marge = bénéfice ÷ ventes qu’il compte (règle de Statistiques)', `${marge} %`);
  dit(p1.includes(eur(4250)), 'dépensé = bilanDuMois', eur(4250));
  dit(!p1.includes('meilleur compte'), 'vendu partiel ⇒ aucun « meilleur compte » (la règle du bilan)');

  console.log('R3. Le graphique : les jours somment le mois');
  const sJ = dMicro.jours.reduce((s, j) => s + j.vendu, 0);
  dit(dMicro.jours.length === 31 && sJ === venduC, 'Σ vendu par jour = vendu du mois', `${sJ} / ${venduC}`);
  dit(dMicro.jours[1].vendu === 12500 && dMicro.jours[30].vendu === 6500, 'jour local : 2 oct. = 125 €, 31 oct. 22 h = 65 € (pas le 1er nov.)');
  dit(dMicro.recuDessine && dMicro.jours.reduce((s, j) => s + (j.recu || 0), 0) === recuMoisC, 'reçu par jour dessiné : sa somme = le reçu du mois');
  const recuFaux = { ...recuJours, '2026-10-29': 10 };
  const dFaux = RM.donneesRapportMois({ ...base, recuJours: recuFaux });
  const PF = await lire(await RM.pdfRapportMois(dFaux, { PDFLib }));
  dit(!dFaux.recuDessine && dFaux.jours.every((j) => j.recu == null) && PF.pages[0].includes('Reçu par jour : pas publié'), 'somme différente ⇒ reçu par jour PAS dessiné, et dit');

  console.log('R4. Couverture dite');
  const p3 = P.pages.slice(2).join(' ');
  const stockC = 3000 + 4500 + 2250 + 5000;
  dit(p3.includes(`au moins ${stockC % 100 ? eur(stockC) : (stockC / 100) + ' €'}`) && p3.includes('sur 6 articles · 2 sans prix'), 'stock : « au moins » et « sur 6 · 2 sans prix »', `${stockC}`);
  const Bp = { ...B, nCout: 9, netFinal: null, raison: 'achats', brut: 310.25 };
  const dP = RM.donneesRapportMois({ ...base, B: Bp, benefice: BN.chiffreBenefice(Bp, 'lu'), brut: BN.chiffreBrut(Bp), bilan: BM.bilanDuMois({ ym, vendu, recu, depense: 42.5, benefice: BN.chiffreBenefice(Bp, 'lu'), B: Bp, meilleur, maintenant: MAINT }) });
  const PP = await lire(await RM.pdfRapportMois(dP, { PDFLib }));
  dit(/Bénéfice —/.test(PP.pages[0]) && PP.pages[0].includes(`brut au prix connu ${eur(31025)} · 9 sur 12`), 'bénéfice incomplet : « — », brut et « 9 sur 12 » à côté');
  dit(!/Bénéfice au moins|Marge au moins/.test(PP.tout + P.tout) && !PP.tout.includes(`au moins ${eur(31025)}`), 'jamais « au moins » devant un bénéfice');
  dit(PP.pages.slice(2).join(' ').includes('prix d’achat manquant pour 3 ventes'.replace('’', "'")), 'le manque du bénéfice NOMMÉ (3 ventes)');

  const dVide = RM.donneesRapportMois({ ...base, vendu: { lignes: [], manque: [], nonComptees: [] }, bilan: BM.bilanDuMois({ ym, vendu: { n: 0, eur: 0, manque: [] }, recu, maintenant: MAINT }) });
  const pan = dVide.cles.find((k) => k.cle === 'panier');
  dit(pan.valeur == null && pan.texte === '—', 'aucune vente : panier moyen « — », jamais 0,00 €', pan.texte);
  console.log('R5. Répartitions');
  const p2 = P.pages[1];
  dit(['Vinted', 'Leboncoin', 'eBay', 'Vestiaire'].every((x) => p2.includes(x)), 'les 4 plateformes du mois');
  const vin = plateformes.plateformes.find((x) => x.plat === 'Vinted');
  dit(p2.includes(`au moins ${eur(vin.vendu)}`), 'Vinted : le vendu de margeParPlateforme, « au moins » (compte pas lu)', eur(vin.vendu));
  const sComptes = dMicro.comptes.reduce((s, c) => s + Math.round(c.eur * 100), 0);
  dit(sComptes === venduC && dMicro.comptes[0].nom === 'shop_a', 'Σ comptes = vendu, le premier = celui qui a vendu le plus');
  dit(p2.includes('Par catégorie') && p2.includes('Sans catégorie'), 'catégories (statsParCategorie) et ventes sans catégorie dites');
  const dSansCat = RM.donneesRapportMois({ ...base, categories: undefined });
  dit(dSansCat.categories.etat === 'absent', 'catégories pas lues ⇒ section absente, rien deviné');

  console.log('R6. Top 10 par identité');
  dit(dMicro.top.length === 10 && dMicro.top.every((t, i, a) => i === 0 || a[i - 1].eur >= t.eur), '10 lignes, triées par montant');
  dit(dMicro.top[0].eur === 210 && dMicro.top[0].titre === 'Paire vc88', 'n°1 = Vestiaire 210 € et SON titre');
  const t9007 = dMicro.top.find((t) => t.eur === 55);
  dit(t9007 && t9007.titre === '' && !P.tout.includes('LEURRE'), 'vente sans relevé : aucun titre (jamais celui d’une autre vente au même montant)');
  dit(dMicro.top.every((t) => t.eur !== 999 && t.eur !== 888), 'aucune vente d’un autre mois');

  console.log('R7. URSSAF selon le régime CHOISI');
  dit(p3.includes('URSSAF') && p3.includes(eur(Math.round(recuMoisC * 0.124))) && p3.includes('12,4 %'), 'micro : CA déclaré et cotisations au taux');
  const dNull = RM.donneesRapportMois({ ...base, urssaf: { regime: null, regimeTexte: 'Statut pas encore choisi', taux: 12.4, ca: 1, apayer: 1 } });
  const PN = await lire(await RM.pdfRapportMois(dNull, { PDFLib }));
  dit(dNull.urssaf === null && !PN.tout.includes('URSSAF') && !PN.tout.includes('Cotisations'), 'régime pas choisi ⇒ section ABSENTE');
  const dPart = RM.donneesRapportMois({ ...base, urssaf: { regime: 'particulier', regimeTexte: 'Particulier', taux: 12.4, ca: 538.3, apayer: 66.75, raison: 'URSSAF non calculée : un particulier n’a rien à déclarer à l’URSSAF' } });
  const PPa = await lire(await RM.pdfRapportMois(dPart, { PDFLib }));
  dit(PPa.tout.includes('URSSAF non calculée') && !PPa.tout.includes('Cotisations estimées'), 'particulier ⇒ la raison, aucun montant');

  console.log('R8. Les manques NOMMÉS en fin');
  const fin = P.pages[P.pages.length - 1];
  dit(fin.includes('Ce qui manque'), 'section « Ce qui manque » sur la dernière page');
  dit(fin.includes('Ventes shop_c pas lues'), 'le compte pas lu');
  dit(fin.includes('1 vente Vestiaire (montant pas sûr)'), 'la vente au montant pas lu');
  dit(fin.includes('2 articles sans prix'), 'le stock sans prix');
  dit(fin.includes('1 achat au montant pas lu'), 'l’achat au montant pas lu');
  dit(fin.includes('1 vente du top 10 sans titre'), 'la vente du top sans titre (9008, 48 €, est 11e)');
  dit(p2.includes('Chaussures') && p2.includes('Vêtements'.normalize()) || p2.includes('Vetements'), 'les familles portent leur nom');

  console.log('R9. Jamais « encaissé », aucun pseudo d’acheteur');
  dit(!/encaiss/i.test(P.tout), 'aucun « encaissé »');
  dit(!P.tout.includes('acheteur_zz'), 'aucun pseudo d’acheteur');
  const srcTxt = fs.readFileSync(src, 'utf8').replace(/\/\/[^\n]*/g, '');
  dit(!/acheteur|buyer/i.test(srcTxt), 'le module ne lit aucun champ acheteur');

  console.log('R10. Le mois proposé');
  dit(RM.moisRapportParDefaut(MAINT) === '2026-10' && RM.moisRapportParDefaut(new Date(2026, 0, 3).getTime()) === '2025-12', 'défaut : le dernier mois BOUCLÉ');
  dit(RM.moisRapportChoix(MAINT).length === 13 && RM.moisRapportChoix(MAINT)[0] === '2026-11', '13 mois au choix, le plus récent d’abord');
  const dCours = RM.donneesRapportMois({ ...base, ym: '2026-11', bilan: BM.bilanDuMois({ ym: '2026-11', vendu: { n: 1, eur: 888, manque: [] }, recu: null, maintenant: MAINT, enCours: true }) });
  dit(dCours.enCours && dCours.jours.reduce((s, j) => s + j.vendu, 0) === 88800, 'mois en cours : arrêté à maintenant, dit « en cours »');
  dit(RM.donneesRapportMois({ ...base, ym: '2026-13' }) === null && RM.donneesRapportMois({ ...base, bilan: null }) === null, 'mois invalide ou bilan pas su ⇒ aucun rapport');

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
