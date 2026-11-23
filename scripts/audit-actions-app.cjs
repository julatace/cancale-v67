// ═════════════════════════════════════════════════════════════════════════════
// AUDIT : AUCUN GESTE DE PLATEFORME DANS L'APP, SAUF eBay (20 nov., décision de
// Julien : « toute action doit être faite dans l'extension, on ne doit plus pouvoir
// faire d'action dans l'app »). Lecture seule, sans navigateur ni base.
//
//  P. Le PONT de l'app refuse : `vmrCmd` refuse toute commande de CMDS_PLATEFORME
//     (src/actionsExtension.js, exécuté ici) AVANT tout envoi ; `vmrExec` et
//     `vmrExecUn` refusent toute requête qui n'est pas une lecture. Chaque commande
//     de l'extension (`cmd === '…'` de vinted-sync-extension/background.js) est
//     CLASSÉE : dans CMDS_PLATEFORME, ou nommée ici comme non-geste (bordereau —
//     autorisé, CLAUDE.md §3 —, lectures, imports, marques posées dans SA base,
//     « Tout arrêter »). Une commande nouvelle, pas classée ⇒ ROUGE.
//  E. Aucun ÉCRAN n'envoie de geste : dans src/ (hors règles partagées recopiées par
//     l'extension ou lues par les écrans : RÈGLES ci-dessous) aucune commande de
//     CMDS_PLATEFORME écrite en clair, aucune écriture brute (`vmrExec…` POST/PUT/
//     DELETE), aucune baisse rangée (`deposerPrixAttente`), aucun réglage
//     d'automatisation écrit (offres auto allumées, refus, paliers, baisse par
//     règle) — l'ARRÊT d'urgence (« Tout arrêter » : éteindre) reste permis.
//  F. Les anciens ateliers d'action sont RETIRÉS (fichiers absents, jamais importés).
//  B. Chaque geste du registre a SON bouton « … dans l'extension » dans un écran, et
//     les libellés existent en cinq langues.
//  L. Le lien : `lienPanneau` rend EXACTEMENT
//     https://www.vinted.fr/?vrm=panneau&page=…&ids=…&action=… (format partagé avec
//     le chantier du panneau), le bon domaine par site.
//  Y. eBay reste dans l'app : la feuille « Changer le prix » coche et applique eBay
//     seul (route `revise`), « Publier partout » garde la case eBay.
//
//  `--mutation` : remettre un bouton d'action, retirer une commande du registre,
//  retirer le refus du pont, remettre un atelier, changer le format du lien ⇒ chaque
//  mutation doit rendre l'audit ROUGE.
//  `--arbre <dossier>` : juger un autre arbre (l'arbre d'avant doit être ROUGE).
// ═════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const iA = args.indexOf('--arbre');
const R = iA >= 0 ? path.resolve(args[iA + 1]) : path.join(__dirname, '..');

// Les règles partagées : elles CONSTRUISENT une commande (l'extension recopie la règle, les écrans la lisent),
// elles ne l'envoient pas — et le pont la refuserait.
const REGLES = new Set(['src/actionsExtension.js', 'src/prixAttente.js', 'src/prixPartout.js', 'src/soldes.js', 'src/publier/agent.js']);
// Les commandes de l'extension qui N'AGISSENT PAS sur une plateforme (une raison chacune).
const NON_GESTES = {
  bordereau: 'générer un bordereau et lire son PDF : autorisé et automatique (CLAUDE.md §3)',
  ebayMarque: 'une marque dans SA base (eBay)', lbcMarque: 'une marque dans SA base', vcMarque: 'une marque dans SA base',
  etatBaisses: 'lecture', exec: 'canal brut : les écritures sont refusées par vmrExec', fileReseauAnnuler: 'annule un geste en attente (rien ne part)',
  importSiteTout: 'lecture (import)', importTout: 'lecture (import)', lbcQuota: 'lecture', lbcRelire: 'lecture', listesVinted: 'lecture',
  photos: 'lecture des photos', verifierRepub: 'lecture (contrôle avant de republier, atelier du panneau)', rapportExtension: 'rapport local', secuArret: 'arrêt de sécurité', toutArreter: 'arrêt d\'urgence', ventes: 'lecture', fileFile: 'pause / reprise de la file d\'actions (rien ne part chez une plateforme)',
};
const RETIRES = ['src/CreerSurVinted.jsx', 'src/LbcBaissePrix.jsx', 'src/BaissePrixSerie.jsx', 'src/BaissePrixVestiaire.jsx', 'src/ModeVacances.jsx',
  'src/NegociationPaliers.jsx', 'src/PiloteFavorisAuto.jsx', 'src/FavorisVinted.jsx', 'src/AutomatisationFavoris.jsx', 'src/ModeAutoFavoris.jsx',
  'src/FavorisEtapes.jsx', 'src/FavorisListeCompte.jsx', 'src/FavorisSansVente.jsx', 'src/DiagnosticFavoris.jsx',
  // (20 nov., précision de Julien : « les automatisations … plutôt dans l'extension ») l'écran Automatisations de l'app.
  'src/automatisations/Branchement.jsx', 'src/natif/ecrans/Automatisations.jsx'];
const COMPOSANTS_RETIRES = ['RepublierVinted', 'AtelierFile', 'BrouillonsVinted', 'BrouillonsARefaire', 'BaissePrixSerie', 'CreerSurVinted', 'RepublierLeboncoin', 'FicheLbc', 'ModeVacances', 'FavorisVinted', 'PiloteFavorisAuto', 'NegociationPaliers', 'BaissePrixVestiaire', 'LbcBaissePrix'];
const LANGUES = ['fr', 'en', 'es', 'it', 'de'];

// ── lecture (avec les mutations) ─────────────────────────────────────────────
function lister(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) { if (n !== 'i18n') lister(p, out); } else if (/\.(jsx?|mjs)$/.test(n)) out.push(p);
  }
  return out;
}
function charger(mut) {
  const src = {};
  for (const f of lister(path.join(R, 'src'))) src[path.relative(R, f).split(path.sep).join('/')] = fs.readFileSync(f, 'utf8');
  const lire = (rel) => { const p = path.join(R, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
  const t = { src, fond: lire('vinted-sync-extension/background.js') || '', dico: {} };
  for (const l of LANGUES) t.dico[l] = lire(`src/i18n/langues/${l}/actionsExt.js`) || '';
  if (mut) mut(t);
  return t;
}
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// Exécute un petit module ESM (export const / export function) en CommonJS.
function executerModule(texte) {
  if (!texte) return null;
  const noms = [];
  const corps = texte.replace(/^export (const|function|let) (\w+)/gm, (_, k, n) => { noms.push(n); return `${k} ${n}`; }).replace(/^export default \w+;?$/gm, '');
  try { return new Function(`${corps}\nreturn { ${noms.join(', ')} };`)(); } catch (e) { return { erreur: String(e) }; }
}

// ── les contrôles ────────────────────────────────────────────────────────────
function juger(t) {
  const ko = [], ok = [];
  const verif = (cond, texte) => (cond ? ok : ko).push(texte);
  const reg = executerModule(t.src['src/actionsExtension.js']);
  const CMDS = reg && Array.isArray(reg.CMDS_PLATEFORME) ? reg.CMDS_PLATEFORME : [];
  verif(CMDS.length > 0 && reg && typeof reg.refusPanneau === 'function', 'P0 le registre src/actionsExtension.js se charge (CMDS_PLATEFORME, refusPanneau)');

  // P. le pont
  const app = t.src['src/App.jsx'] || '';
  const ligneCmd = (/^const vmrCmd = \(p, timeoutMs = \d+\) => \((.*)$/m.exec(app) || [])[1] || '';
  verif(/^p && estCommandePlateforme\(p\.cmd\) \? Promise\.resolve\(refusPanneau\(/.test(ligneCmd), 'P1 vmrCmd refuse une commande de plateforme AVANT tout envoi (refusPanneau)');
  const debut = (nom) => { const i = app.indexOf(`function ${nom}(`); return i < 0 ? '' : app.slice(i, i + 700).split('\n').slice(1).filter((l) => !/^\s*\/\//.test(l)).slice(0, 2).join('\n'); };
  verif(/^\s*if \(estEcriturePlateforme\(q\)\) return Promise\.resolve\(refusPanneau\(/.test(debut('vmrExec')), 'P2 vmrExec refuse toute écriture (ni pont, ni relais)');
  verif(/^\s*if \(estEcriturePlateforme\(\{ method \}\)\) return Promise\.resolve\(refusPanneau\(/.test(debut('vmrExecUn')), 'P3 vmrExecUn refuse toute écriture');
  if (reg && reg.refusPanneau && reg.estEcriturePlateforme && reg.estCommandePlateforme) {
    const r = reg.refusPanneau('x');
    verif(r.accepte === false && r.ok === false && r.envoye === false && r.code === 'panneau', 'P4 le refus a la forme d\'un refus (accepte:false, envoye:false, code panneau) : rien ne se dit « fait »');
    verif(['POST', 'PUT', 'DELETE', 'PATCH', undefined].every((m) => reg.estEcriturePlateforme({ method: m })) && !reg.estEcriturePlateforme({ method: 'GET' }), 'P5 toute méthode sauf GET est une écriture (défaut POST compris)');
  }
  const cmdsFond = [...new Set([...t.fond.matchAll(/cmd === '([a-zA-Z]+)'/g)].map((m) => m[1]).concat(/vcPreparer\|vcMarque/.test(t.fond) ? ['vcPreparer'] : []))];
  const pasClassees = cmdsFond.filter((c) => !CMDS.includes(c) && !NON_GESTES[c]);
  verif(cmdsFond.length >= 20 && !pasClassees.length, `P6 chaque commande de l'extension est classée (${cmdsFond.length})${pasClassees.length ? ' — pas classée : ' + pasClassees.join(', ') : ''}`);
  const gestesManquants = ['baisserPrixVinted', 'lbcPrix', 'vcPrix', 'lbcPause', 'lbcSupprime', 'lbcPublier', 'lbcRepondre', 'vcRepondre', 'vcOffre', 'vcOffreAimes', 'vcPreparer', 'creerVintedFiche',
    'publierFiche', 'publierBrouillon', 'recreerVinted', 'republierVinted', 'reprendreRepub', 'refaireBrouillon', 'vacancesVinted', 'planifierBaisses', 'annulerBaisses'].filter((c) => !CMDS.includes(c));
  verif(!gestesManquants.length, 'P7 chaque geste connu est dans CMDS_PLATEFORME' + (gestesManquants.length ? ' — manque : ' + gestesManquants.join(', ') : ''));

  // E. aucun écran n'envoie
  const fautes = [];
  for (const [rel, brut] of Object.entries(t.src)) {
    if (REGLES.has(rel)) continue;
    const s = sansCommentaires(brut);
    for (const m of s.matchAll(/cmd\s*:\s*['"]([a-zA-Z]+)['"]/g)) if (CMDS.includes(m[1])) fautes.push(`${rel} : commande ${m[1]}`);
    for (const m of s.matchAll(/['"](refaireBrouillon|reprendreRepub|lbcPublier|vcPreparer)['"]\s*[:)]/g)) fautes.push(`${rel} : commande ${m[1]} (choisie)`);
    if (/\bvmrExec(?:Un)?\s*\(\s*\{[^}]*method\s*:\s*['"](POST|PUT|DELETE|PATCH)['"]/.test(s)) fautes.push(`${rel} : écriture brute (vmrExec)`);
    if (/offer_requests\//.test(s)) fautes.push(`${rel} : écriture d'offre Vinted`);
    if (/\/replies[`'"]/.test(s)) fautes.push(`${rel} : réponse Vinted`);
    if (rel !== 'src/prixAttente.js' && /\bdeposerPrixAttente\s*\(\s*dep/.test(s)) fautes.push(`${rel} : baisse rangée (cmd_prix_*)`);
    if (/save\(\s*['"]vinted_offres_auto['"]\s*,\s*true/.test(s)) fautes.push(`${rel} : allume les offres auto`);
    for (const k of ['vinted_offre_refus_msg', 'vinted_offre_refus_variantes', 'vinted_baisse_regle', 'vinted_offres_paliers']) if (new RegExp(`save\\(\\s*['"]${k}['"]`).test(s)) fautes.push(`${rel} : écrit ${k}`);
    if (/save\(\s*(REGLE_CLE|CLE_PALIERS)\s*,/.test(s)) fautes.push(`${rel} : écrit un réglage d'automatisation`);
    if (/sauverReglagesFavoris\s*\(\s*\{/.test(s)) fautes.push(`${rel} : écrit les réglages des favoris`);
    if (/mode=favoris/.test(s) && /action:\s*'(suivant|terminer|auto|lancer|preparer|envoyer)'/.test(s)) fautes.push(`${rel} : pilote la file des favoris`);
    if (/\/vrm\/favoris['"`]/.test(s) && /method\s*:\s*['"]POST/.test(s)) fautes.push(`${rel} : envoie un message aux favoris`);
  }
  verif(!fautes.length, 'E1 aucun écran n\'envoie de geste de plateforme' + (fautes.length ? ' — ' + fautes.slice(0, 8).join(' · ') : ''));

  // F. ateliers retirés
  const presents = RETIRES.filter((f) => t.src[f] != null);
  verif(!presents.length, 'F1 les anciens ateliers d\'action sont retirés' + (presents.length ? ' — encore là : ' + presents.join(', ') : ''));
  const montes = [];
  for (const [rel, brut] of Object.entries(t.src)) { const s = sansCommentaires(brut); for (const c of COMPOSANTS_RETIRES) if (new RegExp(`<${c}[\\s/>]`).test(s)) montes.push(`${rel} : <${c}>`); }
  verif(!montes.length, 'F2 aucun ancien atelier n\'est monté' + (montes.length ? ' — ' + montes.join(' · ') : ''));
  const importes = [];
  for (const [rel, brut] of Object.entries(t.src)) for (const f of RETIRES) { const b = path.basename(f, '.jsx'); if (new RegExp(`['"]\\.{1,2}/(?:[\\w/]+/)?${b}(?:\\.jsx)?['"]`).test(sansCommentaires(brut))) importes.push(`${rel} → ${b}`); }
  verif(!importes.length, 'F3 aucun ancien atelier n\'est importé' + (importes.length ? ' — ' + importes.join(' · ') : ''));

  // B. chaque geste a son bouton, ses libellés
  const tout = Object.entries(t.src).filter(([rel]) => rel !== 'src/actionsExtension.js').map(([, s]) => sansCommentaires(s)).join('\n');
  const A = (reg && reg.ACTIONS_EXTENSION) || {};
  const SEL = (reg && reg.PANNEAU_DE_SELECTION) || {};
  const sansBouton = Object.keys(A).filter((k) => {
    if (new RegExp(`action=["']${k}["']`).test(tout) || new RegExp(`'data-vrm-panneau':\\s*'${k}'`).test(tout) || Object.values(SEL).includes(k)) return false;
    if (new RegExp(`'${k}'`).test((/const act = [^;]+;/.exec(tout) || [''])[0])) return false;
    return !new RegExp(`ouvrirPanneau\\(\\{[^}]*page:\\s*'${A[k].page}'[^}]*action:\\s*'${A[k].action}'`).test(tout);
  });
  verif(Object.keys(A).length >= 12 && !sansBouton.length, `B1 chaque geste du registre a son bouton « … dans l'extension » (${Object.keys(A).length})` + (sansBouton.length ? ' — sans bouton : ' + sansBouton.join(', ') : ''));
  const manquesTr = [];
  for (const l of LANGUES) for (const k of Object.keys(A)) if (!t.dico[l].includes(`"${A[k].cle}":`)) manquesTr.push(`${l}:${A[k].cle}`);
  for (const l of LANGUES) for (const k of ['actionsExt.phrase', 'actionsExt.refus', 'actionsExt.explique']) if (!t.dico[l].includes(`"${k}":`)) manquesTr.push(`${l}:${k}`);
  verif(!manquesTr.length, 'B2 les libellés existent en cinq langues' + (manquesTr.length ? ' — manque : ' + manquesTr.slice(0, 6).join(', ') : ''));
  const fr = t.dico.fr || '';
  verif(/"actionsExt\.phrase":\s*"s’ouvre sur \{site\} avec l’extension"/.test(fr), 'B3 la phrase discrète dit « s\'ouvre sur {site} avec l\'extension »');
  const bouton = sansCommentaires(t.src['src/BoutonExtension.jsx'] || '');
  verif(/ouvrirPanneau\(c\)/.test(bouton) && /data-vrm-panneau-lien/.test(bouton) && /extensionIci\(\)/.test(bouton), 'B4 le bouton ouvre le lien du panneau, le porte (data-vrm-panneau-lien) et dit la phrase sans extension ici');

  // L. le lien
  const op = executerModule(t.src['src/ouvrirPanneau.js']);
  if (op && op.lienPanneau) {
    verif(op.lienPanneau({ site: 'vinted', page: 'prix', ids: ['123', '456'], action: 'baisser' }) === 'https://www.vinted.fr/?vrm=panneau&page=prix&ids=123,456&action=baisser', 'L1 lienPanneau rend https://www.vinted.fr/?vrm=panneau&page=…&ids=…&action=…');
    verif(op.lienPanneau({ site: 'leboncoin', page: 'annonces', ids: ['9'], action: 'pause' }) === 'https://www.leboncoin.fr/?vrm=panneau&page=annonces&ids=9&action=pause'
      && op.lienPanneau({ site: 'vestiaire', page: 'messages', ids: ['c 1'], action: 'repondre' }) === 'https://fr.vestiairecollective.com/?vrm=panneau&page=messages&ids=c%201&action=repondre', 'L2 le bon domaine par site, les identifiants encodés');
    verif(op.lienPanneau({ site: 'vinted', page: 'favoris' }) === 'https://www.vinted.fr/?vrm=panneau&page=favoris', 'L3 un paramètre vide n\'est pas écrit');
  } else verif(false, 'L0 src/ouvrirPanneau.js se charge (lienPanneau)');

  // A. les automatisations : plus d'écran dans l'app, UNE rangée dans Paramètres qui ouvre le panneau, l'état lu à droite
  const regl = sansCommentaires(t.src['src/ecrans/Reglages.jsx'] || '');
  verif(/'data-vrm-panneau': 'automatisations'/.test(regl) && /ouvrirPanneau\(\{ site: 'vinted', page: 'automatisations' \}\)/.test(regl) && /automatisationsActives\(load\)/.test(regl),
    'A1 Paramètres : « Automatisations · dans l\'extension » ouvre le panneau (page automatisations), l\'état lu à droite');
  verif(!/automatisations\/Branchement|AutomatisationsLazy/.test(sansCommentaires(app)) && !/\?tab=automatisations/.test(sansCommentaires(t.src['src/ecrans/AnnoncesEgalite.jsx'] || '')),
    'A2 aucun écran Automatisations dans l\'app (ni Paramètres, ni Annonces)');

  // Y. eBay reste
  const pp = sansCommentaires(t.src['src/PrixPartout.jsx'] || '');
  verif(/sites\.filter\(\(s\) => s\.site === 'ebay'\)\.map\(\(s\) => s\.cle\)/.test(pp) && /s\.site !== 'ebay'/.test(pp) && /'data-vrm-panneau': 'changerPrix'/.test(pp), 'Y1 « Changer le prix » : eBay se coche et s\'applique ici, les autres sites ouvrent le panneau');
  verif(/action: 'revise'/.test(t.src['src/prixPartout.js'] || ''), 'Y2 eBay passe toujours par la route serveur (revise)');
  verif(/x\.site !== 'ebay'/.test(sansCommentaires(t.src['src/PublierPartout.jsx'] || '')), 'Y3 « Publier partout » garde la case eBay, Leboncoin/Vestiaire ouvrent le panneau');
  return { ok, ko };
}

// ── les mutations ────────────────────────────────────────────────────────────
const MUTATIONS = {
  'commande retirée du registre': (t) => { t.src['src/actionsExtension.js'] = t.src['src/actionsExtension.js'].replace("'lbcPause', ", ''); },
  'refus du pont retiré (vmrCmd)': (t) => { t.src['src/App.jsx'] = t.src['src/App.jsx'].replace('p && estCommandePlateforme(p.cmd) ? Promise.resolve(refusPanneau(tr(\'actionsExt.refus\'))) : ', ''); },
  'refus du pont retiré (vmrExec)': (t) => { t.src['src/App.jsx'] = t.src['src/App.jsx'].replace("  if (estEcriturePlateforme(q)) return Promise.resolve(refusPanneau(tr('actionsExt.refus')));", '  if (q && relaisVivant()) return relaisExec(q);'); },
  'bouton d\'action remis (pause Leboncoin)': (t) => { t.src['src/ecrans/Leboncoin.jsx'] += "\nexport const pauserIci = (id) => vmrCmd({ cmd: 'lbcPause', id: String(id) }, 70000);\n"; },
  'réponse Vinted remise dans l\'app': (t) => { t.src['src/App.jsx'] += "\nconst repondreIci = (oc, text) => vmrExec({ uid: oc.uid, method: 'POST', endpoint: `/api/v2/conversations/${oc.convId}/replies`, body: { reply: { body: text } } });\n"; },
  'atelier remis (ModeVacances)': (t) => { t.src['src/ModeVacances.jsx'] = 'export default function ModeVacances() { return null; }\n'; },
  'atelier remonté (<RepublierVinted>)': (t) => { t.src['src/App.jsx'] += '\nconst x = () => <RepublierVinted action="recreer"/>;\n'; },
  'offres auto rallumées d\'ici': (t) => { t.src['src/OffresAuto.jsx'] += "\nexport const allumer = () => save('vinted_offres_auto', true);\n"; },
  'format du lien changé': (t) => { t.src['src/ouvrirPanneau.js'] = t.src['src/ouvrirPanneau.js'].replace(".join(',')", ".join(';')"); },
  'commande nouvelle pas classée': (t) => { t.fond += "\nif (cmd === 'vintedMasquerTout') {}\n"; },
  'écran Automatisations remonté': (t) => { t.src['src/App.jsx'] += "\nconst AutomatisationsLazy = aLaDemande(() => import('./automatisations/Branchement.jsx'));\n"; },
  'bouton manquant (vacances)': (t) => { t.src['src/ecrans/Reglages.jsx'] = t.src['src/ecrans/Reglages.jsx'].replace('action="vacances"', 'action="automatisations"'); },
};

if (args.includes('--mutation')) {
  const base = juger(charger(null));
  if (base.ko.length) { console.log('❌ l\'arbre de départ n\'est pas vert :'); base.ko.forEach((x) => console.log('   ' + x)); process.exit(1); }
  let rate = 0;
  for (const [nom, m] of Object.entries(MUTATIONS)) {
    const r = juger(charger(m));
    if (r.ko.length) console.log(`  ✅ rouge — ${nom} (${r.ko[0].slice(0, 90)})`);
    else { console.log(`  ❌ reste VERT — ${nom}`); rate++; }
  }
  if (rate) { console.log(`\n❌ audit-actions-app --mutation : ${rate} mutation(s) ne rougissent pas`); process.exit(1); }
  console.log(`\n✅ audit-actions-app --mutation : ${Object.keys(MUTATIONS).length} mutations, toutes rouges`);
  process.exit(0);
}

const r = juger(charger(null));
r.ok.forEach((x) => console.log('  ✅ ' + x));
r.ko.forEach((x) => console.log('  ❌ ' + x));
if (r.ko.length) { console.log(`\n❌ audit-actions-app : ${r.ko.length} contrôle(s) rouge(s) — un geste de plateforme part encore de l'app`); process.exit(1); }
console.log(`\n✅ audit-actions-app : aucun geste de plateforme dans l'app (sauf eBay) — ${r.ok.length} contrôles`);
