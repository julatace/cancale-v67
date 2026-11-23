#!/usr/bin/env node
// audit-lien-panneau (5.410, 20 nov.) — décision de Julien : « toute action doit être faite dans l'extension ».
// L'app ouvre le panneau par un LIEN (src/ouvrirPanneau.js, lienPanneau) que l'extension LIT (vrm-badge.js,
// lireLienPanneau). Ce banc EXÉCUTE les deux et vérifie :
//  1. même contrat : chaque page / action de l'app est comprise par l'extension, et l'inverse ;
//  2. aller-retour : le lien de l'app, lu par l'extension, rend la page, les ids et l'action voulus ;
//  3. bornes : site étranger ⇒ pas de lien ; ids douteux écartés des DEUX côtés ; 50 ids au plus ; un hôte étranger
//     n'est jamais lu ; les paramètres sont retirés de l'adresse ;
//  4. RIEN ne part : le lecteur ne pose qu'une sélection, une action PRÉ-choisie ou la barre de CONFIRMATION
//     (annConfirme) — jamais un appel d'écriture (secuGeste, envoyer, fetch, sendMessage).
// --mutation : affaiblit chaque règle à son tour et exige le rouge.
const fs = require('fs'), path = require('path'), vm = require('vm');
const RACINE = path.join(__dirname, '..');
const SRC_APP = fs.readFileSync(path.join(RACINE, 'src/ouvrirPanneau.js'), 'utf8');
const SRC_EXT = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension/vrm-badge.js'), 'utf8');

function chargerApp(src) {
  const code = src.replace(/^export (const|function|let) /gm, '$1 ') + '\n;({ lienPanneau });';
  return vm.runInNewContext(code, { URLSearchParams, encodeURIComponent });
}
// Le vocabulaire que l'APP envoie : src/actionsExtension.js (chantier actions-extension) s'il est là, sinon sa copie.
const F_ACTIONS = path.join(RACINE, 'src/actionsExtension.js');
const VOCAB_COPIE = [['prix', 'changer'], ['prix', 'baisser'], ['prix', 'remettre'], ['republier', 'republier'], ['republier', 'mettre-en-ligne'], ['republier', 'brouillon'], ['publier', 'creer'], ['publier', 'publier'], ['annonces', 'pause'], ['annonces', 'supprimer'], ['messages', 'repondre'], ['offres', 'repondre'], ['favoris', 'envoyer'], ['automatisations', 'regler'], ['vacances', 'vacances']];
function vocabulaire() {
  if (!fs.existsSync(F_ACTIONS)) return VOCAB_COPIE;
  const t = fs.readFileSync(F_ACTIONS, 'utf8');
  const l = [...t.matchAll(/page:\s*'([a-z-]+)',\s*action:\s*'([a-z-]+)'/g)].map((m) => [m[1], m[2]]);
  return l.length ? l : VOCAB_COPIE;
}
function bloc(src, debut, fin) { const i = src.indexOf(debut); if (i < 0) throw new Error('introuvable : ' + debut); const j = src.indexOf(fin, i); if (j < 0) throw new Error('fin introuvable : ' + fin); return src.slice(i, j); }
function chargerExt(src) {
  const lecteur = bloc(src, '  const PAGES_LIEN = ', '  const lienPanneau = lireLienPanneau();');
  const application = bloc(src, '  const lienPanneau = lireLienPanneau();', '  // 5.409 : Échap ferme');
  const lire = (href) => {
    const u = new URL(href); const remplace = [];
    const ctx = { URLSearchParams, CADRE: false, LISTES: false, location: { hostname: u.hostname, search: u.search, pathname: u.pathname, hash: u.hash }, history: { state: null, replaceState: (_s, _t, url) => remplace.push(url) } };
    const r = vm.runInNewContext(lecteur + '\n;({ r: lireLienPanneau(), PAGES_LIEN, ACTIONS_LIEN });', ctx);
    return Object.assign(r, { remplace });
  };
  return { lire, application };
}

function verifier(srcApp, srcExt) {
  const fautes = [];
  const app = chargerApp(srcApp); const ext = chargerExt(srcExt);
  const { PAGES_LIEN, ACTIONS_LIEN } = ext.lire('https://www.vinted.fr/');
  const ONGLETS = ['accueil', 'annonces', 'ventes', 'messages', 'favoris', 'notifications', 'automatisations', 'parametres'];
  const vocab = vocabulaire().concat([['articles', 'masquer'], ['commandes', ''], ['messagerie', ''], ['notifications', ''], ['accueil', '']]);
  for (const site of ['vinted', 'leboncoin', 'vestiaire']) for (const [page, action] of vocab) {
    const href = app.lienPanneau({ site, page, ids: ['123', 'ab-9'], action });
    const { r, remplace } = ext.lire(href);
    if (!r) { fautes.push(`l'extension ne lit pas ${href}`); continue; }
    const ATTENDU = { articles: 'annonces', annonces: 'annonces', commandes: 'ventes', messagerie: 'messages', messages: 'messages', offres: 'messages', notifications: 'notifications', automatisations: 'automatisations', favoris: 'favoris', republier: 'annonces', prix: 'annonces', publier: 'annonces', vacances: 'parametres', accueil: 'accueil' };
    if (!PAGES_LIEN[page] || r.page !== (ATTENDU[page] || PAGES_LIEN[page]) || !ONGLETS.includes(r.page)) fautes.push(`${site} page « ${page} » ⇒ onglet ${r.page} (inconnue du lecteur ?)`);
    if (action && r.action !== action) fautes.push(`${site} ${page} : l'action « ${action} » de l'app n'est pas comprise (rendu « ${r.action} »)`);
    if (r.ids.join(',') !== '123,ab-9') fautes.push(`${site} ${page} : ids ${r.ids.join(',')}`);
    if (!remplace.length || /vrm=|ids=|action=/.test(remplace[0])) fautes.push(`${site} ${page} : paramètres laissés dans l'adresse`);
  }
  if (!/^https:\/\/fr\.vestiairecollective\.com\//.test(app.lienPanneau({ site: 'vestiaire', page: 'prix' }))) fautes.push('lien Vestiaire inattendu');
  if (!/^https:\/\/www\.vinted\.fr\//.test(app.lienPanneau({ site: 'exemple.com', page: 'prix' }))) fautes.push('un site inconnu ne retombe pas sur vinted.fr');
  const lu = ext.lire('https://www.vinted.fr/?vrm=panneau&page=articles&ids=1,%3Cscript%3E,2&action=detruire').r;
  if (!lu || lu.ids.join(',') !== '1,2') fautes.push('l\'extension garde un id douteux');
  if (lu && lu.action !== '') fautes.push('l\'extension accepte une action hors contrat (« detruire »)');
  if (ext.lire('https://evil.example/?vrm=panneau&page=articles').r !== null) fautes.push('un hôte étranger est lu');
  if (ext.lire('https://www.vinted.fr/?page=articles').r !== null) fautes.push('lu sans vrm=panneau');
  if (ext.lire('https://www.vinted.fr/?vrm=panneau&page=inconnue').r.page !== 'accueil') fautes.push('une page inconnue n’ouvre pas l’Accueil');
  const appli = ext.application.replace(/\/\/.*$/gm, '');
  if (/secuGeste|envoyer\(|fetch\(|sendMessage|executer|\blancer/i.test(appli)) fautes.push('le lien déclenche un geste au lieu de le préparer');
  if (!/annConfirme\s*=/.test(appli)) fautes.push('masquer/afficher n\'arrivent pas sur la barre de confirmation');
  if (/supprimer/.test(srcExt.slice(srcExt.indexOf('const ACTION_MENU'), srcExt.indexOf('\n', srcExt.indexOf('const ACTION_MENU'))))) fautes.push('« supprimer » est pré-choisi dans un menu (il doit rester SON geste confirmé ailleurs)');
  return fautes;
}
const fautes = verifier(SRC_APP, SRC_EXT);
if (fautes.length) { console.log('❌ audit-lien-panneau\n - ' + fautes.join('\n - ')); process.exit(1); }
console.log(`✅ audit-lien-panneau : chaque lien de l'app (${vocabulaire().length} gestes, 3 sites) est lu par l'extension ; bornes ; rien ne part sans confirmation`);
if (process.argv.includes('--mutation')) {
  const M = [
    ['ext : action hors contrat', 'ext', "if (!ACTIONS_LIEN.includes(action)) action =", "if (!action) action ="],
    ['ext : action de l’app oubliée', 'ext', "'mettre-en-ligne', 'brouillon', 'creer',", "'brouillon', 'creer',"],
    ['ext : page de l’app oubliée', 'ext', " offres: 'messages',", ''],
    ['ext : hôte libre', 'ext', "|| !/(^|\\.)(vinted\\.[a-z.]+|leboncoin\\.fr|vestiairecollective\\.com)$/i.test(String(location.hostname || ''))", ''],
    ['ext : ids non filtrés', 'ext', ".filter((x) => /^[\\w-]{1,40}$/.test(x)).slice(0, 200)", '.slice(0, 200)'],
    ['ext : adresse non nettoyée', 'ext', "history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash);", ''],
    ['ext : geste direct', 'ext', "annConfirme = { k: lienPanneau.action, ids: lienPanneau.ids.slice() };", "secuGeste(lienPanneau.action, lienPanneau.ids);"],
    ['ext : supprimer pré-choisi', 'ext', "masquer: 'masquer', afficher: 'afficher',", "masquer: 'masquer', supprimer: 'supprimer', afficher: 'afficher',"],
    ['ext : commandes mal routées', 'ext', "commandes: 'ventes'", "commandes: 'annonces'"],
  ];

  let ok = 0;
  for (const [nom, cote, de, vers] of M) {
    const src = cote === 'app' ? SRC_APP : SRC_EXT;
    if (src.split(de).length !== 2) { console.log(`❌ mutation « ${nom} » : motif absent ou multiple`); process.exit(1); }
    let f; try { f = cote === 'app' ? verifier(src.replace(de, vers), SRC_EXT) : verifier(SRC_APP, src.replace(de, vers)); } catch (e) { f = ['erreur ' + e.message]; }
    if (f.length) ok++; else { console.log(`❌ mutation « ${nom} » reste VERTE`); process.exit(1); }
  }
  console.log(`✅ mutations : ${ok}/${M.length} rouges`);
}
