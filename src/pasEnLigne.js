// ═══════════════════════════════════════════════════════════════════════════
// « ACHETÉS MAIS PAS ENCORE EN LIGNE » (11 nov. 2026, lot pas-en-ligne)
// docs/passation/2026-11-11-pas-en-ligne.md
// ═══════════════════════════════════════════════════════════════════════════
// Julien (demande validée, « compliqué à mettre en place » : JUSTE plutôt que
// vite) : les articles achetés ou rangés depuis plus de X jours (réglable) qui
// ne sont en ligne sur AUCUN site — PROUVÉ.
//
// ⚠️ L'IDENTITÉ (§5) — jamais le titre, jamais la ressemblance :
//   · un article qui porte un N° (achat hors plateforme numéroté, ligne de stock
//     importée) est EN LIGNE si une annonce actuelle (n'importe quel site, en
//     ligne, à confirmer ou masquée) porte CE N° (`cle`, « 007 » = « 7 ») ;
//   · un achat Vinted (sans N° avant sa mise en ligne) est EN LIGNE si une
//     annonce actuelle est RELIÉE à SA transaction (`buyFromId`, le lien posé
//     par SON clic). Un achat déjà relié à une annonce ou à une vente, quelle
//     qu'elle soit, a déjà été mis en ligne : il n'est pas ici (le devenir d'une
//     annonce supprimée appartient à « À trancher », src/cycleArticle.js).
// ⚠️ « PAS EN LIGNE » SE PROUVE, il ne se déduit pas d'une absence :
//   1. TOUTES les lectures de ses comptes et sites ont répondu, sont COMPLÈTES
//      et ont moins de 24 h (la règle <enligne-regle>) — sinon l'article est
//      « à confirmer », jamais compté, et le manque est NOMMÉ (« compte X pas
//      relu depuis 3 j ») ;
//   2. aucune annonce actuelle ne PEUT être lui : pour un article à N°, une
//      annonce sans N° pourrait l'être ; pour un achat sans N°, toute annonce
//      qui n'est reliée à aucun achat pourrait l'être (mesuré le 11 nov. sur
//      sa base : 10 fiches sur 564 reliées à un achat). Ces annonces sont
//      comptées et dites, avec le geste qui lève le doute (les relier).
// « Pas su » n'est pas « non » : lecture des annonces ratée ⇒ `su: false`,
// l'écran dit « — » et rien n'est listé.
//
// Module PUR (aucun accès au navigateur ni à la base) : Ma journée, l'écran
// Achats et scripts/audit-pas-en-ligne.cjs exécutent les MÊMES fonctions (§11).

export const JOUR_MS = 24 * 3600e3;
export const FRAIS_MS = 24 * 3600e3;          // la borne de « en ligne » (ENLIGNE_FRAIS_MS, LBC_FRAIS_MS)
export const SEUILS_PAS_EN_LIGNE = [7, 14, 30, 60];
export const SEUIL_DEFAUT = 14;
export const CLE_SEUIL_PAS_EN_LIGNE = 'vrm_pas_en_ligne_seuil';
export const seuilValide = (s) => (SEUILS_PAS_EN_LIGNE.includes(Number(s)) ? Number(s) : SEUIL_DEFAUT);

// « Ouvrir l'achat » depuis la liste : l'écran Achats le lit à son montage (une fois).
export const DEMANDE_OUVRIR_ACHAT = { id: null, at: 0 };

const arr = (a) => (Array.isArray(a) ? a : []);
const str = (v) => String(v == null ? '' : v).trim();
const cleDefaut = (n) => {
  const s = String(n == null ? '' : n).toUpperCase().replace(/[\s\-_.]/g, '').replace(/^N[°O]?(?=\d)/, '');
  const m = /^([A-Z]*)0*(\d+)$/.exec(s);
  return m ? m[1] + m[2] : s;
};
const montant = (v) => {
  if (v == null || v === '') return null;
  const x = typeof v === 'object' ? v.amount : v;
  const n = Number(String(x).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
// Une date « AAAA-MM-JJ » est un jour local (midi : jamais la veille par le fuseau).
const dateMs = (d) => {
  if (d == null || d === '') return null;
  if (typeof d === 'number') return Number.isFinite(d) ? (d < 1e12 ? d * 1000 : d) : null;
  const s = String(d);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + 'T12:00:00') : Date.parse(s);
  return Number.isFinite(t) ? t : null;
};
const lotDeTitre = (t) => {
  const s = str(t);
  if (!/^lot\b/i.test(s)) return { lot: false, n: null };
  const m = /^lot\s+(?:de\s+)?(\d{1,3})\b/i.exec(s);
  const n = m ? Number(m[1]) : null;
  return { lot: true, n: n && n >= 2 ? n : null };
};
const ANNULE = /annul|cancel|refus|rembours|retour|suspend|[ée]chou|failed/i;

// ── 1. LES ARTICLES À JUGER (depuis les données brutes) ─────────────────────
//   hors      : `vinted_offvinted_buys` [{ id, title, price, date, numero, photo, createdAt }]
//   masquesHors : Set d'id (doubles masqués, `vrm_achats_hors_masques`)
//   importes  : `vrm_stock_importe` [{ id, numero, titre, prix, date, emplacement, createdAt, annonce? }]
//   achats    : achats Vinted lus [{ transaction_id, title, date, status, photo, prix }] (masqués déjà retirés) ;
//               `null` = pas lus (aucun achat Vinted n'est alors jugé : dit `achatsSu: false`)
//   liens     : Map tx → nombre de fiches/ventes reliées (`liensParAchat`)
//   connus    : Set de clés N° qui ont (ou ont eu) une annonce Vinted (`vinted_annonce_numeros`)
//   vendus    : Set de clés N° prouvées vendues (`vrm_stock_vendus`)
//   prixParNum : `vinted_buyprice_by_num` (SA saisie) — repli du prix d'un article à N°
// Rend { candidats, achatsSu, sansNumeroHors } ; candidat :
//   { id, sorte: 'num'|'achat', source: 'hors'|'import'|'vinted', cle, numero, tx, titre, depuis (ms|null),
//     depuisAuMoins, prix, photo, ou, lot: null|{ n, relies, reste }, doublon }
export function candidatsPasEnLigne({ hors = [], masquesHors = null, importes = [], achats = null, liens = null, connus = null, vendus = null,
  prixParNum = null, cle = cleDefaut } = {}) {
  const parCle = new Map(), parTx = new Map();
  const out = [];
  let sansNumeroHors = 0;
  const prixNum = (num) => (prixParNum && typeof prixParNum === 'object' ? montant(prixParNum[str(num)]) : null);
  const exclu = (k) => (connus && connus.has(k)) || (vendus && vendus.has(k));
  const poserNum = (c) => {
    const deja = parCle.get(c.cle);
    if (deja) {
      // Deux saisies sous le même N° : UN article (le N° est l'identité), dit en double.
      deja.doublon = true;
      if (c.depuis != null && (deja.depuis == null || c.depuis < deja.depuis)) deja.depuis = c.depuis;
      return;
    }
    parCle.set(c.cle, c); out.push(c);
  };
  for (const b of arr(hors)) {
    if (!b || b.id == null) continue;
    if (masquesHors && masquesHors.has(String(b.id))) continue;
    const k = b.numero != null && str(b.numero) ? cle(b.numero) : '';
    if (!k) {
      // Sans N° : son identité est l'achat lui-même ; il ne se relie à une annonce que par un N°.
      sansNumeroHors++;
      out.push({ id: 'hors:' + b.id, achatId: String(b.id), sorte: 'achat', source: 'hors', cle: '', numero: '', tx: '', titre: str(b.title),
        depuis: dateMs(b.date) ?? dateMs(b.createdAt), depuisAuMoins: !dateMs(b.date) && !!dateMs(b.createdAt),
        prix: montant(b.price), photo: !!b.photo, ou: '', lot: null, doublon: false });
      continue;
    }
    if (exclu(k)) continue;
    poserNum({ id: 'hors:' + b.id, achatId: String(b.id), sorte: 'num', source: 'hors', cle: k, numero: str(b.numero), tx: '', titre: str(b.title),
      depuis: dateMs(b.date) ?? dateMs(b.createdAt), depuisAuMoins: !dateMs(b.date) && !!dateMs(b.createdAt),
      prix: montant(b.price) ?? prixNum(b.numero), photo: !!b.photo, ou: '', lot: null, doublon: false });
  }
  for (const s of arr(importes)) {
    if (!s || s.id == null) continue;
    const k = s.numero != null && str(s.numero) ? cle(s.numero) : '';
    if (!k || exclu(k) || str(s.annonce)) continue;          // reliée à une annonce par SON clic : déjà en ligne une fois
    const d = dateMs(s.date);
    // Sans date du fichier : présente AU MOINS depuis l'import.
    poserNum({ id: 'import:' + s.id, achatId: '', sorte: 'num', source: 'import', cle: k, numero: str(s.numero), tx: '', titre: str(s.titre),
      depuis: d ?? dateMs(s.createdAt), depuisAuMoins: d == null && dateMs(s.createdAt) != null,
      prix: montant(s.prix) ?? prixNum(s.numero), photo: false, ou: str(s.emplacement), lot: null, doublon: false });
  }
  const achatsSu = Array.isArray(achats);
  for (const a of arr(achats)) {
    const tx = a && a.transaction_id != null ? str(a.transaction_id) : '';
    if (!tx || parTx.has(tx) || ANNULE.test(str(a.status))) continue;
    const n = (liens && liens.get(tx)) || 0;
    const l = lotDeTitre(a.title);
    let lot = null;
    if (n > 0) {
      // Déjà relié : mis en ligne une fois. Un lot au nombre écrit garde ce qui reste ;
      // un lot sans nombre ne se devine pas.
      if (!l.lot || l.n == null || n >= l.n) continue;
      lot = { n: l.n, relies: n, reste: l.n - n };
    } else if (l.lot) lot = { n: l.n, relies: 0, reste: l.n };
    const c = { id: 'vinted:' + tx, achatId: '', sorte: 'achat', source: 'vinted', cle: '', numero: '', tx, titre: str(a.title),
      depuis: dateMs(a.date), depuisAuMoins: false, prix: montant(a.prix), photo: a.photo || null, ou: '', lot, doublon: false };
    parTx.set(tx, c); out.push(c);
  }
  return { candidats: out, achatsSu, sansNumeroHors };
}

// ── 2. CE QUE LES LECTURES DISENT DE CHAQUE COMPTE ──────────────────────────
// Une source : { plateforme, nom, ok (la lecture a répondu), lu (ms|null : la
// lecture COMPLÈTE la plus récente), complet (false = lue en partie) }.
// Rend { plateforme, nom, etat: 'ok'|'ratee'|'jamais'|'vieille'|'partielle', lu, jours }.
export function etatSource(s, maintenant = Date.now()) {
  const base = { plateforme: str(s && s.plateforme), nom: str(s && s.nom) || str(s && s.plateforme), lu: null, jours: null };
  if (!s || s.ok !== true) return { ...base, etat: 'ratee' };
  const lu = Number.isFinite(s.lu) ? s.lu : null;
  if (lu == null) return { ...base, etat: 'jamais' };
  const age = Number(maintenant) - lu;
  const jours = Math.max(0, Math.floor(age / JOUR_MS));
  if (s.complet === false) return { ...base, etat: 'partielle', lu, jours };
  if (!(age <= FRAIS_MS)) return { ...base, etat: 'vieille', lu, jours };
  return { ...base, etat: 'ok', lu, jours };
}

// ── 3. LE JUGEMENT ──────────────────────────────────────────────────────────
//   candidats : la sortie de `candidatsPasEnLigne`
//   presents  : les annonces ACTUELLES, une par article (`annoncesActuelles`,
//               toutes plateformes, en ligne + à confirmer + masquées) :
//               [{ cles: [N°], txs: [tx des achats reliés] }] ; `null` = pas su
//   sources   : [{ plateforme, nom, ok, lu, complet }] (une par compte et site lus)
//   seuilJours, maintenant
// Rend { su, seuil, liste, aConfirmer, recents, sansDate, enLigne, manques } :
//   liste      : PROUVÉS pas en ligne depuis au moins `seuil` jours, le plus ancien d'abord
//   aConfirmer : au moins `seuil` jours, preuve manquante ; `raisons` nommées
//   manques    : { sources: [état ≠ ok], sansNumero: n, pasRelies: n }
export function jugerPasEnLigne({ candidats, presents, sources = [], seuilJours = SEUIL_DEFAUT, maintenant = Date.now(), cle = cleDefaut } = {}) {
  const seuil = seuilValide(seuilJours);
  const C = arr(candidats);
  const etats = arr(sources).map((s) => etatSource(s, maintenant));
  const sourcesKO = etats.filter((e) => e.etat !== 'ok');
  const vide = { su: false, seuil, liste: [], aConfirmer: [], recents: 0, sansDate: 0, enLigne: 0, manques: { sources: sourcesKO, sansNumero: 0, pasRelies: 0 } };
  if (!Array.isArray(presents)) return vide;
  const presentCles = new Set(), presentTxs = new Set();
  for (const p of presents) {
    for (const k of arr(p && p.cles)) { const kk = cle(k); if (kk) presentCles.add(kk); }
    for (const t of arr(p && p.txs)) if (str(t)) presentTxs.add(str(t));
  }
  // Les annonces actuelles que RIEN ne rattache à un achat connu : ni un achat relié, ni le N°
  // d'un article à juger. Sans N° : elle pourrait être n'importe quel article.
  const clesCandidats = new Set(C.filter((c) => c.sorte === 'num').map((c) => c.cle));
  let sansNumero = 0, pasRelies = 0;
  for (const p of presents) {
    const cs = arr(p && p.cles).map(cle).filter(Boolean);
    const rattachee = arr(p && p.txs).some((t) => str(t)) || cs.some((k) => clesCandidats.has(k));
    if (rattachee) continue;
    pasRelies++;
    if (!cs.length) sansNumero++;
  }
  const liste = [], aConfirmer = [];
  let recents = 0, sansDate = 0, enLigne = 0;
  for (const c of C) {
    if (!c) continue;
    if (c.sorte === 'num' && presentCles.has(c.cle)) { enLigne++; continue; }
    if (c.sorte === 'achat' && c.tx && !c.lot && presentTxs.has(c.tx)) { enLigne++; continue; }
    if (c.depuis == null) { sansDate++; continue; }
    const jours = Math.max(0, Math.floor((Number(maintenant) - c.depuis) / JOUR_MS));
    if (jours < seuil) { recents++; continue; }
    const raisons = sourcesKO.map((e) => ({ sorte: 'source', ...e }));
    if (c.sorte === 'num' && sansNumero > 0) raisons.push({ sorte: 'sans-numero', n: sansNumero });
    if (c.sorte === 'achat' && pasRelies > 0) raisons.push({ sorte: 'pas-relie', n: pasRelies });
    const x = { ...c, jours };
    if (raisons.length) aConfirmer.push({ ...x, raisons }); else liste.push(x);
  }
  const tri = (a, b) => (a.depuis - b.depuis) || String(a.cle || a.tx || a.id).localeCompare(String(b.cle || b.tx || b.id), 'fr', { numeric: true });
  liste.sort(tri); aConfirmer.sort(tri);
  return { su: true, seuil, liste, aConfirmer, recents, sansDate, enLigne, manques: { sources: sourcesKO, sansNumero, pasRelies } };
}

// ── 4. LES ANNONCES ACTUELLES → `presents` ──────────────────────────────────
// `articles` : `annoncesActuelles(...).articles` ({ cle, aussi, ids: ['v:123', 'leboncoin:12', …] }) ;
// `fiches` : `vinted_annonce_numeros` ; `horsArticles` : annonces lues mais hors de
// `articles` faute d'identité (eBay/Leboncoin/Vestiaire sans N°, état non dit) — chacune
// compte comme une annonce sans N° ni achat relié.
// Un article est relié à un achat par SES annonces Vinted (`buyFromId` de leur fiche) ou par
// une fiche Vinted qui porte SON N° (la même paire, publiée ailleurs).
export function presentsDe({ articles, fiches = {}, horsArticles = 0, cle = cleDefaut } = {}) {
  if (!Array.isArray(articles)) return null;
  const txParCle = new Map();
  for (const f of Object.values(fiches || {})) {
    if (!f || f.buyFromId == null || !str(f.buyFromId)) continue;
    const k = f.numero != null ? cle(f.numero) : '';
    if (!k) continue;
    if (!txParCle.has(k)) txParCle.set(k, new Set());
    txParCle.get(k).add(str(f.buyFromId));
  }
  const out = [];
  for (const a of articles) {
    if (!a) continue;
    const cles = [a.cle, ...arr(a.aussi)].map((k) => (k ? cle(k) : '')).filter(Boolean);
    const txs = new Set();
    for (const id of arr(a.ids)) {
      const m = /^v:(.+)$/.exec(String(id)); if (!m) continue;
      const f = fiches && fiches[m[1]];
      if (f && f.buyFromId != null && str(f.buyFromId)) txs.add(str(f.buyFromId));
    }
    for (const k of cles) for (const t of (txParCle.get(k) || [])) txs.add(t);
    out.push({ cles, txs: [...txs] });
  }
  for (let i = 0; i < Math.max(0, Number(horsArticles) || 0); i++) out.push({ cles: [], txs: [] });
  return out;
}
