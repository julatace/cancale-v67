#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT « VAGUE 3 — ÉCRANS » (6 nov.)
//   node scripts/audit-vague3-ecrans.cjs            (les règles telles qu'elles sont)
//   node scripts/audit-vague3-ecrans.cjs --prouve   (+ chaque mutation DOIT rougir)
// ═══════════════════════════════════════════════════════════════════════════
// Le banc `scripts/bancs/vague3-ecrans.cjs` juge l'écran rendu ; cet audit juge
// les RÈGLES, sans navigateur (récit : docs/passation/2026-11-06-vague3-ecrans.md) :
//   K  la carte sombre : ses encres sont des JETONS de src/themeMineral.js, et le
//      texte secondaire (`surSombre2`) tient 4,5:1 au PIRE point — l'arrêt le plus
//      clair du dégradé (`carteSombre`), sous le voile d'une case (`caseSombre`) —
//      dans les deux thèmes ; fusion.css n'écrit plus de blanc translucide à la main ;
//   S  « Ranger » vise sa case : la cible `case` (src/cibleNotif.js, EXÉCUTÉE) ne vise
//      qu'une place (meuble + case), jamais vide ; la case du Stock porte son crochet ;
//      la cloche « Où ranger » mène à LA case ; `poserCible` la fait sélectionner ;
//   X  Statistiques : « Annulations », « Notes reçues », « Boost » et « Offres » lisent
//      les comptes écartés par UN crochet qui suit le nuage (`useCompteEcarte`), jamais
//      une lecture figée au montage ;
//   F  Annonces · Vinted : la tête de Vinted s'y tait (`sansFraicheur`), la fraîcheur
//      y est dite par `FraicheurAnnonces` seule.
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (m) { const p = m[1].split(',').map((x) => Number(x.trim())); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } const h = /#([0-9a-f]{6})/i.exec(s); return h ? [...hex('#' + h[1]), 1] : null; };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const sur = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));

async function charger(mut) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v3ecr-'));
  const ecrire = (f) => { let t = lire(f); if (mut && mut.fichier === f) t = mut.fn(t); const p = path.join(dir, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); return t; };
  const theme = ecrire('src/themeMineral.js'), cible = ecrire('src/cibleNotif.js'); ecrire('src/profilVendeur.js');   // (lot vocabulaire-article) importé par cibleNotif
  fs.writeFileSync(path.join(dir, 'src', 'package.json'), '{"type":"module"}');
  const fusion = mut && mut.fichier === 'src/design/fusion.css' ? mut.fn(lire('src/design/fusion.css')) : lire('src/design/fusion.css');
  const app = mut && mut.fichier === 'src/App.jsx' ? mut.fn(require("./_source-app.cjs").sourceApp()) : require("./_source-app.cjs").sourceApp();
  const T = await import('file://' + path.join(dir, 'src', 'themeMineral.js'));
  const C = await import('file://' + path.join(dir, 'src', 'cibleNotif.js'));
  fs.rmSync(dir, { recursive: true, force: true });
  return { T, C, fusion, app: sansCommentaires(app), theme, cible };
}

// Le corps d'une fonction de premier niveau d'App.jsx (jusqu'à la suivante).
const corps = (src, nom) => { const i = src.indexOf(`function ${nom}(`); if (i < 0) return ''; const j = src.indexOf('\nfunction ', i + 10); return src.slice(i, j < 0 ? undefined : j); };

function verifier(M, dit) {
  const { T, C, fusion, app } = M;
  // ── K
  for (const [nom, t] of [['clair', T.MINERAL], ['sombre', T.MINERAL_DARK]]) {
    const ok = t && t.carteSombre && t.carteSombreClair && t.caseSombre && t.surSombre && t.surSombre2;
    dit(!!ok, 'K', `${nom} : les jetons de la carte sombre existent (carteSombre, carteSombreClair, caseSombre, surSombre, surSombre2)`);
    if (!ok) continue;
    const arrets = (String(t.carteSombre).match(/#[0-9a-f]{6}|rgba?\([^)]*\)/gi) || []).map(rgba);
    const clair = rgba(t.carteSombreClair);
    const leplus = arrets.length && Math.max(...arrets.map(lum));
    dit(arrets.length >= 2 && Math.abs(lum(clair) - leplus) < 1e-6, 'K', `${nom} : « carteSombreClair » est l'arrêt le plus clair du dégradé`, `${t.carteSombreClair} / ${t.carteSombre}`);
    const caseFond = sur(rgba(t.caseSombre), clair);
    for (const [quoi, enc, min] of [['surSombre2 (texte secondaire)', t.surSombre2, 4.5], ['surSombre (chiffres)', t.surSombre, 4.5]]) {
      const fg = rgba(enc);
      const rCase = ratio(sur(fg, caseFond), caseFond), rFond = ratio(sur(fg, clair), clair);
      dit(rCase >= min && rFond >= min, 'K', `${nom} : ${quoi} ≥ ${min}:1 au pire point (case ${rCase.toFixed(2)}:1, fond ${rFond.toFixed(2)}:1)`);
    }
  }
  const vars = T.variablesTheme ? T.variablesTheme(T.MINERAL_DARK, true) : {};
  dit(['--vrm-carte-sombre', '--vrm-case-sombre', '--vrm-sur-sombre', '--vrm-sur-sombre-2'].every((k) => vars[k]), 'K', 'variablesTheme pose --vrm-carte-sombre, --vrm-case-sombre, --vrm-sur-sombre, --vrm-sur-sombre-2');
  const fus = fusion.replace(/\/\*[\s\S]*?\*\//g, '');
  const enDur = fus.match(/(?:^|[;{\s])color:\s*rgba\(255,\s*255,\s*255,\s*\.(?:6\d?|7\d?|8)\)/g) || [];
  dit(!enDur.length, 'K', 'fusion.css : aucun texte gris (blanc à 60-80 %) écrit à la main sur la carte sombre (le jeton --fu-sur-sombre-2)', enDur.slice(0, 4).join(' ¦ '));
  dit(/--fu-sombre:\s*var\(--vrm-carte-sombre/.test(fus) && /--fu-sur-sombre-2:\s*var\(--vrm-sur-sombre-2/.test(fus) && /\.vrm-fu-case\s*\{[^}]*background:\s*var\(--fu-case-sombre\)/.test(fus), 'K', 'fusion.css : le fond, le voile de case et l’encre secondaire lisent les jetons');
  // ── S
  const lc = (o) => (C.lireCible ? C.lireCible(new URLSearchParams(o)) : null);
  const c = lc('cible=case&meuble=mA&i=3');
  dit(!!c && C.jetonsCible && JSON.stringify(C.jetonsCible(c)) === '["case:mA:3"]', 'S', 'cible=case&meuble=mA&i=3 ⇒ le jeton « case:mA:3 »', JSON.stringify(c));
  dit(!lc('cible=case&meuble=mA') && !lc('cible=case&i=3') && !lc('cible=case&meuble=mA&i=x') && !lc('cible=case&meuble=m%20A&i=2'), 'S', 'une case sans place (meuble ou n° absent, mal formé) ⇒ aucune cible (jamais « la première »)');
  dit(C.attrCible && C.attrCible(['case', 'mA', 3]) === 'case:mA:3' && C.attrCible(['case', 'mA', '']) === undefined, 'S', 'attrCible([case, meuble, i]) écrit « case:mA:3 », rien sans identité');
  dit(C.selecteursCible && C.selecteursCible(c).essais.includes('[data-case-ici="mA:3"]') && !!C.phraseAbsente(c), 'S', 'la case se trouve aussi par `data-case-ici`, et son absence se dit');
  const sm = corps(app, 'StockMeubles');
  dit(/data-cible=\{attrCible\(\['case',\s*m\.id,\s*i\]\)\}/.test(sm), 'S', 'chaque case du Stock porte son crochet `data-cible` (case:meuble:i)');
  dit(/premiereCaseMeubles\(\{\s*meubles,\s*slots\s*\}\)/.test(sm) && /viserCase\(libre\.meubleId,\s*libre\.i\)/.test(sm), 'S', '« Ranger au stock » vise la première case libre (la règle de src/ouRanger.js)');
  dit(/viserCase\(s0\.m,/.test(sm), 'S', '« Voir au stock » vise la case du N° quand il en a une');
  dit(/estChoisie\s*\|\|/.test(sm) && /data-case-choisie=/.test(sm), 'S', 'la case visée est SÉLECTIONNÉE (is-vise, data-case-choisie)');
  dit(/cible=case&meuble=\$\{encodeURIComponent\(c\.meubleId\)\}&i=/.test(app), 'S', 'la cloche « Où ranger » mène à LA case proposée (cible=case)');
  dit(/c\.type === 'case'[^\n]*DEMANDE_STOCK_CASE\.m\s*=/.test(app), 'S', '`poserCible` fait sélectionner la case par le Stock (DEMANDE_STOCK_CASE)');
  // ── X
  const ecr = corps(app, 'useCompteEcarte');
  dit(/onCloudReady\(/.test(ecr) && /vinted_accounts_hidden/.test(ecr) && /vrm:save/.test(ecr) && /lireSupprimes\(\)/.test(ecr), 'X', '`useCompteEcarte` relit les comptes écartés à l’arrivée du nuage et à chaque « Masquer »');
  const an = corps(app, 'AnnulationsEtNotes'), sv = corps(app, 'StatsVitrine');
  dit(/useCompteEcarte\(panelOff\)/.test(an) && !/load\('vinted_accounts_hidden'/.test(an), 'X', '« Annulations » et « Notes reçues » : le crochet partagé, plus de lecture figée au montage');
  dit(/useCompteEcarte\(panelOff\)/.test(sv) && !/load\('vinted_accounts_hidden'/.test(sv), 'X', '« Boost » et « Offres » (StatsVitrine) : le même crochet');
  // ── F
  const vr = corps(app, 'VintedResume');
  dit(/sansFraicheur\s*=\s*false/.test(vr) && /\{!sansFraicheur && \(\(\) =>/.test(vr), 'F', 'la tête de Vinted sait se taire sur la fraîcheur (`sansFraicheur`)');
  // (9 nov., lot AG) Ventes non plus : la fraîcheur des comptes est dite par la ligne UNIQUE du haut de l'app
  // (src/LigneFraicheur.jsx) ; la tête de Vinted n'est plus rendue sous les onglets Vinted.
  dit(!/<VintedResume /.test(app) && /<LigneFraicheurParesseuse /.test(app), 'F', 'Annonces et Ventes · Vinted : la tête se tait, la ligne de fraîcheur unique du haut (et `FraicheurAnnonces` sur Annonces) parle');
}

const MUTATIONS = [
  ['K', 'texte secondaire sombre redescendu à 65 %', 'src/themeMineral.js', (t) => t.replace("surSombre2:'rgba(255,255,255,.82)'", "surSombre2:'rgba(255,255,255,.65)'")],
  ['K', 'arrêt clair mal nommé', 'src/themeMineral.js', (t) => t.replace("carteSombreClair:'#2A5385'", "carteSombreClair:'#1B2D45'")],
  ['K', 'un blanc à 62 % remis à la main', 'src/design/fusion.css', (t) => t.replace('.vrm-fu-surtitre { display: block; font: 600 13px/1.3 var(--vrm-police); color: var(--fu-sur-sombre-2);', '.vrm-fu-surtitre { display: block; font: 600 13px/1.3 var(--vrm-police); color: rgba(255,255,255,.62);')],
  ['S', 'la cible case acceptée sans n°', 'src/cibleNotif.js', (t) => t.replace("if (!c.meuble || !c.i) return null;", "if (!c.meuble) return null;")],
  ['S', 'le type case retiré', 'src/cibleNotif.js', (t) => t.replace(", 'doublon', 'case'];", ", 'doublon'];")],
  ['S', 'la cloche remise sur « ?tab=garage » seul', 'src/App.jsx', (t) => t.replace('`?tab=garage&cible=case&meuble=${encodeURIComponent(c.meubleId)}&i=${Number(c.i)}`', "'?tab=garage'")],
  ['S', '« Ranger au stock » ne propose plus de case', 'src/App.jsx', (t) => t.replace('if (libre) { viserCase(libre.meubleId, libre.i);', 'if (libre) {')],
  ['X', 'le prédicat figé au montage (avant)', 'src/App.jsx', (t) => t.replace("const ecarteUid = useCompteEcarte(panelOff);", "const ecarteUid = React.useMemo(() => { const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String)); return (u) => compteEcarte(u, hAcc, panelOff || {}); }, [panelOff]);")],
  ['X', 'le crochet ne suit plus le nuage', 'src/App.jsx', (t) => t.replace("const stop = onCloudReady(() => setTick((t) => t + 1));\n    return () => { window.removeEventListener('vrm:save', f); if (typeof stop === 'function') stop(); };\n  }, []);\n  return React.useMemo(() => {\n    const hAcc", "const stop = null;\n    return () => { window.removeEventListener('vrm:save', f); if (typeof stop === 'function') stop(); };\n  }, []);\n  return React.useMemo(() => {\n    const hAcc")],
  ['F', 'la tête redit la fraîcheur sur Annonces', 'src/App.jsx', (t) => t.replace(" sansFraicheur={sec==='annonces'}", '')],
];

(async () => {
  let ko = 0;
  const parCle = {};
  const dit = (c, k, m, d) => { parCle[k] = parCle[k] || { ok: 0, ko: 0 }; if (c) parCle[k].ok++; else { parCle[k].ko++; ko++; } console.log((c ? '✅ ' : '❌ ') + k + ' ' + m + (!c && d ? ' — ' + d : '')); };
  verifier(await charger(null), dit);
  console.log('\n' + Object.entries(parCle).map(([k, v]) => `${k} : ${v.ok} vert(s), ${v.ko} rouge(s)`).join(' · '));
  if (PROUVE) {
    console.log('\n── Mutations (chacune DOIT rougir)');
    for (const [k, nom, fichier, fn] of MUTATIONS) {
      const avant = lire(fichier);
      if (fn(avant) === avant) { ko++; console.log(`❌ mutation ${k} « ${nom} » : le texte à muter est introuvable`); continue; }
      let rouges = 0;
      try { verifier(await charger({ fichier, fn }), (c) => { if (!c) rouges++; }); } catch (_) { rouges++; }
      if (!rouges) ko++;
      console.log(`${rouges ? '✅' : '❌'} mutation ${k} « ${nom} » : ${rouges} rouge(s)`);
    }
  }
  console.log(ko ? `\n❌ audit-vague3-ecrans : ${ko} défaut(s)` : '\n✅ audit-vague3-ecrans : tout est vert');
  process.exit(ko ? 1 : 0);
})();
