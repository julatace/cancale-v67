// ── CE QUE VRM A FAIT D'UN EMAIL (31 oct., demande de Julien) ───────────────
// « Mettre ce que l'app reçoit par mail de façon plus claire pour le vendeur,
// comme ça s'il y a une erreur c'est plus simple. »
//
// Au classement (`repondre` d'api/email-inbound.js), la ligne de suivi
// `email_reception_*` reçoit un RÉSUMÉ COURT : le type, les quelques champs
// lus qui disent ce que l'email a déclenché, et les IDENTITÉS de la chose
// touchée (n° de transaction, n° de suivi, id de la ligne du reçu). Jamais le
// corps, jamais une pièce jointe, jamais un montant recalculé : quelques
// dizaines d'octets. La phrase lisible est fabriquée à l'écran
// (src/journalEmail.js) depuis ces champs — une seule règle.
//
// ⚠️ §5 : une identité est un n° LU DANS L'EMAIL. Un N° de rangement retrouvé
//    par RESSEMBLANCE de titre (`numeroDEmail(...).parTitre`) n'en est pas une :
//    il est marqué `nt` et l'email passe « à vérifier » — l'écran ne relie rien
//    par ce N°.
// ⚠️ « Pas su » ≠ « rien » : un champ non lu est ABSENT, jamais `0` ni `''`.

export const RESUME_VERSION = 1;
// Plafond du texte gardé pour « voir le texte » (lu un email à la fois, sur
// son clic, dans une ligne À PART — jamais dans la liste).
export const TEXTE_MAX = 1500;

const court = (s, n = 50) => { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t ? t.slice(0, n) : undefined; };
const ident = (s, n = 40) => { const t = String(s == null ? '' : s).replace(/\s+/g, '').trim(); return /^[A-Za-z0-9_-]{1,40}$/.test(t) ? t.slice(0, n) : undefined; };
const propre = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === null || o[k] === '') delete o[k]; return o; };

// Les raisons « à vérifier » — des CODES (l'écran dit la phrase et le geste).
export const RAISONS = ['num-titre', 'sans-pdf', 'sans-suivi', 'sans-tx', 'analyse', 'incompris', 'panne'];

// corps : ce que la branche répond (`repondre(res, code, corps)`) ;
// extra : ce que la branche a posé dans le contexte de la requête (identités
//         qui ne partent pas dans la réponse : `parTitre`, id de la ligne…).
export function resumeClassement(code, corps, extra) {
  const c = corps && typeof corps === 'object' ? corps : {};
  const x = extra && typeof extra === 'object' ? extra : {};
  if (code >= 400) return { v: RESUME_VERSION, t: 'panne', av: 'panne' };
  const t = String(c.type || '');
  let r;
  switch (t) {
    case 'suivi': {
      r = { t, tr: court(c.carrier, 20), s: ident(c.suivi), st: court(c.status, 12), code: court(x.code, 20), lieu: court(x.lieu, 50), lim: court(x.limite, 25), sens: x.sens === 'sortant' ? 'sortant' : undefined };
      if (!r.s && ['available', 'delivered', 'retour'].includes(c.status)) r.av = 'sans-suivi';
      break;
    }
    case 'bordereau': {
      if (c.garde) { r = { t, av: 'analyse' }; break; }
      r = { t, tx: ident(c.transaction), n: court(c.numero, 12), nt: x.parTitre ? 1 : undefined, pdf: c.pdf ? 1 : 0, tp: c.tamponne ? 1 : undefined, a: court(x.article) };
      r.av = !r.tx ? 'analyse' : !c.pdf ? 'sans-pdf' : x.parTitre && r.n ? 'num-titre' : undefined;
      break;
    }
    case 'finalisation': r = { t, mt: court(c.montant, 12), a: court(c.article) }; break;
    case 'achat': {
      r = { t, tx: ident(c.transaction), a: court(c.article), px: court(c.prix, 12), id: ident(x.ligne, 40), pdf: c.pdf ? 1 : 0 };
      if (!r.tx) r.av = 'sans-tx';
      break;
    }
    case 'vente': {
      if (c.garde) { r = { t, av: 'analyse' }; break; }
      r = { t, a: court(x.article), px: court(c.prix, 12), n: court(c.numero, 12), ps: court(c.pseudo, 30), fac: c.facture && c.facture.number ? court(c.facture.number, 30) : undefined };
      break;
    }
    case 'offre': r = { t, mt: court(c.montant, 12), de: court(c.de, 30), a: court(c.article) }; break;
    case 'message': r = { t, de: court(c.de, 30), a: court(c.paire) }; break;
    case 'favori': r = { t, de: court(c.de, 30), a: court(c.article) }; break;
    case 'action': r = { t, f: court(c.famille, 60) }; break;
    case 'connu-sans-action': r = { t, f: court(c.famille, 60) }; break;
    case 'ignoré': r = { t: 'incompris', av: 'incompris' }; break;
    default: r = { t: 'information' };
  }
  return propre({ v: RESUME_VERSION, ...r });
}

// Le texte lisible d'un email, borné, pour « voir le texte » : du TEXTE seul
// (jamais de HTML), espaces resserrés, plafonné. Les liens de preuve d'adresse
// sont déjà retirés en amont (`retirerLiensPreuve`, normalizeInbound).
export function texteBorne(texte) {
  const t = String(texte == null ? '' : texte)
    .replace(/<[^>]{0,400}>/g, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*(\n\s*)+/g, '\n\n')
    .trim();
  if (!t) return '';
  return t.length > TEXTE_MAX ? t.slice(0, TEXTE_MAX) + '…' : t;
}
