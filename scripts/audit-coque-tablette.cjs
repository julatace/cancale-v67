#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — la coque : téléphone, tablette ou ordinateur (11 nov., chantier iPad)
//  Récit : docs/passation/2026-11-11-ipad.md · règle : src/coque.js.
//
//  1. La règle, évaluée sur une grille de tailles et de pointeurs :
//     MQ_TELEPHONE est le complément EXACT de MQ_ORDINATEUR (jamais deux coques,
//     jamais aucune) ; un iPad au doigt (744 à 1366 px, portrait comme paysage)
//     prend la coque ordinateur ; un iPhone couché (932 × 430) reste un
//     téléphone ; une souris dès 768 px reste un ordinateur ; « large » /
//     « étroite » suivent la largeur.
//  2. Les CSS (src/**/*.css, index.html) : une requête de coque est UNE des deux
//     recopies, mot pour mot — aucune ancienne copie (« 768 + souris » seule,
//     « ≤ 1023 au doigt ») ne reste en place (elle remettrait la coque téléphone
//     sur un iPad, ou la règle de l'ordinateur sur un téléphone couché).
//  3. App.jsx : la coque se décide sur MQ_ORDINATEUR importée de src/coque.js (pas
//     d'autre copie en ligne), la racine porte `data-tablette`, et
//     styles-tablette.css est importée APRÈS toutes les autres feuilles.
//  4. styles-tablette.css : chaque règle est sous `.vrm-app-shell[data-tablette]`
//     (à la souris et au téléphone, rien ne change).
//  Usage : node scripts/audit-coque-tablette.cjs
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return null; } };
let ok = 0, ko = 0;
const dit = (c, l, d) => { if (c) { ok++; console.log('  ✅ ' + l); } else { ko++; console.log('  ❌ ' + l + (d ? ' — ' + d : '')); } };

// Un évaluateur de requêtes média, limité à ce que la coque emploie : une liste
// « , » de conjonctions « and » de (min|max-width|height: Npx), (hover: …), (pointer: …).
function evalue(q, env) {
  return q.split(',').some((alt) => alt.trim().split(/\s+and\s+/).every((c) => {
    const m = /^\(\s*([a-z-]+)\s*:\s*([a-z0-9.]+)\s*\)$/.exec(c.trim());
    if (!m) throw new Error('condition inconnue : ' + c);
    const [, f, v] = m; const n = parseFloat(v);
    switch (f) {
      case 'min-width': return env.w >= n; case 'max-width': return env.w <= n;
      case 'min-height': return env.h >= n; case 'max-height': return env.h <= n;
      case 'hover': return env.hover === v; case 'pointer': return env.pointer === v;
      default: throw new Error('caractéristique inconnue : ' + f);
    }
  }));
}

(async () => {
  console.log('\n── 1. La règle (src/coque.js)');
  let C = null;
  try { C = await import(path.join(R, 'src', 'coque.js')); } catch (e) { dit(false, 'src/coque.js se charge', e.message.slice(0, 120)); }
  if (C) {
    const { MQ_ORDINATEUR, MQ_TELEPHONE, MQ_TABLETTE_LARGE, MQ_TABLETTE_ETROITE, dispositionTablette } = C;
    // Les pointeurs réels : souris (hover/fine), doigt (none/coarse), stylet seul (none/fine), téléviseur (none/none), Android émulé (hover/coarse).
    const POINTEURS = [['hover', 'fine'], ['none', 'coarse'], ['none', 'fine'], ['none', 'none'], ['hover', 'coarse']];
    let trous = [];
    for (let w = 280; w <= 1700; w += 1) for (const h of [380, 430, 599, 600, 744, 820, 1024, 1366]) for (const [hover, pointer] of POINTEURS) {
      const env = { w, h, hover, pointer }; const o = evalue(MQ_ORDINATEUR, env), t = evalue(MQ_TELEPHONE, env);
      if (o === t) trous.push(`${w}×${h} ${hover}/${pointer} : ${o ? 'deux coques' : 'aucune coque'}`);
    }
    dit(trous.length === 0, 'téléphone = complément EXACT de l\'ordinateur (1 421 largeurs × 8 hauteurs × 5 pointeurs)', trous.slice(0, 4).join(' | '));
    const doigt = { hover: 'none', pointer: 'coarse' }, souris = { hover: 'hover', pointer: 'fine' };
    const mm = (env) => (q) => ({ matches: evalue(q, env) });
    const CAS = [
      ['iPad mini portrait 744×1133', { w: 744, h: 1133, ...doigt }, true, 'etroite'],
      ['iPad 10e gén. portrait 820×1180', { w: 820, h: 1180, ...doigt }, true, 'etroite'],
      ['iPad Air portrait 834×1194', { w: 834, h: 1194, ...doigt }, true, 'etroite'],
      ['iPad Pro portrait 1024×1366', { w: 1024, h: 1366, ...doigt }, true, 'large'],
      ['iPad mini paysage 1133×744', { w: 1133, h: 744, ...doigt }, true, 'large'],
      ['iPad 10e gén. paysage 1180×820', { w: 1180, h: 820, ...doigt }, true, 'large'],
      ['iPad Pro paysage 1366×1024', { w: 1366, h: 1024, ...doigt }, true, 'large'],
      ['iPhone 390×844', { w: 390, h: 844, ...doigt }, false, ''],
      ['iPhone couché 932×430', { w: 932, h: 430, ...doigt }, false, ''],
      ['iPhone SE couché 667×375', { w: 667, h: 375, ...doigt }, false, ''],
      ['souris 1512×945', { w: 1512, h: 945, ...souris }, true, ''],
      ['souris en demi-écran 900×760', { w: 900, h: 760, ...souris }, true, ''],
      ['souris étroite 760×1000', { w: 760, h: 1000, ...souris }, false, ''],
    ];
    for (const [nom, env, ordi, tab] of CAS) {
      const o = evalue(MQ_ORDINATEUR, env), t = dispositionTablette(mm(env));
      dit(o === ordi && t === tab, `${nom} : coque ${ordi ? 'ordinateur' : 'téléphone'}${tab ? ', tablette « ' + tab + ' »' : ''}`, `ordinateur ${o} · tablette « ${t} »`);
    }
    // Les deux tablettes ne se recouvrent pas, et une tablette est toujours dans la coque ordinateur.
    let faux = [];
    for (let w = 280; w <= 1700; w += 7) for (const h of [430, 600, 820, 1180]) for (const [hover, pointer] of POINTEURS) {
      const env = { w, h, hover, pointer }; const L = evalue(MQ_TABLETTE_LARGE, env), E = evalue(MQ_TABLETTE_ETROITE, env);
      if (L && E) faux.push(`${w}×${h} ${hover}/${pointer} : large ET étroite`);
      if ((L || E) && !evalue(MQ_ORDINATEUR, env)) faux.push(`${w}×${h} ${hover}/${pointer} : tablette hors coque ordinateur`);
      if ((L || E) && hover === 'hover' && pointer === 'fine') faux.push(`${w}×${h} : tablette à la souris`);
    }
    dit(faux.length === 0, 'large / étroite disjointes, toujours dans la coque ordinateur, jamais à la souris', faux.slice(0, 4).join(' | '));

    console.log('\n── 2. Les CSS recopient la règle mot pour mot');
    const fichiers = [];
    const parcourir = (d) => { for (const e of fs.readdirSync(path.join(R, d), { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) parcourir(p); else if (/\.css$/.test(e.name)) fichiers.push(p); } };
    parcourir('src'); fichiers.push('index.html');
    const norm = (s) => s.replace(/\s+/g, ' ').replace(/\s*:\s*/g, ': ').replace(/\s*,\s*/g, ', ').trim();
    const ATTENDUES = new Set([norm(MQ_ORDINATEUR), norm(MQ_TELEPHONE)]);
    let copies = 0; const perimees = [];
    for (const f of fichiers) {
      const src = lire(f) || '';
      for (const m of src.matchAll(/@media\s*([^{]+)\{/g)) {
        const q = norm(m[1]); const ligne = src.slice(0, m.index).split('\n').length;
        // Une requête « de coque » : « ≥ 1024, ou ≥ 768 à la souris », ou le doigt sous 1024
        // (une requête « souris seule » pour un survol n'en est pas une).
        const deCoque = /\(min-width: 1024px\), \(min-width: 768px\) and \(hover: hover\) and \(pointer: fine\)/.test(q) || /^\(max-width: 767px\), \(max-width: 1023px\)/.test(q) || /\(max-width: 1023px\) and \((hover: none|pointer: coarse|pointer: none)\)/.test(q) || /\(min-width: 744px\)/.test(q);
        if (!deCoque) continue;
        if (ATTENDUES.has(q)) { copies++; continue; }
        perimees.push(`${f}:${ligne} « ${q.slice(0, 90)}… »`);
      }
    }
    dit(perimees.length === 0, 'aucune ancienne copie de la règle de coque dans les CSS', perimees.slice(0, 5).join(' | '));
    dit(copies >= 20, `les CSS de la coque portent la règle (${copies} recopies)`);
  }

  console.log('\n── 3. App.jsx');
  const app = lire('src/App.jsx') || '';
  dit(/import \{[^}]*\bMQ_ORDINATEUR\b[^}]*\} from "\.\/coque\.js"/.test(app), 'MQ_ORDINATEUR vient de src/coque.js');
  dit(!/const MQ_ORDINATEUR\s*=/.test(app), 'aucune autre définition de MQ_ORDINATEUR dans App.jsx');
  const enLigne = [...app.matchAll(/matchMedia\('([^']*(?:pointer: fine|1023px)[^']*)'\)/g)].map((m) => m[1]).filter((q) => /min-width: ?768px\) and \(hover: hover\)/.test(q));
  dit(enLigne.length === 0, 'aucune copie en ligne de la règle de coque (matchMedia)', enLigne.join(' | '));
  dit(/className="vrm-app-shell" data-tablette=\{\(ordi && tablette\) \|\| undefined\}/.test(app), 'la racine porte `data-tablette` (seulement dans la coque ordinateur)');
  const imports = [...app.matchAll(/^import ["']\.\/([^"']+\.css)["'];/gm)].map((m) => m[1]);
  dit(imports.length > 10 && imports[imports.length - 1] === 'styles-tablette.css', 'styles-tablette.css est importée après toutes les autres feuilles', `dernière : ${imports[imports.length - 1]}`);
  const po = lire('src/passageOnglet.js') || '';
  dit(/import \{ MQ_ORDINATEUR \} from '\.\/coque\.js'/.test(po) && /matchMedia\(MQ_ORDINATEUR\)/.test(po), 'passageOnglet.js lit la même règle');

  console.log('\n── 4. styles-tablette.css ne touche que la tablette');
  const tab = lire('src/styles-tablette.css');
  dit(tab != null, 'src/styles-tablette.css existe');
  if (tab != null) {
    const sansCom = tab.replace(/\/\*[\s\S]*?\*\//g, '');
    const selecteurs = [];
    for (const m of sansCom.matchAll(/([^{};]+)\{/g)) { const s = m[1].trim(); if (!s || s.startsWith('@')) continue; selecteurs.push(...s.split(/,(?![^(]*\))/).map((x) => x.trim())); }
    const hors = selecteurs.filter((s) => !/^\.vrm-app-shell\[data-tablette\]/.test(s));
    dit(selecteurs.length > 0 && hors.length === 0, `chaque règle est sous .vrm-app-shell[data-tablette] (${selecteurs.length} sélecteurs)`, hors.slice(0, 4).join(' | '));
    dit(/@layer vrm-premium\s*\{/.test(sansCom), 'dans la couche de la colonne (@layer vrm-premium)');
    dit(/min-height: 44px !important/.test(sansCom), 'le rail garde 44 px au doigt');
  }
  console.log(`\n${ok} conformes · ${ko} non conformes`);
  process.exit(ko ? 1 : 0);
})();
