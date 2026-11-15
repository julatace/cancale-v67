// ════════════════════════════════════════════════════════════════════════════
//  RECLASSER LES E-MAILS DE RETOUR GARDÉS « INCONNU » (15 nov., lot retours)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « j'ai un retour sur shop_cancale, je te laisse regarder ». Mesuré (lecture
// seule, 15 nov.) : le bordereau de retour reçu le 8 nov. est gardé ENTIER dans
// `email_inconnu_*` (« aucune règle ne le reconnaît » : la règle est arrivée le 11 nov.,
// mise en ligne le 12) — le PDF est dans son corps gardé, mais aucune carte ne l'imprime.
// Idem pour les avis « Retourne ta commande d'ici le … » (aucune règle avant le 15 nov.).
// Ici : relire SES lignes `email_inconnu_*` dont le SUJET est maintenant reconnu, et les
// REJOUER par la vraie route (`traiterEmail`, son propriétaire imposé = celui de la ligne,
// déjà décidé par l'ADRESSE DE RÉCEPTION à l'arrivée, §5 ; la date d'ORIGINE ; sans
// notification). Règles :
//   · rien n'est supprimé : la ligne gardée reste entière (brut compris), marquée `type:
//     'reclasse'` + `reclasseVers` (+ date, `typeAvant`)
//     par lire-fusionner-réécrire (une lecture ratée n'écrit RIEN) ;
//   · idempotent : une ligne marquée n'est plus relue ; la ligne rangée a une clé stable
//     (`email_bordretour_{tx}`, `email_retourdemande_{empreinte du Message-ID}`) ;
//   · seul ce que la route SAIT ranger est rejoué (`prevoir`) : un e-mail encore « à
//     vérifier » reste tel quel (le rejouer le réécrirait daté d'aujourd'hui) ;
//   · « pas su » n'est pas « rien » : une lecture ratée ⇒ `{ ok: false, passu: true }` (503).
// Appelé par `/api/email-rattacher?mode=reclasser` (POST, SA session) — l'app l'appelle
// d'elle-même à l'ouverture d'Achats et de Ma journée (une fois par heure et par appareil).
// Exécuté par scripts/audit-retours-emails.cjs (la vraie route, une fausse base).
import { estBordereauRetour, estDemandeRetourAchat } from './retour-email.js';

export const SUJETS_RETOUR = '(Bordereau de retour|Retourne ta commande)';
export const MAX_RECLASSER = 20;
const enc = encodeURIComponent;

export const requeteAReclasser = (owner) => 'id=like.email_inconnu_*'
  + `&owner=eq.${enc(owner)}`
  + '&data->>type=eq.inconnu'
  + '&data->>subject=match.' + enc(SUJETS_RETOUR)
  + `&select=id,subject:data->>subject,receivedAt:data->>receivedAt,reclasse:data->>reclasseVers&order=id.asc&limit=${MAX_RECLASSER}`;

// Une ligne projetée est-elle à reclasser ? (sujet reconnu, pas déjà faite)
export const aReclasser = (r) => !!r && !r.reclasse && (estBordereauRetour(r.subject) || estDemandeRetourAchat(r.subject));

// Le corps gardé : le JSON de l'e-mail tel qu'arrivé. Coupé (> 200 Ko) ⇒ null (jamais rejoué amputé).
export function corpsGarde(brut) {
  if (brut && typeof brut === 'object') return brut;
  try { const j = JSON.parse(String(brut || '')); return j && typeof j === 'object' ? j : null; } catch (_) { return null; }
}

// `lire(query)` → lignes | null ; `lireLigne(id)` → data | null | undefined (pas su) ;
// `ecrire(id, data)` → vrai si la base a confirmé ; `prevoir(corps, recuLe)` (la route) ;
// `rejouer(corps, recuLe)` → { code, corps } (la vraie route, propriétaire imposé).
export async function reclasserRetours({ owner, lire, lireLigne, ecrire, prevoir, rejouer, maintenant = () => new Date().toISOString() }) {
  if (!owner) return { ok: false, passu: true, raison: 'sans vendeur', faits: [], restes: [] };
  const rows = await lire(requeteAReclasser(owner));
  if (!Array.isArray(rows)) return { ok: false, passu: true, raison: 'lecture des e-mails gardés ratée', faits: [], restes: [] };
  const faits = [], restes = [];
  let passu = false;
  for (const r of rows.filter(aReclasser)) {
    const data = await lireLigne(r.id);
    if (data === undefined) { passu = true; continue; }
    if (!data || data.reclasseVers || data.type !== 'inconnu') continue;
    const corps = corpsGarde(data.brut);
    if (!corps) { restes.push({ id: r.id, raison: 'corps gardé coupé ou illisible' }); continue; }
    const recuLe = data.receivedAt || r.receivedAt || null;
    const p = prevoir(corps, recuLe);
    if (!p) continue;
    if (!p.ok) { restes.push({ id: r.id, famille: p.famille, raison: p.raison }); continue; }
    const res = await rejouer(corps, recuLe);
    const c = (res && res.corps) || {};
    if (!res || res.code === 503 || !c.ok || c.type !== p.famille) { if (!res || res.code >= 500) passu = true; restes.push({ id: r.id, famille: p.famille, raison: 'pas rangé' }); continue; }
    const vers = p.famille === 'bordereau-retour' ? `email_bordretour_${c.transaction}` : String(c.id || '');
    // Lire-fusionner-réécrire : la ligne RELUE, entière, + la marque. Rien n'est retiré.
    const ok = await ecrire(r.id, { ...data, type: 'reclasse', typeAvant: data.type, reclasseVers: vers, reclasseLe: maintenant(), reclasseFamille: p.famille });
    if (!ok) { passu = true; restes.push({ id: r.id, famille: p.famille, raison: 'rangé, marque pas écrite (rejouable sans doublon)' }); continue; }
    faits.push({ id: r.id, famille: p.famille, vers });
  }
  return { ok: !passu, passu, faits, restes };
}
