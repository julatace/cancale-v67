// ── LES BROUILLONS PRÉPARÉS À L'AVANCE (21 nov., ext. 5.429 — choix de Julien, points 61 à 63) ──────────────────
// « Je prépare photos, titre, description, marque, taille, état, couleurs, colis, prix dans VRM ; le lendemain,
//   " Déposer N sur Vinted " depuis le panneau. » Ce module est LA règle (pur, sans React) : l'app (fiche à préparer,
//   « À publier »), l'extension (recopiée dans `GARDES_APP` par scripts/recopier-gardes-extension.cjs, jamais à la main)
//   et `scripts/audit-ext-5429.cjs` l'EXÉCUTENT.
//
// ⚠️ JAMAIS DEVINÉ (§5) :
//   · la fiche est l'article (son `id`, son N°) ; elle est reliée à l'annonce créée par l'IDENTIFIANT que Vinted rend
//     (`creerVintedFiche`) — jamais par un titre ;
//   · une variable de modèle sans valeur reste écrite « {taille} » et BLOQUE le dépôt (nommée) : rien n'est inventé ;
//   · le modèle d'un article ({modele}) est CELUI qu'il a écrit sur la fiche — jamais lu dans le titre.
// ⚠️ L'ORDRE DES PHOTOS : la couverture (son étoile) passe en 1re, les autres gardent SON ordre ; après le dépôt,
//   l'ordre que la page de Vinted a envoyé est RELU par identité (le nom de chaque fichier ↔ l'identifiant que Vinted a
//   rendu pour CE fichier) — « pas su » ne vaut pas « bon ».

const str = (v) => String(v == null ? '' : v).trim();
const plat = (s) => str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ');

export const PHOTOS_DEPOT_MAX = 20;
export const DESCRIPTION_DEPOT_MIN = 5;
// La taille du colis : les trois choix du formulaire de Vinted (identifiants du sélecteur `package_type_selector_{id}`).
export const COLIS_DEPOT = Object.freeze({ petit: 1, moyen: 2, grand: 3 });
// Les états de Vinted (le libellé EXACT : l'extension le cherche tel quel dans la grille de la catégorie).
export const ETATS_DEPOT = Object.freeze(['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'Satisfaisant']);
// Les champs d'une fiche préparée, dans l'ordre où l'écran les montre et où ils sont nommés quand ils manquent.
export const CHAMPS_DEPOT = Object.freeze(['photos', 'titre', 'description', 'categorie', 'marque', 'taille', 'etat', 'couleurs', 'colis', 'prix']);
// Pour un BROUILLON, Vinted n'exige que les photos ; VRM exige en plus ce qui identifie l'article (N°) et ce qui part
// tel quel (titre, prix). Le reste manquant est DIT (« à finir sur Vinted »), jamais deviné.
const REQUIS_BROUILLON = ['photos', 'titre', 'prix'];

const prixDe = (p) => { const n = Number(String(p == null ? '' : (typeof p === 'object' ? p.amount : p)).replace(',', '.')); return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null; };
export const couleursDe = (f) => {
  const l = Array.isArray(f && f.couleurs) ? f.couleurs : [f && f.couleur, f && f.couleur2];
  return [...new Set(l.map(str).filter(Boolean))].slice(0, 2);
};
// Une variable de modèle restée sans valeur : « {taille} » (lettres, chiffres, soulignés, « N° »).
export const RE_VARIABLE = /\{(N°|[a-z_]{2,20})\}/g;
export const variablesRestantes = (texte) => [...new Set([...String(texte || '').matchAll(RE_VARIABLE)].map((m) => m[1]))];

// Les photos de la fiche, dans l'ordre du dépôt. `ids` : l'ordre qu'il a posé (glisser) ; `couverture` : SON étoile.
// La couverture passe en 1re, les autres gardent leur ordre ; un identifiant en double n'est compté qu'une fois.
export function ordrePhotos(ids, couverture) {
  const l = [...new Set((Array.isArray(ids) ? ids : []).map(str).filter(Boolean))];
  const c = str(couverture);
  return c && l.includes(c) ? [c, ...l.filter((x) => x !== c)] : l;
}
// Les photos du studio (`studio_photos_{N°}` : [{ id, img }]) rangées pour le dépôt : SON ordre (`depot.photos`) s'il l'a
// posé, sinon l'ordre du studio ; la couverture en 1re. Une photo de son ordre qui n'est plus au studio ⇒ `erreur`
// (jamais une autre photo à sa place). Rend { photos: [{ id, img }], erreur }.
export function photosDepot(fiche, studio) {
  const st = (Array.isArray(studio) ? studio : []).filter((p) => p && str(p.id) && typeof p.img === 'string');
  const d = (fiche && fiche.depot) || {};
  const voulu = Array.isArray(d.photos) && d.photos.length ? d.photos : st.map((p) => p.id);
  const ordre = ordrePhotos(voulu, d.couverture).slice(0, PHOTOS_DEPOT_MAX);
  const out = [];
  for (let i = 0; i < ordre.length; i++) {
    const p = st.find((x) => str(x.id) === ordre[i]);
    if (!p) return { photos: [], erreur: `la photo ${i + 1} de ta fiche n’est plus dans le studio` };
    out.push({ id: str(p.id), img: p.img });
  }
  return { photos: out, erreur: '' };
}

// Ce qui manque pour déposer : les champs (clés de CHAMPS_DEPOT) — pour `mode` 'publier' TOUS, pour 'brouillon' ceux que
// VRM exige (photos, titre, prix). `nPhotos` : les photos rangées pour le dépôt. Une description qui garde une variable
// de modèle sans valeur (« {taille} ») MANQUE (nommée par `variables`).
export function manquesDepot(fiche, nPhotos, mode = 'publier') {
  const f = fiche || {};
  const m = [];
  const desc = String(f.description == null ? '' : f.description).replace(/\r/g, '').trim();
  const v = variablesRestantes(`${f.titre || ''}\n${desc}`);
  const tout = {
    photos: Number(nPhotos) > 0,
    titre: !!str(f.titre) && !variablesRestantes(f.titre).length,
    description: desc.length >= DESCRIPTION_DEPOT_MIN && !variablesRestantes(desc).length,
    categorie: !!str(f.categorie),
    marque: !!str(f.marque),
    taille: !!str(f.taille),
    etat: ETATS_DEPOT.some((e) => plat(e) === plat(f.etat)),
    couleurs: couleursDe(f).length > 0,
    colis: Object.prototype.hasOwnProperty.call(COLIS_DEPOT, str(f.colis)),
    prix: prixDe(f.prix) != null,
  };
  const requis = mode === 'brouillon' ? REQUIS_BROUILLON : CHAMPS_DEPOT;
  for (const k of CHAMPS_DEPOT) if (!tout[k] && (requis.includes(k) || mode === 'brouillon')) m.push(k);
  return { manque: m.filter((k) => requis.includes(k)), aFinir: mode === 'brouillon' ? m.filter((k) => !requis.includes(k)) : [], variables: v, numero: !!str(f.numero) };
}

// Ce qui part vers le formulaire (liste blanche) : jamais un prix d'achat ni l'identifiant d'une autre annonce.
export function payloadDepot(fiche, photos) {
  const f = fiche || {};
  const c = couleursDe(f);
  return {
    id: str(f.id), numero: str(f.numero), titre: str(f.titre).replace(/\s+/g, ' '), description: String(f.description == null ? '' : f.description).replace(/\r/g, '').trim(),
    marque: str(f.marque), taille: str(f.taille), etat: str(f.etat), couleur: c[0] || '', couleur2: c[1] || '', categorie: str(f.categorie),
    colis: Object.prototype.hasOwnProperty.call(COLIS_DEPOT, str(f.colis)) ? COLIS_DEPOT[str(f.colis)] : null,
    prix: prixDe(f.prix), photos: (Array.isArray(photos) ? photos : []).map((p) => (typeof p === 'string' ? p : p && p.img)).filter((u) => typeof u === 'string').slice(0, PHOTOS_DEPOT_MAX),
  };
}

// L'ORDRE RELU (après « Sauvegarder le brouillon ») : `noms` = les fichiers dans l'ordre voulu (« photo-1.jpg »…) ;
// `envoyes` = ce que la page a téléversé [{ nom, id }] (le nom du fichier ↔ l'identifiant que Vinted a rendu) ;
// `assignes` = les identifiants dans l'ordre que la PAGE a mis dans son brouillon. Rend
// { etat: 'ok' | 'faux' | 'pas-su', premier } — `premier` : la 1re position fausse (1 = la couverture).
export function ordreRelu(noms, envoyes, assignes) {
  const n = (Array.isArray(noms) ? noms : []).map(str);
  const e = Array.isArray(envoyes) ? envoyes : null;
  const a = Array.isArray(assignes) ? assignes.map((x) => str(x && typeof x === 'object' ? x.id : x)) : null;
  if (!n.length || !e || !a) return { etat: 'pas-su', premier: 0 };
  const parNom = new Map();
  for (const x of e) { const k = str(x && x.nom), id = str(x && x.id); if (!k || !id) return { etat: 'pas-su', premier: 0 }; if (parNom.has(k) && parNom.get(k) !== id) return { etat: 'pas-su', premier: 0 }; parNom.set(k, id); }
  const attendu = n.map((k) => parNom.get(k));
  if (attendu.some((x) => !x)) return { etat: 'pas-su', premier: 0 };
  if (a.length !== attendu.length) return { etat: 'faux', premier: Math.min(a.length, attendu.length) + 1 };
  for (let i = 0; i < attendu.length; i++) if (a[i] !== attendu[i]) return { etat: 'faux', premier: i + 1 };
  return { etat: 'ok', premier: 0 };
}

// ── LES DESCRIPTIONS TYPES (point 63) ──────────────────────────────────────────────────────────────────────────
// Un modèle : { id, portee: 'defaut' | 'marque' | 'modele', marque, modele, texte, majAt }. LE modèle d'une fiche est le
// plus PRÉCIS qui la concerne : modèle (même marque ET même modèle écrits sur la fiche) > marque > défaut ; deux de même
// précision ⇒ le plus récemment modifié (et c'est dit : `egaux`). Comparaison : casse, accents et blancs mis à part.
export const VARIABLES_MODELE = Object.freeze(['marque', 'modele', 'taille', 'pointure_eu', 'etat', 'couleur', 'couleurs', 'colis', 'prix', 'N°', 'numero']);
export function choisirModele(modeles, fiche) {
  const f = fiche || {};
  const l = (Array.isArray(modeles) ? modeles : []).filter((m) => m && str(m.texte) && ['defaut', 'marque', 'modele'].includes(m.portee));
  const mq = plat(f.marque), md = plat(f.modele);
  const rang = (m) => {
    if (m.portee === 'modele') return mq && md && plat(m.marque) === mq && plat(m.modele) === md ? 3 : 0;
    if (m.portee === 'marque') return mq && plat(m.marque) === mq ? 2 : 0;
    return 1;
  };
  const notes = l.map((m) => [rang(m), m]).filter(([r]) => r > 0);
  if (!notes.length) return { modele: null, portee: '', egaux: 0 };
  const max = Math.max(...notes.map(([r]) => r));
  const cands = notes.filter(([r]) => r === max).map(([, m]) => m).sort((a, b) => String(b.majAt || '').localeCompare(String(a.majAt || '')));
  return { modele: cands[0], portee: cands[0].portee, egaux: cands.length - 1 };
}
// La pointure EU : SEULEMENT si la taille de la fiche est déjà une pointure EU écrite en chiffres (« 42 », « 42,5 »,
// « EU 42 ») — jamais convertie d'une pointure US/UK (ce serait deviner).
export function pointureEu(taille) {
  const m = /^(?:eu\s*)?(\d{2}(?:[.,]5|\s?1\/2|\s?1\/3|\s?2\/3)?)$/i.exec(str(taille));
  return m ? m[1].replace('.', ',') : '';
}
const NOMS_COLIS = { petit: 'petit', moyen: 'moyen', grand: 'grand' };
// Le texte du modèle rempli avec la fiche. Rend { texte, manques, inconnues } : une variable SANS valeur reste écrite
// telle quelle (« {taille} ») et est dans `manques` ; une variable inconnue reste aussi et est dans `inconnues`.
export function remplirModele(texte, fiche) {
  const f = fiche || {};
  const c = couleursDe(f);
  const prix = prixDe(f.prix);
  const val = {
    marque: str(f.marque), modele: str(f.modele), taille: str(f.taille), pointure_eu: pointureEu(f.taille), etat: str(f.etat),
    couleur: c[0] || '', couleurs: c.join(' et '), colis: NOMS_COLIS[str(f.colis)] || '', prix: prix == null ? '' : String(prix).replace('.', ','),
    'N°': str(f.numero) ? `N°${str(f.numero)}` : '', numero: str(f.numero),
  };
  const manques = new Set(), inconnues = new Set();
  const out = String(texte == null ? '' : texte).replace(RE_VARIABLE, (tout, k) => {
    if (!Object.prototype.hasOwnProperty.call(val, k)) { inconnues.add(k); return tout; }
    if (!val[k]) { manques.add(k); return tout; }
    return val[k];
  });
  return { texte: out, manques: [...manques], inconnues: [...inconnues] };
}
// La description proposée à une fiche : le modèle choisi, rempli. `null` si aucun modèle ne la concerne.
export function descriptionProposee(modeles, fiche) {
  const ch = choisirModele(modeles, fiche);
  if (!ch.modele) return null;
  return { ...remplirModele(ch.modele.texte, fiche), modeleId: str(ch.modele.id), portee: ch.portee, egaux: ch.egaux };
}
// Un modèle valide (l'éditeur) : texte de 5 à 3 000 caractères, portée connue, marque / modèle quand il le faut.
export function modeleValide(m) {
  const x = m || {};
  if (!['defaut', 'marque', 'modele'].includes(x.portee)) return 'portee';
  if (str(x.texte).length < DESCRIPTION_DEPOT_MIN || str(x.texte).length > 3000) return 'texte';
  if ((x.portee === 'marque' || x.portee === 'modele') && !str(x.marque)) return 'marque';
  if (x.portee === 'modele' && !str(x.modele)) return 'modele';
  return '';
}
