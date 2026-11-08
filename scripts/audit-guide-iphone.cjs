// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE GUIDE « INSTALLER VRM SUR L'IPHONE » — node scripts/audit-guide-iphone.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (5 nov.) Paramètres → Notifications montre, sur un iPhone dans Safari qui n'a
// pas encore installé l'app, trois gestes illustrés : Partager → « Sur l'écran
// d'accueil », puis activer les notifications depuis l'icône. Il se ferme et
// reste fermé. Règle : src/guideIphone.js ; écran : src/GuideIphone.jsx, posé
// dans `PushSetting` (src/App.jsx).
//
// Il EXÉCUTE :
//   A. la règle — iPhone + Safari + pas installée + pas fermé ⇒ visible ;
//      Chrome, Firefox, Edge, DuckDuckGo sur iPhone, Orion (`window.KAGI`), iPad,
//      Mac, Android ⇒ jamais ; installée (`navigator.standalone`, `display-mode`)
//      ⇒ jamais ; fermé ⇒ jamais, et la fermeture est retenue ; un stockage
//      interdit ne casse rien ; iOS < 16.4 ⇒ l'étape 3 dit de mettre à jour ;
//   B. le composant RENDU (esbuild + react-dom/server) — trois étapes, chacune
//      avec son dessin SVG (aucune image, aucune capture), un bouton qui ferme ;
//   C. son branchement dans `PushSetting` : la décision vient de la règle, et la
//      ligne « Partager → Sur l'écran d'accueil » ne se dit pas deux fois.
// `--prouve` : une mutation à la fois doit rendre l'audit ROUGE.
'use strict';
const path = require('path'), fs = require('fs');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const REG = path.join(R, 'src', 'guideIphone.js');
  const APP = path.join(R, 'src', 'App.jsx');
  const MUTS = [
    ['installée ignorée', REG, 'return estIphoneSafari(ua) && !installee && !ferme;', 'return estIphoneSafari(ua) && !ferme;'],
    ['fermé ignoré', REG, 'return estIphoneSafari(ua) && !installee && !ferme;', 'return estIphoneSafari(ua) && !installee;'],
    ['tout navigateur d’iPhone', REG, "return navigateurIci(ua == null ? undefined : u) === 'safari';", 'return true;'],
    ['iPad compris', REG, "if (!/\\b(?:iPhone|iPod)\\b/.test(u)) return false;", "if (!/\\b(?:iPhone|iPod|iPad)\\b/.test(u)) return false;"],
    ['standalone oublié', REG, "    if (w.navigator && w.navigator.standalone === true) return true;\n", ''],
    ['fermeture non retenue', REG, '    if (s) s.setItem(CLE_GUIDE_IPHONE, new Date(maintenant).toISOString());\n', ''],
    ['seuil iOS 16.4 faux', REG, 'return v[0] > 16 || (v[0] === 16 && v[1] >= 4);', 'return v[0] >= 16;'],
    ['phrase dite deux fois', APP, "{state==='unsupported' && !guideIphone && ' — Non disponible ici", "{state==='unsupported' && ' — Non disponible ici"],
    ['guide montré sans la règle', APP, '{guideIphone && <GuideIphone onFermer={fermerGuideIphone}/>}', '{<GuideIphone onFermer={fermerGuideIphone}/>}'],
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
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String((e && e.stack) || e).slice(0, 300)); } };

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  iphoneSafari163: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1',
  iphoneSafari164: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  iphoneFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15',
  iphoneEdge: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.0.2903.68 Mobile/15E148 Safari/605.1.15',
  iphoneDdg: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1 Ddg/18.6',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
};
// Node pose un `navigator` en lecture seule : on le remplace le temps d'un essai.
const avecNavigateur = (nav, f) => {
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  try { return f(); } finally { if (avant) Object.defineProperty(globalThis, 'navigator', avant); else delete globalThis.navigator; }
};
const stockage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

(async () => {
  let G = null;
  console.log('── A. la règle (src/guideIphone.js)');
  await essaie('A', async () => {
    G = await import('file://' + path.join(R, 'src', 'guideIphone.js'));
    const v = (ua, o = {}) => G.guideIphoneVisible({ ua, installee: false, ferme: false, ...o });
    dit(v(UA.iphoneSafari) === true, 'A1 iPhone, Safari, pas installée, pas fermé ⇒ le guide s’affiche');
    dit(['iphoneChrome', 'iphoneFirefox', 'iphoneEdge', 'iphoneDdg'].every((k) => v(UA[k]) === false), 'A2 Chrome, Firefox, Edge, DuckDuckGo sur iPhone ⇒ jamais (leurs menus ne sont pas ceux dessinés)');
    dit(['ipad', 'mac', 'android'].every((k) => v(UA[k]) === false), 'A3 iPad, Mac, Android ⇒ jamais');
    dit(v(UA.iphoneSafari, { installee: true }) === false, 'A4 déjà installée (ouverte depuis l’icône) ⇒ jamais');
    dit(v(UA.iphoneSafari, { ferme: true }) === false, 'A5 fermé ⇒ jamais');
    // Installée : les deux repères (Safari et `display-mode`).
    dit(G.estInstallee({ navigator: { standalone: true }, matchMedia: () => ({ matches: false }) }) === true, 'A6 `navigator.standalone` (Safari) ⇒ installée');
    dit(G.estInstallee({ navigator: {}, matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }) }) === true, 'A7 `display-mode: standalone` ⇒ installée');
    dit(G.estInstallee({ navigator: { standalone: false }, matchMedia: () => ({ matches: false }) }) === false, 'A8 un onglet de Safari ⇒ pas installée');
    dit(G.estInstallee({ navigator: {}, matchMedia: () => { throw new Error('x'); } }) === false, 'A9 une requête qui lève ne casse rien');
    // Fermé, et retenu.
    const s = stockage();
    dit(G.lireFerme(s) === false, 'A10 rien rangé ⇒ pas fermé');
    G.noterFerme(s, Date.parse('2026-11-05T09:00:00Z'));
    dit(G.lireFerme(s) === true && s.m.get(G.CLE_GUIDE_IPHONE) === '2026-11-05T09:00:00.000Z', 'A11 la fermeture est retenue sur l’appareil (et relue)', JSON.stringify([...s.m]));
    const interdit = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
    let leve = false; try { G.noterFerme(interdit); } catch (_) { leve = true; }
    dit(!leve && G.lireFerme(interdit) === false, 'A12 stockage interdit (navigation privée) : rien ne lève');
    // Orion se présente comme Safari : reconnu par `window.KAGI` dans le vrai navigateur.
    const [dansOrion, dansSafari] = avecNavigateur({ userAgent: UA.iphoneSafari }, () => {
      global.window = { KAGI: {} };
      const o = G.estIphoneSafari();
      delete global.window.KAGI;
      const sa = G.estIphoneSafari();
      delete global.window;
      return [o, sa];
    });
    dit(dansOrion === false && dansSafari === true, 'A13 Orion sur iPhone (même agent que Safari, `window.KAGI`) ⇒ jamais ; Safari ⇒ oui', `${dansOrion} ${dansSafari}`);
    // L'étape 3 suit la version d'iOS.
    const e = (ua) => G.etapesGuideIphone(ua);
    dit(e(UA.iphoneSafari).length === 3 && e(UA.iphoneSafari).map((x) => x.cle).join(',') === 'partager,accueil,notifications', 'A14 trois étapes : Partager, Sur l’écran d’accueil, les notifications');
    dit(/Partager/.test(e(UA.iphoneSafari)[0].titre) && /Sur l’écran d’accueil/.test(e(UA.iphoneSafari)[1].titre + e(UA.iphoneSafari)[1].texte) && /Ajouter/.test(e(UA.iphoneSafari)[1].texte), 'A15 les mots de l’iPhone : « Partager », « Sur l’écran d’accueil », « Ajouter »');
    dit(/Activer sur cet appareil/.test(e(UA.iphoneSafari)[2].texte) && /Activer sur cet appareil/.test(e(UA.iphoneSafari164)[2].texte), 'A16 iOS 16.4 et plus : l’étape 3 mène au bouton « Activer sur cet appareil »');
    dit(/16\.4/.test(e(UA.iphoneSafari163)[2].texte) && /Mise à jour logicielle/.test(e(UA.iphoneSafari163)[2].texte), 'A17 iOS 16.3 : l’étape 3 dit de mettre l’iPhone à jour (les notifications demandent 16.4)');
    dit(G.versionIos(UA.iphoneSafari163).join('.') === '16.3' && G.iosAvecNotifications('agent illisible') === null, 'A18 version lue dans l’agent ; illisible ⇒ pas su (pas de mise à jour réclamée)');
    dit(/Activer sur cet appareil/.test(G.etapesGuideIphone('agent illisible')[2].texte), 'A19 version pas sue ⇒ l’étape normale');
  });

  console.log('\n── B. le composant rendu (src/GuideIphone.jsx)');
  await essaie('B', async () => {
    const esbuild = require(path.join(R, 'node_modules', 'esbuild'));
    const sortie = path.join(R, 'src', `__audit-guide-${process.pid}.cjs`);   // jamais écrit : compilé en mémoire
    const res = await esbuild.build({ entryPoints: [path.join(R, 'src', 'GuideIphone.jsx')], bundle: true, write: false, platform: 'node', format: 'cjs', outfile: sortie, jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react', 'react-dom'], logLevel: 'silent' });
    const Module = require('module');
    const mod = new Module(sortie, module); mod.filename = sortie; mod.paths = Module._nodeModulePaths(R);
    mod._compile(res.outputFiles[0].text, sortie);
    const React = require(path.join(R, 'node_modules', 'react'));
    const RDS = require(path.join(R, 'node_modules', 'react-dom', 'server'));
    const html = avecNavigateur({ userAgent: UA.iphoneSafari }, () => RDS.renderToStaticMarkup(React.createElement(mod.exports.default, { onFermer: () => {} })));
    const etapes = [...html.matchAll(/data-guide-etape="([a-z]+)"/g)].map((m) => m[1]);
    dit(etapes.join(',') === 'partager,accueil,notifications', 'B1 trois étapes rendues, dans l’ordre', etapes.join(','));
    const lis = html.split('data-guide-etape=').slice(1);
    dit(lis.length === 3 && lis.every((l) => /<svg[^>]*viewBox/.test(l.split('</li>')[0])), 'B2 chaque étape a son dessin SVG');
    dit(!/<img\b/.test(html) && !/\.png|\.jpe?g|\.webp/.test(html), 'B3 aucune image ni capture réelle');
    dit(/<button[^>]*data-guide-iphone-fermer=""[^>]*aria-label="Fermer le guide/.test(html), 'B4 un bouton qui ferme, nommé pour la lecture d’écran');
    dit(/<h3[^>]*>Installer VRM sur l’iPhone<\/h3>/.test(html), 'B5 son titre : « Installer VRM sur l’iPhone »');
    dit(/aria-hidden="true"/.test(html) && (html.match(/<svg[^>]*aria-hidden="true"/g) || []).length >= 4, 'B6 les dessins sont décoratifs pour la lecture d’écran (le texte dit tout)');
  });

  console.log('\n── C. le branchement (src/App.jsx, PushSetting)');
  await essaie('C', async () => {
    const app = require("./_source-app.cjs").sourceAppDe(path.join(R, 'src', 'App.jsx'));
    const debut = app.indexOf('function PushSetting(');
    const corps = debut >= 0 ? app.slice(debut, app.indexOf('\nfunction ', debut + 10)) : '';
    dit(/import GuideIphone, \{ useGuideIphone \} from '\.\/GuideIphone\.jsx'/.test(app), 'C1 l’écran importe le guide et sa décision');
    dit(/const \[guideIphone, fermerGuideIphone\] = useGuideIphone\(\);/.test(corps), 'C2 PushSetting prend la décision de la règle (src/guideIphone.js)');
    dit(/\{guideIphone && <GuideIphone onFermer=\{fermerGuideIphone\}\/>\}/.test(corps), 'C3 le guide n’est rendu que si la règle le dit, et sa croix ferme pour de bon');
    dit(/state==='unsupported' && !guideIphone && ' — Non disponible ici/.test(corps), 'C4 la ligne « Partager → Sur l’écran d’accueil » se tait quand le guide la montre (une phrase, une fois)');
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + ((e && e.stack) || e)); process.exit(1); });
