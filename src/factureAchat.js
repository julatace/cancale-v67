// ── UNE FACTURE D'ACHAT JOINTE À UN ACHAT (10 nov., lot AN) ──────────────────
// Julien (9 nov.) : « je veux que l'on puisse, si on veut, mettre une facture
// d'achat qui ne provient pas de Vinted » (quand on relie / saisit un achat).
//
// OÙ ELLE VIT, ET POURQUOI : une ligne `app_data` PAR facture,
// `achat_facture_{tx|hors}_{identité}`, écrite avec `withOwner` (owner = la session).
//   · Le cloisonnement est celui de TOUTE la base : migration 021 (RLS, politiques
//     restrictives — un vendeur ne lit, n'écrit, ne modifie ni ne vide que SES
//     lignes ; anonyme fermé), la restriction d'abonnement (027 : sans abonnement,
//     rien ne s'écrit), le mode équipe (016) ne laisse lire QUE sa liste blanche
//     d'`id` (bordereaux, colis) — `achat_facture_*` n'y est pas. Exécuté sur un
//     PostgreSQL jetable : scripts/audit-factures-achat.cjs.
//   · Aucune migration, aucun nouveau compartiment, aucune fonction `api/` (12 au
//     plus) : c'est déjà ainsi que vivent la photo d'un achat hors plateforme
//     (`achat_hors_photo_*`) et les PDF des bordereaux. La suppression de compte
//     (api/_lib/effacer-compte.js) efface déjà toutes les lignes du vendeur.
//   · Le poids : une facture = SA ligne, lue par son `id` seulement au toucher ;
//     la liste ne projette que des scalaires (nom, type, taille, date) — jamais
//     `select=data`, jamais `b64` (§4.4).
// L'IDENTITÉ : le n° de transaction Vinted (`tx`), ou l'`id` de l'achat saisi hors
// plateforme (`hors`) — jamais un titre (§5).
// Une facture « retirée » : la ligne est VIDÉE (`b64: null, supprime: true`) — un
// DELETE sur app_data ne supprime rien (règle de la base, comme la photo hors).

export const PREFIXE_FACTURE = 'achat_facture_';
export const MAX_OCTETS = 4 * 1024 * 1024;          // 4 Mo avant compression (une photo de téléphone)
export const MAX_DATAURL = 3 * 1024 * 1024;         // ce qui part en base (~2,2 Mo d'octets)
export const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const propre = (x) => String(x == null ? '' : x).replace(/[^\w-]/g, '').slice(0, 64);
// La clé d'un achat : { genre: 'tx'|'hors', id }. Rend '' si l'identité manque.
export function cleFacture(genre, id) {
  const g = genre === 'hors' ? 'hors' : genre === 'tx' ? 'tx' : '';
  const i = propre(id);
  return g && i ? `${g}_${i}` : '';
}
export const idLigneFacture = (cle) => (cle ? PREFIXE_FACTURE + cle : '');

// Le fichier choisi est-il une facture acceptable ? { ok, raison, genre: 'pdf'|'image' }.
export function verifierFichier({ type = '', taille = 0, nom = '' } = {}) {
  const t = String(type || '').toLowerCase();
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(String(nom || '')) || [])[1] || '';
  const pdf = t === 'application/pdf' || (!t && /^pdf$/i.test(ext));
  const image = /^image\/(jpeg|png|webp|heic|heif)$/.test(t) || (!t && /^(jpe?g|png|webp|heic|heif)$/i.test(ext));
  if (!pdf && !image) return { ok: false, raison: 'type', message: 'Un PDF ou une photo seulement.' };
  if (!(taille > 0)) return { ok: false, raison: 'vide', message: 'Fichier vide.' };
  if (taille > MAX_OCTETS) return { ok: false, raison: 'taille', message: 'Fichier trop lourd (4 Mo au plus).' };
  return { ok: true, genre: pdf ? 'pdf' : 'image' };
}
// Le contenu prêt à partir : un PDF commence par « %PDF », une image est un data URL d'image.
export function contenuValide(dataUrl, genre) {
  const s = String(dataUrl || '');
  if (!s || s.length > MAX_DATAURL) return false;
  if (genre === 'pdf') return /^data:application\/pdf;base64,JVBER/.test(s);
  return /^data:image\/(jpeg|png|webp);base64,/.test(s);
}

// Écrit la facture d'UN achat. Rend true seulement si la base l'a acceptée.
export async function ecrireFacture({ cle, dataUrl, genre, nom, taille }, { fetch: f, url, auth, withOwner, conflit }) {
  if (!cle || !contenuValide(dataUrl, genre)) return false;
  const data = { b64: dataUrl, type: genre === 'pdf' ? 'pdf' : 'image', nom: String(nom || '').slice(0, 120), taille: Number(taille) || dataUrl.length, at: new Date().toISOString() };
  try {
    const r = await f(`${url}/rest/v1/app_data?on_conflict=${conflit}`, {
      method: 'POST', headers: auth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([withOwner({ id: idLigneFacture(cle), data })]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
}
export async function retirerFacture(cle, { fetch: f, url, auth, withOwner, conflit }) {
  if (!cle) return false;
  try {
    const r = await f(`${url}/rest/v1/app_data?on_conflict=${conflit}`, {
      method: 'POST', headers: auth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([withOwner({ id: idLigneFacture(cle), data: { b64: null, supprime: true, at: new Date().toISOString() } })]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
}
// La LISTE (sans le contenu) : { cle → { type, nom, taille, at } } ; null = pas su.
export const SELECT_LISTE = 'id,type:data->>type,nom:data->>nom,taille:data->>taille,at:data->>at,supprime:data->>supprime';
export async function lireFactures({ fetch: f, url, auth, owner = '' }) {
  try {
    const o = owner ? `&owner=eq.${encodeURIComponent(owner)}` : '';
    const r = await f(`${url}/rest/v1/app_data?id=like.${PREFIXE_FACTURE}*${o}&select=${SELECT_LISTE}`, { headers: auth() });
    if (!r || !r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const m = {};
    for (const x of rows) {
      if (!x || typeof x.id !== 'string' || !x.id.startsWith(PREFIXE_FACTURE)) continue;
      if (x.supprime === 'true' || x.supprime === true || !(x.type === 'pdf' || x.type === 'image')) continue;
      m[x.id.slice(PREFIXE_FACTURE.length)] = { type: x.type, nom: x.nom || '', taille: Number(x.taille) || null, at: x.at || '' };
    }
    return m;
  } catch (_) { return null; }
}
// Le CONTENU d'une facture, lu par son id au toucher. Rend le data URL, null (pas su / absente).
export async function lireContenuFacture(cle, { fetch: f, url, auth, owner = '' }) {
  if (!cle) return null;
  try {
    const o = owner ? `&owner=eq.${encodeURIComponent(owner)}` : '';
    const r = await f(`${url}/rest/v1/app_data?id=eq.${idLigneFacture(cle)}${o}&select=b64:data->>b64,type:data->>type`, { headers: auth() });
    if (!r || !r.ok) return null;
    const rows = await r.json();
    const x = Array.isArray(rows) ? rows[0] : null;
    if (!x || !contenuValide(x.b64, x.type === 'pdf' ? 'pdf' : 'image')) return null;
    return x.b64;
  } catch (_) { return null; }
}
// Pour l'export comptable : la mention d'une ligne du registre (`l.id` = « tx » Vinted ou « hors:id »).
// (11 nov.) La clé de la facture d'une ligne du registre : la même pour la mention et pour le zip.
export function cleFactureLigne(ligne) {
  if (!ligne) return '';
  const id = String(ligne.id || '');
  return id.startsWith('hors:') ? cleFacture('hors', id.slice(5)) : cleFacture('tx', ligne.reference || '');
}
export function mentionFacture(ligne, factures) {
  if (!ligne || !factures) return '';
  const cle = cleFactureLigne(ligne);
  const f = cle ? factures[cle] : null;
  return f ? `facture jointe${f.nom ? ` (${f.nom})` : ''}` : '';
}
