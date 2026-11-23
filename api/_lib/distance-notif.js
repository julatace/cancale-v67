// api/_lib/distance-notif.js
// ────────────────────────────────────────────────────────────────────────────
// (22 nov., ext. 5.436 — `adistance`) « FAIT SUR TON ORDINATEUR ». Un geste commandé à distance
// (iPhone, n'importe où) a été exécuté par l'extension de son ordinateur : elle appelle `/api/push`
// (`action: 'distance'`, l'IDENTIFIANT de la commande seulement). Ici, au nom du vendeur de la
// session, avec la clé de service :
//   · la ligne `cmd_dist_{id}` DE CE VENDEUR est relue (projection scalaire, §4.4) : le corps ne
//     prouve rien — pas d'issue écrite (fait / refusé / pas sûr / expirée) ⇒ rien ne part ;
//   · le texte vient de la LIGNE (geste, avant → après, raison), jamais du corps ;
//   · une notification par issue (étiquette `vrm-dist-{id}-{etat}` : un même téléphone ne la
//     reçoit qu'une fois), qui ouvre « Mes comptes » (la file y est).
// Aucune nouvelle fonction serverless (12 au plus) : une action de plus dans `api/push.js`.
// ────────────────────────────────────────────────────────────────────────────
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { sendPushToAll } from './push.js';
import { lienNotif } from './lien-notif.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const cle = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
export const RE_ID_DIST = /^cmd_dist_[a-z0-9]{8,40}$/;
const SELECT = 'id,etat:meta->>etat,geste:meta->>geste,site:meta->>site,num:meta->>num,avant:meta->>avant,apres:meta->>apres,raison:meta->>raison,code:meta->>code,finiLe:meta->>finiLe';
const FINIS = ['fait', 'refuse', 'incertain', 'expiree'];

const eur = (v) => { const n = Number(v); return v == null || v === '' || !Number.isFinite(n) ? '' : `${String(Math.round(n * 100) / 100).replace('.', ',')} €`; };
const quoi = (l) => (l.num ? `N°${String(l.num).slice(0, 12)} · ` : '');
// Le texte d'une issue (relu de la ligne). `null` ⇒ rien à dire.
export function texteDistance(l) {
  if (!l || !FINIS.includes(String(l.etat || ''))) return null;
  const g = String(l.geste || '');
  if (l.etat === 'fait') {
    const t = {
      prix: `Prix changé${eur(l.avant) && eur(l.apres) ? ` : ${eur(l.avant)} → ${eur(l.apres)}` : ''}`,
      repondre: 'Message envoyé', accepter: `Offre acceptée${eur(l.apres) ? ` à ${eur(l.apres)}` : ''}`, refuser: 'Offre refusée',
      contreOffre: `Contre-offre envoyée${eur(l.apres) ? ` à ${eur(l.apres)}` : ''}`, masquer: 'Annonce masquée', afficher: 'Annonce de nouveau visible',
      republier: 'Annonce republiée', bordereau: 'Bordereau prêt', relire: 'Compte relu',
    }[g] || 'Fait';
    return { title: '✅ Fait sur ton ordinateur', body: `${quoi(l)}${t}` };
  }
  if (l.etat === 'expiree') return { title: '⏳ Geste pas parti', body: `${quoi(l)}ton ordinateur n’avait pas ce compte ouvert pendant 24 h : rien n’a changé.` };
  if (l.etat === 'incertain') return { title: '❔ À vérifier', body: `${quoi(l)}ton ordinateur n’a pas eu de réponse claire : regarde avant de relancer.` };
  return { title: '⛔ Refusé par ton ordinateur', body: `${quoi(l)}${String(l.raison || 'rien n’est parti').slice(0, 160)}` };
}

// Rend { status, envoye, raison } — jamais d'exception.
export async function notifierDistance(idBrut, { fetcher = fetchAvecDelai, envoyer = sendPushToAll } = {}) {
  const id = String(idBrut == null ? '' : idBrut);
  if (!RE_ID_DIST.test(id)) return { status: 400, envoye: false, raison: 'commande invalide' };
  const owner = proprietaireCourant();
  if (!owner) return { status: 401, envoye: false, raison: 'vendeur inconnu' };
  if (!cle()) return { status: 503, envoye: false, raison: 'base injoignable' };
  let rows = null;
  try {
    const r = await fetcher(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}&select=${SELECT}`, { headers: { ...sbCle(cle()) } });
    rows = r && r.ok ? await r.json() : null;
  } catch (_) { rows = null; }
  if (!Array.isArray(rows)) return { status: 503, envoye: false, raison: 'ligne illisible — rien envoyé' };
  const l = rows[0];
  const t = texteDistance(l);
  if (!t) return { status: 200, envoye: false, raison: 'pas d’issue écrite' };
  const envoi = await envoyer({ cat: 'capture', ...t, tag: `vrm-dist-${id}-${l.etat}`, url: lienNotif('adistance', { cible: 'file' }) });
  return { status: 200, envoye: !!(envoi && envoi.sent), raison: (envoi && (envoi.coupe || envoi.erreur || (envoi.calme ? 'heures calmes' : ''))) || '' };
}
