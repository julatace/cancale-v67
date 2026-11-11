// api/_lib/compte-relie.js
// ────────────────────────────────────────────────────────────────────────────
// (8 nov.) « UN NOUVEAU COMPTE EST RELIÉ » — LA NOTIFICATION, CÔTÉ SERVEUR.
// La règle (identité, mémoire, une fois) est src/compteRelie.js, la même que
// l'app (§11). Ici, au nom du vendeur du `contexteVendeur` courant, avec la clé
// de service :
//   1. lire les comptes PRÉSENTS — Vinted (`vinted_accounts`, moins
//      `vrm_blocked_accounts`), Leboncoin (`lbc_accounts`), Vestiaire
//      (`vc_session`), eBay (`ebay_comptes`) ; une lecture ratée ⇒ plateforme
//      « pas su », jamais « aucun compte » ;
//   2. dans SA ligne `vrm_comptes_relies` (comparer-et-échanger sur `rev`) :
//      ajouter les identités jamais vues (le serveur ne pose JAMAIS de point de
//      départ : ligne absente ou plateforme sans départ ⇒ rien, c'est l'app qui
//      le pose sur une lecture réussie) et RÉSERVER `notifie` des comptes à
//      notifier — l'écriture confirmée AVANT l'envoi : deux appels en même temps
//      n'envoient qu'une fois ;
//   3. une notification (famille « Nouveau compte relié », allumée par défaut,
//      heures calmes et regroupement de `sendPushToAll`), rangée dans la cloche.
// Appelée par l'app (`/api/push`, action `comptes`, quand elle voit un compte
// neuf) et par le cron du matin et du soir (api/ship-reminders.js), le filet
// quand aucune app n'est ouverte. Aucune nouvelle fonction (12 au plus).
// ────────────────────────────────────────────────────────────────────────────
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { sendPushToAll, pushCategorieActive } from './push.js';
import { DESTINATIONS } from './lien-notif.js';
import { LIGNE_COMPTES_RELIES, CAT_COMPTE_RELIE, comptesPresents, fusionnerComptes, aNotifier, marquer, normaliserMemoire, texteCompteRelie, decouperCle } from '../../src/compteRelie.js';
import { comptesLbcLies, comptesVcLies, comptesEbayLies } from '../../src/comptesLies.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const cle = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// Un tableau lu, ou `null` (pas su, ou pas de vendeur).
async function lire(chemin) {
  const owner = proprietaireCourant();
  if (!owner || !cle()) return null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${chemin}${chemin.includes('?') ? '&' : '?'}owner=eq.${encodeURIComponent(owner)}`, { headers: { ...sbCle(cle()) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}

// Les comptes présents de CE vendeur, par plateforme (`null` = pas su).
export async function lireComptesPresents() {
  const [va, bl, lbc, vc, eb] = await Promise.all([
    lire('vinted_accounts?select=vinted_user_id,login'),
    lire('app_data?id=eq.vrm_blocked_accounts&select=u:data->uids'),
    lire('app_data?id=eq.lbc_accounts&select=a:data->accounts'),
    lire('app_data?id=eq.vc_session&select=id:data->>id,at:data->>at,comptes:data->comptes'),
    lire('app_data?id=eq.ebay_comptes&select=comptes:data->comptes'),
  ]);
  let vinted = null;
  if (Array.isArray(va) && Array.isArray(bl)) {
    const noirs = new Set(((bl[0] && Array.isArray(bl[0].u)) ? bl[0].u : []).map(String));
    vinted = va.map((a) => ({ id: String((a && a.vinted_user_id) || ''), nom: String((a && a.login) || '') })).filter((a) => a.id && !noirs.has(a.id));
  }
  const leboncoin = Array.isArray(lbc) ? comptesLbcLies(objet(lbc[0] && lbc[0].a), {}) : null;
  const vestiaire = Array.isArray(vc) ? comptesVcLies(vc[0] || null) : null;
  const ebay = Array.isArray(eb) ? comptesEbayLies({ comptes: eb[0] && eb[0].comptes }) : null;
  return { vinted, leboncoin, vestiaire, ebay };
}

// Comparer-et-échanger sur `data.rev` de SA ligne. `modifier(d)` reçoit l'objet
// lu (`null` = ligne absente) et rend l'objet à écrire, ou `undefined` (rien).
// Rend true (écrit) · false (rien à écrire) · null (pas su).
async function modifierLigne(modifier, essais = 5) {
  const owner = proprietaireCourant();
  if (!owner || !cle()) return null;
  const tete = { ...sbCle(cle()), 'Content-Type': 'application/json' };
  for (let n = 0; n < essais; n++) {
    const rows = await lire(`app_data?id=eq.${LIGNE_COMPTES_RELIES}&select=data`);
    if (rows === null) return null;
    const present = !!rows[0];
    const d = present ? (rows[0].data || {}) : null;
    const nouveau = modifier(d);
    if (nouveau === undefined) return false;
    const rev0 = (d && Number.isSafeInteger(d.rev) && d.rev >= 0) ? d.rev : null;
    const data = { ...nouveau, rev: (rev0 || 0) + 1 };
    try {
      if (!present) {
        const w = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
          method: 'POST', headers: { ...tete, Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify([{ owner, id: LIGNE_COMPTES_RELIES, data }]),
        });
        if (!w.ok) return null;
        const out = await w.json().catch(() => null);
        if (!Array.isArray(out)) return null;
        if (out.length >= 1) return true;
        continue;
      }
      const garde = rev0 == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev0}`;
      const w = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${LIGNE_COMPTES_RELIES}&owner=eq.${encodeURIComponent(owner)}&${garde}&select=id`, {
        method: 'PATCH', headers: { ...tete, Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
      });
      if (!w.ok) return null;
      const out = await w.json().catch(() => null);
      if (!Array.isArray(out)) return null;
      if (out.length >= 1) return true;
      await new Promise((ok) => setTimeout(ok, 25 * (n + 1)));
    } catch (_) { return null; }
  }
  return null;
}

// Rend { status, envoye, n, raison } — jamais d'exception.
export async function notifierComptesRelies({ maintenant = Date.now() } = {}) {
  if (!proprietaireCourant()) return { status: 401, envoye: false, n: 0, raison: 'vendeur inconnu' };
  const par = await lireComptesPresents();
  const presents = comptesPresents(par);
  if (!presents.lues.length) return { status: 503, envoye: false, n: 0, raison: 'comptes illisibles — rien envoyé' };
  const actif = await pushCategorieActive(CAT_COMPTE_RELIE);
  let reserves = [], memoFinal = null;
  const r = await modifierLigne((d) => {
    reserves = [];
    if (d === null) return undefined;                      // pas de point de départ : c'est l'app qui le pose
    const f = fusionnerComptes(d, presents, { maintenant, sansBase: true });
    let m = f.memo, change = f.change;
    if (actif) {
      reserves = aNotifier(m, presents, maintenant);
      if (reserves.length) { m = marquer(m, reserves, 'notifie', maintenant); change = true; }
    }
    memoFinal = m;
    return change ? m : undefined;
  });
  if (r === null) return { status: 503, envoye: false, n: 0, raison: 'mémoire illisible ou pas écrite — rien envoyé' };
  if (!actif) return { status: 200, envoye: false, n: 0, raison: 'désactivé par le vendeur' };
  if (r !== true || !reserves.length) return { status: 200, envoye: false, n: 0, raison: 'aucun compte neuf à annoncer' };
  const m = normaliserMemoire(memoFinal);
  const comptes = reserves.map((k) => { const c = decouperCle(k); const p = presents.liste.find((x) => x.cle === k); return { plateforme: c.plateforme, id: c.id, nom: (p && p.nom) || (m.connus[k] && m.connus[k].nom) || '' }; });
  const tx = texteCompteRelie(comptes);
  const envoi = await sendPushToAll({ cat: CAT_COMPTE_RELIE, ...tx, tag: 'vrm-compte-' + reserves.join('|').slice(0, 60), url: DESTINATIONS.comptes() });
  return { status: 200, envoye: !!(envoi && envoi.sent), n: reserves.length, raison: envoi && (envoi.coupe || envoi.erreur || (envoi.calme ? 'heures calmes' : '')) || '' };
}
