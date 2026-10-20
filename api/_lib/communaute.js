// ── LA CARTE DE LA COMMUNAUTÉ, CÔTÉ SERVEUR (api/compte.js?mode=communaute) ──
// Migration 018. Toutes les garanties vivent dans la BASE : les fonctions
// `vrm_communaute_*` prennent l'identité dans le jeton (`auth.uid()`), jamais
// dans un paramètre ; elles arrondissent la position, ne rendent jamais
// l'identifiant du compte ni l'email, et ne laissent lire que ses propres
// conversations. Cette route ne fait que relayer, AVEC LE JETON DE L'APPELANT
// (jamais la clé de service), et géocode une ville (OpenStreetMap, gratuit) :
//   GET                                        → { ok, carte, conversations }
//   POST { action: 'rejoindre', pseudo, ville, pays, lat, lon }
//   POST { action: 'quitter' }
//   POST { action: 'ecrire', pid, texte }
//   POST { action: 'fil', conv }               (marque lus les messages reçus)
//   POST { action: 'bloquer', conv, oui }
//   POST { action: 'signaler', conv, raison }
//   POST { action: 'ville', q } | { action: 'ville', lat, lon }
//   POST { action: 'discord', discord }        (019 — vide ⇒ retiré)
//   POST { action: 'classement', periode }     (019 — jour|semaine|mois|annee ; le
//                                               chiffre est COMPTÉ par la base)
//   POST { action: 'inscrire', oui }           (019 — opt-in au classement)
// TROIS ÉTATS, JAMAIS DEUX :
//   · 200 `ok: true`                — lu / fait ;
//   · 503 `erreur: 'non-installe'`  — la base n'a pas la 018 (PGRST202) : « la
//     carte n'est pas encore activée sur ta base », jamais une carte vide ;
//   · 503 `erreur: 'pas-su'`        — la base n'a pas répondu : rien n'est
//     affirmé (ni « personne », ni « refusé ») ;
//   · 4xx `erreur: <raison>`        — un refus RÉEL, dit en clair.
import { jetonDe } from './session.js';
import { sbCle } from './cle.js';
import { rpcEquipe } from './equipe.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANON = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
const commeAppelant = (jeton) => ({ apikey: ANON, Authorization: `Bearer ${jeton}` });

export const COMMUNAUTE_NON_INSTALLE = "La carte de la communauté n'est pas encore activée sur ta base.";
export const COMMUNAUTE_PAS_SU = "Je n'ai pas pu joindre la base — rien n'a changé. Réessaie dans un instant.";
const RAISONS = {
  session: 'Connecte-toi à VRM pour faire ça.',
  abonnement: "Ton abonnement n'est pas actif : la carte de la communauté est fermée pour l'instant.",
  pseudo: 'Ce pseudo ne va pas : 30 caractères au plus, sans « @ » (jamais ton adresse email).',
  ville: 'Choisis une ville.',
  pays: "Ce pays n'est pas reconnu.",
  position: 'Je ne retrouve pas cette ville sur la carte. Choisis-en une dans la liste.',
  texte: 'Un message fait de 1 à 500 caractères.',
  invisible: 'Mets-toi sur la carte pour écrire aux autres : on n’écrit qu’entre personnes visibles.',
  introuvable: "Cette personne n'est plus sur la carte.",
  soi: "C'est toi !",
  'tu-as-bloque': 'Tu as bloqué cette personne. Débloque-la pour lui écrire.',
  'plafond-heure': '20 messages par heure au plus — réessaie un peu plus tard.',
  'plafond-jour': '5 nouvelles conversations par jour au plus — réessaie demain.',
  discord: 'Ce pseudo Discord ne va pas : 2 à 32 caractères, lettres minuscules, chiffres, « . » ou « _ », sans « @ ».',
};
export const CLASSEMENT_NON_INSTALLE = "Le classement n'est pas encore activé sur ta base.";
export const PERIODES_CLASSEMENT = ['jour', 'semaine', 'mois', 'annee'];
// La forme des pseudos Discord actuels (la même que la contrainte de la 019).
export const DISCORD_RE = /^[a-z0-9._]{2,32}$/;
export const discordValide = (d) => DISCORD_RE.test(d) && !d.includes('..');

// Arrondi à 0,05° (≈ 5 km) : le serveur n'envoie jamais plus précis, et la
// base arrondit encore (elle refuse toute autre valeur).
export const arrondi = (x) => Math.round(Number(x) * 20) / 20;

// ── LE GÉOCODAGE D'UNE VILLE (Nominatim, OpenStreetMap — gratuit, sans clé) ──
const UA = { 'User-Agent': 'VRM/1.0 (carte de la communauté)', 'Accept-Language': 'fr' };
function villeDe(j) {
  const a = (j && j.address) || {};
  const nom = a.city || a.town || a.village || a.municipality || a.hamlet || j.name || '';
  const lat = Number(j && j.lat), lon = Number(j && j.lon);
  if (!nom || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { nom: String(nom).slice(0, 80), pays: String(a.country_code || '').toUpperCase().slice(0, 2) || 'FR',
    region: String(a.state || a.county || a.country || '').slice(0, 80), lat: arrondi(lat), lon: arrondi(lon) };
}
export async function geocoderVille({ q, lat, lon }, f = fetch) {
  try {
    if (q) {
      const t = String(q).trim().slice(0, 80);
      if (t.length < 2) return { ok: true, villes: [] };
      const r = await f(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&featureType=settlement&q=${encodeURIComponent(t)}`, { headers: UA });
      if (!r.ok) return { ok: false };
      const j = await r.json();
      if (!Array.isArray(j)) return { ok: false };
      const vus = new Set();
      const villes = j.map(villeDe).filter(Boolean).filter((v) => { const k = v.nom + '|' + v.pays + '|' + v.region; if (vus.has(k)) return false; vus.add(k); return true; });
      return { ok: true, villes };
    }
    const la = Number(lat), lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return { ok: true, villes: [] };
    const r = await f(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=10&lat=${la}&lon=${lo}`, { headers: UA });
    if (!r.ok) return { ok: false };
    const v = villeDe(await r.json());
    return { ok: true, villes: v ? [v] : [] };
  } catch (_) { return { ok: false }; }
}

const objet = (v) => (v && typeof v === 'object' ? v : null);

export async function routeCommunaute(req, res, { utilisateur, corps }) {
  const jeton = jetonDe(req);
  const dire = (code, c) => res.status(code).json(c);
  const nonInstalle = () => dire(503, { ok: false, erreur: 'non-installe', message: COMMUNAUTE_NON_INSTALLE });
  const pasSu = () => dire(503, { ok: false, erreur: 'pas-su', message: COMMUNAUTE_PAS_SU });
  const refus = (raison, code = 400) => dire(raison === 'session' ? 401 : raison === 'abonnement' ? 403 : code, { ok: false, erreur: raison, message: RAISONS[raison] || `La base a refusé (${raison}).` });
  if (!utilisateur || !jeton) return refus('session');
  const qui = commeAppelant(jeton);

  if (req.method === 'GET') {
    const [c, l] = await Promise.all([rpcEquipe('vrm_communaute_carte', {}, qui), rpcEquipe('vrm_communaute_conversations', {}, qui)]);
    if (c.etat === 'absent' || l.etat === 'absent') return nonInstalle();
    if (c.etat !== 'ok' || l.etat !== 'ok') return pasSu();
    const carte = objet(c.data);
    if (!carte) return refus('session');
    if (carte.acces === false) return refus('abonnement');
    if (!Array.isArray(carte.profils) || !Array.isArray(l.data)) return pasSu();
    return dire(200, { ok: true, carte: { moi: objet(carte.moi), profils: carte.profils }, conversations: l.data });
  }

  const action = String((corps && corps.action) || '');
  if (action === 'ville') {
    const g = await geocoderVille({ q: corps.q, lat: corps.lat, lon: corps.lon });
    if (!g.ok) return dire(503, { ok: false, erreur: 'geocodage', message: "Je n'ai pas pu chercher la ville (le service de carte ne répond pas). Réessaie dans un instant." });
    return dire(200, { ok: true, villes: g.villes });
  }
  const conv = String((corps && corps.conv) || '');
  const appel = async (nom, args, forme) => {
    const r = await rpcEquipe(nom, args, qui);
    if (r.etat === 'absent') { nonInstalle(); return undefined; }
    if (r.etat !== 'ok' || !forme(r.data)) { pasSu(); return undefined; }
    return r.data;
  };
  if (action === 'rejoindre') {
    const lat = Number(corps.lat), lon = Number(corps.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return refus('position');
    const d = await appel('vrm_communaute_rejoindre', { p_pseudo: String(corps.pseudo || '').slice(0, 60), p_ville: String(corps.ville || '').slice(0, 120),
      p_pays: String(corps.pays || 'FR').slice(0, 4), p_lat: arrondi(lat), p_lon: arrondi(lon) }, objet);
    if (d === undefined) return;
    return d.ok === true ? dire(200, { ok: true, pid: d.pid }) : refus(String(d.raison || 'inconnue'));
  }
  if (action === 'quitter') {
    const d = await appel('vrm_communaute_quitter', {}, (x) => typeof x === 'boolean');
    if (d === undefined) return;
    return dire(200, { ok: true, retire: d });
  }
  if (action === 'ecrire') {
    const pid = String(corps.pid || '');
    if (!UUID_RE.test(pid)) return refus('introuvable');
    const texte = String(corps.texte || '');
    if (!texte.trim() || texte.length > 500) return refus('texte');
    const d = await appel('vrm_communaute_ecrire', { p_pid: pid, p_texte: texte }, objet);
    if (d === undefined) return;
    return d.ok === true ? dire(200, { ok: true, conv: d.conv }) : refus(String(d.raison || 'inconnue'), 409);
  }
  if (action === 'fil' || action === 'bloquer' || action === 'signaler') {
    if (!UUID_RE.test(conv)) return dire(404, { ok: false, erreur: 'conv', message: "Cette conversation n'existe pas." });
    if (action === 'fil') {
      const r = await rpcEquipe('vrm_communaute_fil', { p_conv: conv }, qui);
      if (r.etat === 'absent') return nonInstalle();
      if (r.etat !== 'ok') return pasSu();
      if (r.data === null) return dire(404, { ok: false, erreur: 'conv', message: "Cette conversation n'existe pas." });
      if (!objet(r.data) || !Array.isArray(r.data.messages)) return pasSu();
      return dire(200, { ok: true, fil: r.data });
    }
    const d = action === 'bloquer'
      ? await appel('vrm_communaute_bloquer', { p_conv: conv, p_oui: corps.oui !== false }, (x) => typeof x === 'boolean')
      : await appel('vrm_communaute_signaler', { p_conv: conv, p_raison: String(corps.raison || '').slice(0, 300) }, (x) => typeof x === 'boolean');
    if (d === undefined) return;
    return d ? dire(200, { ok: true }) : dire(409, { ok: false, erreur: 'refuse', message: action === 'signaler' ? "Je n'ai pas pu ranger ton signalement (20 par jour au plus)." : "Rien n'a changé." });
  }
  if (action === 'discord') {
    const d = String((corps && corps.discord) || '').trim().toLowerCase();
    if (d && !discordValide(d)) return refus('discord');
    const r = await rpcEquipe('vrm_communaute_discord', { p_discord: d }, qui);
    if (r.etat === 'absent') return dire(503, { ok: false, erreur: 'non-installe', message: CLASSEMENT_NON_INSTALLE.replace('Le classement', 'Le pseudo Discord') });
    if (r.etat !== 'ok' || !objet(r.data)) return pasSu();
    return r.data.ok === true ? dire(200, { ok: true, discord: r.data.discord || null }) : refus(String(r.data.raison || 'inconnue'));
  }
  if (action === 'inscrire') {
    const r = await rpcEquipe('vrm_communaute_classement_inscrire', { p_oui: corps.oui === true }, qui);
    if (r.etat === 'absent') return dire(503, { ok: false, erreur: 'non-installe', message: CLASSEMENT_NON_INSTALLE });
    if (r.etat !== 'ok' || !objet(r.data)) return pasSu();
    return r.data.ok === true ? dire(200, { ok: true, classement: r.data.classement === true }) : refus(String(r.data.raison || 'inconnue'));
  }
  if (action === 'classement') {
    const periode = String((corps && corps.periode) || '');
    if (!PERIODES_CLASSEMENT.includes(periode)) return dire(400, { ok: false, erreur: 'periode', message: 'Période inconnue.' });
    // Seule la PÉRIODE part : aucun chiffre n'est jamais transmis à la base.
    const r = await rpcEquipe('vrm_communaute_classement', { p_periode: periode }, qui);
    if (r.etat === 'absent') return dire(503, { ok: false, erreur: 'non-installe', message: CLASSEMENT_NON_INSTALLE });
    if (r.etat !== 'ok') return pasSu();
    const c = objet(r.data);
    if (!c) return refus('session');
    if (c.acces === false) return refus('abonnement');
    if (!Array.isArray(c.lignes) || !Number.isFinite(Number(c.n))) return pasSu();
    return dire(200, { ok: true, classement: { periode: c.periode, debut: c.debut, fin: c.fin, n: Number(c.n), inscrit: c.inscrit === true,
      visible: c.visible === true, moi: objet(c.moi), lignes: c.lignes } });
  }
  return dire(400, { ok: false, erreur: 'action', message: 'Action inconnue.' });
}

// « Fermer mon compte » (clé de service) : nombre effacé, 0 si la base n'a pas
// la 018, `null` si la base n'a pas répondu.
export async function effacerCommunaute(owner, SERVICE) {
  if (!UUID_RE.test(String(owner || ''))) return null;
  if (!SERVICE) return null;
  const r = await rpcEquipe('vrm_communaute_effacer', { p_owner: owner }, sbCle(SERVICE));
  if (r.etat === 'absent') return 0;
  if (r.etat !== 'ok') return null;
  const n = Number(r.data);
  return Number.isFinite(n) ? n : null;
}
