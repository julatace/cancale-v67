// ═══════════════════════════════════════════════════════════════════════════
// LES DEUX REGISTRES D'UNE MICRO-ENTREPRISE D'ACHAT-REVENTE (3 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (3 nov.) : le LIVRE DES RECETTES et le REGISTRE DES ACHATS, pour une
// période (une année ou un mois), en PDF et en tableur, depuis Comptabilité.
//
// AUCUNE RÈGLE DE VENTE ICI (§5 « une seule règle par notion ») :
//   · une RECETTE est une ligne de `ventesDeclarables` (App.jsx) — la règle du
//     CA déclaré : finalisée, datée au jour du VERSEMENT pour Vinted et
//     Vestiaire, de la vente pour Leboncoin, de la commande pour eBay ; eBay au
//     montant REÇU (`montantRecuEbay`), Vestiaire seulement au montant sûr ;
//     comptes exclus déjà dehors. Ce module RANGE ses lignes par période
//     (`l.ym`, le mois que la règle leur donne) ; une vente « à dater » (sans
//     date de versement) n'est dans AUCUNE période : elle est listée à part,
//     jamais glissée dedans ; une vente au montant illisible est une ligne
//     « sans montant » (le total dit « au moins »), jamais 0 €.
//   · un ACHAT est un achat capté sur Vinted (`my_orders` achetés), hors
//     annulés/remboursés (`achatAnnule`, la règle de « Dépensé » dans Achats),
//     plus les achats HORS PLATEFORME qu'il a saisis. Le montant :
//       1. le REÇU de l'achat, relié par SON n° de transaction, quand sa
//          ventilation tombe juste (`montantPropose`, src/prixAchatPropose.js) ;
//       2. sinon les prix d'achat qu'IL a saisis sur les fiches reliées à CET
//          achat (`buyFromId`, son clic) ;
//       3. sinon le prix de l'article lu sur Vinted — « article seul » : le
//          port et les frais manquent, le total dit « au moins » ;
//       4. sinon rien (autre devise, prix illisible) : « sans montant ».
//     JAMAIS deviné. Le N° est celui des fiches reliées à cet achat par
//     identité (`buyFromId` = son n° de transaction), jamais par titre.
//   · (5 nov., « ce qui reste » des fournisseurs) un ACHAT EN GROS (registre
//     `vrm_fournisseurs`, src/fournisseurs.js — l'appelant passe `lireRegistre`)
//     est UNE ligne : sa date, son fournisseur (la personne QU'IL a créée), son
//     nombre de paires, son montant total + les frais QU'IL a saisis sur
//     l'achat (« dont frais » à part). JAMAIS la somme des parts posées sur ses
//     paires : une fiche reliée à un achat en gros (`buyGros`) ne prête jamais
//     son prix à une autre ligne (un achat Vinted relié par `buyFromId` à une
//     fiche qui porte aussi `buyGros` ne prend pas ce prix comme « saisi »).
//     Un achat hors plateforme RATTACHÉ à un fournisseur (`hors`) reste UNE
//     ligne (son prix saisi), au nom de ce fournisseur — jamais ajouté à un
//     achat en gros. Un achat hors plateforme dont le N° est une paire reliée à
//     un achat en gros est gardé (on ne jette rien) et dit « à vérifier ».
//   · Les DÉPENSES (boîte à dépenses : emballage, envois, abonnements) ne sont
//     PAS des achats de marchandise : elles n'entrent pas dans le registre des
//     achats (la catégorie « Achats de stock » a été retirée le 3 nov. pour ne
//     pas compter deux fois le prix d'achat).
// Totaux = somme des lignes ; la couverture se dit (« N lignes sans montant »,
// « au moins ») — jamais un total partiel présenté comme complet (§5). Jamais
// « encaissé » (§5).
// ─────────────────────────────────────────────────────────────────────────────
import { montantPropose } from './prixAchatPropose.js';
import { jourParis, moisParis } from './dateParis.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
// (9 nov.) + le TRIMESTRE (« AAAA-T1 » … « AAAA-T4 ») pour « Exporter pour mon
// comptable » : janvier-mars, avril-juin, juillet-septembre, octobre-décembre.
export const PERIODE_OK = /^\d{4}(-(0[1-9]|1[0-2]|T[1-4]))?$/;
const TRIM = /^(\d{4})-T([1-4])$/;
export const libellePeriode = (p) => {
  const s = String(p || '');
  if (/^\d{4}$/.test(s)) return `année ${s}`;
  const t = TRIM.exec(s);
  if (t) return `${t[2] === '1' ? '1er' : t[2] + 'e'} trimestre ${t[1]}`;
  const [y, m] = s.split('-').map(Number);
  return y && m ? `${MOIS[m - 1]} ${y}` : s;
};
// Les mois (AAAA-MM) d'une période, dans l'ordre.
export const moisDePeriode = (periode) => {
  const s = String(periode || '');
  if (!PERIODE_OK.test(s)) return [];
  const y = s.slice(0, 4);
  const t = TRIM.exec(s);
  const de = t ? (Number(t[2]) - 1) * 3 + 1 : (s.length === 4 ? 1 : Number(s.slice(5, 7)));
  const a = t ? de + 2 : (s.length === 4 ? 12 : de);
  const out = []; for (let m = de; m <= a; m++) out.push(`${y}-${String(m).padStart(2, '0')}`);
  return out;
};
export const dansPeriode = (ym, periode) => !!ym && !!periode && moisDePeriode(periode).includes(String(ym));
const ymLocal = (t) => moisParis(t);   // (11 nov.) mois de PARIS (même règle que le CA déclaré)
export const jourFr = (t) => { const j = t == null ? '' : jourParis(t); return j ? `${j.slice(8, 10)}/${j.slice(5, 7)}/${j.slice(0, 4)}` : ''; };
const cts = (x) => (x == null || x === '' || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100));
const centimesTexte = (v) => {
  if (v == null) return null;
  const t = String(v).replace(/\s|€/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const c = Math.round(Number(t) * 100);
  return Number.isSafeInteger(c) ? c : null;
};
// La référence d'une recette : l'identifiant de la vente sans son préfixe.
const referenceDe = (id) => String(id || '').replace(/^(vinted|lbc|ebay|vestiaire):/, '');
// La date d'une ligne de `ventesDeclarables` (App.jsx) : le VERSEMENT pour Vinted et
// Vestiaire ; la vente (Leboncoin, versement pas capté) ; la commande payée (eBay).
export const DATEE_AU_VERSEMENT = new Set(['Vinted', 'Vestiaire']);
const triChrono = (a, b) => (a.ts == null ? Infinity : a.ts) - (b.ts == null ? Infinity : b.ts) || String(a.id).localeCompare(String(b.id));

// ── LE LIVRE DES RECETTES ───────────────────────────────────────────────────
// decl    : la sortie de `ventesDeclarables` (null = pas su ⇒ null)
// periode : 'AAAA' ou 'AAAA-MM'
// numDe(id), compteDe(id) : le N° et le compte d'une vente PAR SON IDENTITÉ ('' inconnu)
// manque  : ce qui n'a pas pu être lu (noms), dit à côté du total
export function livreDesRecettes({ decl, periode, numDe = () => '', compteDe = () => '', manque = [] } = {}) {
  if (!decl || !Array.isArray(decl.lignes) || !PERIODE_OK.test(String(periode || ''))) return null;
  const ligne = (l, montant, raison) => ({
    id: String(l.id), ts: l.ts == null ? null : l.ts, date: jourFr(l.ts), montant, plateforme: l.plateforme,
    // (11 nov.) Les frais de la plateforme quand ils sont LUS (eBay) ; sinon null (« pas su », jamais 0).
    frais: Number.isFinite(l.frais) ? l.frais : null,
    reglement: `Versement ${l.plateforme}`, reference: referenceDe(l.id), num: String(numDe(String(l.id)) || ''),
    compte: String(compteDe(String(l.id)) || ''), titre: String(l.titre || ''), raison: raison || '',
    // (9 nov.) Ce que la date de la ligne EST, selon la règle de `ventesDeclarables` :
    // le versement (Vinted, Vestiaire) ; la vente (Leboncoin) ; la commande (eBay).
    // La date de vente d'une ligne Vinted est celle de SA commande (`dateVente`).
    tsVersement: DATEE_AU_VERSEMENT.has(l.plateforme) ? (l.ts == null ? null : l.ts) : null,
    tsVente: DATEE_AU_VERSEMENT.has(l.plateforme) ? (Number.isFinite(Date.parse(l.dateVente || '')) ? Date.parse(l.dateVente) : null) : (l.ts == null ? null : l.ts),
  });
  const lignes = [], horsPeriode = [];
  for (const l of decl.lignes) {
    if (!l || !dansPeriode(l.ym, periode)) continue;
    lignes.push(ligne(l, Number(l.eur), ''));
  }
  // Une vente dont l'argent ne se lit pas : une ligne SANS montant si sa date
  // tombe dans la période, sinon listée à part (jamais 0 €, jamais tue).
  for (const x of (decl.ecartees || [])) {
    if (!x || !x.manque) continue;
    if (x.ts != null && Number.isFinite(x.ts)) { if (dansPeriode(ymLocal(x.ts), periode)) lignes.push(ligne(x, null, x.raison || 'montant pas lu')); }
    else horsPeriode.push({ ...ligne(x, null, x.raison || 'montant pas lu'), date: '' });
  }
  for (const a of (decl.aDater || [])) if (a) horsPeriode.push({ ...ligne({ ...a, ts: null }, Number(a.eur), 'à dater'), date: '' });
  lignes.sort(triChrono);
  horsPeriode.sort((a, b) => String(a.plateforme).localeCompare(String(b.plateforme)) || String(a.id).localeCompare(String(b.id)));
  const total = lignes.reduce((s, l) => s + (l.montant == null ? 0 : Math.round(l.montant * 100)), 0) / 100;
  const sansMontant = lignes.filter((l) => l.montant == null).length;
  const manques = (Array.isArray(manque) ? manque : []).filter(Boolean).map(String);
  return { type: 'recettes', periode: String(periode), lignes, n: lignes.length, total, sansMontant, horsPeriode, manque: manques, complet: !sansMontant && !manques.length };
}

// ── LE REGISTRE DES ACHATS ─────────────────────────────────────────────────
// Un achat qui n'a rien coûté : la règle de « Dépensé » (écran Achats).
export const achatAnnule = (o) => /annul|rembours|refus/i.test(String((o && o.status) || ''));
// achats       : achats Vinted captés (chacun peut porter `compte`) ; null = pas su
// hors         : achats hors plateforme saisis ({ id, title, price, date, source, numero })
// fiches       : `vinted_annonce_numeros` (N°, buyPrice, buyFromId)
// ventilationDe(tx) : la ventilation du reçu de CET achat (ou null)
// exclu(o)     : l'achat vient d'un compte écarté des totaux
// montantHors(b), sourceHors(b) : les règles de l'écran Achats pour un achat saisi
// gros         : `lireRegistre(vrm_fournisseurs)` ({ personnes, achats, hors }) ou null
// cleNum(n)    : l'identité d'un N° (« 007 » = « 7 »)
const cleNumDefaut = (n) => { const s = String(n == null ? '' : n).trim().toUpperCase().replace(/[\s\-_.]/g, ''); return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s; };
const lienGros = (e) => (e && e.buyGros && typeof e.buyGros === 'object' && String(e.buyGros.id || '').trim() ? String(e.buyGros.id).trim() : '');
export function registreDesAchats({ achats = null, hors = [], fiches = null, ventilationDe = () => null, exclu = null, periode, manque = [], montantHors = null, sourceHors = null, gros = null, cleNum = cleNumDefaut } = {}) {
  if (!PERIODE_OK.test(String(periode || ''))) return null;
  // Les fiches reliées à un achat PAR SON CLIC : n° de transaction → fiches ;
  // id d'achat en gros → fiches (`buyGros`).
  const parTx = new Map(), parGros = new Map(), numsGros = new Set();
  for (const [, e] of Object.entries(fiches && typeof fiches === 'object' ? fiches : {})) {
    if (!e) continue;
    const g = lienGros(e);
    if (g) {
      parGros.set(g, [...(parGros.get(g) || []), e]);
      const kn = cleNum(e.numero); if (kn) numsGros.add(kn);
    }
    if (e.buyFromId == null || String(e.buyFromId).trim() === '') continue;
    const k = String(e.buyFromId).trim();
    parTx.set(k, [...(parTx.get(k) || []), e]);
  }
  const G = gros && typeof gros === 'object' ? gros : null;
  const personnes = G && G.personnes && typeof G.personnes === 'object' ? G.personnes : {};
  const rattaches = G && G.hors && typeof G.hors === 'object' ? G.hors : {};
  const nomFournisseur = (id) => { const p = personnes[id]; return p && String(p.nom || '').trim() ? String(p.nom).trim() : ''; };
  const lignes = [], sansDate = [], vus = new Set();
  let exclues = 0;
  for (const o of (Array.isArray(achats) ? achats : [])) {
    if (!o) continue;
    if (exclu && exclu(o)) { exclues += 1; continue; }
    if (achatAnnule(o)) continue;
    const tx = o.transaction_id != null ? String(o.transaction_id) : '';
    const id = 'vinted:' + (tx || ('?' + lignes.length + '-' + sansDate.length));
    if (tx && vus.has(id)) continue;
    vus.add(id);
    const liees = tx ? (parTx.get(tx) || []) : [];
    const nums = liees.map((e) => String(e.numero == null ? '' : e.numero).trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    let montant = null, source = '', raison = '';
    // (9 nov.) Le COÛT SAISI par lui : les prix d'achat des fiches reliées à CET
    // achat par SON clic (`buyFromId`), tous présents ; sinon null (« vide »).
    const saisisC = liees.map((e) => (lienGros(e) ? null : centimesTexte(e.buyPrice)));
    const saisi = liees.length && saisisC.every((c) => c != null) ? saisisC.reduce((t, c) => t + c, 0) / 100 : null;
    const m = montantPropose(o, tx ? ventilationDe(tx) : null);
    if (m && m.source === 'recu') { montant = m.centimes / 100; source = 'recu'; }
    else {
      // Un prix posé par un achat en gros (`buyGros`) appartient à CET achat en
      // gros (compté par son total) : jamais un « saisi » de cet achat Vinted.
      const saisis = liees.map((e) => (lienGros(e) ? null : centimesTexte(e.buyPrice)));
      if (liees.length && saisis.every((c) => c != null)) { montant = saisis.reduce((s, c) => s + c, 0) / 100; source = 'saisi'; }
      else if (m) { montant = m.centimes / 100; source = 'article'; }
      else raison = String((o.price && o.price.currency_code) || 'EUR').toUpperCase() !== 'EUR' ? 'autre devise' : 'prix pas lu';
    }
    const ts = Date.parse(o.date || '');
    const l = { id, ts: Number.isFinite(ts) ? ts : null, date: jourFr(ts), plateforme: 'Vinted', fournisseur: 'Vinted', montant, source, raison, saisi,
      reglement: 'Paiement Vinted', reference: tx, num: nums.join(' + '), compte: String(o.compte || ''), titre: String(o.title || '') };
    if (l.ts == null) { sansDate.push(l); continue; }
    if (dansPeriode(ymLocal(l.ts), periode)) lignes.push(l);
  }
  let aVerifier = 0;
  const horsVus = new Set();
  for (const b of (Array.isArray(hors) ? hors : [])) {
    if (!b) continue;
    const hid = String(b.id || '');
    if (hid && horsVus.has(hid)) continue;   // le même achat saisi : UNE ligne
    if (hid) horsVus.add(hid);
    const ts = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? Date.parse(b.date + 'T12:00:00') : Date.parse(b.date || '');
    const p = typeof montantHors === 'function' ? montantHors(b) : null;
    // Rattaché par SON clic à un fournisseur : la ligne porte son nom (une seule ligne).
    const rat = hid && rattaches[hid] ? nomFournisseur(rattaches[hid].fournisseur) : '';
    const num = String(b.numero == null ? '' : b.numero).trim();
    const doublon = !!num && numsGros.has(cleNum(num));
    const l = { id: 'hors:' + hid, ts: Number.isFinite(ts) ? ts : null, date: jourFr(ts), plateforme: 'Hors plateforme',
      fournisseur: rat || String((typeof sourceHors === 'function' ? sourceHors(b.source) : b.source) || ''), montant: p == null ? null : p, source: p == null ? '' : 'saisi', saisi: p == null ? null : p,
      raison: p == null ? 'prix pas saisi' : (doublon ? 'N° aussi dans un achat en gros : à vérifier' : ''), reglement: '', reference: '', num, compte: '', titre: String(b.title || ''),
      paires: '', frais: null, rattache: !!rat, aVerifier: doublon };
    if (l.ts == null) { sansDate.push(l); continue; }
    if (dansPeriode(ymLocal(l.ts), periode)) { lignes.push(l); if (doublon) aVerifier += 1; }
  }
  // ── LES ACHATS EN GROS : une ligne chacun, par SON total (+ ses frais) ──────
  let nGros = 0;
  for (const [gid, a] of Object.entries(G && G.achats && typeof G.achats === 'object' ? G.achats : {})) {
    if (!a || !Number.isSafeInteger(a.total) || a.total < 0 || !Number.isSafeInteger(a.paires) || a.paires < 1) continue;
    const nom = nomFournisseur(a.fournisseur); if (!nom) continue;   // fournisseur retiré : l'achat est parti avec lui
    const frais = Number.isSafeInteger(a.frais) && a.frais > 0 ? a.frais : 0;
    const ts = /^\d{4}-\d{2}-\d{2}$/.test(String(a.date || '')) ? Date.parse(a.date + 'T12:00:00') : NaN;
    const reliees = (parGros.get(gid) || []).map((e) => String(e.numero == null ? '' : e.numero).trim()).filter(Boolean).sort((x, y) => x.localeCompare(y, 'fr', { numeric: true }));
    const l = { id: 'gros:' + gid, ts: Number.isFinite(ts) ? ts : null, date: jourFr(ts), plateforme: 'Achat en gros', fournisseur: nom,
      montant: (a.total + frais) / 100, source: 'saisi', saisi: (a.total + frais) / 100, raison: '', reglement: '', reference: '', num: reliees.join(' + '), compte: '',
      titre: `En gros · ${a.paires} paire${a.paires > 1 ? 's' : ''}${reliees.length ? ` · ${reliees.length} reliée${reliees.length > 1 ? 's' : ''}` : ''}`,
      paires: String(a.paires), frais: frais ? frais / 100 : null, gros: true };
    if (l.ts == null) { sansDate.push(l); continue; }
    if (dansPeriode(ymLocal(l.ts), periode)) { lignes.push(l); nGros += 1; }
  }
  lignes.sort(triChrono);
  const total = lignes.reduce((s, l) => s + (l.montant == null ? 0 : Math.round(l.montant * 100)), 0) / 100;
  const sansMontant = lignes.filter((l) => l.montant == null).length;
  const articleSeul = lignes.filter((l) => l.source === 'article').length;
  const manques = [...(achats == null ? ['achats Vinted'] : []), ...(Array.isArray(manque) ? manque : [])].filter(Boolean).map(String);
  return { type: 'achats', periode: String(periode), lignes, n: lignes.length, total, sansMontant, articleSeul, aVerifier, nGros, horsPeriode: sansDate, exclues, manque: manques, complet: !sansMontant && !articleSeul && !manques.length };
}

// ── LA MISE EN PAGE (une seule pour le PDF et le tableur) ───────────────────
export const eurosTexte = (x) => {
  const c = cts(x); if (c == null) return '—';
  const n = Math.abs(c);
  return (c < 0 ? '−' : '') + String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + String(n % 100).padStart(2, '0') + '\u00a0€';
};
const tableurNb = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : (Math.round(Number(x) * 100) / 100).toFixed(2).replace('.', ','));
const SOURCE = { recu: 'Reçu', saisi: 'Saisi', article: 'Article seul' };
export const titreRegistre = (R) => `${R.type === 'recettes' ? 'Livre des recettes' : 'Registre des achats'} — ${libellePeriode(R.periode)}`;
export const nomFichierRegistre = (R, ext) => `${R.type === 'recettes' ? 'Livre-des-recettes' : 'Registre-des-achats'}-${R.periode}.${ext}`;
// Le résumé : [libellé, valeur, clé]. Le total dit « au moins » dès qu'une ligne
// manque de montant ou qu'une source n'a pas été lue.
export function resumeRegistre(R) {
  const L = [];
  const partiel = !R.complet;
  L.push([R.type === 'recettes' ? 'Recettes' : 'Achats', String(R.n), 'n']);
  L.push(['Total', `${partiel ? 'au moins ' : ''}${eurosTexte(R.total)}`, 'total']);
  if (R.sansMontant) L.push(['Lignes sans montant', String(R.sansMontant), 'sans-montant']);
  if (R.type === 'achats' && R.articleSeul) L.push(['Article seul (sans port ni frais)', String(R.articleSeul), 'article-seul']);
  if (R.type === 'achats' && R.nGros) L.push(['Achats en gros (une ligne chacun, par leur total)', String(R.nGros), 'gros']);
  if (R.type === 'achats' && R.aVerifier) L.push(['À vérifier (N° aussi dans un achat en gros)', String(R.aVerifier), 'a-verifier']);
  if (R.manque.length) L.push(['Pas lu', R.manque.join(', '), 'manque']);
  return L;
}
const COLONNES = {
  recettes: [['date', 'Date'], ['montant', 'Montant', 1], ['plateforme', 'Plateforme'], ['reglement', 'Règlement'], ['reference', 'Référence'], ['num', 'N°'], ['compte', 'Compte']],
  achats: [['date', 'Date'], ['fournisseur', 'Fournisseur'], ['paires', 'Paires', 1], ['montant', 'Montant', 1], ['frais', 'Dont frais', 1], ['source', 'Montant lu'], ['reglement', 'Règlement'], ['reference', 'Référence'], ['num', 'N°'], ['titre', 'Article']],
};
const cellule = (l, k, tableur) => {
  if (k === 'montant') return l.montant == null ? (tableur ? '' : '—') : (tableur ? tableurNb(l.montant) : eurosTexte(l.montant));
  if (k === 'frais') return l.frais == null ? '' : (tableur ? tableurNb(l.frais) : eurosTexte(l.frais));
  if (k === 'source') return SOURCE[l.source] || '';
  return String(l[k] == null ? '' : l[k]);
};
export function csvRegistre(R, { entreprise = null, maintenant = Date.now() } = {}) {
  const e = (v) => { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const L = [];
  L.push([titreRegistre(R)]);
  if (entreprise && entreprise.nom) { L.push([entreprise.nom]); if (entreprise.siret) L.push([`SIRET ${entreprise.siret}`]); }
  L.push([`Établi le ${jourFr(maintenant)}`]);
  L.push([]);
  for (const [k, v] of resumeRegistre(R)) L.push([k, String(v).replace(/[  ]/g, ' ')]);
  L.push([]);
  const cols = COLONNES[R.type];
  L.push([...cols.map((c) => c[1]), 'Note']);
  for (const l of R.lignes) L.push([...cols.map(([k]) => cellule(l, k, true)), l.raison || '']);
  L.push(['Total', ...cols.slice(1).map(([k]) => (k === 'montant' ? tableurNb(R.total) : '')), '']);
  if (R.horsPeriode.length) {
    L.push([]);
    L.push([R.type === 'recettes' ? 'Dans aucune période (à dater)' : 'Sans date']);
    L.push([...cols.map((c) => c[1]), 'Note']);
    for (const l of R.horsPeriode) L.push([...cols.map(([k]) => cellule(l, k, true)), l.raison || '']);
  }
  return '﻿' + L.map((r) => r.map(e).join(';')).join('\r\n') + '\r\n';
}

const A4P = [841.89, 595.28];   // A4 à l'italienne : sept colonnes lisibles
export async function pdfRegistre(R, { PDFLib = null, entreprise = null, maintenant = Date.now() } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(titreRegistre(R));
  if (entreprise && entreprise.nom) doc.setAuthor(entreprise.nom);
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.42, 0.42, 0.45), FILET = rgb(0.86, 0.86, 0.88);
  const M = 36, [W, H] = A4P;
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => { let o = ''; for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[   ]/g, ' ').replace(/−/g, '-').replace(/—/g, '-').replace(/[\r\n\t]+/g, ' ')) o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  const borne = (s, font, t, max) => { let x = propre(s); if (font.widthOfTextAtSize(x, t) <= max) return x; while (x.length > 1 && font.widthOfTextAtSize(x + '...', t) > max) x = x.slice(0, -1); return x + '...'; };
  let page = doc.addPage(A4P); let y = H - M;
  const txt = (s, x, yy, { font = f, t = 9, c = ENCRE, droite = false, max = null } = {}) => {
    const v = max ? borne(s, font, t, max) : propre(s);
    page.drawText(v, { x: droite ? x - font.widthOfTextAtSize(v, t) : x, y: yy, size: t, font, color: c });
  };
  // Les colonnes : largeurs fixes, le dernier champ prend le reste.
  const cols = COLONNES[R.type];
  const LARG = R.type === 'achats'
    ? { date: 58, fournisseur: 96, paires: 40, montant: 70, frais: 62, source: 66, reglement: 92, reference: 82, num: 66, titre: 0 }
    : { date: 62, montant: 70, plateforme: 80, reglement: 110, reference: 100, num: 60, compte: 90, fournisseur: 100, source: 70, titre: 0 };
  const xs = []; let x = M;
  for (const [k] of cols) { xs.push(x); x += LARG[k] || 0; }
  const reste = W - M - x; const largeur = (i) => (LARG[cols[i][0]] || Math.max(60, reste + (LARG[cols[i][0]] || 0))) - 8;
  const place = (h, tete) => { if (y - h < M + 16) { page = doc.addPage(A4P); y = H - M; if (tete) tete(); } };
  if (entreprise && entreprise.nom) {
    txt(entreprise.nom, M, y, { font: fb, t: 11 });
    if (entreprise.siret) txt(`SIRET ${entreprise.siret}`, M, y - 13, { t: 8.5, c: GRIS });
    y -= 30;
  }
  txt(titreRegistre(R), M, y - 6, { font: fb, t: 18 }); y -= 22;
  txt(`Établi le ${jourFr(maintenant)}`, M, y, { t: 9, c: GRIS }); y -= 22;
  for (const [k, v, cle] of resumeRegistre(R)) {
    const fort = cle === 'total';
    txt(k, M, y, { t: 10, font: fort ? fb : f }); txt(v, M + 320, y, { t: 10, font: fort ? fb : f, droite: true, max: 300 });
    y -= 6; page.drawLine({ start: { x: M, y }, end: { x: M + 320, y }, thickness: 0.5, color: FILET }); y -= 12;
  }
  y -= 8;
  const entete = () => {
    cols.forEach(([, h, dr], i) => txt(h, dr ? xs[i] + largeur(i) : xs[i], y, { font: fb, t: 8, c: GRIS, droite: !!dr }));
    y -= 5; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: FILET }); y -= 11;
  };
  const rangee = (l) => {
    place(13, entete);
    cols.forEach(([k, , dr], i) => txt(cellule(l, k, false), dr ? xs[i] + largeur(i) : xs[i], y, { t: 8, droite: !!dr, max: largeur(i), c: l.montant == null && k === 'montant' ? GRIS : ENCRE }));
    y -= 12;
  };
  entete();
  if (!R.lignes.length) { txt('Aucune ligne sur la période.', M, y, { c: GRIS }); y -= 14; }
  for (const l of R.lignes) rangee(l);
  const iM = cols.findIndex((c) => c[0] === 'montant');
  place(16); txt('Total', M, y, { font: fb, t: 8.5 }); txt(`${R.complet ? '' : 'au moins '}${eurosTexte(R.total)}`, xs[iM] + largeur(iM), y, { font: fb, t: 8.5, droite: true }); y -= 24;
  if (R.horsPeriode.length) {
    place(40); txt(R.type === 'recettes' ? `Dans aucune période — à dater (${R.horsPeriode.length})` : `Sans date (${R.horsPeriode.length})`, M, y, { font: fb, t: 11 }); y -= 16;
    entete();
    for (const l of R.horsPeriode) rangee(l);
  }
  return doc.save();
}
