// K1 : mémoire du gel, distincte des preuves autorisant un retrait automatique.
// Les lectures/écritures sont injectées : mêmes règles dans l'app et les mocks.
import { cleNum } from '../api/_lib/numerotation.js';

export const ACTIVATION_K1 = 'vrm_vinted_publication_activation';
export const JOUR_K1 = 86400000;
const objet = v => !!v && typeof v === 'object' && !Array.isArray(v);
const identifiant = v => /^\d+$/.test(String(v || ''));
const retour = o => /annul|cancel|refus|rembours|retour|suspend|[ée]chou/i.test(String(o.status || '')) || o.transaction_user_status === 'failed';

// Aucune disparition de la capture, ni aucun délai, ne résout une vente.
export function calculerGelK1({ precedent = {}, activation, uid, ventes, transactions, bordereaux, liens = {}, maintenant }) {
  const pending = objet(precedent.pending) ? { ...precedent.pending } : {};
  const anciens = objet(precedent.anciens) ? { ...precedent.anciens } : {};
  const connues = new Map((Array.isArray(ventes) ? ventes : []).filter(o => o && identifiant(o.transaction_id)).map(o => [String(o.transaction_id), o]));
  const identites = new Map(Object.entries(objet(precedent.identites) ? precedent.identites : {}));
  const ambiguites = objet(precedent.ambiguites) ? { ...precedent.ambiguites } : {};
  const poserIdentite = (tx, ids) => {
    const avant = identites.get(tx) || [];
    if (avant.length && !ids.some(id => avant.includes(id))) ambiguites[tx] = true;
    identites.set(tx, [...new Set([...avant, ...ids])]);
  };
  for (const r of transactions || []) {
    const m = /^harvest_(\d+)_txn_(\d+)$/.exec(String(r.id || ''));
    if (m && m[1] === uid && !connues.has(m[2]) && retour({ status: r.ti })) {
      identites.delete(m[2]); delete ambiguites[m[2]]; delete pending[m[2]]; delete anciens[m[2]]; continue;
    }
    if (m && m[1] === uid && identifiant(r.it) && (String(r.ti || '').trim() || connues.has(m[2]) || pending[m[2]])) poserIdentite(m[2], [String(r.it)]);
  }
  for (const r of bordereaux || []) {
    const m = /^harvest_(\d+)_label_(\d+)$/.exec(String(r.id || ''));
    if (!m || m[1] !== uid || (r.tx != null && String(r.tx) !== m[2])) continue;
    const ids = [r.it, ...(Array.isArray(r.items) ? r.items.map(x => objet(x) ? x.id || x.item_id : x) : [])].filter(identifiant).map(String);
    if (ids.length) poserIdentite(m[2], [...new Set(ids)]);
  }
  for (const [tx, o] of connues) {
    if (retour(o)) { delete pending[tx]; delete anciens[tx]; continue; }
    // État vide : pas su, même si la ligne dit transaction_user_status=seller.
    const at = Date.parse(o.date || '');
    const v = { uid, tx, date: o.date || null, depuis: pending[tx]?.depuis || maintenant, conv: o.conversation_id == null ? '' : String(o.conversation_id), statut: String(o.status || '') };
    if (Number.isFinite(at) && at < activation - 30 * JOUR_K1 && !pending[tx]) anciens[tx] = v;
    else pending[tx] = v;
  }
  const probables = new Set(), manuels = new Set();
  for (const registre of [pending, anciens]) for (const tx of Object.keys(registre)) {
    const o = connues.get(tx);
    const ids = identites.get(tx);
    const lien = liens[uid + ':' + tx];
    // Le lien posé est une identité, pas un état de vente. Il ne nourrit
    // que la garde de publication ; jamais la liste de retrait automatique.
    if (objet(lien) && lien.uid === uid && lien.tx === tx && identifiant(lien.itemId) && cleNum(lien.numero) && Number.isFinite(lien.at)) {
      manuels.add(String(lien.itemId)); delete registre[tx];
    } else if (ids?.length && !ambiguites[tx]) {
      ids.forEach(id => probables.add(id)); delete registre[tx];
    } else if (o && retour(o)) delete registre[tx];
  }
  // Une identité rangée après disparition de la vente reste probable.
  for (const ids of identites.values()) for (const id of ids) probables.add(id);
  for (const o of connues.values()) if (retour(o)) {
    for (const id of identites.get(String(o.transaction_id)) || []) probables.delete(id);
  }
  for (const lien of Object.values(liens)) if (objet(lien) && lien.uid === uid && identifiant(lien.itemId) && !retour(connues.get(lien.tx) || {})) manuels.add(String(lien.itemId));
  return { pending, anciens, identites: Object.fromEntries(identites), ambiguites, probables: [...probables], manuels: [...manuels], cap: precedent.cap || null };
}

// L'ancre est créée une seule fois et relue même si un autre appareil l'a
// créée en même temps. Une lecture ratée interdit toute création de repli.
export async function activationK1(store, maintenant) {
  let r = await store.lire(ACTIVATION_K1);
  if (r === undefined) return undefined;
  if (r === null) {
    if (!await store.creer(ACTIVATION_K1, { at: maintenant })) return undefined;
    r = await store.lire(ACTIVATION_K1);
  }
  return objet(r?.data) && Number.isFinite(r.data.at) ? r.data.at : undefined;
}

export async function memoriserGelK1({ store, activation, uid, sources, maintenant, liens, essai = 0 }) {
  const id = 'vrm_vinted_publication_' + uid;
  const lu = await store.lire(id);
  if (lu === undefined || !Number.isFinite(activation) || !sources) return { ...(lu?.data || {}), inconnu: true };
  const ligne = sources.ordres.find(r => r.id === `harvest_${uid}_orders_sold`);
  if (!ligne || !Array.isArray(ligne.v)) return { ...(lu?.data || {}), inconnu: true };
  if (lu && (!objet(lu.data) || !objet(lu.data.pending) || !objet(lu.data.anciens))) return { inconnu: true };
  const cap = Date.parse(ligne.cap || '');
  if (!Number.isFinite(cap) || (lu?.data.cap && cap < lu.data.cap)) return { ...(lu?.data || {}), inconnu: true };
  const next = calculerGelK1({ precedent: lu?.data, activation, uid, ventes: ligne.v, transactions: sources.transactions, bordereaux: sources.bordereaux, liens, maintenant });
  next.cap = cap;
  if (JSON.stringify(next) === JSON.stringify(lu?.data)) return { ...next, inconnu: false };
  const ok = lu ? await store.remplacer(id, next, lu.updated_at) : await store.creer(id, next);
  // Une création concurrente peut avoir été ignorée. Seul ce qui a été
  // réellement relu est utilisable, jamais le candidat local non enregistré.
  const relu = ok ? await store.lire(id) : undefined;
  if (!relu || JSON.stringify(relu.data) !== JSON.stringify(next)) {
    if (essai === 0) return memoriserGelK1({ store, activation, uid, sources, maintenant, liens, essai: 1 });
    return { ...(lu?.data || next), inconnu: true };
  }
  return { ...next, inconnu: false };
}

export function gardePublicationK1({ etats, fiches, pairId, numero, noms = {}, marqueurLu }) {
  if (!marqueurLu) return { k: 'gel-pas-su', t: 'Je n’ai pas pu relire la numérotation : rien ne sera publié ni programmé.' };
  const n = cleNum(numero);
  const ids = Object.keys(fiches || {}).filter(id => cleNum(fiches[id]?.numero) === n && n);
  if (ids.length > 1) return { k: 'numero-ambigu', t: `Le N°${n} désigne plusieurs fiches — vérifie le carton avant de publier.` };
  const id = pairId ? String(pairId) : ids[0];
  if (pairId && n && (!fiches[id] || cleNum(fiches[id].numero) !== n)) return { k: 'numero-ambigu', t: 'Le numéro de cette fiche a changé — rouvre la paire avant de publier.' };
  const uid = String(fiches?.[id]?.accountId || '');
  // Une annonce entièrement libre sans identité ne permet aucune décision.
  // Un N° seul ne doit pas servir à contourner un compte d'origine inconnu.
  if (!uid) return n || id ? { k: 'gel-pas-su', t: 'Je n’ai pas pu identifier le compte Vinted d’origine de cette paire — rien ne sera publié ni programmé.' } : null;
  const e = etats?.[uid];
  if (!e || e.inconnu) return { k: 'gel-pas-su', t: `Je n’ai pas pu vérifier les ventes de ${noms[uid] || uid} — rien ne sera publié ni programmé pour ce compte.` };
  const p = Object.values(e.pending || {});
  if (p.length) return { k: 'compte-gele', t: `${p.length} vente${p.length > 1 ? 's' : ''} de ${noms[uid] || uid} n’est pas encore reliée à une paire — relie-la dans la liste ci-dessous pour publier les paires de ce compte.` };
  if ((e.probables || []).includes(id) || (e.manuels || []).includes(id)) return { k: 'vente-probable', t: `La paire N°${n} est liée à une vente Vinted — rien ne sera publié ni programmé.` };
  return null;
}
