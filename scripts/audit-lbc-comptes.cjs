// ═══════════════════════════════════════════════════════════════════════════
// À QUI APPARTIENT UNE ANNONCE LEBONCOIN — LA BRIQUE DU MULTI-COMPTES
//        node scripts/audit-lbc-comptes.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « prépare une extension qui capte la plateforme, à quel compte ça
// appartient et le nom du compte, pour lier toutes les paires — un écosystème
// pour un vrai revendeur. » Il aura plusieurs comptes Leboncoin : sans savoir à
// QUI appartient chaque annonce, tout se mélange.
//
// Mesuré : `lbc_accounts` est VIDE — l'identité du compte connecté n'était jamais
// captée (elle vit dans une réponse API que l'extension relaie mais que le
// background ne minait pas). `detectLbcAccount` la lit maintenant, et
// `handleLbcRaw` tague chaque annonce de SON tableau de bord avec ce compte.
//
// Ce que ce contrôle EXÉCUTE (le vrai `background.js`, HEAD vs arbre, §6.1) :
//   1. un compte PARTICULIER (id + pseudo + email) est reconnu, type particulier ;
//   2. un compte PRO (store_id + raison sociale + siren) est reconnu, type pro ;
//   3. ⚠️ un ACHETEUR (id + pseudo, mais AUCUN email/siren) n'est PAS pris pour
//      le compte — mieux vaut un blanc qu'un faux (§5) : taguer une annonce du
//      mauvais compte serait pire que ne rien taguer ;
//   4. les annonces du tableau de bord sont TAGUÉES du compte connecté, et
//      écrites dans `lbc_accounts` ;
//   5. §6.1 : sur le code d'AVANT, AUCUNE annonce n'était taguée (0 compte).
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const racine = path.join(__dirname, '..');
const FICH = 'vinted-sync-extension/background.js';
const BG_NEUF = fs.readFileSync(path.join(racine, FICH), 'utf8');
let BG_VIEUX = ''; try { BG_VIEUX = cp.execSync('git show HEAD:' + FICH, { cwd: racine, encoding: 'utf8' }); } catch (_) {}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = async (nom, fn) => { try { return await fn(); } catch (e) { dit(false, nom, 'a levé : ' + e.message); return null; } };

const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
function faireCtx(SRC) {
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
      return rep(true, '[]'); // toute lecture de prev rend une ligne vide
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined; ctx.__ecrits = ecrits;
  vm.createContext(ctx); vm.runInContext(SRC, ctx, { filename: 'background.js' });
  return ctx;
}

// Le tableau de bord du vendeur : ses annonces (chemin PRO `Ads`) + l'objet du
// compte connecté dans la même réponse (comme une vraie réponse dashboard).
const DASH_PART = JSON.stringify({
  user: { user_id: 55, pseudo: 'julien35', email: 'julien@exemple.fr' },
  Ads: [{ Id: 1807, Status: 'active', Info: { Title: 'Nike air max VRM-401', Price: 99, URL: 'https://www.leboncoin.fr/ad/1807', CustomRef: '401' } }],
});
const DASH_PRO = JSON.stringify({
  account: { store_id: 88, company_name: 'Cancale Sneakers', siren: '123456789' },
  Ads: [{ Id: 42, Status: 'active', Info: { Title: 'Salomon XT-6 VRM-402', Price: 120, URL: 'https://www.leboncoin.fr/ad/42', CustomRef: '402' } }],
});
// Une conversation : un ACHETEUR (id + pseudo), rien de personnel. Ne doit JAMAIS
// être pris pour le compte connecté.
const MESSAGES = JSON.stringify({ conversations: [{ interlocutor: { user_id: 999, pseudo: 'acheteur12' } }, { interlocutor: { user_id: 1000, pseudo: 'client7' } }] });

(async () => {
  console.log('── DÉTECTION DU COMPTE CONNECTÉ (vrai background.js, arbre)');
  const c = faireCtx(BG_NEUF);

  await essaie('un compte PARTICULIER (id + pseudo + email) est reconnu', () => {
    const a = c.detectLbcAccount(JSON.parse(DASH_PART), 'https://api.leboncoin.fr/api/dashboard/v1/search');
    dit(!!a && a.id === '55' && a.name === 'julien35' && a.type === 'particulier' && a.platform === 'leboncoin',
      'id + nom + type + plateforme', a ? JSON.stringify(a) : 'null');
  });
  await essaie('un compte PRO (store_id + raison sociale + siren) est reconnu pro', () => {
    const a = c.detectLbcAccount(JSON.parse(DASH_PRO), 'https://api.leboncoin.fr/api/pro/x');
    dit(!!a && a.id === '88' && a.name === 'Cancale Sneakers' && a.type === 'pro', 'type pro', a ? JSON.stringify(a) : 'null');
  });
  await essaie('un ACHETEUR n’est PAS pris pour le compte (mieux vaut un blanc qu’un faux, §5)', () => {
    const a = c.detectLbcAccount(JSON.parse(MESSAGES), 'https://api.leboncoin.fr/api/messaging/threads');
    dit(a === null, 'aucun compte détecté sur des messages', a ? JSON.stringify(a) : 'null');
  });

  console.log('\n── LES ANNONCES DU TABLEAU DE BORD SONT TAGUÉES DU COMPTE (écrit en base)');
  await essaie('handleLbcRaw tague ses annonces et écrit lbc_accounts', async () => {
    const cc = faireCtx(BG_NEUF);
    await cc.handleLbcRaw('https://api.leboncoin.fr/api/dashboard/v1/search', DASH_PART);
    const list = cc.__ecrits.find((r) => r.id === 'lbc_listings');
    const accs = cc.__ecrits.find((r) => r.id === 'lbc_accounts');
    const items = list ? Object.values(list.data.items || {}) : [];
    const taguee = items.find((it) => it.account === '55');
    dit(!!taguee, 'l’annonce porte le compte connecté', taguee ? `account=${taguee.account} · ${taguee.accountName}` : 'aucune annonce taguée');
    dit(!!taguee && taguee.accountName === 'julien35' && taguee.platform === 'leboncoin', 'avec le NOM du compte et la plateforme');
    dit(!!accs && !!(accs.data.accounts && accs.data.accounts['55']), 'le compte est mémorisé dans lbc_accounts', accs ? JSON.stringify(accs.data.accounts['55']) : 'rien');
  });

  console.log('\n── §6.1 : SUR LE CODE D’AVANT, AUCUNE ANNONCE N’ÉTAIT TAGUÉE');
  await essaie('code d’avant : 0 annonce avec un compte', async () => {
    if (!BG_VIEUX) { dit(false, 'HEAD illisible'); return; }
    const cv = faireCtx(BG_VIEUX);
    await cv.handleLbcRaw('https://api.leboncoin.fr/api/dashboard/v1/search', DASH_PART);
    const list = cv.__ecrits.find((r) => r.id === 'lbc_listings');
    const items = list ? Object.values(list.data.items || {}) : [];
    const taguees = items.filter((it) => it.account).length;
    dit(taguees === 0, 'aucune annonce ne portait de compte avant', 'taguées=' + taguees + ' sur ' + items.length);
  });

  console.log(ko === 0 ? '\nChaque annonce sait à quel compte Leboncoin elle appartient.' : '\n' + ko + ' contrôle(s) au rouge.');
  process.exit(ko === 0 ? 0 : 1);
})();
