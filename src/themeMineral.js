// Palette Perle : mêmes jetons pour les composants React et les surfaces CSS.
// Les statuts d'erreur et d'avertissement restent distincts de l'accent de marque.
export const MINERAL = Object.freeze({
 bg:'#F1F3F0',surface:'#FDFEFC',card:'#FDFEFC',card2:'#EAF0EC',
 border:'#DCE4DF',text:'#213B41',muted:'#53696D',faint:'#607578',
 accent:'#244E54',accentSoft:'#6E9989',onAccent:'#FFFFFF',
 danger:'#B43E35',warn:'#965900',gold:'#78663F',blue:'#426E7C',purple:'#706681',
 shadow:'0 1px 2px rgba(25,59,67,.025), 0 4px 14px rgba(25,59,67,.035)',
 shadowMd:'0 2px 5px rgba(25,59,67,.04), 0 10px 26px rgba(25,59,67,.06)',
 shadowLg:'0 6px 16px rgba(25,59,67,.06), 0 24px 56px rgba(25,59,67,.14)',
 ring:'rgba(36,78,84,.16)',glass:'rgba(253,254,252,.96)',bar:'rgba(253,254,252,.94)',hair:'rgba(33,59,65,.09)',
 sidebar:'#24464B',chrome:'#193B43',onChrome:'#F4F8F5',chromeMuted:'#C1D1CD',chromeLine:'rgba(255,255,255,.13)',
 chromeGradient:'linear-gradient(160deg,#193B43 0%,#2E5558 60%,#385C57 100%)',
 s1:'#244E54',s2:'#6E9989',selection:'#244E54'
});
export const MINERAL_DARK = Object.freeze({
 bg:'#122329',surface:'#1C3339',card:'#1C3339',card2:'#274147',
 border:'#385258',text:'#EDF5F1',muted:'#B4C7C3',faint:'#98B1AD',
 accent:'#B7D6C8',accentSoft:'#83B5A2',onAccent:'#173A40',
 danger:'#FF9188',warn:'#EBC080',gold:'#CFBE97',blue:'#A1C6D1',purple:'#BEB5D5',
 shadow:'0 2px 8px rgba(0,0,0,.12)',shadowMd:'0 8px 24px rgba(0,0,0,.18)',shadowLg:'0 16px 48px rgba(0,0,0,.30)',
 ring:'rgba(183,214,200,.20)',glass:'rgba(28,51,57,.96)',bar:'rgba(28,51,57,.94)',hair:'rgba(237,245,241,.10)',
 sidebar:'#0B1A1F',chrome:'#0A181D',onChrome:'#F4F8F5',chromeMuted:'#BECEC9',chromeLine:'rgba(255,255,255,.13)',
 chromeGradient:'linear-gradient(160deg,#0A181D 0%,#0E2026 65%,#11242A 100%)',
 s1:'#B7D6C8',s2:'#83B5A2',selection:'#B7D6C8'
});
// Les portails (détails de vente, fenêtres) héritent du document : mêmes jetons
// que la coque, sans seconde palette à entretenir dans les feuilles CSS.
export function variablesTheme(t,sombre=false){return {
 '--vrm-nav-gradient':t.chromeGradient,'--vrm-ink':t.text,'--vrm-brand-filter':sombre?'invert(1)':'none',
 '--vrm-muted':t.muted,'--vrm-faint':t.faint,'--vrm-hair':t.hair,'--vrm-bar':t.bar,
 '--vrm-accent':t.accent,'--vrm-card2':t.card2,'--vrm-line':t.border,'--vrm-surface':t.card,'--vrm-bg':t.bg,
};}
