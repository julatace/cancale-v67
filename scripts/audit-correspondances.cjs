#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DES CORRESPONDANCES ENTRE SITES (15 nov., src/correspondances.js) — lecture seule.
//  « Quand je poste une paire sur Vinted, je veux pouvoir la poster sans souci sur
//  Leboncoin, eBay et Vestiaire, que les catégories correspondent parfaitement. »
//  EXÉCUTE la vraie règle (copiée dans un dossier neuf, la mutation y est posée) :
//   A. chaque catégorie Vinted vue chez lui (23, mesurées le 15 nov. en lecture seule :
//      ses annonces et ses ventes) a, pour chaque site, une cible OU « à demander » ;
//      jamais une cible hors de la liste du site (Leboncoin : son fdata ; Vestiaire :
//      son catalogue de dépôt relevé ; eBay : AUCUN identifiant écrit — ils viennent de
//      l'API eBay au moment où il choisit) ;
//   B. le genre ne vient que du chemin Vinted (Hommes ⇒ Homme…), un article d'enfant va
//      dans une rubrique « enfants », jamais l'inverse ;
//   C. tailles, états, couleurs, marques traduits par table explicite ; hors table ⇒ null
//      (demandé), jamais approché ; la pointure reste EU (jamais convertie en US/UK) ;
//   D. SES réponses : seulement une valeur de la liste du site ; retenues par catégorie
//      Vinted ; une catégorie pas lue ⇒ rien de retenu ;
//   E. le parcours (src/publierPartout.js) : une demande bloquante bloque Leboncoin ; une
//      extension qui ne porte pas les critères bloque Leboncoin ; Vestiaire « hors » ⇒ pas
//      de case ; eBay sans SA catégorie ⇒ dit, et aucune devinée ;
//   F. la famille partagée (bloc <annonce-lbc-regle>, App.jsx = background.js) : une
//      basket d'enfant (« Vêtements pour filles > Chaussures ») est une chaussure ; une
//      chaussure de randonnée n'est pas une botte ;
//   G. le câblage : synchronisé, extension 5.381 (`lbccriteres`), envoi de la fiche.
//
//   node scripts/audit-correspondances.cjs                 l'audit
//   node scripts/audit-correspondances.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-correspondances.cjs --prouve        chaque mutation doit rougir
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const F = {
  corr: path.join(RACINE, 'src', 'correspondances.js'),
  regle: path.join(RACINE, 'src', 'publierPartout.js'),
  app: path.join(RACINE, 'src', 'App.jsx'),
  ebay: path.join(RACINE, 'src', 'ecrans', 'Ebay.jsx'),
  bg: path.join(RACINE, 'vinted-sync-extension', 'background.js'),
};
const MUTATIONS = {
  'univers-inverse': ['corr', "{ sous: 'Chaussures', univers: 'Homme', type: 'Baskets & Sneakers' }, { univers: 'Mode homme', categorie: 'Chaussures', sous: 'Baskets', posee: true }, { requete: 'baskets homme' }),",
    "{ sous: 'Chaussures', univers: 'Femme', type: 'Baskets & Sneakers' }, { univers: 'Mode homme', categorie: 'Chaussures', sous: 'Baskets', posee: true }, { requete: 'baskets homme' }),"],
  'cible-inventee': ['corr', "{ univers: 'Mode homme', categorie: 'Chaussures', demande: ['sous'] }, { requete: 'chaussures randonnée homme' }),", "{ univers: 'Mode homme', categorie: 'Chaussures', sous: 'Chaussures de randonnée', posee: true }, { requete: 'chaussures randonnée homme' }),"],
  'ebay-id-invente': ['corr', "{ requete: 'baskets femme' }),", "{ requete: 'baskets femme', id: '95672' }),"],
  'enfant-adulte': ['corr', "{ sous: 'Chaussures enfants', type: 'Baskets & Sneakers' }, { univers: 'Mode fille'", "{ sous: 'Chaussures', type: 'Baskets & Sneakers' }, { univers: 'Mode fille'"],
  'randonnee-baskets': ['corr', "{ sous: 'Chaussures', univers: 'Femme', type: 'Chaussures de randonnées' }", "{ sous: 'Chaussures', univers: 'Femme', type: 'Baskets & Sneakers' }"],
  'taille-approchee': ['corr', "    if (!m) return null;\n    if (Number(m[1]) >= 50)", "    if (!m) return chercheExact(LBC_VALEURS.shoe_size, t.slice(0, 2));\n    if (Number(m[1]) >= 50)"],
  'couleur-hors-liste': ['corr', "'Doré': 'Doré / Bronze / Cuivre',", "'Doré': 'Or',"],
  'memoire-hors-liste': ['corr', "    const ok = chercheExact(choixDe(site, champ, ctx), valeur);\n    if (!ok) return m;", "    const ok = String(valeur || '');\n    if (!ok) return m;"],
  'pointure-convertie': ['corr', "    if (/^\\d{2}(?:[.,]5)?$/.test(str(p.taille))) { out.valeurs.pointureEU = str(p.taille).replace('.', ',');", "    if (/^\\d{2}(?:[.,]5)?$/.test(str(p.taille))) { out.valeurs.pointureEU = String(Number(str(p.taille).replace(',', '.')) - 33);"],
  'demande-pas-bloquante': ['regle', "        manques.push(d.bloque\n", "        manques.push(false\n"],
  'extension-ignoree': ['regle', "if (!ctx.lbcCriteres && (corr.valeurs.univers", "if (false && (corr.valeurs.univers"],
  'vc-hors-cochable': ['regle', "    else if (site === 'vestiaire' && corr.hors) raison = 'hors';\n", ''],
  'ebay-devine': ['ebay', "  if (catChoisie) {\n    try { const { j } = await appelEbay({ action: 'pubinfo', title: t, categoryId: catChoisie.id });", "  { const { j } = await appelEbay({ action: 'pubinfo', title: t }); cat = catDepuisPubinfoEbay(j); }\n  if (catChoisie) {\n    try { const { j } = await appelEbay({ action: 'pubinfo', title: t, categoryId: catChoisie.id });"],
  'famille-enfant': ['app', "  const deux = /^v[êe]tements pour (filles|gar[çc]ons)$/.test(seg[1] || '') && /chaussure/.test(seg[2] || '') ? seg[2] : (seg[1] || '');", "  const deux = seg[1] || '';"],
  'sync-oublie': ['app', "  'vrm_correspondances',", "  'vrm_correspondances_x',"],
  'criteres-toujours': ['app', "const crit = lbcCriteres && e.lbc ?", "const crit = e.lbc ?"],
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

// Les 23 catégories Vinted vues chez lui (15 nov., lecture seule : `vinted_item_details.codes.catalog_id`
// et `catalog_id` de ses transactions, chemins par `vinted_catalogue`). Taxonomie publique de Vinted.
const VUES = {
  2632: 'Femmes > Chaussures > Baskets', 1242: 'Hommes > Chaussures > Baskets',
  2678: 'Hommes > Chaussures > Chaussures de sport > Chaussures et bottes de randonnée', 2645: 'Femmes > Chaussures > Chaussures de sport > Chaussures et bottes de randonnée',
  1453: 'Hommes > Chaussures > Chaussures de sport > Chaussures de course', 2651: 'Femmes > Chaussures > Chaussures de sport > Chaussures de course',
  2686: 'Hommes > Chaussures > Chaussures de sport > Chaussures de tennis', 2618: 'Femmes > Chaussures > Bottes > Bottines',
  1238: 'Hommes > Chaussures > Chaussures habillées', 2656: 'Hommes > Chaussures > Mocassins et chaussures bateau',
  2672: 'Hommes > Chaussures > Chaussures de sport > Chaussures de basket', 2664: 'Hommes > Chaussures > Bottes > Bottes de travail',
  5426: 'Livres et médias > Livres > Manuels scolaires et ressources pédagogiques', 2622: 'Femmes > Chaussures > Bottes > Bottes de travail',
  2954: 'Femmes > Chaussures > Mocassins et chaussures bateau', 1662: 'Enfants > Vêtements pour garçons > Chemises et t-shirts > T-shirts',
  156: 'Femmes > Sacs > Sacs à main', 1697: 'Enfants > Vêtements pour garçons > Pantalons et shorts > Jeans slim',
  3317: 'Enfants > Jeux et jouets > Loisirs créatifs > Argile et pâte à modeler', 2614: 'Femmes > Vêtements > Manteaux et vestes > Vestes > Doudounes',
  2719: 'Enfants > Vêtements pour filles > Chaussures > Baskets > Baskets à lacets', 2752: 'Enfants > Vêtements pour garçons > Chaussures > Baskets > Baskets sans lacets',
  1043: 'Femmes > Vêtements > Hauts et t-shirts > Blouses',
};

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

  let C = null, P = null;
  if (src.corr == null) dit(false, 'src/correspondances.js absent : aucune table de correspondance');
  else {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-correspondances-'));
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    const copies = new Set();
    const copier = (f, txt) => {
      if (copies.has(f)) return; copies.add(f);
      const t = txt != null ? txt : fs.readFileSync(path.join(RACINE, 'src', f), 'utf8');
      fs.mkdirSync(path.dirname(path.join(dir, 'src', f)), { recursive: true });
      fs.writeFileSync(path.join(dir, 'src', f), t);
      for (const m of t.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"](\.\/[^'"]+\.js)['"]/g)) copier(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
    };
    copier('correspondances.js', src.corr);
    if (src.regle) copier('publierPartout.js', src.regle);
    try { C = await import(pathToFileURL(path.join(dir, 'src', 'correspondances.js')).href); } catch (e) { dit(false, 'la table ne se charge pas : ' + e.message); }
    try { if (src.regle) P = await import(pathToFileURL(path.join(dir, 'src', 'publierPartout.js')).href); } catch (e) { dit(false, 'la règle Publier partout ne se charge pas : ' + e.message); }
  }

  if (C) {
    await essaie('A', async () => {
      console.log('── A. chaque catégorie vue ⇒ une cible du site, ou « à demander »');
      const ids = Object.keys(VUES);
      dit(ids.every((id) => C.TABLE_VINTED[id]), 'A1 les 23 catégories Vinted vues chez lui sont toutes dans la table', ids.filter((id) => !C.TABLE_VINTED[id]));
      dit(ids.every((id) => C.TABLE_VINTED[id] && C.TABLE_VINTED[id].chemin === VUES[id]), 'A2 chaque chemin est celui du catalogue Vinted (clé = catalog_id, jamais un titre)', ids.filter((id) => C.TABLE_VINTED[id] && C.TABLE_VINTED[id].chemin !== VUES[id]));
      const sousLbc = C.lbcSousCategories().map((x) => x.sous);
      const horsLbc = [], horsVc = [], idsEbay = [], sansRien = [];
      for (const [id, t] of Object.entries(C.TABLE_VINTED)) {
        const l = t.lbc;
        if (l.sous && !sousLbc.includes(l.sous)) horsLbc.push(id + ':' + l.sous);
        const crit = C.LBC_CRITERES_DE[l.sous] || {};
        for (const k of ['univers', 'type']) if (l[k] && !(crit[k] && C.LBC_VALEURS[crit[k]].includes(l[k]))) horsLbc.push(id + ':' + k + '=' + l[k]);
        if (!l.sous && !(l.demande || []).includes('sous')) sansRien.push(id + ':lbc');
        for (const k of ['univers', 'type']) if (crit[k] && !l[k] && !(l.demande || []).includes(k)) sansRien.push(id + ':lbc.' + k);
        const v = t.vc;
        if (!v.hors) {
          if (v.univers && !C.VC_CATALOGUE[v.univers]) horsVc.push(id + ':' + v.univers);
          if (v.categorie && !(C.VC_CATALOGUE[v.univers] || {})[v.categorie]) horsVc.push(id + ':' + v.categorie);
          if (v.sous && !((C.VC_CATALOGUE[v.univers] || {})[v.categorie] || []).includes(v.sous)) horsVc.push(id + ':' + v.sous);
          for (const k of ['univers', 'categorie', 'sous']) if (!v[k] && !(v.demande || []).includes(k)) sansRien.push(id + ':vc.' + k);
        }
        if (Object.keys(t.ebay).some((k) => k !== 'requete') || !t.ebay.requete) idsEbay.push(id);
      }
      dit(!horsLbc.length, 'A3 Leboncoin : chaque cible (catégorie, univers, type) est un libellé que Leboncoin SERT (fdata du 8 nov.)', horsLbc);
      dit(!horsVc.length, 'A4 Vestiaire : chaque cible est un libellé de SON catalogue de dépôt relevé', horsVc);
      dit(!idsEbay.length, 'A5 eBay : AUCUN identifiant écrit dans la table (seulement ce que VRM demande à eBay)', idsEbay);
      dit(!sansRien.length, 'A6 rien n’est laissé à blanc sans être demandé', sansRien);
      const cov = C.couverture();
      dit(cov.leboncoin.sure + cov.leboncoin.demande === 23 && cov.ebay.demande === 23, `A7 couverture : Leboncoin ${cov.leboncoin.sure} sûres · ${cov.leboncoin.demande} à demander ; Vestiaire ${cov.vestiaire.sure} sûres · ${cov.vestiaire.demande} à demander · ${cov.vestiaire.hors} hors site ; eBay ${cov.ebay.demande} à choisir une fois parmi ses catégories`, cov);
      // Une catégorie Vinted INCONNUE de la table : tout se demande (jamais d'après le titre).
      const inc = C.ficheSite('leboncoin', { catalogId: '999999', taille: '42' }, null);
      dit(inc.demandes.some((d) => d.champ === 'sous' && d.bloque) && !inc.valeurs.sous, 'A8 une catégorie Vinted hors table ⇒ la catégorie Leboncoin est DEMANDÉE (bloquante), rien de deviné', inc);
      const pl = C.ficheSite('leboncoin', { catalogId: null, title: 'Nike Air Max', taille: '42' }, null);
      dit(pl.raison === 'categorie-pas-lue' && pl.demandes.some((d) => d.champ === 'sous'), 'A9 catégorie Vinted pas lue ⇒ demandée, et dit pourquoi', pl);
    });
    await essaie('B', async () => {
      console.log('── B. le genre vient du chemin Vinted ; enfant ⇒ rubrique enfant');
      const faux = [];
      for (const [id, t] of Object.entries(C.TABLE_VINTED)) {
        const g = /^Hommes/.test(t.chemin) ? 'homme' : /^Femmes/.test(t.chemin) ? 'femme' : /^Enfants/.test(t.chemin) ? 'enfant' : '';
        if (t.genre !== g) faux.push(id + ' genre');
        if (t.lbc.univers && t.lbc.univers.toLowerCase() !== g) faux.push(id + ' univers ' + t.lbc.univers);
        if (g === 'enfant' && t.lbc.sous && !/enfants|Jeux/.test(t.lbc.sous)) faux.push(id + ' enfant ⇒ ' + t.lbc.sous);
        if (g && g !== 'enfant' && /enfants/.test(t.lbc.sous || '')) faux.push(id + ' adulte ⇒ ' + t.lbc.sous);
        if (t.vc.univers && g !== 'enfant' && t.vc.univers !== (g === 'homme' ? 'Mode homme' : 'Mode femme')) faux.push(id + ' vc ' + t.vc.univers);
      }
      dit(!faux.length, 'B1 univers = genre du chemin Vinted (Leboncoin, Vestiaire) ; enfant ⇒ « … enfants »', faux);
      const r = C.ficheSite('leboncoin', { catalogId: '2645', taille: '39', etat: 'Bon état' }, null);
      dit(r.valeurs.type === 'Chaussures de randonnées' && r.valeurs.univers === 'Femme', 'B2 une chaussure de randonnée femme reste « Chaussures de randonnées » · Femme (305 de ses ventes)', r.valeurs);
    });
    await essaie('C', async () => {
      console.log('── C. tailles, états, couleurs, marques : table explicite, hors table ⇒ demandé');
      dit(C.tailleLbc('42.5', { grille: 'shoe_size' }) === '42,5' && C.tailleLbc('42,5', { grille: 'shoe_size' }) === '42,5' && C.tailleLbc('44', { grille: 'shoe_size' }) === '44', 'C1 pointure Vinted ⇒ Leboncoin (« 42.5 » ⇒ « 42,5 »)');
      dit(C.tailleLbc('51', { grille: 'shoe_size' }) === '50 et plus' && C.tailleLbc('42 2/3', { grille: 'shoe_size' }) === null && C.tailleLbc('US 9', { grille: 'shoe_size' }) === null, 'C2 ≥ 50 ⇒ « 50 et plus » ; « 42 2/3 », « US 9 » ⇒ demandée (jamais approchée, jamais convertie)');
      dit(C.tailleLbc('L / 40 / 12', { grille: 'clothing_st', univers: 'Femme' }) === '40 - L' && C.tailleLbc('XXS / 32 / 4', { grille: 'clothing_st', univers: 'Femme' }) === '32 - XXS'
        && C.tailleLbc('M', { grille: 'clothing_st', univers: 'Homme' }) === 'M' && C.tailleLbc('6 ans / 116 cm', { grille: 'clothing_st_4' }) === '6 ans / 116 cm'
        && C.tailleLbc('Taille unique', { grille: 'clothing_st', univers: 'Homme' }) === 'Taille unique' && C.tailleLbc('L / 40 / 12', { grille: 'clothing_st', univers: '' }) === null,
      'C3 vêtements : femme « L / 40 / 12 » ⇒ « 40 - L », homme « M », enfant « 6 ans / 116 cm » ; univers inconnu ⇒ demandée');
      const etats = ['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'Satisfaisant'];
      dit(etats.every((e) => C.LBC_VALEURS.clothing_condition_a.includes(C.etatLbc(e))) && C.etatLbc('Satisfaisant') === 'État satisfaisant' && C.etatLbc('Comme neuf') === null, 'C4 les 5 états Vinted ⇒ un état Leboncoin servi (« Satisfaisant » ⇒ « État satisfaisant ») ; un autre mot ⇒ demandé');
      dit(C.etatEbayId('Neuf avec étiquette') === '1000' && C.etatEbayId('Neuf sans étiquette') === '1500' && C.etatEbayId('Bon état') === '3000' && C.etatEbayId('Comme neuf') === null, 'C5 états eBay : 1000 · 1500 · 3000 ; inconnu ⇒ null');
      const coul = Object.values(C.COULEUR_VERS_LBC).filter((v) => !C.LBC_VALEURS.clothing_color_a.includes(v));
      dit(!coul.length && C.couleurLbc('Noir, Blanc') === 'Noir' && C.couleurLbc('Bleu') === 'Bleu / Ciel' && C.couleurLbc('Abricot') === null, 'C6 couleurs : chaque cible est une couleur Leboncoin ; la principale d’abord ; « Abricot » (orange ou beige ?) ⇒ demandée', coul);
      dit(C.marqueLbc('adidas', 'shoe_brand_a') === 'Adidas' && C.marqueLbc('Nike SB', 'shoe_brand_a') === null, 'C7 marque : libellé exact de Leboncoin (« adidas » ⇒ « Adidas ») ; « Nike SB » ⇒ demandée');
      const e = C.ficheSite('ebay', { catalogId: '1242', taille: '42.5', etat: 'Bon état' }, null);
      dit(e.valeurs.pointureEU === '42,5' && e.valeurs.etat === '3000' && !e.valeurs.categorie && e.demandes.some((d) => d.champ === 'categorie'), 'C8 eBay : pointure EU telle quelle, état 3000, catégorie À CHOISIR (aucune devinée)', e);
    });
    await essaie('D', async () => {
      console.log('── D. SES réponses : de la liste du site, retenues par catégorie Vinted');
      let m = C.retenir(null, '1238', 'leboncoin', 'type', 'Chaussures à lacets');
      const f = C.ficheSite('leboncoin', { catalogId: '1238', taille: '44', etat: 'Bon état' }, m);
      dit(f.valeurs.type === 'Chaussures à lacets' && f.origine.type === 'memoire' && !f.demandes.length, 'D1 sa réponse (« Chaussures habillées » ⇒ « Chaussures à lacets ») vaut la fois suivante', f);
      const m2 = C.retenir(m, '1238', 'leboncoin', 'type', 'Richelieu en cuir');
      dit(JSON.stringify(m2) === JSON.stringify(m), 'D2 une valeur hors de la liste de Leboncoin n’est jamais retenue', m2);
      const m3 = C.retenir(null, '', 'leboncoin', 'type', 'Chaussures à lacets');
      dit(!Object.keys(m3.cat).length, 'D3 catégorie Vinted pas lue ⇒ rien de retenu (la réponse vaut pour l’annonce)', m3);
      const fr = C.ficheSite('leboncoin', { catalogId: null, taille: '44', etat: 'Bon état' }, null, { sous: 'Chaussures', univers: 'Homme', type: 'Mocassins' });
      dit(fr.valeurs.sous === 'Chaussures' && fr.valeurs.univers === 'Homme' && fr.valeurs.type === 'Mocassins' && fr.valeurs.taille === '44' && !fr.demandes.length, 'D4 catégorie pas lue : ses réponses pour CETTE annonce remplissent la fiche (critères en cascade)', fr);
      const m4 = C.retenir(null, '2678', 'ebay', 'categorie', { id: '181392', nom: 'Chaussures de randonnée', chemin: 'Sports › Randonnée' });
      const e = C.ficheSite('ebay', { catalogId: '2678' }, m4);
      dit(e.valeurs.categorie && e.valeurs.categorie.id === '181392' && !e.demandes.length, 'D5 eBay : la catégorie qu’il a choisie parmi celles d’eBay est retenue', e);
      const e2 = C.ficheSite('ebay', { catalogId: '2678' }, m4, { categorie: null });
      dit(!e2.valeurs.categorie && e2.demandes.length === 1, 'D6 « Changer la catégorie eBay » ⇒ redemandée', e2);
      const vc = C.ficheSite('vestiaire', { catalogId: '2678' }, C.retenir(null, '2678', 'vestiaire', 'sous', 'Baskets'));
      dit(vc.valeurs.sous === 'Baskets' && vc.posee === false, 'D7 Vestiaire : sa réponse est retenue, et dite « à finir sur Vestiaire » (la voie ne la porte pas)', vc);
    });
  }

  if (P && C) {
    await essaie('E', async () => {
      console.log('── E. le parcours Publier partout');
      const regles = { titreLbc: (m, t) => String(t || '').slice(0, 50), titreVc: (m, t) => String(t || '').slice(0, 80), titreEbay: (t) => String(t || '').slice(0, 80),
        descriptionLbc: (o) => `${o.texte || ''}\n\nRéf. ${o.ref}`, descriptionEbay: (p) => p.desc || '', etatsLbc: ['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'État satisfaisant'], categorieLbc: () => 'Chaussures' };
      const photos = ['https://images1.vinted.net/a/1.jpg', 'https://images1.vinted.net/a/2.jpg', 'https://images1.vinted.net/a/3.jpg'];
      const paire = (o = {}) => ({ id: '9101', num: '101', title: 'Salomon XT-6 noir', taille: '39', marque: 'Salomon', etat: 'Très bon état', couleur: 'Noir', photos, desc: 'Très propre', prix: 90, cover: photos[0], catalogId: '2645', ...o });
      const ctx = (o = {}) => ({ enLigne: { leboncoin: false, vestiaire: false, ebay: false }, ext: { leboncoin: '', vestiaire: '', ebay: '' }, regles, lbcCriteres: true, memoire: null, categorieVoie: 'Chaussures', ...o });
      const s = (l, site) => l.sites.find((x) => x.site === site);
      const l1 = P.lignePartout(paire(), ctx());
      const lb = s(l1, 'leboncoin');
      dit(lb.cochable && lb.corr.valeurs.type === 'Chaussures de randonnées' && lb.corr.valeurs.univers === 'Femme' && lb.corr.valeurs.taille === '39', 'E1 sa Salomon femme de randonnée part sur Leboncoin : Chaussures · Femme · Chaussures de randonnées · 39', lb.corr.valeurs);
      const pl = P.planPartout([l1], new Set(['9101:leboncoin']));
      dit(pl[0] && pl[0].lbc && pl[0].lbc.categorie === 'Chaussures' && pl[0].lbc.criteres.univers === 'Femme' && pl[0].lbc.criteres.type === 'Chaussures de randonnées', 'E2 le plan porte à l’extension la catégorie et les critères', pl[0] && pl[0].lbc);
      const l2 = P.lignePartout(paire({ catalogId: '1238', marque: 'Paraboot', title: 'Paraboot Michael' }), ctx());
      const lb2 = s(l2, 'leboncoin');
      dit(!lb2.cochable && lb2.manques.some((m) => m.code === 'corr-type' && m.bloque) && lb2.demandes.includes('corr:type'), 'E3 « Chaussures habillées » : le type Leboncoin est DEMANDÉ et bloque tant qu’il manque', lb2.manques);
      const l3 = P.lignePartout(paire({ catalogId: '1238', marque: 'Paraboot' }), ctx({ saisie: { corr: { leboncoin: { type: 'Chaussures à lacets' } } } }));
      dit(s(l3, 'leboncoin').cochable && s(l3, 'leboncoin').corr.valeurs.type === 'Chaussures à lacets', 'E4 sa réponse débloque la case', s(l3, 'leboncoin').manques);
      const l4 = P.lignePartout(paire(), ctx({ lbcCriteres: false }));
      dit(!s(l4, 'leboncoin').cochable && s(l4, 'leboncoin').manques.some((m) => m.code === 'corr-extension' && m.bloque), 'E5 une extension qui ne porte pas les critères : Leboncoin bloqué (il les devinerait), le geste dit', s(l4, 'leboncoin').manques);
      const l5 = P.lignePartout(paire({ catalogId: '5426', title: 'Manuels ST2S', taille: '', marque: '' }), ctx());
      dit(!s(l5, 'vestiaire').cochable && s(l5, 'vestiaire').raison === 'hors', 'E6 un manuel scolaire : Vestiaire « ne vend pas ça » — aucune case', s(l5, 'vestiaire').raison);
      const eb = s(l1, 'ebay');
      dit(eb.cochable && eb.manques.some((m) => m.code === 'corr-categorie' && !m.bloque) && eb.demandes.includes('corr:categorie'), 'E7 eBay sans SA catégorie : dit (à choisir parmi celles d’eBay), le brouillon l’attendra', eb.manques);
      const vc = s(l1, 'vestiaire');
      dit(vc.finir.includes('Sous-catégorie'), 'E8 Vestiaire : la sous-catégorie sans correspondance sûre est « à finir sur Vestiaire »', vc.finir);
      const pl2 = P.planPartout([l1], new Set(['9101:ebay']));
      dit(pl2[0] && pl2[0].corr && !pl2[0].corr.valeurs.categorie, 'E9 le plan eBay ne porte AUCUNE catégorie devinée', pl2[0] && pl2[0].corr);
    });
  }

  await essaie('F', async () => {
    console.log('── F. la famille partagée (App.jsx = background.js)');
    const bloc = (t) => { const m = /\/\/ <annonce-lbc-regle>[^\n]*\n([\s\S]*?)\/\/ <\/annonce-lbc-regle>/.exec(t || ''); return m ? m[1] : ''; };
    const ba = bloc(src.app), bb = bloc(src.bg);
    if (!mut || MUTATIONS[mut][0] !== 'app') dit(ba && ba === bb, 'F1 le bloc est IDENTIQUE dans l’app et l’extension (§11)');
    const ctx = {}; vm.createContext(ctx);
    vm.runInContext('const LBC_TITRE_MAX = 50;\n' + ba + '\nthis.f = familleArticle; this.l = categorieLbcDe; this.E = LBC_ETATS;', ctx);
    const k = ctx.f({ chemin: 'Enfants > Vêtements pour filles > Chaussures > Baskets > Baskets à lacets', titre: 'Nike Air Force 1', taille: '32' });
    dit(k.famille === 'chaussures' && k.genre === 'enfant', 'F2 une basket d’enfant (rangée par Vinted sous « Vêtements pour filles ») est une chaussure', k);
    dit(ctx.l('Nike Air Force 1', '', '32', 'Enfants > Vêtements pour filles > Chaussures > Baskets > Baskets à lacets') === 'Chaussures enfants', 'F3 ⇒ Leboncoin « Chaussures enfants » (avant : « Vêtements enfants »)');
    const r = ctx.f({ chemin: 'Hommes > Chaussures > Chaussures de sport > Chaussures et bottes de randonnée', titre: 'Salomon XT-6', marque: 'Salomon' });
    dit(r.famille === 'chaussures' && r.sous === 'randonnee', 'F4 une chaussure de randonnée n’est pas une botte (Vestiaire « Bottes » avant)', r);
    dit(ctx.E.includes('Neuf sans étiquette'), 'F5 « Neuf sans étiquette » est un état Leboncoin (fdata du 8 nov.)');
  });

  await essaie('G', async () => {
    console.log('── G. le câblage');
    const app = src.app || '';
    dit(/'vrm_correspondances',/.test(app), 'G1 SES réponses sont synchronisées (SYNC_KEYS)');
    dit(/lbccriteres: '5\.381\.0'/.test(app) && /function criteresFicheLbc\(/.test(src.bg || ''), 'G2 capacité lbccriteres (5.381.0) : l’extension porte criteresFicheLbc');
    // (20 nov., décision de Julien) Leboncoin se publie dans le PANNEAU de l'extension (qui pose catégorie et critères) : l'app n'envoie rien.
    dit(/leboncoin: refusSite,/.test(app) && !/cmd: 'lbcPublier'/.test(app), 'G3 (20 nov.) rien ne part de l’app vers Leboncoin : catégorie et critères se posent dans l’extension');
    dit(/categorie: cat \}/.test(app) && !/appelEbay\(\{ action: 'pubinfo', title: t \}\)/.test(src.ebay || ''), 'G4 eBay : le brouillon reçoit SA catégorie ; plus aucune suggestion prise d’office');
    dit(/details\[id\]\.codes\.catalog_id/.test(app), 'G5 la catégorie Vinted est aussi lue sous `codes.catalog_id` (là où l’extension la range)');
  });

  console.log(`\n${n - ko}/${n} vérifications vertes.`);
  process.exit(ko ? 1 : 0);
})();
