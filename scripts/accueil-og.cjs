// ════════════════════════════════════════════════════════════════════════════
//  L'IMAGE DE PARTAGE DE vrm.center (11 nov.) — Open Graph, 1200 × 630.
//
//  Ce que montre un lien vrm.center collé dans un message (iMessage, WhatsApp,
//  Discord, Facebook) : la promesse de la page en une phrase, et une VRAIE
//  capture de l'app en MODE EXEMPLE (public/accueil/journee-clair.webp, faite par
//  scripts/accueil-captures.cjs). Ce script REFUSE une capture qui n'est pas au
//  registre public/accueil/captures.json (empreinte d'un fichier produit en mode
//  exemple) : l'image de partage ne peut pas montrer une donnée réelle.
//  Aucune note, aucun avis, aucun logo de plateforme (le nom en texte suffit).
//
//    node scripts/accueil-og.cjs        (après accueil-captures.cjs)
//  Sortie : public/og-vrm.jpg + public/og-vrm.json (empreintes : l'image ET la
//  capture d'où elle vient). Le banc (scripts/bancs/accueil.cjs) vérifie les deux.
//  ⚠️ Linux n'a pas SF Pro : Inter, la plus proche (comme les captures).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));

const RACINE = path.join(__dirname, '..');
const ACC = path.join(RACINE, 'public', 'accueil');
// (23 nov.) L'apparence PAR DÉFAUT de l'app est le gris-ardoise (sombre) : l'image de partage montre celle-là.
const SOURCE = 'journee-sombre.webp';
const SORTIE = process.env.SORTIE || path.join(RACINE, 'public');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

(async () => {
  const reg = JSON.parse(fs.readFileSync(path.join(ACC, 'captures.json'), 'utf8'));
  const src = fs.readFileSync(path.join(ACC, SOURCE));
  if (!reg[SOURCE] || reg[SOURCE].modeExemple !== true || reg[SOURCE].sha256 !== sha(src)) throw new Error(`${SOURCE} n'est pas au registre des captures en mode exemple — refusé`);
  const logo = fs.readFileSync(path.join(RACINE, 'public', 'vrm-logo-v5-192.png')).toString('base64');
  // (15 nov., lot site-public) Inter (la police de l'app, src/design/polices/, embarquée ici en data: — aucune
  // requête), la nouvelle promesse de la page. (23 nov. : le gris-ardoise de la page et de l'app ; avant, 15 nov., « Verre dépoli » : le bleu profond dégradé,
  // la promesse en BLANC, l'adresse sur le plein blanc ; mêmes mots, même capture.)
  const inter = fs.readFileSync(path.join(RACINE, 'src', 'design', 'polices', 'inter-latin-wght-normal.woff2')).toString('base64');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    @font-face{font-family:'Inter VRM';font-weight:100 900;src:url(data:font/woff2;base64,${inter}) format('woff2')}
    *{box-sizing:border-box;margin:0}
    html,body{width:1200px;height:630px;overflow:hidden}
    body{font-family:'Inter VRM',sans-serif;color:#FFFFFF;-webkit-font-smoothing:antialiased;position:relative;
      background:radial-gradient(90% 40% at 18% 0%,rgb(244 244 245 / .10),transparent 70%),linear-gradient(180deg,#27272B 0%,#19191C 38%,#0F0F10 100%)}
    .t{position:absolute;left:76px;top:0;bottom:0;width:640px;display:flex;flex-direction:column;justify-content:center}
    .m{display:flex;align-items:center;gap:14px;margin-bottom:34px}
    .m img{width:52px;height:52px;border-radius:14px;background:#16181D;padding:3px;box-shadow:0 0 0 1px rgba(255,255,255,.3),0 8px 18px -8px rgba(0,0,0,.5)}
    .m b{font-size:32px;font-weight:700;letter-spacing:-.01em}
    h1{font-size:58px;line-height:1.04;letter-spacing:-.04em;font-weight:700;text-wrap:balance}
    p{margin-top:24px;font-size:25px;line-height:1.35;color:#B8B8C0;letter-spacing:-.015em;max-width:22em}
    .u{margin-top:34px;display:flex;align-items:center;gap:14px}
    .u b{display:inline-flex;align-items:center;height:48px;padding:0 24px;border-radius:999px;background:#FFFFFF;color:#16181D;font-size:21px;font-weight:600;box-shadow:0 12px 22px -10px rgba(0,0,0,.6)}
    .u span{font-size:16px;color:#B8B8C0}
    .lum{position:absolute;right:-60px;top:-40px;width:620px;height:720px;background:radial-gradient(50% 50% at 50% 45%,rgba(244,244,245,.10),transparent 70%)}
    .tel{position:absolute;right:86px;top:58px;width:336px;background:#09090A;padding:8px;border-radius:52px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 0 0 1px rgba(255,255,255,.18),0 40px 70px -24px rgba(0,0,0,.6)}
    .tel img{display:block;width:100%;border-radius:44px}
  </style></head><body>
    <div class="lum"></div>
    <div class="t">
      <div class="m"><img src="data:image/png;base64,${logo}" alt=""><b>VRM</b></div>
      <h1>Tes ventes Vinted, Leboncoin, eBay et Vestiaire au même endroit.</h1>
      <p>Numéros de rangement, colis, codes de retrait et compta.</p>
      <div class="u"><b>vrm.center</b><span>À droite : l’app, données d’exemple.</span></div>
    </div>
    <div class="tel"><img src="data:image/webp;base64,${src.toString('base64')}" alt=""></div>
  </body></html>`;
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  try {
    const pg = await nav.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await pg.route(/^https?:/, (r) => r.abort());
    await pg.setContent(html, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts && document.fonts.ready);
    await pg.waitForTimeout(300);
    const jpg = await pg.screenshot({ type: 'jpeg', quality: 82 });
    fs.mkdirSync(SORTIE, { recursive: true });
    fs.writeFileSync(path.join(SORTIE, 'og-vrm.jpg'), jpg);
    fs.writeFileSync(path.join(SORTIE, 'og-vrm.json'), JSON.stringify({ sha256: sha(jpg), largeur: 1200, hauteur: 630, source: `accueil/${SOURCE}`, sourceSha256: reg[SOURCE].sha256, modeExemple: true }, null, 1) + '\n');
    console.log(`og-vrm.jpg ${Math.round(jpg.length / 1024)} Ko (depuis ${SOURCE})`);
  } finally { await nav.close(); }
})().catch((e) => { console.log('❌ ' + (e && e.message || e)); process.exit(1); });
