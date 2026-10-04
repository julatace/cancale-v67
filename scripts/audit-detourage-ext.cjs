// ════════════════════════════════════════════════════════════════════════════
//  DÉTOURAGE PHOTOROOM CÔTÉ EXTENSION — `detourerPhotos` (5.156, 4 octobre)
//
//  Julien : « intègre l'API de Photoroom pour le détourage des photos avant
//  chaque poste ». Les photos de Leboncoin ET d'eBay passent toutes par
//  `photosEnOctets` : c'est là que le fond les détoure, selon le réglage de
//  l'app (`vrm_detourage`, ligne main). Chaque photo détourée COÛTE : la règle
//  doit donc être prouvée dans les deux sens — elle détoure quand on le lui
//  demande, et elle ne dépense RIEN dans tous les autres cas.
//
//  ⚠️ §4.10 : on EXÉCUTE le vrai `background.js` dans un `vm` et on COMPTE ce qui
//  part vers le serveur. Aucune fixture : des octets inventés, un faux serveur.
//  §6.1 : `--prouve` réaffaiblit la règle (filtre d'URL retiré, octets remplacés
//  même sur échec) et les contrôles correspondants doivent rougir.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path'), nodeCrypto = require('crypto');
const { metaVersData } = require('./bancs/_meta.cjs');
const racine = path.join(__dirname, '..');
let SRC = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const PROUVE = process.argv.includes('--prouve');
if (PROUVE) {
  // Réaffaiblir : (1) détourer n'importe quelle URL, (2) remplacer les octets même
  // quand le serveur refuse. Les deux sont des fautes qui coûtent (argent, photo).
  SRC = SRC.replace('if (!PHOTO_VINTED_CDN.test(String(p.url || \'\'))) {', 'if (false) {')
           .replace('const garde = (raison) => { liste[i] = Object.assign({}, p, { detoure: false, detourage: raison });',
                    'const garde = (raison) => { liste[i] = Object.assign({}, p, { b64: \'\', detoure: true, detourage: raison });');
}
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}${det ? ' — ' + det : ''}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const CDN = (i) => `https://images1.vinted.net/t/aa_${i}/f800/170000${i}.webp?s=abc`;
const AFFICHE = 'https://marketplace-web-assets.vinted.com/_next/static/media/meta-preview-image.123.jpg';
// Des octets d'image inventés : un en-tête JPEG puis un contenu propre à chaque URL.
const octets = (url) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('photo:' + url)]);
const sha256 = (buf) => nodeCrypto.createHash('sha256').update(buf).digest('hex');
const DETOUREE = (sha) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.from('detouree:' + sha)]);

// serveur : 'ok' · 'no-key' · 'plafond' · 'session' · 'p402' · 'panne-une' · 'rejette'
function faireCtx({ reglage = 'couverture', mainKO = false, session = true, serveur = 'ok', cache = new Set(), cdnKO = new Set() } = {}) {
  const j = { sondes: 0, envois: 0, shas: [], b64Envoyes: [], enVol: 0, maxEnVol: 0, appelsServeur: 0, diag: [] };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder, AbortController,
    crypto: nodeCrypto.webcrypto,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: '5.156.0' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } },
    },
    fetch: async (url, opts = {}) => {
      const u = metaVersData(String(url));
      const rep = (body, status = 200, type = 'application/json') => ({ ok: status < 400, status,
        json: async () => JSON.parse(typeof body === 'string' ? body : JSON.stringify(body)),
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
        arrayBuffer: async () => { const b = Buffer.isBuffer(body) ? body : Buffer.from(String(body)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); },
        headers: { get: () => type } });
      // Le réglage : la ligne main PROJETÉE (`vrm_detourage:data->vrm_detourage`).
      if (/app_data\?id=eq\.main/.test(u)) {
        if (mainKO) return rep('<html>522</html>', 522, 'text/html');
        return rep([reglage === 'ABSENT' ? { vrm_detourage: null } : { vrm_detourage: reglage }]);
      }
      if (/\/rest\/v1\//.test(u)) return rep('[]');
      // Le CDN de Vinted (et l'affiche générique du site).
      if (/vinted\.net|vinted\.com\/_next/.test(u)) {
        if (cdnKO.has(String(url))) return rep('', 403, 'text/html');
        return rep(octets(String(url)), 200, 'image/webp');
      }
      // NOTRE serveur.
      if (/vrm\.center\/api\/ai\?mode=detourage/.test(u)) {
        j.appelsServeur++;
        j.enVol++; j.maxEnVol = Math.max(j.maxEnVol, j.enVol);
        try {
          await new Promise((r) => setTimeout(r, 15));
          const corps = JSON.parse(opts.body || '{}');
          if (!/^Bearer /.test(String((opts.headers || {}).Authorization || ''))) return rep({ ok: false, reason: 'session' }, 401);
          if (corps.b64 == null) { j.sondes++; j.shas.push(corps.sha); } else { j.envois++; j.b64Envoyes.push(corps.b64); }
          if (serveur === 'rejette') throw new Error('AbortError');
          if (serveur === 'session') return rep({ ok: false, reason: 'session' }, 401);
          if (serveur === 'no-key') return rep({ ok: false, reason: 'no-key' }, 503);
          if (serveur === 'plafond') return rep({ ok: false, reason: 'plafond', plafond: 150 }, 429);
          if (cache.has(corps.sha)) return rep({ ok: true, hit: true, b64: DETOUREE(corps.sha).toString('base64'), type: 'image/jpeg', bytes: 30 });
          if (corps.b64 == null) return rep({ ok: true, hit: false });
          if (serveur === 'p402') return rep({ ok: false, reason: 'photoroom', status: 402 }, 402);
          // Le serveur recalcule l'empreinte : elle doit être celle des octets envoyés.
          if (sha256(Buffer.from(corps.b64, 'base64')) !== corps.sha) return rep({ ok: false, reason: 'sha' }, 400);
          if (serveur === 'panne-une' && j.envois === 2) return rep({ ok: false, reason: 'photoroom', status: 500 }, 502);
          cache.add(corps.sha);
          return rep({ ok: true, hit: false, b64: DETOUREE(corps.sha).toString('base64'), type: 'image/jpeg', bytes: 30, n: cache.size });
        } finally { j.enVol--; }
      }
      return rep('[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'background.js' });
  ctx.authToken = async () => (session ? { access_token: 'jeton-du-vendeur' } : null);
  ctx.noterDiag = async (k) => { j.diag.push(k); };
  ctx.__j = j;
  return ctx;
}
const origine = (url) => octets(url).toString('base64');

(async () => {
  if (PROUVE) console.log('⚠️  MODE --prouve : règle réaffaiblie, des contrôles doivent rougir.\n');
  const cinq = [CDN(1), CDN(2), CDN(3), CDN(4), CDN(5)];

  // ══ 1. ÉTEINT : aucune dépense, photos intactes ══
  await essaie('éteint', async () => {
    for (const [nom, opt] of [['réglage absent', { reglage: 'ABSENT' }], ['réglage « eteint »', { reglage: 'eteint' }], ['valeur inconnue', { reglage: 'oui' }], ['ligne main illisible (522)', { mainKO: true }]]) {
      const ctx = faireCtx(opt);
      const ph = await ctx.photosEnOctets(cinq, 12);
      dit(ctx.__j.appelsServeur === 0 && ph.length === 5 && ph.every((p, i) => p.b64 === origine(cinq[i]) && p.detoure === undefined),
        `${nom} ⇒ ZÉRO appel au détourage, photos d'origine intactes`, `appels=${ctx.__j.appelsServeur}`);
    }
  });

  // ══ 2. COUVERTURE : une seule photo, la première ══
  await essaie('couverture', async () => {
    const ctx = faireCtx({ reglage: 'couverture' });
    const ph = await ctx.photosEnOctets(cinq, 12);
    const j = ctx.__j;
    dit(j.sondes === 1 && j.envois === 1, 'couverture ⇒ UNE photo sondée, UNE envoyée', `sondes=${j.sondes} envois=${j.envois}`);
    dit(ph[0] && ph[0].detoure === true && ph[0].type === 'image/jpeg' && ph[0].b64 === DETOUREE(sha256(octets(cinq[0]))).toString('base64'),
      'la couverture revient détourée (JPEG, octets du serveur)');
    dit(ph.slice(1).every((p, i) => p.b64 === origine(cinq[i + 1]) && p.detoure === undefined), 'les quatre autres sont intactes et non marquées');
    dit(j.shas[0] === sha256(octets(cinq[0])), 'l\'empreinte envoyée est celle des octets D\'ORIGINE (SHA-256)');
    dit(j.b64Envoyes[0] === origine(cinq[0]), 'les octets envoyés sont ceux d\'origine');
  });

  // ══ 3. L'AFFICHE DU SITE n'est jamais envoyée ══
  await essaie('affiche', async () => {
    const ctx = faireCtx({ reglage: 'couverture' });
    const ph = await ctx.photosEnOctets([AFFICHE, CDN(1)], 12);
    dit(ctx.__j.appelsServeur === 0, 'couverture = affiche générique de Vinted ⇒ RIEN n\'est envoyé (on ne paie pas une affiche)', `appels=${ctx.__j.appelsServeur}`);
    dit(ph[0].b64 === origine(AFFICHE) && ph[0].detoure === false && ph[0].detourage === 'pas-une-photo', 'elle reste telle quelle, avec sa raison');
    const ctx2 = faireCtx({ reglage: 'toutes' });
    const ph2 = await ctx2.photosEnOctets([CDN(1), AFFICHE, CDN(2)], 12);
    dit(ctx2.__j.envois === 2 && !ctx2.__j.b64Envoyes.includes(origine(AFFICHE)), '« toutes » ⇒ les 2 vraies photos détourées, l\'affiche jamais envoyée', `envois=${ctx2.__j.envois}`);
    dit(ph2[0].detoure === true && ph2[2].detoure === true && ph2[1].detoure === false, 'chacune porte le bon état');
  });

  // ══ 4. TOUTES : jamais plus de 3 à la fois, ordre gardé ══
  await essaie('toutes', async () => {
    const huit = [1, 2, 3, 4, 5, 6, 7, 8].map(CDN);
    const ctx = faireCtx({ reglage: 'toutes' });
    const ph = await ctx.photosEnOctets(huit, 12);
    dit(ph.length === 8 && ph.every((p) => p.detoure === true), '« toutes » ⇒ les 8 photos détourées', `${ph.filter((p) => p.detoure).length}/8`);
    dit(ph.every((p, i) => p.url === huit[i]), 'l\'ordre des photos est gardé (la couverture reste la première)');
    dit(ctx.__j.maxEnVol <= 3, 'jamais plus de 3 envois en même temps à notre serveur', `max=${ctx.__j.maxEnVol}`);
  });

  // ══ 5. LE CACHE : une photo déjà détourée ne repart pas ══
  await essaie('cache', async () => {
    const cache = new Set([sha256(octets(CDN(1)))]);
    const ctx = faireCtx({ reglage: 'couverture', cache });
    const ph = await ctx.photosEnOctets(cinq, 12);
    dit(ctx.__j.sondes === 1 && ctx.__j.envois === 0, 'déjà détourée ⇒ la sonde seule, AUCUN octet envoyé', `envois=${ctx.__j.envois}`);
    dit(ph[0].detoure === true && ph[0].detourageCache === true, 'elle revient détourée, depuis le cache');
  });

  // ══ 6. TOUT CE QUI ÉCHOUE GARDE LA PHOTO D'ORIGINE ══
  await essaie('échecs', async () => {
    for (const [nom, opt, raison] of [
      ['clé Photoroom non posée (503)', { reglage: 'toutes', serveur: 'no-key' }, 'no-key'],
      ['plafond du mois atteint (429)', { reglage: 'toutes', serveur: 'plafond' }, 'plafond'],
      ['crédits Photoroom épuisés (402)', { reglage: 'toutes', serveur: 'p402' }, 'photoroom-402'],
      ['serveur injoignable', { reglage: 'toutes', serveur: 'rejette' }, 'delai'],
    ]) {
      const six = [1, 2, 3, 4, 5, 6].map(CDN);
      const ctx = faireCtx(opt);
      const ph = await ctx.photosEnOctets(six, 12);
      dit(ph.length === 6 && ph.every((p, i) => p.b64 === origine(six[i]) && p.detoure === false && p.detourage === raison),
        `${nom} ⇒ les 6 photos d'origine partent, raison « ${raison} »`, ph.map((p) => p.detourage).join(','));
      if (raison !== 'delai') dit(ctx.__j.appelsServeur <= 6, `${nom} ⇒ on n'insiste pas photo après photo`, `appels=${ctx.__j.appelsServeur}`);
    }
    const ctx = faireCtx({ reglage: 'couverture', session: false });
    const ph = await ctx.photosEnOctets(cinq, 12);
    dit(ctx.__j.appelsServeur === 0 && ph[0].b64 === origine(cinq[0]) && ph[0].detourage === 'session', 'extension non connectée à VRM ⇒ zéro appel, photo d\'origine, raison « session »');
    const ctxP = faireCtx({ reglage: 'toutes', serveur: 'panne-une' });
    const phP = await ctxP.photosEnOctets([1, 2, 3].map(CDN), 12);
    const rate = phP.filter((p) => p.detoure === false);
    dit(rate.length === 1 && rate[0].b64 === origine(rate[0].url) && phP.filter((p) => p.detoure === true).length === 2,
      'Photoroom en panne sur UNE photo ⇒ elle part d\'origine, les deux autres détourées');
  });

  // ══ 7. UNE PHOTO ILLISIBLE NE COÛTE RIEN ══
  await essaie('illisible', async () => {
    const ctx = faireCtx({ reglage: 'couverture', cdnKO: new Set([CDN(1)]) });
    const ph = await ctx.photosEnOctets(cinq, 12);
    dit(ph[0].erreur && ph[1].detoure === true && ctx.__j.envois === 1, 'couverture illisible sur le CDN ⇒ la première photo LISIBLE est détourée, une seule');
  });

  // ══ 8. eBAY en hérite (un seul propriétaire de la règle, §11) ══
  await essaie('ebay', async () => {
    const ctx = faireCtx({ reglage: 'couverture' });
    const ph = await ctx.photosPourEbay(cinq, 12);
    dit(ph[0].detoure === true && ctx.__j.envois === 1, 'les photos eBay passent par la MÊME règle (photosPourEbay)');
  });

  console.log(`\n${ok} contrôle(s) vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
