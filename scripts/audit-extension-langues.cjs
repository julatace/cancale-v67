#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — L'EXTENSION DANS CINQ LANGUES (16 nov., lot traduction-restes, 5.394)
//      node scripts/audit-extension-langues.cjs            (lecture seule)
//      node scripts/audit-extension-langues.cjs --prouve   (chaque mutation doit rougir)
// ════════════════════════════════════════════════════════════════════════════
//  L1 _locales (fr par défaut, en es it de) est celui que le code produit, chaque clé
//     traduite dans les quatre langues, les mêmes {variables} (scripts/extension-langues.cjs) ;
//  L2 le manifeste porte default_locale « fr » ;
//  L3 la fenêtre (popup.js), son HTML (popup.html), le diagnostic (parcours-popup.js) et la
//     connexion de la carte du logo (vrm-badge.js) ne gardent AUCUN texte en dur hors T() ;
//  L4 T() rend le français d'avant quand chrome.i18n se tait (repli), et la traduction
//     quand il répond (exécuté, pas lu) ;
//  L5 les zips servis portent _locales (un paquet sans lui afficherait les clés).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync, execFileSync } = require('child_process');
const R = process.env.EXT_LANGUES_RACINE || path.join(__dirname, '..');
const EXT = path.join(R, 'vinted-sync-extension');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '\n   → ' + (Array.isArray(d) ? d.slice(0, 25).join('\n   → ') : String(d).slice(0, 1500)) : ''}`); };
const lire = (f) => fs.readFileSync(path.join(EXT, f), 'utf8');

// L1, L2 : le générateur en vérificateur.
{
  const r = spawnSync(process.execPath, [path.join(R, 'scripts', 'extension-langues.cjs'), '--verifier'], { env: { ...process.env, EXT_LANGUES_RACINE: R }, encoding: 'utf8' });
  dit(r.status === 0, 'L1-L2 _locales à jour, chaque clé dans les cinq langues, mêmes variables, default_locale « fr »', (r.stdout + r.stderr).trim());
}

// L3 : aucun texte en dur hors T() dans les zones traduites.
// Un littéral « phrase » (une majuscule ou un mot, un espace, des lettres) qui n'est pas
// l'argument français d'un T() — dans popup.js et parcours-popup.js en entier, et dans
// vrm-badge.js : resumeEtat, depuis, heureCourte, et la connexion (de `const mail =` à la fin
// de `connexionFournisseur`). Les commentaires, les sélecteurs et les attributs techniques
// ne comptent pas.
function phrasesHorsT(src) {
  const net = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  const sansT = net.replace(/\bT\(\s*'[A-Za-z0-9_]+'\s*,\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, 'T(');
  const out = [];
  // littéraux '…' "…" et morceaux de gabarit `…` (hors ${…}) ; le texte entre balises >…<.
  const lits = sansT.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || [];
  for (let l of lits) {
    if (l[0] === '`') l = l.slice(1, -1).replace(/\$\{[^}]*\}/g, ' ');
    else l = l.slice(1, -1);
    for (const morceau of l.split(/<[^>]*>/)) {
      const v = morceau.replace(/\b(?:VRM|Vinted|Leboncoin|eBay|Vestiaire Collective|Vestiaire|Google|Discord|Orion|Chrome)\b/g, '').trim();
      if (/[A-Za-zÀ-ÿ’']{2,}\s+[A-Za-zÀ-ÿ’']{2,}/.test(v) && /[àâçéèêëîïôûùüÿœ’]|\b(?:le|la|les|un|une|de|du|des|ton|ta|tes|ce|pas|est|et|ou)\b/i.test(v)
        && !/^[\w.-]+\s*[:=]/.test(v) && !/[{};=]|=>|\bfunction\b/.test(morceau)) out.push(v.slice(0, 90));
    }
  }
  return out;
}
{
  const zones = [];
  for (const f of ['popup.js', 'parcours-popup.js']) zones.push([f, lire(f)]);
  const b = lire('vrm-badge.js');
  const tranche = (debut, fin) => { const i = b.indexOf(debut); const j = fin ? b.indexOf(fin, i + 1) : -1; return i < 0 ? null : b.slice(i, j > i ? j : undefined); };
  const morceaux = [
    ['vrm-badge.js resumeEtat', tranche('function resumeEtat(e)', '\n  }\n')],
    ['vrm-badge.js depuis', tranche('const depuis = (t) => {', '\n  };')],
    ['vrm-badge.js heureCourte', tranche('const heureCourte = (t)', '\n')],
    ['vrm-badge.js connexion', tranche('const mail = `<label', 'function connexionFournisseur')],
    ['vrm-badge.js connexion (envoi)', tranche('function connexionFournisseur', '\n  }\n')],
  ];
  for (const [n, t] of morceaux) { if (!t) dit(false, `L3 la zone « ${n} » se retrouve`); else zones.push([n, t]); }
  const durs = zones.flatMap(([n, t]) => phrasesHorsT(t).map((p) => `${n} : « ${p} »`));
  dit(zones.length >= 7 && !durs.length, `L3 aucun texte en dur hors T() dans la fenêtre, le diagnostic et la connexion de la carte (${zones.length} zones)`, durs);
  const html = lire('popup.html').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script[^>]*><\/script>/g, '');
  const textes = [...html.matchAll(/<(\w+)([^>]*)>([^<]*[A-Za-zÀ-ÿ]{2,}[^<]*)<\/\1>/g)].filter((m) => !/data-i18n=/.test(m[2]) && !/^\s*VRM\s*$/.test(m[3])).map((m) => m[3].trim().slice(0, 60));
  const arias = [...html.matchAll(/aria-label="([^"]*[a-zé] [^"]*)"/g)].filter((m) => !new RegExp(`aria-label="${m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*data-i18n-aria=`).test(html)).map((m) => m[1]);
  dit(!textes.length && !arias.length, 'L3 popup.html : chaque texte visible porte data-i18n (aria : data-i18n-aria)', [...textes, ...arias]);
}

// L4 : T() exécuté — repli français, puis la traduction servie.
{
  const src = lire('popup.js');
  const m = /\nconst T = \(cle, fr, vars\) => \{[\s\S]*?\n\};/.exec(src);
  let bon = false, detail = '';
  if (m) {
    const essai = (msg) => { const ctx = { chrome: { i18n: { getMessage: (k) => (msg ? msg[k] || '' : '') } } }; vm.createContext(ctx); vm.runInContext(m[0] + '\nthis.T = T;', ctx); return ctx.T; };
    const T0 = essai(null), Ten = essai({ p_titre: 'Sign in to VRM', p_maj_titre: 'New version available · {v}' });
    const r = [T0('p_titre', 'Connexion à VRM'), T0('p_maj_titre', 'Nouvelle version disponible · {v}', { v: '5.394.0' }), Ten('p_titre', 'Connexion à VRM'), Ten('p_maj_titre', 'Nouvelle version disponible · {v}', { v: '5.394.0' })];
    bon = r[0] === 'Connexion à VRM' && r[1] === 'Nouvelle version disponible · 5.394.0' && r[2] === 'Sign in to VRM' && r[3] === 'New version available · 5.394.0';
    detail = JSON.stringify(r);
    try { const Tx = (() => { const ctx = {}; vm.createContext(ctx); vm.runInContext(m[0] + '\nthis.T = T;', ctx); return ctx.T; })(); bon = bon && Tx('p_titre', 'Connexion à VRM') === 'Connexion à VRM'; } catch (e) { bon = false; detail += ' · sans chrome : ' + e.message; }
  }
  dit(!!m && bon, 'L4 T() : chrome.i18n muet (ou absent) ⇒ le français d’avant ; il répond ⇒ sa traduction, variables remplies', detail);
  const fr = JSON.parse(lire('_locales/fr/messages.json'));
  const memes = ['vrm-badge.js', 'parcours-popup.js'].every((f) => /const T = \(cle, fr, vars?\) => \{|const T=\(cle,fr,v\)=>\{/.test(lire(f)));
  dit(memes && fr.p_titre && fr.p_titre.message === 'Connexion à VRM', 'L4 la carte et le diagnostic ont la même règle T() ; le français servi est celui du code');
}

// L5 : les zips portent _locales.
{
  const manque = [];
  for (const z of ['VRM-extension.zip', 'VRM-Orion.xpi', 'VRM-Orion-dossier.zip']) {
    const p = path.join(R, 'public', z);
    if (!fs.existsSync(p)) { manque.push(`${z} absent`); continue; }
    let liste = ''; try { liste = execFileSync('unzip', ['-Z1', p], { encoding: 'utf8' }); } catch (e) { manque.push(`${z} illisible`); continue; }
    for (const l of ['fr', 'en', 'es', 'it', 'de']) if (!new RegExp(`(^|/)_locales/${l}/messages\\.json$`, 'm').test(liste)) manque.push(`${z} sans _locales/${l}/messages.json`);
  }
  dit(!manque.length, 'L5 VRM-extension.zip, VRM-Orion.xpi et VRM-Orion-dossier.zip portent _locales (cinq langues)', manque);
}

console.log(`\n${ko ? '❌' : '✅'} audit-extension-langues : ${ok} verts, ${ko} rouge(s)`);

if (process.argv.includes('--prouve') && !process.env.EXT_LANGUES_RACINE) {
  const MUTS = [
    ['un texte de la fenêtre remis en dur', 'vinted-sync-extension/popup.js', "a.textContent = T('p_maj_telecharger', 'Télécharger');", "a.textContent = 'Télécharger';"],
    ['un texte de la connexion de la carte remis en dur', 'vinted-sync-extension/vrm-badge.js', "${T('c_code_valider', 'Valider le code')}</button>", 'Valider le code</button>'],
    ['l’état de la carte remis en dur', 'vinted-sync-extension/vrm-badge.js', "texte: T('c_r_refuse', 'Dernier envoi refusé : voir ci-dessous') }", "texte: 'Dernier envoi refusé : voir ci-dessous' }"],
    ['un texte de popup.html sans data-i18n', 'vinted-sync-extension/popup.html', '<h1 data-i18n="p_titre">', '<h1>'],
    ['une traduction allemande manque', 'scripts/extension-langues-traductions.cjs', "it: 'Riapri questa finestra.', de: 'Öffne dieses Fenster erneut.' }", "it: 'Riapri questa finestra.' }"],
    ['une variable renommée en espagnol', 'scripts/extension-langues-traductions.cjs', "es: 'Renviar el código (en {s} s)'".replace('Renviar', 'Reenviar'), "es: 'Reenviar el código (en {sec} s)'"],
    ['default_locale retiré du manifeste', 'vinted-sync-extension/manifest.json', '\n  "default_locale": "fr",', ''],
    ['le repli français retiré de T()', 'vinted-sync-extension/popup.js', '  if (!s) s = fr;\n  return vars', '  return vars'],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-langues-'));
  let rouges = 0;
  const preparer = () => { fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true }); fs.cpSync(EXT, path.join(tmp, 'vinted-sync-extension'), { recursive: true }); fs.cpSync(path.join(R, 'public'), path.join(tmp, 'public'), { recursive: true, filter: (s) => !/\/aide\/captures|\.png$|\.jpe?g$|\.webp$/.test(s) });
    for (const f of ['extension-langues.cjs', 'extension-langues-traductions.cjs', 'audit-extension-langues.cjs']) fs.copyFileSync(path.join(R, 'scripts', f), path.join(tmp, 'scripts', f)); };
  preparer();
  const t0 = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'audit-extension-langues.cjs')], { env: { ...process.env, EXT_LANGUES_RACINE: tmp }, encoding: 'utf8' });
  console.log(`${t0.status === 0 ? '✅' : '❌'} témoin : la copie sans mutation est ${t0.status === 0 ? 'verte' : 'ROUGE'}`);
  for (const [nom, rel, avant, apres] of MUTS) {
    preparer();
    const f = path.join(tmp, rel); const s = fs.readFileSync(f, 'utf8');
    if (!s.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
    fs.writeFileSync(f, s.replace(avant, apres));
    const r = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'audit-extension-langues.cjs')], { env: { ...process.env, EXT_LANGUES_RACINE: tmp }, encoding: 'utf8' });
    if (r.status !== 0) rouges++;
    console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${rouges === MUTS.length && t0.status === 0 ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(rouges === MUTS.length && t0.status === 0 ? 0 : 1);
}
process.exit(ko ? 1 : 0);
