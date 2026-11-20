// audit-panneau-sans-vrm (20 nov., ext. 5.410) — « toute action se fait dans l'extension » : AUCUN geste du panneau
// (prix, republier, publier, offres, favoris, réglages des automatisations, cadence) n'ouvre vrm.center.
// On lit vrm-badge.js (commentaires retirés) : chaque adresse vrm.center doit être d'une sorte PERMISE (télécharger
// l'extension, se connecter, VOIR une donnée de VRM — fiche, notification, réglages de l'app qui ne sont pas des
// gestes sur un site) ; toute autre est rouge, et `window.open(...vrm.center...)` l'est toujours.
// --mutation : remet chacun des anciens liens et exige le rouge.
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '..', 'vinted-sync-extension', 'vrm-badge.js');
const SRC = fs.readFileSync(F, 'utf8');
const PERMIS = [
  /VRM-extension\.zip/, /VRM-Orion\.xpi/, /\?connexion/,                       // l'extension elle-même, la connexion
  /\?tab=annonces&site=vinted" target="_blank" rel="noopener" data-geste="vrm"/,  // VOIR la fiche dans VRM
  /\?tab=ventes&site=vinted&cible=vente&tx=/,                                      // VOIR la vente dans VRM
  /'https:\/\/vrm\.center\/' \+ \(e\.s ===/,                                       // VOIR une notification dans VRM
  /FIXER_MINI_URL = 'https:\/\/vrm\.center\/\?tab=annonces'/,                       // poser un prix mini (donnée VRM)
  /lienVrm = \(q, k\) => `<a class="rg5" href="https:\/\/vrm\.center\/\$\{q\}"/,    // réglages de l'APP (notifications, langue)
];
const INTERDITS = [/vue=republier/, /vue=favoris/, /vue=offres/, /section=discretion/, /data-auto-modifier/];
function verifier(src) {
  const t = src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const fautes = [];
  if (/window\.open\([^)]*vrm\.center/.test(t)) fautes.push('un geste ouvre vrm.center (window.open)');
  for (const re of INTERDITS) if (re.test(t)) fautes.push('lien de geste vers VRM : ' + re);
  for (const l of t.split('\n')) {
    if (!/vrm\.center\//.test(l)) continue;
    const morceaux = l.match(/.{0,120}https:\/\/vrm\.center\/.{0,80}/g) || [];
    for (const m of morceaux) if (!PERMIS.some((re) => re.test(m)) && !/^\s*(const|\s)*LIENS_PAQUET/.test(l)) fautes.push('adresse vrm.center non permise : ' + m.trim().slice(0, 160));
  }
  // Chaque geste du menu « Choisir une action » est fait DANS le panneau.
  for (const k of ['republier', 'baisser', 'publier']) if (!new RegExp(`if \\(k === '${k}'[^\\n]*geste6 = \\{ k: '`).test(t)) fautes.push(`« ${k} » n'ouvre pas son geste dans le panneau`);
  return fautes;
}
const f = verifier(SRC);
if (f.length) { console.log('❌ audit-panneau-sans-vrm\n - ' + f.join('\n - ')); process.exit(1); }
console.log('✅ audit-panneau-sans-vrm : aucun geste du panneau n’ouvre vrm.center (prix, atelier, publier, offres, réglages)');
if (process.argv.includes('--mutation')) {
  const M = [
    ['republier vers VRM', "if (k === 'republier') { geste6 = {", "if (k === 'republier') { try { window.open('https://vrm.center/?tab=annonces&site=vinted&vue=republier', '_blank', 'noopener'); } catch (_) {} return; } if (false) { geste6 = {"],
    ['baisser vers VRM', "if (k === 'baisser') { geste6 = {", "if (k === 'baisser') { try { window.open('https://vrm.center/?tab=annonces', '_blank', 'noopener'); } catch (_) {} return; } if (false) { geste6 = {"],
    ['écrire le message dans VRM', "data-fav-ecrire data-onglet-b=\"automatisations\"", "data-fav-ecrire href=\"https://vrm.center/?tab=messages&vue=favoris\""],
    ['réglage dans VRM', "const gesteEcrire = () =>", "const lienX = 'https://vrm.center/?tab=settings&section=discretion'; const gesteEcrire = () =>"],
  ];
  let ok = 0;
  for (const [nom, de, vers] of M) { if (!SRC.includes(de)) { console.log('❌ mutation absente : ' + nom); process.exit(1); } if (verifier(SRC.replace(de, vers)).length) ok++; else { console.log('❌ mutation « ' + nom + ' » reste verte'); process.exit(1); } }
  console.log(`✅ mutations : ${ok}/${M.length} rouges`);
}
