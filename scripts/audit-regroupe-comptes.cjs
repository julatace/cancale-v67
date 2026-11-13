if (!process.argv.includes('--prouve') && !process.env.MUT) require('./_source-app.cjs').brancher();   // (11 nov., découpe 2) lit l'app RECOLLÉE (scripts/brancher-audits.cjs)
// Audit : LES LISTES FLOUTÉES REGROUPÉES PAR COMPTE (11 nov., 22 h 10 — Julien : « les ventes ne sont pas
// regroupées et donc ce n'est pas très lisible : peux-tu regrouper ça mieux »).
//   R. la règle pure (src/regroupeComptes.js), sur des données INVENTÉES (3 comptes, 50 ventes mêlées) :
//      le compte ouvert d'abord, puis un groupe par autre compte (replié), l'ordre par date gardé DANS chaque
//      groupe, aucune ligne perdue ni doublée, mêmes totaux ; pas su (aucun compte ouvert) ou rien de flouté
//      ⇒ `null` (la liste reste comme avant) ; une ligne nette sans compte n'est attribuée à personne ;
//      le regroupement SUIT le prédicat de flou de l'écran (jamais une autre règle).
//   S. les écrans passent par elle avec LEUR prédicat de flou : Ventes et Achats Vinted (`estFloute`), ventes,
//      achats et annonces Leboncoin (`lbcFloute`) et Vestiaire (`vcFloute`) ; les totaux lisent toujours la liste
//      entière (`ventesAffichees`, `achatsAffiches`).
// `--module chemin` : une autre copie de regroupeComptes.js ; `--racine dossier` : un autre arbre ;
// `--prouve` : rejoue R sur des mutations de la règle, chacune doit être ROUGE.
const path = require('path');
const fs = require('fs');
const os = require('os');
const argv = process.argv.slice(2);
const RACINE = argv.includes('--racine') ? path.resolve(argv[argv.indexOf('--racine') + 1]) : path.join(__dirname, '..');
const MODULE = argv.includes('--module') ? path.resolve(argv[argv.indexOf('--module') + 1]) : path.join(RACINE, 'src', 'regroupeComptes.js');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');

// Données inventées : 50 ventes, 3 comptes (A ouvert, B, C), dates mêlées, 2 sans date, 2 sans compte.
function donnees() {
  const J = 864e5, T0 = Date.UTC(2026, 10, 11, 20, 0, 0);
  const comptes = ['A', 'B', 'C'];
  const L = [];
  for (let i = 0; i < 50; i++) {
    const c = i === 7 || i === 31 ? '' : comptes[(i * 7 + (i >> 2)) % 3];
    L.push({ id: 'v' + i, compte: c, t: i === 12 || i === 44 ? null : T0 - ((i * 37) % 50) * J - i * 1000, prix: 10 + (i % 9) * 3.5 });
  }
  // Le plus récent en haut, sans date en bas (la règle `ordreRecent`, recopiée ici en bref).
  const dates = L.filter((x) => x.t != null).sort((a, b) => b.t - a.t), sans = L.filter((x) => x.t == null);
  return [...dates, ...sans];
}

function juger(M, dit) {
  const L = donnees();
  const ouvert = 'A';
  const floute = (x) => !!(ouvert && x.compte && x.compte !== ouvert); // le prédicat de l'écran (lbcFloute/vcFloute)
  const compteDe = (x) => x.compte;
  const g = M.grouperParCompte(L, { ouvert, floute, compteDe });
  dit(!!g, 'R1 un compte ouvert et des lignes floutées ⇒ des groupes');
  if (!g) return;
  const tous = [...g.tete, ...g.sans, ...g.autres.flatMap((a) => a.lignes)];
  dit(tous.length === L.length && new Set(tous.map((x) => x.id)).size === L.length, 'R2 aucune ligne perdue ni doublée (50 = 50)', `${tous.length}/${L.length}`);
  const somme = (a) => Math.round(a.reduce((s, x) => s + x.prix, 0) * 100);
  dit(somme(tous) === somme(L), 'R3 même total qu\'avant', `${somme(tous)} ≠ ${somme(L)}`);
  dit(g.tete.length > 0 && g.tete.every((x) => x.compte === 'A' && !floute(x)), 'R4 le groupe de tête = les lignes NETTES du compte ouvert');
  dit(g.sans.length === 2 && g.sans.every((x) => x.compte === '' && !floute(x)), 'R5 une ligne nette sans compte n\'est attribuée à personne (groupe « pas relevé »)', g.sans.map((x) => x.id).join(','));
  dit(g.autres.length === 2 && g.autres.every((a) => a.lignes.every((x) => floute(x) && x.compte === a.compte)), 'R6 un groupe par AUTRE compte, chacun = ses lignes floutées');
  const rang = new Map(L.map((x, i) => [x.id, i]));
  const croissant = (a) => a.every((x, i) => i === 0 || rang.get(a[i - 1].id) < rang.get(x.id));
  dit([g.tete, g.sans, ...g.autres.map((a) => a.lignes)].every(croissant), 'R7 l\'ordre par date est gardé DANS chaque groupe');
  const premiers = g.autres.map((a) => rang.get(a.lignes[0].id));
  dit(croissant(g.autres.map((a) => a.lignes[0])) && premiers.length === 2, 'R8 les autres comptes dans l\'ordre de leur ligne la plus récente');
  const c = M.comptesDesGroupes(g);
  dit(c && c.total === L.length && c.comptes === 2 && c.autres === L.length - g.tete.length - g.sans.length, 'R9 les nombres des en-têtes couvrent toute la liste', JSON.stringify(c));
  // Pas su ⇒ comme avant.
  dit(M.grouperParCompte(L, { ouvert: '', floute: (x) => x.compte === 'B', compteDe }) === null, 'R10 aucun compte ouvert (pas su) ⇒ null : la liste reste comme avant');
  dit(M.grouperParCompte(L.filter((x) => !floute(x)), { ouvert, floute, compteDe }) === null, 'R11 rien de flouté ⇒ null : aucun en-tête inutile');
  // Il suit le prédicat de l'ÉCRAN : la règle de Vinted floute aussi une ligne sans compte.
  const flouVinted = (x) => !!(ouvert && x.compte !== ouvert);
  const gv = M.grouperParCompte(L, { ouvert, floute: flouVinted, compteDe });
  dit(gv && gv.sans.length === 0 && gv.autres.some((a) => a.compte === '' && a.lignes.length === 2), 'R12 le regroupement suit le flou de l\'écran (Vinted : sans compte = flouté ⇒ groupe « compte pas su »)');
  // Les entrées à dessiner : les autres comptes repliés ⇒ seulement leur en-tête.
  const e = M.entreesGroupees(g, { deplies: new Set(), quand: (x) => x.t, max: 60 });
  const lignes = e.entrees.filter((x) => x.ligne !== undefined);
  dit(lignes.length === g.tete.length + g.sans.length && e.entrees.filter((x) => x.tete === 'compte').length === 2 && e.entrees.every((x) => x.tete !== 'compte' || x.deplie === false),
    'R13 replié par défaut : les lignes des autres comptes ne sont pas dessinées, leur en-tête oui');
  dit(e.entrees[0] && e.entrees[0].tete === 'ouvert' && e.entrees[0].n === g.tete.length, 'R14 l\'en-tête du compte ouvert vient EN PREMIER et dit son nombre');
  const eD = M.entreesGroupees(g, { deplies: new Set(['B']), quand: (x) => x.t, max: 60 });
  const nB = g.autres.find((a) => a.compte === 'B').lignes.length;
  dit(eD.entrees.filter((x) => x.ligne !== undefined).length === g.tete.length + g.sans.length + nB, 'R15 déplier un compte dessine ses lignes (et seulement les siennes)');
  const eT = M.entreesGroupees(g, { deplies: new Set(), max: 5 });
  dit(eT.netsDessinees === 5 && eT.nets === g.tete.length + g.sans.length && !eT.entrees.some((x) => x.tete === 'autres'), 'R16 la tranche porte sur les lignes nettes ; les autres comptes suivent, en bas');
  dit(M.entreesGroupees(null, {}) === null, 'R17 pas de groupes ⇒ pas d\'entrées (l\'écran garde sa liste)');
}

async function charger(f) { return import(f + '?t=' + Date.now()); }

(async () => {
  let ok = 0, ko = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + d : '')); };
  let M = null;
  try { M = await charger(MODULE); } catch (e) { dit(false, 'R. src/regroupeComptes.js existe et se charge', String(e && e.message).slice(0, 120)); }
  if (M) juger(M, dit);

  // ── S. LES ÉCRANS ─────────────────────────────────────────────────────────
  const lire = (r) => { try { return sansCommentaires(fs.readFileSync(path.join(RACINE, r), 'utf8')); } catch (_) { return ''; } };
  const APP = lire('src/App.jsx'), VC = lire('src/ecrans/Vestiaire.jsx'), LBC = lire('src/AnnoncesLeboncoin.jsx'), LBCE = lire('src/ecrans/Leboncoin.jsx');
  dit(/grouperParCompte\(ventesAffichees, \{ ouvert: selEff, floute: estFloute, compteDe: uidLigne \}\)/.test(APP), 'S1 Ventes Vinted : regroupées avec LE prédicat du flou (`estFloute`) et le compte effectif (`selEff`)');
  dit(/ventesGroupees \? ventesGroupees\.entrees : ventesAffichees\.slice\(0, ventesMax\)/.test(APP), 'S2 Ventes Vinted : la liste dessinée vient des groupes ; sans groupe, la tranche d\'avant');
  dit(/grouperParCompte\(achatsAffiches, \{ ouvert: selEff, floute: \(x\) => estFloute\(x\.o\)/.test(APP) && /achatsGroupees \? achatsGroupees\.entrees : achatsAffiches\.slice\(0, achatsMax\)/.test(APP),
    'S3 Achats Vinted : même règle, même prédicat');
  dit(/FiabiliteVentes[^\n]*lignes=\{ventesAffichees\.map/.test(APP) && /bandeauPrixAchat\(ventesAffichees,/.test(APP), 'S4 les totaux et contrôles des ventes lisent toujours la liste ENTIÈRE');
  const lbcV = /<ListeParCompte lignes=\{visibles\} ouvert=\{lbcOuvert\} floute=\{\(o\)=>lbcFloute\(lbcOuvert, o\.account\)\}/.test(APP);
  const lbcA = /<ListeParCompte lignes=\{ordreRecent\(arr, tsAchat\)\} ouvert=\{lbcOuvert\} floute=\{\(o\) => lbcFloute\(lbcOuvert, o\.account\)\}/.test(APP);
  dit(lbcV && lbcA, 'S5 Leboncoin ventes et achats : regroupés avec `lbcFloute` (le flou de leurs lignes)');
  dit(/<ListeParCompte enLi[^>]*floute=\{\(l\)=>estFloute\(l\.ad\)\}/.test(LBC) && /compteOuvert=\{lbcOuvert\}/.test(LBCE), 'S6 Leboncoin annonces : regroupées avec le même `floute` que leurs fiches');
  dit(/<ListeParCompte[^>]*floute=\{\(v\) => vcFloute\(vcOuvert, v\.compte\)\}/.test(VC) && /<ListeParCompte enLi[^>]*floute=\{\(l\) => vcFloute\(vcOuvert, l\.it\.compte\)\}/.test(VC)
    && /<ListeParCompte[^>]*floute=\{\(v\) => vcFloute\(vcOuvert, v\.compte\)\}/.test(APP), 'S7 Vestiaire ventes, achats et annonces : regroupés avec `vcFloute`');
  const G = lire('src/GroupesComptes.jsx');
  dit(/if \(!g\) return <>\{L\.map\(\(l, i\) => rendre\(l, i\)\)\}<\/>;/.test(G), 'S8 sans groupe (pas su), `ListeParCompte` rend la liste telle quelle');

  // ── --prouve : chaque mutation de la règle doit être ROUGE ────────────────
  if (argv.includes('--prouve') && M) {
    const src = fs.readFileSync(MODULE, 'utf8');
    const mutations = [
      ['groupe par compte sans regarder le flou', 'if (floute(l)) {', 'if (chaine(compteDe(l)) !== o) {'],
      ['une ligne sans compte rangée dans le compte ouvert', "} else if (chaine(compteDe(l)) === o) tete.push(l);", '} else tete.push(l);'],
      ['pas su ⇒ groupe quand même', "if (!o || typeof floute", "if (typeof floute"],
      ['les autres comptes dépliés par défaut', 'const dep = D.has(a.compte);', 'const dep = true;'],
      ['une ligne perdue par groupe', 'parCompte.get(c).push(l);', 'if (parCompte.get(c).length < 5) parCompte.get(c).push(l);'],
      ['retri par compte dans le groupe (ordre perdu)', "return { ouvert: o, tete, sans,", "tete.reverse(); return { ouvert: o, tete, sans,"],
    ];
    for (const [nom, a, b] of mutations) {
      if (!src.includes(a)) { dit(false, `PROUVE « ${nom} » : motif introuvable`); continue; }
      const f = path.join(os.tmpdir(), `regroupe-mut-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
      fs.writeFileSync(f, src.replace(a, b));
      let rouges = 0; const d2 = (c) => { if (!c) rouges++; };
      try { juger(await charger(f), d2); } catch (_) { rouges++; }
      fs.unlinkSync(f);
      dit(rouges > 0, `PROUVE mutation « ${nom} » ⇒ rouge (${rouges})`);
    }
  }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
