// ═══════════════════════════════════════════════════════════════════════════
// UN CLASSEUR .xlsx SANS BIBLIOTHÈQUE (11 nov., export comptable)
// ═══════════════════════════════════════════════════════════════════════════
// Le strict nécessaire d'Office Open XML : une feuille par tableau, texte en
// « chaîne en ligne », nombres en vrais nombres (format « 0,00 » d'Excel FR),
// première ligne en gras et figée. Le zip est celui de l'export des données
// (`zipStocke`, sans compression) : Excel, Numbers et LibreOffice l'ouvrent.
//
// feuilles : [{ nom, lignes: [[cellule…]…], largeurs?: [n…], entete?: true }]
// cellule  : string · number (fini) · null/'' (vide) · { n: number } · { t: string, gras: true }
// ─────────────────────────────────────────────────────────────────────────────
import { zipStocke } from './exportDonnees.js';

const esc = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colonne = (i) => { let s = ''; let n = i + 1; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
// Un nom de feuille : 31 caractères, sans []:*?/\ ; unique.
const nomFeuille = (nom, pris) => {
  let b = String(nom || 'Feuille').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Feuille';
  let x = b, i = 2; while (pris.has(x.toLowerCase())) { x = `${b.slice(0, 28)} ${i}`; i += 1; }
  pris.add(x.toLowerCase()); return x;
};
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NSR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function celluleXml(v, ref, grasLigne) {
  if (v == null || v === '') return '';
  if (typeof v === 'number' || (v && typeof v === 'object' && typeof v.n === 'number')) {
    const n = typeof v === 'number' ? v : v.n;
    if (!Number.isFinite(n)) return '';
    return `<c r="${ref}" s="${grasLigne ? 3 : 2}"><v>${n}</v></c>`;
  }
  const t = v && typeof v === 'object' ? v.t : v;
  const gras = grasLigne || !!(v && typeof v === 'object' && v.gras);
  const s = String(t == null ? '' : t);
  if (!s) return '';
  return `<c r="${ref}" t="inlineStr"${gras ? ' s="1"' : ''}><is><t xml:space="preserve">${esc(s)}</t></is></c>`;
}
function feuilleXml(f) {
  const lignes = Array.isArray(f.lignes) ? f.lignes : [];
  const nbCol = lignes.reduce((m, l) => Math.max(m, Array.isArray(l) ? l.length : 0), 0);
  const larg = Array.isArray(f.largeurs) ? f.largeurs : [];
  const cols = nbCol ? `<cols>${Array.from({ length: nbCol }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${Number(larg[i]) > 0 ? Number(larg[i]) : 14}" customWidth="1"/>`).join('')}</cols>` : '';
  const fige = f.entete !== false && lignes.length > 1 ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
  const rows = lignes.map((l, r) => {
    const cells = (Array.isArray(l) ? l : []).map((v, c) => celluleXml(v, colonne(c) + (r + 1), f.entete !== false && r === 0)).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');
  return `${XML}<worksheet xmlns="${NS}" xmlns:r="${NSR}">${fige}${cols}<sheetData>${rows}</sheetData></worksheet>`;
}
const STYLES = `${XML}<styleSheet xmlns="${NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>`
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

// Les fichiers du classeur (pour le zip) — exposé pour l'audit.
export function partiesXlsx(feuilles, { titre = '' } = {}) {
  const pris = new Set();
  const fs = (Array.isArray(feuilles) && feuilles.length ? feuilles : [{ nom: 'Feuille', lignes: [] }]).map((f) => ({ ...f, nom: nomFeuille(f.nom, pris) }));
  const types = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    + fs.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>';
  const rels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NSR}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const core = `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(titre)}</dc:title><dc:creator>VRM</dc:creator></cp:coreProperties>`;
  const wb = `${XML}<workbook xmlns="${NS}" xmlns:r="${NSR}"><sheets>${fs.map((f, i) => `<sheet name="${esc(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
  const wbRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${fs.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NSR}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${fs.length + 1}" Type="${NSR}/styles" Target="styles.xml"/></Relationships>`;
  return [
    { nom: '[Content_Types].xml', texte: types }, { nom: '_rels/.rels', texte: rels }, { nom: 'docProps/core.xml', texte: core },
    { nom: 'xl/workbook.xml', texte: wb }, { nom: 'xl/_rels/workbook.xml.rels', texte: wbRels }, { nom: 'xl/styles.xml', texte: STYLES },
    ...fs.map((f, i) => ({ nom: `xl/worksheets/sheet${i + 1}.xml`, texte: feuilleXml(f) })),
  ];
}
export const xlsxClasseur = (feuilles, opts = {}) => zipStocke(partiesXlsx(feuilles, opts), opts.quand || new Date());
