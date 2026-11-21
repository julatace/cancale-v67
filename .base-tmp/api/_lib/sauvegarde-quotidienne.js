// ── L'EXPORT QUOTIDIEN DES LIGNES DE CHAQUE VENDEUR (12 nov., agent2-fiabilite-prod) ──
// Récit : docs/passation/2026-11-12-fiabilite-prod.md · audit : scripts/audit-sauvegarde-export.cjs
//
// POURQUOI, alors que Supabase Pro garde déjà 7 jours ?
//   · la sauvegarde de Supabase remet TOUT le projet en arrière (coupé pendant
//     l'opération, tout ce qui a été écrit depuis est perdu) : on ne peut pas
//     reprendre « les lignes d'un vendeur » ;
//   · la copie chiffrée de GitHub (.github/workflows/sauvegarde.yml) n'a JAMAIS
//     tourné (mesuré le 12 nov. : ses deux secrets ne sont pas posés).
// Celle-ci ne demande AUCUN geste : elle part du cron existant, avec la clé de
// service déjà posée, et range un fichier PAR VENDEUR et PAR JOUR dans un seau
// Supabase Storage PRIVÉ (`sauvegardes`), 14 jours.
//
// LES RÈGLES (chacune a son contrôle dans l'audit) :
//   1. Ce qui est copié : toutes les lignes `app_data` du vendeur SAUF ce que
//      l'extension recapte toute seule ou qui est lourd (FAMILLES_ECARTEES : les
//      captures `harvest_*` et leurs bordereaux PDF, les e-mails de bordereau et
//      de facture avec leur PDF, les catalogues) ; ses comptes Vinted SANS
//      aucun jeton. Une ligne qui porte quand même un PDF ou pèse plus de
//      1,5 Mo n'est pas copiée : elle est NOMMÉE (`ecartees`), jamais tue.
//   2. Une lecture ratée n'écrit RIEN pour ce vendeur (ni fichier, ni « fait ») ;
//      une liste vide n'est jamais une réponse (0 ligne ⇒ rien écrit, dit).
//   3. Chiffré : AES-256-GCM, clé tirée (HKDF-SHA256) de `SAUVEGARDE_CLE` si elle
//      est posée sur Vercel, sinon de la clé de service. Le fichier dit laquelle
//      (jamais la clé). Un fichier modifié ou une mauvaise clé ⇒ refusé.
//   4. Le seau doit être PRIVÉ : public ⇒ rien n'est écrit.
//   5. Un manifeste par jour (chiffré lui aussi) dit qui est fait, avec le nombre
//      de lignes et l'empreinte de chacun ; relancé le même jour, le passage ne
//      refait que ceux qui manquent (budget de temps).
//   6. Rétention : un jour de plus de 14 jours n'est retiré que s'il reste au
//      moins 7 jours COMPLETS plus récents (une panne longue ne vide jamais tout).
//   7. Rien n'est jamais lu en `select=data` sur une ligne lourde : les familles
//      écartées le sont DANS la requête (`id=not.like.…`).
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fetchAvecDelai } from './fetch-delai.js';   // (12 nov.) chaque appel sortant a un délai

export const SEAU = 'sauvegardes';
export const JOURS_GARDES = 14;
export const JOURS_COMPLETS_MINI = 7;
export const MAX_OCTETS_LIGNE = 1_500_000;
export const PAGE = 500;
export const NEUTRE = '00000000-0000-0000-0000-000000000000';
// Ce que l'extension recapte ou qui est lourd (mesuré le 12 nov., lecture seule :
// harvest 3 667 lignes dont les PDF de bordereaux · email_bord 240 lignes / 6,4 Mo
// dont 61 PDF · email_invoice 21 PDF · catalogues 2 à 3,4 Mo chacun).
export const FAMILLES_ECARTEES = ['harvest_', 'email_bord', 'email_invoice', 'lbc_catalogue', 'vc_catalogue', 'vinted_catalogue', 'lbc_recon', 'vc_brut'];
export const estEcartee = (id) => FAMILLES_ECARTEES.some((p) => String(id || '').startsWith(p));
// Les colonnes de `vinted_accounts` copiées — JAMAIS access_token, refresh_token, csrf_token.
export const COLONNES_COMPTES = ['id', 'vinted_user_id', 'login', 'domain', 'anon_id', 'owner', 'created_at', 'updated_at'];

export function requeteLignes(owner) {
  const filtres = FAMILLES_ECARTEES.map((p) => `&id=not.like.${encodeURIComponent(p)}*`).join('');
  return `app_data?owner=eq.${encodeURIComponent(owner)}&select=id,data,updated_at${filtres}&order=id.asc`;
}
export const requeteComptes = (owner) => `vinted_accounts?owner=eq.${encodeURIComponent(owner)}&select=${COLONNES_COMPTES.join(',')}&order=id.asc`;

// ── chiffrement ──────────────────────────────────────────────────────────────
const MAGIE = Buffer.from('VRMS1');
export function cleDe(secret) {
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(String(secret)), Buffer.from('vrm-sauvegarde'), Buffer.from('v1'), 32));
}
export function sourceCle(env = process.env) {
  if (env.SAUVEGARDE_CLE && String(env.SAUVEGARDE_CLE).length >= 20) return { source: 'cle-dediee', secret: String(env.SAUVEGARDE_CLE) };
  if (env.SUPABASE_SERVICE_KEY) return { source: 'cle-service', secret: String(env.SUPABASE_SERVICE_KEY) };
  return null;
}
const SOURCES = ['cle-dediee', 'cle-service'];
export function chiffrer(objet, { source, secret }) {
  const clair = zlib.gzipSync(Buffer.from(JSON.stringify(objet)));
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', cleDe(secret), iv);
  const corps = Buffer.concat([c.update(clair), c.final()]);
  return Buffer.concat([MAGIE, Buffer.from([SOURCES.indexOf(source)]), iv, c.getAuthTag(), corps]);
}
export function sourceDuFichier(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 34 || !buf.subarray(0, 5).equals(MAGIE)) return null;
  return SOURCES[buf[5]] || null;
}
// Mauvaise clé, fichier tronqué ou modifié ⇒ une erreur (GCM), jamais du bruit.
export function dechiffrer(buf, secret) {
  if (!sourceDuFichier(buf)) throw new Error('pas un fichier de sauvegarde VRM');
  const iv = buf.subarray(6, 18), tag = buf.subarray(18, 34), corps = buf.subarray(34);
  const d = crypto.createDecipheriv('aes-256-gcm', cleDe(secret), iv);
  d.setAuthTag(tag);
  const clair = Buffer.concat([d.update(corps), d.final()]);
  return JSON.parse(zlib.gunzipSync(clair).toString('utf8'));
}

// ── l'empreinte d'un lot de lignes (ordre par id, contenu exact) ─────────────
export function empreinte(lignes) {
  const h = crypto.createHash('sha256');
  for (const l of [...lignes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) h.update(l.id + '\u0000' + JSON.stringify(l.data) + '\u0001');
  return h.digest('hex');
}

// ── la copie d'UN vendeur ────────────────────────────────────────────────────
// `lire(chemin)` → tableau (toutes les pages) | null (lecture ratée).
export async function copieVendeur({ owner, lire, jour, maintenant = Date.now() }) {
  const brutes = await lire(requeteLignes(owner));
  if (!Array.isArray(brutes)) return { fait: false, raison: 'lecture ratée : rien écrit' };
  const comptes = owner === NEUTRE ? [] : await lire(requeteComptes(owner));
  if (!Array.isArray(comptes)) return { fait: false, raison: 'comptes illisibles : rien écrit' };
  const lignes = [], ecartees = [];
  for (const r of brutes) {
    if (!r || typeof r.id !== 'string') continue;
    if (estEcartee(r.id)) { ecartees.push({ id: r.id, raison: 'famille' }); continue; } // filet si le filtre n'a pas joué
    const texte = JSON.stringify(r.data === undefined ? null : r.data);
    if (texte.includes('JVBERi0')) { ecartees.push({ id: r.id, raison: 'pdf', octets: texte.length }); continue; }
    if (texte.length > MAX_OCTETS_LIGNE) { ecartees.push({ id: r.id, raison: 'lourde', octets: texte.length }); continue; }
    lignes.push({ id: r.id, data: r.data === undefined ? null : r.data, updated_at: r.updated_at || null });
  }
  if (!lignes.length) return { fait: false, vide: true, raison: 'aucune ligne lue : une liste vide n’est jamais une réponse, rien écrit' };
  for (const c of comptes) for (const k of ['access_token', 'refresh_token', 'csrf_token']) if (c && k in c) delete c[k];
  return { fait: true, copie: { v: 1, owner, jour, cree: new Date(maintenant).toISOString(), n: lignes.length, empreinte: empreinte(lignes), lignes, comptes, ecartees } };
}

// ── le stockage (Supabase Storage, seau privé) ───────────────────────────────
export function stockageSupabase({ url, entetes, fetcher = (u, o) => fetchAvecDelai(u, o, 60000) }) {   // (12 nov.) un export compressé peut être long : 60 s
  const base = `${url}/storage/v1`;
  const h = (extra = {}) => ({ ...entetes, ...extra });
  return {
    // true seau privé prêt · false seau public (refus) · null pas su
    async assurerSeau() {
      try {
        const r = await fetcher(`${base}/bucket/${SEAU}`, { headers: h() });
        if (r.ok) { const j = await r.json().catch(() => null); return j && j.public === false ? true : j ? false : null; }
        const c = await fetcher(`${base}/bucket`, { method: 'POST', headers: h({ 'Content-Type': 'application/json' }), body: JSON.stringify({ id: SEAU, name: SEAU, public: false, file_size_limit: 50 * 1024 * 1024 }) });
        if (!c.ok) return null;
        const v = await fetcher(`${base}/bucket/${SEAU}`, { headers: h() });
        const j = v.ok ? await v.json().catch(() => null) : null;
        return j ? j.public === false : null;
      } catch (_) { return null; }
    },
    async deposer(chemin, buf) {
      try { const r = await fetcher(`${base}/object/${SEAU}/${chemin}`, { method: 'POST', headers: h({ 'Content-Type': 'application/octet-stream', 'x-upsert': 'true', 'cache-control': 'no-store' }), body: buf }); return !!r.ok; } catch (_) { return false; }
    },
    // Buffer · null (absent) · undefined (pas su)
    async prendre(chemin) {
      try {
        const r = await fetcher(`${base}/object/${SEAU}/${chemin}`, { headers: h() });
        if (r.status === 404 || r.status === 400) return null;
        if (!r.ok) return undefined;
        return Buffer.from(await r.arrayBuffer());
      } catch (_) { return undefined; }
    },
    // noms · null (pas su)
    async lister(prefixe) {
      try {
        const r = await fetcher(`${base}/object/list/${SEAU}`, { method: 'POST', headers: h({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefix: prefixe, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }) });
        if (!r.ok) return null;
        const j = await r.json().catch(() => null);
        return Array.isArray(j) ? j.map((o) => o && o.name).filter(Boolean) : null;
      } catch (_) { return null; }
    },
    async retirer(chemins) {
      try { const r = await fetcher(`${base}/object/${SEAU}`, { method: 'DELETE', headers: h({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: chemins }) }); return !!r.ok; } catch (_) { return false; }
    },
  };
}

export const cheminVendeur = (jour, owner) => `${jour}/${owner}.vrms`;
export const cheminManifeste = (jour) => `${jour}/manifeste.vrms`;
const JOUR_RE = /^\d{4}-\d{2}-\d{2}$/;
export const jourParis = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

// ── le passage complet ───────────────────────────────────────────────────────
// owners : tableau | null (pas su ⇒ rien). Rend des NOMBRES seulement (jamais un contenu).
export async function passageSauvegarde({ owners, lire, stockage, cle, maintenant = Date.now(), budgetMs = 90000, horloge = Date.now }) {
  if (!cle) return { fait: false, raison: 'aucune clé (ni SAUVEGARDE_CLE ni clé de service) : rien écrit' };
  if (!Array.isArray(owners)) return { fait: false, raison: 'vendeurs pas sus : rien écrit' };
  const seau = await stockage.assurerSeau();
  if (seau === false) return { fait: false, raison: 'le seau « sauvegardes » est PUBLIC : rien écrit' };
  if (seau !== true) return { fait: false, raison: 'stockage injoignable : rien écrit' };
  const jour = jourParis(maintenant);
  const debut = horloge();
  // Le manifeste du jour : illisible (pas su) ⇒ on ne repart pas de zéro en l'écrasant.
  const brut = await stockage.prendre(cheminManifeste(jour));
  if (brut === undefined) return { fait: false, raison: 'manifeste du jour illisible : rien écrit' };
  let manif = { v: 1, jour, vendeurs: {} };
  if (brut) { try { manif = dechiffrer(brut, cle.secret); } catch (_) { return { fait: false, raison: 'manifeste du jour indéchiffrable (clé changée ?) : rien écrit' }; } }
  const tous = [...new Set([...owners.map(String), NEUTRE])];
  let copies = 0, echecs = 0, vides = 0, ecartees = 0, budgetAtteint = false;
  for (const owner of tous) {
    if (manif.vendeurs[owner] && manif.vendeurs[owner].fait) continue;
    if (horloge() - debut > budgetMs) { budgetAtteint = true; break; }
    let r;
    try { r = await copieVendeur({ owner, lire, jour, maintenant }); } catch (e) { r = { fait: false, raison: String((e && e.message) || e).slice(0, 120) }; }
    if (!r.fait) {
      if (r.vide) { vides++; manif.vendeurs[owner] = { fait: true, vide: true }; } else { echecs++; manif.vendeurs[owner] = { fait: false, raison: r.raison }; }
      continue;
    }
    const ok = await stockage.deposer(cheminVendeur(jour, owner), chiffrer(r.copie, cle));
    if (!ok) { echecs++; manif.vendeurs[owner] = { fait: false, raison: 'dépôt refusé' }; continue; }
    copies++; ecartees += r.copie.ecartees.length;
    manif.vendeurs[owner] = { fait: true, n: r.copie.n, empreinte: r.copie.empreinte, comptes: r.copie.comptes.length, ecartees: r.copie.ecartees.map((e) => `${e.id}:${e.raison}`) };
  }
  manif.complet = tous.every((o) => manif.vendeurs[o] && manif.vendeurs[o].fait);
  manif.maj = new Date(maintenant).toISOString();
  manif.source = cle.source;
  const ecrit = await stockage.deposer(cheminManifeste(jour), chiffrer(manif, cle));
  const purge = ecrit ? await purger({ stockage, cle, jour }) : { fait: false, raison: 'manifeste pas écrit : rien retiré' };
  return { fait: ecrit, jour, vendeurs: tous.length, copies, vides, echecs, ecartees, complet: !!manif.complet, budgetAtteint, source: cle.source, purge };
}

// ── la rétention : 14 jours, jamais sous 7 jours COMPLETS plus récents ──────
export async function purger({ stockage, cle, jour }) {
  const noms = await stockage.lister('');
  if (!Array.isArray(noms)) return { fait: false, raison: 'liste illisible : rien retiré' };
  const jours = noms.filter((n) => JOUR_RE.test(n)).sort();
  const limite = new Date(Date.parse(jour + 'T12:00:00Z') - JOURS_GARDES * 86400000).toISOString().slice(0, 10);
  const anciens = jours.filter((j) => j < limite);
  if (!anciens.length) return { fait: true, retires: 0, jours: jours.length };
  // Les jours COMPLETS gardés (manifeste lu, déchiffré, complet).
  let complets = 0;
  for (const j of jours.filter((x) => x >= limite)) {
    const b = await stockage.prendre(cheminManifeste(j));
    if (!b) continue;
    try { if (dechiffrer(b, cle.secret).complet) complets++; } catch (_) {}
  }
  if (complets < JOURS_COMPLETS_MINI) return { fait: true, retires: 0, jours: jours.length, garde: `seulement ${complets} jours complets récents : rien retiré` };
  let retires = 0;
  for (const j of anciens) {
    const fichiers = await stockage.lister(j);   // un dossier, sans « / » final (comme supabase-js `list(dossier)`)
    if (!Array.isArray(fichiers)) continue;
    if (!fichiers.length) continue;
    if (await stockage.retirer(fichiers.map((f) => `${j}/${f}`))) retires++;
  }
  return { fait: true, retires, jours: jours.length };
}
