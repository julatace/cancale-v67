// ⚠️⚠️ CONTRÔLE PERMANENT — UNE LECTURE RATÉE NE DOIT PAS EFFACER UN COMPTE.
//
// `captureDomain` efface la ligne `vinted_accounts` d'un compte quand il est
// dans la liste noire ET qu'il n'a pas été réautorisé. Ces deux listes se
// lisaient avec `res.ok ? … : []` — un 522 devenait donc « liste vide », et le
// résultat était MIS EN CACHE (5 min / 60 s) comme une vraie mesure.
//
// Deux conséquences réelles, opposées :
//   · liste noire lue vide  → un compte supprimé définitivement se fait
//     re-capter (le cas `shop_cancale`, « il revenait tout le temps ») ;
//   · contre-ordre lu vide  → un compte qu'il vient de RÉAUTORISER est traité
//     comme encore supprimé : **sa ligne est effacée**, ses jetons partent, et
//     il faut repasser sur Vinted. C'est « l'extension ne veut pas renvoyer mes
//     nouveaux comptes », déclenché par 60 secondes de lecture ratée.
//
// Ce script exécute le VRAI `captureDomain()` dans un `vm`, avec de vrais
// cookies simulés, et regarde si un DELETE part.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

const UID = '9001';
// Un jeton dont la charge dit `account_id` — c'est tout ce que lit `jwtPayload`.
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const JETON = 'x.' + b64u({ account_id: Number(UID) }) + '.y';

// `etat` : 'ok' (les deux listes se lisent) · 'listesKO' (elles ne répondent pas)
function ctxAvec(etat, noirs, rallumes) {
  const appels = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: {
        get: (q, cb) => { const v = { access_token_web: JETON, refresh_token_web: 'r', anon_id: 'a' }[q.name] || null; const r = v ? { value: v } : null; if (cb) cb(r); return Promise.resolve(r); },
        getAll: dual([]), onChanged: { addListener() {} },
      },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } },
    },
    fetch: async (url, opts = {}) => {
      const u = String(url); const m = (opts.method || 'GET').toUpperCase();
      appels.push(m + ' ' + u.replace(/^https?:\/\/[^/]+/, ''));
      const j = (d) => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d), headers: { get: () => 'application/json' } });
      const html522 = { ok: false, status: 522, json: async () => { throw new Error('HTML'); }, text: async () => '<html>522</html>', headers: { get: () => 'text/html' } };
      if (/vrm_blocked_accounts/.test(u)) return etat === 'listesKO' ? html522 : j([{ data: { uids: noirs, logins: noirs.map(() => 'compte') } }]);
      // ⚠️ `rallumesKO` : la liste noire se lit, le CONTRE-ORDRE non. C'est le
      //    cas asymétrique — et c'est LUI qui supprime.
      if (/panel_accounts_off/.test(u)) return (etat === 'listesKO' || etat === 'rallumesKO') ? html522 : j([{ data: Object.fromEntries(rallumes.map(k => [k, false])) }]);
      if (m === 'DELETE') return { ok: true, status: 204, json: async () => ({}), text: async () => '', headers: { get: () => '' } };
      if (m === 'POST') return { ok: true, status: 201, json: async () => ({}), text: async () => '', headers: { get: () => '' } };
      return j([]);
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'background.js' });
  return { ctx, appels };
}
const aEfface = (appels) => appels.some(a => a.startsWith('DELETE') && /vinted_accounts/.test(a));

(async () => {
  // 1. LE CAS QUI DÉTRUIT : les deux listes ne répondent pas.
  {
    const { ctx, appels } = ctxAvec('listesKO', [], []);
    await ctx.captureDomain('www.vinted.fr');
    dit(!aEfface(appels), 'listes illisibles : la ligne du compte n\'est PAS effacée',
      aEfface(appels) ? 'un DELETE part sur une lecture ratée — ses jetons sautent' : '');
  }
  // 2. ET L'AUTRE SENS : quand on SAIT, la règle s'applique toujours.
  {
    const { ctx, appels } = ctxAvec('ok', [UID], []);
    await ctx.captureDomain('www.vinted.fr');
    dit(aEfface(appels), 'compte vraiment supprimé : la ligne est bien effacée',
      aEfface(appels) ? '' : 'la règle ne s\'applique plus du tout');
  }
  // 3. LE CONTRE-ORDRE : réautorisé explicitement → on n'efface pas, on capte.
  {
    const { ctx, appels } = ctxAvec('ok', [UID], [UID]);
    await ctx.captureDomain('www.vinted.fr');
    dit(!aEfface(appels), 'compte réautorisé : on ne l\'efface pas',
      aEfface(appels) ? 'le contre-ordre est ignoré' : '');
    dit(appels.some(a => a.startsWith('POST') && /vinted_accounts/.test(a)),
      'et il est bien re-capté', appels.filter(a => a.startsWith('POST')).slice(0, 2).join(' | ') || 'aucune écriture');
  }
  // 4. ⚠️⚠️ LE VRAI CAS DESTRUCTIF, ET IL EST ASYMÉTRIQUE.
  //    Mon premier jet faisait échouer les DEUX listes à la fois : le compte
  //    n'était alors pas dans la liste noire non plus, donc aucun DELETE — le
  //    contrôle passait au vert sur le code fautif. Ce qui supprime, c'est
  //    « liste noire lue, contre-ordre PAS lu » : le compte réautorisé compte
  //    comme encore supprimé, et sa ligne part. Un contrôle qui ne reproduit
  //    pas le cas ne prouve rien (§6).
  {
    const { ctx, appels } = ctxAvec('rallumesKO', [UID], [UID]);
    await ctx.captureDomain('www.vinted.fr');
    dit(!aEfface(appels), 'contre-ordre illisible : le compte réautorisé garde ses jetons',
      aEfface(appels) ? 'sa ligne est effacée parce qu\'une lecture de 60 s a raté' : '');
  }
  // 5. UN ÉCHEC NE DOIT PAS ÊTRE MIS EN CACHE comme une mesure.
  {
    const { ctx, appels } = ctxAvec('listesKO', [], []);
    await ctx.captureDomain('www.vinted.fr');
    const n1 = appels.filter(a => /vrm_blocked_accounts/.test(a)).length;
    await ctx.captureDomain('www.vinted.fr');
    const n2 = appels.filter(a => /vrm_blocked_accounts/.test(a)).length;
    dit(n2 > n1, 'une lecture ratée n\'est pas gardée 5 minutes comme un résultat',
      n2 > n1 ? `relue (${n1} → ${n2})` : 'l\'échec a été mis en cache : 5 minutes de captures décidées sur du vide');
  }

  console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nAucun compte n\'est effacé sur une lecture ratée.');
  process.exit(ko ? 1 : 0);
})();
