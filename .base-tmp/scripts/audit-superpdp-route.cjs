// ════════════════════════════════════════════════════════════════════════════
//  LA ROUTE SUPER PDP, EXÉCUTÉE (16 octobre)
//        node scripts/audit-superpdp-route.cjs [--src dossier]
//
//  Julien : « je veux que VRM se connecte à une plateforme agréée ». Chaque
//  vendeur connecte SON compte Super PDP (§2.9 : jamais la clé de Julien pour
//  les autres) ; ses factures Factur-X partent de VRM. §4.10 : une fonction
//  serverless n'est vérifiée que si un banc l'EXÉCUTE — on charge la VRAIE
//  route `/api/compte?mode=superpdp`, devant une fausse base qui honore
//  `owner=eq.`, la projection `select=`, le comparer-et-échanger, et un FAUX
//  Super PDP qui imite les formes lues dans le client `super_pdp` (la doc
//  officielle n'est pas joignable d'ici : voir api/_lib/superpdp.js).
//  AUCUN appel réel : `fetch` est remplacé, toute adresse inconnue lève.
//
//  Ce qui est exigé :
//    · sans session ⇒ 401, zéro appel à Super PDP, zéro lecture de la clé ;
//    · la clé n'est JAMAIS renvoyée au navigateur, ni rangée en clair ;
//    · un vendeur ne lit jamais la clé d'un autre (filtre owner, chiffré lié
//      au vendeur) ;
//    · envoyée / refusée / incertaine — une coupure n'est jamais « refusée » ;
//    · un même numéro ne part jamais deux fois (même deux clics simultanés,
//      même après une coupure : on CHERCHE avant de renvoyer) ;
//    · lecture de la clé ratée ⇒ 503, jamais « pas connecté ».
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const cp = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const NON_CLOISONNEE = process.argv.includes('--non-cloisonnee');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const JWT = { A: 'eyJh.jeton-de-A.sig', B: 'eyJh.jeton-de-B.sig', C: 'eyJh.jeton-de-C.sig' };
const QUI = { [JWT.A]: A, [JWT.B]: B, [JWT.C]: C };
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';
process.env.VRM_OWNER_UID = A;
process.env.SUPERPDP_DELAI_MS = '2000';
const SB = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
// Données INVENTÉES (dépôt public).
const CREDS = { 'cid-A-banc': 'sec-A-tres-secret-1234', 'cid-B-banc': 'sec-B-tres-secret-5678' };

// ── LA FAUSSE BASE ───────────────────────────────────────────────────────────
let lignes = [], journal = [], mode = {};
const projette = (r, sel) => {
  if (!sel || sel === 'data') return sel === 'data' ? { data: r.data } : r;
  const out = {};
  for (const part of decodeURIComponent(sel).split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'owner') { out[alias] = r[src]; continue; }
    if (src === 'data') { out[alias] = r.data; continue; }
    let v = r.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (v != null && /->>/.test(src) && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};
const rep = (corps, status = 200, type = 'application/json') => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': type } });

// ── LE FAUX SUPER PDP : des factures par compte (jeton) ──────────────────────
let factures = {}, prochain = 1;
const compteDuJeton = (h) => { const m = /^Bearer tok-(.+)$/.exec(String(h || '')); return m && CREDS[m[1]] !== undefined ? m[1] : null; };

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url), m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (u.startsWith('https://api.superpdp.tech/')) {
    const e = { ou: 'spdp', m, u, auth: h.Authorization || '', type: h['content-type'] || '' };
    journal.push(e);
    if (u === 'https://api.superpdp.tech/oauth2/token') {
      if (mode.jetonCoupe) throw new Error('réseau');
      const f = new URLSearchParams(String(opts.body || ''));
      e.corps = String(opts.body || '');
      if (f.get('grant_type') !== 'client_credentials' || CREDS[f.get('client_id')] !== f.get('client_secret')) return rep({ error: 'invalid_client', error_description: 'Client authentication failed' }, 401);
      return rep({ access_token: 'tok-' + f.get('client_id'), token_type: 'Bearer', expires_in: 3600 });
    }
    const cpt = compteDuJeton(h.Authorization);
    if (!cpt) return rep({ message: 'unauthorized' }, 401);
    factures[cpt] = factures[cpt] || [];
    const q = new URL(u);
    if (m === 'POST' && q.pathname === '/v1.beta/invoices') {
      const ext = q.searchParams.get('external_id');
      e.ext = ext; e.octets = opts.body ? opts.body.length : 0;
      if (mode.envoi === 'refus') return rep({ message: `Facture refusée : SIREN absent de l'annuaire (client ${cpt}, secret ${CREDS[cpt]}, Bearer tok-${cpt})`, errors: [{ message: 'BR-FR-10' }] }, 422);
      if (mode.envoi === 'avant') throw new Error('coupure avant'); // rien n'arrive chez Super PDP
      const inv = { id: 'inv-' + (prochain++), external_id: ext, direction: 'out', events: [{ status_code: 'fr:200', created_at: '2026-10-16T10:00:00Z' }] };
      factures[cpt].push(inv);
      if (mode.envoi === 'apres') throw new Error('coupure après'); // créée, réponse perdue
      if (mode.envoi === '502') return rep('<html>Bad gateway</html>', 502, 'text/html');
      return rep(inv, 201);
    }
    if (m === 'GET' && q.pathname === '/v1.beta/invoices') {
      if (mode.listeKo) return rep({ message: 'boom' }, 500);
      return rep({ data: factures[cpt].filter((x) => x.direction === q.searchParams.get('direction')), has_more: false });
    }
    const mi = /^\/v1\.beta\/invoices\/([^/]+)$/.exec(q.pathname);
    if (m === 'GET' && mi) { const inv = factures[cpt].find((x) => x.id === decodeURIComponent(mi[1])); return inv ? rep({ ...inv, events: [...inv.events, { status_code: 'fr:205', created_at: '2026-10-16T11:00:00Z' }] }) : rep({ message: 'not found' }, 404); }
    return rep({ message: 'chemin inconnu du faux Super PDP' }, 404);
  }
  if (u === `${SB}/auth/v1/user`) {
    const j = String(h.Authorization || '').replace(/^Bearer /, '');
    return QUI[j] ? rep({ id: QUI[j], email: 'x@exemple.test', email_confirmed_at: 'x' }) : rep({ msg: 'bad jwt' }, 401);
  }
  if (u === `${SB}/rest/v1/app_data?select=owner&limit=1`) return NON_CLOISONNEE ? rep({ message: 'column app_data.owner does not exist' }, 400) : rep([]);
  if (u === `${SB}/rest/v1/rpc/vrm_acces_pour`) { const b = JSON.parse(opts.body || '{}'); return rep(b.u !== C); }
  if (u.startsWith(`${SB}/rest/v1/app_data`)) {
    const q = decodeURIComponent(u.slice(u.indexOf('?') + 1));
    const id = (/(?:^|&)id=eq\.([^&]*)/.exec(q) || [])[1];
    const own = (/(?:^|&)owner=eq\.([^&]*)/.exec(q) || [])[1];
    journal.push({ ou: 'base', m, u: q, corps: String(opts.body || '') });
    if (id === 'superpdp_cle' && mode.cleKo && m === 'GET') return rep({ message: 'boom' }, 500);
    if (id === 'superpdp_envois' && mode.envoisKo && m === 'GET') return rep({ message: 'boom' }, 500);
    if (m === 'GET') {
      const sel = (/(?:^|&)select=([^&]*)/.exec(q) || [])[1];
      return rep(lignes.filter((r) => (!id || r.id === id) && (!own || r.owner === own)).map((r) => projette(r, sel)));
    }
    if (m === 'DELETE') { lignes = lignes.filter((r) => !((!id || r.id === id) && (!own || r.owner === own))); return new Response(null, { status: 204 }); }
    let rows = []; try { rows = [].concat(JSON.parse(opts.body || '[]')); } catch (_) {}
    if (m === 'PATCH') {
      const revEq = (/(?:^|&)data->>rev=eq\.([^&]*)/.exec(q) || [])[1], revNul = /data->>rev=is\.null/.test(q);
      const touche = lignes.filter((x) => x.id === id && (!own || x.owner === own) && (revNul ? (x.data == null || x.data.rev == null) : (revEq === undefined || (x.data && String(x.data.rev) === revEq))));
      for (const x of touche) x.data = rows[0].data;
      return rep(touche.map((x) => ({ id: x.id })));
    }
    if (m === 'POST' && !/on_conflict=/.test(q) && rows.some((r) => lignes.some((x) => x.id === r.id && x.owner === r.owner))) return rep({ code: '23505' }, 409);
    for (const r of rows) { const i = lignes.findIndex((x) => x.id === r.id && x.owner === r.owner); if (i >= 0) lignes[i] = { ...lignes[i], ...r }; else lignes.push({ ...r }); }
    return rep('', 201);
  }
  throw new Error('appel réseau non prévu par le banc : ' + u);
};

const faireRes = () => { const x = { code: null, corps: null, entetes: {} }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = (k, v) => { x.entetes[String(k).toLowerCase()] = v; }; x.send = () => x; x.end = () => x; return x; };
const PDF = (num) => Buffer.from('%PDF-1.7\n1 0 obj << /Type /Filespec /F (factur-x.xml) /UF (factur-x.xml) >> endobj\n% facture ' + num + '\n' + 'x'.repeat(200)).toString('base64');

(async () => {
  let route;
  await essaie('chargement', async () => { route = await import('file://' + path.join(RACINE, 'api', 'compte.js')); });
  if (!route) { console.log('\n❌ audit-superpdp-route : la route n\'a pas pu être chargée'); process.exit(1); }
  const appel = async (qui, methode, corps) => {
    journal.length = 0;
    const res = faireRes();
    await route.default({ method: methode, query: { mode: 'superpdp' }, headers: qui ? { authorization: 'Bearer ' + JWT[qui] } : {}, body: corps }, res);
    return { code: res.code, corps: res.corps || {}, txt: JSON.stringify(res.corps || {}), journal: journal.slice() };
  };
  const spdp = (j) => j.filter((x) => x.ou === 'spdp');
  const postsFacture = (j) => spdp(j).filter((x) => x.m === 'POST' && /\/v1\.beta\/invoices/.test(x.u));
  const cle = (o) => lignes.find((r) => r.id === 'superpdp_cle' && r.owner === o);

  if (NON_CLOISONNEE) {
    await essaie('non cloisonnée', async () => {
      const r = await appel('A', 'POST', { action: 'connecter', environnement: 'sandbox', client_id: 'cid-A-banc', client_secret: CREDS['cid-A-banc'] });
      dit(r.code === 503 && !spdp(r.journal).length && !lignes.length, 'base PAS cloisonnée ⇒ 503, aucune clé rangée, rien envoyé à Super PDP', `HTTP ${r.code}`);
    });
    console.log(`\n${ko ? '❌' : '✅'} non-cloisonnée : ${ok} ok, ${ko} ko`); process.exit(ko ? 1 : 0);
  }

  await essaie('sans session', async () => {
    const g = await appel(null, 'GET'), p = await appel(null, 'POST', { action: 'envoyer', numero: 'FX-2026-0001', pdf: PDF('x') });
    const touche = [...g.journal, ...p.journal].some((x) => x.ou === 'spdp' || /superpdp/.test(x.u || ''));
    dit(g.code === 401 && p.code === 401 && !touche, 'sans session ⇒ 401, zéro appel à Super PDP, zéro lecture de la clé', `GET ${g.code} · POST ${p.code}`);
  });

  await essaie('statut vide', async () => {
    const r = await appel('A', 'GET');
    dit(r.code === 200 && r.corps.connecte === false && r.corps.coffre === true, 'aucune connexion ⇒ « pas connecté » (lu), coffre prêt', r.txt.slice(0, 120));
  });

  await essaie('identifiants refusés', async () => {
    const r = await appel('A', 'POST', { action: 'connecter', environnement: 'sandbox', client_id: 'cid-A-banc', client_secret: 'faux' });
    dit(r.code === 400 && !cle(A), 'identifiants refusés par Super PDP ⇒ 400, rien rangé', `HTTP ${r.code}`);
    dit(/Client authentication failed/.test(r.corps.message || ''), 'la raison de Super PDP est dite telle quelle', r.corps.message);
    dit(!r.txt.includes('faux'), 'le secret tapé ne revient pas dans la réponse');
  });

  await essaie('Super PDP injoignable à la connexion', async () => {
    mode = { jetonCoupe: true };
    const r = await appel('A', 'POST', { action: 'connecter', environnement: 'sandbox', client_id: 'cid-A-banc', client_secret: CREDS['cid-A-banc'] });
    mode = {};
    dit(r.code === 502 && !cle(A), 'Super PDP muet ⇒ 502, « pas pu vérifier », rien rangé', `HTTP ${r.code}`);
  });

  await essaie('connexion A', async () => {
    const r = await appel('A', 'POST', { action: 'connecter', environnement: 'sandbox', client_id: 'cid-A-banc', client_secret: CREDS['cid-A-banc'] });
    dit(r.code === 200 && r.corps.connecte === true && r.corps.env === 'sandbox', 'connexion acceptée ⇒ 200 « connecté · bac à sable »', `HTTP ${r.code}`);
    dit(!r.txt.includes('cid-A-banc') && !r.txt.includes(CREDS['cid-A-banc']) && !r.txt.includes('tok-'), 'la réponse ne contient ni l\'identifiant, ni le secret, ni le jeton');
    const l = cle(A), brut = JSON.stringify(l || {});
    dit(!!l && !brut.includes(CREDS['cid-A-banc']) && !brut.includes('cid-A-banc') && /^v1\./.test(l.data.chiffre || ''), 'rangée chez A, CHIFFRÉE (ni identifiant ni secret en clair dans la base)', brut.slice(0, 90));
    const t = spdp(r.journal).find((x) => /oauth2\/token/.test(x.u));
    dit(!!t && /grant_type=client_credentials/.test(t.corps || ''), 'les identifiants sont vérifiés par un jeton client_credentials');
  });

  await essaie('statut A', async () => {
    const r = await appel('A', 'GET');
    dit(r.code === 200 && r.corps.connecte === true && r.corps.env === 'sandbox', 'statut ⇒ connecté · bac à sable');
    dit(!r.txt.includes(CREDS['cid-A-banc']) && !r.txt.includes('cid-A-banc') && !r.txt.includes('chiffre') && !r.txt.includes('v1.'), 'le statut ne renvoie JAMAIS la clé (ni en clair ni chiffrée)', r.txt.slice(0, 160));
    dit(!spdp(r.journal).length, 'lire le statut n\'appelle pas Super PDP');
  });

  await essaie('cloison B', async () => {
    const r = await appel('B', 'GET');
    const lectures = r.journal.filter((x) => x.ou === 'base' && x.m === 'GET');
    dit(r.code === 200 && r.corps.connecte === false, 'B ne voit pas la connexion de A', r.txt.slice(0, 100));
    dit(lectures.length > 0 && lectures.every((x) => x.u.includes('owner=eq.' + B)), 'toutes les lectures de B sont filtrées owner=eq.B', lectures.map((x) => x.u).join(' | ').slice(0, 200));
    // Un chiffré recopié dans la ligne de B ne se déchiffre pas (lié au vendeur).
    lignes.push({ owner: B, id: 'superpdp_cle', data: { ...cle(A).data } });
    const r2 = await appel('B', 'GET');
    dit(r2.corps.connecte === false && r2.corps.illisible === true, 'le chiffré de A recopié chez B ne se lit pas (« illisible », jamais connecté)', r2.txt.slice(0, 100));
    const r3 = await appel('B', 'POST', { action: 'envoyer', numero: 'FX-2026-0009', pdf: PDF('9') });
    dit(r3.code === 409 && !spdp(r3.journal).length, 'B ne peut rien envoyer avec la clé de A', `HTTP ${r3.code}`);
    lignes = lignes.filter((x) => !(x.owner === B && x.id === 'superpdp_cle'));
  });

  await essaie('pdf invalide', async () => {
    const r = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0001', pdf: Buffer.from('pas un pdf').toString('base64') });
    dit(r.code === 400 && !spdp(r.journal).length, 'un fichier qui n\'est pas un Factur-X ⇒ 400, rien envoyé');
    const r2 = await appel('A', 'POST', { action: 'envoyer', numero: 'F-1', pdf: PDF('1') });
    dit(r2.code === 400 && !spdp(r2.journal).length, 'un numéro hors FX-AAAA-NNNN ⇒ 400, rien envoyé');
  });

  await essaie('envoyée', async () => {
    const r = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0001', pdf: PDF('1') });
    const p = postsFacture(r.journal);
    dit(r.code === 200 && r.corps.envoi && r.corps.envoi.etat === 'envoye' && r.corps.envoi.id === 'inv-1', 'envoyée ⇒ 200, identifiant de Super PDP rendu', r.txt.slice(0, 140));
    dit(p.length === 1 && p[0].auth === 'Bearer tok-cid-A-banc' && p[0].ext === 'FX-2026-0001' && p[0].type === 'application/pdf', 'POST /v1.beta/invoices avec SON jeton, external_id = le numéro, le PDF brut', JSON.stringify(p[0] || {}).slice(0, 160));
    dit(r.corps.envoi.statut === 'fr:200', 'le statut renvoyé par la plateforme est gardé');
    dit(!r.txt.includes('tok-') && !r.txt.includes(CREDS['cid-A-banc']), 'aucun jeton ni secret dans la réponse');
    const st = await appel('A', 'GET');
    dit(st.corps.envois && st.corps.envois['FX-2026-0001'] && st.corps.envois['FX-2026-0001'].etat === 'envoye' && !('jeton' in st.corps.envois['FX-2026-0001']), 'le statut de la ligne est rendu par le statut (sans marqueur interne)');
  });

  await essaie('pas de double envoi', async () => {
    const r = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0001', pdf: PDF('1') });
    dit(r.code === 200 && r.corps.deja === true && postsFacture(r.journal).length === 0, 'renvoyer le même numéro ⇒ « déjà envoyée », zéro POST', `HTTP ${r.code}`);
    dit(factures['cid-A-banc'].filter((x) => x.external_id === 'FX-2026-0001').length === 1, 'Super PDP n\'a qu\'UNE facture FX-2026-0001');
  });

  await essaie('deux clics simultanés', async () => {
    const [r1, r2] = await Promise.all([
      (async () => { const res = faireRes(); await route.default({ method: 'POST', query: { mode: 'superpdp' }, headers: { authorization: 'Bearer ' + JWT.A }, body: { action: 'envoyer', numero: 'FX-2026-0004', pdf: PDF('4') } }, res); return res; })(),
      (async () => { const res = faireRes(); await route.default({ method: 'POST', query: { mode: 'superpdp' }, headers: { authorization: 'Bearer ' + JWT.A }, body: { action: 'envoyer', numero: 'FX-2026-0004', pdf: PDF('4') } }, res); return res; })(),
    ]);
    const n = factures['cid-A-banc'].filter((x) => x.external_id === 'FX-2026-0004').length;
    dit(n === 1, 'deux clics simultanés ⇒ UNE seule facture chez Super PDP', `${n} facture(s) · HTTP ${r1.code}/${r2.code}`);
  });

  await essaie('refusée', async () => {
    mode = { envoi: 'refus' };
    const r = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0002', pdf: PDF('2') });
    mode = {};
    dit(r.code === 422 && r.corps.envoi && r.corps.envoi.etat === 'refuse', 'refusée ⇒ 422, état « refusée »', `HTTP ${r.code}`);
    dit(/SIREN absent/.test(r.corps.envoi.raison) && /BR-FR-10/.test(r.corps.envoi.raison), 'la raison de Super PDP est rendue telle quelle', r.corps.envoi.raison);
    dit(!r.txt.includes(CREDS['cid-A-banc']) && !r.txt.includes('tok-cid') && !r.txt.includes('cid-A-banc'), 'même si Super PDP les cite, ni secret, ni identifiant, ni jeton ne reviennent', r.txt.slice(0, 220));
    const r2 = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0002', pdf: PDF('2') });
    dit(r2.code === 200 && r2.corps.envoi.etat === 'envoye' && postsFacture(r2.journal).length === 1, 'une refusée peut être renvoyée (corrigée)');
  });

  await essaie('incertaine (réponse perdue)', async () => {
    mode = { envoi: 'apres' };
    const r = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0003', pdf: PDF('3') });
    mode = {};
    dit(r.code === 504 && r.corps.envoi && r.corps.envoi.etat === 'incertain', 'coupure ⇒ 504 « incertaine », jamais « refusée »', `HTTP ${r.code} · ${r.corps.envoi && r.corps.envoi.etat}`);
    mode = { listeKo: true };
    const k = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0003', pdf: PDF('3') });
    mode = {};
    dit(k.code === 409 && postsFacture(k.journal).length === 0, 'incertaine + liste de Super PDP illisible ⇒ on ne renvoie PAS', `HTTP ${k.code}`);
    const r2 = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0003', pdf: PDF('3') });
    dit(r2.code === 200 && r2.corps.deja === true && postsFacture(r2.journal).length === 0, 'nouvel essai ⇒ on la CHERCHE, elle y est : « déjà envoyée », zéro POST', `HTTP ${r2.code}`);
    dit(factures['cid-A-banc'].filter((x) => x.external_id === 'FX-2026-0003').length === 1, 'une seule FX-2026-0003 chez Super PDP');
  });

  await essaie('incertaine (502)', async () => {
    mode = { envoi: '502' };
    const r = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0006', pdf: PDF('6') });
    mode = {};
    dit(r.code === 504 && r.corps.envoi.etat === 'incertain', 'une page d\'erreur 502 de la plateforme ⇒ « incertaine »', `HTTP ${r.code}`);
  });

  await essaie('incertaine (rien arrivé)', async () => {
    mode = { envoi: 'avant' };
    await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0005', pdf: PDF('5') });
    mode = {};
    const r = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0005', pdf: PDF('5') });
    dit(r.code === 200 && r.corps.envoi.etat === 'envoye' && postsFacture(r.journal).length === 1, 'absente de la liste (lue en entier) ⇒ envoyée cette fois, une seule fois');
  });

  await essaie('relire', async () => {
    const r = await appel('A', 'POST', { action: 'relire', numero: 'FX-2026-0001' });
    dit(r.code === 200 && r.corps.envoi && r.corps.envoi.statut === 'fr:205', 'relire ⇒ le dernier statut de la plateforme', r.txt.slice(0, 140));
  });

  await essaie('lecture de la clé ratée', async () => {
    mode = { cleKo: true };
    const g = await appel('A', 'GET');
    const p = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0007', pdf: PDF('7') });
    mode = {};
    dit(g.code === 503 && g.corps.connecte === undefined, 'clé illisible ⇒ 503, jamais « pas connecté »', `HTTP ${g.code} · ${g.txt.slice(0, 80)}`);
    dit(p.code === 503 && !spdp(p.journal).length, 'clé illisible ⇒ rien envoyé', `HTTP ${p.code}`);
  });

  await essaie('journal illisible', async () => {
    mode = { envoisKo: true };
    const p = await appel('A', 'POST', { action: 'envoyer', numero: 'FX-2026-0008', pdf: PDF('8') });
    mode = {};
    dit(p.code === 503 && postsFacture(p.journal).length === 0, 'journal des envois illisible ⇒ 503, rien envoyé (jamais deux fois)', `HTTP ${p.code}`);
  });

  await essaie('abonnement coupé', async () => {
    const r = await appel('C', 'GET');
    dit(r.code === 402 && !spdp(r.journal).length, 'abonnement VRM coupé ⇒ 402', `HTTP ${r.code}`);
  });

  await essaie('déconnexion', async () => {
    const r = await appel('A', 'POST', { action: 'deconnecter' });
    const d = r.journal.find((x) => x.m === 'DELETE');
    dit(r.code === 200 && !cle(A) && !!d && d.u.includes('owner=eq.' + A), 'déconnecter ⇒ la ligne de A (et elle seule) est effacée', `HTTP ${r.code}`);
    const g = await appel('A', 'GET');
    dit(g.corps.connecte === false, 'après déconnexion : « pas connecté »');
  });

  // La base non cloisonnée se rejoue dans un processus NEUF (la sonde est mémorisée).
  await essaie('non cloisonnée', async () => {
    const out = cp.spawnSync(process.execPath, [__filename, '--non-cloisonnee', ...(iSrc > 0 ? ['--src', RACINE] : [])], { encoding: 'utf8' });
    process.stdout.write(out.stdout.split('\n').filter((l) => /^(✅|❌)/.test(l) && !/non-cloisonnée :/.test(l)).join('\n') + '\n');
    dit(out.status === 0, 'base non cloisonnée (processus neuf)', out.status === 0 ? '' : out.stderr.slice(0, 200));
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-superpdp-route : ${ok} contrôles ok, ${ko} ko`);
  process.exit(ko ? 1 : 0);
})();
