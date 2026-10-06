// ════════════════════════════════════════════════════════════════════════════
//  UNE SEULE FILE POUR TOUTE REQUÊTE VINTED, ET L'ARRÊT NET SUR 429 / 403
//  (extension 5.162, 6 octobre)
//
//  MESURÉ avant de coder : `avecVinted` ne couvrait que la génération de
//  bordereaux, les réponses et les commandes de l'app — la moisson, les codes,
//  les versements, les relevés et les photos (chaque minute) partaient hors
//  file. Et un 429/403 ne stoppait rien : la boucle en cours cassait, la
//  suivante repartait, des dizaines de requêtes dans la même visite.
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) — et le vrai `inject.js`
//  dans un faux monde de page — et on COMPTE ce qui part chez Vinted :
//   1. JAMAIS deux requêtes Vinted en vol, quelle que soit la source (photos,
//      versements, codes, un clic de l'app, en même temps) ;
//   2. un 429 dans la moisson de la visite : PLUS AUCUNE requête ensuite ;
//   3. la pause est RANGÉE (`chrome.storage.local`) et DITE au diagnostic ;
//   4. pendant la pause : rien ne part (photos, moisson, visite, lecteurs), et
//      un clic de l'app est refusé POLIMENT, avec la raison et le délai ;
//   5. la pause MONTE si Vinted recommence (15 → 30 min), repart de 15 min
//      après 6 h calmes, et deux freins à la suite ne montent pas deux paliers ;
//   6. l'autre sens : un 404/500 ne met pas en pause, et la pause finie, tout
//      repart ;
//   7. la moisson faite DANS LA PAGE (`inject.js`) s'arrête au premier 429,
//      prévient le fond, et ne démarre pas pendant une pause.
//  Données inventées. Usage : node scripts/audit-frein-vinted.cjs [--src f]
//  (`--inject f` : une autre copie d'`inject.js`, pour la preuve sur l'avant.)
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();
const iInj = process.argv.indexOf('--inject');
const INJECT = iInj > 0 ? path.resolve(process.argv[iInj + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'inject.js');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const UID = '111', PID = 9001;
const FINALISEE = "Commande finalisée - l'acheteur a validé la commande";
const RELAIS = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const html = (id) => '<!doctype html><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { item: {
  id: Number(id), catalog_id: 1, photos: [0, 1, 2].map((i) => ({ id: i, full_size_url: `https://images1.vinted.net/t/x/f800/${id}${i}` })) } } } }) + '</script>';
const lignes = () => ({
  [`harvest_${UID}_orders_sold`]: { capturedAt: new Date().toISOString(), payload: { my_orders: Array.from({ length: 4 }, (_, i) => ({ transaction_id: 5001 + i, title: 'Vente ' + i, status: FINALISEE })) } },
  [`harvest_${UID}_orders_purchased`]: { capturedAt: new Date().toISOString(), payload: { my_orders: Array.from({ length: 3 }, (_, i) => ({ transaction_id: 6001 + i, conversation_id: 7001 + i, title: 'Achat ' + i, status: RELAIS })) } },
  panel_colis_relais: {},
  [`harvest_${UID}_profile`]: { payload: { user: { id: PID } } },
  [`harvest_${UID}_listings`]: { payload: { items: Array.from({ length: 8 }, (_, i) => ({ id: 800 + i, nPhotos: 3, is_closed: false, is_hidden: false })) } },
  vinted_item_details: {},
});
// Vinted « normal » : tout répond.
function vintedOk(r) {
  const c = r.chemin; let m;
  if ((m = /\/api\/v2\/transactions\/(\d+)$/.exec(c))) return { status: 200, body: { transaction: { id: Number(m[1]), status: 450, status_updated_at: '2026-10-01T10:00:00Z' } } };
  if (/\/api\/v2\/conversations\/\d+$/.test(c)) return { status: 200, body: { conversation: { id: 1, messages: [] } } };
  if ((m = /^\/items\/(\d+)$/.exec(c))) return { status: 200, body: html(m[1]) };
  if (/\/api\/v2\/users\/current/.test(c)) return { status: 200, body: { user: { id: PID, login: 'compte_banc' } } };
  if (/\/my_orders/.test(c)) return { status: 200, body: { my_orders: [], pagination: { total_entries: 0 } } };
  if (/\/inbox/.test(c)) return { status: 200, body: { conversations: [] } };
  if (/\/wardrobe\//.test(c)) return { status: 200, body: { items: [], pagination: { total_pages: 1 } } };
  return { status: 404, body: {} };
}
const vintedAvec = (re, statut) => (r) => (re.test(r.chemin) ? { status: statut, body: { message: 'Too Many Requests' } } : vintedOk(r));
const APP = { origin: 'https://vrm.center', url: 'https://vrm.center/' };
const pauseDe = (store) => store.vrmPauseVinted || null;
const minutesRestantes = (p) => (p ? Math.round((p.jusqua - Date.now()) / 60000) : null);

// ── inject.js dans un faux monde de page ─────────────────────────────────────
function pageInject({ repondre, avantChargement } = {}) {
  const ecoute = {}, posts = [], appels = [];
  const store = {};
  const g = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 2)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, Headers: class {}, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    location: { host: 'www.vinted.fr', origin: 'https://www.vinted.fr', href: 'https://www.vinted.fr/member/1' },
    document: { hidden: false, addEventListener() {} },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    addEventListener(type, fn) { (ecoute[type] = ecoute[type] || []).push(fn); },
    postMessage(data) { posts.push(data); },
    fetch: async (url) => {
      appels.push(String(url));
      const r = repondre(String(url));
      const texte = JSON.stringify(r.body || {});
      return { ok: r.status < 400, status: r.status, headers: { get: () => 'application/json' }, text: async () => texte, json: async () => JSON.parse(texte), clone() { return this; } };
    },
  };
  g.window = g; g.self = g; g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(fs.readFileSync(INJECT, 'utf8'), g, { filename: 'inject.js' });
  // Ce que content.js transmet juste après le chargement (avant la moisson).
  // (`source` : la fenêtre telle que le script la voit — dans un `vm`, ce n'est
  // pas l'objet de l'hôte mais son global.)
  const fenetre = vm.runInContext('window', g);
  if (avantChargement) for (const fn of (ecoute.message || [])) fn({ source: fenetre, data: avantChargement });
  return { posts, appels };
}

(async () => {
  console.log('── 1. une seule requête Vinted en vol, quelle que soit la source');
  await essaie('file unique', async () => {
    const f = faireFond({ src: SRC, lignes: lignes(), vinted: vintedOk });
    await Promise.all([
      f.ctx.capterPhotosAnnonces(UID),
      f.ctx.capterDatesVersement(UID),
      f.ctx.capterRetraits(UID),
      f.envoyer({ from: 'vmr-bridge', action: 'exec', uid: UID, method: 'GET', endpoint: '/api/v2/conversations/123' }, APP),
    ]);
    dit(f.j.vinted.length >= 4, 'les quatre sources ont bien travaillé', `${f.j.vinted.length} requête(s)`);
    dit(f.j.maxEnVol === 1, 'jamais deux requêtes Vinted en vol en même temps', `jusqu'à ${f.j.maxEnVol} en vol`);
  });

  console.log('── 2-4. un 429 pendant la moisson de la visite');
  let F = null;
  await essaie('visite freinée', async () => {
    F = faireFond({ src: SRC, lignes: lignes(), vinted: vintedAvec(/\/wardrobe\//, 429) });
    await F.ctx.visiteVinted();
    const i = F.j.vinted.findIndex((x) => /\/wardrobe\//.test(x.chemin));
    dit(i >= 0, 'la visite a bien moissonné jusqu’au dressing (le 429 a été reçu)', JSON.stringify(F.j.vinted.map((x) => x.chemin)));
    const apres = i >= 0 ? F.j.vinted.slice(i + 1).map((x) => x.chemin) : ['(pas de 429)'];
    dit(i >= 0 && apres.length === 0, 'après le 429 : PLUS AUCUNE requête dans la visite (ventes, achats, boîte, codes, versements, photos)', `${apres.length} requête(s) ensuite : ${apres.slice(0, 6).join(' · ')}`);
    const p = pauseDe(F.store);
    dit(!!p && p.statut === 429 && p.niveau === 1 && minutesRestantes(p) >= 14 && minutesRestantes(p) <= 15, 'la pause est RANGÉE dans chrome.storage : 15 min, palier 1, statut 429', JSON.stringify(p));
    dit(F.j.diags.includes('vinted_frein_429') && F.j.diags.includes('vinted_pause_palier_1') && !!(F.j.tampon.rates.vinted_pause && F.j.tampon.rates.vinted_pause.statut === 429),
      'et DITE au diagnostic (compteurs + échantillon `vinted_pause`)', JSON.stringify({ diags: F.j.diags.filter((d) => /vinted_/.test(d)), rate: F.j.tampon.rates.vinted_pause }));
  });
  await essaie('pendant la pause', async () => {
    if (!F) throw new Error('banc précédent absent');
    const avant = F.j.vinted.length;
    await F.ctx.tickPhotos();
    await F.ctx.runActive();
    await F.ctx.visiteVinted();
    await F.ctx.capterDatesVersement(UID);
    await F.ctx.capterRetraits(UID);
    dit(F.j.vinted.length === avant, 'pendant la pause, rien ne part : photos, moisson, visite, versements, codes', `${F.j.vinted.length - avant} requête(s)`);
    const rep = await F.envoyer({ from: 'vmr-bridge', action: 'exec', uid: UID, method: 'POST', endpoint: '/api/v2/conversations/123/replies', body: { reply: { body: 'Bonjour' } } }, APP);
    dit(!!rep && rep.ok === false && rep.code === 'vinted-pause' && /Vinted demande de ralentir — réessaie dans 1[45] min/.test(rep.error || ''),
      'un clic « répondre » de l’app est refusé POLIMENT, avec la raison et le délai', JSON.stringify(rep));
    const bord = await F.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'bordereau', uid: UID, tx: '5001' }, APP);
    dit(!!bord && bord.accepte === false && bord.code === 'vinted-pause' && /Vinted demande de ralentir/.test(bord.raison || ''),
      'un clic « Générer le bordereau » aussi', JSON.stringify(bord));
    const ventes = await F.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'ventes' }, APP);
    dit(!!ventes && ventes.accepte === false && ventes.code === 'vinted-pause', 'et « relis mes ventes »', JSON.stringify(ventes));
    dit(F.j.vinted.length === avant, 'aucun de ces clics n’a envoyé de requête', `${F.j.vinted.length - avant}`);
  });

  console.log('── 5. la pause monte si Vinted recommence');
  await essaie('palier 2', async () => {
    const f = faireFond({ src: SRC, lignes: lignes(), vinted: vintedAvec(/\/transactions\//, 429),
      store: { vrmPauseVinted: { jusqua: Date.now() - 60000, niveau: 1, statut: 429 } } });
    await f.ctx.capterDatesVersement(UID);
    const p = pauseDe(f.store);
    dit(!!p && p.niveau === 2 && minutesRestantes(p) >= 29 && minutesRestantes(p) <= 30, 'un nouveau 429 une minute après la fin de la pause : 30 min (palier 2)', JSON.stringify(p));
    dit(f.j.vinted.filter((x) => /\/transactions\//.test(x.chemin)).length === 1, 'et la boucle des versements s’arrête au premier refus', `${f.j.vinted.length} requête(s)`);
  });
  await essaie('oubli', async () => {
    const f = faireFond({ src: SRC, lignes: lignes(), vinted: vintedAvec(/\/transactions\//, 403),
      store: { vrmPauseVinted: { jusqua: Date.now() - 7 * 3600000, niveau: 3, statut: 429 } } });
    await f.ctx.capterDatesVersement(UID);
    const p = pauseDe(f.store);
    dit(!!p && p.niveau === 1 && p.statut === 403 && minutesRestantes(p) >= 14, 'un 403 après 7 h calmes : on repart du palier 1 (15 min)', JSON.stringify(p));
  });
  await essaie('pas deux paliers', async () => {
    const f = faireFond({ src: SRC, lignes: lignes(), vinted: vintedOk });
    await Promise.all([f.ctx.poserPauseVinted(429, 'api'), f.ctx.poserPauseVinted(429, 'page')]);
    const p = pauseDe(f.store);
    dit(!!p && p.niveau === 1, 'deux freins à la suite ne montent pas deux paliers', JSON.stringify(p));
  });

  console.log('── 6. l’autre sens');
  await essaie('404/500', async () => {
    const f = faireFond({ src: SRC, lignes: lignes(), vinted: (r) => (/\/transactions\/5001$/.test(r.chemin) ? { status: 500, body: {} } : /\/transactions\//.test(r.chemin) ? { status: 404, body: {} } : vintedOk(r)) });
    await f.ctx.capterDatesVersement(UID);
    dit(!pauseDe(f.store) && f.j.vinted.length === 4, 'un 404 ou un 500 ne met PAS en pause : la boucle continue', `${f.j.vinted.length} requête(s) · pause=${JSON.stringify(pauseDe(f.store))}`);
  });
  await essaie('pause finie', async () => {
    const f = faireFond({ src: SRC, lignes: lignes(), vinted: vintedOk, store: { vrmPauseVinted: { jusqua: Date.now() - 1000, niveau: 1, statut: 429 } } });
    await f.ctx.capterDatesVersement(UID);
    dit(f.j.vinted.length === 4, 'la pause finie, tout repart', `${f.j.vinted.length} requête(s)`);
  });
  await essaie('frein relayé de la page', async () => {
    const f = faireFond({ src: SRC, lignes: lignes(), vinted: vintedOk });
    await f.envoyer({ from: 'cancale-content', kind: 'vintedFrein', statut: 200, domain: 'www.vinted.fr' }, { url: 'https://www.vinted.fr/' });
    await attendre(20);
    dit(!pauseDe(f.store), 'un « frein » qui n’est pas un 429/403 ne pause rien', JSON.stringify(pauseDe(f.store)));
    await f.envoyer({ from: 'cancale-content', kind: 'vintedFrein', statut: 403, domain: 'www.vinted.fr' }, { url: 'https://www.vinted.fr/' });
    await attendre(20);
    const p = pauseDe(f.store);
    dit(!!p && p.statut === 403 && p.quoi === 'navigateur', 'un 403 reçu par la moisson DE LA PAGE pose la même pause', JSON.stringify(p));
  });

  console.log('── 7. la moisson faite dans la page (inject.js)');
  await essaie('inject : arrêt au premier 429', async () => {
    const pg = pageInject({ repondre: (u) => (/wardrobe/.test(u) ? { status: 429 } : /users\/current/.test(u) ? { status: 200, body: { user: { id: PID } } } : { status: 200, body: { my_orders: [], conversations: [] } }) });
    await attendre(250);
    const i = pg.appels.findIndex((u) => /wardrobe/.test(u));
    dit(i >= 0, 'la moisson de la page a démarré et reçu le 429', JSON.stringify(pg.appels));
    const apres = i >= 0 ? pg.appels.slice(i + 1) : [];
    dit(i >= 0 && apres.length === 0, 'après le 429, la page n’envoie PLUS RIEN (ni ventes, ni achats, ni boîte)', `${apres.length} requête(s) : ${apres.join(' · ')}`);
    dit(pg.posts.some((m) => m && m.kind === 'vintedFrein' && m.statut === 429), 'et elle prévient le fond (`vintedFrein`)', JSON.stringify(pg.posts.filter((m) => m && m.kind !== 'seen_urls').map((m) => m.kind)));
  });
  await essaie('inject : pas de moisson pendant une pause', async () => {
    const pg = pageInject({ repondre: () => ({ status: 200, body: {} }), avantChargement: { __tag: 'CANCALE_VINTED_PAUSE', jusqua: Date.now() + 600000 } });
    await attendre(250);
    dit(pg.appels.length === 0, 'la pause transmise par content.js : la page ne moissonne pas', `${pg.appels.length} requête(s) : ${pg.appels.slice(0, 4).join(' · ')}`);
  });

  console.log(`\n${ko ? '❌' : '✅'} frein Vinted : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
