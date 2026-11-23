// AUDIT — la puce d'un colis « À vérifier » (src/statutAVerifier.js), 17 nov., chasse-bugs.
// Mesuré au banc colis-retirer-propre sur origin/main : un colis arrivé dont le code n'est pas encore lu
// (`raisonCode: 'sans_code'`, décision de Julien du 14 nov.) portait la puce « Incident » — sa raison
// contient le mot « transporteur ». Exige : sans code ⇒ « Code pas encore lu » (jamais « Incident »), dans
// toutes les langues de la raison ; les autres puces inchangées.
// `node scripts/audit-statut-a-verifier.cjs [module.js]` · `--prouve` : la règle d'avant (la phrase seule)
// doit être ROUGE.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src', 'statutAVerifier.js');

async function juger(fichier) {
  const { statutAVerifier } = await import(pathToFileURL(fichier).href + '?t=' + Date.now());
  const { tr } = await import(pathToFileURL(path.join(RACINE, 'src', 'i18n', 'index.js')).href);
  const attendu = tr('achats.statutCodePasLu');
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK ' : 'KO '} ${quoi}${!bon && det != null ? ' — ' + det : ''}`); };
  // Les raisons réelles de l'app (fr/en/es/it/de) pour un colis sans code.
  for (const l of ['fr', 'en', 'es', 'it', 'de']) {
    const dico = fs.readFileSync(path.join(RACINE, 'src', 'i18n', 'langues', l, 'achats.js'), 'utf8');
    for (const cle of ['achats.sansCodeEmail', 'achats.sansCodeVinted']) {
      const m = new RegExp(`"${cle.replace('.', '\\.')}":\\s*"([^"]*)"`).exec(dico);
      const raison = m ? m[1] : '';
      const s = statutAVerifier({ raisonCode: 'sans_code', raisonVerif: raison });
      dit(s === attendu && s !== 'Incident', `A1 [${l}] ${cle} ⇒ « ${attendu} »`, s);
    }
  }
  dit(statutAVerifier({ raisonCode: 'sans_code', raisonVerif: '' }) === attendu, 'A2 sans raison écrite, l’état suffit');
  // Les autres puces ne bougent pas.
  dit(statutAVerifier({ raisonCode: 'transporteur', raisonVerif: 'Mondial Relay dit « Fin d’instance »' }) === 'Retour à l’expéditeur ?', 'A3 « Fin d’instance » ⇒ « Retour à l’expéditeur ? »');
  dit(statutAVerifier({ raisonCode: 'transporteur', raisonVerif: 'Chronopost signale un problème' }) === 'Incident', 'A4 un vrai incident reste « Incident »');
  dit(statutAVerifier({ raisonCode: 'delai_depasse', raisonVerif: 'délai de retrait dépassé le 01/11' }) === 'Délai dépassé', 'A5 délai dépassé');
  dit(statutAVerifier({ raisonCode: 'trop_long', raisonVerif: 'au point relais depuis plus de 7 jours' }) === 'Au relais depuis longtemps', 'A6 garde dépassée');
  dit(statutAVerifier({ raisonCode: 'doute_meme_relais', raisonVerif: 'compté avec le n°…1234' }) === 'Compté avec le n°…1234', 'A7 compté avec un autre colis');
  return ko;
}

(async () => {
  if (process.argv.includes('--prouve')) {
    // La règle d'avant : la phrase seule décide (la ligne de l'état machine retirée).
    const src = fs.readFileSync(SRC, 'utf8');
    const mute = src.replace(/^\s*if \(code === 'sans_code'\)[^\n]*\n/m, '');
    if (mute === src) { console.log('KO  mutation impossible : la ligne de l’état machine est introuvable'); process.exit(1); }
    const f = path.join(path.dirname(SRC), `.statutAVerifier-mute-${process.pid}.js`);
    fs.writeFileSync(f, mute);
    let ko; try { ko = await juger(f); } finally { fs.unlinkSync(f); }
    console.log(ko ? `✅ mutation « la phrase seule » : ${ko} rouge(s)` : '❌ la mutation passe : le contrôle ne prouve rien');
    process.exit(ko ? 0 : 1);
  }
  const ko = await juger(process.argv[2] ? path.resolve(process.argv[2]) : SRC);
  console.log(ko ? `❌ audit-statut-a-verifier : ${ko} rouge(s)` : '✅ audit-statut-a-verifier : la puce suit l’état du colis');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
