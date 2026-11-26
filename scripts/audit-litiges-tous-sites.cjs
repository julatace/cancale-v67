// ════════════════════════════════════════════════════════════════════════════
// AUDIT : « LITIGES ET RETOURS » — TOUS LES SITES, VENTES ET ACHATS
//         node scripts/audit-litiges-tous-sites.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// (23 nov., lot litiges-retours) Julien (validé le 23 nov.) : un écran tous sites,
// chaque litige / retour en cours avec son état, sa date limite (LUE, jamais
// inventée ; sinon « pas su »), le geste (un lien direct). Cet audit EXÉCUTE
// src/litigesTousSites.js sur des cartes INVENTÉES à la forme des règles
// (`litigesDesVentes`, `retoursAchat`) :
//   L1 ventes ET retours d'achat en cours sur une liste ; un retour REMBOURSÉ n'y est plus ;
//   L2 la date limite n'est dite que LUE (texte ET date lisible) ; sinon « non lue » ;
//   L3 le plus pressé d'abord, puis la date lue la plus proche, puis sans date ;
//   L4 le geste : la conversation, sinon la transaction, sinon la boîte — toujours vinted.fr ;
//   L5 Leboncoin / Vestiaire « jamais vu » restent NOMMÉS (manques, total « au moins ») ;
//   L6 rien lu ⇒ « encours » / « passu », jamais une liste vide présentée complète ;
//   L7 deux retours au MÊME titre, deux transactions ⇒ deux lignes (identité, jamais le titre) ;
//   B  le branchement : Comptabilité passe `ra`, l'écran rend les achats en `data-retour-achat-ligne`
//      (jamais `data-litige-carte`), textes par tr() en 5 langues, titre « Litiges et retours ».
// `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const charger = async (texte) => {
  const tmp = path.join(R, 'src', `.audit-lts-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte);
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};
const T0 = Date.parse('2026-11-23T10:00:00Z');
const ventes = () => ({ etat: 'lu', anciennes: [], manques: ['Leboncoin', 'Vestiaire'], cartes: [
  { cle: 'tx:9401', plateforme: 'vinted', genre: 'retour', tx: '9401', num: '21', titre: 'Paire A', limite: null, limiteTexte: '', presse: false, depassee: false, geste: { url: 'https://www.vinted.fr/inbox/c1', libelle: 'Suivre le retour sur Vinted' }, depuis: '2026-11-20T09:00:00Z' },
  { cle: 'tx:9402', plateforme: 'vinted', genre: 'probleme', tx: '9402', num: '22', titre: 'Paire B', limite: '2026-11-24T22:59:00Z', limiteTexte: '24 nov.', presse: true, depassee: false, geste: { url: 'https://www.vinted.fr/inbox/c2', libelle: 'Répondre sur Vinted' }, depuis: '2026-11-21T09:00:00Z' },
], plateformes: [
  { site: 'vinted', etat: 'lu', raison: '' }, { site: 'leboncoin', etat: 'jamais-vu', raison: 'un litige Leboncoin ne se lit pas encore' }, { site: 'vestiaire', etat: 'jamais-vu', raison: '' },
] });
const achats = () => ({ etat: 'lu', manques: [], cartes: [
  { cle: 'r:7001', tx: '7001', conv: 'k1', titre: 'Même titre', num: '30', etape: 'a-deposer', limiteIso: '2026-11-26T09:00:00Z', limiteTexte: '26 nov.', presse: false, depassee: false },
  { cle: 'r:7002', tx: '7002', conv: '', titre: 'Même titre', num: '31', etape: 'en-route', limiteIso: '', limiteTexte: '', presse: false, depassee: false },
  { cle: 'r:7003', tx: '7003', conv: 'k3', titre: 'Remboursé', num: '32', etape: 'rembourse', limiteIso: '2026-11-25T09:00:00Z', limiteTexte: '25 nov.', presse: false, depassee: false },
  { cle: 'd:abc', tx: '', conv: '', titre: 'Avis seul', num: '', etape: 'a-deposer', limiteIso: 'pas une date', limiteTexte: '27 nov.', presse: true, depassee: false },
] });

async function verifier(SRC, B) {
  let ko = 0;
  const dit = (c, m) => { if (!c) { ko++; if (!PROUVE) console.log('  ❌ ' + m); } else if (process.env.BAVARD) console.log('  ✅ ' + m); };
  let M; try { M = await charger(SRC); } catch (e) { dit(false, 'src/litigesTousSites.js ne se charge pas : ' + e.message); return ko; }
  if (typeof M.litigesEtRetours !== 'function') { dit(false, 'L0 litigesEtRetours existe'); return ko; }
  const r = M.litigesEtRetours({ ventes: ventes(), achats: achats(), maintenant: T0 });
  const cles = r.lignes.map((l) => l.cle);
  dit(r.etat === 'lu' && r.nVentes === 2 && r.nAchats === 3, `L1 2 litiges de vente + 3 retours d'achat en cours — ${cles.join(',')}`);
  dit(!cles.includes('a:r:7003'), 'L1b le retour REMBOURSÉ n’est plus en cours');
  const avis = r.lignes.find((l) => l.cle === 'a:d:abc') || {};
  dit(avis.limiteLue === false && avis.limiteTexte === '' && avis.presse === false, 'L2 une date illisible n’est pas une date limite : « non lue », jamais « pressé »');
  const a1 = r.lignes.find((l) => l.cle === 'a:r:7001') || {};
  dit(a1.limiteLue === true && a1.limiteTexte === '26 nov.', 'L2b la date LUE est dite');
  dit(cles[0] === 'v:tx:9402' && cles[1] === 'a:r:7001', `L3 pressé d'abord, puis la date lue — ${cles.join(',')}`);
  dit(cles.indexOf('a:r:7002') > cles.indexOf('a:r:7001') && cles.indexOf('v:tx:9401') > cles.indexOf('a:r:7001'), 'L3b les lignes sans date après celles qui en ont une');
  dit(a1.geste && a1.geste.url === 'https://www.vinted.fr/inbox/k1' && a1.geste.cle === 'deposer', 'L4 retour à déposer : la conversation de SA commande');
  const a2 = r.lignes.find((l) => l.cle === 'a:r:7002') || {};
  dit(a2.geste && a2.geste.url === 'https://www.vinted.fr/member/transactions/7002' && a2.geste.cle === 'suivre', 'L4b sans conversation : SA transaction');
  dit(avis.geste && avis.geste.url === 'https://www.vinted.fr/inbox', 'L4c sans identité : la boîte Vinted (jamais une autre commande)');
  dit(r.manques.some((p) => p.site === 'leboncoin' && p.etat === 'jamais-vu') && r.manques.some((p) => p.site === 'vestiaire') && r.partiel === true, 'L5 Leboncoin et Vestiaire NOMMÉS, total « au moins »');
  const r2 = M.litigesEtRetours({ ventes: undefined, achats: undefined });
  dit(r2.etat === 'encours' && r2.lignes.length === 0 && r2.partiel === true && r2.parSite.some((p) => p.sens === 'achat' && p.etat === 'encours'), 'L6 rien lu ⇒ « encours », partiel');
  const r3 = M.litigesEtRetours({ ventes: ventes(), achats: null });
  dit(r3.parSite.some((p) => p.sens === 'achat' && p.etat === 'passu') && r3.partiel === true && r3.nAchats === 0, 'L6b retours d’achat pas lus ⇒ « pas su », nommé');
  dit(cles.includes('a:r:7001') && cles.includes('a:r:7002'), 'L7 deux retours au même titre ⇒ deux lignes');
  // B
  const C = sansCommentaires(B.compta), E = sansCommentaires(B.ecran);
  dit(/litigesEtRetours\(\{ ventes: litigesVentesEcran, achats: retoursAchatVus \}\)/.test(C) && /ra=\{litigesTousSites\}/.test(C), 'B1 Comptabilité assemble ventes + retours d’achat et les passe');
  dit(/title=\{tr\('lit2\.titre'\)\}/.test(C), 'B2 titre « Litiges et retours » par tr()');
  const ligne = (E.match(/function LigneRetourAchat[\s\S]*?\n\}/) || [''])[0];
  dit(/data-retour-achat-ligne=/.test(ligne) && !/data-litige-carte=/.test(ligne), 'B3 un retour d’achat n’est jamais une carte de vente');
  dit(/l\.limiteLue \? tr\('lit2\.avant'/.test(ligne) && /tr\('lit2\.nonLue'\)/.test(ligne) && /href=\{l\.geste\.url\}/.test(ligne), 'B4 date lue sinon « non lue », geste = lien');
  for (const l of ['fr', 'en', 'es', 'it', 'de']) dit(/"lit2\.achats\.titre"/.test(lire(`src/i18n/langues/${l}/litigesTous.js`)) && /ecran_litiges_tous/.test(lire(`src/i18n/langues/${l}.js`)), `B5 textes ${l}`);
  return ko;
}

(async () => {
  const SRC = lire('src/litigesTousSites.js');
  const B = { compta: lire('src/ecrans/Comptabilite.jsx'), ecran: lire('src/LitigesEnCours.jsx') };
  const ko = await verifier(SRC, B);
  if (!PROUVE) { console.log(ko ? `❌ audit-litiges-tous-sites : ${ko} contrôle(s) rouge(s)` : '✅ audit-litiges-tous-sites : vert'); process.exit(ko ? 1 : 0); }
  if (ko) { console.log(`❌ --prouve : le code actuel n'est pas vert (${ko})`); process.exit(1); }
  const MUT = [
    ['remboursé gardé', "if (!c || !ETAPES_ACHAT_EN_COURS.has(c.etape)) continue;", 'if (!c) continue;'],
    ['date non vérifiée', 'const lue = !!(c.limiteTexte && ms(c.limiteIso) != null);', 'const lue = !!c.limiteTexte;'],
    ['tri ignoré', "lignes.sort((a, b) => rang(a) - rang(b)", 'lignes.slice().sort((a, b) => rang(a) - rang(b)'],
    ['geste au hasard', "const url = conv ? `https://www.vinted.fr/inbox/${encodeURIComponent(conv)}` : tx ?", "const url = tx ? `https://www.vinted.fr/inbox/${encodeURIComponent(tx)}` : conv ?"],
    ['jamais-vu tu', "if (p.etat === 'passu' || p.etat === 'jamais-vu') manques.push(p);", "if (p.etat === 'passu') manques.push(p);"],
    ['rien lu ⇒ complet', "partiel: manques.length > 0 || aEtat !== 'lu' || !vLu", 'partiel: manques.length > 0'],
  ];
  let rouges = 0;
  for (const [nom, a, b] of MUT) {
    if (!SRC.includes(a)) { console.log('❌ mutation impossible (motif absent) : ' + nom); process.exit(2); }
    const k = await verifier(SRC.replace(a, b), B);
    console.log((k ? '  ✅ rouge : ' : '  ❌ RESTE VERT : ') + nom); if (k) rouges++;
  }
  console.log(rouges === MUT.length ? `✅ --prouve : ${rouges}/${MUT.length} mutations rougissent` : `❌ --prouve : ${MUT.length - rouges} mutation(s) restent vertes`);
  process.exit(rouges === MUT.length ? 0 : 1);
})();
