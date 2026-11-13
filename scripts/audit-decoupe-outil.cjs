#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE L'OUTIL DE DÉCOUPE (scripts/decouper-app-2.cjs) — 11 nov., reprise
//  Sur des App.jsx de SYNTHÈSE (rien de l'app réelle), chaque garde-fou d'une « vue »
//  doit REFUSER le cas qu'il garde, et le cas sûr doit passer. Un garde-fou qu'on
//  affaiblit dans l'outil rougit ici (preuve par mutation : docs/passation/2026-11-11-decoupe-app.md).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const T = require('./decouper-app-2.cjs');
const ANCRE = "function aLaDemande(c){return c;}\n// ⟦démarrage léger⟧ racines paresseuses\n";
const app = (corps) => `import React, { useState, useRef } from 'react';\n${ANCRE}function Compta({ x }) {\n${corps}\n}\nexport default Compta;\n`;
const vue = { fichier: 'coeur/VueT.jsx', sorte: 'ecran', vues: [{ composant: 'Compta', condition: "tab==='t'", nom: 'VueT' }] };
const essai = (corps) => { const { R } = T.decouper(app(corps), vue, path.join(__dirname, '..', 'src', 'App.jsx')); return R; };
let ko = 0;
const doitPasser = (nom, corps) => { const R = essai(corps); if (R.refus.length || !R.vues.length) { ko++; console.log(`❌ ${nom} : devait partir — ${R.refus.join(' ; ') || R.absents.join(' ; ')}`); } else console.log(`✅ ${nom} : part (${R.vues[0].valeursPassees} valeurs passées)`); };
const doitRefuser = (nom, corps, motif) => { const R = essai(corps); const t = R.refus.join(' ; '); if (!R.refus.length || !motif.test(t)) { ko++; console.log(`❌ ${nom} : devait être REFUSÉE (${motif}) — ${t || 'partie'}`); } else console.log(`✅ ${nom} : refusée (${t.slice(0, 110)})`); };

doitPasser('cas sûr (lit, geste, map)', `const [tab, setTab] = useState('t'); const liste = [1, 2]; const f = (n) => n + 1;
  return (<div>{tab==='t' && (<ul>{liste.map((n) => <li key={n} onClick={() => setTab('u')}>{f(n)}</li>)}</ul>)}</div>);`);
doitPasser('mémo privé (let _memo vidé à la microtâche)', `const [tab] = useState('t'); let _m = null; const calc = () => { if (_m) return _m; const r = [x]; _m = r; queueMicrotask(() => { _m = null; }); return r; };
  return (<div>{tab==='t' && (<b>{calc().length}</b>)}</div>);`);
doitPasser('réaffectée AVANT, dans une IIFE du rendu', `const [tab] = useState('t'); let n = 0; (() => { n = 2; })();
  return (<div>{tab==='t' && (<b>{n}</b>)}</div>);`);
doitRefuser('écrit une variable du composant', `const [tab] = useState('t'); let n = 0;
  return (<div>{tab==='t' && (<b onClick={() => { n = 1; }}>{n}</b>)}</div>);`, /écrit la variable n/);
doitRefuser('variable réaffectée APRÈS la branche', `const [tab] = useState('t'); let n = 0; const el = (<div>{tab==='t' && (<b>{n}</b>)}</div>); n = 3;
  return el;`, /réaffectée ailleurs/);
doitRefuser('appelle un hook', `const [tab] = useState('t');
  return (<div>{tab==='t' && (<b>{useRef(0).current}</b>)}</div>);`, /hook useRef/);
doitRefuser('valeur DÉCLARÉE après la branche (zone morte)', `const [tab] = useState('t'); const el = (<div>{tab==='t' && (<b onClick={() => go()}>a</b>)}</div>); const go = () => 1;
  return el;`, /déclarée ligne/);
doitRefuser('objet modifié par le rendu APRÈS la branche', `const [tab] = useState('t'); const l = []; const el = (<div>{tab==='t' && (<b>{l.length}</b>)}</div>); l.push(1);
  return el;`, /modifié par le rendu APRÈS/);
doitRefuser('ref posée par le rendu APRÈS la branche', `const [tab] = useState('t'); const r = useRef(0); const el = (<div>{tab==='t' && (<b>{r.current}</b>)}</div>); r.current = 5;
  return el;`, /modifié par le rendu APRÈS/);
doitRefuser('la branche modifie un objet au rendu', `const [tab] = useState('t'); const vu = new Set();
  return (<div>{tab==='t' && (<b>{[1].map((n) => { vu.add(n); return n; })}</b>)}</div>);`, /modifie au rendu l'objet vu/);
doitRefuser('la branche appelle un setX au rendu', `const [tab, setTab] = useState('t');
  return (<div>{tab==='t' && (<b>{setTab('u')}</b>)}</div>);`, /appelle setTab au rendu/);
doitRefuser('la branche appelle une fonction qui écrit le composant', `const [tab] = useState('t'); let compte = 0; const noter = () => { compte++; return compte; }; const lire = () => noter();
  return (<div>{tab==='t' && (<b>{lire()}</b>)}{compte}</div>);`, /qui écrit le composant/);
{ // compagnons
  const R1 = essai(`const [tab] = useState('t'); const lib = (n) => 'n' + n + x; function aide(n) { return lib(n); }
  return (<div>{tab==='t' && (<b>{aide(1)}</b>)}</div>);`);
  if (R1.refus.length || !R1.vues.length || R1.vues[0].compagnons !== 2) { ko++; console.log('❌ compagnons : les 2 fonctions que seule la branche utilise devaient partir avec elle — ' + JSON.stringify(R1.vues) + R1.refus.join(';')); } else console.log('✅ compagnons : les 2 fonctions que seule la branche utilise partent avec elle');
  const R2 = essai(`const [tab] = useState('t'); const lib = (n) => 'n' + n;
  return (<div>{lib(0)}{tab==='t' && (<b>{lib(1)}</b>)}</div>);`);
  if (R2.refus.length || !R2.vues.length || R2.vues[0].compagnons) { ko++; console.log('❌ compagnon utilisé AUSSI ailleurs : devait rester'); } else console.log('✅ une fonction utilisée aussi hors de la branche reste dans le composant');
  const R3 = essai(`const [tab] = useState('t'); let n = 0; const compter = () => { n++; return n; };
  return (<div>{tab==='t' && (<b>{compter()}</b>)}{n}</div>);`);
  if (!R3.refus.length && R3.vues.length && R3.vues[0].compagnons) { ko++; console.log('❌ compagnon qui écrit le composant, appelé au rendu : devait être refusé'); } else console.log('✅ un compagnon qui écrit le composant au rendu ne part pas (' + (R3.refus[0] || R3.epingles[0] || '').slice(0, 90) + ')');
}
doitRefuser('la branche réaffecte une variable de tête sans la lire', `const [tab] = useState('t');
  return (<div>{tab==='t' && (<b onClick={() => { aLaDemande = null; }}>a</b>)}</div>);`, /réaffecte aLaDemande/);
{ const R4 = essai(`const [tab] = useState('t'); const vider = () => { aLaDemande = null; };
  return (<div>{tab==='t' && (<b onClick={vider}>a</b>)}</div>);`);
  if (R4.vues.length && R4.vues[0].compagnons) { ko++; console.log('❌ un compagnon qui réaffecte une variable de tête devait rester'); } else console.log('✅ un compagnon qui réaffecte une variable de tête reste dans le composant'); }
doitRefuser('lit this', `const [tab] = useState('t');
  return (<div>{tab==='t' && (<b>{this}</b>)}</div>);`, /this/);
// ── deux modules préchargés : l'aide `prechargerAuRepos` est déclarée AVANT tout appel (zone morte au démarrage, 11 nov.)
{
  let src = `import React, { lazy, Suspense } from 'react';\nfunction aLaDemande(c){return c;}\n// ⟦démarrage léger⟧ racines paresseuses\nconst FavorisVinted = aLaDemande(() => 1);\nfunction Un() { return <i/>; }\nfunction Deux() { return <b/>; }\nexport default function App() { return (<div><Un/><Deux/></div>); }\n`;
  const appF = path.join(__dirname, '..', 'src', 'App.jsx');
  for (const [f, r] of [['coeur/Un.jsx', 'Un'], ['coeur/Deux.jsx', 'Deux']]) { const o = T.decouper(src, { fichier: f, sorte: 'ecran', racines: [r], precharger: true }, appF); src = o.src; }
  const decl = src.indexOf('const prechargerAuRepos = '), appel = src.search(/^prechargerAuRepos\(/m);
  if (decl < 0 || appel < 0 || decl > appel) { ko++; console.log(`❌ deux modules préchargés : prechargerAuRepos appelé (${appel}) avant d'être déclaré (${decl})`); } else console.log('✅ deux modules préchargés : l’aide est déclarée avant le premier appel');
}
// ── imports différés (sur des fichiers de synthèse dans un dossier temporaire)
{
  const fs = require('fs'), os = require('os');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-differe-'));
  const ecr = (f, t) => fs.writeFileSync(path.join(d, f), t);
  ecr('Pur.jsx', "import './pur.css';\nconst NOMS = Object.fromEntries([['a', 1]].map((x) => [x[0], x[1]]));\nexport default function Pur() { return <i>{NOMS.a}</i>; }\n");
  ecr('pur.css', 'i{}');
  ecr('Effet.jsx', "const T = localStorage.getItem('x');\nexport default function Effet() { return <i>{T}</i>; }\n");
  ecr('Paquet.jsx', "import confetti from 'confettis';\nexport default function Paquet() { return <i/>; }\n");
  ecr('Deux.jsx', "export function A() { return <i/>; }\nexport function B() { return <b/>; }\n");
  const appSrc = (lignes, rendu) => `import React, { lazy, Suspense } from 'react';\n${lignes}\nfunction aLaDemande(c){return c;}\n// ⟦démarrage léger⟧ racines paresseuses\nexport default function App() { return (<div>${rendu}</div>); }\n`;
  const app = path.join(d, 'App.jsx');
  const un = (lignes, rendu, liste) => T.differer(appSrc(lignes, rendu), liste, app);
  const S = require('./_source-app.cjs');
  let r = un("import Pur from './Pur.jsx';   // commentaire", '<Pur/>', [{ nom: 'Pur' }]);
  const recolle = r.src.replace(/^[^\n]*\/\/ ⟦découpe 2⟧[^\n]*\n/gm, '').replace(/^\/\/ ⟦différé⟧ /gm, '').split('\n').filter((l) => !/gardé à sa place/.test(l)).join('\n');
  if (!r.R.differes.length || !/const Pur = aLaDemandeSansAttente\(\(\) => import\('\.\/Pur\.jsx'\)\)/.test(r.src) || !/import '\.\/pur\.css'; \/\/ \(8 nov\.\) style/.test(r.src) || recolle !== appSrc("import Pur from './Pur.jsx';   // commentaire", '<Pur/>')) { ko++; console.log('❌ différé pur : devait partir, style gardé, texte recollé identique — ' + r.R.refus.join(' ; ')); } else console.log('✅ différé pur : part, son style reste importé à sa place, le texte recollé est identique');
  void S;
  r = un("import Effet from './Effet.jsx';", '<Effet/>', [{ nom: 'Effet' }]);
  if (r.R.differes.length || !/autre chose que déclarer/.test(r.R.refus.join(' '))) { ko++; console.log('❌ différé à effet : devait être refusé'); } else console.log('✅ différé dont le module agit au chargement : refusé');
  r = un("import Paquet from './Paquet.jsx';", '<Paquet/>', [{ nom: 'Paquet' }]);
  if (r.R.differes.length || !/paquet confettis/.test(r.R.refus.join(' '))) { ko++; console.log('❌ différé à paquet : devait être refusé'); } else console.log('✅ différé qui amène un paquet inconnu d’App.jsx : refusé');
  r = un("import Pur from './Pur.jsx';", '{String(Pur)}', [{ nom: 'Pur' }]);
  if (r.R.differes.length || !/hors JSX/.test(r.R.refus.join(' '))) { ko++; console.log('❌ différé utilisé hors JSX : devait être refusé'); } else console.log('✅ différé utilisé hors JSX : refusé');
  r = un("import { A, B } from './Deux.jsx';", '<A/><B/>', [{ nom: 'A' }]);
  if (r.R.differes.length || !/reste importé/.test(r.R.refus.join(' '))) { ko++; console.log('❌ différé dont le module reste importé : devait être refusé'); } else console.log('✅ différé dont le module reste importé par ses autres noms : refusé (rien de gagné)');
  fs.rmSync(d, { recursive: true, force: true });
}
if (ko) { console.log(`\n❌ ${ko} garde-fou(x) de l'outil de découpe en défaut`); process.exit(1); }
console.log('\n✅ chaque garde-fou de l’outil de découpe refuse son cas, le cas sûr part');
