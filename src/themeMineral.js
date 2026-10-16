// ⚠️ DIRECTION RÉVISÉE PAR JULIEN LE 16 OCTOBRE 2026 (maquette à l'appui).
// La direction « Minéral » (pierre chaude + encre, 13 octobre) est RETIRÉE :
// Julien l'a refusée (« je veux pas que ce soit de cette couleur ») au profit
// de son tableau de bord de référence — fond clair FROID, encre, UN bleu de
// marque, barre latérale BLEU NUIT, cartes premium à ombres douces. Mêmes hex
// que la page d'accueil (identité commune, §7 : un seul accent, rare).
// Les statuts métier gardent leurs couleurs. Le nom du fichier/export ne change
// pas (il est importé ailleurs), mais la palette, elle, est la nouvelle.
export const MINERAL = Object.freeze({
  bg: '#F4F6FA', surface: '#FFFFFF', card: '#FFFFFF', card2: '#EEF2F8',
  border: '#E3E7EE', text: '#121B2C', muted: '#566077',
  accent: '#2458E6', accentSoft: '#4C7BFF', onAccent: '#FFFFFF',
  danger: '#C0392B', warn: '#A15C00', gold: '#7A6636',
  blue: '#1D4FD6', purple: '#5B4B9E',
  shadow: '0 1px 2px rgba(18,27,44,.05)',
  shadowMd: '0 3px 14px rgba(18,27,44,.07)',
  shadowLg: '0 16px 48px rgba(18,27,44,.14)',
  ring: 'rgba(36,88,230,.18)', glass: 'rgba(244,246,250,.96)',
  // Chrome = barre latérale / héros : BLEU NUIT, texte clair (identité maquette).
  chrome: '#0E1A2B', onChrome: '#EAEFF7', chromeMuted: '#93A1B8',
  chromeLine: 'rgba(255,255,255,0.10)', s1: '#2458E6', s2: '#7C9CFF',
  selection: '#2458E6'
});
