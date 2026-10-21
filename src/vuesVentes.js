const filtres = { vinted: ['all','aexpedier','transit','finalisees','annulees'], leboncoin: ['all','pending','done','cancelled'], ebay: ['all','pending','done'] };
const cle = (owner, plateforme) => `vrm_vues_ventes:${JSON.stringify([owner, plateforme])}`;
const date = v => v && Number.isFinite(new Date(v).getTime()) ? new Date(v).toISOString() : null;
export function nettoyerVue(v, plateforme) {
  if (!v || !filtres[plateforme]?.includes(v.filtre) || typeof v.recherche !== 'string' || v.recherche.length > 300) return null;
  if (v.periode && ((v.periode.from && !date(v.periode.from)) || (v.periode.to && !date(v.periode.to)))) return null;
  const periode = plateforme === 'vinted' && v.periode ? { from: date(v.periode.from), to: date(v.periode.to) } : null;
  if (periode && ((!periode.from && !periode.to) || (periode.from && periode.to && periode.from > periode.to))) return null;
  return { filtre: v.filtre, recherche: v.recherche, periode };
}
export function lireVues(owner, plateforme, storage) {
  if (!owner || !filtres[plateforme]) return [];
  try {
    const liste = JSON.parse((storage || globalThis.localStorage).getItem(cle(owner, plateforme)) || '[]');
    return Array.isArray(liste) ? liste.filter(v => typeof v?.id === 'string' && typeof v.nom === 'string' && v.nom.trim().length > 0 && v.nom.length <= 40 && nettoyerVue(v.vue, plateforme)).slice(0,12) : [];
  } catch { return []; }
}
export function ecrireVues(owner, plateforme, liste, storage) {
  if (!owner || !filtres[plateforme] || !Array.isArray(liste) || liste.length > 12) return false;
  try { (storage || globalThis.localStorage).setItem(cle(owner, plateforme), JSON.stringify(liste)); return true; } catch { return false; }
}
export function restaurerVue(vue, plateforme) {
  const v = nettoyerVue(vue, plateforme);
  if (!v) return null;
  return { ...v, periode: v.periode ? { from: v.periode.from ? new Date(v.periode.from) : null, to: v.periode.to ? new Date(v.periode.to) : null } : null };
}
