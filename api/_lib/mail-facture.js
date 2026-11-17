// api/_lib/mail-facture.js
// ════════════════════════════════════════════════════════════════════════════
// L'E-MAIL D'UNE FACTURE (ou d'un avoir) À L'ACHETEUR — une forme SOBRE, à part
// (16 nov., lot factures-mieux ; Julien, deux captures iPhone : « tu peux améliorer
// les factures et le procédé »). L'e-mail reçu montrait l'anglais PUIS le français
// empilés, dans le cadre bleu épais de la forme « Verre dépoli » des e-mails de VRM
// (api/_lib/mail-verre.js) : lourd, et pas l'air d'un document d'entreprise.
//
// Ce n'est PAS un e-mail de VRM : c'est la facture du VENDEUR à SON client. Il a
// donc sa propre forme, celle d'un courrier d'entreprise :
//   1. en tête, le NOM de la boutique (avec « EI » s'il y est) sous un filet fin —
//      jamais le logo ni le mot VRM (Julien, 11 nov.) ;
//   2. un titre court (« Facture FA-2026-0006 ») puis SON message ;
//   3. un récapitulatif sur filets fins : n°, date, article, montant (le MÊME libellé
//      et le même chiffre que la dernière ligne du PDF), la mention de TVA de son
//      régime (art. 293 B, marge, ou « dont TVA ») — rien de recalculé ici ;
//   4. la ou les pièces jointes, nommées ;
//   5. au pied, ses coordonnées (nom, adresse, identité légale, e-mail).
// UNE langue : celle que dit `langue` ('fr' ou 'en', décidée par l'appelant —
// src/facturePro/regle.js `langueEmail`), jamais deux blocs empilés.
//
// Compatible clients mail : tableaux, styles EN LIGNE, largeur 600 (table fantôme
// pour Outlook), aucune image (rien à charger, rien de bloqué), aucun lien sauf
// `mailto:` vers le vendeur, texte ≥ 14 px. Clair par défaut ; sombre CHOISI par le
// client : `prefers-color-scheme` (Apple Mail, iOS, Outlook macOS) et
// `[data-ogsc]`/`[data-ogsb]` (Outlook.com) ; Gmail inverse lui-même des couleurs
// neutres, qui restent lisibles. Contrastes AA vérifiés par le banc
// (scripts/bancs/factures-mieux.cjs) en clair ET en sombre.
// TOUT est échappé : un nom, un titre d'article ou un message ne peut jamais
// écrire du HTML.

const echapper = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const para = (t) => echapper(t).replace(/\r?\n/g, '<br>');

export const FACTURE_MAIL = Object.freeze({
  largeur: 600,
  police: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  fond: '#FFFFFF', encre: '#1D1D1F', gris: '#5E5E63', filet: '#E3E3E8', puits: '#F5F5F7',
  nuit: { fond: '#1C1C1E', encre: '#F2F2F7', gris: '#B4B4BA', filet: '#3A3A3C', puits: '#2C2C2E' },
});

function feuille() {
  const N = FACTURE_MAIL.nuit;
  const regles = (pre) => {
    const s = (sel) => sel.split(',').map((x) => `${pre}${x.trim()}`).join(',');
    return `${s('.fm-fond')}{background-color:${N.fond}!important}`
      + `${s('.fm-encre')}{color:${N.encre}!important}${s('.fm-gris')}{color:${N.gris}!important}`
      + `${s('.fm-filet')}{border-color:${N.filet}!important}`
      + `${s('.fm-puits')}{background-color:${N.puits}!important}`;
  };
  return '<style>'
    + ':root{color-scheme:light dark;supported-color-schemes:light dark}'
    + 'body{margin:0;padding:0;-webkit-text-size-adjust:100%}'
    + `@media (prefers-color-scheme:dark){${regles('')} }`
    + regles('[data-ogsc] ') + regles('[data-ogsb] ')
    + '@media (max-width:480px){.fm-ext{padding:20px 16px 28px!important}.fm-titre{font-size:21px!important;line-height:27px!important} }'
    + '</style>';
}

// titre     : « Votre facture » (la seule <h1> ; le numéro est dans le récapitulatif)
// preentete : la ligne d'aperçu de la boîte (cachée dans l'e-mail)
// boutique  : le nom en tête
// paras     : SON message, paragraphe par paragraphe
// lignes    : [[libellé, valeur]] du récapitulatif ; la DERNIÈRE est le montant
// note      : la mention de TVA, sous le récapitulatif
// pieces    : la phrase des pièces jointes
// coordonnees : [lignes] du pied ; `email` posé en lien mailto:
// langue    : 'fr' | 'en'
export function gabaritFacture({ titre, preentete = '', boutique = '', paras = [], lignes = [], note = '', pieces = '', coordonnees = [], email = '', langue = 'fr' } = {}) {
  const F = FACTURE_MAIL, P = F.police, L = F.largeur;
  const lang = langue === 'en' ? 'en' : 'fr';
  const st = (x) => `font-family:${P};${x}`;
  const p = (t) => `<p class="fm-encre" style="${st(`margin:0 0 16px;font-size:16px;line-height:1.55;color:${F.encre}`)}">${para(t)}</p>`;
  const recap = lignes.length
    ? `<table role="presentation" class="fm-puits" data-fm="recap" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${F.puits}" style="width:100%;margin:8px 0 ${note ? '0' : '20px'};border-collapse:separate;background-color:${F.puits};border-radius:12px">`
      + lignes.map(([l, v], i) => {
        const dernier = i === lignes.length - 1;
        const filet = i ? `border-top:1px solid ${F.filet};` : '';
        return `<tr><td class="fm-filet fm-gris" valign="top" style="${st(`padding:12px 16px;${filet}font-size:15px;line-height:1.4;color:${F.gris};white-space:nowrap`)}">${echapper(l)}</td>`
          + `<td class="fm-filet fm-encre" align="right" valign="top" style="${st(`padding:12px 16px;${filet}text-align:right;font-size:${dernier ? '17px' : '15px'};line-height:1.4;font-weight:${dernier ? 700 : 500};color:${F.encre};font-variant-numeric:tabular-nums;font-feature-settings:'tnum';word-break:break-word`)}"${dernier ? ' data-fm="montant"' : ''}>${echapper(v)}</td></tr>`;
      }).join('')
      + '</table>'
    : '';
  const noteHtml = note ? `<p class="fm-gris" data-fm="tva" style="${st(`margin:10px 0 20px;font-size:14px;line-height:1.45;color:${F.gris}`)}">${echapper(note)}</p>` : '';
  const piecesHtml = pieces ? `<p class="fm-encre" data-fm="pieces" style="${st(`margin:0;font-size:15px;line-height:1.5;color:${F.encre}`)}">${echapper(pieces)}</p>` : '';
  const sur = String(email || '').trim();
  const lienMail = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(sur) ? `<a class="fm-encre" href="mailto:${echapper(sur)}" style="color:${F.encre};text-decoration:underline">${echapper(sur)}</a>` : '';
  const coord = coordonnees.filter(Boolean);
  const pied = coord.length || lienMail
    ? `<tr><td class="fm-filet" data-fm="pied" style="${st(`padding:20px 0 0;border-top:1px solid ${F.filet}`)}">`
      + coord.map((x, i) => `<p class="${i ? 'fm-gris' : 'fm-encre'}" style="${st(`margin:0 0 4px;font-size:14px;line-height:1.5;color:${i ? F.gris : F.encre};${i ? '' : 'font-weight:600;'}word-break:break-word`)}">${echapper(x)}</p>`).join('')
      + (lienMail ? `<p class="fm-gris" style="${st(`margin:0;font-size:14px;line-height:1.5;color:${F.gris}`)}">${lienMail}</p>` : '')
      + '</td></tr>'
    : '';
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">'
    + '<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">'
    + `<title>${echapper(titre)}</title>${feuille()}</head>`
    + `<body class="fm-fond" style="margin:0;padding:0;background-color:${F.fond};font-family:${P}">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${F.fond}">${echapper(String(preentete || titre).replace(/\s+/g, ' ').trim().slice(0, 140))}${'&#8199;&#65279;&#847; '.repeat(16)}</div>`
    + `<table role="presentation" class="fm-fond" data-fm="fond" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${F.fond}" style="width:100%;background-color:${F.fond}"><tr><td class="fm-ext" align="center" style="padding:32px 20px 40px">`
    + `<!--[if mso]><table role="presentation" width="${L}" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${L}px">`
    + `<tr><td class="fm-filet fm-encre" data-fm="tete" style="${st(`padding:0 0 16px;border-bottom:1px solid ${F.filet};font-size:17px;line-height:1.35;font-weight:700;color:${F.encre};letter-spacing:-0.2px;word-break:break-word`)}">${echapper(boutique)}</td></tr>`
    + `<tr><td class="vrm-carte" data-fm="corps" style="${st('padding:24px 0 28px')}">`
    + `<h1 class="fm-encre fm-titre" style="${st(`margin:0 0 18px;font-size:22px;line-height:28px;font-weight:700;letter-spacing:-0.3px;color:${F.encre};word-break:break-word`)}">${echapper(titre)}</h1>`
    + paras.map(p).join('') + recap + noteHtml + piecesHtml
    + '</td></tr>'
    + pied
    + '</table>'
    + '<!--[if mso]></td></tr></table><![endif]-->'
    + '</td></tr></table></body></html>';
  const texte = [
    ...paras.flatMap((x) => [x, '']),
    ...lignes.map(([l, v]) => `${l}${lang === 'en' ? ':' : '\u00a0:'} ${v}`),
    ...(note ? [note] : []),
    '',
    ...(pieces ? [pieces, ''] : []),
    ...(coord.length || sur ? ['—', ...coord, ...(lienMail ? [sur] : [])] : []),
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { html, texte };
}
