// ── PALETTE « VITRINE » (31 octobre 2026, son choix) — remplace Perle ─────────
// Julien a vu quatre maquettes et choisi la quatrième : « j'aime énormément le 4,
// tu peux appliquer ça, améliore simplement pour le téléphone ». Une boutique de
// sneakers : blanc franc, grandes photos, typographie serrée, la paire avant tout.
// Les noms des exports (MINERAL, MINERAL_DARK) restent : tout App.jsx les lit déjà.
//   · fond blanc franc ; les blocs sont des aplats « surface » (#F5F5F3) SANS
//     ombre ni cadre appuyé ; la photo porte la carte ;
//   · encre presque noire, atténué chaud, filets #E4E4DF ;
//   · UNE couleur d'accent, rare : le cobalt #0071E3 (action principale, trait
//     de l'onglet actif) ; ambre = geste à faire ; rouge = deux paires sous un N°.
//     Le violet reste refusé ; `blue` et `purple` (anciennes teintes secondaires)
//     retombent sur l'atténué pour qu'aucune seconde couleur ne revienne.
// Les ombres ne restent qu'à ce qui FLOTTE (menus, feuilles, fenêtres).
// Détail : docs/passation/historique-interface-stock.md (« Vitrine »).
// (2 nov., Julien : « copie le style simple et minimaliste d'Apple ») L'accent devient
// le BLEU D'APPLE (#0071E3 clair, #0A84FF sombre), toujours rare, et la police celle
// du système (SF Pro sur iPhone et Mac, styles-vitrine.css). Le reste ne change pas.
// (3 nov., critique #1 — Julien a choisi « Fusion carte sombre ») UNE palette pour toute
// l'app, celle des maquettes Fusion : fond #F2F2F7, cartes blanches, encre #1D1D1F, gris
// #6E6E73 ; sombre #000 / #1C1C1E. Plus aucun gris chaud de Vitrine (#F5F5F3, #ECECE8,
// #0F0F0E, #56564F…) : deux palettes côte à côte faisaient « deux apps collées ».
// Le texte secondaire (muted ET faint) reste à #6E6E73 en clair : 4,5:1 sur le fond gris,
// 5:1 sur le blanc (le #8E8E93 d'iOS tombait à 2,9:1). Bleu d'Apple rare, ambre pour un
// geste à faire, rouge seulement pour deux articles sous un N° (§7). L'accent du TEXTE en clair est
// #0066CC (le bleu des liens d'Apple : 5,3:1 sur le fond gris, #0071E3 n'y tenait que 4,2:1) ;
// les aplats Fusion gardent #0071E3 (`--fu-bleu`).
// (5 nov., revue de cohérence 1.1 et 1.6 — chantier A) UN SEUL BLEU D'ACCENT. Deux bleus
// vivaient côte à côte (`accent` #0066CC/#409CFF, texte NOIR en sombre, contre `--fu-bleu`
// #0071E3/#0A84FF) : « accent » est désormais l'APLAT, #0071E3 dans LES DEUX thèmes
// (texte blanc `onAccent` : 4,7:1, AA — #0A84FF en sombre ne donnait que 3,65:1), et
// `--fu-bleu` le lit ; tout TEXTE bleu prend `accentTexte` (#0066CC : 5,3:1 sur le gris ;
// #409CFF : 5,8:1 sur #1C1C1E) — les `color:C.accent` d'App.jsx sont passés à
// `C.accentTexte` à l'intégration (5 nov.).
// LE ROUGE : `danger` prend la valeur de l'ambre (`warn`) — 88 usages « danger » rougissaient
// des erreurs, des annulations, des pertes ; le rouge n'est plus qu'au jeton `doublon`, deux
// paires présentes sous un même N° (§5, §7). `scripts/audit-rouge-doublon.cjs` l'interdit ailleurs.
export const MINERAL = Object.freeze({
 bg:'#F2F2F7',surface:'#FFFFFF',card:'#FFFFFF',card2:'#F2F2F7',
 border:'#E5E5EA',text:'#1D1D1F',muted:'#6E6E73',faint:'#6E6E73',
 accent:'#0071E3',accentTexte:'#0066CC',accentSoft:'#0066CC',onAccent:'#FFFFFF',
 danger:'#B25000',doublon:'#D70015',warn:'#B25000',onWarn:'#FFFFFF',warnSoft:'#FFF4E5',gold:'#B25000',blue:'#6E6E73',purple:'#6E6E73',
 shadow:'none',
 shadowMd:'0 1px 2px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.05)',
 shadowLg:'0 6px 16px rgba(0,0,0,.08), 0 24px 56px rgba(0,0,0,.14)',
 ring:'rgba(0,113,227,.20)',glass:'#FFFFFF',bar:'#F2F2F7',hair:'rgba(0,0,0,.06)',
 sidebar:'#F2F2F7',chrome:'#F2F2F7',onChrome:'#1D1D1F',chromeMuted:'#6E6E73',chromeLine:'#E5E5EA',
 chromeGradient:'#F2F2F7',photo:'#F2F2F7',
 s1:'#0071E3',s2:'#8DB8F2',selection:'#0071E3',
 carteSombre:'radial-gradient(120% 90% at 100% 0%, #1f3a5f 0%, #1d1d1f 55%)',carteSombreClair:'#1F3A5F',
 caseSombre:'rgba(255,255,255,.1)',surSombre:'#FFFFFF',surSombre2:'rgba(255,255,255,.7)'
});
// Le sombre d'iOS : noir pur, cartes #1C1C1E, cases #2C2C2E, filets #38383A ; l'aplat
// #0A84FF au texte BLANC (comme iOS ; 3,65:1, AA grand texte), les liens #409CFF
// (5,8:1 sur #1C1C1E), l'ambre clair. Le gris secondaire #98989D tient 4,5:1 sur #2C2C2E.
export const MINERAL_DARK = Object.freeze({
 bg:'#000000',surface:'#1C1C1E',card:'#1C1C1E',card2:'#2C2C2E',
 border:'#38383A',text:'#F5F5F7',muted:'#98989D',faint:'#98989D',
 accent:'#0071E3',accentTexte:'#409CFF',accentSoft:'#409CFF',onAccent:'#FFFFFF',
 danger:'#FFB340',doublon:'#FF6961',warn:'#FFB340',onWarn:'#1D1D1F',warnSoft:'#2E2412',gold:'#FFB340',blue:'#98989D',purple:'#98989D',
 shadow:'none',shadowMd:'0 0 0 1px rgba(255,255,255,.05)',shadowLg:'0 0 0 1px rgba(255,255,255,.07), 0 16px 48px rgba(0,0,0,.6)',
 ring:'rgba(10,132,255,.28)',glass:'#1C1C1E',bar:'#000000',hair:'rgba(255,255,255,.08)',
 sidebar:'#000000',chrome:'#000000',onChrome:'#F5F5F7',chromeMuted:'#98989D',chromeLine:'#38383A',
 chromeGradient:'#000000',photo:'#2C2C2E',
 s1:'#0A84FF',s2:'#64B0FF',selection:'#0A84FF',
 carteSombre:'radial-gradient(120% 90% at 100% 0%, #2a5385 0%, #1b2d45 50%, #15233a 100%)',carteSombreClair:'#2A5385',
 caseSombre:'rgba(255,255,255,.1)',surSombre:'#FFFFFF',surSombre2:'rgba(255,255,255,.82)'
});
// (6 nov., vague 3) LA CARTE SOMBRE (`CarteStats` / `CarteMois`, la tête de Ma journée) : son fond
// (`carteSombre`, dont `carteSombreClair` est l'arrêt le PLUS CLAIR), le voile d'une case
// (`caseSombre`) et ses deux encres (`surSombre` pour les chiffres, `surSombre2` pour le reste).
// Mesuré au pire point — l'arrêt le plus clair, sous le voile d'une case : en sombre, le gris
// d'avant (blanc à 62-65 %) ne tenait que 3,4-3,6:1 sur le haut du dégradé #2A5385 ; à 82 % il
// tient 4,7:1 (5,9:1 hors case). En clair, 70 % tient 5,1:1 sur #1F3A5F sous une case.
// (6 nov., finitions) Le « — » d'une carte sombre (un chiffre pas su) est en `surSombre2`, partout,
// la carte Compta comprise (une règle la forçait au blanc plein) ; plus aucun blanc translucide à la main.
// `scripts/audit-vague3-ecrans.cjs` (K) recalcule ces rapports depuis CES jetons.
// Les portails (détails de vente, fenêtres) héritent du document : mêmes jetons
// que la coque, sans seconde palette à entretenir dans les feuilles CSS.
export function variablesTheme(t,sombre=false){return {
 '--vrm-nav-gradient':t.chromeGradient,'--vrm-ink':t.text,'--vrm-brand-filter':sombre?'invert(1)':'none',
 '--vrm-muted':t.muted,'--vrm-faint':t.faint,'--vrm-hair':t.hair,'--vrm-bar':t.bar,
 '--vrm-accent':t.accent,'--vrm-accent-texte':t.accentTexte,'--vrm-on-accent':t.onAccent,'--vrm-card2':t.card2,'--vrm-line':t.border,'--vrm-surface':t.card,'--vrm-bg':t.bg,
 '--vrm-danger':t.danger,'--vrm-doublon':t.doublon,'--vrm-warn':t.warn,'--vrm-on-warn':t.onWarn,'--vrm-warn-soft':t.warnSoft,'--vrm-photo':t.photo,
 '--vrm-carte-sombre':t.carteSombre,'--vrm-case-sombre':t.caseSombre,'--vrm-sur-sombre':t.surSombre,'--vrm-sur-sombre-2':t.surSombre2,
};}
