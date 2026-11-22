// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LA RENTABILITÉ (21 nov., lot rentabilite — choix n° 36 et 41 de Julien)
//   36 « Ce que tu vends le mieux » (src/vendsMieux.js sur classementRapporte / quoiRacheter)
//   41 « Le coût réel de chaque vente » (src/coutReel.js sur beneficePaire / coutsVente, forfait d'emballage)
// Il EXÉCUTE les vraies règles sur une base INVENTÉE (le dépôt est public) et recompte chaque nombre par un code À PART.
//   A. coût réel : le net = la règle du bénéfice, au centime (2 000 tirages, 4 sites) ; la décomposition retombe sur le net ;
//      eBay : le port n'est JAMAIS compté (ni dans la ligne, ni dans le net, ni dans la règle de l'app) ; Vestiaire : la
//      commission lue n'est pas comptée deux fois ; un LOT : son prix d'achat entier, jamais divisé ; forfait d'emballage
//      éteint par défaut, l'emballage saisi passe devant ; « pas su » ⇒ null, jamais 0 ;
//   B. ce que tu vends le mieux : par axe, n · prix moyen · marge moyenne SUR les ventes au prix connu (« sur N ») · délai
//      médian sur les dates lues · taux de vente (une annonce une fois, sans date ⇒ dehors) ; tris ; « à racheter » =
//      meilleur score marge × vitesse avec 3 ventes reliées et datées ; ce qui a été regroupé est rendu ;
//   C. une source par chiffre : la vue ne calcule rien ; la normalisation du modèle n'entre dans aucune identité (aucun
//      module d'identité ne l'importe, le module n'écrit rien) ; le net des ventes connues d'Argent = nets − dépenses −
//      URSSAF de CES ventes (`beneficePeriode`), sa couverture nCout/n.
// Lancer : node scripts/audit-rentabilite.cjs [--mutation=<nom>]  (chaque mutation doit rougir)
//   mutations : port-ebay commission-vc forfait-defaut forfait-ecrase net-recopie lot min taux date-devinee identite connu ebay-app vue
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-rent-'));
fs.cpSync(path.join(R, 'src'), path.join(T, 'src'), { recursive: true, filter: (s) => !/\.(png|jpe?g|webp|mp4|onnx|woff2?)$/i.test(s) });
fs.writeFileSync(path.join(T, 'package.json'), '{"type":"module"}');
const MUTS = {
  'port-ebay': ['src/coutReel.js', "if (site === 'eBay') return { ...e, transportVendeur: '', commission: '' };", "if (site === 'eBay') return { ...e, commission: '' };"],
  'commission-vc': ['src/coutReel.js', "  if (site === 'Vestiaire') return { ...e, commission: '' };\n", ""],
  'forfait-defaut': ['src/beneficePaire.js', 'let FORFAIT_EMBALLAGE=null;', 'let FORFAIT_EMBALLAGE=80;'],
  'forfait-ecrase': ['src/beneficePaire.js', "const embVide=e?.emballage==null || String(e.emballage).trim()==='';", 'const embVide=true;'],
  'net-recopie': ['src/coutReel.js', 'Math.round(B.benefice * 100) : null;', '(base - (achat || 0)) : null;'],
  lot: ['src/vendsMieux.js', 'id: l.id, ts: l.ts, eur: l.eur, achat: l.achat,', 'id: l.id, ts: l.ts, eur: l.eur, achat: l.lot && l.achat != null ? l.achat / l.lot : l.achat,'],
  min: ['src/quoiRacheter.js', "!(g.n >= min) || !(g.nDelai >= min)", "!(g.n >= 1) || !(g.nDelai >= 1)"],
  taux: ['src/vendsMieux.js', "    const it = String(x.item); if (vu.has(it)) continue;\n", "    const it = String(x.item);\n"],
  'date-devinee': ['src/vendsMieux.js', "if (x.enLigne == null || !Number.isFinite(Number(x.enLigne))) { sansDate += 1; continue; }\n    if (!dans(x.enLigne)) continue;", "if (x.enLigne != null && !dans(x.enLigne)) continue;"],
  identite: ['src/repriseNumero.js', '', "import { vendsMieux } from './vendsMieux.js';\n"],
  connu: ['src/App.jsx', 'aPayerUrssaf(v.caCouvert, taux)', 'aPayerUrssaf(v.ca, taux)'],
  'ebay-app': ['src/App.jsx', "const fraisFicheAutres = (f, pl) => coutsVente(ficheDeLaRegle(pl, f)).total;", "const fraisFicheAutres = (f, pl) => chargesVente(f);"],
  vue: ['src/natif/ecrans/StatsVendsMieux.jsx', "const ordre = A ? A.ordre[tri]", "const ordre = A ? A.groupes.slice().sort((x, y) => y.n - x.n).map((g) => g.k).filter(() => true) && A.ordre[tri]"],
};
if (MUT) {
  const m = MUTS[MUT];
  if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  const f = path.join(T, m[0]); const s = fs.readFileSync(f, 'utf8');
  if (m[1] && !s.includes(m[1])) { console.log('❌ mutation impossible : motif absent — ' + m[1].slice(0, 90)); process.exit(2); }
  fs.writeFileSync(f, m[1] ? s.replace(m[1], m[2]) : m[2] + s);
  console.log('… mutation « ' + MUT + ' » posée');
}
const imp = (f) => import(pathToFileURL(path.join(T, f)).href).catch((e) => { dit(false, `${f} se charge`, String(e.message).slice(0, 160)); return {}; });
const sansCommentaires = (f) => fs.readFileSync(path.join(T, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// Un tirage pseudo-aléatoire reproductible.
let graine = 20261121;
const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
const choisir = (xs) => xs[Math.floor(hasard() * xs.length)];
const montantTxt = () => { const r = hasard(); if (r < 0.25) return ''; if (r < 0.3) return '0'; const c = Math.floor(hasard() * 9000); return (c / 100).toFixed(choisir([0, 2])).replace('.', choisir(['.', ','])); };
const c = (v) => { if (v == null || String(v).trim() === '') return null; const s = String(v).trim().replace(',', '.'); if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(s)) return null; const [a, b = ''] = s.split('.'); return Number(a) * 100 + Number(b.padEnd(2, '0')); };

(async () => {
  const BP = await imp('src/beneficePaire.js');
  const CR = await imp('src/coutReel.js');
  const VM = await imp('src/vendsMieux.js');
  const CQ = await imp('src/ceQuiRapporte.js');

  // ── A. LE COÛT RÉEL ──────────────────────────────────────────────────────
  console.log('── A. Le coût réel de chaque vente');
  dit(BP.forfaitEmballagePose && BP.forfaitEmballagePose() === null && BP.coutsVente({ fees: '2' }).cents === 200, 'A0 le forfait d’emballage est ÉTEINT par défaut (rien de posé ⇒ aucun frais en plus)');
  let ecarts = [], decomp = [], n = 0;
  for (const forfait of [null, { actif: true, montant: '0,80' }]) {
    BP.poserForfaitEmballage(forfait);
    const F = forfait ? 80 : 0;
    for (let i = 0; i < 1000; i++) {
      const site = choisir(['Vinted', 'Leboncoin', 'eBay', 'Vestiaire']);
      const fiche = { buyPrice: hasard() < 0.15 ? '' : montantTxt() || '25', fees: montantTxt(), transportVendeur: montantTxt(), commission: montantTxt(), emballage: montantTxt(), remboursement: hasard() < 0.8 ? '' : montantTxt(), autresFrais: hasard() < 0.8 ? '' : montantTxt(), fraisComplets: hasard() < 0.5 };
      const prix = (10 + Math.floor(hasard() * 20000) / 100).toFixed(2);
      const com = site === 'eBay' || site === 'Vestiaire' ? (hasard() < 0.15 ? null : Math.floor(hasard() * Math.min(1500, c(prix)))) : null;
      const recu = site === 'eBay' ? (com == null ? null : c(prix) - com) : site === 'Vestiaire' ? (hasard() < 0.1 ? null : c(prix) - (com ?? 1000)) : null;
      const r = CR.coutReelVente({ plateforme: site, prix, recu, fiche, commissionLue: com });
      n += 1;
      // LE RECOMPTE À PART : la base de la règle du site, puis vente − achat − frais comptés par la règle (§2.8 : eBay ne compte
      // ni port ni boost ni frais notés ; Vestiaire, pas la commission notée).
      const base = site === 'eBay' || site === 'Vestiaire' ? recu : c(prix);
      const achat = c(fiche.buyPrice);
      const champs = site === 'eBay' ? ['fees', 'remboursement', 'autresFrais', 'emballage'] : site === 'Vestiaire' ? ['fees', 'transportVendeur', 'remboursement', 'autresFrais', 'emballage'] : ['fees', 'transportVendeur', 'commission', 'remboursement', 'autresFrais', 'emballage'];
      let frais = 0, lisible = true;
      for (const k of champs) { const v = fiche[k]; if (v == null || String(v).trim() === '') continue; const x = c(v); if (x == null) lisible = false; else frais += x; }
      const embVide = fiche.emballage == null || String(fiche.emballage).trim() === '';
      if (embVide) frais += F;
      const attendu = base == null || achat == null || !lisible ? null : base - achat - frais;
      if (r.net !== attendu) ecarts.push({ site, prix, fiche, com, recu, net: r.net, attendu });
      // La décomposition : vente − Σ lignes − achat retombe sur le net quand tout est su.
      if (r.net != null && r.lignes.every((l) => l.c != null)) {
        const somme = r.lignes.filter((l) => !['vente', 'achat'].includes(l.cle)).reduce((t, l) => t + l.c, 0);
        const v = r.lignes.find((l) => l.cle === 'vente').c, a = r.lignes.find((l) => l.cle === 'achat').c;
        if (v - somme - a !== r.net) decomp.push({ site, v, somme, a, net: r.net, l: r.lignes });
      }
    }
  }
  BP.poserForfaitEmballage(null);
  dit(ecarts.length === 0, `A1 ${n} ventes tirées (4 sites, forfait éteint puis allumé) : le net = la règle du bénéfice recomptée à part, au centime`, ecarts.slice(0, 2));
  dit(decomp.length === 0, 'A2 vente − commission − boost − emballage − port − autres − achat = le net (quand chaque ligne est sue)', decomp.slice(0, 2));
  // eBay : le port n'est jamais compté.
  const eb = CR.coutReelVente({ plateforme: 'eBay', prix: '100', recu: 8800, commissionLue: 1200, fiche: { buyPrice: '50', transportVendeur: '9', fees: '3', emballage: '' } });
  const portEb = eb.lignes.find((l) => l.cle === 'port');
  dit(eb.net === 3500 && portEb && portEb.c === 0 && portEb.src === 'ebay', 'A3 eBay : le port noté (9 €) n’est ni une charge ni dans le net (§2.8) — net = reçu 88 € − boost noté 3 € − achat 50 €', eb);
  const app = sansCommentaires('src/App.jsx');
  dit(/const fraisFicheAutres = \(f, pl\) => coutsVente\(ficheDeLaRegle\(pl, f\)\)\.total;/.test(app) && /for \(const li of lignes\) fr \+= fraisDuNum\(numEbayLigne\(o, li\), 'eBay'\);/.test(app),
    'A3b la règle du bénéfice de l’app compte eBay par `ficheDeLaRegle` (jamais le port), ligne par ligne');
  const BA = await imp('src/beneficeArticle.js');
  const fa = BA.beneficeArticle ? BA.beneficeArticle({ plateforme: 'eBay', vente: '100', recu: 88, entree: { buyPrice: '50', transportVendeur: '9', fees: '3', fraisComplets: true } }) : null;
  dit(fa && fa.benefice === 3500, 'A3c la fiche de l’article (beneficeArticle) : le même net eBay, port jamais compté (une seule règle)', fa);
  // Vestiaire : la commission lue n'est pas comptée deux fois.
  const vc = CR.coutReelVente({ plateforme: 'Vestiaire', prix: '120', recu: 10000, commissionLue: 2000, fiche: { buyPrice: '50', commission: '5' } });
  dit(vc.net === 5000 && vc.lignes.find((l) => l.cle === 'commission').c === 2000, 'A4 Vestiaire : net = versé 100 € − achat 50 € ; la commission lue (20 €) est dite, la commission notée n’est pas recomptée', vc);
  const vc2 = CR.coutReelVente({ plateforme: 'Vestiaire', prix: '', recu: 10000, commissionLue: null, fiche: { buyPrice: '50' } });
  dit(vc2.net === 5000 && vc2.lignes.find((l) => l.cle === 'commission').src === 'pasLu', 'A4b Vestiaire sans prix affiché : commission « pas lue » (dite), le net reste celui du versé (la règle)', vc2);
  // Un lot : le prix d'achat entier.
  const lot = CR.coutReelVente({ plateforme: 'Vinted', prix: '150', fiche: { buyPrice: '60', fraisComplets: true } });
  dit(lot.net === 9000, 'A5 un LOT acheté 60 € : le net retire les 60 € entiers (jamais 30 € « par paire »)', lot);
  // Pas su ⇒ null, jamais 0.
  const ps = CR.coutReelVente({ plateforme: 'Vinted', prix: '60', fiche: { buyPrice: '' } });
  const pe = CR.coutReelVente({ plateforme: 'eBay', prix: '60', recu: null, commissionLue: null, fiche: { buyPrice: '20' } });
  dit(ps.net === null && ps.etat === 'achat' && pe.net === null && pe.etat === 'commission' && pe.lignes.find((l) => l.cle === 'commission').c === null,
    'A6 prix d’achat manquant ⇒ net « — » (achat) ; frais eBay pas lus ⇒ net « — » (commission), jamais 0', { ps, pe });
  const bo = CR.coutReelVente({ plateforme: 'Vinted', prix: '60', fiche: { buyPrice: '20' } });
  dit(bo.lignes.find((l) => l.cle === 'boost').c === null && bo.lignes.find((l) => l.cle === 'boost').src === 'aucun' && bo.etat === 'partiel' && bo.net === 4000,
    'A7 un boost jamais noté est dit « pas noté » (null), le net est un plafond (« au plus ») — jamais un boost deviné', bo);
  // Le forfait.
  const sans = BP.coutsVente({ fees: '2' }).cents;
  BP.poserForfaitEmballage({ actif: true, montant: '0,80' });
  const avec = BP.coutsVente({ fees: '2' }).cents, saisiPasse = BP.coutsVente({ fees: '2', emballage: '1,50' }).cents;
  BP.poserForfaitEmballage({ actif: true, montant: 'abc' }); const illisible = BP.forfaitEmballagePose();
  BP.poserForfaitEmballage({ actif: false, montant: '0,80' }); const eteint = BP.forfaitEmballagePose();
  BP.poserForfaitEmballage(null);
  dit(sans === 200 && avec === 280 && saisiPasse === 350 && illisible === null && eteint === null,
    'A8 forfait : éteint ⇒ rien ; allumé (0,80 €) ⇒ + 0,80 € sur une vente sans emballage ; un emballage saisi (1,50 €) passe devant ; illisible ⇒ rien', { sans, avec, saisiPasse, illisible, eteint });

  // ── B. CE QUE TU VENDS LE MIEUX ──────────────────────────────────────────
  console.log('── B. Ce que tu vends le mieux');
  const J = 86400000, de = Date.UTC(2026, 9, 23), a = de + 30 * J;
  // Les ventes inventées : 4 modèles. Dunk : 6 reliées, rapides, rentables ; Samba : 4 reliées, lentes ; 550 : 2 ventes très
  // rentables (trop peu) ; Kayano : 3 reliées dont un LOT au prix entier ; des ventes sans prix d'achat ; une sans date en ligne.
  const L = [];
  const pousse = (titre, marque, taille, eur, achat, joursEnLigne, k, extra = {}) => L.push({ plateforme: 'Vinted', id: 'tx' + L.length, ts: de + (k + 1) * J, eur, achat, titre, marqueLue: marque, taille,
    modele: CQ.modeleSur(marque, titre), enLigne: joursEnLigne == null ? null : de + (k + 1) * J - joursEnLigne * J, item: 'it' + L.length, ...extra });
  ['Nike Dunk Low Panda', 'Dunk low panda 42', 'NIKE DUNK LOW', 'Nike Dunk Low Retro', 'Dunk Low', 'Nike Dunk Low Grey'].forEach((t, i) => pousse(t, 'Nike', i % 2 ? '42' : '43', 80, 40, 3 + i, i));
  pousse('Nike Dunk Low', 'Nike', '42', 90, null, 2, 7);
  ['Adidas Samba OG', 'Samba OG blanche', 'adidas samba', 'Samba'].forEach((t, i) => pousse(t, 'Adidas', '42', 70, 35, 20 + i * 5, 8 + i));
  ['New Balance 550 blanche', 'NB 550 vert'].forEach((t, i) => pousse(t, 'New Balance', '44', 200, 20, 1, 13 + i));
  pousse('Asics Gel Kayano 14', 'Asics', '41', 120, 60, 10, 16, { lot: 2 });
  pousse('Asics Gel-Kayano 14 argent', 'Asics', '41', 60, 30, 12, 17);
  pousse('Gel kayano 14', 'Asics', '41', 60, 30, null, 18);
  pousse('Chaussures de marche', '', '40', 25, null, 5, 19);
  const annonces = [
    { item: 'a1', enLigne: de + 2 * J, marque: 'Nike', taille: '42', titre: 'Nike Dunk Low noire' },
    { item: 'a2', enLigne: de + 3 * J, marque: 'Nike', taille: '43', titre: 'Dunk Low' },
    { item: 'a3', enLigne: null, marque: 'Nike', taille: '43', titre: 'Dunk Low sans date' },
    { item: 'it6', enLigne: de + 6 * J, marque: 'Nike', taille: '42', titre: 'Nike Dunk Low' },                // déjà vendue : une seule fois
    { item: 'a4', enLigne: de - 40 * J, marque: 'Adidas', taille: '42', titre: 'Samba' },                      // avant la période
  ];
  const M = VM.vendsMieux ? VM.vendsMieux({ lignes: L, annonces, de, a }) : null;
  const A = M && M.modele;
  const g = (k) => (A ? A.groupes.find((x) => x.nom === k) : null);
  const dunk = g('Nike Dunk'), samba = g('Adidas Samba'), nb = g('New Balance 550'), kay = g('Asics Gel-Kayano');
  // Recompte à part.
  const rec = (nom) => {
    const ls = L.filter((l) => l.modele && l.modele.nom === nom);
    const rel = ls.filter((l) => l.achat != null);
    const ds = ls.filter((l) => l.enLigne != null).map((l) => (l.ts - l.enLigne) / J).sort((x, y) => x - y);
    const med = ds.length ? (ds.length % 2 ? ds[(ds.length - 1) / 2] : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2) : null;
    return { n: ls.length, nCout: rel.length, prix: Math.round(ls.reduce((t, l) => t + l.eur * 100, 0) / ls.length) / 100,
      moyen: rel.length ? Math.round(rel.reduce((t, l) => t + (l.eur - l.achat) * 100, 0) / rel.length) / 100 : null, med: med == null ? null : Math.round(med * 10) / 10 };
  };
  const rd = rec('Nike Dunk');
  dit(dunk && dunk.n === rd.n && dunk.nCout === rd.nCout && dunk.prixMoyen === rd.prix && dunk.moyen === rd.moyen && dunk.mediane === rd.med,
    `B1 Dunk : ${rd.n} vendues, prix moyen ${rd.prix} €, marge moyenne ${rd.moyen} € SUR ${rd.nCout} ventes au prix connu, délai médian ${rd.med} j — recomptés à part`, { vue: dunk, attendu: rd });
  const rk = rec('Asics Gel-Kayano');
  dit(kay && kay.moyen === rk.moyen && kay.moyen === 40 && kay.nDelai === 2,
    'B2 un LOT (Kayano acheté 60 € pour 2) : son prix d’achat est pris entier, jamais divisé ; la vente sans date en ligne sort du délai (2 datées sur 3)', { kay, rk });
  dit(A && A.n === L.length && A.nCout === L.filter((l) => l.achat != null).length, `B3 couverture exacte : marge sur ${A && A.nCout} des ${A && A.n} ventes`, A && { n: A.n, nCout: A.nCout });
  // Taux de vente : Dunk mises en ligne dans la période = 7 vendues (toutes datées dans la période) + a1 + a2 (a3 sans date, it0 déjà comptée).
  const dunkMises = L.filter((l) => l.modele && l.modele.nom === 'Nike Dunk' && l.enLigne != null && l.enLigne >= de && l.enLigne < a).length;
  const venduesMises = dunkMises;
  const misesAttendu = dunkMises + 2;
  const dateesAttendu = L.filter((l) => l.enLigne != null && l.enLigne >= de && l.enLigne < a).length + 2;
  dit(dunk && dunk.mises === misesAttendu && dunk.taux === Math.round((venduesMises / misesAttendu) * 100) && A.taux && A.taux.sansDate === 1 && A.taux.datees === dateesAttendu,
    `B4 taux de vente Dunk : ${venduesMises} vendues sur ${misesAttendu} mises en ligne dans la période (une annonce vendue comptée une fois, une annonce sans date dehors, dite)`, { dunk, taux: A && A.taux });
  // Tris.
  const ordreMarge = A ? A.ordre.marge.map((k) => A.groupes.find((x) => x.k === k).nom) : [];
  const ordreVite = A ? A.ordre.vitesse.map((k) => A.groupes.find((x) => x.k === k).nom) : [];
  const ordreVol = A ? A.ordre.volume.map((k) => A.groupes.find((x) => x.k === k).nom) : [];
  dit(ordreMarge[0] === 'New Balance 550' && ordreVite[0] === 'New Balance 550' && ordreVol[0] === 'Nike Dunk' && ordreVite.indexOf('Adidas Samba') === ordreVite.length - 1,
    'B5 trois tris : marge (550 en tête), vitesse (550 puis… Samba en dernier), volume (Dunk en tête)', { ordreMarge, ordreVite, ordreVol });
  // À racheter : le meilleur score marge × vitesse, 3 ventes reliées et datées au moins ; la 550 (2 ventes) ne l'est pas.
  const rach = A ? A.aRacheter.map((x) => x.nom) : [];
  const sDunk = Math.round((40 / Math.max(1, rd.med)) * 100) / 100;
  dit(rach[0] === 'Nike Dunk' && !rach.includes('New Balance 550') && A.aRacheter[0].score === Math.round((dunk.moyen / Math.max(1, (() => { const ds = L.filter((l) => l.modele && l.modele.nom === 'Nike Dunk' && l.achat != null && l.enLigne != null).map((l) => (l.ts - l.enLigne) / J).sort((x, y) => x - y); return ds.length % 2 ? ds[(ds.length - 1) / 2] : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2; })())) * 100) / 100,
    `B6 « à racheter en priorité » : Dunk en tête (score ≈ ${sDunk} € / jour), la 550 (2 ventes, très rentable) n’est pas conclue`, A && A.aRacheter);
  dit(rach.includes('Adidas Samba') ? rach.indexOf('Adidas Samba') > rach.indexOf('Nike Dunk') : true, 'B6b la Samba (lente) passe après la Dunk', rach);
  // Ce qui a été regroupé.
  const rg = A ? A.regroupes.find((r) => r.nom === 'Nike Dunk') : null;
  dit(rg && rg.variantes === 7 && rg.titres.length === 6 && rg.reste === 1 && A.autres.n === 1, 'B7 « ce qui a été regroupé » : les 7 écritures de la Dunk (6 montrées, « et 1 autre »), la vente non reconnue dans « Autres » (1)', { rg, autres: A && A.autres });
  const Mt = M && M.taille, Mm = M && M.marque, Mx = M && M.modeleTaille;
  dit(Mt && Mm && Mx && Mm.groupes.find((x) => x.nom === 'Nike').n === 7 && Mt.groupes.find((x) => x.nom === '42').n === L.filter((l) => l.taille === '42').length && Mx.groupes.some((x) => x.nom === 'Nike Dunk · 42'),
    'B8 les axes marque, taille et modèle × taille, sur les MÊMES ventes', Mm && Mm.groupes.map((x) => x.nom + ':' + x.n));
  dit(VM.vendsMieux({ lignes: null }) === null && VM.vendsMieux({ lignes: undefined }) === undefined, 'B9 relevé pas lu ⇒ null (« — »), en lecture ⇒ undefined — jamais une liste vide');

  // ── C. UNE SOURCE PAR CHIFFRE, AUCUNE IDENTITÉ ───────────────────────────
  console.log('── C. Une source, aucune identité');
  const vue = sansCommentaires('src/natif/ecrans/StatsVendsMieux.jsx');
  dit(!/\.reduce\(|\.sort\(|Math\.(round|max|min)\([^)]*\/|ceQuiRapporte|quoiRacheter|statsVentes/.test(vue), 'C1 la vue ne trie ni ne calcule : l’ordre de chaque tri vient du modèle (src/vendsMieux.js)');
  const cr = sansCommentaires('src/coutReel.js');
  dit(/import \{[^}]*beneficePaire[^}]*\} from '\.\/beneficePaire\.js'/.test(cr) && /beneficePaire\(String\(base \/ 100\), ficheRegle\)/.test(cr), 'C2 le net d’une vente est la règle du bénéfice (`beneficePaire`), jamais recopiée');
  // Qui importe vendsMieux.js (et donc la normalisation du modèle pour ce classement) ?
  const tous = [];
  const parcourir = (d) => { for (const x of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, x.name); if (x.isDirectory()) parcourir(p); else if (/\.(jsx?|cjs|mjs)$/.test(x.name)) tous.push(p); } };
  parcourir(path.join(T, 'src'));
  const importeurs = tous.filter((p) => /from ['"][./]+[^'"]*vendsMieux\.js['"]/.test(fs.readFileSync(p, 'utf8'))).map((p) => path.relative(T, p)).sort();
  dit(importeurs.join() === ['src/aujourdhui/pilotage.js', 'src/natif/ecrans/StatsVendsMieux.jsx'].join(), 'C3 la normalisation du modèle n’entre dans aucune identité : vendsMieux.js n’est importé que par les statistiques', importeurs);
  const vm = sansCommentaires('src/vendsMieux.js');
  dit(!/localStorage|\bsave\(|fetch\(|modifierCle|withOwner|numero|buyFromId/.test(vm), 'C4 vendsMieux.js n’écrit rien, ne pose aucun N° ni aucun lien d’achat');
  const ident = ['src/repriseNumero.js', 'src/prixAchatRecu.js', 'src/retraitPreuves.js'].filter((f) => fs.existsSync(path.join(T, f)));
  dit(ident.length === 3 && ident.every((f) => !/vendsMieux|modeleSur|classementRapporte/.test(fs.readFileSync(path.join(T, f), 'utf8'))), 'C5 les règles d’identité (reprise du N°, prix du reçu, retraits) n’utilisent pas le modèle normalisé', ident);
  dit(/const cotisConnu = !urssaf \? 0 : aPayerUrssaf\(v\.caCouvert, taux\);/.test(app) && /const netConnu = v\.nCout > 0 && v\.net != null && cotisConnu != null && !rien \? Math\.round\(\(v\.net - charges - cotisConnu\) \* 100\) \/ 100 : null;/.test(app),
    'C6 Argent : bénéfice des ventes connues = Σ nets connus − dépenses du mois − URSSAF de CES ventes (`beneficePeriode`), couverture nCout/n');
  const argent = sansCommentaires('src/ecrans/Compta.jsx');
  dit(/Bn\.netConnu != null \? Bn\.netConnu : null/.test(argent) && /'data-arg-net-connu': B\.connu \? `\$\{B\.nCout\}\/\$\{B\.n\}`/.test(sansCommentaires('src/natif/ecrans/ArgentMois.jsx')),
    'C7 Argent › Mois lit ce net tel quel (aucun calcul) et porte sa couverture (k/n)');

  // Les libellés appelés par clé composée (`tr('cr.' + l.cle)`, `tr('rt.axe.' + x)`) : audit-traduction ne les voit pas.
  const fr = fs.readFileSync(path.join(T, 'src/i18n/langues/fr/rentabilite.js'), 'utf8');
  const cles = [...['commission', 'boost', 'emballage', 'port', 'autres'].map((k) => 'cr.' + k), ...VM.AXES_MIEUX.map((k) => 'rt.axe.' + k), ...VM.TRIS_MIEUX.map((k) => 'rt.tri.' + k)];
  const manque = cles.filter((k) => !fr.includes(`"${k}"`));
  dit(!manque.length, 'C8 chaque libellé appelé par clé composée existe en français (aucun « cr.emballage » à l’écran)', manque);

  console.log(`\n${ko ? '❌' : '✅'} audit-rentabilite : ${ok} verts, ${ko} rouge(s)${MUT ? ' (mutation « ' + MUT + ' »)' : ''}`);
  try { fs.rmSync(T, { recursive: true, force: true }); } catch (_) {}
  process.exit(ko ? 1 : 0);
})();
