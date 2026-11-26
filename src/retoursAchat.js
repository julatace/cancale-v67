// ════════════════════════════════════════════════════════════════════════════
//  LES RETOURS D'ACHATS — IL RENVOIE UN ARTICLE (11 nov., lot retours-litiges)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « pour les retours on doit avoir les bordereaux à imprimer aussi ».
// Une CARTE par bordereau de retour reçu par e-mail (`email_bordretour_{tx}`,
// api/_lib/retour-email.js) : l'achat relié par SON n° de transaction (jamais le
// titre, §5), le N° de la paire s'il en a un (par l'achat), la date limite de dépôt
// LUE (sinon « non lue »), le suivi du colis de retour (trois états), et le
// remboursement : PROUVÉ (e-mail « a été remboursée » du même n°, ou statut de
// l'achat) sinon « Pas encore remboursé » — jamais un montant inventé.
// Et `avecRemboursementsProuves` : un achat dont le remboursement est PROUVÉ par
// e-mail (même n°, montant ≥ ce qu'il a payé) sort des coûts tout de suite (son
// statut devient celui que Vinted écrira : « Remboursement effectué »), sans
// attendre la prochaine lecture de ses achats. Remboursement partiel ⇒ rien ne
// bouge (le coût reste ; la carte le dit).
// Module PUR. Exécuté par scripts/audit-retours-litiges.cjs.
// (15 nov., lot retours-suivi) Les faits du transporteur PAR LE N° EXACT du bordereau de retour
// (api/_lib/retour-suivi.js, la règle partagée avec le serveur) font avancer la carte toute seule.
import { faitsRetour, suivisPartages, normaliserSuiviRetour } from '../api/_lib/retour-suivi.js';
// (15 nov., lot retour-parfait) Le transporteur d'un n° par SA FORME, la règle du scanner (src/scanColis.js, la
// MÊME — fichier identique à `claude/scanner-colis`) : S10 à clé UPU JUSTE + préfixes/suffixes Chronopost
// mesurés (187 n° rangés sur 187), 8 chiffres Mondial Relay. Seulement quand l'étiquette n'a rien dit.
import { lireCodeColis } from './scanColis.js';
const transporteurDeLaForme = (n) => { try { const l = lireCodeColis(str(n).toUpperCase().replace(/[\s-]+/g, '')); return l && l.transporteur && l.transporteur !== 'postal' ? l.transporteur : ''; } catch (_) { return ''; } };

const str = (v) => String(v == null ? '' : v);
export const RETOUR_PRESSE_H = 48;
export const RETOUR_ANCIEN_J = 30;
const RE_REMB = /rembours/i;
const RE_SANS_COUT = /annul|rembours|refus/i;

// Les remboursements prouvés par e-mail, par n° de transaction (le plus récent gagne).
export function remboursementsParTx(remb) {
  if (!Array.isArray(remb)) return remb === null ? null : undefined;
  const m = new Map();
  for (const r of remb) {
    const tx = str(r && (r.tx || r.transaction)).trim();
    const montant = r && r.montant != null && r.montant !== '' ? Number(r.montant) : NaN;
    if (!tx || !isFinite(montant)) continue;
    const p = m.get(tx);
    if (!p || str(r.at || r.receivedAt) > str(p.at)) m.set(tx, { tx, montant: Math.round(montant * 100) / 100, estime: str(r.estime), at: str(r.at || r.receivedAt) });
  }
  return m;
}

// `montantDe(o)` : ce qu'il a payé (en €) ou null (pas lu ⇒ rien ne bouge).
export function avecRemboursementsProuves(achats, remb, montantDe) {
  const parTx = remb instanceof Map ? remb : remboursementsParTx(remb);
  if (!Array.isArray(achats) || !(parTx instanceof Map) || !parTx.size) return achats;
  let change = false;
  const out = achats.map((o) => {
    if (!o || o.transaction_id == null || RE_SANS_COUT.test(str(o.status))) return o;
    const r = parTx.get(str(o.transaction_id));
    if (!r) return o;
    const paye = typeof montantDe === 'function' ? montantDe(o) : null;
    if (paye == null || !isFinite(paye) || r.montant + 0.005 < paye) return o;   // partiel ou pas su : rien ne bouge
    change = true;
    return { ...o, status: 'Remboursement effectué', _rembourseEmail: { montant: r.montant, at: r.at } };
  });
  return change ? out : achats;
}

const jourCourt = (iso) => { const t = Date.parse(str(iso)); if (!isFinite(t)) return null; try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }); } catch (_) { return null; } };

// ════════════════════════════════════════════════════════════════════════════
//  (15 nov., lot retours) « À RENVOYER » : UNE RÈGLE, UNE CARTE PAR RETOUR
// ════════════════════════════════════════════════════════════════════════════
// Julien : « j'ai un retour sur shop_cancale, je te laisse regarder pour bien le gérer »,
// puis « c'est vraiment pas ouf » (Ma journée : deux lignes « Retour · Renvoyer ↗ » sans
// nom ni heure, éparpillées). Un retour d'ACHAT (il renvoie) se voit par trois sources :
//   1. le BORDEREAU reçu par e-mail (`email_bordretour_{tx}`, ou encore gardé « inconnu »
//      avant son reclassement : son corps est relu ici par LA règle du serveur) — identité :
//      le n° de transaction ; il porte la date et l'HEURE limites et le PDF ;
//   2. l'AVIS « Retourne ta commande d'ici le … » (`email_retourdemande_*`) — AUCUNE identité
//      (mesuré) : l'article n'est qu'un libellé, la date est le jour du sujet (sans heure) ;
//   3. l'ACHAT Vinted lui-même (« Retour initié / en cours / demandé », `ACHAT_A_RENVOYER`) —
//      identité : son n° de transaction (et sa conversation).
// Une carte PAR RETOUR : bordereau et achat se rejoignent par le n° ; un avis rejoint l'achat
// par SA conversation (identité). Un avis sans identité ne rejoint un bordereau QUE pour
// l'affichage (jamais un N°, jamais une écriture) et seulement si TOUT concorde et qu'il n'y a
// qu'UN candidat de chaque côté : même compte (quand les deux le disent), même jour limite,
// même libellé. Deux candidats ⇒ deux cartes (jamais une cachée : un retour caché est un
// retour perdu). Le sens « achat » est PROUVÉ côté serveur (api/_lib/retour-email.js) ; un n°
// qui est une de SES VENTES contredit l'e-mail ⇒ la carte le dit et n'imprime rien.
export const ACHAT_A_RENVOYER = /retour\s*initi|retour\s+en\s+cours|retour\s+demand/i;
const RE_ARRIVE_VENDEUR = /livr[ée]|distribu[ée]|remis au destinataire|re[çc]u par le vendeur/i;
const RE_EN_ROUTE = /d[ée]pos[ée]|pris en charge|achemin|transit|en cours de livraison|en route/i;
const norme = (s) => str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// L'heure limite en clair (Paris) : « 10 h », « 23 h 59 » ; '' si la source n'a pas d'heure.
export function heureParis(iso) {
  const t = Date.parse(str(iso)); if (!isFinite(t)) return '';
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    const h = String(Number(p.hour)), m = p.minute;
    return m === '00' ? `${h} h` : `${h} h ${m}`;
  } catch (_) { return ''; }
}
// Le jour (Paris) d'un instant : 'AAAA-MM-JJ'.
export function jourParis(ms) {
  try { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; } catch (_) { return ''; }
}
// « Quand » en mots, pour l'écran : { cle: 'passee' | 'auj' | 'demain' | 'date', jour: 'AAAA-MM-JJ', heure }.
export function quandLimite(c, now) {
  if (!c || !c.limiteIso) return null;
  const lm = Date.parse(c.limiteIso);
  const jour = c.limiteJour || jourParis(lm);
  const auj = jourParis(now), demain = jourParis(now + 86400000);
  const cle = now > lm ? 'passee' : jour === auj ? 'auj' : jour === demain ? 'demain' : 'date';
  return { cle, jour, heure: c.heure || '' };
}

// Un bordereau gardé « inconnu » (pas encore reclassé) : son corps est relu par LA règle du
// serveur (`lireBordereauRetour`, passée par l'appelant). Rend la ligne projetée d'un
// bordereau rangé, avec le PDF du corps gardé (`pdfGarde`), ou null.
export function bordereauDuGarde(row, lireBordereauRetour) {
  if (!row || typeof lireBordereauRetour !== 'function') return null;
  let j = null; try { j = JSON.parse(str(row.brut)); } catch (_) { return null; }
  if (!j || typeof j !== 'object') return null;
  const atts = (Array.isArray(j.attachments) ? j.attachments : []).map((a) => ({ filename: (a && (a.filename || a.name)) || '', contentType: (a && (a.contentType || a.type)) || '', contentB64: (a && (a.contentB64 || a.content || a.data)) || '' }));
  const lu = lireBordereauRetour({ subject: j.subject || row.subject, text: j.text || '', attachments: atts });
  if (!lu || !lu.ok) return null;
  return { tx: lu.transaction, suivi: lu.suivi, dateLimite: lu.dateLimite, dateLimiteIso: lu.dateLimiteIso, article: lu.article, at: row.receivedAt || '', pdf: true, pdfGarde: lu.pdf.contentB64, emailId: str(row.id), garde: true };
}

// bords   : lignes `email_bordretour_*` projetées ({ tx, suivi, dateLimiteIso, article, uid, account, at, pdf })
//           (+ celles de `bordereauDuGarde` ; même n° : la ligne rangée gagne)
// demandes: avis « Retourne ta commande » ({ id, article, limiteIso, limiteJour, conv, uid, account, recuLe })
//           (`undefined` en cours · `null` pas su)
// achats  : ses achats Vinted (`undefined` pas lu · `null` pas su)
// remb    : lignes `email_rembachat_*` ({ tx, montant, estime, at }) — mêmes trois états
// transp  : Map n° de suivi → { libelle } (`undefined` en cours · `null` pas su)
// deposes : { [cle]: iso } — « Déposé » posé par SON clic
// ventesTx: Set des n° de SES ventes (un n° de vente contredit un bordereau d'achat)
// numeroDe(tx) : le N° de la paire reliée à CET achat (par SON clic), ou ''
// montantDe(o) : ce qu'il a payé, ou null
// track   : lignes `email_track_*` projetées des n° de retour ({ suivi, status, emailAt, at, retire, carrier }) — `undefined` en cours · `null` pas su
// departs : Map n° → ligne `depart_` (la lecture chez le transporteur d'un colis qu'il poste) — null pas su
// (15 nov., lot retour-parfait) trackEnCours : les e-mails du transporteur pas ENCORE lus — un retour qui a un n° n'est
//          alors pas dit « à déposer » en tête de Ma journée (il est peut-être déjà parti : jamais un faux rappel).
export function retoursAchat({ bords, demandes = [], achats, remb, transp, track = [], trackEnCours = false, departs = null, deposes = null, ventesTx = null, numeroDe = null, montantDe = null, maintenant } = {}) {
  const now = isFinite(maintenant) ? maintenant : Date.now();
  if (bords === undefined) return { etat: 'encours', cartes: [], anciennes: [], aRenvoyer: [], manques: [] };
  if (bords === null && !Array.isArray(achats)) return { etat: 'passu', cartes: [], anciennes: [], aRenvoyer: [], manques: ['tes bordereaux de retour'] };
  const manques = [];
  if (bords === null) manques.push('tes bordereaux de retour');
  if (achats === null) manques.push('tes achats Vinted');
  if (remb === null) manques.push('les e-mails de remboursement');
  if (demandes === null) manques.push('les e-mails « Retourne ta commande »');
  const parTx = remboursementsParTx(remb);
  const A = new Map();
  for (const o of (Array.isArray(achats) ? achats : [])) if (o && o.transaction_id != null) A.set(str(o.transaction_id), o);
  const dep = deposes && typeof deposes === 'object' ? deposes : {};
  const vus = new Set(), cartes = [], anciennes = [];
  const tries = [...(Array.isArray(bords) ? bords : [])].filter(Boolean).sort((a, b) => ((a.garde ? 1 : 0) - (b.garde ? 1 : 0)) || str(b.at || b.receivedAt).localeCompare(str(a.at || a.receivedAt)));
  const etatSuivi = (suivi) => {
    if (!suivi) return { etat: 'aucun' };
    if (transp === undefined) return { etat: 'encours', n: suivi };
    if (transp === null) return { etat: 'passu', n: suivi };
    const t = transp && typeof transp.get === 'function' ? transp.get(suivi) : null; const l = t ? str(t.libelle).trim() : '';
    return { etat: 'ok', n: suivi, libelle: l };
  };
  const remboursement = (tx, o) => {
    const r = parTx instanceof Map && tx ? parTx.get(tx) : null;
    const paye = o && typeof montantDe === 'function' ? montantDe(o) : null;
    if (r) return { etat: 'oui', montant: r.montant, source: 'email', at: r.at, estime: r.estime || '', partiel: paye != null && isFinite(paye) && r.montant + 0.005 < paye };
    if (o && RE_REMB.test(str(o.status))) return { etat: 'oui', montant: null, source: 'statut', partiel: false };
    if (remb === null || (achats === null && !o)) return { etat: 'passu' };
    return { etat: 'non' };
  };
  const dates = (c) => {
    const lm = Date.parse(str(c.limiteIso));
    c.depassee = isFinite(lm) && now > lm;
    c.presse = isFinite(lm) && !c.depassee && lm - now < RETOUR_PRESSE_H * 3600000;
  };
  // (15 nov., lot retours-suivi) Un n° porté par DEUX retours n'est rejoint par aucun fait (identité, §5).
  const partages = suivisPartages((Array.isArray(bords) ? bords : []).filter(Boolean).reduce((acc, b) => {
    const tx = str(b.tx || b.transaction).trim(); if (tx && !acc.some((x) => x.tx === tx)) acc.push({ tx, suivi: b.suivi }); return acc; }, []));
  const etape = (c) => {
    c.depose = dep[c.cle] ? { le: str(dep[c.cle]) } : null;
    const lib = c.statut && c.statut.etat === 'ok' ? str(c.statut.libelle) : '';
    // Les faits du transporteur, par le n° EXACT (e-mails du transporteur, lecture du départ) : `pas su` ⇒ rien.
    const k = normaliserSuiviRetour(c.suivi);
    c.suiviPartage = !!(k && partages.has(k));
    c.faits = k && !c.suiviPartage ? faitsRetour(k, { track: Array.isArray(track) ? track : null, departs: departs instanceof Map ? departs : null }) : null;
    c.faitsPasSu = !!(k && !c.suiviPartage && !c.faits && (track === null || departs === null));
    c.faitsEnCours = !!(k && !c.suiviPartage && !c.faits && trackEnCours);
    if (c.faits && c.faits.carrier && !c.transporteur) c.transporteur = c.faits.carrier;
    // L'étape : PROUVÉE (remboursement lu, fait du transporteur lu), sinon SON clic « Déposé ».
    c.etape = c.rembourse.etat === 'oui' ? 'rembourse'
      : c.faits ? c.faits.etape
      : RE_ARRIVE_VENDEUR.test(lib) ? 'recu-vendeur'
      : RE_EN_ROUTE.test(lib) ? 'en-route'
      : c.depose ? 'depose' : 'a-deposer';
  };
  const finir = (c, recuLe) => {
    dates(c); etape(c);
    // Un n° qui est une de SES ventes : l'e-mail (« tu renvoies ») est contredit ⇒ rien n'est imprimé.
    c.contredit = !!(c.tx && ventesTx && typeof ventesTx.has === 'function' && ventesTx.has(c.tx) && !A.has(c.tx));
    if (c.contredit) c.pdf = false;
    c.sansPdf = c.pdf ? null : c.contredit ? { raison: 'contredit' }
      : c.source === 'bordereau' ? { raison: 'pdf-absent', emailLe: str(recuLe) }
      : { raison: 'pas-recu' };
    c.vinted = c.tx ? `https://www.vinted.fr/member/transactions/${encodeURIComponent(c.tx)}` : c.conv ? `https://www.vinted.fr/inbox/${encodeURIComponent(c.conv)}` : 'https://www.vinted.fr/inbox';
    c._recuLe = str(recuLe);
    return c;
  };
  // 1. Les bordereaux (identité : le n°).
  const cartesBord = [];
  for (const b of tries) {
    const tx = str(b.tx || b.transaction).trim();
    if (!tx || vus.has(tx)) continue;
    vus.add(tx);
    const o = A.get(tx) || null;
    const lm = Date.parse(str(b.dateLimiteIso));
    const limiteIso = isFinite(lm) ? new Date(lm).toISOString() : null;
    const suivi = str(b.suivi).trim();
    const num = typeof numeroDe === 'function' ? str(numeroDe(tx)).trim() : '';
    cartesBord.push(finir({
      cle: 'r:' + tx, source: 'bordereau', tx, achat: o, titre: str((o && o.title) || b.article), num, conv: o ? str(o.conversation_id || '') : '',
      limiteIso, limiteJour: limiteIso ? jourParis(lm) : '', limiteTexte: jourCourt(limiteIso), heure: limiteIso && /\d\s*h/.test(str(b.dateLimite)) ? heureParis(limiteIso) : '',
      suivi, statut: etatSuivi(suivi), rembourse: remboursement(tx, o), uid: str(b.uid || (o && o._acc && o._acc.vinted_user_id) || ''), compte: str(b.account || ''),
      pdf: b.pdf !== false, pdfGarde: b.pdfGarde || '', garde: !!b.garde, emailId: str(b.emailId || ''), relie: !!o, avis: null,
      transporteur: str(b.transporteurPdf || '').trim() || transporteurDeLaForme(suivi),
      transporteurSource: str(b.transporteurPdf || '').trim() ? 'etiquette' : transporteurDeLaForme(suivi) ? 'forme' : '',
    }, b.at || b.receivedAt));
  }
  // 2. Les achats « à renvoyer » sans bordereau (identité : le n°).
  const cartesAchat = [];
  for (const [tx, o] of A) {
    if (vus.has(tx) || !ACHAT_A_RENVOYER.test(str(o.status))) continue;
    vus.add(tx);
    const num = typeof numeroDe === 'function' ? str(numeroDe(tx)).trim() : '';
    cartesAchat.push(finir({ cle: 'r:' + tx, source: 'achat', tx, achat: o, titre: str(o.title), num, conv: str(o.conversation_id || ''),
      limiteIso: null, limiteJour: '', limiteTexte: null, heure: '', suivi: '', statut: { etat: 'aucun' }, rembourse: remboursement(tx, o),
      uid: str((o._acc && o._acc.vinted_user_id) || ''), compte: '', pdf: false, relie: true, avis: null }, o.date || ''));
  }
  // 3. Les avis : par SA conversation vers un achat (identité), sinon le regroupement d'affichage, sinon seuls.
  const D = (Array.isArray(demandes) ? demandes : []).filter((d) => d && d.limiteIso);
  const dejaD = new Set();
  const poserAvis = (c, d) => {
    c.avis = { id: str(d.id), recuLe: str(d.recuLe) };
    if (!c.limiteIso) { c.limiteIso = d.limiteIso; c.limiteJour = d.limiteJour || jourParis(Date.parse(d.limiteIso)); c.limiteTexte = jourCourt(d.limiteIso); dates(c); }
    if (!c.compte && d.account) c.compte = str(d.account);
    dejaD.add(d);
  };
  for (const d of D) {
    const conv = str(d.conv).toLowerCase(); if (!conv) continue;
    const l = [...cartesBord, ...cartesAchat].filter((c) => c.conv && c.conv.toLowerCase() === conv);
    if (l.length === 1) poserAvis(l[0], d);
  }
  const memeRetour = (c, d) => !!c.limiteJour && c.limiteJour === (d.limiteJour || jourParis(Date.parse(d.limiteIso)))
    && !!norme(c.titre) && norme(c.titre) === norme(d.article) && !(c.uid && d.uid && str(c.uid) !== str(d.uid));
  const libres = D.filter((d) => !dejaD.has(d));
  for (const d of libres) {
    const cands = cartesBord.filter((c) => !c.avis && memeRetour(c, d));
    if (cands.length !== 1) continue;
    const rivaux = libres.filter((x) => memeRetour(cands[0], x));
    const autresBords = cartesBord.filter((c) => memeRetour(c, d));
    if (rivaux.length === 1 && autresBords.length === 1) poserAvis(cands[0], d);
  }
  const cartesAvis = [];
  for (const d of D) {
    if (dejaD.has(d)) continue;
    cartesAvis.push(finir({ cle: 'd:' + str(d.id), source: 'avis', tx: '', achat: null, titre: str(d.article), num: '', conv: str(d.conv || ''),
      limiteIso: d.limiteIso, limiteJour: d.limiteJour || jourParis(Date.parse(d.limiteIso)), limiteTexte: jourCourt(d.limiteIso), heure: '',
      suivi: '', statut: { etat: 'aucun' }, rembourse: { etat: 'non' }, uid: str(d.uid || ''), compte: str(d.account || ''), pdf: false, relie: false,
      avis: { id: str(d.id), recuLe: str(d.recuLe) } }, d.recuLe));
  }
  for (const c of [...cartesBord, ...cartesAchat, ...cartesAvis]) {
    const age = (now - (Date.parse(c._recuLe) || now)) / 86400000;
    delete c._recuLe;
    (c.rembourse.etat === 'oui' && age > RETOUR_ANCIEN_J ? anciennes : cartes).push(c);
  }
  // À déposer d'abord (date la plus proche), puis en route, puis remboursés.
  const poids = { 'a-deposer': 0, depose: 1, 'en-route': 1, 'recu-vendeur': 2, rembourse: 3 };
  const rang = (c) => (poids[c.etape] || 0) * 1e15 + (c.depassee ? -1e14 : 0) + (c.limiteIso ? Date.parse(c.limiteIso) : 1e14);
  cartes.sort((a, b) => rang(a) - rang(b));
  return { etat: 'lu', cartes, anciennes, aRenvoyer: cartes.filter((c) => c.etape === 'a-deposer' && !c.faitsEnCours), manques };
}

// ════════════════════════════════════════════════════════════════════════════
//  (15 nov., lot retour-parfait) LES ÉTAPES D'UN RETOUR, JUSQU'AU REMBOURSEMENT
// ════════════════════════════════════════════════════════════════════════════
// Julien : « Je veux que ce soit parfait et irréprochable. » La maquette « Verre dépoli » (achats-retour)
// montre le chemin entier : bordereau prêt (transporteur) · à déposer · en route · livré au vendeur ·
// remboursé. Chaque étape « faite » est PROUVÉE par la même source que la carte (`etape`, `faits`,
// `depose`, `rembourse`) — jamais devinée ; une étape à venir n'a pas de date. Pur : l'écran dessine.
// Rend [{ cle, etat: 'fait'|'ici'|'avenir', at?, montant?, transporteur? }] (5 étapes, dans l'ordre).
export const ETAPES_RETOUR = Object.freeze(['bordereau', 'deposer', 'route', 'livre', 'rembourse']);
const RANG_ETAPE = { 'a-deposer': 1, depose: 2, 'en-route': 2, revient: 2, 'relais-vendeur': 3, 'recu-vendeur': 4, rembourse: 5 };
// États : 'fait' (prouvé) · 'ici' (où il en est) · 'avenir' · 'saute' (passé, mais RIEN ne le prouve).
// ⚠️ (23 nov., Julien, sur ses captures : « Remboursé ✓ » avec « En route ○ · Livré au vendeur ○ ») UNE ÉTAPE POSTÉRIEURE
// PROUVÉE IMPLIQUE LES PRÉCÉDENTES : elles sont « faites » (`implicite: true`) avec « date pas vue » — JAMAIS une date
// inventée (`at` reste null). La seule exception est le cas où le remboursement ne prouve PAS que le colis a voyagé :
//   · remboursement PARTIEL (l'article est souvent gardé : rien n'a été renvoyé) ;
//   · aucun bordereau, aucun dépôt (ni lu, ni noté par lui), aucun fait du transporteur (Vinted a pu rembourser sans retour).
// Là, les étapes du colis restent 'saute' (grisées) : « pas su » ne vaut pas « oui ».
export function etapesRetour(c) {
  if (!c) return [];
  const f = c.faits || null;
  const r = RANG_ETAPE[c.etape] || 1;                                            // où il en est
  const rf = c.etape === 'rembourse' ? (f ? (RANG_ETAPE[f.etape] || 2) : c.depose ? 2 : 1) : r;   // ce qui est PROUVÉ du chemin (avec sa date)
  const deposeAt = (f && f.deposeAt) || (c.depose && c.depose.le) || null;
  const remb = c.rembourse && c.rembourse.etat === 'oui' ? c.rembourse : null;
  // Le chemin a-t-il voyagé ? (seulement utile quand le remboursement est la preuve la plus haute)
  const voyage = c.etape !== 'rembourse' || (!(remb && remb.partiel) && !!(c.pdf || c.source === 'bordereau' || c.depose || f));
  const impl = () => (voyage ? 'fait' : 'saute');
  // i = rang de l'étape ; prouvée directement (rf > i) ⇒ 'fait' daté ; impliquée ⇒ 'fait' + implicite (sans date).
  const passe = (i) => (rf > i ? 'fait' : impl());
  const implicite = (i) => rf <= i && voyage;
  const bordFait = c.pdf || c.source === 'bordereau';
  return [
    { cle: 'bordereau', etat: bordFait ? 'fait' : r > 1 ? impl() : 'ici', implicite: !bordFait && r > 1 && voyage, transporteur: str(c.transporteur || (f && f.carrier) || '') },
    { cle: 'deposer', etat: r > 1 ? passe(1) : c.pdf ? 'ici' : 'avenir', implicite: r > 1 && implicite(1), at: rf > 1 ? deposeAt : null, parLui: rf > 1 && !f && !!c.depose },
    { cle: 'route', etat: r > 2 ? passe(2) : r === 2 ? 'ici' : 'avenir', implicite: r > 2 && implicite(2), revient: c.etape === 'revient' },
    { cle: 'livre', etat: r === 3 ? 'ici' : r >= 4 ? (rf >= 4 ? 'fait' : impl()) : 'avenir', implicite: r >= 4 && rf < 4 && voyage, relais: c.etape === 'relais-vendeur', at: f && rf >= 3 && (f.etape === 'relais-vendeur' || f.etape === 'recu-vendeur') ? f.at : null },
    { cle: 'rembourse', etat: r === 5 ? 'fait' : r === 4 ? 'ici' : 'avenir', implicite: false, montant: remb ? remb.montant : null, at: remb && remb.at ? remb.at : null },
  ];
}
// Combien de jours (calendrier, Paris) jusqu'à la limite : 0 aujourd'hui, 1 demain, … ; null sans limite.
export function joursAvantLimite(c, now = Date.now()) {
  if (!c || !c.limiteIso) return null;
  const j = c.limiteJour || jourParis(Date.parse(c.limiteIso)), a = jourParis(now);
  const ms = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(s)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
  const d = Math.round((ms(j) - ms(a)) / 86400000);
  return isFinite(d) ? d : null;
}

// Ce que le tampon écrit sur le bordereau de retour (une règle, imprimée et testée).
export const lignesTamponRetour = ({ num, titre } = {}) => {
  const n = str(num).trim();
  return { haut: n ? `RETOUR · N°${n}` : 'RETOUR', bas: str(titre).replace(/\s+/g, ' ').trim().slice(0, 60) };
};

// ── (15 nov., refonte-journee — Julien : « on n'a pas forcément d'infos sur ces cases ») UN RETOUR SANS NOUVELLES ──
// Un retour d'achat dont la date limite est passée depuis plus de RETOUR_PERIME_J jours SANS bordereau, sans dépôt
// noté, sans fait du transporteur ni remboursement lu ne demande plus un geste aujourd'hui : il quitte Ma journée et
// va dans Achats → « À vérifier » (« Ce retour n'a plus de nouvelles depuis le … : vérifie sur Vinted »), où « C'est
// réglé » (SON clic, `vrm_retours_regles`, synchronisé) l'archive. Rien n'est deviné : un seul fait connu ⇒ il reste.
export const RETOUR_PERIME_J = 7;
export function retourPerime(c, now = Date.now()) {
  if (!c || !c.limiteIso) return false;
  const lm = Date.parse(String(c.limiteIso)); if (!isFinite(lm)) return false;
  if (now - lm <= RETOUR_PERIME_J * 86400000) return false;
  if (c.pdf || c.depose || c.faits || (c.rembourse && c.rembourse.etat === 'oui')) return false;
  return c.etape === 'a-deposer';
}
// { actifs, perimes, regles } : les retours de Ma journée et d'Achats, ceux « à vérifier », ceux qu'il a dits réglés.
export function classerRetoursAchat(r, { regles = null, maintenant = Date.now() } = {}) {
  const R = regles && typeof regles === 'object' ? regles : {};
  const out = { actifs: [], perimes: [], regles: [] };
  if (!r || r.etat !== 'lu') return out;
  for (const c of r.cartes || []) {
    if (R[c.cle]) out.regles.push(c);
    else if (retourPerime(c, maintenant)) out.perimes.push(c);
    else out.actifs.push(c);
  }
  return out;
}
