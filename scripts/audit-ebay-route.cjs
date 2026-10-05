// ════════════════════════════════════════════════════════════════════════════
//  LA ROUTE eBAY, EXÉCUTÉE : qui peut piloter le compte eBay de Julien ?
//        node scripts/audit-ebay-route.cjs [--src dossier]
//
//  Mesuré le 5 octobre : `/api/ebay` n'exigeait AUCUNE session, et le compte
//  eBay de Julien est connecté en production (une ligne `ebay_tokens` avec son
//  jeton de renouvellement). N'importe qui sur Internet pouvait donc :
//    · lister ses commandes eBay (avec les acheteurs), lire ses finances ;
//    · publier ou modifier une annonce sur SON compte eBay ;
//    · ouvrir lui-même la page de consentement d'eBay (l'adresse ne contient
//      rien de secret), s'y connecter avec SON compte, et le retour rangeait ce
//      jeton à la place de celui de Julien : ses publications partaient alors
//      sur le compte d'un inconnu.
//
//  Le banc lance la VRAIE route, avec une fausse base, un faux eBay et un faux
//  service d'identité, et compte ce qui part chez eBay. Il vérifie les deux
//  sens : le propriétaire connecté pilote toujours eBay, et une connexion qu'il
//  a lui-même demandée aboutit.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const J = '11111111-1111-1111-1111-111111111111';   // propriétaire de l'installation
const B = '22222222-2222-2222-2222-222222222222';   // un autre vendeur
// Un JWT a trois morceaux : le contrôle de forme du serveur l'exige.
const JWT_J = 'eyJh.jeton-de-J.sig', JWT_B = 'eyJh.jeton-de-B.sig';

process.env.VRM_OWNER_UID = J;
process.env.EBAY_APP_ID = 'app-de-banc';
process.env.EBAY_CERT_ID = 'secret-de-banc';
process.env.EBAY_RUNAME = 'runame-de-banc';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';

const journal = [];       // ce qui part chez eBay, ce qui s'écrit en base
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  const m = (opts.method || 'GET').toUpperCase();
  if (u.includes('/auth/v1/user')) {
    const a = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '');
    if (a === 'Bearer ' + JWT_J) return rep({ id: J, email: 'j@exemple.test' });
    if (a === 'Bearer ' + JWT_B) return rep({ id: B, email: 'b@exemple.test' });
    return rep({ msg: 'invalid' }, 401);
  }
  if (u.includes('ebay.com')) {
    journal.push({ ou: 'ebay', m, u: u.replace(/\?.*$/, '') });
    if (u.includes('/identity/v1/oauth2/token')) return rep({ access_token: 'at-banc', expires_in: 7200, refresh_token: 'rt-banc', refresh_token_expires_in: 47304000 });
    return rep({ orders: [], inventoryItems: [], total: 0 });
  }
  if (u.includes('/rest/v1/')) {
    if (m !== 'GET') { journal.push({ ou: 'base', m, u: decodeURIComponent(u), corps: String(opts.body || '') }); return rep('', 201); }
    if (u.includes('ebay_tokens')) return rep([{ refresh_token: 'rt-existant' }]);
    if (/select=owner&limit=1/.test(u)) return rep([{ owner: J }]);
    return rep([]);
  }
  return rep({});
};
const faireRes = () => {
  const x = { code: null, corps: null, entetes: {} };
  x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; };
  x.setHeader = (k, v) => { x.entetes[String(k).toLowerCase()] = v; }; x.end = () => x; return x;
};

(async () => {
  let route;
  await essaie('chargement', async () => { route = await import('file://' + path.join(RACINE, 'api', 'ebay.js')); });
  if (!route) { console.log('\n❌ audit-ebay-route : la route n\'a pas pu être chargée'); process.exit(1); }
  const app = async (jwt, corps) => {
    journal.length = 0;
    const res = faireRes();
    await route.default({ method: 'POST', query: {}, headers: jwt ? { authorization: 'Bearer ' + jwt } : {}, body: corps }, res);
    return { code: res.code, corps: res.corps, journal: journal.slice() };
  };
  const retourEbay = async (query) => {
    journal.length = 0;
    const res = faireRes();
    await route.default({ method: 'GET', query: { mode: 'callback', ...query }, headers: {} }, res);
    return { code: res.code, loc: res.entetes.location || '', journal: journal.slice() };
  };
  const chezEbay = (j) => j.filter((x) => x.ou === 'ebay');
  const ecritJetons = (j) => j.some((x) => x.ou === 'base' && /ebay_tokens|rt-banc/.test(x.u + ' ' + x.corps));

  // ── 1. Les actions : session obligatoire, propriétaire seulement ────────────
  for (const action of ['sync', 'finances', 'publish', 'revise']) {
    await essaie('sans session : ' + action, async () => {
      const o = await app('', { action, item: { title: 'x' }, itemId: '1', price: '10' });
      dit(o.code === 401 && chezEbay(o.journal).length === 0,
        `sans session, « ${action} » est refusé et rien ne part chez eBay`,
        `HTTP ${o.code} · ${chezEbay(o.journal).length} appel(s) eBay`);
    });
  }
  await essaie('autre vendeur', async () => {
    const o = await app(JWT_B, { action: 'sync' });
    dit(o.code === 403 && chezEbay(o.journal).length === 0,
      "un autre vendeur connecté ne pilote pas le compte eBay de l'installation",
      `HTTP ${o.code} · ${chezEbay(o.journal).length} appel(s) eBay`);
  });
  await essaie('jeton falsifié', async () => {
    const o = await app('eyJh.faux.sig', { action: 'finances' });
    dit(o.code === 401 && chezEbay(o.journal).length === 0, 'un jeton que le service d\'identité ne reconnaît pas est refusé', `HTTP ${o.code}`);
  });
  // L'autre sens : le propriétaire connecté pilote toujours eBay.
  await essaie('propriétaire', async () => {
    const o = await app(JWT_J, { action: 'status' });
    dit(o.code === 200 && o.corps && o.corps.ok && o.corps.connected === true,
      "l'autre sens : le propriétaire connecté voit son compte eBay relié", `HTTP ${o.code} ${JSON.stringify(o.corps)}`);
  });

  // ── 2. Le retour de consentement : seulement s'il l'a demandé ──────────────
  await essaie('retour sans state', async () => {
    const o = await retourEbay({ code: 'code-d-un-inconnu' });
    dit(chezEbay(o.journal).length === 0 && !ecritJetons(o.journal),
      "un retour de consentement SANS demande signée n'échange ni ne range aucun jeton",
      `${chezEbay(o.journal).length} appel(s) eBay · jetons écrits : ${ecritJetons(o.journal)}`);
  });
  await essaie('retour state falsifié', async () => {
    const o = await retourEbay({ code: 'code-d-un-inconnu', state: 'vrm' });
    const o2 = await retourEbay({ code: 'code-d-un-inconnu', state: 'mg0abcd.' + '0'.repeat(40) });
    dit(chezEbay(o.journal).length === 0 && chezEbay(o2.journal).length === 0,
      'un state inventé (« vrm », ou une signature au hasard) est refusé',
      `${chezEbay(o.journal).length + chezEbay(o2.journal).length} appel(s) eBay`);
  });
  let etat = '';
  await essaie('demande du propriétaire', async () => {
    const o = await app(JWT_J, { action: 'authurl', state: 'vrm' });
    const url = (o.corps && o.corps.url) || '';
    etat = (/[?&]state=([^&]+)/.exec(url) || [])[1] || '';
    etat = decodeURIComponent(etat);
    dit(o.code === 200 && etat && etat !== 'vrm', "la demande de consentement porte un state fabriqué par le SERVEUR (pas celui du navigateur)", etat || url);
  });
  await essaie('retour valide', async () => {
    const o = await retourEbay({ code: 'code-de-julien', state: etat });
    dit(chezEbay(o.journal).some((x) => /oauth2\/token/.test(x.u)) && /ebay=connecte/.test(o.loc),
      "l'autre sens : la connexion qu'il a lui-même demandée aboutit", `${o.loc} · ${chezEbay(o.journal).length} appel(s) eBay`);
  });
  await essaie('retour expiré', async () => {
    const vrai = Date.now;
    try {
      Date.now = () => vrai() + 31 * 60 * 1000;
      const o = await retourEbay({ code: 'code-de-julien', state: etat });
      dit(chezEbay(o.journal).length === 0, 'une demande de plus de 30 minutes ne sert plus', `${chezEbay(o.journal).length} appel(s) eBay`);
    } finally { Date.now = vrai; }
  });

  console.log(ko ? `\n❌ audit-ebay-route : ${ko} rouge(s), ${ok} vert(s)`
                 : `\n✅ audit-ebay-route : ${ok} contrôles — seul le propriétaire connecté pilote le compte eBay`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ audit-ebay-route est tombé :', e && e.message); process.exit(1); });
