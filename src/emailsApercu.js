// ── L'APERÇU DES E-MAILS : TROIS RÉPONSES EN MOTS SIMPLES (2 nov.) ──────────
// Julien (2 nov.) : « il y a beaucoup d'incompréhension de ma part quand je vais
// dans les emails ». L'écran répond d'abord à « Est-ce que mes e-mails arrivent
// bien dans VRM ? », puis « Qu'est-ce qu'il reste à faire ? », puis « Ce que VRM
// en a fait ».
//
// ⚠️ AUCUNE RÈGLE NEUVE : tout part des mêmes lectures que l'écran d'avant —
//    l'état du service de réception (`etatCollecteur`, src/receptionEmail.js),
//    les derniers e-mails suivis et les adresses rendus par la route
//    `/api/email-rattacher?mode=reception`, les e-mails mis de côté
//    (`mode=liste`) et l'état de confirmation des adresses (`mode=preuves`, le
//    SERVEUR décide). La phrase de chaque chiffre vient de la même liste que lui.
// ⚠️ « Pas su » ≠ « rien » : une lecture absente (`undefined`/`null`) ne produit
//    ni geste ni « rien à faire » — l'écran le dit.
import { etatCollecteur, resumeReceptionComptes } from './receptionEmail.js';

const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;

// « il y a 4 min », « il y a 3 h », sinon « le 27 oct. à 14:56 ».
export function ilYa(v, maintenant = Date.now()) {
  const t = Date.parse(v || '');
  if (!Number.isFinite(t)) return null;
  const ms = maintenant - t;
  if (ms >= 0 && ms < 60000) return 'à l’instant';
  if (ms >= 0 && ms < 3600e3) return `il y a ${Math.round(ms / 60000)} min`;
  if (ms >= 0 && ms < 12 * 3600e3) return `il y a ${Math.round(ms / 3600e3)} h`;
  const d = new Date(t);
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

// 1. « Est-ce que mes e-mails arrivent ? » — l'état du service de réception, tel
//    que `etatCollecteur` le juge, écrit pour un vendeur.
export function reponseReception(d, maintenant = Date.now()) {
  if (d === undefined) return { etat: 'lecture', titre: 'Je regarde si tes e-mails arrivent…', phrase: '' };
  if (d === null) return { etat: 'passu', titre: 'Je n’ai pas pu lire la réception', phrase: 'La lecture n’a pas abouti — rien n’est perdu, réessaie dans un moment.' };
  const s = etatCollecteur(d.collecteur, maintenant);
  const dernier = ilYa(d.dernierEmail, maintenant);
  const derniere = d.dernierEmail ? (dernier ? `Dernier e-mail reçu ${dernier}.` : '') : 'Aucun e-mail reçu pour l’instant.';
  if (s.etat === 'actif') return { etat: 'oui', titre: 'Oui, tes e-mails arrivent dans VRM', phrase: derniere };
  if (s.etat === 'alerte') return { etat: 'verifier', titre: 'La réception est à vérifier',
    phrase: (s.titre === 'Dernier passage en difficulté'
      ? 'Le dernier relevé de la boîte VRM a eu un problème. Rien n’est perdu : les e-mails pas encore rangés seront repris.'
      : 'VRM n’a pas relevé sa boîte depuis plus de 20 minutes. Rien n’est perdu : les e-mails attendent le prochain relevé.') + (derniere ? ' ' + derniere : '') };
  return { etat: 'passu', titre: 'Pas encore de nouvelles du service de réception',
    phrase: 'Ça ne veut pas dire que tes e-mails sont perdus.' + (derniere ? ' ' + derniere : '') };
}

// 2. Ce qu'il reste à faire : une ligne par cause, chacune avec SON geste.
//    `quarantaine` : tableau (lu) · null (pas su) · undefined (en cours).
export function gestesEmails({ d, quarantaine, preuves }) {
  const g = [];
  if (Array.isArray(quarantaine) && quarantaine.length > 0) {
    const n = quarantaine.length;
    g.push({ k: 'rattacher', n, phrase: `${pl(n, 'e-mail mis', 'e-mails mis')} de côté : dis ${n > 1 ? 's’ils sont' : 's’il est'} à toi`, bouton: n > 1 ? 'Les voir' : 'Le voir', vers: 'a-traiter' });
  }
  if (d && Array.isArray(d.adresses)) {
    if (d.adresses.length === 0) g.push({ k: 'adresse', n: 0, phrase: 'Ajoute l’adresse où Vinted t’écrit, pour que ses e-mails te reviennent', bouton: 'Ajouter', vers: 'adresses' });
    const sansCompte = d.adresses.filter((a) => !(Array.isArray(a.comptes) && a.comptes.length === 1));
    if (sansCompte.length) g.push({ k: 'compte', n: sansCompte.length, phrase: `${pl(sansCompte.length, 'adresse')} sans son compte Vinted associé`, bouton: 'Associer', vers: 'adresses' });
    if (preuves && preuves.cloisonnee === true && !preuves.installation && preuves.adresses) {
      const nonConf = d.adresses.filter((a) => a.declaree !== false && (preuves.adresses[String(a.adresse || '').trim().toLowerCase()] || {}).etat !== 'prouvee');
      if (nonConf.length) g.push({ k: 'confirmer', n: nonConf.length, phrase: `${pl(nonConf.length, 'adresse')} pas encore ${nonConf.length > 1 ? 'confirmées' : 'confirmée'} : ${nonConf.length > 1 ? 'leurs' : 'ses'} e-mails sont mis de côté`, bouton: 'Confirmer', vers: 'adresses' });
    }
  }
  if (d && Array.isArray(d.emails)) {
    const n = d.emails.filter((e) => e.etat === 'a-verifier').length;
    if (n) g.push({ k: 'verifier', n, phrase: `${pl(n, 'e-mail')} à vérifier : VRM n’est pas sûr de ce qu’il a fait`, bouton: 'Voir', vers: 'journal', etat: 'a-verifier' });
  }
  return g;
}

// 3. Ce que VRM en a fait : les e-mails RANGÉS, par famille, en mots simples.
//    `type` = le filtre du journal (FILTRES_TYPE de src/journalEmail.js).
const FAMILLES = [
  ['bordereau', ['bordereau'], 'bordereau d’envoi ajouté à Colis', 'bordereaux d’envoi ajoutés à Colis'],
  ['colis', ['suivi'], 'nouvelle de colis (code de retrait, livraison)', 'nouvelles de colis (codes de retrait, livraisons)'],
  ['vente', ['vente', 'finalisation'], 'vente ou versement noté', 'ventes ou versements notés'],
  ['achat', ['achat'], 'reçu d’achat rangé avec ton achat', 'reçus d’achat rangés avec tes achats'],
  ['messages', ['offre', 'message', 'favori'], 'offre, message ou favori', 'offres, messages ou favoris'],
];
export function ceQueVrmAFait(d) {
  if (!d || !Array.isArray(d.emails)) return null;
  const ranges = d.emails.filter((e) => e.etat === 'integre');
  const lignes = [];
  let pris = 0;
  for (const [type, types, sg, pl2] of FAMILLES) {
    const n = ranges.filter((e) => types.includes(e.type)).length;
    pris += n;
    if (n) lignes.push({ k: type, n, type, phrase: `${n} ${n > 1 ? pl2 : sg}` });
  }
  const autres = ranges.length - pris;
  if (autres) lignes.push({ k: 'autre', n: autres, type: 'autre', phrase: `${autres} ${autres > 1 ? 'e-mails d’information, rien à faire' : 'e-mail d’information, rien à faire'}` });
  const attente = d.emails.filter((e) => e.etat === 'erreur').length;
  if (attente) lignes.push({ k: 'attente', n: attente, etat: 'erreur', phrase: `${pl(attente, 'e-mail')} pas encore ${attente > 1 ? 'rangés' : 'rangé'} : ${attente > 1 ? 'ils reviennent' : 'il revient'} tout seul${attente > 1 ? 's' : ''}` });
  return { sur: d.emails.length, plus: !!d.plus, lignes };
}

// Une ligne par adresse : son compte, et quand son dernier e-mail est arrivé.
export function arriveesParAdresse(d, maintenant = Date.now()) {
  if (!d || !Array.isArray(d.adresses)) return null;
  return resumeReceptionComptes(d.adresses, d.emails || [], maintenant).map((r) => {
    const a = d.adresses.find((x) => String(x.adresse || '').trim().toLowerCase() === r.adresse) || {};
    const quand = ilYa(r.dernier ? r.dernier.at : a.derniereReception, maintenant);
    return { adresse: r.adresse, nom: r.nom, vu: !!quand, phrase: quand ? `dernier e-mail ${quand}` : 'pas d’e-mail vu parmi les derniers suivis — vérifie son transfert' };
  });
}
