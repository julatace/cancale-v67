// api/_lib/mail-verre.js
// ════════════════════════════════════════════════════════════════════════════
// LA FORME « VERRE DÉPOLI » DE TOUS LES E-MAILS (15 nov., Julien : « J'aime la 9 »,
// puis « intègre les e-mails à l'agent design »). UNE source pour :
//   · api/_lib/mail-gabarit.js — les e-mails que VRM envoie lui-même (essai, bilan,
//     preuve d'adresse, facture Pro, suppression, e-mail d'essai…) ;
//   · scripts/modeles-email.cjs — les six modèles de compte Supabase
//     (supabase/templates/*.html, à coller dans Supabase).
// Un e-mail n'a pas de `backdrop-filter` : le « verre » se rend par
//   1. un FOND bleu profond (couleur unie #174C88 — ce que montre un client qui
//      retire les images de fond — et le dégradé de la page en image de fond) ;
//   2. en tête, sur le bleu : le logo (image hébergée sur vrm.center, jamais en
//      base64) + le mot « VRM », puis le TITRE en blanc ;
//   3. une CARTE blanche aux coins arrondis, ombre douce : le texte à l'encre ;
//   4. un seul bouton PLEIN d'encre (cellule colorée + lien en bloc, 48 px) ;
//   5. le pied en clair sur le bleu.
// Tableaux, styles EN LIGNE (le bloc <style> ne sert qu'au sombre et au téléphone),
// largeur 600, Inter puis la police du système, aucune feuille externe.
// Sombre : `prefers-color-scheme` (Apple Mail, iOS, Outlook macOS) ET `[data-ogsc]`
// / `[data-ogsb]` (Outlook.com) : bleu-nuit, carte bleu-nuit, texte clair.
// Contrastes (calculés sur ces jetons par scripts/audit-emails-verre.cjs, F8) : encre sur
// blanc 17,0:1 ; gris #3F5468 7,8:1 ; lien #0055B8 7,0:1 ; titre blanc sur #174C88 8,7:1
// (sur le haut du dégradé #1E5DA4 6,7:1) ; pied #D6E4F3 sur #174C88 6,7:1 (haut 5,1:1) ;
// mot blanc sur le plein 17,0:1 ; la nuit : 14,4 · 8,3 · 7,4 · 11,5:1.
// ════════════════════════════════════════════════════════════════════════════

export const VERRE = Object.freeze({
  largeur: 600,
  police: "Inter,-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  policeCode: "'SF Mono',ui-monospace,Menlo,Consolas,'Liberation Mono',monospace",
  bleu: '#174C88',                      // le fond uni (repli sans image)
  degrade: 'linear-gradient(170deg,#1E5DA4 0%,#174C88 45%,#0F2F57 100%)',
  carte: '#FFFFFF', encre: '#0C1D30', gris: '#3F5468', filet: '#E2E8F0', puits: '#EEF3F9', lien: '#0055B8',
  plein: '#0C1D30', pleinMot: '#FFFFFF',
  surBleu: '#FFFFFF', surBleu2: '#D6E4F3',
  ombre: '0 18px 40px -18px rgba(8,26,50,.55)',
  logo: 'https://vrm.center/vrm-logo-v5-192.png',
  // La nuit (Apple Mail, iOS, Outlook) : bleu-nuit, carte de verre sombre, texte clair.
  nuit: { bleu: '#0C2848', carte: '#0E2139', encre: '#EAF2FB', gris: '#A9BBCF', filet: '#24364E', puits: '#08182C', lien: '#6CB4FF', plein: '#FFFFFF', pleinMot: '#0C1D30' },
});

// La feuille : le sombre (deux syntaxes) et le téléphone. Les classes `vv-*` sont la
// signature commune (l'audit les cherche dans CHAQUE e-mail).
export function styleVerre() {
  const N = VERRE.nuit;
  const regles = (pre) => {
    const s = (sel) => sel.split(',').map((x) => `${pre}${x.trim()}`).join(',');
    return `${s('.vv-fond')}{background-color:${N.bleu}!important;background-image:none!important}`
      + `${s('.vv-carte')}{background-color:${N.carte}!important}`
      + `${s('.vv-encre')}{color:${N.encre}!important}${s('.vv-gris')}{color:${N.gris}!important}`
      + `${s('.vv-lien')}{color:${N.lien}!important}${s('.vv-filet')}{border-color:${N.filet}!important}`
      + `${s('.vv-puits')}{background-color:${N.puits}!important;color:${N.encre}!important}`
      + `${s('.vv-plein')}{background-color:${N.plein}!important;color:${N.pleinMot}!important}`;
  };
  return `<style>`
    + `:root{color-scheme:light dark;supported-color-schemes:light dark}`
    + `body{margin:0;padding:0;-webkit-text-size-adjust:100%}`
    + `@media (prefers-color-scheme:dark){${regles('')} }`
    + regles('[data-ogsc] ') + regles('[data-ogsb] ')
    + `@media (max-width:480px){.vv-ext{padding:20px 10px 28px!important}.vv-carte-td{padding:24px 20px!important}.vv-titre{font-size:24px!important;line-height:30px!important}.vv-code{font-size:30px!important;letter-spacing:8px!important} }`
    + `</style>`;
}

// Le haut : le logo et le mot « VRM » (ou le NOM d'un vendeur : sa facture ne dit rien
// de VRM), puis le titre en blanc sur le bleu.
export function teteVerre({ titreHtml, marqueHtml = '' }) {
  const P = VERRE.police;
  const marque = marqueHtml
    ? `<td style="font-family:${P};font-size:18px;line-height:24px;font-weight:700;color:${VERRE.surBleu};letter-spacing:-0.2px;word-break:break-word">${marqueHtml}</td>`
    : `<td width="40" style="width:40px;vertical-align:middle"><img src="${VERRE.logo}" width="32" height="32" alt="" style="display:block;border:0;border-radius:9px;outline:none;text-decoration:none"></td>`
      + `<td style="vertical-align:middle;font-family:${P};font-size:19px;line-height:24px;font-weight:700;color:${VERRE.surBleu};letter-spacing:-0.3px">VRM</td>`;
  return `<tr><td data-vv="tete" style="padding:0 6px 18px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${marque}</tr></table></td></tr>`
    + `<tr><td data-vv="titre" style="padding:0 6px 20px"><h1 class="vv-titre" style="margin:0;font-family:${P};font-size:28px;line-height:34px;font-weight:700;letter-spacing:-0.6px;color:${VERRE.surBleu};word-break:break-word">${titreHtml}</h1></td></tr>`;
}

// Le bouton plein : une cellule colorée (Outlook) + le lien en bloc. 48 px.
export function boutonVerre({ urlHtml, motHtml }) {
  const P = VERRE.police;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px"><tr>`
    + `<td class="vv-plein" data-vv="plein" align="center" bgcolor="${VERRE.plein}" style="border-radius:999px;background-color:${VERRE.plein}">`
    + `<a class="vv-plein" href="${urlHtml}" style="display:inline-block;padding:0 28px;line-height:48px;min-height:48px;border-radius:999px;background-color:${VERRE.plein};color:${VERRE.pleinMot};font-family:${P};font-size:16px;font-weight:600;text-decoration:none">${motHtml}</a>`
    + `</td></tr></table>`;
}

// Le code (connexion, confirmation) : EN GRAND, chiffres espacés par l'interlettrage
// (une copie rend « 123456 », sans espace), sélectionnable d'un geste.
export function codeVerre({ codeHtml, legendeHtml }) {
  return `<div class="vv-gris" style="font-family:${VERRE.police};font-size:14px;line-height:20px;color:${VERRE.gris};padding:0 0 8px">${legendeHtml}</div>`
    + `<div class="vv-puits vv-code" data-vv="code" style="font-family:${VERRE.policeCode};font-size:38px;line-height:48px;font-weight:700;letter-spacing:12px;color:${VERRE.encre};background-color:${VERRE.puits};border-radius:16px;padding:14px 16px 14px 28px;text-align:center;-webkit-user-select:all;user-select:all">${codeHtml}</div>`;
}

// L'enveloppe : document, préentête caché, fond bleu, colonne de 600, carte, pied.
//   lang, titreHtml (déjà échappé), apercuHtml, teteHtml (teteVerre), corpsHtml (le contenu de
//   la carte), piedHtml (paragraphes en clair sur le bleu), avantHtml (Go : `{{ … }}` en tête).
export function enveloppeVerre({ lang = 'fr', titreDoc = 'VRM', apercuHtml = '', teteHtml, corpsHtml, piedHtml = '', avant = '', langAttr = '' }) {
  const P = VERRE.police, L = VERRE.largeur;
  return `${avant}<!doctype html><html lang="${langAttr || lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">`
    + `<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">`
    + `<title>${titreDoc}</title>${styleVerre()}</head>`
    + `<body class="vv-fond" style="margin:0;padding:0;background-color:${VERRE.bleu};font-family:${P}">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${VERRE.bleu}">${apercuHtml}${'&#8199;&#65279;&#847; '.repeat(16)}</div>`
    + `<table role="presentation" class="vv-fond" data-vv="fond" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${VERRE.bleu}" style="width:100%;background-color:${VERRE.bleu};background-image:${VERRE.degrade}"><tr><td class="vv-ext" align="center" style="padding:32px 14px 40px">`
    + `<!--[if mso]><table role="presentation" width="${L}" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${L}px">`
    + teteHtml
    + `<tr><td class="vv-carte vv-carte-td" data-vv="carte" bgcolor="${VERRE.carte}" style="background-color:${VERRE.carte};border-radius:22px;padding:30px 28px;box-shadow:${VERRE.ombre};font-family:${P}">${corpsHtml}</td></tr>`
    + (piedHtml ? `<tr><td data-vv="pied" style="padding:22px 8px 0;font-family:${P};font-size:13px;line-height:20px;color:${VERRE.surBleu2}">${piedHtml}</td></tr>` : '')
    + `</table>`
    + `<!--[if mso]></td></tr></table><![endif]-->`
    + `</td></tr></table></body></html>`;
}
