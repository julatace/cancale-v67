// ─────────────────────────────────────────────────────────────────────────────
// LES INFORMATIONS DATÉES REÇUES PAR SMS, SANS IDENTITÉ (9 nov.)
// Vestiaire (« un article Gucci vendu, à expédier avant le lun. 9 nov. ») et Pickup
// (« un colis Vinted au relais X, Pass … ») ne portent AUCUNE identité de vente ou de
// colis : ils ne sont jamais rattachés seuls (§5). Ils vivent dans UNE ligne légère
// du vendeur, `vrm_sms_infos` = { v: 1, infos: { cle: entrée } }, que l'app montre.
//   · une clé par information : Vestiaire = même marque + même jour limite (le rappel
//     met à jour la MÊME entrée) ; Pickup = le jeton du Pass (la seule identité) ;
//   · bornée : 120 entrées, rien de plus vieux que 60 jours ;
//   · une entrée « liée » (`lie`) l'a été par SON clic dans l'app, jamais ici.
// ─────────────────────────────────────────────────────────────────────────────
export const ID_SMS_INFOS = 'vrm_sms_infos';
const MAX = 120, AGE_MAX_MS = 60 * 864e5;

// Rend { data, action } — `data` à écrire, ou null (rien de neuf).
export function fusionInfo(cur, cle, entree, { at, maintenant = Date.now() } = {}) {
  const d = cur && typeof cur === 'object' ? cur : {};
  const infos = { ...(d.infos && typeof d.infos === 'object' ? d.infos : {}) };
  const prev = infos[cle];
  const n = prev
    ? { ...prev, ...Object.fromEntries(Object.entries(entree).filter(([, v]) => v != null && v !== '')), premiere: prev.premiere || at, derniere: [prev.derniere, at].filter(Boolean).sort().pop(), n: (prev.n || 1) + 1,
        formes: [...new Set([...(prev.formes || []), ...(entree.forme ? [entree.forme] : [])])] }
    : { ...entree, premiere: at, derniere: at, n: 1, formes: entree.forme ? [entree.forme] : [] };
  delete n.forme;
  if (prev && prev.lie) n.lie = prev.lie;          // une liaison faite par SON clic n'est jamais défaite ici
  infos[cle] = n;
  // Bornes : les plus vieilles tombent.
  for (const k of Object.keys(infos)) if (Date.parse(infos[k].derniere || '') < maintenant - AGE_MAX_MS) delete infos[k];
  const cles = Object.keys(infos);
  if (cles.length > MAX) cles.sort((a, b) => String(infos[a].derniere).localeCompare(String(infos[b].derniere))).slice(0, cles.length - MAX).forEach((k) => delete infos[k]);
  return { data: { ...d, v: 1, infos }, action: prev ? 'mis-a-jour' : 'range' };
}
