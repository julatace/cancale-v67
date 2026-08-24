#!/usr/bin/env node
/**
 * L'INSTRUMENTATION NE DOIT PAS DÉTRUIRE SES PROPRES PREUVES
 *
 * `panel_diag_capture` porte deux choses : `n` (les compteurs, écrits par
 * `noterDiag`) et `rates` (un échantillon de réponse ratée par type, écrit par
 * `echantillonRate`). C'est ce couple qui a fini par expliquer la fiche article
 * (§5.24 → §5.26) : le compteur dit COMBIEN, l'échantillon dit POURQUOI.
 *
 * ⚠️ Constaté en base le 24 août : `rates: {}` alors que `abandon_json_item`
 * était à **73** et `label_url_introuvable` à 1. Cause — `noterDiag` réécrivait
 * la ligne avec `{ n, majAt }` seulement, donc il EFFAÇAIT `rates`. Et comme il
 * part à chaque capture (des centaines de fois par jour) alors qu'un échantillon
 * n'est posé que sur un échec, la preuve était détruite dans la minute.
 *
 * Ce contrôle exécute le VRAI `noterDiag` découpé du fichier, avec des stubs,
 * et vérifie que la ligne réécrite garde tout le reste.
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };

(async () => {
  const m = SRC.match(/async function noterDiag\(cle\) \{[\s\S]*?\n\}/);
  if (!m) { nok('noterDiag est lisible', 'fonction introuvable'); }
  else {
    let ecrit = null;
    const ctx = {
      _diag: { n: {}, dernier: 0 },
      sbGet: async () => [{ data: { n: { deja: 5 }, rates: { item: { tete: '<!DOCTYPE html>', at: 'hier' } }, autre: 'à garder' } }],
      supabaseUpsert: async (_t, rows) => { ecrit = rows[0].data; },
    };
    const fabrique = new Function('_diag', 'sbGet', 'supabaseUpsert', m[0] + '\nreturn noterDiag;');
    const noterDiag = fabrique(ctx._diag, ctx.sbGet, ctx.supabaseUpsert);
    await noterDiag('label_url_introuvable');
    if (!ecrit) nok('noterDiag écrit bien la ligne', 'aucune écriture');
    else {
      ecrit.rates && ecrit.rates.item && ecrit.rates.item.tete === '<!DOCTYPE html>'
        ? ok("noterDiag n'efface pas les échantillons (`rates`)")
        : nok("noterDiag n'efface pas les échantillons", '`rates` a disparu de la ligne réécrite');
      ecrit.autre === 'à garder'
        ? ok('noterDiag garde les autres champs de la ligne')
        : nok('noterDiag garde les autres champs', 'un champ voisin a été effacé');
      (ecrit.n && ecrit.n.deja === 5 && ecrit.n.label_url_introuvable === 1)
        ? ok('noterDiag cumule bien les compteurs')
        : nok('noterDiag cumule bien les compteurs', JSON.stringify(ecrit.n));
    }
  }

  // ── L'endpoint mort n'est plus appelé en boucle ────────────────────────────
  // Mesuré : recu_item = 73, abandon_json_item = 73, ecrit_item = 0.
  // `GET /api/v2/items/{id}` renvoie une page d'erreur HTML en statut 200
  // (§5.26). La capture passive en tirait 6 par visite, pour rien.
  const INJ = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'inject.js'), 'utf8');
  /apiGet\(`\/api\/v2\/items\/\$\{id\}`\)/.test(INJ)
    ? nok("aucune requête automatique vers la fiche article", '`inject.js` en tire encore par lots à chaque visite')
    : ok("aucune requête automatique vers la fiche article (73 échecs sur 73)");
  /wardrobeIds/.test(INJ)
    ? nok('aucune variable morte laissée derrière', '`wardrobeIds` ne sert plus à rien')
    : ok('aucune variable morte laissée derrière');

  console.log(ko ? `\n${ko} contrôle(s) en échec.` : "\nL'instrumentation garde ses preuves, et rien ne tape dans le vide.");
  process.exit(ko ? 1 : 0);
})();
