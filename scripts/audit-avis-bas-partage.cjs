// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LES ALERTES « AVIS BAS » SONT LUES UNE FOIS POUR DEUX LECTEURS
//         node scripts/audit-avis-bas-partage.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (17 nov., fiabilité-vitesse) Ma journée (App.jsx `lireAvisBas`) et la santé des comptes
// (src/SanteComptes.jsx) lisaient `vrm_avis_bas` deux fois à l'ouverture (budget-vitesse,
// main 1a4eb65 : « NOUVELLE lecture en double (×2) »). La lecture partagée
// (src/lectureAvisBas.js) est EXÉCUTÉE ici :
//   1. deux lecteurs ⇒ une seule lecture ;
//   2. une lecture ratée (null, ou levée) n'est jamais gardée : la suivante relit ;
//   3. un signal de l'extension (`vrm:ext`) oublie la copie ; au-delà de GARDE_MS on relit ;
//   4. les deux lecteurs passent bien par elle (et la projection reste `select=a:data->alertes`).
// `--prouve` : chaque mutation affaiblit la règle ; l'audit doit devenir rouge.
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const MOD = path.join(R, 'src', 'lectureAvisBas.js');

async function juger(texteModule, textesLecteurs, dire) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (dire) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
  // Une fausse fenêtre (le module écoute `vrm:ext`).
  const ecouteurs = {};
  global.window = { addEventListener: (t, f) => { (ecouteurs[t] = ecouteurs[t] || []).push(f); } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avisbas-'));
  try {
    fs.writeFileSync(path.join(dir, 'avisNegatif.js'), "export const LIGNE_AVIS_BAS = 'vrm_avis_bas';\n");
    fs.writeFileSync(path.join(dir, 'lectureAvisBas.mjs'), texteModule);
    const M = await import(pathToFileURL(path.join(dir, 'lectureAvisBas.mjs')).href + '?v=' + Math.random());
    let n = 0; const adresses = [];
    const get = async (a) => { n++; adresses.push(a); return [{ a: [{ uid: '1' }] }]; };
    const t = 1_000_000;
    const [x, y] = await Promise.all([M.lireAlertesAvisBas(get, t), M.lireAlertesAvisBas(get, t + 3000)]);
    dit(n === 1 && x === y && Array.isArray(x), '1. deux lecteurs à 3 s d\'écart ⇒ une seule lecture', `${n} lecture(s)`);
    dit(adresses[0] === 'app_data?id=eq.vrm_avis_bas&select=a:data->alertes', '   la projection reste celle des alertes', adresses[0]);
    M.oublierAvisBas(); n = 0;
    const rate = async () => { n++; return null; };
    await M.lireAlertesAvisBas(rate, t); await M.lireAlertesAvisBas(rate, t + 10);
    dit(n === 2, '2. une lecture ratée (null) n\'est pas gardée : la suivante relit', `${n} lecture(s)`);
    M.oublierAvisBas(); n = 0;
    const leve = async () => { n++; throw new Error('réseau'); };
    const r1 = await M.lireAlertesAvisBas(leve, t); await M.lireAlertesAvisBas(leve, t + 10);
    dit(n === 2 && r1 === null, '   une lecture qui lève rend null et n\'est pas gardée', `${n} lecture(s), rendu ${r1}`);
    M.oublierAvisBas(); n = 0;
    await M.lireAlertesAvisBas(get, t); (ecouteurs['vrm:ext'] || []).forEach((f) => f({})); await M.lireAlertesAvisBas(get, t + 10);
    dit(n === 2, '3. un signal de l\'extension (vrm:ext) fait relire', `${n} lecture(s)`);
    M.oublierAvisBas(); n = 0;
    await M.lireAlertesAvisBas(get, t); await M.lireAlertesAvisBas(get, t + M.GARDE_MS + 1);
    dit(n === 2 && M.GARDE_MS <= 120000, `   au-delà de ${M.GARDE_MS / 1000} s on relit (copie courte)`, `${n} lecture(s)`);
  } catch (e) { dit(false, 'le module s\'exécute', e.message); }
  finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} delete global.window; }
  const sansCom = (s) => s.replace(/\/\/[^\n]*/g, '');
  const app = sansCom(textesLecteurs.app), sante = sansCom(textesLecteurs.sante);
  dit(/lireAlertesAvisBas\(get\)/.test(app) && !/vrm_avis_bas&select=a:data->alertes|LIGNE_AVIS_BAS\}&select=a:data->alertes/.test(app), '4. Ma journée lit les alertes par la lecture partagée');
  dit(/lireAlertesAvisBas\(get\)/.test(sante) && !/vrm_avis_bas&select=/.test(sante), '   la santé des comptes aussi');
  return ko;
}

(async () => {
  const lire = (r) => fs.readFileSync(path.join(R, r), 'utf8');
  const lecteurs = () => ({ app: lire('src/App.jsx'), sante: lire('src/SanteComptes.jsx') });
  if (process.argv.includes('--prouve')) {
    const m = lire('src/lectureAvisBas.js');
    const MUTS = [
      ['aucune copie gardée', m.replace('if (copie && maintenant - copie.at < GARDE_MS) return copie.p;', ''), lecteurs()],
      ['un échec gardé', m.replace("if (r == null && copie === moi) copie = null; return r;", 'return r;'), lecteurs()],
      ['vrm:ext ignoré', m.replace("window.addEventListener('vrm:ext', oublierAvisBas);", ''), lecteurs()],
      ['copie gardée sans fin', m.replace('export const GARDE_MS = 60000;', 'export const GARDE_MS = 1e12;'), lecteurs()],
      ['la santé relit à part', m, { ...lecteurs(), sante: lecteurs().sante.replace('lireAlertesAvisBas(get),', "get('app_data?id=eq.vrm_avis_bas&select=a:data->alertes'),") }],
    ];
    let rouges = 0;
    for (const [nom, t, l] of MUTS) { const ko = await juger(t, l, false); console.log((ko ? '  ✅ ' : '  ❌ ') + `mutation « ${nom} » ⇒ ${ko ? 'rouge' : 'VERT'}`); if (ko) rouges++; }
    console.log(rouges === MUTS.length ? `\n✅ audit-avis-bas-partage --prouve : ${rouges}/${MUTS.length} mutations rouges` : `\n❌ audit-avis-bas-partage --prouve : ${MUTS.length - rouges} mutation(s) verte(s)`);
    process.exit(rouges === MUTS.length ? 0 : 1);
  }
  let texte = ''; try { texte = lire('src/lectureAvisBas.js'); } catch (_) {}
  const ko = await juger(texte, lecteurs(), true);
  console.log(ko ? `\n❌ audit-avis-bas-partage : ${ko} rouge(s)` : '\n✅ audit-avis-bas-partage : une lecture des alertes pour deux lecteurs');
  process.exit(ko ? 1 : 0);
})();
