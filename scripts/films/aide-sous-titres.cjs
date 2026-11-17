#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LES PISTES DE SOUS-TITRES EN 4 AUTRES LANGUES (17 nov., lot aide-videos)
//    node scripts/films/aide-sous-titres.cjs            (écrit public/aide/videos/<id>.<langue>.vtt)
//    node scripts/films/aide-sous-titres.cjs --verifier (rouge si une piste manque, diffère, ou
//                                                        si une ligne n'est pas traduite)
//  Chaque piste reprend EXACTEMENT les instants de la piste française (<id>.vtt, écrite au
//  tournage) ; chaque ligne de texte passe par la table `_aide-sous-titres.cjs`. Aucune IA,
//  aucun service : une table écrite, relue.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { LANGUES, traduire } = require('./_aide-sous-titres.cjs');
const DOSSIER = path.join(__dirname, '..', '..', 'public', 'aide', 'videos');

// Une piste française ⇒ la piste d'une langue, ou { manque: [lignes] }.
function piste(vtt, langue) {
  const manque = [];
  const out = String(vtt).split('\n').map((l) => {
    if (!l.trim() || l === 'WEBVTT' || /^\d+$/.test(l) || /-->/.test(l)) return l;
    const t = traduire(l, langue);
    if (!t) { manque.push(l); return l; }
    return t;
  }).join('\n');
  return manque.length ? { manque } : { vtt: out };
}

function tout({ verifier = false, dossier = DOSSIER } = {}) {
  const ids = fs.readdirSync(dossier).filter((f) => /^[a-z]+\.vtt$/.test(f)).map((f) => f.slice(0, -4)).sort();
  const defauts = [];
  for (const id of ids) {
    const fr = fs.readFileSync(path.join(dossier, `${id}.vtt`), 'utf8');
    for (const l of LANGUES) {
      const r = piste(fr, l);
      const f = path.join(dossier, `${id}.${l}.vtt`);
      if (r.manque) { defauts.push(`${id} (${l}) : pas traduit — ${r.manque.join(' | ')}`); continue; }
      if (verifier) { const lu = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; if (lu !== r.vtt) defauts.push(`${id}.${l}.vtt ${lu == null ? 'absent' : 'pas à jour'}`); }
      else fs.writeFileSync(f, r.vtt);
    }
  }
  return { ids, defauts };
}

if (require.main === module) {
  const verifier = process.argv.includes('--verifier');
  const { ids, defauts } = tout({ verifier });
  for (const d of defauts) console.log('❌ ' + d);
  console.log(defauts.length ? `❌ sous-titres : ${defauts.length} défaut(s)` : `✅ sous-titres : ${ids.length} vidéos × ${LANGUES.length} langues ${verifier ? 'à jour' : 'écrites'}`);
  process.exit(defauts.length ? 1 : 0);
}
module.exports = { piste, tout };
