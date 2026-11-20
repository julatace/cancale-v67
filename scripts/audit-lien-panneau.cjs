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
  const code = src.replace(/^export const /gm, 'const ').replace(/^export function /gm, 'function ') + '\n;({ lienPanneau, PAGES_PANNEAU, ACTIONS_PANNEAU });';
  return vm.runInNewContext(code, { URLSearchParams });
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
  const pagesExt = Object.keys(PAGES_LIEN).sort().join(','), pagesApp = [...app.PAGES_PANNEAU].sort().join(',');
  if (pagesExt !== pagesApp) fautes.push(`pages différentes : app [${pagesApp}] ≠ extension [${pagesExt}]`);
  if ([...ACTIONS_LIEN].sort().join(',') !== [...app.ACTIONS_PANNEAU].sort().join(',')) fautes.push('actions différentes entre app et extension');
  const ATTENDU = { accueil: 'accueil', articles: 'annonces', commandes: 'ventes', messagerie: 'messages', notifications: 'notifications', automatisations: 'automatisations', favoris: 'favoris', republier: 'annonces', prix: 'annonces', publier: 'annonces', parametres: 'parametres' };
  for (const site of ['vinted', 'leboncoin', 'vestiaire']) {
    for (const page of app.PAGES_PANNEAU) for (const action of ['', ...app.ACTIONS_PANNEAU]) {
      const href = app.lienPanneau({ site, page, ids: ['123', 'ab-9', '123'], action });
      if (!href) { fautes.push(`pas de lien pour ${site}/${page}`); continue; }
      const { r, remplace } = ext.lire(href);
      if (!r) { fautes.push(`l'extension ne lit pas ${href}`); continue; }
      if (r.page !== ATTENDU[page]) fautes.push(`${site} ${page} ⇒ onglet ${r.page} (attendu ${ATTENDU[page]})`);
      if (r.ids.join(',') !== '123,ab-9') fautes.push(`${site} ${page} : ids ${r.ids.join(',')}`);
      const attA = action || (page === 'republier' ? 'republier' : page === 'prix' ? 'baisser' : '');
      if (r.action !== attA) fautes.push(`${site} ${page} ${action} ⇒ action « ${r.action} »`);
      if (!remplace.length || /vrm=|ids=|action=/.test(remplace[0])) fautes.push(`${site} ${page} : paramètres laissés dans l'adresse`);
    }
  }
  if (app.lienPanneau({ site: 'exemple.com', page: 'articles' }) !== null) fautes.push('un site inconnu reçoit un lien');
  const sale = app.lienPanneau({ site: 'vinted', page: 'articles', ids: ['1', '<script>', '../x', 'a b', '2'] });
  if (!/ids=1,2(&|$)/.test(sale)) fautes.push('ids douteux non écartés par l\'app : ' + sale);
  const beaucoup = app.lienPanneau({ site: 'vinted', page: 'articles', ids: Array.from({ length: 80 }, (_, i) => String(i)) });
  if ((new URL(beaucoup).searchParams.get('ids') || '').split(',').length !== 50) fautes.push('plus de 50 ids');
  const lu = ext.lire('https://www.vinted.fr/?vrm=panneau&page=articles&ids=1,%3Cscript%3E,2&action=supprimer').r;
  if (!lu || lu.ids.join(',') !== '1,2') fautes.push('l\'extension garde un id douteux');
  if (lu && lu.action !== '') fautes.push('l\'extension accepte une action hors contrat (« supprimer »)');
  if (ext.lire('https://evil.example/?vrm=panneau&page=articles').r !== null) fautes.push('un hôte étranger est lu');
  if (ext.lire('https://www.vinted.fr/?page=articles').r !== null) fautes.push('lu sans vrm=panneau');
  const appli = ext.application.replace(/\/\/.*$/gm, '');
  if (/secuGeste|envoyer|fetch\(|sendMessage|executer|lancer/i.test(appli)) fautes.push('le lien déclenche un geste au lieu de le préparer');
  if (!/annConfirme\s*=/.test(appli)) fautes.push('masquer/afficher n\'arrivent pas sur la barre de confirmation');
  return fautes;
}

const fautes = verifier(SRC_APP, SRC_EXT);
if (fautes.length) { console.log('❌ audit-lien-panneau\n - ' + fautes.join('\n - ')); process.exit(1); }
console.log('✅ audit-lien-panneau : contrat app = extension (11 pages, 9 actions, 3 sites), aller-retour, bornes, rien ne part sans confirmation');
if (process.argv.includes('--mutation')) {
  const M = [
    ['app : ids non filtrés', 'app', '.filter((x) => ID_SUR.test(x))', ''],
    ['app : page en plus', 'app', "'publier', 'parametres']", "'publier', 'parametres', 'supprimer']"],
    ['app : site libre', 'app', "if (!base) return null;", "if (!base) return 'https://' + site + '/?';"],
    ['ext : action hors contrat', 'ext', "if (!ACTIONS_LIEN.includes(action)) action =", "if (!action) action ="],
    ['ext : hôte libre', 'ext', "|| !/(^|\\.)(vinted\\.[a-z.]+|leboncoin\\.fr|vestiairecollective\\.com)$/i.test(String(location.hostname || ''))", ''],
    ['ext : ids non filtrés', 'ext', ".filter((x) => /^[\\w-]{1,40}$/.test(x)).slice(0, 50)", '.slice(0, 50)'],
    ['ext : adresse non nettoyée', 'ext', "history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash);", ''],
    ['ext : geste direct', 'ext', "annConfirme = { k: lienPanneau.action, ids: lienPanneau.ids.slice() };", "secuGeste(lienPanneau.action, lienPanneau.ids);"],
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
