// ═══════════════════════════════════════════════════════════════════════════
// LE COMPTE LEBONCOIN CONNECTÉ — SUR LES FORMES RÉELLES MESURÉES LE 20 OCTOBRE
//        node scripts/audit-lbc-session.cjs  [--src chemin/background.js]
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « pour Leboncoin il capte pas les bonnes données ni le bon compte ».
// Mesuré (lecture seule, sa base) : deux comptes Leboncoin, un particulier (ses
// annonces de baskets) et un pro. Connecté sur le particulier, la base disait
// « le pro, particulier » :
//   · `members/me/account` = `{account:{account_id,type}, member:{account_id,
//     first_name, nickname:{value}, contact:{email}}}` — aucun couple id + nom
//     lisible : la session n'était jamais reconnue, « mes annonces » jamais
//     rangées sans référence VRM ;
//   · `users/me/linked_accounts` = `{linked_accounts:[{user_id, email,
//     display_name, is_business_user}]}` — les AUTRES comptes liés, et
//     `is_business_user` n'était pas lu (le pro rangé « particulier ») ;
//   · le compteur `messaging/proxy/api/hal/{userId}/counter` n'est relu que pour
//     le compte connecté — c'est lui qui dit la session.
// Ce contrôle EXÉCUTE le vrai `background.js` (vm, stockage et base à état),
// sur ces formes (identifiants et noms INVENTÉS), et juge ce qui est RANGÉ.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const iSrc = process.argv.indexOf('--src');
const SRC = fs.readFileSync(iSrc > 0 ? process.argv[iSrc + 1] : path.join(racine, 'vinted-sync-extension/background.js'), 'utf8');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = async (nom, fn) => { try { return await fn(); } catch (e) { dit(false, nom, 'a levé : ' + e.message); return null; } };

const PART = 'aaaa1111-0000-4000-8000-000000000001';   // le compte particulier (connecté)
const PRO = 'bbbb2222-0000-4000-8000-000000000002';    // le compte pro (lié)
const AUTRE = 'cccc3333-0000-4000-8000-000000000003';  // un vendeur quelconque

function faire(seed) {
  const base = Object.assign({}, seed || {});
  const local = {};
  const ecrits = [];
  const ecouteurs = [];
  const dual = (fn) => function (...a) { const cb = a[a.length - 1]; const v = fn(...(typeof cb === 'function' ? a.slice(0, -1) : a)); if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(f) { ecouteurs.push(f); } }, onMessageExternal: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, clear() {}, get: dual(() => null), onAlarm: { addListener() {} } },
      cookies: { get: dual(() => null), getAll: dual(() => []), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, onRemoved: { addListener() {} }, query: dual(() => []), sendMessage: dual(() => undefined) },
      storage: { local: {
        get: dual((k) => { const ks = k == null ? Object.keys(local) : Array.isArray(k) ? k : typeof k === 'string' ? [k] : Object.keys(k); const o = {}; for (const x of ks) if (x in local) o[x] = JSON.parse(JSON.stringify(local[x])); return o; }),
        set: dual((o) => { for (const k in o) local[k] = JSON.parse(JSON.stringify(o[k])); }),
        remove: dual((k) => { for (const x of (Array.isArray(k) ? k : [k])) delete local[x]; }),
      }, onChanged: { addListener() {} } },
    },
    fetch: async (url, opts = {}) => {
      const rep = (ok, body, status) => ({ ok, status: status || (ok ? 200 : 522), json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      const m = (opts.method || 'GET').toUpperCase();
      if (m === 'POST') { try { JSON.parse(opts.body || '[]').forEach((r) => { ecrits.push(r); base[r.id] = r.data; }); } catch (_) {} return rep(true, '', 201); }
      if (m !== 'GET') return rep(true, '[]');
      const mm = /id=eq\.([^&]+)/.exec(String(url));
      if (mm && base[decodeURIComponent(mm[1])] !== undefined) return rep(true, JSON.stringify([{ id: mm[1], data: base[decodeURIComponent(mm[1])] }]));
      return rep(true, '[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(SRC, ctx, { filename: 'background.js' });
  ctx.authToken = async () => ({ access_token: 'jeton_banc', user_id: 'vendeur_banc', expires_at: Date.now() + 3600e3 }); ctx.loadSession = ctx.authToken;
  const envoyer = (msg) => new Promise((res) => {
    let fini = false; const r = (v) => { if (!fini) { fini = true; res(v); } };
    let async_ = false;
    for (const f of ecouteurs) { try { const ret = f(msg, { tab: { id: 1, url: 'https://www.leboncoin.fr/' } }, r); if (ret === true) async_ = true; } catch (_) {} }
    setTimeout(() => r(undefined), async_ ? 3000 : 50);
  });
  return { ctx, base, local, ecrits, envoyer };
}

const LIES = JSON.stringify({ linked_accounts: [{ user_id: PRO, email: 'pro@ex.fr', display_name: 'BOUTIQUEPRO', is_business_user: true, profile_picture: { default: true }, unread_notifications: 0 }] });
const MEMBER = JSON.stringify({ account: { account_id: 'acc-1', type: 'private', status: 'active' }, member: { member_id: 'm-1', account_id: 'acc-1', first_name: 'J', last_name: 'F', contact: { email: 'part@ex.fr' }, nickname: { value: 'Particulier35' } } });
const CARTE = (id, name, type) => JSON.stringify({ user_id: id, name, account_type: type, total_ads: 10, store_id: 0, feedback: { overall_score: 1 } });
const MYADS = JSON.stringify({ ads: [
  { list_id: 701, subject: 'Adidas Spezial noir taille 38,5', price: [44], images: { urls: ['https://img.leboncoin.fr/a.jpg'] }, status: 'active' },
  { list_id: 702, subject: 'Salomon XT-6 marron taille 43,5', price: [99], status: 'active' },
] });
const relais = (env, url, body) => env.envoyer({ from: 'cancale-lbc', action: 'lbcRaw', url, body });
const compteur = (env, id) => env.envoyer({ from: 'cancale-lbc', action: 'lbcMsgCompteur', userId: id, unread: 0 });
const lies = (env) => env.envoyer({ from: 'cancale-lbc', action: 'lbcComptes', comptes: [{ id: PRO, name: 'BOUTIQUEPRO', pro: true }] });

(async () => {
  await essaie('comptes ambigus et ancien compte',async()=>{
    const env=faire();await compteur(env,PART);
    dit(!(await env.ctx.etatSite('https://www.leboncoin.fr/',2)).site?.id,'un autre onglet ne reprend pas le dernier compte global');
    await compteur(env,PRO);
    const etat=await env.ctx.etatSite('https://www.leboncoin.fr/',1);
    dit(!etat.site?.id&&etat.transport?.ambigue===true,'deux comptes dans le même onglet : aucun compte choisi');
    const avant=env.ecrits.length;
    await env.envoyer({from:'cancale-lbc',action:'lbcCapture',account:{id:AUTRE,name:'AUTRE',email:'a@exemple.test'},listings:[{id:'999',ref:'123',subject:'autrui'}]});
    dit(env.ecrits.length===avant,'un compte et une annonce du DOM ne sont pas intégrés sans preuve de session');
    dit(env.ctx.detectLbcAccount({buyer:{user_id:AUTRE,name:'Acheteur',email:'x@exemple.test'}},'https://api.leboncoin.fr/api/users/me/conversations')===null,'un acheteur avec email dans une conversation ne devient pas le compte courant');
  });
  await essaie('écriture de session refusée puis reprise',async()=>{
    const env=faire(),original=env.ctx.supabaseUpsert;
    env.ctx.supabaseUpsert=async()=>false;
    dit(await env.ctx.noterSessionLbc(PART)===false,'un envoi refusé reste un échec');
    dit(!env.local.vrmLbcSessionEcrit,'un envoi refusé ne bloque pas la session pendant six heures');
    env.ctx.supabaseUpsert=original;
    dit(await env.ctx.noterSessionLbc(PART)===true && env.base.lbc_accounts?.accounts?.[PART],'la capture suivante reprend et enregistre le compte');
  });
  console.log('── 1. LE COMPTE PRO LIÉ EST RANGÉ « PRO », ET N’EST PAS LA SESSION');
  await essaie('linked_accounts', async () => {
    const env = faire();
    await relais(env, 'https://api.leboncoin.fr/api/authenticator/v1/users/me/linked_accounts', LIES);
    const acc = ((env.base.lbc_accounts || {}).accounts || {})[PRO];
    dit(!!acc && acc.type === 'pro', 'is_business_user=true ⇒ « pro »', acc ? 'type=' + acc.type : 'absent');
    dit(!env.local.vrmLbcCompte, 'un compte LIÉ ne devient jamais « le compte connecté »', JSON.stringify(env.local.vrmLbcCompte || null));
  });

  console.log('\n── 2. LA SESSION SE LIT SUR LE COMPTEUR DE MESSAGERIE, LE NOM SUR SA FICHE (même id)');
  await essaie('session', async () => {
    const env = faire();
    await lies(env);
    await relais(env, 'https://api.leboncoin.fr/api/account/v2/members/me/account', MEMBER);
    await compteur(env, PART);
    const etat=await env.ctx.etatSite('https://www.leboncoin.fr/',1);
    dit(etat.site && etat.site.id===PART,'la carte reconnaît la session même avant de connaître son pseudo');
    const c = env.local.vrmLbcCompte;
    dit(!!c && c.v === 2 && c.id === PART, 'le compte connecté = celui du compteur', JSON.stringify(c || null));
    await relais(env, `https://api.leboncoin.fr/api/user-card/v2/${PART}/infos`, CARTE(PART, 'Particulier35', 'private'));
    const c2 = env.local.vrmLbcCompte || {};
    dit(c2.name === 'Particulier35' && c2.type === 'particulier', 'son nom et son type viennent de SA fiche (même id)', JSON.stringify(c2));
    const acc = ((env.base.lbc_accounts || {}).accounts || {})[PART] || null;
    dit(!!acc && acc.sessionAt && acc.name === 'Particulier35', 'rangé dans lbc_accounts avec la marque de session', JSON.stringify(acc));
    // La fiche d'un AUTRE id ne renomme jamais la session.
    await relais(env, `https://api.leboncoin.fr/api/user-card/v2/${AUTRE}/infos`, CARTE(AUTRE, 'Inconnu', 'pro'));
    dit((env.local.vrmLbcCompte || {}).name === 'Particulier35', 'la fiche d’un autre vendeur ne renomme pas la session');
    dit(!((env.base.lbc_accounts || {}).accounts || {})[AUTRE], 'et n’entre pas dans ses comptes');
  });

  console.log('\n── 3. UN COMPTEUR D’UN COMPTE LIÉ N’EST PAS LA SESSION');
  await essaie('compteur lié', async () => {
    const env = faire();
    await lies(env);
    await compteur(env, PRO);
    dit(!env.local.vrmLbcCompte, 'id présent dans les comptes liés ⇒ pas pris pour la session', JSON.stringify(env.local.vrmLbcCompte || null));
  });

  console.log('\n── 4. CHANGER DE COMPTE CHANGE LE COMPTE CONNECTÉ (le nom d’avant ne reste pas)');
  await essaie('bascule', async () => {
    const env = faire();
    await compteur(env, PART);
    await relais(env, `https://api.leboncoin.fr/api/user-card/v2/${PART}/infos`, CARTE(PART, 'Particulier35', 'private'));
    await env.envoyer({from:'cancale-lbc',action:'lbcTransport',capteur:false}); // nouveau document après changement de compte
    await compteur(env, PRO);
    const c = env.local.vrmLbcCompte || {};
    dit(c.id === PRO && c.name !== 'Particulier35', 'connecté sur l’autre compte : son id, pas l’ancien nom', JSON.stringify(c));
  });

  console.log('\n── 5. « MES ANNONCES » SONT RANGÉES ET TAGUÉES DU COMPTE CONNECTÉ');
  await essaie('myads', async () => {
    const env = faire();
    await compteur(env, PART);
    // 5.197 : la page joint le compte de SON compteur (même document).
    await env.envoyer({ from: 'cancale-lbc', action: 'lbcRaw', url: 'https://api.leboncoin.fr/api/adfinder/v2/myads', body: MYADS, session: PART });
    const items = Object.values(((env.base.lbc_listings || {}).items) || {});
    dit(items.length === 2 && items.every((i) => i.account === PART), 'ses 2 annonces sans référence VRM sont rangées sous SON compte', JSON.stringify(items.map((i) => [i.id, i.account])));
    // Sans compteur (session inconnue) : rien n'est deviné.
    const env2 = faire();
    await relais(env2, 'https://api.leboncoin.fr/api/adfinder/v2/myads', MYADS);
    dit(!env2.base.lbc_listings, 'session inconnue : rien n’est rangé (blanc plutôt que faux)');
  });

  console.log('\n── 6. UN COMPTE DONT LA SESSION A ÉTÉ VUE EST À LUI POUR LES FILES (même règle que l’app)');
  await essaie('estALui', async () => {
    const env = faire({
      lbc_accounts: { accounts: { [PART]: { id: PART, name: 'Particulier35', sessionAt: '2026-10-20T11:16:00Z', source: 'session:messagerie' } } },
      lbc_listings: { items: { '701': { id: '701', subject: 'Adidas', price: 44, account: PART }, '9': { id: '9', subject: 'Chalet', price: 9, account: AUTRE } } },
      lbc_ventes: { ventes: {} },
    });
    const r = await env.ctx.lireLbcAnnonces();
    const ids = (r.items || []).map((i) => i.id);
    dit(ids.length === 1 && ids[0] === '701', 'son annonce (compte de session) gardée, celle d’autrui ignorée', JSON.stringify(ids));
  });

  console.log(ko === 0 ? '\nLe compte connecté et ses annonces : lus par identité, jamais devinés.' : '\n' + ko + ' contrôle(s) au rouge.');
  process.exit(ko === 0 ? 0 : 1);
})();
