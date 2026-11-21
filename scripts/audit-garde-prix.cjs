// ════════════════════════════════════════════════════════════════════════════
//  LE GARDE-FOU SUR LE PRIX (21 nov., ext. 5.432, choix B de Julien) — STATIQUE + EXÉCUTÉ
//
//  La règle est src/gardePrix.js (<garde-prix-regle>), recopiée dans background.js et
//  api/_lib/garde-prix-regle.js par `--recopie`. On exige :
//    R  la RÈGLE : 4,50 au lieu de 45 ⇒ suspect (frappe + chute) ; sous le prix mini / l'achat + 10 % ;
//       plus de SON seuil % sous le prix actuel ; ≤ 0 jamais (même confirmé) ; à la main un prix suspect
//       ne passe QUE confirmé au centime près ; automatique : jamais (même « confirmé ») ; 5 000 prix
//       automatiques au hasard : aucun sous le plancher ne passe ;
//    C  les copies sont identiques à la source ;
//    S  STATIQUE : chaque écriture de prix ou d'offre du fond (interfaceVinted 'prix' | 'offre',
//       gesteLbcInterface 'prix', les envois Vestiaire de prix / d'offre) porte le billet de la garde, et la
//       fonction qui l'écrit appelle `gardePrixEcriture` AVANT ; chaque chemin nommé (à la main, lot, règle,
//       cycle de vie, favoris, contre-offres, Agent, relances, lots, prix partout) appelle la garde ;
//    V  le VRAI background.js (scripts/_fond-vm.cjs, faux vinted.fr) : la baisse à la main 45 → 4,50 est
//       arrêtée AVANT l'onglet (« garde-confirmer », 0 requête), puis part confirmée à 4,50 (et pas à 4,60) ;
//       la même par la file automatique (règle) ⇒ bloquée, au journal, notifiée ; une contre-offre sous le
//       plancher ⇒ rien ; un appel direct de l'écriture sans billet ⇒ rien ne part ;
//  `--prouve` : chaque mutation (garde contournée, billet non vérifié, auto confirmable, plancher ignoré,
//  frappe ignorée) doit faire rougir au moins un contrôle. `--src <background.js>` : l'arbre d'avant.
//  Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src', 'gardePrix.js');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const API = path.join(RACINE, 'api', '_lib', 'garde-prix-regle.js');
const RE_BLOC = /(\/\/ <garde-prix-regle>[^\n]*\n)([\s\S]*?)(\/\/ <\/garde-prix-regle>)/;
const blocSource = (s) => { const m = /\/\/ <garde-prix-regle>\n([\s\S]*?)\/\/ <\/garde-prix-regle>/.exec(s); return m ? m[1] : null; };
const blocDe = (s) => { const m = RE_BLOC.exec(s); return m ? m[2] : null; };

if (process.argv.includes('--recopie')) {
  const b = blocSource(fs.readFileSync(SRC, 'utf8'));
  if (!b) { console.error('bloc <garde-prix-regle> introuvable dans src/gardePrix.js'); process.exit(1); }
  for (const f of [BG, API]) {
    const s = fs.readFileSync(f, 'utf8');
    if (!RE_BLOC.test(s)) { console.error('marqueurs absents : ' + f); process.exit(1); }
    fs.writeFileSync(f, s.replace(RE_BLOC, (_, a, __, c) => a + b + c));
    console.log('recopié : ' + path.relative(RACINE, f));
  }
  process.exit(0);
}
module.exports = { blocSource, blocDe };
