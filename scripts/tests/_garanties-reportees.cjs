// ════════════════════════════════════════════════════════════════════════════
//  GARANTIES REPORTÉES (21 nov., ci-offres-panneau) — quand un écran de l'app est retiré
//
//  Un test d'interface jugeait un écran qui n'existe plus (geste passé au panneau de l'extension, décision de
//  Julien du 20 nov.). Ses garanties ne sont pas jetées : chacune nomme le contrôle qui la juge AUJOURD'HUI, sur le
//  chemin qui existe (audit qui exécute le vrai background.js, banc du vrai panneau, test de la vraie file serveur).
//  Ce module LANCE ces juges (une fois chacun), exige leur code 0 ET la ligne VERTE de chaque contrôle nommé :
//  un contrôle renommé, retiré ou rouge ⇒ ce test est rouge, la garantie est dite orpheline.
//  Une garantie dont l'OBJET a disparu (un bouton d'un écran retiré) est listée « retirée » avec sa raison :
//  rien n'est lancé pour elle, mais elle reste écrite, lisible, et comptée à part.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const RACINE = path.resolve(__dirname, '../..');

// Une ligne verte : « ✅ … » / « ✓ … » (audits, bancs) ou « ok N - … » (node --test).
const VERT = /^\s*(?:✅|✓|ok \d+ - )/;

function juger(nom, garanties, juges) {
  const sorties = {};
  const lancer = (cle) => {
    if (sorties[cle]) return sorties[cle];
    const j = juges[cle]; if (!j) throw new Error(`juge inconnu : ${cle}`);
    const r = spawnSync(process.execPath, j.args, { cwd: RACINE, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...(j.env || {}) } });
    const texte = `${r.stdout || ''}\n${r.stderr || ''}`;
    sorties[cle] = { code: r.status, verts: texte.split('\n').filter((l) => VERT.test(l)), queue: texte.trim().split('\n').slice(-6).join('\n') };
    console.log(`  · ${cle} (${j.args.join(' ')}) : code ${r.status}, ${sorties[cle].verts.length} ligne(s) verte(s)`);
    return sorties[cle];
  };
  let orphelines = 0, retirees = 0, portees = 0;
  const lignes = [];
  for (const g of garanties) {
    if (g.retiree) { retirees++; lignes.push(`  ◦ retirée : ${g.garantie} — ${g.retiree}`); continue; }
    const manques = [];
    for (const [cle, motif] of g.ou) {
      const s = lancer(cle);
      if (s.code !== 0) manques.push(`${cle} est rouge (code ${s.code})`);
      else if (!s.verts.some((l) => motif.test(l))) manques.push(`${cle} n'a pas de ligne verte ${motif}`);
    }
    if (manques.length) { orphelines++; lignes.push(`  ❌ ${g.garantie} — ${manques.join(' ; ')}`); }
    else { portees++; lignes.push(`  ✅ ${g.garantie} — ${g.ou.map(([c]) => c).join(' + ')}`); }
  }
  console.log(lignes.join('\n'));
  for (const [cle, s] of Object.entries(sorties)) if (s.code !== 0) console.log(`\n── ${cle} (fin de sortie)\n${s.queue}`);
  console.log(orphelines ? `\n❌ ${nom} : ${orphelines} garantie(s) orpheline(s), ${portees} portée(s), ${retirees} retirée(s)`
    : `\n✅ ${nom} : ${portees} garanties portées par le chemin qui existe, ${retirees} retirée(s) avec leur objet`);
  process.exitCode = orphelines ? 1 : 0;
}

// Les juges communs aux favoris (chemin d'aujourd'hui : panneau de l'extension + file serveur).
const JUGES_FAVORIS = {
  liste: { args: ['scripts/audit-favoris-liste.cjs'] },                    // vrai background.js : aperçu, cochables, lancement
  clair: { args: ['scripts/audit-favoris-clair.cjs'] },                    // règles du parcours et de la file serveur
  etats: { args: ['scripts/audit-favoris-ecran.cjs'] },                    // états d'un favori (envoyé, incertain, refus)
  irreprochable: { args: ['scripts/audit-favoris-offres-irreprochable.cjs'] }, // vrai background.js : refus, vendus, arrêt
  file: { args: ['--test', 'scripts/tests/favoris-automatisation.test.mjs', 'scripts/tests/favoris-historique.test.mjs',
    'scripts/tests/favoris-preuves.test.mjs', 'scripts/tests/favoris-progression.test.mjs', 'scripts/tests/favoris-contexte.test.mjs', 'scripts/tests/diagnostic-favoris.test.mjs'] },
  panneau: { args: ['scripts/bancs/panneau-favoris-tableau.cjs'] },        // le vrai panneau (vrm-badge.js) rendu, 390 et ordinateur
};

module.exports = { juger, JUGES_FAVORIS };
