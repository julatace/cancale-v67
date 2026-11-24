// ── IMPRIMER DES ÉTIQUETTES DE RANGEMENT (19 nov. 2026, lot stock-etiquetage) ───────────────
// Pour la méthode « étiquette imprimée » (src/etiquetage/methode.js) : une étiquette par N°, le N° EN GRAND, au
// format choisi (50 × 30, 62 × 29 ou planche A4 de 24). Rien d'autre que le N° — et, s'il l'a coché, le début du
// titre. AUCUN QR (refusé par Julien le 11 oct.).
// Les N° imprimés sont ceux qu'on lui passe, TELS QUELS (jamais un N° calculé ici, jamais un N° « prochain ») :
// imprimer ne donne, ne change ni ne réserve aucun numéro (CLAUDE.md §5).
// `pageEtiquettes` est pur (l'audit l'exécute) ; `imprimerEtiquettes` passe par un cadre caché (ni fenêtre, ni onglet).
import { formatDe } from './methode.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// `etiquettes` : [{ num, titre }] — un N° vide est écarté (mieux vaut un blanc qu'un faux).
export function pageEtiquettes(etiquettes, { format = '50x30', titre = false, langue = 'fr' } = {}) {
  const f = formatDe(format);
  const liste = (Array.isArray(etiquettes) ? etiquettes : []).filter((e) => e && String(e.num == null ? '' : e.num).trim());
  const corps = liste.map((e) => `<div class="e" data-etiquette-num="${esc(String(e.num).trim())}"><b>N°${esc(String(e.num).trim())}</b>${titre && e.titre ? `<span>${esc(String(e.titre).slice(0, 40))}</span>` : ''}</div>`).join('');
  const page = f.planche ? '@page { size: A4; margin: 10mm 0; }' : `@page { size: ${f.l}mm ${f.h}mm; margin: 0; }`;
  const grille = f.planche ? `body { display: grid; grid-template-columns: repeat(${f.cols}, ${f.l}mm); grid-auto-rows: ${f.h}mm; justify-content: center; }` : '';
  return `<!doctype html><html lang="${esc(langue)}"><head><meta charset="utf-8"><title>N°</title><style>
${page}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; }
${grille}
.e { width: ${f.l}mm; height: ${f.h}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1mm; overflow: hidden; page-break-inside: avoid; break-inside: avoid; ${f.planche ? 'border: 0.2mm dashed #bbb;' : 'page-break-after: always; break-after: page;'} }
.e b { font-size: ${Math.round(f.h * 0.45)}mm; line-height: 1; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.e span { font-size: 3mm; line-height: 1.15; max-width: 92%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style></head><body data-etiquettes="${liste.length}" data-format="${esc(f.v)}">${corps}</body></html>`;
}

// Imprime par un cadre caché posé dans la page (rendu `true` si l'impression a été demandée).
export function imprimerEtiquettes(etiquettes, options = {}) {
  try {
    const html = pageEtiquettes(etiquettes, options);
    const ancien = document.querySelector('iframe[data-vrm-etiquettes]'); if (ancien) ancien.remove();
    const f = document.createElement('iframe');
    f.setAttribute('data-vrm-etiquettes', String((Array.isArray(etiquettes) ? etiquettes : []).length));
    f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    f.srcdoc = html;
    f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_) {} };
    document.body.appendChild(f);
    return true;
  } catch (_) { return false; }
}
