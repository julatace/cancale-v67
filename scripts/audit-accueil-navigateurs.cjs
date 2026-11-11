// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LA PAGE D'ACCUEIL DIT LES VRAIS NAVIGATEURS — node scripts/audit-accueil-navigateurs.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (5 nov.) La page publique (src/Accueil.jsx) disait « Chrome » obligatoire. Or
// le paquet servi (public/VRM-extension.zip) s'installe dans tous les navigateurs
// Chromium (Chrome, Edge, Brave, Opera, Vivaldi), et Orion a son paquet servi
// (public/VRM-Orion.xpi), installable mais dont la lecture de Vinted n'est pas
// confirmée. La règle : `navigateursServis()` (src/navigateurExtension.js) —
// rien de plus que ce qui marche, et l'ordinateur reste nécessaire tant
// qu'aucun chemin sur téléphone n'est prouvé (`lectureTelephone: false`).
//
// Il EXÉCUTE :
//   A. la règle — liste par défaut, Firefox seulement avec SA fiche publiée,
//      Orion seulement avec son paquet servi et toujours « en essai » (jamais
//      dans la liste de l'ordinateur), Safari jamais, aucun chemin téléphone ;
//      chaque promesse adossée à un fichier réellement servi (public/) ;
//   B. la VRAIE page, rendue (esbuild + react-dom/server), au doigt et à la
//      souris : chaque navigateur servi est nommé, aucune forme « Chrome
//      obligatoire » (« dans Chrome », « Chrome ouvert », « à Chrome »…),
//      l'ordinateur reste nécessaire, Orion dit « en essai » et « pas encore
//      confirmée », Safari « pas encore », et la page ne dit nulle part que le
//      téléphone suffit.
// `--prouve` : réaffaiblit la règle ou la page, une mutation à la fois, et exige
// le ROUGE (puis remet les fichiers à l'identique).
'use strict';
const path = require('path'), fs = require('fs');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const NAV = path.join(R, 'src', 'navigateursServis.js');   // la règle (ré-exportée par navigateurExtension.js)
  const ACC = path.join(R, 'src', 'Accueil.jsx');   // eslint-disable-line no-unused-vars
  const FR = path.join(R, 'src', 'i18n', 'langues', 'fr.js');
  const MUTS = [
    ['Orion promis comme Chrome', NAV, "ordinateur: [...NAVIGATEURS_CHROMIUM, ...(firefox ? ['Firefox'] : [])],", "ordinateur: [...NAVIGATEURS_CHROMIUM, 'Orion', ...(firefox ? ['Firefox'] : [])],"],
    ['Firefox promis sans fiche', NAV, "...(firefox ? ['Firefox'] : [])],", "'Firefox'],"],
    ['téléphone promis', NAV, 'lectureTelephone: false,', 'lectureTelephone: true,'],
    ['Edge oublié', NAV, "['Chrome', 'Edge', 'Brave', 'Opera', 'Vivaldi'];", "['Chrome', 'Brave', 'Opera', 'Vivaldi'];"],
    // (11 nov., lot traduction) Les phrases de la page vivent dans le dictionnaire français.
    ['« dans Chrome » remis (à la souris)', FR, 'L’extension s’installe une fois sur ton ordinateur, dans {navigateurs} — il reste', 'L’extension s’installe une fois dans Chrome, sur ton ordinateur — il reste'],
    ['« dans Chrome » remis (au doigt)', FR, 'installe l’extension une fois sur ton ordinateur : {navigateurs}.', 'installe l’extension une fois dans Chrome sur ordinateur.'],
    ['« ordinateur nécessaire » retiré', FR, 'Ton ordinateur reste nécessaire : c’est lui qui lit Vinted. ', ''],
    ['Orion sans « en essai »', FR, ': en essai, lecture de Vinted pas encore confirmée.', ': il marche aussi.'],
    ['« Chrome ouvert » remis', FR, 'allumé, navigateur ouvert.', 'allumé, Chrome ouvert.'],
  ];
  let rouges = 0;
  const origines = new Map();
  process.on('exit', () => { for (const [f, t] of origines) fs.writeFileSync(f, t); });
  for (const [nom, f, avant, apres] of MUTS) {
    const src = origines.get(f) || fs.readFileSync(f, 'utf8');
    origines.set(f, src);
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable (elle ne prouve rien)`); continue; }
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 300000 });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); }
  }
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String((e && e.stack) || e).slice(0, 400)); } };

// Les formes qui font d'un seul navigateur une obligation (texte rendu).
const CHROME_SEUL = [
  /\bdans (?:ce |le |ton |son |un )?Chrome\b(?! Web Store|, Edge)/,
  /\bà Chrome\b/,
  /\bavec Chrome\b/,
  /\bChrome (?:ouvert|obligatoire|seulement|uniquement|est |n’|n')/,
  /\b(?:ton|son|mon|du|au) Chrome\b(?! Web Store)/,
  /\bseulement (?:dans|sur|avec) Chrome\b/,
];

(async () => {
  console.log('── A. la règle (src/navigateurExtension.js)');
  let N = null;
  await essaie('A', async () => {
    N = await import('file://' + path.join(R, 'src', 'navigateurExtension.js'));
    if (typeof N.navigateursServis !== 'function') throw new Error('navigateursServis absente');
    const d = N.navigateursServis();
    dit(['Chrome', 'Edge', 'Brave', 'Opera', 'Vivaldi'].every((n) => d.ordinateur.includes(n)), 'A1 sur ordinateur : Chrome, Edge, Brave, Opera, Vivaldi (le paquet Chromium servi)', d.ordinateur.join(','));
    dit(!d.ordinateur.includes('Firefox') && d.pasEncore.includes('Firefox'), 'A2 Firefox : pas encore (aucune fiche publiée, aucun paquet servi)', JSON.stringify(d));
    dit(!d.ordinateur.includes('Safari') && d.pasEncore.includes('Safari'), 'A3 Safari : pas encore, jamais promis', JSON.stringify(d));
    dit(d.essai.join(',') === 'Orion' && !d.ordinateur.includes('Orion'), 'A4 Orion : en essai, jamais dans la liste de ce qui marche', JSON.stringify(d));
    dit(d.lectureTelephone === false, 'A5 aucun chemin téléphone prouvé ⇒ l’ordinateur reste nécessaire', String(d.lectureTelephone));
    const f = N.navigateursServis({ ...N.LIENS_BOUTIQUES, firefox: 'https://addons.mozilla.org/firefox/addon/vrm/' });
    dit(f.ordinateur.includes('Firefox') && !f.pasEncore.includes('Firefox'), 'A6 la fiche Firefox publiée ⇒ Firefox nommé', JSON.stringify(f));
    const o = N.navigateursServis(N.LIENS_BOUTIQUES, '');
    dit(o.essai.length === 0, 'A7 sans paquet Orion servi ⇒ Orion pas nommé', JSON.stringify(o));
    dit(N.NAVS_ORDINATEUR_TEXTE === 'Chrome, Edge, Brave, Opera ou Vivaldi', 'A8 la liste se lit en français (« Chrome, Edge, Brave, Opera ou Vivaldi »)', N.NAVS_ORDINATEUR_TEXTE);
    // Chaque promesse est adossée à un fichier SERVI (public/ part tel quel en production).
    dit(fs.existsSync(path.join(R, 'public', 'VRM-extension.zip')), 'A9 le paquet Chromium promis est servi (public/VRM-extension.zip)');
    dit(!d.essai.includes('Orion') || fs.existsSync(path.join(R, 'public', N.LIEN_ORION_FICHIER.replace(/^\//, ''))), 'A10 Orion n’est nommé que si son paquet est servi (public' + (N.LIEN_ORION_FICHIER || '') + ')');
    // Un navigateur où l'extension ne s'installe pas n'est jamais dans la liste.
    const pasIci = { safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' };
    dit(Object.values(pasIci).every((ua) => N.extensionIci(ua).accepte === 'non'), 'A11 Safari, Safari iPhone, Chrome Android : l’extension n’y est pas acceptée (règle de l’app) — la page ne les promet pas');
  });

  console.log('\n── B. la page rendue (src/Accueil.jsx)');
  const rendre = async (tactile) => {
    const esbuild = require(path.join(R, 'node_modules', 'esbuild'));
    const sortie = path.join(R, 'src', `__audit-accueil-${process.pid}.cjs`);   // jamais écrit : compilé en mémoire
    const res = await esbuild.build({ entryPoints: [path.join(R, 'src', 'Accueil.jsx')], bundle: true, write: false, platform: 'node', format: 'cjs', outfile: sortie, jsx: 'automatic', loader: { '.css': 'empty', '.png': 'empty', '.svg': 'empty', '.woff2': 'empty' }, external: ['react', 'react-dom'], logLevel: 'silent', nodePaths: [path.join(R, 'node_modules')],
      // Les morceaux chargés plus tard (l'app, les écrans du bas) ne font pas partie du premier rendu.
      plugins: [{ name: 'plus-tard', setup(b) { b.onResolve({ filter: /(?:^|\/)(?:App\.jsx|accueil-scenes\.jsx|AccueilFilm\.jsx)$/ }, (a) => (a.kind === 'dynamic-import' ? { path: a.path, external: true } : undefined)); } }] });
    global.window = { matchMedia: (q) => ({ matches: tactile ? /coarse|hover: none/.test(q) : false, addEventListener() {}, removeEventListener() {} }), innerWidth: tactile ? 390 : 1512 };
    const React = require(path.join(R, 'node_modules', 'react'));
    const RDS = require(path.join(R, 'node_modules', 'react-dom', 'server'));
    const Module = require('module');
    const mod = new Module(sortie, module);
    mod.filename = sortie; mod.paths = Module._nodeModulePaths(R);
    mod._compile(res.outputFiles[0].text, sortie);
    const M = mod.exports;
    // (les avertissements « useLayoutEffect sur le serveur » de React ne disent rien de la page)
    const err0 = console.error; console.error = () => {};
    let html; try { html = RDS.renderToStaticMarkup(React.createElement(M.default, { onEntrer: () => {} })); } finally { console.error = err0; }
    delete global.window;
    return html;
  };
  const texteDe = (html) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  for (const tactile of [false, true]) {
    const qui = tactile ? 'au doigt' : 'à la souris';
    await essaie('B ' + qui, async () => {
      const html = await rendre(tactile);
      const t = texteDe(html);
      const servis = N ? N.navigateursServis() : { ordinateur: [] };
      const pre = /<div[^>]*data-prerequis=""[^>]*>([\s\S]*?)<\/div>/.exec(html);
      const preT = pre ? texteDe(pre[1]) : '';
      dit(pre && /data-variante="(tactile|souris)"/.exec(pre[0])[1] === (tactile ? 'tactile' : 'souris'), `B1 ${qui} : le prérequis rendu est celui ${tactile ? 'du téléphone' : 'de l’ordinateur'}`, pre && pre[0].slice(0, 200));
      dit(servis.ordinateur.length > 0 && servis.ordinateur.every((n) => preT.includes(n)), `B2 ${qui} : le premier écran nomme chaque navigateur servi`, preT);
      dit(/ordinateur/i.test(preT), `B3 ${qui} : le premier écran dit qu’il faut un ordinateur`, preT);
      const fautes = CHROME_SEUL.map((re) => re.exec(t)).filter(Boolean).map((m) => m[0]);
      dit(fautes.length === 0, `B4 ${qui} : aucune forme « Chrome obligatoire » dans la page`, fautes.join(' | '));
      const etape = /<h3>[^<]*extension[^<]*<\/h3><p[^>]*>([^<]*)</.exec(html);
      dit(etape && !CHROME_SEUL.some((re) => re.test(texteDe(etape[0]))) && servis.ordinateur.every((n) => etape[1].includes(n)), `B5 ${qui} : l’étape « Ajoute l’extension » nomme les navigateurs, pas Chrome seul`, etape && etape[0]);
      const note = /data-ordinateur-necessaire=""[^>]*>([^<]*)</.exec(html);
      dit(note && /ordinateur reste nécessaire/.test(note[1]) && !/Chrome/.test(note[1]), `B6 ${qui} : « ton ordinateur reste nécessaire », sans Chrome`, note && note[1]);
      const essai = /data-navigateurs-essai="([^"]*)"[^>]*>([^<]*(?:<!-- -->[^<]*)*)</.exec(html);
      const essaiT = essai ? texteDe(essai[2]) : '';
      dit(essai && essai[1] === 'Orion' && /en essai/.test(essaiT) && /pas encore confirmée/.test(essaiT) && /Safari/.test(essaiT) && /pas encore/.test(essaiT), `B7 ${qui} : Orion « en essai, lecture pas encore confirmée » ; Safari « pas encore »`, essaiT || (essai && essai[0]));
      dit(!/(?:ton |le )?téléphone (?:suffit|seul)|sans ordinateur/i.test(t), `B8 ${qui} : la page ne dit nulle part que le téléphone suffit`, (/.{40}(?:téléphone (?:suffit|seul)|sans ordinateur).{40}/i.exec(t) || [''])[0]);
    });
  }

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + ((e && e.stack) || e)); process.exit(1); });
