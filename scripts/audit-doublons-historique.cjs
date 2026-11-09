#!/usr/bin/env node
// ── audit-doublons-historique — LOT AF (9 nov. 2026, propositions 45 et 49) ─────
// 1. LA MÊME ANNONCE SUR DEUX COMPTES VINTED : exécute la VRAIE règle
//    (src/enLigneDeuxFois.js) avec la VRAIE clé de photo (`photoKey`, extraite
//    d'App.jsx), sur des données INVENTÉES :
//      · 50 paires identiques en titre, marque et taille sur deux comptes, photos
//        différentes ⇒ AUCUNE alerte (jamais le titre, §5) ;
//      · la même photo exacte sur deux comptes ⇒ UNE alerte, ses deux annonces
//        avec compte, prix et depuis quand ;
//      · une annonce « à confirmer » (lecture de plus de 24 h) n'est pas « en ligne » :
//        aucune alerte, le compte est nommé dans « pas vérifié » ; et l'app ne passe à la
//        règle que `listings.items` (jamais `aConfirmer`) ;
//      · le coût : un index par clé photo — 2 000 puis 8 000 annonces, le temps ne
//        croît pas comme n² ;
//      · l'écran Annonces montre l'alerte des MÊMES groupes que Ma journée (§11), en
//        ambre, sans aucun bouton qui supprime (VRM ne supprime rien, §3).
// 2. L'HISTOIRE D'UN N° : exécute src/historiqueNumero.js :
//      · le journal n'écrit une ligne que quand un N° change (auto, à la main, doublon,
//        reprise), jamais sans état d'avant ; il est APPEND-ONLY ;
//      · la ligne de vie n'invente rien : sans trace ⇒ « origine non enregistrée
//        (avant le 9 nov. 2026) » ; B… ⇒ la remise à zéro (013) ; case libérée ; quitté ;
//      · rien n'est modifié (entrées gelées) ; App.jsx écrit le journal dans `save` des
//        fiches, la clé est synchronisée, la fiche le montre sans aucun bouton.
//   node scripts/audit-doublons-historique.cjs                 la règle du dépôt
//   node scripts/audit-doublons-historique.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-doublons-historique.cjs --prouve        chaque mutation doit rougir
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const F = {
  regle: path.join(RACINE, 'src', 'enLigneDeuxFois.js'),
  histo: path.join(RACINE, 'src', 'historiqueNumero.js'),
  app: path.join(RACINE, 'src', 'App.jsx'),
  feuille: path.join(RACINE, 'src', 'EnLigneDeuxFois.jsx'),
  fiche: path.join(RACINE, 'src', 'FichePaire.jsx'),
};

// [fichier, ancre, remplacement]
const MUTATIONS = {
  'par-titre': ['regle', "  parts.forEach((p, i) => { if (p.recreeDe && parId.has(p.recreeDe)) lie(i, parId.get(p.recreeDe), 'recree'); });",
    "  parts.forEach((p, i) => { if (p.recreeDe && parId.has(p.recreeDe)) lie(i, parId.get(p.recreeDe), 'recree'); });\n  { const t = new Map(); parts.forEach((p, i) => { const k = p.titre.toLowerCase(); if (!k) return; if (t.has(k)) lie(i, t.get(k), 'titre'); else t.set(k, i); }); }"],
  'vieille-conclut': ['regle', "  if (!(Number(maintenant) - lu <= EN_LIGNE_FRAIS_MS)) return 'lecture de plus de 24 h';\n", ''],
  'quadratique': ['regle', "    for (const k of p.photos) { if (parPhoto.has(k)) lie(i, parPhoto.get(k), 'photo'); else parPhoto.set(k, i); }",
    "    for (const k of p.photos) { parts.forEach((q, j) => { if (j < i && q.photos.includes(k)) lie(i, j, 'photo'); }); }"],
  'prix-depuis-tus': ['regle', "      parts[parts.length - 1].depuis = typeof dateDe === 'function' ? (Number.isFinite(dateDe(it)) ? dateDe(it) : null) : null;\n", ''],
  'annonces-sans-alerte': ['app', "<EnLigneDeuxFoisAlerte groupes={enLigneDeux.vinted}", "<EnLigneDeuxFoisAlerte groupes={[]}"],
  'alerte-a-confirmer': ['app', "        enLigne: listings.items.filter((it) => String(it && it._acc && it._acc.vinted_user_id) === uid) };",
    "        enLigne: [...listings.items, ...(listings.aConfirmer || [])].filter((it) => String(it && it._acc && it._acc.vinted_user_id) === uid) };"],
  'alerte-rouge': ['css', "box-shadow: inset 3px 0 0 var(--vrm-warn, #B25000);", "box-shadow: inset 3px 0 0 #FF3B30;"],
  'journal-sans-avant': ['histo', "  if (!estObjet(avant) || !estObjet(apres)) return [];", "  if (!estObjet(apres)) return []; if (!estObjet(avant)) avant = {};"],
  'journal-reecrit': ['histo', "  const base = Array.isArray(journal) ? journal.slice() : [];", "  const base = [];"],
  'journal-devine': ['histo', "    } else if (!dejaJournal(id)) pousser({ cle: 'fiche', quoi: 'inconnu', at: null, id: String(id), texte: `Origine non enregistrée (${QUAND_JOURNAL})`, preuve: 'fiche de l’annonce' + sur(id) });",
    "    } else if (!dejaJournal(id)) { origineConnue = true; pousser({ cle: 'fiche', quoi: 'auto', at: null, id: String(id), texte: 'Donné à la mise en ligne', preuve: 'fiche de l’annonce' + sur(id) }); }"],
  'journal-retire-num': ['histo', "    if (!num) continue;                                   // un N° ne se retire jamais : rien à noter",
    "    if (!num) { out.push({ at: maintenant, id: String(id), num: '', quoi: 'retire' }); continue; }"],
  'hook-absent': ['app', "    if (k === 'vinted_annonce_numeros' && !r.conflit) noterJournalNumeros(_lireJson(avantTxt), r.v);\n", ''],
  'journal-pas-synchro': ['app', "  'vrm_numeros_journal',\n", ''],
  'fiche-change-num': ['fiche', "<span className=\"vrm-fp-ev-txt\">{ev.texte}{ev.preuve ? <small data-fiche-preuve=\"\">{ev.preuve}</small> : null}</span>\n            </li>",
    "<span className=\"vrm-fp-ev-txt\">{ev.texte}{ev.preuve ? <small data-fiche-preuve=\"\">{ev.preuve}</small> : null}</span><button type=\"button\">Changer</button>\n            </li>"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

const lire = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
const charger = async (src, nom) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-doublons-historique-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(dir, nom), src);
  return import(pathToFileURL(path.join(dir, nom)).href);
};

(async () => {
  const S = { regle: lire(F.regle), histo: lire(F.histo), app: fs.readFileSync(F.app, 'utf8'), feuille: lire(F.feuille), fiche: lire(F.fiche),
    css: lire(path.join(RACINE, 'src', 'en-ligne-deux-fois.css')) };
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!S[m[0]] || !S[m[0]].includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    S[m[0]] = S[m[0]].replace(m[1], m[2]);
  }
  let ko = 0, n = 0;
  const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + d : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : ' + e.message); } };

  // La VRAIE clé de photo et la VRAIE clé de N° (App.jsx).
  const ctx = {}; vm.createContext(ctx);
  const deb = S.app.indexOf('const photoKey = (url) => {');
  const dCle = S.app.indexOf('\nconst cleNum = (v) => {');
  vm.runInContext([S.app.slice(deb, S.app.indexOf('\n};\n', deb) + 3), dCle >= 0 ? S.app.slice(dCle, S.app.indexOf('\n};\n', dCle) + 4) : '',
    'this.photoKey = photoKey; this.cleNum = typeof cleNum === "function" ? cleNum : null;'].join('\n'), ctx);
  const photoKey = ctx.photoKey, cle = ctx.cleNum;
  dit(typeof photoKey === 'function' && typeof cle === 'function', 'la vraie `photoKey` et la vraie `cleNum` sont lues dans App.jsx');

  let R = null, H = null;
  if (S.regle) { try { R = await charger(S.regle, 'enLigneDeuxFois.js'); } catch (e) { dit(false, 'la règle « en ligne deux fois » ne se charge pas : ' + e.message); } }
  else dit(false, 'src/enLigneDeuxFois.js absent');
  if (S.histo) { try { H = await charger(S.histo, 'historiqueNumero.js'); } catch (e) { dit(false, 'src/historiqueNumero.js ne se charge pas : ' + e.message); } }
  else dit(false, 'src/historiqueNumero.js absent : aucune histoire de N°');

  // ── 1. LA MÊME ANNONCE SUR DEUX COMPTES ─────────────────────────────────────
  const MAINT = Date.parse('2026-11-09T12:00:00Z'), HEURE = 3600e3, JOUR = 24 * HEURE;
  const ph = (dossier, fichier, taille = 'f800') => `https://images1.vinted.net/t/${dossier}/${taille}/${fichier}.jpeg?s=abc`;
  const ann = (id, photo, o = {}) => ({ id, title: 'Nike Dunk Low Panda', brand_title: 'Nike', size_title: '42', photo, url: `https://www.vinted.fr/items/${id}-x`,
    price: { amount: '60.0', currency_code: 'EUR' }, createdTs: Math.round((MAINT - 5 * JOUR) / 1000), ...o });
  const compte = (uid, enLigne, o = {}) => ({ uid, nom: 'compte-' + uid, ok: true, lu: MAINT - 2 * HEURE, enLigne, ...o });
  const dateDe = (it) => { const v = Number(it.createdTs); return Number.isFinite(v) ? (v < 1e12 ? v * 1000 : v) : null; };
  const lancer = (o) => R.enLigneDeuxFois({ clePhoto: photoKey, cle, maintenant: MAINT, dateDe, ...o });
  const deuxComptes = (r) => (R.surDeuxComptes ? R.surDeuxComptes(r.vinted) : r.vinted.filter((g) => g.comptes.length >= 2));

  if (R && photoKey) {
    await essaie('1A · 50 paires identiques', () => {
      const fiches = {}, l1 = [], l2 = [];
      for (let i = 0; i < 50; i++) {
        const id = String(9000000 + i);
        fiches[id] = { numero: String(i + 1), photoK: `05_00${i}_d${i}/17000000${i}` };
        (i % 2 ? l1 : l2).push(ann(id, ph(`05_00${i}_d${i}`, `17000000${i}`)));
      }
      const r = lancer({ vinted: [compte('111', l1), compte('222', l2)], fiches });
      dit(r.su && r.vinted.length === 0 && deuxComptes(r).length === 0, '50 paires au même titre, marque et taille sur deux comptes, photos différentes : AUCUNE alerte', JSON.stringify(r.vinted.slice(0, 1)));
    });
    await essaie('1B · même photo sur deux comptes', () => {
      const fiches = { 1001: { numero: '12', photoK: '05_aaa_d1/1700000001' }, 2001: { numero: '40' } };
      const r = lancer({ vinted: [compte('111', [ann('1001', ph('05_aaa_d1', '1700000001'), { price: { amount: '60.0' } })]),
        compte('222', [ann('2001', ph('05_aaa_d1', '1700000001', 'f310'), { price: { amount: '55.5' }, createdTs: Math.round((MAINT - 2 * JOUR) / 1000) })])], fiches });
      const g = deuxComptes(r);
      dit(g.length === 1 && g[0].annonces.length === 2, 'la même photo exacte sur deux comptes : UNE alerte, ses deux annonces', JSON.stringify(r.vinted));
      if (g[0]) {
        const a = Object.fromEntries(g[0].annonces.map((x) => [x.id, x]));
        dit(a['1001'] && a['2001'] && a['1001'].nom === 'compte-111' && a['2001'].nom === 'compte-222', 'chaque annonce nomme SON compte');
        dit(a['1001'] && a['1001'].prix === 60 && a['2001'].prix === 55.5, 'chaque annonce porte SON prix', JSON.stringify(g[0].annonces.map((x) => x.prix)));
        dit(a['2001'] && a['2001'].depuis === MAINT - 2 * JOUR && a['1001'].depuis === MAINT - 5 * JOUR, 'chaque annonce dit depuis quand elle est en ligne', JSON.stringify(g[0].annonces.map((x) => x.depuis)));
        dit(R.texteEuros && R.texteEuros(55.5) === '55,50 €' && R.texteEuros(null) === 'prix pas lu', 'un prix illisible se dit « prix pas lu », jamais 0 €');
        dit(R.texteDepuis && /^en ligne depuis le /.test(R.texteDepuis(MAINT - 2 * JOUR, MAINT)) && R.texteDepuis(null, MAINT) === 'date de mise en ligne pas lue', 'une date pas lue se dit, jamais inventée');
      }
      const r2 = lancer({ vinted: [compte('111', [ann('1', ph('05_d', '1')), ann('2', ph('05_d', '2'))]), compte('222', [ann('3', ph('05_d', '3'))])], fiches: {} });
      dit(r2.vinted.length === 0, 'le même DOSSIER, fichiers différents : rien (le dossier seul n’est pas une identité)', JSON.stringify(r2.vinted));
    });
    await essaie('1C · à confirmer', () => {
      const r = lancer({ vinted: [compte('111', [ann('1001', ph('05_aaa_d1', '1700000001'))]), compte('222', [ann('2001', ph('05_aaa_d1', '1700000001'))], { lu: MAINT - 30 * HEURE })], fiches: {} });
      dit(r.vinted.length === 0 && r.manque.some((m) => m.uid === '222' && /24 h/.test(m.raison)), 'une annonce « à confirmer » (lue il y a 30 h) n’est pas en ligne : aucune alerte, le compte est nommé', JSON.stringify(r));
    });
    await essaie('1D · coût', () => {
      const tps = (nb) => {
        const l1 = [], l2 = [];
        for (let i = 0; i < nb; i++) (i % 2 ? l1 : l2).push(ann(String(1e7 + i), ph(`05_${i}_d`, `${17e8 + i}`)));
        l1.push(ann('99999991', ph('05_z_d', '1'))); l2.push(ann('99999992', ph('05_z_d', '1')));
        const t0 = process.hrtime.bigint();
        let r; for (let k = 0; k < 3; k++) r = lancer({ vinted: [compte('111', l1), compte('222', l2)], fiches: {} });
        return { ms: Number(process.hrtime.bigint() - t0) / 3e6, n: r.vinted.length };
      };
      tps(500);
      const a = tps(2000), b = tps(8000);
      dit(a.n === 1 && b.n === 1, 'parmi 8 000 annonces, la seule paire en double est trouvée', `${a.n} / ${b.n}`);
      dit(b.ms / Math.max(a.ms, 0.5) < 9 && b.ms < 1500, `le coût suit n, pas n² (2 000 : ${a.ms.toFixed(1)} ms · 8 000 : ${b.ms.toFixed(1)} ms)`, `rapport ${(b.ms / Math.max(a.ms, 0.5)).toFixed(1)}`);
    });
  }

  // L'app : les MÊMES groupes dans Annonces et Ma journée, les annonces EN LIGNE seulement.
  await essaie('1E · App', () => {
    const sans = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const app = sans(S.app);
    const dMemo = app.indexOf('const enLigneDeux = useMemo(');
    const memo = dMemo >= 0 ? app.slice(dMemo, app.indexOf('}, [listings, numeros', dMemo)) : '';
    dit(/enLigne: listings\.items\.filter\(/.test(memo) && !/aConfirmer/.test(memo), 'la règle ne reçoit que les annonces EN LIGNE (jamais « à confirmer »)');
    dit(/dateDe: \(it\) => dateMiseEnLigneMs\(it, listingDates\)/.test(memo), 'depuis quand : la date de mise en ligne de l’écran Annonces (`dateMiseEnLigneMs`)');
    dit(/<EnLigneDeuxFoisAlerte groupes=\{enLigneDeux\.vinted\}/.test(app), 'l’écran Annonces montre l’alerte des MÊMES groupes que Ma journée (`enLigneDeux.vinted`)');
    const f = S.feuille ? sans(S.feuille) : '';
    const al = f.slice(f.indexOf('export function EnLigneDeuxFoisAlerte'));
    dit(!!S.feuille && al.length > 50 && /data-deux-fois-ouvrir/.test(al) && !/onClick=\{[^}]*(supprim|delete|vmrCmd)/i.test(al) && !/fetch\(/.test(al), 'l’alerte ouvre l’annonce sur Vinted et ne supprime rien (aucun envoi)');
    dit(!!S.css && /\.vrm-deux-fois-alerte[^{]*\{[^}]*var\(--vrm-warn/.test(S.css) && !/\.vrm-deux-fois-alerte[^{]*\{[^}]*(#FF3B30|#ff453a|--vrm-danger|--vrm-rouge)/i.test(S.css), 'l’alerte est AMBRE, jamais rouge (le rouge = deux paires sous un N°)');
  });

  // ── 2. L'HISTOIRE D'UN N° ───────────────────────────────────────────────────
  const gele = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gele); Object.freeze(o); } return o; };
  if (H && cle) {
    await essaie('2A · journal', () => {
      const t = '2026-11-09T10:00:00.000Z';
      const avant = gele({ 1: { numero: '7', auto: true, numberedAt: '2026-11-01T00:00:00.000Z' }, 2: { numero: '8' }, 3: { numero: 'b125' } });
      const apres = gele({
        1: { numero: '7', auto: true, numberedAt: '2026-11-01T00:00:00.000Z' },                        // rien n'a changé
        2: { numero: '31', auto: false, manuelAt: t, reattribue: { de: '8', vers: '31', at: t, main: true } }, // à la main
        3: { numero: 'B125' },                                                                          // même clé
        4: { numero: '32', auto: true, numberedAt: t },                                                 // donné à la mise en ligne
        5: { numero: '33', auto: true, numberedAt: t, reattribue: { de: '9', vers: '33', at: t } },     // doublon réglé
        6: { numero: '12', recreeDe: '99', recreeAt: t, auto: true },                                   // reprise (republiée)
      });
      const l = H.evenementsNumeroFiches(avant, apres, { maintenant: t, cle });
      const par = Object.fromEntries(l.map((x) => [x.id, x]));
      dit(l.length === 4 && !par[1] && !par[3], 'une ligne seulement quand un N° change (« b125 » = « B125 », inchangé = rien)', JSON.stringify(l));
      dit(par[2] && par[2].quoi === 'main' && par[2].de === '8' && par[2].num === '31', 'à la main : « main », l’ancien N° gardé', JSON.stringify(par[2]));
      dit(par[4] && par[4].quoi === 'auto' && par[4].at === t, 'à la mise en ligne : « auto », daté', JSON.stringify(par[4]));
      dit(par[5] && par[5].quoi === 'doublon' && par[5].de === '9', 'doublon réglé : « doublon », l’ancien N°', JSON.stringify(par[5]));
      dit(par[6] && par[6].quoi === 'reprise' && par[6].src === '99', 'republiée : « reprise » de l’annonce remplacée', JSON.stringify(par[6]));
      dit(H.evenementsNumeroFiches(undefined, apres, { cle }).length === 0, 'sans état d’avant (rien sur l’appareil) : AUCUNE ligne — on ne sait pas ce qui est neuf');
      dit(H.evenementsNumeroFiches({ 1: { numero: '7' } }, { 1: { numero: '' } }, { cle }).length === 0, 'un N° vidé n’écrit rien (un N° ne se retire jamais)');
      const j0 = gele([{ at: t, id: '1', num: '7', quoi: 'auto' }]);
      const j1 = H.ajouterAuJournal(j0, l);
      dit(j1.length === 5 && JSON.stringify(j1[0]) === JSON.stringify(j0[0]), 'le journal est APPEND-ONLY : l’ancienne ligne reste, les nouvelles s’ajoutent');
      dit(H.ajouterAuJournal(j1, l).length === 5, 'une ligne rejouée (deux onglets, file d’envoi) n’est pas doublée');
    });
    await essaie('2B · ligne de vie', () => {
      const fiches = gele({
        10: { numero: '40' },                                                                                     // aucune trace
        11: { numero: '41', auto: true, numberedAt: '2026-10-20T08:00:00.000Z', reattribue: { de: '17', vers: '41', at: '2026-10-20T08:00:00.000Z', ecrit: '2026-10-21T09:00:00.000Z' } },
        12: { numero: '42', auto: false, manuelAt: '2026-10-25T08:00:00.000Z' },
        13: { numero: 'B230' },
      });
      const marqueur = gele({ version: 3, archive: 'B', coupure: '2026-10-09T00:00:00.000Z', appliqueLe: '2026-10-11T18:00:00.000Z' });
      const base = { fiches, saleOv: gele({}), journal: gele([]), marqueur, cleNum: cle, estArchive: (k) => /^B\d+$/.test(k) };
      const h40 = H.historiqueNumero({ ...base, cle: '40' });
      dit(h40 && h40.evenements.length === 1 && /Origine non enregistrée \(avant le 9 nov\. 2026\)/.test(h40.evenements[0].texte) && h40.origineConnue === false,
        'sans trace : « origine non enregistrée (avant le 9 nov. 2026) » — jamais deviné', JSON.stringify(h40));
      const h41 = H.historiqueNumero({ ...base, cle: '41' });
      dit(h41 && h41.evenements.some((e) => e.quoi === 'doublon' && /avant : N°17/.test(e.texte)) && h41.evenements.some((e) => e.quoi === 'ecrit-carton'), 'doublon réglé le 20 oct. (l’ancien N°17), puis « C’est écrit »', JSON.stringify(h41 && h41.evenements));
      const h17 = H.historiqueNumero({ ...base, cle: '17' });
      dit(h17 && h17.evenements.some((e) => e.quoi === 'quitte' && /N°41/.test(e.texte)), 'le N°17 dit qu’une annonce l’a quitté pour le N°41', JSON.stringify(h17 && h17.evenements));
      const h42 = H.historiqueNumero({ ...base, cle: '42' });
      dit(h42 && h42.evenements.length === 1 && h42.evenements[0].quoi === 'main' && h42.evenements[0].at === '2026-10-25T08:00:00.000Z', 'saisi à la main, daté par SA fiche', JSON.stringify(h42));
      const hb = H.historiqueNumero({ ...base, cle: 'b230', sortieStock: gele({ at: Date.parse('2026-11-05T10:00:00Z'), itemName: 'Étagère 2' }) });
      dit(hb && hb.evenements.some((e) => e.quoi === 'b013' && /Ancien N°230/.test(e.texte) && e.at === '2026-10-11T18:00:00.000Z'), 'B230 : l’ancien N°230 passé en « B » à la remise à zéro (013), daté du serveur', JSON.stringify(hb && hb.evenements));
      dit(hb && hb.evenements.some((e) => e.quoi === 'libere' && /le N° reste/.test(e.texte)), 'la case du Stock libérée (colis parti) — le N° reste');
      const hj = H.historiqueNumero({ ...base, cle: '40', journal: gele([{ at: '2026-11-09T10:00:00.000Z', id: '10', num: '40', de: '3', quoi: 'main' }]) });
      dit(hj && hj.origineConnue && hj.evenements.length === 1 && /avant : N°3/.test(hj.evenements[0].texte), 'avec le journal : la ligne vient du journal (une fois)', JSON.stringify(hj && hj.evenements));
      dit(H.historiqueNumero({ ...base, fiches: null, cle: '40' }) === null, 'fiches pas lues : « pas su » (null), jamais une histoire vide');
      dit(Object.isFrozen(fiches[11]) && fiches[11].numero === '41', 'rien n’est modifié (entrées gelées, aucune exception)');
    });
  }
  await essaie('2C · App et fiche', () => {
    const sans = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const app = sans(S.app);
    const sync = (/const SYNC_KEYS = \[([\s\S]*?)\n\];/.exec(app) || [])[1] || '';
    dit(/'vrm_numeros_journal'/.test(sync), 'le journal des N° est synchronisé (`main`, comparer-et-échanger sur `data.rev`)');
    const dSave = app.indexOf('const save = (k,v,quand) => {');
    const corps = dSave >= 0 ? app.slice(dSave, app.indexOf('\n};\n', dSave)) : '';
    dit(/if \(k === 'vinted_annonce_numeros' && !r\.conflit\) noterJournalNumeros\(_lireJson\(avantTxt\), r\.v\);/.test(corps), 'chaque écriture des fiches note ses changements de N° au moment même (`save`), jamais sur un conflit');
    dit(/historiqueNumero\(\{ cle: rn\.cle, fiches: numeros/.test(app) && /histoNum=\{histoNum\}/.test(app), 'la fiche d’une paire reçoit l’histoire de SON N° (par sa clé)');
    const f = S.fiche ? sans(S.fiche) : '';
    const hn = f.slice(f.indexOf('function HistoireNumero('), f.indexOf('const dateCourte'));
    dit(hn.length > 50 && !/<button|<input|onClick|onChange/.test(hn), 'l’histoire du N° est en LECTURE SEULE (aucun bouton, aucun champ)');
  });

  console.log(`\n${n - ko}/${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
