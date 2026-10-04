// ════════════════════════════════════════════════════════════════════════════
//  PURGE DES VIEUX BORDEREAUX — Julien : « 117 colis partis, au-delà de 2
//  semaines / après expédition tu peux supprimer les bordereaux, ça ferait
//  énormément d'économie. » Tranché : « après vente FINALISÉE ».
//
//  Le vrai `purgeBordereaux()` du service worker, exécuté dans un `vm` (§4.10).
//  On RETIRE les octets du PDF (`pdfB64`/`pdfTamponneB64`) d'un bordereau dont la
//  vente est finalisée (statut 450), en GARDANT toute la métadonnée. §6 : on sert
//  la vraie forme (ligne `email_bord_{tx}`, filtre serveur `meta->>status=eq.450`,
//  projection `meta->>…`). FAIL-SAFE PAR SENS : on sous-purge au moindre doute.
//
//  §6.1 : rouge sur le code d'avant (`purgeBordereaux` n'existe pas → `essaie`
//  rougit). On prouve AUSSI la règle en servant les cas qui NE doivent PAS
//  purger (non finalisée · trop récente · déjà purgée · lecture ratée).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}${det ? ' — ' + det : ''}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const JOUR = 86400000;
const vieux = new Date(Date.now() - 60 * JOUR).toISOString();   // 60 j → purgeable
const recent = new Date(Date.now() - 2 * JOUR).toISOString();   // 2 j → ceinture

// Les ventes FINALISÉES (statut 450) que le serveur renverrait (filtre
// `meta->>status=eq.450`). 222 n'y est PAS (statut 20).
const FINALISEES = ['111', '333', '444', '555'];

// Les lignes `email_bord_{tx}` et leur contenu complet.
const PDF = 'JVBERi0xLjQK' + 'A'.repeat(400);   // un vrai poids
const BORDS = {
  email_bord_111: { transaction: '111', numero: '188', suivi: 'VGS111', modele: 'Nike', dateLimite: '29/09/2026',
    pdfB64: PDF, pdfTamponneB64: PDF + 'B', filename: 'label-111.pdf', receivedAt: vieux },      // → PURGE
  email_bord_222: { transaction: '222', numero: '200', suivi: 'VGS222', pdfB64: PDF, filename: 'label-222.pdf', receivedAt: vieux }, // non finalisée → garder
  email_bord_333: { transaction: '333', numero: '300', suivi: 'VGS333', pdfB64: PDF, filename: 'label-333.pdf', receivedAt: recent }, // trop récente → garder
  email_bord_444: { transaction: '444', numero: '400', suivi: 'VGS444', pdfB64: null, pdfTamponneB64: null, filename: '', pdfPurged: true, receivedAt: vieux }, // déjà purgée
  email_bord_555: { transaction: '555', numero: '500', suivi: 'VGS555', pdfB64: null, filename: null, receivedAt: vieux }, // jamais eu de PDF
};
const metaFn = (b) => (b.filename == null ? null : b.filename);

function faireCtx({ txnKO = false, bordsKO = false, dataKO = null } = {}) {
  const journal = { ecrits: [] };
  const lignes = JSON.parse(JSON.stringify(BORDS));   // copie mutable
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder,
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
      const rep = (body, status = 200) => ({ ok: status < 400, status, json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      // Écriture (upsert)
      if ((opts.method || 'GET') === 'POST' && /\/rest\/v1\//.test(u)) {
        try { const corps = JSON.parse(opts.body || '[]'); journal.ecrits.push(...corps); for (const r of corps) if (r && r.id) lignes[r.id] = r.data; } catch (_) {}
        return rep('[]', 201);
      }
      // Ventes finalisées (filtre serveur meta->>status=eq.450)
      if (/id=like\.harvest_\*_txn_\*/.test(u) && /meta->>status=eq\.450/.test(u)) {
        if (txnKO) return rep('db down', 522);
        return rep(JSON.stringify(FINALISEES.map(tx => ({ id: `harvest_9_txn_${tx}` }))));
      }
      // Liste des bordereaux (projection meta->>filename / pdfPurged / receivedAt)
      if (/id=like\.email_bord_\*/.test(u)) {
        if (bordsKO) return rep('db down', 522);
        const out = Object.keys(lignes).map(id => ({ id, fn: metaFn(lignes[id]), pg: lignes[id].pdfPurged ? 'true' : null, rc: lignes[id].receivedAt }));
        return rep(JSON.stringify(out));
      }
      // Lecture d'UNE ligne complète (select=data)
      const m = /id=eq\.(email_bord_\d+)/.exec(u);
      if (m && /select=data/.test(u)) {
        if (dataKO === m[1]) return rep('db down', 522);
        return rep(JSON.stringify([{ data: lignes[m[1]] }]));
      }
      return rep('[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'background.js' });
  ctx.logActivity = async () => {};
  ctx.noterDiag = async () => {};
  ctx.__journal = journal; ctx.__lignes = lignes;
  return ctx;
}
const ecritPour = (j, id) => j.ecrits.filter(e => e && e.id === id).map(e => e.data);

(async () => {
  // ── 1. LE CAS QUI PURGE : vente finalisée, vieux bordereau, PDF présent ──────
  {
    const ctx = faireCtx();
    await essaie('purgeBordereaux tourne', () => ctx.purgeBordereaux());
    const w = ecritPour(ctx.__journal, 'email_bord_111');
    const d = w[w.length - 1];
    dit(!!d, 'le bordereau d\'une vente finalisée est réécrit', d ? 'écrit' : 'AUCUNE écriture');
    if (d) {
      dit(d.pdfB64 === null && d.pdfTamponneB64 === null, 'les octets du PDF sont retirés', `pdfB64=${d.pdfB64}·tampon=${d.pdfTamponneB64}`);
      dit(d.filename === '', 'le témoin `filename` est vidé (la ligne sort de « à imprimer »)', `filename=«${d.filename}»`);
      dit(d.pdfPurged === true && !!d.pdfPurgedAt, 'marqué purgé + daté');
      dit(d.transaction === '111' && d.numero === '188' && d.suivi === 'VGS111', 'la métadonnée est GARDÉE (transaction, N°, suivi)', `${d.transaction}/${d.numero}/${d.suivi}`);
    }
  }
  // ── 2. CE QUI NE DOIT PAS ÊTRE PURGÉ ─────────────────────────────────────────
  {
    const ctx = faireCtx();
    await essaie('purge (cas négatifs)', () => ctx.purgeBordereaux());
    const j = ctx.__journal;
    dit(ecritPour(j, 'email_bord_222').length === 0, 'vente NON finalisée → pas touchée (222)');
    dit(ecritPour(j, 'email_bord_333').length === 0, 'bordereau trop récent (< 7 j) → pas touché (333, ceinture)');
    dit(ecritPour(j, 'email_bord_444').length === 0, 'déjà purgé → pas re-touché (444)');
    dit(ecritPour(j, 'email_bord_555').length === 0, 'jamais eu de PDF → pas touché (555)');
    dit(j.ecrits.length === 1, 'une seule écriture au total (le seul vrai candidat)', `${j.ecrits.length} écriture(s)`);
  }
  // ── 3. FAIL-SAFE : une lecture ratée ⇒ on ne purge RIEN ──────────────────────
  {
    const ctx = faireCtx({ txnKO: true });
    await essaie('purge (ventes finalisées illisibles)', () => ctx.purgeBordereaux());
    dit(ctx.__journal.ecrits.length === 0, 'ventes finalisées illisibles (522) → aucune purge', `${ctx.__journal.ecrits.length} écriture(s)`);
  }
  {
    const ctx = faireCtx({ bordsKO: true });
    await essaie('purge (liste bordereaux illisible)', () => ctx.purgeBordereaux());
    dit(ctx.__journal.ecrits.length === 0, 'liste des bordereaux illisible (522) → aucune purge', `${ctx.__journal.ecrits.length} écriture(s)`);
  }
  {
    const ctx = faireCtx({ dataKO: 'email_bord_111' });
    await essaie('purge (ligne candidate illisible)', () => ctx.purgeBordereaux());
    dit(ecritPour(ctx.__journal, 'email_bord_111').length === 0, 'ligne candidate illisible → on la saute (pas de purge à l\'aveugle)');
  }

  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTous les contrôles passent — un bordereau n\'est allégé que pour une vente finalisée, jamais à l\'aveugle.');
  process.exit(ko ? 1 : 0);
})();
