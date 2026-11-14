// ═══════════════════════════════════════════════════════════════════════════
// CE QUI RAPPORTE LE PLUS (3 novembre) — Statistiques
// ═══════════════════════════════════════════════════════════════════════════
// Julien (3 nov. 13 h 02) : un classement par Modèle · Marque · Taille · Compte ·
// Site pour la période choisie — bénéfice brut total et moyen par article, marge,
// nombre vendu, temps pour vendre — « pour savoir quoi racheter ».
//
// Module PUR (aucune lecture) : il reçoit le relevé que l'écran Ventes publie
// (`vrm_stats_ventes` — ventes FINALISÉES, prix d'achat relié par identité
// seulement, §11) et rend des chiffres AVEC LEUR COUVERTURE (§5) :
//   · « Bénéfice brut » = vente − prix d'achat, sur les seules ventes au prix
//     d'achat CONNU, jamais « au moins » (src/beneficeNoms.js) ; un groupe sans
//     aucun prix d'achat connu n'a ni brut, ni moyenne, ni marge (null, « — ») ;
//   · le temps pour vendre : de la mise en ligne de l'annonce reliée par SA
//     transaction à la vente (Vinted seulement), médiane dite en mots ;
//   · une vente au montant illisible ou dans une autre devise que l'euro est
//     ÉCARTÉE et comptée (`ecartees`), jamais convertie ni comptée à 0.
// Le « modèle » n'est qu'une STATISTIQUE, jamais une identité (§5) : il se lit
// dans le titre de LA vente, contre un catalogue fermé où chaque modèle porte sa
// marque ; si la marque de l'annonce le contredit, ou si rien n'est reconnu, la
// vente va dans « Autres ». Mieux vaut « Autres » qu'un modèle faux.
// Exécuté par scripts/audit-ce-qui-rapporte.cjs.

const J = 86400000;
export const AUTRES = 'Autres';
export const AXES_RAPPORTE = { modele: 'Modèle', marque: 'Marque', taille: 'Taille', compte: 'Compte', site: 'Site' };

export const sansAccents = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
// Le texte comparable : minuscules, sans accents, tout ce qui n'est ni lettre ni
// chiffre devient un espace (« P-6000 » = « p 6000 », « Gel-Kayano » = « gel kayano »).
export const texteNormal = (s) => sansAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
// Un mot (ou une suite de mots) ENTIER dans un texte normalisé : « air max 1 »
// n'est pas dans « air max 180 », « dunk » est dans « dunk low ».
export const contientMots = (t, k) => !!k && (' ' + t + ' ').includes(' ' + k + ' ');

// La marque d'une ligne : la clé (comparable) et le nom affiché.
export const cleMarque = (b) => texteNormal(b);

// Le catalogue : [variantes, nom affiché, marques propriétaires (clés)].
// Les numéros New Balance ne valent qu'avec la marque New Balance LUE sur
// l'annonce (un « 550 » seul peut être un prix).
const MARQUES = { nike: 'Nike', jordan: 'Jordan', adidas: 'Adidas', asics: 'Asics', 'new balance': 'New Balance', salomon: 'Salomon', vans: 'Vans', converse: 'Converse', 'onitsuka tiger': 'Onitsuka Tiger', puma: 'Puma', reebok: 'Reebok' };
const MODELES = [
  [['air max 95'], 'Air Max 95', ['nike']], [['air max 97'], 'Air Max 97', ['nike']], [['air max 90'], 'Air Max 90', ['nike']],
  [['air max 1'], 'Air Max 1', ['nike']], [['air max plus', 'tn'], 'Air Max Plus', ['nike']], [['air max'], 'Air Max', ['nike']],
  [['air force 1', 'air force', 'af1'], 'Air Force 1', ['nike']], [['dunk'], 'Dunk', ['nike']], [['blazer'], 'Blazer', ['nike']],
  [['cortez'], 'Cortez', ['nike']], [['pegasus'], 'Pegasus', ['nike']], [['vaporfly'], 'Vaporfly', ['nike']], [['alphafly'], 'Alphafly', ['nike']],
  [['zoom fly'], 'Zoom Fly', ['nike']], [['p 6000', 'p6000'], 'P-6000', ['nike']], [['vomero'], 'Vomero', ['nike']], [['shox'], 'Shox', ['nike']],
  [['jordan 1', 'air jordan 1'], 'Jordan 1', ['jordan', 'nike']], [['jordan 4', 'air jordan 4'], 'Jordan 4', ['jordan', 'nike']],
  [['spezial', 'handball spezial'], 'Spezial', ['adidas']], [['samba'], 'Samba', ['adidas']], [['gazelle'], 'Gazelle', ['adidas']],
  [['campus'], 'Campus', ['adidas']], [['superstar'], 'Superstar', ['adidas']], [['stan smith'], 'Stan Smith', ['adidas']],
  [['forum'], 'Forum', ['adidas']], [['sl 72'], 'SL 72', ['adidas']],
  [['gel lyte'], 'Gel-Lyte', ['asics']], [['gel kayano'], 'Gel-Kayano', ['asics']], [['gel nimbus'], 'Gel-Nimbus', ['asics']],
  [['gel resolution'], 'Gel-Resolution', ['asics']], [['gel 1130'], 'Gel-1130', ['asics']],
  [['9060'], '9060', ['new balance'], true], [['2002r'], '2002R', ['new balance'], true], [['1906r'], '1906R', ['new balance'], true],
  [['990'], '990', ['new balance'], true], [['550'], '550', ['new balance'], true], [['530'], '530', ['new balance'], true],
  [['327'], '327', ['new balance'], true], [['574'], '574', ['new balance'], true], [['fuelcell'], 'FuelCell', ['new balance']],
  [['xt 6'], 'XT-6', ['salomon']], [['speedcross'], 'Speedcross', ['salomon']],
  [['old skool'], 'Old Skool', ['vans']], [['chuck 70', 'chuck taylor'], 'Chuck Taylor', ['converse']],
  [['mexico 66'], 'Mexico 66', ['onitsuka tiger']],
];

// LE MODÈLE SÛR d'une vente : { cle, nom } ou null (« Autres »).
//   marqueChamp : la marque LUE sur l'annonce (Vinted `brand`), '' sinon ;
//   titre       : le titre de LA vente.
// Règles : le plus long modèle reconnu dans le titre (mots entiers) ; la marque
// de l'annonce, si elle est lue, doit être l'une de ses marques (sinon null) ;
// sans marque lue, la marque doit se lire dans le titre, ou le modèle n'avoir
// qu'une marque — et jamais pour un modèle « numéro seul » (New Balance).
export const modeleSur = (marqueChamp, titre) => {
  const t = texteNormal(titre);
  if (!t) return null;
  let best = null, bestK = '';
  for (const m of MODELES) for (const k of m[0]) if (contientMots(t, k) && k.length > bestK.length) { best = m; bestK = k; }
  if (!best) return null;
  const [, nom, proprios, numeroSeul] = best;
  const bm = cleMarque(marqueChamp);
  let proprio = null;
  if (bm) {
    proprio = proprios.find((p) => contientMots(bm, p)) || null;
    if (!proprio) return null;                    // la marque lue contredit le modèle
  } else {
    if (numeroSeul) return null;                  // « 550 » sans New Balance lue : rien n'est sûr
    proprio = proprios.find((p) => contientMots(t, p)) || (proprios.length === 1 ? proprios[0] : null);
    if (!proprio) return null;
  }
  // Une Jordan vendue sous la marque « Nike » reste une Jordan : la marque du nom
  // est la PREMIÈRE propriétaire (celle du modèle), pas celle de l'étiquette.
  const marqueNom = MARQUES[proprios[0]] || proprios[0];
  return { cle: `${proprios[0]}|${nom.toLowerCase()}`, nom: nom.toLowerCase().startsWith(marqueNom.toLowerCase() + ' ') ? nom : `${marqueNom} ${nom}` };
};

// La médiane, dite en mots : « la moitié part en moins de 6 j ». Une médiane de
// 5,5 j ⇒ « moins de 6 j » ; de 6 j pile ⇒ « moins de 7 j » (la moitié part en
// 6 jours ou moins : « moins de 6 » serait faux).
export const phraseMoitie = (mediane) => {
  if (mediane == null || !isFinite(mediane)) return '';
  if (mediane < 1) return 'la moitié part en moins d’un jour';
  return `la moitié part en moins de ${Math.floor(mediane) + 1} j`;
};

const cents = (v) => Math.round(Number(v) * 100);
const mediane = (s) => (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);

// La clé de groupe d'une ligne selon l'axe → { k, nom } ('' = Autres).
const nomMarqueAffiche = (b) => String(b || '').trim();
export const cleAxe = (l, axe) => {
  if (axe === 'modele') { const m = l.modeleSur; return m && m.cle ? { k: m.cle, nom: m.nom } : { k: '', nom: AUTRES }; }
  if (axe === 'marque') { const k = cleMarque(l.marque); return k ? { k, nom: nomMarqueAffiche(l.marque) } : { k: '', nom: AUTRES }; }
  if (axe === 'taille') { const t = String(l.taille || '').trim(); return t ? { k: t.toLowerCase(), nom: t } : { k: '', nom: AUTRES }; }
  // (14 nov., lot argent-choix — proposition 80) MODÈLE ET TAILLE : le modèle SÛR (`modeleSur`) et la
  // taille de la vente ; l'un des deux manque ⇒ « Autres ». Une statistique, jamais une identité (§5).
  if (axe === 'modeleTaille') { const m = l.modeleSur, t = String(l.taille || '').trim(); return m && m.cle && t ? { k: `${m.cle}|${t.toLowerCase()}`, nom: `${m.nom} · ${t}` } : { k: '', nom: AUTRES }; }
  if (axe === 'compte') {
    if (l.plateforme === 'Vinted') { const c = String(l.compte || '').trim(); return c ? { k: 'Vinted|' + c, nom: c } : { k: 'Vinted|', nom: 'Vinted' }; }
    return { k: String(l.plateforme || ''), nom: String(l.plateforme || AUTRES) };
  }
  // site
  return l.plateforme ? { k: String(l.plateforme), nom: String(l.plateforme) } : { k: '', nom: AUTRES };
};

// LE CLASSEMENT. `lignes` : le relevé de la période, une ligne par vente
// finalisée : { plateforme, compte, id, ts, eur, achat (€|null), devise?,
// titre, marque, taille, modeleSur ({cle,nom}|null), enLigne (ms|null) }.
// Rend { n, nCout, nDelai, ecartees, groupes } ; chaque groupe :
//   { k, nom, n, nCout, ca, caCouvert, cout, brut, moyen, marge, mediane,
//     nDelai, lignes: [indices dans `lignes`, du plus récent au plus ancien] }.
// Tri : bénéfice brut total décroissant (les groupes sans brut après, par
// nombre vendu), « Autres » toujours en dernier.
export const classementRapporte = (lignes, axe = 'modele') => {
  if (!Array.isArray(lignes)) return null;
  const par = new Map();
  let n = 0, nCout = 0, nDelai = 0, ecartees = 0;
  lignes.forEach((l, i) => {
    if (!l) return;
    const eur = Number(l.eur);
    if (l.eur == null || !isFinite(eur) || !isFinite(Number(l.ts)) || (l.devise && String(l.devise).toUpperCase() !== 'EUR')) { ecartees += 1; return; }
    n += 1;
    const { k, nom } = cleAxe(l, axe);
    const g = par.get(k) || (par.set(k, { k, nom, n: 0, ca: 0, nCout: 0, caCouvert: 0, cout: 0, js: [], idx: [] }), par.get(k));
    g.n += 1; g.ca += cents(eur); g.idx.push(i);
    const connu = l.achat != null && String(l.achat).trim() !== '' && isFinite(Number(l.achat));
    if (connu) { nCout += 1; g.nCout += 1; g.caCouvert += cents(eur); g.cout += cents(l.achat); }
    const e = Number(l.enLigne);
    if (l.enLigne != null && isFinite(e) && e > 0 && Number(l.ts) >= e) { const j = (Number(l.ts) - e) / J; g.js.push(j); nDelai += 1; }
  });
  const groupes = [...par.values()].map((g) => {
    const brut = g.nCout ? (g.caCouvert - g.cout) / 100 : null;
    const s = g.js.slice().sort((a, b) => a - b);
    return {
      k: g.k, nom: g.nom, n: g.n, nCout: g.nCout, ca: g.ca / 100, caCouvert: g.caCouvert / 100, cout: g.cout / 100,
      brut, moyen: brut == null ? null : Math.round((g.caCouvert - g.cout) / g.nCout) / 100,
      marge: brut == null || !g.caCouvert ? null : Math.round((g.caCouvert - g.cout) / g.caCouvert * 1000) / 10,
      mediane: s.length ? Math.round(mediane(s) * 10) / 10 : null, nDelai: s.length,
      lignes: g.idx.slice().sort((a, b) => Number(lignes[b].ts) - Number(lignes[a].ts) || a - b),
    };
  }).sort((a, b) => {
    if ((a.k === '') !== (b.k === '')) return a.k === '' ? 1 : -1;
    if ((a.brut == null) !== (b.brut == null)) return a.brut == null ? 1 : -1;
    if (a.brut != null && b.brut !== a.brut) return b.brut - a.brut;
    return b.n - a.n || (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0);
  });
  // Le nom affiché d'une marque : l'orthographe la plus fréquente du groupe.
  if (axe === 'marque') for (const g of groupes) {
    if (!g.k) continue;
    const c = {}; for (const i of g.lignes) { const s = nomMarqueAffiche(lignes[i].marque); c[s] = (c[s] || 0) + 1; }
    g.nom = Object.entries(c).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
  }
  return { n, nCout, nDelai, ecartees, groupes };
};

// ── LE RELEVÉ (déplacé tel quel de l'écran Ventes, 3 nov.) ──────────────────
// Une ligne par vente FINALISÉE, hors masquées, datée depuis le 1er janvier de
// l'année d'avant : [plateforme, compte, tx|id, ts, vente €, achat € | null,
// frais € | null, titre, N° de la fiche, date de versement lue ('' pas lue) ; pour
// Leboncoin, eBay, Vestiaire : la date de la vente]. Vinted : par la règle de l'écran (`estFinalisee`,
// `estMasquee`, `montant`, `achat`, `frais`, `compte` passés par l'appelant) ;
// Leboncoin, eBay et Vestiaire : `autres` (= `ventesAutresBenefice`, déjà
// finalisées, en euros, prix d'achat par identité) et le titre de LA vente
// retrouvé par SON identifiant (`titreDe`).
// (11 nov., lot ventes-lot) `articles(o)` : les articles d'une vente EN LOT, [[titre, N°, part
// (centimes), achat (centimes|null), item]] (src/venteLot.js) — rangés en [10] de SA ligne, la vente
// reste UNE ligne (CA, frais, compte inchangés) ; `eclaterReleveLots` en fait une ligne par article
// pour les marges par modèle / marque / taille.
export const releveVentes = ({ vinted = [], estMasquee = () => false, estFinalisee = () => false, montant, achat, frais, compte, numero = () => '', versement = () => '', autres = [], titreDe = {}, an0, articles = () => null, fraisDetail = () => null }) => {
  const out = [];
  for (const o of (Array.isArray(vinted) ? vinted : [])) {
    if (!o || estMasquee(o) || !estFinalisee(o)) continue;
    const t = o.date ? Date.parse(o.date) : NaN;
    if (isNaN(t) || new Date(t).getFullYear() < an0) continue;
    const vers = versement(o);
    const ligne = ['Vinted', String(compte(o) || ''), String(o.transaction_id || ''), t, montant(o), achat(o), frais(o), String(o.title || '').slice(0, 90), String(numero(o) || ''), vers ? String(vers) : ''];
    const arts = articles(o);
    if (Array.isArray(arts) && arts.length > 1) ligne.push(arts);
    // (11 nov., agent2-argent-parrainage) [11] le détail des frais de la fiche, en centimes :
    // [boost, port payé par lui, commission, reste] (src/coutPlateformes.js `detailFraisFiche`) ;
    // seulement quand la fiche note des frais ([10] vaut alors `null` s'il n'y a pas de lot).
    const det = fraisDetail(o);
    if (Array.isArray(det) && det.length === 4) { if (ligne.length === 10) ligne.push(null); ligne.push(det); }
    out.push(ligne);
  }
  for (const x of (Array.isArray(autres) ? autres : [])) {
    if (!x || !isFinite(x.ts) || new Date(x.ts).getFullYear() < an0) continue;
    out.push([x.plateforme, '', x.id, x.ts, x.eur, x.achat, x.frais, String(titreDe[x.id] || '').slice(0, 90), String(x.num || ''), new Date(x.ts).toISOString()]);
  }
  return out;
};

// (11 nov., lot ventes-lot) UNE LIGNE PAR ARTICLE pour les marges par groupe : chaque article d'un
// lot prend SA part du prix (déjà répartie au centime, src/venteLot.js), son prix d'achat, et une part
// des frais au même prorata ; la somme des lignes vaut la vente (rien perdu, rien compté deux fois).
// Une ligne sans articles reste telle quelle. [10] d'une ligne éclatée = l'identifiant d'annonce.
export const eclaterReleveLots = (lignes) => {
  const out = [];
  for (const r of (Array.isArray(lignes) ? lignes : [])) {
    const arts = Array.isArray(r) && Array.isArray(r[10]) ? r[10] : null;
    if (!arts || arts.length < 2 || !arts.every((a) => Array.isArray(a) && Number.isSafeInteger(a[2]))) { out.push(Array.isArray(r) && Array.isArray(r[10]) ? r.slice(0, 10) : r); continue; }
    const total = arts.reduce((s, a) => s + a[2], 0);
    const fraisC = r[6] == null ? null : Math.round(Number(r[6]) * 100);
    let fraisReste = fraisC;
    arts.forEach((a, i) => {
      let f = null;
      if (fraisC != null) { f = i === arts.length - 1 ? fraisReste : (total > 0 ? Math.round(fraisC * a[2] / total) : 0); fraisReste -= f; }
      out.push([r[0], r[1], r[2], r[3], a[2] / 100, a[3] == null ? null : a[3] / 100, f == null ? null : f / 100, String(a[0] || '').slice(0, 90), String(a[1] || ''), r[9], String(a[4] || '')]);
    });
  }
  return out;
};
