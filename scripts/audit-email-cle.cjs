// ⚠️⚠️ CONTRÔLE PERMANENT — LA ROUTE DES EMAILS ET SA CLÉ (4 octobre).
//
// Deux trous, mesurés le même jour :
//   1. `EMAIL_INBOUND_SECRET` n'était pas posée : n'importe qui pouvait envoyer
//      à `api/email-inbound` une fausse vente ou un faux bordereau, rangés comme
//      les vrais.
//   2. Le script Gmail lisait la base DIRECTEMENT avec la clé publique (date de
//      départ, factures à envoyer). Depuis que la base est cloisonnée, cette clé
//      ne lit plus RIEN (RLS rend `[]` sans erreur) : la date retombait sur sa
//      valeur de secours et aucune facture ne pouvait partir — en silence.
// ⇒ Le script passe par la route (`?mode=config|factures|facture-envoyee`),
//   avec la clé. Ces modes rendent des données personnelles (l'email d'un
//   acheteur, sa facture) : SANS clé posée sur le serveur, ils REFUSENT.
//
// Ce contrôle EXÉCUTE la vraie route (§4.10) avec une fausse base, et vérifie
// les deux sens : rien ne s'ouvre sans la bonne clé, et avec elle tout marche —
// y compris l'arrivée normale d'un email, qui ne doit pas casser tant que la
// clé n'est pas posée (sinon les emails s'arrêteraient le jour du changement).
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };

const OWNER = '74eea6e7-0000-4000-8000-000000000001';
const lus = []; const ecrites = [];
let lectureKO = false;
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url));
  const methode = opts.method || 'GET';
  if (!u.includes('/rest/v1/')) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  if (methode === 'POST') { try { JSON.parse(opts.body || '[]').forEach((r) => ecrites.push(r)); } catch (_) {} return new Response('', { status: 201 }); }
  lus.push(u);
  if (/select=owner&limit=1/.test(u)) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }); // base cloisonnée
  if (lectureKO) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  let corps = [];
  if (/id=eq\.vrm_email_config/.test(u)) corps = [{ data: { startDate: '2026-07-10' } }];
  else if (/id=eq\.vrm_pro_facture/.test(u)) corps = [{ data: { actif: true, nom: 'Boutique test', logo: '' } }];
  else if (/id=like\.email_invoice_\*/.test(u)) corps = [
    { id: 'email_invoice_1', data: { status: 'queued', number: 'F-1', buyerEmail: 'acheteur@exemple.test', html: '<p>F-1</p>' } },
    { id: 'email_invoice_2', data: { status: 'queued', number: 'F-2', html: '<p>sans email</p>' } },
  ];
  else if (/id=eq\.email_invoice_1/.test(u)) corps = [{ id: 'email_invoice_1', data: { status: 'queued', number: 'F-1', buyerEmail: 'acheteur@exemple.test', montant: 42 } }];
  return new Response(JSON.stringify(corps), { status: 200, headers: { 'content-type': 'application/json' } });
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };

(async () => {
  let route;
  try { route = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js')); }
  catch (e) { dit(false, 'la route se charge', String(e.message)); console.log(`\n❌ ${ko} échec(s)`); process.exit(1); }
  const appel = async (query, method = 'GET', body) => { const res = faireRes(); try { await route.default({ method, query, body }, res); } catch (e) { res.code = 'LEVÉE'; res.corps = String(e.message); } return res; };

  // ── 1. SANS CLÉ POSÉE SUR LE SERVEUR ───────────────────────────────────────
  delete process.env.EMAIL_INBOUND_SECRET;
  process.env.VRM_OWNER_UID = OWNER;
  let r = await appel({ mode: 'factures', key: '' });
  dit(r.code === 503 && !(r.corps && r.corps.factures), 'sans clé posée sur le serveur, les factures (données personnelles) ne sortent PAS', `HTTP ${r.code}`);
  r = await appel({ mode: 'config' });
  dit(r.code === 503, 'ni la configuration', `HTTP ${r.code}`);
  const nRefus = ecrites.length;
  r = await appel({ mode: 'facture-envoyee', key: 'nimporte' }, 'POST', { id: 'email_invoice_1' });
  dit(r.code === 503 && ecrites.length === nRefus, 'et rien ne s\'écrit', `HTTP ${r.code}`);

  // ── 2. CLÉ POSÉE : MAUVAISE CLÉ ⇒ REFUS ────────────────────────────────────
  process.env.EMAIL_INBOUND_SECRET = 'cle-de-banc-123';
  r = await appel({ mode: 'factures' });
  dit(r.code === 401, 'clé posée, aucune clé fournie ⇒ 401', `HTTP ${r.code}`);
  r = await appel({ mode: 'factures', key: 'cle-de-banc-12' });
  dit(r.code === 401, 'une clé presque juste ⇒ 401', `HTTP ${r.code}`);
  const avantEmail = ecrites.length;
  r = await appel({ key: 'mauvaise' }, 'POST', { from: 'no-reply@vinted.fr', to: 'x@y.z', subject: 'Ton article est vendu !', text: 'faux', html: '', attachments: [] });
  dit(r.code === 401 && ecrites.length === avantEmail, '⚠️ un FAUX email avec une mauvaise clé est refusé et rien n\'est rangé', `HTTP ${r.code}`);

  // ── 3. LA BONNE CLÉ ⇒ TOUT MARCHE, ET POUR SA BOUTIQUE SEULEMENT ──────────
  lus.length = 0;
  r = await appel({ mode: 'config', key: 'cle-de-banc-123' });
  dit(r.code === 200 && r.corps && r.corps.startDate === '2026-07-10', 'la date de départ réglée dans l\'app arrive au script', JSON.stringify(r.corps));
  dit(lus.some((u) => /vrm_email_config/.test(u) && u.includes(`owner=eq.${OWNER}`)), 'lue dans SA boutique (filtrée sur le vendeur de l\'installation)', lus.filter((u) => /vrm_email_config/.test(u)).join(' | ').slice(0, 160));
  r = await appel({ mode: 'factures', key: 'cle-de-banc-123' });
  const f = (r.corps && r.corps.factures) || [];
  dit(r.code === 200 && r.corps.actif === true && f.length === 1 && f[0].id === 'email_invoice_1', 'les factures en attente avec un email d\'acheteur partent au script — et seulement elles', JSON.stringify(f.map((x) => x.id)));
  dit(lus.some((u) => /email_invoice_\*/.test(u) && /data->>status=eq\.queued/.test(u)), 'la base ne rend que les factures EN ATTENTE (pas tout l\'historique)');
  ecrites.length = 0;
  r = await appel({ mode: 'facture-envoyee', key: 'cle-de-banc-123' }, 'POST', { id: 'email_invoice_1' });
  const e = ecrites.find((x) => x.id === 'email_invoice_1');
  dit(r.code === 200 && e && e.data.status === 'sent' && e.data.sentAt, 'une facture envoyée est notée « envoyée »', `HTTP ${r.code}`);
  dit(e && e.data.montant === 42 && e.data.number === 'F-1', 'sans perdre le reste de la facture (réécriture COMPLÈTE de la ligne)', e ? JSON.stringify(e.data).slice(0, 120) : 'rien écrit');
  dit(e && e.owner === OWNER, 'et écrite dans SA boutique', e ? String(e.owner) : '');
  r = await appel({ mode: 'facture-envoyee', key: 'cle-de-banc-123' }, 'POST', { id: 'main' });
  dit(r.code === 400, 'impossible de viser une autre ligne que ses factures (ex. `main`)', `HTTP ${r.code}`);

  // ── 4. LECTURE RATÉE ⇒ « PAS SU », JAMAIS « RIEN » ────────────────────────
  lectureKO = true;
  r = await appel({ mode: 'factures', key: 'cle-de-banc-123' });
  dit(r.code === 503, 'base injoignable ⇒ 503 (jamais « aucune facture »)', `HTTP ${r.code}`);
  r = await appel({ mode: 'config', key: 'cle-de-banc-123' });
  dit(r.code === 503, 'idem pour la date de départ (le script garde sa valeur de secours)', `HTTP ${r.code}`);
  ecrites.length = 0;
  r = await appel({ mode: 'facture-envoyee', key: 'cle-de-banc-123' }, 'POST', { id: 'email_invoice_1' });
  dit(r.code === 503 && ecrites.length === 0, 'et une facture qu\'on n\'a pas pu relire n\'est pas réécrite à moitié', `HTTP ${r.code}, ${ecrites.length} écriture(s)`);
  lectureKO = false;

  // ── 5. LE SCRIPT GMAIL (dépôt PUBLIC) ──────────────────────────────────────
  const gs = fs.readFileSync(path.join(RACINE, 'scripts', 'gmail-forwarder.gs'), 'utf8');
  dit(!/\/rest\/v1\//.test(gs) && !/SUPA_KEY/.test(gs), 'le script Gmail ne lit plus la base directement (il passe par la route)');
  dit(/const SECRET = '';/.test(gs), 'et sa clé n\'est PAS dans le dépôt (public) : elle se colle chez lui');
  dit(/mode=' \+ mode/.test(gs) && /'config'/.test(gs) && /'factures'/.test(gs) && /'facture-envoyee'/.test(gs), 'il utilise bien les trois modes de la route');

  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
