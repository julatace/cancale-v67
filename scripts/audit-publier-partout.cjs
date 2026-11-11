#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « PUBLIER PARTOUT » (11 nov., src/publierPartout.js) — lecture seule.
//  EXÉCUTE la vraie règle (copiée dans un dossier neuf, la mutation y est posée) :
//   A. prix par site : égal par défaut, ± € / ± %, ≤ 0 ⇒ rien ; Vestiaire jamais réglé ;
//   B. vocabulaire : l'état Vinted vers un mot que le site propose, sinon DEMANDÉ ;
//   C. identité (§5) : sans N° rien ne part ; chaque envoi porte VRM-{n°} ;
//      50 paires au même titre : chacune SA référence, « déjà en ligne » par SON N° ;
//   D. pas su ≠ non : une liste pas lue ⇒ case jamais cochée d'office ;
//   E. un champ obligatoire inconnu (prix, état Leboncoin) bloque jusqu'à sa saisie ;
//   F. l'envoi l'un après l'autre : un dépôt attend la fin du précédent ; un dépôt
//      pas fini arrête CE site ; un refus « plafond » aussi ; eBay = brouillon,
//      jamais « publié » ; pas de réponse ⇒ refusé + site arrêté ;
//   G. le câblage de l'app : voies existantes (lbcPublier, vcPreparer, brouillon
//      eBay sans publication ni port), réglage synchronisé, entrée fiche + série.
//
//   node scripts/audit-publier-partout.cjs                 l'audit
//   node scripts/audit-publier-partout.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-publier-partout.cjs --prouve        chaque mutation doit rougir
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const F = {
  regle: path.join(RACINE, 'src', 'publierPartout.js'),
  app: path.join(RACINE, 'src', 'App.jsx'),
  ebay: path.join(RACINE, 'src', 'ecrans', 'Ebay.jsx'),
  actions: path.join(RACINE, 'src', 'annoncesActions.js'),
  suivi: path.join(RACINE, 'src', 'publierPartoutSuivi.js'),
  prix: path.join(RACINE, 'src', 'prixPartout.js'),
};
const MUTATIONS = {
  'prix-pas-bloque': ['regle', "m.code === 'prix-absent' ? { ...m, bloque: true", "m.code === 'prix-absent' ? { ...m, bloque: false"],
  'passu-coche': ['regle', 'cocheDefaut: cochable && deja === false', 'cocheDefaut: cochable && deja !== true'],
  'sans-identite': ['regle', "if (!e || !e.num || !e.apercu || !e.apercu.ref) {", 'if (!e) {'],
  'pas-attendre': ['regle', "fin = typeof attendre === 'function' && r.jobId ? await attendre(r.jobId) : { etape: 'delai' };", "fin = { etape: 'fait' };"],
  'delai-continue': ['regle', "arrete[e.site] = 'pas envoyé : le dépôt précédent n’est pas fini';", "arrete[e.site] = '';"],
  'ebay-publie': ['regle', "dire(e.cle, { etat: 'a-finir', raison: r.complet", "dire(e.cle, { etat: 'publie', raison: r.complet"],
  'vestiaire-prix': ['regle', 'const mode = PRIX_REGLABLE[site] && MODES_PRIX.includes(r.mode)', 'const mode = MODES_PRIX.includes(r.mode)'],
  'etat-devine': ['regle', 'return cherche ? (l.find((x) => cherche.test(x)) || null) : null;', 'return cherche ? (l.find((x) => cherche.test(x)) || l[0]) : l[0];'],
  'deja-cochable': ['regle', "else if (deja === true) raison = 'deja';", ''],
  'plafond-insiste': ['regle', "if (ARRET_SITE.test(code)) arrete[e.site]", 'if (false) arrete[e.site]'],
  'serie-absente': ['actions', "{ k: 'partout',", "{ k: 'partout-retire',"],
  'ebay-publie-app': ['ebay', "origine: 'partout' };", "origine: 'partout' }; await appelEbay({ action: 'publish', item: itemDeBrouillon(b).item, confirme: true });"],
  'sync-oublie': ['app', "  'vrm_partout_prix',\n", ''],
  // (11 nov. soir) tous les paramètres, par défaut puis par annonce
  'parametre-pas-bloque': ['regle', "if (horsVoie && auto != null && auto !== PROFIL) effet = 'bloque';", "if (false) effet = 'bloque';"],
  'annonce-ignoree': ['regle', "const source = va ? 'annonce' : vd ? 'defaut'", "const source = vd ? 'defaut' : va ? 'annonce'"],
  'valeur-hors-liste': ['regle', "if (liste && !liste.includes(s)) return '';", ''],
  'vc-publie-quand-meme': ['regle', "if (e.site === 'vestiaire' && finir.length) {", 'if (false) {'],
  'arret-ignore': ['regle', "if (!stop && typeof doitSArreter === 'function')", 'if (false)'],
  'requis-invente': ['regle', "if (!sous || !categorieLbcDeSous(sous)) return null;", "if (!sous || !categorieLbcDeSous(sous)) return 'Chaussures';"],
  'suivi-main-ok': ['suivi', "'a-finir': 'main'", "'a-finir': 'ok'"],
  'vc-publier-app': ['app', "publier: !finir && extSait('vcauto') === 'ok'", "publier: extSait('vcauto') === 'ok'"],
  'params-sync-oublie': ['app', "  'vrm_partout_params',\n", ''],
  // (11 nov. soir) « un prix modifié dans VRM change partout »
  'prix-sans-ajustement': ['prix', "return r ? prixPourSite(n, r) : n;", 'return n;'],
  'vinted-envoye': ['prix', "dire(s.cle, { etat: 'propose', raison: null, prix: cible, avant: s.prix }); continue;", "if (typeof envoyer.vinted === 'function') { await envoyer.vinted(s, cible); } dire(s.cle, { etat: 'fait', prix: cible }); continue;"],
  'relu-ignore': ['prix', "if (etat === 'fait' && relu != null && Math.round(relu * 100) !== Math.round(cible * 100))", 'if (false)'],
  'prix-reglage-oublie': ['app', "envoyer: ENVOIS_PRIX, surEtat, reglage: reglageP });", 'envoyer: ENVOIS_PRIX, surEtat });'],
};
const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    if (r.status !== 0 && rouges) ok++;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');

(async () => {
  const src = {};
  for (const [k, p] of Object.entries(F)) src[k] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src[m[0]] || !src[m[0]].includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src[m[0]] = src[m[0]].replace(m[1], m[2]);
  }
  let ko = 0, n = 0;
  const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : ' + e.message); } };

  let P = null, S = null, X = null;
  if (src.regle != null) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-publier-partout-'));
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'src', 'publierPartout.js'), src.regle);
    for (const f of ['publierAilleurs.js', 'verifAnnonce.js']) fs.copyFileSync(path.join(RACINE, 'src', f), path.join(dir, 'src', f));
    if (src.prix != null) fs.writeFileSync(path.join(dir, 'src', 'prixPartout.js'), src.prix);
    if (src.suivi != null) fs.writeFileSync(path.join(dir, 'src', 'publierPartoutSuivi.js'), src.suivi);
    try { P = await import(pathToFileURL(path.join(dir, 'src', 'publierPartout.js')).href); } catch (e) { dit(false, 'la règle ne se charge pas : ' + e.message); }
    try { if (src.prix != null) X = await import(pathToFileURL(path.join(dir, 'src', 'prixPartout.js')).href); } catch (e) { dit(false, 'src/prixPartout.js ne se charge pas : ' + e.message); }
    try { if (src.suivi != null) S = await import(pathToFileURL(path.join(dir, 'src', 'publierPartoutSuivi.js')).href); } catch (e) { dit(false, 'le branchement du suivi ne se charge pas : ' + e.message); }
  } else dit(false, 'src/publierPartout.js absent : aucun « Publier partout »');

  const LBC_ETATS = ['Neuf avec étiquette', 'Très bon état', 'Bon état', 'État satisfaisant'];
  const regles = { titreLbc: (m, t) => String(t || '').slice(0, 50), titreVc: (m, t) => String(t || '').slice(0, 80), titreEbay: (t) => String(t || '').slice(0, 80),
    descriptionLbc: (o) => `${o.texte || ''}\n\nRéf. ${o.ref}`, descriptionEbay: (p) => p.desc || '', etatsLbc: LBC_ETATS, categorieLbc: () => 'Chaussures' };
  const photos = ['https://images1.vinted.net/a/1.jpg', 'https://images1.vinted.net/a/2.jpg', 'https://images1.vinted.net/a/3.jpg'];
  const paire = (i, o = {}) => ({ id: String(9000 + i), num: String(i), title: 'Nike Air Max 90 blanche', taille: '42', marque: 'Nike', etat: 'Très bon état', photos, desc: 'Très propre', prix: 60, cover: photos[0], ...o });
  const ctx = (o = {}) => ({ enLigne: { leboncoin: false, vestiaire: false, ebay: false }, ext: { leboncoin: '', vestiaire: '', ebay: '' }, regles, ...o });
  const site = (l, s) => l.sites.find((x) => x.site === s);

  if (P) {
    await essaie('A', () => {
      console.log('── A. le prix par site');
      const r0 = P.reglagePrix(null);
      dit(P.SITES_PARTOUT.every((s) => r0[s].mode === 'egal'), 'A1 sans réglage : le prix Vinted partout (jamais deviné)');
      dit(P.prixPourSite(60, { mode: 'eur', valeur: 5 }) === 65 && P.prixPourSite(60, { mode: 'pct', valeur: -10 }) === 54, 'A2 « +5 € » ⇒ 65 € ; « −10 % » ⇒ 54 €');
      dit(P.prixPourSite(10, { mode: 'eur', valeur: -10 }) === null && P.prixPourSite(null, { mode: 'egal' }) === null, 'A3 ≤ 0 € ou prix pas lu ⇒ null (rien ne part)');
      const r = P.reglagePrix({ vestiaire: { mode: 'pct', valeur: 20 }, ebay: { mode: 'eur', valeur: '4,5' } });
      dit(r.vestiaire.mode === 'egal' && r.ebay.mode === 'eur' && r.ebay.valeur === 4.5, 'A4 Vestiaire jamais réglé (sa voie part du prix Vinted) ; « 4,5 » lu', r);
      const l = P.lignePartout(paire(1), ctx({ reglage: { leboncoin: { mode: 'eur', valeur: 5 }, vestiaire: { mode: 'eur', valeur: 30 } } }));
      dit(site(l, 'leboncoin').apercu.prix === 65 && site(l, 'vestiaire').apercu.prix === 60 && site(l, 'ebay').apercu.prix === 60, 'A5 la ligne porte le prix de CHAQUE site', l.sites.map((x) => x.apercu.prix));
      const l2 = P.lignePartout(paire(1, { prix: 5 }), ctx({ reglage: { leboncoin: { mode: 'eur', valeur: -10 } } }));
      dit(!site(l2, 'leboncoin').cochable && site(l2, 'leboncoin').manques.some((m) => m.code === 'prix-regle'), 'A6 un réglage qui donne ≤ 0 € bloque CE site et le dit');
    });
    await essaie('B', () => {
      console.log('── B. le vocabulaire de chaque site');
      dit(P.etatPourLbc('Satisfaisant', LBC_ETATS) === 'État satisfaisant' && P.etatPourLbc('Très bon état', LBC_ETATS) === 'Très bon état', 'B1 état Vinted ⇒ mot Leboncoin');
      dit(P.etatPourLbc('Neuf sans étiquette', LBC_ETATS) === null && P.etatPourLbc('', LBC_ETATS) === null, 'B2 état sans équivalent Leboncoin ⇒ null (jamais deviné)');
      dit(P.etatPourEbay('Neuf avec étiquette') === '1000' && P.etatPourEbay('Neuf sans étiquette') === '1500' && P.etatPourEbay('Bon état') === '3000' && P.etatPourEbay('bizarre') === null, 'B3 état eBay 1000 / 1500 / 3000, inconnu ⇒ null');
      const v = P.vocabulaire('vestiaire', paire(1), {}, regles);
      dit(v.categorieQuand === 'sur-le-site' && v.etat === null, 'B4 Vestiaire : catégorie et état « à choisir sur Vestiaire »');
      dit(P.vocabulaire('ebay', paire(1), {}, regles).categorieQuand === 'au-depart', 'B5 eBay : catégorie suggérée par eBay au départ');
    });
    await essaie('C', () => {
      console.log('── C. l\'identité (§5)');
      const sans = P.lignePartout(paire(1, { num: '' }), ctx());
      dit(sans.sites.every((x) => !x.cochable && x.raison === 'pas-de-numero'), 'C1 sans N° : aucune case cochable');
      dit(P.planPartout([sans], new Set(sans.sites.map((x) => P.cleCase(sans.id, x.site)))).length === 0, 'C2 sans N° : rien dans le plan, même coché');
      // 50 paires au MÊME titre ; seule la N°17 est déjà sur Leboncoin (par SON N°).
      const lignes = [];
      for (let i = 1; i <= 50; i++) lignes.push(P.lignePartout(paire(i), ctx({ enLigne: { leboncoin: i === 17, vestiaire: false, ebay: false } })));
      dit(lignes.every((l, k) => l.sites.every((x) => x.apercu.identite && x.apercu.identite.valeur === 'VRM-' + (k + 1))), 'C3 50 titres identiques : chaque site porte VRM-{SON n°}');
      dit(lignes.filter((l) => site(l, 'leboncoin').deja === true).map((l) => l.num).join() === '17', 'C4 « déjà sur Leboncoin » pour la N°17 seulement (par identité, jamais par le titre)');
      dit(!site(lignes[16], 'leboncoin').cochable && site(lignes[16], 'ebay').cochable, 'C5 déjà en ligne ⇒ cette case seule ne part pas');
      const plan = P.planPartout(lignes, new Set(lignes.flatMap((l) => l.sites.map((x) => P.cleCase(l.id, x.site)))));
      dit(plan.length === 149 && plan.every((e) => e.apercu.ref === 'VRM-' + e.num), 'C6 le plan : 149 envois, chacun SA référence', plan.length);
      dit(plan.findIndex((e) => e.site === 'vestiaire') > plan.map((e) => e.site).lastIndexOf('leboncoin'), 'C7 site par site : tous les Leboncoin, puis Vestiaire, puis eBay');
    });
    await essaie('D', () => {
      console.log('── D. pas su ne vaut pas non');
      const l = P.lignePartout(paire(3), ctx({ enLigne: { leboncoin: null, vestiaire: false, ebay: null } }));
      dit(site(l, 'leboncoin').cochable && !site(l, 'leboncoin').cocheDefaut && site(l, 'vestiaire').cocheDefaut, 'D1 liste pas lue : cochable par lui, jamais cochée d\'office');
      const e = P.lignePartout(paire(3), ctx({ ext: { leboncoin: 'Ton extension est trop ancienne', vestiaire: '', ebay: '' } }));
      dit(!site(e, 'leboncoin').cochable && site(e, 'leboncoin').extRaison === 'Ton extension est trop ancienne', 'D2 extension pas prête : la case ne part pas et dit pourquoi');
    });
    await essaie('E', () => {
      console.log('── E. un champ obligatoire inconnu est DEMANDÉ');
      const l = P.lignePartout(paire(4, { prix: null }), ctx());
      dit(l.sites.every((x) => !x.cochable && x.demandes.includes('prix')), 'E1 prix pas lu : demandé, aucune case ne part');
      const l2 = P.lignePartout(paire(4, { prix: null }), ctx({ saisie: { prix: '72,5' } }));
      dit(l2.sites.every((x) => x.cochable && x.apercu.prix === 72.5), 'E2 prix tapé ⇒ il part tel quel');
      const l3 = P.lignePartout(paire(5, { etat: 'Neuf sans étiquette' }), ctx());
      dit(!site(l3, 'leboncoin').cochable && site(l3, 'leboncoin').demandes.includes('etat-lbc') && site(l3, 'ebay').cochable, 'E3 état inconnu de Leboncoin : demandé pour Leboncoin seulement');
      const l4 = P.lignePartout(paire(5, { etat: 'Neuf sans étiquette' }), ctx({ saisie: { etatLbc: 'Très bon état' } }));
      dit(site(l4, 'leboncoin').cochable && site(l4, 'leboncoin').vocab.etat === 'Très bon état', 'E4 état choisi ⇒ Leboncoin part avec son choix');
      const l5 = P.lignePartout(paire(5, { title: 'x'.repeat(70) }), { ...ctx(), regles: { ...regles, titreLbc: (m, t) => t } });
      dit(!site(l5, 'leboncoin').cochable, 'E5 titre trop long pour Leboncoin ⇒ bloqué (la voie le refuserait)');
    });
    await essaie('F', async () => {
      console.log('── F. l\'envoi, l\'un après l\'autre');
      const lignes = [1, 2, 3].map((i) => P.lignePartout(paire(i), ctx()));
      const tout = new Set(lignes.flatMap((l) => l.sites.map((x) => P.cleCase(l.id, x.site))));
      const plan = P.planPartout(lignes, tout);
      const journal = [];
      let enVol = 0, max = 0;
      const extension = (site) => async (e) => { enVol++; max = Math.max(max, enVol); journal.push('envoi:' + e.cle); return { accepte: true, etape: 'depot', jobId: site + ':' + e.id }; };
      const attendre = async (j) => { await new Promise((r) => setTimeout(r, 5)); journal.push('fin:' + j); enVol--; return { etape: 'fait' }; };
      const res = await P.executerPartout({ plan, envoyer: { leboncoin: extension('lbc'), vestiaire: extension('vc'), ebay: async () => ({ accepte: true, etape: 'brouillon', complet: true }) }, attendre });
      dit(max === 1, 'F1 jamais deux dépôts en vol (un seul dépôt en attente par site dans l\'extension)', max);
      dit(journal.indexOf('fin:lbc:9001') < journal.indexOf('envoi:9002:leboncoin'), 'F2 le 2e dépôt Leboncoin part APRÈS la fin du 1er', journal.slice(0, 4));
      dit(['9001', '9002', '9003'].every((id) => res[id + ':leboncoin'].etat === 'publie' && res[id + ':vestiaire'].etat === 'publie'), 'F3 dépôt fini ⇒ « publié »');
      dit(['9001', '9002', '9003'].every((id) => res[id + ':ebay'].etat === 'a-finir'), 'F4 eBay : un brouillon, jamais « publié » d\'ici', res['9001:ebay']);
      const res2 = await P.executerPartout({ plan, envoyer: { leboncoin: extension('lbc'), vestiaire: extension('vc'), ebay: async () => ({ accepte: true, etape: 'brouillon' }) }, attendre: async (j) => { enVol--; return /^lbc/.test(j) ? { etape: 'delai' } : { etape: 'fait' }; } });
      dit(res2['9001:leboncoin'].etat === 'a-finir' && res2['9002:leboncoin'].etat === 'pas-envoye' && res2['9003:leboncoin'].etat === 'pas-envoye', 'F5 dépôt pas fini ⇒ « à finir sur le site », les suivants de CE site pas envoyés', [res2['9002:leboncoin']]);
      dit(res2['9001:vestiaire'].etat === 'publie', 'F6 … les autres sites continuent');
      let appels = 0;
      const res3 = await P.executerPartout({ plan: plan.filter((e) => e.site === 'leboncoin'), envoyer: { leboncoin: async () => { appels++; return { accepte: false, code: 'plafond', raison: '50 actions cette heure' }; } } });
      dit(appels === 1 && res3['9002:leboncoin'].etat === 'pas-envoye', 'F7 refus « plafond » : on n\'insiste pas sur ce site', appels);
      const res4 = await P.executerPartout({ plan: plan.filter((e) => e.site === 'vestiaire'), envoyer: { vestiaire: async () => null } });
      dit(res4['9001:vestiaire'].etat === 'refuse' && res4['9002:vestiaire'].etat === 'pas-envoye', 'F8 pas de réponse ⇒ refusé (rien n\'est sûr), site arrêté');
      const res5 = await P.executerPartout({ plan: [{ cle: '1:leboncoin', id: '1', num: '1', site: 'leboncoin', apercu: { ref: '' } }], envoyer: { leboncoin: async () => { appels += 100; return { accepte: true, etape: 'fait' }; } } });
      dit(res5['1:leboncoin'].etat === 'pas-envoye' && appels === 1, 'F9 un envoi sans référence VRM n\'est JAMAIS envoyé (double garde)');
      dit(P.etatAffiche({ etat: 'publie' }, true) === 'publie-relu' && P.etatAffiche({ etat: 'publie' }, null) === 'publie', 'F10 « publié ✓ relu » seulement quand le site le montre par identité');
      dit(P.aussiSur({ lbc: true, ebay: null, vestiaire: true }).join() === 'leboncoin,vestiaire', 'F11 pastilles : seulement ce qui est prouvé (true), jamais « pas su »');
    });
  }

  if (P) {
    await essaie('H', () => {
      console.log('── H. tous les paramètres : défaut, puis par annonce ; rien d\'inventé');
      const r = { ...regles, ville: 'Vannes' };
      const ch = (l, s, c) => site(l, s).champs.find((x) => x.champ === c);
      const l0 = P.lignePartout(paire(1, { couleur: 'Blanc' }), ctx({ regles: r }));
      dit(['categorie', 'sousCategorie', 'marque', 'taille', 'couleur', 'etat', 'matiere', 'livraison', 'mainPropre', 'lieu', 'options'].every((c) => ch(l0, 'leboncoin', c)), 'H1 Leboncoin : catégorie, sous-catégorie, marque, taille, couleur, état, matière, livraison, main propre, lieu, options');
      dit(['univers', 'categorie', 'marque', 'taille', 'etat', 'couleur', 'matiere', 'authenticite'].every((c) => ch(l0, 'vestiaire', c)), 'H2 Vestiaire : univers, catégorie, marque, taille, état, couleur, matière, authenticité');
      dit(ch(l0, 'leboncoin', 'sousCategorie').valeur === 'Chaussures' && ch(l0, 'leboncoin', 'categorie').valeur === 'Mode' && ch(l0, 'leboncoin', 'lieu').valeur === 'Vannes' && ch(l0, 'leboncoin', 'couleur').source === 'auto', 'H3 auto : ce que la voie pose d\'elle-même (catégorie de l\'app, ville des Réglages, couleur Vinted)');
      dit(site(l0, 'leboncoin').cochable && !site(l0, 'leboncoin').finir.length && !site(l0, 'vestiaire').finir.length, 'H4 rien de changé ⇒ rien de bloqué, rien à finir', [site(l0, 'leboncoin').manques, site(l0, 'vestiaire').finir]);
      const l1 = P.lignePartout(paire(1), ctx({ regles: r, params: { leboncoin: { livraison: 'non' } } }));
      dit(!site(l1, 'leboncoin').cochable && site(l1, 'leboncoin').manques.some((m) => m.code === 'hors-voie-livraison' && m.bloque), 'H5 un défaut que la voie Leboncoin contredirait (livraison non) ⇒ bloqué et dit');
      const l2 = P.lignePartout(paire(1), ctx({ regles: r, params: { leboncoin: { livraison: 'non' } }, saisie: { params: { leboncoin: { livraison: 'oui' } } } }));
      dit(site(l2, 'leboncoin').cochable && ch(l2, 'leboncoin', 'livraison').source === 'annonce', 'H6 l\'annonce passe avant le défaut', ch(l2, 'leboncoin', 'livraison'));
      const l3 = P.lignePartout(paire(1), ctx({ regles: r, params: { leboncoin: { livraison: 'peut-être', etat: 'Comme neuf' } } }));
      dit(ch(l3, 'leboncoin', 'livraison').source === 'auto' && ch(l3, 'leboncoin', 'etat').source === 'auto', 'H7 une valeur hors de la liste du site n\'est jamais rangée');
      const l4 = P.lignePartout(paire(1, { title: 'Objet bizarre', taille: '' }), ctx({ regles: { ...r, categorieLbc: () => '' } }));
      dit(ch(l4, 'leboncoin', 'sousCategorie').valeur === null && ch(l4, 'leboncoin', 'sousCategorie').demande && ch(l4, 'leboncoin', 'sousCategorie').effet === 'sur-site', 'H8 catégorie introuvable ⇒ DEMANDÉE (jamais inventée), à choisir pendant le dépôt');
      dit(site(l4, 'leboncoin').demandes.includes('champ:sousCategorie') && site(l4, 'leboncoin').demandes.includes('champ:taille'), 'H9 la taille introuvable est demandée aussi', site(l4, 'leboncoin').demandes);
      const l5 = P.lignePartout(paire(1), ctx({ regles: r, params: { vestiaire: { matiere: 'Cuir', univers: 'Mode homme' } } }));
      dit(site(l5, 'vestiaire').cochable && site(l5, 'vestiaire').finir.join('|') === 'Univers « Mode homme »|Matière « Cuir »', 'H10 Vestiaire : ses choix que la voie ne porte pas ⇒ « à finir sur Vestiaire » nommés', site(l5, 'vestiaire').finir);
      const l6 = P.lignePartout(paire(1), ctx({ regles: r, saisie: { params: { leboncoin: { matiere: 'Cuir' } } } }));
      dit(site(l6, 'leboncoin').cochable && site(l6, 'leboncoin').manques.some((m) => m.code === 'perdu-matiere' && !m.bloque), 'H11 Leboncoin : une matière que la voie ne pose pas ⇒ « ne partira pas », dit avant');
      const l7 = P.lignePartout(paire(1), ctx({ regles: r, saisie: { prixSite: { leboncoin: '55', vestiaire: '99' } } }));
      dit(site(l7, 'leboncoin').apercu.prix === 55 && site(l7, 'vestiaire').apercu.prix === 60, 'H12 prix de CETTE annonce sur Leboncoin ; Vestiaire reste le prix Vinted');
      const d = P.reglageParams({ leboncoin: { options: 'boost', couleur: 'Noir' }, vestiaire: { authenticite: 'oui' } }, r);
      dit(!d.leboncoin.options && d.leboncoin.couleur === 'Noir' && d.vestiaire.authenticite === 'oui', 'H13 aucune option payante ne se règle (jamais de boost)', d);
    });
    await essaie('I', async () => {
      console.log('── I. l\'envoi : Vestiaire à finir, arrêt entre deux, suivi commun');
      const r = { ...regles, ville: 'Vannes' };
      const lignes = [1, 2].map((i) => P.lignePartout(paire(i), ctx({ regles: r, params: { vestiaire: { matiere: 'Cuir' } } })));
      const plan = P.planPartout(lignes, new Set(lignes.flatMap((l) => l.sites.map((x) => P.cleCase(l.id, x.site)))));
      let attentesVc = 0;
      const res = await P.executerPartout({ plan, envoyer: { leboncoin: async (e) => ({ accepte: true, etape: 'depot', jobId: 'lbc:' + e.id }), vestiaire: async (e) => ({ accepte: true, etape: 'depot', jobId: 'vc:' + e.id }), ebay: async () => ({ accepte: true, complet: true }) },
        attendre: async (j) => { if (/^vc/.test(j)) attentesVc++; return { etape: 'fait' }; } });
      dit(res['9001:vestiaire'].etat === 'a-finir' && /Matière « Cuir »/.test(res['9001:vestiaire'].raison) && res['9002:vestiaire'].etat === 'pas-envoye' && attentesVc === 0, 'I1 Vestiaire à finir : jamais « publié », le suivant ne l\'écrase pas', [res['9001:vestiaire'], res['9002:vestiaire']]);
      let n = 0;
      const res2 = await P.executerPartout({ plan, envoyer: { leboncoin: async () => ({ accepte: true, etape: 'fait' }), vestiaire: async () => ({ accepte: true, etape: 'fait' }), ebay: async () => ({ accepte: true }) }, doitSArreter: () => ++n > 2 });
      dit(res2['9001:leboncoin'].etat === 'publie' && res2['9002:leboncoin'].etat === 'publie' && Object.keys(res2).filter((k) => res2[k].etat === 'pas-envoye' && /arrêté/.test(res2[k].raison)).length === plan.length - 2, 'I2 « Arrêter » entre deux envois : le reste n\'est PAS envoyé, et le dit');
      if (!S) { dit(false, 'I3 src/publierPartoutSuivi.js absent'); return; }
      dit(S.suiviPourPartout(null, plan) === null && S.suiviPourPartout({}, plan) === null, 'I3 sans suivi commun : rien (la feuille garde son état par case)');
      const gestes = [];
      const faux = { demarrer: (o) => { gestes.push(['demarrer', o.articles.length]); return { debut: (id) => gestes.push(['debut', id]), etape: (id, c) => gestes.push(['etape', id, c]), fin: (id, x) => gestes.push(['fin', id, x.etat]), doitSArreter: () => false, terminer: () => gestes.push(['terminer']) }; } };
      const sv = S.suiviPourPartout(faux, plan);
      await P.executerPartout({ plan: plan.slice(0, 3), envoyer: { leboncoin: async (e) => ({ accepte: true, etape: 'depot', jobId: 'lbc:' + e.id }) }, attendre: async () => ({ etape: 'fait' }), surEtat: sv.surEtat });
      sv.terminer();
      const fins = gestes.filter((g) => g[0] === 'fin').map((g) => g[2]);
      dit(gestes[0][1] === plan.length && fins[0] === 'ok' && gestes.some((g) => g[0] === 'etape' && g[2] === 'depot') && gestes[gestes.length - 1][0] === 'terminer', 'I4 le suivi commun reçoit chaque étape (envoi, dépôt, fin), puis terminer', gestes.slice(0, 6));
      const g2 = []; const sv2 = S.suiviPourPartout({ demarrer: () => ({ debut: () => {}, etape: () => {}, fin: (id, x) => g2.push(x.etat), doitSArreter: () => false, terminer: () => {} }) }, plan);
      sv2.surEtat('x', { etat: 'a-finir', raison: 'à finir' });
      dit(g2[0] === 'main', 'I5 « à finir sur le site » ⇒ « à la main » dans le suivi, jamais « fait »', g2);
    });
  }

  if (X) {
    await essaie('J', async () => {
      console.log('── J. un prix modifié dans VRM change partout');
      const sites = [
        { cle: 'vinted:1', site: 'vinted', id: '1', compte: '111', prix: 60, mode: 'propose' },
        { cle: 'ebay:2', site: 'ebay', id: '2', prix: 60, mode: 'app' },
        { cle: 'leboncoin:3', site: 'leboncoin', id: '3', prix: 60, mode: 'site' },
        { cle: 'vestiaire:4', site: 'vestiaire', id: '4', prix: 60, mode: 'site' },
      ];
      const appels = [];
      const envoyer = { vinted: async (s, p) => { appels.push(['vinted', p]); return { etat: 'fait' }; }, ebay: async (s, p) => { appels.push(['ebay', p]); return { etat: 'fait', prixRelu: p }; } };
      const r = await X.appliquerPrix({ sites, coches: new Set(sites.map((x) => x.cle)), prix: '50', envoyer, reglage: { ebay: { mode: 'eur', valeur: 5 }, leboncoin: { mode: 'pct', valeur: 10 } } });
      dit(appels.length === 1 && appels[0][0] === 'ebay' && appels[0][1] === 55, 'J1 eBay reçoit SON ajustement (+5 € ⇒ 55 €) ; rien d\'autre n\'est envoyé d\'ici', appels);
      dit(r.res['ebay:2'].etat === 'fait' && r.res['ebay:2'].relu === true, 'J2 eBay relu après, au prix demandé', r.res['ebay:2']);
      dit(r.res['vinted:1'].etat === 'propose' && r.res['vinted:1'].prix === 50, 'J3 Vinted : PROPOSÉ (son clic dans « Baisser le prix »), jamais envoyé', r.res['vinted:1']);
      dit(r.res['leboncoin:3'].etat === 'a-faire' && r.res['leboncoin:3'].prix === 55 && r.res['vestiaire:4'].prix === 50, 'J4 Leboncoin / Vestiaire : « à faire sur le site » avec LE prix à mettre (+10 % ⇒ 55 € ; Vestiaire = le prix tapé)', [r.res['leboncoin:3'], r.res['vestiaire:4']]);
      const r2 = await X.appliquerPrix({ sites, coches: new Set(['ebay:2']), prix: '50', envoyer: { ebay: async () => ({ etat: 'fait', prixRelu: 60 }) } });
      dit(r2.res['ebay:2'].etat === 'incertain', 'J5 eBay relu à un autre prix ⇒ « pas sûr », jamais « fait »', r2.res['ebay:2']);
    });
  }

  console.log('── G. le câblage de l\'app');
  const app = src.app ? sansCommentaires(src.app) : '';
  const i = app.indexOf('function HotePublierPartout(');
  const hote = i >= 0 ? app.slice(i, app.indexOf('\n}\n', i)) : '';
  dit(!!hote, 'G1 l\'hôte HotePublierPartout existe');
  dit(/cmd: 'lbcPublier'/.test(hote) && /valideAnnonceLbc\(/.test(hote) && /cmd: 'vcPreparer'/.test(hote) && /preparerBrouillonPartout/.test(hote), 'G2 chaque site par SA voie (lbcPublier + fiche, vcPreparer, brouillon eBay)');
  dit(!/action: 'publish'/.test(hote) && !/supprim|lbcSupprime/.test(hote), 'G3 l\'hôte ne publie rien sur eBay et ne supprime rien');
  dit(/raisonExtGlobale\(sansSouris, \{ cap: 'publication'/.test(hote) && /cap: 'vcpublier'/.test(hote), 'G4 les gardes d\'extension des voies (publication, vcpublier)');
  dit(/sitesPrixDe\(/.test(hote) && /enLigneSur\(/.test(hote), 'G5 « déjà en ligne » par sitesDuNumero (identité)');
  const ebay = src.ebay ? sansCommentaires(src.ebay) : '';
  const j = ebay.indexOf('async function preparerBrouillonPartout(');
  const prep = j >= 0 ? ebay.slice(j, ebay.indexOf('\n}\n', j)) : '';
  dit(!!prep && /modifierBrouillonsEbay\(/.test(prep) && /skuEbayDe\(numero\)/.test(prep), 'G6 eBay : un brouillon (lire-fusionner-écrire), N° lisible exigé');
  dit(!!prep && !/action: 'publish'|action: 'pubverify'/.test(prep) && !/livraison|shipping|gratuit|freeShip/i.test(prep), 'G7 eBay : aucune publication, aucun port (§2.8)');
  dit(!!prep && /memePaire\(items\)/.test(prep), 'G8 eBay : jamais un 2e brouillon de la même paire');
  dit(/'vrm_partout_prix',/.test(src.app || ''), 'G9 le réglage de prix est synchronisé (SYNC_KEYS)');
  dit(/data-fiche-partout=/.test(app) && /'vrm:publier-partout'/.test(app), 'G10 l\'entrée sur la fiche d\'une annonce Vinted');
  dit(/\{ k: 'partout',/.test(src.actions || '') && /k==='partout'/.test(app), 'G11 en série : Annonces → Actions → « Publier partout… »');
  dit(/aussiSur\(\{ lbc:/.test(app) && /vcNumsAnn\.has\(cleNum\(num\)\)/.test(app), 'G12 pastilles « aussi sur » Leboncoin · eBay · Vestiaire sur l\'annonce');
  dit(/'vrm_partout_params',/.test(src.app || '') && /onParamAnnonce=/.test(hote) && /reglageParams\(/.test(hote), 'G13 les paramètres par défaut synchronisés, et par annonce');
  dit(/publier: !finir && extSait\('vcauto'\) === 'ok'/.test(hote), 'G14 Vestiaire à finir ⇒ le dépôt s\'ouvre sans publier tout seul');
  dit(/prixDe=\{\(site, p\)=>prixParSite\(site, p, reglageP\)\}/.test(app) && /reglage: reglageP \}\)/.test(app) && /<BaissePrixSerie annonces=\{baisseCoque\.annonces\} baisseInitiale=/.test(app), 'G16 « Changer le prix » : ajustement par site, Vinted proposé dans « Baisser le prix »');
  dit(/suiviPourPartout\(await chargerSuivi\(\)/.test(hote) && /doitSArreter: sv \? sv\.doitSArreter/.test(hote), 'G15 le suivi commun (SuiviTravail) branché, avec Pause / Arrêter');

  console.log(`\n${n - ko}/${n} vérifications vertes.`);
  process.exit(ko ? 1 : 0);
})();
