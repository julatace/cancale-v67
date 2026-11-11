// ─────────────────────────────────────────────────────────────────────────────
// LE SUIVI DES COMMANDES EN COURS (11 nov., lot `suivi-commandes`) — la RÈGLE,
// pure. Aucune lecture réseau, aucune écriture : importée par l'app (Ventes,
// Achats, Ma journée) et lisible par le serveur, §11 — une règle, un propriétaire.
//
// Julien (11 nov.) : « intègre les numéros de suivi sur les commandes en cours,
// comme ça tu regardes leur statut pour voir la cohérence ; est-ce que tu
// regardes les infos de suivi ? ».
//
// CE QUE ÇA FAIT
//  1. `dernierStatut` : le DERNIER statut connu d'un n° de suivi, avec SA source
//     (transporteur / e-mail / Vinted) et l'heure — « Pris en charge · Lyon ·
//     hier 18:02 ». La source la plus FRAÎCHE (date de l'évènement) l'emporte ;
//     à égalité, le transporteur. Rien de lu ⇒ null (jamais « en transit » deviné).
//  2. `incoherencesVente` / `incoherencesAchat` : les VRAIES incohérences, sur des
//     preuves DATÉES. « Pas su » n'est jamais une incohérence : une lecture
//     absente, ratée, ancienne (plus de 24 h) ou faite AVANT le fait comparé ne
//     décide rien. Chaque incohérence : une phrase courte + UN geste.
//  3. `estEnCours` : un colis livré, retiré, rendu ou finalisé sort des « en cours ».
//
// L'IDENTITÉ (§5) : le n° de suivi vient TOUJOURS de l'appelant, par une identité
// prouvée (bordereau `label_{tx}` / `email_bord_{tx}` de SA transaction, n° relevé
// par Vinted pour SA transaction, `vc_ventes[id].suivi`, n° relié par SON clic).
// Ici on ne cherche jamais un n° par ressemblance : on ne reçoit que des lignes
// déjà rattachées au même n° NORMALISÉ (`normaliserSuivi`).
//
// LES LIGNES LUES (les formes du code existant) :
//  · transporteur — `depart_{c}_{n°}` (colis VENDU, api/_lib/depart-colis.js) ou
//    `transp_{c}_{n°}` (ACHAT, api/_lib/transporteurs.js) : { carrier, etat,
//    detail, etatAt, lu, essaiRes, priseAt?, libelle?, derLib?, derLieu?, derAt?,
//    lieuVille?, lieuNom? } ;
//  · e-mail — une ligne `email_track_*` du MÊME n° : { status ∈ transit ·
//    available · delivered · retour · info, receivedAt, subject } ;
//  · Vinted — { texte, at, cap } (statut d'expédition de la transaction, ou la
//    « dernière nouvelle » du suivi Vinted, `nouvelleVinted`).
// ─────────────────────────────────────────────────────────────────────────────
import { normaliserSuivi } from './etat-colis-email.js';

const H = 3600000, J = 24 * H;
// Sans prise en charge 3 jours après « envoyé » : c'est une vraie question.
export const SEUIL_PAS_PRIS_MS = 72 * H;
// Vinted finalise ~2 jours après la livraison : au-delà de 3 jours, ça coince.
export const SEUIL_FINALISE_MS = 72 * H;
// Une lecture du transporteur de plus de 24 h ne prouve plus « pas encore ».
export const LECTURE_FRAICHE_MS = 24 * H;

const msDe = (v) => { if (Number.isFinite(v)) return v; const x = Date.parse(String(v || '')); return Number.isFinite(x) ? x : null; };
const propre = (s, n = 80) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

export const NOMS = { mondialrelay: 'Mondial Relay', chronopost: 'Chronopost', vinted: 'Vinted Go' };
export const nomDe = (c) => NOMS[String(c || '')] || 'Le transporteur';

// ── L'HEURE, À PARIS ─────────────────────────────────────────────────────────
const _fmt = (() => { try { return { j: new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }), h: new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }), c: new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' }) }; } catch (_) { return null; } })();
const jourCle = (ms) => (_fmt ? _fmt.j.format(new Date(ms)) : new Date(ms).toISOString().slice(0, 10));
const nbsp = (s) => String(s).replace(/[  ]/g, ' ');
// « aujourd'hui 18:02 », « hier 18:02 », « 7 nov. 18:02 ».
export function quandCourt(ms, maintenant = Date.now()) {
  if (!Number.isFinite(ms)) return '';
  const h = _fmt ? nbsp(_fmt.h.format(new Date(ms))) : new Date(ms).toISOString().slice(11, 16);
  const j = jourCle(ms);
  if (j === jourCle(maintenant)) return `aujourd’hui ${h}`;
  if (j === jourCle(maintenant - J)) return `hier ${h}`;
  return `${_fmt ? nbsp(_fmt.c.format(new Date(ms))) : j} ${h}`;
}
const ageCourt = (ms) => { if (!Number.isFinite(ms) || ms < 0) return ''; const m = Math.round(ms / 60000); if (m < 1) return 'à l’instant'; if (m < 60) return `il y a ${m} min`; const h = Math.round(m / 60); if (h < 36) return `il y a ${h} h`; return `il y a ${Math.round(h / 24)} j`; };
const joursEntre = (a, b) => Math.max(0, Math.floor((b - a) / J));

// La ville d'un lieu de transporteur : « VANNES - FR - … » ⇒ « Vannes » ;
// « 35260 CANCALE » ⇒ « Cancale ». Rien de lisible ⇒ ''.
export function villeCourte(lieu) {
  let s = propre(lieu, 120);
  if (!s) return '';
  s = s.split(/\s+-\s+/)[0];
  s = s.replace(/\b\d{5}\b/g, '').replace(/\b(?:FR|FRANCE|CEDEX\s*\d*)\b/gi, '').replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || s.length > 40 || /^\d+$/.test(s)) return '';
  return s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

// ── LE MOT DE L'ÉTAT (les mots de l'app, src/libelles.js) ────────────────────
// `sens` : 'sortant' (colis VENDU : le relais est celui de l'acheteur) ou
// 'entrant' (ACHAT).
function motTransporteur(t, sens) {
  const e = t && t.etat;
  if (e === 'en_route') {
    if (t.detail === 'prepare') return 'Étiquette créée';
    const prise = msDe(t.priseAt), der = msDe(t.derAt);
    if (prise != null && der != null && Math.abs(der - prise) < 60000) return 'Pris en charge';
    return t.detail === 'retarde' ? 'En transit, retardé' : 'En transit';
  }
  if (e === 'disponible') return sens === 'sortant' ? 'Livré au relais de l’acheteur' : 'Livré au relais';
  if (e === 'retire') return sens === 'sortant' ? 'Retiré par l’acheteur' : 'Retiré';
  if (e === 'livre') return 'Livré';
  if (e === 'retour_expediteur') return t.detail === 'rendu' ? 'Rendu à l’expéditeur' : 'En retour à l’expéditeur';
  if (e === 'incident') return t.detail === 'quitte_relais' ? 'A quitté le relais' : 'Incident signalé';
  if (e === 'inconnu') { const l = propre(t.derLib || t.libelle, 60); return l ? `« ${l} »` : 'Statut inconnu'; }
  return '';
}
const MOT_EMAIL = { transit: 'En transit', available: 'Arrivé au relais', delivered: 'Livré', retour: 'En retour à l’expéditeur' };
const ETAT_EMAIL = { transit: 'en_route', available: 'disponible', delivered: 'livre', retour: 'retour_expediteur' };

// ── LE DERNIER STATUT CONNU ─────────────────────────────────────────────────
// Rend { etat, mot, lieu, at, texte, source, sourceTexte, luAt } ou null.
export function dernierStatut({ transporteur = null, email = null, vinted = null, sens = 'sortant', maintenant = Date.now() } = {}) {
  const cands = [];
  const t = transporteur && typeof transporteur === 'object' ? transporteur : null;
  if (t && t.etat && msDe(t.lu) != null) {
    const mot = motTransporteur(t, sens);
    const at = msDe(t.derAt) ?? msDe(t.etatAt);
    const lieu = t.etat === 'disponible' && (t.lieuNom || t.lieuVille) ? propre(t.lieuNom || t.lieuVille, 40) : villeCourte(t.derLieu || t.lieuVille || '');
    if (mot) cands.push({ rang: 2, etat: t.etat, mot, lieu, at, source: 'transporteur', sourceTexte: `lu chez ${nomDe(t.carrier)} ${ageCourt(maintenant - msDe(t.lu))}`, luAt: msDe(t.lu) });
  }
  const e = email && typeof email === 'object' ? email : null;
  if (e && MOT_EMAIL[e.status] && msDe(e.receivedAt) != null) {
    const at = msDe(e.receivedAt);
    cands.push({ rang: 1, etat: ETAT_EMAIL[e.status], mot: MOT_EMAIL[e.status], lieu: e.status === 'available' ? villeCourte(e.lieu || '') : '', at, source: 'email', sourceTexte: `e-mail du ${quandCourt(at, maintenant)}`, luAt: at });
  }
  const v = vinted && typeof vinted === 'object' ? vinted : null;
  if (v && propre(v.texte)) {
    const at = msDe(v.at) ?? msDe(v.cap);
    if (at != null) cands.push({ rang: 0, etat: null, mot: `« ${propre(v.texte, 60)} »`, lieu: '', at, source: 'vinted', sourceTexte: `Vinted ${ageCourt(maintenant - (msDe(v.cap) ?? at))}`, luAt: msDe(v.cap) ?? at });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => ((b.at ?? -Infinity) - (a.at ?? -Infinity)) || (b.rang - a.rang));
  const c = cands[0];
  const texte = [c.mot, c.lieu, c.at != null ? quandCourt(c.at, maintenant) : ''].filter(Boolean).join(' · ');
  return { etat: c.etat, mot: c.mot, lieu: c.lieu, at: c.at, texte, source: c.source, sourceTexte: c.sourceTexte, luAt: c.luAt };
}

// ── EN COURS ? ──────────────────────────────────────────────────────────────
// Un colis livré, retiré, rendu (lu chez le transporteur) ou une commande
// finalisée (Vinted, preuve fournie par l'appelant) n'est plus « en cours ».
export function estEnCours({ transporteur = null, finalisee = false } = {}) {
  if (finalisee === true) return false;
  const t = transporteur;
  if (t && msDe(t.lu) != null && (t.etat === 'livre' || t.etat === 'retire' || (t.etat === 'retour_expediteur' && t.detail === 'rendu'))) return false;
  return true;
}

// Une lecture du transporteur RÉUSSIE (un état lu), FRAÎCHE (moins de 24 h), et
// faite APRÈS `apres` (ms) : sinon elle ne prouve pas « pas encore ».
const lectureProuve = (t, apres, maintenant) => {
  if (!t || !t.etat) return false;
  const lu = msDe(t.lu);
  if (lu == null || maintenant - lu > LECTURE_FRAICHE_MS || lu > maintenant + 600000) return false;
  return apres == null || lu >= apres;
};
// Le nombre de jours de calendrier (Paris) entre maintenant et la limite.
const joursAvantLimite = (limiteMs, maintenant) => {
  if (!Number.isFinite(limiteMs)) return null;
  const a = jourCle(maintenant), b = jourCle(limiteMs);
  if (a === b) return 0;
  if (jourCle(maintenant + J) === b) return 1;
  return limiteMs < maintenant ? -1 : 2;
};

// ── LES INCOHÉRENCES D'UNE VENTE (colis que le vendeur POSTE) ───────────────
// Entrées (toutes facultatives ; une absente ⇒ la règle qui en dépend se tait) :
//  · depart   : la ligne `depart_` du n° (lue chez le transporteur) ;
//  · envoye   : { at, source: 'vinted' | 'colis-fait' } — QUI dit envoyé et QUAND ;
//  · imprime  : { at } — le bordereau imprimé (son geste) ;
//  · limiteMs : la date limite d'envoi LUE (e-mail du bordereau) — une
//               estimation n'est pas une limite (`limiteSure` exigé) ;
//  · vinted   : { finalisee: bool, retour: bool, luAt } — l'état de la
//               transaction et l'heure de SA lecture (null = pas su).
// Rend [{ code, texte, geste }] (vide = rien à signaler).
export function incoherencesVente({ depart = null, envoye = null, imprime = null, limiteMs = null, limiteSure = false, vinted = null, maintenant = Date.now() } = {}) {
  const out = [];
  const t = depart && typeof depart === 'object' ? depart : null;
  const nom = nomDe(t && t.carrier);
  const prise = t ? msDe(t.priseAt) : null;
  const envAt = envoye ? msDe(envoye.at) : null;
  // 1. « envoyé » dit depuis 3 jours, le transporteur ne l'a toujours pas.
  if (envAt != null && prise == null && maintenant - envAt >= SEUIL_PAS_PRIS_MS && lectureProuve(t, envAt + SEUIL_PAS_PRIS_MS, maintenant) && t.etat !== 'incident' && t.etat !== 'retour_expediteur') {
    const qui = envoye.source === 'vinted' ? 'Vinted dit envoyé' : 'Tu l’as noté déposé';
    out.push({ code: 'pas-pris', texte: `${qui} il y a ${joursEntre(envAt, maintenant)} j. ${nom} ne l’a pas pris en charge.`, geste: 'Demande ton reçu de dépôt au relais.' });
  }
  // 2. Livré selon le transporteur depuis 3 jours, Vinted pas finalisé (lu APRÈS).
  const etAt = t ? msDe(t.etatAt) : null;
  if (t && (t.etat === 'livre' || t.etat === 'retire') && etAt != null && maintenant - etAt >= SEUIL_FINALISE_MS && vinted && vinted.finalisee === false && vinted.retour !== true && msDe(vinted.luAt) != null && msDe(vinted.luAt) >= etAt + SEUIL_FINALISE_MS && msDe(t.lu) != null) {
    out.push({ code: 'livre-pas-finalise', texte: `Livré le ${quandCourt(etAt, maintenant).replace(/ \d\d:\d\d$/, '')} selon ${nom}. Vinted n’a pas finalisé.`, geste: 'Ouvre la commande sur Vinted.' });
  }
  // 3. Bordereau imprimé, jamais déposé, et la limite LUE est aujourd'hui ou demain.
  const impAt = imprime ? msDe(imprime.at) : null;
  const jl = limiteSure ? joursAvantLimite(msDe(limiteMs), maintenant) : null;
  if (impAt != null && envAt == null && prise == null && (jl === 0 || jl === 1) && lectureProuve(t, impAt, maintenant) && (t.etat === 'en_route' || t.etat === 'inconnu')) {
    out.push({ code: 'imprime-pas-depose', texte: `Bordereau imprimé, pas encore déposé. Limite ${jl === 0 ? 'aujourd’hui' : 'demain'}.`, geste: 'Dépose-le aujourd’hui.' });
  }
  // 4. Le colis revient (lu chez le transporteur), Vinted ne le dit pas encore.
  if (t && t.etat === 'retour_expediteur' && msDe(t.lu) != null && !(vinted && vinted.retour === true)) {
    out.push({ code: 'retour', texte: `${nom} renvoie le colis vers toi.`, geste: 'Préviens l’acheteur sur Vinted.' });
  }
  // 5. Un incident (perdu, endommagé…), jamais « a quitté le relais » (le relais
  //    de l'ACHETEUR : c'est son affaire, pas la sienne).
  if (t && t.etat === 'incident' && t.detail !== 'quitte_relais' && msDe(t.lu) != null) {
    out.push({ code: 'incident', texte: `${nom} signale un problème sur ce colis.`, geste: 'Ouvre le suivi, puis Vinted.' });
  }
  return out;
}

// ── LES INCOHÉRENCES D'UN ACHAT EN COURS (pas encore au relais) ─────────────
// `transp` : la ligne `transp_` du n° (lue chez le transporteur). Le stade « au
// relais » appartient à « À retirer » (src/retraitPreuves.js) : rien ici.
export function incoherencesAchat({ transp = null, vinted = null, maintenant = Date.now() } = {}) {
  const out = [];
  const t = transp && typeof transp === 'object' ? transp : null;
  if (!t || !t.etat || msDe(t.lu) == null) return out;
  const nom = nomDe(t.carrier);
  const etAt = msDe(t.etatAt);
  // 1. Étiquette créée depuis 3 jours, jamais déposée par le vendeur.
  if (t.etat === 'en_route' && t.detail === 'prepare' && etAt != null && maintenant - etAt >= SEUIL_PAS_PRIS_MS && lectureProuve(t, etAt + SEUIL_PAS_PRIS_MS, maintenant)) {
    out.push({ code: 'pas-depose-vendeur', texte: `Étiquette créée il y a ${joursEntre(etAt, maintenant)} j. Pas encore chez ${nom}.`, geste: 'Écris au vendeur sur Vinted.' });
  }
  // 2. Il repart chez le vendeur, Vinted ne le dit pas encore.
  if (t.etat === 'retour_expediteur' && !(vinted && vinted.retour === true)) {
    out.push({ code: 'retour', texte: `${nom} renvoie ton achat au vendeur.`, geste: 'Vérifie ton remboursement sur Vinted.' });
  }
  // 3. Un incident (jamais « a quitté le relais » : c'est « À retirer »).
  if (t.etat === 'incident' && t.detail !== 'quitte_relais') {
    out.push({ code: 'incident', texte: `${nom} signale un problème sur ton achat.`, geste: 'Écris au vendeur sur Vinted.' });
  }
  return out;
}

// ── LE LIEN PUBLIC DE SUIVI ─────────────────────────────────────────────────
// La règle d'avant (`lienSuivi`, api/_lib/suivi-colis.js) + les transporteurs
// dont la page publique est connue. ⚠️ La Poste et UPS : formes publiques
// stables, NON mesurées d'ici (le conteneur ne les joint pas). DPD, GLS, Relais
// Colis : aucune forme mesurée ⇒ une RECHERCHE du n°, dite comme telle.
export function lienPublic(lienSuivi, transporteur, suivi, codePostal = '') {
  const n = normaliserSuivi(suivi);
  if (!n) return null;
  const s = encodeURIComponent(n);
  const tr = String(transporteur || '').toLowerCase();
  if (/inpost/.test(tr)) return lienSuivi('mondialrelay', n, codePostal);
  if (/shop2shop|pickup/.test(tr)) return lienSuivi('chronopost', n, codePostal);
  if (/colissimo|la ?poste|laposte/.test(tr)) return { url: `https://www.laposte.fr/outils/suivre-vos-envois?code=${s}`, site: true, codePostal: '' };
  if (/\bups\b/.test(tr)) return { url: `https://www.ups.com/track?loc=fr_FR&tracknum=${s}`, site: true, codePostal: '' };
  return lienSuivi(transporteur, n, codePostal);
}

// ── LE COMPTEUR « À VÉRIFIER » (Ma journée) ─────────────────────────────────
// `lignes` : [{ cle, incoherences: [...] }] ⇒ le nombre de COMMANDES (pas
// d'incohérences) qui ont au moins une incohérence.
export const nbAVerifier = (lignes) => (Array.isArray(lignes) ? lignes.filter((l) => l && Array.isArray(l.incoherences) && l.incoherences.length > 0).length : null);
