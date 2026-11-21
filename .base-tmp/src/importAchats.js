// ═══════════════════════════════════════════════════════════════════════════
// IMPORTER SES ACHATS DEPUIS UN TABLEUR (10 nov., lot J — proposition 9 validée)
// docs/passation/2026-11-10-import-partage-aide.md
// ═══════════════════════════════════════════════════════════════════════════
// Un nouveau vendeur arrive avec son Excel : date, ce qu'il a acheté, le prix
// payé, où, une référence, parfois le N° de rangement. On le lit DANS LE
// NAVIGATEUR (rien n'est envoyé ailleurs), on montre chaque ligne, et RIEN n'est
// écrit sans « Importer N achats ».
//   · CSV (« ; », « , » ou tabulation ; UTF-8 ou l'encodage d'Excel Windows) ;
//   · .xlsx lu SANS dépendance : un .xlsx est un zip de XML ; le navigateur sait
//     décompresser (`DecompressionStream('deflate-raw')`), le reste est ici.
//     Aucune bibliothèque ajoutée (licence, poids : rien à vérifier).
// Règles (CLAUDE.md §2.5, §5) :
//   · le PRIX vient de SON fichier, tel quel : vide ⇒ vide (jamais 0), illisible
//     ⇒ la ligne est écartée et on dit pourquoi — jamais deviné ;
//   · une DATE illisible ou absente écarte la ligne (jamais « aujourd'hui ») ;
//     « 03/04/2026 » se lit à la française (jour/mois), un mois > 12 est illisible ;
//   · un DOUBLON se reconnaît par la RÉFÉRENCE seulement (`refAchat`, la règle de
//     src/achatsDoubles.js) : déjà dans VRM, ou deux fois dans le fichier. Jamais
//     par le titre, le prix ou la date : cinquante lignes identiques sans
//     référence entrent toutes (dit dans l'aperçu) ;
//   · le N° : après la remise à zéro des numéros, un « 230 » écrit AVANT la
//     coupure désigne l'ANCIENNE paire (B230) — la traduction est celle de l'app
//     (`numeroExterne`, passée en `numeroDe`) ; sans date, pas de N° (pas su) ;
//   · le prix du fichier ne devient le coût d'une paire QUE si son N° désigne une
//     seule fiche qui n'a AUCUN prix : un prix déjà là n'est jamais remplacé.
// Module PUR (sauf `lireXlsx`, qui a besoin de `DecompressionStream`) : exécuté
// par scripts/audit-import-achats.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { refAchat } from './achatsDoubles.js';
import { motsVendeur } from './profilVendeur.js';
import { prixAchatSaisi } from './prixAuNumerotage.js';

export const TAILLE_MAX = 5 * 1024 * 1024;   // 5 Mo
export const LIGNES_MAX = 2000;
export const CHAMPS = ['date', 'titre', 'prix', 'ou', 'ref', 'numero'];
export const NOMS_CHAMPS = { date: 'Date', titre: 'Description', prix: 'Prix', ou: 'Où', ref: 'Référence', numero: 'N°', '': 'Ignorer' };

// ── Les colonnes ──────────────────────────────────────────────────────────────
const net = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/°/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
// L'ordre COMPTE : « N° de commande » est une référence, pas un N° de rangement.
const MOTS = [
  ['ref', /^(ref|refs|reference|references|ref achat|n commande|no commande|num commande|numero commande|numero de commande|n de commande|no de commande|commande|n facture|no facture|numero facture|numero de facture|n de facture|facture|transaction|n transaction|numero de transaction|id transaction|order|order id)$/],
  ['ref', /\b(commande|facture|transaction|reference)\b/],
  ['numero', /^(n|no|num|numero|nr|n rangement|numero de rangement|rangement|n vrm|numero vrm|n carton|carton|sku)$/],
  ['date', /^(date|jour|date d achat|date achat|achete le|date de l achat)$/],
  ['date', /\bdate\b/],
  ['prix', /^(prix|prix d achat|prix achat|prix paye|montant|cout|cout d achat|total|paye|achat|price)$/],
  ['prix', /\b(prix|montant|cout)\b/],
  ['titre', /^(description|article|titre|designation|produit|modele|nom|libelle|objet|paire|item)$/],
  ['titre', /\b(description|article|titre|designation|produit|modele)\b/],
  ['ou', /^(ou|lieu|source|fournisseur|magasin|provenance|vendeur|plateforme|site|origine|boutique)$/],
  ['ou', /\b(lieu|source|fournisseur|magasin|provenance)\b/],
];
export function champDeColonne(entete) {
  const n = net(entete);
  if (!n) return '';
  for (const [champ, re] of MOTS) if (re.test(n)) return champ;
  return '';
}
// La correspondance proposée : une colonne par champ (la première qui le dit).
export function reconnaitreColonnes(entetes) {
  const pris = new Set();
  return (Array.isArray(entetes) ? entetes : []).map((e) => {
    const c = champDeColonne(e);
    if (!c || pris.has(c)) return '';
    pris.add(c);
    return c;
  });
}
export const colonnesSuffisantes = (colonnes) => ['date', 'titre', 'prix'].filter((c) => !(colonnes || []).includes(c));

// ── CSV ───────────────────────────────────────────────────────────────────────
// Les octets ⇒ le texte : UTF-8 strict d'abord, sinon l'encodage d'Excel Windows.
export function decoderTexte(octets) {
  const u = octets instanceof Uint8Array ? octets : new Uint8Array(octets || []);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u).replace(/^﻿/, ''); } catch (_) {}
  try { return new TextDecoder('windows-1252').decode(u); } catch (_) { return ''; }
}
const separateur = (ligne) => {
  let best = ';', n = -1;
  for (const s of [';', '\t', ',']) {
    let c = 0, q = false;
    for (const ch of ligne) { if (ch === '"') q = !q; else if (!q && ch === s) c++; }
    if (c > n) { n = c; best = s; }
  }
  return best;
};
export function lireCsv(texte) {
  const t = String(texte == null ? '' : texte).replace(/^﻿/, '');
  const premiere = t.split(/\r?\n/).find((l) => l.trim()) || '';
  const sep = separateur(premiere);
  const rows = [];
  let row = [], cel = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cel += '"'; i++; } else q = false; } else cel += ch;
    } else if (ch === '"' && cel === '') q = true;
    else if (ch === sep) { row.push(cel); cel = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cel); cel = ''; rows.push(row); row = [];
    } else cel += ch;
    if (rows.length > LIGNES_MAX + 1) break;
  }
  if (cel !== '' || row.length) { row.push(cel); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

// ── .xlsx (un zip de XML) ─────────────────────────────────────────────────────
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
// Les entrées du zip : nom ⇒ { methode, debut, taille }.
export function entreesZip(b) {
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { fin = i; break; }
  if (fin < 0) return null;
  const n = u16(b, fin + 10);
  let p = u32(b, fin + 16);
  const out = {};
  for (let k = 0; k < n && p + 46 <= b.length; k++) {
    if (u32(b, p) !== 0x02014b50) return null;
    const methode = u16(b, p + 10), taille = u32(b, p + 20), lNom = u16(b, p + 28), lExtra = u16(b, p + 30), lCom = u16(b, p + 32), local = u32(b, p + 42);
    const nom = new TextDecoder().decode(b.subarray(p + 46, p + 46 + lNom));
    if (u32(b, local) === 0x04034b50) out[nom] = { methode, debut: local + 30 + u16(b, local + 26) + u16(b, local + 28), taille };
    p += 46 + lNom + lExtra + lCom;
  }
  return out;
}
async function inflater(octets) {
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}
async function lireEntree(b, e) {
  if (!e) return null;
  const brut = b.subarray(e.debut, e.debut + e.taille);
  if (e.methode === 0) return new TextDecoder().decode(brut);
  if (e.methode === 8) return new TextDecoder().decode(await inflater(brut));
  return null;
}
const xml = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&');
const textesT = (s) => [...String(s).replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => xml(m[1])).join('');
const colIndex = (ref) => { const l = (/^[A-Z]+/.exec(ref) || [''])[0]; let n = 0; for (const c of l) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };
// Les textes XML d'un classeur ⇒ ses lignes (la première feuille). Une cellule
// NUMÉRIQUE reste un nombre (une date Excel est un nombre de jours).
export function lignesDeFeuille(feuilleXml, partagesXml) {
  const partages = partagesXml ? [...String(partagesXml).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textesT(m[1])) : [];
  const rows = [];
  for (const m of String(feuilleXml || '').matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const r = [];
    for (const c of m[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const at = c[1], corps = c[2] || '';
      const ref = (/\br="([A-Z]+\d+)"/.exec(at) || [])[1];
      const t = (/\bt="([^"]+)"/.exec(at) || [])[1] || 'n';
      const v = (/<v>([\s\S]*?)<\/v>/.exec(corps) || [])[1];
      let val = '';
      if (t === 's') val = v != null ? (partages[Number(v)] || '') : '';
      else if (t === 'inlineStr') val = textesT(corps);
      else if (t === 'str' || t === 'e') val = v != null ? xml(v) : '';
      else if (t === 'b') val = v === '1' ? 'VRAI' : 'FAUX';
      else if (v != null && v !== '') { const n = Number(v); val = Number.isFinite(n) ? n : xml(v); }
      const i = ref ? colIndex(ref) : r.length;
      while (r.length < i) r.push('');
      r[i] = typeof val === 'string' ? val.trim() : val;
    }
    if (r.some((x) => x !== '' && x != null)) rows.push(r);
    if (rows.length > LIGNES_MAX + 1) break;
  }
  return rows;
}
export async function lireXlsx(octets) {
  const b = octets instanceof Uint8Array ? octets : new Uint8Array(octets || []);
  const E = entreesZip(b);
  if (!E) return null;
  let chemin = 'xl/worksheets/sheet1.xml';
  try {
    const wb = await lireEntree(b, E['xl/workbook.xml']);
    const rels = await lireEntree(b, E['xl/_rels/workbook.xml.rels']);
    const rid = wb && (/<sheet\b[^>]*\br:id="([^"]+)"/.exec(wb) || [])[1];
    const cible = rid && rels && (new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels) || new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels) || [])[1];
    if (cible) chemin = cible.startsWith('/') ? cible.slice(1) : 'xl/' + cible.replace(/^\.\//, '');
  } catch (_) {}
  const feuille = await lireEntree(b, E[chemin] || E['xl/worksheets/sheet1.xml']);
  if (feuille == null) return null;
  const partages = E['xl/sharedStrings.xml'] ? await lireEntree(b, E['xl/sharedStrings.xml']) : '';
  return lignesDeFeuille(feuille, partages);
}
// Le fichier ⇒ { rows } ou { erreur } (phrase courte, et quoi faire).
export async function lireFichierAchats({ nom = '', octets }) {
  const b = octets instanceof Uint8Array ? octets : new Uint8Array(octets || []);
  if (!b.length) return { erreur: 'Ce fichier est vide.' };
  if (b.length > TAILLE_MAX) return { erreur: 'Fichier trop lourd (5 Mo au plus).' };
  const zip = b[0] === 0x50 && b[1] === 0x4b;
  if (/\.xls$/i.test(nom) || (b[0] === 0xd0 && b[1] === 0xcf)) return { erreur: 'Ancien format Excel : enregistre-le en .xlsx ou .csv.' };
  if (zip || /\.xlsx$/i.test(nom)) {
    if (typeof DecompressionStream !== 'function') return { erreur: 'Ce navigateur ne lit pas les .xlsx : enregistre en .csv.' };
    try { const rows = await lireXlsx(b); if (rows) return { rows }; } catch (_) {}
    return { erreur: 'Classeur illisible : enregistre-le en .csv.' };
  }
  return { rows: lireCsv(decoderTexte(b)) };
}

// ── Les valeurs ───────────────────────────────────────────────────────────────
const iso = (a, m, j) => {
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j ? `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}` : '';
};
// « AAAA-MM-JJ », ou '' (illisible). Jamais une date inventée.
export function dateDuFichier(v) {
  if (typeof v === 'number') {
    if (!(v > 20000 && v < 80000)) return '';                   // un nombre de jours Excel (1954 → 2119)
    const d = new Date(Math.round((Math.floor(v) - 25569) * 86400000));
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(v == null ? '' : v).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$/.exec(s);
  if (m) { const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return iso(a, +m[2], +m[1]); }
  return '';
}
// Le prix : { ok:true, prix:'25,50' | '' } ou { ok:false } (illisible).
export function prixDuFichier(v) {
  if (typeof v === 'number') {
    if (!(v >= 0) || Math.abs(v * 100 - Math.round(v * 100)) > 1e-6) return { ok: false };
    return { ok: true, prix: (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') };
  }
  let s = String(v == null ? '' : v).replace(/[\s  €]|eur(os?)?/gi, '');
  if (!s) return { ok: true, prix: '' };
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '');       // 1.250,00
  else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) s = s.replace(/,/g, '');   // 1,250.00
  const p = prixAchatSaisi(s);
  return p == null ? { ok: false } : { ok: true, prix: p || '' };
}
const texte = (v, max) => String(v == null ? '' : v).replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();

// ── L'aperçu ──────────────────────────────────────────────────────────────────
// `rows` : les lignes du fichier (la première = les en-têtes) ; `colonnes` : le
// champ de chaque colonne ; `existants` : { vinted, hors } (comme achatsDoubles) ;
// `numeroDe(n°, dateMs)` ⇒ le N° (traduit), '' (vide) ou null (pas su) ;
// `etatNumero(n°)` ⇒ 'libre' (une fiche, sans prix) · 'prix' (a déjà un prix) ·
// 'absent' · 'deux' (plusieurs fiches).
// Chaque ligne : { n, etat: 'ok'|'double'|'ecartee', raison, rec, numero, coutPose }.
export function apercuImport({ rows, colonnes, existants = {}, numeroDe = null, etatNumero = null } = {}) {
  const corps = (Array.isArray(rows) ? rows : []).slice(1, LIGNES_MAX + 1);
  const col = (champ) => (colonnes || []).indexOf(champ);
  const iD = col('date'), iT = col('titre'), iP = col('prix'), iO = col('ou'), iR = col('ref'), iN = col('numero');
  const refsDeja = new Set();
  for (const o of Array.isArray(existants.vinted) ? existants.vinted : []) { const r = refAchat(o && o.transaction_id); if (r) refsDeja.add(r); }
  for (const o of Array.isArray(existants.hors) ? existants.hors : []) { const r = refAchat(o && o.ref); if (r) refsDeja.add(r); }
  const refsFichier = new Set();
  const numsPoses = new Set();
  return corps.map((r, k) => {
    const val = (i) => (i >= 0 ? r[i] : '');
    const ligne = { n: k + 2, etat: 'ok', raison: '', rec: null, numero: '', coutPose: false };
    const titre = texte(val(iT), 80);
    const date = dateDuFichier(val(iD));
    const prix = prixDuFichier(val(iP));
    const refBrute = texte(val(iR), 40);
    const ref = refAchat(refBrute);
    if (!titre) return { ...ligne, etat: 'ecartee', raison: 'Description vide' };
    if (!date) return { ...ligne, etat: 'ecartee', raison: 'Date illisible', apercu: titre };
    if (!prix.ok) return { ...ligne, etat: 'ecartee', raison: 'Prix illisible', apercu: titre };
    if (ref && refsDeja.has(ref)) return { ...ligne, etat: 'double', raison: 'Déjà dans VRM (même référence)', apercu: titre };
    if (ref && refsFichier.has(ref)) return { ...ligne, etat: 'double', raison: 'Deux fois dans le fichier', apercu: titre };
    if (ref) refsFichier.add(ref);
    let numero = '';
    let noteNumero = '';
    const brutNum = texte(val(iN), 12);
    if (brutNum) {
      const dms = Date.parse(date + 'T12:00:00');
      const t = numeroDe ? numeroDe(brutNum, dms) : brutNum;
      if (t == null) noteNumero = 'N° pas su';
      else numero = String(t);
    }
    let coutPose = false;
    if (numero && prix.prix && etatNumero) {
      const e = etatNumero(numero);
      if (e === 'libre' && !numsPoses.has(numero)) { coutPose = true; numsPoses.add(numero); }
      else noteNumero = e === 'prix' ? 'a déjà un prix' : e === 'deux' ? `sur deux ${motsVendeur().noms}` : e === 'absent' ? '' : 'déjà posé plus haut';
    }
    const rec = { title: titre, price: prix.prix, date, source: texte(val(iO), 40), numero, ref: refBrute || undefined };
    return { ...ligne, rec, numero, coutPose, noteNumero, sansRef: !ref };
  });
}
export function resumeImport(lignes) {
  const L = Array.isArray(lignes) ? lignes : [];
  const ok = L.filter((l) => l.etat === 'ok');
  return {
    total: L.length, ok: ok.length,
    doubles: L.filter((l) => l.etat === 'double').length,
    ecartees: L.filter((l) => l.etat === 'ecartee').length,
    sansRef: ok.filter((l) => l.sansRef).length,
    couts: ok.filter((l) => l.coutPose).length,
    sansPrix: ok.filter((l) => !l.rec.price).length,
  };
}
// Ce qui part sur « Importer N achats » : les achats (id neufs) et les coûts à
// poser par N° (seulement les N° « libres »). Rien d'autre.
export function ecrituresImport(lignes, nouvelId, maintenant = new Date().toISOString()) {
  const achats = [], couts = {};
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (!l || l.etat !== 'ok' || !l.rec) continue;
    const rec = { id: nouvelId(), createdAt: maintenant, importe: true, ...l.rec };
    if (!rec.numero) delete rec.numero;
    if (!rec.ref) delete rec.ref;
    if (!rec.source) delete rec.source;
    achats.push(rec);
    if (l.coutPose && l.numero && l.rec.price) couts[l.numero] = l.rec.price;
  }
  return { achats, couts };
}
