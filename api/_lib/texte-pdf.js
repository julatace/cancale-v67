// ════════════════════════════════════════════════════════════════════════════
//  LE TEXTE D'UN PDF, SANS IA (9 nov., « transporteurs inconnus »)
//  Un extracteur LÉGER, côté serveur, sur pdf-lib (déjà là pour le tamponnage :
//  api/_lib/stamp.js) — aucune dépendance de plus, aucune clé, aucun appel.
//  Il lit les flux de contenu des premières pages (et leurs formulaires XObject),
//  décode les chaînes des opérateurs de texte (Tj, TJ, ', ") avec la table
//  ToUnicode de la police quand elle existe, sinon octet = caractère (polices
//  simples). Ce qu'il ne sait pas lire (police CID sans ToUnicode, texte dessiné
//  en image, logo) ne donne RIEN — jamais un texte inventé.
//  Bornes : PDF ≤ 3 Mo, 4 pages, 2 Mo de contenu décodé, 20 000 caractères rendus.
//  Rend une chaîne ('' = aucun texte lisible) ou null (PDF illisible).
// ════════════════════════════════════════════════════════════════════════════
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, PDFRef, decodePDFRawStream } from 'pdf-lib';

export const PDF_MAX_OCTETS = 3_000_000;
const PAGES_MAX = 4;
const CONTENU_MAX = 2_000_000;
const TEXTE_MAX = 20_000;
const PROFONDEUR_MAX = 3;

const octetsDe = (src) => {
  if (src == null) return null;
  if (src instanceof Uint8Array) return src;
  if (typeof src === 'string') { try { return new Uint8Array(Buffer.from(src, 'base64')); } catch (_) { return null; } }
  return null;
};
export const estPdf = (u) => !!(u && u.length >= 5 && u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46);

const lookup = (ctx, o) => (o instanceof PDFRef ? ctx.lookup(o) : o);
const fluxOctets = (ctx, o) => {
  const s = lookup(ctx, o);
  if (s instanceof PDFRawStream) { try { return decodePDFRawStream(s).decode(); } catch (_) { return null; } }
  if (s && typeof s.getContents === 'function') { try { return s.getContents(); } catch (_) { return null; } }
  return null;
};
const nom = (n) => (n instanceof PDFName ? n.decodeText() : (n == null ? '' : String(n)).replace(/^\//, ''));

// ── LA TABLE ToUnicode (bfchar / bfrange) ───────────────────────────────────
const hexVersTexte = (h) => {
  const s = String(h).replace(/[^0-9a-f]/gi, '');
  let out = '';
  for (let i = 0; i + 3 < s.length + 0; i += 4) out += String.fromCharCode(parseInt(s.slice(i, i + 4), 16));
  if (s.length === 2) out = String.fromCharCode(parseInt(s, 16));
  return out;
};
export function lireToUnicode(texte) {
  const map = new Map();
  let largeur = 1;
  const t = String(texte || '');
  const cs = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(t);
  if (cs) largeur = Math.max(1, Math.ceil(cs[1].length / 2));
  for (const bloc of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of bloc[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) {
      map.set(parseInt(m[1], 16), hexVersTexte(m[2]));
      largeur = Math.max(largeur, Math.ceil(m[1].length / 2));
    }
  }
  for (const bloc of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of bloc[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16);
      largeur = Math.max(largeur, Math.ceil(m[1].length / 2));
      if (!(hi >= lo) || hi - lo > 65535) continue;
      if (m[3].startsWith('[')) {
        const vals = [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => hexVersTexte(x[1]));
        for (let c = lo; c <= hi && c - lo < vals.length; c++) map.set(c, vals[c - lo]);
      } else {
        const base = m[3].slice(1, -1);
        const s = hexVersTexte(base);
        if (!s) continue;
        const dernier = s.charCodeAt(s.length - 1);
        for (let c = lo; c <= hi; c++) map.set(c, s.slice(0, -1) + String.fromCharCode(dernier + (c - lo)));
      }
    }
  }
  return { map, largeur };
}

// Noms de glyphes courants (polices simples avec /Differences).
const GLYPHES = { space: ' ', zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  hyphen: '-', period: '.', comma: ',', colon: ':', slash: '/', underscore: '_', numbersign: '#', degree: '°', ordmasculine: 'º',
  eacute: 'é', egrave: 'è', ecircumflex: 'ê', agrave: 'à', ccedilla: 'ç', quoteright: '’', apostrophe: "'", parenleft: '(', parenright: ')' };

function decodeurPolice(ctx, fontObj) {
  const f = lookup(ctx, fontObj);
  if (!(f instanceof PDFDict)) return { lire: () => '' };
  const sous = nom(f.get(PDFName.of('Subtype')));
  let tu = null;
  const tuRef = f.get(PDFName.of('ToUnicode'));
  if (tuRef) { const o = fluxOctets(ctx, tuRef); if (o) tu = lireToUnicode(Buffer.from(o).toString('latin1')); }
  const composite = sous === 'Type0';
  const largeur = tu ? (composite ? Math.max(2, tu.largeur) : tu.largeur) : (composite ? 2 : 1);
  // /Differences (polices simples sans ToUnicode)
  let diff = null;
  if (!tu && !composite) {
    const enc = lookup(ctx, f.get(PDFName.of('Encoding')));
    if (enc instanceof PDFDict) {
      const d = lookup(ctx, enc.get(PDFName.of('Differences')));
      if (d instanceof PDFArray) {
        diff = new Map(); let code = 0;
        for (let i = 0; i < d.size(); i++) {
          const x = d.get(i);
          if (x instanceof PDFName) { const g = x.decodeText(); diff.set(code, g.length === 1 ? g : (GLYPHES[g] || '')); code++; }
          else if (x && typeof x.asNumber === 'function') code = x.asNumber();
        }
      }
    }
  }
  return {
    lire: (octets) => {
      let out = '';
      for (let i = 0; i + largeur <= octets.length; i += largeur) {
        let c = 0; for (let k = 0; k < largeur; k++) c = c * 256 + octets[i + k];
        if (tu) { const s = tu.map.get(c); if (s != null) out += s; else if (!composite && c >= 32 && c < 127) out += String.fromCharCode(c); }
        else if (composite) { /* CID sans table : illisible, rien d'inventé */ }
        else if (diff && diff.has(c)) out += diff.get(c);
        else if (c >= 32 && c !== 127) out += String.fromCharCode(c);
      }
      return out;
    },
  };
}

// ── LE FLUX DE CONTENU ──────────────────────────────────────────────────────
const ESPACE = (b) => b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09 || b === 0x0c || b === 0x00;
const DELIM = (b) => b === 0x28 || b === 0x29 || b === 0x3c || b === 0x3e || b === 0x5b || b === 0x5d || b === 0x7b || b === 0x7d || b === 0x2f || b === 0x25;

function* jetons(u) {
  let i = 0; const n = u.length;
  while (i < n) {
    const b = u[i];
    if (ESPACE(b)) { i++; continue; }
    if (b === 0x25) { while (i < n && u[i] !== 0x0a && u[i] !== 0x0d) i++; continue; }      // commentaire
    if (b === 0x28) {                                                                       // (chaîne)
      const out = []; let prof = 1; i++;
      while (i < n && prof > 0) {
        const c = u[i];
        if (c === 0x5c) {
          const e = u[i + 1]; i += 2;
          if (e === 0x6e) out.push(10); else if (e === 0x72) out.push(13); else if (e === 0x74) out.push(9);
          else if (e === 0x62) out.push(8); else if (e === 0x66) out.push(12);
          else if (e >= 0x30 && e <= 0x37) { let v = e - 0x30, k = 0; while (k < 2 && u[i] >= 0x30 && u[i] <= 0x37) { v = v * 8 + (u[i] - 0x30); i++; k++; } out.push(v & 255); }
          else if (e === 0x0a || e === 0x0d) { if (e === 0x0d && u[i] === 0x0a) i++; }
          else if (e != null) out.push(e);
          continue;
        }
        if (c === 0x28) prof++;
        else if (c === 0x29) { prof--; if (prof === 0) { i++; break; } }
        out.push(c); i++;
      }
      yield { t: 's', v: Uint8Array.from(out) }; continue;
    }
    if (b === 0x3c && u[i + 1] === 0x3c) { yield { t: 'd<' }; i += 2; continue; }
    if (b === 0x3e && u[i + 1] === 0x3e) { yield { t: 'd>' }; i += 2; continue; }
    if (b === 0x3c) {                                                                       // <hex>
      let j = i + 1; let h = '';
      while (j < n && u[j] !== 0x3e) { const c = u[j]; if (!ESPACE(c)) h += String.fromCharCode(c); j++; }
      if (h.length % 2) h += '0';
      const out = new Uint8Array(h.length / 2);
      for (let k = 0; k < out.length; k++) out[k] = parseInt(h.slice(k * 2, k * 2 + 2), 16) || 0;
      yield { t: 's', v: out }; i = j + 1; continue;
    }
    if (b === 0x5b) { yield { t: '[' }; i++; continue; }
    if (b === 0x5d) { yield { t: ']' }; i++; continue; }
    if (b === 0x7b || b === 0x7d || b === 0x3e || b === 0x29) { i++; continue; }
    if (b === 0x2f) { let j = i + 1; while (j < n && !ESPACE(u[j]) && !DELIM(u[j])) j++; yield { t: 'n', v: Buffer.from(u.subarray(i + 1, j)).toString('latin1') }; i = j; continue; }
    let j = i; while (j < n && !ESPACE(u[j]) && !DELIM(u[j])) j++;
    if (j === i) { i++; continue; }
    const mot = Buffer.from(u.subarray(i, j)).toString('latin1'); i = j;
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(mot)) { yield { t: '#', v: Number(mot) }; continue; }
    if (mot === 'ID') {                                                                     // image en ligne : sauter les octets
      let k = i + 1;
      while (k < n - 2 && !(ESPACE(u[k - 1]) && u[k] === 0x45 && u[k + 1] === 0x49 && (k + 2 >= n || ESPACE(u[k + 2]) || DELIM(u[k + 2])))) k++;
      i = k + 2; continue;
    }
    yield { t: 'op', v: mot };
  }
}

function lireContenu(ctx, octets, ressources, sortie, prof, budget) {
  if (!octets || prof > PROFONDEUR_MAX) return;
  budget.octets += octets.length;
  if (budget.octets > CONTENU_MAX) return;
  const res = lookup(ctx, ressources);
  const polices = new Map();
  const xobjs = (() => { if (!(res instanceof PDFDict)) return null; const x = lookup(ctx, res.get(PDFName.of('XObject'))); return x instanceof PDFDict ? x : null; })();
  const dictPolices = (() => { if (!(res instanceof PDFDict)) return null; const x = lookup(ctx, res.get(PDFName.of('Font'))); return x instanceof PDFDict ? x : null; })();
  const police = (n) => {
    if (polices.has(n)) return polices.get(n);
    const f = dictPolices ? dictPolices.get(PDFName.of(n)) : null;
    const d = f ? decodeurPolice(ctx, f) : { lire: (o) => Buffer.from(o).toString('latin1').replace(/[^\x20-\x7e\xa0-\xff]/g, '') };
    polices.set(n, d); return d;
  };
  let pile = []; let tableau = null; let cour = null; let dictProf = 0;
  const ecrire = (s) => { if (s && sortie.t.length < TEXTE_MAX) sortie.t += s; };
  for (const j of jetons(octets)) {
    if (sortie.t.length >= TEXTE_MAX) return;
    if (j.t === 'd<') { dictProf++; continue; }
    if (j.t === 'd>') { dictProf = Math.max(0, dictProf - 1); continue; }
    if (dictProf > 0) continue;
    if (j.t === '[') { tableau = []; continue; }
    if (j.t === ']') { pile.push({ t: 'a', v: tableau || [] }); tableau = null; continue; }
    if (j.t !== 'op') { if (tableau) tableau.push(j); else pile.push(j); continue; }
    const op = j.v;
    const dernier = pile[pile.length - 1];
    if (op === 'Tf') { const n = pile.find((x) => x.t === 'n'); if (n) cour = police(n.v); }
    else if (op === 'Tj' || op === "'" || op === '"') { if (op !== 'Tj') ecrire('\n'); if (dernier && dernier.t === 's') ecrire((cour || police('')).lire(dernier.v)); }
    else if (op === 'TJ') {
      if (dernier && dernier.t === 'a') for (const x of dernier.v) {
        if (x.t === 's') ecrire((cour || police('')).lire(x.v));
        else if (x.t === '#' && x.v < -250) ecrire(' ');
      }
    }
    else if (op === 'T*' || op === 'ET') ecrire('\n');
    else if (op === 'Td' || op === 'TD' || op === 'Tm') ecrire(' ');
    else if (op === 'Do' && xobjs) {
      const n = pile.find((x) => x.t === 'n');
      const xo = n ? lookup(ctx, xobjs.get(PDFName.of(n.v))) : null;
      if (xo && xo.dict && nom(xo.dict.get(PDFName.of('Subtype'))) === 'Form') {
        ecrire('\n');
        lireContenu(ctx, fluxOctets(ctx, xo), xo.dict.get(PDFName.of('Resources')) || res, sortie, prof + 1, budget);
        ecrire('\n');
      }
    }
    pile = [];
  }
}

// Le texte d'un PDF (base64 ou octets). '' = rien de lisible ; null = PDF illisible.
export async function texteDuPdf(src) {
  const u = octetsDe(src);
  if (!u || !estPdf(u) || u.length > PDF_MAX_OCTETS) return null;
  let doc;
  try { doc = await PDFDocument.load(u, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false }); } catch (_) { return null; }
  try {
    const ctx = doc.context;
    const sortie = { t: '' }; const budget = { octets: 0 };
    const pages = doc.getPages().slice(0, PAGES_MAX);
    for (const p of pages) {
      const node = p.node;
      const c = lookup(ctx, node.get(PDFName.of('Contents')));
      const parts = c instanceof PDFArray ? Array.from({ length: c.size() }, (_, i) => c.get(i)) : (c ? [c] : []);
      const morceaux = parts.map((x) => fluxOctets(ctx, x)).filter(Boolean);
      const tout = new Uint8Array(morceaux.reduce((s, m) => s + m.length + 1, 0));
      let k = 0; for (const m of morceaux) { tout.set(m, k); k += m.length; tout[k++] = 0x0a; }
      lireContenu(ctx, tout, node.Resources ? node.Resources() : node.get(PDFName.of('Resources')), sortie, 0, budget);
      sortie.t += '\n';
      if (budget.octets > CONTENU_MAX || sortie.t.length >= TEXTE_MAX) break;
    }
    return sortie.t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').slice(0, TEXTE_MAX);
  } catch (_) { return null; }
}
