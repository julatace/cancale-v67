#!/usr/bin/env node
// AUDIT — LA BARRE DU BAS : ACHATS DEDANS, AUCUN GLISSER ENTRE ONGLETS (16 nov., lot barre-achats)
// Julien (capture iPhone, en glissant du doigt l'écran passait d'Argent à Ma journée à moitié) :
// « Je ne veux pas qu'on puisse glisser entre les onglets » ; « si on peut, ajoute les Achats dans la barre ».
// Il EXÉCUTE les règles pures (src/navHistorique.js, src/navPaires.js, src/design/espace.js) et lit la
// barre dans la source (App.jsx, commentaires retirés) :
//   H1 d'un onglet de la barre à un autre : l'entrée d'historique est REMPLACÉE (le retour du système
//      n'a plus d'onglet voisin à montrer) ; Annonces ↔ Stock aussi ; un écran du menu EMPILE (le retour
//      y revient) ; une feuille ouverte n'est jamais écrasée ; rien de changé ⇒ rien ;
//   H2 la coque passe par cette règle (replaceState ET pushState, plus de pushState nu) ;
//   B1 la barre = journee · paires · achats · ventes · compta (Argent en dernier), le disque après 3 ;
//   B2 Achats n'est plus un écran de « Paires » : son onglet s'allume sur Achats (et seulement là) ;
//   B3 aucun balayage entre onglets dans la coque (aucun touchstart/touchmove qui appelle setTab) ;
//   B4 <main> : overscroll-behavior-x none.
// `--dossier <arbre>` : juger un autre arbre (le code d'avant).
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const i = process.argv.indexOf('--dossier');
const R = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 300) : '')); };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  const app = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8'));
  let H = null, P = null, E = null;
  try { H = await import(pathToFileURL(path.join(R, 'src', 'navHistorique.js')).href); } catch (_) {}
  try { P = await import(pathToFileURL(path.join(R, 'src', 'navPaires.js')).href); } catch (_) {}
  try { E = await import(pathToFileURL(path.join(R, 'src', 'design', 'espace.js')).href); } catch (_) {}
  const BAR_GROUPE = { cat_expedition: 'ventes', organisation: 'settings', dashboard: 'compta', semaine: 'journee', litiges: 'ventes' };
  // (21 nov., onglets-menu — « garde les onglets ») La barre du bas : Aujourd'hui · Annonces · Ventes · Achats · Argent ;
  // Stock, Messages, E-mails, Paramètres… s'ouvrent depuis le Menu ou l'en-tête (ils EMPILENT). `BARRE_DU_BAS` dans src/App.jsx.
  const barre = ['journee', 'paires', 'ventes', 'achats', 'compta'];
  const groupe = (t) => (P ? P.groupeBarre(t, BAR_GROUPE) : t);

  // H1
  const f = H && H.entreeHistorique;
  const cas = f ? [
    ['journee', 'annonces', 'remplacer'], ['annonces', 'ventes', 'remplacer'], ['ventes', 'achats', 'remplacer'], ['achats', 'compta', 'remplacer'], ['compta', 'journee', 'remplacer'],
    ['menu', 'garage', 'empiler'], ['journee', 'menu', 'empiler'], ['compta', 'messages', 'empiler'], ['messages', 'ventes', 'empiler'],
    ['compta', 'dashboard', 'remplacer'], ['journee', 'semaine', 'remplacer'], ['ventes', 'litiges', 'remplacer'],
    ['journee', 'settings', 'empiler'], ['settings', 'organisation', 'empiler'],
  ].map(([a, b, att]) => [a, b, att, f({ vrmTab: a, vrmSub: 'ventes' }, { tab: b, sub: 'ventes' }, groupe, barre)]) : [];
  dit(!!f && cas.every((c) => c[2] === c[3]), `H1 d'un onglet de la barre à un autre (et dans un même groupe : Argent ↔ Statistiques) : REMPLACER ; un écran du Menu : EMPILER (${cas.length} cas)`, JSON.stringify(cas.filter((c) => c[2] !== c[3])));
  dit(!!f && f({ vrmTab: 'ventes', vrmSub: 'ventes', vrmFeuille: 'x' }, { tab: 'compta', sub: 'ventes' }, groupe, barre) === 'empiler', 'H1 une feuille ouverte n\'est jamais écrasée (elle se ferme par le retour)');
  dit(!!f && f({ vrmTab: 'ventes', vrmSub: 'ventes' }, { tab: 'ventes', sub: 'ventes' }, groupe, barre) === 'rien' && f({}, { tab: 'annonces', sub: 'ventes' }, groupe, barre) === 'remplacer', 'H1 rien de changé ⇒ rien ; la première entrée (sans écran = Ma journée) ⇒ remplacée');
  // H2
  const bloc = (() => { const k = app.indexOf('const pousser=()=>{'); return k < 0 ? '' : app.slice(k, k + 1400); })();
  dit(/entreeHistorique\(/.test(bloc) && /replaceState\(/.test(bloc) && /pushState\(/.test(bloc) && !/if\(st\.vrmTab===h\.tab && st\.vrmSub===h\.sub\) return;\s*window\.history\.pushState/.test(bloc), 'H2 la coque passe chaque changement d\'écran par `entreeHistorique` (remplacer ou empiler)', bloc.slice(0, 200));
  // B1
  const mB = /const BARRE_DU_BAS=\[([^\]]*)\]/.exec(app);
  const ids = mB ? mB[1].split(',').map((x) => x.trim().replace(/'/g, '')).map((x) => (x === 'ID_PAIRES' ? 'paires' : x)) : [];
  const mO = /const ORDRE_NATIF=\[([^\]]*)\]/.exec(app);
  const ordre = mO ? mO[1].split(',').map((x) => x.trim().replace(/'/g, '')).map((x) => (x === 'ID_PAIRES' ? 'paires' : x)) : [];
  dit(JSON.stringify(ids) === JSON.stringify(barre) && JSON.stringify(ordre) === JSON.stringify(barre), 'B1 la barre = Aujourd\'hui · Annonces · Ventes · Achats · Argent', JSON.stringify({ ids, ordre }));
  // (17 nov., Julien, trois fois : « Le + dégueulasse ») PLUS DE DISQUE dans la barre, réglage allumé ou éteint : cinq onglets.
  dit(!/<DisqueEventail\b/.test(app), 'B1 aucun disque « + » dans la barre (cinq onglets, rien entre eux)');
  // B2
  const tous = ['journee', 'annonces', 'garage', 'achats', 'ventes', 'compta', 'dashboard', 'semaine', 'litiges', 'messages'];
  const allume = tous.map((t) => [t, groupe(t)]);
  const attendu = { journee: 'journee', annonces: 'paires', garage: 'garage', achats: 'achats', ventes: 'ventes', compta: 'compta', dashboard: 'compta', semaine: 'journee', litiges: 'ventes', messages: 'messages' };
  dit(!!P && allume.every(([t, g]) => g === attendu[t]) && !P.estPaires('achats'), 'B2 le groupe de chaque écran (Stock et Achats ont le leur ; la barre allume Menu pour eux)', JSON.stringify(allume.filter(([t, g]) => g !== attendu[t])));
  dit(!!E && E.espaceDe('achats', BAR_GROUPE) === 'paires' && E.espaceDe('annonces', BAR_GROUPE) === 'paires', 'B2 l\'aplat d\'Achats reste celui des paires (aucune teinte de plus)', E && E.espaceDe('achats', BAR_GROUPE));
  // B3
  const coque = (() => { const k = app.indexOf('function AppCoeur'); return k < 0 ? app : app.slice(k); })();
  const balayage = [...coque.matchAll(/(?:onTouchStart|onTouchMove|onTouchEnd|addEventListener\('touch(?:start|move|end)')[\s\S]{0,400}/g)].filter((m) => /\bslideTab\(|setTab\(/.test(m[0]));
  dit(!balayage.length, 'B3 aucun balayage au doigt qui change d\'onglet dans la coque', balayage.map((m) => m[0].slice(0, 80)).join(' | '));
  // B4
  dit(/overscrollBehaviorX:'none'/.test(app), 'B4 <main> : overscroll-behavior-x none (l\'écran ne bouge jamais de côté)');
  dit(/(<main|<Natif\.CoqueEcran) className="vrm-main"[\s\S]{0,4000}?touchAction:'pan-y pinch-zoom'/.test(app), 'B4 <main> : touch-action pan-y pinch-zoom (un glisser de côté n\'est jamais une « page précédente » du navigateur)');

  console.log(`\n${ok} ✅  ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
