// ═══════════════════════════════════════════════════════════════════════════
// LES PLANTAGES DE TOUS LES COMPTES, TRIÉS PAR FRÉQUENCE (11 nov., lot agent2-veille)
// ═══════════════════════════════════════════════════════════════════════════
// Le journal des plantages (src/plantages.js) range chaque erreur au nom du vendeur
// (`plantage_{empreinte}`, sans donnée personnelle : message nettoyé, écran,
// version, navigateur en deux mots). Le panneau du propriétaire ne montrait que les
// alertes ANONYMES par jour (`plantages_terrain_*`) : impossible de voir qu'une même
// erreur touche douze comptes cette semaine.
// Ici (`/api/compte?mode=mesures&quoi=plantages-comptes`, PROPRIÉTAIRE seul, la garde
// de `listerMesures`) : les 7 derniers jours, regroupés par TYPE (la clé de la veille,
// `regrouper`), triés par nombre de COMPTES touchés puis de fois. Lecture PROJETÉE
// (jamais `select=data`), paginée par `Range` avec un ordre total ; une page ratée ⇒
// `null` (« pas su », jamais une liste partielle). AUCUN identifiant de vendeur ne
// sort : un nombre de comptes.
// ═══════════════════════════════════════════════════════════════════════════
import { sbCle } from './cle.js';
import { regrouper, estBruit, cleType } from './veille-plantages.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';

export const JOURS_COMPTES = 7;
export const TYPES_MAX = 50;
const PAGE = 1000, PAGES_MAX = 20;
const cfg = (env) => ({ url: env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co', service: env.SUPABASE_SERVICE_KEY || '' });

export function plantagesParComptes(lignes, depuis) {
  const fois = new Map();
  const groupes = regrouper((lignes || []).filter((l) => l && String(l.owner || '') !== PROPRIETAIRE_NEUTRE), depuis);
  // « fois » : le nombre de fois vu sur chaque appareil (`nAppareil`), au moins 1 par ligne.
  for (const l of lignes || []) {
    if (!l || estBruit(l) || String(l.owner || '') === PROPRIETAIRE_NEUTRE || !((Date.parse(l.at || '') || 0) >= depuis)) continue;
    const k = cleType(l.message);
    fois.set(k, (fois.get(k) || 0) + Math.max(1, Number(l.n) || 1));
  }
  return groupes.map((g) => ({
    cle: g.cle, message: g.message, comptes: g.vendeurs.size, fois: fois.get(g.cle) || g.n,
    ecrans: [...g.ecrans].slice(0, 5), appareils: [...g.appareils].slice(0, 5), dernier: new Date(g.dernier).toISOString(),
  })).sort((a, b) => b.comptes - a.comptes || b.fois - a.fois || b.dernier.localeCompare(a.dernier)).slice(0, TYPES_MAX);
}

export async function listerPlantagesComptes({ env = process.env, fetcher = fetch, maintenant = Date.now() } = {}) {
  const { url, service } = cfg(env);
  if (!service) return null;
  const depuis = maintenant - JOURS_COMPTES * 864e5;
  const chemin = `app_data?id=like.plantage_*&meta->>at=gte.${encodeURIComponent(new Date(depuis).toISOString())}&select=owner,message:data->>message,ecran:data->>ecran,origine:data->>origine,navigateur:data->>navigateur,n:data->>nAppareil,at:meta->>at&order=owner.asc,id.asc`;
  const lignes = [];
  for (let p = 0; p < PAGES_MAX; p++) {
    let r;
    try { r = await fetcher(`${url}/rest/v1/${chemin}`, { headers: { ...sbCle(service), 'Range-Unit': 'items', Range: `${p * PAGE}-${(p + 1) * PAGE - 1}` } }); } catch (_) { return null; }
    if (!r || !r.ok) return null;
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return null;
    lignes.push(...j);
    if (j.length < PAGE) return plantagesParComptes(lignes, depuis);
  }
  return null;   // plus de 20 000 lignes : on ne présente pas une partie comme le tout
}
