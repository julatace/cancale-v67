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
// ⚠️⚠️ (14 nov., décision de Julien) STUDIO BLEU CLAIR — remplace Vitrine/Apple. Un seul bleu clair
// partout (la nuit, un bleu-nuit profond), la porcelaine posée dessus, l'encre bleu nuit, UN accent rare
// (#0060CC diode/aplat, #0055B8 texte de lien), l'ambre pour un geste, le rouge au seul doublon de N°.
// Les VALEURS sont celles de src/design/studio.css (jetons `--sb-*`) — docs/design/studio-bleu-clair.md.
// `bg` = l'aplat (la coque peint la lumière haut → bas par-dessus, studio.css §7.1) ; `haut` = le haut
// de la lumière (la barre d'état du téléphone). Contrastes mesurés (AA, 4,5:1) : encre ≥ 12,2 ; muted
// ≥ 5,6 sur l'aplat ET le bas du dégradé ; ambre ≥ 5,8 ; lien ≥ 5,0 ; blanc sur l'accent 5,9.
// Les noms des exports (MINERAL, MINERAL_DARK) ne changent pas : tout App.jsx les lit déjà.
export const MINERAL = Object.freeze({
 bg:'#D6E8F5',haut:'#EEF6FD',surface:'#FFFFFF',card:'#FFFFFF',card2:'#E4EEF7',
 border:'#CBDCEB',text:'#0C1D30',muted:'#3F5468',faint:'#3F5468',
 accent:'#0060CC',accentTexte:'#0055B8',accentSoft:'#0055B8',onAccent:'#FFFFFF',
 danger:'#764300',doublon:'#B8261A',warn:'#764300',onWarn:'#FFFFFF',warnSoft:'#F8EBD8',gold:'#764300',blue:'#3F5468',purple:'#3F5468',
 shadow:'none',
 shadowMd:'inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgba(18,52,96,.07), 0 1px 2px rgba(18,52,96,.07), 0 12px 26px -14px rgba(18,52,96,.30)',
 shadowLg:'inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgba(18,52,96,.06), 0 2px 5px rgba(18,52,96,.07), 0 34px 60px -26px rgba(18,52,96,.48)',
 ring:'rgba(0,96,204,.22)',glass:'#FFFFFF',bar:'#D6E8F5',hair:'rgba(18,52,96,.10)',
 sidebar:'#D6E8F5',chrome:'#D6E8F5',onChrome:'#0C1D30',chromeMuted:'#3F5468',chromeLine:'#CBDCEB',
 chromeGradient:'#D6E8F5',photo:'#F1F5F9',
 s1:'#0060CC',s2:'#8DB8F2',selection:'#0060CC',
 carteSombre:'radial-gradient(120% 90% at 100% 0%, #1f3a5f 0%, #1d1d1f 55%)',carteSombreClair:'#1F3A5F',
 caseSombre:'rgba(255,255,255,.1)',surSombre:'#FFFFFF',surSombre2:'rgba(255,255,255,.7)'
});
// La nuit du studio : bleu-nuit profond (#0C1829), la porcelaine #16273C, le creux #091320, l'encre
// #EAF2FB, le gris #9CB0C6 (≥ 6,8:1), l'aplat d'accent #1F6FD6 au texte blanc (5,0:1), les liens #6CB4FF.
export const MINERAL_DARK = Object.freeze({
 bg:'#0C1829',haut:'#15263D',surface:'#16273C',card:'#16273C',card2:'#091320',
 border:'#243A55',text:'#EAF2FB',muted:'#9CB0C6',faint:'#9CB0C6',
 accent:'#1F6FD6',accentTexte:'#6CB4FF',accentSoft:'#6CB4FF',onAccent:'#FFFFFF',
 danger:'#F2B65E',doublon:'#FF6B5E',warn:'#F2B65E',onWarn:'#0C1D30',warnSoft:'#2A2213',gold:'#F2B65E',blue:'#9CB0C6',purple:'#9CB0C6',
 shadow:'none',shadowMd:'inset 0 .5px 0 rgba(255,255,255,.09), 0 0 0 .5px rgba(0,0,0,.5), 0 12px 26px -12px rgba(0,0,0,.8)',shadowLg:'inset 0 .5px 0 rgba(255,255,255,.12), 0 0 0 .5px rgba(0,0,0,.5), 0 34px 60px -22px rgba(0,0,0,.95)',
 ring:'rgba(74,163,255,.30)',glass:'#16273C',bar:'#0C1829',hair:'rgba(255,255,255,.08)',
 sidebar:'#0C1829',chrome:'#0C1829',onChrome:'#EAF2FB',chromeMuted:'#9CB0C6',chromeLine:'#243A55',
 chromeGradient:'#0C1829',photo:'#1C2E46',
 s1:'#4AA3FF',s2:'#6CB4FF',selection:'#4AA3FF',
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
