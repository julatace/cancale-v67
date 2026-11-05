// ── LE FREIN DU RELAIS VINTED, CÔTÉ SERVEUR (5 novembre) ─────────────────────
// `src/freinRelaisVinted.js` freine le relais `/api/vinted-proxy` par compte,
// mais compté sur CHAQUE appareil : un ordinateur, un iPhone et un iPad font
// trois réserves. Le relais part de l'adresse du SERVEUR de VRM (le motif que
// le journal accuse d'avoir fait bloquer un compte, §3) : la réserve doit être
// celle du COMPTE, tous appareils confondus. Ici, la même règle (la même
// fonction `prendrePlaceRelais`, mêmes fenêtre et plafond) tenue dans une ligne
// `app_data` du vendeur, `vrm_frein_relais_{uid}`, écrite AVEC SA SESSION (RLS),
// en comparer-et-échanger sur `data.rev` (deux appareils en même temps ne
// prennent jamais la même place deux fois).
//
// « Pas su » ne vaut pas « oui » : lecture ratée, écriture refusée ou
// concurrence qui ne se règle pas en trois essais ⇒ RIEN ne part vers Vinted.
import { prendrePlaceRelais } from '../../src/freinRelaisVinted.js';

export const idFreinRelais = (uid) => `vrm_frein_relais_${String(uid)}`;

// `io` : { lire(chemin) → tableau | null, inserer(ligne) → 1 | 0 (déjà là) | null,
//          modifier(chemin, corps) → nombre de lignes | null }.
export async function prendrePlaceServeur(io, owner, uid, maintenant) {
  const k = String(uid || '');
  if (!/^\d{1,20}$/.test(k) || !owner) return { ok: false, raison: 'compte' };
  const id = idFreinRelais(k);
  const filtre = `id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}`;
  for (let essai = 0; essai < 3; essai++) {
    const lignes = await io.lire(`app_data?select=rev:data->>rev,t:data->t&${filtre}&limit=1`);
    if (!Array.isArray(lignes)) return { ok: false, raison: 'base' };
    const ligne = lignes[0] || null;
    const avant = ligne && Array.isArray(ligne.t) ? ligne.t : [];
    let apres = null;
    const stock = {
      getItem: () => JSON.stringify({ [k]: avant }),
      setItem: (_, v) => { apres = (JSON.parse(v) || {})[k] || []; },
    };
    const place = prendrePlaceRelais(k, maintenant, stock);
    if (!place.ok) return { ok: false, raison: 'frein', resteMs: place.resteMs };
    if (!Array.isArray(apres)) return { ok: false, raison: 'base' };
    const horodatage = new Date(maintenant).toISOString();
    if (!ligne) {
      const n = await io.inserer({ id, owner, data: { rev: 1, t: apres }, updated_at: horodatage });
      if (n === 1) return { ok: true };
      if (n === null) return { ok: false, raison: 'base' };
      continue; // un autre appareil vient de la créer : on relit
    }
    const rev = ligne.rev == null || ligne.rev === '' ? null : String(ligne.rev);
    const garde = rev === null ? 'data->>rev=is.null' : `data->>rev=eq.${encodeURIComponent(rev)}`;
    const n = await io.modifier(`app_data?${filtre}&${garde}&select=id`, { data: { rev: (Number(rev) || 0) + 1, t: apres }, updated_at: horodatage });
    if (n === 1) return { ok: true };
    if (n === null) return { ok: false, raison: 'base' };
    // n === 0 : un autre appareil a écrit entre la lecture et l'écriture : on relit
  }
  return { ok: false, raison: 'concurrence' };
}
