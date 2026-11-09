// ════════════════════════════════════════════════════════════════════════════
//  COLIS → « ENVOYÉS » : QUI TRANSPORTE, ET DANS QUEL ORDRE (9 nov.)
//  Julien (8 nov., capture « Envoyés · 20 ») : « Ici il n'y a pas que 1
//  Chronopost […]. Je veux que ce soit amélioré et que tu mettes le plus récent
//  en haut, comme pour tous les onglets. »
//
//  Avant : les colis étaient rangés en GROUPES par transporteur, dans l'ordre du
//  premier colis de chaque groupe, et tout colis sans transporteur lu tombait
//  dans « Autres » (18 sur 20 chez lui). Le transporteur d'une vente Vinted ne
//  se lisait QUE dans la forme du n° de son bordereau.
//
//  Maintenant (une règle, un seul endroit — §11) :
//   · `transporteurDeVente` : le transporteur d'une vente Vinted, par SON
//     bordereau (le MÊME n° de transaction) et le n° EXACT de ce bordereau,
//     dans l'ordre : la ligne `depart_{c}_{n°}` lue chez le transporteur (il a
//     répondu pour ce n° : prise en charge datée) ; puis (9 nov.) le transporteur NOMMÉ sur
//     l'étiquette (le PDF du bordereau, source `pdf`) ; puis la règle commune `transporteurDuColis` (ligne
//     `transp_`, transporteur NOMMÉ dans l'e-mail du bordereau, e-mails du même
//     n°, forme propre du n°). Jamais par titre, jamais par ressemblance ;
//     rien ⇒ « Transporteur inconnu » (pas « Autres »).
//   · `quandEnvoye` : la date qui range un colis — la prise en charge LUE (chez
//     le transporteur, dans son e-mail), sinon le « Colis fait » coché, sinon la
//     date de vente ; la source est rendue (l'écran la dit).
//   · `rangerEnvoyes` : le plus récent en haut ; à date égale, l'ordre d'avant.
//   · `filtresTransporteurs` / `filtrerEnvoyes` : les pastilles « Tous ·
//     Chronopost 9 · … · Transporteur inconnu 3 » (le plus fourni d'abord,
//     l'inconnu en dernier) et la liste d'une pastille.
// ════════════════════════════════════════════════════════════════════════════
import { transporteurDuColis, cleTransporteur, nomDuTransporteur, PAS_LU } from './transporteursVisuels.js';
import { normaliserSuivi } from '../api/_lib/etat-colis-email.js';

export const INCONNU = PAS_LU;   // « Transporteur inconnu »

const msDe = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
};

// La ligne de départ lue pour ce n° (Map n° → ligne, ou liste).
const ligneDepart = (departs, n) => {
  if (!departs || !n) return null;
  if (typeof departs.get === 'function') return departs.get(n) || null;
  if (Array.isArray(departs)) return departs.find((d) => d && normaliserSuivi(d.suivi) === n) || null;
  return null;
};

// Le transporteur d'une vente Vinted. `bord` : SON bordereau (`bordsParTx[tx]`,
// { suivi, transporteur }) ; `departs` : Map n° → `depart_*` ; `transp`,
// `suivisEmail` : ceux de `transporteurDuColis`. Rend { cle, nom, source }.
// (9 nov., transporteurs inconnus) `pdf` : ce que l'ÉTIQUETTE de CETTE transaction nomme
// ({ t, s }), pour une vente dont le bordereau n'est pas venu par e-mail (PDF capté par
// l'extension, relu au cron) ; le bordereau e-mail porte le sien (`transporteurPdf`, `suiviPdf`).
export function transporteurDeVente({ bord = null, pdf = null, departs = null, transp = null, suivisEmail = null } = {}) {
  const tPdf = (bord && bord.transporteurPdf) || (pdf && pdf.t) || '';
  const sPdf = (bord && bord.suiviPdf) || (pdf && pdf.s) || '';
  const n = normaliserSuivi((bord && bord.suivi) || sPdf);
  const d = ligneDepart(departs, n);
  // Le transporteur a RÉPONDU pour ce n° : une prise en charge datée (`priseAt`, posée
  // seulement par une lecture réussie). Un essai sans réponse ne nomme personne.
  const cD = d && normaliserSuivi(d.suivi) === n && msDe(d.priseAt) != null ? cleTransporteur(d.carrier) : null;
  if (cD) return { cle: cD, nom: nomDuTransporteur(cD), source: 'transporteur' };
  // (9 nov.) Puis l'étiquette elle-même : UN seul transporteur nommé dans le PDF du bordereau
  // (api/_lib/transporteur-pdf.js — deux noms ⇒ rien posé, jamais deviné).
  const cP = tPdf ? cleTransporteur(tPdf) : null;
  if (cP) return { cle: cP, nom: nomDuTransporteur(cP), source: 'pdf' };
  return transporteurDuColis({ declare: (bord && bord.transporteur) || '', suivi: n, transp, suivisEmail });
}

export const nomEnvoye = (t) => (t && t.nom) || INCONNU;

// La date qui range un colis envoyé. `x` : { depart?: {at}, coche?: ms, vente?: ms|iso }.
// Rend { ms, source: 'depart' | 'coche' | 'vente' | null }.
export function quandEnvoye({ depart = null, coche = null, vente = null } = {}) {
  const d = depart && msDe(depart.at);
  if (d != null) return { ms: d, source: 'depart' };
  const c = msDe(coche);
  if (c != null) return { ms: c, source: 'coche' };
  const v = msDe(vente);
  if (v != null) return { ms: v, source: 'vente' };
  return { ms: null, source: null };
}

// Le plus récent en haut ; sans date en bas ; à égalité, l'ordre reçu (stable).
export function rangerEnvoyes(liste, quand = (x) => x && x.quand && x.quand.ms) {
  return (Array.isArray(liste) ? liste : []).map((x, i) => [x, i, quand(x)])
    .sort((a, b) => {
      const A = Number.isFinite(a[2]) ? a[2] : null, B = Number.isFinite(b[2]) ? b[2] : null;
      if (A == null && B == null) return a[1] - b[1];
      if (A == null) return 1;
      if (B == null) return -1;
      return (B - A) || (a[1] - b[1]);
    }).map(([x]) => x);
}

// Les pastilles : [{ nom, cle, n }] — le plus fourni d'abord, l'inconnu en dernier.
export function filtresTransporteurs(liste, tr = (x) => x && x.tr) {
  const par = new Map();
  for (const x of Array.isArray(liste) ? liste : []) {
    const t = tr(x); const nom = nomEnvoye(t);
    const p = par.get(nom) || { nom, cle: (t && t.cle) || null, n: 0 };
    p.n++; par.set(nom, p);
  }
  return [...par.values()].sort((a, b) => ((a.nom === INCONNU) - (b.nom === INCONNU)) || (b.n - a.n) || a.nom.localeCompare(b.nom, 'fr'));
}

// La liste d'une pastille (`'tous'` ou le nom d'un transporteur). Un filtre qui
// ne correspond plus à rien (le dernier colis de ce transporteur est livré)
// revient à « tous » — jamais une liste vide qui cacherait les colis.
export function filtrerEnvoyes(liste, filtre, tr = (x) => x && x.tr) {
  const L = Array.isArray(liste) ? liste : [];
  if (!filtre || filtre === 'tous') return { liste: L, filtre: 'tous' };
  const f = L.filter((x) => nomEnvoye(tr(x)) === filtre);
  return f.length ? { liste: f, filtre } : { liste: L, filtre: 'tous' };
}
