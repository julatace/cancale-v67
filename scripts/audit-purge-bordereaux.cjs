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
const FINALISEES = ['111', '333', '444', '555', '666'];

// Les lignes `email_bord_{tx}` et leur contenu complet.
const PDF = 'JVBERi0xLjQK' + 'A'.repeat(400);   // un vrai poids
const BORDS = {
  email_bord_111: { transaction: '111', numero: '188', suivi: 'VGS111', modele: 'Nike', dateLimite: '29/09/2026',
    pdfB64: PDF, pdfTamponneB64: PDF + 'B', filename: 'label-111.pdf', receivedAt: vieux },      // → PURGE
  email_bord_222: { transaction: '222', numero: '200', suivi: 'VGS222', pdfB64: PDF, filename: 'label-222.pdf', receivedAt: vieux }, // non finalisée → garder
  email_bord_333: { transaction: '333', numero: '300', suivi: 'VGS333', pdfB64: PDF, filename: 'label-333.pdf', receivedAt: recent }, // trop récente → garder
  email_bord_444: { transaction: '444', numero: '400', suivi: 'VGS444', pdfB64: null, pdfTamponneB64: null, filename: '', pdfPurged: true, receivedAt: vieux }, // déjà purgée
  email_bord_555: { transaction: '555', numero: '500', suivi: 'VGS555', pdfB64: null, filename: null, receivedAt: vieux }, // jamais eu de PDF
  // ⚠️ Finalisée + PDF, mais SANS date lisible (pas de receivedAt) → GARDER :
  //    pour un effacement irréversible, au moindre doute on sous-purge. Avant le
  //    correctif du 8 oct, cette branche purgeait (asymétrie avec `label_*`).
  email_bord_666: { transaction: '666', numero: '600', suivi: 'VGS666', pdfB64: PDF, filename: 'label-666.pdf' }, // sans date → garder
};
const metaFn = (b) => (b.filename == null ? null : b.filename);

// Les bordereaux CAPTÉS par l'extension (`harvest_{uid}_label_{tx}` + le
// « dernier capté » `label_latest`), forme réelle : {uid,url,tx,item,capturedAt,pdfB64}.
// Autorisé par Julien le 4 octobre : 55 lignes de ventes finalisées qu'aucune
// règle ne purgeait.
const LABELS = {
  harvest_9_label_111: { uid: '9', url: 'u111', tx: '111', item: '7001', capturedAt: vieux, pdfB64: PDF },   // → PURGE
  harvest_9_label_latest: { uid: '9', url: 'u111', tx: '111', item: '7001', capturedAt: vieux, pdfB64: PDF }, // copie du 111 → PURGE
  harvest_9_label_222: { uid: '9', url: 'u222', tx: '222', capturedAt: vieux, pdfB64: PDF },                 // non finalisée → garder
  harvest_9_label_333: { uid: '9', url: 'u333', tx: '333', capturedAt: recent, pdfB64: PDF },                // trop récent → garder
  harvest_9_label_444: { uid: '9', url: 'u444', tx: '444', pdfB64: PDF },                                     // sans date → garder
  harvest_9_label_555: { uid: '9', url: 'u555', tx: '999', capturedAt: vieux, pdfB64: PDF },                 // tx incohérente → garder
  harvest_8_label_latest: { uid: '8', url: 'u8', capturedAt: vieux, pdfB64: PDF },                            // latest sans tx → garder
};

function faireCtx({ txnKO = false, bordsKO = false, dataKO = null, labelsKO = false, labels = LABELS, finalisees = FINALISEES } = {}) {
  const journal = { ecrits: [] };
  const lignes = JSON.parse(JSON.stringify({ ...BORDS, ...labels }));   // copie mutable
  journal.stock = [];
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
      storage: { local: { get: dual({}), set: (o) => { journal.stock.push(o); return Promise.resolve(); }, remove: dual(undefined) } },
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
        return rep(JSON.stringify(finalisees.map(tx => ({ id: `harvest_9_txn_${tx}` }))));
      }
      // Liste des bordereaux (projection meta->>filename / pdfPurged / receivedAt)
      if (/id=like\.email_bord_\*/.test(u)) {
        if (bordsKO) return rep('db down', 522);
        const out = Object.keys(lignes).filter(id => /^email_bord_/.test(id)).map(id => ({ id, fn: metaFn(lignes[id]), pg: lignes[id].pdfPurged ? 'true' : null, rc: lignes[id].receivedAt }));
        return rep(JSON.stringify(out));
      }
      // Liste des bordereaux CAPTÉS : le filtre `meta->>_pdf=eq.true` est appliqué
      // comme le ferait la base (le déclencheur pose `_pdf` quand pdfB64 est non vide).
      if (/id=like\.harvest_\*_label_\*/.test(u)) {
        if (labelsKO) return rep('db down', 522);
        const filtre = /meta->>_pdf=eq\.true/.test(u);
        const out = Object.keys(lignes).filter(id => /^harvest_\d+_label_/.test(id))
          .filter(id => !filtre || !!(lignes[id] && lignes[id].pdfB64))
          .map(id => ({ id, tx: lignes[id].tx || null, cap: lignes[id].capturedAt || null }));
        return rep(JSON.stringify(out));
      }
      // Lecture d'UNE ligne complète (select=data)
      const m = /id=eq\.(email_bord_\d+|harvest_\d+_label_\w+)/.exec(u);
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
    dit(ecritPour(j, 'email_bord_666').length === 0, 'email_bord finalisé SANS date lisible → gardé (ceinture, § au moindre doute on sous-purge)');
    const nb = j.ecrits.filter(e => /^email_bord_/.test(e.id)).length;
    dit(nb === 1, 'une seule écriture d\'email_bord au total (le seul vrai candidat)', `${nb} écriture(s)`);
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

  // ── 4. LES BORDEREAUX CAPTÉS PAR L'EXTENSION (label_{tx}, label_latest) ──────
  {
    const ctx = faireCtx();
    await essaie('purge (bordereaux captés)', () => ctx.purgeBordereaux());
    const j = ctx.__journal;
    for (const id of ['harvest_9_label_111', 'harvest_9_label_latest']) {
      const w = ecritPour(j, id); const d = w[w.length - 1];
      dit(!!d && d.pdfB64 === null, `${id} (vente finalisée, vieux) : PDF retiré`, d ? `pdfB64=${d.pdfB64}` : 'AUCUNE écriture');
      if (d) dit(d.tx === '111' && d.item === '7001' && d.url === 'u111' && d.capturedAt === vieux && d.pdfPurged === true,
        `${id} : transaction, annonce, lien et date GARDÉS (l'app relie toujours la paire)`, `${d.tx}/${d.item}/${d.url}`);
    }
    for (const [id, pourquoi] of [['harvest_9_label_222', 'vente non finalisée'], ['harvest_9_label_333', 'capté il y a moins de 7 j'],
      ['harvest_9_label_444', 'sans date lisible'], ['harvest_9_label_555', 'transaction incohérente avec la ligne'],
      ['harvest_8_label_latest', '« dernier capté » sans transaction']]) {
      dit(ecritPour(j, id).length === 0, `${id} (${pourquoi}) → pas touché`);
    }
    // Idempotence : la base ne relit que ce qui porte ENCORE un PDF.
    j.ecrits.length = 0;
    await essaie('purge (second passage)', () => ctx.purgeBordereaux());
    dit(j.ecrits.length === 0, 'un second passage ne réécrit rien (ligne purgée = plus de `_pdf`)', `${j.ecrits.length} écriture(s)`);
  }
  {
    const ctx = faireCtx({ labelsKO: true });
    await essaie('purge (liste des bordereaux captés illisible)', () => ctx.purgeBordereaux());
    const nl = ctx.__journal.ecrits.filter(e => /_label_/.test(e.id)).length;
    dit(nl === 0, 'liste des bordereaux captés illisible (522) → aucun touché', `${nl} écriture(s)`);
    dit(ecritPour(ctx.__journal, 'email_bord_111').length === 1, '… et la purge des email_bord n\'en dépend pas');
  }
  {
    const ctx = faireCtx({ dataKO: 'harvest_9_label_111' });
    await essaie('purge (bordereau capté illisible)', () => ctx.purgeBordereaux());
    dit(ecritPour(ctx.__journal, 'harvest_9_label_111').length === 0, 'bordereau capté illisible → sauté (pas de purge à l\'aveugle)');
  }
  {
    const ctx = faireCtx({ txnKO: true });
    await essaie('purge (ventes illisibles, captés)', () => ctx.purgeBordereaux());
    dit(ctx.__journal.ecrits.length === 0, 'ventes finalisées illisibles → aucun bordereau capté touché non plus');
  }
  // ── 5. UN ARRIÉRÉ : 25 candidats → 20 par passage, et le suivant vient vite ──
  {
    const beaucoup = {}, fin = [];
    for (let i = 0; i < 25; i++) { const tx = String(5000 + i); fin.push(tx); beaucoup[`harvest_9_label_${tx}`] = { uid: '9', url: 'u', tx, capturedAt: vieux, pdfB64: PDF }; }
    const ctx = faireCtx({ labels: beaucoup, finalisees: fin });
    await essaie('purge (arriéré)', () => ctx.purgeBordereaux());
    const nl = ctx.__journal.ecrits.filter(e => /_label_/.test(e.id)).length;
    dit(nl === 20, 'borné à 20 bordereaux captés par passage', `${nl}`);
    const cd = (ctx.__journal.stock.filter(o => o && o.vrmPurgeBord).pop() || {}).vrmPurgeBord || 0;
    const prochain = cd + 12 * 3600000 - Date.now();
    dit(prochain > 0 && prochain <= 3600000 + 5000, 'l\'arriéré est repris dans l\'heure, pas dans 12 h', `prochain passage dans ${Math.round(prochain / 60000)} min`);
  }

  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTous les contrôles passent — un bordereau n\'est allégé que pour une vente finalisée, jamais à l\'aveugle.');
  process.exit(ko ? 1 : 0);
})();
