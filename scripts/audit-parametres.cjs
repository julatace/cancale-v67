#!/usr/bin/env node
// ── audit-parametres — PARAMÈTRES EN DIX CATÉGORIES (15 nov.) ─────────────────────────────
// Ce qui se juge sans rendu (le banc `scripts/bancs/parametres-refonte.cjs` juge le rendu) :
//   1. chaque rangée de Paramètres (`GROUPES_REGLAGES`, `GROUPES_COMPTE` de src/ecrans/Reglages.jsx)
//      est NOMMÉE dans une catégorie (src/parametres/categories.js) — et une seule fois ;
//   2. le filet : une rangée ajoutée plus tard sans être nommée part dans la catégorie de son
//      groupe d'avant (« Qui numérote ? » dans `stock` ⇒ « Stock et numéros »), jamais perdue ;
//   3. chaque lien profond relevé dans le code (`?tab=settings&reglage=X`, `REGLAGES_AIDE`,
//      `DEMANDE_REGLAGE_SOUS.id = 'X'`, `section=`) mène à une rangée qui EXISTE, dans une catégorie ;
//   4. dix catégories, une icône chacune (et qui existe dans ICON_PATHS), un titre et une phrase
//      dans les cinq langues ; « Sécurité des données » est l'expert, à part ;
//   5. « Organisation » reste joignable sous « Stock et rangement » (CLAUDE.md §3) ; la carte
//      Photoroom n'est pas dans Paramètres (§3, « Détourage ») ;
//   6. la clé « Sécurité des données » n'est plus écrite deux fois (la seconde gagnait).
//   7. (16 nov., lot apparence-rangee — décidé par Julien) plus d'interrupteur « Mode sombre » en doublon
//      d'« Apparence » ; « Apparence et langue » rangée en groupes TITRÉS (Apparence · Langue · Écrans…),
//      chaque titre dans les cinq langues.
//   node scripts/audit-parametres.cjs                 la règle du dépôt
//   node scripts/audit-parametres.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-parametres.cjs --prouve        toutes les mutations : chacune doit rougir
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const F = {
  cat: path.join(RACINE, 'src', 'parametres', 'categories.js'),
  reg: path.join(RACINE, 'src', 'ecrans', 'Reglages.jsx'),
  app: path.join(RACINE, 'src', 'App.jsx'),
  aide: path.join(RACINE, 'src', 'aideFiches.js'),
};
const MUTATIONS = {
  // Le filet coupé : une rangée non nommée disparaît.
  'filet-coupe': ['cat', '    if (pris.has(id)) continue;\n', '    continue;\n'],
  // Une rangée retirée de sa catégorie (le filet la rattrape, mais elle n'est plus NOMMÉE).
  'rangee-oubliee': ['cat', "items: ['push', 'rappels', 'agenda', 'alertes', 'capte']", "items: ['rappels', 'agenda', 'alertes', 'capte']"],
  // Deux catégories avec la même icône.
  'icone-double': ['cat', "{ id: 'argent', ic: 'euro',", "{ id: 'argent', ic: 'tag',"],
  // Un ancien lien perdu : l'abonnement n'est plus une rangée connue.
  'lien-abonnement': ['reg', "{ id:'abonnement', type:'panneau', nu:true, paresseux:true,", "{ id:'abonnement-x', type:'panneau', nu:true, paresseux:true,"],
  // « Organisation » quitte « Stock et rangement ».
  // (16 nov.) L'interrupteur « Mode sombre » revient dans sa catégorie.
  'sombre-remis': ['cat', "items: ['apparence', 'taille-texte', 'zoom']", "items: ['apparence', 'sombre', 'taille-texte', 'zoom']"],
  // (16 nov.) Le premier groupe d'« Apparence et langue » redevient sans titre.
  'groupe-sans-titre': ['cat', "{ id: 'apparence', titre: 'parametres.g.apparence', items:", "{ id: 'apparence', items:"],
  'organisation': ['cat', "{ id: 'stock', titre: 'reglages.groupe.stock', items: ['numeros', 'je-vends'], pied: 'stock' }", "{ id: 'stock', titre: 'reglages.groupe.stock', items: ['numeros', 'je-vends'] }"],
};
const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok === Object.keys(MUTATIONS).length ? '✅' : '❌'} ${ok}/${Object.keys(MUTATIONS).length} mutations rougissent`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}
const src = {}; for (const [k, f] of Object.entries(F)) src[k] = fs.readFileSync(f, 'utf8');
if (mut) { const [f, a, b] = MUTATIONS[mut] || []; if (!f || !src[f].includes(a)) { console.log(`❌ mutation inconnue ou ancre absente : ${mut}`); process.exit(1); } src[f] = src[f].replace(a, b); }
let ko = 0, n = 0;
const dit = (bon, quoi, detail) => { n++; if (!bon) ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-parametres-'));
  const fc = path.join(tmp, 'categories.mjs'); fs.writeFileSync(fc, src.cat);
  const C = await import(pathToFileURL(fc).href);
  const fr = path.join(tmp, 'fr.mjs');
  const L = {};
  for (const l of ['fr', 'en', 'es', 'it', 'de']) {
    const p = path.join(RACINE, 'src', 'i18n', 'langues', l, 'parametres.js');
    const d = path.join(tmp, `${l}.mjs`); fs.writeFileSync(d, fs.readFileSync(p, 'utf8'));
    L[l] = (await import(pathToFileURL(d).href)).default;
  }
  void fr;

  // ── Les rangées d'aujourd'hui, lues dans le source (les deux blocs de groupes).
  const R = src.reg;
  const bloc = (debut, fin) => { const i = R.indexOf(debut), j = R.indexOf(fin, i + 1); return i >= 0 && j > i ? R.slice(i, j) : ''; };
  const bReg = bloc('const GROUPES_REGLAGES = [', 'const GROUPES_COMPTE');
  const bCompte = bloc('const GROUPES_COMPTE = ', '  const groupes = [');
  const ids = (b) => [...b.matchAll(/\{\s*id:\s*'([a-z0-9-]+)',\s*type:\s*'(panneau|nav|action|switch|el)'/g)].map((m) => m[1]);
  const rangees = [...new Set([...ids(bReg), ...ids(bCompte)])];
  dit(rangees.length >= 80, `les rangées de Paramètres sont lues dans le source (${rangees.length})`, rangees.length);
  const nommees = new Map();
  for (const c of C.CATEGORIES) for (const g of c.groupes) for (const id of g.items) nommees.set(id, (nommees.get(id) || 0) + 1);
  const absentes = rangees.filter((id) => !nommees.has(id));
  dit(!absentes.length, 'chaque rangée est NOMMÉE dans une catégorie', absentes);
  const doubles = [...nommees].filter(([, k]) => k > 1).map(([id]) => id);
  dit(!doubles.length, 'une rangée n’est nommée qu’une fois', doubles);
  const fantomes = [...nommees.keys()].filter((id) => !rangees.includes(id) && id !== 'abonnement-ouvrir');
  dit(!fantomes.length, 'chaque nom d’une catégorie désigne une rangée qui existe', fantomes);

  // Une icône par rangée DANS une catégorie (deux rangées voisines au même dessin se confondent).
  const icDe = {}; for (const m of (bReg + bCompte).matchAll(/\{\s*id:\s*'([a-z0-9-]+)',\s*type:\s*'[a-z]+',(?:\s*nu:\s*true,)?(?:\s*paresseux:\s*true,)?\s*ic:\s*'([a-zA-Z0-9]+)'/g)) icDe[m[1]] = m[2];
  const memeDessin = [];
  // Au bureau les dix catégories sont dépliées sur UNE page : l'icône est unique sur toutes les rangées.
  { const vus = {}; for (const c of C.CATEGORIES) for (const g of c.groupes) for (const id of g.items) { const x = icDe[id]; if (!x) continue; if (vus[x]) memeDessin.push(`${vus[x]} = ${id} (${x})`); else vus[x] = id; } }
  dit(Object.keys(icDe).length >= 70 && !memeDessin.length, `une icône par rangée sur toute la page (${Object.keys(icDe).length} rangées dessinées)`, memeDessin);

  // ── Le filet.
  const it = (id) => ({ id, type: 'panneau', lib: id });
  const groupesAvant = [
    { id: 'stock', titre: 'Stock et rangement', pied: 'Organisation', items: [it('numeros'), it('qui-numerote')] },
    { id: 'notifications', titre: 'Notifications', items: [it('push'), it('retours-notif')] },
    { id: 'nouveau-groupe', titre: 'Partenaires', items: [it('partenaires')] },
    { id: 'sortir', titre: null, pied: 'Vide ce navigateur', items: [it('deconnexion')] },
  ];
  const rang = C.rangerParCategorie(groupesAvant);
  const ou = (id) => { const c = rang.find((x) => x.ids.includes(id)); return c ? c.id : null; };
  dit(ou('qui-numerote') === 'stock' && ou('retours-notif') === 'notifications' && ou('partenaires') === 'aide', 'le filet : une rangée non nommée part dans la catégorie de son groupe d’avant (inconnu ⇒ Aide)', { quiNumerote: ou('qui-numerote'), retours: ou('retours-notif'), partenaires: ou('partenaires') });
  const toutes = rang.flatMap((c) => c.ids);
  dit(toutes.length === new Set(toutes).size && toutes.length === 6, 'le rangement rend chaque rangée UNE fois, aucune perdue', toutes);
  const stock = rang.find((c) => c.id === 'stock');
  dit(stock && stock.groupes[0].titreCle === 'reglages.groupe.stock' && stock.groupes[0].pied === 'Organisation', '« Organisation » reste sous « Stock et rangement » (son lien, le pied du groupe — CLAUDE.md §3)', stock && stock.groupes[0]);

  // ── Les liens profonds relevés dans le code.
  const relevés = new Set();
  const tout = [src.app, src.reg, src.aide, ...['src/accompagnement.js', 'src/LigneFraicheur.jsx', 'src/SanteDonnees.jsx', 'src/CarteDoubleVerif.jsx', 'src/ToutVaBien.jsx'].map((f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } })].join('\n');
  for (const m of tout.matchAll(/reglage=([a-z0-9-]+)/g)) relevés.add(m[1]);
  for (const m of tout.matchAll(/DEMANDE_REGLAGE_SOUS\.id\s*=\s*'([a-z0-9-]+)'/g)) relevés.add(m[1]);
  const aide = /export const REGLAGES_AIDE = \[([^\]]*)\]/.exec(src.aide);
  if (aide) for (const m of aide[1].matchAll(/'([a-z0-9-]+)'/g)) relevés.add(m[1]);
  for (const k of Object.keys(C.SECTIONS_ANCIENNES)) relevés.add(k);
  const connues = new Set(rangees);
  const casses = [...relevés].filter((id) => { const r = C.rangeeDuLien(id); return !connues.has(r) || !C.categorieDe(r); });
  dit(relevés.size >= 25 && !casses.length, `chaque lien profond (${relevés.size} relevés dans le code) mène à une rangée qui existe, dans une catégorie`, casses);
  const nonListes = [...relevés].filter((id) => !C.LIENS_PROFONDS.includes(id) && !C.SECTIONS_ANCIENNES[id] && !C.ALIAS_LIENS[id]);
  dit(!nonListes.length, 'la table des liens profonds (`LIENS_PROFONDS`) les nomme tous — le banc les ouvre un par un', nonListes);

  // ── Les catégories.
  dit(C.CATEGORIES.length === 10, 'dix catégories', C.CATEGORIES.map((c) => c.id));
  const ics = C.CATEGORIES.map((c) => c.ic);
  dit(new Set(ics).size === ics.length, 'une icône par catégorie', ics);
  const icones = (() => { const i = src.app.indexOf('const ICON_PATHS = {'); const j = src.app.indexOf('\n};', i); return src.app.slice(i, j); })();
  const sansDessin = ics.filter((x) => !new RegExp(`\\n  ${x}\\s*:`).test(icones));
  dit(!sansDessin.length, 'chaque icône de catégorie existe dans ICON_PATHS (sinon rien n’est dessiné)', sansDessin);
  const manques = [];
  for (const l of Object.keys(L)) for (const c of C.CATEGORIES) for (const k of [`parametres.cat.${c.id}`, `parametres.cat.${c.id}.desc`]) if (!L[l][k]) manques.push(`${l}:${k}`);
  dit(!manques.length, 'chaque catégorie a un titre et une phrase dans les cinq langues', manques);
  dit(C.CATEGORIES.filter((c) => c.expert).map((c) => c.id).join() === 'donnees' && C.CATEGORIES.find((c) => c.id === 'donnees').groupes[0].items[0] === 'securite', '« Sécurité des données » est l’expert, à part, son panneau en tête (tel quel, §5)');
  // Le panneau expert reste le même composant.
  dit(/\{ id:'securite', type:'panneau', ic:'shield', lib:tr\('parametres\.securiteDonnees\.lib'\)[^\n]*el:<SecuriteSetting\/> \}/.test(bReg), 'le panneau « Sécurité des données » est le même composant (`SecuriteSetting`), sous son propre nom');
  // ── La clé écrite deux fois.
  const doublesCle = [];
  for (const l of ['fr', 'en', 'es', 'it', 'de']) { const t = fs.readFileSync(path.join(RACINE, 'src', 'i18n', 'langues', `${l}.js`), 'utf8'); const k = (t.match(/"reglages\.securite\.lib"/g) || []).length; if (k > 1) doublesCle.push(`${l}:${k}`); }
  dit(!doublesCle.length, 'la clé « reglages.securite.lib » n’est écrite qu’une fois par langue (avant : deux, la seconde « Sécurité des comptes » gagnait et nommait aussi « Sécurité des données »)', doublesCle);
  // ── Détourage : pas dans Paramètres.
  dit(!/Photoroom|data-photoroom|detourage/i.test(src.cat) && !/<CartePhotoroom|data-photoroom-cle/.test(R), 'aucune carte Photoroom / Détourage dans Paramètres (CLAUDE.md §3)');
  // ── Plus d'onglets.
  dit(!/role="tablist"[^\n]*data-onglets-reglages/.test(R), 'plus d’onglets Réglages · Mon compte · Abonnement : un premier écran de catégories');

  // ── (16 nov.) « Mode sombre » retiré, « Apparence et langue » rangée.
  const catApp = C.CATEGORIES.find((c) => c.id === 'apparence');
  const nommeesApp = C.CATEGORIES.flatMap((c) => c.groupes.flatMap((g) => g.items));
  dit(!nommeesApp.includes('sombre') && !/\{ id:'sombre', type:'switch'/.test(R) && !/data-reglage-sombre/.test(R), 'plus d’interrupteur « Mode sombre » : le choix vit dans « Apparence » seule', nommeesApp.filter((x) => x === 'sombre'));
  const sansTitre = catApp ? catApp.groupes.filter((g) => !g.titre).map((g) => g.id) : ['(catégorie absente)'];
  dit(!sansTitre.length && catApp.groupes.find((g) => g.items.includes('apparence')).titre === 'parametres.g.apparence', '« Apparence et langue » : chaque groupe a un titre, « Apparence » en tête', sansTitre);
  const titresManquants = [];
  for (const l of ['fr', 'en', 'es', 'it', 'de']) {
    const t = fs.readFileSync(path.join(RACINE, 'src', 'i18n', 'langues', l, 'parametres.js'), 'utf8');
    for (const g of (catApp ? catApp.groupes : [])) if (g.titre && g.titre.startsWith('parametres.') && !t.includes(`"${g.titre}"`)) titresManquants.push(`${l}:${g.titre}`);
  }
  dit(!titresManquants.length, 'les titres des groupes d’« Apparence et langue » existent dans les cinq langues', titresManquants);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${ko ? '❌' : '✅'} audit-parametres : ${n - ko}/${n}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit-parametres a planté :', e && e.stack || e); process.exit(1); });
