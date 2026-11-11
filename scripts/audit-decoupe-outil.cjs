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
doitRefuser('lit this', `const [tab] = useState('t');
  return (<div>{tab==='t' && (<b>{this}</b>)}</div>);`, /this/);
if (ko) { console.log(`\n❌ ${ko} garde-fou(x) de l'outil de découpe en défaut`); process.exit(1); }
console.log('\n✅ chaque garde-fou de l’outil de découpe refuse son cas, le cas sûr part');
