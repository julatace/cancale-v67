// ═══════════════════════════════════════════════════════════════════════════
// À QUI EST CE JETON ? — l'index des jetons du widget et des SMS (7 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Le widget iPhone (`?k=`, `vrm_widget_token`) et les SMS Mondial Relay
// (`vrm_sms_token`) arrivent SANS session : seul le jeton dit le vendeur. Avant,
// la route lisait le jeton de TOUTES les lignes `main` (un balayage de la table,
// à chaque rafraîchissement de chaque widget) — à 1 000 vendeurs, ~1 000 lignes
// lues pour en trouver une.
//
// Ici, une ligne d'INDEX par jeton, lue par sa clé exacte (`id=eq.`) :
//   · owner = le propriétaire NEUTRE (`00000000-…`, aucune session ne peut
//     l'écrire : seule la clé de service du serveur y touche) ;
//   · id = `jeton_{genre}_{sha256 du jeton}` — jamais le jeton en clair ;
//   · data = { owner: <vendeur>, genre, at }.
// L'index ne fait JAMAIS foi seul : le jeton est toujours RE-COMPARÉ (durée
// constante) à celui de la ligne `main` du vendeur désigné. Un index périmé
// (jeton changé, vendeur parti) est retiré et la clé refusée.
//
// TRANSITION : un jeton sans index (tous ceux d'avant le 7 nov., et chaque jeton
// neuf créé par l'app) ⇒ l'ancienne recherche UNE fois, puis l'index est écrit.
// Aucun widget existant ne casse ; dès le premier passage, il est indexé.
// Trois états partout : une lecture ratée ⇒ `undefined` (« pas su », la route
// répond 503) ; jamais « inconnu » sur une base qui n'a pas répondu.
// Tenu par scripts/audit-jeton-index.cjs (EXÉCUTE la route widget et SMS).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';

export const CHAMP_JETON = { widget: 'vrm_widget_token', sms: 'vrm_sms_token' };
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const empreinteJeton = (jeton) => crypto.createHash('sha256').update(String(jeton || ''), 'utf8').digest('hex');
export const idIndexJeton = (genre, jeton) => `jeton_${genre}_${empreinteJeton(jeton)}`;

// Comparaison à durée constante (ni la longueur ni le premier caractère faux
// ne se lisent au temps de réponse) : on compare deux empreintes de même taille.
export function memeJeton(a, b) {
  const x = String(a == null ? '' : a), y = String(b == null ? '' : b);
  if (!x || !y) return false;
  return crypto.timingSafeEqual(Buffer.from(empreinteJeton(x), 'hex'), Buffer.from(empreinteJeton(y), 'hex'));
}

// Le jeton rangé dans la ligne `main` d'UN vendeur (une ligne, un scalaire).
// Rend la chaîne ('' si aucun), ou `undefined` si la base n'a pas répondu.
async function jetonDuVendeur({ url, headers, fetcher, genre, owner }) {
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${encodeURIComponent(owner)}&id=eq.main&select=t:data->>${CHAMP_JETON[genre]}&limit=1`, { headers });
    if (!r || !r.ok) return undefined;
    const j = await r.json();
    if (!Array.isArray(j)) return undefined;
    return j[0] && j[0].t ? String(j[0].t) : '';
  } catch (_) { return undefined; }
}

export async function retirerIndexJeton({ url, headers, fetcher = fetch, genre, jeton }) {
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idIndexJeton(genre, jeton)}`, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } });
    return !!(r && r.ok);
  } catch (_) { return false; }
}

export async function ecrireIndexJeton({ url, headers, fetcher = fetch, genre, jeton, owner, maintenant = Date.now() }) {
  if (!RE_UUID.test(String(owner || '')) || !CHAMP_JETON[genre] || !jeton) return false;
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner: PROPRIETAIRE_NEUTRE, id: idIndexJeton(genre, jeton), data: { owner: String(owner), genre, at: new Date(maintenant).toISOString() }, updated_at: new Date(maintenant).toISOString() }]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
}

// Le vendeur d'un jeton, PAR L'INDEX seul.
//   { etat: 'trouve', owner }  l'index désigne un vendeur ET son `main` porte ce jeton
//   { etat: 'absent' }         aucune ligne d'index (transition : l'appelant fait l'ancienne recherche)
//   { etat: 'perime' }         l'index désigne un vendeur dont le jeton a changé (index retiré, clé refusée)
//   undefined                  pas su (une lecture a raté) ⇒ 503, rien d'écrit ni de retiré
export async function vendeurParIndex({ url, headers, fetcher = fetch, genre, jeton }) {
  if (!CHAMP_JETON[genre] || !jeton) return { etat: 'absent' };
  let ligne;
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idIndexJeton(genre, jeton)}&select=o:data->>owner&limit=1`, { headers });
    if (!r || !r.ok) return undefined;
    const j = await r.json();
    if (!Array.isArray(j)) return undefined;
    ligne = j[0] || null;
  } catch (_) { return undefined; }
  if (!ligne) return { etat: 'absent' };
  const owner = String(ligne.o || '');
  if (!RE_UUID.test(owner)) { await retirerIndexJeton({ url, headers, fetcher, genre, jeton }); return { etat: 'perime' }; }
  const t = await jetonDuVendeur({ url, headers, fetcher, genre, owner });
  if (t === undefined) return undefined;
  if (t && memeJeton(jeton, t)) return { etat: 'trouve', owner };
  await retirerIndexJeton({ url, headers, fetcher, genre, jeton });
  return { etat: 'perime' };
}
