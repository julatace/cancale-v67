// ════════════════════════════════════════════════════════════════════════════
//  « C'EST L'APPLICATION QUI CONTRÔLE L'EXTENSION » — la commande « générer le
//  bordereau » (extension 5.129, Julien, 2 octobre)
//
//  On EXÉCUTE le vrai `background.js` dans un `vm` (§4.10), on récupère son
//  vrai écouteur `chrome.runtime.onMessage`, et on COMPTE ce qui part chez
//  Vinted : chaque garde-fou du §3 doit tenir, ET le cas normal doit aboutir
//  (sinon « ne jamais rien faire » passerait tous les contrôles).
//   · origine de l'app seulement ;
//   · le compte de la vente doit être celui connecté dans Chrome (« pas su »
//     ne vaut pas « oui ») — sinon ZÉRO requête Vinted ;
//   · PDF déjà rangé → zéro requête ; bordereau déjà commandé chez Vinted →
//     zéro PUT (la course mesurée le 28 sept. sortait en 400) ;
//   · deux clics → une seule génération ;
//   · JAMAIS deux requêtes Vinted en vol en même temps ;
//   · l'app est prévenue, avec la transaction.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const UID = '3175765377', TX = '22501209977', APP = 'https://vrm.center';

// `vinted` décrit ce que Vinted répond : shipment déjà là ? PUT accepté / 409 ?
function faireCtx({ connecte = UID, dejaRange = false, shipment = false, putStatus = 200, labelUrl = true } = {}) {
  const store = {}; let ecouteur = null;
  const j = { requetes: [], puts: 0, enVol: 0, maxEnVol: 0, evts: [], ecritures: [] };
  let shipCree = shipment;
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 2)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { ecouteur = fn; } }, getManifest: () => ({ version: '5.129.0' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, onClicked: { addListener() {} }, setPopup() {} },
      tabs: { onUpdated: { addListener() {} }, onActivated: { addListener() {} }, query: async () => [{ id: 7 }],
        sendMessage: (id, m, cb) => { if (m && m.__vmrEvt) j.evts.push(m.evt); if (typeof cb === 'function') cb(); }, create: dual({}) },
      storage: { local: {
        get(k, cb) { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = JSON.parse(JSON.stringify(store[c])); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set(o, cb) { Object.assign(store, JSON.parse(JSON.stringify(o))); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined),
      }, onChanged: { addListener() {} } },
      webNavigation: { onCompleted: { addListener() {} } },
      scripting: { executeScript: dual([]) },
    },
    // Le PDF lui-même (S3) : quelques octets.
    fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer, json: async () => [], text: async () => '' }),
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'background.js' });
  // Les portes du monde extérieur, remplacées pour COMPTER.
  ctx.getStoredAccounts = async () => [{ vinted_user_id: UID, login: 'angeled92', domain: 'www.vinted.fr' }, { vinted_user_id: '999', login: 'julienf765', domain: 'www.vinted.fr' }];
  ctx.activeAccountId = async () => connecte;
  ctx.sbGet = async (q) => (/label_/.test(q) ? (dejaRange ? [{ id: `harvest_${UID}_label_${TX}`, cap: '2026-10-02' }] : []) : []);
  ctx.supabaseUpsert = async (t, rows) => { j.ecritures.push(rows.map((r) => r.id)); return true; };
  ctx.noterDiag = async () => {}; ctx.echantillonRate = async () => {}; ctx.noterUrlLabel = async () => {}; ctx.logActivity = async () => {};
  ctx.adresseVendeur = async () => 123;
  const vintedTrace = async (quoi, rep) => {
    j.enVol++; j.maxEnVol = Math.max(j.maxEnVol, j.enVol); j.requetes.push(quoi);
    await attendre(3);
    j.enVol--; return rep;
  };
  ctx.vintedGet = async (acc, chemin) => {
    if (/\/transactions\/\d+$/.test(chemin)) return vintedTrace('GET ' + chemin, { ok: true, status: 200, json: { transaction: { id: TX, item_id: 555, shipment: shipCree ? { id: 9 } : null } } });
    if (/label_url$/.test(chemin)) return vintedTrace('GET ' + chemin, { ok: true, status: 200, json: labelUrl ? { label_url: 'https://svc-shipping-labels.s3.amazonaws.com/x.pdf' } : {} });
    return vintedTrace('GET ' + chemin, { ok: true, status: 200, json: {} });
  };
  ctx.vintedSend = async (acc, methode, chemin) => {
    j.puts++;
    const r = await vintedTrace(methode + ' ' + chemin, { ok: putStatus < 400, status: putStatus, json: {} });
    if (putStatus < 400 || putStatus === 409) shipCree = true;
    return r;
  };
  const envoyer = (msg, origine = APP) => new Promise((res) => {
    const r = ecouteur(Object.assign({ from: 'vmr-bridge' }, msg), { origin: origine, url: origine + '/' }, res);
    if (r !== true) setTimeout(() => res(undefined), 5);
  });
  const finir = async (jobId) => { for (let i = 0; i < 400; i++) { const c = ((await ctx.chrome.storage.local.get('vrmCmds')).vrmCmds || {})[jobId]; if (c && !['file', 'generation', 'pdf'].includes(c.etape)) return c; await attendre(5); } return null; };
  return { ctx, j, envoyer, finir };
}
const CMD = { action: 'cmd', cmd: 'bordereau', uid: UID, tx: TX };

(async () => {
  await essaie('cas normal', async () => {
    const { j, envoyer, finir } = faireCtx();
    const ack = await envoyer(CMD);
    dit(ack && ack.accepte === true && ack.jobId === `bord:${UID}:${TX}`, 'autre sens : sur le bon compte, la commande est ACCEPTÉE tout de suite (accusé avec jobId)', JSON.stringify(ack));
    const fin = await finir(`bord:${UID}:${TX}`);
    dit(fin && fin.etape === 'fait', 'et elle aboutit : bordereau généré, PDF rangé (étape « fait »)', JSON.stringify(fin));
    dit(j.puts === 1, 'une seule commande de bordereau chez Vinted (PUT)', `${j.puts} PUT`);
    dit(j.ecritures.some((ids) => ids.includes(`harvest_${UID}_label_${TX}`)), 'le PDF est rangé sous la ligne de CETTE transaction', JSON.stringify(j.ecritures));
    dit(j.evts.some((e) => e.type === 'maj' && e.quoi === 'label' && String(e.tx) === TX), "l'app est prévenue (maj · label · avec la transaction)", JSON.stringify(j.evts.map((e) => e.type + ':' + (e.etape || e.quoi))));
    dit(j.maxEnVol === 1, 'jamais deux requêtes Vinted en vol', `max ${j.maxEnVol}`);
  });
  await essaie('origine', async () => {
    const { j, envoyer } = faireCtx();
    const ack = await envoyer(CMD, 'https://site-malveillant.example');
    await attendre(30);
    dit(j.requetes.length === 0 && ack && ack.ok === false, "une page qui n'est pas l'app ne commande rien", JSON.stringify(ack));
  });
  await essaie('autre compte', async () => {
    const { j, envoyer } = faireCtx({ connecte: '999' });
    const ack = await envoyer(CMD);
    await attendre(30);
    dit(j.requetes.length === 0 && ack && ack.accepte === false && ack.code === 'vinted-autre', 'Chrome sur un AUTRE compte : refus « vinted-autre », zéro requête Vinted', JSON.stringify(ack));
    dit(ack && ack.actifLogin === 'julienf765', "et l'app sait sur quel compte Chrome est connecté (pour le dire)", JSON.stringify(ack));
  });
  await essaie('aucun compte', async () => {
    const { j, envoyer } = faireCtx({ connecte: null });
    const ack = await envoyer(CMD);
    await attendre(30);
    dit(j.requetes.length === 0 && ack && ack.code === 'vinted-absent', 'aucun compte lisible dans Chrome : refus, zéro requête (« pas su » ne vaut pas « oui »)', JSON.stringify(ack));
  });
  await essaie('déjà rangé', async () => {
    const { j, envoyer } = faireCtx({ dejaRange: true });
    const ack = await envoyer(CMD);
    await attendre(30);
    dit(j.requetes.length === 0 && ack && ack.etape === 'fait', 'PDF déjà rangé : rien ne part chez Vinted, réponse « fait »', JSON.stringify(ack) + ' · ' + j.requetes.join(','));
  });
  await essaie('déjà commandé', async () => {
    const { j, envoyer, finir } = faireCtx({ shipment: true });
    await envoyer(CMD);
    const fin = await finir(`bord:${UID}:${TX}`);
    dit(j.puts === 0 && fin && fin.etape === 'fait', "bordereau déjà commandé chez Vinted : on va chercher le PDF SANS recommander (0 PUT)", `${j.puts} PUT · ${JSON.stringify(fin)}`);
  });
  await essaie('409', async () => {
    const { j, envoyer, finir } = faireCtx({ putStatus: 409 });
    await envoyer(CMD);
    const fin = await finir(`bord:${UID}:${TX}`);
    dit(fin && fin.etape === 'fait', 'un 409 (« il y en a déjà un ») mène quand même au PDF', JSON.stringify(fin));
  });
  await essaie('refus Vinted', async () => {
    const { envoyer, finir } = faireCtx({ putStatus: 400 });
    await envoyer(CMD);
    const fin = await finir(`bord:${UID}:${TX}`);
    dit(fin && fin.etape === 'echec' && !!fin.raison, 'un refus de Vinted devient « échec » AVEC sa raison (jamais un faux « fait »)', JSON.stringify(fin));
  });
  await essaie('double clic', async () => {
    const { j, envoyer, finir } = faireCtx();
    const [a, b] = await Promise.all([envoyer(CMD), envoyer(CMD)]);
    await finir(`bord:${UID}:${TX}`);
    dit(j.puts === 1, 'deux clics (ou deux onglets) → une seule génération', `${j.puts} PUT · ${JSON.stringify([a && a.etape, b && b.etape])}`);
  });
  await essaie('deux ventes en même temps', async () => {
    const { j, envoyer, finir } = faireCtx();
    await Promise.all([envoyer(CMD), envoyer({ ...CMD, tx: '22501209978' })]);
    await finir(`bord:${UID}:${TX}`); await finir(`bord:${UID}:22501209978`);
    dit(j.maxEnVol === 1, 'deux commandes lancées ensemble : toujours UNE requête Vinted à la fois', `max ${j.maxEnVol} en vol`);
  });
  await essaie('relire les ventes', async () => {
    const a = faireCtx({ connecte: null });
    const r1 = await a.envoyer({ action: 'cmd', cmd: 'ventes' });
    dit(r1 && r1.accepte === false && r1.code === 'vinted-absent', '« relis mes ventes » sans compte connecté : refusé', JSON.stringify(r1));
  });
  await essaie('état', async () => {
    const { j, envoyer } = faireCtx();
    const e = await envoyer({ action: 'etat' });
    dit(e && e.ok && e.vinted && e.vinted.uid === UID && e.vinted.login === 'angeled92', "l'état dit quel compte Vinted est connecté, avec son login", JSON.stringify(e && e.vinted));
    dit(j.requetes.length === 0, "l'état ne coûte AUCUNE requête Vinted", j.requetes.join(','));
  });
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
