// ════════════════════════════════════════════════════════════════════════════
//  LA VILLE D'UN POINT RELAIS — lue, reconnue, jamais devinée (3 nov., 19 h)
//  Julien (3 nov., 18 h 59) : « pour les colis ce n'est pas encore parfait, il ne
//  reconnaît pas les villes, c'est chiant, l'app doit être intelligente ».
//
//  Mesuré sur sa base (lecture seule, 30 jours, récit dans
//  docs/passation/historique-colis-retraits.md, « Les villes des colis ») :
//   · les consignes VINTED GO (22 des 47 e-mails « disponible ») n'écrivent
//     JAMAIS de code postal : « Adresse / Consigne Vinted Go / Kusmi Tea /
//     13 Rue Saint-Vincent / Vannes, France », et le suivi Vinted Go non plus
//     (« 13 Rue Saint-Vincent, Vannes, FR ») — or la ville du sélecteur
//     (`villeDuPoint`, CarteRelais) n'était lue qu'APRÈS un code postal : la
//     ville LUE « Vannes » était jetée, le point n'était dans aucune ville
//     (sauf fusion fortuite avec un autre colis du même nom portant un CP) ;
//   · les e-mails Mondial Relay rangés avec le NOM seul (9 : « TABA'VAP »,
//     « PHONE CASH », « LOCKER 24/7 SUPER U » — une ligne vide entre chaque
//     ligne depuis fin octobre) : rattrapés par le texte gardé de leur e-mail
//     (`src/lieuxRetrait.js`), sinon par le MÊME point déjà connu (ci-dessous) ;
//   · une ville choisie CACHAIT les colis sans ville et « Lieu à confirmer ».
//
//  Ce module (pur, aucune lecture) :
//   1. `normVille` : une clé par ville (casse, accents, tirets, apostrophes,
//      « St »/« Ste », CEDEX, arrondissements de Paris/Lyon/Marseille) ;
//      `joliNomVille` : la plus lisible des écritures LUES (rien d'inventé).
//   2. `villeDuPoint` : la ville LUE (avec ou sans code postal) ; sinon, pour un
//      code postal seul, la TABLE OFFICIELLE (Base Adresse Nationale, communes
//      de ce code postal) — une seule commune ⇒ son nom, plusieurs ⇒ le code
//      postal seul (« 35260 »), jamais une ville fausse ; sinon la ville du
//      géocodage SÛR de l'adresse, si son code postal est le même.
//   3. `villesDesPoints` : une ville = un bouton (même écrite autrement), le
//      nombre = les colis COMPTÉS de cette ville ; deux villes homonymes de deux
//      départements restent deux boutons.
//   4. `registrePointsConnus` / `completerParPointConnu` : un lieu SANS code
//      postal reprend l'adresse du MÊME point déjà vu AVEC son adresse (autre
//      e-mail, conversation, suivi) — même nom propre, même transporteur et même
//      compte quand les deux sont connus, même rue / même ville quand le lieu les
//      donne — et SEULEMENT si ce nom ne désigne qu'UN point parmi tous les points
//      connus : deux points du même nom ⇒ rien.
//   5. `lieuLePlusComplet` : deux sources du MÊME colis (même n° de suivi, même
//      achat) qui nomment le même point : celle qui porte l'adresse complète gagne.
//  Le serveur n'en a pas besoin (il ne range rien par ville) : aucune copie.
// ════════════════════════════════════════════════════════════════════════════
import { decouperAdresse, nomRelaisPropre, normNomRelais, normRue, PAYS_VILLE } from './relaisColis.js';

const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// ── 1. LA CLÉ D'UNE VILLE ────────────────────────────────────────────────────
// « SAINT-MALO » = « Saint Malo » = « St-Malo » = « st malo cedex » ;
// « Paris 15e » = « PARIS 15EME ARRONDISSEMENT » = « Paris » ; un pays ou un
// nombre n'est pas une ville ('').
export function normVille(v) {
  const brut = String(v || '').trim();
  if (!brut || PAYS_VILLE.test(brut)) return '';
  let s = sansAccents(brut).toLowerCase().replace(/[’'`_.\-]/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/\bcedex(?:\s*\d{1,3})?\b/g, ' ').replace(/\s+france$/, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/\bst\b/g, 'saint').replace(/\bste\b/g, 'sainte');
  s = s.replace(/^(paris|lyon|marseille)\s*\d{1,2}\s*(?:e|er|eme|em|ieme)?(?:\s*arrondissement)?$/, '$1');
  if (/\d/.test(s) || !/[a-z]{2}/.test(s)) return '';
  return s;
}
// Le département d'un code postal (pour séparer deux villes homonymes).
export const departement = (cp) => { const c = String(cp || ''); if (!/^\d{5}$/.test(c)) return ''; return /^9[78]/.test(c) ? c.slice(0, 3) : c.slice(0, 2); };

// La plus lisible des écritures LUES : avec minuscules et accents plutôt que
// « VANNES », « Saint » écrit plutôt que « St ». Tout en majuscules ⇒ mise en
// forme (« SAINT MALO » → « Saint Malo »), jamais un accent ajouté.
const PETITS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'sous', 'en', 'et', 'aux', 'au', 'lès', 'les']);
const miseEnForme = (v) => {
  const t = String(v || '').replace(/\s+/g, ' ').trim().replace(/[,.\s]+$/, '');
  if (!t) return '';
  if (t !== t.toUpperCase()) return t;
  let i = 0;
  return t.toLowerCase().replace(/[a-zà-ÿ]+/g, (w) => (i++ > 0 && PETITS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
};
const lisibilite = (v) => { const t = String(v || ''); return (t !== t.toUpperCase() ? 4 : 0) + (/[À-ÿ]/.test(t) ? 2 : 0) + (/-/.test(t) ? 1 : 0) - (/\bSte?\b/i.test(t) ? 3 : 0); };
export function joliNomVille(ecritures) {
  const l = [...new Set((ecritures || []).map((x) => String(x || '').trim()).filter(Boolean))];
  if (!l.length) return '';
  l.sort((a, b) => lisibilite(b) - lisibilite(a) || a.localeCompare(b, 'fr'));
  return miseEnForme(l[0]);
}

// ── 2. LA VILLE D'UN POINT ───────────────────────────────────────────────────
// `p` : { cp, ville, adresse } (un point de `pointsARetirer`).
// `communes` : { [cp]: string[] } — les communes de ce code postal selon la
//   table officielle (Base Adresse), quand elle a été lue ; absente ⇒ pas su.
// `villeCarte(p)` : la ville d'un géocodage SÛR de l'adresse de ce point, au
//   MÊME code postal (ou '').
// Rend { cle, nom, cp, dept, source: 'lue'|'table'|'carte'|'cp' } ou null.
export function villeDuPoint(p, { communes = null, villeCarte = null } = {}) {
  if (!p || p.inconnu) return null;
  let cp = /^\d{5}$/.test(String(p.cp || '')) ? String(p.cp) : '';
  let ville = String(p.ville || '').trim();
  if (!ville || !cp) {
    const d = decouperAdresse(p.adresse || '');
    if (!cp && /^\d{5}$/.test(String(d.cp || ''))) cp = d.cp;
    if (!ville && d.ville) ville = d.ville;
  }
  const dept = departement(cp);
  const nv = normVille(ville);
  if (nv) return { cle: nv, nom: ville, cp, dept, source: 'lue' };
  if (!cp) return null;
  const c = communes && Array.isArray(communes[cp]) ? communes[cp] : null;
  if (c && c.length === 1 && normVille(c[0])) return { cle: normVille(c[0]), nom: c[0], cp, dept, source: 'table' };
  if (!c || c.length !== 1) {
    const vc = typeof villeCarte === 'function' ? String(villeCarte(p) || '') : '';
    // Le géocodage ne départage PAS un code postal à plusieurs communes : il
    // vaut seulement quand la table n'a pas (encore) été lue.
    if (!c && normVille(vc)) return { cle: normVille(vc), nom: vc, cp, dept, source: 'carte' };
  }
  return { cle: 'cp:' + cp, nom: cp, cp, dept, source: 'cp' };
}

// ── 3. LE SÉLECTEUR : UNE VILLE = UN BOUTON ─────────────────────────────────
// Rend [{ cle, nom, n, points: [cle de point], cps }] (≥ 2 villes, sinon []).
// `n` = les colis COMPTÉS (`!horsCompte`) des points de cette ville — le même
// nombre que la carte sombre et que la section de la ville.
// (8 nov., Julien : « adapter les villes en fonction des points relais où sont les colis ») L'URGENCE
// d'un point : le nombre de jours avant la limite la plus proche de ses colis COMPTÉS (lue, sinon ce qui
// reste de la garde de son transporteur — `triPoint`, posé par `pointsARetirer`), sinon 99.
export const urgencePoint = (p) => { const t = p && Number.isFinite(p.triPoint) ? p.triPoint : (p && Number.isFinite(p.prochaineLimite) ? p.prochaineLimite : null); return t == null ? 99 : t; };
const compteDuPoint = (p) => (p.arrives || []).filter((c) => !c.horsCompte).length;
export function villesDesPoints(vue, opts = {}) {
  const l = villesAvecColis(vue, opts);
  return l.length >= 2 ? l : [];
}
// Toutes les villes où un colis ATTEND vraiment (≥ 1 colis compté), même une seule.
// Triées par URGENCE (la limite la plus proche d'abord), puis par nombre, puis par nom.
export function villesAvecColis(vue, opts = {}) {
  const lus = [];
  for (const p of ((vue && vue.points) || [])) {
    const v = villeDuPoint(p, opts);
    if (!v) continue;
    lus.push({ p, v, n: compteDuPoint(p) });
  }
  // Deux villes du même nom dans deux départements : deux boutons. Une ville
  // lue SANS code postal rejoint son homonyme seulement s'il n'y en a qu'un.
  const depts = new Map();
  for (const x of lus) { if (!depts.has(x.v.cle)) depts.set(x.v.cle, new Set()); if (x.v.dept) depts.get(x.v.cle).add(x.v.dept); }
  const m = new Map();
  for (const x of lus) {
    const ds = depts.get(x.v.cle);
    const cle = ds.size > 1 ? `${x.v.cle}|${x.v.dept || '?'}` : x.v.cle;
    const g = m.get(cle) || { cle, n: 0, points: [], noms: [], cps: [], dept: ds.size > 1 ? (x.v.dept || '') : '', urgence: 99 };
    g.n += x.n; g.points.push(x.p.cle); g.noms.push(x.v.nom); if (x.v.cp && !g.cps.includes(x.v.cp)) g.cps.push(x.v.cp);
    if (x.n > 0) g.urgence = Math.min(g.urgence, urgencePoint(x.p));
    m.set(cle, g);
  }
  const l = [...m.values()].map((g) => {
    const nom = g.cle.startsWith('cp:') ? g.cle.slice(3) : joliNomVille(g.noms);
    return { cle: g.cle, nom: g.dept ? `${nom} (${g.dept})` : (ds2(g) ? `${nom} (?)` : nom), n: g.n, points: g.points, cps: g.cps, urgence: g.urgence };
  // Une ville sans nom lisible, ou sans colis compté (que des « à vérifier », que des colis en route) : pas de bouton.
  }).filter((x) => x.n > 0 && String(x.nom || '').trim()).sort((a, b) => a.urgence - b.urgence || b.n - a.n || a.nom.localeCompare(b.nom, 'fr'));
  return l;
}
// LE SÉLECTEUR DE « À RETIRER » : les villes avec colis, puis « Autres » — les points CONNUS dont la
// ville n'est pas lue, où un colis compté attend (jamais le point « pas encore connu », qui reste sous
// « Lieu à confirmer » quel que soit le choix). Rend [] quand il n'y a pas au moins deux choix.
export const CLE_AUTRES = '__autres';
export function selecteurVilles(vue, opts = {}) {
  const l = villesAvecColis(vue, opts);
  const autres = ((vue && vue.points) || []).filter((p) => !p.inconnu && !villeDuPoint(p, opts) && compteDuPoint(p) > 0);
  if (autres.length) l.push({ cle: CLE_AUTRES, nom: 'Autres', n: autres.reduce((t, p) => t + compteDuPoint(p), 0), points: autres.map((p) => p.cle), cps: [], urgence: Math.min(...autres.map(urgencePoint)), autres: true });
  return l.length >= 2 ? l : [];
}
const ds2 = (g) => g.cle.endsWith('|?');
// Les points SANS ville (ni lue, ni code postal) : jamais cachés par un choix de ville.
export function pointsSansVille(vue, opts = {}) {
  return ((vue && vue.points) || []).filter((p) => p.inconnu || !villeDuPoint(p, opts)).map((p) => p.cle);
}

// ── LA TABLE OFFICIELLE : les communes d'un code postal (Base Adresse) ───────
// Réponse de `api-adresse.data.gouv.fr/search/?q=<cp>&type=municipality&postcode=<cp>&limit=N`.
// Rend les noms des communes (une par code INSEE) au code postal EXACT, ou null
// si la réponse n'est pas lisible ; une liste PLEINE (= limit) n'est pas
// complète ⇒ rendue telle quelle avec deux noms au moins (donc « plusieurs »).
export const LIMITE_COMMUNES = 20;
export function communesDepuisBan(json, cp) {
  if (!/^\d{5}$/.test(String(cp || ''))) return null;
  const feats = json && Array.isArray(json.features) ? json.features : null;
  if (!feats) return null;
  const parInsee = new Map();
  for (const f of feats) {
    const pr = (f && f.properties) || {};
    if (pr.type && pr.type !== 'municipality') continue;
    if (String(pr.postcode || '') !== String(cp)) continue;
    const nom = String(pr.city || pr.name || '').trim();
    if (!nom) continue;
    parInsee.set(String(pr.citycode || nom), nom);
  }
  const noms = [...parInsee.values()];
  if (feats.length >= LIMITE_COMMUNES && noms.length === 1) noms.push('…');
  return noms;
}

// ── 4. LE MÊME POINT, DÉJÀ CONNU AVEC SON ADRESSE ───────────────────────────
// `lieux` : [{ lieuNom, lieuAdresse, transporteur, compte }] — tous les lieux LUS
// (e-mails, conversations, suivis, lectures chez le transporteur), quel que
// soit l'état du colis. Rend un registre : nom propre → points distincts
// (code postal + rue), chacun avec ses transporteurs et comptes.
const cleRue = (r) => normRue(r || '');
// Le transporteur d'un lieu, en clé : « Mondial Relay » = « mondialrelay » ;
// « autre » (une ligne Vinted « t'attend ») et rien = pas su.
export const cleTransporteurLieu = (c) => { const k = String(c || '').toLowerCase().replace(/[^a-z]/g, ''); return k === 'autre' || k === 'colis' ? '' : k === 'vintedgo' ? 'vinted' : k === 'relaispickup' || k === 'pickup' || k === 'shoptoshop' ? 'chronopost' : k; };
export function registrePointsConnus(lieux) {
  const reg = new Map();
  for (const l of lieux || []) {
    if (!l) continue;
    const d = decouperAdresse(l.lieuAdresse || '');
    const cp = /^\d{5}$/.test(String(d.cp || '')) ? d.cp : '';
    const nom = nomRelaisPropre(l.lieuNom || '', d.ville);
    if (!nom) continue;
    const n = normNomRelais(nom);
    const liste = reg.get(n) || [];
    // Un point est un endroit : son code postal, et sa rue quand elle est lue.
    // Sans code postal, le lieu ne fait pas foi (il ne sert qu'à compter les homonymes par sa rue/ville).
    const ici = { cp, rue: d.rue || '', ville: d.ville || '', nom, transporteurs: new Set(), comptes: new Set() };
    let pt = liste.find((q) => (cp && q.cp === cp && (!q.rue || !ici.rue || cleRue(q.rue) === cleRue(ici.rue))) || (!cp && !q.cp && cleRue(q.rue) === cleRue(ici.rue) && normVille(q.ville) === normVille(ici.ville)));
    if (!pt) { pt = ici; liste.push(pt); }
    pt.rue = pt.rue || ici.rue; pt.ville = pt.ville || ici.ville;
    if (cleTransporteurLieu(l.transporteur)) pt.transporteurs.add(cleTransporteurLieu(l.transporteur));
    if (l.compte) pt.comptes.add(String(l.compte));
    reg.set(n, liste);
  }
  // Un lieu sans code postal qui est clairement un point complet déjà listé (même rue, même ville) n'est pas un homonyme.
  for (const [n, liste] of reg) {
    const complets = liste.filter((q) => q.cp);
    reg.set(n, liste.filter((q) => q.cp || !complets.some((c) => (q.rue && c.rue && cleRue(q.rue) === cleRue(c.rue)) || (!q.rue && q.ville && normVille(q.ville) === normVille(c.ville)) || (!q.rue && !q.ville))));
  }
  return reg;
}
// `lu` : { lieuNom, lieuAdresse } d'un colis (sans code postal) ; `qui` :
// { transporteur, compte } de CE colis. Rend `lu` complété
// (`lieuComplete: 'point-connu'`) ou `lu` inchangé.
export function completerParPointConnu(lu, registre, qui = {}) {
  if (!lu || !registre || lu.lieuConflit) return lu;
  const d = decouperAdresse(lu.lieuAdresse || '');
  if (/^\d{5}$/.test(String(d.cp || ''))) return lu;
  const nom = nomRelaisPropre(lu.lieuNom || '', d.ville);
  if (!nom) return lu;
  const liste = registre.get(normNomRelais(nom)) || [];
  // Deux points connus sous ce nom (deux codes postaux, deux rues, ou un lieu
  // incomplet qu'on ne sait pas placer) ⇒ on ne choisit pas.
  if (liste.length !== 1 || !liste[0].cp) return lu;
  const q = liste[0];
  if (d.rue && q.rue && cleRue(d.rue) !== cleRue(q.rue)) return lu;
  if (d.ville && q.ville && normVille(d.ville) !== normVille(q.ville)) return lu;
  const tr = cleTransporteurLieu(qui.transporteur), cpt = String(qui.compte || '');
  if (tr && q.transporteurs.size && !q.transporteurs.has(tr)) return lu;
  if (cpt && q.comptes.size && !q.comptes.has(cpt)) return lu;
  const rue = d.rue || q.rue;
  if (!rue && !q.ville) return lu;
  return { ...lu, lieuAdresse: `${rue ? rue + ', ' : ''}${[q.cp, d.ville || q.ville].filter(Boolean).join(' ')}`, lieuComplete: lu.lieuComplete || 'point-connu' };
}

// ── 5. DEUX SOURCES DU MÊME COLIS : L'ADRESSE COMPLÈTE GAGNE ────────────────
// `a`, `b` : { lieuNom, lieuAdresse }. Elles ne se complètent que si elles
// nomment le MÊME point (même nom propre — ou l'une sans nom — et rien de
// contraire : même code postal, même rue, même ville quand les deux les
// donnent). Sinon `a` reste (rien n'est choisi à sa place).
export const completudeLieu = (l) => { const d = decouperAdresse((l && l.lieuAdresse) || ''); return (/^\d{5}$/.test(String(d.cp || '')) ? 4 : 0) + (normVille(d.ville) ? 2 : 0) + (d.rue ? 1 : 0); };
export function memePoint(a, b) {
  const da = decouperAdresse((a && a.lieuAdresse) || ''), db = decouperAdresse((b && b.lieuAdresse) || '');
  const na = normNomRelais(nomRelaisPropre((a && a.lieuNom) || '', da.ville)), nb = normNomRelais(nomRelaisPropre((b && b.lieuNom) || '', db.ville));
  if (na && nb && na !== nb) return false;
  if (!na && !nb) return false;
  if (da.cp && db.cp && da.cp !== db.cp) return false;
  if (da.rue && db.rue && cleRue(da.rue) !== cleRue(db.rue)) return false;
  if (normVille(da.ville) && normVille(db.ville) && normVille(da.ville) !== normVille(db.ville)) return false;
  return true;
}
export function lieuLePlusComplet(a, b) {
  if (!b || !(b.lieuNom || b.lieuAdresse) || (a && a.lieuConflit)) return a;
  if (!a || !(a.lieuNom || a.lieuAdresse)) return b ? { ...b } : a;
  if (!memePoint(a, b) || completudeLieu(b) <= completudeLieu(a)) return a;
  return { ...a, lieuNom: a.lieuNom || b.lieuNom, lieuAdresse: b.lieuAdresse, lieuComplete: a.lieuComplete || 'autre-source' };
}
