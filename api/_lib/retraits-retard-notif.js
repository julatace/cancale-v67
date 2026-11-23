// api/_lib/retraits-retard-notif.js
// ────────────────────────────────────────────────────────────────────────────
// (21 nov., ext. 5.426 — « une paire vendue est retirée partout ») UN RETRAIT N'A PAS PU SE FAIRE DEPUIS 30 MIN.
// L'extension tient son registre `vrm_retraits_partout` (par annonce : site, N°, état, `depuis` = l'heure où le retrait
// a été vu à faire, `alerteAt` = l'heure où elle a demandé de sonner). Elle appelle `/api/push` (`action: 'retraits'`)
// SANS rien dans le corps. Ici, au nom du vendeur de la session, avec la clé de service :
//   · la ligne DE CE VENDEUR est relue (illisible ⇒ 503, rien n'est envoyé) ;
//   · ne sonne que ce qui est VRAIMENT en retard : pas fait (ni retirée, ni hors ligne), vu il y a plus de 30 min, et
//     marqué par l'extension dans les 10 dernières minutes (la sonnerie qu'elle a demandée, pas une ancienne) ;
//   · UNE notification qui les regroupe (« 2 paires vendues encore en ligne »), étiquetée par annonce et par retard
//     (un même téléphone ne la reçoit qu'une fois), qui ouvre Ventes. Aucun titre, aucun montant : le N° et le site.
// Aucune nouvelle fonction serverless (12 au plus).
// ────────────────────────────────────────────────────────────────────────────
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { sendPushToAll } from './push.js';
import { lienNotif } from './lien-notif.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const cle = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
export const RETARD_MS = 30 * 60000;
export const SONNERIE_FENETRE_MS = 10 * 60000;
const FAITS = ['retiree', 'hors-ligne'];
const NOM = { leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', vinted: 'Vinted', ebay: 'eBay' };

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

// Les retraits en retard à sonner MAINTENANT (règle pure, servie par le banc).
export function retraitsEnRetard(items, maintenant = Date.now()) {
  const out = [];
  for (const [k, r] of Object.entries(items && typeof items === 'object' && !Array.isArray(items) ? items : {})) {
    if (!r || typeof r !== 'object' || !NOM[r.site] || FAITS.includes(r.etat)) continue;
    const depuis = Number(r.depuis), alerte = Number(r.alerteAt);
    if (!(depuis > 0) || maintenant - depuis <= RETARD_MS) continue;
    if (!(alerte > 0) || maintenant - alerte > SONNERIE_FENETRE_MS || alerte > maintenant + 60000) continue;
    out.push({ cle: String(k).slice(0, 80), site: r.site, num: String(r.num || '').replace(/[^\w+-]/g, '').slice(0, 24), etat: String(r.etat || ''), depuis, alerte });
  }
  return out.sort((a, b) => a.depuis - b.depuis);
}
export function texteRetraits(l) {
  const n = l.length;
  const sites = [...new Set(l.map((x) => NOM[x.site]))].join(', ');
  const nums = l.slice(0, 3).map((x) => (x.num ? 'N°' + x.num : '')).filter(Boolean).join(', ');
  return {
    title: n > 1 ? `⚠️ ${n} paires vendues encore en ligne` : '⚠️ Une paire vendue encore en ligne',
    body: `${nums ? nums + ' · ' : ''}${sites} : pas encore retirée${n > 1 ? 's' : ''} depuis 30 min — risque de double vente. Ouvre ${sites} ou retire-la${n > 1 ? 's' : ''} toi-même.`,
  };
}

// Rend { status, envoye, n, raison } — jamais d'exception.
export async function notifierRetraitsEnRetard({ maintenant = Date.now() } = {}) {
  if (!proprietaireCourant()) return { status: 401, envoye: false, raison: 'vendeur inconnu' };
  const rows = await lire('app_data?id=eq.vrm_retraits_partout&select=items:data->items');
  if (rows === null) return { status: 503, envoye: false, raison: 'registre illisible — rien envoyé' };
  const l = retraitsEnRetard(rows[0] && rows[0].items, maintenant);
  if (!l.length) return { status: 200, envoye: false, n: 0, raison: 'aucun retrait en retard' };
  const tag = 'vrm-retraits-' + l.map((x) => x.cle + '@' + x.depuis).join(',').replace(/[^\w:@,-]/g, '').slice(0, 120);
  const envoi = await sendPushToAll({ cat: 'capture', urgent: true, ...texteRetraits(l), tag, url: lienNotif('ventes') });
  return { status: 200, envoye: !!(envoi && envoi.sent), n: l.length, raison: (envoi && (envoi.coupe || envoi.erreur || (envoi.calme ? 'heures calmes' : ''))) || '' };
}
