// ── src/conseiller/gestes.js — le geste d'un conseil : OUVRIR l'écran VRM où il le fait lui-même (23 nov.) ──
// Une liste FERMÉE (src/conseiller/regles.js `GESTES`) ; aucun geste n'agit seul : il navigue.
// `o` : { onNav, vue (demanderVue), onSaisirPrix, onDorment }.
export function faireGeste(g, o = {}) {
  const nav = (t) => { if (o.onNav) o.onNav(t); };
  const vue = (v) => { try { if (o.vue) o.vue(v); window.dispatchEvent(new CustomEvent('vrm:vue', { detail: v })); } catch (_) {} };
  switch (g) {
    case 'envoyer': return nav('colis');
    case 'offres': vue('offressansreponse'); return nav('cat_msg');
    case 'argent': return nav('compta');
    case 'baisses': vue('dorment'); return nav('cat_annonces');
    case 'dorment': if (o.onDorment) return o.onDorment(); vue('dorment'); return nav('cat_annonces');
    case 'prix': if (o.onSaisirPrix) return o.onSaisirPrix(); return nav('vinted_annonces');
    case 'stats': return nav('dashboard');
    default: return undefined;
  }
}
