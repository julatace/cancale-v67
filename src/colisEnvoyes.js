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
import { ordreRecent } from './ordreRecent.js';

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
// (10 nov., Julien : « il y a des endroits où c'est marqué transporteur inconnu ») CE QUI S'ÉCRIT
// À L'ÉCRAN pour un groupe sans transporteur lu : des mots neutres, jamais « inconnu » en gros.
// `INCONNU` reste la CLÉ interne des groupes et des pastilles (règles, bancs) et l'`aria-label`.
export const SANS_TRANSPORTEUR = 'Transporteur à identifier';
export const libelleTransp = (nom) => (!nom || nom === INCONNU ? SANS_TRANSPORTEUR : nom);

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
// (9 nov., soir, lot AJ) La règle unique des listes (src/ordreRecent.js) : même comportement.
export function rangerEnvoyes(liste, quand = (x) => x && x.quand && x.quand.ms) {
  return ordreRecent(liste, quand);
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

// ════════════════════════════════════════════════════════════════════════════
//  (9 nov. au soir, « transporteurs parfaits ») CE QUI RESTE INCONNU EST COMPTÉ ET DIT
//  Julien : « Ce n'est pas possible d'avoir "transporteur inconnu" sachant que tu as les
//  bordereaux en ta possession. » Toutes les étiquettes sont maintenant lues (serveur :
//  réception, cron, passage de 15 min, app ouverte). Un colis qui reste « inconnu » l'est
//  pour UNE raison, lue — jamais un transporteur deviné :
//    · 'a-lire'     — son étiquette n'a pas encore été lue (lecture en cours) ;
//    · 'muette'     — l'étiquette ne porte aucun nom lisible (image, police sans table) et
//                     ni son n°, ni un e-mail, ni le transporteur ne le nomment ;
//    · 'plusieurs'  — l'étiquette nomme deux transporteurs (on ne choisit pas) ;
//    · 'illisible'  — le PDF ne s'ouvre pas ;
//    · 'sans-pdf'   — la ligne du bordereau n'a plus son PDF ;
//    · 'sans-bordereau' — aucun bordereau rangé pour cette vente (ni e-mail, ni extension).
//  `bord` : SON bordereau e-mail (avec `hasPdf`, `pdfLu`) ; `pdf`/`vu` : ce que la passe des
//  étiquettes a rangé pour CE n° de transaction (`pdf[tx]`, `pdfVus[tx]`).
// ════════════════════════════════════════════════════════════════════════════
export const RAISONS_INCONNU = Object.freeze({
  'a-lire': ['étiquette en cours de lecture', 'étiquettes en cours de lecture'],
  muette: ['étiquette sans nom lisible', 'étiquettes sans nom lisible'],
  plusieurs: ['étiquette qui nomme deux transporteurs', 'étiquettes qui nomment deux transporteurs'],
  illisible: ['PDF illisible', 'PDF illisibles'],
  'sans-pdf': ['bordereau sans PDF', 'bordereaux sans PDF'],
  'sans-bordereau': ['vente sans bordereau reçu par VRM', 'ventes sans bordereau reçu par VRM'],
});
export function raisonInconnu({ bord = null, pdf = null, vu = null } = {}) {
  const lu = (bord && bord.pdfLu && bord.pdfLu !== 'None') ? String(bord.pdfLu) : '';
  const r = lu && lu !== 'ok' ? lu : (vu && vu.r) || '';
  if (r === 'aucun') return 'muette';
  if (r === 'plusieurs' || r === 'illisible' || r === 'sans-pdf') return r;
  if (lu === 'ok' || (pdf && pdf.t)) return 'muette';   // lue, mais rien que VRM connaisse
  if (bord && bord.hasPdf) return 'a-lire';
  if (bord) return 'sans-pdf';
  if (pdf || vu) return 'muette';
  return 'sans-bordereau';
}
// Les comptes par raison, dans l'ordre de RAISONS_INCONNU : [{ cle, n, texte }].
export function compterRaisons(raisons) {
  const n = new Map();
  for (const r of raisons || []) if (r) n.set(r, (n.get(r) || 0) + 1);
  return Object.keys(RAISONS_INCONNU).filter((k) => n.get(k)).map((k) => ({ cle: k, n: n.get(k), texte: RAISONS_INCONNU[k][n.get(k) > 1 ? 1 : 0] }));
}

// ════════════════════════════════════════════════════════════════════════════
//  (15 nov., 23 h — Julien, capture iPhone Ventes → À expédier : « Le transporteur
//  inconnu n'est pas possible ») LE TRANSPORTEUR D'UN COLIS À EXPÉDIER EST CONNU
//  DÈS QU'UNE SOURCE EXISTE, ET « INCONNU » N'EST JAMAIS UNE TUILE.
//
//  Mesuré sur la vraie base (lecture seule) : les tuiles « Tous 3 · Colissimo 1 ·
//  Transporteur inconnu 2 » lisaient le transporteur par le seul bordereau E-MAIL
//  (`transporteurVente(x.b)`, sans le n° de transaction). Une vente dont le
//  bordereau a été capté par l'extension (aucun e-mail : la boîte du compte n'est
//  pas reliée) avait pourtant son étiquette LUE (transporteur et n° rangés dans
//  `vrm_bord_transporteurs.pdf[tx]`) — et la carte, elle, le disait (elle passait
//  le n°). Vinted ne range le transporteur NULLE PART avant l'étiquette : 0 sur
//  1 432 détails de transaction (`shipment` = id + statut), 0 sur 934
//  conversations, 0 dans `my_orders` ; l'étiquette est la source.
//
//  La règle (une, ici — l'écran, la tournée, les tuiles et `vrm_colis_aposter`) :
//   · `transporteurDeLigne(x, deVente)` : une ligne de « À expédier » ; une vente
//     Vinted se lit TOUJOURS par SON n° de transaction (bordereau e-mail, puis
//     étiquette relue, puis transporteur, e-mails du même n°, forme du n° —
//     `transporteurDeVente`), jamais par le bordereau e-mail seul ;
//   · `pourquoiSansTransporteur(...)` : pourquoi une ligne n'a PAS de transporteur, et le
//     geste. Aucune source encore (ni bordereau, ni étiquette captée, ni lecture)
//     ⇒ 'pas-encore-lu' + le compte à ouvrir sur vinted.fr ; une étiquette captée
//     pas encore relue ⇒ 'a-lire' ; une étiquette lue qui ne nomme personne ⇒ la
//     raison de `raisonInconnu` ; un autre site ⇒ 'site' (il ne l'a pas dit) ;
//   · `tuilesTransporteursConnus(liste, tr)` : les tuiles ne regroupent QUE des
//     transporteurs connus ; le reste est rendu (une ligne discrète, par raison).
// ════════════════════════════════════════════════════════════════════════════
export const estConnu = (t) => nomEnvoye(t) !== INCONNU;

// `x` : une ligne de `colisAEnvoyerBase` ({ __autre, tr } pour un autre site ;
// { o, b, txn } pour une vente Vinted). `deVente(b, tx)` : `transporteurVente` de l'app.
export function txDeLigne(x) {
  if (!x || x.__autre) return '';
  return String(x.txn || (x.o && x.o.transaction_id != null ? x.o.transaction_id : '') || (x.b && x.b.transaction) || '');
}
// La vente par SON n° (`transporteurVente` de l'app, ici pour qu'un audit l'EXÉCUTE) : le n° du bordereau e-mail,
// sinon celui de la ligne ; `pdfParTx` : `vrm_bord_transporteurs.pdf` ({ tx: { t, s } }, l'étiquette relue).
export function transporteurParTx(b, tx, { pdfParTx = null, departs = null, transp = null, suivisEmail = null } = {}) {
  const k = String((b && b.transaction) || tx || '');
  return transporteurDeVente({ bord: b || null, pdf: (k && pdfParTx && pdfParTx[k]) || null, departs, transp, suivisEmail });
}
export function transporteurDeLigne(x, deVente) {
  if (!x) return null;
  if (x.__autre) return x.tr || null;
  return typeof deVente === 'function' ? (deVente(x.b || null, txDeLigne(x)) || null) : null;
}

export const RAISONS_PAS_LU = Object.freeze(['pas-encore-lu', 'a-lire', 'muette', 'plusieurs', 'illisible', 'sans-pdf', 'site']);
// `site` : 'vinted' | 'vestiaire' | 'ebay' | 'leboncoin' ; `bord` : SON bordereau e-mail ;
// `pdf`/`vu` : ce que la passe des étiquettes a rangé pour SON n° ; `capte` : l'étiquette captée
// par l'extension (`harvest_{uid}_label_{tx}`) ; `compte` : le pseudo du compte de la vente.
// Rend { cle, compte } — `cle` dans RAISONS_PAS_LU, jamais « inconnu ».
export function pourquoiSansTransporteur({ site = 'vinted', bord = null, pdf = null, vu = null, capte = null, compte = '' } = {}) {
  const c = String(compte || '').trim();
  if (site && site !== 'vinted') return { cle: 'site', compte: c };
  const r = raisonInconnu({ bord, pdf, vu });
  if (r === 'sans-bordereau') return capte ? { cle: 'a-lire', compte: c } : { cle: 'pas-encore-lu', compte: c };
  return { cle: r, compte: c };
}

// Les tuiles : seulement les transporteurs CONNUS ([{ nom, cle, n }], l'ordre de
// `filtresTransporteurs`) ; `reste` : les lignes sans transporteur lu (rien de caché).
export function tuilesTransporteursConnus(liste, tr = (x) => x && x.tr) {
  const L = Array.isArray(liste) ? liste : [];
  return { tuiles: filtresTransporteurs(L, tr).filter((p) => p.nom !== INCONNU), reste: L.filter((x) => !estConnu(tr(x))) };
}

// Le reste, compté par raison (l'ordre de RAISONS_PAS_LU) : [{ cle, n, comptes }] —
// `comptes` : les pseudos à ouvrir sur vinted.fr ('pas-encore-lu'), sans doublon, triés.
export function resumePasLus(raisons) {
  const par = new Map();
  for (const r of raisons || []) {
    if (!r || !r.cle) continue;
    const p = par.get(r.cle) || { cle: r.cle, n: 0, comptes: new Set() };
    p.n++; if (r.compte) p.comptes.add(r.compte); par.set(r.cle, p);
  }
  return RAISONS_PAS_LU.filter((k) => par.has(k)).map((k) => { const p = par.get(k); return { cle: k, n: p.n, comptes: [...p.comptes].sort((a, b) => a.localeCompare(b, 'fr')) }; });
}
