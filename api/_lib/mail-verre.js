// api/_lib/mail-verre.js
// ════════════════════════════════════════════════════════════════════════════
// LA FORME « VERRE DÉPOLI » DE TOUS LES E-MAILS (15 nov., Julien : « J'aime la 9 »,
// puis « intègre les e-mails à l'agent design »). UNE source pour :
//   · api/_lib/mail-gabarit.js — les e-mails que VRM envoie lui-même (essai, bilan,
//     preuve d'adresse, facture Pro, suppression, e-mail d'essai…) ;
//   · scripts/modeles-email.cjs — les six modèles de compte Supabase
//     (supabase/templates/*.html, à coller dans Supabase).
// Un e-mail n'a pas de `backdrop-filter` : le « verre » se rend par
//   1. un FOND gris-ardoise (couleur unie #1C1C20 — ce que montre un client qui
//      retire les images de fond — et le dégradé de la page en image de fond) ;
//   2. en tête, sur le bleu : le logo (image hébergée sur vrm.center, jamais en
//      base64) + le mot « VRM », puis le TITRE en blanc ;
//   3. une CARTE blanche aux coins arrondis, ombre douce : le texte à l'encre ;
//   4. un seul bouton PLEIN d'encre (cellule colorée + lien en bloc, 48 px) ;
//   5. le pied en clair sur le bleu.
// Tableaux, styles EN LIGNE (le bloc <style> ne sert qu'au sombre et au téléphone),
// largeur 600, Inter puis la police du système, aucune feuille externe.
// Sombre : `prefers-color-scheme` (Apple Mail, iOS, Outlook macOS) ET `[data-ogsc]`
// / `[data-ogsb]` (Outlook.com) : gris-ardoise, carte grise, texte clair.
// (23 nov., Julien : « tous les tutos doivent ressembler à l'application ») : le BLEU de la
// première forme est remplacé par le GRIS-ARDOISE de l'app et de vrm.center (src/natif/jetons.css,
// nuit : fond #1C1C20, dégradé #27272B → #0F0F10, carte #2A2A2F) ; la carte reste blanche, à
// l'encre #16181D ; le lien est À L'ENCRE et SOULIGNÉ (aucun bleu vif : audit-style-vintex) ; le
// plein à l'encre. Les clés `bleu` / `surBleu` gardent leur nom (= « le fond du haut »).
// Contrastes : calculés sur ces jetons par scripts/audit-emails-verre.cjs (F8), ≥ 4,5:1 partout.
// ════════════════════════════════════════════════════════════════════════════

export const VERRE = Object.freeze({
  largeur: 600,
  police: "Inter,-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  policeCode: "'SF Mono',ui-monospace,Menlo,Consolas,'Liberation Mono',monospace",
  bleu: '#1C1C20',                      // le fond uni du haut (repli sans image) : le gris-ardoise de l'app
  degrade: 'linear-gradient(170deg,#27272B 0%,#1C1C20 45%,#0F0F10 100%)',
  carte: '#FFFFFF', encre: '#16181D', gris: '#5F636A', filet: '#E5E4E0', puits: '#F4F4F2', lien: '#16181D',
  plein: '#16181D', pleinMot: '#FFFFFF',
  surBleu: '#FFFFFF', surBleu2: '#B8B8C0',
  ombre: '0 18px 40px -18px rgba(0,0,0,.55)',
  logo: 'https://vrm.center/vrm-logo-v5-192.png',
  // La nuit (Apple Mail, iOS, Outlook) : les valeurs de l'app la nuit (fond, carte #2A2A2F, texte blanc).
  nuit: { bleu: '#0F0F10', carte: '#2A2A2F', encre: '#FFFFFF', gris: '#B8B8C0', filet: '#42424A', puits: '#1C1C20', lien: '#F4F4F5', plein: '#FFFFFF', pleinMot: '#16181D' },
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

// Le bouton plein : une cellule colorée + le lien en bloc. 48 px.
// (17 nov., « Améliore les emails aussi ») « À TOUTE ÉPREUVE » sous Outlook Windows, qui
// ignore `border-radius`, `padding` d'un lien et `line-height` : un `v:roundrect` VML (le
// même bouton, la même adresse, le même mot) dans un commentaire conditionnel `[if mso]`,
// et la forme HTML cachée à Outlook par `[if !mso]`. Partout ailleurs, rien ne change.
// La largeur VML : estimée sur le nombre de lettres du mot (Outlook ne sait pas « auto »).
export const largeurBoutonVml = (mot) => Math.max(200, Math.min(520, Math.round(String(mot || '').replace(/&[a-z#0-9]+;/gi, 'x').length * 9.5 + 64)));
export function boutonVerre({ urlHtml, motHtml }) {
  const P = VERRE.police;
  const vml = `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${urlHtml}" style="height:48px;v-text-anchor:middle;width:${largeurBoutonVml(motHtml)}px" arcsize="50%" stroke="f" fillcolor="${VERRE.plein}"><w:anchorlock/><center style="color:${VERRE.pleinMot};font-family:Arial,sans-serif;font-size:16px;font-weight:bold">${motHtml}</center></v:roundrect><![endif]-->`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px"><tr>`
    + `<td class="vv-plein" data-vv="plein" align="center" bgcolor="${VERRE.plein}" style="border-radius:999px;background-color:${VERRE.plein}">`
    + vml
    + `<!--[if !mso]><!-- --><a class="vv-plein" href="${urlHtml}" style="display:inline-block;padding:0 28px;line-height:48px;min-height:48px;border-radius:999px;background-color:${VERRE.plein};color:${VERRE.pleinMot};font-family:${P};font-size:16px;font-weight:600;text-decoration:none">${motHtml}</a><!--<![endif]-->`
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
  return `${avant}<!doctype html><html lang="${langAttr || lang}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
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
