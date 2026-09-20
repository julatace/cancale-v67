// ═══════════════════════════════════════════════════════════════════════════
// À QUI APPARTIENT UNE ANNONCE LEBONCOIN — LA BRIQUE DU MULTI-COMPTES
//        node scripts/audit-lbc-comptes.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « prépare une extension qui capte la plateforme, à quel compte ça
// appartient et le nom du compte, pour lier toutes les paires. » Il aura
// plusieurs comptes Leboncoin : sans savoir à QUI appartient chaque annonce,
// tout se mélange.
//
// ⚠️⚠️ MESURÉ LE 20 SEPT. SUR SA BASE — ET C'ÉTAIT FAUX DANS L'AUTRE SENS.
//   `lbc_accounts` contenait **9 comptes, dont 8 QUI NE SONT PAS LES SIENS**
//   (Ethan, Chloé, David, Miguel…), captés depuis des fiches d'AUTRES vendeurs :
//   `api/user-card/v2/{id}/infos`, `api/discovery/category/N`, `api/same/v4/…`,
//   `api/dashboard/v1/search`. Ils passaient parce que TOUTE fiche pro publique
//   porte `is_pro`/`store_id` — le marqueur « c'est moi » n'en est pas un. Le
//   SEUL compte à lui (`SHOPCANCALE`) venait de `/users/me/linked_accounts`.
//   Taguer une paire du MAUVAIS compte est la faute irréversible (§5).
//
// LA RÈGLE (§5, §11 : même code des deux côtés) : l'identité du compte connecté
// ne se lit QUE sur un endpoint « moi » (`/users/me`, `linked_accounts`…),
// JAMAIS sur la carte/le feed d'un id précis. Manquer un futur endpoint « moi »
// ⇒ blanc (safe) ; accepter une fiche d'autrui ⇒ faux (perte).
//
// Ce que ce contrôle EXÉCUTE (le vrai `background.js` dans un `vm`) :
//   1. un compte lu sur `/users/me/linked_accounts` est reconnu ;
//   2. ⚠️ la MÊME identité servie depuis `user-card` / `discovery` / `dashboard/
//      search` n'est PAS prise (le garde §6.1 : rouge sur le code d'avant) ;
//   3. un ACHETEUR (id + pseudo, aucun marqueur) n'est jamais pris ;
//   4. l'auto-nettoyage retire de `lbc_accounts` un compte capté à tort (source
//      = fiche d'autrui), et garde celui venu de `linked_accounts`.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const FICH = 'vinted-sync-extension/background.js';
const BG_NEUF = fs.readFileSync(path.join(racine, FICH), 'utf8');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = async (nom, fn) => { try { return await fn(); } catch (e) { dit(false, nom, 'a levé : ' + e.message); return null; } };

const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
// `seed` : ce que rend une lecture GET `id=eq.X` (pour préseeder lbc_accounts).
function faireCtx(SRC, seed) {
  const ecrits = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } },
    },
    fetch: async (url, opts = {}) => {
      const rep = (ok, body, status) => ({ ok, status: status || (ok ? 200 : 522), json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST') { try { JSON.parse(opts.body || '[]').forEach((r) => ecrits.push(r)); } catch (_) {} return rep(true, '', 201); }
      // Lecture : si une graine correspond à l'id demandé, on la sert.
      if (seed) { for (const k of Object.keys(seed)) if (url.includes('id=eq.' + k)) return rep(true, JSON.stringify([{ id: k, data: seed[k] }])); }
      return rep(true, '[]'); // sinon : ligne vide
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined; ctx.__ecrits = ecrits;
  vm.createContext(ctx); vm.runInContext(SRC, ctx, { filename: 'background.js' });
  return ctx;
}

// L'identité du compte connecté, telle qu'elle vit dans /users/me/linked_accounts.
const MOI_PART = { user: { user_id: 55, pseudo: 'SHOPCANCALE', email: 'j@ex.fr', is_pro: false } };
const MOI_PRO = { account: { store_id: 88, company_name: 'Cancale Sneakers', siren: '123456789' } };
// La MÊME forme d'identité, mais servie depuis une fiche d'AUTRUI (le piège réel).
const AUTRUI = { user: { user_id: 6002, pseudo: 'Miguel', is_pro: true, store_id: 6002 } };
// Une conversation : acheteurs, aucun marqueur personnel.
const MESSAGES = { conversations: [{ interlocutor: { user_id: 999, pseudo: 'acheteur12' } }] };

(async () => {
  console.log('── L’IDENTITÉ NE SE LIT QUE SUR UN ENDPOINT « MOI » (vrai background.js, arbre)');
  const c = faireCtx(BG_NEUF);

  await essaie('compte lu sur /users/me/linked_accounts → reconnu', () => {
    const a = c.detectLbcAccount(MOI_PART, 'https://api.leboncoin.fr/api/authenticator/v1/users/me/linked_accounts');
    dit(!!a && a.id === '55' && a.name === 'SHOPCANCALE' && a.type === 'particulier', 'particulier reconnu', a ? JSON.stringify(a) : 'null');
  });
  await essaie('compte pro lu sur /users/me → reconnu pro', () => {
    const a = c.detectLbcAccount(MOI_PRO, 'https://api.leboncoin.fr/api/users/me');
    dit(!!a && a.id === '88' && a.type === 'pro', 'pro reconnu', a ? JSON.stringify(a) : 'null');
  });

  console.log('\n── ⚠️ LE GARDE §6.1 : UNE FICHE D’AUTRUI N’EST JAMAIS PRISE POUR SON COMPTE');
  // Sur le code d'avant, detectLbcAccount ne regarde pas l'URL : ces trois-là
  // renvoient un compte (Miguel & co. dans sa base). Après : null. ROUGE avant.
  await essaie('depuis api/user-card/v2/{id}/infos → AUCUN compte', () => {
    const a = c.detectLbcAccount(AUTRUI, 'https://api.leboncoin.fr/api/user-card/v2/6002/infos');
    dit(a === null, 'fiche d’un autre vendeur écartée', a ? JSON.stringify(a) : 'null');
  });
  await essaie('depuis api/discovery/category/53 → AUCUN compte', () => {
    const a = c.detectLbcAccount(AUTRUI, 'https://api.leboncoin.fr/api/discovery/category/53?limit=10');
    dit(a === null, 'flux découverte écarté', a ? JSON.stringify(a) : 'null');
  });
  await essaie('depuis api/dashboard/v1/search → AUCUN compte', () => {
    const a = c.detectLbcAccount(AUTRUI, 'https://api.leboncoin.fr/api/dashboard/v1/search');
    dit(a === null, 'recherche dashboard écartée', a ? JSON.stringify(a) : 'null');
  });
  await essaie('un ACHETEUR n’est jamais pris (même depuis un endpoint moi)', () => {
    const a = c.detectLbcAccount(MESSAGES, 'https://api.leboncoin.fr/api/users/me/conversations');
    dit(a === null, 'aucun compte sur des messages', a ? JSON.stringify(a) : 'null');
  });

  console.log('\n── AUTO-NETTOYAGE : LES 8 COMPTES CAPTÉS À TORT SONT RETIRÉS DE lbc_accounts');
  // Base préseedée comme la sienne : SHOPCANCALE (linked_accounts) + 2 fiches
  // d'autrui (user-card, discovery). Une capture légitime déclenche le ménage.
  await essaie('storeLbcAccount purge les comptes de source « autrui », garde le sien', async () => {
    const seed = {
      lbc_accounts: { accounts: {
        '55': { id: '55', name: 'SHOPCANCALE', type: 'particulier', source: 'https://api.leboncoin.fr/api/authenticator/v1/users/me/linked_accounts' },
        '6002': { id: '6002', name: 'Miguel', type: 'pro', source: 'https://api.leboncoin.fr/api/discovery/category/53' },
        '6003': { id: '6003', name: 'Chloé', type: 'pro', source: 'https://api.leboncoin.fr/api/user-card/v2/6003/infos' },
      } } };
    const cc = faireCtx(BG_NEUF, seed);
    await cc.storeLbcAccount({ id: '55', name: 'SHOPCANCALE', type: 'particulier', source: 'https://api.leboncoin.fr/api/authenticator/v1/users/me/linked_accounts' });
    const w = cc.__ecrits.filter((r) => r.id === 'lbc_accounts').pop();
    const acc = (w && w.data && w.data.accounts) || {};
    const ids = Object.keys(acc).sort();
    dit(ids.length === 1 && ids[0] === '55', 'ne reste que le sien', 'restants=' + JSON.stringify(ids));
    dit(!acc['6002'] && !acc['6003'], 'Miguel & Chloé (fiches d’autrui) retirés');
  });

  console.log(ko === 0 ? '\nChaque compte capté est bien le SIEN — jamais une fiche d’autrui.' : '\n' + ko + ' contrôle(s) au rouge.');
  process.exit(ko === 0 ? 0 : 1);
})();
