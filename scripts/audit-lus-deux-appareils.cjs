#!/usr/bin/env node
// Audit du 5 nov. — deux appareils marquent des notifications lues au même
// moment : aucune ne doit redevenir non lue. EXÉCUTE les vraies fonctions de
// src/App.jsx (`lireLigneNotifs`, `ecrireLuNotifs`, extraites par
// @babel/parser) et de src/journalNotifs.js, contre une fausse base qui sert la
// vraie forme (`select=data`, POST `merge-duplicates` ou simple, PATCH filtré
// `data->>rev=eq.`/`is.null` qui rend les lignes touchées) et qui ENTRELACE
// les deux appareils (lecture A, lecture B, écriture A, écriture B).
// Mutation : `--muter` (écrire `next` tel quel, sans fusion) doit finir en rouge.
'use strict';
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), parser = require('@babel/parser');
const R = path.join(__dirname, '..');
let src = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
if (process.argv.includes('--muter')) src = src.replace('const data = { ...fusionnerLus(cur || {}, next), rev: (rev || 0) + 1 };', 'const data = { ...next, rev: (rev || 0) + 1 };');
const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
const fonction = (nom) => {
  for (const n of ast.program.body) if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.name === nom) return src.slice(n.start, n.end);
  throw new Error('fonction introuvable : ' + nom);
};
const jn = fs.readFileSync(path.join(R, 'src/journalNotifs.js'), 'utf8').replace(/export (const|function) /g, '$1 ');
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); } };

// La fausse base : une ligne `push_journal_lu`, et une barrière qui fait lire
// les deux appareils AVANT que l'un d'eux écrive (le cas qui perd une lecture).
const monde = () => {
  const etat = { ligne: null };
  let attente = [];
  const barriere = { active: false, n: 0 };
  const lire = async () => {
    const copie = etat.ligne ? JSON.parse(JSON.stringify(etat.ligne)) : null;
    if (barriere.active && barriere.n < 2) {
      barriere.n++;
      await new Promise((r) => { attente.push(r); if (attente.length === 2) { attente.forEach((f) => f()); attente = []; } });
    }
    return copie;
  };
  const rep = (corps, status = 200) => ({ ok: status < 300, status, json: async () => corps });
  const fetch = async (url, o = {}) => {
    const u = decodeURIComponent(String(url)), m = (o.method || 'GET').toUpperCase();
    if (!/\/rest\/v1\/app_data/.test(u) || !/push_journal_lu|app_data(\?on_conflict|$)/.test(u)) return rep([], 404);
    if (m === 'GET') { const l = await lire(); return rep(l ? [{ data: l }] : []); }
    if (m === 'POST') {
      const b = JSON.parse(o.body)[0];
      const fusion = /merge-duplicates/.test(String((o.headers || {}).Prefer || ''));
      if (etat.ligne && !fusion) return rep({ code: '23505' }, 409);
      etat.ligne = b.data; return rep(null, 201);
    }
    if (m === 'PATCH') {
      const g = (/data->>rev=([^&]+)/.exec(u) || [])[1];
      if (!etat.ligne) return rep([]);
      if (g) {
        const attendu = g === 'is.null' ? null : g.replace(/^eq\./, '');
        const actuel = etat.ligne.rev == null ? null : String(etat.ligne.rev);
        if (actuel !== attendu) return rep([]);
      }
      etat.ligne = JSON.parse(o.body).data; return rep([{ id: 'push_journal_lu' }]);
    }
    return rep([], 405);
  };
  const ctx = {
    console, JSON, Array, Number, Object, Math, String, Set, Promise, Date, encodeURIComponent,
    fetch, SUPABASE_URL: 'https://banc.exemple.test', AUTH: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }, CLOISONNE: true, SB_CONFLICT: 'owner,id',
    sbAuth: () => ({ apikey: 'x', Authorization: 'Bearer x' }),
    withOwner: (r) => Object.assign({ owner: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, r),
    window: { dispatchEvent() {} }, Event: function Event() {},
  };
  vm.createContext(ctx);
  vm.runInContext(jn + '\n' + [fonction('lireLigneNotifs'), fonction('ecrireLuNotifs')].join('\n')
    + '\nthis.ecrireLuNotifs = ecrireLuNotifs; this.marquerLues = marquerLues; this.toutLu = toutLu; this.estLue = estLue;', ctx);
  return { ctx, etat, barriere };
};

(async () => {
  console.log('1. Le téléphone marque la n°5, l\'ordinateur la n°7, au même moment');
  {
    const { ctx, etat, barriere } = monde();
    etat.ligne = { luJusqua: 2, lus: [] };
    barriere.active = true;
    const depart = { luJusqua: 2, lus: [] };
    const r = await Promise.all([ctx.ecrireLuNotifs(ctx.marquerLues(depart, [5])), ctx.ecrireLuNotifs(ctx.marquerLues(depart, [7]))]);
    const fin = etat.ligne;
    dit(r.every(Boolean), 'les deux écritures sont prises', JSON.stringify(r));
    dit(ctx.estLue({ seq: 5 }, fin) && ctx.estLue({ seq: 7 }, fin), 'la n°5 ET la n°7 restent lues', JSON.stringify(fin));
  }
  console.log('2. « Tout marquer lu » sur l\'un, une notification touchée sur l\'autre');
  {
    const { ctx, etat, barriere } = monde();
    etat.ligne = { luJusqua: 0, lus: [], rev: 4 };
    barriere.active = true;
    const depart = { luJusqua: 0, lus: [] };
    await Promise.all([ctx.ecrireLuNotifs(ctx.toutLu(9, depart)), ctx.ecrireLuNotifs(ctx.marquerLues(depart, [12]))]);
    const fin = etat.ligne;
    dit([1, 5, 9, 12].every((s) => ctx.estLue({ seq: s }, fin)), 'les 9 premières ET la n°12 restent lues', JSON.stringify(fin));
  }
  console.log('3. Première écriture (aucune ligne) sur deux appareils');
  {
    const { ctx, etat, barriere } = monde();
    barriere.active = true;
    await Promise.all([ctx.ecrireLuNotifs(ctx.marquerLues({}, [1])), ctx.ecrireLuNotifs(ctx.marquerLues({}, [3]))]);
    dit(etat.ligne && ctx.estLue({ seq: 1 }, etat.ligne) && ctx.estLue({ seq: 3 }, etat.ligne), 'la n°1 ET la n°3 restent lues', JSON.stringify(etat.ligne));
  }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
