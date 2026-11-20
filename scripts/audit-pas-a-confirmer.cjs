// ════════════════════════════════════════════════════════════════════════
//  AUDIT « JAMAIS "À CONFIRMER" POUR UNE ANNONCE » (20 nov., ext. 5.410.2)
//
//  Julien, 20 nov. : « je ne comprends pas ce qu'est le statut "à confirmer" sur l'extension, ça veut rien dire ».
//  La RÈGLE <enligne-regle> ne change pas (lecture complète du dressing de plus de 24 h ⇒ ni « en ligne » ni
//  « partie ») ; ce qu'on MONTRE dit ce qui se passe : « Pas revue depuis 3 j », « Pas revue(s) récemment », et le
//  geste une fois (« Ouvre ce compte sur Vinted pour mettre à jour »).
//  On juge le TEXTE VISIBLE (commentaires retirés), jamais un nom de clé ni de variable (`a_confirmer` reste le nom
//  interne de l'état) :
//   1. l'extension : aucune chaîne de vrm-badge.js / vrm-ui.js (5 langues) ne dit « à confirmer » / « to confirm » /
//      « por confirmar » / « da confermare » / « zu bestätigen » ; `s_pas_revue_j` existe dans les 5 langues ;
//   2. l'app : les libellés de l'état d'une ANNONCE (Annonces, Stock, rangement, tableaux, égalité, étagères, « pas en
//      ligne », Leboncoin, Vestiaire, fiche, histoire, copie) dans les 5 langues, et les fichiers qui les écrivent en dur.
//  (« Lieu à confirmer » d'un colis, « Confirmer » d'un geste : d'autres notions, non jugées ici.)
//  `--prouve` : remet l'ancien libellé à 3 endroits, chacun doit rougir.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const lire = (p) => fs.readFileSync(path.join(R, p), 'utf8');
const MOTS = /à confirmer|a confirmer|to confirm\b|por confirmar|da confermare|zu bestätigen/i;
// Un seul balayage : commentaires et chaînes dans l'ordre où ils viennent (un « /* » DANS une chaîne n'ouvre rien).
const chaines = (s) => { const out = []; const re = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)/g; let m; while ((m = re.exec(s))) if (m[1]) out.push(m[1]); return out; };
const sansCommentaires = (s) => s;
const CLES_APP = ['annonces.confirmer', 'annonces.confirmer2', 'annonces.confirmer3', 'annonces.relecturesAutresComptes', 'stock.confirmer', 'stock.confirmer2', 'stock.confirmer3',
  'egalite.etatAnnonce.aconfirmer', 'etag.site.aconfirmer', 'sr.etat.aConf', 'pasEnLigne.aConfirmer', 'tableau.etat.aconfirmer'];
const FICHIERS_APP = ['src/AnnoncesLeboncoin.jsx', 'src/etatAnnonceLeboncoin.js', 'src/fichePaire.js', 'src/copieAnnonces.js', 'src/histoireArticle.js', 'src/ecrans/Vestiaire.jsx'];
const LANGUES = ['fr', 'en', 'es', 'it', 'de'];

function juger(src) {
  const res = []; const dit = (bon, quoi, detail) => res.push({ bon: !!bon, quoi, detail });
  for (const f of ['vinted-sync-extension/vrm-badge.js', 'vinted-sync-extension/vrm-ui.js']) {
    const fautes = chaines(sansCommentaires(src(f))).filter((c) => MOTS.test(c));
    dit(!fautes.length, `1. ${f} : aucun texte « à confirmer » (5 langues)`, fautes.slice(0, 4).join(' | ').slice(0, 300));
  }
  const ui = src('vinted-sync-extension/vrm-ui.js');
  const m = /s_pas_revue_j:\s*\{(.*)\}/.exec(ui);
  dit(m && LANGUES.every((l) => new RegExp(`\\b${l}:\\s*["']`).test(m[1])), '1. « Pas revue depuis {n} j » dans les 5 langues de l’extension');
  for (const l of LANGUES) {
    const fichiers = [`src/i18n/langues/${l}.js`, ...fs.readdirSync(path.join(R, 'src/i18n/langues', l)).filter((x) => x.endsWith('.js')).map((x) => `src/i18n/langues/${l}/${x}`)];
    const fautes = [], vues = new Set();
    for (const f of fichiers) {
      const s = src(f);
      for (const k of CLES_APP) {
        const re = new RegExp(`"${k.replace(/\./g, '\\.')}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|\\{[^}]*\\})`, 'g'); let x;
        while ((x = re.exec(s))) { vues.add(k); if (MOTS.test(x[1])) fautes.push(`${k}=${x[1].slice(0, 60)}`); }
      }
    }
    dit(!fautes.length && vues.size >= 10, `2. app (${l}) : l’état d’une annonce ne dit jamais « à confirmer » (${vues.size} libellés jugés)`, fautes.join(' | ') || `vus ${vues.size}`);
  }
  for (const f of FICHIERS_APP) {
    const fautes = chaines(sansCommentaires(src(f))).filter((c) => MOTS.test(c));
    dit(!fautes.length, `2. ${f} : aucun texte « à confirmer » écrit en dur`, fautes.slice(0, 3).join(' | ').slice(0, 300));
  }
  return res;
}
const MUTATIONS = [
  ['l’extension remet « À confirmer »', 'vinted-sync-extension/vrm-ui.js', (s) => s.replace('s_a_confirmer: { fr: "Pas revue récemment"', 's_a_confirmer: { fr: "À confirmer"')],
  ['l’app (de) remet « zu bestätigen »', 'src/i18n/langues/de/annonces.js', (s) => s.replace(/("annonces\.confirmer2"\s*:\s*)"[^"]*"/, '$1"zu bestätigen"')],
  ['Leboncoin remet « À confirmer » en dur', 'src/etatAnnonceLeboncoin.js', (s) => s.replace("label='Pas revue récemment'", "label='À confirmer'")],
];
const res = juger(lire);
let ko = 0;
for (const r of res) { if (!r.bon) ko++; console.log(`  ${r.bon ? '✅' : '❌'} ${r.quoi}${!r.bon && r.detail ? ' — ' + r.detail : ''}`); }
console.log(`\n${res.length - ko} ✅ · ${ko} ❌`);
if (process.argv.includes('--prouve')) {
  let rouges = 0;
  for (const [nom, f, m] of MUTATIONS) {
    const avant = lire(f), apres = m(avant);
    if (apres === avant) { console.log(`  ⚠️ mutation sans effet : ${nom}`); continue; }
    const r = juger((p) => (p === f ? apres : lire(p)));
    const rouge = r.some((x) => !x.bon); if (rouge) rouges++;
    console.log(`  ${rouge ? '🟥' : '⬜'} mutation « ${nom} » ${rouge ? 'rougit' : 'NE ROUGIT PAS'}`);
  }
  console.log(`mutations : ${rouges}/${MUTATIONS.length} rouges`);
  if (rouges !== MUTATIONS.length) ko++;
}
process.exit(ko ? 1 : 0);
