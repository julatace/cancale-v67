// ═══════════════════════════════════════════════════════════════════════════
// « POUR MON COMPTABLE » — UN zip, en un clic (11 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « plus beau, simple, surtout PRATIQUE ». Une période ⇒ UN fichier zip
// qui se dézippe en UN dossier :
//   VRM-comptable-2026-10/
//     1-Recapitulatif-octobre-2026.pdf     totaux, couverture, manques NOMMÉS
//     2-Tableur-octobre-2026.xlsx          Excel : Résumé, Recettes, À dater, Achats, CA par mois
//     2-Tableur-octobre-2026.csv           le même, pour un logiciel qui ne lit que le CSV
//     Factures-de-vente/                   les factures Pro émises (le même PDF que celui envoyé) + leur registre
//     Factures-d-achat/                    les factures d'achat qu'il a jointes
// AUCUNE RÈGLE ICI : les données sont `donneesExportComptable` (src/exportComptable.js),
// les factures Pro `lignesRegistre` (src/facturePro/registre.js), les factures d'achat
// `cleFactureLigne` (src/factureAchat.js). Une pièce pas lue n'arrête pas le zip : elle
// est NOMMÉE dans le récapitulatif (« pas dans le zip : … ») et à l'écran — jamais tue,
// jamais un zip présenté comme complet.
// Les reçus d'achat Vinted (e-mails) ne sont pas joints : ce sont des e-mails, pas des
// pièces ; leur montant est dans le tableur (« Montant lu sur : reçu Vinted »).
// ─────────────────────────────────────────────────────────────────────────────
import { zipStocke } from './exportDonnees.js';
import { xlsxClasseur } from './xlsxSimple.js';
import { csvExportComptable, pdfExportComptable, resumeExport, couvertureExport, bornesPeriode, periodesExport } from './exportComptable.js';
import { lignesRegistre, csvRegistre, dansPeriode, SELECT_FACTURES_PRO } from './facturePro/registre.js';

// « 4e trimestre 2026 » ⇒ « 4e-trimestre-2026 » (sans accent, sans espace).
export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
export const nomZipComptable = (periode) => `VRM-comptable-${periode}.zip`;
export const dossierComptable = (periode) => `VRM-comptable-${periode}`;

// La dernière période BOUCLÉE (le défaut) : le mois, le trimestre ou l'année d'avant
// celle d'aujourd'hui — la 2e de `periodesExport` (la 1re est celle en cours).
export const periodeBouclee = (type, maintenant = Date.now()) => periodesExport(type === 'annee' || type === 'trimestre' ? type : 'mois', maintenant)[1];

// Un data URL ⇒ { octets, ext } ; illisible ⇒ null.
const EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
export function octetsDeDataUrl(u) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(u || ''));
  if (!m || !EXT[m[1]]) return null;
  try {
    const bin = atob(m[2].replace(/\s+/g, '')); const o = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
    return o.length ? { octets: o, ext: EXT[m[1]] } : null;
  } catch (_) { return null; }
}

// Les feuilles du classeur : les mêmes lignes que le tableur CSV, nombres en nombres.
const n2 = (x) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100) / 100);
export function feuillesExport(d) {
  const resume = [['', d.libelle], ...resumeExport(d).map(([k, v]) => [k, v])];
  const cv = couvertureExport(d);
  if (cv.length) { resume.push([], [{ t: 'Ce qui manque', gras: true }]); for (const c of cv) resume.push([c]); }
  if (d.entreprise) resume.push([], [d.entreprise.nom], ...(d.entreprise.siret ? [[`SIRET ${d.entreprise.siret}`]] : []));
  resume.push([], [`Établi le ${d.etabliLe} par VRM`]);
  const recettes = [['Date de versement', 'Date de vente', 'Plateforme', 'Compte', 'N°', 'Référence', 'Titre', 'Montant reçu (€)', 'Frais lus (€)', 'Note']];
  for (const v of (d.ventes || [])) recettes.push([v.dateVersement, v.dateVente, v.plateforme, v.compte, v.num, v.reference, v.titre, n2(v.montant), n2(v.frais), v.note]);
  if (d.ventes) recettes.push(['', '', '', '', '', '', { t: d.ventesCompletes ? 'Total' : 'Total (au moins)', gras: true }, { n: n2(d.totalVentes) }, null, '']);
  const aDater = [['Date de vente', 'Plateforme', 'Compte', 'N°', 'Référence', 'Titre', 'Montant reçu (€)', 'Note']];
  for (const v of (d.aDater || [])) aDater.push([v.dateVente, v.plateforme, v.compte, v.num, v.reference, v.titre, n2(v.montant), v.note]);
  const achats = [['Date', 'Plateforme', 'Compte ou fournisseur', 'Référence', 'N°', 'Article', 'Coût saisi (€)', 'Montant lu (€)', 'Montant lu sur', 'Justificatif', 'Note']];
  for (const a of (d.achats || [])) achats.push([a.date, a.plateforme, a.fournisseur, a.reference, a.num, a.titre, n2(a.saisi), n2(a.lu), a.sourceLue, a.facture || '', a.saisi == null ? (a.note || 'coût pas saisi') : a.note]);
  if (d.achats) achats.push(['', '', '', '', '', { t: d.sansCout ? 'Total saisi (au moins)' : 'Total saisi', gras: true }, d.coutSaisi == null ? '—' : { n: n2(d.coutSaisi) }, null, '', '', d.sansCout ? `${d.sansCout} sans coût` : '']);
  const micro = d.regime === 'micro';
  const ca = [['Mois', 'Ventes', 'CA déclaré (€)', micro ? 'URSSAF à payer (€)' : 'URSSAF', 'Noté déclaré']];
  for (const m of (d.caParMois || [])) ca.push([m.mois, m.n, n2(m.ca), micro ? n2(m.urssaf) : 'non calculée', m.declare ? 'oui' : '']);
  if (d.caParMois) ca.push([{ t: d.partielCa ? 'Total (au moins)' : 'Total', gras: true }, null, d.caDeclare == null ? '—' : { n: n2(d.caDeclare) }, micro && d.urssaf != null ? { n: n2(d.urssaf) } : '', '']);
  else ca.push(['CA déclaré pas encore calculé : ouvre Ventes une fois']);
  return [
    { nom: 'Résumé', lignes: resume, largeurs: [42, 30], entete: false },
    { nom: 'Recettes', lignes: recettes, largeurs: [14, 13, 11, 16, 7, 14, 40, 15, 12, 30] },
    { nom: 'À dater', lignes: aDater, largeurs: [13, 11, 16, 7, 14, 40, 15, 30] },
    { nom: 'Achats', lignes: achats, largeurs: [12, 11, 22, 14, 7, 40, 14, 14, 18, 30, 30] },
    { nom: 'CA par mois', lignes: ca, largeurs: [22, 9, 16, 18, 12] },
  ];
}

// LES JUSTIFICATIFS — lus seulement au clic. deps :
//   lireTout(query, { strict })   lecture paginée d'app_data (projection)
//   lireFactureAchat(cle)          ⇒ data URL | null (`lireContenuFacture`)
//   pdfFacture(contenu)            ⇒ octets du PDF Pro (src/facturePro/pdf.js)
// Rend { ventes: [{nom, octets}], registreCsv, achats: [{nom, octets}], manque: [texte…] }.
export async function lireJustificatifs(d, { lireTout, lireFactureAchat, pdfFacture } = {}) {
  const out = { ventes: [], registreCsv: null, achats: [], manque: [] };
  const yms = (bornesPeriode(d && d.periode) || { yms: [] }).yms;
  // 1. Les factures de vente Pro émises sur la période (et les avoirs).
  let rows = null;
  try { rows = await lireTout(`id=like.email_invoice_*&select=${SELECT_FACTURES_PRO}`, { strict: true }); } catch (_) { rows = null; }
  if (!Array.isArray(rows)) out.manque.push('les factures de vente (pas lues)');
  else {
    const lignes = lignesRegistre(rows).filter((l) => yms.some((ym) => dansPeriode(l, ym)));
    if (lignes.length) {
      out.registreCsv = csvRegistre(lignes);
      const contenus = new Map(); let ko = false;
      for (let i = 0; i < lignes.length; i += 25) {
        const part = lignes.slice(i, i + 25).map((l) => l.id);
        let r = null; try { r = await lireTout(`id=in.(${part.map(encodeURIComponent).join(',')})&select=id,contenu:data->contenu`, { strict: true }); } catch (_) { r = null; }
        if (!Array.isArray(r)) { ko = true; continue; }
        for (const x of r) if (x && x.contenu) contenus.set(x.id, x.contenu);
      }
      for (const l of lignes) {
        const c = contenus.get(l.id);
        let octets = null;
        if (c) { try { octets = new Uint8Array(await pdfFacture(c)); } catch (_) { octets = null; } }
        if (octets && octets.length) out.ventes.push({ nom: `${l.avoir ? 'Avoir' : 'Facture'}-${slug(l.numero)}.pdf`, octets });
        else out.manque.push(`${l.avoir ? 'l’avoir' : 'la facture'} ${l.numero}${ko ? ' (pas lue)' : ''}`);
      }
    }
  }
  // 2. Les factures d'achat jointes aux achats de la période.
  const vus = new Set();
  for (const a of (d && d.achats) || []) {
    if (!a || !a.factureCle || vus.has(a.factureCle)) continue;
    vus.add(a.factureCle);
    let u = null; try { u = await lireFactureAchat(a.factureCle); } catch (_) { u = null; }
    const f = octetsDeDataUrl(u);
    const qui = [a.date, a.num ? `N°${a.num}` : '', a.reference || a.titre].filter(Boolean).join(' · ');
    if (!f) { out.manque.push(`la facture d’achat ${qui}`); continue; }
    const base = slug(['Achat', String(a.date || '').split('/').reverse().join('-'), a.num ? `N${a.num}` : '', a.reference || a.titre].filter(Boolean).join('-')) || 'Achat';
    let nom = `${base}.${f.ext}`, i = 2; while (out.achats.some((x) => x.nom === nom)) { nom = `${base}-${i}.${f.ext}`; i += 1; }
    out.achats.push({ nom, octets: f.octets });
  }
  return out;
}

// LE ZIP. Rend { octets, nom, fichiers: [chemins], d } (d : les données avec les justificatifs).
export async function zipExportComptable(d, j = { ventes: [], registreCsv: null, achats: [], manque: [] }, { PDFLib = null, quand = new Date() } = {}) {
  const dj = { ...d, justificatifs: { ventes: j.ventes.length, achats: j.achats.length, manque: j.manque.slice() } };
  const dos = dossierComptable(d.periode) + '/', lib = slug(d.libelle) || d.periode;
  const f = [
    { nom: `${dos}1-Recapitulatif-${lib}.pdf`, octets: new Uint8Array(await pdfExportComptable(dj, { PDFLib })) },
    { nom: `${dos}2-Tableur-${lib}.xlsx`, octets: xlsxClasseur(feuillesExport(dj), { titre: `Export comptable — ${d.libelle}`, quand }) },
    { nom: `${dos}2-Tableur-${lib}.csv`, texte: csvExportComptable(dj) },
  ];
  if (j.registreCsv) f.push({ nom: `${dos}Factures-de-vente/Registre-des-factures-${lib}.csv`, texte: j.registreCsv });
  for (const x of j.ventes) f.push({ nom: `${dos}Factures-de-vente/${x.nom}`, octets: x.octets });
  for (const x of j.achats) f.push({ nom: `${dos}Factures-d-achat/${x.nom}`, octets: x.octets });
  return { octets: zipStocke(f, quand), nom: nomZipComptable(d.periode), fichiers: f.map((x) => x.nom), d: dj };
}

// Le partage natif (feuille de partage du téléphone, du Mac) ; sinon le téléchargement.
// Rend 'partage' · 'annule' (il a fermé la feuille : rien d'autre) · 'telecharge'.
export async function partagerOuTelecharger(octets, nom, { nav = globalThis.navigator, telecharger } = {}) {
  const type = 'application/zip';
  try {
    if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && typeof File === 'function') {
      const fichier = new File([octets], nom, { type });
      if (nav.canShare({ files: [fichier] })) { await nav.share({ files: [fichier], title: nom }); return 'partage'; }
    }
  } catch (e) { if (e && e.name === 'AbortError') return 'annule'; }
  telecharger(new Blob([octets], { type }), nom, type);
  return 'telecharge';
}
