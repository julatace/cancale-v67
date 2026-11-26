// ── LE RELEVÉ DES BOOSTS, LU PAR L'APP (21 nov., ext. 5.429 — point 64) ─────────────────────────────────────────────
// L'extension range `vinted_suivi_{uid}` : { items: { "i{id}": "jour,vues,favoris,boost;…" }, boostes: { "i{id}": jour } }.
// L'app ne lit JAMAIS toute la ligne (§4.4) : d'abord la liste des annonces boostées (`boostes`, petite), puis la série
// de CES annonces seulement (`data->items->>i{id}`, projetée — une clé préfixée « i » n'est jamais lue comme un index).
// Trois états : `undefined` en cours · `null` pas su (la base n'a pas répondu) · valeur lue (`{}` = rien relevé).
// `base` = { url, auth() } (App.jsx). Rien n'est écrit ici.
const ok = (v) => /^\d{1,20}$/.test(String(v == null ? '' : v));
export async function lireBoostes(base, uids) {
  const out = {}; let illisibles = 0;
  for (const uid of (Array.isArray(uids) ? uids : []).filter(ok)) {
    try {
      const r = await fetch(`${base.url}/rest/v1/app_data?id=eq.vinted_suivi_${uid}&select=b:data->boostes`, { headers: base.auth() });
      if (!r.ok) { illisibles++; continue; }
      const l = await r.json();
      out[uid] = l && l[0] && l[0].b && typeof l[0].b === 'object' ? Object.keys(l[0].b).filter((k) => /^i\d{1,15}$/.test(k)).map((k) => k.slice(1)) : [];
    } catch (_) { illisibles++; }
  }
  return { parCompte: out, illisibles };
}
// Les séries de quelques annonces d'UN compte (au plus 60 par lecture). Rend { [id]: texte } ou null (pas su).
export async function lireSeries(base, uid, ids) {
  const l = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter((x) => /^\d{1,15}$/.test(x)))].slice(0, 60);
  if (!ok(uid)) return null;
  if (!l.length) return {};
  try {
    const sel = l.map((id) => `s${id}:data->items->>i${id}`).join(',');
    const r = await fetch(`${base.url}/rest/v1/app_data?id=eq.vinted_suivi_${uid}&select=${sel}`, { headers: base.auth() });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const row = rows[0] || {};
    const out = {};
    for (const id of l) if (typeof row['s' + id] === 'string' && row['s' + id]) out[id] = row['s' + id];
    return out;
  } catch (_) { return null; }
}
// (24 nov., vitesse-lectures-toucher) Les séries de PLUSIEURS comptes en UNE lecture (au plus 60 annonces en tout) :
// `parUid` = { [uid]: [id, …] }. `id=in.(vinted_suivi_{uid},…)`, chaque série projetée (`data->items->>i{id}`, jamais la
// ligne entière, §4.4). Rend { [uid]: { [id]: texte } } — un compte sans ligne : `{}` (rien relevé, comme `lireSeries`) —
// ou null (pas su, pour TOUS les comptes de la lecture). Une annonce n'est lue que sur la ligne de SON compte.
export async function lireSeriesComptes(base, parUid) {
  const uids = Object.keys(parUid || {}).filter(ok);
  const par = {}; let n = 0;
  for (const uid of uids) { const l = [...new Set((parUid[uid] || []).map(String).filter((x) => /^\d{1,15}$/.test(x)))]; par[uid] = l; n += l.length; }
  if (n > 60) return null;
  if (!uids.length) return {};
  if (!n) return Object.fromEntries(uids.map((u) => [u, {}]));
  try {
    const sel = ['id', ...uids.flatMap((u) => par[u].map((id) => `s${id}:data->items->>i${id}`))].join(',');
    const r = await fetch(`${base.url}/rest/v1/app_data?id=in.(${uids.map((u) => 'vinted_suivi_' + u).join(',')})&select=${sel}`, { headers: base.auth() });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const out = {};
    for (const uid of uids) {
      const row = rows.find((x) => x && x.id === 'vinted_suivi_' + uid) || {};
      const s = {};
      for (const id of par[uid]) if (typeof row['s' + id] === 'string' && row['s' + id]) s[id] = row['s' + id];
      out[uid] = s;
    }
    return out;
  } catch (_) { return null; }
}
