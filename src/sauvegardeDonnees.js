// ═══════════════════════════════════════════════════════════════════════════
// « TÉLÉCHARGER TOUTES MES DONNÉES » — LA SAUVEGARDE FAITE DANS LE NAVIGATEUR
// (15 nov., lot argent-plus — Paramètres → Sécurité des données)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (« vas-y fais tout ») : un ZIP — du JSON lisible PAR CATÉGORIE, les tableaux
// CSV ventes / achats / annonces, et les PDF de bordereaux encore présents — fabriqué
// DANS LE NAVIGATEUR depuis SES lignes (sa session, RLS : la base ne lui rend que les
// siennes ; chaque lecture porte en plus `owner=eq.<lui>`), rien envoyé ailleurs.
//
// LES LOIS DE LECTURE (§4) :
//   · §4.5 — toute liste passe par `lireTout` (pagination par en-tête `Range`, un ordre
//     stable) : jamais les 1 000 premières lignes prises pour toutes ;
//   · §4.4 — JAMAIS `select=data` sur une ligne lourde : les motifs `LOURDS` (les mêmes
//     que l'export RGPD du serveur, api/_lib/export-rgpd.js — l'audit exige l'égalité)
//     ne donnent que leur RÉSUMÉ (`id`, `updated_at`, `meta`) ; le PDF d'un bordereau se
//     lit SEUL, une ligne à la fois (`lirePdfLigne` : `data->>pdfB64`, vérifié `%PDF`) ;
//   · les motifs `SECRETS` (jetons, clés) ne partent PAS, et tout champ de jeton est
//     retiré d'une ligne (`sansSecrets`, la même règle que le serveur) ;
//   · « rien lu » ≠ « rien » : une lecture ratée est NOMMÉE dans LISEZMOI.txt et à
//     l'écran (« incomplet »), jamais un zip présenté comme complet.
// AUCUNE RÈGLE D'ARGENT ICI : les tableaux ventes et achats sont ceux d'« Exporter mes
// données » (`feuillesExport`, src/exportDonnees.js : le relevé de Ventes, les achats
// des comptes liés) ; le tableau des annonces recopie les dressings lus (aucun calcul).
// Le zip se dézippe en UN dossier (`VRM-sauvegarde-AAAA-MM-JJ/`). Module PUR (la
// lecture prend ses fonctions en argument). Exécuté par scripts/audit-argent-plus.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { feuillesExport, csvDe, zipStocke } from './exportDonnees.js';
import { jourParis } from './dateParis.js';

// ⚠️ Les mêmes motifs que le serveur (api/_lib/export-rgpd.js `LOURDS`, `SECRETS`) — l'audit le vérifie.
export const LOURDS = ['harvest_*_txn_*', 'harvest_*_label_*', 'email_bord_*', 'email_html_*', 'email_qpj_*', 'backup_*', 'lbc_catalogue', 'lbc_recon', 'harvest_*_seen_urls', 'harvest_*_wreq_*', 'harvest_*_pickup_points'];
export const SECRETS = ['ebay_tokens*', 'push_subs', 'vrm_photoroom_cle', 'photoroom_cle', 'vrm_widget_token', 'vrm_sms_token', 'jeton_*', 'vrm_coffre*'];
const CLE_SECRETE = /^(access_token|refresh_token|csrf_token|id_token|client_secret|password|mot_de_passe|motDePasse|p256dh|auth|secret|cle_api|api_key|apiKey|token)$/i;
export function sansSecrets(v, prof = 0) {
  if (prof > 60 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => sansSecrets(x, prof + 1));
  const o = {};
  for (const k of Object.keys(v)) if (!CLE_SECRETE.test(k)) o[k] = sansSecrets(v[k], prof + 1);
  return o;
}
const reMotif = (m) => new RegExp('^' + String(m).split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
const RE_LOURDS = LOURDS.map(reMotif), RE_SECRETS = SECRETS.map(reMotif);
export const natureLigne = (id) => (RE_SECRETS.some((r) => r.test(String(id))) ? 'secret' : RE_LOURDS.some((r) => r.test(String(id))) ? 'lourde' : 'legere');
// Un bordereau dont le PDF se lit seul : l'e-mail du bordereau, ou l'étiquette captée
// par l'extension POUR UNE TRANSACTION (jamais `label_latest`, que l'extension réécrit).
export const estBordereau = (id) => /^email_bord_[\w-]{3,}$/.test(String(id)) || /^harvest_\d+_label_\d{6,20}$/.test(String(id));

// ── LES CATÉGORIES (le JSON lisible : un fichier par catégorie) ─────────────
export const CATEGORIES = [
  ['ventes', [/^harvest_.+_orders_sold$/, /^lbc_ventes$/, /^vc_ventes$/, /^ebay_(?!tokens).*(commande|order)/i, /^vente_/, /^import_/]],
  ['achats', [/^harvest_.+_orders_purchased$/, /^achat_/, /^email_(achat|recu)_/]],
  ['annonces', [/^harvest_.+_(listings|enligne|supprimees)$/, /^lbc_(annonces|listings|en_vente)/, /^vc_listings$/, /^ebay_.*annonce/i]],
  ['colis', [/^email_bord_/, /^harvest_.+_(label|suivi|pickup)_?/, /^depart_/, /^email_(track|retrait|colis|final)_/]],
  ['messages', [/^harvest_.+_(conv|inbox)/, /^lbc_conv/, /^vc_(conv|messages|offres)/]],
  ['compta', [/^harvest_.+_(billing|releve|versement)/, /^email_invoice_/, /^facture/, /^vrm_(compta|facture|pro_facture)/]],
  ['emails', [/^email_/]],
  ['reglages', [/^main$/, /^vrm_/, /^panel_/, /^bilan_/, /^seuils_/]],
];
export const categorieDe = (id) => { for (const [c, res] of CATEGORIES) if (res.some((r) => r.test(String(id)))) return c; return 'autres'; };

// ── LE TABLEAU DES ANNONCES (recopie des dressings lus) ─────────────────────
const prixDe = (p) => { const v = p && typeof p === 'object' ? p.amount : p; const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) && String(v).trim() !== '' ? n.toFixed(2).replace('.', ',') : ''; };
export function lignesAnnonces(dressings, fiches = null, nomCompte = (uid) => uid) {
  if (!Array.isArray(dressings)) return [['—']];
  const L = [['Compte', 'Annonce', 'N°', 'Titre', 'Prix (€)', 'Marque', 'Taille', 'État', 'Vues', 'Favoris', 'Boostée', 'Lu le']];
  for (const r of dressings) {
    const m = /^harvest_(.+?)_listings$/.exec(String(r && r.id || ''));
    if (!m) continue;
    const d = (r && r.data) || {};
    const items = d.payload && Array.isArray(d.payload.items) ? d.payload.items : [];
    const lu = d.capturedAt ? jourParis(d.capturedAt) : '';
    for (const it of items) {
      if (!it || it.id == null) continue;
      const f = fiches && fiches[String(it.id)];
      L.push([nomCompte(m[1]), String(it.id), f && f.numero != null ? String(f.numero) : '', String(it.title || ''), prixDe(it.price),
        String(it.brand_title || (typeof it.brand === 'string' ? it.brand : (it.brand && it.brand.title)) || ''), String(it.size_title || (typeof it.size === 'string' ? it.size : (it.size && it.size.title)) || ''),
        String(it.status || ''), Number.isFinite(it.view_count) && it.view_count > 0 ? String(it.view_count) : '', Number.isFinite(it.favourite_count) ? String(it.favourite_count) : '',
        typeof it.promoted === 'boolean' ? (it.promoted ? 'oui' : 'non') : '', lu]);
    }
  }
  return L;
}

// ── LE ZIP ──────────────────────────────────────────────────────────────────
export const dossierSauvegarde = (quand = new Date()) => `VRM-sauvegarde-${jourParis(quand)}`;
export const nomZipSauvegarde = (quand = new Date()) => `${dossierSauvegarde(quand)}.zip`;
const nomSur = (id) => String(id).replace(/[^\w.-]+/g, '_').slice(0, 120) || 'ligne';

// `lu` : la sortie de `lireSauvegarde` ; `sources` : celles d'« Exporter mes données »
// (null = pas lues ⇒ les tableaux disent « — ») ; `fiches` : `vinted_annonce_numeros`.
export function fichiersSauvegarde({ lu, sources = null, quand = new Date(), nomCompte } = {}) {
  const dos = dossierSauvegarde(quand);
  const F = [];
  const parCat = new Map();
  for (const r of lu.legeres || []) { const c = categorieDe(r.id); if (!parCat.has(c)) parCat.set(c, []); parCat.get(c).push({ id: r.id, updated_at: r.updated_at || null, data: sansSecrets(r.data) }); }
  for (const r of lu.lourdes || []) { const c = categorieDe(r.id); if (!parCat.has(c)) parCat.set(c, []); parCat.get(c).push({ id: r.id, updated_at: r.updated_at || null, resume: sansSecrets(r.meta || null) }); }
  for (const [c, l] of [...parCat.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    l.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    F.push({ nom: `${dos}/donnees/${c}.json`, texte: JSON.stringify({ categorie: c, lignes: l.length, exporteLe: new Date(quand).toISOString(), contenu: l }, null, 1) });
  }
  const feuilles = feuillesExport(sources || {});
  const f = (n) => (feuilles.find((x) => x.nom === n) || { lignes: [['—']] }).lignes;
  // (23 nov., lot mes-donnees) TOUS les tableaux d'« Exporter mes données » (`feuillesExport`, aucune règle neuve) :
  // ventes, achats, numéros (le stock et ses N°), dépenses, URSSAF, déclarations, factures Pro (métadonnées) ; une feuille
  // dont la source n'est pas lue dit « — » (jamais un tableau vide pris pour « rien »).
  for (const [nom, fichier] of TABLEAUX) F.push({ nom: `${dos}/tableaux/${fichier}.csv`, texte: csvDe(f(nom)) });
  const dressings = lu.legeres ? lu.legeres.filter((r) => /_listings$/.test(String(r.id))) : null;
  F.push({ nom: `${dos}/tableaux/annonces.csv`, texte: csvDe(lu.legeres ? lignesAnnonces(dressings, sources && sources.fiches, nomCompte) : [['—']]) });
  for (const p of lu.pdfs || []) if (p && p.octets instanceof Uint8Array) F.push({ nom: `${dos}/bordereaux/${nomSur(p.id)}.pdf`, octets: p.octets });
  F.unshift({ nom: `${dos}/LISEZMOI.txt`, texte: lisezmoi(lu, quand) });
  return F;
}

export function etatSauvegarde(lu) {
  const manques = [...(lu.manques || [])];
  if (lu.pdfRates) manques.push(`${lu.pdfRates} bordereau${lu.pdfRates > 1 ? 'x' : ''} pas lu${lu.pdfRates > 1 ? 's' : ''}`);
  return { complet: manques.length === 0, manques };
}
function lisezmoi(lu, quand) {
  const e = etatSauvegarde(lu);
  const nPdf = (lu.pdfs || []).filter((p) => p && p.octets).length;
  return [
    'VRM — sauvegarde de tes données',
    `Faite le ${new Date(quand).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}, dans ton navigateur, depuis tes propres lignes. Rien n'a été envoyé ailleurs.`,
    '',
    'donnees/   tes lignes, rangées par catégorie (JSON lisible) : ventes, achats, annonces, colis, messages, compta, e-mails, réglages, autres.',
    `tableaux/  ${[...TABLEAUX.map((t) => t[1]), 'annonces'].map((x) => x + '.csv').join(', ')} (« ; », virgule décimale : Excel et Numbers les ouvrent ; « — » = pas lu).`,
    `bordereaux/ les PDF de bordereaux encore présents (${nPdf}).`,
    '',
    'Ce qui ne part pas :',
    '  · les jetons et clés (Vinted, eBay, widget, Photoroom, téléphones) : un fichier ne doit jamais pouvoir ouvrir un compte ;',
    '  · les lignes lourdes (transactions brutes, e-mails HTML, pièces jointes) : leur résumé seulement ;',
    `  · ${lu.pdfAbsents || 0} bordereau${(lu.pdfAbsents || 0) > 1 ? 'x' : ''} dont le PDF n'est plus en base.`,
    '',
    e.complet ? 'Sauvegarde complète : chaque lecture a répondu.' : `⚠ INCOMPLET — pas dedans : ${e.manques.join(' · ')}. Relance « Télécharger toutes mes données » dans un instant.`,
    '',
  ].join('\r\n');
}

// ── LA LECTURE (le navigateur, SES lignes) ──────────────────────────────────
// `lireTout(q, opts)` : la pagination de l'app (rend un tableau ou null) ;
// `lirePdf(id)` : `lirePdfLigne` ({ octets } · { absent } · null) ; `owner` : son uid.
// `surEtape(etape, n, total)` : l'avancement (facultatif).
const LOT = 40;
const inListe = (ids) => `id=in.(${ids.map((x) => `"${String(x).replace(/"/g, '')}"`).map(encodeURIComponent).join(',')})`;
export async function lireSauvegarde({ lireTout, lirePdf, owner, surEtape = () => {}, parallele = 3 }) {
  const o = owner ? `owner=eq.${encodeURIComponent(owner)}&` : '';
  const out = { legeres: [], lourdes: [], pdfs: [], pdfAbsents: 0, pdfRates: 0, secrets: 0, manques: [] };
  surEtape('liste', 0, 0);
  const ids = await lireTout(`${o}select=id,updated_at`, { maxPages: 200 });
  if (!Array.isArray(ids)) { out.manques.push('la liste de tes lignes'); out.legeres = null; return out; }
  const legeres = [], bords = [];
  for (const r of ids) {
    const n = natureLigne(r.id);
    if (n === 'secret') out.secrets += 1;
    else if (n === 'legere') legeres.push(r.id);
    if (estBordereau(r.id)) bords.push(r.id);
  }
  // Les lignes légères, par lots, contenu entier (sans secrets ensuite).
  for (let i = 0; i < legeres.length; i += LOT) {
    surEtape('lignes', i, legeres.length);
    const l = await lireTout(`${o}${inListe(legeres.slice(i, i + LOT))}&select=id,updated_at,data`);
    if (!Array.isArray(l)) { out.manques.push(`${Math.min(LOT, legeres.length - i)} lignes`); continue; }
    out.legeres.push(...l);
  }
  // Les lignes lourdes : leur résumé seulement (`meta`), motif par motif.
  for (const m of LOURDS) {
    surEtape('resumes', LOURDS.indexOf(m), LOURDS.length);
    const l = await lireTout(`${o}id=like.${encodeURIComponent(m)}&select=id,updated_at,meta`, { maxPages: 200 });
    if (!Array.isArray(l)) { out.manques.push(`les résumés ${m.replace(/\*/g, '…')}`); continue; }
    out.lourdes.push(...l);
  }
  // Les PDF de bordereaux : une ligne à la fois (jamais `select=data`), `parallele` en même temps.
  let k = 0;
  const suivant = async () => {
    while (k < bords.length) {
      const id = bords[k++];
      surEtape('bordereaux', k, bords.length);
      let r = null; try { r = await lirePdf(id); } catch (_) { r = null; }
      if (r == null) out.pdfRates += 1;
      else if (r.octets instanceof Uint8Array) out.pdfs.push({ id, octets: r.octets });
      else out.pdfAbsents += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, parallele) }, suivant));
  return out;
}

// Le PDF d'UN bordereau, lu seul (`data->>pdfB64`, la colonne que lit `lirePdfLigne`) — sans
// ses effets (garde hors connexion, lecture du transporteur) : une sauvegarde ne change rien.
// → { octets } · { absent: true } · null (la base n'a pas répondu).
const deB64 = (b) => { const s = atob(String(b).replace(/\s+/g, '')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const estPdf = (u) => !!(u && u.length >= 4 && u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46);
export const lecteurPdfBordereau = ({ fetcher, url, auth, owner = '' }) => async (id) => {
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}${owner ? `&owner=eq.${encodeURIComponent(owner)}` : ''}&select=b:data->>pdfB64`, { headers: auth() });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    const v = j[0] && j[0].b;
    if (!v || v === 'None') return { absent: true };
    let u; try { u = deB64(v); } catch (_) { return { absent: true }; }
    return estPdf(u) ? { octets: u } : { absent: true };
  } catch (_) { return null; }
};

// Les tableaux du zip : [feuille de `feuillesExport`, nom du fichier] — dans l'ordre du LISEZMOI.
export const TABLEAUX = [['ventes', 'ventes'], ['achats', 'achats'], ['stock', 'numeros'], ['factures-pro', 'factures'], ['depenses', 'depenses'], ['urssaf', 'urssaf'], ['declarations', 'declarations']];

// Le zip, prêt à télécharger : { octets, nom, etat }.
export function zipSauvegarde({ lu, sources, quand = new Date(), nomCompte }) {
  const fichiers = fichiersSauvegarde({ lu, sources, quand, nomCompte });
  return { octets: zipStocke(fichiers, quand), nom: nomZipSauvegarde(quand), etat: etatSauvegarde(lu), n: fichiers.length, nPdf: (lu.pdfs || []).length };
}
