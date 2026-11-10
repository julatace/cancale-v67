// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : ARGENT — Statistiques et Compta en UN endroit (10 nov.)
//         node scripts/audit-argent.cjs            (la règle de src/argent.js)
//         node scripts/audit-argent.cjs --prouve   (chaque contrôle rougit sous mutation)
// ═══════════════════════════════════════════════════════════════════════════
// Exécute src/argent.js (aucun rendu) et lit le câblage de la coque :
//   A1 quatre segments, dans l'ordre ; chaque segment mène à un nom que la coque résout ;
//   A2 « À déclarer » suit le statut (profilFiscal) : en cours ⇒ lecture ; pas choisi ou
//      « je ne sais pas » ⇒ « — » + choisis ton statut ; particulier ⇒ « Rien » (aucun
//      montant) ; société / marge ⇒ « Export » (aucun montant) ; micro ⇒ le CA de la
//      prévision et sa date, « au moins » si partiel, jamais « au moins 0 » ;
//   A3 vendu / reçu / bénéfice : la valeur de `valeurChiffre` telle quelle (rien de
//      recalculé), « — » + la raison courte quand elle manque ;
//   A4 la coque : UNE entrée « Argent » (`compta`), plus d'entrée `dashboard` ; les
//      anciens noms (argent, stats, argent_declarer) dans ONGLETS_DEPLACES et la liste
//      blanche des liens ; Ma journée (URSSAF, DAC7) mène à « Déclarer » ;
//   A5 jamais « encaissé » dans argent.js, styles-argent.css et les phrases d'Argent.
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; if (!PROUVE) console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + det : ''}`); };

async function juger(srcArgent, srcApp) {
  ok = 0; ko = 0;
  const tmp = path.join(require('os').tmpdir(), `argent-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, srcArgent);
  const A = await import('file://' + tmp);
  fs.unlinkSync(tmp);
  // A1
  dit(A.SEGMENTS_ARGENT.map((s) => s.id).join(',') === 'resume,stats,declarer,factures', 'A1 quatre segments, dans l\'ordre');
  dit(A.SEGMENTS_ARGENT.every((s) => A.ONGLET_SEGMENT[s.id]), 'A1 chaque segment a son nom pour la coque');
  dit(A.vueCompta('declarer') === 'declarer' && A.vueCompta('factures') === 'factures' && A.vueCompta('ventes') === 'resume' && A.vueCompta(null) === 'resume', 'A1 la vue de Compta : une section inconnue ⇒ le Résumé');
  dit(A.segmentArgent('dashboard', 'prix') === 'stats' && A.segmentArgent('compta', 'compta') === 'resume' && A.segmentArgent('ventes', null) === null, 'A1 le segment allumé');
  // A2
  const P = { etat: 'lu', ca: 148, apayer: 18.35, partiel: false, aDater: 0, dueDate: Date.parse('2026-11-30T12:00:00'), label: 'octobre 2026' };
  const d = (p, profil) => A.declarerDe(p, profil, () => '30 nov.');
  dit(d(P, { etat: 'encours' }).raison === 'encours' && d(P, { etat: 'encours' }).valeur == null, 'A2 statut en cours de lecture ⇒ « lecture… », aucun montant');
  for (const e of ['aChoisir', 'inconnu']) { const x = d(P, { etat: e }); dit(x.valeur == null && !x.texte && /statut/.test(x.note), `A2 statut ${e} ⇒ « — » et « choisis ton statut »`, JSON.stringify(x)); }
  const pa = d(P, { etat: 'particulier' });
  dit(pa.valeur == null && pa.texte === 'Rien' && /pas d’URSSAF/.test(pa.note), 'A2 particulier ⇒ « Rien », aucun montant d\'URSSAF', JSON.stringify(pa));
  for (const e of ['societe', 'marge']) { const x = d(P, { etat: e }); dit(x.valeur == null && x.texte === 'Export', `A2 ${e} ⇒ « Export », aucun montant`, JSON.stringify(x)); }
  const mi = d(P, { etat: 'micro' });
  dit(mi.valeur === 148 && /avant le 30 nov\./.test(mi.note) && !mi.partiel, 'A2 micro ⇒ le CA de la prévision, et sa date', JSON.stringify(mi));
  const mp = d({ ...P, partiel: true, aDater: 2 }, { etat: 'micro' });
  dit(mp.valeur === 148 && mp.partiel && /2 ventes à dater/.test(mp.note), 'A2 micro partiel ⇒ « au moins » et les ventes à dater nommées', JSON.stringify(mp));
  const m0 = d({ ...P, ca: 0, partiel: true }, { etat: 'micro' });
  dit(m0.valeur == null, 'A2 jamais « au moins 0 »', JSON.stringify(m0));
  const mr = d({ etat: 'rythme' }, { etat: 'micro' });
  dit(mr.valeur == null && /rythme/.test(mr.note), 'A2 rythme jamais choisi ⇒ « — » et le geste', JSON.stringify(mr));
  const mx = d({ ...P, etat: 'passu', ca: null }, { etat: 'micro' });
  dit(mx.valeur == null && /avant le/.test(mx.note), 'A2 CA pas calculé ⇒ « — », la date reste dite', JSON.stringify(mx));
  // A3
  const rc = (x) => (x.raison === 'achats' ? 'prix d’achat manquants' : x.aDater ? `+ ${x.aDater} vente à dater` : '');
  const Q = A.questionsArgent({ vendu: { valeur: 272, partiel: false, manque: [] }, recu: { valeur: 148, partiel: false, aDater: 1 }, benefice: { valeur: null, raison: 'achats' }, prevision: P, profil: { etat: 'micro' }, raisonCourte: rc, mois: 'nov.', dateCourte: () => '30 nov.' });
  dit(Q.map((q) => q.id).join(',') === 'vendu,recu,benefice,declarer', 'A3 les quatre réponses, dans l\'ordre');
  dit(Q[0].valeur === 272 && Q[1].valeur === 148 && /à dater/.test(Q[1].note), 'A3 vendu et reçu : la valeur telle quelle, le manque dit', JSON.stringify(Q.slice(0, 2)));
  dit(Q[2].valeur == null && Q[2].note === 'prix d’achat manquants', 'A3 bénéfice pas su ⇒ « — » et sa raison', JSON.stringify(Q[2]));
  const Qp = A.questionsArgent({ vendu: { valeur: 50, partiel: true, manque: ['Leboncoin'] }, recu: null, benefice: null, prevision: null, profil: null, raisonCourte: rc });
  dit(Qp[0].partiel && Qp[0].note === 'sans Leboncoin' && Qp[1].valeur == null && Qp[3].valeur == null, 'A3 partiel ⇒ « au moins » + ce qui manque ; rien lu ⇒ « — »', JSON.stringify(Qp));
  // A4
  const grp = (srcApp.match(/const GROUPES_PLUS=\[[\s\S]*?\n\];/) || [''])[0];
  dit(/\{id:'compta',\s*icon:'euro',\s*label:'Argent'\}/.test(grp) && !/id:'dashboard'/.test(grp) && !/label:'Compta'/.test(grp), 'A4 la navigation : UNE entrée « Argent », plus « Statistiques » ni « Compta »');
  dit(/\.\.\.CHEMINS_ARGENT,\s*\n\};/.test(srcApp) && /const ONGLETS_LIENS=\[\.\.\.Object\.keys\(CHEMINS_ARGENT\)/.test(srcApp), 'A4 les anciens noms sont résolus et ouvrables par lien');
  dit(/tab:'argent_declarer', jr:true, job:'urssaf'/.test(srcApp) && /tab:'argent_declarer', jr:true, job:'dac7'/.test(srcApp), 'A4 Ma journée (URSSAF, DAC7) mène à « Déclarer »');
  dit(/dashboard:'compta'/.test((srcApp.match(/const BAR_GROUPE=\{[\s\S]*?\};/) || [''])[0]), 'A4 Statistiques garde l\'entrée « Argent » allumée');
  // A5
  const css = fs.readFileSync(path.join(R, 'src', 'styles-argent.css'), 'utf8');
  dit(!/encaiss/i.test(srcArgent.replace(/\/\/.*$/gm, '')) && !/encaiss/i.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'A5 jamais « encaissé »');
  return ko;
}

(async () => {
  const srcA = fs.readFileSync(path.join(R, 'src', 'argent.js'), 'utf8');
  const srcApp = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  if (!PROUVE) {
    const k = await juger(srcA, srcApp);
    console.log(k ? `❌ audit-argent : ${k} rouge(s), ${ok} vert(s)` : `✅ audit-argent : ${ok} verts, 0 rouge`);
    process.exit(k ? 1 : 0);
  }
  const M = [
    ['particulier ⇒ un montant', (a) => a.replace("if (etat === 'particulier') return vide('particulier : pas d’URSSAF', 'particulier', 'Rien');", ''), null],
    ['statut pas choisi ⇒ calculé', (a) => a.replace("if (etat === 'aChoisir' || etat === 'inconnu') return vide('choisis ton statut', 'statut');", ''), null],
    ['au moins 0', (a) => a.replace('if (P.partiel && !(P.ca > 0))', 'if (false)'), null],
    ['date oubliée', (a) => a.replace("const quand = P.dueDate ? `avant le ${dateCourte(P.dueDate)}` : '';", "const quand = '';"), null],
    ['segments dans le désordre', (a) => a.replace("Object.freeze({ id: 'stats', l: 'Statistiques', tab: 'dashboard', sub: 'stats' }),\n  Object.freeze({ id: 'declarer', l: 'Déclarer', tab: 'compta', sub: 'declarer' }),", "Object.freeze({ id: 'declarer', l: 'Déclarer', tab: 'compta', sub: 'declarer' }),\n  Object.freeze({ id: 'stats', l: 'Statistiques', tab: 'dashboard', sub: 'stats' }),"), null],
    ['manque tu', (a) => a.replace("x.partiel && x.manque && x.manque.length ? `sans ${x.manque[0]}` : ''", "''"), null],
    ['entrée Statistiques remise', null, (s) => s.replace("{id:'compta',    icon:'euro',  label:'Argent'},", "{id:'dashboard', icon:'chart', label:'Statistiques'},\n    {id:'compta',    icon:'euro',  label:'Argent'},")],
    ['Ma journée vers compta', null, (s) => s.replace("tab:'argent_declarer', jr:true, job:'urssaf'", "tab:'compta', jr:true, job:'urssaf'")],
  ];
  let rouges = 0;
  for (const [nom, fa, fs2] of M) {
    const a = fa ? fa(srcA) : srcA, s = fs2 ? fs2(srcApp) : srcApp;
    if (a === srcA && s === srcApp) { console.log(`⚠️  mutation « ${nom} » ne s'applique pas`); continue; }
    const k = await juger(a, s);
    console.log(`${k ? '✅' : '❌'} mutation « ${nom} » : ${k} rouge(s)`);
    if (k) rouges++;
  }
  console.log(rouges === M.length ? `✅ audit-argent --prouve : ${rouges}/${M.length} mutations rouges` : `❌ audit-argent --prouve : ${rouges}/${M.length}`);
  process.exit(rouges === M.length ? 0 : 1);
})();
