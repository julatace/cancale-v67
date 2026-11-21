// ════════════════════════════════════════════════════════════════════════════
// TOUS LES PARAMÈTRES DE PUBLICATION eBAY — RÈGLES PURES DE L'APP (11 nov., lot
// `ebay-complet`). Julien : « propose TOUS les paramètres qu'eBay propose pour la
// publication ; l'app doit DEMANDER si elle ne trouve pas une catégorie, une
// couleur… ».
//
// Aucune lecture, aucun appel, aucun texte : ce module rend des CLÉS de
// traduction (`tr()` les dit à l'écran) et des objets. Il est RÉUTILISABLE par le
// lot `publier-partout` (même catalogue, mêmes défauts, mêmes questions) — mode
// d'emploi dans docs/passation/2026-11-11-ebay-complet.md (« Pour publier-partout »).
//
// Ce qu'il garantit :
//   • `parametresServeur(r, compte)` rend EXACTEMENT ce que la route relit
//     (`optionsPublication`, api/_lib/ebay-parametres.js) — et `null` quand rien
//     ne diffère d'avant : une annonce sans réglage part au caractère près
//     comme avant (le serveur ne voit pas `parametres`).
//   • §2.8 : aucun champ de port, de transporteur, ni « livraison gratuite » —
//     la livraison est GÉRÉE par eBay, l'acheteur paie le bordereau.
//   • §3 : l'offre auto ne passe QUE par le seuil natif d'eBay (règle d'offre,
//     posée ailleurs, sur son clic) ; ici « accepter les offres » sans seuil.
//   • Rien n'est inventé (§5) : une caractéristique n'est pré-remplie que par un
//     FAIT de l'annonce Vinted ; une valeur hors de la liste fermée d'eBay
//     (SELECTION_ONLY) devient une QUESTION, jamais une valeur proche.
//   • « Pas su » ne vaut pas « non » : `null` reste `null` jusqu'à l'écran.
// ════════════════════════════════════════════════════════════════════════════

export const CLE_DEFAUTS_EBAY = 'vrm_ebay_publication_defaut';
export const CLE_GUIDE_VU = 'vrm_ebay_guide_vu';

// Les listes FERMÉES d'eBay (les mêmes que le serveur : api/_lib/ebay-parametres.js).
export const DUREES_ENCHERE = Object.freeze([1, 3, 5, 7, 10]);
export const DELAIS_ENVOI = Object.freeze([0, 1, 2, 3, 4, 5, 10, 15, 20, 30]);
export const JOURS_RETOUR = Object.freeze([14, 30, 60]);
export const PAYEURS_RETOUR = Object.freeze(['Buyer', 'Seller']);
export const SOUS_TITRE_MAX = 55;
export const TAUX_SPONSOR_MIN = 2;
export const TAUX_SPONSOR_MAX = 100;
export const TAUX_TVA_MAX = 30;

// « Comme avant » : ce qu'une annonce VRM portait avant ce lot (itemXml).
// Délai d'envoi 3 j, retours acceptés 14 j à la charge de l'acheteur, prix fixe
// jusqu'à annulation, aucune option payante. Le réglage d'usine des défauts.
export const DEFAUTS_USINE = Object.freeze({
  format: 'fixe',
  dureeJours: 7,
  achatImmediat: '',
  prixReserve: '',
  offres: false,
  quantite: 1,
  delaiEnvoi: 3,
  lieu: '',
  codePostal: '',
  retours: Object.freeze({ acceptes: true, jours: 14, payePar: 'Buyer' }),
  politiques: Object.freeze({ paiement: '', retour: '', expedition: '' }),
  sponsorisee: false,
  tauxSponsor: 5,
  tva: '',
  sousTitre: '',
  categorie2: '',
  privee: false,
});

// LE CATALOGUE : chaque paramètre qu'eBay propose à la publication, son groupe
// et ce qu'il coûte. `cle` = la clé de traduction `ebay.param.<cle>` (libellé)
// et `ebay.param.<cle>.aide` (la phrase sous « Pourquoi ? »). `payant` : eBay
// le facture (le montant exact est LU à la vérification à blanc, jamais promis).
// `pro` : seulement pour un compte eBay professionnel CONSTATÉ.
export const GROUPES = Object.freeze(['vente', 'article', 'envoi', 'retours', 'compte', 'visibilite']);
export const CATALOGUE = Object.freeze([
  { cle: 'format', groupe: 'vente' },
  { cle: 'dureeJours', groupe: 'vente', si: (r) => r.format === 'enchere' },
  { cle: 'achatImmediat', groupe: 'vente', si: (r) => r.format === 'enchere' },
  { cle: 'prixReserve', groupe: 'vente', si: (r) => r.format === 'enchere', payant: true },
  { cle: 'offres', groupe: 'vente', si: (r) => r.format !== 'enchere' },
  { cle: 'quantite', groupe: 'vente', si: (r) => r.format !== 'enchere' },
  { cle: 'categorie', groupe: 'article' },
  { cle: 'caracteristiques', groupe: 'article' },
  { cle: 'etat', groupe: 'article' },
  { cle: 'photos', groupe: 'article' },
  { cle: 'description', groupe: 'article' },
  { cle: 'livraison', groupe: 'envoi' },
  { cle: 'delaiEnvoi', groupe: 'envoi' },
  { cle: 'lieu', groupe: 'envoi' },
  { cle: 'retours', groupe: 'retours' },
  { cle: 'politiques', groupe: 'compte' },
  { cle: 'tva', groupe: 'compte', pro: true },
  { cle: 'programmation', groupe: 'visibilite' },
  { cle: 'sponsorisee', groupe: 'visibilite', payant: true },
  { cle: 'sousTitre', groupe: 'visibilite', payant: true },
  { cle: 'categorie2', groupe: 'visibilite', payant: true },
  { cle: 'privee', groupe: 'visibilite' },
]);

const montant = (v) => {
  const s = String(v == null ? '' : v).trim();
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(s)) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const ID_PROFIL = /^\d{6,19}$/;

// Des défauts relus (Paramètres → eBay, synchronisés) : toute valeur hors liste
// retombe sur le réglage d'usine (un réglage illisible ne publie jamais une
// valeur inventée).
export function defautsDepuis(stocke) {
  const s = stocke && typeof stocke === 'object' && !Array.isArray(stocke) ? stocke : {};
  const u = DEFAUTS_USINE;
  const r = {
    format: s.format === 'enchere' ? 'enchere' : 'fixe',
    dureeJours: DUREES_ENCHERE.includes(Number(s.dureeJours)) ? Number(s.dureeJours) : u.dureeJours,
    achatImmediat: '', prixReserve: '',   // un montant est celui d'UNE annonce : jamais un défaut
    offres: s.offres === true,
    quantite: Number.isInteger(Number(s.quantite)) && Number(s.quantite) >= 1 && Number(s.quantite) <= 999 ? Number(s.quantite) : u.quantite,
    delaiEnvoi: DELAIS_ENVOI.includes(Number(s.delaiEnvoi)) && s.delaiEnvoi !== '' && s.delaiEnvoi != null ? Number(s.delaiEnvoi) : u.delaiEnvoi,
    lieu: typeof s.lieu === 'string' ? s.lieu.trim().slice(0, 45) : '',
    codePostal: typeof s.codePostal === 'string' && /^[A-Za-z0-9 -]{0,12}$/.test(s.codePostal.trim()) ? s.codePostal.trim() : '',
    retours: (() => {
      const x = s.retours && typeof s.retours === 'object' ? s.retours : {};
      if (x.acceptes === false) return { acceptes: false, jours: u.retours.jours, payePar: u.retours.payePar };
      return { acceptes: true, jours: JOURS_RETOUR.includes(Number(x.jours)) ? Number(x.jours) : u.retours.jours, payePar: PAYEURS_RETOUR.includes(x.payePar) ? x.payePar : u.retours.payePar };
    })(),
    politiques: (() => {
      const x = s.politiques && typeof s.politiques === 'object' ? s.politiques : {};
      const v = (k) => (ID_PROFIL.test(String(x[k] || '')) ? String(x[k]) : '');
      return { paiement: v('paiement'), retour: v('retour'), expedition: v('expedition') };
    })(),
    sponsorisee: s.sponsorisee === true,
    tauxSponsor: tauxSponsorLu(s.tauxSponsor) || u.tauxSponsor,
    tva: s.tva == null ? '' : String(s.tva).trim(),
    sousTitre: '', categorie2: '',        // propres à une annonce
    privee: s.privee === true,
  };
  return r;
}
export function tauxSponsorLu(v) {
  const s = String(v == null ? '' : v).trim().replace(',', '.');
  if (!/^\d{1,3}(?:\.\d)?$/.test(s)) return null;
  const n = Number(s);
  return n >= TAUX_SPONSOR_MIN && n <= TAUX_SPONSOR_MAX ? n : null;
}
// Les réglages d'UNE annonce : ses choix par-dessus les défauts.
export function fusionner(defauts, annonce) {
  const d = defautsDepuis(defauts);
  const a = annonce && typeof annonce === 'object' ? annonce : {};
  return {
    ...d, ...a,
    retours: { ...d.retours, ...(a.retours || {}) },
    politiques: { ...d.politiques, ...(a.politiques || {}) },
  };
}

// Ce que la ROUTE relit (`item.parametres`). Seul ce qui DIFFÈRE d'avant part ;
// rien de différent ⇒ `null` (l'annonce part comme avant, au caractère près).
// `compte.type` : 'pro' | 'particulier' | '' — la TVA ne part que pour un pro
// constaté, et la feuille ne la montre qu'à lui.
export function parametresServeur(r0, compte = {}) {
  const r = fusionner(r0, {});
  const p = {};
  if (r.format === 'enchere') {
    p.format = 'enchere'; p.dureeJours = r.dureeJours;
    if (montant(r0 && r0.achatImmediat) != null) p.achatImmediat = String(r0.achatImmediat).trim();
    if (montant(r0 && r0.prixReserve) != null) p.prixReserve = String(r0.prixReserve).trim();
  } else if (r.offres) p.offres = true;
  if (r.delaiEnvoi !== DEFAUTS_USINE.delaiEnvoi) p.delaiEnvoi = r.delaiEnvoi;
  const lieu = String((r0 && r0.lieu) || r.lieu || '').trim();
  const cp = String((r0 && r0.codePostal) || r.codePostal || '').trim();
  if (lieu) p.lieu = lieu;
  if (cp) p.codePostal = cp;
  const pol = {};
  for (const k of ['paiement', 'retour', 'expedition']) if (ID_PROFIL.test(String((r.politiques || {})[k] || ''))) pol[k] = String(r.politiques[k]);
  // §2.8 : la politique d'EXPÉDITION ne part jamais (livraison gérée par eBay).
  delete pol.expedition;
  if (Object.keys(pol).length) p.politiques = pol;
  if (!pol.retour) {
    const ret = r.retours || DEFAUTS_USINE.retours;
    const u = DEFAUTS_USINE.retours;
    if (ret.acceptes === false) p.retours = { acceptes: false };
    else if (ret.jours !== u.jours || ret.payePar !== u.payePar) p.retours = { acceptes: true, jours: ret.jours, payePar: ret.payePar };
  }
  if (compte && compte.type === 'pro' && String(r.tva || '').trim() !== '') p.tva = String(r.tva).trim();
  const st = String((r0 && r0.sousTitre) || '').trim();
  if (st) p.sousTitre = st.slice(0, SOUS_TITRE_MAX);
  const c2 = String((r0 && r0.categorie2) || '').trim();
  if (/^\d{1,9}$/.test(c2)) p.categorie2 = c2;
  if (r.privee === true) p.privee = true;
  if (Array.isArray(r0 && r0.descripteurs) && r0.descripteurs.length) p.descripteurs = r0.descripteurs.map((d) => ({ nom: String(d.nom), valeur: String(d.valeur) }));
  return Object.keys(p).length ? p : null;
}

// Ce qui se fait APRÈS la publication, sur le même clic confirmé : l'annonce
// sponsorisée (Marketing API, action `promouvoir`, taux en % du prix de vente,
// prélevé SEULEMENT si la paire se vend par la promotion). Éteint par défaut.
export function apresPublication(r) {
  if (!r || r.sponsorisee !== true || r.format === 'enchere') return null;
  const t = tauxSponsorLu(r.tauxSponsor);
  return t ? { promouvoir: { taux: t.toFixed(1) } } : null;
}

// Ce que coûtent les options choisies — en CLÉS (le montant exact d'eBay est lu
// à la vérification à blanc, `fraisParNom` ; la sponsorisée se dit en %).
export function coutsOptions(r0) {
  const r = fusionner(r0, {});
  const out = [];
  if (r.format === 'enchere' && montant(r0 && r0.prixReserve) != null) out.push({ cle: 'prixReserve' });
  if (String((r0 && r0.sousTitre) || '').trim()) out.push({ cle: 'sousTitre' });
  if (/^\d{1,9}$/.test(String((r0 && r0.categorie2) || ''))) out.push({ cle: 'categorie2' });
  if (apresPublication(r)) out.push({ cle: 'sponsorisee', taux: tauxSponsorLu(r.tauxSponsor) });
  return out;
}

// Les choix qui diffèrent d'avant, en court (« Enchères 7 j · Offres · Retours 30 j »).
export function resume(r0, compte = {}) {
  const p = parametresServeur(r0, compte) || {};
  const r = fusionner(r0, {});
  const out = [];
  if (p.format === 'enchere') out.push({ cle: 'ebay.resume.enchere', vars: { n: p.dureeJours } });
  if (p.offres) out.push({ cle: 'ebay.resume.offres' });
  if (p.delaiEnvoi != null) out.push({ cle: 'ebay.resume.delai', vars: { n: p.delaiEnvoi } });
  if (p.retours && p.retours.acceptes === false) out.push({ cle: 'ebay.resume.sansRetour' });
  else if (p.retours) out.push({ cle: 'ebay.resume.retours', vars: { n: p.retours.jours } });
  if (p.politiques) out.push({ cle: 'ebay.resume.politiques' });
  if (p.lieu) out.push({ cle: 'ebay.resume.lieu', vars: { lieu: p.lieu } });
  if (apresPublication(r)) out.push({ cle: 'ebay.resume.sponsor', vars: { n: tauxSponsorLu(r.tauxSponsor) } });
  if (p.privee) out.push({ cle: 'ebay.resume.privee' });
  return out;
}

// ── LES CARACTÉRISTIQUES, PRÉ-REMPLIES PAR LES FAITS DE L'ANNONCE ──────────────
// `aspects` : la forme `lireAspects` du serveur ({nom, requis, recommande,
// multi, mode, valeurs}). `faits` : ce que VINTED a enregistré pour la paire
// (marque, taille, couleur, genre, type, matière, modèle) — jamais une
// déduction du titre. Une liste fermée n'accepte qu'une valeur EXACTE (sans
// casse ni accent) ; sinon la caractéristique devient une QUESTION, avec ce que
// Vinted disait (« Vinted dit : Bleu ciel »), jamais une valeur proche.
const sansAccent = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const ROLES = [
  ['marque', /^(marque|brand|marke|marca)$/i],
  ['taille', /(pointure|taille|size|gr(o|ö)(ss|ß)e|talla|taglia)/i],
  ['couleur', /^(couleur|colou?r|farbe|color|colore)(\s|$)/i],
  ['genre', /^(d[ée]partement|department|genre|abteilung|reparto)$/i],
  ['type', /^(type|typ|tipo)$/i],
  ['matiere', /(mati[eè]re|material|materiale)/i],
  ['modele', /^(mod[eè]le|model|modell|modelo|modello)$/i],
];
export function roleAspect(nom) { const r = ROLES.find(([, re]) => re.test(String(nom || ''))); return r ? r[0] : null; }
function valeursDuFait(fait, a) {
  if (fait == null) return [];
  const brut = Array.isArray(fait) ? fait : String(fait).split(a.multi ? /\s*[,/&]\s*|\s+et\s+/i : /\n/);
  return brut.map((x) => String(x == null ? '' : x).trim()).filter(Boolean);
}
export function preRemplir(aspects, faits = {}, deja = {}) {
  const valeurs = {}, origine = {}, questions = [], indices = {};
  for (const a of Array.isArray(aspects) ? aspects : []) {
    if (!a || !a.nom) continue;
    const dejaV = deja && deja[a.nom];
    if (dejaV != null && (Array.isArray(dejaV) ? dejaV.length : String(dejaV).trim())) { valeurs[a.nom] = dejaV; origine[a.nom] = 'toi'; continue; }
    const role = roleAspect(a.nom);
    const vus = role ? valeursDuFait(faits[role], a) : [];
    if (!vus.length) {
      if (a.requis) questions.push({ type: 'caracteristique', nom: a.nom, requis: true, multi: !!a.multi, mode: a.mode, choix: a.valeurs || [], raison: 'inconnue' });
      continue;
    }
    let pris = vus;
    if (a.mode === 'SELECTION_ONLY' && Array.isArray(a.valeurs) && a.valeurs.length) {
      const ix = new Map(a.valeurs.map((v) => [sansAccent(v), v]));
      const ok = vus.map((v) => ix.get(sansAccent(v))).filter(Boolean);
      // Une seule valeur hors liste ⇒ rien n'est rempli (« Noir, Bleu ciel » ne
      // devient pas « Noir » en silence) : il choisit, avec ce que Vinted disait.
      if (ok.length !== vus.length) {
        indices[a.nom] = vus.join(', ');
        if (a.requis) questions.push({ type: 'caracteristique', nom: a.nom, requis: true, multi: !!a.multi, mode: a.mode, choix: a.valeurs, raison: 'hors-liste', vinted: vus.join(', ') });
        continue;
      }
      pris = ok;
    } else if (a.longueurMax) pris = vus.map((v) => v.slice(0, a.longueurMax));
    if (!pris.length) continue;
    valeurs[a.nom] = a.multi ? [...new Set(pris)] : pris[0];
    origine[a.nom] = 'vinted';
  }
  return { valeurs, origine, questions, indices };
}

// ── LES QUESTIONS À POSER AVANT DE PUBLIER, dans l'ordre ──────────────────────
// `p.categories` : les suggestions d'eBay (`null` pas su, `[]` aucune) ;
// `p.categoryId` : celle qu'IL a choisie ; `p.aspects` / `p.valeurs` ;
// `p.conditions` : forme `lireConditions` (`null` pas su) ; `p.etat`, `p.descripteurs` ;
// `p.compte` : forme `compte` de l'action `parametres` (`null` pas lu).
export function questions(p = {}) {
  const out = [];
  if (!p.categoryId) out.push({ type: 'categorie', choix: Array.isArray(p.categories) ? p.categories : [], pasSu: p.categories == null });
  const val = p.valeurs || {};
  const vide = (v) => v == null || (Array.isArray(v) ? !v.filter((x) => String(x).trim()).length : !String(v).trim());
  for (const a of Array.isArray(p.aspects) ? p.aspects : []) {
    if (a && a.requis && vide(val[a.nom])) out.push({ type: 'caracteristique', nom: a.nom, requis: true, multi: !!a.multi, mode: a.mode, choix: a.valeurs || [], ...(p.indices && p.indices[a.nom] ? { vinted: p.indices[a.nom] } : {}) });
  }
  const c = p.conditions;
  if (c && Array.isArray(c.etats) && c.etats.length) {
    const e = c.etats.find((x) => x.id === String(p.etat || ''));
    if (!e) out.push({ type: 'etat', choix: c.etats.map((x) => ({ id: x.id, label: x.label })) });
    else for (const d of e.descripteurs || []) {
      if (d.requis && !(p.descripteurs || []).some((x) => x.nom === d.id)) out.push({ type: 'descripteur', id: d.id, nom: d.nom, choix: d.valeurs });
    }
  }
  const cp = p.compte;
  if (cp && cp.politiquesActivees === true) {
    for (const k of ['paiement', 'retour']) if (Array.isArray(cp[k]) && cp[k].length === 0) out.push({ type: 'politique', quoi: k });
  }
  return out;
}

// ── LES ERREURS D'eBAY, TRADUITES, AVEC LE GESTE ──────────────────────────────
// `j` : la réponse de la route ({ error, reason, erreurs: [{code, message, params}] }).
// Rend { cle, geste, nom? } : `ebay.err.<cle>` (ce qui ne va pas) et
// `ebay.err.<cle>.geste` (quoi faire). Le message d'eBay reste montré tel quel
// sous « Pourquoi ? ». Les codes viennent de la documentation Trading (non
// mesurés sur son compte) ; à défaut, le sens se lit sur le message.
const CODES = new Map([
  [931, 'jeton'], [932, 'jeton'], [17470, 'jeton'], [16110, 'jeton'], [21916984, 'jeton'],
  [87, 'categorie'], [107, 'categorie'], [21919136, 'categorie'],
  [21919303, 'caracteristique'], [21919301, 'caracteristique'], [21919308, 'caracteristique'],
  [21916884, 'etat'], [21917091, 'etat'], [21919189, 'etat'],
  [21919144, 'photo'], [21916589, 'photo'], [10007, 'injoignable'],
  [21919188, 'limite'], [21919165, 'limite'], [21916829, 'limite'],
  [21920214, 'politique'], [21919151, 'politique'],
]);
const SENS = [
  ['jeton', /(auth(entication)? token|IAF|hard expired|token is invalid|jeton|reconnect)/i],
  ['caracteristique', /(item specific|ItemSpecifics|caract[ée]ristique|aspect)/i],
  ['categorie', /(categor|cat[ée]gorie)/i],
  ['etat', /(condition|[ée]tat de l)/i],
  ['politique', /(polic|politique|profile|profil)/i],
  ['photo', /(picture|photo|image)/i],
  ['limite', /(selling limit|limit|limite)/i],
  ['retours', /(return|retour)/i],
  ['prix', /(price|prix)/i],
];
const RAISONS = { confirmation: 'confirmation', prix: 'prix', port: 'livraison', numero: 'numero', offre: 'offre', parametres: 'reglage', 'marche-non-gere': 'site', 'marche-pas-su': 'injoignable', incertain: 'incertain', 'pas-su': 'injoignable', 'compte-deconnecte': 'jeton', 'no-refresh': 'jeton', scope: 'droit' };
export function traduireErreur(j) {
  const r = j && typeof j === 'object' ? j : {};
  if (r.reason && RAISONS[r.reason]) return { cle: RAISONS[r.reason] };
  if (/^deja-/.test(String(r.reason || ''))) return { cle: 'deja' };
  const es = Array.isArray(r.erreurs) ? r.erreurs.filter((e) => e && String(e.severite || 'Error') !== 'Warning') : [];
  for (const e of es) {
    const k = CODES.get(Number(e.code));
    if (k) return { cle: k, ...(k === 'caracteristique' && Array.isArray(e.params) && e.params[0] ? { nom: String(e.params[0]) } : {}) };
  }
  const texte = [r.error, ...es.map((e) => e.message)].filter(Boolean).join(' · ');
  const s = SENS.find(([, re]) => re.test(texte));
  if (s) {
    if (s[0] === 'caracteristique') { const m = /(?:item specific|caract[ée]ristique)\s+[«"']?\s*([^»"'.]+?)\s*[»"']?\s+(?:is missing|est manquante|manque)/i.exec(texte); return { cle: s[0], ...(m ? { nom: m[1] } : {}) }; }
    return { cle: s[0] };
  }
  return { cle: 'autre' };
}

// ── LES RETOURS DE CONNEXION (adresse `?ebay=…&raison=…`), TRADUITS ───────────
export function raisonConnexion(statut, raison) {
  if (statut === 'connecte') return 'connecte';
  if (statut === 'refus') return 'refus';
  const r = String(raison || '');
  if (/expir|autre navigateur/i.test(r)) return 'navigateur';
  if (/^aucun code/i.test(r)) return 'code';
  if (/cl[ée]s absentes/i.test(r)) return 'cles';
  if (['identite-illisible', 'principal-inconnu', 'comptes-pas-su', 'registre-ko', 'store-failed'].includes(r)) return r;
  if (/echange|exchange/i.test(r)) return 'echange';
  return 'autre';
}

// ── L'ÉTAT DE CHAQUE COMPTE, DIT AVANT QU'IL CASSE ────────────────────────────
// `c` : un compte de l'action `status` ({ relie, jeton: {etat, joursRestants} | null }).
export function etatCompte(c) {
  if (!c) return 'pas-su';
  if (c.relie === false) return 'plus-relie';
  if (c.relie !== true) return 'pas-su';
  const j = c.jeton;
  if (j && j.etat === 'expire') return 'expire';
  if (j && j.etat === 'bientot') return 'bientot';
  return j && j.etat === 'ok' ? 'relie' : 'relie-sans-date';
}

// ── LES FENÊTRES GUIDÉES : des étapes en clés (`ebay.guide.<id>.<n>`) ────────
// `lien` : la page eBay du geste (adresses du Seller Hub NON mesurées ici : un
// repli, jamais une promesse).
export const GUIDES = Object.freeze({
  premiere: { etapes: 3 },
  politique: { etapes: 2, lien: 'https://www.ebay.fr/bp/manage' },
  offre: { etapes: 3 },
  vente: { etapes: 3, lien: 'https://www.ebay.fr/sh/ord' },
  retour: { etapes: 3, lien: 'https://www.ebay.fr/sh/ord/?filter=status:RETURNS' },
});
export const etapesGuide = (id) => { const g = GUIDES[id]; return g ? Array.from({ length: g.etapes }, (_, i) => `ebay.guide.${id}.${i + 1}`) : []; };
