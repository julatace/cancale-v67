// ═══════════════════════════════════════════════════════════════════════════
// LA RECHERCHE UNIQUE (3 novembre) — une loupe qui trouve tout
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « une seule loupe qui trouve tout ». Le N° de rangement garde son bloc
// « Tout sur le N° » (src/rechercheNumero.js, par `cleNum`) ; ce module cherche le
// RESTE dans un index préparé une fois :
//   · le pseudo de l'acheteur (e-mail de vente `email_sale_*` : pseudo + n° de
//     transaction ; champ de la commande s'il existe) ;
//   · le n° de suivi (bordereau de la vente `email_bord_*`, e-mail transporteur
//     `email_track_*`) et le code de retrait (`email_track_*`) ;
//   · le n° de transaction / de commande ;
//   · le titre (mots, sans accents, dans n'importe quel ordre).
// ⚠️ Le titre ne sert qu'à CHERCHER (une liste de résultats où il CHOISIT) —
//    jamais à relier : une ligne trouvée par son titre ouvre SA vente (sa
//    transaction), jamais celle d'une jumelle (§5). Un pseudo, un suivi ou un
//    code ne s'attache à une vente que par le n° de transaction écrit À CÔTÉ
//    (même e-mail, même bordereau) — jamais par ressemblance.
// Rapide sur des milliers d'articles : l'index (chaînes déjà normalisées) est
// mémorisé tant que les sources sont les mêmes objets (`indexMemo`) ; une
// frappe = un parcours linéaire sans allocation lourde.
// Module PUR, sans React : l'écran et `scripts/audit-recherche-unique.cjs`
// appellent les mêmes fonctions.
//
// (6 nov., v36 « loupe universelle ») LE POINT D'ENTRÉE UNIQUE : la même loupe
// trouve aussi
//   · les PAIRES (fiches N°, `vinted_annonce_numeros`) — une entrée par ANNONCE
//     (son id), jamais par titre : 50 fiches au même titre = 50 lignes ;
//   · les ANNONCES en ligne sans N° (le dressing lu, règle « en ligne ») — une
//     annonce qui a une fiche N° est CETTE paire (même id d'annonce), pas une
//     seconde ligne ;
//   · les FACTURES (n° de facture, article, acheteur, montant) ;
//   · un MONTANT (« 52 € », « 52,00 », « 52.5 ») : égalité au centime, jamais
//     « à peu près » ;
//   · la marque et la taille d'une annonce (écrites par Vinted à côté du titre).
// Les E-MAILS ne sont pas ici : ils sont cherchés côté base par le moteur de
// l'écran E-mails (api/_lib/reception-email.js `filtreRecherche`, sur toutes ses
// lignes) — pas de second moteur pour ce qui existe.
// Le N° EXACT reste à « Tout sur le N° » (src/rechercheNumero.js) : une fiche
// trouvée par son N° exact est marquée `exact` (l'écran la laisse au bloc).

const str = (v) => String(v == null ? '' : v);
export const normaliser = (s) => str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[ \s]+/g, ' ').trim();
// Une identité (suivi, code, transaction) : lettres et chiffres seulement, en majuscules.
export const alnum = (s) => str(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
// La clé d'un N° (la même que `cleNum` de l'app) : « 007 » = « 7 », « b125 » = « B125 ».
export const cleNumero = (v) => { let s = str(v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
// UN MONTANT TAPÉ, en centimes — seulement s'il se DIT montant : une virgule ou
// un point suivi de 1-2 chiffres, ou le signe « € » / « eur ». « 52 » seul est un
// N° (ou un mot du titre), jamais un prix. Rend null sinon.
export function montantCherche(q) {
  const s = str(q).trim().toLowerCase().replace(/\u00a0|\u202f/g, ' ');
  const m = /^(\d{1,6})(?:[.,](\d{1,2}))?\s*(€|eur|euros?)?$/.exec(s) || /^(?:€)\s*(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const dec = m[2], signe = m[3] || /^€/.test(s);
  if (dec == null && !signe) return null;
  return Number(m[1]) * 100 + (dec ? Number(dec.length === 1 ? dec + '0' : dec) : 0);
}
// Un montant lu (objet Vinted `{ amount }`, nombre, « 52,00 € ») en centimes ; null sinon.
export function centimes(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object') return centimes(v.amount != null ? v.amount : v.value);
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[\s\u00a0\u202f€]|eur/gi, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
const montantsDe = (...vs) => [...new Set(vs.map(centimes).filter((x) => x != null && x > 0))];
// Le nom de domaine d'une photo n'est pas l'article : seule l'adresse est gardée pour la vignette.
const urlPhoto = (p) => { if (!p) return ''; if (typeof p === 'string') return p; return str(p.url || p.full_size_url || (p.thumbnails && p.thumbnails[0] && p.thumbnails[0].url) || ''); };

export const TYPES = ['paire', 'vente', 'achat', 'colis', 'annonce', 'facture'];
export const MAX_PAR_GROUPE = 25;

// sources : { ventes, achats, pseudos: [{ tx, pseudo }], bordereaux: [{ tx, suivi }],
//             colis: [{ id, suivi, code, code2, lieu, art, status, sens, carrier, at }] }
//           (6 nov.) fiches: { [idAnnonce]: { numero, title, photo, price, buyPrice, accountId, brand, size } },
//           annonces: [{ id, title, brand, size, price, photo, uid }] (en ligne, lues) — `null` = pas lues,
//           factures: [{ id, number, refs (autres identités : n° de l'article), titre, acheteur, montant, date, pro }],
//           numerosTx: { [transaction]: N° } (la correction posée à la main, sinon transaction → annonce → fiche)
// Chaque source peut manquer (null/undefined) : on indexe ce qu'on a.
export function indexRecherche(sources) {
  const S = sources || {};
  const parTx = (rows, champ) => {
    const m = new Map();
    for (const r of Array.isArray(rows) ? rows : []) {
      const tx = alnum(r && r.tx); const v = str(r && r[champ]).trim();
      if (!tx || !v) continue;
      if (!m.has(tx)) m.set(tx, new Set());
      m.get(tx).add(v);
    }
    return m;
  };
  const pseudosTx = parTx(S.pseudos, 'pseudo');
  const numerosTx = S.numerosTx || null;
  const suivisTx = parTx(S.bordereaux, 'suivi');
  const entrees = [];
  const vus = new Set();
  const commande = (type, o) => {
    if (!o) return;
    const tx = alnum(o.transaction_id);
    const cle = type + ':' + (tx || entrees.length);
    if (tx && vus.has(cle)) return;
    vus.add(cle);
    const pseudos = new Set(pseudosTx.get(tx) || []);
    for (const p of [o.user_login, o.buyer && o.buyer.login, o.opposite_user && o.opposite_user.login]) if (str(p).trim()) pseudos.add(str(p).trim());
    const suivis = [...(suivisTx.get(tx) || [])].map(alnum).filter((x) => x.length >= 6);
    entrees.push({ type, cle, tx, o, titre: str(o.title), t: normaliser(o.title), pseudos: [...pseudos].map(normaliser).filter(Boolean), pseudosAff: [...pseudos], suivis, codes: [], date: str(o.date) });
    const ex = entrees[entrees.length - 1];
    ex.montants = montantsDe(o.price, o.total_item_price);
    ex.photo = urlPhoto(o.photo);
    const nt = tx && numerosTx ? (numerosTx instanceof Map ? numerosTx.get(tx) : numerosTx[tx]) : null;
    ex.numero = nt != null && str(nt).trim() ? str(nt).trim() : '';
  };
  for (const o of Array.isArray(S.ventes) ? S.ventes : []) commande('vente', o);
  for (const o of Array.isArray(S.achats) ? S.achats : []) commande('achat', o);
  // Les colis des e-mails de transporteur : une entrée par n° de suivi (le même
  // suivi reçu deux fois est UN colis), ou par ligne s'il n'y a pas de suivi.
  const parSuivi = new Map();
  for (const c of Array.isArray(S.colis) ? S.colis : []) {
    if (!c) continue;
    const s = alnum(c.suivi);
    const codes = [c.code, c.code2].map(alnum).filter((x) => x.length >= 3);
    const k = s ? 'colis:' + s : 'colis:' + str(c.id);
    const p = parSuivi.get(k);
    if (p) { for (const x of codes) if (!p.codes.includes(x)) p.codes.push(x); if (!p.titre && c.art) { p.titre = str(c.art); p.t = normaliser(c.art); } if (str(c.at) > p.date) { p.date = str(c.at); p.c = c; } continue; }
    const e = { type: 'colis', cle: k, tx: '', o: null, c, titre: str(c.art), t: normaliser(c.art), pseudos: [], pseudosAff: [], suivis: s.length >= 6 ? [s] : [], codes, date: str(c.at) };
    parSuivi.set(k, e); entrees.push(e);
  }
  for (const e of entrees) if (e.type === 'colis' && !e.montants) { e.montants = []; e.photo = ''; e.numero = ''; }
  // (6 nov.) LES PAIRES : une entrée par fiche (l'id de SON annonce). Une annonce
  // en ligne qui a une fiche N° est la MÊME paire (même id) : elle allume
  // « en ligne » sur la fiche, jamais une seconde ligne. `null` = dressing pas lu.
  const annoncesLues = Array.isArray(S.annonces) ? S.annonces : null;
  const parId = new Map();
  for (const a of annoncesLues || []) { if (a && a.id != null) parId.set(str(a.id), a); }
  const fiches = S.fiches && typeof S.fiches === 'object' ? S.fiches : null;
  const avecFiche = new Set();
  if (fiches) {
    for (const [id, f] of Object.entries(fiches)) {
      if (!f || typeof f !== 'object' || !str(f.numero).trim()) continue;
      const a = parId.get(str(id)) || null;
      avecFiche.add(str(id));
      const titre = str(f.title || (a && a.title));
      const marque = str(f.brand || (a && a.brand)), taille = str(f.size || (a && a.size));
      entrees.push({ type: 'paire', cle: 'paire:' + id, id: str(id), tx: '', o: null, f, a, titre, t: normaliser([titre, marque, taille].join(' ')),
        numero: str(f.numero).trim(), numK: cleNumero(f.numero), compte: str(f.accountId || (a && a.uid) || ''),
        enLigne: annoncesLues ? !!a : null, photo: urlPhoto(f.photo) || urlPhoto(a && a.photo),
        pseudos: [], pseudosAff: [], suivis: [], codes: [], montants: montantsDe(f.price, f.buyPrice, a && a.price), date: '' });
    }
  }
  for (const a of annoncesLues || []) {
    if (!a || a.id == null || avecFiche.has(str(a.id))) continue;
    const titre = str(a.title);
    entrees.push({ type: 'annonce', cle: 'annonce:' + a.id, id: str(a.id), tx: '', o: null, a, titre, t: normaliser([titre, a.brand, a.size].map(str).join(' ')),
      numero: '', compte: str(a.uid || ''), enLigne: true, photo: urlPhoto(a.photo),
      pseudos: [], pseudosAff: [], suivis: [], codes: [], montants: montantsDe(a.price), date: '' });
  }
  // (6 nov.) LES FACTURES : leur n° (identité), l'article, l'acheteur, le montant.
  for (const x of Array.isArray(S.factures) ? S.factures : []) {
    if (!x || (!x.id && !x.number)) continue;
    const titre = str(x.titre);
    const ach = str(x.acheteur).trim();
    entrees.push({ type: 'facture', cle: 'facture:' + (x.pro ? 'p:' : 'l:') + str(x.id || x.number), id: str(x.id), tx: alnum(x.tx), o: null, x, titre, t: normaliser(titre),
      numero: '', facture: str(x.number), nums: [x.number, ...(Array.isArray(x.refs) ? x.refs : [])].map(alnum).filter((v) => v.length >= 3), photo: '',
      pseudos: ach ? [normaliser(ach)] : [], pseudosAff: ach ? [ach] : [], suivis: [], codes: [], montants: montantsDe(x.montant), date: str(x.date) });
  }
  return { entrees, n: entrees.length, annoncesLues: !!annoncesLues };
}

// Mémo : le même index tant que les sources sont les MÊMES objets.
let _memo = { cles: null, index: null };
export function indexMemo(sources) {
  const S = sources || {};
  const cles = [S.ventes, S.achats, S.pseudos, S.bordereaux, S.colis, S.fiches, S.annonces, S.factures, S.numerosTx];
  if (_memo.cles && _memo.cles.length === cles.length && _memo.cles.every((x, i) => x === cles[i])) return _memo.index;
  const index = indexRecherche(S);
  _memo = { cles, index };
  return index;
}

// Le rang d'une trouvaille : une identité exacte d'abord, puis une identité
// partielle, le pseudo, enfin le titre.
const RANG = { code: 0, numero: 0.5, suivi: 1, transaction: 1, facture: 1, montant: 2, pseudo: 3, titre: 4 };

// Cherche `q` dans l'index. Rend { q, groupes: { paire: [...], vente: [...], … }, totaux, total }
// chaque résultat = { e (l'entrée), par: 'code'|'numero'|'suivi'|'transaction'|'facture'|'montant'|'pseudo'|'titre', exact, valeur }.
// `max` : un nombre (le même pour chaque groupe) ou { type: nombre } (« Voir les N autres »).
// `numero` : la clé du N° tapé (`lireNumeroCherche` de l'app) — une fiche de CE N° est `exact`.
export function chercherPartout(index, q, { max = MAX_PAR_GROUPE, numero = null } = {}) {
  const groupes = {}; for (const t of TYPES) groupes[t] = [];
  const totaux = {}; for (const t of TYPES) totaux[t] = 0;
  const qn = normaliser(q);
  const qa = alnum(q);
  if (!index || !qn) return { q: qn, groupes, totaux, total: 0 };
  const mots = qn.split(' ').filter(Boolean);
  const chiffres = /^\d+$/.test(qa);
  const cents = montantCherche(q);
  const kNum = numero ? cleNumero(numero) : '';
  const numeroLike = cents == null && /^[A-Z]{0,3}\d{1,6}$/.test(qa) && qa.length <= 7;
  const trouve = [];
  for (const e of index.entrees) {
    let par = null, exact = false, valeur = '';
    // Un MONTANT ne cherche QUE les montants : « 52,00 » n'est ni un code ni un suivi.
    if (cents != null) { if (e.montants && e.montants.includes(cents)) trouve.push({ e, par: 'montant', exact: true, valeur: cents, rang: RANG.montant - 0.5 }); continue; }
    if (e.numK && (kNum || numeroLike)) { if (kNum && e.numK === kNum) { par = 'numero'; exact = true; valeur = e.numero; } else if (numeroLike && e.numK.includes(qa)) { par = 'numero'; valeur = e.numero; } }
    if (!par && qa.length >= 4 && e.codes.length) { const c = e.codes.find((x) => x === qa); if (c) { par = 'code'; exact = true; valeur = c; } }
    if (!par && qa.length >= 6 && e.suivis.length) { const s = e.suivis.find((x) => x.includes(qa)); if (s) { par = 'suivi'; exact = s === qa; valeur = s; } }
    if (!par && chiffres && qa.length >= 5 && e.tx && e.tx.includes(qa)) { par = 'transaction'; exact = e.tx === qa; valeur = e.tx; }
    if (!par && qa.length >= 3 && e.nums && e.nums.length) { const n = e.nums.find((x) => x.includes(qa)); if (n) { par = 'facture'; exact = n === qa; valeur = e.facture; } }
    if (!par && qn.length >= 3 && e.pseudos.length) { const i = e.pseudos.findIndex((p) => p.includes(qn)); if (i >= 0) { par = 'pseudo'; exact = e.pseudos[i] === qn; valeur = e.pseudosAff[i]; } }
    if (!par && e.t && mots.every((m) => e.t.includes(m))) { par = 'titre'; }
    if (par) trouve.push({ e, par, exact, valeur, rang: RANG[par] - (exact ? 0.5 : 0) });
  }
  const numVal = (e) => { const m = /(\d+)$/.exec(e.numK || ''); return m ? Number(m[1]) : Infinity; };
  trouve.sort((a, b) => a.rang - b.rang || (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : 0) || numVal(a.e) - numVal(b.e));
  const maxDe = (t) => (max && typeof max === 'object' ? (Number.isFinite(max[t]) ? max[t] : MAX_PAR_GROUPE) : max);
  for (const t of trouve) { totaux[t.e.type] = (totaux[t.e.type] || 0) + 1; const g = groupes[t.e.type]; if (g && g.length < maxDe(t.e.type)) g.push(t); }
  return { q: qn, groupes, totaux, total: trouve.length };
}

// (6 nov.) LES SUGGESTIONS du champ vide : tirées de l'index (des objets lus,
// chacun par son identité) — les colis à retirer qui ont un code (le plus récent
// d'abord), puis les dernières ventes.
export function suggestions(index, { n = 3 } = {}) {
  const e = (index && index.entrees) || [];
  const parDate = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  const colis = e.filter((x) => x.type === 'colis' && x.codes.length && x.c && str(x.c.status) === 'available' && str(x.c.sens) !== 'sortant').sort(parDate).slice(0, n)
    .map((x) => ({ e: x, par: 'code', exact: true, valeur: x.codes[0], rang: 0 }));
  const ventes = e.filter((x) => x.type === 'vente').sort(parDate).slice(0, n).map((x) => ({ e: x, par: 'recent', exact: false, valeur: '', rang: 0 }));
  return { colis, ventes };
}

// Où mène un résultat (l'écran existant, par IDENTITÉ) : { tab, cible }.
export function destinationResultat(r) {
  const e = r && r.e; if (!e) return null;
  if (e.type === 'vente') return e.tx ? { tab: 'ventes', cible: { type: 'vente', tx: e.tx } } : { tab: 'ventes', cible: null };
  if (e.type === 'achat') return e.tx ? { tab: 'achats', cible: { type: 'achat', tx: e.tx } } : { tab: 'achats', cible: null };
  if (e.type === 'colis') {
    const c = e.c || {};
    if (str(c.sens) === 'sortant') return { tab: 'cat_bord', cible: { type: 'colonne', colonne: 'partis' } };
    // (6 nov.) Trouvé par SON CODE : la carte de CE n° de suivi s'ouvre ET son code
    // passe « En grand » (le comptoir, le casier).
    return { tab: 'cat_bord', cible: str(c.suivi).trim() ? { type: 'retrait', suivi: str(c.suivi).trim(), tx: '', ...(r.par === 'code' ? { grand: true } : {}) } : { type: 'colonne', colonne: 'retirer' } };
  }
  // (6 nov.) Une paire ouvre SA fiche (son N°, `FichePaire`) ; une annonce sans N°,
  // SA carte dans Annonces (l'id de l'annonce) ; une facture, Factures sur SON n°.
  if (e.type === 'paire') return { fiche: e.numero };
  if (e.type === 'annonce') return { tab: 'cat_annonces', cible: { type: 'annonce', id: e.id } };
  // Une facture saisie dans l'app : la liste cherchée sur SON n°. Une facture Pro : la liste
  // « Factures Pro émises », en tête de l'écran (la recherche de l'écran ne la voit pas).
  if (e.type === 'facture') return { tab: 'invoices', facture: e.x && e.x.pro ? '' : (e.facture || '') };
  return null;
}
