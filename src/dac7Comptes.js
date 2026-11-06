// ═══════════════════════════════════════════════════════════════════════════
// DAC7, COMPTE PAR COMPTE ET PLATEFORME PAR PLATEFORME (5 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (5 nov.) : « mettre les rapports DAC7 pour chaque compte, capter tout
// ce qu'on peut ». Comptabilité → Le détail → « DAC7 » : une carte par compte
// et par plateforme (ventes N/30, montant / 2 000 €, au-dessus ou non), le
// rapport de la plateforme quand VRM l'a reçu (sinon où le trouver), et un
// export PDF / tableur par compte.
//
// AUCUNE RÈGLE DE VENTE ICI (§5, « une seule règle par notion ») :
//   · les ventes sont les lignes de `ventesDeclarables` (App.jsx) — la MÊME
//     lecture que le CA déclaré, les registres et Factur-X (`useDeclarablesCompta`) :
//     finalisées, datées au VERSEMENT (Vinted, Vestiaire), à la vente
//     (Leboncoin), à la commande (eBay, au montant REÇU) ; comptes exclus déjà
//     dehors. Ce module les RANGE par compte ;
//   · le seuil et le verdict sont ceux de src/seuilsAnnee.js (`verdictDac7`,
//     `DAC7`) — la carte « DAC7 par plateforme » de « Tes seuils » les partage.
//
// ⚠️ L'IDENTITÉ DU COMPTE est celle que la vente PORTE (§5) : Vinted
//    `_acc.vinted_user_id`, Leboncoin `account`, eBay `_compte`, Vestiaire
//    `compte` (api/_lib/comptes-exclus.js, `compteDeVente`). Une vente sans
//    compte relevé va dans la carte « compte non relevé » de sa plateforme —
//    jamais dans un compte deviné.
// ⚠️ TROIS ÉTATS par carte : 'encours' (la plateforme se lit encore) · 'passu'
//    (la lecture a échoué — de la plateforme ou de CE compte : « — », jamais 0)
//    · 'lu'. Un compte connu sans aucune vente lue dans l'année : « 0 vente »
//    seulement si sa plateforme est LUE.
// ⚠️ « Pas su » ne vaut pas « non » : des ventes pas encore datées qui PEUVENT
//    être de l'année, ou dont le montant ne se lit pas, rendent le compte
//    « au moins » et NOMMENT le manque ; jamais « sous le seuil ».
// ⚠️ VRM ne sait pas si une plateforme additionne plusieurs comptes d'une même
//    personne : chaque compte est jugé seul, et l'écran le dit.
// ⚠️ « Plus de 2 000 € » : 2 000,00 € pile ne l'atteint pas — centimes entiers.
//
// LE RAPPORT DE LA PLATEFORME — mesuré en lecture seule le 5 nov. :
//   · AUCUN e-mail reçu par VRM ne parle de DAC7 ni de relevé fiscal (sujets de
//     3 243 e-mails relus : 0) ; aucun document fiscal capté par l'extension ;
//   · Vinted : les pages `/settings/taxpayer`, `/settings/taxpayer_center` et
//     `GET /api/v2/wallet/income_reports/settings` ont été VISITÉES (relevé des
//     chemins), jamais leur contenu ; le porte-monnaie capté porte parfois
//     `taxpayer_restricted` (lu sur 2 comptes : false) ;
//   · Leboncoin : son interface (catalogue de textes capté) renvoie vers son
//     article d'aide « Le rapport DAC7 ».
//   ⇒ `classerEmailFiscal` reconnaît un e-mail fiscal d'une plateforme (par
//     l'EXPÉDITEUR pour la plateforme, par le SUJET pour la nature) le jour où
//     il arrive ; sinon l'écran dit OÙ trouver le rapport (`OU_TROUVER`).
//   · DAC7 (directive 2021/514) : la plateforme doit donner au vendeur, au plus
//     tard le 31 janvier, ce qu'elle a transmis pour l'année d'avant.
// ─────────────────────────────────────────────────────────────────────────────
import { DAC7, verdictDac7, PLATEFORMES } from './seuilsAnnee.js';
import { anneeSureDeVente } from './aDaterAnnee.js';
import { eurosTexte, jourFr } from './registres.js';
import { compteDeVente, SANS_COMPTE_VC } from '../api/_lib/comptes-exclus.js';

export { DAC7, PLATEFORMES };
// Le versement suit la vente de près (au plus 25 jours mesurés le 6 oct.) : la
// même borne que la carte « Ce que Vinted transmet » (App.jsx) — l'audit l'exige.
export const VERSEMENT_MAX_J = 45;
export const SANS_COMPTE = '';
const JOUR = 86400e3;

// Où trouver le rapport DAC7 de chaque plateforme — seulement ce qui a été VU
// (chemin visité chez Vinted, lien donné par l'interface de Leboncoin) ; pour
// les autres, aucun lien inventé.
export const OU_TROUVER = Object.freeze({
  Vinted: { lien: 'https://www.vinted.fr/settings/taxpayer_center', texte: 'Vinted → Paramètres → Informations fiscales' },
  Leboncoin: { lien: 'https://assistance.leboncoin.info/hc/fr/articles/14847662938898-Le-rapport-DAC7', texte: 'Aide Leboncoin : « Le rapport DAC7 »' },
  eBay: { lien: '', texte: 'Un e-mail d’eBay en janvier, ou la rubrique fiscale de ton compte eBay' },
  Vestiaire: { lien: '', texte: 'Un e-mail de Vestiaire Collective en janvier, ou la rubrique fiscale de ton compte' },
});

const cts = (x) => { const n = Number(x); return Number.isFinite(n) ? Math.round(n * 100) : null; };
const anneeDe = (t) => new Date(t).getFullYear();
const ymOk = (ym, annee) => typeof ym === 'string' && ym.slice(0, 4) === String(annee);
const referenceDe = (id) => String(id || '').replace(/^(vinted|lbc|ebay|vestiaire):/, '');
const cleCarte = (p, c) => `${p}|${c}`;

// ── LE COMPTE D'UNE VENTE, PAR SON IDENTITÉ ────────────────────────────────
// Rend une Map `plateforme:id` → { plateforme, cle, nom } depuis les ventes
// BRUTES (celles que `ventesDeclarables` a lues). `nomVinted(uid, login)`,
// `nomAutre(plateforme, cle)` : le nom affiché (lu, jamais deviné).
export function indexComptesVentes({ vinted = [], lbc = [], ebay = [], vestiaire = [], nomVinted = (u, l) => l || u, nomAutre = () => '' } = {}) {
  const m = new Map();
  for (const o of (Array.isArray(vinted) ? vinted : [])) {
    if (!o) continue;
    const tx = o.transaction_id != null ? o.transaction_id : o.id;
    if (tx == null) continue;
    const uid = String((o._acc && o._acc.vinted_user_id) ?? '');
    m.set('vinted:' + tx, { plateforme: 'Vinted', cle: uid, nom: uid ? String(nomVinted(uid, (o._acc && o._acc.login) || '') || uid) : '' });
  }
  const autre = (pref, plateforme, id, v, cle) => { if (id == null || id === '') return; const c = cle == null ? SANS_COMPTE : String(cle); m.set(pref + id, { plateforme, cle: c, nom: c ? String(nomAutre(plateforme, c) || '') : '' }); };
  for (const v of (Array.isArray(lbc) ? lbc : [])) if (v) autre('lbc:', 'Leboncoin', v.txId, v, compteDeVente('leboncoin', v));
  for (const e of (Array.isArray(ebay) ? ebay : [])) if (e) autre('ebay:', 'eBay', e.orderId, e, compteDeVente('ebay', e));
  for (const v of (Array.isArray(vestiaire) ? vestiaire : [])) if (v) autre('vestiaire:', 'Vestiaire', v.id, v, compteDeVente('vestiaire', v));
  return m;
}

// Le nom d'une carte sans nom lu : jamais un nom deviné.
export function nomParDefaut(plateforme, cle) {
  if (!cle) return 'Compte non relevé';
  if (plateforme === 'Vestiaire' && cle === SANS_COMPTE_VC) return 'Compte non identifié';
  if (plateforme === 'eBay' && cle === 'principal') return 'Compte principal';
  return `n° ${String(cle).slice(0, 8)}`;
}

// Une vente sans date (ou datée seulement de sa VENTE) PEUT-elle compter dans
// l'année ? Datée de sa vente : le versement suit, de VERSEMENT_MAX_J au plus
// (une estimation, dite). Sans aucune date : peut-être — elle rend « au moins ».
const peutEtreDe = (tsVente, annee, maintenant) => {
  if (!(tsVente > 0)) return true;
  const yMin = anneeDe(tsVente);
  const yMax = anneeDe(Math.min(maintenant, tsVente + VERSEMENT_MAX_J * JOUR));
  return annee >= yMin && annee <= yMax;
};

// ── LES CARTES ─────────────────────────────────────────────────────────────
// decl      : la sortie de `ventesDeclarables` (undefined en cours · null pas su)
// annee     : l'année civile jugée
// compteDe  : (id) → { plateforme, cle, nom } | null  (index ci-dessus)
// comptes   : les comptes CONNUS, inclus dans les totaux [{ plateforme, cle, nom }]
// etats     : { Vinted|Leboncoin|eBay|Vestiaire: 'lu' | 'encours' | 'passu' }
// comptesKO : [{ plateforme, cle }] dont la lecture a échoué (« — »)
// exclus    : [{ plateforme, cle, nom }] écartés des totaux par SON choix : DITS, pas comptés
// numDe     : (id) → le N° de la vente (relevé de Ventes, par identité) pour l'export
export function dac7ParCompte({ decl, annee, compteDe = () => null, comptes = [], etats = {}, comptesKO = [], exclus = [], numDe = () => '', maintenant = Date.now() } = {}) {
  if (decl === undefined) return { etat: 'encours', annee };
  if (!decl || !Array.isArray(decl.lignes)) return { etat: 'passu', annee };
  const ko = new Set((comptesKO || []).map((c) => cleCarte(c.plateforme, String(c.cle ?? ''))));
  const exclu = new Set((exclus || []).map((c) => cleCarte(c.plateforme, String(c.cle ?? ''))));
  const cartes = new Map();
  const carte = (plateforme, cle, nom) => {
    const k = cleCarte(plateforme, cle);
    let c = cartes.get(k);
    if (!c) { c = { plateforme, cle, nom: '', n: 0, centimes: 0, nAd: 0, ctsAd: 0, nNc: 0, lignes: [], aDater: [], nonComptees: [] }; cartes.set(k, c); }
    if (!c.nom && nom) c.nom = String(nom);
    return c;
  };
  for (const c of (comptes || [])) if (c && PLATEFORMES.includes(c.plateforme) && !exclu.has(cleCarte(c.plateforme, String(c.cle ?? '')))) carte(c.plateforme, String(c.cle ?? ''), c.nom);
  const quiDe = (l) => {
    const q = compteDe(String(l.id)) || null;
    const plateforme = (q && q.plateforme) || l.plateforme;
    const cle = q ? String(q.cle ?? '') : SANS_COMPTE;
    return { plateforme, cle, nom: q && q.nom };
  };
  const ligneExport = (l, montant, note) => ({
    id: String(l.id), ts: l.ts == null ? null : l.ts, date: jourFr(l.ts), montant, plateforme: l.plateforme,
    reference: referenceDe(l.id), num: String(numDe(String(l.id)) || ''), titre: String(l.titre || ''), note: note || '',
  });
  for (const l of decl.lignes) {
    if (!l || !ymOk(l.ym, annee)) continue;
    const q = quiDe(l);
    if (exclu.has(cleCarte(q.plateforme, q.cle))) continue;
    const c = cts(l.eur); if (c == null) continue;
    const k = carte(q.plateforme, q.cle, q.nom);
    k.n += 1; k.centimes += c;
    k.lignes.push(ligneExport(l, c / 100, l.declaree ? 'déclarée ce mois-là' : ''));
  }
  for (const l of (decl.aDater || [])) {
    if (!l) continue;
    const tsV = Date.parse(l.dateVente || '') || 0;
    if (!peutEtreDe(tsV, annee, maintenant)) continue;
    const q = quiDe(l);
    if (exclu.has(cleCarte(q.plateforme, q.cle))) continue;
    const c = cts(l.eur); if (c == null) continue;
    const k = carte(q.plateforme, q.cle, q.nom);
    // (6 nov.) Vendue cette année et lue finalisée cette année ⇒ versée cette
    // année (src/aDaterAnnee.js) : comptée, jamais « peut-être ».
    if (anneeSureDeVente(tsV, maintenant) === annee) { k.n += 1; k.centimes += c; k.lignes.push({ ...ligneExport({ ...l, ts: tsV }, c / 100, 'vendue cette année, versement pas encore daté'), date: jourFr(tsV) }); continue; }
    k.nAd += 1; k.ctsAd += c;
    k.aDater.push({ ...ligneExport({ ...l, ts: tsV || null }, c / 100, 'pas encore datée'), date: tsV ? jourFr(tsV) : '' });
  }
  for (const x of (decl.ecartees || [])) {
    if (!x || !x.manque) continue;
    const dedans = x.ts != null && Number.isFinite(x.ts) ? anneeDe(x.ts) === annee : peutEtreDe(x.tsVente || 0, annee, maintenant);
    if (!dedans) continue;
    const q = quiDe(x);
    if (exclu.has(cleCarte(q.plateforme, q.cle))) continue;
    const k = carte(q.plateforme, q.cle, q.nom);
    k.nNc += 1;
    k.nonComptees.push(ligneExport(x, null, x.raison || 'montant pas lu'));
  }
  const liste = [];
  for (const c of cartes.values()) {
    const etatP = etats[c.plateforme] || 'passu';
    const etat = etatP !== 'lu' ? etatP : ko.has(cleCarte(c.plateforme, c.cle)) ? 'passu' : 'lu';
    c.nom = c.nom || nomParDefaut(c.plateforme, c.cle);
    c.lignes.sort((a, b) => (a.ts ?? Infinity) - (b.ts ?? Infinity) || a.id.localeCompare(b.id));
    if (etat !== 'lu') {
      liste.push({ ...c, etat, n: null, centimes: null, nAd: 0, ctsAd: 0, nNc: 0, partiel: true, verdict: null, reste: null, manque: [], lignes: [], aDater: [], nonComptees: [] });
      continue;
    }
    const partiel = c.nAd > 0 || c.nNc > 0;
    const { verdict, reste } = verdictDac7({ n: c.n, centimes: c.centimes, nAd: c.nAd, ctsAd: c.ctsAd, manque: partiel });
    const manque = [];
    if (c.nAd) manque.push(`${c.nAd} vente${c.nAd > 1 ? 's' : ''} pas encore datée${c.nAd > 1 ? 's' : ''} (${eurosTexte(c.ctsAd / 100)})`);
    if (c.nNc) manque.push(`${c.nNc} vente${c.nNc > 1 ? 's' : ''} au montant illisible`);
    liste.push({ ...c, etat, partiel, verdict, reste, manque });
  }
  const rang = (p) => { const i = PLATEFORMES.indexOf(p); return i < 0 ? 99 : i; };
  liste.sort((a, b) => rang(a.plateforme) - rang(b.plateforme) || (b.centimes ?? -1) - (a.centimes ?? -1) || String(a.nom).localeCompare(String(b.nom), 'fr'));
  const exclusDits = (exclus || []).filter((c) => c && PLATEFORMES.includes(c.plateforme)).map((c) => ({ plateforme: c.plateforme, cle: String(c.cle ?? ''), nom: c.nom || nomParDefaut(c.plateforme, String(c.cle ?? '')) }));
  return { etat: 'lu', annee, cartes: liste, exclus: exclusDits, decompte: decl.exclues || 0 };
}

// ── LES E-MAILS FISCAUX DES PLATEFORMES ─────────────────────────────────────
// La plateforme par l'EXPÉDITEUR (un e-mail qui CITE Vinted n'est pas de
// Vinted) ; la nature par le SUJET : 'rapport' (le relevé DAC7 / récapitulatif
// annuel) ou 'fiscal' (une demande d'informations fiscales, un rappel). Rien
// d'autre n'est reconnu : mieux vaut un blanc qu'un faux (§5).
const sansAccent = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// ⚠️ MESURÉ le 5 nov. (lecture seule, `email_inconnu_*`) : 683 e-mails de Vinted
//    sur 1 724 arrivent par le relais iCloud « Masquer mon adresse » — l'expéditeur
//    est alors `"l'équipe Vinted" <no-reply_at_vinted_fr_xxxx_yyyy@icloud.com>`,
//    parfois suivi de `(no-reply@vinted.fr.xxxx.yyyy)` (api/_lib/lire-email.js,
//    `demasquerRelais`). La première adresse lue était celle d'iCloud : le rapport
//    de Vinted reçu par ce chemin n'aurait jamais été reconnu. On lit donc le
//    domaine RÉEL encodé dans l'adresse du relais (`_at_` + domaine aux points
//    remplacés par `_`), et un domaine ordinaire seulement s'il FINIT par celui
//    de la plateforme (jamais `vinted.fr.autre.com`).
const RELAIS_EMAIL = /^(icloud\.com|privaterelay\.appleid\.com|duck\.com|simplelogin\.[a-z]+|anonaddy\.me)$/;
const DOMAINES_P = [['Vinted', 'vinted'], ['Leboncoin', 'leboncoin'], ['eBay', 'ebay'], ['Vestiaire', 'vestiairecollective']];
const TLD_P = '(?:fr|com|co[._]uk|de|it|es|be|nl|at|pl|lt|cz|pt|lu|ie|se|dk|fi|ch)';
export function plateformeExpediteur(from) {
  const s = String(from || '').toLowerCase();
  for (const m of s.matchAll(/([a-z0-9._+-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/g)) {
    const [, local, dom] = m;
    let test = null;
    if (RELAIS_EMAIL.test(dom)) {
      const r = /_at_([a-z0-9_-]+)$/.exec(local);
      if (r) test = (n) => new RegExp(`(^|_)${n}_${TLD_P}(_|$)`).test(r[1]);
    } else test = (n) => new RegExp(`(^|\\.)${n}\\.${TLD_P}$`).test(dom);
    if (!test) continue;
    for (const [p, n] of DOMAINES_P) if (test(n)) return p;
  }
  return null;
}
export function classerEmailFiscal({ subject, from } = {}) {
  const plateforme = plateformeExpediteur(from);
  if (!plateforme) return null;
  const s = sansAccent(subject);
  if (!s) return null;
  const dac7 = /\bdac\s*-?\s*7\b/.test(s);
  const rapport = (dac7 && /(rapport|releve|recapitulatif|recap|transmi|declar|annuel|disponible)/.test(s))
    || /(rapport|releve|recapitulatif) (annuel|fiscal)/.test(s)
    || /(informations?|donnees) (transmises?|communiquees?) (aux|a l'administration|a l'administration fiscale)/.test(s);
  if (rapport) return { plateforme, nature: 'rapport' };
  if (dac7 || /(fiscal|impot|contribuable|identifiant fiscal|numero fiscal|taxpayer|tax information)/.test(s)) return { plateforme, nature: 'fiscal' };
  return null;
}
// L'année que concerne un e-mail fiscal : celle écrite dans le sujet ; sinon,
// un RAPPORT reçu de janvier à mars concerne l'année d'avant ; sinon l'année
// de réception.
export function anneeConcernee({ subject, at } = {}) {
  const t = Date.parse(at || '');
  const y = /\b(20\d\d)\b/.exec(String(subject || ''));
  if (y) return Number(y[1]);
  if (!t) return null;
  const d = new Date(t);
  const c = classerEmailFiscal({ subject, from: 'x@vinted.fr' });
  return c && c.nature === 'rapport' && d.getMonth() <= 2 ? d.getFullYear() - 1 : d.getFullYear();
}
// emails : [{ id, s: sujet, f: expéditeur, to, at }] — lus PROJETÉS (jamais `select=data`)
// rend { [plateforme]: [{ id, nature, sujet, at, a: adresse de réception }] } pour l'année
export function emailsFiscaux(emails, annee) {
  if (!Array.isArray(emails)) return null;
  const out = {};
  const vus = new Set();
  for (const e of emails) {
    if (!e) continue;
    const c = classerEmailFiscal({ subject: e.s, from: e.f });
    if (!c) continue;
    if (anneeConcernee({ subject: e.s, at: e.at }) !== annee) continue;
    const cle = `${c.plateforme}|${e.s}|${e.at}`;
    if (vus.has(cle)) continue; vus.add(cle);
    (out[c.plateforme] = out[c.plateforme] || []).push({ id: String(e.id || ''), nature: c.nature, sujet: String(e.s || '').slice(0, 160), at: e.at || '', a: String(e.to || '').slice(0, 120) });
  }
  for (const p of Object.keys(out)) out[p].sort((a, b) => (a.nature === b.nature ? 0 : a.nature === 'rapport' ? -1 : 1) || String(b.at).localeCompare(String(a.at)));
  return out;
}
// Le porte-monnaie Vinted capté porte parfois `taxpayer_restricted` : Vinted
// bloque le compte tant que les informations fiscales ne sont pas remplies.
// rangées : [{ id: 'harvest_{uid}_billing', tr: 'true'|'false'|null, cap }] ⇒ { [uid]: { bloque, at } }
export function blocagesFiscauxVinted(rangees) {
  if (!Array.isArray(rangees)) return null;
  const out = {};
  for (const r of rangees) {
    const m = /^harvest_(\d+)_billing$/.exec(String((r && r.id) || ''));
    if (!m) continue;
    const v = r.tr === true || r.tr === 'true' ? true : r.tr === false || r.tr === 'false' ? false : null;
    if (v == null) continue;
    out[m[1]] = { bloque: v, at: r.cap || null };
  }
  return out;
}

// ── L'EXPORT D'UN COMPTE (PDF et tableur) ───────────────────────────────────
const verdictTexte = (k) => {
  if (k.etat !== 'lu') return 'pas su';
  if (k.verdict === 'atteint') {
    const parN = k.n >= DAC7.ventes, parE = k.centimes > DAC7.centimes;
    return `au-dessus du seuil (${parN && parE ? '30 ventes et plus de 2 000\u00a0€' : parN ? '30 ventes' : 'plus de 2 000\u00a0€'})`;
  }
  if (k.verdict === 'atteintSi') return 'au-dessus si les ventes pas encore datées comptent';
  if (k.verdict === 'sous') return 'sous le seuil';
  return 'au moins : il manque des ventes';
};
export const titreDac7 = (k, annee) => `DAC7 ${annee} — ${k.nom} (${k.plateforme})`;
export const nomFichierDac7 = (k, annee, ext) => `DAC7-${annee}-${k.plateforme}-${String(k.nom).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'compte'}.${ext}`;
export function resumeDac7(k, annee) {
  const L = [];
  L.push(['Plateforme', k.plateforme]);
  L.push(['Compte', k.nom]);
  L.push(['Année', String(annee)]);
  L.push(['Ventes', k.etat === 'lu' ? `${k.partiel ? 'au moins ' : ''}${k.n} / ${DAC7.ventes}` : '—']);
  L.push(['Montant', k.etat === 'lu' ? `${k.partiel ? 'au moins ' : ''}${eurosTexte(k.centimes / 100)} / ${eurosTexte(DAC7.centimes / 100)}` : '—']);
  L.push(['Seuil DAC7', verdictTexte(k)]);
  if (k.manque && k.manque.length) L.push(['Il manque', k.manque.join(', ')]);
  return L;
}
const COLS = [['date', 'Date'], ['montant', 'Montant', 1], ['reference', 'Référence'], ['num', 'N°'], ['titre', 'Article'], ['note', 'Note']];
const nbTableur = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : (Math.round(Number(x) * 100) / 100).toFixed(2).replace('.', ','));
const cellule = (l, k, tableur) => (k === 'montant' ? (l.montant == null ? (tableur ? '' : '—') : (tableur ? nbTableur(l.montant) : eurosTexte(l.montant))) : String(l[k] == null ? '' : l[k]));
export function csvDac7(k, annee, { entreprise = null, maintenant = Date.now() } = {}) {
  const e = (v) => { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const L = [[titreDac7(k, annee)]];
  if (entreprise && entreprise.nom) { L.push([entreprise.nom]); if (entreprise.siret) L.push([`SIRET ${entreprise.siret}`]); }
  L.push([`Établi par VRM le ${jourFr(maintenant)} — ce n’est pas le rapport de ${k.plateforme}`]);
  L.push([]);
  for (const [a, b] of resumeDac7(k, annee)) L.push([a, String(b).replace(/[  ]/g, ' ')]);
  L.push([]);
  L.push(COLS.map((c) => c[1]));
  for (const l of k.lignes) L.push(COLS.map(([c]) => cellule(l, c, true)));
  L.push(['Total', nbTableur(k.etat === 'lu' ? k.centimes / 100 : null), '', '', '', '']);
  const autres = [...(k.aDater || []), ...(k.nonComptees || [])];
  if (autres.length) {
    L.push([]);
    L.push(['Pas comptées dans le total']);
    L.push(COLS.map((c) => c[1]));
    for (const l of autres) L.push(COLS.map(([c]) => cellule(l, c, true)));
  }
  return '﻿' + L.map((r) => r.map(e).join(';')).join('\r\n') + '\r\n';
}
const A4 = [595.28, 841.89];
export async function pdfDac7(k, annee, { PDFLib = null, entreprise = null, maintenant = Date.now() } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(titreDac7(k, annee));
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.42, 0.42, 0.45), FILET = rgb(0.86, 0.86, 0.88);
  const M = 40, [W, H] = A4;
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => { let o = ''; for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[   ]/g, ' ').replace(/−/g, '-').replace(/—/g, '-').replace(/[\r\n\t]+/g, ' ')) o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  const borne = (s, font, t, max) => { let x = propre(s); if (font.widthOfTextAtSize(x, t) <= max) return x; while (x.length > 1 && font.widthOfTextAtSize(x + '...', t) > max) x = x.slice(0, -1); return x + '...'; };
  let page = doc.addPage(A4); let y = H - M;
  const txt = (s, x, yy, { font = f, t = 9, c = ENCRE, droite = false, max = null } = {}) => { const v = max ? borne(s, font, t, max) : propre(s); page.drawText(v, { x: droite ? x - font.widthOfTextAtSize(v, t) : x, y: yy, size: t, font, color: c }); };
  if (entreprise && entreprise.nom) { txt(entreprise.nom, M, y, { font: fb, t: 11 }); if (entreprise.siret) txt(`SIRET ${entreprise.siret}`, M, y - 13, { t: 8.5, c: GRIS }); y -= 30; }
  txt(titreDac7(k, annee), M, y - 6, { font: fb, t: 16, max: W - 2 * M }); y -= 22;
  txt(`Établi par VRM le ${jourFr(maintenant)} — ce n’est pas le rapport de ${k.plateforme}`, M, y, { t: 9, c: GRIS }); y -= 22;
  for (const [a, b] of resumeDac7(k, annee)) {
    const fort = a === 'Seuil DAC7';
    txt(a, M, y, { t: 10, font: fort ? fb : f }); txt(b, W - M, y, { t: 10, font: fort ? fb : f, droite: true, max: W - 2 * M - 120 });
    y -= 6; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: FILET }); y -= 12;
  }
  y -= 8;
  const LARG = { date: 58, montant: 64, reference: 92, num: 44, titre: 0, note: 90 };
  const xs = []; let x = M; for (const [c] of COLS) { xs.push(x); x += LARG[c] || 0; }
  const reste = W - M - x;
  const largeur = (i) => (LARG[COLS[i][0]] || reste) - 6;
  // La colonne « Article » prend le reste : on la décale avant « Note ».
  const iT = COLS.findIndex((c) => c[0] === 'titre'), iN = COLS.findIndex((c) => c[0] === 'note');
  xs[iN] = W - M - LARG.note; const largT = xs[iN] - xs[iT] - 6;
  const larg = (i) => (i === iT ? largT : largeur(i));
  const entete = () => { COLS.forEach(([, h, dr], i) => txt(h, dr ? xs[i] + larg(i) : xs[i], y, { font: fb, t: 8, c: GRIS, droite: !!dr })); y -= 5; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: FILET }); y -= 11; };
  const place = (h) => { if (y - h < M + 16) { page = doc.addPage(A4); y = H - M; entete(); } };
  const rangee = (l) => { place(13); COLS.forEach(([c, , dr], i) => txt(cellule(l, c, false), dr ? xs[i] + larg(i) : xs[i], y, { t: 8, droite: !!dr, max: larg(i), c: l.montant == null && c === 'montant' ? GRIS : ENCRE })); y -= 12; };
  entete();
  if (!k.lignes.length) { txt(k.etat === 'lu' ? 'Aucune vente comptée sur l’année.' : 'Ventes pas lues.', M, y, { c: GRIS }); y -= 14; }
  for (const l of k.lignes) rangee(l);
  const iM = COLS.findIndex((c) => c[0] === 'montant');
  place(16); txt('Total', M, y, { font: fb, t: 8.5 }); txt(k.etat === 'lu' ? `${k.partiel ? 'au moins ' : ''}${eurosTexte(k.centimes / 100)}` : '—', xs[iM] + larg(iM), y, { font: fb, t: 8.5, droite: true }); y -= 24;
  const autres = [...(k.aDater || []), ...(k.nonComptees || [])];
  if (autres.length) { place(40); txt(`Pas comptées dans le total (${autres.length})`, M, y, { font: fb, t: 11 }); y -= 16; entete(); for (const l of autres) rangee(l); }
  return doc.save();
}
