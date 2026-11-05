// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « BÉNÉFICE » = UNE RÈGLE SUR TOUS LES ÉCRANS (3 novembre)
//         node scripts/audit-benefice-unique.cjs [--mutation=stats|journee|recap|vestiaire|aumoins|ventes|urssaf-decl|rien|tableau|marge|libelle]
// ═══════════════════════════════════════════════════════════════════════════
// Constat d'une critique, sur les MÊMES données de banc : le bénéfice du mois
// valait « — » dans Ma journée, 103 € dans Statistiques et 80,93 € dans
// Comptabilité. Trois notions portaient le même nom (src/beneficeNoms.js) :
// Statistiques sommait le BRUT (vente − achat, « au moins » sur un partiel),
// Ma journée glissait au brut partiel quand le net ne se calculait pas, le récap
// mensuel écrivait « — » en dur, Ventes appelait « Bénéfice » le brut.
//
// Cet audit EXÉCUTE les vraies fonctions d'App.jsx (extraites, dans un vm) et le
// module `src/beneficeNoms.js` sur des ventes INVENTÉES (le dépôt est public),
// puis calcule le bénéfice du mois TEL QUE CHAQUE ÉCRAN L'AFFICHE. Le chemin de
// chaque écran est LU dans son code (quelle fonction donne le chiffre posé sous
// « Bénéfice ») : un écran qui repasse au brut, au « — » en dur ou à un second
// calcul change de chemin, et ses nombres divergent. Il exige :
//   1. la même valeur (ou le même « — ») partout où le libellé est « Bénéfice »
//      — Ma journée, Statistiques (mois), Comptabilité, le récap mensuel ;
//   2. cette valeur = celle calculée ICI à la main depuis les ventes inventées
//      (ventes − prix d'achat − frais − dépenses − URSSAF DES MÊMES VENTES) ;
//      (3 nov., Julien : « Bénéfice du mois −5 € — je ne comprends pas du
//      tout ») l'URSSAF retirée du bénéfice est le taux × le montant des ventes
//      que CE bénéfice compte — jamais celle du CA déclaré du mois (daté au
//      versement : un autre ensemble de ventes). Aucune vente comptée et aucune
//      dépense ⇒ « — » (rien à calculer), jamais 0 ni un négatif ; un négatif
//      n'existe que s'il est réel (vente à perte, dépenses) ;
//   3. « — » seulement quand la règle dit « pas su » (prix d'achat manquant,
//      frais eBay pas lus) ;
//   4. les autres notions ont d'autres noms (Ventes, tuile de la semaine) et un
//      brut partiel ne se dit jamais « au moins ».
// Cas : tout connu · un prix d'achat manquant · frais eBay pas lus · vente
// Vestiaire au montant sûr / pas sûr · vente à cheval sur deux mois (vendue en
// octobre, versée en novembre) · compte exclu · aucune vente du mois ·
// (3 nov.) mois sans vente avec le versement d'une vente d'octobre (« — ») ·
// ventes et versements croisés · vente à perte réelle · dépenses seules.
// `--mutation=…` réaffaiblit une règle dans une copie du source : rouge exigé.
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
let APP = lire('src/App.jsx');
let MODULE = lire('src/beneficeNoms.js');
const muter = (quoi, avant, apres) => {
  const s = quoi === 'module' ? MODULE : APP;
  if (!s.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 80)); process.exit(2); }
  if (quoi === 'module') MODULE = s.replace(avant, apres); else APP = s.replace(avant, apres);
};
if (MUT === 'stats') muter('app', 'const CB = chiffreBenefice(BP, etatBP);', 'const CB = chiffreBrut(B);');
else if (MUT === 'journee') muter('app', 'const CB = chiffreBenefice(B, etat);', 'const CB = chiffreBrut(B);');
else if (MUT === 'recap') muter('app', 'profit: beneficeDuMois(m.ym)', 'profit: null');
else if (MUT === 'vestiaire') muter('app', "['Vinted', 'Leboncoin', 'eBay', 'Vestiaire'].reduce(", "['Vinted', 'Leboncoin', 'eBay'].reduce(");
else if (MUT === 'aumoins') muter('app', ": `vente − prix d’achat, sur ${pl(B.n, 'vente finalisée', 'ventes finalisées')}`;\n      return tuile('benefice', NOM_BENEFICE_BRUT, R.valeur == null ? '—' : fmt(R.valeur)", ": `vente − prix d’achat, sur ${pl(B.n, 'vente finalisée', 'ventes finalisées')}`;\n      return tuile('benefice', NOM_BENEFICE_BRUT, R.valeur == null ? '—' : `${R.partiel ? 'au moins ' : ''}${fmt(R.valeur)}`");
else if (MUT === 'ventes') muter('app', '<StatBox compact label={NOM_APRES_FRAIS}', '<StatBox compact label="Bénéfice net"');
// (3 nov.) L'URSSAF du bénéfice reprise sur le CA DÉCLARÉ du mois (la règle d'avant).
else if (MUT === 'urssaf-decl') muter('app', 'const cotis = !urssaf ? 0 : aPayerUrssaf(v.ca, taux);', 'const cotis = !urssaf ? 0 : caDecl == null ? null : aPayerUrssaf(caDecl, taux);');
// (3 nov.) « Rien à calculer » oublié : un mois vide redit 0 € (ou −URSSAF).
else if (MUT === 'rien') muter('app', 'const rien = v.n === 0 && !(Math.round(charges * 100) > 0);', 'const rien = false;');
// (3 nov.) Statistiques → « L'argent depuis le début » : la cellule Bénéfice repasse au brut,
// la marge au brut ÷ ventes, ou l'ancien libellé « Bénéfice estimé » revient.
else if (MUT === 'tableau') muter('app', 'const CBa = chiffreBenefice(BPa, etatBPa);', 'const CBa = chiffreBrut(BPa);');
else if (MUT === 'marge') muter('app', 'Math.round((CBa.valeur / BPa.ca) * 1000) / 10', 'Math.round((BPa.brut / BPa.ca) * 1000) / 10');
else if (MUT === 'libelle') muter('app', '[[NOM_BENEFICE, CBa.valeur==null', "[['Bénéfice estimé', CBa.valeur==null");
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
function extraire(src, nom) {
  const m = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}

(async () => {
  console.log('── La règle : les vraies fonctions d’App.jsx et src/beneficeNoms.js');
  // Le module, chargé depuis une copie (une mutation peut le toucher).
  let N = null;
  if (MODULE) {
    const tmp = path.join(require('os').tmpdir(), `benefice-noms-${process.pid}.mjs`);
    fs.writeFileSync(tmp, MODULE);
    try { N = await import('file://' + tmp); } catch (e) { dit(false, 'src/beneficeNoms.js se charge', e.message); }
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
  dit(!!N && N.NOM_BENEFICE === 'Bénéfice' && N.NOM_BENEFICE_BRUT !== N.NOM_BENEFICE && N.NOM_APRES_FRAIS !== N.NOM_BENEFICE && !/^Bénéfice$/.test(N.NOM_APRES_FRAIS),
    'trois notions, trois noms distincts (src/beneficeNoms.js)', N ? JSON.stringify(N.NOMS_BENEFICE) : 'module absent');

  const NOMS = ['BENEF_CHAMPS', 'beneficeVide', 'ajouterVenteBenefice', 'jourBeneficeEnTableau', 'cumulerBenefice', 'resumeBenefice', 'jourClef', 'beneficeDesJours',
    'ymCourant', 'debutPeriode', 'decalerPeriode', 'MOIS_COMPTA', 'libellePeriodeCa', 'echeancesAbonnement', 'chargeAbonnement', 'comptaChargesMois', 'comptaChargesAnnee',
    'caVintedDuMois', 'caBeneficeDuMois', 'aPayerUrssaf', 'depensesEtat', 'beneficePeriode'];
  const ctx = { Date, Math, Number, String, Object, Array, JSON, isFinite, parseFloat, isNaN, tauxUrssaf: () => 12.4, console };
  vm.createContext(ctx);
  const absents = [];
  for (const n of NOMS) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' (' + e.message + ')'); } }
  dit(!absents.length, 'les fonctions du bénéfice se lisent dans App.jsx', absents.join(', '));
  if (absents.length) { console.log(`\n❌ benefice-unique : ${ko} rouge(s)`); process.exit(1); }
  // Code d'avant (module absent) : on MESURE quand même ce que chaque écran
  // affiche — la règle de Comptabilité y est `B.netFinal` telle quelle. Les
  // rouges qui suivent sont des nombres, pas « la fonction n'existait pas ».
  if (!N) N = { chiffreBenefice: (B) => ({ valeur: B ? B.netFinal : null }), chiffreBrut: (r) => ({ valeur: r && r.nCout > 0 ? r.brut : (r && r.n === 0 ? 0 : null), partiel: !!r && r.nCout < r.n }),
    finDuMois: (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 1).getTime() - 1; }, absent: true };

  // ── Les ventes inventées ────────────────────────────────────────────────
  // Réf. : le 20 novembre 2026, 12 h (heure de l'appareil).
  const MAINTENANT = new Date(2026, 10, 20, 12).getTime();
  const J = (m, j, h = 12) => new Date(2026, m, j, h).getTime();
  // plateforme, compte, vente, versement (CA déclaré), €, achat (null = inconnu), frais (null = pas su), sur (Vestiaire)
  const BASE = [
    { id: 'v1', p: 'Vinted', compte: 'A', vente: J(10, 3), verse: J(10, 6), eur: 60, achat: 20, frais: 2 },
    { id: 'v2', p: 'Vinted', compte: 'A', vente: J(9, 28), verse: J(10, 2), eur: 50, achat: 15, frais: 0 },   // à cheval : vendue en octobre, versée en novembre
    { id: 'v3', p: 'Vinted', compte: 'X', vente: J(10, 5), verse: J(10, 8), eur: 99, achat: 10, frais: 0, exclu: true },
    { id: 'v4', p: 'Leboncoin', compte: 'L', vente: J(10, 7), verse: J(10, 7), eur: 40, achat: 18, frais: 0 },
    { id: 'v5', p: 'Vestiaire', compte: 'V', vente: J(10, 9), verse: J(10, 12), eur: 70, achat: 30, frais: 0, sur: true },
    { id: 'v6', p: 'Vestiaire', compte: 'V', vente: J(10, 10), verse: null, eur: 65, achat: 25, frais: 0, sur: false },  // montant pas sûr : hors de tout
  ];
  const COMPTA = { depenses: [{ id: 'd1', date: '2026-11-04', montant: 5 }], fixes: [{ id: 'f1', label: 'Local inventé', montant: 10 }], packs: [], abonnements: [] };
  const CAS = [
    { nom: 'tout connu', ventes: BASE },
    { nom: 'un prix d’achat manquant', ventes: BASE.map((v) => v.id === 'v1' ? { ...v, achat: null } : v) },
    { nom: 'frais eBay pas lus', ventes: [...BASE, { id: 'e1', p: 'eBay', compte: 'E', vente: J(10, 11), verse: J(10, 11), eur: 80, achat: 25, frais: null }] },
    // (3 nov.) Dépenses seules (et un versement d'octobre) : le négatif permis = −les dépenses, sans URSSAF.
    { nom: 'aucune vente du mois, un versement à cheval, des dépenses', ventes: BASE.filter((v) => v.id === 'v2'), negatif: 'permis', exact: -15 },
    { nom: 'sans dépenses notées', ventes: BASE, compta: {} },
    // (3 nov.) LE CAS DE JULIEN : aucune vente comptée en novembre, une vente
    // d'octobre versée le 2 novembre (38 €), aucune dépense ⇒ « — », jamais −4,71 €.
    { nom: 'mois sans vente, versement d’une vente d’octobre, sans dépenses', ventes: [{ id: 'j1', p: 'Vinted', compte: 'A', vente: J(9, 29), verse: J(10, 2), eur: 38, achat: 12, frais: 0 }], compta: {}, negatif: 'jamais', tiret: 'rien' },
    { nom: 'idem, « je n’ai pas de dépenses » répondu', ventes: [{ id: 'j1', p: 'Vinted', compte: 'A', vente: J(9, 29), verse: J(10, 2), eur: 38, achat: 12, frais: 0 }], compta: { depenses: [], fixes: [], packs: [], abonnements: [], sansDepenses: { at: 1 } }, negatif: 'jamais', tiret: 'rien' },
    // (3 nov.) Croisés : une vente d'octobre versée en novembre ET une vente de novembre pas encore versée.
    { nom: 'ventes et versements croisés', ventes: [
      { id: 'c1', p: 'Vinted', compte: 'A', vente: J(9, 30), verse: J(10, 3), eur: 200, achat: 50, frais: 0 },
      { id: 'c2', p: 'Vinted', compte: 'A', vente: J(10, 15), verse: null, eur: 40, achat: 10, frais: 1 },
      { id: 'c3', p: 'Leboncoin', compte: 'L', vente: J(10, 16), verse: J(10, 16), eur: 25, achat: 5, frais: 0 },
    ], compta: {}, negatif: 'jamais' },
    // (3 nov.) Vente à perte RÉELLE : le négatif est permis, et il est celui de la vente.
    { nom: 'vente à perte réelle', ventes: [{ id: 'p1', p: 'Vinted', compte: 'A', vente: J(10, 12), verse: J(10, 15), eur: 30, achat: 60, frais: 0 }], compta: {}, negatif: 'permis', exact: -33.72 },
  ];

  // La publication de l'écran Ventes, comme lui : comptes exclus et Vestiaire
  // pas sûr dehors, datée au jour de la VENTE, par `ajouterVenteBenefice`.
  const publier = (ventes) => {
    const jours = {};
    for (const v of ventes) {
      if (v.exclu || (v.p === 'Vestiaire' && !v.sur)) continue;
      const k = ctx.jourClef(new Date(v.vente));
      ctx.ajouterVenteBenefice(jours[k] || (jours[k] = ctx.beneficeVide()), v.eur, v.achat, v.frais, v.p);
    }
    const out = {}; for (const k of Object.keys(jours).sort()) out[k] = ctx.jourBeneficeEnTableau(jours[k]);
    return { v: 2, plateformes: ['Vinted', 'Leboncoin', 'eBay', 'Vestiaire'], jours: out, horsVestiaire: ventes.filter((v) => v.p === 'Vestiaire' && !v.sur).length };
  };
  // Le CA déclaré publié (`vinted_urssaf_mois`), au mois du VERSEMENT, par plateforme.
  const ligneUrssaf = (ventes) => {
    const mois = {};
    for (const v of ventes) {
      if (v.exclu || v.verse == null || (v.p === 'Vestiaire' && !v.sur)) continue;
      const ym = ctx.ymCourant(v.verse);
      const m = mois[ym] || (mois[ym] = { ym, ca: 0, n: 0, par: {} });
      const p = m.par[v.p] || (m.par[v.p] = { n: 0, ca: 0 });
      m.ca += v.eur; m.n += 1; p.ca += v.eur; p.n += 1;
    }
    return { mois: Object.values(mois) };
  };
  // ATTENDU, calculé ICI sans les fonctions de l'app.
  const attendu = (ventes, compta) => {
    const dansNov = (t) => t >= J(10, 1, 0) && t < J(11, 1, 0);
    const comptees = ventes.filter((v) => !v.exclu && !(v.p === 'Vestiaire' && !v.sur) && dansNov(v.vente));
    if (comptees.some((v) => v.achat == null)) return { valeur: null, raison: 'achats' };
    if (comptees.some((v) => v.frais == null)) return { valeur: null, raison: 'frais' };
    const ventesNet = comptees.reduce((s, v) => s + Math.round(v.eur * 100) - Math.round(v.achat * 100) - Math.round(v.frais * 100), 0);
    const charges = Math.round(((compta.fixes || []).reduce((s, f) => s + f.montant, 0) + (compta.depenses || []).filter((d) => d.date.startsWith('2026-11')).reduce((s, d) => s + d.montant, 0)) * 100);
    // (3 nov.) Rien à calculer : aucune vente comptée, aucune dépense.
    if (!comptees.length && !charges) return { valeur: null, raison: 'rien' };
    // (3 nov.) L'URSSAF des MÊMES ventes (celles comptées), pas celle des versements du mois.
    const ca = comptees.reduce((s, v) => s + Math.round(v.eur * 100), 0);
    const cotis = Math.round(ca * 12.4 / 100);
    return { valeur: (ventesNet - charges - cotis) / 100, raison: '' };
  };

  // ── Le chemin de CHAQUE écran, lu dans son code ──────────────────────────
  const src = (nom) => sansCommentaires(extraire(APP, nom));
  const sJ = src('BeneficeJournee'), sS = src('StatsVitrine'), sC = src('BeneficeCompta'), sR = src('RecapComptableMensuel');
  // Ce que fait la fonction qui donne le chiffre : `chiffreBenefice` (la règle) ou
  // `chiffreBrut` (le brut) — sinon les formes d'avant, reconnues telles quelles.
  const cheminJournee = /const CB = chiffreBenefice\(B\b/.test(sJ) ? 'regle' : /const CB = chiffreBrut\(B\)/.test(sJ) ? 'brut'
    : /const valeur = !B \? null : avecNet \? B\.netFinal : brut;/.test(sJ) ? 'net-sinon-brut' : 'inconnu';
  const cheminStats = /const CB = chiffreBenefice\(BP\b/.test(sS) ? 'regle' : /const CB = chiffreBrut\(B\)/.test(sS) ? 'brut'
    : /tuile\('benefice', 'Bénéfice', `\$\{B\.nCout < B\.n \? 'au moins ' : ''\}\$\{fmt\(B\.brut\)\}`/.test(sS) ? 'brut-au-moins' : 'inconnu';
  const cheminCompta = /chiffreBenefice\(B, etat\)\.valeur == null \? '—' : fmt\(chiffreBenefice\(B, etat\)\.valeur\)/.test(sC) ? 'regle'
    : /B\.netFinal == null \? '—' : fmt\(B\.netFinal\)/.test(sC) ? 'regle'
    // (3 nov.) Compta affiche son bénéfice par la carte sombre réglable (src/design/carteChiffres.js) :
    // la place « benefice » porte data-compta-chiffre="gagne" et vaut chiffreBenefice(B, etat) de la même lecture.
    : (/x\.place\.id === 'benefice' \? \{ 'data-compta-chiffre': 'gagne'/.test(sC) && /if \(id === 'benefice'\) \{ const CB = regles\.chiffreBenefice\(Bn, etat\)/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'design', 'carteChiffres.js'), 'utf8'))) ? 'regle' : 'inconnu';
  const cheminRecap = /profit: beneficeDuMois\(m\.ym\)/.test(sR) && /chiffreBenefice\(B\)\.valeur/.test(sR) ? 'regle' : /profit: null/.test(sR) ? 'tiret' : 'inconnu';
  console.log(`   chemins lus : Ma journée=${cheminJournee} · Statistiques=${cheminStats} · Comptabilité=${cheminCompta} · récap=${cheminRecap}`);
  dit([cheminJournee, cheminStats, cheminCompta, cheminRecap].every((c) => c !== 'inconnu'), 'le chemin de chaque écran se lit dans son code (sinon l’audit est à mettre à jour)');

  const ecran = (chemin, { pub, compta, ligne, maintenant }) => {
    const B = ctx.beneficePeriode({ jours: pub.jours, compta, ligneUrssaf: ligne, taux: 12.4, periode: 'mois', maintenant, toutes: true, urssaf: true });
    const brutMois = ctx.beneficeDesJours(pub.jours, new Date(2026, 10, 1), new Date(2026, 11, 1));
    if (chemin === 'regle') return { valeur: N.chiffreBenefice(B).valeur, auMoins: false };
    if (chemin === 'brut') return { valeur: N.chiffreBrut(brutMois).valeur, auMoins: false };
    if (chemin === 'brut-au-moins') return { valeur: brutMois.nCout > 0 ? brutMois.brut : null, auMoins: brutMois.nCout < brutMois.n };
    if (chemin === 'net-sinon-brut') return { valeur: B.netFinal != null ? B.netFinal : (B.nCout > 0 ? B.brut : (B.n === 0 ? 0 : null)), auMoins: false };
    if (chemin === 'tiret') return { valeur: null, auMoins: false };
    return { valeur: undefined, auMoins: false };
  };
  const eur = (x) => x == null ? '—' : x === undefined ? '?' : `${x.toFixed(2).replace('.', ',')} €`;

  for (const cas of CAS) {
    console.log(`── ${cas.nom}`);
    const compta = cas.compta || COMPTA;
    const pub = publier(cas.ventes), ligne = ligneUrssaf(cas.ventes);
    const A = attendu(cas.ventes, compta);
    const mesures = {
      'Ma journée': ecran(cheminJournee, { pub, compta, ligne, maintenant: MAINTENANT }),
      'Statistiques (mois)': ecran(cheminStats, { pub, compta, ligne, maintenant: MAINTENANT }),
      'Comptabilité': ecran(cheminCompta, { pub, compta, ligne, maintenant: MAINTENANT }),
      // Le récap demande le bénéfice d'un mois par son dernier instant (borné à maintenant).
      'Récap mensuel': ecran(cheminRecap, { pub, compta, ligne, maintenant: Math.min(N.finDuMois('2026-11'), MAINTENANT) }),
    };
    const vals = Object.entries(mesures).map(([k, m]) => `${k} ${m.auMoins ? 'au moins ' : ''}${eur(m.valeur)}`).join(' · ');
    const memes = Object.values(mesures).every((m) => m.valeur === mesures['Comptabilité'].valeur && !m.auMoins);
    dit(memes, '« Bénéfice » : la même valeur (ou le même « — ») sur les quatre écrans', vals);
    const c = mesures['Comptabilité'].valeur;
    dit(A.valeur == null ? c == null : (c != null && Math.abs(c - A.valeur) < 0.005), `= l’attendu calculé à la main (${eur(A.valeur)}${A.raison ? ', « pas su » : ' + A.raison : ''})`, `Comptabilité ${eur(c)}`);
    dit(Object.values(mesures).every((m) => m.valeur !== null || A.valeur === null), '« — » seulement quand la règle dit « pas su » (ou « rien à calculer »)', vals);
    if (cas.negatif === 'jamais') dit(Object.values(mesures).every((m) => !(m.valeur < 0)), 'jamais négatif : aucune vente à perte, aucune dépense', vals);
    if (cas.exact != null) dit(Object.values(mesures).every((m) => m.valeur != null && Math.abs(m.valeur - cas.exact) < 0.005), `négatif RÉEL permis, exactement ${eur(cas.exact)}`, vals);
    if (cas.tiret) {
      const B = ctx.beneficePeriode({ jours: pub.jours, compta, ligneUrssaf: ligne, taux: 12.4, periode: 'mois', maintenant: MAINTENANT, toutes: true, urssaf: true });
      const cb = N.chiffreBenefice(B);
      dit(cb.valeur === null && B.raison === cas.tiret && (N.absent || cb.raison === cas.tiret), `« — » dit sa raison (« ${cas.tiret} »), la même pour tous les écrans`, `valeur ${eur(cb.valeur)} · raison ${B.raison || '∅'}`);
      dit(B.caDecl != null && B.caDecl > 0, 'le CA déclaré du mois (daté au versement) reste lu, pour la déclaration', `caDecl ${B.caDecl}`);
    }
  }
  // ── (3 nov.) Statistiques → « L'argent depuis le début » (`Dashboard`) ──────
  // Les cellules « Bénéfice estimé / Taux marge » y lisaient l'ancien catalogue
  // (vente − achat, saisi à la main) et disaient « — » dès que les ventes Vinted
  // étaient lues. Elles doivent dire LE bénéfice de l'année (la règle de Compta
  // et de la tuile « année » de Statistiques) et la marge = ce bénéfice ÷ les
  // ventes qu'il compte.
  console.log('── Statistiques, « L’argent depuis le début » : le bénéfice et la marge de l’année');
  {
    const sD = src('Dashboard');
    const cheminTableau = /const CBa = chiffreBenefice\(BPa\b/.test(sD) && /useBeneficeCalcul\(comptaD, 'annee'\)/.test(sD) ? 'regle'
      : /const CBa = chiffreBrut\(BPa\)/.test(sD) ? 'brut'
      : /\['Bénéfice estimé', liveStats&&liveStats\.caEncaisse!=null\?'—':fmt\(profit\)/.test(sD) ? 'catalogue' : 'inconnu';
    const cheminMarge = /Math\.round\(\(CBa\.valeur \/ BPa\.ca\) \* 1000\) \/ 10/.test(sD) ? 'regle' : /Math\.round\(\(BPa\.brut \/ BPa\.ca\) \* 1000\) \/ 10/.test(sD) ? 'brut'
      : /\['Taux marge', \(liveStats&&liveStats\.caEncaisse!=null\)\|\|avgMargin===null\?'—'/.test(sD) ? 'catalogue' : 'inconnu';
    console.log(`   chemins lus : cellule=${cheminTableau} · marge=${cheminMarge}`);
    dit(cheminTableau !== 'inconnu' && cheminMarge !== 'inconnu', 'le chemin des deux cellules se lit dans leur code');
    for (const cas of CAS.filter((c) => ['tout connu', 'un prix d’achat manquant', 'vente à perte réelle'].includes(c.nom))) {
      const compta = cas.compta || COMPTA, pub = publier(cas.ventes), ligne = ligneUrssaf(cas.ventes);
      const B = ctx.beneficePeriode({ jours: pub.jours, compta, ligneUrssaf: ligne, taux: 12.4, periode: 'annee', maintenant: MAINTENANT, toutes: true, urssaf: true });
      const regle = N.chiffreBenefice(B).valeur;
      // La ligne « Ce que l'année rapporte » d'en face : la tuile « année » de Statistiques (même lecture).
      const tuileAnnee = cheminStats === 'regle' ? regle : undefined;
      // Ce que la cellule AFFICHE, selon son chemin. Le catalogue est vide chez lui
      // (et la cellule disait « — » dès que les ventes Vinted étaient lues).
      const cellule = cheminTableau === 'regle' ? regle : cheminTableau === 'brut' ? N.chiffreBrut(B).valeur : null;
      const marge = cheminMarge === 'regle' ? (cellule != null && B.ca > 0 ? Math.round((cellule / B.ca) * 1000) / 10 : null)
        : cheminMarge === 'brut' ? (B.ca > 0 ? Math.round((B.brut / B.ca) * 1000) / 10 : null) : null;
      const margeAttendue = regle != null && B.ca > 0 ? Math.round((regle / B.ca) * 1000) / 10 : null;
      dit(cellule === regle && (tuileAnnee === undefined || tuileAnnee === regle), `${cas.nom} · « Bénéfice » de l’année = la règle de Compta (« — » si pas su)`, `cellule ${eur(cellule)} · règle ${eur(regle)}`);
      dit(marge === margeAttendue, `${cas.nom} · la marge = ce bénéfice ÷ les ventes comptées`, `${marge} % · attendu ${margeAttendue} %`);
    }
    const sDc = sD.replace(/`[^`]*`/g, (x) => x);   // les gabarits gardés : un libellé peut y vivre
    dit(!/'Bénéfice estimé'|'Taux marge'|Meilleur jour bénéfice|'Bénéfice moyen par vente'/.test(sDc), 'plus de « Bénéfice estimé », « Taux marge » ni « Meilleur jour bénéfice » (un autre nom pour une autre notion)');
    dit(!/color:C\.muted\}\}>bénéfice<\/span>/.test(sDc), 'les récaps semaine / mois du catalogue (vente − achat) disent « bénéfice brut », jamais « bénéfice » seul');
  }
  console.log('── La déclaration reste datée au versement');
  {
    // Le CA déclaré et l'URSSAF à payer ne changent pas : `caDecl` = les versements du mois.
    const cas = CAS.find((c) => c.nom === 'ventes et versements croisés');
    const pub = publier(cas.ventes), ligne = ligneUrssaf(cas.ventes);
    const B = ctx.beneficePeriode({ jours: pub.jours, compta: {}, ligneUrssaf: ligne, taux: 12.4, periode: 'mois', maintenant: MAINTENANT, toutes: true, urssaf: true });
    dit(B.caDecl === 225 && ctx.aPayerUrssaf(B.caDecl, 12.4) === 27.9, 'CA déclaré de novembre = 200 + 25 versés (la vente du 15 pas encore versée n’y est pas), à payer 27,90 €', `caDecl ${B.caDecl}`);
    dit(B.cotis === 8.06, 'l’URSSAF du bénéfice = 12,4 % des 65 € vendus en novembre (8,06 €), pas des 225 € versés', `cotis ${B.cotis}`);
  }

  console.log('── Les autres notions ont d’autres noms');
  // Les cartes de l'écran Ventes : la rangée qui porte `data-ventes-benef-n`.
  const APPc = sansCommentaires(APP);
  const iV = APPc.indexOf('data-ventes-benef-n='), sV = iV < 0 ? '' : APPc.slice(iV, APPc.indexOf('data-ventes-benef-note', iV));
  const ventesLib = (sV.match(/<StatBox compact label=(\{[^}]+\}|"[^"]*")/g) || []).map((s) => s.replace('<StatBox compact label=', ''));
  const libsBenef = ventesLib.filter((l) => /Bénéfice|NOM_/.test(l));
  dit(libsBenef.length >= 3 && libsBenef.every((l) => /NOM_BENEFICE_BRUT|NOM_APRES_FRAIS/.test(l)),
    'Ventes : ses cartes (vente − achat, − frais) s’appellent « Bénéfice brut » / « Après frais de vente », jamais « Bénéfice » ni « Bénéfice net »', libsBenef.join(' '));
  const zoneSemaine = sS.slice(sS.indexOf("if (b.type === 'semaine')"), sS.indexOf('const CB = '));
  dit(/tuile\('benefice', NOM_BENEFICE_BRUT/.test(zoneSemaine), 'Statistiques, semaine : la tuile dit « Bénéfice brut » (dépenses et URSSAF se comptent au mois)');
  const zoneTuile = sS.slice(sS.indexOf('const tBenef'), sS.indexOf('const tDelai'));
  dit(zoneTuile.length > 0 && !/au moins/.test(zoneTuile), 'jamais « au moins » sur un bénéfice ou un brut partiel (une paire au prix inconnu peut être à perte)');
  dit(/\['Vinted', 'Leboncoin', 'eBay', 'Vestiaire'\]\.reduce\(/.test(extraire(APP, 'caBeneficeDuMois')), 'le CA déclaré (« à déclarer ») couvre les mêmes plateformes que le bénéfice (Vestiaire compris)');
  if (!N.absent) dit(N.chiffreBrut({ n: 3, nCout: 2, brut: 40 }).partiel === true && N.chiffreBrut({ n: 3, nCout: 0, brut: 0 }).valeur === null && N.chiffreBrut({ n: 0, nCout: 0, brut: 0 }).valeur === 0,
    'brut : la couverture se dit, « — » sans aucun prix connu, 0 sans vente');
  if (!N.absent) dit(N.chiffreBenefice(null, 'encours').valeur === null && N.chiffreBenefice(null, 'encours').raison === 'encours' && N.chiffreBenefice(null).raison === 'publication',
    'rien publié : « — » et sa raison (jamais 0)');

  console.log(ko ? `\n❌ benefice-unique : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ benefice-unique : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
