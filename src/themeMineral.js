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
// ⚠️⚠️ (21 nov., décision de Julien) STYLE « COMME VINTEX » : les VALEURS sont celles de src/natif/jetons.css (`--n-*`) —
// fond #F1F3F6, cartes blanches, contours #E4E4E7, encre #16181D, gris #62676F, accent VERT SAPIN #16181D (nuit #F4F4F5,
// texte sombre dessus), ambre pour un geste, rouge au seul doublon. Plus aucun bleu (docs/passation/2026-11-21-style-vintex.md).
// (22 nov., décision de Julien : « j'aime bien en noir ») l'accent devient l'ENCRE (#16181D ; nuit #F4F4F5).
export const MINERAL = Object.freeze({
 bg:'#F4F4F2',haut:'#F4F4F2',surface:'#FFFFFF',card:'#FFFFFF',card2:'#F7F7F5',
 border:'#E5E4E0',text:'#16181D',muted:'#5F636A',faint:'#5F636A',
 accent:'#16181D',accentTexte:'#16181D',accentSoft:'#2E3136',onAccent:'#FFFFFF',
 danger:'#874600',doublon:'#BF2A21',warn:'#874600',onWarn:'#FFFFFF',warnSoft:'#FFEBC4',gold:'#874600',blue:'#62676F',purple:'#62676F',
 shadow:'none',
 shadowMd:'0 1px 2px rgba(26,26,30,.04), 0 2px 6px rgba(26,26,30,.04)',
 shadowLg:'0 8px 30px rgba(26,26,30,.14)',
 ring:'rgba(22,24,29,.22)',glass:'#FFFFFF',bar:'#FFFFFF',hair:'#EEEDE9',
 sidebar:'#FFFFFF',chrome:'#FFFFFF',onChrome:'#16181D',chromeMuted:'#62676F',chromeLine:'#E4E4E7',
 chromeGradient:'#F4F4F2',photo:'#F4F4F2',
 s1:'#16181D',s2:'#B8BBC0',selection:'#16181D',
 carteSombre:'radial-gradient(120% 90% at 100% 0%, #26302C 0%, #16181D 60%)',carteSombreClair:'#26302C',
 caseSombre:'rgba(255,255,255,.1)',surSombre:'#FFFFFF',surSombre2:'rgba(255,255,255,.7)'
});
// (23 nov., Julien : « le gris de l'écran d'accueil ») LA NUIT = le gris-ardoise de vrm.center (fond #1C1C20, haut #27272B, cartes #2A2A2F,
// texte blanc, gris #B8B8C0) : l'apparence PAR DÉFAUT de l'app (src/apparence.js). Ancien commentaire :
// La nuit du studio : bleu-nuit profond (#0C1829), la porcelaine #16273C, le creux #091320, l'encre
// #EAF2FB, le gris #9CB0C6 (≥ 6,8:1), l'aplat d'accent #1F6FD6 au texte blanc (5,0:1), les liens #6CB4FF.
export const MINERAL_DARK = Object.freeze({
 bg:'#1C1C20',haut:'#27272B',surface:'#2A2A2F',card:'#2A2A2F',card2:'#323238',
 border:'#42424A',text:'#FFFFFF',muted:'#B8B8C0',faint:'#B8B8C0',
 accent:'#F4F4F5',accentTexte:'#F4F4F5',accentSoft:'#D4D4D8',onAccent:'#18181B',
 danger:'#FFC266',doublon:'#FF7A6E',warn:'#FFC266',onWarn:'#1C1300',warnSoft:'#3A3020',gold:'#FFC266',blue:'#B8B8C0',purple:'#B8B8C0',
 shadow:'none',shadowMd:'0 0 0 1px rgba(255,255,255,.02)',shadowLg:'0 8px 30px rgba(0,0,0,.45)',
 ring:'rgba(244,244,245,.30)',glass:'#2A2A2F',bar:'#1C1C20',hair:'rgba(255,255,255,.10)',
 sidebar:'#232327',chrome:'#1C1C20',onChrome:'#FFFFFF',chromeMuted:'#B8B8C0',chromeLine:'#42424A',
 chromeGradient:'#1C1C20',photo:'#323238',
 s1:'#FFFFFF',s2:'#7BE8BE',selection:'#F4F4F5',
 carteSombre:'radial-gradient(120% 90% at 100% 0%, #3D4B5B 0%, #1C1D22 60%, #15161A 100%)',carteSombreClair:'#3D4B5B',
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
