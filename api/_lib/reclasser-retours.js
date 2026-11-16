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
import { transporteurDuPdf, champsPdf, REGLE_PDF } from './transporteur-pdf.js';   // (15 nov., lot retour-parfait)

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

// ════════════════════════════════════════════════════════════════════════════
//  (15 nov., lot retour-parfait) LE TRANSPORTEUR DES BORDEREAUX DE RETOUR D'AVANT
// ════════════════════════════════════════════════════════════════════════════
// Julien : « Tu as bien mis en place le retour de mon achat avec son bordereau ? Je veux que ce
// soit parfait et irréprochable. » Mesuré (lecture seule, 15 nov.) : le bordereau de retour reçu
// à 13 h (n° de la forme `XU#########JF`) n'a PAS de `transporteurPdf` — la ligne est d'avant la
// mise en ligne qui lit l'étiquette à la réception (lot retours-suivi). Son PDF, lu en lecture
// seule, nomme Chronopost (« Chrono Relais Europe », pied « Chronopost … 75014 Paris ») : sans le
// champ, la carte ne savait ni le logo, ni la page de suivi, et le serveur ne lisait pas son
// départ (`carrierDepart` : la forme seule ne prouve pas Chronopost).
// Ici : la MÊME lecture que la réception (`transporteurDuPdf`, api/_lib/transporteur-pdf.js — un
// seul nom ⇒ sa clé ; deux ⇒ rien ; illisible ⇒ rien), en rattrapage, par
// `/api/email-rattacher?mode=reclasser` (SA session, l'app l'appelle à l'ouverture d'Achats et de
// Ma journée). Règles :
//   · SES lignes seulement (`owner` = lui), `email_bordretour_*` avec PDF (`meta._pdf`) jamais
//     lues (`meta.pdfLu` absent) — idempotent : une ligne lue porte `pdfLu` et n'est plus relue ;
//   · borné : `MAX_TRANSP_RETOURS` lignes par appel, UNE ligne par lecture (`id=eq.`) ;
//   · n'écrit QUE le manquant : `pdfLu` (la marque), `transporteurPdf` / `suiviPdf` seulement
//     s'ils sont absents ET lus — rien d'autre ne change (lire-fusionner-réécrire) ;
//   · une lecture ratée n'écrit RIEN (`passu`) ; l'écriture est CONDITIONNELLE (`pdfLu` toujours
//     absent en base au moment d'écrire) : une réception rejouée entre-temps n'est jamais écrasée ;
//   · §4.4 : `select=data` sur UNE ligne désignée par son id, une fois dans sa vie (la marque),
//     jamais sur une liste.
export const MAX_TRANSP_RETOURS = 4;
export const requeteRetoursSansTransporteur = (owner) => 'id=like.email_bordretour_*'
  + `&owner=eq.${enc(owner)}`
  + '&meta->>_pdf=eq.true&meta->>pdfLu=is.null'
  + `&select=id,tx:meta->>transaction&order=id.asc&limit=${MAX_TRANSP_RETOURS}`;

// Les champs à AJOUTER à une ligne (jamais un champ présent remplacé) — pur.
export function champsManquantsRetour(data, decision) {
  if (!data || typeof data !== 'object' || !decision) return null;
  if (data.pdfLu != null && data.pdfLu !== '') return null;
  const c = champsPdf(decision);
  const out = { pdfLu: c.pdfLu, pdfRegle: REGLE_PDF };
  if (!String(data.transporteurPdf || '').trim() && c.transporteurPdf) out.transporteurPdf = c.transporteurPdf;
  if (!String(data.suiviPdf || '').trim() && c.suiviPdf) out.suiviPdf = c.suiviPdf;
  return out;
}

// `lire(query)` → lignes | null ; `lireLigne(id)` → data | null | undefined (pas su) ;
// `ecrireSi(id, data)` → true (écrite) · false (la ligne a changé : rien écrit) · null (pas su).
// `lirePdf(b64)` → la décision (par défaut `transporteurDuPdf`).
export async function transporteursRetours({ owner, lire, lireLigne, ecrireSi, lirePdf = transporteurDuPdf }) {
  if (!owner) return { ok: false, passu: true, faits: [] };
  const rows = await lire(requeteRetoursSansTransporteur(owner));
  if (!Array.isArray(rows)) return { ok: false, passu: true, faits: [] };
  const faits = [];
  let passu = false;
  for (const r of rows.slice(0, MAX_TRANSP_RETOURS)) {
    if (!r || !/^email_bordretour_\d{3,20}$/.test(String(r.id || ''))) continue;
    const data = await lireLigne(r.id);
    if (data === undefined) { passu = true; continue; }          // pas su ⇒ rien écrit
    if (!data || typeof data.pdfB64 !== 'string' || !data.pdfB64) continue;
    let d = null;
    try { d = await lirePdf(data.pdfB64); } catch (_) { d = null; }
    if (!d) continue;
    const plus = champsManquantsRetour(data, d);
    if (!plus) continue;
    const ok = await ecrireSi(r.id, { ...data, ...plus });
    if (ok === null) { passu = true; continue; }
    if (ok) faits.push({ id: r.id, transporteur: plus.transporteurPdf || '', lu: plus.pdfLu });
  }
  return { ok: !passu, passu, faits };
}
