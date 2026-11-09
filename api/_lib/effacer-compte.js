// api/_lib/effacer-compte.js
// ════════════════════════════════════════════════════════════════════════════
// L'EFFACEMENT D'UN COMPTE — UNE fonction (9 novembre), celle de « Supprimer mon
// compte » (api/compte.js, `?mode=supprimer`) ET du départ des clients partis
// (api/_lib/clients-partis.js, 12 mois après la fin de l'abonnement).
// Elle ne vérifie RIEN de l'identité : l'appelant a déjà prouvé qui est `owner`
// (jeton + confirmation forte, ou statut Stripe relu), refusé le propriétaire
// de l'installation, et fait l'inventaire (une lecture ratée ⇒ jamais ici).
//
// ⚠️ L'ORDRE, CHOISI POUR QU'UN ÉCHEC SE RATTRAPE : chaque étape n'a lieu que si
//    la précédente a réussi ; le compte de connexion part EN DERNIER (tant qu'il
//    existe, la suppression se relance — elle est idempotente : rejouée, chaque
//    étape efface 0 ligne, un compte déjà parti (404) compte comme parti).
// ⚠️ CE QUI EST GARDÉ : ses FACTURES PRO émises (`email_invoice_*`) — pièces
//    comptables que la loi garde 10 ans (art. L123-22 C. com.) — restent sous son
//    identifiant, figées, sans accès (plus de compte), et une ligne neutre
//    `vrm_factures_gardees_{uid}` dit jusqu'à quand ; `purgerFacturesGardees`
//    (cron du matin) les efface à l'échéance.
// ⚠️ CHAQUE suppression porte `owner=eq.<lui>` (ou, sous le neutre, `data->>owner`
//    / `data->>de` = lui) : `scripts/audit-supprimer-compte.cjs` sert deux
//    vendeurs et exige que l'autre reste intact.
import { sbCle } from './cle.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';
import { effacerEquipe } from './equipe.js';
import { effacerCommunaute } from './communaute.js';
import { effacerFavorisDe } from './favoris-confidentialite.js';
import { lignesPriveesProfil } from './profil-avatar.js';
import { requetes } from './suppression-compte.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const FACTURES_ANS = 10;
export const PREFIXE_FACTURES_GARDEES = 'vrm_factures_gardees_';
export const idFacturesGardees = (owner) => PREFIXE_FACTURES_GARDEES + String(owner).toLowerCase().replace(/-/g, '');
const nb = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

// Supprime au nom du SERVEUR. Le nombre effacé (`Content-Range: */N`), 0 si la
// table n'existe pas ici (404), `null` si la base a refusé ou n'a pas répondu.
export async function effacer(url, service, chemin) {
  try {
    const r = await fetch(`${url}/rest/v1/${chemin}`, { method: 'DELETE', headers: { ...sbCle(service), Prefer: 'count=exact,return=minimal' } });
    if (r.status === 404) return 0;
    if (!r.ok) return null;
    const m = /\/(\d+)\s*$/.exec((r.headers && r.headers.get && r.headers.get('content-range')) || '');
    return m ? Number(m[1]) : 0;
  } catch (_) { return null; }
}

// Le cache de photos détourées (compartiment privé `detourage`, dossier `{owner}/`).
export async function viderCacheDetourage(url, service, owner) {
  let n = 0;
  try {
    for (let tour = 0; tour < 50; tour++) {
      const l = await fetch(`${url}/storage/v1/object/list/detourage`, { method: 'POST', headers: { ...sbCle(service), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: owner, limit: 100, offset: 0 }) });
      if (l.status === 404 || l.status === 400) return n;
      if (!l.ok) return null;
      const items = await l.json();
      if (!Array.isArray(items)) return null;
      const noms = items.map((x) => x && x.name).filter((x) => typeof x === 'string' && x && !x.includes('/') && x !== '.emptyFolderPlaceholder');
      if (!noms.length) return n;
      const d = await fetch(`${url}/storage/v1/object/detourage`, { method: 'DELETE', headers: { ...sbCle(service), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: noms.map((x) => `${owner}/${x}`) }) });
      if (!d.ok) return null;
      n += noms.length;
    }
    return null;                                      // trop long : on ne dit pas « fini »
  } catch (_) { return null; }
}

async function poserFacturesGardees(url, service, owner, n, maintenant) {
  const at = new Date(maintenant).toISOString();
  const jusque = new Date(maintenant + FACTURES_ANS * 365.25 * 864e5).toISOString();
  try {
    const r = await fetch(`${url}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner: PROPRIETAIRE_NEUTRE, id: idFacturesGardees(owner), data: { owner: String(owner).toLowerCase(), n, depuis: at, jusque }, updated_at: at }]),
    });
    return r.ok;
  } catch (_) { return false; }
}

// `inv` : l'inventaire lu juste avant (api/_lib/suppression-compte.js).
// Rend { ok, etapes, fait, pasFait } — `fait`/`pasFait` en phrases.
export async function effacerCompte({ url, service, owner, proprio, inv, maintenant = Date.now() }) {
  if (!UUID.test(String(owner || '')) || owner === PROPRIETAIRE_NEUTRE || !service) return { ok: false, etapes: {}, fait: [], pasFait: ['tout'] };
  const q = requetes(owner, proprio);
  const etapes = {};
  const fait = [], pasFait = [];
  const enchaine = [
    ['profilPrive', () => effacer(url, service, `app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=in.(${lignesPriveesProfil(owner).join(',')})`), 'ta photo de profil'],
    ['preuvesAdresse', () => effacer(url, service, q.preuvesAdresse), 'tes adresses de réception confirmées'],
    ['indexJetons', () => effacer(url, service, q.indexJetons), 'tes adresses VRM (réception, widget, SMS)'],
    ['favoris', () => effacerFavorisDe(owner), 'la file des messages aux favoris'],
    ['signalements', () => (q.signalements ? effacer(url, service, q.signalements) : 0), 'tes signalements de problème'],
    // Les factures Pro d'abord MISES DE CÔTÉ (la ligne qui dit jusqu'à quand),
    // puis toutes ses lignes SAUF elles.
    ['facturesGardees', async () => (inv && inv.facturesPro > 0 ? ((await poserFacturesGardees(url, service, owner, inv.facturesPro, maintenant)) ? inv.facturesPro : null) : 0), 'la mise de côté de tes factures Pro'],
    ['donnees', () => effacer(url, service, `${q.donnees}&id=not.like.email_invoice_*`), 'tes données'],
    ['comptesVinted', () => effacer(url, service, q.comptesVinted), 'tes comptes Vinted'],
    ['compteurs', () => effacer(url, service, `detourage_usage?owner=eq.${encodeURIComponent(owner)}`), 'tes compteurs de détourage'],
    ['equipe', () => effacerEquipe(owner, service), 'ton équipe'],
    ['communaute', () => effacerCommunaute(owner, service), 'ta présence sur la carte de la communauté'],
    ['photos', () => viderCacheDetourage(url, service, owner), 'tes photos détourées'],
  ];
  let casse = false;
  for (const [k, f, nom] of enchaine) {
    if (casse) { etapes[k] = null; pasFait.push(nom); continue; }
    let v; try { v = await f(); } catch (_) { v = null; }
    if (v === null || v === undefined) { etapes[k] = null; casse = true; pasFait.push(nom); } else etapes[k] = v;
  }
  let connexion = false;
  if (!casse) {
    try {
      const r = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(owner)}`, { method: 'DELETE', headers: sbCle(service) });
      connexion = r.ok || r.status === 404;           // déjà parti : rejoué, c'est fait
    } catch (_) { connexion = false; }
  }
  etapes.connexion = connexion ? 'supprimee' : 'conservee';
  if (!connexion) pasFait.push('ton compte de connexion');
  if (etapes.donnees != null) fait.push(`tes données effacées (${nb(etapes.donnees, 'élément', 'éléments')})`);
  if (etapes.comptesVinted != null) fait.push(nb(etapes.comptesVinted, 'compte Vinted délié', 'comptes Vinted déliés'));
  if (etapes.preuvesAdresse > 0) fait.push('tes adresses de réception confirmées effacées');
  if (etapes.indexJetons > 0) fait.push('tes adresses VRM désactivées');
  if (etapes.signalements > 0) fait.push(nb(etapes.signalements, 'signalement effacé', 'signalements effacés'));
  if (etapes.equipe > 0) fait.push(nb(etapes.equipe, 'invitation d’équipe effacée', 'invitations d’équipe effacées'));
  if (etapes.communaute > 0) fait.push('ta présence sur la carte de la communauté effacée');
  if (etapes.photos > 0) fait.push(nb(etapes.photos, 'photo détourée effacée', 'photos détourées effacées'));
  if (connexion) fait.push('ton compte de connexion supprimé');
  if (etapes.facturesGardees > 0) fait.push(`${nb(etapes.facturesGardees, 'facture Pro gardée', 'factures Pro gardées')} 10 ans (obligation légale), sans accès`);
  return { ok: !casse && connexion, etapes, fait, pasFait };
}

// Les factures Pro gardées dont les 10 ans sont passés : effacées, puis leur
// ligne neutre. Une lecture ratée n'efface rien. Borné à `max` par passage.
export async function purgerFacturesGardees({ url, service, maintenant = Date.now(), max = 20 }) {
  if (!service) return { fait: false, raison: 'non-configure' };
  let rows;
  try {
    const r = await fetch(`${url}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=like.${PREFIXE_FACTURES_GARDEES}*&data->>jusque=lt.${encodeURIComponent(new Date(maintenant).toISOString())}&select=id,o:data->>owner&limit=${max}`, { headers: sbCle(service) });
    if (!r.ok) return { fait: false, raison: 'lecture' };
    rows = await r.json();
    if (!Array.isArray(rows)) return { fait: false, raison: 'lecture' };
  } catch (_) { return { fait: false, raison: 'lecture' }; }
  let purges = 0;
  for (const x of rows) {
    const o = String((x && x.o) || '').toLowerCase();
    if (!UUID.test(o) || o === PROPRIETAIRE_NEUTRE || x.id !== idFacturesGardees(o)) continue;
    const n = await effacer(url, service, `app_data?owner=eq.${o}&id=like.email_invoice_*`);
    if (n === null) continue;
    if ((await effacer(url, service, `app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${x.id}`)) !== null) purges++;
  }
  return { fait: true, purges };
}
