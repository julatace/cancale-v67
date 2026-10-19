// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE BÉNÉFICE BRUT ET NET — UNE règle, deux écrans (19 octobre)
//         node scripts/audit-benefice.cjs [--mutation=duplique|zero|cotis]
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « le bénéfice brut et net ». L'écran Ventes le calculait ; l'écran
// Comptabilité disait « ce n'est donc pas encore ton bénéfice net ». Comptabilité
// l'affiche maintenant — en CONSOMMANT les cumuls que Ventes publie jour par jour
// (`vrm_benefice_jours`), jamais en relisant un prix d'achat (§11).
// Cet audit EXÉCUTE les vraies fonctions extraites d'App.jsx (Babel, dans un vm)
// sur des ventes INVENTÉES et vérifie :
//   1. la somme « façon Ventes » (un cumul sur les ventes de la période) = la
//      somme « façon Comptabilité » (les jours publiés de la période) ;
//   2. brut et net ne portent QUE sur les ventes au prix d'achat connu (un
//      achat inconnu n'est pas un achat à 0 €, §5) ; « 0 » saisi est connu ;
//   3. les bornes de période (jour local entier, comme `dansPeriode`) ;
//   4. le net final : brut − frais − charges − cotisations, et `null` (« — ») si
//      un prix d'achat manque ou si le CA déclaré n'est pas publié ;
//   5. les cotisations portent sur la part VINTED du CA déclaré publié ;
//   6. le code : `totals` (Ventes) passe par la règle, et Comptabilité ne relit
//      aucun prix d'achat (pas de second calcul).
// `--mutation=…` réaffaiblit la règle dans une copie du source : chaque mutation
// doit faire passer au moins un contrôle au rouge.
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
let parser;
try { parser = require(path.join(R, 'node_modules', '@babel', 'parser')); }
catch (e) { console.log('❌ l\'analyseur Babel est disponible — ' + e.message); process.exit(1); }

const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let src = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
const muter = (avant, apres) => { if (!src.includes(avant)) { console.log('❌ mutation impossible : motif absent'); process.exit(2); } src = src.replace(avant, apres); };
if (MUT === 'duplique') {
  // Un SECOND calcul dans Comptabilité, qui diverge : un achat inconnu y vaut 0 €.
  muter('const v = beneficeDesJours(jours, de, a);',
    'const v = (() => { const x = beneficeDesJours(jours, de, a); return { ...x, brut: x.ca - x.cout, net: x.ca - x.cout - x.frais }; })();');
} else if (MUT === 'zero') {
  // La règle elle-même : un achat inconnu compté à 0 €.
  muter("if (achat != null && String(achat).trim() !== '' && isFinite(Number(achat))) {", 'if (true) { achat = Number(achat) || 0;');
} else if (MUT === 'cotis') {
  // Le net écrit même quand un prix d'achat manque.
  muter('const complet = v.nCout === v.n;', 'const complet = true;');
} else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 200)); } };

// ── Extraction des déclarations de premier niveau ───────────────────────────
let ast;
try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] }); }
catch (e) { console.log('❌ App.jsx se lit — ' + e.message); process.exit(1); }
const decl = new Map();
for (const n of ast.program.body) {
  const d = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
  if (!d) continue;
  if (d.type === 'FunctionDeclaration' && d.id) decl.set(d.id.name, src.slice(d.start, d.end));
  if (d.type === 'VariableDeclaration') for (const v of d.declarations) if (v.id && v.id.name) decl.set(v.id.name, `${d.kind} ${src.slice(v.start, v.end)};`);
}
const VOULUS = ['BENEF_CHAMPS', 'beneficeVide', 'ajouterVenteBenefice', 'jourBeneficeEnTableau', 'cumulerBenefice', 'resumeBenefice', 'beneficeDesJours', 'caVintedDuMois', 'beneficePeriode'];
const manquants = VOULUS.filter((k) => !decl.has(k));
dit(!manquants.length, 'les fonctions du bénéfice existent dans App.jsx', manquants.join(', '));
if (manquants.length) { console.log(`\n❌ audit-benefice : ${ko} rouge(s)`); process.exit(1); }

// Charge les fonctions voulues ; une ReferenceError ajoute la déclaration qui
// manque (si elle existe au premier niveau) — jamais une copie à la main.
const charger = () => {
  const noms = new Set(VOULUS);
  for (let essai = 0; essai < 60; essai++) {
    const ordre = [...decl.keys()].filter((k) => noms.has(k));
    const code = ordre.map((k) => decl.get(k)).join('\n') + `\n;({ ${VOULUS.join(', ')} })`;
    const ctx = vm.createContext({ console, Date, Math, Number, String, Object, Array, JSON, isFinite, isNaN, parseFloat, Set, Map });
    try {
      const out = vm.runInContext(code, ctx);
      // Un appel « à blanc » pour faire lever ce qui manque à l'exécution.
      out.beneficePeriode({ jours: { '2026-01-02': [1, 100, 0, 1, 50, 100, 0] }, compta: {}, ligneUrssaf: { mois: [] }, taux: 13.5, periode: 'mois' });
      return out;
    } catch (e) {
      const m = /([A-Za-z_$][\w$]*) is not defined/.exec(String(e && e.message));
      if (m && decl.has(m[1]) && !noms.has(m[1])) { noms.add(m[1]); continue; }
      throw e;
    }
  }
  throw new Error('dépendances introuvables');
};
let F;
try { F = charger(); dit(true, 'la règle se charge dans un vm (dépendances lues dans App.jsx)'); }
catch (e) { dit(false, 'la règle se charge dans un vm', String(e.message || e).slice(0, 200)); console.log(`\n❌ audit-benefice : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

// ── Données inventées ───────────────────────────────────────────────────────
const now = new Date();
const Y = now.getFullYear(), M = now.getMonth();
const jour = (k) => new Date(Y, M, Math.min(k, now.getDate()), 12);          // ce mois, jamais dans le futur
const finMoisPasse = new Date(Y, M, 0, 23, 59);                               // dernier jour du mois passé, 23 h 59
const debutMois = new Date(Y, M, 1, 0, 1);                                    // 1er du mois, 0 h 01
// [date, prix, achat (null = inconnu), frais]
const VENTES = [
  [jour(1), 61, 20, 2.5],
  [jour(2), 39.9, 15, 0],
  [debutMois, 48.5, '0', 1],       // « 0 » saisi : un achat CONNU
  [jour(3), 72.4, null, 3],        // inconnu : hors brut/net
  [jour(3), 55, '', 0],            // vide : inconnu
  [finMoisPasse, 44, 10, 0],       // le mois passé : hors période
];
const cents = (x) => Math.round(Number(x) * 100);
const connu = (a) => a != null && String(a).trim() !== '' && isFinite(Number(a));
const duMois = (d) => d.getFullYear() === Y && d.getMonth() === M;

essaie('façon Ventes = façon Comptabilité', () => {
  // Façon Ventes : un cumul sur les ventes de la période (ce que fait `totals`).
  const acc = F.beneficeVide();
  for (const [d, p, a, f] of VENTES) if (duMois(d)) F.ajouterVenteBenefice(acc, p, connu(a) ? Number(a) : null, f);
  const V = F.resumeBenefice(acc);
  // Façon Comptabilité : les jours publiés (tableaux), puis la période.
  const jours = {};
  const clef = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const b = {};
  for (const [d, p, a, f] of VENTES) F.ajouterVenteBenefice(b[clef(d)] || (b[clef(d)] = F.beneficeVide()), p, connu(a) ? Number(a) : null, f);
  for (const k of Object.keys(b)) jours[k] = F.jourBeneficeEnTableau(b[k]);
  const P = F.beneficePeriode({ jours, compta: {}, ligneUrssaf: { mois: [] }, taux: 13.5, periode: 'mois', maintenant: now.getTime() });
  dit(P.brut === V.brut && P.net === V.net && P.n === V.n && P.nCout === V.nCout, 'le brut et le net de Comptabilité = ceux de Ventes sur les mêmes ventes', `Compta brut ${P.brut} net ${P.net} (${P.nCout}/${P.n}) · Ventes brut ${V.brut} net ${V.net} (${V.nCout}/${V.n})`);
  // Attendus calculés ICI, indépendamment de la règle.
  const lm = VENTES.filter(([d]) => duMois(d));
  const lc = lm.filter(([, , a]) => connu(a));
  const brut = lc.reduce((t, [, p, a]) => t + cents(p) - cents(a), 0) / 100;
  const net = lc.reduce((t, [, p, a, f]) => t + cents(p) - cents(a) - cents(f), 0) / 100;
  dit(P.n === lm.length && P.nCout === lc.length, 'la couverture : ventes au prix d’achat connu sur ventes de la période (« 0 » est connu, « » ne l’est pas)', `${P.nCout}/${P.n} · attendu ${lc.length}/${lm.length}`);
  dit(Math.abs(P.brut - brut) < 0.005, 'BRUT = CA − prix d’achat, sur les seules ventes au prix connu', `${P.brut} · attendu ${brut}`);
  dit(Math.abs(P.net - net) < 0.005, 'NET des ventes = brut − boosts et frais des mêmes ventes', `${P.net} · attendu ${net}`);
  dit(!lm.some(([d]) => d === finMoisPasse), 'le dernier jour du mois passé (23 h 59) n’entre pas dans le mois — et le 1er à 0 h 01, si', `${P.n} ventes`);
  dit(P.raison === 'achats' && P.netFinal === null, 'un prix d’achat manque ⇒ le net final vaut « — » (null), raison « achats »', `net ${P.netFinal} · ${P.raison}`);
});

essaie('net final complet', () => {
  const jours = {};
  const k = `${Y}-${String(M + 1).padStart(2, '0')}-01`;
  const b = F.beneficeVide(); F.ajouterVenteBenefice(b, 100, 40, 5); F.ajouterVenteBenefice(b, 50.5, 20.25, 0);
  jours[k] = F.jourBeneficeEnTableau(b);
  const ym = `${Y}-${String(M + 1).padStart(2, '0')}`;
  const compta = { depenses: [{ date: `${ym}-01`, montant: 12.5 }], fixes: [], packs: [], abonnements: [] };
  const ligne = { mois: [{ ym, ca: 300, par: { Vinted: { n: 2, ca: 200 }, Leboncoin: { n: 1, ca: 100 } } }] };
  const P = F.beneficePeriode({ jours, compta, ligneUrssaf: ligne, taux: 13.5, periode: 'mois', maintenant: now.getTime() });
  const cotis = Math.round(cents(200) * 13.5 / 100) / 100;              // 27 €
  const attendu = (cents(100) - cents(40) - cents(5) + cents(50.5) - cents(20.25) - cents(12.5) - cents(cotis)) / 100;
  dit(P.cotis === cotis, 'les cotisations portent sur la part VINTED du CA déclaré publié (pas Leboncoin)', `${P.cotis} · attendu ${cotis}`);
  dit(P.charges === 12.5, 'les charges de la période viennent de la règle des charges de Comptabilité', `${P.charges}`);
  dit(P.netFinal != null && Math.abs(P.netFinal - attendu) < 0.005, 'NET final = brut − frais − charges − cotisations', `${P.netFinal} · attendu ${attendu}`);
  const Q = F.beneficePeriode({ jours, compta, ligneUrssaf: null, taux: 13.5, periode: 'mois', maintenant: now.getTime() });
  dit(Q.netFinal === null && Q.raison === 'cotisations' && Q.cotis === null, 'CA déclaré pas publié ⇒ cotisations et net « — », raison dite', `${Q.netFinal} · ${Q.raison}`);
  const V = F.beneficePeriode({ jours: {}, compta, ligneUrssaf: ligne, taux: 13.5, periode: 'mois', maintenant: now.getTime() });
  dit(V.n === 0 && V.brut === 0 && V.netFinal != null, 'aucune vente sur la période : brut 0 (lu, vide), le net reste calculable', `${V.brut} · ${V.netFinal}`);
});

essaie('le code', () => {
  const corps = (nom) => decl.get(nom) || '';
  const pc = corps('beneficePeriode') + corps('BeneficeCompta');
  dit(!/buyPrice|achatDe|effEntry|chargesVente/.test(pc), 'Comptabilité ne relit aucun prix d’achat (aucun second calcul)', (pc.match(/buyPrice|achatDe|effEntry|chargesVente/) || [''])[0]);
  const i = src.indexOf('const totals = useMemo(');
  const t = i >= 0 ? src.slice(i, src.indexOf('}, [sales.items, numeros, saleOv, buyByNum, hiddenSales, hiddenAccts, periode]);', i)) : '';
  dit(/ajouterVenteBenefice\(acc/.test(t) && /resumeBenefice\(acc\)/.test(t), 'l’écran Ventes (`totals`) passe par la même règle');
  dit(!/benefBrut\s*\+=|benefConnu\s*\+=|sell\s*-\s*buy\s*-\s*fee\s*;/.test(t), 'et ne garde aucun cumul brut/net à part');
  const pubI = src.indexOf("save('vrm_benefice_jours'");
  const pub = pubI >= 0 ? src.slice(Math.max(0, pubI - 1500), pubI) : '';
  dit(/ajouterVenteBenefice\(/.test(pub) && /achatDe\(e\)/.test(pub), 'la publication par jour utilise la même règle et la même lecture du prix d’achat');
  dit(/'vrm_benefice_jours'/.test(src.slice(src.indexOf('const SYNC_KEYS'), src.indexOf('const SYNC_KEYS') + 20000)), 'la publication est synchronisée (elle arrive sur un autre appareil)');
  dit(!/pas encore ton bénéfice net/.test(src), 'la phrase « ce n’est donc pas encore ton bénéfice net » a disparu');
});

console.log(ko ? `\n❌ audit-benefice${MUT ? ' (mutation ' + MUT + ')' : ''} : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-benefice : ${ok} verts, 0 rouge`);
process.exit(ko ? 1 : 0);
