// ════════════════════════════════════════════════════════════════════════════
//  L'IA DE TON NAVIGATEUR — gratuite, sur l'appareil, sans aucune clé (28 nov. 2026, lot ia-sans-cle)
//  Julien (28 nov.) : « je ne veux pas avoir à mettre de clé, ni pour moi ni pour les utilisateurs, débrouille-toi ».
//  CLAUDE.md §2.9 : d'abord ce que le navigateur fait seul. Ici : l'API Prompt intégrée à Chrome (« Built-in AI »,
//  Gemini Nano), le global `LanguageModel` (l'ancien `window.ai.languageModel` est aussi reconnu). Le modèle tourne
//  SUR L'APPAREIL : rien ne part chez un tiers, rien ne se paie, aucune clé n'existe.
//
//  · `etatModele()` : 'disponible' (prêt) · 'telechargeable' (Chrome peut le télécharger, une fois, sur SON toucher)
//    · 'telechargement' (en cours) · 'absente' (Safari, Firefox, Orion, ancien Chrome, appareil trop petit).
//    « Pas su » (une exception) vaut 'absente' : jamais une promesse sur ce qu'on n'a pas vu.
//  · `ouvrirSession()` : crée la session (déclenche le téléchargement si besoin — il faut un geste de l'utilisateur),
//    la progression passe par `surProgres(0…1)`.
//  · `demanderJSON()` : un tour, sortie CONTRAINTE par un schéma JSON (`responseConstraint`) ; rend l'objet lu ou
//    null. L'appelant le VALIDE toujours avec son propre code (jamais affiché tel quel).
//  Sans modèle : chaque fonction a son moteur par règles (assistant guidé), et l'écran le dit.
// ════════════════════════════════════════════════════════════════════════════

// L'API du modèle, ou null. `w` remplaçable (audits, bancs).
export function apiModele(w = (typeof window !== 'undefined' ? window : null)) {
  try {
    if (!w) return null;
    if (w.LanguageModel && typeof w.LanguageModel.create === 'function') return w.LanguageModel;
    const anc = w.ai && w.ai.languageModel;
    if (anc && typeof anc.create === 'function') return anc;
  } catch (_) {}
  return null;
}

const LANGUES_MODELE = ['en', 'es', 'ja', 'fr', 'de', 'it'];
const optionsLangue = (langue) => {
  const l = LANGUES_MODELE.includes(langue) ? langue : 'en';
  return { expectedInputs: [{ type: 'text', languages: [l] }], expectedOutputs: [{ type: 'text', languages: [l] }] };
};
const ETATS = { available: 'disponible', readily: 'disponible', downloadable: 'telechargeable', 'after-download': 'telechargeable', downloading: 'telechargement' };

// L'état du modèle pour CETTE langue ; si la langue n'est pas prise en charge, l'état sans contrainte de langue
// (la sortie est de toute façon validée, et la consigne dit la langue).
export async function etatModele({ langue = 'fr', w } = {}) {
  const api = apiModele(w);
  if (!api) return 'absente';
  try {
    if (typeof api.availability === 'function') {
      let a = await api.availability(optionsLangue(langue));
      if (a === 'unavailable' || a === 'no') a = await api.availability();
      return ETATS[a] || 'absente';
    }
    if (typeof api.capabilities === 'function') { const c = await api.capabilities(); return ETATS[c && c.available] || 'absente'; }
  } catch (_) {}
  return 'absente';
}

// Ouvre une session. `systeme` : la consigne. `surProgres(x)` : 0…1 pendant un téléchargement. Rend la session ou null.
export async function ouvrirSession({ systeme = '', langue = 'fr', surProgres = null, signal, w } = {}) {
  const api = apiModele(w);
  if (!api) return null;
  const monitor = (m) => { try { m.addEventListener('downloadprogress', (e) => { if (surProgres) surProgres(Math.max(0, Math.min(1, Number(e.loaded) || 0))); }); } catch (_) {} };
  const base = { initialPrompts: systeme ? [{ role: 'system', content: systeme }] : [], monitor, ...(signal ? { signal } : {}) };
  try { return await api.create({ ...base, ...optionsLangue(langue) }); }
  catch (_) { try { return await api.create(base); } catch (_e) { return null; } }
}

// Le premier objet JSON d'un texte (le modèle peut l'entourer de ```json). L'objet ou null.
export function extraireJson(texte) {
  const t = String(texte == null ? '' : texte);
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a || b - a > 40000) return null;
  try { const o = JSON.parse(t.slice(a, b + 1)); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (_) { return null; }
}

// Un tour, sortie contrainte par `schema`. Rend { ok: true, objet } ou { ok: false, raison: 'panne'|'forme' }.
export async function demanderJSON(session, texte, schema, { signal } = {}) {
  if (!session || typeof session.prompt !== 'function') return { ok: false, raison: 'panne' };
  let sortie;
  try { sortie = await session.prompt(String(texte || ''), { ...(schema ? { responseConstraint: schema } : {}), ...(signal ? { signal } : {}) }); }
  catch (_) { return { ok: false, raison: 'panne' }; }
  const o = extraireJson(sortie);
  return o ? { ok: true, objet: o } : { ok: false, raison: 'forme' };
}

export function fermerSession(session) { try { if (session && typeof session.destroy === 'function') session.destroy(); } catch (_) {} }
