// « VRM t'aide-t-il ? » (9 nov.) : la règle de la note, jugée avec une horloge simulée.
// Lancer : node --test scripts/tests/satisfaction.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { questionDue, etatApres, doitNoterPaye, agregerNotes, motSansIdentite, JOURS_USAGE, JOURS_PLUS_TARD, JOURS_APRES_PAIEMENT } from '../../src/satisfaction.js';

const J = 864e5;
const T0 = Date.parse('2026-10-01T08:00:00Z');   // création du compte
const base = { compteCreeLe: new Date(T0).toISOString(), proprietaire: false, statut: null, etat: null };
const due = (x) => questionDue({ ...base, ...x });

test('les constantes de la décision', () => {
  assert.equal(JOURS_USAGE, 14); assert.equal(JOURS_PLUS_TARD, 7); assert.equal(JOURS_APRES_PAIEMENT, 3);
});

test('pas avant 14 jours d’usage, puis oui', () => {
  assert.equal(due({ maintenant: T0 + 13.9 * J }).raison, 'trop-tot');
  assert.equal(due({ maintenant: T0 + 14 * J }).montrer, true);
});

test('jamais au propriétaire, et « pas su » ne montre rien', () => {
  assert.equal(due({ maintenant: T0 + 60 * J, proprietaire: true }).raison, 'proprietaire');
  assert.equal(due({ maintenant: T0 + 60 * J, proprietaire: undefined }).montrer, false);
  assert.equal(due({ maintenant: T0 + 60 * J, etat: undefined }).raison, 'pas-su');
  assert.equal(due({ maintenant: T0 + 60 * J, statut: undefined }).raison, 'pas-su');
  assert.equal(due({ maintenant: T0 + 60 * J, compteCreeLe: '' }).raison, 'pas-su');
});

test('pas pendant les 3 premiers jours d’un abonnement payé', () => {
  const t = T0 + 30 * J;
  assert.equal(due({ maintenant: t, statut: 'active', etat: {} }).raison, 'paiement-recent', 'payé jamais vu ⇒ on attend');
  assert.equal(doitNoterPaye('active', {}), true);
  assert.equal(doitNoterPaye('trialing', {}), false);
  assert.equal(doitNoterPaye('active', undefined), false, 'pas su ⇒ rien écrit');
  const vu = etatApres({}, 'paye-vu', { maintenant: t });
  assert.equal(due({ maintenant: t + 2.9 * J, statut: 'active', etat: vu }).raison, 'paiement-recent');
  assert.equal(due({ maintenant: t + 3 * J, statut: 'active', etat: vu }).montrer, true);
  assert.equal(etatApres(vu, 'paye-vu', { maintenant: t + 5 * J }), null, 'noté une seule fois');
  assert.equal(due({ maintenant: t, statut: 'trialing', etat: {} }).montrer, true, 'un essai n’est pas un abonnement payé');
});

test('« Plus tard » : 7 jours de silence, puis la question revient', () => {
  const t = T0 + 20 * J;
  const e = etatApres(null, 'plus-tard', { maintenant: t });
  assert.equal(due({ maintenant: t + 6.9 * J, etat: e }).raison, 'plus-tard');
  assert.equal(due({ maintenant: t + 7 * J, etat: e }).montrer, true);
});

test('« Ne plus demander » et une réponse : plus jamais', () => {
  const t = T0 + 20 * J;
  assert.equal(due({ maintenant: t + 400 * J, etat: etatApres(null, 'jamais', { maintenant: t }) }).raison, 'jamais');
  const r = etatApres(null, 'repondre', { maintenant: t, note: 4, mot: '  Top\u0007  outil ' });
  assert.deepEqual(r.reponse, { note: 4, mot: 'Top outil', at: new Date(t).toISOString() });
  assert.equal(due({ maintenant: t + 400 * J, etat: r }).raison, 'repondu');
  assert.equal(etatApres(null, 'repondre', { note: 6 }), null);
  assert.equal(etatApres(null, 'repondre', { note: 0 }), null);
  assert.equal(etatApres(null, 'repondre', { note: 3, mot: 'x'.repeat(900) }).reponse.mot.length, 280);
});

test('l’agrégat : moyenne, répartition, mots sans identité, sans heure', () => {
  const a = agregerNotes([
    { note: '5', mot: 'parfait, julien@vrm.center', at: '2026-11-08T21:00:00Z' },
    { note: '3', mot: '', at: '2026-11-07T10:00:00Z' },
    { note: 'x', mot: 'ignoré' },
    { note: '1', mot: 'appelle le +33 6 12 34 56 78', at: '2026-11-01T10:00:00Z' },
  ]);
  assert.equal(a.n, 3);
  assert.equal(a.moyenne, 3);
  assert.deepEqual(a.repartition, [1, 0, 1, 0, 1]);
  assert.deepEqual(a.commentaires.map((c) => c.jour), ['2026-11-08', '2026-11-01']);
  assert.ok(!JSON.stringify(a).includes('@') && !JSON.stringify(a).includes('34 56'));
  assert.equal(agregerNotes([]).moyenne, null, 'aucune note ⇒ pas de moyenne (jamais 0)');
  assert.equal(motSansIdentite('voir https://vinted.fr/member/123'), 'voir …');
});
