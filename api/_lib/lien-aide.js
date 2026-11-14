// ═══════════════════════════════════════════════════════════════════════════
// LE LIEN TEMPORAIRE POUR TON AIDE (14 nov., lot 120) — en attendant le mode équipe
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Lien temporaire pour ton aide (24 h, colis seulement). » Le mode
// équipe (migration 016) n'est pas appliqué : ce lien NE LA DEMANDE PAS. Il ne
// donne accès à aucune ligne de la base — il porte une PHOTO de ses colis, prise
// par SON app, filtrée ici par une LISTE BLANCHE (la projection du mode équipe :
// colis à expédier, colis à retirer, codes de retrait, bordereaux ; AUCUN montant,
// aucun compte, aucun message, aucun réglage).
//
//   · SIGNÉ : `id.exp.sig`, sig = HMAC(clé du serveur, id + vendeur + exp). Un id
//     au hasard (128 bits) ; changer une lettre, l'expiration ou le vendeur ⇒ refusé.
//   · 24 h, fixe : l'expiration est posée par le serveur, jamais par la requête.
//   · RÉVOCABLE : « Couper le lien » marque la ligne `revoque` — la page suivante
//     de l'aide répond 404 (aucun cache : relu à chaque ouverture).
//   · LECTURE SEULE : la route publique ne fait que LIRE (la photo, un bordereau
//     de la liste) ; aucune action, aucune écriture hors du journal du lien.
//   · JOURNALISÉ : chaque ouverture et chaque bordereau imprimé sont notés sur la
//     ligne du lien (heure, quoi, navigateur en 40 caractères) — le vendeur les voit.
//   · Invalide, expiré, révoqué, inconnu : TOUS 404 (rien ne dit lequel).
// Ligne : `lien_aide_{id}` au nom du VENDEUR (owner) — écrite par la clé de service
// depuis api/compte.js?mode=lien-aide (aucune 13ᵉ fonction).
// La projection (`projectionLienAide`) est la MÊME fonction dans l'app (qui la
// fabrique depuis la photo de Ma journée, src/journeeHorsLigne.js) et ici (qui la
// refiltre : on ne fait jamais confiance au corps). Audit : scripts/audit-confort-securite.cjs.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const LIEN_DUREE_MS = 24 * 3600000;
export const PREFIXE_LIEN = 'lien_aide_';
export const LIENS_ACTIFS_MAX = 3;
const MAX_LIGNES = 80, MAX_JOURNAL = 50;
const ID_OK = /^[A-Za-z0-9_-]{22}$/;
const PDF_OK = /^(email_bord_\d{4,20}|harvest_\d{1,20}_label_\d{4,20})$/;
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const egal = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

// Un montant ne passe JAMAIS, même glissé dans un titre (« Air Max 90 € »).
const SANS_MONTANT = /(?:\d[\d\s.,]*\s?(?:€|eur\b|euros?\b|\$|£))|(?:(?:€|\$|£)\s?\d[\d\s.,]*)/gi;
const txt = (v, n = 90) => String(v == null ? '' : v).replace(SANS_MONTANT, '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const jour = (j) => (/^\d{4}-\d{2}-\d{2}$/.test(String(j || '').slice(0, 10)) ? String(j).slice(0, 10) : '');
const heure = (h) => (/^\d{2}:\d{2}$/.test(String(h || '')) ? String(h) : '');
const qr = (q) => { const t = String(q || ''); return /^https:\/\/[^\s<>"']{4,1500}$/i.test(t) ? t : ''; };
const code = (c) => String(c == null ? '' : c).replace(/[^A-Za-z0-9 -]/g, '').trim().slice(0, 16);

// LA PROJECTION — liste blanche, champ par champ. Rien d'autre ne sort.
export function projectionLienAide(photo, maintenant = Date.now()) {
  const p = photo && typeof photo === 'object' ? photo : {};
  const envoyer = (Array.isArray(p.envoyer) ? p.envoyer : []).slice(0, MAX_LIGNES).map((e) => ({
    numero: txt(e && e.numero, 12), titre: txt(e && e.titre), limite: jour(e && (e.jour || e.limite)), heure: heure(e && e.heure),
    plateforme: e && e.plateforme === 'ebay' ? 'ebay' : 'vinted', transporteur: txt(e && (e.trNom || e.transporteur), 30),
    pdf: (Array.isArray(e && e.pdf) ? e.pdf : []).map(String).filter((r) => PDF_OK.test(r)).slice(0, 2),
  }));
  const retirer = (Array.isArray(p.retirer) ? p.retirer : []).slice(0, MAX_LIGNES).map((r) => ({
    titre: txt(r && r.titre), lieu: txt(r && r.lieu, 120), code: code(r && r.code), qr: qr(r && r.qr),
    transporteur: txt(r && r.transporteur, 30), limite: jour(r && r.limite), suivi: String((r && r.suivi) || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40),
  }));
  const at = Number.isFinite(p.at) ? p.at : maintenant;
  return { v: 1, at, envoyer, retirer, nEnvoyer: Number.isFinite(p.nEnvoyer) ? p.nEnvoyer : envoyer.length, nRetirer: Number.isFinite(p.nRetirer) ? p.nRetirer : retirer.length };
}

// ── LE LIEN SIGNÉ ───────────────────────────────────────────────────────────
const signer = (cle, id, owner, exp) => b64u(createHmac('sha256', cle).update(`${id}.${owner}.${exp}`).digest());
export const fabriquerJeton = (cle, id, owner, exp) => `${id}.${exp}.${signer(cle, id, owner, exp)}`;
export function decouperJeton(t) {
  const m = /^([A-Za-z0-9_-]{22})\.(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(String(t || ''));
  return m ? { id: m[1], exp: Number(m[2]), sig: m[3] } : null;
}
// La ligne lue + le jeton ⇒ valide ? (signature du vendeur de la LIGNE, expiration, révocation)
export function lienValide(ligne, j, { cle, maintenant = Date.now() } = {}) {
  if (!cle || !j || !ligne || !ligne.owner || !ligne.data) return false;
  const d = ligne.data;
  if (!egal(j.sig, signer(cle, j.id, ligne.owner, j.exp))) return false;
  if (Number(d.exp) !== j.exp) return false;
  if (!(maintenant < j.exp)) return false;
  if (d.revoque) return false;
  return true;
}
const NON_TROUVE = { status: 404, body: { erreur: 'introuvable' } };
const resume = (row, maintenant) => {
  const d = (row && row.data) || {};
  const journal = Array.isArray(d.journal) ? d.journal : [];
  return { id: String(row.id).slice(PREFIXE_LIEN.length), cree: d.cree || 0, exp: d.exp || 0, revoque: !!d.revoque, actif: !d.revoque && maintenant < Number(d.exp), ouvertures: journal.filter((x) => x && x.quoi === 'ouvert').length, journal: journal.slice(-10) };
};

// ── LA ROUTE ────────────────────────────────────────────────────────────────
// depot : { lire(rowId) → { id, owner, data } | null | undefined,
//           listerDe(owner) → [row] | undefined,
//           inserer(row) → true | null, modifier(rowId, owner, data, { siActif }) → true | null
//             (`siActif` : seulement si la ligne n'est PAS révoquée — condition dans la requête),
//           pdf(owner, rowId) → base64 | null (absent) | undefined (pas su) }
// auth  : { utilisateur(jeton) → { id } | null | undefined }
export async function routeLienAide({ methode = 'GET', query = {}, corps = {}, jeton = '', ua = '', cle, depot, auth, maintenant = Date.now(), alea = randomBytes } = {}) {
  if (!cle) return { status: 503, body: { erreur: 'non-configure' } };
  // ── PUBLIC : l'aide ouvre son lien (lecture seule) ──
  if (methode === 'GET' && query.t != null) {
    const j = decouperJeton(query.t);
    if (!j) return NON_TROUVE;
    const ligne = await depot.lire(PREFIXE_LIEN + j.id);
    if (ligne === undefined) return { status: 503, body: { erreur: 'pas-su' } };
    if (!lienValide(ligne, j, { cle, maintenant })) return NON_TROUVE;
    const proj = projectionLienAide(ligne.data.projection || {}, maintenant);   // refiltrée à la lecture aussi
    const bord = query.bord != null ? String(query.bord) : '';
    // ⚠️ Écrit SOUS CONDITION « pas révoqué » : un journal relu avant « Couper le lien »
    //    ne peut jamais réécrire `revoque: false` par-dessus (lecture vieille, écriture neuve).
    const noter = (quoi) => depot.modifier(ligne.id, ligne.owner, { ...ligne.data, journal: [...(Array.isArray(ligne.data.journal) ? ligne.data.journal : []), { at: maintenant, quoi, ua: txt(ua, 40) }].slice(-MAX_JOURNAL) }, { siActif: true }).catch(() => null);
    if (bord) {
      const permis = proj.envoyer.some((e) => e.pdf.includes(bord));
      if (!permis || !PDF_OK.test(bord)) return NON_TROUVE;
      const b = await depot.pdf(ligne.owner, bord);
      if (b === undefined) return { status: 503, body: { erreur: 'pas-su' } };
      if (!b) return NON_TROUVE;
      await noter('bordereau');
      return { status: 200, pdf: b };
    }
    await noter('ouvert');
    return { status: 200, body: { ok: true, exp: j.exp, projection: proj } };
  }
  // ── LE VENDEUR : créer, rafraîchir, couper, lister (SA session) ──
  const u = await auth.utilisateur(jeton);
  if (u === undefined) return { status: 503, body: { erreur: 'pas-su' } };
  if (!u) return { status: 401, body: { erreur: 'session' } };
  const liste = await depot.listerDe(u.id);
  if (liste === undefined) return { status: 503, body: { erreur: 'pas-su' } };
  if (methode === 'GET') return { status: 200, body: { ok: true, liens: liste.map((r) => resume(r, maintenant)).sort((a, b) => b.cree - a.cree) } };
  const action = String((corps && corps.action) || '');
  if (action === 'creer') {
    if (liste.filter((r) => resume(r, maintenant).actif).length >= LIENS_ACTIFS_MAX) return { status: 409, body: { erreur: 'trop' } };
    const id = b64u(alea(16));
    const exp = maintenant + LIEN_DUREE_MS;
    const ok = await depot.inserer({ id: PREFIXE_LIEN + id, owner: u.id, data: { v: 1, cree: maintenant, exp, revoque: false, projection: projectionLienAide(corps.projection, maintenant), journal: [] } });
    if (!ok) return { status: 503, body: { erreur: 'pas-su' } };
    return { status: 200, body: { ok: true, id, exp, jeton: fabriquerJeton(cle, id, u.id, exp) } };
  }
  const id = String((corps && corps.id) || '');
  const row = ID_OK.test(id) ? liste.find((r) => r.id === PREFIXE_LIEN + id) : null;   // SES liens seulement
  if (!row) return NON_TROUVE;
  if (action === 'maj') {
    if (!resume(row, maintenant).actif) return NON_TROUVE;
    const ok = await depot.modifier(row.id, u.id, { ...row.data, projection: projectionLienAide(corps.projection, maintenant) }, { siActif: true });
    return ok ? { status: 200, body: { ok: true } } : { status: 503, body: { erreur: 'pas-su' } };
  }
  if (action === 'revoquer') {
    const ok = await depot.modifier(row.id, u.id, { ...row.data, revoque: true, revoqueAt: maintenant, projection: { v: 1, envoyer: [], retirer: [] } });
    return ok ? { status: 200, body: { ok: true } } : { status: 503, body: { erreur: 'pas-su' } };
  }
  return { status: 400, body: { erreur: 'action' } };
}

// ── LE DÉPÔT RÉEL (PostgREST, clé de service) ───────────────────────────────
export function depotLienAide({ url, entetes, fetcher }) {
  const base = `${url}/rest/v1/app_data`;
  const json = async (r) => { if (!r.ok) return undefined; const j = await r.json(); return Array.isArray(j) ? j : undefined; };
  return {
    async lire(rowId) { try { const j = await json(await fetcher(`${base}?id=eq.${encodeURIComponent(rowId)}&select=id,owner,data`, { headers: entetes })); return j === undefined ? undefined : (j[0] || null); } catch (_) { return undefined; } },
    async listerDe(owner) { try { return await json(await fetcher(`${base}?owner=eq.${encodeURIComponent(owner)}&id=like.${PREFIXE_LIEN}*&select=id,owner,data&limit=50`, { headers: entetes })); } catch (_) { return undefined; } },
    async inserer(row) { try { const r = await fetcher(base, { method: 'POST', headers: { ...entetes, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify([{ ...row, updated_at: new Date().toISOString() }]) }); return r.ok ? true : null; } catch (_) { return null; } },
    async modifier(rowId, owner, data, { siActif = false } = {}) { try { const r = await fetcher(`${base}?id=eq.${encodeURIComponent(rowId)}&owner=eq.${encodeURIComponent(owner)}${siActif ? '&data->>revoque=eq.false' : ''}`, { method: 'PATCH', headers: { ...entetes, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ data, updated_at: new Date().toISOString() }) }); return r.ok ? true : null; } catch (_) { return null; } },
    // Le PDF seul (jamais `select=data` : la ligne est lourde, §4.4).
    async pdf(owner, rowId) { try { const j = await json(await fetcher(`${base}?id=eq.${encodeURIComponent(rowId)}&owner=eq.${encodeURIComponent(owner)}&select=b:data->>pdfB64`, { headers: entetes })); if (j === undefined) return undefined; const b = j[0] && j[0].b; return typeof b === 'string' && b.length > 100 && b !== 'None' ? b : null; } catch (_) { return undefined; } },
  };
}
