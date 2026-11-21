// ════════════════════════════════════════════════════════════════════════════
//  « shop_x EST RELIÉ À VRM » TOUT DE SUITE (5.331, 9 nov.)
//
//  L'extension écrit les comptes directement en base : sans app ouverte, le
//  serveur ne voyait un compte neuf qu'au cron. Depuis la 5.331, après la
//  PREMIÈRE écriture réussie d'un compte, elle appelle
//  `POST https://vrm.center/api/push { action:'comptes' }` avec la session VRM.
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`), tout est inventé :
//   P1  compte Vinted neuf : 1 appel, corps { action:'comptes' } seul, Bearer de
//       la session ; 20 captures de plus (jeton/csrf qui changent) ⇒ toujours 1 ;
//   P2  un compte déjà écrit par CE Chrome (mise à jour 5.330 → 5.331) ⇒ 0 appel ;
//   P3  aucune session VRM ⇒ 0 appel (ni push, ni écriture) ; un signal en
//       attente n'est pas envoyé sans session ;
//   P4  réseau coupé au 1er essai ⇒ retenté à la prochaine écriture, puis plus rien ;
//   P5  Leboncoin : un compte « moi » neuf ⇒ 1 appel ; réécrit ⇒ 0 ; une fiche
//       d'autrui ⇒ 0 ;
//   P6  Vestiaire : un compte neuf dans `vc_session` ⇒ 1 appel ; revu ⇒ 0 ;
//   P7  une écriture refusée par la base ⇒ 0 appel.
//  `--src chemin` : une autre copie (sur la 5.330 : rouge).
// ════════════════════════════════════════════════════════════════════════════
const vm = require('vm');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${det ? ' — ' + det : ''}`); };
const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); } };
const attendre = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (acc, n) => `${b64({ alg: 'none' })}.${b64({ account_id: acc, n })}.sig`;

function monter({ store = {}, vrm = () => ({ status: 200, body: { ok: true, envoye: true, n: 1 } }), refuseEcriture = () => false, lignes = {} } = {}) {
  const f = faireFond({ src: cheminSource(), store, vrm, lignes });
  const { ctx } = f;
  const cookies = { access_token_web: jwt(5151, 1), refresh_token_web: 'r1', anon_id: 'a1' };
  ctx.getCookie = async (_d, nom) => cookies[nom] || null;
  ctx.blockedAccounts = async () => new Set();
  ctx.unblockedAccounts = async () => new Set();
  ctx.compteRefuse = async () => false;
  const fetch0 = ctx.fetch;
  f.ecritsComptes = 0;
  ctx.fetch = async (url, opts = {}) => {
    if (/\/rest\/v1\/vinted_accounts/.test(String(url)) && (opts.method || 'GET') === 'POST') {
      f.ecritsComptes++;
      if (refuseEcriture(f.ecritsComptes)) return { ok: false, status: 503, headers: { get: () => 'text/html' }, json: async () => ({}), text: async () => '<html>503</html>' };
      return { ok: true, status: 201, headers: { get: () => 'application/json' }, json: async () => [], text: async () => '' };
    }
    return fetch0(url, opts);
  };
  const push = () => f.j.vrmApi.filter((x) => /\/api\/push$/.test(String(x.url).split('?')[0]));
  return Object.assign(f, { cookies, push });
}
const csrf = (ctx, v) => vm.runInContext(`lastCsrfByDomain['www.vinted.fr'] = ${JSON.stringify(v)}`, ctx);

(async () => {
  await essaie('P1', async () => {
    const f = monter();
    await f.ctx.captureDomain('www.vinted.fr'); await attendre();
    const p = f.push();
    dit(p.length === 1, 'P1 · compte Vinted neuf : UN appel à /api/push', p.length + ' appel(s)');
    dit(p[0] && p[0].methode === 'POST' && JSON.stringify(p[0].corps) === JSON.stringify({ action: 'comptes' }), 'P1 · POST, corps { action:"comptes" } seul (aucun compte, aucun nom)', p[0] && JSON.stringify(p[0].corps));
    dit(p[0] && p[0].headers && p[0].headers.Authorization === 'Bearer jeton.banc.defaut', 'P1 · avec la session VRM (Bearer)', p[0] && JSON.stringify(p[0].headers));
    for (let i = 0; i < 20; i++) { csrf(f.ctx, 'c' + i); f.cookies.access_token_web = jwt(5151, i + 2); await f.ctx.captureDomain('www.vinted.fr'); }
    await f.ctx.envoyerComptesSignales(); await attendre();
    dit(f.ecritsComptes >= 20 && f.push().length === 1, 'P1 · 20 réécritures du même compte ⇒ toujours un seul appel', `${f.ecritsComptes} écritures, ${f.push().length} appel(s)`);
    const m = f.store.vrmComptesSignales || {};
    dit(m['vinted:5151'] && m['vinted:5151'].fait === true, 'P1 · mémorisé dans chrome.storage.local (vinted:5151 fait)', JSON.stringify(m));
  });

  await essaie('P2', async () => {
    const f = monter({ store: { vrmCompteEcrit: { 5151: { sig: 'ancien', at: Date.now() - 3600e3 } } } });
    await f.ctx.captureDomain('www.vinted.fr'); await attendre();
    dit(f.ecritsComptes === 1 && f.push().length === 0, 'P2 · compte déjà écrit par ce Chrome (mise à jour) : écrit, mais AUCUN appel', `${f.ecritsComptes} écriture(s), ${f.push().length} appel(s)`);
  });

  await essaie('P3', async () => {
    const f = monter({ store: { __sansSession: true } });
    await f.ctx.captureDomain('www.vinted.fr'); await attendre();
    dit(f.push().length === 0 && f.ecritsComptes === 0, 'P3 · aucune session VRM : 0 appel, 0 écriture', `${f.push().length} appel(s), ${f.ecritsComptes} écriture(s)`);
    const g = monter({ store: { __sansSession: true, vrmComptesSignales: { 'vinted:77': { at: Date.now(), fait: false } } } });
    await g.ctx.envoyerComptesSignales(); await attendre();
    dit(g.push().length === 0, 'P3 · un signal en attente ne part pas sans session', g.push().length + ' appel(s)');
    dit(g.store.vrmComptesSignales['vinted:77'] && g.store.vrmComptesSignales['vinted:77'].fait === false, 'P3 · et il reste en attente (rien d\'oublié)');
  });

  await essaie('P4', async () => {
    let n = 0;
    const f = monter({ vrm: () => (++n === 1 ? { reseau: true } : { status: 200, body: { ok: true } }) });
    await f.ctx.captureDomain('www.vinted.fr'); await attendre();
    dit(f.push().length === 1 && f.store.vrmComptesSignales['vinted:5151'].fait === false, 'P4 · réseau coupé : gardé en attente', JSON.stringify(f.store.vrmComptesSignales));
    csrf(f.ctx, 'x'); await f.ctx.captureDomain('www.vinted.fr'); await attendre();
    dit(f.push().length === 2 && f.store.vrmComptesSignales['vinted:5151'].fait === true, 'P4 · retenté à l\'écriture suivante, puis fait', f.push().length + ' appel(s)');
    csrf(f.ctx, 'y'); await f.ctx.captureDomain('www.vinted.fr'); await f.ctx.envoyerComptesSignales(); await attendre();
    dit(f.push().length === 2, 'P4 · plus rien ensuite', f.push().length + ' appel(s)');
  });

  await essaie('P5', async () => {
    const f = monter({ lignes: { lbc_accounts: { accounts: {} } } });
    const r1 = await f.ctx.storeLbcAccount({ id: 'lbc-account:8442001', session: true, platform: 'leboncoin', source: 'session:messagerie', name: 'lbc_banc' }); await attendre();
    dit(r1 === true && f.push().length === 1, 'P5 · compte Leboncoin « moi » neuf : un appel', `écrit ${r1}, ${f.push().length} appel(s)`);
    await f.ctx.storeLbcAccount({ id: '8442001', session: true, platform: 'leboncoin', source: 'session:messagerie' }); await attendre();
    dit(f.push().length === 1, 'P5 · le même compte sous son autre clé ⇒ pas de second appel', f.push().length + ' appel(s)');
    const g = monter({ lignes: { lbc_accounts: { accounts: {} } } });
    await g.ctx.storeLbcAccount({ id: '9990001', platform: 'leboncoin', source: 'https://www.leboncoin.fr/profile/user-card/9990001' }); await attendre();
    dit(g.push().length === 0, 'P5 · une fiche d\'AUTRUI rangée ⇒ aucun appel', g.push().length + ' appel(s)');
  });

  await essaie('P6', async () => {
    const f = monter({ lignes: { vc_session: { id: 'vc-old', at: new Date(Date.now() - 864e5).toISOString(), comptes: { 'vc-old': new Date().toISOString() } } } });
    const r = await f.ctx.noterSessionVc('vc-neuf-42', null, [], 'users/me'); await attendre();
    dit(r === true && f.push().length === 1, 'P6 · compte Vestiaire neuf : un appel', `écrit ${r}, ${f.push().length} appel(s)`);
    f.lignes.vc_session.at = new Date(Date.now() - 864e5).toISOString();
    await f.ctx.noterSessionVc('vc-neuf-42', null, [], 'users/me'); await attendre();
    dit(f.push().length === 1, 'P6 · le même compte revu ⇒ pas de second appel', f.push().length + ' appel(s)');
    const g = monter({ lignes: { vc_session: { id: 'vc-old', at: new Date(Date.now() - 864e5).toISOString(), comptes: { 'vc-old': new Date().toISOString() } } } });
    await g.ctx.noterSessionVc('vc-old', null, [], 'users/me'); await attendre();
    dit(g.push().length === 0, 'P6 · un compte déjà rangé ⇒ aucun appel', g.push().length + ' appel(s)');
  });

  await essaie('P7', async () => {
    const f = monter({ refuseEcriture: () => true });
    await f.ctx.captureDomain('www.vinted.fr'); await attendre();
    dit(f.push().length === 0, 'P7 · écriture refusée par la base ⇒ aucun appel', f.push().length + ' appel(s)');
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
