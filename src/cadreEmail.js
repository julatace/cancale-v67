// ── LE DOCUMENT DU CADRE « MESSAGE D'ORIGINE » (6 nov., décision de Julien) ──
// « Que l'e-mail ouvert dans VRM s'affiche comme dans Mail. » Le HTML reçu ici a
// été ASSAINI par le serveur (api/_lib/email-html.js, à la réception PUIS à la
// relecture) ; ce module ne fait que l'emballer pour un cadre isolé
// (src/CadreEmail.jsx : `sandbox` SANS `allow-scripts`, `srcdoc`) :
//   · sa propre politique (CSP) : aucun script, aucun formulaire, aucune adresse
//     de base, rien de distant — sauf les images, et SEULEMENT après « Afficher
//     les images » (`img-src data: https:`) ; avant, `img-src data:` ;
//   · aucun référent envoyé (`no-referrer`) quand les images partent ;
//   · fond CLAIR dans le cadre, sauf si l'e-mail sait se mettre en sombre
//     (`prefers-color-scheme: dark` dans ses styles) ET que l'app est sombre ;
//   · les images distantes (`data-vrm-src`, https seulement) ne deviennent `src`
//     que dans `avecImages`, sur SON geste, une fois par ouverture.
// Pur (testé par scripts/audit-emails-html.cjs) : ni DOM, ni réseau.

export const ATTENTE_IMAGE = 'data-vrm-src';

// Les images distantes remises en `src` (geste « Afficher les images »). Seule une
// adresse https sans guillemet ni blanc passe ; tout le reste garde son emplacement.
export function avecImages(html) {
  return String(html || '').replace(/ data-vrm-src="(https:\/\/[^"\s<>]{1,2000})"/g, (m, u) => ` src="${u}"`);
}
export const compterImages = (html) => (String(html || '').match(/ data-vrm-src="https:\/\//g) || []).length;

export function politiqueCadre(images) {
  return [
    "default-src 'none'",
    "script-src 'none'",
    "style-src 'unsafe-inline'",
    `img-src data:${images ? ' https:' : ''}`,
    'font-src data:',
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
}

// Le document complet posé dans `srcdoc`.
export function documentCadre(html, { images = false, sombre = false } = {}) {
  let corps = images ? avecImages(html) : String(html || '');
  const schema = sombre ? 'light dark' : 'light';
  // Le `<body>` d'origine (rangé en `<div data-vrm-corps …>` par le serveur) retrouve
  // sa place : ses attributs (déjà assainis, entre guillemets) reviennent sur le vrai
  // `body`, pour que les règles `body { … }` de l'e-mail (son thème sombre) jouent.
  let attrsCorps = '';
  corps = corps.replace(/<div data-vrm-corps=""((?:\s[a-z-]+="[^"<>]*")*)>/, (m, a) => { attrsCorps = a; return '<div data-vrm-corps="">'; });
  return '<!doctype html><html><head><meta charset="utf-8">'
    + `<meta http-equiv="Content-Security-Policy" content="${politiqueCadre(images)}">`
    + '<meta name="referrer" content="no-referrer">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + `<meta name="color-scheme" content="${schema}">`
    + '<style>'
    + `:root{color-scheme:${schema}}`
    + 'html,body{margin:0;padding:0}'
    + 'html{overflow:hidden}'
    + `html{background:${sombre ? 'Canvas' : '#ffffff'}}`
    + `body{color:${sombre ? 'CanvasText' : '#1d1d1f'};font:15px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;-webkit-text-size-adjust:100%;text-size-adjust:100%;overflow-wrap:break-word}`
    + '.vrm-cadre-corps{padding:14px 14px 18px;box-sizing:border-box}'
    + 'img{max-width:100%;height:auto}'
    + 'img[data-vrm-src]{display:inline-block;min-width:28px;min-height:28px;background:#ececf0;border-radius:4px;color:transparent}'
    + 'a{color:#0071e3}'
    + 'pre{white-space:pre-wrap}'
    + `</style></head><body${attrsCorps}><div class="vrm-cadre-corps">`
    + corps
    + '</div></body></html>';
}
