#!/usr/bin/env node
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT — LES E-MAILS DE TRANSFERT, DE BOUT EN BOUT (10 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Commence à câbler la création des e-mails de transfert. »
// Ce contrôle EXÉCUTE, sur une fausse base à état (la forme réelle : projections
// `select=`, `data->>`, index neutre, PATCH comparer-et-échanger) :
//   · le Worker Cloudflare À COLLER (cloudflare/worker-reception.js) avec un vrai
//     e-mail MIME, puis ce qu'il envoie à la VRAIE route api/email-inbound.js ;
//   · la route de la feuille (api/email-rattacher.js?mode=adresse-unique).
//   A. le Worker : sans paquet, POST vers /api/email-inbound avec la clé en
//      en-tête, l'e-mail BRUT et l'enveloppe ; e-mail adressé au jeton d'un
//      vendeur ⇒ rangé chez LUI (pas chez le vendeur dont la boîte est en To) ;
//   B. VRM ne range pas (503) ⇒ le Worker LÈVE (Cloudflare fait renvoyer) ;
//   C. jeton inconnu ⇒ quarantaine NEUTRE, rien chez personne ;
//   D. e-mail trop lourd ⇒ l'essentiel arrive quand même chez lui, dit ;
//   E. l'e-mail d'essai : « Essai VRM K7P2 » ⇒ SON code rangé chez lui, rendu
//      par SA route seulement ; un autre vendeur ne le voit jamais ; un sujet
//      sans code ne range rien ; le code de l'app est celui que lit le serveur ;
//      « Reçu ✓ » se juge sur le CODE (un autre code récent ne vaut pas) ;
//   F. sans domaine configuré : la route le DIT (pret:false, manque:domaine),
//      aucune adresse ; au SEUL propriétaire, ce qui manque (états, jamais une
//      valeur) ; domaine mal écrit ⇒ « mal-forme » ;
//   G. le Worker de la notice de Julien est, octet pour octet, le fichier testé ;
//   H. Paramètres → Mes e-mails : la ligne « Mon adresse VRM » ouvre la feuille,
//      À CÔTÉ des SMS de colis (gardés), et la notice y mène.
// `--src <arbre>` : le lance sur un autre arbre (preuve sur origin/main).
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
const RACINE = arg('--src') ? path.resolve(arg('--src')) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String((e && e.stack) || e).slice(0, 400)); } };

const NEUTRE = '00000000-0000-0000-0000-000000000000';
const uid = (i) => `${String(i).padStart(8, '0')}-2222-4222-8222-${String(i).padStart(12, '0')}`;
const J = uid(1), B = uid(2), C = uid(3);
const DOMAINE = 'recu-transfert.test';
const CLE = 'cle-banc-transfert';
process.env.VRM_OWNER_UID = J;
process.env.EMAIL_INBOUND_SECRET = CLE;
process.env.SUPABASE_SERVICE_KEY = 'service-banc-transfert';
process.env.DOMAINE_RECEPTION = DOMAINE;
const jwt = (sub) => 'x.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.y';
const UTIL = {};
for (let i = 1; i <= 5; i++) UTIL[jwt(uid(i))] = { id: uid(i), email: `vendeur${i}@exemple.test`, email_confirmed_at: '2026-10-01T00:00:00Z' };

// ── La fausse base (même forme que scripts/audit-adresse-reception.cjs) ──────
let base = [];
let panne = null;
const rep = (corps, status = 200, h = {}) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json', ...h } });
const champ = (r, chemin) => {
  if (chemin === 'id' || chemin === 'owner') return r[chemin];
  if (chemin === 'data') return r.data;
  const m = /^(data|meta)(->>|->)(.+)$/.exec(chemin); if (!m) return undefined;
  let v = r.data; for (const seg of m[3].split(/->>|->/)) v = v == null ? undefined : v[seg];
  return m[2] === '->>' && v != null && typeof v === 'object' ? JSON.stringify(v) : v;
};
const filtrer = (params) => {
  let rows = base.slice();
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'on_conflict', 'offset'].includes(k)) continue;
    if (k === 'id' && v.startsWith('eq.')) rows = rows.filter((r) => r.id === v.slice(3));
    else if (k === 'id' && v.startsWith('like.')) { const re = new RegExp('^' + v.slice(5).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$'); rows = rows.filter((r) => re.test(r.id)); }
    else if (k === 'id' && v.startsWith('in.(')) { const l = v.slice(4, -1).split(','); rows = rows.filter((r) => l.includes(r.id)); }
    else if (k === 'owner' && v.startsWith('eq.')) rows = rows.filter((r) => r.owner === v.slice(3));
    else if (/^(data|meta)->>/.test(k) && v === 'is.null') rows = rows.filter((r) => champ(r, k) == null);
    else if (/^(data|meta)->>/.test(k) && v.startsWith('eq.')) rows = rows.filter((r) => champ(r, k) != null && String(champ(r, k)) === v.slice(3));
    else if (/^(data|meta)->>/.test(k) && v.startsWith('gt.')) rows = rows.filter((r) => champ(r, k) != null && String(champ(r, k)) > v.slice(3));
    else return rows;
  }
  return rows;
};
const faireRes = () => { const x = { code: null, corps: null, h: {} }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = (k, v) => { x.h[k] = v; }; x.send = () => x; x.end = () => x; return x; };
let inbound = null;
const envoisWorker = [];
const fauxFetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  // Le Worker appelle VRM : on donne sa requête à la VRAIE route.
  if (/^https:\/\/[^/]+\/api\/email-inbound/.test(u)) {
    const h = {}; for (const [k, v] of Object.entries(opts.headers || {})) h[k.toLowerCase()] = v;
    envoisWorker.push({ url: u, headers: h, body: opts.body });
    const r = faireRes();
    await inbound.default({ method: m, query: {}, headers: h, body: opts.body }, r);
    return new Response(JSON.stringify(r.corps || {}), { status: r.code || 500, headers: { 'content-type': 'application/json' } });
  }
  const auth = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '').replace(/^Bearer\s+/i, '');
  if (u.includes('/auth/v1/user')) return UTIL[auth] ? rep(UTIL[auth]) : rep({ msg: 'invalid' }, 401);
  if (u.includes('/rest/v1/rpc/')) return rep(true);
  if (!u.includes('/rest/v1/app_data')) return m === 'GET' ? rep([]) : rep('', 201);
  const q = u.split('?')[1] || '';
  const params = q.split('&').filter(Boolean).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; });
  const get = (k) => (params.find((p) => p[0] === k) || [])[1];
  if (m === 'POST') {
    let arr = []; try { arr = JSON.parse(opts.body || '[]'); } catch (_) {}
    arr = Array.isArray(arr) ? arr : [arr];
    if (panne && arr.some((x) => panne('POST', x.id, x.owner || ''))) return rep({ message: 'panne' }, 503);
    const ignorer = /ignore-duplicates/.test(String((opts.headers && opts.headers.Prefer) || ''));
    for (const x of arr) {
      const i = base.findIndex((r) => r.id === x.id && r.owner === (x.owner || ''));
      const l = { owner: x.owner || '', id: x.id, data: x.data };
      if (i >= 0) { if (!ignorer) base[i] = l; } else base.push(l);
    }
    return rep('', 201);
  }
  if (/^select=owner&limit=1$/.test(q)) return rep([{ owner: J }]);
  if (panne && panne(m, get('id') ? get('id').replace(/^eq\./, '') : '', get('owner') ? get('owner').replace(/^eq\./, '') : '')) return rep({ message: 'panne' }, 503);
  let rows = filtrer(params);
  if (m === 'PATCH') { let c = {}; try { c = JSON.parse(opts.body || '{}'); } catch (_) {} for (const r of rows) Object.assign(r, { data: c.data !== undefined ? c.data : r.data }); return rep(rows.map((r) => ({ id: r.id, owner: r.owner, data: r.data }))); }
  if (m === 'DELETE') { const s = new Set(rows); base = base.filter((r) => !s.has(r)); return rep('', 204); }
  if (get('limit')) rows = rows.slice(0, +get('limit'));
  const sel = get('select');
  const proj = (r) => { if (!sel) return { id: r.id, owner: r.owner, data: r.data }; const o = {}; for (const it of sel.split(',')) { const i = it.indexOf(':'); const [al, ch] = i > 0 ? [it.slice(0, i), it.slice(i + 1)] : [it.replace(/^.*(->>|->)/, ''), it]; const v = champ(r, ch); o[al] = v === undefined ? null : v; } return o; };
  return rep(rows.map(proj));
};
global.fetch = fauxFetch;
const registre = (owner, adresses) => ({ owner, id: 'vrm_email_owners', data: { adresses: Object.fromEntries(adresses.map((a) => [a, { owner, label: '', at: '2026-10-20T10:00:00Z' }])) } });

// Un vrai e-mail MIME (ce que Cloudflare met dans `message.raw`), transféré par la
// boîte du vendeur : l'en-tête To garde SA boîte d'origine ; l'enveloppe, elle,
// est son adresse VRM.
let nMsg = 0;
const mime = ({ sujet, de = 'Vinted <no-reply@vinted.fr>', to = 'sophie@gmail.com', corps = '', piece = '' }) => { nMsg++; return [
  'Received: from mail-sor-f41.google.com (mail-sor-f41.google.com [209.85.220.41])',
  `From: ${de}`, `To: ${to}`, `Subject: ${sujet}`, `Message-ID: <transfert-${nMsg}@vinted.fr>`,
  'Date: Tue, 10 Nov 2026 10:00:00 +0100', 'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="xx"', '',
  '--xx', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '',
  corps || `Bonjour,\n\nacheteuse_banc a acheté\n\nNike Air banc ${sujet} - Taille 42\n\n30,00 €\n\nL'équipe Vinted`,
  ...(piece ? ['--xx', 'Content-Type: application/pdf; name="bordereau.pdf"', 'Content-Transfer-Encoding: base64', 'Content-Disposition: attachment; filename="bordereau.pdf"', '', piece] : []),
  '--xx--', ''].join('\r\n'); };
const message = (raw, to, en = {}) => ({ raw, to, from: 'bounce+srs=sophie@gmail.com', headers: new Headers({ 'Authentication-Results': 'mx.cloudflare.net; dkim=pass', ...en }) });

(async () => {
  let worker, ratt, lib, app;
  await essaie('chargement', async () => {
    inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js'));
    ratt = await import('file://' + path.join(RACINE, 'api', 'email-rattacher.js'));
    lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'adresse-reception.js'));
  });
  await essaie('chargement du Worker', async () => { worker = (await import('file://' + path.join(RACINE, 'cloudflare', 'worker-reception.js'))).default; });
  await essaie('chargement des mots de la feuille', async () => { app = await import('file://' + path.join(RACINE, 'src', 'adresseReception.js')); });
  if (!inbound || !ratt || !lib) { console.log(`\n${ok} ✅ · ${ko + 1} ❌ — les routes ne se chargent pas`); process.exit(1); }
  dit(!!(worker && typeof worker.email === 'function'), 'le Worker à coller existe (cloudflare/worker-reception.js) et exporte `email()`');

  const route = async (owner) => { const r = faireRes(); await ratt.default({ method: 'GET', query: { mode: 'adresse-unique' }, headers: { authorization: 'Bearer ' + jwt(owner) }, body: undefined }, r); return r; };
  const ENV = { EMAIL_INBOUND_SECRET: CLE, VRM_URL: 'https://vrm.banc' };
  const lancer = async (msg, env = ENV) => { try { await worker.email(msg, env, { waitUntil() {} }); return { ok: true }; } catch (e) { return { leve: String(e && e.message || e) }; } };
  const recuChez = (owner, marque) => base.some((x) => x.owner === owner && /^email_reception_/.test(x.id) && String((x.data && x.data.subject) || '').includes(marque));
  const ailleurs = (marque, sauf) => base.filter((x) => x.owner !== sauf && x.owner !== NEUTRE && JSON.stringify(x.data || '').includes(marque)).map((x) => x.owner + ':' + x.id);
  const quarantaines = (marque) => base.filter((x) => x.owner === NEUTRE && /^email_quarantaine_/.test(x.id) && JSON.stringify(x.data || '').includes(marque));

  base = [registre(J, ['proprio@boutique.test']), registre(C, ['sophie@gmail.com'])];
  const aB = (await route(B)).corps.adresse, aC = (await route(C)).corps.adresse;
  dit(/@recu-transfert\.test$/.test(aB || '') && /@recu-transfert\.test$/.test(aC || '') && aB !== aC, 'deux vendeurs, deux adresses VRM (fabriquées par la route de la feuille)', `${aB} · ${aC}`);

  // ── A. Le Worker, de bout en bout ──────────────────────────────────────────
  await essaie('A', async () => {
    if (!worker) { dit(false, 'A. le Worker ne se charge pas'); return; }
    const src = fs.readFileSync(path.join(RACINE, 'cloudflare', 'worker-reception.js'), 'utf8').replace(/\/\/.*$/gm, '');
    dit(!/^\s*import\s/m.test(src) && !/require\(/.test(src), 'A. aucun paquet à installer (rien d’importé) : il se colle tel quel dans Cloudflare');
    envoisWorker.length = 0;
    const r = await lancer(message(mime({ sujet: "Ton article s'est vendu ! MARQUEA1" }), aB));
    const e = envoisWorker[0] || {};
    let corps = {}; try { corps = JSON.parse(e.body || '{}'); } catch (_) {}
    dit(r.ok && e.url === 'https://vrm.banc/api/email-inbound' && e.headers['x-vrm-email-key'] === CLE && !/key=/.test(e.url), 'A. POST vers /api/email-inbound, la clé en EN-TÊTE (jamais dans l’adresse, qui finit dans les journaux)', e.url);
    dit(typeof corps.raw === 'string' && /^Received:/m.test(corps.raw) && corps.envelopeTo === aB && /dkim=pass/.test(corps.authentification || ''), 'A. il transmet l’e-mail BRUT, l’enveloppe (son adresse VRM) et l’authentification', JSON.stringify({ env: corps.envelopeTo, auth: corps.authentification }));
    dit(recuChez(B, 'MARQUEA1') && ailleurs('MARQUEA1', B).length === 0, 'A. rangé chez B — alors que l’en-tête To nomme la boîte déclarée par C', ailleurs('MARQUEA1', B).join(' · '));
    const vu = (await route(B)).corps.dernier;
    dit(vu && /MARQUEA1/.test(vu.sujet) && /vinted/i.test(vu.de), 'A. « Dernier e-mail reçu » le montre (sujet et expéditeur lus dans le MIME)', JSON.stringify(vu));
    // Une pièce jointe (le bordereau) traverse aussi.
    await lancer(message(mime({ sujet: 'Bordereau MARQUEA2', piece: Buffer.from('%PDF-1.4 banc').toString('base64') }), aB));
    const ligne = base.find((x) => x.owner === B && /^email_reception_/.test(x.id) && /MARQUEA2/.test(String(x.data && x.data.subject)));
    dit(ligne && JSON.stringify(ligne.data).includes('bordereau.pdf'), 'A. la pièce jointe (le bordereau) arrive avec lui', ligne ? JSON.stringify(ligne.data.pieces || ligne.data).slice(0, 120) : 'pas rangé');
  });

  // ── B. VRM ne range pas ⇒ le Worker lève (Cloudflare fait renvoyer) ───────
  await essaie('B', async () => {
    if (!worker) { dit(false, 'B. le Worker ne se charge pas'); return; }
    panne = (m, id) => m === 'GET' && /^jeton_reception_/.test(id);
    const r = await lancer(message(mime({ sujet: 'MARQUEB1' }), aB));
    panne = null;
    dit(!!r.leve && /503/.test(r.leve) && !recuChez(B, 'MARQUEB1'), 'B. base injoignable ⇒ 503 ⇒ le Worker LÈVE : l’e-mail sera renvoyé, pas perdu', r.leve || 'acquitté');
    const r2 = await lancer(message(mime({ sujet: 'MARQUEB2' }), aB), { EMAIL_INBOUND_SECRET: 'mauvaise-cle', VRM_URL: 'https://vrm.banc' });
    dit(!!r2.leve && /401/.test(r2.leve) && !recuChez(B, 'MARQUEB2'), 'B. mauvaise clé dans le Worker ⇒ 401 ⇒ il lève (renvoyé quand la clé sera bonne)', r2.leve || 'acquitté');
  });

  // ── C. Jeton inconnu ⇒ quarantaine neutre ─────────────────────────────────
  await essaie('C', async () => {
    if (!worker) { dit(false, 'C. le Worker ne se charge pas'); return; }
    const inconnu = 'k7p2m9x4q8w3e6r5t2y7u9a3@' + DOMAINE;
    const r = await lancer(message(mime({ sujet: 'MARQUEC1' }), inconnu));
    dit(r.ok && quarantaines('MARQUEC1').length === 1 && ailleurs('MARQUEC1', '').length === 0, 'C. jeton inconnu ⇒ gardé en quarantaine NEUTRE, chez personne, jamais jeté', `${quarantaines('MARQUEC1').length} en quarantaine · ailleurs : ${ailleurs('MARQUEC1', '').join(' · ')}`);
  });

  // ── D. Trop lourd ─────────────────────────────────────────────────────────
  await essaie('D', async () => {
    if (!worker) { dit(false, 'D. le Worker ne se charge pas'); return; }
    envoisWorker.length = 0;
    const gros = mime({ sujet: 'Gros MARQUED1', piece: 'A'.repeat(4100000) });
    const r = await lancer(message(gros, aB, { From: 'Vinted <no-reply@vinted.fr>', Subject: 'Gros MARQUED1', 'Message-ID': '<gros@vinted.fr>' }));
    let corps = {}; try { corps = JSON.parse((envoisWorker[0] || {}).body || '{}'); } catch (_) {}
    dit(r.ok && !corps.raw && corps.tropLourd === true && (envoisWorker[0] || {}).body.length < 100000 && recuChez(B, 'MARQUED1'), 'D. plus de 4 Mo ⇒ l’essentiel part (expéditeur, sujet, enveloppe), il est rangé chez lui et le dit', `${((envoisWorker[0] || {}).body || '').length} octets envoyés`);
  });

  // ── E. L'e-mail d'essai ────────────────────────────────────────────────────
  await essaie('E', async () => {
    if (!worker || !app) { dit(false, 'E. le Worker ou les mots de la feuille ne se chargent pas'); return; }
    // Le code de l'app est lu par le serveur, pour tout tirage.
    let accord = 0; const vus = new Set();
    for (let i = 0; i < 2000; i++) { const c = app.nouveauCodeEssai(); vus.add(c); if (lib.codeEssaiDe && lib.codeEssaiDe(app.sujetEssai(c)) === c && lib.codeEssaiDe('TR: ' + app.sujetEssai(c) + ' (transféré)') === c) accord++; }
    dit(accord === 2000 && vus.size > 1500, 'E. chaque code tiré par l’app est relu tel quel par le serveur (même alphabet, aussi derrière « TR: »)', `${accord}/2000 · ${vus.size} distincts`);
    dit(typeof lib.codeEssaiDe === 'function' && lib.codeEssaiDe('Ton article s’est vendu') === '' && lib.codeEssaiDe('Essai VRM') === '' && lib.codeEssaiDe('Essai VRM K7P2X9Q4W3') === '', 'E. un sujet sans code (ou un code trop long) ne vaut pas un essai');
    const code = app.nouveauCodeEssai();
    await lancer(message(mime({ sujet: app.sujetEssai(code), de: 'Sophie <sophie@gmail.com>', corps: 'Un e-mail d’essai.' }), aB));
    const rB = (await route(B)).corps, rC = (await route(C)).corps;
    dit(rB.essai && rB.essai.code === code, 'E. l’essai arrivé à SON adresse : SON code est rendu par SA route', JSON.stringify(rB.essai));
    dit(rC.essai === null && !JSON.stringify(rC).includes(code), 'E. un autre vendeur ne voit ni ce code ni cet essai', JSON.stringify(rC.essai));
    dit(base.filter((x) => x.id === 'vrm_adresse_reception_essai').every((x) => x.owner === B), 'E. la ligne d’essai vit chez lui seul', base.filter((x) => x.id === 'vrm_adresse_reception_essai').map((x) => x.owner).join(' · '));
    // La feuille juge sur le CODE : un essai récent avec un AUTRE code n'est pas « reçu ».
    const attendu = { code: code === 'K7P2' ? 'K7P3' : 'K7P2', depuis: Date.now() - 1000 };
    dit(app.etatEssai(rB, attendu, Date.now()).etat === 'attente' && app.etatEssai(rB, { code, depuis: Date.now() }, Date.now()).etat === 'recu', 'E. « Reçu ✓ » seulement pour le code attendu (un autre e-mail récent ne vaut pas)');
    dit(app.etatEssai(rB, attendu, Date.now() + app.ATTENTE_ESSAI_MS + 1000).etat === 'trop-long' && app.etatEssai(null, attendu).etat === 'passu', 'E. trop long ⇒ « Pas encore reçu » ; lecture ratée ⇒ « pas su », jamais « reçu »');
  });

  // ── F. Sans domaine configuré : la route le DIT ───────────────────────────
  await essaie('F', async () => {
    delete process.env.DOMAINE_RECEPTION;
    const v = (await route(B)).corps, p = (await route(J)).corps;
    dit(v.pret === false && v.manque === 'domaine' && !v.adresse && !('miseEnService' in v) && !('proprio' in v), 'F. sans DOMAINE_RECEPTION : « pas prête » au vendeur, aucune adresse, rien sur la configuration', JSON.stringify(v).slice(0, 160));
    dit(p.pret === false && p.proprio === true && p.miseEnService && p.miseEnService.domaine === 'absent' && p.miseEnService.cle === true && !JSON.stringify(p).includes(CLE), 'F. au SEUL propriétaire : ce qui manque (domaine absent, clé posée) — jamais la valeur de la clé', JSON.stringify(p.miseEnService));
    process.env.DOMAINE_RECEPTION = 'https://recu-transfert.test/';
    const m = (await route(J)).corps;
    dit(m.pret === false && m.miseEnService && m.miseEnService.domaine === 'mal-forme', 'F. domaine mal écrit (avec https://) ⇒ « mal-forme », aucune adresse fabriquée', JSON.stringify(m.miseEnService));
    if (app && app.gestesMiseEnService) {
      const g = app.gestesMiseEnService(p.miseEnService);
      dit(g.find((x) => x.id === 'variable').etat === 'a-faire' && g.find((x) => x.id === 'cle').etat === 'fait' && g.find((x) => x.id === 'worker').etat === 'a-verifier', 'F. la feuille en tire « À faire » / « Fait » / « À vérifier »', g.map((x) => x.id + ':' + x.etat).join(' · '));
    } else dit(false, 'F. la feuille ne sait pas dire ce qui manque (gestesMiseEnService absent)');
    delete process.env.DOMAINE_RECEPTION;
    // Sans domaine, la règle de l'adresse unique ne joue pas : l'ancienne réception reste.
    const r = faireRes();
    await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': CLE }, body: JSON.stringify({ raw: mime({ sujet: 'MARQUEF1', to: 'proprio@boutique.test' }), envelopeTo: 'proprio@boutique.test' }) }, r);
    dit(r.code === 200 && base.some((x) => x.owner === J && /^email_reception_/.test(x.id) && /MARQUEF1/.test(String(x.data && x.data.subject))), 'F. sans domaine, la réception d’avant marche (adresse déclarée ⇒ son vendeur)', `HTTP ${r.code}`);
    process.env.DOMAINE_RECEPTION = DOMAINE;
  });

  // ── G. La notice de Julien porte CE Worker ────────────────────────────────
  await essaie('G', async () => {
    const doc = path.join(RACINE, 'docs', 'emails-transfert-mise-en-service.md');
    const texte = fs.existsSync(doc) ? fs.readFileSync(doc, 'utf8') : '';
    const bloc = (/```js\n([\s\S]*?)```/.exec(texte) || [])[1] || '';
    const fichier = fs.existsSync(path.join(RACINE, 'cloudflare', 'worker-reception.js')) ? fs.readFileSync(path.join(RACINE, 'cloudflare', 'worker-reception.js'), 'utf8') : '';
    dit(!!bloc && bloc === fichier, 'G. le code à coller dans la notice est, octet pour octet, le Worker testé ici', bloc ? `${bloc.length} / ${fichier.length} octets` : 'notice ou bloc absent');
    dit(/DOMAINE_RECEPTION/.test(texte) && /EMAIL_INBOUND_SECRET/.test(texte) && /route1\.mx\.cloudflare\.net/.test(texte) && /Catch-all/i.test(texte), 'G. la notice nomme les variables, les MX de Cloudflare et le catch-all');
  });

  // ── H. Paramètres → Mes e-mails : la ligne qui crée l'adresse ─────────────
  await essaie('H', async () => {
    const src = fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Reglages.jsx'), 'utf8').replace(/^\s*\/\/[^\n]*/gm, '');
    const debut = src.indexOf("id:'emails-reglages'"), fin = src.indexOf("id:'notifications'", debut);
    const groupe = debut > 0 && fin > debut ? src.slice(debut, fin) : '';
    const iA = groupe.indexOf("id:'adresse-vrm'"), iS = groupe.indexOf("id:'sms-colis'");
    dit(iA > 0 && iS > iA && /<SmsColisSetting/.test(groupe), 'H. « Mon adresse VRM » est dans Mes e-mails, juste avant les SMS de colis (gardés)', `adresse ${iA} · sms ${iS}`);
    const ligne = iA > 0 ? groupe.slice(iA, groupe.indexOf('\n', iA)) : '';
    const ouvre = /onClick:\(\)=>(set[A-Za-z]+)\(true\)/.exec(ligne);
    const monte = ouvre && new RegExp('\\{feuilleAdresseVrm && <FeuilleAdresseVrm [^\\n]*onFermer=\\{\\(\\)=>' + ouvre[1] + '\\(false\\)').test(src);
    dit(!!monte && /m\.FeuilleAdresseReception/.test(src), 'H. la ligne ouvre LA feuille de l’adresse (FeuilleAdresseReception), qui se referme');
    const doc = fs.readFileSync(path.join(RACINE, 'docs', 'emails-transfert-mise-en-service.md'), 'utf8');
    dit(/\*\*Mes e-mails\*\* → \*\*Mon adresse VRM\*\*/.test(doc), 'H. la notice de Julien mène à la même ligne');
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
