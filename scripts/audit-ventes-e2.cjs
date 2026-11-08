// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « VENTES » — chantier E2 du 5 nov. (docs/passation/2026-11-05-chantier-e2.md)
//  Les règles qui se jugent SANS rendu. Il EXÉCUTE (esbuild → CommonJS, require) :
//   R1 les mots de l'état d'une vente (`motEtatVente`) : « À envoyer », « En route » ;
//   R2 « À venir » : un seul groupe ⇒ aucune ligne (le total une fois), plusieurs ⇒ une
//      ligne chacun (`lignesAVenir`) ;
//   R3 « un compte annule nettement plus » (`comptesQuiAnnulent`) jugé sur la VRAIE règle
//      `annulationsParCompte` (src/annulationsCompte.js) : signalé quand il le faut,
//      jamais quand c'est pas su (en cours, raté, partiel), à égalité, sur un petit
//      nombre, avec un seul compte, ni pour un compte exclu ;
//   R4 la fiabilité du bénéfice (`FiabiliteVentes`, rendue) : aucune cause à zéro écrite,
//      plus de « 0 sur N calculable » ;
//  et LIT src/App.jsx (commentaires retirés) :
//   S1 le pied de Ventes ne rend ni « Vendus ailleurs » ni le bilan des données (2.30) ;
//   S2 « Compte qui vend le mieux » n'est plus dans Ventes (une place : Statistiques) ;
//   S3 les filtres et les états de Ventes passent par les mots de `src/libelles.js` ;
//   S4 « Tous » : plus de compteur « N sur N résultats » ; l'état sur sa propre ligne ;
//   S5 l'alerte d'annulations lit `annulationsParCompte` (jamais une copie de la règle).
//  `--prouve` : chaque mutation réaffaiblit une règle ; l'audit doit devenir rouge.
//  `node scripts/audit-ventes-e2.cjs [--prouve]`
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const NM = [path.join(R, 'node_modules'), path.join(R, '..', '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
const esbuild = require(path.join(NM, 'esbuild'));
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// Chaque mutation : [fichier, motif, remplacement]. Le motif doit exister.
const MUTATIONS = {
  mot_envoyer: ['src/ventesEcran.js', "'À expédier': L.aEnvoyer, ", ''],
  mot_route: ['src/ventesEcran.js', "'En transit': L.enRoute", "'En transit': 'En transit'"],
  avenir_un_groupe: ['src/ventesEcran.js', 'if (g.length <= 1) return', 'if (g.length < 1) return'],
  annul_partiel: ['src/ventesEcran.js', "R.etat !== 'lu' || R.partiel ||", "R.etat !== 'lu' ||"],
  annul_reperes: ['src/ventesEcran.js', 'if (nA < s.minAutres) continue;', ''],
  annul_ecart: ['src/ventesEcran.js', 't - tA >= s.ecartPoints', 't - tA >= 0'],
  annul_petit: ['src/ventesEcran.js', 'if (g.n < s.minVentes || g.annulees < s.minAnnulees) continue;', ''],
  fiab_zero: ['src/FiabiliteVentes.jsx', 'r.prixManquant>0&&pl(', 'r.prixManquant>=0&&pl('],
  fiab_titre: ['src/FiabiliteVentes.jsx', "r.calculables===0?`Bénéfice : aucune des ${pl(r.total,'vente')} n’est calculable`:", ''],
  pied_vendus: ['src/App.jsx', '  <GelPendantFrappe gel={ordSearch!==ordSearchDiff} rendre={()=><>\n', "  <GelPendantFrappe gel={ordSearch!==ordSearchDiff} rendre={()=><>\n  <VendusAilleurs owner={AUTH.user?.id||''} ownerActuel={()=>AUTH.user?.id||''} charger={chargerRetraitsMulti} onNav={onNav} PhotoVinted={PhotoVinted}/>\n"],
  filtre_mot: ['src/App.jsx', "['aexpedier',L.aEnvoyer]", "['aexpedier','À expédier']"],
  compteur: ['src/App.jsx', '            {lignes.length > n && <Bouton variante="secondaire" plein data-toutes-plus=""', '            <CompteurListe affiches={n} total={lignes.length}/>{lignes.length > n && <Bouton variante="secondaire" plein data-toutes-plus=""'],
  annul_copie: ['src/App.jsx', 'const R = annulationsParCompte({ ventes: sales.items,', 'const R = ({ ventes: sales.items,'],
};

async function construire(mutation) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ventes-e2-'));
  const src = (f) => JSON.stringify(path.join(R, 'src', f));
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
export * as V from ${src('ventesEcran.js')};
export * as A from ${src('annulationsCompte.js')};
export { default as FiabiliteVentes } from ${src('FiabiliteVentes.jsx')};
export const rendre = (el) => renderToStaticMarkup(el);
export { React };
`);
  const plugins = mutation ? [{ name: 'mutant', setup(b) {
    const cible = path.join(R, mutation[0]);
    b.onLoad({ filter: /\.(jsx?)$/ }, (a) => {
      if (path.resolve(a.path) !== cible) return undefined;
      return { contents: fs.readFileSync(a.path, 'utf8').replace(mutation[1], mutation[2]), loader: 'jsx' };
    });
  } }] : [];
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outfile: path.join(dir, 'sortie.cjs'), format: 'cjs', platform: 'node', jsx: 'automatic',
    loader: { '.js': 'jsx' }, nodePaths: [NM], logLevel: 'silent', plugins, define: { 'process.env.NODE_ENV': '"production"' } });
  return require(path.join(dir, 'sortie.cjs'));
}

// ── Les règles exécutées ────────────────────────────────────────────────────
async function audit(M, bavard) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (bavard || !bon) console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };
  const { V, A } = M;
  // R1
  dit(V.motEtatVente('À expédier') === 'À envoyer' && V.motEtatVente('À poster') === 'À envoyer', 'R1 « À expédier » / « À poster » s’écrivent « À envoyer »', V.motEtatVente('À expédier'));
  dit(V.motEtatVente('En transit') === 'En route', 'R1 « En transit » s’écrit « En route »', V.motEtatVente('En transit'));
  dit(V.motEtatVente('Vendue') === 'Vendue' && V.motEtatVente('') === '' && V.motEtatVente(null) === '', 'R1 les autres états restent tels quels');
  // R2
  const g = (p, c, eur) => ({ plateforme: p, compte: c, n: 1, eur, prevu: null });
  const un = V.lignesAVenir([g('Vinted', 'a', 124)]);
  dit(un.lignes.length === 0 && un.resume && un.resume.compte === 'a', 'R2 un seul groupe ⇒ aucune ligne (le total une fois), le groupe en phrase', JSON.stringify(un));
  const deux = V.lignesAVenir([g('Vinted', 'a', 70), g('Vinted', 'b', 45.5)]);
  dit(deux.lignes.length === 2 && deux.resume === null, 'R2 deux groupes ⇒ une ligne chacun', JSON.stringify(deux));
  dit(V.lignesAVenir([]).lignes.length === 0 && V.lignesAVenir(null).resume === null, 'R2 aucun groupe ⇒ rien');
  // R3 — sur la VRAIE règle de Statistiques.
  const T0 = Date.UTC(2026, 10, 5, 12), jour = 86400000;
  const v = (uid, i, annulee, j = 3) => ({ _acc: { vinted_user_id: uid, login: 'c' + uid }, transaction_id: uid * 1000 + i, title: 'Paire ' + i, status: annulee ? 'Commande annulée' : 'Commande finalisée', date: new Date(T0 - j * jour).toISOString(), price: { amount: '50' } });
  const serie = (uid, n, a, j) => Array.from({ length: n }, (_, i) => v(uid, i, i < a, j));
  const f = V.fenetreAnnulations(T0);
  const estAnnulee = (o) => /annul/i.test(o.status);
  const mesure = (ventes, opts = {}) => V.comptesQuiAnnulent(A.annulationsParCompte({ ventes, de: f.de, a: f.a, estAnnulee, ...opts }));
  const net = mesure([...serie(111, 8, 0), ...serie(222, 6, 3)]);
  dit(net.length === 1 && net[0].uid === '222' && net[0].annulees === 3 && net[0].n === 6 && net[0].liste.length === 3, 'R3 3 annulations sur 6 contre 0 sur 8 ⇒ ce compte est signalé, avec SES 3 ventes', JSON.stringify(net.map((x) => [x.uid, x.annulees, x.n, x.liste.length])));
  dit(net[0] && net[0].tauxAutres === 0 && net[0].taux === 50, 'R3 les parts dites : 50 % contre 0 %', JSON.stringify(net[0] && [net[0].taux, net[0].tauxAutres]));
  dit(mesure([...serie(111, 8, 2), ...serie(222, 9, 3)]).length === 0, 'R3 parts proches (25 % contre 33 %) ⇒ aucune alerte');
  dit(mesure([...serie(111, 100, 1), ...serie(222, 100, 2)]).length === 0, 'R3 2 % contre 1 % (double, mais rien) ⇒ aucune alerte');
  dit(mesure([...serie(111, 8, 0), ...serie(222, 3, 2)]).length === 0, 'R3 trop peu de ventes (2 sur 3) ⇒ aucune alerte');
  dit(mesure([...serie(111, 2, 0), ...serie(222, 6, 3)]).length === 0, 'R3 les autres comptes trop peu vendus pour servir de repère ⇒ aucune alerte');
  dit(mesure(serie(222, 6, 3)).length === 0, 'R3 un seul compte ⇒ rien à comparer');
  dit(mesure([...serie(111, 8, 0), ...serie(222, 6, 3)], { ko: ['333'] }).length === 0, 'R3 un compte pas lu (partiel) ⇒ pas su, aucune alerte');
  dit(V.comptesQuiAnnulent(A.annulationsParCompte({ ventes: undefined })).length === 0 && V.comptesQuiAnnulent(A.annulationsParCompte({ ventes: null })).length === 0, 'R3 lecture en cours ou ratée ⇒ aucune alerte');
  dit(mesure([...serie(111, 8, 0), ...serie(222, 6, 3)], { ecarte: (u) => u === '222' }).length === 0, 'R3 le compte exclu n’est jamais signalé');
  dit(mesure([...serie(111, 8, 0), ...serie(222, 6, 3, 45)]).length === 0, 'R3 des annulations d’il y a 45 jours ne comptent pas (30 jours)');
  // R4 — la fiabilité rendue.
  const html = (lignes) => M.rendre(M.React.createElement(M.FiabiliteVentes, { lignes, perimetre: 'Vinted · ventes finalisées' })).replace(/<[^>]+>/g, ' ');
  const l = (achatConnu) => ({ incluse: true, supporte: true, achatConnu, prixConnu: true, valide: achatConnu, fraisConfirmes: true });
  const h0 = html([l(false), l(false)]);
  dit(!/\b0 (prix|vente|commande)/.test(h0) && !/0 sur 2/.test(h0), 'R4 aucune cause à zéro écrite, plus de « 0 sur N calculable »', h0.slice(0, 200));
  dit(/aucune des 2 ventes/.test(h0) && /2 prix d’achat manquants/.test(h0), 'R4 le titre dit ce qui manque', h0.slice(0, 200));
  dit(/calculable sur les 2 ventes/.test(html([l(true), l(true)])), 'R4 tout calculable ⇒ « calculable sur les 2 ventes »');
  return ko;
}

// ── Les règles lues dans App.jsx ────────────────────────────────────────────
function statiques(bavard) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (bavard || !bon) console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };
  const app = sansCommentaires(require("./_source-app.cjs").sourceApp());
  const bloc = (debut, fin) => { const a = app.indexOf(debut); if (a < 0) return ''; const b = app.indexOf(fin, a + debut.length); return app.slice(a, b < 0 ? a + 20000 : b); };
  const pied = bloc('className="vrm-ventes-controles"', '</section>');
  dit(pied.length > 0 && !/<VendusAilleurs\b/.test(pied) && !/<BilanSynchronisation\b/.test(pied), 'S1 le pied de Ventes : ni « Vendus ailleurs » ni le bilan des données', pied.slice(0, 200));
  dit(!/Compte qui vend le mieux/.test(app) && /Quel compte vend le mieux/.test(app) && !/data-ventes-par-compte/.test(app), 'S2 « Compte qui vend le mieux » : une seule place, Statistiques');
  // Les DEUX rangées de filtres de Ventes : Vinted (dans l'écran) et `FiltresVentes` (Leboncoin, eBay).
  const rangees = (app.match(/\[\['all','Toutes'\][\s\S]*?(?=\.map\(|\];)/g) || []).filter((f) => /'aexpedier'|'pending',/.test(f));
  dit(rangees.length >= 2 && rangees.every((f) => /L\.aEnvoyer/.test(f) && !/À expédier|En transit|À poster/.test(f)) && rangees.some((f) => /L\.enRoute/.test(f)),
    'S3 les filtres de Ventes (Vinted, Leboncoin, eBay) : « À envoyer », « En route » (src/libelles.js)', rangees.join(' ¦ ').slice(0, 300));
  dit(/etat=\{motEtatVente\(venteStage\(o\)\.label\)\}/.test(app), 'S3 l’état d’une ligne Vinted passe par `motEtatVente`');
  const toutes = bloc('function VentesToutes(', 'function AppCoeur(');
  dit(toutes.length > 0 && !/CompteurListe/.test(toutes) && !/résultats/.test(toutes), 'S4 « Tous » : plus de compteur « N sur N résultats »');
  dit(/className="vrm-toutes-etat"/.test(toutes) && /motEtatVente\(l\.etat\)/.test(toutes), 'S4 « Tous » : l’état sur sa propre ligne, avec le mot retenu');
  dit(/<details className="vrm-toutes-repli"/.test(toutes), 'S4 « Tous » : « jamais lu » replié en une ligne');
  const alerte = bloc('fenetreAnnulations()', 'comptesQuiAnnulent(R)');
  dit(/annulationsParCompte\(\{/.test(alerte), 'S5 l’alerte lit `annulationsParCompte` (la règle de Statistiques)', alerte.slice(0, 160));
  const ve = sansCommentaires(lire('src/ventesEcran.js'));
  dit(!/classifyOrderStatus|annul[ée]e?\s*[:=]\s*\/|status\)/.test(ve), 'S5 src/ventesEcran.js ne redéfinit pas « annulée »');
  return ko;
}

(async () => {
  if (process.argv.includes('--prouve')) {
    let rate = 0;
    for (const [nom, mu] of Object.entries(MUTATIONS)) {
      const p = path.join(R, mu[0]); const avant = fs.readFileSync(p, 'utf8');
      if (!avant.includes(mu[1])) { console.log(`❌ mutation ${nom} : motif absent de ${mu[0]}`); rate++; continue; }
      let ko = 0;
      if (mu[0] === 'src/App.jsx') {
        try { fs.writeFileSync(p, avant.replace(mu[1], mu[2])); ko = statiques(false); } finally { fs.writeFileSync(p, avant); }
      } else {
        try { ko = await audit(await construire(mu), false); } catch (e) { ko = 1; }
      }
      console.log(`${ko ? '✅' : '❌'} mutation ${nom} : ${ko ? ko + ' rouge(s)' : 'AUCUN rouge'}`);
      if (!ko) rate++;
    }
    console.log(rate ? `\n❌ ${rate} mutation(s) sans rouge` : `\n✅ ${Object.keys(MUTATIONS).length} mutations, toutes rouges`);
    process.exit(rate ? 1 : 0);
  }
  let ko = statiques(true);
  ko += await audit(await construire(null), true);
  console.log(ko ? `\n❌ audit-ventes-e2 : ${ko} contrôle(s) en échec` : '\n✅ audit-ventes-e2 : tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
