// ═══════════════════════════════════════════════════════════════════════════
// LE CATALOGUE PRIVÉ (14 nov., lot messages-achats-plus, n° 110)
// docs/passation/2026-11-14-messages-achats-plus.md
// ═══════════════════════════════════════════════════════════════════════════
// Une sélection de SES paires (photos, tailles, prix) partagée en UN lien, pour une
// remise en main propre : `https://vrm.center/catalogue/<jeton>` (vercel.json réécrit
// vers `/api/compte?mode=catalogue&j=<jeton>` : AUCUNE fonction `api/` neuve, 12 au plus).
//
// CE QUE LE LIEN MONTRE — une projection refaite par le SERVEUR, jamais par le
// navigateur : photo, titre, marque, taille, prix affiché ; le N° de rangement
// seulement s'il l'a laissé coché. JAMAIS : le prix d'achat (il n'est même pas
// lu), le compte, le pseudo, l'identifiant d'annonce, le lien Vinted, une note.
// Les paires viennent de SES dressings lus (`harvest_*_listings`), lus AVEC SA
// SESSION (RLS : seulement ses lignes) — un identifiant d'annonce qui n'est pas
// chez lui est simplement absent : JAMAIS la donnée d'un autre vendeur.
// À l'affichage, la projection est refiltrée champ par champ (liste blanche) :
// une ligne retouchée à la main n'y ajoute rien.
//
// LE LIEN : un jeton de 32 octets aléatoires. Sa ligne d'INDEX (propriétaire
// NEUTRE, que seule la clé de service écrit) dit à qui il est, quel catalogue, et
// QUAND IL EXPIRE (7 jours par défaut ; 1, 7 ou 30) — l'expiration n'est donc pas
// modifiable depuis le navigateur. Le catalogue lui-même vit dans SA ligne
// `vrm_catalogue_<id>` (le jeton y est re-comparé, durée constante).
// Révoquer ⇒ l'index est retiré et la ligne marquée : le lien répond 404.
// Expiré ⇒ 404. Jeton inconnu ⇒ 404. Abonnement arrêté ⇒ 404 (rien à dire au visiteur).
// Une lecture ratée ⇒ 503 (jamais une page vide servie pour « rien »).
// Tenu par scripts/audit-messages-achats-plus.cjs (EXÉCUTE cette route).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';
import { fetchAvecDelai } from './fetch-delai.js';

export const PREFIXE_CATALOGUE = 'vrm_catalogue_';
export const RE_JETON_CATALOGUE = /^[A-Za-z0-9_-]{40,64}$/;
export const RE_ID_CATALOGUE = /^[0-9a-f]{16}$/;
export const DUREES_JOURS = [1, 7, 30];
export const DUREE_DEFAUT = 7;
export const MAX_PAIRES = 60;
export const MAX_CATALOGUES = 20;
const J = 86400000;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v) => String(v == null ? '' : v).trim();

export const empreinte = (jeton) => crypto.createHash('sha256').update(String(jeton || ''), 'utf8').digest('hex');
export const idIndex = (jeton) => `jeton_catalogue_${empreinte(jeton)}`;
const memeJeton = (a, b) => { const x = str(a), y = str(b); if (!x || !y) return false; return crypto.timingSafeEqual(Buffer.from(empreinte(x), 'hex'), Buffer.from(empreinte(y), 'hex')); };
export const urlCatalogue = (jeton, origine = 'https://vrm.center') => `${origine}/catalogue/${jeton}`;

// ── LA PROJECTION (la seule forme qui sort) ─────────────────────────────────
const photoSure = (u) => { const s = str(u); return /^https:\/\/[a-z0-9.-]+\/[^\s"'<>]*$/i.test(s) && s.length < 600 ? s : ''; };
const prixEuros = (p) => {
  if (p == null) return null;
  if (typeof p === 'object') { if (p.currency_code && p.currency_code !== 'EUR') return null; return prixEuros(p.amount); }
  const n = Number(String(p).replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
};
// Une annonce de SON dressing ⇒ ce que le lien peut montrer. `numero` : le N° (ou '').
export function projeterPaire(it, numero = '') {
  if (!it || typeof it !== 'object') return null;
  const photo = photoSure((it.photo && (it.photo.url || it.photo.full_size_url)) || (Array.isArray(it.photos) && it.photos[0] && (it.photos[0].url || it.photos[0].full_size_url)) || '');
  const out = {
    titre: str(it.title).slice(0, 120), marque: str(typeof it.brand === 'string' ? it.brand : it.brand_title).slice(0, 60),
    taille: str(typeof it.size === 'string' ? it.size : it.size_title).slice(0, 30), prix: prixEuros(it.price), photo,
  };
  const n = str(numero); if (/^[A-Za-z]?\d{1,6}$/.test(n)) out.numero = n;
  return out.titre || out.photo ? out : null;
}
// Refiltrée à la sortie : seuls ces champs, de cette forme.
export function projectionPublique(paires, montrerNumero) {
  const out = [];
  for (const p of (Array.isArray(paires) ? paires : []).slice(0, MAX_PAIRES)) {
    if (!p || typeof p !== 'object') continue;
    const x = { titre: str(p.titre).slice(0, 120), marque: str(p.marque).slice(0, 60), taille: str(p.taille).slice(0, 30), prix: prixEuros(p.prix), photo: photoSure(p.photo) };
    if (montrerNumero === true && /^[A-Za-z]?\d{1,6}$/.test(str(p.numero))) x.numero = str(p.numero);
    if (x.titre || x.photo) out.push(x);
  }
  return out;
}

// ── LA PAGE (aucun script ; la langue du visiteur parmi les cinq) ───────────
const TEXTES = {
  fr: { titre: 'Sélection privée', sous: 'Pour une remise en main propre', jusque: 'Lien valable jusqu’au {d}', taille: 'Taille', n: '{n} articles', un: '1 article', vide: 'Aucun article', pied: 'Page en lecture seule, partagée par le vendeur.' , absent: 'Ce lien n’existe pas, a expiré ou a été retiré.' },
  en: { titre: 'Private selection', sous: 'For an in-person handover', jusque: 'Link valid until {d}', taille: 'Size', n: '{n} items', un: '1 item', vide: 'No items', pied: 'Read-only page, shared by the seller.', absent: 'This link does not exist, has expired or was removed.' },
  es: { titre: 'Selección privada', sous: 'Para una entrega en mano', jusque: 'Enlace válido hasta el {d}', taille: 'Talla', n: '{n} artículos', un: '1 artículo', vide: 'Ningún artículo', pied: 'Página de solo lectura, compartida por el vendedor.', absent: 'Este enlace no existe, ha caducado o se ha retirado.' },
  it: { titre: 'Selezione privata', sous: 'Per una consegna a mano', jusque: 'Link valido fino al {d}', taille: 'Taglia', n: '{n} articoli', un: '1 articolo', vide: 'Nessun articolo', pied: 'Pagina in sola lettura, condivisa dal venditore.', absent: 'Questo link non esiste, è scaduto o è stato rimosso.' },
  de: { titre: 'Private Auswahl', sous: 'Für eine persönliche Übergabe', jusque: 'Link gültig bis {d}', taille: 'Größe', n: '{n} Artikel', un: '1 Artikel', vide: 'Keine Artikel', pied: 'Nur-Lesen-Seite, vom Verkäufer geteilt.', absent: 'Dieser Link existiert nicht, ist abgelaufen oder wurde entfernt.' },
};
const LOC = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE' };
export function langueVisiteur(entete) {
  for (const x of str(entete).toLowerCase().split(',')) { const l = x.trim().split(/[-;_]/)[0]; if (TEXTES[l]) return l; }
  return 'fr';
}
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const STYLE = `:root{color-scheme:light dark;--fond:#F5F5F7;--carte:#fff;--encre:#1D1D1F;--gris:#6E6E73;--filet:rgba(0,0,0,.08)}
@media (prefers-color-scheme:dark){:root{--fond:#000;--carte:#1C1C1E;--encre:#F5F5F7;--gris:#98989D;--filet:rgba(255,255,255,.12)}}
*{box-sizing:border-box;margin:0}body{background:var(--fond);color:var(--encre);font:400 17px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:960px;margin:0 auto;padding:32px 16px 48px}h1{font-size:34px;font-weight:700;letter-spacing:-.02em;line-height:1.1}
.sous{color:var(--gris);font-size:15px;margin-top:6px}.grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;margin-top:24px;padding:0;list-style:none}
.carte{background:var(--carte);border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgb(0 0 0/.04),0 8px 24px rgb(0 0 0/.06)}@media (prefers-color-scheme:dark){.carte{box-shadow:none}}
.ph{aspect-ratio:1;background:var(--filet);display:block;width:100%;object-fit:cover}.txt{padding:12px 12px 14px}.t{font-size:15px;font-weight:600;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.m{color:var(--gris);font-size:13px;margin-top:4px}.p{font-size:20px;font-weight:700;margin-top:8px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}.n{float:right;font-size:12px;font-weight:700;color:var(--gris);border:1px solid var(--filet);border-radius:8px;padding:1px 6px;margin-top:10px}
footer{color:var(--gris);font-size:13px;margin-top:32px;text-align:center}`;
export const CSP_CATALOGUE = "default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export function pageCatalogue({ paires = [], expire = '', titre = '', langue = 'fr' } = {}) {
  const T = TEXTES[langue] || TEXTES.fr;
  const fmtPrix = new Intl.NumberFormat(LOC[langue] || 'fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const d = Date.parse(expire);
  const jusque = Number.isFinite(d) ? T.jusque.replace('{d}', new Intl.DateTimeFormat(LOC[langue] || 'fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date(d))) : '';
  const n = paires.length;
  const cartes = paires.map((p) => `<li class="carte">${p.photo ? `<img class="ph" src="${esc(p.photo)}" alt="" loading="lazy" decoding="async" width="320" height="320" referrerpolicy="no-referrer">` : '<span class="ph"></span>'}<div class="txt"><p class="t">${esc(p.titre)}</p><p class="m">${esc([p.marque, p.taille ? `${T.taille} ${p.taille}` : ''].filter(Boolean).join(' · '))}</p>${p.numero ? `<span class="n">N°${esc(p.numero)}</span>` : ''}${p.prix != null ? `<p class="p">${esc(fmtPrix.format(p.prix))}</p>` : ''}</div></li>`).join('');
  return `<!doctype html><html lang="${langue}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(titre || T.titre)}</title><style>${STYLE}</style></head><body><main><h1>${esc(titre || T.titre)}</h1><p class="sous">${esc(T.sous)} · ${esc(n === 1 ? T.un : n ? T.n.replace('{n}', n) : T.vide)}${jusque ? ' · ' + esc(jusque) : ''}</p><ul class="grille">${cartes}</ul><footer>${esc(T.pied)}</footer></main></body></html>`;
}
export function pageAbsente(langue = 'fr') {
  const T = TEXTES[langue] || TEXTES.fr;
  return `<!doctype html><html lang="${langue}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(T.titre)}</title><style>${STYLE}</style></head><body><main><h1>${esc(T.titre)}</h1><p class="sous">${esc(T.absent)}</p></main></body></html>`;
}

// ── LA ROUTE ────────────────────────────────────────────────────────────────
// deps : { base, cle (service), fetch, methode, jeton (public) | user + corps + lireVendeur(chemin),
//          acces(owner), langue, origine, maintenant, aleatoire(n) }
// Rend { status, type: 'html'|'json', body }.
export async function traiterCatalogue(deps) {
  const { base, cle, methode } = deps;
  const f = deps.fetch || fetchAvecDelai;
  const maintenant = deps.maintenant || Date.now();
  const langue = deps.langue || 'fr';
  const origine = deps.origine || 'https://vrm.center';
  const absent = () => ({ status: 404, type: 'html', body: pageAbsente(langue) });
  if (!cle) return deps.jeton != null ? { status: 503, type: 'html', body: pageAbsente(langue) } : { status: 503, type: 'json', body: { erreur: 'non-configure', message: 'Le catalogue n’est pas encore branché sur le serveur.' } };
  const headers = { apikey: cle, Authorization: `Bearer ${cle}` };
  const lire = async (chemin) => { try { const r = await f(`${base}/rest/v1/${chemin}`, { headers }); if (!r || !r.ok) return undefined; const j = await r.json(); return Array.isArray(j) ? j : undefined; } catch (_) { return undefined; } };
  const ecrire = async (lignes) => { try { const r = await f(`${base}/rest/v1/app_data?on_conflict=owner,id`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(lignes) }); return !!(r && r.ok); } catch (_) { return false; } };
  const retirerIndex = async (jeton) => { try { const r = await f(`${base}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idIndex(jeton)}`, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } }); return !!(r && r.ok); } catch (_) { return false; } };

  // 1. LA PAGE PUBLIQUE, par le jeton seul.
  if (deps.jeton != null) {
    if (methode !== 'GET') return { status: 405, type: 'html', body: pageAbsente(langue) };
    const jeton = str(deps.jeton);
    if (!RE_JETON_CATALOGUE.test(jeton)) return absent();
    const ix = await lire(`app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idIndex(jeton)}&select=o:data->>owner,c:data->>cid,e:data->>expire&limit=1`);
    if (ix === undefined) return { status: 503, type: 'html', body: pageAbsente(langue) };
    const i = ix[0];
    if (!i || !RE_UUID.test(str(i.o)) || !RE_ID_CATALOGUE.test(str(i.c))) return absent();
    const exp = Date.parse(i.e || '');
    if (!Number.isFinite(exp) || exp <= maintenant) { await retirerIndex(jeton); return absent(); }
    if (deps.acces && (await deps.acces(i.o)) === false) return absent();
    const rows = await lire(`app_data?owner=eq.${encodeURIComponent(i.o)}&id=eq.${PREFIXE_CATALOGUE}${i.c}&select=j:data->>jeton,r:data->>revoque,t:data->>titre,num:data->>numero,p:data->paires&limit=1`);
    if (rows === undefined) return { status: 503, type: 'html', body: pageAbsente(langue) };
    const c = rows[0];
    if (!c || !memeJeton(jeton, c.j) || String(c.r) === 'true') return absent();
    const paires = projectionPublique(c.p, String(c.num) === 'true');
    return { status: 200, type: 'html', body: pageCatalogue({ paires, expire: new Date(exp).toISOString(), titre: str(c.t).slice(0, 60), langue }) };
  }

  // 2. SES CATALOGUES, sur SA session.
  const user = deps.user;
  if (!user || !RE_UUID.test(str(user.id)) || user.id === PROPRIETAIRE_NEUTRE) return { status: 401, type: 'json', body: { erreur: 'session' } };
  const lesSiens = async () => {
    const rows = await lire(`app_data?owner=eq.${user.id}&id=like.${PREFIXE_CATALOGUE}*&select=id,j:data->>jeton,r:data->>revoque,t:data->>titre,e:data->>expire,cree:data->>cree,num:data->>numero,p:data->paires&limit=${MAX_CATALOGUES * 3}`);
    if (rows === undefined) return undefined;
    return rows.map((r) => {
      const cid = str(r.id).slice(PREFIXE_CATALOGUE.length);
      const exp = Date.parse(r.e || ''), revoque = String(r.r) === 'true';
      const etat = revoque ? 'revoque' : !Number.isFinite(exp) || exp <= maintenant ? 'expire' : 'actif';
      return { cid, titre: str(r.t), expire: Number.isFinite(exp) ? new Date(exp).toISOString() : '', cree: str(r.cree), etat, n: Array.isArray(r.p) ? r.p.length : 0,
        numero: String(r.num) === 'true', url: etat === 'actif' && RE_JETON_CATALOGUE.test(str(r.j)) ? urlCatalogue(str(r.j), origine) : '' };
    }).filter((x) => RE_ID_CATALOGUE.test(x.cid)).sort((a, b) => b.cree.localeCompare(a.cree));
  };
  if (methode === 'GET') {
    const l = await lesSiens();
    if (l === undefined) return { status: 503, type: 'json', body: { erreur: 'base', message: 'Réessaie dans un instant.' } };
    return { status: 200, type: 'json', body: { ok: true, catalogues: l } };
  }
  if (methode !== 'POST') return { status: 405, type: 'json', body: { erreur: 'GET ou POST' } };
  const corps = deps.corps && typeof deps.corps === 'object' ? deps.corps : {};
  const action = str(corps.action);

  if (action === 'revoquer') {
    const cid = str(corps.cid);
    if (!RE_ID_CATALOGUE.test(cid)) return { status: 400, type: 'json', body: { erreur: 'cid' } };
    const rows = await lire(`app_data?owner=eq.${user.id}&id=eq.${PREFIXE_CATALOGUE}${cid}&select=j:data->>jeton,d:data&limit=1`);
    if (rows === undefined) return { status: 503, type: 'json', body: { erreur: 'base', message: 'Rien n’a changé. Réessaie dans un instant.' } };
    if (!rows[0]) return { status: 404, type: 'json', body: { erreur: 'inconnu' } };   // le catalogue d'un autre : rien
    const jeton = str(rows[0].j);
    if (jeton && !(await retirerIndex(jeton))) return { status: 503, type: 'json', body: { erreur: 'base', message: 'Rien n’a changé. Réessaie dans un instant.' } };
    const d = rows[0].d && typeof rows[0].d === 'object' ? rows[0].d : {};
    const now = new Date(maintenant).toISOString();
    if (!(await ecrire([{ owner: user.id, id: PREFIXE_CATALOGUE + cid, data: { ...d, revoque: true, revoqueAt: now }, updated_at: now }]))) return { status: 503, type: 'json', body: { erreur: 'base', message: 'Le lien est coupé ; réessaie pour le marquer.' } };
    return { status: 200, type: 'json', body: { ok: true, cid, etat: 'revoque' } };
  }

  if (action !== 'creer') return { status: 400, type: 'json', body: { erreur: 'action' } };
  const ids = [...new Set((Array.isArray(corps.items) ? corps.items : []).map(str).filter((x) => /^\d{4,15}$/.test(x)))];
  if (!ids.length) return { status: 400, type: 'json', body: { erreur: 'vide', message: 'Choisis au moins un article.' } };
  if (ids.length > MAX_PAIRES) return { status: 400, type: 'json', body: { erreur: 'trop', message: `${MAX_PAIRES} articles au plus.` } };
  const jours = DUREES_JOURS.includes(Number(corps.jours)) ? Number(corps.jours) : DUREE_DEFAUT;
  const montrerNumero = corps.numero !== false;
  const existants = await lesSiens();
  if (existants === undefined) return { status: 503, type: 'json', body: { erreur: 'base', message: 'Rien n’a été créé. Réessaie dans un instant.' } };
  if (existants.filter((x) => x.etat === 'actif').length >= MAX_CATALOGUES) return { status: 409, type: 'json', body: { erreur: 'plafond', message: `${MAX_CATALOGUES} liens actifs au plus : retires-en un d’abord.` } };
  // SES dressings, lus AVEC SA SESSION (RLS) — jamais la clé de service ici.
  if (typeof deps.lireVendeur !== 'function') return { status: 503, type: 'json', body: { erreur: 'base' } };
  const dressings = await deps.lireVendeur('app_data?id=like.harvest_*_listings&select=id,items:data->payload->items');
  if (!Array.isArray(dressings)) return { status: 503, type: 'json', body: { erreur: 'base', message: 'Rien n’a été créé. Réessaie dans un instant.' } };
  const parId = new Map();
  for (const r of dressings) for (const it of (Array.isArray(r && r.items) ? r.items : [])) if (it && it.id != null && !parId.has(String(it.id))) parId.set(String(it.id), it);
  let numeros = {};
  if (montrerNumero) {
    const presents = ids.filter((id) => parId.has(id));
    if (presents.length) {
      const sel = presents.map((id) => `n${id}:data->vinted_annonce_numeros->${id}->>numero`).join(',');
      const m = await deps.lireVendeur(`app_data?id=eq.main&select=${sel}&limit=1`);
      if (!Array.isArray(m)) return { status: 503, type: 'json', body: { erreur: 'base', message: 'Rien n’a été créé. Réessaie dans un instant.' } };
      numeros = m[0] || {};
    }
  }
  const paires = [];
  let absentes = 0;
  for (const id of ids) {
    const it = parId.get(id);
    const p = it ? projeterPaire(it, montrerNumero ? numeros['n' + id] : '') : null;
    if (p) paires.push(p); else absentes++;
  }
  if (!paires.length) return { status: 400, type: 'json', body: { erreur: 'aucune', message: 'Aucun de ces articles n’est dans tes annonces lues.' } };
  const jeton = deps.aleatoire ? deps.aleatoire(32) : crypto.randomBytes(32).toString('base64url');
  const cid = deps.aleatoireId ? deps.aleatoireId() : crypto.randomBytes(8).toString('hex');
  const now = new Date(maintenant).toISOString(), expire = new Date(maintenant + jours * J).toISOString();
  const titre = str(corps.titre).replace(/[\u0000-\u001f]/g, ' ').slice(0, 60);
  // La ligne d'abord (elle porte le jeton), puis l'index (qui dit l'expiration).
  if (!(await ecrire([{ owner: user.id, id: PREFIXE_CATALOGUE + cid, data: { jeton, cid, titre, numero: montrerNumero, paires, cree: now, expire, revoque: false }, updated_at: now }]))) {
    return { status: 503, type: 'json', body: { erreur: 'base', message: 'Rien n’a été créé. Réessaie dans un instant.' } };
  }
  if (!(await ecrire([{ owner: PROPRIETAIRE_NEUTRE, id: idIndex(jeton), data: { owner: user.id, cid, genre: 'catalogue', expire, at: now }, updated_at: now }]))) {
    return { status: 503, type: 'json', body: { erreur: 'base', message: 'Rien n’a été créé. Réessaie dans un instant.' } };
  }
  return { status: 200, type: 'json', body: { ok: true, cid, url: urlCatalogue(jeton, origine), expire, n: paires.length, absentes } };
}
