// (14 nov.) L'ouverture instantanée (src/ouvertureInstantanee.js) : QUAND l'instantané de Ma journée peut être
// peint avant l'app — rien que ce que la porte hors ligne laisserait voir, pour CE compte, sur CET appareil —, et
// la règle « une capture plus pauvre n'écrase pas une plus riche » (src/journeeInstantanee.js, §4.2).
// Le rendu est jugé par scripts/bancs/ouverture-instantanee.cjs.
// node --test scripts/tests/ouverture-instantanee.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { apercuOuverture, boutiquePropre, ouvreMaJournee, mfaPassee, cadreUtilisable } from '../../src/ouvertureInstantanee.js';
import { ecrireInstantane, lireInstantane, cleInstantane, jourLocalIso, chiffresConnus } from '../../src/journeeInstantanee.js';
import { noterVerification, noterAbonnement, cleLaissezPasser, DUREE_LAISSEZ_PASSER_MS } from '../../src/porteHorsLigne.js';

const faux = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jeton = (sub, aal = 'aal1') => `${b64({ alg: 'HS256' })}.${b64({ sub, aal })}.sig`;
const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002';
const T0 = new Date(2026, 10, 14, 9, 0, 0).getTime();
const session = (uid, o = {}) => ({ access_token: jeton(uid), refresh_token: 'rt-' + uid, expires_at: T0 + 3600e3, totp: [], user: { id: uid }, ...o });
const snap = (uid, t = T0 - 7 * 60000, o = {}) => ({ v: 1, ecran: 'journee', uid, t, jour: jourLocalIso(t), mois: jourLocalIso(t).slice(0, 7), prenom: '', phrase: { texte: 'Des colis à envoyer' }, prochain: { tuile: 'envoyer', titre: '3 colis' },
  frise: { jours: [{ iso: jourLocalIso(t), n: 2, v: 12500 }], panneau: null }, cases: [{ cle: 'vendu-mois', valeur: '18500', b: '185 €', vide: false }], objectif: null, gestes: 2, ...o });
// Un appareil où CE compte a ouvert l'app (vérifié par le serveur, abonnement lu, boutique à lui) et rangé son instantané.
function appareil(uid = A, { ses = session(uid), equipe = { membreDe: [], aBoutique: true }, abo = { acces: true, statut: 'active' }, s = snap(uid) } = {}) {
  const ls = faux();
  ls.setItem('vrm_session', JSON.stringify(ses));
  noterVerification(ls, ses, T0 - 3600e3);
  if (abo) noterAbonnement(ls, uid, abo, T0 - 3600e3);
  if (equipe) ls.setItem(`vrm_equipe_cache_${uid}`, JSON.stringify(equipe));
  if (s) ecrireInstantane(s, { ls });
  return ls;
}
const decide = (ls, search = '?tab=journee') => apercuOuverture({ stock: ls, search, maintenant: T0 });

test('le cas normal : peint, pour CE compte', () => {
  const d = decide(appareil());
  assert.equal(d.uid, A);
  assert.ok(d.snap && d.montrable && d.montrable.cases);
});

test('aucune écriture : la décision ne fait que lire', () => {
  const ls = appareil(); const avant = JSON.stringify([...Array(ls.length).keys()].map((i) => [ls.key(i), ls.getItem(ls.key(i))]));
  decide(ls); decide(ls, '');
  assert.equal(JSON.stringify([...Array(ls.length).keys()].map((i) => [ls.key(i), ls.getItem(ls.key(i))])), avant);
});

test('un AUTRE compte sur l’appareil ne voit jamais l’instantané du précédent', () => {
  const ls = appareil(A);
  // B se connecte : sa session, ses vérifications, mais l'instantané rangé est celui de A.
  const sb = session(B); ls.setItem('vrm_session', JSON.stringify(sb)); noterVerification(ls, sb, T0 - 60e3); noterAbonnement(ls, B, { acces: true }, T0 - 60e3);
  ls.setItem(`vrm_equipe_cache_${B}`, JSON.stringify({ membreDe: [], aBoutique: true }));
  assert.equal(decide(ls).snap, undefined);
  // Même rangé sous la clé de B, l'instantané de A n'est pas rendu (l'uid est DANS la valeur).
  ls.setItem(cleInstantane(B), JSON.stringify(snap(A)));
  assert.equal(decide(ls).snap, undefined);
});

test('la porte hors ligne décide : session incohérente, autre session, plus de 7 jours, jamais vérifié', () => {
  // le jeton dit un autre compte
  assert.equal(decide(appareil(A, { ses: session(A, { access_token: jeton(B) }) })).raison, 'porte:jeton');
  // une autre session (même compte) que celle vérifiée
  const ls = appareil(); ls.setItem('vrm_session', JSON.stringify(session(A, { refresh_token: 'autre' })));
  assert.equal(decide(ls).raison, 'porte:autre-session');
  // vérifiée il y a plus de 7 jours
  const vieux = appareil(); noterVerification(vieux, session(A), T0 - DUREE_LAISSEZ_PASSER_MS - 60e3);
  assert.equal(decide(vieux).raison, 'porte:perime');
  // jamais vérifiée sur cet appareil
  const jamais = appareil(); jamais.removeItem(cleLaissezPasser(A));
  assert.equal(decide(jamais).raison, 'porte:aucun');
});

test('double vérification pas passée (ou pas sue) : rien', () => {
  assert.equal(decide(appareil(A, { ses: session(A, { totp: [{ id: 'f' }] }) })).raison, 'mfa');
  assert.equal(decide(appareil(A, { ses: session(A, { totp: undefined }) })).raison, 'mfa');
  assert.ok(mfaPassee(session(A, { totp: [{ id: 'f' }], access_token: jeton(A, 'aal2') })));
});

test('sans abonnement (aperçu flouté) ou abonnement inconnu : rien', () => {
  assert.equal(decide(appareil(A, { abo: { acces: false, lecture: true } })).raison, 'abonnement');
  assert.equal(decide(appareil(A, { abo: { acces: false } })).raison, 'abonnement');
  assert.equal(decide(appareil(A, { abo: null })).raison, 'porte:abonnement-inconnu');
});

test('mode équipe : un aide va sur les colis du vendeur — rien ; pas su — rien', () => {
  assert.equal(decide(appareil(A, { equipe: { membreDe: [{ id: 1, vendeur: 'V' }], aBoutique: false } })).raison, 'equipe');
  const choisi = appareil(A, { equipe: { membreDe: [{ id: 1, vendeur: 'V' }], aBoutique: true } }); choisi.setItem(`vrm_equipe_vue_${A}`, 'V');
  assert.equal(decide(choisi).raison, 'equipe');
  assert.equal(decide(appareil(A, { equipe: null })).raison, 'equipe');
  // migration 016 pas appliquée (`nonInstalle`) : sa propre boutique
  assert.equal(boutiquePropre(appareil(A, { equipe: { membreDe: [], aBoutique: null, nonInstalle: true } }), A), true);
});

test('seulement quand Ma journée va s’ouvrir', () => {
  const ls = appareil();
  assert.ok(decide(ls, '?tab=journee').snap);
  assert.equal(decide(ls, '?tab=ventes').raison, 'ecran');
  assert.equal(decide(ls, '?connexion').raison, 'ecran');
  assert.ok(decide(ls, '').snap);   // aucune reprise : Ma journée
  // une reprise de moins de 30 min vers un autre écran
  ls.setItem('vrm_reprise_ecrans', JSON.stringify({ owner: A, vues: {}, comptes: {}, sites: {}, ecran: { tab: 'ventes', at: T0 - 60e3 } }));
  assert.equal(ouvreMaJournee(ls, '', A, T0), false);
  assert.equal(decide(ls, '').raison, 'ecran');
});

test('instantané trop vieux (plus de 3 jours) ou d’un autre uid : rien', () => {
  assert.equal(decide(appareil(A, { s: snap(A, T0 - 4 * 86400e3) })).raison, 'instantane');
  assert.equal(decide(appareil(A, { s: null })).raison, 'instantane');
});

test('§4.2 : une capture plus pauvre n’écrase pas une plus riche (même jour, moins de 6 h)', () => {
  const ls = faux();
  const riche = snap(A, T0 - 3600e3, { cases: [{ cle: 'vendu-mois', b: '185 €' }, { cle: 'recu-mois', b: '140 €' }] });
  assert.ok(ecrireInstantane(riche, { ls }));
  const pauvre = snap(A, T0, { cases: [{ cle: 'vendu-mois', b: '185 €' }, { cle: 'recu-mois', b: '—', vide: true }] });
  assert.ok(chiffresConnus(pauvre) < chiffresConnus(riche));
  assert.equal(ecrireInstantane(pauvre, { ls }), false);
  assert.equal(lireInstantane(A, { ls, maintenant: T0 }).t, riche.t);
  // aussi riche (ou plus) : remplacé
  assert.ok(ecrireInstantane(snap(A, T0, { cases: riche.cases }), { ls }));
  assert.equal(lireInstantane(A, { ls, maintenant: T0 }).t, T0);
  // plus de 6 h : la plus pauvre (mais plus fraîche) remplace
  const ls2 = faux(); ecrireInstantane(snap(A, T0 - 7 * 3600e3, { cases: riche.cases }), { ls: ls2 });
  assert.ok(ecrireInstantane(pauvre, { ls: ls2 }));
});

test('le cadre ne sert qu’à la même largeur et au même thème, nettoyé', () => {
  const c = { haut: 53, gauche: 0, large: 390, vw: 390, theme: 'light', barre: 'rgb(28, 28, 30)', shell: 'vrm-app-shell <script>', main: 'vrm-main', vars: { '--vrm-ink': '#1D1D1F', '--x': 'url(https://x)', 'color': 'red' } };
  const u = cadreUtilisable(c, { largeur: 390, theme: 'light' });
  assert.ok(u); assert.equal(u.haut, 53); assert.equal(u.shell, 'vrm-app-shell'); assert.deepEqual(u.vars, { '--vrm-ink': '#1D1D1F' });
  assert.equal(cadreUtilisable(c, { largeur: 1512, theme: 'light' }), null);
  assert.equal(cadreUtilisable(c, { largeur: 390, theme: 'dark' }), null);
  assert.equal(cadreUtilisable({ ...c, haut: 900 }, { largeur: 390, theme: 'light' }), null);
  assert.equal(cadreUtilisable({ ...c, barre: 'red; background:url(x)' }, { largeur: 390, theme: 'light' }).barre, '');
});
