// (24 nov., vitesse) src/indexSuivis.js — l'index n° de suivi → ligne qui remplace la relecture de toute la liste à chaque appel
// de `emailDuSuivi` (src/ecrans/Comptabilite.jsx). node --test scripts/tests/index-suivis.test.mjs
//   1. MÊME RÉPONSE que la règle d'avant (la PREMIÈRE ligne dont `suiviDeLigne` vaut le n°) sur des lignes de toutes formes
//      (suivi, su, sujet seul, doublons, vides, null) ;
//   2. le coût ne grandit plus comme lignes × appels : 6 000 lignes × 6 000 appels en moins de 1 s (la règle d'avant : ~36 M
//      normalisations) — `AVANT=1` mesure l'ancienne boucle pour la preuve (rouge).
import test from 'node:test';
import assert from 'node:assert/strict';
import { indexSuivis } from '../../src/indexSuivis.js';
import { suiviDeLigne } from '../../api/_lib/suivi-colis.js';

const avant = (tracking, k) => { if (!k || !Array.isArray(tracking)) return null; for (const t of tracking) if (t && suiviDeLigne(t) === k) return t; return null; };
const nouveau = (tracking, k) => { if (!k || !Array.isArray(tracking)) return null; return indexSuivis(tracking).get(k) || null; };
const lookup = process.env.AVANT ? avant : nouveau;

function lignes(n) {
  const L = [];
  for (let i = 0; i < n; i++) {
    const num = 'XW' + String(100000000 + (i % Math.ceil(n * 0.8))) + 'FR';   // 20 % de doublons
    const f = i % 5;
    L.push(f === 0 ? { suivi: num, status: 'livre', i } : f === 1 ? { su: num.toLowerCase(), i } : f === 2 ? { subject: 'Votre colis ' + num + ' est en route', i } : f === 3 ? null : { suivi: '', subject: '', i });
  }
  return L;
}

test('même réponse que la règle d\'avant', () => {
  const T = lignes(600);
  const cles = new Set(T.filter(Boolean).map((t) => suiviDeLigne(t)).filter(Boolean));
  cles.add('INCONNU'); cles.add('');
  let n = 0;
  for (const k of cles) { assert.equal(nouveau(T, k), avant(T, k), 'n° ' + k); n++; }
  assert.ok(n > 100, String(n));
  assert.equal(nouveau(null, 'X'), null); assert.equal(nouveau(T, null), null);
});

test('une liste neuve a un index neuf', () => {
  const T1 = [{ suivi: 'AB1' }]; const T2 = [{ suivi: 'AB1', neuf: true }];
  assert.equal(nouveau(T1, 'AB1'), T1[0]); assert.equal(nouveau(T2, 'AB1'), T2[0]);
});

test('le coût ne grandit plus comme lignes × appels', () => {
  const T = lignes(6000); const cles = T.filter(Boolean).map((t) => suiviDeLigne(t) || 'ZZ');
  const t0 = performance.now(); let trouves = 0;
  for (const k of cles) if (lookup(T, k)) trouves++;
  const ms = performance.now() - t0;
  assert.ok(trouves > 1000);
  assert.ok(ms < 1000, `6 000 × ${cles.length} appels en ${Math.round(ms)} ms (≥ 1 s : la liste est relue à chaque appel)`);
});

// (24 nov.) `achatRelie` : l'achat relié par son n° de transaction — même réponse que `find` (le PREMIER achat qui le porte).
import { premierParCle } from '../../src/indexSuivis.js';
test('achats : même réponse que find, coût linéaire', () => {
  const buys = []; for (let i = 0; i < 6000; i++) buys.push({ transaction_id: i % 4 === 0 ? String(20000 + (i % 3000)) : 20000 + (i % 3000), i });
  const cle = (b) => String(b.transaction_id);
  const avantA = (id) => buys.find((b) => String(b.transaction_id) === String(id));
  const nouveauA = (id) => premierParCle(buys, cle).get(String(id));
  for (const id of [20000, '20001', 22999, 99, 'x']) assert.equal(nouveauA(id), avantA(id), 'n° ' + id);
  const f = process.env.AVANT ? avantA : nouveauA;
  const t0 = performance.now(); for (let i = 0; i < 6000; i++) f(i % 2 ? 'absent' + i : 20000 + ((i * 7) % 3500));   // la moitié introuvables : la liste entière relue
  const ms = performance.now() - t0;
  assert.ok(ms < 150, `6 000 achats × 6 000 appels en ${Math.round(ms)} ms (la liste relue à chaque appel : ~400 ms et plus)`);
});
