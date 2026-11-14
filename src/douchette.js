// ════════════════════════════════════════════════════════════════════════════
//  LA DOUCHETTE SUR ORDINATEUR (14 nov., proposition 99 validée par Julien)
//  Un lecteur de code-barres USB ou Bluetooth EST un clavier : il « tape » le code
//  très vite puis Entrée. VRM écoute la page entière (jamais dans un champ de saisie) :
//  une RAFALE de caractères (moins de `ecartMax` ms entre deux touches) terminée par
//  Entrée est un code lu ; une frappe humaine (100 à 300 ms entre deux touches) n'en
//  est jamais un.
//
//  ⚠️ LE CODE DÉSIGNE UNE VENTE PAR IDENTITÉ SEULEMENT (§5, « même avec 50 articles
//  identiques, tu ne dois pas pouvoir te tromper ») : son n° de transaction, son n° de
//  suivi (celui de l'e-mail ou celui LU sur l'étiquette), ou le code-barres du
//  bordereau (les FORMES mesurées de `candidatsDuScan`, src/scanColis.js — le même
//  scanner que la caméra). Égalité EXACTE ; jamais un titre, jamais une ressemblance.
//    · une seule vente porte ce code ⇒ { etat: 'trouve', ligne } (l'écran l'ouvre) ;
//    · deux ventes ⇒ { etat: 'ambigu' } : RIEN n'est ouvert ;
//    · aucune ⇒ { etat: 'inconnu' } : dit, rien n'est ouvert.
//  Module PUR : src/Douchette.jsx, App.jsx et scripts/audit-colis-plus.cjs l'EXÉCUTENT.
// ════════════════════════════════════════════════════════════════════════════
import { candidatsDuScan, normaliserN } from './scanColis.js';

export const ECART_MAX_MS = 50;     // une douchette envoie ses touches en < 20 ms ; un humain en 100–300 ms
export const LONGUEUR_MIN = 6;      // un n° de transaction, de suivi ou de bordereau en a bien plus
export const LONGUEUR_MAX = 64;

// Un élément où l'on TAPE (la douchette s'y comporte comme un clavier : on n'y touche pas).
export function estChampSaisie(el) {
  if (!el || typeof el !== 'object') return false;
  const tag = String(el.tagName || '').toUpperCase();
  if (tag === 'INPUT') {
    const t = String((el.type || '')).toLowerCase();
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(t);
  }
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

// Le détecteur : `touche({ key, t, champ, mod })` à chaque keydown ; rend le code lu
// (texte brut) sur l'Entrée qui termine une rafale, sinon null. `champ` : la touche
// tombe dans un champ de saisie ⇒ la rafale est oubliée. `mod` : Ctrl / Alt / ⌘ tenu ⇒ oubliée.
export function creerDetecteur({ ecartMax = ECART_MAX_MS, min = LONGUEUR_MIN, max = LONGUEUR_MAX } = {}) {
  let tampon = '', dernier = 0, lent = false;
  const vider = () => { tampon = ''; dernier = 0; lent = false; };
  return {
    touche({ key, t, champ = false, mod = false } = {}) {
      const at = Number(t);
      if (champ || mod || !Number.isFinite(at)) { vider(); return null; }
      if (key === 'Enter') {
        const code = tampon, ok = !lent && code.length >= min && code.length <= max;
        vider();
        return ok ? code : null;
      }
      if (typeof key !== 'string' || key.length !== 1) { if (key !== 'Shift') vider(); return null; }
      // Un écart trop long : ce qui précède était une frappe humaine ; on repart de cette touche.
      if (tampon && at - dernier > ecartMax) { tampon = ''; lent = false; }
      tampon += key; dernier = at;
      if (tampon.length > max) lent = true;
      return null;
    },
    vider,
    get enCours() { return tampon; },
  };
}

// Les identités d'une vente, sous forme comparable. `ligne` :
// { cle, tx?, suivis?: [n°…], codes?: [code de bordereau…] }.
export function identitesDe(ligne) {
  if (!ligne) return [];
  const out = new Set();
  const ajoute = (v) => { const s = normaliserN(v); if (s.length >= 4) out.add(s); };
  if (ligne.tx != null) ajoute(ligne.tx);
  for (const s of (Array.isArray(ligne.suivis) ? ligne.suivis : [])) ajoute(s);
  for (const s of (Array.isArray(ligne.codes) ? ligne.codes : [])) ajoute(s);
  return [...out];
}

// Les n° qu'une lecture DÉSIGNE : la valeur brute, et ce que les formes mesurées du
// bordereau désignent (src/scanColis.js) — une liste FERMÉE, jamais une approximation.
export function candidatsDouchette(brut) {
  const out = candidatsDuScan(brut);
  const s = normaliserN(brut);
  if (s && s.length >= LONGUEUR_MIN && !out.includes(s)) out.push(s);
  return out;
}

// La vente que désigne un code lu. `lignes` : [{ cle, tx?, suivis?, codes?, … }].
// Deux lignes de la MÊME vente (même `cle`) comptent pour une.
export function venteDuCode(brut, lignes) {
  const cands = candidatsDouchette(brut);
  if (!cands.length) return { etat: 'vide', candidats: cands };
  const parCle = new Map();
  for (const l of (Array.isArray(lignes) ? lignes : [])) {
    if (!l || l.cle == null) continue;
    if (identitesDe(l).some((x) => cands.includes(x))) parCle.set(String(l.cle), l);
  }
  const L = [...parCle.values()];
  if (!L.length) return { etat: 'inconnu', candidats: cands };
  if (L.length > 1) return { etat: 'ambigu', lignes: L, candidats: cands };
  return { etat: 'trouve', ligne: L[0], candidats: cands };
}

// Ce que l'écran montre d'un code inconnu : le début et la fin, jamais tout (un code
// de 26 chiffres ne se lit pas d'un coup d'œil).
export function codeCourt(brut) {
  const s = normaliserN(brut);
  return s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

// ── LE PASSAGE ENTRE L'ÉCOUTE (toute l'app) ET L'ÉCRAN QUI SAIT (Ventes) ──────
// Un seul écran à la fois résout les codes (le dernier enregistré) ; sans écran prêt,
// le code attend une minute (`DEMANDE_DOUCHETTE`) que Ventes monte et le reprenne.
const RESOLVEURS = [];
export const DEMANDE_DOUCHETTE = { code: '', at: 0 };
export const ATTENTE_MS = 60000;
export function enregistrerResolveur(f) {
  if (typeof f !== 'function') return () => {};
  RESOLVEURS.push(f);
  return () => { const i = RESOLVEURS.lastIndexOf(f); if (i >= 0) RESOLVEURS.splice(i, 1); };
}
export const resolveurActif = () => RESOLVEURS[RESOLVEURS.length - 1] || null;
export function prendreDemande(maintenant = Date.now()) {
  const d = DEMANDE_DOUCHETTE;
  if (!d.code || maintenant - d.at > ATTENTE_MS) { d.code = ''; d.at = 0; return ''; }
  const c = d.code; d.code = ''; d.at = 0; return c;
}
