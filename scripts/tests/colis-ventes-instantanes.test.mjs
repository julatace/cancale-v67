// (9 nov., soir) Colis et Ventes tout de suite : la règle COMMUNE des instantanés
// (src/instantaneEcran.js) et ce qui se montre un autre jour (src/colisVentesInstantanes.js).
// Les captures (relues dans le DOM rendu) sont jugées par scripts/bancs/colis-ventes-instantanes.cjs.
// node --test scripts/tests/colis-ventes-instantanes.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { lireInstantaneEcran, ecrireInstantaneEcran, effacerInstantanes, cleInstantaneEcran, jourLocalIso, AGE_MAX_INSTANTANE_MS } from '../../src/instantaneEcran.js';
import { colisMontrable, ventesMontrable } from '../../src/colisVentesInstantanes.js';
import { lireInstantane, ecrireInstantane, cleInstantane } from '../../src/journeeInstantanee.js';

const faux = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const T0 = new Date(2026, 10, 9, 15, 0, 0).getTime();
const base = (ecran, uid, t = T0) => ({ v: 1, ecran, uid, t, jour: jourLocalIso(t), mois: jourLocalIso(t).slice(0, 7), largeur: 390 });
const carteJour = { classes: 'vrm-fu-carte', portee: 'jour', surtitre: 'Aujourd’hui', grand: { texte: '3', valeur: '3', vide: false, sous: 'à envoyer' }, cases: [], objectif: null };
const colis = (uid, t) => ({ ...base('colis', uid, t), onglet: 'envoyer', sites: ['toutes', 'vinted'], phrase: 'Imprime…', prochain: { cle: 'imprimer', texte: '2 bordereaux à imprimer — 6 j pour l’envoyer', sous: '' }, carte: carteJour,
  onglets: [{ cle: 'envoyer', l: 'À envoyer', n: 3 }, { cle: 'envoyes', l: 'Envoyés', n: 0 }, { cle: 'retirer', l: 'À retirer', n: 0 }],
  liste: [{ g: 'Mondial Relay', n: '1 colis' }, { num: '117', titre: 'Paire', prix: '80 €', limite: '6 j pour l’envoyer', attente: ' · attend depuis 1 j', transp: 'Mondial Relay', groupe: 'pret' }], ecart: 40 });
const ventes = (uid, t) => ({ ...base('ventes', uid, t), sites: null, phrase: '', carte: { ...carteJour, portee: 'mois' }, aVenir: { titre: 'À venir', lignes: ['Vinted · 3 ventes'], total: '185 €' }, replis: [], lignes: [{ site: 'vinted', siteNom: 'Vinted', num: '', titre: 'Paire', date: 'hier', etat: 'À envoyer', ton: 'action', prix: '80 €' }], n: 1 });

test('chaque écran a SA clé, l’uid est dans la clé ET dans la valeur', () => {
  const ls = faux();
  ecrireInstantaneEcran('colis', colis('A'), { ls });
  ecrireInstantaneEcran('ventes', ventes('A'), { ls });
  assert.ok(lireInstantaneEcran('colis', 'A', { maintenant: T0, ls }));
  assert.ok(lireInstantaneEcran('ventes', 'A', { maintenant: T0, ls }));
  assert.equal(lireInstantaneEcran('colis', 'B', { maintenant: T0, ls }), null);
  // Rangé sous la clé de B mais porté par A : jamais rendu à B.
  ls.setItem(cleInstantaneEcran('colis', 'B'), JSON.stringify(colis('A')));
  assert.equal(lireInstantaneEcran('colis', 'B', { maintenant: T0, ls }), null);
  // L'instantané d'un AUTRE écran sous cette clé : refusé.
  ls.setItem(cleInstantaneEcran('colis', 'A'), JSON.stringify(ventes('A')));
  assert.equal(lireInstantaneEcran('colis', 'A', { maintenant: T0, ls }), null);
  // Un écran inconnu n'a pas de clé.
  assert.equal(lireInstantaneEcran('annonces', 'A', { maintenant: T0, ls }), null);
  assert.ok(cleInstantaneEcran('colis', 'A').startsWith('vrm_'), 'effacée par wipeLocalData (vrm_*)');
});
test('Ma journée garde sa clé du 9 nov. et lit un instantané rangé avant (sans `ecran`)', () => {
  const ls = faux();
  assert.equal(cleInstantane('A'), 'vrm_journee_instantane:A');
  const ancien = { v: 1, uid: 'A', t: T0, jour: jourLocalIso(T0), mois: jourLocalIso(T0).slice(0, 7), cases: [] };
  ls.setItem(cleInstantane('A'), JSON.stringify(ancien));
  assert.ok(lireInstantane('A', { maintenant: T0, ls }));
  assert.equal(lireInstantaneEcran('colis', 'A', { maintenant: T0, ls }), null);
});
test('UN seul compte sur l’appareil, tous écrans ; effacer les retire tous', () => {
  const ls = faux();
  ecrireInstantaneEcran('colis', colis('A'), { ls });
  ecrireInstantaneEcran('ventes', ventes('A'), { ls });
  ecrireInstantane({ ...base('journee', 'A'), cases: [] }, { ls });
  assert.equal(ls.length, 3);
  // B écrit Ventes : TOUT ce qui est à A part (Colis et Ma journée compris).
  ecrireInstantaneEcran('ventes', ventes('B'), { ls });
  assert.equal(ls.length, 1);
  assert.ok(lireInstantaneEcran('ventes', 'B', { maintenant: T0, ls }));
  ls.setItem('vrm_autre_chose', '1');
  effacerInstantanes({ ls });
  assert.equal(ls.length, 1, 'seuls les instantanés partent');
});
test('trop vieux, futur, illisible, autre version ⇒ rien', () => {
  const ls = faux();
  ecrireInstantaneEcran('colis', colis('A', T0 - AGE_MAX_INSTANTANE_MS - 1000), { ls });
  assert.equal(lireInstantaneEcran('colis', 'A', { maintenant: T0, ls }), null);
  ecrireInstantaneEcran('colis', colis('A', T0 + 3600000), { ls });
  assert.equal(lireInstantaneEcran('colis', 'A', { maintenant: T0, ls }), null);
  ls.setItem(cleInstantaneEcran('colis', 'A'), '{pas du json');
  assert.equal(lireInstantaneEcran('colis', 'A', { maintenant: T0, ls }), null);
  ls.setItem(cleInstantaneEcran('colis', 'A'), JSON.stringify({ ...colis('A'), v: 2 }));
  assert.equal(lireInstantaneEcran('colis', 'A', { maintenant: T0, ls }), null);
});
test('Colis un autre jour : ni prochaine chose, ni délais, ni carte du jour ; les nombres des onglets restent', () => {
  const M0 = colisMontrable(colis('A'), T0 + 60000);
  assert.ok(M0.prochain && M0.carte && M0.liste[1].limite);
  const lendemain = T0 + 86400000;
  const M = colisMontrable(colis('A'), lendemain);
  assert.equal(M.prochain, null);
  assert.equal(M.carte, null, 'la carte « Aujourd’hui » n’est pas d’aujourd’hui');
  assert.equal(M.liste[1].limite, ''); assert.equal(M.liste[1].attente, '');
  assert.equal(M.liste[1].num, '117'); assert.equal(M.onglets[0].n, 3);
  assert.equal(colisMontrable(ventes('A'), T0), null, 'un instantané de Ventes ne se montre pas dans Colis');
});
test('Ventes un autre jour : la carte du mois reste le même mois, « hier » ne se dit plus', () => {
  const lendemain = T0 + 86400000;
  const M = ventesMontrable(ventes('A'), lendemain);
  assert.ok(M.carte, 'même mois');
  assert.equal(M.lignes[0].date, '');
  assert.equal(M.lignes[0].prix, '80 €');
  const moisSuivant = new Date(2026, 11, 1, 10).getTime();
  assert.equal(ventesMontrable(ventes('A'), moisSuivant).carte, null);
});
