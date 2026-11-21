// ════════════════════════════════════════════════════════════════════════════
//  LE SUIVI D'UN RETOUR — PAR SON N° EXACT (15 nov., lot retours-suivi)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « regarde les retours et câble les numéros de suivi ». Mesuré (lecture
// seule, 15 nov.) : le retour Nike (bordereau de retour, n° Mondial Relay de 8
// chiffres) a été DÉPOSÉ le 10 nov. — Mondial Relay l'a écrit par e-mail (« Votre
// colis est entre de bonnes mains », ligne `email_track_mondialrelay_{n°}`, sens
// sortant) — alors que la carte disait encore « avant demain 10 h ». Le n° de suivi
// lu sur l'ACHAT (`harvest_{uid}_suivi_{tx}`) est celui du colis d'ORIGINE (mesuré :
// BRT Italie, capté le 5 nov., avant le retour) : il ne désigne JAMAIS le retour.
//
// LA RÈGLE (une, l'app ET le serveur) :
//   · le n° d'un retour d'ACHAT vient de SON bordereau de retour (`email_bordretour_{tx}`,
//     même transaction) — rien d'autre ;
//   · un fait de transporteur ne rejoint un retour que par ÉGALITÉ EXACTE du n°
//     normalisé ; deux retours au même n° ⇒ ni l'un ni l'autre (jamais deviné) ;
//   · les faits : les e-mails du transporteur (`email_track_*` : en transit ⇒ déposé,
//     disponible ⇒ au point relais du vendeur, livré/retiré ⇒ livré au vendeur, repart
//     ⇒ revient chez toi) et la lecture chez le transporteur (`depart_*` : prise en
//     charge ⇒ déposé, disponible, livré/retiré, retour à l'expéditeur) — le plus
//     avancé gagne, la date de dépôt est le PREMIER fait ; rien lu ⇒ rien (« pas su »
//     n'est jamais « déposé ») ;
//   · le colis d'un retour est SORTANT : jamais « à retirer » chez lui.
// Module PUR (aucune lecture, aucun module Node) : l'app l'importe.

const str = (v) => String(v == null ? '' : v);
export const normaliserSuiviRetour = (v) => str(v).toUpperCase().replace(/[\s -]+/g, '').trim();
// La clé synchronisée où vit « Déposé » posé par SON clic ({ 'r:{tx}': iso }).
export const ID_RETOURS_DEPOSES_CHAMP = 'vrm_retours_deposes';

// Le retour d'un n° : `rows` = bordereaux de retour projetés ({ tx, article, suivi }) ou null (pas su).
// UN seul n° de transaction ⇒ { tx, article, transporteurPdf } ; zéro ou deux ⇒ null.
export function retourDuSuivi(k, rows) {
  const n = normaliserSuiviRetour(k);
  if (!n || !Array.isArray(rows)) return null;
  const parTx = new Map();
  for (const r of rows) if (r && normaliserSuiviRetour(r.suivi) === n && str(r.tx).trim()) parTx.set(str(r.tx).trim(), r);
  if (parTx.size !== 1) return null;
  const [tx, r] = [...parTx.entries()][0];
  return { tx, article: str(r.article).slice(0, 160), transporteurPdf: str(r.transporteurPdf) };
}

// Le statut d'un e-mail du transporteur, pour un colis de retour.
export function etapeRetourDuSuivi(status) {
  const s = str(status);
  if (s === 'transit') return 'depose';
  if (s === 'available') return 'relais';
  if (s === 'delivered') return 'livre';
  if (s === 'retour') return 'revient';
  return null;
}

const msDe = (v) => { const t = Date.parse(str(v)); return isFinite(t) ? t : null; };
const RANG = { 'en-route': 1, 'relais-vendeur': 2, 'recu-vendeur': 3, revient: 4 };
const ETAPE_TRACK = { depose: 'en-route', relais: 'relais-vendeur', livre: 'recu-vendeur', revient: 'revient' };
const ETAPE_DEPART = { en_route: 'en-route', disponible: 'relais-vendeur', livre: 'recu-vendeur', retire: 'recu-vendeur', retour_expediteur: 'revient' };

// Les faits d'UN n° : `track` = lignes `email_track_*` projetées ({ suivi, status, emailAt|at, retire, carrier }),
// `departs` = Map n° → ligne `depart_` ({ carrier, priseAt, etat, detail, etatAt }). Rend null (rien de lu)
// ou { etape, at, source, deposeAt, deposeSource, carrier }.
export function faitsRetour(suivi, { track = null, departs = null } = {}) {
  const k = normaliserSuiviRetour(suivi);
  if (!k) return null;
  const faits = [];
  for (const t of (Array.isArray(track) ? track : [])) {
    if (!t || normaliserSuiviRetour(t.suivi) !== k) continue;
    const e = ETAPE_TRACK[etapeRetourDuSuivi(t.status)];
    if (!e) continue;
    const at = (e === 'recu-vendeur' ? msDe(t.retire) : null) ?? msDe(t.emailAt) ?? msDe(t.at);
    faits.push({ etape: e, at, source: 'email', carrier: str(t.carrier) });
  }
  const d = departs instanceof Map ? departs.get(k) : null;
  if (d) {
    const prise = msDe(d.priseAt);
    if (prise != null) faits.push({ etape: 'en-route', at: prise, source: 'transporteur', carrier: str(d.carrier) });
    const e = ETAPE_DEPART[str(d.etat)];
    if (e && !(e === 'en-route' && d.detail === 'prepare') && (e !== 'en-route' || prise != null)) faits.push({ etape: e, at: msDe(d.etatAt) ?? prise, source: 'transporteur', carrier: str(d.carrier) });
  }
  if (!faits.length) return null;
  const haut = faits.reduce((a, b) => (RANG[b.etape] > RANG[a.etape] || (RANG[b.etape] === RANG[a.etape] && (b.at || 0) > (a.at || 0)) ? b : a));
  const dates = faits.map((f) => f.at).filter((x) => x != null);
  const premier = dates.length ? Math.min(...dates) : null;
  const src = faits.find((f) => f.at === premier) || faits[0];
  return {
    etape: haut.etape, at: haut.at != null ? new Date(haut.at).toISOString() : null, source: haut.source,
    deposeAt: premier != null ? new Date(premier).toISOString() : null, deposeSource: src.source,
    carrier: haut.carrier || src.carrier || '',
  };
}

// Les n° portés par PLUSIEURS retours (jamais rejoints : ni l'un ni l'autre).
export function suivisPartages(cartes) {
  const vus = new Map();
  for (const c of cartes || []) { const k = normaliserSuiviRetour(c && c.suivi); if (k) vus.set(k, (vus.get(k) || 0) + 1); }
  return new Set([...vus.entries()].filter(([, n]) => n > 1).map(([k]) => k));
}
