// ════════════════════════════════════════════════════════════════════════════
//  TRANSPORTEURS PARFAITS (9 nov. au soir) — EXÉCUTÉ. docs/passation/2026-11-09-transporteurs-parfaits.md
//  Julien : « Ce n'est pas possible d'avoir "transporteur inconnu" sachant que tu as les
//  bordereaux en ta possession. » ; « je veux que le suivi des colis soit parfait ».
//   P. La VRAIE route `api/ship-reminders.js?moment=colis` sur une fausse base PostgREST à
//      état, avec de VRAIS PDF fabriqués (pdf-lib) :
//      P1 le vendeur dont la ligne dit qu'il RESTE des étiquettes (`pdfReste` ≠ 0) voit TOUTES
//         ses étiquettes lues en un passage (15 > les 6 d'avant), un PDF par requête
//         (`select=pdf:data->>pdfB64`, `id=eq.`), jamais `select=data` sur un bordereau ;
//      P2 le résultat est rangé par n° de transaction (nommé / sans nom lisible), `pdfReste` 0,
//         `pdfBilan` en nombres ; la réponse ne porte que des nombres ;
//      P3 un vendeur sans marque (ou à 0) n'est pas visité pour ses étiquettes ;
//      P4 la sélection des étiquettes en panne ⇒ dite (`etiquettes.fait` faux), rien lu ;
//      P5 passage suivant : rien relu (idempotent).
//   Q. La passe (api/_lib/transporteur-anciens.js) : Q1 bornée en TEMPS (budget), le reste
//      compté ; Q2 la ligne est RELUE avant d'écrire (un autre passage en même temps n'est pas
//      effacé) ; Q3 relue illisible ⇒ rien écrit ; Q4 un PDF qui ne se lit pas n'est pas noté.
//   R. La VRAIE route `api/relais.js?mode=etiquettes` (l'app ouverte) : R1 sans session ⇒ 401,
//      rien lu ; R2 avec SA session : ses étiquettes lues, au nom de SA session seulement.
//   S. Le suivi : S1 le passage de 15 min visite aussi un vendeur dont la ligne `transp_` est
//      « inconnu »/« incident » relue il y a plus de 2 h, ou jamais répondue depuis 30 min.
//   T. Le lecteur de PDF tourne SANS `Buffer` (le navigateur l'utilise pour l'étiquette qu'il imprime).
//  Données inventées (aucun vrai n°). `--prouve` : chaque mutation rougit.
//  Lancer : node scripts/audit-transporteurs-parfaits.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'six PDF par passage, comme avant': [['api/_lib/colis-frequent.js', 'export const MAX_PDF_VENDEUR_FREQUENT = 40;', 'export const MAX_PDF_VENDEUR_FREQUENT = 6;']],
  'pas de passage des étiquettes à 15 min': [['api/ship-reminders.js', "et = !clOk ? { fait: false, raison: 'pas-su' } : temps < 4000", "et = true ? { fait: true, dus: 0 } : temps < 4000"]],
  'tous les vendeurs visités pour les étiquettes': [['api/_lib/colis-frequent.js', "export const REQ_ETIQUETTES_DUES = 'app_data?id=eq.vrm_bord_transporteurs&meta->>pdfReste=neq.0&select=owner';", "export const REQ_ETIQUETTES_DUES = 'app_data?id=eq.vrm_bord_transporteurs&select=owner';"]],
  'écriture sans relire la ligne': [['api/_lib/transporteur-anciens.js', 'const frais = await getRow(ID_BORD_TRANSPORTEURS);', 'const frais = cur;']],
  'budget de temps ignoré': [['api/_lib/transporteur-anciens.js', 'if (horloge() - debut >= budgetMs) { budgetAtteint = true; break; }', '']],
  'marque pdfReste jamais posée': [['api/_lib/transporteur-anciens.js', 'pdfReste: resteApres(), pdfAt: at', 'pdfAt: at']],
  'route de l’app absente': [['api/relais.js', "  if (mode === 'etiquettes') { await etiquettes(req, res); return; }", '']],
  'inconnu jamais relu à 15 min': [['api/_lib/colis-frequent.js', 'meta->>etat=in.(inconnu,incident,retour_expediteur)', 'meta->>etat=in.(aucun)']],
  'lecteur PDF au Buffer': [['api/_lib/texte-pdf.js', 'lireToUnicode(latin1(o))', "lireToUnicode(Buffer.from(o).toString('latin1'))"], ['api/_lib/texte-pdf.js', 'latin1(u.subarray(i, j))', "Buffer.from(u.subarray(i, j)).toString('latin1')"]],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

const fs = require('fs');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 260)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── L'environnement des routes ──────────────────────────────────────────────
const A = '11111111-0000-4000-8000-00000000000a', B = '11111111-0000-4000-8000-00000000000b', Cv = '11111111-0000-4000-8000-00000000000c', D = '11111111-0000-4000-8000-00000000000d', E = '11111111-0000-4000-8000-00000000000e';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.CRON_SECRET = 'cle-banc-cron';
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
try { const wp = require(path.join(R, 'node_modules', 'web-push')); wp.setVapidDetails = () => {}; wp.sendNotification = async () => ({ statusCode: 201 }); } catch (_) {}

// ── Une fausse base à état, à la forme de PostgREST (la même qu'audit-statut-transporteurs) ──
const base = new Map();
const pannes = new Set();
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
const metaDe = (d) => { const m = {}; if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) { if (v == null || typeof v === 'object') continue; const s = String(v); if (s.length <= 600) m[k] = s; } if (d && d.pdfB64) m._pdf = 'true'; return m; };  // la règle SQL : `_pdf` quand la ligne porte un PDF
const valeur = (l, k) => {
  if (k === 'id') return l.id; if (k === 'owner') return l.owner;
  if (k.startsWith('meta->>')) return metaDe(l.data)[k.slice(7)];
  if (k.startsWith('data->>') || k.startsWith('data->')) { const v = chemin(l.data, k.replace(/^data(->>|->)/, '')); return v == null ? undefined : (typeof v === 'object' ? JSON.stringify(v) : String(v)); }
  return undefined;
};
const teste = (x, op) => {
  const i = op.indexOf('.'); const o = op.slice(0, i), v = op.slice(i + 1).replace(/^"|"$/g, '');
  if (o === 'eq') return x === v;
  if (o === 'neq') return x !== v;
  if (o === 'lt') return x != null && x < v;
  if (o === 'lte') return x != null && x <= v;
  if (o === 'gt') return x != null && x > v;
  if (o === 'gte') return x != null && x >= v;
  if (o === 'like' || o === 'ilike') { const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', o === 'ilike' ? 'i' : ''); return x != null && re.test(x); }
  if (o === 'in') return v.replace(/^\(|\)$/g, '').split(',').map((y) => y.replace(/^"|"$/g, '')).includes(x);
  if (o === 'is') return v === 'null' ? x == null : true;
  if (o === 'not') return !teste(x, v);
  return true;
};
const decoupeOr = (s) => { const out = []; let p = 0, cur = ''; for (const ch of s.replace(/^\(|\)$/g, '')) { if (ch === '(') p++; if (ch === ')') p--; if (ch === ',' && !p) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; };
const filtrer = (u) => {
  const conds = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'limit', 'order', 'offset'].includes(k)) continue;
    if (k === 'or') { const alts = decoupeOr(v).map((e) => { const j = e.indexOf('.'); const kk = e.slice(0, j); const rest = e.slice(j + 1); return [kk, rest]; }); conds.push((l) => alts.some(([kk, op]) => teste(valeur(l, kk), op))); continue; }
    conds.push((l) => teste(valeur(l, k), v));
  }
  return [...base.entries()].map(([cle, d]) => { const i = cle.indexOf('|'); return { owner: cle.slice(0, i), id: cle.slice(i + 1), data: d }; }).filter((l) => conds.every((c) => c(l)));
};
const projeter = (l, sel) => {
  if (!sel || sel === '*') return { owner: l.owner, id: l.id, data: l.data };
  const o = {};
  for (const part of sel.split(',')) {
    const [alias, ch] = part.includes(':') ? part.split(/:(.+)/) : [part.split(/->>|->/).pop(), part];
    if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
    if (ch === 'data') { o[alias] = l.data; continue; }
    if (ch.startsWith('meta->>')) { const v = metaDe(l.data)[ch.slice(7)]; o[alias] = v == null ? null : v; continue; }
    const v = chemin(l.data, ch.replace(/^data(->>|->)/, ''));
    o[alias] = v === undefined ? null : (/->>[^>]*$/.test(ch) && v != null && typeof v !== 'object' ? String(v) : v);
  }
  return o;
};
const appels = [];            // ce qui part chez un transporteur
const lectures = [];          // chaque lecture de NOTRE base : { owner, chemin }
const HOTES_TRANSP = /(^|\.)(chronopost\.fr|vintedgo\.com|mondialrelay\.(?:fr|be))$/;
let reponseTransporteur = () => null;
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (HOTES_TRANSP.test(u.hostname)) { appels.push({ host: u.hostname, url: String(url) }); const r = reponseTransporteur(u); if (!r) throw new TypeError('fetch failed'); return new Response(r.body, { status: r.status, headers: { 'content-type': r.ctype || 'application/json' } }); }
  if (u.pathname === '/auth/v1/user') return String((h.Authorization || h.authorization || '')).includes('jeton-de-a') ? rep({ id: A, email: 'a@exemple.test' }) : rep({ msg: 'non' }, 401);
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname === '/rest/v1/vinted_accounts') return rep([]);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  const brut = decodeURIComponent(u.pathname + u.search);
  if (m === 'POST') {
    const prefer = String(h.Prefer || h.prefer || '');
    const faits = [];
    for (const r of JSON.parse(opts.body || '[]')) { const cle = `${r.owner || A}|${r.id}`; if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue; base.set(cle, r.data); faits.push({ id: r.id }); }
    return /return=representation/.test(prefer) ? rep(faits, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') { const corps = JSON.parse(opts.body || '{}'); const t = filtrer(u); for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data); return rep(t.map((l) => ({ id: l.id }))); }
  if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
  lectures.push({ owner: u.searchParams.get('owner') ? u.searchParams.get('owner').replace(/^eq\./, '') : null, chemin: brut });
  for (const p of pannes) if (brut.includes(p)) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // base cloisonnée
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };
const NOW = Date.now(), MIN = 60000, H = 3600000;
const iso = (ms) => new Date(ms).toISOString();
const vgJson = (evs) => JSON.stringify({ tracking_events: evs.map((e, i) => ({ id: 'ev' + i, message: e.message || e.group, timestamp: iso(e.ms), metadata: { address: e.address || '' }, banner_message: null, group_header: null, group: e.group, state: e.state || 'delivery' })), meta: {} });
const email = (owner, carrier, suivi, o = {}) => base.set(`${owner}|email_track_${carrier}_${suivi}`, { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, code: '900001', lieu: 'TABAC TEST, 1 RUE EXEMPLE, 99999 TESTVILLE', emailAt: iso(NOW - 2 * 86400000), receivedAt: iso(NOW - 2 * 86400000), arriveLe: iso(NOW - 2 * 86400000), ...o });
const transp = (owner, carrier, suivi, o = {}) => base.set(`${owner}|transp_${carrier}_${suivi}`, { v: 1, rev: 1, carrier, suivi, etat: 'disponible', detail: null, etatAt: iso(NOW - 2 * 86400000), libelle: 'Prêt', lu: iso(NOW - 20 * MIN), source: 'serveur', essai: iso(NOW - 20 * MIN), essaiRes: 'ok', essais: 0, voie: carrier === 'vinted' ? 'vg-v3' : 'cp-ws2', fini: false, evenements: [], ...o });


const { PDFDocument, StandardFonts } = require(path.join(R, 'node_modules', 'pdf-lib'));
const fab = async (lignes) => { const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); const p = d.addPage([283, 425]); lignes.forEach((l, i) => p.drawText(l, { x: 10, y: 400 - 16 * i, font: f, size: 10 })); return Buffer.from(await d.save()).toString('base64'); };
const TXA = Array.from({ length: 15 }, (_, i) => String(52000000000 + i));
const bord = (owner, tx, pdfB64, o = {}) => base.set(`${owner}|email_bord_${tx}`, { uid: '1', type: 'bordereau', transaction: tx, modele: 'Paire test', suivi: '', receivedAt: iso(NOW - (20 - Number(tx.slice(-2))) * H), filename: `bordereau_${tx}.pdf`, pdfB64, ...o });

(async () => {
  const pMR = await fab(['Mondial Relay', 'N° de suivi : 87650011']);
  const pCH = await fab(['Chronopost', 'XW123450011TS']);
  const pRien = await fab(['Expediteur : test', 'Destinataire : test']);
  await essaie('P la route ?moment=colis lit TOUTES les étiquettes restantes', async () => {
    TXA.forEach((tx, i) => bord(A, tx, i % 3 === 0 ? pMR : i % 3 === 1 ? pCH : pRien));
    base.set(`${A}|vrm_bord_transporteurs`, { v: 1, parTx: {}, pdfReste: 15 });
    bord(B, '53000000001', pMR); base.set(`${B}|vrm_bord_transporteurs`, { v: 1, pdfReste: 0 });
    bord(Cv, '54000000001', pMR);   // jamais passé : aucune marque ⇒ le cron du matin ou l'app
    const route = (await importer('api/ship-reminders.js')).default;
    const res = faireRes(); const l0 = lectures.length;
    await route({ method: 'GET', query: { moment: 'colis' }, headers: { authorization: 'Bearer cle-banc-cron' } }, res);
    const lu = lectures.slice(l0);
    const pdfA = lu.filter((x) => /pdfB64/.test(x.chemin) && x.owner === A);
    dit(pdfA.length === 15, 'P1 les 15 étiquettes de A lues en UN passage (plus 6 par jour)', String(pdfA.length));
    dit(pdfA.length && pdfA.every((x) => /id=eq\.email_bord_\d+/.test(x.chemin) && /select=pdf:data->>pdfB64(&|$)/.test(x.chemin)), 'P1 un PDF par requête, rien d’autre que le PDF', pdfA.slice(0, 1).map((x) => x.chemin).join(' | '));
    dit(!lu.some((x) => /email_bord/.test(x.chemin) && /select=data(&|$)/.test(x.chemin)), 'P1 jamais `select=data` sur un bordereau (§4.4)');
    const l = base.get(`${A}|vrm_bord_transporteurs`) || {};
    const nommes = Object.keys(l.pdf || {}), vus = Object.keys(l.pdfVus || {});
    dit(nommes.length === 10 && vus.length === 5 && l.pdf[TXA[0]] && l.pdf[TXA[0]].t === 'mondialrelay' && l.pdf[TXA[0]].s === '87650011' && l.pdf[TXA[1]].t === 'chronopost' && l.pdfVus[TXA[2]].r === 'aucun', 'P2 rangé par n° de transaction : 10 nommées (n° de forme propre gardé), 5 « aucun nom lisible »', JSON.stringify({ n: nommes.length, v: vus.length }));
    dit(l.pdfReste === 0 && l.pdfBilan && l.pdfBilan.nommes === 10 && l.pdfBilan.aucun === 5, 'P2 `pdfReste` 0 et le bilan en nombres', JSON.stringify({ r: l.pdfReste, b: l.pdfBilan }));
    const et = res.corps && res.corps.etiquettes;
    dit(et && et.fait && et.dus === 1 && et.lus === 15 && et.restants === 0, 'P2 la réponse dit le passage des étiquettes (nombres)', JSON.stringify(et));
    const txt = JSON.stringify(res.corps || {});
    dit(![A, B, Cv].some((o) => txt.includes(o)) && !/52000000000|87650011/.test(txt), 'P2 aucun vendeur ni n° dans la réponse');
    dit(!lu.some((x) => /pdfB64/.test(x.chemin) && (x.owner === B || x.owner === Cv)), 'P3 ni B (rien ne reste) ni C (jamais passé) ne sont visités pour leurs étiquettes');
    const res2 = faireRes(); const l1 = lectures.length;
    await route({ method: 'GET', query: { moment: 'colis' }, headers: { authorization: 'Bearer cle-banc-cron' } }, res2);
    dit(!lectures.slice(l1).some((x) => /pdfB64/.test(x.chemin)), 'P5 passage suivant : aucun PDF relu (idempotent)');
    base.set(`${A}|vrm_bord_transporteurs`, { ...base.get(`${A}|vrm_bord_transporteurs`), pdfReste: 3 });
    pannes.add('meta->>pdfReste=neq.0');
    const res3 = faireRes(); const l2 = lectures.length;
    await route({ method: 'GET', query: { moment: 'colis' }, headers: { authorization: 'Bearer cle-banc-cron' } }, res3);
    const et3 = res3.corps && res3.corps.etiquettes;
    dit(et3 && et3.fait === false && et3.raison === 'pas-su' && !lectures.slice(l2).some((x) => /pdfB64/.test(x.chemin)), 'P4 sélection des étiquettes en panne ⇒ dit « pas su », aucun PDF lu', JSON.stringify(et3));
    pannes.clear();
  });

  await essaie('Q la passe : budget, relecture avant d’écrire', async () => {
    const X = await importer('api/_lib/transporteur-anciens.js');
    const bords = TXA.map((tx) => ({ id: 'email_bord_' + tx, tx, pdfLu: null, transporteur: null, suivi: '', recu: iso(NOW - Number(tx.slice(-2)) * H) }));
    let t = 0; const horloge = () => t;
    let ligne = { v: 1 };
    const deps = { lireTout: async (p) => (/email_bord/.test(p) ? bords : []), getRow: async () => ligne, ecrire: async (id, d) => { ligne = d; return true; },
      lirePdf: async () => { t += 1000; return pMR; }, horloge, max: 100, budgetMs: 7000 };
    const r = await X.passeTransporteursPdf(deps);
    dit(r.fait && r.lus === 7 && r.budgetAtteint && r.restants === 8 && ligne.pdfReste === 8, 'Q1 bornée en TEMPS : 7 lues dans 7 s, 8 restantes comptées (`pdfReste`)', JSON.stringify(r));
    t = 0; ligne = { v: 1 }; let n = 0;
    const deps2 = { ...deps, budgetMs: Infinity, lirePdf: async () => { n++; if (n === 12) ligne = { ...ligne, pdf: { ...(ligne.pdf || {}), 59999999999: { t: 'chronopost' } } }; return pMR; } };
    await X.passeTransporteursPdf(deps2);
    dit(ligne.pdf && ligne.pdf['59999999999'] && Object.keys(ligne.pdf).length === 16, 'Q2 la ligne est RELUE avant chaque écriture : ce qu’un autre passage y a rangé reste', JSON.stringify(Object.keys(ligne.pdf || {}).length));
    ligne = { v: 1 }; let lectureRow = 0; const ecr3 = [];
    const deps3 = { ...deps, budgetMs: Infinity, getRow: async () => (++lectureRow > 1 ? undefined : ligne), ecrire: async (id, d) => { ecr3.push(d); return true; } };
    const r3 = await X.passeTransporteursPdf(deps3);
    dit(!r3.fait && ecr3.length === 0, 'Q3 ligne relue illisible au moment d’écrire ⇒ rien écrit', JSON.stringify(r3));
    ligne = { v: 1 };
    const deps4 = { ...deps, budgetMs: Infinity, lirePdf: async () => null };
    const r4 = await X.passeTransporteursPdf(deps4);
    dit(r4.fait && r4.rates === 15 && !Object.keys(ligne.pdf || {}).length && !Object.keys(ligne.pdfVus || {}).length && ligne.pdfReste === 15, 'Q4 un PDF qui ne se lit pas n’est pas noté (relu plus tard), le reste reste compté', JSON.stringify({ rates: r4.rates, reste: ligne.pdfReste }));
  });

  await essaie('R la route de l’app ?mode=etiquettes', async () => {
    ['56000000001', '56000000002'].forEach((tx) => base.set(`${D}|email_bord_${tx}`, { transaction: tx, suivi: '', receivedAt: iso(NOW - H), filename: 'b.pdf', pdfB64: pCH }));
    base.set(`${A}|email_bord_57000000001`, { transaction: '57000000001', suivi: '', receivedAt: iso(NOW - H), filename: 'b.pdf', pdfB64: pCH });
    const relais = (await importer('api/relais.js')).default;
    const r1 = faireRes(); const l0 = lectures.length;
    await relais({ method: 'POST', query: { mode: 'etiquettes' }, headers: {}, body: { v: 1 } }, r1);
    dit(r1.code === 401 && !lectures.slice(l0).some((x) => /pdfB64/.test(x.chemin)), 'R1 sans session ⇒ 401, aucun PDF lu', String(r1.code));
    const r2 = faireRes(); const l1 = lectures.length;
    await relais({ method: 'POST', query: { mode: 'etiquettes' }, headers: { authorization: 'Bearer aa.jeton-de-a.bb' }, body: { v: 1 } }, r2);
    const lus = lectures.slice(l1).filter((x) => /pdfB64/.test(x.chemin));
    const la = base.get(`${A}|vrm_bord_transporteurs`) || {};
    dit(r2.code === 200 && r2.corps && r2.corps.ok && lus.length >= 1 && lus.every((x) => x.owner === A) && la.pdf && la.pdf['57000000001'] && la.pdf['57000000001'].t === 'chronopost', 'R2 avec SA session : ses étiquettes lues et rangées, au nom de SA session seulement', JSON.stringify({ code: r2.code, corps: r2.corps, owners: [...new Set(lus.map((x) => String(x.owner).slice(-1)))] }));
    dit(!(base.get(`${D}|vrm_bord_transporteurs`) || {}).pdf, 'R2 les étiquettes d’un autre vendeur ne sont pas touchées');
  });

  await essaie('S le suivi : « inconnu » et « jamais répondu » relus à 15 min', async () => {
    const F = await importer('api/_lib/colis-frequent.js');
    const q = F.requetesColisDus(NOW);
    const E2 = '11111111-0000-4000-8000-00000000000f';
    base.clear();
    transp(E2, 'chronopost', 'XW000000077TS', { etat: 'inconnu', essai: iso(NOW - 3 * H), lu: iso(NOW - 3 * H) });
    transp(B, 'chronopost', 'XW000000078TS', { etat: undefined, essai: iso(NOW - 45 * MIN), lu: undefined, essaiRes: 'passu' });
    transp(Cv, 'chronopost', 'XW000000079TS', { etat: 'inconnu', essai: iso(NOW - 30 * MIN) });
    const reps = [];
    for (const c of q) { const u = new URL('https://x.supabase.co/rest/v1/' + c); reps.push(filtrer(u).map((l) => ({ owner: l.owner }))); }
    const dus = F.vendeursDus(reps);
    dit(dus.includes(E2) && dus.includes(B) && !dus.includes(Cv), 'S1 « inconnu » relu il y a 3 h et une ligne jamais répondue depuis 45 min ⇒ visités ; « inconnu » relu il y a 30 min ⇒ pas encore', JSON.stringify(dus.map((o) => o.slice(-1))));
  });

  await essaie('T le lecteur de PDF sans Buffer', async () => {
    const tp = await importer('api/_lib/transporteur-pdf.js');
    const octets = Uint8Array.from(Buffer.from(pMR, 'base64'));
    const garde = global.Buffer; let d;
    try { global.Buffer = undefined; d = await tp.transporteurDuPdf(octets); } finally { global.Buffer = garde; }
    dit(d && d.etat === 'ok' && d.t === 'mondialrelay' && d.s === '87650011', 'T1 l’étiquette lue sans `Buffer` (comme dans le navigateur) : Mondial Relay + son n°', JSON.stringify(d));
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + ((e && e.stack) || e)); process.exit(1); });
