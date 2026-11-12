// ════════════════════════════════════════════════════════════════════════════
//  GARDIEN — FAMILLE « PAS SU ≠ 0 » (11 nov., familles de l'app)
//  §5 : un montant inconnu n'est jamais 0 € ; un total partiel dit « au moins … »
//  et sa couverture ; rien de connu ⇒ « — ». Règle unique : src/sommeConnue.js.
//   A. la règle exécutée (somme, texte, couverture, médiane, autre devise) ;
//   B. les endroits corrigés EXÉCUTÉS : montantCommandeLu (devise), lbcArgent
//      (Leboncoin), export comptable (mois illisible), CA de l'année (micro) ;
//   C. CLIQUET : les motifs « inconnu ⇒ 0 » restants ne peuvent que DIMINUER
//      (plafond par fichier) ; à zéro dans les fichiers déjà corrigés.
//    node scripts/audit-pas-su.cjs            → contrôle
//    node scripts/audit-pas-su.cjs --prouve   → chaque mutation doit faire rougir
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { prouver, sansCommentaires, fichiers, extraire } = require('./_mutations-gardien.cjs');

const R = process.env.VRM_RACINE || path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['somme : inconnu compté 0', 'src/sommeConnue.js', "    if (v == null) continue;\n    connus++;", "    if (v == null) { connus++; continue; }\n    connus++;"],
    ['autre devise lue en euros', 'src/App.jsx', "if (typeof p === 'object' && p.currency_code && String(p.currency_code).toUpperCase() !== 'EUR') return null;", ''],
    ['Leboncoin : prix absent = 0 €', 'src/App.jsx', "const recuS = sommeConnue(finals, prixLbcSu), attenteS = sommeConnue(enCours, prixLbcSu);", "const recuS = sommeConnue(finals, (o) => prixLbcSu(o) || 0), attenteS = sommeConnue(enCours, (o) => prixLbcSu(o) || 0);"],
    ['export : mois illisible = 0,00 €', 'src/exportComptable.js', "const ca = m ? valeurSue(m.ca) : 0;", "const ca = m ? Number(m.ca) || 0 : 0;"],
    ['CA de l’année : mois illisible sauté en silence', 'src/microEntreprise.js', "  if (illisibles) raisons.push(`${illisibles} mois au chiffre illisible`);", ''],
    ['courbe des mois : pas su = barre à 0', 'src/ecrans/Stats.jsx', "const brut=mois.map(m=>valeurSue(valeur(m)));", "const brut=mois.map(m=>Number(valeur(m))||0);"],
    ['grille Achats : somme qui compte 0 €', 'src/App.jsx', "          const somme = (l)=>sommeConnue(l, M);", "          const somme = (l)=>sommeConnue(l, (o)=>montantCommande(o)); const _m = (l)=>l.reduce((a,o)=>a+montantCommande(o),0);"],
  ];
  process.exit(prouver(__filename, MUT, R) ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const imp = async (f) => { try { return await import('file://' + path.join(R, f)); } catch (e) { return { __erreur: e.message }; } };

(async () => {
  console.log('── A · La règle (src/sommeConnue.js)');
  const S = await imp('src/sommeConnue.js');
  if (S.__erreur) dit(false, 'src/sommeConnue.js se charge', S.__erreur);
  else {
    const r = S.sommeConnue([10, null, '12,50', { amount: '5', currency_code: 'GBP' }, '', 'abc']);
    dit(r.total === 22.5 && r.n === 6 && r.connus === 2 && r.manque === 4 && r.partiel, 'un prix absent, illisible ou dans une autre devise est compté à part, jamais 0 €', JSON.stringify(r));
    dit(S.texteSomme(r) === 'au moins 22,50 €' && S.texteCouverture(r, 'achats') === 'sur 2 achats sur 6', 'partielle ⇒ « au moins 22,50 € » · « sur 2 achats sur 6 »', `${S.texteSomme(r)} / ${S.texteCouverture(r, 'achats')}`);
    const t = S.sommeConnue([null, 'x']);
    dit(t.total === null && S.texteSomme(t) === '—', 'rien de su ⇒ « — » (jamais « au moins 0 € »)', `${t.total} / ${S.texteSomme(t)}`);
    const v = S.sommeConnue([]);
    dit(v.total === 0 && !v.partiel && S.texteSomme(v) === '0 €', 'liste lue et vide ⇒ 0 € (rien, pas « pas su »)', S.texteSomme(v));
    const c = S.sommeConnue([0.1, 0.2]);
    dit(c.total === 0.3, 'somme au centime (0,10 + 0,20 = 0,30)', c.total);
    dit(S.medianeSue([4, 1, 3, 2]) === 2.5 && S.medianeSue([3, 1, 2]) === 2 && S.medianeSue([null]) === null, 'médiane : moyenne des deux centrales ; aucune valeur ⇒ null (« — »)', `${S.medianeSue([4, 1, 3, 2])}`);
  }

  console.log('\n── B · Les endroits corrigés, exécutés');
  const APP = require(path.join(R, 'scripts', '_source-app.cjs')).sourceApp(R);
  {
    const ctx = { Number, String, Math, isFinite, Array, Object };
    vm.createContext(ctx);
    if (!S.__erreur) Object.assign(ctx, { sommeConnue: S.sommeConnue });
    const noms = ['montantCommandeLu', 'lbcAnnulee', 'lbcFinalisee', 'prixLbcSu', 'lbcArgent'];
    const absents = [];
    for (const n of noms) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' (' + e.message + ')'); } }
    dit(!absents.length, 'App.jsx : montantCommandeLu, lbcArgent et leurs règles se lisent', absents.join(', '));
    if (ctx.montantCommandeLu) {
      dit(ctx.montantCommandeLu({ price: { amount: '12.5', currency_code: 'GBP' } }) === null && ctx.montantCommandeLu({ price: { amount: '12.5', currency_code: 'EUR' } }) === 12.5,
        'Vinted : une commande en GBP n’entre pas en euros (écartée, jamais convertie)', String(ctx.montantCommandeLu({ price: { amount: '12.5', currency_code: 'GBP' } })));
    }
    if (ctx.lbcArgent) {
      let a = null; try { a = ctx.lbcArgent({ ventes: [{ price: 1000, parcelColor: 'finished' }, { price: null, parcelColor: 'finished' }, { price: 2500, parcelColor: 'ongoing' }] }); } catch (e) { a = { erreur: e.message }; }
      dit(a && a.recu === 10 && a.recuS && a.recuS.partiel && a.attente === 25 && !a.attenteS.partiel, 'Leboncoin : « CA finalisé » au prix inconnu ⇒ au moins 10 €, le manque compté', JSON.stringify(a && { recu: a.recu, recuS: a.recuS, attente: a.attente }));
      let b = null; try { b = ctx.lbcArgent({ ventes: [{ price: null, parcelColor: 'finished' }] }); } catch (e) { b = { erreur: e.message }; }
      dit(b && b.recu === null, 'Leboncoin : aucun prix lu ⇒ « — », jamais 0 €', JSON.stringify(b && b.recu));
    }
  }
  {
    const E = await imp('src/exportComptable.js');
    if (E.__erreur) dit(false, 'src/exportComptable.js se charge', E.__erreur);
    else {
      let d = null;
      try { d = E.donneesExportComptable({ periode: '2026-10', ligne: { mois: [{ ym: '2026-10', ca: 'illisible', n: 2 }] }, regime: 'micro', taux: 12.4, montantPeriode: () => ({ ca: null, apayer: null, partiel: true }), aPayer: (ca) => ca * 0.124, maintenant: Date.parse('2026-11-05T10:00:00Z') }); } catch (e) { d = { erreur: e.message }; }
      const m = d && d.caParMois && d.caParMois[0];
      dit(m && m.ca === null && m.urssaf === null, 'export comptable : un mois au CA illisible s’écrit « — » (CA et URSSAF), jamais 0,00 €', JSON.stringify(m || d));
    }
    const M = await imp('src/microEntreprise.js');
    if (M.__erreur) dit(false, 'src/microEntreprise.js se charge', M.__erreur);
    else {
      const c = M.caAnnee({ mois: [{ ym: '2026-01', ca: 100 }, { ym: '2026-02', ca: 'x' }] }, 2026);
      dit(c && c.ca === 100 && c.partiel && c.raisons.some((x) => /illisible/.test(x)), 'CA de l’année : un mois illisible le rend « au moins », raison dite', JSON.stringify(c));
    }
  }

  console.log('\n── C · Cliquet : « inconnu ⇒ 0 » ne peut que diminuer');
  const MOTIFS = {
    'somme de montantCommande (0 sur prix illisible)': /(\+=|\+)\s*\(?\s*montantCommande\(|reduce\([^;\n]*montantCommande\(/g,
    'prix Vinted absent ⇒ 0': /\.amount\s*!=\s*null\s*\?\s*Number\([^)]*\)\s*:\s*0\b/g,
    '(+x.prix || 0)': /\(\s*\+\s*[\w.?]+\.(buyPrice|sellPrice|price)\s*\|\|\s*0\s*\)/g,
    'Number(valeur(m)) || 0': /Number\(\s*valeur\([^)]*\)\s*\)\s*\|\|\s*0/g,
    'médiane = élément du haut': /\[Math\.floor\(\w+\.length\s*\/\s*2\)\]/g,
  };
  // Plafonds au 11 nov. (après corrections). Un nouveau motif ⇒ rouge ; un motif retiré ⇒ baisser le plafond.
  const PLAFOND = {
    // (12 nov., revue fin) abaissés : 18 → 0, 3 → 1 (le reste : zone Colis, déjà « au moins »), 2 → 0, 1 → 0.
    'somme de montantCommande (0 sur prix illisible)': { 'src/App.jsx': 1 },
    'prix Vinted absent ⇒ 0': {},
    '(+x.prix || 0)': {},
    'Number(valeur(m)) || 0': {},
    'médiane = élément du haut': {},
  };
  const textes = fichiers(path.join(R, 'src')).map((f) => [path.relative(R, f).split(path.sep).join('/'), sansCommentaires(fs.readFileSync(f, 'utf8'))]);
  for (const [nom, re] of Object.entries(MOTIFS)) {
    const trop = [];
    for (const [rel, t] of textes) {
      if (rel === 'src/sommeConnue.js') continue;
      const n = (t.match(re) || []).length;
      const max = PLAFOND[nom][rel] || 0;
      if (n > max) trop.push(`${rel} ${n} > ${max}`);
    }
    dit(!trop.length, `« ${nom} » : pas un de plus (Achats, Stats, Compta, Leboncoin, export : 0)`, trop.join(', '));
  }

  console.log(`\n${ko ? '❌' : '✅'} pas su ≠ 0 : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
