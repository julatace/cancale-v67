// ════════════════════════════════════════════════════════════════════════════
//  RATTACHER UN EMAIL MIS DE CÔTÉ — la vraie route, exécutée (§4.10).
//        node scripts/audit-email-rattacher.cjs [--src dossier]
//
//  `/api/email-rattacher` rejoue un email en quarantaine AU PROFIT de celui
//  qui le réclame. Elle relit la ligne avec la CLÉ DE SERVICE — qui voit tous
//  les vendeurs — et ne la filtrait pas : n'importe quel vendeur connecté
//  pouvait faire rejouer chez lui l'email mis de côté d'un autre (bordereau,
//  adresse, acheteur) en donnant son identifiant. Et sans session, l'appel
//  repartait quand même dans la résolution.
//
//  Aucun banc n'avait jamais lancé cette route. Celui-ci le fait, avec deux
//  vendeurs, et vérifie les deux sens : l'autre vendeur ne prend rien, le
//  vendeur qui possède l'email le récupère bien.
//
//  ⚠️⚠️ PARTIE 2 (6 octobre) — LA QUARANTAINE N'EST À PERSONNE. Base
//  cloisonnée, un email non attribué vit sous le propriétaire NEUTRE (invisible
//  sous RLS). Un vendeur ne le liste et ne le rejoue que si l'adresse où il est
//  arrivé est une adresse que LUI a déclarée et que personne d'autre n'a
//  déclarée. Une fausse base à TROIS vendeurs, qui honore les filtres, les
//  projections `select=`, `meta->>` et la pagination `Range` (§6.3), et qui
//  coupe à 1 000 lignes sans le dire, comme Supabase (§4.5).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const J = '11111111-1111-1111-1111-111111111111';   // propriétaire de l'installation : la quarantaine d'AVANT est chez lui
const B = '22222222-2222-2222-2222-222222222222';   // un autre vendeur
const C = '33333333-3333-3333-3333-333333333333';   // un troisième
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const ID = 'email_quarantaine_mzx01abcde';
const LIGNE = {
  raison: 'adresse de réception inconnue', at: '2026-10-01T08:00:00.000Z',
  from: 'no-reply@vinted.fr', to: 'inconnue@vrm.center', subject: 'Ton article est vendu !',
  text: "acheteur-de-banc a acheté [Paire de banc] n°9001 42,00 €\nPrépare ton colis.", html: '<p>vendu</p>',
};

// ── Une fausse base, à deux vendeurs (partie 1, la forme d'avant) ────────────
let etat = {};
const journal = [];   // { m, id, owner, url }
const rep = (corps, status = 200, type = 'application/json') =>
  new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': type } });
const authDe = (opts) => {
  const a = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '');
  return { 'Bearer jeton-de-B': B, 'Bearer jeton-de-J': J, 'Bearer jeton-de-C': C }[a] || '';
};
const fetchPartie1 = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  if (u.includes('/auth/v1/user')) { const id = authDe(opts); return id ? rep({ id }) : rep({ msg: 'invalid' }, 401); }
  if (!u.includes('/rest/v1/')) return rep({});
  if (m === 'POST') {
    try { JSON.parse(opts.body || '[]').forEach((x) => journal.push({ m, id: x.id, owner: x.owner || '', data: x.data })); } catch (_) {}
    return rep('', 201);
  }
  if (m === 'DELETE') { journal.push({ m, url: u }); return rep('', 204); }
  if (/select=owner&limit=1/.test(u)) return etat.sansColonne ? rep({ code: '42703' }, 400) : rep([{ owner: J }]);
  if (u.includes('id=eq.' + ID)) {
    if (etat.panne) return rep('<html>522</html>', 522, 'text/html');
    const filtre = /owner=eq\.([0-9a-f-]+)/.exec(u);
    if (filtre && etat.sansColonne) return rep({ code: '42703' }, 400);
    if (filtre && filtre[1] !== J) return rep([]);                // la ligne est à J
    return rep([{ data: LIGNE }]);
  }
  return rep([]);
};
const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };

// ── PARTIE 2 : une base à trois vendeurs, qui sert la VRAIE forme ────────────
// `meta` : la règle de la base (`vrm_meta`) — les valeurs simples de `data`
// dont le JSON tient en 600 octets.
const metaDe = (d) => {
  const o = {};
  for (const k in (d || {})) { const v = d[k]; if (['string', 'number', 'boolean'].includes(typeof v) && Buffer.byteLength(JSON.stringify(v)) <= 600) o[k] = v; }
  return o;
};
let base = [];          // { owner, id, data }
let panne2 = {};        // { registre, page2, ligne }
const journal2 = [];    // { m, id?, owner?, url, data? }
const champ = (row, chemin) => {
  const m = /^(data|meta)(?:->>|->)(.+)$/.exec(chemin);
  if (m) { const src = m[1] === 'data' ? row.data : metaDe(row.data); const v = src ? src[m[2]] : undefined; return v === undefined ? null : (chemin.includes('->>') && v !== null && typeof v === 'object' ? JSON.stringify(v) : v); }
  if (chemin === 'data') return row.data;
  return row[chemin] === undefined ? null : row[chemin];
};
const fetchPartie2 = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  if (u.includes('/auth/v1/user')) { const id = authDe(opts); return id ? rep({ id }) : rep({ msg: 'invalid' }, 401); }
  if (!u.includes('/rest/v1/app_data')) return m === 'GET' ? rep([]) : rep('', 201);
  const q = u.split('?')[1] || '';
  const params = q.split('&').map((p) => { const i = p.indexOf('='); return [p.slice(0, i), p.slice(i + 1)]; });
  if (m === 'POST') {
    try { JSON.parse(opts.body || '[]').forEach((x) => { journal2.push({ m, id: x.id, owner: x.owner || '', data: x.data, url: u }); }); } catch (_) {}
    return rep('', 201);
  }
  if (m === 'DELETE') { journal2.push({ m, url: u }); return rep('', 204); }
  if (/select=owner&limit=1/.test(u)) return rep([{ owner: J }]);
  let rows = base.slice();
  let select = null, ordre = false;
  for (const [k, v] of params) {
    if (k === 'select') { select = v; continue; }
    if (k === 'order') { ordre = true; continue; }
    if (k === 'on_conflict' || k === 'limit') continue;
    const val = v || '';
    if (k === 'id' && val.startsWith('eq.')) rows = rows.filter((r) => r.id === val.slice(3));
    else if (k === 'id' && val.startsWith('like.')) { const re = new RegExp('^' + val.slice(5).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); rows = rows.filter((r) => re.test(r.id)); }
    else if (k === 'id' && val.startsWith('in.(')) { const l = val.slice(4, -1).split(','); rows = rows.filter((r) => l.includes(r.id)); }
    else if (k === 'owner' && val.startsWith('eq.')) rows = rows.filter((r) => r.owner === val.slice(3));
    else if (/^meta->>/.test(k) && val === 'is.null') rows = rows.filter((r) => champ(r, k) == null);
    else return rep({ message: 'filtre inconnu du banc : ' + k + '=' + val }, 400);
  }
  // Pannes ciblées : la base debout par ailleurs.
  if (panne2.registre && params.some(([k, v]) => k === 'id' && v === 'eq.vrm_email_owners')) return rep('<html>522</html>', 522, 'text/html');
  if (panne2.ligne && params.some(([k, v]) => k === 'id' && /^eq\.email_quarantaine_/.test(v))) return rep('<html>522</html>', 522, 'text/html');
  if (ordre) rows.sort((a, b) => a.id.localeCompare(b.id));
  // Pagination : `Range` honoré ; sans lui, 1 000 lignes au plus, sans le dire.
  const range = String((opts.headers && (opts.headers.Range || opts.headers.range)) || '');
  const mr = /^(\d+)-(\d+)$/.exec(range);
  const debut = mr ? +mr[1] : 0, fin = mr ? +mr[2] : 999;
  if (panne2.page2 && debut > 0) return rep('<html>522</html>', 522, 'text/html');
  rows = rows.slice(debut, Math.min(fin, debut + 999) + 1);
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

const registre = (owner, adresses) => ({ owner, id: 'vrm_email_owners', data: { adresses: Object.fromEntries(adresses.map((a) => [a, { owner, label: '' }])), updatedAt: '2026-10-05T10:00:00Z' } });
const neutre = (id, adresses, extra = {}) => ({ owner: NEUTRE, id, data: {
  raison: 'adresse de réception inconnue, et l’app compte plusieurs vendeurs', adresses,
  ...(adresses.join(' ').length <= 560 && !extra.sansDest ? { destinataires: adresses.join(' ') } : {}),
  at: '2026-09-28T07:15:00.000Z', from: 'no-reply@vinted.fr', to: adresses[0] || '',
  subject: extra.subject || 'Ton article est vendu !',
  text: "acheteur-de-banc a acheté [Paire de banc] n°9001 42,00 €\nPrépare ton colis.", html: '<p>vendu</p>', pieces: [],
  ...(extra.supprime ? { supprime: true } : {}) } });
const BASE_TROIS = () => [
  registre(J, ['recu@vrm.center']),
  registre(B, ['sophie@vrm.center', 'disputee@vrm.center']),
  registre(C, ['disputee@vrm.center', 'cyril@vrm.center']),
  neutre('email_quarantaine_n1sophie', ['sophie@vrm.center']),                         // à B
  neutre('email_quarantaine_n2inconnue', ['personne@vrm.center']),                     // à personne
  neutre('email_quarantaine_n3dispute', ['disputee@vrm.center']),                      // déclarée par B ET C
  neutre('email_quarantaine_n4deux', ['sophie@vrm.center', 'cyril@vrm.center']),       // deux vendeurs destinataires
  neutre('email_quarantaine_n5etiquette', ['sophie+vinted@vrm.center']),               // l’étiquette « + » retombe sur sophie@
  neutre('email_quarantaine_n6longue', ['sophie@vrm.center'], { sansDest: true }),     // adresses trop longues pour `meta`
  neutre('email_quarantaine_n7vide', ['sophie@vrm.center'], { supprime: true }),       // déjà rejouée
  { owner: J, id: 'email_quarantaine_j1avant', data: { ...LIGNE, adresses: ['inconnue@vrm.center'] } },  // une ligne d'AVANT, chez Julien
];

(async () => {
  process.env.VRM_OWNER_UID = J;
  global.fetch = fetchPartie1;
  let route;
  await essaie('chargement', async () => { route = await import('file://' + path.join(RACINE, 'api', 'email-rattacher.js')); });
  if (!route) { console.log(`\n❌ audit-email-rattacher : la route n'a pas pu être chargée`); process.exit(1); }
  const appeler = async (jeton, e, corps = { id: ID }) => {
    etat = e || {}; journal.length = 0;
    const res = faireRes();
    await route.default({ method: 'POST', headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, body: corps }, res);
    return { code: res.code, corps: res.corps, journal: journal.slice() };
  };
  const metier = (j) => j.filter((x) => x.m === 'POST' && !/^email_quarantaine_/.test(x.id));

  await essaie('autre vendeur', async () => {
    const o = await appeler('jeton-de-B');
    const chezB = metier(o.journal).filter((x) => x.owner === B);
    dit(chezB.length === 0, "un autre vendeur ne peut pas faire rejouer CHEZ LUI l'email mis de côté d'un autre",
      chezB.length ? `${chezB.length} ligne(s) écrite(s) chez lui : ${chezB.map((x) => x.id).join(', ')}` : '');
    dit(!o.journal.some((x) => x.m === 'DELETE'), "et il ne peut pas non plus l'effacer",
      o.journal.filter((x) => x.m === 'DELETE').map((x) => x.url).join(' · '));
    dit(o.code === 404, "il reçoit « introuvable » — comme pour un identifiant qui n'existe pas", `HTTP ${o.code}`);
  });
  await essaie('sans session', async () => {
    const o = await appeler('');
    dit(o.code === 401 && o.journal.filter((x) => x.m !== 'GET').length === 0,
      'sans session, rien n\'est rejoué ni écrit (pas même une copie de plus en quarantaine)',
      `HTTP ${o.code} · ${o.journal.map((x) => x.m + ' ' + (x.id || x.url)).join(', ')}`);
  });
  await essaie('lecture ratée', async () => {
    const o = await appeler('jeton-de-J', { panne: true });
    dit(o.code >= 500, "une lecture ratée n'est pas « déjà rattaché » : c'est « réessaie »", `HTTP ${o.code} ${JSON.stringify(o.corps)}`);
  });
  // ── L'autre sens : le vendeur à qui l'email appartient le récupère ────────
  await essaie('son vendeur', async () => {
    const o = await appeler('jeton-de-J');
    dit(o.code === 200 && o.corps && o.corps.ok && metier(o.journal).some((x) => x.owner === J),
      "l'autre sens : le vendeur qui possède l'email le rattache bien chez lui",
      `HTTP ${o.code} · ${JSON.stringify(metier(o.journal).map((x) => x.id + '@' + (x.owner === J ? 'J' : x.owner)))}`);
    const del = o.journal.filter((x) => x.m === 'DELETE');
    dit(del.length === 1 && del[0].url.includes('owner=eq.' + J),
      "et la quarantaine n'est retirée QUE chez lui", del.map((x) => x.url.replace(/^.*\/rest\/v1\//, '')).join(' · ') || 'aucun DELETE');
  });

  // ══ PARTIE 2 : la quarantaine sous le propriétaire NEUTRE ══════════════════
  global.fetch = fetchPartie2;
  const lister = async (jeton) => {
    const res = faireRes();
    await route.default({ method: 'GET', query: { mode: 'liste' }, headers: jeton ? { authorization: 'Bearer ' + jeton } : {} }, res);
    return { code: res.code, corps: res.corps, ids: ((res.corps && res.corps.emails) || []).map((x) => x.id) };
  };
  const reclamer = async (jeton, id) => {
    journal2.length = 0;
    const res = faireRes();
    await route.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + jeton }, body: { id, silencieux: true } }, res);
    return { code: res.code, corps: res.corps, journal: journal2.slice() };
  };
  const metier2 = (j) => j.filter((x) => x.m === 'POST' && !/^email_quarantaine_/.test(x.id));
  const nonGet = (j) => j.filter((x) => x.m !== 'GET');
  const raz = (extra = {}) => { base = BASE_TROIS(); panne2 = extra; journal2.length = 0; };

  await essaie('liste : B', async () => {
    raz();
    const o = await lister('jeton-de-B');
    dit(o.code === 200 && o.ids.includes('email_quarantaine_n1sophie'),
      "liste : B voit l'email arrivé sur SON adresse déclarée", `HTTP ${o.code} · ${o.ids.join(', ')}`);
    dit(o.ids.includes('email_quarantaine_n5etiquette') && o.ids.includes('email_quarantaine_n6longue'),
      "liste : la même règle qu'à l'arrivée — l'étiquette « + », et une liste d'adresses trop longue pour `meta`",
      o.ids.join(', '));
    const interdits = ['n2inconnue', 'n3dispute', 'n4deux', 'n7vide', 'j1avant'].map((x) => 'email_quarantaine_' + x).filter((x) => o.ids.includes(x));
    dit(o.code === 200 && interdits.length === 0,
      "liste : ni l'adresse de personne, ni l'adresse disputée, ni deux vendeurs destinataires, ni une ligne vidée, ni celle de Julien",
      interdits.join(', '));
    const cles = new Set(((o.corps && o.corps.emails) || []).flatMap((x) => Object.keys(x)));
    const trop = [...cles].filter((k) => !['id', 'sujet', 'raison', 'quand'].includes(k));
    dit(o.code === 200 && cles.size > 0 && trop.length === 0,
      "liste : des scalaires seulement — jamais le texte de l'email ni ses adresses (§4.4)", trop.join(', ') || [...cles].join(','));
  });
  await essaie('liste : C', async () => {
    raz();
    const o = await lister('jeton-de-C');
    dit(o.code === 200 && o.ids.length === 0,
      "liste : C (qui n'a déclaré qu'une adresse disputée et une autre) ne voit RIEN de ce qui n'est pas à lui seul",
      `HTTP ${o.code} · ${o.ids.join(', ')}`);
  });
  await essaie('liste : J', async () => {
    raz();
    const o = await lister('jeton-de-J');
    dit(o.code === 200 && o.ids.length === 1 && o.ids[0] === 'email_quarantaine_j1avant',
      "liste : Julien voit sa ligne d'AVANT — et aucune ligne neutre (pas de repli « installation » sur le tas)",
      `HTTP ${o.code} · ${o.ids.join(', ')}`);
  });
  await essaie('liste : Julien redevenu seul', async () => {
    // Les deux autres vendeurs sont partis (leurs lignes de registre aussi) :
    // le tas reste à PERSONNE — jamais au propriétaire de l'installation.
    raz();
    base = base.filter((r) => !(r.id === 'vrm_email_owners' && r.owner !== J));
    const o = await lister('jeton-de-J');
    const r = await reclamer('jeton-de-J', 'email_quarantaine_n1sophie');
    dit(o.code === 200 && !o.ids.some((x) => /_n\d/.test(x)) && r.code === 404 && nonGet(r.journal).length === 0,
      "liste/réclamer : Julien redevenu seul ne récupère pas pour autant les emails mis de côté des vendeurs partis",
      `liste ${o.code} · ${o.ids.join(', ')} · réclamer ${r.code}`);
  });
  await essaie('liste : sans session', async () => {
    raz();
    const o = await lister('');
    dit(o.code === 401, 'liste : sans session, rien', `HTTP ${o.code}`);
  });
  await essaie('liste : registre illisible', async () => {
    raz({ registre: true });
    const o = await lister('jeton-de-B');
    dit(o.code === 503 && !o.ids.length, 'liste : registre illisible → 503, jamais « rien à réclamer »', `HTTP ${o.code} · ${o.ids.join(', ')}`);
  });
  await essaie('liste : pagination', async () => {
    raz();
    for (let i = 0; i < 1100; i++) base.push(neutre(`email_quarantaine_p${String(i).padStart(4, '0')}`, ['sophie@vrm.center']));
    const o = await lister('jeton-de-B');
    const n = o.ids.filter((x) => /_p\d{4}$/.test(x)).length;
    dit(o.code === 200 && n === 1100, 'liste : paginée — 1 100 emails à réclamer, 1 100 rendus (Supabase coupe à 1 000 sans le dire)', `HTTP ${o.code} · ${n}`);
    panne2 = { page2: true };
    const p = await lister('jeton-de-B');
    dit(p.code === 503, "liste : une page ratée → 503, jamais une demi-liste qui a l'air complète", `HTTP ${p.code} · ${p.ids.length} rendus`);
  });

  await essaie('réclamer : B', async () => {
    raz();
    const o = await reclamer('jeton-de-B', 'email_quarantaine_n1sophie');
    const chezB = metier2(o.journal).filter((x) => x.owner === B);
    dit(o.code === 200 && o.corps && o.corps.ok && chezB.length > 0,
      "réclamer : B rejoue l'email arrivé sur son adresse, chez LUI", `HTTP ${o.code} · ${JSON.stringify(metier2(o.journal).map((x) => x.id + '@' + x.owner.slice(0, 2)))}`);
    const ailleurs = metier2(o.journal).filter((x) => x.owner !== B);
    dit(ailleurs.length === 0, 'réclamer : rien ne part chez Julien ni chez personne d’autre', ailleurs.map((x) => x.id + '@' + x.owner).join(', '));
    const vente = metier2(o.journal).find((x) => /^email_sale_/.test(x.id));
    dit(!!vente && vente.data && vente.data.receivedAt === '2026-09-28T07:15:00.000Z',
      "réclamer : la vente garde la date d'ARRIVÉE de l'email, pas celle du rejeu", vente ? String(vente.data && vente.data.receivedAt) : 'aucune vente écrite');
    const del = o.journal.filter((x) => x.m === 'DELETE');
    const vide = o.journal.filter((x) => x.m === 'POST' && x.id === 'email_quarantaine_n1sophie');
    dit(del.length === 1 && del[0].url.includes('owner=eq.' + NEUTRE) && vide.length === 1 && vide[0].owner === NEUTRE && vide[0].data && vide[0].data.supprime,
      'réclamer : la ligne neutre est vidée LÀ OÙ ELLE EST — jamais une copie vide chez Julien',
      `${del.map((x) => x.url.replace(/^.*\/rest\/v1\//, '')).join(' · ')} · vidée chez ${vide.map((x) => x.owner).join(',') || 'personne'}`);
  });
  await essaie('réclamer : C', async () => {
    raz();
    const o = await reclamer('jeton-de-C', 'email_quarantaine_n1sophie');
    dit(o.code === 404 && nonGet(o.journal).length === 0,
      "réclamer : C ne peut pas rejouer l'email arrivé sur l'adresse de B — ni l'écrire, ni l'effacer",
      `HTTP ${o.code} · ${nonGet(o.journal).map((x) => x.m + ' ' + (x.id || x.url)).join(', ')}`);
  });
  await essaie('réclamer : disputée', async () => {
    raz();
    const b = await reclamer('jeton-de-B', 'email_quarantaine_n3dispute');
    const c = await reclamer('jeton-de-C', 'email_quarantaine_n3dispute');
    dit(b.code === 404 && c.code === 404 && nonGet(b.journal).length === 0 && nonGet(c.journal).length === 0,
      'réclamer : une adresse déclarée par DEUX vendeurs ne se réclame par personne', `B ${b.code} · C ${c.code}`);
    const d = await reclamer('jeton-de-B', 'email_quarantaine_n4deux');
    dit(d.code === 404 && nonGet(d.journal).length === 0, 'réclamer : deux vendeurs destinataires — personne ne tranche', `HTTP ${d.code}`);
  });
  await essaie('réclamer : J sur le tas', async () => {
    raz();
    const o = await reclamer('jeton-de-J', 'email_quarantaine_n2inconnue');
    dit(o.code === 404 && nonGet(o.journal).length === 0,
      "réclamer : le propriétaire de l'installation ne prend pas un email dont l'adresse n'est à personne", `HTTP ${o.code}`);
  });
  await essaie('réclamer : registre illisible', async () => {
    raz({ registre: true });
    const o = await reclamer('jeton-de-B', 'email_quarantaine_n1sophie');
    dit(o.code === 503 && nonGet(o.journal).length === 0,
      "réclamer : registre illisible → 503 (« réessaie »), jamais « déjà rattaché », et rien n'est écrit", `HTTP ${o.code}`);
  });
  await essaie('réclamer : ligne illisible', async () => {
    raz({ ligne: true });
    const o = await reclamer('jeton-de-B', 'email_quarantaine_n1sophie');
    dit(o.code === 503, 'réclamer : la ligne illisible → 503', `HTTP ${o.code}`);
  });
  await essaie('réclamer : déjà vidée', async () => {
    raz();
    const o = await reclamer('jeton-de-B', 'email_quarantaine_n7vide');
    // La vraie forme d'une ligne déjà rejouée chez Julien (ses 593, mesurées le 6 octobre).
    base.push({ owner: J, id: 'email_quarantaine_j2vide', data: { supprime: true, rejoueLe: '2026-08-22T10:00:00.000Z', type: 'traité' } });
    const j = await reclamer('jeton-de-J', 'email_quarantaine_j2vide');
    dit(o.code === 404 && j.code === 404 && metier2(o.journal).length === 0 && metier2(j.journal).length === 0,
      'réclamer : une ligne déjà rejouée (vidée) ne se rejoue pas une seconde fois — pas même un « email inconnu » vide de plus',
      `B ${o.code} · J ${j.code} · ${metier2(j.journal).map((x) => x.id).join(', ')}`);
  });
  await essaie('réclamer : J, ligne d’avant', async () => {
    raz();
    const o = await reclamer('jeton-de-J', 'email_quarantaine_j1avant');
    const del = o.journal.filter((x) => x.m === 'DELETE');
    dit(o.code === 200 && o.corps && o.corps.ok && metier2(o.journal).every((x) => x.owner === J) && del.length === 1 && del[0].url.includes('owner=eq.' + J),
      "réclamer : les lignes d'avant (rangées chez Julien) restent rejouables par Julien, et seulement chez lui",
      `HTTP ${o.code} · ${del.map((x) => x.url.replace(/^.*\/rest\/v1\//, '')).join(' · ')}`);
    const b = await reclamer('jeton-de-B', 'email_quarantaine_j1avant');
    dit(b.code === 404 && nonGet(b.journal).length === 0, "réclamer : et B ne prend pas une ligne d'avant de Julien", `HTTP ${b.code}`);
  });

  // ── En dernier : base non cloisonnée (la sonde d'email-inbound se mémorise) ──
  global.fetch = fetchPartie1;
  await essaie('base sans colonne owner', async () => {
    const o = await appeler('jeton-de-J', { sansColonne: true });
    dit(o.code === 200 && o.corps && o.corps.ok,
      'base non cloisonnée (une seule boutique) : le rattachement marche comme avant', `HTTP ${o.code}`);
  });

  console.log(ko ? `\n❌ audit-email-rattacher : ${ko} rouge(s), ${ok} vert(s)`
                 : `\n✅ audit-email-rattacher : ${ok} contrôles — un email mis de côté ne se rattache qu'à son vendeur`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ audit-email-rattacher est tombé :', e && e.message); process.exit(1); });
