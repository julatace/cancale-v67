// ════════════════════════════════════════════════════════════════════════════
//  LES ACHATS « QUI T'ATTENDENT » DÉJÀ REÇUS PAR E-MAIL (3 nov.)
//  Avant le 3 nov., les e-mails Vinted « Commande mise à jour pour <titre> »
//  (« Ton achat t'attend au point relais … ») étaient classés « sans action » :
//  aucun colis à retirer (mesuré : 9 colis à Cancale le 2-3 nov., 58 en 30 j).
//  Le serveur les range désormais (api/email-inbound.js, 0a) ; ce module relit
//  ceux DÉJÀ reçus, avec la MÊME règle (api/_lib/achat-arrive-relais.js) : leur
//  corps gardé (`email_inconnu_*.brut`, 2 000 caractères, le lien de la
//  conversation dedans), seulement ceux de la garde d'un point relais, en
//  projection. Une ligne déjà rangée par le serveur (même clé) gagne toujours.
//  Lecture ratée ⇒ la liste telle quelle (rien d'écarté, rien de deviné).
//  Rien n'est écrit : c'est une relecture, idempotente.
// ════════════════════════════════════════════════════════════════════════════
import { arriveeDUnGarde } from '../api/_lib/achat-arrive-relais.js';
import { GARDE_MAX_J } from '../api/_lib/retrait-colis.js';

export const MAX_ARRIVEES = 120;
export const requeteArrivees = (maintenant = Date.now()) => {
  const depuis = new Date(maintenant - Math.max(21, GARDE_MAX_J * 3) * 86400000).toISOString();
  return `id=like.email_inconnu_*&data->>subject=ilike.*Commande%20mise*&data->>receivedAt=gte.${encodeURIComponent(depuis)}`
    + `&or=(data->>brut.ilike.*attend%20au%20point%20relais*,data->>brut.ilike.*attend%20ici*,data->>brut.ilike.*dans%20le%20Point%20Relais*)`
    + `&select=id,subject:data->>subject,receivedAt:data->>receivedAt,brut:data->>brut&order=id.asc&limit=${MAX_ARRIVEES}`;
};

// lignes : les `email_track_*` déjà lus (forme `data`) ; lire(query) → tableau ou lève.
export async function arriveesRelues(lignes, lire, maintenant = Date.now()) {
  if (!Array.isArray(lignes) || typeof lire !== 'function') return lignes;
  try {
    const rows = await lire(requeteArrivees(maintenant));
    if (!Array.isArray(rows) || !rows.length) return lignes;
    const deja = new Set(lignes.map((t) => t && t.cleLigne).filter(Boolean));
    const parCle = new Map();
    for (const r of rows) {
      const l = arriveeDUnGarde(r);
      if (!l || deja.has(l.cleLigne)) continue;
      const p = parCle.get(l.cleLigne);
      // Deux e-mails du même colis (« t'attend » puis « livré au Point Relais ») :
      // la première arrivée, le lieu et le code de l'un ou de l'autre.
      parCle.set(l.cleLigne, p ? { ...l, ...p, arriveLe: [p.arriveLe, l.arriveLe].filter(Boolean).sort()[0], emailAt: [p.emailAt, l.emailAt].filter(Boolean).sort().pop(), receivedAt: [p.receivedAt, l.receivedAt].filter(Boolean).sort().pop(), lieu: p.lieu || l.lieu, code: p.code || l.code, consigne: p.consigne || l.consigne } : { ...l, relueDansEmailGarde: true });
    }
    if (!parCle.size) return lignes;
    return [...lignes, ...parCle.values()].sort((a, b) => new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0));
  } catch (_) { return lignes; }
}
