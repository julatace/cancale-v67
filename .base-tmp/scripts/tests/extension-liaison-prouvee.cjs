// scripts/tests/extension-liaison-prouvee.cjs — défaut #5, côté extension (5.332)
// Le VRAI background.js (scripts/_fond-vm.cjs) : `captureDomain` d'un compte
// Vinted NEUF quand la base (migration 029) refuse l'upsert direct.
//   · avant la 029 (upsert accepté) : rien ne change, la route n'est PAS appelée ;
//   · refus 42501 `vrm_vinted_preuve` ⇒ POST vrm.center/api/vinted-connect
//     { source:'extension' } avec la session VRM et les jetons de l'onglet ;
//     200 ⇒ compte noté écrit (plus réécrit pendant 30 min) ;
//   · « déjà relié » (409) ⇒ dit dans le journal, et PAS de nouvel appel avant 24 h ;
//   · Vinted muet (503) ⇒ nouvel essai seulement après 15 min ;
//   · sans session VRM ⇒ aucun appel.
// `--src chemin` : une autre copie de background.js (preuve sur le code d'avant).
const assert = require('assert/strict');
const path = require('path');
const { faireFond } = require('../_fond-vm.cjs');
const i = process.argv.indexOf('--src');
const SRC = i > 0 ? path.resolve(process.argv[i + 1]) : undefined;
const JETON = 'e30.' + Buffer.from(JSON.stringify({ account_id: 4242, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.sig';
let n = 0;
const ok = (c, m, d) => { if (!c) { console.log('  ❌ ' + m + (d ? ' — ' + d : '')); process.exitCode = 1; } else { n++; console.log('  ✅ ' + m); } };

function monter({ refus = 'preuve', route = () => ({ status: 200, body: { ok: true, account: { vinted_user_id: '4242', login: 'shop_neuf' } } }), sansSession = false } = {}) {
  const store = sansSession ? { __sansSession: true } : {};
  const f = faireFond({ src: SRC, store });
  const j = { upserts: 0, routes: [] };
  const avant = f.ctx.fetch;
  f.ctx.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (/\/rest\/v1\/vinted_accounts\?on_conflict=/.test(u) && opts.method === 'POST') {
      j.upserts++;
      if (refus === 'preuve') return new Response(JSON.stringify({ code: '42501', message: 'vrm_vinted_preuve: un compte Vinted se relie par vrm.center (preuve du jeton chez Vinted)', hint: 'POST /api/vinted-connect' }), { status: 403 });
      if (refus === 'unicite') return new Response(JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint' }), { status: 409 });
      return new Response('', { status: 201 });
    }
    if (u === 'https://vrm.center/api/vinted-connect') {
      j.routes.push({ corps: JSON.parse(opts.body), auth: (opts.headers || {}).Authorization });
      const r = route(j.routes.length);
      return new Response(JSON.stringify(r.body), { status: r.status });
    }
    return avant(url, opts);
  };
  f.ctx.getCookie = async (d, nom) => (nom === 'access_token_web' ? JETON : nom === 'refresh_token_web' ? 'r-onglet' : nom === 'anon_id' ? 'anon-1' : null);
  return { f, j };
}

(async () => {
  console.log('── Avant la 029 : l’upsert direct passe, la route n’est jamais appelée');
  { const { f, j } = monter({ refus: null });
    await f.ctx.captureDomain('www.vinted.fr');
    ok(j.upserts === 1 && j.routes.length === 0, 'un upsert, aucun appel serveur', JSON.stringify(j)); }

  console.log('── Après la 029 : refus « preuve » ⇒ la route serveur relie le compte');
  { const { f, j } = monter();
    const uid = await f.ctx.captureDomain('www.vinted.fr');
    ok(uid === '4242' && j.routes.length === 1, 'refusé par la base ⇒ UN appel à /api/vinted-connect', JSON.stringify(j.routes.length));
    const c = j.routes[0] && j.routes[0].corps;
    ok(!!c && c.source === 'extension' && c.accessToken === JETON && c.refreshToken === 'r-onglet' && c.domain === 'www.vinted.fr' && !('owner' in c), 'corps : source extension, jetons de l’onglet, aucun propriétaire (le serveur le tire de la session)', JSON.stringify(c && Object.keys(c)));
    ok(/^Bearer /.test(j.routes[0].auth || ''), 'avec la session VRM');
    const e = (f.store.vrmCompteEcrit || {})['4242'];
    ok(!!e, 'relié ⇒ noté écrit (pas réécrit à chaque requête)');
    await f.ctx.captureDomain('www.vinted.fr');
    ok(j.routes.length === 1, 'la capture suivante (jetons inchangés) ne rappelle pas la route', String(j.routes.length)); }

  console.log('── « Déjà relié à un autre compte VRM » (409) ⇒ dit, et pas de nouvel essai avant 24 h');
  { const { f, j } = monter({ refus: 'unicite', route: () => ({ status: 409, body: { ok: false, raison: 'deja_relie', error: 'Ce compte Vinted est déjà relié à un autre compte VRM — contacte le support.' } }) });
    await f.ctx.captureDomain('www.vinted.fr');
    await f.ctx.captureDomain('www.vinted.fr');
    ok(j.routes.length === 1, 'une seule demande malgré deux captures', String(j.routes.length));
    const m = (f.store.vrmLiaisonServeur || {})['4242'];
    ok(!!m && m.raison === 'deja_relie' && m.prochain - m.at >= 24 * 3600000 - 1000, 'attente de 24 h notée', JSON.stringify(m));
    ok(!(f.store.vrmCompteEcrit || {})['4242'], 'rien n’est noté « écrit »');
    const journal = JSON.stringify(f.j.journal) + JSON.stringify(f.store.activityLog || f.store.vrmActivite || '');
    ok(/autre compte VRM/.test(journal) || /autre compte VRM/.test(JSON.stringify(f.store)), 'le journal d’activité le dit (« contacte le support »)'); }

  console.log('── Vinted muet ⇒ 503 : nouvel essai après 15 min seulement');
  { const { f, j } = monter({ route: () => ({ status: 503, body: { ok: false, raison: 'vinted_muet' } }) });
    await f.ctx.captureDomain('www.vinted.fr');
    const m = (f.store.vrmLiaisonServeur || {})['4242'];
    ok(j.routes.length === 1 && m && m.prochain - m.at >= 15 * 60000 - 1000 && m.prochain - m.at < 3600000, 'attente de 15 min', JSON.stringify(m)); }

  console.log('── Sans session VRM : aucun appel');
  { const { f, j } = monter({ sansSession: true });
    await f.ctx.captureDomain('www.vinted.fr');
    ok(j.routes.length === 0, 'rien ne part sans session', String(j.routes.length)); }

  console.log(process.exitCode ? '\n❌ extension-liaison-prouvee' : `\n✅ extension-liaison-prouvee : ${n} contrôles`);
})().catch((e) => { console.error(e); process.exitCode = 1; });
