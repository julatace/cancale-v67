// ════════════════════════════════════════════════════════════════════════════
//  UN FAUX POSTGREST EN MÉMOIRE (15 nov., banc partenaires) — pour EXÉCUTER les
//  vraies routes serveur (api/*.js) sans base réelle. Il sert la FORME de PostgREST :
//  filtres `col=op.val` (eq, neq, is, not.is, in, like, gt, gte, lt, lte), `select=`
//  avec alias et `data->>champ`, `order`, `limit`, `offset`, `on_conflict`,
//  `Prefer: resolution=ignore-duplicates|merge-duplicates, return=representation`,
//  les clés uniques (409 + code 23505, comme Postgres), une table ABSENTE (404 +
//  PGRST205, comme une migration pas passée), et la RLS d'une table fermée (un jeton
//  de vendeur ⇒ 401/42501). Aucune donnée réelle : le banc pose tout.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const crypto = require('crypto');

function fauxPostgrest({ schemas = {}, absentes = new Set(), fermees = new Set(), estService = () => true, rlsVendeur = {} } = {}) {
  const t = {};
  for (const nom of Object.keys(schemas)) t[nom] = [];
  const pannes = new Map();   // `${table}:${methode}` → nombre d'échecs à servir
  const rep = (corps, status = 200, h = {}) => new Response(corps == null ? null : (typeof corps === 'string' ? corps : JSON.stringify(corps)), { status, headers: { 'content-type': 'application/json', ...h } });
  const valeur = (ligne, col) => {
    const m = /^(\w+)->>(\w+)$/.exec(col);
    if (m) { const o = ligne[m[1]]; return o && typeof o === 'object' && o[m[2]] != null ? String(o[m[2]]) : null; }
    return ligne[col];
  };
  const egal = (a, b) => (a == null ? false : String(a) === String(b));
  const num = (x, v) => typeof x === 'number' && /^-?\d+(\.\d+)?$/.test(String(v));
  const filtre = (col, expr) => {
    let neg = false, e = expr;
    if (e.startsWith('not.')) { neg = true; e = e.slice(4); }
    const i = e.indexOf('.'); const op = e.slice(0, i), v = e.slice(i + 1);
    const f = (l) => {
      const x = valeur(l, col);
      switch (op) {
        case 'eq': return egal(x, v);
        case 'neq': return !egal(x, v);
        case 'is': return v === 'null' ? x == null : v === 'true' ? x === true : x === false;
        case 'in': { const vals = v.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')); return vals.some((y) => egal(x, y)); }
        case 'like': { const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*') + '$'); return x != null && re.test(String(x)); }
        // (16 nov.) Une colonne NOMBRE se compare en nombre (comme Postgres : 100 < 282, jamais « "100" < "50" »).
        case 'gt': return x != null && (num(x, v) ? Number(x) > Number(v) : String(x) > v);
        case 'gte': return x != null && (num(x, v) ? Number(x) >= Number(v) : String(x) >= v);
        case 'lt': return x != null && (num(x, v) ? Number(x) < Number(v) : String(x) < v);
        case 'lte': return x != null && (num(x, v) ? Number(x) <= Number(v) : String(x) <= v);
        default: throw new Error('opérateur inconnu ' + op);
      }
    };
    return neg ? (l) => !f(l) : f;
  };
  const projeter = (l, select) => {
    if (!select || select === '*') return { ...l };
    const o = {};
    for (const morceau of select.split(',')) {
      const [alias, col] = morceau.includes(':') ? morceau.split(':') : [morceau.replace(/^.*->>/, ''), morceau];
      o[alias] = valeur(l, col) === undefined ? null : valeur(l, col);
    }
    return o;
  };
  const conflit = (nom, ligne, sauf) => {
    for (const u of (schemas[nom].uniques || [])) {
      const cols = u.cols || u, partiel = u.si || (() => true);
      if (!partiel(ligne) || cols.some((c) => ligne[c] == null)) continue;
      const autre = t[nom].find((x) => x !== sauf && partiel(x) && cols.every((c) => String(x[c]) === String(ligne[c])));
      if (autre) return { cols, autre };
    }
    return null;
  };
  const defauts = (nom, l) => {
    const d = schemas[nom].defauts || {};
    const o = { ...l };
    for (const [k, f] of Object.entries(d)) if (o[k] === undefined) o[k] = typeof f === 'function' ? f() : f;
    for (const k of schemas[nom].colonnes || []) if (o[k] === undefined) o[k] = null;
    return o;
  };

  async function traiter(url, opts = {}) {
    const u = new URL(url);
    const nom = u.pathname.replace(/^\/rest\/v1\//, '').split('/')[0];
    const m = (opts.method || 'GET').toUpperCase();
    const h = opts.headers || {};
    const prefer = String(h.Prefer || h.prefer || '');
    if (absentes.has(nom)) return rep({ code: 'PGRST205', message: `Could not find the table 'public.${nom}' in the schema cache` }, 404);
    const service = estService(h);
    if (!service && fermees.has(nom)) return rep({ code: '42501', message: `permission denied for table ${nom}` }, 401);
    if (!t[nom]) return rep({ code: 'PGRST205', message: 'table inconnue du faux PostgREST : ' + nom }, 404);
    const cle = `${nom}:${m}`;
    if (pannes.get(cle) > 0) { pannes.set(cle, pannes.get(cle) - 1); return rep({ message: 'panne simulée' }, 503); }
    const params = [...u.searchParams.entries()];
    const RES = new Set(['select', 'order', 'limit', 'offset', 'on_conflict']);
    const filtres = params.filter(([k]) => !RES.has(k)).map(([k, v]) => filtre(k, v));
    if (!service && rlsVendeur[nom]) filtres.push(rlsVendeur[nom](h));
    const select = u.searchParams.get('select');
    const garde = (l) => filtres.every((f) => f(l));
    if (m === 'GET') {
      let lignes = t[nom].filter(garde);
      const ordre = u.searchParams.get('order');
      if (ordre) { const [c, sens] = ordre.split('.'); lignes = [...lignes].sort((a, b) => String(a[c] ?? '').localeCompare(String(b[c] ?? '')) * (sens === 'desc' ? -1 : 1)); }
      const off = Number(u.searchParams.get('offset') || 0), lim = u.searchParams.get('limit');
      lignes = lignes.slice(off, lim == null ? undefined : off + Number(lim));
      return rep(lignes.map((l) => projeter(l, select)));
    }
    let corps = null; try { corps = opts.body ? JSON.parse(opts.body) : null; } catch (_) { return rep({ message: 'corps illisible' }, 400); }
    const rendre = /return=representation/.test(prefer);
    if (m === 'POST') {
      const lignes = (Array.isArray(corps) ? corps : [corps]).map((l) => defauts(nom, l));
      const ignorer = /ignore-duplicates/.test(prefer), fusionner = /merge-duplicates/.test(prefer);
      const surCols = (u.searchParams.get('on_conflict') || '').split(',').filter(Boolean);
      const rendus = [];
      for (const l of lignes) {
        if (schemas[nom].verifier) { const err = schemas[nom].verifier(l); if (err) return rep({ code: '23514', message: 'check ' + err }, 400); }
        const c = conflit(nom, l);
        if (c) {
          const surCeConflit = surCols.length && surCols.every((x) => c.cols.includes(x)) && c.cols.every((x) => surCols.includes(x));
          if (ignorer && surCeConflit) continue;
          if (fusionner && surCeConflit) { Object.assign(c.autre, l); rendus.push(c.autre); continue; }
          return rep({ code: '23505', message: `duplicate key value violates unique constraint (${c.cols.join(',')})` }, 409);
        }
        t[nom].push(l); rendus.push(l);
      }
      return rendre ? rep(rendus.map((l) => projeter(l, select)), 201) : rep(null, 201);
    }
    if (m === 'PATCH') {
      const cibles = t[nom].filter(garde);
      for (const l of cibles) {
        const nouveau = { ...l, ...corps };
        const c = conflit(nom, nouveau, l);
        if (c) return rep({ code: '23505', message: 'duplicate key' }, 409);
        Object.assign(l, corps);
      }
      return rendre ? rep(cibles.map((l) => projeter(l, select)), 200) : rep(null, 204);
    }
    if (m === 'DELETE') return rep({ code: '42501', message: 'permission denied' }, 403);
    return rep({ message: 'méthode' }, 405);
  }
  return { t, traiter, panne: (table, methode, n = 1) => pannes.set(`${table}:${methode}`, n), uuid: () => crypto.randomUUID() };
}
module.exports = { fauxPostgrest };
