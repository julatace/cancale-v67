// ════════════════════════════════════════════════════════════════════════════
//  « TA REPUBLICATION PROGRAMMÉE N'EST PAS PARTIE » — QUAND AUCUN APPAREIL N'ÉTAIT LÀ
//  (16 nov., lot extension-restes ; reste du lot republier-programme du 11 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien programme « demain 18 h » (src/repubProgramme.js). Le départ se prend sur
// un APPAREIL (VRM ouvert, l'extension, l'onglet vinted.fr du compte) ; quand un
// appareil est là et que ça ne part pas, il le dit lui-même (« pas partie », sa
// notification). Quand AUCUN appareil n'est ouvert, personne ne le disait avant la
// prochaine ouverture. Ici, le serveur — le passage de 15 min (`?moment=groupe`,
// .github/workflows/notifs-groupees.yml), aucune fonction api/ de plus — lit
// l'INDEX que l'app pose dans `vrm_repub_programme` (`attentes`, `prochaineFin`,
// `indexAttentes`) et prévient UNE fois par programmation.
//
// ⚠️ LE SERVEUR NE LANCE RIEN et n'écrit JAMAIS `vrm_repub_programme` (le départ et
//    l'état restent à l'appareil, comparer-et-échanger sur `data.rev`). Il ne fait
//    que dire « pas partie, aucun appareil n'a lancé ».
// ⚠️ « PAS PARTIE » SE PROUVE PAR L'INDEX : encore « en attente » après la fenêtre
//    (10 min, la même que l'app) + une marge pour l'appareil qui écrit (5 min).
//    Index illisible, mémo illisible ⇒ RIEN ne part (« pas su » ≠ « pas partie »).
//    Plus de 24 h après l'heure ⇒ plus rien (l'app le dira à l'ouverture).
// ⚠️ Famille « Rappels » (`rappel`) — il a posé l'heure lui-même. Le texte ne porte
//    ni titre, ni N°, ni prix : le compte (son nom à lui), l'heure, le nombre.
// Pur : aucune lecture, aucune écriture.

export const LIGNE_PROGRAMME = 'vrm_repub_programme';
export const MEMO_PROGRAMME = 'repub_programme_notif';
export const FENETRE_DEPART_MS = 10 * 60000;   // = src/repubProgramme.js (audit-republier-programme le vérifie)
export const MARGE_APPAREIL_MS = 5 * 60000;    // un appareil en retard a le temps d'écrire « partie » / « pas partie »
export const MAX_AGE_MS = 24 * 3600e3;
export const MEMO_JOURS = 8;

const str = (v) => String(v == null ? '' : v).trim();
const ms = (v) => { const t = typeof v === 'number' ? v : Date.parse(String(v || '')); return Number.isFinite(t) ? t : null; };

// Les programmations restées « en attente » après la fenêtre, pas encore dites.
// `attentes` : l'index de l'app (tableau) ; `envoyes` : { [cle]: iso }.
export const cleManque = (a) => `${a.uid}:${a.id}:${a.at}`;
export function programmesManques(attentes, envoyes, maintenant = Date.now()) {
  if (!Array.isArray(attentes)) return null;
  const vus = envoyes && typeof envoyes === 'object' ? envoyes : {};
  const out = [];
  for (const x of attentes) {
    if (!x || typeof x !== 'object') continue;
    const uid = str(x.uid), id = str(x.id), at = ms(x.at);
    if (!/^\d{1,20}$/.test(uid) || !id || at == null) continue;
    const a = { uid, id, at: new Date(at).toISOString(), compte: str(x.compte).slice(0, 40), n: Number.isInteger(x.n) && x.n > 0 ? x.n : null };
    if (maintenant < at + FENETRE_DEPART_MS + MARGE_APPAREIL_MS) continue;
    if (maintenant - at > MAX_AGE_MS) continue;
    if (vus[cleManque(a)]) continue;
    out.push(a);
  }
  return out.sort((p, q) => Date.parse(p.at) - Date.parse(q.at));
}
export function memoApres(envoyes, dus, maintenant = Date.now()) {
  const v = { ...(envoyes && typeof envoyes === 'object' ? envoyes : {}) };
  for (const a of dus || []) v[cleManque(a)] = new Date(maintenant).toISOString();
  const lim = maintenant - MEMO_JOURS * 86400e3;
  for (const k of Object.keys(v)) if (!(ms(v[k]) >= lim)) delete v[k];
  return v;
}
const heureParis = (iso) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', ' h '); } catch (_) { return ''; } };
export function texteManque(dus) {
  const l = Array.isArray(dus) ? dus : [];
  if (!l.length) return null;
  if (l.length === 1) {
    const a = l[0];
    const sur = a.compte ? ` sur ${a.compte}` : '';
    const quoi = a.n ? ` (${a.n > 1 ? `${a.n} annonces` : '1 annonce'})` : '';
    return { title: 'Republication programmée pas partie', body: `Prévue à ${heureParis(a.at)}${sur}${quoi} : aucun appareil n’était ouvert, rien n’a été envoyé. Ouvre VRM pour la reprogrammer.` };
  }
  return { title: `${l.length} republications programmées pas parties`, body: 'Aucun appareil n’était ouvert à l’heure : rien n’a été envoyé. Ouvre VRM pour les reprogrammer.' };
}
// Le lien : Annonces → Republier (la carte « pas partie » de l'app).
export const URL_REPUBLIER = '/?tab=annonces&vue=republier';
