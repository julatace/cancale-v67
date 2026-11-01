// ════════════════════════════════════════════════════════════════════════════
//  UN SEGMENT DE CHEMIN JSON COMME POSTGREST LE LIT (1er nov., audit X4)
//  — commun aux fausses bases des audits (`_fond-vm.cjs`, audit-lbc-*).
//
//  `data->items->3290000104` : PostgREST lit un segment NUMÉRIQUE NU comme un
//  INDEX DE TABLEAU (`-> int`) — sur un objet il rend NULL, au-delà de
//  2 147 483 647 il répond 400 (« value out of range for type integer », mesuré
//  le 28 oct. sur `data->10312441750`). Seul `->"3290000104"` (entre guillemets)
//  est une CLÉ. Une fausse base qui prend tout segment pour une clé laisse
//  passer l'erreur sans la voir (§6.3 : la forme servie doit être la vraie).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const INT_MAX = 2147483647;

// Le segment brut (tel qu'écrit après `->` / `->>`) ⇒ { cle } | { index } | { erreur }.
function lireSegment(brut) {
  const s = String(brut == null ? '' : brut);
  const q = /^"(.*)"$/.exec(s);
  if (q) return { cle: q[1] };
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    if (Math.abs(n) > INT_MAX) return { erreur: { status: 400, body: { code: '22003', message: `value "${s}" is out of range for type integer` } } };
    return { index: n };
  }
  return { cle: s };
}
// Applique UN segment à une valeur JSON, comme `->` de PostgreSQL.
function appliquerSegment(v, brut) {
  if (v == null) return undefined;
  const seg = lireSegment(brut);
  if (seg.erreur) throw Object.assign(new Error(seg.erreur.body.message), { postgrest: seg.erreur });
  if ('index' in seg) {
    if (!Array.isArray(v)) return undefined;        // objet -> int : NULL
    const i = seg.index < 0 ? v.length + seg.index : seg.index;
    return v[i];
  }
  return Array.isArray(v) ? undefined : v[seg.cle]; // tableau -> texte : NULL
}
// Une projection `select=` contient-elle un segment refusé (400) ? ⇒ la réponse, sinon null.
function erreurProjection(select) {
  for (const champ of String(select || '').split(',')) {
    const expr = champ.trim().replace(/^[A-Za-z_]\w*:/, '');
    for (const p of expr.split(/->>|->/).slice(1)) { const seg = lireSegment(p); if (seg.erreur) return seg.erreur; }
  }
  return null;
}
module.exports = { lireSegment, appliquerSegment, erreurProjection, INT_MAX };
