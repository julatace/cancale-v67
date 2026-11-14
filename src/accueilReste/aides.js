// ── LES AIDES D'ACCUEIL : visite des écrans, mini-glossaire, conseil du jour (14 nov.) ──
// Julien a validé (« fais tout ») les idées d'accueil 136, 139 et 140. Trois aides,
// chacune DÉSACTIVABLE, PAR COMPTE VRM (une clé synchronisée, la même sur tous ses
// appareils — jamais un drapeau du navigateur seul) :
//   · `visite`    — des bulles posées sur les boutons qui comptent, sur 4 écrans ;
//   · `glossaire` — toucher un mot souligné (« versement », « à retirer », « N° ») l'explique ;
//   · `conseil`   — un conseil par jour pendant 30 jours, dans Ma journée.
// Allumées par défaut pour un compte NEUF (créé il y a moins de 30 jours) ; un compte
// plus ancien, ou une date de création illisible, ne voit ni visite ni conseil (un
// vendeur installé n'est jamais interrompu — « pas su » ne montre rien). Le glossaire,
// lui, ne s'ouvre qu'au toucher : il reste allumé pour tous, sauf s'il le coupe.
// La forme rangée : { v: 1, off: { visite?, glossaire?, conseil? }, vues: { [ecran]: iso },
//   conseil: { jour: 'AAAA-MM-JJ', ferme: true }?, trouveVu: iso? } (« Ce que VRM a trouvé
//   chez toi » rangé, idée 133). Un champ inconnu est ignoré.
// JS pur, sans React : scripts/audit-accueil-reste.cjs l'exécute.

export const CLE_AIDES = 'vrm_aides_accueil';
export const AIDES = Object.freeze(['visite', 'glossaire', 'conseil']);
export const JOURS_NEUF = 30;
const JOUR_MS = 86400000;

export function lireAides(brut) {
  const o = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  const off = {};
  if (o.off && typeof o.off === 'object') for (const a of AIDES) if (o.off[a] === true) off[a] = true;
  const vues = {};
  if (o.vues && typeof o.vues === 'object') for (const [k, v] of Object.entries(o.vues)) if (typeof v === 'string' && /^[a-z_]{2,20}$/.test(k)) vues[k] = v;
  const c = o.conseil && typeof o.conseil === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(o.conseil.jour || '')) ? { jour: o.conseil.jour, ferme: o.conseil.ferme === true } : null;
  const trouveVu = typeof o.trouveVu === 'string' && o.trouveVu ? o.trouveVu : null;
  return { v: 1, off, vues, conseil: c, trouveVu };
}

// Le nombre de jours depuis la création du compte VRM (1 = le jour même), ou null
// (date illisible, ou dans le futur au-delà d'une minute).
export function jourDuCompte(creeLe, maintenant = Date.now()) {
  const t = Date.parse(creeLe || '');
  if (!Number.isFinite(t) || t > maintenant + 60000) return null;
  return Math.floor(Math.max(0, maintenant - t) / JOUR_MS) + 1;
}
export const compteNeuf = (creeLe, maintenant = Date.now()) => { const j = jourDuCompte(creeLe, maintenant); return j != null && j <= JOURS_NEUF; };

// Une aide est-elle allumée pour ce compte ? `exemple` (données inventées) : la visite
// et le glossaire restent (ils montrent l'app), le conseil du jour non.
export function aideActive(reglage, aide, { creeLe, maintenant = Date.now(), exemple = false } = {}) {
  const r = lireAides(reglage);
  if (!AIDES.includes(aide) || r.off[aide]) return false;
  if (aide === 'glossaire') return true;
  if (exemple) return aide === 'visite';
  return compteNeuf(creeLe, maintenant);
}

// Les écritures : chacune rend la NOUVELLE valeur à ranger (jamais une mutation).
export function basculerAide(reglage, aide, allumer) {
  const r = lireAides(reglage);
  if (!AIDES.includes(aide)) return r;
  const off = { ...r.off };
  if (allumer) delete off[aide]; else off[aide] = true;
  return { ...r, off };
}
export const noterVisiteVue = (reglage, ecran, at = new Date().toISOString()) => { const r = lireAides(reglage); return { ...r, vues: { ...r.vues, [ecran]: at } }; };
export const oublierVisites = (reglage) => ({ ...lireAides(reglage), vues: {} });
export const noterTrouveVu = (reglage, at = new Date().toISOString()) => ({ ...lireAides(reglage), trouveVu: at });
export const fermerConseil = (reglage, jour) => ({ ...lireAides(reglage), conseil: { jour, ferme: true } });
