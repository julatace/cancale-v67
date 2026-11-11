// ═══════════════════════════════════════════════════════════════════════════
// PARLER À LA LOUPE (11 nov.) — le moteur de dictée, UN pour toute l'app.
// ═══════════════════════════════════════════════════════════════════════════
// La reconnaissance est celle du NAVIGATEUR (Web Speech API, `fr-FR`) : aucune
// clé, aucun serveur à nous, aucun son enregistré ni envoyé par VRM (§2.9). Le
// navigateur, lui, peut faire reconnaître la voix par le service de son éditeur
// (Google pour Chrome, Microsoft pour Edge, Apple pour Safari) — c'est dit dans
// le « Pourquoi ? » de la loupe (`POURQUOI_VOIX`).
//   · `voixDisponible()` : l'API existe ⇒ un micro ; sinon AUCUN bouton (jamais un
//     bouton mort — Firefox, certains Safari) ;
//   · `ecouter({ canal, onDirect, onFinal, onErreur, onFin })` : la transcription
//     EN DIRECT (`interimResults`) à chaque mot, puis UNE fois le texte final ;
//   · une erreur devient un code (`codeErreurVoix`) et une phrase qui dit quoi
//     faire (`PHRASES_VOIX`) ; un micro REFUSÉ éteint les micros de la session
//     (`VOIX.refus`) et la loupe dit pourquoi.
//   · `etatVoix(canal)` / `ecouterEtatVoix(fn)` : ce qui s'affiche (j'écoute, ce
//     qui est entendu, l'erreur), lu par les composants (src/composants/voix.jsx).
// Exécuté (avec une fausse reconnaissance) par scripts/audit-parler-loupe.cjs.

export const voixDisponible = () => typeof window !== 'undefined' && typeof (window.SpeechRecognition || window.webkitSpeechRecognition) === 'function';

// Refusé une fois (permission du navigateur, service coupé) ⇒ plus de micro de la session.
export const VOIX = { refus: false };

export const PHRASES_VOIX = {
  refus: 'Micro refusé par le navigateur : autorise le micro pour ce site (le cadenas à gauche de l’adresse), puis recharge la page. En attendant, tape ta recherche.',
  'aucun-son': 'Je n’ai rien entendu. Touche le micro et parle tout de suite.',
  reseau: 'La reconnaissance de ton navigateur ne répond pas. Tape ta recherche.',
  materiel: 'Aucun micro trouvé sur cet appareil. Tape ta recherche.',
  autre: 'La dictée s’est arrêtée. Réessaie ou tape ta recherche.',
};

export const POURQUOI_VOIX = 'La voix est reconnue par ton navigateur, pas par VRM : VRM n’enregistre aucun son et n’en envoie aucun. Selon le navigateur, la reconnaissance peut passer par le service de son éditeur (Google pour Chrome, Microsoft pour Edge, Apple pour Safari). Sans reconnaissance dans le navigateur (Firefox, certains Safari), il n’y a pas de micro.';

// L'erreur du navigateur → un code à nous (null : arrêt voulu, rien à dire).
export const codeErreurVoix = (e) => {
  const c = e && typeof e === 'object' ? e.error : e;
  if (c === 'not-allowed' || c === 'service-not-allowed') return 'refus';
  if (c === 'no-speech') return 'aucun-son';
  if (c === 'network') return 'reseau';
  if (c === 'audio-capture') return 'materiel';
  if (c === 'aborted') return null;
  return 'autre';
};

// ── L'état affiché, par canal (« loupe », « champ-… ») ──────────────────────
const ETATS = new Map();
const ECOUTEURS = new Set();
const VIDE = Object.freeze({ ecoute: false, direct: '', erreur: null });
export const etatVoix = (canal) => ETATS.get(canal) || VIDE;
export const ecouterEtatVoix = (fn) => { ECOUTEURS.add(fn); return () => { ECOUTEURS.delete(fn); }; };
const poser = (canal, part) => {
  const avant = etatVoix(canal);
  ETATS.set(canal, Object.freeze({ ...avant, ...part }));
  for (const fn of [...ECOUTEURS]) { try { fn(canal); } catch (_) {} }
};
export const effacerErreurVoix = (canal) => { if (etatVoix(canal).erreur) poser(canal, { erreur: null }); };

// Ce que la reconnaissance a rendu → { texte, fini } (toutes les tranches, dans l'ordre).
// Une tranche sans `isFinal` (vieux navigateurs) compte comme finale.
export const lireResultats = (e) => {
  const rs = e && e.results; if (!rs) return { texte: '', fini: false };
  let texte = '', fini = rs.length > 0;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]; const alt = r && r[0]; const t = alt && alt.transcript ? String(alt.transcript) : '';
    texte += t; if (r && r.isFinal === false) fini = false;
  }
  return { texte: texte.replace(/\s+/g, ' ').trim(), fini };
};

const ACTIVES = new Map();   // canal → reconnaissance en cours (une par canal)
export const ecouteEnCours = (canal) => ACTIVES.has(canal);
export const arreterVoix = (canal) => { const r = ACTIVES.get(canal); if (r) { try { r.stop(); } catch (_) {} } };
export const annulerVoix = (canal) => { const r = ACTIVES.get(canal); ACTIVES.delete(canal); if (r) { try { r.abort ? r.abort() : r.stop(); } catch (_) {} } poser(canal, { ecoute: false, direct: '' }); };

// Écouter UNE phrase. Rend false si rien n'a pu démarrer (pas d'API, micro refusé).
export function ecouter({ canal = 'defaut', onDirect, onFinal, onErreur, onFin } = {}) {
  if (!voixDisponible() || VOIX.refus) return false;
  if (ACTIVES.has(canal)) { arreterVoix(canal); return true; }   // re-toucher le micro = « j'ai fini »
  let rec;
  try { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; rec = new SR(); } catch (_) { return false; }
  let fini = false, dernier = '';
  const finir = (texte) => {
    if (fini) return; fini = true;
    const t = String(texte || '').trim();
    if (t && onFinal) { try { onFinal(t); } catch (_) {} }
  };
  try { rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1; } catch (_) {}
  rec.onresult = (e) => {
    if (ACTIVES.get(canal) !== rec) return;
    const r = lireResultats(e); if (!r.texte) return;
    dernier = r.texte;
    poser(canal, { direct: r.texte });
    if (onDirect) { try { onDirect(r.texte, r.fini); } catch (_) {} }
    if (r.fini) finir(r.texte);
  };
  rec.onerror = (e) => {
    if (ACTIVES.get(canal) !== rec) return;
    const code = codeErreurVoix(e);
    if (code === 'refus') VOIX.refus = true;
    if (code) { fini = true; poser(canal, { erreur: code }); if (onErreur) { try { onErreur(code); } catch (_) {} } }
  };
  rec.onend = () => {
    if (ACTIVES.get(canal) !== rec) return;
    ACTIVES.delete(canal);
    // Certains navigateurs s'arrêtent sans tranche finale : ce qui a été entendu vaut.
    if (!fini && dernier) finir(dernier);
    poser(canal, { ecoute: false, direct: '' });
    if (onFin) { try { onFin(); } catch (_) {} }
  };
  ACTIVES.set(canal, rec);
  poser(canal, { ecoute: true, direct: '', erreur: null });
  try { rec.start(); } catch (_) { ACTIVES.delete(canal); poser(canal, { ecoute: false }); return false; }
  return true;
}
