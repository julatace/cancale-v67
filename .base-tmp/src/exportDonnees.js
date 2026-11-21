import { jourParis } from './dateParis.js';
// ════════════════════════════════════════════════════════════════════════════
//  « EXPORTER MES DONNÉES » (3 nov. 2026, Julien 14 h 09)
// ════════════════════════════════════════════════════════════════════════════
// Paramètres → « Exporter mes données » ⇒ un fichier téléchargé sur l'appareil
// (rien n'est envoyé ailleurs) : des tableaux CSV (séparateur « ; », virgule
// décimale, BOM — Excel et Numbers les ouvrent) rangés dans UN zip. Aucune
// bibliothèque de classeur n'est dans le dépôt (ni xlsx, ni zip) : le zip est
// écrit ici, sans compression (méthode « stored »), CRC-32 compris.
//
// AUCUN CALCUL ICI (§5, une seule règle par notion) : chaque feuille RECOPIE ce
// que l'écran propriétaire a publié ou lu —
//   · Ventes     = le relevé de Ventes (`vrm_stats_ventes`, toutes plateformes) :
//                  les MÊMES lignes que le récap du mois et les statistiques ;
//   · URSSAF     = la ligne publiée (`vinted_urssaf_mois`, CA daté au versement)
//                  et la part à payer de la règle de l'app (`aPayerUrssaf`, passée) ;
//   · Déclarations = le registre « J'ai déclaré » (`vrm_urssaf_declare`) ;
//   · Stock      = les fiches N° (`vinted_annonce_numeros`) ;
//   · Achats     = les achats captés (lus PAGINÉS, projetés), avec le N° relié ;
//   · Dépenses   = `vrm_compta` (fixes, dépenses, packs, abonnements) ;
//   · Factures Pro = les métadonnées (numéro, transaction, état, date) — jamais le PDF.
// « Pas su » s'écrit « — » (jamais 0, jamais une feuille vide qui se ferait
// passer pour « rien »).

const nb = (x) => (x == null || x === '' || !Number.isFinite(Number(x)) ? '' : (Math.round(Number(x) * 100) / 100).toFixed(2).replace('.', ','));
const jourIso = (t) => jourParis(typeof t === 'number' ? t : String(t || ''));   // (11 nov.) jour de PARIS, jamais UTC
const PAS_SU = [['—']];

// ── Les feuilles ────────────────────────────────────────────────────────────
// Chaque source : `null` = pas su (la feuille dit « — »), sinon la valeur lue.
export function feuillesExport({ releve = null, urssaf = null, aPayer = null, declarations = null, fiches = null, achats = null, compta = null, factures = null } = {}) {
  const F = [];
  // Ventes — le relevé : [site, compte, transaction, ts, vendu, achat, frais, titre, N°, reçu le]
  F.push({ nom: 'ventes', lignes: Array.isArray(releve) ? [['Date', 'Site', 'Compte', 'Transaction', 'N°', 'Titre', 'Vendu (€)', "Prix d'achat (€)", 'Frais (€)', 'Reçu le'],
    ...releve.filter(Array.isArray).slice().sort((a, b) => (Number(a[3]) || 0) - (Number(b[3]) || 0))
      .map((l) => [jourIso(Number(l[3])), l[0] || '', l[1] || '', l[2] || '', l[8] || '', l[7] || '', nb(l[4]), nb(l[5]), nb(l[6]), l[9] ? jourIso(l[9]) : ''])] : PAS_SU });
  // Achats captés, + le N° qui les porte (lien posé par lui).
  const nParTx = new Map();
  for (const [, e] of Object.entries(fiches || {})) if (e && e.buyFromId != null && String(e.buyFromId) !== '') { const k = String(e.buyFromId); nParTx.set(k, [...(nParTx.get(k) || []), String(e.numero || '')].filter(Boolean)); }
  F.push({ nom: 'achats', lignes: Array.isArray(achats) ? [['Date', 'Compte', 'Transaction', 'Titre', 'Prix payé (€)', 'Statut', 'N° relié'],
    ...achats.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .map((a) => [jourIso(a.date), a.compte || '', String(a.transaction_id || ''), a.title || '', nb(a.price && typeof a.price === 'object' ? a.price.amount : a.price), a.status || '', (nParTx.get(String(a.transaction_id)) || []).join(' + ')])] : PAS_SU });
  // Stock et N°
  F.push({ nom: 'stock', lignes: fiches && typeof fiches === 'object' ? [['N°', 'Titre', "Prix d'achat (€)", 'Achat relié (transaction)', 'Annonce'],
    ...Object.entries(fiches).filter(([, e]) => e && String(e.numero == null ? '' : e.numero).trim())
      .sort((a, b) => String(a[1].numero).localeCompare(String(b[1].numero), 'fr', { numeric: true }))
      .map(([id, e]) => [String(e.numero), e.title || '', nb(String(e.buyPrice == null ? '' : e.buyPrice).replace(',', '.')), e.buyFromId ? String(e.buyFromId) : '', id])] : PAS_SU });
  // Dépenses
  if (compta && typeof compta === 'object') {
    const L = [['Date', 'Type', 'Libellé', 'Catégorie', 'Montant (€)']];
    for (const x of compta.fixes || []) L.push(['', 'Coût fixe (par mois)', x.label || x.libelle || '', '', nb(x.montant)]);
    for (const x of compta.depenses || []) L.push([x.date || '', 'Dépense', x.libelle || '', x.cat || '', nb(x.montant)]);
    for (const x of compta.packs || []) L.push([x.date || '', 'Pack', x.plateforme || '', '', nb(x.montant)]);
    for (const a of compta.abonnements || []) L.push([a.debut || a.date || '', 'Abonnement', a.libelle || '', a.frequence || a.rythme || '', nb(a.montant)]);
    F.push({ nom: 'depenses', lignes: L });
  } else F.push({ nom: 'depenses', lignes: PAS_SU });
  // URSSAF par mois (ligne publiée) et déclarations
  F.push({ nom: 'urssaf', lignes: Array.isArray(urssaf) ? [['Mois', 'Ventes', 'CA déclaré, daté au versement (€)', 'À payer (€)'],
    ...urssaf.slice().sort((a, b) => String(a.ym).localeCompare(String(b.ym)))
      .map((m) => [String(m.ym || ''), m.n == null ? '' : String(m.n), nb(m.ca), typeof aPayer === 'function' ? nb(aPayer(Number(m.ca) || 0)) : ''])] : PAS_SU });
  F.push({ nom: 'declarations', lignes: declarations && typeof declarations === 'object' ? [['Mois', 'Noté le', 'CA déclaré (€)', 'Montant déclaré (€)', 'Payé (€)', 'Règle', 'Ventes'],
    ...Object.entries(declarations).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, d]) => [ym, d && d.at ? jourIso(Number(d.at)) : '', nb(d && d.ca), nb(d && d.montant), nb(d && d.paye), (d && d.regle) || '', d && d.n != null ? String(d.n) : ''])] : PAS_SU });
  // Factures Pro (métadonnées)
  F.push({ nom: 'factures-pro', lignes: Array.isArray(factures) ? [['Numéro', 'Transaction', 'État', 'Émise le', 'Annulée par', 'Ligne'],
    ...factures.slice().sort((a, b) => String(a.number || '').localeCompare(String(b.number || ''), 'fr', { numeric: true }))
      .map((f) => [f.number || '', f.tx || '', f.status || '', f.emiseLe ? jourIso(f.emiseLe) : '', f.annuleePar || '', f.id || ''])] : PAS_SU });
  return F;
}

// ── CSV ─────────────────────────────────────────────────────────────────────
const cellule = (v) => { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const csvDe = (lignes) => '﻿' + lignes.map((l) => l.map(cellule).join(';')).join('\r\n') + '\r\n';
// Relire un CSV écrit par `csvDe` (pour l'audit : l'export dit-il les mêmes chiffres ?).
export function lireCsv(texte) {
  const t = String(texte || '').replace(/^﻿/, ''); const out = []; let l = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; continue; }
    if (ch === '"') q = true; else if (ch === ';') { l.push(c); c = ''; } else if (ch === '\n') { l.push(c); out.push(l); l = []; c = ''; } else if (ch !== '\r') c += ch;
  }
  if (c || l.length) { l.push(c); out.push(l); }
  return out;
}

// ── Le zip (méthode « stored », sans compression) ───────────────────────────
let TABLE = null;
export function crc32(octets) {
  if (!TABLE) { TABLE = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c >>> 0; } }
  let c = 0xFFFFFFFF; for (let i = 0; i < octets.length; i++) c = TABLE[(c ^ octets[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// fichiers : [{ nom, texte }] ⇒ Uint8Array (un zip lisible partout).
export function zipStocke(fichiers, quand = new Date()) {
  // (10 nov., lot Q) Un fichier porte `texte` OU `octets` (Uint8Array : un PDF).
  const enc = new TextEncoder();
  const dosT = ((quand.getHours() << 11) | (quand.getMinutes() << 5) | (quand.getSeconds() >> 1)) & 0xFFFF;
  const dosD = (((quand.getFullYear() - 1980) << 9) | ((quand.getMonth() + 1) << 5) | quand.getDate()) & 0xFFFF;
  const locaux = [], centraux = []; let decal = 0;
  for (const f of fichiers) {
    const nom = enc.encode(f.nom), data = f.octets instanceof Uint8Array ? f.octets : enc.encode(f.texte), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dosT, true); h.setUint16(12, dosD, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, nom.length, true); h.setUint16(28, 0, true);
    locaux.push(new Uint8Array(h.buffer), nom, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dosT, true); c.setUint16(14, dosD, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, nom.length, true); c.setUint32(42, decal, true);
    centraux.push(new Uint8Array(c.buffer), nom);
    decal += 30 + nom.length + data.length;
  }
  const tailleC = centraux.reduce((t, x) => t + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleC, true); fin.setUint32(16, decal, true);
  const parts = [...locaux, ...centraux, new Uint8Array(fin.buffer)];
  const out = new Uint8Array(parts.reduce((t, x) => t + x.length, 0)); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
// Relire un zip « stored » (audit) : [{ nom, texte, crcOk }].
export function lireZipStocke(octets) {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength), dec = new TextDecoder(); const out = []; let o = 0;
  while (o + 30 <= octets.length && v.getUint32(o, true) === 0x04034b50) {
    const crc = v.getUint32(o + 14, true), n = v.getUint32(o + 18, true), ln = v.getUint16(o + 26, true), lx = v.getUint16(o + 28, true);
    const nom = dec.decode(octets.subarray(o + 30, o + 30 + ln)), data = octets.subarray(o + 30 + ln + lx, o + 30 + ln + lx + n);
    out.push({ nom, texte: dec.decode(data), octets: data, crcOk: crc32(data) === crc }); o += 30 + ln + lx + n;
  }
  return out;
}
export const nomExport = (quand = new Date()) => `VRM-donnees-${jourParis(quand)}.zip`;
export const fichiersExport = (feuilles) => feuilles.map((f) => ({ nom: f.nom + '.csv', texte: csvDe(f.lignes) }));
