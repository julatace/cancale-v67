// ════════════════════════════════════════════════════════════════════════════
//  LES NOTIFICATIONS D'UN RETOUR D'ACHAT, AU CRON (15 nov., lot retour-parfait)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « Tu as bien mis en place le retour de mon achat avec son bordereau ? Je veux que ce
// soit parfait et irréprochable. » Avant ce lot, un retour sonnait :
//   · à l'arrivée du bordereau (« À renvoyer : … », api/email-inbound.js) ;
//   · au premier e-mail du transporteur (« Retour déposé », « Retour livré au vendeur ») ;
//   · au remboursement (« Remboursé · 34,32 € », e-mail « … a été remboursée »).
// Il manquait : (1) le RAPPEL de la date limite (la veille au soir, puis le matin du dernier
// jour) — un retour pas déposé à temps, c'est l'article gardé et l'argent parti au vendeur
// (l'avis de Vinted : « Sinon, tu devras la garder et ton paiement sera transféré au vendeur ») ;
// (2) « Retour déposé » / « Livré au vendeur » quand le fait vient de la LECTURE chez le
// transporteur (`depart_*`, Chronopost et Vinted Go lus par le serveur) et non d'un e-mail.
//
// LA RÈGLE (pure ; le cron lit, réserve et envoie — api/ship-reminders.js) :
//   · un retour = un bordereau de retour d'ACHAT (`email_bordretour_{tx}`, sens ≠ vente), son n°
//     de suivi, sa limite LUE (`dateLimiteIso`, heure de Paris) ;
//   · ses faits : `faitsRetour` (api/_lib/retour-suivi.js — le n° EXACT, e-mails ET départs ; un n°
//     porté par deux retours n'est rejoint par rien) ;
//   · RAPPEL seulement si le retour attend son dépôt : aucun fait lu, pas de « Déposé » de SA main
//     (`vrm_retours_deposes`), pas remboursé, limite pas passée ;
//       soir  : la limite tombe DEMAIN (Paris)      ⇒ « Retour à déposer avant demain 10 h »
//       matin : la limite tombe AUJOURD'HUI (Paris)  ⇒ « Dernier jour : retour avant 10 h »
//   · DÉPOSÉ : un fait (en route ou plus loin) daté de moins de 72 h, pas s'il a touché « Déposé »
//     lui-même ; LIVRÉ : « reçu par le vendeur » daté de moins de 72 h ; jamais après un
//     remboursement (le remboursement a sa propre notification) ;
//   · UNE fois chacune : la clé est celle de la voie e-mail (`retour-depose-{tx}`,
//     `retour-livre-{tx}`) et la réservation se fait dans `push_dedup` (comparer-et-échanger) —
//     l'e-mail et la lecture du transporteur ne sonnent jamais tous les deux ;
//   · « pas su » n'annonce rien (une lecture ratée ⇒ aucune notification).
// Jamais « à retirer » : le colis d'un retour est SORTANT (il le dépose, le vendeur le retire).
import { faitsRetour, normaliserSuiviRetour, suivisPartages } from './retour-suivi.js';

export const NOTIF_RETOUR_AGE_MAX_MS = 72 * 3600000;
const str = (v) => String(v == null ? '' : v);
const msDe = (v) => { const t = Date.parse(str(v)); return Number.isFinite(t) ? t : null; };
export function jourParisDe(ms) {
  try { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; } catch (_) { return ''; }
}
export const CLES_NOTIF_RETOUR = Object.freeze({
  veille: (tx) => `retour-rappel-veille-${tx}`,
  jour: (tx) => `retour-rappel-jour-${tx}`,
  depose: (tx) => `retour-depose-${tx}`,     // la clé de la voie e-mail (api/email-inbound.js)
  livre: (tx) => `retour-livre-${tx}`,       // idem
});

// bords   : [{ tx|transaction, suivi, article, dateLimiteIso, dateLimite, sens, transporteurPdf }]
// track   : lignes `email_track_*` projetées ; departs : Map n° → ligne `depart_` (ou null)
// deposes : { 'r:{tx}': iso } (SON clic) ; rembTx : Set des n° remboursés (e-mail)
// moment  : 'matin' | 'soir'
// Rend [{ sorte, cle, tx, article, limite, quand, transporteur }] — rien de lu ⇒ [].
export function notifsRetours({ bords, track = [], departs = null, deposes = {}, rembTx = new Set(), moment = 'matin', maintenant = Date.now() } = {}) {
  if (!Array.isArray(bords)) return [];
  const out = [];
  const liste = bords.filter((b) => b && str(b.sens).toLowerCase() !== 'vente').map((b) => ({ ...b, tx: str(b.tx || b.transaction).trim() })).filter((b) => /^\d{3,20}$/.test(b.tx));
  const partages = suivisPartages(liste);
  const vus = new Set();
  const auj = jourParisDe(maintenant), demain = jourParisDe(maintenant + 86400000);
  for (const b of liste) {
    if (vus.has(b.tx)) continue;
    vus.add(b.tx);
    if (rembTx && typeof rembTx.has === 'function' && rembTx.has(b.tx)) continue;
    const k = normaliserSuiviRetour(b.suivi);
    const f = k && !partages.has(k) ? faitsRetour(k, { track: Array.isArray(track) ? track : null, departs: departs instanceof Map ? departs : null }) : null;
    const lui = !!(deposes && typeof deposes === 'object' && deposes['r:' + b.tx]);
    const article = str(b.article).slice(0, 160);
    if (f) {
      const transporteur = str(b.transporteurPdf || f.carrier);
      const dep = msDe(f.deposeAt);
      if (!lui && dep != null && maintenant - dep <= NOTIF_RETOUR_AGE_MAX_MS && maintenant >= dep) out.push({ sorte: 'retourDepose', cle: CLES_NOTIF_RETOUR.depose(b.tx), tx: b.tx, article, transporteur });
      const at = msDe(f.at);
      if (f.etape === 'recu-vendeur' && at != null && maintenant - at <= NOTIF_RETOUR_AGE_MAX_MS && maintenant >= at) out.push({ sorte: 'retourLivre', cle: CLES_NOTIF_RETOUR.livre(b.tx), tx: b.tx, article });
      continue;
    }
    if (lui) continue;
    const lm = msDe(b.dateLimiteIso);
    if (lm == null || maintenant >= lm) continue;
    const jour = jourParisDe(lm);
    if (moment === 'soir' && jour === demain) out.push({ sorte: 'retourRappel', cle: CLES_NOTIF_RETOUR.veille(b.tx), tx: b.tx, article, limite: new Date(lm).toISOString(), quand: 'veille', heure: /\d\s*h/.test(str(b.dateLimite)), jour });
    if (moment === 'matin' && jour === auj) out.push({ sorte: 'retourRappel', cle: CLES_NOTIF_RETOUR.jour(b.tx), tx: b.tx, article, limite: new Date(lm).toISOString(), quand: 'jour', heure: /\d\s*h/.test(str(b.dateLimite)), jour });
  }
  return out;
}

// La passe du cron, toutes ses entrées injectées (le banc et l'audit l'exécutent telle quelle).
//   lire(path) → lignes | null ; lireDeposes() → objet | null (absent) | undefined (pas su) ;
//   reserver(cle) → true (réservée) · false (déjà dite) · null (pas su) ; envoyer(notif) → résultat ;
//   texte(n) → { title, body } ; active() → bool (la famille « colis »).
export const REQ_BORDS_RETOUR = 'app_data?id=like.email_bordretour_%25&select=tx:meta->>transaction,suivi:meta->>suivi,article:meta->>article,dateLimiteIso:meta->>dateLimiteIso,dateLimite:meta->>dateLimite,sens:meta->>sens,transporteurPdf:meta->>transporteurPdf';
export const reqTrackRetours = (suivis) => `app_data?id=like.email_track_%25&meta->>suivi=in.(${suivis.map(encodeURIComponent).join(',')})&select=suivi:meta->>suivi,status:meta->>status,emailAt:meta->>emailAt,at:meta->>receivedAt,retire:meta->>retireLe,carrier:meta->>carrier`;
export const REQ_REMB = 'app_data?id=like.email_rembachat_%25&select=tx:meta->>transaction';
export async function passeNotifsRetours({ moment = 'matin', maintenant = Date.now(), lire, lireDeparts, lireDeposes, reserver, envoyer, texte, active, lien }) {
  if (!(await active())) return { fait: true, raison: 'désactivé par le vendeur', n: 0 };
  const bords = await lire(REQ_BORDS_RETOUR);
  if (!Array.isArray(bords)) return { fait: false, raison: 'bordereaux de retour illisibles — rien envoyé' };
  if (!bords.length) return { fait: true, n: 0 };
  const suivis = [...new Set(bords.map((b) => normaliserSuiviRetour(b && b.suivi)).filter((k) => /^[A-Z0-9]{6,30}$/.test(k)))];
  const [track, departs, deposes, remb] = await Promise.all([
    suivis.length ? lire(reqTrackRetours(suivis)) : Promise.resolve([]),
    lireDeparts(), lireDeposes(), lire(REQ_REMB),
  ]);
  if (!Array.isArray(track) || !(departs instanceof Map) || deposes === undefined || !Array.isArray(remb)) return { fait: false, raison: 'lecture ratée — rien envoyé' };
  const rembTx = new Set(remb.map((r) => str(r && r.tx).trim()).filter(Boolean));
  const liste = notifsRetours({ bords, track, departs, deposes: deposes || {}, rembTx, moment, maintenant });
  let envoyees = 0, deja = 0, passu = 0;
  for (const n of liste) {
    const r = await reserver(n.cle);
    if (r === null) { passu++; continue; }
    if (r === false) { deja++; continue; }
    const t = texte(n);
    if (!t || !t.title) continue;
    await envoyer({ cat: 'colis', title: t.title, body: t.body, tag: n.cle, url: lien(n), ...(n.limite ? { echeance: n.limite } : {}) });
    envoyees++;
  }
  return { fait: true, n: liste.length, envoyees, deja, passu };
}
