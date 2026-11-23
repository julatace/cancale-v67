#!/usr/bin/env node
// audit-reglages-auto (20 nov., ext. 5.410) — les automatisations vivent dans l'EXTENSION (Julien, 20 nov.) :
// le panneau ÉCRIT leurs réglages dans la ligne dédiée `vrm_reglages_auto` (jamais `main`), l'app et les moteurs
// la LISENT par la même règle (`superposerReglagesAuto`). Ce banc EXÉCUTE :
//  1. le bloc <reglages-auto-ligne> est le MÊME dans src/reglagesAutoLigne.js et background.js (--recopie le refait) ;
//  2. le vrai `reglageAutoCarte` + `lireMain` de background.js sur une base en mémoire : un réglage écrit depuis le
//     panneau est relu IDENTIQUE par le moteur (lireMain) et par la règle de l'app ; il ne touche que SA ligne ;
//  3. éteint par défaut (aucune ligne ⇒ `main`, rien ⇒ éteint) ; allumer sans `confirme` ⇒ refusé, rien d'écrit ;
//     éteindre passe ; valeurs hors bornes refusées ; un autre compte ne bouge pas ;
//  4. ligne illisible ⇒ `lireMain` rend null (le moteur ne fait rien) ;
//  5. aucun plafond n'est réglable ici (`vinted_offres_garde`, `vinted_discretion` hors de la liste) ;
//  6. l'app lit la ligne (appliquerReglagesAutoLigne) et y recopie ses propres gestes (save → ecrireReglagesAutoLigne).
// --mutation : affaiblit chaque règle et exige le rouge.
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
const F_SRC = path.join(R, 'src/reglagesAutoLigne.js'), F_BG = path.join(R, 'vinted-sync-extension/background.js'), F_APP = path.join(R, 'src/App.jsx');
const DEB = '// <reglages-auto-ligne>', FIN = '// </reglages-auto-ligne>';
const bloc = (t) => { const a = t.indexOf(DEB), b = t.indexOf(FIN); return a < 0 || b < 0 ? null : t.slice(a, b + FIN.length); };
if (process.argv.includes('--recopie')) {
  const b = bloc(fs.readFileSync(F_SRC, 'utf8')); let bg = fs.readFileSync(F_BG, 'utf8'); const vieux = bloc(bg);
  if (!b || !vieux) { console.log('❌ bloc introuvable'); process.exit(1); }
  fs.writeFileSync(F_BG, bg.replace(vieux, b)); console.log('✅ bloc recopié dans background.js'); process.exit(0);
}
const fonction = (t, nom) => { const i = t.indexOf(`async function ${nom}(`); if (i < 0) throw new Error('absente : ' + nom); let p = t.indexOf('{', i), n = 0, j = p; for (; j < t.length; j++) { if (t[j] === '{') n++; else if (t[j] === '}') { n--; if (!n) break; } } return t.slice(i, j + 1); };

function verifier(SRC, BG, APP) {
  const fautes = []; const dit = (ok, f) => { if (!ok) fautes.push(f); };
  const bs = bloc(SRC), bb = bloc(BG);
  dit(bs && bb && bs === bb, 'le bloc <reglages-auto-ligne> diffère entre l’app et l’extension (node scripts/audit-reglages-auto.cjs --recopie)');
  // La règle de l'app (le module tel quel).
  const app = vm.runInNewContext(SRC.replace(/^export \{[^}]*\};?\s*$/m, '').replace(/^import [^\n]*$/mg, '') + '\n;({ superposerReglagesAuto, REGLAGES_AUTO_CLES });', {});
  // L'extension : son bloc + son lireMain + son reglageAutoCarte, sur une base en mémoire.
  const base = { main: {}, lignes: {}, ecritures: [], lectureRatee: false };
  const ctx = {
    base, JSON, Object, Number, String, Array, Date, Math,
    qMain: (cles) => ({ main: cles }),
    sbGet: async (q) => {
      if (q && q.main) { const o = {}; for (const k of q.main) if (base.main[k] !== undefined) o[k] = base.main[k]; return [o]; }
      if (base.lectureRatee) return null;
      const m = /id=eq\.([a-z_]+)&select=cles:data->cles/.exec(String(q)); if (!m) return null;
      const l = base.lignes[m[1]]; return l ? [{ cles: l.cles }] : [];
    },
    modifierLigneCas: async (id, f) => { const d = base.lignes[id] || null; const n = await f(d); if (n === undefined) return false; base.ecritures.push(id); base.lignes[id] = Object.assign({}, n, { rev: ((d && d.rev) || 0) + 1 }); return true; },
    ongletCarte: () => ({ url: 'https://www.vinted.fr/' }), compteConnecte: async () => '111', noterJournal: () => {},
  };
  vm.runInNewContext(bb + '\n' + fonction(BG, 'lireMain') + '\n' + fonction(BG, 'reglageAutoCarte') + '\n;globalThis.__x = { lireMain, reglageAutoCarte, REGLAGES_AUTO_CLES, regle: superposerReglagesAuto };', ctx);
  const X = ctx.__x;
  return (async () => {
    // Défaut : rien posé ⇒ éteint.
    let m = await X.lireMain(['vinted_offres_auto', 'vinted_offres_paliers']);
    dit(m && m.vinted_offres_auto !== true && !(m.vinted_offres_paliers && m.vinted_offres_paliers.actif === true), 'sans réglage, une automatisation n’est pas éteinte');
    // `main` d'avant reste valable tant que la ligne n'a pas la clé.
    base.main.vinted_offres_auto = true;
    m = await X.lireMain(['vinted_offres_auto']);
    dit(m && m.vinted_offres_auto === true, 'une valeur de `main` sans ligne n’est plus lue');
    base.main.vinted_offres_auto = false;
    // Allumer sans confirmation : refusé, rien d'écrit.
    let r = await X.reglageAutoCarte({ cle: 'vinted_offres_paliers', valeur: { actif: true, paliers: [40, 70, 100] } }, {});
    dit(r && r.ok === false && r.code === 'confirmation' && base.ecritures.length === 0, 'allumer les paliers sans « Oui, allumer » passe');
    r = await X.reglageAutoCarte({ cle: 'vinted_offres_auto', valeur: true }, {});
    dit(r && r.ok === false && base.ecritures.length === 0, 'allumer les offres auto sans confirmation passe');
    // Avec confirmation : écrit dans SA ligne, relu identique par le moteur et par l'app.
    r = await X.reglageAutoCarte({ cle: 'vinted_offres_paliers', valeur: { actif: true, paliers: [100, 40, 70, 40], remiseMax: 20 }, confirme: true }, {});
    dit(r && r.ok === true && r.relu === true, 'le réglage confirmé n’est pas écrit / relu : ' + JSON.stringify(r));
    dit(base.ecritures.every((id) => id === 'vrm_reglages_auto'), 'une écriture vise autre chose que la ligne dédiée : ' + base.ecritures.join(','));
    m = await X.lireMain(['vinted_offres_paliers']);
    const vueApp = app.superposerReglagesAuto({ vinted_offres_paliers: { actif: false } }, base.lignes.vrm_reglages_auto);
    dit(m && JSON.stringify(m.vinted_offres_paliers) === JSON.stringify(vueApp.vinted_offres_paliers) && m.vinted_offres_paliers.actif === true && m.vinted_offres_paliers.paliers.join(',') === '40,70,100' && m.vinted_offres_paliers.remiseMax === 20, 'le moteur et l’app ne relisent pas le même réglage : ' + JSON.stringify({ m: m && m.vinted_offres_paliers, a: vueApp.vinted_offres_paliers }));
    // Éteindre : immédiat, sans confirmation.
    r = await X.reglageAutoCarte({ cle: 'vinted_offres_paliers', valeur: { actif: false, paliers: [40, 70, 100] } }, {});
    m = await X.lireMain(['vinted_offres_paliers']);
    dit(r && r.ok && m.vinted_offres_paliers.actif === false, 'éteindre ne passe pas');
    // Baisse par règle : bornes, un compte à la fois.
    r = await X.reglageAutoCarte({ cle: 'vinted_baisse_regle', valeur: { uid: '111', actif: true, pct: 20, jours: 14 }, confirme: true }, {});
    dit(r && r.ok === false, 'une baisse de 20 % (hors 5/10/15) passe');
    base.main.vinted_baisse_regle = { v: 1, comptes: { 222: { actif: true, pct: 10, jours: 30, at: 1 } } };
    r = await X.reglageAutoCarte({ cle: 'vinted_baisse_regle', valeur: { uid: '111', actif: true, pct: 5, jours: 7 }, confirme: true }, {});
    m = await X.lireMain(['vinted_baisse_regle']);
    dit(r && r.ok && m.vinted_baisse_regle.comptes['111'].actif === true && m.vinted_baisse_regle.comptes['111'].pct === 5 && m.vinted_baisse_regle.comptes['222'] && m.vinted_baisse_regle.comptes['222'].pct === 10, 'la baisse d’un compte touche les autres ou ne passe pas : ' + JSON.stringify(m && m.vinted_baisse_regle));
    // Message de refus : borné.
    r = await X.reglageAutoCarte({ cle: 'vinted_offre_refus_msg', valeur: 'x'.repeat(1001) }, {});
    dit(r && r.ok === false, 'un message de plus de 1 000 caractères passe');
    // Plafonds : jamais ici.
    r = await X.reglageAutoCarte({ cle: 'vinted_offres_garde', valeur: { parHeure: 500 } }, {});
    dit(r && r.ok === false && !X.REGLAGES_AUTO_CLES.some((k) => /garde|discretion|plafond|actions/.test(k)), 'un plafond se règle depuis le panneau');
    // Ligne illisible ⇒ pas su.
    base.lectureRatee = true;
    m = await X.lireMain(['vinted_offres_auto']);
    dit(m === null, 'ligne illisible : le moteur lit quand même `main`');
    base.lectureRatee = false;
    // L'app : lit la ligne et y recopie ses gestes.
    const a = APP.replace(/\/\/.*$/gm, '');
    dit(/const appliquerReglagesAutoLigne\s*=/.test(a) && /appliquerReglagesAutoLigne\(\)/.test(a.slice(a.indexOf('markCloudReady(); '))), 'l’app ne relit pas la ligne des réglages au chargement');
    dit(/REGLAGES_AUTO_CLES\.includes\(k\)[^;]*ecrireReglagesAutoLigne\(owner, k, r\.v\)/.test(a), 'l’app ne recopie pas ses réglages dans la ligne dédiée');
    dit(!/id=eq\.\$\{SUPABASE_ROW\}[^`]*reglages/.test(a), 'l’app écrit les réglages dans main');
    return fautes;
  })();
}
(async () => {
  const SRC = fs.readFileSync(F_SRC, 'utf8'), BG = fs.readFileSync(F_BG, 'utf8'), APP = fs.readFileSync(F_APP, 'utf8');
  const f = await verifier(SRC, BG, APP);
  if (f.length) { console.log('❌ audit-reglages-auto\n - ' + f.join('\n - ')); process.exit(1); }
  console.log('✅ audit-reglages-auto : une source (vrm_reglages_auto), écrite par le panneau, relue identique par le moteur et l’app ; éteint par défaut ; allumer = confirmation ; plafonds hors d’atteinte');
  if (!process.argv.includes('--mutation')) return;
  const M = [
    ['bg', 'confirmation retirée', "if (allume(avant, v.actif) && confirme !== true) return refus;", ''],
    ['bg', 'offres auto sans confirmation', "if (allume(actuelle, demande) && confirme !== true) return refus;", ''],
    ['bg', 'la ligne ne gagne plus', "if (c) for (const k of REGLAGES_AUTO_CLES) if (Object.prototype.hasOwnProperty.call(c, k)) out[k] = c[k];", ''],
    ['bg', 'ligne illisible ignorée', "  if (l === null) return null;\n  return superposerReglagesAuto", "  return superposerReglagesAuto"],
    ['bg', 'baisse hors bornes', "if (!RA_BAISSE_PCT.includes(pct) || !RA_BAISSE_JOURS.includes(jours))", "if (!(pct > 0) || !(jours > 0))"],
    ['bg', 'écrit dans main', "const r = await modifierLigneCas(REGLAGES_AUTO_ID,", "const r = await modifierLigneCas('main',"],
    ['bg', 'plafond réglable', "'vinted_offres_paliers', 'vinted_baisse_regle'];", "'vinted_offres_paliers', 'vinted_baisse_regle', 'vinted_offres_garde'];"],
    ['app', 'app ne recopie plus', "if (owner && REGLAGES_AUTO_CLES.includes(k) && !r.conflit) ecrireReglagesAutoLigne(owner, k, r.v);", ''],
    ['app', 'app ne relit plus', "      appliquerReglagesAutoLigne();\n", ''],
  ];
  let ok = 0;
  for (const [o, nom, de, vers] of M) {
    const t = o === 'bg' ? BG : APP;
    if (t.split(de).length < 2) { console.log(`❌ mutation « ${nom} » : motif absent`); process.exit(1); }
    const mut = t.split(de).join(vers);
    let r; try { r = await verifier(o === 'bg' && /RA_|REGLAGES_AUTO_CLES|superposer/.test(de) ? SRC.split(de).join(vers) : SRC, o === 'bg' ? mut : BG, o === 'app' ? mut : APP); } catch (e) { r = ['levé ' + e.message]; }
    const vraies = r.filter((x) => !/diffère entre/.test(x));
    if (vraies.length) ok++; else { console.log(`❌ mutation « ${nom} » reste verte`); process.exit(1); }
  }
  console.log(`✅ mutations : ${ok}/${M.length} rouges`);
})();
