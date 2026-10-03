// ════════════════════════════════════════════════════════════════════════════
//  L'EXTENSION N'AFFICHE PLUS QUE LA PETITE CARTE VRM (5.130)
//
//  Julien, 2 octobre : « il ne doit pas y avoir d'informations autres que les
//  moyens de connexion, le compte utilisé, le compte connecté, si les
//  informations circulent bien ; tout doit être centralisé dans VRM ; le vieux
//  logo orange, enlève-le ; le même logo partout ».
//  Ce contrôle lit le MANIFESTE et les scripts qu'il injecte réellement :
//   1. chaque famille de sites (Vinted, Leboncoin, eBay, Vestiaire) reçoit
//      vrm-badge.js — la même carte, le même logo ;
//   2. aucun script injecté ne porte plus l'ancien bouton orange ni un panneau ;
//   3. aucun champ mot de passe n'est fabriqué dans la page d'un site (la
//      connexion vit dans un iframe de l'EXTENSION : les scripts du site ne
//      voient ni le champ ni le clavier) ;
//   4. le manifeste a ses icônes (sans elles, Chrome montre une pièce de puzzle).
//  Les commentaires sont retirés avant de juger : un commentaire qui RACONTE
//  l'ancien panneau n'en est pas un.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const EXT = path.join(__dirname, '..', 'vinted-sync-extension');
const M = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log((bon ? '✅ ' : '❌ ') + quoi + (!bon && det ? ' — ' + det : '')); };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, '')).split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');

const SITES = { Vinted: 'https://www.vinted.fr/x', Leboncoin: 'https://www.leboncoin.fr/x', eBay: 'https://www.ebay.fr/x', Vestiaire: 'https://fr.vestiairecollective.com/x' };
const correspond = (motif, url) => new RegExp('^' + motif.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(url);
const scriptsPour = (url) => M.content_scripts.filter((c) => c.matches.some((m) => correspond(m, url))).flatMap((c) => c.js);

for (const [nom, url] of Object.entries(SITES)) {
  const js = scriptsPour(url);
  dit(js.includes('vrm-badge.js'), `${nom} : la petite carte VRM est injectée`, js.join(', ') || 'aucun script');
  for (const f of js) {
    const t = sansCommentaires(fs.readFileSync(path.join(EXT, f), 'utf8'));
    dit(!/#D2401E|vrm-fab|vrm-panel|vrm-propo/i.test(t), `${nom} · ${f} : ni l'ancien bouton orange, ni panneau, ni fenêtre récapitulative`);
    dit(!/type\s*=\s*["']password["']|\.type\s*=\s*['"]password['"]/.test(t), `${nom} · ${f} : aucun champ mot de passe dans la page du site`);
  }
}
dit(!fs.existsSync(path.join(EXT, 'vinted-panel.js')), "l'ancien panneau Vinted n'est plus livré");
const icones = (M.action && M.action.default_icon) || {};
dit(M.icons && M.icons['128'] && icones['16'] && Object.values(icones).every((f) => fs.existsSync(path.join(EXT, f))), 'le manifeste porte ses icônes (le logo de l\'app), et elles existent');
const war = (M.web_accessible_resources || []).find((w) => w.resources.includes('popup.html'));
dit(!!war && war.resources.includes('logo-vrm-96.png'), 'la carte de connexion et le logo sont accessibles aux sites (sinon ni logo ni connexion)');
const popup = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
dit(!/#4aa87d|E0B972|F7E3B6/i.test(popup), "la fenêtre de l'icône n'a plus l'ancien logo doré ni la menthe");
console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : "\nL'extension ne montre que la carte VRM, avec le logo de l'app, partout.");
process.exit(ko ? 1 : 0);
