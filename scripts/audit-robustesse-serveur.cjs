// ════════════════════════════════════════════════════════════════════════════
//  ROBUSTESSE DU SERVEUR (11 nov.) — les points critiques et hauts de la revue
//  `docs/passation/robustesse/serveur.md` (zone e-mails · compte · cron), chacun
//  EXÉCUTÉ sur les vraies routes avec une fausse base À ÉTAT (filtres, projections
//  `select=`, `data->>…=not.is.null`, `Range`) et un faux Stripe. Aucune donnée
//  réelle, aucun appel réel.
//   Q  une quarantaine garde les PIÈCES JOINTES (lignes sœurs `email_qpj_*`) et
//      le rejeu (api/email-rattacher.js) les rend : le bordereau revient AVEC son
//      PDF ; une pièce illisible ⇒ 503, rien n'est vidé ;
//   B  un 2e « Bordereau d'envoi » SANS pièce jointe n'efface jamais le PDF rangé ;
//      la présence se lit par filtre (jamais le PDF) ; lecture ratée ⇒ 503 ;
//   F  deux versements au texte identique ne se fondent plus (Message-ID, n° de
//      transaction) ; le même e-mail rejoué reste UNE ligne ;
//   P  l'ENVELOPPE décide : `To`/`Cc` ne sont plus lus quand elle nomme une
//      adresse (hors boîte collective) ;
//   S  webhook Stripe : propriétaire illisible ⇒ 503 (Stripe rejoue), jamais
//      200 « sans propriétaire » ; un événement d'un ANCIEN abonnement n'écrase
//      pas l'actif ; essai non enregistré ⇒ 503 ;
//   D  délais : Stripe, eBay, Anthropic portent un `signal` ; vercel.json déclare
//      `maxDuration` du cron = la durée que suppose `cron-lots` (12 fonctions).
//  (Le cron et les clients partis : audit-cron-lots.cjs, audit-clients-partis.cjs.)
//  `node scripts/audit-robustesse-serveur.cjs [--src dossier] [--prouve]`
//  `--prouve` : ROUGE sur origin/main (git archive) et sur chaque mutation.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
const ICI = path.join(__dirname, '..');
const R = arg('--src') ? path.resolve(arg('--src')) : (process.env.AUDIT_RACINE || ICI);

const MUTATIONS = {
  'quarantaine sans les pièces': [['api/email-inbound.js', "      if (b64 && b64.length <= MAX_OCTETS_PJ_B64) {", "      if (false) {"]],
  'rejeu sans les pièces': [['api/email-rattacher.js', 'html: ligne.html, attachments,', 'html: ligne.html, attachments: [],']],
  'pièce illisible ⇒ rejeu quand même': [['api/email-rattacher.js', 'if (attachments === null) { indispo(res); return; }', 'if (attachments === null) { }']],
  'PDF écrasé par un e-mail sans pièce': [['api/email-inbound.js', 'const pdfDeja = pdf ? false : await bordereauADejaUnPdf(row.id);', 'const pdfDeja = false;']],
  'versements fondus': [['api/email-inbound.js', "  if (mid) return { cle: 'm' +", "  if (false) return { cle: 'm' +"]],
  'To lu malgré l’enveloppe': [['api/_lib/proprietaire-email.js', '  if (env.some((a) => !estAdresseCollectrice(a))) return env;', '']],
  'webhook : pas su = personne': [['api/compte.js', "  if (owner === undefined) return repondre(res, 503, { erreur: 'propriétaire pas su', reessayer: true });\n  if (!owner) {", '  if (!owner) {']],
  'ancien abonnement écrase': [['api/compte.js', "    if (evenementDUnAncienAbonnement(avant, ligne)) return { ok: true, ignore: 'ancien-abonnement' };", '']],
  'quarantaine sans les adresses dans l’identité': [['api/email-inbound.js', "update(mid + '|' + String(raison || '') + '|' + [...new Set((adresses || []).map((a) => String(a).toLowerCase()))].sort().join(','))", "update(mid + '|' + String(raison || ''))"]],
  'Stripe sans délai': [['api/_lib/stripe.js', ', signal: AbortSignal.timeout(DELAI_STRIPE_MS) });', ' });']],
};

if (process.argv.includes('--prouve')) {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-robu-'));
  cp.execSync(`git -C "${ICI}" archive origin/main api src public package.json vercel.json | tar -x -C "${t}"`);
  let nm = ICI; while (!fs.existsSync(path.join(nm, 'node_modules')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
  fs.symlinkSync(fs.realpathSync(path.join(nm, 'node_modules')), path.join(t, 'node_modules'));
  const r = cp.spawnSync(process.execPath, [__filename, '--src', t], { encoding: 'utf8', timeout: 300000 });
  const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
  console.log(`${r.status && rouges ? '✅' : '❌'} sur origin/main : ${rouges} rouge(s)`);
  for (const l of (r.stdout || '').split('\n').filter((x) => x.startsWith('❌')).slice(0, 12)) console.log('     ' + l.slice(0, 170));
  fs.rmSync(t, { recursive: true, force: true });
  if (!(r.status && rouges)) process.exit(1);
  require('./_mutations-audit.cjs').prouver(__filename, ICI, MUTATIONS);
  return;
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + String(d).slice(0, 220))); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };

const SECRET_EMAIL = 'cle-banc-robustesse';
process.env.EMAIL_INBOUND_SECRET = SECRET_EMAIL;
process.env.SUPABASE_SERVICE_KEY = 'cle-service-banc';
const J = '11111111-1111-4111-8111-111111111111';     // propriétaire de l'installation
const A = '22222222-2222-4222-8222-222222222222';
const B = '33333333-3333-4333-8333-333333333333';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
process.env.VRM_OWNER_UID = J;

// ── La fausse base, à état ──────────────────────────────────────────────────
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
let base = [], pannes = [], lectures = [], abonnements = {}, essaisEcrits = [], panneEssais = false, subsStripe = {}, signaux = [];
const metaDe = (d) => { const o = {}; for (const k in (d || {})) { const v = d[k]; if (['string', 'number', 'boolean'].includes(typeof v) && Buffer.byteLength(JSON.stringify(v)) <= 600) o[k] = v; } return o; };
const champ = (row, chemin) => {
  const m = /^(data|meta)(->>|->)(.+)$/.exec(chemin);
  if (m) { const src = m[1] === 'data' ? row.data : metaDe(row.data); const v = src ? src[m[3]] : undefined; return v === undefined ? null : (m[2] === '->>' && v !== null && typeof v === 'object' ? JSON.stringify(v) : v); }
  if (chemin === 'data') return row.data;
  return row[chemin] === undefined ? null : row[chemin];
};
let idPreuve = () => '';
const repPreuves = (opts) => {
  const tout = base.filter((r) => r.id === 'vrm_email_owners' && r.owner).flatMap((r) => Object.keys((r.data && r.data.adresses) || {}).filter((a) => a.includes('@')).map((a) => ({ id: idPreuve(r.owner, a), owner: r.owner, adresse: a.trim().toLowerCase(), etat: 'prouvee' })));
  const mr = /^(\d+)-(\d+)$/.exec(String((opts.headers && (opts.headers.Range || opts.headers.range)) || ''));
  return rep(mr ? tout.slice(+mr[1], +mr[2] + 1) : tout);
};
const appData = (u, m, opts) => {
  const q = u.split('?')[1] || '';
  const params = q.split('&').filter(Boolean).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; });
  if (m === 'POST') {
    let arr = []; try { arr = JSON.parse(opts.body || '[]'); } catch (_) {}
    for (const x of (Array.isArray(arr) ? arr : [arr])) {
      const owner = x.owner || J;
      const i = base.findIndex((r) => r.id === x.id && r.owner === owner);
      const l = { owner, id: x.id, data: x.data };
      if (i >= 0) base[i] = l; else base.push(l);
    }
    return rep('', 201);
  }
  if (/select=owner&limit=1/.test(u)) return rep([{ owner: J }]);
  let rows = base.slice(), select = null;
  for (const [k, v] of params) {
    if (['select', 'order', 'on_conflict', 'limit', 'offset'].includes(k)) { if (k === 'select') select = v; continue; }
    const val = v || '';
    if (k === 'id' && val.startsWith('eq.')) rows = rows.filter((r) => r.id === val.slice(3));
    else if (k === 'id' && val.startsWith('like.')) { const re = new RegExp('^' + val.slice(5).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); rows = rows.filter((r) => re.test(r.id)); }
    else if (k === 'id' && val.startsWith('in.(')) { const l = val.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, '')); rows = rows.filter((r) => l.includes(r.id)); }
    else if (k === 'owner' && val.startsWith('eq.')) rows = rows.filter((r) => r.owner === val.slice(3));
    else if (/^(meta|data)->>/.test(k) && val === 'is.null') rows = rows.filter((r) => champ(r, k) == null);
    else if (/^(meta|data)->>/.test(k) && val === 'not.is.null') rows = rows.filter((r) => champ(r, k) != null);
    else if (/^(meta|data)->>/.test(k) && val.startsWith('eq.')) rows = rows.filter((r) => String(champ(r, k)) === val.slice(3));
    else if (k === 'or') continue;   // filtres de candidats : le banc rend large, la règle de la route juge
    else return rep({ message: 'filtre inconnu du banc : ' + k + '=' + val }, 400);
  }
  if (m === 'DELETE') { const set = new Set(rows); base = base.filter((r) => !set.has(r)); return rep('', 204); }
  lectures.push({ u, select });
  const range = String((opts.headers && (opts.headers.Range || opts.headers.range)) || '');
  const mr = /^(\d+)-(\d+)$/.exec(range);
  if (mr) rows = rows.slice(+mr[1], +mr[2] + 1);
  const proj = (r) => {
    if (!select) return { id: r.id, owner: r.owner, data: r.data };
    const o = {};
    for (const item of select.split(',')) {
      const i = item.indexOf(':');
      const [alias, chemin] = i > 0 ? [item.slice(0, i), item.slice(i + 1)] : [item.replace(/^.*(->>|->)/, ''), item];
      o[alias] = champ(r, chemin);
    }
    return o;
  };
  return rep(rows.map(proj));
};
const JETONS = { 'Bearer jeton-A': A, 'Bearer jeton-B': B, 'Bearer jeton-J': J };
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  signaux.push({ u, signal: !!opts.signal });
  for (const p of pannes) { if (p(u, m)) return rep('<html>522</html>', 522); }
  if (u.includes('/auth/v1/user')) { const a = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || ''); return JETONS[a] ? rep({ id: JETONS[a], email: 'x@exemple.test' }) : rep({ msg: 'invalid' }, 401); }
  if (u.includes('/rest/v1/app_data') && m === 'GET' && u.includes('vrm_email_preuve_')) return repPreuves(opts);
  if (u.includes('/rest/v1/app_data')) return appData(u, m, opts);
  if (u.includes('/rest/v1/abonnements')) {
    if (m === 'POST') { for (const l of JSON.parse(opts.body)) abonnements[l.owner] = { ...(abonnements[l.owner] || {}), ...l }; return rep('', 201); }
    const own = /owner=eq\.([^&]+)/.exec(u), cli = /client_stripe=eq\.([^&]+)/.exec(u);
    if (own) return rep(abonnements[own[1]] ? [abonnements[own[1]]] : []);
    if (cli) { const l = Object.values(abonnements).find((x) => x.client_stripe === cli[1]); return rep(l ? [{ owner: l.owner }] : []); }
    return rep([]);
  }
  if (u.includes('/rest/v1/essais_gratuits')) { if (m === 'POST') { if (panneEssais) return rep('<html>522</html>', 522); essaisEcrits.push(...JSON.parse(opts.body)); return rep('', 201); } return rep([]); }
  if (u.startsWith('https://api.stripe.com/v1/')) {
    const id = (u.split('subscriptions/')[1] || '').split('?')[0];
    if (id && subsStripe[id]) return rep(subsStripe[id]);
    return rep({ data: [] });
  }
  if (u.includes('/rest/v1/')) return m === 'GET' ? rep([]) : rep('', 201);
  return rep({}, 404);
};
const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.end = () => x; x.send = (o) => { x.corps = o; return x; }; return x; };
const registre = (owner, adresses) => ({ owner, id: 'vrm_email_owners', data: { adresses: Object.fromEntries(adresses.map((a) => [a, { owner, label: '' }])), updatedAt: '2026-10-05T10:00:00Z' } });
const ligne = (owner, id) => base.find((r) => r.owner === owner && r.id === id);

(async () => {
  let inbound = null, rattacher = null, compte = null, prop = null;
  try { ({ idPreuve } = await import('file://' + path.join(R, 'api', '_lib', 'preuve-adresse.js'))); } catch (_) {}
  try { inbound = await import('file://' + path.join(R, 'api', 'email-inbound.js')); } catch (e) { dit(false, 'api/email-inbound.js se charge', e.message); }
  try { rattacher = await import('file://' + path.join(R, 'api', 'email-rattacher.js')); } catch (e) { dit(false, 'api/email-rattacher.js se charge', e.message); }
  try { compte = (await import('file://' + path.join(R, 'api', 'compte.js'))).default; } catch (e) { dit(false, 'api/compte.js se charge', e.message); }
  try { prop = await import('file://' + path.join(R, 'api', '_lib', 'proprietaire-email.js')); } catch (e) { dit(false, 'proprietaire-email se charge', e.message); }
  // Un vrai petit PDF (inventé), en base64.
  let PDF = Buffer.from('%PDF-1.4\n% banc\n').toString('base64');
  try { const { PDFDocument } = require(path.join(R, 'node_modules', 'pdf-lib')); const d = await PDFDocument.create(); d.addPage([300, 400]); PDF = Buffer.from(await d.save()).toString('base64'); } catch (_) {}
  const envoyer = async (body) => { const r = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': SECRET_EMAIL }, body }, r); return r; };
  const bordereau = (to, tx, avecPdf, extra = {}) => ({
    from: 'Vinted <no-reply@vinted.fr>', to, subject: 'Bordereau d’envoi pour Nike Dunk Low panda n12',
    text: `Bonjour, voici ton bordereau.\nN° de transaction : ${tx}\nArticle : Nike Dunk Low panda n12\n`, html: '',
    attachments: avecPdf ? [{ filename: `Bordereau-Vinted-${tx}.pdf`, contentType: 'application/pdf', contentB64: PDF }] : [], ...extra });

  // ══ Q : la quarantaine garde le PDF, le rejeu le rend ═════════════════════
  await essaie('Q', async () => {
    if (!inbound || !rattacher) return;
    base = [registre(A, ['a@vrm.center'])]; pannes = [];
    const e = await envoyer(bordereau('b@vrm.center', '700000001', true, { messageId: '<q1@banc>' }));
    const q = base.filter((r) => r.owner === NEUTRE && /^email_quarantaine_/.test(r.id));
    dit(e.code === 200 && q.length === 1, 'Q (constat) un bordereau arrivé sur une adresse inconnue est mis de côté', `HTTP ${e.code} · ${q.length}`);
    const pj = base.filter((r) => r.owner === NEUTRE && /^email_qpj_/.test(r.id));
    dit(pj.length === 1 && pj[0].data.contentB64 === PDF && q[0] && !JSON.stringify(q[0].data).includes(PDF.slice(40, 120)),
      'Q le PDF est GARDÉ (ligne sœur, une pièce par ligne), la ligne de quarantaine reste légère', `${pj.length} pièce(s)`);
    await envoyer(bordereau('b@vrm.center', '700000001', true, { messageId: '<q1@banc>' }));
    dit(base.filter((r) => r.owner === NEUTRE && /^email_quarantaine_/.test(r.id)).length === 1, 'Q le même e-mail rejoué par le collecteur : pas de copie de plus (identité = Message-ID)');
    // (relecture) Le MÊME Message-ID livré à DEUX adresses inconnues (deux exemplaires) :
    // deux mises de côté, chacune avec SON adresse — sinon la 2e écrase la 1re et
    // le propriétaire de la 1re adresse ne peut plus réclamer son e-mail.
    await envoyer(bordereau('c@vrm.center', '700000001', true, { messageId: '<q1@banc>', envelopeTo: 'c@vrm.center' }));
    const qs = base.filter((r) => r.owner === NEUTRE && /^email_quarantaine_/.test(r.id) && !(r.data && r.data.supprime));
    const adrs = qs.map((r) => JSON.stringify((r.data && r.data.adresses) || []));
    dit(qs.length === 2 && adrs.some((a) => a.includes('b@vrm.center')) && adrs.some((a) => a.includes('c@vrm.center')),
      'Q le même Message-ID livré à une 2e adresse inconnue : sa propre mise de côté, la 1re adresse reste réclamable', `${qs.length} · ${adrs.join(' | ')}`);
    const ident = base.filter((r) => r.owner === NEUTRE && /^email_quarantaine_/.test(r.id) && JSON.stringify(r.data.adresses || []).includes('b@vrm.center'));
    if (ident.length !== 1) dit(false, 'Q (constat) la mise de côté de b@ est retrouvée', ident.length);
    base.push(registre(B, ['b@vrm.center']));
    // Pièce illisible : 503, rien n'est vidé.
    pannes = [(u, m) => m === 'GET' && u.includes('email_qpj_')];
    const r0 = faireRes(); await rattacher.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer jeton-B' }, body: { id: q[0].id, silencieux: true } }, r0);
    pannes = [];
    dit(r0.code === 503 && !ligne(B, 'email_bord_700000001') && !(ligne(NEUTRE, q[0].id).data || {}).supprime,
      'Q pièce jointe illisible au rejeu ⇒ 503, la quarantaine n’est PAS vidée', `HTTP ${r0.code}`);
    const r = faireRes(); await rattacher.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer jeton-B' }, body: { id: q[0].id, silencieux: true } }, r);
    const bord = ligne(B, 'email_bord_700000001');
    dit(r.code === 200 && bord && bord.data.pdfB64 === PDF, 'Q B réclame l’e-mail : son bordereau est rangé AVEC son PDF', `HTTP ${r.code} · pdf ${bord ? String(bord.data.pdfB64).slice(0, 12) : 'pas de bordereau'}`);
    dit(!!(ligne(NEUTRE, q[0].id).data || {}).supprime && base.filter((x) => /^email_qpj_/.test(x.id) && x.data && x.data.quarantaine === q[0].id).every((x) => x.data.supprime && !x.data.contentB64), 'Q après le rejeu réussi : quarantaine et pièce vidées (le PDF est chez B)');
  });

  // ══ B : un 2e e-mail sans pièce n'efface pas le PDF ══════════════════════
  await essaie('B', async () => {
    if (!inbound) return;
    base = [registre(A, ['a@vrm.center'])]; pannes = [];
    await envoyer(bordereau('a@vrm.center', '700000002', true, { messageId: '<b1@banc>' }));
    const avant = ligne(A, 'email_bord_700000002');
    dit(avant && avant.data.pdfB64 === PDF, 'B (constat) le bordereau est rangé avec son PDF');
    lectures = [];
    const e2 = await envoyer(bordereau('a@vrm.center', '700000002', false, { messageId: '<b2@banc>' }));
    const apres = ligne(A, 'email_bord_700000002');
    dit(e2.code === 200 && apres && apres.data.pdfB64 === PDF, 'B un 2e « Bordereau d’envoi » SANS pièce jointe n’efface pas le PDF', `HTTP ${e2.code} · ${apres ? String(apres.data.pdfB64).slice(0, 10) : '—'}`);
    dit(!lectures.some((l) => /email_bord_/.test(l.u) && (!l.select || /(^|,)data(,|$)|pdfB64/.test(l.select))), 'B la présence du PDF se lit par filtre : le PDF n’est jamais relu', lectures.map((l) => l.select).join(' | '));
    pannes = [(u, m) => m === 'GET' && u.includes('pdfB64=not.is.null')];
    const e3 = await envoyer(bordereau('a@vrm.center', '700000002', false, { messageId: '<b3@banc>' }));
    pannes = [];
    dit(e3.code === 503 && ligne(A, 'email_bord_700000002').data.pdfB64 === PDF, 'B lecture ratée ⇒ rien n’est écrit, 503 (le collecteur rejoue)', `HTTP ${e3.code}`);
    const e4 = await envoyer(bordereau('a@vrm.center', '700000003', false, { messageId: '<b4@banc>' }));
    dit(e4.code === 200 && ligne(A, 'email_bord_700000003') && ligne(A, 'email_bord_700000003').data.pdfB64 == null, 'B un bordereau sans PDF jamais vu : rangé comme avant');
  });

  // ══ F : deux versements identiques ═══════════════════════════════════════
  await essaie('F', async () => {
    if (!inbound) return;
    base = [registre(A, ['a@vrm.center'])]; pannes = [];
    const fin = (mid, extra = '') => ({ from: 'Vinted <no-reply@vinted.fr>', to: 'a@vrm.center', subject: 'Transaction finalisée', messageId: mid,
      text: `La vente de Nike Dunk Low panda a été réalisée.\nViré sur ton compte Vinted : 41,00 €\n${extra}`, html: '', attachments: [] });
    await envoyer(fin('<f1@banc>')); await envoyer(fin('<f2@banc>'));
    const n = () => base.filter((r) => r.owner === A && /^email_final_/.test(r.id)).length;
    dit(n() === 2, 'F deux versements au texte identique (deux Message-ID) ⇒ deux lignes, aucun ne disparaît', `${n()} ligne(s)`);
    await envoyer(fin('<f2@banc>'));
    dit(n() === 2, 'F le même e-mail rejoué ⇒ toujours deux lignes (pas de doublon)', `${n()}`);
    await envoyer(fin('<f3@banc>', 'N° de transaction : 88800001'));
    dit(!!ligne(A, 'email_final_tx88800001') && ligne(A, 'email_final_tx88800001').data.transaction === '88800001', 'F le n° de transaction lu fait l’identité de la ligne');
  });

  // ══ P : l'enveloppe décide ══════════════════════════════════════════════
  await essaie('P', async () => {
    if (!prop || !inbound) return;
    const adr = prop.adressesDeLivraison({ envelopeTo: 'a@vrm.center', to: 'b@vrm.center', cc: 'b@vrm.center' }, { to: 'b@vrm.center' });
    dit(adr.length === 1 && adr[0] === 'a@vrm.center', 'P enveloppe connue : To et Cc (écrits par l’expéditeur) ne comptent pas', adr.join(', '));
    const col = prop.adressesDeLivraison({ deliveredTo: 'vrm.vinted35@gmail.com', to: 'b@vrm.center' }, { to: 'b@vrm.center' });
    dit(col.includes('b@vrm.center'), 'P enveloppe = boîte collective seule : les en-têtes servent encore (transfert Gmail)', col.join(', '));
    base = [registre(A, ['a@vrm.center']), registre(B, ['b@vrm.center'])]; pannes = [];
    await envoyer({ from: 'Vinted <no-reply@vinted.fr>', to: 'b@vrm.center', envelopeTo: 'a@vrm.center', messageId: '<p1@banc>', ...bordereau('b@vrm.center', '700000009', true), envelope: { to: 'a@vrm.center' } });
    dit(!!ligne(A, 'email_bord_700000009') && !ligne(B, 'email_bord_700000009'), 'P livré à A avec « To: B » : rangé chez A, jamais chez B',
      `A:${!!ligne(A, 'email_bord_700000009')} B:${!!ligne(B, 'email_bord_700000009')}`);
  });

  // ══ S : le webhook Stripe ═══════════════════════════════════════════════
  await essaie('S', async () => {
    if (!compte) return;
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_banc'; process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
    const signer = (c) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${crypto.createHmac('sha256', 'whsec_banc').update(`${t}.${c}`).digest('hex')}`; };
    const appel = async (type, obj, created) => {
      const c = JSON.stringify({ id: 'evt_' + created, type, created, livemode: false, data: { object: obj } });
      const buf = Buffer.from(c);
      const r = faireRes();
      await compte({ method: 'POST', query: { mode: 'webhook' }, headers: { 'stripe-signature': signer(c) }, async *[Symbol.asyncIterator]() { yield buf; } }, r);
      return r;
    };
    const SUB = (id, status, extra = {}) => ({ id, object: 'subscription', status, customer: 'cus_A', metadata: {}, items: { data: [{ current_period_end: 1800000000 }] }, ...extra });
    abonnements = { [A]: { owner: A, client_stripe: 'cus_A', abonnement_stripe: 'sub_2', statut: 'active', evenement_ts: 100 } };
    pannes = [(u) => u.includes('/rest/v1/abonnements') && u.includes('client_stripe=')];
    const r1 = await appel('customer.subscription.updated', SUB('sub_2', 'past_due'), 200);
    const r2 = await appel('invoice.paid', { id: 'in_1', customer: 'cus_A' }, 201);
    pannes = [];
    dit(r1.code === 503 && abonnements[A].statut === 'active', 'S propriétaire illisible (panne) ⇒ 503, Stripe rejoue — jamais 200 « sans propriétaire »', `HTTP ${r1.code} · ${JSON.stringify(r1.corps)}`);
    dit(r2.code === 503, 'S idem pour invoice.paid (le crédit de parrainage n’est pas perdu)', `HTTP ${r2.code}`);
    const r3 = await appel('customer.subscription.updated', SUB('sub_1', 'incomplete_expired'), 300);
    dit(r3.code === 200 && abonnements[A].statut === 'active' && abonnements[A].abonnement_stripe === 'sub_2', 'S un événement tardif de l’ANCIEN abonnement n’écrase pas l’actif', JSON.stringify(abonnements[A]));
    const r4 = await appel('customer.subscription.updated', SUB('sub_2', 'canceled'), 400);
    dit(r4.code === 200 && abonnements[A].statut === 'canceled', 'S un événement de l’abonnement de la ligne s’applique toujours');
    const r5 = await appel('customer.subscription.created', SUB('sub_3', 'active'), 500);
    dit(r5.code === 200 && abonnements[A].abonnement_stripe === 'sub_3' && abonnements[A].statut === 'active', 'S un NOUVEL abonnement vivant prend la suite');
    const r6 = await appel('customer.subscription.updated', SUB('sub_9', 'active', { customer: 'cus_inconnu' }), 600);
    dit(r6.code === 200, 'S un client vraiment inconnu (lecture réussie, aucune ligne) : acquitté 200, rien deviné', `HTTP ${r6.code}`);
    panneEssais = true;
    const r7 = await appel('customer.subscription.created', SUB('sub_3', 'trialing', { metadata: { owner: A, essai: '7j', essai_email: 'a@exemple.test' }, trial_end: 1800000000 }), 700);
    panneEssais = false;
    dit(r7.code === 503, 'S l’essai gratuit pas enregistré ⇒ 503 (sinon le même e-mail reprendrait 7 jours)', `HTTP ${r7.code}`);
  });

  // ══ D : délais et durées ════════════════════════════════════════════════
  await essaie('D', async () => {
    let st = null; try { st = await import('file://' + path.join(R, 'api', '_lib', 'stripe.js')); } catch (_) {}
    process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
    signaux = [];
    if (st) await st.stripeApi('GET', 'subscriptions/sub_x');
    dit(signaux.some((x) => x.u.includes('api.stripe.com') && x.signal), 'D un appel Stripe porte un délai (signal)');
    const eb = fs.readFileSync(path.join(R, 'api', 'ebay.js'), 'utf8');
    const ai = fs.readFileSync(path.join(R, 'api', 'ai.js'), 'utf8');
    dit(/async function ebayJson[\s\S]{0,400}signal: AbortSignal\.timeout/.test(eb) && /async function tradingCall[\s\S]{0,900}signal: AbortSignal\.timeout/.test(eb), 'D eBay : lecture et appel Trading ont un délai');
    dit((ai.match(/api\.anthropic\.com\/v1\/messages'[\s\S]{0,400}?signal: AbortSignal\.timeout/g) || []).length >= 2, 'D les deux appels à l’IA ont un délai');
    let vj = {}; try { vj = JSON.parse(fs.readFileSync(fs.existsSync(path.join(R, 'vercel.json')) ? path.join(R, 'vercel.json') : path.join(ICI, 'vercel.json'), 'utf8')); } catch (_) {}
    let cl = {}; try { cl = await import('file://' + path.join(R, 'api', '_lib', 'cron-lots.js')); } catch (_) {}
    const fx = vj.functions || {};
    const sr = fx['api/ship-reminders.js'] && fx['api/ship-reminders.js'].maxDuration;
    dit(sr && sr * 1000 === cl.DUREE_MAX_MS && sr <= 300, 'D vercel.json déclare la durée du cron, celle que suppose cron-lots (≤ 300 s, plan Hobby + Fluid)', `déclaré ${sr} · supposé ${cl.DUREE_MAX_MS}`);
    dit(Object.values(fx).every((f) => !f.maxDuration || f.maxDuration <= 300), 'D aucune durée au-delà de 300 s');
    const fonctions = fs.readdirSync(path.join(R, 'api')).filter((f) => f.endsWith('.js'));
    dit(fonctions.length <= 12, 'D toujours 12 fonctions au plus', String(fonctions.length));
  });

  console.log(ko ? `\n❌ audit-robustesse-serveur : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-robustesse-serveur : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ audit-robustesse-serveur est tombé :', e && e.stack); process.exit(1); });
