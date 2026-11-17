// (17 nov.) MAQUETTE B « iOS natif » — un réglage de BANC, invisible pour Julien.
// Seul un banc pose `localStorage.vrm_banc_maquette = "b"` (scripts/bancs/maquette-b.cjs) : la racine prend alors
// `data-maquette="b"` et src/design/maquette-b.css s'applique (tab bar Apple, grands titres, segment système unique,
// barre latérale façon macOS). Aucun écran, aucun menu, aucun lien ne pose ce réglage : sans lui, rien ne change.
const CLE = 'vrm_banc_maquette';
export function maquetteDeBanc() {
  try { const v = localStorage.getItem(CLE); return v === 'b' ? v : ''; } catch (_) { return ''; }
}
if (typeof document !== 'undefined') {
  const m = maquetteDeBanc();
  if (m) { try { document.documentElement.setAttribute('data-maquette', m); } catch (_) {} }
}
