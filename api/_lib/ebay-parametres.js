// ════════════════════════════════════════════════════════════════════════════
// TOUS LES PARAMÈTRES DE PUBLICATION eBAY, CÔTÉ SERVEUR (11 nov., lot
// `ebay-complet` — Julien : « propose TOUS les paramètres qu'eBay propose pour
// la publication »). Règles PURES : aucune lecture, aucun appel.
//
// • `optionsPublication(item, compte)` : ce que le navigateur demande est relu
//   champ par champ, contre une liste FERMÉE de valeurs. Une valeur illisible
//   n'est jamais « corrigée » : rien ne part, et la phrase dit laquelle.
//   ⚠️ Les champs bruts du navigateur ne sont JAMAIS lus par `itemXml` : il ne
//   lit que `item.options`, posé ici.
// • `xmlOptions(options, devise)` : les morceaux de XML Trading — vides quand
//   l'option n'est pas posée, pour qu'une annonce sans option parte au
//   caractère près comme avant (banc `ebay-complet`, contrôle X0).
// • §2.8 : l'ACHETEUR paie le bordereau (livraison gérée par eBay). Aucune
//   option ici ne pose de port, de transporteur, ni « livraison gratuite » ; la
//   politique d'expédition n'est envoyée que pour un compte NON géré par eBay.
// • §3 : l'offre se règle par le seuil NATIF d'eBay (`regleDeItem`, déjà
//   existant) ; ici seulement « accepter les offres » sans seuil (eBay demande
//   alors au vendeur, rien n'est accepté tout seul).
// • Lecture des réponses taxonomie / métadonnées / compte d'eBay : `lire*`.
// ════════════════════════════════════════════════════════════════════════════

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Les valeurs qu'eBay accepte (Trading API). Toute autre valeur est refusée.
export const DUREES_ENCHERE = Object.freeze([1, 3, 5, 7, 10]);
export const DELAIS_ENVOI = Object.freeze([0, 1, 2, 3, 4, 5, 10, 15, 20, 30]);
export const JOURS_RETOUR = Object.freeze([14, 30, 60]);
export const PAYEURS_RETOUR = Object.freeze(['Buyer', 'Seller']);
export const TAUX_TVA_MAX = 30;
export const SOUS_TITRE_MAX = 55;
const ID_PROFIL = /^\d{6,19}$/;
const ID_DESCRIPTEUR = /^\d{1,9}$/;
const CP = /^[A-Za-z0-9 -]{2,12}$/;
const montant = (v) => {
  const s = String(v == null ? '' : v).trim();
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(s)) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const RIEN = ' Rien n\'a été envoyé à eBay.';

// Les caractéristiques : texte ou LISTE de valeurs (une caractéristique à
// plusieurs valeurs, `itemToAspectCardinality: MULTI`). 65 caractères au plus
// par valeur, 30 valeurs au plus, 45 caractéristiques au plus (limites eBay).
export function aspectsPropres(aspects) {
  if (aspects == null) return { aspects: {} };
  if (typeof aspects !== 'object' || Array.isArray(aspects)) return { err: 'Caractéristiques mal formées.' + RIEN };
  const out = {};
  for (const [nom0, v] of Object.entries(aspects)) {
    const nom = String(nom0 || '').trim();
    if (!nom) continue;
    if (nom.length > 65) return { err: `Caractéristique « ${nom.slice(0, 30)}… » : nom trop long.` + RIEN };
    const liste = (Array.isArray(v) ? v : [v]).map((x) => (x == null ? '' : String(x).trim())).filter(Boolean);
    if (!liste.length) continue;
    if (liste.length > 30) return { err: `Caractéristique « ${nom} » : 30 valeurs au plus.` + RIEN };
    if (liste.some((x) => x.length > 65)) return { err: `Caractéristique « ${nom} » : une valeur dépasse 65 caractères.` + RIEN };
    out[nom] = [...new Set(liste)];
  }
  if (Object.keys(out).length > 45) return { err: '45 caractéristiques au plus.' + RIEN };
  return { aspects: out };
}
export function xmlAspects(aspects) {
  return Object.entries(aspects || {})
    .map(([n, vs]) => `<NameValueList><Name>${esc(n)}</Name>${(Array.isArray(vs) ? vs : [vs]).map((v) => `<Value>${esc(v)}</Value>`).join('')}</NameValueList>`).join('');
}

// ── LES OPTIONS D'UNE ANNONCE, RELUES PAR LE SERVEUR ─────────────────────────
// `it.parametres` (objet) : ce que la feuille « Tous les réglages eBay » envoie.
// Absent ⇒ `{options:null}` : l'annonce part exactement comme avant.
// `compte.type` : 'pro' | 'particulier' | '' (pas su) — la TVA n'est permise
// qu'à un compte pro CONSTATÉ (jamais deviné).
export function optionsPublication(it, compte = {}) {
  const p = it ? it.parametres : undefined;
  if (p === undefined || p === null) return { options: null };
  if (typeof p !== 'object' || Array.isArray(p)) return { err: 'Réglages eBay mal formés.' + RIEN };
  const o = {};
  // Format : prix fixe (« Achat immédiat », toujours « jusqu'à annulation » sur
  // eBay) ou enchères (1, 3, 5, 7 ou 10 jours, prix de départ = le prix ; prix
  // « Achat immédiat » facultatif, au moins 30 % au-dessus — règle d'eBay).
  const format = p.format == null || p.format === '' ? 'fixe' : String(p.format);
  if (format !== 'fixe' && format !== 'enchere') return { err: 'Format inconnu (prix fixe ou enchères).' + RIEN };
  if (format === 'enchere') {
    const d = Number(p.dureeJours);
    if (!DUREES_ENCHERE.includes(d)) return { err: 'Durée des enchères : 1, 3, 5, 7 ou 10 jours.' + RIEN };
    o.format = 'enchere'; o.dureeJours = d;
    if (p.achatImmediat != null && p.achatImmediat !== '') {
      const ai = montant(p.achatImmediat), depart = montant(it.price);
      if (ai == null) return { err: 'Prix « Achat immédiat » illisible.' + RIEN };
      if (depart != null && ai < Math.round(depart * 130) / 100) return { err: 'Le prix « Achat immédiat » doit dépasser le prix de départ d\'au moins 30 % (règle d\'eBay).' + RIEN };
      o.achatImmediat = ai;
    }
    if (p.prixReserve != null && p.prixReserve !== '') {
      const r = montant(p.prixReserve);
      if (r == null) return { err: 'Prix de réserve illisible.' + RIEN };
      o.prixReserve = r;   // eBay le facture : la feuille le dit
    }
  }
  // Offres sans seuil : eBay les transmet, le vendeur répond (rien d'automatique).
  if (p.offres === true) {
    if (format === 'enchere') return { err: 'Les offres ne se posent que sur un prix fixe.' + RIEN };
    o.offres = true;
  }
  // Descripteurs d'état (cartes, objets de collection…) : des identifiants
  // numériques lus chez eBay, jamais du texte.
  if (p.descripteurs != null) {
    if (!Array.isArray(p.descripteurs) || p.descripteurs.length > 10) return { err: 'Descripteurs d\'état mal formés.' + RIEN };
    const ds = [];
    for (const d of p.descripteurs) {
      const nom = String((d && d.nom) || ''), val = String((d && d.valeur) || '');
      if (!ID_DESCRIPTEUR.test(nom) || !ID_DESCRIPTEUR.test(val)) return { err: 'Descripteur d\'état illisible.' + RIEN };
      ds.push({ nom, valeur: val });
    }
    if (ds.length) o.descripteurs = ds;
  }
  // Délai d'envoi (jours ouvrés après le paiement).
  if (p.delaiEnvoi != null && p.delaiEnvoi !== '') {
    const d = Number(p.delaiEnvoi);
    if (!DELAIS_ENVOI.includes(d)) return { err: 'Délai d\'envoi : 0, 1, 2, 3, 4, 5, 10, 15, 20 ou 30 jours.' + RIEN };
    o.delaiEnvoi = d;
  }
  // Lieu de l'objet : ville et code postal (le pays est celui du site du compte).
  if (p.lieu != null && p.lieu !== '') {
    const l = String(p.lieu).trim();
    if (l.length < 2 || l.length > 45) return { err: 'Lieu de l\'objet : une ville (2 à 45 caractères).' + RIEN };
    o.lieu = l;
  }
  if (p.codePostal != null && p.codePostal !== '') {
    const c = String(p.codePostal).trim();
    if (!CP.test(c)) return { err: 'Code postal illisible.' + RIEN };
    o.codePostal = c;
  }
  // Retours : acceptés ou non, sous combien de jours, qui paie le retour.
  if (p.retours != null) {
    const r = p.retours;
    if (typeof r !== 'object' || Array.isArray(r)) return { err: 'Réglage des retours mal formé.' + RIEN };
    if (r.acceptes === false) {
      // Un PRO dans l'Union européenne doit accepter 14 jours (droit de rétractation).
      if (compte.type === 'pro') return { err: 'Un vendeur professionnel doit accepter les retours (14 jours au moins, droit de rétractation).' + RIEN };
      o.retours = { acceptes: false };
    } else {
      const j = Number(r.jours), qui = String(r.payePar || '');
      if (!JOURS_RETOUR.includes(j)) return { err: 'Retours : 14, 30 ou 60 jours.' + RIEN };
      if (!PAYEURS_RETOUR.includes(qui)) return { err: 'Retours : dis qui paie le renvoi (l\'acheteur ou toi).' + RIEN };
      o.retours = { acceptes: true, jours: j, payePar: qui };
    }
  }
  // Politiques du compte (Seller Hub → Politiques) : des identifiants lus chez
  // eBay. L'expédition n'est PAS envoyée pour un compte en livraison gérée.
  if (p.politiques != null) {
    const pol = p.politiques;
    if (typeof pol !== 'object' || Array.isArray(pol)) return { err: 'Politiques mal formées.' + RIEN };
    const out = {};
    for (const k of ['paiement', 'retour', 'expedition']) {
      if (pol[k] == null || pol[k] === '') continue;
      const v = String(pol[k]);
      if (!ID_PROFIL.test(v)) return { err: `Politique de ${k} illisible.` + RIEN };
      out[k] = v;
    }
    if (out.expedition && it.ebayGere !== false) delete out.expedition;   // §2.8 : eBay gère la livraison
    if (out.retour && o.retours) return { err: 'Choisis SOIT une politique de retour du compte, SOIT un réglage de retour pour cette annonce.' + RIEN };
    if (Object.keys(out).length) o.politiques = out;
  }
  // TVA (vendeur pro constaté seulement).
  if (p.tva != null && p.tva !== '') {
    if (compte.type !== 'pro') return { err: 'La TVA ne se pose que sur un compte eBay professionnel.' + RIEN };
    const t = Number(String(p.tva).replace(',', '.'));
    if (!Number.isFinite(t) || t < 0 || t > TAUX_TVA_MAX) return { err: `Taux de TVA : entre 0 et ${TAUX_TVA_MAX} %.` + RIEN };
    o.tva = Math.round(t * 100) / 100;
  }
  // Sous-titre (option payante chez eBay — la feuille le dit).
  if (p.sousTitre != null && String(p.sousTitre).trim()) {
    const s = String(p.sousTitre).trim();
    if (s.length > SOUS_TITRE_MAX) return { err: `Sous-titre : ${SOUS_TITRE_MAX} caractères au plus.` + RIEN };
    o.sousTitre = s;
  }
  // Seconde catégorie (option payante chez eBay).
  if (p.categorie2 != null && p.categorie2 !== '') {
    const c = String(p.categorie2);
    if (!/^\d{1,9}$/.test(c) || c === String(it.categoryId || '')) return { err: 'Seconde catégorie illisible (ou la même que la première).' + RIEN };
    o.categorie2 = c;
  }
  // Annonce privée (les pseudos des acheteurs ne sont pas montrés).
  if (p.privee === true) o.privee = true;
  return { options: Object.keys(o).length ? o : null };
}

// Le nom de l'appel Trading : une enchère passe par AddItem (AddFixedPriceItem
// ne sait faire que le prix fixe).
export function appelTrading(options, verif) {
  const enchere = !!(options && options.format === 'enchere');
  return (verif ? 'Verify' : '') + (enchere ? 'AddItem' : 'AddFixedPriceItem');
}

// Les morceaux de XML, chacun VIDE quand l'option n'est pas posée.
export function xmlOptions(o, devise) {
  const vide = { type: null, retour: null, apresEtat: '', apresDelai: '', fin: '', lieu: null, codePostal: '', sousTitre: '', categorie2: '' };
  if (!o) return vide;
  const m = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const x = { ...vide };
  if (o.format === 'enchere') {
    x.type = `<ListingType>Chinese</ListingType><ListingDuration>Days_${o.dureeJours}</ListingDuration>`;
    if (o.achatImmediat != null) x.fin += `<BuyItNowPrice currencyID="${devise}">${m(o.achatImmediat)}</BuyItNowPrice>`;
    if (o.prixReserve != null) x.fin += `<ReservePrice currencyID="${devise}">${m(o.prixReserve)}</ReservePrice>`;
  }
  if (o.descripteurs) x.apresEtat = '<ConditionDescriptors>' + o.descripteurs.map((d) => `<ConditionDescriptor><Name>${d.nom}</Name><Value>${d.valeur}</Value></ConditionDescriptor>`).join('') + '</ConditionDescriptors>';
  if (o.lieu) x.lieu = o.lieu;
  if (o.codePostal) x.codePostal = `<PostalCode>${esc(o.codePostal)}</PostalCode>`;
  if (o.sousTitre) x.sousTitre = `<SubTitle>${esc(o.sousTitre)}</SubTitle>`;
  if (o.categorie2) x.categorie2 = `<SecondaryCategory><CategoryID>${o.categorie2}</CategoryID></SecondaryCategory>`;
  if (o.politiques && o.politiques.retour) x.retour = '';   // la politique du compte remplace le bloc
  else if (o.retours) {
    x.retour = o.retours.acceptes === false
      ? '<ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy>'
      : `<ReturnPolicy><ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption><ReturnsWithinOption>Days_${o.retours.jours}</ReturnsWithinOption><ShippingCostPaidByOption>${o.retours.payePar}</ShippingCostPaidByOption></ReturnPolicy>`;
  }
  if (o.offres) x.fin += '<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>';
  if (o.politiques) {
    const pol = o.politiques;
    x.fin += '<SellerProfiles>'
      + (pol.paiement ? `<SellerPaymentProfile><PaymentProfileID>${pol.paiement}</PaymentProfileID></SellerPaymentProfile>` : '')
      + (pol.retour ? `<SellerReturnProfile><ReturnProfileID>${pol.retour}</ReturnProfileID></SellerReturnProfile>` : '')
      + (pol.expedition ? `<SellerShippingProfile><ShippingProfileID>${pol.expedition}</ShippingProfileID></SellerShippingProfile>` : '')
      + '</SellerProfiles>';
  }
  if (o.tva != null) x.fin += `<VATDetails><VATPercent>${o.tva}</VATPercent></VATDetails>`;
  if (o.privee) x.fin += '<PrivateListing>true</PrivateListing>';
  if (o.delaiEnvoi != null) x.delai = o.delaiEnvoi;
  return x;
}

// ── LIRE CE QU'eBAY DIT D'UNE CATÉGORIE ──────────────────────────────────────
// `get_item_aspects_for_category` : obligatoire (`aspectRequired`), recommandée
// (`aspectUsage: RECOMMENDED`), une ou plusieurs valeurs (`itemToAspectCardinality`),
// liste fermée (`SELECTION_ONLY`) ou texte libre, et SES valeurs. Rien d'inventé.
export function lireAspects(json) {
  const asp = (json && Array.isArray(json.aspects)) ? json.aspects : [];
  return asp.filter((a) => a && a.localizedAspectName).map((a) => {
    const c = a.aspectConstraint || {};
    return {
      nom: String(a.localizedAspectName),
      requis: c.aspectRequired === true,
      recommande: c.aspectRequired !== true && String(c.aspectUsage || '') === 'RECOMMENDED',
      multi: String(c.itemToAspectCardinality || '') === 'MULTI',
      mode: c.aspectMode === 'SELECTION_ONLY' ? 'SELECTION_ONLY' : 'FREE_TEXT',
      longueurMax: Number(c.aspectMaxLength) > 0 ? Number(c.aspectMaxLength) : null,
      valeurs: (Array.isArray(a.aspectValues) ? a.aspectValues : []).map((v) => v && v.localizedValue).filter(Boolean).slice(0, 200),
    };
  });
}
// `get_item_condition_policies` : les états permis ET, pour certaines
// catégories, leurs descripteurs (nom + valeurs, des identifiants).
export function lireConditions(json) {
  const p0 = json && Array.isArray(json.itemConditionPolicies) ? json.itemConditionPolicies[0] : null;
  const conds = p0 && Array.isArray(p0.itemConditions) ? p0.itemConditions : [];
  return {
    obligatoire: !!(p0 && p0.itemConditionRequired === true),
    etats: conds.map((c) => ({
      id: String(c.conditionId || ''),
      label: String(c.conditionDescription || ''),
      descripteurs: (Array.isArray(c.conditionDescriptors) ? c.conditionDescriptors : []).map((d) => ({
        id: String(d.conditionDescriptorId || ''),
        nom: String(d.conditionDescriptorName || ''),
        requis: !!(d.conditionDescriptorConstraint && d.conditionDescriptorConstraint.usage === 'REQUIRED'),
        valeurs: (Array.isArray(d.conditionDescriptorValues) ? d.conditionDescriptorValues : []).map((v) => ({ id: String(v.conditionDescriptorValueId || ''), nom: String(v.conditionDescriptorValueName || '') })).filter((v) => v.id),
      })).filter((d) => d.id),
    })).filter((c) => c.id && c.label),
  };
}
// Les politiques du compte. `null` = pas lues (eBay muet, droit manquant) —
// jamais une liste vide inventée (§5 « rien lu ne vaut pas rien »).
export function lirePolitiques(r, cle, idCle) {
  if (!r || !r.ok || !r.data || !Array.isArray(r.data[cle])) return null;
  return r.data[cle].map((p) => ({
    id: String(p[idCle] || ''),
    nom: String(p.name || ''),
    ...(cle === 'returnPolicies' ? { acceptes: p.returnsAccepted === true, jours: p.returnPeriod && p.returnPeriod.value != null ? Number(p.returnPeriod.value) : null, payePar: p.returnShippingCostPayer === 'SELLER' ? 'Seller' : p.returnShippingCostPayer === 'BUYER' ? 'Buyer' : null } : {}),
    ...(cle === 'fulfillmentPolicies' ? { delai: p.handlingTime && p.handlingTime.value != null ? Number(p.handlingTime.value) : null } : {}),
  })).filter((p) => p.id);
}
export function lireEmplacements(r) {
  if (!r || !r.ok || !r.data || !Array.isArray(r.data.locations)) return null;
  return r.data.locations.map((l) => {
    const a = (l.location && l.location.address) || {};
    return { cle: String(l.merchantLocationKey || ''), ville: String(a.city || ''), codePostal: String(a.postalCode || ''), pays: String(a.country || '') };
  }).filter((l) => l.cle);
}
// Le compte a-t-il les « politiques de vente » (business policies) ? `null` = pas su.
export function lirePolitiquesActivees(r) {
  if (!r || !r.ok || !r.data) return null;
  const progs = Array.isArray(r.data.programs) ? r.data.programs : [];
  return progs.some((p) => p && p.programType === 'SELLING_POLICY_MANAGEMENT');
}

// ── L'ÉTAT DU JETON D'UN COMPTE ──────────────────────────────────────────────
// eBay donne la durée du jeton de renouvellement (~18 mois) à la connexion ;
// VRM la range (`refresh_expires_days`). L'app prévient AVANT : 30 jours avant
// la fin ⇒ « à reconnecter bientôt ». Pas de date rangée ⇒ `null` (pas su).
export const PREVENIR_JOURS = 30;
export function etatJeton(enregistreLe, jours, maintenant = Date.now()) {
  const t = Number(enregistreLe), j = Number(jours);
  if (!(t > 0) || !(j > 0)) return null;
  const expireLe = t + j * 86400000;
  const reste = Math.floor((expireLe - maintenant) / 86400000);
  return { enregistreLe: t, expireLe, joursRestants: reste, etat: expireLe <= maintenant ? 'expire' : reste <= PREVENIR_JOURS ? 'bientot' : 'ok' };
}
