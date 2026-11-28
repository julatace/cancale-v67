#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  5.455.7 (Julien, 27 nov. 23:10 : « entre les différents utilisateurs, on ne doit pas pouvoir voir une même template d'un
//  utilisateur à l'autre ») — LES MESSAGES PAR DÉFAUT UNIQUES À CHAQUE COMPTE VRM
//   U1 1 000 comptes VRM inventés, 5 langues : aucun jeu par défaut identique, aucun 1er message identique entre deux comptes
//      (par la VRAIE règle d'enregistrement : `validerReglagesFavoris({message:'', offre}, {graine})`)
//   U2 le même compte ⇒ toujours le même jeu ; jamais l'identifiant en clair dans un texte
//   U3 ce qu'IL a écrit gagne toujours (jamais remplacé) ; sans offre et sans texte ⇒ refusé comme avant
//   U4 chaque version annonce l'offre (« offre » : l'offre part avant le message) et passe la règle des mots interdits
//   U5 un réglage d'avant au texte par défaut PARTAGÉ ⇒ remplacé à l'envoi par SON jeu (api/_lib/favoris.js) ; le reste intact
//   U6 l'extension porte la MÊME règle (bloc <gardes-app> du vrai background.js, exécuté)
//  `UNIQUES_RACINE=<arbre d'avant>` : rouge attendu (le texte partagé). `--mutation=nom` ; `--prouve`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const RACINE0 = process.env.UNIQUES_RACINE || path.join(__dirname, '..');
const MUTATIONS = {
  'graine-ignoree': ['src/reglagesFavoris.js', "defautsFavorisUniques(String(graine),langue,", "defautsFavorisUniques('tous',langue,"],
  'ecrase-son-texte': ['src/reglagesFavoris.js', "const uniques=!message.trim()&&o.offreMode", "const uniques=o.offreMode"],
  'sans-remplacement-serveur': ['api/_lib/favoris.js', "{const u=defautUniqueSiPartage(p,owner);if(u){p.message=u.message;p.variantes=u.variantes;}}\n        const message", "{}\n        const message"],
  'tirage-fige': ['src/favorisDefauts.js', "const r = Number(g % t);", "const r = 0;"],
};
const argMut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) { const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' }); const rouge = r.status === 1 && /❌ U\d/.test(r.stdout || ''); console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`); if (!rouge) rate++; }
  process.exit(rate ? 1 : 0);
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };
(async () => {
  let R = RACINE0;
  if (argMut) {
    const M = MUTATIONS[argMut]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
    R = fs.mkdtempSync(path.join(os.tmpdir(), 'uniques-'));
    for (const d of ['api', 'src']) fs.cpSync(path.join(RACINE0, d), path.join(R, d), { recursive: true });
    fs.symlinkSync(path.join(RACINE0, 'node_modules'), path.join(R, 'node_modules'));
    fs.writeFileSync(path.join(R, 'package.json'), fs.readFileSync(path.join(RACINE0, 'package.json')));
    const f = path.join(R, M[0]), s = fs.readFileSync(f, 'utf8'); if (!s.includes(M[1])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
    fs.writeFileSync(f, s.split(M[1]).join(M[2]));
    process.on('exit', () => { try { fs.rmSync(R, { recursive: true, force: true }); } catch (_) {} });
  }
  const { validerReglagesFavoris, MESSAGE_PAR_DEFAUT } = await import(path.join(R, 'src', 'reglagesFavoris.js'));
  const { messageAutoPermis } = await import(path.join(R, 'src', 'messageSur.js'));
  const ids = Array.from({ length: 1000 }, (_, i) => `aaaaaaaa-${String(i).padStart(4, '0')}-4aaa-8aaa-${String(i * 7919).padStart(12, '0')}`);
  const base = { message: '', pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 6 };
  const jeu = (id, langue) => { try { const p = validerReglagesFavoris(base, { graine: id, langue }); return [p.message, ...(p.variantes || [])]; } catch (e) { return ['ERREUR ' + e.message]; } };
  // U1
  const bilan = {};
  for (const l of ['fr', 'en', 'es', 'it', 'de']) { const prem = new Set(), jeux = new Set(); for (const id of ids) { const j = jeu(id, l); prem.add(j[0]); jeux.add(j.join('\u0000')); } bilan[l] = [prem.size, jeux.size]; }
  dit(Object.values(bilan).every(([a, b]) => a === 1000 && b === 1000), 'U1 1 000 comptes, 5 langues : aucun jeu ni 1er message identique entre deux comptes', JSON.stringify(bilan));
  // U2
  const a1 = jeu(ids[3], 'fr'), a2 = jeu(ids[3], 'fr');
  dit(a1.join() === a2.join() && a1.length >= 2 && !a1.some((t) => t.includes(ids[3]) || /aaaaaaaa/.test(t)), 'U2 le même compte ⇒ le même jeu (' + a1.length + ' versions), jamais son identifiant dans un texte', JSON.stringify(a1));
  // U3
  let p3; try { p3 = validerReglagesFavoris(Object.assign({}, base, { message: 'Mon texte à moi, une offre pour toi.' }), { graine: ids[1] }); } catch (e) { p3 = { erreur: e.message }; }
  let p3b; try { p3b = validerReglagesFavoris(Object.assign({}, base, { offreMode: null, pourcentage: null }), { graine: ids[1] }); } catch (e) { p3b = { erreur: e.message }; }
  dit(p3.message === 'Mon texte à moi, une offre pour toi.' && !p3.variantes && p3b.erreur, 'U3 son texte gagne toujours (rien ajouté) ; sans offre ni texte ⇒ refusé comme avant', JSON.stringify({ p3, p3b }));
  // U4
  const tous = ids.slice(0, 200).flatMap((id) => ['fr', 'en', 'es', 'it', 'de'].flatMap((l) => jeu(id, l)));
  const sansOffre = tous.filter((t) => !/offr|offer|ofert|angebot/i.test(t)), interdits = tous.filter((t) => !messageAutoPermis(t, 'vinted'));
  dit(!sansOffre.length && !interdits.length, `U4 chaque version annonce l'offre et passe la règle des mots interdits (${tous.length} textes)`, JSON.stringify({ sansOffre: sansOffre.slice(0, 2), interdits: interdits.slice(0, 2) }));
  // U5 : le serveur remplace le texte PARTAGÉ d'un réglage d'avant (et seulement lui)
  const src = fs.readFileSync(path.join(R, 'api', '_lib', 'favoris.js'), 'utf8');
  const fn = /function defautUniqueSiPartage\(p,owner\)\{[^\n]*\}/.exec(src);
  let u5 = null;
  if (fn) { const { defautsFavorisUniques } = await import(path.join(R, 'src', 'favorisDefauts.js')); u5 = new Function('MESSAGE_PAR_DEFAUT', 'defautsFavorisUniques', fn[0] + '; return defautUniqueSiPartage;')(MESSAGE_PAR_DEFAUT, defautsFavorisUniques); }
  const r5a = u5 && u5({ message: MESSAGE_PAR_DEFAUT }, ids[5]), r5b = u5 && u5({ message: MESSAGE_PAR_DEFAUT }, ids[6]), r5c = u5 && u5({ message: 'Le mien.' }, ids[5]);
  dit(!!(r5a && r5b && r5a.message !== r5b.message && r5a.message !== MESSAGE_PAR_DEFAUT && r5c === null && /defautUniqueSiPartage\(p,owner\)/.test(src.slice(src.indexOf("c.action==='lancer'"), src.indexOf("c.action==='auto_regler'")))),
    'U5 un réglage d’avant au texte par défaut PARTAGÉ ⇒ SON jeu à l’envoi (deux comptes, deux textes) ; son propre texte intact', JSON.stringify({ a: r5a && r5a.message, b: r5b && r5b.message, c: r5c }));
  // U6 : l'extension, la même règle (bloc <gardes-app> exécuté)
  if (!argMut && !process.env.UNIQUES_RACINE) {
    const { faireFond } = require('./_fond-vm.cjs');
    const f = faireFond({ src: path.join(RACINE0, 'vinted-sync-extension', 'background.js'), connecte: '111', comptes: [{ vinted_user_id: '111', domain: 'www.vinted.fr' }], lignes: {}, store: {} });
    let e6; try { const G = require('vm').runInContext('GARDES_APP', f.ctx); e6 = G.validerReglagesFavoris(base, { graine: ids[7] }); } catch (e) { e6 = { erreur: String(e) }; }
    dit(e6 && e6.message === jeu(ids[7], 'fr')[0], 'U6 l’extension (vrai background.js) rend le MÊME jeu que l’app pour un compte', JSON.stringify(e6 && e6.message));
  }
  console.log(ko ? `❌ messages uniques : ${ko} rouge(s), ${ok} vert(s)` : `✅ messages uniques : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ U0 a levé : ' + (e && e.stack || e)); process.exit(1); });
