#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT — L'ADRESSE DE RÉCEPTION UNIQUE DE CHAQUE VENDEUR (8 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Règle : api/_lib/adresse-reception.js. Ce contrôle EXÉCUTE les vraies routes
// `api/email-inbound.js` (réception) et `api/email-rattacher.js?mode=adresse-unique`
// (la feuille de l'app) sur une fausse base à état (§4.10, §6.3 : projections
// `select=`, filtres `data->>`, comparer-et-échanger PATCH, index neutre) :
//   A. le jeton : 24 caractères, alphabet sans ambiguïté, aléatoire (10 000 tirages
//      distincts, chaque caractère de l'alphabet sort) ;
//   B. domaine non réglé ⇒ la route se tait et dit ce qui manque, rien fabriqué ;
//   C. son adresse se crée UNE fois (relue identique), l'index vit sous le neutre ;
//   D. un e-mail livré à `jeton@domaine` est rangé chez CE vendeur — AVANT toute
//      autre règle (son en-tête To nomme une boîte déclarée par un AUTRE vendeur) ;
//   E. 50 vendeurs, 50 e-mails : aucun mélange ;
//   F. jeton inconnu / mal formé / deux adresses VRM ⇒ quarantaine NEUTRE sans
//      adresse réclamable, rien chez personne ;
//   G. « Adresse active » éteinte ⇒ quarantaine ; rallumée ⇒ rangé ;
//   H. « Remplacer » ⇒ l'ancienne part en quarantaine (« remplacée »), la neuve range ;
//   I. le code de confirmation Gmail arrivé à SON adresse lui est rendu (code, lien
//      Google seulement, adresse source) ; un faux « Google » ne fait afficher
//      aucun lien ;
//   J. écriture ratée ⇒ 503 (rangement, quarantaine, code) ; lecture de l'index
//      ratée ⇒ 503, rien d'écrit ;
//   K. un vendeur qui recopie le jeton d'un autre dans SA ligne ne lui vole rien ;
//   L. une adresse du domaine VRM ne se « prouve » pas (preuve-demander ⇒ 409) ;
//   M. ce qu'un transfert À LA MAIN (« TR: ») laisse lisible — mesuré et rapporté.
// `--src <arbre>` : le lance sur un autre arbre (preuve sur la branche de départ).
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
const RACINE = arg('--src') ? path.resolve(arg('--src')) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String((e && e.stack) || e).slice(0, 400)); } };

const NEUTRE = '00000000-0000-0000-0000-000000000000';
const uid = (i) => `${String(i).padStart(8, '0')}-1111-4111-8111-${String(i).padStart(12, '0')}`;
const J = uid(1), B = uid(2), C = uid(3);
const DOMAINE = 'recu-banc.test';
process.env.VRM_OWNER_UID = J;
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-adresse';
process.env.SUPABASE_SERVICE_KEY = 'service-banc-adresse';
delete process.env.DOMAINE_RECEPTION;
const jwt = (sub) => 'x.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.y';
const UTIL = {};
for (let i = 1; i <= 60; i++) UTIL[jwt(uid(i))] = { id: uid(i), email: `vendeur${i}@exemple.test`, email_confirmed_at: '2026-10-01T00:00:00Z' };

// ── La fausse base ──────────────────────────────────────────────────────────
let base = [];
let panne = null;   // (m, id, owner) => true pour faire rater une requête
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
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url));
  const m = (opts.method || 'GET').toUpperCase();
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
const faireRes = () => { const x = { code: null, corps: null, h: {} }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = (k, v) => { x.h[k] = v; }; x.send = () => x; x.end = () => x; return x; };
const registre = (owner, adresses) => ({ owner, id: 'vrm_email_owners', data: { adresses: Object.fromEntries(adresses.map((a) => [a, { owner, label: '', at: '2026-10-20T10:00:00Z' }])) } });

let nMsg = 0;
// Un e-mail (forme du Worker Cloudflare : enveloppe dans `envelopeTo`, en-tête To d'origine).
const venteVinted = (enveloppe, { toEntete = 'sophie@gmail.com', from = 'Vinted <no-reply@vinted.fr>', sujet = "Ton article s'est vendu !", marque = '' } = {}) => { nMsg++; return {
  messageId: `<banc-${nMsg}-${marque}@vinted.fr>`, from, envelopeTo: enveloppe, to: enveloppe, cc: toEntete,
  subject: sujet + (marque ? ' ' + marque : ''),
  text: `Bonjour,\n\nacheteuse_banc a acheté\n\nNike Air banc ${marque} - Taille 42\n\n30,00 €\n\nL'équipe Vinted\n`, html: '', attachments: [],
}; };

(async () => {
  let inbound, ratt, lib, preuve;
  await essaie('chargement', async () => {
    inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js'));
    ratt = await import('file://' + path.join(RACINE, 'api', 'email-rattacher.js'));
    lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'adresse-reception.js'));
    preuve = await import('file://' + path.join(RACINE, 'api', '_lib', 'preuve-adresse.js'));
  });
  if (!inbound || !ratt || !lib) { console.log(`\n${ok} ✅ · ${ko + 1} ❌ — la règle ou les routes ne se chargent pas`); process.exit(1); }

  const recevoir = async (corps) => { const r = faireRes(); await inbound.default({ method: 'POST', query: { key: 'cle-banc-adresse' }, headers: {}, body: JSON.stringify(corps) }, r); return r; };
  const route = async (owner, methode = 'GET', corps) => { const r = faireRes(); await ratt.default({ method: methode, query: { mode: 'adresse-unique' }, headers: { authorization: 'Bearer ' + jwt(owner) }, body: corps ? JSON.stringify(corps) : undefined }, r); return r; };
  const quarantaines = () => base.filter((x) => x.owner === NEUTRE && /^email_quarantaine_/.test(x.id) && !(x.data && x.data.supprime));
  const lignesEmail = (owner) => base.filter((x) => x.owner === owner && /^email_/.test(x.id));
  const recuChez = (owner, marque) => base.some((x) => x.owner === owner && /^email_reception_/.test(x.id) && String((x.data && x.data.subject) || '').includes(marque));
  const ailleurs = (marque, sauf) => base.filter((x) => x.owner !== sauf && x.owner !== NEUTRE && JSON.stringify(x.data || '').includes(marque)).map((x) => x.owner + ':' + x.id);

  // ── A. Le jeton ───────────────────────────────────────────────────────────
  await essaie('A', async () => {
    const vus = new Set(), cars = new Set();
    for (let i = 0; i < 10000; i++) { const j = lib.nouveauJeton(); vus.add(j); for (const c of j) cars.add(c); }
    const un = lib.nouveauJeton();
    dit(un.length >= 22 && lib.jetonValide(un) && /^[a-z2-9]+$/.test(un) && !/[ilo01]/.test(un), 'A. un jeton : 24 caractères, minuscules et chiffres sans ambiguïté (ni i, l, o, 0, 1)', un);
    dit(vus.size === 10000, 'A. 10 000 tirages, 10 000 jetons distincts', String(vus.size));
    dit(cars.size === lib.ALPHABET_JETON.length, "A. chaque caractère de l'alphabet sort (aucun biais grossier)", `${cars.size}/${lib.ALPHABET_JETON.length}`);
    // Tirage par rejet : un octet ≥ 248 ne donne jamais de caractère (sinon a…h sortiraient plus souvent).
    let appel = 0;
    const rejet = lib.nouveauJeton(() => (appel++ === 0 ? Buffer.alloc(32, 250) : Buffer.alloc(32, 0)));
    dit(rejet === 'a'.repeat(24) && appel === 2, 'A. un octet au-delà de 247 est rejeté (aucun biais du modulo)', rejet + ' · ' + appel + ' tirages');
  });

  // ── B. Domaine non réglé : la fonction se tait ────────────────────────────
  await essaie('B', async () => {
    base = [];
    const r = await route(B);
    dit(r.code === 200 && r.corps && r.corps.pret === false && r.corps.manque === 'domaine' && !base.some((x) => x.id === 'vrm_adresse_reception'), 'B. sans DOMAINE_RECEPTION : « pas prête », ce qui manque est nommé, aucune adresse fabriquée', `HTTP ${r.code} · ${JSON.stringify(r.corps)}`);
    const e = await recevoir(venteVinted('k7p2m9x4q8w3e6r5t2y7u9a3@' + DOMAINE, { marque: 'SANSDOMAINE' }));
    dit(e.code === 200 || e.code === 503, "B. sans domaine réglé, la réception d'avant reste inchangée (aucune règle neuve ne joue)", `HTTP ${e.code}`);
  });

  process.env.DOMAINE_RECEPTION = DOMAINE;
  const adresseDe = async (owner) => { const r = await route(owner); return r.corps && r.corps.adresse; };

  // ── C. Création, une fois ─────────────────────────────────────────────────
  let aB = '', aC = '';
  await essaie('C', async () => {
    base = [registre(J, ['proprio@boutique.test']), registre(C, ['sophie@gmail.com'])];
    const r1 = await route(B), r2 = await route(B);
    aB = r1.corps && r1.corps.adresse;
    const jeton = String(aB || '').split('@')[0];
    dit(r1.code === 200 && r1.corps.pret === true && lib.jetonValide(jeton) && aB.endsWith('@' + DOMAINE), 'C. au premier appel, son adresse unique est fabriquée sur le domaine de réception', `HTTP ${r1.code} · ${aB}`);
    dit(r2.corps && r2.corps.adresse === aB && r2.corps.actif === true, 'C. relue, c’est la MÊME adresse (jamais deux)', r2.corps && r2.corps.adresse);
    const ix = base.filter((x) => /^jeton_reception_/.test(x.id));
    dit(ix.length === 1 && ix[0].owner === NEUTRE && ix[0].data.owner === B && !JSON.stringify(ix).includes(jeton), "C. l'index vit sous le propriétaire NEUTRE, par empreinte (jamais le jeton en clair)", JSON.stringify(ix.map((x) => [x.owner, x.data.owner])));
    dit(r1.corps.dernier === null && r1.corps.code === null, 'C. aucun e-mail encore : « dernier » et « code » sont vides (null), pas inventés', JSON.stringify([r1.corps.dernier, r1.corps.code]));
    aC = await adresseDe(C);
  });

  // ── D. Rangé chez CE vendeur, avant toute autre règle ─────────────────────
  await essaie('D', async () => {
    const r = await recevoir(venteVinted(aB, { toEntete: 'sophie@gmail.com', marque: 'MARQUED1' }));
    dit(r.code === 200 && !r.corps.quarantaine && recuChez(B, 'MARQUED1'), 'D. livré à son adresse unique ⇒ rangé chez B (alors que son Cc nomme une boîte déclarée par C)', `HTTP ${r.code} · ${JSON.stringify(r.corps).slice(0, 160)}`);
    dit(ailleurs('MARQUED1', B).length === 0, 'D. rien chez C ni chez le propriétaire', ailleurs('MARQUED1', B).join(' · '));
    const lu = await route(B);
    dit(lu.corps.dernier && /MARQUED1/.test(lu.corps.dernier.sujet) && Date.now() - Date.parse(lu.corps.dernier.at) < 60000, 'D. « Dernier e-mail reçu » le montre aussitôt (la preuve que le transfert marche)', JSON.stringify(lu.corps.dernier));
    // Sans enveloppe (un autre service) : l'adresse lue dans To suffit.
    const sans = venteVinted(aB, { marque: 'MARQUED2' }); delete sans.envelopeTo;
    const r2 = await recevoir(sans);
    dit(r2.code === 200 && recuChez(B, 'MARQUED2'), "D. sans champ d'enveloppe, l'adresse VRM lue dans To désigne aussi B", `HTTP ${r2.code}`);
    // L'enveloppe fait foi : livré à la boîte collective, une adresse VRM en Cc ne désigne personne.
    const env = venteVinted('vrm.vinted35@gmail.com', { toEntete: aB, marque: 'MARQUED3' });
    await recevoir(env);
    dit(!recuChez(B, 'MARQUED3'), "D. l'enveloppe fait foi : une adresse VRM recopiée en Cc d'un e-mail livré ailleurs n'attribue rien", ailleurs('MARQUED3', '').join(' · '));
  });

  // ── E. 50 vendeurs, aucun mélange ─────────────────────────────────────────
  await essaie('E', async () => {
    const adr = {};
    for (let i = 10; i < 60; i++) adr[uid(i)] = await adresseDe(uid(i));
    const distinctes = new Set(Object.values(adr));
    dit(distinctes.size === 50 && [...distinctes].every(Boolean), '50 vendeurs : 50 adresses distinctes', String(distinctes.size));
    // Ordre mêlé, et deux à la fois (la route sert plusieurs e-mails en même temps).
    const ordre = Object.keys(adr).sort((a, b) => (a.charCodeAt(14) * 7 + a.slice(-2)) < (b.charCodeAt(14) * 7 + b.slice(-2)) ? -1 : 1).reverse();
    for (let k = 0; k < ordre.length; k += 2) await Promise.all(ordre.slice(k, k + 2).map((o) => recevoir(venteVinted(adr[o], { marque: 'MARQUE-E-' + o }))));
    let bons = 0; const melanges = [];
    for (const o of ordre) { if (recuChez(o, 'MARQUE-E-' + o)) bons++; const a = ailleurs('MARQUE-E-' + o, o); if (a.length) melanges.push(o + '→' + a[0]); }
    dit(bons === 50, 'E. chacun des 50 e-mails est rangé chez SON vendeur', `${bons}/50`);
    dit(melanges.length === 0, 'E. aucun e-mail chez un autre vendeur', melanges.slice(0, 3).join(' · '));
  });

  // ── F. Inconnu, mal formé, deux adresses ⇒ quarantaine neutre ─────────────
  await essaie('F', async () => {
    const cas = [
      ['inconnu', venteVinted('zzzzzzzzzzzzzzzzzzzzzzzz@' + DOMAINE, { marque: 'MARQUEF1' }), 'MARQUEF1'],
      ['mal formé', venteVinted('julien@' + DOMAINE, { marque: 'MARQUEF2' }), 'MARQUEF2'],
      ['deux adresses VRM', venteVinted(aB + ',' + aC, { marque: 'MARQUEF3' }), 'MARQUEF3'],
    ];
    for (const [nom, mail, marque] of cas) {
      const avant = quarantaines().length;
      const r = await recevoir(mail);
      const q = quarantaines().slice(avant);
      dit(r.code === 200 && r.corps.quarantaine === true && q.length === 1 && Array.isArray(q[0].data.adresses) && q[0].data.adresses.length === 0, `F. ${nom} ⇒ gardé entier en quarantaine NEUTRE, sans adresse réclamable`, `HTTP ${r.code} · ${q.map((x) => x.data.raison).join(' · ')}`);
      dit(ailleurs(marque, '__personne__').length === 0, `F. ${nom} ⇒ rien chez aucun vendeur`, ailleurs(marque, '__personne__').join(' · '));
    }
  });

  // ── G. Adresse active / éteinte ───────────────────────────────────────────
  await essaie('G', async () => {
    const off = await route(B, 'POST', { geste: 'actif', actif: false });
    dit(off.code === 200 && off.corps.actif === false && off.corps.adresse === aB, 'G. « Adresse active » éteinte : la route le dit, l’adresse reste la même', JSON.stringify({ code: off.code, actif: off.corps && off.corps.actif }));
    const avant = quarantaines().length;
    const r = await recevoir(venteVinted(aB, { marque: 'MARQUEG1' }));
    dit(r.code === 200 && quarantaines().length === avant + 1 && !recuChez(B, 'MARQUEG1') && ailleurs('MARQUEG1', '__personne__').length === 0, 'G. éteinte ⇒ quarantaine neutre, rien rangé chez B ni ailleurs', `HTTP ${r.code} · ${JSON.stringify(r.corps).slice(0, 100)}`);
    const on = await route(B, 'POST', { geste: 'actif', actif: true });
    const r2 = await recevoir(venteVinted(aB, { marque: 'MARQUEG2' }));
    dit(on.corps.actif === true && recuChez(B, 'MARQUEG2'), 'G. rallumée ⇒ de nouveau rangé chez B', `HTTP ${r2.code}`);
  });

  // ── H. Remplacer ──────────────────────────────────────────────────────────
  let aB2 = '';
  await essaie('H', async () => {
    const r = await route(B, 'POST', { geste: 'remplacer' });
    aB2 = r.corps && r.corps.adresse;
    dit(r.code === 200 && aB2 && aB2 !== aB && r.corps.dernier === null, "H. « Remplacer l'adresse » : une adresse neuve, et le « dernier reçu » de l'ancienne n'est plus montré", `${aB} → ${aB2}`);
    const avant = quarantaines().length;
    const v = await recevoir(venteVinted(aB, { marque: 'MARQUEH1' }));
    const q = quarantaines().slice(avant);
    dit(v.code === 200 && q.length === 1 && /remplac/.test(q[0].data.raison) && !recuChez(B, 'MARQUEH1') && ailleurs('MARQUEH1', '__personne__').length === 0, "H. l'ANCIENNE ⇒ quarantaine neutre « remplacée », jamais chez un autre", q.map((x) => x.data.raison).join(' · '));
    const n = await recevoir(venteVinted(aB2, { marque: 'MARQUEH2' }));
    dit(n.code === 200 && recuChez(B, 'MARQUEH2'), 'H. la NEUVE range chez B', `HTTP ${n.code}`);
  });

  // ── I. Le code de confirmation Gmail ─────────────────────────────────────
  const AUTH_GOOGLE = 'mx.google.com; dkim=pass header.i=@google.com header.s=20230601; dmarc=pass (p=REJECT) header.from=google.com';
  const confirmation = (vers, source, code, { auth = AUTH_GOOGLE, from = 'Gmail Team <forwarding-noreply@google.com>', lien = 'https://mail-settings.google.com/mail/vf-%5BBANC%5D-lien' } = {}) => { nMsg++; return {
    messageId: `<transfert-${nMsg}@google.com>`, from, envelopeTo: vers, to: vers,
    subject: `(#${code}) Confirmation de transfert Gmail - Recevoir les e-mails de ${source}`,
    text: `${source} a demandé à transférer automatiquement les e-mails vers votre adresse ${vers}.\n\nCode de confirmation : ${code}\n\nPour autoriser ${source} à transférer automatiquement les e-mails vers votre adresse, veuillez cliquer sur le lien ci-dessous pour confirmer la demande :\n\n${lien}\n`,
    html: '', attachments: [], authentification: auth,
  }; };
  await essaie('I', async () => {
    const r = await recevoir(confirmation(aB2, 'sophie.perso@gmail.com', '482913765'));
    const lu = await route(B);
    const c = lu.corps.code;
    dit(r.code === 200 && c && c.code === '482913765' && c.source === 'sophie.perso@gmail.com' && c.fournisseur === 'gmail', 'I. le code Gmail arrivé à SON adresse lui est rendu (code, adresse source)', JSON.stringify(c));
    dit(c && /^https:\/\/mail-settings\.google\.com\//.test(c.lien) && c.signe === true, 'I. avec le lien de confirmation de Google et « signé par Google »', c && c.lien);
    dit(!base.some((x) => x.owner !== B && x.owner !== NEUTRE && /482913765/.test(JSON.stringify(x.data || ''))), 'I. le code n’est chez aucun autre vendeur');
    // Un faux « Google » (autre expéditeur, lien piégé) : aucun code affiché.
    await recevoir(confirmation(aB2, 'pirate@exemple.test', '111222333', { from: 'Gmail <forwarding-noreply@g00gle.test>', lien: 'https://piege.test/vf-x' }));
    const lu2 = await route(B);
    dit(lu2.corps.code && lu2.corps.code.code === '482913765' && !/piege/.test(JSON.stringify(lu2.corps)), 'I. un faux message « Gmail » ne remplace pas le code et ne fait afficher aucun lien', JSON.stringify(lu2.corps.code));
    // Un vrai message de Gmail dont le lien pointe ailleurs : code oui, lien non.
    await recevoir(confirmation(aB2, 'sophie.perso@gmail.com', '777888999', { lien: 'https://piege.test/mail-settings.google.com/x' }));
    const lu3 = await route(B);
    dit(lu3.corps.code && lu3.corps.code.code === '777888999' && lu3.corps.code.lien === '', 'I. un lien hors des hôtes de Google n’est jamais rendu', JSON.stringify(lu3.corps.code));
  });

  // ── J. Écritures et lectures ratées ⇒ 503 ────────────────────────────────
  await essaie('J', async () => {
    panne = (m, id, owner) => m === 'POST' && owner === B && /^email_/.test(id || '');
    const r = await recevoir(venteVinted(aB2, { marque: 'MARQUEJ1' }));
    dit(r.code === 503, 'J. rangement raté chez le vendeur ⇒ 503 (le service de réception rejoue)', `HTTP ${r.code}`);
    panne = (m, id) => m === 'POST' && /^email_quarantaine_/.test(id || '');
    const q = await recevoir(venteVinted('zzzzzzzzzzzzzzzzzzzzzzzy@' + DOMAINE, { marque: 'MARQUEJ2' }));
    dit(q.code === 503, 'J. quarantaine ratée ⇒ 503 (jamais « reçu » sur un e-mail pas gardé)', `HTTP ${q.code}`);
    panne = (m, id) => m === 'POST' && id === lib.ID_CODE;
    const c = await recevoir(confirmation(aB2, 'sophie.perso@gmail.com', '555444333'));
    dit(c.code === 503, 'J. code de confirmation pas rangé ⇒ 503', `HTTP ${c.code}`);
    const n0 = base.length;
    panne = (m, id) => m === 'GET' && /^jeton_reception_/.test(id || '');
    const l = await recevoir(venteVinted(aB2, { marque: 'MARQUEJ3' }));
    dit(l.code === 503 && base.length === n0, "J. index illisible ⇒ 503, rien d'écrit (ni rangé, ni mis de côté)", `HTTP ${l.code} · ${base.length - n0} ligne(s)`);
    panne = (m, id) => m === 'GET' && id === lib.ID_ADRESSE;
    const g = await route(B);
    dit(g.code === 503, 'J. la feuille : sa ligne illisible ⇒ 503 (jamais une adresse neuve fabriquée sur une lecture ratée)', `HTTP ${g.code}`);
    panne = null;
  });

  // ── K. Recopier le jeton d'un autre ne vole rien ─────────────────────────
  await essaie('K', async () => {
    const jetonC = aC.split('@')[0];
    const l = base.find((x) => x.owner === B && x.id === lib.ID_ADRESSE);
    l.data = { ...l.data, jeton: jetonC };          // ce que SON navigateur peut écrire sous RLS
    const r = await route(B);
    dit(r.code === 200 && r.corps.adresse && r.corps.adresse !== aC, 'K. B recopie le jeton de C dans sa ligne : la route lui refait une adresse NEUVE', r.corps && r.corps.adresse);
    const ixC = base.find((x) => x.owner === NEUTRE && x.data && x.data.owner === C && /^jeton_reception_/.test(x.id));
    const e = await recevoir(venteVinted(aC, { marque: 'MARQUEK1' }));
    dit(ixC && recuChez(C, 'MARQUEK1') && !recuChez(B, 'MARQUEK1'), "K. l'adresse de C range toujours chez C, jamais chez B", `HTTP ${e.code}`);
    // Un index qui ne correspond plus à la ligne du vendeur (son jeton a changé
    // sans que l'index suive) ne fait JAMAIS foi seul : quarantaine.
    const perdu = lib.nouveauJeton();
    const ixPerdu = { ...ixC, id: 'jeton_reception_' + require('crypto').createHash('sha256').update(perdu).digest('hex'), data: { owner: C, genre: 'reception', at: '2026-11-08T10:00:00Z' } };
    base.push(ixPerdu);
    const avant = quarantaines().length;
    const p = await recevoir(venteVinted(perdu + '@' + DOMAINE, { marque: 'MARQUEK2' }));
    dit(p.code === 200 && quarantaines().length === avant + 1 && !recuChez(C, 'MARQUEK2'), "K. un index qui désigne C pour un jeton que la ligne de C ne porte pas ⇒ quarantaine (le jeton est re-comparé)", `HTTP ${p.code}`);
  });

  // ── L. Une adresse VRM ne se « prouve » pas ──────────────────────────────
  await essaie('L', async () => {
    base.push(registre(B, [aB2]));
    const r = faireRes();
    await ratt.default({ method: 'POST', query: { mode: 'preuve-demander' }, headers: { authorization: 'Bearer ' + jwt(B) }, body: JSON.stringify({ adresse: aB2 }) }, r);
    dit(r.code === 409 && r.corps.raison === 'adresse-vrm', "L. demander la preuve d'une adresse du domaine VRM ⇒ 409, aucun lien envoyé", `HTTP ${r.code} · ${JSON.stringify(r.corps).slice(0, 120)}`);
  });

  // ── M. Un transfert À LA MAIN : mesuré et rapporté ───────────────────────
  await essaie('M', async () => {
    const aB3 = await adresseDe(B);
    const tr = (sujet, from, texte, pj) => ({ messageId: `<tr-${++nMsg}>`, from, envelopeTo: aB3, to: aB3, subject: sujet, text: texte, html: '', attachments: pj || [] });
    const pdf = [{ filename: 'bordereau.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-1.4\nbanc\n%%EOF').toString('base64') }];
    const vente = await recevoir(tr("TR: Ton article s'est vendu ! MARQUEM1", 'Sophie <sophie.perso@gmail.com>', '---------- Message transféré ---------\nDe : Vinted <no-reply@vinted.fr>\n\nacheteuse_banc a acheté\n\nNike Air banc MARQUEM1 - Taille 42\n\n30,00 €\n'));
    const colis = await recevoir(tr('TR: Votre colis est disponible MARQUEM2', 'Sophie <sophie.perso@gmail.com>', '---------- Message transféré ---------\nDe : Mondial Relay <noreply@mondialrelay.fr>\n\nVotre colis 12345678 est disponible en Point Relais. Code de retrait : 482913\n'));
    console.log(`ℹ️  M. transfert à la main : vente « TR: » ⇒ type « ${vente.corps && vente.corps.type} » ; colis Mondial Relay « TR: » ⇒ type « ${colis.corps && colis.corps.type} »`);
    if (process.argv.includes('--detail')) console.log(base.filter((x) => x.owner === B && /MARQUEM|12345678/.test(JSON.stringify(x.data || ''))).map((x) => x.id + ' ' + JSON.stringify(x.data).slice(0, 300)).join('\n'));
    dit(recuChez(B, 'MARQUEM1') && recuChez(B, 'MARQUEM2'), 'M. un transfert à la main arrive quand même chez B (gardé, visible dans sa boîte VRM)');
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
