// ── LE N° ÉCRIT PAR LE VENDEUR DANS SON ANNONCE (7 nov.) ─────────────────────
// Julien, 7 novembre : « pour Vinted par exemple, redéfinir que la personne met
// son numéro d'étiquetage à la fin de sa description. Donc veuillez capter ce
// numéro-là pour l'intégrer dans l'application et n'attribuer donc pas de numéro
// automatiquement ; pareil ça peut être dans le titre également ou dans le
// numéro d'étiquetage pour les comptes professionnels Vinted ; on peut appliquer
// ça à Leboncoin, eBay et Vestiaire Collective. »
//
// UN réglage par vendeur, ÉTEINT par défaut, synchronisé (`vrm_numero_ecrit`,
// jamais un drapeau du navigateur seul) : « Je numérote moi-même dans mes
// annonces ». Allumé : VRM ne DONNE plus aucun numéro tout seul (ni « annonce
// sans numéro en reçoit un », ni « doublon réglé seul », ni le N° réservé à côté
// de « Publier ») ; il LIT celui que le vendeur a écrit.
//
// Ce fichier est LA règle (§11, un propriétaire) des quatre sites. JS pur, sans
// React : `scripts/audit-numero-ecrit.cjs` l'EXÉCUTE.
//
// OÙ LIRE, dans cet ordre :
//   (a) un champ de RÉFÉRENCE natif, seulement s'il existe vraiment dans ce que
//       VRM capte : SKU eBay, `CustomRef` Leboncoin (tableau de bord pro). Le
//       champ entier doit être un numéro (« 123 », « B125 », « VRM-123 »,
//       « N° 123 ») : « 12345-ABC » n'en est pas un.
//       ⚠️ Vinted pro et Vestiaire : AUCUN champ de référence n'a été vu dans les
//       données captées (tous ses comptes Vinted sont particuliers) — rien n'est
//       lu là tant que ce n'est pas mesuré chez lui (passation du 7 nov.) ;
//   (b) la FIN de la description : la dernière ligne non vide (la lettre seule
//       que Republier pose tout en bas est sautée) ;
//   (c) le titre : n'importe où, une seule fois.
//
// FORMES ACCEPTÉES (strictes) : « N° 123 », « N°123 », « Nº 123 », « No 123 »,
// « No. 123 », « Réf 123 », « Ref. 123 », « Réf : 123 », « #123 », et
// « Réf. VRM-123 » (ce que VRM écrit sur Leboncoin). Un numéro à lettres
// (« N° B125 », « #C40 ») passe par `cleNum` : « b125 » = « B125 », « 007 » = « 7 ».
//
// CE QUI N'EST JAMAIS UN NUMÉRO :
//   · un nombre NU (« 42 » est une pointure, « 45 € » un prix, « 2 paires »,
//     « 2024 » une année) : sans marque devant, rien n'est lu ;
//   · un prix ou une mesure même marqué (« #45 € », « N° 3 cm ») ;
//   · une référence de MODÈLE (« Réf. CW2288-111 », « Réf DD1391 »,
//     « Réf B75806 ») : suivie d'un tiret et de chiffres, ou deux lettres et
//     plus après « Réf », ou plus de 4 chiffres après des lettres ⇒ rien lu ;
//   · DEUX numéros différents dans le même texte, ou entre deux sources
//     (titre ≠ description) ⇒ « ambigu », dit, rien lu.
//
// ⚠️ §5 : le N° lu est une IDENTITÉ écrite par le vendeur, pour la MÊME annonce
// (par son identifiant, jamais par son titre). Il ne change JAMAIS un N° que VRM
// connaît déjà : s'il le contredit, la paire va « à vérifier » avec les deux
// numéros, et c'est SON clic qui choisit. Un N° d'archive (« B… » de la remise à
// zéro 013) ne se redonne pas (`reprenable`, la règle `numeroReprenable`).

export const CLE_NUMERO_ECRIT = 'vrm_numero_ecrit';

// La clé d'un numéro : la MÊME que `cleNum` de l'app et de l'extension
// (majuscules, sans espace ni tiret, « 007 » = « 7 »). L'audit vérifie qu'elles
// rendent la même chose.
export const cleNumero = (v) => {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
};
const NUM_OK = /^([A-Z]{1,3})?\d{1,6}$/;

// Le réglage enregistré → un réglage sûr. Une valeur inconnue = éteint : VRM
// numérote comme avant (le défaut ne change rien chez personne).
export function lireReglageNumeroEcrit(brut) {
  const o = brut && typeof brut === 'object' ? brut : {};
  return { actif: o.actif === true, depuis: typeof o.depuis === 'string' ? o.depuis : null };
}

// ── LA LECTURE D'UN TEXTE ─────────────────────────────────────────────────────
// La marque devant le numéro. `ref` : « Réf » (plus strict, voir plus haut).
const MARQUE = /(?:^|[^0-9A-Za-zÀ-ÿ])(N\s?[°º]|No\.?(?=\s?[:#]?\s?(?:VRM[-\s]?)?[A-Za-z]{0,3}\d)|R[ée]f\.?|#)/gi;
// Après la marque : blancs, « : » éventuel, « VRM- » éventuel, puis le numéro.
const CORPS = /^\s{0,2}:?\s{0,2}(VRM[-\s]?)?([A-Za-z]{1,3})?(\d{1,6})(?![0-9A-Za-z])/i;
// Ce qui suit un nombre et en fait autre chose qu'un numéro de rangement.
const SUITE_INTERDITE = /^\s?(?:[-/]\s?\d|[.,]\d|€|eur\b|euros?\b|%|cm\b|mm\b|kg\b|g\b|ans?\b|paires?\b|pi[eè]ces?\b|x\s?\d)/i;

// Toutes les occurrences marquées d'un texte : [{ cle, brut, index }].
// Une occurrence douteuse (référence de modèle, prix…) n'est PAS un numéro : elle
// est simplement ignorée (rien lu vaut mieux qu'un faux, §5).
export function numerosMarques(texte) {
  const t = String(texte == null ? '' : texte);
  const out = [];
  MARQUE.lastIndex = 0;
  let m;
  while ((m = MARQUE.exec(t))) {
    const marque = m[1];
    const debut = m.index + m[0].length;
    const c = CORPS.exec(t.slice(debut));
    if (!c) continue;
    const vrm = !!c[1], lettres = c[2] || '', chiffres = c[3];
    const suite = t.slice(debut + c[0].length);
    if (SUITE_INTERDITE.test(suite)) continue;
    const estRef = /^r/i.test(marque);
    if (lettres) {
      if (chiffres.length > 4) continue;                 // « B75806 » : une référence de modèle
      if (estRef && !vrm && lettres.length > 1) continue; // « Réf DD1391 » : idem
    } else if (chiffres.length > 5) continue;            // « Réf 315122 » : idem
    const cle = cleNumero(lettres + chiffres);
    if (!cle || !NUM_OK.test(cle) || cle === '0') continue;
    out.push({ cle, brut: (marque + t.slice(debut, debut + c[0].length)).trim(), index: m.index });
  }
  return out;
}

const distinctes = (occ) => [...new Set(occ.map((o) => o.cle))];

// La lettre seule que Republier pose tout en bas (« \n\nk ») n'est pas la fin
// de SA description.
const LETTRE_FIN = /\n\s*\n\s*[a-z]\s*$/i;

// Lit UN texte. `zone` : 'description' (la fin seulement) · 'titre' (n'importe
// où) · 'ref' (le champ entier). Rend :
//   { etat: 'lu', cle, brut } · { etat: 'rien', raison } · { etat: 'ambigu', cles, raison }
export function lireNumeroTexte(texte, zone = 'description') {
  const t = String(texte == null ? '' : texte);
  if (!t.trim()) return { etat: 'rien', raison: 'vide' };
  if (zone === 'ref') {
    const v = t.trim();
    // Le champ ENTIER est un numéro : nu, « VRM-… », ou marqué.
    const nu = /^(?:VRM[-\s]?)?([A-Za-z]{1,3})?(\d{1,6})$/i.exec(v);
    if (nu) {
      if (nu[2].length > (nu[1] ? 4 : 5)) return { etat: 'rien', raison: 'pas un numéro de rangement' };
      const cle = cleNumero((nu[1] || '') + nu[2]);
      return cle && cle !== '0' && NUM_OK.test(cle) ? { etat: 'lu', cle, brut: v } : { etat: 'rien', raison: 'pas un numéro de rangement' };
    }
    const occ = numerosMarques(v);
    if (occ.length && occ[0].index === 0 && v.slice(occ[0].brut.length).trim() === '') return { etat: 'lu', cle: occ[0].cle, brut: v };
    return { etat: 'rien', raison: 'pas un numéro de rangement' };
  }
  const occ = numerosMarques(t);
  if (!occ.length) return { etat: 'rien', raison: 'aucun N° écrit' };
  const cles = distinctes(occ);
  if (cles.length > 1) return { etat: 'ambigu', cles, raison: `deux numéros écrits (${cles.join(' et ')})` };
  if (zone === 'titre') return { etat: 'lu', cle: cles[0], brut: occ[0].brut };
  // Description : le N° doit être sur la DERNIÈRE ligne non vide.
  const corps = t.replace(LETTRE_FIN, '').replace(/\s+$/, '');
  const lignes = corps.split('\n');
  let i = lignes.length - 1; while (i >= 0 && !lignes[i].trim()) i--;
  const derniere = i >= 0 ? lignes[i] : '';
  const surFin = numerosMarques(derniere);
  if (!surFin.length) return { etat: 'rien', raison: 'un N° est écrit, mais pas à la fin', ailleurs: cles[0] };
  return { etat: 'lu', cle: surFin[0].cle, brut: surFin[0].brut };
}

// ── LA LECTURE D'UNE ANNONCE ─────────────────────────────────────────────────
// `ref` : le champ de référence natif (s'il existe) ; `description` : le texte,
// ou `undefined` si VRM ne l'a pas (encore) lu ; `descriptionCoupee` : VRM n'en
// a qu'un DÉBUT (Leboncoin range 400 caractères) — sa fin n'est pas sue ;
// `descriptionLue` : une lecture déjà faite (`lireNumeroTexte(desc)`), pour ne
// pas garder le texte en mémoire. Rend :
//   { etat: 'lu', cle, source: 'ref'|'description'|'titre', brut, descriptionSue }
//   { etat: 'rien', raison, descriptionSue }
//   { etat: 'ambigu', cles, raison, descriptionSue }
export function lireNumeroEcrit({ ref, description, descriptionLue, descriptionCoupee = false, titre } = {}) {
  const sources = [];
  if (ref != null && String(ref).trim()) sources.push(['ref', lireNumeroTexte(ref, 'ref')]);
  let descriptionSue = false;
  if (descriptionLue && typeof descriptionLue === 'object' && descriptionLue.etat) { sources.push(['description', descriptionLue]); descriptionSue = true; }
  else if (typeof description === 'string' && !descriptionCoupee) { sources.push(['description', lireNumeroTexte(description, 'description')]); descriptionSue = true; }
  if (titre != null) sources.push(['titre', lireNumeroTexte(titre, 'titre')]);
  const amb = sources.find(([, r]) => r.etat === 'ambigu');
  if (amb) return { etat: 'ambigu', cles: amb[1].cles, raison: `${NOM_SOURCE[amb[0]]} : ${amb[1].raison}`, descriptionSue };
  const lus = sources.filter(([, r]) => r.etat === 'lu');
  const cles = [...new Set(lus.map(([, r]) => r.cle))];
  if (cles.length > 1) return { etat: 'ambigu', cles, raison: lus.map(([s, r]) => `${NOM_SOURCE[s]} : N°${r.cle}`).join(' · '), descriptionSue };
  if (lus.length) return { etat: 'lu', cle: lus[0][1].cle, source: lus[0][0], brut: lus[0][1].brut, descriptionSue };
  const dRien = sources.find(([s, r]) => s === 'description' && r.ailleurs);
  return { etat: 'rien', raison: dRien ? 'un N° est écrit dans la description, mais pas à la fin' : (descriptionSue ? 'aucun N° écrit' : 'aucun N° dans le titre, description pas encore lue'), descriptionSue };
}
export const NOM_SOURCE = { ref: 'la référence', description: 'la fin de la description', titre: 'le titre' };

// ── CE QUE VRM EN FAIT, POUR UNE ANNONCE ─────────────────────────────────────
// `connu` : le N° que VRM a DÉJÀ pour cette annonce (par identité) ou '' ;
// `refuse` : un N° écrit qu'il a déjà écarté (« Garder N°X ») ;
// `reprenable(cle)` : faux pour un N° d'archive (013) ; `numerotable` : faux pour
// une annonce d'avant la remise à zéro (son « 12 » écrit désigne l'ANCIENNE paire).
// Rend l'état :
//   'a-poser'   lu, VRM n'avait rien : le N° lu devient celui de la paire ;
//   'accord'    lu = connu ;
//   'contredit' lu ≠ connu : rien ne change, « à vérifier », SON clic choisit ;
//   'garde'     lu ≠ connu, mais il a déjà choisi de garder celui de VRM ;
//   'archive'   lu est un ancien numéro (B…) : il ne se redonne pas ;
//   'avant'     annonce d'avant la remise à zéro : rien posé tout seul ;
//   'ambigu'    deux numéros : rien lu ;
//   'rien'      rien d'écrit (VRM n'a pas de N° non plus) ;
//   'sans-ecrit' rien d'écrit, VRM a un N° (il reste, rien ne change).
export function etatAnnonce({ lecture, connu = '', refuse = '', reprenable = () => true, numerotable = true } = {}) {
  const k = cleNumero(connu);
  if (!lecture || lecture.etat === 'rien') return k ? 'sans-ecrit' : 'rien';
  if (lecture.etat === 'ambigu') return 'ambigu';
  const lu = lecture.cle;
  if (k) {
    if (k === lu) return 'accord';
    if (refuse && cleNumero(refuse) === lu) return 'garde';
    return 'contredit';
  }
  if (!reprenable(lu)) return 'archive';
  if (!numerotable) return 'avant';
  return 'a-poser';
}

// L'APERÇU de toutes ses annonces : `lignes` = [{ id, site, titre, lecture,
// connu, refuse, numerotable, presente }]. Rend les comptes par état, les lignes
// classées, et les DOUBLONS : deux annonces présentes au même N° (lu ou connu,
// après pose) — le bloc rouge de l'app (deux paires sous un numéro).
export const ETATS_APERCU = ['a-poser', 'accord', 'contredit', 'garde', 'archive', 'avant', 'ambigu', 'rien', 'sans-ecrit'];
export function apercuNumeroEcrit(lignes, { reprenable = () => true } = {}) {
  const comptes = Object.fromEntries(ETATS_APERCU.map((e) => [e, 0]));
  const classees = [];
  const parCle = new Map();
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (!l || l.id == null) continue;
    const etat = etatAnnonce({ lecture: l.lecture, connu: l.connu, refuse: l.refuse, reprenable, numerotable: l.numerotable !== false });
    comptes[etat]++;
    const lu = l.lecture && l.lecture.etat === 'lu' ? l.lecture.cle : '';
    const fin = etat === 'a-poser' ? lu : cleNumero(l.connu);
    classees.push({ ...l, etat, lu, numero: fin });
    if (fin && l.presente !== false) { if (!parCle.has(fin)) parCle.set(fin, []); parCle.get(fin).push(String(l.site || 'vinted') + ':' + String(l.id)); }
  }
  // Une même paire peut être en ligne sur deux sites sous le même N° : seules
  // deux annonces du MÊME site sous un N° sont deux paires (la règle de l'app).
  const doublons = [];
  for (const [cle, ids] of parCle) {
    const parSite = {};
    for (const x of ids) { const s = x.split(':')[0]; (parSite[s] = parSite[s] || []).push(x); }
    for (const s of Object.keys(parSite)) if (parSite[s].length > 1) doublons.push({ cle, site: s, ids: parSite[s].map((x) => x.slice(s.length + 1)) });
  }
  return { comptes, lignes: classees, doublons, total: classees.length };
}

// Les N° à POSER (annonces sans N° dont le N° écrit est lu) : { [id]: { cle, source } }.
export function numerosAPoser(apercu) {
  const out = {};
  for (const l of (apercu && apercu.lignes) || []) if (l.etat === 'a-poser') out[String(l.id)] = { cle: l.lu, source: l.lecture.source };
  return out;
}

// Une phrase par état, pour un non-développeur (§2.7) : ce que VRM a lu, et le geste.
export const PHRASE_ETAT = {
  'a-poser': 'N° lu dans ton annonce : VRM le prend.',
  accord: 'N° lu : le même que celui de VRM.',
  contredit: 'Le N° écrit n’est pas celui de VRM : à toi de choisir.',
  garde: 'Tu as gardé le N° de VRM.',
  archive: 'Ancien numéro (remise à zéro) : il ne se redonne pas. Écris un nouveau numéro.',
  avant: 'Annonce d’avant la remise à zéro : VRM ne prend pas son N° tout seul.',
  ambigu: 'Deux numéros écrits : VRM ne choisit pas. Garde-en un seul.',
  rien: 'Aucun N° écrit : ajoute « N° 123 » à la fin de la description.',
  'sans-ecrit': 'Aucun N° écrit, VRM garde le sien.',
};
