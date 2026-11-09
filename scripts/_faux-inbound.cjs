// ════════════════════════════════════════════════════════════════════════════
//  UNE FAUSSE BASE POSTGREST POUR EXÉCUTER LA VRAIE ROUTE DES E-MAILS (6 nov.)
//  (api/email-inbound.js — §4.10 : une fonction serverless n'est vérifiée que si
//  un banc l'EXÉCUTE). Servie dans la FORME réelle : `app_data` clé-valeur,
//  `select=` projeté (`data->x`, `meta->>x` — la colonne `meta` est remplie par
//  un déclencheur depuis `data`, on la sert pareil), `id=eq.` / `like.` / `in.`,
//  POST `on_conflict` (merge ou ignore-duplicates, `return=representation`),
//  PATCH conditionnel (`data->>rev=eq.N` / `is.null` : le comparer-et-échanger du
//  dédoublonnage des notifications et du centre). Aucun réseau, aucune donnée
//  réelle (le dépôt est public). `panne(id)` : une écriture qui RATE sur ces lignes.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const path = require('path');

const A = '11111111-2222-3333-4444-555555555555';
const SECRET = 'cle-banc-inbound';

function fauxInbound(R) {
  process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
  process.env.VRM_OWNER_UID = A;
  process.env.EMAIL_INBOUND_SECRET = SECRET;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  const base = new Map();                 // `${owner}|${id}` → data
  const comptes = [];                     // vinted_accounts
  const ecritures = [];                   // ids écrits (POST/PATCH)
  let enPanne = () => false;
  const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
  const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
  const lignes = () => [...base.entries()].map(([k, d]) => { const i = k.indexOf('|'); return { owner: k.slice(0, i), id: k.slice(i + 1), data: d }; });
  const filtreId = (u) => {
    const idp = u.searchParams.get('id') || '';
    if (idp.startsWith('eq.')) { const v = idp.slice(3); return (id) => id === v; }
    if (idp.startsWith('like.')) { const re = new RegExp('^' + idp.slice(5).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return (id) => re.test(id); }
    if (idp.startsWith('in.(')) { const ids = idp.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, '')); return (id) => ids.includes(id); }
    return () => true;
  };
  const filtreOwner = (u) => { const o = u.searchParams.get('owner') || ''; return o.startsWith('eq.') ? (x) => x === o.slice(3) : () => true; };
  const condRev = (u, d) => {
    for (const [k, v] of u.searchParams.entries()) {
      if (k !== 'data->>rev') continue;
      const rev = d && d.rev != null ? String(d.rev) : null;
      if (v === 'is.null') return rev == null;
      if (v.startsWith('eq.')) return rev === v.slice(3);
    }
    return true;
  };
  const projette = (l, sel) => {
    if (!sel || sel === 'data' || sel === 'id,data' || sel === 'owner,data' || sel === '*') return { id: l.id, owner: l.owner, data: l.data };
    const o = {};
    for (const part of sel.split(',')) {
      const [alias, ch] = part.includes(':') ? part.split(':') : [part.split(/->>|->/).pop(), part];
      if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
      if (ch === 'updated_at') { o[alias] = new Date().toISOString(); continue; }
      let v = chemin(l.data, ch.replace(/^(data|meta)(->>|->)/, ''));
      if (ch.includes('->>') && v != null && typeof v === 'object') v = JSON.stringify(v);
      o[alias] = v === undefined ? null : v;
    }
    return o;
  };
  const fauxFetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    const m = (opts.method || 'GET').toUpperCase();
    const prefer = String((opts.headers && (opts.headers.Prefer || opts.headers.prefer)) || '');
    if (u.pathname.startsWith('/rest/v1/rpc/')) return rep(true);
    if (u.pathname === '/rest/v1/vinted_accounts') return rep(m === 'GET' ? comptes : []);
    if (u.pathname !== '/rest/v1/app_data') return rep([]);
    if (m === 'POST') {
      const rows = JSON.parse(opts.body || '[]');
      if (rows.some((r) => enPanne(r.id))) return rep({ message: 'indisponible' }, 503);
      const faits = [];
      for (const r of rows) {
        const cle = `${r.owner || A}|${r.id}`;
        if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue;
        base.set(cle, r.data); ecritures.push(r.id); faits.push({ id: r.id, owner: r.owner || A, data: r.data });
      }
      return /return=representation/.test(prefer) ? rep(faits, 201) : new Response('', { status: 201 });
    }
    if (m === 'PATCH') {
      const b = JSON.parse(opts.body || '{}');
      const fi = filtreId(u), fo = filtreOwner(u);
      const cibles = lignes().filter((l) => fi(l.id) && fo(l.owner) && condRev(u, l.data));
      if (cibles.some((l) => enPanne(l.id))) return rep({ message: 'indisponible' }, 503);
      for (const l of cibles) { base.set(`${l.owner}|${l.id}`, b.data !== undefined ? b.data : l.data); ecritures.push(l.id); }
      return rep(cibles.map((l) => ({ id: l.id })));
    }
    if (m !== 'GET') return rep([]);
    const sel = u.searchParams.get('select') || '';
    if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
    const fi = filtreId(u), fo = filtreOwner(u);
    return rep(lignes().filter((l) => fi(l.id) && fo(l.owner)).map((l) => projette(l, sel)));
  };
  const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };
  let route = null, n = 0;
  const charger = async () => { global.fetch = fauxFetch; if (!route) route = await import('file://' + path.join(R, 'api', 'email-inbound.js')); return route; };
  // Reçoit UN e-mail (forme « JSON à plat ») sur l'adresse déclarée du vendeur A.
  const recoit = async (mail) => {
    const r = await charger();
    const res = faireRes();
    n += 1;
    await r.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': SECRET }, body: { to: 'boite@banc.test', html: '', attachments: [], messageId: `<banc-${n}-${Date.now()}@banc.test>`, ...mail } }, res);
    return res;
  };
  const vider = () => { base.clear(); ecritures.length = 0; base.set(`${A}|vrm_email_owners`, { adresses: { 'boite@banc.test': { owner: A } } }); };
  vider();
  const ids = (re) => lignes().filter((l) => re.test(l.id));
  return { A, base, comptes, ecritures, recoit, vider, ids, charger, panne: (f) => { enPanne = f || (() => false); } };
}
module.exports = { fauxInbound, A };
