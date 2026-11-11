// (11 nov., revue de sécurité) Un lien `https://vrm.center/#access_token=…`
// fabriqué par un tiers avec SES jetons ne doit jamais ouvrir l'app sur son
// compte. On EXÉCUTE le vrai `consumeAuthRedirect` d'App.jsx (découpé du
// source) avec un faux navigateur. Rouge sur le code d'avant : la session du
// tiers était écrite.
//   node --test scripts/tests/lien-email-session.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '..', '..');
const source = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
const debut = source.indexOf('const consumeAuthRedirect = async');
const fin = source.indexOf("// Le jeton ne dit pas l'email en clair", debut);
assert.ok(debut > 0 && fin > debut, 'consumeAuthRedirect introuvable');
const code = source.slice(debut, fin) + ';globalThis.consumer=consumeAuthRedirect;';
const cheminLien = path.join(racine, 'src', 'lienEmail.js');
const lien = fs.existsSync(cheminLien) ? await import(pathToFileURL(cheminLien).href) : {};

function stockage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
}
function banc({ hash, avant = null, demande = null, jetonDe = 'tiers' }) {
  const ls = stockage(demande == null ? {} : { vrm_lien_demande: String(demande) });
  let ecrite;
  const c = vm.createContext({
    ...lien,
    MULTI_USER: true,
    RECOVERY_PENDING: false,
    URLSearchParams,
    Date, Number, String, Object, JSON,
    window: { location: { search: '', hash } },
    localStorage: ls, sessionStorage: stockage(),
    cleanAuthUrl: () => {},
    lireLiaisonOAuth: () => null,
    erreurRetourOAuth: e => e,
    readSession: () => avant,
    fetchMe: async () => ({ id: jetonDe, email: jetonDe + '@x.test' }),
    writeSession: s => { ecrite = s; },
  });
  vm.runInContext(code, c);
  return { run: () => c.consumer(), get ecrite() { return ecrite; }, ls };
}
const H = '#access_token=a.b.c&refresh_token=r&expires_in=3600&type=magiclink';

test('lien piégé : aucun e-mail demandé ici, aucune session ⇒ rien n’est adopté', async () => {
  const b = banc({ hash: H });
  const r = await b.run();
  assert.equal(b.ecrite, undefined, 'la session du tiers a été écrite');
  assert.ok(r && r.error && !r.ok);
});
test('lien piégé : par-dessus la session d’un AUTRE compte ⇒ la session reste', async () => {
  const b = banc({ hash: H, avant: { access_token: 'v', user: { id: 'victime' } }, demande: Date.now() });
  const r = await b.run();
  assert.equal(b.ecrite, undefined);
  assert.ok(r && r.error);
});
test('lien demandé dans ce navigateur (inscription, < 48 h) ⇒ connecté, marque consommée', async () => {
  const b = banc({ hash: H, demande: Date.now() - 3600e3, jetonDe: 'moi' });
  const r = await b.run();
  assert.equal(r && r.ok, true);
  assert.equal(b.ecrite && b.ecrite.user && b.ecrite.user.id, 'moi');
  assert.equal(b.ls.getItem('vrm_lien_demande'), null);
});
test('marque périmée (> 48 h) ⇒ refus', async () => {
  const b = banc({ hash: H, demande: Date.now() - 49 * 3600e3, jetonDe: 'moi' });
  await b.run();
  assert.equal(b.ecrite, undefined);
});
test('même compte déjà connecté ici ⇒ le lien est accepté', async () => {
  const b = banc({ hash: H, avant: { access_token: 'v', user: { id: 'moi' } }, jetonDe: 'moi' });
  const r = await b.run();
  assert.equal(r && r.ok, true);
  assert.equal(b.ecrite.user.id, 'moi');
});
test('les demandes d’e-mail posent la marque (inscription, lien, renvoi, mot de passe oublié)', () => {
  for (const f of ['authSignUp  =', 'authMagicLink =', 'authResendConfirm =', 'authReset   =']) {
    const i = source.indexOf('const ' + f);
    assert.ok(i > 0, f);
    const corps = source.slice(i, source.indexOf('\n};', i) > 0 ? Math.min(source.indexOf('\n};', i), i + 1500) : i + 1500);
    assert.match(corps, /noterLienDemande\(localStorage\)/, f);
  }
});

// (11 nov.) La déconnexion efface aussi le cache des ventes/achats de l'onglet
// (`sessionStorage`), sinon le vendeur suivant du même onglet le lisait.
test('déconnexion : le cache des ventes de l’onglet (sessionStorage) et sa copie en mémoire partent', () => {
  const d = source.indexOf('const wipeLocalData = () => {');
  const f = source.indexOf('// Mémorise à qui appartiennent', d);
  assert.ok(d > 0 && f > d);
  const ss = stockage({ vrm_acct_cache: JSON.stringify({ sold: { ts: Date.now(), items: [{ title: 'paire de A' }] } }) });
  const ls = stockage({ vrm_x: '1', autre: '2' });
  ls.length = 2; ls.key = (i) => [...ls._m.keys()][i];
  const cache = { sold: { items: [1] } };
  const c = vm.createContext({ localStorage: ls, sessionStorage: ss, KEEP_ON_SWITCH: [], _acctCache: cache, effacerCopies: () => {}, CACHE_QR: 'q', CACHE_PDF: 'p', Object });
  vm.runInContext(source.slice(d, f) + ';wipeLocalData();', c);
  assert.equal(ss.getItem('vrm_acct_cache'), null, 'le cache de A reste dans l’onglet');
  assert.equal(Object.keys(cache).length, 0, 'la copie en mémoire reste');
  assert.equal(ls.getItem('vrm_x'), null);
});
