// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LES NOUVELLES ANNONCES SANS N° » (15 nov.) — src/numerosNouvelles.js
//  Julien : un article publié depuis l'app Vinted du téléphone, sans l'extension,
//  doit recevoir son N° à la lecture suivante (quand VRM numérote) et le DIRE ;
//  sinon (il numérote lui-même) l'app lui DEMANDE un N° pour chaque nouvel article.
//
//  1. Le bloc <numerotation-passage> d'App.jsx, EXÉCUTÉ tel quel (vm), avec les
//     vraies règles (src/repriseNumero.js, src/numeroEcrit.js, cartonsNumeros,
//     src/numerosNouvelles.js) et les vraies fonctions d'App.jsx (`prochainLibre`,
//     `cleNum`, `entreePool`, `photoKey`, `ficheEcrite`) :
//       · lecture COMPLÈTE, annonce neuve sans N° ⇒ N° = plus haut + 1, marquée
//         « à écrire », dite ; un second passage ne change rien (une fois) ;
//       · lecture PARTIELLE, compte qui n'a pas répondu ⇒ rien ;
//       · annonce republiée (par identité) ⇒ le N° de l'ancienne, rien de « neuf » ;
//       · N° écrit en fin de description (« je numérote ») ⇒ pris tel quel ;
//       · « je numérote moi-même », rien d'écrit ⇒ rien attribué, la DEMANDE existe ;
//       · 50 annonces identiques (même titre, même marque, même taille) à côté d'une
//         fiche N°10 au même titre ⇒ 11…60, aucune ne reçoit 10 (jamais par ressemblance) ;
//       · un sac, un manuel, une paire : la MÊME règle (aucune catégorie).
//  2. Deux appareils qui donnent chacun le N°216 à deux annonces différentes : la
//     fusion du nuage (src/fusionNuage.js) REFUSE — pas deux articles sous un N°.
//  3. Les règles pures : liste « à écrire », « C'est écrit », la proposition (rien réservé).
//  4. App.jsx / Réglages / extension (commentaires retirés) : la notification, Ma journée
//     (les deux lignes), la feuille, le choix « Qui numérote ? », la carte de l'extension.
//  `--src <arbre>` : juge une autre copie (preuve sur le code d'avant, §6.1).
//  `--mutation=<nom>` / `--mutation=toutes` : réaffaiblit la règle ⇒ doit être ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const FICHIERS = ['src/App.jsx', 'src/numerosNouvelles.js', 'src/ecrans/Reglages.jsx', 'vinted-sync-extension/background.js', 'vinted-sync-extension/vrm-badge.js'];

// [fichier relatif, de, vers]
const MUTATIONS = {
  partielle: ['src/numerosNouvelles.js', "return mode === 'vrm' && complet === true", "return mode === 'vrm'"],
  passage: ['src/App.jsx', 'if (neuf && !neufPermis(it)) continue;', 'if (false) continue;'],
  ko: ['src/numerosNouvelles.js', "if (Array.isArray(listings.ko) && listings.ko.map(String).includes(uid)) return false;", ''],
  marque: ['src/App.jsx', 'if (neuf) { nextNum[it.id] = marquerNouveau(nextNum[it.id]);', 'if (false) { nextNum[it.id] = marquerNouveau(nextNum[it.id]);'],
  notif: ['src/App.jsx', 'if (nouveauxNum.length) direNouveauxNumeros(nouveauxNum);', ''],
  demande: ['src/numerosNouvelles.js', "if (l && l.etat && l.etat !== 'rien') continue;", ''],
  ecrit: ['src/numerosNouvelles.js', 'nouveau: { ...fiche.nouveau, ecrit: at }', 'nouveau: { ...fiche.nouveau }'],
  journee: ['src/App.jsx', "if (modeNum === 'vrm' && nouveauxAEcrire.length) {", 'if (false) {'],
  reglage: ['src/ecrans/Reglages.jsx', 'data-qui-numerote-choix={cle}', ''],
  extension: ['vinted-sync-extension/background.js', "if (msg.type === 'numerotes') { sendResponse(await annoncerNumerotes(msg)); return; }", ''],
};

if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  let attrapees = 0;
  for (const nom of noms) {
    const m = MUTATIONS[nom]; if (!m) { console.log(`❌ mutation inconnue : ${nom}`); process.exitCode = 1; continue; }
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-nn-'));
    // L'arbre entier des sources lues (les modules importés par le bloc exécuté).
    for (const d of ['src', 'vinted-sync-extension', 'api/_lib']) fs.cpSync(path.join(RACINE, d), path.join(t, d), { recursive: true, filter: (f) => !/node_modules|\.zip$|\.png$|\.woff2?$/.test(f) });
    const p = path.join(t, m[0]); const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(m[1])) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${m[0]}`); process.exitCode = 1; fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, src.replace(m[1], m[2]));
    const r = spawnSync(process.execPath, [__filename, '--src', t], { encoding: 'utf8', timeout: 120000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0; if (ok) attrapees++;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${ok ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(attrapees === noms.length ? `\n✅ ${attrapees}/${noms.length} mutations attrapées` : `\n❌ ${noms.length - attrapees} mutation(s) non attrapée(s)`);
  process.exit(attrapees === noms.length ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
const imp = async (f) => { try { return await import('file://' + path.join(RACINE, f)); } catch (e) { dit(false, `${f} se charge`, String(e && e.message).slice(0, 140)); return null; } };

// Une constante d'App.jsx, telle quelle : la ligne qui la déclare, jusqu'au `};` de colonne 0.
function constante(app, nom) {
  const i = app.indexOf(`\nconst ${nom} = `); if (i < 0) return null;
  const lignes = app.slice(i + 1).split('\n');
  if (/;\s*$/.test(lignes[0]) && (lignes[0].match(/\{/g) || []).length === (lignes[0].match(/\}/g) || []).length) return lignes[0];
  const out = [];
  for (const l of lignes) { out.push(l); if (l === '};') break; }
  return out.join('\n');
}

(async () => {
  const APP_BRUT = lire('src/App.jsx');
  const APP = sansCommentaires(APP_BRUT);
  const N = await imp('src/numerosNouvelles.js');
  const R = await imp('src/repriseNumero.js');
  const E = await imp('src/numeroEcrit.js');
  const C = await imp('src/accueilReste/cartonsNumeros.js');
  const F = await imp('src/fusionNuage.js');
  const P = await imp('src/profilVendeur.js');
  // (15 nov., lot numeros-masquees) La republication dans l'app Vinted (le dernier recours avant un N° neuf) : absente
  // d'un arbre plus ancien (le bloc d'avant ne l'appelle pas).
  const RT = require('fs').existsSync(path.join(RACINE, 'src/republieTelephone.js')) ? await imp('src/republieTelephone.js') : null;

  // ── Le bloc exécuté ─────────────────────────────────────────────────────────
  const f = APP_BRUT.indexOf('// </numerotation-passage>'), d = f > 0 ? APP_BRUT.lastIndexOf('<numerotation-passage>', f) : -1;
  const corps = d > 0 && f > d ? APP_BRUT.slice(APP_BRUT.indexOf('\n', d) + 1, f) : '';
  dit(!!corps, 'App.jsx porte le bloc <numerotation-passage> (la numérotation des annonces)');
  const aides = ['cleNum', 'NUM_OK', 'entreePool', 'prochainLibre', 'photoKey', 'ficheEcrite'].map((n) => [n, constante(APP_BRUT, n)]);
  const manque = aides.filter(([, t]) => !t).map(([n]) => n);
  dit(!manque.length, 'les fonctions d’App.jsx que le bloc appelle sont trouvées', manque.join(', '));
  if (!corps || manque.length || !N || !R || !E || !C || !F) { console.log(`\n❌ Nouvelles annonces : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }
  const aidesCtx = vm.createContext({});
  vm.runInContext(aides.map(([, t]) => t).join('\n') + '\n;globalThis.__a = { cleNum, entreePool, prochainLibre, photoKey, ficheEcrite };', aidesCtx);
  const A = aidesCtx.__a;
  const reprenable = (n) => { const s = String(n == null ? '' : n).trim(); return s && !/^B\d/i.test(s) ? s : null; };
  const lecture = (it) => E.lireNumeroEcrit({ titre: it && it.title, description: it && it.desc });
  // Un passage : l'état d'un appareil + la liste lue ⇒ { fiches, pool, nouveaux, changed }.
  const passage = ({ items, fiches = {}, pool = [], complets = {}, koUids = [], moi = false, recrees = null }) => {
    const nextNum = JSON.parse(JSON.stringify(fiches));
    const nextUsed = new Set(pool), taken = new Set(pool), takenK = new Set(pool.map(String));
    const store = { vrm_numero_ecrit: moi ? { actif: true, depuis: '2026-11-01T00:00:00.000Z' } : { actif: false, choisi: '2026-11-01T00:00:00.000Z' } };
    const ctx = {
      recreesEff: recrees, repriseNumerosRecreation: R.repriseNumerosRecreation, fichesAnciennesAnnulees: () => ({}), repubMain: {}, saleOv: {},
      numeroReprenable: reprenable, numVentesParIdentite: { parItem: {}, parPhoto: {} }, items, dateMiseEnLigneMs: (it) => it.t || 0, listingDates: {},
      numeroEcritActif: () => moi, lectureEcriteVinted: lecture, annonceNumerotable: () => true, retenirNumerosNeufs: C.retenirNumerosNeufs,
      load: (k, dflt) => (k in store ? store[k] : dflt), CLE_NUMERO_ECRIT: 'vrm_numero_ecrit', clesLuesEnDouble: C.clesLuesEnDouble,
      nextNum, nextUsed, taken, takenK, byPhoto: {}, reservesNum: { parItem: {} }, horsLigneMaintenant: () => false, prefNum: '',
      decisionEcrite: E.decisionEcrite, numeroNeufPermis: N.numeroNeufPermis, lectureCompleteDe: N.lectureCompleteDe, lectureCompleteAnnonce: N.lectureCompleteAnnonce, marquerNouveau: N.marquerNouveau,
      listings: { items, complets, ko: koUids }, changed: false, ...A,
      lireObjet: () => ({}), VUS_EN_LIGNE: 'vrm_vus_en_ligne', CYCLE_DECISIONS: 'vrm_cycle_decisions', CLE_PHOTOS_VRM: 'vrm_photos_vrm', CLE_EMPREINTES_FICHES: 'vrm_empreintes_fiches',
      CLE_REPUB_REPONSES: 'vrm_republie_reponses', CLE_REPUB_ATTENTE: 'vrm_republie_attente', empreintesVinted: {}, venduesVinted: new Set(), annonceDeclareePartie: () => false, pairsLost: {},
      disparuesDuCompte: RT && RT.disparuesDuCompte, decisionRepublie: RT && RT.decisionRepublie, empreintesDe: RT && RT.empreintesDe,
    };
    vm.createContext(ctx);
    const r = vm.runInContext(`(() => { with (this) { ${corps}\n return nouveauxNum; } }).call(this)`, ctx);
    return { fiches: nextNum, pool: [...nextUsed], nouveaux: r, changed: ctx.changed };
  };
  const acc = { vinted_user_id: '111' };
  const ann = (id, title, o = {}) => ({ id, title, photo: `https://images1.vinted.net/t/01_${id}/f800/${id}.jpeg`, _acc: acc, t: 1000 + Number(id), ...o });
  const pool215 = Array.from({ length: 215 }, (_, i) => i + 1);

  console.log('— 1. La numérotation des annonces, exécutée');
  {
    const items = [ann(1001, 'Nike Dunk Low'), ann(2001, 'Adidas Samba noire 42')];
    const r = passage({ items, fiches: { 1001: { numero: '215', auto: true } }, pool: pool215, complets: { 111: true } });
    dit(r.fiches[2001] && r.fiches[2001].numero === '216', 'lecture complète, annonce neuve sans N° ⇒ N°216 (le plus haut + 1)', JSON.stringify(r.fiches[2001]));
    dit(!!(r.fiches[2001] && r.fiches[2001].nouveau && r.fiches[2001].nouveau.at && !r.fiches[2001].nouveau.ecrit), '… marquée « à écrire sur son carton »');
    dit(r.nouveaux.length === 1 && r.nouveaux[0].id === '2001' && r.nouveaux[0].numero === '216', '… et DITE (une ligne pour la notification)', JSON.stringify(r.nouveaux));
    dit(r.fiches[1001].numero === '215' && !r.fiches[1001].nouveau, 'l’annonce déjà numérotée ne change pas');
    dit(r.pool.includes(216), 'le N°216 entre au pool (append-only)');
    const r2 = passage({ items, fiches: r.fiches, pool: r.pool, complets: { 111: true } });
    dit(r2.nouveaux.length === 0 && r2.fiches[2001].numero === '216' && JSON.stringify(r2.fiches[2001].nouveau) === JSON.stringify(r.fiches[2001].nouveau), 'un second passage ne redonne rien et ne redit rien (une fois)', JSON.stringify(r2.nouveaux));
    const p = passage({ items, fiches: { 1001: { numero: '215', auto: true } }, pool: pool215, complets: {} });
    dit(!p.fiches[2001] && p.nouveaux.length === 0, 'lecture PARTIELLE (pas « complète ») ⇒ aucun N° neuf', JSON.stringify(p.fiches[2001]));
    const k = passage({ items, fiches: { 1001: { numero: '215', auto: true } }, pool: pool215, complets: { 111: true }, koUids: ['111'] });
    dit(!k.fiches[2001], 'compte qui n’a pas répondu ⇒ aucun N° neuf', JSON.stringify(k.fiches[2001]));
    const autre = passage({ items: [ann(2002, 'Puma Suede', { _acc: { vinted_user_id: '222' } })], pool: pool215, complets: { 111: true } });
    dit(!autre.fiches[2002], 'la lecture complète d’UN compte ne vaut pas pour un autre');
  }
  {
    const items = [ann(3002, 'Asics Gel-Lyte III')];
    const r = passage({ items, fiches: { 3001: { numero: '45', auto: true, title: 'Asics Gel-Lyte III' } }, pool: pool215, complets: { 111: true }, recrees: { 3002: '3001' } });
    dit(r.fiches[3002] && r.fiches[3002].numero === '45' && r.fiches[3002].recreeDe === '3001', 'annonce REPUBLIÉE (identité : elle remplace 3001) ⇒ reprend le N°45', JSON.stringify(r.fiches[3002]));
    dit(!r.fiches[3002].nouveau && r.nouveaux.length === 0 && !r.pool.includes(216), '… rien de « neuf », aucun N° brûlé, rien à écrire');
  }
  {
    const items = [ann(4001, 'Sac Gucci Marmont', { desc: 'Très bon état.\nN° 77' }), ann(4002, 'Bottes Dior')];
    const r = passage({ items, pool: pool215, complets: { 111: true }, moi: true });
    dit(r.fiches[4001] && r.fiches[4001].numero === '77' && !r.fiches[4001].nouveau, '« je numérote moi-même » : N° écrit en fin de description ⇒ pris tel quel (77), pas « neuf »', JSON.stringify(r.fiches[4001]));
    dit(!r.fiches[4002] && r.nouveaux.length === 0, '« je numérote moi-même », rien d’écrit ⇒ AUCUN N° attribué', JSON.stringify(r.fiches[4002]));
    const dm = N.demandesNumero({ items, fiches: r.fiches, listings: { complets: { 111: true }, ko: [] }, mode: 'moi', lectureEcrite: lecture });
    dit(dm.length === 1 && String(dm[0].id) === '4002', '… et la DEMANDE existe pour Bottes Dior (une feuille par article)', JSON.stringify(dm.map((x) => x.id)));
    dit(N.demandesNumero({ items, fiches: r.fiches, listings: { complets: {}, ko: [] }, mode: 'moi', lectureEcrite: lecture }).length === 0, '… pas sur une lecture partielle');
    dit(N.demandesNumero({ items, fiches: r.fiches, listings: { complets: { 111: true } }, mode: 'vrm', lectureEcrite: lecture }).length === 0, '« VRM numérote » : rien n’est demandé');
    const amb = [ann(4003, 'Manuel', { desc: 'N° 12\nbla\nN° 13' })];
    dit(N.demandesNumero({ items: amb, fiches: {}, listings: { complets: { 111: true } }, mode: 'moi', lectureEcrite: lecture }).length === 0, 'deux N° écrits (ambigu) : pas demandé ici (il est « à vérifier »)');
  }
  {
    const T = 'Nike Air Max 90 blanche taille 42';
    const items = [ann(5000, T), ...Array.from({ length: 50 }, (_, i) => ann(5001 + i, T, { brand: 'Nike', size: '42' }))];
    const pool10 = Array.from({ length: 10 }, (_, i) => i + 1);
    const r = passage({ items, fiches: { 5000: { numero: '10', title: T, auto: true } }, pool: pool10, complets: { 111: true } });
    const nums = items.slice(1).map((it) => r.fiches[it.id] && r.fiches[it.id].numero);
    const attendu = Array.from({ length: 50 }, (_, i) => String(11 + i));
    dit(JSON.stringify(nums) === JSON.stringify(attendu), '50 annonces identiques ⇒ 11…60, chacune le sien, par son identifiant', nums.slice(0, 5).join(','));
    dit(!nums.includes('10') && new Set(nums).size === 50, '… aucune ne reçoit le N°10 de la fiche au même titre (jamais par ressemblance)');
    dit(r.nouveaux.length === 50, '… les 50 sont dites');
  }
  {
    const items = [ann(6001, 'Sac Gucci Marmont'), ann(6002, 'Manuel de cuisine'), ann(6003, 'Nike Dunk Low')];
    const r = passage({ items, pool: pool215, complets: { 111: true } });
    dit(['216', '217', '218'].every((n, i) => r.fiches[items[i].id] && r.fiches[items[i].id].numero === n), 'un sac, un manuel, une paire : la même règle, dans l’ordre de mise en ligne (216, 217, 218)');
  }

  console.log('— 2. Deux appareils en même temps');
  {
    const base = { vinted_annonce_numeros: { 1001: { numero: '215', auto: true } }, vinted_used_numeros: pool215 };
    const a = passage({ items: [ann(1001, 'x'), ann(7001, 'Sac A')], fiches: base.vinted_annonce_numeros, pool: pool215, complets: { 111: true } });
    const b = passage({ items: [ann(1001, 'x'), ann(7002, 'Sac B')], fiches: base.vinted_annonce_numeros, pool: pool215, complets: { 111: true } });
    dit(a.fiches[7001].numero === '216' && b.fiches[7002].numero === '216', 'chacun, seul, donnerait le N°216 à SON annonce');
    const u = F.fusionnerLigne({ cles: ['vinted_annonce_numeros', 'vinted_used_numeros'], base, local: { vinted_annonce_numeros: a.fiches, vinted_used_numeros: a.pool }, nuage: { vinted_annonce_numeros: b.fiches, vinted_used_numeros: b.pool }, cleNum: A.cleNum });
    dit(!!u.conflit, 'la fusion du nuage REFUSE (conflit) : jamais deux articles sous le N°216', JSON.stringify(u.conflit || null).slice(0, 120));
    const s = F.fusionnerLigne({ cles: ['vinted_annonce_numeros', 'vinted_used_numeros'], base, local: { vinted_annonce_numeros: a.fiches, vinted_used_numeros: a.pool }, nuage: { vinted_annonce_numeros: a.fiches, vinted_used_numeros: a.pool }, cleNum: A.cleNum });
    dit(!s.conflit && s.data.vinted_annonce_numeros[7001].numero === '216', 'la même annonce, le même N° des deux côtés ⇒ accord');
  }

  console.log('— 3. Les règles pures');
  {
    const fiches = { 1: { numero: '217', nouveau: { at: 'x' } }, 2: { numero: '216', nouveau: { at: 'x' } }, 3: { numero: '12' }, 4: { numero: '218', nouveau: { at: 'x', ecrit: 'y' } } };
    const pres = [{ id: 1, title: 'B' }, { id: 2, title: 'A' }, { id: 3 }, { id: 4 }];
    const l = N.aEcrireNouveaux(pres, fiches);
    dit(l.map((x) => x.numero).join(',') === '216,217', '« à écrire » : les N° neufs pas encore écrits, par N°', JSON.stringify(l));
    const e = N.marquerEcrit(fiches[1], 'z');
    dit(e.numero === '217' && e.nouveau.ecrit === 'z' && !N.nouveauAEcrire(e), '« C’est écrit » : la marque seule change, jamais le N°');
    dit(N.listeNumeros(['218', '216', '217']) === 'N°216, 217, 218' && N.listeNumeros(['1', '2', '3', '4', '5', '6', '7']) === 'N°1, 2, 3, 4, 5 +2', '« N°216, 217, 218 » (puis « +N »)');
    const pris = new Set([1, 2, 3]);
    const p = N.propositionNumero({ pris, prisCles: new Set(), prochainLibre: A.prochainLibre });
    const p2 = N.propositionNumero({ pris, prisCles: new Set(), prochainLibre: A.prochainLibre, deja: ['4'] });
    dit(p === '4' && p2 === '5' && pris.size === 3, 'la proposition : le suivant, sur une COPIE (rien réservé), sans redonner celui de la feuille d’avant');
    dit(N.numeroNeufPermis({ mode: 'vrm', complet: true }) && !N.numeroNeufPermis({ mode: 'moi', complet: true }) && !N.numeroNeufPermis({ mode: 'vrm', complet: false }) && !N.numeroNeufPermis({ mode: 'vrm', complet: true, horsLigne: true }), 'un N° neuf : « VRM numérote » + lecture complète + en ligne, seulement');
    dit(N.modeNumerotation({ actif: true }) === 'moi' && N.modeNumerotation(null) === 'vrm', 'le mode vient du réglage synchronisé (éteint ⇒ VRM)');
  }

  console.log('— 4. App, Réglages, extension');
  {
    const sk = (APP.match(/const SYNC_KEYS\s*=\s*\[[\s\S]*?\];/) || [''])[0];
    dit(/'vrm_numero_ecrit'/.test(sk) || /CLE_NUMERO_ECRIT/.test(sk), 'le choix « qui numérote » est synchronisé (SYNC_KEYS)');
    dit(/if \(nouveauxNum\.length\) direNouveauxNumeros\(nouveauxNum\);/.test(APP) && /function direNouveauxNumeros\([^)]*\)\s*\{[\s\S]{0,1100}(?:toast|accompagner|poserToastNumeros)\([\s\S]{0,900}alerteLocale\(/.test(APP), 'les N° neufs sont DITS : bandeau + notification (app en arrière-plan)');
    dit(/versExtension\(ext, \{ type: 'numerotes'/.test(APP), '… et envoyés à la carte de l’extension');
    dit(/id: 'numeros-nouveaux'[\s\S]{0,400}avant: ouvrirAEcrire/.test(APP) && /if \(modeNum === 'vrm' && nouveauxAEcrire\.length\)/.test(APP), 'Ma journée : « N nouveaux articles numérotés · N°… » ouvre « à écrire sur tes cartons »');
    // (19 nov., décision de Julien : « pratique, pas chiant » — l'app ne harcèle plus) « N articles sans numéro » n'est plus une carte ni une boucle de feuilles : la question « Son N° ? » de l'atelier « Compléter ».
    dit(!/id: 'numeros-a-donner'/.test(APP) && /sansNumero: modeNum === 'moi' \? numerosADemander\.map\(\(it\) => String\(it\.id\)\) : \[\]/.test(APP), 'Ma journée : plus de carte « N articles sans numéro » — l’atelier « Compléter » les demande (19 nov.), seulement en « je numérote moi-même »');
    dit(!/demanderNumerosManquants/.test(APP) && /const numeroCompleter = async \(art, v\) => \{[^\n]*await poserNumero\(it, v, ''\);/.test(APP), 'la question « Son N° ? » écrit par `poserNumero` (doublon, ancien N°, N° servi : les gardes de la carte)');
    dit(/<NouveauxNumerosHost\/>/.test(APP) && /data-nn-ecrit=/.test(APP), 'la feuille « Nouveaux N° à écrire » est montée, « C’est écrit » par ligne');
    const regl = sansCommentaires(lire('src/ecrans/Reglages.jsx'));
    dit(/role="radiogroup"[\s\S]{0,300}data-qui-numerote=/.test(regl) && /data-qui-numerote-choix=\{cle\}/.test(regl) && /nn\.reglage\.(vrm|moi)\.phrase|nn\.reglage\.moi\.phrase/.test(regl), 'Réglages : « Qui numérote ? VRM · Moi », et la phrase de ce que fait le choix');
    // Le texte brut (un « /* » dans une chaîne de background.js fausse le retrait des commentaires).
    const bg = lire('vinted-sync-extension/background.js'), bd = lire('vinted-sync-extension/vrm-badge.js');
    dit(/if \(msg\.type === 'numerotes'\) \{ sendResponse\(await annoncerNumerotes\(msg\)\); return; \}/.test(bg) && /CAPTE_SORTES = \[[^\]]*'numerotes'/.test(bg) && /CAPTE_EVENEMENT = new Set\(\[[^\]]*'numerotes'/.test(bg), 'extension : le canal adressé dit les N° donnés, un lot « numérotés » par compte');
    dit(/'VRM a numéroté'/.test(bd) && /nomsNumerotes/.test(bd), 'la carte : « VRM a numéroté · 3 paires numérotées » (le mot du profil)');
    // Le mot du profil : la variante « autre » ne parle jamais de paire (un sac, un manuel).
    let frT = null; try { frT = (await import('file://' + path.join(RACINE, 'src/i18n/langues/fr/numeros-nouvelles.js'))).default; } catch (_) {}
    const autres = frT ? Object.entries(frT).filter(([k]) => /\.autre$/.test(k)).map(([, v]) => JSON.stringify(v)) : [];
    dit(autres.length >= 4 && autres.every((v) => !/paire/i.test(v) && /article/i.test(v)), 'les textes « articles » (profil non Sneakers) ne disent jamais « paire »', autres.join(' | ').slice(0, 160));
    if (P) dit(P.motsArticle('autre').noms === 'articles' && P.motsArticle('sneakers').noms === 'paires', 'le mot vient du profil du vendeur (src/profilVendeur.js)');
  }

  console.log(ko ? `\n❌ Nouvelles annonces sans N° : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Nouvelles annonces sans N° : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
