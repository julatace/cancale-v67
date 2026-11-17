// (17 nov., lot onglets-design) LES PROPOSITIONS DE DISPOSITION DES ONGLETS, DERRIÈRE UN RÉGLAGE DE BANC.
// Julien choisira sur des captures RÉELLES de l'app ; rien de ceci ne se voit chez lui :
//   · seul un banc peut l'allumer (`vrm_banc_vends` posé par les bancs, jamais par l'app) ;
//   · `?banc_onglets=a` dans l'adresse ⇒ `data-onglets="a"` sur la racine, gardé pour l'onglet (sessionStorage) ;
//   · les feuilles des propositions ne visent QUE `:root[data-onglets="…"]` (src/design/onglets-a.css).
// Sans le réglage, l'app est exactement celle de `main`.
export function poserOngletsBanc() {
  try {
    if (typeof window === 'undefined' || localStorage.getItem('vrm_banc_vends') !== '1') return null;
    const p = new URLSearchParams(location.search).get('banc_onglets');
    if (p && /^[a-z]$/.test(p)) sessionStorage.setItem('vrm_banc_onglets', p);
    const v = sessionStorage.getItem('vrm_banc_onglets');
    if (v && /^[a-z]$/.test(v)) { document.documentElement.setAttribute('data-onglets', v); return v; }
  } catch (_) {}
  return null;
}
