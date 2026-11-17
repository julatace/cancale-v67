#!/usr/bin/env node
// ── audit-impression-directe — « IMPRIMER LES N » SUR ORDINATEUR (16 novembre) ─────────────
// Mission 6 de la file (validée par Julien) : « impression sans réfléchir ». Exécute la VRAIE règle
// (src/impressionDirecte.js) et vérifie le branchement de l'app (src/App.jsx, src/ImpressionDirecte.jsx) :
//   · le bouton : ordinateur seulement, le nombre PUBLIÉ par Ventes (`vrm_colis_prets.lot`), pas su ⇒ rien ;
//   · son clic passe par le MOTEUR d'« Imprimer (N) » (`imprimerLot` : papier retenu, question du papier la
//     1re fois, N° « à vérifier » §5) — jamais un second moteur, jamais la feuille « Choisir » ;
//   · rien ne s'imprime sans son clic (aucun appel du moteur hors du clic) ;
//   · après : « N imprimés · Annuler » — les marques posées par CETTE impression, et « Annuler » retire
//     CELLES-LÀ seulement.
//   node scripts/audit-impression-directe.cjs [--mutation=NOM | --prouve]
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const R = 'src/impressionDirecte.js', APP = 'src/App.jsx', JSX = 'src/ImpressionDirecte.jsx';
const MUTATIONS = {
  'pas-ordi': [R, '  return !!ordi && !ecarte && nombreAProposer(publie) > 0;', '  return !ecarte && nombreAProposer(publie) > 0;'],
  'nombre-devine': [R, '  return Number.isSafeInteger(n) && n > 0 ? n : 0;', '  return Number.isSafeInteger(n) && n > 0 ? n : 1;'],
  'annuler-tout': [R, "  const l = (Array.isArray(cles) ? cles : []).map(String).filter((k) => Object.prototype.hasOwnProperty.call(c, k));", '  const l = Object.keys(c);'],
  'marques-sans-vc': [R, "    vc: its.filter((it) => it.site === 'vestiaire'", "    vc: [].filter((it) => it.site === 'vestiaire'"],
  'marques-pdf-absent': [R, '  const its = (Array.isArray(items) ? items : []).filter((it) => it && voulu.has(String(it.cle)));', '  const its = (Array.isArray(items) ? items : []).filter((it) => it);'],
  'direct-choisir': [APP, 'if (direct) { directImprRef.current = true; imprimerLotRef.current && imprimerLotRef.current(); }', 'if (direct) { directImprRef.current = true; ouvrirLotRef.current && ouvrirLotRef.current(); }'],
  'direct-feuille': [APP, "      if (voie !== 'bouton') { try { window.dispatchEvent(new CustomEvent('vrm:impression-faite', { detail: marquesImpression(res.items, res.reussies) })); } catch (_) {} return; }", '      if (false) {}'],
  'annule-reste': [APP, '        directImprRef.current = false;\n        const annule = estTamponAnnule(err)', '        const annule = estTamponAnnule(err)'],
  'direct-apercu': [APP, '    if (directImprRef.current) {\n      attendrePuisOuvrir(sig,', '    if (false) {\n      attendrePuisOuvrir(sig,'],
  'banniere-partout': [APP, "      {ordi ? <ImpressionDirecteCoque onImprimer=", "      {true ? <ImpressionDirecteCoque onImprimer="],
  'clic-auto': [JSX, '  if (!proposer({ ordi, publie, ecarte })) return null;', '  React.useEffect(() => { if (onImprimer && proposer({ ordi, publie, ecarte })) onImprimer(nombreAProposer(publie)); }, []);\n  if (!proposer({ ordi, publie, ecarte })) return null;'],
};
const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}
(async () => {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + JSON.stringify(d).slice(0, 300) : '')); };
  const src = {};
  for (const f of [R, APP, JSX]) { const p = path.join(RACINE, f); if (!fs.existsSync(p)) { dit(false, f + ' existe'); process.exit(1); } src[f] = fs.readFileSync(p, 'utf8'); }
  if (mut) { const [f, a, b] = MUTATIONS[mut] || []; if (!f) { console.log('mutation inconnue'); process.exit(2); } if (!src[f].includes(a)) { console.log('❌ ancre introuvable : ' + mut); process.exit(1); } src[f] = src[f].replace(a, b); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-impdir-'));
  const fm = path.join(dir, 'r.mjs'); fs.writeFileSync(fm, src[R]);
  const D = await import(pathToFileURL(fm).href);
  fs.rmSync(dir, { recursive: true, force: true });

  // ── La règle ──
  dit(D.proposer({ ordi: true, publie: { lot: 3 } }) && D.nombreAProposer({ lot: 3 }) === 3, 'ordinateur + 3 bordereaux publiés ⇒ « Imprimer les 3 »');
  dit(!D.proposer({ ordi: false, publie: { lot: 3 } }), 'téléphone ⇒ rien (le geste d’À expédier y reste)');
  dit(!D.proposer({ ordi: true, publie: null }) && !D.proposer({ ordi: true, publie: {} }) && !D.proposer({ ordi: true, publie: { lot: 0 } }) && D.nombreAProposer(null) === 0 && D.nombreAProposer({ lot: '3' }) === 0,
    'pas su (rien publié, `lot` absent ou illisible) ou 0 ⇒ aucun bouton, jamais un nombre deviné');
  dit(!D.proposer({ ordi: true, publie: { lot: 3 }, ecarte: true }), '« Plus tard » ⇒ rien jusqu’au prochain retour');
  const carte = { 9301: 'a', 9302: 'b', 9399: 'z' };
  const r1 = D.retirerMarques(carte, ['9301', '9302', '7777']);
  dit(r1.change && JSON.stringify(r1.carte) === JSON.stringify({ 9399: 'z' }) && carte[9301] === 'a', '« Annuler » retire CES marques seulement (la 9399, d’une autre impression, reste ; l’original n’est pas modifié)', r1);
  const r2 = D.retirerMarques(carte, ['7777']);
  dit(!r2.change && r2.carte === carte, 'rien à retirer ⇒ rien d’écrit');
  const items = [{ cle: '9301', site: 'vinted' }, { cle: 'r:42', site: 'vinted', retour: true }, { cle: 'vc:V1', site: 'vestiaire', ligne: { v: { id: 'V1' } } }, { cle: '9309', site: 'vinted' }];
  const m = D.marquesDe(items, ['9301', 'r:42', 'vc:V1']);
  dit(m.n === 3 && m.vinted.join() === '9301,r:42' && m.retours.join() === 'r:42' && m.vc.join() === 'V1', 'les marques d’une impression : les bordereaux DANS le PDF (pas le 9309, absent), retours et Vestiaire compris', m);

  // ── Le branchement ──
  const A = src[APP].replace(/\/\*[\s\S]*?\*\//g, '');
  dit(/if \(direct\) \{ directImprRef\.current = true; imprimerLotRef\.current && imprimerLotRef\.current\(\); \}/.test(A), 'le clic passe par le MOTEUR d’« Imprimer (N) » (`imprimerLot` : papier retenu, question la 1re fois, §5), pas par « Choisir »');
  dit(/if \(directImprRef\.current\) \{\s*attendrePuisOuvrir\(sig, choisies, choisies\.flatMap\(numerosDeLigne\),/.test(A), 'en direct, pas d’aperçu : les tampons DÉJÀ choisis, le chemin d’attente (question des N° §5, puis la visionneuse)');
  dit((A.match(/prendreDemandeImpression\(\)/g) || []).length >= 2, 'les deux prises de demande (écran déjà ouvert, écran qui s’ouvre) la connaissent');
  dit(/if \(directImprRef\.current\) \{\s*directImprRef\.current = false;\s*if \(voie !== 'bouton'\) \{ try \{ window\.dispatchEvent\(new CustomEvent\('vrm:impression-faite', \{ detail: marquesImpression\(res\.items, res\.reussies\) \}\)\); \} catch \(_\) \{\} return; \}/.test(A),
    'après : les marques posées (`marquerImprimes`, avant), puis « N imprimés · Annuler » au lieu de la feuille d’après');
  dit(/directImprRef\.current = false;\s*const annule = estTamponAnnule\(err\)/.test(A), 'une impression annulée (question des N°) ne laisse pas le mode direct armé');
  dit(/retirerMarquesImpression\(prev, d\.vinted\)/.test(A) && /retirerMarquesImpression\(load\('vrm_retours_imprimes', \{\}\) \|\| \{\}, d\.retours\)/.test(A) && /marquerVc\('vrm_vc_imprimes', id, false\)/.test(A), '« Annuler » retire les marques Vinted, retours et Vestiaire de CETTE impression');
  dit(/\{ordi \? <ImpressionDirecteCoque onImprimer=/.test(A), 'la bannière n’existe que sur ordinateur');
  const J = src[JSX];
  dit((J.match(/onImprimer\(/g) || []).length === 1 && /onClick=\{\(\) => \{ setEcarte\(true\); if \(onImprimer\) onImprimer\(n\); \}\}/.test(J), 'rien ne s’imprime sans son clic (le seul appel est dans le clic du bouton)');
  dit(/import \{ proposer, nombreAProposer \} from '\.\/impressionDirecte\.js';/.test(J) && /tr\('impdir\.imprimer'/.test(J), 'la bannière suit la règle et passe par tr()');

  console.log(ko ? `\n❌ impression directe : ${ko} rouge(s)` : '\n✅ impression directe : tout est vert');
  process.exit(ko ? 1 : 0);
})();
