// ══════════════════════════════════════════════════════════════════════════════
//  LE CERTIFICAT D'AUTHENTICITÉ D'UNE PAIRE (14 nov., proposition 106)
// ══════════════════════════════════════════════════════════════════════════════
// Il range le certificat (PDF ou photo : Legit Check, CheckCheck, facture d'origine…)
// AVEC sa paire, pour l'envoyer à un acheteur qui le demande.
//
// OÙ IL VIT, ET POURQUOI (mesuré : c'est déjà ainsi que vivent la facture d'un achat
// `achat_facture_*`, la photo du carton `colis_photo_*`, le studio `studio_photos_*`) :
//   · UNE ligne `app_data` PAR paire : `certificat_paire_{n|a}_{identité}`, écrite avec
//     `withOwner` (owner = la session ; RLS 021 : un vendeur ne lit et n'écrit que SES
//     lignes ; 027 : sans abonnement rien ne s'écrit). Aucun compartiment, aucune
//     migration, aucune fonction `api/` (12 au plus). La suppression de compte efface
//     déjà toutes les lignes du vendeur. Le mode équipe (016) ne lit que sa liste
//     blanche d'`id` : `certificat_paire_*` n'y est pas ;
//   · LE POIDS (§4.4) : la liste ne projette que des scalaires (nom, type, taille,
//     date) ; le contenu n'est lu que par SON id, au toucher (« Voir », « Envoyer ») ;
//     le même plafond que la facture d'achat : 4 Mo choisis, ~2,2 Mo rangés ;
//   · L'IDENTITÉ (§5) : le N° de rangement (`n_<clé N°>` : il est écrit sur le carton et
//     ne se redonne jamais) ; une paire pas encore numérotée : son annonce Vinted
//     (`a_<id>`). Jamais un titre. Aucune identité ⇒ aucun bouton ;
//   · ENVOYER : aucun lien public n'existe dans VRM (mesuré : aucune route de partage
//     expirant) ; on n'en crée pas un (un lien public vers un fichier privé, sur un
//     dépôt public, n'est pas à faire en passant). Le téléphone l'envoie lui-même : la
//     feuille de partage du système (Messages, WhatsApp, e-mail…) quand elle prend un
//     fichier, sinon le téléchargement ;
//   · « Retirer » VIDE la ligne (`b64: null, supprime: true`) : un DELETE sur app_data ne
//     supprime rien (règle de la base, comme la facture).
// ══════════════════════════════════════════════════════════════════════════════

export const PREFIXE_CERTIFICAT = 'certificat_paire_';
export const MAX_OCTETS = 4 * 1024 * 1024;
export const MAX_DATAURL = 3 * 1024 * 1024;
export const COTE_IMAGE = 1800;

const cleDefaut = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
// La clé d'une paire : { numero, itemId }. '' si aucune identité.
export function cleCertificat(paire, cleNum = cleDefaut) {
  const p = paire || {};
  const n = p.numero == null ? '' : cleNum(p.numero);
  if (n && /^[0-9A-Z]{1,12}$/.test(n)) return 'n_' + n;
  const a = String(p.itemId == null ? '' : p.itemId).trim();
  return /^\d{3,20}$/.test(a) ? 'a_' + a : '';
}
export const idLigneCertificat = (cle) => (cle ? PREFIXE_CERTIFICAT + cle : '');

export function verifierFichier({ type = '', taille = 0, nom = '' } = {}) {
  const t = String(type || '').toLowerCase();
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(String(nom || '')) || [])[1] || '';
  const pdf = t === 'application/pdf' || (!t && /^pdf$/i.test(ext));
  const image = /^image\/(jpeg|png|webp|heic|heif)$/.test(t) || (!t && /^(jpe?g|png|webp|heic|heif)$/i.test(ext));
  if (!pdf && !image) return { ok: false, raison: 'type' };
  if (!(taille > 0)) return { ok: false, raison: 'vide' };
  if (taille > MAX_OCTETS) return { ok: false, raison: 'taille' };
  return { ok: true, genre: pdf ? 'pdf' : 'image' };
}
export function contenuValide(dataUrl, genre) {
  const s = String(dataUrl || '');
  if (!s || s.length > MAX_DATAURL) return false;
  if (genre === 'pdf') return /^data:application\/pdf;base64,JVBER/.test(s);
  return /^data:image\/(jpeg|png|webp);base64,/.test(s);
}

const POST = (base, corps) => base.fetch(`${base.url}/rest/v1/app_data?on_conflict=${base.conflit}`, {
  method: 'POST', headers: base.auth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify([base.withOwner(corps)]) });
export async function ecrireCertificat({ cle, dataUrl, genre, nom, taille, numero }, base) {
  if (!cle || !contenuValide(dataUrl, genre)) return false;
  const data = { b64: dataUrl, type: genre === 'pdf' ? 'pdf' : 'image', nom: String(nom || '').slice(0, 120), taille: Number(taille) || dataUrl.length, numero: numero == null ? null : String(numero), at: new Date().toISOString() };
  try { const r = await POST(base, { id: idLigneCertificat(cle), data }); return !!(r && r.ok); } catch (_) { return false; }
}
export async function retirerCertificat(cle, base) {
  if (!cle) return false;
  try { const r = await POST(base, { id: idLigneCertificat(cle), data: { b64: null, supprime: true, at: new Date().toISOString() } }); return !!(r && r.ok); } catch (_) { return false; }
}
// Ce qu'il y a pour ces clés (sans le contenu) : { cle → { type, nom, taille, at } } — une
// clé absente = lu : aucun certificat ; null = PAS SU (la base n'a pas répondu).
export const SELECT_CERTIFICAT = 'id,type:data->>type,nom:data->>nom,taille:data->>taille,at:data->>at,supprime:data->>supprime';
export async function lireCertificats(cles, base) {
  const ids = [...new Set((cles || []).filter(Boolean).map(idLigneCertificat))];
  if (!ids.length) return {};
  try {
    const o = base.owner ? `&owner=eq.${encodeURIComponent(base.owner)}` : '';
    const r = await base.fetch(`${base.url}/rest/v1/app_data?id=in.(${ids.map(encodeURIComponent).join(',')})${o}&select=${SELECT_CERTIFICAT}`, { headers: base.auth() });
    if (!r || !r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const m = {};
    for (const x of rows) {
      if (!x || typeof x.id !== 'string' || !x.id.startsWith(PREFIXE_CERTIFICAT)) continue;
      if (x.supprime === 'true' || x.supprime === true || !(x.type === 'pdf' || x.type === 'image')) continue;
      m[x.id.slice(PREFIXE_CERTIFICAT.length)] = { type: x.type, nom: x.nom || '', taille: Number(x.taille) || null, at: x.at || '' };
    }
    return m;
  } catch (_) { return null; }
}
export async function lireContenuCertificat(cle, base) {
  if (!cle) return null;
  try {
    const o = base.owner ? `&owner=eq.${encodeURIComponent(base.owner)}` : '';
    const r = await base.fetch(`${base.url}/rest/v1/app_data?id=eq.${encodeURIComponent(idLigneCertificat(cle))}${o}&select=b64:data->>b64,type:data->>type,nom:data->>nom`, { headers: base.auth() });
    if (!r || !r.ok) return null;
    const rows = await r.json();
    const x = Array.isArray(rows) ? rows[0] : null;
    if (!x || !contenuValide(x.b64, x.type === 'pdf' ? 'pdf' : 'image')) return null;
    return { b64: x.b64, type: x.type, nom: x.nom || '' };
  } catch (_) { return null; }
}
// Le nom du fichier qu'il envoie : « Certificat-N124.pdf » (jamais le nom d'un acheteur).
export function nomFichierCertificat(cle, type) {
  const id = String(cle || '').replace(/^n_/, 'N').replace(/^a_/, 'annonce-');
  return `Certificat-${id || 'paire'}.${type === 'pdf' ? 'pdf' : 'jpg'}`;
}
// data: URL → Blob (pour la feuille de partage ou le téléchargement).
export function blobDeDataUrl(dataUrl) {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const bin = atob(m[2]); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: m[1] });
}
