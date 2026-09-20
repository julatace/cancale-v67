// ═══════════════════════════════════════════════════════════════════════════
// LE CATALOGUE LEBONCOIN — SES CODES EXACTS, ET LE BRUIT QUI LES ÉVINÇAIT
//        node scripts/audit-lbc-catalogue.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien demande « les catégories au bon endroit, le prix, tout paramétré pour
// l'annonce ». Mettre une catégorie au bon endroit suppose de connaître le CODE
// que Leboncoin attend (`{value,label}`), pas son libellé.
//
// ⚠️ MESURÉ LE 17 SEPTEMBRE sur sa vraie base, `lbc_recon.samples` — six places,
//    prises en ordre d'arrivée :
//      api.leboncoin.fr/…/v7/fdata          9 000 octets  ← COUPÉ
//      /_next/data/…/nouveautes.json        9 000
//      /_next/data/…/my-searches.json       9 000
//      fast.nexx360.io/booster              9 000  ← pas Leboncoin
//      ib.adnxs.com/openrtb2/prebidjs       9 000  ← pas Leboncoin
//      hbopenbid.pubmatic.com/translator    7 119  ← pas Leboncoin
//    **Trois sur six sont des enchères publicitaires** : elles passent le filtre
//    « ça parle d'annonces » justement parce qu'une enchère parle d'« ads », et
//    elles évincent les réponses de Leboncoin — les seules qui servent. Et
//    `fforms` (l'autre endpoint du dépôt) est dans `lbc_recon.paths` — donc VU —
//    sans avoir jamais eu d'échantillon.
//
// Ce que ce contrôle exige, et c'est la RÈGLE, pas l'orthographe :
//   1. une réponse d'un TIERS ne part pas dans sa base ;
//   2. le catalogue arrive ENTIER (pas 9 000 caractères) ;
//   3. il a sa PROPRE place : un second endpoint n'écrase pas le premier, et le
//      flot d'annonces ne peut pas l'évincer ;
//   4. ⚠️ l'autre sens — *ne rien relayer du tout* passerait les trois premiers :
//      une vraie réponse d'annonces doit continuer de partir ;
//   5. une lecture ratée n'écrit pas (« rien lu » ne vaut pas « rien ») ;
//   6. et on DIT quand le corps a été coupé : la moitié d'un catalogue a l'air
//      d'un catalogue, et l'analyser en le croyant entier serait promettre ce
//      qu'on n'a pas mesuré.
const { chromium } = require(require('path').join(__dirname, '..', 'node_modules', 'playwright'));
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const INJ = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'lbc-inject.js'), 'utf8');
const BG = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
// ⚠️ UN AUDIT NE MEURT PAS, IL RAPPORTE (septième rappel dans ce dépôt) : ce qui
//    lève devient un contrôle ROUGE, et le bilan s'imprime quand même.
const essaie = async (nom, fn) => { try { return await fn(); } catch (e) { dit(false, nom, 'a levé : ' + e.message); return null; } };

// Le vrai vocabulaire d'attributs de Leboncoin, dans la forme MESURÉE le
// 13 septembre sur sa base (`features.<nom>.values.simpleData[{value,label}]`).
// On le gonfle au-delà de l'ancien plafond de 9 000 pour que la coupe se VOIE :
// un banc qui ne sert pas le bon ORDRE DE GRANDEUR mesure une fiction (§6.3).
const CATALOGUE = JSON.stringify({
  features: {
    shoes_brand: { values: { type: 'simple', simpleData: Array.from({ length: 900 }, (_, i) => ({ value: 'marque' + i, label: 'Marque ' + i })) } },
    shoe_size: { values: { type: 'simple', simpleData: [{ value: '40', label: '40' }, { value: '41', label: '41' }] } },
    item_condition: { values: { type: 'simple', simpleData: [{ value: '2', label: 'Très bon état' }] } },
  },
});
const FFORMS = JSON.stringify({ forms: { 'shoes': { fields: ['subject', 'body', 'price', 'shoes_brand'] } } });
// Une enchère publicitaire, dans la FORME MESURÉE dans sa base (openrtb2 :
// `{id, cur, seatbid:[{bid:[{price, adm}]}]}`).
// ⚠️ ET C'EST LE PIÈGE QUE MON PREMIER JET AVAIT : un corps d'enchère inventé ne
//    contient aucun des mots que le filtre « ça parle d'annonces » cherche —
//    il n'était donc PAS relayé sur le code d'avant, et le contrôle passait
//    VERT SUR LE DÉFAUT. Mesuré sur la vraie ligne : c'est `/ads` (l'adresse de
//    la créative, au-delà du 9 000ᵉ caractère) qui fait passer la réponse de
//    `pubmatic`. On sert donc une créative qui porte cette adresse.
const PUB = JSON.stringify({
  id: '947d9d27', cur: 'USD',
  seatbid: [{ seat: '20092', bid: [{ id: '300BA600', price: 0.16, adm: '<a href="https://cdn.exemple.test/ads/creative.png"><img src="https://cdn.exemple.test/ads/c.png"></a>' }] }],
});
// Une VRAIE réponse d'annonces Leboncoin : elle doit continuer de passer.
const ANNONCES = JSON.stringify({ ads: [{ list_id: 991, subject: 'Salomon XT-6 VRM-401', price: [99], body: 'Réf. VRM-401' }] });

(async () => {
  console.log('── CE QUI PART DE LA PAGE (le vrai `lbc-inject.js`, dans un vrai navigateur)');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const pg = await b.newPage();
  // On sert la page SOUS LE VRAI NOM D'HÔTE : `location.origin` décide du sort
  // des adresses relatives, et Leboncoin en utilise (`/_next/data/…`).
  // ⚠️ §6.3 DANS MON PROPRE BANC : servir la page en `text/html` pour TOUT le
  //    domaine faisait retomber l'appel relatif `/api/discovery/…` sur du HTML,
  //    que `handle` écarte à raison — et le contrôle « l'autre sens » sortait
  //    rouge sur un code intact. On sert la FORME que la vraie page sert.
  //    ⚠️ Et §6.6 : **Playwright prend la DERNIÈRE route enregistrée en premier**.
  //    Le fourre-tout va donc AVANT la route précise, sinon il l'avale.
  await pg.route('https://www.leboncoin.fr/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>lbc</title></head><body></body></html>' }));
  await pg.route('https://www.leboncoin.fr/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: ANNONCES }));
  await pg.route('https://api.leboncoin.fr/**', (r) => {
    const u = r.request().url();
    r.fulfill({ status: 200, contentType: 'application/json', body: /fforms/.test(u) ? FFORMS : CATALOGUE });
  });
  await pg.route('https://ib.adnxs.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: PUB }));
  // ⚠️ Enregistrées EN DERNIER (§6.6 : Playwright prend la dernière route d'abord)
  //    pour gagner sur `/api/**`. Le bordereau d'une vente Leboncoin = un PDF ;
  //    un refus = un 403. C'est exactement ce que le mouchard doit distinguer.
  await pg.route('**/api/vrmtest/label/**', (r) => r.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 faux bordereau' }));
  await pg.route('**/api/vrmtest/refuse', (r) => r.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"nope"}' }));
  await pg.goto('https://www.leboncoin.fr/deposer-une-annonce');
  await pg.evaluate(`window.__vus = []; window.addEventListener('message', (e) => { const d = e.data; if (d && d.__tag === 'CANCALE_LBC') window.__vus.push({ kind: d.kind, url: d.url, len: (d.body || '').length, coupe: !!d.coupe, paths: d.paths || null }); });`);
  await pg.evaluate(INJ);
  await pg.evaluate(`(async () => {
    await fetch('https://api.leboncoin.fr/api/frontend/v1/data/v7/fdata').then(r => r.text());
    await fetch('https://api.leboncoin.fr/api/frontend/v1/data/v5/fforms').then(r => r.text());
    await fetch('https://ib.adnxs.com/openrtb2/prebidjs').then(r => r.text());
    await fetch('/api/discovery/category/53').then(r => r.text()).catch(() => {});
    await fetch('https://api.leboncoin.fr/api/vrmtest/label/9182734655').then(r => r.text()).catch(() => {});
    await fetch('https://api.leboncoin.fr/api/vrmtest/refuse').then(r => r.text()).catch(() => {});
    await fetch('https://api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions/778899').then(r => r.text()).catch(() => {});
  })()`).catch(() => {});
  await pg.waitForTimeout(600);
  const vus = await pg.evaluate('window.__vus');

  const tiers = vus.filter((v) => /adnxs|nexx360|pubmatic/.test(v.url || ''));
  dit(tiers.length === 0, 'une enchère publicitaire ne part PAS dans sa base',
    tiers.length ? `${tiers.length} relayée(s) : ${tiers.map((t) => t.kind).join(', ')}` : '');

  const cat = vus.filter((v) => v.kind === 'lbccatalogue');
  dit(cat.length === 2, 'les DEUX endpoints du catalogue sont relayés (fdata + fforms)',
    `relayés : ${cat.map((c) => (c.url.match(/(fdata|fforms)/) || ['?'])[0]).join(', ') || 'aucun'}`);
  const fdata = cat.find((c) => /fdata/.test(c.url));
  dit(!!fdata && fdata.len === CATALOGUE.length,
    'le catalogue part ENTIER, pas coupé à 9 000 caractères',
    fdata ? `${fdata.len} sur ${CATALOGUE.length}` : 'jamais relayé');
  dit(!!fdata && fdata.coupe === false, 'et il dit qu\'il n\'a PAS été coupé', fdata ? `coupe=${fdata.coupe}` : '');

  // ⚠️ L'AUTRE SENS : ne rien relayer du tout passerait tout ce qui précède.
  const brutes = vus.filter((v) => v.kind === 'lbcraw');
  dit(brutes.length >= 1, 'et une VRAIE réponse d\'annonces Leboncoin passe toujours',
    `${brutes.length} relayée(s)`);

  // ── LA VENTE LEBONCOIN EST RELAYÉE POUR ÊTRE CAPTÉE (comme sur Vinted)
  //    Sur le code d'avant, une transaction ne matchait ni AD_HINT ni
  //    ACCOUNT_HINT : son corps ne partait PAS, et sa vente était perdue pour
  //    l'analyse (comme le dépôt qu'on avait jeté). Elle part maintenant dans
  //    son propre kind `lbcvente` — jamais confondue avec une annonce.
  const ventes = vus.filter((v) => v.kind === 'lbcvente');
  dit(ventes.length >= 1 && /transactions\/778899/.test((ventes[0] || {}).url || ''),
    'une transaction (vente/livraison) est relayée comme `lbcvente`',
    ventes.length ? String(ventes[0].url).replace(/^.*leboncoin\.fr/, '') : 'AUCUNE (code d\'avant : ni AD_HINT ni ACCOUNT_HINT ⇒ perdue)');
  dit(!ventes.some((v) => v.kind === 'lbcraw') && !brutes.some((v) => /transactions/.test(v.url || '')),
    'et jamais mélangée au flot d\'annonces (`lbcraw`)');

  // ── LE MOUCHARD DE CHEMINS RECONNAÎT LE BORDEREAU (comme sur Vinted)
  //    Sur le code d'AVANT, un chemin vu était nu (`host/path`) : impossible de
  //    savoir lequel est le PDF de l'étiquette. Il porte maintenant méthode +
  //    statut + type. Le flush est sur un intervalle de 4 s → on l'attend.
  console.log('\n── LE MOUCHARD RECONNAÎT LE BORDEREAU : méthode + statut + type');
  await pg.waitForTimeout(4300);
  const vusP = await pg.evaluate('window.__vus');
  const chemins = vusP.filter((v) => v.kind === 'lbcpaths').flatMap((v) => v.paths || []);
  dit(chemins.some((p) => /label\/\{id\}/.test(p) && /\[pdf\]/.test(p) && /→\s*200/.test(p)),
    'un bordereau (GET → 200 [pdf]) est reconnaissable dans les chemins vus',
    'chemins pdf : ' + (chemins.filter((p) => /\[pdf\]/.test(p)).join(' · ') || 'AUCUN (code d\'avant : chemin nu, sans type ni statut)'));
  dit(chemins.some((p) => /refuse/.test(p) && /→\s*403/.test(p)),
    'un refus (→ 403) se distingue d\'un succès',
    'chemins en échec : ' + (chemins.filter((p) => /→\s*4\d\d/.test(p)).join(' · ') || 'AUCUN'));
  dit(chemins.some((p) => /^GET\s/.test(p)) ,
    'la méthode est portée (un GET de lecture ≠ un POST qui modifie)',
    (chemins[0] || '(aucun chemin)'));
  dit(!chemins.some((p) => /adnxs/.test(p)),
    'le bruit publicitaire en 200/json n\'évince PAS les chemins qui servent',
    chemins.filter((p) => /adnxs/.test(p)).join(' · ') || 'aucun tiers dans les chemins');
  dit(!JSON.stringify(chemins).includes('9182734655'),
    'aucun identifiant brut ne fuite : il devient {id}',
    chemins.find((p) => /9182734655/.test(p)) || 'normalisé');

  console.log('\n── LE FORMULAIRE DE DÉPÔT EST **DYNAMIQUE** — on lit la CONFIG, pas le DOM');
  await essaie('la config du dépôt', async () => {
    // ⚠️⚠️ MESURÉ LE 17 SEPTEMBRE dans ses `lbc_recon.paths`, et ça change tout :
    //    `api/adsubmit/dynamic-deposit/config`, `api/ad-prediction/v2/public/adparams`,
    //    `api/consumergoods/proxy/v2/pages/ad-submit`, `…/options.json`,
    //    `api/pintad/v1/public/upload/image`, `api/adsubmit/v2/classifieds`.
    //    Le formulaire n'est pas écrit en dur : il est CONSTRUIT à partir d'une
    //    config renvoyée par l'API, et elle change avec la catégorie — c'est
    //    mot pour mot « c'est différent pour chaque annonce ».
    const CONFIG = JSON.stringify({ steps: [{ id: 'category', fields: [{ name: 'category_id', type: 'select', required: true }] },
      { id: 'attributes', fields: [{ name: 'brand', type: 'select', values: [{ value: 'nike', label: 'Nike' }] }, { name: 'shoe_size', type: 'select' }, { name: 'item_condition', type: 'select' }] },
      { id: 'photos', fields: [{ name: 'images', type: 'file', max: 10 }] },
      { id: 'price', fields: [{ name: 'price', type: 'number', prefilled: true }] }] });
    const pg2 = await b.newPage();
    await pg2.route('https://www.leboncoin.fr/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>lbc</title></head><body></body></html>' }));
    await pg2.route('https://api.leboncoin.fr/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: CONFIG }));
    await pg2.goto('https://www.leboncoin.fr/deposer-une-annonce');
    await pg2.evaluate(`window.__vus = []; window.addEventListener('message', (e) => { const d = e.data; if (d && d.__tag === 'CANCALE_LBC') window.__vus.push({ kind: d.kind, url: d.url, len: (d.body || '').length, cles: d.cles || null }); });`);
    await pg2.evaluate(INJ);
    // La page charge sa config, puis SOUMET l'annonce (avec du contenu réel).
    await pg2.evaluate(`(async () => {
      await fetch('https://api.leboncoin.fr/api/adsubmit/dynamic-deposit/config').then(r => r.text());
      await fetch('https://api.leboncoin.fr/api/ad-prediction/v2/public/adparams').then(r => r.text());
      await fetch('https://api.leboncoin.fr/api/adsubmit/v2/classifieds', { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject: 'Salomon XT-6 blanc T40 SECRET-TITRE', body: 'SECRET-DESCRIPTION', price: 9900,
          attributes: [{ key: 'brand', value: 'SECRET-MARQUE' }], images: ['u1'] }) }).then(r => r.text());
    })()`).catch(() => {});
    await pg2.waitForTimeout(700);
    const vus2 = await pg2.evaluate('window.__vus');
    const confs = vus2.filter((v) => v.kind === 'lbccatalogue');
    dit(confs.length >= 2, 'la CONFIG du dépôt dynamique est gardée (c\'est elle qui décrit le formulaire)',
      `gardées : ${confs.map((c) => (c.url.match(/(dynamic-deposit|adparams|classifieds|ad-submit|options)/) || ['?'])[0]).join(', ') || 'aucune'}`);
    const envois = vus2.filter((v) => v.kind === 'lbcenvoi');
    dit(envois.length >= 1, 'et la FORME de ce qui part (les champs que Leboncoin attend vraiment)',
      envois.length ? `${(envois[0].cles || []).length} clé(s) : ${(envois[0].cles || []).slice(0, 6).join(', ')}` : 'rien');
    const clefs = envois.flatMap((e) => e.cles || []).join(' ');
    dit(/subject:string/.test(clefs) && /price:number/.test(clefs) && /attributes\[\]\.key/.test(clefs),
      'on sait donc quels champs remplir, et de quel type');
    // ⚠️⚠️ TOUTE ÉCRITURE EST NOTÉE, PAS SEULEMENT LE DÉPÔT. Quand Julien décrit
    //    un bouton que je n'ai jamais vu (« le premier bouton est article
    //    toujours dispo ? »), la seule façon de savoir ce qu'il envoie est de
    //    l'avoir noté. C'est ce que fait `inject.js` sur Vinted depuis toujours,
    //    et c'est comme ça qu'on a trouvé son `PUT …/shipment/order`.
    await pg2.evaluate(`(async () => {
      await fetch('https://api.leboncoin.fr/api/pintad/v1/public/expired', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ list_id: 3012, still_available: true }) }).then(r => r.text());
      await fetch('https://api.leboncoin.fr/api/dashboard/v1/search').then(r => r.text());
    })()`).catch(() => {});
    await pg2.waitForTimeout(400);
    const tous = await pg2.evaluate('window.__vus');
    const ecrits = tous.filter((v) => v.kind === 'lbcenvoi');
    dit(ecrits.some((e) => /expired/.test(e.url || '')),
      'un bouton HORS dépôt est noté lui aussi (c\'est ce qui manquait côté Leboncoin)',
      ecrits.map((e) => String(e.url).replace(/^.*leboncoin\.fr/, '')).join(' · ') || 'aucun');
    dit(!ecrits.some((e) => /dashboard\/v1\/search/.test(e.url || '')),
      'et une simple LECTURE n\'est pas notée comme une action');

    // ⚠️⚠️ ET LA PROMESSE QUI COMPTE : son annonce ne part PAS.
    const toutCeQuiSort = JSON.stringify(vus2);
    const fuites = ['SECRET-TITRE', 'SECRET-DESCRIPTION', 'SECRET-MARQUE'].filter((x) => toutCeQuiSort.includes(x));
    dit(fuites.length === 0, 'AUCUNE valeur de son annonce ne part avec la structure',
      fuites.length ? `fuite(s) : ${fuites.join(', ')}` : 'ni le titre, ni la description, ni la marque saisie');
    await pg2.close();
  });

  await b.close();

  console.log('\n── CE QUI ARRIVE EN BASE (le vrai `background.js`, dans un `vm`)');
  const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
  let lectureKO = false, ligne = {}, ecrits = [], requetes = [];
  const faireCtx = () => {
    ecrits = []; requetes = [];
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
        const u = String(url);
        const rep = (ok, body, status) => ({ ok, status: status || (ok ? 200 : 522), json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
        if ((opts.method || 'GET') === 'POST') { try { JSON.parse(opts.body || '[]').forEach((r) => ecrits.push(r)); } catch (_) {} return rep(true, '', 201); }
        requetes.push(u);
        // ⚠️ La vraie forme de la panne : un 522 Cloudflare rend du HTML.
        if (lectureKO) return { ok: false, status: 522, json: async () => { throw new Error('HTML'); }, text: async () => '<html>522</html>', headers: { get: () => 'text/html' } };
        const m = /id=eq\.([a-zA-Z0-9_]+)&select/.exec(u);
        if (m && ligne[m[1]] !== undefined) return rep(true, JSON.stringify([{ data: ligne[m[1]] }]));
        return rep(true, '[]');
      },
    };
    ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
    vm.createContext(ctx); vm.runInContext(BG, ctx, { filename: 'background.js' });
    return ctx;
  };

  // 1. Le catalogue a sa PROPRE ligne, et le second endpoint n'écrase pas le premier.
  await essaie('le catalogue est rangé dans sa propre ligne', async () => {
    ligne = {}; lectureKO = false;
    let c = faireCtx();
    await c.storeLbcCatalogue('https://api.leboncoin.fr/api/frontend/v1/data/v7/fdata', CATALOGUE, false);
    let w = ecrits.find((r) => r.id === 'lbc_catalogue');
    dit(!!w, 'le catalogue est rangé dans `lbc_catalogue`, pas dans le flot d\'échantillons',
      w ? `clés : ${Object.keys(w.data).filter((k) => k !== 'updatedAt').join(', ')}` : 'aucune écriture');
    const premier = w ? w.data : {};
    dit(!!w && JSON.stringify(w.data).includes('shoes_brand'),
      'et il porte le corps de la réponse (les codes de Leboncoin)');

    // Le second endpoint arrive : il s'AJOUTE.
    ligne = { lbc_catalogue: premier };
    c = faireCtx();
    await c.storeLbcCatalogue('https://api.leboncoin.fr/api/frontend/v1/data/v5/fforms', FFORMS, false);
    w = ecrits.find((r) => r.id === 'lbc_catalogue');
    const places = w ? Object.keys(w.data).filter((k) => k !== 'updatedAt') : [];
    dit(places.length === 2, 'le second endpoint s\'AJOUTE, il n\'écrase pas le premier',
      `${places.length} place(s) : ${places.join(', ')}`);
  });

  // 2. Une lecture ratée n'écrit pas.
  await essaie('lecture ratée', async () => {
    ligne = { lbc_catalogue: { deja: { url: 'x', corps: CATALOGUE, taille: CATALOGUE.length } } };
    lectureKO = true;
    const c = faireCtx();
    await c.storeLbcCatalogue('https://api.leboncoin.fr/api/frontend/v1/data/v7/fdata', FFORMS, false);
    const w = ecrits.find((r) => r.id === 'lbc_catalogue');
    dit(!w, 'une lecture ratée n\'efface pas le catalogue déjà connu',
      w ? 'la ligne est réécrite depuis une lecture ratée' : '');
  });

  // 3. Le même corps deux fois ne renvoie pas 400 Ko pour rien.
  await essaie('rien de neuf', async () => {
    ligne = { lbc_catalogue: { api_leboncoin_fr_api_frontend_v1_data_v7_fdata: { url: 'u', taille: CATALOGUE.length, coupe: false, corps: CATALOGUE } } };
    lectureKO = false;
    const c = faireCtx();
    await c.storeLbcCatalogue('https://api.leboncoin.fr/api/frontend/v1/data/v7/fdata', CATALOGUE, false);
    dit(!ecrits.find((r) => r.id === 'lbc_catalogue'), 'le même catalogue n\'est pas réécrit à chaque visite');
  });

  // 4. Un corps coupé le DIT.
  await essaie('corps coupé', async () => {
    ligne = {}; lectureKO = false;
    const c = faireCtx();
    await c.storeLbcCatalogue('https://api.leboncoin.fr/api/frontend/v1/data/v7/fdata', CATALOGUE, true);
    const w = ecrits.find((r) => r.id === 'lbc_catalogue');
    const slot = w && w.data[Object.keys(w.data).filter((k) => k !== 'updatedAt')[0]];
    dit(!!slot && slot.coupe === true, 'un catalogue coupé le DIT (on ne l\'analysera pas en le croyant entier)',
      slot ? `coupe=${slot.coupe}` : 'aucune écriture');
  });

  // 5. LA VENTE : rangée par FAMILLE d'endpoint (ids gommés), sans rien parser.
  await essaie('la vente est rangée dans lbc_recon.ventes, par famille (id gommé)', async () => {
    ligne = { lbc_recon: { paths: ['x'] } }; lectureKO = false;
    const c = faireCtx();
    const CORPS = JSON.stringify({ id: 778899, state: 'to_ship', buyer: { name: 'ACHETEUR' }, delivery: { label_url: 'https://.../l.pdf' } });
    await c.storeLbcVente('https://api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions/778899', CORPS, false);
    const w = ecrits.find((r) => r.id === 'lbc_recon');
    const ventes = (w && w.data && w.data.ventes) || {};
    const cles = Object.keys(ventes);
    dit(cles.length === 1 && /transactions\/\{id\}/.test(cles[0]),
      'une place par famille, l\'id est gommé (la 100e vente rafraîchit, n\'ajoute pas)',
      'clés : ' + JSON.stringify(cles));
    const v = ventes[cles[0]] || {};
    dit(v.body === CORPS && v.coupe === false, 'le corps de la vente est gardé pour voir la forme (état, acheteur, bordereau)');
    dit(Array.isArray(w.data.paths) && w.data.paths.includes('x'), 'sans perdre ce que lbc_recon portait déjà');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️⚠️⚠️ CE QUI PART DE LA PAGE N'EST PAS CE QUI ARRIVE EN BASE
  // ══════════════════════════════════════════════════════════════════════════
  // Mesuré le 17 septembre, juste après le dépôt que Julien a fait à la main :
  // `lbc_recon.form` écrit à 12:18:55 avec 3 champs — donc l'enregistreur a
  // tourné et le handler a construit `etapes` — et **`etapes` absente de la
  // base**. `storeLbcRecon` rangeait clé par clé (`form`, `quota`, `paths`,
  // `sample`) et **jetait `etapes` et `capture` en silence**.
  // ⚠️ ET AUCUN BANC NE POUVAIT LE VOIR : `bancs/leboncoin.cjs` vérifie ce que
  //    `lbc.js` ENVOIE (`window.__formes`), il s'arrête à la frontière. Le
  //    rangement, personne ne le mesurait. *Un contrôle qui s'arrête au message
  //    prouve le message, jamais la donnée.*
  // ⇒ Ici on va jusqu'à l'ÉCRITURE : ce qu'un appelant envoie doit se retrouver
  //   dans la ligne. Et la règle porte sur TOUTES les clés, pas sur celles
  //   qu'on a pensé à nommer.
  console.log('\n── CE QU\'UN APPELANT ENVOIE SE RETROUVE EN BASE');
  await essaie('le rangement de lbc_recon', async () => {
    ligne = { lbc_recon: { paths: ['a'], form: { url: 'u', fields: [] } } };
    lectureKO = false;
    const c = faireCtx();
    const envoye = {
      etapes: { 'Chaussures :: sig1': { url: 'u', fields: [{ name: 'subject' }], selects: [{ forme: 'composant', choisi: 'Chaussures' }], fichiers: 1, categorie: 'Chaussures', depot: 'abc', ordre: 2 } },
      capture: { source: 'next_f', vues: 12 },
      form: { url: 'u2', fields: [{ name: 'price' }], at: 'maintenant' },
      quota: { value: 50 },
    };
    await c.storeLbcRecon(envoye);
    const w = ecrits.find((r) => r.id === 'lbc_recon');
    dit(!!w, 'la ligne est bien écrite', w ? '' : 'aucune écriture');
    const d = (w && w.data) || {};
    const perdues = Object.keys(envoye).filter((k) => d[k] === undefined);
    dit(perdues.length === 0,
      'AUCUNE clé envoyée n\'est jetée en silence',
      perdues.length ? `perdue(s) : ${perdues.join(', ')}` : `rangées : ${Object.keys(envoye).join(', ')}`);
    const et = d.etapes && d.etapes['Chaussures :: sig1'];
    dit(!!et && et.categorie === 'Chaussures' && et.ordre === 2 && (et.selects || []).length === 1,
      'et l\'étape garde sa catégorie, son rang et ses listes',
      et ? `catégorie ${et.categorie} · étape n°${et.ordre} · ${(et.selects || []).length} liste(s)` : 'étape absente');
    // ⚠️ L'autre sens : ce qui existait déjà ne doit pas disparaître.
    dit(Array.isArray(d.paths) && d.paths.includes('a'), 'sans perdre ce que la ligne portait déjà');
  });

  // 5. §4.4 : `lbc_recon` pèse 67 Ko et le panneau n'en veut QUE le quota.
  await essaie('la lecture du quota', async () => {
    const m = /async function buildLbcData[\s\S]*?\n}/.exec(BG);
    const corps = m ? m[0] : '';
    const lit = /id=eq\.lbc_recon&select=([^'"`]+)/.exec(corps);
    dit(!!lit && lit[1] !== 'data', 'le quota est PROJETÉ — on ne rapatrie plus les 67 Ko d\'échantillons',
      lit ? `select=${lit[1]}` : 'lecture introuvable');
  });

  console.log(ko ? `\n❌ catalogue Leboncoin : ${ko} rouge(s)` : '\n✅ catalogue Leboncoin : tout est vert');
  process.exit(ko ? 1 : 0);
})();
