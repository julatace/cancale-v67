// ═══════════════════════════════════════════════════════════════════════════
// LE PARCOURS GUIDÉ « À LA MAIN » — republier, remettre en vente, publier (15 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (15 nov.) : « pareil pour la republication à la main, tout doit être
// beaucoup mieux, accompagné, même la publication tout court ; […] une fois que
// l'application a modifié les photos, envoie directement dans la galerie les photos
// à l'utilisateur en lui disant que tout a été envoyé ».
//
// Ce module est LA règle du parcours (pur, sans React) : la feuille
// (`RepublierALaMain`, `PublierALaMain` dans src/ecrans/Republier.jsx) l'affiche,
// `scripts/audit-republier-guide.cjs` l'EXÉCUTE.
//
// LES ÉTAPES, dans l'ordre que Julien a choisi pour l'atelier le 28 oct. (garder,
// supprimer, recréer) : ses photos d'abord dans sa galerie (elles ne se perdent pas
// quand l'ancienne annonce disparaît), puis l'ancienne supprimée SUR VINTED par lui,
// puis la nouvelle créée par lui, puis « C'est republié », relu.
//   · republier : photos → supprimer → creer → fini
//   · remettre  : photos → creer → fini   (vente annulée : l'ancienne est fermée chez Vinted)
//   · publier   : photos → creer → fini   (une fiche « À publier » : rien à supprimer)
//
// ⚠️ UNE ÉTAPE EST COCHÉE SUR UNE PREUVE OU SUR SON GESTE FAIT, jamais devinée :
//    · photos   : le partage (ou le téléchargement) a RÉUSSI pour toutes les photos prêtes ;
//    · supprimer: l'ancienne n'est plus dans la lecture de ses annonces (`ancienne`
//                 = 'partie') — le lien ouvert seul ne vaut que « ouvert » ;
//    · creer    : la nouvelle annonce est désignée (SON clic) ou vue avec son N° ;
//    · fini     : le N° est sur la nouvelle annonce (relu) ⇒ « C'est republié ».
//    « Pas su » (lecture absente) n'est ni oui ni non : l'étape reste ouverte, dite.
// ⚠️ RIEN NE PART CHEZ VINTED d'ici : VRM ne supprime rien, ne publie rien. Les liens
//    ouvrent vinted.fr ; c'est lui qui supprime et qui publie.
// ⚠️ LE N° : la paire republiée GARDE son N° (src/repriseNumero.js, par identité : la
//    nouvelle annonce désignée par SON clic). Une fiche « À publier » porte le N° que
//    `prochainLibre` lui a donné à sa création : rien n'est attribué ici, jamais un
//    ancien N°.
// ⚠️ LES PHOTOS : celles du réglage de PRÉSENTATION choisi (un réglage pour toutes,
//    src/republierReglages.js), le même dessin que l'atelier ; aucun hasard, aucune
//    retouche d'une photo à l'autre. Les textes ne parlent que de présentation.
// ═══════════════════════════════════════════════════════════════════════════

export const ETAPES_GUIDE = Object.freeze({
  republier: Object.freeze(['photos', 'supprimer', 'creer', 'fini']),
  remettre: Object.freeze(['photos', 'creer', 'fini']),
  publier: Object.freeze(['photos', 'creer', 'fini']),
});
export const MODES_GUIDE = Object.keys(ETAPES_GUIDE);
export const modeGuide = (m) => (MODES_GUIDE.includes(m) ? m : 'republier');
export const etapesGuide = (mode) => ETAPES_GUIDE[modeGuide(mode)];

// Le prix à COLLER dans Vinted (« 44,10 », « 49 ») — jamais « 0 » pour un prix pas lu.
export const prixACopier = (p) => (p == null || !(Number(p) > 0) ? '' : (Number.isInteger(Number(p)) ? String(Number(p)) : Number(p).toFixed(2).replace('.', ',')));

// LES CHAMPS DE L'ANNONCE, dans l'ordre du formulaire « Vendre » de Vinted (titre,
// description, catégorie, marque, taille, état, couleur, prix). Chaque champ porte sa
// valeur, ou '' (pas lu) : un champ pas lu se DIT, il ne se copie jamais vide.
export const CHAMPS_ANNONCE = Object.freeze(['titre', 'description', 'categorie', 'marque', 'taille', 'etat', 'couleur', 'prix']);
export function champsAnnonce(a = {}) {
  const s = (v) => String(v == null ? '' : v).trim();
  const val = {
    titre: s(a.titre), description: String(a.description == null ? '' : a.description).replace(/\r/g, '').trim(),
    categorie: s(a.categorie), marque: s(a.marque), taille: s(a.taille), etat: s(a.etat), couleur: s(a.couleur),
    prix: prixACopier(a.prix),
  };
  // Les champs que la source ne connaît pas du tout (`sans`) ne s'affichent pas ; les autres
  // s'affichent même vides (« pas lu »). Titre, description et prix sont toujours là.
  const sans = new Set(Array.isArray(a.sans) ? a.sans : []);
  return CHAMPS_ANNONCE.filter((k) => !sans.has(k) || ['titre', 'description', 'prix'].includes(k)).map((k) => ({ k, v: val[k] }));
}
// Combien de champs à coller sont copiés (ceux qui ont une valeur).
export function couvertureCopie(champs, copies) {
  const l = (Array.isArray(champs) ? champs : []).filter((c) => c && c.v);
  const vus = copies instanceof Set ? copies : new Set(Array.isArray(copies) ? copies : []);
  return { n: l.length, faits: l.filter((c) => vus.has(c.k)).length };
}

// L'ÉTAT DE CHAQUE ÉTAPE : 'fait' · 'ouvert' (geste lancé, pas encore prouvé) · 'a-faire' · 'sans' (rien à faire ici).
// e = {
//   photos:   { n: photos connues, pretes: fichiers prêts, envoyees: fichiers partagés/téléchargés avec succès },
//   ancienne: 'en-ligne' | 'partie' | undefined (pas su) ; ancienneOuverte: bool (son lien touché),
//   copies:   nombre de champs copiés ; vintedOuvert: bool ;
//   nouvelle: 'attente' | 'lie' (désignée par lui) | 'fait' (N° posé, relu) | 'vue' (fiche : vue en ligne avec son N°)
// }
export function etatsEtapes(mode, e = {}) {
  const m = modeGuide(mode);
  const ph = e.photos || {};
  const n = Number(ph.n) || 0, env = Number(ph.envoyees) || 0, pretes = Number(ph.pretes) || 0;
  const out = {};
  out.photos = n === 0 ? 'sans' : (pretes > 0 && env >= pretes ? 'fait' : (env > 0 ? 'ouvert' : 'a-faire'));
  if (m === 'republier') out.supprimer = e.ancienne === 'partie' ? 'fait' : (e.ancienneOuverte ? 'ouvert' : 'a-faire');
  const nv = e.nouvelle;
  out.creer = nv === 'lie' || nv === 'fait' || nv === 'vue' ? 'fait' : ((Number(e.copies) || 0) > 0 || e.vintedOuvert ? 'ouvert' : 'a-faire');
  out.fini = nv === 'fait' || nv === 'vue' ? 'fait' : (nv === 'lie' ? 'ouvert' : 'a-faire');
  return out;
}
// L'étape conseillée : la première qui n'est ni faite ni « sans ».
export function etapeConseillee(mode, etats) {
  const l = etapesGuide(mode);
  return l.find((k) => etats && etats[k] !== 'fait' && etats[k] !== 'sans') || l[l.length - 1];
}
export function nFaites(mode, etats) { return etapesGuide(mode).filter((k) => etats && (etats[k] === 'fait' || etats[k] === 'sans')).length; }

// L'ANCIENNE ANNONCE, d'après la lecture de ses annonces (les mêmes que la reprise du N°,
// `repriseNumerosRecreation` : `enLigneIds`). `items` absent ou en erreur ⇒ undefined (pas su).
// ⚠️ (23 nov., capture de Julien : « Supprimer » cochée alors qu'il était à l'étape 1) L'ABSENCE ne prouve
//    « partie » que si la lecture de CE compte est COMPLÈTE et a répondu (`complets[uid]`, pas dans `ko`) et que
//    l'annonce n'est ni « à confirmer » (lecture de plus de 24 h) ni masquée : une annonce hors de `items` parce que
//    sa lecture est partielle, ancienne, ratée, ou masquée est toujours chez lui — « pas su », jamais « partie »
//    (CLAUDE.md §5 : jamais déduit d'une absence, « rien lu » ≠ « rien »). Sans `uid` ni `complets` : pas su.
export function etatAncienne(id, items, { erreur = false, uid = '', complets = null, ko = null, aConfirmer = null, masquees = null } = {}) {
  if (!id || erreur || !Array.isArray(items)) return undefined;
  const meme = (x) => x && String(x.id) === String(id);
  if (items.some(meme)) return 'en-ligne';
  const u = String(uid || '');
  if (!u || !complets || complets[u] !== true) return undefined;
  if (Array.isArray(ko) && ko.map(String).includes(u)) return undefined;
  if ((Array.isArray(aConfirmer) && aConfirmer.some(meme)) || (Array.isArray(masquees) && masquees.some(meme))) return undefined;
  return 'partie';
}

// LE RÉSULTAT, en clés de traduction (`rg.fini.*`) : ce que la dernière étape dit.
// etatSuivi : 'attente' | 'lie' | 'fait' (annoncesActions.etatSuiviMain) ; candidats : nouvelles annonces lues.
export function resultatFin(mode, { etatSuivi = 'attente', numero = '', nCandidats = null, vue = false } = {}) {
  const m = modeGuide(mode);
  if (m === 'publier') return vue ? { cle: 'rg.fini.publieVue', etat: 'fait' } : { cle: 'rg.fini.publiePasVue', etat: 'pas-su' };
  if (etatSuivi === 'fait') return { cle: numero ? 'rg.fini.republieNum' : 'rg.fini.republie', etat: 'fait' };
  if (etatSuivi === 'lie') return { cle: numero ? 'rg.fini.lieNum' : 'rg.fini.lie', etat: 'lie' };
  if (nCandidats === null || nCandidats === undefined) return { cle: 'rg.fini.pasSu', etat: 'pas-su' };
  return { cle: nCandidats > 0 ? 'rg.fini.choisir' : 'rg.fini.pasVue', etat: 'attente' };
}

// LA LIGNE DE « CE QUE VRM A FAIT » (src/suiviTravail.js, `noterGesteFait`) : seulement
// quand c'est PROUVÉ (« C'est republié » relu / « vue en ligne »). Aucun texte d'annonce,
// aucun pseudo d'acheteur : le N°, le titre court, le compte.
export function travailFait(mode, { id, numero = '', titre = '', compte = '', nouvelId = '' } = {}) {
  const m = modeGuide(mode);
  if (!id) return null;
  return {
    sorte: m === 'publier' ? 'publier-main' : 'republier-main',
    cle: m === 'publier' ? 'rg.journal.publie' : m === 'remettre' ? 'rg.journal.remis' : 'rg.journal.republie',
    article: { id: String(nouvelId || id), num: String(numero || ''), titre: String(titre || '').slice(0, 90) },
    compte: String(compte || ''),
  };
}

// TOUTES LES PHOTOS DE L'ANNONCE (15 nov., capture de Julien : « on me propose qu'une seule photo,
// ce n'est pas possible, je veux TOUTES les photos »). Mesuré dans le code : la feuille ne lisait
// que le coffre (`coffre_{uid}_{id}`, écrit par l'atelier) puis retombait sur la VIGNETTE du
// dressing — une annonce jamais passée par l'atelier (une vente retournée, surtout) n'avait qu'UNE
// photo. Les sources, toutes par l'IDENTITÉ de l'annonce, jamais par ressemblance :
//   coffre     — ce que l'atelier a rangé ;
//   detail     — `vinted_item_details[id].photos` : la fiche lue sur la page de l'annonce ;
//   liste      — les photos portées par la lecture du dressing (`photos` / `photosDetail`) ;
//   couverture — la vignette seule.
// La source qui en porte LE PLUS gagne (à égalité : coffre, puis fiche, puis dressing) ; l'ordre
// est celui de Vinted (la 1re = la couverture), doublons retirés. `attendu` (le nombre que Vinted
// annonce, `nPhotos`) : s'il en manque, `manque` le dit ; la vignette seule ⇒ `manque` null
// (« pas su » : combien en a-t-elle ?) — l'écran dit le geste pour les avoir toutes.
const urlPhoto = (p) => (typeof p === 'string' ? p : (p && (p.full_size_url || p.url)) || '');
export function photosDeLAnnonce({ coffre = null, detail = null, liste = null, couverture = '', attendu = null } = {}) {
  const net = (l) => { const vus = new Set(); return (Array.isArray(l) ? l : []).map(urlPhoto).filter((u) => u && !vus.has(u) && vus.add(u)).slice(0, 20); };
  const sources = [['coffre', net(coffre)], ['detail', net(detail)], ['liste', net(liste)]];
  let [source, photos] = sources.reduce((m, x) => (x[1].length > m[1].length ? x : m), ['', []]);
  if (!photos.length && couverture) { source = 'couverture'; photos = [String(couverture)]; }
  const n = Number(attendu);
  const connu = attendu != null && attendu !== '' && Number.isFinite(n) && n > 0;
  const manque = connu ? Math.max(0, n - photos.length) : (source === 'couverture' ? null : 0);
  return { photos, source, attendu: connu ? n : null, manque };
}
// Les photos CHOISIES (il peut en décocher) : l’ordre de l’annonce, sans celles qu’il a retirées (par adresse ou rang).
export function photosChoisies(photos, exclues) {
  const ex = exclues instanceof Set ? exclues : new Set(Array.isArray(exclues) ? exclues : []);
  return (Array.isArray(photos) ? photos : []).filter((u, i) => !ex.has(i) && !ex.has(u));
}

// (23 nov., « une grille de TOUTES les photos, sélection, ordre par glisser ») L'ORDRE choisi par lui : `ordre` est la
// liste des adresses dans SON ordre (glisser) ; une photo connue qui n'y est pas encore (lue après coup) va à la fin,
// une adresse qui n'est plus connue sort. Pur : la feuille garde `ordre`, la règle range.
export function photosRangees(photos, ordre) {
  const l = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const o = Array.isArray(ordre) ? ordre.filter((u) => l.includes(u)) : [];
  return [...new Set([...o, ...l])];
}
// Déplacer une photo de la place `de` à la place `vers` (glisser), sans rien perdre ni doubler.
export function deplacerPhoto(liste, de, vers) {
  const l = Array.isArray(liste) ? liste.slice() : [];
  const a = Number(de), b = Number(vers);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || a >= l.length || b < 0 || b >= l.length || a === b) return l;
  const [x] = l.splice(a, 1); l.splice(b, 0, x);
  return l;
}
