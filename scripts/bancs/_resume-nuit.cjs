// ════════════════════════════════════════════════════════════════════════════
//  LE RÉSUMÉ LISIBLE DU CONTRÔLE DE NUIT (16 nov., satisfaction-clients, point 1)
//  Julien : « zéro bug visible sur iPhone, en permanence ». Le workflow
//  .github/workflows/controle-nuit-iphone.yml passe le banc stabilite-iphone.cjs
//  chaque nuit (WebKit « iPhone 15 » et Chromium 390) ; ce script lit les
//  `mesures.json` qu'il a rangés et écrit UN résumé en mots simples (Markdown) :
//  par moteur, le nombre de contrôles verts / rouges, puis chaque rouge rangé par
//  FAMILLE (erreur JS, écran tombé, contraste…) avec les écrans touchés.
//  Il ne décide RIEN : le banc a déjà rendu son code (rouge ⇒ le job échoue).
//    node scripts/bancs/_resume-nuit.cjs <dossier|mesures.json>…   → Markdown sur la sortie
//  Avec GITHUB_STEP_SUMMARY, le résumé est aussi ajouté à la page du workflow.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');

// Les familles de contrôles du banc (S1…S13), en mots que Julien comprend.
const FAMILLES = {
  S1: 'Erreur JavaScript à l’écran',
  S2: 'Écran tombé sur le garde-fou',
  S3: 'Texte trop pâle (contraste < 4,5:1)',
  S4: 'Contenu qui déborde à droite',
  S5: 'Barres fixes qui se recouvrent',
  S6: 'Contenu caché sous la barre du bas',
  S7: 'Bouton recouvert (impossible à toucher)',
  S8: 'Défilement bloqué',
  S9: 'Écran qui fige (longue tâche)',
  S10: 'Texte trop pâle (lu sur la capture)',
  S11: 'Deux textes l’un sur l’autre',
  S12: 'Plaque blanche pendant le chargement',
  S13: 'Chiffres coupés dans la rangée',
};
const familleDe = (quoi) => { const m = /^(S\d+)\b/.exec(String(quoi)); return m ? m[1] : 'autre'; };
const ecranDe = (quoi) => { const m = /^S\d+\s+(.+?)\s:\s/.exec(String(quoi)); return m ? m[1] : String(quoi).split(' : ')[0]; };

function lireMesures(cibles) {
  const out = [];
  for (const c of cibles) {
    const f = fs.existsSync(c) && fs.statSync(c).isDirectory() ? path.join(c, 'mesures.json') : c;
    try { out.push({ fichier: f, ...JSON.parse(fs.readFileSync(f, 'utf8')) }); }
    catch (e) { out.push({ fichier: f, illisible: String(e.message || e).slice(0, 120) }); }
  }
  return out;
}

function resumer(lots) {
  const l = ['# Contrôle de nuit · iPhone', ''];
  let rouges = 0, illisibles = 0;
  for (const m of lots) {
    if (m.illisible) { illisibles++; l.push(`## ${path.basename(path.dirname(m.fichier))}`, '', `❌ Pas de résultat : le banc n’a rien rangé (${m.illisible}). Le job a planté avant la fin : regarder son journal.`, ''); continue; }
    const ko = Array.isArray(m.ko) ? m.ko : [];
    const b = m.bilan || { ok: null, ko: ko.length };
    rouges += ko.length;
    l.push(`## ${m.moteur === 'webkit' ? 'Safari (WebKit) · iPhone 15' : `Chromium · ${m.largeur || 390} px`}`, '');
    l.push(ko.length ? `❌ **${ko.length} problème${ko.length > 1 ? 's' : ''}** sur ${b.ok != null ? b.ok + ko.length : '?'} contrôles (${m.ecrans || '?'} écrans, ${(m.themes || []).join(' et ') || 'thèmes ?'}).` : `✅ Tout va bien : ${b.ok} contrôles verts (${m.ecrans || '?'} écrans, ${(m.themes || []).join(' et ') || 'thèmes ?'}).`, '');
    if (!ko.length) continue;
    const parFam = new Map();
    for (const q of ko) { const f = familleDe(q); if (!parFam.has(f)) parFam.set(f, []); parFam.get(f).push(ecranDe(q)); }
    l.push('| problème | écrans touchés |', '|---|---|');
    for (const [f, ecr] of [...parFam.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const uniq = [...new Set(ecr)];
      l.push(`| ${FAMILLES[f] || 'Autre'} (${f}) | ${uniq.slice(0, 8).join(', ')}${uniq.length > 8 ? ` et ${uniq.length - 8} autre${uniq.length - 8 > 1 ? 's' : ''}` : ''} |`);
    }
    l.push('');
  }
  l.push(rouges || illisibles ? 'Les captures et le détail de chaque mesure sont dans les fichiers joints au workflow (« Artifacts »).' : 'Rien à corriger cette nuit.');
  return { texte: l.join('\n') + '\n', rouges, illisibles };
}

module.exports = { resumer, lireMesures, FAMILLES, familleDe, ecranDe };

if (require.main === module) {
  const cibles = process.argv.slice(2);
  if (!cibles.length) { console.error('usage : _resume-nuit.cjs <dossier|mesures.json>…'); process.exit(2); }
  const r = resumer(lireMesures(cibles));
  process.stdout.write(r.texte);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, r.texte);
}
