// ════════════════════════════════════════════════════════════════════════════
//  LA REPUBLICATION TROUVE CHAQUE ÉLÉMENT PAR LA COUCHE COMMUNE (ext. 5.447, 24 nov. — `repubreperage`)
//
//  Julien, 23 nov. : « l'extension doit pouvoir tout faire sur Vinted, rends-la intelligente ». Avant la 5.447, la
//  republication cherchait chaque élément du formulaire d'UNE seule façon (un id ou un data-testid relevé le 20 nov.,
//  `querySelector` : le premier venu). Vinted change sa page (la cloche a déjà changé une fois sous VRM) : un champ
//  renommé arrêtait tout, et un bouton en double était cliqué au hasard — sur un brouillon, une mise en ligne, une
//  suppression. Ici, le VRAI vrm-trouver.js puis le VRAI vrm-formulaire.js (comme les injecte le service worker) sur une
//  FAUSSE page vinted.fr (jamais le vrai Vinted ; données inventées), en trois formes :
//    V1  la page relevée le 20 nov. (ids et data-testid connus) ;
//    V2  Vinted a changé ses ids / data-testid : seuls restent les libellés, les noms exacts, la place ;
//    V3  V2 + des pièges : recherche du site dans l'en-tête, champ « Prix » d'une fenêtre d'offre ouverte, les éléments
//        que VRM pose lui-même (voile de l'onglet de travail), un « Vendre » du pied de page, une option « -53 » visible
//        hors de la liste des marques.
//  On juge (données `data-attendu`, jamais un libellé) :
//    R0  la couche connaît les 20 éléments de la republication ; les irréversibles sont brouillon, ajouter, enregistrer,
//        supprimer, supprimerConfirmation ;
//    R1  V1 / V2 / V3 : chaque élément trouvé SEUL, le bon (jamais un piège) ;
//    R2  la paire complète par les étapes en V1 et en V3 : photos → brouillon → suppression → mise en ligne, la fiche juste ;
//    R3  deux « Sauvegarder le brouillon » (même un moins bien noté) ⇒ aucun brouillon ne part, « brouillon-ambigu » ;
//    R4  deux « Ajouter » ⇒ aucune mise en ligne ; deux « Supprimer » ⇒ aucune suppression ;
//    R5  la confirmation : [Annuler][Confirmer et supprimer] ⇒ celui-ci ; deux confirmations ⇒ rien ; nom non exact (même
//        avec un data-testid de confirmation) ⇒ rien ; « Annuler / Ne pas supprimer » jamais ;
//    R6  la mémoire (stratégie retenue) ne départage JAMAIS un geste irréversible (elle le fait pour « Vendre ») ;
//    R7  une option par l'identifiant de Vinted : la bonne de deux « Baskets test » ; identifiant absent et libellé en
//        double ⇒ rien n'est cliqué ; la marque prise DANS sa liste (pas le « -53 » d'ailleurs) ;
//    R8  un élément absent ⇒ l'étape s'arrête avec son nom, rien ne part.
//  `AUDIT_EXT=<dossier vinted-sync-extension>` : une autre copie (rouge attendu sur origin/main, 5.440).
//  `--prouve` : chaque garde réaffaiblie dans une copie ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const EXT = process.env.AUDIT_EXT ? path.resolve(process.env.AUDIT_EXT) : path.join(__dirname, '..', 'vinted-sync-extension');
const SILENCE = !!process.env.SILENCE;

// ── Les mutations : [nom, fichier, [[de, vers], …]] — chacune doit rendre l'audit rouge.
const MUTATIONS = [
  ['unique-retire', 'vrm-trouver.js', [["    if (def.unique && ext.length > 1) return", "    if (false && def.unique && ext.length > 1) return"]]],
  ['memoire-juge', 'vrm-trouver.js', [["    if (def.unique && ext.length > 1) return", "    if (false && def.unique && ext.length > 1) return"], ["if (c.prefere && !def.irreversible && vues.includes(c.prefere))", "if (c.prefere && vues.includes(c.prefere))"]]],
  ['fenetre-oubliee', 'vrm-trouver.js', [["supprimerConfirmation: irreversible(() => fenetreSuppression(),", "supprimerConfirmation: irreversible(() => document,"]]],
  ['nom-contient', 'vrm-trouver.js', [["    confirmer: /^(supprimer|confirmer|", "    confirmer: /(supprimer|confirmer|"]]],
  ['hors-formulaire-aveugle', 'vrm-trouver.js', [["  const horsFormulaire = (el) => { try { return", "  const horsFormulaire = (el) => { try { return false &&"]]],
  ['vrm-compte', 'vrm-trouver.js', [["      if (!el || !el.isConnected || deVrm(el)) return false;", "      if (!el || !el.isConnected) return false;"]]],
  ['sans-couche', 'vrm-formulaire.js', [["    if (!t || !Array.isArray(t.elements) || !t.elements.includes(nomT)) return attendreN(", "    if (true || !t || !Array.isArray(t.elements) || !t.elements.includes(nomT)) return attendreN("]]],
  ['libelle-premier', 'vrm-formulaire.js', [["      if (plusFin.length === 1) return plusFin[0].closest('[role=\"button\"],button,li,[data-testid]') || plusFin[0];", "      if (plusFin.length >= 1) return plusFin[0].closest('[role=\"button\"],button,li,[data-testid]') || plusFin[0];"]]],
  ['option-partout', 'vrm-formulaire.js', [["option(listeDe(s.el) || document, d.id, d.nom)", "option(document, d.id, d.nom)"]]],
];
if (process.argv.includes('--prouve')) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repub-reperage-'));
  let bien = true;
  for (const [nom, fichier, paires] of MUTATIONS) {
    const d = path.join(tmp, nom); fs.mkdirSync(d);
    for (const f of ['vrm-trouver.js', 'vrm-formulaire.js']) fs.copyFileSync(path.join(EXT, f), path.join(d, f));
    let c = fs.readFileSync(path.join(d, fichier), 'utf8'), trouve = true;
    for (const [de, vers] of paires) { if (!c.includes(de)) { trouve = false; break; } c = c.split(de).join(vers); }
    if (!trouve) { console.log(`❌ mutation ${nom} : motif introuvable`); bien = false; continue; }
    fs.writeFileSync(path.join(d, fichier), c);
    const r = cp.spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_EXT: d, SILENCE: '1' }, encoding: 'utf8', timeout: 900000 });
    const rouge = r.status === 1 && /❌/.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation ${nom} ⇒ ${rouge ? 'rouge' : 'PAS rouge'}${rouge ? '  (' + ((r.stdout || '').match(/❌ (R\d+[a-z]?\S*)/g) || []).slice(0, 4).join(' ') + ')' : ''}`);
    if (!rouge) bien = false;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(bien ? 0 : 1);
}

let pw = null; try { pw = require('playwright'); } catch (_) { try { pw = require(path.join(__dirname, '..', 'node_modules', 'playwright')); } catch (_) { pw = null; } }
let ok = 0, ko = 0;
const lignes = [];
const dit = (c, m, d) => { if (c) { ok++; lignes.push('✅ ' + m); } else { ko++; lignes.push('❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };
const TROUVER = fs.readFileSync(path.join(EXT, 'vrm-trouver.js'), 'utf8');
const FORM = fs.readFileSync(path.join(EXT, 'vrm-formulaire.js'), 'utf8');

// ── La fausse page vinted.fr : un document qui sait être « nouvelle annonce », « annonce », « brouillon ».
//  cfg : v (1|2|3), deuxBrouillons, deuxAjouter, deuxSupprimer, dialogue (libellés + data-testid), sansBrouillon,
//  masque (l'annonce est masquée : « Afficher »), boutonEdit (« Ajouter » / « Enregistrer »).
function PAGE(cfg) {
  const v = cfg.v, v1 = v === 1, pieges = v === 3;
  const A = (a1, a2) => (v1 ? a1 : a2);
  const lab = (txt, id, champ) => (v1 ? `<label>${txt}${champ}</label>` : `<label for="${id}">${txt}</label>${champ}`);
  const dialogue = JSON.stringify(cfg.dialogue || [['Annuler', 'item-delete-modal-cancel'], ['Confirmer et supprimer', 'item-delete-modal-confirm-button']]);
  const formulaire = [
    `<input type="file" multiple accept="image/*" ${A('data-testid="add-photos-input"', 'style="display:none" name="files"')} data-attendu="photos">`,
    v1 ? '' : '<button type="button">Ajoute des photos</button>',
    lab('Titre', 'f1', `<input ${A('id="title" data-testid="title--input"', 'id="f1"')} data-champ="title" data-attendu="titre">`),
    lab('Décris ton article', 'f2', `<textarea ${A('id="description" data-testid="description--input"', 'id="f2"')} data-champ="description" data-attendu="description"></textarea>`),
    lab('Catégorie', 'f3', `<input ${A('id="category" data-testid="catalog-select-dropdown-input"', 'id="f3" aria-haspopup="listbox"')} readonly data-dd="dd-cat" data-attendu="categorie">`),
    `<div class="dd" id="dd-cat" ${A('data-testid="catalog-select-dropdown-content"', 'role="listbox"')}><input ${A('id="catalog-search-input"', 'type="search" placeholder="Rechercher une catégorie"')} data-res="cat" data-attendu="categorieRecherche"><div class="res"></div></div>`,
    lab('Marque', 'f4', `<input ${A('id="brand"', 'id="f4" aria-haspopup="listbox"')} readonly data-dd="dd-brand" data-attendu="marque">`),
    `<div class="dd" id="dd-brand" ${A('', 'role="listbox"')}><input ${A('id="brand-search-input"', 'type="search" placeholder="Rechercher une marque"')} data-res="brand" data-attendu="marqueRecherche"><div class="res"></div></div>`,
    lab('Taille', 'f5', `<input ${A('id="size" data-testid="category-size-single-grid-input"', 'id="f5" aria-haspopup="listbox"')} readonly data-dd="dd-size" data-attendu="taille">`),
    `<div class="dd" id="dd-size"><div data-testid="size-group-7-grid-option-55" data-k="size_id" data-id="55">41</div><div data-testid="size-group-7-grid-option-56" data-k="size_id" data-id="56">42</div></div>`,
    lab('Couleur', 'f6', `<input ${A('id="color" data-testid="color-select-dropdown-input"', 'id="f6" aria-haspopup="listbox"')} readonly data-dd="dd-color" data-attendu="couleur">`),
    `<div class="dd" id="dd-color"><div data-testid="filter-grid-option-1" data-k="color" data-id="1">Noir</div><div data-testid="filter-grid-option-3" data-k="color" data-id="3">Gris</div></div>`,
    `<label><input type="radio" name="p" id="package_type_selector_1" data-k="package_size_id" data-id="1" data-attendu="colis">Petit</label><label><input type="radio" name="p" id="package_type_selector_2" data-k="package_size_id" data-id="2">Moyen</label>`,
    lab('État', 'f7', `<input ${A('id="condition" data-testid="category-condition-single-list-input"', 'id="f7" aria-haspopup="listbox"')} readonly data-dd="dd-cond" data-attendu="etat">`),
    `<div class="dd" id="dd-cond"><div id="condition-2" data-k="status_id" data-id="2">Très bon état</div><div id="condition-3" data-k="status_id" data-id="3">Bon état</div></div>`,
    lab('Prix', 'f8', `<input ${A('id="price" data-testid="price-input--input"', 'id="f8"')} data-champ="price" data-attendu="prix">`),
    cfg.sansBrouillon ? '' : `<button type="button" ${A('data-testid="upload-form-save-draft-button"', '')} data-geste="brouillon" data-attendu="brouillon">Sauvegarder le brouillon</button>`,
    cfg.deuxBrouillons ? '<button type="button" data-geste="brouillon">Sauvegarder le brouillon</button>' : '',
    `<button type="button" ${A('data-testid="upload-form-save-button"', '')} data-geste="ajouter-neuf">Ajouter</button>`,
    pieges ? '<div role="dialog" aria-modal="true" class="offre"><b>Faire une offre</b><label>Prix<input name="price" data-piege="prix"></label><button type="button">Proposer</button></div>' : '',
    pieges ? '<div id="vrm-travail"><label>Titre<input name="title" data-piege="titre"></label><input type="file" multiple accept="image/*" data-testid="add-photos-input" data-piege="photos"><button type="button" data-testid="upload-form-save-draft-button" data-geste="brouillon" data-piege="brouillon">Sauvegarder le brouillon</button></div>' : '',
    pieges ? '<div class="ailleurs"><div data-testid="size-group-9-grid-option-53" data-piege="option53">Taille 53</div></div>' : '',
  ].join('\n');
  const enTete = `<header><b>Vinted (audit)</b>${pieges ? '<label>Titre<input type="search" name="search_text" placeholder="Rechercher des articles" data-piege="recherche"></label>' : ''}<a href="/items/new" ${A('data-testid="header-upload-item-button"', '')} data-geste="vendre" data-attendu="vendre">Vends tes articles</a></header>`;
  const pied = pieges ? '<footer><a href="/items/new" data-piege="vendre">Vendre</a></footer>' : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vinted (audit)</title>
<style>body{margin:0;font:15px/1.4 system-ui,sans-serif}header{height:56px;display:flex;align-items:center;gap:16px;padding:0 16px;border-bottom:1px solid #ddd}
main{padding:16px;display:grid;gap:8px;max-width:640px}label{display:grid;gap:4px}.dd{border:1px solid #ccc;padding:8px;display:none}.dd.on{display:block}
.supp{position:fixed;inset:30% 20%;background:#fff;border:1px solid #888;padding:16px}#vrm-travail{border:2px dashed #999;padding:8px}</style></head><body>
${enTete}<main id="m"></main>${pied}
<script>
(() => {
  const CFG = ${JSON.stringify({ deuxAjouter: !!cfg.deuxAjouter, deuxSupprimer: !!cfg.deuxSupprimer, masque: !!cfg.masque, boutonEdit: cfg.boutonEdit || 'Ajouter', v1, lignesCat: cfg.lignesCat || [[1234, 'Baskets test'], [1235, 'Baskets test']] })};
  const DIALOGUE = ${dialogue};
  const R = window.__R = [], clics = window.__clics = [], etat = window.__etat = { color: [] };
  const post = (u, corps) => { R.push(u); return fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: corps == null ? null : JSON.stringify(corps) }).then((r) => r.json()); };
  const m = document.getElementById('m');
  const vers = (p) => { history.pushState({}, '', p); m.innerHTML = '<p>Ton dressing</p>'; };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-dd],[data-k],[data-geste],[data-row]');
    if (t && t.dataset.piege) clics.push('piege:' + t.dataset.piege);
    if (!t) return;
    if (t.dataset.dd) { document.querySelectorAll('.dd').forEach((d) => d.classList.toggle('on', d.id === t.dataset.dd)); return; }
    if (t.dataset.row) { const [k, id] = t.dataset.row.split(':'); etat[k] = Number(id); clics.push('row:' + t.dataset.row); return; }
    if (t.dataset.k) { if (t.dataset.k === 'color') etat.color.push(Number(t.dataset.id)); else etat[t.dataset.k] = Number(t.dataset.id); clics.push(t.dataset.k + ':' + t.dataset.id); return; }
    const g = t.dataset.geste;
    if (g === 'vendre') { e.preventDefault(); window.__aller('/items/new'); return; }
    if (g === 'brouillon') { clics.push('brouillon'); window.__brouillon = Object.assign({}, etat); post('/api/v2/item_upload/drafts', { draft: window.__brouillon }).then(() => vers('/member/111')); return; }
    if (g === 'ajouter') { clics.push('ajouter'); post('/api/v2/item_upload/drafts/' + t.dataset.id + '/completion', { draft: { id: Number(t.dataset.id) } }).then(() => vers('/member/111')); return; }
    if (g === 'enregistrer') { clics.push('enregistrer'); return; }
    if (g === 'supprimer') {
      clics.push('supprimer');
      const d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.className = 'supp';
      d.innerHTML = '<p>Supprimer cet article ?</p>' + DIALOGUE.map(([n, tid], i) => '<button type="button" data-b="' + i + '"' + (tid ? ' data-testid="' + tid + '"' : '') + (/^(Annuler|Ne pas supprimer)$/.test(n) ? '' : ' data-attendu="supprimerConfirmation"') + '>' + n + '</button>').join('');
      document.body.appendChild(d);
      d.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { clics.push('conf:' + b.textContent); d.remove(); if (!/^(Annuler|Ne pas supprimer)$/.test(b.textContent)) post('/api/v2/items/' + t.dataset.id + '/delete', null).then(() => vers('/member/111')); }));
      return;
    }
    if (g === 'masquer') { clics.push('masquer'); return; }
  }, true);
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.champ) etat[t.dataset.champ] = t.value;
    if (t.dataset && t.dataset.res) {
      const res = t.parentElement.querySelector('.res');
      if (t.dataset.res === 'cat') res.innerHTML = /bask/i.test(t.value) ? CFG.lignesCat.map(([id, n]) => '<div ' + (CFG.v1 ? 'data-testid="catalog-select-dropdown-row-' + id + '"' : 'data-testid="catalog-row-' + id + '"') + ' data-row="catalog_id:' + id + '">' + n + '</div>').join('') : '';
      else res.innerHTML = /marque/i.test(t.value) ? '<div data-testid="brand-row-53" data-row="brand_id:53">Marque test</div>' : '';
    }
  }, true);
  document.addEventListener('change', (e) => { const t = e.target; if (t.type === 'file') [...t.files].forEach((f) => post('/api/v2/photos', { nom: f.name })); }, true);
  function nouvelle() { m.innerHTML = ${JSON.stringify(formulaire)}; }
  function annonce(id) {
    const b = (attr, n) => '<button type="button" ' + attr + ' data-id="' + id + '">' + n + '</button>';
    m.innerHTML = '<h1>Annonce ' + id + '</h1>'
      + b((CFG.v1 ? 'data-testid="item-delete-button" ' : '') + 'data-geste="supprimer" data-attendu="supprimer"', 'Supprimer')
      + (CFG.deuxSupprimer ? b('data-geste="supprimer"', 'Supprimer') : '')
      + b('data-geste="modifier"', 'Modifier') + b('data-geste="reserver"', 'Marquer comme réservé')
      + (CFG.masque ? b((CFG.v1 ? 'data-testid="item-show-button" ' : '') + 'data-geste="masquer" data-attendu="afficher"', 'Afficher') : b((CFG.v1 ? 'data-testid="item-hide-button" ' : '') + 'data-geste="masquer" data-attendu="masquer"', 'Masquer'));
  }
  function edition(id) {
    const geste = CFG.boutonEdit === 'Enregistrer' ? 'enregistrer' : 'ajouter';
    const bouton = (en) => '<button type="button" ' + (CFG.v1 && en ? 'data-testid="upload-form-save-button" ' : '') + 'data-geste="' + geste + '" data-id="' + id + '"' + (en ? ' data-attendu="ajouter enregistrer"' : '') + '>' + CFG.boutonEdit + '</button>';
    m.innerHTML = (CFG.v1 ? '<label>Titre<input id="title" data-attendu="titre" value="Basket test 42"></label><label>Prix<input id="price" data-attendu="prix" value="54"></label>'
      : '<label for="g1">Titre</label><input id="g1" data-attendu="titre" value="Basket test 42"><label for="g2">Prix</label><input id="g2" data-attendu="prix" value="54">')
      + bouton(true) + (CFG.deuxAjouter ? bouton(false) : '');
  }
  window.__aller = (p) => { history.pushState({}, '', p); const a = /^\\/items\\/(\\d+)$/.exec(p), b = /^\\/items\\/(\\d+)\\/edit$/.exec(p); if (p === '/items/new') nouvelle(); else if (b) edition(b[1]); else if (a) annonce(a[1]); else m.innerHTML = ''; };
  window.__ouvrir = (dd) => document.querySelectorAll('.dd').forEach((d) => d.classList.toggle('on', d.id === dd));
  const p0 = location.pathname; if (p0 !== '/') window.__aller(p0);
})();
</script></body></html>`;
}

const PHOTOS = [1, 2].map((i) => ({ b64: Buffer.from('JPEGAUDIT' + i).toString('base64'), type: 'image/jpeg', nom: `photo-${i}.jpg` }));
const CHAMPS = [['categorie', { id: 1234, nom: 'Baskets test', recherche: 'Baskets test' }], ['titre', { valeur: 'Basket test 42' }], ['description', { valeur: 'Très bon état' }], ['marque', { id: 53, nom: 'Marque test' }], ['taille', { id: 56 }], ['couleurs', { ids: [1] }], ['colis', { id: 1 }], ['etat', { id: 2 }], ['prix', { valeur: '54' }]];

async function ouvrir(b, cfg, chemin) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  let id = 800;
  await ctx.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== 'www.vinted.fr') return r.fulfill({ status: 404, body: '' });
    if (u.pathname === '/api/v2/photos') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: ++id }) });
    if (u.pathname === '/api/v2/item_upload/drafts') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ draft: { id: 88001 } }) });
    if (/\/delete$/.test(u.pathname) || /\/completion$/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":0}' });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(cfg) });
  });
  await pg.goto('https://www.vinted.fr' + (chemin || '/items/new'));
  await pg.addScriptTag({ content: TROUVER });
  await pg.addScriptTag({ content: FORM });
  return { ctx, pg, errs };
}
// Une étape, comme le service worker : la couche puis le formulaire (réinjectés : la page garde la même version).
async function etape(pg, e, d) {
  await pg.addScriptTag({ content: TROUVER }); await pg.addScriptTag({ content: FORM });
  return (await pg.evaluate(([e2, d2]) => globalThis.__vrmFormulaire(e2, d2), [e, d || {}])) || {};
}
// Repérer un élément par la couche seule ; rend ce que dit `data-attendu` / `data-piege` du gagnant.
async function reperer(pg, nom, ctx) {
  return pg.evaluate(([n, c]) => {
    const T = globalThis.__vrmTrouver; if (!T || !T.elements.includes(n)) return { inconnu: true };
    const r = T.trouver(n, c || {});
    return { attendu: r.el ? (r.el.getAttribute('data-attendu') || '') : '', piege: r.el ? (r.el.getAttribute('data-piege') || '') : '', ambigu: !!r.ambigu, s: r.strategie || '', tag: r.el ? r.el.tagName : '' };
  }, [nom, ctx || {}]);
}
const bon = (x, nom) => !!x && !x.inconnu && !x.piege && String(x.attendu || '').split(' ').includes(nom);
const LISTE_FORM = ['vendre', 'photos', 'titre', 'description', 'prix', 'categorie', 'marque', 'taille', 'couleur', 'etat', 'brouillon'];
const LES_20 = ['vendre', 'titre', 'description', 'prix', 'photos', 'categorie', 'categorieRecherche', 'marque', 'marqueRecherche', 'taille', 'couleur', 'etat', 'colis', 'brouillon', 'ajouter', 'supprimer', 'supprimerConfirmation', 'enregistrer', 'masquer', 'afficher'];

async function repérage(b, v) {
  const out = {};
  { const { ctx, pg } = await ouvrir(b, { v }, '/items/new');
    for (const n of LISTE_FORM) out[n] = await reperer(pg, n);
    out.colis = await reperer(pg, 'colis', { id: '1' });
    await pg.evaluate(() => window.__ouvrir('dd-cat')); out.categorieRecherche = await reperer(pg, 'categorieRecherche');
    await pg.evaluate(() => window.__ouvrir('dd-brand')); out.marqueRecherche = await reperer(pg, 'marqueRecherche');
    await ctx.close(); }
  { const { ctx, pg } = await ouvrir(b, { v }, '/items/88001/edit');
    out.ajouter = await reperer(pg, 'ajouter'); await ctx.close(); }
  { const { ctx, pg } = await ouvrir(b, { v, boutonEdit: 'Enregistrer' }, '/items/9101/edit');
    out.enregistrer = await reperer(pg, 'enregistrer'); await ctx.close(); }
  { const { ctx, pg } = await ouvrir(b, { v }, '/items/9101');
    out.supprimer = await reperer(pg, 'supprimer'); out.masquer = await reperer(pg, 'masquer');
    out.supprimerConfirmationSansFenetre = await reperer(pg, 'supprimerConfirmation');
    await pg.evaluate(() => document.querySelector('[data-geste="supprimer"]').click());
    out.supprimerConfirmation = await reperer(pg, 'supprimerConfirmation'); await ctx.close(); }
  { const { ctx, pg } = await ouvrir(b, { v, masque: true }, '/items/9101');
    out.afficher = await reperer(pg, 'afficher'); await ctx.close(); }
  return out;
}

async function pairePleine(b, v) {
  const { ctx, pg, errs } = await ouvrir(b, { v }, '/member/111');
  await pg.evaluate(() => window.__aller('/member/111'));
  const r = { ouvrir: await etape(pg, 'ouvrirVente') };
  r.photos = await etape(pg, 'photos', { photos: PHOTOS });
  r.champs = [];
  for (const [quoi, d] of CHAMPS) r.champs.push([quoi, await etape(pg, 'champ', Object.assign({ quoi }, d))]);
  r.brouillon = await etape(pg, 'brouillon', { cle: 'b9101' });
  await pg.waitForTimeout(150);
  r.B = await pg.evaluate(() => window.__brouillon || null);
  await pg.evaluate(() => window.__aller('/items/9101'));
  r.supprimer = await etape(pg, 'supprimer', { id: '9101', cle: 's9101' });
  await pg.evaluate(() => window.__aller('/items/88001/edit'));
  r.pret = await etape(pg, 'formulairePret');
  r.publier = await etape(pg, 'publier', { draftId: '88001', cle: 'p88001' });
  r.R = await pg.evaluate(() => window.__R.slice()); r.clics = await pg.evaluate(() => window.__clics.slice());
  r.errs = errs;
  await ctx.close();
  return r;
}
const seqDe = (R) => R.map((u) => /photos$/.test(u) ? 'P' : /drafts$/.test(u) ? 'B' : /delete$/.test(u) ? 'S' : /completion$/.test(u) ? 'M' : '?').join('');

async function cas(b, cfg, chemin, jeu) {
  const { ctx, pg } = await ouvrir(b, cfg, chemin);
  try { return await jeu(pg); } finally { await ctx.close(); }
}

(async () => {
  if (!pw) { dit(false, 'Chromium (playwright) joignable', 'pas de playwright : rien n’est conclu'); }
  else {
    const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    try {
      // R0 — la couche connaît les éléments de la republication, et lesquels sont irréversibles.
      const r0 = await cas(b, { v: 1 }, '/items/new', (pg) => pg.evaluate(() => { const T = globalThis.__vrmTrouver; return T ? { el: T.elements, irr: T.irreversibles || null } : null; }));
      const manquants = LES_20.filter((n) => !(r0 && r0.el.includes(n)));
      dit(!manquants.length, 'R0 — la couche commune connaît les 20 éléments de la republication', 'absents : ' + manquants.join(', '));
      dit(r0 && Array.isArray(r0.irr) && JSON.stringify([...r0.irr].sort()) === JSON.stringify(['ajouter', 'brouillon', 'enregistrer', 'supprimer', 'supprimerConfirmation']), 'R0b — irréversibles (un seul gagnant, mémoire sans voix) : brouillon, ajouter, enregistrer, supprimer, supprimerConfirmation', JSON.stringify(r0 && r0.irr));

      // R1 — chaque élément trouvé seul, le bon, en V1 / V2 / V3 (en parallèle).
      const [rv1, rv2, rv3] = await Promise.all([1, 2, 3].map((v) => repérage(b, v)));
      for (const [v, rv] of [[1, rv1], [2, rv2], [3, rv3]]) {
        const faux = LES_20.filter((n) => !bon(rv[n], n));
        dit(!faux.length, `R1 V${v} — ${v === 1 ? 'page relevée' : v === 2 ? 'ids / data-testid changés' : 'changée + pièges'} : les 20 éléments trouvés, chacun seul et le bon`, faux.map((n) => n + '=' + JSON.stringify(rv[n])).join(' | '));
        dit(rv.supprimerConfirmationSansFenetre && !rv.supprimerConfirmationSansFenetre.attendu && !rv.supprimerConfirmationSansFenetre.piege, `R1 V${v}b — sans fenêtre ouverte, aucune « confirmation » (le « Supprimer » de la page n’en est pas une)`, JSON.stringify(rv.supprimerConfirmationSansFenetre));
      }

      // R2 — la paire complète par les étapes, sur la page relevée ET sur la page changée avec ses pièges.
      const [p1, p3] = await Promise.all([pairePleine(b, 1), pairePleine(b, 3)]);
      for (const [v, p] of [[1, p1], [3, p3]]) {
        const seq = seqDe(p.R);
        const tousOk = p.ouvrir.ok && p.photos.ok && p.champs.every(([, x]) => x.ok) && p.brouillon.ok && p.supprimer.ok && p.pret.ok && p.publier.ok;
        dit(tousOk && seq === 'PPBSM', `R2 V${v} — la paire par les étapes : 2 photos → brouillon → suppression → mise en ligne`, seq + ' ' + JSON.stringify({ o: p.ouvrir, ph: p.photos.code || p.photos.ok, ch: p.champs.filter(([, x]) => !x.ok), br: p.brouillon.manque || p.brouillon.ok, su: p.supprimer.manque || p.supprimer.ok, pr: p.pret.manque || p.pret.ok, pu: p.publier.manque || p.publier.ok }));
        const B = p.B || {};
        dit(B.title === 'Basket test 42' && B.price === '54' && B.catalog_id === 1234 && B.brand_id === 53 && B.size_id === 56 && JSON.stringify(B.color) === '[1]' && B.package_size_id === 1 && B.status_id === 2, `R2 V${v}b — le brouillon porte la fiche (catégorie 1234 de deux « Baskets test », marque 53, taille 56, couleur 1, colis 1, état 2)`, JSON.stringify(B));
        dit(!p.clics.some((c) => /^piege:/.test(c)) && !p.errs.length, `R2 V${v}c — aucun piège touché (VRM, recherche du site, fenêtre d’offre, « -53 » ailleurs), aucune erreur de page`, JSON.stringify({ c: p.clics.filter((c) => /piege/.test(c)), e: p.errs.slice(0, 2) }));
      }

      // R3–R8 : les cas qui doivent s'arrêter (en parallèle ; chacun attend son délai avant de dire « rien »).
      const jeux = await Promise.all([
        // R3 deux brouillons : un au data-testid + nom, un au nom seul (moins bien noté) — aucun ne part.
        cas(b, { v: 1, deuxBrouillons: true }, '/items/new', async (pg) => ({ r: await etape(pg, 'brouillon', { cle: 'x' }), R: await pg.evaluate(() => window.__R.slice()) })),
        // R4 deux « Ajouter » sur le brouillon.
        cas(b, { v: 1, deuxAjouter: true }, '/items/88001/edit', async (pg) => ({ r: await etape(pg, 'publier', { draftId: '88001', cle: 'p' }), R: await pg.evaluate(() => window.__R.slice()) })),
        // R4b deux « Supprimer » sur l'annonce.
        cas(b, { v: 1, deuxSupprimer: true }, '/items/9101', async (pg) => ({ r: await etape(pg, 'supprimer', { id: '9101', cle: 's' }), R: await pg.evaluate(() => window.__R.slice()), c: await pg.evaluate(() => window.__clics.slice()) })),
        // R5 la confirmation, quatre fenêtres.
        ...[
          [['Annuler', 'item-delete-modal-cancel'], ['Confirmer et supprimer', 'item-delete-modal-confirm-button']],
          [['Ne pas supprimer', ''], ['Supprimer', '']],
          [['Supprimer', ''], ['Confirmer', '']],
          [['Supprimer l’annonce et mes données ?', 'item-delete-modal-confirm-button']],
        ].map((dl) => cas(b, { v: 1, dialogue: dl }, '/items/9101', async (pg) => ({ r: await etape(pg, 'supprimer', { id: '9101', cle: 's' }), R: await pg.evaluate(() => window.__R.slice()), c: await pg.evaluate(() => window.__clics.slice()) }))),
        // R6 la mémoire : deux brouillons au même score (un par data-testid, l'autre par son nom) + mémoire « testid ».
        cas(b, { v: 1 }, '/items/new', (pg) => pg.evaluate(() => {
          const f = document.querySelector('[data-geste="brouillon"]'); f.textContent = 'Brouillon';
          // f : data-testid relevé (5) + indice (1) ; n : nom exact (5) + indice (1) — le même score, deux stratégies.
          const n = document.createElement('button'); n.type = 'button'; n.textContent = 'Sauvegarder le brouillon'; n.setAttribute('data-testid', 'save-draft-secondaire'); f.after(n);
          // « Vendre » : l'un par son lien + indice + en-tête (7), l'autre par son nom + indice + en-tête (7).
          const v0 = document.querySelector('[data-geste="vendre"]'); v0.setAttribute('data-testid', 'upload-item-a'); v0.textContent = 'Publier un article';
          const v2 = document.createElement('a'); v2.href = '/vendre-ici'; v2.textContent = 'Vendre'; v2.setAttribute('data-testid', 'upload-item-b'); document.querySelector('header').appendChild(v2);
          const T = globalThis.__vrmTrouver;
          const a = T.trouver('brouillon', { prefere: 'testid' }), c = T.trouver('brouillon', { prefere: 'nom' });
          const v = T.trouver('vendre', {}), vm = T.trouver('vendre', { prefere: 'lien' });
          return { a: !!a.el, aAmb: !!a.ambigu, c: !!c.el, cAmb: !!c.ambigu, vAmb: !!v.ambigu, vm: !!vm.el };
        })),
        // R7 options : identifiant 1235 parmi deux « Baskets test » ; identifiant absent + libellé en double.
        cas(b, { v: 1 }, '/items/new', async (pg) => ({ r: await etape(pg, 'champ', { quoi: 'categorie', id: 1235, nom: 'Baskets test', recherche: 'Baskets test' }), e: await pg.evaluate(() => Object.assign({}, window.__etat)) })),
        cas(b, { v: 1 }, '/items/new', async (pg) => ({ r: await etape(pg, 'champ', { quoi: 'categorie', id: 9999, nom: 'Baskets test', recherche: 'Baskets test' }), e: await pg.evaluate(() => Object.assign({}, window.__etat)), c: await pg.evaluate(() => window.__clics.slice()) })),
        // R7c la marque prise dans sa liste, pas le « -53 » visible ailleurs (V3).
        cas(b, { v: 3 }, '/items/new', async (pg) => ({ r: await etape(pg, 'champ', { quoi: 'marque', id: 53, nom: 'Marque test' }), e: await pg.evaluate(() => Object.assign({}, window.__etat)), c: await pg.evaluate(() => window.__clics.slice()) })),
        // R8 plus de bouton brouillon : arrêt nommé, rien ne part.
        cas(b, { v: 2, sansBrouillon: true }, '/items/new', async (pg) => ({ r: await etape(pg, 'brouillon', { cle: 'x' }), R: await pg.evaluate(() => window.__R.slice()) })),
      ]);
      const [r3, r4, r4b, c1, c2, c3, c4, r6, r7a, r7b, r7c, r8] = jeux;
      dit(r3.r.ok === false && r3.r.manque === 'brouillon-ambigu' && !r3.R.length, 'R3 — deux « Sauvegarder le brouillon » (l’un moins bien noté) ⇒ aucun brouillon ne part, « brouillon-ambigu »', JSON.stringify(r3));
      dit(r4.r.ok === false && r4.r.manque === 'ajouter-ambigu' && !r4.R.length, 'R4 — deux « Ajouter » sur le brouillon ⇒ aucune mise en ligne, « ajouter-ambigu »', JSON.stringify(r4));
      dit(r4b.r.ok === false && r4b.r.manque === 'supprimer-ambigu' && !r4b.R.length && !r4b.c.length, 'R4b — deux « Supprimer » sur l’annonce ⇒ rien n’est touché, « supprimer-ambigu »', JSON.stringify(r4b));
      dit(c1.r.ok === true && c1.c.join() === 'supprimer,conf:Confirmer et supprimer' && seqDe(c1.R) === 'S', 'R5a — [Annuler][Confirmer et supprimer] ⇒ « Confirmer et supprimer », la suppression part', JSON.stringify(c1));
      dit(c2.c.join() === 'supprimer,conf:Supprimer' && seqDe(c2.R) === 'S', 'R5b — [Ne pas supprimer][Supprimer] ⇒ « Supprimer », jamais « Ne pas supprimer »', JSON.stringify(c2));
      dit(c3.r.ok === false && c3.r.manque === 'supprimer-confirmation-ambigue' && !c3.R.length && c3.c.join() === 'supprimer', 'R5c — deux confirmations ⇒ aucun clic dans la fenêtre, rien n’est supprimé', JSON.stringify(c3));
      dit(c4.r.ok === false && !c4.R.length && c4.c.join() === 'supprimer', 'R5d — un seul bouton au nom NON exact (même avec un data-testid de confirmation) ⇒ aucun clic, rien n’est supprimé', JSON.stringify(c4));
      dit(![c1, c2, c3, c4].some((x) => x.c.some((k) => /conf:(Annuler|Ne pas supprimer)/.test(k))), 'R5e — « Annuler » / « Ne pas supprimer » jamais cliqués');
      dit(r6.aAmb && r6.cAmb && !r6.a && !r6.c, 'R6 — la mémoire ne départage JAMAIS un geste irréversible (deux brouillons au même score ⇒ ambigu, quelle que soit la stratégie retenue)', JSON.stringify(r6));
      dit(r6.vAmb && r6.vm, 'R6b — … alors qu’elle départage « Vendre » (geste sans écriture), comme pour la cloche', JSON.stringify(r6));
      dit(r7a.r.ok === true && r7a.e.catalog_id === 1235, 'R7a — l’option par l’identifiant de Vinted : la catégorie 1235 de deux « Baskets test »', JSON.stringify(r7a));
      dit(r7b.r.ok === false && r7b.e.catalog_id == null && !r7b.c.some((k) => /^row:/.test(k)), 'R7b — identifiant absent et libellé en double ⇒ rien n’est cliqué (jamais par ressemblance)', JSON.stringify(r7b));
      dit(r7c.r.ok === true && r7c.e.brand_id === 53 && !r7c.c.includes('piege:option53'), 'R7c — la marque 53 prise DANS sa liste, jamais le « -53 » visible ailleurs', JSON.stringify(r7c));
      dit(r8.r.ok === false && r8.r.code === 'selecteur' && r8.r.manque === 'brouillon' && !r8.R.length, 'R8 — plus de bouton brouillon ⇒ arrêt nommé (« brouillon »), rien ne part', JSON.stringify(r8));
    } finally { await b.close(); }
  }
  if (!SILENCE) for (const l of lignes) console.log(l); else for (const l of lignes.filter((x) => x.startsWith('❌'))) console.log(l.slice(0, 160));
  console.log(`\n${ko ? '❌' : '✅'} audit repub-reperage : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
