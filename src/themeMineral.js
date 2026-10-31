// ── PALETTE « VITRINE » (31 octobre 2026, son choix) — remplace Perle ─────────
// Julien a vu quatre maquettes et choisi la quatrième : « j'aime énormément le 4,
// tu peux appliquer ça, améliore simplement pour le téléphone ». Une boutique de
// sneakers : blanc franc, grandes photos, typographie serrée, la paire avant tout.
// Les noms des exports (MINERAL, MINERAL_DARK) restent : tout App.jsx les lit déjà.
//   · fond blanc franc ; les blocs sont des aplats « surface » (#F5F5F3) SANS
//     ombre ni cadre appuyé ; la photo porte la carte ;
//   · encre presque noire, atténué chaud, filets #E4E4DF ;
//   · UNE couleur d'accent, rare : le cobalt #2442B8 (action principale, trait
//     de l'onglet actif) ; ambre = geste à faire ; rouge = deux paires sous un N°.
//     Le violet reste refusé ; `blue` et `purple` (anciennes teintes secondaires)
//     retombent sur l'atténué pour qu'aucune seconde couleur ne revienne.
// Les ombres ne restent qu'à ce qui FLOTTE (menus, feuilles, fenêtres).
// Détail : docs/passation/historique-interface-stock.md (« Vitrine »).
export const MINERAL = Object.freeze({
 bg:'#FFFFFF',surface:'#F5F5F3',card:'#F5F5F3',card2:'#ECECE8',
 border:'#E4E4DF',text:'#0F0F0E',muted:'#56564F',faint:'#64645C',
 accent:'#2442B8',accentSoft:'#5D74D6',onAccent:'#FFFFFF',
 danger:'#B43E35',warn:'#8A5300',warnSoft:'#FFF1D6',gold:'#8A5300',blue:'#56564F',purple:'#56564F',
 shadow:'none',
 shadowMd:'0 1px 2px rgba(15,15,14,.06), 0 10px 28px rgba(15,15,14,.10)',
 shadowLg:'0 6px 16px rgba(15,15,14,.08), 0 24px 56px rgba(15,15,14,.16)',
 ring:'rgba(36,66,184,.20)',glass:'#FFFFFF',bar:'#FFFFFF',hair:'rgba(15,15,14,.09)',
 sidebar:'#FFFFFF',chrome:'#FFFFFF',onChrome:'#0F0F0E',chromeMuted:'#56564F',chromeLine:'#E4E4DF',
 chromeGradient:'#FFFFFF',photo:'#ECECE8',
 s1:'#2442B8',s2:'#9AA6DB',selection:'#2442B8'
});
// Le sombre, dérivé : un noir chaud (pas de « bleu nuit »), trois marches de
// clarté, le cobalt éclairci pour tenir 4,5:1 (texte FONCÉ dessus), l'ambre clair.
export const MINERAL_DARK = Object.freeze({
 bg:'#0E0E0D',surface:'#1A1A18',card:'#1A1A18',card2:'#252522',
 border:'#2E2E2B',text:'#F2F2EE',muted:'#B0B0A8',faint:'#9A9A92',
 accent:'#6F86E8',accentSoft:'#93A5EE',onAccent:'#0E0E0D',
 danger:'#FF9188',warn:'#F0B44C',warnSoft:'#2E2412',gold:'#F0B44C',blue:'#B0B0A8',purple:'#B0B0A8',
 shadow:'none',shadowMd:'0 10px 28px rgba(0,0,0,.40)',shadowLg:'0 16px 48px rgba(0,0,0,.50)',
 ring:'rgba(111,134,232,.28)',glass:'#1A1A18',bar:'#1A1A18',hair:'rgba(242,242,238,.10)',
 sidebar:'#0E0E0D',chrome:'#0E0E0D',onChrome:'#F2F2EE',chromeMuted:'#B0B0A8',chromeLine:'#2E2E2B',
 chromeGradient:'#0E0E0D',photo:'#252522',
 s1:'#6F86E8',s2:'#93A5EE',selection:'#6F86E8'
});
// Les portails (détails de vente, fenêtres) héritent du document : mêmes jetons
// que la coque, sans seconde palette à entretenir dans les feuilles CSS.
export function variablesTheme(t,sombre=false){return {
 '--vrm-nav-gradient':t.chromeGradient,'--vrm-ink':t.text,'--vrm-brand-filter':sombre?'invert(1)':'none',
 '--vrm-muted':t.muted,'--vrm-faint':t.faint,'--vrm-hair':t.hair,'--vrm-bar':t.bar,
 '--vrm-accent':t.accent,'--vrm-on-accent':t.onAccent,'--vrm-card2':t.card2,'--vrm-line':t.border,'--vrm-surface':t.card,'--vrm-bg':t.bg,
 '--vrm-danger':t.danger,'--vrm-warn':t.warn,'--vrm-warn-soft':t.warnSoft,'--vrm-photo':t.photo,
};}
