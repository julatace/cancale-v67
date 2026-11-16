import crypto from 'crypto';
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
export function prendreDebit(route, owner, { maintenant = Date.now(), regles = DEBITS, compter = true } = {}) {
  const r = regles[route];
  if (!r || !owner) return { ok: true };
  const cle = `${route}|${String(owner).toLowerCase()}`;
  const t = (fenetres.get(cle) || []).filter((x) => maintenant - x < 3600000);
  const minute = t.filter((x) => maintenant - x < 60000);
  if (minute.length >= r.parMinute) return { ok: false, reessayerS: Math.max(1, Math.ceil((minute[0] + 60000 - maintenant) / 1000)) };
  if (t.length >= r.parHeure) return { ok: false, reessayerS: Math.max(1, Math.ceil((t[0] + 3600000 - maintenant) / 1000)) };
  if (!compter) return { ok: true };
  t.push(maintenant);
  fenetres.delete(cle); fenetres.set(cle, t);
  if (fenetres.size > MAX_CLES) fenetres.delete(fenetres.keys().next().value);
  return { ok: true };
}

export function refuserTropVite(res, d) {
  const s = d.reessayerS;
  try { res.setHeader('Retry-After', String(s)); } catch (_) {}
  const quand = s < 90 ? `${s} s` : `${Math.ceil(s / 60)} min`;
  const corps = { ok: false, erreur: 'trop-vite', reessayerDans: s, message: `Trop de demandes d'un coup. Réessaie dans ${quand}.` };
  if (typeof res.status === 'function') return res.status(429).json(corps);
  res.statusCode = 429;
  try { res.setHeader('Content-Type', 'application/json; charset=utf-8'); } catch (_) {}
  return res.end(JSON.stringify(corps));
}

// ── (16 nov., revue de sécurité du 11 nov.) LES LIENS PUBLICS À JETON ───────────
// Agenda (.ics), catalogue privé, page du comptable, widget, SMS : des adresses
// ouvertes SANS session, gardées par un jeton de 256 bits. Rien ne fuit, mais rien
// ne bornait le débit : un robot pouvait les marteler (chaque appel lit la base).
// Deux fenêtres glissantes, en mémoire de l'instance (aucun service payant, aucune
// lecture de base de plus) : par ADRESSE IP (le premier saut de `x-forwarded-for`
// posé par Vercel) et par JETON (son empreinte, jamais le jeton lui-même).
// Un calendrier relit l'agenda toutes les 15 min à 1 h : très en dessous.
export const DEBITS_PUBLICS = {
  ip: { parMinute: 30, parHeure: 300 },
  jeton: { parMinute: 20, parHeure: 200 },
};
export function ipDe(req) {
  const h = (req && req.headers) || {};
  const brut = String(h['x-real-ip'] || h['x-vercel-forwarded-for'] || String(h['x-forwarded-for'] || '').split(',')[0] || (req && req.socket && req.socket.remoteAddress) || '').trim();
  return /^[0-9a-f:.]{2,45}$/i.test(brut) ? brut.toLowerCase() : '';
}
const empreinteJeton = (j) => crypto.createHash('sha256').update(String(j)).digest('hex').slice(0, 24);
// `route` : 'agenda' · 'catalogue' · 'comptable' · 'widget' · 'sms'. Rend { ok } ou { ok:false, reessayerS }.
export function prendreDebitPublic(route, req, jeton, { maintenant = Date.now() } = {}) {
  const ip = ipDe(req);
  const regles = { [`pub_ip_${route}`]: DEBITS_PUBLICS.ip, [`pub_jeton_${route}`]: DEBITS_PUBLICS.jeton };
  // Les deux fenêtres sont JUGÉES avant d'en compter une : un refus ne consomme rien.
  const essais = [];
  if (ip) essais.push([`pub_ip_${route}`, ip]);
  if (jeton) essais.push([`pub_jeton_${route}`, empreinteJeton(jeton)]);
  for (const [r, cle] of essais) {
    const d = prendreDebit(r, cle, { maintenant, regles, compter: false });
    if (!d.ok) return d;
  }
  for (const [r, cle] of essais) prendreDebit(r, cle, { maintenant, regles });
  return { ok: true };
}

// Pour les bancs seulement.
export function _viderDebits() { fenetres.clear(); }
