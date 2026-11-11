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
const SOURCE = 'journee-clair.webp';
const SORTIE = process.env.SORTIE || path.join(RACINE, 'public');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

(async () => {
  const reg = JSON.parse(fs.readFileSync(path.join(ACC, 'captures.json'), 'utf8'));
  const src = fs.readFileSync(path.join(ACC, SOURCE));
  if (!reg[SOURCE] || reg[SOURCE].modeExemple !== true || reg[SOURCE].sha256 !== sha(src)) throw new Error(`${SOURCE} n'est pas au registre des captures en mode exemple — refusé`);
  const logo = fs.readFileSync(path.join(RACINE, 'public', 'vrm-logo-v5-192.png')).toString('base64');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0}
    html,body{width:1200px;height:630px;overflow:hidden;background:#F5F5F7}
    body{font-family:'Inter',sans-serif;color:#1D1D1F;-webkit-font-smoothing:antialiased;display:grid;grid-template-columns:1fr 420px;gap:24px;padding:0 0 0 80px;position:relative}
    .t{align-self:center;padding-bottom:8px}
    .m{display:flex;align-items:center;gap:14px;margin-bottom:40px}
    .m img{width:52px;height:52px;border-radius:13px;background:#1D1D1F;padding:3px}
    .m b{font-size:34px;font-weight:700;letter-spacing:.02em}
    h1{font-size:60px;line-height:1.05;letter-spacing:-.035em;font-weight:700;max-width:12em}
    p{margin-top:28px;font-size:26px;line-height:1.35;color:#6E6E73;letter-spacing:-.01em;max-width:24em}
    .u{margin-top:36px;font-size:22px;color:#1D1D1F;font-weight:600}
    .tel{position:absolute;right:72px;top:64px;width:340px;background:#1D1D1F;padding:9px;border-radius:52px;box-shadow:0 30px 60px -16px rgba(0,0,0,.35)}
    .tel img{display:block;width:100%;border-radius:44px}
    .ex{margin-top:6px;font-size:16px;color:#6E6E73}
  </style></head><body>
    <div class="t">
      <div class="m"><img src="data:image/png;base64,${logo}" alt=""><b>VRM</b></div>
      <h1>Tes ventes, tes colis et ta compta, au même endroit.</h1>
      <p>Pour les revendeurs Vinted, Leboncoin et eBay — vêtements, sacs, livres, tout ce qui se revend.</p>
      <div class="u">vrm.center</div>
      <div class="ex">À droite : l’app VRM, données d’exemple.</div>
    </div>
    <div class="tel"><img src="data:image/webp;base64,${src.toString('base64')}" alt=""></div>
  </body></html>`;
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  try {
    const pg = await nav.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await pg.route(/^https?:/, (r) => r.abort());
    await pg.setContent(html, { waitUntil: 'load' });
    await pg.waitForTimeout(300);
    const jpg = await pg.screenshot({ type: 'jpeg', quality: 82 });
    fs.mkdirSync(SORTIE, { recursive: true });
    fs.writeFileSync(path.join(SORTIE, 'og-vrm.jpg'), jpg);
    fs.writeFileSync(path.join(SORTIE, 'og-vrm.json'), JSON.stringify({ sha256: sha(jpg), largeur: 1200, hauteur: 630, source: `accueil/${SOURCE}`, sourceSha256: reg[SOURCE].sha256, modeExemple: true }, null, 1) + '\n');
    console.log(`og-vrm.jpg ${Math.round(jpg.length / 1024)} Ko (depuis ${SOURCE})`);
  } finally { await nav.close(); }
})().catch((e) => { console.log('❌ ' + (e && e.message || e)); process.exit(1); });
