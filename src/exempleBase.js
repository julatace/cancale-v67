// ── LA BASE DU MODE EXEMPLE, EN MÉMOIRE (6 nov., « Découvrir avec des exemples ») ──
// Une petite imitation de PostgREST (la forme que l'app lit vraiment : `select=`
// projeté, `data->>`, `meta->>`, `id=eq.` / `like.` / `in.`, `or=(…)`, `order`,
// `limit`, en-tête `Range`), qui sert les lignes INVENTÉES de src/exempleDonnees.js
// et garde les écritures de l'app DANS LA PAGE.
// ⚠️ §2.3 : AUCUNE ligne de l'exemple ne part jamais vers la vraie base. Ce module
//    ne fait AUCUN appel réseau : il rend des réponses fabriquées sur place. Le
//    branchement (qui intercepte quoi) est dans src/modeExemple.js.
// Repris de scripts/bancs/_minipgrest.cjs et _meta.cjs (la même lecture que les
// bancs servent depuis des mois), en module du navigateur.

// `meta->>k` est une colonne calculée par la base à partir de `data` (migration
// 004) : on la relit dans `data`, avec les mêmes cas que la règle SQL.
const TXN = new Set(['id', 'item_id', 'status', 'status_title', 'status_updated_at']);
export function metaVersData(u) {
  if (!u || u.indexOf('meta') < 0) return u;
  const txn = /_txn_/.test(u);
  return u.replace(/meta(->>|->)([A-Za-z_]+)(=eq\.true)?/g, (m, fl, k, eqTrue) => {
    if (k === '_pdf') return `data${fl}pdfB64${eqTrue ? '=not.is.null' : ''}`;
    if (txn && TXN.has(k)) return `data->payload->transaction${fl}${k}${eqTrue || ''}`;
    if (txn && k === 'ship_status_title') return `data->payload->transaction->shipment${fl}status_title${eqTrue || ''}`;
    return `data${fl}${k}${eqTrue || ''}`;
  });
}

const COLONNES = new Set(['id', 'owner', 'updated_at', 'created_at']);
export function lireChemin(row, chemin) {
  if (COLONNES.has(chemin) || !/^(data|meta)(->|$)/.test(chemin)) return row[chemin] === undefined ? null : row[chemin];
  const m = /^(data|meta)(.*)$/.exec(chemin);
  let v = row.data;
  const segs = m[2].split(/(->>|->)/).filter(Boolean);
  let texte = false;
  for (const s of segs) {
    if (s === '->') { texte = false; continue; }
    if (s === '->>') { texte = true; continue; }
    if (v == null) return null;
    const cle = s.replace(/^"(.*)"$/, '$1');
    if (Array.isArray(v) && /^-?\d+$/.test(cle)) { const n = +cle; v = n < 0 ? v[v.length + n] : v[n]; } else v = v[cle];
  }
  if (v === undefined) return null;
  if (texte && v != null && typeof v === 'object') return JSON.stringify(v);
  if (texte && v != null) return String(v);
  return v;
}

const motif = (p, ci) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', ci ? 'i' : '');
function contient(a, b) {
  if (b === null || typeof b !== 'object') return a === b || (a != null && typeof b !== 'object' && String(a) === String(b));
  if (Array.isArray(b)) return Array.isArray(a) && b.every((x) => a.some((y) => contient(y, x)));
  if (a == null || typeof a !== 'object') return false;
  return Object.keys(b).every((k) => contient(a[k], b[k]));
}
function teste(row, col, expr) {
  let neg = false;
  if (expr.startsWith('not.')) { neg = true; expr = expr.slice(4); }
  const i = expr.indexOf('.');
  const op = expr.slice(0, i), val = expr.slice(i + 1);
  const v = lireChemin(row, col);
  const num = (x) => x !== null && x !== '' && !isNaN(+x);
  let r;
  switch (op) {
    case 'eq': r = v != null && String(v) === val; break;
    case 'neq': r = v != null && String(v) !== val; break;
    case 'is': r = val === 'null' ? v == null : val === 'true' ? (v === true || v === 'true') : (v === false || v === 'false'); break;
    case 'like': r = v != null && motif(val).test(String(v)); break;
    case 'ilike': r = v != null && motif(val.replace(/^"|"$/g, ''), true).test(String(v)); break;
    case 'gte': r = v != null && (num(v) && num(val) ? +v >= +val : String(v) >= val); break;
    case 'gt': r = v != null && (num(v) && num(val) ? +v > +val : String(v) > val); break;
    case 'lte': r = v != null && (num(v) && num(val) ? +v <= +val : String(v) <= val); break;
    case 'lt': r = v != null && (num(v) && num(val) ? +v < +val : String(v) < val); break;
    case 'in': { const l = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')); r = v != null && l.includes(String(v)); break; }
    case 'cs': { let b = null; try { b = JSON.parse(val); } catch (_) {} let a = v; if (typeof a === 'string') { try { a = JSON.parse(a); } catch (_) {} } r = b != null && contient(a, b); break; }
    default: r = true;
  }
  return neg ? !r : r;
}
function decoupe(s) {
  const out = []; let prof = 0, cur = '', guill = false;
  for (const c of s) {
    if (c === '"' && cur.slice(-1) !== '\\') guill = !guill;
    if (!guill && c === '(') prof++;
    if (!guill && c === ')') prof--;
    if (!guill && prof === 0 && c === ',') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}
function condition(row, c) {
  const m = /^(or|and)\((.*)\)$/.exec(c);
  if (m) { const parts = decoupe(m[2]); return m[1] === 'or' ? parts.some((p) => condition(row, p)) : parts.every((p) => condition(row, p)); }
  const mm = /^([a-z_]+(?:(?:->>|->)(?:"[^"]*"|[A-Za-z0-9_-]+))*)\.(.*)$/.exec(c);
  return mm ? teste(row, mm[1], mm[2]) : true;
}
function projette(row, select) {
  if (!select || select === '*') return { ...row };
  const out = {};
  for (const part of decoupe(select)) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim());
    if (!m) continue;
    const src = m[2].replace(/::[a-z]+$/, '');
    const alias = m[1] || src.split(/->>|->/).pop().replace(/^"|"$/g, '');
    out[alias] = lireChemin(row, src);
  }
  return out;
}
const PARAMS_HORS_FILTRE = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
export function filtrer(rows, params) {
  let res = rows.slice();
  for (const [k, v] of params.entries()) {
    if (PARAMS_HORS_FILTRE.has(k)) continue;
    if (k === 'or' || k === 'and') { res = res.filter((r) => condition(r, k + v)); continue; }
    res = res.filter((r) => teste(r, k, v));
  }
  return res;
}

// Une requête de la table `app_data` (ou d'une autre table de lignes) :
// rend `{ status, body, headers }` — jamais d'exception.
// `table` = { lignes: [...] } (muté sur place par les écritures).
export function servirTable(table, { methode = 'GET', url, entetes = {}, corps = null, owner = null }) {
  // `url` est un chemin (`/rest/v1/app_data?…`) : seuls ses paramètres comptent.
  const brut = metaVersData(decodeURIComponent(url));
  const p = new URLSearchParams(brut.includes('?') ? brut.slice(brut.indexOf('?') + 1) : '');
  const prefer = String(entetes.Prefer || entetes.prefer || '');
  const json = (status, b, extra) => ({ status, body: b, headers: { 'content-type': 'application/json', ...(extra || {}) } });
  if (methode === 'GET' || methode === 'HEAD') {
    let res = filtrer(table.lignes, p);
    const o = p.get('order');
    if (o) {
      const parts = o.split(',');
      res.sort((a, b) => {
        for (const pp of parts) {
          const mm = /^(.+?)(?:\.(asc|desc))?(?:\.nulls(first|last))?$/.exec(pp);
          const x = lireChemin(a, mm[1]), y = lireChemin(b, mm[1]);
          if (x == y) continue; // eslint-disable-line eqeqeq
          const s = x == null ? -1 : y == null ? 1 : x < y ? -1 : 1;
          return mm[2] === 'desc' ? -s : s;
        }
        return 0;
      });
    }
    const total = res.length;
    let de = 0, a = res.length - 1;
    const rg = entetes.Range || entetes.range;
    if (rg) { const mm = /(\d+)-(\d+)/.exec(rg); if (mm) { de = +mm[1]; a = +mm[2]; } }
    if (p.get('offset')) de = +p.get('offset');
    if (p.get('limit')) a = de + (+p.get('limit')) - 1;
    if (de > 0 && de >= total) return json(416, { message: 'Range Not Satisfiable' }, { 'content-range': `*/${total}` });
    res = res.slice(de, a + 1);
    return json(200, res.map((r) => projette(r, p.get('select'))), { 'content-range': `${res.length ? de : '*'}${res.length ? '-' + (de + res.length - 1) : ''}/${total}` });
  }
  const representation = /return=representation/.test(prefer);
  const date = new Date().toISOString();
  if (methode === 'POST') {
    const lignes = Array.isArray(corps) ? corps : corps && typeof corps === 'object' ? [corps] : [];
    const ecrites = [];
    for (const l of lignes) {
      if (!l || typeof l !== 'object') continue;
      const id = l.id != null ? String(l.id) : `exemple-${table.lignes.length + 1}`;
      const neuve = { ...l, id, owner: l.owner || owner, updated_at: date };
      const i = table.lignes.findIndex((x) => String(x.id) === id);
      if (i >= 0) table.lignes[i] = { ...table.lignes[i], ...neuve }; else table.lignes.push(neuve);
      ecrites.push(neuve);
    }
    return representation ? json(201, ecrites) : { status: 201, body: null, headers: {} };
  }
  if (methode === 'PATCH') {
    const visees = filtrer(table.lignes, p);
    const champs = corps && typeof corps === 'object' && !Array.isArray(corps) ? corps : {};
    for (const r of visees) Object.assign(r, champs, { updated_at: date });
    return representation ? json(200, visees.map((r) => projette(r, p.get('select')))) : { status: 204, body: null, headers: {} };
  }
  if (methode === 'DELETE') {
    const visees = new Set(filtrer(table.lignes, p));
    table.lignes = table.lignes.filter((r) => !visees.has(r));
    return representation ? json(200, [...visees]) : { status: 204, body: null, headers: {} };
  }
  return json(405, { message: 'méthode' });
}
