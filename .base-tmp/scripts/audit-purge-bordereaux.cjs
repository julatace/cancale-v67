// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE PDF D'UN BORDEREAU PART QUAND LA VENTE EST FINALISÉE ET L'ARGENT
//  REÇU (15 nov., décision de Julien : « Tu supprimes les bordereaux lorsque la
//  vente est finalisée et que on a reçu l'argent. »)
// ════════════════════════════════════════════════════════════════════════════
//  Ce qu'il EXÉCUTE (§4.10, §6) :
//   A. LA RÈGLE (api/_lib/purge-bordereaux.js `decisionBordereau`) sur des cas
//      inventés : finalisée + versée ⇒ retirée ; finalisée sans versement ⇒
//      gardée ; versée mais retour / annulation / suspension ⇒ gardée ; liste
//      « finalisée » + détail figé à 230 ⇒ la lecture la plus fraîche gagne ;
//      même instant, deux avis ⇒ pas su ; date illisible ⇒ gardée.
//   B. LA ROUTE : `purgeBordereauxDuVendeur` d'api/ship-reminders.js (celle que
//      le cron du matin appelle, `fetchPaginated` + `scoped` + la fonction de la
//      base), contre une fausse base PostgREST à la VRAIE forme : projections
//      `select=` (`meta->>`, `data->`, `data->>`), filtres, `Range`, `owner=eq.`,
//      `meta` refait comme le déclencheur de la 004, la fonction de la 044 jouée
//      comme le SQL (liste blanche de clés, identité attendue, PDF présent).
//      ⇒ PDF retiré, LIGNE et métadonnées gardées, aucune autre ligne touchée
//        (ni un autre vendeur, ni un bordereau de retour, ni un e-mail d'achat),
//        jamais `select=data` sur une ligne lourde, journal écrit (ids, tailles) ;
//      ⇒ chaque lecture ratée ⇒ RIEN écrit ; fonction absente (404) ⇒ rien écrit.
//   C. Le branchement (le cron l'appelle APRÈS la lecture des étiquettes ; la
//      réponse ne porte aucun identifiant), la migration 044 (bornes), l'app
//      (« Bordereau supprimé après le versement » au lieu d'un bouton mort).
//  `node scripts/audit-purge-bordereaux.cjs [--prouve]`
//  `--prouve` : ROUGE sur l'arbre de départ (git archive) et sur chaque mutation.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const ICI = path.join(__dirname, '..');
const R = process.env.AUDIT_RACINE || ICI;
const AVANT = process.env.AUDIT_AVANT || 'f782040f';   // la pointe de claude/project-review-nsk5su, d'où part ce lot

const MUTATIONS = {
  'oublier le versement': [['api/_lib/purge-bordereaux.js', "  const tv = ms(v);\n  if (tv == null || tv > maintenant) return garde('sans-versement');\n", '  const tv = ms(v);\n']],
  'oublier le retour': [['api/_lib/purge-bordereaux.js', "  if (incidentVinted(o) || ctx.retours.has(c.tx)) return garde('retour-annulation');\n", '']],
  'oublier le bordereau de retour': [['api/_lib/purge-bordereaux.js', 'if (incidentVinted(o) || ctx.retours.has(c.tx))', 'if (incidentVinted(o))']],
  'la liste ignorée (seul le détail 450, comme avant)': [['api/_lib/purge-bordereaux.js', "    ...o.liste.map((l) => ({ cap: l.cap, fin: classifyOrderStatus(l.st) === 'completed' })),\n", '']],
  'n’importe quelle lecture finalisée suffit': [['api/_lib/purge-bordereaux.js', '  const fraiches = toutes.filter((x) => x.cap === max);', '  const fraiches = toutes.filter((x) => x.fin);']],
  'supprimer la ligne entière': [['api/ship-reminders.js', '    rpc: rpcPostgrest({ url: SUPABASE_URL, entetes: HEADERS, fetcher: fetchAvecDelai }),', "    rpc: async (n, c) => { const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${scoped('app_data?id=eq.' + encodeURIComponent(c.p_id))}`, { method: 'DELETE', headers: HEADERS }); return r.ok ? { etat: 'ok', avant: 1, apres: 0 } : null; },"]],
  'select=data sur les bordereaux': [['api/_lib/purge-bordereaux.js', '  bords: REQ_BORDS_PDF,', "  bords: 'app_data?id=like.email_bord_*&meta->>_pdf=eq.true&select=id,data,tx:meta->>transaction,pdfLu:meta->>pdfLu,transporteur:meta->>transporteur,suivi:meta->>suivi,recu:meta->>receivedAt',"]],
  'une lecture ratée écrit quand même': [['api/_lib/purge-bordereaux.js', '  if (illisibles.length) return {', '  if (false) return {']],
  'les lignes de tous les vendeurs': [['api/ship-reminders.js', '    lireTout: (p) => fetchPaginated(scoped(p)), getRow, ecrire: ecrireDedup, owner, maintenant,', '    lireTout: (p) => fetchPaginated(p), getRow, ecrire: ecrireDedup, owner, maintenant,']],
  'PDF pas encore lu pour son transporteur': [['api/_lib/purge-bordereaux.js', "  if (ctx.aLire.has(c.id)) return garde('transporteur-pas-lu');\n", '']],
  'la ceinture des 7 jours retirée': [['api/_lib/purge-bordereaux.js', "  if (maintenant - at < AGE_MIN_MS) return garde('trop-recent');\n", '']],
  'l’app garde le bouton (hasPdf toujours vrai)': [['src/App.jsx', "hasPdf: !purge,", 'hasPdf: true,']],
};

if (process.argv.includes('--prouve')) {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-purge-bord-'));
  cp.execSync(`git -C "${ICI}" archive ${AVANT} api src supabase package.json | tar -x -C "${t}"`);
  let nm = ICI; while (!fs.existsSync(path.join(nm, 'node_modules')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
  if (fs.existsSync(path.join(nm, 'node_modules'))) fs.symlinkSync(fs.realpathSync(path.join(nm, 'node_modules')), path.join(t, 'node_modules'));
  const r = cp.spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 300000 });
  const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
  console.log(`${r.status && rouges ? '✅' : '❌'} sur l’arbre de départ (${AVANT}) : ${rouges} rouge(s)`);
  for (const l of (r.stdout || '').split('\n').filter((x) => x.startsWith('❌')).slice(0, 8)) console.log('     ' + l.slice(0, 170));
  fs.rmSync(t, { recursive: true, force: true });
  if (!(r.status && rouges)) process.exit(1);
  // Les mutations : une copie de l'arbre (api, src, supabase), node_modules en lien.
  let racineNm = ICI; while (!fs.existsSync(path.join(racineNm, 'node_modules')) && path.dirname(racineNm) !== racineNm) racineNm = path.dirname(racineNm);
  const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-purge-src-'));
  for (const x of ['api', 'src', 'supabase', 'package.json']) fs.cpSync(path.join(ICI, x), path.join(tm, x), { recursive: true });
  fs.symlinkSync(fs.realpathSync(path.join(racineNm, 'node_modules')), path.join(tm, 'node_modules'));
  process.on('exit', () => { try { fs.rmSync(tm, { recursive: true, force: true }); } catch (_) {} });   // prouver() sort du processus
  require('./_mutations-audit.cjs').prouver(__filename, tm, MUTATIONS, ['supabase']);
  return;
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 300) : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCom = (t) => require('./_mutations-audit.cjs').sansCommentaires(t);

// ── Données inventées, à la vraie forme ────────────────────────────────────
const O1 = '0a0a0a0a-1111-4111-8111-000000000001', O2 = '0b0b0b0b-2222-4222-8222-000000000002';
const UID = '501';
const J = 86400000;
const NOW = Date.now();
const iso = (t) => new Date(t).toISOString();
const PDF = 'JVBERi0xLjQK' + 'QUJD'.repeat(4000);         // « %PDF-1.4 » + 16 Ko : l'ordre de grandeur d'un vrai bordereau
const TX = { paye: '30000000001', liste230: '30000000002', sansVers: '30000000003', retour440: '30000000004', bordRetour: '30000000005', detailFrais: '30000000006', listeFraiche: '30000000007', recent: '30000000008', pasLu: '30000000009', egal: '30000000010', autreVendeur: '30000000011' };
const FINAL = 'Commande finalisée - l\'acheteur a validé la commande';
const EXPED = 'Commande expédiée et en cours d\'acheminement ! ';
const bordEmail = (tx, { recu = NOW - 40 * J, pdfLu = 'mondialrelay' } = {}) => ({ type: 'bordereau', transaction: tx, numero: '12', modele: 'Paire inventée', taille: '42', account: 'boutique_banc', uid: UID, suivi: 'MR' + tx.slice(-6), filename: `Bordereau-${tx}.pdf`, dateLimite: '2026-10-01', posKnown: true, receivedAt: iso(recu), pdfB64: PDF, pdfTamponneB64: PDF, ...(pdfLu ? { pdfLu, transporteur: 'mondialrelay' } : {}) });
const label = (tx, cap = NOW - 40 * J) => ({ uid: UID, url: 'https://www.vinted.fr/api/v2/transactions/' + tx + '/shipment/label', capturedAt: iso(cap), pdfB64: PDF, tx, item: '7000' + tx.slice(-4), items: [7000] });
const txnRow = (tx, status, su, cap, { titre = '', sst = '' } = {}) => ({ id: `harvest_${UID}_txn_${tx}`, data: { capturedAt: iso(cap), payload: { transaction: { id: Number(tx), item_id: 7000, status, status_title: titre, status_updated_at: iso(su), shipment: { status_title: sst } } } } });
const order = (tx, status, tus = 'completed') => ({ transaction_id: Number(tx), status, transaction_user_status: tus, title: 'Paire inventée', price: { amount: '50.0', currency_code: 'EUR' }, date: iso(NOW - 60 * J), conversation_id: 900000 + Number(tx.slice(-2)) });

function base() {
  const rows = [];
  const add = (owner, id, data) => rows.push({ owner, id, data: JSON.parse(JSON.stringify(data)) });
  // 1. Finalisée (liste ET détail 450), versée (450) : retirée — email, capté, et `label_latest` (copie).
  add(O1, `email_bord_${TX.paye}`, bordEmail(TX.paye));
  add(O1, `harvest_${UID}_label_${TX.paye}`, label(TX.paye));
  add(O1, `harvest_${UID}_label_latest`, label(TX.paye));
  // 2. Liste « finalisée » (lue le 30e jour) + détail FIGÉ à 230 (lu avant) ; versement par l'e-mail « Transaction finalisée ».
  add(O1, `email_bord_${TX.liste230}`, bordEmail(TX.liste230));
  // 3. Liste « finalisée », détail 230, AUCUNE date de versement : gardée.
  add(O1, `email_bord_${TX.sansVers}`, bordEmail(TX.sansVers));
  // 4. Liste « finalisée » (plus fraîche) mais le détail a dit 440 « Retour initié » ; versement connu : gardée.
  add(O1, `email_bord_${TX.retour440}`, bordEmail(TX.retour440));
  // 5. Finalisée + versée, mais un BORDEREAU DE RETOUR au même n° : gardée (et le bordereau de retour jamais touché).
  add(O1, `email_bord_${TX.bordRetour}`, bordEmail(TX.bordRetour));
  add(O1, `email_bordretour_${TX.bordRetour}`, { type: 'bordereau_retour', transaction: TX.bordRetour, sens: 'achat', filename: 'Bon-Retour.pdf', pdfB64: PDF, receivedAt: iso(NOW - 20 * J) });
  // 6. Détail 450 PLUS FRAIS que la liste (« expédiée », lue avant) : finalisée, versée : retirée.
  add(O1, `harvest_${UID}_label_${TX.detailFrais}`, label(TX.detailFrais));
  // 7. Liste « expédiée » PLUS FRAÎCHE que le détail 450 (lu avant) : la plus fraîche dit « pas finalisée » : gardée.
  add(O1, `email_bord_${TX.listeFraiche}`, bordEmail(TX.listeFraiche));
  // 8. Finalisée + versée mais bordereau de 2 jours : gardé (ceinture).
  add(O1, `email_bord_${TX.recent}`, bordEmail(TX.recent, { recu: NOW - 2 * J }));
  // 9. Finalisée + versée mais PDF jamais lu pour son transporteur : gardé (lu d'abord).
  add(O1, `email_bord_${TX.pasLu}`, bordEmail(TX.pasLu, { pdfLu: null }));
  // 10. Liste et détail lus au MÊME instant, deux avis : pas su ⇒ gardé.
  add(O1, `email_bord_${TX.egal}`, bordEmail(TX.egal));
  // Vestiaire : une vente « versée » (date lue) ⇒ retirée ; une en cours ⇒ gardée.
  add(O1, 'vc_label_81000001', { productId: '81000001', at: iso(NOW - 40 * J), taille: 16000, suivi: 'VC1', transporteur: 'colissimo', compte: '7', b64: PDF });
  add(O1, 'vc_label_81000002', { productId: '81000002', at: iso(NOW - 40 * J), taille: 16000, suivi: 'VC2', transporteur: 'colissimo', compte: '7', b64: PDF });
  add(O1, 'vc_ventes', { ventes: { '81000001': { productId: '81000001', etat: 'PAYOUT_DONE', verseLe: iso(NOW - 10 * J), aExpedier: false }, '81000002': { productId: '81000002', etat: 'IN_PROGRESS', aExpedier: true } }, lectures: {} });
  // Ce qui n'est PAS un bordereau de vente et porte un PDF : jamais touché.
  add(O1, 'email_achat_tx30000000099', { transaction: '30000000099', subject: 'Reçu', pdfB64: PDF, receivedAt: iso(NOW - 40 * J) });
  // Les lectures de l'état de la vente.
  add(O1, `harvest_${UID}_orders_sold`, { capturedAt: iso(NOW - 5 * J), payload: { my_orders: [
    order(TX.paye, FINAL), order(TX.liste230, FINAL), order(TX.sansVers, FINAL), order(TX.retour440, FINAL), order(TX.bordRetour, FINAL),
    order(TX.recent, FINAL), order(TX.pasLu, FINAL), order(TX.listeFraiche, EXPED, 'waiting'),
  ] } });
  add(O1, `harvest_502_orders_sold`, { capturedAt: iso(NOW - 25 * J), payload: { my_orders: [order(TX.detailFrais, EXPED, 'waiting'), order(TX.egal, EXPED, 'waiting')] } });
  for (const r of [
    txnRow(TX.paye, 450, NOW - 30 * J, NOW - 29 * J, { titre: 'Commande finalisée' }),
    txnRow(TX.liste230, 230, NOW - 38 * J, NOW - 37 * J, { titre: 'Le paiement a été validé' }),
    txnRow(TX.sansVers, 230, NOW - 38 * J, NOW - 37 * J, { titre: 'Le paiement a été validé' }),
    txnRow(TX.retour440, 440, NOW - 33 * J, NOW - 32 * J, { titre: 'Retour initié' }),
    txnRow(TX.bordRetour, 450, NOW - 30 * J, NOW - 29 * J),
    txnRow(TX.detailFrais, 450, NOW - 20 * J, NOW - 20 * J),
    txnRow(TX.listeFraiche, 450, NOW - 30 * J, NOW - 30 * J),
    txnRow(TX.recent, 450, NOW - 3 * J, NOW - 3 * J),
    txnRow(TX.pasLu, 450, NOW - 30 * J, NOW - 29 * J),
    txnRow(TX.egal, 450, NOW - 30 * J, NOW - 25 * J),
  ]) add(O1, r.id, r.data);
  add(O1, 'email_final_tx' + TX.liste230, { transaction: TX.liste230, receivedAt: iso(NOW - 31 * J), subject: 'Transaction finalisée' });
  add(O1, 'email_final_tx' + TX.retour440, { transaction: TX.retour440, receivedAt: iso(NOW - 31 * J), subject: 'Transaction finalisée' });
  add(O1, 'vrm_bord_transporteurs', { v: 1, pdf: { [TX.detailFrais]: { t: 'mondialrelay' } }, pdfVus: {} });
  // Un AUTRE vendeur : la même vente, le même identifiant de ligne — jamais touché.
  add(O2, `email_bord_${TX.paye}`, bordEmail(TX.paye));
  add(O2, `email_bord_${TX.autreVendeur}`, bordEmail(TX.autreVendeur));
  add(O2, `harvest_${UID}_orders_sold`, { capturedAt: iso(NOW - 5 * J), payload: { my_orders: [order(TX.paye, FINAL), order(TX.autreVendeur, FINAL)] } });
  add(O2, `harvest_${UID}_txn_${TX.autreVendeur}`, txnRow(TX.autreVendeur, 450, NOW - 30 * J, NOW - 29 * J).data);
  for (const r of rows) r.meta = metaDe(r.id, r.data);
  return rows;
}
// Le déclencheur de la 004 (`vrm_meta`), refait : scalaires ≤ 600, `_pdf`, champs de la transaction.
function metaDe(id, d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const m = {};
  for (const [k, v] of Object.entries(d)) if (['string', 'number', 'boolean'].includes(typeof v) && JSON.stringify(v).length <= 600) m[k] = v;
  if (typeof d.pdfB64 === 'string' && d.pdfB64 !== '') m._pdf = true;
  if (/^harvest_[0-9]+_txn_/.test(id)) { const t = (d.payload && d.payload.transaction) || {}; for (const [k, v] of [['id', t.id], ['item_id', t.item_id], ['status', t.status], ['status_title', t.status_title], ['status_updated_at', t.status_updated_at], ['ship_status_title', t.shipment && t.shipment.status_title]]) if (v != null) m[k] = v; }
  return m;
}

// ── La fausse base PostgREST ───────────────────────────────────────────────
const texte = (v) => (v == null ? null : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v));
function chemin(row, p) {
  // `meta->>k`, `data->>k`, `data->a->b`, `data->a->>b`
  const m = /^(meta|data)((?:->>?[A-Za-z0-9_]+)+)$/.exec(p);
  if (!m) return { ok: false };
  let v = row[m[1]];
  const pas = m[2].match(/->>?[A-Za-z0-9_]+/g);
  let txt = false;
  for (const s of pas) { txt = s.startsWith('->>'); const k = s.replace(/^->>?/, ''); v = v && typeof v === 'object' && !Array.isArray(v) ? v[k] : undefined; }
  return { ok: true, v: v === undefined ? null : (txt ? texte(v) : v) };
}
const likeRe = (x) => new RegExp('^' + x.replace(/\*/g, '%').split('').map((c) => (c === '%' ? '.*' : c === '_' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + '$');
function creerBase(rows, cfg = {}) {
  const journal = { lectures: [], rpc: [], ecritures: [], suppressions: [], inconnues: [] };
  const rep = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  const fetch = async (url, opts = {}) => {
    const u = String(url);
    const meth = (opts.method || 'GET').toUpperCase();
    const m = /\/rest\/v1\/([a-z_/]+)(?:\?(.*))?$/.exec(u);
    if (!m) { journal.inconnues.push(u); return rep([]); }
    const table = m[1];
    const params = (m[2] || '').split('&').filter(Boolean).map((kv) => { const i = kv.indexOf('='); return [decodeURIComponent(kv.slice(0, i)), decodeURIComponent(kv.slice(i + 1))]; });
    if (table === 'rpc/vrm_bordereau_retirer_pdf') {
      const c = JSON.parse(opts.body || '{}');
      journal.rpc.push(c);
      if (cfg.rpcAbsente) return rep({ code: 'PGRST202', message: 'Could not find the function' }, 404);
      return rep(retirerPdf(rows, c));
    }
    if (table.startsWith('rpc/')) return rep(null);
    if (table !== 'app_data') return rep([]);
    if (meth === 'POST') {
      const corps = JSON.parse(opts.body || '[]');
      for (const r of (Array.isArray(corps) ? corps : [corps])) {
        journal.ecritures.push(r.id);
        if (cfg.ecritureKO) return new Response('', { status: 500 });
        const i = rows.findIndex((x) => x.owner === r.owner && x.id === r.id);
        const neuf = { owner: r.owner, id: r.id, data: r.data, meta: metaDe(r.id, r.data) };
        if (i >= 0) rows[i] = neuf; else rows.push(neuf);
      }
      return new Response('', { status: 201 });
    }
    // Filtres
    let sel = null; const filtres = [];
    for (const [k, v] of params) {
      if (k === 'select') sel = v;
      else if (k === 'order' || k === 'limit' || k === 'on_conflict') continue;
      else filtres.push([k, v]);
    }
    const garde = (row) => filtres.every(([k, v]) => {
      const val = (k === 'id' || k === 'owner') ? row[k] : (() => { const c = chemin(row, k); return c.ok ? texte(c.v) : undefined; })();
      if (val === undefined) { journal.inconnues.push(k); return false; }
      if (v.startsWith('eq.')) return val === v.slice(3);
      if (v.startsWith('like.')) return val != null && likeRe(v.slice(5)).test(val);
      if (v === 'is.null') return val == null;
      if (v === 'not.is.null') return val != null;
      if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(val);
      journal.inconnues.push(k + '=' + v); return false;
    });
    if (meth === 'DELETE') {
      const avant = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (garde(rows[i])) { journal.suppressions.push(rows[i].id); rows.splice(i, 1); }
      return new Response('', { status: avant !== rows.length ? 204 : 204 });
    }
    if (meth !== 'GET') return new Response('', { status: 405 });
    const range = (opts.headers && (opts.headers.Range || opts.headers.range)) || null;
    journal.lectures.push({ u, sel, range, owner: (params.find(([k]) => k === 'owner') || [])[1] || null });
    if (cfg.ko && cfg.ko.test(u)) return new Response('<html>522</html>', { status: 522 });
    const items = (sel || '*').split(',').map((s) => { const i = s.indexOf(':'); return i > 0 && !s.slice(0, i).includes('-') ? [s.slice(0, i), s.slice(i + 1)] : [s.replace(/^.*->>?/, ''), s]; });
    let out = rows.filter(garde).map((row) => { const o = {}; for (const [alias, p] of items) { if (p === 'id' || p === 'owner') o[alias] = row[p]; else if (p === 'data' || p === 'meta') o[alias] = row[p]; else { const c = chemin(row, p); o[alias] = c.ok ? c.v : null; } } return o; });
    if (range) { const [a, b] = range.split('-').map(Number); out = out.slice(a, b + 1); }
    return rep(out);
  };
  return { fetch, journal };
}
// La 044 jouée comme le SQL : liste blanche, identité attendue, PDF encore présent, `data || patch`.
function retirerPdf(rows, c) {
  const { p_owner, p_id, p_patch, p_attendu = {} } = c || {};
  if (!p_owner || !p_id || !/^(email_bord_[0-9]{6,20}|harvest_[0-9]{1,20}_label_([0-9]{6,20}|latest)|vc_label_[0-9A-Za-z_-]{1,64})$/.test(p_id)) return { etat: 'refus', raison: 'identifiant' };
  if (!p_patch || typeof p_patch !== 'object' || Array.isArray(p_patch)) return { etat: 'refus', raison: 'forme' };
  const pdf = [];
  for (const [k, v] of Object.entries(p_patch)) {
    if (['pdfB64', 'pdfTamponneB64', 'b64'].includes(k)) { if (v !== null) return { etat: 'refus', raison: k }; pdf.push(k); }
    else if (k === 'pdfPurged') { if (v !== true) return { etat: 'refus', raison: k }; }
    else if (k === 'pdfPurgedAt' || k === 'pdfPurgeRaison') { if (typeof v !== 'string' || v.length > 40) return { etat: 'refus', raison: k }; }
    else return { etat: 'refus', raison: 'cle' };
  }
  if (!pdf.length || !('pdfPurged' in p_patch)) return { etat: 'refus', raison: 'rien-a-retirer' };
  const r = rows.find((x) => x.owner === p_owner && x.id === p_id);
  if (!r || !Object.entries(p_attendu || {}).every(([k, v]) => r.data && r.data[k] === v) || !pdf.some((k) => r.data[k] != null && r.data[k] !== '' && r.data[k] !== 'None')) return { etat: 'rien' };
  const avant = JSON.stringify(r.data).length;
  r.data = { ...r.data, ...p_patch };
  r.meta = metaDe(r.id, r.data);
  return { etat: 'ok', avant, apres: JSON.stringify(r.data).length };
}

(async () => {
  // ── A. LA RÈGLE ──────────────────────────────────────────────────────────
  let P = null;
  try { P = await import('file://' + path.join(R, 'api', '_lib', 'purge-bordereaux.js')); } catch (e) { dit(false, 'A0 api/_lib/purge-bordereaux.js se charge', String(e && e.message)); }
  if (P) {
    const obs = (liste, detail) => new Map([['30000000001', { liste, detail }]]);
    const ctx = (o, vers, extra = {}) => ({ obs: o, versements: vers, aLire: new Set(), retours: new Set(), vc: { ventes: null, lectures: null }, ...extra });
    const c = { id: 'email_bord_30000000001', famille: 'email', tx: '30000000001', at: iso(NOW - 40 * J) };
    const L = (st, cap, tus = 'completed') => ({ st, tus, cap: NOW - cap * J });
    const D = (s, cap, ss = '', sst = '') => ({ s, ss, sst, cap: NOW - cap * J, contredit: false });
    const v = { '30000000001': iso(NOW - 31 * J) };
    const d = (o, vers = v, extra) => P.decisionBordereau(c, ctx(o, vers, extra), NOW);
    dit(d(obs([L(FINAL, 5)], [D(450, 29)])).supprimer === true, 'A1 finalisée (liste et détail) + versement connu ⇒ PDF retiré');
    dit(d(obs([L(FINAL, 5)], [D(230, 37)]), {}).raison === 'sans-versement', 'A2 finalisée SANS date de versement ⇒ gardé (« à dater » pour la compta)');
    dit(d(obs([L(FINAL, 5)], [D(230, 37)])).supprimer === true, 'A3 liste « finalisée » (plus fraîche) + détail figé à 230 ⇒ la plus fraîche gagne : retiré');
    dit(d(obs([L(EXPED, 5, 'waiting')], [D(450, 30)])).raison === 'pas-finalisee', 'A4 liste « expédiée » PLUS FRAÎCHE qu’un détail 450 ⇒ la plus fraîche dit non : gardé');
    dit(d(obs([L(EXPED, 25, 'waiting')], [D(450, 20)])).supprimer === true, 'A5 détail 450 plus frais que la liste ⇒ finalisée : retiré');
    dit(d(obs([L(FINAL, 5)], [D(440, 32, 'Retour initié')])).raison === 'retour-annulation', 'A6 versée, mais le détail a dit 440 (retour) ⇒ gardé, même si la liste plus fraîche dit « finalisée »');
    dit(d(obs([L('Remboursement effectué', 5, 'failed')], [D(450, 29)])).raison === 'retour-annulation', 'A7 remboursée (liste) ⇒ gardé');
    dit(d(obs([L(FINAL, 5)], [D(430, 20)])).raison === 'retour-annulation' && d(obs([L(FINAL, 5)], [D(520, 20)])).raison === 'retour-annulation' && d(obs([L('Transaction suspendue - en attente de vérification.', 5, 'waiting')], [])).raison === 'retour-annulation', 'A8 suspendue (430), annulée (≥ 500), « suspendue » dans la liste ⇒ gardé');
    dit(d(obs([L(FINAL, 5)], [D(450, 29)]), v, { retours: new Set(['30000000001']) }).raison === 'retour-annulation', 'A9 un bordereau de RETOUR au même n° ⇒ gardé');
    dit(d(obs([L(FINAL, 20)], [D(230, 20)])).raison === 'etat-pas-su', 'A10 liste et détail du MÊME instant, deux avis ⇒ pas su : gardé');
    dit(d(obs([{ st: FINAL, tus: 'completed', cap: null }], [D(450, 29)])).raison === 'etat-pas-su', 'A11 une lecture sans date de capture ⇒ pas su : gardé');
    dit(d(new Map()).raison === 'vente-introuvable', 'A12 vente introuvable (ni liste ni détail) ⇒ gardé');
    dit(d(obs([L(FINAL, 5)], [D(450, 29)]), { '30000000001': iso(NOW + 3 * J) }).raison === 'sans-versement', 'A13 une date de versement dans le futur ne vaut pas « reçu »');
    dit(P.decisionBordereau({ ...c, at: iso(NOW - 2 * J) }, ctx(obs([L(FINAL, 1)], [D(450, 1)]), v), NOW).raison === 'trop-recent' && P.decisionBordereau({ ...c, at: 'pas une date' }, ctx(obs([L(FINAL, 1)], [D(450, 1)]), v), NOW).raison === 'date-bordereau-illisible', 'A14 bordereau de moins de 7 jours, ou date illisible ⇒ gardé');
    dit(d(obs([L(FINAL, 5)], [D(450, 29)]), v, { aLire: new Set([c.id]) }).raison === 'transporteur-pas-lu', 'A15 PDF pas encore lu pour son transporteur ⇒ gardé (lu d’abord)');
    dit(P.identiteBordereau('email_bordretour_30000000001', '30000000001') === null && P.identiteBordereau('email_achat_tx30000000001') === null && P.identiteBordereau('harvest_501_label_latest', '') === null && P.identiteBordereau('email_bord_30000000001', '30000000002') === null, 'A16 identité : jamais un bordereau de retour, un e-mail d’achat, un `label_latest` sans transaction, une ligne qui se contredit');
    const pe = P.patchDe({ famille: 'email', tx: '1' }, NOW), pl = P.patchDe({ famille: 'label', tx: '1', latest: true }, NOW), pv = P.patchDe({ famille: 'vc', pid: '9' }, NOW);
    dit(pe.p_patch.pdfB64 === null && pe.p_patch.pdfTamponneB64 === null && pe.p_patch.pdfPurged === true && pe.p_patch.pdfPurgeRaison === 'versement' && !('filename' in pe.p_patch) && !('suivi' in pe.p_patch) && pe.p_attendu.transaction === '1'
      && pl.p_attendu.tx === '1' && pv.p_patch.b64 === null && pv.p_attendu.productId === '9', 'A17 le changement : les seuls champs PDF à null + la marque ; l’identité attendue de la ligne');
  }

  // ── B. LA ROUTE (cron du matin, `purgeBordereauxDuVendeur`) ─────────────
  process.env.CRON_SECRET = 'cle-banc-purge';
  process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
  process.env.VRM_OWNER_UID = O1;
  let etat = { fetch: async () => new Response('[]', { status: 200 }) };
  global.fetch = (...a) => etat.fetch(...a);
  let mod = null, own = null;
  try { mod = await import('file://' + path.join(R, 'api', 'ship-reminders.js')); own = await import('file://' + path.join(R, 'api', '_lib', 'owner.js')); }
  catch (e) { dit(false, 'B0 api/ship-reminders.js se charge', String(e && e.message)); }
  const lancer = async (cfg = {}) => {
    const rows = base();
    const b = creerBase(rows, cfg);
    etat.fetch = b.fetch;
    let res = null;
    try { res = await own.contexteVendeur.run({ owner: O1 }, () => mod._banc.purgeBordereauxDuVendeur(NOW)); } catch (e) { res = { erreur: String(e && e.message) }; }
    return { rows, j: b.journal, res };
  };
  const route = mod && mod._banc && typeof mod._banc.purgeBordereauxDuVendeur === 'function';
  dit(!!route, 'B1 le cron expose la passe du vendeur (`purgeBordereauxDuVendeur`)');
  if (route && own) {
    const avant = base();
    const { rows, j, res } = await lancer();
    const ligne = (o, id) => rows.find((r) => r.owner === o && r.id === id);
    const ligneAvant = (o, id) => avant.find((r) => r.owner === o && r.id === id);
    const retires = [`email_bord_${TX.paye}`, `harvest_${UID}_label_${TX.paye}`, `harvest_${UID}_label_latest`, `email_bord_${TX.liste230}`, `harvest_${UID}_label_${TX.detailFrais}`, 'vc_label_81000001'];
    const gardes = [`email_bord_${TX.sansVers}`, `email_bord_${TX.retour440}`, `email_bord_${TX.bordRetour}`, `email_bordretour_${TX.bordRetour}`, `email_bord_${TX.listeFraiche}`, `email_bord_${TX.recent}`, `email_bord_${TX.pasLu}`, `email_bord_${TX.egal}`, 'vc_label_81000002', 'email_achat_tx30000000099'];
    const sansPdf = (id) => { const r = ligne(O1, id); return r && r.data && r.data.pdfB64 == null && r.data.pdfTamponneB64 == null && r.data.b64 == null && r.data.pdfPurged === true && r.data.pdfPurgeRaison === 'versement'; };
    dit(res && res.fait === true && res.supprimes === retires.length, `B2 la passe tourne et retire ${retires.length} PDF (finalisée + versée + aucun retour)`, JSON.stringify(res));
    for (const id of retires) dit(sansPdf(id), `B3 ${id.replace(/\d{8,}/g, 'N')} : PDF retiré, marqué « après le versement »`, JSON.stringify(ligne(O1, id) && Object.keys(ligne(O1, id).data)));
    // La LIGNE et ses métadonnées restent : tout ce qui n'est pas un champ PDF est identique.
    const PDFK = ['pdfB64', 'pdfTamponneB64', 'b64', 'pdfPurged', 'pdfPurgedAt', 'pdfPurgeRaison'];
    const meta = (d) => JSON.stringify(Object.fromEntries(Object.entries(d || {}).filter(([k]) => !PDFK.includes(k)).sort()));
    dit(retires.every((id) => ligne(O1, id) && meta(ligne(O1, id).data) === meta(ligneAvant(O1, id).data)), 'B4 la ligne reste, et toutes ses métadonnées (suivi, transporteur, date limite, filename, tx, item…) sont intactes');
    dit(gardes.every((id) => ligne(O1, id) && JSON.stringify(ligne(O1, id).data) === JSON.stringify(ligneAvant(O1, id).data)), 'B5 les bordereaux gardés (sans versement, retour 440, bordereau de retour, plus fraîche « expédiée », récent, pas lu, même instant, Vestiaire en cours) et l’e-mail d’achat : octet pour octet', gardes.filter((id) => !ligne(O1, id) || JSON.stringify(ligne(O1, id).data) !== JSON.stringify(ligneAvant(O1, id).data)).join(', '));
    const autres = avant.filter((r) => !(r.owner === O1 && (retires.includes(r.id) || r.id === 'vrm_purge_bordereaux')));
    dit(autres.every((a) => { const r = rows.find((x) => x.owner === a.owner && x.id === a.id); return r && JSON.stringify(r.data) === JSON.stringify(a.data); }) && rows.length === avant.length + 1, 'B6 aucune autre ligne touchée (l’autre vendeur, même identifiant de ligne, compris) ; une seule ligne de plus : le journal', String(rows.length - avant.length));
    dit(j.suppressions.length === 0, 'B7 aucune ligne supprimée', j.suppressions.join(','));
    const jr = ligne(O1, 'vrm_purge_bordereaux');
    dit(jr && Array.isArray(jr.data.supprimes) && jr.data.supprimes.length === retires.length && jr.data.supprimes.every((s) => retires.includes(s.id) && s.octets > 0) && jr.data.dernier && jr.data.dernier.gardes && jr.data.dernier.gardes['sans-versement'] >= 1 && jr.data.dernier.gardes['retour-annulation'] >= 2, 'B8 journal `vrm_purge_bordereaux` : ids et tailles retirées, gardés par raison', JSON.stringify(jr && jr.data.dernier));
    const lourdes = j.lectures.filter((l) => /id=(like|eq)\.(email_bord|harvest_|vc_label|email_final|email_bordretour)/.test(decodeURIComponent(l.u)));
    dit(lourdes.length > 0 && lourdes.every((l) => !String(l.sel || '').split(',').some((s) => s === 'data' || s === '*' || /:data$/.test(s))), 'B9 jamais `select=data` sur une ligne lourde (projection seulement, §4.4)', lourdes.filter((l) => String(l.sel || '').split(',').some((s) => s === 'data' || /:data$/.test(s))).map((l) => l.sel).join(' | '));
    dit(j.lectures.length > 0 && j.lectures.every((l) => l.owner === 'eq.' + O1), 'B10 chaque lecture porte `owner=eq.` du vendeur du tour', j.lectures.filter((l) => l.owner !== 'eq.' + O1).map((l) => l.u).slice(0, 2).join(' | '));
    dit(j.lectures.filter((l) => /like\./.test(decodeURIComponent(l.u))).every((l) => l.range), 'B11 les familles sont lues paginées (`Range`, §4.5)');
    dit(j.rpc.every((c) => c.p_owner === O1) && j.ecritures.every((id) => id === 'vrm_purge_bordereaux'), 'B12 la base n’est écrite que par la fonction 044 (au nom du vendeur) et le journal', j.ecritures.join(','));

    // 4. « Pas su » sur une source ⇒ RIEN écrit.
    const sources = [['bordereaux', /email_bord_\*&meta/], ['ventes', /orders_sold/], ['transactions', /_txn_/], ['e-mails de versement', /email_final_/], ['conversations de versement', /_versement_/], ['relevé', /_releve_/], ['bordereaux de retour', /email_bordretour_/], ['transporteurs lus', /vrm_bord_transporteurs/], ['journal', /vrm_purge_bordereaux/], ['ventes Vestiaire', /vc_ventes/]];
    for (const [nom, re] of sources) {
      const r = await lancer({ ko: re });
      dit(r.j.rpc.length === 0 && r.j.ecritures.length === 0 && r.res && r.res.fait === false, `B14 lecture ratée (${nom}) ⇒ rien écrit`, JSON.stringify({ rpc: r.j.rpc.length, ecr: r.j.ecritures, res: r.res }));
    }
    const ab = await lancer({ rpcAbsente: true });
    dit(ab.j.rpc.length === 1 && ab.rows.filter((r) => r.owner === O1 && retires.includes(r.id)).every((r) => r.data.pdfB64 === PDF || r.data.b64 === PDF) && ab.j.ecritures.every((id) => id === 'vrm_purge_bordereaux') && ab.res && ab.res.supprimes === 0 && ab.res.migration === 'absente', 'B15 migration 044 pas appliquée (404 PGRST202) ⇒ un seul essai, rien retiré, dit « absente »', JSON.stringify(ab.res));
    const re = await lancer();
    const encore = await (async () => { etat.fetch = creerBase(re.rows).fetch; return own.contexteVendeur.run({ owner: O1 }, () => mod._banc.purgeBordereauxDuVendeur(NOW)); })();
    dit(encore && encore.fait === true && encore.supprimes === 0, 'B16 idempotent : un second passage ne retire rien de plus', JSON.stringify(encore));
  }

  // ── C. Branchement, migration, app ───────────────────────────────────────
  const sr = sansCom(lire('api/ship-reminders.js'));
  const tv = (/async function traiterVendeur\(\) \{([\s\S]*?)\n\}/.exec(sr) || [])[1] || '';
  dit(tv.indexOf('purgeBordereauxDuVendeur()') > tv.indexOf('etiquettesCron(') && tv.indexOf('etiquettesCron(') > 0, 'C1 le cron du matin appelle la purge, APRÈS la lecture des étiquettes');
  dit(/purgeBordereaux,\s*controle/.test(tv) && /const resumePurge = \(r\) =>/.test(sr) && !/resumePurge[^\n]*\bids?\b/.test(sr), 'C2 la réponse du cron porte un résumé en nombres (`resumePurge`)');
  const fonctions = fs.existsSync(path.join(R, 'api')) ? fs.readdirSync(path.join(R, 'api')).filter((f) => f.endsWith('.js')) : [];
  dit(fonctions.length <= 12 && !fonctions.some((f) => /purge/i.test(f)), 'C3 aucune 13e fonction : la purge vit dans le cron existant', fonctions.join(','));
  const sql = lire('supabase/migrations/044-bordereau-retirer-pdf.sql');
  const sqlS = sql.replace(/--[^\n]*/g, '');
  dit(/create or replace function public\.vrm_bordereau_retirer_pdf/.test(sqlS) && /\^\(email_bord_\[0-9\]\{6,20\}\|harvest_/.test(sqlS) && !/bordretour/.test(sqlS)
    && /k in \('pdfB64', 'pdfTamponneB64', 'b64'\)/.test(sqlS) && /return jsonb_build_object\('etat', 'refus', 'raison', 'cle'\)/.test(sqlS)
    && /set data = a\.data \|\| p_patch/.test(sqlS) && /a\.data @> coalesce\(p_attendu/.test(sqlS) && !/\bdelete\b/i.test(sqlS)
    && /grant execute on function public\.vrm_bordereau_retirer_pdf\(uuid, text, jsonb, jsonb\) to service_role/.test(sqlS) && /revoke all on function public\.vrm_bordereau_retirer_pdf[^;]*from public, anon, authenticated/.test(sqlS), 'C4 migration 044 : un id de bordereau de vente seulement, liste blanche de clés, `data || patch`, identité attendue, aucun DELETE, clé de service seule');
  const app = sansCom(lire('src/App.jsx'));
  dit(/'pdfPurged','pdfPurgeRaison'\]/.test(app) && /hasPdf: !purge,/.test(app) && /data-bord-supprime="versement"/.test(app) && /tr\('colis\.bordSupprimeVersement'\)/.test(app), 'C5 Colis : un bordereau au PDF retiré n’a plus de « Réimprimer » et dit « Bordereau supprimé après le versement »');
  dit(/purge==='versement'\)return\{etat:'supprime'\}/.test(lire('src/bordereauVestiaire.js')) && /etat === 'supprime' \? <span data-vc-bordereau-etat="supprime"/.test(app) && /select=b64:data->>b64,purge:data->>pdfPurgeRaison/.test(app), 'C6 Vestiaire : le bouton dit la suppression au lieu de « plus rangé »');
  dit(/b\.hasPdf === false \|\|/.test(lire('src/bordereauVenteEmail.js')), 'C7 une vente par e-mail au bordereau sans PDF n’est jamais « prête à imprimer »');
  const langues = ['fr', 'en', 'es', 'it', 'de'].map((l) => lire(`src/i18n/langues/${l}/colisplus.js`));
  dit(langues.every((t) => /"colis\.bordSupprimeVersement": "[^"]{8,}"/.test(t)), 'C8 la phrase existe dans les cinq langues');

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
