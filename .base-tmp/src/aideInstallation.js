// ══════════════════════════════════════════════════════════════════════════════
// L'AIDE « INSTALLER VRM » — LA RÈGLE (11 nov., lot app-installable)
// ══════════════════════════════════════════════════════════════════════════════
// Proposée UNE fois, jamais imposée, absente si VRM est déjà installée.
//   · iPhone dans Safari : deux gestes (Partager → « Sur l'écran d'accueil ») ;
//   · Android (Chrome, Edge, Samsung) : le bouton « Installer » du navigateur
//     (`beforeinstallprompt`), seulement s'il l'a offert ;
//   · ailleurs (ordinateur, iPad, Chrome sur iPhone) : rien.
// Pas à la 1re ouverture (l'accueil a déjà ses premiers pas) : à partir de la
// 2e, au bout de 20 s. Montrée = vue : elle ne revient plus sur cet appareil.
// Le guide complet reste dans Paramètres → Notifications (src/GuideIphone.jsx) ;
// s'il a été fermé, cette aide ne s'affiche pas non plus.
import { estIphoneSafari, estInstallee, lireFerme } from './guideIphone.js';

export const CLE_AIDE_INSTALLATION = 'vrm_aide_installation';
export const VISITES_AVANT_AIDE = 2;
export const DELAI_AIDE_MS = 20 * 1000;

// 'iphone' · 'android' · null
export function plateformeInstallation({ ua, installee = false, invitePrete = false, tactile = false } = {}) {
  if (installee) return null;
  if (estIphoneSafari(ua)) return 'iphone';
  if (invitePrete && tactile) return 'android';
  return null;
}

export function aideInstallationVisible({ plateforme, etat, guideFerme = false } = {}) {
  if (!plateforme || guideFerme) return false;
  const e = etat && typeof etat === 'object' ? etat : {};
  if (e.vue) return false;
  return Number(e.visites || 0) >= VISITES_AVANT_AIDE;
}

const stock = (s) => s || (typeof localStorage !== 'undefined' ? localStorage : null);
export function lireEtatAide(stockage) {
  try { const v = JSON.parse(stock(stockage).getItem(CLE_AIDE_INSTALLATION) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; }
}
function ecrire(stockage, e) { try { stock(stockage).setItem(CLE_AIDE_INSTALLATION, JSON.stringify(e)); } catch (_) {} }
// Une ouverture de l'app (une fois par chargement de page).
export function compterVisite(stockage) {
  const e = lireEtatAide(stockage);
  if (e.vue) return e;
  const n = { ...e, visites: Math.min(99, Number(e.visites || 0) + 1) };
  ecrire(stockage, n);
  return n;
}
export function noterAideVue(stockage, maintenant = Date.now()) {
  const e = lireEtatAide(stockage);
  ecrire(stockage, { ...e, vue: new Date(maintenant).toISOString() });
}

// Lu dans le vrai navigateur.
export function plateformeIci(invitePrete) {
  let tactile = false;
  try { tactile = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (_) {}
  return plateformeInstallation({ installee: estInstallee(), invitePrete: !!invitePrete, tactile });
}
export const guideDejaFerme = () => lireFerme();
