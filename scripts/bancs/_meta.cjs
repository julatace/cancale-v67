// ════════════════════════════════════════════════════════════════════════════
//  Les bancs servent des lignes `{id, data}`. Depuis le 3 octobre l'app lit les
//  petits champs dans la colonne `meta` (calculée par la base à chaque
//  écriture : `public.vrm_meta(id, data)`), pour ne plus décompresser des
//  lignes de 30 à 200 Ko pour un statut. Ce traducteur rend à chaque banc la
//  requête qu'il savait déjà servir : `meta->>k` redevient le chemin d'origine
//  dans `data`. Il suit EXACTEMENT la règle SQL (mêmes clés, même `_pdf`),
//  sinon un banc mesurerait une fiction (§6.3).
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const TXN = new Set(['id', 'item_id', 'status', 'status_title', 'status_updated_at']);
function metaVersData(u) {
  if (!u || u.indexOf('meta') < 0) return u;
  const txn = /_txn_/.test(u);
  return u.replace(/meta(-%3E%3E|->>)([A-Za-z_]+)(=eq\.true)?/g, (m, fl, k, eqTrue) => {
    const a1 = fl === '->>' ? '->' : '-%3E';
    if (k === '_pdf') return `data${fl}pdfB64${eqTrue ? '=not.is.null' : ''}`;
    if (txn && TXN.has(k)) return `data${a1}payload${a1}transaction${fl}${k}${eqTrue || ''}`;
    if (txn && k === 'ship_status_title') return `data${a1}payload${a1}transaction${a1}shipment${fl}status_title${eqTrue || ''}`;
    return `data${fl}${k}${eqTrue || ''}`;
  });
}
// (6 nov., vague 2 « vitesse ») `vinted_item_details` servie comme PostgREST :
// `select=data` rend la ligne entière ; `fN:data->"<id>"` (la lecture de l'app,
// une fiche par clé, `lireFichesPage`) rend UNE ligne avec une colonne par fiche
// (`null` pour une fiche absente). Un banc qui rendait `[{ data }]` quel que soit
// le `select=` servait une forme que l'app ne lit plus (§6.3).
function fichesDePage(u, details) {
  const sel = (/[?&]select=([^&]*)/.exec(decodeURIComponent(u)) || [])[1] || 'data';
  if (sel === 'data') return [{ data: details }];
  const out = {};
  for (const champ of sel.split(',')) {
    const m = /^(?:([^:]+):)?data->"([^"]+)"(.*)$/.exec(champ.trim()); if (!m) continue;
    let v = (details || {})[m[2]];
    for (const seg of m[3].split(/->>|->/).filter(Boolean)) v = v == null ? undefined : v[seg.replace(/^"|"$/g, '')];
    out[m[1] || m[2]] = v === undefined ? null : v;
  }
  return [out];
}
// (9 nov. au soir, « transporteurs parfaits ») La colonne `meta` ENTIÈRE (`select=id,meta`, la lecture
// des e-mails de suivi depuis le 8 nov.) : la même règle que `public.vrm_meta` — les scalaires de premier
// niveau (≤ 600 octets) + `_pdf`. Un banc qui rendait `meta: null` faisait disparaître chaque e-mail de
// suivi (5 bancs de la carte des relais rouges depuis le 8 nov. pour cette seule raison).
function metaDe(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const m = {};
  for (const [k, v] of Object.entries(data)) if ((typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') && Buffer.byteLength(JSON.stringify(v)) <= 600) m[k] = v;
  if (data.pdfB64) m._pdf = true;
  return m;
}
// Les filtres simples d'une requête sur `data->>k` (hors `or=`), comme PostgREST : eq, neq, is.null,
// not.is.null. Un banc qui les ignorait rendait « avec QR et livré » TOUTES les lignes.
function filtreData(u) {
  const conds = [];
  const q = String(u).split('?')[1] || '';
  for (const part of q.split('&')) {
    const m = /^data->>([A-Za-z_]+)=(eq|neq|is|not\.is)\.(.*)$/.exec(part);
    if (m) conds.push({ k: m[1], op: m[2], v: m[3] });
  }
  return (row) => conds.every(({ k, op, v }) => {
    const x = row && row.data ? row.data[k] : undefined;
    const nul = x == null;
    if (op === 'is') return v === 'null' ? nul : String(x) === v;
    if (op === 'not.is') return v === 'null' ? !nul : String(x) !== v;
    if (op === 'eq') return !nul && String(x) === v;
    if (op === 'neq') return !nul && String(x) !== v;
    return true;
  });
}
module.exports = { metaVersData, fichesDePage, metaDe, filtreData };
