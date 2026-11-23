// ════════════════════════════════════════════════════════════════════════
//  LE PRIX MINI DEMANDÉ À LA PUBLICATION (22 nov., ext. 5.437 — `prixminipublier`)
//  1. le bloc <prix-mini-pose-regle> est le MÊME dans src/prixMiniPose.js et background.js (--recopie le refait) ;
//  2. la règle PURE (exécutée) : proposition = déjà connu, sinon achat + 10 % à l'euro du dessus, sinon RIEN ;
//     identité seulement (N° / annonce), 50 paires au même titre : une réponse ne touche que SON N° ; le plus récent gagne ;
//     l'absorption par l'app est idempotente et n'écrase pas une saisie plus récente ;
//  3. le VRAI background.js dans un vm (scripts/_fond-vm.cjs) : `prixMiniCarte` · `proposer` (lecture seule, rien
//     n'est écrit) · `poser` (sans confirmation ⇒ rien ; montant illisible ⇒ rien ; sinon UNE écriture dans la ligne
//     des réglages, jamais `main`) ; puis le moteur des offres (`offreAutoReglages`) et le plancher des favoris lisent le
//     prix mini posé ; une ligne illisible ⇒ seul le prix mini de la fiche compte ;
//  4. le panneau : les trois feuilles de publication montrent la rangée et rangent AVANT de lancer ; l'app absorbe.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE. `BG_SRC=` : un autre background.js (preuve sur l'ancien code).
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const F_SRC = path.join(R, 'src/prixMiniPose.js');
const BG0 = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : path.join(R, 'vinted-sync-extension/background.js');
const DEB = '// <prix-mini-pose-regle>', FIN = '// </prix-mini-pose-regle>';
const bloc = (t) => { const a = t.indexOf(DEB), b = t.indexOf(FIN); return a < 0 || b < 0 ? null : t.slice(a, b + FIN.length); };
const args = process.argv.slice(2);
if (args.includes('--recopie')) {
  const b = bloc(fs.readFileSync(F_SRC, 'utf8')); const bg = fs.readFileSync(BG0, 'utf8'); const v = bloc(bg);
  if (!b || !v) { console.log('❌ bloc introuvable'); process.exit(1); }
  fs.writeFileSync(BG0, bg.replace(v, b)); console.log('✅ bloc recopié'); process.exit(0);
}
const MUTATIONS = {
  proposition: ["return { valeur: Math.ceil(Math.round(a * 110) / 100 - 1e-9), de: 'achat' };", "return { valeur: Math.floor(a * 1.05), de: 'achat' };"],
  recent: ['for (const c of cands) if (c.at > best.at)', 'for (const c of cands) if (true)'],
  identite: ["if (n && L.parNum[n]) cands.push(L.parNum[n]);", "for (const x of Object.values(L.parNum)) cands.push(x);"],
  lireMain: ["if (avecPm) { const pm =", "if (false) { const pm ="],
  confirme: ["if (msg.confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien n’a changé : confirme d’abord.' };\n    const aPoser", "const aPoser"],
  plancherFavori: ["const fiche = pmSuperposer({ [String(itemId)]: fiche0 }, await prixMiniPoseLu(), cleNum)[String(itemId)] || fiche0;", "const fiche = fiche0;"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`); if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let BG = BG0, SRCM = F_SRC;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut];
  for (const [f, nom] of [[BG0, 'bg'], [F_SRC, 'src']]) {
    const s = fs.readFileSync(f, 'utf8'); if (!s.includes(a)) continue;
    const p = path.join(os.tmpdir(), `pm-${nom}-${mut}-${process.pid}.js`); fs.writeFileSync(p, s.split(a).join(b));
    if (nom === 'bg') BG = p; else SRCM = p;
  }
}
let ok = 0, ko = 0;
const dit = (c, txt, d) => { if (c) { ok++; console.log('✅ ' + txt); } else { ko++; console.log('❌ ' + txt + (d ? ' — ' + String(d).slice(0, 400) : '')); } };
const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };

(async () => {
  // 1. Le bloc recopié
  const bs = bloc(fs.readFileSync(SRCM, 'utf8')), bb = bloc(fs.readFileSync(BG, 'utf8'));
  dit(!!bb, 'background.js porte le bloc <prix-mini-pose-regle>');
  if (!mut) dit(bs && bb && bs === bb, 'le bloc est identique dans l’app et l’extension (node scripts/audit-prix-mini-pose.cjs --recopie)');
  // 2. La règle pure
  let P = null;
  try { P = vm.runInNewContext(fs.readFileSync(SRCM, 'utf8').replace(/^export \{[^}]*\};?\s*$/m, '') + '\n;({ pmProposition, pmNormalise, pmMiniDe, pmSuperposer, pmAbsorber, pmLigne });', { Date, Math, Number, String, Object, Array, JSON }); } catch (e) { dit(false, 'module exécutable', e.message); }
  if (P) {
    const pr = P.pmProposition;
    dit(pr({ connu: '45,5', achat: 30 }).valeur === 45.5 && pr({ connu: 45.5 }).de === 'connu', 'proposition : le prix mini déjà connu d’abord');
    dit(pr({ achat: 49.99 }).valeur === 55 && pr({ achat: 50 }).valeur === 55 && pr({ achat: '72' }).valeur === 80, 'proposition : achat + 10 % arrondi à l’euro du dessus (49,99 → 55 ; 50 → 55 ; 72 → 80)', JSON.stringify([pr({ achat: 49.99 }), pr({ achat: 72 })]));
    dit(pr({}).valeur === null && pr({ achat: '' }).valeur === null && pr({ achat: 'abc' }).valeur === null, 'proposition : sans base, RIEN (jamais deviné)');
    const N = (d) => P.pmNormalise(d, null, 1000, cleNum);
    dit(!N({ min: 40 }).ok && N({ min: 40 }).code === 'identite', 'poser : ni N° ni annonce ⇒ refusé');
    dit(!N({ num: '12', min: 'abc' }).ok && !N({ num: '12', min: '-3' }).ok, 'poser : montant illisible ⇒ refusé');
    dit(!N({ num: '12', min: 90, prix: 80 }).ok, 'poser : au-dessus du prix de l’annonce ⇒ refusé');
    const v = N({ num: '012', min: '45,50' });
    dit(v.ok && v.valeur.parNum['12'] && v.valeur.parNum['12'].min === 45.5, 'poser : « 012 » est le N°12 (cleNum), 45,50 lu 45,5', JSON.stringify(v));
    // 50 paires au même titre : la réponse ne touche que SON N°.
    const fiches = {}; for (let i = 1; i <= 50; i++) fiches[String(900000 + i)] = { numero: String(i), titre: 'Nike Air Max 90 blanche 42', min: '' };
    const lig = { parNum: { '7': { min: 61, at: 5000 } } };
    const sup = P.pmSuperposer(fiches, lig, cleNum);
    const avecMin = Object.keys(sup).filter((k) => sup[k].min != null && sup[k].min !== '');
    dit(avecMin.length === 1 && avecMin[0] === '900007' && sup['900007'].min === 61, '50 paires au même titre : le prix mini du N°7 ne touche QUE la fiche du N°7', JSON.stringify(avecMin));
    const f = { numero: '7', min: '50', minAt: new Date(9000).toISOString() };
    dit(P.pmMiniDe(f, '1', lig, cleNum).min === 50, 'le plus récent gagne : une saisie dans l’app plus récente reste');
    dit(P.pmMiniDe({ numero: '7', min: '50' }, '1', lig, cleNum).min === 61, 'le plus récent gagne : un prix mini d’avant (non daté) cède au prix posé');
    dit(P.pmMiniDe({ numero: '7', min: '50' }, '1', { parNum: { '7': { min: null, at: 5000 } } }, cleNum).min === null, 'effacé (min: null) : plus de prix mini');
    const ab = P.pmAbsorber({ a: { numero: '7', min: '50' } }, lig, cleNum);
    const ab2 = P.pmAbsorber(ab.numeros, lig, cleNum);
    dit(ab.ids.length === 1 && ab.numeros.a.min === '61' && ab2.ids.length === 0, 'l’app absorbe une fois (min + minAt), puis plus rien', JSON.stringify(ab));
  }
  // 3. Le vrai background.js
  let faireFond = null; try { ({ faireFond } = require('./_fond-vm.cjs')); } catch (e) { dit(false, '_fond-vm', e.message); }
  if (faireFond) {
    const UID = '111';
    const lignes = { main: { vinted_offres_auto: true, vinted_annonce_numeros: { '5551': { numero: '7', buyPrice: '49.99' }, '5552': { numero: '8' } }, vinted_buyprice_by_num: {} } };
    const F = faireFond({ src: BG, connecte: UID, lignes });
    const C = F.ctx;
    const sender = { tab: { url: 'https://www.vinted.fr/items/5551' } };
    if (typeof C.prixMiniCarte !== 'function') dit(false, 'background.js : `prixMiniCarte` existe');
    else {
      const p = await C.prixMiniCarte({ quoi: 'proposer', articles: [{ num: '7', item: '5551' }, { num: '8', item: '5552' }] }, sender);
      dit(p.ok && p.articles[0].proposition.valeur === 55 && p.articles[0].proposition.de === 'achat' && p.articles[1].proposition.valeur === null, 'proposer : N°7 acheté 49,99 ⇒ 55 € proposé ; N°8 sans achat ⇒ rien', JSON.stringify(p));
      dit(!F.lignes.vrm_reglages_auto, 'proposer : rien n’est écrit');
      const s0 = await C.prixMiniCarte({ quoi: 'poser', articles: [{ num: '7', item: '5551', min: '58' }] }, sender);
      dit(!s0.ok && !F.lignes.vrm_reglages_auto, 'poser sans confirmation : rien n’est écrit', JSON.stringify(s0));
      const s1 = await C.prixMiniCarte({ quoi: 'poser', confirme: true, articles: [{ num: '7', item: '5551', min: '58' }, { num: '8', min: 'xx' }] }, sender);
      dit(!s1.ok && !F.lignes.vrm_reglages_auto, 'poser : une réponse illisible ⇒ RIEN n’est écrit (ni l’autre)', JSON.stringify(s1));
      const s2 = await C.prixMiniCarte({ quoi: 'poser', confirme: true, articles: [{ num: '7', item: '5551', min: '58' }] }, sender);
      const lg = F.lignes.vrm_reglages_auto; const e = lg && lg.data ? lg.data : lg;
      const pm = e && e.cles && e.cles.vrm_prix_mini;
      dit(s2.ok && s2.relu === true && pm && pm.parNum['7'] && pm.parNum['7'].min === 58, 'poser confirmé : rangé à côté du N°7 dans la ligne des réglages, relu', JSON.stringify({ s2, pm }));
      const m0 = F.lignes.main && (F.lignes.main.data || F.lignes.main);
      dit(!(m0 && m0.vinted_annonce_numeros && m0.vinted_annonce_numeros['5551'].min), '`main` n’est jamais écrit par l’extension');
      const reg = await C.offreAutoReglages();
      dit(reg && reg.mins && reg.mins['5551'] === 58 && reg.mins['5552'] === undefined, 'le moteur des offres lit le prix mini posé (58 € sur l’annonce du N°7, rien sur le N°8)', JSON.stringify(reg && reg.mins));
      const pf = typeof C.plancherFavori === 'function' ? await C.plancherFavori('5551') : null;
      dit(pf && pf.c === 5800 && pf.de === 'mini', 'le plancher des favoris lit le prix mini posé (58 €)', JSON.stringify(pf));
    }
  }
  // 4. Le panneau et l'app
  const badge = fs.readFileSync(path.join(R, 'vinted-sync-extension/vrm-badge.js'), 'utf8');
  const depot = fs.readFileSync(path.join(R, 'vinted-sync-extension/vrm-depot.js'), 'utf8');
  const ui = fs.readFileSync(path.join(R, 'vinted-sync-extension/vrm-ui.js'), 'utf8');
  const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
  dit(/PRIX_MINI/.test(ui) && /pm_titre: \{ fr: [^}]*en: [^}]*es: [^}]*it: [^}]*de: /.test(ui), 'vrm-ui.js : la rangée « Prix minimum », textes en 5 langues');
  dit((badge.match(/pmPoser6\(g, /g) || []).length >= 2 && /pmPoser6\(g, pmArts, \(\) => envoyer6\(\{ action: 'publierAussiLancer'/.test(badge) && /pmPoser6\(g, \[\{[^\n]*\}\], \(\) => envoyer6\(\{ action: 'publierCarte'/.test(badge), 'panneau : « Publier partout » et « Publier sur… » rangent le prix mini AVANT de lancer');
  dit(/action: 'prixMiniCarte', quoi: 'poser'[^\n]*\n[^\n]*if \(r && r\.ok\) \{ pmPour = ''; lancer\(\)/.test(depot), 'panneau : le dépôt de fiches range le prix mini AVANT le dépôt (rien ne part si l’écriture rate)');
  dit(/pmAbsorber\(fiches, l\.cles\[PM_CLE\], cleNum\)/.test(app) && /apres: \{ min: v, minAt: new Date\(\)\.toISOString\(\) \}/.test(app), 'l’app absorbe le prix mini posé et date sa propre saisie (minAt)');
  console.log(`\n${ko ? '❌' : '✅'} audit-prix-mini-pose : ${ok} verts${ko ? `, ${ko} rouges` : ''}`);
  process.exit(ko ? 1 : 0);
})();
