// ════════════════════════════════════════════════════════════════════════════
//  AIDE À LA DÉCISION (16 nov., lot aide-decision — validé par Julien)
//
//  A. LA CONTRE-OFFRE AUTOMATIQUE AU PRIX MINI, dans le VRAI moteur de l'extension
//     (`autoAccepterOffres`, background.js EXÉCUTÉ dans un vm, faux Vinted qui
//     compte) : éteinte par défaut ; vit seulement moteur allumé ; une offre entre
//     « Refuser sous » et le mini reçoit UNE contre-offre (POST /transactions/{tx}/offers)
//     au prix de `contreOffreMini` (la règle de la messagerie, copie IDENTIQUE) ;
//     jamais deux fois ; délai au hasard ; mêmes garde-fous (garde des autres sites,
//     compte de l'onglet, pause 429/403) ; prix de l'annonce pas su ou périmé ⇒ rien ;
//     l'aperçu de l'app (`decisionMoteur`) dit la même chose que le moteur.
//  B. CE QUI RESTE PAR MODÈLE (`classementRapporte`) : vente − achat − frais, sur les
//     seules ventes au prix d'achat ET aux frais sus ; jours MOYENS en ligne.
//  C. UN COMPTE QUI RALENTIT (`ralentissements`) : 30 j contre les 30 d'avant, au
//     moins 5 colis datés de chaque côté, ×1,5 et +24 h.
//  D. L'ARGENT QUI DORT PAR MEUBLE (`argentDortParMeuble`) : par SA case (clé de N°),
//     sans prix NOMMÉ (jamais 0), pas su ⇒ null, trié du plus gros montant.
//  E. Le branchement : publication par Annonces (même base que « Valeur du stock »),
//     carte dans Statistiques, réglage synchronisé, capacité de l'extension 5.402.
//
//  --prouve : chaque mutation doit rendre un rouge ; --src <dossier> : l'audit sur un
//  autre arbre (origin/main : rien de tout ça n'existe ⇒ rouge).
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), url = require('url');
const { faireFond } = require('./_fond-vm.cjs');

const iSrc = process.argv.indexOf('--src');
const RAC = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const F = {
  bg: path.join(RAC, 'vinted-sync-extension', 'background.js'),
  manifest: path.join(RAC, 'vinted-sync-extension', 'manifest.json'),
  volets: path.join(RAC, 'src', 'messagesVolets.js'),
  sures: path.join(RAC, 'src', 'offresSures.js'),
  rapporte: path.join(RAC, 'src', 'ceQuiRapporte.js'),
  vitesse: path.join(RAC, 'src', 'vitesseEnvoi.js'),
  dort: path.join(RAC, 'src', 'argentDort.js'),
  app: path.join(RAC, 'src', 'ecrans', 'Comptabilite.jsx'),   // (23 nov.) la publication vit dans Comptabilite (découpé d'App.jsx)
  stats: path.join(RAC, 'src', 'ecrans', 'Stats.jsx'),
  ecran: path.join(RAC, 'src', 'OffresAuto.jsx'),
  carte: path.join(RAC, 'src', 'ArgentDort.jsx'),
  rapporteJsx: path.join(RAC, 'src', 'design', 'CeQuiRapporte.jsx'),
  vitesseJsx: path.join(RAC, 'src', 'VitesseEnvoi.jsx'),
};
const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };

const MUTATIONS = {
  // A — le moteur
  // A — l'aperçu de l'app
  // B — ce qui reste
  reste_sans_frais: { f: 'rapporte', m: (s) => s.replace("g.net += cents(eur) - cents(l.achat) - cents(l.frais);", "g.net += cents(eur) - cents(l.achat);") },
  reste_frais_pas_sus_zero: { f: 'rapporte', m: (s) => s.replace("if (connu && fraisSus) {", "if (connu) {") },
  reste_achat_inconnu_zero: { f: 'rapporte', m: (s) => s.replace("if (connu && fraisSus) {", "if (fraisSus) {") },
  // C — ralentissement
  ralenti_deux_colis: { f: 'vitesse', m: (s) => s.replace('export const RALENTI_MIN = 5;', 'export const RALENTI_MIN = 1;') },
  ralenti_leger: { f: 'vitesse', m: (s) => s.replace('if (apres >= avant * RALENTI_FOIS && apres - avant >= RALENTI_ECART_MS)', 'if (apres > avant)') },
  ralenti_sans_date: { f: 'vitesse', m: (s) => s.replace("if (!l || !Number.isFinite(l.vente) || !Number.isFinite(l.depart) || l.vente < debut || l.vente > fin) continue;", "if (!l || !Number.isFinite(l.vente) || l.vente < debut || l.vente > fin) continue;") },
  // D — argent qui dort
  dort_sans_prix_zero: { f: 'dort', m: (s) => s.replace("centimes: e.nPrix ? e.c : (e.n ? null : 0),", "centimes: e.c,") },
  dort_pas_su_vide: { f: 'dort', m: (s) => s.replace("if (!Array.isArray(meubles) || !slots || typeof slots !== 'object' || Array.isArray(slots) || !Array.isArray(lignes)) return null;", "if (!Array.isArray(lignes)) return null; meubles = meubles || []; slots = slots || {};") },
  dort_meuble_inconnu: { f: 'dort', m: (s) => s.replace("if (!s || s.m == null || !ids.has(str(s.m))) continue;", "if (!s || s.m == null) continue; if (!ids.has(str(s.m))) ids.set(str(s.m), '');") },
  dort_double_compte: { f: 'dort', m: (s) => s.replace("    if (!e) { par.set(k, [k, achat, age]); continue; }", "    if (!e) { par.set(k, [k, achat, age]); continue; }\n    if (achat != null) { par.set(k + '#' + par.size, [k, achat, age]); continue; }") },
  dort_tri_nombre: { f: 'dort', m: (s) => s.replace(".sort((a, b) => (b.centimes ?? -1) - (a.centimes ?? -1) || b.n - a.n || a.nom.localeCompare(b.nom));", ".sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom));") },
  // E — branchement
  carte_absente: { f: 'stats', m: (s) => s.replace("<ArgentDort owner=", "<ArgentDortAbsente owner=") },
  publication_autre_base: { f: 'app', m: (s) => s.replace("return lignesArgentDort(annoncesPresentes.map(", "return lignesArgentDort((listings.items || []).map(") },
};

let ok = 0, ko = 0;
const dit = (c, msg, det) => { if (c) { ok++; console.log('✅ ' + msg); } else { ko++; console.log('❌ ' + msg + (det ? '  → ' + det : '')); } };

// Un module de l'app chargé depuis SA place (ses imports relatifs marchent) : une copie
// sœur `.audit-…mjs`, supprimée après — la mutation, si elle existe, y est appliquée.
async function charger(cle, src) {
  if (!src) return null;
  const f = F[cle].replace(/\.js$/, '') + `.audit-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`;
  fs.writeFileSync(f, src);
  try { return await import(url.pathToFileURL(f).href); } catch (e) { return { __erreur: e.message }; } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

// (23 nov., intégration) A. — la contre-offre automatique au prix mini — n'est PAS reportée : main a, depuis le 22 nov.,
// la « négociation intelligente » par paliers vers le prix mini (ext. 5.437, décision de Julien), qui la remplace.
// ── B. Ce qui reste, par modèle ────────────────────────────────────────────
async function partieB(S) {
  const M = await charger('rapporte', S.rapporte);
  if (!M || typeof M.classementRapporte !== 'function') { dit(false, 'B0 `classementRapporte` se charge', M && M.__erreur); return; }
  const t = Date.UTC(2026, 9, 10);
  const L = [
    { plateforme: 'Vinted', id: '1', ts: t, eur: 100, achat: 50, frais: 5, titre: 'Nike Dunk Low', marqueLue: 'Nike', enLigne: t - 10 * 864e5 },
    { plateforme: 'Vinted', id: '2', ts: t, eur: 80, achat: 30, frais: 0, titre: 'Nike Dunk High', marqueLue: 'Nike', enLigne: t - 20 * 864e5 },
    { plateforme: 'eBay', id: '3', ts: t, eur: 90, achat: 40, frais: null, titre: 'Nike Dunk', marqueLue: 'Nike' },
    { plateforme: 'Vinted', id: '4', ts: t, eur: 70, achat: null, frais: 2, titre: 'Nike Dunk', marqueLue: 'Nike' },
  ].map((l) => ({ ...l, modeleSur: M.modeleSur ? M.modeleSur(l.marqueLue, l.titre) : null }));
  const C = M.classementRapporte(L, 'modele');
  const g = C && C.groupes.find((x) => x.n === 4);
  dit(!!g, 'B1 les 4 ventes « Dunk » forment un groupe', JSON.stringify(C && C.groupes.map((x) => [x.nom, x.n])));
  if (!g) return;
  dit(g.nNet === 2 && g.apresFrais === 95 && g.resteMoyen === 47.5, 'B2 reste = vente − achat − frais sur les 2 ventes au prix d’achat ET aux frais sus : 95 € · 47,50 € par vente', JSON.stringify({ nNet: g.nNet, apresFrais: g.apresFrais, resteMoyen: g.resteMoyen }));
  dit(g.brut === 150 && g.nCout === 3, 'B3 le bénéfice brut d’avant ne bouge pas (vente − achat, 3 ventes au prix connu)', `${g.brut}/${g.nCout}`);
  dit(g.joursMoyen === 15, 'B4 jours MOYENS en ligne : (10 + 20) / 2 = 15', String(g.joursMoyen));
  const vide = M.classementRapporte([{ plateforme: 'Vinted', id: '9', ts: t, eur: 60, achat: null, frais: 1, titre: 'Nike Dunk', marqueLue: 'Nike' }], 'modele');
  dit(vide && vide.groupes[0] && vide.groupes[0].resteMoyen === null && vide.groupes[0].nNet === 0, 'B5 aucun prix d’achat connu ⇒ reste « — » (null), jamais la vente entière');
}

// ── C. Le ralentissement ───────────────────────────────────────────────────
async function partieC(S) {
  const V = await charger('vitesse', S.vitesse);
  if (!V || typeof V.ralentissements !== 'function') { dit(false, 'C0 `ralentissements` se charge', V && V.__erreur); return; }
  const H = 3600000, J = 24 * H, now = Date.UTC(2026, 10, 16, 12);
  const serie = (compte, n, finAvant, delai) => Array.from({ length: n }, (_, i) => ({ tx: compte + finAvant + i, compte, nom: compte, vente: now - finAvant * J - i * H, depart: now - finAvant * J - i * H + delai }));
  const lent = [...serie('a', 5, 40, 20 * H), ...serie('a', 5, 5, 60 * H)];
  const R1 = V.ralentissements(lent, { maintenant: now });
  dit(R1 && R1.length === 1 && R1[0].cle === 'a' && R1[0].avant === 20 * H && R1[0].maintenant === 60 * H, 'C1 20 h → 60 h de moyenne, 5 colis datés de chaque côté : le compte est dit', JSON.stringify(R1));
  dit((V.ralentissements([...serie('a', 4, 40, 20 * H), ...serie('a', 5, 5, 60 * H)], { maintenant: now }) || []).length === 0, 'C2 moins de 5 colis datés d’un côté : rien n’est dit');
  dit((V.ralentissements([...serie('a', 5, 40, 20 * H), ...serie('a', 5, 5, 28 * H)], { maintenant: now }) || []).length === 0, 'C3 20 h → 28 h (×1,4) : pas « nettement », rien n’est dit');
  dit((V.ralentissements([...serie('a', 5, 40, 2 * H), ...serie('a', 5, 5, 10 * H)], { maintenant: now }) || []).length === 0, 'C4 2 h → 10 h (moins de 24 h de plus) : rien n’est dit');
  const sansDate = [...serie('a', 3, 40, 20 * H), ...serie('a', 2, 45, 20 * H).map((l) => ({ ...l, depart: null })), ...serie('a', 5, 5, 60 * H)];
  dit((V.ralentissements(sansDate, { maintenant: now }) || []).length === 0, 'C5 des dépôts sans date prouvée ne comptent pas (jamais devinés)');
  dit(V.ralentissements(null) === null, 'C6 rien publié ⇒ null (pas su)');
}

// ── D. L'argent qui dort ───────────────────────────────────────────────────
async function partieD(S) {
  const D = await charger('dort', S.dort);
  if (!D || typeof D.argentDortParMeuble !== 'function') { dit(false, 'D0 `argentDortParMeuble` se charge', D && D.__erreur); return; }
  const cle = (v) => String(v).trim().toUpperCase().replace(/\s+/g, '').replace(/^0+(?=\d)/, '');
  const meubles = [{ id: 'm1', name: 'Étagère' }, { id: 'm2', name: 'Armoire' }];
  const slots = { 1: { m: 'm1', i: 0 }, 2: { m: 'm1', i: 1 }, 3: { m: 'm2', i: 0 }, 9: { m: 'm1', i: 5 }, 7: { m: 'disparu', i: 0 } };
  const lignes = D.lignesArgentDort([
    { cle: '1', achat: 5000, age: 10 }, { cle: '2', achat: null, age: 30 }, { cle: '3', achat: 9000, age: null },
    { cle: '4', achat: 2000, age: 5 }, { cle: '7', achat: 1000, age: 2 }, { cle: '3', achat: 9000, age: 40 }, { cle: '', achat: 99999, age: 1 },
  ]);
  dit(Array.isArray(lignes) && lignes.length === 5 && lignes.find((l) => l[0] === '3')[1] === 9000, 'D1 un N° porté par deux annonces compte UNE fois (son prix une fois) ; un article sans N° ne compte pas', JSON.stringify(lignes));
  const A = D.argentDortParMeuble({ meubles, slots, lignes, cle });
  const m1 = A && A.meubles.find((m) => m.id === 'm1'), m2 = A && A.meubles.find((m) => m.id === 'm2');
  dit(!!m1 && m1.n === 2 && m1.centimes === 5000 && m1.nPrix === 1 && m1.sansPrix === 1, 'D2 Étagère : 2 articles présents, 50 € SAISIS, « 1 sans prix » nommé (jamais compté 0)', JSON.stringify(m1 && { n: m1.n, c: m1.centimes, s: m1.sansPrix }));
  dit(!!m1 && m1.ageMoyen === 20 && m1.nAge === 2, 'D3 âge moyen de l’Étagère : (10 + 30) / 2 = 20 jours', JSON.stringify(m1 && m1.ageMoyen));
  dit(!!m2 && m2.centimes === 9000 && A.meubles[0].id === 'm2', 'D4 trié du plus gros argent immobilisé (Armoire 90 € avant Étagère 50 €)', JSON.stringify(A && A.meubles.map((m) => [m.id, m.centimes])));
  dit(A && A.horsMeuble.n === 2 && A.horsMeuble.centimes === 3000, 'D5 un article sans case (ou dans un meuble disparu) va dans « Pas encore rangés », jamais dans un meuble deviné', JSON.stringify(A && A.horsMeuble));
  dit(!!m1 && !m1.articles.some((a) => a.cle === '9'), 'D6 une case notée pour un N° qui n’est plus présent ne compte pas');
  const seul = D.argentDortParMeuble({ meubles, slots: { 2: { m: 'm1', i: 0 } }, lignes: [['2', null, 3]], cle });
  dit(seul && seul.meubles[0].centimes === null, 'D7 un meuble sans aucun prix saisi ⇒ « — » (null), jamais 0 €');
  dit(D.argentDortParMeuble({ meubles: null, slots, lignes, cle }) === null && D.argentDortParMeuble({ meubles, slots: null, lignes, cle }) === null && D.argentDortParMeuble({ meubles, slots, lignes: null, cle }) === null, 'D8 meubles, cases ou publication pas lus ⇒ null (pas su)');
  dit(A && A.centimes === 17000 && A.n === 5 && A.nPrix === 4, 'D9 le total : 170 € sur 5 articles, 4 au prix connu', JSON.stringify(A && { c: A.centimes, n: A.n, p: A.nPrix }));
}

// ── E. Le branchement ──────────────────────────────────────────────────────
function partieE(S) {
  const sans = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  const app = sans(S.app), stats = sans(S.stats), ecran = sans(S.ecran);
  dit(/return lignesArgentDort\(annoncesPresentes\.map\(/.test(app) && /beneficePaire\(null, fusionEntreeVente\(f \|\| \{\}, null, buyByNum\)\)\.achat/.test(app) && /listedAgeDays\(it\)/.test(app), 'E5 Annonces publie l’argent qui dort sur la MÊME base que « Valeur du stock » (paires présentes, prix de la règle du bénéfice, âge lu)');
  dit(/<ArgentDort owner=/.test(stats) && /import ArgentDort from "\.\.\/ArgentDort\.jsx"/.test(stats), 'E6 la carte est dans Statistiques (pas un nouvel onglet)');
  const textes = [S.carte, S.rapporteJsx, S.vitesseJsx].map(sans).join('\n');
  dit(/tr\('ad\.dort\.titre'\)/.test(textes) && /tr\('ad\.reste\.moyen'/.test(textes) && /tr\('ad\.envoi\.ralenti'/.test(textes), 'E8 les nouveaux textes passent par tr()');
}

async function tout(S) {
  await partieB(S); await partieC(S); await partieD(S); partieE(S);
}
const sources = () => Object.fromEntries(Object.keys(F).map((k) => [k, lire(F[k])]));

(async () => {
  if (process.argv.includes('--prouve')) {
    const base = sources();
    let rouges = 0, noms = [];
    const os = require('os');
    for (const [nom, { f, m }] of Object.entries(MUTATIONS)) {
      const S = { ...base, [f]: m(base[f]) };
      if (S[f] === base[f]) { console.log(`⚠️  mutation ${nom} : le texte visé n'existe plus`); noms.push(nom + ' (sans effet)'); continue; }
      let bgTmp = null;
      if (f === 'bg') { bgTmp = path.join(os.tmpdir(), `bg-aide-decision-${process.pid}.js`); fs.writeFileSync(bgTmp, S.bg); BG_SRC = bgTmp; }
      ok = 0; ko = 0;
      const log = console.log; console.log = () => {};
      try { await tout(S); } catch (e) { ko++; }
      console.log = log;
      BG_SRC = null; if (bgTmp) try { fs.unlinkSync(bgTmp); } catch (_) {}
      if (ko > 0) { rouges++; console.log(`✅ mutation ${nom} : ${ko} rouge(s)`); } else { noms.push(nom); console.log(`❌ mutation ${nom} : RESTE VERTE`); }
    }
    const n = Object.keys(MUTATIONS).length;
    console.log(rouges === n ? `\n✅ preuve : ${n}/${n} mutations rendent un rouge` : `\n❌ preuve : ${noms.join(', ')}`);
    process.exit(rouges === n ? 0 : 1);
  }
  if (iSrc > 0) BG_SRC = F.bg;
  await tout(sources());
  console.log(ko ? `\n❌ audit-aide-decision : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-aide-decision : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
