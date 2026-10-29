// ── TA CLÉ PHOTOROOM, CÔTÉ APP (29 octobre) ─────────────────────────────────
// La carte « Ta clé Photoroom » parle à /api/compte?mode=photoroom. Le
// navigateur n'a JAMAIS la clé : il l'envoie une fois (`poser`), puis il ne sait
// que « rangée · ses 4 derniers caractères · la date · ce que Photoroom a
// répondu ». Toutes les règles (coffre, vérification, ancienne ligne en clair)
// vivent sur le serveur (api/_lib/photoroom-cle.js) ; ici, la forme de l'appel
// et les mots.
//
// Le détourage lui-même passe par /api/ai?mode=detourage (api/_lib/detourage.js),
// qui relit la clé par la SESSION : avec SA clé, c'est SON compte Photoroom qui
// paie ; jamais celle de Julien pour un autre vendeur (§2.9).

export const ROUTE_CLE = '/api/compte?mode=photoroom';
export const ROUTE_DETOURAGE = '/api/ai?mode=detourage';
// Mesuré (pages d'aide de Photoroom, 29 oct.) : la clé se crée et se retrouve
// dans « API dashboard » de leur application web.
export const LIEN_CLE = 'https://app.photoroom.com/api-dashboard';
export const LIEN_TARIFS = 'https://www.photoroom.com/api/pricing';

// TROIS états : `undefined` en cours (posé par l'appelant) · `null` pas su ·
// l'objet du serveur `{etat, fin, at, verif, verifAt, restant, coffre, migree}`.
export async function lirePhotoroom(entete) {
  try {
    const r = await fetch(ROUTE_CLE, { headers: entete || {}, cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok && typeof j.etat === 'string' ? j : null;
  } catch (_) { return null; }
}

// `{code, j}` ; une coupure rend `code: 0` (la réponse n'est pas arrivée).
export async function appelPhotoroom(entete, corps) {
  try {
    const r = await fetch(ROUTE_CLE, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(entete || {}) }, body: JSON.stringify(corps) });
    const j = await r.json().catch(() => null);
    return { code: r.status, j: j || {} };
  } catch (_) { return { code: 0, j: {} }; }
}

// La clé est-elle UTILISABLE pour un détourage avec SON compte ? (Le bouton du
// Studio photo ne s'affiche que là.) « refusee » : Photoroom la refuse — on ne
// propose pas un geste qui échouera.
export const cleUtilisable = (s) => !!(s && (s.etat === 'posee' || s.etat === 'en-clair') && s.verif !== 'refusee');

const dateCourte = (iso) => {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return ''; }
};
export { dateCourte };

// Ce que Photoroom a répondu, en une phrase. `ton` : 'ok' · 'attention' · 'neutre'.
// Le nombre d'images restantes n'est écrit que s'il a été LU (jamais un « 0 »).
export function phraseVerif(s) {
  if (!s) return null;
  const quand = s.verifAt ? ` (le ${dateCourte(s.verifAt)})` : '';
  if (s.verif === 'ok') return { ton: 'ok', texte: `Photoroom l'a acceptée${quand}.` + (Number.isFinite(s.restant) ? ` Il te reste ${s.restant} image${s.restant > 1 ? 's' : ''} sur ton compte Photoroom.` : '') };
  if (s.verif === 'sans-forfait') return { ton: 'attention', texte: `Photoroom reconnaît la clé${quand}, mais aucune formule API n'est active sur ton compte : les détourages seront refusés tant que tu n'en as pas.` };
  if (s.verif === 'refusee') return { ton: 'attention', texte: `Photoroom refuse maintenant cette clé${quand} (désactivée ou supprimée) : remplace-la.` };
  if (s.migreeLe && !s.verifAt) return { ton: 'neutre', texte: 'Pas encore vérifiée chez Photoroom (elle vient d’être mise au coffre) : « Vérifier chez Photoroom » le fait.' };
  return { ton: 'neutre', texte: "Rangée, mais pas encore vérifiée : Photoroom n'a pas répondu à la vérification." };
}

const enB64 = (s) => String(s || '').replace(/^data:[^,]*,/, '');
const octetsDe = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

// Les mots d'un refus du serveur de détourage (api/_lib/detourage.js).
export const RAISONS_DETOURAGE = {
  session: 'ta session VRM a expiré — reconnecte-toi',
  abonnement: 'ton abonnement VRM est coupé',
  reserve: "aucune clé Photoroom à toi n'est rangée",
  'no-key': "aucune clé Photoroom n'est rangée",
  acces: "je n'ai pas pu vérifier ton accès",
  plafond: 'le plafond du mois est atteint',
  compteur: "le compteur du mois n'a pas pu être lu",
  cache: "le cache des photos déjà détourées n'a pas pu être lu",
  sha: "l'empreinte de la photo ne correspond pas",
  image: "ce n'est pas une image lisible",
  'trop-lourde': 'la photo est trop lourde',
  'photoroom-402': 'tes crédits Photoroom sont épuisés (ou aucune formule API active)',
  'photoroom-403': 'Photoroom refuse ta clé',
  'photoroom-429': 'Photoroom demande de ralentir',
};

// Détoure UNE photo (data URL JPEG) avec Photoroom, par le serveur. Rend
// `{ok:true, img, cache}` · `{ok:false, raison, incertain}`. `incertain` :
// la réponse n'est pas arrivée — Photoroom a PEUT-ÊTRE détouré (et facturé) ;
// un nouvel essai la retrouvera dans le cache si elle a été rangée.
export async function detourerAvecPhotoroom(entete, dataUrl) {
  const b64 = enB64(dataUrl);
  if (!b64) return { ok: false, raison: 'photo illisible', incertain: false };
  let sha;
  try {
    const h = await crypto.subtle.digest('SHA-256', octetsDe(b64));
    sha = [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch (_) { return { ok: false, raison: 'empreinte impossible dans ce navigateur', incertain: false }; }
  let r, j;
  try {
    r = await fetch(ROUTE_DETOURAGE, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(entete || {}) }, body: JSON.stringify({ sha, b64 }) });
    j = await r.json().catch(() => null);
  } catch (_) { return { ok: false, raison: "pas de réponse du serveur", incertain: true }; }
  if (r.ok && j && j.ok && typeof j.b64 === 'string' && j.b64) return { ok: true, img: `data:${j.type || 'image/jpeg'};base64,${j.b64}`, cache: !!j.hit };
  const code = j && j.reason === 'photoroom' ? `photoroom-${j.status}` : (j && j.reason) || '';
  // Incertain : Photoroom a répondu « sans corps », ou rien n'est arrivé — elle
  // a PEUT-ÊTRE détouré (et facturé). Un refus (4xx de Photoroom) est certain.
  const incertain = r.status === 504 || !j || (j.reason === 'photoroom' && Number(j.status) >= 500);
  return { ok: false, raison: RAISONS_DETOURAGE[code] || (r.status >= 500 ? 'le serveur ou Photoroom n’a pas répondu' : `refus du serveur (${r.status})`), incertain };
}
