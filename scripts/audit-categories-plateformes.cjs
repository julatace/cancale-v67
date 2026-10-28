#!/usr/bin/env node
// audit-categories-plateformes.cjs — (28 oct.) « la catégorie ne correspond peut-
// être pas exactement : elle doit trouver celle qui correspond pour la plateforme ».
// Exécute la VRAIE règle (bloc <annonce-lbc-regle> + categorieVcDe de
// background.js) sur des cas, et le catalogue de dépôt Vestiaire à la FORME
// mesurée le 27 oct. (`vc_catalogue.deposit_catalog`, libellés réels, aucune donnée
// personnelle). Règles jugées :
//   · Leboncoin : le libellé EXACT de la sous-catégorie (« Chaussures », jamais
//     « Sacs à main », qui n'existe pas) ; un article enfant ⇒ « … enfants » ;
//   · Vestiaire : univers seulement d'après le genre Vinted (jamais deviné du
//     titre), sous-catégorie seulement si elle EXISTE dans la catégorie ;
//   · eBay : la même famille alimente « Département » (genre Vinted seulement).
// `--src chemin` lance l'audit sur une copie de background.js (mutations).
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const arg = process.argv.indexOf('--src');
const SRC = arg > 0 ? process.argv[arg + 1] : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const APP = path.join(__dirname, '..', 'src', 'App.jsx');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); } };
const s = fs.readFileSync(SRC, 'utf8');
const bloc = (t) => { const m = /\/\/ <annonce-lbc-regle>[^\n]*\n([\s\S]*?)\/\/ <\/annonce-lbc-regle>/.exec(t); return m ? m[1] : ''; };
const extrait = (t, debut, fin) => { const a = t.indexOf(debut); if (a < 0) return ''; const b = t.indexOf(fin, a); return b < 0 ? '' : t.slice(a, b + fin.length); };
const b = bloc(s);
dit(!!b, 'le bloc partagé existe dans l\'extension');
dit(bloc(fs.readFileSync(APP, 'utf8')) === b, 'le bloc est IDENTIQUE dans l\'app (§11)');
const vc = extrait(s, 'const VC_SOUS = {', '\n  return out;\n}\n');
dit(!!vc, 'categorieVcDe existe');
const ctx = {};
vm.createContext(ctx);
try { vm.runInContext('const LBC_TITRE_MAX = 50;\n' + b + '\n' + vc + '\nthis.f = familleArticle; this.l = categorieLbcDe; this.c = cheminCatalogueVinted; this.v = (typeof categorieVcDe === "function" ? categorieVcDe : null);', ctx); }
catch (e) { dit(false, 'la règle se charge', String(e && e.message)); }
const { f, l, c, v } = ctx;
const essaie = (fn, ...a) => { try { return fn(...a); } catch (e) { return { erreur: String(e && e.message) }; } };
// Le catalogue Vinted, à la forme mesurée (racine > famille > feuille, `path`).
const catV = { catalogs: [
  { id: 5, title: 'Hommes', path: '', catalogs: [{ id: 1231, title: 'Chaussures', path: 'Hommes', catalogs: [{ id: 1242, title: 'Baskets', path: 'Hommes > Chaussures', catalogs: [] }] }] },
  { id: 1904, title: 'Femmes', path: '', catalogs: [{ id: 16, title: 'Chaussures', path: 'Femmes', catalogs: [{ id: 2632, title: 'Baskets', path: 'Femmes > Chaussures', catalogs: [] }] }, { id: 19, title: 'Sacs', path: 'Femmes', catalogs: [{ id: 157, title: 'Sacs à dos', path: 'Femmes > Sacs', catalogs: [] }] }] },
  { id: 1193, title: 'Enfants', path: '', catalogs: [{ id: 1196, title: 'Chaussures', path: 'Enfants', catalogs: [] }] },
] };
// Le catalogue de dépôt Vestiaire, libellés mesurés le 27 oct.
const catVc = { data: [
  { id: '1', title: 'Mode femme', categories: [
    { id: '5', title: 'Sacs', subCategories: [{ id: '59', title: 'Sacs à main' }, { id: '57', title: 'Pochettes' }, { id: '526', title: 'Sacs à dos' }] },
    { id: '3', title: 'Chaussures', subCategories: [{ id: '62', title: 'Bottes' }, { id: '64', title: 'Baskets' }, { id: '505', title: 'Mocassins' }] },
    { id: '2', title: 'Vêtements', subCategories: [{ id: '23', title: 'Jeans' }, { id: '16', title: 'Tops' }] } ] },
  { id: '2', title: 'Mode homme', categories: [
    { id: '12', title: 'Vêtements', subCategories: [{ id: '525', title: 'Tee shirts' }, { id: '34', title: 'Jeans' }] },
    { id: '13', title: 'Chaussures', subCategories: [{ id: '32', title: 'Bottes & Boots' }, { id: '30', title: 'Baskets' }, { id: '606', title: 'Mocassins' }] } ] },
  { id: '3', title: 'Mode fille', categories: [{ id: '11', title: 'Chaussures', subCategories: [{ id: '84', title: 'Baskets' }] }] },
] };
if (f && c) {
  dit(c(catV, 1242) === 'Hommes > Chaussures > Baskets', 'chemin Vinted retrouvé par l\'identifiant de catégorie', c(catV, 1242));
  dit(c(catV, 999999) === '' && c(null, 1242) === '', 'catégorie inconnue ou catalogue absent ⇒ chemin vide (rien de deviné)');
  const a = essaie(f, { titre: 'Salomon XT-6 noir taille 41,5', taille: '41,5', marque: 'Salomon' });
  dit(a.famille === 'chaussures' && a.sous === 'baskets' && a.genre === '', 'Salomon sans chemin : baskets, genre NON deviné', JSON.stringify(a));
  const b2 = essaie(f, { chemin: 'Hommes > Chaussures > Baskets', titre: 'Nike Air Max 1 noir', taille: '44' });
  dit(b2.famille === 'chaussures' && b2.sous === 'baskets' && b2.genre === 'homme' && b2.source === 'vinted', 'avec le chemin Vinted : homme, baskets', JSON.stringify(b2));
  const d = essaie(f, { titre: 'Jean Levi\'s 501 taille 40', taille: '40' });
  dit(d.famille === 'vetements' && d.sous === 'jeans', 'un jean taille 40 n\'est pas une chaussure', JSON.stringify(d));
  const e = essaie(f, { titre: 'Mocassins Paraboot taille 42', taille: '42' });
  dit(e.sous === 'mocassins', 'des mocassins restent des mocassins (pas « baskets »)', JSON.stringify(e));
  const g = essaie(f, { titre: 'Lot de trois manuels scolaires' });
  dit(g.famille === '', 'rien de sûr ⇒ famille vide', JSON.stringify(g));
  const h = essaie(f, { titre: 'Nike Dunk Low', taille: '42', description: 'envoyée dans un sac' });
  dit(h.famille === 'chaussures', 'un « sac » de la description ne fait pas d\'une paire un sac', JSON.stringify(h));
}
if (l) {
  dit(l('Salomon XT-6 noir taille 41,5', '', '41,5') === 'Chaussures', 'Leboncoin : « Chaussures »');
  dit(l('Sac à dos Eastpak', '', '') === 'Accessoires & Bagagerie', 'Leboncoin : un sac ⇒ « Accessoires & Bagagerie » (« Sacs à main » n\'existe pas)', l('Sac à dos Eastpak', '', ''));
  dit(l('Nike Air Force 1', '', '30', 'Enfants > Chaussures') === 'Chaussures enfants', 'Leboncoin : un article enfant ⇒ « Chaussures enfants »');
  dit(l('Montre Casio', '', '') === 'Montres & Bijoux', 'Leboncoin : une montre ⇒ « Montres & Bijoux »');
  dit(l('Lot de trois manuels scolaires', '', '') === 'Livres', 'Leboncoin : livres inchangé');
}
if (v && f) {
  const r1 = essaie(v, f({ chemin: 'Hommes > Chaussures > Baskets', titre: 'Nike Air Max 1' }), catVc);
  dit(r1.univers === 'Mode homme' && r1.categorie === 'Chaussures' && r1.sous === 'Baskets' && r1.ids && r1.ids.sous === '30' && !r1.manque.length, 'Vestiaire : Mode homme › Chaussures › Baskets (ids du catalogue)', JSON.stringify(r1));
  const r2 = essaie(v, f({ titre: 'Salomon XT-6 noir', taille: '41,5', marque: 'Salomon' }), catVc);
  dit(r2.univers === '' && r2.categorie === 'Chaussures' && r2.sous === 'Baskets' && r2.manque.some((m) => /univers/.test(m)), 'Vestiaire sans genre : catégorie et sous-catégorie, univers À CHOISIR (nommé)', JSON.stringify(r2));
  const r3 = essaie(v, f({ chemin: 'Femmes > Sacs > Sacs à dos', titre: 'Sac à dos' }), catVc);
  dit(r3.univers === 'Mode femme' && r3.categorie === 'Sacs' && r3.sous === 'Sacs à dos', 'Vestiaire : Mode femme › Sacs › Sacs à dos', JSON.stringify(r3));
  const r4 = essaie(v, f({ titre: 'Bottes Dr. Martens 1460', taille: '38' }), catVc);
  dit(r4.categorie === 'Chaussures' && r4.sous === '', 'Vestiaire sans genre : « Bottes » (femme) ≠ « Bottes & Boots » (homme) ⇒ sous-catégorie NON tranchée', JSON.stringify(r4));
  const r5 = essaie(v, f({ chemin: 'Hommes > Chaussures > Baskets', titre: 'x' }), null);
  dit(r5.verifie === false && r5.categorie === 'Chaussures', 'catalogue Vestiaire illisible : libellés proposés, marqués non vérifiés', JSON.stringify(r5));
  const r6 = essaie(v, f({ chemin: 'Enfants > Chaussures', titre: 'Basket enfant', taille: '30' }), catVc);
  dit(r6.univers === '' && r6.manque.some((m) => /univers/.test(m)), 'Vestiaire enfant : fille OU garçon, jamais tranché', JSON.stringify(r6));
}
console.log(`\n${ok} ✅ · ${ko} ❌`);
process.exit(ko ? 1 : 0);
