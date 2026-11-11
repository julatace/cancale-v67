// ═══════════════════════════════════════════════════════════════════════════
// LE DÉBIT PAR VENDEUR (11 nov., lot « limites-client »)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « un client qui a 5 000 annonces ne doit pas ralentir l'app pour
// les autres ». Une route coûteuse (widget : ~320 Ko lus pour un gros vendeur ;
// envoi léger des ventes : la liste relue avant fusion) appelée en boucle par UN
// vendeur (raccourci iPhone mal réglé, extension dans dix Chrome) mange le
// quota d'égress de tous. Ici : une fenêtre glissante PAR (route, vendeur),
// en mémoire de l'instance — aucune lecture ni écriture de base en plus (un
// compteur en base coûterait plus que ce qu'il protège). Une instance Vercel
// sert beaucoup d'appels (Fluid) : c'est un frein contre l'emballement, pas un
// quota exact (`prendreQuota` de stockage-prive.js existe pour ça).
// Refus : 429 propre, `Retry-After`, et une phrase qui dit quoi faire.
// Le vendeur n'est JAMAIS deviné : sans owner vérifié, on ne compte rien.
// Tenu par scripts/audit-limites-client.cjs (D1-D3).
// ═══════════════════════════════════════════════════════════════════════════

export const DEBITS = {
  widget: { parMinute: 12, parHeure: 120 },      // le widget iPhone se rafraîchit ~4 fois par heure
  commandes: { parMinute: 40, parHeure: 400 },   // l'extension : quelques envois par compte et par visite
};
const MAX_CLES = 5000;   // mémoire bornée : au-delà, les plus anciennes clés partent
const fenetres = new Map();

// Rend { ok: true } ou { ok: false, reessayerS }. Compte l'appel s'il passe.
export function prendreDebit(route, owner, { maintenant = Date.now(), regles = DEBITS } = {}) {
  const r = regles[route];
  if (!r || !owner) return { ok: true };
  const cle = `${route}|${String(owner).toLowerCase()}`;
  const t = (fenetres.get(cle) || []).filter((x) => maintenant - x < 3600000);
  const minute = t.filter((x) => maintenant - x < 60000);
  if (minute.length >= r.parMinute) return { ok: false, reessayerS: Math.max(1, Math.ceil((minute[0] + 60000 - maintenant) / 1000)) };
  if (t.length >= r.parHeure) return { ok: false, reessayerS: Math.max(1, Math.ceil((t[0] + 3600000 - maintenant) / 1000)) };
  t.push(maintenant);
  fenetres.delete(cle); fenetres.set(cle, t);
  if (fenetres.size > MAX_CLES) fenetres.delete(fenetres.keys().next().value);
  return { ok: true };
}

export function refuserTropVite(res, d) {
  const s = d.reessayerS;
  try { res.setHeader('Retry-After', String(s)); } catch (_) {}
  const quand = s < 90 ? `${s} s` : `${Math.ceil(s / 60)} min`;
  return res.status(429).json({ ok: false, erreur: 'trop-vite', reessayerDans: s, message: `Trop de demandes d'un coup. Réessaie dans ${quand}.` });
}

// Pour les bancs seulement.
export function _viderDebits() { fenetres.clear(); }
