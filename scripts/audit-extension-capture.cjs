#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  EXTENSION 5.376 — « l'extension capte mal les bordereaux, et capte très mal
//  sur Orion comme sur le navigateur » (Julien, 14 nov.). Récit :
//  `docs/passation/2026-11-14-extension-capture.md`.
//  Exécute le VRAI `background.js` dans un `vm` (`_fond-vm.cjs`), données
//  INVENTÉES (dépôt public), formes mesurées (transaction, `label_url` qui
//  répond 200 sans URL tant que le PDF n'est pas prêt, URL S3).
//   B1-B8  bordereau manquant ⇒ relancé (10 min…) puis récupéré au passage
//          suivant (visite ou fond) ; `label_url` seul quand il répond 200 ;
//          budget de LECTURE ; compte de l'onglet ; un PDF par envoi ;
//   C1-C7  capture dont l'envoi échoue ⇒ gardée puis rejouée ; jamais sur plus
//          frais ; lecture ratée ⇒ rien écrit ; jamais chez un autre compte VRM ;
//   O1     Orion sans `chrome.alarms` ⇒ la minuterie reprend la file ;
//   V1-V2  Vestiaire, forme inconnue ⇒ aucune vente rangée, et la carte le DIT ;
//   K1-K3  la carte : une phrase, un geste, « pas su » ⇒ rien.
//  `--src chemin` : la preuve sur le code d'avant (§6.1).
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
// ── `--prouve` : chaque règle réaffaiblie dans une COPIE du vrai fichier doit rougir.
if (process.argv.includes('--prouve')) {
  const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
  const vrai = fs.readFileSync(cheminSource(), 'utf8');
  const MUT = [
    ['relances toutes à 6 h', 'const BORD_RELANCES_MS = [10, 30, 60, 180]', 'const BORD_RELANCES_MS = [360, 360, 360, 360]'],
    ['les trois chemins lus même quand label_url répond 200', "      if (statuts.length && statuts[0] === '200') break;\n", ''],
    ['lecture du bordereau hors budget', "  const g = await gardeLecture(uid, acc, 'colis');", '  const g = null;'],
    ['pas de passage de fond', "async function tickBordereaux() {\n  try {", 'async function tickBordereaux() {\n  return 0; try {'],
    ['le PDF deux fois dans un corps', "const range = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_label_${tx}`, data }], 'id');", "const range = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_label_${tx}`, data }, { id: `harvest_${uid}_label_latest`, data }], 'id');"],
    ['aucune capture gardée', 'const STATUT_REJOUABLE = /^(?:reseau|sans_session|408|425|429|5\\d\\d)$/;', 'const STATUT_REJOUABLE = /^$/;'],
    ['rejouée sur plus frais', 'if (b && b >= tamponCapture(r.data))', 'if (false)'],
    ['lecture ratée prise pour « rien en base »', "select=id,c:meta->>capturedAt,u:meta->>updatedAt,a:meta->>at`);", "select=id,c:meta->>capturedAt,u:meta->>updatedAt,a:meta->>at`) || [];"],
    ['rejouée chez un autre compte VRM', '        if (String(e.owner) !== String(s.user_id)) { garde.push(e); continue; }\n', '', "'id', e.owner, { rejeu: true }", "'id', null, { rejeu: true }"],
    ['Orion : la minuterie ne reprend pas la file', "  sansRejet(viderFilesEnAttente(), 'files_minuterie');\n", ''],
    ['forme Vestiaire inconnue pas dite', "    if (Object.keys(vc).some((k) => vc[k] && vc[k].inconnu)) return", '    if (false) return'],
    ['« pas su » dit « tout va bien »', "    if (n === 0) return { k: 'ok'", "    if (n === 0 || n === null) return { k: 'ok'"],
  ];
  let rouges = 0;
  for (const [nom, ...paires] of MUT) {
    let mute = vrai, manque = false;
    for (let i = 0; i < paires.length; i += 2) { if (!mute.includes(paires[i])) manque = true; mute = mute.replace(paires[i], paires[i + 1]); }
    if (manque) { console.log('❌ mutation introuvable : ' + nom); continue; }
    const f = path.join(os.tmpdir(), 'mut-capture-' + process.pid + '.js');
    fs.writeFileSync(f, mute);
    const r = spawnSync(process.execPath, [__filename, '--src', f], { encoding: 'utf8', timeout: 240000 });
    const rouge = r.status !== 0;
    if (rouge) rouges++;
    console.log((rouge ? '✅ rougit : ' : '❌ RESTE VERT : ') + nom);
    try { fs.unlinkSync(f); } catch (_) {}
  }
  console.log(`\n${rouges}/${MUT.length} mutations rougissent`);
  process.exit(rouges === MUT.length ? 0 : 1);
}
let ko = 0, vu = 0;
const dit = (ok, quoi, detail) => { vu++; console.log((ok ? '✅ ' : '❌ ') + quoi + (ok || !detail ? '' : ' — ' + detail)); if (!ok) ko++; };
const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + (e && e.message)); } };
const src = cheminSource();
const iso = (ms) => new Date(Date.now() - ms).toISOString();
const TX = '90001', SHIP = '50001', UID = '111';
const URL_S3 = 'https://svc-shipping-labels.s3.eu-central-1.amazonaws.com/banc.pdf';
const vente = (o = {}) => Object.assign({ transaction_id: Number(TX), title: 'Paire de banc', status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: iso(3600e3) }, o);
const pdf = (octets) => { const t = '%PDF-1.4\n' + 'x'.repeat(Math.max(0, octets - 9)); return new TextEncoder().encode(t); };
// Le faux S3 (le PDF) : une vraie ArrayBuffer à la bonne taille.
function brancherS3(ctx, octets, compte) {
  const f0 = ctx.fetch;
  ctx.fetch = async (u, o) => {
    if (/amazonaws\.com\//.test(String(u))) { compte.s3++; const b = pdf(octets); return { ok: true, status: 200, headers: { get: () => 'application/pdf' }, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; }
    return f0(u, o);
  };
}
// Les délais d'insistance (1,5 / 4 / 9 s) passent tout de suite ; le reste garde son délai.
function vite(ctx) { const st = ctx.setTimeout; ctx.setTimeout = (f, ms, ...a) => st(f, [1500, 4000, 9000].includes(ms) ? 0 : ms, ...a); }
function monde({ pret = () => false, connecte = UID, ecritureKO = () => false, lectureKO = () => false, lignes = null, store = {} } = {}) {
  const base = lignes || { [`harvest_${UID}_orders_sold`]: { capturedAt: iso(60e3), payload: { my_orders: [vente()] } } };
  const vinted = (req) => {
    const c = String(req.chemin || req.url || '');
    if (new RegExp(`/api/v2/transactions/${TX}(\\?|$)`).test(c)) return { status: 200, body: { transaction: { id: Number(TX), item_id: 7001, shipment: { id: Number(SHIP), status: 230 } } } };
    if (/\/label_url$/.test(c)) return { status: 200, body: pret() ? { label_url: URL_S3 } : { code: 0 } };
    if (new RegExp(`/api/v2/shipments/${SHIP}$`).test(c)) return { status: 200, body: { delivery_type: 2, code: 0 } };
    if (/label_options$/.test(c)) return { status: 200, body: { label_options: {} } };
    return { status: 404, body: {} };
  };
  const f = faireFond({ src, lignes: base, vinted, connecte, ecritureKO, lectureKO, store });
  vite(f.ctx);
  f.s3 = { s3: 0 };
  brancherS3(f.ctx, 30000, f.s3);
  return f;
}
const chemins = (j, re) => j.vinted.filter((r) => re.test(String(r.chemin || r.url || ''))).length;
const reculer = (store, ms) => { const m = store.vrmBordFaits && store.vrmBordFaits['get' + TX]; if (m) m.t -= ms; const b = store.vrmBordManquants && store.vrmBordManquants[UID]; if (b && b.prochain) b.prochain -= ms; };

if (!process.argv.includes('--prouve')) (async () => {
  // ── B : le bordereau qui n'est pas prêt au premier passage ─────────────────
  await essaie('B1-B5 bordereau manquant puis récupéré', async () => {
    let pret = false;
    const { ctx, j, store, lignes } = monde({ pret: () => pret });
    await ctx.genererBordereauxEnAttente(UID);
    dit(!lignes[`harvest_${UID}_label_${TX}`], 'B1 premier passage : PDF pas prêt chez Vinted ⇒ rien rangé (pas de faux)');
    dit(chemins(j, new RegExp(`/shipments/${SHIP}$`)) === 0 && chemins(j, /label_options$/) === 0,
      'B2 `label_url` répond 200 sans URL ⇒ les deux autres chemins ne sont PAS lus (lectures pour rien)', `racine ${chemins(j, new RegExp(`/shipments/${SHIP}$`))}, options ${chemins(j, /label_options$/)}`);
    const bm = store.vrmBordManquants && store.vrmBordManquants[UID];
    dit(bm && bm.n === 1 && bm.prochain > Date.now() + 5 * 60e3 && bm.prochain < Date.now() + 15 * 60e3,
      'B3 noté : 1 bordereau manque, relance dans ~10 min', JSON.stringify(bm));
    const avant = chemins(j, /label_url$/);
    await ctx.genererBordereauxEnAttente(UID);
    dit(chemins(j, /label_url$/) === avant, 'B4 visite suivante AVANT la relance : rien redemandé à Vinted', `${avant} → ${chemins(j, /label_url$/)}`);
    pret = true; reculer(store, 11 * 60e3);
    await ctx.tickBordereaux();
    const l = lignes[`harvest_${UID}_label_${TX}`];
    dit(!!(l && typeof l.pdfB64 === 'string' && l.pdfB64.length > 1000 && l.item === '7001'), 'B5 passage de FOND (onglet vinted.fr ouvert) 11 min après : PDF récupéré et rangé, avec son annonce', l ? Object.keys(l).join(',') : 'aucune ligne');
    const bm2 = store.vrmBordManquants && store.vrmBordManquants[UID];
    dit(bm2 && bm2.n === 0, 'B5b plus rien ne manque (la carte le saura)', JSON.stringify(bm2));
    const c = await ctx.capturePourCarte('vinted', UID, null);
    dit(c && c.k === 'ok' && /tous récupérés/.test(c.phrase), 'K1 carte : « Bordereaux : tous récupérés »', JSON.stringify(c));
  });
  await essaie('B6 relances espacées puis 6 h', async () => {
    const { ctx, j, store } = monde({ pret: () => false });
    await ctx.genererBordereauxEnAttente(UID);
    const c = await ctx.capturePourCarte('vinted', UID, null);
    dit(c && c.k === 'manque' && c.phrase === '1 bordereau pas encore récupéré' && c.geste === 'Ouvre tes ventes à expédier' && /^https:\/\/www\.vinted\.fr\//.test(c.lien || ''),
      'K2 carte : « 1 bordereau pas encore récupéré · Ouvre tes ventes à expédier »', JSON.stringify(c));
    const ecarts = [];
    for (let i = 0; i < 5; i++) {
      const m = store.vrmBordFaits['get' + TX];
      const p = ctx.bordProchainEssai(m, true) - Number(m.t);
      ecarts.push(Math.round(p / 60e3));
      reculer(store, p + 1000);
      await ctx.genererBordereauxEnAttente(UID);
    }
    dit(JSON.stringify(ecarts) === JSON.stringify([10, 30, 60, 180, 360]), 'B6 relances : 10 min, 30 min, 1 h, 3 h, puis 6 h', JSON.stringify(ecarts));
    dit(chemins(j, /label_url$/) === 4 + 5, 'B6b insistance (4 lectures) au 1er passage seulement, puis UNE lecture par relance', String(chemins(j, /label_url$/)));
  });
  await essaie('B7 budget de lecture', async () => {
    const t = Date.now();
    const { ctx, j, store } = monde({ pret: () => true, store: { vrmLectures: { [UID]: Array.from({ length: 20 }, (_, i) => t - i * 1000) } } });
    await ctx.genererBordereauxEnAttente(UID);
    dit(chemins(j, /transactions|shipments/) === 0, 'B7 budget de LECTURE plein (20/h) ⇒ aucune requête de bordereau', String(chemins(j, /transactions|shipments/)));
    dit(!(store.vrmBordFaits && store.vrmBordFaits['get' + TX]), 'B7b et l’essai n’est pas consommé (il repart au passage suivant)', JSON.stringify(store.vrmBordFaits));
  });
  await essaie('B8 compte de l’onglet', async () => {
    const { ctx, j } = monde({ pret: () => true, connecte: '222' });
    await ctx.genererBordereauxEnAttente(UID);
    dit(chemins(j, /transactions|shipments/) === 0, 'B8 un AUTRE compte connecté dans l’onglet ⇒ rien lu au nom de 111', String(chemins(j, /transactions|shipments/)));
  });
  await essaie('B9 un PDF par envoi', async () => {
    const { ctx, j, lignes } = monde({ pret: () => true });
    j.posts.length = 0;
    await ctx.genererBordereauxEnAttente(UID);
    const envois = j.posts.filter((p) => p.some((id) => /_label_/.test(id)));
    dit(lignes[`harvest_${UID}_label_${TX}`] && envois.length >= 1 && envois.every((p) => p.length === 1),
      'B9 la ligne de la vente et `label_latest` partent chacune SEULE (jamais le PDF deux fois dans un corps)', JSON.stringify(envois));
  });

  // ── C : la capture dont l'envoi échoue ─────────────────────────────────────
  const capt = (at, n) => ({ id: `harvest_${UID}_orders_sold`, data: { capturedAt: at, nItems: n, payload: { my_orders: [vente()] } } });
  await essaie('C1-C3 envoi échoué puis rejoué', async () => {
    let panne = true;
    const { ctx, lignes, store } = monde({ lignes: {}, ecritureKO: (id) => panne && /orders_sold/.test(id) });
    const ok = await ctx.supabaseUpsert('app_data', [capt(iso(1000), 1)], 'id');
    dit(ok === false && !lignes[`harvest_${UID}_orders_sold`], 'C1 la base ne répond pas (503) : rien rangé, l’appelant le sait');
    const f = store.vrmFileCaptures || [];
    dit(f.length === 1 && f[0].owner === 'owner-banc' && f[0].rows[0].id === `harvest_${UID}_orders_sold`, 'C2 la capture est GARDÉE (au nom du compte VRM qui l’a lue)', JSON.stringify(f).slice(0, 160));
    panne = false;
    const r = await ctx.viderFileCaptures();
    dit(lignes[`harvest_${UID}_orders_sold`] && lignes[`harvest_${UID}_orders_sold`].nItems === 1 && r && r.parti === 1 && !(store.vrmFileCaptures || []).length,
      'C3 la base répond : la capture repart toute seule, la file est vide', JSON.stringify(r));
  });
  await essaie('C4 jamais sur plus frais', async () => {
    let panne = true;
    const { ctx, lignes, store } = monde({ lignes: {}, ecritureKO: (id) => panne && /orders_sold/.test(id) });
    await ctx.supabaseUpsert('app_data', [capt(iso(60e3), 1)], 'id');
    lignes[`harvest_${UID}_orders_sold`] = { capturedAt: iso(1000), nItems: 9, payload: { my_orders: [] } };   // un autre navigateur, plus tard
    panne = false;
    await ctx.viderFileCaptures();
    dit(lignes[`harvest_${UID}_orders_sold`].nItems === 9 && !(store.vrmFileCaptures || []).length, 'C4 la base a plus FRAIS (un autre navigateur) : la vieille capture n’écrase rien et sort de la file');
  });
  await essaie('C5 lecture ratée ⇒ rien écrit', async () => {
    let panne = true, lecture = true;
    const { ctx, j, store } = monde({ lignes: {}, ecritureKO: (id) => panne && /orders_sold/.test(id), lectureKO: (u) => lecture && /id=in\./.test(u) });
    await ctx.supabaseUpsert('app_data', [capt(iso(1000), 1)], 'id');
    panne = false; j.posts.length = 0;
    await ctx.viderFileCaptures();
    dit(!j.posts.some((p) => p.some((id) => /orders_sold/.test(id))) && (store.vrmFileCaptures || []).length === 1, 'C5 la relecture de la base échoue : RIEN écrit, la capture attend');
    lecture = false;
    await ctx.viderFileCaptures();
    dit(!(store.vrmFileCaptures || []).length, 'C5b relecture revenue : elle part');
  });
  await essaie('C6 jamais chez un autre compte VRM', async () => {
    let panne = true;
    const { ctx, lignes, store } = monde({ lignes: {}, ecritureKO: (id) => panne && /orders_sold/.test(id) });
    await ctx.supabaseUpsert('app_data', [capt(iso(1000), 1)], 'id');
    panne = false;
    await ctx.saveSession(Object.assign({}, store.vrmSession, { user_id: 'autre-vendeur', access_token: 'jeton.autre', refresh_token: 'r2' }));
    await ctx.viderFileCaptures();
    dit(!lignes[`harvest_${UID}_orders_sold`] && (store.vrmFileCaptures || []).length === 1, 'C6 un AUTRE compte VRM est connecté : rien n’est rangé chez lui, la capture attend le sien');
  });
  await essaie('C7 PDF lourd', async () => {
    let panne = true;
    const { ctx, j, lignes, store, s3 } = monde({ pret: () => true, ecritureKO: (id) => panne && /_label_\d/.test(id) });
    // un bordereau de 450 Ko (mesuré : jusqu'à 493 Ko la ligne)
    const f0 = ctx.fetch; ctx.fetch = async (u, o) => (/amazonaws/.test(String(u)) ? (() => { const b = pdf(450000); return { ok: true, status: 200, headers: { get: () => 'application/pdf' }, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; })() : f0(u, o));
    await ctx.genererBordereauxEnAttente(UID);
    const f = store.vrmFileCaptures || [];
    dit(!lignes[`harvest_${UID}_label_${TX}`] && f.length === 1 && f[0].rows[0].id === `harvest_${UID}_label_${TX}`, 'C7 PDF de 450 Ko, envoi raté : le bordereau est GARDÉ (une ligne, sans `label_latest`)', JSON.stringify(f.map((e) => e.rows.map((r) => r.id))));
    panne = false;
    await ctx.viderFileCaptures();
    const l = lignes[`harvest_${UID}_label_${TX}`];
    dit(l && l.pdfB64 && l.pdfB64.length > 590000, 'C7b réseau revenu : le PDF entier arrive dans VRM', l ? String(l.pdfB64.length) : 'absent');
  });

  // ── O : Orion (iPhone) sans `chrome.alarms` ────────────────────────────────
  await essaie('O1 Orion sans alarms', async () => {
    let panne = true;
    const f = faireFond({ src, lignes: {}, ecritureKO: (id) => panne && /orders_sold/.test(id), retirer: ['alarms'] });
    const { ctx, lignes, store } = f;
    await ctx.supabaseUpsert('app_data', [capt(iso(1000), 1)], 'id');
    panne = false;
    const vraie = ctx.viderFilesEnAttente; let appels = 0;
    ctx.viderFilesEnAttente = async () => { appels++; return vraie(); };
    await ctx.rattraperMinuteries(true);
    dit(appels >= 1, 'O1a sans `chrome.alarms`, la minuterie du fond (et chaque réveil) reprend les files en attente', String(appels));
    for (let i = 0; i < 30 && (store.vrmFileCaptures || []).length; i++) await new Promise((r) => setTimeout(r, 20));
    dit(lignes[`harvest_${UID}_orders_sold`] && !(store.vrmFileCaptures || []).length, 'O1 sans `chrome.alarms` (Orion), la minuterie du fond rejoue la capture gardée');
  });

  // ── V : Vestiaire, forme inconnue ──────────────────────────────────────────
  await essaie('V1-V2 Vestiaire forme inconnue', async () => {
    const { envoyer, lignes, store, ctx } = faireFond({ src, lignes: {} });
    const sender = { tab: { id: 9, url: 'https://fr.vestiairecollective.com/profile/ventes/' }, url: 'https://fr.vestiairecollective.com/profile/ventes/' };
    await envoyer({ from: 'cancale-vc', action: 'vcVentes', inconnu: ['orders:object', 'x:string'], ventes: [] }, sender);
    const v = lignes.vc_ventes;
    dit(!v || !v.ventes || !Object.keys(v.ventes).length, 'V1 réponse d’une forme inconnue : aucune vente rangée (rien inventé)', JSON.stringify(v || null).slice(0, 160));
    const c = await ctx.capturePourCarte('vestiaire', null, store.vrmVcCapte || {});
    dit(c && c.k === 'forme' && /changé sa page/.test(c.phrase), 'V2 et la carte le DIT : « Vestiaire a changé sa page : VRM ne la lit plus »', JSON.stringify(c));
  });
  await essaie('K3 pas su ⇒ rien', async () => {
    const { ctx } = faireFond({ src, lignes: {} });
    const c = await ctx.capturePourCarte('vinted', UID, null);
    dit(c === null, 'K3 rien mesuré sur ce compte ⇒ la carte ne promet rien (ni « tout va bien », ni un nombre)', JSON.stringify(c));
  });

  console.log(`\n${vu - ko}/${vu} verts`);
  process.exit(ko ? 1 : 0);
})();
