// ═══════════════════════════════════════════════════════════════════════════
// « CE COMPTE VINTED EST DÉJÀ RELIÉ À UN AUTRE COMPTE VRM » (9 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Depuis la 5.332 / migration 029, un compte Vinted NEUF ne se relie que par
// `POST /api/vinted-connect` (source `extension`). Quand un AUTRE compte VRM le
// porte déjà, la route répond 409 `deja_relie` et NOTE le litige chez le vendeur
// qui demande : sa ligne `app_data` `vrm_vinted_litige_{id Vinted}` =
// { vinted_user_id, at, source } — jamais l'autre propriétaire, jamais son
// e-mail, aucun jeton (api/vinted-connect.js `noterLitige`). Seul le journal de
// l'extension le disait ; l'app lit maintenant CETTE ligne (la sienne, sous RLS,
// aucune route de plus : 12 fonctions inchangées) et le dit dans Comptes liés
// et sur le guide de démarrage (là où il attend son nouveau compte).
// Le pseudo : celui que SON navigateur a lu du profil Vinted
// (`harvest_{id}_profile`, sa ligne aussi) — sinon le numéro du compte Vinted.
// Rien d'un autre vendeur n'est lu, ni ne peut l'être.
// Module PUR : exécuté par scripts/audit-deja-relie.cjs.
// ═══════════════════════════════════════════════════════════════════════════

export const PREFIXE_LITIGE = 'vrm_vinted_litige_';
const ID_LITIGE = /^vrm_vinted_litige_(\d{1,20})$/;
const ID_VINTED = /^\d{1,20}$/;
// Projeté (§4.4) : l'identifiant, le compte Vinted et la date — rien d'autre.
export const REQUETE_LITIGES = 'id=like.vrm_vinted_litige_*&select=id,vid:data->>vinted_user_id,at:data->>at';
export const requetePseudos = (vids) => {
  const ids = (vids || []).filter((v) => ID_VINTED.test(String(v))).map((v) => `harvest_${v}_profile`);
  return ids.length ? `id=in.(${ids.join(',')})&select=id,login:data->payload->user->>login` : '';
};
// `null` = pas su (lecture ratée) ; sinon la liste, la plus récente d'abord.
export function litigesDeLignes(rows) {
  if (!Array.isArray(rows)) return null;
  const out = [];
  for (const r of rows) {
    const m = ID_LITIGE.exec(String((r && r.id) || ''));
    if (!m) continue;
    // La ligne et son contenu disent le MÊME compte (sinon on ne devine pas).
    if (r.vid != null && String(r.vid) !== m[1]) continue;
    const t = Date.parse(r.at || '');
    out.push({ vid: m[1], at: Number.isFinite(t) ? new Date(t).toISOString() : '' });
  }
  return out.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}
export function pseudosDeLignes(rows) {
  const o = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const m = /^harvest_(\d{1,20})_profile$/.exec(String((r && r.id) || ''));
    const l = typeof (r && r.login) === 'string' ? r.login.trim() : '';
    if (m && l && l.length <= 60) o[m[1]] = l;
  }
  return o;
}
// Ce qui s'affiche : les litiges dont le compte Vinted n'est PAS (ou plus) relié
// à CE compte VRM, et que l'appareil n'a pas masqués à CETTE date (un nouveau
// refus, plus récent, revient). Comptes pas lus (pas su) ⇒ rien.
export function litigesAAfficher(litiges, comptes, masques) {
  if (!Array.isArray(litiges) || !Array.isArray(comptes)) return [];
  const relies = new Set(comptes.map((a) => String((a && a.vinted_user_id) || '')));
  const m = masques && typeof masques === 'object' ? masques : {};
  return litiges.filter((l) => !relies.has(l.vid) && m[l.vid] !== l.at);
}
export const CLE_MASQUES = 'vrm_deja_relie_vu';
const dateCourte = (iso) => { try { return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }) : ''; } catch (_) { return ''; } };
// Les mots : quel compte, ce que ça veut dire, le geste. Jamais l'autre compte.
export function texteDejaRelie(l, pseudo) {
  const nom = pseudo ? `« ${pseudo} »` : `n° ${l.vid}`;
  const quand = dateCourte(l.at);
  return {
    titre: `Le compte Vinted ${nom} est déjà relié à un autre compte VRM`,
    phrase: `${quand ? `Le ${quand}, ` : ''}VRM a refusé de le relier ici : un seul compte VRM peut porter un compte Vinted. Tant que c'est le cas, rien de ce compte n'arrive dans ta boutique.`,
    geste: "Si tu as un autre compte VRM, reconnecte-toi avec celui-là. Sinon, écris au support : il vérifie que ce compte Vinted est bien à toi et peut le détacher.",
  };
}
export const sujetSupport = (l) => `Compte Vinted ${l.vid} déjà relié à un autre compte VRM`;
