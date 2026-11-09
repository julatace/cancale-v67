// ════════════════════════════════════════════════════════════════════════════
//  UN FAUX POSTGREST LOCAL, MULTI-VENDEURS (9 nov., chantier « charge-sauvegarde »)
//
//  Sert `app_data` / `vinted_accounts` / `abonnements` comme Supabase le fait
//  pour VRM, à N vendeurs INVENTÉS, sur 127.0.0.1 seulement. Jamais un octet de
//  la vraie base : chaque vendeur reçoit une copie du GABARIT de
//  `scripts/bancs/_base-volume.cjs` (le poids mesuré de la base de Julien, sans
//  une donnée copiée), sous SON owner. Les écritures vont dans une couche par
//  vendeur (le gabarit n'est jamais modifié).
//
//  Ce qu'il sait faire (ce que les routes `api/*` et l'app demandent) :
//   · filtres `col=op.val` (eq, neq, like, ilike, in, is, gte, gt, lte, lt, cs,
//     `not.`), `or=(…)` / `and=(…)`, chemins `data->a->>b`, colonne `meta`
//     calculée EXACTEMENT comme `public.vrm_meta` (migration 004) ;
//   · projection `select=` (alias, `->`, `->>`, `->"clé"`, `meta`, `owner`) ;
//   · pagination `Range` plafonnée à 1 000 lignes (comme Supabase), en-tête
//     `Content-Range`, `limit`, `order` (owner puis id) ;
//   · RLS : un jeton de vendeur (`jeton-<owner>`) ne voit et n'écrit QUE ses
//     lignes ; la clé de service voit tout et filtre par `owner=eq.` ;
//   · POST (upsert `on_conflict`), PATCH, DELETE, `Prefer: return=representation` ;
//   · `/auth/v1/user`, `/rest/v1/rpc/vrm_acces_pour|vrm_acces` (abonnement actif).
//  Il COMPTE tout : requêtes, octets envoyés (= l'égress de Supabase), octets
//  reçus, par famille de ligne, par vendeur, par route appelante.
//
//  Usage : const B = creerBase({ vendeurs: 50 }); await B.ecouter();
//          B.url, B.cleService, B.jeton(owner), B.compteurs, B.remettre()
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const http = require('http');
const path = require('path');
const zlib = require('zlib');
const { AsyncLocalStorage } = require('async_hooks');
// L'appel en cours (route, vendeur) : chaque requête faite à la base pendant un
// appel lui est comptée, même quand plusieurs appels tournent en même temps.
const appelCourant = new AsyncLocalStorage();
const { fabriquer } = require(path.join(__dirname, '..', 'bancs', '_base-volume.cjs'));

const NEUTRE = '00000000-0000-0000-0000-000000000000';
const uuidVendeur = (i) => `${String(i + 1).padStart(8, '0')}-c4a6-4e00-8a00-${String(i + 1).padStart(12, '0')}`;

// ── public.vrm_meta (004), recopiée ────────────────────────────────────────
function vrmMeta(id, d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const m = {};
  for (const [k, v] of Object.entries(d)) {
    if ((typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') && Buffer.byteLength(JSON.stringify(v)) <= 600) m[k] = v;
  }
  if (d.pdfB64 && d.pdfB64 !== '') m._pdf = true;
  if (/^harvest_[0-9]+_txn_/.test(id)) {
    const t = (d.payload && d.payload.transaction) || {};
    const put = (k, v) => { if (v !== undefined && v !== null) m[k] = v; };
    put('id', t.id); put('item_id', t.item_id); put('status', t.status); put('status_title', t.status_title);
    put('status_updated_at', t.status_updated_at); put('ship_status_title', t.shipment && t.shipment.status_title);
  }
  return m;
}

// ── Chemins, filtres, projection (la règle de PostgREST) ────────────────────
function getPath(row, chemin) {
  if (chemin === 'id' || chemin === 'owner' || chemin === 'updated_at' || chemin === 'created_at') return row[chemin] === undefined ? null : row[chemin];
  const m = /^(data|meta)(.*)$/.exec(chemin);
  if (!m) return row[chemin] === undefined ? null : row[chemin];
  let v = m[1] === 'meta' ? metaDe(row) : row.data;
  const segs = m[2].split(/(->>|->)/).filter(Boolean);
  let txt = false;
  for (const s of segs) {
    if (s === '->') { txt = false; continue; }
    if (s === '->>') { txt = true; continue; }
    if (v == null) return null;
    if (Array.isArray(v) && /^-?\d+$/.test(s)) { const n = +s; v = n < 0 ? v[v.length + n] : v[n]; }
    else v = v[s.replace(/^"(.*)"$/, '$1')];
  }
  if (v === undefined) return null;
  if (txt && v != null && typeof v === 'object') return JSON.stringify(v);
  if (txt && v != null) return String(v);
  return v;
}
function metaDe(row) {
  if (row.__meta === undefined) Object.defineProperty(row, '__meta', { value: vrmMeta(row.id, row.data), writable: true, enumerable: false });
  return row.__meta;
}
const likeRe = (p, ci) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', ci ? 'is' : 's');
function contient(a, b) {
  if (b === null || typeof b !== 'object') return a === b || (a != null && typeof a !== 'object' && String(a) === String(b));
  if (Array.isArray(b)) { if (!Array.isArray(a)) return false; return b.every((x) => a.some((y) => contient(y, x))); }
  if (a == null || typeof a !== 'object') return false;
  return Object.keys(b).every((k) => contient(a[k], b[k]));
}
const enListe = (val) => { const corps = val.replace(/^\(|\)$/g, ''); const out = []; let cur = '', q = false; for (const c of corps) { if (c === '"') { q = !q; continue; } if (c === ',' && !q) { out.push(cur); cur = ''; continue; } cur += c; } out.push(cur); return out; };
function test(row, col, expr) {
  let neg = false;
  if (expr.startsWith('not.')) { neg = true; expr = expr.slice(4); }
  const i = expr.indexOf('.');
  const op = expr.slice(0, i), val = expr.slice(i + 1);
  const v = getPath(row, col);
  let r;
  const num = (x) => x !== '' && x !== null && !isNaN(+x);
  switch (op) {
    case 'eq': r = v != null && String(v) === val; break;
    case 'neq': r = v != null && String(v) !== val; break;
    case 'is': r = val === 'null' ? v == null : (val === 'true' ? v === true || v === 'true' : v === false || v === 'false'); break;
    case 'like': r = v != null && likeRe(val).test(String(v)); break;
    case 'ilike': r = v != null && likeRe(val.replace(/^"|"$/g, ''), true).test(String(v)); break;
    case 'gte': r = v != null && (num(v) && num(val) ? +v >= +val : String(v) >= val); break;
    case 'gt': r = v != null && (num(v) && num(val) ? +v > +val : String(v) > val); break;
    case 'lte': r = v != null && (num(v) && num(val) ? +v <= +val : String(v) <= val); break;
    case 'lt': r = v != null && (num(v) && num(val) ? +v < +val : String(v) < val); break;
    case 'in': r = v != null && enListe(val).includes(String(v)); break;
    case 'cs': { let b; try { b = JSON.parse(val); } catch (_) { b = null; } let a = v; if (typeof a === 'string') { try { a = JSON.parse(a); } catch (_) {} } r = b != null && contient(a, b); break; }
    default: r = true;
  }
  return neg ? !r : r;
}
function decouper(s) { const out = []; let d = 0, cur = '', q = false; for (const c of s) { if (c === '"' && cur.slice(-1) !== '\\') q = !q; if (!q && c === '(') d++; if (!q && c === ')') d--; if (!q && d === 0 && c === ',') { out.push(cur); cur = ''; continue; } cur += c; } if (cur) out.push(cur); return out; }
function cond(row, c) {
  const m = /^(not\.)?(or|and)\((.*)\)$/s.exec(c);
  if (m) { const parts = decouper(m[3]); const r = m[2] === 'or' ? parts.some((p) => cond(row, p)) : parts.every((p) => cond(row, p)); return m[1] ? !r : r; }
  const mm = /^([a-z_]+(?:(?:->>|->)(?:"[^"]*"|[A-Za-z0-9_-]+))*)\.(.*)$/s.exec(c);
  if (!mm) return true;
  return test(row, mm[1], mm[2]);
}
function projeter(row, select) {
  if (!select || select === '*') {
    // `vinted_accounts`, `abonnements` : toutes leurs colonnes (pas de `data`).
    if (!('data' in row)) return { ...row };
    return { id: row.id, owner: row.owner, data: row.data, meta: metaDe(row), updated_at: row.updated_at || null };
  }
  const out = {};
  for (const part of decouper(select)) {
    const p = part.trim(); if (!p) continue;
    const m = /^(?:([^:]+):)?(.+)$/.exec(p);
    const src = m[2];
    const alias = m[1] || src.split(/->>|->/).pop().replace(/^"(.*)"$/, '$1');
    out[alias] = getPath(row, src);
  }
  return out;
}

// ── La base ─────────────────────────────────────────────────────────────────
function famille(id) {
  return String(id || '').replace(/\d{6,}/g, 'N').replace(/_[A-Z]{2}\d+[A-Z]{2}$/, '_X').replace(/_[0-9a-f]{40,}$/, '_H').slice(0, 60);
}
// `resume` : 'dates' (forme du serveur depuis le 9 nov. : n° + date des ventes à
// expédier) · 'txns' (forme d'avant : les n° seuls) · 'aucun' (extension d'avant
// le résumé : les lecteurs relisent les listes entières).
function creerBase({ vendeurs = 10, gabarit = null, cleService = 'cle-service-banc-charge', majGabarit = null, resume = 'dates' } = {}) {
  const g = gabarit || fabriquer({ volumeReel: true, qr: true });
  // Le gabarit d'un vendeur : `main` + les lignes. Le résumé « à expédier » que
  // pose l'extension (`data.resume`) est ajouté aux ventes (la forme réelle).
  const lignesGabarit = [...g.main, ...g.rows].map((r) => ({ id: r.id, data: r.data }));
  if (typeof majGabarit === 'function') majGabarit(lignesGabarit);
  // Forme de `resumeCommandes` (vinted-sync-extension/background.js) : { n, txns, at }.
  for (const r of lignesGabarit) {
    const cmds = r.data && r.data.payload && Array.isArray(r.data.payload.my_orders) ? r.data.payload.my_orders : null;
    if (!cmds || /^harvest_28/.test(r.id) || resume === 'aucun') continue;   // les ANCIENS comptes : capturés avant le résumé
    const at = Date.parse(r.data.capturedAt) || Date.now();
    if (/_orders_sold$/.test(r.id)) {
      const ae = cmds.filter((o) => o.transaction_user_status === 'needs_action');
      r.data.resume = { n: cmds.length, at, txns: ae.map((o) => String(o.transaction_id)) };
      if (resume === 'dates') r.data.resume.dates = Object.fromEntries(ae.map((o) => [String(o.transaction_id), o.date]));
    }
    else if (/_orders_purchased$/.test(r.id)) r.data.resume = { n: cmds.length, at, txns: cmds.filter((o) => /disponible|point relais.*retir/i.test(String(o.status || ''))).map((o) => String(o.transaction_id)) };
  }
  const idsGabarit = new Map(lignesGabarit.map((r) => [r.id, r]));
  const owners = Array.from({ length: vendeurs }, (_, i) => uuidVendeur(i));
  const setOwners = new Set(owners);
  const couches = new Map();               // owner → Map(id → row | null)
  const neutre = new Map();                // id → row (propriétaire NEUTRE et lignes hors vendeurs)
  const comptesGabarit = g.accounts.map((a) => ({ vinted_user_id: a.vinted_user_id, login: a.login, domain: a.domain, created_at: a.created_at, updated_at: a.updated_at }));
  const abonnements = new Map();           // owner → ligne
  const memoPred = new Map();              // texte du filtre `id` → lignes du gabarit qui passent
  const compteurs = { requetes: 0, lectures: 0, ecritures: 0, octetsSortis: 0, octetsEntres: 0, parFamille: {}, parVendeur: {}, parRoute: {}, erreurs: 0, lignesSortiesMax: 0 };
  let routeCourante = '';

  const couche = (o) => { let c = couches.get(o); if (!c) { c = new Map(); couches.set(o, c); } return c; };
  function lignesDe(owner, predId) {
    if (owner === NEUTRE || !setOwners.has(owner)) return [...neutre.values()].filter((r) => r.owner === owner && (!predId || predId(r.id)));
    const c = couches.get(owner);
    const out = [];
    let base = lignesGabarit;
    if (predId) {
      const cle = predId.cle;
      if (!memoPred.has(cle)) memoPred.set(cle, lignesGabarit.filter((r) => predId(r.id)));
      base = memoPred.get(cle);
    }
    for (const r of base) { if (c && c.has(r.id)) continue; out.push(vue(owner, r)); }
    if (c) for (const [id, r] of c) if (r && (!predId || predId(id))) out.push(r);
    return out;
  }
  // Une ligne du gabarit vue par un vendeur : mêmes données, SON owner.
  const vues = new Map();
  function vue(owner, r) {
    // Pas de copie des données : l'objet partagé est en lecture seule ici.
    return { id: r.id, owner, data: r.data, get __meta() { return metaDe(r); }, updated_at: null };
  }
  function predicatId(params) {
    const exprs = params.filter(([k]) => k === 'id').map(([, v]) => v);
    if (!exprs.length) return null;
    const f = (id) => exprs.every((e) => test({ id }, 'id', e));
    f.cle = exprs.join('&');
    return f;
  }

  function lireTable(table, params, quiOwner, service) {
    const ownerFiltre = params.filter(([k]) => k === 'owner').map(([, v]) => v);
    let cibles;
    const eqOwner = ownerFiltre.map((v) => (/^eq\.(.+)$/.exec(v) || [])[1]).find(Boolean);
    if (!service) cibles = [quiOwner];
    else if (eqOwner) cibles = [eqOwner];
    else cibles = null;                                     // service sans filtre : TOUT
    const predId = predicatId(params);
    let L = [];
    if (table === 'app_data') {
      if (cibles) for (const o of cibles) L.push(...lignesDe(o, predId));
      else { for (const o of owners) L.push(...lignesDe(o, predId)); for (const r of neutre.values()) if (!predId || predId(r.id)) L.push(r); }
    } else if (table === 'vinted_accounts') {
      const os = cibles || owners;
      for (const o of os) { if (!setOwners.has(o)) continue; const c = couches.get(o); const ret = c && c.get('__comptes_retires'); for (const a of comptesGabarit) if (!(ret && ret.data.includes(a.vinted_user_id))) L.push({ ...a, owner: o }); }
    } else if (table === 'abonnements') {
      const os = cibles || owners;
      for (const o of os) if (setOwners.has(o)) L.push(abonnements.get(o) || { owner: o, statut: 'actif', client_stripe: null, abonnement_stripe: null, fin_periode: null, annule_fin_periode: false, mode_test: true, evenement_ts: null, impaye_depuis: null });
    } else return [];
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'id', 'owner'].includes(k)) continue;
      if (k === 'or' || k === 'and') { L = L.filter((r) => cond(r, `${k}${v}`)); continue; }
      if (k === 'not.or' || k === 'not.and') { L = L.filter((r) => cond(r, `${k}${v}`)); continue; }
      L = L.filter((r) => test(r, k, v));
    }
    L.sort((a, b) => (a.owner === b.owner ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : (String(a.owner) < String(b.owner) ? -1 : 1)));
    return L;
  }

  function ecrire(table, methode, params, corps, quiOwner, service, prefer) {
    if (table !== 'app_data' && table !== 'abonnements') return { status: 201, body: [] };
    if (methode === 'POST') {
      const rows = Array.isArray(corps) ? corps : [corps];
      const out = [];
      for (const r0 of rows) {
        if (!r0 || !r0.id && table === 'app_data') return { status: 400, body: { message: 'id manquant' } };
        const owner = r0.owner || (service ? null : quiOwner);
        if (!owner) return { status: 400, body: { code: '23502', message: 'null value in column "owner"' } };
        if (!service && owner !== quiOwner) return { status: 403, body: { code: '42501', message: 'new row violates row-level security policy' } };
        if (table === 'abonnements') { abonnements.set(owner, { ...(abonnements.get(owner) || {}), ...r0, owner }); out.push(r0); continue; }
        const ligne = { id: r0.id, owner, data: r0.data === undefined ? null : r0.data, updated_at: r0.updated_at || new Date().toISOString() };
        if (owner === NEUTRE || !setOwners.has(owner)) neutre.set(owner + '|' + r0.id, ligne);
        else couche(owner).set(r0.id, ligne);
        out.push(ligne);
      }
      return { status: 201, body: /return=representation/.test(prefer || '') ? out.map((r) => projeter(r, null)) : null };
    }
    const visees = lireTable(table, params, quiOwner, service);
    if (methode === 'PATCH') {
      const out = [];
      for (const r of visees) {
        const neuf = { id: r.id, owner: r.owner, data: corps && 'data' in corps ? corps.data : r.data, updated_at: (corps && corps.updated_at) || new Date().toISOString() };
        if (r.owner === NEUTRE || !setOwners.has(r.owner)) neutre.set(r.owner + '|' + r.id, neuf); else couche(r.owner).set(r.id, neuf);
        out.push(neuf);
      }
      return { status: /return=representation/.test(prefer || '') ? 200 : 204, body: /return=representation/.test(prefer || '') ? out.map((r) => projeter(r, params.find(([k]) => k === 'select')?.[1] || null)) : null };
    }
    if (methode === 'DELETE') {
      for (const r of visees) { if (r.owner === NEUTRE || !setOwners.has(r.owner)) neutre.delete(r.owner + '|' + r.id); else couche(r.owner).set(r.id, null); }
      return { status: 204, body: null };
    }
    return { status: 405, body: { message: 'méthode' } };
  }

  function quiEst(headers) {
    const a = String(headers.authorization || headers.Authorization || '').replace(/^Bearer\s+/i, '');
    if (a === cleService || headers.apikey === cleService && !a) return { service: true, owner: null };
    const m = /^jeton-([0-9a-f-]{36})$/.exec(a);
    if (m) return { service: false, owner: m[1] };
    return { service: false, owner: null, anonyme: true };
  }

  function noter(rec) {
    compteurs.requetes++;
    if (rec.m === 'GET' || rec.m === 'HEAD') compteurs.lectures++; else compteurs.ecritures++;
    compteurs.octetsSortis += rec.sortis; compteurs.octetsEntres += rec.entres;
    const f = (compteurs.parFamille[rec.famille] = compteurs.parFamille[rec.famille] || { n: 0, sortis: 0, entres: 0 });
    f.n++; f.sortis += rec.sortis; f.entres += rec.entres;
    const v = (compteurs.parVendeur[rec.owner || '—'] = compteurs.parVendeur[rec.owner || '—'] || { n: 0, sortis: 0 });
    v.n++; v.sortis += rec.sortis;
    const rt = (compteurs.parRoute[rec.route || '—'] = compteurs.parRoute[rec.route || '—'] || { n: 0, sortis: 0, entres: 0 });
    rt.n++; rt.sortis += rec.sortis; rt.entres += rec.entres;
    if (rec.status >= 400) compteurs.erreurs++;
    const a = appelCourant.getStore();
    if (a) { a.requetes = (a.requetes || 0) + 1; a.octetsSortis = (a.octetsSortis || 0) + rec.sortis; a.octetsEntres = (a.octetsEntres || 0) + rec.entres; }
    if (journal) journal.push(rec);
  }
  let journal = null;

  async function traiter(req, corpsBrut) {
    const u = new URL(req.url, 'http://127.0.0.1');
    const qui = quiEst(req.headers);
    const methode = req.method.toUpperCase();
    if (u.pathname === '/auth/v1/user') {
      if (!qui.owner) return { status: 401, body: { message: 'jeton invalide' } };
      return { status: 200, body: { id: qui.owner, email: `vendeur-${qui.owner.slice(0, 8)}@exemple.invalid`, aud: 'authenticated', role: 'authenticated' } };
    }
    if (u.pathname.startsWith('/auth/v1/')) return { status: 200, body: {} };
    const mr = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(u.pathname);
    if (mr) {
      if (mr[1] === 'vrm_acces_pour' || mr[1] === 'vrm_acces') return { status: 200, body: true };
      return { status: 200, body: null };
    }
    const mt = /^\/rest\/v1\/([a-z_]+)$/.exec(u.pathname);
    if (!mt) return { status: 404, body: { message: 'inconnu' } };
    const params = [...u.searchParams.entries()];
    if (!qui.service && !qui.owner) {
      // Clé publique seule : la sonde de cloisonnement (`select=owner&limit=1`)
      // rend vide, comme la RLS de la production.
      return { status: 200, body: [] };
    }
    const table = mt[1];
    if (methode === 'GET' || methode === 'HEAD') {
      const L = lireTable(table, params, qui.owner, qui.service);
      const total = L.length;
      let from = 0, to = Math.min(total, 1000) - 1;
      const rg = req.headers.range;
      const m = /^(\d+)-(\d+)$/.exec(rg || '');
      if (m) { from = +m[1]; to = Math.min(+m[2], from + 999, total - 1); }
      const off = u.searchParams.get('offset'); if (off) from = +off;
      const lim = u.searchParams.get('limit'); if (lim) to = Math.min(to, from + +lim - 1);
      if (from > 0 && from >= total && total > 0) return { status: 416, body: { message: 'range' }, headers: { 'content-range': `*/${total}` } };
      const page = L.slice(from, to + 1);
      const select = u.searchParams.get('select');
      const body = page.map((r) => projeter(r, select));
      compteurs.lignesSortiesMax = Math.max(compteurs.lignesSortiesMax, body.length);
      return { status: rg ? 206 : 200, body, headers: { 'content-range': page.length ? `${from}-${from + page.length - 1}/${total}` : `*/${total}` } };
    }
    let corps = null;
    try { corps = corpsBrut ? JSON.parse(corpsBrut) : null; } catch (_) { return { status: 400, body: { message: 'json' } }; }
    return ecrire(table, methode, params, corps, qui.owner, qui.service, req.headers.prefer);
  }

  let serveur = null;
  const B = {
    NEUTRE, owners, compteurs, cleService, gabarit: lignesGabarit,
    jeton: (o) => `jeton-${o}`,
    url: '',
    route: (r) => { routeCourante = r; },
    journaliser: (oui) => { journal = oui ? [] : null; },
    journal: () => journal,
    remettre() { Object.assign(compteurs, { requetes: 0, lectures: 0, ecritures: 0, octetsSortis: 0, octetsEntres: 0, parFamille: {}, parVendeur: {}, parRoute: {}, erreurs: 0, lignesSortiesMax: 0 }); if (journal) journal = []; },
    poser(owner, id, data) { const l = { id, owner, data, updated_at: new Date().toISOString() }; if (owner === NEUTRE || !setOwners.has(owner)) neutre.set(owner + '|' + id, l); else couche(owner).set(id, l); },
    ligne(owner, id) { const L = lignesDe(owner, Object.assign((x) => x === id, { cle: 'eq.' + id })); return L[0] || null; },
    lignes(owner) { return lignesDe(owner, null); },
    tout() { const L = []; for (const o of owners) L.push(...lignesDe(o, null)); for (const r of neutre.values()) L.push(r); return L; },
    comptes(owner) { return lireTable('vinted_accounts', [['owner', 'eq.' + owner]], null, true); },
    // Répondre à une requête sans HTTP (fetch intercepté dans le même processus).
    async repondre({ url, method = 'GET', headers = {}, body = null, route = '' }) {
      const h = {}; for (const [k, v] of Object.entries(headers || {})) h[k.toLowerCase()] = v;
      const t0 = process.hrtime.bigint();
      const rep = await traiter({ url, method, headers: h }, body);
      const texte = rep.body === null || rep.body === undefined ? '' : JSON.stringify(rep.body);
      const u = new URL(url, 'http://127.0.0.1');
      const id = (/(?:^|&)id=(?:eq|like|in)\.\(?([^&,)]+)/.exec(decodeURIComponent(u.search.slice(1))) || [])[1] || u.pathname.replace(/^\/rest\/v1\//, '');
      let ownerReq = (/owner=eq\.([0-9a-f-]{36})/.exec(decodeURIComponent(u.search)) || [])[1] || null;
      if (!ownerReq) { const q = quiEst(h); ownerReq = q.owner; }
      if (!ownerReq && body) { try { const j = JSON.parse(body); const r = Array.isArray(j) ? j[0] : j; ownerReq = (r && r.owner) || null; } catch (_) {} }
      noter({ m: method.toUpperCase(), famille: famille(id), owner: ownerReq, route: route || routeCourante, sortis: Buffer.byteLength(texte), entres: body ? Buffer.byteLength(String(body)) : 0, status: rep.status, us: Number(process.hrtime.bigint() - t0) / 1000, u: decodeURIComponent(u.pathname + u.search).slice(0, 300) });
      return { status: rep.status, headers: rep.headers || {}, texte };
    },
    ecouter(port = 0) {
      return new Promise((ok) => {
        serveur = http.createServer((req, res) => {
          const morceaux = [];
          req.on('data', (c) => morceaux.push(c));
          req.on('end', async () => {
            try {
              const corps = morceaux.length ? Buffer.concat(morceaux).toString('utf8') : null;
              const rep = await B.repondre({ url: req.url, method: req.method, headers: req.headers, body: corps, route: req.headers['x-banc-route'] || '' });
              const h = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range', ...rep.headers };
              if (/gzip/.test(req.headers['accept-encoding'] || '') && rep.texte.length > 1024) { res.writeHead(rep.status, { ...h, 'content-encoding': 'gzip' }); res.end(zlib.gzipSync(rep.texte)); }
              else { res.writeHead(rep.status, h); res.end(rep.texte); }
            } catch (e) { res.writeHead(500); res.end(JSON.stringify({ message: String(e && e.message) })); }
          });
        });
        serveur.listen(port, '127.0.0.1', () => { B.url = `http://127.0.0.1:${serveur.address().port}`; ok(B.url); });
      });
    },
    fermer() { return new Promise((ok) => (serveur ? serveur.close(() => ok()) : ok())); },
  };
  return B;
}

// ── fetch du processus : la base locale, et RIEN d'autre ─────────────────────
// Toute URL qui n'est pas la base locale (Supabase de production, Vinted, eBay,
// les services de notification…) est REFUSÉE et comptée : aucun appel ne sort.
function brancherFetch(B, { externes = null } = {}) {
  const vrai = global.fetch;
  const sorties = [];
  global.fetch = async (url, o = {}) => {
    const u = String(url && url.url ? url.url : url);
    const h = {};
    const src = (o && o.headers) || {};
    if (typeof src.forEach === 'function' && !(src instanceof Array)) src.forEach((v, k) => { h[k] = v; }); else Object.assign(h, src);
    const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u) || /^https:\/\/[a-z0-9]+\.supabase\.co\//.test(u);
    if (/^https:\/\/[a-z0-9]+\.supabase\.co\//.test(u) || u.startsWith(B.url || '\0')) {
      // La base de production n'est JAMAIS jointe : son adresse est servie par la base locale.
      const chemin = u.replace(/^https?:\/\/[^/]+/, '');
      const corps = o.body == null ? null : (typeof o.body === 'string' ? o.body : Buffer.isBuffer(o.body) ? o.body.toString('utf8') : String(o.body));
      if (o.signal && o.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      const rep = await B.repondre({ url: chemin, method: o.method || 'GET', headers: h, body: corps });
      return new Response(rep.status === 204 || rep.texte === '' ? null : rep.texte, { status: rep.status, headers: { 'content-type': 'application/json', ...rep.headers } });
    }
    if (!local) {
      sorties.push(u.replace(/\?.*$/, ''));
      if (typeof externes === 'function') { const r = await externes(u, o); if (r) return r; }
      return new Response(JSON.stringify({ banc: 'refusé : aucun appel externe' }), { status: 503, headers: { 'content-type': 'application/json' } });
    }
    return vrai(url, o);
  };
  return { sorties, retirer: () => { global.fetch = vrai; } };
}

module.exports = { appelCourant, creerBase, brancherFetch, vrmMeta, NEUTRE, uuidVendeur, famille, projeter, test, cond };
