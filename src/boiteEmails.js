// ── LA BOÎTE DE RÉCEPTION « E-MAILS » (5 nov., demande de Julien) ───────────
// « Un onglet dédié aux e-mails… une vraie boîte de réception, des filtres (par
// compte, ventes, achats, codes de retrait…) ». Règles PURES (sans React) lues
// par l'écran (src/BoiteEmails.jsx), l'audit et le banc.
//
// ⚠️ §5 IDENTITÉ : le lien « Voir dans VRM » ne part QUE d'une identité lue dans
//    l'email — celle que la phrase du journal reconnaît déjà (`lectureEmail` :
//    n° de suivi, n° de transaction, N° lu dans l'email). Un N° retrouvé par le
//    titre (`nt`) ou un reçu délié par lui n'ouvre rien. Une seule règle (§11).
// ⚠️ « Pas su » ≠ « rien » : pièces jointes non gardées (email classé avant le
//    5 nov.) ⇒ `null` et la phrase le dit ; `[]` seulement si on a lu « aucune ».
import { lectureEmail, expediteurLisible } from './journalEmail.js';

export { expediteurLisible };

// La date d'un email : celle de la boîte d'origine si elle a été transmise
// (`sourceDate`), sinon l'heure où VRM l'a rangé.
export const dateEmail = (e) => (e && (e.sourceDate || e.at)) || null;

// Le corps texte, nettoyé pour la lecture : les liens de pistage interminables
// réduits à leur domaine, les caractères invisibles retirés, les lignes vides
// resserrées. Du TEXTE seulement (React l'échappe) : aucun HTML n'est rendu.
// (Construits par chaîne, en échappements : un séparateur de ligne Unicode
// écrit tel quel dans une expression littérale casse la compilation.)
const INVISIBLES = new RegExp('[\\u200b-\\u200f\\u00ad\\u034f\\ufeff\\u2060-\\u2064]', 'g');
const SEPARATEURS = new RegExp('[\\u2028\\u2029]', 'g');
const ESPACES = new RegExp('[ \\t\\u00a0]+', 'g');
export function nettoyerCorps(texte) {
  if (typeof texte !== 'string') return null;
  const t = texte
    .replace(INVISIBLES, '')
    .replace(SEPARATEURS, '\n')
    .replace(/https?:\/\/[^\s<>()"']{60,}/g, (u) => { const d = (/^https?:\/\/([^/?#\s]+)/.exec(u) || [])[1]; return d ? `[lien ${d}]` : '[lien]'; })
    .split('\n').map((l) => l.replace(ESPACES, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return t;
}

// Le poids lisible d'une pièce jointe (estimé depuis son contenu reçu).
export function poidsLisible(o) {
  if (!Number.isFinite(o) || o < 0) return '';
  if (o < 1024) return `${o} o`;
  if (o < 1024 * 1024) return `${Math.round(o / 1024)} Ko`;
  return `${(o / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

const enc = encodeURIComponent;
// L'objet relié dans VRM, PAR IDENTITÉ — ou `null`. Rend `{ k, url, mot }` :
// `url` est un chemin `?tab=…&cible=…` (src/cibleNotif.js), `k === 'num'` ouvre
// « Tout sur le N° ».
export function objetRelie(e, delies = {}) {
  if (!e) return null;
  const l = lectureEmail(e, delies);
  const r = e.resume && typeof e.resume === 'object' ? e.resume : null;
  if (!r || l.etat === 'reessai') return null;
  const c = l.cible;
  if (c && c.k === 'suivi' && r.t === 'suivi' && r.sens !== 'sortant') return { k: 'retrait', url: `?tab=cat_bord&cible=retrait&suivi=${enc(c.v)}`, mot: `Voir le colis n° ${c.v}` };
  if (c && c.k === 'tx' && r.t === 'bordereau') return { k: 'colis', url: `?tab=cat_bord&cible=colis&tx=${enc(c.v)}`, mot: `Voir le colis de la vente n° ${c.v}` };
  if (c && c.k === 'tx' && r.t === 'achat' && l.etat !== 'delie') return { k: 'achat', url: `?tab=achats&cible=achat&tx=${enc(c.v)}`, mot: `Voir l’achat n° ${c.v}` };
  if (l.num) return { k: 'num', num: l.num, mot: `Tout sur le N°${l.num}` };
  return null;
}

// Ce que VRM a fait de l'email, en une phrase (la même que le journal).
export function ceQueVrmAFait(e, delies = {}) {
  const l = lectureEmail(e, delies);
  return { quoi: l.quoi, fait: l.fait, etat: l.etat, raison: l.raison, geste: l.geste };
}
